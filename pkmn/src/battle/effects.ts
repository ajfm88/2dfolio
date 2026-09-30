// Centralized move effect handlers — faithful to Gen 1 (core.asm, mechanics.zig).
// Each handler is called at the appropriate phase of move execution.

import type { BattlePokemon, MoveData } from './types';
import { getMove, getAllLoadedMoveIds } from './data';
import { getText } from '../text/game_text';

// ──────── Effect classification ────────
// Determines when/how each effect executes in the turn.

/** Effects that replace the entire move with special behavior (no normal damage). */
const RESIDUAL_EFFECTS_1 = new Set([
  'CONVERSION_EFFECT',
  'HAZE_EFFECT',
  'SWITCH_AND_TELEPORT_EFFECT',
  'MIST_EFFECT',
  'FOCUS_ENERGY_EFFECT',
  'CONFUSION_EFFECT',
  'HEAL_EFFECT',
  'TRANSFORM_EFFECT',
  'LIGHT_SCREEN_EFFECT',
  'REFLECT_EFFECT',
  'POISON_EFFECT',
  'PARALYZE_EFFECT',
  'SLEEP_EFFECT',
  'SUBSTITUTE_EFFECT',
  'MIMIC_EFFECT',
  'LEECH_SEED_EFFECT',
  'SPLASH_EFFECT',
  'DISABLE_EFFECT',
]);

/** Effects that always execute after damage (even if target faints). */
const ALWAYS_HAPPEN_EFFECTS = new Set([
  'DRAIN_HP_EFFECT',
  'DREAM_EATER_EFFECT',
  'EXPLODE_EFFECT',
  'PAY_DAY_EFFECT',
  'TWO_TO_FIVE_ATTACKS_EFFECT',
  'ATTACK_TWICE_EFFECT',
  'TWINEEDLE_EFFECT',
  'RECOIL_EFFECT',
  'RAGE_EFFECT',
  'HYPER_BEAM_EFFECT',
  'TRAPPING_EFFECT',
]);

// Numeric move IDs (assembly indices, not copyrightable)
const HIGH_CRIT_IDS = new Set([2, 75, 152, 163]);
const PRIORITY_IDS = new Set([98]);
const COUNTER_ID = 68;
const STRUGGLE_ID = 165;
const METRONOME_ID = 118;
const MIRROR_MOVE_ID = 119;
const REST_ID = 156;
const MIMIC_ID = 102;
const FLY_ID = 19;
const DIG_ID = 91;
const SOLARBEAM_ID = 76;
const SKY_ATTACK_ID = 143;
const SKULL_BASH_ID = 130;
const RAZOR_WIND_ID = 13;

/** Resolve string move ID to numeric ID. */
function moveNumId(moveId: string): number { return getMove(moveId)?.id ?? 0; }

/** High critical hit moves (8x base crit rate). */
export function isHighCritMove(moveId: string): boolean { return HIGH_CRIT_IDS.has(moveNumId(moveId)); }

/** Moves with priority (+1). */
export function isPriorityMove(moveId: string): boolean { return PRIORITY_IDS.has(moveNumId(moveId)); }

/** Counter always goes last (priority -1) in Gen 1. */
export function isCounterMove(moveId: string): boolean { return moveNumId(moveId) === COUNTER_ID; }

/** Check if a move is Struggle. */
export function isStruggle(moveId: string): boolean { return moveNumId(moveId) === STRUGGLE_ID; }

// ──────── Move execution context ────────

export interface MoveContext {
  attacker: BattlePokemon;
  defender: BattlePokemon;
  moveId: string;
  move: MoveData;
  isPlayerAttacker: boolean;
}

export interface EffectResult {
  messages: string[][];
  damage: number;
  missed: boolean;
  failed: boolean;
  skipDamage: boolean;         // skip normal damage calculation
  skipAccuracy: boolean;       // skip accuracy check (Swift)
  selfFaint: boolean;          // attacker faints (Explosion/Self-Destruct)
  endBattle: boolean;          // end battle (Whirlwind on wild)
  healAmount: number;          // HP healed on attacker
  recoilDamage: number;        // recoil damage to attacker
  payDayMoney: number;         // money gained from Pay Day
  multiHitCount: number;       // how many additional hits remain
  substituteBlocked: boolean;  // move was blocked by substitute
  skipEndOfTurn: boolean;      // skip end-of-turn after this move
}

function emptyResult(): EffectResult {
  return {
    messages: [],
    damage: 0,
    missed: false,
    failed: false,
    skipDamage: false,
    skipAccuracy: false,
    selfFaint: false,
    endBattle: false,
    healAmount: 0,
    recoilDamage: 0,
    payDayMoney: 0,
    multiHitCount: 0,
    substituteBlocked: false,
    skipEndOfTurn: false,
  };
}

// ──────── Effect queries ────────

/** Check if a move effect is a "residual effect 1" (pure non-damaging effect). */
export function isNonDamagingEffect(effect: string): boolean {
  return RESIDUAL_EFFECTS_1.has(effect);
}

/** Check if an effect always happens (even if target faints). */
export function isAlwaysHappenEffect(effect: string): boolean {
  return ALWAYS_HAPPEN_EFFECTS.has(effect);
}

/** Check if the move should skip accuracy check. */
export function shouldSkipAccuracy(effect: string): boolean {
  return effect === 'SWIFT_EFFECT';
}

/** Check if the attacker is locked into a move (Rage, Thrash, Bide, charging, binding). */
export function isLockedIntoMove(pokemon: BattlePokemon): string | null {
  const v = pokemon.volatiles;
  if (v.rage) return v.lastMoveUsed;
  if (v.thrashing > 0) return v.lastMoveUsed;
  if (v.bide) return 'BIDE';
  if (v.charging) return v.charging;
  if (v.usingBinding > 0) return v.lastMoveUsed;
  return null;
}

/** Check if the pokemon can choose a move this turn (not locked). */
export function canChooseMove(pokemon: BattlePokemon): boolean {
  return isLockedIntoMove(pokemon) === null;
}

/** Check if a specific move is disabled. */
export function isMoveDisabled(pokemon: BattlePokemon, moveIndex: number): boolean {
  return pokemon.volatiles.disabled?.moveIndex === moveIndex;
}

// ──────── Pre-turn volatile checks ────────
// Called before a Pokemon tries to execute its move.

export interface VolatilePreTurnResult {
  canAct: boolean;
  messages: string[][];
  forcedMoveId: string | null;  // if set, override selected move
  skipTurn: boolean;            // recharging, flinch, etc.
}

/** Check volatile statuses before a Pokemon acts. Called AFTER status checks (sleep/freeze/para). */
export function checkVolatilePreTurn(pokemon: BattlePokemon, opponent: BattlePokemon): VolatilePreTurnResult {
  const name = pokemon.nickname.toUpperCase();
  const v = pokemon.volatiles;

  // Flinch check (mechanics.zig:539-545)
  if (v.flinch) {
    v.flinch = false;
    return { canAct: false, messages: [[`${name} flinched!`]], forcedMoveId: null, skipTurn: true };
  }

  // Recharging check — Hyper Beam (mechanics.zig:547-551)
  if (v.recharging) {
    v.recharging = false;
    return { canAct: false, messages: [[`${name} must`, `recharge!`]], forcedMoveId: null, skipTurn: true };
  }

  // Disable counter decrement
  if (v.disabled) {
    v.disabled.turnsLeft--;
    if (v.disabled.turnsLeft <= 0) {
      v.disabled = null;
      // No message for disable expiry in Gen 1 (it silently expires)
    }
  }

  // Bide: accumulating damage (mechanics.zig:650-694)
  if (v.bide) {
    v.bide.turnsLeft--;
    if (v.bide.turnsLeft <= 0) {
      // Release Bide damage
      const bideDmg = v.bide.damage * 2;
      v.bide = null;
      const msgs: string[][] = [[`${name} unleashed`, `energy!`]];
      if (bideDmg > 0) {
        opponent.currentHp = Math.max(0, opponent.currentHp - bideDmg);
      } else {
        msgs.push(['But it failed!']);
      }
      return { canAct: false, messages: msgs, forcedMoveId: null, skipTurn: false };
    }
    return { canAct: false, messages: [[`${name} is`, `storing energy!`]], forcedMoveId: null, skipTurn: false };
  }

  // Thrashing: forced move (mechanics.zig:696-726)
  if (v.thrashing > 0) {
    v.thrashing--;
    if (v.thrashing <= 0) {
      // Thrashing ended — apply confusion
      v.confusion = Math.floor(Math.random() * 4) + 2; // 2-5 turns
      return {
        canAct: true,
        messages: [],
        forcedMoveId: v.lastMoveUsed,
        skipTurn: false,
      };
    }
    return { canAct: true, messages: [], forcedMoveId: v.lastMoveUsed, skipTurn: false };
  }

  // Binding: attacker continuing (mechanics.zig:728-741)
  if (v.usingBinding > 0) {
    v.usingBinding--;
    if (v.usingBinding <= 0) {
      // Binding ended
      if (opponent.volatiles.binding > 0) {
        opponent.volatiles.binding = 0;
      }
      return { canAct: true, messages: [], forcedMoveId: null, skipTurn: false };
    }
    return { canAct: true, messages: [], forcedMoveId: v.lastMoveUsed, skipTurn: false };
  }

  // Charging: turn 2 of charge move (mechanics.zig:760-768)
  if (v.charging) {
    const chargeMove = v.charging;
    v.charging = null;
    v.invulnerable = false;
    return { canAct: true, messages: [], forcedMoveId: chargeMove, skipTurn: false };
  }

  // Rage: locked into Rage
  if (v.rage) {
    return { canAct: true, messages: [], forcedMoveId: v.lastMoveUsed, skipTurn: false };
  }

  // Confusion check (mechanics.zig:611-628)
  if (v.confusion > 0) {
    v.confusion--;
    if (v.confusion <= 0) {
      return { canAct: true, messages: [[`${name} snapped`, `out of confusion!`]], forcedMoveId: null, skipTurn: false };
    }

    const msgs: string[][] = [[`${name} is`, `confused!`]];

    // 50% chance to hit self
    if (Math.random() < 0.5) {
      // Self-hit: 40 BP typeless physical move, uses own Attack vs own Defense
      const level = pokemon.level;
      const attack = pokemon.attack;
      const defense = pokemon.defense;
      let dmg = Math.floor(
        (Math.floor((Math.floor(2 * level / 5) + 2) * 40 * attack / defense) / 50) + 2,
      );
      // Random factor
      const rand = Math.floor(Math.random() * 39) + 217;
      dmg = Math.floor(dmg * rand / 255);
      dmg = Math.max(1, dmg);

      pokemon.currentHp = Math.max(0, pokemon.currentHp - dmg);
      msgs.push([`It hurt itself in`, `its confusion!`]);
      return { canAct: false, messages: msgs, forcedMoveId: null, skipTurn: false };
    }

    return { canAct: true, messages: msgs, forcedMoveId: null, skipTurn: false };
  }

  return { canAct: true, messages: [], forcedMoveId: null, skipTurn: false };
}

// ──────── End-of-turn volatile effects ────────

export interface VolatileEndOfTurnResult {
  damage: number;
  healAmount: number;
  messages: string[][];
  fainted: boolean;
}

/** Apply end-of-turn volatile effects (Leech Seed). Called after poison/burn. */
export function applyVolatileEndOfTurn(
  pokemon: BattlePokemon,
  opponent: BattlePokemon,
): VolatileEndOfTurnResult {
  const name = pokemon.nickname.toUpperCase();
  let totalDamage = 0;
  let totalHeal = 0;
  const messages: string[][] = [];

  // Leech Seed (mechanics.zig:1607-1636)
  if (pokemon.volatiles.leechSeed && pokemon.currentHp > 0) {
    let seedDmg = Math.floor(pokemon.maxHp / 16);
    if (seedDmg === 0) seedDmg = 1;

    // Gen 1 bug: Leech Seed uses toxic counter if badly poisoned
    if (pokemon.badlyPoisoned) {
      seedDmg = seedDmg * pokemon.toxicCounter;
    }

    seedDmg = Math.min(seedDmg, pokemon.currentHp);
    pokemon.currentHp -= seedDmg;
    totalDamage += seedDmg;

    // Heal opponent
    const heal = Math.min(seedDmg, opponent.maxHp - opponent.currentHp);
    opponent.currentHp += heal;
    totalHeal += heal;

    messages.push([`${name}'s health is`, `sapped by LEECH SEED!`]);
  }

  return {
    damage: totalDamage,
    healAmount: totalHeal,
    messages,
    fainted: pokemon.currentHp <= 0,
  };
}

// ──────── Individual effect handlers ────────

/** Handle Substitute creation. */
export function handleSubstitute(attacker: BattlePokemon): EffectResult {
  const result = emptyResult();
  const name = attacker.nickname.toUpperCase();

  if (attacker.volatiles.substitute > 0) {
    result.failed = true;
    result.messages.push(['But it failed!']);
    return result;
  }

  const cost = Math.floor(attacker.maxHp / 4);
  if (attacker.currentHp <= cost) {
    result.failed = true;
    result.messages.push(['Too weak to make', 'a SUBSTITUTE!']);
    return result;
  }

  attacker.currentHp -= cost;
  attacker.volatiles.substitute = cost;
  result.messages.push([`${name} made`, `a SUBSTITUTE!`]);
  return result;
}

/** Handle Haze effect: reset all stat changes and clear volatiles. */
export function handleHaze(attacker: BattlePokemon, defender: BattlePokemon): EffectResult {
  const result = emptyResult();

  // Reset stat stages for both
  attacker.statStages = { attack: 0, defense: 0, speed: 0, special: 0, accuracy: 0, evasion: 0 };
  defender.statStages = { attack: 0, defense: 0, speed: 0, special: 0, accuracy: 0, evasion: 0 };

  // Restore original stats for both
  attacker.attack = attacker.originalStats.attack;
  attacker.defense = attacker.originalStats.defense;
  attacker.speed = attacker.originalStats.speed;
  attacker.special = attacker.originalStats.special;
  defender.attack = defender.originalStats.attack;
  defender.defense = defender.originalStats.defense;
  defender.speed = defender.originalStats.speed;
  defender.special = defender.originalStats.special;

  // Clear status on defender (Gen 1 Haze clears opponent's status)
  if (defender.status) {
    defender.status = null;
    defender.sleepTurns = 0;
    defender.badlyPoisoned = false;
    defender.toxicCounter = 0;
  }

  // Clear volatiles for both
  const clearVol = (p: BattlePokemon) => {
    p.volatiles.confusion = 0;
    p.volatiles.leechSeed = false;
    p.volatiles.mist = false;
    p.volatiles.focusEnergy = false;
    p.volatiles.reflect = false;
    p.volatiles.lightScreen = false;
    p.volatiles.disabled = null;
    p.volatiles.substitute = 0;
    p.volatiles.binding = 0;
    p.volatiles.usingBinding = 0;
    p.toxicCounter = 0;
    p.badlyPoisoned = false;
  };
  clearVol(attacker);
  clearVol(defender);

  result.messages.push(['All status changes', 'were removed!']);
  return result;
}

/** Handle Leech Seed application. */
export function handleLeechSeed(_attacker: BattlePokemon, defender: BattlePokemon): EffectResult {
  const result = emptyResult();
  const defName = defender.nickname.toUpperCase();

  // Grass-type immunity
  if (defender.species.type1 === 'GRASS' || defender.species.type2 === 'GRASS') {
    result.failed = true;
    result.messages.push(["It doesn't affect", `${defName}...`]);
    return result;
  }

  if (defender.volatiles.leechSeed) {
    result.failed = true;
    result.messages.push(['But it failed!']);
    return result;
  }

  defender.volatiles.leechSeed = true;
  result.messages.push([`${defName} was`, `seeded!`]);
  return result;
}

/** Handle Reflect / Light Screen. */
export function handleScreen(attacker: BattlePokemon, effect: string): EffectResult {
  const result = emptyResult();
  const name = attacker.nickname.toUpperCase();

  if (effect === 'REFLECT_EFFECT') {
    if (attacker.volatiles.reflect) {
      result.failed = true;
      result.messages.push(['But it failed!']);
      return result;
    }
    attacker.volatiles.reflect = true;
    result.messages.push([`${name} gained`, `armor!`]);
  } else {
    if (attacker.volatiles.lightScreen) {
      result.failed = true;
      result.messages.push(['But it failed!']);
      return result;
    }
    attacker.volatiles.lightScreen = true;
    result.messages.push([`${name}'s protected`, `against special attacks!`]);
  }
  return result;
}

/** Handle Mist. */
export function handleMist(attacker: BattlePokemon): EffectResult {
  const result = emptyResult();
  if (attacker.volatiles.mist) {
    result.failed = true;
    result.messages.push(['But it failed!']);
    return result;
  }
  attacker.volatiles.mist = true;
  result.messages.push([`${attacker.nickname.toUpperCase()} is`, `shrouded in MIST!`]);
  return result;
}

/** Handle Focus Energy (Gen 1 bug: halves crit rate). */
export function handleFocusEnergy(attacker: BattlePokemon): EffectResult {
  const result = emptyResult();
  if (attacker.volatiles.focusEnergy) {
    result.failed = true;
    result.messages.push(['But it failed!']);
    return result;
  }
  attacker.volatiles.focusEnergy = true;
  result.messages.push([`${attacker.nickname.toUpperCase()} is`, `getting pumped!`]);
  return result;
}

/** Handle Confusion infliction (pure confusion move). */
export function handleConfusion(_attacker: BattlePokemon, defender: BattlePokemon): EffectResult {
  const result = emptyResult();
  const defName = defender.nickname.toUpperCase();

  if (defender.volatiles.substitute > 0) {
    result.substituteBlocked = true;
    result.messages.push(['But it failed!']);
    return result;
  }

  if (defender.volatiles.confusion > 0) {
    result.failed = true;
    result.messages.push(['But it failed!']);
    return result;
  }

  defender.volatiles.confusion = Math.floor(Math.random() * 4) + 2; // 2-5 turns
  result.messages.push([`${defName} became`, `confused!`]);
  return result;
}

/** Handle Heal effect (Recover, Softboiled, Rest). */
export function handleHeal(attacker: BattlePokemon, moveId: string): EffectResult {
  const result = emptyResult();
  const name = attacker.nickname.toUpperCase();

  if (moveNumId(moveId) === REST_ID) {
    // Rest: full heal + sleep for 2 turns
    if (attacker.currentHp >= attacker.maxHp) {
      result.failed = true;
      result.messages.push(['But it failed!']);
      return result;
    }
    attacker.currentHp = attacker.maxHp;
    attacker.status = 'SLP';
    attacker.sleepTurns = 2;
    // Clear burn/par stat mods
    attacker.attack = attacker.originalStats.attack;
    attacker.speed = attacker.originalStats.speed;
    result.messages.push([`${name} started`, `sleeping!`]);
    result.messages.push([`${name} regained`, `health!`]);
  } else {
    // Recover / Softboiled: heal 50% max HP
    if (attacker.currentHp >= attacker.maxHp) {
      result.failed = true;
      result.messages.push(['But it failed!']);
      return result;
    }
    const heal = Math.floor(attacker.maxHp / 2);
    attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + heal);
    result.healAmount = heal;
    result.messages.push([`${name} regained`, `health!`]);
  }
  return result;
}

/** Handle Transform. */
export function handleTransform(attacker: BattlePokemon, defender: BattlePokemon): EffectResult {
  const result = emptyResult();
  const name = attacker.nickname.toUpperCase();

  if (defender.volatiles.invulnerable) {
    result.failed = true;
    result.messages.push(['But it failed!']);
    return result;
  }

  // Copy species info (for display), types, stats (except HP), moves, stat stages
  attacker.volatiles.transformed = true;

  // Copy types
  attacker.volatiles.convertedType1 = defender.volatiles.convertedType1 ?? defender.species.type1;
  attacker.volatiles.convertedType2 = defender.volatiles.convertedType2 ?? defender.species.type2;

  // Copy stats (except HP)
  attacker.attack = defender.attack;
  attacker.defense = defender.defense;
  attacker.speed = defender.speed;
  attacker.special = defender.special;

  // Copy stat stages
  attacker.statStages = { ...defender.statStages };

  // Copy moves with 5 PP each
  attacker.moves = defender.moves.map(m => ({
    id: m.id,
    pp: 5,
    maxPp: 5,
  }));

  result.messages.push([`${name} TRANSFORMed`, `into ${defender.species.name}!`]);
  return result;
}

/** Handle Conversion (copy target's types). */
export function handleConversion(attacker: BattlePokemon, defender: BattlePokemon): EffectResult {
  const result = emptyResult();
  attacker.volatiles.convertedType1 = defender.species.type1;
  attacker.volatiles.convertedType2 = defender.species.type2;
  result.messages.push([`Converted type to`, `${defender.species.type1}!`]);
  return result;
}

/** Handle Mimic (copy one of target's moves). */
export function handleMimic(attacker: BattlePokemon, defender: BattlePokemon): EffectResult {
  const result = emptyResult();
  const name = attacker.nickname.toUpperCase();

  if (defender.moves.length === 0) {
    result.failed = true;
    result.messages.push(['But it failed!']);
    return result;
  }

  // Find the Mimic move slot
  const mimicSlot = attacker.moves.findIndex(m => moveNumId(m.id) === MIMIC_ID);
  if (mimicSlot === -1) {
    result.failed = true;
    result.messages.push(['But it failed!']);
    return result;
  }

  // Pick a random move from opponent
  const targetMove = defender.moves[Math.floor(Math.random() * defender.moves.length)];
  const moveData = getMove(targetMove.id);

  attacker.volatiles.mimicSlot = mimicSlot;
  attacker.volatiles.mimicOriginal = attacker.moves[mimicSlot].id;
  attacker.moves[mimicSlot] = {
    id: targetMove.id,
    pp: moveData?.pp ?? targetMove.pp,
    maxPp: moveData?.pp ?? targetMove.maxPp,
  };

  result.messages.push([`${name} learned`, `${targetMove.id.replace(/_/g, ' ')}!`]);
  return result;
}

/** Handle Disable (disable a random opponent move for 1-8 turns). */
export function handleDisable(_attacker: BattlePokemon, defender: BattlePokemon): EffectResult {
  const result = emptyResult();
  const defName = defender.nickname.toUpperCase();

  if (defender.volatiles.disabled) {
    result.failed = true;
    result.messages.push(['But it failed!']);
    return result;
  }

  if (defender.volatiles.substitute > 0) {
    result.substituteBlocked = true;
    result.messages.push(['But it failed!']);
    return result;
  }

  // Find moves with PP > 0
  const validSlots: number[] = [];
  for (let i = 0; i < defender.moves.length; i++) {
    if (defender.moves[i].pp > 0) validSlots.push(i);
  }

  if (validSlots.length === 0) {
    result.failed = true;
    result.messages.push(['But it failed!']);
    return result;
  }

  const slot = validSlots[Math.floor(Math.random() * validSlots.length)];
  const turns = Math.floor(Math.random() * 8) + 1; // 1-8 turns
  defender.volatiles.disabled = { moveIndex: slot, turnsLeft: turns };

  const moveName = defender.moves[slot].id.replace(/_/g, ' ');
  result.messages.push([`${defName}'s`, `${moveName} was disabled!`]);
  return result;
}

/** Handle Metronome (use a random move). Returns the selected move ID. */
export function selectMetronomeMove(): string {
  // All move IDs except Metronome (118) and Struggle (165)
  const allMoves = getAllLoadedMoveIds();
  const valid = allMoves.filter(m => {
    const id = moveNumId(m);
    return id !== METRONOME_ID && id !== STRUGGLE_ID;
  });
  return valid[Math.floor(Math.random() * valid.length)];
}

/** Handle Mirror Move (use opponent's last move). Returns the move ID or null if fails. */
export function selectMirrorMove(opponent: BattlePokemon): string | null {
  const lastMove = opponent.volatiles.lastMoveUsed;
  if (!lastMove || moveNumId(lastMove) === MIRROR_MOVE_ID) return null;
  return lastMove;
}

/** Handle Splash. */
export function handleSplash(): EffectResult {
  const result = emptyResult();
  result.messages.push(['No effect!']);
  return result;
}

/** Handle Switch and Teleport (Whirlwind/Roar/Teleport). */
export function handleSwitchAndTeleport(
  _attacker: BattlePokemon,
  _defender: BattlePokemon,
  isTrainerBattle: boolean,
  isPlayerAttacker: boolean,
): EffectResult {
  const result = emptyResult();

  if (isTrainerBattle) {
    result.failed = true;
    result.messages.push(['But it failed!']);
    return result;
  }

  // Wild battle: end battle (flee)
  result.endBattle = true;
  if (isPlayerAttacker) {
    result.messages.push(['Got away safely!']);
  } else {
    result.messages.push(['Wild ' + getText('MENU_POKEMON') + ' fled!']);
  }
  return result;
}

/** Handle OHKO moves (Horn Drill, Guillotine, Fissure). */
export function handleOHKO(attacker: BattlePokemon, defender: BattlePokemon): EffectResult {
  const result = emptyResult();
  result.skipDamage = true;

  // Speed check: if attacker is slower, always miss
  if (attacker.speed < defender.speed) {
    result.missed = true;
    result.messages.push([`${attacker.nickname.toUpperCase()}'s attack missed!`]);
    return result;
  }

  // Accuracy check: 30% (already checked by caller, but OHKO has special mechanics)
  // Actually in Gen 1, the accuracy is factored into the normal hit check
  // If we reach here, the move hit — deal instant KO damage
  result.damage = 65535;
  defender.currentHp = 0;
  result.messages.push(["It's a one-hit KO!"]);
  return result;
}

/** Handle Super Fang (damage = 50% of target's current HP). */
export function handleSuperFang(defender: BattlePokemon): EffectResult {
  const result = emptyResult();
  result.skipDamage = true;
  result.damage = Math.max(1, Math.floor(defender.currentHp / 2));
  return result;
}

/** Handle Bide initiation. */
export function handleBideStart(attacker: BattlePokemon): EffectResult {
  const result = emptyResult();
  result.skipDamage = true;

  if (attacker.volatiles.bide) {
    result.failed = true;
    result.messages.push(['But it failed!']);
    return result;
  }

  attacker.volatiles.bide = {
    turnsLeft: Math.floor(Math.random() * 2) + 2, // 2-3 turns
    damage: 0,
  };
  result.messages.push([`${attacker.nickname.toUpperCase()} is`, `storing energy!`]);
  return result;
}

/** Handle Counter (return 2x physical damage received). */
export function handleCounter(attacker: BattlePokemon, defender: BattlePokemon): EffectResult {
  const result = emptyResult();
  result.skipDamage = true;

  // Counter only works if opponent's last move was Normal or Fighting type with power > 0
  const lastMove = defender.volatiles.lastMoveUsed;
  if (!lastMove) {
    result.failed = true;
    result.messages.push(['But it failed!']);
    return result;
  }

  const moveData = getMove(lastMove);
  if (!moveData || moveData.power === 0) {
    result.failed = true;
    result.messages.push(['But it failed!']);
    return result;
  }

  if (moveData.type !== 'NORMAL' && moveData.type !== 'FIGHTING') {
    result.failed = true;
    result.messages.push(['But it failed!']);
    return result;
  }

  const counterDmg = attacker.volatiles.lastDamageReceived * 2;
  if (counterDmg === 0) {
    result.failed = true;
    result.messages.push(['But it failed!']);
    return result;
  }

  result.damage = counterDmg;
  defender.currentHp = Math.max(0, defender.currentHp - counterDmg);
  return result;
}

/** Handle Hyper Beam recharge flag. Gen 1 bug: no recharge if KO. */
export function handleHyperBeam(attacker: BattlePokemon, defender: BattlePokemon): void {
  // Only set recharging if defender survived
  if (defender.currentHp > 0) {
    attacker.volatiles.recharging = true;
  }
}

/** Handle recoil damage (Take Down, Double-Edge, Submission, Struggle). */
export function handleRecoil(moveId: string, attacker: BattlePokemon, damage: number): EffectResult {
  const result = emptyResult();
  if (damage <= 0) return result;

  // Struggle: 50% recoil. Others: 25% recoil.
  let recoil: number;
  if (isStruggle(moveId)) {
    recoil = Math.max(1, Math.floor(damage / 2));
  } else {
    recoil = Math.max(1, Math.floor(damage / 4));
  }

  attacker.currentHp = Math.max(0, attacker.currentHp - recoil);
  result.recoilDamage = recoil;
  result.messages.push([`${attacker.nickname.toUpperCase()} is hit`, `with recoil!`]);
  return result;
}

/** Handle drain HP (Absorb, Mega Drain, Leech Life, Dream Eater). */
export function handleDrain(attacker: BattlePokemon, defender: BattlePokemon, damage: number, isDreamEater: boolean): EffectResult {
  const result = emptyResult();
  if (damage <= 0) return result;

  const heal = Math.max(1, Math.floor(damage / 2));
  attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + heal);
  result.healAmount = heal;

  if (isDreamEater) {
    result.messages.push(['Dream was eaten!']);
  } else {
    result.messages.push(['Sucked health from', `${defender.nickname.toUpperCase()}!`]);
  }
  return result;
}

/** Handle Explosion/Self-Destruct (user faints). */
export function handleExplode(attacker: BattlePokemon): EffectResult {
  const result = emptyResult();
  attacker.currentHp = 0;
  result.selfFaint = true;
  return result;
}

/** Handle Pay Day (accumulate money). */
export function handlePayDay(attacker: BattlePokemon): EffectResult {
  const result = emptyResult();
  const money = attacker.level * 2;
  attacker.volatiles.payDayMoney += money;
  result.payDayMoney = money;
  result.messages.push(['Coins scattered', 'everywhere!']);
  return result;
}

/** Roll multi-hit count for TWO_TO_FIVE_ATTACKS_EFFECT.
 *  Gen 1: 37.5% chance of 2, 37.5% of 3, 12.5% of 4, 12.5% of 5.
 *  (mechanics.zig multi-hit distribution) */
export function rollMultiHitCount(): number {
  const roll = Math.floor(Math.random() * 8);
  if (roll < 3) return 2;
  if (roll < 6) return 3;
  if (roll < 7) return 4;
  return 5;
}

/** Handle Rage (lock user into Rage, boost attack when hit). */
export function handleRageStart(attacker: BattlePokemon): void {
  attacker.volatiles.rage = true;
}

/** Handle being hit while in Rage (attack +1 stage). */
export function handleRageHit(target: BattlePokemon): string[] | null {
  if (!target.volatiles.rage) return null;
  if (target.statStages.attack < 6) {
    target.statStages.attack++;
    return [`${target.nickname.toUpperCase()}'s`, `RAGE is building!`];
  }
  return null;
}

/** Handle Thrash/Petal Dance initiation. */
export function handleThrashStart(attacker: BattlePokemon): void {
  attacker.volatiles.thrashing = Math.floor(Math.random() * 2) + 2; // 2-3 turns
}

/** Handle Trapping move initiation (Wrap, Bind, Fire Spin, Clamp). */
export function handleTrappingStart(attacker: BattlePokemon, defender: BattlePokemon): void {
  const turns = rollMultiHitCount(); // 2-5 turns (same distribution)
  attacker.volatiles.usingBinding = turns;
  defender.volatiles.binding = turns;
}

/** Handle charge move turn 1. */
export function handleChargeTurn(
  attacker: BattlePokemon,
  moveId: string,
  isFlying: boolean,
): EffectResult {
  const result = emptyResult();
  result.skipDamage = true;
  const name = attacker.nickname.toUpperCase();

  attacker.volatiles.charging = moveId;
  if (isFlying) {
    attacker.volatiles.invulnerable = true;
  }

  // Charge message varies by move (numeric ID lookup)
  const mid = moveNumId(moveId);
  if (mid === FLY_ID) {
    result.messages.push([`${name} flew up`, `high!`]);
  } else if (mid === DIG_ID) {
    result.messages.push([`${name} dug a`, `hole!`]);
  } else if (mid === SOLARBEAM_ID) {
    result.messages.push([`${name} took in`, `sunlight!`]);
  } else if (mid === SKY_ATTACK_ID) {
    result.messages.push([`${name} is glowing!`]);
  } else if (mid === SKULL_BASH_ID) {
    result.messages.push([`${name} lowered`, `its head!`]);
  } else if (mid === RAZOR_WIND_ID) {
    result.messages.push([`${name} made a`, `whirlwind!`]);
  } else {
    result.messages.push([`${name} is`, `charging up!`]);
  }

  return result;
}

/** Handle flinch side effect (10% or 30% chance). */
export function handleFlinchSideEffect(
  effect: string,
  defender: BattlePokemon,
  attackerMovedFirst: boolean,
): string[] | null {
  // Flinch only works if attacker moved first
  if (!attackerMovedFirst) return null;
  if (defender.volatiles.substitute > 0) return null;

  const chance = effect === 'FLINCH_SIDE_EFFECT2' ? 77 : 26; // 30% or 10%
  if (Math.floor(Math.random() * 256) >= chance) return null;

  defender.volatiles.flinch = true;
  return null; // No message for flinch application (only on flinch trigger)
}

/** Handle confusion side effect (10% chance, from Psybeam etc). */
export function handleConfusionSideEffect(
  defender: BattlePokemon,
): string[] | null {
  if (defender.volatiles.substitute > 0) return null;
  if (defender.volatiles.confusion > 0) return null;

  // 10% chance (26/256)
  if (Math.floor(Math.random() * 256) >= 26) return null;

  defender.volatiles.confusion = Math.floor(Math.random() * 4) + 2; // 2-5 turns
  return [`${defender.nickname.toUpperCase()} became`, `confused!`];
}

/** Handle Jump Kick / Hi Jump Kick crash on miss. */
export function handleJumpKickCrash(attacker: BattlePokemon): EffectResult {
  const result = emptyResult();
  // Gen 1: crash damage is 1 HP
  attacker.currentHp = Math.max(0, attacker.currentHp - 1);
  result.recoilDamage = 1;
  result.messages.push([`${attacker.nickname.toUpperCase()} kept going`, `and crashed!`]);
  return result;
}

/** Check if damage should be redirected to substitute. Returns true if substitute absorbed it. */
export function checkSubstitute(defender: BattlePokemon, damage: number): { absorbed: boolean; messages: string[][] } {
  if (defender.volatiles.substitute <= 0 || damage <= 0) {
    return { absorbed: false, messages: [] };
  }

  defender.volatiles.substitute -= damage;
  const messages: string[][] = [];

  if (defender.volatiles.substitute <= 0) {
    defender.volatiles.substitute = 0;
    messages.push([`${defender.nickname.toUpperCase()}'s`, `SUBSTITUTE faded!`]);
  }

  return { absorbed: true, messages };
}

/** Check if a stat-lowering move is blocked by Mist. */
export function isBlockedByMist(defender: BattlePokemon, stages: number): boolean {
  return defender.volatiles.mist && stages < 0;
}

/** Get the effective types for a pokemon (accounting for Conversion/Transform). */
export function getEffectiveTypes(pokemon: BattlePokemon): { type1: string; type2: string } {
  return {
    type1: pokemon.volatiles.convertedType1 ?? pokemon.species.type1,
    type2: pokemon.volatiles.convertedType2 ?? pokemon.species.type2,
  };
}

/** Reset the cached move list (no-op, kept for API compatibility). */
export function resetMoveCache(): void {
  // Move list now comes from data.ts getAllLoadedMoveIds()
}
