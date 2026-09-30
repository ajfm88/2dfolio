// Gen 1 status condition logic — faithful to engine/battle/core.asm and engine/battle/effects.asm

import type { BattlePokemon, StatusCondition } from './types';
import { getMove } from './data';

const TOXIC_ID = 92;
const FIRE_SPIN_ID = 83;
function moveNumId(moveId: string): number { return getMove(moveId)?.id ?? 0; }

// ──────── "percent" macro from RGBDS: floor(N * 256 / 100) ────────
// Used for probability thresholds compared against random(0-255)

const SIDE_EFFECT_THRESHOLDS: Record<string, number> = {
  // Poison side effects
  'POISON_SIDE_EFFECT1': 52,   // 20 percent + 1
  'POISON_SIDE_EFFECT2': 103,  // 40 percent + 1
  // Burn side effects
  'BURN_SIDE_EFFECT1': 26,     // 10 percent + 1
  'BURN_SIDE_EFFECT2': 77,     // 30 percent + 1
  // Freeze side effects
  'FREEZE_SIDE_EFFECT1': 26,   // 10 percent + 1
  'FREEZE_SIDE_EFFECT2': 77,   // 30 percent + 1 (stadium, treated as FREEZE_SIDE_EFFECT1 in Yellow)
  // Paralyze side effects
  'PARALYZE_SIDE_EFFECT1': 26, // 10 percent + 1
  'PARALYZE_SIDE_EFFECT2': 77, // 30 percent + 1
};

// Map effect names to the status they inflict
function effectToStatus(effect: string): StatusCondition {
  if (effect.startsWith('POISON')) return 'PSN';
  if (effect.startsWith('BURN')) return 'BRN';
  if (effect.startsWith('FREEZE')) return 'FRZ';
  if (effect.startsWith('PARALYZE')) return 'PAR';
  if (effect === 'SLEEP_EFFECT') return 'SLP';
  return null;
}

// ──────── Type immunity checks ────────
// From effects.asm: FreezeBurnParalyzeEffect checks if move type matches defender type
// PoisonEffect checks if defender is Poison-type

function isImmuneToStatus(
  effect: string,
  moveType: string,
  defender: BattlePokemon,
): boolean {
  const status = effectToStatus(effect);
  if (!status) return true;

  if (status === 'PSN') {
    // Poison-type can't be poisoned (effects.asm line 104-108)
    return defender.species.type1 === 'POISON' || defender.species.type2 === 'POISON';
  }

  // Freeze/Burn/Paralyze: immune if move type matches either defender type
  // (effects.asm line 218-222: "an ice move can't freeze an ice-type, body slam can't paralyze a normal-type")
  if (status === 'FRZ' || status === 'BRN' || status === 'PAR') {
    return defender.species.type1 === moveType || defender.species.type2 === moveType;
  }

  return false;
}

// ──────── Status infliction from move effects ────────

export interface StatusInflictResult {
  inflicted: StatusCondition;
  message: string[];
}

/** Try to inflict a status condition from a move's effect.
 *  Returns null if no status was applied (already statused, immune, or probability miss). */
export function tryInflictStatus(
  effect: string,
  _attacker: BattlePokemon,
  defender: BattlePokemon,
  moveId: string,
): StatusInflictResult | null {
  const status = effectToStatus(effect);
  if (!status) return null;

  // Can't status a Pokemon that already has a status condition
  if (defender.status !== null) return null;

  // Substitute blocks status moves (but not side effects from damaging moves)
  const isSideEffect = SIDE_EFFECT_THRESHOLDS[effect] !== undefined;
  if (!isSideEffect && defender.volatiles.substitute > 0) return null;

  const move = getMove(moveId);
  const moveType = move?.type ?? 'NORMAL';

  // Type immunity check
  if (isImmuneToStatus(effect, moveType, defender)) return null;

  // Side effects: random chance check
  const threshold = SIDE_EFFECT_THRESHOLDS[effect];
  if (threshold !== undefined) {
    // Side effect: random(0-255) < threshold to inflict
    if (Math.floor(Math.random() * 256) >= threshold) return null;
  }
  // Pure status moves (POISON_EFFECT, PARALYZE_EFFECT, SLEEP_EFFECT) always apply
  // (accuracy already checked by the normal move accuracy system)

  // Apply the status
  return applyStatus(defender, status, moveId);
}

/** Apply a status condition to a Pokemon. */
function applyStatus(
  target: BattlePokemon,
  status: StatusCondition,
  moveId: string,
): StatusInflictResult {
  const name = target.nickname.toUpperCase();
  target.status = status;

  switch (status) {
    case 'SLP': {
      // Sleep counter: random 1-7 (effects.asm lines 59-62: random & 7, retry if 0)
      let turns: number;
      do {
        turns = Math.floor(Math.random() * 8);
      } while (turns === 0);
      target.sleepTurns = turns;
      return { inflicted: 'SLP', message: [`${name} fell asleep!`] };
    }
    case 'PSN': {
      // Check for Toxic (badly poisoned)
      if (moveNumId(moveId) === TOXIC_ID) {
        target.badlyPoisoned = true;
        target.toxicCounter = 0;
        return { inflicted: 'PSN', message: [`${name} is badly`, `poisoned!`] };
      }
      return { inflicted: 'PSN', message: [`${name} was poisoned!`] };
    }
    case 'BRN': {
      // Burn halves attack immediately (effects.asm line 263: call HalveAttackDueToBurn)
      target.attack = Math.max(1, Math.floor(target.attack / 2));
      return { inflicted: 'BRN', message: [`${name} was burned!`] };
    }
    case 'PAR': {
      // Paralysis quarters speed immediately (effects.asm line 256: call QuarterSpeedDueToParalysis)
      target.speed = Math.max(1, Math.floor(target.speed / 4));
      return { inflicted: 'PAR', message: [`${name} is paralyzed!`, `It may not attack!`] };
    }
    case 'FRZ':
      return { inflicted: 'FRZ', message: [`${name} was frozen solid!`] };
    default:
      return { inflicted: null, message: [] };
  }
}

// ──────── Pre-turn status checks ────────
// Called before a Pokemon tries to execute its move (core.asm lines 3499-3630)

export interface PreTurnResult {
  canAct: boolean;
  messages: string[][];
}

/** Check if a Pokemon can act this turn. Returns false if status prevents action. */
export function checkPreTurnStatus(pokemon: BattlePokemon): PreTurnResult {
  const name = pokemon.nickname.toUpperCase();

  // Sleep check (core.asm lines 3502-3524)
  if (pokemon.status === 'SLP') {
    pokemon.sleepTurns--;
    if (pokemon.sleepTurns <= 0) {
      // Woke up!
      pokemon.status = null;
      pokemon.sleepTurns = 0;
      return { canAct: true, messages: [[`${name} woke up!`]] };
    }
    return { canAct: false, messages: [[`${name} is fast asleep!`]] };
  }

  // Freeze check (core.asm lines 3527-3535)
  // Gen 1: no auto-thaw, completely prevents action
  if (pokemon.status === 'FRZ') {
    return { canAct: false, messages: [[`${name} is frozen solid!`]] };
  }

  // Paralysis check (core.asm lines 3620-3628)
  // 25% chance to be fully paralyzed (cp 25 percent = 64/256)
  if (pokemon.status === 'PAR') {
    if (Math.floor(Math.random() * 256) < 64) {
      return { canAct: false, messages: [[`${name} is fully`, `paralyzed!`]] };
    }
  }

  return { canAct: true, messages: [] };
}

// ──────── End-of-turn effects ────────
// Poison and burn damage (core.asm lines 479-541: HandlePoisonBurnLeechSeed)

export interface EndOfTurnResult {
  damage: number;
  messages: string[][];
  fainted: boolean;
}

/** Apply end-of-turn poison/burn damage to a Pokemon.
 *  Damage = maxHP / 16 (min 1). Toxic multiplies by incrementing counter. */
export function applyEndOfTurnDamage(pokemon: BattlePokemon): EndOfTurnResult {
  const name = pokemon.nickname.toUpperCase();

  if (pokemon.status !== 'PSN' && pokemon.status !== 'BRN') {
    return { damage: 0, messages: [], fainted: false };
  }

  // Base damage: maxHP / 16, minimum 1 (core.asm lines 570-579)
  let baseDmg = Math.floor(pokemon.maxHp / 16);
  if (baseDmg === 0) baseDmg = 1;

  let totalDmg = baseDmg;

  // Toxic: increment counter and multiply (core.asm lines 589-600)
  if (pokemon.status === 'PSN' && pokemon.badlyPoisoned) {
    pokemon.toxicCounter++;
    totalDmg = baseDmg * pokemon.toxicCounter;
  }

  // Apply damage
  pokemon.currentHp = Math.max(0, pokemon.currentHp - totalDmg);

  const msgText = pokemon.status === 'BRN'
    ? [`${name} is hurt`, `by the burn!`]
    : [`${name} is hurt`, `by poison!`];

  return {
    damage: totalDmg,
    messages: [msgText],
    fainted: pokemon.currentHp <= 0,
  };
}

/** Check if a move effect is a status-inflicting effect. */
export function isStatusEffect(effect: string): boolean {
  return effectToStatus(effect) !== null;
}

/** Check if a Fire-type damaging move should thaw a frozen target.
 *  Fire Spin does NOT thaw. (core.asm freeze handling) */
export function checkFireThaw(moveId: string, moveType: string, target: BattlePokemon): string[] | null {
  if (target.status !== 'FRZ') return null;
  if (moveType !== 'FIRE') return null;
  // Fire Spin doesn't thaw (it's a FIRE-type trapping move)
  if (moveNumId(moveId) === FIRE_SPIN_ID) return null;

  target.status = null;
  // Restore speed if it was quartered by paralysis (not applicable here since FRZ)
  return [`${target.nickname.toUpperCase()} was`, `defrosted!`];
}
