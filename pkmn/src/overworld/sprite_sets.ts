import type { MapSpriteSetsFile } from '../rom/extractors/map_sprite_sets';

/** CopyVideoData (home/copy2.asm): the final <8 branch delays even at zero tiles. */
export function copyFrames(tiles: number): number { return Math.floor(tiles / 8) + 1; }
/** CloseTextDisplay: window 1 + W walking halves × 2 + walking player 4. */
export function closeFrames(w: number): number { return 1 + 2 * w + 4; }
export function walkingCopies(slots: readonly number[]): number {
  return slots.slice(0, 9).filter(id => id !== 0).length;
}
/** LoadSpriteSetFromMapHeader: 14 source slots, deduped in separate 9/2 regions. */
export function allocateSlots(pikachuId: number, kindOf: (id: number) => 'walking' | 'still', live: readonly number[]): number[] {
  const slots = Array<number>(11).fill(0);
  slots[0] = pikachuId;
  for (const id of live.slice(0, 14)) {
    if (id === 0) continue;
    const still = kindOf(id) === 'still';
    const start = still ? 9 : 0, region = still ? 2 : 9;
    for (let i = 0; i < region; i++) {
      if (slots[start + i] === id || slots[start + i] === 0) { slots[start + i] = id; break; }
    }
  }
  return slots;
}
export function selectOutdoor(file: MapSpriteSetsFile, mapId: number, x: number, y: number): number {
  if (mapId >= file.firstIndoorMapId) throw new Error(`map ${mapId} is indoor`);
  const selector = file.outdoorSetIds[mapId];
  if (selector < 0xf1) return selector;
  if (selector === file.route20.splitSetId) {
    const [west, middle, east] = file.route20.xCuts;
    if (x < west) return file.route20.westSetId;
    if (x >= east) return file.route20.eastSetId;
    const cut = x < middle ? file.route20.yCuts[0] : file.route20.yCuts[1];
    return y < cut ? file.route20.eastSetId : file.route20.westSetId;
  }
  const split = file.splitSets[selector];
  return (split.axis === 'x' ? x : y) < split.divider ? split.belowSetId : split.atOrAboveSetId;
}
function mapSlots(file: MapSpriteSetsFile, mapName: string, step: { x: number; y: number }, walkState: number): { indoor: boolean; slots: number[] } {
  // Biking/surfing and BIT_FLY_WARP need their own reloads with those mechanics.
  if (walkState !== 0) throw new Error('text close requires the walking player (bike/surf audit pending)');
  const id = file.mapIds[mapName];
  if (id === undefined) throw new Error(`missing sprite set map ${mapName}`);
  if (id < file.firstIndoorMapId) return { indoor: false, slots: file.spriteSets[selectOutdoor(file, id, step.x, step.y)] };
  return { indoor: true, slots: allocateSlots(file.pikachuPictureId, picture => {
    const meta = file.pictures[picture];
    if (!meta) throw new Error(`malformed picture id ${picture}`);
    return meta.kind;
  }, file.mapObjects[mapName]) };
}
export function mapCloseFrames(file: MapSpriteSetsFile, mapName: string, step: { x: number; y: number }, walkState = 0): number {
  return closeFrames(walkingCopies(mapSlots(file, mapName, step, walkState).slots));
}
/**
 * CloseTextDisplay with BIT_FONT_LOADED already clear (TownMapText's handler closes once itself,
 * then DisplayTextID closes again). Indoors, LoadMapSpriteTilePatterns now copies each walking
 * slot's still half too (12 + 12 tiles) and each four-tile picture; outdoors,
 * InitOutsideMapSprites skips a sprite set that has not changed. Then the walking player (4).
 */
export function fullReloadCloseFrames(file: MapSpriteSetsFile, mapName: string, step: { x: number; y: number }, walkState = 0): number {
  const { indoor, slots } = mapSlots(file, mapName, step, walkState);
  if (!indoor) return 1 + 2 * copyFrames(12);
  const still = slots.slice(9).filter(id => id !== 0).length;
  return 1 + walkingCopies(slots) * 2 * copyFrames(12) + still * copyFrames(4) + 2 * copyFrames(12);
}
let data: MapSpriteSetsFile | null = null;
export async function loadMapSpriteSets(): Promise<void> {
  const response = await fetch('map_sprite_sets.json');
  if (!response.ok) throw new Error(`map sprite sets: HTTP ${response.status}`);
  data = await response.json() as MapSpriteSetsFile;
}
export type CloseReload = 'fontLoaded' | 'full';
export function currentMapCloseFrames(mapName: string, step: { x: number; y: number }, reload: CloseReload = 'fontLoaded'): number {
  if (!data) throw new Error('map sprite sets not loaded');
  return reload === 'full' ? fullReloadCloseFrames(data, mapName, step) : mapCloseFrames(data, mapName, step);
}
