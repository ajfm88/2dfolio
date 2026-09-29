// Extract type effectiveness chart from ROM → same format as data/type_chart.json
// type_chart.json format: [{ attacker: string, defender: string, multiplier: number }, ...]

import { BinaryReader } from '../binary_reader';
import { TYPE_EFFECTS } from '../rom_offsets';
import { TYPE_NAMES } from '../constants';

export interface TypeMatchup {
  attacker: string;
  defender: string;
  multiplier: number;
}

// ROM effectiveness values → multiplier
// SUPER_EFFECTIVE = 0x14 (20) → 2
// NOT_VERY_EFFECTIVE = 0x05 (5) → 0.5
// NO_EFFECT = 0x00 (0) → 0
// (EFFECTIVE = 0x0A (10) → 1, but these aren't stored in the table)
function effectivenessToMultiplier(value: number): number {
  if (value === 0x14) return 2;
  if (value === 0x05) return 0.5;
  if (value === 0x00) return 0;
  return 1; // shouldn't appear in the table
}

export function extractTypeChart(rom: BinaryReader): TypeMatchup[] {
  const result: TypeMatchup[] = [];
  let offset = TYPE_EFFECTS;

  // Read 3-byte entries until we hit 0xFF terminator
  // Note: there's also a 0xFE sentinel in the middle (marks "foresight" boundary)
  // which we skip
  while (true) {
    const byte = rom.readByte(offset);
    if (byte === 0xFF) break;
    if (byte === 0xFE) {
      // Skip the foresight sentinel (3 bytes: FE, XX, XX)
      offset += 3;
      continue;
    }

    const attackerType = byte;
    const defenderType = rom.readByte(offset + 1);
    const effectiveness = rom.readByte(offset + 2);

    const attackerName = TYPE_NAMES[attackerType];
    const defenderName = TYPE_NAMES[defenderType];

    if (attackerName && defenderName) {
      result.push({
        attacker: attackerName,
        defender: defenderName,
        multiplier: effectivenessToMultiplier(effectiveness),
      });
    }

    offset += 3;
  }

  return result;
}
