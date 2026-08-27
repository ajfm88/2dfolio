// Wizzrobe — Z_04.asm:7034 UpdateBlueWizzrobe / :7473 UpdateRedWizzrobe
//
// Blue Wizzrobe ($23): walks square-aligned toward Link, then TELEPORTS $20px
//   (translucent, through walls, non-collidable mid-hop); lobs a MagicShot ($58)
//   when Link shares its square row/column.
// Red Wizzrobe ($24): STATIONARY phaser. A state byte counts down; its top bits
//   select a phase (relocate → fade-in → solid → fade-out → hidden). Only
//   collidable/vulnerable while SOLID; shoots MagicShot ($59) at the solid midpoint.
//
// Both shots ride the existing EnemyProjectile pipeline (magic-shield-only blockable).

import {
  SCREEN_EDGE_BOTTOM,
  SCREEN_EDGE_LEFT,
  SCREEN_EDGE_RIGHT,
  SCREEN_EDGE_TOP,
} from '../../core/constants.js';
import { Direction } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';
import type { SpriteSheet } from '../../render/sprite-renderer.js';
import { Enemy, type EnemyUpdateContext } from './enemy.js';
import { EnemyProjectile } from '../projectiles/enemy-projectile.js';
import { ProjectileType } from '../player/shield.js';

export const BLUE_WIZZROBE = 0x23;
export const RED_WIZZROBE = 0x24;

// Align a coordinate to the 16px square grid (NES ObjX + 8 & $F0 style).
function alignSquare(v: number): number {
  return (Math.floor((v + 8) / 16) * 16) & 0xff;
}

// --- Blue Wizzrobe: walk / teleport ---------------------------------------

const BLUE_WALK_MIN = 0x70; // random walk timer >= $70
const BLUE_TELEPORT_DIST = 0x20; // pixels moved while teleporting
const BLUE_SHOOT_PERIOD = 0x20; // try to shoot once every $20 frames

export class BlueWizzrobe extends Enemy {
  private _walkTimer = BLUE_WALK_MIN + (Math.floor(Math.random() * 0x80));
  private _teleportRemaining = 0;
  private _teleportDX = 0;
  private _teleportDY = 0;
  private _turnCounter = 0;
  private _frame = 0;

  protected override updateAI(ctx: EnemyUpdateContext): void {
    this._frame++;

    if (this._teleportRemaining > 0) {
      this.stepTeleport();
    } else if (this._walkTimer > 0) {
      this._walkTimer--;
      // Pause during the last $10 frames, then begin teleporting.
      if (this._walkTimer >= 0x10) {
        this.walkStep(ctx);
      } else if (this._walkTimer === 0) {
        this.beginTeleport(ctx);
      }
      this.tryShoot(ctx);
    }

    this.tickWalkAnimation(8);
  }

  private walkStep(ctx: EnemyUpdateContext): void {
    // Every other frame: advance a turn counter and re-face toward Link on a
    // $40 cadence, then move 1px in the facing direction.
    if ((this._frame & 1) === 0) return;

    this._turnCounter++;
    if ((this._turnCounter & 0x3f) === 0) {
      this._direction = this.directionTowardLink(ctx.linkX, ctx.linkY);
    }

    if (!this.moveOnePixel(ctx.collision, ctx.screen)) {
      // Hit a wall — flip to the opposite direction and try to keep going.
      this._direction = (this._direction ^ 1) as Direction;
    }
  }

  private beginTeleport(ctx: EnemyUpdateContext): void {
    // Choose a random diagonal to hop toward; align to the grid first.
    this._x = alignSquare(this._x);
    this._y = alignSquare(this._y);
    this._teleportDX = Math.random() < 0.5 ? -1 : 1;
    this._teleportDY = Math.random() < 0.5 ? -1 : 1;
    // Bias toward Link so hops close distance.
    if (ctx.linkX < this._x) this._teleportDX = -1;
    else if (ctx.linkX > this._x) this._teleportDX = 1;
    if (ctx.linkY < this._y) this._teleportDY = -1;
    else if (ctx.linkY > this._y) this._teleportDY = 1;
    this._teleportRemaining = BLUE_TELEPORT_DIST;
    this._vulnerable = false; // non-collidable while teleporting
  }

  private stepTeleport(): void {
    // Move diagonally through walls, clamped to the play area.
    const nx = this._x + this._teleportDX;
    const ny = this._y + this._teleportDY;
    if (nx >= SCREEN_EDGE_LEFT && nx <= SCREEN_EDGE_RIGHT) this._x = nx;
    else this._teleportDX = -this._teleportDX;
    if (ny >= SCREEN_EDGE_TOP && ny <= SCREEN_EDGE_BOTTOM) this._y = ny;
    else this._teleportDY = -this._teleportDY;

    this._teleportRemaining--;
    if (this._teleportRemaining <= 0) {
      this._x = alignSquare(this._x);
      this._y = alignSquare(this._y);
      this._vulnerable = true;
      this._walkTimer = BLUE_WALK_MIN + Math.floor(Math.random() * 0x80);
    }
  }

  private tryShoot(ctx: EnemyUpdateContext): void {
    if (this._teleportRemaining > 0) return;
    if (this._frame % BLUE_SHOOT_PERIOD !== 0) return;

    const sameRow = Math.abs((ctx.linkY & ~0x0f) - (this._y & ~0x0f)) < 8;
    const sameCol = Math.abs((ctx.linkX & ~0x0f) - (this._x & ~0x0f)) < 8;
    if (!sameRow && !sameCol) return;

    let dir: Direction;
    if (sameRow) dir = ctx.linkX >= this._x ? Direction.Right : Direction.Left;
    else dir = ctx.linkY >= this._y ? Direction.Down : Direction.Up;
    this._direction = dir;
    this._pendingProjectile = new EnemyProjectile(
      this._x + 4, this._y + 4, dir, ProjectileType.MagicShot,
    );
  }

  protected override renderEnemy(renderer: Renderer, _sheet?: SpriteSheet): void {
    const ctx = renderer.ctx;
    // Translucent while teleporting (drawn every other frame on NES).
    if (this._teleportRemaining > 0) {
      if ((this._teleportRemaining & 1) === 1) return;
      ctx.save();
      ctx.globalAlpha = 0.5;
      drawWizzrobeBody(ctx, this._x, this._y, '#3858f0');
      ctx.restore();
      return;
    }
    drawWizzrobeBody(ctx, this._x, this._y, '#3858f0');
  }
}

// --- Red Wizzrobe: stationary phaser ---------------------------------------

const RED_SHOOT_STATE = 0xb0; // shoot when the state byte reaches $B0 (solid group)

export class RedWizzrobe extends Enemy {
  private _stateByte = 0xff; // counts down each frame, wrapping $00 -> $FF
  private _animCounter = 0;
  private _didRelocate = false;

  constructor(x: number, y: number, objectType: number, hp: number, spawnCloudFrames: number) {
    super(x, y, objectType, hp, spawnCloudFrames);
    this._vulnerable = false; // starts hidden/fading
  }

  private get phase(): number {
    return this._stateByte >> 6; // 3=appear,2=solid,1=fade,0=hidden
  }

  private get isSolid(): boolean {
    return this.phase === 2;
  }

  override getHitbox() {
    // Not collidable while fully hidden (phase 0) — no contact, no weapon hit.
    if (this.phase === 0) return { x: -100, y: -100, width: 0, height: 0 };
    return { x: this._x, y: this._y, width: 16, height: 16 };
  }

  protected override updateAI(ctx: EnemyUpdateContext): void {
    this._animCounter++;
    this._stateByte = (this._stateByte - 1) & 0xff;

    const phase = this.phase;
    if (phase === 3) {
      // Relocate exactly once, at the top of the cycle ($FF).
      if (this._stateByte === 0xff && !this._didRelocate) {
        this.relocate(ctx);
        this._didRelocate = true;
      }
    } else {
      this._didRelocate = false;
    }

    if (phase === 2 && this._stateByte === RED_SHOOT_STATE) {
      this.shoot(ctx);
    }

    // Vulnerable only while solid.
    this._vulnerable = this.isSolid;
  }

  private relocate(ctx: EnemyUpdateContext): void {
    // Pick a square-aligned spot a short distance from Link that is walkable.
    const dists = [0x20, 0x30, 0x40, 0x50];
    for (let tries = 0; tries < 6; tries++) {
      const dir = Math.floor(Math.random() * 4);
      const d = dists[Math.floor(Math.random() * dists.length)]!;
      let nx = ctx.linkX;
      let ny = ctx.linkY;
      if (dir === 0) ny -= d;
      else if (dir === 1) ny += d;
      else if (dir === 2) nx -= d;
      else nx += d;
      nx = alignSquare(nx);
      ny = alignSquare(ny);
      if (nx < SCREEN_EDGE_LEFT || nx > SCREEN_EDGE_RIGHT) continue;
      if (ny < SCREEN_EDGE_TOP || ny > SCREEN_EDGE_BOTTOM) continue;
      if (!ctx.collision.isRectWalkable(ctx.screen, nx, ny, 16, 16)) continue;
      this._x = nx;
      this._y = ny;
      this._direction = this.directionTowardLink(ctx.linkX, ctx.linkY);
      return;
    }
    // Fallback: just face Link where we already are.
    this._direction = this.directionTowardLink(ctx.linkX, ctx.linkY);
  }

  private shoot(ctx: EnemyUpdateContext): void {
    const dir = this.directionTowardLink(ctx.linkX, ctx.linkY);
    this._direction = dir;
    this._pendingProjectile = new EnemyProjectile(
      this._x + 4, this._y + 4, dir, ProjectileType.MagicShot2,
    );
  }

  protected override renderEnemy(renderer: Renderer, _sheet?: SpriteSheet): void {
    const phase = this.phase;
    if (phase === 0) return; // hidden
    const ctx = renderer.ctx;
    if (phase === 2) {
      drawWizzrobeBody(ctx, this._x, this._y, '#d82800');
      return;
    }
    // Appearing / fading: translucent, every other frame.
    if ((this._animCounter & 1) === 1) return;
    ctx.save();
    ctx.globalAlpha = 0.5;
    drawWizzrobeBody(ctx, this._x, this._y, '#d82800');
    ctx.restore();
  }
}

function drawWizzrobeBody(
  ctx: CanvasRenderingContext2D, x: number, y: number, color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(x + 2, y, 12, 16); // robed body
  ctx.fillStyle = '#f0c8a0';
  ctx.fillRect(x + 5, y + 3, 6, 4); // face
  ctx.fillStyle = color;
  ctx.fillRect(x, y + 2, 16, 3); // hat brim
}
