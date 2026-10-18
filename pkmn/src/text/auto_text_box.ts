import type { ScriptCommand } from '../script/types';

// BIT_NO_AUTO_TEXT_BOX per map: DisplayTextIDInit skips its initial TextBoxBorder.
// A map script that stores 1 << BIT_NO_AUTO_TEXT_BOX in wAutoTextBoxDrawingControl on every
// pass puts the whole map there; explicit EnableAutoTextBoxDrawing calls (bookshelves) override it.
const NO_AUTO_TEXT_BOX_MAPS: ReadonlySet<string> = new Set([
  'OaksLab',    // scripts/OaksLab.asm OaksLab_Script
  'PewterMart', // scripts/PewterMart.asm PewterMart_Script
]);

/** The map's default for DisplayTextIDInit's initial border (true = drawn). */
export function mapAutoTextBox(mapName: string): boolean {
  return !NO_AUTO_TEXT_BOX_MAPS.has(mapName);
}

/**
 * A registered DisplayTextID handler or TX_SCRIPT opens with the map's flag (hTextID entries
 * never touch it); the first displayOpen takes the map default. Hidden events and bookshelves
 * do not come through here: their own EnableAutoTextBoxDrawing stays explicit.
 */
export function applyMapAutoTextBox(commands: ScriptCommand[], mapName: string): ScriptCommand[] {
  if (mapAutoTextBox(mapName)) return commands;
  const i = commands.findIndex(c => c.type === 'displayOpen');
  if (i < 0) return commands;
  return commands.map((c, j) => (j === i && c.type === 'displayOpen' ? { ...c, autoBox: false } : c));
}
