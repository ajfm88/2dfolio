// Like-Like — Z_04.asm:6816 UpdateLikeLike
//
// Wanders (turnRate $80). On contact it CAPTURES Link: he is paralyzed and the
// Like-Like snaps onto him. After $60 frames of capture it EATS the Magic Shield.
// Killing the Like-Like frees Link. (main.ts wires the Link paralyze/shield side —
// this class owns the capture timer and reports what it wants done.)

import type { Renderer } from '../../render/renderer.js';
import type { SpriteSheet } from '../../render/sprite-renderer.js';
import { type EnemyUpdateContext } from './enemy.js';
import { WalkerEnemy } from './walker-enemy.js';

export const LIKE_LIKE = 0x17;
const CAPTURE_TURN_RATE = 0x80;
const CAPTURE_QSPEED = 0x20;
const SHIELD_EAT_FRAMES = 0x60; // capture time before the Magic Shield is eaten

export class LikeLike extends WalkerEnemy {
  private _capturing = false;
  private _captureTimer = 0;
  private _shieldEaten = false;
  private _shieldEatPending = false;
  private _animPhase = 0;
  private _animCounter = 0;

  constructor(x: number, y: number, objectType: number, hp: number, spawnCloudFrames: number) {
    super(x, y, objectType, hp, spawnCloudFrames, CAPTURE_TURN_RATE, CAPTURE_QSPEED, 0, false, -1);
  }

  get capturing(): boolean {
    return this._capturing;
  }

  // Called by main.ts when Link touches the Like-Like (instead of taking damage).
  beginCapture(): void {
    if (this._capturing) return;
    if (!this.isActive || this.isSpawning) return;
    this._capturing = true;
    this._captureTimer = 0;
  }

  // Returns true exactly once, on the frame the Magic Shield should be removed.
  consumeShieldEat(): boolean {
    if (!this._shieldEatPending) return false;
    this._shieldEatPending = false;
    return true;
  }

  protected override updateAI(ctx: EnemyUpdateContext): void {
    if (this._capturing) {
      // Hold Link: sit right on top of him and count up.
      this._x = ctx.linkX;
      this._y = ctx.linkY;
      this._captureTimer++;
      if (this._captureTimer >= SHIELD_EAT_FRAMES && !this._shieldEaten) {
        this._shieldEaten = true;
        this._shieldEatPending = true;
      }
      // 4-frame chew animation.
      if (--this._animCounter <= 0) {
        this._animCounter = 8;
        this._animPhase = (this._animPhase + 1) & 0x03;
      }
      return;
    }
    super.updateAI(ctx);
  }

  protected override onDeath(): void {
    // Killing it frees Link (main.ts observes capturing going false).
    this._capturing = false;
  }

  protected override renderEnemy(renderer: Renderer, _sheet?: SpriteSheet): void {
    const ctx = renderer.ctx;
    const x = this._x, y = this._y;
    ctx.fillStyle = '#c86818'; // brown tube body
    ctx.fillRect(x + 1, y, 14, 16);
    // Mouth ring — opens/closes; wide open while chewing a captured Link.
    const open = this._capturing ? 2 + (this._animPhase & 1) * 2 : 4;
    ctx.fillStyle = '#3a1e08';
    ctx.fillRect(x + 4, y + 8 - open, 8, open * 2);
    if (this._capturing) {
      // Hint of the captured Link inside.
      ctx.fillStyle = 'rgba(120,180,80,0.6)';
      ctx.fillRect(x + 6, y + 6, 4, 6);
    }
  }
}
