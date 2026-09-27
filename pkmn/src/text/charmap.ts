// Maps Unicode characters to tile indices in font.png
// font.png is 128x64 (16 tiles/row × 8 rows = 128 tiles)
// Tile 0 = charmap $80 = 'A', so tile index = charmap_value - 0x80

const CHAR_TO_TILE: Record<string, number> = {};

// Uppercase A-Z: charmap $80-$99 → tiles 0-25
for (let i = 0; i < 26; i++) {
  CHAR_TO_TILE[String.fromCharCode(65 + i)] = i;
}

// Symbols after Z: ( ) : ; [ ]
const symbols1 = '():;[]';
for (let i = 0; i < symbols1.length; i++) {
  CHAR_TO_TILE[symbols1[i]] = 26 + i;
}

// Lowercase a-z: charmap $A0-$B9 → tiles 32-57
for (let i = 0; i < 26; i++) {
  CHAR_TO_TILE[String.fromCharCode(97 + i)] = 32 + i;
}

// Accented/contraction chars: é 'd 'l 's 't 'v → tiles 58-63
CHAR_TO_TILE['é'] = 58;

// Row 4+ special characters
CHAR_TO_TILE["'"] = 96;   // apostrophe $E0
CHAR_TO_TILE['\u{E001}'] = 97;  // <PK> glyph $E1
CHAR_TO_TILE['\u{E002}'] = 98;  // <MN> glyph $E2
CHAR_TO_TILE['-'] = 99;   // dash $E3
CHAR_TO_TILE['?'] = 102;  // $E6
CHAR_TO_TILE['!'] = 103;  // $E7
CHAR_TO_TILE['.'] = 104;  // $E8
CHAR_TO_TILE['▷'] = 108;  // unfilled right arrow $EC
CHAR_TO_TILE['▶'] = 109;  // filled right arrow $ED (cursor)
CHAR_TO_TILE['▼'] = 110;  // down arrow $EE (prompt indicator)
CHAR_TO_TILE['♂'] = 111;  // $EF
CHAR_TO_TILE['¥'] = 112;  // $F0 — Pokémon currency symbol
CHAR_TO_TILE['×'] = 113;  // $F1
CHAR_TO_TILE['/'] = 115;  // $F3
CHAR_TO_TILE[','] = 116;  // $F4
CHAR_TO_TILE['♀'] = 117;  // $F5

// Digits 0-9: charmap $F6-$FF → tiles 118-127
for (let i = 0; i < 10; i++) {
  CHAR_TO_TILE[String.fromCharCode(48 + i)] = 118 + i;
}

/** Get the font tile index for a character, or -1 for space/unknown. */
export function charToTile(ch: string): number {
  return CHAR_TO_TILE[ch] ?? -1;
}
