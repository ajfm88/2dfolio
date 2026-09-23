# Unit 15 — Maker Responsive UI

## What This Unit Builds

The maker's visual chrome: a top toolbar with navigation and action buttons, a
redesigned bottom palette with scrolling category tabs and a horizontally scrolling
tool strip, a level-size dialog, nine-slice `border-image` panels replacing the
flat token styling, safe-area insets on all edge-anchored chrome, and
`viewport-fit=cover`. The maker becomes usable at phone-sized viewports in both
orientations.

**Depends on:** Unit 14.

## Constraint That Shapes This Unit

Issue #1: the current nine-slice composites reproduce the kit's guide image (four
example panels at different sizes), not a proper nine-slice for `border-image`.
This must be fixed in the asset pipeline before any nine-slice CSS can work. The
workflow rules split asset pipeline changes from runtime code — this unit handles
the fix as a sequenced first step, verified independently before the runtime work
begins.

## Scope Boundary

This unit covers: nine-slice asset fix (Issue #1), top toolbar, tabbed palette
redesign, level-size dialog, `ResizeCommand`, nine-slice `border-image` on panels
and buttons, safe-area padding on all edge-anchored chrome, `viewport-fit=cover`,
and orientation handling.

This unit does **not** cover: test-play round trip with validation and transition
wipe (Unit 16), persistence or autosave or level list (Unit 17), title screen or
level select or scene manager (Unit 18), theme picker (Unit 20), level name editing
(Unit 17), audio in the maker, any new palette entries, nine-slice on the
play-mode HUD hearts/coins row (those use sprite crops, not panels), or changes to
`src/core/`, `src/game/`, or `src/level/`.

---

## Files

### New

| File | Role |
| --- | --- |
| `src/ui/maker-toolbar.js` | Top bar factory: Back, Undo, Redo, Play, Menu |
| `src/ui/styles/maker-toolbar.css` | Top bar styling |
| `src/ui/components/resize-dialog.js` | Level-size dialog |
| `src/ui/styles/resize-dialog.css` | Dialog styling |

### Modified

| File | Change |
| --- | --- |
| `tools/build-assets.mjs` | Fix `writeNineSlice` to produce proper 3×3 composites |
| `public/assets/ui/*.png` | Regenerated (5 nine-slice images change dimensions) |
| `src/data/atlas.json` | Regenerated (nine-slice entries update dimensions) |
| `src/ui/maker-palette.js` | Redesign: tabbed categories + scrolling tool strip |
| `src/ui/styles/maker-palette.css` | Tabbed palette styles, nine-slice background |
| `src/ui/styles/dialog.css` | Nine-slice `.panel` and `.btn` replace flat borders |
| `src/maker/maker-scene.js` | Mount/unmount toolbar, wire callbacks, sync state |
| `src/maker/commands.js` | `ResizeCommand` |
| `index.html` | `viewport-fit=cover` on viewport meta |
| `src/main.js` | Inject toolbar factory, wire `onBack`/`onPlay` |

### Not modified

- `src/core/` — no engine changes.
- `src/game/` — no play-mode changes.
- `src/level/` — `model.resize()` already exists; schema limits already exported.
- `src/storage/` — persistence is Unit 17.
- `src/maker/gestures.js`, `src/maker/tools.js`, `src/maker/grid-overlay.js` —
  unchanged.

---

## Step 1 — Fix Nine-Slice Composites (Issue #1)

**Do this first. Verify before proceeding to runtime code.**

### Problem

`writeNineSlice` in `tools/build-assets.mjs` takes 16 tiles (numbered 1–16 in the
kit), lays them out 4×4 in file-sort order, and produces a 128×128 (boards) or
56×56 (buttons) composite. But those 16 tiles form the kit's **guide image** — four
example panels at different sizes with gaps — not a nine-slice that `border-image`
can slice correctly.

Measured tile roles (1-based, row-major):

```
 1 TL   2 T   3 TR    4 (guide)
 5 L    6 M   7 R     8 (guide)
 9 BL  10 B  11 BR   12 (guide)
13 (guide) 14 (guide) 15 (guide) 16 (guide)
```

The usable nine-slice is the top-left 3×3: tiles 1,2,3 / 5,6,7 / 9,10,11.

### Fix

Change `writeNineSlice` to composite only the nine tiles that matter, arranged in a
proper 3×3 grid. The 16-file input stays (the kit ships 16 tiles), but only indices
0,1,2, 4,5,6, 8,9,10 (0-based) are used:

```
file[0] TL   file[1] T    file[2] TR
file[4] L    file[5] M    file[6] R
file[8] BL   file[9] B    file[10] BR
```

Output is `tile × 3` square:

| Asset | Tile | Old size | New size | Slice |
| --- | --- | --- | --- | --- |
| `board-yellow.png` | 32 | 128×128 | 96×96 | 32 |
| `board-green.png` | 32 | 128×128 | 96×96 | 32 |
| `paper-yellow.png` | 32 | 128×128 | 96×96 | 32 |
| `button-yellow.png` | 14 | 56×56 | 42×42 | 14 |
| `button-green.png` | 14 | 56×56 | 42×42 | 14 |

The function signature can keep accepting 16 files (the kit does not ship 9-file
folders), but the composite uses the 3×3 subset. Update the function name or add a
comment. The assertion changes from `files.length !== 16` to accepting both 9 and
16 (use only the first 11).

After the fix: `npm run assets` regenerates all five PNGs. Two consecutive runs
must be byte-identical. Each regenerated PNG shows a single panel with correct
corners, edges and fill — not the four-panel guide layout. `atlas.json` entries
update automatically (the `fw`/`fh` change); nothing in `src/` references these
clips at runtime yet, so no code breaks.

### Verification (Step 1 only)

- Open each regenerated PNG — it shows one complete panel, not the guide.
- `border-image-slice: 32` on a 96×96 board → correct 4 corners + 4 edges + fill.
- `border-image-slice: 14` on a 42×42 button → correct.

---

## Nine-Slice CSS (shared `.panel` and `.btn`)

With the composites fixed, upgrade the shared classes in `src/ui/styles/dialog.css`
from flat token styling to `border-image`. These classes are used by the play-mode
pause/results overlays, the new resize dialog, and the new maker chrome.

### `.panel`

Replace the flat `background` / `border` with:

```css
.panel {
  /* keep existing flex layout, gap, padding, color, etc. */
  border-style: solid;
  border-width: calc(16px * var(--ui-scale));
  border-image: url("/assets/ui/board-yellow.png") 32 fill /
                calc(16px * var(--ui-scale)) / 0 round;
  image-rendering: pixelated;
  background: none;  /* border-image fill covers the content area */
}
```

The `fill` keyword means the nine-slice centre fills the content area, so no
separate `background` is needed. `round` scales edge tiles to whole multiples,
preventing pixel-art tearing.

Variant classes:

```css
.panel--green {
  border-image-source: url("/assets/ui/board-green.png");
}
.panel--paper {
  border-image-source: url("/assets/ui/paper-yellow.png");
}
```

### `.btn`

Replace the flat `background` / `border` with:

```css
.btn {
  /* keep existing min-width, min-height, padding, cursor, font, etc. */
  border-style: solid;
  border-width: calc(7px * var(--ui-scale));
  border-image: url("/assets/ui/button-yellow.png") 14 fill /
                calc(7px * var(--ui-scale)) / 0 round;
  image-rendering: pixelated;
  background: none;
}
```

The `fill` covers the content area via the nine-slice centre tile. States:

- `:hover` — `translateY(-1px)` — unchanged.
- `:active` — `translateY(1px)` — unchanged. There is no pressed nine-slice variant
  in the pack; translate alone gives adequate feedback.
- `:disabled` — `opacity: 0.6; pointer-events: none` — unchanged; opacity dims the
  nine-slice naturally.
- `:focus-visible` — outline unchanged.

```css
.btn--primary {
  border-image-source: url("/assets/ui/button-green.png");
}
```

`.btn--ghost` keeps flat styling (no nine-slice, text-only with underline). No
change needed.

---

## Top Bar (`src/ui/maker-toolbar.js`)

### Layout

```
┌───────────────────────────────────────────────┐
│ [←]  [Undo] [Redo]               [▶ Play] [≡]│
└───────────────────────────────────────────────┘
```

Fixed to the top of the viewport. Nine-slice `.panel--board` background. Two
groups: left (Back, Undo, Redo) and right (Play, Menu), with `justify-content:
space-between`.

### Factory

```js
/**
 * @param {HTMLElement} root
 * @param {{
 *   onBack: () => void,
 *   onPlay: () => void,
 *   onUndo: () => void,
 *   onRedo: () => void,
 *   onResize: () => void,
 * }} opts
 * @returns {ToolbarController}
 */
export function createMakerToolbar(root, opts)
```

Injected into the maker scene via `params.ui.createToolbar`.

### Controller

```js
/** @typedef {{
 *   sync: (state: { canUndo: boolean, canRedo: boolean, canPlay: boolean }) => void,
 *   destroy: () => void,
 * }} ToolbarController */
```

`sync` is called from the scene's `render()` each frame. It diff-checks each
boolean against its previous value and only touches the DOM on change (toggling
`disabled` on Undo, Redo and Play buttons).

### Buttons

All buttons use the `.btn` nine-slice (yellow). Play uses `.btn--primary` (green).
Every button is at least 44 × 44 CSS pixels and has `:focus-visible`.

| Button | Label | Action |
| --- | --- | --- |
| **Back** | `←` (left-arrow glyph, CSS-drawn or text character) | Calls `opts.onBack()` |
| **Undo** | Text "Undo" | Calls `opts.onUndo()`. Disabled when `!canUndo`. |
| **Redo** | Text "Redo" | Calls `opts.onRedo()`. Disabled when `!canRedo`. |
| **Play** | Text "Play" | Calls `opts.onPlay()`. Disabled when `!canPlay`. `.btn--primary`. |
| **Menu** | Three horizontal bars (CSS-drawn, same technique as the pause button's two `--ink` bars) | Toggles the menu panel. |

Back uses a left-pointing chevron drawn with two CSS pseudo-element lines (angular,
no `border-radius`), or the Unicode `←` character — whichever renders cleanly in
Pixelify Sans with the system-ui fallback.

### Menu Panel

A small positioned element below the Menu button, hidden by default:

```html
<div class="maker-toolbar__menu-panel" hidden>
  <button class="maker-toolbar__menu-item">Resize Level</button>
</div>
```

- Opens/closes on Menu button click (toggle `hidden`).
- Clicking "Resize Level" calls `opts.onResize()` and closes the panel.
- Clicking anywhere outside the menu panel closes it (a one-time `pointerdown`
  listener on `window`, added on open, removed on close — inside `input.js`?
  No — this is a DOM-only interaction in `ui/`, not a game input. A plain
  `addEventListener` in the toolbar factory is correct here, scoped to the menu
  lifecycle).
- The menu panel uses `.panel--paper` nine-slice background.
- The menu item is a plain button with `.btn` styling.
- Future units add items here (theme picker Unit 20, settings Unit 19). This unit
  builds only the one item.

### Keyboard Shortcuts Alongside Buttons

Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y and `M` continue to work alongside the toolbar
buttons. Both paths call the same underlying functions (stack.undo, stack.redo,
mode switch). The toolbar buttons are the touch-friendly version; keyboard shortcuts
are the desktop version.

---

## Redesigned Palette (`src/ui/maker-palette.js`)

### From Flat Groups to Tabs

**Current:** one horizontally scrolling row containing all groups (each with a
label and its items), all visible at once.

**New:** two-row bar — category tabs on top, tool buttons for the selected
category below.

```
┌───────────────────────────────────────────────┐
│ [Terrain] [Platforms] [Water] [Treasure] ...  │ ← tab row, scrolls-x
│ [item] [item] [item] [item] ... [eraser]      │ ← tool strip, scrolls-x
└───────────────────────────────────────────────┘
```

### DOM Structure

```
div.maker-palette
  div.maker-palette__tabs                  (overflow-x: auto)
    button.maker-palette__tab[data-group]  × N  (one per non-empty group)
  div.maker-palette__strip                 (overflow-x: auto)
    button.maker-palette__item[data-id]    × (items in active group)
    button.maker-palette__item--eraser     (always last)
```

### Behaviour

- On mount, create tab buttons for each group in `PALETTE_ORDER` that has at least
  one entry. Groups with zero entries (decor) are hidden.
- Pre-create all item buttons, grouped by category, with their icon canvases drawn
  once on creation. Store them in a `Map<string, HTMLButtonElement[]>` keyed by
  group id.
- The first tab with entries is selected by default (Terrain).
- **Tab switch:** clear `.maker-palette__strip`, append the selected group's
  pre-created buttons, then append the eraser button at the end. Reset the strip's
  `scrollLeft` to 0.
- The active tab has class `--active` with a `--accent` underline or background
  highlight.
- Touch scrolling on both rows is native: `overflow-x: auto`,
  `touch-action: pan-x` on both `.maker-palette__tabs` and `.maker-palette__strip`.
  Hide scrollbars with `scrollbar-width: none` /
  `::-webkit-scrollbar { display: none }`.
- Tab buttons use flat styling: `--board` background, `--ink` bottom border for the
  active tab, no nine-slice. They are compact text labels at `--fs-sm`.
- Tool item buttons keep their existing flat styling with `--accent` border for
  selection. They are **not** nine-sliced — the 7px button border would eat too
  much of the 44px icon button.
- The eraser button stays visually distinct (`--stone` background, `--danger` when
  selected).

### Controller API (unchanged)

```js
{
  getSelectedEntry(): PaletteEntry | null,
  isErasing(): boolean,
  selectById(id: string): void,
  destroy(): void,
}
```

The maker scene continues to use the same controller shape. `selectById` (used by
the eyedropper) must also switch to the correct tab if the selected entry is in a
different group.

### Nine-Slice Background

The palette bar itself uses a nine-slice `.panel--board` background via
`border-image`. Its top border is the nine-slice; its bottom is flush with the
viewport edge (plus safe-area inset).

---

## Level-Size Dialog (`src/ui/components/resize-dialog.js`)

### Opening

Opened from the Menu dropdown's "Resize Level" item. The scene's `onResize`
callback creates and shows the dialog.

### DOM Structure

A centered `.panel` (nine-slice board) over a `--scrim` backdrop:

```
div.overlay
  div.panel.resize-dialog
    h2.panel__title             "Level Size"
    div.resize-dialog__fields
      label                     "Width"
        input[type=number]      min=40 max=400 step=1
        span                    "cols"
      label                     "Height"
        input[type=number]      min=12 max=48 step=1
        span                    "rows"
    p.resize-dialog__hint       "40–400 × 12–48"
    p.resize-dialog__warning    (shown when shrinking)
    div.panel__actions
      button.btn                "Cancel"
      button.btn--primary       "Apply"
```

### Behaviour

- Width and height `<input type="number">` pre-filled with `level.cols` and
  `level.rows`.
- The `min`/`max`/`step` attributes provide native validation. Additionally, the
  Apply button is disabled when either value is out of range or not an integer.
- **Shrink warning:** when `newCols < level.cols || newRows < level.rows`, show the
  warning line: "Content outside the new bounds will be removed." Shown/hidden on
  `input` events.
- **Apply:** import `COLS_MIN`, `COLS_MAX`, `ROWS_MIN`, `ROWS_MAX` from
  `level/schema.js`. Validate the parsed integers. If valid, call the `onApply`
  callback with `(newCols, newRows)`. Close the dialog.
- **Cancel / Escape / backdrop click:** close with no changes.
- Focus is trapped in the dialog (Tab cycles between the two inputs and the two
  buttons). First input gets focus on open.
- The dialog is a one-off DOM tree created on open and removed on close.

### Factory

```js
/**
 * @param {HTMLElement} root
 * @param {{
 *   cols: number,
 *   rows: number,
 *   onApply: (cols: number, rows: number) => void,
 * }} opts
 */
export function openResizeDialog(root, opts)
```

The scene provides `onApply` which creates and executes a `ResizeCommand`.

---

## `ResizeCommand` (`src/maker/commands.js`)

A new command type for the command stack.

### Shape

```js
{
  type: 'resize',
  newCols, newRows,
  snapshot: {
    cols, rows,
    terrain: Uint8Array,     // full copy of old layer
    platform: Uint8Array,
    water: Uint8Array,
    entities: [...],         // shallow copy of old array
    decor: [...],
    spawn: { c, r },
    goal: { c, r } | null,
  },
  onResize: () => void,      // rebuild parallax + re-clamp camera
}
```

### execute(model)

1. Call `model.resize(newCols, newRows)`.
2. Call `onResize()`.

### undo(model)

1. Restore `model.cols`, `model.rows` from the snapshot.
2. Restore each layer: `model.layers.terrain = new Uint8Array(snapshot.terrain)`,
   etc. (copy, not alias — redo needs the snapshot intact).
3. Restore `model.entities` and `model.decor` (shallow copies).
4. Restore `model.spawn` and `model.goal`.
5. Call `onResize()`.

### hasChanges()

Always true — a resize command is never empty (the dialog only creates one when the
dimensions actually change).

### Memory cost

Bounded. Max layer: 400 × 48 = 19 200 bytes × 3 = ~58 KB. Entity and decor arrays
are at most 400 + 2000 = 2400 references. Negligible for a single undo entry. The
command stack cap (100) bounds total memory.

---

## Scene Integration (`src/maker/maker-scene.js`)

### `enter(params)` Changes

`params.ui` gains `createToolbar`:

```js
ui: {
  createPalette: Function,
  createToggle?: Function,
  createToolbar: Function,
}
```

`params` gains `onBack` and `onPlay` callbacks:

```js
onBack: () => void,
onPlay: () => void,
```

### `mountUI(root)` Changes

Create the toolbar:

```js
toolbar = params.ui.createToolbar(root, {
  onBack: () => params.onBack(),
  onPlay: () => params.onPlay(),
  onUndo: () => { if (!dragState && stack.canUndo()) stack.undo(level); },
  onRedo: () => { if (!dragState && stack.canRedo()) stack.redo(level); },
  onResize: () => {
    openResizeDialog(root, {
      cols: level.cols,
      rows: level.rows,
      onApply: (newCols, newRows) => {
        if (newCols === level.cols && newRows === level.rows) return;
        const cmd = createResizeCommand(level, newCols, newRows, () => {
          parallax = createParallax(level, params.theme, params.atlas);
          const d = dims();
          params.camera.panBy(0, 0, d.worldW, d.worldH, d.eW, d.eH);
        });
        stack.execute(cmd, level);
      },
    });
  },
});
```

The `onResize` callback in the resize command rebuilds the parallax (the horizon
may change when water rows are added or removed) and re-clamps the camera to the
new level bounds.

### `unmountUI()` Changes

Destroy the toolbar alongside the palette and toggle.

### `render(ctx, cam)` Changes

After existing render code, sync the toolbar:

```js
if (toolbar) {
  toolbar.sync({
    canUndo: stack.canUndo(),
    canRedo: stack.canRedo(),
    canPlay: level.goal !== null,
  });
}
```

This is the same pattern as the play-scene HUD reconciliation — render reads state,
syncs DOM, never mutates game state.

---

## Safe-Area Padding

### `index.html`

Add `viewport-fit=cover`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

Without this, `env(safe-area-inset-*)` resolves to `0` on all browsers.

### Top Bar

```css
.maker-toolbar {
  padding-top: calc(env(safe-area-inset-top) + 6px * var(--ui-scale));
  padding-left: calc(env(safe-area-inset-left) + 8px * var(--ui-scale));
  padding-right: calc(env(safe-area-inset-right) + 8px * var(--ui-scale));
}
```

### Bottom Palette

Already has `padding-bottom: calc(env(safe-area-inset-bottom) + ...)`. Add
left/right:

```css
.maker-palette {
  padding-left: calc(env(safe-area-inset-left) + 8px * var(--ui-scale));
  padding-right: calc(env(safe-area-inset-right) + 8px * var(--ui-scale));
}
```

### Paint/Pan Toggle

Already positioned above the palette with a `right` offset. Add
`env(safe-area-inset-right)` to its right position:

```css
right: calc(env(safe-area-inset-right) + 12px * var(--ui-scale));
```

---

## Orientation Handling

No orientation lock. Both portrait and landscape work. The existing `--ui-scale`
formula (`clamp(1, floor(min(vw/480, vh/320)), 3)`) already adapts on resize.

In portrait: the top bar and bottom palette take more proportional screen height.
Category tabs are more likely to need horizontal scrolling. The canvas between the
bars is still usable — at 360-unit virtual height, with bars at roughly
`72px * ui-scale` each, the effective canvas is narrower but functional.

In landscape: full-width bars with plenty of room. Tabs typically fit without
scrolling.

No orientation-specific CSS is needed beyond the responsive patterns already in this
unit (scrolling tabs, flexible layout, safe-area insets).

---

## Dev Bridge (`src/main.js`) Changes

1. Import `createMakerToolbar` and `openResizeDialog`.
2. Pass `createToolbar: createMakerToolbar` in `params.ui`.
3. Pass `onBack: () => {}` (no destination in the dev bridge — does nothing;
   Unit 18 wires it to level select).
4. Pass `onPlay: () => switchToPlay()` (the existing mode-switch function, which
   already checks `level.goal === null` and logs a console warning).
5. The `M` key continues to work alongside the Play button.

---

## Not Built

- Test-play round trip with validation, transition wipe, lossless return (Unit 16).
  The Play button triggers the same `M`-key bridge mechanism; proper validation UI
  is Unit 16.
- Persistence: autosave, level list, share codes, `.json` export (Unit 17).
- Title screen, level select, scene manager (Unit 18).
- Menu items beyond "Resize Level." Theme picker is Unit 20, settings is Unit 19.
- Level name editing — part of persistence (Unit 17).
- Audio in the maker (no music, no SFX while editing).
- Any new palette entries.
- Toast component — the Play button is disabled when no goal exists; no separate
  feedback message needed (Unit 16 adds proper validation display).
- Nine-slice on the play-mode HUD hearts/coins row (sprite crops, not panels).
- Changes to `src/core/`, `src/game/`, `src/level/` (aside from the regenerated
  `atlas.json`).

---

## Docs To Update In The Same Change

- `context/3-ui-context.md` — update nine-slice composite dimensions from
  128×128 → 96×96 (boards/papers) and 56×56 → 42×42 (buttons). Note that panels
  and buttons now use nine-slice `border-image`, not flat fills.
- `context/4-code-standards.md` § File Organization — `src/ui/` gains
  `maker-toolbar.js`; `src/ui/components/` gains `resize-dialog.js`.
- `context/6-progress-tracker.md` — unit in progress / complete, decisions taken.
- `context/7-current-issues.md` — resolve Issue #1 (nine-slice). Resolve Open
  Question #4 (level growth UX: dialog). Record any issues found.

---

## Verification Checklist

### Nine-slice composites (Step 1 — verify before runtime work)

- [ ] `npm run assets` regenerates the five nine-slice PNGs at their new
      dimensions (96×96 boards/papers, 42×42 buttons)
- [ ] Two consecutive runs are byte-identical
- [ ] Each regenerated PNG shows a single panel with correct corners, edges and
      fill — not the four-panel guide layout

### Nine-slice CSS

- [ ] `.panel` (pause/results overlay) renders with a nine-slice board background
      instead of the flat fill
- [ ] `.btn` and `.btn--primary` render with nine-slice button backgrounds
- [ ] Disabled buttons dim correctly (opacity on the nine-slice)
- [ ] `:hover` and `:active` states still work (translate)
- [ ] `:focus-visible` outline is visible on every button
- [ ] No `border-radius` anywhere

### Top bar

- [ ] Top bar renders at the top of the viewport with a nine-slice board background
- [ ] Back button is present and fires its callback
- [ ] Undo button undoes the last edit; visually disabled when stack is empty
- [ ] Redo button redoes; visually disabled when nothing to redo
- [ ] Undo and Redo are disabled during an active paint drag
- [ ] Play button switches to play mode when a goal is placed
- [ ] Play button is disabled when `level.goal === null`
- [ ] Menu button opens a dropdown panel with "Resize Level"
- [ ] Clicking outside the dropdown closes it
- [ ] All buttons ≥ 44 × 44 CSS pixels
- [ ] Keyboard shortcuts (Ctrl+Z, Ctrl+Y, `M`) still work alongside the buttons

### Palette

- [ ] Category tabs are visible at the top of the palette bar
- [ ] Tapping a tab switches the tool strip to show that category's tools
- [ ] The active tab is visually highlighted
- [ ] The tool strip scrolls horizontally when tools overflow
- [ ] The tab row scrolls horizontally at phone-portrait width
- [ ] Eraser is always visible at the end of the tool strip regardless of tab
- [ ] Groups with no entries (decor) are hidden from the tab row
- [ ] Selecting a tool from a different tab highlights it and works for painting
- [ ] The eyedropper (`selectById`) switches to the correct tab when the picked
      tool is in a different group
- [ ] The palette bar uses nine-slice board background

### Resize dialog

- [ ] "Resize Level" from the menu opens a centred dialog with current dimensions
- [ ] Apply with larger dimensions grows the level; existing content is preserved
- [ ] Apply with smaller dimensions shrinks the level; content is clipped
- [ ] Warning text appears when shrinking
- [ ] Resize is undoable — Ctrl+Z restores original dimensions and all content
- [ ] Resize is redoable
- [ ] After resize, the parallax updates (horizon shifts if water rows
      added/removed)
- [ ] After resize, the camera re-clamps to the new level bounds
- [ ] Cancel, Escape and backdrop click close the dialog with no changes
- [ ] Focus is trapped in the dialog (Tab cycles within it)
- [ ] Invalid dimensions (outside 40–400 × 12–48) prevent Apply
- [ ] Resizing to the same dimensions does nothing (no empty command pushed)

### Safe area

- [ ] `viewport-fit=cover` is in the viewport meta tag
- [ ] Top bar accounts for `safe-area-inset-top`
- [ ] Bottom palette accounts for `safe-area-inset-bottom` (verify existing)
- [ ] Left/right insets on both bars
- [ ] Paint/pan toggle respects `safe-area-inset-right`

### Orientation and responsiveness

- [ ] Phone-portrait width: both bars usable, tabs scroll, tools scroll, canvas
      between bars is clear and paintable
- [ ] Phone-landscape width: comfortable layout
- [ ] Desktop width: comfortable layout, tabs likely fit without scrolling
- [ ] Chrome never covers the cell under the thumb
- [ ] `--ui-scale` adapts correctly on resize / orientation change

### Regression

- [ ] Mouse painting, erasing, entity placement, markers — all work
- [ ] Touch gestures: paint, pan, pinch zoom, long-press eyedropper — all work
- [ ] Paint/pan toggle works
- [ ] Undo/redo from keyboard still works
- [ ] `M` key still toggles modes
- [ ] Play-mode pause/results overlays render with the new nine-slice panels
- [ ] `npm test` — all 191 tests pass, plus any new tests for `ResizeCommand`
- [ ] `npm run build` — no errors
- [ ] No console errors during a full editing session
- [ ] Verified at phone-sized viewport in both orientations with touch emulation
- [ ] Verified at desktop viewport with a mouse
