// Unused damage numbers. pret e89ead15 core.asm:4201–4713, 5246–5356, 5602–5636.
// home/math.asm, engine/math/multiply_divide.asm, home/move_mon.asm CalcStat, home/random.asm.
// The running game does not import this module. damage.ts and the checkpoint-04 adapter stay.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TYPE_NAMES } from '../rom/constants';
import { A, LINK_STATE_BATTLING, PARTYMON_STRUCT_LENGTH, type BattleState } from './battle_state';
import type { Program } from './battle_menu_context';
import { battleRandom } from './battle_random';
import { getMonHeader } from './battle_loaders';
import { multiply, divide } from './battle_arithmetic';
import { calcStat } from './battle_calc_stats';

/** Z from the routine's last flag write. Success is NZ; zero power and an OHKO miss are Z. */
export interface AsmFlags { z: boolean }

/** Registers b, c, d, e after GetDamageVars. On Z the attack, defense and level were not written. */
export interface DamageVars {
  z: boolean;
  attack: number;
  defense: number;
  power: number;
  level: number;
}

/** Stands in for JumpMoveEffect. The body is A5c3c. A returned Program is yielded through. */
export type OhkoPort = (state: BattleState) => Program | void;

const SPECIAL = 0x14;
const STAT_ATTACK = 2;
const STAT_DEFENSE = 3;
const STAT_SPECIAL = 5;
const EXPLODE_EFFECT = 0x07;
const TWO_TO_FIVE_ATTACKS_EFFECT = 0x1d;
const EFFECT_1E = 0x1e;
const OHKO_EFFECT = 0x26;
const REFLECT_BIT = 1 << 2;
const LIGHT_SCREEN_BIT = 1 << 1;
const FOCUS_ENERGY_BIT = 1 << 2;
const STAB_BIT = 0x80;
const CAP_HIGH = 0x03;
const CAP_LOW = 0xe6;
const CAP_VALUE = 0x03e5;
/** party_struct: MON_MAXHP is 34, then attack, defense, speed, special. pokemon_data_constants.asm. */
const MON_MAX_HP = 34;
const MON_ATTACK = 36;
const MON_DEFENSE = 38;
const MON_SPECIAL = 42;
/**
 * wLoadedMon follows wMaxItemQuantity. wCurPartySpecies is $CF90, so wLoadedMon is $CF97.
 * MON_SPD_EXP is 23. GetEnemyMonStat copies the two DV bytes here (core.asm:4456–4465).
 */
const LOADED_MON_SPEED_EXP = 0xcfae;
const HIGH_CRITICAL_MOVES = [0x02, 0x4b, 0x98, 0xa3];

interface ChartRow { attack: number; defend: number; multiplier: number }

const TYPE_BYTE: Readonly<Record<string, number>> = Object.fromEntries(
  Object.entries(TYPE_NAMES).map(([byte, name]) => [name, Number(byte)]),
);

function chartByte(multiplier: number): number {
  if (multiplier === 2) return 0x14;
  if (multiplier === 0.5) return 0x05;
  if (multiplier === 0) return 0x00;
  throw new Error(`type chart multiplier ${multiplier}`);
}

function loadTypeChart(): ChartRow[] {
  const path = fileURLToPath(new URL('../../data/type_chart.json', import.meta.url));
  const rows = JSON.parse(readFileSync(path, 'utf8')) as { attacker: string; defender: string; multiplier: number }[];
  if (rows.length !== 82) throw new Error(`type chart has ${rows.length} rows`);
  return rows.map(row => ({
    attack: TYPE_BYTE[row.attacker] ?? unexpectedType(row.attacker),
    defend: TYPE_BYTE[row.defender] ?? unexpectedType(row.defender),
    multiplier: chartByte(row.multiplier),
  }));
}

function unexpectedType(name: string): never {
  throw new Error(`type chart name ${name}`);
}

const TYPE_CHART: readonly ChartRow[] = loadTypeChart();

function u8(n: number): number {
  return n & 0xff;
}

function quotientWord(h: Uint8Array): number {
  return ((h[2] << 8) | h[3]) & 0xffff;
}

/** hMultiplicand = value, multiply, divide by `divisor` with b = 4. Stores the low word. */
function multiplyDivide(value: number, multiplier: number, divisor: number): number {
  const h = new Uint8Array(10);
  h[2] = (value >> 8) & 0xff;
  h[3] = value & 0xff;
  h[4] = multiplier & 0xff;
  multiply(h);
  h[4] = divisor & 0xff;
  if (divide(h, 4)) throw new Error('multiplyDivide froze');
  return quotientWord(h);
}

function partyWord(state: BattleState, party: number, slot: number, offset: number): number {
  return state.readBE(party + (slot & 0xff) * PARTYMON_STRUCT_LENGTH + offset);
}

/** core.asm:4429–4468. Link reads the enemy party. Otherwise CalcStat, b = 0. */
export function getEnemyMonStat(state: BattleState, stat: number): number {
  if (state.wLinkState === LINK_STATE_BATTLING) {
    return partyWord(state, A.wEnemyMons, state.wEnemyMonPartyPos, MON_MAX_HP + (stat - 1) * 2);
  }
  state.wCurEnemyLevel = state.wEnemyMonLevel;
  state.wCurSpecies = state.wEnemyMonSpecies;
  getMonHeader(state, state.wCurSpecies);
  state.mem[LOADED_MON_SPEED_EXP] = state.mem[A.wEnemyMonDVs];
  state.mem[LOADED_MON_SPEED_EXP + 1] = state.mem[A.wEnemyMonDVs + 1];
  return calcStat(state, stat, 0, LOADED_MON_SPEED_EXP - 11);
}

function scaleStats(offense: number, defense: number): { attack: number; defense: number } {
  const off = offense & 0xffff;
  const def = defense & 0xffff;
  if (((off | def) & 0xff00) === 0) return { attack: off & 0xff, defense: def & 0xff };
  let scaledOffense = off >> 2;
  const scaledDefense = def >> 2;
  if (scaledOffense === 0) scaledOffense = 1;
  return { attack: scaledOffense & 0xff, defense: scaledDefense & 0xff };
}

function doubled(stat: number, screen: boolean): number {
  return screen ? (stat << 1) & 0xffff : stat & 0xffff;
}

function zeroVars(power: number): DamageVars {
  return { z: true, attack: 0, defense: 0, power, level: 0 };
}

/** core.asm:4201–4311. */
export function getDamageVarsForPlayerAttack(state: BattleState): DamageVars {
  state.wDamage = 0;
  const power = state.wPlayerMovePower;
  if (power === 0) return zeroVars(power);
  const crit = state.wCriticalHitOrOHKO !== 0;
  const special = state.wPlayerMoveType >= SPECIAL;
  const screen = special
    ? (state.wEnemyBattleStatus3 & LIGHT_SCREEN_BIT) !== 0
    : (state.wEnemyBattleStatus3 & REFLECT_BIT) !== 0;
  let defense = doubled(special ? state.wEnemyMonSpecial : state.wEnemyMonDefense, screen);
  let offense = special ? state.wBattleMonSpecial : state.wBattleMonAttack;
  if (crit) {
    defense = getEnemyMonStat(state, special ? STAT_SPECIAL : STAT_DEFENSE);
    offense = partyWord(state, A.wPartyMons, state.wPlayerMonNumber, special ? MON_SPECIAL : MON_ATTACK);
  }
  const scaled = scaleStats(offense, defense);
  let level = state.wBattleMonLevel;
  if (crit) level = u8(level << 1);
  return { z: false, attack: scaled.attack, defense: scaled.defense, power, level };
}

/** core.asm:4314–4425. */
export function getDamageVarsForEnemyAttack(state: BattleState): DamageVars {
  state.wDamage = 0;
  const power = state.wEnemyMovePower;
  if (power === 0) return zeroVars(power);
  const crit = state.wCriticalHitOrOHKO !== 0;
  const special = state.wEnemyMoveType >= SPECIAL;
  const screen = special
    ? (state.wPlayerBattleStatus3 & LIGHT_SCREEN_BIT) !== 0
    : (state.wPlayerBattleStatus3 & REFLECT_BIT) !== 0;
  let defense = doubled(special ? state.wBattleMonSpecial : state.wBattleMonDefense, screen);
  let offense = special ? state.wEnemyMonSpecial : state.wEnemyMonAttack;
  if (crit) {
    defense = partyWord(state, A.wPartyMons, state.wPlayerMonNumber, special ? MON_SPECIAL : MON_DEFENSE);
    offense = getEnemyMonStat(state, special ? STAT_SPECIAL : STAT_ATTACK);
  }
  const scaled = scaleStats(offense, defense);
  let level = state.wEnemyMonLevel;
  if (crit) level = u8(level << 1);
  return { z: false, attack: scaled.attack, defense: scaled.defense, power, level };
}

function atLeast998(high: number, low: number): boolean {
  if (high < CAP_HIGH) return false;
  if (high >= CAP_HIGH + 1) return true;
  return low >= CAP_LOW;
}

/** The shared-damage add, the 998 compare, the 997 store, then +2. core.asm:4558–4636. */
function storeDamage(state: BattleState, q1: number, q2: number, q3: number): void {
  const high0 = state.mem[A.wDamage];
  const low0 = state.mem[A.wDamage + 1];
  let cap = false;
  const lowAdd = q3 + high0;
  q3 = u8(lowAdd);
  if (lowAdd > 255) {
    q2 = u8(q2 + 1);
    if (q2 === 0) cap = true;
  }
  if (!cap && q1 !== 0) cap = true;
  if (!cap && atLeast998(q2, q3)) cap = true;
  if (!cap) {
    const storedLow = q3 + low0;
    const storedHigh = q2 + high0 + (storedLow > 255 ? 1 : 0);
    if (storedHigh > 255) cap = true;
    else {
      const high = u8(storedHigh);
      const low = u8(storedLow);
      state.mem[A.wDamage] = high;
      state.mem[A.wDamage + 1] = low;
      if (atLeast998(high, low)) cap = true;
    }
  }
  if (cap) {
    state.mem[A.wDamage] = (CAP_VALUE >> 8) & 0xff;
    state.mem[A.wDamage + 1] = CAP_VALUE & 0xff;
  }
  const plus = state.mem[A.wDamage + 1] + 2;
  state.mem[A.wDamage + 1] = u8(plus);
  if (plus > 255) state.mem[A.wDamage] = u8(state.mem[A.wDamage] + 1);
}

/**
 * core.asm:4470–4642. Defense 0 never returns: VBlank keeps running, so this yields 'serviced' forever.
 * `ohko` is called for OHKO_EFFECT and is not implemented here.
 */
export function* calculateDamage(
  state: BattleState,
  attack: number,
  defense: number,
  power: number,
  level: number,
  ohko: OhkoPort = () => undefined,
): Program<AsmFlags> {
  const effect = state.hWhoseTurn === 0 ? state.wPlayerMoveEffect : state.wEnemyMoveEffect;
  let def = defense & 0xff;
  if (effect === EXPLODE_EFFECT) {
    def >>= 1;
    if (def === 0) def = 1;
  }
  const multiHit = effect === TWO_TO_FIVE_ATTACKS_EFFECT || effect === EFFECT_1E;
  if (!multiHit) {
    if (effect === OHKO_EFFECT) {
      const port = ohko(state);
      if (port !== undefined) yield* port;
      return { z: u8(state.wMoveMissed - 1) === 0 };
    }
    if ((power & 0xff) === 0) return { z: true };
  }
  if (def === 0) {
    for (;;) yield 'serviced';
  }
  const h = new Uint8Array(10);
  const doubledLevel = (level & 0xff) << 1;
  if (doubledLevel > 255) h[2] = 1;
  h[3] = u8(doubledLevel);
  h[4] = 5;
  if (divide(h, 4)) throw new Error('level divide froze');
  h[3] = u8(h[3] + 1);
  h[3] = u8(h[3] + 1);
  h[4] = power & 0xff;
  multiply(h);
  h[4] = attack & 0xff;
  multiply(h);
  h[4] = def;
  if (divide(h, 4)) throw new Error('defense divide froze');
  h[4] = 50;
  if (divide(h, 4)) throw new Error('constant divide froze');
  storeDamage(state, h[1], h[2], h[3]);
  return { z: false };
}

/** core.asm:4649–4713. One BattleRandom, then three circular RLCs; incoming carry is irrelevant. */
export function criticalHitTest(state: BattleState): void {
  state.wCriticalHitOrOHKO = 0;
  const enemyTurn = state.hWhoseTurn !== 0;
  const species = enemyTurn ? state.wEnemyMonSpecies : state.wBattleMonSpecies;
  state.wCurSpecies = species;
  getMonHeader(state, species);
  let threshold = state.mem[A.wMonHBaseStats + 3] >> 1;
  const power = enemyTurn ? state.wEnemyMovePower : state.wPlayerMovePower;
  if (power === 0) return;
  const moveId = enemyTurn ? state.wEnemyMoveNum : state.wPlayerMoveNum;
  const status = enemyTurn ? state.wEnemyBattleStatus2 : state.wPlayerBattleStatus2;
  if ((status & FOCUS_ENERGY_BIT) !== 0) threshold >>= 1;
  else {
    const carry = (threshold & 0x80) !== 0;
    threshold = u8(threshold << 1);
    if (carry) threshold = 0xff;
  }
  if (HIGH_CRITICAL_MOVES.includes(moveId)) {
    for (let i = 0; i < 2; i++) {
      const carry = (threshold & 0x80) !== 0;
      threshold = u8(threshold << 1);
      if (carry) threshold = 0xff;
    }
  } else threshold >>= 1;
  const rolled = rotl8(battleRandom(state), 3);
  if (rolled < threshold) state.wCriticalHitOrOHKO = 1;
}

/** core.asm:5246–5356. Each matching chart row is applied, and the stored byte is only the last one. */
export function adjustDamageForMoveType(state: BattleState): void {
  const player = state.hWhoseTurn === 0;
  const attack1 = player ? state.wBattleMonType1 : state.wEnemyMonType1;
  const attack2 = player ? state.wBattleMonType2 : state.wEnemyMonType2;
  const defend1 = player ? state.wEnemyMonType1 : state.wBattleMonType1;
  const defend2 = player ? state.wEnemyMonType2 : state.wBattleMonType2;
  const moveType = player ? state.wPlayerMoveType : state.wEnemyMoveType;
  state.wMoveType = moveType;
  if (moveType === attack1 || moveType === attack2) {
    const damage = state.wDamage & 0xffff;
    state.wDamage = (damage + (damage >> 1)) & 0xffff;
    state.wDamageMultipliers |= STAB_BIT;
  }
  for (const row of TYPE_CHART) {
    if (row.attack !== moveType) continue;
    if (row.defend !== defend1 && row.defend !== defend2) continue;
    const stab = state.wDamageMultipliers & STAB_BIT;
    state.wDamageMultipliers = u8(row.multiplier + stab);
    const next = multiplyDivide(state.wDamage, row.multiplier, 10);
    state.wDamage = next;
    if (next === 0) state.wMoveMissed = 1;
  }
}

function rotl8(value: number, count: number): number {
  return u8((value << count) | (value >>> (8 - count)));
}

function rrca(value: number): number {
  return u8((value >> 1) | ((value & 1) << 7));
}

/** core.asm:5602–5636. No draw at 0 or 1. RRCA rejects below 217. No final minimum. */
export function randomizeDamage(state: BattleState): void {
  const high = state.mem[A.wDamage];
  const low = state.mem[A.wDamage + 1];
  if (high === 0 && low < 2) return;
  let rolled = 0;
  for (;;) {
    rolled = rrca(battleRandom(state));
    if (rolled >= 217) break;
  }
  state.wDamage = multiplyDivide(state.wDamage, rolled, 255);
}
