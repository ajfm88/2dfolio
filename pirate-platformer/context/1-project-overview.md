# Coral Corsairs

## Overview

Coral Corsairs is a browser-based pirate platformer with two modes that share one
engine and one level format. **Play mode** is a hand-crafted campaign in the style
of Super Pirate World: run, jump, wall-jump, stomp enemies, collect treasure, reach
the flag. **Maker mode** is a Mario-Maker-style level editor that works with a mouse
on desktop and with touch on phones and tablets — you paint terrain, drop in enemies
and treasure, press Play, and you are instantly inside your own level. It runs
entirely in the browser with no account, no server and no install: levels are saved
to the device and shared as copy-paste codes. It is for players who want a good
platformer and, ten minutes later, want to build one.

## Goals

1. A player can finish a campaign level end to end — spawn, traverse, take damage,
   collect treasure, reach the flag — at a stable 60 FPS on a 2020-era phone.
2. A first-time user can build a playable level on a touchscreen and test-play it
   in under three minutes without reading instructions.
3. Play mode and Maker mode share the same level schema, loader, renderer and
   entity registry, so a level built in the maker is byte-identical to a campaign
   level in how it loads and behaves.
4. The whole game — code, art, audio, campaign levels — loads in under 3 MB and
   works offline after first load.
5. Adding a new enemy, item or hazard takes one registry entry plus one class, and
   requires no change to the maker UI, the level codec or the renderer.
6. **Every asset in the Treasure Hunters pack eventually finds a place in the game.**
   v1 covers the subset the two reference projects prove out; each release after it
   raises the coverage number that `npm run assets` reports. See **Beyond v1**.

## Core User Flow

### First run

1. User opens the site; assets load behind a pirate-themed loading screen.
2. Title screen offers **Play** and **Make**.
3. User picks **Play** and lands on the level-select grid, which shows campaign
   levels first and their own saved levels below.
4. User taps a campaign level; a transition wipe plays and the level starts.
5. User controls the pirate with keyboard (desktop) or on-screen buttons (touch),
   collects treasure, loses hearts on damage, and touches the flag to finish.
6. A results panel shows treasure collected and time; user returns to level select.

### Making a level

1. From the title screen the user picks **Make**, then **New Level** (or opens an
   existing one from the list).
2. The maker opens with an empty grid, a bottom palette bar, and the spawn point
   already placed.
3. User selects Terrain from the palette and drags across the grid to paint ground;
   tiles auto-connect with correct edges and corners as they draw.
4. User switches palette tabs to place platforms, water, treasure, enemies, hazards
   and decoration. Two-finger drag pans, pinch zooms, a toggle switches between
   paint and pan on one finger.
5. User places the finish flag. Undo and redo are available at every step.
6. User taps **Play** — the level validates, a transition wipe plays, and the same
   engine that runs the campaign runs their level.
7. User taps **Back to editor**; the maker returns with the camera and selected
   tool exactly as they were left.
8. Level autosaves to the device. **Share** copies a code to the clipboard.

### Sharing

1. User taps **Share** in the maker or on a level card; a share code is copied.
2. Another user taps **Import**, pastes the code, and the level appears in their
   list, playable and editable.

## Features

### Play mode

- Fixed-timestep platforming: run, jump with variable height, coyote time and jump
  buffering, wall slide and wall jump.
- One-way platforms with drop-through, and moving platforms that carry the player.
- Stomp-to-defeat combat: land on an enemy to kill it and bounce; contact from any
  other direction costs a heart.
- Enemies: Crabby, Fierce Tooth and Pink Star — patrolling walkers that turn at
  ledges and walls and lunge when the player is close.
- Hazards: spikes, Seashell and Cannon shooters whose projectiles die on terrain,
  water that drowns, and a bottom death border.
- Treasure: gold and silver coins, three diamond colours, golden skull, potions
  that restore a heart.
- Hearts-based health with invulnerability flicker after a hit; running out
  returns the player to level select.
- Parallax sky, drifting clouds, animated water and palm trees.
- Level complete on touching the flag, with a treasure and time summary.

### Maker mode

- Fixed-size grid canvas, default 160 × 24 cells, growable to 400 × 48.
- Palette organised into tabs: Terrain, Platforms, Water, Treasure, Enemies,
  Hazards, Decor, Markers.
- Paint by dragging; erase with a dedicated eraser tool or right-click on desktop.
- Terrain and platforms auto-tile as you draw, including when you erase.
- Pan and zoom at 0.5×, 1× and 2×, with a paint/pan toggle for one-finger use.
- Full undo and redo over every edit, including multi-cell drags as single steps.
- Eyedropper: long-press or middle-click a placed thing to select its tool.
- Live validation — a level needs exactly one spawn and at least one flag before
  it can be played, with the problem shown inline.
- Test-play round trip that preserves camera position, zoom and selected tool.

### Shared systems

- One entity registry drives the maker palette, the play-mode spawner and every
  editor preview.
- One level schema, one loader, one renderer for both modes.
- Campaign levels are authored in the maker and exported into the build, so the
  two modes cannot drift apart.
- Two visual themes — Palm Tree Island and Pirate Ship — that swap tilesheets
  without changing any tiling logic.

### Persistence and sharing

- Levels, campaign progress and settings saved to the device with `localStorage`.
- Autosave while editing; explicit save on leaving the maker.
- Level list with create, rename, duplicate and delete.
- Share codes: compressed, URL-safe text that can be pasted anywhere.
- Desktop also gets `.json` export and import by file.

### Input and platform

- Keyboard: arrows or WASD to move, Space or Up to jump, Down to drop through.
- Touch: on-screen directional pad and jump button, sized for thumbs.
- Mouse, touch and pen unified through pointer events.
- Portrait and landscape both usable; landscape recommended for the maker.
- Installable as a PWA and playable offline after first load.

## Scope

### In Scope

- Two modes — campaign play and level maker — in a single vanilla JavaScript and
  Vite application with no backend.
- Canvas 2D rendering of 32-pixel tiles at a fixed 360-unit-tall virtual viewport.
- The three walker enemies, three shooter hazards, spikes and water listed above.
- Stomp-only combat.
- Two themes: Palm Tree Island and Pirate Ship.
- Five to eight campaign levels authored in our own maker.
- A level-select grid covering both campaign and user levels.
- DOM-based UI over the canvas, styled with the Wood and Paper nine-slice sprites.
- Local persistence plus copy-paste share codes.
- Vitest coverage for the level codec, the autotiler and the collision resolver.

### Out of Scope

Do not build, install dependencies for, or suggest these:

- **A node-graph overworld map.** The Treasure Hunters pack contains no overworld
  tileset; Super Pirate World's came from a different pack. Level select replaces it.
- **Sword combat.** Captain Clown Nose's attack, combo, air-attack and throw art
  exists in the pack but stays unused. Combat is stomp-only.
- **Any backend, account system, login, or online level browser.** No server, no
  database, no auth. Sharing is copy-paste text only.
- **Multiplayer or co-op**, local or networked.
- **A boss fight or any scripted cutscene.**
- **Tiled/TMX import or export.** Our maker is the only level authoring tool.
- **Native or wrapped mobile apps.** The PWA is the mobile story.
- **A TypeScript migration.** The project is JavaScript with JSDoc types.
- **Any game engine, physics library, or UI framework.** No Phaser, no Matter.js,
  no React, no Tailwind.
- **Level rating, comments, leaderboards, or telemetry.**
- **Destructible terrain, slopes, or non-square collision.** Collision is
  grid-aligned AABB only.
- **Localisation.** English only.

### Deferred, not rejected

Plausible later, but not built or designed for now beyond the data shapes already
specified:

- Inner-corner autotiling using the remaining 31 tiles of the blob set.
- An overworld map, if overworld art is ever sourced.
- Gamepad support.
- Everything in **Beyond v1** below.

## Beyond v1 — Full Pack Coverage

**v1 is scoped to what PirateMaker and Super Pirate World between them prove out**:
a level maker, a platformer runtime, and the entity roster those two projects share.
That is the finish line for v1 and nothing below is built until it is crossed.

But the two reference projects use only a fraction of Treasure Hunters, and some of
what they skip is not decoration — it is whole mechanics the artist already drew
every frame for. **The long-term goal is that every asset in the pack finds a place
in the game** (see Goal 6). The table below is the standing roadmap: each row is an
asset group the references never touch, and the mechanic its frames imply.

| Asset group | Frames that give it away | Mechanic it unlocks |
| --- | --- | --- |
| Captain with Sword, Sword, Sword Effects | 3-hit combo, 2 air attacks, **Throw Sword**, plus Sword Idle / Spinning / **Embedded** | Sword combat where the sword is a *throwable object* — throw it, it sticks in a wall, you fight unarmed until you retrieve it |
| Dialogue bubbles (player and crew) | Exclamation, Interrogation, Dead — each with In and Out | Enemy awareness states: `!` on spotting you, `?` on losing you, skull on death |
| Chest, Chest Key, Padlock, Unlocked | Padlock and Unlocked as separate states; key has an Idle and a pickup Effect | Find-the-key objectives; a chest as an alternative level goal to the flag |
| Barrel and Box | Idle → Hit ×4 → Destroyed ×4, with debris frames | Destructible props that can hide treasure |
| Totems, Wood Spike | 3 head types, Idle 1/2, Attack 1/2, Hit 1/2, Destroyed | Tiered shooter turrets that can be destroyed, unlike v1's indestructible ones |
| Merchant Ship | Hull Idle / Hit / Destroyed, Anchor, and a Sail with **Wind, No Wind and both transitions** | A ship set piece or vehicle level — the sail states imply the wind actually changes |
| Ship Helm | 10-frame idle | An interactive object: take the wheel, end the level |
| Door | Opening and Closing | Room-to-room transitions in the ship interior |
| Window (74 frames), Window Light, Candle, Chains, Barrels and Bottles | a very long ambient loop | The full below-decks interior dressing set |
| Big Map, Small Maps 1–4, Map Effect | Folding, Idle, Unfolding, plus In/Out effects | Collectible treasure-map fragments — a campaign-wide progression hook |
| Water Splash 1–2, Reflexes 1–2 | splash on entry, animated reflections | Swimming, or splash feedback on entering water |
| Seashell Bite, Opening, Hit, Destroyed | more states than v1's fire-and-idle | A shell that can be destroyed, and one that bites at close range |
| UI Inventory, Mobile Button Cooldown, Prefabs, Banners, Orange Paper, Sliders | inventory slots and cooldown overlays | An item or ability system with cooldowns |
| Green Bottle, Medium and Small Life Bars | unused potion and bar sizes | Further consumables and a compact HUD variant |

Two rules keep this honest rather than aspirational:

1. `npm run assets` prints an **asset coverage report** — how many source files the
   manifest packs, and every file it does not. Coverage is a number we can watch go
   up, not a vibe.
2. Nothing in this table is built, scaffolded or designed for during v1. Adding a row
   to the game means giving it a unit in `specs/00-build-plan.md` first.

## Success Criteria

1. `npm run build` produces a bundle that loads and plays a campaign level with no
   console errors on Chrome, Firefox and Safari, desktop and mobile.
2. A level built entirely on a phone in Maker mode can be play-tested and returned
   from without losing camera position, zoom level or selected tool.
3. A level exported as a share code, pasted into a different browser profile, loads
   and plays identically to the original.
4. Terrain painted in any shape — single tiles, one-wide columns, one-tall bars,
   solid masses, and any combination — renders with the correct edge sprite, and
   still does so after arbitrary erasing.
5. The player can complete a level using only touch controls, and only keyboard,
   with no mode-specific bugs in either.
6. Frame time stays under 16 ms while the viewport shows a full screen of tiles,
   twenty entities and active parallax, measured on a mid-range phone.
7. Adding a new enemy requires changes to exactly two files — a registry entry in
   `src/data/palette.js` and its class in `src/game/entities/` — with no edit to the
   maker UI, the codec or the renderer.
8. Reloading the page restores the level list, campaign progress and settings; a
   browser in private mode degrades to in-memory storage without throwing.
