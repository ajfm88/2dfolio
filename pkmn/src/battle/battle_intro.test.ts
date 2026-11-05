import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { textBgTransfer } from '../text/bg_transfer';
import { BattleScreen, battleHudTile } from './battle_screen';
import { prepareSilhouetteBackground } from './battle_intro';

beforeEach(() => { textBgTransfer.enabled = true; textBgTransfer.resetPortion(); });
afterEach(() => { textBgTransfer.enabled = true; textBgTransfer.resetPortion(); });

function stage(screen: BattleScreen): void {
  // No driver or automatic VBlank: the LCD-off transaction must complete on prime.
  expect(prepareSilhouetteBackground(screen).next()).toEqual({ value: undefined, done: true });
}

describe('A5e silhouette background staging, unused', () => {
  it('copies all360 working cells without changing them, including the caller-cleared head', () => {
    const screen = new BattleScreen();
    for (let y = 0; y < 18; y++) for (let x = 0; x < 20; x++) screen.put(x, y, 0x80 + (y * 20 + x) % 64);
    for (let y = 5; y < 8; y++) for (let x = 1; x < 8; x++) screen.put(x, y, ' ');
    const before = screen.cells;
    screen.lcdOn = false;
    stage(screen);
    for (let y = 0; y < 18; y++) for (let x = 0; x < 20; x++) {
      const expected = before[y * 20 + x];
      expect(screen.at(x, y), `working ${x},${y}`).toBe(expected);
      expect(screen.bgAt(x, y), `BG0 ${x},${y}`).toBe(expected);
    }
  });

  it('clears every offscreen BG0 cell, including column31 and row31', () => {
    const screen = new BattleScreen();
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) screen.putBg(x, y, 9);
    screen.put(19, 17, 'Z');
    screen.lcdOn = false;
    stage(screen);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      if (x >= 20 || y >= 18) expect(screen.bgAt(x, y), `offscreen ${x},${y}`).toBe(' ');
    }
    expect(screen.bgAt(19, 17)).toBe('Z');
  });

  it('uses a 32-column BG0 stride, preserves the window and freezes a separate copy', () => {
    const screen = new BattleScreen();
    screen.put(19, 0, 'A'); screen.put(0, 1, 'B'); screen.put(19, 17, 'C');
    screen.vblank(); screen.vblank(); screen.vblank();
    const shown = screen.visibleCells;
    screen.lcdOn = false;
    stage(screen);
    expect(screen.bgAt(19, 0)).toBe('A'); expect(screen.bgAt(20, 0)).toBe(' ');
    expect(screen.bgAt(31, 0)).toBe(' '); expect(screen.bgAt(0, 1)).toBe('B');
    expect(screen.bgAt(19, 17)).toBe('C'); expect(screen.visibleCells).toEqual(shown);
    screen.put(0, 1, 'D');
    expect(screen.bgAt(0, 1)).toBe('B');
  });

  it('loads the full battle HUD at LCD off with no pending video transfer', () => {
    const screen = new BattleScreen();
    expect(() => prepareSilhouetteBackground(screen).next()).toThrow('silhouette background requires LCD off');
    screen.lcdOn = false;
    stage(screen);
    for (let tile = 0x62; tile <= 0x7f; tile++) expect(screen.hudSlot(tile)).toEqual(battleHudTile(tile));
    expect(screen.lcdOn).toBe(false);
    // A subsequent real copy can start, so staging left no suspended VRAM queue.
    screen.lcdOn = true;
    const copy = screen.copyFront('probe');
    expect(copy.next().done).toBe(false);
    copy.return(undefined);
  });

  it('preserves transfer enable, phase and destination without advancing VBlank', () => {
    for (const enabled of [false, true]) {
      const screen = new BattleScreen();
      textBgTransfer.resetPortion(); textBgTransfer.enabled = true; textBgTransfer.tick();
      textBgTransfer.enabled = enabled;
      screen.transferDestination = 0x98;
      screen.lcdOn = false;
      stage(screen);
      expect([textBgTransfer.enabled, textBgTransfer.nextPortion, screen.transferDestination]).toEqual([enabled, 1, 0x98]);
    }
  });

  it('retains shown and shadow head OAM, pictures, palette and scroll registers', () => {
    const screen = new BattleScreen();
    screen.lcdOn = false;
    screen.copyFront('enemy').next(); screen.copyBack('redb').next(); screen.copySpritePicture('redb').next();
    screen.lcdOn = true;
    for (let i = 0; i < 21; i++) screen.setOam(i, { y: 0x38 + i % 3 * 8, x: 0xa0 + Math.floor(i / 3) * 8, tile: Math.floor(i / 3) * 7 + i % 3, attributes: 2 });
    screen.vblank();
    screen.setOam(0, { ...screen.shadowOam(0), x: 158 });
    const shown = Array.from({ length: 40 }, (_, i) => screen.oam(i));
    const shadow = Array.from({ length: 40 }, (_, i) => screen.shadowOam(i));
    screen.bgp = 3; screen.obp0 = 4; screen.obp1 = 5; screen.scx = 6; screen.scy = 7;
    screen.scxSplit = 8; screen.wy = 9; screen.wx = 10;
    screen.lcdOn = false;
    stage(screen);
    expect(Array.from({ length: 40 }, (_, i) => screen.oam(i))).toEqual(shown);
    expect(Array.from({ length: 40 }, (_, i) => screen.shadowOam(i))).toEqual(shadow);
    expect([screen.frontSlot(48), screen.backSlot(0x61), screen.spriteSlot(48)]).toEqual([
      { picture: 'enemy', tile: 48 }, { picture: 'redb', tile: 48 }, { picture: 'redb', tile: 48 },
    ]);
    expect([screen.bgp, screen.obp0, screen.obp1, screen.scx, screen.scy, screen.scxSplit, screen.wy, screen.wx]).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
