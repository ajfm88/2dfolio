// Game text module — loads all copyrightable dialogue and UI strings from JSON
// In dev mode, fetched from data/game_text.json. In production, extracted from ROM.

let gameText: Record<string, string> = {};

export async function loadGameText(): Promise<void> {
  try {
    const resp = await fetch('game_text.json');
    if (resp.ok) gameText = await resp.json();
  } catch {
    // game_text.json not available — getText() returns fallback placeholders
  }
}

/**
 * A string for a caller that hasn't moved to its text program yet (A5b4–A5b7): a trailing
 * `<PROMPT>`/`<DONE>` is dropped, so these callers keep their own endings.
 */
export function getText(key: string): string {
  return getRawText(key).replace(/<(PROMPT|DONE)>$/, '');
}

/** The extracted string, terminator included (A5b1). */
export function getRawText(key: string): string {
  return gameText[key] ?? `[${key}]`;
}
