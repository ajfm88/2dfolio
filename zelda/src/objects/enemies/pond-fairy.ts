// Pond Fairy $2F: Z_04.asm:1901 InitPondFairy, :3374 UpdatePondFairy,
// :3468 PondFairy_MoveHearts. Not the wandering dropped Fairy object.
import type { Renderer } from '../../render/renderer.js';
import { drawNpcSprite, POND_FAIRY_SPRITES, POND_HEART_SPRITE } from '../../render/boss-sprite-data.js';
import { Enemy, EnemyState, type EnemyUpdateContext } from './enemy.js';
import { decreaseObjectAngle, rotateObjectLocation, type OrbitState } from './orbit-math.js';

export const POND_FAIRY = 0x2f;
const HEART_START_ANGLES = [0x14, 0x10, 0x0c, 0x08, 0x04, 0x00, 0x1c] as const;

/** Half-heart quantization of +6 HeartPartial/frame (Z_05.asm:6763 World_FillHearts). */
export function advanceFairyRefill(fraction: number): { fraction: number; halfHearts: number } {
  const total = fraction + 6;
  return { fraction: total % 128, halfHearts: Math.floor(total / 128) };
}

export class PondFairy extends Enemy {
  private _phase = 0;
  private _tailTimer = 0;
  private _animCounter = 0;
  private readonly _hearts: OrbitState[] = [];

  constructor() {
    // Compare against Link, so use NES Y - $3D (DECISIONS #22), not monster -$40.
    super(0x78, 0x7d - 0x3d, POND_FAIRY, 0, 0);
    this._state = EnemyState.Active;
    this._vulnerable = false;
    this._touchesLink = false;
  }

  get phase(): number { return this._phase; }
  get haltsLink(): boolean { return this._phase === 1 || this._phase === 2; }
  get fillingHearts(): boolean { return this._phase === 1; }
  get hearts(): readonly Readonly<OrbitState>[] { return this._phase === 3 ? [] : this._hearts; }

  // Z_04.asm:3374 UpdatePondFairy: exact Y, inclusive X range, once per visit.
  tryTrigger(linkX: number, linkY: number): boolean {
    if (this._phase !== 0 || linkY !== 0xad - 0x3d || linkX < 0x70 || linkX > 0x80) return false;
    this._phase = 1;
    this.addHeart();
    return true;
  }

  // Z_04.asm:3405 PondFairy_HandleOtherStates: ObjTimer+1 belongs to the fairy
  // (slot 1), despite the ROM comment calling it Link's timer. Own the $50 tail here.
  finishFilling(): void {
    if (this._phase !== 1) return;
    this._phase = 2;
    this._tailTimer = 0x50;
  }

  override stun(): void {}
  override debugKill(): void {} // A room service, not a kill-all monster.

  protected override updateAI(ctx: EnemyUpdateContext): void {
    // Z_04.asm:11479 DrawFairy: two frames every four frames, no motion/collision.
    this._animCounter = (this._animCounter + 1) & 7;
    if (this._phase === 0) {
      this.tryTrigger(ctx.linkX, ctx.linkY);
      return;
    }
    if (this._phase === 3) return;
    if (this._phase === 2 && --this._tailTimer === 0) {
      this._phase = 3;
      return;
    }

    // Z_04.asm:3468: first heart moves BEFORE later hearts test its whole angle.
    for (let i = 0; i < 8; i++) {
      if (!this._hearts[i]) {
        if (this._hearts[0]?.angleWhole !== HEART_START_ANGLES[i - 1]) continue;
        this.addHeart();
      }
      const heart = this._hearts[i];
      if (!heart) continue;
      decreaseObjectAngle(heart, 0x60, 0);
      rotateObjectLocation(heart, 6, 6);
    }
  }

  private addHeart(): void {
    this._hearts.push({
      x: this._x, y: this._y - 0x1c, xFrac: 0, yFrac: 0,
      angleWhole: 0x18, angleFrac: 0, qSpeedFrac: 0x20,
    });
  }

  protected override renderEnemy(renderer: Renderer): void {
    const frame = POND_FAIRY_SPRITES[this._animCounter >> 2] ?? POND_FAIRY_SPRITES[0];
    drawNpcSprite(renderer, frame, this._x, this._y);
    for (const heart of this.hearts) drawNpcSprite(renderer, POND_HEART_SPRITE, heart.x, heart.y);
  }
}
