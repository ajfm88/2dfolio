// Unused raw growth routines. pret e89ead15 engine/pokemon/experience.asm:1–149.
import { A, type BattleState } from './battle_state';
import { getMonHeader } from './battle_loaders';
import { multiply, divide } from './battle_arithmetic';
import { BattleUnsupportedState } from './battle_move_data';

/** data/growth_rates.asm:15–20; six four-byte records at sym 573535d $16:4E73. */
export const GROWTH_RATE_TABLE: readonly (readonly [number, number, number, number])[] = [
  [0x11, 0, 0, 0], [0x34, 10, 0, 30], [0x34, 20, 0, 70],
  [0x65, 0x8f, 100, 140], [0x45, 0, 0, 0], [0x54, 0, 0, 0],
];

function word24(h: Uint8Array): number { return h[1] * 0x10000 + h[2] * 0x100 + h[3]; }
function store24(h: Uint8Array, value: number): void {
  h[1] = (value >>> 16) & 0xff; h[2] = (value >>> 8) & 0xff; h[3] = value & 0xff;
}

/** experience.asm:139–147: CalcDSquared, using the existing byte Multiply. */
function squared(h: Uint8Array, d: number): void {
  h[1] = 0; h[2] = 0; h[3] = d; h[4] = d; multiply(h);
}

/** engine/pokemon/experience.asm:31–137. D is a byte; no level-one special case or zero clamp. */
export function calcExperience(state: BattleState, level: number): number {
  const row = GROWTH_RATE_TABLE[state.wMonHGrowthRate];
  if (!row) throw new BattleUnsupportedState('growth rate outside six-row table');
  const d = level & 0xff;
  const h = state.mem.slice(A.hProduct, A.hProduct + 10);
  squared(h, d);
  h[4] = d; multiply(h);
  h[4] = row[0] >>> 4; multiply(h);
  h[4] = row[0] & 0x0f;
  if (divide(h, 4)) throw new Error('growth divide froze');
  const cubic = word24(h);
  squared(h, d);
  h[4] = row[1] & 0x7f; multiply(h);
  const square = word24(h);
  h[1] = 0; h[2] = 0; h[3] = d; h[4] = row[2]; multiply(h);
  store24(h, word24(h) - row[3]);
  store24(h, word24(h) + ((row[1] & 0x80) !== 0 ? -square : square));
  store24(h, word24(h) + cubic);
  // hExperience aliases hProduct+1. Preserve the final shared arithmetic scratch, not just the result.
  state.mem.set(h, A.hProduct);
  return word24(h);
}

/** engine/pokemon/experience.asm:2–28. Header is loaded from wLoadedMonSpecies; D starts at 1. */
export function calcLevelFromExperience(state: BattleState): number {
  state.wCurSpecies = state.mem[A.wLoadedMon];
  const header = getMonHeader(state, state.wCurSpecies);
  if (header.growthRate === undefined) throw new BattleUnsupportedState('species header missing growth rate');
  state.wMonHGrowthRate = header.growthRate;
  const experience = state.mem[A.wLoadedMonExp] * 0x10000 + state.readBE(A.wLoadedMonExp + 1);
  let d = 1;
  // No level-100 cap: the GainExperience caller caps EXP first. A full byte cycle is unsupported corruption.
  for (let trials = 0; trials < 256; trials++) {
    d = (d + 1) & 0xff;
    if (calcExperience(state, d) > experience) return (d - 1) & 0xff;
  }
  throw new BattleUnsupportedState('level search wrapped without exceeding loaded experience');
}
