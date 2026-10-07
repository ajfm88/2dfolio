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

- Adjustable FPS via `-`/`+` keys (steps of 5, range 10-200, plus the Game Boy rate as a stop between 55 and 60; default the Game Boy's 59.7275 Hz since 2026-09-25, `core/tick_clock.ts`, DECISIONS #33)
- Persisted in localStorage key `p151-f`
- Toast overlay shows new value for ~2 seconds on change

## Pace: the overworld pass (A6a, DECISIONS #36)

The ASM's `OverworldLoop` calls `DelayFrame` twice per pass, so **everything that moves in
the overworld advances once every two frames**. Text, script `wait`s, fades, audio and
battles still count frames. `walk_pace.ts` (pure, tested in `walk_pace.test.ts`) holds
the state machines; `Player`, `Npc` and `PikachuFollower` run them.

- **`PassClock`** (`main.ts`): the states `overworld`, `script` and `trainer_approach` run
  a pass on every second tick. Entering them from anything else restarts the pair, as
  `jp OverworldLoop` does. A6d uses `delay(1)` after the extra landing pass, so its continuation is
  three frames after the landing update.
  While Pikachu's scripted movement runs (`pikachuFollower.movementActive`, A6e) no pass
  runs and the pair restarts, so the next pass comes two frames after the call returns.
- **The player** (`PlayerWalk`): 2 px a pass, 8 passes (16 frames) a step. A step's first
  2 px move in the pass it starts. **The next step starts in the pass after one ends**
  (no gap), so step triggers run before a held direction carries the player on. That
  fixed the held-key trigger bugs, and Viridian's `cancelMovement` workaround is gone.
  - **Turning** costs one pass, only when `wCheckFor180DegreeTurn` is set (a pass with
    nothing pressed sets it, only a turn clears it) and the direction isn't the last stop
    direction. The turning pass skips `UpdateSprites`, and the sprite shows the new
    facing at the next one.
  - **Bumps** walk in place and replay `collision` only when it isn't already playing.
  - **A ledge hop:** a collision pass, then 16 passes over 32 px with
    `PlayerJumpingYScreenCoords`, then a landing pass with one extra player animation
    tick and `UpdateSprites`. `isLanding` blocks map scripts, input and interactions;
    `isMoving` is false there. A 1-frame hold plus the normal pair places the continuation
    at armed+37 (landing at +34). `finishLanding()` clears the ledge flag before input,
    or before a script push advances to text. `startedFollowStep` reports both halves
    (passes 1 and 9), while `justStartedStep` retains its existing start meaning.
- **NPCs** (`NpcWalk`, `UpdateNPCSprite`'s statuses): a normal step is a start pass plus
  16 × 1 px (34 frames). Yellow's fast codes `$04`–`$07` are a start pass plus 8 × 2 px
  (18 frames). `moveNpc` `modes` and `moveParallel` `npcModes` choose per step.
  - **In step** (`DoScriptedNPCMovement`, `moveParallel` `npcInStep`, Oak's walk to the
    lab): an init pass, then 2 px a pass.
  - **Starting a step** can't happen while the player is mid-step.
  - **Wanderers** rest 1–256 passes between steps.
  - **A scripted walk** starts with one resting pass and ends one pass after its last pixel.
- **Walk animation** (`WalkAnim`, `Func_5274`): the frame advances every 4 updates. Frames
  0–3 are stand, walk, stand, walk, with the last one x-flipped facing up or down
  (`WalkingDown2`/`WalkingUp2`), so the feet alternate. Pikachu's frame advances every 2
  updates, or every 5 below happiness 80.
- **`UpdateSprites`** is `sprites.ts` `updateSprites()`. `PlayerWalk.pass` calls it where
  the ASM's loop does, so Pikachu, whose follow command is appended after `UpdateSprites`,
  moves one pass behind the player.
- **The joypad** (`input.ts` `readJoypad`): the overworld reads it on standing passes, and
  a button counts as pressed when it is down at a read and wasn't at the one before.
  Menus and text boxes read it every frame (`syncJoypadRead`). So START held across a
  step opens the menu when the step ends, and a tap released between reads is lost, as on
  the Game Boy.

## Pass order, encounters and NPC visibility (A6b)

`main.ts` calls `runMapScript` before reading the joypad on every standing overworld
pass. Pallet, Viridian and the lab triggers run there; trainer sight stays at step
end until A1c. `step_end.ts` defines the pure check order: count → Pikachu happiness
and mood → encounter → warp → connection. Turns roll without counting. Each ledge
hop half and door exit is simulated and only checks transitions.

The byte step counter and post-battle cooldown live in `OverworldState`. Every
`EnterMap` (warps, loading a save, battle returns) resets the step counter and rearms
an active cooldown to 3. Seamless connections bypass EnterMap and preserve them.
Ordinary steps decrement before encounters, making the first two steps calm and
the third eligible. The 256-step happiness coin flip only awards a healthy party
Pikachu; walking moves mood exactly one unit toward 128 (nonempty party only).

`EncounterContext` models the implemented NewBattle/TryDoWildEncounter gates.
Indoor map classification follows FIRST_INDOOR_MAP, with FOREST's grass-only
exception. Grass/water tests use the bottom-left tile. Repel stays in A3.

NPC availability uses stable player map coordinates, the 4/5-step window, and a
standing image refresh, with scripted sprites exempt from the window. Oak's in-step
engine separately refreshes its animation while the player moves. `captureUi`
renders UI once to a transparent Canvas, recording boxes in `ui_tiles.ts` before
NPC rendering: any of a sprite's four footprint tiles under UI hides it whole.

Talk-facing is retained. Fixed-facing STAY sprites use NpcWalk's ready/resting
cycle, with a random 0–127 delay (0 = 256); the next fixed turn waits for a standing
player. A6c (below) generalized that cycle to every ordinary sprite.

## NPC movement and sprite collisions (A6c, `notes/a6c-plan.md`)

**Live movement bytes.** `NpcWalk` keeps `movement1` (STAY / WALK) and `movement2` (a
fixed facing, NONE / ANY, UP_DOWN, LEFT_RIGHT) apart from `NpcData`: `direction` → fixed,
else `walkDir` → the axis, else NONE (STAY) / ANY (WALK). A script's terminator sets
`movement1` to STAY without a random byte and leaves the sprite ready; a beaten trainer
gets STAY/NONE (below). A map load rebuilds both bytes from the data.

**A try** (ready, player standing; `UpdateNPCSprite .randomMovement`): one random byte
picks the direction (`npcDirection`: 00–3f / 40–7f / 80–bf / c0–ff, axes folded per the
table in `walk_pace.ts`), drawn even for STAY and fixed facings. The facing and unit step
vector are written first, so a blocked try still turns. STAY always fails; WALK checks, in
order, the destination's lower-left terrain, the screen edge, the collision mask and the
displacement bytes. A failure draws a second byte, `& $7f` → the delay (0 waits 256), and
clears the vector. An ordinary step draws its delay on its last pixel. So NONE STAY sprites
turn in place at random and fixed ones return to their facing.

**Displacement bytes** (`npcDisplacement`): 8 and 8 at `InitializeSpriteStatus` (the
`Npc` constructor stands in for `EnterMap`'s UpdateSprites); up/left fail at zero,
down/right add as bytes (255 → 0). Yellow dropped Red/Blue's limit, so there is no origin
box. Scripted steps never touch them. A sprite that walked in step with the player
(`DoScriptedNPCMovement`) holds afterwards, as `UpdateNonPlayerSprite` keeps routing it there.

**Screen basis** (`sprite_collision.ts`): a sprite's `XPIXELS/YPIXELS` are its world pixels
minus the player's plus ($40, $3c), as bytes. The camera is unchanged (A6b F-1 stays
separate). Edge test: `u8(Y + 4 + dy) < $80` and `u8(X + dx) < $90`, unit deltas.

**Collisions** (`collisionMask`, `DetectCollisionBetweenSprites`): each axis coordinate is
snapped to its 16 px block and tagged 0 still / 7 forward / 9 backward; an axis overlaps
when the unsigned difference is at most the two half-widths (7 still, 9 moving). The bit
is X when the sprite's own Y half-width is smaller, else Y. Unavailable sprites (hidden,
off the window, image $ff) never block. Pikachu never enters the player's mask.

**Order** (`sprites.ts`): `spriteTable` builds slot 0 (the player, at $40/$3c), NPCs from 1
in map order and Pikachu at 15, from the live objects. `updateSprites` takes the player's
mask first (`Player.detectSpriteCollisions`), then updates the NPCs in order — earlier
slots already moved, later ones not — then Pikachu. A pressed direction is in the
player's vector before UpdateSprites (`PlayerWalk.vx/vy`); nothing pressed, it is zero.

**The player's check** (`Player.checkStep`, `CollisionCheckOnLand`): the stored mask, then
the first available sprite exactly 16 px ahead (`spriteInFront`, after the sprite
updates), then terrain and ledges. Pikachu there goes through `pikachuInFront`: B held or
a zero counter passes; otherwise the counter counts down and blocks until it reaches zero.
`PlayerWalk.pikachuCollisionCounter`: a real turn sets 8, a pass with nothing pressed and
every moving pass clear it — seven blocked checks, then the step. Script callers pass no
sprite table, so Pikachu never blocks a scripted push.

**Beaten trainers** (`main.ts` battle finish, `home/trainers.asm` `PrintEndBattleText`): a
won map-trainer battle calls `Npc.stayAndFaceAnyDirection(map)` on the live sprite — never
RIVAL1–3, never on Pokémon Tower 7F. Nothing is saved: re-entering the map restores the
original bytes, and talking to the beaten trainer only prints its after text.

## Screen Fade Transitions

Warp transitions use a white fade overlay (matching original Game Boy behavior):
- `warpToMap()` in main.ts sets `state = 'transition'`, starts fade-out (alpha 0->1 over `FADE_FRAMES=8`)
- When fully faded, `fadeCallback` fires -> `performWarpLoad()` in `map_transitions.ts` loads map async
- After load, fade-in starts (alpha 1->0), then state returns to `'overworld'`
- `drawFadeOverlay(alpha)` renders at end of every frame
- Battle end: instant white-out (`fadeAlpha=1`) -> fade-in from white (assembly: `GBPalWhiteOut` -> `GBFadeInFromWhite`)

## Battle Transitions

Visual transitions before battles start (`battle_transitions.ts`):
- **Spiral** (scripted trainer battles, e.g. the Oak's Lab rival): clockwise inward tile-by-tile blackout, 8 tiles/frame.
  Map-trainer battles have no transition yet — A5 adds the ASM's 8
- **Wild** (wild encounters): 3 flash blink cycles, then horizontal stripe fill
- Module-owns-state: `startSpiralTransition(cb)` / `startWildTransition(cb)` -> `updateBattleTransition()` -> `renderBattleTransitionOverlay()`

## Story State

`story_state.ts` — stateless functions for NPC state based on story progression:
- `applyStoryNpcState(mapName, npcs)`: sets NPC visibility/dialogue per event flags
- `applyDefeatedTrainers(mapName, npcs, defeated)`: marks defeated trainers
- `recordDefeated(mapName, npcId, defeated)`: records a defeat — called only when a
  battle against that trainer ends without a loss (`EndTrainerBattle`, V1c)

## Map Transitions

`map_transitions.ts` — async map loading for warps and connections:
- `performWarpLoad(...)`: loads destination map, repositions player and Pikachu, returns `WarpLoadResult`
- `performMapConnection(...)`: loads connected map (walked off edge), returns new NPC list
- **The player keeps their facing through a warp** (V1b). The assembly never resets it:
  `ResetPlayerSpriteData` runs only at Continue and new game. You enter a building still
  facing up and leave a gate northward still facing north. A door step (landing on a
  door tile) then walks the player down, as `PlayerStepOutFromDoor` does.
- **Pikachu** is placed by Yellow's spawn states (`src/pikachu/pikachu_spawn.ts`), chosen
  from the source and destination maps and the facing the warp fired with.
- **A warp to a map that isn't extracted** fails gracefully: the player stays put (see
  the Diglett's Cave entrance before V4). **A connection to one would hang**, because
  `performMapConnection` doesn't catch the load error — so the extractor never emits one.

## Overworld Controller

`overworld_controller.ts` — per-pass overworld update logic, extracted from main.ts:
- `updateOverworld(deps, state)`: runs one pass of overworld logic (door exits, interactions, movement, warps, story triggers, encounters, trainer sight), after `main.ts` has read the joypad
- Returns `OverworldAction` union for state transitions (script, battle, warp, shop, etc.) — main.ts handles the action
- `OverworldState`: mutable state tracked across frames (doorExitStep, justWarped, standingOnWarp, etc.)
- `OverworldDeps`: read-only references passed each frame (player, gameMap, npcs, etc.)
- Inline script builders: `buildNurseScript()`, `buildMomHealScript()` for NPC interaction scripts

### Trainer encounters (V1c, `home/trainers.asm`)

- Talking to an unbeaten trainer returns `{ type: 'talkToTrainer', npc }`; a beaten one
  shows `afterBattleText`. `main.ts` `engageTrainer(npc, seen)` shows the before-battle
  text (`dialogue`) and, when talked to, starts `meetMusicFor(class)` as soon as the last
  page has typed (`TextBox.isWaitingForInput && !hasMorePages`) — the ASM text ends with
  `done`, so `EngageMapTrainer` runs before the A press. Closing the text starts the battle.
- The sight path (`trainer_approach`) calls `engageTrainer(npc, true)`: the same text, no
  music there, because the ASM starts it at spotting — A1 wires that and the "!" bubble.
- `main.ts` keeps the engaged trainer and flags it beaten in the battle-finish handler
  unless the battle was lost.

## Pikachu Follower & Happiness

Pikachu code has been moved to `src/pikachu/`. See `src/pikachu/ARCHITECTURE.md`.

## Ledge Hopping

`isLedge(tileX, tileY, dir)` in `map.ts` checks if the player is standing on a ledge source tile and facing a ledge destination tile. Ledges only exist on the OVERWORLD tileset (from `data/tilesets/ledge_tiles.asm`). The player hops down/left/right over impassable ledge tiles — no upward ledges exist.

The hop's timing includes A6d's landing update (see *Pace*). `ledgeHopFlag` stays set
from arming through the landing hold; cancellation clears it. `renderLedgeShadow` loads
the extracted 8x8 ROM tile (`/gfx/overworld/shadow.png`) with OBP0, mirrors it into 16x8,
and draws at player minus camera plus (0, 8). It runs after the player's grass overlay;
`destination-out` punches the current player frame out of the shadow, preserving OAM
priority even where grass hides the player's opaque pixels. Pikachu's native command
buffer waits on takeoff and crosses in one flat two-tile move on the next step. Still
missing: `SFX_LEDGE` (V5), map scripts at midpoint and trainer sight after landing (A1c).

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
| `walk_pace.ts` | — | The pass, `PlayerWalk`, `NpcWalk`, `WalkAnim`, the jump table (A6a); the direction byte and displacement rules (A6c). Pure |
| `sprite_collision.ts` | — | Screen basis, collision mask, screen edge, sprite in front, the Pikachu counter rule (A6c, pure) |
| `sprites.ts` | — | `spriteTable()`, `updateSprites()` in slot order, `recordStepForPikachu()` (A6a, A6c) |
| `ui_entry.ts` | — | A text box or menu opening over the map: `overworldUiOpen()`, `UiEntry`, `fontLoadedUpdateSprites()` (DisplayTextIDInit's UpdateSprites; A6c review R-2) |
| `sprite_visibility.ts` | — | The sprite window, NPC and Pikachu UI footprints (`spriteCovered`, `pikachuCovered`), the image latch |
| `player.ts` | — | Player input, collision, rendering; movement via `PlayerWalk` |
| `npc.ts` | — | NPC sprites, dialogue, trainer detection, the beaten-trainer hook; movement via `NpcWalk` |
| `story_state.ts` | 182 | NPC visibility/dialogue based on story flags |
| `battle_transitions.ts` | 164 | Spiral and wild battle transition animations |
| `map_transitions.ts` | 175 | Async warp/connection map loading |
| `overworld_controller.ts` | 539 | Per-frame overworld update logic, interaction handling |
