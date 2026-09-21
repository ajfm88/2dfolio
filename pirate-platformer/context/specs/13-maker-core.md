# Unit 13 — Maker Core

## What This Unit Builds

A level editor that runs in the browser with a mouse. Select a tool from the
palette, click or drag across the grid to paint terrain, platforms, water,
treasure, enemies, hazards and markers. Right-click or switch to the eraser to
remove them. Every edit goes through a command stack so Ctrl+Z and Ctrl+Shift+Z
undo and redo exactly. The maker renders the level with the same `level/render.js`
the play scene uses, with a grid overlay and static entity previews on top.

**Depends on:** Unit 07 (palette, level loader). Enemies from Units 10–11 appear
automatically because the palette drives the tool list.

## Constraint That Shapes This Unit

The command stack ships **with** painting, not after it. Invariant 7: "Every maker
edit goes through the command stack. UI code never mutates `LevelModel` directly,
or undo silently breaks." A commit that paints without undo violates the invariant
from birth.

Known-risk 10 applies: a paint drag can cross hundreds of cells. Coalesce one drag
into one command, store the inverse as a compact diff (not a snapshot), and cap the
stack at 100 entries.

## Scope Boundary

This unit covers: the `MakerScene`, camera panning (keyboard + middle-mouse),
the grid overlay, the palette DOM (basic, functional, desktop-mouse-usable),
tool selection, tile painting and erasing by drag, entity/decor placement and
removal by click-drag, marker placement by click, per-cell dedupe, the full
command stack with undo/redo, static entity/decor/marker preview rendering, and
a throwaway dev bridge in `main.js` to enter and leave the maker for verification.

This unit does **not** cover: touch gestures (Unit 14), responsive palette UI with
scrolling tabs and a top bar (Unit 15), test-play round trip with validation and
transitions (Unit 16), persistence (Unit 17), or any new palette entries.

## Files

### New

| File | Role |
| --- | --- |
| `src/maker/maker-scene.js` | Scene lifecycle, input→tool dispatch, camera, render pipeline |
| `src/maker/commands.js` | `CommandStack` plus the three command types |
| `src/maker/grid-overlay.js` | Grid lines, cursor highlight, ghost preview — all canvas |
| `src/maker/tools.js` | Tool logic: given a palette entry and a cell action, produce a command |
| `src/ui/maker-palette.js` | Palette DOM: injected factory, reads `palette.js`, returns a controller |
| `src/ui/styles/maker-palette.css` | Palette styling — flat tokens, no nine-slice (that is Unit 15) |

### Modified

| File | Change |
| --- | --- |
| `src/level/model.js` | `createEmptyModel(opts)` factory for fresh maker levels; `goal` may be `null` during editing |
| `src/core/input.js` | Expose `pointer.button`; add `undo` and `redo` edge-triggered actions (Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y) |
| `src/core/camera.js` | `panBy(dx, dy, worldW, worldH, viewW, viewH)` method for direct camera movement |
| `src/data/palette.js` | `defaultProps` on entries that need them; `PALETTE_ORDER` constant for the maker tab order |
| `src/main.js` | Dev bridge: press `M` to toggle between play and maker |

## `src/level/model.js` — Fresh Level Factory

Add `createEmptyModel(opts)` as a **named export** alongside the `LevelModel`
class. It builds a model without going through `schema.js` validation (which
requires a goal), because a brand-new level has no goal yet.

```js
/**
 * @param {{ cols?: number, rows?: number, theme?: string }} [opts]
 * @returns {LevelModel}
 */
export function createEmptyModel(opts = {})
```

- `format: 1`
- `id`: `'lvl_' + <8 random alphanumeric chars>` (use `crypto.getRandomValues`)
- `name`: `''`
- `author`: `''`
- `theme`: `opts.theme ?? 'island'`
- `cols`: `opts.cols ?? 160`, `rows`: `opts.rows ?? 24`
- `created` and `modified`: `Date.now()`
- `spawn`: `{ c: 4, r: rows - 6 }`
- `goal`: **`null`** — the user explicitly places it
- All tile layers: `new Uint8Array(cols * rows)` (all zeros)
- `entities`: `[]`, `decor`: `[]`

**`goal: null` during editing.** Change the `LevelModel` constructor and the
`goal` property to accept `null`. The `resize` method must guard on `this.goal`
being non-null before clamping. `codec.serialise` must throw if `goal` is still
null — a level without a goal cannot be saved or shared. The play-mode path
(`deserialise` → `validateLevel`) already enforces goal presence, so nothing else
changes.

## `src/core/input.js` — Maker Extensions

### Pointer button

The maker needs to distinguish left, right and middle clicks. Currently `pointer`
tracks position and down/up but not which button.

Add `pointer.button`: the `MouseEvent.button` value of the active press (0 left,
1 middle, 2 right). Set it in `onPointerDown`; clear to `0` in `onPointerUp`.
Context menu must be suppressed on the canvas (`contextmenu` event →
`preventDefault`), or right-click opens the browser menu instead of erasing.

### Undo / redo actions

Add two edge-triggered actions: `undo` (Ctrl+Z) and `redo` (Ctrl+Shift+Z **or**
Ctrl+Y). These are **not** mapped through `KEY_TO_DIR` — they are modifier combos.

In `onKeyDown`, before the existing `dirFromEvent` lookup:

```
if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
  if (e.shiftKey) want.redo = true; else want.undo = true;
  e.preventDefault();
  return;
}
if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
  want.redo = true;
  e.preventDefault();
  return;
}
```

In `onKeyUp`, clear the corresponding want flag on the matching condition. Add
`undo` and `redo` to the `ACTIONS` array, `want`, `virtual` and `keys` objects.

### Mode-switch key

Add `KeyM` → action `'modeSwitch'` as a simple entry in `KEY_TO_DIR` (not a
modifier combo). Edge-triggered like the others. Used only by the dev bridge in
`main.js`.

## `src/core/camera.js` — `panBy`

The existing `follow` method tracks a target point; the maker needs direct manual
movement. Add:

```js
/**
 * @param {number} dx  world px
 * @param {number} dy  world px
 * @param {number} worldW
 * @param {number} worldH
 * @param {number} viewW
 * @param {number} viewH
 */
function panBy(dx, dy, worldW, worldH, viewW, viewH) {
  let x = cam.x + dx;
  let y = cam.y + dy;
  // Allow 2 tiles of margin past the level edges so the boundary is visible.
  const margin = TILE * 2;
  x = Math.max(-margin, Math.min(x, worldW - viewW + margin));
  y = Math.max(-margin, Math.min(y, worldH - viewH + margin));
  cam.x = Math.round(x);
  cam.y = Math.round(y);
}
```

Import `TILE` from `settings.js`. Expose `panBy` on the returned object alongside
`follow`. Also expose direct setters for `x` and `y` — the maker needs to
initialise the camera position on enter (e.g. to view the spawn).

## `src/data/palette.js` — Maker Additions

### `defaultProps`

Entities that carry per-instance properties need a default for fresh placements.
Add a `defaultProps` field to the `PaletteEntry` typedef and to each entry that
needs it:

| Entry | `defaultProps` |
| --- | --- |
| `crabby` | `{ dir: -1 }` |
| `fierce_tooth` | `{ dir: -1 }` |
| `pink_star` | `{ dir: -1 }` |
| `cannon` | `{ dir: -1 }` |
| `seashell` | `{ dir: -1 }` |

Entries without `defaultProps` (coins, diamonds, skull, potions, spikes, tiles,
markers) are placed with no `p` field.

### `PALETTE_ORDER`

The project overview specifies the palette tab order: Terrain, Platforms, Water,
Treasure, Enemies, Hazards, Decor, Markers. Export a constant that the palette UI
reads:

```js
export const PALETTE_ORDER = [
  'terrain', 'platforms', 'water', 'treasure',
  'enemies', 'hazards', 'decor', 'markers',
];
```

Groups not present in the registry are shown empty (decor has no entries in v1).

## Tool Model (`src/maker/tools.js`)

The tool model answers: "given a selected palette entry and a cell, what should
happen to the level model?" It produces the data for a command but does not
execute it or touch the DOM.

### Active tool state

The maker scene holds:

```js
/** @type {PaletteEntry | null} */
let activeTool = null;
let erasing = false;  // true when the eraser is selected
```

### Pointer-to-cell conversion

Screen coordinates → world coordinates → cell:

```js
function screenToCell(pointerX, pointerY, cam) {
  const wx = pointerX + cam.x;
  const wy = pointerY + cam.y;
  const c = Math.floor(wx / TILE);
  const r = Math.floor(wy / TILE);
  return { c, r };
}
```

Out-of-bounds cells (negative, or ≥ cols/rows) are ignored — no painting.

### Tool dispatch

| Pointer button | Eraser active | `activeTool.placement` | Action |
| --- | --- | --- | --- |
| Left (0) | no | `'tile'` | Paint: set `model.layers[tool.layer][c,r] = 1` |
| Left (0) | no | `'entity'` | Place: add `{k: tool.id, c, r, p: tool.defaultProps}`, replacing any existing entity at `(c,r)` |
| Left (0) | no | `'decor'` | Place: add `{k: tool.id, c, r}`, replacing any existing decor at `(c,r)` |
| Left (0) | no | `'marker'` | Move: set `model.spawn` or `model.goal` to `{c, r}`. For goal, first click places it (from null); subsequent clicks move it. |
| Left (0) | yes | any | Erase-all at cell: clear terrain/platform/water to 0, remove entity, remove decor. Never removes markers. |
| Right (2) | — | `'tile'` | Erase: set `model.layers[tool.layer][c,r] = 0` |
| Right (2) | — | `'entity'` or `'hazards'` | Remove: delete entity at `(c,r)` if any |
| Right (2) | — | `'decor'` | Remove: delete decor at `(c,r)` if any |
| Right (2) | — | `'marker'` | No-op — markers cannot be erased |
| Right (2) | yes | — | Same as left+eraser |
| Middle (1) | — | — | Camera pan (no painting) |

When no tool is selected (`activeTool === null` and not erasing), left-click is
a no-op. Arrow keys always pan the camera regardless of tool state.

### Entity replacement rule

A cell holds at most one entity and one decor (separately). Painting an entity
onto a cell that already has one **replaces** it — the old entity is recorded in
the command's inverse so undo restores it. Same for decor. Entities and decor
coexist at the same cell (a palm behind an enemy is valid).

## Command Stack (`src/maker/commands.js`)

### `CommandStack`

```js
export class CommandStack {
  constructor(maxSize = 100) {}

  /** Execute a command and push it. Clears the redo tail. Enforces cap. */
  execute(command, model) {}

  /** Undo the most recent command. */
  undo(model) {}

  /** Redo the most recently undone command. */
  redo(model) {}

  canUndo() {}
  canRedo() {}
}
```

Internal state: `commands` array and `index` (the position after the last executed
command). Invariants:

- `execute`: clear `commands[index..]` (discard redo tail), push `command`, call
  `command.execute(model)`, increment `index`. If `commands.length > maxSize`,
  shift the oldest and decrement `index`.
- `undo`: decrement `index`, call `commands[index].undo(model)`.
- `redo`: call `commands[index].execute(model)`, increment `index`.
- `canUndo`: `index > 0`. `canRedo`: `index < commands.length`.

### Command Types

Each command has `execute(model)` and `undo(model)`.

#### `TilePaintCommand`

Created by a drag that paints or erases tile cells.

```js
{
  layer: LayerName,             // 'terrain', 'platform', or 'water'
  changes: [                    // one per distinct cell touched
    { c, r, oldValue, newValue }
  ],
}
```

- `execute`: for each change, `model.set(layer, c, r, newValue)`.
- `undo`: for each change, `model.set(layer, c, r, oldValue)`.

No-change entries (where `oldValue === newValue`) are **never** recorded.

#### `EntityCommand`

Created by a drag that places or removes entities.

```js
{
  placed: EntityRecord[],       // entities added
  removed: EntityRecord[],      // entities that were replaced or erased
}
```

- `execute`: remove each `removed` from `model.entities` (match on `c` + `r`),
  then add each `placed`.
- `undo`: remove each `placed` from `model.entities`, then add each `removed`.

Same structure for a `DecorCommand` operating on `model.decor`.

#### `MarkerMoveCommand`

Created by clicking with a marker tool.

```js
{
  marker: 'spawn' | 'goal',
  oldCell: Cell | null,         // null for goal's first placement
  newCell: Cell,
}
```

- `execute`: `model[marker] = { c: newCell.c, r: newCell.r }`.
- `undo`: `model[marker] = oldCell ? { c: oldCell.c, r: oldCell.r } : null`.

#### `EraseAllCommand`

Created by the eraser tool on a cell that has content across multiple layers.

```js
{
  tileChanges: [{ layer, c, r, oldValue }],   // only non-zero cells
  removedEntities: EntityRecord[],
  removedDecor: DecorRecord[],
}
```

- `execute`: set each tile to 0, remove entities, remove decor.
- `undo`: restore tiles, re-add entities, re-add decor.

### Drag Coalescing

When a drag begins (pointerdown), the scene creates a pending batch (an empty
command of the appropriate type). Each `pointermove` that reaches a new cell adds
to the batch. On `pointerup`, the batch is finalized:

- If the batch has zero actual changes (every cell was already in the target
  state), discard it — do not push an empty command.
- Otherwise, push it to the `CommandStack` (which calls `execute`).

**Per-cell dedupe:** the batch tracks a `Set` of visited cell keys
(`r * cols + c`). If a cell is already in the set, it is skipped. This prevents
recording the same cell twice when the pointer crosses it multiple times during
one drag.

## MakerScene (`src/maker/maker-scene.js`)

### Factory

```js
export function createMakerScene()
```

Returns the standard scene shape: `enter`, `exit`, `update`, `render`, `mountUI`,
`unmountUI`. Created once by `main.js`.

### `enter(params)`

```js
/**
 * @param {{
 *   level?: LevelModel,       // edit an existing level, or omit for fresh
 *   theme: Theme,
 *   atlas: Atlas,
 *   input: Input,
 *   camera: Camera,
 *   viewport: Viewport,
 *   ui: { createPalette: Function },
 * }} params
 */
```

- If `params.level` is provided, use it. Otherwise create a fresh one with
  `createEmptyModel()`.
- Create a `Parallax` instance for the level (`createParallax`).
- Create a `CommandStack`.
- Reset tool state: `activeTool = null`, `erasing = false`.
- Set the camera to view the spawn point: pan so that `spawn` is roughly centred
  horizontally and the vertical view shows the bottom portion of the level (where
  ground typically is).

### `exit()`

Clear internal references. The level model is kept alive by the caller (`main.js`)
if the dev bridge needs it.

### `update(dt)`

**Input is advanced by the scene** (`input.advance()`), same as play-scene.

Order:

1. **Undo / redo** — if `keys.undo.pressed`, call `commandStack.undo(level)`.
   If `keys.redo.pressed`, call `commandStack.redo(level)`.
2. **Camera pan** — arrow keys (or WASD): `panBy(speed * dt, …)` where
   `speed = 300` px/s. Middle-mouse drag: track the pointer delta between frames
   and call `panBy(-dx, -dy, …)` (inverted so the world follows the hand).
3. **Painting** — process pointer state (see Interaction Loop below).
4. **Parallax update** — `parallax.update(dt, cam.x, viewW)` so clouds drift
   and reflections animate.

**No DOM in update. No game state mutation in render.** Invariant 3 holds.

### Interaction Loop (inside `update`)

Track a `dragState`:

```js
let dragState = null;  // { batch, dedupeSet, button }
```

- **`pointer.pressed`** (left or right, not middle):
  - Convert `pointer.x, pointer.y` to a cell via `screenToCell`.
  - Determine the action from the tool dispatch table.
  - If the action is a no-op (e.g. right-click on a marker), do nothing.
  - Create a `dragState` with an empty batch of the appropriate command type and
    a `dedupeSet`.
  - Apply the first cell to the batch (record old→new, but do **not** push to
    the stack yet — the command is executed immediately on the model for instant
    visual feedback, but only pushed to the stack on pointer-up).

  Wait — **immediate feedback requires immediate model mutation**, which means
  the command must be applied cell-by-cell during the drag, and then rolled into
  one stack entry on release. To avoid violating invariant 7 (never mutate the
  model except through commands), the drag applies changes to the model directly
  and **records them in the batch**. On release, the batch (which now holds
  every change made) is pushed as a single command. If the user releases without
  the drag being finalized (e.g. the page loses focus), treat it as a release.

- **`pointer.down` (ongoing drag):**
  - Only if `dragState` is active and `pointer.button` matches `dragState.button`.
  - Convert pointer to cell. If cell is in the dedupe set, skip. Otherwise add
    to dedupe set and apply the cell action to the model, recording the diff
    in the batch.

- **`pointer.released`:**
  - Finalize the drag: if the batch has any actual changes, push it to the
    `CommandStack` (as an already-executed command — the stack records it
    without re-executing). If no changes, discard.
  - Clear `dragState`.

**For entity/decor/marker tools**, the drag still works — dragging with an entity
tool places one entity per cell crossed. This is consistent and useful for placing
rows of items. Per-cell dedupe prevents duplicates.

### `render(ctx, cam)`

Draw order:

1. `drawLevel(ctx, cam, viewW, viewH, level, theme, atlas, parallax)` —
   parallax, tiles, reflections. Reused from `level/render.js`.
2. **Entity and decor previews** — iterate `level.entities` and `level.decor`,
   draw each one's icon clip (first frame) at its cell position.
3. **Marker previews** — draw `spawn` icon at `level.spawn`; draw `goal` icon
   at `level.goal` if non-null.
4. **Grid overlay** — `drawGrid(ctx, cam, viewW, viewH, level.cols, level.rows)`.
5. **Cursor highlight and ghost preview** — if the pointer is over the grid,
   highlight the cell under the cursor and, if a tool is selected, draw a
   semi-transparent preview of what would be placed.

### `mountUI(root)` / `unmountUI()`

Create the palette via the injected factory. The palette controller returns:

```js
{
  getSelectedEntry(): PaletteEntry | null,
  isErasing(): boolean,
  destroy(): void,
}
```

The scene reads `getSelectedEntry()` and `isErasing()` each frame to determine
the active tool. The palette calls back into the scene's tool state via closure
references.

## Grid Overlay (`src/maker/grid-overlay.js`)

### `drawGrid(ctx, cam, viewW, viewH, cols, rows)`

Draw thin lines at every cell boundary within the visible range:

- `ctx.strokeStyle = 'rgba(51, 50, 61, 0.15)'` — `--ink` at 15% opacity.
- `ctx.lineWidth = 1 / pixelScale` where `pixelScale` is the viewport's current
  scale (passed as a parameter or hardcoded to 1 for Unit 13 which has no zoom).
  This keeps grid lines at 1 device pixel.
- Iterate the visible column range `[c0, c1]` and row range `[r0, r1]` (same
  cull logic as `drawTiles`). Draw vertical lines at `c * TILE - cam.x` and
  horizontal lines at `r * TILE - cam.y`.
- Use `Math.round` on coordinates to avoid sub-pixel blurring.

### `drawCursor(ctx, cam, c, r, color)`

Fill the cell at `(c, r)` with a semi-transparent color:

- Paint tool selected: `rgba(99, 157, 109, 0.3)` — `--accent` at 30%.
- Erase tool or right-click: `rgba(220, 73, 73, 0.3)` — `--danger` at 30%.
- No tool: `rgba(51, 50, 61, 0.15)` — neutral hover.

### `drawGhost(ctx, cam, c, r, atlas, entry)`

When a non-tile, non-eraser tool is selected and the cursor is over the grid,
draw the entry's `icon` clip first frame at the cell, at 50% opacity
(`ctx.globalAlpha = 0.5`). Restore alpha afterwards.

For tile tools, the cursor fill is sufficient visual feedback.

## Entity and Decor Preview Rendering

The maker draws **static icons**, not animated runtime entities. For each record
in `level.entities` and `level.decor`:

1. Look up the palette entry via `byId(rec.k)`. Skip unknown kinds.
2. Get the icon clip from `atlas.get(entry.icon)`.
3. Draw frame 0 at the cell position.

**Positioning:** centre the sprite horizontally in the cell. Vertically, align the
sprite bottom to the cell bottom for `placement: 'entity'` entries (they stand on
the ground), and centre vertically for `placement: 'decor'`. This gives a readable
approximation of play-mode positioning without needing per-entity draw offsets.

```js
const dx = Math.round(c * TILE - cam.x + (TILE - clip.fw) / 2);
const dy = Math.round((r + 1) * TILE - cam.y - clip.fh);  // bottom-aligned
```

For markers (spawn and goal), use the same bottom-aligned positioning.

## Palette DOM (`src/ui/maker-palette.js`)

### Factory

```js
/**
 * @param {HTMLElement} root
 * @param {{
 *   atlas: Atlas,
 *   onSelect: (entry: PaletteEntry | null, erasing: boolean) => void,
 * }} opts
 * @returns {PaletteController}
 */
export function createMakerPalette(root, opts)
```

Injected into `MakerScene` via `params.ui.createPalette`, following the same
pattern as `createPlayHud` and `createTouchControls`.

### DOM Structure

A fixed-position bar at the bottom of the screen:

```
div.maker-palette
  div.maker-palette__groups
    [for each group in PALETTE_ORDER that has entries:]
      div.maker-palette__group
        span.maker-palette__group-label  "Terrain"
        [for each entry in palette where entry.group === group:]
          button.maker-palette__item[data-id]
            canvas (draws the icon clip frame 0, scaled ×2)
    div.maker-palette__group
      button.maker-palette__item.maker-palette__item--eraser
        (two crossed lines or a simple ×, drawn in CSS)
```

- Each item button is at least 44 × 44 CSS pixels (hit area rule).
- The selected item has class `--selected` with a `--accent` border highlight.
- The eraser has its own distinct icon (a crossed square or similar, CSS-only).
- Groups with zero entries are hidden (`display: none`).
- The group container scrolls horizontally (`overflow-x: auto`) if it overflows.
- Styling uses flat tokens (solid `--board` background, `--ink` borders, no
  nine-slice — that is Unit 15).

### Controller

```js
/** @typedef {{
 *   getSelectedEntry: () => PaletteEntry | null,
 *   isErasing: () => boolean,
 *   destroy: () => void,
 * }} PaletteController */
```

Clicking an item calls `opts.onSelect(entry, false)`. Clicking the eraser calls
`opts.onSelect(null, true)`. Clicking the already-selected item deselects it
(`opts.onSelect(null, false)`).

The icon on each button is drawn onto a small `<canvas>` element (not an `<img>`)
so it can sample frame 0 of any atlas clip, including multi-frame strips, without
needing a separate image per entry. Draw once on mount; never redrawn.

## `src/main.js` — Dev Bridge

The bridge is throwaway — Unit 16 (test-play round trip) and Unit 18 (title/level
select) replace it. Its only purpose is to verify Unit 13 by switching between
play and maker mode with the same level.

### Changes

1. Import `createMakerScene` and `createMakerPalette`.
2. Create a `makerScene` alongside the existing `playScene`.
3. Track `currentMode: 'play' | 'maker'`. Start in **maker** mode with a fresh
   empty level (so the maker is the first thing you see — it is what this unit
   builds).
4. On `keys.modeSwitch.pressed` (the `M` key):
   - If in maker: if `level.goal` is null, log a console warning ("Place a goal
     flag before playing") and do not switch. Otherwise, exit the maker, enter
     play with the maker's current level.
   - If in play: exit play, re-enter the maker with the same level. Restore the
     camera position the maker had.
5. The update/render loop delegates to `currentScene.update(dt)` /
   `currentScene.render(ctx, cam)`.

The play scene in the bridge does **not** get audio, HUD or touch controls — it
is a bare world render for verifying that the painted level works. Death restarts
in place; completion logs to console. This is not the real play experience (that
already works via the fixture).

## Not Built

- Touch gestures: two-finger pan, pinch zoom, paint/pan toggle, long-press
  eyedropper (Unit 14).
- Responsive palette: scrolling category tabs, top bar with Back/Undo/Redo/Play/
  Menu buttons, safe-area padding, orientation handling (Unit 15).
- Test-play round trip with validation, transition wipe, and lossless return
  (Unit 16).
- Persistence: autosave, level list, share codes, `.json` export/import
  (Unit 17).
- Zoom (0.5× / 1× / 2×) — Unit 14.
- Any new palette entries. Decor entries (`palm_back`, `palm_front`) are future
  units. The decor group exists in `PALETTE_ORDER` but is empty.
- Level resize dialog (Unit 15).
- Kind-in-registry validation in `schema.js` (still Unit 16).
- Audio in the maker (no music, no SFX while editing).
- Changes to `level/schema.js`, `level/codec.js`, `level/autotile.js`,
  `level/render.js`, `level/parallax.js`, `game/world.js`, `game/player.js`,
  `game/play-scene.js`, `game/entities/*`, `game/hazards/*`,
  `game/collectibles.js`, `game/stats.js`, `tools/`, `public/assets/`.

## Docs To Update In The Same Change

- `context/2-architecture.md` — `LevelModel` gains `createEmptyModel` and
  nullable `goal`; `camera.js` gains `panBy`; mention `maker/commands.js`,
  `maker/tools.js`, `maker/grid-overlay.js`.
- `context/4-code-standards.md` § File Organization — `src/maker/` gains its
  first four files; `src/ui/` gains `maker-palette.js`.
- `context/6-progress-tracker.md` — unit in progress / complete, decisions taken.
- `context/7-current-issues.md` — anything found and deliberately not fixed.

## Verification Checklist

- [x] `npm test` — all existing 155 tests pass unchanged. If any pure helper in
      `commands.js` or `tools.js` is testable, add tests.
- [x] `npm run build` — no errors
- [x] App starts in maker mode with an empty 160 × 24 grid; spawn marker visible
      at (4, 18); no goal until the user places one
- [x] Arrow keys pan the camera smoothly; camera stops at the level edges
      (with the 2-tile margin)
- [x] Middle-mouse drag pans the camera in the correct direction
- [x] Selecting "Terrain" and dragging paints terrain — autotiling updates
      correctly as you paint, including edges, corners and fill
- [x] Right-clicking with terrain selected erases terrain cells — autotiling
      updates correctly on erase
- [x] Selecting an enemy (e.g. Crabby) and clicking places it; the static icon
      preview appears at the cell
- [x] Placing an entity on a cell that already has one replaces it
- [x] Selecting "Goal" from markers and clicking places the flag; clicking
      elsewhere moves it
- [x] The eraser tool clears tiles, entities and decor at the cell but not markers
- [x] Ctrl+Z undoes the last operation exactly (tiles restored, entities
      removed/restored, markers moved back)
- [x] Ctrl+Shift+Z or Ctrl+Y redoes exactly
- [x] Undo and redo are exact across 50 mixed operations: paint terrain, place
      entities, move markers, erase, all interleaved
- [x] A new command after an undo clears the redo stack
- [x] After 101 commands, the oldest is gone and undo stops at the 100th
- [x] Dragging across the same cell multiple times produces only one command
      entry for that cell (per-cell dedupe)
- [x] A drag that changes nothing (painting terrain on cells that are already
      terrain) does not push a command
- [x] Grid overlay is visible and only draws within the visible cell range
- [x] Cursor cell highlight appears under the pointer with the correct color
      (green for paint, red for erase)
- [x] Ghost preview (semi-transparent entity icon) appears at the cursor cell
      when an entity tool is selected
- [x] Dev bridge: press `M` to switch to play mode — the painted level is
      playable. Press `M` again to return to the maker.
- [x] Pressing `M` with no goal flag placed shows a console warning and does not
      switch
- [x] The palette shows all 19 current entries across 7 groups (decor is empty
      and hidden)
- [x] Everything from Units 00–12 still behaves: switching to play mode (via `M`)
      with a level containing terrain, enemies and treasure plays correctly
- [x] No console errors during a full editing session
- [x] Verified at a desktop viewport; phone viewport is not required (Unit 14+
      handles touch)
