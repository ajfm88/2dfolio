# Pikachu System Architecture

## Modules

| File | LOC | Purpose |
|------|-----|---------|
| `pikachu_follower.ts` | — | Native follow commands, movement, flat ledge hops, separate script targets, placement after a warp, image latch |
| `follow_buffer.ts` | — | Yellow's 16-byte follow buffer, retained newest command, pop and catch-up rules (A6d, pure) |
| `pikachu_idle.ts` | — | Idle glances and the four antics (`Func_fc803`, statuses 6–9), follow-command bytes (A6c, pure) |
| `pikachu_spawn.ts` | 129 | Where Pikachu appears after a warp: Yellow's spawn states and the per-map lists (see below) |
| `pikachu_happiness.ts` | 274 | Happiness/mood state, emotion face selection (20 animation scripts), happiness modifiers |
| `pikachu_emotion.ts` | 145 | Emotion face display: bordered box with animated 40x40 face, frame compositing |

## Happiness & Mood

ASM: `engine/events/pikachu_happiness.asm`, `engine/pikachu/pikachu_emotions.asm`.

- **State**: `pikachuHappiness` (0-255, default 90) and `pikachuMood` (0-255, default 128)
- **Face selection**: mood x happiness matrix maps to 1 of 20 animation scripts. Status overrides: SLP->sleeping face, other status->sick face
- **Modifiers**: the tables below. Each nudges mood toward a target value. **Bug reproduced:**
  USEDITEM happiness fires *before* checking whether the item has any effect
  (`item_effects.asm:941`) — a Potion on full-HP Pikachu still counts.

Implemented (effect tiers are happiness <100 / <200 / 200+):

| Event | Effect | Mood | Trigger |
|---|---|---|---|
| LEVELUP | +5/+3/+2 | 0x8A | `main.ts` after level gain |
| FAINTED | −1/−1/−1 | 0x6C | `main.ts`, player mon faints (level gap < 30) |
| WALKING | +2/+1/+1 | 0x80 | `overworld_controller.ts`, every 256 steps |
| GYMLEADER | +3/+2/+1 | 0x80 | `main.ts:startTrainerBattle`, before gym leaders |
| USEDITEM | +5/+3/+2 | 0x83 | `battle.ts:usePotion/useStatusHeal`, `item_menu.ts:useItemOnMon` — Pikachu only |
| CARELESSTRAINER | −5/−5/−10 | 0x6C | `battle.ts:checkFaint` + `main.ts`, enemy 30+ levels higher |

**Not yet implemented — add when the system is built:**

| Event | Effect | Mood | ASM | Add where |
|---|---|---|---|---|
| USEDXITEM | +1/+1/+0 | 0x80 | `engine/items/item_effects.asm` (X items, Dire Hit, Guard Spec) | `battle.ts:handleItemUse` when X items land, if target is Pikachu (data ready, no trigger) |
| USEDTMHM | +1/+1/+0 | 0x94 | `item_effects.asm` ~l.2468 | after a successful TM/HM teach on Pikachu (**A2**) |
| DEPOSITED | −3/−3/−5 | 0x62 | `engine/pokemon/bills_pc.asm` | Bill's PC deposit of Pikachu (**E2**) |
| PSNFNT | −5/−5/−10 | 0x62 | `engine/events/poison.asm` | Pikachu faints from overworld poison (**A3**) |
| TRADE | −10/−10/−20 | 0x00 | `engine/link/cable_club.asm` | trading Pikachu away |
| `wd49b` emotion override | — | varies | `pikachu_emotions.asm:346` | item reactions: stone refusal (1), healing (2), item refusal (4), Thunder/Thunderbolt learning (5); skips mood update when set |
| `wPikachuEmotionModifier` | — | — | `poison.asm` `.clearEmotionModifier`, `pikachu_happiness.asm` | blocks certain mood increases; walking clears it when mood reaches 128. Separate from `wd49b`; not implemented yet → Pikachu state audit / J2 |
| NPC happiness checks | — | — | Cerulean Melanie (147), Museum 2F Hiker (101), Celadon Mansion | `getPikachuHappiness()` in those map scripts (**V3** Museum, **B2**, **D3**) |
| Mood floor after battle | — | ≥ 130 ($82) | `engine/battle/end_of_battle.asm` → `pikachu_status.asm:117` `UpdatePikachuMoodAfterBattle` — after any battle not lost, if the starter Pikachu is alive in the party | `main.ts` battle-finish handler (found in V1c) |

## Emotion Animation

- Each script has a base face PNG + overlay PNG(s). Frame sequences alternate between base-only (delay) and base+overlay.
- 1 assembly tick = 3 game frames (~50ms). Sequences loop until duration expires or A/B pressed.
- Pikachu faces: `gfx/pikachu/unknown_eXXXX.png` (40x40, 2-bit grayscale)

## Oak's Pikachu catch

Since V1d it is the catch demo shared with the Viridian old man (`BATTLE_TYPE_PIKACHU` /
`BATTLE_TYPE_OLD_MAN`), in `battle/catch_demo.ts` + `battle/catch_demo_screen.ts`. See
`battle/ARCHITECTURE.md` → *Catch demo*.

## Follower Movement

- `PikachuFollowBuffer` ports `wPikachuFollowCommandBuffer`: size is the newest index,
  $ff empty. Pop refuses zero/one entries; the newest command stays retained for idle.
  A 16-entry cap with a one-time warning guards native WRAM overflow; no teleport.
- `playerStepStarted(dir, ledge)` appends 1–4 normally. During a hop, bit 6 toggles:
  the first half appends 5–8 and the second appends nothing. Refresh never resets bit 6.
- Ordinary follow commands move one tile in eight 2px updates, or four 4px updates only
  when at least three entries remain after the pop (native size >= 2).
- Ledge commands target two tiles at once: eight 4px updates, no arc or shadow. Pikachu
  waits on the takeoff tile after the player lands, executing the hop on the next step.
- `refreshFollow(playerMapStep)` clears and seeds from the two sprites' map positions;
  spawn, font-loaded resets and `TryApplyPikachuMovementData`'s return use it.
- **Spawn states are read only at movement status 0** (`TrySpawnPikachu`): a Pikachu
  that is out keeps its position whatever `wPikachuSpawnState` says. After a heal,
  state 5 places only a starter that wasn't out (A6e).
- **Map position is its own state (A6e)**: MAPX/MAPY move as a follow command starts (two
  for a hop), and the pixels follow by the step vector each update. Font-loaded resets put
  the pixels back on the map position (`InitializeSpriteScreenPosition`).

## Scripted movement (A6e, `notes/14-a6e-plan.md`)

- `pikachu_movement.ts` ports `ApplyPikachuMovementData_`: the 63-record database and the
  sine table from `pikachu_movement.json`, both function tables, the two timers (and
  `PikaMovementFunc2_UpdateSpriteImageIdx`'s subtimer bug), the integer sine jump and its
  shadow bit. Each command iteration holds 2 frames; the `$3f` return holds 1.
- `startMovement` / `tickMovement` (the follower) hand Pikachu's sprite data to a run and
  write it back every frame; follow buffer, hop toggle and idle state are untouched. The
  interpreter's WRAM (base position, offsets) persists between calls.
- Callers own the rest: `tryPikachuMovement` (Viridian, Oak's Lab) is TryApply — starter
  out, Pikachu on the expected side by map position, refresh after the return frame; the
  nurse and the emotion preludes call Apply directly, with no refresh.
- During a call: the pass clock is held (main.ts), Pikachu is drawn above NPCs and the
  player (slot 0), its grass priority is the one latched at the call (zero under the
  shadow), and the shadow sits at the base position under every sprite pixel.
- The emotion preludes (`pikachu_emotion.ts`): entry turn → movement calls → border
  (Delay3, covered UpdateSprites, Delay3) → portrait. Cries and bubbles are not played.
- Door steps: the automatic step out of a door is an ordinary step for Pikachu
  (`PlayerStepOutFromDoor` just simulates a DOWN press), so it follows it like any other

## Idle and antics (A6c, `notes/10-a6c-plan.md` §6)

- **Three update paths.** `updateSprite(ctx)` is UpdateSprites (`SpawnPikachu_`): unless
  `WillPikachuSpawnOnTheScreen` passes (the sprite window, plus the UI footprint
  `pikachuCovered` when the context carries UI tiles) nothing runs and the image is
  hidden; an antic takes the update; else a move continues or starts, or Pikachu idles in
  the same call. `fontLoadedUpdate(ctx)` is the same routine with the font loaded, run
  once as a text box or menu opens (`overworld/ui_entry.ts`, review R-2): the screen
  check, then `Func_fc76a` (standing,
  back on its map position, ready, countdown 0, command reseeded). `startMovement` /
  `tickMovement` run the scripted-movement interpreter, which never idles and leaves the
  idle state as it was. Only real UpdateSprites advance the idle machine.
- **Talking to Pikachu** sets bit 7 (`requestFacePlayer`); `Func_fc745` serves it on the
  first update of either kind that finds Pikachu on screen (turn to the player, countdown
  0 or $80 on grass). The opening only turns Pikachu on the bare map (`openOverworldUi`);
  the emotion's movement prelude follows, then the border and its update, which hides
  Pikachu (review R-3, A6e).
- **Under UI** `render` hides the whole sprite when its footprint touches a box, from the
  first frame (`pikachuCovered` on `uiTiles`). A bounce covered once stays invisible to
  its end: `asm_fc87f` never redraws the image.
- **Retained command** (`followCommand`): the native buffer's newest byte —
  the spawn seed (`seedFollowCommand`: toward the player, Y first, 1–4 or 5–8, 0 on top),
  each step's 1–4, a ledge hop's 5–8 once (`recordStepForPikachu`); `clearBuffer` sets 0;
  movement calls add none. Idle reads it, never the last move's direction.
- **Spawn** (`spawn`, `spawnAtState`) runs `Func_fc793`: refresh, ready, countdown 0, image
  hidden until the next update.
- **A finished move** sets the live facing (`followEndFacing`,
  `ComputePikachuFacingDirection`): the newest command while moves remain, else toward the
  player by map position (Y first), or the player's facing on overlap. The image keeps the
  move's until the next update.
- **Idle** (`PikachuIdle.idle`): on the player's map position the image is hidden and
  nothing counts. Else the countdown byte drops; from 0 it wraps, so the first glance comes
  after 256 updates, then `Random & $0c` picks a facing and 32 more follow. With a retained
  5–8 the expiry starts an antic instead (`Random & 3`), whose first update runs at once.
- **Antics**: bounce 17 updates (`Pointer_fc8d6` read backward as (Y, X); live facing = the
  command's; the image stays as it was), walk in place 48 (frame +1 every 8), shuffle 32
  (frame ^1 every 8), spin 32 (clockwise every 8). A walking player ends any of them before
  its update; ending sets the countdown to 16. The bounce is a screen offset only: drawn and
  seen by collisions (`collisionSprite`), never the map position.
- **Animation counter**: Pikachu's ticks compare for equality (`WalkAnim.tickExact`), so an
  intra count left above the period by an interrupted antic holds the frame until it wraps.
- **Image latch**: `render` draws `imageFacing`/`imageFrame` only while `imageVisible`.
  Setting `direction` (scripts, talking to Pikachu) sets both.
- **Walking into Pikachu**: see `overworld/ARCHITECTURE.md` → *NPC movement and sprite
  collisions*.

## Spawning after a warp (`pikachu_spawn.ts`, V1b)

A port of Yellow's `wPikachuSpawnState` (`engine/pikachu/pikachu_follow.asm`).
`performWarpLoad` calls `warpSpawnState()` then `PikachuFollower.spawnAtState()`.

- **The states** (`CalculatePikachuPlacementCoords` / `CalculatePikachuFacingDirection`):

  | State | Where | Facing |
  |---|---|---|
  | 0 | on the player | copies the player |
  | 1 | right | copies the player |
  | 2 | behind | toward the player |
  | 3 | on the player | down |
  | 4 | below | copies the player |
  | 5 | above | toward the player |
  | 6 | left | copies the player |
  | 7 | in front | opposite the player |

  "On the player" keeps Pikachu's image hidden (`Func_fcae2`) until the player's map
  position moves off it (A6c; before that it was drawn under the player).
- **Which setter** (`home/overworld.asm` `WarpFound2`):
  - Leaving an outside map (OVERWORLD / PLATEAU tileset) → `SetPikachuSpawnOutside`,
    by the destination.
  - Else, a destination that's outside → `SetPikachuSpawnBackOutside`, by the source.
    This is the ASM's `LAST_MAP` case; no Yellow indoor map warps explicitly to an
    outside map, so the tilesets identify it exactly.
  - Else → `SetPikachuSpawnWarpPad`, by the destination.
  - Map connections always use state 2.
- **The per-map lists** are ported whole, including maps not extracted yet. Examples:
  Oak's Lab → left; the Forest gates and Route2Gate depend on the player's facing.
  Tests: `pikachu_spawn.test.ts`.

## Assembly References

- `engine/pikachu/pikachu_emotions.asm` — emotion display logic
- `data/pikachu/pikachu_pic_animation.asm` — animation script data
- `data/pikachu/pikachu_pic_objects.asm` — overlay object definitions
- `engine/pikachu/pikachu_follow.asm` — follower movement
