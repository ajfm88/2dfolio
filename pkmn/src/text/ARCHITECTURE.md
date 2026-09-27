# Text System Architecture

## Font / Charmap

Font PNG: `gfx/font/font.png` — 16 tiles/row x 8 rows = 128 tiles. Tile index = charmap value - 0x80.

Key mappings: A-Z = tiles 0-25, `() : ; []` = tiles 26-31, a-z = tiles 32-57, e with accent = 58, apostrophe = 96, `<PK>` (U+E001) = 97, `<MN>` (U+E002) = 98, dash = 99, ? = 102, ! = 103, . = 104, cursor = 109, prompt = 110, male = 111, yen = 112, multiply = 113, / = 115, comma = 116, female = 117, digits 0-9 = tiles 118-127.

## Text Formatting

- `\n` = new line (assembly `line` / `cont` — stays in same text box)
- `\f` = paragraph break (assembly `para` / `page` — clears text box, waits for button press)
- Long lines are word-wrapped at 18 characters per line (the interior text width)
- `<PLAYER>` and `<RIVAL>` tokens are substituted with actual names at render time

**In map JSONs**: text must exactly match assembly source from `data/text/text_*.asm`, including exact `\n` and `\f` placement. In TypeScript story scripts, use `getPlayerName()` / `getRivalName()` template literals instead.

## Text Speed

Frames per character: **FAST** = 1, **MEDIUM** = 3 (default), **SLOW** = 5. Holding A or B reduces to 1 frame per character regardless of setting (matching assembly `PrintLetterDelay`).

## TextBox Class API

| Method / Property | Description |
|-------------------|-------------|
| `show(text)` | Start displaying text. Processes `\n`/`\f`, substitutes names, enables the box |
| `update()` | Advance character reveal by one tick. Handles input for page advance/dismiss |
| `render()` | Draw the box border, revealed text, and blinking prompt arrow |
| `dismiss()` | Close the text box immediately |
| `active` | `true` while the text box is visible |
| `isWaitingForInput` | `true` when all current text is revealed and awaiting A/B press |
| `hasMorePages` | `true` if there are more lines after the current 2-line view |

## Exported Utilities

| Export | Description |
|--------|-------------|
| `initTextSystem()` | Load font and border tile PNGs (call once at startup) |
| `reloadBorderTiles()` | Reload border tileset for the current palette (call after palette changes) |
| `drawTileBorder(x, y, w, h)` | Draw a tile-based border box at any position (reusable for menus, battle text) |
| `getFontCanvas()` | Get the loaded font tileset canvas |
| `getBorderCanvas()` | Get the loaded border tileset canvas |
| `charToTile(ch)` | Convert a character to its font tile index (-1 for space/unknown) |
| `setTextSpeed(speed)` | Set text speed: `'fast'`, `'medium'`, or `'slow'` |
| `getTextSpeed()` | Get current text speed setting name |

## Key Files

| File | LOC | Purpose |
|------|-----|---------|
| `textbox.ts` | 305 | TextBox class, border drawing, text rendering and animation |
| `charmap.ts` | 52 | Unicode character to font tile index mapping |
