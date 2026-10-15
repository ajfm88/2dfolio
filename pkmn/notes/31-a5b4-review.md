# A5b4 review — the text runner, the display session and the exact close

**2026-10-11 · Claude (Sonnet 5.5) reviewing Sol's `2ad290d`, `2b3403f`, `b2e6bd6`, `905959b` against
`notes/30-a5b4-plan.md` (approved, DECISIONS #48).**

## Verdict: passed. No blocking findings; three non-blocking notes.

The user's play-test is **not** done and is not claimed here (plan §6 lists what to check).

## What I checked

- **Gates, re-run by me from `905959b`.** Typecheck clean. `ROM_PATH=pokeyellow.gbc npm test`
  **1064/1064** (49 files). Without ROM **944 pass / 120 skip**. `npm run build` clean (334.8 kB JS).
  `npm run setup pokeyellow.gbc` run twice: `git status` clean both times, so the committed generated
  files are exactly what setup writes (173 JSON per tree, 696 files in `static/`). `git diff --check` clean
  over the whole slice. Those match Sol's numbers.
- **CP1 data.** The extractor change is additive: `textId` on ROM NPCs and signs, `extractMapObjectPictures`
  (object pictures in cartridge order, before `NPC_INDEX_FILTER`) feeding `mapObjects`. Sol's 38/0/831
  (not the plan's 40/0/829) is right: Red's House 2F has no ROM NPCs or signs, so its two map files do not
  change. The new test parses the source `object_event` / `bg_event` lines and the `TextPointers` order and
  compares every NPC and sign `textId`, and `mapObjects` against the source pictures (it asserts the dropped
  second Oak, the walking Daisy and Route 22's two hidden rivals still count). A5b2 N-1 is closed: all ten
  emitted sets are compared and a set-3 mutation is caught.
- **CP2 runner.** Read `text_runner.ts` and the `TextScreen` split against `home/text.asm`: `far` pushes a
  level and the parent continues; `<DONE>`/`<PROMPT>` return only that level (`placeString` returns true);
  the cursor and joypad history are shared; `ram` needs its binding; `sound` plays then waits on
  `soundFinished()` with no joypad read; `promptButton`/`waitButton` use protection 0 (no `ProtectedDelay3`)
  with and without the arrow; `pause` is one read, 30 frames unless A/B is held; `cry` is a cue with no
  frames; `asm` returns to the caller; unsupported ops throw with the label and the A5b7 home. The 24
  printer, 3 BG-transfer and 15 TextBox tests passed unchanged at CP2 (Sol's note), and the equivalence test
  (every binding-free plain program equals its flattened string, same buffer and frame count) is the strong
  regression link to A5a.
- **CP3 session and close.** Traced `TextBox` tick by tick against `CloseTextDisplay`: Hold's last read at
  tick H; the sequence is created in that tick; the first close frame ticks the BG phase once and no later
  one does; the window is hidden from H+1 while `uiTiles.cover` continues; `updateSprites` runs once, on tick
  `H + 5 + 2W`, then the box goes inactive in the same tick, so the next pass comes two frames later. That is
  exactly §3.3. I re-read `CopyVideoData` / `CopyVideoDataAlternate`, `InitMapSprites`,
  `LoadStillTilePattern` and `LoadPlayerSpriteGraphics`: the `floor(tiles/8) + 1` cost, the LCD-on fall
  through and the font-loaded early return all hold, so `5 + 2W` and the 19 map fixtures stand.
  START's exit is the same counter in a `menu_closing` state (one `readJoypad()`, no sync during the copies,
  the menu rectangle covered after the first frame). `closeText` and the new `displayClose` share it. The
  Town Map sign keeps its one-frame ending (`close: false`) and a test pins it.
- **CP4 pickups and kinds.** `itemBallScript` and `hiddenItemScript` match §3.4 command for command: open,
  give and hide only after the 20 frames, `FoundItemText` with `stringBuffer`, `FoundHiddenItemText` with
  `nameBuffer` and `box: 'keep'`, the full-bag branches with the silent waits, the 99-per-slot rules
  untouched. Strings come from the extracted programs, not re-typed. `mapTextKind` reads the generated call
  table; handlers and scripts stay on the old path. The Oak's Lab / Viridian Mart second-table selection
  matches `OaksLab_Script` (`EVENT_PALLET_AFTER_GETTING_POKEBALLS_2`) and
  `ViridianMartCheckParcelDeliveredScript` (`EVENT_OAK_GOT_PARCEL`).
- **My own mutation.** I changed `closeFrames` from `1 + 2W + 4` to `1 + 2W + 5` and reran the suite: 5
  tests failed (three pickup bound tests and two sprite-set fixture tests). Restored with `git checkout`;
  tree clean. Sol's own mutations (set-3 byte, cost 24, a no-op `cover`, `keep` forced to `new`) are
  consistent with the tests I read.
- **Existing-test edits.** Sol listed every one with its reason; I checked the list against
  `git diff --stat` and the diff of the files named. Only the planned ones changed (map_sprite_sets,
  textbox, text_commands, item_pickup). The 73 + 11 = 84 and 181 + 11 = 192 bounds are what §5 predicted.

## Notes (non-blocking)

- **N-1 (P3, latent).** `TextScreen.manual()` always ends with `buffer[98] = ' '` (tile (18, 16)), so the
  `waitButton` op blanks that cell. The cartridge's `TextCommand_WAIT_BUTTON` does not write there (only
  `PROMPT_BUTTON` and the string controls do). No committed program is hit (`TMNotebookText` ends in
  "SILPH CO.", the school note in a 17-character line), but a longer last line would lose its last glyph.
  Fix when A5b6 wires the notebook: skip the clear when `arrow` is false.
- **N-2 (P3).** The session's trailing `UpdateSprites` (in `main.ts`) passes `[...npcs, ...getScriptNpcs()]`
  while START's exit and the ordinary overworld pass use `npcs` only. Script NPCs that persist after a script
  would get one extra update at a text close that a pass never gives them. No visible case on today's maps;
  pick one list in A5b5, where the story scripts that create such NPCs are migrated.
- **N-3 (P4, docs).** `context/ARCHITECTURE.md`'s stack table still said baseline 1015. I corrected it in
  the review commit.

Also worth carrying forward, not defects: Oak's Lab's map script disables the automatic text box on every
pass (`OaksLab_Script`), so the Lab's NPC/sign dialogue border behaviour is an A5b5 audit item (plan §3.1
of note 23 already says so); Sol's note records the op census as 11 kinds where the plan said 12 (it listed
11).

## State after the review

A5b4 is **done pending the user's play-test**. Nothing from A5b5 onward is started or assigned. The
deferred items stay as in the plan's §9 and §4.6. **Next: plan A5b5** (the existing story handlers: Pallet,
the Lab, the Mart parcel, Mom, Daisy, Route 1, Viridian, the nurse), which is the first increment that
uses `displayOpen` / `printText` / `displayClose` for handler flows.
