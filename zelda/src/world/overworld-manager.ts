import {
  LINK_ENTRY_BOTTOM,
  LINK_ENTRY_LEFT,
  LINK_ENTRY_RIGHT,
  LINK_ENTRY_TOP,
  OVERWORLD_COLS,
  OVERWORLD_ROWS,
  PLAY_AREA_HEIGHT,
  SCREEN_WIDTH,
} from '../core/constants.js';
import { Direction } from '../core/types.js';
import type { OverworldData, OverworldScreen } from '../data/overworld-types.js';
import type { SecretsData } from '../data/secret-types.js';
import type { Renderer } from '../render/renderer.js';
import { TileRenderer, getScreenByCoord } from '../render/tile-renderer.js';
import type { Link } from '../objects/player/link.js';
import type { Bomb } from '../objects/weapons/bomb.js';
import type { CandleFire } from '../objects/weapons/candle-fire.js';
import { ScreenTransition } from './screen-transition.js';
import { TileCollisionMap, createCollisionMap, isWarpTile } from './collision.js';
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
  // NES UndergroundExitType: set when Link comes back out of a cave or dungeon,
  // cleared once he has stepped a whole 8-px tile (Z_07.asm:3248). While set,
  // CheckWarps returns early so he doesn't drop straight back in.
  private _warpDisarmedAt: { x: number; y: number } | null = null;

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
    this._collisionMap.setSquareOverrides((id) => this._tileObjectManager.overridesForScreen(id));
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
    this._warpDisarmedAt = null;

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
    this._warpDisarmedAt = null;
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

  /** Call after placing Link back at the entrance he came out of. */
  disarmWarpsUntilMoved(link: Link): void {
    this._warpDisarmedAt = { x: link.posX, y: link.posY };
  }

  /**
   * Z_05.asm:7246 CheckWarps + HandleWarpOW. True when Link stands on an
   * underground entrance: X on a 16-px column, Y on a square row, and the 8×8
   * tile at his feet is a warp tile. Facing and movement don't matter — on the
   * NES the cave mouth's lower half is walkable and Link warps once he is in it.
   * The caller picks dungeon vs cave from the screen (NES: AttrsB cave index).
   */
  isOnWarpTile(link: Link): boolean {
    const x = link.posX;
    const y = link.posY;
    if (this._warpDisarmedAt) {
      const moved = Math.abs(x - this._warpDisarmedAt.x) + Math.abs(y - this._warpDisarmedAt.y);
      if (moved < 8) return false;
      this._warpDisarmedAt = null;
    }
    // Room $22's Level 6 entrance is two squares wide, so there X only needs to
    // be a multiple of 8 (Z_05.asm:7254).
    const xMask = this._currentScreen.id === 0x22 ? 0x07 : 0x0F;
    // NES ObjY & $0F == $0D is a play-area Y that is a multiple of 16.
    if ((x & xMask) !== 0 || (y & 0x0F) !== 0) return false;
    // GetCollidableTileStill hotspot: (ObjX, ObjY + $0B) = play-area (x, y + 8).
    const tile = this._collisionMap.getTileAt(this._currentScreen, x, y + 8);
    return tile !== undefined && isWarpTile(tile);
  }
}
