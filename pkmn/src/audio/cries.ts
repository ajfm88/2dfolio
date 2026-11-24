import cryData from '../../data/cries.json';
import type { Program } from '../battle/battle_menu_context';
import { lowHealthAlarm, setLowHealthAlarm } from './low_health_alarm';
import { CRY_SFX_START, sfxModifierState } from './sfx_modifiers';

/** The internal species byte includes the MissingNo. rows. */
export function cryEntry(index: number) {
  const row = cryData.rows[index - 1];
  if (!row) throw new RangeError(`No cry data for internal species ${index}`);
  return { id: CRY_SFX_START + 3 * row.base, pitch: row.pitch, length: row.length };
}

/** GetCryData writes the modifiers and returns the sound id in A. */
export function getCryData(index: number): number {
  const row = cryEntry(index);
  sfxModifierState.frequency = row.pitch;
  sfxModifierState.tempo = row.length;
  return row.id;
}

/** PlayCry (home/pokemon.asm): the alarm stays clear through the full sound wait. */
export function* playCryProgram(index: number, request: (id: number) => void, finished: () => boolean): Program {
  const alarm = lowHealthAlarm();
  setLowHealthAlarm(0);
  try {
    request(getCryData(index));
    while (!finished()) yield 'serviced';
  } finally {
    setLowHealthAlarm(alarm);
  }
}
