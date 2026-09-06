// Boomerang — Z_05.asm:2901 WieldBoomerang, Z_07.asm:3857 UpdateArrowOrBoomerang
// 5-state machine: FlyAway → SparkTurn → SlowDown → ReturnSlow → ReturnFast → Dead

import {
  BOOMERANG_QFRAC,
  BOOMERANG_SLOW_QFRAC,
  BOOMERANG_NORMAL_LIMIT,
  BOOMERANG_MAGIC_LIMIT,
  BOOMERANG_SPARK_FRAMES,
  BOOMERANG_SLOWDOWN_FRAMES,
  BOOMERANG_RETURN_SLOW_FRAMES,
  BOOMERANG_CATCH_THRESHOLD,
  BOOMERANG_ANIM_COUNTER_RESET,
  PLAY_AREA_HEIGHT,
  SCREEN_WIDTH,
} from '../../core/constants.js';
import type { Rect } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';
import {
  drawProjectileSpriteFlipped,
  PROJ_COL_BOOMERANG,
} from '../../render/projectile-sprite-data.js';

export enum BoomerangState {
  FlyAway    = 0x10,
  SparkTurn  = 0x20,
  SlowDown   = 0x30,
  ReturnSlow = 0x40,
  ReturnFast = 0x50,
  Dead       = 0x00,
}

// Z_07.asm:3823 BoomerangFrameCycle / BaseSpriteAttrCycle
const FRAME_CYCLE = [0, 1, 2, 1, 0, 1, 2, 1, 3] as const;
const ATTR_CYCLE = [0, 0, 0, 0x40, 0x40, 0xC0, 0x80, 0x80, 1] as const;

// Z_07.asm:3831 diagonal speed tables for homing return
const QSPEED_FRACS_X = [0x80, 0x78, 0x70, 0x68, 0x60, 0x4C, 0x36, 0x20, 0x00] as const;
const QSPEED_FRACS_Y = [0x00, 0x20, 0x36, 0x4C, 0x60, 0x68, 0x70, 0x78, 0x80] as const;

// projectiles.png column 3 holds the boomerang, one cell per direction/rotation.
// FRAME_CYCLE indexes those four rows; ATTR_CYCLE adds the NES mirror/flip bits.

export class Boomerang {
  private _x: number;
  private _y: number;
  private readonly _dirX: number;
  private readonly _dirY: number;
  private readonly _isMagic: boolean;
  private readonly _limit: number;

  private _state = BoomerangState.FlyAway;
  private _timer = 0;
  private _distanceTraveled = 0;
  private _isCaught = false;

  // QSpeed sub-pixel accumulators
  private _subPixelX = 0;
  private _subPixelY = 0;

  // Animation
  private _cycleIndex = 0;
  private _animCounter = BOOMERANG_ANIM_COUNTER_RESET;

  constructor(x: number, y: number, dirX: number, dirY: number, isMagic: boolean) {
    this._x = x;
    this._y = y;
    this._dirX = dirX;
    this._dirY = dirY;
    this._isMagic = isMagic;
    this._limit = isMagic ? BOOMERANG_MAGIC_LIMIT : BOOMERANG_NORMAL_LIMIT;
  }

  get x(): number { return this._x; }
  get y(): number { return this._y; }
  get state(): BoomerangState { return this._state; }
  get isActive(): boolean { return this._state !== BoomerangState.Dead; }
  get isCaught(): boolean { return this._isCaught; }
  get isMagic(): boolean { return this._isMagic; }

  // Z_01.asm:5835 — hotspot at (x+4, y+8), 8x8
  getHitbox(): Rect {
    return { x: this._x + 4, y: this._y + 8, width: 8, height: 8 };
  }

  // G1 calls this on enemy hit — jump straight to ReturnFast
  forceReturn(): void {
    if (this._state === BoomerangState.Dead) return;
    this._state = BoomerangState.ReturnFast;
  }

  update(linkX: number, linkY: number): void {
    if (this._state === BoomerangState.Dead) return;

    this.updateAnimation();

    switch (this._state) {
      case BoomerangState.FlyAway:
        this.updateFlyAway();
        break;
      case BoomerangState.SparkTurn:
        this.updateSparkTurn();
        break;
      case BoomerangState.SlowDown:
        this.updateSlowDown();
        break;
      case BoomerangState.ReturnSlow:
        this.updateReturnSlow(linkX, linkY);
        break;
      case BoomerangState.ReturnFast:
        this.updateReturnFast(linkX, linkY);
        break;
    }

    // Boundary check — off-screen triggers return
    if (this._state === BoomerangState.FlyAway ||
        this._state === BoomerangState.SparkTurn ||
        this._state === BoomerangState.SlowDown) {
      if (this._x < 0 || this._x > SCREEN_WIDTH ||
          this._y < 0 || this._y > PLAY_AREA_HEIGHT) {
        this._state = BoomerangState.ReturnFast;
      }
    }
  }

  render(renderer: Renderer): void {
    if (this._state === BoomerangState.Dead) return;

    const frameIdx = FRAME_CYCLE[this._cycleIndex]!;
    const attr = ATTR_CYCLE[this._cycleIndex]!;
    const flipH = (attr & 0x40) !== 0;
    const flipV = (attr & 0x80) !== 0;

    drawProjectileSpriteFlipped(
      renderer, PROJ_COL_BOOMERANG, frameIdx, this._x, this._y, flipH, flipV,
    );
  }

  // --- State updates ---

  private updateFlyAway(): void {
    const pixels = this.computePixels(BOOMERANG_QFRAC);

    for (let i = 0; i < pixels; i++) {
      this._x += this._dirX;
      this._y += this._dirY;
      this._distanceTraveled++;
    }

    if (this._distanceTraveled >= this._limit) {
      this._state = BoomerangState.SparkTurn;
      this._timer = BOOMERANG_SPARK_FRAMES;
    }
  }

  private updateSparkTurn(): void {
    this._timer--;
    if (this._timer <= 0) {
      this._state = BoomerangState.SlowDown;
      this._timer = BOOMERANG_SLOWDOWN_FRAMES;
      this._subPixelX = 0;
      this._subPixelY = 0;
    }
  }

  private updateSlowDown(): void {
    const pixels = this.computePixels(BOOMERANG_SLOW_QFRAC);

    // Continue in original throw direction at reduced speed
    for (let i = 0; i < pixels; i++) {
      this._x += this._dirX;
      this._y += this._dirY;
    }

    this._timer--;
    if (this._timer <= 0) {
      this._state = BoomerangState.ReturnSlow;
      this._timer = BOOMERANG_RETURN_SLOW_FRAMES;
      this._subPixelX = 0;
      this._subPixelY = 0;
    }
  }

  private updateReturnSlow(linkX: number, linkY: number): void {
    this.moveToward(linkX, linkY, true);

    this._timer--;
    if (this._timer <= 0) {
      this._state = BoomerangState.ReturnFast;
      this._subPixelX = 0;
      this._subPixelY = 0;
    }
  }

  private updateReturnFast(linkX: number, linkY: number): void {
    this.moveToward(linkX, linkY, false);

    // Catch check — within threshold on both axes
    const dx = Math.abs(linkX - this._x);
    const dy = Math.abs(linkY - this._y);
    if (dx <= BOOMERANG_CATCH_THRESHOLD && dy <= BOOMERANG_CATCH_THRESHOLD) {
      this._isCaught = true;
      this._state = BoomerangState.Dead;
    }
  }

  // Z_07.asm:3831 — diagonal homing using speed fraction tables
  private moveToward(targetX: number, targetY: number, halfSpeed: boolean): void {
    const dx = Math.abs(targetX - this._x);
    const dy = Math.abs(targetY - this._y);
    const signX = targetX >= this._x ? 1 : -1;
    const signY = targetY >= this._y ? 1 : -1;

    const speedIdx = calcDiagonalSpeedIndex(dx, dy);

    let qfracX = QSPEED_FRACS_X[speedIdx]!;
    let qfracY = QSPEED_FRACS_Y[speedIdx]!;

    if (halfSpeed) {
      qfracX >>= 1;
      qfracY >>= 1;
    }

    // X axis movement via QSpeed
    const pixelsX = this.computePixelsAxis(qfracX, true);
    this._x += pixelsX * signX;

    // Y axis movement via QSpeed
    const pixelsY = this.computePixelsAxis(qfracY, false);
    this._y += pixelsY * signY;
  }

  private updateAnimation(): void {
    this._animCounter--;
    if (this._animCounter <= 0) {
      this._cycleIndex = (this._cycleIndex + 1) & 7;
      this._animCounter = BOOMERANG_ANIM_COUNTER_RESET;
    }
  }

  // QSpeed for outbound — single accumulator, both axes share
  private computePixels(qfrac: number): number {
    let pixels = 0;
    for (let i = 0; i < 4; i++) {
      this._subPixelX += qfrac;
      if (this._subPixelX >= 256) {
        this._subPixelX -= 256;
        pixels++;
      }
    }
    return pixels;
  }

  // QSpeed for one axis during homing return
  private computePixelsAxis(qfrac: number, isX: boolean): number {
    let pixels = 0;
    for (let i = 0; i < 4; i++) {
      if (isX) {
        this._subPixelX += qfrac;
        if (this._subPixelX >= 256) {
          this._subPixelX -= 256;
          pixels++;
        }
      } else {
        this._subPixelY += qfrac;
        if (this._subPixelY >= 256) {
          this._subPixelY -= 256;
          pixels++;
        }
      }
    }
    return pixels;
  }
}

// Z_01.asm:3721 _CalcDiagonalSpeedIndex
function calcDiagonalSpeedIndex(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return 4;
  if (dy === 0) return 0;
  if (dx === 0) return 8;

  // Ratio-based index: 0 = pure H, 4 = balanced, 8 = pure V
  const ratio = dy / (dx + dy);
  return Math.round(ratio * 8);
}
