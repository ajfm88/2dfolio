// Peahat — Z_04.asm:4022 UpdatePeahat / ControlPeahatFlight
// Flyer with 6 states: SpeedUp, Decide, Chase, Wander, SlowDown, Delay
// Only vulnerable in Delay state (state 5)
// Type 26 ($1A)

import { drawOverworldEnemySprite, PEAHAT_SPRITES } from '../../render/enemy-sprite-data.js';
import {
  SCREEN_EDGE_BOTTOM,
  SCREEN_EDGE_LEFT,
  SCREEN_EDGE_RIGHT,
  SCREEN_EDGE_TOP,
} from '../../core/constants.js';
import { Direction } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';
import { Enemy, type EnemyUpdateContext } from './enemy.js';

enum FlyingState {
  SpeedUp,
  Decide,
  Chase,
  Wander,
  SlowDown,
  Delay,
}

const MAX_SPEED = 1.5;
const SPEED_INCREMENT = 0.05;
const WANDER_TURNS = 6;
const DELAY_MIN = 40;
const DELAY_RANGE = 60;

export class Peahat extends Enemy {
  private flyingState = FlyingState.Delay;
  private speed = 0;
  private velX = 0;
  private velY = 0;
  private turnsRemaining = 0;
  private stateTimer: number;
  private distanceTraveled = 0;

  constructor(
    x: number, y: number,
    objectType: number, hp: number, spawnCloudFrames: number,
  ) {
    super(x, y, objectType, hp, spawnCloudFrames);
    this.stateTimer = DELAY_MIN + Math.floor(Math.random() * DELAY_RANGE);
    this._vulnerable = false;
  }

  protected override updateAI(ctx: EnemyUpdateContext): void {
    switch (this.flyingState) {
      case FlyingState.SpeedUp:
        this.speed = Math.min(MAX_SPEED, this.speed + SPEED_INCREMENT);
        if (this.speed >= MAX_SPEED) {
          this.flyingState = FlyingState.Decide;
        }
        this.moveFlyer();
        break;

      case FlyingState.Decide: {
        const r = Math.floor(Math.random() * 256);
        if (r >= 0xB0) {
          this.flyingState = FlyingState.Chase;
        } else if (r >= 0x20) {
          this.flyingState = FlyingState.Wander;
        } else {
          this.flyingState = FlyingState.SlowDown;
        }
        this.turnsRemaining = WANDER_TURNS;
        this.moveFlyer();
        break;
      }

      case FlyingState.Chase:
        this.chaseLink(ctx.linkX, ctx.linkY);
        this.moveFlyer();
        this.turnsRemaining--;
        if (this.turnsRemaining <= 0) {
          this.flyingState = FlyingState.Decide;
        }
        break;

      case FlyingState.Wander:
        if (this.turnsRemaining <= 0 || Math.random() < 0.02) {
          const angle = Math.random() * Math.PI * 2;
          this.velX = Math.cos(angle) * this.speed;
          this.velY = Math.sin(angle) * this.speed;
          this.turnsRemaining--;
        }
        this.moveFlyer();
        if (this.turnsRemaining <= 0) {
          this.flyingState = FlyingState.SlowDown;
        }
        break;

      case FlyingState.SlowDown:
        this.speed = Math.max(0, this.speed - SPEED_INCREMENT);
        this.moveFlyer();
        if (this.speed <= 0) {
          this.flyingState = FlyingState.Delay;
          this.stateTimer = DELAY_MIN + Math.floor(Math.random() * DELAY_RANGE);
          this._vulnerable = true;
        }
        break;

      case FlyingState.Delay:
        this._vulnerable = true;
        this.stateTimer--;
        if (this.stateTimer <= 0) {
          this._vulnerable = false;
          this.flyingState = FlyingState.SpeedUp;
          this.speed = 0;
          this.chaseLink(ctx.linkX, ctx.linkY);
        }
        break;
    }

    this._direction = this.velX > 0 ? Direction.Right : Direction.Left;
  }

  private chaseLink(linkX: number, linkY: number): void {
    const dx = linkX - this._x;
    const dy = linkY - this._y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      this.velX = (dx / dist) * this.speed;
      this.velY = (dy / dist) * this.speed;
    }
  }

  private moveFlyer(): void {
    let nx = this._x + this.velX;
    let ny = this._y + this.velY;

    // Bounce off screen edges
    if (nx < SCREEN_EDGE_LEFT || nx > SCREEN_EDGE_RIGHT) {
      this.velX = -this.velX;
      nx = this._x + this.velX;
    }
    if (ny < SCREEN_EDGE_TOP || ny > SCREEN_EDGE_BOTTOM) {
      this.velY = -this.velY;
      ny = this._y + this.velY;
    }

    this._x = Math.max(SCREEN_EDGE_LEFT, Math.min(SCREEN_EDGE_RIGHT, nx));
    this._y = Math.max(SCREEN_EDGE_TOP, Math.min(SCREEN_EDGE_BOTTOM, ny));
    this.distanceTraveled++;
  }

  protected override renderEnemy(renderer: Renderer): void {
    const frameIndex = (this.distanceTraveled & 1);
    const frame = PEAHAT_SPRITES[frameIndex] ?? PEAHAT_SPRITES[0];
    if (frame) drawOverworldEnemySprite(renderer, frame, this._x, this._y);
  }
}
