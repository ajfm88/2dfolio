import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isPassPressed: () => false, isHeld: () => false }));
import { A, BattleState, LINK_STATE_BATTLING, STRUGGLE } from './battle_state';
import {
  battleRandom, calculateModifiedStat, calculateModifiedStats, doubleOrHalveSelectedStats,
  executeMoveDamageChain, metronomePickMove, selectEnemyMove,
} from './battle_math';
import { createPokemon, getMove, getTypeChart, loadBattleData } from './data';
import { loadBattleMonFromParty, loadEnemyMonData, partySlotFromPokemon, writePartySlot } from './battle_loaders';
import type { BattlePokemon } from './types';

beforeAll(loadBattleData);
afterEach(() => vi.restoreAllMocks());

function pokemon(name = 'Rhydon'): BattlePokemon {
  const mon = createPokemon(name, 50, undefined, { atk: 9, def: 8, spd: 8, spc: 8 });
  if (!mon) throw new Error(name);
  return mon;
}

function rolls(state: BattleState, values: number[]): ReturnType<typeof vi.fn> {
  const next = vi.fn(() => {
    const value = values.shift();
    if (value === undefined) throw new Error('unexpected random call');
    return value;
  });
  state.random = next;
  return next;
}

function selection(): BattleState {
  const state = new BattleState();
  state.wIsInBattle = 1;
  state.setBytes(A.wEnemyMonMoves, [10, 20, 30, 40], 4);
  state.wEnemySelectedMove = 99;
  state.wEnemyMoveListIndex = 2;
  return state;
}

describe('BattleRandom, cartridge seam', () => {
  it.each([0, 1, 3, 5, 255])('off-link %i uses two rDIV reads and CP carry', link => {
    const s = new BattleState();
    s.wLinkState = link;
    s.hRandomAdd = 250;
    s.hRandomSub = 2;
    s.readDIV = vi.fn().mockReturnValueOnce(10).mockReturnValueOnce(4);
    expect(battleRandom(s)).toBe(link < 4 ? 5 : 4);
    expect(s.hRandomSub).toBe(253);
    expect(s.readDIV).toHaveBeenCalledTimes(2);
  });
  it('subtracts without ADC carry and advances a seeded sequence reproducibly', () => {
    const s = new BattleState();
    s.hRandomAdd = 10;
    s.hRandomSub = 20;
    s.readDIV = () => 2;
    expect([s.random(), s.random(), s.random()]).toEqual([13, 16, 19]);
    expect(s.hRandomSub).toBe(14);
    const other = new BattleState();
    expect([other.random(), other.random()]).toEqual([1, 4]);
  });
  it('returns seed 8 before regenerating nine bytes, leaves seed 9 untouched', () => {
    const s = new BattleState();
    s.wLinkState = LINK_STATE_BATTLING;
    s.setBytes(A.wLinkBattleRandomNumberList, [0, 1, 2, 3, 4, 5, 6, 255, 128, 77], 10);
    s.hRandomAdd = 91;
    s.hRandomSub = 92;
    s.readDIV = vi.fn(() => { throw new Error('link read rDIV'); });
    expect(Array.from({ length: 8 }, () => s.random())).toEqual([0, 1, 2, 3, 4, 5, 6, 255]);
    expect(s.wLinkBattleRandomNumberListIndex).toBe(8);
    expect(s.mem[A.wLinkBattleRandomNumberList]).toBe(0);
    expect(s.random()).toBe(128);
    expect(s.wLinkBattleRandomNumberListIndex).toBe(0);
    expect(s.bytes(A.wLinkBattleRandomNumberList, 10).slice()).toEqual([1, 6, 11, 16, 21, 26, 31, 252, 129, 77]);
    expect(s.random()).toBe(1);
    expect([s.hRandomAdd, s.hRandomSub]).toEqual([91, 92]);
  });
  it('the wild loader consumes the new default seam, second DV call first', () => {
    const s = new BattleState();
    s.wEnemyMonSpecies2 = 1;
    s.wCurPartySpecies = 1;
    s.wCurEnemyLevel = 50;
    s.wIsInBattle = 1;
    s.readDIV = () => 2;
    s.species = () => ({ name: 'RHYDON', base: [105, 130, 120, 40, 45], type1: 4, type2: 5,
      catchRate: 60, baseExp: 204, moves: [33, 0, 0, 0], learnset: [] });
    s.movePP = () => 35;
    loadEnemyMonData(s);
    expect(s.bytes(A.wEnemyMonDVs, 2).slice()).toEqual([6, 3]);
    expect(s.hRandomSub).toBe(252);
  });
});

describe('CalculateModifiedStat(s)', () => {
  // Hand-traced data/battle/stat_modifiers.asm for an unmodified stat of 101.
  it.each([25, 28, 33, 40, 50, 66, 101, 151, 202, 252, 303, 353, 404])('ratio %#: %i', (expected) => {
    const mod = [25, 28, 33, 40, 50, 66, 101, 151, 202, 252, 303, 353, 404].indexOf(expected) + 1;
    const s = new BattleState();
    s.writeBE(A.wPlayerMonUnmodifiedLevel + 3, 101);
    s.mem[A.wPlayerMonStatMods] = mod;
    s.wBattleMonAttack = 900;
    calculateModifiedStat(s, 0);
    expect(s.wBattleMonAttack).toBe(expected);
    expect(s.readBE(A.wPlayerMonUnmodifiedLevel + 3)).toBe(101);
  });
  it.each([0, 1, 255])('side selector %i changes four stats, never HP or the other side', side => {
    const s = new BattleState();
    s.wCalculateWhoseStats = side;
    s.wBattleMonHP = 88;
    s.wEnemyMonHP = 99;
    s.wBattleMonMaxHP = 111;
    s.wEnemyMonMaxHP = 222;
    for (let i = 0; i < 4; i++) {
      s.mem[A.wPlayerMonStatMods + i] = 8;
      s.mem[A.wEnemyMonStatMods + i] = 8;
      s.writeBE(A.wPlayerMonUnmodifiedLevel + 3 + 2 * i, 100 + 2 * i);
      s.writeBE(A.wEnemyMonUnmodifiedLevel + 3 + 2 * i, 200 + 2 * i);
    }
    calculateModifiedStats(s);
    const target = side === 0 ? A.wBattleMonAttack : A.wEnemyMonAttack;
    expect([0, 1, 2, 3].map(i => s.readBE(target + i * 2)))
      .toEqual(side === 0 ? [150, 153, 156, 159] : [300, 303, 306, 309]);
    expect(s.readBE(side === 0 ? A.wEnemyMonAttack : A.wBattleMonAttack)).toBe(0);
    expect([s.wBattleMonHP, s.wEnemyMonHP, s.wBattleMonMaxHP, s.wEnemyMonMaxHP]).toEqual([88, 99, 111, 222]);
    expect(s.wMaxPP).toBe(side); // $D11D alias is read, not overwritten.
  });
  it.each([[0, 1, 1], [3, 1, 1], [998, 7, 998], [999, 7, 999], [1000, 7, 999], [300, 13, 999]])
  ('original %i, mod %i -> %i', (original, mod, expected) => {
    const s = new BattleState();
    s.mem[A.wPlayerMonStatMods] = mod;
    s.writeBE(A.wPlayerMonUnmodifiedLevel + 3, original);
    calculateModifiedStat(s, 0);
    expect(s.wBattleMonAttack).toBe(expected);
  });
  it('pins mod 0 DEC/SLA byte wrap: $FE reads EA/77, not ratio 1 or 13', () => {
    const s = new BattleState();
    s.writeBE(A.wPlayerMonUnmodifiedLevel + 3, 101);
    calculateModifiedStat(s, 0);
    expect(s.wBattleMonAttack).toBe(198); // floor(101 * 234 / 119)
  });
  it('reports an untraced out-of-table mod instead of inventing a ratio', () => {
    const s = new BattleState();
    s.mem[A.wPlayerMonStatMods] = 14;
    expect(() => calculateModifiedStat(s, 0)).toThrow('untraced stat modifier offset: 26');
  });
});

describe('DoubleOrHalveSelectedStats', () => {
  it.each([0, 1, 255])('side %i, zero masks are no-ops', turn => {
    const s = new BattleState();
    s.hWhoseTurn = turn;
    s.wBattleMonAttack = 345;
    s.wEnemyMonAttack = 678;
    const before = s.mem.slice();
    doubleOrHalveSelectedStats(s);
    expect(s.mem).toEqual(before);
  });
  it.each([0, 1])('side %i keeps bit order, wraps doubling, halves with min 1', turn => {
    const s = new BattleState();
    s.hWhoseTurn = turn;
    const addr = turn === 0 ? A.wBattleMonAttack : A.wEnemyMonAttack;
    for (const [i, value] of [0x8001, 3, 257, 1].entries()) s.writeBE(addr + 2 * i, value);
    if (turn === 0) { s.wPlayerStatsToDouble = 0x85; s.wPlayerStatsToHalve = 0x8b; }
    else { s.wEnemyStatsToDouble = 0x85; s.wEnemyStatsToHalve = 0x8b; }
    doubleOrHalveSelectedStats(s);
    expect([0, 1, 2, 3].map(i => s.readBE(addr + 2 * i))).toEqual([1, 1, 514, 1]);
    expect(s.readBE(turn === 0 ? A.wEnemyMonAttack : A.wBattleMonAttack)).toBe(0);
  });
  it('halving carries the high byte into the low byte', () => {
    const s = new BattleState(); s.wBattleMonAttack = 257; s.wPlayerStatsToHalve = 1;
    doubleOrHalveSelectedStats(s); expect(s.wBattleMonAttack).toBe(128);
  });
});

describe('Execute move damage chain result adapter', () => {
  const cases: [string, string, string, number, number][] = [
    ['EARTHQUAKE', 'GRASS', 'POISON', 20, 1],
    ['KARATE_CHOP', 'NORMAL', 'FLYING', 10, 1], // Gen 1 Karate Chop is NORMAL.
    ['LOW_KICK', 'NORMAL', 'FLYING', 5, 1],
    ['SURF', 'FIRE', 'FIRE', 20, 2],
    ['SURF', 'FIRE', 'NORMAL', 20, 2],
    ['SURF', 'ROCK', 'GROUND', 20, 4],
    ['EMBER', 'WATER', 'ROCK', 5, 0.25],
    ['TACKLE', 'NORMAL', 'NORMAL', 10, 1],
    ['THUNDERSHOCK', 'GROUND', 'GROUND', 0, 0],
  ];
  for (const [moveId, type1, type2, byte, effectiveness] of cases) {
    it.each([false, true])(`${moveId} vs ${type1}/${type2}, STAB %s`, stab => {
      const s = new BattleState(); const attacker = pokemon(); const defender = pokemon();
      const move = getMove(moveId)!;
      attacker.volatiles.convertedType1 = 'DRAGON';
      attacker.volatiles.convertedType2 = stab ? move.type : 'DRAGON';
      defender.volatiles.convertedType1 = type1; defender.volatiles.convertedType2 = type2;
      s.wDamageMultipliers = 0xff; s.wMoveMissed = 1; s.wCriticalHitOrOHKO = 0xff;
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      const result = executeMoveDamageChain(s, attacker, defender, moveId, true);
      expect(result.effectiveness).toBe(effectiveness);
      expect(s.wDamageMultipliers).toBe(byte | (stab ? 0x80 : 0));
      expect(s.wDamage).toBe(result.damage);
      expect(s.wCriticalHitOrOHKO).toBe(0);
      expect(s.wMoveMissed).toBe(effectiveness === 0 ? 1 : 0);
      if (effectiveness === 0) expect(result.missed).toBe(false);
    });
  }
  it('keeps the four dead Psychic-defender rows dead (no numeric type remap)', () => {
    expect(getTypeChart().filter(row => row.defender === 'PSYCHIC_TYPE')).toHaveLength(4);
    const s = new BattleState(); const a = pokemon(); const d = pokemon('Abra');
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = executeMoveDamageChain(s, a, d, 'LICK', true);
    expect(result.effectiveness).toBe(1); expect(s.wDamageMultipliers).toBe(10);
  });
  it('STAB also matches attacker type 1, without doubling the type row', () => {
    const s = new BattleState(); const a = pokemon(); const d = pokemon();
    a.volatiles.convertedType1 = 'WATER'; a.volatiles.convertedType2 = 'NORMAL';
    d.volatiles.convertedType1 = 'FIRE'; d.volatiles.convertedType2 = 'FIRE';
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(executeMoveDamageChain(s, a, d, 'SURF', true).effectiveness).toBe(2);
    expect(s.wDamageMultipliers).toBe(0x94);
  });
  it('pins upstream quarter-effective minimum damage 1 rather than ASM floor-to-zero miss', () => {
    const s = new BattleState(); const a = pokemon(); const d = pokemon();
    a.level = 1; a.special = 1; d.special = 999;
    a.volatiles.convertedType1 = 'NORMAL'; a.volatiles.convertedType2 = 'NORMAL';
    d.volatiles.convertedType1 = 'WATER'; d.volatiles.convertedType2 = 'ROCK';
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = executeMoveDamageChain(s, a, d, 'EMBER', true);
    expect(result.damage).toBe(1); expect(s.wDamage).toBe(1);
    expect(s.wMoveMissed).toBe(0); expect(s.wDamageMultipliers).toBe(5);
  });
  it('writes a crit as 1, never an OHKO code, and clears it on the next move', () => {
    const s = new BattleState(); const a = pokemon(); const d = pokemon();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(executeMoveDamageChain(s, a, d, 'TACKLE', true).critical).toBe(true);
    expect(s.wCriticalHitOrOHKO).toBe(1);
    executeMoveDamageChain(s, a, d, 'GROWL', true);
    expect([s.wCriticalHitOrOHKO, s.wMoveMissed, s.wDamage, s.wDamageMultipliers]).toEqual([0, 0, 0, 10]);
  });
  it('keeps upstream accuracy/crit/range RNG order and passes skipAccuracy through', () => {
    const s = new BattleState(); const a = pokemon(); const d = pokemon();
    const rng = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    executeMoveDamageChain(s, a, d, 'TACKLE'); expect(rng).toHaveBeenCalledTimes(3);
    rng.mockClear(); executeMoveDamageChain(s, a, d, 'TACKLE', true); expect(rng).toHaveBeenCalledTimes(2);
    rng.mockReturnValue(255 / 256);
    executeMoveDamageChain(s, a, d, 'TACKLE');
    expect([s.wDamage, s.wMoveMissed, s.wCriticalHitOrOHKO]).toEqual([0, 1, 0]);
  });
  it('handles an unknown move through upstream missed result and fresh neutral byte', () => {
    const s = new BattleState(); s.wDamageMultipliers = 255;
    executeMoveDamageChain(s, pokemon(), pokemon(), 'MISSING');
    expect([s.wDamage, s.wMoveMissed, s.wDamageMultipliers]).toEqual([0, 1, 10]);
  });
});

describe('SelectEnemyMove', () => {
  it.each([0, 1, 2, 3, 4, 12, 13, 14, 15])('link nybble %i bypasses status and random', received => {
    const s = selection(); s.wLinkState = 4; s.wSerialExchangeNybbleReceiveData = received;
    s.wEnemyBattleStatus2 = 0x60; const rng = rolls(s, []);
    selectEnemyMove(s);
    expect(s.wEnemySelectedMove).toBe(received < 4 ? [10, 20, 30, 40][received] : received === 13 ? 255 : received === 14 ? STRUGGLE : 99);
    expect(s.wEnemyMoveListIndex).toBe(received < 4 ? received : 2);
    expect(rng).not.toHaveBeenCalled();
  });
  it.each([
    ['wEnemyBattleStatus2', 0x20], ['wEnemyBattleStatus2', 0x40],
    ['wEnemyBattleStatus1', 0x10], ['wEnemyBattleStatus1', 0x02],
    ['wEnemyMonStatus', 0x20], ['wEnemyMonStatus', 1], ['wEnemyMonStatus', 2], ['wEnemyMonStatus', 4],
    ['wEnemyBattleStatus1', 0x20], ['wEnemyBattleStatus1', 1],
  ] as const)('%s bit %i keeps the previous selection before player trap', (field, value) => {
    const s = selection(); s[field] = value; s.wPlayerBattleStatus1 = 0x20; const rng = rolls(s, []);
    selectEnemyMove(s); expect([s.wEnemySelectedMove, s.wEnemyMoveListIndex]).toEqual([99, 2]);
    expect(rng).not.toHaveBeenCalled();
  });
  it.each([0x08, 0x10, 0x40])('ordinary status %i allows selection', status => {
    const s = selection(); s.wEnemyMonStatus = status; rolls(s, [0]); selectEnemyMove(s);
    expect(s.wEnemySelectedMove).toBe(10);
  });
  it('player trapping stores FF and keeps the old index', () => {
    const s = selection(); s.wPlayerBattleStatus1 = 0x20; rolls(s, []); selectEnemyMove(s);
    expect([s.wEnemySelectedMove, s.wEnemyMoveListIndex]).toEqual([255, 2]);
  });
  it('one move and any nonzero disabled byte selects Struggle without changing index', () => {
    const s = selection(); s.mem[A.wEnemyMonMoves + 1] = 0; s.wEnemyDisabledMove = 1;
    rolls(s, []); selectEnemyMove(s); expect([s.wEnemySelectedMove, s.wEnemyMoveListIndex]).toEqual([165, 2]);
  });
  it('one non-disabled move selects normally', () => {
    const s = selection(); s.setBytes(A.wEnemyMonMoves, [10, 0, 0, 0], 4);
    rolls(s, [0]); selectEnemyMove(s); expect([s.wEnemySelectedMove, s.wEnemyMoveListIndex]).toEqual([10, 0]);
  });
  it.each([[0, 0], [62, 0], [63, 1], [126, 1], [127, 2], [189, 2], [190, 3], [255, 3]])
  ('wild random %i chooses slot %i', (roll, slot) => {
    const s = selection(); rolls(s, [roll]); selectEnemyMove(s);
    expect([s.wEnemyMoveListIndex, s.wEnemySelectedMove]).toEqual([slot, [10, 20, 30, 40][slot]]);
  });
  it('exhaustively counts bands 63/64/63/66', () => {
    const counts = [0, 0, 0, 0]; const s = selection();
    for (let value = 0; value < 256; value++) {
      rolls(s, [value]); selectEnemyMove(s); counts[s.wEnemyMoveListIndex]++;
    }
    expect(counts).toEqual([63, 64, 63, 66]);
  });
  it('retries disabled high nybble and empty slots; low nybble is duration', () => {
    const s = selection(); s.wEnemyDisabledMove = 0x2f; s.mem[A.wEnemyMonMoves + 2] = 0;
    const rng = rolls(s, [63, 127, 190]); selectEnemyMove(s);
    expect(rng).toHaveBeenCalledTimes(3);
    expect([s.wEnemySelectedMove, s.wEnemyMoveListIndex]).toEqual([40, 3]);
  });
  it('trainer with no modifications uses the WRAM move and BattleRandom band slot', () => {
    const s = selection(); s.wIsInBattle = 2; const rng = rolls(s, [63]);
    const enemy = pokemon(); const player = pokemon();
    enemy.moves = [{ id: 'GROWL', pp: 10, maxPp: 40 }, { id: 'TACKLE', pp: 10, maxPp: 35 }];
    s.setBytes(A.wEnemyMonMoves, [45, 33, 0, 0], 4);
    selectEnemyMove(s, { enemy, player, aiModifiers: [] });
    expect([s.wEnemySelectedMove, s.wEnemyMoveListIndex]).toEqual([33, 1]);
    expect(rng).toHaveBeenCalledTimes(1);
  });
  it('trainer moves at zero PP are still chosen instead of Struggle', () => {
    const s = selection(); s.wIsInBattle = 2;
    const enemy = pokemon(); enemy.moves = [{ id: 'TACKLE', pp: 0, maxPp: 35 }];
    s.setBytes(A.wEnemyMonMoves, [33, 0, 0, 0], 4);
    const rng = rolls(s, [0]);
    selectEnemyMove(s, { enemy, player: pokemon(), aiModifiers: [] });
    expect([s.wEnemySelectedMove, s.wEnemyMoveListIndex]).toEqual([33, 0]);
    expect(rng).toHaveBeenCalledTimes(1);
  });
  it('passes trainer modifiers and the player status into the unchanged body', () => {
    const s = selection(); s.wIsInBattle = 2; const rng = rolls(s, [0, 63]);
    const enemy = pokemon(); const player = pokemon(); player.status = 'PAR';
    enemy.moves = [{ id: 'THUNDER_WAVE', pp: 10, maxPp: 20 }, { id: 'TACKLE', pp: 10, maxPp: 35 }];
    s.setBytes(A.wEnemyMonMoves, [86, 33, 0, 0], 4);
    selectEnemyMove(s, { enemy, player, aiModifiers: [1] });
    expect([s.wEnemySelectedMove, s.wEnemyMoveListIndex]).toEqual([33, 1]);
    expect(s.bytes(A.wBuffer, 4).slice()).toEqual([0, 33, 0, 0]);
    expect(rng).toHaveBeenCalledTimes(2);
  });
  it('requires explicit trainer context', () => {
    const s = selection(); s.wIsInBattle = 2;
    expect(() => selectEnemyMove(s)).toThrow('trainer selection requires battle Pokemon');
  });
});

describe('MetronomePickMove', () => {
  it.each([0, 1, 255])('side %i rejects 0/165/255/118 and accepts 164', turn => {
    const s = new BattleState(); s.hWhoseTurn = turn;
    s.wBoostExpByExpAll = 55; s.wPlayerSelectedMove = 90; s.wEnemySelectedMove = 91;
    const rng = rolls(s, [0, 165, 255, 118, 164]);
    expect(metronomePickMove(s)).toBe(164); expect(rng).toHaveBeenCalledTimes(5);
    expect([s.wPlayerSelectedMove, s.wEnemySelectedMove]).toEqual(turn === 0 ? [164, 91] : [90, 164]);
    expect(s.wBoostExpByExpAll).toBe(0);
  });
  it('accepts 1, 117 and 119 directly, independent of the mon moves', () => {
    const s = new BattleState(); rolls(s, [1, 117, 119]);
    expect([metronomePickMove(s), metronomePickMove(s), metronomePickMove(s)]).toEqual([1, 117, 119]);
  });
});

describe('partySlotFromPokemon round trip', () => {
  it.each(['Rhydon', 'Abra', 'Bulbasaur'])('%s keeps real internal species, types, moves and current PP', name => {
    const s = new BattleState(); const mon = pokemon(name);
    mon.moves = [{ id: 'THUNDERSHOCK', pp: 5, maxPp: 30 }, { id: 'SURF', pp: 7, maxPp: 24 }];
    const packed = partySlotFromPokemon(mon);
    const expected = name === 'Rhydon' ? [1, 4, 5] : name === 'Abra' ? [148, 24, 24] : [153, 22, 3];
    expect([packed.species, packed.type1, packed.type2]).toEqual(expected);
    expect(packed.moves).toEqual([84, 57, 0, 0]);
    s.species = id => {
      expect(id).toBe(packed.species);
      return { name: mon.species.name, base: [1, 1, 1, 1, 1], type1: packed.type1, type2: packed.type2,
        catchRate: 45, baseExp: 64, moves: [0, 0, 0, 0], learnset: [] };
    };
    writePartySlot(s, 'player', 2, packed);
    s.wWhichPokemon = 2; s.wPlayerMonNumber = 2; s.wBattleMonSpecies2 = packed.species;
    loadBattleMonFromParty(s);
    expect(s.bytes(A.wBattleMonMoves, 4).slice()).toEqual([84, 57, 0, 0]);
    expect(s.bytes(A.wBattleMonPP, 4).slice()).toEqual([5, 7, 0, 0]);
    expect([s.wBattleMonSpecies, s.wBattleMonType1, s.wBattleMonType2]).toEqual(expected);
    expect(s.wBattleMonAttack).toBe(mon.attack); expect(s.wBattleMonHP).toBe(mon.currentHp);
  });
  it('does not invent PP Up counts from maxPp, and masks current PP to six bits', () => {
    const mon = pokemon(); mon.moves = [{ id: 'TACKLE', pp: 255, maxPp: 56 }];
    expect(partySlotFromPokemon(mon).pp).toEqual([63]);
  });
  it('rejects unknown types and unknown moves rather than silently packing zero', () => {
    const mon = pokemon(); mon.species = { ...mon.species, type1: 'INVALID' };
    expect(() => partySlotFromPokemon(mon)).toThrow('unknown party type');
    mon.species = { ...mon.species, type1: 'NORMAL' }; mon.moves = [{ id: 'INVALID', pp: 1, maxPp: 1 }];
    expect(() => partySlotFromPokemon(mon)).toThrow('unknown party move');
  });
});
