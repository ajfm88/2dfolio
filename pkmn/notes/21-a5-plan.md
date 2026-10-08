# A5 — Battle and text presentation: the milestone, and A5a in detail

**2026-10-06 · planned by Claude Opus 5.5. A5a implemented by Sol; awaiting Claude
review and the user's play-test.**

Start from **`d335adc`** (A1 done). A5 is the milestone DECISIONS #31 created ("battle
presentation") and #41 widened ("battle and text presentation per the ASM"). This note
does two things:
- §1 splits A5 into six slices, each with its scope, ASM anchors and size;
- §2–§7 plan the first one, **A5a: the text printer and map texts**, at the level of detail
  the A1b and A1c plans had.

Each later slice gets its own plan note when it comes up. The user picks the implementer.
The recommendations in §9 were accepted by the user on 2026-10-06 (DECISIONS #44).
Sol implements A5a; Claude reviews, followed by the user's play-test.

Sources: `refs/pokeyellow` @ `e89ead15`. Line numbers are the named file's. Compared with
gen1recomp @ `20ab97ab` (`src/render/TextBox.lua`, `src/core/Timing.lua`).

## TL;DR

- **A5 is six slices**, and A5a comes first because battle text needs its printer:

  | Slice | What |
  |---|---|
  | **A5a** | The text printer, and NPC, sign and trainer texts |
  | A5b | Script and menu texts per their ASM |
  | A5c | Battle text on the printer |
  | A5d | Battle transitions |
  | A5e | Battle intros and pic positions |
  | A5f | The normal wild catch |

- **A5a ports the cartridge's text printer** (`PlaceString`, `home/text.asm`). Each item below
  is wrong today:
  - **Letter timing:** each letter is placed, then delayed (1/3/5 frames; 1 while A or B is
    held). Ours delays first (N-1).
  - **`cont`:** ▼, 3 frames, a wait, the beep, then a two-step scroll of 5 + 5 frames.
  - **`para`:** ▼, 3 frames, a wait, the beep, the box cleared, then 20 frames.
  - **`prompt`:** a wait behind ▼. **`done`:** nothing.
  - **Single tiles:** the contractions `'s 't 'm 'r 'd 'l 'v` are one tile each. Ours draws
    two, which shifts the rest of the line. That affects 71 of our 196 extracted texts.
- **NPC, sign and trainer texts get `DisplayTextID`'s frame:**
  - the box appears 4 frames after A;
  - letters start about 20 frames after A (the font loads first);
  - a `done` text then waits silently, with no ▼ and no beep, for a *new* A or B;
  - it closes when A is *released*. Ours beeps and closes on the press.
- **Letters reach the screen every third frame.** The automatic BG transfer copies one third
  of the screen per frame. So with A held, letters appear three at a time. Decision 4.
- **The data keeps `\n`.** It changes only where `\n`'s rule ("next row, or scroll if already
  on the second") isn't what the ROM does. There, the extractor writes `<CONT>`, `<LINE>` or
  `<NEXT>`. A `prompt` ending becomes a trailing `<PROMPT>`.
  - In all of pret's 2,565 text blocks, the rule is wrong exactly once outside battle: Route
    22's rival has a `cont` straight after a `para`.
  - The 4 `next`s all behave like `line`.
  - `game_text.json` waits for A5b.
- **The ▼ blink rate can't be read off the ASM.** The wait loop is CPU-bound: each phase is
  1,536 loop iterations, about 30–50 frames by my cycle count. The default is 30 on / 30 off
  (what gen1recomp uses). You may be able to time it on your own setup (decision 5).
- **Found:** closing a text box costs the cartridge roughly 2 frames per walking sprite sheet
  plus 4. During that time nothing moves, and an `UpdateSprites` follows. → A5b, with
  sprite-set data.
- **All nine decisions (§9) accepted**, Sol implements, Claude reviews (DECISIONS #44).

**A5b follow-up plan (2026-10-06):** `23-a5b-plan.md` supplies the caller audit,
exact close schedule, proposed data contracts and seven implementation increments.
It supersedes the initial two-session estimate below; the detailed proposal still
needs user approval. A5a is complete; A5b implementation has not started.

## 1. The milestone

### 1.1 What was routed to A5

| Input | Source | Slice |
|---|---|---|
| All 8 battle transitions and the choice between them, the dungeon-list bug | DECISIONS #31; `notes/04-v1c-plan.md` §1.6 | A5d |
| Enemy pic x (5×5 pics centred at tile 13), trainer intro pic at tile 12 | #31; `04-v1c-plan.md` §1.6 | A5e |
| Battle text that types and scrolls on `cont` | #31 | A5c |
| Overworld text-box endings: silent `done`, A's release, `prompt`'s ▼, `Delay3`, `para`'s 20 frames, the two-step scroll | #41; `notes/18-a1b-plan.md` §8 | **A5a** (map texts), A5b (scripts) |
| N-1: a typed text completes one letter delay early | `notes/19-a1b-review.md` | **A5a** |
| The wild intro: pokéballs during "appeared!", the HUD after; the slide is 72 linear frames, not 40 eased | `notes/05-v1d-plan.md` §1.4, §4 | A5e |
| The Pikachu battle's transition with an empty party (`GetBattleTransitionID_CompareLevels` walks past the party) | `05-v1d-plan.md` §1.4 | A5d |
| The normal wild catch departs from `ItemUseBall` (texts, toss, ball removed after, "New POKéDEX data") | `05-v1d-plan.md` §4 | A5f |
| Species display names: "NIDORAN-F" where `MonsterNames` says "NIDORAN♀" | STATUS, V1c | V5 (decision 7) |

### 1.2 The slices

| Slice | Scope | ASM anchors | Depends on | Size |
|---|---|---|---|---|
| **A5a** | The printer core, for every text box. `DisplayTextID`'s opening and ending for NPC, sign, bookshelf and trainer texts. Extractor: newline kinds, the `prompt` terminator, glyphs. Battle callers ignore the new tokens. **This note, §2–§7** | `home/text.asm`, `home/print_text.asm`, `home/joypad2.asm`, `home/text_script.asm`, `engine/menus/display_text_id_init.asm`, `home/vcopy.asm` | — | 1–2 sessions |
| A5b | Script and menu texts per their ASM. Every story script's texts become `DisplayTextID`, `PrintText` or `text_asm` calls, as their scripts call them: Pallet, Oak's Lab, Viridian, Mom, Daisy, the Mart, the nurse, item pickups' opening, the school notebook and blackboard, the town-map sign. Also: Oak's speech; `game_text.json` terminators; `CloseTextDisplay`'s sprite reload frames and trailing `UpdateSprites` (needs each map's sprite set); the Pallet and Oak's Lab "!" bubbles (from V5) | the story scripts' `scripts/*.asm`, `engine/movie/oak_speech/`, `engine/overworld/map_sprites.asm` | A5a | 2 sessions |
| A5c | Battle text on the printer, in the battle text box, typed. `prompt` waits behind ▼, `done` texts followed by the battle engine's own delays, `cont` scrolls. The invented `textMinTimer` goes. The ASM texts and terminators replace upstream's strings for the messages the intro, turn, faint, switch and EXP flows show. Effect messages are audited with battle mechanics later | `engine/battle/core.asm`, `data/text/text_2.asm`–`_7.asm` | A5a | 2 sessions |
| A5d | Battle transitions: the 3-bit choice (trainer, enemy ≥ lead + 3 levels, dungeon map), the dungeon list with its missing maps, all 8 animations and the flash, the spiral direction, and what the empty-party Pikachu battle yields. Map trainers get theirs (they cut straight in today) | `engine/battle/battle_transitions.asm` (757 lines), `data/maps/dungeon_maps.asm` | — | 1–2 sessions |
| A5e | Battle intros: `SlidePlayerAndEnemySilhouettesOnScreen` (72 frames of 2 px, inverted palette), the pokéballs, the HUD order, the trainer pic at tile 12, 5×5 front pics centred at tile 13 (`LoadUncompressedSpriteData`) | `engine/battle/core.asm:9–130`, `engine/battle/init_battle.asm`, `home/pics.asm` | A5c (the intro text) | 1 session |
| A5f | The normal wild catch per `ItemUseBall`: its texts, the toss, poof and shake animations from `data/battle_anims`, the ball removed after the throw, the "New POKéDEX data" page. The catch jingle stays in V5 | `engine/items/item_effects.asm` `ItemUseBall`, `data/battle_anims/` | A5c, A5e | 1–2 sessions |

**Order (decision 1): A5a → A5b → A5c → A5d → A5e → A5f.**
- A5b follows A5a while the printer is fresh: the cutscenes are the other half of "text-box
  endings".
- A5c needs the printer, and A5e's intro text needs A5c.
- A5d depends on nothing. It could go first as a quick visible win, at the cost of
  reopening battle code twice.
- Six slices is 8–10 sessions. V2 can come before A5d–A5f if you'd rather see Pewter
  sooner: those three don't block any map work.

## 2. Probe: the cartridge's text printer (for A5a)

### 2.1 `PlaceString` and the control characters (`home/text.asm:48–330`)

The printer walks the string one byte at a time. The cursor is a tile address. A box text
starts at (1, 14), the first text row; the second is (1, 16). The box is rows 12–17:
border, four inner rows 13–16, border. Rows 13 and 15 are normally blank.

| Byte | Routine | Effect | Frames |
|---|---|---|---|
| letter | `ld [hli], a` then `PrintLetterDelay` | placed, **then** the delay (§2.2) | 1 / 3 / 5 |
| `<LINE>` ($4f) | | cursor to (1, 16) | 0 |
| `<NEXT>` ($4e) | | cursor down 2 rows (1 if `BIT_SINGLE_SPACED_LINES`) | 0 |
| `<CONT>` ($55) → `<_CONT>` | `ContText` → `_ContText` (269) | ▼ at (18, 16); `ProtectedDelay3`; `ManualTextScroll`; ' ' at (18, 16); `ScrollTextUpOneLine` ×2; cursor (1, 16) | 3 + wait + 5 + 5 |
| `<SCROLL>` ($4c) | `_ContTextNoPause` | the two scrolls only | 10 |
| `<PARA>` ($51) | `Paragraph` (230) | ▼ at (18, 16); `ProtectedDelay3`; `ManualTextScroll`; clear rows 13–16, cols 1–18; `DelayFrames 20`; cursor (1, 14) | 3 + wait + 20 |
| `<PROMPT>` ($58) | `PromptText` (213) | ▼ at (18, 16) (not in a link battle); `ProtectedDelay3`; `ManualTextScroll`; ' ' at (18, 16); then as `<DONE>` | 3 + wait |
| `<DONE>` ($57) | `DoneText` | the text ends | 0 |
| `@` ($50) | | ends this string (a `text` command; the text goes on to its next command) | 0 |
| `<PLAYER>` `<RIVAL>` `#` `<PC>` `<TM>` `<TRAINER>` `<ROCKET>` `<……>` `<PKMN>` `<TARGET>` `<USER>` | `PlaceCommandCharacter` | the string is placed through `PlaceString`, **each letter with its delay** | per letter |

`ScrollTextUpOneLine` (280) copies rows 14–16 onto rows 13–15, blanks row 16 and waits 5
frames. It runs twice:
1. **After the first copy:** line 1 is on row 13, line 2 on row 15. This half-step is on
   screen for 5 frames.
2. **After the second copy:** line 2 is on row 14, and row 16 is blank.

### 2.2 `PrintLetterDelay` (`home/print_text.asm:4`)

- `hFrameCounter` = the option's delay: FAST 1, MEDIUM 3, SLOW 5.
- The routine loops: `Joypad`, then if A or B is **held**, one `DelayFrame` and it's done.
  Otherwise it waits until the counter (decremented in VBlank) reaches 0.
- So a letter costs N frames, or exactly 1 if A or B is held. A press in the middle of the
  wait ends it one frame later.
- Since the letter is placed **before** its delay, the last letter is on screen a full delay
  before the text ends. Ours waits first and places after: N-1.

### 2.3 Waiting for a button

**`ManualTextScroll`** (`home/joypad2.asm:90`):
1. `WaitForTextScrollButtonPress`;
2. `WaitForSoundToFinish`;
3. `PlaySound SFX_PRESS_AB`.

In a link battle it is just `DelayFrames 65`.

**`WaitForTextScrollButtonPress`** (55) loops until `hJoy5 & (A|B)`. Each iteration runs:
- `HandleDownArrowBlinkTiming` at (18, 16);
- `JoypadLowSensitivity`. With `hJoy7` = 0, which is how text runs it, `hJoy5` =
  `hJoyPressed`: buttons **newly** pressed since the last `Joypad` call, anywhere;
- `predef CableClub_Run`.

Two consequences:
- **A press during the `Delay3` before the wait is kept.** `hJoyLast` was last written by the
  final letter's `Joypad`. Ours drops a press made during those three frames.
- **An A held since before the wait is not a press.** You have to release it and press again.

**The ▼ blink** (`home/window.asm:223`) is driven by loop iterations, not frames.
- `hDownArrowBlinkCount1` starts at 0 and `hDownArrowBlinkCount2` at 6. The arrow toggles after
  6 × 256 = 1,536 iterations, both on and off.
- Iterations per frame depend on the CPU time each one takes. I count about 360 machine
  cycles: `Joypad` through `homejp` ≈ 110, `JoypadLowSensitivity` ≈ 50, the predef ≈ 150, the
  rest ≈ 50.
- A frame is 17,556 machine cycles, minus the VBlank handler (sound, OAM, the BG transfer,
  roughly 4,000–7,000). That gives 29–37 iterations per frame, so **30–50 frames per phase**.
- gen1recomp uses 30 / 30. Ours uses 16 / 16, which is likely Gen 2's rate.
- It's decision 5.

### 2.4 What's on screen: the automatic BG transfer (`home/vcopy.asm:127`)

- Letters are written to the WRAM tile map.
- While `hAutoBGTransferEnabled` is set, VBlank copies one third of the screen per frame, in
  rotation: top, middle, bottom.
- The text box is the bottom third, so **what the box shows updates every third frame**:
  - at MEDIUM, one letter per update;
  - with A held, **three letters per update**;
  - the ▼, its blinking, each scroll step and each clear also show up only at those updates.
- The rotation's phase (`hAutoBGTransferPortion`) carries over from whenever the transfer was
  last on.

### 2.5 `DisplayTextID`: how a map text opens and closes

**Opening** (`DisplayTextIDInit`, `engine/menus/display_text_id_init.asm`). Frame T is the pass
that read A.

| When | What |
|---|---|
| T | box border into WRAM (4 × 18 inside, at row 12); `UpdateSprites` with the font loaded (ui_entry, A6c); facings saved; sprites put on their standing frame |
| T+1 … T+3 | `CopyScreenTileBufferToVRAM`: the screen copied to the window map, a third per frame |
| T+4 | `hWY = 0`: the window, and so the empty box, is on screen |
| T+4 … T+20 | `LoadFontTilePatterns`: 128 tiles, 8 per frame (16 frames), then one more `DelayFrame` |
| after T+20 | auto transfer on; `PrintText_NoCreatingTextBox` places the first letter. It shows at the next bottom-third transfer: T+21, T+22 or T+23 |

**`PrintText`** (`home/window.asm:281`): used by a `text_asm` script inside a `DisplayTextID`,
as `TalkToTrainer` does.
1. `DisplayTextBoxID` draws the box again;
2. `UpdateSprites`;
3. `Delay3`;
4. the text from (1, 14).

**Ending** (`home/text_script.asm:84–137`):
1. **`AfterDisplayingTextID`:** `WaitForTextScrollButtonPress`, unless
   `wDoNotWaitForButtonPressAfterDisplayingText`. There is **no ▼**: the arrow cell is empty,
   so `HandleDownArrowBlinkTiming` does nothing. There is **no beep**: that is
   `ManualTextScroll`'s, not this routine's.
2. **`HoldTextDisplayOpen`:** loops while **A** is held. B closes on its press; A closes on
   its release.
3. **`CloseTextDisplay`:**
   1. `hWY = $90`, then `DelayFrame`: the box is gone the next frame;
   2. `LoadGBPal`; facings restored;
   3. `InitMapSprites`: the font overwrote the walking sprite tiles, so they are reloaded.
      That's `CopyVideoData`, 8 tiles a frame, about 2 frames per walking sprite sheet in
      the map's sprite set;
   4. `LoadPlayerSpriteGraphics` (4 frames);
   5. `LoadCurrentMapView`, then **`UpdateSprites`**.

   Back in the loop, the next pass comes 2 frames later. Step 3, step 4 and the trailing
   `UpdateSprites` go to A5b (decision 6).

**A `prompt`-ended text shown through `DisplayTextID`** gets both waits:
1. its own: ▼, `Delay3`, wait, beep;
2. then `DisplayTextID`'s silent one.

**A trainer you talk to** (`TalkToTrainer`, `home/trainers.asm:84`):
1. the `DisplayTextID` opening;
2. `PrintText` of the before-battle text: `Delay3`, typed, ending in `done`;
3. `EngageMapTrainer`'s meet music, right after the last letter's delay;
4. the silent wait and A's release;
5. the battle.

The sight path is the same without the music.

### 2.6 The text data today

- **`rom/extractors/text.ts`** maps `<NEXT>`, `<LINE>` and `<CONT>` all to `\n`, and stops at
  `<DONE>`/`<PROMPT>` without recording which one it was.
- **`game_text.ts`** has a second copy of the same table.
- **What the extractors get wrong:**
  - **Contractions:** decoded as two characters ("'s"), while the ROM byte ($BB–$BF, $E4, $E5)
    is **one tile** (font tiles 59–63, 100, 101). `charmap.ts` maps none of them.
  - **$E1 and $E2** decode as the letters "PK"/"MN", not the PK and MN glyphs
    (`charmap.ts`'s U+E001/U+E002).
  - **$4A, $56 and $70–$75** (`<PKMN>`, `<……>`, the curly quotes, `…`) are dropped silently.
- **None of these glyphs appear in our 19 maps' texts.** The contractions do: 89 of them, in
  71 of 196 texts.
- **pret, all text blocks** (my scan of `text/*.asm` and `data/text/*.asm`):

  | What | Count | `\n`'s rule correct? |
  |---|---|---|
  | blocks | 2,565 | |
  | ending `done` | 1,698 | |
  | ending `prompt` | 672 | |
  | ending some other way (`text_end`, `text_asm` tails, `dex`) | 192 | |
  | `cont` on the first row: `_Route22Rival1VictoryText`, right after its `para` (the line is shown, then scrolled away) | 1 | no → `<CONT>` |
  | battle fragments that start with `cont` (`_UsedInsteadText`, `_WithExpAllText`, `_BoostedText`): their row depends on the text printed before them | 3 | decided at runtime (A5c) |
  | `next` (`_MirrorMoveFailedText`, `_PokemartGreetingText`, `_WhichMoveToForgetText`, `_NoCyclingAllowedHereText`) | 4 | yes (all on the first row, where `next` = `line`) |
  | `line` on the second row | 0 | — |

  A mid-block `text` continues at the cursor (after a `text_decimal`, for example); it
  doesn't return to the first row. My first scan got that wrong and over-counted.

### 2.7 Today's `TextBox` against that

| | Cartridge | Ours (`text/textbox.ts`) |
|---|---|---|
| Letter | place, then delay | delay, then reveal (N-1) |
| `cont` | ▼, 3 frames, wait (presses during the 3 kept), sound wait, beep, scroll 5 + 5 | ▼, wait, beep, instant one-line scroll |
| `para` | ▼, 3, wait, beep, clear, 20 frames | ▼, wait, beep, instant clear |
| `done` (map text) | 4 frames to the box, 20 to the first letter; silent wait for a new A/B, no ▼; close on A's release | typing from the next frame; beep and close on the press |
| `prompt` | ▼ wait, then `DisplayTextID`'s silent wait | the A1b `end: 'prompt'` option only |
| Contractions | one tile | two |
| ▼ blink | ~30–50 frames a phase (iterations) | 16 frames |
| What's visible | every third frame (bottom third) | every frame |
| Long lines | none in the data (no wrap) | word-wrapped at 18 characters (upstream's) |

## 3. The A5a plan

### 3.1 Data: one decoder, exact control codes (decision 2)

1. **One decoder.** `game_text.ts` stops keeping its own table and imports `text.ts`'s.
2. **Newline kinds.** `decodeMapText` tracks the row as it decodes:
   - `text` → row 1; `line` → 2; `cont` → 2; `para` → 1; `next` → row + 1.
   - It writes `\n` when `\n`'s rule gives the same result: `line` or `next` from row 1,
     `cont` from row 2.
   - Otherwise it writes a token: `<LINE>` (from row 2), `<CONT>` (from row 1), `<NEXT>`
     (from row 2).
   - `para` stays `\f`.
3. **Terminators.** `prompt` appends `<PROMPT>`. `done`, `@` and `text_end` append nothing:
   for a `DisplayTextID` they behave the same.
4. **Glyphs:**
   - $E1/$E2 → U+E001/U+E002; $4A → both.
   - $75 → `…`; $56 → `……`; $70–$73 → `‘ ’ “ ”`.
   - Contractions stay "'s" etc. in the data: the printer maps them (§3.4).
   - **Any byte with no mapping throws**, rather than being skipped silently.
5. **`game_text.json` doesn't change in A5a.** Its strings feed scripts, which A5b converts:
   the `game_text` decoder emits no terminators yet. A test pins that its regenerated output
   is byte-identical.
6. **Regenerate** (`npm run setup pokeyellow.gbc`). The diff must be:
   - `<PROMPT>` on the map texts that end with `prompt`: the Forest's five end-battle texts,
     plus a few dialogue, sign and script texts (the per-map counts are in §8's probe
     table);
   - no newline tokens: the one text that needs `<CONT>` is Route 22's rival, which isn't
     extracted yet.

   **Nothing else.** `git diff --stat -- game/data game/static`, both copies.

### 3.2 The printer: `text/text_printer.ts` (new, pure)

The ASM is sequential code full of `DelayFrame`s, so the port is a **generator**: each
`yield` is one frame. That keeps the routines' shapes, and tests drive it frame by frame.

- **Input.** A string, already through `substituteNames`.
- **Tokenizer:** letters (contraction digraphs become one glyph, §3.4), `\n`, `\f`, `<LINE>`,
  `<CONT>`, `<NEXT>`, `<SCROLL>`, `<PROMPT>`, `<DONE>`. Leave room for A5b's text commands
  (pause, prompt button, wait button, sound).
- **State:** the 20 × 6 tile buffer of rows 12–17 (`wTileMap`), the cursor, and its own
  `hJoyLast`.
- **Its `Joypad`:** pressed = down now and not at its last read. `hJoyLast` is updated
  exactly where the ASM calls `Joypad`: each frame of a letter delay, and each frame of a
  wait. Nothing updates it during `Delay3`, `DelayFrames 20` or the scroll waits. The opening
  seeds it from the overworld's last read, the pass that pressed A.
- **The routines** (§2.1–§2.3):
  - `letterDelay`;
  - `manualTextScroll`: wait for a new A/B, then `isSoundFinished()`, then `playSFX('press_ab')`;
  - `cont`, `para`, `prompt`, `done`, `line`, `next`, `scroll`.
- **The ▼:** a tile in the buffer, toggled by the blink (decision 5) while a wait runs. It
  starts on and stays on through the `Delay3`.
- **Writing past row 16:** `next` from row 2, or a line longer than 18 tiles, writes outside
  the box. It isn't in the data, and the extraction test pins that. The buffer clips it rather
  than corrupting anything.

### 3.3 What's on screen: the third-by-third transfer (decision 4)

- A small `BgTransfer` model: a module-level portion counter that advances once per frame
  while a text box is up, and persists between boxes. That stands for
  `hAutoBGTransferPortion`.
- On the frames the portion is the bottom third, the box's **visible** buffer becomes a copy
  of the printer's buffer. `TextBox.render` draws the visible buffer only.
- The opening's box is the exception: the window copy (§2.5) makes it visible whole at T+4,
  whatever the phase.
- The counter starts at 0 at boot. Battles and menus will advance it once they use the
  printer (A5c, the menu audit); until then the phase is approximate, which is a 0–2 frame
  shift.

### 3.4 Glyphs (decision 3)

- `charmap.ts` gains the seven contraction glyphs (`'d` 59, `'l` 60, `'s` 61, `'t` 62, `'v`
  63, `'r` 100, `'m` 101).
- The tokenizer reads an apostrophe followed by one of those letters as **one glyph**, as
  rgbasm's longest-match charmap does. It applies to extracted and hand-written strings alike.
- The `font_extra` glyphs (`…`, `‘ ’ “ ”`) draw from `font_extra.png` ($60–$7F; the border
  tiles already come from there).
- Remove word wrap for texts printed through the printer. Every source text is broken by
  hand.

### 3.5 `TextBox`: modes

`TextBox` keeps its API and wraps the printer. `show(text, opts)` takes a **mode**:

| Mode | Opening | Text's terminator | Ending |
|---|---|---|---|
| `displayTextID` | §2.5: box at T+4 (render T+3), first letter placed at T+20 | obeyed (`<PROMPT>` → its ▼ wait) | silent wait for a new A/B, then while A is held; `active` false the frame after |
| `printText` (inside a `displayTextID`) | `Delay3`, box redrawn | obeyed | none: the outer `displayTextID` ends it |
| `legacy` (default; everything not converted yet) | as today (typing from the next frame) | a trailing `<PROMPT>`/`<DONE>` is ignored | as today: wait for A/B, beep, close |

- **A1b's `end: 'none' | 'prompt'` stay as they are**, on top of any mode. `end: 'prompt'`
  becomes the printer's `prompt` routine. A text that has an explicit `end` and also carries a
  trailing terminator token drops the token: the explicit end wins.
- **The printer core is shared by every mode.** So cutscenes, Oak's speech and the blackboard
  also get, from A5a on: the place-then-delay letters, single-tile contractions, the `cont`
  scroll animation, `para`'s 20 frames, the `Delay3`s, the new blink and the 3-frame
  visibility. Only their openings and endings wait for A5b.

### 3.6 The callers A5a converts

- **`main.ts` `textbox` actions** for NPC dialogue, signs, bookshelves and hidden-event texts →
  `displayTextID`.
- **`engageTrainer`, both paths** → `displayTextID` opening, then `printText` for the
  before-battle text.
  - Talk path: the meet music when the printer finishes the text (`done` after the last
    letter's delay). This replaces V1c's `isWaitingForInput && !hasMorePages` check.
  - Then the `displayTextID` ending → `startTrainerBattle`.
  - Sight path: the same, without music.
  - PrintText's `UpdateSprites` under the font is not modelled, as the nurse's `PrintText`s
    aren't (A6e's `uiEntryUpdates: false`).
- **Battle code** that shows map texts (`endBattleText` through `battleTextPages`, V1c) **strips
  the new tokens** until A5c.
- **Everything else stays `legacy`:**
  - the script `text` command;
  - Oak's speech;
  - the blackboard;
  - item pickups, whose `DisplayTextIDInit` opening comes with the scripts in A5b.

### 3.7 Not in A5a

- `CloseTextDisplay`'s sprite reload frames and trailing `UpdateSprites` → A5b (decision 6).
- Script, cutscene and Oak's-speech openings and endings, and `game_text.json` terminators →
  A5b.
- `PrintText`'s font-loaded `UpdateSprites` → the J2 audit, with the nurse's.
- Battle text → A5c. Menus (START opens through `DisplayTextID` too, with the same 20 frames)
  → the menu audit.

## 4. Files

| File | Change |
|---|---|
| `rom/extractors/text.ts` | row tracking, newline tokens, `<PROMPT>`, glyphs, throw on unmapped bytes |
| `rom/extractors/game_text.ts` | use `text.ts`'s decoder; output unchanged |
| `data/maps/*.json`, `static/maps/*.json` | regenerated (`<PROMPT>` suffixes, any tokens) |
| `text/text_printer.ts` (new) | the printer (§3.2) |
| `text/bg_transfer.ts` (new) | the visible-buffer model (§3.3) |
| `text/textbox.ts` | wraps the printer; modes; renders the visible buffer; ▼ blink |
| `text/charmap.ts` | contraction glyphs, `font_extra` glyphs |
| `main.ts` | `textbox` actions and `engageTrainer` in the new modes; the meet music on completion; no `syncJoypadRead` while the printer reads |
| `battle/trainer_flow.ts` (`battleTextPages`) | strip the tokens |
| `script/script_controller.ts` | A1b's `end` on the printer; `legacy` otherwise |
| docs | `text/ARCHITECTURE.md` (the printer, modes, tokens), `context/ARCHITECTURE.md` (data contract: text tokens), CONVENTIONS (naming traps: text tokens and contractions), STATUS, PLAN, DECISIONS, CLAUDE.md (baseline only) |

## 5. Tests (about 45 new)

- **`text_printer.test.ts`** (pure; a frame driver with a fake joypad and sound):
  - **Letters.** Placed on the frame they're reached, then 1/3/5 frames. With A held, 1. A
    press mid-delay ends it the next frame. N-1: the last letter is in the buffer a full
    delay before the text completes.
  - **`\n`.** From row 1 it moves to row 2 with no wait. A third line runs `cont`.
  - **`cont`, frame by frame.** ▼ at (18,16); 3 frames with no read; a press made during
    them is accepted at the first read; an A held from before isn't. Then the sound wait,
    the beep, ▼ cleared, the half-step (lines on rows 13 and 15) for 5 frames, the full step
    for 5, and typing resumes on row 16.
  - **`para`.** ▼, 3, wait, beep, rows 13–16 cleared, 20 frames, row 14.
  - **`<PROMPT>`.** ▼, 3, wait, beep, ▼ cleared, done. **`<DONE>`.** Ends with no wait.
  - **Tokens.** `<CONT>` from row 1 scrolls a single line away; `<LINE>` from row 2 overwrites
    row 16; `<NEXT>` from row 1 equals `\n`.
  - **Glyphs.** "It's" is 3 tiles; "you're" is 5; `'r`/`'m` map to 100/101; `…` uses
    `font_extra`.
  - **Blink.** On through `Delay3`, then toggles at the chosen period.
- **`bg_transfer.test.ts`.** At MEDIUM each letter shows within 3 frames; with A held,
  letters show three at a time; the phase persists between boxes.
- **`textbox` modes** (`textbox.test.ts`, mocked renderer):
  - `displayTextID`: the box is visible from render T+3, the first letter is placed at T+20;
    the done ending is silent with no ▼; A held from the opening needs a release and a new
    press; B closes on the press; A closes on its release.
  - A `<PROMPT>` map text needs two presses: the first beeps.
  - `printText` adds `Delay3`.
  - `legacy` ends as before.
  - A1b's `end` options still pass their tests.
- **Trainer flow.** Through `main.ts` helpers moved into a testable module, or the controller
  test harness: the talk path's music starts on the frame the text completes (no press);
  the sight path plays none; the battle starts after A's release.
- **Extraction (ROM):**
  - **Newline tokens round-trip.** Every extracted map text, re-encoded from its tokens, gives
    back the pret source's `line`/`cont`/`next` sequence. That runs on the asm when `refs/`
    exists.
  - The Forest's five end-battle texts end with `<PROMPT>`; their dialogue texts don't.
  - No extracted text holds an unmapped byte.
  - `game_text.json` is unchanged.
  - No map text line is over 18 tiles, counting contractions as one.
- **Existing suites**:
  - `text_commands.test.ts` and `item_pickup.test.ts` frame counts that shift because of the
    printer core (letter-then-delay, `Delay3`, scroll) are updated **only** where the ASM
    says so, each change explained in the commit.
  - A1b's 73 / 181 audio counts start at text completion, so they should hold.

## 6. Checkpoints

Commit locally at each one; the game stays playable between them.

1. **The printer and the visible buffer** (§3.2–§3.4), with their tests. `TextBox` in `legacy`
   mode on the new core, and every existing test green or updated with its ASM reason.
2. **Data** (§3.1): the decoder, the regenerated diff, the extraction tests, battle stripping
   the tokens.
3. **`displayTextID` and `printText`** (§3.5–§3.6): NPC, sign and hidden texts and the trainer
   flow converted; the mode tests.
4. **Docs, verify.** Typecheck, the full suite with `ROM_PATH`, the no-ROM suite, build; a
   browser smoke on a spare port; STATUS.

## 7. Verification

Automated: as §6.4. In the browser on a spare port, then your play-test at
`http://127.0.0.1:5173/` (A = **Z**, B = **X**). The option menu sets the text speed.

1. **Talk to anyone** (Viridian's girl, the Forest youngster1).
   - The box appears a few frames after A; the letters start about a third of a second
     later.
   - At the end there is no ▼ and no beep.
   - Holding A after the text: the box stays until you let go. B closes it at once.
2. **Any text of three lines or more** (the school notebook pages, many NPCs): before each
   new line,
   - ▼ appears for a moment before you can press;
   - the beep;
   - the text slides up in two steps.
3. **Any text with a new paragraph** (its box empties before the next part): ▼, the beep, an
   empty box for a third of a second, then the next part.
4. **Contractions** ("It's", "you're", "don't"): one tile wide, with no gap after.
5. **Hold A while a text types:** letters arrive in little groups. At MEDIUM they arrive one
   by one.
6. **A Forest trainer, talked to:** the meet music starts as the last letter appears, before
   you press; then A (released) starts the battle. **Spotted:** the same, with the music from
   the "!".
7. **The ▼ blink:** compare with your memory or an emulator, and say if it feels too fast or
   too slow (decision 5).
8. **Cutscenes** (Oak in the grass, the lab, the old man): unchanged except the typing and
   scrolling above. Their endings change in A5b.

## 8. Found while planning — each with a home

| Finding | Source | Home |
|---|---|---|
| Closing a text box: `InitMapSprites` reloads the walking sprite tiles (~2 frames per walking sheet), `LoadPlayerSpriteGraphics` (4), then a trailing `UpdateSprites` | `home/text_script.asm:104`, `engine/overworld/map_sprites.asm` | A5b (needs the sprite sets), decision 6 |
| START opens through `DisplayTextID` (text ID 0): the same 3 + 17 frames before the menu text | `engine/menus/display_text_id_init.asm` | the menu audit (J2) |
| `PrintText`'s `UpdateSprites` runs under the font in every script `PrintText` | `home/window.asm:281` | J2, with A6e's nurse note |
| `next` from the second row writes past the box. None of the 4 pret uses does | `home/text.asm:62` | the printer clips; no work |
| `TextCommand_PAUSE` / `DOTS` / `PROMPT_BUTTON` / `WAIT_BUTTON` / sound commands exist in script texts | `home/text.asm:330–620` | A5b, as the cutscenes need them |
| The per-map `prompt` counts in the 19 maps' `text/*.asm` | probe: Oak's Lab 7, Route 22 4, Forest 5 (end-battle), Red's house 1, Blue's house 1, Route 1 1, Viridian 1 | A5a's diff check, A5b's scripts |

## 9. Decisions (O-16)

1. **Split A5 into A5a–A5f (§1.2), in that order?** **Recommended: yes.** The printer first
   (battle text needs it), cutscene texts while it's fresh, battle text next, then the
   transitions, intros and catch. The alternative is A5d (transitions) first, as a quick
   visible win: reply "A5d first". You can also say "V2 after A5c" to see Pewter before the
   last three.
2. **Keep `\n` in the data and add tokens only where `\n`'s rule is wrong, plus a trailing
   `<PROMPT>`; leave `game_text.json` for A5b?** **Recommended: yes.** The data stays readable
   and hand-written strings keep working, and the printer is exact. The alternative,
   `<CONT>` on every `cont`, rewrites nearly every multi-line text.
3. **Contractions as single glyphs at print time, plus the PK/MN and `font_extra` glyphs in
   the decoder?** **Recommended: yes.** It's 71 of our 196 texts, and rgbasm itself encodes
   them this way.
4. **Show the box only at bottom-third transfers (letters in threes with A held)?**
   **Recommended: yes.** It's what the cartridge shows, it costs one small model, and the
   scroll and blink depend on it too. The phase is approximate (0–2 frames) until battles and
   menus feed it.
5. **▼ blink at 30 frames on / 30 off?** **Recommended: yes, as the default.** The ASM's rate
   depends on CPU time (§2.3); my estimate is 30–50 frames a phase, and gen1recomp uses 30. If
   you can time it on a cartridge or emulator (blinks in 10 s), I'll set it from that.
6. **Leave `CloseTextDisplay`'s reload frames and trailing `UpdateSprites` to A5b?**
   **Recommended: yes.** They need each map's sprite set, which belongs with the script work.
   In A5a the box disappears the frame after A's release.
7. **Species display names (`MonsterNames`, "NIDORAN♀") to V5 rather than A5?**
   **Recommended: yes.** It's a data change touching every species lookup, not presentation
   timing.
8. **The normal wild catch inside A5 (A5f), not a milestone of its own?** **Recommended: yes.**
   It reuses A5c's text and A5e's intro pieces.
9. **Who implements A5a?** Your call: Sol implements and Claude reviews (the A1b pattern), or
   Claude implements (as A1c).

Accepted by the user on 2026-10-06: yes to all, Sol implements.

## 10. A5a implementation result — Sol, 2026-10-06

Implementation started from `f8907b5`, after the plan/docs commits. Checkpoints:

| Commit | Result | Checks |
|---|---|---|
| `7897e8e` | Generator printer, glyph tiles, persistent bottom-third display, legacy compatibility | 937/937, typecheck |
| `9cebc1e` | Shared strict decoder, map controls/prompts, regenerated data, battle token compatibility | 948/948, typecheck; setup twice byte-identical |
| `94625a0` | DisplayTextID / PrintText wrappers, map and trainer callers, printer-owned input | 963/963, typecheck |
| Final checkpoint | Subsystem/context documentation and validation handoff | 963/963; no-ROM 878 pass / 85 skip; typecheck/build clean |

Data diff: eight strings gain `<PROMPT>` in Route1, ViridianCity, ViridianPokecenter
and ViridianForest (mirrored in static/); no other data or PNG changes. All 857 generated
files match across two setup runs. `game_text.json` SHA256 remains
`d3e4aa2ae5e9edfd1e3e1643c30a8b1519f9520606a8d5c467271808443bf643`.
The leading TX_START byte is explicitly skipped; unmapped bytes inside strings fail
with their ROM address. All current extracted map text is checked against pret's macros.

The source timing audit also keeps Joypad's zero-counter read and avoids reads during
ProtectedDelay3 / scroll / sound waits. Retained script text advances the BG transfer
once per frame across recursive script commands. Existing 73/181 jingle close traces pass
unchanged. DisplayTextID appears at render T+3 / scanout T+4 and first writes a glyph
at T+20 (trainer nested PrintText T+23); the next bottom-third transfer displays it.

Agent browser smoke on isolated `127.0.0.1:5183`, with real keyboard input:
- Forest sign: paragraph clear, two cont scrolls, final silent wait, A hold/release.
- Forest youngster1: single-tile `'r` in "They're", paragraph and B close.
- Forest Lass, talked to: music at text return, fresh A and release before battle.
- Forest youngster2, spotted: "!" / three-step approach, cont, silent end and battle.
- Item ball: Potion given, jingle and automatic close.
- Script regressions: Route1 Potion sample through its final sound/button wait;
  Viridian's sleeping old-man text through the downward push.
- No browser runtime errors; screenshots inspected for layout, contractions and arrow.

Browser hooks live only in a temporary served-module interception, outside the repo;
the isolated save origin is cleared after the smoke. The user's :5173 save is untouched.

Accepted limits remain: 30/30 blink default, shared transfer phase approximate until
menu/battle integration, exact CloseTextDisplay sprite reload / trailing UpdateSprites
in A5b, battle printer in A5c, and species display names in V5. Later A5 slices are
not implemented here. **Next: Claude review, then §7's user play-test. A5a stays open.**

**User-verified 2026-10-06** after Claude's review (`notes/22-a5a-review.md`): "it all runs well". A5a is done.
