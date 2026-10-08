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

`Player.checkInteraction` uses `OverworldLoop`'s order (A1b): hidden events →
bookshelf only when no hidden event matched → signs → NPCs. The caller supplies the
hidden-item flag test; a found hidden item skips the bookshelf and falls through to
signs/NPCs. The existing counter check still finds an NPC two steps away.

## Item pickups (A1b, DECISIONS #41)

`item_pickup.ts` builds pure command lists from `PickUpItem`, `HiddenItems` and
`Route1PrintYoungster1Text` (`notes/18-a1b-plan.md`):

- NPCs with extracted `item`: give first, hide the ball and open the found-text box
  in the same frame, play `get_item1`, then close after the sound and A's release.
  A full bag prints the no-room text and waits silently for A/B; the ball stays.
- Hidden items: print found text before giving; success sets the event flag and
  waits for current SFX before `get_item2`. A full bag keeps the flag clear, waits
  silently, then replaces the text with its `cont` failure and a final silent wait.
- Route 1's sample: set the flag first, show the sample with a protected `prompt`,
  give, then show the success/jingle or failure and wait silently before closing.
  A full bag permanently loses the sample, as on the cartridge.

`hideObject` stores `Map:npcId` in `events.ts` and immediately refreshes the player's
sprite collision mask without advancing NPCs. Hidden sprite slots remain indexed
but unavailable for collision and drawing. `SaveData.hiddenObjects` is optional for
old saves; loading restores it before story state, and new games clear it. All current
pickup objects start ON; a future `ShowObject` caller will extend the toggle model.
The bag's 99-per-slot and first-overflow rules live in `items.ts`; duplicate ids are valid.

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

- **`PassClock`** (`main.ts`): the states `overworld` and `script` run
  a pass on every second tick (`emotion_bubble`, A1c, counts frames and runs none). Entering them from anything else restarts the pair, as
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
  Menus synchronize it every frame. Since A5a the text printer reads it only where
  Joypad runs (not during opening, ProtectedDelay3, scroll or sound waits). START held across a
  step opens the menu when the step ends, and a tap released between reads is lost, as on
  the Game Boy.

## Pass order, encounters and NPC visibility (A6b)

`main.ts` calls `runMapScript` before reading the joypad on every standing overworld
pass. Pallet, Viridian and the lab triggers run there, and since A1c trainer sight
(*Trainer sight* below). `step_end.ts` defines the pure check order: count → Pikachu happiness
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

## NPC movement and sprite collisions (A6c, `notes/10-a6c-plan.md`)

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

## Overworld movement pitfalls

- **Everything that moves counts passes, not frames** (A6a): the player 2 px a pass
  (16 frames a step), NPCs 1 px after a start pass (34), Yellow's fast NPC codes 18.
  New movement code goes through `PlayerWalk` / `NpcWalk`, never a per-frame speed.
- **Turning** takes one pass, only while `wCheckFor180DegreeTurn` is set (a pass with
  nothing pressed sets it, only a turn clears it) and toward a direction other than the
  last stop direction. The turning pass skips `UpdateSprites`.
- **Wall bump**: walk-in-place animation every pass; `collision` replays only when it
  isn't already playing (`isSfxPlaying('collision')`).
- **Map connections fire mid-step.** `performMapConnection` must call
  `player.cancelMovement()` after repositioning, or the next `update()`
  interpolates from the old map's target and snaps the player to a wrong spot.
- **Scripted movement**: `startScriptedMove` cancels in-progress movement. ASM
  `SimulateJoypadStates` goes through the full overworld engine (collision +
  connections); our `updateScriptedMove` moves directly without collision — don't
  copy ASM joypad paths that go off-map.
- **One-step push-backs are `pushPlayer`, not `movePlayer`** (V1e, DECISIONS #34):
  `pushPlayer` runs `player.update` with a simulated direction, so the step collides,
  hops ledges (the Viridian Gym door hops the ledge below it) and takes no turning
  frame, as `StartSimulatingJoypadStates` does.
- **Trainer sight is a map script** (A1c): never put it back at step end. It runs from
  `runMapScript`, so it sees the latched sprite images (`available`) and the landing.
- **Step triggers vs. a held key** — fixed by A6a: a held direction starts the next step
  on the pass after one ends. A6b moves the map triggers into `runMapScript`, before
  `readJoypad` on every standing pass, including returns from text/battles/warps. The
  old take-the-step-back workaround (`forgetPlayerStep`) is gone.
- **Sprite blocking is pixel geometry, not tile claims** (A6c): `sprite_collision.ts` in
  the Game Boy screen basis, the player's mask taken before NPCs move, NPCs in slot order,
  the exact-front check after. Don't reintroduce `claimedTile` reservations or an origin
  box; wanderers are bounded by the displacement bytes and the screen edge.
- **Pikachu has three update paths**: `updateSprite(ctx)` from `updateSprites` (idles,
  antics), `fontLoadedUpdate(ctx)` once per UI opening (`overworld/ui_entry.ts`, from
  `main.ts` `checkUiEntry`), and `startMovement` / `tickMovement` for Yellow's movement
  interpreter (A6e; never idles). New cutscene code that moves Pikachu runs one of its
  byte programs (extract it into `pikachu_movement.json`), never pixel paths; a map
  script's call is `tryPikachuMovement` (guard + refresh), a direct call has neither.
  New UI states that draw over the map belong in `ui_entry.ts`'s list.
- **Pikachu's map position is its own state** (A6e): `mapStepX/Y` are MAPX/MAPY, not
  rounded pixels. Follow commands move it as they start, the interpreter as each absolute
  command ends; a call blocks the script, holds the pass clock and draws Pikachu in slot 0.
- **Pikachu follows the native command buffer (A6d)** (`pikachu/follow_buffer.ts`):
  `recordStepForPikachu` uses `startedFollowStep` after UpdateSprites, including both
  halves of a hop. The newest entry stays retained; follow hops move two tiles without
  an arc on the next player step.
- **Map script state** (`w<Map>CurScript`): keep a map's resting state with
  `getMapScript` / `setMapScript` (`events.ts`, saved as `mapScripts`). Viridian City
  is the first user (`story/viridian_city.ts`).

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
- `applyStoryNpcState(mapName, npcs)`: applies saved `hiddenObjects` first, then NPC
  visibility/dialogue per event flags; collected balls stay hidden across map loads
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
- `updateOverworld(deps, state)`: runs one pass of overworld logic (door exits, interactions, movement, warps, encounters), after `main.ts` has run `runMapScript` (story triggers, trainer sight) and read the joypad
- Returns `OverworldAction` union for state transitions (script, battle, warp, shop, etc.) — main.ts handles the action
- `OverworldState`: mutable state tracked across frames (doorExitStep, justWarped, standingOnWarp, etc.)
- `OverworldDeps`: read-only references passed each frame (player, gameMap, npcs, etc.)
- Inline script builders: `buildNurseScript()`, `buildMomHealScript()` for NPC interaction scripts

### Trainer encounters (V1c, `home/trainers.asm`)

- Talking to an unbeaten trainer returns `{ type: 'talkToTrainer', npc }`; a beaten one
  shows `afterBattleText`. `main.ts` `engageTrainer(npc, seen)` shows the before-battle
  text (`dialogue`) through `MapDialogue` / DisplayTextID (A5a), with TalkToTrainer's
  nested three-frame PrintText delay. When talked to, `meetMusicFor(class)` starts
  from the text-completion callback after the last letter's delay — the ASM text
  ends with `done`, so `EngageMapTrainer` runs before the silent fresh A/B wait.
  A release and the close's one-frame delay precede the battle. Exact sprite reload
  costs and the trailing UpdateSprites await A5b.
- The sight path (*Trainer sight* below) calls `engageTrainer(npc, true)`: the same text, no
  music there, because it started at spotting.
- `main.ts` keeps the engaged trainer and flags it beaten in the battle-finish handler
  unless the battle was lost.

## Trainer sight (A1c, `notes/20-a1c-plan.md`, DECISIONS #43)

A map with trainer headers (`map_trainers.ts` `TRAINER_MAPS`: the Forest today) runs the ASM's
script trio as its `w<Map>CurScript` (`getMapScript`/`setMapScript`), from `runMapScript` on
every standing pass, before the joypad read:

- **0 `CheckFightingMapTrainers`:** `trainer_sight.ts` (pure) ports `TrainerEngage` in screen
  bytes. It reads the sprite table's `available` (the image latch), the facing, and
  `sightRange << 4`. The $fc quirk (facing down, it can't see 4 steps) and the pop-in quirk
  (at the window's 4-step edge a walking player is spotted one step closer) fall out of it.
  Header order is slot order, and the first trainer that engages wins. On a hit, the script
  goes to 1 and `ow.seenByTrainer` / `ow.engagedNpc` are set; it returns `trainerEngage`.
- **The spotting pass** (`main.ts`):
  1. the meet music starts;
  2. state `emotion_bubble` holds 61 frames (`emotion_bubble.ts`). "!" is drawn over every
     sprite on the 61 renders from the spotting tick on, and nothing moves;
  3. then `finishTrainerEngage` runs EmotionBubble's `UpdateSprites` and the walk-up
     (`startTrainerWalkUp`: `MoveSprite_`, keeping the trainer's movement status; collisions
     off);
  4. the rest of the pass runs (`restOfPass`) under the joypad mask.
- **The joypad mask** is `input/joy_ignore.ts` (`wJoyIgnore`): the d-pad when the trainer is
  adjacent, every button while it walks. The edge stays raw.
- **`BIT_SEEN_BY_TRAINER`** gates START, signs, sprites and Pikachu: `.displayDialogue`'s
  `UpdateSprites` runs, then nothing opens. Hidden events and bookshelves (`preDialogue`) come
  before that gate.
- **1 `DisplayEnemyTrainerTextAndStartBattle`:** waits for the walk's terminator, then clears
  the mask and returns `trainerText` → `engageTrainer(npc, true)`. The script is set to 2, as
  `StartTrainerBattle` does. Talking to an unbeaten trainer also sets 2 (`trainerTalkedTo`).
- **2 `EndTrainerBattle`:** the first pass after the battle clears the seen state and returns
  to 0, with no sight check that pass. A blackout resets it first (`AllPokemonFainted`).
- **Every battle return that isn't a blackout** runs `EnterMap`'s `UpdateSprites`
  (`enterMapAfterBattle`). A trainer that came into view on the battle step can spot you on
  the first pass back.
- **Not built:** `RunMapScript` at a hop's midpoint (V4). `trainer_tripwires.test.ts` fails
  if an OVERWORLD map gets a sight trainer, or if `TRAINER_MAPS` drifts from pret's scripts.

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
missing: `SFX_LEDGE` (V5) and `RunMapScript` at the hop's midpoint (V4, DECISIONS #43; a
tripwire test fails when a map can reach it). Trainer sight runs after the landing (A1c).

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
| `trainer_sight.ts` | — | `TrainerEngage`, `CheckForEngagingTrainers`' order, `TrainerWalkUpToPlayer` (A1c, pure) |
| `map_trainers.ts` | — | The trainer script trio, `TRAINER_MAPS`, the seen state and the walk-up (A1c) |
| `emotion_bubble.ts` | — | EmotionBubble's 61-frame hold (A1c) |
| `story_state.ts` | 182 | NPC visibility/dialogue based on story flags |
| `battle_transitions.ts` | 164 | Spiral and wild battle transition animations |
| `map_transitions.ts` | 175 | Async warp/connection map loading |
| `overworld_controller.ts` | 539 | Per-frame overworld update logic, interaction handling |
| `item_pickup.ts` | — | Item-ball, hidden-item and Route 1 sample command builders (A1b) |
