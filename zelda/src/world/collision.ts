import {
  DEFAULT_WALKABILITY_THRESHOLD,
  PLAY_AREA_HEIGHT,
  SCREEN_WIDTH,
  TILE_SIZE,
} from '../core/constants.js';
import type { OverworldData, OverworldScreen } from '../data/overworld-types.js';

export class TileCollisionMap {
  private readonly walkable: readonly boolean[];

  constructor(
    metatileValues: readonly number[],
    threshold: number = DEFAULT_WALKABILITY_THRESHOLD,
  ) {
    this.walkable = metatileValues.map((v) => v < threshold);
  }

  isTileWalkable(tileIndex: number): boolean {
    return this.walkable[tileIndex] ?? false;
  }

  isPositionWalkable(screen: OverworldScreen, px: number, py: number): boolean {
    if (px < 0 || px >= SCREEN_WIDTH || py < 0 || py >= PLAY_AREA_HEIGHT) {
      return true;
    }
    const col = Math.floor(px / TILE_SIZE);
    const row = Math.floor(py / TILE_SIZE);
    const tileIndex = screen.tiles[row]?.[col];
    if (tileIndex === undefined) return false;
    return this.isTileWalkable(tileIndex);
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
}

export function createCollisionMap(data: OverworldData): TileCollisionMap {
  return new TileCollisionMap(data.squareTable.primary);
}
