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

export function getText(key: string): string {
  return gameText[key] ?? `[${key}]`;
}
