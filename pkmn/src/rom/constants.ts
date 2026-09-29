// ROM constants extracted from Pokemon Yellow assembly source
// Only contains non-copyrightable enum constants (internal identifiers, not display text).
// All copyrighted name tables (move names, pokemon names, item names, trainer names)
// are now read from ROM at extraction time — see extractors/text.ts.

/** Type names mapped by type byte value. From constants/type_constants.asm */
export const TYPE_NAMES: Record<number, string> = {
  0: 'NORMAL',
  1: 'FIGHTING',
  2: 'FLYING',
  3: 'POISON',
  4: 'GROUND',
  5: 'ROCK',
  7: 'BUG',
  8: 'GHOST',
  20: 'FIRE',
  21: 'WATER',
  22: 'GRASS',
  23: 'ELECTRIC',
  24: 'PSYCHIC_TYPE',
  25: 'ICE',
  26: 'DRAGON',
};

/** Move effect names indexed by effect ID. From constants/move_effect_constants.asm */
export const EFFECT_NAMES: string[] = [
  'NO_ADDITIONAL_EFFECT',       // 0x00
  'EFFECT_01',                  // 0x01 unused
  'POISON_SIDE_EFFECT1',        // 0x02
  'DRAIN_HP_EFFECT',            // 0x03
  'BURN_SIDE_EFFECT1',          // 0x04
  'FREEZE_SIDE_EFFECT1',        // 0x05
  'PARALYZE_SIDE_EFFECT1',      // 0x06
  'EXPLODE_EFFECT',             // 0x07
  'DREAM_EATER_EFFECT',         // 0x08
  'MIRROR_MOVE_EFFECT',         // 0x09
  'ATTACK_UP1_EFFECT',          // 0x0A
  'DEFENSE_UP1_EFFECT',         // 0x0B
  'SPEED_UP1_EFFECT',           // 0x0C
  'SPECIAL_UP1_EFFECT',         // 0x0D
  'ACCURACY_UP1_EFFECT',        // 0x0E
  'EVASION_UP1_EFFECT',         // 0x0F
  'PAY_DAY_EFFECT',             // 0x10
  'SWIFT_EFFECT',               // 0x11
  'ATTACK_DOWN1_EFFECT',        // 0x12
  'DEFENSE_DOWN1_EFFECT',       // 0x13
  'SPEED_DOWN1_EFFECT',         // 0x14
  'SPECIAL_DOWN1_EFFECT',       // 0x15
  'ACCURACY_DOWN1_EFFECT',      // 0x16
  'EVASION_DOWN1_EFFECT',       // 0x17
  'CONVERSION_EFFECT',          // 0x18
  'HAZE_EFFECT',                // 0x19
  'BIDE_EFFECT',                // 0x1A
  'THRASH_PETAL_DANCE_EFFECT',  // 0x1B
  'SWITCH_AND_TELEPORT_EFFECT', // 0x1C
  'TWO_TO_FIVE_ATTACKS_EFFECT', // 0x1D
  'EFFECT_1E',                  // 0x1E unused
  'FLINCH_SIDE_EFFECT1',        // 0x1F
  'SLEEP_EFFECT',               // 0x20
  'POISON_SIDE_EFFECT2',        // 0x21
  'BURN_SIDE_EFFECT2',          // 0x22
  'FREEZE_SIDE_EFFECT2',        // 0x23 unused
  'PARALYZE_SIDE_EFFECT2',      // 0x24
  'FLINCH_SIDE_EFFECT2',        // 0x25
  'OHKO_EFFECT',                // 0x26
  'CHARGE_EFFECT',              // 0x27
  'SUPER_FANG_EFFECT',          // 0x28
  'SPECIAL_DAMAGE_EFFECT',      // 0x29
  'TRAPPING_EFFECT',            // 0x2A
  'FLY_EFFECT',                 // 0x2B
  'ATTACK_TWICE_EFFECT',        // 0x2C
  'JUMP_KICK_EFFECT',           // 0x2D
  'MIST_EFFECT',                // 0x2E
  'FOCUS_ENERGY_EFFECT',        // 0x2F
  'RECOIL_EFFECT',              // 0x30
  'CONFUSION_EFFECT',           // 0x31
  'ATTACK_UP2_EFFECT',          // 0x32
  'DEFENSE_UP2_EFFECT',         // 0x33
  'SPEED_UP2_EFFECT',           // 0x34
  'SPECIAL_UP2_EFFECT',         // 0x35
  'ACCURACY_UP2_EFFECT',        // 0x36
  'EVASION_UP2_EFFECT',         // 0x37
  'HEAL_EFFECT',                // 0x38
  'TRANSFORM_EFFECT',           // 0x39
  'ATTACK_DOWN2_EFFECT',        // 0x3A
  'DEFENSE_DOWN2_EFFECT',       // 0x3B
  'SPEED_DOWN2_EFFECT',         // 0x3C
  'SPECIAL_DOWN2_EFFECT',       // 0x3D
  'ACCURACY_DOWN2_EFFECT',      // 0x3E
  'EVASION_DOWN2_EFFECT',       // 0x3F
  'LIGHT_SCREEN_EFFECT',        // 0x40
  'REFLECT_EFFECT',             // 0x41
  'POISON_EFFECT',              // 0x42
  'PARALYZE_EFFECT',            // 0x43
  'ATTACK_DOWN_SIDE_EFFECT',    // 0x44
  'DEFENSE_DOWN_SIDE_EFFECT',   // 0x45
  'SPEED_DOWN_SIDE_EFFECT',     // 0x46
  'SPECIAL_DOWN_SIDE_EFFECT',   // 0x47
  'EFFECT_48',                  // 0x48 unused (const_skip)
  'EFFECT_49',                  // 0x49 unused (const_skip)
  'EFFECT_4A',                  // 0x4A unused (const_skip)
  'EFFECT_4B',                  // 0x4B unused (const_skip)
  'CONFUSION_SIDE_EFFECT',      // 0x4C
  'TWINEEDLE_EFFECT',           // 0x4D
  'EFFECT_4E',                  // 0x4E unused (const_skip)
  'SUBSTITUTE_EFFECT',          // 0x4F
  'HYPER_BEAM_EFFECT',          // 0x50
  'RAGE_EFFECT',                // 0x51
  'MIMIC_EFFECT',               // 0x52
  'METRONOME_EFFECT',           // 0x53
  'LEECH_SEED_EFFECT',          // 0x54
  'SPLASH_EFFECT',              // 0x55
  'DISABLE_EFFECT',             // 0x56
];

/** Growth rate names indexed by growth rate ID. */
export const GROWTH_RATE_NAMES: string[] = [
  'MEDIUM_FAST',   // 0
  'SLIGHTLY_FAST', // 1
  'SLIGHTLY_SLOW', // 2
  'MEDIUM_SLOW',   // 3
  'FAST',          // 4
  'SLOW',          // 5
];

/** Evolution method constants. */
export const EVOLVE_LEVEL = 1;
export const EVOLVE_ITEM = 2;
export const EVOLVE_TRADE = 3;
