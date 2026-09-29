// Extract move data from ROM → same format as data/moves.json
// moves.json format: { [moveName: string]: { id, effect, power, type, accuracy, pp } }

import { BinaryReader } from '../binary_reader';
import { MOVES, MOVE_LENGTH, NUM_MOVES } from '../rom_offsets';
import { TYPE_NAMES, EFFECT_NAMES } from '../constants';

export interface MoveEntry {
  id: number;
  effect: string;
  power: number;
  type: string;
  accuracy: number;
  pp: number;
}

export function extractMoves(rom: BinaryReader, moveNames: string[]): Record<string, MoveEntry> {
  const result: Record<string, MoveEntry> = {};

  for (let i = 1; i <= NUM_MOVES; i++) {
    const offset = MOVES + (i - 1) * MOVE_LENGTH;

    // byte 0 is animation/move ID (same as loop index), skip it
    rom.readByte(offset);
    const effectId = rom.readByte(offset + 1);
    const power = rom.readByte(offset + 2);
    const typeId = rom.readByte(offset + 3);
    const accuracyRaw = rom.readByte(offset + 4);
    const pp = rom.readByte(offset + 5);

    // Convert accuracy from 0-255 to 0-100 percentage
    // In the ROM: 255 = 100%, 0 = 0% (used for Swift-like moves that set accuracy differently)
    // The gen_moves.js reads accuracy from assembly source as already 0-100
    // In the ROM, accuracy is stored as the percentage value directly (e.g., 100 → 0xFF=255 means 100%)
    // Actually, looking at the assembly: `move POUND, NO_ADDITIONAL_EFFECT, 40, NORMAL, 100, 35`
    // The `move` macro stores the accuracy field directly. But in the ROM, POUND has acc=0xFF=255.
    // This means the macro converts 100 → 255. Let me check...
    // Actually no — the `move` macro in macros/data.asm uses: `db \4` for accuracy.
    // But POUND has 0xFF (255) in ROM, and the assembly says accuracy is 100.
    // So the assembly's "100" gets encoded as 0xFF (255) somehow... or does it?
    // Wait — looking at the actual ROM bytes: Move 1 (POUND) = 01 00 28 00 ff 23
    // That's accuracy = 0xFF = 255. But gen_moves.js reads "100" from the text.
    // The ROM stores accuracy as out of 256 (not out of 100).
    // 100% accuracy = 255/256 (0xFF), 85% = ~217 (0xD9), etc.
    //
    // Formula: accuracy_percent = Math.floor(accuracyRaw * 100 / 256)
    // But we need to match the JSON exactly:
    // 0xFF (255) → 100 (not 99.6)
    // Let me check a few values in the ROM vs JSON...

    // Accuracy conversion: the assembly source uses percentage (100, 85, 75, etc.)
    // and the `move` macro converts it. Looking at macros/data.asm:
    //   move: MACRO
    //     db \1    ; animation
    //     db \2    ; effect
    //     db \3    ; power
    //     db \4    ; type
    //     db \5 * 255 / 100  ; accuracy: percentage → 0-255
    //     db \6    ; pp
    //   ENDM
    // So accuracy_percent = round(accuracyRaw * 100 / 255)
    const accuracy = accuracyRaw === 0 ? 0 : Math.round(accuracyRaw * 100 / 255);

    const moveName = moveNames[i] || `MOVE_${i}`;
    const typeName = TYPE_NAMES[typeId] || `TYPE_${typeId}`;
    const effectName = EFFECT_NAMES[effectId] || `EFFECT_${effectId}`;

    result[moveName] = {
      id: i,
      effect: effectName,
      power,
      type: typeName,
      accuracy,
      pp,
    };
  }

  return result;
}
