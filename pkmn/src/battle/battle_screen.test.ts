import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isHeld: () => false, isPressed: () => false, syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: () => true }));
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { textBgTransfer } from '../text/bg_transfer';
import { TextBox } from '../text/textbox';
import { renderBattleScreen } from './battle_screen_render';
import type { BattleRenderTiles, RawImage } from './battle_screen_render';
import { getMonsterPalette, getPaletteColors } from '../renderer/palettes';
import { dmgShadeMapping } from '../renderer/palette_shades';
import { HP_FILL_GLYPHS, HP_GLYPH, LEVEL_GLYPH, POKEBALL_GLYPH, TIME_COLON_GLYPH } from '../menus/menu_glyph_ids';
import { BATTLE_BG_ATTRIBUTES } from './battle_attributes';
import { BattleScreen, battleGlyphTile, battleHudTile } from './battle_screen';

beforeEach(() => { textBgTransfer.enabled = true; textBgTransfer.resetPortion(); });
afterEach(() => { textBgTransfer.enabled = true; textBgTransfer.resetPortion(); });

function drive(screen: BattleScreen, run: Generator<void>): number {
  let frames = 0;
  let step = run.next();
  while (!step.done) {
    frames++;
    screen.vblank();
    step = run.next();
  }
  return frames;
}

describe('BattleScreen model', () => {
  it('keeps a 32×32 background of spaces and shares the text thirds', () => {
    const screen = new BattleScreen();
    expect(screen.bgAt(0, 0)).toBe(' ');
    expect(screen.bgAt(31, 31)).toBe(' ');
    expect(screen.bgAt(32, 0)).toBeNull();
    screen.put(0, 0, 'A');
    screen.put(0, 5, 'E');
    screen.put(0, 6, 'B');
    screen.put(0, 12, 'C');
    expect(screen.vblank()).toBe(0);
    expect(screen.visibleAt(0, 0)).toBe('A');
    expect(screen.visibleAt(0, 5)).toBe('E');
    expect(screen.visibleAt(0, 6)).toBe(' ');
    expect(screen.visibleAt(0, 12)).toBe(' ');
    textBgTransfer.resetPortion();
    textBgTransfer.tick();
    screen.put(1, 6, 'D');
    expect(screen.vblank()).toBe(1);
    expect(screen.visibleAt(0, 0)).toBe('A');
    expect(screen.visibleAt(1, 6)).toBe('D');
    expect(screen.visibleAt(0, 12)).toBe(' ');
    screen.vblank();
    expect(screen.visibleAt(0, 12)).toBe('C');
    textBgTransfer.enabled = false;
    const portion = textBgTransfer.nextPortion;
    screen.put(2, 0, 'Z');
    expect(screen.vblank()).toBeNull();
    expect(screen.visibleAt(2, 0)).not.toBe('Z');
    expect(textBgTransfer.nextPortion).toBe(portion);
  });

  it('copies pictures and HUD tiles in floor(n/8)+1 frames, and in none with the LCD off', () => {
    const screen = new BattleScreen();
    const front = screen.copyFront('pikachu');
    let step = front.next();
    const filled: number[] = [];
    while (!step.done) {
      expect(textBgTransfer.enabled).toBe(false);
      screen.vblank();
      filled.push(Array.from({ length: 49 }, (_, index) => screen.frontSlot(index)).filter(Boolean).length);
      step = front.next();
    }
    expect(filled).toEqual([8, 16, 24, 32, 40, 48, 49]);
    expect(textBgTransfer.enabled).toBe(true);
    expect(screen.frontSlot(0)).toEqual({ picture: 'pikachu', tile: 0 });
    expect(screen.frontSlot(48)).toEqual({ picture: 'pikachu', tile: 48 });

    const hud = new BattleScreen();
    const load = hud.loadHudTilePatterns();
    const seen: string[] = [];
    let frame = load.next();
    while (!frame.done) {
      hud.vblank();
      seen.push(`${hud.hudSlot(0x6d)?.sheet ?? '-'}:${hud.hudSlot(0x6d)?.tile ?? '-'}`);
      frame = load.next();
    }
    expect(seen).toEqual(['-:-', 'extra:11', 'extra:11', 'extra:11', 'hud1:0', 'hud1:0']);
    for (let id = 0x62; id <= 0x7f; id++) expect(hud.hudSlot(id)).toEqual(battleHudTile(id));

    const off = new BattleScreen();
    off.lcdOn = false;
    expect(drive(off, off.copyBack('pidgey'))).toBe(0);
    expect(off.backSlot(0x31)).toEqual({ picture: 'pidgey', tile: 0 });
    expect(drive(off, off.loadHudTilePatterns())).toBe(0);
    expect(off.hudSlot(0x78)).toEqual({ sheet: 'hud3', tile: 2 });
  });

  it('holds two discarded frames, then three serviced ones; the LCD-off command waits for none', () => {
    const screen = new BattleScreen();
    screen.obp0 = 0xe4;
    screen.obp1 = 0x1b;
    const run = screen.setPalBattle({ partySpecies: 25, enemySpecies2: 0, playerBar: 0, enemyBar: 2 });
    expect(run.next()).toEqual({ done: false, value: 'held' });
    expect(screen.paletteName(0)).toBe('GREENBAR');
    expect(screen.paletteName(1)).toBe('REDBAR');
    expect(screen.paletteName(2)).toBe(getMonsterPalette(25));
    expect(screen.paletteName(3)).toBe('MEWMON');
    expect(screen.paletteHold).toBeGreaterThan(0);
    expect(() => screen.vblank()).toThrow(/SET_PAL_BATTLE hold/);
    expect(run.next()).toEqual({ done: false, value: 'held' });
    expect(() => screen.vblank()).toThrow(/SET_PAL_BATTLE hold/);
    screen.put(0, 0, 'A');
    for (let frame = 0; frame < 3; frame++) {
      expect(run.next()).toEqual({ done: false, value: 'serviced' });
      expect(screen.vblank()).toBe(frame);
    }
    expect(run.next()).toEqual({ done: true, value: undefined });
    expect(screen.visibleAt(0, 0)).toBe('A');
    const beforeObp = screen.objPalette(0).map(colour => [...colour]);
    screen.obp0 = 0;
    expect(screen.objPalette(0).map(colour => [...colour])).not.toEqual(beforeObp);
    expect(screen.objPalette(0)).toEqual(dmgShadeMapping(0).map(index => screen.bgPalette(0)[index]));
    const beforeObp1 = screen.objPalette(4).map(colour => [...colour]);
    screen.obp1 = 0xe4;
    expect(screen.objPalette(4).map(colour => [...colour])).not.toEqual(beforeObp1);

    const black = new BattleScreen();
    const dark = black.setPalBattleBlack();
    expect(dark.next().value).toBe('held');
    for (let slot = 0; slot < 4; slot++) expect(black.paletteName(slot)).toBe('PAL_BLACK');
    expect(black.bgPalette(0)[0]).toEqual([255, 255, 255]);
    expect(black.bgPalette(0)[1]).toEqual([25, 25, 25]);
    expect(black.bgPalette(0)[2]).toEqual([25, 25, 25]);
    expect(black.bgPalette(0)[3]).toEqual(getPaletteColors('PAL_BLACK')[3]);
    expect(black.bgPalette(0)[3]).toEqual([25, 25, 25]);

    const off = new BattleScreen();
    off.lcdOn = false;
    expect(off.setPalBattle({ partySpecies: 0, enemySpecies2: 16, playerBar: 1, enemyBar: 1 }).next().done).toBe(true);
    expect(off.paletteName(1)).toBe('YELLOWBAR');
    expect(off.paletteName(2)).toBe('MEWMON');
    expect(off.paletteHold).toBe(0);
    expect(() => off.vblank()).not.toThrow();
    for (let slot = 0; slot < 4; slot++) {
      expect(off.objPalette(slot)).toEqual(dmgShadeMapping(off.obp0).map(index => off.bgPalette(slot)[index]));
      expect(off.objPalette(slot + 4)).toEqual(dmgShadeMapping(off.obp1).map(index => off.bgPalette(slot)[index]));
    }
  });

  it('resolves only the HP and LV glyphs, and keeps OAM pending until DMA', () => {
    expect(battleGlyphTile(LEVEL_GLYPH)).toBe(0x6e);
    expect(battleGlyphTile(HP_GLYPH)).toBe(0x71);
    expect(battleGlyphTile(HP_FILL_GLYPHS[0])).toBe(0x63);
    expect(battleGlyphTile(HP_FILL_GLYPHS[8])).toBe(0x6b);
    expect(battleGlyphTile('A')).toBe(0x80);
    expect(['┌', '─', '┐', '│', '└', '┘'].map(battleGlyphTile)).toEqual([0x79, 0x7a, 0x7b, 0x7c, 0x7d, 0x7e]);
    expect(() => battleGlyphTile(POKEBALL_GLYPH)).toThrow(/not a battle tile/);
    expect(() => battleGlyphTile(TIME_COLON_GLYPH)).toThrow(/not a battle tile/);
    const screen = new BattleScreen();
    screen.setOam(0, { y: 16, x: 8, tile: 4, attributes: 0x20 });
    expect(screen.oam(0)).toEqual({ y: 0, x: 0, tile: 0, attributes: 0 });
    screen.vblank();
    expect(screen.oam(0)).toEqual({ y: 16, x: 8, tile: 4, attributes: 0x20 });
  });

  it('matches the visible attribute map, including the blank columns', () => {
    expect(BATTLE_BG_ATTRIBUTES).toHaveLength(18 * 32);
    const at = (column: number, row: number) => BATTLE_BG_ATTRIBUTES[row * 32 + column];
    expect(at(0, 0)).toBe(0); expect(at(1, 0)).toBe(1); expect(at(10, 0)).toBe(1); expect(at(11, 0)).toBe(3);
    expect(at(0, 4)).toBe(2); expect(at(8, 4)).toBe(2); expect(at(9, 4)).toBe(0); expect(at(11, 4)).toBe(3);
    expect(at(0, 7)).toBe(2); expect(at(9, 7)).toBe(0); expect(at(11, 7)).toBe(0); expect(at(19, 11)).toBe(0);
    expect(at(0, 12)).toBe(2); expect(at(19, 17)).toBe(2);
    for (let row = 0; row < 18; row++) for (let column = 20; column < 32; column++) expect(at(column, row)).toBe(0);
  });

  it('prints a two-line PrintText on the battle border, and only the bottom third shows it', () => {
    const screen = new BattleScreen();
    screen.lcdOn = false;
    screen.loadHudTilePatterns().next();
    screen.lcdOn = true;
    const box = new TextBox();
    box.printStandalone({ text: 'HI<LINE>YO' }, { noDelay: true });
    const third = () => screen.vblank(box, true);
    expect(third()).toBe(0);
    expect(third()).toBe(1);
    expect(screen.visibleAt(0, 12)).toBe(' ');
    expect(third()).toBe(2);
    expect(battleGlyphTile(String(screen.visibleAt(0, 12)))).toBe(0x79);
    expect(battleGlyphTile(String(screen.visibleAt(1, 12)))).toBe(0x7a);
    expect(battleGlyphTile(String(screen.visibleAt(19, 12)))).toBe(0x7b);
    expect(battleGlyphTile(String(screen.visibleAt(0, 13)))).toBe(0x7c);
    expect(battleGlyphTile(String(screen.visibleAt(0, 17)))).toBe(0x7d);
    expect(battleGlyphTile(String(screen.visibleAt(19, 17)))).toBe(0x7e);
    expect(screen.visibleAt(1, 14)).toBe(' ');
    expect(screen.at(1, 14)).toBe('H');
    expect(screen.at(2, 14)).toBe('I');
    expect(screen.at(1, 16)).toBe('Y');
    expect(screen.at(2, 16)).toBe('O');
    expect(third()).toBe(0);
    expect(third()).toBe(1);
    expect(screen.visibleAt(1, 14)).toBe(' ');
    expect(third()).toBe(2);
    expect(screen.visibleAt(1, 14)).toBe('H');
    expect(screen.visibleAt(1, 16)).toBe('Y');
    const extra = PNG.sync.read(readFileSync(resolve(__dirname, '../../static/gfx/font/font_battle_extra.png')));
    const sheet: RawImage = { width: extra.width, height: extra.height, data: extra.data };
    const blank = new Uint8ClampedArray(8 * 8 * 4);
    blank.fill(255);
    const tiles: BattleRenderTiles = {
      font: sheet, extra: sheet, hud1: { width: 8, height: 8, data: blank },
      hud2: { width: 8, height: 8, data: blank }, hud3: { width: 8, height: 8, data: blank },
      pictures: new Map(), sprites: { width: 8, height: 8, data: blank },
    };
    const buffer = renderBattleScreen(screen, tiles);
    const across = extra.width >> 3;
    const gray = extra.data[(Math.floor(23 / across) * 8 * extra.width + (23 % across) * 8) * 4];
    const index = gray >= 192 ? 0 : gray >= 128 ? 1 : gray >= 64 ? 2 : 3;
    const colour = [...screen.bgPalette(2)[index], 255];
    const at = (0 * 160 + 0) * 4;
    expect([buffer[at], buffer[at + 1], buffer[at + 2], buffer[at + 3]]).toEqual(colour);
  });
});
