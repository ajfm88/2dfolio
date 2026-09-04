// Wallmaster — Z_04.asm:4128 UpdateWallmaster
//
// Emerges from the wall nearest Link, crawls toward him at QSpeed $18, and on
// contact GRABS Link and drags him back to the dungeon entrance room (NES sets
// GameMode 3 "unfurl"). Here the grab just raises `grabbed`; main.ts performs the
// entrance warp via DungeonManager.returnToEntranceRoom(). If it crosses its whole
// trip (~7 tiles) without grabbing Link, it retreats into the wall (despawns).

import {
  SCREEN_EDGE_BOTTOM,
  SCREEN_EDGE_LEFT,
  SCREEN_EDGE_RIGHT,
  SCREEN_EDGE_TOP,
} from '../../core/constants.js';
import { Direction } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';
import type { SpriteSheet } from '../../render/sprite-renderer.js';
import { drawDungeonEnemySprite, WALLMASTER_SPRITES } from '../../render/enemy-sprite-data.js';
import { Enemy, EnemyState, type EnemyUpdateContext } from './enemy.js';

export const WALLMASTER = 0x27;
const QSPEED = 0x18;
const MAX_TILES = 7; // trip length before retreating

export class Wallmaster extends Enemy {
  private readonly _sub = { value: 0 };
  private _emerged = false;
  private _tilesCrossed = 0;
  private _lastTileX = 0;
  private _lastTileY = 0;
  private _grabbed = false;

  get grabbed(): boolean {
    return this._grabbed;
  }

  // Called by main.ts when Link touches the Wallmaster.
  grab(): void {
    this._grabbed = true;
  }

  protected override updateAI(ctx: EnemyUpdateContext): void {
    if (!this._emerged) {
      this.emergeFromNearestWall(ctx.linkX, ctx.linkY);
      this._emerged = true;
      this._lastTileX = this._x >> 4;
      this._lastTileY = this._y >> 4;
    }

    // Crawl toward Link, passing over tiles (checkTiles=false).
    this.moveQSpeed(QSPEED, this._sub, ctx.collision, ctx.screen, false);
    // Keep inside the play area.
    this._x = Math.max(SCREEN_EDGE_LEFT, Math.min(SCREEN_EDGE_RIGHT, this._x));
    this._y = Math.max(SCREEN_EDGE_TOP, Math.min(SCREEN_EDGE_BOTTOM, this._y));

    // At each new 16px tile, re-face toward Link and count the trip.
    const tx = this._x >> 4;
    const ty = this._y >> 4;
    if (tx !== this._lastTileX || ty !== this._lastTileY) {
      this._lastTileX = tx;
      this._lastTileY = ty;
      this._tilesCrossed++;
      this._direction = this.directionTowardLink(ctx.linkX, ctx.linkY);
      if (this._tilesCrossed >= MAX_TILES && !this._grabbed) {
        // Retreat into the wall — trip over without a capture.
        this._state = EnemyState.Dead;
        return;
      }
    }

    this.tickWalkAnimation(6);
  }

  private emergeFromNearestWall(linkX: number, linkY: number): void {
    const distLeft = linkX - SCREEN_EDGE_LEFT;
    const distRight = SCREEN_EDGE_RIGHT - linkX;
    const distTop = linkY - SCREEN_EDGE_TOP;
    const distBottom = SCREEN_EDGE_BOTTOM - linkY;
    const min = Math.min(distLeft, distRight, distTop, distBottom);

    if (min === distLeft) {
      this._x = SCREEN_EDGE_LEFT; this._y = linkY; this._direction = Direction.Right;
    } else if (min === distRight) {
      this._x = SCREEN_EDGE_RIGHT; this._y = linkY; this._direction = Direction.Left;
    } else if (min === distTop) {
      this._x = linkX; this._y = SCREEN_EDGE_TOP; this._direction = Direction.Down;
    } else {
      this._x = linkX; this._y = SCREEN_EDGE_BOTTOM; this._direction = Direction.Up;
    }
  }

  protected override renderEnemy(renderer: Renderer, _sheet?: SpriteSheet): void {
    const frame = WALLMASTER_SPRITES[this._walkAnimFrame] ?? WALLMASTER_SPRITES[0];
    if (frame) {
      drawDungeonEnemySprite(renderer, frame, this._x, this._y);
    }
  }
}
