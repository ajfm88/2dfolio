// Leever — Z_04.asm:2601 UpdateBlueLeever / Z_04.asm:2744 UpdateRedLeever
// Burrower cycle: underground → emerging → surface → submerging → repeat
// Blue (type 15): walks during surface with turnRate $A0
// Red (type 16): spawns near Link, max 2 at a time

import type { Renderer } from '../../render/renderer.js';
import { Enemy, type EnemyUpdateContext, randomDirection } from './enemy.js';

enum BurrowerState {
  Underground,
  Emerging,
  Surface,
  Submerging,
}

const EMERGE_TIMER = 16;
const SURFACE_TIMER = 64;
const SUBMERGE_TIMER = 16;
const UNDERGROUND_TIMER = 48;

export class Leever extends Enemy {
  private readonly isBlue: boolean;
  private burrowerState = BurrowerState.Underground;
  private phaseTimer: number;
  private _subPixel = 0;
  private static activeRedCount = 0;

  constructor(
    x: number, y: number,
    objectType: number, hp: number, spawnCloudFrames: number,
  ) {
    super(x, y, objectType, hp, spawnCloudFrames);
    this.isBlue = objectType === 15;
    this.phaseTimer = UNDERGROUND_TIMER + Math.floor(Math.random() * 32);
    this._vulnerable = false; // invulnerable while underground
  }

  static resetRedCount(): void {
    Leever.activeRedCount = 0;
  }

  protected override updateAI(ctx: EnemyUpdateContext): void {
    this.phaseTimer--;

    switch (this.burrowerState) {
      case BurrowerState.Underground:
        this._vulnerable = false;
        if (this.phaseTimer <= 0) {
          // Red: max 2 at a time
          if (!this.isBlue && Leever.activeRedCount >= 2) {
            this.phaseTimer = 16;
            return;
          }
          this.burrowerState = BurrowerState.Emerging;
          this.phaseTimer = EMERGE_TIMER;
          if (!this.isBlue) {
            Leever.activeRedCount++;
            // Spawn near Link
            this._x = ctx.linkX + (Math.random() > 0.5 ? 32 : -32);
            this._y = ctx.linkY + (Math.random() > 0.5 ? 32 : -32);
          }
        }
        break;

      case BurrowerState.Emerging:
        this._vulnerable = false;
        if (this.phaseTimer <= 0) {
          this.burrowerState = BurrowerState.Surface;
          this.phaseTimer = SURFACE_TIMER;
          this._vulnerable = true;
          this._direction = this.directionTowardLink(ctx.linkX, ctx.linkY);
        }
        break;

      case BurrowerState.Surface:
        this._vulnerable = true;
        if (this.isBlue) {
          // Blue Leever walks on surface with QSpeed $20
          let moved = false;
          for (let i = 0; i < 4; i++) {
            this._subPixel += 0x20;
            if (this._subPixel >= 256) {
              this._subPixel -= 256;
              if (this.moveOnePixel(ctx.collision, ctx.screen)) {
                moved = true;
              }
            }
          }
          if (!moved && Math.random() < 0.1) {
            this._direction = randomDirection();
          }
        }
        this.tickWalkAnimation(8);
        if (this.phaseTimer <= 0) {
          this.burrowerState = BurrowerState.Submerging;
          this.phaseTimer = SUBMERGE_TIMER;
        }
        break;

      case BurrowerState.Submerging:
        this._vulnerable = false;
        if (this.phaseTimer <= 0) {
          this.burrowerState = BurrowerState.Underground;
          this.phaseTimer = UNDERGROUND_TIMER + Math.floor(Math.random() * 32);
          if (!this.isBlue) {
            Leever.activeRedCount = Math.max(0, Leever.activeRedCount - 1);
          }
        }
        break;
    }
  }

  protected override onDeath(): void {
    if (!this.isBlue) {
      Leever.activeRedCount = Math.max(0, Leever.activeRedCount - 1);
    }
  }

  protected override renderEnemy(renderer: Renderer): void {
    const ctx = renderer.ctx;

    if (this.burrowerState === BurrowerState.Underground) return;

    const color = this.isBlue ? '#0058f0' : '#d82800';

    if (this.burrowerState === BurrowerState.Emerging || this.burrowerState === BurrowerState.Submerging) {
      // Partial visibility
      const progress = this.burrowerState === BurrowerState.Emerging
        ? 1 - (this.phaseTimer / EMERGE_TIMER)
        : this.phaseTimer / SUBMERGE_TIMER;
      const height = Math.max(4, Math.floor(16 * progress));
      ctx.fillStyle = color;
      ctx.fillRect(this._x + 2, this._y + (16 - height), 12, height);
      return;
    }

    // Surface — full sprite placeholder
    ctx.fillStyle = color;
    ctx.fillRect(this._x, this._y, 16, 16);
    // Worm-like body marks
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(this._x + 3, this._y + 4, 10, 2);
    ctx.fillRect(this._x + 3, this._y + 8, 10, 2);
    ctx.fillRect(this._x + 3, this._y + 12, 10, 2);
  }
}
