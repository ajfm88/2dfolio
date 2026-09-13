// Magic Rod — Z_05.asm:3036 WieldRod, Z_07.asm:4390 UpdateSwordOrRod (rod path)
// Same state machine as sword swing: Windup (5f) → Extended (8f) → FireShot (1f) → Retract (2×1f).
// Fires a magic shot instead of a sword beam at the Extended→FireShot transition.

import {
  ROD_EXTENDED_FRAMES,
  ROD_WINDUP_FRAMES
} from '../../core/constants.js';
import { Direction } from '../../core/types.js';

import {
  drawItemSprite,
  drawNESItemSprite,
  getProcessedItemsCanvas,
  getProcessedNESStrip
} from '../../data/item-sprites.js';

// items.png wand icon — the id Inventory.getEquippedBItemId reports for the rod.
const WAND_ITEM_ID = 0x10;
// NES held-item footprint: 8 across, 16 along the swing.
const ROD_W = 8;
const ROD_H = 16;

export { MAGIC_SHOT_DAMAGE } from '../../core/constants.js';

export const RodState = Object.freeze({
  Inactive: 0x00,
  Windup: 0x01,
  Extended: 0x02,
  FireShot: 0x03,
  Retract1: 0x04,
  Retract2: 0x05
});

// Z_07.asm:4370 PlayerToWeaponOffsetsX/Y — same tables as sword
const EXTENDED_OFFSET_X = {
  [Direction.Up]: -1,
  [Direction.Down]: 1,
  [Direction.Left]: -11,
  [Direction.Right]: 11
};
const EXTENDED_OFFSET_Y = {
  [Direction.Up]: -9,
  [Direction.Down]: 13,
  [Direction.Left]: 3,
  [Direction.Right]: 3
};

const RETRACT1_OFFSET_X = {
  [Direction.Up]: -1,
  [Direction.Down]: 1,
  [Direction.Left]: -7,
  [Direction.Right]: 7
};
const RETRACT1_OFFSET_Y = {
  [Direction.Up]: -3,
  [Direction.Down]: 9,
  [Direction.Left]: 3,
  [Direction.Right]: 3
};

const RETRACT2_OFFSET_X = {
  [Direction.Up]: -1,
  [Direction.Down]: 1,
  [Direction.Left]: -3,
  [Direction.Right]: 3
};
const RETRACT2_OFFSET_Y = {
  [Direction.Up]: -1,
  [Direction.Down]: 5,
  [Direction.Left]: 3,
  [Direction.Right]: 3
};

export class MagicRod {
   _state = RodState.Inactive;
   timer = 0;
   _direction = Direction.Down;

  get state() {
    return this._state;
  }

  get direction() {
    return this._direction;
  }

  isActive() {
    return this._state !== RodState.Inactive;
  }

  cancel() {
    this._state = RodState.Inactive;
    this.timer = 0;
  }

  start(direction) {
    this._state = RodState.Windup;
    this._direction = direction;
    this.timer = ROD_WINDUP_FRAMES;
  }

  update() {
    if (this._state === RodState.Inactive) {
      return { done: false, shouldFireShot: false };
    }

    this.timer--;
    if (this.timer > 0) {
      return { done: false, shouldFireShot: false };
    }

    switch (this._state) {
      case RodState.Windup:
        this._state = RodState.Extended;
        this.timer = ROD_EXTENDED_FRAMES;
        return { done: false, shouldFireShot: false };

      case RodState.Extended:
        this._state = RodState.FireShot;
        this.timer = 1;
        return { done: false, shouldFireShot: true };

      case RodState.FireShot:
        this._state = RodState.Retract1;
        this.timer = 1;
        return { done: false, shouldFireShot: false };

      case RodState.Retract1:
        this._state = RodState.Retract2;
        this.timer = 1;
        return { done: false, shouldFireShot: false };

      case RodState.Retract2:
        this._state = RodState.Inactive;
        return { done: true, shouldFireShot: false };

      default:
        return { done: false, shouldFireShot: false };
    }
  }

  getHitbox(linkX, linkY) {
    if (this._state !== RodState.Extended) return null;

    switch (this._direction) {
      case Direction.Up:
        return { x: linkX - 4, y: linkY - 16, width: 24, height: 32 };
      case Direction.Down:
        return { x: linkX - 4, y: linkY, width: 24, height: 32 };
      case Direction.Left:
        return { x: linkX - 16, y: linkY - 4, width: 32, height: 24 };
      case Direction.Right:
        return { x: linkX, y: linkY - 4, width: 32, height: 24 };
    }
  }

  getRodPosition(linkX, linkY) {
    if (this._state === RodState.Inactive || this._state === RodState.Windup) {
      return null;
    }

    let offX;
    let offY;

    switch (this._state) {
      case RodState.Extended:
      case RodState.FireShot:
        offX = EXTENDED_OFFSET_X;
        offY = EXTENDED_OFFSET_Y;
        break;
      case RodState.Retract1:
        offX = RETRACT1_OFFSET_X;
        offY = RETRACT1_OFFSET_Y;
        break;
      default:
        offX = RETRACT2_OFFSET_X;
        offY = RETRACT2_OFFSET_Y;
        break;
    }

    return {
      x: linkX + offX[this._direction],
      y: linkY + offY[this._direction]
    };
  }

  // The strip cell is the inventory icon: an upright staff, tip up. That reads
  // correctly when Link points it up or down, but held out sideways it has to
  // lie along the swing — so rotate a quarter turn, tip leading, for left/right.
   drawHeldRod(
    ctx,
    strip,
    x,
    y,
  ) {
    const horizontal =
      this._direction === Direction.Left || this._direction === Direction.Right;
    if (!horizontal) {
      return drawNESItemSprite(ctx, strip, WAND_ITEM_ID, x, y, ROD_W, ROD_H);
    }
    // Spin about the sprite's own centre so the rod stays where it was placed.
    ctx.save();
    ctx.translate(x + ROD_W / 2, y + ROD_H / 2);
    ctx.rotate(this._direction === Direction.Right ? Math.PI / 2 : -Math.PI / 2);
    const drawn = drawNESItemSprite(
      ctx, strip, WAND_ITEM_ID, -ROD_W / 2, -ROD_H / 2, ROD_W, ROD_H,
    );
    ctx.restore();
    return drawn;
  }

  render(renderer, linkX, linkY) {
    const pos = this.getRodPosition(linkX, linkY);
    if (!pos) return;

    // Retract2 — invisible (same as sword's last retract frame)
    if (this._state === RodState.Retract2) return;

    // The rod itself is a held item, not a projectile — projectiles.png has no
    // rod cell. Take it from the primaryItems.png strip, whose mapping is the
    // verified one; items.png only as a fallback. Drawn straight from items.png
    // this was the lion-head Magic Key, appearing for the frames Link holds the
    // rod up — which read as a bad first frame of the shot.
    const strip = getProcessedNESStrip();
    if (strip && this.drawHeldRod(renderer.ctx, strip, pos.x, pos.y)) return;
    const itemsCanvas = getProcessedItemsCanvas();
    if (itemsCanvas) {
      drawItemSprite(renderer.ctx, itemsCanvas, WAND_ITEM_ID, pos.x, pos.y);
    }
  }
}
