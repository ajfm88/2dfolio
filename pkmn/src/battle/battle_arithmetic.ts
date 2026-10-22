// Shared cartridge Multiply / Divide, extracted unchanged from checkpoint-05.
function u8(n: number): number { return n & 0xff; }

/**
 * HRAM union at a scratch buffer. Index 0 is hProduct/hDividend/hQuotient.
 * 1..3 are hMultiplicand. 4 is hMultiplier/hDivisor. 5..9 are hDivideBuffer.
 * hMultiplyBuffer is 6..9. engine/math/multiply_divide.asm.
 */
export function multiply(h: Uint8Array): void {
  let count = 8;
  h[0] = 0;
  h[6] = 0;
  h[7] = 0;
  h[8] = 0;
  h[9] = 0;
  for (;;) {
    const bit = h[4] & 1;
    h[4] >>= 1;
    if (bit !== 0) {
      let carry = 0;
      for (let i = 0; i < 4; i++) {
        const sum = h[9 - i] + h[3 - i] + carry;
        h[9 - i] = u8(sum);
        carry = sum > 255 ? 1 : 0;
      }
    }
    count = u8(count - 1);
    if (count === 0) break;
    let carry = (h[3] & 0x80) !== 0;
    h[3] = u8(h[3] << 1);
    for (let i = 2; i >= 0; i--) {
      const next = (h[i] & 0x80) !== 0;
      h[i] = u8((h[i] << 1) | (carry ? 1 : 0));
      carry = next;
    }
  }
  h[0] = h[6];
  h[1] = h[7];
  h[2] = h[8];
  h[3] = h[9];
}

/** Returns true when the divisor is 0: the cartridge's inner loop never sets carry. */
export function divide(h: Uint8Array, byteCount: number): boolean {
  if (h[4] === 0) return true;
  h[5] = 0;
  h[6] = 0;
  h[7] = 0;
  h[8] = 0;
  h[9] = 0;
  let e = 9;
  let b = byteCount;
  for (let guard = 0; guard < 5000; guard++) {
    for (let inner = 0; inner < 300; inner++) {
      const low = h[1] - h[5];
      const high = h[0] - h[4] - (low < 0 ? 1 : 0);
      if (high < 0) break;
      h[0] = u8(high);
      h[1] = u8(low);
      h[9] = u8(h[9] + 1);
      if (inner === 299) throw new Error('divide inner loop');
    }
    if (b === 1) {
      const remainder = h[1];
      const q0 = h[6];
      const q1 = h[7];
      const q2 = h[8];
      const q3 = h[9];
      h[4] = remainder;
      h[0] = q0;
      h[1] = q1;
      h[2] = q2;
      h[3] = q3;
      return false;
    }
    let carry = (h[9] & 0x80) !== 0;
    h[9] = u8(h[9] << 1);
    for (let i = 8; i >= 6; i--) {
      const next = (h[i] & 0x80) !== 0;
      h[i] = u8((h[i] << 1) | (carry ? 1 : 0));
      carry = next;
    }
    e = u8(e - 1);
    if (e === 0) {
      e = 8;
      h[4] = h[5];
      h[5] = 0;
      h[0] = h[1];
      h[1] = h[2];
      h[2] = h[3];
    }
    if (e === 1) b = u8(b - 1);
    const bit = h[4] & 1;
    h[4] >>= 1;
    h[5] = u8((h[5] >> 1) | (bit << 7));
  }
  throw new Error('divide did not finish');
}
