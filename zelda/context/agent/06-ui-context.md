# UI Context — rendering, sprites, audio

This is not a web app. There is no design system, no CSS framework, no component
library. The entire UI is drawn to one `<canvas>` through Canvas 2D, and its
visual language comes from the original 1986 NES game.

Deep detail: `../ARCHITECTURE.md`. Slice-level tasks: `../PLAN.md` phases C, J, K.

## Theme

Pixel-faithful NES *Legend of Zelda*. No modern chrome, no added labels, no helper
text, no invented screens. If it's not in the original NES game, it doesn't go on
screen. The disassembly is the visual authority.

## Rendering model

- **Canvas 2D**, not WebGL2. The NES game has no shader effects — just sprites,
  tiles, and palette swaps (`../DECISIONS.md` #3).
- **Internal resolution: 256×240 pixels.** Scaled to fill the viewport with
  `image-rendering: pixelated` for crisp nearest-neighbor upscaling.
- **Layout:** HUD occupies the top 64 pixels (256×64). Play area is the bottom
  176 pixels (256×176) = 16×11 tiles at 16×16 each.
- **Fixed timestep** for gameplay (60 fps NTSC). Logic assumes a fixed update
  rate — do not scale movement by a variable delta.
- **Draw order:** background tiles → object sprites (depth-sorted by Y position)
  → HUD overlay. Enemies behind Link when above him, in front when below.

## Screen transitions

The original NES scrolls the entire play area when Link walks off-screen:

- **Horizontal:** ~32 frames, play area slides left/right
- **Vertical:** ~32 frames, play area slides up/down
- **During scroll:** Link continues walking in the transition direction
- **No diagonal transitions.** One axis at a time only.

Reference: humbertodias and Matthew-SA repos both implement this.

## Sprites

Sprite sheets from reference repos, organized in `public/assets/sprites/`:

- **Link:** 4-direction walk cycle (2 frames each), sword swing (4 directions),
  sword beam, shield, pickup pose, damage flash, death spin
- **Enemies:** each type has directional variants + attack frames + death poof
- **Bosses:** multi-frame attack patterns, damage states
- **Items:** pickup sprites, inventory icons, in-world representations
- **Effects:** explosions, sword slash, projectile impacts, sparkles

**Colour:** NES palette. Link is green (default), white (blue ring), red
(red ring). Enemies have red/blue variants (different stats, same sprite
recoloured).

## HUD (top 64 pixels)

```
┌────────────────────────────────────────────────────┐
│  INVENTORY       -LIFE-                            │
│  B [item]  A     ♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥               │
│            □     (half-heart granularity)           │
│  ×XX RUPEES       [minimap]                        │
│  ×XX KEYS                                          │
│  ×XX BOMBS                                         │
└────────────────────────────────────────────────────┘
```

- **Hearts:** 3 starting → 16 max (half-heart granularity)
- **Rupees:** 0–255
- **Keys:** per-dungeon count (or Magic Key = infinite)
- **Bombs:** 0→8 (upgradeable to 12, then 16)
- **Minimap:** overworld = dot on 16×8 grid; dungeon = explored rooms
- **Item slots:** B button = equipped item; A button = always sword

## Inventory subscreen

Opens on Start. Shows all collected items in a grid. D-pad to select, Start to
equip to B button. Items greyed out until acquired. Sword upgrades show current
tier. Map and Compass show dungeon layout when in a dungeon.

## Audio

- **Web Audio API** for both SFX and music.
- **SFX** (~30): sword swing, sword beam, bomb place/explode, item pickup,
  rupee collect, damage taken, enemy hit, enemy death, secret reveal, door unlock,
  low health warning beep, text crawl, stairs, shield block, boomerang throw,
  arrow fire, candle fire, recorder play, fairy heal.
- **Music** (~10 tracks): title, overworld, dungeon, final dungeon, boss fight,
  game over, ending/credits, item fanfare, fairy fountain, triforce.
- Music transitions: immediate cut on screen type change (overworld → dungeon),
  brief fanfare interrupts then resumes (item pickup).

Source: reference repos (bobbylight has the most complete audio set with ~30 WAV
SFX + OGG music).

## Input

Keyboard + Gamepad API, abstracted to **action names** (slice A4):

| Action | Default key | NES equivalent |
|---|---|---|
| `up/down/left/right` | Arrow keys / WASD | D-pad |
| `attack` | X / Space | A button (sword) |
| `item` | Z | B button (equipped item) |
| `start` | Enter | Start (pause / inventory) |
| `select` | Shift | Select (not used in-game on NES) |

Gamepad mapping follows Xbox layout: A=attack, B/X=item, Start=start.
