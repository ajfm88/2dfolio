// Walker enemy base — Z_04.asm Wanderer_TargetPlayer + Z_07.asm Walker_Move
// Shared by Octorok, Moblin, Lynel, Ghini, Armos, Goriya, Stalfos

import { Direction } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';
import type { SpriteSheet } from '../../render/sprite-renderer.js';
import { Enemy, type EnemyUpdateContext, randomDirection } from './enemy.js';
import { EnemyProjectile } from '../projectiles/enemy-projectile.js';
import { ProjectileType } from '../player/shield.js';

const ENEMY_SHEET_COLUMNS = 30;

export class WalkerEnemy extends Enemy {
  protected readonly turnRate: number;
  protected readonly qSpeed: number;
  protected readonly projectileObjType: number; // 0 = no shooting
  protected readonly isBlue: boolean;
  protected readonly spriteRowOffset: number; // row in enemies.png
  private _subPixel = 0;
  private _turnTimer = 0;
  private _shootTimer = 0;
  private _gridOffset = 0;

  constructor(
    x: number, y: number,
    objectType: number, hp: number, spawnCloudFrames: number,
    turnRate: number, qSpeed: number,
    projectileObjType: number,
    isBlue: boolean,
    spriteRowOffset: number,
  ) {
    super(x, y, objectType, hp, spawnCloudFrames);
    this.turnRate = turnRate;
    this.qSpeed = qSpeed;
    this.projectileObjType = projectileObjType;
    this.isBlue = isBlue;
    this.spriteRowOffset = spriteRowOffset;
  }

  protected override updateAI(ctx: EnemyUpdateContext): void {
    // Z_04.asm Wanderer_TargetPlayer
    const speed = this._shootTimer > 0 ? 0 : this.qSpeed;

    // Move
    if (speed > 0) {
      this.moveQSpeed(speed, { get value() { return 0; }, set value(_v) {} }, ctx.collision, ctx.screen);
      // Proper sub-pixel tracking
      const moved = this.doQSpeedMove(ctx);
      if (!moved) {
        this._gridOffset = 0;
      }
    }

    // Turn logic — only at grid boundaries
    if (this._gridOffset === 0 && speed > 0) {
      this.wandererTurn(ctx.linkX, ctx.linkY);
    }

    // Shooting
    this.updateShooting(ctx);

    this.tickWalkAnimation(6);
  }

  private doQSpeedMove(ctx: EnemyUpdateContext): boolean {
    let moved = false;
    for (let i = 0; i < 4; i++) {
      this._subPixel += (this._shootTimer > 0 ? 0 : this.qSpeed);
      if (this._subPixel >= 256) {
        this._subPixel -= 256;
        if (this.moveOnePixel(ctx.collision, ctx.screen)) {
          this._gridOffset = (this._gridOffset + 1) & 0x0F;
          moved = true;
        } else {
          this._gridOffset = 0;
          this._turnTimer = 0;
          return moved;
        }
      }
    }
    return moved;
  }

  // Z_04.asm Wanderer_TargetPlayer — turn toward Link based on turnRate
  private wandererTurn(linkX: number, linkY: number): void {
    if (this._turnTimer > 0) {
      this._turnTimer--;
      return;
    }

    // Compare turnRate to random — higher turnRate = more likely to turn
    if (this.turnRate < Math.floor(Math.random() * 256)) {
      this._direction = this.directionTowardLink(linkX, linkY);
      this._turnTimer = Math.floor(Math.random() * 16) + 4;
      return;
    }

    // Random direction change
    this._direction = randomDirection();
    this._turnTimer = Math.floor(Math.random() * 32) + 16;
  }

  // Z_04.asm _TryShooting
  private updateShooting(ctx: EnemyUpdateContext): void {
    if (this.projectileObjType === 0) return;

    if (this._shootTimer > 0) {
      this._shootTimer--;
      if (this._shootTimer === 0x10) {
        this.fireProjectile(ctx);
      }
      return;
    }

    // Blue variants always enter shoot check; red gated by random
    if (!this.isBlue) {
      if (Math.floor(Math.random() * 256) >= 0xF8) {
        this._shootTimer = 0x30;
      }
    } else {
      if (Math.floor(Math.random() * 256) >= 0x80) {
        this._shootTimer = 0x30;
      }
    }
  }

  private fireProjectile(_ctx: EnemyUpdateContext): void {
    const projType = this.getProjectileType();
    this._pendingProjectile = new EnemyProjectile(
      this._x + 4, this._y + 4,
      this._direction, projType,
    );
  }

  protected getProjectileType(): ProjectileType {
    switch (this.projectileObjType) {
      case 0x53: return ProjectileType.Rock;
      case 0x5B: return ProjectileType.Arrow;
      case 0x57: return ProjectileType.SwordShot;
      default: return ProjectileType.Rock;
    }
  }

  protected override renderEnemy(renderer: Renderer, enemySheet?: SpriteSheet): void {
    if (enemySheet && this.spriteRowOffset >= 0) {
      // ZeldaJS sprite sheet: col 0-3 = red (Down/Left/Up/Right), col 4-7 = blue
      const colOffset = this.isBlue ? 4 : 0;
      const col = colOffset + dirToSpriteCol(this._direction);
      const row = this._walkAnimFrame + this.spriteRowOffset;
      const frameIndex = row * ENEMY_SHEET_COLUMNS + col;
      enemySheet.drawFrame(renderer, frameIndex, this._x, this._y);
    } else {
      super.renderEnemy(renderer);
    }
  }
}

function dirToSpriteCol(dir: Direction): number {
  switch (dir) {
    case Direction.Down: return 0;
    case Direction.Left: return 1;
    case Direction.Up: return 2;
    case Direction.Right: return 3;
  }
}
