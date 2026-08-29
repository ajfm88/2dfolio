// Dodongo — the armored dino boss of Level 2.
// Z_04.asm: InitDodongo (4899), UpdateDodongo (5855), UpdateDodongoState (5867),
//           Dodongo_CheckCollisions (6014), Dodongo_CheckBombHit (6085),
//           Dodongo_TryEatBomb (6145).
//
// A long (2-tile-wide) creature that wanders toward Link. It is IMMUNE to every
// direct weapon (sword just clinks). The only way to hurt it is bombs:
//   - a bomb blast next to it → STUNNED; while stunned a single sword hit kills it.
//   - an un-exploded bomb in its MOUTH → it EATS it and bloats; two eaten = death.
// Death is scripted (HP is irrelevant), matching the NES.

import {
  SCREEN_EDGE_LEFT,
  SCREEN_EDGE_RIGHT,
  SCREEN_EDGE_TOP,
  SCREEN_EDGE_BOTTOM,
} from '../../core/constants.js';
import { Direction, type Rect } from '../../core/types.js';
import { rectsOverlap } from '../../core/collision-utils.js';
import type { Renderer } from '../../render/renderer.js';
import type { SpriteSheet } from '../../render/sprite-renderer.js';
import { Enemy, EnemyState, type EnemyUpdateContext, type BombLike } from './enemy.js';
import { BombState } from '../weapons/bomb.js';

export const DODONGO = 0x32;

// 2 tiles wide, 1 tall.
const BODY_W = 32;
const BODY_H = 16;
// Left corner may travel to SCREEN_EDGE_RIGHT − 16 so the 32-wide body stays on-screen.
const MAX_X = SCREEN_EDGE_RIGHT - 16;

const MASK_ALL = 0xff;   // immune to everything (Move / Bloated states)
const MASK_NO_SWORD = 0xfe; // sword bit cleared so a stunned Dodongo can be sworded

const MOVE_QSPEED = 0x40;      // ~1px/frame (qSpeedFrac/64)
const TURN_RATE = 0x20;        // Z_04 Wanderer_TargetPlayer turn rate — re-aim chance
const STUN_FRAMES = 0x40;      // Dodongo_CheckBombHit stun window (state 2, self-rearms)
const BLOATED_FRAMES = 0xa0;   // sum of DodongoBloatedWaitTimes ($20+$40+$40)
const BOMB_HITS_TO_KILL = 2;   // eaten-bomb #2 ⇒ die

enum DState { Move, Bloated, Stunned }

function dirDelta(dir: Direction): { dx: number; dy: number } {
  switch (dir) {
    case Direction.Up: return { dx: 0, dy: -1 };
    case Direction.Down: return { dx: 0, dy: 1 };
    case Direction.Left: return { dx: -1, dy: 0 };
    case Direction.Right: return { dx: 1, dy: 0 };
  }
}

export class Dodongo extends Enemy {
  private _dstate = DState.Move;
  private _bombHits = 0;
  private _stateTimer = 0;
  private readonly _subpixel = { value: 0 };
  private _mouthOpen = false;

  constructor(x: number, y: number, objectType: number, hp: number, spawnCloudFrames: number) {
    super(x, y, objectType, hp, spawnCloudFrames);
    // Randomly face left or right (InitDodongo).
    this._direction = Math.random() < 0.5 ? Direction.Left : Direction.Right;
    this._invincibilityMask = MASK_ALL;
  }

  // Bosses are never boomerang-stunned; Dodongo's only stun source is a bomb blast.
  override stun(): void {}

  override getHitbox(): Rect {
    return { x: this._x, y: this._y, width: BODY_W, height: BODY_H };
  }

  // Current sub-state (debug overlay / tests).
  get phase(): 'move' | 'bloated' | 'stunned' {
    return this._dstate === DState.Stunned
      ? 'stunned'
      : this._dstate === DState.Bloated
        ? 'bloated'
        : 'move';
  }

  get bombsEaten(): number { return this._bombHits; }

  // The leading half of the body, where a bomb must land to be eaten.
  private getMouthRect(): Rect {
    const frontLeft = this._direction === Direction.Right;
    return {
      x: frontLeft ? this._x + 16 : this._x,
      y: this._y,
      width: 16,
      height: 16,
    };
  }

  // Reachable only when the mask lets a weapon through — i.e. Stunned + sword.
  override takeDamage(_damage: number, _fromDirection: Direction): boolean {
    if (this._dstate !== DState.Stunned) return false;
    this._hp = 0;
    this._state = EnemyState.Dying;
    this._deathTimer = 12;
    this.onDeath();
    return true;
  }

  protected override updateAI(ctx: EnemyUpdateContext): void {
    switch (this._dstate) {
      case DState.Move:
        this.moveTowardLink(ctx);
        this.reactToBombs(ctx.bombs ?? []);
        this.tickWalkAnimation(8);
        break;
      case DState.Bloated:
        if (--this._stateTimer <= 0) {
          if (this._bombHits >= BOMB_HITS_TO_KILL) {
            this._hp = 0;
            this._state = EnemyState.Dying;
            this._deathTimer = 12;
            this.onDeath();
          } else {
            this.enterMove();
          }
        }
        break;
      case DState.Stunned:
        if (--this._stateTimer <= 0) this.enterMove();
        break;
    }
  }

  private enterMove(): void {
    this._dstate = DState.Move;
    this._mouthOpen = false;
    this._invincibilityMask = MASK_ALL;
  }

  private enterStunned(): void {
    this._dstate = DState.Stunned;
    this._stateTimer = STUN_FRAMES;
    this._invincibilityMask = MASK_NO_SWORD; // sword can now reach takeDamage()
  }

  private enterBloated(): void {
    this._dstate = DState.Bloated;
    this._bombHits++;
    this._stateTimer = BLOATED_FRAMES;
    this._mouthOpen = true;
    this._invincibilityMask = MASK_ALL;
  }

  // Wanderer_TargetPlayer (turn rate $20): drift toward Link, occasionally re-aiming.
  private moveTowardLink(ctx: EnemyUpdateContext): void {
    this._subpixel.value += MOVE_QSPEED;
    while (this._subpixel.value >= 256) {
      this._subpixel.value -= 256;
      this.moveOnePx(ctx);
    }
  }

  private moveOnePx(ctx: EnemyUpdateContext): void {
    if ((this._x & 7) === 0 && (this._y & 7) === 0) {
      if (Math.floor(Math.random() * 256) < TURN_RATE) {
        this._direction = this.directionTowardLink(ctx.linkX, ctx.linkY);
      }
    }
    const { dx, dy } = dirDelta(this._direction);
    const nx = this._x + dx;
    const ny = this._y + dy;
    if (this.bodyFits(nx, ny, ctx)) {
      this._x = nx;
      this._y = ny;
    } else {
      // Blocked — re-aim toward Link (may turn back into open space next frame).
      this._direction = this.directionTowardLink(ctx.linkX, ctx.linkY);
    }
  }

  private bodyFits(nx: number, ny: number, ctx: EnemyUpdateContext): boolean {
    if (nx < SCREEN_EDGE_LEFT || nx > MAX_X) return false;
    if (ny < SCREEN_EDGE_TOP || ny > SCREEN_EDGE_BOTTOM) return false;
    // Both 16×16 halves must be walkable (boss rooms are open, so usually trivial).
    return (
      ctx.collision.isRectWalkable(ctx.screen, nx, ny, 16, 16) &&
      ctx.collision.isRectWalkable(ctx.screen, nx + 16, ny, 16, 16)
    );
  }

  // Dodongo_CheckBombHit: only while moving.
  private reactToBombs(bombs: readonly BombLike[]): void {
    const body = this.getHitbox();
    const mouth = this.getMouthRect();
    for (const bomb of bombs) {
      // An un-exploded bomb in the mouth is eaten (→ bloated).
      const unexploded = bomb.state === BombState.Idle || bomb.state === BombState.Fuse;
      if (unexploded) {
        const bombRect: Rect = { x: bomb.x, y: bomb.y, width: 16, height: 16 };
        if (rectsOverlap(bombRect, mouth)) {
          this.enterBloated();
          return;
        }
        continue;
      }
      // A blast overlapping the body stuns it (→ swordable).
      const blast = bomb.getExplosionHitbox();
      if (blast && rectsOverlap(blast, body)) {
        this.enterStunned();
        return;
      }
    }
  }

  protected override renderEnemy(renderer: Renderer, _sheet?: SpriteSheet): void {
    const ctx = renderer.ctx;
    const x = this._x;
    const y = this._y;
    const facingRight = this._direction === Direction.Right;

    // Body — armored green; puffs lighter when bloated, tinted yellow when stunned.
    let body = '#78a800';
    if (this._dstate === DState.Bloated) body = '#a8d020';
    ctx.fillStyle = body;
    ctx.fillRect(x, y + 2, BODY_W, BODY_H - 2);

    // Armor plates.
    ctx.fillStyle = '#3c6800';
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 2 + i * 8, y + 4, 5, BODY_H - 6);

    // Head/mouth on the facing end.
    const headX = facingRight ? x + BODY_W - 8 : x;
    ctx.fillStyle = '#c0f040';
    ctx.fillRect(headX, y, 8, BODY_H);
    if (this._mouthOpen) {
      ctx.fillStyle = '#d82800';
      ctx.fillRect(facingRight ? headX + 2 : headX - 2, y + 5, 6, 6);
    } else {
      ctx.fillStyle = '#000000';
      ctx.fillRect(facingRight ? headX + 3 : headX + 1, y + 7, 5, 2);
    }

    if (this._dstate === DState.Stunned) {
      ctx.fillStyle = 'rgba(255,255,0,0.35)';
      ctx.fillRect(x, y, BODY_W, BODY_H);
    }
  }
}
