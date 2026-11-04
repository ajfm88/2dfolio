import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isPassPressed: () => false, isHeld: () => false }));
import { A, battleContext, BattleState, PARTYMON_STRUCT_LENGTH } from './battle_state';
import { D } from './battle_end_state';
import { createPokemon, getMove, loadBattleData } from './data';
import { loadBattleMoveData } from './battle_move_data';
import { selectEnemyMove } from './battle_math';
import { AIEnemyTrainerChooseMoves } from './battle_ai_moves';
import { partySlotFromPokemon } from '../test/party_slot_fixture';

beforeAll(async () => {
  await loadBattleData();
  await loadBattleMoveData();
});
afterEach(() => vi.restoreAllMocks());

it('packs move bytes from the loaded cache after the raw import is removed', () => {
  const mon = createPokemon('Pidgey', 50)!;
  mon.moves = [{ id: 'GUST', pp: 0, maxPp: 35 }, { id: 'SAND_ATTACK', pp: 7, maxPp: 15 }];
  const slot = partySlotFromPokemon(mon);
  expect(slot.moves).toEqual([16, 28, 0, 0]);
  expect(slot.pp).toEqual([0, 7]);
});

// move_choices.asm. A list with no class (modification 4, a lone 2 or 3, fifty 1s) is YOUNGSTER.
const CLASS_FOR_LIST: Readonly<Record<string, number>> = {
  '': 1, '1': 2, '1,2': 8, '1,3': 4, '1,2,3': 7,
};

function trainerRig(ids = ['GUST', 'SAND_ATTACK'], aiModifiers: number[] = []): {
  state: BattleState;
} {
  const state = new BattleState();
  state.wIsInBattle = 2;
  state.mem[D.wTrainerClass] = CLASS_FOR_LIST[aiModifiers.join(',')] ?? 1;
  state.setBytes(A.wEnemyMonMoves, ids.map(id => getMove(id)!.id), 4);
  return { state };
}

describe('checkpoint-04b trainer candidate list', () => {
  it('returns the original WRAM address without modifications and initializes four byte scores', () => {
    const { state } = trainerRig();
    expect(AIEnemyTrainerChooseMoves(state)).toBe(A.wEnemyMonMoves);
    expect(state.bytes(A.wBuffer, 4).slice()).toEqual([10, 10, 10, 10]);
    expect(state.bytes(A.wEnemyMonMoves, 4).slice()).toEqual([16, 28, 0, 0]);
  });
  it.each([1, 2, 3, 4])('disabled slot %i gets score 0x50 before any filtering', disabled => {
    const { state } = trainerRig(['GUST', 'SAND_ATTACK', 'TACKLE', 'QUICK_ATTACK']);
    state.wEnemyDisabledMove = (disabled << 4) | 7;
    expect(AIEnemyTrainerChooseMoves(state)).toBe(A.wEnemyMonMoves);
    const scores = [10, 10, 10, 10]; scores[disabled - 1] = 0x50;
    expect(state.bytes(A.wBuffer, 4).slice()).toEqual(scores);
  });
  it('ignores the disabled duration when the high nybble is zero', () => {
    const { state } = trainerRig(); state.wEnemyDisabledMove = 7;
    AIEnemyTrainerChooseMoves(state);
    expect(state.bytes(A.wBuffer, 4).slice()).toEqual([10, 10, 10, 10]);
  });
  it('keeps only minimum-score moves and zeroes missing slots', () => {
    const { state } = trainerRig(['THUNDER_WAVE', 'TACKLE'], [1]);
    state.wBattleMonStatus = 0x40;
    // trainer_ai.asm:114–131: nonzero status adds 5 to power-0 PARALYZE_EFFECT.
    expect(AIEnemyTrainerChooseMoves(state)).toBe(A.wBuffer);
    expect(state.bytes(A.wBuffer, 4).slice()).toEqual([0, 33, 0, 0]);
  });
  it('keeps every tied minimum, including 0-PP moves', () => {
    const { state } = trainerRig(['GUST', 'SAND_ATTACK', 'TACKLE', 'QUICK_ATTACK'], [4]);
    // trainer_ai.asm:34–35 and :102–104. No list contains 4 (:258–259), so this is the empty list.
    expect(AIEnemyTrainerChooseMoves(state)).toBe(A.wEnemyMonMoves);
    expect(state.bytes(A.wBuffer, 4).slice()).toEqual([10, 10, 10, 10]);
  });
  it('does not let empty-slot scores undercut every existing move', () => {
    const { state } = trainerRig(['THUNDER_WAVE', 'SLEEP_POWDER'], [1]);
    state.wBattleMonStatus = 0x40;
    AIEnemyTrainerChooseMoves(state);
    expect(state.bytes(A.wBuffer, 4).slice()).toEqual([86, 79, 0, 0]);
  });
  it('the disabled score excludes that slot from a modified tie', () => {
    const { state } = trainerRig(['GUST', 'SAND_ATTACK'], [4]);
    state.wEnemyDisabledMove = 0x17;
    // trainer_ai.asm:18 writes $50, then the empty list returns without filtering (:102–104).
    AIEnemyTrainerChooseMoves(state);
    expect(state.bytes(A.wBuffer, 4).slice()).toEqual([0x50, 10, 10, 10]);
  });
  it('does not penalize a zero-PP move beside a positive-PP move in the scoring path', () => {
    const { state } = trainerRig(['GUST', 'SAND_ATTACK'], [4]);
    // trainer_ai.asm:102–104. The empty list never reads PP.
    AIEnemyTrainerChooseMoves(state);
    expect(state.bytes(A.wBuffer, 4).slice()).toEqual([10, 10, 10, 10]);
  });
  it('applies modifier 2 through the unchanged upstream body', () => {
    const { state } = trainerRig(['GUST', 'SAND_ATTACK'], [2]);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    // move_choices.asm has no lone 2. Encouragement stays 0, so :159–161 would return anyway.
    AIEnemyTrainerChooseMoves(state);
    expect(state.bytes(A.wBuffer, 4).slice()).toEqual([10, 10, 10, 10]);
  });
  it('applies modifier 3 through the unchanged upstream body', () => {
    const { state } = trainerRig(['THUNDERSHOCK', 'TACKLE'], [3]);
    // move_choices.asm: SAILOR is 1, 3. A lone 3 is the empty list (trainer_ai.asm:34–35).
    AIEnemyTrainerChooseMoves(state);
    expect(state.bytes(A.wBuffer, 4).slice()).toEqual([10, 10, 10, 10]);
  });
  it('wraps scores as bytes during upstream writes, rather than after the whole dispatch', () => {
    const { state } = trainerRig(['THUNDER_WAVE', 'TACKLE'], Array<number>(50).fill(1));
    // trainer_ai.asm:37–54 runs each list entry once. Fifty 1s is not a class list (:102–104).
    AIEnemyTrainerChooseMoves(state);
    expect(state.bytes(A.wBuffer, 4).slice()).toEqual([10, 10, 10, 10]);
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
    const { state } = trainerRig(['GUST', 'SAND_ATTACK'], aiModifiers);
    state.wEnemyDisabledMove = 0x17;
    const random = scriptedRolls(state, [0, 62, 63]);
    selectEnemyMove(state);
    expect([state.wEnemySelectedMove, state.wEnemyMoveListIndex]).toEqual([28, 1]);
    expect(random).toHaveBeenCalledTimes(3);
  });
  it('filtered and empty slots reroll while the band slot remains the index', () => {
    const { state } = trainerRig(['THUNDER_WAVE', 'TACKLE'], [1]);
    state.wBattleMonStatus = 0x40;
    // trainer_ai.asm:114–131: nonzero status filters power-0 PARALYZE_EFFECT (+5).
    const random = scriptedRolls(state, [0, 127, 190, 63]);
    selectEnemyMove(state);
    expect([state.wEnemySelectedMove, state.wEnemyMoveListIndex]).toEqual([33, 1]);
    expect(random).toHaveBeenCalledTimes(4);
    expect(state.bytes(A.wBuffer, 4).slice()).toEqual([0, 33, 0, 0]);
  });
  it.each([[62, 0], [63, 1], [126, 1], [127, 2], [189, 2], [190, 3]])
  ('tied trainer roll %i uses slot %i', (roll, slot) => {
    const { state } = trainerRig(['GUST', 'SAND_ATTACK', 'TACKLE', 'QUICK_ATTACK'], [4]);
    const random = scriptedRolls(state, [roll]);
    selectEnemyMove(state);
    expect([state.wEnemySelectedMove, state.wEnemyMoveListIndex]).toEqual([[16, 28, 33, 98][slot], slot]);
    expect(random).toHaveBeenCalledTimes(1);
  });
  it('uses the seeded default BattleRandom seam with no Math.random selection', () => {
    const { state } = trainerRig();
    state.wEnemyDisabledMove = 0x11;
    state.hRandomAdd = 255;
    state.readDIV = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValueOnce(62).mockReturnValueOnce(0);
    const mathRandom = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Math.random selection'); });
    selectEnemyMove(state);
    expect([state.wEnemySelectedMove, state.wEnemyMoveListIndex, state.hRandomAdd]).toEqual([28, 1, 63]);
    expect(state.readDIV).toHaveBeenCalledTimes(4);
    expect(mathRandom).not.toHaveBeenCalled();
  });
  it('still uses Struggle for a sole disabled move, before invoking trainer scoring', () => {
    const { state } = trainerRig(['GUST']);
    state.wEnemyDisabledMove = 1;
    state.wEnemyMoveListIndex = 3;
    const random = scriptedRolls(state, []);
    selectEnemyMove(state);
    expect([state.wEnemySelectedMove, state.wEnemyMoveListIndex]).toEqual([165, 3]);
    expect(random).not.toHaveBeenCalled();
  });
});
