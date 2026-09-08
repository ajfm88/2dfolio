// Zora — Z_04.asm:1915 UpdateZora / 2606 UpdateBurrower
// Water burrower: surfaces on water tiles, shoots fireball (type $55)

import type { Renderer } from '../../render/renderer.js';
import {
  drawOverworldEnemySprite,
  ZORA_SPRITES,
} from '../../render/enemy-sprite-data.js';
import { pickRandomWaterPosition } from '../../world/collision.js';
import { Enemy, type EnemyUpdateContext } from './enemy.js';
import { EnemyProjectile } from '../projectiles/enemy-projectile.js';
import { ProjectileType } from '../player/shield.js';

export const ZORA = 0x11;

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
  // NES ObjDir holds front (2) vs back (3) while surfaced (Z_04.asm:2621).
  private facingBack = false;

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
          const water = pickRandomWaterPosition(ctx.collision, ctx.screen);
          if (!water) {
            this.phaseTimer = 16;
            break;
          }
          this._x = water.x;
          this._y = water.y;
          this.zoraState = ZoraState.Emerging;
          this.phaseTimer = EMERGE_TIMER;
          this.hasFired = false;
        }
        break;

      case ZoraState.Emerging:
        this._vulnerable = false;
        this.tickWalkAnimation(8);
        if (this.phaseTimer <= 0) {
          this.zoraState = ZoraState.Surface;
          this.phaseTimer = SURFACE_TIMER;
          this._vulnerable = true;
          this._direction = this.directionTowardLink(ctx.linkX, ctx.linkY);
          this.facingBack = this._y >= ctx.linkY;
        }
        break;

      case ZoraState.Surface:
        this._vulnerable = true;
        if (!this.hasFired && this.phaseTimer <= SURFACE_TIMER / 2) {
          this.hasFired = true;
          this._pendingProjectile = new EnemyProjectile(
            this._x + 4, this._y + 4,
            this._direction, ProjectileType.Fireball,
            0,
            'zora-shot',
          );
        }
        if (this.phaseTimer <= 0) {
          this.zoraState = ZoraState.Submerging;
          this.phaseTimer = SUBMERGE_TIMER;
        }
        break;

      case ZoraState.Submerging:
        this._vulnerable = false;
        this.tickWalkAnimation(8);
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
      const mound = this._walkAnimFrame === 0 ? ZORA_SPRITES.emerging : ZORA_SPRITES.submerging;
      drawOverworldEnemySprite(renderer, mound, this._x, this._y);
      return;
    }

    const body = this.facingBack ? ZORA_SPRITES.back : ZORA_SPRITES.front;
    drawOverworldEnemySprite(renderer, body, this._x, this._y);
  }
}
