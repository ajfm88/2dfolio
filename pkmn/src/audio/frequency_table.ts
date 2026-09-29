/**
 * Game Boy note frequency table.
 *
 * Derived from audio/notes.asm and Audio1_CalculateFrequency in engine_1.asm.
 *
 * The ASM routine:
 *   1. Look up 16-bit value from pitchTable (these are octave-1 values)
 *   2. Loop: if stored_octave (8-N) == 7, done. Otherwise SRA d / RR e, inc counter.
 *      This shifts right (octave - 1) times using ARITHMETIC shift (sign-preserving).
 *   3. Add 8 to high byte (d += 8)
 *   4. Write d to NR14 (high), e to NR13 (low)
 *   5. Hz = 131072 / (2048 - (freq_reg & 0x7FF))
 *
 * CRITICAL: octave 1 = HIGHEST (0 shifts), octave 8 = LOWEST (7 shifts).
 * The shift uses SRA (arithmetic), not SRL (logical) — preserves sign bit.
 */

// Raw 16-bit values from audio/notes.asm
const PITCH_TABLE: number[] = [
  0xF82C, // C_
  0xF89D, // C#
  0xF907, // D_
  0xF96B, // D#
  0xF9CA, // E_
  0xFA23, // F_
  0xFA77, // F#
  0xFAC7, // G_
  0xFB12, // G#
  0xFB58, // A_
  0xFB9B, // A#
  0xFBDA, // B_
];

/**
 * Simulate Z80 SRA d / RR e (16-bit arithmetic right shift).
 * SRA preserves the sign bit of d (bit 7 stays the same).
 */
function sraRr(d: number, e: number): [number, number] {
  const carry = d & 1; // bit shifted out of d into e
  // SRA: arithmetic shift right (bit 7 preserved)
  d = ((d >> 1) | (d & 0x80)) & 0xFF;
  // RR: rotate right through carry
  e = ((carry << 7) | (e >> 1)) & 0xFF;
  return [d, e];
}

/**
 * Calculate the GB frequency register value for a given pitch and octave.
 * Faithfully matches Audio1_CalculateFrequency in engine_1.asm.
 */
export function getRegisterValue(pitch: number, octave: number): number {
  const raw = PITCH_TABLE[pitch];
  let d = (raw >> 8) & 0xFF;
  let e = raw & 0xFF;

  // The ASM loops from stored_octave (8 - octave) up to 7.
  // stored_octave = 8 - octave. Loop count = 7 - stored_octave = octave - 1.
  // So octave 1 = 0 shifts, octave 8 = 7 shifts.
  const shifts = octave - 1;
  for (let i = 0; i < shifts; i++) {
    [d, e] = sraRr(d, e);
  }

  // d += 8
  d = (d + 8) & 0xFF;

  return (d << 8) | e;
}

/**
 * Convert a GB frequency register value to Hz.
 * Only the lower 11 bits (bits 0-10) are the frequency register.
 * Hz = 131072 / (2048 - register_value)
 */
export function registerToHz(regVal: number): number {
  const freqReg = regVal & 0x7FF;
  if (freqReg >= 2048) return 0;
  const divisor = 2048 - freqReg;
  if (divisor <= 0) return 0;
  return 131072 / divisor;
}

/**
 * Get frequency in Hz for a given pitch (0-11) and octave (1-8).
 */
export function getFrequencyHz(pitch: number, octave: number): number {
  return registerToHz(getRegisterValue(pitch, octave));
}

// Pre-compute frequency table for fast lookup
const FREQ_TABLE: number[][] = [];
for (let octave = 1; octave <= 8; octave++) {
  FREQ_TABLE[octave] = [];
  for (let pitch = 0; pitch < 12; pitch++) {
    FREQ_TABLE[octave][pitch] = getFrequencyHz(pitch, octave);
  }
}

/**
 * Fast frequency lookup from pre-computed table.
 */
export function getFrequency(pitch: number, octave: number): number {
  return FREQ_TABLE[octave]?.[pitch] ?? 0;
}
