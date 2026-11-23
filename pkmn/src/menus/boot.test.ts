// Opening checkpoint-08a (note 118): Init and PlayIntro's tail as a frame program, on a mocked audio facade and
// presentation; 08b (note 119) adds PlayShootingStar's copyright screen between LoadSGB and the tail, 09 (note 120) the
// rest of PlayShootingStar, on blank images of the right sizes (shooting_star.test.ts draws the real ones).
// main_title.test.ts drives the same program through main's real tick.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const record = vi.hoisted(() => {
  Object.assign(globalThis, { window: { addEventListener() {} } }); // input.ts's key listeners
  return { frame: 0, calls: [] as [number, string][] };
});
vi.mock('../audio', () => ({
  stopAllSounds: () => { record.calls.push([record.frame, 'stopAllSounds']); },
  setAudioBank: (bank: number) => { record.calls.push([record.frame, `setAudioBank ${bank}`]); },
  playSFX: (name: string) => { record.calls.push([record.frame, `playSFX ${name}`]); return Promise.resolve(); },
}));
vi.mock('./opening_screen_render', () => ({ presentOpeningScreen: () => { record.calls.push([record.frame, 'present']); } }));
import { Boot, INIT_DARK_TICKS, INIT_TAIL_DARK_TICKS, LOAD_SGB_FRAMES, STAR_AUDIO_BANK } from './boot';
import { isVBlankHeld, resetVBlankHold } from '../core/vblank_hold';
import { textBgTransfer } from '../text/bg_transfer';
import * as input from '../input';
import { joyHeld, PAD } from '../input';
import type { OpeningImage, OpeningScreen } from './opening_screen';

/** The eight images' sizes (copyright 19 tiles, Game Freak 9, the 9, the text box 32; "presents" 13, the logo 6, the
 *  falling star 1, MoveAnimationTiles1 80), all white. */
const SIZES: Record<string, [number, number]> = {
  '/gfx/splash/copyright.png': [152, 8], '/gfx/title/gamefreak_inc.png': [72, 8], '/gfx/title/nine.png': [8, 8],
  '/gfx/font/font_extra.png': [128, 16], '/gfx/splash/gamefreak_presents.png': [104, 8],
  '/gfx/splash/gamefreak_logo.png': [16, 24], '/gfx/splash/falling_star.png': [8, 8], '/gfx/battle/move_anim_1.png': [128, 40],
};
const blank = async (url: string): Promise<OpeningImage> => {
  const [width, height] = SIZES[url];
  return { width, height, data: new Uint8Array(width * height * 4).fill(255) };
};

let boot: Boot;
interface Tick { stage: string; kind: 'd' | 'h' | 'v'; lcd: boolean; exit: string | null }
function tick(): Tick {
  const kind = boot.darkFrame ? 'd' : isVBlankHeld() ? 'h' : 'v';
  record.frame++;
  const exit = boot.update();
  return { stage: boot.inspection.stage, kind, lcd: boot.inspection.lcd, exit };
}

beforeEach(async () => {
  record.frame = 0; record.calls.length = 0;
  textBgTransfer.enabled = false; textBgTransfer.resetPortion(); resetVBlankHold();
  boot = new Boot();
  await boot.load(blank);
});

describe('Init, PlayIntro and the tails (home/init.asm, engine/movie/intro.asm), measured on the cartridge (notes 118, 119, 120 §2.2)', () => {
  it('10 dark, LoadSGB\'s 51, 2 held, 200, the star\'s dark one, 326, 3 dark, then PrepareTitleScreen in the 593rd step', () => {
    expect([INIT_DARK_TICKS, LOAD_SGB_FRAMES, INIT_TAIL_DARK_TICKS, STAR_AUDIO_BANK]).toEqual([10, 51, 3, 0x1f]);
    boot.start();
    expect([boot.darkFrame, boot.inspection.stage, boot.inspection.lcd]).toEqual([true, 'init', true]);
    const t = Array.from({ length: 593 }, tick);
    expect(t.map(f => f.kind).join('')).toBe(
      'd'.repeat(10) + 'v'.repeat(51) + 'h'.repeat(2) + 'v'.repeat(200) + 'd' + 'v'.repeat(326) + 'd'.repeat(3));
    // 577 serviced VBlanks, as on the cartridge (star-frames.mjs).
    expect(t.filter(f => f.kind === 'v')).toHaveLength(577);
    expect(t.map(f => f.exit)).toEqual([...Array<null>(592).fill(null), 'title']);
    // Off in Init's first dark step, on in its 10th; off in the 263rd (the star's DisableLCD), on in the 264th; off in
    // the 590th (Init's tail), on in the 593rd.
    expect(t.map(f => (f.lcd ? 1 : 0)).join('')).toBe(
      '0'.repeat(9) + '1'.repeat(253) + '0' + '1'.repeat(326) + '0'.repeat(3) + '1');
    expect(t[10].stage).toBe('load-sgb');
    expect([t[59].stage, t[60].stage, t[586].stage, t[587].stage, t[588].stage, t[589].stage])
      .toEqual(['load-sgb', 'shooting-star', 'shooting-star', 'play-intro', 'init-tail', 'init-tail']);
    expect(record.calls.filter(call => call[1] !== 'present'))
      .toEqual([[10, 'stopAllSounds'], [61, 'setAudioBank 31'], [331, 'playSFX shooting_star']]);
    expect(tick().exit).toBeNull();
  });

  it('the transfer: on from PlayIntro, a third in each serviced frame but the copies\' 12, off from PlayIntro\'s tail', () => {
    boot.start();
    let last = textBgTransfer.nextPortion;
    const moved: number[] = [];
    for (let n = 1; n <= 593; n++) {
      tick();
      if (textBgTransfer.nextPortion !== last) moved.push(n);
      last = textBgTransfer.nextPortion;
    }
    // Delay3 twice (SendSGBPackets, ClearScreen); none in the held frames or CopyVideoData's 5 + 4; every frame from
    // UpdateCGBPal_BGP's to DisableLCD's (serviced with the LCD off); none in the dark one; DelayFrames 64; none in the
    // star's three 1-tile copies; every frame from there to the last Delay3. 512 thirds: the title starts on third 2
    // (the cartridge's hAutoBGTransferPortion at PrepareTitleScreen, star-frames.mjs).
    const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);
    expect(moved).toEqual([...range(64, 69), ...range(79, 263), ...range(265, 328), ...range(332, 588)]);
    expect([textBgTransfer.enabled, textBgTransfer.nextPortion]).toEqual([false, 2]);
  });

  it('Init\'s first frame still shows the picture it started on; every later frame is the boot\'s white screen', () => {
    const previous = vi.fn(() => { record.calls.push([record.frame, 'previous']); });
    boot.start(previous);
    boot.render();
    tick(); boot.render();
    tick(); boot.render();
    expect(record.calls.filter(call => call[1] !== 'stopAllSounds')).toEqual([[0, 'previous'], [1, 'present'], [2, 'present']]);
  });
});

// Note 141: an optional frame segment between the star and PlayIntro's tail. The fixture is original and geometric: one
// sprite (tile 1) that sits at x = 16, 40, 64 over three frames. Each yield is one frame; the segment seeds a local joypad
// baseline at entry and ends on a newly pressed A, B or START.
describe('the optional opening segment (note 141)', () => {
  const POSITIONS = [16, 40, 64];
  const SKIP = PAD.a | PAD.b | PAD.start;
  /** The button bits the test holds at each tick (record.frame is the tick in progress). */
  let pad: (tick: number) => number;
  let started = 0;

  function* fixture(screen: OpeningScreen): Generator<void, void> {
    started++;
    let last = joyHeld();
    for (const x of POSITIONS) {
      screen.oam.set([80, x, 1, 0], 0);
      yield;
      const held = joyHeld();
      const pressed = held & ~last;
      last = held;
      if (pressed & SKIP) return;
    }
  }

  interface Run { title: number[]; stages: Map<number, string>; shown: Map<number, number>; oam: number[] }
  function run(target: Boot, ticks = 700): Run {
    const out: Run = { title: [], stages: new Map(), shown: new Map(), oam: [] };
    for (let n = 1; n <= ticks; n++) {
      if (tickOn(target).exit === 'title') { out.title.push(n); out.oam = [...target.inspection.screen.oam]; }
      out.stages.set(n, target.inspection.stage);
      out.shown.set(n, target.inspection.screen.shownOam[1]);
    }
    return out;
  }
  function tickOn(target: Boot): Tick {
    const previous = boot; boot = target;
    try { return tick(); } finally { boot = previous; }
  }
  async function segmentBoot(): Promise<Boot> {
    const made = new Boot(fixture);
    await made.load(blank);
    return made;
  }

  beforeEach(() => {
    started = 0; pad = () => 0;
    vi.spyOn(input, 'joyHeld').mockImplementation(() => pad(record.frame));
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('without a segment the title still comes in step 593, and the star skip in 351', () => {
    boot.start();
    expect(run(boot).title).toEqual([593]);
    pad = t => (t >= 343 ? PAD.a : 0);
    resetVBlankHold(); textBgTransfer.enabled = false; textBgTransfer.resetPortion(); record.frame = 0;
    boot.start();
    expect(run(boot).title).toEqual([351]);
    expect(started).toBe(0);
  });

  it('runs its three frames after the star and before the tail: the title comes three steps later, once', async () => {
    const made = await segmentBoot();
    made.start();
    const r = run(made);
    expect(r.title).toEqual([596]);
    // The star ends in step 588, which enters the segment; three yields, then the tail's first yield in step 591.
    expect([587, 588, 589, 590, 591].map(n => r.stages.get(n)))
      .toEqual(['shooting-star', 'opening-segment', 'opening-segment', 'opening-segment', 'play-intro']);
    expect([r.stages.get(592), r.stages.get(593)]).toEqual(['init-tail', 'init-tail']);
    // The sprite moves one position per frame; each position reaches the LCD one frame boundary after it was written.
    expect([589, 590, 591].map(n => r.shown.get(n))).toEqual(POSITIONS);
    expect(r.oam.every(byte => byte === 0)).toBe(true); // the tail's ClearSprites
    expect(textBgTransfer.enabled).toBe(false);
    expect(made.update()).toBeNull();
    expect(started).toBe(1);
  });

  it.each([['A', PAD.a], ['B', PAD.b], ['START', PAD.start]])('a fresh %s skips it and reaches the same tail and title once', async (_name, bit) => {
    const made = await segmentBoot();
    pad = t => (t >= 589 ? bit : 0);
    made.start();
    const r = run(made);
    // The first check after one yield: step 589 returns, so the tail begins there and the title is two steps early.
    expect(r.title).toEqual([594]);
    expect([588, 589, 590].map(n => r.stages.get(n))).toEqual(['opening-segment', 'play-intro', 'init-tail']);
    expect(r.shown.get(589)).toBe(POSITIONS[0]);
    expect(r.oam.every(byte => byte === 0)).toBe(true);
    expect(textBgTransfer.enabled).toBe(false);
  });

  it('a button held at entry (the one that skipped the star) must be released first', async () => {
    const made = await segmentBoot();
    // A skips the star at tick 343 (title 351 without a segment: the star ends in step 346) and stays down.
    pad = t => (t >= 343 ? PAD.a : 0);
    made.start();
    expect(run(made).title).toEqual([354]);
  });

  it('release and repress ends it on the repress', async () => {
    const made = await segmentBoot();
    // Held through step 346 (entry), up in 347, down again in 348: the second check returns.
    pad = t => (t >= 343 && t !== 347 ? PAD.a : 0);
    made.start();
    expect(run(made).title).toEqual([353]);
  });

  it('SELECT alone, held at entry or pressed during it, does not skip', async () => {
    const held = await segmentBoot();
    pad = t => (t >= 343 ? PAD.a | PAD.select : 0);
    held.start();
    expect(run(held).title).toEqual([354]);
    const fresh = await segmentBoot();
    pad = t => (t >= 589 ? PAD.select : 0);
    resetVBlankHold(); textBgTransfer.enabled = false; textBgTransfer.resetPortion(); record.frame = 0;
    fresh.start();
    expect(run(fresh).title).toEqual([596]);
  });

  it('a second start() runs a fresh fixture, after a natural finish and after a skip', async () => {
    const made = await segmentBoot();
    const reset = (): void => { resetVBlankHold(); textBgTransfer.enabled = false; textBgTransfer.resetPortion(); record.frame = 0; };
    made.start();
    expect(run(made).title).toEqual([596]);
    reset(); pad = t => (t >= 589 ? PAD.start : 0);
    made.start();
    const skipped = run(made);
    expect(skipped.title).toEqual([594]);
    reset(); pad = () => 0;
    made.start();
    const again = run(made);
    expect(again.title).toEqual([596]);
    expect([589, 590, 591].map(n => again.shown.get(n))).toEqual(POSITIONS);
    expect(started).toBe(3);
  });
});
