// Aquamentus — the dragon boss of Level 1.
// Z_04.asm: InitAquamentus (4842), UpdateAquamentus (5596), Aquamentus_Move (5613),
//           Aquamentus_Shoot (5684), Aquamentus_Draw (5762).
//
// Pinned to the right wall, wobbles horizontally only, and periodically lobs a
// 3-way fireball fan leftward at Link. Invincible to boomerang and candle fire
// (ObjInvincibilityMask $E2); vulnerable to sword/beam/arrow/bomb/rod/magic shot.
// HP $60 (6 wood-sword hits) comes from the shared getEnemyHp() decoder.

import { Direction } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';
import type { SpriteSheet } from '../../render/sprite-renderer.js';
import { Enemy, type EnemyUpdateContext } from './enemy.js';
import { EnemyProjectile } from '../projectiles/enemy-projectile.js';
import { ProjectileType } from '../player/shield.js';

export const AQUAMENTUS = 0x3d;

// NES $B0/$80 → local (raw X, raw Y − HUD $40).
const SPAWN_X = 0xb0;          // 176
const SPAWN_Y = 0x80 - 0x40;   // 64
// Horizontal wobble limits (local == NES raw X).
const LEFT_LIMIT = 0x88;       // 136
const RIGHT_LIMIT = 0xc7;      // 199
const RIGHT_REVERSE = 0xc8;    // 200 — crossing this snaps back to RIGHT_LIMIT

const MASK_BOOMERANG_AND_FIRE = 0xe2; // ObjInvincibilityMask from InitAquamentus

// Body is 3 sprites wide × 2 tall in 8×16 mode → 24×32 px.
const BODY_W = 24;
const BODY_H = 32;

export class Aquamentus extends Enemy {
  private _frame = 0;
  private _gridOffset = 0;      // distance remaining in the current wobble leg
  private _shootTimer = 0x80;   // ObjTimer; counts down, fires at 0
  private _mouthOpen = false;

  constructor(_x: number, _y: number, objectType: number, hp: number, spawnCloudFrames: number) {
    // InitAquamentus overrides position; ignore the monster-list slot.
    super(SPAWN_X, SPAWN_Y, objectType, hp, spawnCloudFrames);
    this._direction = Direction.Left;
    this._invincibilityMask = MASK_BOOMERANG_AND_FIRE;
  }

  // Bosses are never boomerang-stunned.
  override stun(): void {}

  override getHitbox() {
    return { x: this._x, y: this._y, width: BODY_W, height: BODY_H };
  }

  protected override updateAI(_ctx: EnemyUpdateContext): void {
    this._frame++;
    this.move();
    this.shoot();
  }

  // Aquamentus_Move: horizontal-only wobble, 1px on 1-of-8 frames.
  private move(): void {
    if (this._gridOffset === 0) {
      // New leg: random distance 7 or $F, random left/right.
      const r = Math.floor(Math.random() * 256);
      this._gridOffset = (r & 0x0f) | 0x07;
      this._direction = (r & 1) === 0 ? Direction.Right : Direction.Left;
      return;
    }

    // Only move once every 8 frames.
    if ((this._frame & 0x07) !== 0) return;

    if (this._x < LEFT_LIMIT) {
      this._x = LEFT_LIMIT;
      this._direction = Direction.Right;
      this._gridOffset = 0x07;
    } else if (this._x >= RIGHT_REVERSE) {
      this._x = RIGHT_LIMIT;
      this._direction = Direction.Left;
      this._gridOffset = 0x07;
    }

    this._x += this._direction === Direction.Right ? 1 : -1;
    this._gridOffset--;
  }

  // Aquamentus_Shoot: when the timer expires, emit a 3-way fireball fan and
  // reset the timer to a random value ≥ $70.
  private shoot(): void {
    this._shootTimer--;
    if (this._shootTimer <= 0) {
      this.fireFan();
      this._shootTimer = Math.floor(Math.random() * 256) | 0x70; // ≥ 112 frames
    }
    // Mouth opens in the last $20 frames before firing (face tile swap).
    this._mouthOpen = this._shootTimer < 0x20;
  }

  private fireFan(): void {
    // All three spawn at the boss, travel Left, and fan apart via vertical drift
    // (middle level, lower +1, upper −1) applied every other frame.
    const sx = this._x;
    const sy = this._y + 8; // near the head/mouth
    const drifts = [0, 1, -1];
    for (const drift of drifts) {
      this._pendingProjectiles.push(
        new EnemyProjectile(sx, sy, Direction.Left, ProjectileType.Fireball, drift),
      );
    }
  }

  protected override renderEnemy(renderer: Renderer, _sheet?: SpriteSheet): void {
    const ctx = renderer.ctx;
    const x = this._x;
    const y = this._y;

    // Body (green dragon). Placeholder — CHR→sheet mapping deferred like the
    // rest of the roster; layout staged in sprites.json bosses.aquamentus.
    ctx.fillStyle = '#38a800';
    ctx.fillRect(x, y + 4, BODY_W, BODY_H - 4);
    // Head/neck on the left (toward Link), slightly lighter.
    ctx.fillStyle = '#68d820';
    ctx.fillRect(x - 2, y, 12, 18);
    // Horn.
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(x + 2, y - 3, 3, 5);
    // Mouth: open (red maw) while about to shoot, else a thin closed line.
    if (this._mouthOpen) {
      ctx.fillStyle = '#d82800';
      ctx.fillRect(x - 4, y + 8, 6, 6);
    } else {
      ctx.fillStyle = '#000000';
      ctx.fillRect(x - 2, y + 10, 6, 2);
    }
  }
}
