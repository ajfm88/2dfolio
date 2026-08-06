export const SPRITE_ASSETS = {
  link: '/assets/sprites/link.png',
  enemies: '/assets/sprites/enemies.png',
  enemyDies: '/assets/sprites/enemy-dies.png',
  npcs: '/assets/sprites/npcs.png',
  treasures: '/assets/sprites/treasures.png',
  font: '/assets/sprites/font.png',
  bosses: '/assets/sprites/bosses.png',
  dungeonEnemies: '/assets/sprites/dungeon-enemies.png',
  overworldEnemies: '/assets/sprites/overworld-enemies.png',
  overworldEnemiesAlt: '/assets/sprites/overworld-enemies-alt.png',
  treasuresFull: '/assets/sprites/treasures-full.png',
  itemDrops: '/assets/sprites/item-drops.png',
  linkFull: '/assets/sprites/link-full.png',
  linkAlt: '/assets/sprites/link-alt.png',
  items: '/assets/sprites/items.png',
  projectiles: '/assets/sprites/projectiles.png',
  cloud: '/assets/sprites/cloud.png',
  swordBeamExp: '/assets/sprites/sword-beam-exp.png',
  enemySpawn: '/assets/sprites/enemy-spawn.png',
} as const;

export const TILE_ASSETS = {
  overworld: '/assets/tiles/overworld.png',
  dungeon1: '/assets/tiles/dungeon-1.png',
  dungeon2: '/assets/tiles/dungeon-2.png',
  dungeonTiles: '/assets/tiles/dungeon-tiles.png',
  dungeonsFull: '/assets/tiles/dungeons-full.png',
  dungeonTilesAlt: '/assets/tiles/dungeon-tiles-alt.png',
  dungeonDoors: '/assets/tiles/dungeon-doors.png',
} as const;

export const UI_ASSETS = {
  hud: '/assets/ui/hud.png',
  title: '/assets/ui/title.png',
  crest: '/assets/ui/crest.png',
} as const;

export const MAP_ASSETS = {
  overworldMap: '/assets/maps/overworld-map.png',
  dungeonsMap: '/assets/maps/dungeons-map.png',
  caveMap: '/assets/maps/cave-map.png',
} as const;

export const SFX_ASSETS = {
  sword: '/assets/audio/sfx/sword.wav',
  swordShoot: '/assets/audio/sfx/sword-shoot.wav',
  enemyKill: '/assets/audio/sfx/enemy-kill.wav',
  enemyHit: '/assets/audio/sfx/enemy-hit.wav',
  stairs: '/assets/audio/sfx/stairs.wav',
  linkDie: '/assets/audio/sfx/link-die.wav',
  text: '/assets/audio/sfx/text.wav',
  linkHurt: '/assets/audio/sfx/link-hurt.wav',
  shield: '/assets/audio/sfx/shield.wav',
  getRupee: '/assets/audio/sfx/get-rupee.wav',
  getHeart: '/assets/audio/sfx/get-heart.wav',
  bombDrop: '/assets/audio/sfx/bomb-drop.wav',
  bombBlow: '/assets/audio/sfx/bomb-blow.wav',
  getItem: '/assets/audio/sfx/get-item.wav',
  rupeesChanging: '/assets/audio/sfx/rupees-changing.wav',
  rupeesDecreasingEnd: '/assets/audio/sfx/rupees-decreasing-end.wav',
  secret: '/assets/audio/sfx/secret.wav',
  arrow: '/assets/audio/sfx/arrow.wav',
  boomerang: '/assets/audio/sfx/boomerang.wav',
  bossScream1: '/assets/audio/sfx/boss-scream-1.wav',
  bossScream2: '/assets/audio/sfx/boss-scream-2.wav',
  candle: '/assets/audio/sfx/candle.wav',
  fanfare: '/assets/audio/sfx/fanfare.wav',
  key: '/assets/audio/sfx/key.wav',
  lowHealth: '/assets/audio/sfx/low-health.wav',
  magicalRod: '/assets/audio/sfx/magical-rod.wav',
  recorder: '/assets/audio/sfx/recorder.wav',
  refillLoop: '/assets/audio/sfx/refill-loop.wav',
  swordCombined: '/assets/audio/sfx/sword-combined.wav',
  unlock: '/assets/audio/sfx/unlock.wav',
} as const;

export const MUSIC_ASSETS = {
  overworld: '/assets/audio/music/overworld.ogg',
  dungeon: '/assets/audio/music/dungeon.ogg',
} as const;

export type SpriteAssetKey = keyof typeof SPRITE_ASSETS;
export type TileAssetKey = keyof typeof TILE_ASSETS;
export type UiAssetKey = keyof typeof UI_ASSETS;
export type MapAssetKey = keyof typeof MAP_ASSETS;
export type SfxAssetKey = keyof typeof SFX_ASSETS;
export type MusicAssetKey = keyof typeof MUSIC_ASSETS;

export interface LoadedAssets {
  sprites: Record<SpriteAssetKey, HTMLImageElement>;
  tiles: Record<TileAssetKey, HTMLImageElement>;
  ui: Record<UiAssetKey, HTMLImageElement>;
  maps: Record<MapAssetKey, HTMLImageElement>;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

async function loadImageMap<T extends Record<string, string>>(
  manifest: T,
  onProgress?: (loaded: number, total: number) => void,
): Promise<Record<keyof T, HTMLImageElement>> {
  const entries = Object.entries(manifest) as [keyof T, string][];
  const result = {} as Record<keyof T, HTMLImageElement>;
  let loaded = 0;

  const promises = entries.map(async ([key, path]) => {
    const img = await loadImage(path);
    result[key] = img;
    loaded++;
    onProgress?.(loaded, entries.length);
  });

  await Promise.all(promises);
  return result;
}

export async function loadAllAssets(
  onProgress?: (loaded: number, total: number) => void,
): Promise<LoadedAssets> {
  const totalImages =
    Object.keys(SPRITE_ASSETS).length +
    Object.keys(TILE_ASSETS).length +
    Object.keys(UI_ASSETS).length +
    Object.keys(MAP_ASSETS).length;

  let globalLoaded = 0;
  const track = () => {
    globalLoaded++;
    onProgress?.(globalLoaded, totalImages);
  };

  const [sprites, tiles, ui, maps] = await Promise.all([
    loadImageMap(SPRITE_ASSETS, () => track()),
    loadImageMap(TILE_ASSETS, () => track()),
    loadImageMap(UI_ASSETS, () => track()),
    loadImageMap(MAP_ASSETS, () => track()),
  ]);

  return { sprites, tiles, ui, maps };
}
