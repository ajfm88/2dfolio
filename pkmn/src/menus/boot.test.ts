// Opening checkpoint-08a (note 118): Init and PlayIntro's tail as a frame program, on a mocked audio facade and
// presentation; 08b (note 119) adds PlayShootingStar's copyright screen between LoadSGB and the tail, 09 (note 120) the
// rest of PlayShootingStar, on blank images of the right sizes (shooting_star.test.ts draws the real ones).
// main_title.test.ts drives the same program through main's real tick.
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
import type { OpeningImage } from './opening_screen';

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
