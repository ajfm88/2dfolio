# Renderer Architecture

## Canvas Rendering

Canvas is GB resolution (160x144) scaled to fit window. All drawing uses `* scale`.

- `loadTileset()`: remaps grayscale PNG -> 4-color CGB palette (color-corrected RGB555 from `sgb_palettes.asm` via `gbcCorrect()`)
- `loadSprite()`: same palette + OBP0 shade mapping, lightest color (index 0) becomes transparent
- `loadFont()`: 1-bit font — white->transparent, black->fixed `#181818` (palette-independent)
- Gray thresholds: >=192->palette 0, >=128->1, >=64->2, else->3

## CGB Color Palettes

- `palettes.ts` — 28 CGB palettes from `CGBBasePalettes` in `data/sgb/sgb_palettes.asm`, color-corrected via `gbcCorrect()`
- **14 location palettes**: ROUTE, PALLET, VIRIDIAN, PEWTER, CERULEAN, LAVENDER, VERMILION, CELADON, FUCHSIA, CINNABAR, INDIGO, SAFFRON, CAVE, TOWNMAP
- **10 monster palettes**: MEWMON, BLUEMON, REDMON, CYANMON, PURPLEMON, BROWNMON, GREENMON, PINKMON, YELLOWMON, GRAYMON. RIVAL uses REDMON (not BLUEMON!)
- **3 HP bar palettes**: GREENBAR (>50%), YELLOWBAR (>25%), REDBAR (<=25%)
- **1 title screen palette**: LOGO2 (yellow letters, deep blue shadows)
- Per-map palette via `getMapPalette(mapName)`. Indoor maps use parent town's palette.
- **Sprite OBP0**: shade mapping `[0,0,1,3]` via `OBP0_MAPPING` in renderer.ts (not identity like BGP)

## Sprite Formats

- **NPC/player sprites**: 16x96 PNG, 6 frames of 16x16. Layout: y=0 stand-down, y=16 stand-up, y=32 stand-left, y=48 walk-down, y=64 walk-up, y=80 walk-left. Right = left flipped. Rendered with -4px Y offset (`screenY = y - cameraY - 4`) matching original GB sprite positioning.
- **Heal machine sprite**: `gfx/overworld/heal_machine.png` — 8x16 PNG, 2 tiles: monitor at y=0, pokeball at y=8
- **Pokemon front sprites**: variable size (40x40 to 56x56), grayscale 2-bit
- **Pokemon back sprites**: 32x32, rendered at 2x in battle UI
- **Pikachu emotion faces**: 40x40, 2-bit grayscale in `gfx/pikachu/unknown_eXXXX.png`

## Key Files

| File | LOC | Purpose |
|------|-----|---------|
| `renderer.ts` | 383 | Canvas 2D API, tile/sprite drawing, scaling |
| `palettes.ts` | 157 | CGB color palettes (28 total: 14 location, 10 monster, 3 HP bar, 1 title) |
