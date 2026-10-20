import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { RasterCanvas } from '../test/raster_canvas';
import { installNodeImageData } from '../rom/node_image_data';
import { initRenderer, getCtx, getScale, setActivePalette, loadTileset, drawSprite, beginSpriteLog, endSpriteLog, captureNative } from '../renderer';
import { injectRawImage } from '../renderer/renderer';
import { getPaletteColors } from '../renderer/palettes';
import { uiTiles } from '../renderer/ui_tiles';
import { textBgTransfer } from '../text/bg_transfer';
import { GameMap } from './map';
import { captureTransitionMap, captureTransitionScene, renderTransitionScreen } from './transition_screen_render';
import type { TransitionActor, TransitionCapture } from './transition_screen_render';
import { TransitionScreen, TRANSITION_BLACK as FF } from './transition_screen';
import { transitionPrologue } from './battle_transition';

const palette = getPaletteColors('PALLET');
let output: RasterCanvas;
beforeAll(installNodeImageData);
beforeEach(() => {
  output = new RasterCanvas();
  vi.stubGlobal('document', { createElement: () => new RasterCanvas(), getElementById: (id: string) => id === 'screen' ? output : null });
  vi.stubGlobal('window', { innerWidth: 480, innerHeight: 432, addEventListener: vi.fn() });
  initRenderer(); setActivePalette('PALLET'); uiTiles.clear(); textBgTransfer.enabled = true; textBgTransfer.resetPortion();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); uiTiles.clear(); });
const pixel = (x: number, y: number) => [...output.pixel(x, y)];
const colour = (index: number) => [...palette[index], 255];

function view(): HTMLCanvasElement {
  const canvas = new RasterCanvas(); canvas.width = 160; canvas.height = 144;
  for (let y = 0; y < 144; y++) for (let x = 0; x < 160; x++) {
    const index = (Math.floor(x / 8) + Math.floor(y / 8) * 20) % 4;
    canvas.pixels.set(colour(index), (y * 160 + x) * 4);
  }
  return canvas.asCanvas();
}
function actor(slot: number, x = slot * 18, y = 30, visible = true, register: 'obp0' | 'obp1' = 'obp0') {
  const raw = new Uint8ClampedArray(16 * 32 * 4);
  for (let py = 0; py < 32; py++) for (let px = 0; px < 16; px++) {
    const index = py < 16 ? 3 : px % 4;
    const gray = 255 - index * 85; raw.set([gray, gray, gray, 255], (py * 16 + px) * 4);
  }
  const sheet = new RasterCanvas(); sheet.width = 16; sheet.height = 32;
  const result = { data: { textId: slot }, rawSheet: new ImageData(raw, 16, 32), objectPalette: register,
    x, y, visible, flip: false, render(_cx: number, _cy: number) {
      if (this.visible) drawSprite(sheet.asCanvas(), 0, 16, this.x, this.y, this.flip);
    } };
  return result;
}
function scene(actors: { player: TransitionActor; npcs: ReturnType<typeof actor>[]; pikachu?: TransitionActor }, objectCount = 0): TransitionCapture {
  const map = { render: vi.fn(() => { getCtx().drawImage(view(), 0, 0); }) };
  return captureTransitionScene(map, 0, 0, actors, objectCount);
}

it('fills filtered ROM slots as hidden while keeping later unused slots zero-filled', () => {
  const capture = scene({ player: actor(0), npcs: [actor(1), actor(3)], pikachu: actor(15) }, 3);
  expect(capture.slots).toEqual([0, 1, 2, 3, 15].map(slot => ({ slot, occupied: true, visible: slot !== 2 })));
  for (const [index, survivors] of [[3, [0, 3]], [4, [0, 15]], [5, [0]]] as const) {
    const screen = new TransitionScreen(capture.slots, index), program = transitionPrologue(screen); program.next();
    for (let tick = 1; tick <= 5; tick++) { screen.vblank(); program.next(); }
    expect(screen.visibleSprites).toEqual(survivors);
  }
});

it('captures the actual map layer at 160×144, preserving the main surface, UI coverage and renderer target', async () => {
  const base = resolve(__dirname, '../../static');
  const png = PNG.sync.read(readFileSync(resolve(base, 'gfx/tilesets/overworld.png')));
  injectRawImage('/gfx/tilesets/overworld.png', new ImageData(new Uint8ClampedArray(png.data), png.width, png.height));
  const map = new GameMap();
  map.mapData = JSON.parse(readFileSync(resolve(base, 'maps/PalletTown.json'), 'utf8'));
  map.blockset = JSON.parse(readFileSync(resolve(base, 'blockset_overworld.json'), 'utf8'));
  map.tileset = await loadTileset('/gfx/tilesets/overworld.png');
  output.pixels.fill(19); uiTiles.cover(0, 0, 160, 144); // existing text/debug/toast pixels must not leak into capture
  const before = output.pixels.slice(), context = getCtx();
  const captured = captureTransitionMap(map, 80, 100) as unknown as RasterCanvas;
  expect([captured.width, captured.height]).toEqual([160, 144]);
  expect(Buffer.from(output.pixels).equals(Buffer.from(before)), 'map capture must preserve every live-surface byte').toBe(true);
  expect(getCtx()).toBe(context); expect(getScale()).toBe(1);
  expect(uiTiles.tileAt(2, 3)).toBe(0x60);
  const expected = new Uint8ClampedArray(160 * 144 * 4);
  for (let y = 0; y < 144; y++) for (let x = 0; x < 160; x++) {
    const tx = Math.floor((x + 80) / 8), ty = Math.floor((y + 100) / 8), id = map.getTileAt(tx, ty);
    const sx = id % 16 * 8 + (x + 80) % 8, sy = Math.floor(id / 16) * 8 + (y + 100) % 8;
    const shade = (255 - png.data[(sy * png.width + sx) * 4]) / 85;
    expected.set(colour(shade), (y * 160 + x) * 4);
  }
  expect(Buffer.from(captured.pixels).equals(Buffer.from(expected))).toBe(true);
});

it('native capture restores its context on failure and preserves an outer sprite log', () => {
  const previous = getCtx();
  expect(() => captureNative(() => { throw new Error('capture failed'); })).toThrow('capture failed');
  expect(getCtx()).toBe(previous); expect(getScale()).toBe(1);
  beginSpriteLog();
  const player = actor(0), npc = actor(1);
  scene({ player, npcs: [npc] });
  player.render(0, 0);
  expect(endSpriteLog().map(draw => draw.destX)).toEqual([player.x]);
});

it('captures every sprite by cartridge slot, freezes raw pixels/frame/facing/offsets, and keeps the old-man survivor', () => {
  const player = actor(0), npcs = Array.from({ length: 8 }, (_, i) => actor(i + 1, (i + 1) * 10, 60, [4, 8].includes(i + 1)));
  npcs[7].flip = true;
  const capture = scene({ player, npcs: [...npcs].reverse(), pikachu: actor(15, 60, 80) });
  expect(capture.slots.filter(slot => slot.visible).map(slot => slot.slot)).toEqual([0, 4, 8, 15]);
  const frozen = capture.sprites.find(sprite => sprite.slot === 8)!;
  expect([...frozen.indices.slice(0, 4)]).toEqual([3, 2, 1, 0]);
  npcs[7].rawSheet.data.fill(255); npcs[7].x = 0; npcs[7].flip = false;
  expect(frozen.x).toBe(80); expect([...frozen.indices.slice(0, 4)]).toEqual([3, 2, 1, 0]);
  const screen = new TransitionScreen(capture.slots, 8), program = transitionPrologue(screen); program.next();
  for (let tick = 1; tick <= 5; tick++) { screen.vblank(); program.next(); }
  expect(screen.visibleSprites).toEqual([0, 8]);
  renderTransitionScreen(screen, capture);
  expect(pixel(80, 60)).toEqual(colour(3)); expect(pixel(81, 60)).toEqual(colour(1));
});

it('rejects NPCs without a source slot and duplicate visible slot owners; accepts a visible script alias over a hidden base', () => {
  const player = actor(0), first = actor(1), second = actor(1);
  expect(() => scene({ player, npcs: [first, second] })).toThrow('two visible');
  first.visible = false;
  expect(scene({ player, npcs: [first, second] }).sprites.filter(sprite => sprite.slot === 1)).toHaveLength(1);
  expect(scene({ player, npcs: [second, first] }).slots.find(slot => slot.slot === 1)?.visible).toBe(true);
  first.data.textId = 0;
  expect(() => scene({ player, npcs: [first] })).toThrow('cartridge object slot');
});

it('origin 255 is a captured cell, distinct from the FF sentinel and ClearScreen blank', () => {
  const capture = scene({ player: actor(0, 0, 50, false), npcs: [] });
  const screen = new TransitionScreen(capture.slots); screen.wy = 0;
  screen.write(0, 255); screen.write(1, FF); screen.vblank(); renderTransitionScreen(screen, capture);
  expect(pixel(0, 0)).toEqual(colour(3)); expect(pixel(8, 0)).toEqual(colour(3));
  // The two cells have different identities even when their current colour happens to match.
  expect(screen.visibleCells.slice(0, 2)).toEqual([255, FF]);
  screen.write(0, 254); screen.vblank(); screen.vblank(); screen.vblank(); renderTransitionScreen(screen, capture);
  expect(pixel(0, 0)).toEqual(colour(2));
  screen.clearScreen(); screen.vblank(); screen.vblank(); screen.vblank(); renderTransitionScreen(screen, capture);
  expect(pixel(0, 0)).toEqual(colour(0));
});

it.each([0xe4, 0xf9, 0xfe, 0xff, 0x90, 0x40, 0])('BGP $%s remaps only captured BG, while source colour zero stays transparent', register => {
  const capture = scene({ player: actor(0, 32, 32), npcs: [] });
  const screen = new TransitionScreen(capture.slots); screen.bgp = register;
  renderTransitionScreen(screen, capture);
  // No window yet: background under (32,32) is origin cell 84 -> shade zero.
  expect(pixel(32, 32)).toEqual(colour(register & 3));
  expect(pixel(33, 32)).toEqual(colour(0)); // raw OBJ colour 1, OBP0=$d0 -> opaque shade zero
  expect(pixel(34, 32)).toEqual(colour(1)); expect(pixel(35, 32)).toEqual(colour(3));
  expect(pixel(8, 0)).toEqual(colour((register >> 2) & 3));
});

it('OBP1 maps independently, with slot-zero OAM priority over overlapping NPCs', () => {
  const player = actor(0, 40, 40), npc = actor(1, 40, 40, true, 'obp1');
  const capture = scene({ player, npcs: [npc] }), screen = new TransitionScreen(capture.slots);
  screen.obp1 = 0xc8; renderTransitionScreen(screen, capture);
  expect(pixel(41, 40)).toEqual(colour(0)); // player wins over NPC mapped to shade 2
  const npcOnly = { ...capture, sprites: capture.sprites.filter(sprite => sprite.slot !== 0) };
  renderTransitionScreen(screen, npcOnly); expect(pixel(41, 40)).toEqual(colour(2));
  screen.obp1 = 0xe0; renderTransitionScreen(screen, npcOnly); expect(pixel(41, 40)).toEqual(colour(0));
});

it('BlackScreen holds every pixel at palette shade 3, and repeated renders advance no clocks/state', () => {
  const capture = scene({ player: actor(0), npcs: [actor(1)] }), screen = new TransitionScreen(capture.slots);
  screen.black = true; screen.bgp = screen.obp0 = screen.obp1 = 255;
  const phase = textBgTransfer.nextPortion, cells = screen.cells, visible = screen.visibleCells, oam = screen.visibleSprites;
  const raster = capture.view as unknown as RasterCanvas; raster.pixels.fill(117); // ensure black bypasses reads/shade work
  for (let i = 0; i < 4; i++) renderTransitionScreen(screen, capture);
  for (let offset = 0; offset < output.pixels.length; offset += 4) expect([...output.pixels.subarray(offset, offset + 4)]).toEqual(colour(3));
  expect(textBgTransfer.nextPortion).toBe(phase); expect(screen.cells).toEqual(cells);
  expect(screen.visibleCells).toEqual(visible); expect(screen.visibleSprites).toEqual(oam);
});
