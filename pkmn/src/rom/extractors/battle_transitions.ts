// GetBattleTransitionID_IsDungeonMap's literal lists, including its missing-map bug.
import { BinaryReader } from '../binary_reader';
import { DUNGEON_MAPS_1, DUNGEON_MAPS_2, BATTLE_TRANSITION_TILE } from '../rom_offsets';
import { EXTRACTABLE_MAPS, extractMapObjectPictures } from './maps';

export interface BattleTransitionData {
  dungeonMaps: number[];
  dungeonRanges: [number, number][];
  mapIds: Record<string, number>;
  mapObjectCounts: Record<string, number>;
}

export function extractBattleTransitions(rom: BinaryReader): BattleTransitionData {
  const dungeonMaps: number[] = [];
  for (let p = DUNGEON_MAPS_1; ; p++) {
    if (p >= DUNGEON_MAPS_2) throw new Error('DungeonMaps1: missing terminator');
    const id = rom.readByte(p);
    if (id === 0xff) break;
    dungeonMaps.push(id);
  }
  const dungeonRanges: [number, number][] = [];
  for (let p = DUNGEON_MAPS_2; ; p += 2) {
    if (p >= BATTLE_TRANSITION_TILE) throw new Error('DungeonMaps2: missing terminator');
    const start = rom.readByte(p);
    if (start === 0xff) break;
    const end = rom.readByte(p + 1);
    if (start > end || end === 0xff) throw new Error('DungeonMaps2: invalid inclusive pair');
    dungeonRanges.push([start, end]);
  }
  // LoadBattleTransitionTile: both bitplanes set, all 64 pixels are colour index 3.
  for (let i = 0; i < 16; i++) {
    if (rom.readByte(BATTLE_TRANSITION_TILE + i) !== 0xff)
      throw new Error('BattleTransitionTile: expected sixteen $ff bytes');
  }
  const mapObjectCounts = Object.fromEntries(Object.keys(EXTRACTABLE_MAPS).map(name =>
    [name, extractMapObjectPictures(rom, name).length]));
  return { dungeonMaps, dungeonRanges, mapIds: { ...EXTRACTABLE_MAPS }, mapObjectCounts };
}
