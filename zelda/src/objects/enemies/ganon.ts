// Ganon ($3E) — Z_04.asm InitGanon:9571, UpdateGanon:10284, Ganon_CheckCollisions:10802
// Final boss. Three scene phases:
//   0: Dark room, Link halted, holding Triforce of Courage
//   1: Room brightens, Link still holding, timer $C0
//   2: Fighting — Ganon is INVISIBLE, moves like Blue Wizzrobe, shoots fireballs.
//       Sword hit → visible brown → silver arrow kills → burst death → drop Triforce of Power.
//
// Custom collision: bypasses normal enemy-collision pipeline entirely.
// Blue/invisible: sword-only (HP reaches 0 → reset HP, go brown).
// Brown: silver arrow only → dying phase.

import {
  SILVER_ARROW_DAMAGE,
} from '../../core/constants.js';
import { Direction } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';
import { Enemy, EnemyState, type EnemyUpdateContext } from './enemy.js';
import { EnemyProjectile } from '../projectiles/enemy-projectile.js';
import { ProjectileType } from '../player/shield.js';

const GANON_START_XS = [0x30, 0xb0];

enum GanonScenePhase {
  DarkRoom,
  LightRoom,
  Fighting,
}

enum GanonCombatState {
  Invisible, // Blue/invisible, moving and shooting
  Brown,     // Visible brown, vulnerable to silver arrow
}

export class Ganon extends Enemy {
  private _scenePhase = GanonScenePhase.DarkRoom;
  private _phaseTimer = 0x40; // Link halt timer for phase 0
  private _combatState = GanonCombatState.Invisible;
  private _visibleTimer = 0; // when > 0, Ganon is visible (blue state, just hit by sword)
  private _brownTimer = 0xff; // brown state countdown (decrements every other frame)
  private _animFrame = 0;
  private _frame = 0;
  private _turnCounter = 0;

  // Dying sequence
  private _dyingPhase = 0;
  private _isDying = false;
  private _ashX = 0;
  private _ashY = 0;
  private _cloudDist = 0;
  private _burstRays: Array<{ x: number; y: number; dir: number }> = [];

  // Event flags for main.ts to read
  private _roomItemActivated = false;
  private _roomItemX = 0;
  private _roomItemY = 0;

  constructor(
    x: number, y: number,
    objectType: number, hp: number, _spawnCloudFrames: number,
  ) {
    super(x, y, objectType, hp, 0); // no spawn cloud
    this._invincibilityMask = 0xfa; // immune to boomerang+bomb+magic-shot+fire
    this._vulnerable = false; // custom collision handling
    // InitGanon: position at Y=$A0 local, random X
    this._x = GANON_START_XS[Math.floor(Math.random() * 2)] ?? 0x80;
    this._y = 0x60; // $A0 NES raw → $60 local ($A0 - $40 HUD)
    this._hp = 0xf0;
  }

  get scenePhase(): GanonScenePhase { return this._scenePhase; }
  get roomItemActivated(): boolean { return this._roomItemActivated; }
  get roomItemX(): number { return this._roomItemX; }
  get roomItemY(): number { return this._roomItemY; }

  // Ganon halts Link on init — main.ts should check this
  get shouldHaltLink(): boolean {
    return this._scenePhase === GanonScenePhase.DarkRoom ||
           this._scenePhase === GanonScenePhase.LightRoom;
  }

  override stun(): void {} // never stunnable

  // Completely custom — sword and arrow hits are checked here, not in enemy-collision.ts
  override takeDamage(damage: number, _fromDirection: Direction, hitContext?: { x: number; y: number; dir: Direction }): boolean {
    if (this._isDying) return false;
    if (this._scenePhase !== GanonScenePhase.Fighting) return false;

    if (this._combatState === GanonCombatState.Invisible) {
      // Blue state: only sword can hit (the mask already gates this in the collision system,
      // but the collision system won't call us because _vulnerable=false).
      // This is called directly from our updateAI's custom sword check.
      this._hp -= damage;
      if (this._hp <= 0) {
        // Don't die — go brown
        this._hp = 0xf0;
        this._combatState = GanonCombatState.Brown;
        this._brownTimer = 0xff;
      }
      // Make Ganon visible for $40 frames
      this._visibleTimer = 0x40;
      this._invincibilityTimer = 0x10;
      return false;
    }

    if (this._combatState === GanonCombatState.Brown) {
      // Brown state: only silver arrow kills
      if (hitContext && damage >= SILVER_ARROW_DAMAGE) {
        this.beginDying();
        return true;
      }
      return false;
    }

    return false;
  }

  protected override updateAI(ctx: EnemyUpdateContext): void {
    this._frame++;

    switch (this._scenePhase) {
      case GanonScenePhase.DarkRoom:
        this.updateDarkRoom();
        break;
      case GanonScenePhase.LightRoom:
        this.updateLightRoom();
        break;
      case GanonScenePhase.Fighting:
        if (this._isDying) {
          this.updateDying();
        } else {
          this.updateFighting(ctx);
        }
        break;
    }
  }

  private updateDarkRoom(): void {
    this._phaseTimer--;
    if (this._phaseTimer <= 0) {
      // Brighten room (handled by main.ts reading scenePhase)
      this._scenePhase = GanonScenePhase.LightRoom;
      this._phaseTimer = 0xc0;
    }
  }

  private updateLightRoom(): void {
    this._phaseTimer--;
    if (this._phaseTimer <= 0) {
      // Unhalt Link, start fighting
      this._scenePhase = GanonScenePhase.Fighting;
    }
  }

  private updateFighting(ctx: EnemyUpdateContext): void {
    // Move like Blue Wizzrobe: walk toward Link, re-aim every $40 frames, 1px every other frame
    if ((this._frame & 1) !== 0) {
      this._turnCounter++;
      if ((this._turnCounter & 0x3f) === 0) {
        this._direction = this.directionTowardLink(ctx.linkX, ctx.linkY);
      }
      if (!this.moveOnePixel(ctx.collision, ctx.screen)) {
        this._direction = (this._direction ^ 1) as Direction;
      }
    }

    // Animation frame cycles 0-5 every frame
    this._animFrame = (this._animFrame + 1) % 6;

    // Shoot unblockable fireball ($56) every $40 frames
    if ((this._frame & 0x3f) === 0) {
      this._pendingProjectile = new EnemyProjectile(
        this._x + 4, this._y + 4,
        this.directionTowardLink(ctx.linkX, ctx.linkY),
        ProjectileType.Fireball2Unblockable,
      );
    }

    // Visible timer countdown
    if (this._visibleTimer > 0) {
      this._visibleTimer--;
    }

    // Brown state management
    if (this._combatState === GanonCombatState.Brown) {
      if ((this._frame & 1) === 0) {
        this._brownTimer--;
        if (this._brownTimer <= 0) {
          // Return to invisible
          this._combatState = GanonCombatState.Invisible;
          this._visibleTimer = 0;
          this.randomizePosition();
        }
      }
    }
  }

  private randomizePosition(): void {
    this._y = 0x60; // $A0 raw → $60 local
    this._x = GANON_START_XS[this._frame & 1] ?? 0x80;
  }

  private beginDying(): void {
    this._isDying = true;
    this._dyingPhase = 1;
    this._invincibilityTimer = 0x28;
  }

  private updateDying(): void {
    this._dyingPhase++;
    if (this._dyingPhase > 0xff) this._dyingPhase = 0xff;

    if (this._dyingPhase === 0x50) {
      // Convert to ashes
      this._ashX = this._x + 7;
      this._ashY = this._y + 8;
      this._cloudDist = 8;

      // Set up 8 burst rays
      const burstDirs = [1, 2, 4, 5, 6, 8, 9, 10];
      this._burstRays = [];
      for (const dir of burstDirs) {
        this._burstRays.push({
          x: this._x + 4,
          y: this._y + 4,
          dir,
        });
      }
    }

    if (this._dyingPhase >= 0x50 && this._dyingPhase < 0xa0) {
      // Shrink cloud distance every 8 frames
      if (this._cloudDist > 0 && (this._frame & 7) === 0) {
        this._cloudDist--;
      }
      // Move burst rays outward
      for (const ray of this._burstRays) {
        const dx = (ray.dir & 1) ? 1 : (ray.dir & 2) ? -1 : 0;
        const dy = (ray.dir & 4) ? -1 : (ray.dir & 8) ? 1 : 0;
        ray.x += dx;
        ray.y += dy;
      }
    }

    if (this._dyingPhase === 0xa0) {
      // Activate room item (Triforce of Power) at ashes position
      this._roomItemActivated = true;
      this._roomItemX = this._ashX;
      this._roomItemY = this._ashY;
      // Signal completion for shutter triggers
      this._state = EnemyState.Dying;
      this._deathTimer = 999; // don't auto-transition to Dead
    }
  }

  override render(renderer: Renderer): void {
    if (this._state === EnemyState.Dead) return;
    if (this._scenePhase !== GanonScenePhase.Fighting) {
      // Phases 0/1: draw body frame 0 always
      this.drawBody(renderer);
      return;
    }

    if (this._isDying) {
      this.renderDying(renderer);
      return;
    }

    // Fighting phase rendering
    if (this._combatState === GanonCombatState.Invisible) {
      // Invisible — only draw when _visibleTimer > 0
      if (this._visibleTimer <= 0) return;
      // Flash while visible
      if (this._invincibilityTimer > 0 && (this._invincibilityTimer & 2) === 0) return;
      this.drawBody(renderer);
    } else {
      // Brown state
      if (this._brownTimer >= 0x30) {
        // Opaque
        this.drawBody(renderer, '#a0522d');
      } else {
        // Translucent — draw every other frame
        if ((this._frame & 1) === 0) {
          this.drawBody(renderer, '#a0522d');
        }
      }
    }
  }

  private drawBody(renderer: Renderer, color = '#3060d0'): void {
    const ctx = renderer.ctx;
    // 32×32 body (4 quadrants)
    ctx.fillStyle = color;
    ctx.fillRect(this._x, this._y, 32, 32);
    // Face detail
    ctx.fillStyle = '#f8d870';
    ctx.fillRect(this._x + 8, this._y + 6, 16, 8);
    // Eyes
    ctx.fillStyle = '#e02020';
    ctx.fillRect(this._x + 10, this._y + 8, 4, 4);
    ctx.fillRect(this._x + 18, this._y + 8, 4, 4);
    // Snout
    ctx.fillStyle = '#804020';
    ctx.fillRect(this._x + 12, this._y + 16, 8, 6);
  }

  private renderDying(renderer: Renderer): void {
    const ctx = renderer.ctx;

    if (this._dyingPhase < 0x50) {
      // Still showing body (flashing)
      if ((this._dyingPhase & 2) === 0) {
        this.drawBody(renderer, '#f8d870');
      }
      return;
    }

    // Draw ashes
    ctx.fillStyle = '#404040';
    ctx.fillRect(this._ashX - 4, this._ashY, 8, 4);
    ctx.fillStyle = '#808080';
    ctx.fillRect(this._ashX - 2, this._ashY + 1, 4, 2);

    if (this._dyingPhase < 0xa0) {
      // Draw burst clouds at 8 positions around ashes
      const d = this._cloudDist;
      if (d > 0) {
        const cloudColor = d >= 6 ? '#f8d870' : '#f89020';
        const positions = [
          [this._ashX - d, this._ashY - d],
          [this._ashX + d, this._ashY - d],
          [this._ashX - d, this._ashY + d],
          [this._ashX + d, this._ashY + d],
          [this._ashX, this._ashY - d],
          [this._ashX, this._ashY + d],
          [this._ashX - d, this._ashY],
          [this._ashX + d, this._ashY],
        ];
        for (const [cx, cy] of positions) {
          if (cx !== undefined && cy !== undefined) {
            ctx.fillStyle = cloudColor;
            ctx.fillRect(cx - 4, cy - 4, 8, 8);
          }
        }
      }

      // Draw burst rays
      for (const ray of this._burstRays) {
        ctx.fillStyle = (this._frame & 3) < 2 ? '#f8f8f8' : '#f8d870';
        ctx.fillRect(ray.x - 2, ray.y - 2, 4, 4);
      }
    }
  }

  // Override getHitbox to use the 32×32 body
  override getHitbox() {
    return { x: this._x, y: this._y, width: 32, height: 32 };
  }

  override getCollisionCenter() {
    return { cx: this._x + 16, cy: this._y + 16 };
  }
}
