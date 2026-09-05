// Digdogger — Z_04.asm: InitDigdogger1 (4856), InitDigdogger2 (4885),
//   UpdateDigdogger (5000), Digdogger_Move (5145), Digdogger_ReactToFlute (5250).
//
// A large pulsing creature immune to weapons. Playing the Recorder/Flute causes
// it to flicker and split into 1 or 3 killable children ($18 LittleDigdogger).
// $38 = Digdogger1 (splits into 3 children), $39 = Digdogger2 (splits into 1).

import {
  SCREEN_EDGE_BOTTOM,
  SCREEN_EDGE_LEFT,
  SCREEN_EDGE_RIGHT,
  SCREEN_EDGE_TOP,
} from '../../core/constants.js';
import { Direction, type Rect } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';
import { drawBossSprite, DIGDOGGER_SPRITES } from '../../render/boss-sprite-data.js';
import { Enemy, EnemyState, type EnemyUpdateContext } from './enemy.js';

export const DIGDOGGER1 = 0x38;
export const DIGDOGGER2 = 0x39;
export const LITTLE_DIGDOGGER = 0x18;

const BODY_SIZE = 32;

const RETARGET_INTERVAL = 0x10;

const FLICKER_FRAMES = 0x40; // 64 frames of flicker before splitting

const SPEED_LO = 0x40;
const SPEED_HI = 0x80;
const SPEED_STEP = 2;

const CHILD_SPEED_LO = 0x0140;
const CHILD_SPEED_HI = 0x0180;
const CHILD_SPEED_STEP = 4;

const DIR_MASKS_8: number[] = [
  1, 2, 4, 8, // R, L, D, U
  1 | 4, 1 | 8, 2 | 4, 2 | 8, // DR, UR, DL, UL
];

function randomDir8(): number {
  return DIR_MASKS_8[Math.floor(Math.random() * 8)]!;
}

export class Digdogger extends Enemy {
  private _dirMask: number;
  private _speedFrac: number;
  private _speedAccum = 0;
  private _targetSpeed: number;
  private _accelerating = true;
  private _retargetTimer = RETARGET_INTERVAL;
  private _flickerTimer = 0;
  private _flickering = false;
  private _frame = 0;
  private readonly _childCount: number;

  constructor(x: number, y: number, objectType: number, hp: number, spawnCloudFrames: number) {
    super(x, y, objectType, hp, spawnCloudFrames);
    this._vulnerable = false;
    this._dirMask = randomDir8();
    this._speedFrac = SPEED_LO;
    this._targetSpeed = SPEED_HI;
    this._childCount = objectType === DIGDOGGER2 ? 1 : 3;
  }

  override stun(): void {}

  override getHitbox(): Rect {
    return { x: this._x, y: this._y, width: BODY_SIZE, height: BODY_SIZE };
  }

  get isFlickering(): boolean { return this._flickering; }
  get childCount(): number { return this._childCount; }

  protected override updateAI(ctx: EnemyUpdateContext): void {
    this._frame++;

    if (this._flickering) {
      this._flickerTimer--;
      if (this._flickerTimer <= 0) {
        this.splitIntoChildren();
        return;
      }
      return;
    }

    if (ctx.fluteActive && !this._flickering) {
      this._flickering = true;
      this._flickerTimer = FLICKER_FRAMES;
      return;
    }

    this.updateSpeed();
    this.updateDirection(ctx);
    this.move();
  }

  private updateSpeed(): void {
    if (this._accelerating) {
      this._speedFrac += SPEED_STEP;
      if (this._speedFrac >= this._targetSpeed) {
        this._speedFrac = this._targetSpeed;
        this._accelerating = false;
        this._targetSpeed = SPEED_LO;
      }
    } else {
      this._speedFrac -= SPEED_STEP;
      if (this._speedFrac <= this._targetSpeed) {
        this._speedFrac = this._targetSpeed;
        this._accelerating = true;
        this._targetSpeed = SPEED_HI;
      }
    }
  }

  private updateDirection(ctx: EnemyUpdateContext): void {
    this._retargetTimer--;
    if (this._retargetTimer > 0) return;
    this._retargetTimer = RETARGET_INTERVAL;

    if (Math.random() < 0.5) {
      const dir = this.directionTowardLink(ctx.linkX, ctx.linkY);
      this._dirMask = directionToDirMask(dir);
    } else {
      this._dirMask = randomDir8();
    }
  }

  private move(): void {
    this._speedAccum += this._speedFrac & 0xe0;
    let step = 0;
    if (this._speedAccum >= 256) {
      this._speedAccum -= 256;
      step = 1;
    }
    if (step === 0) return;

    let nx = this._x;
    let ny = this._y;
    if (this._dirMask & 1) nx += step;
    if (this._dirMask & 2) nx -= step;
    if (this._dirMask & 4) ny += step;
    if (this._dirMask & 8) ny -= step;

    if (nx < SCREEN_EDGE_LEFT || nx > SCREEN_EDGE_RIGHT - 16) {
      this._dirMask ^= 3;
      return;
    }
    if (ny < SCREEN_EDGE_TOP || ny > SCREEN_EDGE_BOTTOM - 16) {
      this._dirMask ^= 12;
      return;
    }
    this._x = nx;
    this._y = ny;
  }

  private splitIntoChildren(): void {
    for (let i = 0; i < this._childCount; i++) {
      const offsetX = (i - 1) * 12;
      this._childSpawns.push({
        x: this._x + 8 + offsetX,
        y: this._y + 8,
        objectType: LITTLE_DIGDOGGER,
      });
    }
    this._state = EnemyState.Dead;
  }

  protected override renderEnemy(renderer: Renderer): void {
    if (this._flickering && (this._frame & 0x04)) return;
    const frameIdx = (this._frame >> 2) % 5;
    const frame = DIGDOGGER_SPRITES.big[frameIdx] ?? DIGDOGGER_SPRITES.big[0];
    if (frame) drawBossSprite(renderer, frame, this._x, this._y);
  }
}

export class LittleDigdogger extends Enemy {
  private _dirMask: number;
  private _speedFrac: number;
  private _speedAccum = 0;
  private _targetSpeed: number;
  private _accelerating = true;
  private _retargetTimer = RETARGET_INTERVAL;

  constructor(x: number, y: number, objectType: number, hp: number, spawnCloudFrames: number) {
    super(x, y, objectType, hp, spawnCloudFrames);
    this._dirMask = randomDir8();
    this._speedFrac = CHILD_SPEED_LO & 0xff;
    this._targetSpeed = CHILD_SPEED_HI & 0xff;
  }

  override stun(): void {}

  override getHitbox(): Rect {
    return { x: this._x, y: this._y, width: 16, height: 16 };
  }

  protected override updateAI(ctx: EnemyUpdateContext): void {
    this.tickWalkAnimation(8);
    this.updateSpeed();
    this.updateDirection(ctx);
    this.move();
  }

  private updateSpeed(): void {
    if (this._accelerating) {
      this._speedFrac += CHILD_SPEED_STEP;
      if (this._speedFrac >= (CHILD_SPEED_HI & 0xff)) {
        this._speedFrac = CHILD_SPEED_HI & 0xff;
        this._accelerating = false;
        this._targetSpeed = CHILD_SPEED_LO & 0xff;
      }
    } else {
      this._speedFrac -= CHILD_SPEED_STEP;
      if (this._speedFrac <= this._targetSpeed) {
        this._speedFrac = this._targetSpeed;
        this._accelerating = true;
        this._targetSpeed = CHILD_SPEED_HI & 0xff;
      }
    }
  }

  private updateDirection(ctx: EnemyUpdateContext): void {
    this._retargetTimer--;
    if (this._retargetTimer > 0) return;
    this._retargetTimer = RETARGET_INTERVAL;

    if (Math.random() < 0.5) {
      const dir = this.directionTowardLink(ctx.linkX, ctx.linkY);
      this._dirMask = directionToDirMask(dir);
    } else {
      this._dirMask = randomDir8();
    }
  }

  private move(): void {
    this._speedAccum += this._speedFrac & 0xe0;
    let step = 1; // children have speedWhole=1
    if (this._speedAccum >= 256) {
      this._speedAccum -= 256;
      step += 1;
    }

    let nx = this._x;
    let ny = this._y;
    if (this._dirMask & 1) nx += step;
    if (this._dirMask & 2) nx -= step;
    if (this._dirMask & 4) ny += step;
    if (this._dirMask & 8) ny -= step;

    if (nx < SCREEN_EDGE_LEFT || nx > SCREEN_EDGE_RIGHT) {
      this._dirMask ^= 3;
      return;
    }
    if (ny < SCREEN_EDGE_TOP || ny > SCREEN_EDGE_BOTTOM) {
      this._dirMask ^= 12;
      return;
    }
    this._x = nx;
    this._y = ny;
  }

  protected override renderEnemy(renderer: Renderer): void {
    const frameIdx = this._walkAnimFrame & 1;
    const frame = DIGDOGGER_SPRITES.little[frameIdx] ?? DIGDOGGER_SPRITES.little[0];
    if (frame) drawBossSprite(renderer, frame, this._x, this._y);
  }
}

function directionToDirMask(dir: Direction): number {
  switch (dir) {
    case Direction.Right: return 1;
    case Direction.Left: return 2;
    case Direction.Down: return 4;
    case Direction.Up: return 8;
  }
}
