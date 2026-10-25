// Unused checkpoint-06 ports. pret e89ead15 battle/experience.asm:1–382;
// pokemon/evos_moves.asm:325–382, status_screen.asm:255–300, home/joypad2.asm:55–87.
import { decodeNick, LINK_STATE_BATTLING, type BattleState } from './battle_state';
import { D } from './battle_end_state';
import { multiply, divide } from './battle_arithmetic';
import { calcExperience, calcLevelFromExperience } from './battle_calc_experience';
import { calcStats } from './battle_calc_stats';
import { getMonHeader, mirrorPartyProgress, applyBurnAndParalysisPenaltiesToPlayer, applyBadgeStatBoosts } from './battle_loaders';
import { calculateModifiedStats } from './battle_math';
import { drawPlayerHud } from './battle_hud_state';
import { flagAction } from './battle_end_helpers';
import { modifyPikachuHappiness, isThisPartyMonStarterPikachu } from './battle_pikachu';
import { BattleUnsupportedState, getMoveName, copyMoveNameToStringBuffer } from './battle_move_data';
import { gainedText, withExpAllText, type TextBindings, type TextRunnerOptions } from '../text/text_runner';
import { textBoxBorder, placeString, writeNumber, type TileSurface } from '../menus/tile_surface';
import type { Program } from './battle_menu_context';
import type { BattleScreen } from './battle_screen';

export interface ExperienceHost {
  screen: BattleScreen;
  tiles: TileSurface;
  /** Existing retained printer, with bank-relative sound resolution supplied by its audio owner. */
  printText(program: string, bindings?: TextBindings, options?: TextRunnerOptions): Program;
  saveScreenTilesToBuffer1(): void;
  loadScreenTilesFromBuffer1(): void;
  /** Existing JoypadLowSensitivity owner: return its hJoy5 byte, without menu Delay3 or a press sound. */
  readScrollJoypad(): number;
  /** Town-map animation is only called if its source flag is nonzero. */
  townMapSpriteBlinking?(): void;
  cableClubRun?(): void;
  /** Checkpoint-06b supplies the shared LearnMove Program and its B result. No move/PP write here. */
  learnMove(state: BattleState): Program<{ b: number }>;
}

/** experience.asm:300–331. All eight flag bits count, including fainted/nonparty bits. */
export function divideExpDataByNumMonsGainingExp(state: BattleState): void {
  let bits = state.mem[D.wPartyGainExpFlags], count = 0;
  for (let i = 0; i < 8; i++, bits >>>= 1) count += bits & 1;
  if (count < 2) return;
  state.mem[D.wTempByteValue] = count;
  const h = state.mem.subarray(D.hProduct, D.hProduct + 10);
  for (let i = 0; i < 7; i++) {
    h[0] = 0; h[1] = state.mem[D.wEnemyMonBaseStats + i]; h[4] = state.mem[D.wTempByteValue];
    divide(h, 2); state.mem[D.wEnemyMonBaseStats + i] = h[3];
  }
}

/** experience.asm:334–346: add floor(low-word/2), wrapping the low word; higher quotient stays stale. */
export function boostExp(state: BattleState): void {
  const value = state.readBE(D.hQuotient + 2);
  state.writeBE(D.hQuotient + 2, value + (value >>> 1));
}

/** Only PLAYER_PARTY_DATA is needed by this entry. Load all44 bytes; species comes from the list. */
export function loadExperienceMonData(state: BattleState): void {
  if (state.wMonDataLocation !== 0) throw new BattleUnsupportedState('EXP mon data location');
  state.wCurPartySpecies = state.wCurSpecies = state.mem[D.wPartySpecies + state.wWhichPokemon];
  getMonHeader(state, state.wCurSpecies);
  state.mem.set(state.mem.slice(D.wPartyMons + 44 * state.wWhichPokemon,
    D.wPartyMons + 44 * state.wWhichPokemon + 44), D.wLoadedMon);
}

/** status_screen.asm:255–300. D=0 field box; nonzero level-up box. CPU writes only. */
export function printStatsBox(state: BattleState, tiles: TileSurface, kind = 1): void {
  const levelUp = (kind & 255) !== 0, x = levelUp ? 11 : 1, y = levelUp ? 3 : 9;
  textBoxBorder(tiles, levelUp ? 9 : 0, levelUp ? 2 : 8, 8, levelUp ? 9 : 8);
  placeString(tiles, x, y, 'ATTACK<NEXT>DEFENSE<NEXT>SPEED<NEXT>SPECIAL');
  for (let i = 0; i < 4; i++) writeNumber(tiles, x + (levelUp ? 4 : 5), y + 1 + 2 * i,
    state.readBE(D.wLoadedMonAttack + 2 * i), { digits: 3, leadingZeroes: false });
}

/** home/window.asm:223–264. Preserve byte underflow and the current arrow tile. */
function blinkScrollArrow(state: BattleState, tiles: TileSurface): void {
  const a = D.hDownArrowBlinkCount1, b = D.hDownArrowBlinkCount2;
  if (tiles.at(18, 16) === '▼' || tiles.at(18, 16) === 0xee) {
    state.mem[a]--; if (state.mem[a]) return;
    state.mem[b]--; if (state.mem[b]) return;
    tiles.put(18, 16, ' '); state.mem[a] = 255; state.mem[b] = 6;
  } else {
    if (!state.mem[a]) return;
    state.mem[a]--; if (state.mem[a]) return;
    state.mem[a] = 255; state.mem[b]--; if (state.mem[b]) return;
    state.mem[b] = 6; tiles.put(18, 16, '▼');
  }
}

export function* waitForTextScrollButtonPress(state: BattleState, host: Pick<ExperienceHost,
  'tiles' | 'readScrollJoypad' | 'townMapSpriteBlinking' | 'cableClubRun'>): Program {
  const a = D.hDownArrowBlinkCount1, b = D.hDownArrowBlinkCount2;
  const oldA = state.mem[a], oldB = state.mem[b]; state.mem[a] = 0; state.mem[b] = 6;
  for (;;) {
    if (state.mem[D.wTownMapSpriteBlinkingEnabled]) {
      if (!host.townMapSpriteBlinking) throw new BattleUnsupportedState('town map sprite animation');
      host.townMapSpriteBlinking();
    }
    blinkScrollArrow(state, host.tiles);
    state.mem[D.hJoy5] = host.readScrollJoypad(); host.cableClubRun?.();
    if (state.mem[D.hJoy5] & 3) break;
    yield 'serviced';
  }
  state.mem[a] = oldA; state.mem[b] = oldB;
}

/** evos_moves.asm:325–382. Only the first exact-level entry is considered, including duplicates. */
export function* learnMoveFromLevelUp(state: BattleState, host: Pick<ExperienceHost, 'learnMove'>): Program {
  state.wCurPartySpecies = state.wPokedexNum;
  const entry = state.species(state.wCurPartySpecies).learnset.find(row => row.level === state.wCurEnemyLevel);
  if (entry) {
    if (state.wMonDataLocation !== 0) throw new BattleUnsupportedState('level-up move data location');
    const at = D.wPartyMons + 44 * state.wWhichPokemon + 8;
    if (!state.mem.subarray(at, at + 4).includes(entry.move)) {
      state.mem[D.wMoveNum] = state.wNamedObjectIndex = entry.move;
      getMoveName(state); copyMoveNameToStringBuffer(state);
      const result = yield* host.learnMove(state);
      if (result.b && isThisPartyMonStarterPikachu(state) && [85, 87].includes(state.mem[D.wMoveNum])) {
        state.mem[D.wPikachuEmotionModifier] = 5; state.mem[D.wPikachuMood] = 0x85;
      }
    }
  }
  state.wPokedexNum = state.wCurPartySpecies;
}

function mirrorStats(state: BattleState, at: number): void {
  mirrorPartyProgress(state, state.wWhichPokemon);
  const mon = state.partyMons[state.wWhichPokemon];
  if (!mon) return;
  mon.level = state.mem[at + 33]; mon.currentHp = state.readBE(at + 1); mon.maxHp = state.readBE(at + 34);
  mon.attack = state.readBE(at + 36); mon.defense = state.readBE(at + 38);
  mon.speed = state.readBE(at + 40); mon.special = state.readBE(at + 42);
}

/** experience.asm:1–297. One level-up block at the final calculated level, never intermediate levels. */
export function* gainExperience(state: BattleState, host: ExperienceHost): Program {
  if (state.wLinkState === LINK_STATE_BATTLING) return;
  divideExpDataByNumMonsGainingExp(state); state.wWhichPokemon = 0;
  const h = state.mem.subarray(D.hProduct, D.hProduct + 10);
  for (;;) {
    const slot = state.wWhichPokemon, at = D.wPartyMons + 44 * slot;
    if (state.readBE(at + 1) && flagAction(state, D.wPartyGainExpFlags, 2, slot)) {
      for (let i = 0; i < 5; i++) state.writeBE(at + 17 + 2 * i,
        Math.min(65535, state.readBE(at + 17 + 2 * i) + state.mem[D.wEnemyMonBaseStats + i]));
      h[1] = h[2] = 0; h[3] = state.wEnemyMonBaseExp; h[4] = state.wEnemyMonLevel; multiply(h);
      h[4] = 7; divide(h, 4);
      const traded = state.readBE(at + 12) !== state.readBE(D.wPlayerID);
      if (traded) boostExp(state);
      state.wGainBoostedExp = traded ? 1 : 0;
      if (state.wIsInBattle !== 1) boostExp(state);
      const gained = state.readBE(D.hQuotient + 2); state.wExpAmountGained = gained;
      let exp = (state.mem[at + 14] * 65536 + state.readBE(at + 15) + gained) & 0xffffff;
      state.wCurSpecies = state.mem[D.wPartySpecies + slot];
      const header = getMonHeader(state, state.wCurSpecies);
      if (header.growthRate === undefined) throw new BattleUnsupportedState('species header missing growth rate');
      exp = Math.min(exp, calcExperience(state, 100));
      state.mem[at + 14] = exp >>> 16; state.writeBE(at + 15, exp); mirrorPartyProgress(state, slot);
      state.mem.set(state.mem.slice(D.wPartyMonNicks + 11 * slot, D.wPartyMonNicks + 11 * slot + 11), D.wNameBuffer);
      yield* host.printText('GainedText', { nameBuffer: decodeNick(state.mem, D.wNameBuffer), expAmountGained: gained },
        { asm: { GainedText: gainedText(state.wBoostExpByExpAll, state.wGainBoostedExp), WithExpAllText: withExpAllText() } });
      state.wMonDataLocation = 0; loadExperienceMonData(state);
      const level = calcLevelFromExperience(state);
      if (state.mem[at + 33] !== level) {
        const oldLevel = state.wCurEnemyLevel; state.wCurEnemyLevel = state.mem[at + 33] = level;
        state.wCurSpecies = state.wPokedexNum = state.mem[at]; getMonHeader(state, state.wCurSpecies);
        const oldMax = state.readBE(at + 34); calcStats(state, 1, at + 16, at + 34);
        state.writeBE(at + 1, state.readBE(at + 1) + state.readBE(at + 34) - oldMax); mirrorStats(state, at);
        if (slot === state.wPlayerMonNumber) {
          state.mem.set(state.mem.slice(at + 1, at + 3), D.wBattleMonHP);
          state.mem.set(state.mem.slice(at + 33, at + 44), D.wBattleMonLevel);
          if (!(state.wPlayerBattleStatus3 & 8)) state.mem.set(state.mem.slice(at + 33, at + 44), D.wPlayerMonUnmodifiedLevel);
          state.wCalculateWhoseStats = 0; calculateModifiedStats(state);
          applyBurnAndParalysisPenaltiesToPlayer(state); applyBadgeStatBoosts(state);
          yield* drawPlayerHud(state, host.screen);
          yield* host.printText('PrintEmptyString.emptyString'); host.saveScreenTilesToBuffer1();
        }
        modifyPikachuHappiness(state, 1);
        yield* host.printText('GrewLevelText', { nameBuffer: decodeNick(state.mem, D.wNameBuffer), curEnemyLevel: state.wCurEnemyLevel });
        state.wMonDataLocation = 0; loadExperienceMonData(state);
        printStatsBox(state, host.tiles); yield* waitForTextScrollButtonPress(state, host);
        host.loadScreenTilesFromBuffer1(); state.wMonDataLocation = 0; state.wPokedexNum = state.wCurSpecies;
        yield* learnMoveFromLevelUp(state, host);
        flagAction(state, D.wCanEvolveFlags, 1, state.wWhichPokemon); state.wCurEnemyLevel = oldLevel;
      }
    }
    if (((state.wWhichPokemon + 1) & 255) === state.mem[D.wPartyCount]) break;
    state.wWhichPokemon++;
  }
  state.mem[D.wPartyGainExpFlags] = 0; flagAction(state, D.wPartyGainExpFlags, 1, state.wPlayerMonNumber);
  state.mem[D.wPartyFoughtCurrentEnemyFlags] = 0; flagAction(state, D.wPartyFoughtCurrentEnemyFlags, 1, state.wPlayerMonNumber);
}
