// Opening checkpoint-08a (note 118): Init and PlayIntro's tail as a frame program, on a mocked audio facade and
// presentation. main_title.test.ts drives the same program through main's real tick.
import { beforeEach, describe, expect, it, vi } from 'vitest';
const record = vi.hoisted(() => ({ frame: 0, calls: [] as [number, string][] }));
vi.mock('../audio', () => ({ stopAllSounds: () => { record.calls.push([record.frame, 'stopAllSounds']); } }));
vi.mock('./opening_screen_render', () => ({ presentOpeningScreen: () => { record.calls.push([record.frame, 'present']); } }));
import { Boot, INIT_DARK_TICKS, INIT_TAIL_DARK_TICKS, LOAD_SGB_FRAMES } from './boot';
import { textBgTransfer } from '../text/bg_transfer';

let boot: Boot;
interface Tick { stage: string; dark: boolean; lcd: boolean; exit: string | null }
function tick(): Tick {
  const dark = boot.darkFrame;
  record.frame++;
  const exit = boot.update();
  return { stage: boot.inspection.stage, dark, lcd: boot.inspection.lcd, exit };
}

beforeEach(() => {
  record.frame = 0; record.calls.length = 0;
  textBgTransfer.enabled = false; textBgTransfer.resetPortion();
  boot = new Boot();
});

describe('Init and PlayIntro\'s tail (home/init.asm, engine/movie/intro.asm), measured on the cartridge (note 118 §2.2)', () => {
  it('10 dark frames, LoadSGB\'s 51, the tail\'s two serviced frames, 3 dark, then PrepareTitleScreen in the 66th step', () => {
    expect([INIT_DARK_TICKS, LOAD_SGB_FRAMES, INIT_TAIL_DARK_TICKS]).toEqual([10, 51, 3]);
    boot.start();
    expect([boot.darkFrame, boot.inspection.stage, boot.inspection.lcd]).toEqual([true, 'init', true]);
    const t = Array.from({ length: 66 }, tick);
    expect(t.map(f => (f.dark ? 'd' : 'v')).join('')).toBe('d'.repeat(10) + 'v'.repeat(53) + 'd'.repeat(3));
    expect(t.map(f => f.exit)).toEqual([...Array<null>(65).fill(null), 'title']);
    // The LCD goes off in the first dark frame's step and comes back in the 10th's; off again in the 63rd's, on in the 66th's.
    expect(t.map(f => (f.lcd ? 1 : 0)).join('')).toBe('0'.repeat(9) + '1'.repeat(53) + '0'.repeat(3) + '1');
    expect(t[10].stage).toBe('load-sgb');
    expect([t[60].stage, t[61].stage, t[62].stage]).toEqual(['play-intro', 'init-tail', 'init-tail']);
    expect(record.calls.filter(call => call[1] === 'stopAllSounds')).toEqual([[10, 'stopAllSounds']]);
    expect(tick().exit).toBeNull();
  });

  it('PlayIntro turns the transfer on and its tail off in one step: no third moves, so the title starts at the top', () => {
    boot.start();
    const portions = Array.from({ length: 66 }, () => { tick(); return textBgTransfer.nextPortion; });
    expect(new Set(portions)).toEqual(new Set([0]));
    expect(textBgTransfer.enabled).toBe(false);
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
