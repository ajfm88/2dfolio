// TypeNames (data/types/names.asm), ROM 09:7d63; all 27 display entries.
// Separate from the mechanics identifiers: type 24's key remains PSYCHIC_TYPE (#10).
import { TYPE_NAMES } from '../rom/constants';

export const TYPE_DISPLAY_NAMES: readonly string[] = [
  'NORMAL', 'FIGHTING', 'FLYING', 'POISON', 'GROUND', 'ROCK', 'BIRD', 'BUG', 'GHOST',
  // Unused type IDs 9–19 all point to .Normal on the cartridge.
  ...Array<string>(11).fill('NORMAL'),
  'FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'PSYCHIC', 'ICE', 'DRAGON',
];

const TYPE_IDS_BY_KEY = new Map(Object.entries(TYPE_NAMES).map(([id, key]) => [key, Number(id)]));

/** PrintMoveType's display string, from the move data's internal type key. */
export function moveTypeDisplayName(typeKey: string): string {
  const id = TYPE_IDS_BY_KEY.get(typeKey);
  if (id === undefined) throw new Error(`unknown move type key: ${typeKey}`);
  return TYPE_DISPLAY_NAMES[id];
}
