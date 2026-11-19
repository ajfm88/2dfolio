// Opening checkpoint-05 (note 114): the opening's screen model and its pure scanout.
import { beforeEach, describe, expect, it } from 'vitest';
import { BG_MAP0, BG_MAP1, OpeningScreen, SPACE_TILE, bgTileIndex, type OpeningImage } from './opening_screen';
import { LCD_OFF_COLOUR, renderOpeningScreen } from './opening_screen_render';
import { getPaletteColors } from '../renderer/palettes';
import { textBgTransfer } from '../text/bg_transfer';

/** A one-row image of 8 × 8 tiles; tile t is filled with colour index fill(t). */
function sheet(count: number, fill: (tile: number) => number): OpeningImage {
  const width = count * 8, data = new Uint8Array(width * 8 * 4);
  const gray = [255, 170, 85, 0];
  for (let y = 0; y < 8; y++) for (let x = 0; x < width; x++) data[(y * width + x) * 4] = gray[fill(x >> 3)];
  return { width, height: 8, data };
}
const pixel = (frame: Uint8ClampedArray, x: number, y: number): number[] => [...frame.subarray((y * 160 + x) * 4, (y * 160 + x) * 4 + 3)];

beforeEach(() => { textBgTransfer.enabled = true; textBgTransfer.resetPortion(); });

describe('the opening screen model', () => {
  it('reads BG and window tile ids through LCDC_BLOCK21: $80–$FF at $8800, $00–$7F at $9000', () => {
    expect([0x00, 0x7f, 0x80, 0xff].map(bgTileIndex)).toEqual([0x100, 0x17f, 0x80, 0xff]);
  });

  it('copies tiles as colour indices and refuses a copy past its image or past VRAM', () => {
    const s = new OpeningScreen();
    s.loadTiles(0x80, sheet(4, tile => tile), 3, 1);
    expect([...s.vram[0x80]].every(i => i === 1)).toBe(true);
    expect([...s.vram[0x82]].every(i => i === 3)).toBe(true);
    expect([...s.vram[0x83]].every(i => i === 0)).toBe(true);
    expect(() => s.loadTiles(0, sheet(2, () => 0), 3)).toThrow(/past the end of its image/);
    expect(() => s.loadTiles(383, sheet(2, () => 0), 2)).toThrow(/past the end of VRAM/);
  });

  it('starts as Init leaves it: both maps blank, the transfer aimed at vBGMap1, the window off-screen at WX 7', () => {
    const s = new OpeningScreen();
    expect(s.bgMaps.every(map => map.every(cell => cell === SPACE_TILE))).toBe(true);
    expect(s.bgTransferDest).toBe(BG_MAP1);
    expect([s.wy, s.wx, s.lcdOn, s.blankFrame]).toEqual([144, 7, true, false]);
  });

  it('VBlank latches hSCX, hSCY and hWY, transfers one third and DMAs OAM; the CPU copies wait for it', () => {
    const s = new OpeningScreen();
    s.hScx = 3; s.hScy = 0x40; s.hWy = 0x40; s.oam[0] = 0x60;
    expect([s.scx, s.scy, s.wy, s.shownOam[0]]).toEqual([0, 0, 144, 0]);
    expect(s.vblank()).toBe(0);
    expect([s.scx, s.scy, s.wy, s.shownOam[0]]).toEqual([3, 0x40, 0x40, 0x60]);
    expect(textBgTransfer.nextPortion).toBe(1);
    textBgTransfer.enabled = false;
    expect(s.vblank()).toBeNull();
    expect(textBgTransfer.nextPortion).toBe(1);
  });

  it('a $9B00 transfer puts rows 0–7 in vBGMap0 rows 24–31 and rows 8–17 in the window map rows 0–9', () => {
    const s = new OpeningScreen();
    for (let index = 0; index < 360; index++) s.tileMap.set(index, index & 0xff);
    s.bgTransferDest = BG_MAP0 + 0x300;
    s.vblank(); s.vblank(); s.vblank();
    for (let row = 0; row < 18; row++) for (let col = 0; col < 20; col++) {
      const map = row < 8 ? s.bgMaps[0] : s.bgMaps[1];
      const at = row < 8 ? (24 + row) * 32 + col : (row - 8) * 32 + col;
      expect(map[at], `${col},${row}`).toBe((row * 20 + col) & 0xff);
    }
    expect(s.bgMaps[0][23 * 32]).toBe(SPACE_TILE);
    expect(s.bgMaps[1][10 * 32]).toBe(SPACE_TILE);
  });

  it('fills and writes only the two BG maps, and takes attribute blocks of whole rows', () => {
    const s = new OpeningScreen();
    s.fillBg(BG_MAP0 + 0x3ff, 2, 5);
    expect([s.bgMaps[0][0x3ff], s.bgMaps[1][0]]).toEqual([5, 5]);
    expect(() => s.writeBg(0x97ff, 0)).toThrow(/outside VRAM/);
    expect(() => s.writeBg(0xa000, 0)).toThrow(/outside VRAM/);
    expect(() => s.setAttributes(0, [1, 2])).toThrow(/whole rows/);
  });
});

describe('the opening screen scanout', () => {
  /** Tile 0 ($9000) colour 0, tile $81 colour 1, tile $82 colour 2, tile $83 colour 3; object tile 4 colour 1 with a
   *  transparent first column, tile 5 colour 3. */
  function screen(): OpeningScreen {
    const s = new OpeningScreen();
    s.loadTiles(0x81, sheet(3, tile => tile + 1), 3);
    const obj = new Uint8Array(8 * 8 * 4);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) obj[(y * 8 + x) * 4] = x === 0 ? 255 : 170;
    s.loadTiles(4, { width: 8, height: 8, data: obj }, 1);
    s.loadTiles(5, sheet(1, () => 3), 1);
    s.bgMaps[0].fill(0); s.bgMaps[1].fill(0x83);
    s.bgp = 0xe4; s.obp0 = 0xe0; s.obp1 = 0xe4;
    s.bgPalettes = ['LOGO2', 'LOGO1', 'MEWMON', 'PURPLEMON'];
    s.objPalettes = ['LOGO2', 'LOGO1', 'MEWMON', 'PURPLEMON', 'LOGO2', 'LOGO1', 'REDMON', 'PURPLEMON'];
    return s;
  }

  it('is white while the LCD is off and for the first frame after EnableLCD, until the next VBlank', () => {
    const s = screen(); s.bgMaps[0].fill(0x83);
    s.disableLcd();
    expect(pixel(renderOpeningScreen(s), 0, 0)).toEqual([...LCD_OFF_COLOUR]);
    s.enableLcd();
    expect(pixel(renderOpeningScreen(s), 80, 70)).toEqual([...LCD_OFF_COLOUR]);
    s.vblank();
    expect(pixel(renderOpeningScreen(s), 80, 70)).toEqual(getPaletteColors('LOGO2')[3]);
  });

  it('BGP maps the index, then the cell\'s attribute picks the CGB palette', () => {
    const s = screen();
    s.bgMaps[0][0] = 0x82; s.bgMaps[0][1] = 0x82; s.attributes[0][1] = 2;
    let frame = renderOpeningScreen(s);
    expect(pixel(frame, 0, 0)).toEqual(getPaletteColors('LOGO2')[2]);
    expect(pixel(frame, 8, 0)).toEqual(getPaletteColors('MEWMON')[2]);
    s.bgp = 0x00;
    frame = renderOpeningScreen(s);
    expect(pixel(frame, 8, 0)).toEqual(getPaletteColors('MEWMON')[0]);
  });

  it('SCY scrolls the BG and wraps at 256', () => {
    const s = screen();
    s.bgMaps[0][31 * 32] = 0x83; s.scy = 0xf8;
    const frame = renderOpeningScreen(s);
    expect(pixel(frame, 0, 0)).toEqual(getPaletteColors('LOGO2')[3]);
    expect(pixel(frame, 0, 8)).toEqual(getPaletteColors('LOGO2')[0]);
  });

  it('the window draws vBGMap1 from line WY at WX - 7, and nothing at WY 144', () => {
    const s = screen();
    s.wy = 0x40; s.attributes[1].fill(2);
    let frame = renderOpeningScreen(s);
    expect(pixel(frame, 0, 63)).toEqual(getPaletteColors('LOGO2')[0]);
    expect(pixel(frame, 0, 64)).toEqual(getPaletteColors('MEWMON')[3]);
    s.wx = 7 + 16;
    frame = renderOpeningScreen(s);
    expect(pixel(frame, 15, 64)).toEqual(getPaletteColors('LOGO2')[0]);
    expect(pixel(frame, 16, 64)).toEqual(getPaletteColors('MEWMON')[3]);
    s.wy = 144;
    expect(pixel(renderOpeningScreen(s), 16, 100)).toEqual(getPaletteColors('LOGO2')[0]);
  });

  it('objects: colour 0 is transparent, X flip mirrors, palettes 0–3 go through OBP0 and 4–7 through OBP1', () => {
    const s = screen();
    s.oam.set([16, 8, 4, 0x02, 16, 24, 4, 0x22, 32, 8, 4, 0x06]);
    s.vblank();
    const frame = renderOpeningScreen(s);
    // OBP0 $E0 maps index 1 to colour 0: the body is visible only through OBP1 ($E4, palette 6).
    expect(pixel(frame, 0, 0)).toEqual(getPaletteColors('LOGO2')[0]);
    expect(pixel(frame, 1, 0)).toEqual(getPaletteColors('MEWMON')[0]);
    s.obp0 = 0xe4;
    const mapped = renderOpeningScreen(s);
    expect(pixel(mapped, 1, 0)).toEqual(getPaletteColors('MEWMON')[1]);
    // X flip: the transparent first column is drawn last, at x 23.
    expect(pixel(mapped, 16, 0)).toEqual(getPaletteColors('MEWMON')[1]);
    expect(pixel(mapped, 23, 0)).toEqual(getPaletteColors('LOGO2')[0]);
    expect(pixel(mapped, 0, 16)).toEqual(getPaletteColors('LOGO2')[0]);
    expect(pixel(mapped, 1, 16)).toEqual(getPaletteColors('REDMON')[1]);
  });

  it('a lower OAM index wins an overlap, and only the first ten objects on a line are drawn', () => {
    const s = screen();
    s.obp0 = 0xe4;
    for (let index = 0; index < 11; index++) s.oam.set([16, 8 + index * 8, 5, index === 0 ? 0 : 1], index * 4);
    s.oam.set([16, 8, 5, 2], 11 * 4);
    s.vblank();
    const frame = renderOpeningScreen(s);
    expect(pixel(frame, 0, 0)).toEqual(getPaletteColors('LOGO2')[3]);
    expect(pixel(frame, 72, 0)).toEqual(getPaletteColors('LOGO1')[3]);
    expect(pixel(frame, 80, 0)).toEqual(getPaletteColors('LOGO2')[0]);
  });

  it('draws the OAM the last DMA copied, not shadow OAM', () => {
    const s = screen();
    s.obp0 = 0xe4; s.oam.set([16, 8, 5, 0]);
    expect(pixel(renderOpeningScreen(s), 0, 0)).toEqual(getPaletteColors('LOGO2')[0]);
    s.vblank();
    expect(pixel(renderOpeningScreen(s), 0, 0)).toEqual(getPaletteColors('LOGO2')[3]);
  });
});
