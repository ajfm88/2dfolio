// Manhandla — the flower boss of Level 3.
// Z_04.asm: InitManhandla (7738), UpdateManhandla (7832), Manhandla_CheckCollisions
//           (7968), Manhandla_SetAllSegmentsDirection (8059), Manhandla_Move (8067).
//
// A rigid cluster of 1 center body + 4 hands (up/down/left/right, each 16px out).
// The group drifts 8-way (re-aiming toward Link every 16f, bouncing off walls). Each
// hand is a normal, killable Enemy (mask $E2 — immune to fire+boomerang) that shoots
// unblockable fireballs; the center is invulnerable and dies only when the LAST hand
// dies. Every hand death speeds the whole group up — the classic frantic acceleration.
//
// Modeled as 5 real Enemy objects (matches the NES's 5 slots) so the existing
// per-enemy collision / damage / drop code handles each hand for free; only the
// coordination (movement + speed-up + center death) is new.

import { Direction, type Rect } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';
import { drawBossSprite, MANHANDLA_SPRITES } from '../../render/boss-sprite-data.js';
import { Enemy, EnemyState, type EnemyUpdateContext } from './enemy.js';
import { EnemyProjectile } from '../projectiles/enemy-projectile.js';
import { ProjectileType } from '../player/shield.js';

export const MANHANDLA = 0x3c;

const HAND_OFFSET = 16;
const MASK_FIRE_AND_BOOMERANG = 0xe2; // ObjInvincibilityMask from InitManhandla

// Center-position bounds that keep all four ±16 hands inside the 256×176 play area.
const MIN_X = HAND_OFFSET;
const MAX_X = 256 - HAND_OFFSET - 16;
const MIN_Y = HAND_OFFSET;
const MAX_Y = 176 - HAND_OFFSET - 16;

// 8-way direction bitmask (NES Directions8 semantics).
const R = 1, L = 2, D = 4, U = 8;
const DIR8 = [R, R | D, D, L | D, L, L | U, U, R | U];

const RETARGET_FRAMES = 0x10; // UpdateManhandla @TurnIfNeeded cadence
const START_SPEED_FRAC = 0x80; // InitManhandla low speed byte → 0.5 px/f
const SPEED_STEP = 0x80;        // added to every segment's SpeedFrac per hand death
const SHOOT_CHANCE = 1 / 96;    // approximates frame-0 & Random≥$E0 & ≤4-on-screen

// ---------------------------------------------------------------------------

export class ManhandlaHand extends Enemy {
  constructor(
    x: number, y: number, hp: number, spawnCloudFrames: number, _cardinal: Direction,
  ) {
    super(x, y, MANHANDLA, hp, spawnCloudFrames);
    this._invincibilityMask = MASK_FIRE_AND_BOOMERANG;
  }

  // The center drives our position each frame; we never move ourselves.
  setPos(x: number, y: number): void {
    this._x = x;
    this._y = y;
  }

  // Bosses aren't boomerang-stunned.
  override stun(): void {}

  protected override updateAI(ctx: EnemyUpdateContext): void {
    this.tickWalkAnimation(8);
    // Fire an unblockable fireball ($56) aimed at Link (4-way — see simplifications).
    if (Math.random() < SHOOT_CHANCE) {
      const dir = this.directionTowardLink(ctx.linkX, ctx.linkY);
      this._pendingProjectile = new EnemyProjectile(
        this._x + 4, this._y, dir, ProjectileType.Fireball2Unblockable,
      );
    }
  }

  protected override renderEnemy(renderer: Renderer): void {
    const frameIdx = this._walkAnimFrame & 1;
    const frame = MANHANDLA_SPRITES.hand[frameIdx] ?? MANHANDLA_SPRITES.hand[0];
    if (frame) drawBossSprite(renderer, frame, this._x, this._y);
  }
}

// ---------------------------------------------------------------------------

export class ManhandlaCenter extends Enemy {
  private _hands: (ManhandlaHand | null)[] = [];
  private _dirMask = DIR8[Math.floor(Math.random() * DIR8.length)]!;
  private _retarget = RETARGET_FRAMES;
  private _speedFrac = START_SPEED_FRAC;
  private _speedWhole = 0;
  private _speedAccum = 0;
  private _frame = 0;

  constructor(x: number, y: number, hp: number, spawnCloudFrames: number) {
    super(x, y, MANHANDLA, hp, spawnCloudFrames);
    this._vulnerable = false; // the center is never hurt directly
    this._invincibilityMask = 0xff;
  }

  setHands(hands: ManhandlaHand[]): void {
    this._hands = [...hands];
  }

  get livingHands(): number {
    return this._hands.filter(h => h !== null).length;
  }

  // Effective group speed in px/frame (debug / tests). Rises as hands die.
  get speedPerFrame(): number {
    return (this._speedWhole * 256 + this._speedFrac) / 256;
  }

  override stun(): void {}

  protected override updateAI(ctx: EnemyUpdateContext): void {
    this._frame++;
    this.retarget(ctx);
    this.move();
    this.repositionHands();
    this.reapDeadHands();
  }

  // Every 16 frames: 50% aim 8-way at Link, 50% turn randomly.
  private retarget(ctx: EnemyUpdateContext): void {
    if (--this._retarget > 0) return;
    this._retarget = RETARGET_FRAMES;
    if (Math.random() < 0.5) {
      this._dirMask = this.aimAtLink(ctx.linkX, ctx.linkY);
    } else {
      this._dirMask = DIR8[Math.floor(Math.random() * DIR8.length)]!;
    }
  }

  private aimAtLink(linkX: number, linkY: number): number {
    let mask = 0;
    const dx = linkX - this._x;
    const dy = linkY - this._y;
    if (dx > 8) mask |= R; else if (dx < -8) mask |= L;
    if (dy > 8) mask |= D; else if (dy < -8) mask |= U;
    return mask === 0 ? this._dirMask : mask;
  }

  // Manhandla_Move: fractional speed accumulator, applied along each active dir bit.
  private move(): void {
    this._speedAccum += this._speedFrac & 0xe0;
    let step = this._speedWhole;
    if (this._speedAccum >= 256) {
      this._speedAccum -= 256;
      step += 1;
    }
    if (step === 0) return;

    let nx = this._x;
    let ny = this._y;
    if (this._dirMask & R) nx += step;
    if (this._dirMask & L) nx -= step;
    if (this._dirMask & D) ny += step;
    if (this._dirMask & U) ny -= step;

    // Bounce off the play-area walls (reflect the offending axis bits).
    if (nx < MIN_X) { nx = MIN_X; this._dirMask = (this._dirMask & ~L) | R; }
    else if (nx > MAX_X) { nx = MAX_X; this._dirMask = (this._dirMask & ~R) | L; }
    if (ny < MIN_Y) { ny = MIN_Y; this._dirMask = (this._dirMask & ~U) | D; }
    else if (ny > MAX_Y) { ny = MAX_Y; this._dirMask = (this._dirMask & ~D) | U; }

    this._x = nx;
    this._y = ny;
  }

  private repositionHands(): void {
    const at: Record<number, { dx: number; dy: number }> = {
      [Direction.Up]: { dx: 0, dy: -HAND_OFFSET },
      [Direction.Down]: { dx: 0, dy: HAND_OFFSET },
      [Direction.Left]: { dx: -HAND_OFFSET, dy: 0 },
      [Direction.Right]: { dx: HAND_OFFSET, dy: 0 },
    };
    for (let i = 0; i < this._hands.length; i++) {
      const hand = this._hands[i];
      if (!hand || !hand.isActive) continue;
      const o = at[handCardinal(i)]!;
      hand.setPos(this._x + o.dx, this._y + o.dy);
    }
  }

  // A hand that stopped being active (Dying/Dead) counts as lost: speed up once,
  // drop the reference. When the last hand is gone, the whole boss dies.
  private reapDeadHands(): void {
    for (let i = 0; i < this._hands.length; i++) {
      const hand = this._hands[i];
      if (hand && !hand.isActive) {
        this._hands[i] = null;
        this.speedUp();
      }
    }
    if (this.livingHands === 0 && this._state === EnemyState.Active) {
      this._state = EnemyState.Dying;
      this._deathTimer = 12;
      this.onDeath();
    }
  }

  private speedUp(): void {
    this._speedFrac += SPEED_STEP;
    if (this._speedFrac > 0xff) {
      this._speedFrac -= 256;
      this._speedWhole += 1;
    }
  }

  override getHitbox(): Rect {
    return { x: this._x, y: this._y, width: 16, height: 16 };
  }

  protected override renderEnemy(renderer: Renderer): void {
    const frameIdx = (this._frame >> 3) & 1;
    const frame = MANHANDLA_SPRITES.center[frameIdx] ?? MANHANDLA_SPRITES.center[0];
    if (frame) drawBossSprite(renderer, frame, this._x, this._y);
  }
}

function handCardinal(index: number): Direction {
  return [Direction.Up, Direction.Down, Direction.Left, Direction.Right][index]!;
}

// Build the 5-object cluster centered at (cx, cy). Hands start already in position.
export function createManhandla(
  cx: number, cy: number, hp: number, spawnCloudFrames: number,
): { center: ManhandlaCenter; hands: ManhandlaHand[] } {
  const center = new ManhandlaCenter(cx, cy, hp, spawnCloudFrames);
  const hands = [
    new ManhandlaHand(cx, cy - HAND_OFFSET, hp, spawnCloudFrames, Direction.Up),
    new ManhandlaHand(cx, cy + HAND_OFFSET, hp, spawnCloudFrames, Direction.Down),
    new ManhandlaHand(cx - HAND_OFFSET, cy, hp, spawnCloudFrames, Direction.Left),
    new ManhandlaHand(cx + HAND_OFFSET, cy, hp, spawnCloudFrames, Direction.Right),
  ];
  center.setHands(hands);
  return { center, hands };
}
