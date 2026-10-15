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
| `displayTextID` | Border scanout T+4 (render T+3), first glyph CPU write T+20; outer silent fresh A/B wait, hold while A is down, close after `5 + 2W` frames and one trailing UpdateSprites |
| `printText` | Three-frame opening; retains the box when the text returns |

`printText: true` adds TalkToTrainer's nested PrintText delay: first glyph T+23.
DisplayTextID's opening does not advance AutoBgMapTransfer during its first 20 frames.
The logical border covers sprites from T, before its scanout, for A6c's UI entry.
A5b4 supplies the exact walking reload cost and trailing UpdateSprites. A5b6's
Town Map sign uses a handler with the cartridge's double close.

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
| `printStandalone(source, {bindings}?)` | Standalone PrintText program/string: border at T, clear, Delay3, retain on return |
| `update()` | Transfer prior writes, then resume one frame of CPU work |
| `updateDisplay()` | Transfer only, for retained script text |
| `render()` / `dismiss()` | Draw / immediately close |
| `active` | Wrapper has not closed |
| `isTextComplete` | The string's terminator returned; outer wait may still be active |
| `isComplete` | Explicit-ending or standalone PrintText returned and retains the box |
| `isWaitingForInput` | Manual/protected wait or final outer wait |
| `hasMorePages` | More printer tokens remain before the final outer wait |

## Retained display sessions and programs (A5b4)

`TextScreen` owns the buffer, cursor and history of actual Joypad reads;
`TextPrinter` remains the one-string wrapper. `TextProgramRunner.run()` executes
programs with shared cursor state: FAR children return to their parent after
DONE/PROMPT, RAM strings require named bindings, and ASM returns control to the
caller with the display retained. Sound plays once and waits without input reads.
Pause reads once and skips its 30-frame wait on held A/B. Command waits have no
ProtectedDelay3; string controls retain A5a timing. Cry emits a cue only (J2).
Numeric and unused operations throw with the program label and their A5b7 home.
`program_data.ts` loads the committed programs once at startup; no ROM is read.

`TextBox.open()` primes DisplayTextIDInit's 20-frame opening. `print(source,
{box})` accepts a string or program: `new` clears the interior and waits three
frames; `keep` resets the cursor without clearing or delay. The optional
font-loaded PrintText sprite-update hook remains unwired until J2.
`waitSilent()` owns the retained screen's fresh A/B wait. `finish({outerWait})`
optionally waits, Holds while A is down, then starts `CloseSequence` using its
host's current map cost. Phases are opening, printing, waiting, holding, closing,
closed. Program completion includes embedded sound waits; it may return `asm`.

Closing consumes exactly `1 + 2W + 4` frames with no input reads. The first frame
still transfers BG; the rest do not. After that first frame the border is hidden,
but the logical rectangle keeps covering sprites until the final host callback
runs UpdateSprites once and deactivates the display in the same tick. START exit
uses this counter in `menu_closing`; the next overworld pass comes two ticks later.

Joypad ownership: whoever calls the cartridge's Joypad reads; nobody else does.
Printer/wait/Hold reads use the shared screen history. Sound waits and reload
copies do not synchronize input. Main excludes active text and `menu_closing`
from its idle synchronization; scripts tick retained BG once per frame.
Mom/TV, Daisy, Route 1, Mart, Viridian's small handlers, Pallet and the Lab use
source programs inside retained sessions (A5b5a–b). The remaining story/menu callers retain legacy
commands until A5b7, and battle text until A5c. Retained yesNoChoice owns its
menu reads; migrated DelayFrames and the healing-music wait do not read input.

`TextBoxOptions` and `MapDialogue.show` accept `program` and `autoBox`, so ordinary
Lab wrappers execute source programs with the automatic border disabled.
`displayRevision` increments at each DisplayTextID reset. Main checks it alongside
the UI's rising edge: a close and new opening in the same CPU tick still run the
new DisplayTextIDInit sprite update once. Grouped PrintTexts keep one revision.

The nurse uses one session (A5b5c). `hideDisplay()` models LoadCurrentMapView:
no border, text or covered tiles, while the session/screen remains active.
The next new PrintText restores the box and its three-frame clear delay.
`uiTileAt()` supplies the current logical rectangle to explicit sprite updates,
so an update after a menu return sees the restored text box, and an update after
a hide sees the map. `restoreFacingAtClose()` runs after outer wait/Hold at
close start; the cached sprite image is unchanged until the trailing update.
Machine waits in a migrated display read no input. The menu owns its Delay3
and 15-frame tail; the nurse's first glyph is +23 and its close costs 17.

A5b6 adds `clearInterior()` (LoadScreenTilesFromBuffer1's empty box),
`print(..., {noDelay: true})` for the blackboard question, and standalone
PrintText for Oak's speech. Repeated standalone calls reuse the screen and
actual-read history; `updateDisplay()` keeps retained boxes transferring through
animations. Main excludes `oak_speech` from idle Joypad synchronization.
N-1: `text_waitbutton` never clears tile (18,16); arrow waits still do.

`closeInPlace()` models TownMapText's own CloseTextDisplay without ending its
session: font-loaded close 9/11/13 frames by house, then no border/window/BG
transfer. The outer `finish({outerWait: false, reload: 'full'})` Holds and closes
again at 14/17/22, including all sprite pictures (outdoor full close 5).
Both closes restore facings and run a trailing sprite update. The white-out plus
font copy before the existing Town Map takes 3 + 17; its internal timings and
BG phase remain approximate until the shared Town Map audit.

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
The labels and addresses are in `rom/text_program_symbols.ts`. `program_data.ts` loads it at runtime; A5b4 pickups execute named programs.

## Utilities and files

`initTextSystem()` loads fonts; `reloadBorderTiles()` follows palette changes.
`drawTileBorder()` is shared by menus/battles; `getFontCanvas()` / `getBorderCanvas()`
expose loaded canvases. `setTextSpeed()` / `getTextSpeed()` control the 1/3/5 delay.
`game_text.ts` loads `game_text.json`. `getText()` strips a trailing `<PROMPT>`/`<DONE>`
for the callers A5b4–A5b7 haven't moved to programs yet; `getRawText()` keeps it.

Tests: `text_printer.test.ts` (24), `bg_transfer.test.ts` (3), `textbox.test.ts` (30), `text_runner.test.ts` (23), `map_text_calls.test.ts` (2),
`rom/__tests__/text_decoder.test.ts` (11, three ROM-dependent),
`rom/__tests__/text_programs.test.ts` (7, ROM-dependent; ASM comparisons need `refs/`). Integration tests
remain in `script/text_commands.test.ts` and `overworld/item_pickup.test.ts`.
