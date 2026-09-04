// Zora — Z_04.asm:1915 UpdateZora
// Water burrower: surfaces at water tiles, shoots fireball (type $55)

import type { Renderer } from '../../render/renderer.js';
import { drawOverworldEnemySprite, ZORA_SPRITES } from '../../render/enemy-sprite-data.js';
import { Enemy, type EnemyUpdateContext } from './enemy.js';
import { EnemyProjectile } from '../projectiles/enemy-projectile.js';
import { ProjectileType } from '../player/shield.js';

enum ZoraState {
  Underground,
  Emerging,
  Surface,
  Submerging,
}

const UNDERGROUND_TIMER = 96;
const EMERGE_TIMER = 16;
const SURFACE_TIMER = 48;
const SUBMERGE_TIMER = 16;

export class Zora extends Enemy {
  private zoraState = ZoraState.Underground;
  private phaseTimer: number;
  private hasFired = false;

  constructor(
    x: number, y: number,
    objectType: number, hp: number, spawnCloudFrames: number,
  ) {
    super(x, y, objectType, hp, spawnCloudFrames);
    this.phaseTimer = UNDERGROUND_TIMER + Math.floor(Math.random() * 48);
    this._vulnerable = false;
  }

  protected override updateAI(ctx: EnemyUpdateContext): void {
    this.phaseTimer--;

    switch (this.zoraState) {
      case ZoraState.Underground:
        this._vulnerable = false;
        if (this.phaseTimer <= 0) {
          // Reposition to a random spot (Zora surfaces at different locations)
          this._x = 32 + Math.floor(Math.random() * 192);
          this._y = 32 + Math.floor(Math.random() * 112);
          this.zoraState = ZoraState.Emerging;
          this.phaseTimer = EMERGE_TIMER;
          this.hasFired = false;
        }
        break;

      case ZoraState.Emerging:
        this._vulnerable = false;
        if (this.phaseTimer <= 0) {
          this.zoraState = ZoraState.Surface;
          this.phaseTimer = SURFACE_TIMER;
          this._vulnerable = true;
          this._direction = this.directionTowardLink(ctx.linkX, ctx.linkY);
        }
        break;

      case ZoraState.Surface:
        this._vulnerable = true;
        // Shoot fireball midway through surface time
        if (!this.hasFired && this.phaseTimer <= SURFACE_TIMER / 2) {
          this.hasFired = true;
          this._pendingProjectile = new EnemyProjectile(
            this._x + 4, this._y + 4,
            this._direction, ProjectileType.Fireball,
          );
        }
        if (this.phaseTimer <= 0) {
          this.zoraState = ZoraState.Submerging;
          this.phaseTimer = SUBMERGE_TIMER;
        }
        break;

      case ZoraState.Submerging:
        this._vulnerable = false;
        if (this.phaseTimer <= 0) {
          this.zoraState = ZoraState.Underground;
          this.phaseTimer = UNDERGROUND_TIMER + Math.floor(Math.random() * 48);
        }
        break;
    }
  }

  protected override renderEnemy(renderer: Renderer): void {
    if (this.zoraState === ZoraState.Underground) return;

    if (this.zoraState === ZoraState.Emerging || this.zoraState === ZoraState.Submerging) {
      const frame = ZORA_SPRITES[1] ?? ZORA_SPRITES[0];
      if (frame) drawOverworldEnemySprite(renderer, frame, this._x, this._y);
      return;
    }

    const frame = ZORA_SPRITES[0];
    if (frame) drawOverworldEnemySprite(renderer, frame, this._x, this._y);
  }
}
