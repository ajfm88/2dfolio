// Save/Load system — persists game state to localStorage

import type { Direction } from './core';
import type { BattlePokemon } from './battle';
import type { StatusCondition } from './battle/types';
import { createPokemon, initExperience } from './battle';
import { Bag } from './items';
import type { BoxedPokemon } from './menus';

const SAVE_KEY = 'p151-s';
const SAVE_VERSION = 1;

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
  otName?: string;
  otId?: number;
}

export interface SaveData {
  version: number;
  mapName: string;
  playerX: number;
  playerY: number;
  playerDirection: Direction;
  party: SavedPokemon[];
  bag: { id: string; count: number }[];
  money: number;
  defeatedTrainers: string[];
  eventFlags?: string[];
  pcItems?: { id: string; count: number }[];
  playTimeMs?: number;
  pikachuHappiness?: number;
  pikachuMood?: number;
  pcBoxes?: BoxedPokemon[][];
  currentPcBox?: number;
  pokedexSeen?: number[];
  pokedexOwned?: number[];
  playerName?: string;
  rivalName?: string;
  lastBlackoutWarp?: { destMap: string; destWarpId: number };
}

function serializePokemon(mon: BattlePokemon): SavedPokemon {
  return {
    speciesName: mon.species.name,
    nickname: mon.nickname,
    level: mon.level,
    currentHp: mon.currentHp,
    moves: mon.moves.map(m => ({ id: m.id, pp: m.pp, maxPp: m.maxPp })),
    status: mon.status,
    atkDV: mon.atkDV,
    defDV: mon.defDV,
    spdDV: mon.spdDV,
    spcDV: mon.spcDV,
    exp: mon.exp,
    otName: mon.otName,
    otId: mon.otId,
  };
}

function deserializePokemon(saved: SavedPokemon): BattlePokemon | null {
  const mon = createPokemon(
    saved.speciesName,
    saved.level,
    saved.nickname,
    { atk: saved.atkDV, def: saved.defDV, spd: saved.spdDV, spc: saved.spcDV },
  );
  if (!mon) return null;

  // Restore runtime state
  mon.currentHp = saved.currentHp;
  mon.status = saved.status;
  mon.exp = saved.exp;

  // Restore moves (createPokemon gives default moves; override with saved)
  mon.moves = saved.moves.map(m => ({ id: m.id, pp: m.pp, maxPp: m.maxPp }));

  // Restore OT info
  mon.otName = saved.otName ?? '';
  mon.otId = saved.otId ?? 0;

  // Init experience thresholds
  initExperience(mon);

  return mon;
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
): void {
  const data: SaveData = {
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
    pcBoxes,
    currentPcBox,
    pokedexSeen,
    pokedexOwned,
    playerName,
    rivalName,
    lastBlackoutWarp,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function loadGame(): SaveData | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as SaveData;
    if (data.version !== SAVE_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export function restoreParty(saved: SaveData): BattlePokemon[] {
  const party: BattlePokemon[] = [];
  for (const s of saved.party) {
    const mon = deserializePokemon(s);
    if (mon) party.push(mon);
  }
  return party;
}

export function restoreBag(saved: SaveData): Bag {
  const bag = new Bag();
  for (const item of saved.bag) {
    bag.add(item.id, item.count);
  }
  return bag;
}

export function hasSavedGame(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}
