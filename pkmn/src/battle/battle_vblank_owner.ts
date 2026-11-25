import type { Frame } from './battle_menu_context';

/** The host services its own VBlank; session frames and frames outside battle belong to main. */
export function mainOwnsRandom(frame: Frame | null | undefined, held: boolean, dark: boolean): boolean {
  return !held && !dark && frame !== 'serviced' && frame !== 'held' && frame !== 'dark';
}
