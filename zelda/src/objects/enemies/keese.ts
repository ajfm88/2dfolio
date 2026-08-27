// Keese — Z_04.asm:1184 UpdateKeese
// Erratic bat flyer using the shared flight state machine. Beats wings at half the
// movement rate. Dies in one hit (HP 0). Types $1B (blue), $1C (red), $1D (black).

import type { Renderer } from '../../render/renderer.js';
import { FlyerEnemy } from './flyer-enemy.js';

const KEESE_MAX_SPEED = 1.75;
const KEESE_ACCEL = 0.12;   // reaches speed quickly — snappier than a Peahat
const KEESE_DELAY_MIN = 12; // short hovers between darts
const KEESE_DELAY_RANGE = 24;

function keeseColor(objectType: number): string {
  switch (objectType) {
    case 0x1c: return '#d82800'; // red
    case 0x1d: return '#484848'; // black
    default: return '#5878f0';   // blue ($1b)
  }
}

export class Keese extends FlyerEnemy {
  constructor(
    x: number, y: number,
    objectType: number, hp: number, spawnCloudFrames: number,
  ) {
    super(
      x, y, objectType, hp, spawnCloudFrames,
      KEESE_MAX_SPEED, KEESE_ACCEL, KEESE_DELAY_MIN, KEESE_DELAY_RANGE,
    );
  }

  protected override renderEnemy(renderer: Renderer): void {
    const ctx = renderer.ctx;
    ctx.fillStyle = keeseColor(this._objectType);
    // Body
    ctx.fillRect(this._x + 6, this._y + 6, 4, 4);
    // Wings — beat at half the movement rate (bit 1 of distance).
    const up = (this._distanceTraveled & 2) === 0;
    if (up) {
      ctx.fillRect(this._x + 1, this._y + 3, 5, 3);
      ctx.fillRect(this._x + 10, this._y + 3, 5, 3);
    } else {
      ctx.fillRect(this._x + 1, this._y + 7, 5, 3);
      ctx.fillRect(this._x + 10, this._y + 7, 5, 3);
    }
  }
}
