// Zelda ($37) — Z_04.asm InitZelda:9462, UpdateZelda:9587
// Rescue NPC in the final room after Ganon. Checks Link proximity; when Link is
// close enough, halts Link, plays fanfare, and triggers the ending sequence.
// Spawned as a group: 1 Zelda + 4 GuardFire via createZeldaGroup().

import type { Renderer } from '../../render/renderer.js';
import { Enemy, type EnemyUpdateContext } from './enemy.js';
import { GuardFire } from './guard-fire.js';

// NES positions from GuardFireXs/Ys, converted to local (Y - $40 for HUD offset)
const ZELDA_X = 0x78;
const ZELDA_Y = 0x48; // $88 raw → $48 local
const GUARD_FIRE_POSITIONS: Array<[number, number]> = [
  [0x60, 0x75], // $B5 → $75 local
  [0x70, 0x5d], // $9D → $5D local
  [0x80, 0x5d],
  [0x90, 0x75],
];

// Link proximity check bounds from Z_04.asm UpdateZelda
const LINK_X_MIN = 0x70;
const LINK_X_MAX = 0x80;
const LINK_Y_CHECK = 0x55; // $95 raw → $55 local

enum ZeldaState {
  Waiting,
  RescueTriggered,
}

export class ZeldaNpc extends Enemy {
  private _zeldaState = ZeldaState.Waiting;
  private _rescueTimer = 0;
  private _endingTriggered = false;

  constructor(
    x: number, y: number,
    objectType: number, hp: number, _spawnCloudFrames: number,
  ) {
    super(x, y, objectType, hp, 0);
    this._vulnerable = false;
    this._invincibilityMask = 0xff;
    this._x = ZELDA_X;
    this._y = ZELDA_Y;
  }

  get isEndingTriggered(): boolean { return this._endingTriggered; }

  get isRescueTriggered(): boolean {
    return this._zeldaState === ZeldaState.RescueTriggered;
  }

  override stun(): void {}

  protected override updateAI(ctx: EnemyUpdateContext): void {
    switch (this._zeldaState) {
      case ZeldaState.Waiting:
        // Check if Link is close enough
        if (ctx.linkX >= LINK_X_MIN && ctx.linkX < LINK_X_MAX &&
            Math.abs(ctx.linkY - LINK_Y_CHECK) < 4) {
          this._zeldaState = ZeldaState.RescueTriggered;
          this._rescueTimer = 0x80;
        }
        break;

      case ZeldaState.RescueTriggered:
        this._rescueTimer--;
        if (this._rescueTimer <= 0) {
          this._endingTriggered = true;
        }
        break;
    }
  }

  protected override renderEnemy(renderer: Renderer): void {
    const ctx = renderer.ctx;
    // Zelda NPC — simple dress shape
    ctx.fillStyle = '#f868f8'; // pink dress
    ctx.fillRect(this._x + 4, this._y + 2, 8, 14);
    ctx.fillStyle = '#f8d8b0'; // skin
    ctx.fillRect(this._x + 5, this._y, 6, 5);
    ctx.fillStyle = '#a03000'; // hair
    ctx.fillRect(this._x + 4, this._y, 2, 6);
    ctx.fillRect(this._x + 10, this._y, 2, 6);
    // Crown
    ctx.fillStyle = '#f8d870';
    ctx.fillRect(this._x + 6, this._y - 2, 4, 2);
  }
}

// Factory: creates 1 Zelda + 4 GuardFire at the fixed NES positions
export function createZeldaGroup(
  _cx: number, _cy: number,
  hp: number, spawnDelay: number,
): { zelda: ZeldaNpc; fires: GuardFire[] } {
  const zelda = new ZeldaNpc(ZELDA_X, ZELDA_Y, 0x37, hp, spawnDelay);
  const fires: GuardFire[] = [];
  for (const [fx, fy] of GUARD_FIRE_POSITIONS) {
    fires.push(new GuardFire(fx, fy, 0x3f, 0x10, 0));
  }
  return { zelda, fires };
}
