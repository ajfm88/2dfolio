import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { textBgTransfer } from '../text/bg_transfer';
import { installNodeImageData } from '../rom/node_image_data';
import { LEVEL_GLYPH, POKEBALL_GLYPH, TIME_COLON_GLYPH } from '../menus/menu_glyph_ids';
import { BattleScreen } from './battle_screen';
import { presentBattleScreen, renderBattleScreen } from './battle_screen_render';
import type { BattleRenderTiles, RawImage } from './battle_screen_render';

const putImageData = vi.hoisted(() => vi.fn());
vi.mock('../renderer', () => ({ getCtx: () => ({ putImageData }) }));

beforeAll(() => installNodeImageData());
beforeEach(() => { textBgTransfer.enabled = true; textBgTransfer.resetPortion(); putImageData.mockClear(); });
afterEach(() => { textBgTransfer.enabled = true; textBgTransfer.resetPortion(); });

function png(name: string): RawImage {
  const image = PNG.sync.read(readFileSync(resolve(__dirname, '../../static/gfx', name)));
  return { width: image.width, height: image.height, data: image.data };
}
function solid(width: number, height: number, gray: number): { width: number; height: number; data: Uint8ClampedArray } {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset] = data[offset + 1] = data[offset + 2] = gray;
    data[offset + 3] = 255;
  }
  return { width, height, data };
}
function load(screen: BattleScreen, picture: RawImage): BattleRenderTiles {
  screen.lcdOn = false;
  screen.copyFront('mon').next();
  screen.copyBack('back').next();
  screen.loadHudTilePatterns().next();
  screen.lcdOn = true;
  const tiles: BattleRenderTiles = {
    font: png('font/font.png'), extra: png('font/font_battle_extra.png'),
    hud1: png('battle/battle_hud_1.png'), hud2: png('battle/battle_hud_2.png'), hud3: png('battle/battle_hud_3.png'),
    pictures: new Map([['mon', picture], ['back', picture]]), sprites: solid(8, 8, 255),
  };
  return tiles;
}
function pixel(buffer: Uint8ClampedArray, x: number, y: number): number[] {
  const at = (y * 160 + x) * 4;
  return [buffer[at], buffer[at + 1], buffer[at + 2], buffer[at + 3]];
}
function colour(screen: BattleScreen, slot: number, index: number): number[] {
  return [...screen.bgPalette(slot)[index], 255];
}

describe('battle screen renderer', () => {
  it('paints one pixel of each attribute slot, then BGP, without baking BGP into the stored palette', () => {
    const screen = new BattleScreen();
    const tiles = load(screen, solid(56, 56, 85));
    screen.obp0 = 0xe4;
    screen.obp1 = 0xe4;
    const run = screen.setPalBattle({ partySpecies: 25, enemySpecies2: 1, playerBar: 0, enemyBar: 2 });
    while (!run.next().done) { /* colours are already installed; discard the waits */ }
    screen.put(0, 0, 0); screen.put(1, 0, 0); screen.put(11, 0, 0); screen.put(0, 4, 0);
    const samples = [[0, 0, 0], [8, 0, 1], [0, 32, 2], [88, 0, 3]] as const;
    screen.vblank(); screen.vblank(); screen.vblank();
    let buffer = renderBattleScreen(screen, tiles);
    for (const [x, y, slot] of samples) expect(pixel(buffer, x, y), `${x},${y} slot ${slot}`).toEqual(colour(screen, slot, 2));
    const distinct = new Set(samples.map(([, , slot]) => screen.bgPalette(slot)[2].join()));
    expect(distinct.size).toBe(4);
    screen.bgp = 0;
    buffer = renderBattleScreen(screen, tiles);
    expect(pixel(buffer, 0, 0)).toEqual(colour(screen, 0, 0));
    expect(screen.bgPalette(0)[2]).not.toEqual(screen.bgPalette(0)[0]);
  });

  it('draws both glyph spellings from the battle sheets, and rejects the other menus aliases', () => {
    const extra = png('font/font_battle_extra.png');
    expect(extra.width).toBe(120);
    const screen = new BattleScreen();
    const tiles = load(screen, solid(56, 56, 255));
    const run = screen.setPalBattle({ partySpecies: 0, enemySpecies2: 0, playerBar: 0, enemyBar: 0 });
    while (!run.next().done) { /* colours only */ }
    screen.put(0, 0, LEVEL_GLYPH);
    screen.put(1, 0, 0x6e);
    screen.put(2, 0, 0x71);
    screen.vblank(); screen.vblank(); screen.vblank();
    const buffer = renderBattleScreen(screen, tiles);
    expect(pixel(buffer, 0, 0)).toEqual(pixel(buffer, 8, 0));
    const across = extra.width >> 3;
    const gray = extra.data[(Math.floor(15 / across) * 8 * extra.width + (15 % across) * 8) * 4];
    const index = gray >= 192 ? 0 : gray >= 128 ? 1 : gray >= 64 ? 2 : 3;
    expect(pixel(buffer, 16, 0)).toEqual(colour(screen, 0, index));
    screen.put(3, 0, POKEBALL_GLYPH);
    screen.vblank();
    expect(() => renderBattleScreen(screen, tiles)).toThrow(/not a battle tile/);
    screen.put(3, 0, TIME_COLON_GLYPH);
    screen.vblank();
    expect(() => renderBattleScreen(screen, tiles)).toThrow(/not a battle tile/);
  });

  it('wraps the background at 256px and switches SCX on lines 64 and 96', () => {
    const screen = new BattleScreen();
    const tiles = load(screen, solid(56, 56, 0));
    screen.wy = 0x90;
    for (let row = 0; row < 32; row++) {
      screen.putBg(31, row, 0); screen.putBg(0, row, ' '); screen.putBg(1, row, ' ');
    }
    screen.scx = 248;
    const wrapped = renderBattleScreen(screen, tiles);
    expect(pixel(wrapped, 0, 0)).toEqual(colour(screen, 0, 3));
    expect(pixel(wrapped, 8, 0)).toEqual(colour(screen, 0, 0));
    screen.scx = 0;
    screen.scxSplit = 8;
    for (let row = 0; row < 32; row++) screen.putBg(0, row, 0);
    const split = renderBattleScreen(screen, tiles);
    expect(pixel(split, 0, 63)).toEqual(colour(screen, 0, 3));
    expect(pixel(split, 0, 64)).toEqual(colour(screen, 0, 0));
    expect(pixel(split, 0, 95)).toEqual(colour(screen, 0, 0));
    expect(pixel(split, 0, 96)).toEqual(colour(screen, 0, 3));
    screen.scy = 4;
    screen.scx = 8;
    screen.scxSplit = 0;
    const zeroSplit = renderBattleScreen(screen, tiles);
    expect(pixel(zeroSplit, 0, 63)).toEqual(colour(screen, 0, 0));
    expect(pixel(zeroSplit, 0, 64)).toEqual(colour(screen, 0, 3));
  });

  it('splits a band that crosses a window at wy 4', () => {
    const screen = new BattleScreen();
    const tiles = load(screen, solid(56, 56, 0));
    for (let column = 0; column < 32; column++) screen.putBg(column, 0, 0);
    screen.wx = 7;
    screen.wy = 4;
    screen.scx = 0;
    screen.scy = 0;
    screen.scxSplit = null;
    const buffer = renderBattleScreen(screen, tiles);
    expect(pixel(buffer, 0, 3)).toEqual(colour(screen, 0, 3));
    expect(pixel(buffer, 0, 4)).toEqual(colour(screen, 0, 0));
  });

  it('keeps sprite colour 0 transparent, flips, honours priority and the eight OBJ palettes', () => {
    const screen = new BattleScreen();
    const picture = solid(56, 56, 0);
    const tiles = load(screen, picture);
    const sprite = solid(8, 8, 255);
    sprite.data[0] = sprite.data[1] = sprite.data[2] = 85;
    tiles.sprites = sprite;
    screen.obp0 = 0xe5;
    screen.obp1 = 0;
    const run = screen.setPalBattle({ partySpecies: 0, enemySpecies2: 0, playerBar: 0, enemyBar: 1 });
    while (!run.next().done) { /* install */ }
    screen.bgp = 0xe0;
    const bg = solid(56, 56, 170);
    tiles.pictures = new Map([['mon', bg], ['back', bg]]);
    screen.put(0, 0, 0);
    screen.vblank(); screen.vblank(); screen.vblank();
    screen.setOam(0, { y: 16, x: 8, tile: 0, attributes: 0 });
    screen.setOam(1, { y: 16, x: 16, tile: 0, attributes: 4 });
    screen.vblank();
    let buffer = renderBattleScreen(screen, tiles);
    expect(pixel(buffer, 0, 0)).toEqual([...screen.objPalette(0)[2], 255]);
    expect(pixel(buffer, 1, 0)).toEqual(colour(screen, 0, 0));
    expect(pixel(buffer, 8, 0)).toEqual([...screen.objPalette(4)[2], 255]);
    expect(screen.objPalette(0)[2]).not.toEqual(screen.objPalette(4)[2]);
    expect(pixel(buffer, 0, 0)).not.toEqual(colour(screen, 0, 3));

    screen.setOam(0, { y: 16, x: 8, tile: 0, attributes: 0x20 });
    screen.vblank();
    buffer = renderBattleScreen(screen, tiles);
    expect(pixel(buffer, 0, 0)).toEqual(colour(screen, 0, 0));
    expect(pixel(buffer, 7, 0)).toEqual([...screen.objPalette(0)[2], 255]);

    screen.setOam(0, { y: 16, x: 8, tile: 0, attributes: 0x80 });
    screen.setOam(1, { y: 0, x: 0, tile: 0, attributes: 0 });
    screen.vblank();
    buffer = renderBattleScreen(screen, tiles);
    expect(pixel(buffer, 0, 0)).toEqual(colour(screen, 0, 0));
    screen.setOam(0, { y: 16, x: 8, tile: 0, attributes: 0 });
    screen.vblank();
    const over = renderBattleScreen(screen, tiles);
    expect(pixel(over, 0, 0)).toEqual([...screen.objPalette(0)[2], 255]);

    screen.setOam(0, { y: 24, x: 8, tile: 0, attributes: 1 });
    screen.setOam(2, { y: 24, x: 8, tile: 0, attributes: 0 });
    screen.vblank();
    const order = renderBattleScreen(screen, tiles);
    expect(pixel(order, 0, 8)).toEqual([...screen.objPalette(1)[2], 255]);
    screen.setOam(0, { y: 16, x: 8, tile: 0, attributes: 0 });
    screen.vblank();
    const before = pixel(renderBattleScreen(screen, tiles), 0, 0);
    screen.obp0 = 0;
    const afterObp0 = renderBattleScreen(screen, tiles);
    expect(pixel(afterObp0, 0, 0)).not.toEqual(before);
    screen.setOam(0, { y: 16, x: 8, tile: 0, attributes: 4 });
    screen.vblank();
    const mid = pixel(renderBattleScreen(screen, tiles), 0, 0);
    screen.obp1 = 0xe4;
    expect(pixel(renderBattleScreen(screen, tiles), 0, 0)).not.toEqual(mid);
  });

  it('renders a cached frame in under a millisecond and presents it with putImageData', () => {
    const screen = new BattleScreen();
    const tiles = load(screen, solid(56, 56, 85));
    for (let index = 0; index < 20 * 18; index++) screen.put(index % 20, Math.floor(index / 20), 0x80 + (index % 26));
    screen.vblank(); screen.vblank(); screen.vblank();
    renderBattleScreen(screen, tiles);
    const start = performance.now();
    const buffer = renderBattleScreen(screen, tiles);
    const elapsed = performance.now() - start;
    expect(buffer).toHaveLength(160 * 144 * 4);
    expect(elapsed).toBeLessThan(1);
    presentBattleScreen(screen, tiles);
    expect(putImageData).toHaveBeenCalledOnce();
    const image = putImageData.mock.calls[0][0] as ImageData;
    expect(image.width).toBe(160);
    expect(image.height).toBe(144);
    expect(putImageData.mock.calls[0][1]).toBe(0);
    expect(putImageData.mock.calls[0][2]).toBe(0);
  });
});
