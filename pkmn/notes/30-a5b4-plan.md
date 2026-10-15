# A5b4 — the text command runner, the display session and the exact close

**2026-10-11 · planned by Claude (Sonnet 5.5) · implementer: Sol (GPT-6.1), reviewer: Claude.**
Planning only. The only files this session added or changed are Markdown.

**Approved 2026-10-11.** The user answered *"go"* to §10: all seven recommendations are settled as O-19 /
DECISIONS #48. §10 is kept for the reasoning.

A5b4 is the fourth of the approved A5b increments (`23-a5b-plan.md` §6, DECISIONS #45):
*"Text command runner, retained display-session contract, exact close, explicit sprite updates and
input/transfer ownership; wire MapDialogue and existing pickup primitive adapters. Typecheck, full tests,
browser talk/pickup regression."* A5b1 (text programs), A5b2 (sprite sets) and A5b3 (key-item/PC sounds) are
done; this is the first increment that changes what the game does.

Read before coding: root `CLAUDE.md`, `context/STATUS.md`, `context/CONVENTIONS.md`,
`game/src/text/ARCHITECTURE.md`, `game/src/overworld/ARCHITECTURE.md`, `23-a5b-plan.md` §3–§5 and §7,
`21-a5-plan.md` §3 (the A5a contract this builds on), `22-a5a-review.md`, `26-a5b2-plan.md` §5,
DECISIONS #41, #44, #45, #46 and this note. Start from **`2d5118c`** (clean tree). Baseline, as recorded by
the A5b3 review and re-run by me then: **1015/1015** with `ROM_PATH`, **898 pass / 117 skip** without;
typecheck and build clean. This planning session did not re-run them.

## TL;DR

- **Four checkpoints, one slice, one review at the end** (§6): CP1 data, CP2 the pure runner, CP3 the
  session and the exact close, CP4 the pickups and the NPC/sign call kinds. Each is a local commit; Sol may
  stop after any of them. Extractor edits and engine wiring never share a checkpoint.
- **What changes in the game** (and only this): a closed text box, and the START menu, now freeze the world
  for the cartridge's `5 + 2W` frames (23 outdoors, 7–17 indoors; §3.3) and end with one real
  `UpdateSprites`; item-ball and hidden-item pickups open and print as `DisplayTextID` / `PrintText` do
  (20 + 3 frames before the first letter; the ball disappears at frame 20, not with the box); NPC and sign
  texts that the cartridge prints through a `PrintText` wrapper get its 3 extra frames. Everything else —
  words, pacing of movement, music, saves — stays as it is.
- **Two things the earlier plans did not have**, found by reading the ASM and the code (§3): (a) an item
  ball hides **20 frames after** its box opens, because `PickUpItem` runs *inside* `DisplayTextID` after
  `DisplayTextIDInit` (A1b hid it with the box); (b) a map JSON NPC or sign carries **no text ID**, so
  nothing says whether its text is a direct `text_far` or a `PrintText` wrapper. A5b4 adds the ID to the
  generated data instead of a hand-keyed table.
- **The runner is small.** Across the committed `text_programs.json`, only 12 op kinds occur
  (`text far ram bcd decimal pause sound cry waitButton promptButton asm`), and the programs reachable from
  today's plain NPC/sign calls use just `far`, `text` and `sound`. A5b4 implements ten of them; `bcd` and
  `decimal` (shop and item-menu prices) wait for A5b7, where their first consumer is, and fail loudly until
  then (decision 3).
- **Scope guard.** Pallet, the Lab, Mom, Daisy, Route 1's sample, Viridian's old men, the nurse, the school,
  Oak's speech, the shop, the item menus, the PCs and the save keep the script commands they have today.
  They move in A5b5–A5b7, onto the pieces built here.

## 1. Deliverable and boundary

After A5b4:

1. **Data (CP1).** Map JSON `npcs` and `signs` carry `textId`; `map_sprite_sets.json` carries each current
   map's cartridge object pictures. Both additive, extractor-generated, nothing hand-edited.
2. **Runner (CP2).** A pure generator runs a `TextOp[]` program from `text_programs.json` on the shared
   printer state, with named bindings and the cartridge's return semantics. Not wired.
3. **Display session and close (CP3).** `TextBox` can open a `DisplayTextID` session, print one or more
   programs or strings into it, end it with the cartridge's three ending routines, and close with the
   exact `CloseTextDisplay` cost and trailing `UpdateSprites`. `MapDialogue` (NPC, sign, bookshelf, trainer
   texts) and START's exit use it. The runtime sprite-set code that gives `W` lives in
   `src/overworld/sprite_sets.ts`.
4. **Pickups and call kinds (CP4).** Item balls and hidden items are written as `displayOpen` /
   `printText` / `displayClose` script commands over the runner; plain NPC and sign texts get their
   `text` / `printText` kind from the new text IDs.

**Not in A5b4** (homes in §9): any story handler, menu text, Oak's speech, the shop and item prices,
the Town Map sign's ending, Pikachu's cry, `PrintText`'s own font-loaded `UpdateSprites`, battle text,
sounds beyond the four A5b3 added, and any change to movement, music, saves or the printer's timing rules
(A5a).

Hard rules hold: no ROM at runtime (the new data is committed JSON); `refs/**` and `pkmn-sprites/` are
read-only; generated files only from `npm run setup`; Gen 1 quirks are kept; local commits only, never
pushed. Do not edit the audio engines or the synthesizer.

## 2. Where the code is today (read, not assumed)

| Piece | Today | What A5b4 does with it |
|---|---|---|
| `text/text_printer.ts` (129 lines) | `TextPrinter(text, ports)`: one string, tokenised once; cursor `row/column` private; `*print` handles `\n`, `\f`, `<CONT>`, `<SCROLL>`, `<PROMPT>`, `<DONE>`, `<LINE>`, `<NEXT>`; `waitButton`, `holdA` | Split into a shared screen (buffer, cursor, joypad history, delay/scroll/manual primitives) and a `placeString` generator. `TextPrinter(text)` stays as the one-string wrapper; all 24 printer tests stay green unchanged |
| `text/textbox.ts` | `TextBox.show(text, {mode, end, printText})`; modes `legacy`, `displayTextID`, `printText`; `displayTextID` = 20 frames, print, silent wait, `holdA`, **one** frame, inactive | Becomes a session (open / print / finish) with `show()` kept as the composition. The one-frame close becomes the `5 + 2W` close |
| `text/map_dialogue.ts` (21 lines) | `show(text, {trainer, onTextComplete})`, `update(): boolean` | Gains the close host and the call kind |
| `script/script_controller.ts` | commands `text`, `sound`, `textButtonWait`, `closeText`; `closeText` = wait A up, dismiss, same frame | `closeText` and the new `displayClose` share the session's close. New commands `displayOpen`, `printText`. Sound waits stop syncing the joypad |
| `overworld/item_pickup.ts` | three builders with `text {end:'none'}` + `sound` + `closeText` | Ball and hidden-item builders move to the new commands (CP4). Route 1's sample is untouched (A5b5) |
| `overworld/ui_entry.ts` | one `DisplayTextIDInit` `UpdateSprites` per UI opening; `setOpeningSpriteUpdates` | Unchanged. The session reports openings through it as now |
| `rom/extractors/map_sprite_sets.ts` + its test | tables, pictures, name bridge; reference `selectOutdoor` / `allocateSlots` / `closeFrames` live **in the test file** | The reference code is promoted to `src/overworld/sprite_sets.ts`; the A5b2 test then imports it and keeps its ASM fixtures |
| `main.ts` | `state === 'textbox'` calls `mapDialogue.update()`; START `exit` → overworld at once; `syncJoypadRead()` every non-pass frame unless `textBox.active` | Textbox state waits for the close; START exit gets the shared close; the "no joypad sync" condition covers the close frames |

## 3. Cartridge contracts (read this session; quote them in the code)

### 3.1 `DisplayTextID` and `PrintText` (`home/text_script.asm`, `home/window.asm`)

- `DisplayTextID`: `DisplayTextIDInit` (border unless `BIT_NO_AUTO_TEXT_BOX`; font-loaded flag; an
  `UpdateSprites` unless `BIT_NO_SPRITE_UPDATES`; facings saved; sprites forced to stand; window on) → the
  text pointer's first byte picks a `TX_SCRIPT_*` routine, else `PrintText_NoCreatingTextBox` runs the
  program → `wDoNotWaitForButtonPressAfterDisplayingText` ≠ 0 skips straight to `HoldTextDisplayOpen`;
  else `AfterDisplayingTextID` = `WaitForTextScrollButtonPress` (silent, no `Delay3`, no beep) → **Hold**
  (Joypad every frame until A is up; B does not hold) → **Close**.
- `PrintText` = `DisplayTextBoxID MESSAGE_BOX` (redraws the border, **clearing** the four interior rows) +
  `UpdateSprites` + `Delay3`, then the program at (1, 14). `PrintText_NoCreatingTextBox` skips the redraw
  and the three frames, sets the cursor to (1, 14), and **does not clear**. A5a already models `Delay3`
  (`mode: 'printText'`, `printText: true`).
- A program's `text_asm` hands control to code; code ends with `jp TextScriptEnd`, which returns into the
  command processor at a `text_end`. So after a handler, the caller sees an ordinary return.

### 3.2 `TextCommandProcessor` (`home/text.asm`)

- One processor level per program. `text_far` runs the child as a new level and **continues the parent**
  after it. `<DONE>` and `<PROMPT>` inside a string return from the **current level only** (`DoneText`
  points `de` at a `text_end`); `@` just ends the string. The cursor (`bc`) is shared by all levels: a
  child's `text` continues where the parent stopped.
- Op behaviours the data uses, from the source: `text_pause` — one Joypad read; if A or B is held skip,
  else `DelayFrames 30`. `text_promptbutton` — ▼ at (18, 16), `ManualTextScroll`, ▼ cleared; **no
  `ProtectedDelay3`**. `text_waitbutton` — `ManualTextScroll`, no ▼. `ManualTextScroll` = blink/wait for a
  fresh A/B (`JoypadLowSensitivity`), then `WaitForSoundToFinish`, then `SFX_PRESS_AB`. `sound_*` —
  `PlaySound`, then `WaitForSoundToFinish` (no Joypad read). `cry` — `PlayCry`, which waits for the cry
  (home/pokemon.asm). `start_asm` — returns to code.
- Static strings the string path already handles (`\n`, `\f`, `<CONT>` …) keep A5a's rules.

### 3.3 `CloseTextDisplay` and what it costs (`home/text_script.asm:104`)

In order: `hWY = $90` (window off) → `DelayFrame` **(1 frame)** → palette, auto BG transfer off → sprite facings
restored → `InitMapSprites` **while the font flag is still set** → font flag cleared →
`LoadPlayerSpriteGraphics` → `LoadCurrentMapView` → `jp UpdateSprites`.

- `CopyVideoData` takes `floor(tiles / 8) + 1` frames (checked: a 12-tile half is 8 + 4 → two `DelayFrame`s;
  `CopyVideoDataAlternate` falls through to it whenever the LCD is on, which it is here). With the font
  loaded `LoadStillTilePattern` returns early, so `InitMapSprites` costs **2 frames per loaded regular
  (walking) slot**; the 4-tile pictures cost nothing. `LoadPlayerSpriteGraphics` (walking) = two 12-tile
  copies = **4 frames**.
- Total **`5 + 2W`** frames from the tick of Hold's last read, `W` = walking pictures loaded (slots 0–8 of
  the sprite set, Pikachu's reserved slot included). The window is hidden after the first frame; the world is
  frozen throughout; the final `UpdateSprites` runs with the font flag clear (NPCs move normally there, and
  the sprites it had hidden under the box come back). A5b2's fixtures: 9 → 23 frames outdoors on Pallet,
  Viridian, Route 1, Route 22, both Route 2 halves; Oak's Lab 5 → 15; Viridian Mart, School, Nickname House
  4 → 13; Pokécenter 6 → 17; Forest, both Forest gates, Route 2 Gate, Trade House 3 → 11; Red's 1F,
  Blue's House, Diglett's Cave entrance 2 → 9; Red's 2F 1 → 7. **Re-verify `CopyVideoData`,
  `InitMapSprites` and `LoadPlayerSpriteGraphics` yourself in CP3 before relying on these numbers.**
- BG transfer: auto-transfer is on for the first (`DelayFrame`) frame and off for the rest. Tick the shared
  phase (`textBgTransfer`) for that one frame only.
- **START's exit goes through the same routine** (`home/start_menu.asm:79` `CloseStartMenu` → one Joypad
  read for A → `LoadTextBoxTilePatterns` → `CloseTextDisplay`). Other START sub-menu exits
  (`start_sub_menus.asm:162/294/424`) are not built or J2.

### 3.4 The two pickups, in cartridge order (`engine/events/pick_up_item.asm`, `hidden_items.asm`)

| | Item ball (`PickUpItemText` → `predef PickUpItem`) | Hidden item (`tx_pre_jump FoundHiddenItemText`) |
|---|---|---|
| Entry | `DisplayTextID` → **`DisplayTextIDInit` (20 frames)** → handler | same |
| Handler | `GiveItem`; on success `HideObject` (= flag + **`UpdateSprites` with the font loaded**), `wDoNotWait… = 1`, `PrintText FoundItemText` (**+3**, program: text, `sound_get_item_1`, end) | `PrintText_NoCreatingTextBox FoundHiddenItemText` (**direct, +0**: text, then `asm`), `GiveItem`; success: flag, `PlaySoundWaitForCurrent get_item2`, `WaitForSoundToFinish`, `TextScriptEnd` |
| Failure | `PrintText NoMoreRoomForItemText` (+3) | `WaitForTextScrollButtonPress`, `wDoNotWait… = 0`, `PrintText HiddenItemBagFullText` (+3) |
| Ending | success: no outer wait → Hold → Close. Failure: silent outer wait → Hold → Close | success: no outer wait → Hold → Close. Failure: silent outer wait → Hold → Close |

So today's A1b order ("the ball hides in the frame the box opens", "text before give") needs two
corrections: the ball is given and hidden **after the 20-frame opening**, and every `PrintText` adds 3
frames. `HideObject`'s font-loaded `UpdateSprites` does not move NPCs (`NotYetMoving` while the font is
loaded), so the existing `hideObject` command — flag, hide, refresh the collision mask, no NPC tick —
remains the right model. The A1b bag rules, flag-first/text-first ordering and silent waits are unchanged.

### 3.5 What the data cannot say today

`map JSON` NPCs and signs have `id`/`dialogue` and no `textId`. The extractor reads `romNpc.textId` and
`RomSign.textId` (`rom/extractors/maps.ts`) and drops them. Without the ID nothing can tell
`ViridianCity_TextPointers` entry 9 (`printText`, a sign) from entry 12 (`text`, `MartSignText`). The call
table (`textPointers`) has all four kinds for the current maps, for example: Pallet 7 `text` and 1
`handler`; Route 1 2 `printText` and 1 `handler`; Viridian City 3 `text`, 6 `printText` and 7 `handler`.
Across all 21 tables: 45 `text`, 35 `printText`, 37 `handler`, 3 `script`.

## 4. Design

### 4.1 Data (CP1, extractor only)

- `NpcData` and `MapSign` get an optional `textId?: number` (the 1-based `TextPointers` index, as the
  extractor reads it). Emitted for every ROM-backed NPC and sign on the 19 maps, never for scripted-only
  NPCs.
- `MapSpriteSetsFile` gets `mapObjects: Record<string, number[]>`: for each current map, the picture id of
  every object event **in cartridge order, before `NPC_INDEX_FILTER`** (hidden, dropped and duplicate
  objects included — the cartridge's `LoadSpriteSetFromMapHeader` scans them all, up to 14). Picture ids,
  not names, so aliases with no canonical engine name still count.
- A small `mapTextTable(mapName)` helper (runtime, CP4) maps an engine map name to its `<Map>_TextPointers`
  label; a test requires all 19 maps to resolve.
- Hygiene while in the file: **A5b2 N-1** — the source fixture compares only emitted sets 1 and 10; make it
  compare all emitted sets and mutation-check set 3.

### 4.2 The runner (CP2, pure)

- **State split.** `text_printer.ts` exposes a screen that owns the 20×6 buffer, the cursor, the joypad
  history, `delay`, `scroll`, `manual` and `waitButton`; `TextPrinter` and the runner both drive it. No
  behaviour change for string text.
- **`TextProgramRunner`** (`text/text_runner.ts`) is a generator over `TextOp[]` plus a table of programs.
  It keeps a level stack for `far`, so a child's `<DONE>`/`<PROMPT>` ends only that level, and the cursor
  continues across ops and levels. It reports, per run, how it ended: `returned` (text_end) or `asm` (the
  program stopped at a handler; the caller's code goes next, the display stays up).
- **Ops (CP2):** `text`, `far`, `ram` (needs `stringBuffer`/`nameBuffer`/`boxNumString`), `sound`,
  `waitButton`, `promptButton`, `pause`, `cry` (emits a cue through a port, consumes **no** frames and plays
  nothing — Pikachu's cry is J2, DECISIONS #45.4; a test pins this), `asm`. `bcd`, `decimal`, `move`, `box`,
  `low`, `scroll`, `dots` throw `unsupported text op <name> (A5b7)` at run time with the program label
  (`move/box/low/scroll/dots` occur in no committed program; a test lists the op kinds present in
  `text_programs.json` against the supported set, so a new extraction cannot slip one in silently).
- **Bindings.** A plain object `{ stringBuffer?, nameBuffer?, boxNumString? }`; a missing binding throws.
  `<PLAYER>`/`<RIVAL>` still go through `substituteNames`.
- **Ports.** The runner takes the printer's ports plus `playSound(name)` and `cry(species)`. The sound op
  plays then waits on `soundFinished()` **without reading the joypad** (A5b plan §3.2).
- **No-delay flag.** An option makes letters appear without `PrintLetterDelay` (the cartridge's
  `BIT_NO_TEXT_DELAY`, for menu labels in A5b6/7). Implemented and tested now, used later.

### 4.3 The display session (CP3)

`TextBox` becomes the session; its public `show()` keeps its signature and is implemented as
`open → print → finish`, so A5a's callers and tests are unchanged. New surface (names are a proposal, the
responsibilities are not):

| Call | Cartridge routine | Frames and effects |
|---|---|---|
| `open({ autoBox = true, spriteUpdate = true })` | `DisplayTextID` + `DisplayTextIDInit` | border (unless `autoBox` false), 20 frames before the first write, `UiEntry`'s one `UpdateSprites` (as today), BG phase gating as A5a |
| `print(source, { box: 'new' \| 'keep', bindings? })` | `PrintText` / `PrintText_NoCreatingTextBox` | `new`: clear the four rows, +3 frames (`Delay3`), cursor (1, 14); `keep`: cursor (1, 14), no clearing, no delay. `source` is a program label or a string. Returns when the program returns or stops at `asm` |
| `waitSilent()` | `WaitForTextScrollButtonPress` | fresh A/B, no arrow, no beep, no 3-frame protection |
| `finish({ outerWait })` | `AfterDisplayingTextID` / `HoldTextDisplayOpen` / `CloseTextDisplay` | `outerWait` → `waitSilent`, then Hold, then the close of §3.3 |

- **Phases are explicit:** opening, printing, waiting, holding, **closing**, closed. `isTextComplete`,
  `isComplete`, `isWaitingForInput`, `hasMorePages`, `active` keep their meaning; `closing` is new and
  `active` stays true until the trailing `UpdateSprites` has run.
- **During the closing frames the box is not drawn but still `uiTiles.cover()`s its rectangle**, so sprites
  hidden under it stay hidden until the trailing update (the cartridge latches their image to `$ff` until
  then; A6b/A1c). The facing restore needs nothing: the engine already keeps the post-talk facing.
- **The trailing `UpdateSprites`** is a callback from the session's host (`updateSprites(npcs, gameMap,
  player, pikachuFollower)`, the same one a pass uses). One call, after the last close frame, then `active`
  becomes false in that tick (so the next overworld pass comes two frames later, as A5 already assumes).
- **Close cost** comes from the host: `closeFrames(): number` = `5 + 2W` from `sprite_sets.ts` for the
  current map and the player's step position. The session never reads map data.
- **The shared close** is a tiny pure counter (`text/close_sequence.ts`) used by the session, by START's
  exit and by `closeText`/`displayClose`. START's exit runs it in a new `menu_closing` state with no joypad
  sync, then the trailing update, then `overworld`.

### 4.4 Sprite sets at runtime (`overworld/sprite_sets.ts`, CP3)

Promote the A5b2 test references: `selectOutdoor(file, mapId, x, y)`, `allocateSlots(...)` and the `W`
count (non-zero slots 0–8), plus `closeFrames(mapName, step)`. Load `map_sprite_sets.json` once at startup
(like `text_programs.json`). Outdoors: the selected set always has nine walking slots. Indoors: the
allocation over `mapObjects[mapName]`, Pikachu reserved in slot 0, walking pictures in slots 0–8, still
ones in 9–10, overflow dropped. The A5b2 test keeps its independent ASM parsing and its 19 W fixtures and now
calls the runtime code. `LoadPlayerSpriteGraphics` is the walking case; biking and surfing do not exist yet
(assert and comment).

### 4.5 Wiring (CP3 and CP4)

- **`MapDialogue`** (CP3): `show(text, { trainer, kind, onTextComplete })`, ending with the session's
  close. The trainer paths (`engageTrainer`, both) therefore start the battle **after the close**, as
  `TalkToTrainer` → `TextScriptEnd` → `CloseTextDisplay` → `.newBattle` does. `kind: 'printText'` replaces
  today's `trainer` flag as the +3-frame switch (trainers keep it).
- **Call kinds** (CP4): the controller attaches `{ call: 'text' | 'printText' }` to `textbox` actions for
  NPCs and signs from `mapTextTable` + `textId`; `handler` and `script` entries keep today's behaviour
  (direct, string path) until A5b5 migrates them. Bookshelves and hidden-event texts stay direct strings.
  The Town Map sign (`A TOWN MAP.`, `pendingTownMap`) keeps its present ending and gets **no** new close
  (its cartridge flow is A5b6's); a test pins that so it is a decision, not an accident.
- **Script commands** (CP3 `closeText`, CP4 the rest): `displayOpen {autoBox?}`, `printText {program,
  bindings?, box?}`, `displayClose {outerWait}`; `closeText` stays and means `displayClose {outerWait:
  false}` when a session is open. `textButtonWait` and `sound` stay. The old `text` command stays for the
  callers not yet migrated.
- **Pickups** (CP4): rewrite `itemBallScript` and `hiddenItemScript` as in §3.4 using the programs
  `FoundItemText` (far `_FoundItemText` with `ram stringBuffer`, then `sound get_item1`),
  `NoMoreRoomForItemText`, `FoundHiddenItemText` (far `_FoundHiddenItemText` with `ram nameBuffer`, then
  `asm`) and `HiddenItemBagFullText` from `text_programs.json`, the item name bound to the buffer each one
  names. The data already has the program boundaries; do not re-spell the strings in TypeScript. Giving, flags, hiding, the 99-per-slot rule and the full-bag branches are exactly A1b's.
- **Joypad ownership.** `scriptSound` stops calling `syncJoypadRead()` (the ASM's `WaitForSoundToFinish`
  does not read Joypad); `textButtonWait`, Hold and the printer's own waits keep reading it. `main.ts`'s
  "sync every non-pass frame unless a box is up" condition also excludes the START `menu_closing` state.
  Document the rule in `text/ARCHITECTURE.md`: *whoever calls the cartridge's `Joypad` reads; nobody else does.*

### 4.6 Transitional departures to keep visible (each pinned by a test or a comment)

| Departure | Until |
|---|---|
| Town Map sign ends as before (outer wait + Hold, no close) | A5b6 |
| Plain NPC `handler` entries keep their string and the direct opening | A5b5 / V5 map-object audit |
| `PrintText`'s own font-loaded `UpdateSprites` is not run (the session exposes the event as a no-op hook) | J2 (decision 4) |
| `.displayDialogue`'s `UpdateSprites` at the A press is not run | J2 (A6c) |
| Route 1's sample, Daisy, Mom, nurse, Lab, Pallet, Viridian scripts, notebook, blackboard, Oak's speech keep the legacy `text` command and its endings | A5b5–A5b7 |
| Other START sub-menu exits | J2 |

## 5. Expected behaviour (derive yourself; these are the plan's numbers, not an oracle)

Frames are ticks from the tick the interaction is handled (`T`). If your derivation from the ASM disagrees,
believe the ASM, stop, and tell the user.

| Flow | Expected |
|---|---|
| Direct NPC/sign text (`call: 'text'`) | first letter written at `T + 20` (A5a, unchanged) |
| `PrintText`-wrapper NPC/sign (`call: 'printText'`) | first letter at `T + 23` |
| Item ball, success | box at `T`, bag change + `hideObject` at `T + 20`, first letter at `T + 23`, `get_item1` after the last letter's delay, wait for it (73 updates), Hold, then `5 + 2W` close frames (11 on the Forest map), then the script ends |
| Item ball, bag full | `T + 23` first letter, silent A/B wait, Hold, close; ball stays, nothing saved |
| Hidden item, success | first letter at `T + 20` (direct), give + flag, `get_item2` after waiting for current sound (181 updates), Hold, close |
| Hidden item, bag full | text, silent wait, new box (`+3`), text, silent wait, Hold, close |
| Close, any map | `5 + 2W` frames from Hold's last read to the trailing `UpdateSprites`; world frozen; sprites hidden under the box stay hidden until then |
| START exit | Hold-style read of A once, then the same close, no joypad sync during it |

Today's two A1b bounds ("closes exactly 73 / 181 updates after the text completes") become `73 + (5 + 2W)`
and `181 + (5 + 2W)` for the test scene's map. Confirm the Hold tick accounting before pinning them.

## 6. Checkpoints and verification

Same gates as always: `npm run typecheck`; `ROM_PATH=pokeyellow.gbc npm test` (PowerShell:
`$env:ROM_PATH='pokeyellow.gbc'; npm test`); the no-ROM run; `npm run build`; `git diff --check`; `git status`
(no ROM, no stray files). Stage specific paths; never commit edits you did not make (an editor's Markdown
formatter has reformatted `STATUS.md` once; if `context/*.md` shows changes you did not make, ask the user).

**CP1 — data.** §4.1. Setup **twice** byte-identical. Expected diff: **40 modified, 0 new** — the 19 map
JSON files and `map_sprite_sets.json` in `data/` and `static/` — and every changed line is an added
`textId` or the added `mapObjects` block. Hash all 869 generated files before and after; the other 829 are
unchanged. Tests: every NPC/sign `textId` equals the id in `data/maps/objects/*.asm` (parse the source);
`mapObjects` equals the source object pictures per map and reproduces the 19 W fixtures; the N-1 hygiene.

**CP2 — runner.** §4.2. No wiring, no `main.ts` change. Tests are op-by-op frame traces against the source
(see §7). The 24 printer tests, 3 BG-transfer tests and 15 TextBox tests pass **unchanged**.

**CP3 — session and close.** §4.3–§4.4 and the `MapDialogue` / START / `closeText` wiring, with the transitional
rows of §4.6. Existing tests change only where the cartridge cost is deliberately added (§8). Browser check
(below). This is the risky checkpoint: **stop and report if any ASM fact contradicts §3.3**.

**CP4 — pickups and call kinds.** §4.5. Browser check again, then the docs and STATUS.

**Browser smoke (required at CP3 and CP4; no ears).** `npx vite --host 127.0.0.1 --port <spare> --strictPort`,
headless or visible. Check, and write the numbers in the result note: (a) talk to an NPC outdoors and
indoors, release A, and count ticks from the release to the first overworld pass (outdoors ≈ 23 + the pass
delay); (b) an NPC that was hidden under the box reappears only at the end; (c) START → B closes with the
freeze and no joypad desync; (d) a Forest ball: it disappears about a third of a second after the box opens,
not with it; (e) a hidden item (Viridian City Potion); (f) a Forest trainer talk and a sight encounter reach
their battles; (g) no console errors. Use a spare origin; clear its storage; leave `:5173` alone.

**The user's play-test (A = Z, B = X)** at the end, on `http://127.0.0.1:5173/`: talk to every kind of NPC and
sign and watch the box leave (a short, clean freeze, then NPCs resume); open and close START a few times;
pick up the Forest items; trigger a trainer; walk away right after closing a box, indoors and outdoors.
Nothing should feel different in the words or the walking.

## 7. Tests to add (names are suggestions)

- **Runner** (`text_runner.test.ts`): `far` continues the parent after the child's `<DONE>`/`<PROMPT>`;
  cursor continuity across ops and levels; `ram` binding and a missing-binding error; `sound` plays once,
  waits on `soundFinished` without reading the joypad (spy), and returns on the frame it finishes;
  `promptButton` has no 3-frame protection while a string `<PROMPT>` does; `waitButton` has no arrow;
  `pause` reads once and skips on A/B, else waits 30; `cry` emits the cue and consumes no frames; `asm` ends
  the run as `asm`; unsupported ops throw with the program label; the op census test; **equivalence:** every
  program reachable from the plain NPC/sign calls with no bindings produces the same buffer and frame count
  as the old flattened string through `TextPrinter`.
- **Session** (`textbox.test.ts` additions): open → print(`new`) → finish traces with and without
  `outerWait`; `new` clears, `keep` does not; `+3` only on `new`; the phases; `uiTiles.cover` continues
  through the closing frames and stops at the trailing update; the trailing callback runs exactly once, on
  the last tick; BG phase advances for the first close frame only; `show()` equals the composition.
- **Close/sprite sets:** the 19 W fixtures through the runtime code; Route 2's two halves; an overflowing
  indoor map (synthetic) drops the extra picture; a still picture takes slots 9–10; `closeFrames` for each of
  the 19 maps equals `5 + 2W`.
- **Wiring:** `MapDialogue` closes with the map's cost and starts the trainer battle after it; both trainer
  paths; START exit freezes for the cost with no `syncJoypadRead`; the Town Map sign still has no close
  (pinned); controller actions carry `call` for NPCs and signs and not for handlers; ball and hidden-item
  timelines of §5 (open at `T`, hide at `T + 20`, first letter `T + 23` / `T + 20`, sound, Hold with A
  held, close); full-bag branches; A1b's saved `hiddenObjects`, collision refresh and bag rules unchanged
  (the existing integration tests, with the §8 edits).
- **Mutation checks (do at least three, in memory, and say which):** close cost off by one; `cover()` dropped
  during the closing frames; `+3` applied to `keep`; `far` not returning to its parent; ball hidden at `T`.

## 8. Existing tests that are expected to change (and why)

List every edit in the result note with its cartridge reason; **do not loosen an assertion to make it pass.**

- `text/textbox.test.ts` displayTextID close ("one frame") → `5 + 2W` with a host; `script/text_commands.test.ts`
  `closeText` → the shared close, and the sound-wait test no longer expects `syncJoypadRead`;
  `overworld/item_pickup.test.ts` command lists (new commands), the `73` / `181` bounds (§5), the controller
  action shape for signs; any trainer / map-trainer test that measures text → battle.
- Anything else that fails is a finding, not an edit: investigate and report.

## 9. Not in A5b4, each with a home

| Finding | Home |
|---|---|
| `bcd`, `decimal` ops (prices, `_PotionText`) | A5b7 (their first consumer) |
| Route 1's sample, Daisy, Mom, nurse, Lab, Pallet, Viridian scripts and the other story handlers | A5b5 |
| Notebook, blackboard, Town Map sign (incl. its real ending), Oak's speech, Pikachu's cry | A5b6 (cry playback J2) |
| Shop, item menus, the PCs, save; `save`'s bank-`$1f` timing (`notes/28-a5b3-plan.md` §3.3) | A5b7 / V5 |
| `PrintText`'s own `UpdateSprites` and `.displayDialogue`'s | J2 |
| Pokémon cries, `wLetterPrintingDelayFlags` beyond the no-delay option | J2 |
| Battle text | A5c |
| A cartridge-exact `W` for biking/surfing, Fly warps (`BIT_FLY_WARP` skips the player reload) | with those mechanics |

## 10. Decisions (O-19) — **resolved 2026-10-11: the user took all seven recommendations**

1. **One slice, four checkpoints, one review at the end.** Recommended: **yes.** Alternative: split into
   A5b4a–d with a review each (more handoffs, more tokens, smaller diffs per review).
2. **Add `textId` to map NPCs/signs and `mapObjects` to `map_sprite_sets.json`** rather than a hand-keyed
   table. Recommended: **yes.** It changes 38 map files and 2 sprite-set files, additively. The A5b plan
   suggested a hand table; the extractor already reads the IDs, so a table would duplicate generated data.
3. **Defer `bcd` and `decimal` to A5b7.** Recommended: **defer.** No A5b4–A5b6 caller prints a number.
4. **`PrintText`'s own `UpdateSprites` stays J2** (hook only). Recommended: **yes.** Running it now would
   change Pikachu mid-dialogue with no evidence of the exact result (A5 plan §3.7, A6e's nurse note).
5. **START's exit gets the shared close in A5b4** (as `23-a5b-plan.md` §4.2 already says). Recommended:
   **yes.** It is a visible change: closing START now holds the world still for the cartridge's `5 + 2W`
   frames (23 outdoors). The alternative is to leave START to J2's menu audit.
6. **The Town Map sign keeps its current ending until A5b6.** Recommended: **yes** (§4.6).
7. **Who:** Sol (GPT-6.1) implements, Claude reviews, then the user play-tests — assumed, as for A5b3.

## 11. Handoff for Sol

> Implement **A5b4** as `notes/30-a5b4-plan.md` says; the user approved it with every recommendation
> (O-19, DECISIONS #48). Claim the slice in `context/STATUS.md` → *In progress* with your model name and the date.
> Four checkpoints, each a local commit with the co-author line and its own gate run (§6); you may stop after
> any. Read the ASM named in §3 yourself before coding each checkpoint, and **re-derive §3.3's frame costs
> and §5's timelines first**; if anything in this note disagrees with the disassembly, stop and tell the
> user. Extractor edits (CP1) never share a commit with engine changes. Do not touch the audio engines, the
> synthesizer, A6's movement code or the A5a printer's timing rules. Do not migrate any caller listed in
> §4.6/§9 and do not start A5b5.
>
> Many files under `game/src` are CRLF on disk: use the Edit tool for multi-line changes and run
> `git diff --check`. Stage specific paths only. Never push.
>
> Finish each checkpoint by updating `STATUS.md` (log), and the last one by updating `CONVENTIONS.md`
> (the test-suite section), `game/src/text/ARCHITECTURE.md` (the session contract, the runner, joypad
> ownership), `game/src/overworld/ARCHITECTURE.md` (sprite sets are now loaded; the close), root `CLAUDE.md`
> (baseline only) and the **Implementation result** at the bottom of this note: commits, counts, every §8
> test edit with its reason, the browser numbers, the mutations you ran, and anything that surprised you.
> Claude reviews next (`notes/31-a5b4-review.md`).

## Planning verification (what I read and ran; no repository file changed except this note and STATUS)

- Read: all seven context files again as needed; `23-a5b-plan.md`, `21-a5-plan.md` (§3, §7), `22-a5a-review.md`,
  `26-a5b2-plan.md`, DECISIONS #35–#47; the ASM: `home/text_script.asm` (whole), `home/text.asm` (whole),
  `home/window.asm` (`PrintText`), `home/joypad2.asm` (`WaitForTextScrollButtonPress`, `ManualTextScroll`),
  `engine/menus/display_text_id_init.asm`, `engine/overworld/map_sprites.asm`, `home/overworld.asm`
  (`.displayDialogue`, `LoadPlayerSpriteGraphics`, `LoadCurrentMapView`, `LoadMapData`), `home/copy.asm` /
  `home/copy2.asm` (`CopyVideoData`, `CopyVideoDataAlternate`), `home/start_menu.asm`, `start_sub_menus.asm`
  exits, `pick_up_item.asm`, `hidden_items.asm`, `home/overworld_text.asm` (`PickUpItemText`,
  `TextScriptEnd`), `toggleable_objects.asm` (`HideObject`); the code: `text/*.ts` (all), `script/types.ts`,
  `script/script_controller.ts` (lines 1–330, 440–600), `overworld/ui_entry.ts`, `item_pickup.ts` and its
  tests, `sprites.ts`, `sprite_visibility.ts`, `renderer/ui_tiles.ts`, `main.ts` (state machine, textbox,
  START, scripts, engageTrainer), `overworld_controller.ts` (interaction), `rom/extractors/text_programs.ts`,
  `map_sprite_sets.ts` and `map_sprite_sets.test.ts` (the reference helpers), `maps.ts` (object parsing).
- Ran: op census over all 539 programs and over the programs reachable from the plain NPC/sign calls; the
  call-kind census of the 21 `TextPointers` tables (45 `text`, 35 `printText`, 37 `handler`, 3 `script`);
  counts of current NPCs (60) and signs (20); the map and `map_sprite_sets.json` shapes.
- **Not** run: typecheck, the suites, the build, `npm run setup`, a browser. Nothing here was executed against
  the engine; the frame costs in §3.3 come from the A5b/A5b2 plans plus my re-read of the routines above, and
  CP3 must re-verify them.

## Implementation result — Sol / Codex, 2026-10-11

Implemented A5b4 in four local checkpoints. Claude's review is next in
`notes/31-a5b4-review.md`; the user's play-test has not been claimed as passed.
No A5b5 caller migration, audio-engine edit, movement change, or push.

| Checkpoint | Local commit | ROM suite | No-ROM suite | Other gates |
|---|---|---|---|---|
| CP1 data | `2ad290d` | 1018/1018 | 898 pass / 120 skip | typecheck, build, diff check; setup twice |
| CP2 pure runner | `2b3403f` | 1039/1039 | 919 pass / 120 skip | typecheck, build, diff check |
| CP3 session/close | `b2e6bd6` | 1054/1054 | 934 pass / 120 skip | typecheck, build, diff check; muted browser |
| CP4 pickups/call kinds | This checkpoint's commit includes this result | 1064/1064 | 944 pass / 120 skip | typecheck, build, diff check; muted browser |

Final suite has 49 files, 49 added tests. Baseline start was the clean approved
planning commit `d3599db`, following A5b3's reviewed `2d5118c`.

**Independent ASM derivation.** Read `CloseTextDisplay`, `CopyVideoData` /
`CopyVideoDataAlternate`, `InitMapSprites` / `LoadStillTilePattern`, and
`LoadPlayerSpriteGraphics` before wiring the cost. CopyVideoData consumes
`floor(tiles/8)+1`, including the final zero-sized branch. The LCD-on alternate
falls through; the font-loaded still-picture branch returns without copying.
Window hide is one frame, each regular 12-tile half two frames, and the walking
player's two halves four frames: **1 + 2W + 4 = 5 + 2W**. All 19 map fixtures
and both Route 2 halves agree. No contradiction requiring a stop was found.
The pickup ASM likewise puts GiveItem/HideObject after DisplayTextIDInit's 20
frames; PrintText adds three, while NoCreatingTextBox adds none.

**Delivered.** Extractors preserve every ROM NPC/sign text ID and all source
object picture IDs before NPC filtering. Runtime sprite-set selection/allocation
uses those pictures, including aliases, duplicates and hidden/dropped objects.
TextScreen shares buffer/cursor/input history between the compatible string
printer and TextProgramRunner; FAR returns to its parent, named RAM bindings,
no-delay printing, input-free sound waits, command waits/pause, ASM return and
cue-only cry are implemented. Unsupported numeric/unused ops fail with label
and A5b7 home. TextBox exposes retained open/print/wait/finish phases, exact
close, first-frame-only BG transfer during reload, continuing UI coverage,
and one trailing UpdateSprites. MapDialogue, START exit and closeText share it.
Pickups use the extracted programs and bindings rather than respelled strings.
NPC/sign call kinds come from generated TextPointers; Lab/Mart alternate tables
use `PALLET_AFTER_GETTING_POKEBALLS_2` / `OAK_GOT_PARCEL` as the ASM selects them.
Pickup opening is dispatched in the interaction tick; story dispatch is retained.

**Generated-file verification.** Hashed all 869 generated files before/after and
across repeated setup. Both runs are byte-identical. **38 modified, zero new,
831 unchanged**, rather than the plan's 40/829: Red's House 2F has no ROM NPCs
or signs, so its two map JSON files correctly do not change. Every changed map
field is added textId, and the sprite-set additions are mapObjects; stripping
those additions reproduces the baseline JSON. No generated file was hand-edited.

**Every existing-test edit and its cartridge reason.**

- `rom/__tests__/map_sprite_sets.test.ts`: reference helpers now import runtime
  helpers, while independent ASM parsing remains. All ten emitted sets are
  compared (N-1), current object/ID fixtures cover new additive data, and map
  close fixtures exercise the actual runtime implementation.
- `text/textbox.test.ts`: four existing DisplayTextID dismissal assertions and
  both trainer talk/sight dismissal traces now include the full seven-frame
  detached minimal walking close instead of one frame. Existing opening, input,
  prompt/beep and trainer-music expectations remain. Added host tests cover the
  real 7/9/11/13/15/17/23 costs and Town Map's no-reload handoff.
- `script/text_commands.test.ts`: sound waits expect no Joypad sync because
  WaitForSoundToFinish never reads it. Silent-button and Hold tests require the
  complete seven-frame detached close before scriptEnded.
- `overworld/item_pickup.test.ts`: builder lists/indices now include the opening
  and named program commands; found/failure text assertions resolve the extracted
  program's strings and RAM binding. The scene supplies Forest's actual 11-frame
  host; final sprite update is expected once. The jingle bounds are 73+11=84 and
  181+11=192. Ball sound timing is anchored to PlaySound, since the program itself
  waits for its sound before returning. Hide assertions now require no bag/hide
  change before frame 20 and the change exactly at 20. Full-bag and held-A traces
  use the retained screen's held-button reads and explicit waiting/holding/closing
  phases; all bag, save, collision, flags and failure behavior stay asserted.
  Added timing/controller tests pin 23/23/20 first writes and generated call kinds.

No other existing test file was edited. The 24 printer and three BG-transfer
tests remain unchanged. All 42 original printer/TextBox/BG tests passed unchanged
at CP2, before the intended CP3 close changes.

**Mutations actually exercised in memory.** A real ROM set-3 byte mutation is
detected by the full-set ASM comparison. Three session tests also mutate behavior
without disk edits: cost 24 fails the 23-frame callback assertion; a no-op
uiTiles.cover fails the retained close coverage assertion; forcing keep to new
fails the immediate first-read assertion by introducing Delay3. Each mutation
is restored or confined to its test instance.

**Muted browser verification.** Headless Chrome launched with `--mute-audio`,
isolated profile/origin `http://127.0.0.1:5188/`; `:5173` and its saves untouched.
Browser-only response interception supplied tick/state/render probes, with no
debug hooks written to product source. Synthetic Z/X/Enter inputs were held
about 100 ms. Scene staging stabilized NPCs and isolated the selected trainer;
the actual interaction, script controller and battle paths then ran normally.

| Browser path | Measured ticks/effect |
|---|---|
| Outdoor Pallet NPC | Close 23; next overworld pass +2; covered sprites restored only at close completion |
| Nickname House NPC | Close 13; next pass +2; covered sprites restored only at close completion |
| START → B | Close 23; zero main Joypad sync reads during close |
| Forest Potion ball | Opening in interaction tick; hide/give +20; first glyph +23; close 11; one Potion added |
| City hidden Potion | Opening in interaction tick; first glyph +20; close 23; one Potion added |
| Forest trainer talk | First glyph +23; close 11; real battle reached |
| Forest trainer sight | EmotionBubble/walk-up path; first glyph +23; close 11; real battle reached |

CP3 checked the first three paths; CP4 repeated them and added both pickups and
both trainer entry paths. **Zero console errors**. Isolated localStorage cleared;
test Chrome closed. The production build and no-ROM suite were rerun after the
final main dispatch edit.

**Findings and retained boundaries.** The committed op census contains **11**
kinds; the plan says 12 but lists those same 11. An incomplete audio mock exposed
an eager port lookup while investigating an unrelated pushed-hop test; changing
the port to a lazy callback fixed it without editing that test or movement code.
The browser harness needed stale-buffer/pass-event filtering and the sight scene
needed the trainer's native left facing; those were fixture changes, not engine
fixes. Town Map retains its current ending. Route 1's sample, all story builders,
menu/battle callers, cry playback, PrintText's font-loaded UpdateSprites and other
J2 departures remain at their planned homes. Required baseline/architecture/
STATUS docs are updated. Claude can review this slice now.
