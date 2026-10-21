# Text System Architecture

## Font / Charmap

`gfx/font/font.png` is 16 tiles/row × 8 rows. Regular tile index = charmap byte − $80.
`charmap.ts` maps Unicode to these tiles. The contractions `'d 'l 's 't 'v 'r 'm`
are single tiles (59–63, 100–101); `tokenizeText()` matches them before single characters.
PK/MN use private Unicode U+E001/U+E002, tiles 97/98. `font_extra.png` supplies curly
quotes, middle dot and ellipsis (`extraCharToTile()`, tiles 16–21), plus the border.

## Party prompts and medicine results (A5b7c2)

START → POKéMON draws `PartyMenuNormalText` and, after SWITCH, `PartyMenuSwapMonText`.
Field medicine draws `PartyMenuItemUseText`, then the result program (`PotionText`,
`AntidoteText`, `FullHealText`, `ReviveText`, and the other status lines) with no
letter delay. `ItemUseNoEffectText` is typed, with a prompt. `ItemUseNotYoursToUseText`
is OAK'S PARCEL. Battle's "Bring out which POKéMON?" stays A5c.

## Text data and printer (A5a)

`text_flags.ts` holds the shared BIT_NO_TEXT_DELAY stand-in (A5b7e CP2).
ListMenu sets it on entry and clears it on all exits; YesNoMenu clears it before
HandleMenuInput. The shared `PcDisplay` reads it when starting each PrintText;
PcSession sets it on each PlayerPCMenu pass and clears it on ExitPlayerPC.
BillsPc sets it once per visit and clears it on exit. PC PrintText invokes its
font-loaded sprite callback after the border opens and before Delay3/glyphs.
Other callers retain their
explicit `noDelay` options until their migrations; the printer's global defaults
are unchanged. `pokemon_names.ts:monDisplayName` supplies uppercase medicine names
without mutating saved nicknames.

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

`bg_transfer.ts` keeps a shared 0/1/2 VBlank phase across boxes. Thirds are rows
0–5, 6–11 and 12–17. Every third transfer copies the logical buffer to TextBox's
visible buffer, **before** that frame's CPU work. Held-button letters therefore
arrive in groups. Disabling the transfer copies nothing and holds the portion;
the next enable continues the same cycle. The Mart and the message box share
that one tick. `render()` only draws; it does not advance the phase or printer.

`saveScreen` / `restoreScreen` copy the message-box buffer and its border only.
A restore does not restart a program or replay a prompt.

## TextBox wrappers

| Entry | Opening and ending |
|---|---|
| `show()` / `open()` (DisplayTextID) | Border scanout T+4 (render T+3), first glyph CPU write T+20; outer silent fresh A/B wait, hold while A is down, close after `5 + 2W` frames and one trailing UpdateSprites |
| `printStandalone()` (internal PrintText mode) | Three-frame opening; retains the box when the text returns |

`printText: true` adds TalkToTrainer's nested PrintText delay: first glyph T+23.
DisplayTextID's opening does not advance AutoBgMapTransfer during its first 20 frames.
The logical border covers sprites from T, before its scanout, for A6c's UI entry.
A5b4 supplies the exact walking reload cost and trailing UpdateSprites. A5b6's
Town Map sign uses a handler with the cartridge's double close.

`map_dialogue.ts` wraps ordinary NPC, sign, bookshelf and trainer text. Its completion
callback runs when the text terminator returns; talked-to trainers start meet music
then, before the outer dismissal. Sight trainers already started music at spotting.
A `<PROMPT>` has its own beep wait **and** DisplayTextID's outer silent wait.

`show()` always uses DisplayTextID, preserving extracted endings. A5b7g1 removed
legacy mode, the `end` override and the invented press/beep dismissal. Retained
`print()`/`printStandalone()` return when their source terminator returns; their
owner chooses subsequent waits/close. Script sound/button waits continue
`updateDisplay()` once per simulation frame so the final glyph can reach the
screen. Battle text remains on its separate renderer until A5c.

| API | Meaning |
|---|---|
| `show(text, opts?)` | Start DisplayTextID; names are substituted by its printer/runner |
| `printStandalone(source, {bindings, noDelay}?)` | Standalone PrintText program/string: border at T, clear, Delay3, retain on return; noDelay skips letter waits only |
| `update()` | Transfer prior writes, then resume one frame of CPU work |
| `updateDisplay()` | Transfer only, for retained script text |
| `render()` / `dismiss()` | Draw / immediately close |
| `active` | Wrapper has not closed |
| `isTextComplete` | The string's terminator returned; outer wait may still be active |
| `isComplete` | The current retained opening/program/wait returned; the box remains active |
| `isWaitingForInput` | Manual/protected wait or final outer wait |
| `hasMorePages` | More printer tokens remain before the final outer wait |

## Retained display sessions and programs (A5b4)

`TextScreen` owns the buffer, cursor and history of actual Joypad reads;
`TextPrinter` remains the one-string wrapper. `TextProgramRunner.run()` executes
programs with shared cursor state: FAR children return to their parent after
DONE/PROMPT, and DoneText leaves BC where that PlaceString began. RAM strings
require named bindings. An unregistered `asm` returns control to the caller. A
handler registered on that program label runs the next program on the same screen,
without a new `PrintText`. Sound plays once and waits without input reads.
Pause reads once and skips its 30-frame wait on held A/B. Command waits have no
ProtectedDelay3; string controls retain A5a timing. Cry emits a cue only (J2).
`TX_LOW` sets BC to (1, 16) and continues. `<USER>` and `<TARGET>` expand during
PlaceString when the runner has `whoseTurn` and the two nicks (`$5A` as read,
`$59` XOR 1); otherwise they stay glyphs. Numeric operations are implemented in
A5b7a (below). Other unused operations still throw with the program label and
their audit home.
`program_data.ts` loads the committed programs once at startup; no ROM is read.

### Numeric operands (A5b7a)

`TextBindings` keeps stringBuffer/nameBuffer/boxNumString as strings, and
money/coins/hpDifference as numbers. Values are semantic nonnegative safe integers,
not packed bytes or formatted text. Missing/wrong-kind/range-invalid operands
throw with the source label and binding. BCD values must fit their byte count.
A 2–7 digit TX_NUM must fit both its byte count and its displayed digits. A
1-digit TX_NUM uses the same left-aligned walk (`print_num.asm:61`) and fits the
byte width: that walk prints every place, and it does not add the value to `0`.
This is a caller contract, not an emulated RAM interface.

`home/print_bcd.asm`: the extracted `leadingZeroes` field is the raw bit-7 flag,
so true **suppresses** leading zeroes. Suppressed right-aligned cells advance
without overwriting their old tiles. Zero backs up one cell and writes its final
0; an optional ¥ has no separate delay. Each emitted digit calls PrintLetterDelay
unless noDelay is set. `home/print_num.asm`: TX_NUM is left-aligned and writes all
decimal digits immediately, without letter delays or Joypad reads. Both preserve
the shared FAR cursor and existing clipping. `TextScreen.moveCursor` and
`writeGlyph` are the small numeric primitives; no new wrapping or tile-map VM.

Standalone noDelay calls still clear and wait Delay3. Prompts, pauses, manual
button waits and sound waits remain native operations; the flag bypasses only
letter delays. Repeated standalone calls retain the same screen and actual-read
history, including unread releases during protected waits. Default Oak typing
is unchanged. Numeric menu callers are not migrated until the later A5b7 slices.

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
source programs inside retained sessions (A5b5a–b). A5b7g1 retires the remaining
legacy script/TextBox paths; battle text remains separate until A5c. Hidden-event
and bookshelf strings keep DisplayTextID until g2. Retained yesNoChoice owns its
menu reads; migrated DelayFrames and the healing-music wait do not read input.

`TextBoxOptions` and `MapDialogue.show` accept `program` and `autoBox`, so ordinary
Lab wrappers execute source programs with the automatic border disabled.
`text/auto_text_box.ts` holds the map-level `BIT_NO_AUTO_TEXT_BOX` default ({OaksLab, PewterMart},
each cited to its map script). `applyMapAutoTextBox` gives it to the first `displayOpen` of a registered
handler/TX_SCRIPT (overworld and Lab free-move paths), the plain/`printText` NPC fallback sends `autoBox:false`
with the program, the script controller resolves a bare `displayOpen` by the current map, and `StartMenuSession.open`
takes it as `autoBox`. An explicit `autoBox: true` (`displayTextID`'s default, bookshelves) is never overridden.
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

**A5c1 CP2 partial (note 66 §10.11):** the data now has 993 programs, including 360 unused battle/item texts.
Bindings are keyed by opcode and address (`$CF4A`: RAM stringBuffer, decimal expAmountGained). Extraction caches
outgoing rows per label/incoming row and rejects contexts producing different ops for one label. Frozen hashes
preserve all 633 pre-CP2 programs and map pointers. No runtime consumer changes; the new `low` ops remain
unsupported by the runner, and its exact data-op census currently fails pending Claude's check.

## Utilities and files

`initTextSystem()` loads fonts; `reloadBorderTiles()` follows palette changes.
`drawTileBorder()` is shared by menus/battles; `getFontCanvas()` / `getBorderCanvas()`
expose loaded canvases. `setTextSpeed()` / `getTextSpeed()` control the 1/3/5 delay.
`game_text.ts` loads `game_text.json`. `getText()` strips a trailing `<PROMPT>`/`<DONE>`
for the callers A5b4–A5b7 haven't moved to programs yet; `getRawText()` keeps it.

Tests: `text_printer.test.ts` (24), `bg_transfer.test.ts` (4), `textbox.test.ts` (31), `text_runner.test.ts` (21), `text_numbers.test.ts` (49), `map_text_calls.test.ts` (2),
`rom/__tests__/text_decoder.test.ts` (11, three ROM-dependent),
`rom/__tests__/text_programs.test.ts` (10, ROM-dependent; ASM comparisons need `refs/`),
`rom/__tests__/battle_text_data.test.ts` (21, 19 ROM-dependent), and
`rom/__tests__/text_program_context.test.ts` (8, synthetic/no-ROM). Integration tests
remain in `script/text_commands.test.ts` (9) and `overworld/item_pickup.test.ts`.
`text_census.test.ts` adds three no-ROM tripwires for reachable plain calls,
free-move object resolution and approved `getText` consumers (A5b7g1).
