import { describe, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isPassPressed: () => false, isHeld: () => false }));
import type { MoveMenuHost } from './battle_menu_context';
import { getMaxPP } from './move_selection_menu';
import {
  A, battleContext, BattleState, charmapByte, encodeText, GHOST_PIC, isGhostBattle, MON_GHOST,
  NAME_LENGTH, PARTYMON_STRUCT_LENGTH, POKEDEX_ORDER, POKEMON_TOWER_1F, POKEMON_TOWER_7F,
  RESTLESS_SOUL, SILPH_SCOPE, STRUGGLE, WILD_BATTLE, TRAINER_BATTLE, LINK_STATE_BATTLING,
  type SpeciesHeader,
} from './battle_state';
import {
  applyBadgeStatBoosts, applyBurnAndParalysisPenaltiesToEnemy, applyBurnAndParalysisPenaltiesToPlayer,
  decrementPP, incrementMovePP, initWildBattle, loadBattleMonFromParty, loadEnemyMonData,
  loadEnemyMonFromParty, partySlotFromPokemon, readPlayerMonCurHPAndStatus, writePartySlot,
  type PartySlot,
} from './battle_loaders';
import type { BattlePokemon } from './types';

const PAR = 0x40;
const BRN = 0x10;
const RAGE = 0x40;
const TRANSFORMED = 0x08;

function header(partial: Partial<SpeciesHeader> = {}): SpeciesHeader {
  return {
    name: 'RHYDON',
    base: [105, 130, 120, 40, 45],
    type1: 0x05,
    type2: 0x05,
    catchRate: 60,
    baseExp: 204,
    moves: [1, 0, 0, 0],
    learnset: [],
    ...partial,
  };
}

function slot(partial: Partial<PartySlot> = {}): PartySlot {
  return {
    species: 1, hp: 40, boxLevel: 7, status: 0, type1: 0x16, type2: 0x17, catchRate: 45,
    moves: [33, 34, 0, 0], dvs: [0x12, 0x34], pp: [10, 20, 0, 0], level: 50,
    maxHp: 80, attack: 70, defense: 60, speed: 40, special: 30, nickname: 'PIKACHU',
    ...partial,
  };
}

function rig(species: (id: number) => SpeciesHeader = () => header()): BattleState {
  const state = new BattleState();
  state.species = species;
  state.movePP = id => (id === 0 ? 0 : 35);
  return state;
}

function mon(level: number, extra: Partial<BattlePokemon> = {}): BattlePokemon {
  return {
    species: {
      id: 25, name: 'PIKACHU', hp: 35, attack: 55, defense: 30, speed: 90, special: 50,
      type1: 'ELECTRIC', type2: 'ELECTRIC', catchRate: 190, baseExp: 112, startMoves: [],
      growthRate: 'medium_fast', learnset: [], evolutions: [],
    },
    nickname: 'PIKA', level, currentHp: 20, maxHp: 24, attack: 18, defense: 14, speed: 20, special: 16,
    moves: [{ id: 'THUNDERSHOCK', pp: 5, maxPp: 30 }],
    statStages: { attack: 0, defense: 0, speed: 0, special: 0, accuracy: 0, evasion: 0 },
    status: null, atkDV: 9, defDV: 8, spdDV: 8, spcDV: 8, exp: 0, sleepTurns: 0, toxicCounter: 0,
    badlyPoisoned: false, volatiles: {} as BattlePokemon['volatiles'],
    originalStats: { attack: 18, defense: 14, speed: 20, special: 16 }, otName: 'RED', otId: 1,
    ...extra,
  };
}

const host = {
  getMove: () => ({ id: 1, name: 'POUND', type: 'NORMAL', pp: 35, power: 40, accuracy: 100, effect: 'NO_ADDITIONAL_EFFECT' }),
} as unknown as MoveMenuHost;

describe('union cells', () => {
  it('keeps every $D11D name on one byte', () => {
    const state = new BattleState();
    state.wUsingPPUp = 0;
    state.wMaxPP = 35;
    expect(state.wUsingPPUp).toBe(35);
    state.wNamedObjectIndex = 7;
    expect(state.wMaxPP).toBe(7);
    expect(state.wMoveType).toBe(7);
    expect(state.wTypeEffectiveness).toBe(7);
    expect(state.wCalculateWhoseStats).toBe(7);
    expect(state.wPokedexNum).toBe(7);
    expect(state.wMoveGrammar).toBe(7);
    expect(state.wPokeBallCaptureCalcTemp).toBe(7);
    expect(state.wPokeBallAnimData).toBe(7);
  });

  it('shares $CD6D across the name, the current PP and the PP-up byte at +6', () => {
    const state = new BattleState();
    state.wBattleMenuCurrentPP = 0x8f;
    expect(state.mem[A.wNameBuffer]).toBe(0x8f);
    state.mem[A.wNameBuffer + 6] = 0x55;
    expect(state.wPPUpCountAndMaxPP).toBe(0x55);
    expect(state.wBattleMenuCurrentPP).toBe(0x8f);
  });

  it('shares $CF4A, $CC5B and the Bide low byte', () => {
    const state = new BattleState();
    state.mem[A.wStringBuffer] = 0xab;
    expect(state.wExpAmountGained & 0xff).toBe(0xab);
    state.wGainBoostedExp = 9;
    expect(state.mem[A.wStringBuffer + 2]).toBe(9);
    state.wAnimationType = 3;
    expect(state.wBoostExpByExpAll).toBe(3);
    state.wPlayerBideAccumulatedDamage = 0x0205;
    expect(state.wPlayerNumHits).toBe(5);
    state.wEnemyNumHits = 4;
    expect(state.wEnemyBideAccumulatedDamage & 0xff).toBe(4);
  });

  it('$CF90 is the numeric species byte, and the view string is not that cell', () => {
    const state = rig();
    const view = battleContext(state);
    view.curItem = 'POTION';
    view.itemIndex = 4;
    expect(state.wCurPartySpecies).toBe(0);
    expect(state.wCurItem).toBe(0);
    state.wCurListMenuItem = 0x54;
    expect(view.curPartySpecies).toBe(0x54);
    expect(view.curItem).toBe('POTION');
    expect(view.itemIndex).toBe(4);
  });
});

describe('context view', () => {
  it('reads partySpecies the way SET_PAL_BATTLE does, not from $CF90', () => {
    const state = rig();
    writePartySlot(state, 'player', 2, slot({ species: 0x54 }));
    state.wPlayerMonNumber = 2;
    state.wBattleMonSpecies = 0x54;
    state.wCurPartySpecies = 0x99;
    const view = battleContext(state);
    expect(view.partySpecies).toBe(0x54);
    state.wBattleMonSpecies = 0;
    expect(view.partySpecies).toBe(0);
    expect(view.curPartySpecies).toBe(0x99);
  });

  it('writes battle moves and names through to the cells', () => {
    const state = rig();
    const view = battleContext(state);
    view.battleMoves = [1, 2, 3, 4];
    view.battlePP = [9, 8, 7, 6];
    [view.battleMoves[0], view.battleMoves[1]] = [view.battleMoves[1], view.battleMoves[0]];
    expect([...state.bytes(A.wBattleMonMoves, 4)]).toEqual([2, 1, 3, 4]);
    state.setBytes(A.wPlayerName, encodeText('RED@'), NAME_LENGTH);
    expect(view.playerName.slice(0, 4)).toEqual(encodeText('RED@'));
    view.linkEnemyTrainerName = view.playerName.slice(0, 11);
    expect(state.mem[A.wLinkEnemyTrainerName]).toBe(charmapByte('R'));
  });

  it('leaves usingPPUp equal to maxPP after getMaxPP (item_effects.asm:2802-2807)', () => {
    const state = rig();
    const view = battleContext(state);
    view.battleMoves = [1, 0, 0, 0];
    view.battlePP = [5, 0, 0, 0];
    getMaxPP(view, 0, host);
    expect(view.maxPP).toBe(35);
    expect(view.usingPPUp).toBe(view.maxPP);
    expect(state.wUsingPPUp).toBe(state.wMaxPP);
    state.wMoveType = 7;
    expect(view.usingPPUp).toBe(7);
    expect(view.maxPP).toBe(7);
  });
});

describe('LoadBattleMonFromParty', () => {
  it('copies the box-level byte and the nick of wPlayerMonNumber', () => {
    const state = rig(id => header({ name: id === 2 ? 'PIDGEY' : 'RHYDON' }));
    writePartySlot(state, 'player', 0, slot({ nickname: 'AAAA', species: 1, boxLevel: 7, level: 50 }));
    writePartySlot(state, 'player', 1, slot({ nickname: 'BBBB', species: 3 }));
    state.wWhichPokemon = 0;
    state.wPlayerMonNumber = 1;
    state.wBattleMonSpecies2 = 2;
    state.mem.fill(0xee, A.wEnemyMonBaseStats, A.wEnemyMonBaseStats + 5);
    loadBattleMonFromParty(state);
    expect(state.wBattleMonSpecies).toBe(1);
    expect(state.wBattleMonPartyPos).toBe(7);
    expect(state.wBattleMonLevel).toBe(50);
    expect(state.mem[A.wBattleMonDVs]).toBe(0x12);
    expect(state.mem[A.wBattleMonDVs + 1]).toBe(0x34);
    expect([...state.bytes(A.wBattleMonMoves, 4)]).toEqual([33, 34, 0, 0]);
    expect([...state.bytes(A.wBattleMonPP, 4)]).toEqual([10, 20, 0, 0]);
    expect(state.wBattleMonAttack).toBe(70);
    expect([...state.bytes(A.wBattleMonNick, 4)]).toEqual(encodeText('BBBB'));
    expect(state.wCurSpecies).toBe(2);
    expect(state.mem[A.wMonHIndex]).toBe(2);
    expect(state.readBE(A.wPlayerMonUnmodifiedLevel + 3)).toBe(70);
    expect(state.hWhoseTurn).toBe(1);
    expect([...state.bytes(A.wPlayerMonStatMods, 8)]).toEqual([7, 7, 7, 7, 7, 7, 7, 7]);
    expect([...state.bytes(A.wEnemyMonBaseStats, 5)]).toEqual([0xee, 0xee, 0xee, 0xee, 0xee]);
  });

  it('halves burn, then applies the Boulder boost, and leaves the unmodified block', () => {
    const state = rig();
    writePartySlot(state, 'player', 0, slot({ status: BRN, attack: 80, boxLevel: 12 }));
    state.wWhichPokemon = 0;
    state.wPlayerMonNumber = 0;
    state.wBattleMonSpecies2 = 1;
    state.wObtainedBadges = 0x01;
    loadBattleMonFromParty(state);
    expect(state.wBattleMonAttack).toBe(45);
    expect(state.readBE(A.wPlayerMonUnmodifiedLevel + 3)).toBe(80);
    expect(state.wBattleMonPartyPos).toBe(12);
    expect(state.mem[A.wPartyMons + 36]).toBe(0);
    expect(state.mem[A.wPartyMons + 37]).toBe(80);
  });
});

describe('LoadEnemyMonFromParty', () => {
  it('overwrites the party-pos byte with the slot and does not boost badges', () => {
    const state = rig();
    writePartySlot(state, 'enemy', 3, slot({ nickname: 'ENEMY', boxLevel: 7, attack: 80, status: BRN }));
    writePartySlot(state, 'enemy', 0, slot({ nickname: 'OTHER' }));
    state.wWhichPokemon = 3;
    state.wEnemyMonSpecies2 = 9;
    state.wObtainedBadges = 0xff;
    state.wBattleMonAttack = 80;
    loadEnemyMonFromParty(state);
    expect(state.wEnemyMonPartyPos).toBe(3);
    expect(state.wEnemyMonSpecies).toBe(1);
    expect(state.wCurSpecies).toBe(1);
    expect([...state.bytes(A.wEnemyMonNick, 5)]).toEqual(encodeText('ENEMY'));
    expect(state.wEnemyMonAttack).toBe(40);
    expect(state.wBattleMonAttack).toBe(80);
    expect(state.readBE(A.wEnemyMonUnmodifiedLevel + 3)).toBe(80);
    expect(state.hWhoseTurn).toBe(0);
    expect([...state.bytes(A.wEnemyMonBaseStats, 5)]).toEqual([105, 130, 120, 40, 45]);
    expect([...state.bytes(A.wEnemyMonStatMods, 8)]).toEqual([7, 7, 7, 7, 7, 7, 7, 7]);
  });
});

describe('LoadEnemyMonData', () => {
  const rh = header();

  it('gives a trainer the fixed DVs, party HP and base PP, and does not penalize', () => {
    const state = rig();
    let rolls = 0;
    state.random = () => { rolls++; return 1; };
    writePartySlot(state, 'enemy', 1, slot({ hp: 12, status: BRN, level: 9, moves: [33, 0, 0, 0], pp: [4, 0, 0, 0] }));
    state.wIsInBattle = TRAINER_BATTLE;
    state.wWhichPokemon = 1;
    state.wEnemyMonSpecies2 = 1;
    state.wCurEnemyLevel = 50;
    state.hWhoseTurn = 0x5a;
    loadEnemyMonData(state);
    expect(rolls).toBe(0);
    expect([...state.bytes(A.wEnemyMonDVs, 2)]).toEqual([0x98, 0x88]);
    expect(state.wEnemyMonHP).toBe(12);
    expect(state.wEnemyMonMaxHP).toBe(173);
    expect(state.wEnemyMonAttack).toBe(144);
    expect(state.wEnemyMonDefense).toBe(133);
    expect(state.wEnemyMonSpeed).toBe(53);
    expect(state.wEnemyMonSpecial).toBe(58);
    expect(state.wEnemyMonStatus).toBe(BRN);
    expect(state.wEnemyMonPartyPos).toBe(1);
    expect(state.wEnemyMonLevel).toBe(50);
    expect([...state.bytes(A.wEnemyMonMoves, 4)]).toEqual([33, 0, 0, 0]);
    expect([...state.bytes(A.wEnemyMonPP, 4)]).toEqual([35, 0, 0, 0]);
    expect(state.hWhoseTurn).toBe(0x5a);
    expect(state.wEnemyMonType1).toBe(rh.type1);
    expect(state.wPokedexNum).toBe(112);
    expect(state.wBattleMenuCurrentPP).toBe(charmapByte('R'));
    expect(state.wPPUpCountAndMaxPP).toBe(0x50);
    expect(state.mem[A.wPokedexSeen + 13] & 0x80).toBe(0x80);
    expect(state.readBE(A.wEnemyMonUnmodifiedLevel + 3)).toBe(144);
  });

  it('stores the second wild random byte first and learns moves from wCurPartySpecies', () => {
    const calls: number[] = [];
    const state = rig(id => header({
      moves: [10, 0, 0, 0] as [number, number, number, number],
      learnset: id === 4
        ? [{ level: 1, move: 10 }, { level: 1, move: 77 }]
        : [{ level: 5, move: 10 }, { level: 16, move: 20 }, { level: 100, move: 30 }],
    }));
    state.random = () => { const value = [0xab, 0xcd][calls.length] ?? 0; calls.push(value); return value; };
    state.wIsInBattle = WILD_BATTLE;
    state.wEnemyMonSpecies2 = 1;
    state.wCurPartySpecies = 4;
    state.wCurEnemyLevel = 50;
    state.wEnemyMonPartyPos = 0x3c;
    state.wEnemyMonStatus = 0xff;
    state.hWhoseTurn = 0x5a;
    loadEnemyMonData(state);
    expect(calls).toEqual([0xab, 0xcd]);
    expect([...state.bytes(A.wEnemyMonDVs, 2)]).toEqual([0xcd, 0xab]);
    expect(state.wEnemyMonHP).toBe(state.wEnemyMonMaxHP);
    expect(state.wEnemyMonHP).toBe(170);
    expect(state.wEnemyMonAttack).toBe(147);
    expect(state.wEnemyMonStatus).toBe(0);
    expect(state.wEnemyMonPartyPos).toBe(0x3c);
    expect([...state.bytes(A.wEnemyMonMoves, 4)]).toEqual([10, 77, 0, 0]);
    expect([...state.bytes(A.wEnemyMonPP, 2)]).toEqual([35, 35]);
    expect(state.hWhoseTurn).toBe(0x5a);
    expect(state.wEnemyMonActualCatchRate).toBe(60);
    expect(state.wEnemyMonBaseExp).toBe(204);
  });

  it('shifts a full wild learnset and stops above the level', () => {
    const state = rig(() => header({
      moves: [10, 11, 12, 13],
      learnset: [{ level: 1, move: 99 }, { level: 100, move: 50 }],
    }));
    state.random = () => 0;
    state.wIsInBattle = WILD_BATTLE;
    state.wEnemyMonSpecies2 = 1;
    state.wCurPartySpecies = 1;
    state.wCurEnemyLevel = 10;
    loadEnemyMonData(state);
    expect([...state.bytes(A.wEnemyMonMoves, 4)]).toEqual([11, 12, 13, 99]);
  });

  it('keeps transformed DVs and skips wild HP init', () => {
    const state = rig();
    let rolls = 0;
    state.random = () => { rolls++; return 9; };
    state.wIsInBattle = WILD_BATTLE;
    state.wEnemyBattleStatus3 = TRANSFORMED;
    state.mem[A.wTransformedEnemyMonOriginalDVs] = 0x12;
    state.mem[A.wTransformedEnemyMonOriginalDVs + 1] = 0x34;
    state.wEnemyMonSpecies2 = 1;
    state.wCurPartySpecies = 1;
    state.wCurEnemyLevel = 50;
    state.wEnemyMonHP = 0x1234;
    state.wEnemyMonStatus = PAR;
    loadEnemyMonData(state);
    expect(rolls).toBe(0);
    expect([...state.bytes(A.wEnemyMonDVs, 2)]).toEqual([0x12, 0x34]);
    expect(state.wEnemyMonHP).toBe(0x1234);
    expect(state.wEnemyMonStatus).toBe(PAR);
    expect(state.wEnemyMonType1).toBe(0x05);
  });

  it('keeps transformed DVs on a trainer and still copies party HP', () => {
    const state = rig();
    writePartySlot(state, 'enemy', 2, slot({ hp: 15, status: PAR }));
    state.wIsInBattle = TRAINER_BATTLE;
    state.wWhichPokemon = 2;
    state.wEnemyBattleStatus3 = TRANSFORMED;
    state.mem[A.wTransformedEnemyMonOriginalDVs] = 0x12;
    state.mem[A.wTransformedEnemyMonOriginalDVs + 1] = 0x34;
    state.wEnemyMonSpecies2 = 1;
    state.wCurEnemyLevel = 50;
    loadEnemyMonData(state);
    expect([...state.bytes(A.wEnemyMonDVs, 2)]).toEqual([0x12, 0x34]);
    expect(state.wEnemyMonHP).toBe(15);
    expect(state.wEnemyMonStatus).toBe(PAR);
    expect(state.wEnemyMonPartyPos).toBe(2);
    expect(state.wEnemyMonAttack).not.toBe(70);
  });

  it('sends a link battle through the party copy', () => {
    const state = rig();
    let rolls = 0;
    state.random = () => { rolls++; return 1; };
    writePartySlot(state, 'enemy', 1, slot({ species: 4, pp: [9, 8, 7, 6], nickname: 'LINKY' }));
    state.wLinkState = LINK_STATE_BATTLING;
    state.wIsInBattle = TRAINER_BATTLE;
    state.wWhichPokemon = 1;
    state.wEnemyMonSpecies2 = 1;
    state.wMaxPP = 0x44;
    loadEnemyMonData(state);
    expect(rolls).toBe(0);
    expect(state.wEnemyMonSpecies).toBe(4);
    expect([...state.bytes(A.wEnemyMonPP, 4)]).toEqual([9, 8, 7, 6]);
    expect(state.wEnemyMonPartyPos).toBe(1);
    expect(state.wMaxPP).toBe(0x44);
    expect(state.mem[A.wPokedexSeen]).toBe(0);
    expect([...state.bytes(A.wEnemyMonNick, 5)]).toEqual(encodeText('LINKY'));
  });
});

describe('ghost', () => {
  function wild(map: number, scope: number | null): BattleState {
    const state = rig(() => header({ name: 'MAROWAK' }));
    state.random = () => 0;
    state.wCurMap = map;
    state.wCurOpponent = 0;
    state.wEnemyMonSpecies2 = 1;
    state.wCurPartySpecies = 0x22;
    state.wCurEnemyLevel = 30;
    if (scope !== null) state.setBag([{ id: SILPH_SCOPE, quantity: scope }]);
    return state;
  }

  it('returns Z only for a wild tower battle with no Silph Scope', () => {
    const state = wild(POKEMON_TOWER_1F, null);
    state.wIsInBattle = WILD_BATTLE;
    expect(isGhostBattle(state)).toBe(true);
    state.wCurMap = POKEMON_TOWER_7F;
    expect(isGhostBattle(state)).toBe(true);
    state.wCurMap = POKEMON_TOWER_1F - 1;
    expect(isGhostBattle(state)).toBe(false);
    state.wCurMap = POKEMON_TOWER_7F + 1;
    expect(isGhostBattle(state)).toBe(false);
    state.wCurMap = POKEMON_TOWER_1F;
    state.setBag([{ id: SILPH_SCOPE, quantity: 1 }]);
    expect(isGhostBattle(state)).toBe(false);
    state.setBag([{ id: SILPH_SCOPE, quantity: 0 }]);
    expect(isGhostBattle(state)).toBe(true);
    state.wIsInBattle = TRAINER_BATTLE;
    expect(isGhostBattle(state)).toBe(false);
  });

  it('overwrites the nick for RESTLESS_SOUL without asking the scope', () => {
    const state = wild(0, 1);
    state.wCurOpponent = RESTLESS_SOUL;
    initWildBattle(state);
    expect(state.frontPic).toBe('ghost');
    expect(state.frontPicSpecies).toBe(MON_GHOST);
    expect(state.wCurPartySpecies).toBe(0x22);
    expect(state.wMonHSpriteDim).toBe(0x66);
    expect(state.mem[A.wMonHSpriteDim + 1]).toBe(GHOST_PIC & 0xff);
    expect(state.mem[A.wMonHSpriteDim + 2]).toBe(GHOST_PIC >> 8);
    const tail = [...encodeText('MAROWAK@').slice(6), 0, 0, 0];
    expect([...state.bytes(A.wEnemyMonNick, 11)]).toEqual([...encodeText('GHOST@'), ...tail]);
    expect(state.wPokedexNum).toBe(112);
  });

  it('overwrites a tower ghost and leaves a scoped mon named', () => {
    const ghost = wild(POKEMON_TOWER_1F, null);
    initWildBattle(ghost);
    expect(ghost.frontPic).toBe('ghost');
    expect([...ghost.bytes(A.wEnemyMonNick, 6)]).toEqual(encodeText('GHOST@'));
    const plain = wild(0, null);
    initWildBattle(plain);
    expect(plain.frontPic).toBe('mon');
    expect(plain.frontPicSpecies).toBe(0x22);
    expect([...plain.bytes(A.wEnemyMonNick, 8)]).toEqual(encodeText('MAROWAK@'));
    expect(plain.wMonHSpriteDim).toBe(0);
  });
});

describe('penalties and badges', () => {
  it('quarters the player when hWhoseTurn is 1 and the enemy when it is 0', () => {
    const state = new BattleState();
    state.wBattleMonSpeed = 40;
    state.wBattleMonStatus = PAR;
    state.writeBE(A.wPlayerMonUnmodifiedLevel + 7, 40);
    state.wEnemyMonSpeed = 40;
    applyBurnAndParalysisPenaltiesToPlayer(state);
    expect(state.hWhoseTurn).toBe(1);
    expect(state.wBattleMonSpeed).toBe(10);
    expect(state.wEnemyMonSpeed).toBe(40);
    expect(state.readBE(A.wPlayerMonUnmodifiedLevel + 7)).toBe(40);
    state.wEnemyMonStatus = PAR;
    applyBurnAndParalysisPenaltiesToEnemy(state);
    expect(state.hWhoseTurn).toBe(0);
    expect(state.wEnemyMonSpeed).toBe(10);
    expect(state.wBattleMonSpeed).toBe(10);
  });

  it('ignores sleep, floors at 1, and halves burn attack', () => {
    const state = new BattleState();
    state.wBattleMonSpeed = 40;
    state.wBattleMonStatus = 0x07;
    applyBurnAndParalysisPenaltiesToPlayer(state);
    expect(state.wBattleMonSpeed).toBe(40);
    state.wBattleMonStatus = PAR;
    state.wBattleMonSpeed = 0;
    state.wBattleMonAttack = 0;
    state.wBattleMonStatus = PAR | BRN;
    applyBurnAndParalysisPenaltiesToPlayer(state);
    expect(state.wBattleMonSpeed).toBe(1);
    expect(state.wBattleMonAttack).toBe(1);
    state.wEnemyMonAttack = 5;
    state.wEnemyMonStatus = BRN;
    applyBurnAndParalysisPenaltiesToEnemy(state);
    expect(state.wEnemyMonAttack).toBe(2);
    expect(state.wBattleMonAttack).toBe(1);
  });

  it('boosts even badge bits on the battle copy and caps at 999', () => {
    const state = new BattleState();
    state.wLinkState = LINK_STATE_BATTLING;
    state.wBattleMonAttack = 80;
    state.wObtainedBadges = 0x01;
    applyBadgeStatBoosts(state);
    expect(state.wBattleMonAttack).toBe(80);
    state.wLinkState = 0;
    state.wObtainedBadges = 0x02;
    applyBadgeStatBoosts(state);
    expect(state.wBattleMonAttack).toBe(80);
    state.wObtainedBadges = 0x01;
    state.wBattleMonAttack = 8;
    applyBadgeStatBoosts(state);
    expect(state.wBattleMonAttack).toBe(9);
    state.wBattleMonAttack = 998;
    applyBadgeStatBoosts(state);
    expect(state.wBattleMonAttack).toBe(999);
    state.wBattleMonAttack = 887;
    applyBadgeStatBoosts(state);
    expect(state.wBattleMonAttack).toBe(997);
    state.wBattleMonAttack = 16;
    state.wBattleMonDefense = 16;
    state.wBattleMonSpeed = 16;
    state.wBattleMonSpecial = 16;
    state.wEnemyMonAttack = 16;
    state.wObtainedBadges = 0x55;
    applyBadgeStatBoosts(state);
    expect(state.wBattleMonAttack).toBe(18);
    expect(state.wBattleMonDefense).toBe(18);
    expect(state.wBattleMonSpeed).toBe(18);
    expect(state.wBattleMonSpecial).toBe(18);
    expect(state.wEnemyMonAttack).toBe(16);
  });
});

describe('write-back', () => {
  it('has no box-level field and round-trips the four party bytes', () => {
    const state = rig();
    const active = mon(50, { currentHp: 20 });
    expect('boxLevel' in active).toBe(false);
    state.partyMons[1] = active;
    writePartySlot(state, 'player', 1, partySlotFromPokemon(active));
    expect(state.mem[A.wPartyMons + PARTYMON_STRUCT_LENGTH + 3]).toBe(50);
    state.wWhichPokemon = 1;
    state.wPlayerMonNumber = 1;
    state.wBattleMonSpecies2 = 1;
    loadBattleMonFromParty(state);
    expect(state.wBattleMonPartyPos).toBe(50);
    state.wWhichPokemon = 0;
    state.wBattleMonHP = 11;
    state.wBattleMonPartyPos = 9;
    state.wBattleMonStatus = PAR;
    const levelBefore = active.level;
    readPlayerMonCurHPAndStatus(state);
    expect(active.currentHp).toBe(11);
    expect(active.level).toBe(levelBefore);
    expect(active.status).toBe('PAR');
    expect('boxLevel' in active).toBe(false);
    const base = A.wPartyMons + PARTYMON_STRUCT_LENGTH;
    expect([...state.bytes(base + 1, 4)]).toEqual([0x00, 11, 9, PAR]);
    expect(state.mem[base + 33]).toBe(50);
    expect(state.mem[A.wPartyMons + 1]).toBe(0);
    state.wBattleMonStatus = PAR | 0x03;
    readPlayerMonCurHPAndStatus(state);
    expect(active.status).toBe('PAR');
    expect(active.sleepTurns).toBe(0);
  });

  it('copies a raw box level that is not the level', () => {
    const state = rig();
    writePartySlot(state, 'player', 0, slot({ boxLevel: 7, level: 50 }));
    state.wWhichPokemon = 0;
    state.wPlayerMonNumber = 0;
    state.wBattleMonSpecies2 = 1;
    loadBattleMonFromParty(state);
    expect(state.wBattleMonPartyPos).toBe(7);
    expect(state.wBattleMonLevel).toBe(50);
  });

  it('skips Struggle, the status1 mask, Rage and a transformed party', () => {
    const state = new BattleState();
    state.wPlayerMoveListIndex = 2;
    state.wPlayerMonNumber = 1;
    state.mem[A.wBattleMonPP + 2] = 5;
    state.mem[A.wPartyMons + PARTYMON_STRUCT_LENGTH + 29 + 2] = 5;
    const active = mon(10);
    state.partyMons[1] = active;
    decrementPP(state, STRUGGLE);
    expect(state.mem[A.wBattleMonPP + 2]).toBe(5);
    for (const bit of [0x01, 0x02, 0x04]) {
      state.wPlayerBattleStatus1 = bit;
      decrementPP(state, 33);
      expect(state.mem[A.wBattleMonPP + 2]).toBe(5);
    }
    state.wPlayerBattleStatus1 = 0x08;
    state.wPlayerBattleStatus2 = RAGE;
    decrementPP(state, 33);
    expect(state.mem[A.wBattleMonPP + 2]).toBe(5);
    state.wPlayerBattleStatus2 = 0;
    state.wPlayerBattleStatus3 = TRANSFORMED;
    decrementPP(state, 33);
    expect(state.mem[A.wBattleMonPP + 2]).toBe(4);
    expect(state.mem[A.wPartyMons + PARTYMON_STRUCT_LENGTH + 29 + 2]).toBe(5);
    state.wPlayerBattleStatus3 = 0;
    state.mem[A.wBattleMonPP + 2] = 0;
    state.mem[A.wPartyMons + PARTYMON_STRUCT_LENGTH + 29 + 2] = 0;
    decrementPP(state, 33);
    expect(state.mem[A.wBattleMonPP + 2]).toBe(0xff);
    expect(state.mem[A.wPartyMons + PARTYMON_STRUCT_LENGTH + 29 + 2]).toBe(0xff);
    expect(active.moves[2]).toBeUndefined();
  });

  it('decrements the selected party slot and mirrors the low PP bits', () => {
    const state = new BattleState();
    const active = mon(10, { moves: [
      { id: 'A', pp: 5, maxPp: 5 }, { id: 'B', pp: 5, maxPp: 5 },
      { id: 'C', pp: 5, maxPp: 5 }, { id: 'D', pp: 5, maxPp: 5 },
    ] });
    state.partyMons[0] = active;
    state.wPlayerMonNumber = 0;
    state.wPlayerMoveListIndex = 1;
    state.mem[A.wBattleMonPP + 1] = 5;
    state.mem[A.wPartyMons + 29 + 1] = 5;
    state.mem[A.wBattleMonPP] = 9;
    decrementPP(state, 10);
    expect(state.mem[A.wBattleMonPP + 1]).toBe(4);
    expect(state.mem[A.wPartyMons + 29 + 1]).toBe(4);
    expect(state.mem[A.wBattleMonPP]).toBe(9);
    expect(active.moves[1].pp).toBe(4);
  });

  it('increments the player or the enemy slot named by the turn byte', () => {
    const state = new BattleState();
    state.hWhoseTurn = 0;
    state.wPlayerMonNumber = 1;
    state.wPlayerMoveListIndex = 0;
    state.wEnemyMonPartyPos = 0;
    state.mem[A.wBattleMonPP] = 4;
    state.mem[A.wPartyMons + PARTYMON_STRUCT_LENGTH + 29] = 4;
    const active = mon(4, { moves: [{ id: 'A', pp: 4, maxPp: 4 }] });
    state.partyMons[1] = active;
    incrementMovePP(state);
    expect(state.mem[A.wBattleMonPP]).toBe(5);
    expect(state.mem[A.wPartyMons + PARTYMON_STRUCT_LENGTH + 29]).toBe(5);
    expect(active.moves[0].pp).toBe(5);
    state.hWhoseTurn = 1;
    state.wEnemyMoveListIndex = 1;
    state.wEnemyMonPartyPos = 2;
    state.mem[A.wEnemyMonPP + 1] = 4;
    state.mem[A.wEnemyMons + 2 * PARTYMON_STRUCT_LENGTH + 29 + 1] = 4;
    state.mem[A.wEnemyMons + 29 + 1] = 9;
    incrementMovePP(state);
    expect(state.mem[A.wEnemyMonPP + 1]).toBe(5);
    expect(state.mem[A.wEnemyMons + 2 * PARTYMON_STRUCT_LENGTH + 29 + 1]).toBe(5);
    expect(state.mem[A.wEnemyMons + 29 + 1]).toBe(9);
    state.mem[A.wEnemyMonPP + 1] = 0xff;
    state.mem[A.wEnemyMons + 2 * PARTYMON_STRUCT_LENGTH + 29 + 1] = 0xff;
    incrementMovePP(state);
    expect(state.mem[A.wEnemyMonPP + 1]).toBe(0);
    expect(state.mem[A.wEnemyMons + 2 * PARTYMON_STRUCT_LENGTH + 29 + 1]).toBe(0);
  });
});

describe('pokedex order', () => {
  it('maps internal id 1 to Rhydon', () => {
    expect(partySlotFromPokemon(mon(5, { status: 'PAR' })).status).toBe(PAR);
    expect(partySlotFromPokemon(mon(5, { status: 'SLP', sleepTurns: 3 })).status).toBe(3);
    expect(partySlotFromPokemon(mon(5, { status: 'BRN' })).status).toBe(BRN);
    expect(POKEDEX_ORDER).toHaveLength(190);
    expect(POKEDEX_ORDER[0]).toBe(112);
    expect(charmapByte('P')).toBe(0x8f);
  });
});
