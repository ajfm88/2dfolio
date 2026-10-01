import type { MapData, MapConnection, Blockset, CollisionData, HiddenEvent } from '../core';
import { TILE_SIZE, BLOCK_SIZE, BLOCK_PX, GB_WIDTH, GB_HEIGHT } from '../core';
import { drawTile, loadTileset, loadTilesetTransparent } from '../renderer';
import { getText } from '../text';

const TILESET_FILES: Record<string, string> = {
  OVERWORLD: 'overworld', REDS_HOUSE_1: 'reds_house', REDS_HOUSE_2: 'reds_house',
  HOUSE: 'house', LAB: 'lab', MART: 'pokecenter', POKECENTER: 'pokecenter',
  GYM: 'gym', FOREST: 'forest', FOREST_GATE: 'gate', MUSEUM: 'gate',
  UNDERGROUND: 'underground', GATE: 'gate', SHIP: 'ship', SHIP_PORT: 'ship_port',
  CEMETERY: 'cemetery', INTERIOR: 'interior', CAVERN: 'cavern', LOBBY: 'lobby',
  MANSION: 'mansion', CLUB: 'club', FACILITY: 'facility', PLATEAU: 'plateau',
  DOJO: 'gym', BEACH_HOUSE: 'beach_house',
};

const TILESET_BLOCKSET: Record<string, string> = {
  OVERWORLD: 'overworld', REDS_HOUSE_1: 'reds_house', REDS_HOUSE_2: 'reds_house',
  HOUSE: 'house', LAB: 'lab', DOJO: 'gym', GYM: 'gym',
  MART: 'pokecenter', POKECENTER: 'pokecenter',
  FOREST: 'forest', FOREST_GATE: 'gate', MUSEUM: 'gate', GATE: 'gate',
};

// Grass tile IDs per tileset (for wild encounter triggering)
const GRASS_TILES: Record<string, number> = {
  OVERWORLD: 0x52,
  FOREST: 0x20,
  PLATEAU: 0x45,
};

// Door tile IDs per tileset (from data/tilesets/door_tile_ids.asm).
// When the player warps onto one of these tiles, they auto-step one tile down
// (matching assembly PlayerStepOutFromDoor → IsPlayerStandingOnDoorTile).
const DOOR_TILES: Record<string, number[]> = {
  OVERWORLD:    [0x1B, 0x58],
  FOREST:       [0x3A],
  MART:         [0x5E],
  HOUSE:        [0x54],
  FOREST_GATE:  [0x3B],
  MUSEUM:       [0x3B],
  GATE:         [0x3B],
  SHIP:         [0x1E],
  LOBBY:        [0x1C, 0x38, 0x1A],
  MANSION:      [0x1A, 0x1C, 0x53],
  LAB:          [0x34],
  FACILITY:     [0x43, 0x58, 0x1B],
  PLATEAU:      [0x3B, 0x1B],
  INTERIOR:     [0x04, 0x15],
};

// Tiles that trigger an immediate warp when stepped on (no second press needed).
// Union of door_tile_ids.asm + warp_tile_ids.asm per tileset.
// Tiles NOT in this list at warp positions require pressing a direction again to warp
// (matches original CheckWarpsNoCollision → IsPlayerStandingOnDoorTileOrWarpTile logic).
const INSTANT_WARP_TILES: Record<string, number[]> = {
  OVERWORLD:    [0x1B, 0x58],
  REDS_HOUSE_1: [0x1A, 0x1C],
  REDS_HOUSE_2: [0x1A, 0x1C],
  MART:         [0x5E],
  POKECENTER:   [0x5E],
  FOREST:       [0x3A, 0x5A, 0x5C],
  HOUSE:        [0x54, 0x5C, 0x32],
  GYM:          [0x4A],
  DOJO:         [0x4A],
  FOREST_GATE:  [0x3B, 0x1A, 0x1C],
  MUSEUM:       [0x3B, 0x1A, 0x1C],
  GATE:         [0x3B, 0x1A, 0x1C],
  LAB:          [0x34],
  SHIP:         [0x1E, 0x37, 0x39, 0x4A],
  LOBBY:        [0x1A, 0x1C, 0x38],
  MANSION:      [0x1A, 0x1C, 0x53],
  FACILITY:     [0x43, 0x58, 0x1B, 0x20, 0x13],
  CEMETERY:     [0x1B, 0x13],
  UNDERGROUND:  [0x13],
  PLATEAU:      [0x1B, 0x3B],
  INTERIOR:     [0x04, 0x15, 0x55],
  CAVERN:       [0x18, 0x1A, 0x22],
};

// Ledge tiles: [direction, tile_standing_on, ledge_tile_in_front]
// From data/tilesets/ledge_tiles.asm — OVERWORLD tileset only
type LedgeDirection = 'down' | 'left' | 'right';
const LEDGE_TILES: [LedgeDirection, number, number][] = [
  ['down',  0x2C, 0x37],
  ['down',  0x39, 0x36],
  ['down',  0x39, 0x37],
  ['left',  0x2C, 0x27],
  ['left',  0x39, 0x27],
  ['right', 0x2C, 0x0D],
  ['right', 0x2C, 0x1D],
  ['right', 0x39, 0x0D],
];

// Bookshelf tile IDs per tileset (from data/tilesets/bookshelf_tile_ids.asm)
// Maps tileset name → array of [tileId, textKey]
const BOOKSHELF_TILES: Record<string, [number, string][]> = {
  PLATEAU:    [[0x30, 'STATUES']],
  HOUSE:      [[0x3D, 'TOWN_MAP'], [0x1E, 'BOOKS']],
  MANSION:    [[0x32, 'BOOKS']],
  REDS_HOUSE_1: [[0x32, 'BOOKS']],
  LAB:        [[0x28, 'BOOKS']],
  LOBBY:      [[0x16, 'ELEVATOR'], [0x50, 'POKEMON_STUFF'], [0x52, 'POKEMON_STUFF']],
  GYM:        [[0x1D, 'BOOKS']],
  DOJO:       [[0x1D, 'BOOKS']],
  GATE:       [[0x22, 'BOOKS']],
  MART:       [[0x54, 'POKEMON_STUFF'], [0x55, 'POKEMON_STUFF']],
  POKECENTER: [[0x54, 'POKEMON_STUFF'], [0x55, 'POKEMON_STUFF']],
  SHIP:       [[0x36, 'BOOKS']],
};

const BOOKSHELF_TEXT: Record<string, string | (() => string)> = {
  BOOKS: () => getText('BOOKSHELF_BOOKS'),
  TOWN_MAP: 'A TOWN MAP.',
  POKEMON_STUFF: () => getText('BOOKSHELF_POKEMON_STUFF'),
  ELEVATOR: 'This is an\nelevator.',
  STATUES: () => getText('BOOKSHELF_STATUES'),
};

const COLLISION_NAMES: Record<string, string> = {
  OVERWORLD: 'Overworld', REDS_HOUSE_1: 'RedsHouse2', REDS_HOUSE_2: 'RedsHouse2',
  HOUSE: 'House', LAB: 'Lab', MART: 'Pokecenter', POKECENTER: 'Pokecenter',
  GYM: 'Gym', FOREST: 'Forest', FOREST_GATE: 'Gate', MUSEUM: 'Gate',
  UNDERGROUND: 'Underground', GATE: 'Gate', SHIP: 'Ship', SHIP_PORT: 'ShipPort',
  CEMETERY: 'Cemetery', INTERIOR: 'Interior', CAVERN: 'Cavern', LOBBY: 'Lobby',
  MANSION: 'Mansion', CLUB: 'Club', FACILITY: 'Facility', PLATEAU: 'Plateau',
  DOJO: 'Gym', BEACH_HOUSE: 'BeachHouse',
};

async function fetchJson<T>(url: string): Promise<T> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status} ${resp.statusText}`);
  return resp.json();
}

// Asset caches
const blocksetCache = new Map<string, Blockset>();
const mapDataCache = new Map<string, MapData>();
let collisionData: CollisionData | null = null;

// Loaded connection data for rendering adjacent maps at edges
interface LoadedConnection {
  direction: 'north' | 'south' | 'east' | 'west';
  offset: number;
  mapData: MapData;
  blockset: Blockset;
}

export class GameMap {
  mapData: MapData | null = null;
  tileset: HTMLCanvasElement | null = null;
  private tilesetTransparent: HTMLCanvasElement | null = null;
  blockset: Blockset | null = null;
  collisionTiles: Set<number> = new Set();
  private connectedMaps: LoadedConnection[] = [];

  async load(mapName: string): Promise<void> {
    // Load collision data (once)
    if (!collisionData) {
      collisionData = await fetchJson<CollisionData>('collision_tiles.json');
    }

    // Load map JSON
    if (!mapDataCache.has(mapName)) {
      mapDataCache.set(mapName, await fetchJson<MapData>(`maps/${mapName}.json`));
    }
    this.mapData = mapDataCache.get(mapName)!;

    // Load tileset image (renderer caches by url+palette)
    const tilesetId = this.mapData.tileset;
    const tilesetFile = TILESET_FILES[tilesetId] ?? tilesetId.toLowerCase();
    this.tileset = await loadTileset(`/gfx/tilesets/${tilesetFile}.png`);
    this.tilesetTransparent = await loadTilesetTransparent(`/gfx/tilesets/${tilesetFile}.png`);

    // Load blockset
    const blocksetFile = TILESET_BLOCKSET[tilesetId] ?? tilesetFile;
    if (!blocksetCache.has(blocksetFile)) {
      blocksetCache.set(blocksetFile, await fetchJson<Blockset>(`blockset_${blocksetFile}.json`));
    }
    this.blockset = blocksetCache.get(blocksetFile)!;

    // Load collision tiles
    const collName = COLLISION_NAMES[tilesetId] ?? 'Overworld';
    this.collisionTiles = new Set(collisionData![collName] ?? []);

    // Load connected maps for edge rendering
    await this.loadConnectedMaps();
  }

  /** Load map data for all connections so we can render them at edges. */
  private async loadConnectedMaps(): Promise<void> {
    this.connectedMaps = [];
    if (!this.mapData?.connections) return;

    for (const conn of this.mapData.connections) {
      try {
        if (!mapDataCache.has(conn.mapName)) {
          mapDataCache.set(conn.mapName, await fetchJson<MapData>(`maps/${conn.mapName}.json`));
        }
        const connMapData = mapDataCache.get(conn.mapName)!;

        // Load connected map's blockset
        const connTilesetId = connMapData.tileset;
        const connBlocksetFile = TILESET_BLOCKSET[connTilesetId] ??
          (TILESET_FILES[connTilesetId] ?? connTilesetId.toLowerCase());
        if (!blocksetCache.has(connBlocksetFile)) {
          blocksetCache.set(connBlocksetFile, await fetchJson<Blockset>(`blockset_${connBlocksetFile}.json`));
        }

        this.connectedMaps.push({
          direction: conn.direction,
          offset: conn.offset,
          mapData: connMapData,
          blockset: blocksetCache.get(connBlocksetFile)!,
        });
      } catch {
        // Connected map not available yet — skip silently
      }
    }
  }

  get width(): number { return this.mapData?.width ?? 0; }
  get height(): number { return this.mapData?.height ?? 0; }
  get widthPx(): number { return this.width * BLOCK_PX; }
  get heightPx(): number { return this.height * BLOCK_PX; }

  getBlock(bx: number, by: number): number {
    if (!this.mapData) return 0;
    if (bx < 0 || bx >= this.width || by < 0 || by >= this.height) {
      return this.mapData.borderBlock ?? 0;
    }
    return this.mapData.blocks[by * this.width + bx];
  }

  /** Look up a tile from a specific map's block data + blockset. */
  private static tileFromMap(
    mapData: MapData, blockset: Blockset, tx: number, ty: number,
  ): number | null {
    const w = mapData.width;
    const h = mapData.height;
    const bx = Math.floor(tx / BLOCK_SIZE);
    const by = Math.floor(ty / BLOCK_SIZE);
    if (bx < 0 || bx >= w || by < 0 || by >= h) return null;
    const blockId = mapData.blocks[by * w + bx];
    if (blockId >= blockset.length) return 0;
    const localTx = tx - bx * BLOCK_SIZE;
    const localTy = ty - by * BLOCK_SIZE;
    return blockset[blockId][localTy * BLOCK_SIZE + localTx];
  }

  /** Get tile for out-of-bounds coordinates by checking connected maps. */
  private getConnectedTile(tx: number, ty: number): number | null {
    const curW = this.widthTiles;
    const curH = this.heightTiles;

    for (const conn of this.connectedMaps) {
      let connTx: number, connTy: number;
      const o = conn.offset * BLOCK_SIZE;

      switch (conn.direction) {
        case 'north':
          if (ty >= 0) continue;
          connTx = tx - o;
          connTy = ty + conn.mapData.height * BLOCK_SIZE;
          break;
        case 'south':
          if (ty < curH) continue;
          connTx = tx - o;
          connTy = ty - curH;
          break;
        case 'west':
          if (tx >= 0) continue;
          connTx = tx + conn.mapData.width * BLOCK_SIZE;
          connTy = ty - o;
          break;
        case 'east':
          if (tx < curW) continue;
          connTx = tx - curW;
          connTy = ty - o;
          break;
        default:
          continue;
      }

      const tile = GameMap.tileFromMap(conn.mapData, conn.blockset, connTx, connTy);
      if (tile !== null) return tile;
    }
    return null;
  }

  getTileAt(tx: number, ty: number): number {
    if (!this.blockset) return 0;
    const bx = Math.floor(tx / BLOCK_SIZE);
    const by = Math.floor(ty / BLOCK_SIZE);

    // In-bounds: use current map directly
    if (bx >= 0 && bx < this.width && by >= 0 && by < this.height) {
      const blockId = this.mapData!.blocks[by * this.width + bx];
      if (blockId >= this.blockset.length) return 0;
      const localTx = tx - bx * BLOCK_SIZE;
      const localTy = ty - by * BLOCK_SIZE;
      return this.blockset[blockId][localTy * BLOCK_SIZE + localTx];
    }

    // Out-of-bounds: try connected maps, fall back to border block
    const connTile = this.getConnectedTile(tx, ty);
    if (connTile !== null) return connTile;

    const blockId = this.getBlock(bx, by);
    if (blockId >= this.blockset.length) return 0;
    const localTx = tx - bx * BLOCK_SIZE;
    const localTy = ty - by * BLOCK_SIZE;
    return this.blockset[blockId][localTy * BLOCK_SIZE + localTx];
  }

  /** Check if the tile at the target position is passable.
   *  Matches the original Game Boy engine: checks a single tile at (tileX, tileY+1)
   *  which is the bottom-left tile of the player's 2x2 sprite area.
   *  Works for both in-bounds and out-of-bounds tiles (via connected maps). */
  isWalkable(tileX: number, tileY: number): boolean {
    return this.collisionTiles.has(this.getTileAt(tileX, tileY + 1));
  }

  /** Render visible tiles given camera pixel position. */
  render(cameraX: number, cameraY: number): void {
    if (!this.tileset || !this.blockset || !this.mapData) return;

    const startTX = Math.floor(cameraX / TILE_SIZE) - 1;
    const startTY = Math.floor(cameraY / TILE_SIZE) - 1;
    const endTX = startTX + Math.ceil(GB_WIDTH / TILE_SIZE) + 2;
    const endTY = startTY + Math.ceil(GB_HEIGHT / TILE_SIZE) + 2;

    for (let ty = startTY; ty <= endTY; ty++) {
      for (let tx = startTX; tx <= endTX; tx++) {
        const screenX = tx * TILE_SIZE - cameraX;
        const screenY = ty * TILE_SIZE - cameraY;
        if (screenX > -TILE_SIZE && screenX < GB_WIDTH &&
            screenY > -TILE_SIZE && screenY < GB_HEIGHT) {
          drawTile(this.tileset, this.getTileAt(tx, ty), screenX, screenY);
        }
      }
    }
  }

  /** Find a sign at the given tile position (coords in 16px step units). */
  getSignAt(stepX: number, stepY: number): string | null {
    if (!this.mapData?.signs) return null;
    const sign = this.mapData.signs.find(s => s.x === stepX && s.y === stepY);
    return sign?.text ?? null;
  }

  /** Check if the tile at (tileX, tileY) is a bookshelf tile for the current tileset.
   *  Returns the text to display, or null if not a bookshelf. */
  getBookshelfText(tileX: number, tileY: number): string | null {
    if (!this.mapData) return null;
    const entries = BOOKSHELF_TILES[this.mapData.tileset];
    if (!entries) return null;
    const tile = this.getTileAt(tileX, tileY);
    for (const [tileId, textKey] of entries) {
      if (tile === tileId) {
        const entry = BOOKSHELF_TEXT[textKey];
        if (!entry) return null;
        return typeof entry === 'function' ? entry() : entry;
      }
    }
    return null;
  }

  /** Find a hidden event at the given step position, optionally filtered by facing direction. */
  getHiddenEventAt(stepX: number, stepY: number, facing: 'up' | 'down' | 'left' | 'right'): HiddenEvent | null {
    if (!this.mapData?.hiddenEvents) return null;
    return this.mapData.hiddenEvents.find(e =>
      e.x === stepX && e.y === stepY && (!e.facing || e.facing === facing)
    ) ?? null;
  }

  getWarpAt(tileX: number, tileY: number) {
    if (!this.mapData?.warps) return null;
    const bx = Math.floor(tileX / 2);
    const by = Math.floor(tileY / 2);
    return this.mapData.warps.find(w => w.x === bx && w.y === by) ?? null;
  }

  /** Get the warp at the given index. */
  getWarpByIndex(index: number) {
    return this.mapData?.warps?.[index] ?? null;
  }

  /** Check if tile coords are within map bounds. */
  isInBounds(tileX: number, tileY: number): boolean {
    const tw = this.width * BLOCK_SIZE;
    const th = this.height * BLOCK_SIZE;
    return tileX >= 0 && tileX < tw && tileY >= 0 && tileY < th;
  }

  /** Get a map connection by direction (north/south/east/west). */
  getConnection(dir: 'north' | 'south' | 'east' | 'west'): MapConnection | null {
    if (!this.mapData?.connections) return null;
    return this.mapData.connections.find(c => c.direction === dir) ?? null;
  }

  /** Check if the given tile position is a grass tile (for encounters).
   *  Checks the bottom-left tile of the player's sprite, same as the original game. */
  isGrassTile(tileX: number, tileY: number): boolean {
    if (!this.mapData) return false;
    const grassTile = GRASS_TILES[this.mapData.tileset];
    if (grassTile === undefined) return false;
    return this.getTileAt(tileX, tileY + 1) === grassTile;
  }

  /** Redraw grass tiles on top of a sprite's bottom half (original GB: OAM priority bit).
   *  Uses a transparent version of the tileset (color 0 = transparent) so the sprite
   *  shows through the gaps in the grass pattern, matching the original hardware behavior. */
  renderGrassOverlay(spriteX: number, spriteY: number, cameraX: number, cameraY: number): void {
    if (!this.tilesetTransparent || !this.mapData) return;
    const grassTile = GRASS_TILES[this.mapData.tileset];
    if (grassTile === undefined) return;

    const tileX = Math.round(spriteX / TILE_SIZE);
    const tileY = Math.round(spriteY / TILE_SIZE);

    // The sprite is drawn with -4px Y offset, so its bottom half (lower 8px)
    // spans both tile rows tileY and tileY+1. Overlay grass on both rows.
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const tx = tileX + dx;
        const ty = tileY + dy;
        if (this.getTileAt(tx, ty) === grassTile) {
          const screenX = tx * TILE_SIZE - cameraX;
          const screenY = ty * TILE_SIZE - cameraY;
          drawTile(this.tilesetTransparent, grassTile, screenX, screenY);
        }
      }
    }
  }

  /** Check if the player at (tileX, tileY) facing `dir` is at a ledge hop.
   *  Returns true if the tile standing on + tile in front match a ledge entry.
   *  Ledges only exist on the OVERWORLD tileset. */
  isLedge(tileX: number, tileY: number, dir: 'up' | 'down' | 'left' | 'right'): boolean {
    if (!this.mapData || this.mapData.tileset !== 'OVERWORLD') return false;
    if (dir === 'up') return false; // no upward ledges

    // Tile the player is standing on (bottom-left of 2x2 sprite)
    const standingTile = this.getTileAt(tileX, tileY + 1);

    // Tile in front of the player (1 step = 2 tiles ahead, at foot level)
    let frontTx = tileX, frontTy = tileY + 1;
    if (dir === 'down') frontTy += 2;
    else if (dir === 'left') frontTx -= 2;
    else if (dir === 'right') frontTx += 2;
    const frontTile = this.getTileAt(frontTx, frontTy);

    return LEDGE_TILES.some(([d, stand, ledge]) =>
      d === dir && stand === standingTile && ledge === frontTile
    );
  }

  /** Check if the tile under the player at (tileX, tileY) is a door tile.
   *  Used after warping to determine if the player should auto-step out.
   *  Matches assembly IsPlayerStandingOnDoorTile check. */
  isDoorTile(tileX: number, tileY: number): boolean {
    if (!this.mapData) return false;
    const tiles = DOOR_TILES[this.mapData.tileset];
    if (!tiles) return false;
    const tile = this.getTileAt(tileX, tileY + 1);
    return tiles.includes(tile);
  }

  /** Check if the tile under the player at (tileX, tileY) is an instant-warp tile
   *  (door/staircase tiles that trigger warps immediately when stepped on).
   *  Matches assembly IsPlayerStandingOnDoorTileOrWarpTile — checks the bottom-left
   *  tile of the player's sprite area (tileY + 1). */
  isInstantWarpTile(tileX: number, tileY: number): boolean {
    if (!this.mapData) return false;
    const tiles = INSTANT_WARP_TILES[this.mapData.tileset];
    if (!tiles) return false;
    const tile = this.getTileAt(tileX, tileY + 1);
    return tiles.includes(tile);
  }

  /** Map dimensions in tiles. */
  get widthTiles(): number { return this.width * BLOCK_SIZE; }
  get heightTiles(): number { return this.height * BLOCK_SIZE; }
}
