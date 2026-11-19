// Opening checkpoints 05 and 06 (notes 114, 115): DisplayTitleScreen's build, the loop and its exits as a frame
// program, on a mocked audio facade that records the frame of every request. main_title.test.ts drives the same
// program through main on the real facade.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const audio = vi.hoisted(() => {
  Object.assign(globalThis, { window: { addEventListener() {} } });
  return { frame: 0, finished: true, fading: false, calls: [] as [number, string, ...unknown[]][] };
});
vi.mock('../audio', () => ({
  setAudioBank: (bank: number) => { audio.calls.push([audio.frame, 'bank', bank]); },
  playSFX: (name: string) => { audio.calls.push([audio.frame, 'sfx', name]); return Promise.resolve(); },
  stopAllMusic: () => { audio.calls.push([audio.frame, 'stop']); },
  playNewMusic: (name: string) => { audio.calls.push([audio.frame, 'music', name]); return Promise.resolve(); },
  loadPikachuClip: async (number: number) => { audio.calls.push([audio.frame, 'load', number]); },
  isSoundFinished: () => audio.finished,
  fadeOutAndStopMusic: (control: number) => { audio.calls.push([audio.frame, 'fade', control]); audio.fading = true; },
  isAudioFadingOut: () => audio.fading,
  // PlayPikachuSoundClip's shape (audio/index.ts): three DelayFrames, the body, one more for the late VBlank.
  * playPikachuSoundClip(number: number) {
    for (let frame = 0; frame < 3; frame++) yield;
    audio.calls.push([audio.frame, 'clip', number]);
    yield;
  },
}));
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import {
  CLEAR_SAVE_BUTTONS, COPYRIGHT_TILES, FADE_PAL4, LOGO_BOUNCE, PIKACHU_EYES_OAM, POKEMON_LOGO_TILES, TITLE_LCD_OFF_FRAMES,
  TITLE_EXIT_BUTTONS, TITLE_PALETTES, TITLE_RESET_FADE, TITLE_RESET_PASSES, TitleScreen, type TitleExit,
} from './title_screen';
import { BG_MAP0, BG_MAP1, SPACE_TILE, type OpeningImage } from './opening_screen';
import { renderOpeningScreen } from './opening_screen_render';
import { TITLE_BG0_ATTRIBUTES, TITLE_BG1_ATTRIBUTES } from './title_attributes';
import { textBgTransfer } from '../text/bg_transfer';
import { isVBlankHeld } from '../core/vblank_hold';
import * as input from '../input';
import type { GameButton } from '../core';

const STATIC = resolve(__dirname, '../../static');
const png = (url: string): OpeningImage => {
  const p = PNG.sync.read(readFileSync(resolve(STATIC, url.replace(/^\//, ''))));
  return { width: p.width, height: p.height, data: p.data };
};
const loadImage = vi.fn(async (url: string) => png(url));
const loadBytes = vi.fn(async (url: string) => new Uint8Array(readFileSync(resolve(STATIC, url.replace(/^\//, '')))));
const buttons: GameButton[] = ['a', 'b', 'start', 'select', 'up', 'down', 'left', 'right'];
let title: TitleScreen;

interface Tick { scy: number; wy: number; bgp: number; obp0: number; lcd: boolean; blank: boolean; dest: number;
  portion: number; held: boolean; stage: string; eye: number; shownEye: number; result: TitleExit | null; obp1: number }
/** One main tick: the peek main makes, then update. Returns what the frame shows. */
function tick(pressed: GameButton[] = []): Tick {
  buttons.forEach(button => input.setKey(button, pressed.includes(button)));
  input.updateInput();
  const held = isVBlankHeld();
  audio.frame++;
  const result = title.update();
  const s = title.inspection.screen;
  return { scy: s.scy, wy: s.wy, bgp: s.bgp, obp0: s.obp0, lcd: s.lcdOn, blank: s.blankFrame, dest: s.bgTransferDest,
    portion: textBgTransfer.nextPortion, held, stage: title.inspection.stage, eye: s.oam[2], shownEye: s.shownOam[2], result,
    obp1: s.obp1 };
}
const run = (count: number): Tick[] => Array.from({ length: count }, () => tick());
const sha = (pixels: Uint8ClampedArray): string => createHash('sha256').update(pixels).digest('hex');
/** The tick whose step made a request. */
const at = (kind: string): number[] => audio.calls.filter(call => call[1] === kind).map(call => call[0]);

beforeAll(async () => {
  title = new TitleScreen();
  await title.load(loadImage, loadBytes);
});
beforeEach(() => {
  audio.frame = 0; audio.finished = true; audio.fading = false; audio.calls.length = 0;
  textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  buttons.forEach(button => input.setKey(button, false)); input.updateInput();
});
afterEach(() => { buttons.forEach(button => input.setKey(button, false)); input.updateInput(); });

describe('the title\'s assets', () => {
  it('loads the eight images, the three tilemaps and clips 1 and 11; start() before load() throws', async () => {
    expect(loadImage.mock.calls.map(call => call[0]).sort()).toEqual([
      '/gfx/font/font.png', '/gfx/splash/copyright.png', '/gfx/title/gamefreak_inc.png', '/gfx/title/nine.png',
      '/gfx/title/pikachu_bg.png', '/gfx/title/pikachu_ob.png', '/gfx/title/pokemon_logo.png', '/gfx/title/pokemon_logo_corner.png',
    ]);
    expect(loadBytes.mock.calls.map(call => call[0]).sort()).toEqual([
      '/gfx/title/pika_bubble.tilemap', '/gfx/title/pikachu.tilemap', '/gfx/title/pokemon_logo.tilemap']);
    const fresh = new TitleScreen();
    expect(() => fresh.start()).toThrow(/before load/);
    await fresh.load(loadImage, loadBytes);
    expect(audio.calls.filter(call => call[1] === 'load').map(call => call[2])).toEqual([1, 11]);
  });
});

describe('DisplayTitleScreen\'s build, frame by frame', () => {
  it('white-out, ClearScreen\'s three frames, DisableLCD\'s serviced VBlank, then four frames with no VBlank', () => {
    title.start();
    expect(at('bank')).toEqual([0]);
    expect(title.inspection.audioRequests[0]).toEqual({ frame: 0, kind: 'bank', value: 0x1f });
    const t = run(9);
    expect(t.slice(0, 4).map(f => f.portion)).toEqual([1, 2, 0, 1]);
    expect(t.slice(0, 3).every(f => f.lcd && f.bgp === 0 && f.obp0 === 0)).toBe(true);
    expect([t[3].lcd, t[3].stage]).toEqual([false, 'lcd-off']);
    expect(TITLE_LCD_OFF_FRAMES).toBe(4);
    // Ticks 5–8: no VBlank, so no transfer and no register latch.
    expect(t.slice(4, 8).map(f => f.portion)).toEqual([1, 1, 1, 1]);
    expect(t.slice(4, 7).every(f => !f.lcd && f.blank)).toBe(true);
    // EnableLCD at the end of tick 8: the skipped first frame is white; tick 9 is the first VBlank after it.
    expect([t[7].lcd, t[7].blank, t[8].blank, t[8].portion]).toEqual([true, true, false, 2]);
    expect(t.slice(0, 9).map(f => f.scy)).toEqual(Array(9).fill(0x40));
    expect(t.slice(0, 9).map(f => f.wy)).toEqual(Array(9).fill(0x90));
  });

  it('the $9B00 and $9800 copies, the palette command\'s two held frames and Delay3, then GBPalNormal at tick 19', () => {
    title.start();
    const t = run(19);
    expect(t.slice(8, 11).map(f => f.dest)).toEqual([BG_MAP0 + 0x300, BG_MAP0 + 0x300, BG_MAP0]);
    expect(t.slice(11, 14).map(f => f.dest)).toEqual([BG_MAP0, BG_MAP0, BG_MAP0]);
    expect(t.slice(10, 12).map(f => f.wy)).toEqual([0x90, 0x40]);
    // Tick 14's step runs SET_PAL_TITLE_SCREEN: ticks 15 and 16 are held (no VBlank half), then Delay3.
    expect(t.slice(13, 19).map(f => f.held)).toEqual([false, true, true, false, false, false]);
    expect(t.slice(13, 17).map(f => f.portion)).toEqual([t[13].portion, t[13].portion, t[13].portion, (t[13].portion + 1) % 3]);
    expect(t.slice(0, 18).every(f => f.bgp === 0)).toBe(true);
    expect([t[18].bgp, t[18].obp0, t[18].stage]).toEqual([0xe4, 0xe0, 'bounce']);
    const s = title.inspection.screen;
    expect(s.bgPalettes).toEqual([...TITLE_PALETTES]);
    expect(s.objPalettes).toEqual([...TITLE_PALETTES, ...TITLE_PALETTES]);
    expect([...s.attributes[0].subarray(0, 576)]).toEqual([...TITLE_BG0_ATTRIBUTES]);
    expect([...s.attributes[1].subarray(0, 576)]).toEqual([...TITLE_BG1_ATTRIBUTES]);
    expect([...s.shownOam.subarray(0, 32)]).toEqual([...PIKACHU_EYES_OAM]);
  });

  it('the bounce: SCY as VBlank latches it, one frame behind hSCY; SFX_INTRO_CRASH once, as the -3 steps begin', () => {
    title.start();
    const t = run(52);
    const expected: number[] = [0x40, 0x40];
    let scy = 0x40;
    for (const [step, count] of LOGO_BOUNCE) for (let i = 0; i < count; i++) { scy = (scy + step) & 0xff; expected.push(scy); }
    expect(t.slice(18, 52).map(f => f.scy)).toEqual(expected);
    expect(expected.slice(-3)).toEqual([2, 1, 0]);
    expect(at('sfx')).toEqual([39]);
    expect(audio.calls.find(call => call[1] === 'sfx')![2]).toBe('intro_crash');
    expect(t.slice(18, 50).every(f => f.stage === 'bounce')).toBe(true);
    expect(t[50].stage).toBe('wait');
  });

  it('36 frames, SFX_INTRO_WHOOSH, the bubble, the window off-screen, Delay3, clip 1, then StopAllMusic and the music', () => {
    title.start();
    const t = run(100);
    expect(at('sfx')).toEqual([39, 87]);
    expect(audio.calls.filter(call => call[1] === 'sfx').map(call => call[2])).toEqual(['intro_crash', 'intro_whoosh']);
    expect(t.slice(85, 88).map(f => f.wy)).toEqual([0x40, 0x40, 144]);
    expect(t[87].stage).toBe('bubble');
    // The clip's three DelayFrames start on the tick after Delay3: the body on tick 93, one more frame, then on to
    // WaitForSoundToFinish, StopAllMusic and MUSIC_TITLE_SCREEN, all on tick 94.
    expect(at('clip')).toEqual([93]);
    expect(title.inspection.audioRequests.filter(r => r.kind === 'clip')).toEqual([{ frame: 90, kind: 'clip', value: 1 }]);
    expect(audio.calls.filter(call => call[0] >= 90).map(call => call.slice(0, 3))).toEqual([[93, 'clip', 1], [94, 'stop'], [94, 'music', 'titlescreen']]);
    expect(t[93].stage).toBe('loop');
  });

  it('WaitForSoundToFinish holds the music while a sound still plays', () => {
    title.start();
    run(93);
    audio.finished = false;
    run(2);
    expect(at('music')).toEqual([]);
    audio.finished = true;
    run(1);
    expect(at('music')).toEqual([96]);
  });

  it('A and START do nothing during the build', () => {
    title.start();
    for (let frame = 0; frame < 93; frame++) expect(tick(frame % 2 ? ['a'] : ['start']).result).toBeNull();
  });
});

describe('what the build leaves in VRAM and on the maps', () => {
  const tileOf = (image: string, index: number): number[] => {
    const p = png(image), across = p.width >> 3, out: number[] = [];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const gray = p.data[(((index / across | 0) * 8 + y) * p.width + (index % across) * 8 + x) * 4];
      out.push(gray >= 192 ? 0 : gray >= 128 ? 1 : gray >= 64 ? 2 : 3);
    }
    return out;
  };

  it('the LCD-off copies in order: later copies win, and the logo\'s 115 tiles leave $73–$7F as VRAM held them', () => {
    title.start();
    run(8);
    const vram = title.inspection.screen.vram.map(tile => [...tile]);
    for (let i = 0; i < 64; i++) expect(vram[0x80 + i], `pikachu_bg ${i}`).toEqual(tileOf('/gfx/title/pikachu_bg.png', i));
    for (let i = 0; i < 5; i++) expect(vram[0xe0 + i], `copyright ${i}`).toEqual(tileOf('/gfx/splash/copyright.png', i));
    for (let i = 0; i < 9; i++) expect(vram[0xe5 + i], `gamefreak ${i}`).toEqual(tileOf('/gfx/title/gamefreak_inc.png', i));
    expect(vram[0xee]).toEqual(tileOf('/gfx/title/nine.png', 0));
    for (let i = 0; i < 12; i++) expect(vram[0xf0 + i], `pikachu_ob ${i}`).toEqual(tileOf('/gfx/title/pikachu_ob.png', i));
    for (let i = 0; i < 3; i++) expect(vram[0xfd + i], `corner ${i}`).toEqual(tileOf('/gfx/title/pokemon_logo_corner.png', i));
    // The font survives only where nothing later wrote: $C0–$DF, $EF and $FC.
    for (const id of [...Array.from({ length: 32 }, (_, i) => 0xc0 + i), 0xef, 0xfc])
      expect(vram[id], `font $${id.toString(16)}`).toEqual(tileOf('/gfx/font/font.png', id - 0x80));
    expect(POKEMON_LOGO_TILES).toBe(115);
    for (let i = 0; i < 115; i++) expect(vram[0x100 + i], `logo ${i}`).toEqual(tileOf('/gfx/title/pokemon_logo.png', i));
    for (let i = 115; i < 128; i++) expect(vram[0x100 + i].every(c => c === 0), `vChars2 $${i.toString(16)}`).toBe(true);
    expect(vram.slice(0, 0x80).every(tile => tile.every(c => c === 0))).toBe(true);
  });

  it('the maps: the logo screen on vBGMap0, the Pikachu screen\'s rows 8–17 on the window map, its rows 0–7 at vBGMap0 row 24', () => {
    const logoMap = readFileSync(resolve(STATIC, 'gfx/title/pokemon_logo.tilemap'));
    const pikachuMap = readFileSync(resolve(STATIC, 'gfx/title/pikachu.tilemap'));
    const bubbleMap = readFileSync(resolve(STATIC, 'gfx/title/pika_bubble.tilemap'));
    const screenAt = (bubble: boolean): number[] => {
      const cells = Array<number>(360).fill(SPACE_TILE);
      for (let r = 0; r < 7; r++) for (let c = 0; c < 16; c++) cells[(1 + r) * 20 + 2 + c] = logoMap[r * 16 + c];
      COPYRIGHT_TILES.forEach((tile, i) => { cells[17 * 20 + 2 + i] = tile; });
      for (let r = 0; r < 9; r++) for (let c = 0; c < 12; c++) cells[(8 + r) * 20 + 4 + c] = pikachuMap[r * 12 + c];
      [[10, 0x96], [11, 0x9d], [12, 0xa7], [13, 0xb1]].forEach(([r, tile]) => { cells[r * 20 + 16] = tile; });
      if (bubble) {
        for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) cells[(4 + r) * 20 + 6 + c] = bubbleMap[r * 7 + c];
        cells[8 * 20 + 9] = 0x64; cells[8 * 20 + 10] = 0x65;
      }
      return cells;
    };
    title.start();
    run(93);
    const s = title.inspection.screen;
    const rows = (map: Uint8Array, first: number, count: number): number[] =>
      Array.from({ length: count * 20 }, (_, i) => map[(first + (i / 20 | 0)) * 32 + i % 20]);
    expect(rows(s.bgMaps[0], 0, 18)).toEqual(screenAt(true));
    expect(rows(s.bgMaps[1], 0, 10)).toEqual(screenAt(false).slice(160));
    expect(rows(s.bgMaps[0], 24, 8)).toEqual(screenAt(false).slice(0, 160));
    expect([...s.tileMap.cells]).toEqual(screenAt(true));
    expect([...s.bgMaps[0].subarray(18 * 32, 24 * 32)].every(cell => cell === SPACE_TILE)).toBe(true);
  });

  it('pixels: the first coloured frame, the logo at rest, the bubble\'s first third, the finished title', () => {
    title.start();
    const frames = new Map<number, string>();
    for (let n = 1; n <= 94; n++) { tick(); if ([19, 36, 88, 94].includes(n)) frames.set(n, sha(renderOpeningScreen(title.inspection.screen))); }
    expect(Object.fromEntries(frames)).toEqual({
      19: '1387fe729f4ebdb96952f287b36baba632e002c72ee71394e042d20ea4c83a18',
      36: '2ad20b0ce9244c7789288bcc9f2563cd438956ae83fe2bea144488af7ea07622',
      88: '658721210ef5dfb24646ef6d991b9c05fa099e67ea255d94430887c11bcb1e30',
      94: 'b56384bd91a22876110a9d313d720918b17359964c2a7faf237d1b416b49564e',
    });
  });
});

describe('the loop\'s title function (DoTitleScreenFunction)', () => {
  /** Shadow OAM's first eye tile after each tick, from the first loop tick on. */
  function loopEyes(count: number): number[] {
    title.start();
    run(94);
    return run(count).map(f => f.eye);
  }

  it('.CheckTimer reads before it increments: the first loop frame starts a blink, then $80 and $90 and $00 again', () => {
    const eyes = loopEyes(270);
    const blink = [0xf5, 0xf5, 0xf5, 0xf9, 0xf9, 0xf9, 0xf5, 0xf5, 0xf5, 0xf1];
    const starts = eyes.flatMap((eye, i) => eye === 0xf5 && (i === 0 || eyes[i - 1] === 0xf1) ? [i] : []);
    expect(starts).toEqual([0, 128, 144, 256]);
    for (const start of starts) expect(eyes.slice(start, start + 10), `blink at ${start}`).toEqual(blink);
    expect(eyes.filter(eye => eye !== 0xf1)).toHaveLength(36);
  });

  it('OAM DMA shows each blink frame one frame later; the eight entries change together', () => {
    title.start();
    run(94);
    const t = run(12);
    expect(t.map(f => f.shownEye)).toEqual([0xf1, 0xf5, 0xf5, 0xf5, 0xf9, 0xf9, 0xf9, 0xf5, 0xf5, 0xf5, 0xf1, 0xf1]);
    const tiles = [...title.inspection.screen.oam].filter((_, i) => i < 32 && i % 4 === 2);
    expect(tiles).toEqual(PIKACHU_EYES_OAM.filter((_, i) => i % 4 === 2));
  });

  it('a title entered without start() runs the loop at once (main\'s tests set the state directly)', () => {
    const bare = new TitleScreen();
    const previous = title; title = bare;
    try {
      expect(tick().result).toBeNull();
      expect(bare.inspection.stage).toBe('loop');
      expect(tick(['start']).result).toBeNull();
      expect(bare.inspection.stage).toBe('exit');
      expect(run(19).map(f => f.result)).toEqual([...Array<null>(18).fill(null), 'main_menu']);
      // The program has ended; entering the state again starts a fresh loop.
      expect(tick().result).toBeNull();
      expect(bare.inspection.stage).toBe('loop');
    } finally { title = previous; }
  });
});

describe('the loop\'s exits (.titleScreenLoop, .go_to_main_menu)', () => {
  /** A bare title's loop: one empty frame, then `held` for one frame, then nothing until it leaves or 19 frames pass. */
  function leave(held: GameButton[]): { stage: string; result: TitleExit | null; frames: number } {
    const bare = new TitleScreen();
    const previous = title; title = bare;
    try {
      tick();
      const decision = tick(held);
      const after = run(19);
      const end = after.findIndex(f => f.result !== null);
      return { stage: decision.stage, result: end < 0 ? null : after[end].result, frames: end + 1 };
    } finally { title = previous; }
  }

  it('hJoyHeld, not a press: exactly Up+Select+B, or anything with A or START; the exit tests Up+Select+B masked', () => {
    expect([CLEAR_SAVE_BUTTONS, TITLE_EXIT_BUTTONS]).toEqual([input.PAD.up | input.PAD.select | input.PAD.b, input.PAD.a | input.PAD.start]);
    const cases: [GameButton[], TitleExit | null][] = [
      [[], null], [['b'], null], [['select'], null], [['up', 'select'], null],
      [['up', 'select', 'b', 'down'], null], [['up', 'select', 'b', 'left'], null],
      [['up', 'select', 'b'], 'clear_save'], [['a'], 'main_menu'], [['start'], 'main_menu'], [['start', 'b'], 'main_menu'],
      [['a', 'up', 'select', 'b'], 'clear_save'], [['start', 'up', 'select', 'b', 'down'], 'clear_save'],
    ];
    for (const [held, expected] of cases) {
      const out = leave(held);
      expect([out.stage, out.result], held.join('+') || 'nothing').toEqual([expected ? 'exit' : 'loop', expected]);
      // Released after the deciding frame: the jump still reads the loop's hJoyHeld, 19 frames later.
      if (expected) expect(out.frames, held.join('+')).toBe(19);
    }
  });

  it('A held through the build leaves on the loop\'s first frame, before its title function starts a blink', () => {
    title.start();
    const t: Tick[] = [];
    for (let frame = 1; frame <= 98; frame++) t.push(tick(['a']));
    expect(t.slice(0, 94).every(f => f.result === null && f.stage !== 'exit')).toBe(true);
    expect(t[94].stage).toBe('exit');
    expect(title.inspection.audioRequests.filter(r => r.kind === 'clip')).toEqual([
      { frame: 90, kind: 'clip', value: 1 }, { frame: 95, kind: 'clip', value: 11 }]);
    expect(at('clip')).toEqual([93, 98]);
    expect(t.slice(94, 98).map(f => f.shownEye)).toEqual([0xf1, 0xf1, 0xf1, 0xf1]);
    expect(title.inspection.timer).toBe(0);
  });

  it('the exit, frame by frame: clip 11, GBPalWhiteOut, ClearSprites and hWY 0, ClearScreen, both maps, LoadGBPal', () => {
    title.start();
    run(94);
    const decision = tick(['start']);
    expect([decision.stage, decision.result, title.inspection.frame]).toEqual(['exit', null, 95]);
    const t = run(19);
    expect(audio.calls.filter(call => call[0] > 95).map(call => call.slice(0, 3))).toEqual([[98, 'clip', 11]]);
    expect(t.slice(0, 3).every(f => f.bgp === 0xe4 && f.obp0 === 0xe0 && f.stage === 'exit')).toBe(true);
    expect(t.slice(3, 18).every(f => f.bgp === 0 && f.obp0 === 0 && f.obp1 === 0 && f.stage === 'white-out')).toBe(true);
    // ClearSprites and hWY = 0 in the step of e+7; OAM DMA and VBlank's latch show them from e+8.
    expect(t.slice(5, 8).map(f => [f.eye, f.shownEye, f.wy])).toEqual([[0xf1, 0xf1, 144], [0, 0xf1, 144], [0, 0, 0]]);
    expect(t.map(f => f.dest)).toEqual([...Array<number>(12).fill(BG_MAP0), ...Array<number>(7).fill(BG_MAP1)]);
    expect(t.map(f => f.result)).toEqual([...Array<null>(18).fill(null), 'main_menu']);
    expect([t[18].bgp, t[18].obp0, t[18].obp1]).toEqual([...FADE_PAL4]);
    expect(FADE_PAL4).toEqual([0xe4, 0xd0, 0xe0]);
    const s = title.inspection.screen;
    for (const map of [0, 1] as const) for (let row = 0; row < 18; row++)
      expect([...s.bgMaps[map].subarray(row * 32, row * 32 + 20)].every(cell => cell === SPACE_TILE), `map ${map} row ${row}`).toBe(true);
    expect(s.shownOam.every(byte => byte === 0)).toBe(true);
  });

  it('pixels: the title through the clip\'s frames, then one white from the white-out to LoadGBPal', () => {
    title.start();
    run(94);
    tick(['start']);
    const shown = sha(renderOpeningScreen(title.inspection.screen));
    const frames: string[] = [];
    for (let n = 1; n <= 19; n++) { tick(); frames.push(sha(renderOpeningScreen(title.inspection.screen))); }
    expect(frames.slice(0, 3)).toEqual([shown, shown, shown]);
    expect(new Set(frames.slice(3)).size).toBe(1);
    const pixels = renderOpeningScreen(title.inspection.screen);
    expect(new Set(Array.from({ length: 160 * 144 }, (_, i) => pixels.slice(i * 4, i * 4 + 4).join())).size).toBe(1);
    expect([...pixels.slice(0, 4)]).toEqual([255, 255, 255, 255]);
  });
});

describe('the idle reset (IncrementResetCounter, .doTitlescreenReset)', () => {
  it('the loop counts before each DelayFrame: in its 3,071st frame\'s step the song fades ($0C); the spin waits, then Init', () => {
    expect([TITLE_RESET_PASSES, TITLE_RESET_FADE]).toEqual([0xc00, 0x0c]);
    title.start();
    run(94);
    const loop = run(3070);
    expect(loop.every(f => f.result === null && f.stage === 'loop')).toBe(true);
    expect([title.inspection.frame, title.inspection.resetCounter]).toEqual([3164, 3071]);
    const reset = tick();
    expect([reset.stage, reset.result, title.inspection.resetCounter]).toEqual(['reset', null, TITLE_RESET_PASSES]);
    expect(title.inspection.timer).toBe(3071 & 0xff);
    expect(audio.calls.filter(call => call[1] === 'fade')).toEqual([[3165, 'fade', 0x0c]]);
    expect(title.inspection.audioRequests.slice(-1)[0]).toEqual({ frame: 3165, kind: 'fade', value: 0x0c });
    // The spin: no Joypad, no title function, until FadeOutAudio clears the control in a VBlank.
    const timer = title.inspection.timer, eye = reset.eye;
    const spin = Array.from({ length: 30 }, (_, n) => tick(n % 2 ? ['start'] : ['a']));
    expect(spin.every(f => f.result === null && f.stage === 'reset' && f.eye === eye)).toBe(true);
    expect(title.inspection.timer).toBe(timer);
    audio.fading = false;
    expect(tick(['start']).result).toBe('reset');
  });
});

describe('MainMenu\'s B: DisplayTitleScreen without PrepareTitleScreen', () => {
  it('display() builds the same frames and requests as start(), without selecting the audio bank', () => {
    const build = (begin: () => void) => {
      textBgTransfer.resetPortion(); audio.frame = 0; audio.calls.length = 0;
      begin();
      const frames = new Map<number, string>();
      for (let n = 1; n <= 95; n++) { tick(); if ([1, 19, 36, 88, 94, 95].includes(n)) frames.set(n, sha(renderOpeningScreen(title.inspection.screen))); }
      return { frames: Object.fromEntries(frames), requests: title.inspection.audioRequests, calls: audio.calls.map(call => call.slice(0, 3)) };
    };
    const started = build(() => title.start());
    const displayed = build(() => title.display());
    expect(displayed.frames).toEqual(started.frames);
    expect(started.requests[0]).toEqual({ frame: 0, kind: 'bank', value: 0x1f });
    expect(displayed.requests).toEqual(started.requests.slice(1));
    expect(displayed.calls).toEqual(started.calls.filter(call => call[1] !== 'bank'));
    expect(title.inspection.stage).toBe('loop');
  });
});
