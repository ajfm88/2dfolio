# Unit 20 — Second Theme

> **Status: COMPLETE 2026-10-03, signed off by the player** after building and
> playing ship levels on the dev server. Built 2026-10-02 and reviewed the same day.
> Issue 35 (water in the hold) is open for later, and issue 37 is closed as by
> design.
>
> - Decisions 1–3 are the player's (2026-10-02). The remaining proposed choices
>   were implemented as specified following the player's direct request.
> - The player requested implementation while Unit 19's visual sign-off was
>   still pending. That status is preserved; this request does not sign off Unit 19.
> - A different model will implement it, so this spec spells out files, values and
>   checks. Where it is silent, do not invent: add an open question to
>   `6-progress-tracker.md` and ask (`5-ai-workflow-rules.md`, Handling Missing
>   Requirements).

## What This Unit Builds

A second visual theme, **Pirate Ship**, that any level can switch to from the maker.
It comes in two parts:

- **Part A — Ship art.**
  - Ship terrain: the island's 47-tile layout at origin (1,1).
  - Plank one-way platforms, picked by a new left / middle / right / single rule.
  - A below-decks backdrop: the ship's back wall replaces the sky.
- **Part B — Theme picker.** The maker Menu lists the themes, and picking one is an
  undoable edit. The palette's Terrain and Platform buttons show the theme's art.

Part A is two commits, **A1** (assets) and **A2** (runtime): the workflow rules
split an asset-pipeline change from the code that reads its output. Each part is
verified and committed on its own. The player signs off on the whole unit at the
end, as with Unit 19.

**Depends on:** Unit 19, signed off. **Installs:** none.
**Level format:** unchanged. `theme` is already a format-1 field, and the schema
accepts any non-empty string.

**Done when** (build plan, as amended 2026-10-02):
- switching a level's theme changes only its art
- the 47-tile blob logic is untouched
- a level authored in one theme renders correctly in the other
- a switch is undoable, and survives autosave, share codes and the test-play
  round trip

## Before This Unit

1. Unit 19 is signed off by the player.
2. **Issue 30** (the wall slip) is fixed as its own change, using the fix plan in its
   entry in `7-current-issues.md`. The tracker schedules it first. It is **not** part
   of this unit: it is a different system (`game/physics.js`), with its own commit
   and its own regression tests.

## How To Work This Spec

- Read `CLAUDE.md`, then the context files in its order, then this spec.
- Mark Unit 20 in progress in `6-progress-tracker.md`.
- Work in the order of **Implementation Order**. For a pure function, write the test
  first and see it fail.
- Touch only the files in the **Files** table. If another file seems to need a
  change, stop and say why.
- Before each commit, `npm test` and `npm run build` pass.
- Record each part in the tracker. Write anything that differs from this text in an
  **As Built** section at the end of this spec, in the style of Unit 19's.
- Commit messages follow the repo's style, for example `Unit 20 part A1: pack the
  Pirate Ship tilesheets`.

## Constraints That Shape This Unit

1. **Invariant 2.** No format change. Every campaign file stays byte-identical, and
   stays island (`campaign.test.js` already checks both).
2. **Invariant 3.** Theme resolution and the parallax rebuild happen in `update` or
   in the command's apply path. The maker reconciles DOM (toolbar, palette icons) in
   `render`, diff-based.
3. **Invariant 5, applied to themes.** Only `data/themes.js` lists themes. The picker
   reads `themeList`.
4. **Invariant 7.** A switch is a `ThemeCommand` on the stack. UI never writes
   `level.theme`.
5. **Invariant 11.** Nothing changes in `core/`.
6. **4-code-standards, Rendering.** No allocation per frame: the backdrop and the
   plank rule reuse the existing scratch `{ col, row }`. No new `save()` /
   `restore()`. Destinations go through `Math.round`.
7. **Architecture, Autotiling.** The blob tables (`MASK_TABLE`, `INNER_TABLE`) and
   `autotileAt` do not change. Ship platforms need a second rule because their art is
   a row of planks, not a blob set (Decision 3).
8. **Generated files.** `public/assets/` and `src/data/atlas.json` change only
   through `npm run assets`.

## Measured Facts (2026-10-02)

Measured from the pack with scratch scripts in the session scratchpad; not
committed.

### `Pirate Ship/Sprites/Tilesets/Terrain and Back Wall (32x32).png`

- 608 × 416, a grid of 19 × 13 cells.
- It holds two copies of the island's 17 × 5 blob layout, each padded by one empty
  cell: **terrain at origin (1,1)** and **back wall at origin (1,7)**. Row 6,
  row 12, column 0 and column 18 are empty.
- In both copies, the occupied cells match the island sheet's exactly, cell for
  cell after the offset.
- **Inner corners.**
  - **Control.** Unit 19's pixel diff, re-run on the island, reproduces its numbers:
    changed corner quadrants differ by ≥ 59 px, unchanged ones by ≤ 35.
  - **Back wall.** As clean (≥ 102 vs ≤ 32), so `INNER_TABLE` holds as is.
  - **Ship terrain.** The diff cannot decide on its own. The base fill tile is a
    flat dark interior, while the inner-corner variants are planked well beyond
    their notch, so unchanged quadrants differ by up to 202 px.
  - **So the shapes were rendered instead.** Unit 19's test set (1-tile hole,
    2 × 2 hole, notch, staircase, plus, ring, columns and bars) was drawn through
    the real `autotileAt` with the ship sheet at (1,1). It shows continuous plank
    rims and gold corner brackets at every inner corner, with no tile out of place.
  - **`INNER_TABLE` applies to both copies unchanged.**
- The back wall's fill tile is sheet cell **(2,8)**, its copy's (1,1). It is fully
  opaque (0 transparent pixels).

### `Pirate Ship/Sprites/Tilesets/Platforms (32x32).png`

- 192 × 128, a grid of 6 × 4 cells, padded by one empty cell.
- Two plank styles: **thin planks in row 1**, thick metal-capped planks in row 2.
- Each row has a **left cap (column 1), middle (2), right cap (3) and single (4)**,
  read from the end outlines. Column 1 has an ink outline on its left edge only,
  column 3 on its right edge only, column 2 on neither, and column 4 on both.
- Thin plank, from the top of its cell:

  | y | What |
  | --- | --- |
  | 0 | transparent |
  | 1 | top outline (ink `#33323d`) |
  | 2–3 | plank body |
  | 4 | bottom outline |
  | 5–6 | underside |
  | to 8 | brackets |

  Ship terrain's top outline is at **y 0**.

### Coverage and size

Packing the two files moves coverage from 428 to **430 / 1195**. They add about
21 KB.

## Decisions

| # | Question | Decision |
| --- | --- | --- |
| 1 | The back wall | **Decided (player, 2026-10-02): behind everything.** Ship levels are below decks: the back wall's fill tile replaces the sky, sea, horizon bands, BG Image and clouds. No new layer, no format change. A level cannot mix open sky and interior. |
| 2 | "Matching decor" | **Decided (player, 2026-10-02): not in this unit.** Decor (the island palms, the ship's props) becomes its own later unit. Open Question 8 in the tracker. |
| 3 | Ship platforms | **Decided (player, 2026-10-02): the pack's plank art**, picked by the E and W neighbours on the platform layer: left cap, middle, right cap or single. N and S never matter. The island keeps drawing platforms from its terrain blob, unchanged. |
| 4 | Which plank style | **Proposed:** thin (row 1), which reads as jump-through. The thick row stays in the sheet unused. |
| 5 | Plank height | **Proposed:** draw ship platforms 1 px higher (`platformOffsetY: -1`), so the plank's top outline sits on the collision line, as terrain's does. Collision does not change. |
| 6 | How the backdrop moves | **Proposed:** with the world (parallax 1), aligned to the tile grid, and filling the whole view, including the maker's margins past the level edge. A wall theme builds and draws no clouds, sea, horizon bands or reflections. |
| 7 | Water in the ship | **Proposed:** the same water tile as the island: a flooded hold. |
| 8 | Where the picker lives | **Proposed: the maker Menu**, below Share and Resize Level. A **Theme** label, then one button per theme. The current one is drawn pressed with the `--accent` bar, like a selected tab or a Settings choice, with `aria-pressed`. Picking one closes the menu and applies at once. *Alternative:* a Theme dialog, which is more code for the same two buttons. |
| 9 | Undo | **Proposed:** a switch is a `ThemeCommand`, so it is undoable, redoable, autosaved, and part of the test-play session. Picking the current theme does nothing. |
| 10 | Who resolves the maker's theme | **Proposed:** the maker itself, from `level.theme` through `getTheme`. `MakerSceneParams.theme` goes away. Play keeps receiving its theme from the App, as today. |
| 11 | Palette icons | **Proposed:** Terrain and Platform show what a lone tile draws in the level's theme, and redraw when the theme changes. Water and every entity keep their own icon. *Alternative:* keep the island icons. |
| 12 | New levels, My Levels cards | **Proposed:** unchanged. A new level starts as island, and cards do not show the theme. |
| 13 | The campaign | **Proposed:** stays island. No ship level in this unit. |
| 14 | Unknown theme ids | **Proposed:** unchanged: `getTheme` falls back to island. No validation rule. |

## Scope Boundary

**This unit covers:**
- packing the two ship sheets
- the ship theme data
- `barCell` / `barTileAt`, and platform tiling chosen per theme
- the wall backdrop
- the theme picker and `ThemeCommand`
- theme-aware Terrain and Platform icons
- the tests for all of the above

**It does not cover:**
- decor of any kind (Decision 2)
- a paintable back-wall layer, or any level-format change
- the thick planks, or ship-specific water
- a theme choice on New Level, on My Levels cards, or in the campaign
- validating theme ids
- `core/*`, `game/*` or physics (issue 30 comes before this unit)

---

## Part A1 — Pack the Ship Sheets

### `tools/asset-manifest.mjs`

Add a path constant next to the others:

```js
const SHIP_TILES = 'Pirate Ship/Sprites/Tilesets';
```

Then, right after the island tiles block, add:

```js
  // Pirate Ship tiles (Unit 20), copied as-is like the island sheet.
  copy('tiles/ship', `${SHIP_TILES}/Terrain and Back Wall (32x32).png`, 'tiles/ship.png'),
  copy(
    'tiles/ship-platforms',
    `${SHIP_TILES}/Platforms (32x32).png`,
    'tiles/ship-platforms.png',
  ),
```

### Run and check

Run `npm run assets` twice. After the first run, `git status` shows only:

- new `public/assets/tiles/ship.png` and `public/assets/tiles/ship-platforms.png`,
  byte-identical to their sources
- `src/data/atlas.json` with exactly two new entries, shaped like `tiles/island`'s:
  `tiles/ship` (fw 608, fh 416) and `tiles/ship-platforms` (fw 192, fh 128)
- `tools/coverage.json`: `packed` 430, and those two paths gone from `unused`

The second run changes nothing. Commit: `Unit 20 part A1: pack the Pirate Ship
tilesheets`.

---

## Part A2 — Ship Terrain, Planks and the Below-Decks Backdrop

### `src/level/autotile.js` — additions only

```js
/**
 * Plank rule for platform art drawn as one row (the Pirate Ship platforms), by the
 * E and W neighbours on the same layer. N and S never matter, so stacked rows each
 * draw planks. Indexed by (e ? 1 : 0) | (w ? 2 : 0); columns are relative to the
 * sheet's origin and the row is always 0. Measured 2026-10-02
 * (specs/20-second-theme.md, Measured Facts).
 * @type {ReadonlyArray<readonly [number, number]>}
 */
export const BAR_TABLE = [
  [3, 0], // single
  [0, 0], // left cap
  [2, 0], // right cap
  [1, 0], // middle
];

/**
 * @param {boolean} e
 * @param {boolean} w
 * @param {{ col: number, row: number }} out
 */
export function barCell(e, w, out) {
  const tile = BAR_TABLE[(e ? 1 : 0) | (w ? 2 : 0)];
  out.col = tile[0];
  out.row = tile[1];
}

/**
 * Writes the plank cell into `out`. Returns false if the cell is empty.
 * @param {Uint8Array} layer
 * @param {number} cols
 * @param {number} rows
 * @param {number} c
 * @param {number} r
 * @param {{ col: number, row: number }} out
 */
export function barTileAt(layer, cols, rows, c, r, out) {
  if (!isPresent(layer, cols, rows, c, r)) return false;
  barCell(isPresent(layer, cols, rows, c + 1, r), isPresent(layer, cols, rows, c - 1, r), out);
  return true;
}
```

Update the module's header comment to mention the plank rule. Nothing existing in
the file changes.

**Tests (`autotile.test.js`, added; existing tests unchanged):**
- `barCell`: none → (3,0), E → (0,0), W → (2,0), E + W → (1,0).
- `barTileAt`:
  - an empty cell returns false
  - a 3-wide run gives left, middle, right
  - a lone cell gives single
  - grid edges count as absent: a cell in column 0 with an E neighbour is a left
    cap; one in the last column with a W neighbour is a right cap
  - N and S neighbours change nothing: the middle of a plus shape is a middle

### `src/data/themes.js`

**Typedef.** Add these fields to `Theme`:

```js
 *   label: string,
 *   platformSheet: string,
 *   platformOriginCol: number,
 *   platformOriginRow: number,
 *   platformTiling: 'blob' | 'bar',
 *   platformOffsetY: number,
 *   wallTile: readonly [number, number] | null,
```

In a short comment beside them:
- `label` is the name shown in the maker's picker.
- `platformOffsetY` is in world pixels and is added to a platform tile's draw y.
- `wallTile` is the cell of `sheet` that fills the view in place of the sky, or
  `null` for a sky theme.

**`islandTheme`** gains:

| Field | Value |
| --- | --- |
| `label` | `'Palm Tree Island'` |
| `platformSheet` | `'tiles/island'` |
| `platformOriginCol` | `0` |
| `platformOriginRow` | `0` |
| `platformTiling` | `'blob'` |
| `platformOffsetY` | `0` |
| `wallTile` | `null` |

Nothing else on it changes.

**`shipTheme`** (new):

```js
/**
 * Below decks. The terrain is the island's blob layout at origin (1,1). The sheet's
 * second copy, at (1,7), is the back wall, and its fill tile (2,8) replaces the sky.
 * The sky fields are inherited but never drawn, and a wall theme builds no clouds or
 * reflections. Platforms are the thin plank row of their own sheet, drawn 1 px up so
 * the plank's top outline (y 1 in its cell) sits on the collision line.
 * @type {Theme}
 */
export const shipTheme = {
  ...islandTheme,
  id: 'ship',
  label: 'Pirate Ship',
  sheet: 'tiles/ship',
  originCol: 1,
  originRow: 1,
  platformSheet: 'tiles/ship-platforms',
  platformOriginCol: 1,
  platformOriginRow: 1,
  platformTiling: 'bar',
  platformOffsetY: -1,
  wallTile: [2, 8],
  smallCloudCount: 0,
  reflects: [],
};
```

**The registry:**

```js
/** Every theme, in picker order. @type {ReadonlyArray<Theme>} */
export const themeList = [islandTheme, shipTheme];

/** @type {Record<string, Theme>} */
export const themes = {
  island: islandTheme,
  ship: shipTheme,
};
```

`getTheme` is unchanged. Rewrite the module header, which still says "Only island is
packed in v1. Unit 20 adds ship at (1,1)."

### `src/level/render.js`

**`drawBackground`.** Add this branch at the top. Everything below it is unchanged.

```js
  if (theme.wallTile) {
    const sheet = atlas.get(theme.sheet);
    const sx = theme.wallTile[0] * TILE;
    const sy = theme.wallTile[1] * TILE;
    const c0 = Math.floor(cam.x / TILE);
    const r0 = Math.floor(cam.y / TILE);
    const c1 = Math.ceil((cam.x + viewW) / TILE);
    const r1 = Math.ceil((cam.y + viewH) / TILE);
    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        ctx.drawImage(
          sheet.image, sx, sy, TILE, TILE,
          Math.round(c * TILE - cam.x), Math.round(r * TILE - cam.y), TILE, TILE,
        );
      }
    }
    return;
  }
```

The range is deliberately **not** clamped to the level, so the maker's margins fill
too (Decision 6). The tile is opaque, so no sky fill goes under it. Say in the
function's doc comment that a wall theme draws only the wall.

**`drawTiles`.** The terrain and water loops are unchanged. The platform loop now:
- reads `atlas.get(theme.platformSheet)` and the platform origin, not the terrain's
- calls `barTileAt` when `theme.platformTiling === 'bar'`, and `autotileAt`
  otherwise
- adds `theme.platformOffsetY` to the rounded destination y

Hoist the sheet, origin and tiling choice above the loop, as the terrain loop does.
For the island this is the same sheet, origin and function as today, so the output
is pixel-identical.

**`drawReflections` and `drawLevel`:** unchanged. The ship's reflection list is
empty.

**`src/level/parallax.js`:** unchanged. With `smallCloudCount: 0` and `reflects: []`
the pool loops run zero times, and `update` still reads a valid `bigClouds` clip.

### `src/data/themes.test.js` (new)

- Ids in `themeList` are unique and every label is non-empty.
- `themes[t.id]` is the same object as in `themeList`.
- `getTheme('ship')` is the ship. `getTheme('nope')` falls back to the island.
- Every clip a theme names exists in `atlas.json`: `sheet`, `platformSheet`,
  `waterClip`, `bgImage`, `bigClouds`, every `smallClouds` and every `reflects` id.
- Every cell a theme reads lies inside its sheet, using `fw` and `fh` from
  `atlas.json`:
  - the 17 × 5 blob layout at the terrain origin
  - at the platform origin: the 4 × 1 plank layout for `'bar'`, or the 17 × 5 blob
    for `'blob'`
  - `wallTile`, when there is one
- **Regression lock:** the island draws platforms exactly as before Unit 20. That
  means `'blob'`, the terrain's sheet and origin, offset 0, and `wallTile === null`.

### See it before the picker exists

Import a level whose `"theme"` is `"ship"` through My Levels → Import (paste its
JSON). The harness can take a fixture's JSON and change only that field.

Commit: `Unit 20 part A: Pirate Ship terrain, plank platforms and the below-decks
backdrop`.

---

## Part B — The Theme Picker

### `src/maker/commands.js` — `ThemeCommand`

```js
export class ThemeCommand {
  /**
   * @param {string} from
   * @param {string} to
   */
  constructor(from, to) {
    this.from = from;
    this.to = to;
  }

  /** @param {LevelModel} model */
  execute(model) {
    model.theme = this.to;
    touch(model);
  }

  /** @param {LevelModel} model */
  undo(model) {
    model.theme = this.from;
    touch(model);
  }

  hasChanges() {
    return this.from !== this.to;
  }
}
```

**Tests (`commands.test.js`):**
- `execute` sets the theme, `undo` restores it, and redo through the stack sets it
  again.
- Each step bumps `revision`.
- `hasChanges` is false for the same theme.
- `serialise` after `execute` writes the new theme.

### `src/maker/maker-scene.js`

- **Imports:** `getTheme` and `themeList` from `../data/themes.js`, and
  `ThemeCommand`.
- **Params:** remove `theme` from `MakerSceneParams`. Add
  `setTheme: (theme: Theme) => void` to the `PaletteController` typedef.
- **State:** two new private variables: `theme` (a `Theme`, starting as
  `getTheme('island')` so it is never undefined) and `themeId` (`string | null`,
  starting `null`).
- **`syncTheme()`:**

  ```js
  function syncTheme() {
    if (!params || !level || level.theme === themeId) return;
    themeId = level.theme;
    theme = getTheme(themeId);
    parallax = createParallax(level, theme, params.atlas);
  }
  ```

- **Where it is called:**
  - **`enter`:** set `themeId = null`, then call it. This replaces today's
    `createParallax(level, p.theme, p.atlas)`. A level coming back from test-play
    carries its own theme.
  - **`update`:** right after the undo / redo block, so a Ctrl+Z on a switch draws
    the right art this frame.
  - **The toolbar's `onTheme`:** right after `stack.execute`.
- **`ResizeCommand`'s `onResize`:** `createParallax(level, theme, params.atlas)`.
- **`mountUI`:**
  - The palette gets `theme`.
  - The toolbar gets `themes: themeList.map((t) => ({ id: t.id, label: t.label }))`,
    built once at mount.
  - The toolbar also gets this `onTheme`:

  ```js
  onTheme: (id) => {
    if (dragState || !level || !stack || id === level.theme) return;
    stack.execute(new ThemeCommand(level.theme, id), level);
    syncTheme();
  },
  ```

- **`render`:**
  - `drawLevel(…, theme, …)`.
  - Next to the existing `toolbar.sync` (before the cursor's early return), pass
    `theme: level.theme` in the sync state, and call `palette.setTheme(theme)`.
    Both diff, so they touch the DOM only on a change.
- **`exit`:** clear `themeId` to `null`.

### `src/ui/maker-toolbar.js` and `styles/maker-toolbar.css`

**Options and state:**
- Opts gain `themes: ReadonlyArray<{ id: string, label: string }>` and
  `onTheme: (id: string) => void`.
- `ToolbarState` gains `theme: string`.

**The Menu panel.** After Resize Level, add:
- a **Theme** label: a `span.maker-toolbar__menu-label`, `aria-hidden`, at `--fs-sm`
  in `--text`, sitting on the menu's paper
- then a `div` with `role="group"` and `aria-label="Theme"`, holding one button per
  theme:
  - classes `maker-toolbar__menu-item maker-toolbar__menu-item--choice`
  - text is the label
  - attributes `type="button"`, `aria-pressed` and `data-theme`
  - on click: `closeMenu()`, then `opts.onTheme(id)`

**`sync`.** When `state.theme` differs from the last one, set `aria-pressed` on every
choice. Start the last-seen theme at `null`, so the first sync paints.

**CSS.** The pressed choice is drawn like a selected tab:
- `position: relative` on the choice
- when pressed: `transform: translateY(calc(1px * var(--ui-scale)))`, and an
  `::after` bar inside its bottom edge, `calc(3px * var(--ui-scale))` tall, in
  `--accent` (copy the rule shape from `level-select.css`)
- the label: block, `--fs-sm`, `--text`, padded in `--ui-scale` multiples
- add the pressed transform to the existing reduced-motion rule, as `none`

No hex values and no `border-radius`. Items keep their 44 px minimum height.

### `src/ui/maker-palette.js`

- **Options:** opts gain `theme: Theme`. The controller gains `setTheme(theme)`.
  It returns at once if `theme.id` is unchanged; otherwise it redraws the Terrain
  and Platform icons. Keep references to those two icon canvases.
- **`drawPaletteIcon(canvas, atlas, entry, theme)`.** Draw the cell a lone tile draws
  in the theme:
  - **`entry.layer === 'terrain'`:** `blobCell` with every neighbour `false`, which
    gives (4,4). Offset it by `theme.originCol` / `originRow` and crop from
    `theme.sheet`.
  - **`entry.layer === 'platform'`:** when `theme.platformTiling === 'bar'`, use
    `barCell(false, false)`, the single; otherwise the lone blob cell. Offset it by
    the platform origin and crop from `theme.platformSheet`.
  - **Everything else is unchanged.** Water keeps its crop of `water/top`, and
    entities keep their own clip.
- **The old heuristic goes.** This replaces the `clip.fw >= 17 * TILE` check.
- **Imports.** `blobCell` and `barCell` come from `../level/autotile.js`. That is an
  inward import, which is allowed.
- **`palette.js` does not change.** The two entries keep `icon: 'tiles/island'`,
  which the typedef requires. The palette no longer reads it.

### `src/main.js`

`enterMaker` stops passing `theme: getTheme(level.theme)`. `enterPlay` keeps it, so
the import stays.

Commit: `Unit 20 part B: the theme picker`.

---

## Files

| File | Part | Change |
| --- | --- | --- |
| `tools/asset-manifest.mjs` | A1 | Two `copy` entries |
| `public/assets/tiles/ship.png`, `ship-platforms.png`, `src/data/atlas.json`, `tools/coverage.json` | A1 | **Generated** by `npm run assets`, never by hand |
| `src/level/autotile.js` (+ test) | A2 | `BAR_TABLE`, `barCell`, `barTileAt` |
| `src/data/themes.js` | A2 | New typedef fields, island values, `shipTheme`, `themeList` |
| `src/data/themes.test.js` (new) | A2 | Theme data integrity and the island lock |
| `src/level/render.js` | A2 | Wall backdrop, and platform tiling per theme |
| `src/maker/commands.js` (+ test) | B | `ThemeCommand` |
| `src/maker/maker-scene.js` | B | Owns its theme; `syncTheme`; picker wiring |
| `src/ui/maker-toolbar.js`, `src/ui/styles/maker-toolbar.css` | B | Theme choices in the Menu |
| `src/ui/maker-palette.js` | B | Theme-aware Terrain and Platform icons; `setTheme` |
| `src/main.js` | B | The maker no longer gets a `theme` param |

**Not modified:**
- `src/core/*`
- `src/level/{schema,model,codec,parallax}.js`
- `src/game/*` (play receives its theme as today)
- `src/data/palette.js` and `src/data/campaign/*`
- `src/storage/*`
- `src/maker/{tools,validate,gestures,grid-overlay,import-level}.js`
- `src/ui/screens/*`
- `reference/**`

## Implementation Order

0. **Before this unit:** Unit 19 sign-off, then issue 30 in its own commit.
1. **A1.** Manifest, `npm run assets` twice, check, commit.
2. **A2.**
   1. `barCell` / `barTileAt` tests, seen failing, then the code.
   2. `themes.js` and `themes.test.js`.
   3. `render.js`.
   4. Verify A2, commit.
3. **B.**
   1. `ThemeCommand` and its tests.
   2. The maker scene.
   3. The toolbar.
   4. The palette.
   5. `main.js`.
   6. Verify B, commit.
4. **Docs** (below) and the tracker, then ask the player for sign-off.

## Not Built

- Decor: palms, ship props, a visible Decor tab (Decision 2, Open Question 8).
- A paintable back-wall layer, sky through openings in a ship level, or any format
  change.
- The thick plank style, and ship-specific water.
- A theme choice on New Level, on My Levels cards, or in the campaign.
- An `unknown-theme` validation rule.

## Risks To Watch

- **Backdrop cost.** One `drawImage` per visible cell: about 300 at 1×, and about
  1,150 in the maker at 0.5×.
  - Measure frame time at 768 wide, maker at 0.5×, on a ship level.
  - If it is a problem, log it for Unit 21's profiling pass. Do not add a pattern
    cache here.
- **Island regression.** The island must draw exactly as before. See the A2 checks.
- **A switch mid-drag.** The `dragState` guard covers it; check that a pick during a
  touch stroke does nothing.
- **Plank feet.** At 2×, the feet should sit on the plank's top outline, with no gap
  and no overlap.
- **Ship inner corners in play.** The planked variants are busier than the island's.
  Look at a long wall with notches.
- **Readability on the wall.** Check the grid lines, the cursor and the eraser tint
  over the plank wall.
- **Water in the hold.** The sea tile on a plank wall: judge by eye, and log it if
  it reads wrong.
- **Menu height.** Four entries plus the label at 844 × 390, 1000 × 360 and
  1280 × 720 (UI scale 2).

## Docs To Update In The Same Change

| File | Update |
| --- | --- |
| `1-project-overview.md` | **Maker features:** add "Theme: Palm Tree Island or Pirate Ship, from the Menu, undoable." **Shared systems:** the themes line says they are chosen per level, that Pirate Ship is below decks (its back wall replaces the sky), and that its platforms are planks. |
| `2-architecture.md` | **`maker/` description:** `ThemeCommand`, and that the maker resolves its theme from `level.theme`. **Autotiling:** the ship origins (terrain (1,1), back wall (1,7), fill (2,8)), platform art and rule per theme, and the `BAR_TABLE`. Amend "the tiling logic never changes" to "the blob logic never changes". **Rendering Model:** a theme with a `wallTile` is below decks, and nothing derived from the horizon is drawn. |
| `3-ui-context.md` | **Maker:** the Menu holds Share, Resize Level and Theme. **Icons:** Terrain and Platform draw their icon from the level's theme. |
| `specs/00-build-plan.md` | Already amended on 2026-10-02. Change it only if an approved decision changes. |
| `6-progress-tracker.md` | Each part, any decisions taken, and the Session Notes |
| `7-current-issues.md` | Anything found but not fixed |

---

## Verification Checklist

### Part A1

- [x] Two `npm run assets` runs are byte-identical.
- [x] Only the two new PNGs, `atlas.json` (two entries) and `coverage.json` changed.
- [x] Coverage is 430 / 1195.

### Part A2

- [x] `npm test`: the plank cases and the theme data tests pass, and every existing
      autotile test is unchanged.
- [x] **Island unchanged.** (Six tile-render hashes and two real maker ground
      crops match; the pre-A2 renderer was replayed from the A1 commit.)
  - In the maker, at the same window size, a crop of ground below the horizon on
    Castaway Beach and on Starfall Cliffs is pixel-identical before and after A2.
    Ground tiles do not animate.
  - All six campaign levels play.
  - `campaign.test.js` is green, with no file changed.
- [x] **A ship level,** imported as JSON with `"theme": "ship"`:
  - Terrain draws in ship planks, with continuous rims and inner corners across
    Unit 19's shape set.
  - Platforms draw as planks with caps, middles and singles. A 2-tall platform block
    draws two plank rows.
  - The back wall fills the view, including the maker margins. There are no clouds,
    sea, horizon bands or reflections.
  - Water tiles draw.
- [x] **Ship in play:** (Behaviour checks pass. Feet measured in the review, and seen
      by the player on 2026-10-03.)
  - Platforms are one-way: land from above, jump through from below, Down drops.
  - The player's feet sit on the plank's top outline.
  - Water still drowns.
  - Enemies, shooters, treasure and fx behave as on the island.
- [x] Frame time at 768 wide, maker at 0.5×, is recorded in As Built.

### Part B

- [x] **The Menu:**
  - It shows Theme, with Palm Tree Island and Pirate Ship, and the current one
    pressed.
  - Each choice is at least 44 × 44.
  - The menu fits at 844 × 390, 1000 × 360 and 1280 × 720, with nothing cut off.
- [x] **Picking Pirate Ship:**
  - The art, the backdrop and the palette's Terrain and Platform icons all switch on
    the next frame.
  - Picking the current theme pushes nothing: Undo stays as it was.
- [x] **Undo and redo,** both by toolbar button and by Ctrl+Z / Ctrl+Shift+Z, switch
      the art back and forth.
- [x] **Autosave:** the level has a flag, and after a reload, My Levels → Edit opens
      it as ship.
- [x] **Test-play:**
  - The ship art shows in play.
  - Back to editor keeps the theme and the undo history: Undo still reverts the
    switch.
- [x] **Share:** a ship level's share code, imported in a fresh profile, opens as
      ship.
- [x] **Campaign:** Edit a copy, switch it to ship, and it plays.
- [x] **Touch:** with synthesized touch at 844 × 390, the Menu and the choices work.
- [x] No console errors beyond issue 28. `npm run build` is clean.

### How to verify

- **Driver.** Use the project's scratch harness: a DevTools-protocol driver on
  Node's built-in WebSocket, with a throwaway headless Chrome profile.
  - Pass `--mute-audio`, or the player hears the game.
  - Run the dev server on a fixed port: `--port 5174 --strictPort`, or 5175 if that
    port is taken.
  - Nothing from the harness is committed.
- **Clicks on the canvas** need timed `PointerEvent`s, each press held at least
  50 ms.
- **What only the player can judge:** the look of the ship art at 2×, the plank feet
  by eye, and the phone run, which waits for the Netlify deploy.


## As Built — 2026-10-02

The player requested a plan and implementation. This authorized the work while
Unit 19's visual sign-off remained pending; neither unit is marked signed off.
The implementation follows the proposed values and file scope above. No packages
were installed, format 1 is unchanged, and reference art was read only.

### Commits and automated checks

- Prerequisite `6c84a7e`: issue 30, exact horizontal/vertical far-edge ranges.
  Three regressions failed before the change; four new tests pass afterward.
- A1 `606aee2`: two ship sheets, atlas and coverage. Two runs hash-identical
  across 95 files including the atlas; coverage also verified on a repeat run.
  Git reports no old PNG changes.
  Coverage 430/1195.
- A2 `9c65b4e`: bar tiler, theme registry and ship rendering. Ten new tests
  were observed failing before implementation, then pass.
- B `e483fc8`: undoable picker, scene synchronization, matching palette icons.
  Two theme-command tests failed before implementation, then pass.
- Final `npm test`: **338 tests across 27 files**. `npm run build` passes
  (JS 125.21 kB, gzip 37.51 kB; CSS 26.83 kB). No runtime console errors were
  observed in the final reload/edit/switch/undo check.

### Muted Chrome verification

- 320 sustained resolver wall approaches pass. 64 approaches through the real
  world/player to the current Castaway Beach raised block (column 63) also pass
  without rounding positions. The historical draft's block was column 65.
- Six campaign tile renders, including Castaway Beach and Starfall Cliffs, have
  identical SHA-256 pixel hashes before/after A2 at the same 768 × 360 canvas
  and camera. The real maker scene also renders identical 768 × 64 ground crops
  for Castaway Beach and Starfall Cliffs using the pre-A2 renderer from A1 versus
  the current renderer, with the same camera and seeded parallax. Each campaign
  world was also updated/drawn for 120 fixed steps
  in each theme; full campaign completion remains the player's prior Unit 18 run.
- A ship JSON imports through the real dialog. Render inspection covers stairs,
  notch, plus, ring, 1-cell and 2×2 holes, capped/middle/single planks and vertical
  plank rows. The back wall is opaque across every pixel, including negative
  camera margins; cloud/reflection pools are empty. Water draws normally.
- Real player/world checks pass for plank landing, jumping from below, Down drop
  and water death. Campaign enemies, shooters, pickups and effects still use
  the unchanged registry and gameplay modules.
- Picker, current-choice no-op, toolbar/keyboard undo/redo and terrain icon
  restoration pass. The platform icon matches the single ship plank crop.
- Menu fits 844 × 390 and 1000 × 360 (bottom 299.39 px), and 1280 × 720
  at scale 2 (bottom 598.80 px). Choices are 123.56 × 44 and 247.11 × 88 px.
- A level with a flag autosaves as ship and reopens as ship after reload. Share
  import in a fresh profile retains ship. Campaign Edit a copy → ship → Play,
  test-play → editor → theme undo/redo, and resize/theme/undo/redo all pass.
- Synthesized touch selects the theme at 844 × 390. Active mouse and touch paint
  strokes reject theme changes. Reduced motion removes the selected offset.

### Performance and remaining player checks

A 768-wide maker at 0.5×, on a 400 × 48 ship level with floor terrain, was
measured over 120 requestAnimationFrame-paced update/render calls: **median
0.8 ms, p95 4.2 ms, maximum 6.0 ms**. This measures desktop headless Chrome
submission, not compositor presentation or phone performance. An unpaced
readback-canvas stress loop was slower (median 4.7 ms, p95 30.7 ms); it is not
the maker frame measurement. Recheck on the target phone during Unit 21 profiling.

Still for the player: ship art and plank feet at 2× by eye, water/readability
judgment, and the phone run after Netlify deployment. No visual approval has
been inferred. No scratch harness files were committed.

### Review (Claude, 2026-10-02)

An independent check of the five commits found **no functional error**.
- Issue 30's regressions fail on the pre-fix `physics.js`.
- A fresh `npm run assets` changes nothing.
- 338 tests pass and the build is clean.
- In muted headless Chrome: the picker and undo / redo, a re-pick of the current
  theme keeping the redo tail, and the ship in the maker and in play.

**Plank feet, measured.** In a 2× screenshot the boot's bottom outline sits directly
on the plank's top outline, so the `-1` offset is right. The player's idle frame
ends at row 31.

**Fixed in a follow-up commit:**
- An inconsistent docs sentence in `2-architecture.md`.
- The `3-ui-context.md` Icons rule, which contradicted the theme icons.
- In `autotile.test.js`, a second import placed below a test block.
- Doc comments the spec asked for (the bar rule, the `autotile.js` header,
  `drawBackground`).
- Two over-length lines.
- Two drafting edits left uncommitted (`00-build-plan.md`, `4-code-standards.md`).

**Logged for the player:** the water and readability judgment above is now issue 35
(ship water reads as a flat block) and issue 36 (the HUD level name is faint, and
worst on the wall).

### Sign-off (player, 2026-10-03)

The player tested on the dev server: island and ship levels, theme switching, and a
ship level played with its deck, flag and water. They closed the unit with
"everything looks good".
- **Water** "looks a bit off inside of the ship, but maybe we can fix that later":
  issue 35, open.
- **The dark core.** A solid rectangle of ship terrain painted as a "room" read as
  open space, so the spawn inside it showed "buried in terrain". The validation was
  right. Explaining the core as the ship's version of the island's rock under the
  grass resolved it: issue 37, closed as by design.
