// Patra — Z_04.asm InitPatra:9526, UpdatePatra:10032, UpdatePatraChild:10127
// Orbiting flies boss. Center body (type $47/$48) with 8 children ($25/$26).
// Center uses a 4-state flyer (SpeedUp/Decide/Chase/Wander).
// Children orbit using NES fixed-point angle math + PatraSines table.
// Center invulnerable while any child alive; sword-only when all children dead.

import {
  SCREEN_EDGE_BOTTOM,
  SCREEN_EDGE_LEFT,
  SCREEN_EDGE_RIGHT,
  SCREEN_EDGE_TOP,
} from '../../core/constants.js';
import { Direction } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';
import { Enemy, EnemyState, type EnemyUpdateContext } from './enemy.js';

// --- NES data from sprites.json / Z_04.asm ---

const PATRA_SINES: readonly number[] = [
  0, 24, 48, 71, 90, 106, 118, 125, 128, 125, 118, 106, 90, 71, 48, 24,
];

const CHILD_START_ANGLES: readonly number[] = [20, 16, 12, 8, 4, 0, 28];

const MANEUVER_TIMES: readonly number[] = [0xff, 0x50];

// Rotation bit counts per [maneuverIndex]:
// Child1 ($25): cosine bits, sine bits
const CHILD1_COS_BITS: readonly number[] = [6, 5];
const CHILD1_SIN_BITS: readonly number[] = [6, 6];
// Child2 ($26): same value for both axes
const CHILD2_BITS: readonly number[] = [5, 6];

const CHILD1_RADIUS = 0x2c;
const CHILD2_RADIUS = 0x18;
const CHILD1_ANGLE_DECREMENT = 0x70;
const CHILD2_ANGLE_DECREMENT = 0x60;
const CHILD1_TYPE = 0x25;

const PATRA_MAX_SPEED = 0x40 / 256;
const PATRA_SPEED_INCREMENT = 0x04 / 256;
const PATRA_INIT_SPEED = 0x1f / 256;

// --- Flyer state machine (4-state, from ControlPatraFlight) ---

enum PatraFlyingState {
  SpeedUp,
  Decide,
  Chase,
  Wander,
}

// --- ShiftMultiply: NES fixed-point multiplication ---
// Multiplies A * [00] using Y high bits of [00], returning a 16-bit result.
function shiftMultiply(a: number, multiplier: number, bitCount: number): number {
  let product = 0;
  let mult = multiplier;
  for (let i = 0; i < bitCount; i++) {
    product <<= 1;
    mult <<= 1;
    if (mult & 0x100) {
      product += a;
      mult &= 0xff;
    }
  }
  return product;
}

// --- PatraCenter ---

export class PatraCenter extends Enemy {
  private _children: PatraChild[] = [];
  private _flyState = PatraFlyingState.SpeedUp;
  private _speed: number;
  private _velX = 0;
  private _velY = 0;
  private _turnsRemaining = 0;
  private _maneuverIndex = 0;
  private _maneuverTimer: number;
  private _offsetX = 0;
  private _offsetY = 0;
  private _childrenReady = false;

  constructor(
    x: number, y: number,
    objectType: number, hp: number, spawnCloudFrames: number,
  ) {
    super(x, y, objectType, hp, spawnCloudFrames);
    this._invincibilityMask = 0xfe; // sword-only
    this._vulnerable = false; // starts invulnerable (children alive)
    this._speed = PATRA_INIT_SPEED;
    this._maneuverTimer = 0xff;
    // InitPatra: position ($80, $70) → local ($80, $30) after HUD offset
    this._x = 0x80;
    this._y = 0x30;
    this._direction = Direction.Up;
  }

  setChildren(children: PatraChild[]): void {
    this._children = children;
  }

  get offsetX(): number { return this._offsetX; }
  get offsetY(): number { return this._offsetY; }
  get maneuverIndex(): number { return this._maneuverIndex; }
  get childrenReady(): boolean { return this._childrenReady; }
  setChildrenReady(): void { this._childrenReady = true; }

  override stun(): void {} // never stunnable

  protected override updateAI(ctx: EnemyUpdateContext): void {
    // Flight control
    this.controlFlight(ctx.linkX, ctx.linkY);

    // Track movement offset for children
    const prevX = this._x;
    const prevY = this._y;
    this.moveFlyer();
    this._offsetX = this._x - prevX;
    this._offsetY = this._y - prevY;

    // Drive sequential appearance of children
    if (!this._childrenReady) {
      const first = this._children[0];
      if (first) {
        for (let i = 1; i < this._children.length; i++) {
          const child = this._children[i];
          if (child) child.checkAppearance(first.angleWhole);
        }
      }
    }

    // Check if any children alive
    const hasChildren = this._children.some(c =>
      c.state !== EnemyState.Dead && c.state !== EnemyState.Dying,
    );
    this._vulnerable = !hasChildren;

    // Maneuver toggle: timer expired AND first child's angle whole === 0
    if (this._maneuverTimer > 0) {
      this._maneuverTimer--;
    }
    if (this._maneuverTimer === 0) {
      const firstChild = this._children[0];
      if (firstChild && firstChild.angleWhole === 0) {
        this._maneuverIndex ^= 1;
        this._maneuverTimer = MANEUVER_TIMES[this._maneuverIndex] ?? 0xff;
      }
    }
  }

  private controlFlight(linkX: number, linkY: number): void {
    switch (this._flyState) {
      case PatraFlyingState.SpeedUp:
        this._speed = Math.min(PATRA_MAX_SPEED, this._speed + PATRA_SPEED_INCREMENT);
        if (this._speed >= PATRA_MAX_SPEED) {
          this._flyState = PatraFlyingState.Decide;
        }
        break;

      case PatraFlyingState.Decide: {
        const r = Math.floor(Math.random() * 256);
        this._flyState = r >= 0x40 ? PatraFlyingState.Chase : PatraFlyingState.Wander;
        this._turnsRemaining = 8;
        break;
      }

      case PatraFlyingState.Chase:
        this.chaseLink(linkX, linkY);
        this._turnsRemaining--;
        if (this._turnsRemaining <= 0) {
          this._flyState = PatraFlyingState.Decide;
        }
        break;

      case PatraFlyingState.Wander:
        if (this._turnsRemaining <= 0 || Math.random() < 0.03) {
          const angle = Math.random() * Math.PI * 2;
          this._velX = Math.cos(angle) * this._speed;
          this._velY = Math.sin(angle) * this._speed;
          this._turnsRemaining--;
        }
        if (this._turnsRemaining <= 0) {
          this._flyState = PatraFlyingState.SpeedUp;
          this._speed = 0;
        }
        break;
    }
  }

  private chaseLink(linkX: number, linkY: number): void {
    const dx = linkX - this._x;
    const dy = linkY - this._y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      this._velX = (dx / dist) * this._speed;
      this._velY = (dy / dist) * this._speed;
    }
  }

  private moveFlyer(): void {
    let nx = this._x + this._velX;
    let ny = this._y + this._velY;

    if (nx < SCREEN_EDGE_LEFT || nx > SCREEN_EDGE_RIGHT) {
      this._velX = -this._velX;
      nx = this._x + this._velX;
    }
    if (ny < SCREEN_EDGE_TOP || ny > SCREEN_EDGE_BOTTOM) {
      this._velY = -this._velY;
      ny = this._y + this._velY;
    }

    this._x = Math.max(SCREEN_EDGE_LEFT, Math.min(SCREEN_EDGE_RIGHT, nx));
    this._y = Math.max(SCREEN_EDGE_TOP, Math.min(SCREEN_EDGE_BOTTOM, ny));
  }

  protected override renderEnemy(renderer: Renderer): void {
    const ctx = renderer.ctx;
    ctx.fillStyle = '#a04000';
    ctx.fillRect(this._x + 1, this._y + 1, 14, 14);
    ctx.fillStyle = '#f87858';
    ctx.fillRect(this._x + 3, this._y + 3, 10, 10);
    ctx.fillStyle = '#f8d870';
    ctx.fillRect(this._x + 6, this._y + 6, 4, 4);
  }
}

// --- PatraChild ---

export class PatraChild extends Enemy {
  private readonly _parent: PatraCenter;
  private readonly _childIndex: number; // 0-7
  private readonly _isType25: boolean;
  private _orbitState = 0; // 0 = waiting to appear, 1 = orbiting
  private _angleWhole = 0x18; // starts at North
  private _angleFrac = 0;
  private _qSpeedFrac = 0x20;
  private _xFrac = 0;
  private _yFrac = 0;

  constructor(
    x: number, y: number,
    objectType: number, hp: number, _spawnCloudFrames: number,
    parent: PatraCenter, childIndex: number,
  ) {
    super(x, y, objectType, hp, 0); // no spawn cloud
    this._parent = parent;
    this._childIndex = childIndex;
    this._isType25 = objectType === CHILD1_TYPE;
    this._invincibilityMask = 0xfe; // sword-only
    // Position above parent
    const radius = this._isType25 ? CHILD1_RADIUS : CHILD2_RADIUS;
    this._x = parent.x;
    this._y = parent.y - radius;
    // First child (index 0) appears immediately
    if (childIndex === 0) {
      this._orbitState = 1;
      this._state = EnemyState.Active;
    }
  }

  get angleWhole(): number { return this._angleWhole; }

  override stun(): void {} // never stunnable

  override update(ctx: EnemyUpdateContext): void {
    if (this._state === EnemyState.Dead || this._state === EnemyState.Dying) {
      // Standard dying timer
      if (this._state === EnemyState.Dying) {
        this._deathTimer--;
        if (this._deathTimer <= 0) {
          this._state = EnemyState.Dead;
        }
      }
      return;
    }
    if (this._invincibilityTimer > 0) this._invincibilityTimer--;
    this.updateChild(ctx);
  }

  private updateChild(_ctx: EnemyUpdateContext): void {
    if (this._orbitState === 0) {
      // Waiting to appear — parent drives sequential appearance via checkAppearance()
      return;
    }

    // State 1: Orbiting
    // Add parent's movement offset
    this._x += this._parent.offsetX;
    this._y += this._parent.offsetY;

    // Decrease angle
    const decrement = this._isType25 ? CHILD1_ANGLE_DECREMENT : CHILD2_ANGLE_DECREMENT;
    this.decreaseAngle(decrement);

    // Rotate position around parent
    const mi = this._parent.maneuverIndex;
    let cosBits: number;
    let sinBits: number;
    if (this._isType25) {
      cosBits = CHILD1_COS_BITS[mi] ?? 6;
      sinBits = CHILD1_SIN_BITS[mi] ?? 6;
    } else {
      const bits = CHILD2_BITS[mi] ?? 5;
      cosBits = bits;
      sinBits = bits;
    }
    this.rotatePosition(cosBits, sinBits);
  }

  // Called by the center each frame to check sequential appearance
  checkAppearance(firstChildAngle: number): void {
    if (this._orbitState !== 0) return;
    if (this._childIndex === 0) return; // already handled

    const angleIdx = this._childIndex - 1;
    if (angleIdx < 0 || angleIdx >= CHILD_START_ANGLES.length) return;
    const requiredAngle = CHILD_START_ANGLES[angleIdx];
    if (requiredAngle === undefined) return;

    if (firstChildAngle === requiredAngle) {
      this._orbitState = 1;
      this._state = EnemyState.Active;
      this._angleWhole = 0x18;
      // Position at top of parent
      const radius = this._isType25 ? CHILD1_RADIUS : CHILD2_RADIUS;
      this._x = this._parent.x;
      this._y = this._parent.y - radius;
      this.checkLastChild();
    }
  }

  private checkLastChild(): void {
    if (this._childIndex === 7) {
      this._parent.setChildrenReady();
    }
  }

  // Z_04.asm DecreaseObjectAngle:12025
  private decreaseAngle(amount: number): void {
    const oldFrac = this._angleFrac;
    this._angleFrac = (oldFrac - amount) & 0xff;
    // Borrow if frac wrapped
    const borrow = oldFrac < amount ? 1 : 0;
    this._angleWhole = (this._angleWhole - borrow) & 0x1f;
  }

  // Z_04.asm RotateObjectLocation:11880
  private rotatePosition(cosBitsCount: number, sinBitsCount: number): void {
    // X rotation (sine)
    const sinIdx = this._angleWhole & 0x0f;
    const sinVal = PATRA_SINES[sinIdx] ?? 0;
    const xProduct = shiftMultiply(this._qSpeedFrac, sinVal, sinBitsCount);
    const xProductFrac = xProduct & 0xff;
    const xProductWhole = (xProduct >> 8) & 0xff;

    const inTopHalf = (this._angleWhole & 0x18) >= 0x10;
    if (inTopHalf) {
      const newFrac = (this._xFrac - xProductFrac) & 0xff;
      const borrow = this._xFrac < xProductFrac ? 1 : 0;
      this._xFrac = newFrac;
      this._x = this._x - xProductWhole - borrow;
    } else {
      const newFrac = (this._xFrac + xProductFrac) & 0xff;
      const carry = (this._xFrac + xProductFrac) > 0xff ? 1 : 0;
      this._xFrac = newFrac;
      this._x = this._x + xProductWhole + carry;
    }

    // Y rotation (cosine = sine offset by 8)
    const cosIdx = ((this._angleWhole + 8) & 0x0f);
    const cosVal = PATRA_SINES[cosIdx] ?? 0;
    const yProduct = shiftMultiply(this._qSpeedFrac, cosVal, cosBitsCount);
    const yProductFrac = yProduct & 0xff;
    const yProductWhole = (yProduct >> 8) & 0xff;

    const shiftedAngle = (this._angleWhole - 8) & 0x1f;
    const inRightHalf = (shiftedAngle & 0x18) >= 0x10;
    if (inRightHalf) {
      const newFrac = (this._yFrac - yProductFrac) & 0xff;
      const borrow = this._yFrac < yProductFrac ? 1 : 0;
      this._yFrac = newFrac;
      this._y = this._y - yProductWhole - borrow;
    } else {
      const newFrac = (this._yFrac + yProductFrac) & 0xff;
      const carry = (this._yFrac + yProductFrac) > 0xff ? 1 : 0;
      this._yFrac = newFrac;
      this._y = this._y + yProductWhole + carry;
    }
  }

  protected override renderEnemy(renderer: Renderer): void {
    if (this._orbitState === 0) return;
    const ctx = renderer.ctx;
    ctx.fillStyle = this._isType25 ? '#f83800' : '#e45c10';
    ctx.fillRect(this._x + 3, this._y + 3, 10, 10);
    ctx.fillStyle = '#f8b800';
    ctx.fillRect(this._x + 5, this._y + 5, 6, 6);
  }
}

// --- Factory ---

export function createPatra(
  _cx: number, _cy: number,
  objectType: number, hp: number, spawnDelay: number,
): { center: PatraCenter; children: PatraChild[] } {
  const center = new PatraCenter(0x80, 0x30, objectType, hp, spawnDelay);
  const childType = objectType === 0x47 ? 0x25 : 0x26;
  const children: PatraChild[] = [];
  for (let i = 0; i < 8; i++) {
    children.push(new PatraChild(
      center.x, center.y,
      childType, hp, 0,
      center, i,
    ));
  }
  center.setChildren(children);
  return { center, children };
}
