import { CRY_SFX_END } from './low_health_alarm';

export const CRY_SFX_START = 0x14;
const BATTLE_SFX_START = 0x9d;
const BATTLE_SFX_END = 0xea;

/** The shared WRAM bytes used by field and battle sound requests. */
export const sfxModifierState = { frequency: 0, tempo: 0, savedVolume: 0 };

export function isCry(id: number): boolean {
  return id >= CRY_SFX_START && id < CRY_SFX_END;
}

/** Audio1_IsCry and Audio1_IsBattleSFX inspect the live channel ids at each note. */
export function sfxModifiers(id5: number, id8: number, bank: number): { tempo: number; frequency: number } {
  const combinedId = id5 | id8;
  if (isCry(id5) || (bank === 0x08 && combinedId >= BATTLE_SFX_START && combinedId <= BATTLE_SFX_END)) {
    return { tempo: 0x80 + (sfxModifierState.tempo & 0xff), frequency: sfxModifierState.frequency & 0xff };
  }
  return { tempo: 0x100, frequency: 0 };
}
