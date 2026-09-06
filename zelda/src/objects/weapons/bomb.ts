// Bomb — Z_07.asm:4792 UpdateBomb, Z_01.asm:6108 CheckMonsterBombOrFireCollision
// E3 stub upgraded to full behavior in F2: explosion hitbox, screen flash, cloud rendering.

import { TILE_SIZE, BOMB_BLAST_RADIUS } from '../../core/constants.js';
import type { Rect } from '../../core/types.js';
import type { SpriteSheet } from '../../render/sprite-renderer.js';
import type { Renderer } from '../../render/renderer.js';
import {
  drawProjectileSprite,
  hasProjectileSprites,
  PROJ_COL_BOMB,
  PROJ_ROW_NORTH,
} from '../../render/projectile-sprite-data.js';

// BombTimes from Z_07.asm:4783: $30, $18, $0C, $06
const BOMB_TIMES: readonly number[] = [0x30, 0x18, 0x0C, 0x06];

// Bomb cloud offsets from sprites.json (extracted from Z_07.asm DrawOtherBombClouds)
// Values >127 are signed: 243=-13, 249=-7
const CLOUD_OFFSETS_Y1 = [-13, 0, 14];
const CLOUD_OFFSETS_X1 = [-7, 14, 7];
const CLOUD_OFFSETS_Y2 = [-13, 0, 14];
const CLOUD_OFFSETS_X2 = [7, -13, -7];

export { BOMB_DAMAGE } from '../../core/constants.js';

export enum BombState {
  Idle = 0x11,
  Fuse = 0x12,
  Detonating = 0x13,
  Exploding = 0x14,
  Dead = 0x15,
}

// projectiles.png column 5, row 0 — the bomb's single frame
// (zelda-clone-master ProjectileSpriteFactory: bombColumn = 5, bombRow = 0,
// bombTotalFrames = 1).

export class Bomb {
  private _x: number;
  private _y: number;
  private _state = BombState.Idle;
  private _timer = BOMB_TIMES[0]!;

  constructor(x: number, y: number) {
    this._x = x;
    this._y = y;
  }

  get x(): number { return this._x; }
  get y(): number { return this._y; }
  get state(): BombState { return this._state; }
  get isActive(): boolean { return this._state !== BombState.Dead; }
  get isDetonating(): boolean { return this._state === BombState.Detonating; }

  // Z_01.asm:4086 UpdateBombFlashEffect — flash toggles during Detonating
  get shouldFlash(): boolean {
    return this._state === BombState.Detonating &&
      (this._timer === 0x0B || this._timer === 0x06);
  }

  update(): void {
    if (this._state === BombState.Dead) return;

    this._timer--;
    if (this._timer <= 0) {
      this.advanceState();
    }
  }

  private advanceState(): void {
    switch (this._state) {
      case BombState.Idle:
        this._state = BombState.Fuse;
        this._timer = BOMB_TIMES[1]!;
        break;
      case BombState.Fuse:
        this._state = BombState.Detonating;
        this._timer = BOMB_TIMES[2]!;
        break;
      case BombState.Detonating:
        this._state = BombState.Exploding;
        this._timer = BOMB_TIMES[3]!;
        break;
      case BombState.Exploding:
        this._state = BombState.Dead;
        this._timer = 0;
        break;
    }
  }

  // Original 16x16 hitbox for wall-breaking detection (E3 tile object system)
  getHitbox(): Rect {
    return { x: this._x, y: this._y, width: TILE_SIZE, height: TILE_SIZE };
  }

  // Z_01.asm:6108 — 48x48 blast radius centered on bomb, active only during Detonating
  getExplosionHitbox(): Rect | null {
    if (this._state !== BombState.Detonating) return null;
    const cx = this._x + 8;
    const cy = this._y + 8;
    return {
      x: cx - BOMB_BLAST_RADIUS,
      y: cy - BOMB_BLAST_RADIUS,
      width: BOMB_BLAST_RADIUS * 2,
      height: BOMB_BLAST_RADIUS * 2,
    };
  }

  render(ctx: CanvasRenderingContext2D, cloudSheet?: SpriteSheet, renderer?: Renderer): void {
    if (this._state === BombState.Dead) return;

    if (this._state === BombState.Detonating || this._state === BombState.Exploding) {
      this.renderExplosion(ctx, cloudSheet, renderer);
    } else {
      this.renderBombBody(ctx, renderer);
    }
  }

  private renderExplosion(ctx: CanvasRenderingContext2D, cloudSheet?: SpriteSheet, renderer?: Renderer): void {
    if (cloudSheet && renderer) {
      // Cloud frame: Detonating uses frame 0 (large), Exploding uses frame 1 (medium)
      const cloudFrame = this._state === BombState.Detonating ? 0 : 1;

      // Central cloud
      cloudSheet.drawFrame(renderer, cloudFrame, this._x, this._y);

      // 3 offset clouds — alternate between set 1 and set 2 each frame
      const useSet1 = (this._timer & 1) === 0;
      const ofsX = useSet1 ? CLOUD_OFFSETS_X1 : CLOUD_OFFSETS_X2;
      const ofsY = useSet1 ? CLOUD_OFFSETS_Y1 : CLOUD_OFFSETS_Y2;

      for (let i = 0; i < 3; i++) {
        cloudSheet.drawFrame(
          renderer,
          cloudFrame,
          this._x + ofsX[i]!,
          this._y + ofsY[i]!,
        );
      }
    } else {
      // Placeholder rendering (no sprite sheet available)
      ctx.fillStyle = '#ff8800';
      ctx.fillRect(this._x - 8, this._y - 8, TILE_SIZE + 16, TILE_SIZE + 16);
      ctx.fillStyle = '#ffff00';
      ctx.fillRect(this._x - 4, this._y - 4, TILE_SIZE + 8, TILE_SIZE + 8);
    }
  }

  private renderBombBody(ctx: CanvasRenderingContext2D, renderer?: Renderer): void {
    if (renderer && hasProjectileSprites()) {
      drawProjectileSprite(renderer, PROJ_COL_BOMB, PROJ_ROW_NORTH, this._x, this._y);

      // Fuse blink spark
      if (this._state === BombState.Fuse && (this._timer & 0x04)) {
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(this._x + 6, this._y, 4, 4);
      }
    } else {
      // Placeholder rendering
      ctx.fillStyle = '#333333';
      ctx.fillRect(this._x + 4, this._y + 4, 8, 8);
      if (this._state === BombState.Fuse && (this._timer & 0x04)) {
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(this._x + 6, this._y, 4, 4);
      }
    }
  }
}
