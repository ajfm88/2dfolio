// Unused stat effects. pret e89ead15 engine/battle/effects.asm:387-798;
// core.asm:5084-5125,5448-5500. MoveAnimation and doll presentation remain ports.
// move_effects/{haze,mist,focus_energy,reflect_light_screen}.asm, cited at each port below.
import { A, LINK_STATE_BATTLING, type BattleState } from './battle_state';
import { BattleUnsupportedState, loadBattleMoveData, moveNameBinding } from './battle_move_data';
import { STAT_MODIFIER_RATIOS } from './battle_math';
import { multiply, divide } from './battle_arithmetic';
import { moveHitTest } from './battle_hit';
import { battleRandom } from './battle_random';
import { applyBadgeStatBoosts, quarterSpeedDueToParalysis, halveAttackDueToBurn } from './battle_loaders';
import { checkTargetSubstitute, conditionalPrintButItFailed, printNothingHappenedText, printButItFailedText,
  playCurrentMoveAnimation, playCurrentMoveAnimation2, type MoveEffectRegistry } from './battle_effects';
import { monsStatsRoseText, type TextAsmHandler } from '../text/text_runner';
import type { BattleTurnTextHost } from './battle_turn_text';
import type { ExecutePresentation } from './battle_execute_helpers';
import { delayFrames, type Program } from './battle_menu_context';
import { STAT_NAME_LENGTH, type StatModTextData } from '../rom/extractors/stat_mod_text';

export interface StatEffectEnvironment extends Pick<ExecutePresentation, 'animation' | 'hideSubstitute' | 'reshowSubstitute'> {
  host: BattleTurnTextHost;
}
let statNameBytes: readonly number[] | undefined;

/** pret effects.asm:780-798: committed raw names, including EVADE's four-byte overrun. */
export async function loadStatEffectData(): Promise<void> {
  await loadBattleMoveData(); // moveNameBinding's existing glyph decoder.
  const response = await fetch('stat_mod_text.json');
  if (!response.ok) throw new Error(`stat names: HTTP ${response.status}`);
  statNameBytes = (await response.json() as StatModTextData).bytes;
}

/** pret effects.asm:396,410,594,718,758-762: always read the live acting-side effect. */
function effect(state: BattleState): number {
  return state.hWhoseTurn === 0 ? state.wPlayerMoveEffect : state.wEnemyMoveEffect;
}

/** pret effects.asm:780-794: one-based name index, terminator scan then full ten-byte CopyData. */
export function printStatText(state: BattleState, nameIndex: number): void {
  if (!statNameBytes) throw new BattleUnsupportedState('stat effect data not loaded');
  let offset = 0;
  for (let i = 1; i < nameIndex; i++) {
    while (statNameBytes[offset++] !== 0x50) {
      if (offset >= statNameBytes.length) throw new BattleUnsupportedState('stat name index outside table');
    }
  }
  state.setBytes(A.wStringBuffer, statNameBytes.slice(offset, offset + STAT_NAME_LENGTH), STAT_NAME_LENGTH);
}

/** pret effects.asm:754-770: text_asm chooses its suffix from the live effect when invoked. */
export function monsStatsFellText(state: BattleState): TextAsmHandler {
  return () => effect(state) < 0x1a || effect(state) >= 0x44 ? 'FellText' : 'GreatlyFellText';
}

/** pret effects.asm:450-491,669-709: shared Multiply/Divide, write the quotient's low word only. */
function recalculateStat(state: BattleState, stat: number, original: number, stage: number, up: boolean): void {
  const ratio = STAT_MODIFIER_RATIOS[stage - 1], h = new Uint8Array(10);
  h[1] = 0; h[2] = state.mem[original]; h[3] = state.mem[original + 1];
  h[4] = ratio[0]; multiply(h); h[4] = ratio[1]; divide(h, 4);
  let value = h[2] * 256 + h[3];
  value = up ? Math.min(999, value) : Math.max(1, value);
  state.writeBE(stat, value);
}

/** pret effects.asm:537-542,727-734: live buffer/suffix, then the non-acting side's two penalties. */
function* printChangeAndPenalize(state: BattleState, env: StatEffectEnvironment, up: boolean): Program {
  const program = up ? 'MonsStatsRoseText' : 'MonsStatsFellText';
  yield* env.host.printText(program, { get stringBuffer() { return moveNameBinding(state); } }, { asm: {
    [program]: up ? context => monsStatsRoseText(effect(state))(context) : monsStatsFellText(state),
  } });
  quarterSpeedDueToParalysis(state);
  halveAttackDueToBurn(state);
}

/** pret effects.asm:387-550: stage-before-stat, one-stage rollback, Minimize and badge asymmetry. */
export function* statModifierUpEffect(state: BattleState, env: StatEffectEnvironment): Program {
  const player = state.hWhoseTurn === 0, id = effect(state), m = state.mem;
  let index = id - 0x0a;
  if (index >= 8) index -= 0x28;
  const mod = (player ? A.wPlayerMonStatMods : A.wEnemyMonStatMods) + index;
  let stage = m[mod] + 1;
  if (stage > 13) { yield* printNothingHappenedText(env.host); return; }
  if (id >= 0x12) stage = Math.min(13, stage + 1);
  m[mod] = stage;
  if (index < 4) {
    const stat = (player ? A.wBattleMonAttack : A.wEnemyMonAttack) + index * 2;
    if (m[stat + 1] === 0xe7 && m[stat] === 3) {
      m[mod]--; yield* printNothingHappenedText(env.host); return;
    }
    recalculateStat(state, stat, (player ? A.wPlayerMonUnmodifiedLevel : A.wEnemyMonUnmodifiedLevel) + 3 + index * 2, stage, true);
  }
  printStatText(state, index + 1);
  const move = player ? state.wPlayerMoveNum : state.wEnemyMoveNum;
  const minimize = move === 0x6b;
  const doll = ((player ? state.wPlayerBattleStatus2 : state.wEnemyBattleStatus2) & 0x10) !== 0;
  if (minimize && doll) yield* env.hideSubstitute(state);
  yield* playCurrentMoveAnimation(state, env);
  if (minimize) {
    if (player) state.wPlayerMonMinimized = 1; else state.wEnemyMonMinimized = 1;
    if (doll) yield* env.reshowSubstitute(state);
  }
  if (state.hWhoseTurn === 0) applyBadgeStatBoosts(state);
  yield* printChangeAndPenalize(state, env, true);
}

/** pret effects.asm:741-752: side failures silent; primary limit and miss have distinct printers, no wait. */
function* downFailed(state: BattleState, env: StatEffectEnvironment, missed: boolean): Program {
  if (effect(state) >= 0x44) return;
  if (missed) yield* conditionalPrintButItFailed(state, env.host);
  else yield* printNothingHappenedText(env.host);
}

/** pret effects.asm:575-752; core.asm:5448-5500: off-link draw before doll, secondary bypasses HIT/Mist. */
export function* statModifierDownEffect(state: BattleState, env: StatEffectEnvironment): Program {
  const player = state.hWhoseTurn === 0, m = state.mem;
  if (!player && state.wLinkState !== LINK_STATE_BATTLING && battleRandom(state) < 64) {
    yield* downFailed(state, env, true); return;
  }
  if (!checkTargetSubstitute(state).zero) { yield* downFailed(state, env, true); return; }
  const id = effect(state), secondary = id >= 0x44;
  let index: number;
  if (secondary) {
    if (battleRandom(state) >= 85) { yield* downFailed(state, env, false); return; }
    index = id - 0x44;
  } else {
    moveHitTest(state);
    const flags = player ? state.wEnemyBattleStatus1 : state.wPlayerBattleStatus1;
    if (state.wMoveMissed !== 0 || (flags & 0x40) !== 0) { yield* downFailed(state, env, true); return; }
    index = id - 0x12;
    if (index >= 8) index -= 0x28;
  }
  const mod = (player ? A.wEnemyMonStatMods : A.wPlayerMonStatMods) + index;
  let stage = m[mod] - 1;
  if (stage === 0) { yield* downFailed(state, env, false); return; }
  if (id >= 0x24 && id < 0x44) stage = Math.max(1, stage - 1);
  m[mod] = stage;
  if (index < 4) {
    const stat = (player ? A.wEnemyMonAttack : A.wBattleMonAttack) + index * 2;
    if (m[stat + 1] === 1 && m[stat] === 0) {
      m[mod]++; yield* downFailed(state, env, false); return;
    }
    recalculateStat(state, stat, (player ? A.wEnemyMonUnmodifiedLevel : A.wPlayerMonUnmodifiedLevel) + 3 + index * 2, stage, false);
  }
  printStatText(state, index + 1);
  if (effect(state) < 0x44) yield* playCurrentMoveAnimation2(state, env);
  if (state.hWhoseTurn !== 0) applyBadgeStatBoosts(state);
  yield* printChangeAndPenalize(state, env, false);
}

/** pret move_effects/haze.asm:49-59: preserve every volatile bit except the listed cures. */
function cureVolatileStatuses(state: BattleState, status1: number): void {
  state.mem[status1] &= 0x7f;
  state.mem[status1 + 1] &= 0x78;
  state.mem[status1 + 2] &= 0xf8;
}

/** pret move_effects/haze.asm:1-47,61-76: both eight-byte resets, target-only cure, no roster write. */
export function* hazeEffect(state: BattleState, env: StatEffectEnvironment): Program {
  const m = state.mem;
  for (const mods of [A.wPlayerMonStatMods, A.wEnemyMonStatMods]) m.fill(7, mods, mods + 8);
  for (const [original, live] of [
    [A.wPlayerMonUnmodifiedLevel + 3, A.wBattleMonAttack],
    [A.wEnemyMonUnmodifiedLevel + 3, A.wEnemyMonAttack],
  ]) {
    for (let i = 0; i < 8; i++) m[live + i] = m[original + i];
  }
  const status = state.hWhoseTurn === 0 ? A.wEnemyMonStatus : A.wBattleMonStatus;
  const previous = m[status];
  m[status] = 0;
  if ((previous & 0x27) !== 0) {
    if (state.hWhoseTurn === 0) state.wEnemySelectedMove = 0xff;
    else state.wPlayerSelectedMove = 0xff;
  }
  state.wPlayerDisabledMove = 0;
  state.wEnemyDisabledMove = 0;
  state.wPlayerDisabledMoveNumber = 0;
  state.wEnemyDisabledMoveNumber = 0;
  cureVolatileStatuses(state, A.wPlayerBattleStatus1);
  cureVolatileStatuses(state, A.wEnemyBattleStatus1);
  yield* playCurrentMoveAnimation(state, env);
  yield* env.host.printText('StatusChangesEliminatedText');
}

/** pret move_effects/mist.asm:1-15: the user's Mist bit, immediate unconditional failure printer. */
export function* mistEffect(state: BattleState, env: StatEffectEnvironment): Program {
  const status = state.hWhoseTurn === 0 ? A.wPlayerBattleStatus2 : A.wEnemyBattleStatus2;
  if ((state.mem[status] & 2) !== 0) { yield* printButItFailedText(env.host); return; }
  state.mem[status] |= 2;
  yield* playCurrentMoveAnimation(state, env);
  yield* env.host.printText('ShroudedInMistText');
}

/** pret move_effects/focus_energy.asm:1-22: user Focus Energy, fifty-frame failure; text owns PAUSE. */
export function* focusEnergyEffect(state: BattleState, env: StatEffectEnvironment): Program {
  const status = state.hWhoseTurn === 0 ? A.wPlayerBattleStatus2 : A.wEnemyBattleStatus2;
  if ((state.mem[status] & 4) !== 0) {
    yield* delayFrames(50); yield* printButItFailedText(env.host); return;
  }
  state.mem[status] |= 4;
  yield* playCurrentMoveAnimation(state, env);
  yield* env.host.printText('GettingPumpedText');
}

/** pret move_effects/reflect_light_screen.asm:1-45: $40 sets Light Screen, otherwise Reflect. */
export function* reflectLightScreenEffect(state: BattleState, env: StatEffectEnvironment): Program {
  const status = state.hWhoseTurn === 0 ? A.wPlayerBattleStatus3 : A.wEnemyBattleStatus3;
  const lightScreen = effect(state) === 0x40, bit = lightScreen ? 2 : 4;
  if ((state.mem[status] & bit) !== 0) {
    yield* delayFrames(50); yield* printButItFailedText(env.host); return;
  }
  state.mem[status] |= bit;
  yield* playCurrentMoveAnimation(state, env);
  yield* env.host.printText(lightScreen ? 'LightScreenProtectedText' : 'ReflectGainedArmorText');
}

/** pret data/moves/effects_pointers.asm:13-18,21-26,28,49-50,53-58,61-68,71-74. */
export function statEffectHandlers(env: StatEffectEnvironment): MoveEffectRegistry {
  return {
    StatModifierUpEffect: state => statModifierUpEffect(state, env),
    StatModifierDownEffect: state => statModifierDownEffect(state, env),
    HazeEffect: state => hazeEffect(state, env),
    MistEffect: state => mistEffect(state, env),
    FocusEnergyEffect: state => focusEnergyEffect(state, env),
    ReflectLightScreenEffect: state => reflectLightScreenEffect(state, env),
  };
}
