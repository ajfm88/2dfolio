// Save/Load system — persists game state to localStorage

import type { Direction } from './core';
import type { BattlePokemon } from './battle';
import type { StatExperience, StatusCondition } from './battle/types';
import { A, BattleState, NAME_LENGTH, PARTYMON_STRUCT_LENGTH } from './battle/battle_state';
import { worldPartyRecord, boxedPokemonToRecord, encodePartyMon, decodePartyMon,
  encodeBoxMon, decodeBoxMon } from './battle/battle_bridge';
import { partyRecordToPokemon } from './battle/battle_party_codec';
import { boxRecordToPokemon, liveNickname } from './battle/battle_live';
import { BattleUnsupportedState } from './battle/battle_move_data';
import { D } from './battle/battle_end_state';
import { I } from './battle/battle_item_state';
import { boxStatsMon } from './pokemon_transfers';
import { Bag } from './items';
import type { BoxedPokemon } from './pokemon_storage';

const SAVE_KEY = 'p151-s';
const SAVE_VERSION = 2;

interface SavedPokemon {
  speciesName: string;
  nickname: string;
  level: number;
  currentHp: number;
  moves: { id: string; pp: number; maxPp: number }[];
  status: StatusCondition;
  atkDV: number;
  defDV: number;
  spdDV: number;
  spcDV: number;
  exp: number;
  statExp?: StatExperience;
  otName?: string;
  otId?: number;
}

interface SaveFields {
  mapName: string;
  playerX: number;
  playerY: number;
  playerDirection: Direction;
  bag: { id: string; count: number }[];
  money: number;
  defeatedTrainers: string[];
  eventFlags?: string[];
  pcItems?: { id: string; count: number }[];
  playTimeMs?: number;
  pikachuHappiness?: number;
  pikachuMood?: number;
  currentPcBox?: number;
  pokedexSeen?: number[];
  pokedexOwned?: number[];
  playerName?: string;
  rivalName?: string;
  lastBlackoutWarp?: { destMap: string; destWarpId: number };
  rivalStarter?: number;
  /** Each map's resting w<Map>CurScript (events.ts), since V1e. */
  mapScripts?: Record<string, number>;
  /** HideObject keys (Map:npcId), since A1b; missing on old saves. */
  hiddenObjects?: string[];
}

type LegacyBoxedPokemon = Omit<BoxedPokemon, 'sleepTurns'> & { sleepTurns?: number };
export interface SavedMonBytes { mon: number[]; ot: number[]; nick: number[] }
export interface SaveDataV1 extends SaveFields {
  version: 1;
  party: SavedPokemon[];
  pcBoxes?: LegacyBoxedPokemon[][];
}
export interface SaveDataV2 extends SaveFields {
  version: 2;
  party: SavedMonBytes[];
  pcBoxes: SavedMonBytes[][];
  options: number;
  pikachuEmotionModifier: number;
}
export type SaveData = SaveDataV1 | SaveDataV2;

const PARTY = {base:A.wPartyMons,ot:A.wPartyMonOT,nick:A.wPartyMonNicks,size:PARTYMON_STRUCT_LENGTH};
const BOX = {base:D.wBoxMons,ot:D.wBoxMonOT,nick:I.wBoxMonNicks,size:33};
interface RecordAddresses { base:number;ot:number;nick:number;size:number }
function stored(state:BattleState,where:RecordAddresses):SavedMonBytes {
  return {mon:[...state.mem.slice(where.base,where.base+where.size)],
    ot:[...state.mem.slice(where.ot,where.ot+NAME_LENGTH)],nick:[...state.mem.slice(where.nick,where.nick+NAME_LENGTH)]};
}
function readStored(record:SavedMonBytes,where:RecordAddresses):BattleState {
  const state=new BattleState();
  for(const [bytes,base,length] of [[record.mon,where.base,where.size],[record.ot,where.ot,NAME_LENGTH],
    [record.nick,where.nick,NAME_LENGTH]] as const){
    if(!Array.isArray(bytes)||bytes.length!==length||bytes.some(b=>!Number.isInteger(b)||b<0||b>255))
      throw new BattleUnsupportedState('saved mon bytes');
    state.mem.set(bytes,base);
  }
  return state;
}
function serializePokemon(mon:BattlePokemon):SavedMonBytes {
  const state=new BattleState();encodePartyMon(state,0,worldPartyRecord(mon));return stored(state,PARTY);
}
function serializeBoxed(mon:BoxedPokemon):SavedMonBytes {
  const state=new BattleState();encodeBoxMon(state,0,boxedPokemonToRecord(mon));return stored(state,BOX);
}
function restoreLegacyMon(saved:SavedPokemon):BattlePokemon {
  // Version-1 migration value, not cartridge behaviour: old saves omitted sleep turns.
  return boxStatsMon({...saved,maxHp:0,sleepTurns:saved.status==='SLP'?1:0});
}

export function saveGame(
  mapName: string,
  playerX: number,
  playerY: number,
  playerDirection: Direction,
  party: BattlePokemon[],
  bag: Bag,
  money: number,
  defeatedTrainers: Set<string>,
  eventFlags?: string[],
  pcItems?: { id: string; count: number }[],
  playTimeMs?: number,
  pikachuHappiness?: number,
  pikachuMood?: number,
  pcBoxes?: BoxedPokemon[][],
  currentPcBox?: number,
  pokedexSeen?: number[],
  pokedexOwned?: number[],
  playerName?: string,
  rivalName?: string,
  lastBlackoutWarp?: { destMap: string; destWarpId: number },
  rivalStarter?: number,
  mapScripts?: Record<string, number>,
  hiddenObjects?: string[],
  options: number = 3,
  pikachuEmotionModifier: number = 0,
): void {
  const data: SaveDataV2 = {
    version: SAVE_VERSION,
    mapName,
    playerX,
    playerY,
    playerDirection,
    party: party.map(serializePokemon),
    bag: bag.items.map(i => ({ id: i.id, count: i.count })),
    money,
    defeatedTrainers: [...defeatedTrainers],
    eventFlags,
    pcItems: pcItems?.map(i => ({ id: i.id, count: i.count })),
    playTimeMs,
    pikachuHappiness,
    pikachuMood,
    pcBoxes: (pcBoxes ?? []).map(box=>box.map(serializeBoxed)),
    currentPcBox,
    pokedexSeen,
    pokedexOwned,
    playerName,
    rivalName,
    lastBlackoutWarp,
    rivalStarter,
    mapScripts,
    hiddenObjects,
    options,
    pikachuEmotionModifier,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function loadGame(): SaveData | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as SaveData;
    if (data.version !== 1 && data.version !== SAVE_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export function restoreParty(saved: SaveData): BattlePokemon[] {
  if(saved.version===1)return saved.party.map(restoreLegacyMon);
  return saved.party.map(bytes=>{
    const record=decodePartyMon(readStored(bytes,PARTY),0),mon=partyRecordToPokemon(record);
    mon.nickname=liveNickname(record,mon.species.name);return mon;
  });
}

export function restoreBoxes(saved:SaveData):BoxedPokemon[][] {
  if(saved.version===1)return (saved.pcBoxes??[]).map(box=>box.map(mon=>({
    ...mon,
    // Version-1 migration value, not cartridge behaviour: old saves omitted sleep turns.
    sleepTurns:mon.sleepTurns??(mon.status==='SLP'?1:0),
    moves:mon.moves.map(move=>({...move})),statExp:mon.statExp?[...mon.statExp]:undefined,
  })));
  return saved.pcBoxes.map(box=>box.map(bytes=>boxRecordToPokemon(decodeBoxMon(readStored(bytes,BOX),0))));
}

export function restoreBag(saved: SaveData): Bag {
  const bag = new Bag();
  // Saves hold the inventory's slots, not a sequence of GiveItem requests.
  bag.items = saved.bag.map(item => ({ id: item.id, count: item.count }));
  return bag;
}

export function hasSavedGame(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}
