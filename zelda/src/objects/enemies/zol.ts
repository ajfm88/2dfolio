// Zol — Z_04.asm:1239 UpdateZol
// Slow jelly that SPLITS INTO TWO GELS when hurt but not killed outright
// (Z_04.asm UpdateZolState2_Split / Zol_CheckCollisions). A lethal blow that
// exceeds its HP (e.g. a bomb) kills it normally with no split. Type $13.

import { Direction } from '../../core/types.js';
import { EnemyState } from './enemy.js';
import { JellyEnemy } from './jelly-enemy.js';

const ZOL_QSPEED = 0x18; // 0.375 px/frame — NES UpdateZolState0_Wander
const ZOL_LINK_BIAS = 0.35;
const CHILD_GEL_TYPE = 0x14;

export class Zol extends JellyEnemy {
  constructor(
    x: number, y: number,
    objectType: number, hp: number, spawnCloudFrames: number,
  ) {
    super(x, y, objectType, hp, spawnCloudFrames, ZOL_QSPEED, ZOL_LINK_BIAS);
  }

  override takeDamage(damage: number, fromDirection: Direction, _hitContext?: { x: number; y: number; dir: Direction }): boolean {
    if (this._invincibilityTimer > 0) return false;
    if (!this._vulnerable) return false;
    if (this._state === EnemyState.Spawning
      || this._state === EnemyState.Dying
      || this._state === EnemyState.Dead) {
      return false;
    }

    // Lethal blow (exceeds HP): normal death, no split.
    if (damage >= this._hp) {
      return super.takeDamage(damage, fromDirection);
    }

    // Hurt but not killed: split into two Gels and remove the Zol.
    this._childSpawns.push({ x: this._x - 4, y: this._y, objectType: CHILD_GEL_TYPE });
    this._childSpawns.push({ x: this._x + 4, y: this._y, objectType: CHILD_GEL_TYPE });
    this._state = EnemyState.Dead;
    // Return false so no death drop rolls — the Gels are the "reward".
    return false;
  }
}
