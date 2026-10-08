# V1b — Route 2 + Viridian Forest, playable: probe results + plan

2026-09-22, Claude Opus 5.5. **Status: done** (see *Result*) — approved with all three §3 recommendations (DECISIONS #30).
Research only; nothing in `game/` changed. Builds on `notes/02-v1-plan.md` (the V1
plan and V1a's result).

**Sources:** `refs/pokeyellow` @ `e89ead15`, mainly `engine/pikachu/pikachu_follow.asm`,
`home/overworld.asm` (`WarpFound2`, `CheckMapConnections`) and
`home/reset_player_sprite.asm`. Plus read-only probes over the committed `data/` (flood
fills of Route 2 and the Forest, warp-tile classification), run from the session
scratchpad.

## TL;DR

- **V1b is engine-only, about one session.** It adds:
  - map music, the cave palette, and debug warps for the 7 new maps;
  - Pikachu's spawn states on warps, ported from the ASM;
  - the player keeping their facing through warps;
  - item balls and the trade kid doing nothing when talked to.
- **Two changes to the V1 plan** (§3, your call):
  1. **Oak's Aide moves to A2.** The bag has no TM/HM items at all yet, so he has no
     HM05 to give. He also can't be reached in normal play before Cut (§1.1). A2
     builds TM/HM items anyway, for Brock's TM34.
  2. **Keep the player's facing through warps** (new). The original never resets it.
     Upstream turns you to face down after every warp, which spins you around when you
     leave a gate northward and gives Pikachu the wrong facing. It's visible on today's
     maps too: after entering a building you'll face up, as in the original.
- **Verify:** debug-warp to the new maps. The walking path from Viridian opens in V1e.

## Result — done 2026-09-22, commit `ab89b9b`

Landed as planned in §2, with Oak's Aide moved to A2 (DECISIONS #30).

- **What changed:**
  - `pikachu/pikachu_spawn.ts` (new): the three setters with their full map lists,
    and placement + facing for states 0–7.
  - `PikachuFollower.spawnAtState()` replaces `spawnAtWarp()`.
  - `performWarpLoad` keeps the player's facing and places Pikachu by spawn state.
    Connections use state 2, identical to upstream's old `spawn()`.
  - The door step records a normal step for Pikachu (upstream's hide-then-respawn is
    gone).
  - Empty dialogue opens no text box, and the NPC turns back.
  - `MAP_MUSIC` / `MAP_PALETTE` entries.
  - 8 debug warps. The dropdown is now keyed by index, because it was keyed by map
    name and two Route 2 entries would have collided.
- **Confirmed in the ASM while implementing:** `PlayerStepOutFromDoor`
  (`engine/overworld/auto_movement.asm`) only simulates a DOWN press. Nothing hides
  Pikachu during the door step.
- **Tests:** 399 → **409**. The new `pikachu_spawn.test.ts` has 10 cases: the §1.4
  table, the existing maps, the later-map lists, and placement for every state.
  `npm run build` OK.
- **Browser check (agent-driven)**, on a temporary `127.0.0.1` server with the debug
  overlay's Skip Intro for Pikachu:

  | Transition | Result |
  |---|---|
  | Red's room → Route 2 (South Gate door) | door step, Pikachu revealed in the doorway (3) |
  | Route 2 → South Gate | player facing up, Pikachu right (1) |
  | South Gate → Forest | Pikachu right (1) |
  | Route2Gate → Route 2 northward | facing up, Pikachu right (1) |
  | Route 2 → Route2Gate from the north | door step, Pikachu in the doorway (3) |

  - **Trade house:** the scientist's ROM text shows; the Game Boy kid opens no text
    box, and the player can move right after.
  - **Diglett's Cave entrance:** CAVE palette. The cave warp logs only the expected
    `Map "DiglettsCave" not found`.
  - **Viridian Pokécenter** (regression): facing up, Pikachu right (1).
  - **Music:** routes1 → cities1 → dungeon2, from the resource log; the Route 2 /
    Forest wild tables load too.
  - No console errors.
- **Not yet:** the user's own play-test.

## 1. Probe results (measured)

### 1.1 What's reachable without Cut

A flood fill over the committed map data, with ledges as one-way hops and NPCs and
item balls solid:

| Area | Reached how | V1b consequence |
|---|---|---|
| Route 2 west side → South Gate → **Viridian Forest** → North Gate → Route 2 north | walking, from Viridian (after V1e) | the V1 path. The Forest can be walked end to end, all 10 NPCs can be talked to, and both hidden items can be reached |
| Route 2 east pocket: Diglett's Cave entrance + trade house | only from Diglett's Cave (Vermilion side, C-phase) | the trade kid can't be met before C anyway |
| Route2Gate (Oak's Aide) + Route 2's Moon Stone and HP Up | only with **Cut**: the 6 cut-tree steps opened → reachable (C3) | nothing in normal play before C3 |

Route 2's north edge is a tree wall until V2 adds Pewter.

### 1.2 Warp tiles — upstream's door logic already works for gates

| Tiles | What happens |
|---|---|
| Each gate's top-right mat `0x3b` (door + instant) | Entering a gate from the north lands you there and auto-steps you down into the gate, as `PlayerStepOutFromDoor` does |
| Gate bottom mats `0x14`; Route 2's gate-side tiles `0x2c` (3,11), (16,35), (17,35) | Collision warps: stand on them and push toward the wall or edge |
| Route 2's house-style doors `0x1b` / `0x58` | Normal doors |
| Forest edges | Collision warps |
| Diglett's Cave entrance (4,4) `0x18` | Instant warp to the not-yet-extracted DiglettsCave: the load fails, the fade clears, and you stay put (until V4) |

### 1.3 Facing through warps

The ASM never resets the player's facing on a warp. `ResetPlayerSpriteData`, which
zeroes it, is called only by the main menu (Continue) and Oak's speech (new game).
You enter a building still facing up, and leave a gate northward still facing north.

Upstream sets `player.direction = 'down'` after every warp
(`map_transitions.ts:71`). Its own Viridian Mart script opens with
`facePlayer: up` "toward clerk before dialogue starts", a workaround for exactly this.
Every other post-warp script moves the player or sets a direction itself, so keeping
the facing breaks nothing: the Mart command becomes a no-op. Blackout and the door
auto-step set `down` explicitly, as the ASM does.

### 1.4 Pikachu's spawn states (`engine/pikachu/pikachu_follow.asm`)

**Where Pikachu appears, relative to the player** (`CalculatePikachuPlacementCoords` /
`CalculatePikachuFacingDirection`):

| State | Placement | Facing |
|---|---|---|
| 0 | on the player's tile | copies the player |
| 1 | right of the player | copies the player |
| 2 | behind the player | toward the player |
| 3 | on the player's tile | down |
| 4 | below | copies the player |
| 5 | above | toward the player (down) |
| 6 | left | copies the player |
| 7 | in front | opposite the player |

Pikachu is drawn before the player, so "on the player's tile" is hidden underneath
until the player moves off it — matching the Game Boy's sprite priority.

**Which setter runs** (`home/overworld.asm` `WarpFound2`). "Outside" means an
OVERWORLD or PLATEAU tileset (`CheckIfInOutsideMap`); the Forest isn't outside.

| Warp | Setter | Map it checks |
|---|---|---|
| from an outside map | `SetPikachuSpawnOutside` | the destination |
| indoor → `LAST_MAP` | `SetPikachuSpawnBackOutside` | the source |
| indoor → indoor | `SetPikachuSpawnWarpPad` | the destination |
| walking over a map connection | state 2, set directly | — |

Our JSON has already resolved `LAST_MAP` to real maps. But **no indoor map in Yellow
warps explicitly to an outside map** (scanned every objects file). So the source and
destination tilesets pick the same branch as the ASM. No extractor change is needed.

**The rules, in full.** They're data, so port them all, not just V1's maps.

- **Outside:**
  - OAKS_LAB → 6. MT_MOON_B1F and ROCK_TUNNEL_1F → 3. ROUTE_22_GATE → 3 when facing
    down, else 1.
  - {VICTORY_ROAD_2F; ROUTE_7/8_GATE; ROUTE_11/15/16/18_GATE_1F} → 4.
  - {VIRIDIAN_FOREST_NORTH_GATE, ROUTE_2_GATE, CERULEAN_BADGE_HOUSE,
    CERULEAN_TRASHED_HOUSE, VERMILION_DOCK, CELADON_MANSION_1F,
    FUCHSIA_GOOD_ROD_HOUSE} → 3 when facing down, else 1.
  - Anything else → 1.
- **WarpPad:**
  - VIRIDIAN_FOREST_NORTH_GATE → 1 when facing up, else 0.
  - VIRIDIAN_FOREST_SOUTH_GATE → 0 when facing down, else 1.
  - {VIRIDIAN_FOREST, the 5 Safari Zone rest/secret houses, SILPH_CO_ELEVATOR,
    CELADON_MART_ELEVATOR, the 3 Cinnabar Lab rooms} → 1.
  - Anything else → 0.
- **BackOutside:** ROUTE_22_GATE and ROUTE_2_GATE → 1 when facing up, else 3. Anything
  else → 3.

**What this means on the V1 maps**, against upstream's 3-case model (outdoor→indoor:
beside the player; leaving through a door: hidden, then behind; anything else: on the
player):

| Transition | Facing | ASM state | Upstream today |
|---|---|---|---|
| Route 2 → South Gate / trade house / Diglett's Cave entrance | up | 1 right | right ✓ |
| South Gate → Forest | up | 1 right | on player ✗ |
| Forest → North Gate | up | 1 right | on player ✗ |
| North Gate → Route 2 (at 3,11) | up | 3 on player, facing down | on player (facing copied) ≈ |
| Route 2 → North Gate (pushing down at 3,11) | down | 3 on player | right ✗ |
| North Gate → Forest | down | 1 right | on player ✗ |
| Forest → South Gate | down | 0 on player | on player ✓ |
| South Gate / trade house / Diglett's Cave entrance → Route 2 (through a door) | down | 3 on player, then the door step | hidden, then behind ≈ ✓ |
| Route 2 → Route2Gate, south door | up | 1 right | right ✓ |
| Route 2 → Route2Gate, north side | down | 3 on player | right ✗ |
| Route2Gate → Route 2, northward (16,35) | up | 1 right | on player ✗ |
| Route 2 ↔ Viridian (connection) | any | 2 behind | behind ✓ |

The existing maps already agree with the ASM: Oak's Lab left (6), houses right (1),
door exits (3), stairs (0). Tests will pin those so nothing regresses.

### 1.5 Other facts

- **Empty-dialogue NPCs:** exactly the 7 from V1a — 5 item balls, the Aide, the trade
  kid — across all 19 maps. A generic "empty dialogue opens no text box" rule changes
  nothing else.
- **The bag has no TM/HM items.** `item_names.json` holds the 97 `ItemNames` entries
  only. HM05 would need the machine names (`GetMachineName`: "HM05") and the
  `TechnicalMachines` table — that's an extractor change, and A2's job.
- **Palettes:** everything falls back to ROUTE except DiglettsCaveRoute2 → **CAVE**
  (CAVERN tileset; `SetPal_Overworld`).
- **Music:** routes1 / cities1 ×4 / dungeon2 ×2, all already extracted
  (`notes/02-v1-plan.md` §1). Upstream switches map music without the ASM's fade-out.
  That's an existing gap everywhere; logged, not V1b.

## 2. The plan — V1b (engine only)

Files: `src/main.ts`, `src/renderer/palettes.ts`, `src/debug.ts`,
`src/overworld/map_transitions.ts`, `src/overworld/overworld_controller.ts`, a new
`src/pikachu/pikachu_spawn.ts` + its test, and the ARCHITECTURE docs for pikachu/ and
overworld/.

1. **Wiring:**
   - `MAP_MUSIC` — Route2 routes1; Route2Gate, Route2TradeHouse and both Forest gates
     cities1; ViridianForest and DiglettsCaveRoute2 dungeon2.
   - `MAP_PALETTE` — DiglettsCaveRoute2 → CAVE.
   - Debug warps: Route 2 at the South Gate door, Route 2 at the North Gate exit, the
     Forest's south entrance, both Forest gates, Route2Gate, the trade house, and the
     Diglett's Cave entrance.
2. **Keep facing through warps:** drop the forced `down` in `performWarpLoad`. Blackout
   and the door step keep setting `down` themselves.
3. **Pikachu spawn states:**
   - `pikachu_spawn.ts` holds the lists from §1.4 as data, plus pure functions:
     (source map + tileset, destination map + tileset, facing) → state, and state →
     placement + facing.
   - `performWarpLoad` uses it in place of upstream's 3 cases.
   - During the automatic door step, check the ASM for whether Pikachu stays drawn
     under the player. If it does, drop upstream's hide-then-spawn so Pikachu simply
     appears as the player steps off the door.
4. **Inert objects:** an NPC with empty dialogue opens no text box. That covers the
   item balls (until A1), the trade kid (A4), and the Aide (A2, if Q1 = yes).
5. **Docs:** `src/pikachu/ARCHITECTURE.md` (the states and lists) and
   `src/overworld/ARCHITECTURE.md` (facing, warp tiles).

**Tests:** a new `pikachu_spawn.test.ts`, about 15 cases: the §1.4 table plus Oak's
Lab, a house entry and exit, stairs, and Route 22's gate. The baseline goes from 399 to
about 414.

**Verify** (your play-test, via the debug overlay):
- **Maps:** each of the 8 debug warps lands correctly. Walk every warp: Route 2 ↔ both
  gates ↔ the Forest, the trade house, the Diglett's Cave entrance (its cave warp does
  nothing), and Route 2 → Viridian by walking south. Route 2's north edge is a wall.
- **Music:** routes1 → cities1 → dungeon2 as you go. **Colors:** the cave entrance
  uses the cave palette.
- **Facing:** you still face north after leaving a gate northward, and you face up
  after entering buildings.
- **Pikachu:** follows through every transition as the §1.4 table says.
- **NPCs and items:** every NPC and sign shows its ROM text; the Forest's leaving sign
  shows TRAINER TIPS 1. Both hidden items can be picked up, and wild Pokémon appear in
  the Forest grass. Item balls and the trade kid do nothing.
- **Regressions:** the intro (Pallet grass → Oak's Lab), the Viridian Mart parcel
  scene, and a Pokécenter visit.

**Until V1c,** talking to a Forest trainer still uses upstream's flow (instant battle,
"I lost to you..."). That's existing behavior, not a regression.

## 3. Decisions

1. **Move Oak's Aide from V1b to A2?** **Recommended: yes.** The bag has no TM/HM items
   yet, and he can't be reached before Cut. Until A2 he's inert, like the trade kid.
2. **Keep the player's facing through warps, in V1b?** **Recommended: yes.** It's what
   the ASM does, and the gates need it. Visible elsewhere too: you'll face up after
   entering a building.
3. **Door SFX when leaving the Forest into a gate:** the ASM plays go-outside (it goes
   by the tile under the player); upstream plays go-inside. **Recommended: leave it for
   V5's SFX slice**, which fixes that rule everywhere, rather than special-casing it
   here.
