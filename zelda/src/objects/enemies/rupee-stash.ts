// Rupee Stash ($35) — the "money room" of Levels 4, 7 and 8.
// Z_01.asm: InitRupeeStash_Full (2374), UpdateRupeeStash_Full (2608).
//
// One spawn becomes ten rupee objects laid out in a diamond. They are monsters in
// object slots 1-10, not items: weapons pass through them, they never hurt Link,
// and each one is worth a single rupee when Link comes within 8px of it on both
// axes. Taking any one zeroes RoomObjCount, so the room counts as emptied once
// Link leaves — main.ts marks it cleared on the first pickup.

import type { Renderer } from '../../render/renderer.js';
import { drawItemSprite, getProcessedItemsCanvas } from '../../data/item-sprites.js';
import { Enemy, EnemyState } from './enemy.js';

export const RUPEE_STASH = 0x35;
const ONE_RUPEE_ITEM = 0x18;

// NES coordinates. Like Link, items are drawn at their ObjY, so these convert to
// play-area-local with Link's $3D offset — the same frame Link's posY lives in.
const NES_LINK_Y_OFFSET = 0x3d;
export const RUPEE_STASH_XS = [0x78, 0x70, 0x80, 0x60, 0x70, 0x80, 0x90, 0x70, 0x80, 0x78] as const;
export const RUPEE_STASH_YS = [0x70, 0x80, 0x80, 0x90, 0x90, 0x90, 0x90, 0xa0, 0xa0, 0xb0] as const;

// UpdateRupeeStash_Full: |Link - rupee| < 9 on both axes.
const TAKE_DISTANCE = 9;

export class RupeeStash extends Enemy {
  constructor(x: number, y: number, hp: number) {
    super(x, y, RUPEE_STASH, hp, 0);
    this._vulnerable = false;
    this._touchesLink = false;
    // InitOneSimpleObject: no spawn cloud, the rupees are simply there.
    this._state = EnemyState.Active;
  }

  isTouchedBy(linkX: number, linkY: number): boolean {
    if (this._state !== EnemyState.Active) return false;
    return Math.abs(linkX - this._x) < TAKE_DISTANCE && Math.abs(linkY - this._y) < TAKE_DISTANCE;
  }

  /** TakeOneRupee + DestroyMonster: gone at once, no death puff. */
  collect(): void {
    this._state = EnemyState.Dead;
  }

  override stun(): void {}

  protected override renderEnemy(renderer: Renderer): void {
    const items = getProcessedItemsCanvas();
    if (!items) return;
    // The rupee is 8px wide; drawItemSprite centres item art in a 16px cell, so
    // shift left 4px to keep its left edge on ObjX like DrawItemInInventory.
    drawItemSprite(renderer.ctx, items, ONE_RUPEE_ITEM, this._x - 4, this._y);
  }
}

/** InitRupeeStash_Full: ten rupees at RupeeStashXs/Ys. */
export function createRupeeStash(hp: number): RupeeStash[] {
  return RUPEE_STASH_XS.map(
    (x, i) => new RupeeStash(x, RUPEE_STASH_YS[i]! - NES_LINK_Y_OFFSET, hp),
  );
}
