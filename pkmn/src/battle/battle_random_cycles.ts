/** T-cycles, pret e89ead15. The DIV read samples before its own LDH's12 cycles.
 * Only these random-routine paths are timed; caller code between calls and the
 * rest of the frame are the model's approximation (note72 §11.28.3). */
export const RANDOM_CYCLES = {
  frame: 70224,
  // core.asm:6731-6733: LD A,[a16]16 + CP d8 8 + JP NZ,a16(taken)16.
  battlePrefix: 40,
  // home/random.asm:4-6 PUSH*3=48; macros/farcall.asm:9-11=8+12+24=44;
  // home/bankswitch2.asm:9-14,21=12+16+4+12+16+24+4=88.
  beforeFirst: 180,
  // engine/math/random.asm:3,8: LDH A,[rDIV].
  read: 12,
  // engine/math/random.asm:4-7: LD B,A4 + LDH12 + ADC4 + LDH12.
  betweenReads: 32,
  // engine/math/random.asm:9-13=4+12+4+12+16=48;
  // home/bankswitch2.asm:15-19=12+4+12+16+16=60;
  // home/random.asm:8-12=12+12+12+12+16=64.
  afterSecond: 172,
} as const;
