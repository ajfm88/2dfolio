# Pikachu System Architecture

## Modules

| File | LOC | Purpose |
|------|-----|---------|
| `pikachu_follower.ts` | 217 | Pikachu following player: position buffer, movement, ledge hops, placement after a warp |
| `pikachu_spawn.ts` | 129 | Where Pikachu appears after a warp: Yellow's spawn states and the per-map lists (see below) |
| `pikachu_happiness.ts` | 274 | Happiness/mood state, emotion face selection (20 animation scripts), happiness modifiers |
| `pikachu_battle.ts` | 585 | Oak catches Pikachu cutscene: flash/collapse transition, auto-played battle with pokeball throw, shake, catch |
| `pikachu_emotion.ts` | 145 | Emotion face display: bordered box with animated 40x40 face, frame compositing |

## Happiness & Mood

- **State**: `pikachuHappiness` (0-255, default 90) and `pikachuMood` (0-255, default 128)
- **Face selection**: mood x happiness matrix maps to 1 of 20 animation scripts. Status overrides: SLP->sleeping face, other status->sick face
- **Modifiers**: LEVELUP (+5/+3/+2 tiered), FAINTED (-1), WALKING (+2/+1/+1 every 256 steps). Each nudges mood toward a target value.

## Emotion Animation

- Each script has a base face PNG + overlay PNG(s). Frame sequences alternate between base-only (delay) and base+overlay.
- 1 assembly tick = 3 game frames (~50ms). Sequences loop until duration expires or A/B pressed.
- Pikachu faces: `gfx/pikachu/unknown_eXXXX.png` (40x40, 2-bit grayscale)

## Pikachu Battle (Oak's Grass Cutscene)

Auto-played battle sequence triggered by `pikachuBattle` script command:
- `flash` -> `collapse` (black bars close in) -> `intro` ("Wild PIKACHU appeared!") -> `oak_throw` -> `ball_arc` -> `poof` -> `hit` -> `shake1/2/3` -> `caught` -> `ending`
- Returns `PikachuBattleAction` to main.ts when caught phase ends (fade transition back to script)

## Follower Movement

- Position buffer (max 16) records player's previous positions
- Pikachu pops positions from buffer and walks to them, using fast mode when behind
- Ledge hops: Pikachu waits at edge, hops on next player step (parabolic arc)
- Door steps: the automatic step out of a door is an ordinary step for Pikachu
  (`PlayerStepOutFromDoor` just simulates a DOWN press), so it follows it like any other

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

  "On the player" hides Pikachu under the player sprite (it's drawn first) until the
  player steps off.
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
