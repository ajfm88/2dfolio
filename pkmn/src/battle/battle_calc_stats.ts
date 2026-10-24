// Unused shared CalcStat/CalcStats. pret e89ead15 home/move_mon.asm:34-231.
import { A, type BattleState } from './battle_state';
import { multiply, divide } from './battle_arithmetic';

const STAT_HP = 1;
const STAT_ATTACK = 2;
const STAT_DEFENSE = 3;
const STAT_SPECIAL = 5;
function u8(n: number): number { return n & 0xff; }

function statIv(state: BattleState, stat: number, statExpBase: number): number {
  const first = state.mem[statExpBase + 11];
  const second = state.mem[statExpBase + 12];
  if (stat === STAT_ATTACK) return first >> 4;
  if (stat === STAT_DEFENSE) return first & 0x0f;
  if (stat === 4) return second >> 4;
  if (stat === STAT_SPECIAL) return second & 0x0f;
  const atk = first >> 4;
  const def = first & 0x0f;
  const spd = second >> 4;
  const spc = second & 0x0f;
  return ((atk & 1) << 3) | ((def & 1) << 2) | ((spd & 1) << 1) | (spc & 1);
}

/** pret home/move_mon.asm:54-231. HL points one byte before HP stat exp; C is 1..5.
 * The b=0 arithmetic body is moved unchanged from battle_damage_asm.ts. Scratch stays local, as before. */
export function calcStat(state: BattleState, stat: number, b: number, statExpBase: number): number {
  const base = state.mem[A.wMonHIndex + stat];
  const iv = statIv(state, stat, statExpBase);
  let de = base + iv;
  // home/move_mon.asm:73-92: increment before comparing; 255 exits before squaring.
  let root = 0;
  if ((b & 0xff) !== 0) {
    const experience = state.readBE(statExpBase + stat * 2 - 1);
    do { root++; } while (root < 255 && root * root < experience);
  }
  const statExperience = root >> 2;
  de = (de * 2 + statExperience) & 0xffff;
  const level = state.wCurEnemyLevel;
  const h = new Uint8Array(10);
  h[2] = (de >> 8) & 0xff;
  h[3] = de & 0xff;
  h[4] = level;
  multiply(h);
  const mid = h[1];
  const high = h[2];
  const low = h[3];
  h[0] = mid;
  h[1] = high;
  h[2] = low;
  h[4] = 100;
  if (divide(h, 3)) throw new Error('stat divide froze');
  if (stat === STAT_HP) {
    const withLevel = h[3] + level;
    h[3] = u8(withLevel);
    if (withLevel > 255) h[2] = u8(h[2] + 1);
  }
  const bonus = stat === STAT_HP ? 10 : 5;
  const added = h[3] + bonus;
  h[3] = u8(added);
  if (added > 255) h[2] = u8(h[2] + 1);
  if (h[2] > 0x03 || (h[2] === 0x03 && h[3] >= 0xe8)) return 999;
  return ((h[2] << 8) | h[3]) & 0xffff;
}

/** home/move_mon.asm:34-48: C=1..5, five big-endian words at DE. No frames or RNG. */
export function calcStats(state: BattleState, b: number, statExpBase: number, destination: number): void {
  for (let stat = 1; stat <= 5; stat++) {
    state.writeBE(destination + (stat - 1) * 2, calcStat(state, stat, b, statExpBase));
  }
}
