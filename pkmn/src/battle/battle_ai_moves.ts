// Unused move-choice modifications. pret e89ead15 engine/battle/trainer_ai.asm:1–272,
// data/trainers/move_choices.asm, core.asm:5363–5406 (AIGetTypeEffectiveness) and
// core.asm:3086–3176 (SelectEnemyMove, the caller in battle_math.ts).
// wAILayer2Encouragement is zeroed at core.asm:925 and incremented at core.asm:5656.
// This module only reads it. No live caller.
import { A, NUM_MOVES, type BattleState } from './battle_state';
import { D } from './battle_end_state';
import { BattleUnsupportedState, getMoveRecord } from './battle_move_data';
import { TYPE_CHART } from './battle_damage_asm';

const NUM_TRAINERS = 47;
const LORELEI = 0x2c;
const DEWGONG = 0x78;
const EFFECT_01 = 0x01;
const ATTACK_UP1_EFFECT = 0x0a;
const BIDE_EFFECT = 0x1a;
const SLEEP_EFFECT = 0x20;
const SUPER_FANG_EFFECT = 0x28;
const SPECIAL_DAMAGE_EFFECT = 0x29;
const FLY_EFFECT = 0x2b;
const ATTACK_UP2_EFFECT = 0x32;
const POISON_EFFECT = 0x42;
const PARALYZE_EFFECT = 0x43;
const STATUS_EFFECTS = [EFFECT_01, SLEEP_EFFECT, POISON_EFFECT, PARALYZE_EFFECT];

/**
 * data/trainers/move_choices.asm. One zero-terminated list per class, class 1 first.
 * No list contains modification 4.
 */
export const TRAINER_CLASS_MOVE_CHOICE_MODIFICATIONS: readonly (readonly number[])[] = [
  [], [1], [1], [1, 3], [1], [1], [1, 2, 3], [1, 2], [1], [1], [1, 3], [1], [1, 2],
  [1, 3], [1, 3], [], [1], [1, 3], [1, 2], [1], [1], [1], [1], [1], [1], [1, 3],
  [1, 2], [1, 2], [1, 3], [1], [1, 3], [1, 3], [1], [1], [1, 3], [1], [1, 3], [1, 3],
  [1], [1], [1, 2], [1, 3], [1, 3], [1, 2, 3], [1], [1], [1, 3],
];

const FLAT_MODIFICATIONS: readonly number[] = TRAINER_CLASS_MOVE_CHOICE_MODIFICATIONS.flatMap(
  list => [...list, 0],
);

if (TRAINER_CLASS_MOVE_CHOICE_MODIFICATIONS.length !== NUM_TRAINERS) {
  throw new Error(`move choice table ${TRAINER_CLASS_MOVE_CHOICE_MODIFICATIONS.length}`);
}

/** trainer_ai.asm:261–272. Six-byte Moves record into wEnemyMoveNum … wEnemyMoveMaxPP. */
export function ReadMove(state: BattleState, moveId: number): void {
  const record = getMoveRecord(moveId);
  for (let i = 0; i < 6; i++) state.mem[A.wEnemyMoveNum + i] = record[i];
}

/**
 * core.asm:5363–5406. First matching TypeEffects row. The $10 default is the
 * cartridge's bug (pret: "should be EFFECTIVE (10)"). No matching row draws nothing.
 * Lorelei's Dewgong draws once per matching row: below $66 the $10 stays.
 */
export function AIGetTypeEffectiveness(state: BattleState): void {
  const moveType = state.mem[A.wEnemyMoveType];
  const type1 = state.mem[A.wBattleMonType1];
  const type2 = state.mem[A.wBattleMonType2];
  state.mem[A.wTypeEffectiveness] = 0x10;
  let matched = false;
  let multiplier = 0;
  for (const row of TYPE_CHART) {
    if (row.attack !== moveType) continue;
    if (row.defend !== type1 && row.defend !== type2) continue;
    matched = true;
    multiplier = row.multiplier;
    break;
  }
  if (!matched) return;
  if (state.mem[D.wTrainerClass] === LORELEI && state.mem[A.wEnemyMonSpecies] === DEWGONG) {
    const roll = state.random();
    if (roll < 0x66) return;
  }
  state.mem[A.wTypeEffectiveness] = multiplier;
}

/** trainer_ai.asm:115–146. Status byte 0 returns before any ReadMove. */
export function AIMoveChoiceModification1(state: BattleState): void {
  if (state.mem[A.wBattleMonStatus] === 0) return;
  eachMove(state, score => {
    if (state.mem[A.wEnemyMovePower] !== 0) return;
    const effect = state.mem[A.wEnemyMoveEffect];
    if (!STATUS_EFFECTS.includes(effect)) return;
    state.mem[score] = (state.mem[score] + 5) & 0xff;
  });
}

/** trainer_ai.asm:158–186. Runs only when wAILayer2Encouragement is exactly 1. */
export function AIMoveChoiceModification2(state: BattleState): void {
  if (state.mem[A.wAILayer2Encouragement] !== 1) return;
  eachMove(state, score => {
    const effect = state.mem[A.wEnemyMoveEffect];
    const lower = effect >= ATTACK_UP1_EFFECT && effect < BIDE_EFFECT;
    const upper = effect >= ATTACK_UP2_EFFECT && effect < POISON_EFFECT;
    if (lower || upper) state.mem[score] = (state.mem[score] - 1) & 0xff;
  });
}

/** trainer_ai.asm:191–257. The scan's last ReadMove is left in wEnemyMove*. */
export function AIMoveChoiceModification3(state: BattleState): void {
  let score = A.wBuffer - 1;
  let movePtr = A.wEnemyMonMoves;
  let remaining = NUM_MOVES + 1;
  for (;;) {
    remaining--;
    if (remaining === 0) return;
    score++;
    const move = state.mem[movePtr];
    if (move === 0) return;
    movePtr++;
    ReadMove(state, move);
    AIGetTypeEffectiveness(state);
    const effectiveness = state.mem[A.wTypeEffectiveness];
    if (effectiveness === 0x10) continue;
    if (effectiveness > 0x10) {
      state.mem[score] = (state.mem[score] - 1) & 0xff;
      continue;
    }
    const outerType = state.mem[A.wEnemyMoveType];
    let candidate = A.wEnemyMonMoves;
    let left = NUM_MOVES + 1;
    let found = 0;
    for (;;) {
      left--;
      if (left === 0) break;
      const id = state.mem[candidate];
      candidate++;
      if (id === 0) break;
      ReadMove(state, id);
      const effect = state.mem[A.wEnemyMoveEffect];
      if (effect === SUPER_FANG_EFFECT || effect === SPECIAL_DAMAGE_EFFECT || effect === FLY_EFFECT) {
        found = effect;
        break;
      }
      if (state.mem[A.wEnemyMoveType] === outerType) continue;
      if (state.mem[A.wEnemyMovePower] !== 0) {
        found = state.mem[A.wEnemyMovePower];
        break;
      }
    }
    if (found !== 0) state.mem[score] = (state.mem[score] + 1) & 0xff;
  }
}

/** trainer_ai.asm:258–259. ret. No class list calls it. */
export function AIMoveChoiceModification4(): void {}

const MODIFICATIONS: readonly ((state: BattleState) => void)[] = [
  AIMoveChoiceModification1,
  AIMoveChoiceModification2,
  AIMoveChoiceModification3,
  AIMoveChoiceModification4,
];

/**
 * trainer_ai.asm:3–105. Returns wEnemyMonMoves for an empty class list, otherwise wBuffer.
 * wTrainerClass 0 would walk 255 lists on the cartridge. A move list whose first byte is 0
 * restarts .loopFindMinimumEntries with no progress (trainer_ai.asm:59–63); that hang is
 * reported instead.
 */
export function AIEnemyTrainerChooseMoves(state: BattleState): number {
  state.mem[A.wBuffer] = 0x0a;
  state.mem[A.wBuffer + 1] = 0x0a;
  state.mem[A.wBuffer + 2] = 0x0a;
  state.mem[A.wBuffer + 3] = 0x0a;
  // swap a; and $f. The high nybble, 1-based. A nybble past 4 writes past the four scores.
  const disabled = (state.mem[A.wEnemyDisabledMove] >> 4) & 0x0f;
  if (disabled !== 0) state.mem[A.wBuffer + disabled - 1] = 0x50;
  if (classListIsEmpty(state)) return A.wEnemyMonMoves;
  filterMinimumEntries(state);
  return A.wBuffer;
}

function eachMove(state: BattleState, body: (score: number) => void): void {
  let score = A.wBuffer - 1;
  let movePtr = A.wEnemyMonMoves;
  let remaining = NUM_MOVES + 1;
  for (;;) {
    remaining--;
    if (remaining === 0) return;
    score++;
    const move = state.mem[movePtr];
    if (move === 0) return;
    movePtr++;
    ReadMove(state, move);
    body(score);
  }
}

function classListIsEmpty(state: BattleState): boolean {
  const trainerClass = state.mem[D.wTrainerClass];
  if (trainerClass === 0) throw new BattleUnsupportedState('wTrainerClass 0');
  let index = 0;
  let b = trainerClass;
  for (;;) {
    b = (b - 1) & 0xff;
    if (b === 0) break;
    if (index >= FLAT_MODIFICATIONS.length) throw new BattleUnsupportedState('wTrainerClass');
    while (FLAT_MODIFICATIONS[index] !== 0) {
      index++;
      if (index >= FLAT_MODIFICATIONS.length) throw new BattleUnsupportedState('wTrainerClass');
    }
    index++;
  }
  if (index >= FLAT_MODIFICATIONS.length) throw new BattleUnsupportedState('wTrainerClass');
  if (FLAT_MODIFICATIONS[index] === 0) return true;
  while (FLAT_MODIFICATIONS[index] !== 0) {
    const id = FLAT_MODIFICATIONS[index];
    index++;
    const modification = MODIFICATIONS[id - 1];
    if (!modification) throw new BattleUnsupportedState(`move choice modification ${id}`);
    modification(state);
  }
  return false;
}

function filterMinimumEntries(state: BattleState): void {
  const buffer = A.wBuffer;
  const moves = A.wEnemyMonMoves;
  let hl: number = buffer;
  let de = moves;
  let c = NUM_MOVES;
  for (;;) {
    const move = state.mem[de];
    de++;
    if (move === 0) {
      if (de === moves + 1) throw new BattleUnsupportedState('empty enemy move set');
      hl = buffer;
      de = moves;
      c = NUM_MOVES;
      continue;
    }
    state.mem[hl] = (state.mem[hl] - 1) & 0xff;
    if (state.mem[hl] === 0) {
      // Undo the partial pass (trainer_ai.asm:70–77). a starts at c and stops at NUM_MOVES + 1.
      let a = c;
      while (a !== NUM_MOVES + 1) {
        state.mem[hl] = (state.mem[hl] + 1) & 0xff;
        hl--;
        a++;
      }
      break;
    }
    hl++;
    c--;
    if (c === 0) {
      hl = buffer;
      de = moves;
      c = NUM_MOVES;
    }
  }
  hl = buffer;
  de = moves;
  c = NUM_MOVES;
  while (c !== 0) {
    const move = state.mem[de];
    if (move === 0) state.mem[hl] = 0;
    if (((state.mem[hl] - 1) & 0xff) === 0) state.mem[hl] = state.mem[de];
    else state.mem[hl] = 0;
    hl++;
    de++;
    c--;
  }
}
