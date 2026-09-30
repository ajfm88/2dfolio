// Volatile battle status — temporary conditions that clear on switch-out or battle end.
// Faithful to Gen 1 mechanics (core.asm, mechanics.zig).

/** Volatile state for a Pokemon in battle. All fields reset on switch-in. */
export interface Volatiles {
  confusion: number;           // turns remaining (0 = not confused); 2-5 random duration
  substitute: number;          // substitute HP (0 = no substitute)
  leechSeed: boolean;          // seeded by opponent's Leech Seed
  mist: boolean;               // protected from stat reductions
  focusEnergy: boolean;        // Focus Energy active (Gen 1 bug: halves crit rate)
  reflect: boolean;            // physical damage halved (ignored on crits)
  lightScreen: boolean;        // special damage halved (ignored on crits)
  bide: { turnsLeft: number; damage: number } | null;  // accumulating damage for Bide
  rage: boolean;               // locked into Rage; attack +1 each time hit
  thrashing: number;           // turns remaining for Thrash/Petal Dance (0 = not thrashing)
  charging: string | null;     // move name being charged (turn 1 of 2-turn move), null if not
  invulnerable: boolean;       // Fly/Dig semi-invulnerable turn (most moves miss)
  recharging: boolean;         // must recharge (Hyper Beam); skip next turn
  flinch: boolean;             // flinched this turn; skip action
  disabled: { moveIndex: number; turnsLeft: number } | null;
  transformed: boolean;        // has used Transform (affects PP handling)
  binding: number;             // turns remaining trapped by opponent's binding move (0 = not trapped)
  usingBinding: number;        // turns remaining using binding move on opponent (0 = not binding)
  lastDamageDealt: number;     // damage dealt last turn (for recoil, Counter)
  lastDamageReceived: number;  // damage received last turn (for Bide, Counter)
  lastMoveUsed: string | null; // last move used (for Mirror Move)
  // Converted types (for Conversion / Transform)
  convertedType1: string | null;
  convertedType2: string | null;
  // Mimic: track which move slot was replaced and original move for restoration
  mimicSlot: number;           // -1 if not mimicking
  mimicOriginal: string | null;
  // Pay Day money accumulated
  payDayMoney: number;
  // Multi-hit tracking
  multiHitCount: number;       // hits remaining for multi-hit moves (0 = not in multi-hit)
  multiHitTotal: number;       // total hits done so far
}

/** Create a fresh volatile state (all fields at default/off). */
export function createVolatiles(): Volatiles {
  return {
    confusion: 0,
    substitute: 0,
    leechSeed: false,
    mist: false,
    focusEnergy: false,
    reflect: false,
    lightScreen: false,
    bide: null,
    rage: false,
    thrashing: 0,
    charging: null,
    invulnerable: false,
    recharging: false,
    flinch: false,
    disabled: null,
    transformed: false,
    binding: 0,
    usingBinding: 0,
    lastDamageDealt: 0,
    lastDamageReceived: 0,
    lastMoveUsed: null,
    convertedType1: null,
    convertedType2: null,
    mimicSlot: -1,
    mimicOriginal: null,
    payDayMoney: 0,
    multiHitCount: 0,
    multiHitTotal: 0,
  };
}

/** Reset all volatiles (called on switch-in, battle start). */
export function resetVolatiles(): Volatiles {
  return createVolatiles();
}
