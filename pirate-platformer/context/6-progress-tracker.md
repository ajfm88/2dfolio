# Progress Tracker

Update this file after every meaningful implementation change.

Build order lives in `specs/00-build-plan.md`. This file tracks where we actually are.

## Current Phase

- **Units 00–10 complete and signed off.** Unit 10 (three walker enemies with
  genuinely distinct behaviour) play-tested and signed off 2026-09-16.

## Current Goal

- **Unit 11 — Shooters and Projectiles.** Write `specs/11-shooters-and-projectiles.md`
  before implementing. Seashell and Cannon with their fire states, the pearl and
  cannonball projectiles, terrain collision with a burst particle, lifetime
  despawn, and their palette entries. The clips are already packed (Unit 01:
  `cannon/*`, `seashell/*`, `pearl/*`). SPW `enemies.py` `Shell` /
  `Pearl` is the reference for the fire cycle and the near/front/level trigger —
  `WalkerEnemy.playerNear` / `playerInFront` already implement that trigger and
  should be the starting point rather than a second copy of it.

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
- **2026-09-10 — Unit 07 complete.** `game/play-scene.js` (scene lifecycle:
  enter, exit, update, render, mountUI/unmountUI stubs), `game/world.js`
  (factory that owns level, player, entities, parallax; update returns
  `'playing'`/`'dead'`/`'complete'`; draw renders everything),
  `game/flag.js` (animated flag entity at the goal cell, 34×93 sprite, 16×32
  hitbox), `data/palette.js` (entity registry with 5 entries: spawn, goal,
  terrain, platform, water; `byId` lookup). `main.js` rewritten from
  throwaway demo to minimal App: owns canvas/viewport/input/camera/loop/atlas,
  runs one PlayScene, restart on death or completion. New fixture
  `data/fixtures/play-demo.js` (60×16: terrain floor with two gaps, water
  bottom row, platforms over gaps, wall column, ceiling overhang). Death by
  pit (bottom border) and water (center-bottom of hitbox in water cell) both
  trigger restart. Flag completion triggers restart. Spec at
  `specs/07-play-scene-core.md`. `npm test` 74 passing (no new tests — unit
  is scene/entity wiring). `npm run build` passes. Player sign-off
  2026-09-10: everything works.
- **2026-09-12 — Unit 08 complete.** Spec at `specs/08-collectibles-and-hazards.md`.
  `game/stats.js` ports SPW `Data` setters (start 5 hearts, 100 coins → extra
  heart, no max, no DOM). `game/collectibles.js` (`Collectible` + one-shot
  `PickupFx`) and `game/hazards/spikes.js`. Palette gains 9 entity entries with
  `spawn` factories. `world.js` iterates `level.entities` via `byId(k).spawn`,
  compacts `alive === false`, draws fx after the player, returns `'dead'` on
  `stats.dead`. Player flicker uses `player/hit` frame 0. Fixture places every
  treasure kind plus jumpable spikes. `npm test` 91 passing (11 stats + 6 world).
  `npm run build` passes. Visual play (particles, flicker, pit/flag regression)
  needs player sign-off — no browser tools this session. Dev server served on
  5174; modules and sprites 200.
- **2026-09-13 — Bug fix: cloud recycle popped visible clouds (Issue #3).**
  Found during the Unit 08 play check. `parallax.js` `recycleLeftmost` selected
  the minimum wrapped `sx`, which is a still-visible cloud near the left edge,
  and teleported it to the right — clouds vanished mid-sky instead of drifting
  off the left. Extracted an exported pure `pickRecyclable` (only recycles a
  cloud fully off the left edge; returns -1 when none has, so a visible cloud is
  never moved); `recycleLeftmost` → `recycleExited` wrapper, destination
  unchanged. 4 regression tests in `parallax.test.js`. Unit 05 code, scoped bug
  fix — no schema/theme/invariant change. Moved to Resolved in
  `7-current-issues.md`.
- **2026-09-13 — Unit 09 complete.** Spec at `specs/09-hud-and-touch-controls.md`.
  First `src/ui/` layer: `dom.js`, `hud.js` (hearts row cropped from the life-bar
  medallion, coin counter from `coin/gold` frame 0, level-name CSS flash, pause
  button, paused + results overlays), `touch-controls.js` (D-pad + jump, revealed on
  first touch), and `styles/{hud,touch-controls,dialog}.css` (flat token styling;
  nine-slice still Unit 15). `core/input.js` gained virtual buttons
  (`setVirtual`/`bindVirtualButton`), touch detection (`hasTouch`/`onTouchDetected`),
  and Enter as an edge `pause` action. `play-scene.js` mounts UI via injected
  factories (game never imports ui), owns pause/timer/finished, and reconciles all
  HUD DOM in render (update stays DOM-free). `main.js` wires the `#ui` root, injects
  the ui factories, and defers restart out of `scene.update`. Enter toggles
  pause/resume and, on the results screen, triggers Play again. `npm test` 95,
  `npm run build` clean, `getDiagnostics` clean. Player sign-off 2026-09-13
  (keyboard + touch, pause/Enter, results, pit/water/flag).
  - **Two bugs found and fixed in-unit:** (1) `input.js` captured the pointer to the
    canvas on every `pointerdown`, swallowing clicks on DOM buttons — fixed by only
    engaging the world pointer when `e.target === canvas`. (2) `showResults` and the
    death/replay restart were being triggered from `update()` (DOM in update,
    invariant 3) — moved overlay open/close into the render reconcile and deferred
    restart to the App loop after `scene.update`.
  - **Deferred:** mobile touch-control layout looks off at phone width — logged as
    Issue #4, to be handled in the later responsive pass (user's call).

- **2026-09-16 — Context review and doc sync.** Read all seven context files plus
  `specs/00-build-plan.md` against the tree and fixed three drifts, no code
  touched. (1) The **Session Notes** block — explicitly the cold-resume entry
  point — still described Units 00–08 with "No HUD yet" and pointed at the Unit 09
  spec as the next thing to write, six days after Unit 09 shipped; a cold session
  trusting it would have redone finished work. Rewritten to Units 00–09, with the
  do-not list, the relitigate list and the specs-on-disk line brought forward.
  (2) `2-architecture.md` stack table said Vite 7; installed is **8.2.2**
  (vitest 5.0.0), which the Unit 00 entry already recorded correctly. (3) The
  Unit 01 atlas debug page is still in the tree, marked removable by Unit 01 and
  kept by Unit 02 with no reason given — logged as issue 5 rather than deleted,
  since it may earn its keep again when Units 10/11/20 add clips. Verified while
  reviewing: `npm test` 95 passing across 8 files, `src/maker/` and
  `src/storage/` correctly empty, `specs/10-walker-enemies.md` not yet written.

- **2026-09-16 — Unit 10 complete.** Spec at `specs/10-walker-enemies.md`.
  `game/entities/walker-enemy.js` (shared base) plus `crabby.js`,
  `fierce-tooth.js`, `pink-star.js`; three palette entries; two `tuning.js` keys
  (`enemySenseHeight`, `enemyTurnCooldown`); `Player.bounce()`; `level` added to
  the world spawn handle. Everything else reused as-is — `resolveH`/`resolveV`/
  `resolveSemiSolid`/`checkFloor`/`checkWall*` needed no new export, and
  `world.js` needed no spawn or draw change. `npm test` 122 passing (95 prior +
  27 walker), `npm run build` clean, `getDiagnostics` clean on every touched file.
  Player sign-off 2026-09-16 after a full playthrough: "all 3 enemies were
  implemented so well".
  - **The three behaviours were derived from the art, not invented.** Measured
    opaque bounds and centroid shift across all 24 enemy clips: Crabby's centroid
    sits within 0.7 px of canvas centre in every clip and its `attack` throws both
    claws to opposite canvas edges at once, so it is face-on with **no safe side**;
    Fierce Tooth's centroid swings +0.5 → **−1.1 during `attack`**, so it is a
    committed forward **lunge**; Pink Star's `attack` is a spinning pinwheel, so it
    is **un-stompable while spinning** and triggers on the player being *above* it.
    Silhouette mirror-symmetry was tried first and discarded — the player scores
    5.6 % asymmetric and is plainly directional, so it measures nothing useful.
  - **One state mechanism, no special cases.** Every state but `patrol` carries a
    `stateTimer` that defaults to its clip's length, and every clip wraps. That
    yields "plays exactly once" for free and lets Pink Star's longer spin loop its
    clip, with no clip-end callbacks. Stomp tests the body hitbox; damage tests a
    `damageBox` that defaults to it, which is the whole reason Crabby's 118 px
    strike costs no branching in the base.
  - **Decisions taken:** kind ids `crabby` / `fierce_tooth` / `pink_star` (see
    below); `src/game/entities/` as the folder, per the architecture doc and
    success criterion 7; enemies follow `Player`'s placement (hitbox bottom = feet),
    not `Collectible`'s (sprite-canvas bottom), which would float art that has
    transparent padding under the feet; `flipOffsetX` added for the one enemy that
    flips.
  - **Deliberately not built:** `hit` / `dead-hit` and the `tooth`/`star`
    `attack-effect` clips stay unused, and `Jump`/`Fall`/`Ground` stay unpacked —
    packing them would have made this an asset-pipeline unit too.
  - **Found, not fixed:** `jsconfig.json`'s `baseUrl` now reports as a deprecation
    **error** from the editor's TypeScript service, so a project-wide
    `getDiagnostics` is no longer clean even though every source file is. Logged as
    issue 6; it is Unit 00's file and unrelated to enemies.

## In Progress

- None. Unit 10 signed off; next is the Unit 11 spec.

## Next Up

- **Unit 11 spec is written** (`specs/11-shooters-and-projectiles.md`, 2026-09-16)
  and is waiting on sign-off. Implementation deferred by the player.
  - It deliberately makes the **opposite** call to Unit 10: **one `Shooter` class
    and one `Projectile` class**, both configured from the palette, because the art
    gives Cannon and Seashell the same verb — idle (n=1) → fire (n=6) → idle, with
    `fire` frame 3 the shot in both, which is also where SPW fires. Inventing a
    behavioural split the art does not support would be worse than having none.
  - The real difference is the ammunition, and it is one teachable fact: the pearl
    moves at **75 px/s** (SPW's 150 halved) which is **slower than the player's 100**,
    and the cannonball at **150** which is faster. You can out-run a pearl and never
    a cannonball.
  - Shooter bodies **do not damage** the player — a direct port, since SPW puts
    `Shell` in `collision_sprites` and not `damage_sprites`. They are not solid
    either, which *is* a deviation: we have no entity-vs-player resolution and
    adding one would push against invariant 4.
  - Two reuse points settled: `playerNear` / `playerInFront` move out of
    `WalkerEnemy` into a pure `src/game/sense.js` now that a second consumer
    exists, and `physics.js` gains one `checkSolid(rect, level)` query (terrain
    only — platforms are thin ledges and must not stop shots).
  - The muzzle flash needs no `PickupFx` change: `cannon/fire-effect` and
    `cannon/fire` are both 6 frames, a matched pair, so the shooter draws it
    itself at the muzzle sharing its own frameIndex and flip.

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
5. ~~**Enemy variety.**~~ **Resolved 2026-09-13** — Crabby, Fierce Tooth and Pink
   Star get **genuinely distinct behaviour**, not just distinct art/stats (player
   decision). They still share the `WalkerEnemy` base for movement/collision/stomp,
   but each overrides behaviour meaningfully. The per-enemy behaviour design is part
   of the Unit 10 spec. See the Architecture Decisions entry below.

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

**2026-09-10 — Factory-function World, not a class.**
`createWorld(level, theme, atlas, keys)` returns a plain object with `update`,
`draw`, `player`, `level`, `worldW`, `worldH`. Created fresh on each level
enter/restart. *Why:* consistent with `createLoop`, `createCamera`,
`createParallax` — the core factory pattern. No `this` context to lose, no
inheritance. The World does not own the camera, input, or viewport — those
belong to the App (`main.js`). The scene passes `camX` and `viewW` into
`world.update()`.

**2026-09-10 — `world.update()` returns a status string.**
`'playing'`, `'dead'`, or `'complete'`. The scene reads the return value and
calls the appropriate callback (`onDeath`, `onComplete`). *Why:* the World
knows the game state but must not know about scenes, UI, or transitions. A
return value keeps it decoupled — the scene decides what death or completion
means.

**2026-09-10 — `main.js` is a minimal App, not a scene manager class.**
It owns canvas/viewport/input/camera/loop/atlas and runs one PlayScene. The
loop delegates to `scene.update(dt)` and `scene.render(ctx, cam)` via closures —
no changes to `core/loop.js`. Restart re-deserialises the fixture for a fresh
LevelModel. *Why:* a full scene manager with transition stack is premature until
Unit 16 (test-play round trip) and Unit 18 (title, level select). The current
shape is easy to grow without rework.

**2026-09-10 — `palette.js` has tile and marker entries, not just entities.**
Tile entries (`placement: 'tile'`) have no `spawn` function — they represent
layers. Marker entries (`placement: 'marker'`) are structural metadata. Only
entity entries (future) have `spawn` factories. *Why:* the maker palette
(Unit 13) needs all placeable things in one registry. Having them from the start
means the maker reads `palette.js` without changes.

**2026-09-12 — Stats class with SPW property setters, not a 3-heart cap.**
Start 5, no max, 100 coins → +1 heart, coin values unhalved (1/5/20/50).
Setters never touch DOM. *Why:* Unit 08's "property setters" is SPW `data.py`.
Unit 09 HUD must render `stats.health` hearts.

**2026-09-12 — Spikes are entities, not a tile layer.** Format 1 cannot grow a
fourth layer. Atlas `spikes` is a 32×32 object. Hitbox is the bottom 16 px.

**2026-09-12 — Invuln flicker is `player/hit` frame 0, not a sixth state.**
Draw-time only, period 50 ms from remaining invuln. No knockback, no death clip.

**2026-09-12 — World spawns via `palette.spawn`; unknown kinds skipped.**
No `switch` on kind. Kind-in-registry schema checks wait (codec tests still use
`'crabby'`). Flag stays a hardcoded marker.

**2026-09-13 — UI factories are injected into scenes; scenes never import `ui/`.**
Dependencies point inward (`ui → game → level → core`). `main.js` (composition root)
imports `createPlayHud`/`createTouchControls` and passes them as `params.ui`; the
scene calls them in `mountUI`. Future scenes follow this pattern.

**2026-09-13 — HUD DOM is reconciled in the scene's render, never in update.**
`update()` only flips state (paused/finished/coins/health via stats); `render()`
calls the HUD controller's diff-based sync + overlay open/close. Invariant 3:
update never touches the DOM; render never mutates game state. Restart (which
mounts/unmounts DOM) is requested from update via a flag and executed by the App
loop after `scene.update` returns — never inside update.

**2026-09-13 — Enter is an edge `pause` action in `input.js`; input is preventDefaulted.**
Keyboard still flows only through `core/input.js`. Enter maps to a `pause` action
(edge-triggered like the others) and is `preventDefault`ed, so a focused overlay
button never double-fires with the app-level Enter handling. The scene toggles
pause on the edge, or triggers replay when the results panel is up.

**2026-09-13 — On-screen controls feed input via `bindVirtualButton`; world pointer is canvas-only.**
Touch buttons call `input.bindVirtualButton(el, action)` (all pointer wiring stays
in `input.js`). The window-level world-drag pointer now engages only when
`e.target === canvas`, so presses on DOM controls keep their own click/capture.

**2026-09-13 — The three walker enemies get genuinely distinct behaviour.**
Crabby, Fierce Tooth and Pink Star share the `WalkerEnemy` base (patrol, ledge/wall
turn, contact damage, stomp-to-kill + bounce), but each overrides behaviour in a way
that actually plays differently — not the same behaviour reskinned. *Why:* player
decision; the pack gives each its own Anticipation/Attack frames, so the art already
implies distinct combat reads. The concrete per-enemy behaviour (e.g. how each reacts
to the player, lunge vs charge vs something else) is designed in the Unit 10 spec
before implementation. Adding an enemy stays one palette entry + one class
(invariant 5); distinct behaviour lives in each class, not in shared branching.

## Session Notes

Resume cold from here.

**Where we are:** Units 00–10 done in code and signed off. World spawns
treasure and spikes from `level.entities` through `palette.js`; Stats tracks
hearts and coins (start 5, 100 coins → +1 heart). Spikes hurt with 700 ms invuln
and a draw-time white flicker; health 0, the pit and water all return `'dead'`
(restart). Pickups despawn with a one-shot fx clip. The first `src/ui/` layer is
in: DOM HUD (hearts row, coin counter, level-name flash, pause button, paused and
results overlays) plus an on-screen D-pad and jump button revealed on first touch.
Scenes never import `ui/` — `main.js` injects the factories. All three walker
enemies are in and play differently from each other: Crabby strikes both sides at
once and has no facing, Fierce Tooth lunges then is helpless, Pink Star is
un-stompable while spinning and triggers on being dived at. No shooters yet.

**Next:** Implement Unit 11 against `specs/11-shooters-and-projectiles.md`, which
is already written and needs no research — every number in it is measured and
sourced. Read it in full before starting; the decisions that are easy to get wrong
are all stated there. Two in particular: it is **one `Shooter` class and one
`Projectile` class** for both kinds (the art gives them the same verb), not a class
each; and the `fireFrame` shot **must** be guarded by a `hasFired` flag, because
frame 3 spans six ticks at 60 Hz and an unguarded check fires six projectiles per
cycle. `playerNear` / `playerInFront` move out of `WalkerEnemy` into a new pure
`src/game/sense.js` — Unit 10's tests must keep passing unedited.

**How to run**

- `npm run dev` — game at `/`, atlas at `/atlas.html` (throwaway debug page,
  issue 5). Prefer a fixed port; 5173 may already be another project (ArcGIS).
  `--port 5174 --strictPort`.
- `npm test` — 122 tests (schema, model, codec, autotile, parallax incl. cloud
  recycle, physics, stats, world collect/hurt, walker enemies).
- `npm run build` — passes.
- `npm run assets` — needs `reference/treasure-hunters`. Output is committed.

**Do not**

- Import `atlas.json` from `core/`.
- Pack sword clips, ship tilesheet, or Pixel Adventure leftovers. Enemy
  `Jump`/`Fall`/`Ground` stay unpacked too — packing is its own unit.
- Add audio or any maker code (Units 12+). Unit 11 is shooters only.
- Relitigate: DOM UI, level-select (no overworld), stomp-only, local + share
  codes, 5 starting hearts, spikes-as-entities, injected UI factories, distinct
  per-enemy behaviour.

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
- Touch-control layout at phone width is deferred by player decision (issue 4 in
  `7-current-issues.md`). Do not "fix" it inside an unrelated unit.
- A project-wide `getDiagnostics` reports one error against `jsconfig.json`
  (`baseUrl` deprecation, issue 6). Source files are clean; check per file.
- Enemies are **not solid** — the player passes through them. Contact is an
  overlap test, not a collision, so there is no standing on an enemy's head.

**Environment:** Node 24.19, npm 11.17, git 2.52, Windows. Python 3.14 has no
`pygame`/`pytmx` — read the references, do not launch them. `reference/` is
read-only. Audio is CC0 from `reference/super-pirate-world/audio/`.

**Facts not to guess:** 16-case autotile table and player hitbox 18×26 offset
(−23, −6) in `2-architecture.md`. Flag hitbox 16×32, draw offset (−9, −61),
sprite 34×93. Collectible opaque bounds and spike 32×16 hitbox in
`specs/08-collectibles-and-hazards.md`. Enemy hitboxes, draw offsets and the
measurements they came from in `specs/10-walker-enemies.md`, and shooter/projectile hitboxes, muzzle points and
projectile speeds in `specs/11-shooters-and-projectiles.md`; the offset formula
is `drawOffsetX = -(opaqueX + (opaqueW - hitboxW) / 2)`,
`drawOffsetY = hitboxH - feetY`, which reproduces the player's own (−23, −6).
Re-measure if any look wrong.

**Specs on disk:** `00-build-plan.md` plus units 00–11 (11 written, not yet built).
Playbook:
`context/README.md` Part 3.
