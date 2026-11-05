import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../renderer', () => ({ getCtx: vi.fn(), getScale: () => 1 }));
import { textBgTransfer } from '../text/bg_transfer';
import { BATTLE_BG_ATTRIBUTES } from './battle_attributes';
import { BattleScreen } from './battle_screen';
import { renderBattleScreen, type BattleRenderTiles, type RawImage } from './battle_screen_render';

beforeEach(() => { textBgTransfer.enabled = true; textBgTransfer.resetPortion(); });
afterEach(() => { textBgTransfer.enabled = true; textBgTransfer.resetPortion(); });

// Deliberately patterned synthetic glyphs: source tile, row and sub-tile pixel all matter.
const shades = [255, 170, 85, 0];
function font(): RawImage {
  const data = new Uint8ClampedArray(128 * 32 * 4);
  for (let tile = 0; tile < 64; tile++) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const offset = ((Math.floor(tile / 16) * 8 + y) * 128 + tile % 16 * 8 + x) * 4;
    data[offset] = data[offset + 1] = data[offset + 2] = shades[(tile + x * 3 + y * 2) % 4];
    data[offset + 3] = 255;
  }
  return { width: 128, height: 32, data };
}
const white: RawImage = { width: 8, height: 8, data: new Uint8ClampedArray(8 * 8 * 4).fill(255) };
function rig() {
  const screen = new BattleScreen();
  screen.lcdOn = false;
  expect(screen.setPalBattle({ partySpecies: 25, enemySpecies2: 1, playerBar: 0, enemyBar: 2 }).next().done).toBe(true);
  screen.lcdOn = true;
  for (let y = 0; y < 18; y++) for (let x = 0; x < 20; x++) screen.put(x, y, 0x80 + (x * 7 + y * 5 + 2) % 64);
  screen.vblank(); screen.vblank(); screen.vblank();
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) screen.putBg(x, y, 0x80 + (x * 5 + y * 3) % 64);
  screen.wy = 144;
  const tiles: BattleRenderTiles = { font: font(), extra: white, hud1: white, hud2: white, hud3: white,
    sprites: white, pictures: new Map() };
  return { screen, tiles };
}
function pixel(pixels: Uint8ClampedArray, x: number, y: number): number[] {
  return Array.from(pixels.slice((y * 160 + x) * 4, (y * 160 + x) * 4 + 4));
}
// Independent source-coordinate oracle, rather than another renderer or a snapshot hash.
function expected(screen: BattleScreen, x: number, y: number, window = false): number[] {
  const column = x >> 3, row = y >> 3;
  const tile = window ? (column * 7 + row * 5 + 2) % 64 : (column * 5 + row * 3) % 64;
  const raw = (tile + (x & 7) * 3 + (y & 7) * 2) % 4;
  return [...screen.bgPalette(BATTLE_BG_ATTRIBUTES[row * 32 + column] ?? 0)[raw], 255];
}
function assertBands(screen: BattleScreen, tiles: BattleRenderTiles, offsets: readonly [number, number, number]): void {
  const pixels = renderBattleScreen(screen, tiles);
  // Sample both sides of every boundary and tile/sub-tile/wrap positions in each band.
  for (const y of [0, 7, 63, 64, 65, 71, 95, 96, 97, 103, 143]) {
    const offset = y < 64 ? offsets[0] : y < 96 ? offsets[1] : offsets[2];
    for (const x of [0, 1, 7, 8, 87, 88, 151, 159]) {
      expect(pixel(pixels, x, y), `BG sample ${x},${y}`).toEqual(expected(screen, (x + offset) & 255, (y + screen.scy) & 255));
    }
  }
}

describe('A5e checkpoint-03a: three-band battle scanout', () => {
  it('defaults the lower override to null and retains the existing two-band behavior', () => {
    const { screen, tiles } = rig();
    expect(screen.scxAfterSplit).toBeNull();
    screen.scx = 8; screen.scxSplit = 16;
    assertBands(screen, tiles, [8, 16, 8]);
  });
  it('draws distinct top, body and lower SCX bands through the aligned tile path', () => {
    const { screen, tiles } = rig();
    screen.scx = 8; screen.scxSplit = 16; screen.scxAfterSplit = 24;
    assertBands(screen, tiles, [8, 16, 24]);
  });
  it('draws all three bands through the pixel path, with sub-tile SCX and SCY', () => {
    const { screen, tiles } = rig();
    screen.scx = 3; screen.scxSplit = 13; screen.scxAfterSplit = 21; screen.scy = 3;
    assertBands(screen, tiles, [3, 13, 21]);
  });
  it('accepts zero as a real body and lower override instead of falling back to SCX', () => {
    const { screen, tiles } = rig();
    screen.scx = 8; screen.scxSplit = 0; screen.scxAfterSplit = 0;
    assertBands(screen, tiles, [8, 0, 0]);
  });
  it('ignores a retained lower override when the split is disabled', () => {
    const { screen, tiles } = rig();
    screen.scx = 8; screen.scxSplit = null; screen.scxAfterSplit = 24;
    assertBands(screen, tiles, [8, 8, 8]);
  });
  it('wraps each band at 256 pixels and uses the scrolled source attribute cell', () => {
    const { screen, tiles } = rig();
    screen.scx = 248; screen.scxSplit = 240; screen.scxAfterSplit = 232;
    assertBands(screen, tiles, [248, 240, 232]);
  });
  it('keeps the window independent of all three BG scroll bands', () => {
    const { screen, tiles } = rig();
    screen.scx = 3; screen.scxSplit = 13; screen.scxAfterSplit = 21;
    screen.wx = 15; screen.wy = 60;
    const pixels = renderBattleScreen(screen, tiles);
    for (const y of [60, 63, 64, 95, 96, 143]) {
      const offset = y < 64 ? 3 : y < 96 ? 13 : 21;
      expect(pixel(pixels, 7, y)).toEqual(expected(screen, (7 + offset) & 255, y));
      for (const x of [8, 9, 15, 88, 159]) expect(pixel(pixels, x, y)).toEqual(expected(screen, x - 8, y - 60, true));
    }
  });
  it('does not advance transfers, copy shadow OAM or mutate scanout while rendering', () => {
    const { screen, tiles } = rig();
    screen.scx = 8; screen.scxSplit = 16; screen.scxAfterSplit = 24;
    screen.setOam(0, { y: 16, x: 8, tile: 0, attributes: 2 });
    screen.put(0, 0, 0xbf);
    textBgTransfer.tick(); textBgTransfer.enabled = false;
    const cells = screen.cells, visible = screen.visibleCells;
    const bg = Array.from({ length: 32 * 32 }, (_, i) => screen.bgAt(i % 32, Math.floor(i / 32)));
    const before = [screen.oam(0), screen.shadowOam(0), textBgTransfer.nextPortion, textBgTransfer.enabled,
      screen.scx, screen.scxSplit, screen.scxAfterSplit, screen.scy, screen.wx, screen.wy];
    const first = renderBattleScreen(screen, tiles), second = renderBattleScreen(screen, tiles);
    expect(second).toEqual(first);
    expect(screen.cells).toEqual(cells); expect(screen.visibleCells).toEqual(visible);
    expect(Array.from({ length: 32 * 32 }, (_, i) => screen.bgAt(i % 32, Math.floor(i / 32)))).toEqual(bg);
    expect([screen.oam(0), screen.shadowOam(0), textBgTransfer.nextPortion, textBgTransfer.enabled,
      screen.scx, screen.scxSplit, screen.scxAfterSplit, screen.scy, screen.wx, screen.wy]).toEqual(before);
  });
});
