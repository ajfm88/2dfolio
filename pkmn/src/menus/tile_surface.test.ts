import { describe, expect, it } from 'vitest';
import { BattleScreen } from '../battle/battle_screen';
import { BattleTiles } from '../battle/battle_tiles';
import { renderBattleScreen } from '../battle/battle_screen_render';
import { textBgTransfer } from '../text/bg_transfer';
import { ScreenTiles } from './screen_tiles';
import { clearArea, eraseMenuCursor, placeMenuCursor, placeString, placeUnfilledArrowMenuCursor,
  textBoxBorder, writeBcd, writeNumber } from './tile_surface';
import type { MenuCursorState } from './tile_surface';

describe('shared tile surface writers and cartridge cursor', () => {
  it('writes opaque battle clears while retaining numeric tiles, null transparency and deferred glyph errors', () => {
    const screen = new BattleScreen(), tiles = new BattleTiles(screen);
    tiles.put(2, 2, 0x31); tiles.put(2, 2, null);
    expect(tiles.at(2, 2)).toBe(0x31);
    tiles.clear(2, 2); expect(tiles.at(2, 2)).toBe(' ');
    tiles.put(2, 2, '☃'); expect(tiles.at(2, 2)).toBe('☃');
    textBgTransfer.enabled = true; textBgTransfer.resetPortion(); screen.vblank();
    const image = { width: 8, height: 8, data: new Uint8ClampedArray(8 * 8 * 4) };
    expect(() => renderBattleScreen(screen, { font: image, extra: image, hud1: image, hud2: image,
      hud3: image, sprites: image, pictures: new Map() })).toThrow('unknown battle cell');
    clearArea(tiles, 2, 2, 1, 1); expect(tiles.at(2, 2)).toBe(' ');
  });

  it('shares border/string/number writers, keeps skipped leading cells and supports single spacing', () => {
    const tiles = new ScreenTiles();
    textBoxBorder(tiles, 0, 0, 3, 9);
    expect(tiles.at(10, 4)).toBe('┘'); expect(tiles.at(1, 1)).toBe(' ');
    placeString(tiles, 1, 1, 'A<NEXT>B@', 1); expect(tiles.at(1, 2)).toBe('B');
    placeString(tiles, 5, 1, 'AB');
    writeNumber(tiles, 5, 1, 5, { digits: 2, leadingZeroes: false });
    expect(tiles.at(5, 1)).toBe('A'); expect(tiles.at(6, 1)).toBe('5');
    writeBcd(tiles, 2, 3, 0, { bytes: 1, suppressZero: true, leftAlign: false, moneySign: false });
    expect(tiles.at(2, 3)).toBe(' '); expect(tiles.at(3, 3)).toBe('0');
  });

  it('restores only filled arrows, preserves a swap marker, and uses the stored address for erase/unfilled', () => {
    const tiles = new BattleTiles(new BattleScreen());
    const state: MenuCursorState = { topX: 5, topY: 12, rowStep: 1, item: 1, lastItem: 1,
      tileBehind: ' ', location: null };
    tiles.put(5, 13, 0x31); placeMenuCursor(tiles, state);
    expect(state.tileBehind).toBe(0x31);
    state.item = 2; placeMenuCursor(tiles, state);
    expect(tiles.at(5, 13)).toBe(0x31);
    placeUnfilledArrowMenuCursor(tiles, state); state.item = 3; placeMenuCursor(tiles, state);
    expect(tiles.at(5, 14)).toBe('▷');
    state.item = 0; eraseMenuCursor(tiles, state);
    expect(tiles.at(5, 15)).toBe(' '); expect(tiles.at(5, 12)).toBe(' ');
  });

  it('does not lose the underlying tile when an arrow is already on the new row', () => {
    const tiles = new ScreenTiles(); tiles.put(1, 2, '▶');
    const state: MenuCursorState = { topX: 1, topY: 2, item: 0, lastItem: 1,
      tileBehind: 'X', location: null };
    placeMenuCursor(tiles, state); expect(state.tileBehind).toBe('X');
    state.item = 1; placeMenuCursor(tiles, state); expect(tiles.at(1, 2)).toBe('X');
  });
});
