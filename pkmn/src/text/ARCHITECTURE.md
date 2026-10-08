# Text System Architecture

## Font / Charmap

`gfx/font/font.png` is 16 tiles/row × 8 rows. Regular tile index = charmap byte − $80.
`charmap.ts` maps Unicode to these tiles. The contractions `'d 'l 's 't 'v 'r 'm`
are single tiles (59–63, 100–101); `tokenizeText()` matches them before single characters.
PK/MN use private Unicode U+E001/U+E002, tiles 97/98. `font_extra.png` supplies curly
quotes, middle dot and ellipsis (`extraCharToTile()`, tiles 16–21), plus the border.

## Text data and printer (A5a)

`text_printer.ts` ports PlaceString, PrintLetterDelay and ManualTextScroll as a frame
generator. Its 20×6 logical buffer represents wTileMap rows 12–17. Text begins at
screen (1,14); writes outside the four interior rows / 18 columns are clipped. There
is **no automatic word wrapping**. Substitute `<PLAYER>` / `<RIVAL>` before tokenizing.

| String | Cartridge behavior |
|---|---|
| `\n` | First row → second row; on the second row, manual `cont` |
| `\f` | `para`: manual wait, clear four interior rows, wait 20 frames |
| `<LINE>` | Put cursor at the second row even if already there |
| `<NEXT>` | Advance cursor by two rows |
| `<CONT>` | Manual wait then scroll regardless of cursor row |
| `<SCROLL>` | Scroll without a button wait |
| `<PROMPT>` | Final manual wait, then return from text |
| `<DONE>` / end of string | Return immediately after the last letter's delay |

Letters are placed **before** their 1/3/5-frame delay (FAST/MEDIUM/SLOW). Held A/B
shortens each delay to one frame. The printer owns Joypad reads, including the zero
counter read; ProtectedDelay3, scrolling and sound waits do not read input. Fresh
A/B is measured against the last actual read, not the last simulation frame.

Manual wait: place ▼ at (18,16), protect three frames, wait for fresh A/B, wait for
current sound, play `press_ab`, clear ▼. `cont` then copies rows 14–16 to 13–15 twice,
holding five frames after each copy. ▼ defaults to 30 frames on / 30 off (DECISIONS #44).

`bg_transfer.ts` keeps a shared 0/1/2 VBlank phase across boxes. Every third transfer
copies the logical buffer to TextBox's visible buffer, **before** that frame's CPU
work. Held-button letters therefore arrive in groups. `render()` only draws; it
does not advance the phase or printer. Absolute phase remains approximate until
menus and battles participate in their later audits.

## TextBox wrappers

| Mode | Opening and ending |
|---|---|
| `legacy` (default) | One frame before first glyph; strips trailing map endings; retains existing final press/beep close |
| `displayTextID` | Border scanout T+4 (render T+3), first glyph CPU write T+20; outer silent fresh A/B wait, hold while A is down, close after one frame |
| `printText` | Three-frame opening; retains the box when the text returns |

`printText: true` adds TalkToTrainer's nested PrintText delay: first glyph T+23.
DisplayTextID's opening does not advance AutoBgMapTransfer during its first 20 frames.
The logical border covers sprites from T, before its scanout, for A6c's UI entry.
Exact CloseTextDisplay sprite reload costs / trailing UpdateSprites await A5b.

`map_dialogue.ts` wraps ordinary NPC, sign, bookshelf and trainer text. Its completion
callback runs when the text terminator returns; talked-to trainers start meet music
then, before the outer dismissal. Sight trainers already started music at spotting.
A `<PROMPT>` has its own beep wait **and** DisplayTextID's outer silent wait.

Explicit `end: 'none' | 'prompt'` takes precedence over extracted endings and retains
the box when complete. A1b script callers keep their existing endings until A5b;
script sound/button waits continue `updateDisplay()` once per simulation frame so
the final glyph can reach the screen. Battle text remains on its old renderer until A5c.

| API | Meaning |
|---|---|
| `show(text, opts?)` | Substitute names and start the chosen wrapper |
| `update()` | Transfer prior writes, then resume one frame of CPU work |
| `updateDisplay()` | Transfer only, for retained script text |
| `render()` / `dismiss()` | Draw / immediately close |
| `active` | Wrapper has not closed |
| `isTextComplete` | The string's terminator returned; outer wait may still be active |
| `isComplete` | Explicit-ending or standalone PrintText returned and retains the box |
| `isWaitingForInput` | Manual/protected wait or final outer wait |
| `hasMorePages` | More printer tokens remain before the final outer wait |

## Extraction

`rom/extractors/text.ts` provides the shared strict byte decoder: unknown bytes throw
with their address. `decodeMapText()` skips the initial TX_START command and preserves
row-dependent line controls / `<PROMPT>`. Since A5b1, `game_text.json` keeps a
`prompt` text's trailing `<PROMPT>` too (31 keys; otherwise byte-identical to the pre-A5a
baseline). Generated JSON and graphics are never hand-edited.

**Text programs (A5b1, `notes/24-a5b1-text-data.md`).** `rom/extractors/text_programs.ts`
writes `text_programs.json`:
- `programs`: each listed pret label's TextCommandProcessor commands (`TextOp`). Strings
  use the same encoding and end in `<DONE>`/`<PROMPT>` only when the source does. `far`
  names a child program; RAM operands are named bindings.
- `textPointers`: per pret TextPointers table, how `DisplayTextID` runs each text ID —
  `script` (TX_SCRIPT_*), `text` (direct), `printText` (a `text_asm` whose only work
  is one inner PrintText) or `handler`.
The labels and addresses are in `rom/text_program_symbols.ts`. Nothing reads the file at
runtime until A5b4.

## Utilities and files

`initTextSystem()` loads fonts; `reloadBorderTiles()` follows palette changes.
`drawTileBorder()` is shared by menus/battles; `getFontCanvas()` / `getBorderCanvas()`
expose loaded canvases. `setTextSpeed()` / `getTextSpeed()` control the 1/3/5 delay.
`game_text.ts` loads `game_text.json`. `getText()` strips a trailing `<PROMPT>`/`<DONE>`
for the callers A5b4–A5b7 haven't moved to programs yet; `getRawText()` keeps it.

Tests: `text_printer.test.ts` (24), `bg_transfer.test.ts` (3), `textbox.test.ts` (15),
`rom/__tests__/text_decoder.test.ts` (11, three ROM-dependent),
`rom/__tests__/text_programs.test.ts` (7, ROM-dependent; ASM comparisons need `refs/`). Integration tests
remain in `script/text_commands.test.ts` and `overworld/item_pickup.test.ts`.
