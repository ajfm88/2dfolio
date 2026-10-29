// core.asm LoadBattleMonFromParty, LoadEnemyMonFromParty, LoadEnemyMonData,
// ApplyBurnAndParalysisPenalties, ApplyBadgeStatBoosts, ReadPlayerMonCurHPAndStatus,
// IncrementMovePP; decrement_pp.asm; init_battle.asm InitWildBattle's ghost block;
// home/move_mon.asm CalcStats; evos_moves.asm WriteMonMoves; add_mon.asm LoadMovePPs.
import type { BattlePokemon, StatExperience } from './types';
import { getMove } from './data';
import { TYPE_NAMES } from '../rom/constants';
import {
  A, ATKDEFDV_TRAINER, BRN, decodeNick, encodeText, GHOST_PIC, indexToPokedex, isGhostBattle, LINK_STATE_BATTLING,
  MAX_STAT_VALUE, MON_GHOST, NAME_LENGTH, NUM_MOVES, NUM_STATS, NUM_STAT_MODS, PAR, PARTYMON_STRUCT_LENGTH,
  POKEDEX_ORDER, PSN, RESTLESS_SOUL, setSeenFlag, SPDSPCDV_TRAINER, STRUGGLE, TRAINER_BATTLE,
  TRANSFORMED, WILD_BATTLE, writeBytes, type BattleState, type SpeciesHeader,
} from './battle_state';

export type { SpeciesHeader };
export { POKEDEX_ORDER };

const MON_PP = 29;
/** pret core.asm:6282-6284; pinned wram symbol $CEE9 (also wBuffer). */
const wLearningMovesFromDayCare = 0xcee9;
const STORING_ENERGY = 1 << 0;
const THRASHING_ABOUT = 1 << 1;
const ATTACKING_MULTIPLE_TIMES = 1 << 2;
const USING_RAGE = 1 << 6;
const FRZ = 1 << 5;

export interface PartySlot {
  species: number;
  hp: number;
  boxLevel: number;
  status: number;
  type1: number;
  type2: number;
  catchRate: number;
  moves: readonly number[];
  dvs: readonly [number, number];
  pp: readonly number[];
  level: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  special: number;
  nickname: string;
  otId: number;
  otName: string;
  exp: number;
  statExp: StatExperience;
}

export function statusByte(mon: BattlePokemon): number {
  if (mon.status === 'PAR') return PAR;
  if (mon.status === 'FRZ') return FRZ;
  if (mon.status === 'BRN') return BRN;
  if (mon.status === 'PSN') return PSN;
  if (mon.status === 'SLP') return mon.sleepTurns & 7;
  return 0;
}

function partyTypeByte(type: string): number {
  const key = type === 'PSYCHIC' ? 'PSYCHIC_TYPE' : type;
  const entry = Object.entries(TYPE_NAMES).find(([, name]) => name === key);
  if (!entry) throw new Error(`unknown party type: ${type}`);
  return Number(entry[0]);
}

/** BattlePokemon has no box-level byte or packed PP Up bits (pp/maxPp are separate).
 * The slot uses level for box level and copies current PP without PP Up bits. */
export function partySlotFromPokemon(mon: BattlePokemon): PartySlot {
  return {
    species: POKEDEX_ORDER.indexOf(mon.species.id) + 1,
    hp: mon.currentHp,
    boxLevel: mon.level,
    status: statusByte(mon),
    type1: partyTypeByte(mon.species.type1),
    type2: partyTypeByte(mon.species.type2),
    catchRate: mon.species.catchRate,
    moves: Array.from({ length: NUM_MOVES }, (_, i) => {
      const move = mon.moves[i];
      if (!move) return 0;
      const data = getMove(move.id);
      if (!data) throw new Error(`unknown party move: ${move.id}`);
      return data.id;
    }),
    dvs: [((mon.atkDV & 0xf) << 4) | (mon.defDV & 0xf), ((mon.spdDV & 0xf) << 4) | (mon.spcDV & 0xf)],
    pp: mon.moves.slice(0, 4).map(move => move.pp & 0x3f),
    level: mon.level,
    maxHp: mon.maxHp,
    attack: mon.attack,
    defense: mon.defense,
    speed: mon.speed,
    special: mon.special,
    nickname: mon.nickname,
    otId: mon.otId,
    otName: mon.otName,
    exp: mon.exp,
    statExp: [...mon.statExp],
  };
}

export function writePartySlot(state: BattleState, side: 'player' | 'enemy', slot: number, mon: PartySlot): void {
  const base = (side === 'player' ? A.wPartyMons : A.wEnemyMons) + slot * PARTYMON_STRUCT_LENGTH;
  const nick = (side === 'player' ? A.wPartyMonNicks : A.wEnemyMonNicks) + slot * NAME_LENGTH;
  const ot = (side === 'player' ? A.wPartyMonOT : A.wEnemyMonOT) + slot * NAME_LENGTH;
  state.mem[base] = mon.species & 0xff;
  state.writeBE(base + 1, mon.hp);
  state.mem[base + 3] = mon.boxLevel & 0xff;
  state.mem[base + 4] = mon.status & 0xff;
  state.mem[base + 5] = mon.type1 & 0xff;
  state.mem[base + 6] = mon.type2 & 0xff;
  state.mem[base + 7] = mon.catchRate & 0xff;
  writeBytes(state.mem, base + 8, mon.moves, NUM_MOVES);
  // macros/ram.asm:17–23; pokemon_data_constants.asm:38–44. These are not battle-struct bytes.
  state.writeBE(base + 12, mon.otId);
  state.mem[base + 14] = (mon.exp >>> 16) & 0xff;
  state.writeBE(base + 15, mon.exp);
  for (let stat = 0; stat < NUM_STATS; stat++) state.writeBE(base + 17 + stat * 2, mon.statExp[stat]);
  writeBytes(state.mem, ot, encodeText(`${mon.otName}@`), NAME_LENGTH);
  state.mem[base + 27] = mon.dvs[0] & 0xff;
  state.mem[base + 28] = mon.dvs[1] & 0xff;
  writeBytes(state.mem, base + MON_PP, mon.pp, NUM_MOVES);
  state.mem[base + 33] = mon.level & 0xff;
  state.writeBE(base + 34, mon.maxHp);
  state.writeBE(base + 36, mon.attack);
  state.writeBE(base + 38, mon.defense);
  state.writeBE(base + 40, mon.speed);
  state.writeBE(base + 42, mon.special);
  writeBytes(state.mem, nick, encodeText(`${mon.nickname}@`), NAME_LENGTH);
  if (side === 'player') mirrorPartyProgress(state, slot);
}

/** experience.asm:24–55,93–142 and macros/ram.asm:17–23: mirror only after the byte writes. */
export function mirrorPartyProgress(state: BattleState, slot: number): void {
  const mon = state.partyMons[slot];
  if (!mon) return;
  const base = A.wPartyMons + slot * PARTYMON_STRUCT_LENGTH;
  mon.otId = state.readBE(base + 12);
  mon.otName = decodeNick(state.mem, A.wPartyMonOT + slot * NAME_LENGTH);
  mon.exp = state.mem[base + 14] * 0x10000 + state.readBE(base + 15);
  mon.statExp = [state.readBE(base + 17), state.readBE(base + 19), state.readBE(base + 21),
    state.readBE(base + 23), state.readBE(base + 25)];
}

function copyBytes(state: BattleState, src: number, dest: number, length: number): void {
  for (let i = 0; i < length; i++) state.mem[dest + i] = state.mem[src + i];
}

/** The 12-byte head, the two DVs, four PP, then level and the five stat words. */
function copyBattleStruct(state: BattleState, party: number, speciesAddr: number): void {
  copyBytes(state, party, speciesAddr, A.wBattleMonDVs - A.wBattleMonSpecies);
  const dvs = party + 27;
  state.mem[speciesAddr + 12] = state.mem[dvs];
  state.mem[speciesAddr + 13] = state.mem[dvs + 1];
  const ppDest = speciesAddr + (A.wBattleMonPP - A.wBattleMonSpecies);
  copyBytes(state, party + MON_PP, ppDest, NUM_MOVES);
  const levelDest = speciesAddr + (A.wBattleMonLevel - A.wBattleMonSpecies);
  copyBytes(state, party + 33, levelDest, A.wBattleMonPP - A.wBattleMonLevel);
}

function copyNick(state: BattleState, nickBase: number, index: number, dest: number): void {
  copyBytes(state, nickBase + (index & 0xff) * NAME_LENGTH, dest, NAME_LENGTH);
}

function fillMods(state: BattleState, addr: number): void {
  for (let i = 0; i < NUM_STAT_MODS; i++) state.mem[addr + i] = 7;
}

export function getMonHeader(state: BattleState, id: number): SpeciesHeader {
  const header = state.species(id & 0xff);
  state.mem[A.wMonHIndex] = id & 0xff;
  for (let i = 0; i < 5; i++) state.mem[A.wMonHBaseStats + i] = header.base[i] & 0xff;
  state.mem[A.wMonHTypes] = header.type1 & 0xff;
  state.mem[A.wMonHTypes + 1] = header.type2 & 0xff;
  state.mem[A.wMonHCatchRate] = header.catchRate & 0xff;
  state.mem[A.wMonHBaseEXP] = header.baseExp & 0xff;
  state.wMonHSpriteDim = 0;
  for (let i = 1; i <= 4; i++) state.mem[A.wMonHSpriteDim + i] = 0;
  for (let i = 0; i < NUM_MOVES; i++) state.mem[A.wMonHMoves + i] = header.moves[i] & 0xff;
  // Checkpoint-06: the unused EXP caller needs the actual growth byte. Older isolated fixtures omit it.
  if (header.growthRate !== undefined) state.wMonHGrowthRate = header.growthRate;
  return header;
}

function shiftRight(high: number, low: number): { high: number; low: number } {
  const carry = high & 1;
  return { high: high >> 1, low: ((carry << 7) | (low >> 1)) & 0xff };
}

function scaleStat(high: number, low: number, shifts: number): { high: number; low: number } {
  let word = { high, low };
  for (let i = 0; i < shifts; i++) word = shiftRight(word.high, word.low);
  if ((word.high | word.low) === 0) word = { high: 0, low: 1 };
  return word;
}

function writeScaled(state: BattleState, addr: number, shifts: number): void {
  const scaled = scaleStat(state.mem[addr], state.mem[addr + 1], shifts);
  state.mem[addr] = scaled.high;
  state.mem[addr + 1] = scaled.low;
}

/**
 * pret core.asm:6463-6466.
 * Nonzero hWhoseTurn penalizes the player. Zero penalizes the enemy.
 * ToPlayer stores 1 and ToEnemy stores 0, so each routine hits the side it is named for.
 */
function applyPenalties(state: BattleState): void {
  quarterSpeedDueToParalysis(state);
  halveAttackDueToBurn(state);
}

/** pret core.asm:6468-6509. Penalize the non-acting side, without changing hWhoseTurn. */
export function quarterSpeedDueToParalysis(state: BattleState): void {
  const player = state.hWhoseTurn !== 0;
  const status = player ? state.wBattleMonStatus : state.wEnemyMonStatus;
  if ((status & PAR) !== 0) writeScaled(state, player ? A.wBattleMonSpeed : A.wEnemyMonSpeed, 2);
}

/** pret core.asm:6511-6548. Penalize the non-acting side, minimum one Attack point. */
export function halveAttackDueToBurn(state: BattleState): void {
  const player = state.hWhoseTurn !== 0;
  const status = player ? state.wBattleMonStatus : state.wEnemyMonStatus;
  if ((status & BRN) !== 0) writeScaled(state, player ? A.wBattleMonAttack : A.wEnemyMonAttack, 1);
}

export function applyBurnAndParalysisPenaltiesToPlayer(state: BattleState): void {
  state.hWhoseTurn = 1;
  applyPenalties(state);
}

export function applyBurnAndParalysisPenaltiesToEnemy(state: BattleState): void {
  state.hWhoseTurn = 0;
  applyPenalties(state);
}

function applyBoost(state: BattleState, addr: number): void {
  const high = state.mem[addr];
  const low = state.mem[addr + 1];
  let extra = { high, low };
  for (let i = 0; i < 3; i++) extra = shiftRight(extra.high, extra.low);
  const lowSum = low + extra.low;
  const newLow = lowSum & 0xff;
  const newHigh = (high + extra.high + (lowSum > 0xff ? 1 : 0)) & 0xff;
  state.mem[addr] = newHigh;
  state.mem[addr + 1] = newLow;
  const borrow = newLow < 0xe7 ? 1 : 0;
  if (newHigh - 0x03 - borrow < 0) return;
  state.writeBE(addr, MAX_STAT_VALUE);
}

/** Even badge bits only. Link returns. The boost lands on the battle copy. */
export function applyBadgeStatBoosts(state: BattleState): void {
  if (state.wLinkState === LINK_STATE_BATTLING) return;
  let badges = state.wObtainedBadges;
  let addr = A.wBattleMonAttack;
  for (let stat = 0; stat < 4; stat++) {
    const boost = (badges & 1) !== 0;
    badges = (badges >> 1) & 0xff;
    if (boost) applyBoost(state, addr);
    addr += 2;
    badges = (badges >> 1) & 0xff;
  }
}

export function loadBattleMonFromParty(state: BattleState): void {
  const party = A.wPartyMons + state.wWhichPokemon * PARTYMON_STRUCT_LENGTH;
  copyBattleStruct(state, party, A.wBattleMonSpecies);
  state.wCurSpecies = state.wBattleMonSpecies2;
  getMonHeader(state, state.wCurSpecies);
  copyNick(state, A.wPartyMonNicks, state.wPlayerMonNumber, A.wBattleMonNick);
  copyBytes(state, A.wBattleMonLevel, A.wPlayerMonUnmodifiedLevel, 11);
  applyBurnAndParalysisPenaltiesToPlayer(state);
  applyBadgeStatBoosts(state);
  fillMods(state, A.wPlayerMonStatMods);
}

export function loadEnemyMonFromParty(state: BattleState): void {
  const party = A.wEnemyMons + state.wWhichPokemon * PARTYMON_STRUCT_LENGTH;
  copyBattleStruct(state, party, A.wEnemyMonSpecies);
  state.wCurSpecies = state.wEnemyMonSpecies;
  getMonHeader(state, state.wCurSpecies);
  copyNick(state, A.wEnemyMonNicks, state.wWhichPokemon, A.wEnemyMonNick);
  copyBytes(state, A.wEnemyMonLevel, A.wEnemyMonUnmodifiedLevel, 11);
  applyBurnAndParalysisPenaltiesToEnemy(state);
  copyBytes(state, A.wMonHBaseStats, A.wEnemyMonBaseStats, 5);
  fillMods(state, A.wEnemyMonStatMods);
  state.wEnemyMonPartyPos = state.wWhichPokemon;
}

function calcOne(base: number, dv: number, level: number, hp: boolean): number {
  let value = Math.floor(((base + dv) * 2 * level) / 100);
  value += hp ? level + 10 : 5;
  return value > MAX_STAT_VALUE ? MAX_STAT_VALUE : value;
}

function calcEnemyStats(state: BattleState): void {
  const level = state.wCurEnemyLevel;
  const atkDef = state.mem[A.wEnemyMonDVs];
  const spdSpc = state.mem[A.wEnemyMonDVs + 1];
  const atk = atkDef >> 4;
  const def = atkDef & 0xf;
  const spd = spdSpc >> 4;
  const spc = spdSpc & 0xf;
  const hpDv = ((atk & 1) << 3) | ((def & 1) << 2) | ((spd & 1) << 1) | (spc & 1);
  const dvs = [hpDv, atk, def, spd, spc];
  let addr = A.wEnemyMonMaxHP;
  for (let i = 0; i < 5; i++) {
    state.writeBE(addr, calcOne(state.mem[A.wMonHBaseStats + i], dvs[i], level, i === 0));
    addr += 2;
  }
}

/** evos_moves.asm:498–602. wLearningMovesFromDayCare 0 skips the daycare minimum. */
export function writeMonMoves(state: BattleState, movesAddr: number): void {
  const level = state.wCurEnemyLevel;
  for (const entry of state.species(state.wCurPartySpecies).learnset) {
    if (entry.level === 0 || level < entry.level) break;
    const move = entry.move & 0xff;
    let known = false;
    for (let i = 0; i < NUM_MOVES; i++) if (state.mem[movesAddr + i] === move) known = true;
    if (known) continue;
    let empty = -1;
    for (let i = 0; i < NUM_MOVES; i++) if (state.mem[movesAddr + i] === 0) { empty = i; break; }
    if (empty >= 0) state.mem[movesAddr + empty] = move;
    else {
      for (let i = 0; i < NUM_MOVES - 1; i++) state.mem[movesAddr + i] = state.mem[movesAddr + i + 1];
      state.mem[movesAddr + 3] = move;
    }
  }
}

function loadMovePPs(state: BattleState, movesAddr: number, ppAddr: number): void {
  for (let i = 0; i < NUM_MOVES; i++) {
    const id = state.mem[movesAddr + i];
    state.mem[ppAddr + i] = id === 0 ? 0 : state.movePP(id) & 0xff;
  }
}

/** home/names.asm:1–25. MonsterNames entries are 10 bytes padded with @. Copy those, write @ at +10, leave +11..+19. */
export function getMonName(state: BattleState, header: SpeciesHeader): void {
  const bytes = encodeText(`${header.name}@@@@@@@@@@`.slice(0, 10));
  for (let i = 0; i < 10; i++) state.mem[A.wNameBuffer + i] = bytes[i];
  state.mem[A.wNameBuffer + 10] = 0x50;
}

export function loadEnemyMonData(state: BattleState): void {
  if (state.wLinkState === LINK_STATE_BATTLING) {
    loadEnemyMonFromParty(state);
    return;
  }
  state.wEnemyMonSpecies = state.wEnemyMonSpecies2;
  state.wCurSpecies = state.wEnemyMonSpecies2;
  getMonHeader(state, state.wCurSpecies);
  let dv0 = state.mem[A.wTransformedEnemyMonOriginalDVs];
  let dv1 = state.mem[A.wTransformedEnemyMonOriginalDVs + 1];
  if ((state.wEnemyBattleStatus3 & TRANSFORMED) === 0) {
    if (state.wIsInBattle === TRAINER_BATTLE) {
      dv0 = ATKDEFDV_TRAINER;
      dv1 = SPDSPCDV_TRAINER;
    } else {
      dv1 = state.random() & 0xff;
      dv0 = state.random() & 0xff;
    }
  }
  state.mem[A.wEnemyMonDVs] = dv0 & 0xff;
  state.mem[A.wEnemyMonDVs + 1] = dv1 & 0xff;
  state.wEnemyMonLevel = state.wCurEnemyLevel;
  calcEnemyStats(state);
  if (state.wIsInBattle === TRAINER_BATTLE) {
    const hp = A.wEnemyMons + state.wWhichPokemon * PARTYMON_STRUCT_LENGTH + 1;
    state.mem[A.wEnemyMonHP] = state.mem[hp];
    state.mem[A.wEnemyMonHP + 1] = state.mem[hp + 1];
    state.wEnemyMonPartyPos = state.wWhichPokemon;
    state.wEnemyMonStatus = state.mem[hp + 3];
  } else if ((state.wEnemyBattleStatus3 & TRANSFORMED) === 0) {
    state.mem[A.wEnemyMonHP] = state.mem[A.wEnemyMonMaxHP];
    state.mem[A.wEnemyMonHP + 1] = state.mem[A.wEnemyMonMaxHP + 1];
    state.wEnemyMonStatus = 0;
  }
  state.wEnemyMonType1 = state.mem[A.wMonHTypes];
  state.wEnemyMonType2 = state.mem[A.wMonHTypes + 1];
  state.wEnemyMonCatchRate = state.mem[A.wMonHCatchRate];
  if (state.wIsInBattle === TRAINER_BATTLE) {
    const moves = A.wEnemyMons + state.wWhichPokemon * PARTYMON_STRUCT_LENGTH + 8;
    copyBytes(state, moves, A.wEnemyMonMoves, NUM_MOVES);
  } else {
    copyBytes(state, A.wMonHMoves, A.wEnemyMonMoves, NUM_MOVES);
    // pret core.asm:6282-6284. Wild WriteMonMoves clears the daycare selector ($CEE9) first.
    state.mem[wLearningMovesFromDayCare] = 0;
    writeMonMoves(state, A.wEnemyMonMoves);
  }
  loadMovePPs(state, A.wEnemyMonMoves, A.wEnemyMonPP);
  copyBytes(state, A.wMonHBaseStats, A.wEnemyMonBaseStats, 5);
  state.wEnemyMonActualCatchRate = state.mem[A.wMonHCatchRate];
  state.wEnemyMonBaseExp = state.mem[A.wMonHBaseEXP];
  state.wNamedObjectIndex = state.wEnemyMonSpecies2;
  const named = state.species(state.wNamedObjectIndex);
  getMonName(state, named);
  copyBytes(state, A.wNameBuffer, A.wEnemyMonNick, NAME_LENGTH);
  state.wPokedexNum = state.wEnemyMonSpecies2;
  indexToPokedex(state);
  setSeenFlag(state, (state.wPokedexNum - 1) & 0xff);
  copyBytes(state, A.wEnemyMonLevel, A.wEnemyMonUnmodifiedLevel, 11);
  fillMods(state, A.wEnemyMonStatMods);
}

/** Sets the wild byte, loads the mon, then the ghost nick. The transition stays in A5d. */
export function initWildBattle(state: BattleState): void {
  state.wIsInBattle = WILD_BATTLE;
  loadEnemyMonData(state);
  if (state.wCurOpponent === RESTLESS_SOUL || isGhostBattle(state)) {
    state.wMonHSpriteDim = 0x66;
    state.mem[A.wMonHSpriteDim + 1] = GHOST_PIC & 0xff;
    state.mem[A.wMonHSpriteDim + 2] = (GHOST_PIC >> 8) & 0xff;
    const nick = encodeText('GHOST@');
    for (let i = 0; i < nick.length; i++) state.mem[A.wEnemyMonNick + i] = nick[i];
    const saved = state.wCurPartySpecies;
    state.wCurPartySpecies = MON_GHOST;
    state.frontPicSpecies = state.wCurPartySpecies;
    state.frontPic = 'ghost';
    state.wCurPartySpecies = saved;
  } else {
    state.frontPicSpecies = state.wCurPartySpecies;
    state.frontPic = 'mon';
  }
}

function applyDecodedStatus(mon: BattlePokemon, status: number): void {
  if ((status & PAR) !== 0) { mon.status = 'PAR'; mon.sleepTurns = 0; return; }
  if ((status & FRZ) !== 0) { mon.status = 'FRZ'; mon.sleepTurns = 0; return; }
  if ((status & BRN) !== 0) { mon.status = 'BRN'; mon.sleepTurns = 0; return; }
  if ((status & PSN) !== 0) { mon.status = 'PSN'; mon.sleepTurns = 0; return; }
  if ((status & 7) !== 0) { mon.status = 'SLP'; mon.sleepTurns = status & 7; return; }
  mon.status = null;
  mon.sleepTurns = 0;
}

export function readPlayerMonCurHPAndStatus(state: BattleState): void {
  const slot = state.wPlayerMonNumber;
  const dest = A.wPartyMons + slot * PARTYMON_STRUCT_LENGTH + 1;
  copyBytes(state, A.wBattleMonHP, dest, 4);
  const mon = state.partyMons[slot];
  if (!mon) return;
  mon.currentHp = state.readBE(dest);
  applyDecodedStatus(mon, state.mem[dest + 3]);
}

function mirrorPartyPp(state: BattleState, slot: number, index: number): void {
  const mon = state.partyMons[slot];
  const move = mon?.moves[index];
  if (!move) return;
  const byte = state.mem[A.wPartyMons + slot * PARTYMON_STRUCT_LENGTH + MON_PP + index];
  move.pp = byte & 0x3f;
}

export function decrementPP(state: BattleState, moveId: number): void {
  if ((moveId & 0xff) === STRUGGLE) return;
  if ((state.wPlayerBattleStatus1 & (STORING_ENERGY | THRASHING_ABOUT | ATTACKING_MULTIPLE_TIMES)) !== 0) return;
  if ((state.wPlayerBattleStatus2 & USING_RAGE) !== 0) return;
  const index = state.wPlayerMoveListIndex;
  state.mem[A.wBattleMonPP + index] = (state.mem[A.wBattleMonPP + index] - 1) & 0xff;
  if ((state.wPlayerBattleStatus3 & TRANSFORMED) !== 0) return;
  const party = A.wPartyMons + state.wPlayerMonNumber * PARTYMON_STRUCT_LENGTH + MON_PP + index;
  state.mem[party] = (state.mem[party] - 1) & 0xff;
  mirrorPartyPp(state, state.wPlayerMonNumber, index);
}

export function incrementMovePP(state: BattleState): void {
  const enemyTurn = state.hWhoseTurn !== 0;
  const battle = enemyTurn ? A.wEnemyMonPP : A.wBattleMonPP;
  const index = enemyTurn ? state.wEnemyMoveListIndex : state.wPlayerMoveListIndex;
  state.mem[battle + index] = (state.mem[battle + index] + 1) & 0xff;
  const slot = enemyTurn ? state.wEnemyMonPartyPos : state.wPlayerMonNumber;
  const base = enemyTurn ? A.wEnemyMons : A.wPartyMons;
  const party = base + slot * PARTYMON_STRUCT_LENGTH + MON_PP + index;
  state.mem[party] = (state.mem[party] + 1) & 0xff;
  if (!enemyTurn) mirrorPartyPp(state, slot, index);
}
