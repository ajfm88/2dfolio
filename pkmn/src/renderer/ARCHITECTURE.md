# Renderer Architecture

A5d CP3 adds `captureNative(draw)` (native 160×144 target with context/scale restored in finally) and
`captureSpriteDraws(draw)` (scoped draw descriptors preserving an outer log). They do not capture the main
surface or clear UI coverage. CP4's `getLoadedRawImageData` reads the raw cache synchronously and throws if
the actor's awaited loadSprite has not preloaded it. No runtime ROM call. `overworldObjectPalettes` holds
the normal FadePal4 OBJ registers ($d0/$e0); loadSprite uses its OBP0, and transition capture samples both
at tick 0. Blocking intro/healing scenes retain their own temporary registers and restore before returning.
`overworld/transition_screen_render.ts` captures only GameMap.render, freezes raw OBJ frame indices/offsets,
then renders captured-cell crops -> exact BGP pass -> frozen OBJ through OBP0/1, with OAM priority and a black
hold. Captured origin 255 is distinct from the FF tile sentinel. No clocks advance during rendering. A raw
sheet is required: an already colourized OBP canvas cannot recover the original colour indices. Note 65 §10.13.

## Battle intro scanout foundations (checked2026-11-03)

`battle/battle_screen_render.ts` now accepts03a's default-null `BattleScreen.scxAfterSplit`. With `scxSplit`
active, top lines0–63 use `scx`,64–95 use `scxSplit`,96–143 use `scxAfterSplit ?? scx`; with null split the lower
override is ignored. Zero is a valid override. Both aligned-tile and pixel paths use this selection, retain256px
BG wrap/source attribute lookup and leave the window and OBJ unscrolled. Rendering advances no game clock.
No production caller enables the new field; bundle support costs72 bytes with existing behavior preserved.

03b's unused `BattleIntroTiming` separates physical rSCX, HRAM and captured scanout bands. Its observer must
freeze earlier rows before source writes or VBlank's scroll/BG/OAM latches; the final LY96 window change
affects only the remaining48 rows. The new Program is not integrated with the live driver yet. Entry phase,
capture, masked-LCD versus palette-held audio and real text/DIV integration are04's next trace/brief work,
not something `renderBattleScreen` should tick. See `battle/ARCHITECTURE.md` → *A5e foundations* and note77 §3/§9.

## Canvas Rendering

Canvas is GB resolution (160x144) scaled to fit window. All drawing uses `* scale`.

- `loadTileset()`: remaps grayscale PNG -> 4-color CGB palette (color-corrected RGB555 from `sgb_palettes.asm` via `gbcCorrect()`)
- `loadSprite()`: same palette + OBP0 shade mapping, lightest color (index 0) becomes transparent
- `loadSpriteMapped()`: explicit `obpMapping(reg)`, cached by URL/palette/mapping; colour 0 stays transparent. Healing-machine OBP1 swaps $e0 `[0,0,2,3]` and $c8 `[0,2,0,3]` instead of dimming. Normal `loadSprite` retains $d0/OBP0.
- `loadFont()`: 1-bit font — white->transparent, black->fixed `#181818` (palette-independent)
- Gray thresholds: >=192->palette 0, >=128->1, >=64->2, else->3

## Intro palette shades (note 64 CP3; speech wiring is CP4)

`palette_shades.ts` shares `dmgShadeMapping(register)` with `obpMapping`. `remapBgShades` matches each already
colourized pixel exactly to the active palette (and #181818 font ink as index 3), then selects the BGP shade.
MEWMON's #191919 remains a separate exact input. Unknown or ambiguous colours throw; $E4 skips all reads/writes,
preserving normal font pixels. `applyBgShades` applies this to the native canvas once, before OBJ drawing.
Other fades keep their existing renderer paths.

`menus/intro_screen_render.ts` clips/translates the entire window by WX−7, draws the intro model's visible cells
and current picture slots, shades BG/window, then invokes its OBJ callback. Rendering advances no clocks.
`prepareIntroPicture` pads to 56×56 with the ASM's center/bottom alignment and optionally flips pixels within
each tile; `IntroScreen.placePicture(true)` reverses the columns separately. Together they mirror Pikachu once.
`introPictureCanvas` wraps those already colourized pixels without mutating the source. CP4 owns asset preloading
and the `loadSpriteMapped` variants for its stored OBP0 register.

## CGB Color Palettes

- `palettes.ts` — 28 CGB palettes from `CGBBasePalettes` in `data/sgb/sgb_palettes.asm`, color-corrected via `gbcCorrect()`
- **14 location palettes**: ROUTE, PALLET, VIRIDIAN, PEWTER, CERULEAN, LAVENDER, VERMILION, CELADON, FUCHSIA, CINNABAR, INDIGO, SAFFRON, CAVE, TOWNMAP
- **10 monster palettes**: MEWMON, BLUEMON, REDMON, CYANMON, PURPLEMON, BROWNMON, GREENMON, PINKMON, YELLOWMON, GRAYMON. RIVAL uses REDMON (not BLUEMON!)
- **3 HP bar palettes**: GREENBAR (>50%), YELLOWBAR (>25%), REDBAR (<=25%)
- **1 title screen palette**: LOGO2 (yellow letters, deep blue shadows)
- Per-map palette via `getMapPalette(mapName)`. Indoor maps use parent town's palette.
- DiglettsCave and DiglettsCaveRoute11 use CAVE (V4 checkpoint-02). `SetPal_Overworld` selects `PAL_CAVE` for the CAVERN tileset before it reads the map id. DiglettsCaveRoute2 already used CAVE.
- **Sprite OBP0**: shade mapping `[0,0,1,3]` via `OBP0_MAPPING` in renderer.ts (not identity like BGP)

## Sprite Formats

- **NPC/player sprites**: 16x96 PNG, 6 frames of 16x16. Layout: y=0 stand-down, y=16 stand-up, y=32 stand-left, y=48 walk-down, y=64 walk-up, y=80 walk-left. Right = left flipped. Rendered with -4px Y offset (`screenY = y - cameraY - 4`) matching original GB sprite positioning.
- **Still NPC pictures**: 16x16 PNG, row 0 and no flip for every facing/animation
  (PrepareOAMData entry 0). Since A5b5c the extractor reads four tiles for these
  and 24 for walkers, using the shared A5b2 class/size check. NPC loading rejects
  heights other than 16/96; nurse bow rows are retained. Party BALL/HELIX icons
  use row 0 and stay unchanged.
- **Heal machine sprite**: `gfx/overworld/heal_machine.png` — 8x16 PNG, 2 tiles: monitor at y=0, pokeball at y=8
- **Pokemon front sprites**: variable size (40x40 to 56x56), grayscale 2-bit
- **Pokemon back sprites**: 32x32, rendered at 2x in battle UI
- **Pikachu emotion faces**: 40x40, 2-bit grayscale in `gfx/pikachu/unknown_eXXXX.png`

## Shared screen model

`screen_model.ts` owns the 20×18 tile map (`TileMap`: wTileMap, the shown copy, and AutoBgMapTransfer's six-row third), `CopyVideoData`'s queue (`VideoCopyQueue`: eight tiles a serviced frame, the transfer byte restored, an immediate LCD-off path) and the standalone message-box capture (`captureTextBox`). Since checkpoint-02, `IntroScreen`, `TransitionScreen` and `BattleScreen` are built on it. Each keeps its own registers, VRAM, OAM and VBlank order. The three renderers are unchanged.

## Key Files

| File | LOC | Purpose |
|------|-----|---------|
| `renderer.ts` | 383 | Canvas 2D API, tile/sprite drawing, scaling |
| `palettes.ts` | 157 | CGB color palettes (28 total: 14 location, 10 monster, 3 HP bar, 1 title) |
