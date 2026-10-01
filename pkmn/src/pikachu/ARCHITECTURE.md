# Pikachu System Architecture

## Modules

| File | LOC | Purpose |
|------|-----|---------|
| `pikachu_follower.ts` | 224 | Pikachu following player: position buffer, movement, ledge hops, spawn/warp logic |
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
- Warp spawning: beside player (indoor entries) or on top (hidden until movement)

## Assembly References

- `engine/pikachu/pikachu_emotions.asm` — emotion display logic
- `data/pikachu/pikachu_pic_animation.asm` — animation script data
- `data/pikachu/pikachu_pic_objects.asm` — overlay object definitions
- `engine/pikachu/pikachu_follow.asm` — follower movement
