import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { drawText, drawChar, drawScreenTile, textWidth } from './menu_render';
import { initTextSystem } from '../text';
import { fillRect, drawTile } from '../renderer';
import { LEVEL_GLYPH, POKEBALL_GLYPH, TIME_COLON_GLYPH } from './menu_glyphs';

const { font, extra, level, ball, ctx, display } = vi.hoisted(() => ({
  font: { width: 128 }, extra: { width: 128 }, level: { width: 128 }, ball: { width: 128 },
  ctx: { drawImage: vi.fn() }, display: { scale: 1 },
}));
vi.mock('../input', () => ({ isHeld: () => false, isPressed: () => false, syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: () => true }));
vi.mock('../renderer', () => ({
  getCtx: () => ctx, getScale: () => display.scale, fillRect: vi.fn(), drawTile: vi.fn(),
  getActivePalette: () => [0, 0, 0, 0], paletteToHex: () => '#000000',
  loadFont: async (url: string) => url.endsWith('battle_hud_1.png') ? level : font,
  loadTileset: async (url: string) => url.endsWith('balls.png') ? ball : extra,
}));
beforeAll(initTextSystem);
beforeEach(() => { vi.clearAllMocks(); display.scale = 1; });

/** Decode the actual Canvas draw calls, not a mock of drawChar/tokenizeGlyphs. */
function drawn() {
  return ctx.drawImage.mock.calls.map(([sheet, sx, sy, sw, sh, dx, dy, dw, dh]: unknown[]) => {
    expect([sw, sh]).toEqual([8, 8]);
    expect([dw, dh]).toEqual([8 * display.scale, 8 * display.scale]);
    return [sheet === extra ? 'extra' : 'font', Number(sy) / 8 * 16 + Number(sx) / 8, dx, dy];
  });
}

describe('static menu PlaceString glyphs (A5b7a)', () => {
  it('SAVE time draws the narrow $6d colon from font_extra tile 13', () => {
    drawScreenTile(TIME_COLON_GLYPH, 128, 64);
    expect(drawTile).toHaveBeenLastCalledWith(extra, 13, 128, 64);
    expect(fillRect).toHaveBeenCalledWith(128, 64, 8, 8, 0);
  });
  it('draws the LV and ball tiles from their source sheets over an opaque cell', () => {
    drawScreenTile(LEVEL_GLYPH, 112, 40);
    expect(drawTile).toHaveBeenLastCalledWith(level, 1, 112, 40);
    drawScreenTile(POKEBALL_GLYPH, 24, 32);
    expect(drawTile).toHaveBeenLastCalledWith(ball, 0, 24, 32);
    expect(vi.mocked(fillRect).mock.calls).toEqual([[112, 40, 8, 8, 0], [24, 32, 8, 8, 0]]);
  });
  it('opaque tile-map cells erase the map and draw all six source border tiles', () => {
    drawScreenTile(' ', 16, 24);
    expect(fillRect).toHaveBeenCalledWith(16, 24, 8, 8, 0);
    expect(drawn()).toEqual([]);
    for (const [index, glyph] of [...'┌─┐│└┘'].entries()) {
      drawScreenTile(glyph, index * 8, 0);
      expect(drawTile).toHaveBeenLastCalledWith(extra, 25 + index, index * 8, 0);
    }
    drawScreenTile('A', 8, 8);
    expect(drawn()).toEqual([['font', 0, 8, 8]]);
    expect(fillRect).toHaveBeenCalledTimes(8);
  });
  it("draws SOMEONE's PC with the contraction in one tile, preserving the blank cell", () => {
    drawText("SOMEONE's PC", 8, 16);
    expect(drawn()).toEqual([
      ['font', 18, 8, 16], ['font', 14, 16, 16], ['font', 12, 24, 16],
      ['font', 4, 32, 16], ['font', 14, 40, 16], ['font', 13, 48, 16],
      ['font', 4, 56, 16], ['font', 61, 64, 16],
      ['font', 15, 80, 16], ['font', 2, 88, 16],
    ]);
    expect(textWidth("SOMEONE's PC")).toBe(88);
  });

  it('positions a custom player-name suffix with every contraction at its source tile', () => {
    drawText("RED's PC", 0, 0);
    expect(drawn()).toEqual([
      ['font', 17, 0, 0], ['font', 4, 8, 0], ['font', 3, 16, 0], ['font', 61, 24, 0],
      ['font', 15, 40, 0], ['font', 2, 48, 0],
    ]);
    expect(textWidth("RED's PC")).toBe(56);
    ctx.drawImage.mockClear();
    drawText("'d'l's't'v'r'm", 0, 0);
    expect(drawn().map(call => call[1])).toEqual([59, 60, 61, 62, 63, 100, 101]);
    expect(textWidth("'d'l's't'v'r'm")).toBe(56);
  });

  it('draws curly quotes, middle dot and ellipsis from font_extra, with PK/MN from the regular font', () => {
    drawText('‘’“”·…\uE001\uE002', 0, 24);
    expect(drawn()).toEqual([
      ['extra', 16, 0, 24], ['extra', 17, 8, 24], ['extra', 18, 16, 24],
      ['extra', 19, 24, 24], ['extra', 20, 32, 24], ['extra', 21, 40, 24],
      ['font', 97, 48, 24], ['font', 98, 56, 24],
    ]);
    expect(textWidth('‘’“”·…\uE001\uE002')).toBe(64);
  });

  it('retains ASCII and cursor tile positions at non-unit canvas scale', () => {
    display.scale = 3;
    drawText('▶YES NO▼▷', 8, 32);
    expect(drawn()).toEqual([
      ['font', 109, 24, 96], ['font', 24, 48, 96], ['font', 4, 72, 96], ['font', 18, 96, 96],
      ['font', 13, 144, 96], ['font', 14, 168, 96], ['font', 110, 192, 96], ['font', 108, 216, 96],
    ]);
    expect(textWidth('▶YES NO▼▷')).toBe(72); // game pixels, independent of canvas scale
  });

  it('treats control spellings as static characters and advances over unknown/space cells', () => {
    drawText('<DONE> A', 0, 0);
    expect(drawn()).toEqual([
      ['font', 3, 8, 0], ['font', 14, 16, 0], ['font', 13, 24, 0], ['font', 4, 32, 0],
      ['font', 0, 56, 0],
    ]);
    expect(textWidth('<DONE> A')).toBe(64);
    expect(textWidth('')).toBe(0);
    expect(textWidth(' ')).toBe(8);
  });

  it('direct drawChar selects the same glyph sheets and keeps unmapped tiles blank', () => {
    drawChar("'s", 8, 0); drawChar('…', 16, 0); drawChar(' ', 24, 0);
    expect(drawn()).toEqual([['font', 61, 8, 0], ['extra', 21, 16, 0]]);
  });
});
