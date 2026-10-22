import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TYPE_NAMES } from '../rom/constants';
import { TYPE_EFFECTS } from '../rom/rom_offsets';
import type { Program } from './battle_menu_context';
import {
  A,
  LINK_STATE_BATTLING,
  PARTYMON_STRUCT_LENGTH,
  type BattleState,
  BattleState as State,
  type SpeciesHeader,
} from './battle_state';
import {
  adjustDamageForMoveType,
  calculateDamage,
  criticalHitTest,
  getDamageVarsForEnemyAttack,
  getDamageVarsForPlayerAttack,
  getEnemyMonStat,
  randomizeDamage,
} from './battle_damage_asm';

const MON_ATTACK = 36;
const MON_DEFENSE = 38;
const MON_SPECIAL = 42;
/** wLoadedMonSpeedExp. GetEnemyMonStat copies the enemy DVs here. core.asm:4456. */
const LOADED_SPEED_EXP = 0xcfae;

function header(base: [number, number, number, number, number], idNote = 0): SpeciesHeader {
  return {
    name: `mon${idNote}`,
    base,
    type1: 0,
    type2: 0,
    catchRate: 0,
    baseExp: 0,
    moves: [0, 0, 0, 0],
    learnset: [],
  };
}

function withSpecies(state: BattleState, table: Record<number, SpeciesHeader>): void {
  state.species = id => {
    const found = table[id & 0xff];
    if (!found) throw new Error(`no species ${id}`);
    return found;
  };
}

function script(state: BattleState, bytes: readonly number[]): () => number {
  let i = 0;
  state.readDIV = () => {
    if (i >= bytes.length) throw new Error(`div overread at ${i}`);
    return bytes[i++];
  };
  return () => i;
}

function run<T>(program: Program<T>, cap = 8): { done: boolean; frames: string[]; result?: T } {
  const frames: string[] = [];
  let step = program.next();
  while (!step.done) {
    frames.push(step.value);
    if (frames.length >= cap) return { done: false, frames };
    step = program.next();
  }
  return { done: true, frames, result: step.value };
}

function party(state: BattleState, base: number, slot: number, offset: number, value: number): void {
  state.writeBE(base + (slot & 0xff) * PARTYMON_STRUCT_LENGTH + offset, value);
}

function damageOf(level: number, power: number, attack: number, defense: number, preset = 0): number {
  const state = new State();
  state.wDamage = preset;
  const out = run(calculateDamage(state, attack, defense, power, level));
  expect(out.done).toBe(true);
  expect(out.frames).toEqual([]);
  expect(out.result).toEqual({ z: false });
  return state.wDamage;
}

describe('CriticalHitTest, core.asm:4649', () => {
  function critState(speed: number, enemySpeed = speed): { state: BattleState; reads: () => number } {
    const state = new State();
    withSpecies(state, {
      1: header([10, 10, 10, speed, 10], 1),
      2: header([10, 10, 10, enemySpeed, 10], 2),
    });
    state.wBattleMonSpecies = 1;
    state.wEnemyMonSpecies = 2;
    state.wPlayerMovePower = 40;
    state.wEnemyMovePower = 40;
    state.wPlayerMoveNum = 1;
    state.wEnemyMoveNum = 1;
    const reads = script(state, [1, 1]);
    return { state, reads };
  }

  it('a roll equal to the threshold is not a crit', () => {
    const state = critState(32).state;
    state.wCriticalHitOrOHKO = 1;
    criticalHitTest(state);
    expect(state.wCriticalHitOrOHKO).toBe(0);
  });

  it('three circular RLCs rotate draw 2 to 16, so speed 36 crits', () => {
    const { state, reads } = critState(36);
    criticalHitTest(state);
    expect(state.hRandomAdd).toBe(2);
    expect(state.wCriticalHitOrOHKO).toBe(1);
    expect(reads()).toBe(2);
  });

  it('draw $81 wraps to $0C: below threshold 13, equal to threshold 12', () => {
    for (const [speed, expected] of [[26, 1], [24, 0]]) {
      const { state } = critState(speed);
      script(state, [0x80, 0]);
      criticalHitTest(state);
      expect(state.hRandomAdd).toBe(0x81);
      expect(state.wCriticalHitOrOHKO).toBe(expected);
    }
  });

  it('the crit result is independent of hRandomSub borrow', () => {
    const borrowed = critState(36);
    const unborrowed = critState(36);
    unborrowed.state.hRandomSub = 1;
    for (const { state, reads } of [borrowed, unborrowed]) {
      criticalHitTest(state);
      expect(state.hRandomAdd).toBe(2);
      expect(state.wCriticalHitOrOHKO).toBe(1);
      expect(reads()).toBe(2);
    }
    expect(borrowed.state.hRandomSub).toBe(0xff);
    expect(unborrowed.state.hRandomSub).toBe(0);
  });

  it('the player turn uses the battle-mon species, not the enemy species loaded first', () => {
    const state = critState(32, 36).state;
    criticalHitTest(state);
    expect(state.wCriticalHitOrOHKO).toBe(0);
    expect(state.wCurSpecies).toBe(1);
    state.hWhoseTurn = 1;
    state.wCriticalHitOrOHKO = 0;
    state.hRandomAdd = 0;
    state.hRandomSub = 0;
    script(state, [1, 1]);
    criticalHitTest(state);
    expect(state.wCriticalHitOrOHKO).toBe(1);
    expect(state.wCurSpecies).toBe(2);
  });

  it('link draws rotate circularly before and at the ninth-draw reseed', () => {
    const state = new State();
    withSpecies(state, { 1: header([0, 0, 0, 20, 0]) });
    state.wBattleMonSpecies = 1;
    state.wPlayerMovePower = 10;
    state.wPlayerMoveNum = 1;
    state.wLinkState = LINK_STATE_BATTLING;
    state.readDIV = () => { throw new Error('link read DIV'); };
    state.mem[A.wLinkBattleRandomNumberList] = 1;
    criticalHitTest(state);
    expect(state.wCriticalHitOrOHKO).toBe(1); // rotl(1, 3) = 8 < 10
    expect(state.wLinkBattleRandomNumberListIndex).toBe(1);
    state.wLinkBattleRandomNumberListIndex = 8;
    state.mem[A.wLinkBattleRandomNumberList + 8] = 0x81;
    criticalHitTest(state);
    expect(state.wCriticalHitOrOHKO).toBe(0); // rotl($81, 3) = 12 >= 10
    expect(state.wLinkBattleRandomNumberListIndex).toBe(0);
    expect(state.mem[A.wLinkBattleRandomNumberList]).toBe(6);
    expect(state.mem[A.wLinkBattleRandomNumberList + 8]).toBe(0x86);
  });

  it('Focus Energy shifts the wrong way, and a high-crit move saturates at $FF', () => {
    const focused = critState(40);
    script(focused.state, [0, 0]);
    focused.state.wPlayerBattleStatus2 = 1 << 2;
    criticalHitTest(focused.state);
    expect(focused.state.wCriticalHitOrOHKO).toBe(0);
    const plain = critState(40);
    script(plain.state, [0, 0]);
    criticalHitTest(plain.state);
    expect(plain.state.wCriticalHitOrOHKO).toBe(1);

    const slash = critState(80);
    script(slash.state, [11, 1]);
    slash.state.wPlayerMoveNum = 0xa3;
    criticalHitTest(slash.state);
    expect(slash.state.wCriticalHitOrOHKO).toBe(1);
    const pound = critState(80);
    script(pound.state, [11, 1]);
    pound.state.wPlayerMoveNum = 1;
    criticalHitTest(pound.state);
    expect(pound.state.wCriticalHitOrOHKO).toBe(0);
    const chop = critState(40);
    script(chop.state, [11, 1]);
    chop.state.wPlayerMoveNum = 0x02;
    criticalHitTest(chop.state);
    expect(chop.state.wCriticalHitOrOHKO).toBe(1);
  });

  it('zero power clears the byte, loads the header and draws nothing', () => {
    const state = critState(36).state;
    state.wPlayerMovePower = 0;
    state.wCriticalHitOrOHKO = 0xff;
    state.readDIV = () => { throw new Error('drew'); };
    criticalHitTest(state);
    expect(state.wCriticalHitOrOHKO).toBe(0);
    expect(state.wCurSpecies).toBe(1);
    expect(state.mem[A.wMonHBaseStats + 3]).toBe(36);
  });
});

describe('GetDamageVars and GetEnemyMonStat, core.asm:4201', () => {
  it('zero power is Z, clears wDamage and does not read a header', () => {
    for (const enemy of [false, true]) {
      const state = new State();
      state.species = () => { throw new Error('header'); };
      state.wDamage = 0x1234;
      state.wCriticalHitOrOHKO = 1;
      state.wPlayerMovePower = enemy ? 40 : 0;
      state.wEnemyMovePower = enemy ? 0 : 40;
      const vars = enemy ? getDamageVarsForEnemyAttack(state) : getDamageVarsForPlayerAttack(state);
      expect(vars).toEqual({ z: true, attack: 0, defense: 0, power: 0, level: 0 });
      expect(state.wDamage).toBe(0);
    }
  });

  it('type $14 is special and type $13 is physical', () => {
    const state = new State();
    state.wPlayerMovePower = 40;
    state.wBattleMonLevel = 20;
    state.wBattleMonAttack = 10;
    state.wBattleMonSpecial = 80;
    state.wEnemyMonDefense = 10;
    state.wEnemyMonSpecial = 90;
    state.wPlayerMoveType = 0x13;
    expect(getDamageVarsForPlayerAttack(state)).toMatchObject({ z: false, attack: 10, defense: 10, level: 20 });
    state.wPlayerMoveType = 0x14;
    expect(getDamageVarsForPlayerAttack(state)).toMatchObject({ z: false, attack: 80, defense: 90, level: 20 });
  });

  it('screens double defense before the crit replacement, and a crit discards that', () => {
    const state = new State();
    withSpecies(state, { 4: header([40, 40, 100, 40, 100]) });
    state.wEnemyMonSpecies = 4;
    state.wEnemyMonLevel = 50;
    state.wPlayerMovePower = 40;
    state.wBattleMonLevel = 50;
    state.wBattleMonAttack = 10;
    state.wEnemyMonDefense = 100;
    state.wEnemyBattleStatus3 = 1 << 2;
    expect(getDamageVarsForPlayerAttack(state)).toMatchObject({ attack: 10, defense: 200, level: 50 });
    state.wCriticalHitOrOHKO = 1;
    party(state, A.wPartyMons, 0, MON_ATTACK, 77);
    expect(getDamageVarsForPlayerAttack(state)).toMatchObject({ attack: 77, defense: 105, level: 100 });

    state.wCriticalHitOrOHKO = 0;
    state.wPlayerMoveType = 0x14;
    state.wBattleMonSpecial = 40;
    state.wEnemyMonSpecial = 100;
    state.wEnemyBattleStatus3 = 1 << 1;
    expect(getDamageVarsForPlayerAttack(state)).toMatchObject({ attack: 40, defense: 200 });
  });

  it('the enemy side doubles the player screen and a link crit reads both parties', () => {
    const state = new State();
    state.wEnemyMovePower = 15;
    state.wEnemyMonLevel = 9;
    state.wEnemyMonAttack = 40;
    state.wBattleMonDefense = 30;
    state.wPlayerBattleStatus3 = 1 << 2;
    expect(getDamageVarsForEnemyAttack(state)).toMatchObject({ attack: 40, defense: 60, level: 9 });
    state.wPlayerBattleStatus3 = 0;
    state.wEnemyMoveType = 0x14;
    state.wEnemyMonSpecial = 80;
    state.wBattleMonSpecial = 90;
    expect(getDamageVarsForEnemyAttack(state)).toMatchObject({ attack: 80, defense: 90 });
    state.wPlayerBattleStatus3 = 1 << 1;
    expect(getDamageVarsForEnemyAttack(state)).toMatchObject({ attack: 80, defense: 180 });

    state.wEnemyMoveType = 0;
    state.wCriticalHitOrOHKO = 1;
    state.wLinkState = LINK_STATE_BATTLING;
    state.wCurSpecies = 0xab;
    state.species = () => { throw new Error('calcstat'); };
    state.wPlayerMonNumber = 1;
    state.wEnemyMonPartyPos = 2;
    party(state, A.wPartyMons, 1, MON_DEFENSE, 70);
    party(state, A.wPartyMons, 0, MON_DEFENSE, 11);
    party(state, A.wEnemyMons, 2, MON_ATTACK, 90);
    party(state, A.wEnemyMons, 0, MON_ATTACK, 11);
    expect(getDamageVarsForEnemyAttack(state)).toMatchObject({ attack: 90, defense: 70, level: 18 });
    expect(state.wCurSpecies).toBe(0xab);
  });

  it('scaling keeps low bytes, bumps only a zero offense word, and can leave defense 0', () => {
    const state = new State();
    state.wPlayerMovePower = 40;
    state.wBattleMonLevel = 50;
    state.wBattleMonAttack = 300;
    state.wEnemyMonDefense = 8;
    expect(getDamageVarsForPlayerAttack(state)).toMatchObject({ attack: 75, defense: 2 });
    state.wBattleMonAttack = 3;
    state.wEnemyMonDefense = 256;
    expect(getDamageVarsForPlayerAttack(state)).toMatchObject({ attack: 1, defense: 64 });
    state.wBattleMonAttack = 1024;
    state.wEnemyMonDefense = 256;
    expect(getDamageVarsForPlayerAttack(state)).toMatchObject({ attack: 0, defense: 64 });
    state.wBattleMonAttack = 0;
    state.wEnemyMonDefense = 256;
    expect(getDamageVarsForPlayerAttack(state)).toMatchObject({ attack: 1, defense: 64 });
    state.wBattleMonAttack = 256;
    state.wEnemyMonDefense = 3;
    expect(getDamageVarsForPlayerAttack(state)).toMatchObject({ attack: 64, defense: 0 });
    state.wBattleMonAttack = 10;
    state.wEnemyMonDefense = 0x8000;
    state.wEnemyBattleStatus3 = 1 << 2;
    expect(getDamageVarsForPlayerAttack(state)).toMatchObject({ attack: 10, defense: 0 });
  });

  it('a crit level wraps in one byte, including level 128 to 0', () => {
    const state = new State();
    state.wPlayerMovePower = 10;
    state.wBattleMonAttack = 20;
    state.wEnemyMonDefense = 20;
    state.wBattleMonLevel = 100;
    state.wCriticalHitOrOHKO = 1;
    withSpecies(state, { 0: header([1, 1, 1, 1, 1]) });
    party(state, A.wPartyMons, 0, MON_ATTACK, 20);
    expect(getDamageVarsForPlayerAttack(state).level).toBe(200);
    state.wBattleMonLevel = 128;
    expect(getDamageVarsForPlayerAttack(state).level).toBe(0);
  });

  it('CalcStat ignores stat experience and the party, and the defense nybble is the low one', () => {
    const state = new State();
    withSpecies(state, { 7: header([50, 80, 100, 40, 90]) });
    state.wEnemyMonSpecies = 7;
    state.wEnemyMonLevel = 50;
    state.wCurEnemyLevel = 99;
    state.wCurSpecies = 1;
    state.mem.fill(0xff, LOADED_SPEED_EXP - 16, LOADED_SPEED_EXP + 8);
    for (let slot = 0; slot < 6; slot++) {
      party(state, A.wEnemyMons, slot, MON_DEFENSE, 999);
      state.mem[A.wEnemyMons + slot * PARTYMON_STRUCT_LENGTH + 17] = 0xff;
      state.mem[A.wEnemyMons + slot * PARTYMON_STRUCT_LENGTH + 27] = 0xff;
    }
    state.mem[A.wEnemyMonDVs] = 0;
    state.mem[A.wEnemyMonDVs + 1] = 0;
    expect(getEnemyMonStat(state, 3)).toBe(105);
    expect(state.wCurEnemyLevel).toBe(50);
    expect(state.wCurSpecies).toBe(7);
    state.mem[A.wEnemyMonDVs] = 0xf0;
    expect(getEnemyMonStat(state, 3)).toBe(105);
    state.mem[A.wEnemyMonDVs] = 0x0f;
    expect(getEnemyMonStat(state, 3)).toBe(120);
    state.mem[A.wEnemyMonDVs] = 0;
    expect(getEnemyMonStat(state, 1)).toBe(110);
  });

  it('a link battle reads the enemy party slot and does not run CalcStat', () => {
    const state = new State();
    state.wLinkState = LINK_STATE_BATTLING;
    state.wCurSpecies = 0xab;
    state.wEnemyMonPartyPos = 2;
    state.species = () => { throw new Error('calcstat'); };
    party(state, A.wEnemyMons, 0, MON_DEFENSE, 11);
    party(state, A.wEnemyMons, 2, MON_DEFENSE, 80);
    expect(getEnemyMonStat(state, 3)).toBe(80);
    expect(state.wCurSpecies).toBe(0xab);
  });

  it('a player crit reads the selected party slot', () => {
    const state = new State();
    withSpecies(state, { 3: header([1, 1, 1, 1, 1]) });
    state.wEnemyMonSpecies = 3;
    state.wEnemyMonLevel = 5;
    state.wPlayerMovePower = 10;
    state.wBattleMonLevel = 5;
    state.wCriticalHitOrOHKO = 1;
    state.wPlayerMonNumber = 1;
    party(state, A.wPartyMons, 0, MON_ATTACK, 11);
    party(state, A.wPartyMons, 1, MON_ATTACK, 90);
    expect(getDamageVarsForPlayerAttack(state)).toMatchObject({ attack: 90, level: 10 });
  });
});

describe('CalculateDamage, core.asm:4470', () => {
  it('hand-checked truncations, the crit-level wrap and the 9-bit level term', () => {
    expect(damageOf(5, 40, 20, 20)).toBe(5);
    expect(damageOf(50, 40, 20, 20)).toBe(19);
    expect(damageOf(100, 40, 20, 20)).toBe(35);
    expect(damageOf(200, 40, 20, 20)).toBe(67);
    expect(damageOf(0, 40, 20, 20)).toBe(3);
    expect(damageOf(50, 40, 0, 1)).toBe(2);
    expect(damageOf(50, 40, 1, 1)).toBe(19);
  });

  it('the 997 cap, the q2 >= 4 arm, the 998 boundary and an under-cap quotient', () => {
    expect(damageOf(100, 255, 255, 1)).toBe(999);
    expect(damageOf(135, 235, 249, 1)).toBe(999);
    expect(damageOf(45, 32, 80, 1)).toBe(999);
    expect(damageOf(45, 16, 80, 1)).toBe(514);
    expect(damageOf(45, 64, 30, 1)).toBe(770);
    expect(damageOf(1, 100, 249, 1)).toBe(998);
    expect(damageOf(1, 104, 240, 1)).toBe(999);
  });

  it('shared damage adds the high byte twice, and both later caps still fire', () => {
    expect(damageOf(5, 25, 20, 4, 5)).toBe(17);
    expect(damageOf(5, 25, 20, 4, 0x0100)).toBe(269);
    expect(damageOf(45, 16, 80, 1, 0xfe00)).toBe(999);
    expect(damageOf(150, 223, 237, 1, 0x0100)).toBe(999);
    expect(damageOf(1, 100, 249, 1, 2)).toBe(999);
  });

  it('Explosion halves defense to a minimum of 1 and the enemy effect is its own byte', () => {
    const state = new State();
    state.wPlayerMoveEffect = 0x07;
    expect(damageOf(50, 40, 20, 11)).toBe(34);
    const boom = run(calculateDamage(state, 20, 11, 40, 50));
    expect(boom.result).toEqual({ z: false });
    expect(state.wDamage).toBe(72);
    state.wDamage = 0;
    const fromZero = run(calculateDamage(state, 20, 0, 40, 50));
    expect(fromZero.done).toBe(true);
    expect(fromZero.frames).toEqual([]);
    expect(state.wDamage).toBe(354);
    state.wDamage = 0;
    expect(run(calculateDamage(state, 20, 1, 40, 50)).done).toBe(true);
    expect(state.wDamage).toBe(354);

    const enemy = new State();
    enemy.hWhoseTurn = 1;
    enemy.wPlayerMoveEffect = 0x07;
    enemy.wEnemyMoveEffect = 0;
    expect(run(calculateDamage(enemy, 20, 11, 40, 50)).result).toEqual({ z: false });
    expect(enemy.wDamage).toBe(34);
  });

  it('multi-hit power 0 still deals 2, and a normal power 0 returns Z with damage untouched', () => {
    for (const effect of [0x1d, 0x1e]) {
      const state = new State();
      state.wPlayerMoveEffect = effect;
      state.wDamage = 5;
      const out = run(calculateDamage(state, 20, 20, 0, 5));
      expect(out.result).toEqual({ z: false });
      expect(state.wDamage).toBe(7);
    }
    const clean = new State();
    clean.wPlayerMoveEffect = 0x1d;
    expect(run(calculateDamage(clean, 20, 20, 0, 5)).result).toEqual({ z: false });
    expect(clean.wDamage).toBe(2);
    const state = new State();
    state.wDamage = 0x1234;
    state.wPlayerMoveEffect = 0;
    const out = run(calculateDamage(state, 20, 0, 0, 50), 4);
    expect(out).toEqual({ done: true, frames: [], result: { z: true } });
    expect(state.wDamage).toBe(0x1234);
  });

  it('OHKO yields the port and Z follows wMoveMissed after dec, even at power 0', () => {
    const frames: string[] = [];
    const state = new State();
    state.wPlayerMoveEffect = 0x26;
    state.wDamage = 0x1234;
    state.wMoveMissed = 0;
    const hit = run(calculateDamage(state, 20, 0, 0, 50, function* (): Program {
      frames.push('port');
      yield 'held';
    }));
    expect(hit.done).toBe(true);
    expect(hit.frames).toEqual(['held']);
    expect(hit.result).toEqual({ z: false });
    expect(frames).toEqual(['port']);
    expect(state.wDamage).toBe(0x1234);
    state.wMoveMissed = 1;
    expect(run(calculateDamage(state, 1, 1, 40, 50, () => undefined)).result).toEqual({ z: true });
    state.wMoveMissed = 2;
    expect(run(calculateDamage(state, 1, 1, 40, 50, () => undefined)).result).toEqual({ z: false });
  });

  it('defense 0 yields serviced forever and never returns', () => {
    const state = new State();
    const program = calculateDamage(state, 10, 0, 40, 50);
    const out = run(program, 40);
    expect(out.done).toBe(false);
    expect(out.frames).toEqual(Array(40).fill('serviced'));
    const again = program.next();
    expect(again.done).toBe(false);
    expect(again.value).toBe('serviced');
    const wrapped = new State();
    wrapped.wPlayerMovePower = 40;
    wrapped.wBattleMonLevel = 50;
    wrapped.wBattleMonAttack = 10;
    wrapped.wEnemyMonDefense = 0x8000;
    wrapped.wEnemyBattleStatus3 = 1 << 2;
    const vars = getDamageVarsForPlayerAttack(wrapped);
    expect(vars).toMatchObject({ attack: 10, defense: 0 });
    const hung = run(calculateDamage(wrapped, vars.attack, vars.defense, vars.power, vars.level), 40);
    expect(hung.done).toBe(false);
    expect(hung.frames.every(frame => frame === 'serviced')).toBe(true);
  });

  it('a multi-hit of power 0 still freezes when defense is 0', () => {
    const state = new State();
    state.wPlayerMoveEffect = 0x1d;
    const hung = run(calculateDamage(state, 20, 0, 0, 5), 40);
    expect(hung.done).toBe(false);
    expect(hung.frames).toEqual(Array(40).fill('serviced'));
  });
});

describe('AdjustDamageForMoveType, core.asm:5246', () => {
  it('STAB is a 16-bit shift-add and sets bit 7', () => {
    const state = new State();
    state.wPlayerMoveType = 0;
    state.wBattleMonType1 = 0;
    state.wBattleMonType2 = 0;
    state.wEnemyMonType1 = 0;
    state.wEnemyMonType2 = 0;
    state.wDamage = 0xffff;
    adjustDamageForMoveType(state);
    expect(state.wDamage).toBe(0x7ffe);
    expect(state.wDamageMultipliers).toBe(0x80);
    expect(state.wMoveType).toBe(0);
    const enemy = new State();
    enemy.hWhoseTurn = 1;
    enemy.wEnemyMoveType = 21;
    enemy.wEnemyMonType1 = 21;
    enemy.wBattleMonType1 = 20;
    enemy.wDamage = 10;
    adjustDamageForMoveType(enemy);
    expect(enemy.wDamage).toBe(30);
    expect(enemy.wDamageMultipliers).toBe(0x94);
    expect(enemy.wMoveType).toBe(21);
  });

  it('walks matching rows in ROM order and stores only the last byte', () => {
    const fighting = new State();
    fighting.wPlayerMoveType = 1;
    fighting.wBattleMonType1 = 0;
    fighting.wEnemyMonType1 = 0;
    fighting.wEnemyMonType2 = 2;
    fighting.wDamage = 19;
    adjustDamageForMoveType(fighting);
    expect(fighting.wDamage).toBe(19);
    expect(fighting.wDamageMultipliers).toBe(0x05);

    const ground = new State();
    ground.wPlayerMoveType = 4;
    ground.wBattleMonType1 = 0;
    ground.wEnemyMonType1 = 22;
    ground.wEnemyMonType2 = 3;
    ground.wDamage = 19;
    adjustDamageForMoveType(ground);
    expect(ground.wDamage).toBe(18);
    expect(ground.wDamageMultipliers).toBe(0x14);
  });

  it('two half-damage rows floor to 0 and miss at 3, and leave 1 at 4', () => {
    const miss = new State();
    miss.wPlayerMoveType = 21;
    miss.wBattleMonType1 = 0;
    miss.wEnemyMonType1 = 22;
    miss.wEnemyMonType2 = 26;
    miss.wDamage = 3;
    adjustDamageForMoveType(miss);
    expect(miss.wDamage).toBe(0);
    expect(miss.wMoveMissed).toBe(1);
    expect(miss.wDamageMultipliers).toBe(0x05);
    const hit = new State();
    hit.wPlayerMoveType = 21;
    hit.wBattleMonType1 = 0;
    hit.wEnemyMonType1 = 22;
    hit.wEnemyMonType2 = 26;
    hit.wDamage = 4;
    adjustDamageForMoveType(hit);
    expect(hit.wDamage).toBe(1);
    expect(hit.wMoveMissed).toBe(0);
  });

  it('immunity keeps the STAB bit, zeroes damage and sets missed', () => {
    const state = new State();
    state.wPlayerMoveType = 23;
    state.wBattleMonType1 = 23;
    state.wEnemyMonType1 = 4;
    state.wEnemyMonType2 = 4;
    state.wDamage = 4;
    adjustDamageForMoveType(state);
    expect(state.wDamage).toBe(0);
    expect(state.wMoveMissed).toBe(1);
    expect(state.wDamageMultipliers).toBe(0x80);
  });

  it.skipIf(!process.env.ROM_PATH)('type_chart.json is the ROM TypeEffects table, 82 rows and no $FE', () => {
    const rom = readFileSync(process.env.ROM_PATH!);
    const json = JSON.parse(readFileSync(new URL('../../data/type_chart.json', import.meta.url), 'utf8')) as {
      attacker: string;
      defender: string;
      multiplier: number;
    }[];
    const rows: { attacker: string; defender: string; multiplier: number }[] = [];
    let offset = TYPE_EFFECTS;
    while (rom[offset] !== 0xff) {
      expect(rom[offset]).not.toBe(0xfe);
      const multiplier = rom[offset + 2];
      rows.push({
        attacker: TYPE_NAMES[rom[offset]],
        defender: TYPE_NAMES[rom[offset + 1]],
        multiplier: multiplier === 0x14 ? 2 : multiplier === 0x05 ? 0.5 : 0,
      });
      expect([0x14, 0x05, 0x00]).toContain(multiplier);
      offset += 3;
    }
    expect(rows).toEqual(json);
    expect(rows).toHaveLength(82);
  });
});

describe('RandomizeDamage, core.asm:5602', () => {
  it('rejects the rotated sample below 217, then floors damage * r / 255', () => {
    const state = new State();
    state.wDamage = 18;
    const reads = script(state, [0, 0, 177, 0]);
    randomizeDamage(state);
    expect(state.wDamage).toBe(15);
    expect(reads()).toBe(4);
    const twice = new State();
    twice.wDamage = 18;
    const more = script(twice, [0, 0, 0, 0, 176, 0]);
    randomizeDamage(twice);
    expect(twice.wDamage).toBe(15);
    expect(more()).toBe(6);
    const boundary = new State();
    boundary.wDamage = 255;
    const edge = script(boundary, [176, 0, 1, 0]);
    randomizeDamage(boundary);
    expect(boundary.wDamage).toBe(217);
    expect(edge()).toBe(4);
  });

  it('damage 0 and 1 draw nothing, and damage 2 can fall to 1', () => {
    for (const damage of [0, 1]) {
      const state = new State();
      state.wDamage = damage;
      state.readDIV = () => { throw new Error('drew'); };
      randomizeDamage(state);
      expect(state.wDamage).toBe(damage);
    }
    const state = new State();
    state.wDamage = 2;
    const reads = script(state, [178, 0]);
    randomizeDamage(state);
    expect(state.wDamage).toBe(1);
    expect(reads()).toBe(2);
    const wide = new State();
    wide.wDamage = 0x0100;
    const wideReads = script(wide, [178, 0]);
    randomizeDamage(wide);
    expect(wide.wDamage).toBe(217);
    expect(wideReads()).toBe(2);
  });
});

describe('crit before immunity', () => {
  it('one crit draw, then an immune result draws nothing more', () => {
    const state = new State();
    withSpecies(state, {
      1: header([50, 50, 50, 50, 50]),
      2: header([50, 50, 50, 50, 50]),
    });
    state.wBattleMonSpecies = 1;
    state.wEnemyMonSpecies = 2;
    state.wBattleMonLevel = 50;
    state.wEnemyMonLevel = 50;
    state.wPlayerMoveNum = 1;
    state.wPlayerMovePower = 40;
    state.wPlayerMoveType = 23;
    state.wBattleMonType1 = 23;
    state.wEnemyMonType1 = 4;
    state.wEnemyMonType2 = 4;
    state.wBattleMonSpecial = 80;
    state.wEnemyMonSpecial = 20;
    party(state, A.wPartyMons, 0, MON_SPECIAL, 80);
    const reads = script(state, [1, 1]);
    criticalHitTest(state);
    expect(state.wCriticalHitOrOHKO).toBe(1);
    const vars = getDamageVarsForPlayerAttack(state);
    expect(vars.z).toBe(false);
    const dealt = run(calculateDamage(state, vars.attack, vars.defense, vars.power, vars.level));
    expect(dealt.result).toEqual({ z: false });
    expect(state.wDamage).toBeGreaterThan(0);
    adjustDamageForMoveType(state);
    expect(state.wDamage).toBe(0);
    expect(state.wMoveMissed).toBe(1);
    expect(state.wDamageMultipliers).toBe(0x80);
    expect(state.wCriticalHitOrOHKO).toBe(1);
    randomizeDamage(state);
    expect(reads()).toBe(2);
    expect(state.wDamage).toBe(0);
  });
});
