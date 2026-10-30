// Unused party boundary. pret macros/ram.asm:7-37; pokemon_data_constants.asm:26-61.
import { A, NAME_LENGTH, PARTYMON_STRUCT_LENGTH, POKEDEX_ORDER, encodeText, type BattleState } from './battle_state';
import { decodeBattleText } from './battle_text_codec';
import { BattleUnsupportedState } from './battle_move_data';
import { createPokemon, getAllLoadedMoveIds, getMove } from './data';
import { statusByte } from './battle_loaders';
import { TYPE_NAMES } from '../rom/constants';
import type { BattlePokemon, StatExperience } from './types';
export { decodeBattleText } from './battle_text_codec';

/** Names and packed bytes remain raw: decoding a record never interprets text or validates species. */
export interface PartyMonRecord {
  species: number; hp: number; boxLevel: number; status: number;
  type1: number; type2: number; catchRate: number; moves: number[];
  otId: number; exp: number; statExp: StatExperience; dvs: [number, number]; pp: number[];
  level: number; maxHp: number; attack: number; defense: number; speed: number; special: number;
  otName: Uint8Array; nickname: Uint8Array;
}
function addresses(slot: number) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= 6) throw new BattleUnsupportedState('party slot');
  return { base: A.wPartyMons + slot * PARTYMON_STRUCT_LENGTH,
    ot: A.wPartyMonOT + slot * NAME_LENGTH, nick: A.wPartyMonNicks + slot * NAME_LENGTH };
}
/** box_struct is exactly the party prefix; no synthesized level/stat tail in a box record. */
export type BoxMonRecord = Omit<PartyMonRecord, 'level' | 'maxHp' | 'attack' | 'defense' | 'speed' | 'special'>;
export function decodePrefix(state: BattleState, b: number, ot: number, nick: number): BoxMonRecord {
  const m = state.mem;
  return {
    species: m[b], hp: state.readBE(b + 1), boxLevel: m[b + 3], status: m[b + 4],
    type1: m[b + 5], type2: m[b + 6], catchRate: m[b + 7], moves: [...m.slice(b + 8, b + 12)],
    otId: state.readBE(b + 12), exp: m[b + 14] * 0x10000 + state.readBE(b + 15),
    statExp: [state.readBE(b + 17), state.readBE(b + 19), state.readBE(b + 21), state.readBE(b + 23), state.readBE(b + 25)],
    dvs: [m[b + 27], m[b + 28]], pp: [...m.slice(b + 29, b + 33)],
    otName: m.slice(ot, ot + NAME_LENGTH), nickname: m.slice(nick, nick + NAME_LENGTH),
  };
}
export function encodePrefix(state: BattleState, b: number, ot: number, nick: number, r: BoxMonRecord): void {
  const m = state.mem;
  m[b] = r.species; state.writeBE(b + 1, r.hp); m[b + 3] = r.boxLevel; m[b + 4] = r.status;
  m[b + 5] = r.type1; m[b + 6] = r.type2; m[b + 7] = r.catchRate;
  m.set(r.moves, b + 8); state.writeBE(b + 12, r.otId);
  m[b + 14] = r.exp >>> 16; state.writeBE(b + 15, r.exp);
  for (let i = 0; i < 5; i++) state.writeBE(b + 17 + i * 2, r.statExp[i]);
  m.set(r.dvs, b + 27); m.set(r.pp, b + 29);
  m.set(r.otName, ot); m.set(r.nickname, nick);
}
export function decodePartyMon(state: BattleState, slot: number): PartyMonRecord {
  const { base: b, ot, nick } = addresses(slot);
  return { ...decodePrefix(state, b, ot, nick), level: state.mem[b + 33],
    maxHp: state.readBE(b + 34), attack: state.readBE(b + 36), defense: state.readBE(b + 38),
    speed: state.readBE(b + 40), special: state.readBE(b + 42) };
}
export function encodePartyMon(state: BattleState, slot: number, r: PartyMonRecord): void {
  const { base: b, ot, nick } = addresses(slot);
  encodePrefix(state, b, ot, nick, r); state.mem[b + 33] = r.level;
  state.writeBE(b + 34, r.maxHp); state.writeBE(b + 36, r.attack); state.writeBE(b + 38, r.defense);
  state.writeBE(b + 40, r.speed); state.writeBE(b + 42, r.special);
}
/** item_effects.asm:2235-2250,2694-2734,2748-2808. DIV5 floors, bonus caps7, final AND3F. */
export function partyMaxPP(base: number, ups: number): number {
  return (base + Math.min(7, Math.floor(base / 5)) * ups) & 0x3f;
}
/** Reject impossible/ambiguous maxima rather than guessing a packed Up count. */
export function derivePPUps(base: number, max: number): number {
  const increment = Math.min(7, Math.floor(base / 5));
  const ups = Math.floor((max - base) / increment);
  const matches = [0, 1, 2, 3].filter(n => partyMaxPP(base, n) === max);
  if (matches.length !== 1 || ups !== matches[0]) throw new BattleUnsupportedState('PP Up maximum ambiguous or impossible');
  return ups;
}
function typeByte(type: string): number {
  const entry = Object.entries(TYPE_NAMES).find(([, name]) => name === (type === 'PSYCHIC' ? 'PSYCHIC_TYPE' : type));
  if (!entry) throw new BattleUnsupportedState(`party type ${type}`);
  return Number(entry[0]);
}
export function nameBytes(name: string): Uint8Array {
  const bytes = new Uint8Array(NAME_LENGTH); bytes.fill(0x50);
  bytes.set(encodeText(name).slice(0, NAME_LENGTH - 1)); return bytes;
}
/** MISSINGNO gaps are lossless in records, refused at the live species boundary. No stat recomputation. */
export function partyRecordToPokemon(r: PartyMonRecord): BattlePokemon {
  const dex = POKEDEX_ORDER[r.species - 1];
  if (!dex) throw new BattleUnsupportedState(`party species ${r.species}`);
  const mon = createPokemon(dex, r.level, decodeBattleText(r.nickname, 0), {
    atk: r.dvs[0] >> 4, def: r.dvs[0] & 15, spd: r.dvs[1] >> 4, spc: r.dvs[1] & 15,
  });
  if (!mon) throw new BattleUnsupportedState(`party species ${r.species}`);
  mon.currentHp = r.hp; mon.maxHp = r.maxHp; mon.attack = r.attack; mon.defense = r.defense;
  mon.speed = r.speed; mon.special = r.special;
  mon.originalStats = { attack: r.attack, defense: r.defense, speed: r.speed, special: r.special };
  mon.otId = r.otId; mon.otName = decodeBattleText(r.otName, 0); mon.exp = r.exp; mon.statExp = [...r.statExp];
  mon.status = r.status & 0x40 ? 'PAR' : r.status & 0x20 ? 'FRZ' : r.status & 0x10 ? 'BRN' : r.status & 8 ? 'PSN' : r.status & 7 ? 'SLP' : null;
  mon.sleepTurns = mon.status === 'SLP' ? r.status & 7 : 0;
  mon.moves = r.moves.flatMap((id, i) => {
    if (!id) return [];
    const key = getAllLoadedMoveIds().find(name => getMove(name)!.id === id);
    if (!key) throw new BattleUnsupportedState(`party move ${id}`);
    return [{ id: key, pp: r.pp[i] & 0x3f, maxPp: partyMaxPP(getMove(key)!.pp, r.pp[i] >> 6) }];
  });
  return mon;
}
/** Live objects lack raw metadata (loss list in note72); checkpoint10 extends persistence. */
export function pokemonToPartyRecord(mon: BattlePokemon): PartyMonRecord {
  const species = POKEDEX_ORDER.indexOf(mon.species.id) + 1;
  if (!species || mon.species.id === 0) throw new BattleUnsupportedState('party species');
  const moves = Array(4).fill(0) as number[], pp = Array(4).fill(0) as number[];
  if (mon.moves.length > 4) throw new BattleUnsupportedState('party moves');
  mon.moves.forEach((move, i) => {
    const data = getMove(move.id); if (!data) throw new BattleUnsupportedState(`party move ${move.id}`);
    moves[i] = data.id; pp[i] = (derivePPUps(data.pp, move.maxPp) << 6) | (move.pp & 0x3f);
  });
  return { species, hp: mon.currentHp, boxLevel: mon.level, status: statusByte(mon),
    type1: typeByte(mon.species.type1), type2: typeByte(mon.species.type2), catchRate: mon.species.catchRate,
    moves, otId: mon.otId, exp: mon.exp, statExp: [...mon.statExp],
    dvs: [((mon.atkDV & 15) << 4) | (mon.defDV & 15), ((mon.spdDV & 15) << 4) | (mon.spcDV & 15)], pp,
    level: mon.level, maxHp: mon.maxHp, attack: mon.attack, defense: mon.defense, speed: mon.speed,
    special: mon.special, otName: nameBytes(mon.otName), nickname: nameBytes(mon.nickname) };
}

/** Plain decoded records compare by contents, independently of property insertion order. */
function sameContents(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.prototype.hasOwnProperty.call(b, key) && sameContents(a[key], b[key]));
}

/** Bytes are authoritative; update the menu cache without changing held object references. */
export function refreshPartyMon(state: BattleState, slot: number): BattlePokemon {
  const decoded = partyRecordToPokemon(decodePartyMon(state, slot));
  const current = state.partyMons[slot];
  if (!current) { state.partyMons[slot] = decoded; return decoded; }
  function update<K extends keyof BattlePokemon>(key: K): void {
    const before = current![key], after = decoded[key];
    const same = key === 'species' ? before === after :
      sameContents(before, after);
    if (!same) current![key] = after;
  }
  for (const key of Object.keys(decoded) as (keyof BattlePokemon)[]) update(key);
  return current;
}

/** RedrawPartyMenu_ reads the counted party afresh; later cache slots remain untouched. */
export function refreshPartyMirror(state: BattleState): BattlePokemon[] {
  const count = state.mem[A.wPartyCount];
  for (let slot = 0; slot < count; slot++) refreshPartyMon(state, slot);
  return state.partyMons.slice(0, count) as BattlePokemon[];
}
