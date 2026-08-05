# UI Context — rendering, assets, shaders, audio

This is not a web app. There is no design system, no CSS framework, no component
library. The entire UI is drawn to one `<canvas>` through WebGL2, and its "design
tokens" come from the original game. Nothing here is a style preference — it is
fidelity to the C# reference.

Deep detail: `../ARCHITECTURE.md`. Slice-level tasks: `../PLAN.md` phases C, K, L.

## Theme

Pixel-faithful *Link's Awakening DX HD* at v2.0.2. No modern chrome, no added
labels, no helper text, no invented screens. If it is not in `ProjectZ.Core`, it
does not go on screen. Original quirks are reproduced deliberately — the upstream
project spent years restoring them, and `CHANGELOG.md` documents why.

## Rendering model

- **WebGL2**, not Canvas 2D. The game leans on 20 shader effects; Canvas 2D cannot
  do them (`../DECISIONS.md` #6).
- **Instanced sprite batching**, one draw call per texture. Target: 10k sprites at
  60 fps (slice C1).
- **Nearest-neighbour filtering everywhere.** No smoothing, ever. Add padding in
  atlases to prevent bleed at non-integer scales (slice C2).
- **Fixed timestep** for gameplay, decoupled from render. Logic assumes a fixed
  update rate — do not scale movement by a variable delta (slice A2).
- **Depth sorting is explicit** (slice C4). The C# assigns depth deliberately; a
  naive draw order looks subtly wrong everywhere and obviously wrong nowhere.
  Known example from the v2.0.0 notes: the sword draws in front of Link for some
  facings and behind for others.

## The two cameras — both are required

| Mode | Behavior |
|---|---|
| **Modern** | smooth follow, faster scroll (default) |
| **Classic** | screen-based scrolling, as on the Game Boy |

Classic Camera arrived in v1.4.3 and is heavily used — v2.0.2's headline change
was per-map-type camera configuration plus a boss-fight-specific swap. It is not
an optional extra; slice C6 implements it and E-phase transitions must respect it.
Transition speed is user-configurable.

## Asset formats and their rules

Full table in `../ARCHITECTURE.md`. What matters when you touch them:

- **`.png` (259 files)** — usable directly. Tileset width is load-bearing:
  tiles-per-row is derived from image width, so repacking or resizing a tileset
  silently scrambles every map that uses it. Verify against the C# first.
- **`.wav` (164)** — usable directly; convert to `.ogg` in the pipeline for size.
- **`.ani` (285)** — animation descriptors. Parser: slices B2–B3.
- **`.map` (131) + `.map.data`** — rooms and object placement. Slices B4–B6.
- **`.atlas` (21)** — sprite atlas indices. Slice B1.
- **`.lng` (33 in the tree, **6 shipped**)** — v1 is **English + Spanish only**
  (`../DECISIONS.md` #11); the loader stays generic and the filter lives in the
  asset pipeline. Slice B7. Dialogue must render with the variable-width font path
  (`smallFont_vwf`), not fixed-width — and that path must handle Spanish accented
  glyphs.
- **`.zScript` (1)** — the game's own scripting language. Lexer + parser: B10–B11;
  runtime: I3.
- **Fonts** — `.spritefont`/`.fnt`/`.ttf`. Bitmap glyph extraction in slice B12.
  **No CJK path in v1** — the Chinese fonts (`smallFont_chn*.fnt`) are dropped with
  the `chn` language, so B12 is Latin + variable-width only. Note the editor TTFs
  and the Chinese `.fnt` files are injected by the *Migrater*, not present in the
  original content tree.

**CRLF is load-bearing** in every text-based format above. Read and write bytes.
This broke the asset migration once already (`../DECISIONS.md` #5).

## Shaders — 20 files, HLSL → GLSL ES 3.00

Hand-translated across slices C7–C9, grouped by kind:

| Slice | Group | Files |
|---|---|---|
| C7 | colour | `ColorShader`, `DamageShader`, `SaturationFilter`, `LightFadeShader`, `ColorCloud` |
| C8 | blur | `BlurH/V`, `BBlurH/V`, `EffectBlur`, `RoundedCorner`, `RoundedCornerEffectBlur` |
| C9 | effects | `WobbleShader`, `ShockEffect`, `WaleShader`, `CircleShader`, `LightShader`, `FullShadowEffect`, `PixelGrid`, `Thanos` |

All are simple 2D post-effects, so translation is mechanical — but it is 20 of
them, and each needs a visual check against the C# original. `PixelGrid` is newer
(added around v1.9.0) and is a user-facing option, not decoration.

## Audio

- **Ship streamed audio first** (L1–L2): Web Audio graph, 164 SFX, music with
  crossfade. This is enough to play the whole game.
- **GB sound emulation is parked** (L3–L5). `GbsPlayer/` is a real Game Boy CPU +
  APU — `GameBoyCPUInstructions.cs` is 51 KB, `Sound.cs` 29.6 KB — and it exists
  only to drive *classic* music mode. It is self-contained; do not let it block
  the critical path.
- **`AudioWorklet`, not threads.** The C# runs audio on OS threads; the browser
  equivalent is a worklet (`../DECISIONS.md` #7). Never `SharedArrayBuffer`.

## Menus and HUD (phase K)

Sources: `InGame/Overlay` (24 files), `InGame/Pages` (28), `InGame/Interface` (13).
Scope for v1: HUD (hearts, items, rupees, keys), inventory with 4–6 assignable
buttons, map/minimap pages, file select with save slots including the **Purist**
preset, settings and presets, achievements and the photo album.

`MANUAL.md` is the player-facing feature list and is the fastest way to scope a
menu before opening the C#.

## Input

Keyboard + Gamepad API, abstracted to **action names** rather than key codes
(slice A5) so remapping and gamepads cost nothing later. Touch controls are out of
scope for v1; the upstream Android head is the reference if that opens up.
