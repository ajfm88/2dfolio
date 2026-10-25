// Unused player-side ports. pret e89ead15 core.asm:1091–1167,1764–1871,2525–2546;
// common_text.asm:113–259. Enemy send-out/SHIFT remain checkpoint-05b.
import { battleContext, decodeNick, LINK_STATE_BATTLING, type BattleState } from './battle_state';
import { D } from './battle_end_state';
import { multiply, divide } from './battle_arithmetic';
import { flagAction, hasMonFainted } from './battle_end_helpers';
import { isThisPartyMonStarterPikachu } from './battle_pikachu';
import { loadBattleMonFromParty } from './battle_loaders';
import { drawEnemyHud, drawPlayerHud, hudContext } from './battle_hud_state';
import { loadHudTilePatterns, loadMonBackPic } from './battle_slides';
import { playMoveAnimation } from './battle_turn_status';
import { playCryCue, playPikachuClipCue, type BattleVoiceHost } from './battle_voice_cues';
import { displayTwoOptionMenu } from './battle_two_option';
import { tryRunningFromBattle } from './battle_menu';
import { BattleUnsupportedState } from './battle_move_data';
import { delayFrames, type BattleActionHost, type Program } from './battle_menu_context';
import type { BattlePartyHost } from './battle_party_menu';
import type { BattleAudio } from './battle_audio';
import type { PartyMenu } from '../menus/party_menu';
import type { TextBindings, TextRunnerOptions } from '../text/text_runner';
import { textBgTransfer } from '../text/bg_transfer';
import { getPartyAndBillsSavedMenuItem, setBattleAndStartSavedMenuItem } from '../list_state';

export interface PlayerSendOutHost extends Pick<BattleActionHost, 'screen' | 'tiles' | 'readJoypad' | 'pressSound'
  | 'saveScreenTilesToBuffer1' | 'loadScreenTilesFromBuffer1' | 'waitForSound' | 'playSound' | 'runOdds'> {
  printText(program: string, bindings?: TextBindings, options?: TextRunnerOptions): Program;
  audio: BattleAudio;
  voice: BattleVoiceHost;
  partyView: Pick<PartyMenu, 'openBattleChoice' | 'goBackToChoice' | 'frameBattleChoice' | 'printBattleChoiceText'>;
  updateSprites(): void;
  /** Preloaded picture selected by the caller. The real 14-frame loader runs below. */
  backPicture(state: BattleState): string;
  /** Deferred animation bodies; their outer waits/copies remain in these ports. */
  animation(state: BattleState): Program;
  sendingOutMon(state: BattleState, x: number, y: number): void;
  pikachuEntrance(state: BattleState): void;
  slidePlayerOff(state: BattleState): void;
}

/** common_text.asm:119–150,196–225. Real shared HRAM Multiply/Divide, including stale high byte on retreat. */
function prefixRatio(state: BattleState, hp: number, clearHigh: boolean): number | null {
  if (clearHigh) state.mem[D.hMultiplicand] = 0;
  state.writeBE(D.hMultiplicand + 1, hp);
  state.mem[D.hMultiplier] = 25;
  const h = state.mem.subarray(D.hProduct, D.hProduct + 10);
  multiply(h);
  state.mem[D.hDivisor] = (state.wEnemyMonMaxHP >>> 2) & 255;
  if (divide(h, 4)) return null; // Source CPU loop never returns; interrupts remain serviceable.
  return state.mem[D.hQuotient + 3];
}

/** common_text.asm:113–154. Enemy HP0 skips both arithmetic and the last-switch-in write. */
export function* printSendOutMonMessage(state: BattleState, host: Pick<PlayerSendOutHost, 'printText'>): Program {
  let label = 'GoText';
  if (state.wEnemyMonHP !== 0) {
    state.writeBE(D.wLastSwitchInEnemyMonHP, state.wEnemyMonHP);
    const percent = prefixRatio(state, state.wEnemyMonHP, true);
    if (percent === null) for (;;) yield 'serviced';
    label = percent >= 70 ? 'GoText' : percent >= 40 ? 'DoItText' : percent >= 10 ? 'GetmText' : 'EnemysWeakText';
  }
  yield* host.printText(label, { battleMonNick: decodeNick(state.mem, D.wBattleMonNick) }, {
    asm: Object.fromEntries(['GoText', 'DoItText', 'GetmText', 'EnemysWeakText'].map(key => [key, () => 'PlayerMon1Text'])),
  });
}

/** common_text.asm:183–259. The math runs at PlayerMon2Text's asm, after placing the nickname. */
export function* retreatMon(state: BattleState, host: Pick<PlayerSendOutHost, 'printText'>): Program {
  yield* host.printText('PlayerMon2Text', { battleMonNick: decodeNick(state.mem, D.wBattleMonNick) }, {
    asm: Object.fromEntries(['EnoughText', 'OKExclamationText', 'GoodText'].map(key => [key, () => 'ComeBackText'])),
    asmContinuations: { PlayerMon2Text: function* () {
      const delta = (state.readBE(D.wLastSwitchInEnemyMonHP) - state.wEnemyMonHP) & 65535;
      const percent = prefixRatio(state, delta, false);
      if (percent === null) for (;;) yield;
      return percent === 0 ? 'EnoughText' : percent < 30 ? 'ComeBackText' : percent < 70 ? 'OKExclamationText' : 'GoodText';
    } },
  });
}

/** pikachu_emotions.asm:372–411. Leaves whichPokemon at the found slot/sentinel, even when awake. */
export function isPlayerPikachuAsleepInParty(state: BattleState): boolean {
  state.wWhichPokemon = 0;
  for (;;) {
    const slot = state.wWhichPokemon, species = state.mem[D.wPartySpecies + slot];
    if (species === 255) return false;
    if (species === 0x54 && isThisPartyMonStarterPikachu(state))
      return (state.mem[D.wPartyMons + slot * 44 + 4] & 7) !== 0;
    if (slot === 5) return false;
    state.wWhichPokemon++;
  }
}

function* palette(state: BattleState, host: PlayerSendOutHost): Program {
  const ctx = hudContext(state); state.wPokedexNum = ctx.enemySpecies2;
  yield* host.screen.setPalBattle({ partySpecies: ctx.partySpecies, enemySpecies2: ctx.enemySpecies2,
    playerBar: state.wPlayerHPBarColor as 0 | 1 | 2, enemyBar: state.wEnemyHPBarColor as 0 | 1 | 2 });
}
function clearSprites(host: PlayerSendOutHost): void {
  for (let i = 0; i < 40; i++) host.screen.setOam(i, { x: 0, y: 0, tile: 0, attributes: 0 });
}

/** core.asm:1764–1825. HUD/copy/palette owners are real; A5e/J2 presentation bodies remain named cues. */
export function* sendOutMon(state: BattleState, host: PlayerSendOutHost): Program {
  yield* printSendOutMonMessage(state, host);
  if (state.wEnemyMonHP !== 0) yield* drawEnemyHud(state, host.screen);
  yield* drawPlayerHud(state, host.screen);
  yield* loadMonBackPic(state, host.screen, host.backPicture(state));
  state.mem[D.hStartTileID] = 0;
  state.mem[D.wBattleAndStartSavedMenuItem] = state.wPlayerMoveListIndex = 0;
  setBattleAndStartSavedMenuItem(0); // The checked battle menu reads its existing saved-cursor owner.
  state.mem[D.wBoostExpByExpAll] = state.wDamageMultipliers = state.wPlayerMoveNum = 0;
  state.mem[D.wPlayerUsedMove] = state.mem[D.wPlayerUsedMove + 1] = 0;
  state.mem.fill(0, D.wPlayerStatsToDouble, D.wPlayerStatsToDouble + 5);
  state.wPlayerDisabledMove = state.wPlayerDisabledMoveNumber = state.wPlayerMonMinimized = 0;
  yield* palette(state, host);
  state.wEnemyBattleStatus1 &= ~0x20;
  if (isThisPartyMonStarterPikachu(state)) {
    state.hWhoseTurn = 0; textBgTransfer.enabled = true;
    host.pikachuEntrance(state);
    const clip = isPlayerPikachuAsleepInParty(state) ? 37 : 11;
    yield* playPikachuClipCue({ getAlarm: () => host.voice.getAlarm(), setAlarm: value => host.voice.setAlarm(value),
      cry: id => host.voice.cry(id), clip: id => host.voice.clip(id), clearSfxIds: () => host.audio.clearClipIds() }, clip);
  } else {
    state.hWhoseTurn = 1;
    yield* playMoveAnimation(state, host, 0xc3); // POOF_ANIM, constants/move_constants.asm.
    host.sendingOutMon(state, 4, 11);
    playCryCue(host.voice, state.wCurPartySpecies);
  }
  yield* host.printText('PrintEmptyString.emptyString'); host.saveScreenTilesToBuffer1();
}

// data/tilemaps.asm's INCBIN bytes (5x5 and3x3), row-major. No bitmap-animation shortcut.
export const DOWNSCALED_5 = [49,56,70,84,91,50,57,71,85,92,52,59,73,87,94,54,61,75,89,96,55,62,76,90,97] as const;
export const DOWNSCALED_3 = [49,70,91,52,73,94,55,76,97] as const;
function clearBack(host: PlayerSendOutHost): void {
  for (let row = 5; row < 12; row++) for (let col = 1; col < 8; col++) host.screen.put(col, row, ' ');
}
/** animations.asm:2427–2468. CopyDownscaledMonTiles has no copy wait. */
function downscale(state: BattleState, host: PlayerSendOutHost, small: boolean): void {
  state.mem[D.wDownscaledMonSize] = small ? 1 : 0; state.mem[D.hBaseTileID] = 0;
  textBgTransfer.enabled = false;
  const size = small ? 3 : 5, x = small ? 4 : 3, y = small ? 9 : 7, table = small ? DOWNSCALED_3 : DOWNSCALED_5;
  table.forEach((tile, i) => host.screen.put(x + i % size, y + Math.floor(i / size), tile));
  textBgTransfer.enabled = true;
}
/** core.asm:1828–1871. Starter check temporarily selects the outgoing active mon, then restores selection. */
export function* animateRetreatingPlayerMon(state: BattleState, host: PlayerSendOutHost): Program {
  const selected = state.wWhichPokemon; state.wWhichPokemon = state.wPlayerMonNumber;
  const starter = isThisPartyMonStarterPikachu(state); state.wWhichPokemon = selected;
  if (starter) { state.hWhoseTurn = 0; host.slidePlayerOff(state); return; }
  clearBack(host); downscale(state, host, false); yield* delayFrames(4);
  clearBack(host); downscale(state, host, true); yield* delayFrames(3);
  clearBack(host); host.screen.put(5, 11, 0x4c); clearBack(host);
}

/** core.asm:1091–1117. TryRunning uses the first PARTY slot's speed, even if that slot is dead. */
export function* doUseNextMonDialogue(state: BattleState, host: PlayerSendOutHost): Program<{ carry: boolean }> {
  yield* host.printText('PrintEmptyString.emptyString'); host.saveScreenTilesToBuffer1();
  if (state.wIsInBattle !== 1) return { carry: false };
  yield* host.printText('UseNextMonText');
  for (;;) {
    state.mem[D.wTextBoxID] = 0x14; // TWO_OPTION_MENU
    yield* displayTwoOptionMenu(state, host, 13, 9, 10, 14);
    if (state.mem[D.wMenuExitMethod] !== 2) return { carry: false };
    if (state.wCurrentMenuItem === 0) continue; // Kept even though ordinary YES/NO cannot produce it.
    if (state.wLinkState === LINK_STATE_BATTLING) throw new BattleUnsupportedState('link');
    const ctx = new Proxy(battleContext(state), { get: (target, key) => key === 'playerSpeed'
      ? state.readBE(D.wPartyMons + 40) : Reflect.get(target, key) });
    return yield* tryRunningFromBattle(ctx, host);
  }
}

/** home/pokemon.asm:207–304. PartyMenu owns its opening/input/session frames; this bridges the returned cells. */
function* chooseParty(state: BattleState, host: PlayerSendOutHost, first: boolean): Program<{ carry: boolean }> {
  state.wMonDataLocation = state.wMenuWatchMovingOutOfBounds = 0;
  state.mem[D.wTopMenuItemY] = 1; state.mem[D.wTopMenuItemX] = 0;
  state.wCurrentMenuItem = state.mem[D.wLastMenuItem] = getPartyAndBillsSavedMenuItem();
  state.wMaxMenuItem = Math.max(0, state.mem[D.wPartyCount] - 1);
  const forceChoose = state.wForcePlayerToChooseMon !== 0; state.wForcePlayerToChooseMon = 0;
  state.mem[D.wMenuWatchedKeys] = forceChoose ? 1 : 3;
  if (first) host.partyView.openBattleChoice(state.partyMons.slice(0, state.mem[D.wPartyCount]).map(mon => {
    if (!mon) throw new BattleUnsupportedState('missing party mirror'); return mon;
  }), { forceChoose });
  else host.partyView.goBackToChoice();
  let choice;
  do { yield 'session'; choice = host.partyView.frameBattleChoice(host.readJoypad, host.pressSound); } while (!choice);
  state.wCurrentMenuItem = getPartyAndBillsSavedMenuItem();
  if (choice.kind === 'cancelled') return { carry: true };
  state.wWhichPokemon = choice.slot;
  state.wCurPartySpecies = state.wBattleMonSpecies2 = state.mem[D.wPartySpecies + choice.slot];
  return { carry: false };
}

function flagNewMon(state: BattleState): void {
  flagAction(state, D.wPartyGainExpFlags, 1, state.wPlayerMonNumber);
  flagAction(state, D.wPartyFoughtCurrentEnemyFlags, 1, state.wPlayerMonNumber);
}
/** core.asm:1125–1167. Cancellation/fainted choice re-enters the choose-only list, never its submenu. */
export function* chooseNextMon(state: BattleState, host: PlayerSendOutHost): Program<{ zero: boolean }> {
  state.mem[D.wPartyMenuTypeOrMessageID] = 2;
  let choice = yield* chooseParty(state, host, true);
  for (;;) {
    if (!choice.carry && !(yield* hasMonFainted(state, {
      printText: program => host.partyView.printBattleChoiceText(program),
    })).zero) break;
    choice = yield* chooseParty(state, host, false);
  }
  if (state.wLinkState === LINK_STATE_BATTLING) throw new BattleUnsupportedState('link');
  state.wActionResultOrTookBattleTurn = 0; clearSprites(host);
  state.wPlayerMonNumber = state.wWhichPokemon; flagNewMon(state); loadBattleMonFromParty(state);
  host.screen.bgp = host.screen.obp0 = host.screen.obp1 = 0;
  yield* loadHudTilePatterns(host.screen); host.loadScreenTilesFromBuffer1();
  yield* palette(state, host); host.screen.bgp = 0xe4; host.screen.obp0 = 0xd0;
  yield* sendOutMon(state, host);
  return { zero: state.wEnemyMonHP === 0 };
}

/** core.asm:2525–2546. Caller owns the voluntary switch's action1/white/HUD/palette wrapper. */
export function* switchPlayerMon(state: BattleState, host: PlayerSendOutHost): Program<{ carry: false; zero: false }> {
  yield* retreatMon(state, host); yield* delayFrames(50);
  yield* animateRetreatingPlayerMon(state, host);
  state.wPlayerMonNumber = state.wWhichPokemon; flagNewMon(state); loadBattleMonFromParty(state);
  yield* sendOutMon(state, host); host.saveScreenTilesToBuffer1(); state.wCurrentMenuItem = 2;
  return { carry: false, zero: false };
}

/** Fills A5c2's unused switchPlayerMon port, over the same BattleState-backed menu context. */
export function bindPlayerSwitch(state: BattleState, host: BattlePartyHost, player: PlayerSendOutHost): void {
  host.switchPlayerMon = function* () {
    // A5c2's object menu passes dex species IDs. HandlePartyMenuInput reads the raw species list;
    // adapt that hand-off here before the byte-based loader consumes wBattleMonSpecies2.
    state.wCurPartySpecies = state.wBattleMonSpecies2 = state.mem[D.wPartySpecies + state.wWhichPokemon];
    yield* switchPlayerMon(state, player);
  };
}

// Shared only by the unused enemy-side composition; player implementations stay unchanged.
export { palette as setSendOutBattlePalette, clearSprites as clearSendOutSprites, chooseParty as choosePartyForSendOut };
