# Progress Tracker — THE live handoff log

> **Every agent, every session: read this file FIRST and update it LAST.**
> This is the only file that records what is actually happening. If you skip
> the update, the next agent restarts from zero and wastes the user's credits.
>
> Deep reference lives in `../ARCHITECTURE.md`, `../DECISIONS.md`,
> `../CONVENTIONS.md`, `../PLAN.md`. This file is state, not knowledge —
> put facts there, put status here.

**Project:** zelda-nes — *The Legend of Zelda (NES)* as native TypeScript in the
browser.
**Working dir for all commands:** `zelda-nes-ts/`

**Last updated:** 2026-08-12 · **Phase:** D (Player & Combat) in progress · **Slices done:** 16 / 45

---

## ⚠ Read this before planning anything

This is a **reimplementation from reference**, not a port or emulator. You read
6502 assembly (the disassembly) and TypeScript/C#/JS (the reference repos) and
write TypeScript by hand. Nothing is transpiled; nothing is emulated.

**Next action: slice D3** — Shield: block projectiles when facing them. Push/pull
mechanics.

---

## What is ready and verified (2026-08-02)

| Thing | Path | State |
|---|---|---|
| NES disassembly | `zelda1-disassembly-master/` | ✅ 39,600 lines, 100% coverage |
| Disasm labels | `zelda1-disasm-labels-master/` | ✅ Mesen .mlb, 8K-line RAM dictionary |
| TypeScript reference | `ZeldaJS-master/` | ✅ best browser architecture |
| C# reference | `zelda-clone-master/` | ✅ best combat/boss patterns |
| JS references (3) | `game-zelda-js-master/`, `zelda-js-master/`, `Legend-Of-Zelda-Javascript-main/` | ✅ sprites, maps, patterns |
| Context system | `context/` | ✅ 15 files written |
| TS project | `zelda-nes-ts/` | ✅ scaffolded (A1) |
| Renderer | `src/render/renderer.ts` | ✅ Canvas 2D, integer-scaled, HUD/play area split (A2) |
| Assets | `public/assets/` | ✅ 62 files: 19 sprites, 7 tiles, 3 UI, 3 maps, 30 SFX, 2 music (A3) |
| Asset manifest | `src/data/asset-manifest.ts` | ✅ typed manifest + loader (A3) |
| Input system | `src/core/input.ts` | ✅ InputManager: keyboard + Gamepad API, action-name abstraction, remappable, edge detection (A4) |
| Debug overlay | `src/core/debug-overlay.ts` | ✅ DebugOverlay: backtick toggle, FPS counter, input states, placeholder coords/entities (A5) |
| Overworld data | `src/data/overworld.json` | ✅ 128 screens × 11×16 tile grids + square table, extracted from ROM + disassembly (B1) |
| Dungeon data | `src/data/dungeons.json` | ✅ 4 level blocks × 128 rooms, 42 unique room tile grids, 2 cellars, 9 dungeon metadata entries (B2) |
| Enemy spawns | `src/data/enemy-spawns.json` | ✅ 83 object types, 30 heterogeneous lists, 4 spawn position lists, 128 OW spawn entries, OW foeCounts (B3) |
| Item tables | `src/data/items.json` | ✅ 36 item names, drop tables (4×10), 20 cave/shop inventories with prices, cave types, OW heart container, 7 secret Armos, 11 flute secrets, 38 HP pairs, money game data (B4) |
| Dungeon positions | `src/data/dungeons.json` | ✅ updated: added itemPositionIndex per room + shortcutOrItemPositions per dungeon (B4) |
| Sprite animation | `src/data/sprites.json` | ✅ core animation system (127 anim indices, 204-entry frame/attr heaps), 95 object type attrs, Link head tiles, 37 item frame offsets + 48 tiles, weapon directional tables, boomerang 9-frame cycle, bomb cloud offsets, 7 boss sprite layouts (Aquamentus/Dodongo/Digdogger/Gleeok/Ganon/Patra/Manhandla), enemy anim timing (Leever/Wallmaster) (B5) |
| Tile renderer | `src/render/tile-renderer.ts` | ✅ TileRenderer: renders 16×11 play area from overworld.json + overworld-map.png, per-screen palette-correct tiles, arrow-key navigation across all 128 screens (C1) |
| Sprite renderer | `src/render/sprite-renderer.ts` | ✅ SpriteSheet: sprite sheet extraction with auto transparency key, flip/mirror support. WalkAnimationController: NES-faithful 2-frame walk cycle (6-frame counter). directionToSpriteCol mapping. Link sprite animates on screen (C2) |
| HUD / status bar | `src/ui/hud.ts`, `src/ui/bitmap-font.ts`, `src/ui/heart-meter.ts` | ✅ HudRenderer: hud.png background, BitmapFont (9×7 cells, 26-col font sheet), HeartMeter (full/half/empty from treasures-full.png), formatCount (NES "X23"/"123" format), overworld minimap dot (green 3×3, NES-accurate position formula), counter text at NES PPU nametable positions (C3) |
| Screen transition | `src/world/screen-transition.ts` | ✅ ScreenTransition: 4-direction push-scroll, NES-accurate timing (H: 64 frames/4px, V: 44 frames/176px), old+new screen offset math, canvas clip rect prevents HUD overlap, input blocked during scroll, Link walk-animates during transition (C4) |
| Tile collision | `src/world/collision.ts` | ✅ TileCollisionMap: walkability from overworld.json squareTable.primary using NES $8D threshold, position→tile lookup, 4-corner rect check, off-screen returns true (D1) |
| Link entity | `src/objects/player/link.ts` | ✅ Link class: NES QSpeed movement (1.5px/frame via sub-pixel accumulator), 4-direction input, 8×8 hitbox at feet, tile collision, screen-edge detection, perpendicular grid snapping, walk animation, transition walkForward support (D1). Sword swing + beam integrated (D2) |
| Sword swing | `src/objects/player/sword.ts` | ✅ SwordSwing: 16-frame state machine (Windup 5f → Extended 8f → Retracting 3f), directional hitbox during Extended, NES-accurate position offsets from disassembly PlayerToWeaponOffsetsX/Y, shouldFireBeam at Extended→Retracting transition (D2) |
| Sword beam | `src/objects/player/sword-beam.ts` | ✅ SwordBeam: projectile at QSpeed $C0 (3px/frame), deactivates on blocked tile or screen edge, 8×8 hitbox, 4-frame animation cycling (D2) |

---

## Queue — next 8 slices

Claim the top one, finish it, log it, stop. Full list of 45 in `../PLAN.md`.

| # | Slice | Notes |
|---|---|---|
| ~~1~~ | ~~**A1** Scaffold project~~ | ✅ done 2026-08-03 |
| ~~2~~ | ~~**A2** Canvas + game loop~~ | ✅ done 2026-08-04 |
| ~~3~~ | ~~**A3** Asset curation~~ | ✅ done 2026-08-04 |
| ~~4~~ | ~~**A4** Input system~~ | ✅ done 2026-08-05 |
| ~~5~~ | ~~**A5** Debug overlay + test harness~~ | ✅ done 2026-08-05 |
| ~~6~~ | ~~**B1** Overworld map data~~ | ✅ done 2026-08-05 |
| ~~7~~ | ~~**B2** Dungeon room data~~ | ✅ done 2026-08-06 |
| ~~8~~ | ~~**B3** Enemy spawn tables~~ | ✅ done 2026-08-06 |
| ~~9~~ | ~~**B4** Item tables~~ | ✅ done 2026-08-07 |
| ~~10~~ | ~~**B5** Sprite animation data~~ | ✅ done 2026-08-08 |
| ~~11~~ | ~~**C1** Tile renderer~~ | ✅ done 2026-08-09 |
| ~~12~~ | ~~**C2** Sprite renderer + animation~~ | ✅ done 2026-08-10 |
| ~~13~~ | ~~**C3** HUD / status bar~~ | ✅ done 2026-08-11 |
| ~~14~~ | ~~**C4** Screen transition~~ | ✅ done 2026-08-11 |
| ~~15~~ | ~~**D1** Link movement~~ | ✅ done 2026-08-12 |
| ~~16~~ | ~~**D2** Sword attack~~ | ✅ done 2026-08-12 |
| 17 | **D3** Shield | block projectiles, push/pull mechanics |

**Phase A gate:** blank canvas renders at a stable 60 fps, `npm run typecheck` and
`npm test` clean, sprites load from `public/assets/`.

---

## Open questions for the user

Answer cheaply, unblock later work. **None of these block A1.**

1. **Asset gaps.** If a reference repo lacks a sprite we need, should we extract
   from another repo, create manually, or defer?
2. **Second Quest priority.** Currently the last slice (L2). Move it earlier?
3. **Music source.** Reference repos have some OGG/MP3 tracks. Sufficient?

---

## Notes worth carrying

- **The disassembly is the behavioral authority.** The reference repos are all
  incomplete (5–35%) and may have bugs. Use them for patterns, not behavior.
- **Data-driven design.** All map data, enemy tables, item tables in JSON. This is
  what makes Second Quest a data swap, not a code fork.
- **Canvas 2D, not WebGL2.** The NES game has no shader effects. Canvas 2D with
  `image-rendering: pixelated` gives pixel-perfect nearest-neighbor scaling.
- **Reference repos surveyed** (2026-08-02): aldonunez (100%), bobbylight
  (15–20%), hfiggs (30–35%), humbertodias (15%), Matthew-SA (10–15%),
  jdr81394 (5–10%).

---

## Session log

Newest first. Keep entries to one short paragraph. Archive to `../PROGRESS.md`
once this passes ~10 entries.

### 2026-08-12 — D2 Sword attack (Claude Opus 4.6)

Created `src/objects/player/sword.ts` — SwordSwing class with 16-frame state
machine matching Z_07.asm UpdateSwordOrRod: Windup (5f, attack pose, no sword
drawn) → Extended (8f, sword fully out, hitbox active) → Retracting (3×1f,
sword pulls back). Position offsets from disassembly PlayerToWeaponOffsetsX/Y.
Hitbox dimensions from ZeldaJS: 24×32 vertical, 32×24 horizontal. Created
`src/objects/player/sword-beam.ts` — SwordBeam projectile at QSpeed $C0
(3px/frame), deactivates on blocked tile or screen edge, 4-frame animation
cycling for palette flash. Updated Link class: Attack input (X/Space) starts
sword swing, movement frozen during swing, attack sprite row (row 2) used,
sword beam fires at Extended→Retracting transition when health is full. Added
hasSword/health/maxHealth properties (hardcoded to true/6/6 for now; inventory
F1 and damage D4 will provide real values). 28 new tests (456 total). Typecheck
clean. **Next: D3.**

### 2026-08-12 — D1 Link movement (Claude Opus 4.6)

Created `src/world/collision.ts` — TileCollisionMap class deriving walkability
from overworld.json squareTable.primary NES metatile values against threshold
$8D (141). 16 of 56 tile indices are walkable. Provides isPositionWalkable
(pixel→tile lookup, off-screen returns true) and isRectWalkable (4-corner
check). Created `src/objects/player/link.ts` — Link class with NES-faithful
QSpeed movement system (sub-pixel accumulator, $60 applied 4×/frame → 1.5
px/frame average alternating 1/2px pattern). 8×8 collision hitbox at lower
center (x+4, y+8). Per-pixel movement loop: checks screen edge before tile
collision, returns `screenEdge` direction when Link walks off. Perpendicular
grid snapping (1px/frame toward nearest 8px line, within 3px threshold,
collision-checked). Rewired main.ts: replaced stub arrow-key navigation with
real Link.update() → screen-edge-triggered transitions. Fixed entry position
bug: Link now enters at the opposite screen edge (SCREEN_EDGE_RIGHT for left
transition, etc.) instead of `posX + SCREEN_WIDTH` which could land Link on
blocked tiles. Added 13 new constants to constants.ts. 37 new tests (428
total). Typecheck clean. **Phase D started. Next: D2.**

### 2026-08-11 — C4 Screen transition (Claude Opus 4.6)

Created `src/world/screen-transition.ts` — ScreenTransition class managing
push-scroll animation between overworld screens. NES-accurate timing from
Z_05.asm ScrollWorld: horizontal = 4px/frame × 64 frames (256px), vertical =
4px/frame × 44 frames (176px). Stores direction, old/new screen references,
and offset. getOldScreenOffset/getNewScreenOffset return per-direction translate
values: Right=(-offset,0)/(256-offset,0), Left=(+offset,0)/(-256+offset,0),
Down=(0,-offset)/(0,176-offset), Up=(0,+offset)/(0,-176+offset). Updated
main.ts: replaced instant screen swap with animated transition. Arrow key
triggers startTransition() which saves old screen, computes new screen coords
(with wrapping), creates ScreenTransition. During transition: update advances
offset, input is blocked, Link walk-animates. Render uses ctx.save/clip/
translate/restore to draw both screens at their offsets within a clip rect
(prevents tiles from drawing over HUD during vertical scroll). Link is drawn
on the new screen at its offset. On completion: transition cleared, Link
position reset to center. Exported isHorizontal() helper. 23 new tests
(391 total). Typecheck clean. Visually verified: horizontal scroll shows both
screens sliding with correct offset, HUD stays fixed, transition completes to
new screen. **Phase C complete. Next: D1.**

### 2026-08-11 — C3 HUD / status bar (Claude Opus 4.6)

Created 3 new files in `src/ui/`: `hud.ts` (HudRenderer class + HudState
interface + formatCount), `bitmap-font.ts` (BitmapFont class wrapping SpriteSheet
for the 9×7 cell font.png, charToIndex mapping matching ZeldaJS), `heart-meter.ts`
(HeartMeter class + computeHearts with NES-faithful half-heart granularity from
Z_01.asm FormatHeartsInTextBuf). HUD draws hud.png background at (0,0), then
overlays dynamic values: hearts at (176,40) with 8px step and 2-row support for
16 max containers, rupee/key/bomb counters at NES PPU nametable positions
(96,24)/(96,40)/(96,48) using "X23"/"123" format, overworld minimap green dot
(3×3, #83d313) at x=17+col*4, y=24+row*4 matching NES UpdatePlayerPositionMarker.
Magic key support ("XA" display). Updated main.ts: replaced placeholder orange
HUD bar with HudRenderer initialized from assets (hud.png, font.png,
treasures-full.png), passes static HudState with 3 hearts and minimap tracking
screenRow/screenCol. Bug fix during session: font cell size was 9×7 not 8×8
(discovered from ZeldaJS LoadingState: `addSpriteSheet('font', ..., 9, 7, 0, 0)`).
37 new tests (368 total). Typecheck clean. Visually verified: HUD background,
hearts, counters, minimap dot movement, Link sprite + tiles unaffected.
**Next: C4.**

Older sessions archived → `../PROGRESS.md` (A1–C2, 2026-08-02 through 2026-08-10).
