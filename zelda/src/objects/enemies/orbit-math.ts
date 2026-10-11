// Shared by Patra children and pond-fairy hearts; keep the NES byte arithmetic.
export interface OrbitState {
  x: number;
  y: number;
  xFrac: number;
  yFrac: number;
  angleWhole: number;
  angleFrac: number;
  qSpeedFrac: number;
}

// Z_04.asm:11867 PatraSines (also used by RotateObjectLocation).
export const PATRA_SINES: readonly number[] = [
  0, 24, 48, 71, 90, 106, 118, 125, 128, 125, 118, 106, 90, 71, 48, 24,
];

/** Z_04.asm:11993 ShiftMultiply: use only the requested high multiplier bits. */
export function shiftMultiply(a: number, multiplier: number, bitCount: number): number {
  let product = 0;
  let mult = multiplier;
  for (let i = 0; i < bitCount; i++) {
    product <<= 1;
    mult <<= 1;
    if (mult & 0x100) {
      product += a;
      mult &= 0xff;
    }
  }
  return product;
}

/** Z_04.asm:12025 DecreaseObjectAngle: 16-bit subtract, borrow, then 5-bit wrap. */
export function decreaseObjectAngle(s: OrbitState, low: number, high = 0): void {
  const borrow = s.angleFrac < low ? 1 : 0;
  s.angleFrac = (s.angleFrac - low) & 0xff;
  s.angleWhole = (s.angleWhole - high - borrow) & 0x1f;
}

/** Z_04.asm:11880 RotateObjectLocation: integrate signed fixed-point increments. */
export function rotateObjectLocation(s: OrbitState, cosBits: number, sinBits: number): void {
  const xProduct = shiftMultiply(s.qSpeedFrac, PATRA_SINES[s.angleWhole & 0x0f] ?? 0, sinBits);
  const xFrac = xProduct & 0xff;
  const xWhole = (xProduct >> 8) & 0xff;
  if ((s.angleWhole & 0x18) >= 0x10) {
    const borrow = s.xFrac < xFrac ? 1 : 0;
    s.xFrac = (s.xFrac - xFrac) & 0xff;
    s.x -= xWhole + borrow;
  } else {
    const carry = s.xFrac + xFrac > 0xff ? 1 : 0;
    s.xFrac = (s.xFrac + xFrac) & 0xff;
    s.x += xWhole + carry;
  }

  const yProduct = shiftMultiply(s.qSpeedFrac, PATRA_SINES[(s.angleWhole + 8) & 0x0f] ?? 0, cosBits);
  const yFrac = yProduct & 0xff;
  const yWhole = (yProduct >> 8) & 0xff;
  if ((((s.angleWhole - 8) & 0x1f) & 0x18) >= 0x10) {
    const borrow = s.yFrac < yFrac ? 1 : 0;
    s.yFrac = (s.yFrac - yFrac) & 0xff;
    s.y -= yWhole + borrow;
  } else {
    const carry = s.yFrac + yFrac > 0xff ? 1 : 0;
    s.yFrac = (s.yFrac + yFrac) & 0xff;
    s.y += yWhole + carry;
  }
}
