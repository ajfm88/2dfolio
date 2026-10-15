# A5b5c plan: review fixes, BUG-1, the yes/no menu, the nurse, cleanup

**2026-10-12 · Claude (Opus 5.5), planning only. Sol (GPT-6.1) implements; Claude reviews in
`notes/36-a5b5c-review.md` once the user says Sol is done; then the user play-tests. Status: approved
2026-10-12 (O-21, DECISIONS #50): one slice, BUG-1 in the extractor, the healing machine in its own slice.**

Parent plan: `notes/32-a5b5-plan.md` (DECISIONS #49), whose §3.4 and §6 CP5–CP6 sketched A5b5c. This note
replaces that sketch. It also takes in the three open items from the last session: the two A5b5b review
fixes (`notes/34-a5b5b-review.md` F-1, F-2) and BUG-1 (STATUS → *Open questions*).

## TL;DR

Five checkpoints, one slice:

1. **CP1, review fixes.** Oak no longer turns his back during the choose-mon speech (F-1). The Lab
   restores its own music, not the Pokécenter theme (F-2).
2. **CP2, BUG-1.** Root cause found. The overworld-sprite extractor reads the sprite table's size byte
   (`tiles × 16`, a byte count) as a tile count. Every sprite PNG is 16 times too tall: walkers are 16×768,
   still sprites (item ball, fossil, boulder…) are 16×256. The renderer's "still sprite" test
   (`height < 32`) therefore never fires. A Poké Ball that turns at random (STAY/NONE) draws whatever
   16×16 block its facing selects, and in ROM order the next two pictures after the ball are the
   **fossil** and the **boulder**: exactly what the user saw. Fix the extractor (24 tiles for a walker,
   4 for a still sprite), regenerate, and test against pret's PNGs.
3. **CP3, the yes/no menu's timing.** I missed this in the A5b5a review. `DisplayTwoOptionMenu` and
   `HandleMenuInput` wait 3 frames before the first read (and after any other key), and **15 frames
   after the choice** with the menu still on screen. Today's `yesNoChoice` reads on the first tick and
   resolves at once. It is shared by the caterpillar youngster, old man 1 and the nurse.
4. **CP4, the nurse (D12)** on the display session, from `engine/events/pokecenter.asm`:
   - one display and the source programs (the two `text_pause`s included)
   - the first-visit flag (`BIT_USED_POKECENTER`), so "Shall we heal" shows only the first time
   - the box disappearing where the cartridge calls `LoadCurrentMapView`
   - the outer wait, then the Pokécenter close (17)
   - dispatch by the generated `script` call kind, not by NPC id

   A6e's Pikachu calls, waits and heal stay as they are.
5. **CP5, cleanup.** Retire the commands this slice leaves dead, update the A5b1 consumer inventory, docs.

The healing machine's internals (fade-out, `SFX_HEALING_MACHINE`, the healed jingle, the flash) stay out.
They need a music fade-out the engine does not have. §10 asks where they should go.

## 1. Deliverable and boundary

**In:** the five checkpoints above, each a local commit with green gates. **Out:** the healing-machine
internals (§9), the receptionist/PC/shop/save (A5b7), notebook/Town Map/Oak's speech (A5b6), cries (J2),
Pewter's Pokécenter branch (V2), `PrintText`'s and the menu's own `UpdateSprites` (J2, as in note 32 §9).

## 2. What exists (read this session)

- `overworld/overworld_controller.ts:495-565` `buildNurseScript`. This is A6e's nurse: legacy `text`
  commands, the legacy `yesNo` with a message, `uiEntryUpdates` off/on, `pikachuFacing` save/restore and
  the Pikachu calls. It is dispatched at `:281` by `npcData.id === 'nurse'`.
- `script/script_controller.ts:244` (the `scriptChoice` branch) and `:527` (`yesNoChoice`), `menus/yes_no_menu.ts`.
- `rom/extractors/graphics.ts:372-406` `extractOverworldSprites`; `overworld/npc.ts:227` `isStatic`.
- `rom/extractors/map_sprite_sets.ts:243-256` (A5b2) already reads the same size byte correctly
  (`swapNibbles`: `$c0` → 12, `$40` → 4) and classifies each picture as walking or still.
- `story/oaks_lab.ts:18` (`mapMusic`), `:27` (F-1). `ScriptDeps.restoreMapMusic` (A5b5a, `main.ts:1342`).
- Text programs (all extracted): `PokemonCenterWelcomeText` (ends `<PROMPT>`),
  `ShallWeHealYourPokemonText` (`pause`, then the text), `NeedYourPokemonText`,
  `PokemonFightingFitText` (`<PROMPT>`), `PokemonCenterFarewellText` (`pause`, then the text).
- Generated call table: `ViridianPokecenter` text 1 is `{call: 'script', script: 'pokecenterNurse'}`.
- No `USED_POKECENTER` state exists anywhere today; event flags are a saved `Set<string>` (`events.ts`).

## 3. Findings and cartridge flows (re-verify each before coding)

### 3.1 F-1 and F-2 (from note 34; unchanged)

- **F-1.** `OaksLabOakChooseMonSpeechScript` writes `wSprite01StateData1MovementStatus = 2` and
  `wSprite01StateData1FacingDirection = SPRITE_FACING_UP`. Sprite 1 is the **rival**: `object_const_def`
  starts at 1 with `OAKSLAB_RIVAL` (`data/maps/objects/OaksLab.asm`). Oak (`OAKSLAB_OAK1`, sprite 3) keeps
  facing down. `oaks_lab.ts:27` turns `prof_desk` up instead.
- **F-2.** `PlayDefaultMusic` restores the map's own song. `data/maps/songs.asm:43` gives `OAKS_LAB` →
  `MUSIC_OAKS_LAB`, and `main.ts` maps `OaksLab: 'oakslab'`. `oaks_lab.ts:18` plays `'pokecenter'` at
  four places (after the speech, after the rival's exit, and twice in the Pokédex scene).

### 3.2 BUG-1: still sprites draw the next pictures in ROM

Evidence, all in `refs/pokeyellow/`:

- `data/sprites/sprites.asm:1-5`: `overworld_sprite` stores `db \2 tiles`, and `macros/gfx.asm:16` defines
  `tiles` as `* TILE_SIZE`. The third byte is therefore a **byte count**: `$c0` for a 12-tile walker, `$40`
  for a 4-tile still sprite.
- `graphics.ts:382-387` treats that byte as a tile count. It reads 192 tiles for a walker (16×768) and
  64 for a still sprite (16×256). The committed PNGs have exactly these sizes (`static/gfx/sprites/poke_ball.png`
  16×256, `youngster.png` 16×768).
- `engine/overworld/map_sprites.asm:171-191`: a walker's standing half is the 12 tiles at the address,
  and its walking half is `LoadWalkingTilePattern`'s 12 tiles at `+$c0`. A still sprite is 4 tiles.
  What the cartridge can ever show is therefore 24 tiles (16×96) or 4 tiles (16×16).
- `gfx/sprites.asm:21-23`: in ROM, `PokeBallSprite` is followed by `FossilSprite`, then `BoulderSprite`.
  Rows 16–31 of today's `poke_ball.png` are the fossil, and rows 32–47 the boulder.
- `engine/gfx/sprite_oam.asm:41-49` (`PrepareOAMData`): an image index `≥ $a0` (a still-sprite VRAM
  slot) always uses table entry 0, which is facing down and not flipped. The facing and the animation
  are ignored. `npc.ts:227` meant to do the same (`isStatic = height < 32`) but never fires on a 256-pixel sheet.
- Why "sometimes": the Forest balls are `STAY, NONE`, so they turn at random, as the cartridge does and
  as A6 implemented (`overworld_controller.test.ts:437`). Facing up selects rows 16–31 (fossil), and
  facing left or right selects rows 32–47 (boulder, flipped for right). The Lab's Eevee ball, the Pokédex
  objects and the sleeping gambler are exposed the same way.
- **History:** R1a found the oversize (`notes/01-r1a-graphics-export.md`, `context/ARCHITECTURE.md`) and called it
  harmless ("no frame ever indexes the garbage"), with a trim proposed for V5. That holds for walkers but not for
  still sprites, whose facing rows reach past the picture. DECISIONS #50 moves the overworld-sheet trim here; the
  padded tileset reads stay in V5. R1a also notes an existing pret pixel check (`extraction.test.ts`, pret's
  `pikachu.png`) that CP2's test can reuse.
- Pret's own PNGs show the layout to expect: 45 are 16×96, 23 are 16×48 (standing only: mom, clerk,
  gramps…), nurse is 16×64 (standing plus the bow frame), and 10 still sprites are 16×16. For the 16×48 and
  16×64 ones, the cartridge's walking half (`+$c0`) is the bytes that follow in ROM. The extraction must
  keep that: always 24 tiles for a walker, never pret's file height.

### 3.3 The two-option menu (`YesNoChoice`, `YesNoChoicePokeCenter`)

Sources: `home/yes_no.asm:1-40`, `engine/menus/text_box.asm:205-310` (`DisplayTwoOptionMenu`),
`home/window.asm:1-119` (`HandleMenuInput_`), `home/joypad2.asm:16-53` (`JoypadLowSensitivity`).

1. The caller's text returns. `SaveScreenTilesToBuffer1`, then the menu box, `UpdateSprites` (J2, as for
   `PrintText`) and the strings, all in the same tick. A5b5a already draws it then.
2. `HandleMenuInput_`: `PlaceMenuCursor`, then **`Delay3`**: three frames with no read.
3. One read per frame (`JoypadLowSensitivity` with `hJoy7 = 0`: newly pressed buttons only). Up or Down
   moves the cursor without wrapping. **Any newly pressed key other than A or B** (Up, Down, Left, Right,
   Start, Select) goes back to step 2: re-place the cursor and `Delay3`.
4. A or B: `SFX_PRESS_AB`. B always chooses the second option. Then **`DelayFrames 15` with the menu and
   cursor still drawn**.
5. `TwoOptionMenu_RestoreScreenTiles`, then `LoadScreenTilesFromBuffer1` restores the whole saved screen
   in the same tick. The menu disappears and the text box shows the text it had. Control returns to the caller.

Today (`script_controller.ts:244`), the first read happens on the tick after the menu appears. The
answer resolves on the press tick, and the next command runs at once (no 15 frames). There is no `Delay3`
after the cursor moves. `display_commands.test.ts:38-51` pins that behaviour.

### 3.4 The nurse: `DisplayTextID` → `DisplayPokemonCenterDialogue` → `AfterDisplayingTextID`

`home/text_script.asm:168-177` jumps straight to `AfterDisplayingTextID`, so the outer wait always runs
here (`wDoNotWait…` is not consulted). `ViridianPokecenter_Script` enables the automatic box. W = 6, so
the close is **17**.

| Step | ASM (`engine/events/pokecenter.asm`) | Here |
|---|---|---|
| 1 | `DisplayTextIDInit` (20 frames, border, UpdateSprites, facings copied) | `displayOpen` |
| 2 | (Pewter check: not on today's maps) | tripwire (§4.4) |
| 3 | `SaveScreenTilesToBuffer1`; `PrintText Welcome` (new box, +3; ends `<PROMPT>`) | `printText`; first glyph **+23** |
| 4 | test `BIT_USED_POKECENTER`, then **set it** (and `BIT_UNKNOWN_4_1`) | flag set right after Welcome returns, even on a later decline |
| 5 | first use only: `PrintText ShallWeHeal` (new box, +3, `pause` = one read, 30 frames unless A/B held, text) | `printText` |
| 6 | `YesNoChoicePokeCenter` (§3.3; HEAL/CANCEL at (11, 6)) | `yesNoChoice {pokeCenter}`; on later visits the menu appears over Welcome's second page |
| 7 | `UpdateSprites` (**both** answers; the box is still up) | today's NO branch lacks it |
| 8y | `SetLastBlackoutMap` | `onHeal` (`main.ts` `onPokecenterHeal`) |
| 9y | Pikachu alive and following: `LoadCurrentMapView` (**box gone**), `Delay3`, `UpdateSprites`, `PikachuWalksToNurseJoy` | A6e's calls, plus the box hide |
| 10y | `PrintText NeedYourPokemon` (new box, +3); `DelayFrames 64` | text stays up through the machine |
| 11y | Pikachu following: disable drawing; alive: `Func_6eaa` (nurse up, 64) | A6e, unchanged |
| 12y | `Func_6ebb(1, 8)` (nurse left: 6 frames, image); `DelayFrames 30`; `AnimateHealingMachine`; `HealParty`; map music | `pokecenterHeal` as today (§9) |
| 13y | Pikachu: `Func_6eaa`, spawn state 5, enable drawing; `Func_6ebb(1, 0)` (nurse down) | A6e, unchanged |
| 14y | `PrintText FightingFit` (new box, +3; `<PROMPT>`) | `printText` |
| 15y | alive: `Func_6ebb(15, 0)` (Pikachu stands down) | A6e |
| 16y | `LoadCurrentMapView` (**box gone**), `Delay3`, `UpdateSprites`, `ReloadWalkingTilePatterns`, bow (image $01) `DelayFrames 40`, `UpdateSprites`, `LoadFontTilePatterns` | the bow as today, with the box hidden |
| 8n | `LoadScreenTilesFromBuffer1`: restores the pre-menu screen (the menu has already gone at step 6) | nothing visible |
| 17 | `.done`: `PrintText Farewell` (new box, +3, `pause`, text); `UpdateSprites` | `printText`; `updateSprites` |
| 18 | `AfterDisplayingTextID`: outer silent wait, Hold, `CloseTextDisplay` (facings restored at its first frame; 17 frames; trailing `UpdateSprites`) | `displayClose {outerWait: true}` |

Departures from today that this removes:
- "Shall we heal" is asked on every visit. The cartridge asks only on the first visit.
- The farewell is typed in TypeScript, and both `pause`s are missing.
- Each text is a separate box that closes. The cartridge keeps one display; the "OK. We'll need your
  POKéMON." box stays up during the machine, and the box disappears only at the two `LoadCurrentMapView`s.
- The NO answer misses its `UpdateSprites`.
- There is no outer wait or exact close.
- The nurse is found by NPC id rather than by her text call.

## 4. Design

### 4.1 CP1: F-1, F-2

- **F-1.** Replace `faceNpc prof_desk up` with `faceNpc rival up` (faithful; no visible change), or drop it.
  Add a test that `labChooseSpeech()` never turns `prof_desk`.
- **F-2.** Replace `mapMusic`'s hard-coded name with a script step that calls `deps.restoreMapMusic`. A small
  `restoreMapMusic` command (or reuse of the healing command's restore path) is fine; no new name list.
  Add a test that restoring in `OaksLab` asks for `oakslab`, plus a browser check (§6).

### 4.2 CP2: BUG-1

- **Extractor.** In `extractOverworldSprites`, take the tile count from the size byte the way A5b2 does
  (`byte / 16`, or `swapNibbles`, shared, not copied). Classify each picture with the same rule A5b2 uses
  (Pikachu walking; `id ≥ FIRST_STILL_SPRITE` still). A walker reads **24 tiles**: the 12 standing tiles
  and the 12 at `+$c0`, which are contiguous. A still sprite reads **4**. Fail loudly if the size byte
  disagrees with the kind.
- **Regenerate** (`npm run setup pokeyellow.gbc`, twice; second run byte-identical). Every overworld sprite
  PNG changes size: walkers become 16×96 with rows 0–95 unchanged; still sprites become 16×16 with
  rows 0–15 unchanged. No other generated file may change.
- **Renderer.** With correct data, `height < 32` is the cartridge's rule (still slot → entry 0, no flip). Make it
  explicit: a sheet is either 16 or 96 tall; a 16-tall sheet always draws rows 0–15 unflipped, whatever the
  facing, walk frame or `useWalkFrame`. Any other height is a load error, not a guess.
- Party icons (`BALL`/`HELIX` read `poke_ball.png` row 0) and every walker frame used today (≤ row 95) are
  unaffected. Confirm that with a grep and say so in the result.

### 4.3 CP3: the yes/no menu

Implement §3.3 in the shared `yesNoChoice` path (`YesNoMenu` and the `scriptChoice` branch):

- the menu appears on the text's return tick (as today)
- 3 frames without a read before the first one
- after any newly pressed key other than A or B, 3 frames without a read
- on A or B: the SFX, then 15 frames with the menu and cursor drawn and no reads
- on the 15th frame's tick: the menu is removed and the chosen branch's first command runs in that tick

Keep the A5b5a "actual Joypad read" accounting. The legacy `yesNo` (the school notebook, A5b6) is not
changed. Re-derive §3.3 yourself first; if a loop count differs, stop and tell me.

### 4.4 CP4: the nurse

- **Dispatch.** Add a registry for `script` call kinds next to the handler registry
  (`registerTextScript('pokecenterNurse', builder)`). The controller looks it up from the generated call
  (`mapTextCall(...).call === 'script'`), so V2's Pewter Pokécenter gets the nurse without an id check.
  Remove the `npcData.id === 'nurse'` branch.
- **Builder.** Build it from §3.4: `displayOpen`, then `pikachuFacing save` right after the opening (it is
  `DisplayTextIDInit`'s copy), the five programs, the flag, `yesNoChoice {pokeCenter}`, and A6e's Pikachu
  and nurse steps with their waits unchanged. Use `displayClose {outerWait: true}`.
  - The shared `updateSprites` comes after the menu, in both branches.
  - `onHeal` is in the YES branch only, after that update.
- **The flag.** Use one saved flag, `USED_POKECENTER` (comment it as `wStatusFlags4` `BIT_USED_POKECENTER`), set
  where §3.4 step 4 says. `BIT_UNKNOWN_4_1` is never read; do not add it.
- **Box hide** (`LoadCurrentMapView`). Add a session operation and command that removes the box and any menu
  while the display stays open. It draws nothing at rows 12–17 and covers no UI tiles, so sprites there
  draw again. The next `printText {box: 'new'}` brings the box back with its clear and 3 frames. Use it
  at §3.4 steps 9y and 16y.
- **Sprite updates.** The script's `updateSprites` must see the UI that is really on screen: the box's
  coverage after the menu (step 7) and at step 17, none after a box hide. Today it always passes "no UI".
- **Inside the display, nothing reads the joypad except the text, the menu, the outer wait and Hold.**
  In particular, `pokecenterHeal` must not `syncJoypadRead` during the session. A press held through
  the machine must still count as new at the "fighting fit" prompt, as `Joypad` would see it.
- **Facing restore.** `CloseTextDisplay` restores the facings at its first frame, before the trailing
  `UpdateSprites`. Keep A6e's `pikachuFacing restore`, but make it take effect in the close, before the
  trailing update. Putting it immediately before `displayClose` is acceptable only if a test shows that
  Pikachu's drawn image does not change until that trailing update.
- **`uiEntryUpdates`.** It is no longer needed: one display means one opening update, and `PrintText`'s
  own update is J2. Remove both commands from the builder.
- **Tripwire.** If a map named `PewterPokecenter` exists in `data/maps`, a test fails with "add the
  `LooksContentText` branch (pokecenter.asm:2-9), V2". Do not implement the branch.

### 4.5 CP5: cleanup

- Remove commands with no production caller left: `exclamation` (with `scriptExclamation` and its render
  fallback) and `uiEntryUpdates`.
- Keep `text`, `yesNo`, `textButtonWait` and `closeText`. Their last callers move in A5b6/A5b7 (the
  notebook, the PC in `main.ts`, the hidden-item full bag, the A5a tests). List them as legacy, with
  those homes, in `script/` or `story/ARCHITECTURE.md`.
- `notes/24-a5b1-text-data.md` §4 and §5: mark the A5b5 rows done (with the slice that moved each), and
  move the A5b5 TypeScript literals row to done. The `game_text` keys stay in the JSON.
- Correct the census label `ViridianPokecenter:4`. That is the **cable club receptionist**
  (`cableClubReceptionist`), not a PC. It has no home yet; log it in STATUS *Notes for later*
  ("link features: needs a user decision") rather than inventing one.
- Docs: `story/ARCHITECTURE.md` (the nurse line at :129 is stale), `text/ARCHITECTURE.md`, `CONVENTIONS.md`
  test suite, root `CLAUDE.md` baseline, STATUS.

## 5. Checkpoints and gates

Gates at every checkpoint:
- `npm run typecheck`
- `ROM_PATH=pokeyellow.gbc npm test` (in PowerShell: `$env:ROM_PATH='pokeyellow.gbc'; npm test`)
- the no-ROM run
- `npm run build`
- `git diff --check` and a clean `git status`
- for CP2 only, also setup twice, with the second run byte-identical

Stage specific paths. Never commit edits you did not make (an editor's formatter has reformatted `STATUS.md`
before; `STATUS.md` currently has mixed CRLF/LF endings, so don't normalise it in passing).

| CP | Commit | Must show |
|---|---|---|
| CP1 | F-1, F-2 | the two tests; Lab's restored music is `oakslab` |
| CP2 | BUG-1 extractor + regenerated `static/` + renderer rule | PNG sizes; pixel check against pret; still-sprite render test |
| CP3 | menu timing | §3.3 frame tests; caterpillar and old man 1 updated with reasons |
| CP4 | nurse | §6 flow tests; census entry moves to "registered" |
| CP5 | cleanup + docs + result | no dead command left; inventory updated |

## 6. Tests and the browser smoke

**CP2 (ROM suite):**
- every overworld sprite is 16×96 (walking) or 16×16 (still), by A5b2's kind
- each PNG's first `min(pretHeight, 96)` rows equal pret's `gfx/sprites/<name>.png`, decoded to shades.
  If the test PNG decoder cannot read pret's grayscale files, compare the dimensions and the first frame,
  and say so.
- a 16×16 sheet renders rows 0–15 unflipped for all four facings and for walk frames
- a mutation (reading 64 tiles again) fails the size test

**CP3:**
- the menu draws on the return tick
- no read for 3 frames, then one read per frame
- a Down press re-arms 3 no-read frames
- A gives the SFX, then the menu stays visible for 15 frames with no reads, and the branch's first
  command runs on the 15th frame's tick
- B always gives the second option
- update the caterpillar and old man 1 traces with these numbers

**CP4 nurse flow tests** (table-driven, from §3.4):
- **first visit, YES (no Pikachu):**
  - the five programs, in order
  - first glyph +23
  - the flag is set before "Shall we heal"
  - the menu appears on its return tick; §3.3 timing
  - the update after the menu uses the box's coverage
  - `onHeal` is called after that update
  - "need your POKéMON" stays visible through the machine
  - the box is hidden at step 16y and reappears at the farewell with +3 and the 30-frame pause
  - outer wait, Hold, close 17
  - party healed
- **second visit, YES:** no "Shall we heal"; the menu sits over Welcome's second page.
- **NO:** no heal and no blackout change; the shared update; then the farewell and the close.
- **Pikachu following and alive:** A6e's walk, hops and stand-down unchanged, plus the box hidden for the walk.
- **Fainted starter** (A6e R-1): unchanged.
- **A held:** A held at the farewell skips its pause; A held through the machine still registers at
  "fighting fit".
- The Pewter tripwire, and the census.
- All existing A6e/Pikachu nurse tests pass unedited unless §8 lists them.

**Browser smoke** (required; spare port, isolated profile, muted; no product debug hooks; record ticks):
- **Pokécenter:** first visit YES, second visit YES, NO, and a visit with Pikachu following (first glyph,
  menu read delays, the 15-frame tail, box hidden during the bow, close 17, zero console errors)
- **Viridian Forest:** watch each item ball for at least 600 frames (it must stay a ball as it turns), and
  the Lab's Eevee ball the same way
- **Lab:** the music after the speech is `oakslab`; Oak faces down through the speech
- **Viridian:** the caterpillar youngster's YES and NO, with the 15-frame tail

**User play-test (after the review; A = Z, B = X):**
- Viridian Forest's balls
- the Lab's theme and Oak's facing
- a Pokécenter first visit (new save, or a save that never healed), a second visit, and CANCEL
- the caterpillar youngster's YES and NO

## 7. Mutation checks (at least four, in memory)

- a still sprite drawn with its facing's rows
- the 15-frame tail removed
- the initial `Delay3` removed
- "Shall we heal" shown on a second visit
- the box left up during the bow
- `onHeal` on NO
- the outer wait dropped
- the Lab's restored music hard-coded again

## 8. Existing tests expected to change (each with its cartridge reason; do not loosen)

- `script/display_commands.test.ts:38-51`: the yes/no reads after `Delay3` and returns after 15 frames (§3.3).
- The caterpillar and old man 1 traces in `story/small_text_handlers.test.ts` and `story/viridian_city.test.ts`,
  if they pin menu frames.
- `story/oaks_lab.test.ts` for F-1/F-2.
- Extraction and static-export fixtures, if they pin a sprite PNG's size or hash.
- The census exclusion list (`ViridianPokecenter:1` becomes registered; `:4`'s label is corrected).
- `overworld_controller.test.ts:538` only if it uses the removed `uiEntryUpdates`. It must keep proving
  "the update ends the bounce".

Anything else that fails is a regression: stop and report it.

## 9. Not in A5b5c, each with a home

| Finding | Home |
|---|---|
| `AnimateHealingMachine`: music fade-out (`wAudioFadeOutControl`; the engine has none), `SFX_HEALING_MACHINE` per ball, `MUSIC_PKMN_HEALED` with 8 × 10-frame OBP1 flashes, the wait, 32 frames, then `HealParty` and the map-music restore. Today it is silent, flashes 16 × 10 frames and heals inside the animation. | its own slice, after A5b7 and before V2 (DECISIONS #50) |
| `PrintText`'s and `DisplayTwoOptionMenu`'s own `UpdateSprites` | J2 (note 32 §9) |
| Pewter's `LooksContentText` branch | V2 (tripwire in CP4) |
| Chansey cry, the receptionist (cable club), the Pokécenter PC | J2, unplanned (user), A5b7 |
| Legacy `text`/`yesNo`/`textButtonWait`/`closeText` | A5b6, A5b7 |
| Walking-half bytes for 16×48 pictures (the next sprite's tiles) are now extracted faithfully but never drawn on today's maps | none needed |

## 10. Decisions (O-21) — **resolved 2026-10-12 (DECISIONS #50): 1 yes, 2 yes, 3 its own slice, 4 yes**

1. **One slice with five checkpoints** (fixes, BUG-1, menu timing, nurse, cleanup), reviewed once.
   Recommended: **yes**. Each piece is small, and the play-test covers all of them in one sitting.
   Alternative: CP1–CP3 as a quick fix slice first, then the nurse and cleanup.
2. **Fix BUG-1 in the extractor and regenerate the sprite PNGs.** Recommended: **yes**. The data is wrong
   today, and generated data is never hand-edited. Alternative: a renderer-only fix (always draw the
   first 16×16 block of still sprites by name), leaving 16×-oversized files in `static/`.
3. **The healing machine.** It is silent today, and its timing and heal order differ. Recommended:
   **give it its own slice after A5b7 and before V2** (V2 adds the second Pokécenter). It needs the
   music fade-out, which the Hall of Fame and others will also use. Alternative: leave it in J2 as decided
   in #39.
4. **Who:** Sol implements, Claude reviews (`notes/36-a5b5c-review.md`), and the user play-tests afterwards
   (assumed, as before).

## 11. Handoff for Sol

> Implement **A5b5c** from `notes/35-a5b5c-plan.md`; the user approved it (O-21, DECISIONS #50). Claim it in
> `context/STATUS.md` → *In progress* with your model name and the date.
>
> Before each checkpoint, **re-read the ASM it cites and re-derive the sequence.** If anything here
> disagrees with the disassembly, stop and tell the user. The likeliest places are the menu loop counts
> (§3.3) and the order of steps 7–9 (§3.4).
>
> Do not touch the audio engines, A6's movement or Pikachu programs, the A5a printer's timing or the A5b4
> close, except where this note says so. Many files under `game/src` are CRLF: use the Edit tool for
> multi-line changes and run `git diff --check`. Stage specific paths. Never push.
>
> At the end, write the **Implementation result** at the bottom of this note:
> - commits and counts
> - every §8 test edit with its reason
> - the browser numbers
> - the mutations you ran
> - what you confirmed or disproved in §3
> - anything that surprised you
>
> Update `CONVENTIONS.md` (test suite), the subsystem ARCHITECTURE docs, root `CLAUDE.md` (baseline only)
> and STATUS. Then stop for Claude's review.

## Planning verification (what I read and ran; no repository file changed except this note and STATUS)

- **Read:**
  - `engine/events/pokecenter.asm` (whole)
  - `home/text_script.asm:85-177` (`AfterDisplayingTextID`, `CloseTextDisplay`, the nurse dispatch)
  - `home/yes_no.asm`, `engine/menus/text_box.asm:205-330`, `home/window.asm:1-140`
  - `home/joypad2.asm:16-53`, `home/window.asm:281-292` (`PrintText`)
  - `engine/menus/display_text_id_init.asm` (the facing copy)
  - `engine/gfx/sprite_oam.asm:1-80`, `engine/overworld/map_sprites.asm:171-206`
  - `engine/overworld/healing_machine.asm`
  - `data/sprites/sprites.asm`, `gfx/sprites.asm`, `macros/gfx.asm`
  - `data/maps/objects/ViridianForest.asm`, `OaksLab.asm` (objects)
  - In the code: `buildNurseScript` and its dispatch, the script controller's `yesNoChoice`, `pokecenterHeal`,
    `updateSprites`, `pikachuFacing` and `uiEntryUpdates`, `YesNoMenu`, `TextBox` open/print/finish/render,
    `ui_entry.ts`, `graphics.ts` `extractOverworldSprites`, `map_sprite_sets.ts` picture metadata, `npc.ts`
    render, `story_state.ts`, `events.ts`, the census and yes/no tests, and note 24 §4–§5.
- **Ran:**
  - the sizes of the committed sprite PNGs (still 16×256, walkers 16×768) and of pret's 79 (45 × 16×96,
    23 × 16×48, nurse 16×64, 10 × 16×16)
  - the extracted nurse programs
  - the Pokécenter call table
  - a grep for remaining legacy command callers
- **Not run:** typecheck, tests, build, setup, browser. The BUG-1 cause is confirmed from the data and the
  source. Everything else in §3 is my reading of the ASM for Sol to confirm.

## Implementation result — Codex / Sol, 2026-10-12

**A5b5c is implemented and stops here for Claude's review in
`notes/36-a5b5c-review.md`.** All five checkpoints have local commits. A5b6,
A5b7 and the separate healing-machine slice have not started. No push.

| Checkpoint | Commit | ROM suite | No-ROM suite | Gates |
|---|---|---|---|---|
| CP1 review fixes | `94555e5` | 1154/1154 | 1034 pass / 120 skip | typecheck, build, diff check, muted Lab |
| CP2 BUG-1 | `659ef0a` | 1163/1163 | 1040 pass / 123 skip | typecheck, build, diff check, setup twice |
| CP3 menu | `4f632fd` | 1179/1179 | 1056 pass / 123 skip | typecheck, build, diff check |
| CP4 nurse | `f07f6c7` | 1195/1195 | 1072 pass / 123 skip | typecheck, build, diff check |
| CP5 cleanup/result | Commit containing this result | 1195/1195 | 1072 pass / 123 skip | typecheck, build, diff check, full muted browser |

Started from clean `e5b43ef`, the approval commit. Final suite: **60 files, +43
tests** (2 Lab review regressions, 3 ROM sprite tests, 6 NPC renderer tests,
12 menu tests, 4 real caller traces, 16 nurse tests). Build: **121 modules,
342.07 kB JS**. A concurrently run CP1 ROM comparison timed out once; the
unchanged full suite passed immediately when run alone. No timeout increase
or weakened comparison. Later checkpoint suites ran sequentially.

**§3 confirmed against the ASM before each checkpoint.**

- F-1: sprite 1 is the rival, not Oak. The choose speech now turns the rival
  up and never turns prof_desk; Oak stays down. F-2: all four default-music
  sites use a `restoreMapMusic` command through the existing live map callback.
  Its Lab table entry is `oakslab`. Source object order, script and songs agree;
  a muted browser checks the result, and note 32 records the follow-up.
- BUG-1: the table stores a **byte count**, `$c0`/`$40`, rather than a tile
  count. Shared `readSpritePictureMetadata` preserves A5b2's size/class
  validation for both extractors. Walkers decode 24 contiguous tiles, including
  the half at +$c0; still sprites decode four. Every NPC sheet must be 16/96
  tall or loading throws. Still pictures draw row 0 unflipped for all four
  facings and both walk settings, matching PrepareOAMData entry 0.
- Menu: Delay3 returns into the first Joypad read at **opening +3**; idle
  polls once per frame. Every newly pressed non-A/B key re-arms three frames.
  A/B plays the sound, B selects/draws the second item, and the menu/cursor
  remain for **15** frames without reads. On the 15th tick the menu is gone
  and the selected branch begins. Legacy notebook `yesNo` timing is unchanged.
- Nurse: Welcome returns before setting saved **USED_POKECENTER** (even on
  NO). Only a first visit prints ShallWeHeal. The menu's shared UpdateSprites
  sees the restored box; only YES then records the blackout map. Source
  LoadCurrentMapView sites hide the box before Pikachu walks and before the
  bow. NeedYourPokemon stays visible through the existing machine. Farewell
  includes its extracted pause and UpdateSprites, then outer wait/Hold and
  the full **17-frame close**, W=6 in `5 + 2W`. A6e's actual 69-frame nurse
  movement, 64/6/30 waits, 40-frame bow and fainted-slot behavior remain.

The nurse now lives in `story/pokecenter.ts` and registers the generated
`pokecenterNurse` script kind beside the handler registry. Dispatch no longer
checks NPC id. First-use state uses the existing saved flag set; the unused
BIT_UNKNOWN_4_1 was not added. `displayHide`/`TextBox.hideDisplay` retain one
screen/session, remove all box coverage, and let the next new PrintText restore
the border with Delay3. Explicit sprite updates use the box's current logical
coverage rather than a stale rendered menu or a hard-coded empty UI. Saved
Pikachu live facing is deferred until close start, after outer wait/Hold;
its cached drawn image remains unchanged until the trailing sprite update.
Migrated machine waits do not synchronize Joypad. Map music restores through
the existing callback after the machine; its internal animation/heal code is
unchanged. Tests cover the exact +3/+33 farewell glyph timing depending on
held A, and a held A surviving a machine wait with no input reads.

**Generated-data verification.** Setup changed exactly **76 overworld PNGs**.
Every retained pixel equals the previous sheet; every available pret row
matches pixel-for-pixel, including all standing-only sheets and the nurse's
64-pixel bow sheet. The PNG decoder reads pret's grayscale files, so no
fallback comparison was needed. The other **793 generated files** are
unchanged (JSON, tilemaps and other images). The second setup is byte-identical
across all **869** files. Party BALL/HELIX use poke_ball row 0; player/NPC/Pikachu
walking frame offsets remain 0/16/32/48/64/80, all within the retained 96 rows.
No generated file was hand-edited; no runtime ROM dependency.

**Existing-test edits, each with its reason.**

- `story/oaks_lab.test.ts`: two new F-1/F-2 regressions; checks all four restore
  sites, actual callback dispatch, current map table and Oak/rival facing.
  The retired-exclamation tripwire uses a string list after that command leaves
  the union, preserving its runtime assertion.
- `script/display_commands.test.ts`: the two YES/NO traces now pin first read
  +3, no branch during the 15-frame tail, no tail reads, and branch start on
  the 15th frame. Original retained-box and selected-branch assertions remain.
- `story/small_text_handlers.test.ts`: census text calls can be registered as
  handlers **or script kinds**. Nurse :1 becomes registered; :4 is correctly
  deferred as the cable-club receptionist needing a user decision. The same
  30-object count and registered-versus-excluded XOR remain.
- **Fixture exception to §6/§8:** `overworld/overworld_controller.test.ts`'s
  `healScript()` explicitly searched for legacy `yesNo`, then used a fake
  textbox with only show/update/dismiss. A migrated builder cannot run through
  that fixture unchanged. Only this helper now selects `yesNoChoice` and
  converts programs/display commands to its old quick-text adapter; all
  original healthy/fainted/no-starter movement, facing, HP and timing assertions
  below it are **unchanged**, including the 69-frame walk. The new nurse tests
  exercise actual sessions instead. All **67 controller tests** pass. This
  fixture adaptation was announced during implementation and is recorded
  explicitly rather than treating an obsolete test API as a behavior regression.
- `story/pallet_town.test.ts`: its retired-command tripwire likewise switches
  to string-list membership after deleting the command type. No assertion or
  movement vector changes. Extraction/static-export fixtures and existing
  small-handler/Viridian builder tests needed no timing changes; the latter
  did not pin menu frames. Four new caller traces cover both real YES/NO branches.

**Five in-memory mutation checks actually run.** Reintroducing the old 64-tile
still decode produces height 256 and fails the size assertion. Treating a
still sheet as a walker reaches the facing row and fails row-0/no-flip rendering.
Removing the menu's initial Delay3 causes an early read. Removing the 15-frame
tail resolves early. Adding the blackout callback to the nurse's NO branch
fails its callback exclusion. Each is confined to a test instance. Additional
ROM validation rejects a still picture with a walker's size byte.

**Final muted browser run.** Headless Chrome with `--mute-audio`, isolated
profile and `http://127.0.0.1:5188/`; :5173 and user saves untouched. Response-only
probes, no product debug hooks. Staged maps/party states run real keyboard,
interaction, registry, script, text, menu, healing and renderer paths. First
YES uses Rattata; the real save/loader round-trip preserves USED_POKECENTER
before the repeat YES. CANCEL preserves HP and the blackout destination.
The following-Pikachu YES uses the real A6e program and spawn. The caterpillar
is held in place as a talk fixture; Forest trainers are staged defeated so
their unrelated battles do not interrupt the stationary ball watches.

| Flow/display | First glyph | First menu read | Answer tail | Each close |
|---|---|---|---|---|
| First nurse YES (5 programs, one display) | +23 | +3 | 15 | 17 |
| Repeat nurse YES after save/reload (4 programs) | +23 | +3 | 15 | 17 |
| Nurse CANCEL (2 programs) | +23 | +3 | 15 | 17 |
| Nurse YES with following Pikachu (5 programs) | +23 | +3 | 15 | 17 |
| Caterpillar YES / NO (2 displays) | +23 each | +3 each | 15 each | 23 each |
| Lab choose speech (4 displays) | +23 each | — | — | 15 each |

All **10 displays, 24 prints and 6 menus** meet the asserted tick counts;
one opening sprite update per display. Every successful nurse keeps the box
up throughout the machine and hides it for all **40 bow frames**. Farewell
first glyph is +33 from PrintText on the two released-button YES cases, +3
when a button is held at its pause. All four nurse displays use one revision
each. No "Shall we heal" appears on the saved repeat visit.

The three Forest item balls each have **600 frames / 600 recorded draws**:
potion1 turns up/left/right, potion2 and poke_ball cover all four facings.
Every draw uses a 16-high sheet, row 0, no flip. The Lab Eevee ball has **600
frames / 601 draws**, also row 0/no flip; it stayed facing down during this
watch (all four facings are independently covered by the renderer tests).
Oak stays down through the speech and the restored song is `oakslab`.
**10 flow/watch checks passed, zero console errors**, in the final uninterrupted
run. Earlier harness trials selected the wrong Vite module version for the
menu probe or briefly staged GOT_STARTER before the Lab, hiding the ball;
those trials were discarded. Storage cleared; Chrome and spare server closed.

**Cleanup and boundaries.** `exclamation`, its state/tick branch/render fallback,
and `uiEntryUpdates` are removed. Legacy text/yesNo/textButtonWait/closeText stay
with their A5b6/A5b7/compatibility callers; the A5b1 consumer inventory marks
each migrated A5b5 row done. Cable club/link features are logged as needing a
user decision. The Pewter map-existence tripwire protects LooksContentText.
Audio engines, A6 movement and Pikachu programs, A5a printer timing, A5b4 close
costs, Town Map ending and other excluded flows remain unchanged. The machine's
missing fade-out/sounds/jingle/flashes/ordering stay in its approved separate
slice after A5b7, before V2 (#50). Baselines, subsystem docs and STATUS updated.
Stop for Claude note 36 review, then user play-test: Forest balls, Lab facing/
theme, first/repeat/CANCEL nurse and caterpillar YES/NO. **A = Z, B = X.**
