// CryData (data/pokemon/cries.asm). GetCryData indexes it with `dec a`, so row 0 is
// internal species index 1. Each row is 3 bytes: base cry, pitch, length.
// pokemon.json is unchanged; this file is the lookup (note 140, ruling 2).
import type { BinaryReader } from '../binary_reader';
import { CRY_DATA, NUM_POKEMON } from '../rom_offsets';

export interface CryRow {
  index: number;
  base: number;
  pitch: number;
  length: number;
}

export interface CriesData {
  rows: CryRow[];
}

/** 190 rows in ROM order. `index` is the internal species index; `base` is 0–0x25. */
export function extractCries(rom: BinaryReader): CriesData {
  const rows: CryRow[] = [];
  for (let row = 0; row < NUM_POKEMON; row++) {
    const at = CRY_DATA + row * 3;
    rows.push({
      index: row + 1,
      base: rom.readByte(at),
      pitch: rom.readByte(at + 1),
      length: rom.readByte(at + 2),
    });
  }
  return { rows };
}
