// Unused world boundary; the low-level party codec must not depend on this module.
import { A, NAME_LENGTH, type BattleState } from './battle_state';
import { BattleUnsupportedState } from './battle_move_data';
import { createPokemon } from './data';
import type { BattlePokemon } from './types';
import { decodePrefix, encodePrefix, nameBytes, decodePartyMon, encodePartyMon, pokemonToPartyRecord,
  type PartyMonRecord, type BoxMonRecord } from './battle_party_codec';
export * from './battle_party_codec';
function boxAddresses(slot: number) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= 20) throw new BattleUnsupportedState('box slot');
  return { base: D.wBoxMons + slot * 33, ot: D.wBoxMonOT + slot * NAME_LENGTH, nick: I.wBoxMonNicks + slot * NAME_LENGTH };
}
export function decodeBoxMon(state: BattleState, slot: number): BoxMonRecord {
  const { base, ot, nick } = boxAddresses(slot); return decodePrefix(state, base, ot, nick);
}
export function encodeBoxMon(state: BattleState, slot: number, record: BoxMonRecord): void {
  const { base, ot, nick } = boxAddresses(slot); encodePrefix(state, base, ot, nick, record);
}
// Read-only live-owner shapes; importing types does not connect any live module.
import type { GameOptions } from '../menus/option_menu';
import type { ItemStack } from '../items';
import type { BoxedPokemon } from '../pokemon_storage';
import type { BattleTransitionData } from '../rom/extractors/battle_transitions';
import { BATTLE_ITEM_POINTERS } from './battle_items';
import { D } from './battle_end_state';
import { I } from './battle_item_state';
import { W_RIVAL_NAME, W_TRAINER_NO } from './battle_trainer_party';
import { readBattleBcd, writeBattleBcd } from './battle_faint';

let bridgeMapIds: Readonly<Record<string, number>> | undefined;
/** Committed data only. 08 loads this with the other battle tables before taking a world snapshot. */
export async function loadBattleBridgeData(): Promise<void> {
  if (bridgeMapIds) return;
  const response = await fetch('battle_transitions.json');
  if (!response.ok) throw new Error('battle transition map ids');
  const data: BattleTransitionData = await response.json(); bridgeMapIds = Object.freeze({ ...data.mapIds });
}
/** Names of the committed maps, not a second session-maintained map list. */
export function battleMapNames(): string[] {
  if (!bridgeMapIds) throw new Error('battle transition map ids not loaded');
  return Object.keys(bridgeMapIds);
}
/** ram_constants.asm:32-41; options.asm:102-211. Speaker bits4-5 are not exposed by our menu. */
export function packOptions(options: Readonly<GameOptions>): number {
  const speed = { FAST: 1, MID: 3, SLOW: 5 }[options.textSpeed];
  return speed | (options.battleStyle === 'SET' ? 0x40 : 0) | (options.animation === 'OFF' ? 0x80 : 0);
}
export function unpackOptions(byte: number): GameOptions {
  const speed = byte & 15;
  if (speed !== 1 && speed !== 3 && speed !== 5) throw new BattleUnsupportedState('text delay');
  return { textSpeed: speed === 1 ? 'FAST' : speed === 3 ? 'MID' : 'SLOW',
    battleStyle: byte & 0x40 ? 'SET' : 'SHIFT', animation: byte & 0x80 ? 'OFF' : 'ON' };
}
/** Snapshot only: no reference to a live owner is retained or changed by the encoder. */
export interface BattleWorld {
  readonly options: Readonly<GameOptions>;
  readonly badges: readonly string[];
  readonly mapName: string;
  readonly eventFlags: readonly string[];
  readonly pikachuHappiness: number;
  readonly pikachuMood: number;
  readonly pikachuEmotionModifier: number;
  readonly playerName: string;
  readonly rivalName: string;
  readonly gymLeaderNo: number;
  readonly partyIndex: number;
  readonly opponent: number;
  readonly enemyLevel: number;
  readonly party: readonly BattlePokemon[];
  readonly money: number;
  readonly seen: readonly number[];
  readonly owned: readonly number[];
  readonly bag: readonly Readonly<ItemStack>[];
  readonly pcBoxes: readonly (readonly BoxedPokemon[])[];
  readonly currentPcBox: number;
}
export interface BattleOutcome {
  readonly party: readonly PartyMonRecord[];
  readonly money: number;
  readonly seen: readonly number[];
  readonly owned: readonly number[];
  readonly bag: readonly ItemStack[];
  readonly box: readonly BoxMonRecord[];
  readonly pikachuHappiness: number;
  readonly pikachuMood: number;
  readonly pikachuEmotionModifier: number;
  readonly battleResult: number;
  readonly canEvolveFlags: number;
}
// event_constants.asm:33 ($2F),519 ($550); live spellings: viridian_city.ts and menus/pc.ts.
const INPUT_EVENTS = [['INITIAL_CATCH_TRAINING', 0x2f], ['MET_BILL', 0x550]] as const;
const EVENT_BASE = 0xd746;
function itemNumber(name: string): number {
  const key = name === 'PARALYZE_HEAL' ? 'PARLYZ_HEAL' : name;
  const row = BATTLE_ITEM_POINTERS.find(r => r.item === key);
  if (row) return row.id;
  const machine = /^(HM|TM)(\d{2})$/.exec(name);
  if (machine) {
    const n = Number(machine[2]), hm = machine[1] === 'HM';
    if (n >= 1 && n <= (hm ? 5 : 50)) return (hm ? 0xc3 : 0xc8) + n;
  }
  throw new BattleUnsupportedState(`battle item name ${name}`);
}
function itemString(id: number): string {
  const name = BATTLE_ITEM_POINTERS.find(r => r.id === id)?.item;
  if (name) return name === 'PARLYZ_HEAL' ? 'PARALYZE_HEAL' : name;
  if (id >= 0xc4 && id <= 0xc8) return `HM${String(id - 0xc3).padStart(2, '0')}`;
  if (id >= 0xc9 && id <= 0xfa) return `TM${String(id - 0xc8).padStart(2, '0')}`;
  throw new BattleUnsupportedState(`battle item id ${id}`);
}
function writeDex(state: BattleState, base: number, dex: readonly number[]): void {
  state.mem.fill(0, base, base + 19);
  for (const number of dex) {
    if (!Number.isInteger(number) || number < 1 || number > 151) throw new BattleUnsupportedState('dex number');
    const bit = number - 1; state.mem[base + (bit >> 3)] |= 1 << (bit & 7);
  }
}
function readDex(state: BattleState, base: number): number[] {
  return Array.from({ length: 151 }, (_, bit) => bit + 1).filter(number => {
    const bit = number - 1; return Boolean(state.mem[base + (bit >> 3)] & (1 << (bit & 7)));
  });
}
/** Only prefix cells are needed by battle. Missing boxed raw metadata is a checkpoint10 loss (note72). */
export function boxedPokemonToRecord(boxed: BoxedPokemon): BoxMonRecord {
  const mon = createPokemon(boxed.speciesName, boxed.level, boxed.nickname,
    { atk: boxed.atkDV, def: boxed.defDV, spd: boxed.spdDV, spc: boxed.spcDV });
  if (!mon) throw new BattleUnsupportedState(`boxed species ${boxed.speciesName}`);
  mon.currentHp = boxed.currentHp; mon.status = boxed.status; mon.exp = boxed.exp;
  mon.statExp = boxed.statExp ? [...boxed.statExp] : [0, 0, 0, 0, 0];
  mon.otName = boxed.otName ?? ''; mon.otId = boxed.otId ?? 0; mon.moves = boxed.moves.map(m => ({ ...m }));
  const { level: _level, maxHp: _hp, attack: _atk, defense: _def, speed: _spd, special: _spc, ...prefix } = pokemonToPartyRecord(mon);
  return prefix;
}
/** Before setupBattleBeforeTransition. Only these two event bits are battle inputs;08 leaves the live Set alone. */
export function writeBattleInputs(state: BattleState, world: BattleWorld): void {
  // menu_constants.asm:1 BAG_ITEM_CAPACITY=20; wram.asm reserves count +20 pairs +FF.
  if (world.bag.length > 20) throw new BattleUnsupportedState('bag exceeds cartridge capacity20');
  const box = world.pcBoxes[world.currentPcBox];
  if (!box || box.length > 20 || world.party.length > 6) throw new BattleUnsupportedState('party/box capacity');
  const map = bridgeMapIds?.[world.mapName];
  if (map === undefined) throw new BattleUnsupportedState(`battle map ${world.mapName}`);
  state.wOptions = packOptions(world.options);
  state.wObtainedBadges = Array.from({ length: 8 }, (_, i) => world.badges.includes(`BADGE_${i + 1}`) ? 1 << i : 0).reduce((a,b) => a | b, 0);
  state.wCurMap = map;
  for (const [name, bit] of INPUT_EVENTS) {
    const at = EVENT_BASE + (bit >> 3), mask = 1 << (bit & 7);
    state.mem[at] = (state.mem[at] & ~mask) | (world.eventFlags.includes(name) ? mask : 0);
  }
  state.mem[D.wPikachuHappiness] = world.pikachuHappiness; state.mem[D.wPikachuMood] = world.pikachuMood;
  state.mem[D.wPikachuEmotionModifier] = world.pikachuEmotionModifier;
  // Ownerless today: playerID0, Safari counts/factors0, modifier supplied as0 by08 until a prior outcome exists.
  state.writeBE(A.wPlayerID, 0); state.mem.set(nameBytes(world.playerName), A.wPlayerName);
  state.mem.set(nameBytes(world.rivalName), W_RIVAL_NAME);
  state.mem[D.wGymLeaderNo] = world.gymLeaderNo; state.mem[W_TRAINER_NO] = world.partyIndex + 1;
  state.wBattleType = 0; state.wNumSafariBalls = 0;
  state.mem[I.wSafariBaitFactor] = state.mem[I.wSafariEscapeFactor] = 0;
  state.wCurOpponent = world.opponent; state.wCurEnemyLevel = world.enemyLevel;
  writeBattleBcd(state, D.wPlayerMoney, world.money);
  writeDex(state, A.wPokedexSeen, world.seen); writeDex(state, I.wPokedexOwned, world.owned);
  state.setBag(world.bag.map(item => ({ id: itemNumber(item.id), quantity: item.count })));
  state.mem[D.wPartyCount] = world.party.length;
  world.party.forEach((mon, slot) => { const r = pokemonToPartyRecord(mon); encodePartyMon(state, slot, r); state.mem[D.wPartySpecies + slot] = r.species; });
  state.mem[D.wPartySpecies + world.party.length] = 255;
  state.mem[I.wBoxCount] = box.length;
  box.forEach((mon, slot) => { const r = boxedPokemonToRecord(mon); encodeBoxMon(state, slot, r); state.mem[I.wBoxSpecies + slot] = r.species; });
  state.mem[I.wBoxSpecies + box.length] = 255;
}
/** Call AFTER EndOfBattle: absolute final values, prize/Pay Day already included.08 must not re-apply happiness changes.
 * No event flags returned: the battle writes none;08 leaves every live string flag untouched. */
export function readBattleOutputs(state: BattleState): BattleOutcome {
  const partyCount = state.mem[D.wPartyCount], boxCount = state.mem[I.wBoxCount], bagCount = state.mem[A.wNumBagItems];
  if (partyCount > 6 || boxCount > 20 || bagCount > 20) throw new BattleUnsupportedState('output capacity');
  return { party: Array.from({ length: partyCount }, (_, slot) => decodePartyMon(state, slot)),
    money: readBattleBcd(state, D.wPlayerMoney), seen: readDex(state, A.wPokedexSeen), owned: readDex(state, I.wPokedexOwned),
    bag: Array.from({ length: bagCount }, (_, i) => ({ id: itemString(state.mem[A.wBagItems + i * 2]), count: state.mem[A.wBagItems + i * 2 + 1] })),
    box: Array.from({ length: boxCount }, (_, slot) => decodeBoxMon(state, slot)),
    pikachuHappiness: state.mem[D.wPikachuHappiness], pikachuMood: state.mem[D.wPikachuMood],
    pikachuEmotionModifier: state.mem[D.wPikachuEmotionModifier], battleResult: state.wBattleResult,
    canEvolveFlags: state.mem[D.wCanEvolveFlags] };
}
