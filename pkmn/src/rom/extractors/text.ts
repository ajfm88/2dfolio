// ROM text decoder: Game Boy charmap bytes → Unicode strings
// Reference: constants/charmap.asm (English section)

import { BinaryReader } from '../binary_reader';
import {
  MOVE_NAMES as MOVE_NAMES_OFFSET, NUM_MOVES,
  MONSTER_NAMES, NAME_LENGTH, NUM_POKEMON,
  ITEM_NAMES_OFFSET, ITEM_NAME_LENGTH, NUM_ITEM_NAMES,
  TRAINER_NAMES, NUM_TRAINERS, TRAINER_NAME_LENGTH,
} from '../rom_offsets';

/** Reverse charmap: ROM byte value → Unicode character */
const CHARMAP: Record<number, string> = {
  // Control characters
  0x4E: '\n',       // NEXT / scroll to next line
  0x4F: '\n',       // LINE / newline
  0x50: '',         // @ terminator (handled by caller)
  0x51: '\f',       // PARA / page break
  0x52: '<PLAYER>', // player name placeholder
  0x53: '<RIVAL>',  // rival name placeholder
  0x54: 'POKé',      // # = POKé (expanded from single-char "#")
  0x55: '\n',       // CONT
  0x57: '',         // DONE
  0x58: '',         // PROMPT

  // Box drawing / special
  0x7F: ' ',        // space

  // Uppercase A-Z: $80-$99
  ...Object.fromEntries(
    Array.from({ length: 26 }, (_, i) => [0x80 + i, String.fromCharCode(65 + i)])
  ),

  // Symbols after Z
  0x9A: '(', 0x9B: ')', 0x9C: ':', 0x9D: ';', 0x9E: '[', 0x9F: ']',

  // Lowercase a-z: $A0-$B9
  ...Object.fromEntries(
    Array.from({ length: 26 }, (_, i) => [0xA0 + i, String.fromCharCode(97 + i)])
  ),

  // Accented / contraction
  0xBA: 'é',
  0xBB: "'d", 0xBC: "'l", 0xBD: "'s", 0xBE: "'t", 0xBF: "'v",

  // More special characters
  0xE0: "'",   // apostrophe
  0xE1: 'PK',  // <PK> glyph (first half of POKé)
  0xE2: 'MN',  // <MN> glyph (second half of POKéMON)
  0xE3: '-',   // dash
  0xE4: "'r", 0xE5: "'m",
  0xE6: '?', 0xE7: '!', 0xE8: '.',

  0xEF: '♂',
  0xF0: '¥',
  0xF1: '×',
  0xF2: '.', // decimal point
  0xF3: '/',
  0xF4: ',',
  0xF5: '♀',

  // Digits 0-9: $F6-$FF
  ...Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => [0xF6 + i, String(i)])
  ),
};

/** Decode a 0x50-terminated ROM string to Unicode */
export function decodeText(rom: BinaryReader, offset: number, maxLen = 255): string {
  let result = '';
  for (let i = 0; i < maxLen; i++) {
    const byte = rom.readByte(offset + i);
    if (byte === 0x50) break; // string terminator
    const ch = CHARMAP[byte];
    if (ch !== undefined) {
      result += ch;
    }
    // Unknown bytes are silently skipped
  }
  return result;
}

/** Decode a fixed-length ROM string (padded with 0x50) */
export function decodeFixedString(rom: BinaryReader, offset: number, len: number): string {
  return decodeText(rom, offset, len);
}

/**
 * Decode map dialogue/sign text from ROM.
 * Same as decodeText but also stops at 0x57 (DONE) and 0x58 (PROMPT),
 * which are the text script terminators used for NPC dialogue and sign text.
 */
export function decodeMapText(rom: BinaryReader, offset: number, maxLen = 500): string {
  let result = '';
  for (let i = 0; i < maxLen; i++) {
    const byte = rom.readByte(offset + i);
    if (byte === 0x50 || byte === 0x57 || byte === 0x58) break;
    const ch = CHARMAP[byte];
    if (ch !== undefined) {
      result += ch;
    }
  }
  // Trim trailing/pre-newline spaces (ROM text is sometimes padded with 0x7F=space)
  return result.replace(/ +$/gm, '');
}

/**
 * Convert an uppercase ROM name to title case.
 * "BULBASAUR" → "Bulbasaur", "MR.MIME" → "Mr. Mime", "NIDORAN♂" → "Nidoran-M"
 */
export function titleCaseName(romName: string): string {
  // Special cases
  const specials: Record<string, string> = {
    "NIDORAN♂": "Nidoran-M",
    "NIDORAN♀": "Nidoran-F",
    "MR.MIME": "Mr. Mime",
    "FARFETCH'D": "Farfetch'd",
  };
  const trimmed = romName.trim();
  if (specials[trimmed]) return specials[trimmed];

  // General case: title case each word
  return trimmed.split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join('');
}

// ── ROM Name Table Readers ──────────────────────────────────────

/**
 * Convert a ROM display name to assembly constant format.
 * "MEGA PUNCH" → "MEGA_PUNCH", "POKé BALL" → "POKE_BALL",
 * "S.S.TICKET" → "S_S_TICKET", "DOUBLE-EDGE" → "DOUBLE_EDGE"
 */
function displayToConstant(name: string): string {
  return name
    .replace(/é/g, 'E')
    .replace(/♂/g, '_M')
    .replace(/♀/g, '_F')
    .replace(/'/g, '')            // FARFETCH'D → FARFETCHD
    .replace(/[. \-?!]/g, '_');
}

/** Special case overrides for names that don't follow the standard conversion */
const MOVE_NAME_OVERRIDES: Record<string, string> = {
  'PSYCHIC': 'PSYCHIC_M',  // disambiguate from PSYCHIC type
};

/** Per-item-ID overrides where ROM display name doesn't match assembly constant */
const ITEM_ID_OVERRIDES: Record<number, string> = {
  0x07: 'SURFBOARD',       // ROM has "?????" (hidden item)
  0x21: 'THUNDER_STONE',   // ROM has "THUNDERSTONE" (no space)
  0x2C: 'ITEM_2C',         // ROM has "?????" (placeholder)
  0x32: 'ITEM_32',         // ROM has "PP UP" but constant is ITEM_32 (old PP Up slot)
  0x37: 'GUARD_SPEC',      // ROM has "GUARD SPEC." — trailing period
};

const TRAINER_NAME_OVERRIDES: Record<string, string> = {
  'PSYCHIC': 'PSYCHIC_TR',  // disambiguate from PSYCHIC type/move
};

/** Per-class-ID overrides for trainer names where ROM display name
 *  differs from the assembly constant name used in JSON output. */
const TRAINER_CLASS_ID_OVERRIDES: Record<number, string> = {
  13: 'UNUSED_JUGGLER',  // ROM has "JUGGLER" but class 13 is unused (class 21 is the real JUGGLER)
  14: 'FISHER',          // ROM has "FISHERMAN" but JSON key is "FISHER"
  25: 'RIVAL1',          // ROM has "RIVAL" with ? suffix
  42: 'RIVAL2',
  43: 'RIVAL3',
};

/**
 * Read all 165 move names from ROM. Returns array indexed by move ID (0 = "NO_MOVE").
 * Move names are variable-length, 0x50-terminated, stored sequentially.
 */
export function readMoveNames(rom: BinaryReader): string[] {
  const names: string[] = ['NO_MOVE']; // index 0
  let offset = MOVE_NAMES_OFFSET;
  for (let i = 1; i <= NUM_MOVES; i++) {
    const display = decodeText(rom, offset);
    const constant = MOVE_NAME_OVERRIDES[display] || displayToConstant(display);
    names.push(constant);
    // Advance past this name: walk bytes until 0x50 terminator
    let len = 0;
    while (rom.readByte(offset + len) !== 0x50) len++;
    offset += len + 1; // skip past terminator
  }
  return names;
}

/**
 * Read all item names from ROM. Returns map of item ID → constant name.
 * Items are variable-length, 0x50-terminated, stored sequentially from ID 1.
 */
export function readItemNames(rom: BinaryReader): Record<number, string> {
  const names: Record<number, string> = { 0: 'NO_ITEM' };
  let offset = ITEM_NAMES_OFFSET;
  for (let i = 1; i <= NUM_ITEM_NAMES; i++) {
    if (ITEM_ID_OVERRIDES[i]) {
      names[i] = ITEM_ID_OVERRIDES[i];
    } else {
      const display = decodeText(rom, offset, ITEM_NAME_LENGTH);
      names[i] = displayToConstant(display);
    }
    // Always advance past this name in ROM regardless of override
    let len = 0;
    while (rom.readByte(offset + len) !== 0x50) len++;
    offset += len + 1;
  }
  return names;
}

/**
 * Read item display names from ROM. Returns map of constant key → display name.
 * E.g., { "POKE_BALL": "POKé BALL", "POTION": "POTION", ... }
 */
export function readItemDisplayNames(rom: BinaryReader): Record<string, string> {
  const result: Record<string, string> = {};
  let offset = ITEM_NAMES_OFFSET;
  for (let i = 1; i <= NUM_ITEM_NAMES; i++) {
    const display = decodeText(rom, offset, ITEM_NAME_LENGTH);
    const constant = ITEM_ID_OVERRIDES[i] || displayToConstant(display);
    result[constant] = display;
    let len = 0;
    while (rom.readByte(offset + len) !== 0x50) len++;
    offset += len + 1;
  }
  return result;
}

/**
 * Read all trainer class names from ROM. Returns array indexed by class ID (0 = "NOBODY").
 * Names are variable-length, 0x50-terminated, stored sequentially.
 */
export function readTrainerClassNames(rom: BinaryReader): string[] {
  const names: string[] = ['NOBODY']; // index 0
  let offset = TRAINER_NAMES;
  for (let i = 1; i <= NUM_TRAINERS; i++) {
    // Per-ID override takes priority (for names that don't match constants)
    if (TRAINER_CLASS_ID_OVERRIDES[i]) {
      names.push(TRAINER_CLASS_ID_OVERRIDES[i]);
    } else {
      const display = decodeText(rom, offset, TRAINER_NAME_LENGTH);
      const constant = TRAINER_NAME_OVERRIDES[display] || displayToConstant(display);
      names.push(constant);
    }
    // Always advance past this name in ROM regardless of override
    let len = 0;
    while (rom.readByte(offset + len) !== 0x50) len++;
    offset += len + 1;
  }
  return names;
}

/**
 * Read all 190 pokemon internal names from ROM. Returns map of internal ID → constant name.
 * Names are fixed-length (NAME_LENGTH = 10 bytes), 0x50-padded, 190 sequential entries.
 */
export function readPokemonInternalNames(rom: BinaryReader): Record<number, string> {
  const names: Record<number, string> = {};
  for (let i = 1; i <= NUM_POKEMON; i++) {
    const offset = MONSTER_NAMES + (i - 1) * NAME_LENGTH;
    const display = decodeFixedString(rom, offset, NAME_LENGTH);
    if (display && display.trim()) {
      names[i] = displayToConstant(display);
    }
  }
  return names;
}

/**
 * Convert a ROM pokemon name (uppercase) to a filesystem-safe filename.
 * "BULBASAUR" → "bulbasaur", "NIDORAN♂" → "nidoran_m",
 * "NIDORAN♀" → "nidoran_f", "MR.MIME" → "mr._mime", "FARFETCH'D" → "farfetchd"
 */
export function pokemonNameToFilename(romName: string): string {
  const specials: Record<string, string> = {
    "NIDORAN♂": "nidoran_m",
    "NIDORAN♀": "nidoran_f",
    "MR.MIME": "mr._mime",
    "FARFETCH'D": "farfetchd",
  };
  // Check with trimmed name (ROM names are 0x50-padded)
  const trimmed = romName.trim();
  if (specials[trimmed]) return specials[trimmed];

  return trimmed.toLowerCase().replace(/'/g, '');
}
