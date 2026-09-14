# Progress Tracker

Update this file after every meaningful implementation change.

Build order lives in `specs/00-build-plan.md`. This file tracks where we actually are.

## Current Phase

- **Units 00–06 complete.** Physics-driven Captain on the autotiled island
  fixture with parallax. Runs, jumps (variable height), wall-slides, wall-jumps,
  lands on terrain, stands on semi-solid platforms, drops through them. Coyote
  time and jump buffering work. Player confirmed `/` looks right.

## Current Goal

- **Paused.** Next unit when work resumes: **Unit 07 — Play Scene Core.**
  Write `specs/07-play-scene-core.md` before implementing.

## Completed

- **2026-09-05 — Reference study.** Read `reference/pirate-maker/28_finish`
  (editor, level, sprites, menu, main) and
  `reference/super-pirate-world/code_complete` (all 13 modules) end to end.
  Identified what to port and what to reject.
- **2026-09-05 — Asset audit.** Measured all 1204 PNGs in the art pack.
  Established native tile size, the 47-tile blob layout, the verified 16-case
  autotile table, sprite opaque bounds for hitboxes, the UI nine-slice structure,
  and the sampled colour palette.
- **2026-09-05 — Context system authored.** Numbered the seven context files to
  match the read order and rewrote all of them for this project. Added
  `context/specs/00-build-plan.md`.
- **2026-09-05 — Context layout flattened.** The old `docs/` folder is now
  `context/`, holding the seven numbered files, `specs/` and the playbook
  (`README.md`). The single entry point is `CLAUDE.md` at the repository root,
  which Claude Code loads automatically.
- **2026-09-05 — Reference material moved into `reference/`.** The three source
  folders were renamed to kebab-case and moved under `reference/`, clearing the
  repository root for the game. All paths in the context files were updated.
- **2026-09-05 — Build plan re-split from 15 to 22 units.** Three units were doing
  too much to verify in one pass.
- **2026-09-05 — Unit 00 complete.** Git repo, Vite 8.2 project, folder skeleton
  (`src/core`, `level`, `data`, `game`, `maker`, `ui/styles`, `storage`, `tools`),
  `jsconfig.json` with `checkJs`, `settings.js` with all engine constants,
  `base.css` with every colour token from `3-ui-context.md`, self-hosted Pixelify
  Sans (latin woff2, OFL), `index.html` with canvas + `#ui` overlay, `main.js`
  with viewport sizing and a fixed-timestep loop (1/60 s accumulator, 5-step cap)
  that clears to the sky colour. `npm run build` passes. Spec written at
  `specs/00-project-scaffold.md`.
- **2026-09-06 — Unit 01 complete.** `tools/asset-manifest.mjs` +
  `tools/build-assets.mjs` (`sharp` devDep). Packs unarmed Captain, three
  walkers, Cannon/Seashell, treasure, island tiles/palms/flag/parallax, Merchant
  Ship water top (96×32), Wood and Paper nine-slices and HUD strips, and all
  seven CC0 audio files. Two consecutive runs are byte-identical. Coverage
  428 + 767 unused = 1195, no guides in unused. Throwaway `/atlas.html` draws
  all 86 clips. Spec at `specs/01-asset-pipeline.md`. `src/core/atlas.js` is
  still Unit 02. `/atlas.html` is removable then.
- **2026-09-06 — Unit 02 complete.** `core/loop.js`, `viewport.js`, `camera.js`,
  `input.js`, `atlas.js`, `sprite.js`, `rect.js`. `main.js` is a throwaway demo:
  80×24-tile world, `player/idle` at 10 FPS in fixed-dt, arrows/WASD plus
  pointer-drag, camera follow with clamp-or-centre. `core/` does not import
  `data/` — `main.js` passes `atlas.json` into `loadAtlas`. Spec at
  `specs/02-engine-core.md`. `/atlas.html` kept. `npm run build` passes.
- **2026-09-06 — Unit 03 complete.** `level/schema.js` (`LevelError` names the
  field), `level/model.js` (`Uint8Array` layers, resize), `level/codec.js` (RLE,
  JSON, share codes with `z` deflate-raw and `u` uncompressed). Typedefs in
  `src/types.js`. Vitest 38 tests. Kind-in-registry checks deferred until
  `palette.js` exists (Unit 07) so schema does not hardcode kind ids. Spec at
  `specs/03-level-model-and-codec.md`. Captain demo unchanged.
- **2026-09-06 — Unit 04 complete.** `level/autotile.js` closed form matches the
  16-mask table; tests cover all masks, grid edges, and erase. `data/themes.js`
  island only, origin (0,0), same blob sheet for terrain and platform.
  `level/render.js` draws the visible cell range. Fixture `autotile-demo.js`
  (40×12). Debug grid removed. `npm test` 44 passing. Spec at
  `specs/04-tile-rendering-and-autotiling.md`. No collision yet.
- **2026-09-07 — Unit 05 complete.** Horizon derived from the first water row
  (no schema field). `level/parallax.js` owns a wrapping 20-cloud pool, big-cloud
  drift, and 6 water-reflect sprites; `update` mutates, `draw` does not.
  `drawLevel` paints sky/sea/horizon bands, `BG Image` at 0.25, big clouds at
  0.5 plus drift, small clouds at 0.85, then tiles, then reflections. Island
  theme carries colours and rates. Spec at `specs/05-parallax-background.md`.
  `npm test` 52 passing. `npm run build` passes. Walked `/` in Chrome: layers
  lag at distinct rates, horizon sits on the water row, no pop at the level end.
  Player sign-off 2026-09-07: `/` looks right. Spec checklist ticked.
- **2026-09-09 — Unit 06 complete.** `game/physics.js` (tile-grid collision
  resolver: resolveH, resolveV, resolveSemiSolid, checkFloor, checkWallLeft,
  checkWallRight), `game/player.js` (run, variable-height jump, coyote time,
  jump buffer, wall slide, wall jump, drop-through, moving-platform carry stub,
  five-state animation machine), `data/tuning.js` (all physics constants from
  the architecture doc, SPW values halved). `core/input.js` extended with `jump`
  action (Space key). Throwaway `main.js` demo replaced with physics-driven
  player. Fixture extended with ceiling overhang at cols 28–30, spawn moved to
  (8,9). Spec at `specs/06-player-physics.md`. `npm test` 74 passing (22 new
  physics tests). `npm run build` passes. Player sign-off 2026-09-09: `/`
  looks right.

## In Progress

- None. Session paused after Unit 06.

## Next Up

- **Unit 07 — Play Scene Core.** Spec not written yet.

## Open Questions

1. **Campaign length.** Five to eight levels is the current target. The real number
   depends on how fast levels can be authored once the maker exists. Revisit after
   Unit 16.
2. **PWA scope.** Offline play is a goal, but whether the service worker precaches
   every theme's assets or only the first is undecided. Revisit at Unit 21.
3. ~~**Second theme timing.**~~ **Resolved 2026-09-05** — Pirate Ship is now its
   own Unit 20, after the campaign. Unit 04 only has to shape `data/themes.js` to
   accept more than one theme.
4. **Level growth UX.** The schema allows growing a level up to 400 × 48, but the
   maker interaction for growing it — edge handles? a size dialog? — is not
   designed. Needed by Unit 15.
5. **Enemy variety.** Crabby, Fierce Tooth and Pink Star share an identical clip
   structure, so all three are nearly free. Whether they get distinct behaviour or
   just distinct art and stats is open. Decide at Unit 10.

## Architecture Decisions

Decisions taken so far, with the reasoning that produced them.

**2026-09-05 — DOM overlay for all UI, canvas for the world only.**
Menus, the maker palette, dialogs and the HUD are DOM positioned over the canvas,
styled with the Wood-and-Paper nine-slices via `border-image`. *Why:* the maker needs
scrolling lists, text inputs for level names and share codes, focus handling and safe
-area insets. PirateMaker draws its menu in canvas (`28_finish/menu.py`) and pays for
it with hand-written hit testing; on mobile that approach also loses the native
keyboard and all accessibility. Cost: two rendering systems to keep visually aligned,
which the shared colour tokens in `3-ui-context.md` handle.

**2026-09-05 — Level-select grid instead of a node-graph overworld.**
*Why:* the Treasure Hunters pack contains no overworld tileset — Super Pirate
World's came
from a different pack — so porting `overworld.py` would need art we do not have.
A grid also serves campaign levels and user-made levels with one screen, which the
maker requires anyway. Progress data is still shaped per-level so an overworld could
be layered on later without migrating saves.

**2026-09-05 — Stomp-only combat; no sword.**
*Why:* Captain Clown Nose has a full combo, air-attack and throw animation set, but
attack state machines, cancel windows and hitbox timing are a unit of work on their
own, and they complicate every enemy. Stomping keeps the player state machine to
seven states and keeps the maker palette small. Enemies keep their Anticipation and
Attack clips for lunge-at-player contact damage, so the art still reads as combat.
The sword clips stay unused and unpacked.

**2026-09-05 — Local storage plus copy-paste share codes; no backend.**
*Why:* no server, no accounts, works offline, and sharing still works. Levels are
stored already-compressed so the ~5 MB quota holds hundreds.

**2026-09-05 — Render at native 32 px tiles, not Clear Code's upscaled 64 px.**
*Why:* the Pixelfrog art is authored at 32 px per tile; both Python projects
upscaled it 2×. Rendering natively and scaling the whole canvas halves memory,
removes an asset preprocessing step, and keeps every sprite crisp at any zoom.

**2026-09-05 — Fixed-height virtual viewport, flexible width.**
360 world units tall always; width is `clamp(round(360 × aspect), 512, 768)`.
*Why:* nothing is letterboxed on any device, which matters most in the maker where
screen space is scarce. 360 tall reproduces exactly the field of view Super Pirate
World showed at 720 ÷ 64. The clamp stops ultrawide displays from seeing unfairly
far ahead.

**2026-09-05 — Port Super Pirate World's physics, not PirateMaker's.**
*Why:* SPW's old-rect/new-rect edge comparison is what makes one-way platforms,
drop-through and moving-platform carry correct. PirateMaker's gravity is frame-rate
dependent, and its `apply_gravity` writes `self.rect.y` only for `move()` to
overwrite it — a dead line. We add a fixed timestep, a terminal velocity clamp,
coyote time and jump buffering, none of which either reference has.

**2026-09-05 — 4-bit autotiling now, 47-blob inner corners later.**
*Why:* sixteen of the sheet's 47 tiles form a complete, verified 4-neighbour set
whose mapping is certain today. The other 31 are inner-corner refinements that can
land later without touching the level format.

**2026-09-05 — Everything in a level is grid-snapped.**
*Why:* PirateMaker allows free pixel placement via `CanvasObject.distance_to_origin`
and pays for it in the editor, the exporter and the level builder. On a touchscreen,
precise free placement is also miserable. Snapping removes all three costs.

**2026-09-05 — String kind ids in the level format, not indexes.**
*Why:* PirateMaker keys its level data on `EDITOR_DATA` integer ids, so reordering
the registry would corrupt existing levels. Strings make the format self-describing
and reorder-safe.

**2026-09-05 — Full pack coverage is a stated goal; v1 is the reference-project subset.**
v1 ships what PirateMaker and Super Pirate World between them prove out. Everything
else in Treasure Hunters is roadmap, captured as the **Beyond v1** table in
`1-project-overview.md` — each row an asset group the references never touch, paired
with the mechanic its frames imply. *Why it is a table and not a wish:* the artist
drew states that only make sense as mechanics — a sword with **Embedded** frames is a
throwable that sticks in a wall; a chest with a separate **Padlock** state needs a
key; a sail with **Wind / No Wind and both transitions** implies wind that changes.
Reading the frame list is how the roadmap was derived. To stop this drifting into
aspiration, `npm run assets` prints an asset coverage report (341/1195-style) and
writes `tools/coverage.json`; the denominator is fixed at 1195 — the 1204 sprite PNGs
minus the nine `(guide).png` UI reference images. Nothing in the table is built,
scaffolded or hooked for during v1; each row earns a unit in the build plan first.

**2026-09-05 — Game at the repository root, references under `reference/`.**
*Why:* the game needs to be the project — `CLAUDE.md` is only auto-loaded from a
repository root, and putting the game in a subfolder would mean opening the subfolder
instead of the repo. Moving the three reference folders down one level clears the
root without that cost. `reference/` is gitignored, and because `public/assets/` is
committed, the game clones, builds and runs without the 1204-file art pack — only
`npm run assets` needs it restored.

**2026-09-05 — Build plan re-split from 15 units to 22.**
*Why:* three units failed the playbook's own test — "if it cannot be verified end to
end quickly, split it". Old Unit 06 bundled the play scene, collectibles, hazards,
the health model, the HUD, touch controls and the results panel. Old Unit 10 mixed
gestures with the whole responsive palette UI. Old Unit 14 was a grab bag of polish,
the second theme and the PWA. They became Units 07–09, 14–15 and 19–21. Parallax
split out of tile rendering (04 → 04 + 05) and shooters split from walker enemies
(07 → 10 + 11) for the same reason. The other twelve were already right-sized.
The undo/redo command stack deliberately stayed **inside** the maker-painting unit
rather than becoming its own — splitting it would ship code that violates
invariant 7 and then retrofit it.

**2026-09-05 — Build-time asset packing into per-clip strips.**
*Why:* 1204 loose PNGs in paths with spaces would mean hundreds of requests and
frame ordering that depends on directory walk order — a real bug in the Python
references. Per-clip strips plus a generated manifest fixes both, and per-clip is
simpler to debug than one global atlas.

**2026-09-06 — Pack Coral Corsairs v1 clips, not the Python import lists.**
The Python games loaded Captain-with-sword, Pixel Adventure palms/water, and no
Crabby / Pink Star / Cannon. This game's v1 is unarmed Captain, three walkers,
Cannon + Seashell, three diamond colours, and Wood and Paper UI. Unit 01 packs
that set from `reference/treasure-hunters/**/Sprites/**` plus
`reference/super-pirate-world/audio/`. It does not pack `pirate-maker/graphics/`
or `super-pirate-world/graphics/`.

**2026-09-06 — `core/` does not import `src/data/atlas.json`.**
Invariant 11. `main.js` loads the JSON and passes it to `loadAtlas`. Keep it
that way.

**2026-09-06 — Share-code prefixes `z` / `u` live in the codec now, not Unit 17.**
`encodeShare` / `decodeShare` are async. Unknown prefix throws; decode never
guesses. Storage UI is still Unit 17.

**2026-09-06 — Schema does not check kind ids against a registry.**
`palette.js` does not exist until Unit 07. `k` must be a non-empty string.
Kind-in-registry validation waits for the palette so schema never hardcodes a
kind list (invariant 5).

**2026-09-06 — Island platform layer uses the terrain blob sheet.**
`tiles/island-platforms` is a 3×3 palm-base sheet, not a 16-mask set. Autotile
for terrain *and* platform samples `tiles/island` at origin (0,0). Ship theme
still Unit 20.

**2026-09-06 — Sprite X-flip uses `translate` + `scale(-1,1)`, not negative
`drawImage` width.** Negative dest width was ignored under the viewport's
`setTransform` scale. One `save`/`restore` per flipped sprite; the Unit 02
demo draws one sprite so it stays within the per-frame budget.

**2026-09-06 — Input listens on `window` in capture phase.**
`#ui` is a full-viewport overlay with `pointer-events: none`. Canvas-only
listeners did not receive clicks/keys reliably. Keyboard is arrows + WASD.
`pointercancel` is treated as release.

**2026-09-07 — Horizon is derived from the water layer, not stored.**
Format 1 has no `horizon` field. `horizonY` is the top of the first water row
(`rows * TILE` if empty). Pirate Maker's sky handle is maker UI (Unit 13+).
A mid-level pool still sets one global horizon.

**2026-09-07 — Parallax colours and rates live on the theme.**
Canvas cannot read CSS custom properties. Island theme carries sky/sea/horizon
hexes (matching `3-ui-context.md` tokens), clip ids, and the halved SPW speeds.
Unit 20 can swap them without touching `autotile.js`. No `tuning.js` yet.

**2026-09-07 — Clouds wrap a fixed pool; they are not spawned or killed.**
20 small clouds and 6 reflections, seeded from an LCG on `level.id`. Positive
modulo wrap so a negative camera offset does not pop. The 2.5 s timer recycles
the leftmost cloud to the right of the view.

**2026-09-09 — Grid-based collision resolver, not per-tile sprite objects.**
SPW creates a `Sprite` per terrain tile and iterates `pygame.sprite.Group` for
collision. We resolve directly against the `LevelModel` `Uint8Array` grid —
compute the overlapping cell range from the hitbox bounds, iterate only those
cells. No allocation, no sprite objects. The old-rect/new-rect edge comparison
logic is identical to SPW.

**2026-09-09 — `input.js` has a `jump` action separate from `up`.**
Space maps to `jump`, not `up`. The player checks both `keys.jump.pressed` and
`keys.up.pressed` for jump input. This keeps the maker (Unit 13+) from
interpreting Space as a pan-up gesture.

**2026-09-09 — `tuning.js` now exists with all physics constants.**
Parallax colours and rates still live on the theme (2026-09-07 decision). Physics
numbers live in `data/tuning.js`. The two do not overlap.

## Session Notes

Resume cold from here.

**Where we are:** Units 00–06 done. On `/` the Captain runs, jumps (variable
height), wall-slides, wall-jumps, lands on terrain, stands on semi-solid
platforms, and drops through them. Coyote time and jump buffering work.
Parallax, autotiling, and all prior features still work. `/atlas.html` still
lists packed clips.

**Next:** Unit 07 — Play Scene Core. Spec first
(`specs/07-play-scene-core.md`). Do not start Unit 08 until 07 is done.

**How to run**

- `npm run dev` — game at `/`, atlas at `/atlas.html`. Prefer a fixed port;
  5173 may already be another project (ArcGIS). `--port 5174 --strictPort`.
- `npm test` — 74 tests (schema, model, codec, autotile, parallax, physics).
- `npm run build` — passes.
- `npm run assets` — needs `reference/treasure-hunters`. Output is committed.

**Do not**

- Grow `src/main.js` into an App/scene framework. That is Unit 07.
- Import `atlas.json` from `core/`.
- Pack sword clips, ship tilesheet, or Pixel Adventure leftovers.
- Relitigate: DOM UI, level-select (no overworld), stomp-only, local + share
  codes.

**Standing hazards**

- Zipping the repo while Vite is running used to EBUSY-crash the watcher on
  `src.zip`. `.gitignore` has `*.zip`; `vite.config.js` `server.watch.ignored`
  is `**/*.zip`. Restart Vite if you change that config.
- Wood and Paper 16-tile composites are the kit *guide*, not a 9-slice. Open
  issue 1 in `7-current-issues.md`. Fix when DOM `border-image` is first used
  (maker/title, ~Unit 15/18).
- Unarmed Captain has no wall-slide clip. `wall` state reuses `player/fall`.
  Expected until sword combat is added (Beyond v1).
- Hole in the autotile mass shows a grass top on the cell below (4-neighbour,
  no inner corners). Expected until Unit 19.

**Environment:** Node 24.19, npm 11.17, git 2.52, Windows. Python 3.14 has no
`pygame`/`pytmx` — read the references, do not launch them. `reference/` is
read-only. Audio is CC0 from `reference/super-pirate-world/audio/`.

**Facts not to guess:** 16-case autotile table and player hitbox 18×26 offset
(−23, −6) in `2-architecture.md`. Re-measure if either looks wrong.

**Specs on disk:** `00-build-plan.md` plus units 00–06. Playbook:
`context/README.md` Part 3.
