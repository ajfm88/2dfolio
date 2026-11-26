import type { BinaryReader } from '../binary_reader';
import { BASE_STATS, BASE_DATA_SIZE, NUM_DEX } from '../rom_offsets';

/** Indexed by Pokedex ID; each entry is the cartridge's seven TM/HM bytes. */
export type MachineCompatibility = (number[] | null)[];

export function extractMachineCompatibility(rom: BinaryReader): MachineCompatibility {
  const result: MachineCompatibility = [null];
  for (let dex = 1; dex <= NUM_DEX; dex++) {
    const offset = BASE_STATS + (dex - 1) * BASE_DATA_SIZE;
    if (rom.readByte(offset) !== dex) throw new Error(`BaseStats: invalid dex for ${dex}`);
    const bytes = rom.readBytes(offset + 0x14, 7);
    if (bytes.length !== 7) throw new Error(`BaseStats: truncated compatibility for ${dex}`);
    if (bytes[6] & 0x80) throw new Error(`BaseStats: unused compatibility bit set for ${dex}`);
    result.push([...bytes]);
  }
  return result;
}
