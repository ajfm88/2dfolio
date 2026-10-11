// Z_04.asm:1831 InitBoulderSet, :1836 InitBoulder, :2167 UpdateBoulderSet,
// :2250 UpdateTektiteOrBoulder, :2549 Jumper_MoveY. Ordinary monsters use NES Y - $40.
import { MAX_ENEMY_SLOTS } from '../../core/constants.js';
import { Direction } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';
import { BOULDER_SPRITES, drawOverworldEnemySprite } from '../../render/enemy-sprite-data.js';
import { Enemy, EnemyState, type EnemyUpdateContext } from './enemy.js';
import { dir8At, dir8Index, turnTowardsTarget8 } from './dir8.js';

export const BOULDER_SET = 0x1f;
export const BOULDER = 0x20;
const START_DIRS = [0x01, 0x02, 0x05, 0x0a] as const;
const randomByte = (): number => Math.floor(Math.random() * 256);

export class BoulderSet extends Enemy {
  private _timer: number;

  constructor() {
    super(0, 0, BOULDER_SET, 0, 0);
    this._state = EnemyState.Active;
    this._vulnerable = false;
    this._touchesLink = false;
    this._timer = START_DIRS[randomByte() & 3]! * 4;
  }

  get timer(): number { return this._timer; }
  override stun(): void {}
  override debugKill(): void {}
  protected override renderEnemy(_renderer: Renderer): void {} // Invisible slot 1.

  protected override updateAI(ctx: EnemyUpdateContext): void {
    if (this._timer > 0) this._timer--;
    if (this._timer !== 0) return;
    // Z_04.asm:2167: cap live boulders, and separately require a free monster slot.
    if (Boulder.activeCount + this._childSpawns.length >= 3) {
      this._timer = (this._timer + randomByte()) & 0xff;
      return;
    }
    if ((ctx.freeMonsterSlots ?? MAX_ENEMY_SLOTS) <= this._childSpawns.length) return;
    const r = randomByte();
    this._childSpawns.push({
      objectType: BOULDER, x: ctx.linkX < 0x80 ? r & 0x7f : r | 0x80,
      y: 0x40 - 0x40, spawnCloudFrames: 0,
    });
    this._timer = (randomByte() + 8) & 0x1f;
  }
}

export class Boulder extends Enemy {
  private static _activeCount = 0;
  private _dir8: number;
  private _timer: number;
  private _jumping = false;
  private _targetY = 0;
  private _speedWholeY = 0;
  private _speedFracY = 0;
  private _reversalCount = 0;

  static get activeCount(): number { return Boulder._activeCount; }
  static resetActiveCount(): void { Boulder._activeCount = 0; }

  constructor(x: number, y = 0) {
    super(x, y, BOULDER, 0, 0);
    this._state = EnemyState.Active;
    this._vulnerable = false;
    this._dir8 = START_DIRS[randomByte() & 3]!;
    this._timer = this._dir8 * 4;
    Boulder._activeCount++;
  }

  get dir8(): number { return this._dir8; }
  get timer(): number { return this._timer; }
  get jumping(): boolean { return this._jumping; }
  get targetY(): number { return this._targetY; }
  get speedWholeY(): number { return this._speedWholeY; }
  get reversalCount(): number { return this._reversalCount; }
  override stun(): void {} // @DrawBoulder checks Link only, never weapons.
  override debugKill(): void {} // Avoid puff/drop and corrupting ActiveBoulders.

  protected override updateAI(ctx: EnemyUpdateContext): void {
    // Z_04.asm:2499 @DrawBoulder: animate even under Clock; destroy at NES Y >= $F0.
    this.tickWalkAnimation(6);
    if (this._timer > 0) this._timer--;
    if (!ctx.clockActive) this.updateJump(ctx);
    if (this._y >= 0xf0 - 0x40) {
      Boulder._activeCount = Math.max(0, Boulder._activeCount - 1);
      this._state = EnemyState.Dead;
    }
  }

  private updateJump(ctx: EnemyUpdateContext): void {
    if (!this._jumping) {
      if (this._timer !== 0) return;
      let target = ctx.linkX === this._x ? 0 : ctx.linkX > this._x ? 1 : 2;
      const linkNesY = ctx.linkY + 0x3d;
      const objNesY = this._y + 0x40;
      if (linkNesY !== objNesY) target |= linkNesY > objNesY ? 4 : 8;
      this._dir8 = turnTowardsTarget8(this._dir8, target);
      if ((this._dir8 & 3) === 0) this._dir8 |= ctx.linkX >= this._x ? 1 : 2;
      this._jumping = true;
      this.setUpJump();
      return;
    }

    // Z_04.asm:11619 BoundFlyer skips vertical bounds for $20. Z_01.asm:3360
    // BoundDirectionHorizontally / Z_05.asm:6438: only outward headings bounce.
    if ((this._x < 0x11 && (this._dir8 & 2) !== 0) ||
        (this._x >= 0xe0 && (this._dir8 & 1) !== 0)) {
      this._dir8 = dir8At(dir8Index(this._dir8) + 4);
      this._reversalCount++;
      this.setUpJump();
      return;
    }
    this._dir8 = (this._dir8 & 3) | 4;
    this._reversalCount = 0;
    // Z_04.asm:2549 Jumper_MoveY: move first, then add $60 to the speed fraction.
    this._y += this._speedWholeY;
    this._speedFracY += 0x60;
    if (this._speedFracY >= 0x100) {
      this._speedFracY -= 0x100;
      this._speedWholeY++;
    }
    if (this._speedWholeY >= 2 && this._speedFracY >= 0x80) {
      this._speedWholeY = 2;
      this._speedFracY = 0;
    }
    this._x += (this._dir8 & 2) !== 0 ? -1 : 1;
    if (this._speedWholeY >= 0 && Math.abs(this._y - this._targetY) < 3) {
      // Z_04.asm:2420-2463 ResetObjState leaves A=0; boulders get NO landing pause.
      this._jumping = false;
      this._timer = 0;
    }
  }

  private setUpJump(): void {
    // Z_04.asm:2304 @SetUpJump: two consecutive reversals flip horizontal bits.
    if (this._reversalCount >= 2) {
      this._dir8 ^= 3;
      this._reversalCount = 0;
    }
    this._dir8 = (this._dir8 & 3) | 4;
    this._direction = (this._dir8 & 2) !== 0 ? Direction.Left : Direction.Right;
    this._targetY = this._y + 0x20;
    this._speedWholeY = -2; // JumperStartSpeedsHi[2] = $FE (Z_04.asm:2244).
    this._speedFracY = 0;
  }

  protected override renderEnemy(renderer: Renderer): void {
    const frame = BOULDER_SPRITES[this._walkAnimFrame] ?? BOULDER_SPRITES[0];
    drawOverworldEnemySprite(renderer, frame, this._x, this._y);
  }
}
