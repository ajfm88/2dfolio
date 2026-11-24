// Pikachu's voice clips: audio/pikachu_cries_pointers.asm (PikachuCriesPointerTable, 3c:408e) and
// audio/pikachu_cries.asm. Opening checkpoint-03 (note 112): data only, unused until the PCM player.
import { BinaryReader } from '../binary_reader';
import { PIKACHU_CRIES_POINTER_TABLE } from '../rom_offsets';

/** The table has 42 `dba` rows (PikachuCry1 … PikachuCry42). */
export const NUM_PIKACHU_CRIES = 42;

/** pret's PikachuCryN numbers used by the title, battle, status screen and Bill's PC. */
export const PIKACHU_CLIP_NUMBERS: readonly number[] = [1, 4, 11, 17, 28, 35, 37, 40];

export interface PikachuClip {
  /** The table index `ldpikacry` loads into e: pret's PikachuCryN is id N - 1. */
  id: number;
  /** The clip's 16-bit length word: the number of bytes PlayPikachuPCM plays. */
  length: number;
  /** Those bytes as lowercase hex, two digits a byte. Each byte is eight 1-bit samples, most significant
   *  bit first (home/pikachu_cries.asm). The ROM's one trailing byte is never played and is not included. */
  samples: string;
}

/** The file setup writes for pret's PikachuCryN, named after pret's own `pikachu_cry_N` source. */
export function pikachuClipFile(number: number): string {
  return `audio/pikachu_cries/pikachu_cry_${number}.json`;
}

export function extractPikachuClip(rom: BinaryReader, number: number): PikachuClip {
  if (!Number.isInteger(number) || number < 1 || number > NUM_PIKACHU_CRIES) {
    throw new Error(`PikachuCry${number} is not in PikachuCriesPointerTable`);
  }
  const row = PIKACHU_CRIES_POINTER_TABLE + 3 * (number - 1);
  const bank = rom.readByte(row);
  const addr = rom.readWord(row + 1);
  if (addr < 0x4000 || addr >= 0x8000) throw new Error(`PikachuCry${number}: pointer $${addr.toString(16)} is not in ROMX`);
  const start = bank * 0x4000 + (addr & 0x3fff);
  const length = rom.readWord(start);
  if (length === 0 || (addr & 0x3fff) + 2 + length + 1 > 0x4000) throw new Error(`PikachuCry${number}: length ${length} leaves its bank`);
  const bytes = rom.readBytes(start + 2, length);
  return { id: number - 1, length, samples: Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('') };
}
