# Progress Tracker

Update this file after every meaningful implementation change.

Build order lives in `specs/00-build-plan.md`. This file tracks where we actually are.

## Current Phase

- **2026-10-07: Unit 22 (PWA and Performance) is complete. Units 00–22 are
  complete: every unit in the v1 build plan is done.**
  - The player installed the app from the production build
    (`npx vite preview`, `http://localhost:4173`), uninstalled it, and signed
    the unit off: "it all works well".
  - Claude's review passed every part after the issue 46/47 fix (`8a306f1`):
    399 tests, and a real offline run with the server process killed.
  - Not done, by decision: the Netlify deploy and the real-phone checks (install,
    offline, frame time under `?perf`).
  - Work ends for today, at the player's request.
- **2026-10-07: Issues 46 and 47 fixed.** The worker matches a precached URL with `ignoreVary: true`, and `renderServiceWorker` inserts the version and the file list through replacer functions. Both new tests were written first and failed, then the suite passed: 399 tests in 34 files. The build logged `pwa: sw.js caches 104 files (version 558a819acf4c)`. A fresh Chrome profile loaded `/`, the worker took control, and the preview server process was stopped before reload. The title, Settings, Castaway Beach with all six sounds, the maker (palm, Pirate Ship, test play) and `/?perf` (`0.0 ms avg · 0.1 max · 58 fps`) worked from cache `cc-558a819acf4c`. The page network log recorded no failed request. The player has not signed Unit 22 off.
- **2026-10-07: Unit 22 Part E complete.** Desktop Chrome 154 allocation samples
  (S1–S4, two runs), rebuild timings, and production `?perf` frame times are in
  the spec's As Built. `cellRangeX` / `cellRangeY` never appeared in the samples;
  the scratch-range fix stays. A 2000-palm rebuild median was 8.68 ms at no
  throttle (issue 45, not fixed). Idle samples still land on `frame` (issue 44,
  not fixed). Frame time on this PC, 1536 × 720: stress play 0.7 ms avg / 60 fps,
  stress maker 0.9, Castaway 0.3; at 6× CPU, 3.1, 3.2 and 1.7. These are not
  phone numbers. Issues 28, 33 and 39 are resolved. 397 tests in 34 files. The
  player has not signed the unit off.
- **2026-10-07: Unit 22 issue 33 fix.** `cellRangeX` and `cellRangeY` write into two module scratch objects, and each caller copies the values out before the next call. The arithmetic is unchanged. `physics.test.js` passed without edits. 397 tests in 34 files. The before and after allocation traces are written up with the Part E record.
- **2026-10-07: Unit 22 Part D complete.** `?perf` mounts a top-centre readout
  that rewrites about twice a second and takes no taps. Without the flag there
  is no element. Perf Stress (2000 palms, 20 entities, a full tile screen)
  imports from a file, plays, and the untouched player still had 5 hearts after
  60 s, with the wall between them and the enemies. The readout showed over
  the title, level select, play and the maker, clear of the pause button.
  397 tests in 34 files, build clean. Part E has not started.
- **2026-10-07: Unit 22 Part C complete.** After a level save succeeds, the app
  asks `navigator.storage.persist()` once per page session and shows nothing.
  Six new tests; 388 tests in 32 files. In the maker, placing the flag
  autosaved, `persist()` ran once and a second save did not ask again. Chrome
  showed no prompt. `navigator.storage.persisted()` was `false` (denied on
  localhost). No console errors. Parts D and E have not started.
- **2026-10-07: Unit 22 Part B complete.** The production build writes
  `dist/sw.js`, which precaches 104 files under `cc-b9893ba1ba4c`. A second
  build of the same tree produced the same version. 382 tests in 31 files.
  In Chrome, the manifest had no errors, the worker activated, and Cache
  Storage held that one cache. Offline, an uncached request failed and the
  cached app still showed the title, Settings slider sprites, Castaway Beach
  (music and the jump effect), a maker palm on the Pirate Ship theme, and
  test-play; `/?perf` loaded. No console errors. The offline `sw.js` recheck
  did not log an error. Installing opened a normal standalone window
  (display-mode `standalone`, not fullscreen). After a title change and
  rebuild, the next settled open had one new cache and the new title; the
  title was reverted and the version returned to `b9893ba1ba4c`. `npm run dev`
  registers no worker and no longer 404s `favicon.ico`. Parts C–E have not
  started. Issue 28 stays open until Part E.
- **2026-10-07: Unit 22 Part A complete.** Five app icons are generated from the
  Captain's idle frame, centred on `--sky`. Two `npm run assets` runs are
  byte-identical. Coverage stays 430 / 1195 and `atlas.json` is unchanged.
  376 tests and the production build pass. Parts B–E have not started.
- **2026-10-07: Issue 42 fixed as a standalone rendering correction.** Water
  reflections clip to live open cells, so they no longer shimmer on rock or
  platforms. Eleven new tests failed before the source changes and now pass;
  376 tests in 30 files and the production build pass. Chrome pixel checks and
  a real maker paint/undo check passed. The existing favicon 404 (issue 28)
  remains. Issue 43 is unchanged; Unit 22 has not started.
- **2026-10-07: Issue 40 fixed as a standalone Unit 05 rendering correction.**
  The island BG Image's painted row 86 now lands on `horizonY`; the cloud bank
  keeps its original position. Three new regression tests bring the suite to
  365 passing, and the production build passes. Chrome checks covered Castaway
  Beach, a saved no-water level in play and maker, and the unchanged ship wall.
  The browser still reports the existing favicon 404 (issue 28). Issue 41 stays
  open. Unit 22 remains unstarted.
- **2026-10-07: Unit 21 (Island Decor) is complete.** The player placed the three
  palms, played them, and signed off ("zero bugs") after asking about the pale
  background look and the visible trunks. 362 tests, build clean. Unit 22 waits
  until they ask for it. The player also explicitly approved closeout and visual
  sign-off after the independent review. **Units 00–21 are complete.** Work ends
  for today after these context updates, at the player's request.
- **Units 00–16 complete.** Unit 16 (Test-Play Round Trip) was implemented
  2026-09-23, verified in Chrome 2026-09-24 and **marked complete by the player
  2026-09-24**. Issues 16 (rotate prompt), 18 (tap to place) and 20 (nine-slice
  panels) are fixed. Tests 223 passing, build clean, everything committed (no
  remote yet).
- **2026-09-24:** issues 19, 22 and 23 fixed and signed off (tests 235).
- **Units 00–17 complete.** Unit 17 (Persistence and Sharing) was implemented
  2026-09-25, verified with a headless-Chrome harness, and **marked complete by
  the player 2026-09-25** after they shared a level and re-created it from its
  code. Tests 275, build clean, committed. Still open and worth doing:
  21 (text on the board; Unit 17 sidestepped it with paper sheets) and 24 (no
  desktop zoom).
- **Units 00–18 complete.** Unit 18 (Campaign, Level Select and Title) was
  implemented 2026-09-26 and **closed by the player the same day** after they
  finished all six levels on the keyboard. The phone run is deferred until the
  game is finished and deployed on Netlify (player decision). Tests 308, build
  clean, committed (`e271d98` issue 29, `fed94aa` Unit 18). Found while building:
  issues 30 (the player can slip into a wall), 31 (no side boundaries) and 32
  (ligatures).
- **2026-09-29:** issue 32 fixed. **Unit 19 (Polish) built** in three parts: inner
  corners, dust and shake, pause menu and Settings. Issues 2, 7 and 26 are closed.
  Tests 322, build clean. It awaits the player's sign-off.
- **2026-10-02:** doc drifts fixed. **Unit 20 spec drafted**
  (`specs/20-second-theme.md`), with three player decisions; implementation was
  subsequently requested and completed the same day.
  Issue 30 had a checked fix plan (now fixed). Issues 33 and 34 remain open.
- **2026-10-02: Unit 20 implementation authorized by the player.**
  - **Issue 30**, the prerequisite (collision boundary rounding), is fixed: 326
    tests and the build pass.
  - **Built and verified:** ship assets, rendering and the maker theme picker.
    - **A1:** packed (430 / 1195 sources; two identical builds).
    - **A2:** ship terrain, bar platforms and the wall backdrop. 336 tests pass,
      and the six campaign tile renders match their pre-change pixel hashes in
      Chrome.
    - **B:** the Menu picker, the theme command, scene synchronization and palette
      icons. 338 tests and the build pass. Browser checks cover mouse and touch,
      keyboard and toolbar undo / redo, autosave and reload, fresh-profile sharing
      and test-play history.
  - The spec records the As Built measurements and limits.
  - **Unit 19** still awaits visual sign-off; this authorization does not close
    that gate.
- **2026-10-02: Unit 20 reviewed, review fixes committed.**
  - The review independently checked the commits, the tests, the asset build and
    the running app, and found no functional error.
  - Its doc and style findings are fixed; see Completed.
  - Visual sign-off of Units 19 and 20 is still pending.
- **2026-10-03: Unit 20 complete.** The player built and played ship levels on the
  dev server and closed the unit ("everything looks good").
  - The water in the hold looks a bit off: issue 35 stays open for later.
  - Issue 37 (a solid ship block read as a room) is closed as by design.
  - **Unit 19** is still built and awaiting the player's sign-off.
- **2026-10-03: Unit 19 complete.** The player checked the dust, the screen shake,
  the pause menu and Settings. **Units 00–20 are complete.** Next is Open Question 8
  (decor before Unit 21?).

- **2026-10-07:** the player requested sequential numbering for the decor draft.
  Island Decor is now **Unit 21**; PWA and Performance is **Unit 22**.
  Implementation was requested later the same day. See the Unit 21 bullet above.

- **2026-10-07: Independent Unit 21 review.** No functional regression found.
  362 tests and the production build pass. An outside-repo Node harness checked
  144 baseline/current background and tile drawing-command comparisons across
  all six campaigns and both themes; maker/play/ghost bounds and actual layer
  calls; live painting, replacement, toolbar undo/redo, resize undo/redo, theme
  switching, sharing, ten test-play session returns, and the 2000/2001 boundary.
  Decorated and undecorated worlds produced identical player positions, stats,
  outcomes and terrain over 600 fixed steps per theme. These are scene and draw
  command checks, not browser pixel or DOM checks. Automatic approval review
  blocked the separate Chrome launch without a specific reason. The player's
  screenshot shows the three palms in play; explicit sign-off followed the review.
  Review follow-ups are issues 38 (stale actionable tracker text) and 39 (checked
  allocation profiling without a recorded trace). Issue 38 is corrected. The
  allocation checklist is now unchecked and the missing trace remains tracked
  in issue 39 for Unit 22. The player approved Unit 21 closeout after this review;
  Unit 22 has not started.

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

- **2026-09-18 — Unit 11 complete and signed off.** Spec at
  `specs/11-shooters-and-projectiles.md`. New: `game/sense.js` (pure `playerNear` /
  `playerInFront`, extracted from `WalkerEnemy`, which now delegates in one line —
  Unit 10's 27 tests pass **unedited**); `physics.js` `checkSolid(rect, level)`
  (terrain-only overlap query, joins the `check*` family); `game/hazards/shooter.js`
  (`Shooter`) and `game/hazards/projectile.js` (`Projectile`); two palette entries
  `cannon` / `seashell`; `world.js` gained `spawnEntity` on the handle and a
  pre-loop `entities.length` snapshot. Fixture adds a seashell (19,12), a cannon
  (53,12) and a 2-tile pillar at col 49. `npm test` **155** (122 prior + 10 sense +
  6 `checkSolid` + 17 shooter/projectile), `npm run build` clean, `getDiagnostics`
  clean on every touched file. Play sign-off 2026-09-18: seashell fires pearls that
  cost a heart, no console errors; the cannon's fire animation reads as a wind-up
  ("aspirate") then shot — confirmed as the wanted feel; user confirmed stomping a
  shooter does nothing (correct — see decision below).
  - **One class, one projectile — the opposite call to Unit 10.** The art gives
    both shooters one verb (idle n=1 → fire n=6 → idle, frame 3 the shot), so a
    class each would have manufactured a difference the frames do not support. The
    real difference is ammo: pearl 75 px/s (out-runnable, SPW's 150 halved),
    cannonball 150 (not). Everything else is palette config.
  - **`hasFired` guard is load-bearing.** Frame 3 spans six 60 Hz ticks; without
    the guard one trigger fires six projectiles. `shooter.test.js` steps the whole
    clip and asserts exactly one spawn — that is the regression lock.
  - **Shooter bodies do not damage and are not solid.** Non-damaging is a direct
    SPW port (`Shell` is not in `damage_sprites`); non-solid is a **recorded
    deviation** — we have no entity-vs-player resolver and adding one would push
    against invariant 4. So they are also **not stompable and indestructible in
    v1** (destructible turrets are a Beyond-v1 row). "Jumping on it does nothing"
    is the intended behaviour, not a bug: you close the distance to make it
    harmless, or pass by.
  - **Muzzle flash is drawn, not spawned** — `cannon/fire-effect` shares the
    body's `frameIndex` and flip, anchored on the muzzle. No `PickupFx` change; the
    seashell has no flash clip and omits it.
  - **Runtime spawning generalised:** `spawnEntity` + the count snapshot mean a
    projectile spawned at index *i* runs from the next frame, not one step
    downrange. Fresh arrays per enter + no module-level pool = no leak across
    restart (tested with two independent handles).
  - **Found, not fixed:** the `PickupFx` name/home no longer fit its four users
    (issue 7); the fixture's cannonball always bursts on the pillar so `ball-dead`
    is proven by test, not by the fixture (issue 8). Neither is folded into Unit 11.

- **2026-09-19 — Unit 12 complete.** Spec at `specs/12-audio.md`.
  `core/audio.js` (one `AudioContext`, lazy creation, decoded buffers,
  fire-and-forget SFX with per-sound mix levels, looping music with fade
  transitions, master sfx/music volume controls). `data/sounds.js` (declarative
  manifest for 5 SFX + 1 music track). `core/input.js` gained `onFirstGesture`
  for AudioContext unlock. `main.js` loads audio in parallel with the atlas and
  wires `input.onFirstGesture(() => audio.resume())`. `play-scene.js` starts
  music on enter (no restart on death — same-track guard). `world.js` gained a
  `playSfx` callback on the world handle. Six gameplay triggers wired: jump
  (`player.js` `doJump`/`doWallJump`), coin pickup (`collectibles.js`), damage
  from spikes/walkers/projectiles (each conditionally via `stats.hurt()` return),
  shooter fire (`shooter.js`), enemy stomp (`walker-enemy.js`). `npm test` 155
  passing (no new test file; stub handles gained `playSfx() {}`). `npm run build`
  clean.
  - **`hit.wav` assigned to enemy stomp — new, not an SPW port.** SPW packed it
    but never used it; its stomp-less combat had no need. It fits our stomp event.
  - **`attack.wav` stays unused in v1.** Sword combat is out of scope.
  - **Music does not restart on death.** `playMusic('music')` is called on every
    `enter`; its same-track guard makes re-enter a no-op. `stopMusic` is reserved
    for true scene changes (e.g. transitioning to level select / maker).
  - **Volume persistence deferred to Unit 17.** Getters/setters are exposed with
    sensible defaults (`sfxVolume` 0.7, `musicVolume` 0.4).
  - **Per-sound authored volumes from the manifest.** SPW mixed coin at 0.4 and
    damage at 0.5; our manifest carries the same idea.

- **2026-09-20 — Unit 13 complete and signed off.** Spec at
  `specs/13-maker-core.md`. Player sign-off 2026-09-20: "it all works perfectly"
  (paint, erase, autotile, undo/redo, entity replace, pan, `M` round trip).
  `maker/maker-scene.js`, `commands.js`, `tools.js`, `grid-overlay.js`,
  `ui/maker-palette.js` + CSS. `createEmptyModel` with nullable `goal`;
  `camera.panBy` + x/y setters; input `pointer.button`, Ctrl+Z / Ctrl+Shift+Z /
  Ctrl+Y, `M` mode-switch, canvas `contextmenu` suppress. Palette `defaultProps`
  on the five facing entities and `PALETTE_ORDER`. Throwaway `main.js` bridge
  starts in maker; `M` toggles play if a goal is placed. `npm test` **178**
  (155 prior + 3 empty-model + 1 serialise-null-goal + 19 command/tool).
  `npm run build` clean.
  - **`CommandStack.push` records an already-applied drag.** Spec `execute`
    would re-paint. Drags mutate the model cell-by-cell for live autotile, then
    `push` on pointer-up without re-executing. Redo still goes through `execute`.
  - **`codec.serialise` throws `LevelError('goal', …)` when `goal` is null.**
    Named in the spec's model section; codec was also on the not-built list.
    A TypeError on `goal.c` would have thrown, but a field-named error matches
    every other codec failure. Existing round-trip tests unchanged.
  - **Dev-bridge play stubs HUD and touch, keeps real audio.** play-scene.js
    was not to be modified and requires `audio` / `ui` / `onDeath`. Stubs
    satisfy the "bare world render"; passing the live audio object means
    jump/coin/damage still play, which is useful for verifying a painted
    level. Completion does **not** `console.log` — that would need a play-scene
    callback. Death restarts in place; `M` returns to the maker with the saved
    camera. The bridge reads `makerScene.getLevel()` before switching so it
    always plays the live model.
  - **Tile palette icons crop the blob "single" cell (4, 4).** `tiles/island`
    is a 544×160 sheet, so "frame 0 scaled ×2" would be unusable on a 44px
    button; the fill cell (1, 1) reads as a black square at icon size. Water
    crops the first 32×32 of `water/top`.
  - **Decor group is hidden** (zero entries). 19 placeable items + eraser.

- **2026-09-20 — Unit 14 complete and signed off.** Spec at
  `specs/14-maker-gestures.md`. Player sign-off 2026-09-20: desktop mouse
  plus real-phone gestures (paint/pan toggle, long-press, two-finger pan,
  pinch zoom, `M` play once a goal is placed).
  `maker/gestures.js` (touch state machine), `ui/maker-toggle.js` (paint/pan,
  hidden until first touch). `input.js` `touches` (max 2, snapshotted in
  `advance()`). `screenToCell` takes zoom; `pickToolAt` for the eyedropper;
  palette `selectById`; maker zoom 0.5/1/2 via `ctx.scale`;
  `-webkit-touch-callout: none`. `npm test` **191** (178 prior + 6 pick/zoom
  + 7 gesture). `npm run build` clean.
  - **Eyedrop consumes the finger until lift.** Spec goes `eyedrop` → `idle`
    with the finger still down. Without a consume flag, the next frame would
    re-enter `longPress` and fire again 300 ms later.
  - **`grid-overlay.js` was not edited.** The files table listed it; the body
    says the scene just passes `pixelScale * zoom`. Followed the body.
  - **`main.js` injects `createToggle`.** Not in the files table, required by
    the injection paragraph (maker must not import `ui/`).
  - **Zoom persists on the scene across `M`.** Resetting it on enter would
    disagree with the restored camera after play.

- **2026-09-21 — Unit 15 complete.** Spec at `specs/15-maker-responsive-ui.md`.
  Nine-slice composites fixed (Issue #1 resolved): `writeNineSlice` now extracts
  the 3×3 subset from the 16-tile kit guide, producing 96×96 boards and 42×42
  buttons. `dialog.css` upgraded `.panel` and `.btn` to `border-image` nine-slice.
  `ui/maker-toolbar.js` + CSS: top bar with Back, Undo, Redo, Play (`.btn--primary`,
  disabled without goal), Menu (dropdown with "Resize Level"). `ui/maker-palette.js`
  redesigned: tab row (scrollable) + tool strip (scrollable), tab switching shows
  only that group's tools plus eraser; `selectById` switches tab for the eyedropper.
  `ui/components/resize-dialog.js`: centred nine-slice panel over scrim, number
  inputs with schema-limit validation, shrink warning, Apply/Cancel, Escape/backdrop
  close, focus trap. `ResizeCommand` in `commands.js`: snapshots all layers +
  entities + decor + markers before `model.resize()`, undo restores everything,
  `onResize` callback rebuilds parallax and re-clamps camera. `index.html` gained
  `viewport-fit=cover`. Safe-area insets on toolbar, palette, and toggle.
  `npm test` **195** (191 prior + 4 ResizeCommand). `npm run build` clean.
  - **Nine-slice fix is a 3×3, not a 4×4 rearrangement.** Simpler composite,
    `border-image-slice` at the tile size (32 or 14) works directly on the 3×tile
    image. No CSS changes needed from what `3-ui-context.md` already specified.
  - **Toolbar callbacks run from click handlers, not deferred to update.**
    Undo/redo from buttons mutates the model between frames. Functionally identical
    to keyboard undo running in update — the model is consistent, render sees the
    new state next frame. Callbacks guard against `dragState`.
  - **Palette tool buttons stay flat; only the bar and toolbar use nine-slice.**
    The button nine-slice 7px border eats too much of the 44px icon button.

- **2026-09-22 — Repo review and issue sweep (issues 10–17).** A full read of the
  context and every source file, then one commit per finding. `npm test` **201**
  (195 + 4 `isFormField` + 2 `newLevelId`), `npm run build` clean.
  - **Git.** The repo had no commits at all — Units 00–15 lived only in the working
    tree. Baseline commit `965dcf8` holds them exactly as built; each fix below is its
    own commit on `master`. No remote exists yet.
  - **Fixed:** 10 toolbar sync skipped while the pointer was off the level (Play
    showed enabled with no goal); 11 game keys swallowed inside form fields, and the
    resize dialog stranded by `M`; 12 music re-encoded 192 → 96 kbps via
    `ffmpeg-static`, `attack.wav` dropped (assets 2.74 → 1.49 MB); 13 moving
    platforms deferred and the inert `Player.platform` stub deleted (player
    decision); 14 nine-slice atlas sizes and three docs still on the pre-Unit-15
    4 × 4 layout; 15 dead `findGroupForEntry`, two level-id generators → one.
  - **Opened, needs a decision:** 16 portrait stretches the canvas 3.08× — a
    conflict inside the Rendering Model, reported not fixed; 17 palette category
    tabs are 28 px tall, under the 44 px hit-area rule.
  - **Unit 12 verification (Claude in Chrome, desktop).** Web Audio calls hooked
    and counted during a scripted play-through: music starts once on enter (the
    re-encoded 106.4 s track, looping); one jump sound per jump; one coin chime per
    pickup; one damage sound on spikes with invulnerability silencing repeats; one
    seashell fire sound per cycle (not six). No console errors or warnings. **Still
    needs the player:** first-tap unlock on real iOS and Android (Chrome here had
    the context running before any gesture, so the suspended path was not
    exercised), stomp sound, seamless music loop and the 96 kbps quality by ear.
    "Volumes persist across a reload" moved from Unit 12's done-when to Unit 17's.
  - **Unit 15 verification (Claude in Chrome, desktop + 390 × 844 and 844 × 390
    iframes).** Toolbar states track the stack and goal; every toolbar button and
    palette tool is ≥ 44 × 44; tabs scroll at portrait width; 7 tabs, decor hidden,
    eraser last in every tab; resize dialog opens with the current size, rejects
    30 and 401 columns, warns only on shrink, traps Tab, closes on Escape, backdrop
    and Cancel, grows, undoes, redoes, and a same-size Apply pushes nothing. Found
    issues 16 and 17. **Still needs the player:** touch-emulated and real-phone
    gestures and the paint/pan toggle, notch safe areas, hover/active visuals. The
    nine-slice pause/results overlays cannot be seen yet — the dev bridge stubs the
    HUD in play; Unit 16 wires the real one.

- **2026-09-23 — Portrait decision, issues 16 and 18, Unit 16 implemented.**
  Spec at `specs/16-test-play-round-trip.md` (written and approved the same day).
  `npm test` **223** (201 + 2 tap + 12 `validate` + 1 `revision` + 7 transition),
  `npm run build` clean. Type check: no diagnostics new to this change (checked
  with VS Code's bundled TypeScript against a clean HEAD worktree — the project-wide
  baseline still has ~220 older ones, mostly CSS side-effect imports and test
  fakes).
  - **Issue 16 — rotate prompt.** Portrait decided as "ask the player to rotate"
    (player). `ui/rotate-prompt.js` on `#app`, held game while shown. See the
    issue for detail.
  - **Issue 18 — tap to place.** A finger that lifts before the move threshold
    and the long-press places once at its touch-down point. See the issue.
  - **Unit 16.** `maker/validate.js` (`findProblems`, seven rules, kind-in-registry
    check), `CommandStack.revision`, `core/transition.js` (Pirate Maker's circle
    wipe on fixed durations, reduced-motion fade through ink), the
    `MakerSession` round trip, test-play through `serialise` → `deserialise`, the
    real HUD and touch controls in test-play, Back to editor on the pause and
    results panels, `M` in both scenes, the toolbar status slot, `#ui` veiled
    during a wipe. `main.js` is now a two-mode App: stub HUD, stub touch,
    `switchToPlay`'s `console.warn`, the camera stash and `getLevel()` are gone.
  - **Found and fixed during implementation.** (1) Validation ran at the top of
    `update`, before a finished drag was pushed, so the status showed one frame
    stale after every drag, and a Play click or `M` after a between-frames
    toolbar Undo could act on a stale answer. Now one `refreshProblems()` runs in
    `enter`, at the end of `update`, and inside `requestPlay`. Caught by a scratch
    harness that drives the real maker scene. (2) The play scene framed its
    camera only in `update`, and a wipe draws the new scene before stepping it,
    so the opening iris would have shown the maker's camera position and then
    jumped. `enter` now frames the player. Both are recorded in the spec.
  - **Harness (scratch, not committed).** Drove the real `createMakerScene` with
    fake input and UI: status correct before the first update; `M` blocked on an
    invalid level; problems in table order; the play data equals `serialise`
    and deserialises to a separate, identical model; after the round trip the
    camera (clamped for a resized viewport), tab, eraser, toggle mode,
    byte-identical level, undo **and** redo tail all come back; ten round trips
    with no drift; a touch tap places one coin and is one undo step.
  - **Needs the player (browser):** the wipe itself (look, timing at 512 and 768
    wide, frozen scenes, DOM fade, no double start), reduced-motion fade, real
    HUD and touch controls in test-play, Back to editor on both panels, `M` in
    play, music fading out on return, the toolbar status at phone and desktop
    width, the rotate prompt, and tap-to-place on a touchscreen.
  - **Logged, not fixed:** issue 19 — Enter/Space on a focused overlay button run
    the primary action (`input.js` preventDefaults them), so keyboard users cannot
    reach Back to editor by Tab + Enter. `M` works.

- **2026-09-24 — Issue 20: nine-slice composites built from the wrong tiles.**
  The player reported that the maker UI "looks bad". Every Wood-and-Paper panel
  and button drew scrambled wood because `writeNineSlice` assumed the 16 kit files
  follow the guide picture's 4 × 4 layout. A labelled contact sheet of all five
  kits showed the real layout: the frame is files 1–9 in boards and paper and
  8–16 in buttons. The manifest now declares each kit's first frame tile, and
  `npm run assets` changed only those five PNGs (`atlas.json` and `coverage.json`
  are byte-identical, and a second run is byte-identical). `npm test` 223,
  `npm run build` clean. Seen in Chrome at desktop size: toolbar, palette bar,
  buttons, Menu and the resize dialog are all clean, with no console errors. The
  Unit 15 note "Nine-slice composites fixed (Issue #1 resolved)" only became true
  with this change. Docs corrected: `3-ui-context.md` and `2-architecture.md`.
  - **Found, not fixed:** issue 21 — muted and display text on the board fill is
    hard to read in the resize dialog. It needs a token or component decision
    first.

- **2026-09-24 — Unit 16 browser verification (Claude in Chrome).** Committed first:
  `8a21531` (issue 20) and `92ea8e9` (Unit 16 + issues 16 and 18). Then the spec
  checklist ran against the dev server, desktop 1707 × 842 CSS px (view 730 wide)
  plus iframes at 600 × 422 (view 512), 1000 × 360 (view 768), 844 × 390 and
  390 × 844. State was read through a temporary `window.__cc` hook in `main.js`
  (mode, session, transition), removed afterwards. `main.js` is byte-identical to
  the commit.
  - **Validation, all pass:** fresh level blocked with "Place the finish flag to
    play."; the flag clears it; terrain on spawn, water on spawn, terrain on flag
    and flag on spawn each show their own message; with two problems, table order
    wins; Undo clears; `M` on an invalid level does nothing; the longest message
    fits one line at 844 wide, with its full text in `title`.
  - **Round trip, lossless ×10:** before, a coin tool on the Treasure tab, the
    camera panned, and an undone edit (index 4 of 5). The session's level JSON,
    stack index and length, camera, zoom, tab and tool were identical on every
    return. Entry by the Play button and by `M`; exit by results → Back to editor,
    pause → Back to editor, `M` paused and `M` running. The eraser on a non-first
    tab comes back. Undo and redo still walk the pre-play history.
  - **Test-play:** real HUD and touch controls; a coin collected in play is still
    in the maker; Enter pauses and resumes; Enter on results replays with coins
    reset; death in a pit restarts at the spawn with full hearts.
  - **Transition:** 0.9 s in both directions at view widths 512, 730 and 768.
    `#ui` is veiled and `inert` mid-wipe. A double Play click and six mashed `M`s
    each start exactly one wipe. A jump pressed mid-wipe is not replayed. The iris
    was seen closing on the frozen play scene. Reduced motion (via a `matchMedia`
    override in an iframe) is a ~115 ms fade each way.
  - **Touch (synthesized `pointerType: 'touch'`, 844 × 390):** the toggle appears on
    first touch; a pinch snaps to 2×; a tap places the flag (issue 18); zoom 2×,
    pan mode, tab and tool survive the round trip.
  - **Not verified here, needs the player:** music starting in play and fading on
    return (audio by ear), the CSS side of reduced motion (DevTools emulation),
    real-phone gestures and rotation, and the temporary `findProblems` call
    counter (covered by `revision` tests only).
  - **Found, logged, not fixed:** issue 22 (a press and release inside one frame are
    lost, reproduced with browser-level clicks), issue 23 (a fast drag skips cells),
    issue 24 (desktop has no zoom).

- **2026-09-24 — Unit 16 complete.** Player sign-off after the Chrome run above
  ("mark complete"). The sign-off covers the items that were listed as needing the
  player (music by ear, reduced-motion CSS, real-phone gestures, tap to place and
  rotation), so issues 16 and 18 close with it.

- **2026-09-24 — Issues 19, 22 and 23 fixed, one commit each.** Player sign-off in
  the game the same day ("all 3 are fixed"). All three are now in Resolved.
  Player asked for all three. `npm test` **235** (226 after 19, 230 after 22),
  `npm run build` clean. The Chrome extension disconnected before any of them could
  be seen in the game, so each issue entry lists its browser check.
  - **19** (`2fba4f3`): `isButtonActivation`. Enter and Space on a focused `<button>`
    are left to the button. Resume and Play again still work on Enter.
  - **22** (`8a22a58`): `stepButton` latches a press released within one frame, for
    keys, virtual buttons and mouse/pen (not touch, which `gestures.js` owns).
  - **23**: `forEachCellOnLine` fills the grid path between drag frames. It is
    still one command per drag.

- **2026-09-25 — Unit 17 complete.** Player sign-off the same day ("it does
  work"): they copied a share code, closed and reopened the browser, and
  re-created the level from it. Spec at
  `specs/17-persistence-and-sharing.md`, approved the same day with two player
  decisions: a level is saved **once it would load** (a flag, and passes the
  schema; a new level lives in memory until its flag is placed), and the **Sound
  dialog lives on My Levels only**. `npm test` **275** (235 + 8 safe-storage + 16
  levels + 4 settings + 9 import + 3 files, and the `validate` `k` assertion), `npm run build`
  clean, and no type diagnostics new against HEAD (checked with TypeScript 5.9 over
  `jsconfig.json`; the ~210 older ones are unchanged).
  - **New:** `storage/safe-storage.js`, `storage/levels.js`,
    `storage/settings-store.js`, `maker/import-level.js`, `ui/screens/level-list.js`,
    `ui/components/{dialog,rename-dialog,share-dialog,import-dialog,sound-dialog,toast}.js`,
    `ui/files.js`, and CSS for the list, toast and sound rows. **Changed:**
    `main.js` (three modes, storage wiring, boot on My Levels, save reporting, flush
    on hide), `maker-scene.js` (autosave, `flush`, `saveBlocker`, `resumePoint`,
    `resume`, Share), `maker-toolbar.js` (Menu → Share), `validate.js` (the
    "…to play and save." hint, and `k` on `unknown-kind`), `gestures.js` (exports
    `ZOOM_LEVELS`), `dom.js` (`onPageHidden`, `hasFinePointer`), `dialog.css`
    (sheet and `.field`), and `settings.js` (`AUTOSAVE_*`).
  - **Verification:** the Chrome extension was not connected, so a scratch
    harness (puppeteer-core in the session scratchpad, not a project dependency)
    drove the real app in headless Chrome. It covered:
    - the first-run empty state and the leave-confirm
    - no save without a flag, then autosave once the flag is placed
    - no write mid-drag, and the 5 s cap
    - the hidden-page immediate `u` save and the resume point (tool and tab restored)
    - open-and-Back not reordering the list
    - saving before test-play, and the round trip plus undo
    - rename (typed keys stay in the field), duplicate, and delete with confirm
    - share and clipboard copy, and Sound persisting across a reload
    - import errors (malformed, unknown kind) and the corrupt-index rebuild
    - import into a second profile, identical apart from the id, and twice giving
      two levels
    - blocked storage (memory mode and its notice)
    - an injected quota (one dialog per episode, with recovery)
    - layout at 590, 844, 1200 and 1280 px

    60 of 61 checks passed; the failure was the harness's own date regex ("Sept").
    Screenshots checked at phone landscape and desktop. **Needs the player:** a real
    phone (the keyboard over the dialogs, the hide flush when the app is switched
    away, the clipboard on a LAN http origin), the wipe between My Levels and the
    maker, and sound by ear.
  - **Decisions made while building** (all in the spec's As Built section):
    - `SaveResult` gained `'invalid'`, and the store gained `has(id)`.
    - `duplicate(id, name)` takes the copy's name from the UI.
    - The resume point is written only for a saved or saving level.
    - Every dialog and the My Levels header and cards put their text on paper,
      and there are no ghost buttons. Issue 21 measured: the board fill is `--wood`,
      where ink reaches 3.4:1.
    - The grid is auto-fill at 240 × ui-scale, so a 1280 × 720 window (UI scale 2)
      shows 2 columns.
  - **Found, logged, not fixed:** 25 (`main.js` touches `document`), 26 (kit slider
    sprites), 27 (resize dialog not on the shared helper), 28 (`favicon.ico` 404).
    Watchlist 13: iOS Safari evicts storage after 7 idle days.

- **2026-09-26 — Unit 18 complete.** Closed by the player the same day. Spec at
  `specs/18-campaign-level-select-and-title.md` (approved the same day). Player
  decisions: two tabs (Campaign · My Levels) on one screen, which is the Unit 17
  screen plus Play; any death in the campaign or My Levels play returns to level
  select (test-play still restarts); campaign cards Play, Share and Edit a copy;
  Claude drafts the levels, the player tunes them; **our own levels, not ports of
  Super Pirate World's maps**. The proposed rows were approved as written: six
  levels, no locking, Next level on the results panel, the paper wordmark title.
  - **Step 0, issue 29 (treasure total), done as its own change:** `Stats.collect`
    and `Stats.treasure`. The results panel shows the total. Closed in play.
  - **Built:** `storage/progress.js`, `ui/format.js` (moved from `hud.js`),
    `ui/screens/{title,level-select,campaign-tab}.js`, `my-levels-tab.js`
    (renamed from `level-list.js`), `level-select.css` (renamed), `title.css`,
    `data/campaign.js` and six levels, `campaign.test.js`. `main.js` has four
    modes and play sources. `play-scene.js` has `onQuit`, `onNext` and
    `onComplete`. `hud.js` has Level select and Next level.
  - **Checked so far:** `npm test` 308 (275 + 2 stats + 8 progress + 4 format + 19
    campaign), `npm run build` clean, and TypeScript 5.9 over `jsconfig.json`
    reports no diagnostic new against HEAD. A scratch bot finished all six levels
    in the real simulation (see the spec's As Built). The Title rendered in Chrome.
  - **Browser harness** (scratch puppeteer-core, own profile): 84 of 84 checks.
    It found and fixed one thing: the selected tab's accent bar was hidden under
    the nine-slice fill, so it is now an `::after` bar. See the spec's
    Verification section.
  - **The player finished all six levels on the keyboard** in Chrome
    ("breathtaking stuff"). Their saved progress records all six, with best
    treasure 90–154. Issue 29 closed on it.
  - **Found:** issue 32 (the font's `fi` / `fl` ligatures read as "A"), logged.
  - **Committed 2026-09-26** as two commits: issue 29, then Unit 18.
  - **Closed without a phone run** (player decision): the player will play on a
    phone once the game is finished and deployed on Netlify. Next level's music
    by ear and any tuning of the levels go with it.

- **2026-09-29 — Unit 18 close-out committed** (`86ae3d1`).

- **2026-09-29 — Issue 32 fixed: ligatures off on every element.** The font has
  five ligatures, not two (fi, fl, ff, ffi, ffl, read from its `GSUB` with a
  scratch parser). The issue's proposed `html, body` rule was tested first in the
  real app and **left every button and text field ligated**: form controls get
  their font from the browser's `font` shorthand, which resets
  `font-variant-ligatures`. So the rule sits in the `*, *::before, *::after` block
  of `base.css`, and `3-ui-context.md` Typography says why (and forbids the `font`
  shorthand in component CSS). Verified with a scratch DevTools-protocol driver
  (Node's built-in WebSocket, a throwaway headless Chrome profile, no installs):
  10 of 10 checks across the Campaign cards, maker status, Import, options and
  rename dialogs, with no element anywhere still ligated. `npm test` 308, build
  clean.

- **2026-09-29 — Unit 19 spec drafted and approved** (`specs/19-polish.md`).
  Measured from the packed art first:
  - **Inner corners.** The blob sheet's 31 unused tiles were matched to the 31
    inner-corner cases by a scratch pixel diff against the 16 base tiles: every
    case found once, none illegal, corner notches 59–97 px against 0–35 px of edge
    texture. A before/after render from the real sheet confirmed the table.
  - **Issue 2** turns out to be by design: a hole's floor keeps its grass. The
    real gap was the hole's corners.
  - **Dust** clips are already packed and symmetric (centre x 26, bottom row 19,
    no flip).
  - **Issue 26 was wrong:** the kit Sliders sprites are already packed, so it is
    CSS only (issue and `3-ui-context.md` corrected).

  The player chose one unit in three parts, done in a row, and Settings as a
  dialog. Asking for the unit approved the other rows, including leaving
  unscheduled the older deferrals that named Unit 19 (death animation, knockback,
  hit state, ceiling spikes).

- **2026-09-29 — Unit 19 Part A: inner corners.**
  - **What changed.** `autotile.js` gains `INNER_TABLE` (the 31 measured tiles), a
    256-entry lookup built at load, and `blobCell`. `autotileAt` reads eight
    neighbours. `render.js` is unchanged.
  - **Tests** 314 (+6: all 47 cases, all 256 combinations, irrelevant corners,
    the 1-tile hole, table sanity, one grid-edge inner corner). The old helper now
    fills every diagonal, so "a full mass gives today's 16 tiles" is locked.
  - **Campaign.** 2–9 cells per level now draw an inner corner, mostly where the
    end walls meet the ground. The files are unchanged and `campaign.test.js` is
    green.
  - **Cost.** About 0.005 ms per screen of tiles.
  - **Seen in the real maker** (scratch DevTools driver): a level of test shapes
    imported through the Import dialog draws continuous outlines. Painting the
    1-tile hole shut returns plain fill, and undo restores the notches. The only
    console line is issue 28.
  - Issue 2 closed as by design.

- **2026-09-29 — Unit 19 Part B: dust and shake.**
  - **Step 0 (issue 7)** is its own commit: `PickupFx` became `OneShotFx` in
    `game/fx.js`.
  - **Dust.** `Player` gets `dustJump`/`dustLand` clips and a `spawnFx` callback
    from the world, like `playSfx`. Jump dust comes only from the ground (a
    buffered landing jump counts, a coyote or wall jump does not). Landing dust
    comes from a fall of at least `landDustSpeed` 150 px/s, measured before the
    landing zeroes `vy`.
  - **Shake.** `game/shake.js` `shakeOffset` is pure, a fixed 8-step pattern
    fading to zero, whole pixels. `play-scene.js` compares `stats.health` before
    and after `world.update`. `tuning.js` gains `shakeAmplitude` 3, `shakeTime`
    0.25 and `landDustSpeed`. Reduced motion is a plain flag in `main.js`, kept
    current by `ui/dom.js` `watchReducedMotion` and passed as a
    `reducedMotion()` getter.
  - **Tests** 320 (+6 shake).
  - **Scratch harness over the real world, player, physics, play scene and
    camera, 14 of 14 checks:**
    - one jump dust and one landing dust per hop, standing on the floor and
      centred on the player
    - no dust on the tiny spawn settle, or on a coyote jump
    - landing dust after walking off a 3-tile ledge
    - standing on spikes: a ≤ 3 px shake for each heart lost, 42 frames
      (0.7 s) apart
    - none at all under reduced motion
  - **Seen in the game:** jump and landing dust in a timed screenshot sequence.

- **2026-09-29 — Unit 19 Part C: pause menu and Settings.**
  - **Settings dialog.** `settings-dialog.js` replaces `sound-dialog.js`. It has
    Music, Effects (kit sliders, issue 26 closed) and Touch: Auto · On · Off. It
    opens from the Title (new third button), level select (Sound became
    Settings) and the pause menu.
  - **Controls setting.** `cc:v1:settings.controls` is new, and older saves read
    as Auto. The play scene reconciles touch-control visibility in `render`
    through `controls()`.
  - **Pause menu.** Resume, Restart, Settings and the way out. Pause and results
    text sits on paper, which closes issue 21 for those panels. Escape closes only
    the top panel. The HUD closes its Settings dialog in `destroy`.
  - **Tests** 322 (+2 settings-store).
  - **Seen in the real app:** 34 of 34 checks. It found one real problem before
    it passed: at 1280 × 720 (UI scale 2) the four-row dialog scrolled Done out of
    view. It is now three rows, and the layout check tests the content, not just
    the panel.
  - **Harness note:** the headless Chrome played the game's sounds through the
    player's speakers (a scripted key press counts as the gesture that unlocks
    audio). The driver now passes `--mute-audio`.
  - Details are in the spec's As Built section.

- **2026-10-02 — Doc drift fixes.** Docs only.
  - Issue 1 had been left under Open Issues after it was fixed. It is now under
    Resolved.
  - `4-code-standards.md`:
    - Testing lists the 47-tile autotile coverage, not "all 16 masks".
    - Engine Contracts no longer lists `carries`, which went with the
      moving-platform stub on 2026-09-22.
  - Session Notes: the Do-not list allows the ship tilesheets for Unit 20, the
    volume-persistence line points at the settings store, and the repeated "Before
    that" paragraph is merged.

- **2026-10-02 — Unit 20 spec drafted** (`specs/20-second-theme.md`). Measured from
  the pack first (scratch scripts, not committed):
  - **Ship terrain sheet.** It holds two copies of the island's blob layout:
    terrain at (1,1) and back wall at (1,7). `INNER_TABLE` holds for both. The pixel
    diff is clean on the back wall. On the terrain it cannot decide, because the
    planked inner corners differ from the dark fill, so Unit 19's shape set was
    rendered through the real `autotileAt`, and it draws continuous outlines.
  - **Ship platforms.** They are a separate plank sheet, not a blob: left cap,
    middle, right cap and single in a row, two styles. The thin plank's top outline
    sits 1 px below the cell top.
  - **Decor is unbuilt.** The format and the maker carry it, but play never draws it
    and the palette has no entries. The island palms are packed and unused. The
    ship's props are a Beyond-v1 row, which conflicted with the build plan's
    "matching decor".

  **Player decisions:**
  - The back wall is a below-decks backdrop that replaces the sky, not a paintable
    layer, so the format stays at 1.
  - Ship platforms use the plank art, with a left / middle / right / single rule.
  - Decor is its own later unit (Open Question 8).

  The build plan's Unit 20 line is amended to match. The other 11 decisions in the
  spec are Proposed. The spec is written for a different model to implement.

- **2026-10-02 — Issue 30 fix plan, checked.**
  - A scratch harness over the real `resolveH` reproduces the slip: 33 of 320 walks
    into walls end inside them.
  - The fix makes the far edge of `cellRangeX` / `cellRangeY` exact
    (`Math.ceil(...) - 1`). With it, none of the walks end inside, and all 322 tests
    pass. The trial was reverted. The plan and its four regression tests are in the
    issue.
  - Found while planning and logged, not fixed:
    - **33:** the cell ranges allocate an array per call.
    - **34:** nothing reads `z`, so draw order is code order, against the
      architecture's "by `z`".

- **2026-10-02 — Unit 20 built (by GPT-6.1-Sol, from the spec).** Five commits:
  - `6c84a7e` issue 30
  - `606aee2` A1
  - `9c65b4e` A2
  - `e483fc8` B
  - `119fe33` docs

  Details are in the spec's As Built. Two of the drafting edits had been left
  uncommitted: the amended Unit 20 line in `specs/00-build-plan.md`, and two
  `4-code-standards.md` drift fixes.

- **2026-10-02 — Unit 20 reviewed (Claude), no functional error found.** Checked
  independently, not from the report:
  - **Issue 30:** with the pre-fix `physics.js` restored, its three new regression
    tests fail and the touching-case guard passes.
  - **A1:** a fresh `npm run assets` changes nothing, and the packed sheets are
    byte-identical to the pack.
  - **Tests and build:** 338 tests, build clean.
  - **The diffs:**
    - The island takes its old drawing path.
    - Theme switches go only through the stack.
    - `syncTheme` runs in `update` and on pick, never in `render`.
  - **Muted headless Chrome**, on an imported ship level with planks, holes,
    steps and water near the spawn:
    - the Menu choices, and undo / redo by Ctrl+Z and Ctrl+Shift+Z
    - re-picking the current theme pushes nothing and keeps the redo tail
    - the island renders after switching back
    - the ship in test-play
    - a pixel measurement shows the boot's bottom outline directly on the plank's
      top outline, so the `-1` offset is right
    - only issue 28 in the console

  **Fixed in the review commit:**
  - **Committed** the two leftover drafting edits.
  - **`2-architecture.md`:** a garbled Autotiling sentence.
  - **`3-ui-context.md`:** the Icons rule had contradicted the new theme icons;
    it now names Terrain and Platform as the one exception.
  - **This file:** Current Phase back in date order, and the test count.
  - **`autotile.test.js`:** one import, with the bar tests after the blob tests.
  - **Doc comments:** for the bar rule, the `autotile.js` header and
    `drawBackground`.
  - **Formatting:** `themes.test.js` and the `ToolbarState` typedef are back
    under 100 columns.

  **Logged, not fixed:** issues 35 (water in the hold reads as a flat block) and
  36 (the HUD level name is faint on the ship wall), both for the player's
  judgment.

  **Raised for the player, not changed:** Next Up goes to the Unit 21 spec, but
  Open Question 8 asks whether the decor unit comes before Unit 21.

- **2026-10-03 — Unit 20 complete.** The player tested on the dev server.
  - **What they did:** built island and ship levels, switched themes, and played a
    ship level: deck, flag, water.
  - **The sign-off:** "everything looks good", then "update the context files so
    we can close this unit".
  - **The terrain mix-up.** The player painted a solid rectangle of ship terrain
    as a "room", so the spawn inside it read "buried in terrain". Once the dark core
    was explained as the ship's version of the island's rock under the grass, it
    made sense. They rebuilt the level with the deck as terrain and the backdrop as
    open space. Issue 37 is closed as by design.
  - **Water.** It "looks a bit off inside of the ship, but maybe we can fix that
    later": issue 35 stays open.
  - **Covered by their sign-off:** the ship art at 2×, which was the spec's
    remaining "Ship in play" check.
  - **Still open:** the phone run, which waits for the Netlify deploy, as for
    every unit. Issue 36 (the faint level name) was not raised and stays open.

- **2026-10-03 — Unit 19 complete.** The player checked the dust, the screen
  shake, the pause menu and Settings on the dev server, and signed the unit off.
  - **Not seen, and not blocking:** the kit sliders in Firefox and Safari, reduced
    motion through the real OS setting, and the phone run (which waits for the
    Netlify deploy).

- **2026-10-07 — Unit 21 planning history:** the next-slice plan was drafted
  at the player's request:
  `specs/21-island-decor.md` recommends three complete island palm animations
  before PWA, with issue 34's draw-order fix, shared maker/play anchoring, the
  decor cap and issue 17's tab hit areas in separately verified increments.
  The player then requested sequential numbering: Island Decor became Unit 21
  (`specs/21-island-decor.md`) and PWA and Performance became Unit 22.
  Implementation and sign-off followed that day.

- **2026-10-07 — Unit 21 complete.** The player placed the three palms, played
  them and signed off ("zero bugs"), then explicitly approved the independent
  review's closeout and visual sign-off: "i approve the closeout the visual
  sign off too". The three-tree roster, anchoring, depth and taller category
  tabs are accepted. Units 00–21 are complete.
  - Last code verification: 362 tests in 29 files and the production build pass;
    the independent review found no functional regression.
  - Issue 38 is closed. Issue 39 remains open for allocation profiling in
    Unit 22; the spec's trace checkbox is unchecked, with measured costs and
    verification limits preserved. No trace or phone performance result is claimed.
  - Real-phone verification still waits for the Netlify deployment.
  - Work ends for today after these context updates, at the player's request.
    Unit 22 has not started and waits until the player asks.

- **2026-10-07 — Issue 40 fixed.** Added `bgImageHorizonRow: 86` to the island
  theme and anchored that sprite row at the derived horizon. The new position
  tests first failed against the old renderer, then passed after the one-line
  change; all 365 tests and the build pass. In Chrome, the saved no-water level
  showed no sea strip behind the cloud bank in play, and the maker view showed
  sea below the level bottom. Castaway Beach loaded, and the ship wall branch
  remained unchanged. Screenshot checks used a temporary harness outside the
  repo. The known `/favicon.ico` 404 (issue 28) was the only console error.
  Issue 41's hidden horizon bands are unchanged.

- **2026-10-07 — Issue 42 fixed.** Added the engine's unflipped `drawSpan` and
  clipped reflection sprites per cell against the live terrain/platform layers.
  Adjacent open cells merge into a span; the source spans use the tiles' rounded
  screen edges. Positions, parallax, animation and layer order are unchanged.
  - All eleven new tests were observed failing before changing the source;
    376 tests in 30 files and the production build then passed.
  - Chrome: Castaway Beach launched through Play with no shimmer on the first
    rock block. Fixed-camera renders of Castaway and Crabby Shallows compared
    all four reflection frames with a reflection-free rendering: zero changed
    terrain/platform pixels, while the open pools retained shimmer. Fractional
    cameras showed matching clip/tile edges; Crabby's big slot kept four source
    columns over its pool, and its medium slot kept all 53.
  - In the actual maker at 844 × 390, an editable Castaway copy showed the small
    reflection in the pool at x1333. A pointer drag painted terrain over both
    pool cells: reflection draws disappeared immediately. One Undo restored
    them. Switching to Ship produced no reflection draws. Screenshots and pixel
    evidence are in a temporary harness directory outside the repo.
  - The known `/favicon.ico` 404 (issue 28) was the only console error. Issue 43
    was not changed, and Unit 22 remains unstarted.

- **2026-10-07 — Unit 22 Part E.** Issue 33 reuses scratch cell ranges
  (`f37f43f`). Desktop allocation samples, the 20-rebuild timing, and `?perf`
  frame times are in the spec's As Built. Issues 28, 33 and 39 are resolved.
  Issues 44 and 45 are the findings that were logged and not fixed. 397 tests.
  No phone numbers. The player has not signed the unit off.

- **2026-10-07 — Unit 22 Part A.** Five icons in `public/assets/icons/`, generated
  by `npm run assets` from the Captain's idle frame on `--sky`. Coverage 430 / 1195,
  `atlas.json` unchanged, two runs byte-identical. 376 tests, build clean.

- **2026-10-07 — Unit 22 Part D.** `?perf` readout and `tools/fixtures/perf-stress.json`.
  Chrome: no element on `/`; on `/?perf` the line updated 3 times in 1.6 s,
  `pointer-events` was `none`, and it sat clear of the pause button on the
  title, level select, Castaway Beach and the maker. Importing the fixture and
  playing it left the captain with 5 hearts after 60 s untouched. 397 tests,
  build clean.

- **2026-10-07 — Unit 22 Part C.** `persist.js` asks the browser once per page
  session, after a successful level save, and never throws. A maker autosave
  called `persist()` once; the next save did not. Chrome denied it on
  localhost (`navigator.storage.persisted()` is `false`) and showed no prompt.
  388 tests. No console errors.

- **2026-10-07 — Unit 22 Part B.** Hand-written manifest and service worker.
  `npm run build` logs `pwa: sw.js caches 104 files (version b9893ba1ba4c)`,
  and a second build matched. Chrome confirmed one `cc-b9893ba1ba4c` cache
  with 104 entries. Offline play, the maker, and `/?perf` worked from that
  cache; the only failed request in that check was an intentional uncached
  URL. Desktop install opened a standalone window and did not enter
  fullscreen. The dev server registered no worker, and the favicon 404 is
  gone. 382 tests. Issue 28 is not closed until Part E.

- **2026-10-07 — Issues 46 and 47 fixed.** The worker matches precached files
  with `ignoreVary: true`, and `renderServiceWorker` inserts its two values
  through replacer functions. Both tests failed first (the template had no
  `ignoreVary`, and `/a$&b.png` was written as `/a__CC_PRECACHE__b.png`), then
  399 tests in 34 files passed. The build still caches 104 files, version
  `558a819acf4c`. Fresh Chrome profile, `vite preview`, worker in control, then
  the preview process was stopped and the page reloaded. Title, Settings,
  Castaway Beach (six sounds at 200, audio running), the maker (palm, Pirate
  Ship, test play) and `/?perf` all worked. The page network log recorded no
  failed request. Unit 22 is not signed off.

- **2026-10-07 — Unit 22 complete.**
  - Claude reviewed `8a306f1`: the tests fail on the old code, and a headless
    run with the server killed played from the cache. That passed every part.
  - The player installed the app from `npx vite preview` at
    `http://localhost:4173`, uninstalled it, and signed off: "it all works well".
  - Units 00–22 are complete, which finishes the v1 build plan apart from
    deployment.
  - Open from this unit: issues 44 (allocations recorded against the loop's
    `frame`) and 45 (the 8.68 ms rebuild of 2000 palms).
  - The phone checks wait for the deploy step.

## Current Goal

- Units 00–22 are complete (Unit 22 signed off on 2026-10-07). No work is in
  progress. Work ends for today.
- Next session, when the player asks: decide the deploy step (Next Up 1).

## In Progress

- Nothing.

## Next Up

0. ~~Unit 22 (PWA and Performance).~~ **Complete 2026-10-07**, signed off by the
   player. The spec is `specs/22-pwa-and-performance.md`. Its decisions, kept
   for reference (see Open Questions 2 and 7):
   - **Deployment is not in Unit 22.** Unit 22 is verified on this PC (a
     production build served on localhost, the preview server stopped for the
     offline check, desktop install). Phone install and phone frame time wait
     for a later deploy step.
   - **The app icon** (manifest, apple-touch-icon and favicon, which closes
     issue 28) is Captain Clown Nose's idle frame 0, cropped to its opaque bounds
     (x20 y4 w24 h28), scaled up by a whole number with nearest-neighbour, on
     `--sky`. It is generated by the asset pipeline, not drawn by hand.
   - **Frame time** is measured with a `?perf` URL flag: a small DOM readout of
     average and worst update + render time. It costs nothing without the flag.
   - Issue 39's desktop traces and issue 33's scratch ranges are recorded in the
     spec's As Built. Issues 44 and 45 were logged and not fixed.
     `navigator.storage.persist()` comes from watchlist 13.
1. **Deploy to Netlify.** This is next. It has no unit or spec yet, and the
   method (Netlify CLI from this PC, GitHub + Netlify, or Netlify Drop) is
   still open (Open Question 7). The real-phone checks follow it: install,
   offline with the network off, and frame time under `?perf` on the stress
   level. A host rule should send `sw.js` with `Cache-Control: no-cache`.
   Claude's review showed that a server's `Vary` header affects matching in the
   cache; that is now handled by `ignoreVary`, but recheck offline on the real
   host.
2. Standalone open issues: 4–6, 8, 9, 21, 24, 25, 27, 31, 35, 36, 41, 43, 44
   and 45. Issues 28, 33, 39, 46 and 47 are resolved.
   Issue 31 needs a side-boundary decision; issue 35 is the player's "later".

## Open Questions

1. ~~**Campaign length.**~~ **Resolved 2026-09-26** — six levels, one per mechanic
   (Unit 18 spec), inside the five-to-eight target.
2. ~~**PWA scope.**~~ **Resolved 2026-10-07:** precache everything, both themes.
   The whole build is about 1.9 MB, and boot already loads every sprite and
   sound (player decision; Unit 22 spec, Decision 2).
3. ~~**Second theme timing.**~~ **Resolved 2026-09-05** — Pirate Ship is now its
   own Unit 20, after the campaign. Unit 04 only has to shape `data/themes.js` to
   accept more than one theme.
4. ~~**Level growth UX.**~~ **Resolved 2026-09-21** — A centered level-size dialog
   opened from the toolbar Menu. Number inputs for width and height, validated
   against schema limits. Resize goes through the command stack (undoable).
   Shrink warning when content would be clipped.
5. ~~**Enemy variety.**~~ **Resolved 2026-09-13** — Crabby, Fierce Tooth and Pink
   Star get **genuinely distinct behaviour**, not just distinct art/stats (player
   decision). They still share the `WalkerEnemy` base for movement/collision/stomp,
   but each overrides behaviour meaningfully. The per-enemy behaviour design is part
   of the Unit 10 spec. See the Architecture Decisions entry below.
6. ~~**Portrait orientation (issue 16).**~~ **Resolved 2026-09-23** — ask the
   player to rotate (player decision). Portrait is not a supported canvas
   orientation; a DOM prompt covers the screen. The prompt itself is issue 16's
   own change. Residual: landscape aspects between 1 and ≈ 1.42 still stretch
   mildly (logged on issue 16).

7. **Deployment.** The player means to deploy the finished game on **Netlify**
   (2026-09-26), and will do the real-phone checks there. No unit in
   `specs/00-build-plan.md` covers deploying yet: static hosting fits the
   no-backend rule, but the build output, the service worker (Unit 22) and the
   host config need a home. Decide where it goes (likely with or after Unit 22).
   **Partly resolved 2026-10-07:** the player chose to keep deployment out of
   Unit 22. It comes after Unit 22; the method (CLI, Git-connected or Drop) is
   still open.

8. ~~**Decor has no unit (2026-10-02).**~~ **Resolved 2026-10-07** — Island Decor
   is Unit 21, explicitly closed with visual sign-off on 2026-10-07. The roster
   is the three packed background palms. They draw
   at `Z.bgDecor`, behind actors and under water. Ship props (barrels, bottles,
   candle, chains, window) stay Beyond v1.

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

**2026-09-18 — One `Shooter` + one `Projectile` class, configured from the palette.**
The deliberate opposite of the walker call above. Cannon and Seashell share one verb
in the art (idle n=1 → fire n=6 → idle, frame 3 the shot in both), so one class
serves both and the only real difference — the ammunition — lives in a nested
`projectile` object on each palette entry, the way one `Collectible` serves eight
treasures. *Why:* a class each would have invented a behavioural split the frames do
not support. Adding a shooter stays one palette entry (both reuse `Shooter.spawn`);
adding a projectile type is a `projectile` spec, never a palette row, because a
projectile is not placeable.

**2026-09-18 — Shooters are non-damaging, non-solid, and indestructible in v1.**
The body never hurts the player (SPW port: `Shell` is not in `damage_sprites`) and
is not solid (**deviation** from SPW, recorded — we have no entity-vs-player resolver
and adding one fights invariant 4). Being non-solid, they are also not stompable, and
they are indestructible in v1 (destructible turrets are a Beyond-v1 row). Only the
projectile damages. *Why:* it gives the player a real tactic (close the distance and
the shooter is harmless) and keeps the hazard roster legible — spikes static, walkers
mobile, shooters ranged-with-a-safe-body.

**2026-09-18 — Proximity tests live in `game/sense.js`; runtime spawns via `spawnEntity`.**
`playerNear` / `playerInFront` moved out of `WalkerEnemy` into a pure module the
moment a second consumer (the shooter) existed — not before. The spawn handle gained
`spawnEntity`, and the world snapshots `entities.length` before its update loop so a
mid-frame spawn (a projectile) runs from the next frame. Fresh `entities`/`fx` arrays
per enter plus no module-level pool guarantee nothing leaks across a restart.

**2026-09-18 — The fire animation is a wind-up telegraph, and the shot commits.**
The 6-frame `fire` clip reads as idle → barrel extends (frames 0–2, the "aspirate")
→ shot at frame 3 → settle (4–5). Once the wind-up starts it fires on frame 3 even
if the player has left the lane — the shot goes where they were. *Why:* the tell is
the fairness — the cannonball out-runs the player, so a readable ~0.3 s warning is
owed; a committed telegraphed attack is standard and baitable, and it matches SPW's
`has_fired`. Player confirmed the feel 2026-09-18. Tuning knobs if ever revisited:
`fireFrame` (when in the clip the shot leaves) and the clip length; aborting the shot
when the player breaks range mid-wind-up was considered and **declined** as less
readable.

**2026-09-19 — Audio is an engine service; game code uses a `playSfx` callback.**
`core/audio.js` creates and manages the `AudioContext`, decodes buffers, and
provides `playSfx`, `playMusic`, `stopMusic` and volume controls. It does not
touch `document` (only `input.js` and `viewport.js` do that in `core/`). The App
creates the audio, wires `input.onFirstGesture(() => audio.resume())`, and passes
`audio.playSfx` down through the scene to `createWorld` → the world handle → all
entities and the player. Entities call `world.playSfx('damage')` etc. without
importing or knowing about the audio module. *Why:* dependencies point inward,
and audio is an engine concern, not a game-object concern. The callback pattern
matches `spawnFx` and `spawnEntity` — the handle is the entity's interface to the
outside world. The player receives `playSfx` as a constructor argument because it
is created before the handle (same as `keys`, `level`, `stats`).

**2026-09-19 — Music does not restart on death.**
`playMusic('music')` is called on every scene `enter`, but its same-track guard
makes re-enter a no-op when the track is already playing. `stopMusic` is called
only on a true scene change (future: level select, maker). *Why:* death restarts
go through `exit()` → `enter()`, and if `exit` faded the music and `enter` faded
it back in, the player would hear a brief dip on every death. Keeping the music
up during a same-scene restart is the correct feel.

**2026-09-19 — `onFirstGesture` is separate from `onTouchDetected`.**
`onFirstGesture(cb)` fires on the first `keydown` or `pointerdown` of *any* type,
synchronously inside the event handler so `AudioContext.resume()` lands in the
user gesture call stack. `onTouchDetected` fires on the first **touch** pointer
specifically and drives control-scheme detection. Both coexist; a keyboard-only
player triggers the gesture but not the touch.

**2026-09-20 — Maker edits apply live and record as one already-executed command.**
A paint drag mutates `LevelModel` cell-by-cell so autotile updates under the
cursor, and the compact diff is `CommandStack.push`ed on release without
re-executing. `execute` is the redo path. Empty drags (every cell already in
the target state) are discarded. Cap 100. Invariant 7 holds: the only mutations
are the ones the command's inverse can restore.

**2026-09-20 — In-memory `goal` may be null; serialised levels may not.**
`createEmptyModel` skips schema validation so a new maker level has no flag
until the user places one. `codec.serialise` and `validateLevel` still require
a goal, and the `M` bridge refuses to enter play without one.

**2026-09-20 — Gesture module reads `input.touches`, never the DOM.**
Invariant 8. Mouse still uses the single `pointer` channel. Touch paint/pan/
pinch/eyedrop go through `gestures.js`. After a long-press eyedrop, that
finger is ignored until lift.

**2026-09-22 — Form fields own their keys; scenes close the dialogs they open.**
`input.js` skips any keydown aimed at an input, textarea, select or contenteditable
(releases still count). Buttons are not form fields: the pause overlay depends on
Enter reaching `input.js` while Resume is focused. A dialog opener returns
`{ close }` and the scene calls it in `unmountUI`. *Why:* Unit 17 adds text fields
(level name, share code) that must accept W/A/S/D/M/Space.

**2026-09-22 — The music is re-encoded at build time, not shipped at source bitrate.**
`ffmpeg-static` (devDependency) turns the 192 kbps track into 96 kbps CBR with
bitexact flags, so `npm run assets` stays deterministic. *Why:* the source track
alone was 85% of Goal 4's 3 MB; rewording the goal was the alternative, declined
by the player.

**2026-09-22 — Moving platforms deferred.** No moving-platform art in the pack and
no path in format 1. Listed under Deferred in the overview; the Unit 06 stub is
gone, so a future unit starts clean.

**2026-09-23 — Portrait: ask the player to rotate.** A 360-tall view with a 512
minimum width cannot fill a portrait screen without letterboxing (forbidden) or a
non-uniform stretch (3.08× on a 390 × 844 phone). Growing the virtual height in
portrait was the other option; it would have changed the field of view per
orientation and broken "360 tall, always". *Why this one:* it keeps every
Rendering Model rule intact, and the maker is already landscape-first. The
overview's "portrait and landscape both usable" is now "landscape only".

**2026-09-23 — Test-play goes through the codec.** The maker hands play
`serialise(level)`, proof-loaded once; play `deserialise`s a fresh copy on every
attempt. *Why:* invariant 2. Handing over the live model meant the maker could
produce a level that plays but can never be saved, and play could mutate the level
being edited.

**2026-09-23 — The maker session is the whole editing state.** `MakerSession`
carries the live level and command stack (undo *and* redo), camera, zoom, palette
tab, tool, eraser and paint/pan mode. The App holds it during play. Zoom now
belongs to the session, so a new level starts at 1×; this replaces the Unit 14
"zoom persists on the scene across `M`". The session's field names match Unit 17's
`cc:v1:maker:last` so persisting it later is a subset, not a migration.

**2026-09-23 — Playability rules live in `maker/validate.js`, not `schema.js`.**
Schema stays the format validator and stays palette-free. `findProblems` runs only
when `CommandStack.revision` changes, never per frame.

**2026-09-23 — `M` is the test-play shortcut, not a throwaway.** In the maker it
goes through the same gate as Play; in test-play it does what Back to editor does;
it does nothing in a play scene without `onEdit` (the Unit 18 campaign).

**2026-09-23 — No scene updates during a wipe.** The App advances input and the
transition only, so neither scene simulates under the iris and nothing pressed
mid-wipe replays afterwards. `#ui` is inert and faded for the whole wipe. The
rotate prompt holds the game the same way.

**2026-09-25 — A level is saved only once it would load.** A goal-less level cannot
be serialised, and the schema refuses more than 400 objects. So a new level lives
in memory until its flag is placed, and leaving it before then asks first.
*Why:* allowing flagless levels in storage is a format change, and pre-placing the
flag would reverse the Unit 13 decision and lose the first-run hint. The cost is
that a reload before the first flag loses the level (player decision).

**2026-09-25 — Scenes save through injected callbacks; storage stays a leaf.**
The maker calls `onSave(level)` and `openShareDialog(...)`, and the App decides
what storage does with them. `storage/` may import `level/` (the codec is the only
serialiser) and nothing above it. *Why:* invariant 6 and the injected-UI pattern.
The maker stays testable without `localStorage`.

**2026-09-25 — Boot lands on My Levels until Unit 18.** Title and level select come
later. My Levels becomes the destination of Make. No reload reopens the maker by
itself; the resume point applies when that level is opened.

**2026-09-26 — Level select is one screen with two tabs.** Campaign and My
Levels; the My Levels tab is Unit 17's screen plus Play. Title → Play opens
Campaign, Title → Make opens My Levels. *Why:* one list of the player's levels,
not two that drift (player decision).

**2026-09-26 — Death outside test-play returns to level select.** Any death
(hearts, pit, water) in the campaign or in a level played from My Levels wipes
back to the tab it came from; test-play still restarts at the spawn so building
stays quick (player decision).

**2026-09-26 — Campaign ids live in the manifest, not the files.**
`data/campaign.js` pairs each level file with a stable id that overrides the
file's own, so the progress key survives a re-export from the maker, and a tuned
level drops in unchanged. `campaign.test.js` holds every file to a canonical
maker export that passes every playability rule.

**2026-09-26 — Campaign levels are only what the maker can make.** The maker
places facing entities with `dir: -1` only, so every campaign enemy and shooter
faces left. The levels are our own designs, not ports of Super Pirate World's
maps (player decision), drafted by Claude through the model and codec and tuned
by the player in the maker.

**2026-09-26 — Real-phone checks wait for the Netlify deploy.** The player closed
Unit 18 after a full keyboard playthrough and will test on a phone once the game
is finished and deployed (player decision). Open Question 7 tracks the deploy.

**2026-10-02 — Pirate Ship is below decks: the back wall is a backdrop.** The ship
sheet's second blob copy is a back wall. It fills the view in place of the sky, sea,
horizon and clouds, rather than being a paintable layer. *Why:* a fourth tile layer
would be the first format change (format 2, a migration, six re-exported campaign
files), and it would draw nothing in the island theme. So a theme switch would no
longer be an art swap. The cost is that a ship level cannot mix open sky with an
interior (player decision).

**2026-10-02 — Ship platforms use their plank art, with a second tiling rule.**
`BAR_TABLE` picks left cap, middle, right cap or single from the E and W neighbours.
The blob rule and its tables are untouched, and the island still draws platforms
from its terrain blob. *Why:* the plank sheet is a row, not a blob set, and planks
are the first platforms that look different from terrain (player decision).

**2026-10-02 — Decor is its own unit.** It is not part of Unit 20, despite the build
plan's "matching decor". *Why:* nothing draws decor in play yet, so it is a feature
of its own, and the ship's props were a Beyond-v1 row (player decision). Open
Question 8.

## Session Notes

Resume cold from here.

**Where we are (2026-09-24):** **Units 00–16 complete** and committed. The maker's
Play button and `M` wipe into a real test-play (real HUD and touch controls,
through the codec), and Back to editor or `M` wipes back with everything restored.
A status line in the toolbar says why Play is disabled. Portrait shows a rotate
prompt, and a touch tap places one item. The Wood-and-Paper panels draw clean
frames (issue 20).

**Before that:** Units 00–15 done (2026-09-21). The maker now has a **top toolbar**
(Back, Undo, Redo, Play, Menu) and a **tabbed palette** (category tabs + scrolling
tool strip). Nine-slice `border-image` panels and buttons from the Wood and Paper kit
are live on all shared UI components (`.panel`, `.btn`). A **resize dialog** lets
the user change the level dimensions within schema limits (40–400 × 12–48), undoable
via the command stack.

Everything from before still holds: touch gestures, paint/pan toggle, undo/redo,
audio, three walkers, one Shooter + one Projectile.

2026-09-22: the repo is under git now (baseline `965dcf8` + one commit per fix);
issues 10–15 fixed, 16 (portrait stretch) and 17 (28 px palette tabs) open. Units
12 and 15 have Claude's Chrome verification recorded but still owe the player
sign-off items listed in their 2026-09-22 entry.

**2026-09-25:** **Units 00–17 complete** (Unit 17 signed off by the player). The app now boots into **My Levels**, which
lists every saved level with Edit, Share and ⋯, plus Sound, Import and New Level.
The maker autosaves once a level has its flag, and Back returns to My Levels.
Levels live in `localStorage` as share codes (`storage/`).

**2026-09-26:** **Units 00–18 complete** (Unit 18 closed by the player). The app
now boots on a **Title** (Play, Make). Level select has **Campaign** and **My
Levels** tabs, six campaign levels ship in `src/data/campaign/`, and finishing
one records progress on its card. Real-phone checks wait for the Netlify deploy
(Open Question 7). **Next:** issues 32 and 30 as standalone changes, then write
the Unit 19 spec.

**2026-09-29:** **Unit 19 built, awaiting sign-off.**
- Terrain and platforms use all 47 blob tiles (inner corners).
- The player kicks up dust on jumping and landing. Losing a heart shakes the view,
  but not under reduced motion.
- Pause opens a menu: Resume, Restart, Settings, and the way out.
- One Settings dialog (Music, Effects with the kit sliders, Touch: Auto/On/Off)
  opens from the Title, level select and the pause menu.
- Issue 32 (ligatures) is fixed.

**2026-10-02:** Unit 20 built following the player's direct implementation request.
- **Issue 30 fixed:** exact far-edge ranges, four regression tests, 320 resolver
  wall approaches and 64 real-world approaches to Castaway Beach's current raised
  block (column 63; the historical draft in the issue used column 65).
- **A1:** both ship sheets packed; coverage 430/1195, repeatable hashes, existing
  generated images unchanged.
- **A2:** blob ship terrain at (1,1), thin bar planks and opaque wall at (2,8).
  All six island tile-render hashes unchanged; all six worlds also run as ship.
- **B:** Menu theme choices, undo/redo, theme-aware terrain/platform icons;
  autosave/reload, JSON and fresh-profile share import, test-play history,
  mouse/touch drag guards and resize undo/redo verified in muted Chrome.
- **Performance:** 120 paced maker frames, 768 wide at 0.5×: median 0.8 ms,
  p95 4.2 ms, max 6.0 ms for update/render submission in headless desktop Chrome.
  This excludes compositor presentation and is not a phone measurement.
- **338 tests, build clean.** Units 19 and 20 still need the player's visual
  sign-off; no approval of Unit 19 is inferred from the implementation request.

**2026-10-03: Unit 20 is complete** (the player's sign-off after testing on the dev
server).
- Pirate Ship is a per-level theme, picked from the maker's Menu, and undoable.
- Ship levels are below decks: the back wall replaces the sky, and platforms are
  planks.
- Ship terrain draws a dark core in solid blocks, like the island's rock (issue 37,
  closed as by design).
- Water in the ship looks off: issue 35, for later.

**2026-10-03: Unit 19 is complete too** (the player checked the dust, the shake,
the pause menu and Settings). **Units 00–20 are complete.** Only Unit 21 (PWA and
performance) remains in the build plan, plus the unscheduled decor unit.

**Next:**
1. Unit 22 (PWA and Performance) when the player asks. Its spec is still unwritten.
   Unit 21 was signed off on 2026-10-07.

The testing driver is a scratch DevTools-protocol script on a throwaway headless
Chrome. Keep it muted (`--mute-audio`), or the player hears the game through their
speakers.

**Standalone issues still open:**
- 21 (text on the board; needs a token decision first)
- 24 (desktop zoom; needs a spec decision first)
- 25–28
- 31 (side boundaries; needs a player decision)
- 33 (cell-range allocations)
- 35 (ship water reads flat; the player confirmed it looks off and wants it fixed
  later)
- 36 (the HUD level name is faint; decide with 21)

**Testing tip (2026-09-24):** Claude-in-Chrome clicks are too fast for the
per-frame input sampling (issue 22), and a hidden tab runs no frames. Keep Chrome in
front and drive the canvas with timed `PointerEvent`s (≥ 50 ms press). Use iframes
of set sizes for viewport checks, since resizing the window did not change it.

**How to run**

- `npm run dev` — game at `/` (Title), atlas at `/atlas.html` (throwaway debug
  page, issue 5). Prefer a fixed port; 5173 may already be another project
  (ArcGIS). `--port 5174 --strictPort`. On 2026-09-22 another project's Vite was
  also bound to `127.0.0.1:5174` alongside ours — if a page looks wrong or stale,
  check what owns the port, or use 5175.
- `npm test` — 362 tests.
- `npm run build` — passes.
- `npm run assets` — needs `reference/treasure-hunters` and the `ffmpeg-static`
  binary (fetched by `npm install`; its install script is approved in
  `package.json`). Output is committed and deterministic.
- Edits made in two steps can leave Vite serving a broken intermediate module to an
  open tab. If a reload shows an error for code that is fine on disk, restart Vite.

**Do not**

- Import `atlas.json` from `core/`.
- Pack sword clips or Pixel Adventure leftovers.
  - The two Pirate Ship tilesheets are packed by Unit 20 Part A1, and by nothing
    earlier.
  - The three island palms ship in Unit 21. The ship's own props stay Beyond v1.
  - Enemy `Jump`/`Fall`/`Ground` stay unpacked too: packing is its own unit.
  - Shooter `Hit`/`Destroyed`/`Opening`/`Bite` and the `Totems` tree stay unpacked
    (Beyond v1).
- Give `OneShotFx` (`game/fx.js`, formerly `PickupFx`) a `flip` parameter. Every
  clip it plays is symmetric.
- Relitigate: DOM UI, level-select (no overworld), stomp-only, local + share
  codes, 5 starting hearts, spikes-as-entities, injected UI factories, distinct
  per-enemy behaviour, **shooters non-solid/non-stompable/indestructible** (stomping
  one doing nothing is correct — destructible turrets are Beyond v1).
- Wire volume persistence into `core/audio.js`. It exposes getters and setters;
  persistence lives in `storage/settings-store.js` (Unit 17).
- Mutate `LevelModel` from maker UI code. Every edit goes through
  `CommandStack`. Painting without undo is an invariant-7 bug.
- Let play start on a level `findProblems` rejects, or hand play the live model.
  Play and `M` share one gate (`requestPlay`); play gets `serialise`d data.
- Update scenes during a wipe, or mount DOM from a scene's `update` — switches
  are requests the App acts on after the scene update returns.
- Copy audio into `public/assets` by hand or list a sound the game does not play.
  Re-encoding is a `bitrate` on the manifest entry.
- Import `storage/` from a scene, or touch `localStorage` outside
  `safe-storage.js`. Scenes get `onSave` and dialog openers injected.
- Write a level that would not load (no flag, or more than 400 objects), or a
  resume point for a level that is not saved.
- Put dialog text on the board's wood fill: it goes on a paper sheet (issue 21).
- Letterbox portrait or change `VIEW_H` — portrait is decided (2026-09-23): a
  rotate prompt, nothing in the Rendering Model changes.

**Standing hazards**

- Zipping the repo while Vite is running used to EBUSY-crash the watcher on
  `src.zip`. `.gitignore` has `*.zip`; `vite.config.js` `server.watch.ignored`
  is `**/*.zip`. Restart Vite if you change that config.
- Unarmed Captain has no wall-slide clip. `wall` state reuses `player/fall`.
  Expected until sword combat is added (Beyond v1).
- Touch-control layout at phone width is deferred by player decision (issue 4 in
  `7-current-issues.md`). Do not "fix" it inside an unrelated unit.
- A project-wide `getDiagnostics` reports one error against `jsconfig.json`
  (`baseUrl` deprecation, issue 6). Source files are clean; check per file.
- Enemies are **not solid** — the player passes through them. Contact is an
  overlap test, not a collision, so there is no standing on an enemy's head. Same
  for shooters: non-solid, non-stompable, non-damaging body. Only their projectiles
  hurt. This is intended (issue 8 notes the fixture never shows `ball-dead`).

**Environment:** Node 24.19, npm 11.17, git 2.52, Windows. Python 3.14 has no
`pygame`/`pytmx` — read the references, do not launch them. `reference/` is
read-only. Audio is CC0 from `reference/super-pirate-world/audio/`.

**Facts not to guess:** 16-case autotile table and player hitbox 18×26 offset
(−23, −6) in `2-architecture.md`. Flag hitbox 16×32, draw offset (−9, −61),
sprite 34×93. Collectible opaque bounds and spike 32×16 hitbox in
`specs/08-collectibles-and-hazards.md`. Enemy hitboxes, draw offsets and the
measurements they came from in `specs/10-walker-enemies.md`, and shooter/projectile
hitboxes, muzzle points and projectile speeds in
`specs/11-shooters-and-projectiles.md`; the offset formula is
`drawOffsetX = -(opaqueX + (opaqueW - hitboxW) / 2)`,
`drawOffsetY = hitboxH - feetY`, which reproduces the player's own (−23, −6).
Re-measure if any look wrong.

**Specs on disk:**
- `00-build-plan.md`
- Units 00–17, all built and verified
- Unit 18, complete 2026-09-26
- Unit 19, complete 2026-10-03
- Unit 20, complete 2026-10-03
- `21-island-decor.md`: complete 2026-10-07. The player signed off ("zero bugs").
- `22-pwa-and-performance.md`: complete 2026-10-07. The player signed off ("it
  all works well"). Desktop measurements are in its As Built.
- There is no deploy spec yet.

Playbook: `context/README.md` Part 3.
