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

/** Grid index (row * 16 + col) → replacement square index, for one screen. */
export type SquareOverrideLookup = (screenId: number) => ReadonlyMap<number, number> | undefined;

// Z_05.asm:7345 HandleWarpOW — the 8×8 tiles that send Link underground when he
// stands on them: $24 (black cave opening), $88 (waterfall cave), $70-$73 (stairs).
const WARP_TILE_CAVE = 0x24;
const WARP_TILE_WATERFALL = 0x88;
const WARP_TILE_STAIRS_MIN = 0x70;
const WARP_TILE_STAIRS_END = 0x74;

export function isWarpTile(tile: number): boolean {
  return tile === WARP_TILE_CAVE || tile === WARP_TILE_WATERFALL ||
    (tile >= WARP_TILE_STAIRS_MIN && tile < WARP_TILE_STAIRS_END);
}

/** Quadrant index into a square's 4 tiles, NES order: TL, BL, TR, BR. */
function quadrantAt(px: number, py: number): number {
  const right = (px % TILE_SIZE) >= TILE_SIZE / 2 ? 2 : 0;
  const bottom = (py % TILE_SIZE) >= TILE_SIZE / 2 ? 1 : 0;
  return right + bottom;
}

export class TileCollisionMap {
  private readonly walkable: readonly boolean[];
  private readonly primaryValues: readonly number[];
  // The four 8×8 tiles of each square. The NES tests collision against a single
  // 8×8 tile (Z_07.asm:2191 GetCollidableTile), so a square can be half solid:
  // the cave mouth (square 12) is rock on top and walkable black underneath.
  private readonly squareTiles: readonly (readonly number[])[];
  private readonly quadrantWalkable: readonly (readonly boolean[])[];
  private readonly _walkableOverrides = new Set<string>();
  private _squareOverrides: SquareOverrideLookup | null = null;

  /**
   * `secondarySquares` is the OW SecondarySquaresOW table. When given, squares are
   * expanded like Z_05.asm WriteSquareOW: index < $10 takes its 4 tiles from that
   * table; any other square is primary+0..3. Without it every quadrant is the
   * primary tile (synthetic test maps).
   */
  constructor(
    metatileValues: readonly number[],
    threshold: number = DEFAULT_WALKABILITY_THRESHOLD,
    secondarySquares?: readonly (readonly number[])[],
  ) {
    this.primaryValues = metatileValues;
    this.walkable = metatileValues.map((v) => v < threshold);
    this.squareTiles = metatileValues.map((p, i) => {
      if (!secondarySquares) return [p, p, p, p];
      return secondarySquares[i] ?? [p, p + 1, p + 2, p + 3];
    });
    this.quadrantWalkable = this.squareTiles.map((q) => q.map((t) => t < threshold));
  }

  /** Revealed secrets (cave openings, stairs, moved rocks) change a screen's squares. */
  setSquareOverrides(lookup: SquareOverrideLookup | null): void {
    this._squareOverrides = lookup;
  }

  private squareAt(screen: OverworldScreen, row: number, col: number): number | undefined {
    const override = this._squareOverrides?.(screen.id)?.get(row * 16 + col);
    if (override !== undefined) return override;
    return screen.tiles[row]?.[col];
  }

  /** The 8×8 NES tile under a play-area pixel, after square overrides. */
  getTileAt(screen: OverworldScreen, px: number, py: number): number | undefined {
    if (px < 0 || px >= SCREEN_WIDTH || py < 0 || py >= PLAY_AREA_HEIGHT) return undefined;
    const square = this.squareAt(screen, Math.floor(py / TILE_SIZE), Math.floor(px / TILE_SIZE));
    if (square === undefined) return undefined;
    return this.squareTiles[square]?.[quadrantAt(px, py)];
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

    const square = this.squareAt(screen, row, col);
    if (square === undefined) return false;
    return this.quadrantWalkable[square]?.[quadrantAt(px, py)] ?? false;
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
  return new TileCollisionMap(
    data.squareTable.primary,
    DEFAULT_WALKABILITY_THRESHOLD,
    data.squareTable.secondary,
  );
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
