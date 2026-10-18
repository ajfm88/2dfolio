// Logical glyph identifiers, independent of Canvas asset loading.
export const LEVEL_GLYPH = '\uE003';    // <LV>, VRAM $6e
export const POKEBALL_GLYPH = '\uE004'; // VRAM $78 in Bill's PC
export const TIME_COLON_GLYPH = '\uE005'; // <COLON>, VRAM $6d (font_extra tile 13)
export const DOT_GLYPH = '\uE006'; // <DOT>, font $f2, distinct from period $e8
export const HP_GLYPH = '\uE007';
export const HP_LEFT_GLYPH = '\uE008';
export const HP_END_GLYPH = '\uE009'; // StatusScreen $6d, not party $6c
export const HALF_ARROW_GLYPH = '\uE00A';
export const TO_GLYPH = '\uE00B';
export const BOLD_P_GLYPH = '\uE00C';
export const ID_GLYPH = '\uE00D';
export const NUMBER_GLYPH = '\uE00E';
export const LINE_H_GLYPH = '\uE00F';
export const LINE_CORNER_GLYPH = '\uE010';
export const LINE_V_GLYPH = '\uE011';
export const HP_FILL_GLYPHS = Array.from({ length: 9 }, (_, i) => String.fromCharCode(0xE020 + i));
