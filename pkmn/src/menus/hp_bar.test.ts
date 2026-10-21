import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  HpBarAnimation, formatHpFraction, getHpBarLength, hpBarColor, hpBarFills,
  PARTY_HP_FRACTION_COL, staticHpBarPixels, type HpBarFrame,
} from './hp_bar';

function play(oldHp: number, newHp: number, maxHp: number, barType: 0 | 1 = 1): HpBarFrame[] {
  const anim = new HpBarAnimation(oldHp, newHp, maxHp, barType);
  if (anim.done) return [];
  const frames: HpBarFrame[] = [];
  let frame: HpBarFrame;
  do {
    frame = anim.tick();
    frames.push(frame);
  } while (!frame.done);
  return frames;
}

function shown(frames: HpBarFrame[]): string {
  return frames.map(frame => `${frame.shownHp}:${frame.pixels}`).join(' ');
}

describe('GetHPBarLength and GetHealthBarColor', () => {
  // hp → pixels. 0 HP is 1 inside the animation and 0 on a static bar.
  const lengths: Record<number, Record<number, number>> = {
    20: { 0: 1, 1: 2, 10: 24, 19: 45, 20: 48 },
    48: { 0: 1, 1: 1, 24: 24, 47: 47, 48: 48 },
    64: { 0: 1, 1: 1, 32: 24, 63: 47, 64: 48 },
    120: { 0: 1, 1: 1, 60: 24, 119: 47, 120: 48 },
    255: { 0: 1, 1: 1, 128: 24, 254: 47, 255: 48 },
    256: { 0: 1, 1: 1, 128: 24, 255: 47, 256: 48 },
    300: { 0: 1, 1: 1, 150: 24, 299: 47, 300: 48 },
    703: { 0: 1, 1: 1, 351: 24, 702: 48, 703: 48 },
  };

  for (const [max, table] of Object.entries(lengths)) {
    it(`max ${max}`, () => {
      for (const [hp, pixels] of Object.entries(table)) {
        expect(getHpBarLength(Number(hp), Number(max)), `hp ${hp}`).toBe(pixels);
        expect(staticHpBarPixels(Number(hp), Number(max)), `static ${hp}`).toBe(Number(hp) === 0 ? 0 : pixels);
      }
    });
  }

  it('colors by pixels: green ≥ 27, yellow ≥ 10, otherwise red', () => {
    expect(hpBarColor(0)).toBe('red');
    expect(hpBarColor(9)).toBe('red');
    expect(hpBarColor(10)).toBe('yellow');
    expect(hpBarColor(26)).toBe('yellow');
    expect(hpBarColor(27)).toBe('green');
    expect(hpBarColor(48)).toBe('green');
  });
});

describe('UpdateHPBar2, increase only', () => {
  it('a static 0 HP bar is empty, and the animation of that HP starts at 1 px', () => {
    expect(staticHpBarPixels(0, 20)).toBe(0);
    expect(getHpBarLength(0, 20)).toBe(1);
    const frames = play(0, 1, 20);
    expect(shown(frames)).toBe('0:0 0:1 0:1 1:1 1:2 1:2 1:2 1:2 1:2');
    expect(frames.filter(frame => frame.done)).toHaveLength(1);
  });

  it('13→33 of 39: 20 HP steps, 24 pixels, 74 frames', () => {
    const frames = play(13, 33, 39);
    expect(frames).toHaveLength(20 + 2 * 24 + 6);
    expect(shown(frames)).toBe([
      '13:16 13:16 13:16 14:16 14:17 14:17 15:17 15:18 15:18',
      '16:18 16:19 16:19 17:19 17:20 17:20 17:21 17:21',
      '18:21 18:22 18:22 19:22 19:23 19:23 20:23 20:24 20:24',
      '21:24 21:25 21:25 21:26 21:26 22:26 22:27 22:27',
      '23:27 23:28 23:28 24:28 24:29 24:29 25:29 25:30 25:30 25:31 25:31',
      '26:31 26:32 26:32 27:32 27:33 27:33 28:33 28:34 28:34',
      '29:34 29:35 29:35 30:35 30:36 30:36 30:37 30:37',
      '31:37 31:38 31:38 32:38 32:39 32:39',
      '33:39 33:40 33:40 33:40 33:40 33:40',
    ].join(' '));
  });

  it('1→21 of 300: the /4 path, two pixel changes, 30 frames', () => {
    const frames = play(1, 21, 300);
    expect(frames).toHaveLength(20 + 2 * 2 + 6);
    expect(shown(frames)).toBe([
      '1:1 2:1 3:1 4:1 5:1 6:1 7:1 8:1 9:1 10:1 11:1',
      '12:1 12:1 12:1',
      '13:1 14:1 15:1 16:1 17:1',
      '18:1 18:2 18:2',
      '19:2 20:2',
      '21:2 21:3 21:3 21:3 21:3 21:3',
    ].join(' '));
  });

  it('a step whose pixel count does not change still costs its print frame', () => {
    const frames = play(1, 2, 300);
    expect(getHpBarLength(1, 300)).toBe(getHpBarLength(2, 300));
    expect(frames).toHaveLength(1 + 6);
    expect(shown(frames)).toBe('1:1 2:1 2:1 2:1 2:1 2:1 2:1');
  });

  it('stops a pixel walk when the next pixel would be 49', () => {
    // max 1, HP 1→2: the step's length jumps 48→96. Without the cap the
    // walk would draw 48 pixel steps. It draws the 48 px bar once and stops.
    const frames = play(1, 2, 1);
    expect(frames).toHaveLength(9);
    expect(shown(frames)).toBe('1:48 1:48 1:48 2:48 2:96 2:96 2:96 2:96 2:96');
    expect(frames.filter(frame => frame.pixels === 49)).toHaveLength(0);
  });

  it('does nothing when HP does not increase', () => {
    const same = new HpBarAnimation(10, 10, 20);
    expect(same.done).toBe(true);
    expect(same.tick()).toEqual({ pixels: staticHpBarPixels(10, 20), shownHp: 10, done: true });
    expect(new HpBarAnimation(10, 4, 20).done).toBe(false);
  });
});

describe('the party HP row', () => {
  it('puts the fraction at column 13 and fills the six tiles from the static length', () => {
    expect(PARTY_HP_FRACTION_COL).toBe(13);
    expect(formatHpFraction(13, 39)).toBe(' 13/ 39');
    expect(formatHpFraction(100, 120)).toBe('100/120');
    expect(formatHpFraction(0, 20)).toBe('  0/ 20');
    expect(hpBarFills(0)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(hpBarFills(staticHpBarPixels(13, 39))).toEqual([8, 8, 0, 0, 0, 0]);
    expect(hpBarColor(staticHpBarPixels(13, 39))).toBe('yellow');
    expect(hpBarFills(48)).toEqual([8, 8, 8, 8, 8, 8]);
    expect(hpBarColor(0)).toBe('red');
  });
});

describe('UpdateHPBar, both directions and both bar types', () => {
  const traces: { file: string; oldHp: number; newHp: number; maxHp: number; barType: 0 | 1 }[] = [
    { file: 'hp_45_0_max45_type0', oldHp: 45, newHp: 0, maxHp: 45, barType: 0 },
    { file: 'hp_45_0_max45_type1', oldHp: 45, newHp: 0, maxHp: 45, barType: 1 },
    { file: 'hp_0_45_max45_type0', oldHp: 0, newHp: 45, maxHp: 45, barType: 0 },
    { file: 'hp_0_45_max45_type1', oldHp: 0, newHp: 45, maxHp: 45, barType: 1 },
    { file: 'hp_300_299_max300_type0', oldHp: 300, newHp: 299, maxHp: 300, barType: 0 },
    { file: 'hp_300_299_max300_type1', oldHp: 300, newHp: 299, maxHp: 300, barType: 1 },
    { file: 'hp_299_300_max300_type0', oldHp: 299, newHp: 300, maxHp: 300, barType: 0 },
    { file: 'hp_299_300_max300_type1', oldHp: 299, newHp: 300, maxHp: 300, barType: 1 },
    { file: 'hp_13_33_max39_type0', oldHp: 13, newHp: 33, maxHp: 39, barType: 0 },
    { file: 'hp_13_33_max39_type1', oldHp: 13, newHp: 33, maxHp: 39, barType: 1 },
    { file: 'hp_1_21_max300_type0', oldHp: 1, newHp: 21, maxHp: 300, barType: 0 },
    { file: 'hp_1_21_max300_type1', oldHp: 1, newHp: 21, maxHp: 300, barType: 1 },
    { file: 'hp_1_2_max300_type0', oldHp: 1, newHp: 2, maxHp: 300, barType: 0 },
    { file: 'hp_1_2_max300_type1', oldHp: 1, newHp: 2, maxHp: 300, barType: 1 },
    { file: 'hp_0_1_max20_type0', oldHp: 0, newHp: 1, maxHp: 20, barType: 0 },
    { file: 'hp_0_1_max20_type1', oldHp: 0, newHp: 1, maxHp: 20, barType: 1 },
  ];

  for (const trace of traces) {
    it(`${trace.file} matches the trace frame for frame`, () => {
      const text = readFileSync(resolve(__dirname, `../../../notes/66-a5c1-cp1/${trace.file}.csv`), 'utf8');
      const rows = text.trim().split(/\r?\n/).slice(1).map(line => {
        const [tick, pixels, number] = line.split(',');
        return { tick: Number(tick), pixels: Number(pixels), number: number === '' ? null : Number(number) };
      });
      const frames = play(trace.oldHp, trace.newHp, trace.maxHp, trace.barType);
      expect(frames).toHaveLength(rows.length);
      rows.forEach((row, index) => {
        expect(frames[index].pixels, `tick ${row.tick} pixels`).toBe(row.pixels);
        if (trace.barType === 1) expect(frames[index].shownHp, `tick ${row.tick} number`).toBe(row.number);
        expect(frames[index].done).toBe(index === rows.length - 1);
      });
    });
  }

  it('stops a decrease when the next pixel would be 49 or more', () => {
    // max 1, HP 2→1: lengths 96→48. The first downward pixel is 95, so the walk draws 96 once.
    const frames = play(2, 1, 1);
    expect(shown(frames)).toBe('2:96 2:96 2:96 1:96 1:48 1:48 1:48 1:48 1:48');
  });
});
