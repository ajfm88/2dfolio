// Gen 1 damage calculation (faithful to original)

import type { BattlePokemon, StatStages } from './types';
import { getTypeChart, getMove } from './data';
import { isHighCritMove, getEffectiveTypes } from './effects';

// Gen 1 stat stage multipliers: [numerator, denominator] for stages -6 to +6
const STAGE_NUMDEN: [number, number][] = [
  [2, 8], [2, 7], [2, 6], [2, 5], [2, 4], [2, 3], // -6 to -1
  [2, 2],                                            //  0
  [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2],  // +1 to +6
];

function stageMultiply(value: number, stage: number): number {
  const [n, d] = STAGE_NUMDEN[Math.max(0, Math.min(12, stage + 6))];
  return Math.floor(value * n / d);
}

// ──────── Stat effect definitions ────────

export interface StatEffect {
  who: 'attacker' | 'defender';
  stat: keyof StatStages;
  stages: number;
  isSideEffect: boolean;
}

const STAT_EFFECTS: Record<string, StatEffect> = {
  // Pure stat moves (power = 0): lower target's stat
  'ATTACK_DOWN1_EFFECT':   { who: 'defender', stat: 'attack',   stages: -1, isSideEffect: false },
  'DEFENSE_DOWN1_EFFECT':  { who: 'defender', stat: 'defense',  stages: -1, isSideEffect: false },
  'SPEED_DOWN1_EFFECT':    { who: 'defender', stat: 'speed',    stages: -1, isSideEffect: false },
  'SPECIAL_DOWN1_EFFECT':  { who: 'defender', stat: 'special',  stages: -1, isSideEffect: false },
  'ACCURACY_DOWN1_EFFECT': { who: 'defender', stat: 'accuracy', stages: -1, isSideEffect: false },
  'EVASION_DOWN1_EFFECT':  { who: 'defender', stat: 'evasion',  stages: -1, isSideEffect: false },
  'ATTACK_DOWN2_EFFECT':   { who: 'defender', stat: 'attack',   stages: -2, isSideEffect: false },
  'DEFENSE_DOWN2_EFFECT':  { who: 'defender', stat: 'defense',  stages: -2, isSideEffect: false },
  'SPEED_DOWN2_EFFECT':    { who: 'defender', stat: 'speed',    stages: -2, isSideEffect: false },
  'SPECIAL_DOWN2_EFFECT':  { who: 'defender', stat: 'special',  stages: -2, isSideEffect: false },
  // Pure stat moves (power = 0): raise user's stat
  'ATTACK_UP1_EFFECT':     { who: 'attacker', stat: 'attack',   stages: 1, isSideEffect: false },
  'DEFENSE_UP1_EFFECT':    { who: 'attacker', stat: 'defense',  stages: 1, isSideEffect: false },
  'SPEED_UP1_EFFECT':      { who: 'attacker', stat: 'speed',    stages: 1, isSideEffect: false },
  'SPECIAL_UP1_EFFECT':    { who: 'attacker', stat: 'special',  stages: 1, isSideEffect: false },
  'EVASION_UP1_EFFECT':    { who: 'attacker', stat: 'evasion',  stages: 1, isSideEffect: false },
  'ATTACK_UP2_EFFECT':     { who: 'attacker', stat: 'attack',   stages: 2, isSideEffect: false },
  'DEFENSE_UP2_EFFECT':    { who: 'attacker', stat: 'defense',  stages: 2, isSideEffect: false },
  'SPEED_UP2_EFFECT':      { who: 'attacker', stat: 'speed',    stages: 2, isSideEffect: false },
  'SPECIAL_UP2_EFFECT':    { who: 'attacker', stat: 'special',  stages: 2, isSideEffect: false },
  // Side effects on damaging moves (~33% chance)
  'ATTACK_DOWN_SIDE_EFFECT':  { who: 'defender', stat: 'attack',  stages: -1, isSideEffect: true },
  'DEFENSE_DOWN_SIDE_EFFECT': { who: 'defender', stat: 'defense', stages: -1, isSideEffect: true },
  'SPEED_DOWN_SIDE_EFFECT':   { who: 'defender', stat: 'speed',   stages: -1, isSideEffect: true },
  'SPECIAL_DOWN_SIDE_EFFECT': { who: 'defender', stat: 'special', stages: -1, isSideEffect: true },
};

export function getStatEffect(effect: string): StatEffect | null {
  return STAT_EFFECTS[effect] ?? null;
}

/** Apply a stat stage change. Returns false if already at limit. */
export function applyStatStage(pokemon: BattlePokemon, stat: keyof StatStages, stages: number): boolean {
  const current = pokemon.statStages[stat];
  const next = Math.max(-6, Math.min(6, current + stages));
  if (next === current) return false;
  pokemon.statStages[stat] = next;
  return true;
}

// ──────── Badge stat boosts (Gen 1) ────────
// Assembly: ApplyBadgeStatBoosts (engine/battle/core.asm:6639-6690)
// Each badge multiplies the corresponding stat by 1.125x (stat += stat/8).
// The Gen 1 bug: boosts are reapplied to ALL badge-boosted stats after ANY
// stat stage change, not just the stat that changed.

const BADGE_STAT_MAP: { badge: string; stat: 'attack' | 'defense' | 'speed' | 'special' }[] = [
  { badge: 'BADGE_1', stat: 'attack' },
  { badge: 'BADGE_3', stat: 'defense' },
  { badge: 'BADGE_5', stat: 'speed' },
  { badge: 'BADGE_7', stat: 'special' },
];

/** Apply badge stat boosts to a player's Pokemon. Each held badge gives 1.125x
 *  to the corresponding stat (stat += floor(stat/8)), capped at 999.
 *  (assembly: ApplyBadgeStatBoosts) */
export function applyBadgeStatBoosts(pokemon: BattlePokemon, badges: ReadonlySet<string>): void {
  for (const { badge, stat } of BADGE_STAT_MAP) {
    if (badges.has(badge)) {
      pokemon[stat] = Math.min(999, pokemon[stat] + Math.floor(pokemon[stat] / 8));
    }
  }
}

// Physical types (0x00-0x08)
const PHYSICAL_TYPES = new Set([
  'NORMAL', 'FIGHTING', 'FLYING', 'POISON', 'GROUND', 'ROCK', 'BIRD', 'BUG', 'GHOST',
]);

/** Check if a move type is physical. */
export function isPhysicalType(moveType: string): boolean {
  return PHYSICAL_TYPES.has(moveType);
}

/** Get type effectiveness multiplier for an attack type vs defender types. */
export function getTypeEffectiveness(atkType: string, defType1: string, defType2: string): number {
  let multiplier = 1;
  for (const entry of getTypeChart()) {
    if (entry.attacker === atkType) {
      if (entry.defender === defType1) multiplier *= entry.multiplier;
      if (defType2 !== defType1 && entry.defender === defType2) multiplier *= entry.multiplier;
    }
  }
  return multiplier;
}

/** Check if a move gets STAB (Same Type Attack Bonus).
 *  Accounts for Conversion/Transform changed types. */
function hasSTAB(attacker: BattlePokemon, moveType: string): boolean {
  const types = getEffectiveTypes(attacker);
  return types.type1 === moveType || types.type2 === moveType;
}

/** Check for critical hit. Gen 1 mechanics:
 *  - Base: speed/2 threshold (capped at 255)
 *  - High crit moves: speed*4 threshold (capped at 255)
 *  - Focus Energy bug: divides threshold by 4 instead of multiplying
 *  (mechanics.zig:1104-1116, core.asm CriticalHitTest) */
function isCriticalHit(attacker: BattlePokemon, moveId: string): boolean {
  const baseSpeed = attacker.species.speed;
  let threshold: number;

  if (isHighCritMove(moveId)) {
    // High crit: speed * 4, then /2 (net: speed * 2), but actually speed/2 * 8
    threshold = Math.min(255, Math.floor(baseSpeed / 2) * 8);
  } else {
    threshold = Math.floor(baseSpeed / 2);
  }

  // Focus Energy bug: divides by 4 instead of multiplying (srl instead of sla)
  if (attacker.volatiles.focusEnergy) {
    threshold = Math.max(1, Math.floor(threshold / 4));
  }

  threshold = Math.min(255, threshold);
  return Math.floor(Math.random() * 256) < threshold;
}

export interface DamageResult {
  damage: number;
  effectiveness: number;  // 0, 0.25, 0.5, 1, 2, 4
  critical: boolean;
  missed: boolean;
}

/** Calculate damage for a move. Faithful Gen 1 formula.
 *  skipAccuracy: true to bypass accuracy check (Swift, certain scenarios). */
export function calculateDamage(
  attacker: BattlePokemon,
  defender: BattlePokemon,
  moveId: string,
  skipAccuracy = false,
): DamageResult {
  const move = getMove(moveId);
  if (!move) return { damage: 0, effectiveness: 1, critical: false, missed: true };

  // Dream Eater: auto-miss if target isn't asleep (core.asm line 5424-5428)
  if (move.effect === 'DREAM_EATER_EFFECT' && defender.status !== 'SLP') {
    return { damage: 0, effectiveness: 1, critical: false, missed: true };
  }

  // Invulnerable check: Fly/Dig — most moves miss against invulnerable target
  // (Swift still hits, but that's handled by skipAccuracy already)
  if (defender.volatiles.invulnerable && !skipAccuracy) {
    return { damage: 0, effectiveness: 1, critical: false, missed: true };
  }

  // Accuracy check — Gen 1 always runs the RNG check (even for 100% accuracy moves).
  // threshold = floor(accuracy * 255 / 100), so 100% → 255. Since the check is
  // floor(random * 256) >= threshold, random can produce 255 → 1/256 miss chance.
  if (!skipAccuracy) {
    let threshold = Math.floor(move.accuracy * 255 / 100);
    // Apply accuracy stage (higher = easier to hit)
    threshold = stageMultiply(threshold, attacker.statStages.accuracy);
    // Apply evasion stage (inverted: higher evasion = harder to hit)
    const evaStage = defender.statStages.evasion;
    const [evaNum, evaDen] = STAGE_NUMDEN[Math.max(0, Math.min(12, evaStage + 6))];
    threshold = Math.floor(threshold * evaDen / evaNum);
    threshold = Math.min(255, Math.max(1, threshold));
    if (Math.floor(Math.random() * 256) >= threshold) {
      return { damage: 0, effectiveness: 1, critical: false, missed: true };
    }
  }

  // Special damage moves (must check before power-0, since Night Shade has power=0)
  if (move.effect === 'SPECIAL_DAMAGE_EFFECT') {
    return calcSpecialDamage(attacker, defender, moveId);
  }

  // Status moves (power 0) don't deal damage
  if (move.power === 0) {
    return { damage: 0, effectiveness: 1, critical: false, missed: false };
  }

  // Critical hit check (with high-crit move support and Focus Energy bug)
  const critical = isCriticalHit(attacker, moveId);
  const level = critical ? attacker.level * 2 : attacker.level;

  // Physical vs Special
  const isPhysical = PHYSICAL_TYPES.has(move.type);
  let attack: number;
  let defense: number;

  if (isPhysical) {
    attack = critical ? calcRawStat(attacker.species.attack, attacker.atkDV, attacker.level)
      : stageMultiply(attacker.attack, attacker.statStages.attack);
    defense = critical ? calcRawStat(defender.species.defense, defender.defDV, defender.level)
      : stageMultiply(defender.defense, defender.statStages.defense);
  } else {
    attack = critical ? calcRawStat(attacker.species.special, attacker.spcDV, attacker.level)
      : stageMultiply(attacker.special, attacker.statStages.special);
    defense = critical ? calcRawStat(defender.species.special, defender.spcDV, defender.level)
      : stageMultiply(defender.special, defender.statStages.special);
  }

  // Burn halves attack for physical moves (core.asm: HalveAttackDueToBurn, lines 6511-6548)
  // The burn stat modification is already applied to the base stat on infliction,
  // so the stageMultiply path already has the halved value. Only for crits do we need to re-halve.
  if (isPhysical && attacker.status === 'BRN' && critical) {
    attack = Math.max(1, Math.floor(attack / 2));
  }

  // Explosion/Self-Destruct halves defense
  if (move.effect === 'EXPLODE_EFFECT') {
    defense = Math.max(1, Math.floor(defense / 2));
  }

  // Reflect/Light Screen: double defense (but NOT for crits)
  if (!critical) {
    if (isPhysical && defender.volatiles.reflect) {
      defense = Math.min(999, defense * 2);
    } else if (!isPhysical && defender.volatiles.lightScreen) {
      defense = Math.min(999, defense * 2);
    }
  }

  // Ensure defense is at least 1
  defense = Math.max(1, defense);
  attack = Math.max(1, attack);

  // Core damage formula
  let damage = Math.floor(
    (Math.floor((Math.floor(2 * level / 5) + 2) * move.power * attack / defense) / 50) + 2,
  );

  // STAB (accounts for Conversion/Transform types)
  if (hasSTAB(attacker, move.type)) {
    damage = Math.floor(damage * 3 / 2);
  }

  // Type effectiveness (uses defender's effective types for Conversion/Transform)
  const defTypes = getEffectiveTypes(defender);
  const effectiveness = getTypeEffectiveness(
    move.type,
    defTypes.type1,
    defTypes.type2,
  );

  if (effectiveness === 0) {
    return { damage: 0, effectiveness: 0, critical, missed: false };
  }

  // Apply type multiplier
  damage = Math.floor(damage * effectiveness);

  // Clamp to valid range
  damage = Math.max(1, Math.min(damage, 997));

  // Random factor: [217-255]/255 (85-100%)
  const rand = Math.floor(Math.random() * 39) + 217;
  damage = Math.floor(damage * rand / 255);
  damage = Math.max(1, damage);

  return { damage, effectiveness, critical, missed: false };
}

/** Special damage moves: Seismic Toss, Night Shade = level damage.
 *  Sonic Boom = 20, Dragon Rage = 40, Psywave = random up to 1.5x level. */
function calcSpecialDamage(
  attacker: BattlePokemon,
  defender: BattlePokemon,
  moveId: string,
): DamageResult {
  const move = getMove(moveId);
  const moveType = move?.type ?? 'NORMAL';
  const defTypes = getEffectiveTypes(defender);
  const effectiveness = getTypeEffectiveness(
    moveType,
    defTypes.type1,
    defTypes.type2,
  );

  if (effectiveness === 0) {
    return { damage: 0, effectiveness: 0, critical: false, missed: false };
  }

  let damage: number;
  switch (moveId) {
    case 'SONICBOOM':
      damage = 20;
      break;
    case 'DRAGON_RAGE':
      damage = 40;
      break;
    case 'PSYWAVE':
      damage = Math.max(1, Math.floor(Math.random() * (attacker.level * 3 / 2)));
      break;
    default: // Seismic Toss, Night Shade
      damage = attacker.level;
      break;
  }

  return { damage, effectiveness: 1, critical: false, missed: false };
}

/** Calculate a raw stat (without stat stage modifiers) for critical hits. */
function calcRawStat(base: number, dv: number, level: number): number {
  return Math.floor(((base + dv) * 2 * level) / 100) + 5;
}
