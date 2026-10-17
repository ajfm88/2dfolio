// GetHPBarLength, DrawHP_ and UpdateHPBar2 (engine/gfx/hp_bar.asm, engine/pokemon/status_screen.asm).
// Increase only. A decrease, and the fainted ending, belong to A5c.

export type HpBarColor = 'green' | 'yellow' | 'red';

/** Party-menu fraction: 3-digit current, '/', 3-digit max, starting at this column. */
export const PARTY_HP_FRACTION_COL = 13;

/**
 * GetHPBarLength. floor(48·hp/max), at least 1.
 * When max ≥ 256 both the product and the max are divided by 4 first, and the
 * divisor is that quotient's low byte.
 */
export function getHpBarLength(hp: number, max: number): number {
  let product = hp * 48;
  let divisor = max & 0xff;
  if (max >= 256) {
    product = Math.floor(product / 4);
    divisor = Math.floor(max / 4) & 0xff;
  }
  if (divisor === 0) return 1;
  const pixels = Math.floor(product / divisor) & 0xff;
  return pixels === 0 ? 1 : pixels;
}

/** DrawHP_: a static bar is 0 px at 0 HP. Any other HP uses GetHPBarLength. */
export function staticHpBarPixels(hp: number, max: number): number {
  if (hp <= 0) return 0;
  return getHpBarLength(hp, max);
}

/** GetHealthBarColor: green at ≥ 27 px, yellow at ≥ 10, otherwise red. */
export function hpBarColor(pixels: number): HpBarColor {
  if (pixels >= 27) return 'green';
  if (pixels >= 10) return 'yellow';
  return 'red';
}

/** Six party-bar fill tiles, each 0–8 pixels, from DrawHPBar's 48 px row. */
export function hpBarFills(pixels: number): number[] {
  const fills = [0, 0, 0, 0, 0, 0];
  let remaining = Math.max(0, pixels);
  for (let i = 0; i < fills.length; i++) {
    if (remaining >= 8) {
      fills[i] = 8;
      remaining -= 8;
    } else {
      fills[i] = remaining;
      remaining = 0;
    }
  }
  return fills;
}

/** PrintNumber's 2-byte, 3-digit party fraction, including the slash. */
export function formatHpFraction(current: number, max: number): string {
  return `${String(current).padStart(3, ' ')}/${String(max).padStart(3, ' ')}`;
}

export interface HpBarFrame {
  pixels: number;
  shownHp: number;
  done: boolean;
}

/**
 * UpdateHPBar2 for an increase, one frame per tick.
 * A step prints the pre-step HP (1 frame) and, when the pixel count changes,
 * draws the old length up through but not including the new length (2 frames
 * each). It stops that walk when the next pixel would be 49. The end prints
 * the final HP (1), draws the final length (2) and waits Delay3 (3).
 */
export class HpBarAnimation {
  pixels: number;
  shownHp: number;
  done: boolean;
  private readonly frames: { pixels: number; shownHp: number }[];
  private index = 0;

  constructor(oldHp: number, newHp: number, maxHp: number) {
    this.frames = scheduleIncrease(oldHp, newHp, maxHp);
    this.pixels = staticHpBarPixels(oldHp, maxHp);
    this.shownHp = oldHp;
    this.done = this.frames.length === 0;
  }

  tick(): HpBarFrame {
    if (this.done) return { pixels: this.pixels, shownHp: this.shownHp, done: true };
    const frame = this.frames[this.index];
    this.index += 1;
    this.pixels = frame.pixels;
    this.shownHp = frame.shownHp;
    this.done = this.index >= this.frames.length;
    return { pixels: this.pixels, shownHp: this.shownHp, done: this.done };
  }
}

function scheduleIncrease(oldHp: number, newHp: number, maxHp: number): { pixels: number; shownHp: number }[] {
  if (newHp <= oldHp) return [];
  const frames: { pixels: number; shownHp: number }[] = [];
  let pixels = staticHpBarPixels(oldHp, maxHp);
  let cur = oldHp;
  while (cur !== newHp) {
    const step = cur + 1;
    const diff = getHpBarLength(step, maxHp) - getHpBarLength(cur, maxHp);
    frames.push({ pixels, shownHp: cur });
    if (diff > 0) {
      let e = getHpBarLength(cur, maxHp);
      let left = diff;
      while (left !== 0) {
        pixels = e;
        frames.push({ pixels, shownHp: cur });
        frames.push({ pixels, shownHp: cur });
        // cp $31: the next pixel would fill past the 48 px bar.
        if (e + 1 >= 49) break;
        e += 1;
        left -= 1;
      }
    }
    cur = step;
  }
  frames.push({ pixels, shownHp: newHp });
  pixels = getHpBarLength(newHp, maxHp);
  for (let i = 0; i < 5; i++) frames.push({ pixels, shownHp: newHp });
  return frames;
}
