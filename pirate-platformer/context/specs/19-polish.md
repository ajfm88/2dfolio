# Unit 19 — Polish

> **Status: COMPLETE 2026-10-03, signed off by the player** after checking dust,
> screen shake, the pause menu and Settings on the dev server. Built 2026-09-29
> (spec approved the same day). Decisions 1 (three parts, one unit)
> and 11 (Settings is a dialog) are the player's. The player approved the other
> Proposed rows by asking for the unit to be built, as with Unit 18. The player asked
> for all three parts in this one unit, done in a row: each is still verified and
> committed on its own, and the player signs off at the end. The measured facts
> come from the art and were checked by script.

## What This Unit Builds

The build plan lists five things: inner-corner autotiling, dust on jump and land,
screen shake on damage, the pause menu, and the settings screen. They touch four
system boundaries: `level/`, `game/`, `ui/` and `storage/`. So this spec builds them as
**three parts**, each verified, committed and signed off on its own before the next
starts (Decision 1):

- **Part A — Inner corners.** Terrain and platforms use all 47 tiles of the blob
  sheet, so holes, notches and steps get continuous outlines and grass that wraps
  into the corners. Rendering only: no level changes, and collision is untouched.
- **Part B — Game feel.** Dust puffs when the player jumps from the ground and when
  they land. The screen shakes briefly when they lose a heart, and not at all under
  `prefers-reduced-motion`.
- **Part C — Menus.** The pause panel becomes a menu (Resume, Restart, Settings, and
  the way out). A **Settings** dialog replaces Sound, and is opened from the Title,
  level select and the pause menu. It holds music and effects volume, and an
  on-screen controls setting.

**Depends on:** Unit 18. **Installs:** none. **Asset pipeline:** no change. Every clip
this unit needs is already packed (see Measured Facts).

**Done when** (build plan): diagonal terrain junctions render with correct inner
corners, existing saved levels are unaffected, and `prefers-reduced-motion`
suppresses shake and transitions. Plus the pause menu and settings working as below.

## Constraints That Shape This Unit

1. **Invariant 1 (fixed timestep).** Shake and dust run on `dt`. The shake pattern
   is a fixed table, not `Math.random()` or the clock, so a run replays the same.
2. **Invariant 3.** `update()` never touches the DOM, so it cannot read
   `matchMedia`. Reduced motion reaches the scene as a plain boolean the App keeps
   current. Touch-control visibility is reconciled in `render`, like the HUD.
3. **Scenes never import `ui/` or `storage/`.** The pause menu's Settings button
   calls an opener the App injects, the same way the maker gets `openShareDialog`.
4. **Invariant 2 and "existing saved levels are unaffected".** Inner corners are
   worked out from the same terrain and platform layers at draw time. No format
   change, no new field, no migration. Every campaign file stays byte-identical.
5. **4-code-standards Rendering: no allocation per frame, and no extra
   `save()`/`restore()`.** Shake moves the camera in `update`. It is not a
   `ctx.translate` in `render`. The 47-tile lookup is built once, when the module
   loads.
6. **Issue 7's rule:** the one-shot effect class gets no `flip` parameter. Both dust
   clips are symmetric (measured below), so they do not need one.

## Measured Facts (2026-09-29, from the packed art)

### The blob sheet's 31 inner-corner tiles

`tiles/island.png` is a 17 × 5 grid of 32 px cells. It has the 16 tiles in use today
(columns 0–4) and 31 more in 2 × 2 blocks at columns 6–16. Cell (16,0) is empty.

**Method.** A scratch script (session scratchpad, not committed) compared every unused
tile with each of the 16 base tiles, 16 × 16 quadrant by quadrant.

**Result.**
- Every unused tile matches exactly one base tile outside one to four corner
  quadrants.
- The changed quadrants differ by 59–97 px. The rest differ by 0–35 px of rock
  texture, which the artist varied along some edges.
- Read that way, the 31 tiles are exactly the 31 inner-corner cases an 8-neighbour
  blob needs. None is missing, none is a duplicate, and every changed corner is
  legal for its base.

A before/after render of test shapes from the real sheet showed continuous outlines
and wrapped grass everywhere, with no tile out of place.

**Rule.** A corner is **missing** when both edges beside it are present and the
diagonal cell is empty. For example, NE is missing when N and E are present and the
cell up and to the right is empty.

**Choosing a tile.** A cell with no missing corners uses its 16-tile base, exactly as
today. Otherwise it uses:

| Base mask | Missing corners | Tile (col,row) |
| --- | --- | --- |
| 3 `NE` | NE | (15,4) |
| 6 `ES` | SE | (15,3) |
| 9 `NW` | NW | (16,4) |
| 12 `SW` | SW | (16,3) |
| 7 `NES` | NE · SE · NE+SE | (6,4) · (6,3) · (12,3) |
| 11 `NEW` | NE · NW · NE+NW | (9,4) · (10,4) · (12,4) |
| 13 `NSW` | NW · SW · NW+SW | (7,4) · (7,3) · (13,4) |
| 14 `ESW` | SE · SW · SE+SW | (9,3) · (10,3) · (13,3) |
| 15 `NESW` | NE · NW · SE · SW | (6,1) · (7,1) · (6,0) · (7,0) |
| 15 `NESW` | NE+SE · NE+SW · NE+NW | (10,0) · (16,1) · (9,0) |
| 15 `NESW` | NW+SE · NW+SW · SE+SW | (15,1) · (9,1) · (10,1) |
| 15 `NESW` | NE+SE+SW · NE+NW+SE | (13,1) · (13,0) |
| 15 `NESW` | NE+NW+SW · NW+SE+SW | (12,0) · (12,1) |
| 15 `NESW` | all four | (15,0) |

16 + 31 = 47. Masks 0, 1, 2, 4, 5, 8 and 10 have no relevant corner, so they only
ever use their base tile.

### Dust

`fx/dust-jump` (6 frames) and `fx/dust-fall` (5 frames) are packed, each frame
52 × 20. A third clip, `fx/dust-run`, is also packed and stays unused (Decision 5).

| Clip | Opaque union | Centre x | Bottom |
| --- | --- | --- | --- |
| `fx/dust-jump` | x17–33, y0–19 | 25.5 | y19 |
| `fx/dust-fall` | x0–51, y12–19 | 26 | y19 |

Both are horizontally symmetric and sit on the frame's bottom row. So one placement
serves both: frame left = hitbox centre x − 26, frame top = hitbox bottom − 20. No
flip.

### Sliders (issue 26)

`ui/sliders` **is already packed** (`/assets/ui/sliders.png`, 10 frames of 12 × 12).
Issue 26's note said it was not; that note is corrected.

| Frames | Role |
| --- | --- |
| 3, 4, 5 | Horizontal track: left cap, middle, right cap |
| 2 | Its thumb |
| 7, 8, 9 | Vertical track |
| 6 | Its thumb |
| 0, 1 | Arrow ends |

### Unused player clips (for Decision 16)

`player/ground` (2 frames), `player/dead-hit` (4) and `player/dead-ground` (4) are
packed and unused.

## Decisions

| # | Question | Decision |
| --- | --- | --- |
| 1 | How is a five-feature unit kept verifiable? | **Decided (player, 2026-09-29):** one unit, three parts (A tiles, B feel, C menus). Each part is verified, committed and signed off before the next starts, and each step inside a part stays in one system boundary. *Alternative:* three units, which renumbers Units 20–21 across every doc. That is churn for no gain. |
| 2 | Do platforms get inner corners too? | **Proposed: yes.** The platform layer autotiles from the same sheet through the same function (decision 2026-09-06), so a platform mass reads like terrain. |
| 3 | Issue 2 ("grass top on the cell under a hole") | **Proposed:** close it as **by design** when Part A lands. A hole's floor is a surface, so its grass top is right. It stays under the 47-tile rules. What looked wrong was the outline breaking at the hole's corners, and Part A fixes that. |
| 4 | When does dust appear? | **Proposed:** jump dust on a jump **from the ground**, including a buffered jump on landing. Not on a coyote jump or a wall jump: the feet are in the air, and there is no wall-dust art. Landing dust when the player lands falling at `landDustSpeed` (150 px/s) or faster. A 1-tile step-down lands at ≈ 204, so only the smallest hops get none. |
| 5 | Run dust | **Proposed: not built.** `fx/dust-run` is packed, but the build plan names jump and land only, and run dust is the one clip that would need a flip. |
| 6 | What triggers shake? | **Proposed:** losing a heart while surviving it. Not a pit or water death, which ends the run. Not a stomp, and not a potion. The scene compares `stats.health` before and after `world.update`. No entity changes. |
| 7 | Shake size | **Proposed:** 3 px, 0.25 s, fading to zero. Offsets come from a fixed 8-step pattern and are whole pixels. `shakeAmplitude` and `shakeTime` go in `tuning.js`. |
| 8 | Reduced motion | **Proposed:** no shake under `prefers-reduced-motion`. It follows the OS setting live: a change applies from the next hit. There is no in-game toggle. The transitions already follow it (Unit 16), so they only need re-checking. *Alternative:* a Screen shake on/off row in Settings. |
| 9 | Pause menu contents | **Proposed:** title **Paused**, then **Resume** (primary, focused), **Restart**, **Settings**, and **Level select** or **Back to editor**. The buttons are stacked at equal width. Restart is the existing `onReplay`: back to the spawn with hearts and treasure reset. |
| 10 | Escape | **Proposed: not a pause key.** Enter and the pause button open the menu, as today. Escape and a backdrop tap close only the **topmost** panel: Settings if it is open, otherwise the pause menu (which resumes). Mapping Escape to `pause` in `input.js` would make one press close Settings *and* toggle pause. |
| 11 | What is "the settings screen"? | **Decided (player, 2026-09-29): one Settings dialog** on `openDialog`, opened from the Title (a new third button), level select (it replaces Sound) and the pause menu. A full screen cannot open over a paused game without leaving play. The maker Menu gets no Settings item: nothing in the maker uses a setting. |
| 12 | What Settings holds | **Proposed:** **Music** and **Effects** sliders (moved from Sound), and **On-screen controls: Auto · On · Off**. Auto is today's behaviour: shown once a touch is seen. `3-ui-context.md` already promises "the control setting forced to touch". It is stored as `cc:v1:settings.controls`. **Not** crisp scale: watchlist 4 builds it only if shimmer is seen, and it has not been. |
| 13 | Kit slider sprites (issue 26) | **Proposed: yes, in Part C.** It is CSS only now: frames 3–5 for the track, 2 for the thumb, and the 44 px hit area kept. *Alternative:* keep the native sliders and leave issue 26 open. |
| 14 | Pause and results text (issue 21) | **Proposed:** both panels put their title and text on a paper sheet, like every `openDialog` dialog, which closes issue 21 for them. The maker resize dialog and toolbar status keep issue 21 open, with issue 27. |
| 15 | Issue 7 (`PickupFx` name and home) | **Proposed:** Part B, step 0, as its own commit. Dust would be its fifth user. It becomes `OneShotFx` in `game/fx.js`. Pure rename and move, no flip. |
| 16 | Older deferrals that name Unit 19 | Unit 08 put death animation, hit state, knockback, ceiling spikes and dust here, and Unit 10 put knockback and a hit or death state here. **Proposed:** only **dust** is in the build plan's Unit 19. The others stay **unscheduled**. A death animation (the packed `player/dead-*` clips) is the obvious candidate if the player wants one, as its own later unit. |
| 17 | Open issues near this work | **Proposed:** not folded in: 4 (touch layout: waits for the phone run on Netlify), 9 (in-flight effects ignore a volume change: `core/`, standalone), 17, 24, 27, 30, 31. |

## Scope Boundary

**This unit covers:**
- the 47-tile autotile and its tests
- dust on jump and land
- screen shake and reduced motion
- issue 7
- the pause menu
- the Settings dialog: volumes, on-screen controls, kit sliders
- Settings buttons on the Title and level select
- `cc:v1:settings.controls`
- the pause and results panels on paper

**It does not cover:**
- run dust, a death animation, a hit state, knockback, ceiling spikes
- crisp scale, a screen-shake toggle, a reduced-motion override
- Settings in the maker Menu
- the resize dialog (issues 21 and 27)
- touch-control layout (issue 4)
- any change to the level schema, `codec.js`, `model.js`, the entity registry,
  `core/*`, `tools/*` or `public/assets/*`

---

## Part A — Inner Corners

### `src/level/autotile.js`

The 4-bit closed form and `MASK_TABLE` stay exactly as they are, and so do their 16
tests. Two additions:

```js
/**
 * The 31 inner-corner tiles, keyed "<base mask>:<missing corners, sorted>".
 * Measured from the sheet 2026-09-29 (specs/19-polish.md).
 * @type {Readonly<Record<string, readonly [number, number]>>}
 */
export const INNER_TABLE = { '3:NE': [15, 4], /* … all 31 … */ };

/**
 * Sheet cell for a present cell from its eight neighbours. A corner counts only
 * when both edges beside it are present.
 */
export function blobCell(n, e, s, w, ne, se, sw, nw, out) {}
```

- A 256-entry lookup is built once, when the module loads. It is indexed by the
  4-bit mask plus four "corner missing" bits, and holds column and row. `blobCell`
  and `autotileAt` index it; they never build strings or allocate per call.
- `autotileAt` reads eight neighbours instead of four. Cells outside the grid count
  as absent, as before. A relevant diagonal is always inside the grid, because both
  its edge neighbours are.
- `render.js` does not change: it already calls `autotileAt` for terrain and
  platforms. The theme's tile origin applies to inner tiles too, so the ship sheet
  (Unit 20) gets them for free if its layout matches. Unit 20 re-checks that.

### Tests (`autotile.test.js`)

- All 47 cases give the tile in the table above.
- All 256 neighbour combinations give one of the 47 tiles.
- A corner that does not count changes nothing: mask 0 with every diagonal present
  is still the single tile, and a mask 7 cell ignores NW and SW.
- A mass with every diagonal present gives exactly today's 16 tiles. This is the
  regression lock for "existing levels look the same except at inner corners".
- Grid edges and corners of the grid.

---

## Part B — Game Feel

### Step 0: issue 7

`PickupFx` moves from `game/collectibles.js` to `game/fx.js` as `OneShotFx`.
`world.js` imports it from there. Behaviour and tests are unchanged.

### Dust (`game/player.js`, `game/world.js`, `data/tuning.js`)

- `PlayerClips` gains `dustJump` and `dustLand`. The world passes
  `atlas.get('fx/dust-jump')` and `atlas.get('fx/dust-fall')`, and a
  `spawnFx(clip, x, y)` callback, passed like `playSfx`. The player never sees the
  fx list.
- **Jump:** `doJump()` spawns jump dust when `onFloor` is true at that moment. That
  covers a ground jump and a buffered jump on landing, and leaves out a coyote jump.
  `doWallJump()` spawns none.
- **Land:** `update()` stores `vy` just before `resolveV` and `resolveSemiSolid`
  zero it. On the frame `onFloor` turns true, it spawns landing dust if that speed
  is at least `tuning.landDustSpeed`.
- **Placement:** frame left = hitbox centre x − 26, frame top = hitbox bottom − 20
  (Measured Facts). Drawn in the existing fx pass, after the player.

### Shake (`game/shake.js` + `play-scene.js`)

```js
/**
 * Whole-pixel camera offset for a shake with `left` seconds remaining, from a fixed
 * 8-step pattern, scaled down to zero as it runs out. Pure: writes `out`.
 */
export function shakeOffset(left, duration, amplitude, out) {}
```

- **Tests:** zero once `left <= 0`; magnitude never above `amplitude`; whole pixels;
  the same inputs give the same output; the size shrinks as `left` falls.
- **The scene:**
  - `shakeLeft` is reset in `enter`.
  - After `world.update`, if the status is `'playing'`, `stats.health` dropped this
    frame, and `params.reducedMotion()` is false, it sets
    `shakeLeft = tuning.shakeTime`.
  - After `followPlayer()`, it adds the offset through the camera's rounding
    setters, and decrements `shakeLeft`.
  - Pause freezes it with everything else.
- **Reduced motion:**
  - `ui/dom.js` gains `watchReducedMotion(cb)`, a `matchMedia` change listener.
  - The App keeps a plain `reducedMotion` boolean current from it, and passes
    `reducedMotion: () => reducedMotion` in the play params.
  - The transition keeps reading `prefersReducedMotion()` when a wipe starts, as
    today.

---

## Part C — Menus

### Settings dialog (`ui/components/settings-dialog.js`)

It replaces `sound-dialog.js`, and its CSS becomes `settings-dialog.css`.

```js
/**
 * @param {HTMLElement} root
 * @param {{
 *   audio: { musicVolume: number, sfxVolume: number },
 *   controls: () => 'auto' | 'on' | 'off',
 *   setControls: (mode: 'auto' | 'on' | 'off') => void,
 *   onCommit: () => void,          // save volumes, as Sound's does today
 * }} opts
 * @returns {{ close: () => void }}
 */
export function openSettingsDialog(root, opts) {}
```

- **Music and Effects:** as today. They apply live while dragged and are saved on
  release. The kit sprites draw the track (frames 3–5) and thumb (frame 2), with
  `appearance: none` and the WebKit and Firefox range pseudo-elements. The hit area
  stays at least 44 px tall.
- **On-screen controls:** three `.btn`s, Auto · On · Off, with `aria-pressed`. The
  pressed one is drawn like a selected level-select tab (pressed, with an `--accent`
  bar). A click applies at once and saves.
- **Text** sits on the paper sheet, like every `openDialog` dialog. The single
  button is **Done**.

### Settings in storage (`storage/settings-store.js`)

- `load()` also returns `controls` when it is `'auto'`, `'on'` or `'off'`. Anything
  else is left out, and the App falls back to `'auto'`.
- `save()` takes `{ music, sfx, controls }`.
- Tests: valid, missing and malformed `controls`, and old saves that have none.

### Where Settings opens

| From | How |
| --- | --- |
| Title | A third button, **Settings** (`.btn`), below Play and Make at the same width |
| Level select | The header's **Sound** becomes **Settings**. It uses the same one-dialog slot. |
| Pause menu | **Settings** opens the dialog over the pause panel. The HUD holds its handle and closes it in `destroy`, so `M` in test-play or a restart never strands it. |

### Pause menu (`ui/hud.js`, `hud.css`)

- **Paused** and the buttons of Decision 9, on a paper sheet inside the board
  (Decision 14). The results panel is laid out the same way, with the same buttons as
  today.
- The HUD's Escape handler ignores an Escape that is already `defaultPrevented`.
  `dialog.js` prevents the default and runs first, because it listens on `document`
  and the HUD on `window`. So Escape with Settings open closes Settings only.
- `HudOpts` gains `openSettings: (root) => { close }`, passed through from
  `PlaySceneParams` like `onEdit`.

### On-screen controls in play (`ui/touch-controls.js`, `play-scene.js`)

- The `TouchController` swaps `show()` and `hide()` for `setShown(shown)`, which is
  diff-based.
- The scene drops its `onTouchDetected` subscription. `render` calls
  `touch.setShown(mode === 'on' || (mode === 'auto' && input.hasTouch))`, where
  `mode` comes from an injected `controls()` getter.
- A change made in Settings over the pause menu therefore shows or hides the
  controls on the next frame, with no callback wiring.

---

## Files

| File | Part | Change |
| --- | --- | --- |
| `src/level/autotile.js` (+ test) | A | `INNER_TABLE`, the 256-entry lookup, `blobCell`, 8-neighbour `autotileAt` |
| `src/game/fx.js` (new) | B0 | `OneShotFx`, moved out of `collectibles.js` |
| `src/game/collectibles.js`, `src/game/world.js` | B0 | Issue 7 imports |
| `src/game/player.js`, `src/game/world.js`, `src/data/tuning.js` | B | Dust; `landDustSpeed`, `shakeAmplitude`, `shakeTime` |
| `src/game/shake.js` (+ test, new) | B | `shakeOffset` |
| `src/game/play-scene.js` | B, C | Shake; `reducedMotion`, `openSettings` and `controls` params; touch reconcile |
| `src/ui/dom.js` | B | `watchReducedMotion` |
| `src/main.js` | B, C | Reduced-motion flag; settings state and openers |
| `src/ui/components/settings-dialog.js` (new; replaces `sound-dialog.js`) | C | The dialog |
| `src/ui/styles/settings-dialog.css` (renamed from `sound-dialog.css`) | C | Kit sliders, controls row |
| `src/storage/settings-store.js` (+ test) | C | `controls` |
| `src/ui/hud.js`, `src/ui/styles/hud.css` | C | Pause menu; paper sheets; Escape |
| `src/ui/touch-controls.js` | C | `setShown` |
| `src/ui/screens/title.js`, `title.css` | C | Settings button |
| `src/ui/screens/level-select.js` | C | Sound → Settings |

**Not modified:** `src/core/*`, `src/level/{schema,model,codec,render,parallax}.js`,
`src/data/palette.js`, `src/data/campaign/*`, `src/maker/*`, `tools/*` and
`public/assets/*`.

## Implementation Order

Each step is verified before the next. Each part ends with its own commit. The
player signs off on the whole unit at the end (player request, 2026-09-29).

1. **Part A.** Autotile table, lookup and tests (`npm test` green). Then look at it
   in the maker: paint the Measured Facts shapes and erase through them. Then open
   all six campaign levels and a Unit 17-era saved level.
2. **Part B, step 0.** Issue 7, its own commit.
3. **Part B.** `shake.js` and tests. Then dust, then shake in the scene with
   reduced motion.
4. **Part C.** `settings-store` `controls` and tests. Then the Settings dialog from
   level select. Then Title, then the pause menu, then touch controls. The kit
   sliders come last, so they can be dropped without touching anything else if
   Decision 13 changes.
5. **Docs** (below), the tracker, and issues 2, 7, 21 (partly) and 26 closed.

## Not Built

- Run dust, a death animation, a player hit state, knockback, ceiling spikes
  (Decision 16).
- Crisp-scale mode, a screen-shake toggle, a reduced-motion override.
- Settings in the maker. Escape as a pause key.
- A settings "reset progress" or "delete all levels" action.

## Risks To Watch

- **Edge texture varies between the base and inner-corner tiles** (up to 35 px). A
  long edge next to a notch may show a small seam. Check the campaign levels and a
  long painted wall with notches.
- **Performance.** `autotileAt` now does 8 lookups per visible cell per layer.
  That is about 300 cells on screen, so it should not show. Confirm frame time in
  the Chrome profiler at 768 wide.
- **Dust drawn over the player** may hide the feet on the first frames. If it
  reads badly, drawing fx behind the player is a small follow-up, not a reason to
  grow this unit.
- **Shake at a level's edge** can show up to 3 px past the level for a few frames,
  because it is added after the camera clamp. Judge it in play. Clamping afterwards
  would flatten the shake against the edge.
- **Escape with Settings over pause** must close Settings only. Test it with
  keyboard focus on a slider and on a button.
- **Pause menu height:** four buttons plus title and sheet at 844 × 390 and
  1000 × 360 (UI scale 1), and 1280 × 720 (UI scale 2).
- **Range input styling** differs in Chrome, Safari and Firefox. Check the thumb
  hit area and focus ring in each engine available. The phone run on Netlify covers
  iOS Safari.

## Docs To Update In The Same Change

| File | Update |
| --- | --- |
| `1-project-overview.md` | Inner-corner autotiling moves from **Deferred** into Maker features. Features: the pause menu, and Settings replacing "volume, set from My Levels". |
| `2-architecture.md` | Autotiling: the 8-neighbour rule and the 31-tile table (this spec's). Storage: `cc:v1:settings.controls`. `ui/` and `game/` file lists (`fx.js`, `shake.js`, `settings-dialog.js`). |
| `3-ui-context.md` | Title (Settings button), level select header (Settings), Play HUD pause menu, Settings dialog and its sliders (Form controls), Touch controls (the setting) |
| `4-code-standards.md` | File organization: `game/fx.js`, `game/shake.js`, `settings-dialog.js` |
| `specs/00-build-plan.md` | The Unit 19 line matches the approved decisions |
| `6-progress-tracker.md` | Per part, decisions, Session Notes |
| `7-current-issues.md` | Close 2 (by design), 7, 26, and 21 for the pause and results panels |

---

## Verification Checklist

### Part A

- [ ] `npm test`: all 47 cases, all 256 combinations, and the 16 old cases unchanged.
- [ ] In the maker: a 1-tile hole, a 2 × 2 hole, a notch, a staircase, a plus and a
      ring show continuous outlines and wrapped grass. Erasing back returns today's
      tiles.
- [ ] Platforms painted as a mass get inner corners too.
- [ ] All six campaign levels and a saved Unit 17-era level load and play
      unchanged, apart from the art at inner corners. `campaign.test.js` is still
      green, with no file changed.
- [ ] Frame time is unchanged at 768 wide.

### Part B

- [ ] Issue 7: the rename leaves every fx exactly as it was (pickups, Crabby's strike,
      projectile bursts).
- [ ] Jump dust on a ground jump and a buffered jump. None on a coyote jump or a
      wall jump.
- [ ] Landing dust after a fall of one tile or more. None on the smallest hops.
- [ ] Shake on each heart lost. None on a stomp, a potion, invulnerable contact, a
      pit or water.
- [ ] Reduced motion: no shake, the fade instead of the wipe, and a live change
      applies from the next hit.

### Part C

- [ ] Settings from the Title, from level select, and over the pause menu.
- [ ] Volumes apply live and survive a reload.
- [ ] On-screen controls: Auto shows them after the first touch. On shows them with
      a mouse only. Off hides them after a touch. A change over the pause menu
      applies on resume. The setting survives a reload.
- [ ] Pause menu: Resume, Restart and the way out each work.
- [ ] Escape closes only the top panel.
- [ ] `M` or a restart with Settings open leaves no stray dialog.
- [ ] Pause and results text sits on paper.
- [ ] Every button is at least 44 × 44, and the panels fit at 844 × 390, 1000 × 360
      and 1280 × 720.
- [ ] Kit sliders in Chrome, Firefox and Edge, with a 44 px hit area and a visible
      focus ring.
- [ ] No console errors beyond issue 28. `npm run build` is clean.

---

## As Built (2026-09-29)

Differences from the text above, found while building. Each is reflected in the
context files.

- **Part A: one existing test changed meaning.** `autotile.test.js`'s
  `layerFromMask` set only the four edge neighbours, so every diagonal was empty.
  Under 47-tile rules, a cell with N and E but no NE is an inner corner. The
  helper now fills every diagonal unless told which are missing. That keeps "a full
  mass gives today's 16 tiles" true and tests the missing corners separately. The
  grid-edge test gained its diagonal for the same reason, plus a twin without it.
- **Part B: dust from a buffered jump and a landing can share a frame.** Both
  spawn. They are different clips from the same feet, and nothing in the art argues
  against it.
- **Part C: the Settings dialog is three rows, not four.** With a separate
  "On-screen controls" heading and a hint line, it was taller than a 720-tall
  window at UI scale 2, so Done scrolled out of view. The first layout check missed
  this, because it tested the panel's box, not its content. The choice now sits on
  one row labelled **Touch**, like Music and Effects. Each button's title and
  accessible name carry the explanation, and start with the visible word ("Auto:
  touch buttons once the screen is touched"), for voice control. The check now
  fails if anything is scrolled out of view.
- **Part C: the slider caps.** The kit's rounded track caps (frames 3 and 5)
  cannot be cut from a sheet in CSS. The track is frame 4 stretched, with a
  1-art-pixel `--ink` end. Everything else is straight from the sprites.
- **Part C: focus in Settings starts on the Music slider** (the first control, as
  the Sound dialog did). A slider is a form field, so it owns its keys (issue 11):
  arrows change the volume, and `M` does nothing until focus moves to a button.
  Escape closes the dialog from anywhere in it.
- **Part C: `touch-controls.js` swapped `show`/`hide` for `setShown`,** and the play
  scene's first-touch subscription is gone. `render` reconciles visibility from
  the `controls()` getter and `input.hasTouch` every frame.

### Verification (2026-09-29)

- **Automated:** `npm test` 322 (308 + 6 autotile + 6 shake + 2 settings-store).
  `npm run build` is clean. `campaign.test.js` is green with no campaign file
  changed.
- **Part A, in the real maker** (a scratch DevTools-protocol driver on a throwaway
  headless Chrome):
  - a test level imported through Import draws continuous outlines
  - painting the 1-tile hole shut returns plain fill, and undo restores the
    notches
  - each campaign level gains 2–9 inner-corner cells
  - the autotile costs about 0.005 ms per screen
- **Part B, a harness over the real world, player, physics, play scene and
  camera** (14 of 14):
  - one jump dust and one landing dust per hop, on the floor and centred
  - none on the spawn settle or a coyote jump
  - landing dust off a 3-tile ledge
  - on spikes: a ≤ 3 px shake per heart lost, 0.7 s apart
  - none under reduced motion

  The dust was also seen in a timed screenshot sequence.
- **Part C, in the real app** (34 of 34):
  - Settings from the Title (Play, Make, Settings) and from level select (Sound
    is gone)
  - volumes and the Touch choice survive a reload
  - On shows the controls with no touch, Off hides them at once under the pause
    menu, and Auto shows them after a synthetic touch
  - the pause menu: Resume focused, then Restart, Settings, Level select
  - Escape with Settings open (focus on a slider, then on a button) closes
    Settings only, and focus returns to its button
  - Restart replays
  - results and pause text on paper
  - `M` with Settings open in test-play returns to the maker with nothing left
    over
  - at 844 × 390, 1000 × 360 and 1280 × 720, both panels fit with nothing
    scrolled away and every control is at least 44 px

  The console showed only issue 28's favicon 404.
- **Not yet seen:**
  - the kit sliders in Firefox and Safari
  - reduced motion through the real OS setting (the flag was driven directly)
  - ~~dust and shake by eye in normal play~~: seen by the player on 2026-10-03
  - the phone run, which waits for the Netlify deploy

### Sign-off (player, 2026-10-03)

The player checked the dust, the screen shake, the pause menu and Settings in
Chrome on the dev server, and closed the unit. Three items remain unseen and do not
block it:
- the sliders in Firefox and Safari
- reduced motion through the real OS setting
- the phone run, which waits for the Netlify deploy, as for every unit
