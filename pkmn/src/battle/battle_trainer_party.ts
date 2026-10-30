// Unused until A5c3f. pret e89ead15:
// home/trainers2.asm GetTrainerInformation / IsFightingJessieJames,
// engine/battle/get_trainer_name.asm, engine/battle/read_trainer_party.asm,
// engine/pokemon/add_mon.asm _AddPartyMon (ENEMY_PARTY_DATA), engine/math/bcd.asm AddBCD.
// No live caller. The pic is a filename for checkpoint-04; wTrainerPicPointer stays untouched.
import { getTrainerSpeciesData, type TrainerRow, type MoveRow, type MonRow, type PartyMember } from './battle_trainer_data';
import { GROWTH_RATE_NAMES, TYPE_NAMES } from '../rom/constants';
import { writePartyMovePP } from './battle_add_mon';
import { calcExperience } from './battle_calc_experience';
import { calcStat, calcStats } from './battle_calc_stats';
import { D } from './battle_end_state';
import { getMonHeader, writeMonMoves } from './battle_loaders';
import { BattleUnsupportedState } from './battle_move_data';
import {
  A, ATKDEFDV_TRAINER, encodeText, NAME_BUFFER_LENGTH, NAME_LENGTH, NUM_MOVES, NUM_STATS,
  PARTY_LENGTH, PARTYMON_STRUCT_LENGTH, POKEDEX_ORDER, SPDSPCDV_TRAINER, type BattleState, type SpeciesHeader,
} from './battle_state';

/** ram/wram.asm:1404,1446,1944. Not on the live address maps. Symbols 573535d. */
export const W_TRAINER_BASE_MONEY = 0xd045;
export const W_TRAINER_NO = 0xd05c;
export const W_RIVAL_NAME = 0xd349;
/** ram/hram.asm hNewPartyLength. */
const H_NEW_PARTY_LENGTH = 0xffe4;
/** home/names2.asm GetName stores de after the 20-byte copy. */
const W_UNUSED_NAME_POINTER = 0xcf8c;

const ENEMY_PARTY_DATA = 1;
const KADABRA = 0x26;
const TWISTEDSPOON_GSC = 0x60;
const TRAINER_NAME = 7;
const TRAINER_NAME_LENGTH = 13;
const TRAINER_NAMES_BANK = 0x0e;
const RIVAL1 = 0x19;
const RIVAL2 = 0x2a;
const RIVAL3 = 0x2b;
/** Party + (MON_HP_EXP - 1). CalcStat's DVs are 11 and 12 bytes past this. */
const STAT_EXP_BASE = 16;

const pics = new WeakMap<BattleState, string>();

let rows: Map<number, TrainerRow> | null = null;
let packed: number[] | null = null;
let moveByName: Map<string, MoveRow> | null = null;
let speciesByKey: Map<string, number> | null = null;
let headers: Map<number, SpeciesHeader> | null = null;

function load(): void {
  if (rows) return;
  const { trainers, pokemon, moves } = getTrainerSpeciesData();
  rows = new Map(Object.values(trainers).map(row => [row.id, row]));
  packed = [...rows.values()].sort((a, b) => a.id - b.id).flatMap(row => encodeText(`${row.displayName}@`));
  moveByName = new Map(Object.entries(moves));
  speciesByKey = new Map();
  headers = new Map();
  pokemon.forEach((entry, dex) => {
    if (!entry) return;
    const internal = POKEDEX_ORDER.indexOf(dex) + 1;
    if (internal <= 0) throw new BattleUnsupportedState(`no internal id for dex ${dex}`);
    speciesByKey!.set(speciesKey(entry.name), internal);
    headers!.set(internal, headerOf(entry));
  });
}

function speciesKey(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function typeByte(name: string): number {
  if (name === 'PSYCHIC') return 24;
  const found = Object.entries(TYPE_NAMES).find(([, label]) => label === name);
  if (!found) throw new BattleUnsupportedState(`type ${name}`);
  return Number(found[0]);
}

function moveRow(name: string): MoveRow {
  load();
  const move = moveByName!.get(name);
  if (!move) throw new BattleUnsupportedState(`move ${name}`);
  return move;
}

function four(names: readonly string[]): [number, number, number, number] {
  const ids: [number, number, number, number] = [0, 0, 0, 0];
  names.forEach((name, index) => { if (index < 4) ids[index] = moveRow(name).id & 0xff; });
  return ids;
}

function headerOf(entry: MonRow): SpeciesHeader {
  const growthRate = GROWTH_RATE_NAMES.indexOf(entry.growthRate);
  if (growthRate < 0) throw new BattleUnsupportedState(`growth ${entry.growthRate}`);
  return {
    name: entry.name,
    base: [entry.hp, entry.attack, entry.defense, entry.speed, entry.special],
    type1: typeByte(entry.type1), type2: typeByte(entry.type2),
    catchRate: entry.catchRate, baseExp: entry.baseExp, moves: four(entry.startMoves),
    learnset: entry.learnset.map(item => ({ level: item.level, move: moveRow(item.move).id & 0xff })),
    growthRate,
  };
}

function classRow(id: number): TrainerRow {
  load();
  const row = rows!.get(id);
  if (!row) throw new BattleUnsupportedState(`trainer class ${id}`);
  return row;
}

/** Pret constant (CATERPIE, NIDORAN_F) to the internal species byte. */
export function speciesInternalId(pretName: string): number {
  load();
  const id = speciesByKey!.get(speciesKey(pretName));
  if (!id) throw new BattleUnsupportedState(`species ${pretName}`);
  return id;
}

export function installTrainerSpecies(state: BattleState): void {
  load();
  state.species = id => {
    const header = headers!.get(id & 0xff);
    if (!header) throw new BattleUnsupportedState(`no species header ${id}`);
    return header;
  };
}

/** Checkpoint-04's _LoadTrainerPic reads this. The ROM pointer bytes are not invented. */
export function trainerPicName(state: BattleState): string | undefined {
  return pics.get(state);
}

function bcdByte(n: number): number {
  return ((Math.floor(n / 10) << 4) | (n % 10)) & 0xff;
}

function nameStart(bytes: number[], index: number): number {
  let seen = 0;
  let start = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] !== 0x50) continue;
    seen++;
    if (seen === index) return start;
    start = i + 1;
  }
  throw new BattleUnsupportedState(`trainer name ${index} is not in the table`);
}

/** engine/battle/get_trainer_name.asm. Link is unsupported. Rivals copy 13 bytes from wRivalName. */
export function getTrainerName(state: BattleState): void {
  if (state.wLinkState !== 0) throw new BattleUnsupportedState('link battle');
  const cls = state.mem[D.wTrainerClass];
  if (cls === RIVAL1 || cls === RIVAL2 || cls === RIVAL3) {
    state.mem.copyWithin(D.wTrainerName, W_RIVAL_NAME, W_RIVAL_NAME + TRAINER_NAME_LENGTH);
    return;
  }
  load();
  const start = nameStart(packed!, cls);
  if (start + NAME_BUFFER_LENGTH > packed!.length) {
    throw new BattleUnsupportedState('trainer name window runs into misc.asm');
  }
  state.wNameListIndex = cls;
  state.wNameListType = TRAINER_NAME;
  state.wPredefBank = TRAINER_NAMES_BANK;
  state.wNamedObjectIndex = cls;
  for (let i = 0; i < NAME_BUFFER_LENGTH; i++) state.mem[A.wNameBuffer + i] = packed![start + i];
  state.mem.copyWithin(D.wTrainerName, A.wNameBuffer, A.wNameBuffer + TRAINER_NAME_LENGTH);
  const after = A.wNameBuffer + NAME_BUFFER_LENGTH;
  state.mem[W_UNUSED_NAME_POINTER] = after & 0xff;
  state.mem[W_UNUSED_NAME_POINTER + 1] = (after >>> 8) & 0xff;
}

/** home/trainers2.asm. Pic override is ROCKET.picOverride; both Jessie branches share that file. */
export function getTrainerInformation(state: BattleState): void {
  getTrainerName(state);
  if (state.wLinkState !== 0) throw new BattleUnsupportedState('link battle');
  const row = classRow(state.mem[D.wTrainerClass]);
  let pic = row.pic;
  const trainerNo = state.mem[W_TRAINER_NO];
  if (row.picOverride && trainerNo >= row.picOverride.trainerNoAtLeast) pic = row.picOverride.pic;
  pics.set(state, pic);
  const high = Math.floor(row.baseMoney / 100);
  const low = row.baseMoney % 100;
  state.mem[W_TRAINER_BASE_MONEY] = bcdByte(high);
  state.mem[W_TRAINER_BASE_MONEY + 1] = bcdByte(low);
}

/** Addition then DAA, N flag clear. Half-carry is the low-nibble sum. */
function adcDaa(left: number, right: number, carryIn: boolean): { value: number; carry: boolean } {
  const carryBit = carryIn ? 1 : 0;
  const sum = (left & 0xff) + (right & 0xff) + carryBit;
  const half = ((left & 0x0f) + (right & 0x0f) + carryBit) > 0x0f;
  let value = sum & 0xff;
  let carry = sum > 0xff;
  if (carry || value > 0x99) {
    value = (value + 0x60) & 0xff;
    carry = true;
  }
  if (half || (value & 0x0f) > 0x09) value = (value + 0x06) & 0xff;
  return { value, carry };
}

/**
 * read_trainer_party.asm:123–145 and bcd.asm:166–190.
 * Three zero stores leave de on the third byte. AddBCD walks two bytes backward and does not
 * restore de. The caller's inc de ×2 puts it back. A carry fills $99 from the middle byte and
 * the next iteration's de is then past the total.
 */
export function addTrainerPrizeMoney(state: BattleState): void {
  const money = D.wAmountMoneyWon;
  let de: number = money;
  state.mem[de] = 0;
  de = (de + 1) & 0xffff;
  state.mem[de] = 0;
  de = (de + 1) & 0xffff;
  state.mem[de] = 0;
  let rounds = state.wCurEnemyLevel & 0xff;
  do {
    let hl = W_TRAINER_BASE_MONEY + 1;
    let c = 2;
    const fillCount = c;
    let carry = false;
    do {
      const added = adcDaa(state.mem[de], state.mem[hl], carry);
      state.mem[de] = added.value;
      carry = added.carry;
      de = (de - 1) & 0xffff;
      hl = (hl - 1) & 0xffff;
      c--;
    } while (c !== 0);
    if (carry) {
      de = (de + 1) & 0xffff;
      let left = fillCount;
      do {
        state.mem[de] = 0x99;
        de = (de + 1) & 0xffff;
        left--;
      } while (left !== 0);
    }
    de = (de + 1) & 0xffff;
    de = (de + 1) & 0xffff;
    rounds = (rounds - 1) & 0xff;
  } while (rounds !== 0);
}

/**
 * add_mon.asm enemy branch. Naming is skipped (wMonDataLocation != 0), so wEnemyMonNicks is not written.
 * DVs are $98/$88. Current HP is CalcStat b=0 before EVs are cleared. CalcStats b=0 runs unless wIsInBattle is 1.
 */
function addEnemyPartyMon(state: BattleState): boolean {
  if ((state.wMonDataLocation & 0x0f) === 0) throw new BattleUnsupportedState('player party');
  const count = (state.mem[D.wEnemyPartyCount] + 1) & 0xff;
  if (count > PARTY_LENGTH) return false;
  state.mem[D.wEnemyPartyCount] = count;
  state.mem[H_NEW_PARTY_LENGTH] = count;
  const list = (D.wEnemyPartyCount + count) & 0xffff;
  state.mem[list] = state.wCurPartySpecies;
  state.mem[(list + 1) & 0xffff] = 0xff;
  const index = count - 1;
  const ot = A.wEnemyMonOT + index * NAME_LENGTH;
  state.mem.copyWithin(ot, A.wPlayerName, A.wPlayerName + NAME_LENGTH);
  const base = A.wEnemyMons + index * PARTYMON_STRUCT_LENGTH;
  state.wCurSpecies = state.wCurPartySpecies;
  getMonHeader(state, state.wCurSpecies);
  state.mem[base] = state.mem[A.wMonHIndex];
  state.mem[base + 27] = ATKDEFDV_TRAINER;
  state.mem[base + 28] = SPDSPCDV_TRAINER;
  const statExp = base + STAT_EXP_BASE;
  const hp = calcStat(state, 1, 0, statExp);
  state.writeBE(base + 1, hp);
  state.mem[base + 3] = 0;
  state.mem[base + 4] = 0;
  state.mem[base + 5] = state.mem[A.wMonHTypes];
  state.mem[base + 6] = state.mem[A.wMonHTypes + 1];
  state.mem[base + 7] = state.mem[A.wMonHCatchRate];
  if (state.wCurPartySpecies === KADABRA) state.mem[base + 7] = TWISTEDSPOON_GSC;
  for (let i = 0; i < NUM_MOVES; i++) state.mem[base + 8 + i] = state.mem[A.wMonHMoves + i];
  state.mem[D.wLearningMovesFromDayCare] = 0;
  writeMonMoves(state, base + 8);
  state.mem[base + 12] = state.mem[A.wPlayerID];
  state.mem[base + 13] = state.mem[A.wPlayerID + 1];
  const exp = calcExperience(state, state.wCurEnemyLevel);
  state.mem[base + 14] = (exp >>> 16) & 0xff;
  state.mem[base + 15] = (exp >>> 8) & 0xff;
  state.mem[base + 16] = exp & 0xff;
  for (let i = 0; i < NUM_STATS * 2; i++) state.mem[base + 17 + i] = 0;
  writePartyMovePP(state, base + 8, base + 28);
  state.mem[base + 33] = state.wCurEnemyLevel;
  if (((state.wIsInBattle - 1) & 0xff) === 0) {
    state.mem.copyWithin(base + 34, A.wEnemyMonMaxHP, A.wEnemyMonMaxHP + NUM_STATS * 2);
  } else {
    calcStats(state, 0, statExp, base + 34);
  }
  return true;
}

function applySpecialMoves(state: BattleState, party: readonly PartyMember[]): void {
  party.forEach((member, mon) => {
    if (!member.moveOverrides) return;
    const slots = Object.keys(member.moveOverrides).map(Number).sort((a, b) => a - b);
    for (const slot of slots) {
      const id = moveRow(member.moveOverrides[String(slot)]).id & 0xff;
      state.mem[A.wEnemyMons + mon * PARTYMON_STRUCT_LENGTH + 8 + (slot - 1)] = id;
    }
  });
}

/**
 * engine/battle/read_trainer_party.asm. wTrainerNo is 1-based.
 * JSON has no $FF flag; each member's own level matches both party forms, and wCurEnemyLevel
 * finishes on the last mon. Special moves write the move id only. wLoneAttackNo is not read.
 */
export function readTrainer(state: BattleState): void {
  if (state.wLinkState !== 0) return;
  installTrainerSpecies(state);
  state.mem[D.wEnemyPartyCount] = 0;
  state.mem[D.wEnemyPartyCount + 1] = 0xff;
  const party = classRow(state.mem[D.wTrainerClass]).parties[state.mem[W_TRAINER_NO] - 1];
  if (!party) throw new BattleUnsupportedState(`trainer ${state.mem[D.wTrainerClass]} number ${state.mem[W_TRAINER_NO]}`);
  for (const member of party) {
    state.wCurEnemyLevel = member.level & 0xff;
    state.wCurPartySpecies = speciesInternalId(member.species);
    state.wMonDataLocation = ENEMY_PARTY_DATA;
    addEnemyPartyMon(state);
  }
  applySpecialMoves(state, party);
  addTrainerPrizeMoney(state);
}
