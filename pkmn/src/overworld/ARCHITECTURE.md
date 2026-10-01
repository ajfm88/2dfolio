# Overworld Architecture

## Map System

Maps are JSON files in `data/maps/`. A map references a tileset (e.g., `"OVERWORLD"`) which determines:
- **Tileset image**: `TILESET_FILES` mapping in `map.ts` (e.g., `OVERWORLD -> overworld.png`)
- **Blockset**: `TILESET_BLOCKSET` mapping -> `blockset_*.json` (4x4 tile patterns per block)
- **Collision tiles**: `COLLISION_NAMES` mapping -> `collision_tiles.json` (walkable tile IDs per tileset)
- **Grass tiles**: `GRASS_TILES` mapping in `map.ts` (for wild encounter triggering)

Walkability check: `isWalkable(tileX, tileY)` checks tile at `(tileX, tileY + 1)` — the bottom-left tile of the player's 2x2 sprite area.

## Bookshelf Interaction

`getBookshelfText(tileX, tileY)` checks tiles against `BOOKSHELF_TILES` table (from `bookshelf_tile_ids.asm`). Player checks both 1-tile-ahead (adjacent) and 2-tiles-ahead (facing). Each tileset maps specific tile IDs to text categories (BOOKS, TOWN_MAP, POKEMON_STUFF, etc.).

## Tileset Sharing (important for adding new maps)

- `DOJO` and `GYM` share `gym.png`, `blockset_gym.json`, collision `'Gym'`
- `REDS_HOUSE_1` and `REDS_HOUSE_2` share collision `'RedsHouse2'`
- `MART` and `POKECENTER` share `pokecenter.png`, `pokecenter.bst`, collision `'Pokecenter'`
- `FOREST_GATE`, `MUSEUM`, `GATE` share `gate.png`, `gate.bst`, collision `'Gate'`

## Frame Rate Control

- Adjustable FPS via `-`/`+` keys (steps of 5, range 10-120, default 50)
- Persisted in localStorage key `pokeyellow-fps`
- Toast overlay shows new value for ~2 seconds on change

## Screen Fade Transitions

Warp transitions use a white fade overlay (matching original Game Boy behavior):
- `warpToMap()` in main.ts sets `state = 'transition'`, starts fade-out (alpha 0->1 over `FADE_FRAMES=8`)
- When fully faded, `fadeCallback` fires -> `performWarpLoad()` in `map_transitions.ts` loads map async
- After load, fade-in starts (alpha 1->0), then state returns to `'overworld'`
- `drawFadeOverlay(alpha)` renders at end of every frame
- Battle end: instant white-out (`fadeAlpha=1`) -> fade-in from white (assembly: `GBPalWhiteOut` -> `GBFadeInFromWhite`)

## Battle Transitions

Visual transitions before battles start (`battle_transitions.ts`):
- **Spiral** (trainer battles): clockwise inward tile-by-tile blackout, 8 tiles/frame
- **Wild** (wild encounters): 3 flash blink cycles, then horizontal stripe fill
- Module-owns-state: `startSpiralTransition(cb)` / `startWildTransition(cb)` -> `updateBattleTransition()` -> `renderBattleTransitionOverlay()`

## Story State

`story_state.ts` — stateless functions for NPC state based on story progression:
- `applyStoryNpcState(mapName, npcs)`: sets NPC visibility/dialogue per event flags
- `applyDefeatedTrainers(mapName, npcs, defeated)`: marks defeated trainers
- `recordDefeated(mapName, npcId, defeated)`: records a defeat

## Map Transitions

`map_transitions.ts` — async map loading for warps and connections:
- `performWarpLoad(...)`: loads destination map, repositions player and Pikachu, returns `WarpLoadResult`
- `performMapConnection(...)`: loads connected map (walked off edge), returns new NPC list

## Overworld Controller

`overworld_controller.ts` — per-frame overworld update logic, extracted from main.ts:
- `updateOverworld(deps, state)`: runs one frame of overworld logic (door exits, interactions, movement, warps, story triggers, encounters, trainer sight)
- Returns `OverworldAction` union for state transitions (script, battle, warp, shop, etc.) — main.ts handles the action
- `OverworldState`: mutable state tracked across frames (doorExitStep, justWarped, standingOnWarp, etc.)
- `OverworldDeps`: read-only references passed each frame (player, gameMap, npcs, etc.)
- Inline script builders: `buildNurseScript()`, `buildMomHealScript()` for NPC interaction scripts

## Pikachu Follower & Happiness

Pikachu code has been moved to `src/pikachu/`. See `src/pikachu/ARCHITECTURE.md`.

## Ledge Hopping

`isLedge(tileX, tileY, dir)` in `map.ts` checks if the player is standing on a ledge source tile and facing a ledge destination tile. Ledges only exist on the OVERWORLD tileset (from `data/tilesets/ledge_tiles.asm`). The player hops down/left/right over impassable ledge tiles — no upward ledges exist.

## GameMap Public API

Beyond `load()`, `render()`, `isWalkable()`, and the getters (`width`, `height`, `widthPx`, `heightPx`, `widthTiles`, `heightTiles`), GameMap exposes:

- `getBlock(bx, by)` — get block ID at block coordinates (border block for out-of-bounds)
- `getTileAt(tx, ty)` — get tile ID at tile coordinates (checks connected maps for OOB)
- `getSignAt(stepX, stepY)` — find sign text at step position
- `getBookshelfText(tileX, tileY)` — check if tile is a bookshelf, return text or null
- `getHiddenEventAt(stepX, stepY, facing)` — find hidden event at position, filtered by direction
- `getWarpAt(tileX, tileY)` — find warp at tile position (converts to step coords internally)
- `getWarpByIndex(index)` — get warp by its array index
- `isInBounds(tileX, tileY)` — check if tile coords are within map bounds
- `getConnection(dir)` — get `MapConnection` by direction (`'north'|'south'|'east'|'west'`)
- `isGrassTile(tileX, tileY)` — check if tile is a grass tile (for wild encounters)
- `renderGrassOverlay(spriteX, spriteY, cameraX, cameraY)` — redraw grass on top of sprite's bottom half (OAM priority)
- `isLedge(tileX, tileY, dir)` — check if player can ledge-hop in the given direction
- `isDoorTile(tileX, tileY)` — check if tile is a door (for auto-step-out after warp)
- `isInstantWarpTile(tileX, tileY)` — check if tile triggers a warp immediately when stepped on

## Key Files

| File | LOC | Purpose |
|------|-----|---------|
| `map.ts` | 478 | Map loading, tileset, collision, grass tiles, ledges, bookshelf |
| `player.ts` | 398 | Player movement, direction, animation |
| `npc.ts` | 408 | NPC sprites, dialogue, movement, trainer detection |
| `story_state.ts` | 182 | NPC visibility/dialogue based on story flags |
| `battle_transitions.ts` | 164 | Spiral and wild battle transition animations |
| `map_transitions.ts` | 175 | Async warp/connection map loading |
| `overworld_controller.ts` | 539 | Per-frame overworld update logic, interaction handling |
