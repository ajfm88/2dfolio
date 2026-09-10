# Build Plan

Twenty-two units in dependency order. Each produces **one** visible, verifiable
result and stays inside one system boundary. Do not work out of order. Each unit gets
its own spec at `specs/NN-<name>.md` before implementation starts.

Ordering follows the rules in `context/README.md` Part 3: dependencies first, data
model before the things that read it, shells before real content, and dependencies
installed only in the unit that first needs them.

---

## Unit 00 — Project Scaffold

**Builds:** `git init` and a `.gitignore` that excludes `node_modules`, `dist` and
`reference/` while keeping `public/assets/` tracked. Vite vanilla project.
`index.html` with `<canvas id="game">` and `<div id="ui">`. Folder skeleton under
`src/` matching `2-architecture.md`. `jsconfig.json` with `checkJs`.
`src/settings.js` — `TILE`, `VIEW_H`, viewport clamps, `ANIM_FPS`, `FIXED_DT`, `Z`.
Base CSS with every colour token from `3-ui-context.md` and the `--ui-scale` setter.
Self-hosted Pixelify Sans.

**Depends on:** nothing. **Installs:** `vite`.
**Done when:** `npm run dev` serves a page whose canvas fills the viewport with no
letterboxing at any window size, clears to `--sky`, and logs a stable tick count.
`npm run build` passes.

## Unit 01 — Asset Pipeline

**Builds:** `tools/asset-manifest.mjs` (declarative clip list) and
`tools/build-assets.mjs`. Packs animation folders into per-clip horizontal strips,
copies tilesheets, composites the UI nine-slices (boards and papers from 16 × 32 px
tiles into 128 × 128; buttons from 16 × 14 px tiles into 56 × 56), packs the
mobile-button icons, copies the CC0 audio from
`reference/super-pirate-world/audio/`, and emits `src/data/atlas.json`. Adds
`npm run assets`. Output is committed.

Also prints the **asset coverage report** described in `2-architecture.md` and writes
`tools/coverage.json`.

**Depends on:** 00. **Installs:** `sharp` (dev).
**Done when:** `npm run assets` is deterministic across two runs, every clip the
manifest names exists in `public/assets/`, a throwaway debug page draws every clip
with correct frame counts, and the coverage report's numerator plus its unused list
equals the pack's shippable file count.

## Unit 02 — Engine Core

**Builds:** `core/loop.js` (fixed 1/60 accumulator, 5-step cap), `core/viewport.js`
(virtual size, scale, DPR cap, resize), `core/camera.js` (follow plus clamping that
degrades to centring on levels smaller than the view), `core/input.js` (pointer
events, keyboard, edge-triggered state), `core/atlas.js`, `core/sprite.js` (10 FPS
playback advanced in fixed-dt seconds), `core/rect.js`.

**Depends on:** 01. **Installs:** none.
**Done when:** a throwaway scene draws an animated Captain idle, moves it with arrow
keys and a pointer drag, the camera follows and clamps, and animation speed is
identical on a 60 Hz and a 120 Hz display.

## Unit 03 — Level Model and Codec

**Builds:** `level/model.js` (`Uint8Array` per tile layer, entity and decor arrays,
resize), `level/schema.js` (defaults, every validation rule, versioned errors),
`level/codec.js` (RLE, JSON, `deflate-raw` with base64 fallback, share codes).
`src/types.js` with the shared typedefs. Tests for all three.

**Depends on:** 00. **Installs:** `vitest` (dev).
**Done when:** `npm test` passes with round-trip fidelity on a fixture level,
malformed input rejected with a field-naming error, both compression paths covered,
and run counts validated against `cols × rows`.

## Unit 04 — Tile Rendering and Autotiling

**Builds:** `level/autotile.js` (the closed form and the 16-case table from
`2-architecture.md`), `data/themes.js` shaped to accept more than one theme, and the
tile-drawing half of `level/render.js` — terrain, platform and water layers over the
visible cell range only.

**Depends on:** 02, 03. **Installs:** none.
**Done when:** a hand-written fixture level renders correct edges for single tiles,
one-wide columns, one-tall bars, solid masses and every mixed case; erasing produces
correct edges too; only on-screen tiles are drawn; autotile has test coverage of all
16 masks including grid edges.

## Unit 05 — Parallax Background

**Builds:** the background half of `level/render.js` — sky fill, the `BG Image`
parallax layer, the tiled scrolling `Big Clouds` band, drifting small clouds on a
repeating timer, water reflections, and the sea and horizon bands.

**Depends on:** 04. **Installs:** none.
**Done when:** layers scroll at distinct rates with no seams or popping at either
end of a level, and the horizon sits correctly at every camera position.

## Unit 06 — Player Physics

**Builds:** `game/physics.js` (old-rect/new-rect resolution, solid and semi-solid,
terminal velocity), `game/player.js` (run, variable jump, coyote time, jump buffer,
wall slide, wall jump, drop-through, moving-platform carry), `data/tuning.js`.

**Depends on:** 04. **Installs:** none.
**Done when:** a test level exercises each case by hand, the resolver has unit tests,
and behaviour is identical at 60 Hz and 144 Hz.

## Unit 07 — Play Scene Core

**Builds:** `game/play-scene.js`, `game/world.js`, and the first entries in
`data/palette.js` — markers (spawn, goal), terrain, platform, water. Spawn placement,
the flag goal, the bottom death border, water drowning, and level restart.

**Depends on:** 06. **Installs:** none.
**Done when:** a fixture level loads from JSON, the player spawns, traverses, dies to
the pit and to water, restarts, and completes by touching the flag.

## Unit 08 — Collectibles and Static Hazards

**Builds:** the health and coin data model with property setters, coins, the three
diamond colours, the golden skull, potions, spikes, damage with invulnerability
flicker, and their palette entries.

**Depends on:** 07. **Installs:** none.
**Done when:** every collectible awards correctly and despawns with a particle,
spikes damage on contact, invulnerability prevents chain damage, and health reaching
zero ends the run.

## Unit 09 — HUD and Touch Controls

**Builds:** the DOM HUD (hearts from the Life Bars sprites, coin counter, level name
fade, pause button), the on-screen directional cluster and jump button, control-scheme
detection, and the results panel.

**Depends on:** 08. **Installs:** none.
**Done when:** a level is completable using only touch and only keyboard, the HUD
tracks health and coins exactly, every control is at least 44 × 44 CSS pixels, and
nothing is obscured by a notch or home indicator.

## Unit 10 — Walker Enemies

**Builds:** a shared `WalkerEnemy` base plus Crabby, Fierce Tooth and Pink Star —
ledge and wall turning, lunge on proximity using the Anticipation and Attack clips,
contact damage, stomp death with a bounce — and their palette entries.

**Depends on:** 09. **Installs:** none.
**Done when:** each enemy patrols, turns correctly at ledges and walls, damages on
contact from the sides, dies to a stomp, and never walks off the level.

## Unit 11 — Shooters and Projectiles

**Builds:** the Seashell and Cannon hazards with their fire states, the pearl and
cannonball projectiles, terrain collision with a burst particle, lifetime despawn,
and their palette entries.

**Depends on:** 10. **Installs:** none.
**Done when:** shooters fire only when the player is in range and in front, every
projectile despawns on terrain and on lifetime, and none leak across a level restart.

## Unit 12 — Audio

**Builds:** `core/audio.js` — one `AudioContext`, decoded buffers, unlock on the
first user gesture, pooled sfx playback, looping music with a crossfade on scene
change, and music/sfx volumes.

**Depends on:** 11. **Installs:** none.
**Done when:** audio starts after the first tap on iOS and Android, volumes persist
across a reload, and muting produces no errors or stalls.

## Unit 13 — Maker Core

**Builds:** `maker/maker-scene.js` reusing `level/render.js`, the grid overlay, a
palette driven entirely by `data/palette.js`, paint and erase with per-cell dedupe,
and `maker/commands.js` — one command per drag, compact inverse diffs, a 100-entry
cap — with undo and redo. The command stack ships **with** painting, not after it,
or invariant 7 is violated from birth.

**Depends on:** 07 (needs the palette and the level loader; enemies from 10–11 appear
automatically as they are registered). **Installs:** none.
**Done when:** a full level can be built with a mouse, autotiling updates correctly
while painting and erasing, and undo/redo is exact across 50 mixed operations.

## Unit 14 — Maker Gestures

**Builds:** two-finger pan, pinch zoom at 0.5× / 1× / 2×, the one-finger paint/pan
toggle, long-press eyedropper, and `pointercancel` recovery.

**Depends on:** 13. **Installs:** none.
**Done when:** painting and panning never fight each other on a real phone, no
gesture triggers browser zoom or text selection, and no drag is left stuck after an
interrupted touch.

## Unit 15 — Maker Responsive UI

**Builds:** the bottom palette bar with scrolling category tabs, the top bar (Back,
Undo, Redo, Play, Menu), the level-size dialog, safe-area padding, and orientation
handling.

**Depends on:** 14. **Installs:** none.
**Done when:** the maker is usable at a phone-sized viewport in both orientations,
chrome never covers the cell under the thumb, and a level can be resized without
losing content.

## Unit 16 — Test-Play Round Trip

**Builds:** `maker/validate.js` (exactly one spawn, at least one goal, inline error
display), the Play button, the expanding-circle transition, and lossless return with
camera, zoom and selected tool restored.

**Depends on:** 15. **Installs:** none.
**Done when:** the round trip is lossless in both directions ten times in a row, and
an invalid level shows a specific reason instead of failing to load.

## Unit 17 — Persistence and Sharing

**Builds:** `storage/safe-storage.js`, `storage/levels.js`,
`storage/settings-store.js`, the level list screen (create, rename, duplicate,
delete), autosave while editing, share-code copy and paste, and `.json`
export/import on desktop.

**Depends on:** 16. **Installs:** none.
**Done when:** levels survive a reload, a share code round-trips into a different
browser profile and plays identically, private mode degrades to in-memory without
throwing, and quota exhaustion shows a readable message.

## Unit 18 — Campaign, Level Select and Title

**Builds:** the title screen, mode select, the level-select grid with Campaign and
My Levels tabs, `storage/progress.js`, and five to eight campaign levels **authored
in our own maker** and exported to `src/data/campaign/`.

**Depends on:** 17. **Installs:** none.
**Done when:** the campaign is completable start to finish, progress persists, and
every campaign level opens in the maker unchanged — proving both modes share one
format.

## Unit 19 — Polish

**Builds:** inner-corner autotiling using the remaining 31 blob tiles, dust particles
on jump and land, screen shake on damage, the pause menu, and the settings screen.

**Depends on:** 18. **Installs:** none.
**Done when:** diagonal terrain junctions render with correct inner corners, existing
saved levels are unaffected, and `prefers-reduced-motion` suppresses shake and
transitions.

## Unit 20 — Second Theme

**Builds:** the Pirate Ship theme — tilesheet, the `(1,1)` tile origin offset, the
back-wall layer, matching decor — plus the theme picker in the maker.

**Depends on:** 19. **Installs:** none.
**Done when:** switching a level's theme changes only its art, autotiling logic is
untouched, and a level authored in one theme renders correctly in the other.

## Unit 21 — PWA and Performance

**Builds:** the web app manifest, a service worker precaching the shell and assets,
an offline check, and a profiling pass over the render and update loops.

**Depends on:** 20. **Installs:** PWA plugin only if a hand-written service worker
proves insufficient.
**Done when:** the game installs and plays offline, and frame time stays under 16 ms
on a mid-range phone with a full screen of tiles, twenty entities and active
parallax.

---

## Dependency Summary

```
00 scaffold
├── 03 model/codec ──────────────┐
└── 01 assets ── 02 engine ── 04 tiles ── 05 parallax
                                 └── 06 physics ── 07 play core ─┬─ 08 collectibles ── 09 HUD+touch
                                                                 │        └── 10 walkers ── 11 shooters ── 12 audio
                                                                 └── 13 maker core ── 14 gestures ── 15 maker UI
                                                                          └── 16 round trip ── 17 storage ── 18 campaign
                                                                                   └── 19 polish ── 20 theme ── 21 PWA
```

Playable milestones, for sanity checks along the way:

| After unit | You can                                                    |
| ---------- | ---------------------------------------------------------- |
| 07         | Play a fixture level from JSON, die, and finish it          |
| 09         | Play it on a phone with a working HUD                       |
| 11         | Play a level with a full cast of enemies and hazards        |
| 16         | Build a level and play it — **both modes working**          |
| 18         | Play a campaign and share levels — **feature complete**     |

---

## After Unit 21

Unit 21 completes v1, which is scoped to what PirateMaker and Super Pirate World
between them prove out. It is not the end of the game.

The **Beyond v1** table in `1-project-overview.md` lists every Treasure Hunters asset
group the two reference projects never touch, and the mechanic each one's frames
imply — throwable swords, key-and-chest objectives, destructible props, destructible
totems, a ship with working sails, collectible map fragments, enemy awareness
bubbles, an inventory with cooldowns. Goal 6 is that all of it eventually lands.

Each of those becomes a numbered unit here before any of it is built. Do not start
one during v1, and do not add a "just in case" hook for one. The coverage report from
Unit 01 is how progress against Goal 6 is measured.
