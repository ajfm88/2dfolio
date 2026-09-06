// Tektite — Z_04.asm:2250 UpdateTektiteOrBoulder
// Jumps diagonally toward Link, pauses on ground
// Blue (type 13), Red (type 14)

import {
  SCREEN_EDGE_BOTTOM,
  SCREEN_EDGE_LEFT,
  SCREEN_EDGE_RIGHT,
  SCREEN_EDGE_TOP,
} from '../../core/constants.js';
import { Direction } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';
import type { SpriteSheet } from '../../render/sprite-renderer.js';
import { Enemy, type EnemyUpdateContext } from './enemy.js';

const ENEMY_SHEET_COLUMNS = 30;
const PAUSE_MIN = 30;
const PAUSE_RANGE = 60;

// Vertical speed for jump arc (NES JumperStartSpeedsHi)
const JUMP_SPEED_INITIAL = -3;
const GRAVITY = 0.15;

enum TektitePhase {
  Ground,
  Jumping,
}

// First row of the Tektite's 2-frame pair in enemies.png.
const TEKTITE_SPRITE_ROW = 8;

export class Tektite extends Enemy {
  private readonly isBlue: boolean;
  private phase = TektitePhase.Ground;
  private pauseTimer: number;
  private jumpVelX = 0;
  private jumpVelY = 0;
  private reversalCount = 0;

  constructor(
    x: number, y: number,
    objectType: number, hp: number, spawnCloudFrames: number,
  ) {
    super(x, y, objectType, hp, spawnCloudFrames);
    this.isBlue = objectType === 13;
    this.pauseTimer = PAUSE_MIN + Math.floor(Math.random() * PAUSE_RANGE);
  }

  protected override updateAI(ctx: EnemyUpdateContext): void {
    this.tickWalkAnimation(8);

    if (this.phase === TektitePhase.Ground) {
      this.pauseTimer--;
      if (this.pauseTimer <= 0) {
        this.startJump(ctx.linkX, ctx.linkY);
      }
    } else {
      this.updateJump(ctx);
    }
  }

  private startJump(linkX: number, linkY: number): void {
    this.phase = TektitePhase.Jumping;

    // Jump toward Link
    const dx = linkX - this._x;
    const dy = linkY - this._y;
    this.jumpVelX = dx > 0 ? 0.5 : -0.5;
    this.jumpVelY = JUMP_SPEED_INITIAL;

    // Z_04.asm: reversalCount >= 2 → invert horizontal to escape corners
    if (this.reversalCount >= 2) {
      this.jumpVelX = -this.jumpVelX;
      this.reversalCount = 0;
    }

    // Set facing direction
    if (dy < 0) {
      this._direction = this.jumpVelX > 0 ? Direction.Right : Direction.Left;
    } else {
      this._direction = this.jumpVelX > 0 ? Direction.Right : Direction.Left;
    }
  }

  private updateJump(_ctx: EnemyUpdateContext): void {
    this.jumpVelY += GRAVITY;
    let nx = this._x + this.jumpVelX;
    let ny = this._y + this.jumpVelY;

    // Boundary check — bounce off edges
    if (nx < SCREEN_EDGE_LEFT || nx > SCREEN_EDGE_RIGHT) {
      this.jumpVelX = -this.jumpVelX;
      nx = this._x + this.jumpVelX;
      this.reversalCount++;
    }
    if (ny < SCREEN_EDGE_TOP || ny > SCREEN_EDGE_BOTTOM) {
      this.jumpVelY = -this.jumpVelY;
      ny = this._y + this.jumpVelY;
      this.reversalCount++;
    }

    this._x = Math.max(SCREEN_EDGE_LEFT, Math.min(SCREEN_EDGE_RIGHT, nx));
    this._y = Math.max(SCREEN_EDGE_TOP, Math.min(SCREEN_EDGE_BOTTOM, ny));

    // Land when descending and Y velocity is positive and sufficient time passed
    if (this.jumpVelY > 0 && this._y >= this._y) {
      // Check if we've returned to ground level (descending)
      if (this.jumpVelY >= 2) {
        this.phase = TektitePhase.Ground;
        this.pauseTimer = PAUSE_MIN + Math.floor(Math.random() * PAUSE_RANGE);
        this._y = Math.round(this._y);
      }
    }
  }

  protected override renderEnemy(renderer: Renderer, enemySheet?: SpriteSheet): void {
    if (enemySheet) {
      // enemies.png convention (same as WalkerEnemy): a *row pair* holds the two
      // animation frames, columns hold directions with red at 0-3 and blue at 4-7.
      // The Tektite faces the camera, so it only occupies the first column of each
      // colour — rows 8 and 9 at col 0 (red) / col 4 (blue). Advancing the column
      // per animation frame, as this used to, landed on cols 1 and 5, which are
      // empty on the sheet: the sprite vanished every other frame and read as a
      // flicker. Jumping reuses the same pair; there is no separate jump sprite.
      const col = this.isBlue ? 4 : 0;
      const row = TEKTITE_SPRITE_ROW + this._walkAnimFrame;
      const frameIndex = row * ENEMY_SHEET_COLUMNS + col;
      enemySheet.drawFrame(renderer, frameIndex, this._x, this._y);
    } else {
      super.renderEnemy(renderer);
    }
  }
}
