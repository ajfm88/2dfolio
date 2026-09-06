import {
  LINK_ENTRY_BOTTOM,
  LINK_ENTRY_LEFT,
  LINK_ENTRY_RIGHT,
  LINK_ENTRY_TOP,
  LINK_HITBOX_OFFSET_X,
  LINK_HITBOX_WIDTH,
  OVERWORLD_COLS,
  OVERWORLD_ROWS,
  PLAY_AREA_HEIGHT,
  SCREEN_WIDTH,
  TILE_SIZE,
} from '../core/constants.js';
import { Direction } from '../core/types.js';
import { getScreenCaveIndex, isCaveEntranceTile } from '../data/cave-data.js';
import type { OverworldData, OverworldScreen } from '../data/overworld-types.js';
import type { SecretsData } from '../data/secret-types.js';
import { SQUARE_INDEX_CAVE_ENTRANCE, SQUARE_INDEX_STAIRS } from '../data/secret-types.js';
import type { Renderer } from '../render/renderer.js';
import { TileRenderer, getScreenByCoord } from '../render/tile-renderer.js';
import type { Link } from '../objects/player/link.js';
import type { Bomb } from '../objects/weapons/bomb.js';
import type { CandleFire } from '../objects/weapons/candle-fire.js';
import { ScreenTransition } from './screen-transition.js';
import { TileCollisionMap, createCollisionMap } from './collision.js';
import { RoomFlags } from './room-flags.js';
import { TileObjectManager, type SecretRevealEvent } from './tile-object.js';

export class OverworldManager {
  private _screenRow: number;
  private _screenCol: number;
  private _currentScreen: OverworldScreen;
  private _transition: ScreenTransition | null = null;
  private readonly _collisionMap: TileCollisionMap;
  private readonly _overworldData: OverworldData;
  private readonly _tileRenderer: TileRenderer;
  private readonly _visitedScreens = new Set<number>();
  private readonly _roomFlags: RoomFlags;
  private readonly _tileObjectManager: TileObjectManager;
  private readonly _secretsData: SecretsData;

  constructor(
    overworldData: OverworldData,
    tileRenderer: TileRenderer,
    startRow: number,
    startCol: number,
    secretsData: SecretsData,
  ) {
    this._overworldData = overworldData;
    this._tileRenderer = tileRenderer;
    this._screenRow = startRow;
    this._screenCol = startCol;
    this._collisionMap = createCollisionMap(overworldData);
    this._roomFlags = new RoomFlags();
    this._tileObjectManager = new TileObjectManager();
    this._secretsData = secretsData;

    const screen = getScreenByCoord(overworldData, startRow, startCol);
    if (!screen) {
      throw new Error(`No screen at (${startRow}, ${startCol})`);
    }
    this._currentScreen = screen;
    this._visitedScreens.add(screen.id);
    this._tileObjectManager.initForScreen(screen, this._roomFlags, this._secretsData);
  }

  get screenRow(): number {
    return this._screenRow;
  }

  get screenCol(): number {
    return this._screenCol;
  }

  get currentScreen(): OverworldScreen {
    return this._currentScreen;
  }

  get collisionMap(): TileCollisionMap {
    return this._collisionMap;
  }

  get isTransitioning(): boolean {
    return this._transition !== null;
  }

  get transition(): ScreenTransition | null {
    return this._transition;
  }

  get visitedScreens(): ReadonlySet<number> {
    return this._visitedScreens;
  }

  get tileObjectManager(): TileObjectManager {
    return this._tileObjectManager;
  }

  get roomFlags(): RoomFlags {
    return this._roomFlags;
  }

  tryTransition(direction: Direction, link: Link): boolean {
    if (this._transition) return false;

    const dRow = direction === Direction.Up ? -1 : direction === Direction.Down ? 1 : 0;
    const dCol = direction === Direction.Left ? -1 : direction === Direction.Right ? 1 : 0;
    const newRow = this._screenRow + dRow;
    const newCol = this._screenCol + dCol;

    if (newRow < 0 || newRow >= OVERWORLD_ROWS || newCol < 0 || newCol >= OVERWORLD_COLS) {
      return false;
    }

    const newScreen = getScreenByCoord(this._overworldData, newRow, newCol);
    if (!newScreen) return false;

    const oldScreen = this._currentScreen;
    this._screenRow = newRow;
    this._screenCol = newCol;
    this._currentScreen = newScreen;
    this._visitedScreens.add(newScreen.id);

    // Z_07.asm:2831 PlayerScreenEdgeBounds — place Link at the opposite entry edge
    switch (direction) {
      case Direction.Right:
        link.setPosition(LINK_ENTRY_LEFT, link.posY);
        break;
      case Direction.Left:
        link.setPosition(LINK_ENTRY_RIGHT, link.posY);
        break;
      case Direction.Down:
        link.setPosition(link.posX, LINK_ENTRY_TOP);
        break;
      case Direction.Up:
        link.setPosition(link.posX, LINK_ENTRY_BOTTOM);
        break;
    }
    link.setDirection(direction);

    this._transition = new ScreenTransition(direction, oldScreen, newScreen);
    return true;
  }

  updateTransition(link: Link): void {
    if (!this._transition) return;
    this._transition.update();
    link.tickAnimation();
    if (this._transition.done) {
      this._transition = null;
      this._tileObjectManager.initForScreen(
        this._currentScreen, this._roomFlags, this._secretsData,
      );
    }
  }

  /**
   * Re-seed the minimap's visited set from a save file (L1). Additive — the
   * current screen stays visited.
   */
  restoreVisitedScreens(ids: readonly number[]): void {
    for (const id of ids) this._visitedScreens.add(id);
  }

  setScreen(row: number, col: number): void {
    this._screenRow = row;
    this._screenCol = col;
    const screen = getScreenByCoord(this._overworldData, row, col);
    if (screen) {
      this._currentScreen = screen;
      this._visitedScreens.add(screen.id);
      this._tileObjectManager.initForScreen(screen, this._roomFlags, this._secretsData);
    }
    this._transition = null;
  }

  renderScreen(renderer: Renderer): void {
    const overrides = this._tileObjectManager.tileOverrides;
    this._tileRenderer.renderScreen(
      renderer, this._currentScreen,
      overrides.size > 0 ? overrides : undefined,
    );
  }

  renderTransition(renderer: Renderer): void {
    if (!this._transition) return;

    const ctx = renderer.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, SCREEN_WIDTH, PLAY_AREA_HEIGHT);
    ctx.clip();

    const oldOff = this._transition.getOldScreenOffset();
    ctx.save();
    ctx.translate(oldOff.x, oldOff.y);
    this._tileRenderer.renderScreen(renderer, this._transition.oldScreen);
    ctx.restore();

    const newOff = this._transition.getNewScreenOffset();
    ctx.save();
    ctx.translate(newOff.x, newOff.y);
    this._tileRenderer.renderScreen(renderer, this._transition.newScreen);
    ctx.restore();

    ctx.restore();
  }

  getNewScreenOffset(): { x: number; y: number } {
    if (!this._transition) return { x: 0, y: 0 };
    return this._transition.getNewScreenOffset();
  }

  updateTileObjects(
    link: Link,
    bombs: readonly Bomb[],
    fires: readonly CandleFire[],
  ): SecretRevealEvent | null {
    this._tileObjectManager.update(
      this._currentScreen,
      {
        posX: link.posX,
        posY: link.posY,
        facing: link.facing,
        isMoving: link.isMoving,
        hasBracelet: link.hasBracelet,
      },
      bombs,
      fires,
      this._roomFlags,
      this._secretsData,
    );
    return this._tileObjectManager.consumePendingReveal();
  }

  renderTileObject(ctx: CanvasRenderingContext2D): void {
    this._tileObjectManager.render(ctx);
  }

  checkCaveEntry(link: Link): number | null {
    if (link.facing !== Direction.Up) return null;
    if (!link.isMoving) return null;

    const caveIndex = getScreenCaveIndex(this._currentScreen.id);
    if (caveIndex === null) return null;

    // Check the tile just above Link's hitbox center
    const checkX = link.posX + LINK_HITBOX_OFFSET_X + LINK_HITBOX_WIDTH / 2;
    const checkY = link.posY - 1;
    if (checkY < 0) return null;

    const col = Math.floor(checkX / TILE_SIZE);
    const row = Math.floor(checkY / TILE_SIZE);
    const tileIndex = this._currentScreen.tiles[row]?.[col];
    if (tileIndex === undefined) return null;

    if (isCaveEntranceTile(tileIndex)) {
      return caveIndex;
    }

    // Also check tile overrides for revealed cave entrances
    const gridIdx = row * 16 + col;
    const override = this._tileObjectManager.tileOverrides.get(gridIdx);
    if (override === SQUARE_INDEX_CAVE_ENTRANCE || override === SQUARE_INDEX_STAIRS) {
      return caveIndex;
    }

    return null;
  }
}
