// Gohma — the crab boss of Levels 6 (red $34) and 8+ (blue $33).
// Z_04.asm: InitGohma (7804), UpdateGohma (8193), Gohma_HandleWeaponCollision (8466),
//           Gohma_AnimateAndDraw (8372), Gohma_CheckCollisions (8434).
//
// Walks left/right/down with 8-way direction bits. Only vulnerable to arrows
// shot UPWARD when the eye is HALF-OPEN (state 3) and the arrow hits the center.
// Shoots unblockable fireballs ($56) every $41 frames.

import { Direction, type Rect } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';
import type { SpriteSheet } from '../../render/sprite-renderer.js';
import { Enemy, type EnemyUpdateContext } from './enemy.js';
import { EnemyProjectile } from '../projectiles/enemy-projectile.js';
import { ProjectileType } from '../player/shield.js';

export const GOHMA_BLUE = 0x33;
export const GOHMA_RED = 0x34;

const MASK_ARROWS_ONLY = 0xfb; // immune to everything except arrows ($04 bit)

// Movement: accumulator adds $80 per frame → 0.5 px/f.
const MOVE_ACCUM_STEP = 0x80;
const SPRINT_DISTANCE = 0x20; // 32 px per sprint

// Eye timing
const EYE_OPEN_DURATION = 0x80; // 128 frames

// Shooting
const SHOOT_TIMER_RESET = 0x41; // 65 frames

// Body width for collision (5 parts × 8px).
const BODY_W = 40;
const BODY_H = 16;

// Eye states
const EYE_CLOSED_LEFT = 0;
const EYE_CLOSED_RIGHT = 1;
const EYE_FULLY_OPEN = 2;
const EYE_HALF_OPEN = 3;

// 8-way direction bits (NES convention)
const DIR_RIGHT = 1;
const DIR_LEFT = 2;
const DIR_DOWN = 4;

// Spawn position: NES ($80, $70) → local ($80, $70 − $40)
const SPAWN_X = 0x80;
const SPAWN_Y = 0x70 - 0x40;

export class Gohma extends Enemy {
  private _moveAccum = 0;
  private _distTraveled = 0;
  private _sprintCount = 0;
  private _goStraight = false;
  private _dirMask = DIR_RIGHT;
  private _eyeState = EYE_CLOSED_LEFT;
  private _eyeOpenTimer = 0;
  private _nextOpenEyeCounter = 0;
  private _eyeAnimCounter = 0;
  private _shootTimer = 1; // starts at 1 so it doesn't fire immediately
  private _frame = 0;

  constructor(_x: number, _y: number, objectType: number, hp: number, spawnCloudFrames: number) {
    super(SPAWN_X, SPAWN_Y, objectType, hp, spawnCloudFrames);
    this._invincibilityMask = MASK_ARROWS_ONLY;
    this._nextOpenEyeCounter = (Math.floor(Math.random() * 256) | 0xc0);
  }

  override stun(): void {}

  override getHitbox(): Rect {
    return { x: this._x - 16, y: this._y, width: BODY_W, height: BODY_H };
  }

  get eyeState(): number { return this._eyeState; }

  override takeDamage(damage: number, fromDirection: Direction, hitContext?: { x: number; y: number; dir: Direction }): boolean {
    if (this._invincibilityTimer > 0) return false;
    if (this._state !== 1) return false; // EnemyState.Active = 1

    if (!hitContext) return false;

    // Arrow must be traveling UP
    if (hitContext.dir !== Direction.Up) return false;

    // Eye must be half-open (state 3)
    if (this._eyeState !== EYE_HALF_OPEN) return false;

    // Arrow must hit the center (parts 3-4 of the 5-part body).
    // Parts are at X-16, X-8, X, X+8, X+16 (8px each).
    // Parts 3 and 4 (0-indexed: 2 and 3) are at X and X+8.
    const arrowCenterX = hitContext.x + 4;
    const bodyCenter = this._x;
    if (arrowCenterX < bodyCenter - 4 || arrowCenterX > bodyCenter + 12) return false;

    return super.takeDamage(damage, fromDirection);
  }

  protected override updateAI(ctx: EnemyUpdateContext): void {
    this._frame++;
    this.updateMovement();
    this.animateEye();
    this.updateShooting(ctx);
  }

  private updateMovement(): void {
    if (!this._goStraight) {
      this.chooseDirection();
      this._goStraight = true;
      return;
    }

    this._moveAccum += MOVE_ACCUM_STEP;
    if (this._moveAccum < 256) return;
    this._moveAccum -= 256;

    this._distTraveled++;

    // Move 1px in each active direction bit
    if (this._dirMask & DIR_RIGHT) this._x++;
    if (this._dirMask & DIR_LEFT) this._x--;
    if (this._dirMask & DIR_DOWN) this._y++;

    if (this._distTraveled >= SPRINT_DISTANCE) {
      this._distTraveled = 0;
      this.reverseDirection();
      this._sprintCount++;
      if (this._sprintCount % 2 === 0) {
        this._goStraight = false;
      }
    }
  }

  private chooseDirection(): void {
    const r = Math.floor(Math.random() * 256);
    if (r >= 0xb0) {
      this._dirMask = DIR_RIGHT;
    } else if (r >= 0x60) {
      this._dirMask = DIR_LEFT;
    } else {
      this._dirMask = DIR_DOWN;
    }
  }

  private reverseDirection(): void {
    let reversed = 0;
    if (this._dirMask & DIR_RIGHT) reversed |= DIR_LEFT;
    if (this._dirMask & DIR_LEFT) reversed |= DIR_RIGHT;
    if (this._dirMask & DIR_DOWN) reversed |= 8; // UP bit
    if (this._dirMask & 8) reversed |= DIR_DOWN;
    this._dirMask = reversed;
  }

  private animateEye(): void {
    if (this._nextOpenEyeCounter === 0) {
      this._eyeOpenTimer = EYE_OPEN_DURATION;
      this._nextOpenEyeCounter = (Math.floor(Math.random() * 256) | 0xc0);
    }

    // Decrement every other frame
    if (this._frame & 1) {
      this._nextOpenEyeCounter--;
    }

    if (this._eyeOpenTimer === 0) {
      // Eye is closed — animate between left/right every 8 frames
      this._eyeAnimCounter++;
      if (this._eyeAnimCounter >= 8) {
        this._eyeAnimCounter = 0;
        this._eyeState = (this._eyeState & 1) ^ 1;
      }
    } else {
      this._eyeOpenTimer--;
      if (this._eyeOpenTimer >= 0x70 || this._eyeOpenTimer < 0x10) {
        this._eyeState = EYE_FULLY_OPEN;
      } else {
        this._eyeState = EYE_HALF_OPEN;
      }
    }
  }

  private updateShooting(ctx: EnemyUpdateContext): void {
    this._shootTimer--;
    if (this._shootTimer <= 0) {
      this._shootTimer = SHOOT_TIMER_RESET;
      const dir = this.directionTowardLink(ctx.linkX, ctx.linkY);
      this._pendingProjectile = new EnemyProjectile(
        this._x, this._y, dir, ProjectileType.Fireball2Unblockable,
      );
    }
  }

  protected override renderEnemy(renderer: Renderer, _sheet?: SpriteSheet): void {
    const ctx = renderer.ctx;
    const x = this._x;
    const y = this._y;

    // Body (dark crab shape)
    const isBlue = this._objectType === GOHMA_BLUE;
    ctx.fillStyle = isBlue ? '#0058f0' : '#d82800';
    ctx.fillRect(x - 16, y + 2, BODY_W, BODY_H - 2);

    // Legs on each side
    ctx.fillStyle = isBlue ? '#0040b0' : '#a01800';
    ctx.fillRect(x - 20, y + 4, 6, 10);
    ctx.fillRect(x + 20, y + 4, 6, 10);

    // Eye in the center
    switch (this._eyeState) {
      case EYE_CLOSED_LEFT:
        ctx.fillStyle = '#000';
        ctx.fillRect(x - 2, y + 5, 6, 2);
        break;
      case EYE_CLOSED_RIGHT:
        ctx.fillStyle = '#000';
        ctx.fillRect(x, y + 5, 6, 2);
        break;
      case EYE_FULLY_OPEN:
        ctx.fillStyle = '#fff';
        ctx.fillRect(x - 2, y + 3, 8, 8);
        ctx.fillStyle = '#d82800';
        ctx.fillRect(x, y + 5, 4, 4);
        break;
      case EYE_HALF_OPEN:
        ctx.fillStyle = '#fff';
        ctx.fillRect(x - 1, y + 4, 6, 6);
        ctx.fillStyle = '#d82800';
        ctx.fillRect(x + 1, y + 6, 3, 3);
        break;
    }
  }
}
