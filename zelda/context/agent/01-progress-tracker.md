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

**Last updated:** 2026-08-15 · **Phase:** D (Player & Combat) complete · **Slices done:** 19 / 45

---

## ⚠ Read this before planning anything

This is a **reimplementation from reference**, not a port or emulator. You read
6502 assembly (the disassembly) and TypeScript/C#/JS (the reference repos) and
write TypeScript by hand. Nothing is transpiled; nothing is emulated.

**Next action: slice E1** — Overworld map loading + screen-to-screen scrolling
transitions.

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
| Collision utils | `src/core/collision-utils.ts` | ✅ rectsOverlap (AABB), getOppositeDirection (XOR trick) (D3) |
| Shield system | `src/objects/player/shield.ts` | ✅ canShieldBlock: NES-faithful 2-tier shield (small blocks rocks/arrows/boomerangs, magic also blocks fireballs/magic), unblockable types ($56/$5A), direction+idle checks. ShieldDeflection bounce visual. ProjectileType enum with all 10 NES IDs (D3) |
| Enemy projectile | `src/objects/projectiles/enemy-projectile.ts` | ✅ EnemyProjectile: Flying/Deflected/Dead states, QSpeed movement (3px/frame), deflect() method for shield bounce, 8×8 hitbox (D3) |
| Push block | `src/world/push-block.ts` | ✅ PushBlock: 3-state machine (Idle/Moving/Done) from Z_04.asm UpdateBlock. 16-frame push timer, alignment+direction checks, 16px slide at 1px/frame. pushComplete flag for secret triggers (D3) |
| Damage tables | `src/core/damage-tables.ts` | ✅ ObjTypeToDamagePoints (93 entries from Z_01.asm), decodeDamage (nibble split), calculateDamage (ring reduction via 16-bit shift). Full enemy+projectile damage table (D4) |
| Damage system | `src/objects/player/link.ts` | ✅ LinkState enum (Normal/Knockback/Invincible), takeDamage() with NES-faithful knockback (32px at 4px/frame from Z_07.asm Obj_Shove), invincibility timer (24 ticks × 2 frames from Z_01.asm BeginShove), visibility flash (timer & 0x03), ring reduction (blue=÷2, red=÷4), isDead flag, sword cancel on hit, isIdle accounts for state (D4) |
| Game mode | `src/core/game-mode.ts` | ✅ GameMode enum (Gameplay/DeathAnimation/GameOver), switches game state in main.ts update/render loops (D5) |
| Death animation | `src/death/death-animation.ts` | ✅ DeathAnimation: 7-phase sequence matching NES Mode $11 — Flash (33f grayscale), Spin (80f: 4 rotations × 4 dirs × 5f per Z_05.asm:2607), PaletteFade (40f: 4 steps red overlay), GreyPause (24f), Spark (15f: small→big arc), BlankPause (46f), GameOverText (96f: "GAME OVER" via BitmapFont). ~334 frames total (D5) |
| Game over screen | `src/death/game-over-screen.ts` | ✅ GameOverScreen: CONTINUE/SAVE/RETRY menu per Z_05.asm Mode $08, Select cycles cursor, Start triggers 64-frame confirm flash with 4-frame toggle, `>` cursor from BitmapFont charToIndex (D5) |
| Respawn | `src/death/respawn.ts` | ✅ computeRespawnParams(): overworld respawn at screen (7,7), X=$78, Y=LINK_START_Y, facing Up, 3 hearts per Z_07.asm:1442 InitMode3_Sub1. Dungeon stub for H1 (D5) |
| Link reset | `src/objects/player/link.ts` | ✅ reset() method: clears isDead/state/knockback/invincibility/sword/beam, sets position/direction/health for respawn (D5) |

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
| ~~17~~ | ~~**D3** Shield + push block~~ | ✅ done 2026-08-13 |
| ~~18~~ | ~~**D4** Damage system~~ | ✅ done 2026-08-14 |
| ~~19~~ | ~~**D5** Death + respawn~~ | ✅ done 2026-08-15 |
| 20 | **E1** Overworld map loading | screen-to-screen scrolling transitions |

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

### 2026-08-15 — D5 Death + respawn (Claude Opus 4.6)

Created `src/core/game-mode.ts` — GameMode enum (Gameplay/DeathAnimation/GameOver)
for main.ts state switching. Created `src/death/death-animation.ts` — DeathAnimation
class with 7-phase sequence matching NES Mode $11 (Z_05.asm:2039-2718): Flash (33
frames, grayscale via ctx.filter), Spin (80 frames: 4 rotations × Down→Right→Up→Left
at 5 frames each per Z_05.asm:2607), PaletteFade (40 frames: rgba red overlay in 4
steps), GreyPause (24 frames), Spark (15 frames: small/big arc), BlankPause (46
frames), GameOverText (96 frames: "GAME OVER" via BitmapFont). Created
`src/death/game-over-screen.ts` — GameOverScreen with CONTINUE/SAVE/RETRY per
Z_05.asm Mode $08: Select cycles cursor, Start triggers 64-frame confirm flash
(4-frame toggle interval). SAVE/RETRY stub to CONTINUE (TODO J1/L1). Created
`src/death/respawn.ts` — computeRespawnParams() pure function per Z_07.asm:1442:
overworld respawn at screen (7,7), X=$78, Y=LINK_START_Y, Direction.Up, 3 full
hearts. Dungeon respawn stubbed (TODO H1). Added reset() to Link class clearing all
state for respawn. Restructured main.ts: extracted updateGameplay(), added GameMode
switch in update/render, death detection after link.update(), handleRespawn() with
deathCount (capped $FF). Added 20 death/respawn constants to constants.ts. 33 new
tests (581 total). Typecheck clean. Visually verified: death animation plays through
all phases, "GAME OVER" text appears, continue menu renders with cursor.
**Phase D complete. Next: E1.**

### 2026-08-14 — D4 Damage system (Claude Opus 4.6)

Created `src/core/damage-tables.ts` — full ObjTypeToDamagePoints table (93 entries
from Z_01.asm line 5574) with `decodeDamage()` (nibble split: high=partial heart,
low=full hearts) and `calculateDamage()` (ring reduction via 16-bit right shift
matching Z_01.asm Link_BeHarmed: blue ring=÷2, red ring=÷4, minimum 1 half-heart
for non-zero damage). Updated `src/objects/player/link.ts` with `LinkState` enum
(Normal/Knockback/Invincible), `takeDamage(damageRaw, sourceDirection)` method:
sets knockback (32px at 4px/frame per Z_07.asm Obj_Shove/ShoveMoveMin), starts
invincibility timer ($18=24 ticks, decremented every 2 frames per Z_07.asm
DecrementInvincibilityTimer = 48 frames total), cancels active sword swing,
clears sword beam. Knockback movement: 4px/frame in opposite direction, stops on
wall tiles or screen boundary. Invincibility flash: `isVisible` toggles via
`timer & 0x03` (NES palette cycle from Z_01.asm Anim_WriteSpritePair). Updated
`isIdle` to account for knockback/invincible states (shield blocking disabled).
Added `cancel()` to SwordSwing. Wired damage into `main.ts`: invincibility guard
on projectile collision, damage lookup from DAMAGE_TABLE, HUD reads live
`link.health`/`link.maxHealth` (was hardcoded to 6). Added constants:
LINK_KNOCKBACK_DISTANCE, LINK_KNOCKBACK_SPEED, LINK_INVINCIBILITY_TICKS,
LINK_INVINCIBILITY_FLASH_MASK. 46 new tests (548 total). Typecheck clean.
Visually verified: projectile hits → knockback right → hearts decrease → Link
flashes → invincibility prevents double-hit → 0 health sets isDead. **Next: D5.**

### 2026-08-13 — D3 Shield + push block (Claude Opus 4.6)

Created `src/core/collision-utils.ts` — shared AABB `rectsOverlap()` and
`getOppositeDirection()` (XOR trick: Direction enum Up=0↔Down=1, Left=2↔Right=3).
Created `src/objects/player/shield.ts` — NES-faithful shield deflection from
Z_01.asm CheckLinkCollision: `canShieldBlock()` pure function with 2-tier system
(small shield blocks Rock/RockVariant/Arrow/EnemyBoomerang, magic shield also
blocks Fireball/SwordShot/MagicShot/MagicShot2), unblockable types
(Fireball2Unblockable $56, UnblockableShot $5A), direction-facing check
(Link must face opposite to projectile), idle check (shield only works when not
attacking). `ShieldDeflection` bounce visual (spark cross, decelerating). Created
`src/objects/projectiles/enemy-projectile.ts` — EnemyProjectile class with
Flying/Deflected/Dead states, QSpeed movement at $C0 (3px/frame), `deflect()`
method reverses and bounces. Created `src/world/push-block.ts` — PushBlock class
with 3-state machine from Z_04.asm UpdateBlock: Idle (requires allEnemiesDead,
Link aligned + adjacent within 17px + facing block + holding direction for 16
frames), Moving (1px/frame slide for 16px), Done (inert, sets pushComplete flag
for H1 secret triggers). Added `hasShield`, `hasMagicShield`, `isIdle` to Link.
Demo in main.ts: test projectile spawns from right edge, push block on starting
screen. 46 new tests (502 total). Typecheck clean. **Next: D4.**

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
