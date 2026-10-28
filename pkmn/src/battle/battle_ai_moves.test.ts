// Checkpoint-09. pret e89ead15 trainer_ai.asm:1–272, move_choices.asm, core.asm:5363–5406.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { createPokemon, getAllLoadedMoveIds, getMove } from './data';
import { A, BattleState, type BattleState as State } from './battle_state';
import { D } from './battle_end_state';
import { getMoveRecord, loadBattleMoveData } from './battle_move_data';
import { TYPE_CHART } from './battle_damage_asm';
import { selectEnemyMove, type TrainerMoveSelection } from './battle_math';
import {
  AIEnemyTrainerChooseMoves, AIGetTypeEffectiveness, AIMoveChoiceModification1,
  AIMoveChoiceModification2, AIMoveChoiceModification3, AIMoveChoiceModification4,
  TRAINER_CLASS_MOVE_CHOICE_MODIFICATIONS,
} from './battle_ai_moves';

beforeAll(loadBattleMoveData);

const LORELEI = 0x2c;
const DEWGONG = 0x78;
const WATER = 21;
const GRASS = 22;
const GROUND = 4;
const FIRE = 20;
const ELECTRIC = 23;
const NORMAL = 0;
const ROCK = 5;

/** §10.1.17's modification column, written out. Class 1 is index 0. */
const EXPECTED: readonly (readonly number[])[] = [
  [], [1], [1], [1, 3], [1], [1], [1, 2, 3], [1, 2], [1], [1], [1, 3], [1], [1, 2],
  [1, 3], [1, 3], [], [1], [1, 3], [1, 2], [1], [1], [1], [1], [1], [1], [1, 3],
  [1, 2], [1, 2], [1, 3], [1], [1, 3], [1, 3], [1], [1], [1, 3], [1], [1, 3], [1, 3],
  [1], [1], [1, 2], [1, 3], [1, 3], [1, 2, 3], [1], [1], [1, 3],
];

function fresh(): State {
  const state = new BattleState();
  state.wIsInBattle = 2;
  state.random = () => { throw new Error('unexpected BattleRandom'); };
  return state;
}

function scores(state: State): number[] {
  return state.bytes(A.wBuffer, 4).slice();
}

function recordBytes(state: State): number[] {
  return state.bytes(A.wEnemyMoveNum, 6).slice();
}

function place(state: State, ids: readonly number[], classId: number): void {
  const padded = [0, 0, 0, 0];
  for (let i = 0; i < ids.length; i++) padded[i] = ids[i];
  state.setBytes(A.wEnemyMonMoves, padded, 4);
  state.mem[D.wTrainerClass] = classId;
  state.setBytes(A.wBuffer, [10, 10, 10, 10], 4);
}

function trainer(ids: readonly number[]): TrainerMoveSelection {
  const enemy = createPokemon('Pidgey', 20)!;
  const player = createPokemon('Pikachu', 20)!;
  enemy.moves = ids.filter(id => id !== 0).map(id => {
    const key = getAllLoadedMoveIds().find(name => getMove(name)!.id === id);
    if (!key) throw new Error(`move ${id}`);
    return { id: key, pp: 0, maxPp: 35 };
  });
  return { enemy, player, aiModifiers: [] };
}

function script(state: State, rolls: readonly number[]): number[] {
  const seen: number[] = [];
  state.random = () => {
    const value = rolls[seen.length];
    if (value === undefined) throw new Error(`unexpected BattleRandom after ${seen.join(',')}`);
    seen.push(value);
    return value;
  };
  return seen;
}

describe('TrainerClassMoveChoiceModifications', () => {
  // core.asm:5363–5406 compares both defender types; trainer_ai.asm:198–216 encourages >$10.
  it('encourages an Electric move matching only the player second type', () => {
    const s = fresh(); place(s, [85], 4);
    s.wBattleMonType1 = NORMAL; s.wBattleMonType2 = WATER;
    s.mem[A.wEnemyMoveType] = ELECTRIC;
    AIGetTypeEffectiveness(s);
    expect(s.mem[A.wTypeEffectiveness]).toBe(0x14);
    AIMoveChoiceModification3(s);
    expect(scores(s)).toEqual([9, 10, 10, 10]);
    expect(s.mem[0xd11d]).toBe(0x14);
  });
  it('matches §10.1.17 and trainers.json, and never lists modification 4', () => {
    expect(TRAINER_CLASS_MOVE_CHOICE_MODIFICATIONS).toEqual(EXPECTED);
    expect(EXPECTED.every(list => !list.includes(4))).toBe(true);
    const path = fileURLToPath(new URL('../../data/trainers.json', import.meta.url));
    const json = JSON.parse(readFileSync(path, 'utf8')) as Record<string, { id: number; aiModifiers: number[] }>;
    const rows = Object.values(json).sort((a, b) => a.id - b.id);
    expect(rows.map(row => row.id)).toEqual(EXPECTED.map((_, index) => index + 1));
    expect(rows.map(row => row.aiModifiers)).toEqual(EXPECTED);
  });

  it.skipIf(!process.env.ROM_PATH)('the ROM lists behind AIEnemyTrainerChooseMoves match the table', () => {
    const rom = readFileSync(process.env.ROM_PATH!);
    const prologue = [0x3e, 0x0a, 0x21, 0xe9, 0xce, 0x22, 0x22, 0x22, 0x77];
    const hits: number[] = [];
    for (let i = 0; i + prologue.length < rom.length; i++) {
      if (prologue.every((byte, n) => rom[i + n] === byte)) hits.push(i);
    }
    expect(hits).toHaveLength(1);
    let pointerAt = -1;
    for (let i = hits[0]; i < hits[0] + 48; i++) {
      if (rom[i] === 0x21 && rom[i + 3] === 0xfa && rom[i + 4] === 0x30 && rom[i + 5] === 0xd0) {
        pointerAt = i;
        break;
      }
    }
    expect(pointerAt).toBeGreaterThan(hits[0]);
    const pointer = rom[pointerAt + 1] | (rom[pointerAt + 2] << 8);
    expect(pointer).toBeGreaterThanOrEqual(0x4000);
    expect(pointer).toBeLessThan(0x8000);
    const bank = Math.floor(pointerAt / 0x4000);
    let cursor = bank * 0x4000 + (pointer - 0x4000);
    const lists: number[][] = [];
    for (let list = 0; list < 47; list++) {
      const mods: number[] = [];
      while (rom[cursor] !== 0) mods.push(rom[cursor++]);
      cursor++;
      lists.push(mods);
    }
    expect(lists).toEqual(EXPECTED);
  });
});

describe('modification 1', () => {
  it('returns before ReadMove when the player status byte is 0', () => {
    const state = fresh();
    place(state, [86, 33], 2);
    state.setBytes(A.wEnemyMoveNum, [0xee, 0xee, 0xee, 0xee, 0xee, 0xee], 6);
    AIMoveChoiceModification1(state);
    expect(scores(state)).toEqual([10, 10, 10, 10]);
    expect(recordBytes(state)).toEqual([0xee, 0xee, 0xee, 0xee, 0xee, 0xee]);
  });

  it('adds 5 to Thunder Wave and Toxic, and not to a damaging or confusion move', () => {
    const penalised = (ids: number[]) => {
      const state = fresh();
      place(state, ids, 2);
      state.wBattleMonStatus = 0x40;
      AIMoveChoiceModification1(state);
      return scores(state);
    };
    expect(penalised([86, 33])).toEqual([15, 10, 10, 10]); // Thunder Wave, Tackle
    expect(penalised([92, 33])).toEqual([15, 10, 10, 10]); // Toxic
    expect(penalised([84, 33])).toEqual([10, 10, 10, 10]); // Thunder Shock, power > 0
    expect(penalised([34, 33])).toEqual([10, 10, 10, 10]); // Body Slam, side effect
    expect(penalised([48, 33])).toEqual([10, 10, 10, 10]); // Supersonic
    expect(penalised([86, 79])).toEqual([15, 15, 10, 10]); // both status moves
  });
});

describe('modification 2', () => {
  const edge = (id: number, encouragement: number) => {
    const state = fresh();
    place(state, [id, 33], 8);
    state.wAILayer2Encouragement = encouragement;
    state.setBytes(A.wEnemyMoveNum, [0xee, 0xee, 0xee, 0xee, 0xee, 0xee], 6);
    AIMoveChoiceModification2(state);
    return { scores: scores(state), record: recordBytes(state) };
  };

  it('does nothing at encouragement 0 or 2, and does not ReadMove', () => {
    for (const encouragement of [0, 2]) {
      const result = edge(114, encouragement); // Haze would be encouraged at 1
      expect(result.scores, `encouragement ${encouragement}`).toEqual([10, 10, 10, 10]);
      expect(result.record).toEqual([0xee, 0xee, 0xee, 0xee, 0xee, 0xee]);
    }
  });

  it('encourages the open ranges and rejects both upper bounds', () => {
    const encouraged = (id: number) => edge(id, 1).scores;
    expect(encouraged(119)).toEqual([10, 10, 10, 10]); // Mirror Move $09
    expect(encouraged(159)).toEqual([9, 10, 10, 10]); // Sharpen $0A
    expect(encouraged(160)).toEqual([9, 10, 10, 10]); // Conversion $18
    expect(encouraged(114)).toEqual([9, 10, 10, 10]); // Haze $19
    expect(encouraged(117)).toEqual([10, 10, 10, 10]); // Bide $1A
    expect(encouraged(48)).toEqual([10, 10, 10, 10]); // Supersonic $31
    expect(encouraged(14)).toEqual([9, 10, 10, 10]); // Swords Dance $32
    expect(encouraged(115)).toEqual([9, 10, 10, 10]); // Reflect $41
    expect(encouraged(92)).toEqual([10, 10, 10, 10]); // Toxic $42
  });
});

describe('AIGetTypeEffectiveness', () => {
  function lookup(moveType: number, type1: number, type2: number, roll?: number): { value: number; calls: number } {
    const state = fresh();
    state.wEnemyMoveType = moveType;
    state.wBattleMonType1 = type1;
    state.wBattleMonType2 = type2;
    let calls = 0;
    if (roll !== undefined) state.random = () => { calls++; return roll; };
    AIGetTypeEffectiveness(state);
    expect(state.mem[0xd11d]).toBe(state.wTypeEffectiveness);
    expect(state.wPokedexNum).toBe(state.wTypeEffectiveness);
    expect(state.wNamedObjectIndex).toBe(state.wTypeEffectiveness);
    return { value: state.wTypeEffectiveness, calls };
  }

  it('keeps the $10 default when nothing matches, and does not draw', () => {
    expect(lookup(NORMAL, WATER, WATER)).toEqual({ value: 0x10, calls: 0 });
  });

  it('keeps the first matching row of a dual type', () => {
    // Fire vs Grass is $14 and comes before Fire vs Water $05. The product would be neutral.
    expect(lookup(FIRE, GRASS, WATER)).toEqual({ value: 0x14, calls: 0 });
    // Electric vs Water is $14 and comes before Electric vs Ground $00.
    expect(lookup(ELECTRIC, WATER, GROUND)).toEqual({ value: 0x14, calls: 0 });
  });

  it('draws once per matching Lorelei Dewgong lookup', () => {
    const state = fresh();
    state.mem[D.wTrainerClass] = LORELEI;
    state.wEnemyMonSpecies = DEWGONG;
    state.wBattleMonType1 = WATER;
    state.wBattleMonType2 = WATER;
    state.wEnemyMoveType = NORMAL;
    let calls = 0;
    state.random = () => { calls++; return 0; };
    AIGetTypeEffectiveness(state);
    expect(calls).toBe(0);
    expect(state.wTypeEffectiveness).toBe(0x10);

    const low = fresh();
    low.mem[D.wTrainerClass] = LORELEI;
    low.wEnemyMonSpecies = DEWGONG;
    low.wBattleMonType1 = WATER;
    low.wBattleMonType2 = WATER;
    low.wEnemyMoveType = ELECTRIC;
    const lowRolls = script(low, [0x65]);
    AIGetTypeEffectiveness(low);
    expect(lowRolls).toEqual([0x65]);
    expect(low.wTypeEffectiveness).toBe(0x10);

    const high = fresh();
    high.mem[D.wTrainerClass] = LORELEI;
    high.wEnemyMonSpecies = DEWGONG;
    high.wBattleMonType1 = WATER;
    high.wBattleMonType2 = WATER;
    high.wEnemyMoveType = ELECTRIC;
    const highRolls = script(high, [0x66]);
    AIGetTypeEffectiveness(high);
    expect(highRolls).toEqual([0x66]);
    expect(high.mem[0xd11d]).toBe(0x14);

    const other = fresh();
    other.mem[D.wTrainerClass] = 1;
    other.wEnemyMonSpecies = DEWGONG;
    other.wEnemyMoveType = ELECTRIC;
    other.wBattleMonType1 = WATER;
    other.wBattleMonType2 = WATER;
    AIGetTypeEffectiveness(other);
    expect(other.wTypeEffectiveness).toBe(0x14);
  });
});

describe('modification 3', () => {
  it('encourages a power-0 super-effective move', () => {
    const state = fresh();
    place(state, [86, 33], 4);
    state.wBattleMonType1 = WATER;
    state.wBattleMonType2 = WATER;
    AIMoveChoiceModification3(state);
    expect(scores(state)).toEqual([9, 10, 10, 10]);
  });

  it('counts a disabled 0-PP candidate and ignores a same-type damaging move', () => {
    const disabled = fresh();
    place(disabled, [84, 86, 33], 4);
    disabled.wBattleMonType1 = GROUND;
    disabled.wBattleMonType2 = GROUND;
    disabled.wEnemyDisabledMove = 0x30;
    disabled.mem[A.wEnemyMonPP + 2] = 0;
    AIMoveChoiceModification3(disabled);
    expect(scores(disabled)).toEqual([11, 11, 10, 10]);

    const same = fresh();
    place(same, [84, 85], 4);
    same.wBattleMonType1 = GROUND;
    same.wBattleMonType2 = GROUND;
    AIMoveChoiceModification3(same);
    expect(scores(same)).toEqual([10, 10, 10, 10]);
  });

  it('counts Super Fang of the same type, and two Dewgong matches draw twice', () => {
    const fang = fresh();
    place(fang, [33, 162], 4);
    fang.wBattleMonType1 = ROCK;
    fang.wBattleMonType2 = ROCK;
    AIMoveChoiceModification3(fang);
    // The scan does not skip the move being scored, so Super Fang counts itself.
    expect(scores(fang)).toEqual([11, 11, 10, 10]);

    const state = fresh();
    place(state, [84, 85], LORELEI);
    state.wEnemyMonSpecies = DEWGONG;
    state.wBattleMonType1 = WATER;
    state.wBattleMonType2 = WATER;
    const rolls = script(state, [0x65, 0x66]);
    AIMoveChoiceModification3(state);
    expect(rolls).toEqual([0x65, 0x66]);
    expect(scores(state)).toEqual([10, 9, 10, 10]);
    expect(state.mem[0xd11d]).toBe(0x14);
  });

  it('leaves the inner scan candidate in the six-byte record', () => {
    const state = fresh();
    place(state, [33, 84], 4);
    state.wBattleMonStatus = 0;
    state.wBattleMonType1 = GROUND;
    state.wBattleMonType2 = GROUND;
    expect(AIEnemyTrainerChooseMoves(state)).toBe(A.wBuffer);
    expect(recordBytes(state)).toEqual(getMoveRecord(33).slice());
    expect(state.wTypeEffectiveness).toBe(0x00);
    expect(scores(state)).toEqual([33, 0, 0, 0]);
  });
});

describe('the minimum loop', () => {
  it('modification 4 changes nothing', () => {
    const state = fresh();
    place(state, [16, 28], 1);
    state.setBytes(A.wEnemyMoveNum, [0xee, 0xee, 0xee, 0xee, 0xee, 0xee], 6);
    AIMoveChoiceModification4();
    expect(scores(state)).toEqual([10, 10, 10, 10]);
    expect(recordBytes(state)).toEqual([0xee, 0xee, 0xee, 0xee, 0xee, 0xee]);
  });

  it('an empty list returns the original moves, disabled score included', () => {
    const state = fresh();
    place(state, [16, 28], 1);
    state.wEnemyDisabledMove = 0x17;
    state.setBytes(A.wEnemyMoveNum, [0xee, 0xee, 0xee, 0xee, 0xee, 0xee], 6);
    state.wTypeEffectiveness = 0xab;
    expect(AIEnemyTrainerChooseMoves(state)).toBe(A.wEnemyMonMoves);
    expect(scores(state)).toEqual([0x50, 10, 10, 10]);
    expect(recordBytes(state)).toEqual([0xee, 0xee, 0xee, 0xee, 0xee, 0xee]);
    expect(state.mem[0xd11d]).toBe(0xab);
    const cue = fresh();
    place(cue, [16], 16);
    expect(AIEnemyTrainerChooseMoves(cue)).toBe(A.wEnemyMonMoves);
  });

  it('keeps every tied minimum and only the later lower score', () => {
    const tied = fresh();
    place(tied, [16, 98], 2);
    expect(AIEnemyTrainerChooseMoves(tied)).toBe(A.wBuffer);
    expect(scores(tied)).toEqual([16, 98, 0, 0]);

    const later = fresh();
    place(later, [16, 28], 8);
    later.wAILayer2Encouragement = 1;
    expect(scores(later)).toEqual([10, 10, 10, 10]);
    expect(AIEnemyTrainerChooseMoves(later)).toBe(A.wBuffer);
    expect(scores(later)).toEqual([0, 28, 0, 0]);
  });

  it('class 0 and a non-empty class with no moves do not walk forever', () => {
    const zero = fresh();
    place(zero, [33], 0);
    expect(() => AIEnemyTrainerChooseMoves(zero)).toThrow('wTrainerClass 0');
    const past = fresh();
    place(past, [33], 48);
    expect(() => AIEnemyTrainerChooseMoves(past)).toThrow('wTrainerClass');
    const empty = fresh();
    place(empty, [], 2);
    expect(() => AIEnemyTrainerChooseMoves(empty)).toThrow('empty enemy move set');
    const youngster = fresh();
    place(youngster, [], 1);
    expect(AIEnemyTrainerChooseMoves(youngster)).toBe(A.wEnemyMonMoves);
  });
});

describe('ledgers', () => {
  it('SAILOR with the player paralysed', () => {
    const step = fresh();
    place(step, [86, 33], 4);
    step.wBattleMonStatus = 0x40;
    step.wBattleMonType1 = WATER;
    step.wBattleMonType2 = WATER;
    AIMoveChoiceModification1(step);
    expect(scores(step)).toEqual([15, 10, 10, 10]);
    AIMoveChoiceModification3(step);
    expect(scores(step)).toEqual([14, 10, 10, 10]);

    const state = fresh();
    place(state, [86, 33], 4);
    state.wBattleMonStatus = 0x40;
    state.wBattleMonType1 = WATER;
    state.wBattleMonType2 = WATER;
    const draws = script(state, [0, 63]);
    selectEnemyMove(state, trainer([86, 33]));
    expect(draws).toEqual([0, 63]);
    expect(scores(state)).toEqual([0, 33, 0, 0]);
    expect([state.wEnemySelectedMove, state.wEnemyMoveListIndex]).toEqual([33, 1]);
    expect(recordBytes(state)).toEqual(getMoveRecord(33).slice());
    expect(state.mem[0xd11d]).toBe(0x10);
  });

  it('POKEMANIAC on the encouragement turn', () => {
    const step = fresh();
    place(step, [16, 28], 7);
    step.wAILayer2Encouragement = 1;
    step.setBytes(A.wEnemyMoveNum, [0xee, 0xee, 0xee, 0xee, 0xee, 0xee], 6);
    AIMoveChoiceModification1(step);
    expect(scores(step)).toEqual([10, 10, 10, 10]);
    expect(recordBytes(step)).toEqual([0xee, 0xee, 0xee, 0xee, 0xee, 0xee]);
    AIMoveChoiceModification2(step);
    expect(scores(step)).toEqual([10, 9, 10, 10]);
    AIMoveChoiceModification3(step);
    expect(scores(step)).toEqual([10, 9, 10, 10]);

    const state = fresh();
    place(state, [16, 28], 7);
    state.wAILayer2Encouragement = 1;
    const draws = script(state, [63]);
    selectEnemyMove(state, trainer([16, 28]));
    expect(draws).toEqual([63]);
    expect(scores(state)).toEqual([0, 28, 0, 0]);
    expect([state.wEnemySelectedMove, state.wEnemyMoveListIndex]).toEqual([28, 1]);
    expect(recordBytes(state)).toEqual(getMoveRecord(28).slice());
    expect(state.wTypeEffectiveness).toBe(0x10);
  });

  it('LORELEI Dewgong at $65 and $66', () => {
    const run = (roll: number, slotRoll: number) => {
      const state = fresh();
      place(state, [33, 84], LORELEI);
      state.wEnemyMonSpecies = DEWGONG;
      state.wBattleMonType1 = WATER;
      state.wBattleMonType2 = WATER;
      const draws = script(state, [roll, slotRoll]);
      selectEnemyMove(state, trainer([33, 84]));
      return { state, draws };
    };
    const low = run(0x65, 0);
    expect(low.draws).toEqual([0x65, 0]);
    expect(scores(low.state)).toEqual([33, 84, 0, 0]);
    expect([low.state.wEnemySelectedMove, low.state.wEnemyMoveListIndex]).toEqual([33, 0]);
    expect(low.state.mem[0xd11d]).toBe(0x10);
    expect(recordBytes(low.state)).toEqual(getMoveRecord(84).slice());

    const high = run(0x66, 63);
    expect(high.draws).toEqual([0x66, 63]);
    expect(scores(high.state)).toEqual([0, 84, 0, 0]);
    expect([high.state.wEnemySelectedMove, high.state.wEnemyMoveListIndex]).toEqual([84, 1]);
    expect(high.state.mem[0xd11d]).toBe(0x14);
    expect(recordBytes(high.state)).toEqual(getMoveRecord(84).slice());
  });

  it('YOUNGSTER with a disabled move', () => {
    const state = fresh();
    place(state, [16, 28], 1);
    state.wEnemyDisabledMove = 0x17;
    state.setBytes(A.wEnemyMoveNum, [0xee, 0xee, 0xee, 0xee, 0xee, 0xee], 6);
    state.wTypeEffectiveness = 0xab;
    const draws = script(state, [0, 62, 63]);
    selectEnemyMove(state, trainer([16, 28]));
    expect(draws).toEqual([0, 62, 63]);
    expect(scores(state)).toEqual([0x50, 10, 10, 10]);
    expect([state.wEnemySelectedMove, state.wEnemyMoveListIndex]).toEqual([28, 1]);
    expect(recordBytes(state)).toEqual([0xee, 0xee, 0xee, 0xee, 0xee, 0xee]);
    expect(state.mem[0xd11d]).toBe(0xab);
  });
});

describe('reachable scores match the minimum entries', () => {
  const pool = [86, 33, 28, 84];
  const moveSets: number[][] = [];
  for (let mask = 1; mask < 16; mask++) {
    const ids = [0, 0, 0, 0];
    let count = 0;
    for (let bit = 0; bit < 4; bit++) if (mask & (1 << bit)) ids[count++] = pool[bit];
    moveSets.push(ids);
  }
  const defenders: readonly (readonly [number, number])[] = [
    [NORMAL, NORMAL], [WATER, WATER], [GROUND, GROUND], [GRASS, GRASS], [WATER, GROUND],
  ];

  function chart(moveType: number, type1: number, type2: number): number {
    for (const row of TYPE_CHART) {
      if (row.attack !== moveType) continue;
      if (row.defend === type1 || row.defend === type2) return row.multiplier;
    }
    return 0x10;
  }

  function reference(ids: readonly number[], disabled: number, mods: readonly number[], status: number,
    encouragement: number, type1: number, type2: number): number[] {
    const next = [10, 10, 10, 10];
    if (disabled !== 0) next[disabled - 1] = 0x50;
    for (const mod of mods) {
      if (mod === 1) {
        if (status === 0) continue;
        for (let i = 0; i < 4 && ids[i] !== 0; i++) {
          const rec = getMoveRecord(ids[i]);
          if (rec[2] !== 0) continue;
          if (rec[1] === 0x01 || rec[1] === 0x20 || rec[1] === 0x42 || rec[1] === 0x43) next[i] = (next[i] + 5) & 255;
        }
      } else if (mod === 2) {
        if (encouragement !== 1) continue;
        for (let i = 0; i < 4 && ids[i] !== 0; i++) {
          const effect = getMoveRecord(ids[i])[1];
          if ((effect >= 0x0a && effect < 0x1a) || (effect >= 0x32 && effect < 0x42)) next[i] = (next[i] - 1) & 255;
        }
      } else if (mod === 3) {
        for (let i = 0; i < 4 && ids[i] !== 0; i++) {
          const rec = getMoveRecord(ids[i]);
          const eff = chart(rec[3], type1, type2);
          if (eff === 0x10) continue;
          if (eff > 0x10) { next[i] = (next[i] - 1) & 255; continue; }
          let found = 0;
          for (let j = 0; j < 4 && ids[j] !== 0; j++) {
            const cand = getMoveRecord(ids[j]);
            if (cand[1] === 0x28 || cand[1] === 0x29 || cand[1] === 0x2b) { found = cand[1]; break; }
            if (cand[3] === rec[3]) continue;
            if (cand[2] !== 0) { found = cand[2]; break; }
          }
          if (found !== 0) next[i] = (next[i] + 1) & 255;
        }
      }
    }
    return next;
  }

  function minimum(ids: readonly number[], rated: readonly number[]): number[] {
    let min = 0x100;
    for (let i = 0; i < 4; i++) if (ids[i] !== 0) min = Math.min(min, rated[i]);
    return ids.map((id, i) => id !== 0 && rated[i] === min ? id : 0);
  }

  it('every class list filters to the minimum non-empty slots', () => {
    const state = fresh();
    state.wEnemyMonSpecies = 0;
    for (const ids of moveSets) {
      const count = ids.filter(id => id !== 0).length;
      for (const classId of EXPECTED.map((_, index) => index + 1)) {
        const mods = EXPECTED[classId - 1];
        for (const disabled of [0, count]) {
          for (const status of [0, 0x40]) {
            for (const encouragement of [0, 1, 2]) {
              for (const [type1, type2] of defenders) {
                place(state, ids, classId);
                state.wEnemyDisabledMove = disabled << 4;
                state.wBattleMonStatus = status;
                state.wAILayer2Encouragement = encouragement;
                state.wBattleMonType1 = type1;
                state.wBattleMonType2 = type2;
                const rated = reference(ids, disabled, mods, status, encouragement, type1, type2);
                const expected = mods.length === 0 ? rated : minimum(ids, rated);
                const address = AIEnemyTrainerChooseMoves(state);
                const label = `class ${classId} moves ${ids} disabled ${disabled} status ${status} `
                  + `encouragement ${encouragement} types ${type1}/${type2}`;
                expect(address, label).toBe(mods.length === 0 ? A.wEnemyMonMoves : A.wBuffer);
                expect(scores(state), label).toEqual(expected);
              }
            }
          }
        }
      }
    }
  });
});
