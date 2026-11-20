// Opening checkpoint-08b (note 119): the copyright screen through Boot, on the committed PNGs and the pure scanout,
// with a mocked audio facade and presentation; checkpoint 09 (note 120): the Game Freak logo and the shooting star,
// with real input for the skip, against the cartridge's own frames (star-frames.mjs). The ROM's own bytes are checked
// in rom/__tests__/title_screen_data.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const sounds = vi.hoisted(() => {
  Object.assign(globalThis, { window: { addEventListener() {} } }); // input.ts's key listeners
  return [] as string[];
});
vi.mock('../audio', () => ({
  stopAllSounds: () => {}, setAudioBank: () => {},
  playSFX: (name: string) => { sounds.push(name); return Promise.resolve(); },
}));
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { Boot } from './boot';
import { isVBlankHeld, resetVBlankHold } from '../core/vblank_hold';
import * as input from '../input';
import type { GameButton } from '../core';
import { textBgTransfer } from '../text/bg_transfer';
import { getPaletteColors } from '../renderer/palettes';
import { BG_MAP1, HIDDEN_Y, LCDC_DEFAULT, SPACE_TILE, bgTileIndex, type OpeningImage } from './opening_screen';
import { renderOpeningScreen } from './opening_screen_render';
import {
  BARS_FRAMES, COPYRIGHT_BGP, COPYRIGHT_FRAMES, COPYRIGHT_SPAN_TILES, COPYRIGHT_TEXT, GAME_FREAK_INTRO_ATTRIBUTES,
  GAME_FREAK_INTRO_PALETTES, GAME_FREAK_INTRO_TILES, STAR_HOLD_FRAMES, STAR_LCDC, TEXT_BOX_TILES,
} from './shooting_star';

const STATIC = resolve(__dirname, '../../static');
const png = async (url: string): Promise<OpeningImage> => {
  const image = PNG.sync.read(readFileSync(resolve(STATIC, url.replace(/^\//, ''))));
  return { width: image.width, height: image.height, data: image.data };
};
/** Colour indices of tile `tile` of a one- or two-row sheet, as OpeningScreen.loadTiles reads them. */
async function tileOf(url: string, tile: number): Promise<number[]> {
  const image = await png(url);
  const across = image.width >> 3, column = tile % across, row = Math.floor(tile / across);
  const out: number[] = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const gray = image.data[((row * 8 + y) * image.width + column * 8 + x) * 4];
    out.push(gray >= 192 ? 0 : gray >= 128 ? 1 : gray >= 64 ? 2 : 3);
  }
  return out;
}
const key = (frame: Uint8ClampedArray, x: number, y: number): string => frame.subarray((y * 160 + x) * 4, (y * 160 + x) * 4 + 3).join(',');
const white = (frame: Uint8ClampedArray): boolean => { for (let i = 0; i < frame.length; i += 4) if (frame[i] + frame[i + 1] + frame[i + 2] !== 765) return false; return true; };

const BUTTONS: GameButton[] = ['a', 'b', 'select', 'start', 'right', 'left', 'up', 'down'];
const press = (held: GameButton[]): void => { for (const button of BUTTONS) input.setKey(button, held.includes(button)); };

let boot: Boot;
beforeEach(async () => {
  textBgTransfer.enabled = false; textBgTransfer.resetPortion(); resetVBlankHold();
  press([]); sounds.length = 0;
  boot = new Boot();
  await boot.load(png);
  boot.start();
});
afterEach(() => press([]));

/** Boot to PrepareTitleScreen, holding `held` from tick `from` on. Per serviced tick, the cartridge's oracle (note 120
 *  §6): shadow OAM as that tick's VBlank copied it, then rBGP, rOBP0, rOBP1 and rLCDC's other bits as they stood at
 *  that VBlank (the last step's). Returns the jump's tick, the serviced count and the frames' SHA-256. */
function run(held: GameButton[] = [], from = Infinity): { title: number; serviced: number; digest: string } {
  const hash = createHash('sha256');
  let serviced = 0;
  for (let n = 1; n <= 700; n++) {
    if (n === from) press(held);
    const s = boot.inspection.screen;
    const regs = [s.bgp, s.obp0, s.obp1, s.lcdc & 0x7f];
    const live = !boot.darkFrame && !isVBlankHeld();
    const exit = boot.update();
    if (live) { serviced++; hash.update(Uint8Array.from([...s.shownOam, ...regs])); }
    if (exit === 'title') return { title: n, serviced, digest: hash.digest('hex') };
  }
  throw new Error('no title');
}
/** star-frames.mjs records mapped by star-ticks.cjs (note 120 §2.2): the jump's tick, serviced VBlanks, the digest. */
const CARTRIDGE = {
  none: { title: 593, serviced: 577, digest: 'c16f211addf5efaf5cc1682ecb147d1c7ea36681df070aca9dbd82af7094b592' },
  a343: { title: 351, serviced: 335, digest: '883fa3a27e69bcf44f8d416772e6c4b5363a97558dfae2a70ea2ffd27b4907e7' },
  a313: { title: 340, serviced: 324, digest: '4015640dbdaaf2903abb42f089c8afd418ea2515827147bbfd07d089d71912cb' },
  start378: { title: 386, serviced: 370, digest: '25c2706b5202e23771f43ad6f8c4e6c60a2e53b05e71bf8279e10dcbdf9d9e03' },
  usb413: { title: 421, serviced: 405, digest: '64db299c7befccaf366c1386f0d3a79b406751d11c4eb026ca3855fc6411198e' },
  a463: { title: 471, serviced: 455, digest: 'db7426648537f9aae6830f016443624dc5c03e800e1244c524c79ea3f3181fb9' },
  ab353: { title: 361, serviced: 345, digest: 'f3f0ab4cfca545109128ecc36ac7e646622c6498fc4c4e9c060b63cd4d05fc06' },
} as const;

describe('the copyright screen (PlayShootingStar, LoadCopyrightAndTextBoxTiles), measured on the cartridge (note 119 §2.2)', () => {
  it('white until tick 79, the copyright from tick 80 unchanged through 259 (the 180 frames), white 260–264, then the bars', () => {
    expect(COPYRIGHT_FRAMES).toBe(180);
    const frames: Uint8ClampedArray[] = [];
    for (let n = 1; n <= 265; n++) { boot.update(); frames.push(renderOpeningScreen(boot.inspection.screen)); }
    const shown = frames.map((frame, i) => (white(frame) ? '' : String(i + 1))).filter(Boolean);
    // The second ClearScreen's first transfer (tick 260) is third 1, rows 6–11: all three lines go at once.
    expect([shown.length, shown[0], shown[179], shown[180]]).toEqual([181, '80', '259', '265']);
    expect(frames.slice(80, 259).every(frame => frame.join() === frames[79].join())).toBe(true);
  });

  it('the palette command: GAMEFREAK, REDMON, VIRIDIAN, BLUEMON for BG and both OBJ sets; one attribute block for both maps', () => {
    for (let n = 1; n <= 61; n++) boot.update();
    const s = boot.inspection.screen;
    expect([...s.bgPalettes]).toEqual(['GAMEFREAK', 'REDMON', 'VIRIDIAN', 'BLUEMON']);
    expect([...s.objPalettes]).toEqual([...GAME_FREAK_INTRO_PALETTES, ...GAME_FREAK_INTRO_PALETTES]);
    for (const map of [0, 1] as const) expect([...s.attributes[map].subarray(0, 18 * 32)]).toEqual([...GAME_FREAK_INTRO_ATTRIBUTES]);
    expect(s.bgp).toBe(0);
    // SendSGBPackets' Delay3 transfers Init's cleared wTileMap ($00) to vBGMap1; ClearScreen's then writes ' '.
    for (let n = 62; n <= 66; n++) boot.update();
    expect(new Set(s.bgMaps[1].subarray(0, 18 * 32).filter((_, i) => (i & 31) < 20))).toEqual(new Set([0]));
    for (let n = 67; n <= 69; n++) boot.update();
    expect(new Set(s.bgMaps[1].subarray(0, 18 * 32).filter((_, i) => (i & 31) < 20))).toEqual(new Set([SPACE_TILE]));
  });

  it('the tiles: the text box at $60–$7F, then the 30-tile span over it (the 30th is the text box\'s first); the string at (2, 7)', async () => {
    for (let n = 1; n <= 80; n++) boot.update();
    const s = boot.inspection.screen;
    const sources: [string, number][] = [
      ...Array.from({ length: 19 }, (_, t) => ['/gfx/splash/copyright.png', t] as [string, number]),
      ...Array.from({ length: 9 }, (_, t) => ['/gfx/title/gamefreak_inc.png', t] as [string, number]),
      ['/gfx/title/nine.png', 0], ['/gfx/font/font_extra.png', 0], ['/gfx/font/font_extra.png', 30], ['/gfx/font/font_extra.png', 31]];
    expect([COPYRIGHT_SPAN_TILES, TEXT_BOX_TILES]).toEqual([30, 32]);
    for (const [i, [url, tile]] of sources.entries()) expect([...s.vram[0x160 + i]], `$${(0x60 + i).toString(16)}`).toEqual(await tileOf(url, tile));
    const window = s.bgMaps[1];
    for (let row = 0; row < 18; row++) {
      const line = row >= 7 && row <= 11 && (row - 7) % 2 === 0 ? COPYRIGHT_TEXT[(row - 7) / 2] : [];
      const expected = Array.from({ length: 20 }, (_, x) => (x >= 2 && x - 2 < line.length ? line[x - 2] : SPACE_TILE));
      expect([...window.subarray(row * 32, row * 32 + 20)], `row ${row}`).toEqual(expected);
    }
    expect([s.wy, s.bgp, s.bgTransferDest]).toEqual([0, COPYRIGHT_BGP, BG_MAP1]);
  });

  it('the third line\'s columns 5–7, 8–9 and 12–14 take REDMON, VIRIDIAN and BLUEMON; everything else GAMEFREAK', async () => {
    for (let n = 1; n <= 80; n++) boot.update();
    const frame = renderOpeningScreen(boot.inspection.screen);
    const s = boot.inspection.screen;
    const hex = (name: string): string[] => getPaletteColors(name).map(c => c.join(','));
    // Each pixel: the window's tile (WY 0, WX 7: vBGMap1 from its top left) through the table's slot, BGP $E4 the identity.
    const wrong: string[] = [];
    for (let y = 0; y < 144; y++) for (let x = 0; x < 160; x++) {
      const row = y >> 3, col = x >> 3;
      const slot = GAME_FREAK_INTRO_ATTRIBUTES[row * 32 + col];
      const index = s.vram[bgTileIndex(s.bgMaps[1][row * 32 + col])][(y & 7) * 8 + (x & 7)];
      if (key(frame, x, y) !== hex(GAME_FREAK_INTRO_PALETTES[slot])[index]) wrong.push(`${x},${y}`);
    }
    expect(wrong.slice(0, 5)).toEqual([]);
    // The light shade shows: the stars' palettes differ from GAMEFREAK's in colour 1 only, and the third line uses it.
    const colours = (x0: number, x1: number): Set<string> => {
      const set = new Set<string>();
      for (let y = 88; y < 96; y++) for (let x = x0; x < x1; x++) set.add(key(frame, x, y));
      return set;
    };
    expect([colours(40, 64).has(hex('REDMON')[1]), colours(64, 80).has(hex('VIRIDIAN')[1]), colours(96, 120).has(hex('BLUEMON')[1])])
      .toEqual([true, true, true]);
    expect(hex('REDMON')[1]).not.toBe(hex('GAMEFREAK')[1]);
  });
});

describe('the Game Freak logo and the shooting star (PlayShootingStar, AnimateShootingStar), measured on the cartridge (note 120 §2.2)', () => {
  it('every serviced frame\'s OAM and palettes equal the cartridge\'s: 577 frames, PrepareTitleScreen in tick 593', () => {
    expect([BARS_FRAMES, STAR_HOLD_FRAMES]).toEqual([64, 40]);
    expect(run()).toEqual(CARTRIDGE.none);
    expect(sounds).toEqual(['shooting_star']);
  });

  it('the bars: the LCD off in tick 263, undrawn in 264, then four black rows top and bottom on white from 265, alone to 331', async () => {
    const frames: Uint8ClampedArray[] = [];
    for (let n = 1; n <= 332; n++) { boot.update(); frames.push(renderOpeningScreen(boot.inspection.screen)); }
    const s = boot.inspection.screen;
    expect([white(frames[262]), white(frames[263]), s.lcdc, s.wy]).toEqual([true, true, STAR_LCDC, 0]);
    expect(STAR_LCDC).toBe(0xcb);
    const black = getPaletteColors('GAMEFREAK')[3].join(','), paper = getPaletteColors('GAMEFREAK')[0].join(',');
    const bars = frames[264];
    for (let y = 0; y < 144; y++) for (let x = 0; x < 160; x += 7)
      expect(key(bars, x, y), `${x},${y}`).toBe(y < 32 || y >= 112 ? black : paper);
    expect(frames.slice(265, 331).every(frame => frame.join() === bars.join())).toBe(true);
    // The window is off and the BG reads vBGMap1: the bars' rows are tile 1, the rest ' ' after the transfer.
    expect([...new Set(s.bgMaps[1].subarray(0, 4 * 32))]).toEqual([1]);
    expect([...new Set(s.bgMaps[1].subarray(14 * 32, 18 * 32))]).toEqual([1]);
    expect([...s.vram[bgTileIndex(0)]].every(v => v === 0)).toBe(true);
    expect([...s.vram[bgTileIndex(1)]].every(v => v === 3)).toBe(true);
    // GameFreakIntro (13 + 6 + a blank tile) at BG $60 and objects $80; the star's tiles at objects $A0–$A2.
    expect(GAME_FREAK_INTRO_TILES).toBe(20);
    for (let t = 0; t < 13; t++) expect([...s.vram[0x80 + t]], `presents ${t}`).toEqual(await tileOf('/gfx/splash/gamefreak_presents.png', t));
    for (let t = 0; t < 6; t++) expect([...s.vram[0x8d + t]], `logo ${t}`).toEqual(await tileOf('/gfx/splash/gamefreak_logo.png', t));
    expect([...s.vram[0x93]].every(v => v === 0)).toBe(true);
    for (let t = 0; t < 20; t++) expect([...s.vram[bgTileIndex(0x60) + t]]).toEqual([...s.vram[0x80 + t]]);
    expect([...s.vram[0xa0]]).toEqual(await tileOf('/gfx/battle/move_anim_1.png', 3));
    expect([...s.vram[0xa1]]).toEqual(await tileOf('/gfx/battle/move_anim_1.png', 19));
    expect([...s.vram[0xa2]]).toEqual(await tileOf('/gfx/splash/falling_star.png', 0));
  });

  it('the logo and the star appear in tick 332; the star falls to 369, the logo flashes from 371, the small stars from 402', () => {
    const shown: Uint8Array[] = [], obp: number[][] = [];
    for (let n = 1; n <= 593; n++) { boot.update(); shown.push(boot.inspection.screen.shownOam); obp.push([boot.inspection.screen.obp0, boot.inspection.screen.obp1]); }
    const at = (tick: number, sprite: number): number[] => [...shown[tick - 1].subarray(sprite * 4, sprite * 4 + 4)];
    // Until then every Y is 0 or HideSprites' 160 (the first VBlank's PrepareOAMData): nothing on screen.
    expect(Array.from({ length: 40 }, (_, i) => shown[330][i * 4]).every(y => y === 0 || y === HIDDEN_Y)).toBe(true);
    expect([at(332, 0), at(332, 1), at(332, 24), at(332, 39)]).toEqual([[4, 156, 0xa0, 0x14], [4, 164, 0xa0, 0x34], [72, 80, 0x8d, 0], [96, 120, 0x86, 0]]);
    // 40 moves: Y 156 shown in 370, 160 (off) in 371, where the clear and the first flash run.
    expect([at(369, 0), at(370, 0), at(371, 0)]).toEqual([[152, 8, 0xa0, 0x14], [156, 4, 0xa0, 0x14], [160, 0, 0xa0, 0x14]]);
    // rOBP0 rotated right twice in steps 371, 381 and 391; rOBP1 $A4 from 328, toggled every third step from 401.
    expect([obp[369][0], obp[370][0], obp[380][0], obp[390][0]]).toEqual([0xf9, 0x7e, 0x9f, 0xe7]);
    expect([obp[399][1], obp[400][1], obp[403][1]]).toEqual([0xa4, 0x04, 0xa4]);
    // Wave 1 at Y $68, one pixel down by the first frame; the +6 count moves sprites 18 and 19 (off screen) too.
    expect([at(402, 20), at(402, 23), at(402, 18)]).toEqual([[0x69, 0x30, 0xa2, 0x95], [0x69, 0x78, 0xa2, 0x97], [1, 0, 0xa2, 0x90]]);
    // ClearSprites in step 585: nothing from 586.
    expect([shown[584].some(Boolean), shown[585].some(Boolean)]).toEqual([true, false]);
  });

  it('A in the big star\'s fall skips the rest and the 40 frames: the bars from the next frame, the title 242 ticks sooner', () => {
    expect(run(['a'], 343)).toEqual(CARTRIDGE.a343);
  });

  it('a button held from before the first check counts as pressed there (Init cleared hJoyLast): one frame of the logo', () => {
    expect(run(['a'], 313)).toEqual(CARTRIDGE.a313);
  });

  it('START in a flash\'s 10 frames skips at that frame\'s check', () => {
    expect(run(['start'], 378)).toEqual(CARTRIDGE.start378);
  });

  it('A in the small stars skips at that frame\'s check; the wave\'s shift still runs', () => {
    expect(run(['a'], 463)).toEqual(CARTRIDGE.a463);
  });

  it('A+B skips (A is newly pressed)', () => {
    expect(run(['a', 'b'], 353)).toEqual(CARTRIDGE.ab353);
  });

  it('Up+Select+B held exactly skips', () => {
    expect(run(['up', 'select', 'b'], 413)).toEqual(CARTRIDGE.usb413);
  });

  it('SELECT alone does not (the release build)', () => {
    expect(run(['select'], 353)).toEqual(CARTRIDGE.none);
  });

  it('Up+Select+B+Left does not (hJoyHeld must equal it)', () => {
    expect(run(['up', 'select', 'b', 'left'], 413)).toEqual(CARTRIDGE.none);
  });

  it('Init clears hJoyLast: A held through the next boot skips that star at its first check too', () => {
    expect(run(['a'], 313)).toEqual(CARTRIDGE.a313);
    textBgTransfer.enabled = false; textBgTransfer.resetPortion();
    boot.start();
    // star-frames.mjs with A held from the first VBlank: the same frames as from tick 313.
    expect(run(['a'], 1)).toEqual(CARTRIDGE.a313);
  });

  it('Init\'s tail writes LCDC_DEFAULT back', () => {
    run();
    expect(boot.inspection.screen.lcdc).toBe(LCDC_DEFAULT);
  });
});
