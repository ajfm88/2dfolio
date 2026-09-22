# Unit 14 — Maker Gestures

## What This Unit Builds

Touch-gesture support for the maker so it works on phones and tablets. A mouse
user's workflow is unchanged; a touch user gains two-finger pan, pinch zoom at
three discrete levels, a one-finger paint/pan toggle, a long-press eyedropper,
and clean recovery from interrupted touches.

**Depends on:** Unit 13.

## Constraint That Shapes This Unit

Invariant 8: "Input is read only through `core/input.js`. No `addEventListener`
in scene, game or maker code." The gesture recogniser therefore reads from the
public `input.touches` array each frame — it never listens on the DOM itself.

Known-risk 1 (iOS Safari) bites here. The countermeasures listed in
`7-current-issues.md` — `touch-action: none`, `user-select: none`,
`overscroll-behavior: none`, `pointercancel` as release — are already in place
except `-webkit-touch-callout: none`, which this unit adds.

## Scope Boundary

This unit covers: multi-touch pointer tracking in `input.js`, a gesture state
machine in `maker/gestures.js`, maker zoom (0.5× / 1× / 2×), pinch-to-zoom with
centre preservation, two-finger pan, one-finger paint/pan toggle button,
long-press eyedropper (touch) and middle-click eyedropper (desktop), an
eyedropper cell lookup in `tools.js`, a `selectById` method on the palette
controller, `pointercancel` and blur recovery, and the
`-webkit-touch-callout: none` CSS fix.

This unit does **not** cover: the responsive palette bar with scrolling tabs and
a top bar (Unit 15), the level-size dialog (Unit 15), test-play round trip
(Unit 16), persistence (Unit 17), or scroll-wheel zoom (not in the build plan;
consider for polish if time allows, but do not build here).

## Files

### New

| File | Role |
| --- | --- |
| `src/maker/gestures.js` | Gesture state machine — reads `input.touches`, emits high-level gesture state |
| `src/ui/maker-toggle.js` | Paint/pan toggle button — DOM, shown on first touch |
| `src/ui/styles/maker-toggle.css` | Toggle button styling |

### Modified

| File | Change |
| --- | --- |
| `src/core/input.js` | `touches` array (max 2 touch pointers), double-buffered in `advance()` |
| `src/maker/maker-scene.js` | Zoom state, gesture integration, eyedropper wiring, effective dimensions |
| `src/maker/tools.js` | `screenToCell` gains a `zoom` parameter; new `pickToolAt` export |
| `src/maker/grid-overlay.js` | Grid line width adjusts for zoom |
| `src/ui/maker-palette.js` | `selectById(id)` method on the controller |
| `src/ui/styles/base.css` | `-webkit-touch-callout: none` on `html, body` |

### Not modified

- `src/core/viewport.js` — zoom is maker-only and applied in the scene.
- `src/level/render.js` — already accepts `viewW`/`viewH` parameters.
- `src/level/parallax.js` — already accepts `camX` and `viewW`.
- Any file under `src/game/`, `src/storage/`, `tools/`, or `public/assets/`.

---

## `src/core/input.js` — Multi-Touch Tracking

### New: `touches` array

The existing `pointer` (single, primary) is unchanged and continues to serve
play mode and mouse-based maker input. A new parallel channel is added for the
gesture system.

**Raw state** (event-time, internal):

```js
/** @type {Array<{ id: number, x: number, y: number }>} */
const rawTouches = [];   // max length 2
```

Populated from pointer events where `e.pointerType === 'touch'`:

- **`onPointerDown`**: if the event is touch and `e.target === canvas` and
  `rawTouches.length < 2`, push `{ id: e.pointerId, x, y }` (virtual coords
  via `samplePointer`). The existing primary-pointer path (`pointerWantId`)
  still runs for the **first** touch — so the single `pointer` keeps tracking
  finger 1. Do **not** early-return non-primary touch events any more; the
  `isPrimary` guard stays for **mouse** events only. Guard: if
  `pointerType !== 'touch'` and `isPrimary === false`, return.
- **`onPointerMove`**: find the matching `rawTouches` entry by `pointerId`,
  update its `x`, `y`.
- **`onPointerUp` / `onPointerCancel`**: remove the matching entry from
  `rawTouches`.
- **`onBlur`**: clear `rawTouches` to `[]`.

**Public state** (read by the gesture system):

```js
/** @type {Array<{ id: number, x: number, y: number }>} */
const touches = [];   // snapshot, updated in advance()
```

In `advance()`, after the existing pointer/key sync:

```js
touches.length = rawTouches.length;
for (let i = 0; i < rawTouches.length; i++) {
  if (!touches[i]) touches[i] = { id: 0, x: 0, y: 0 };
  touches[i].id = rawTouches[i].id;
  touches[i].x = rawTouches[i].x;
  touches[i].y = rawTouches[i].y;
}
```

No allocation per frame — the `touches` entries are recycled objects. The
returned `input` object exposes `touches` as a read-only property (the array
itself, not a copy).

### Why `isPrimary` changes

Currently, line 165 does `if (e.isPrimary === false) return;`. This blocks the
second finger entirely. For touch, both fingers must be tracked. Change the
guard to:

```js
if (e.pointerType !== 'touch' && e.isPrimary === false) return;
```

Mouse non-primary clicks (e.g. right-click during a left-drag) are still
filtered. Touch non-primary (second finger) now passes through to the
`rawTouches` path. The single `pointer` continues to track only finger 1
(it is set from the first `pointerdown` that sets `pointerWantId`).

---

## `src/maker/gestures.js` — Gesture State Machine

### Factory

```js
/**
 * @param {ReturnType<import('../core/input.js').createInput>} input
 * @param {{ longPressMs?: number, moveThreshold?: number }} [opts]
 */
export function createGestures(input, opts = {})
```

Defaults: `longPressMs = 300`, `moveThreshold = 4` (virtual px).

### State Machine

```
                                ┌─────────────┐
                     ┌──────────│    idle      │──────────┐
                     │          └──────┬───────┘          │
                     │                 │                  │
               1 finger down    1 finger down       2 fingers down
               (paint mode)     (pan mode)               │
                     │                 │                  ▼
                     ▼                 ▼          ┌──────────────┐
              ┌────────────┐   ┌────────────┐     │  twoFinger   │
              │ longPress  │   │  onePan    │     │  (pan+pinch) │
              │ (pending)  │   │            │     └──────────────┘
              └─────┬──────┘   └────────────┘
                    │
      ┌─────────────┼──────────────┐
      │ moved       │ timer fires  │ 2nd finger
      ▼             ▼              ▼
┌──────────┐  ┌───────────┐  ┌──────────────┐
│ onePaint │  │ eyedrop   │  │  twoFinger   │
│          │  │ (1 frame) │  │              │
└──────────┘  └───────────┘  └──────────────┘
```

States:

| State | Entry condition | Behaviour | Exit |
| --- | --- | --- | --- |
| `idle` | no fingers down | — | finger down |
| `longPress` | one finger down, paint mode, not yet moved | accumulate timer; cancel if moved > threshold or 2nd finger | → `onePaint` on move, → `eyedrop` on timer, → `twoFinger` on 2nd finger, → `idle` on lift |
| `onePaint` | one finger down, paint mode, moved past threshold | emit paint coords and pressed/released edges | → `twoFinger` on 2nd finger (abort paint), → `idle` on lift |
| `onePan` | one finger down, pan mode | emit pan deltas | → `twoFinger` on 2nd finger, → `idle` on lift |
| `twoFinger` | two fingers down | emit pan deltas (midpoint) + pinch zoom snaps | → `idle` when fewer than 2 fingers |
| `eyedrop` | long-press timer fired | emit eyedropper cell once, then → `idle` | → `idle` immediately |

"Paint mode" vs "pan mode" is read from an external toggle each frame (see
the toggle button below). Mouse input bypasses the gesture system entirely.

### Public API

```js
{
  update(dt),

  /** Current state name */
  state: string,

  /** Paint outputs (valid when state === 'onePaint') */
  paintX: number,
  paintY: number,
  paintPressed: boolean,
  paintReleased: boolean,

  /** Pan delta this frame (valid in onePan and twoFinger) */
  panDx: number,
  panDy: number,

  /** Zoom snap this frame, or null (valid in twoFinger) */
  zoomSnap: number | null,
  /** Midpoint of the two fingers in virtual coords when zoomSnap fires */
  zoomCenterX: number,
  zoomCenterY: number,

  /** Eyedropper (valid for one frame in eyedrop state) */
  eyedropX: number,   // virtual coords of the long-press point
  eyedropY: number,
  eyedropFired: boolean,

  /** Whether touch gestures are active (any finger down) */
  active: boolean,

  reset(),
}
```

All deltas and fired flags are zeroed at the top of each `update()`.

### Pinch Zoom Logic

When two fingers are tracked:

1. Compute their distance: `d = Math.hypot(t1.x - t0.x, t1.y - t0.y)`.
2. On entering `twoFinger`, store `startDist = d` and `snapped = false`.
3. Each frame, compute `ratio = d / startDist`.
4. If `!snapped`:
   - If `ratio > 1.4` (spread) → `zoomSnap` = next higher level, `snapped = true`.
   - If `ratio < 0.7` (pinch) → `zoomSnap` = next lower level, `snapped = true`.
5. The zoom levels are `[0.5, 1, 2]`. "Next higher/lower" is clamped to this
   array. The current zoom is read from the scene (passed as a parameter to
   `update` or read from a shared ref).
6. `zoomSnap` is emitted for exactly one frame; the scene reads it and applies.
7. After snapping, `startDist` resets to `d` so a continued pinch can trigger
   the next level.

### Two-Finger Pan Logic

Each frame in `twoFinger`, compute the midpoint of the two fingers:
`mx = (t0.x + t1.x) / 2`, `my = (t0.y + t1.y) / 2`. The pan delta is the
change in midpoint from the previous frame: `panDx = mx - prevMx`,
`panDy = my - prevMy`. Store `prevMx`, `prevMy`. Pan and pinch happen
simultaneously.

### Long-Press Logic

On entering `longPress`, store `startX = t0.x`, `startY = t0.y`, and
`elapsed = 0`. Each frame, `elapsed += dt`. If `Math.hypot(t0.x - startX,
t0.y - startY) > moveThreshold`, cancel → `onePaint`. If
`elapsed >= longPressMs / 1000`, fire eyedrop: set `eyedropX = t0.x`,
`eyedropY = t0.y`, `eyedropFired = true`, transition to `idle` (finger stays
down but the gesture is consumed).

Timer is driven by `dt`, not `setTimeout` — the game loop is synchronous.

### Paint Abort on Second Finger

If in `onePaint` and `touches.length` becomes 2: set `paintReleased = true`
for one frame (so the maker scene finalizes the drag), then transition to
`twoFinger`. The pending command is pushed with whatever changes were already
recorded — no data loss, just a shorter drag.

### Recovery

- **`pointercancel`**: `input.js` already removes from `rawTouches`. The gesture
  module sees `touches.length` drop and transitions accordingly (one finger
  lifted → back to one-finger state; both lost → `idle`).
- **`blur`**: `rawTouches` is cleared; gesture module sees 0 touches → `idle`.
  Any active paint sets `paintReleased = true` so the drag finalizes.

---

## Zoom Model (in `maker-scene.js`)

### State

```js
let zoom = 1;  // 0.5, 1, or 2
```

### Effective Dimensions

```js
const effectiveViewW = viewW / zoom;
const effectiveViewH = VIEW_H / zoom;
```

These replace `viewW` / `VIEW_H` everywhere the maker uses them:
- `drawLevel(ctx, cam, effectiveViewW, effectiveViewH, …)`
- `drawGrid(ctx, cam, effectiveViewW, effectiveViewH, …)`
- `camera.panBy(dx, dy, worldW, worldH, effectiveViewW, effectiveViewH)`
- `screenToCell(ptr.x, ptr.y, cam, zoom)`
- Cursor drawing, ghost drawing

### Rendering

After `viewport.apply(ctx)`, the scene applies the zoom:

```js
ctx.scale(zoom, zoom);
```

This means one virtual pixel now maps to `pixelScale * zoom` device pixels.
All `drawLevel`, `drawGrid` and preview calls receive `effectiveViewW/H`.

### `screenToCell` with Zoom

The pointer position from `viewport.toVirtual` is in un-zoomed virtual space.
To convert to world coordinates with zoom:

```js
const wx = pointerX / zoom + cam.x;
const wy = pointerY / zoom + cam.y;
```

This is the inverse of the rendering transform.

### Zoom Centre Preservation (Pinch)

When a pinch snap fires, the camera must adjust so the pinch midpoint stays
over the same world position:

```js
function applyZoom(newZoom, centerVx, centerVy) {
  const worldX = centerVx / zoom + camera.x;
  const worldY = centerVy / zoom + camera.y;
  zoom = newZoom;
  camera.x = worldX - centerVx / zoom;
  camera.y = worldY - centerVy / zoom;
  camera.panBy(0, 0, worldW, worldH, effectiveViewW, effectiveViewH);
}
```

The `panBy(0, 0, …)` re-clamps to the level bounds.

---

## Gesture Integration in `maker-scene.js`

### `update(dt)` Changes

After `input.advance()`, call `gestures.update(dt, zoom)`. Then:

1. **Undo / redo** — unchanged (keyboard only, blocked during drag).

2. **Gesture-driven pan** — if `gestures.panDx` or `gestures.panDy` is nonzero:
   ```js
   camera.panBy(-panDx / zoom, -panDy / zoom, worldW, worldH, effectiveViewW, effectiveViewH);
   ```
   Deltas are in virtual (un-zoomed) pixels, so dividing by zoom converts to
   world-pixel deltas.

3. **Zoom** — if `gestures.zoomSnap !== null`, call `applyZoom(gestures.zoomSnap,
   gestures.zoomCenterX, gestures.zoomCenterY)`.

4. **Keyboard pan** — unchanged, but uses `effectiveViewW/H`.

5. **Middle-mouse pan** — unchanged, but delta division by zoom:
   `panBy((prevX - ptr.x) / zoom, (prevY - ptr.y) / zoom, …)`.

6. **Painting** — the existing `processPaint()` continues to handle mouse input
   when `gestures.active === false`. When `gestures.active === true`, painting
   reads from `gestures.paintX/Y/Pressed/Released` instead:
   - `gestures.paintPressed` → start a new drag (same as `pointer.pressed`)
   - `gestures.paintReleased` → finalize the drag (same as `pointer.released`)
   - While active, convert `(gestures.paintX, gestures.paintY)` to a cell via
     `screenToCell(…, zoom)` and call `paintCell`.
   - The gesture system handles the one-finger-to-two-finger abort: it fires
     `paintReleased`, and the scene finalizes the drag cleanly.

7. **Eyedropper** — if `gestures.eyedropFired`:
   ```js
   const cell = screenToCell(gestures.eyedropX, gestures.eyedropY, cam, zoom);
   const picked = pickToolAt(cell.c, cell.r, level);
   if (picked && palette) palette.selectById(picked.id);
   ```

8. **Middle-click eyedropper** (desktop) — on `pointer.pressed` with
   `pointer.button === 1`, also perform the eyedropper lookup at the clicked
   cell. Then proceed with panning as before (the eyedropper and pan start on
   the same press — eyedropper picks the tool, pan begins immediately).

### `render(ctx, cam)` Changes

After `viewport.apply(ctx)`:
```js
ctx.scale(zoom, zoom);
```

Then pass `effectiveViewW`, `effectiveViewH` to all drawing calls. Pass
`pixelScale * zoom` to `drawGrid` as the pixel-scale parameter (so grid lines
remain 1 device pixel at any zoom).

---

## `src/maker/tools.js` — Zoom and Eyedropper

### `screenToCell` — zoom parameter

```js
export function screenToCell(pointerX, pointerY, cam, zoom = 1) {
  const wx = pointerX / zoom + cam.x;
  const wy = pointerY / zoom + cam.y;
  return { c: Math.floor(wx / TILE), r: Math.floor(wy / TILE) };
}
```

The default `zoom = 1` keeps all existing call sites working without changes.
The maker scene passes `zoom` explicitly.

### `pickToolAt` — new export

```js
/**
 * Look up what is placed at a cell, for the eyedropper.
 * Priority: entity → decor → terrain → platform → water → spawn → goal.
 *
 * @param {number} c
 * @param {number} r
 * @param {LevelModel} level
 * @returns {PaletteEntry | null}
 */
export function pickToolAt(c, r, level)
```

Uses the existing `findEntityAt` and `findDecorAt` (which must be made
module-accessible — either export them or inline the lookup). Priority order:

1. Entity at `(c, r)` → `byId(entity.k)`
2. Decor at `(c, r)` → `byId(decor.k)`
3. `level.get('terrain', c, r) !== 0` → `byId('terrain')`
4. `level.get('platform', c, r) !== 0` → `byId('platform')`
5. `level.get('water', c, r) !== 0` → `byId('water')`
6. `level.spawn.c === c && level.spawn.r === r` → `byId('spawn')`
7. `level.goal && level.goal.c === c && level.goal.r === r` → `byId('goal')`
8. Otherwise → `null`

---

## `src/ui/maker-palette.js` — `selectById` Method

Add to the returned controller:

```js
/**
 * Programmatically select a palette entry by id (for the eyedropper).
 * @param {string} id
 */
selectById(id) {
  const entry = byId(id);
  if (!entry) return;
  selected = entry;
  erasing = false;
  opts.onSelect(entry, false);
  paintSelected();
},
```

---

## Paint/Pan Toggle (`src/ui/maker-toggle.js`)

### Factory

```js
/**
 * @param {HTMLElement} root
 * @param {ReturnType<import('../core/input.js').createInput>} input
 * @returns {{ isPanMode: () => boolean, destroy: () => void }}
 */
export function createPaintPanToggle(root, input)
```

Creates a single DOM button, absolutely positioned above the bottom palette bar
(e.g. `bottom: calc(var(--palette-height, 80px) + 12px * var(--ui-scale));
right: calc(12px * var(--ui-scale))`). Initially hidden; shown when
`input.onTouchDetected` fires.

Two visual states: **paint** (default, brush icon) and **pan** (hand/arrows
icon). Toggle on click. Both icons are CSS-only (the brush is two diagonal
lines like the eraser but thinner; the pan is four small arrows — or use a
simple "P" letter and "✋" if CSS icons are impractical). Follow the existing
flat-token pattern (solid `--board` background, `--ink` border, 44px hit area).

Returns `{ isPanMode(), destroy() }`. The gesture module reads `isPanMode()`
each frame to decide whether one-finger touch is paint or pan.

The toggle is created by the maker scene in `mountUI`, alongside the palette.
It is injected the same way (`params.ui.createToggle`). The maker scene
passes the toggle controller to `createGestures` so it can read the mode.

---

## `src/ui/styles/base.css` — iOS Safari Fix

Add to the `html, body` rule:

```css
-webkit-touch-callout: none;
```

This addresses the last item in known-risk 1 (iOS Safari touch behaviour).

---

## `src/maker/grid-overlay.js` — Zoom-Adjusted Grid Lines

The `drawGrid` function's `pixelScale` parameter controls line width via
`ctx.lineWidth = 1 / pixelScale`. With zoom, the canvas transform is
`pixelScale * zoom`, so the scene passes `pixelScale * zoom` as the
`pixelScale` argument. No changes to `grid-overlay.js` itself — the scene
just passes a different value:

```js
drawGrid(ctx, cam, effectiveViewW, effectiveViewH, level.cols, level.rows,
         viewport.pixelScale * zoom);
```

At zoom 2× with pixelScale 2: lineWidth = `1 / 4 = 0.25` virtual px →
`0.25 * 2 * 2 = 1` device pixel. Correct.
At zoom 0.5× with pixelScale 2: lineWidth = `1 / 1 = 1` virtual px →
`1 * 2 * 0.5 = 1` device pixel. Correct.

---

## Not Built

- Responsive palette UI: scrolling category tabs, top bar with Back / Undo /
  Redo / Play / Menu, orientation handling (Unit 15).
- Level-size dialog (Unit 15).
- Test-play round trip with validation and transitions (Unit 16).
- Persistence (Unit 17).
- Scroll-wheel zoom (not in the build plan).
- Any new palette entries.
- Changes to `core/viewport.js`, `level/render.js`, `level/parallax.js`,
  `game/*`, `storage/*`, `tools/*`, `public/assets/*`.

---

## Docs To Update In The Same Change

- `context/2-architecture.md` — `input.js` gains `touches` array; mention
  `maker/gestures.js` and the zoom model.
- `context/4-code-standards.md` § File Organization — `src/maker/` gains
  `gestures.js`.
- `context/6-progress-tracker.md` — unit in progress / complete, decisions.
- `context/7-current-issues.md` — mark `-webkit-touch-callout: none` as applied;
  record any issues found.

---

## Verification Checklist

### Mouse (regression — must still work exactly as Unit 13)

- [x] Left-drag paints tiles; autotile updates correctly
- [x] Right-drag erases from the active tool's layer
- [x] Middle-drag pans the camera
- [x] Ctrl+Z / Ctrl+Shift+Z undo and redo
- [x] Palette selection, eraser, entity placement all work
- [x] No console errors

### Touch — one finger

- [x] With the toggle in **paint** mode: one-finger drag paints (same as
      left-drag with a mouse)
- [x] With the toggle in **pan** mode: one-finger drag pans the camera
- [x] Switching the toggle immediately changes one-finger behaviour
- [x] Long-press (hold 300ms without moving) triggers the eyedropper: the
      palette selection changes to whatever is under the finger
- [x] Long-press on an empty cell does nothing (no crash, no selection change)
- [x] Moving past the threshold during a long-press starts painting instead

### Touch — two fingers

- [x] Two-finger drag pans the camera regardless of the toggle state
- [x] If painting was in progress when the second finger arrives, the paint
      drag finalizes cleanly (the partial command is pushed to the undo stack)
- [x] Pinch-out snaps zoom from 1× → 2× — visible area halves
- [x] Pinch-in snaps zoom from 1× → 0.5× — visible area doubles
- [x] Pinch can traverse all three levels: 0.5× → 1× → 2× and back
- [x] The pinch centre stays over the same world position after zoom
- [x] Painting at zoom 2× places tiles in the correct cells (no off-by-one)
- [x] Painting at zoom 0.5× places tiles in the correct cells

### Middle-click eyedropper (desktop)

- [x] Middle-clicking a terrain cell selects the terrain tool in the palette
- [x] Middle-clicking an entity cell selects that entity type
- [x] Middle-clicking an empty cell does nothing
- [x] Panning still works after the eyedropper fires (same press starts both)

### Grid overlay with zoom

- [x] Grid lines remain 1 device pixel at zoom 0.5×, 1× and 2×
- [x] Grid cull range adjusts correctly (no missing lines at zoom 0.5×)

### Recovery

- [x] Lifting one finger during a two-finger gesture returns to idle cleanly
- [x] Simulating `pointercancel` (switch apps mid-drag) leaves no stuck state
- [x] Tab blur during a paint drag finalizes the drag
- [x] No browser zoom, text selection or callout menu on any gesture
- [x] The toggle button only appears after the first touch (hidden for
      mouse-only users)

### Build

- [x] `npm test` — all existing 178 tests pass; new tests for `pickToolAt`
      and `screenToCell` with zoom
- [x] `npm run build` — no errors
- [x] Verified at a phone-sized viewport with Chrome DevTools touch emulation
      **and** a desktop viewport with a mouse
- [x] Docs above updated in the same change
