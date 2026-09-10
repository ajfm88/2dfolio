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
**Notes:** Measured tiles: 1 = TL corner, 2 = top edge, 3 = TR corner. The usable 9-slice is the top-left 3×3 (tiles 1,2,3 / 5,6,7 / 9,10,11). Column 4 and row 4 are the extra size examples. Unit 01 followed the spec (16 tiles → 128×128). When Unit 15 first uses `border-image`, either extract that 3×3 (96×96, still slice 32) or expand it to a 4×4 by duplicating the mid-edge and fill tiles. Do not change the level schema.

---

## Resolved

None yet.

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

**Bites in:** Unit 17.
`deflate-raw` is unavailable on older Safari. The codec must detect it, fall back to
uncompressed base64, and mark which encoding was used with a one-character prefix so
decoding never guesses. Both paths need a round-trip test.

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
