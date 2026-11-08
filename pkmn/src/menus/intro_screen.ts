// Oak speech's wTileMap + vFrontPic. Frame order: VBlank, then resume the CPU program.
// The tile map, its thirds, the copy queue and the message-box capture are the shared core (renderer/screen_model.ts).
import { textBgTransfer } from '../text/bg_transfer';
import type { TextBox } from '../text/textbox';
import { ScreenTiles, SCREEN_WIDTH, SCREEN_HEIGHT } from './screen_tiles';
import { TileMap, VideoCopyQueue, captureTextBox } from '../renderer/screen_model';

/** Numbers are vFrontPic tile IDs (including tile zero); strings are font/border glyphs. */
export type IntroCell = string | number;
export interface IntroSlot { readonly picture: string; readonly tile: number }

export class IntroScreen {
  bgp = 0xe4;
  obp0 = 0xd0;
  wx = 7;
  private readonly map: TileMap<IntroCell>;
  private readonly front: (IntroSlot | null)[] = Array(49).fill(null);
  private readonly copies = new VideoCopyQueue('Intro picture copy already in progress');

  constructor(initial?: readonly IntroCell[]) {
    if (initial && initial.length !== SCREEN_WIDTH * SCREEN_HEIGHT) throw new Error('Intro requires a full screen snapshot');
    this.map = new TileMap<IntroCell>(index => initial ? initial[index] : ' ');
  }

  get cells(): readonly IntroCell[] { return this.map.cells; }
  get visibleCells(): readonly IntroCell[] { return this.map.visibleCells; }
  get slots(): readonly (IntroSlot | null)[] { return this.front.map(slot => slot && { ...slot }); }
  at(x: number, y: number): IntroCell | null { return this.map.at(x, y); }
  visibleAt(x: number, y: number): IntroCell | null { return this.map.visibleAt(x, y); }

  put(x: number, y: number, value: IntroCell): void { this.map.put(x, y, value); }
  clearArea(x: number, y: number, height: number, width: number): void {
    for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) this.put(x + col, y + row, ' ');
  }
  /** CPU writes only. The speech also dismisses its TextBox when it calls ClearScreen. */
  clearScreen(): void { this.map.fill(' '); }
  /** Naming has already cleared the window on its own clock. Preserve front VRAM and the shared phase. */
  adoptBlankWindow(): void { this.map.fill(' '); this.map.fillShown(' '); }

  // Reuse the existing glyph writers without widening every menu's snapshot/cell contract.
  private glyphWrite(write: (tiles: ScreenTiles) => void): void {
    const tiles = new ScreenTiles(); write(tiles);
    tiles.saveTiles().forEach((cell, index) => { if (cell !== null) this.map.set(index, cell); });
  }
  textBoxBorder(x: number, y: number, innerH: number, innerW: number): void {
    this.glyphWrite(tiles => tiles.textBoxBorder(x, y, innerH, innerW));
  }
  placeString(x: number, y: number, text: string): void {
    this.glyphWrite(tiles => tiles.placeString(x, y, text));
  }

  /** CopyUncompressedPicToHL: VRAM tile IDs run down columns, reversed for flipped pics. */
  placePicture(flipped = false, x = 6, y = 4): void {
    for (let col = 0; col < 7; col++) for (let row = 0; row < 7; row++)
      this.put(x + (flipped ? 6 - col : col), y + row, col * 7 + row);
  }

  /** Schedule seven VBlank batches, then restore the caller's transfer-enabled byte on CPU return. */
  *copyVideoData(picture: string): Generator<void> {
    yield* this.copies.copy(49, tile => { this.front[tile] = { picture, tile }; });
  }

  /** Literal 125-byte copy, six steps, with a top/middle/bottom transfer after each step. */
  *slidePicture(direction: 'left' | 'right'): Generator<void> {
    const delta = direction === 'right' ? 1 : -1;
    let start = direction === 'right' ? 4 * SCREEN_WIDTH + 5 + 125 : 4 * SCREEN_WIDTH + 12;
    for (let step = 0; step < 6; step++) {
      textBgTransfer.enabled = false;
      textBgTransfer.resetPortion();
      let pointer = start;
      for (let byte = 0; byte < 125; byte++) {
        this.map.set(pointer + delta, this.map.get(pointer));
        pointer -= delta;
      }
      if (direction === 'left') this.map.set(pointer - 1, 0);
      textBgTransfer.enabled = true;
      for (let frame = 0; frame < 3; frame++) yield;
      start += delta;
    }
  }

  /** One shared VBlank. TextBox owns the tick when active; this model owns it otherwise.
   * Never also call box.update/updateDisplay in the caller. CPU text advances only when requested. */
  vblank(box?: TextBox, advanceText = false): number | null {
    if (box?.active && box.displaySession) throw new Error('Intro requires standalone PrintText');
    if (this.copies.active && advanceText) throw new Error('CPU text cannot run during CopyVideoData');
    this.captureText(box);
    const third = this.map.transferThird();
    // VBlankCopy follows AutoBgMapTransfer, before any resumed CPU text writes.
    this.copies.service();
    if (box?.active) {
      if (advanceText) box.update(); else box.updateDisplay();
    } else textBgTransfer.tick();
    this.captureText(box);
    return third;
  }

  /** Capture CPU text writes (also call after starting PrintText in the CPU program). No transfer or tick. */
  captureText(box?: TextBox): void { captureTextBox(this.map, box); }
}
