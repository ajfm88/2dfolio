// Keese — Z_04.asm:1184 UpdateKeese
// Erratic bat flyer using the shared flight state machine. Beats wings at half the
// movement rate. Dies in one hit (HP 0). Types $1B (blue), $1C (red), $1D (black).

import type { Renderer } from '../../render/renderer.js';
import { drawDungeonEnemySprite, KEESE_SPRITES } from '../../render/enemy-sprite-data.js';
import { FlyerEnemy } from './flyer-enemy.js';

const KEESE_MAX_SPEED = 1.75;
const KEESE_ACCEL = 0.12;
const KEESE_DELAY_MIN = 12;
const KEESE_DELAY_RANGE = 24;

function getKeeseFrames(objectType: number) {
  switch (objectType) {
    case 0x1c: return KEESE_SPRITES.red;
    case 0x1d: return KEESE_SPRITES.dark;
    default: return KEESE_SPRITES.blue;
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
    const frames = getKeeseFrames(this._objectType);
    const frameIndex = (this._distanceTraveled & 2) === 0 ? 0 : 1;
    const frame = frames[frameIndex];
    if (frame) {
      drawDungeonEnemySprite(renderer, frame, this._x, this._y);
    }
  }
}
