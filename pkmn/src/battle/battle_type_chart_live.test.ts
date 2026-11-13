// V5a checkpoint-01 (note 91). The live engine compares type bytes, as core.asm does: PSYCHIC_TYPE is 24 on
// both sides of TypeEffects, and a Psychic species' type bytes are 24 through every loader. So the four
// Psychic-defender rows apply (the old string-keyed engine never matched them: DECISIONS #10, withdrawn by #111).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} } }));
import { A, BattleState, TRAINER_BATTLE } from './battle_state';
import { D } from './battle_end_state';
import { createPokemon, loadBattleData } from './data';
import { loadBattleMoveData } from './battle_move_data';
import { loadTrainerSpeciesData } from './battle_trainer_data';
import { loadBattleBridgeData, writeBattleInputs } from './battle_bridge';
import { initWildBattle, loadBattleMonFromParty, loadEnemyMonData } from './battle_loaders';
import { getTrainerInformation, installTrainerSpecies, readTrainer, speciesInternalId, W_TRAINER_NO } from './battle_trainer_party';
import { adjustDamageForMoveType, typeChart } from './battle_damage_asm';
import { AIGetTypeEffectiveness } from './battle_ai_moves';
import { battleWorld } from '../test/battle_world_fixture';

const DATA = resolve(__dirname, '../../data');
const POKEMON = JSON.parse(readFileSync(resolve(DATA, 'pokemon.json'), 'utf8')) as ({ id: number; name: string; type1: string; type2: string } | null)[];
const TRAINERS = JSON.parse(readFileSync(resolve(DATA, 'trainers.json'), 'utf8')) as Record<string, { id: number }>;

const NORMAL = 0, FIGHTING = 1, GROUND = 4, ROCK = 5, BUG = 7, GHOST = 8, FIRE = 20, WATER = 21, PSYCHIC = 24;
/** data/types/type_matchups.asm: the four rows whose defender is PSYCHIC_TYPE. [move type, byte, 20 damage becomes]. */
const ROWS = [
  ['BUG', BUG, 0x14, 40], ['FIGHTING', FIGHTING, 0x05, 10], ['PSYCHIC_TYPE', PSYCHIC, 0x05, 10], ['GHOST', GHOST, 0x00, 0],
] as const;

beforeAll(async () => {
  await loadBattleData(); await loadBattleMoveData(); await loadTrainerSpeciesData(); await loadBattleBridgeData();
});

function fresh(): BattleState {
  const state = new BattleState();
  installTrainerSpecies(state);
  state.random = () => 0x88;
  return state;
}

/** The player's typeless move into the loaded enemy. */
function playerHits(state: BattleState, moveType: number): [number, number, number] {
  state.hWhoseTurn = 0; state.wPlayerMoveType = moveType;
  state.wBattleMonType1 = NORMAL; state.wBattleMonType2 = NORMAL;
  state.wDamage = 20; state.wDamageMultipliers = 0; state.wMoveMissed = 0;
  adjustDamageForMoveType(state);
  return [state.wDamage, state.wDamageMultipliers, state.wMoveMissed];
}

describe('TypeEffects rows with a Psychic defender, through the real loaders', () => {
  it('the committed chart holds exactly the four rows, as type byte 24', () => {
    const rows = typeChart().filter(row => row.defend === PSYCHIC);
    expect(rows.map(row => [row.attack, row.multiplier])).toEqual([[PSYCHIC, 0x05], [FIGHTING, 0x05], [BUG, 0x14], [GHOST, 0x00]]);
  });

  it('every Psychic species header carries byte 24, in the slot pokemon.json names', () => {
    const state = fresh();
    const psychic = POKEMON.filter(mon => mon && (mon.type1 === 'PSYCHIC' || mon.type2 === 'PSYCHIC')) as { id: number; name: string; type1: string; type2: string }[];
    expect(psychic.map(mon => mon.name)).toEqual([
      'Abra', 'Kadabra', 'Alakazam', 'Slowpoke', 'Slowbro', 'Drowzee', 'Hypno', 'Exeggcute', 'Exeggutor',
      'Starmie', 'Mr. Mime', 'Jynx', 'Mewtwo', 'Mew',
    ]);
    for (const mon of psychic) {
      const header = state.species(speciesInternalId(mon.name));
      expect([mon.name, header.type1 === PSYCHIC, header.type2 === PSYCHIC])
        .toEqual([mon.name, mon.type1 === 'PSYCHIC', mon.type2 === 'PSYCHIC']);
    }
    expect(POKEMON.some(mon => mon && (mon.type1 === 'PSYCHIC_TYPE' || mon.type2 === 'PSYCHIC_TYPE'))).toBe(false);
  });

  it('a wild Abra takes all four rows', () => {
    const state = fresh();
    // battle_init.ts:74 (init_battle.asm InitBattleCommon): wCurOpponent is already in both cells.
    state.wEnemyMonSpecies2 = speciesInternalId('ABRA'); state.wCurPartySpecies = state.wEnemyMonSpecies2;
    state.wCurEnemyLevel = 10;
    initWildBattle(state);
    expect([state.wEnemyMonType1, state.wEnemyMonType2]).toEqual([PSYCHIC, PSYCHIC]);
    for (const [name, type, byte, damage] of ROWS)
      expect([name, ...playerHits(state, type)]).toEqual([name, damage, byte, damage === 0 ? 1 : 0]);
  });

  it("a trainer's Slowpoke takes them on its second type, with Water's own rows first", () => {
    const state = fresh();
    state.mem[D.wTrainerClass] = TRAINERS.PSYCHIC_TR.id; state.mem[W_TRAINER_NO] = 1;
    getTrainerInformation(state); readTrainer(state);
    state.wIsInBattle = TRAINER_BATTLE; state.wWhichPokemon = 1;
    state.wEnemyMonSpecies2 = state.mem[A.wEnemyMons + 44]; state.wCurEnemyLevel = 31;
    loadEnemyMonData(state);
    expect(state.wEnemyMonSpecies2).toBe(speciesInternalId('SLOWPOKE'));
    expect([state.wEnemyMonType1, state.wEnemyMonType2]).toEqual([WATER, PSYCHIC]);
    for (const [name, type, byte, damage] of ROWS)
      expect([name, ...playerHits(state, type)]).toEqual([name, damage, byte, damage === 0 ? 1 : 0]);
  });

  it("the player's Alakazam takes them on the enemy's turn, and the trainer AI reads the same rows", () => {
    const state = fresh();
    const alakazam = createPokemon(65, 40, undefined, { atk: 9, def: 8, spd: 8, spc: 8 })!;
    alakazam.otName = 'ASH'; alakazam.otId = 0;
    writeBattleInputs(state, battleWorld({ party: [alakazam] }));
    installTrainerSpecies(state);
    // LoadBattleMonFromParty reads the header through wBattleMonSpecies2, which its callers set from the party.
    state.wWhichPokemon = 0; state.wPlayerMonNumber = 0; state.wBattleMonSpecies2 = state.mem[A.wPartyMons];
    expect(state.wBattleMonSpecies2).toBe(speciesInternalId('ALAKAZAM'));
    loadBattleMonFromParty(state);
    expect([state.wBattleMonType1, state.wBattleMonType2]).toEqual([PSYCHIC, PSYCHIC]);
    for (const [name, type, byte, damage] of ROWS) {
      state.hWhoseTurn = 1; state.wEnemyMoveType = type;
      state.wEnemyMonType1 = NORMAL; state.wEnemyMonType2 = NORMAL;
      state.wDamage = 20; state.wDamageMultipliers = 0; state.wMoveMissed = 0;
      adjustDamageForMoveType(state);
      expect([name, state.wDamage, state.wDamageMultipliers, state.wMoveMissed]).toEqual([name, damage, byte, damage === 0 ? 1 : 0]);
      state.mem[A.wEnemyMoveType] = type;
      AIGetTypeEffectiveness(state);
      expect([name, state.mem[A.wTypeEffectiveness]]).toEqual([name, byte]);
    }
  });
});

it('Ground into Fire/Rock applies both super-effective rows, each floored, and keeps the last byte', () => {
  const state = new BattleState();
  expect(typeChart().filter(row => row.attack === GROUND && (row.defend === FIRE || row.defend === ROCK))
    .map(row => [row.defend, row.multiplier])).toEqual([[FIRE, 0x14], [ROCK, 0x14]]);
  state.hWhoseTurn = 0; state.wPlayerMoveType = GROUND;
  state.wBattleMonType1 = NORMAL; state.wBattleMonType2 = NORMAL;
  state.wEnemyMonType1 = FIRE; state.wEnemyMonType2 = ROCK; state.wDamage = 19;
  adjustDamageForMoveType(state);
  expect([state.wDamage, state.wDamageMultipliers, state.wMoveMissed]).toEqual([76, 0x14, 0]);
});
