import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isPassPressed: () => false, isHeld: () => false }));
import { A, battleContext, BattleState, PARTYMON_STRUCT_LENGTH } from './battle_state';
import { createPokemon, getMove, loadBattleData } from './data';
import { aiEnemyTrainerChooseMoves, executeMoveDamageChain, selectEnemyMove, type TrainerMoveSelection } from './battle_math';
import { partySlotFromPokemon } from './battle_loaders';

beforeAll(loadBattleData);
afterEach(() => vi.restoreAllMocks());

it('packs move bytes from the loaded cache after the raw import is removed', () => {
  const mon = createPokemon('Pidgey', 50)!;
  mon.moves = [{ id: 'GUST', pp: 0, maxPp: 35 }, { id: 'SAND_ATTACK', pp: 7, maxPp: 15 }];
  const slot = partySlotFromPokemon(mon);
  expect(slot.moves).toEqual([16, 28, 0, 0]);
  expect(slot.pp).toEqual([0, 7]);
});

describe('checkpoint-04b damage type bypass', () => {
  it.each([
    ['Gastly', 'NIGHT_SHADE', 'Rattata'],
    ['Mankey', 'SEISMIC_TOSS', 'Gastly'],
    ['Mankey', 'COUNTER', 'Gastly'],
    ['Rattata', 'SUPER_FANG', 'Gastly'],
  ])('%s %s vs %s leaves the neutral byte and no type miss', (species, move, target) => {
    const a = createPokemon(species, 50)!;
    const d = createPokemon(target, 50)!;
    const s = new BattleState();
    s.wDamageMultipliers = 255;
    s.wMoveMissed = 1;
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = executeMoveDamageChain(s, a, d, move, true);
    expect(result.damage).toBe(0); // Unchanged upstream immunity; the audit owns its body.
    expect(result.missed).toBe(false);
    expect([s.wDamage, s.wDamageMultipliers, s.wMoveMissed]).toEqual([0, 10, 0]);
    expect(s.wCriticalHitOrOHKO).toBe(result.critical ? 1 : 0);
  });
  it('still records an accuracy miss for a set-damage move', () => {
    const a = createPokemon('Mankey', 50)!;
    const d = createPokemon('Gastly', 50)!;
    const s = new BattleState();
    vi.spyOn(Math, 'random').mockReturnValue(255 / 256);
    const result = executeMoveDamageChain(s, a, d, 'SEISMIC_TOSS');
    expect(result.missed).toBe(true);
    expect([s.wDamage, s.wDamageMultipliers, s.wMoveMissed]).toEqual([0, 10, 1]);
  });
  it('keeps ordinary STAB immunity and its type miss', () => {
    const a = createPokemon('Pikachu', 50)!;
    const d = createPokemon('Diglett', 50)!;
    const s = new BattleState();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    executeMoveDamageChain(s, a, d, 'THUNDERSHOCK', true);
    expect([s.wDamage, s.wDamageMultipliers, s.wMoveMissed]).toEqual([0, 0x80, 1]);
  });
});

function trainerRig(ids = ['GUST', 'SAND_ATTACK'], aiModifiers: number[] = []): {
  state: BattleState; trainer: TrainerMoveSelection;
} {
  const state = new BattleState();
  state.wIsInBattle = 2;
  const enemy = createPokemon('Pidgey', 50)!;
  const player = createPokemon('Pikachu', 50)!;
  enemy.moves = ids.map(id => ({ id, pp: 0, maxPp: 35 }));
  state.setBytes(A.wEnemyMonMoves, ids.map(id => getMove(id)!.id), 4);
  return { state, trainer: { enemy, player, aiModifiers } };
}

describe('checkpoint-04b trainer candidate list', () => {
  it('returns the original WRAM address without modifications and initializes four byte scores', () => {
    const { state, trainer } = trainerRig();
    expect(aiEnemyTrainerChooseMoves(state, trainer)).toBe(A.wEnemyMonMoves);
    expect(state.bytes(A.wBuffer, 4).slice()).toEqual([10, 10, 10, 10]);
    expect(state.bytes(A.wEnemyMonMoves, 4).slice()).toEqual([16, 28, 0, 0]);
  });
  it.each([1, 2, 3, 4])('disabled slot %i gets score 0x50 before any filtering', disabled => {
    const { state, trainer } = trainerRig(['GUST', 'SAND_ATTACK', 'TACKLE', 'QUICK_ATTACK']);
    state.wEnemyDisabledMove = (disabled << 4) | 7;
    expect(aiEnemyTrainerChooseMoves(state, trainer)).toBe(A.wEnemyMonMoves);
    const scores = [10, 10, 10, 10]; scores[disabled - 1] = 0x50;
    expect(state.bytes(A.wBuffer, 4).slice()).toEqual(scores);
  });
  it('ignores the disabled duration when the high nybble is zero', () => {
    const { state, trainer } = trainerRig(); state.wEnemyDisabledMove = 7;
    aiEnemyTrainerChooseMoves(state, trainer);
    expect(state.bytes(A.wBuffer, 4).slice()).toEqual([10, 10, 10, 10]);
  });
  it('keeps only minimum-score moves and zeroes missing slots', () => {
    const { state, trainer } = trainerRig(['THUNDER_WAVE', 'TACKLE'], [1]);
    trainer.player.status = 'PAR';
    expect(aiEnemyTrainerChooseMoves(state, trainer)).toBe(A.wBuffer);
    expect(state.bytes(A.wBuffer, 4).slice()).toEqual([0, 33, 0, 0]);
  });
  it('keeps every tied minimum, including 0-PP moves', () => {
    const { state, trainer } = trainerRig(['GUST', 'SAND_ATTACK', 'TACKLE', 'QUICK_ATTACK'], [4]);
    expect(aiEnemyTrainerChooseMoves(state, trainer)).toBe(A.wBuffer);
    expect(state.bytes(A.wBuffer, 4).slice()).toEqual([16, 28, 33, 98]);
  });
  it('does not let empty-slot scores undercut every existing move', () => {
    const { state, trainer } = trainerRig(['THUNDER_WAVE', 'SLEEP_POWDER'], [1]);
    trainer.player.status = 'PAR';
    aiEnemyTrainerChooseMoves(state, trainer);
    expect(state.bytes(A.wBuffer, 4).slice()).toEqual([86, 79, 0, 0]);
  });
  it('the disabled score excludes that slot from a modified tie', () => {
    const { state, trainer } = trainerRig(['GUST', 'SAND_ATTACK'], [4]);
    state.wEnemyDisabledMove = 0x17;
    aiEnemyTrainerChooseMoves(state, trainer);
    expect(state.bytes(A.wBuffer, 4).slice()).toEqual([0, 28, 0, 0]);
  });
  it('does not penalize a zero-PP move beside a positive-PP move in the scoring path', () => {
    const { state, trainer } = trainerRig(['GUST', 'SAND_ATTACK'], [4]);
    trainer.enemy.moves[1].pp = 10;
    aiEnemyTrainerChooseMoves(state, trainer);
    expect(state.bytes(A.wBuffer, 4).slice()).toEqual([16, 28, 0, 0]);
  });
  it('applies modifier 2 through the unchanged upstream body', () => {
    const { state, trainer } = trainerRig(['GUST', 'SAND_ATTACK'], [2]);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    aiEnemyTrainerChooseMoves(state, trainer);
    expect(state.bytes(A.wBuffer, 4).slice()).toEqual([0, 28, 0, 0]);
  });
  it('applies modifier 3 through the unchanged upstream body', () => {
    const { state, trainer } = trainerRig(['THUNDERSHOCK', 'TACKLE'], [3]);
    trainer.player = createPokemon('Squirtle', 50)!;
    aiEnemyTrainerChooseMoves(state, trainer);
    expect(state.bytes(A.wBuffer, 4).slice()).toEqual([84, 0, 0, 0]);
  });
  it('wraps scores as bytes during upstream writes, rather than after the whole dispatch', () => {
    const { state, trainer } = trainerRig(['THUNDER_WAVE', 'TACKLE'], Array<number>(50).fill(1));
    trainer.player.status = 'PAR'; // 10 + 50*5 = 260 -> byte 4, lower than Tackle's 10.
    aiEnemyTrainerChooseMoves(state, trainer);
    expect(state.bytes(A.wBuffer, 4).slice()).toEqual([86, 0, 0, 0]);
  });
  it.each([0, 1, 2, 3])('rejects a mismatching WRAM slot %i even without modifications', slot => {
    const { state, trainer } = trainerRig(); state.mem[A.wEnemyMonMoves + slot] = 255;
    expect(() => aiEnemyTrainerChooseMoves(state, trainer)).toThrow('enemy moves do not match wEnemyMonMoves');
  });
  it('rejects unknown move keys and more than four moves', () => {
    const { state, trainer } = trainerRig(); trainer.enemy.moves[0].id = 'INVALID';
    expect(() => aiEnemyTrainerChooseMoves(state, trainer)).toThrow('enemy moves do not match');
    trainer.enemy.moves = Array.from({ length: 5 }, () => ({ id: 'TACKLE', pp: 0, maxPp: 35 }));
    state.setBytes(A.wEnemyMonMoves, [33, 33, 33, 33], 4);
    expect(() => aiEnemyTrainerChooseMoves(state, trainer)).toThrow('enemy moves do not match');
  });
});

describe('checkpoint-04b palette dex views', () => {
  it.each([[153, 1], [0xa5, 19], [1, 112], [0x54, 25], [0, 0]])
  ('internal %i reads dex %i on both sides without writing $D11D', (internal, dex) => {
    const state = new BattleState();
    state.wPlayerMonNumber = 2;
    state.mem[A.wPartyMons + 2 * PARTYMON_STRUCT_LENGTH] = internal;
    state.mem[A.wPartyMons] = 1;
    state.wBattleMonSpecies = 0x54;
    state.wCurPartySpecies = 0x99;
    state.wEnemyMonSpecies2 = internal;
    state.wPokedexNum = 0x77;
    const view = battleContext(state);
    expect([view.partySpecies, view.enemySpecies2]).toEqual([dex, dex]);
    expect([state.wPokedexNum, state.wCurPartySpecies, state.wEnemyMonSpecies2]).toEqual([0x77, 0x99, internal]);
    state.wBattleMonSpecies = 0;
    expect(view.partySpecies).toBe(0);
    expect(state.wPokedexNum).toBe(0x77);
  });
});

function scriptedRolls(state: BattleState, values: number[]): ReturnType<typeof vi.fn> {
  const random = vi.fn(() => {
    const value = values.shift();
    if (value === undefined) throw new Error('unexpected BattleRandom call');
    return value;
  });
  state.random = random;
  return random;
}

describe('checkpoint-04b trainer band-loop integration', () => {
  it.each([{ aiModifiers: [] }, { aiModifiers: [4] }])('never picks the disabled move, modifiers $aiModifiers', ({ aiModifiers }) => {
    const { state, trainer } = trainerRig(['GUST', 'SAND_ATTACK'], aiModifiers);
    state.wEnemyDisabledMove = 0x17;
    const random = scriptedRolls(state, [0, 62, 63]);
    selectEnemyMove(state, trainer);
    expect([state.wEnemySelectedMove, state.wEnemyMoveListIndex]).toEqual([28, 1]);
    expect(random).toHaveBeenCalledTimes(3);
  });
  it('filtered and empty slots reroll while the band slot remains the index', () => {
    const { state, trainer } = trainerRig(['THUNDER_WAVE', 'TACKLE'], [1]);
    trainer.player.status = 'PAR';
    const random = scriptedRolls(state, [0, 127, 190, 63]);
    selectEnemyMove(state, trainer);
    expect([state.wEnemySelectedMove, state.wEnemyMoveListIndex]).toEqual([33, 1]);
    expect(random).toHaveBeenCalledTimes(4);
    expect(state.bytes(A.wBuffer, 4).slice()).toEqual([0, 33, 0, 0]);
  });
  it.each([[62, 0], [63, 1], [126, 1], [127, 2], [189, 2], [190, 3]])
  ('tied trainer roll %i uses slot %i', (roll, slot) => {
    const { state, trainer } = trainerRig(['GUST', 'SAND_ATTACK', 'TACKLE', 'QUICK_ATTACK'], [4]);
    const random = scriptedRolls(state, [roll]);
    selectEnemyMove(state, trainer);
    expect([state.wEnemySelectedMove, state.wEnemyMoveListIndex]).toEqual([[16, 28, 33, 98][slot], slot]);
    expect(random).toHaveBeenCalledTimes(1);
  });
  it('uses the seeded default BattleRandom seam with no Math.random selection', () => {
    const { state, trainer } = trainerRig();
    state.wEnemyDisabledMove = 0x11;
    state.hRandomAdd = 255;
    state.readDIV = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValueOnce(62).mockReturnValueOnce(0);
    const mathRandom = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Math.random selection'); });
    selectEnemyMove(state, trainer);
    expect([state.wEnemySelectedMove, state.wEnemyMoveListIndex, state.hRandomAdd]).toEqual([28, 1, 63]);
    expect(state.readDIV).toHaveBeenCalledTimes(4);
    expect(mathRandom).not.toHaveBeenCalled();
  });
  it('still uses Struggle for a sole disabled move, before invoking trainer scoring', () => {
    const { state, trainer } = trainerRig(['GUST']);
    state.wEnemyDisabledMove = 1;
    state.wEnemyMoveListIndex = 3;
    const random = scriptedRolls(state, []);
    selectEnemyMove(state, trainer);
    expect([state.wEnemySelectedMove, state.wEnemyMoveListIndex]).toEqual([165, 3]);
    expect(random).not.toHaveBeenCalled();
  });
  it('validates the model on the full trainer selection path', () => {
    const { state, trainer } = trainerRig(); state.mem[A.wEnemyMonMoves] = 33;
    expect(() => selectEnemyMove(state, trainer)).toThrow('enemy moves do not match');
  });
});
