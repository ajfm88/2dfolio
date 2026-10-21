// GetHPBarLength, DrawHP_ and UpdateHPBar2 (engine/gfx/hp_bar.asm, engine/pokemon/status_screen.asm).
// Both directions and both bar types. The default type is 1, which field medicine already calls.

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
 * UpdateHPBar, one frame per tick. Bar type 0 skips the per-step number, so a
 * step whose pixel count does not change adds no frame. The walk draws the old
 * length and stops before the new one, and also when `(e + delta) & $FF` would
 * be 49 or more. A final HP of 0 draws an empty bar. Equal HP returns at once.
 */
export class HpBarAnimation {
  pixels: number;
  shownHp: number;
  done: boolean;
  private readonly frames: { pixels: number; shownHp: number }[];
  private index = 0;

  constructor(oldHp: number, newHp: number, maxHp: number, barType: 0 | 1 = 1) {
    this.frames = scheduleHpBar(oldHp, newHp, maxHp, barType);
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

function scheduleHpBar(
  oldHp: number, newHp: number, maxHp: number, barType: 0 | 1,
): { pixels: number; shownHp: number }[] {
  if (newHp === oldHp) return [];
  const delta = newHp > oldHp ? 1 : -1;
  const frames: { pixels: number; shownHp: number }[] = [];
  let pixels = staticHpBarPixels(oldHp, maxHp);
  let cur = oldHp;
  while (cur !== newHp) {
    const step = cur + delta;
    const oldLen = getHpBarLength(cur, maxHp);
    const newLen = getHpBarLength(step, maxHp);
    const diff = delta > 0 ? newLen - oldLen : oldLen - newLen;
    if (barType !== 0) frames.push({ pixels, shownHp: cur });
    if (diff > 0) {
      let e = oldLen;
      let left = diff;
      while (left !== 0) {
        pixels = e & 0xff;
        frames.push({ pixels, shownHp: cur });
        frames.push({ pixels, shownHp: cur });
        // cp $31. A decrease through 0 lands on $FF and stops here too.
        const next = (e + delta) & 0xff;
        if (next >= 0x31) break;
        e = next;
        left -= 1;
      }
    }
    cur = step;
  }
  if (barType !== 0) frames.push({ pixels, shownHp: newHp });
  // A final HP of 0 leaves E holding that HP, not GetHPBarLength's minimum 1.
  pixels = newHp === 0 ? 0 : getHpBarLength(newHp, maxHp);
  for (let i = 0; i < 5; i++) frames.push({ pixels, shownHp: newHp });
  return frames;
}
