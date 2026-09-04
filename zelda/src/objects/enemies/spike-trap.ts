// Spike trap — Z_01.asm InitTrap_Full / UpdateTrap_Full
// Invulnerable sliding blocks that attack Link on axis alignment.
// Type $49 = 6 traps, type $4A = 4 traps.

import type { Rect } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';
import { drawDungeonEnemySprite, SPIKE_TRAP_SPRITES } from '../../render/enemy-sprite-data.js';

const TRAP_XS = [0x20, 0x20, 0xD0, 0xD0, 0x40, 0xB0];
const TRAP_YS = [0x5D, 0xBD, 0x5D, 0xBD, 0x8D, 0x8D];

// Bitmask of allowed directions per trap index
// NES dirs: right=1, left=2, down=4, up=8
const TRAP_ALLOWED_DIRS = [0x05, 0x09, 0x06, 0x0A, 0x01, 0x02];

const SENSING_THRESHOLD = 14;
const REVERSE_THRESHOLD = 5;
const ATTACK_SPEED = 1.75;   // QSpeed $70
const RETURN_SPEED = 0.5;    // QSpeed $20
const CENTER_X = 0x78;
const CENTER_Y = 0x90;
const HITBOX_SIZE = 16;
const TRAP_DAMAGE = 0x80;

enum TrapState {
  Sensing,
  Attacking,
  Returning,
}

export class SpikeTrap {
  private _x: number;
  private _y: number;
  private readonly _homeX: number;
  private readonly _homeY: number;
  private readonly _allowedDirs: number;
  private _state = TrapState.Sensing;
  private _dirX = 0;
  private _dirY = 0;
  private _subPixelX = 0;
  private _subPixelY = 0;

  constructor(index: number) {
    this._x = TRAP_XS[index]!;
    this._y = TRAP_YS[index]!;
    this._homeX = this._x;
    this._homeY = this._y;
    this._allowedDirs = TRAP_ALLOWED_DIRS[index]!;
  }

  get x(): number { return this._x; }
  get y(): number { return this._y; }

  getHitbox(): Rect {
    return { x: this._x, y: this._y, width: HITBOX_SIZE, height: HITBOX_SIZE };
  }

  get damage(): number { return TRAP_DAMAGE; }

  update(linkX: number, linkY: number): void {
    switch (this._state) {
      case TrapState.Sensing:
        this.updateSensing(linkX, linkY);
        break;
      case TrapState.Attacking:
        this.updateAttacking();
        break;
      case TrapState.Returning:
        this.updateReturning();
        break;
    }
  }

  private updateSensing(linkX: number, linkY: number): void {
    const dy = Math.abs(linkY - this._y);
    if (dy < SENSING_THRESHOLD) {
      // Aligned vertically — try horizontal attack
      let dirBit = 0;
      if (linkX > this._x) dirBit = 0x01; // right
      else if (linkX < this._x) dirBit = 0x02; // left
      else return;

      if (this._allowedDirs & dirBit) {
        this._dirX = linkX > this._x ? 1 : -1;
        this._dirY = 0;
        this._state = TrapState.Attacking;
        this._subPixelX = 0;
        this._subPixelY = 0;
        return;
      }
    }

    const dx = Math.abs(linkX - this._x);
    if (dx < SENSING_THRESHOLD) {
      // Aligned horizontally — try vertical attack
      let dirBit = 0;
      if (linkY > this._y) dirBit = 0x04; // down
      else if (linkY < this._y) dirBit = 0x08; // up
      else return;

      if (this._allowedDirs & dirBit) {
        this._dirX = 0;
        this._dirY = linkY > this._y ? 1 : -1;
        this._state = TrapState.Attacking;
        this._subPixelX = 0;
        this._subPixelY = 0;
      }
    }
  }

  private updateAttacking(): void {
    this.moveAtSpeed(ATTACK_SPEED);

    // Check if near center target — reverse
    if (this._dirX !== 0) {
      if (Math.abs(this._x - CENTER_X) < REVERSE_THRESHOLD) {
        this._dirX = -this._dirX;
        this._state = TrapState.Returning;
        this._subPixelX = 0;
        this._subPixelY = 0;
      }
    } else {
      if (Math.abs(this._y - CENTER_Y) < REVERSE_THRESHOLD) {
        this._dirY = -this._dirY;
        this._state = TrapState.Returning;
        this._subPixelX = 0;
        this._subPixelY = 0;
      }
    }
  }

  private updateReturning(): void {
    this.moveAtSpeed(RETURN_SPEED);

    // Check if back at home position
    if (this._dirX !== 0) {
      const pastHome = this._dirX > 0
        ? this._x >= this._homeX
        : this._x <= this._homeX;
      if (pastHome) {
        this._x = this._homeX;
        this._state = TrapState.Sensing;
      }
    } else {
      const pastHome = this._dirY > 0
        ? this._y >= this._homeY
        : this._y <= this._homeY;
      if (pastHome) {
        this._y = this._homeY;
        this._state = TrapState.Sensing;
      }
    }
  }

  private moveAtSpeed(speed: number): void {
    if (this._dirX !== 0) {
      this._subPixelX += speed;
      const pixels = Math.floor(this._subPixelX);
      this._subPixelX -= pixels;
      this._x += pixels * this._dirX;
    }
    if (this._dirY !== 0) {
      this._subPixelY += speed;
      const pixels = Math.floor(this._subPixelY);
      this._subPixelY -= pixels;
      this._y += pixels * this._dirY;
    }
  }

  render(renderer: Renderer): void {
    const frame = SPIKE_TRAP_SPRITES[0];
    if (frame) {
      drawDungeonEnemySprite(renderer, frame, this._x, this._y);
    }
  }

  static createTraps(objectType: number): SpikeTrap[] {
    const count = objectType === 0x49 ? 6 : 4;
    const traps: SpikeTrap[] = [];
    for (let i = 0; i < count; i++) {
      traps.push(new SpikeTrap(i));
    }
    return traps;
  }
}
