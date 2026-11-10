// engine/events/hidden_events/museum_fossils2.asm DisplayMonFrontSpriteInBox (V3 checkpoint-02c, note 88 §28).
import { ScreenTiles } from '../menus/screen_tiles';
import type { BgTransfer } from '../text/bg_transfer';
import { copyFrames } from '../overworld/sprite_sets';
import type { MonPopupPicture } from './types';

/** A ScreenTiles cell that holds a picture tile rather than a font glyph. */
export const MON_POPUP_PICTURE = '<monPopupPicture>';

/** data/text_boxes.asm MON_SPRITE_POPUP: (6,4) to (14,13). */
const BOX = { x: 6, y: 4, width: 9, height: 10 };
/** AnimateSendingOutMon's .notInBattle: hlcoord 10,11 minus SCREEN_WIDTH * 6 + 3. */
const PICTURE = { x: 7, y: 5 };
/** The 7×7 tiles LoadMonFrontSprite copies with CopyVideoData. */
const PICTURE_TILES = 49;

type Phase = 'before' | 'copying' | 'waiting' | 'restoring' | 'done';

/**
 * One tick is one VBlank followed by the routine's CPU work. The picture's decompression costs no frame, as CPU time
 * doesn't anywhere in the port. Delay3; save the screen; the box; UpdateSprites; CopyVideoData with the automatic
 * transfer off; the picture's tilemap; WaitForTextScrollButtonPress (no arrow: (18,16) holds a map tile, and the off
 * branch returns while the blink count is 0); LoadScreenTilesFromBuffer1; Delay3.
 */
export class MonSpritePopup {
  readonly tiles = new ScreenTiles();
  readonly box = BOX;
  boxDrawn = false;
  private phase: Phase = 'before';
  private frames = 3;
  private readonly columns: number;
  private readonly rows: number;
  private readonly left: number;
  private readonly top: number;

  constructor(
    readonly picture: MonPopupPicture,
    private readonly transfer: BgTransfer,
    private readonly updateSprites: (tileAt: (x: number, y: number) => number) => void,
  ) {
    this.columns = picture.dimensions & 15;
    this.rows = picture.dimensions >>> 4;
    // home/pics.asm, as frontPictureBox: SRL floors the columns, the rows bottom-align.
    this.left = PICTURE.x + Math.floor((8 - this.columns) / 2);
    this.top = PICTURE.y + 7 - this.rows;
    transfer.enabled = true; // ld a, 1; ldh [hAutoBGTransferEnabled], a
  }

  /** The tile in the picture's sheet for the picture cell at (x,y). */
  sheetTile(x: number, y: number): number { return (x - this.left) + (y - this.top) * this.columns; }

  /** One tick. True on the tick the routine returns. */
  frame(pressedAB: () => boolean): boolean {
    this.tiles.present(this.transfer);
    if (this.phase === 'before' && --this.frames === 0) {
      this.tiles.textBoxBorder(BOX.x, BOX.y, BOX.height - 2, BOX.width - 2);
      this.boxDrawn = true;
      this.updateSprites((x, y) => this.tiles.at(x, y) !== null ? 0x60 : 0);
      this.transfer.enabled = false; // CopyVideoData
      this.phase = 'copying';
      this.frames = copyFrames(PICTURE_TILES);
      return false;
    }
    if (this.phase === 'copying' && --this.frames === 0) {
      this.transfer.enabled = true;
      for (let row = 0; row < this.rows; row++) for (let column = 0; column < this.columns; column++)
        this.tiles.put(this.left + column, this.top + row, MON_POPUP_PICTURE);
      this.phase = 'waiting';
    }
    if (this.phase === 'waiting') {
      if (!pressedAB()) return false;
      this.tiles.release(0, 0, 18, 20); // LoadScreenTilesFromBuffer1
      this.phase = 'restoring';
      this.frames = 3;
      return false;
    }
    if (this.phase === 'restoring' && --this.frames === 0) {
      this.phase = 'done';
      return true;
    }
    return false;
  }
}
