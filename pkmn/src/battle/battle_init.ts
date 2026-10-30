import { decodeBattleText } from './battle_text_codec';
// Unused A5c3f checkpoint-04. pret e89ead15; stops immediately before StartBattle.
import {
  A, encodeText, GHOST_PIC, isGhostBattle, MON_GHOST, RESTLESS_SOUL, SILPH_SCOPE,
  TRAINER_BATTLE, WILD_BATTLE, W_SPRITE_FLIPPED, type BattleState,
} from './battle_state';
import { D } from './battle_end_state';
import { BattleRandomState } from './battle_random_state';
import { loadEnemyMonData } from './battle_loaders';
import { getTrainerInformation, readTrainer, trainerPicName } from './battle_trainer_party';
import { loadMonFrontSprite, loadTrainerPic } from './battle_slides';
import { loadPartyPokeballGfx, setupEnemyPartyPokeballs, ENEMY_SEND_CELLS } from './battle_enemy_send_out';
import { isPlayerPikachuAsleepInParty } from './battle_send_out';
import { modifyPikachuHappiness } from './battle_pikachu';
import { playCryCue, playPikachuClipCue, type BattleVoiceHost } from './battle_voice_cues';
import { hudContext, drawEnemyHud } from './battle_hud_state';
import { bindEntryBattleScreen } from './battle_screen_binding';
import { BattleUnsupportedState } from './battle_move_data';
import { delayFrames, type Program } from './battle_menu_context';
import type { BattleScreen } from './battle_screen';
import type { BattleAudio, BattleSfx } from './battle_audio';
import type { EnemySendOutHost } from './battle_enemy_send_out';
import type { TextBindings } from '../text/text_runner';
import { textBgTransfer } from '../text/bg_transfer';
import { textBoxBorder } from '../menus/tile_surface';
import { BattleTiles } from './battle_tiles';

/** pret ram/{wram,hram}.asm; pinned symbols 573535d. Views only, no new WRAM storage. */
export const INIT = {
  wMapPalOffset: 0xd35c, wLetterPrintingDelayFlags: 0xd357,
  hTileAnimations: 0xffd7, wSavedTileAnimations: 0xd0d3,
  wTestBattlePlayerSelectedMove: 0xccd9, wUpdateSpritesEnabled: 0xcfca, hWY: 0xffb0,
  wSpriteFlipped: W_SPRITE_FLIPPED, // Compatibility view used by old tests; retirement carry11.
} as const;

export interface BattleInitSaved {
  readonly mapPalOffset: number;
  readonly letterPrintingDelayFlags: number;
}

export interface BattleInitHost extends Pick<EnemySendOutHost, 'screen' | 'renderTiles' | 'pokeballTiles'> {
  printText(program: string, bindings?: TextBindings): Program;
  saveScreenTilesToBuffer1(): void;
  loadScreenTilesFromBuffer1(): void;
  audio: BattleAudio;
  voice: BattleVoiceHost;
  trainerAppeared: BattleSfx;
  waitForSound(): Program;
  /** Named A5e presentation hand-off (ghost_marowak_anim.asm); no substitute animation here. */
  marowakAnimation(state: BattleState): Program;
  /** Picture names only. Checkpoint-06 supplies their decoded pixels. */
  frontPicture(state: BattleState): string;
}

/** pret init_battle_variables.asm:1-38. WRAM only; PlayBattleMusic remains A5d's. */
export function initBattleVariables(state: BattleState): void {
  state.mem[INIT.wSavedTileAnimations] = state.mem[INIT.hTileAnimations];
  state.wActionResultOrTookBattleTurn = state.wBattleResult = 0;
  state.mem.fill(0, D.wPartyAndBillsPCSavedMenuItem, D.wPartyAndBillsPCSavedMenuItem + 4);
  state.mem[D.wListScrollOffset] = state.wCriticalHitOrOHKO = state.wBattleMonSpecies = 0;
  state.mem[D.wPartyGainExpFlags] = state.wPlayerMonNumber = state.wEscapedFromBattle = 0;
  state.mem[INIT.wMapPalOffset] = state.wPlayerHPBarColor = state.wEnemyHPBarColor = 0;
  state.mem.fill(0, D.wCanEvolveFlags, D.wCanEvolveFlags + D.wMiscBattleDataEnd - D.wMiscBattleData);
  state.mem[INIT.wTestBattlePlayerSelectedMove] = 1;
  if (state.wCurMap >= 0xd9 && state.wCurMap < 0xdd) state.wBattleType = 2;
}

/** pret init_battle.asm:6-10,25-39,61-64. No frames or music; attach RNG before the two wild DV draws. */
export function setupBattleBeforeTransition(state: BattleState, random: BattleRandomState): BattleInitSaved {
  if (state.wLinkState !== 0) throw new BattleUnsupportedState('link battle');
  random.attach(state);
  // InitOpponent precedes InitBattleCommon on the cartridge.
  state.wCurPartySpecies = state.wEnemyMonSpecies2 = state.wCurOpponent;
  const saved = { mapPalOffset: state.mem[INIT.wMapPalOffset], letterPrintingDelayFlags: state.mem[INIT.wLetterPrintingDelayFlags] };
  state.mem[INIT.wLetterPrintingDelayFlags] &= ~2;
  initBattleVariables(state);
  if (state.wEnemyMonSpecies2 < 200) {
    state.wIsInBattle = WILD_BATTLE;
    loadEnemyMonData(state);
  } else {
    state.mem[D.wTrainerClass] = state.wEnemyMonSpecies2 - 200;
    getTrainerInformation(state);
    readTrainer(state);
  }
  return saved;
}

/** pret home/copy2.asm:226-239. ClearScreen writes all 360 cells, then Delay3. */
function* clearScreen(screen: BattleScreen): Program {
  for (let y = 0; y < 18; y++) for (let x = 0; x < 20; x++) screen.put(x, y, ' ');
  yield* delayFrames(3);
}

/** pret home/clear_sprites.asm:1-9. The screen owns the one shadow-OAM buffer. */
function clearSprites(screen: BattleScreen): void {
  for (let slot = 0; slot < 40; slot++) screen.setOam(slot, { y: 0, x: 0, tile: 0, attributes: 0 });
}

/** pret init_battle.asm:235-281. CopyUncompressedPicToTilemap, unflipped seven-column placement. */
function placePicture(state: BattleState, screen: BattleScreen, x: number, y: number): void {
  const flipped = state.mem[INIT.wSpriteFlipped] !== 0;
  for (let col = 0; col < 7; col++) for (let row = 0; row < 7; row++)
    screen.put(x + (flipped ? 6 - col : col), y + row, (state.mem[D.hStartTileID] + col * 7 + row) & 255);
}

/** pret core.asm:6384-6446; home/pics.asm:148-193. Head OAM, interlace copy7 + sprite copy7, body. */
export function* loadPlayerBackPic(state: BattleState, screen: BattleScreen): Program {
  const picture = state.wBattleType === 1 ? 'oldmanb' : state.wBattleType === 4 ? 'prof.oakb' : 'redb';
  state.mem[D.hOAMTile] = 0;
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row < 3; row++) {
      screen.setOam(col * 3 + row, { y: 0x38 + row * 8, x: 0xa0 + col * 8,
        tile: state.mem[D.hOAMTile], attributes: 2 });
      state.mem[D.hOAMTile]++;
    }
    state.mem[D.hOAMTile] += 4;
  }
  const flipped = state.mem[INIT.wSpriteFlipped] !== 0;
  for (const _ of screen.copyBack(picture, flipped)) { void _; yield 'serviced'; }
  for (const _ of screen.copySpritePicture(picture, flipped)) { void _; yield 'serviced'; }
  state.mem[D.hStartTileID] = 0x31;
  placePicture(state, screen, 1, 5);
}

/** pret draw_hud_pokeball_gfx.asm:19-33,52-120. Player HUD, six ball slots and OAM entries0-5. */
function setupOwnPartyPokeballs(state: BattleState, screen: BattleScreen): void {
  const e = ENEMY_SEND_CELLS;
  state.setBytes(e.wHUDGraphicsTiles, [0x73, 0x77, 0x6f], 3);
  screen.put(18, 10, 0x73); screen.put(18, 11, 0x77);
  for (let x = 17; x > 9; x--) screen.put(x, 11, 0x76);
  screen.put(9, 11, 0x6f);
  state.mem.fill(0x34, D.wBuffer, D.wBuffer + 6);
  const count = state.mem[D.wPartyCount] || 256;
  for (let slot = 0; slot < count; slot++) {
    const base = (D.wPartyMons + slot * 44) & 65535;
    const alive = state.mem[(base + 1) & 65535] | state.mem[(base + 2) & 65535];
    state.mem[(D.wBuffer + slot) & 65535] = !alive ? 0x33 : state.mem[(base + 4) & 65535] ? 0x32 : 0x31;
  }
  state.mem[e.wBaseCoordX] = state.mem[e.wBaseCoordY] = 0x60;
  state.mem[e.wHUDPokeballGfxOffsetX] = 8; state.mem[e.wdef4] = 0;
  for (let slot = 0; slot < 6; slot++) {
    screen.setOam(slot, { y: state.mem[e.wBaseCoordY], x: state.mem[e.wBaseCoordX],
      tile: state.mem[D.wBuffer + slot], attributes: 0 });
    state.mem[e.wBaseCoordX] = (state.mem[e.wBaseCoordX] + 8) & 255;
  }
}

/** pret draw_hud_pokeball_gfx.asm:1-7. Exactly one gfx load, own party, then enemy only for trainers. */
export function* drawAllPokeballs(state: BattleState, host: BattleInitHost): Program {
  yield* loadPartyPokeballGfx(host);
  setupOwnPartyPokeballs(state, host.screen);
  if (state.wIsInBattle !== WILD_BATTLE) setupEnemyPartyPokeballs(state, host);
}

/** pret common_text.asm:78-85. Modifier writes precede PlaySound; wait for this new sound's return. */
function* trainerAppearedSound(state: BattleState, host: BattleInitHost): Program {
  state.mem[D.wFrequencyModifier] = host.audio.frequencyModifier = 0;
  state.mem[D.wTempoModifier] = host.audio.tempoModifier = 0x80;
  host.audio.play(host.trainerAppeared);
  yield* host.waitForSound();
}

/** pret common_text.asm:1-87. Tower before cries, scoped Marowak falls through into .playSFX. */
export function* printBeginningBattleText(state: BattleState, host: BattleInitHost): Program {
  let program: string;
  if (state.wIsInBattle === WILD_BATTLE) {
    if (state.wCurMap >= 0x90 && state.wCurMap < 0x95) {
      const scope = state.quantityInBag(SILPH_SCOPE);
      state.wCurPartySpecies = state.wEnemyMonSpecies2;
      if (state.wEnemyMonSpecies2 === RESTLESS_SOUL) {
        if (scope) {
          yield* host.printText('EnemyAppearedText', { enemyMonNick: decodeBattleText(state.mem, D.wEnemyMonNick) });
          yield* host.printText('UnveiledGhostText');
          loadEnemyMonData(state);
          yield* host.marowakAnimation(state);
          yield* host.printText('WildMonAppearedText', { enemyMonNick: decodeBattleText(state.mem, D.wEnemyMonNick) });
          yield* trainerAppearedSound(state, host);
          return;
        }
      } else if (scope) {
        loadEnemyMonData(state);
        yield* ordinaryWildBeginning(state, host);
        return;
      }
      yield* host.printText('EnemyAppearedText', { enemyMonNick: decodeBattleText(state.mem, D.wEnemyMonNick) });
      yield* host.printText('GhostCantBeIDdText');
      return;
    }
    yield* ordinaryWildBeginning(state, host);
    return;
  } else {
    yield* trainerAppearedSound(state, host);
    yield* delayFrames(20);
    program = 'TrainerWantsToFightText';
  }
  if (state.wBattleType === 0) yield* drawAllPokeballs(state, host);
  yield* host.printText(program, { trainerName: decodeBattleText(state.mem, D.wTrainerName) });
}

/** pret common_text.asm:11-35,43-52. Existing cry/PCM cue ports; committed text programs only. */
function* ordinaryWildBeginning(state: BattleState, host: BattleInitHost): Program {
  if (state.wBattleType === 4) yield* playPikachuClipCue(host.voice, isPlayerPikachuAsleepInParty(state) ? 37 : 11);
  else playCryCue(host.voice, state.wEnemyMonSpecies2);
  if (state.wBattleType === 0) yield* drawAllPokeballs(state, host);
  yield* host.printText(state.wMoveMissed ? 'HookedMonAttackedText' : 'WildMonAppearedText',
    { enemyMonNick: decodeBattleText(state.mem, D.wEnemyMonNick) });
}

/** pret core.asm:9-14,88-103. Interim slide: omit the scroll and its setup, retain the entire tail. */
export function* slidePlayerAndEnemySilhouettesOnScreen(state: BattleState, host: BattleInitHost): Program {
  yield* loadPlayerBackPic(state, host.screen);
  state.mem[D.wTextBoxID] = 1;
  textBoxBorder(new BattleTiles(host.screen), 0, 12, 4, 18);
  textBgTransfer.enabled = true;
  state.mem[D.hStartTileID] = 0x31;
  placePicture(state, host.screen, 1, 5);
  state.mem[INIT.hWY] = host.screen.wy = 0;
  textBgTransfer.enabled = true;
  yield* delayFrames(3);
  const ctx = hudContext(state);
  yield* host.screen.setPalBattle({ partySpecies: ctx.partySpecies, enemySpecies2: ctx.enemySpecies2,
    playerBar: state.wPlayerHPBarColor as 0 | 1 | 2, enemyBar: state.wEnemyHPBarColor as 0 | 1 | 2 });
  // HideSprites changes only Y; the head's X/tile/attributes remain until ClearSprites below.
  for (let slot = 0; slot < 40; slot++) host.screen.setOam(slot, { ...host.screen.shadowOam(slot), y: 0xa0 });
  yield* printBeginningBattleText(state, host);
}

/** pret core.asm:6348-6367; init_battle.asm:40-128. First owned frame is the full HUD load; stop at StartBattle. */
export function* initBattleAfterTransition(state: BattleState, host: BattleInitHost): Program {
  bindEntryBattleScreen(state, host.screen);
  for (const _ of host.screen.loadHudAndHpBarAndStatusTilePatterns()) { void _; yield 'serviced'; }
  textBgTransfer.enabled = true;
  state.mem[INIT.wUpdateSpritesEnabled] = 0xff;
  clearSprites(host.screen);
  yield* clearScreen(host.screen);
  textBgTransfer.enabled = false;
  state.mem[INIT.hWY] = host.screen.wy = 0;
  state.mem[INIT.hTileAnimations] = 0;
  state.mem.fill(0, D.wPlayerStatsToDouble, D.wPlayerStatsToDouble + 5);
  state.wPlayerDisabledMove = 0;
  if (state.wEnemyMonSpecies2 >= 200) {
    const picture = trainerPicName(state);
    if (!picture) throw new BattleUnsupportedState('missing trainer picture');
    // _LoadTrainerPic passes $77 in A/C to the decoder; it does not write the mon header's dimensions.
    yield* loadTrainerPic(host.screen, picture, state.mem[INIT.wSpriteFlipped] !== 0);
    state.wEnemyMonSpecies2 = state.mem[D.hStartTileID] = 0;
    state.mem[D.wAICount] = 0xff;
    placePicture(state, host.screen, 12, 0);
    state.wEnemyMonPartyPos = 0xff;
    state.wIsInBattle = TRAINER_BATTLE;
    if (state.mem[D.wLoneAttackNo] !== 0) modifyPikachuHappiness(state, 4);
  } else {
    if (state.wCurOpponent === RESTLESS_SOUL || isGhostBattle(state)) {
      state.wMonHSpriteDim = 0x66;
      state.mem[A.wMonHSpriteDim + 1] = GHOST_PIC & 255;
      state.mem[A.wMonHSpriteDim + 2] = GHOST_PIC >>> 8;
      state.mem.set(encodeText('GHOST@'), A.wEnemyMonNick);
      const saved = state.wCurPartySpecies;
      state.wCurPartySpecies = MON_GHOST;
      state.frontPicSpecies = MON_GHOST; state.frontPic = 'ghost';
      yield* loadMonFrontSprite(host.screen, 'ghost', state.mem[INIT.wSpriteFlipped] !== 0);
      state.wCurPartySpecies = saved;
    } else {
      state.frontPicSpecies = state.wCurPartySpecies; state.frontPic = 'mon';
      yield* loadMonFrontSprite(host.screen, host.frontPicture(state), state.mem[INIT.wSpriteFlipped] !== 0);
    }
    state.mem[D.wTrainerClass] = state.mem[D.hStartTileID] = 0;
    placePicture(state, host.screen, 12, 0);
  }
  yield* host.screen.setPalBattleBlack();
  yield* slidePlayerAndEnemySilhouettesOnScreen(state, host);
  textBgTransfer.enabled = false;
  // pret init_battle.asm:140-141. Use this routine's committed local @ program.
  yield* host.printText('_InitBattleCommon.emptyString');
  host.saveScreenTilesToBuffer1();
  yield* clearScreen(host.screen);
  host.screen.transferDestination = 0x98;
  textBgTransfer.enabled = true;
  yield* delayFrames(3);
  host.screen.transferDestination = 0x9c;
  host.loadScreenTilesFromBuffer1();
  for (let y = 7; y < 12; y++) for (let x = 9; x < 19; x++) host.screen.put(x, y, ' ');
  for (let y = 0; y < 4; y++) for (let x = 1; x < 11; x++) host.screen.put(x, y, ' ');
  clearSprites(host.screen);
  if (state.wIsInBattle === WILD_BATTLE) yield* drawEnemyHud(state, host.screen);
}
