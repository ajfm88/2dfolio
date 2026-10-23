// pret e89ead15 effects.asm:780-798; data/battle/stat_mod_names.asm:4-17.
// symbols: StatModTextStrings 0f:7655, StatModifierRatios 0f:7681.
import type { BinaryReader } from '../binary_reader';

export const STAT_MOD_TEXT_OFFSET = 0x0f * 0x4000 + 0x3655;
export const STAT_MOD_TEXT_LENGTH = 0x2c;
export const STAT_NAME_LENGTH = 10;
export interface StatModTextData { bytes: number[] }

/** pret effects.asm:780-794: EVADE's ten-byte copy includes four following ratio bytes. */
export function extractStatModText(rom: BinaryReader): StatModTextData {
  const bytes = [...rom.readBytes(STAT_MOD_TEXT_OFFSET, STAT_MOD_TEXT_LENGTH + 4)];
  if (bytes.length !== STAT_MOD_TEXT_LENGTH + 4 || bytes.slice(0, STAT_MOD_TEXT_LENGTH).filter(b => b === 0x50).length !== 6)
    throw new Error('StatModTextStrings: truncated or invalid table');
  return { bytes };
}
