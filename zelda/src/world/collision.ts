import {
  DEFAULT_WALKABILITY_THRESHOLD,
  PLAY_AREA_HEIGHT,
  SCREEN_WIDTH,
  TILE_SIZE,
  WATER_TILE_MIN,
  WATER_TILE_MAX,
} from '../core/constants.js';
import type { OverworldData, OverworldScreen } from '../data/overworld-types.js';

/**
 * Debug-only walk-through-walls toggle (__zelda.noclip). Module-level rather than
 * per-instance because DungeonCollisionMap is rebuilt on every room change, which
 * would otherwise reset it mid-dungeon. Never set during normal play.
 */
export const noclip = { enabled: false };

export class TileCollisionMap {
  private readonly walkable: readonly boolean[];
  private readonly primaryValues: readonly number[];
  private readonly _walkableOverrides = new Set<string>();

  constructor(
    metatileValues: readonly number[],
    threshold: number = DEFAULT_WALKABILITY_THRESHOLD,
  ) {
    this.primaryValues = metatileValues;
    this.walkable = metatileValues.map((v) => v < threshold);
  }

  isTileWalkable(tileIndex: number): boolean {
    if (this._walkableOverrides.has(String(tileIndex))) return true;
    return this.walkable[tileIndex] ?? false;
  }

  isPositionWalkable(screen: OverworldScreen, px: number, py: number): boolean {
    if (noclip.enabled) return true;
    if (px < 0 || px >= SCREEN_WIDTH || py < 0 || py >= PLAY_AREA_HEIGHT) {
      return true;
    }
    const col = Math.floor(px / TILE_SIZE);
    const row = Math.floor(py / TILE_SIZE);

    // Check per-position walkable overrides (stepladder bridge)
    if (this._walkableOverrides.has(`${row},${col}`)) return true;

    const tileIndex = screen.tiles[row]?.[col];
    if (tileIndex === undefined) return false;
    return this.walkable[tileIndex] ?? false;
  }

  isRectWalkable(
    screen: OverworldScreen,
    x: number,
    y: number,
    w: number,
    h: number,
  ): boolean {
    return (
      this.isPositionWalkable(screen, x, y) &&
      this.isPositionWalkable(screen, x + w - 1, y) &&
      this.isPositionWalkable(screen, x, y + h - 1) &&
      this.isPositionWalkable(screen, x + w - 1, y + h - 1)
    );
  }

  getTileValueAtPosition(screen: OverworldScreen, px: number, py: number): number | undefined {
    if (px < 0 || px >= SCREEN_WIDTH || py < 0 || py >= PLAY_AREA_HEIGHT) {
      return undefined;
    }
    const col = Math.floor(px / TILE_SIZE);
    const row = Math.floor(py / TILE_SIZE);
    const tileIndex = screen.tiles[row]?.[col];
    if (tileIndex === undefined) return undefined;
    return this.primaryValues[tileIndex];
  }

  isWaterTileAt(screen: OverworldScreen, px: number, py: number): boolean {
    const value = this.getTileValueAtPosition(screen, px, py);
    if (value === undefined) return false;
    return value >= WATER_TILE_MIN && value <= WATER_TILE_MAX;
  }

  setWalkableOverride(row: number, col: number): void {
    this._walkableOverrides.add(`${row},${col}`);
  }

  clearWalkableOverrides(): void {
    this._walkableOverrides.clear();
  }
}

export function createCollisionMap(data: OverworldData): TileCollisionMap {
  return new TileCollisionMap(data.squareTable.primary);
}

/** Duck-typed so dungeon collision (always dry) and test mocks both work. */
export interface WaterTileQuery {
  isWaterTileAt(screen: OverworldScreen, px: number, py: number): boolean;
}

// NES CheckZora (Z_04.asm:1780) rejects X = 0 / $F0 and Y < $50 / >= $E0.
// Those Y bounds are HUD-inclusive; in play-area space they are rows 1–9.
const ZORA_MIN_COL = 1;
const ZORA_MAX_COL = 14;
const ZORA_MIN_ROW = 1;
const ZORA_MAX_ROW = 9;

export function collectWaterPositions(
  collision: WaterTileQuery,
  screen: OverworldScreen,
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let row = ZORA_MIN_ROW; row <= ZORA_MAX_ROW; row++) {
    for (let col = ZORA_MIN_COL; col <= ZORA_MAX_COL; col++) {
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE - 3;
      if (collision.isWaterTileAt(screen, x + 8, y + 8)) {
        out.push({ x, y });
      }
    }
  }
  return out;
}

export function pickRandomWaterPosition(
  collision: WaterTileQuery,
  screen: OverworldScreen,
): { x: number; y: number } | null {
  const tiles = collectWaterPositions(collision, screen);
  if (tiles.length === 0) return null;
  return tiles[Math.floor(Math.random() * tiles.length)] ?? null;
}
