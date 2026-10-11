// Grumble Goriya ($36) — "GRUMBLE,GRUMBLE!!!", the hungry Goriya of Level 7.
// Z_01.asm: InitGrumble_Full (1141), UpdateGrumble_Full (1482),
//           UpdateGrumble1 (1508), UpdateGrumble3 (1535).
//
// Stands where a dungeon person would (with the same two bonfires) and blocks Link
// from the top of the room with CheckPersonBlocking. Once bait is set out anywhere
// in the room he halts Link, plays the secret tune, flags the room item taken,
// flickers for $40 frames, then takes the bait — removing it from the inventory —
// and leaves. On later visits the flag keeps him away.

import type { Renderer } from '../../render/renderer.js';
import { drawDungeonEnemySprite, GORIYA_SPRITES } from '../../render/enemy-sprite-data.js';
import { personTextLines } from './person-textbox.js';
import { RoomPerson, type PersonRoomContext } from './room-person.js';

export const GRUMBLE = 0x36;
const GRUMBLE_TEXT_SELECTOR = 0x24;
const EAT_FRAMES = 0x40;

// The red Goriya facing down; DrawObjectNotMirrored uses the full sprite.
const GRUMBLE_SPRITE = GORIYA_SPRITES.red[1];

export class Grumble extends RoomPerson {
  private _eatTimer = 0;
  private _fed = false;
  private _finished = false;

  constructor() {
    super(GRUMBLE);
  }

  /** While eating, Link is held (UpdateGrumble1 sets ObjState $40). */
  override get haltsLink(): boolean {
    return super.haltsLink || (this.isActive && this._fed);
  }

  get isEating(): boolean { return this._fed && !this._finished; }

  setup(ctx: PersonRoomContext): void {
    // InitGrumble_Full: already fed → gone.
    if (ctx.itemTaken) {
      this.remove();
      return;
    }
    this.startText(personTextLines(GRUMBLE_TEXT_SELECTOR));
  }

  /**
   * UpdateGrumble1: any food object in the room. Returns true on the frame he
   * takes it — main.ts plays the secret tune and flags the room item taken.
   */
  offerFood(foodPresent: boolean): boolean {
    if (!foodPresent || this._fed || !this.isActive || !this._textbox?.done) return false;
    this._fed = true;
    this._textbox.clear();
    this._flicker = true;
    this._eatTimer = EAT_FRAMES;
    return true;
  }

  /**
   * True once, when the $40-frame wait ends: main.ts removes the bait and the
   * food from the inventory and releases Link (UpdateGrumble3).
   */
  consumeFinished(): boolean {
    if (!this._finished) return false;
    this._finished = false;
    return true;
  }

  protected updatePerson(): void {
    if (!this._fed || this._eatTimer === 0) return;
    if (--this._eatTimer === 0) {
      this._finished = true;
      this.remove();
    }
  }

  protected drawPerson(renderer: Renderer): void {
    drawDungeonEnemySprite(renderer, GRUMBLE_SPRITE, this._x, this._y);
  }
}
