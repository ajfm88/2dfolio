// Vire — Z_04.asm:6915 UpdateVire
// Two-legged demon that chases Link, then SPLITS INTO TWO RED KEESE ($1C) when
// killed (Z_04.asm @SplitUp — like Zol, destroys itself and creates two). Type
// $12, 4 hits. Reuses Enemy.collectChildSpawns() (drained by SpawnManager).

import type { Renderer } from '../../render/renderer.js';
import type { SpriteSheet } from '../../render/sprite-renderer.js';
import { drawDungeonEnemySprite, VIRE_SPRITES } from '../../render/enemy-sprite-data.js';
import { WalkerEnemy } from './walker-enemy.js';

const CHILD_KEESE_TYPE = 0x1c; // Red Keese

export class Vire extends WalkerEnemy {
  constructor(
    x: number, y: number,
    objectType: number, hp: number, spawnCloudFrames: number,
  ) {
    super(x, y, objectType, hp, spawnCloudFrames, 0xA0, 0x20, 0, false, -1);
  }

  protected override onDeath(): void {
    this._childSpawns.push({ x: this._x - 4, y: this._y, objectType: CHILD_KEESE_TYPE });
    this._childSpawns.push({ x: this._x + 4, y: this._y, objectType: CHILD_KEESE_TYPE });
  }

  protected override renderEnemy(renderer: Renderer, _sheet?: SpriteSheet): void {
    const frame = VIRE_SPRITES[this._walkAnimFrame] ?? VIRE_SPRITES[0];
    if (frame) {
      drawDungeonEnemySprite(renderer, frame, this._x, this._y);
    }
  }
}
