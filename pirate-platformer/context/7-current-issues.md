# Current Issues

The live defect and follow-up queue. Everything found but not fixed lands here.

## How to Use This File

- When a bug is found outside the current unit's scope, **add it here and keep
  going**. Do not fix it inside an unrelated unit.
- When a unit deliberately leaves something incomplete, add it here before marking
  the unit complete.
- When an issue is fixed, move it to **Resolved** with the date and what changed.
- Do not delete entries. This file is the record of what went wrong and why.

## Entry Format

```markdown
### N. Short Title [OPEN | IN PROGRESS | PENDING TEST | FIXED]

**Where:** file or area
**Symptom:** what is observed, not what is guessed
**Expected:** what should happen
**Repro:** the shortest sequence that shows it
**Notes:** anything already ruled out
```

State meanings: `OPEN` — not started. `IN PROGRESS` — being worked. `PENDING TEST`
— code changed, not yet verified by running the game. `FIXED` — verified, ready to
move to Resolved.

## Scope Rules for a Fix

- Fix only what the entry describes.
- Do not refactor surrounding code while fixing a bug.
- Do not change the level schema, the entity registry or an invariant to make a fix
  easier. If the fix requires one of those, stop and say so.
- Add a regression test if the fix is in a tested module — `codec`, `autotile`,
  `schema`, `physics`.
- `npm run build` and `npm test` pass before the entry moves to Resolved.

## Open Issues

### 1. ~~UI nine-slice source is the kit guide, not a textbook 9-slice~~ [FIXED]

**Fixed:** 2026-09-21 (Unit 15)
**Where:** `tools/build-assets.mjs` `writeNineSlice`
**What changed:** `writeNineSlice` now extracts the 3×3 nine-slice subset (indices
0,1,2 / 4,5,6 / 8,9,10) from the 16-tile kit guide and composites them into a
`tile × 3` PNG: 96×96 for boards/papers, 42×42 for buttons. `border-image-slice`
at the tile size (32 or 14) produces correct corners, edges and fill. `dialog.css`
`.panel` and `.btn` upgraded to nine-slice `border-image`. All five composites
regenerated and committed.

---

### 2. Autotile hole shows a grass top on the cell below [OPEN]

**Where:** Unit 04 fixture mass hole (`src/data/fixtures/autotile-demo.js`); 4-neighbour autotile
**Symptom:** The cell under a 1-tile hole draws a grass *top* edge because its north neighbour is empty.
**Expected:** Inner-corner tiles from the remaining 31 blob cells (Unit 19).
**Repro:** Look at the hole in the solid block on `/`.
**Notes:** Correct for v1 4-neighbour autotile. Do not change the mask table to paper over it.

---

### 4. Touch-control layout looks off at phone width [OPEN]

**Where:** `src/ui/styles/touch-controls.css` (Unit 09)
**Symptom:** At a narrow phone viewport the on-screen controls sit awkwardly — the D-pad cluster (left/right with `down` spanning below) and the jump button do not feel well balanced for thumbs. Seen in device emulation during the Unit 09 check.
**Expected:** A comfortable, thumb-reachable control layout at phone widths in both orientations.
**Repro:** Open `/` in device emulation (phone), tap once to reveal controls.
**Notes:** Deferred by the player during Unit 09 ("we can worry about that once the game is completed"). Functionality is correct (movement, jump, drop-through, multi-touch all work); this is layout/ergonomics only. Handle in the responsive pass (around Unit 15 maker UI / a later polish unit), not inside an unrelated unit. Do not change the input wiring — CSS/layout only.

---

### 5. Throwaway atlas debug page still in the tree [OPEN]

**Where:** `atlas.html`, `src/debug-atlas.js`, `src/ui/styles/debug-atlas.css` (Unit 01)
**Symptom:** The Unit 01 clip-verification page is still in the source tree with no decision recorded either way. Unit 01's tracker entry says "`/atlas.html` is removable" once `core/atlas.js` landed; Unit 02's says "`/atlas.html` kept" without saying why or for how long. Nothing since has revisited it, so it reads as an oversight rather than a choice.
**Expected:** Either deleted — its job, proving every clip packs with the right frame count, is done and `core/atlas.js` now covers the runtime path — or explicitly kept as a dev-only tool with that decision recorded here and in the tracker.
**Repro:** `ls atlas.html src/debug-atlas.js src/ui/styles/debug-atlas.css`; run `npm run dev` and open `/atlas.html`.
**Notes:** Found during a context review on 2026-09-16, not during a unit. **It does not ship:** `vite.config.js` declares no extra Rollup input, so the production build has `index.html` only — `dist/` was checked and contains no `atlas.html`. Nothing in `src/main.js` imports `debug-atlas.js`; the page is reachable only through the dev server. So the cost is three unreferenced files, not bundle weight. Useful again whenever `tools/asset-manifest.mjs` gains clips (Units 10, 11, 20), which is an argument for keeping it — decide then, and do not fold the deletion into an unrelated unit.

---

### 6. `jsconfig.json` `baseUrl` is deprecated and now reports as an error [OPEN]

**Where:** `jsconfig.json` line 9 (Unit 00)
**Symptom:** The editor's TypeScript service reports, against `jsconfig.json` itself:
"Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0. Specify compilerOption '\"ignoreDeprecations\": \"6.0\"' to silence this error." Severity is **Error**, so `getDiagnostics` is no longer clean for the project even when every source file is.
**Expected:** A clean diagnostics run, and a `jsconfig.json` that still resolves imports the same way after TypeScript 7.
**Repro:** Run `getDiagnostics` with no file argument.
**Notes:** Found during Unit 10, caused by an editor TypeScript upgrade, not by any code. `"paths"` is `{}` and every import in `src/` is relative, so `baseUrl` is doing nothing — deleting both keys is very likely the whole fix, and is strictly smaller than adding `ignoreDeprecations`. Not done inside Unit 10 because `jsconfig.json` is Unit 00's file and this is unrelated to walker enemies. TypeScript is not a project dependency (`npx tsc` is unavailable), so verify the fix through the editor's diagnostics.

---

### 7. `PickupFx` name and home no longer fit its use [OPEN]

**Where:** `src/game/collectibles.js` (`PickupFx`), used from `world.js` `spawnFx`
**Symptom:** `PickupFx` was named and placed for treasure pickups, but as of Unit 11
it is the generic one-shot sprite burst for four different things: pickup fx, the
Crabby strike effect, projectile terrain/lifetime bursts (pearl/dead,
ball-explode, ball-dead). Its name and its home in `collectibles.js` now undersell
what it is.
**Expected:** A neutral name (e.g. `OneShotFx`) in a neutral home (e.g.
`src/game/fx.js`), imported by `world.js` and everything that spawns one.
**Repro:** Grep `PickupFx` — it is imported by `world.js` and referenced by the
collectible, walker (Crabby) and shooter/projectile paths.
**Notes:** Called out by the Unit 11 spec as **not** to be folded into Unit 11 (it
would touch `collectibles.js`, which Unit 11 does not). Pure rename + move, no
behaviour change. It has **no `flip` parameter and must not grow one** — every clip
that uses it is symmetric. Do it as its own small change.

---

### 8. Fixture cannonball always bursts on the pillar, never on lifetime [OPEN]

**Where:** `src/data/fixtures/play-demo.js` — cannon (53,12) + pillar (col 49, rows 11-12)
**Symptom:** The Unit 11 spec's verification checklist expects "a dodged cannonball
dies on lifetime showing `ball-dead`", but with the placement the spec itself
dictates, the pillar at col 49 sits directly in the left-firing cannon's line at
muzzle height, so **every** ball bursts on it (`ball-explode`). There is no player
position that both triggers the cannon (in range + in front + level) and leaves the
ball an unobstructed 450 px (3 s × 150) of travel, so `ball-dead` never shows in
this fixture during normal play.
**Expected:** The fixture demonstrates both cannonball death clips, per the checklist.
**Repro:** Play to the flag run-up; trigger the cannon from anywhere left of it —
the ball always explodes on the pillar.
**Notes:** The fixture was built **exactly** to the spec's placement table, so this
is a spec/fixture inconsistency, not an implementation bug — both death paths are
fully covered by `shooter.test.js` (`ball-explode` on terrain, `ball-dead` on
lifetime and on the level edge). Fix options, none folded into Unit 11: move the
cannon so a second, un-backstopped shot lane exists, or add a note to the checklist
that `ball-dead` is proven by test rather than by this fixture. Do not change the
`Shooter`/`Projectile` code for this — the behaviour is correct.

---

### 9. SFX playback bypasses the master `sfxGain` node [OPEN]

**Where:** `src/core/audio.js` `playSfx` (Unit 12)
**Symptom:** Unit 12 spec graphs `source → perPlayGain (mix) → sfxGain → destination`.
The implementation sets `perPlayGain` to `_sfxVolume * mix` and connects it
straight to `destination`. `sfxGain` is created and written by the `sfxVolume`
setter but no SFX node feeds it.
**Expected:** Per-play gain is the authored mix only; master SFX volume lives on
`sfxGain`, so in-flight sounds follow a volume change.
**Repro:** Call `playSfx('jump')`, then set `sfxVolume` while it is still playing —
the in-flight sound does not change. New plays do honour the setter because they
bake `_sfxVolume` into the per-play gain.
**Notes:** Found while reading Unit 12 against the spec, not during Unit 13.
Functionally OK for fire-and-forget SFX. Do not fold into an unrelated unit; a
fix is one connect target plus dropping `_sfxVolume` from the per-play gain.

---

### 16. Portrait screens stretch the game world ~3× vertically [PENDING TEST]

**Decision (2026-09-23, player):** option (c) — portrait is not supported for the
canvas; a DOM prompt covers the screen in portrait and asks the player to rotate.
Recorded in `1-project-overview.md` (Input and platform) and `2-architecture.md`
(Rendering Model). The fix is its own small change, not part of Unit 16: a
`ui/` overlay shown when the display aspect is below 1, plus deciding whether the
App holds the simulation while it is up (smallest defensible answer: yes, the same
way it holds during a transition — a player who rotates mid-jump should not die
behind the prompt). **Residual, not covered by the decision:** landscape displays
with an aspect between 1 and 512 / 360 ≈ 1.42 still stretch — 6.7% on a 4:3
tablet, up to 42% on a square desktop window. Revisit if it shows up in play.
**What changed (2026-09-23):** new `src/ui/rotate-prompt.js` +
`styles/rotate-prompt.css` — an opaque `--ink` cover (z-index 10) with a centred
`.panel` ("Turn your device", "Coral Corsairs plays in landscape.") and a CSS phone
outline that turns to landscape (static under reduced motion). It is mounted on
`#app`, not `#ui`, so Unit 16's veiled UI layer can never hide it. `main.js`
computes `portrait = innerWidth < innerHeight` in the viewport's `onResize` and
shows or hides the prompt there; while it is up, `update` only calls
`input.advance()`, so nothing simulates and a press made behind it is dropped, not
replayed. `core/viewport.js` and `VIEW_H` are unchanged. **Not yet seen in a
browser** (no browser tools this session): check a 390 × 844 viewport shows the
prompt and a held game, and that turning to 844 × 390 hides it and resumes.


**Where:** `src/core/viewport.js` + `#game` CSS (`src/ui/styles/base.css`); the Rendering Model in `2-architecture.md`
**Symptom:** On a 390 × 844 portrait phone the canvas backing store is 512 × 360 (`VIEW_W_MIN` × `VIEW_H`) but CSS fills it to 390 × 844 — x scale 0.76, y scale 2.34, a **3.08× non-uniform stretch**. Tiles, the player and clouds all render tall and thin. Pointer input still maps correctly (`toVirtual` scales each axis separately). Landscape is fine (844 × 390 → 1.01×).
**Expected:** `1-project-overview.md`: "Portrait and landscape both usable; landscape recommended for the maker."
**Repro:** Load `/` in a 390 × 844 viewport (device emulation or an iframe) and compare `canvas.width/height` with its CSS box.
**Notes:** Found 2026-09-22 while verifying Unit 15 in Chrome. This is a **conflict inside the architecture**, not a code slip: "360 units tall, always" + "width clamped to 512–768" + "nothing is letterboxed" cannot all hold when the display aspect is below 512 / 360 ≈ 1.42 (every portrait phone, and 4:3 tablets get a milder 6% stretch). Resolving it needs a decision before any code: (a) letterbox or pillarbox in portrait (the architecture currently forbids it); (b) let the virtual height grow in portrait (breaks "360 tall, always" and changes the field of view); or (c) treat portrait as unsupported for the canvas and ask the player to rotate (changes the overview's promise). Per CLAUDE.md this is reported, not fixed. Possibly related to issue 4's "looks off at phone width".

---

### 17. Maker palette category tabs are 28 px tall — under the 44 × 44 hit area [OPEN]

**Where:** `src/ui/styles/maker-palette.css` (`.maker-palette__tab`), Unit 15
**Symptom:** Measured in Chrome at `--ui-scale: 1`, all seven tabs are 50–70 × 28 CSS px. Every other toolbar and palette button meets 44 × 44.
**Expected:** `3-ui-context.md`: "Minimum hit area is 44 × 44 CSS pixels on every interactive element … regardless of visual size."
**Repro:** Phone-landscape (844 × 390) or portrait: measure `.maker-palette__tab` bounding boxes.
**Notes:** Found 2026-09-22 while verifying Unit 15. Not fixed in the sweep because the fix has a layout cost worth choosing deliberately: at 844 × 390 the clear canvas between the bars is already only 220 px, and 16 px more tab height comes straight out of it. Options: taller tabs; or a hit area that extends past the visual tab (the tab row sits directly on the tool strip, so any extension has to go upward into the canvas edge).

---

### 18. A quick tap places nothing on touch [PENDING TEST]

**Where:** `src/maker/gestures.js` (Unit 14)
**Symptom:** A one-finger tap that lifts before moving 4 px or reaching the 300 ms long-press goes `longPress` → `idle` with no paint event, so nothing is placed. Placing a single coin, enemy or marker on a phone needs a small deliberate drag.
**Expected:** Goal 2 — a first-time user builds a level on a touchscreen without instructions. A tap on a cell should place the selected tool there once, as a mouse click does.
**Repro:** Touch emulation or a phone; pick Gold Coin; tap an empty cell — nothing appears. Drag a few pixels — a coin appears.
**Notes:** Found 2026-09-22 in the repo review, logged 2026-09-23 while writing the Unit 16 spec. Behaves as spec 14 was written (a tap goes to `idle`), so this is a spec gap, not a code slip. Likely fix: on a lift from `longPress` before the threshold, emit `paintPressed` then `paintReleased` at the start point in the same frame, keeping long-press and pan untouched. Not folded into Unit 16 (round trip) — its own change, with a `gestures.test.js` case.
**What changed (2026-09-23):** `gestures.js` — a finger that lifts while still in
`longPress` emits `paintPressed` and `paintReleased` together at its touch-down
point, and reports `active` for that frame so the tap reaches the scene through the
gesture channel. Only a finger that landed on its own can tap (`tapAllowed`): the
finger left behind by a pinch or two-finger pan does not. Pan mode, long-press
eyedrop and drags are unchanged. `maker-scene.js` `processPaintFrom` now handles
release **after** press and drag, so a same-frame press+release places once and
closes its command (one undo step). 2 tests in `gestures.test.js`; a scratch
harness against the real scene confirmed one coin per tap and one undo per tap.
**Not yet tried on a touchscreen.**

---

### 19. Enter on a focused secondary overlay button runs the primary action [OPEN]

**Where:** `src/core/input.js` `onKeyDown` (Unit 09 / the 2026-09-13 Enter decision); seen with Unit 16's Back to editor
**Symptom:** `input.js` maps Enter to `pause` and Space to `jump`, and `preventDefault`s both, so a focused `<button>` never receives a keyboard click. On the pause overlay, Tab to **Back to editor** and press Enter: the game resumes instead. On the results panel, Enter on Back to editor replays. The primary buttons only work by coincidence, because `pause` does the same thing they do.
**Expected:** A keyboard user can activate any focused overlay button with Enter or Space.
**Repro:** Test-play a level, press Enter to pause, Tab to Back to editor, press Enter.
**Notes:** Found 2026-09-23 while implementing Unit 16 (from reading `input.js`, not yet reproduced in a browser). Not fixed there — the fix is in `input.js`, which the Unit 16 spec leaves untouched, and it must keep the 2026-09-13 behaviour (Enter pauses and resumes the game when a non-button has focus). Likely fix: in `onKeyDown`, leave Enter and Space to the target when it is a `<button>`, the way form fields already own their keys; then check Resume and Play again still work on Enter by being clicked. Workarounds today: `M` goes back to the editor from anywhere in test-play, and the mouse or a tap works.

---

### 20. Every nine-slice composite is built from the wrong tiles [OPEN]

**Where:** `tools/build-assets.mjs` `writeNineSlice` (the Unit 15 fix for issue 1); output `public/assets/ui/{board-yellow,board-green,paper-yellow,button-yellow,button-green}.png`
**Symptom:** The palette bar, toolbar, dialogs and pause/results panels draw scrambled wood: repeating vertical posts, a gap cut into the frame, a row of small squares along the bottom edge (player screenshot 2026-09-23, maker palette bar). `board-yellow.png` enlarged: correct top row, then the fill, a right edge and a bottom-left corner in the middle row, and a corner plus two bar pieces in the bottom row.
**Expected:** Each composite is a clean 3 × 3 frame: corners, edges, fill.
**Cause:** `writeNineSlice` picks indices `0,1,2 / 4,5,6 / 8,9,10`, which assumes the 16 files are numbered like the 4 × 4 guide picture. They are not. The file order is numeric and correct (`build-assets.mjs:242`). What the numbers mean, checked tile by tile on 2026-09-23:
- **Boards and paper** (Yellow Board, Green Board, Yellow Paper): `1–9` are the 3 × 3 frame in reading order; `10–12` the one-tall bar, `13–15` the one-wide column, `16` the single.
- **Buttons** (Yellow Button, Green Button): `1` is the single, `2–4` the bar, `5–7` the column, and `8–16` the 3 × 3 frame.

So the current pick is wrong for all five, differently for boards and buttons.
**Repro:** Open the maker and look at the bottom palette bar, or view `public/assets/ui/board-yellow.png` enlarged.
**Notes:** Found by the player during Unit 16 testing. Not a Unit 16 regression: `maker-palette.css` and the composites are unchanged since the baseline commit. Unit 15's verification checked hit areas and behaviour, not how the frames looked. Fix, already previewed in the scratchpad (clean frames for all five): give each manifest `nineslice` entry the number of its first frame tile (`1` for boards and paper, `8` for buttons), declared in `tools/asset-manifest.mjs` rather than guessed in the packer, then `npm run assets`. Sizes stay 96 × 96 and 42 × 42, so no CSS or atlas-size change is needed. The coverage report will change: tiles 1–9 or 8–16 become packed and the old wrong picks unpacked. The number stays 9 per kit.

---

## Resolved

### 3. Small clouds pop out mid-screen instead of exiting left [FIXED]

**Fixed:** 2026-09-13 (found during the Unit 08 play check; scoped bug fix in Unit 05 code)
**Where:** `src/level/parallax.js` `recycleLeftmost` → now `recycleExited` + pure `pickRecyclable`
**Symptom:** Every `cloudTimer` (2.5 s) a small cloud that was still fully visible — near the left edge of the screen — vanished instantly, rather than drifting off the left edge.
**Cause:** `recycleLeftmost` selected the cloud with the **minimum** wrapped `sx` in `[0, period)`. In that coordinate `sx ≈ 0` is a cloud at the left edge but still fully on screen; a cloud that has genuinely exited past the left wraps to `sx ≈ period` (the top of the range), because `wrap` maps a negative screen-x to `period + x`. So the "leftmost" pick was the most-visible left cloud, and teleporting it to the right popped it.
**What changed:** Extracted the selection into an exported pure helper `pickRecyclable(clouds, camX, viewW, period, factor)` that computes the same signed screen x `s` the draw path uses, considers only clouds fully off the left edge (`s + w <= 0`), and returns the most recently exited one (greatest such `s`), or `-1` when none has exited (so a visible cloud is never moved). `recycleExited` is a thin wrapper; the right-edge destination is unchanged. Regression tests added in `parallax.test.js` (4 cases). `npm test` 95 passing, `npm run build` clean. No schema, theme, or invariant change.

---

### 10. Maker toolbar state goes stale while the pointer is off the level [FIXED]

**Fixed:** 2026-09-22 (found in a repo review after Unit 15; scoped fix in Unit 15 code)
**Where:** `src/maker/maker-scene.js` `render`
**Symptom:** On a fresh level, Undo, Redo and **Play** all showed enabled — Play with no goal placed — until the mouse moved over a level cell. Clicking toolbar Undo near the level's left edge could leave Undo enabled on an empty stack.
**Cause:** `toolbar.sync` ran at the very end of `render`, after `if (!level.inBounds(cell.c, cell.r)) return;` for the cursor. The maker opens with the camera 2 tiles past the left edge and the pointer at (0, 0), and the Back/Undo buttons sit over that margin, so the sync was skipped exactly when it mattered. The toolbar's `prevCan*` start at `true`, so nothing disabled the buttons.
**What changed:** The sync block moved above the cursor early-return, so it runs every rendered frame. Verified in Chrome: fresh load shows Undo/Redo/Play disabled; after a paint drag Undo enables; clicking Undo with the pointer parked over the toolbar disables Undo and enables Redo. DOM reconcile stays in `render` (invariant 3). No test — scene/DOM code is verified by running the game.

---

### 11. Game keys swallowed inside form fields; resize dialog outlives the maker [FIXED]

**Fixed:** 2026-09-22 (found in a repo review after Unit 15; scoped fix in Unit 02 / Unit 15 code)
**Where:** `src/core/input.js` `onKeyDown`; `src/ui/components/resize-dialog.js`; `src/maker/maker-scene.js`
**Symptom:** With the resize dialog's number field focused, ArrowUp/ArrowDown panned the maker instead of stepping the value (reproduced in Chrome: three ArrowUp presses left 160 unchanged). Any future text field (Unit 17 level name, share-code paste) could never receive W, A, S, D, M or Space. Pressing `M` while the dialog was open switched to play and left the dialog stranded over the game.
**Cause:** `input.js` listens on `window` in the capture phase and `preventDefault`s every mapped key regardless of target, so the field never got its default action. Separately, `openResizeDialog` appended its overlay to `#ui` with no handle, so `makerScene.unmountUI` could not remove it.
**What changed:** New exported pure helper `isFormField(target)` in `input.js`. `onKeyDown` returns early for form-field targets (after `fireGesture`, so audio unlock still works); `onKeyUp` is unchanged, so a key held before the field took focus still releases. Buttons are deliberately not form fields — the pause overlay relies on Enter reaching `input.js` while Resume has focus (2026-09-13 decision). `openResizeDialog` now returns an idempotent `{ close }`; the maker keeps it and closes it in `unmountUI`, and its `openResizeDialog` param is typed instead of `Function`. 4 tests in new `core/input.test.js`. Verified in Chrome: ArrowUp in the field steps 160 → 163; `M` typed in the field does not switch modes; `M` with focus on the dialog's Cancel button switches to play and the dialog closes with no stray overlay; six page-level `M` presses toggle modes six times.

---

### 12. Music track alone is 85% of Goal 4's 3 MB budget [FIXED]

**Fixed:** 2026-09-22 (found in a repo review after Unit 15; player chose re-encoding over rewording Goal 4)
**Where:** `tools/asset-manifest.mjs` `audio`, `tools/build-assets.mjs`
**Symptom:** `public/assets` was 2.74 MB, of which `starlight_city.mp3` (192 kbps stereo, 106 s) was 2.44 MB. With JS and CSS the shipped game was ~2.83 MB before any campaign level, the ship tilesheet (Unit 20) or PWA files (Unit 21). `attack.wav` (34 KB) also shipped although nothing plays it.
**Expected:** Goal 4 — code, art, audio and campaign under 3 MB — with room for the remaining units.
**What changed:** `ffmpeg-static` (devDependency, install script approved in `package.json` `allowScripts`) re-encodes any audio manifest entry that has a `bitrate`. The music is now 96 kbps CBR, 48 kHz stereo, 1.28 MB. `attack.wav` removed from the manifest. `public/assets` is now 1.49 MB. Two consecutive `npm run assets` runs are byte-identical, and every PNG plus `atlas.json` is unchanged from the previous commit. Verified in Chrome: the new MP3 decodes (106.44 s, 2 ch, 48 kHz) and the game loads with no audio warnings. **Not verified:** how it sounds — 96 kbps joint stereo should be transparent enough for background music, but it needs a listen on the player's speakers or headphones.

---

### 13. Moving platforms promised in the overview, but no unit builds them [FIXED]

**Fixed:** 2026-09-22 (found in a repo review after Unit 15; scope decision by the player: defer)
**Where:** `context/1-project-overview.md` Features; `src/game/player.js`
**Symptom:** The overview's play-mode features listed "moving platforms that carry the player", but no unit in `specs/00-build-plan.md` built one. Unit 06 left an inert `Player.platform = null` field plus a carry branch that nothing ever set; Units 07 and 08 re-deferred it without naming a home.
**Cause:** The feature has no art in the pack — Super Pirate World's moving platforms use its own helicopter sprites, which we do not pack (2026-09-06 decision) — and format 1 has no way to express a platform's path, so no unit ever picked it up.
**What changed:** Moved to **Deferred, not rejected** in `1-project-overview.md` with the reason; dropped from the Features list and from the architecture doc's physics paragraph; Unit 06's line in the build plan notes the stub's removal. Deleted `Player.platform` and its carry branch (dead code — git keeps it). No behaviour change: the field was always `null`. `npm test` unchanged.

---

### 14. Nine-slice sizes drifted after Unit 15 — atlas metadata and three docs [FIXED]

**Fixed:** 2026-09-22 (found in a repo review after Unit 15)
**Where:** `tools/build-assets.mjs` (nineslice branch of `main`); `context/2-architecture.md` Asset Pipeline; `specs/00-build-plan.md` Unit 01; `context/4-code-standards.md` File Organization
**Symptom:** Unit 15 (issue 1) changed `writeNineSlice` to composite a 3 × 3 subset, so the PNGs are 96 × 96 and 42 × 42, but `atlas.json` still declared all five `ui/board-*`, `ui/paper-yellow` and `ui/button-*` entries at 128 × 128 / 56 × 56. The architecture doc and the build plan still described the 4 × 4 layout. Separately, the code standards listed a `core/rng` module that has never existed (the parallax LCG lives in `level/parallax.js`).
**Cause:** The Unit 15 fix updated `writeNineSlice`'s own `size` but not the atlas entry beside its call site (`clip.tile * 4`), and only `3-ui-context.md` was re-synced.
**What changed:** Atlas size is `clip.tile * 3`; regenerated — only those five entries changed, every PNG byte-identical. Docs corrected. No runtime impact: CSS references the PNGs directly and nothing in `src/` reads these five atlas sizes; only the `/atlas.html` debug page drew them at the wrong size.

---

### 15. Dead code and a duplicated level-id generator [FIXED]

**Fixed:** 2026-09-22 (found in a repo review after Unit 15)
**Where:** `src/ui/maker-palette.js`; `src/level/schema.js` + `src/level/model.js`; `src/core/input.js`
**Symptom:** `findGroupForEntry` in the palette was never called and returned its argument. Two level-id generators existed: `schema.newLevelId` (`Math.random`, 6 chars, used by `createBlankLevel`) and a private `model.randomLevelId` (`crypto`, 8 chars, used by `createEmptyModel`), so ids had two shapes depending on which path made the level. `input.js` had an orphaned duplicate JSDoc block above `toVirtual` and `onKeyDown`'s `@param` sitting on `fireGesture`.
**What changed:** Deleted `findGroupForEntry`. One generator: `schema.newLevelId` now uses `crypto.getRandomValues` for `lvl_` + 8 base-36 chars, and `model.js` imports it. Existing ids are untouched (schema only requires a non-empty string). 2 tests added to `schema.test.js`. JSDoc fixed. `npm test` 201.

---

## Known-Risk Watchlist

Not bugs — hazards identified during the reference and asset study that are likely
to bite, with the countermeasure to apply when the relevant unit is built. If one of
these actually happens, promote it to a numbered entry above.

### 1. iOS Safari touch behaviour

**Bites in:** Unit 14 (maker gestures), Unit 09 (on-screen controls).
Double-tap zoom, elastic overscroll, long-press text selection and `pointercancel`
mid-drag all break painting and D-pad holds. Set `touch-action: none` on the canvas
and every control, `user-select: none` and `-webkit-touch-callout: none` on the app
shell, `overscroll-behavior: none` on `html, body`, and handle `pointercancel` as a
release. Never rely on `preventDefault` inside `pointermove` alone.
**Applied in Unit 14:** `-webkit-touch-callout: none` is now on `html, body`.
The other items were already in place from Units 00 / 09 / 13.

### 2. Audio starts suspended

**Bites in:** Unit 12.
`AudioContext` begins in `suspended` state on every browser and must be resumed
inside a real user gesture. Resume on the first `pointerdown` or `keydown` the input
module sees, then preload buffers. Also expect iOS to route Web Audio through the
ringer switch in some configurations — never make audio a precondition for
gameplay to start.

### 3. `localStorage` throws in private mode, and has a hard quota

**Bites in:** Unit 17.
Safari private browsing throws on write; other browsers throw `QuotaExceededError`
at roughly 5 MB. `safe-storage.js` must try/catch every access and fall back to an
in-memory map. Quota exhaustion must surface a readable message with a way to free
space — never a silent failed save.

### 4. Non-integer canvas scale shimmers

**Bites in:** Unit 02.
Because viewport width is derived from the display aspect, the scale factor is
usually fractional, which can make one-pixel edges crawl during camera movement.
Round every draw destination to whole world pixels with `Math.round`, and round the
camera position itself before use. If it is still visible, the fallback is the
optional crisp-scale setting: integer scale with letterboxing.

### 5. 10 FPS art on a 60 Hz simulation

**Bites in:** Unit 02, Unit 04.
The pack is authored at 10 FPS. Advance `frameIndex` in fixed-timestep seconds and
take `Math.floor(frameIndex % frameCount)`; never derive the frame from
`performance.now()` or a render-time delta, or animations will stutter differently
from the simulation.

### 6. `CompressionStream` is not universal

**Bites in:** Unit 17 (UI). **Countermeasure shipped in Unit 03.**
`deflate-raw` is unavailable on older Safari. Codec uses prefix `z` (deflate-raw)
or `u` (uncompressed base64url) and never guesses. Both paths have round-trip tests
in `codec.test.js`. Unit 17 still needs a user-visible fallback if encode fails.

### 7. A backgrounded tab produces an enormous delta

**Bites in:** Unit 02.
Returning to a tab after minutes yields one huge `requestAnimationFrame` delta. Cap
the accumulator at 5 fixed steps per frame and discard the rest, or the player will
tunnel through the floor on resume.

### 8. Camera clamping breaks on small levels

**Bites in:** Unit 02, Unit 04.
Super Pirate World's `camera_constraint` (`code_complete/groups.py`) computes
`right = -width + WINDOW_WIDTH`, which crosses `left` when the level is narrower
than the viewport, and the clamp then fights itself. Our minimum level is 40 × 12
cells = 1280 × 384 world pixels against a maximum viewport of 768 × 360, so there is
only 24 pixels of vertical slack. Clamp with `Math.min`/`Math.max` in an order that
degrades to centring when the level is smaller than the view.

### 9. Renaming an entity kind id silently corrupts saved levels

**Bites in:** any unit touching `src/data/palette.js`.
Kind ids are strings written into every saved level and every share code. Changing
one is a breaking format change. If a rename is unavoidable, bump `format` and add
an alias map in `schema.js` — never rename in place.

### 10. Unbounded undo stack

**Bites in:** Unit 13.
A paint drag across a large level can generate thousands of cell changes. Coalesce
one drag into one command, store the inverse as a compact diff rather than a level
snapshot, and cap the stack (100 commands) so memory stays flat on a phone.

### 11. Sprite strip sampling

**Bites in:** Unit 01, Unit 02.
Frames are packed edge to edge with no padding. Source rectangles passed to
`drawImage` must be exact integers computed as `frameIndex * frameWidth`. If any
bleeding from an adjacent frame appears, the fix is a one-pixel extrude in the
packer, not padding — padding would change the frame stride the manifest declares.

### 12. Web font flash

**Bites in:** Unit 00.
Pixelify Sans is self-hosted with `font-display: swap`, so the first paint uses the
fallback and text reflows. Reserve layout with fixed-size buttons and avoid text
that changes the size of its container, or the title screen will jump.
