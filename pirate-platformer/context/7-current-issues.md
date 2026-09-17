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

### 1. UI nine-slice source is the kit guide, not a textbook 9-slice [OPEN]

**Where:** `public/assets/ui/board-*.png`, `paper-yellow.png`, `button-*.png` (Unit 01 packer)
**Symptom:** Compositing Yellow Board `1.png`–`16.png` in row-major 4×4 reproduces the kit's `(guide).png` — four example panel sizes with gaps — not a single panel with 2-tile-wide edges.
**Expected:** `border-image` slice 32 on that 128×128 PNG yields clean corners, edges and fill.
**Repro:** Open `public/assets/ui/board-yellow.png` next to `Yellow Board (guide).png`.
**Notes:** Measured tiles: 1 = TL corner, 2 = top edge, 3 = TR corner. The usable 9-slice is the top-left 3×3 (tiles 1,2,3 / 5,6,7 / 9,10,11). Column 4 and row 4 are the extra size examples. Unit 01 followed the spec (16 tiles → 128×128). When Unit 15 first uses `border-image`, either extract that 3×3 (96×96, still slice 32) or expand it to a 4×4 by duplicating the mid-edge and fill tiles. Do not change the level schema. **Update 2026-09-13:** Unit 09 is the first DOM UI and would be the first `border-image` user, but per this issue it deliberately ships **flat token-styled** panels and buttons (solid fills, `calc(2px * var(--ui-scale))` `--ink` borders, no radius) instead. The nine-slice `border-image` work stays assigned to Unit 15; sprite-backed HUD chrome (hearts, coin, control glyphs) uses the clean strips and is unaffected.

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

## Resolved

### 3. Small clouds pop out mid-screen instead of exiting left [FIXED]

**Fixed:** 2026-09-13 (found during the Unit 08 play check; scoped bug fix in Unit 05 code)
**Where:** `src/level/parallax.js` `recycleLeftmost` → now `recycleExited` + pure `pickRecyclable`
**Symptom:** Every `cloudTimer` (2.5 s) a small cloud that was still fully visible — near the left edge of the screen — vanished instantly, rather than drifting off the left edge.
**Cause:** `recycleLeftmost` selected the cloud with the **minimum** wrapped `sx` in `[0, period)`. In that coordinate `sx ≈ 0` is a cloud at the left edge but still fully on screen; a cloud that has genuinely exited past the left wraps to `sx ≈ period` (the top of the range), because `wrap` maps a negative screen-x to `period + x`. So the "leftmost" pick was the most-visible left cloud, and teleporting it to the right popped it.
**What changed:** Extracted the selection into an exported pure helper `pickRecyclable(clouds, camX, viewW, period, factor)` that computes the same signed screen x `s` the draw path uses, considers only clouds fully off the left edge (`s + w <= 0`), and returns the most recently exited one (greatest such `s`), or `-1` when none has exited (so a visible cloud is never moved). `recycleExited` is a thin wrapper; the right-edge destination is unchanged. Regression tests added in `parallax.test.js` (4 cases). `npm test` 95 passing, `npm run build` clean. No schema, theme, or invariant change.

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
