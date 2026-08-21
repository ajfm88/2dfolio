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

**Last updated:** 2026-08-19 · **Phase:** F (Items & Inventory) in progress · **Slices done:** 26 / 45

---

## ⚠ Read this before planning anything

This is a **reimplementation from reference**, not a port or emulator. You read
6502 assembly (the disassembly) and TypeScript/C#/JS (the reference repos) and
write TypeScript by hand. Nothing is transpiled; nothing is emulated.

**Next action: slice F4** — Magic Rod + Book of Magic, Recorder/Flute, Raft, Stepladder,
Power Bracelet, Letter → Potion, Blue/Red Ring, Magic Key.

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
| Overworld manager | `src/world/overworld-manager.ts` | ✅ OverworldManager: owns screen state (row/col/currentScreen), transition lifecycle, collision map, visited-screen tracking. Boundary clamping (no wrapping). NES-accurate entry positions. Cave entry detection via checkCaveEntry(). main.ts delegated to orchestrator role (E1) |
| Cave system | `src/world/cave-room.ts`, `src/world/curtain-effect.ts`, `src/data/cave-data.ts` | ✅ CurtainEffect (close/open, 8 steps × 4 frames), CaveRoom (renders cave-map.png, Old Man, fires, item, text), cave entry detection (tile 12 + SCREEN_CAVE_INDEX mapping from ROM AttrsB), walk-into-darkness phase, item pickup (WoodSword sets link.hasSword), exit returns to overworld entry position. 78 cave screens mapped. Link starts without sword (E2) |
| Secrets data | `src/data/secrets.json`, `src/data/secret-types.ts` | ✅ Per-screen quest secret numbers (AttrsF bits 6-7, 128 entries), shortcut position indices (AttrsF bits 4-5), 4 shortcut positions from LevelInfoOW. Tile object type constants and square index mappings (E3) |
| Room flags | `src/world/room-flags.ts` | ✅ RoomFlags class: 128-byte per-room persistent state, isSecretFound/setSecretFound (bit $80). In-memory only for now (E3) |
| Tile object manager | `src/world/tile-object.ts` | ✅ TileObjectManager: detects tile objects (square indices 38-43 → types $62-$67) in screen tile grids, quest secret mismatch filtering, pre-reveals on revisit via room flags. Handles 3 secret types: bombable rock wall (bomb detonation within 16px → cave entrance), burnable tree (standing fire within 16px → stairs at shortcut position), pushable rock/gravestone (vertical push only, bracelet check for rock, 16-frame timer + 16px slide → stairs). Tile override map for rendering (E3) |
| Bomb stub | `src/objects/weapons/bomb.ts` | ✅ Bomb: 4-phase timer matching NES BombTimes ($30/$18/$0C/$06), Idle→Fuse→Detonating→Exploding→Dead. isDetonating flag for secret wall detection. Colored rectangle rendering (E3 stub, F2 full) |
| Candle fire stub | `src/objects/weapons/candle-fire.ts` | ✅ CandleFire: walks 16px in direction, then stands for $3F (63) frames. isStanding flag for tree detection. Flickering rectangle rendering (E3 stub, F3 full) |
| Tile replacement | `src/render/tile-renderer.ts` | ✅ renderScreen() accepts optional tile override map. Cave entrance sampled from reference screen (7,7). Stairs drawn as alternating brown/black stripes. Generic overrides re-render from map image (E3) |
| Cave text | `src/data/cave-text.json`, `src/data/cave-text-types.ts` | ✅ 38 NPC text strings extracted from PersonText.dat in ROM. Decoded from NES PPU tile encoding (6-bit chars + 2-bit line control). All Old Man/Woman/Moblin dialogue. extract:cave-text script (E4a) |
| Cave type system | `src/world/cave-room.ts` | ✅ Generalized CaveRoom: behavior detection from objectType (gift/hint/doorRepair/moblinGive/shop/moneyGame/potionShop), NPC type selection (Old Man/Old Woman/Moblin), text lookup via textSelector→PersonTextAddrs, room flag integration for already-taken caves, colored item shapes per type (sword/heart container/letter/rupee). CaveBehavior + NpcType enums (E4a) |
| Link inventory | `src/objects/player/link.ts` | ✅ rupees (0-255), keys, bombs (max 8), addRupees/spendRupees/addKeys/addBombs/addHeartContainer. HUD wired to live values. Generic handleItemPickup for all item types (E4a) |
| Item sprite mapping | `src/data/item-sprites.ts` | ✅ NES item ID → items.png grid position mapping (10×4 grid, 40×40 cells). 33 items mapped. drawItemSprite with center-crop (30% inset for proper 16×16 scaling). processItemsImage for background transparency. Sword fixed to col 7 row 3 per zelda-clone-master (E4a, fixed F1) |
| Inventory model | `src/objects/player/inventory.ts` | ✅ Inventory class mirroring NES RAM $0656-$067E. Graded items (sword/arrow/candle/ring/potion/letter), boolean items (bow/flute/food/wand/raft/book/ladder/magicKey/bracelet/magicShield), boomerang (wood+magic separate), dungeon bitmasks (compass/map/triforce). 9 selectable B-slots with NES-accurate hasSelectableItem/getEquippedBItemId/getSwordItemId (F1) |
| Drop engine | `src/objects/enemies/drop-engine.ts` | ✅ DropEngine: NES-faithful drop algorithm from Z_04.asm. 4-group enemy classification, worldKillCycle mod 10, dropItemRates per group, help drops (16 kills→fairy, 10 non-drops→bomb/rupee). Ready for G1 wiring (F1) |
| Item pickup entity | `src/objects/pickups/item-pickup.ts` | ✅ ItemPickup: world-space dropped item with sprite, lifetime ($FF ticks / 2 frames = 510 frames), flash near expiry, 16×16 collision with Link (F1) |
| Inventory subscreen | `src/ui/inventory-screen.ts`, `src/ui/inventory-slide.ts` | ✅ InventoryScreen: NES-accurate layout — "INVENTORY" red title, blue B-item box, "USE B BUTTON FOR THIS", item grid with selectable/passive rows, triforce outline, "TRIFORCE" red title. Cursor flash 8-frame toggle. getNextOwnedSlot mod-9 cycling (skips bow, arrow requires bow, potion/letter fallback). InventorySlide: 3px/frame scroll matching NES MenuState (F1) |
| Red font | `src/ui/tint-utils.ts` | ✅ createTintedFontImage: transparency-first then color tint via source-atop compositing. NES red #d82800 (F1) |
| B-item dispatch | `src/main.ts` | ✅ useBItem() dispatches on inventory.selectedBSlot: boomerang (slot 0, diagonal throw), bomb (slot 1, deducts count), candle (slot 4, blue=once/screen, red=unlimited). Other slots are F3-F4 stubs (F2) |
| Boomerang | `src/objects/weapons/boomerang.ts` | ✅ Boomerang class: NES-accurate 5-state machine (FlyAway $10 → SparkTurn $20 → SlowDown $30 → ReturnSlow $40 → ReturnFast $50). QSpeed movement ($C0 = 3px/f outbound, $40 = 1px/f slowdown). Diagonal speed tables for homing return from Z_07.asm:3831. Normal limit 49px, magic 255px. 9-entry animation cycle with flip attrs. 8×8 hitbox at (x+4, y+8). forceReturn() for G1 enemy collision. Diagonal throw via input directions (F2) |
| Bomb (full) | `src/objects/weapons/bomb.ts` | ✅ Upgraded from E3 stub: getExplosionHitbox() returns 48×48 centered rect during Detonating only ($18 radius per Z_01.asm:6108). shouldFlash getter for screen flash at timer $0B/$06. Cloud sprite rendering with alternating offset sets from sprites.json. BOMB_DAMAGE=$40 exported for G1. Backward-compatible getHitbox() (16×16) for E3 wall-breaking (F2) |
| Arrow | `src/objects/weapons/arrow.ts` | ✅ Arrow class: Flying→Spark→Dead state machine. QSpeed $C0 = 3px/f straight-line, tile collision + screen boundary deactivation, 3-frame spark on hit. Requires bow + 1 rupee per shot. isSilver flag for damage ($20 wood/$40 silver). Vertical nudge +3px per Z_05.asm:2997. deactivate() API for G1 (F3) |
| Candle fire (full) | `src/objects/weapons/candle-fire.ts` | ✅ Upgraded from E3 stub: fixed speed from 1px/f to QSpeed $20 = 0.5px/f (32 frames for 16px walk, was 16). Sprite rendering via projectilesSheet with flicker. FIRE_DAMAGE=$10 exported for G1. Walking 32f + standing 63f = 95f total (F3) |
| Food/Bait | `src/objects/weapons/food.ts` | ✅ Food class: 3-phase stationary bait (Phase1→Phase2→Phase3→Dead), 255 frames per phase = 765 total (~12.75s). getPosition() for G1 enemy attraction. No collision (Z_01.asm:5835). Not consumed on placement (F3) |
| HUD item display | `src/ui/hud.ts` | ✅ B-slot and A-slot item sprites rendered in HUD via drawItemSprite. Positions: B at (124,32), A at (152,32). Magic key display ("XA") wired to inventory (F1) |
| Shop system | `src/world/cave-room.ts` | ✅ Shop caves (0x75-0x7A): 3 items at NES CaveWareXs positions, prices displayed below, rupee indicator, purchase on touch (rupee check), CavePurchaseEvent for main.ts processing. Potion shop (0x74) stub. 15 item shapes (swords, bombs, shields, arrows, candles, rings, potions, bait, etc.) (E4b) |
| Money game | `src/world/cave-room.ts` | ✅ Cave type 0x70: generates 3 randomized amounts (+20/+50 win, -10/-40 loss) via Fisher-Yates shuffle, 10 rupee entry, pick-one mechanic, +/- display after choice, MoneyGameResult event (E4b) |

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
| ~~20~~ | ~~**E1** Overworld map loading~~ | ✅ done 2026-08-16 |
| ~~21~~ | ~~**E2** Cave/staircase entry and exit~~ | ✅ done 2026-08-16 |
| ~~22~~ | ~~**E3** Overworld secrets~~ | ✅ done 2026-08-17 |
| ~~23~~ | ~~**E4** NPCs + shops (split E4a/E4b)~~ | ✅ done 2026-08-17 |
| ~~24~~ | ~~**F1** Item model + inventory~~ | ✅ done 2026-08-18 |
| ~~25~~ | ~~**F2** Boomerang + Bombs~~ | ✅ done 2026-08-19 |
| ~~26~~ | ~~**F3** Bow + Arrow + Candle + Food~~ | ✅ done 2026-08-19 |
| 27 | **F4** Magic Rod + misc items | rod, flute, raft, ladder, bracelet, ring, etc. |

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

### 2026-08-19 — F3 Arrow + Candle fire upgrade + Food/Bait (Claude Opus 4.6)

Created `src/objects/weapons/arrow.ts` — Arrow class with Flying→Spark→Dead state
machine. QSpeed $C0 = 3px/f straight-line projectile matching sword beam pattern.
Tile collision and screen boundary deactivation with 3-frame spark on hit. Requires
bow + 1 rupee per shot (deducted in main.ts). isSilver flag for damage differentiation
($20 wood / $40 silver). Vertical arrows nudged +3px right per Z_05.asm:2997.
deactivate() API for G1 enemy hit. Upgraded `src/objects/weapons/candle-fire.ts` —
critical speed fix: replaced 1px/f integer movement with NES-accurate QSpeed $20 =
0.5px/f (walking phase now 32 frames for 16px, was 16). Added sprite rendering via
projectilesSheet with flicker alternation. Exported FIRE_DAMAGE=$10. Created
`src/objects/weapons/food.ts` — Food class with 3-phase stationary bait (255 frames
per phase = 765 total, ~12.75 seconds per Z_07.asm:3763). No collision per
Z_01.asm:5835. getPosition() API for G1 enemy attraction. Food NOT consumed on
placement (only by Grumble Goriya in H-phase). Added NES slot $0F sharing guards
between boomerang and food in main.ts. Added arrow/fire/food constants to
constants.ts. Updated tile-object test for new fire speed. 27 new tests (812
total). Typecheck clean. Visually verified: arrow flies and vanishes, candle fire
moves slowly, food sits on ground, boomerang blocked during food. **Next: F4.**

### 2026-08-19 — F2 Boomerang + Bombs (Claude Opus 4.6)

Created `src/objects/weapons/boomerang.ts` — Boomerang class with NES-accurate
5-state machine from Z_07.asm:3857 UpdateArrowOrBoomerang: FlyAway ($10, QSpeed
$C0 = 3px/f) → SparkTurn ($20, 3 frames) → SlowDown ($30, QSpeed $40 = 1px/f,
16 frames) → ReturnSlow ($40, diagonal homing at half speed via 9-entry speed
tables from Z_07.asm:3831, 32 frames) → ReturnFast ($50, full speed until caught
within 9px). Normal limit 49px, magic 255px. Diagonal throw via input directions
(NES-accurate). 9-entry animation cycle with flip attrs. 8×8 hitbox at (x+4, y+8).
forceReturn() API for G1 enemy collision. Upgraded `src/objects/weapons/bomb.ts`
from E3 stub: added getExplosionHitbox() (48×48 centered during Detonating, $18
radius per Z_01.asm:6108), shouldFlash getter (toggles at timer $0B/$06), cloud
sprite rendering with alternating offset sets from sprites.json bombCloud data.
Exported BOMB_DAMAGE=$40 for G1. Added boomerang/bomb constants to constants.ts.
Wired in main.ts: useBItem() case 0 with diagonal direction detection, boomerang
update/render, projectilesSheet/cloudSheet SpriteSheets, bomb screen flash overlay,
transition cleanup. 33 new tests (785 total). Typecheck clean. Visually verified:
bomb place/detonate, boomerang throw/return, HUD item display. **Next: F3.**

### 2026-08-18 — F1 Item model + inventory subscreen (Claude Opus 4.6)

Created `src/objects/player/inventory.ts` — Inventory class mirroring NES RAM
$0656-$067E with graded items (sword 0-3, arrow 0-2, candle 0-2, ring 0-2,
boomerang wood/magic, potion 0-2, letter 0-2), boolean items (bow, flute, food,
wand, raft, book, ladder, magicKey, bracelet, magicShield), dungeon bitmasks
(compass, map, triforce). 9 selectable B-slots matching NES FindAndSelectOccupied-
ItemSlot: slot 0=boomerang pseudo-slot, slot 3=bow always skipped, slot 2=arrow
requires bow, slot 7=potion/letter fallback. Link class refactored: boolean fields
(_hasSword, _hasBracelet, etc.) replaced with inventory delegation. Created
`src/objects/enemies/drop-engine.ts` — NES-faithful drop algorithm (4 enemy groups,
worldKillCycle mod 10, help drops at 16 kills/10 non-drops). Created
`src/objects/pickups/item-pickup.ts` — world-space dropped item with lifetime/flash/
collision. Created `src/ui/inventory-screen.ts` — NES-accurate subscreen renderer
with blue boxes, item grid (selectable + passive rows), cursor flash (8-frame
toggle), triforce outline. Created `src/ui/inventory-slide.ts` — 3px/frame scroll
(NES MenuState). Created `src/ui/tint-utils.ts` — transparency-then-tint for red
font (#d82800). Updated `src/data/item-sprites.ts`: fixed sword mapping (col 7 row
3 per zelda-clone ItemSpriteFactory.cs), added center-crop (30% inset), added
processItemsImage for background transparency, added clock sprite. Updated
`src/ui/hud.ts`: B/A item sprite rendering at (124,32)/(152,32). Updated
`src/world/cave-room.ts`: replaced 80-line drawItem colored rectangles with
drawItemSprite, added itemsImage constructor param. Expanded handleItemPickup to
cover all 36 NES item IDs with upgrade logic. Replaced placeWeapon stub with
useBItem() dispatching on selectedBSlot. Start button opens inventory (blocks
gameplay), Left/Right cycles cursor, Start closes. 39 new tests (752 total).
Typecheck clean. Known polish: HUD has duplicate sword in A-slot (hud.png
background has baked-in sword graphic), subscreen layout slightly oversized.
**Phase F started. Next: F2.**

### 2026-08-17 — E4b Shops + money game (Claude Opus 4.6)

Added shop purchase system to CaveRoom: shop caves (objectTypes 0x75-0x7A) display
up to 3 items at NES CaveWareXs positions ($58/$78/$98), prices rendered below via
BitmapFont, rupee "X" indicator at ($30, $AB). Shop update checks all 3 slots for
Link proximity (dx<12, dy<10), verifies rupees >= price, generates CavePurchaseEvent
with slotIndex/itemId/price. main.ts processes events: spendRupees + handleItemPickup.
Added money game (objectType 0x70): generateMoneyGameAmounts() creates 3 randomized
amounts — one win (+20 or +50) and two losses (-10, -10 or -40) shuffled via
Fisher-Yates. Link touches a position with ≥10 rupees → pays 10 + wins/loses chosen
amount. Results displayed with +/- signs. MoneyGameResult event processed by main.ts.
Potion shop (0x74) stubbed as shop behavior (Letter requirement deferred to F4).
Added 15 colored item shapes for cave rendering: bombs (#303080), magic shield
(#8080c0), arrows, candles (blue/red), bait, potions (blue/red), rings (blue/red).
Fixed ITEM_Y from 96 to 88 (NES ObjY $98 - HUD $40 = $58 = 88). 8 new tests
(713 total). Typecheck clean. **Phase E complete. Next: F1.**

### 2026-08-17 — E4a Cave type system (Claude Opus 4.6)

Created `scripts/extract-cave-text.ts` — extracts all 38 NPC dialogue strings from
PersonText.dat in the NES ROM. Decoded from NES PPU tile encoding (low 6 bits =
character tile ID, high 2 bits = line control: $80=line 2, $40=line 3, $C0=end).
Fixed iNES header offset (+16 bytes). Character map: $00-$09→0-9, $0A-$23→A-Z,
$24/$25→space, $28→comma, $2A→apostrophe, $2C→!, $2D→-, $2E→?, $2F→hyphen.
Output: `src/data/cave-text.json` + `src/data/cave-text-types.ts`. Generalized
`src/world/cave-room.ts` — CaveRoom now supports all 20 cave objectTypes via
behavior detection: gift (0x6A-0x6D, 0x72), hint (0x6E-0x6F, 0x73), doorRepair
(0x71), moblinGive (0x7B-0x7D), shop (0x75-0x7A), moneyGame (0x70), potionShop
(0x74). NPC type selection: Old Man (default), Old Woman (0x70, 0x79, 0x7A),
Moblin (≥0x7B). Text lookup via caveTypes[].textSelector / 2 → PersonTextAddrs
message index. Heart requirement check for White Sword (5 containers) and Magic
Sword (12 containers). Room flag integration: already-taken caves show empty
(person+items hidden). Colored item shapes per type (sword variants, heart
container, letter, rupees) — items.png has black backgrounds invisible against
dark caves, deferred real sprite rendering to F1. Added rupees/keys/bombs/maxBombs
to Link with addRupees/spendRupees/addKeys/addBombs/addHeartContainer methods.
HUD wired to live Link.rupees/keys/bombs. Generic handleItemPickup switch for all
item types (swords, bracelet, magic shield, heart container, bombs, keys, rupees).
Door repair auto-deducts 20 rupees per Z_01.asm:696. Moblin caves give rupees from
prices[1]. Created `src/data/item-sprites.ts` — NES item ID → items.png grid
mapping (32 items, 10×4 grid at 40×40 cells). Added extract:cave-text npm script.
35 new tests (705 total). Typecheck clean. Visually verified: sword cave shows
correct text + Old Man + fires + item shape.
**E4 split into E4a/E4b. Next: E4b.**

### 2026-08-17 — E3 Overworld secrets (Claude Opus 4.6)

Created `scripts/extract-secrets.ts` — extracts per-screen quest secret numbers
(AttrsF bits 6-7, 32 screens with quest-specific secrets) and shortcut positions
(4 packed bytes from LevelInfoOW offset 41). Output: `src/data/secrets.json` +
`src/data/secret-types.ts` with tile object type constants ($62-$67) and square
index mappings (38-43). Created `src/world/room-flags.ts` — RoomFlags class with
128-byte per-room state, isSecretFound/setSecretFound (bit $80 per NES WorldFlags).
Created `src/objects/weapons/bomb.ts` — Bomb stub with 4-phase NES timer (BombTimes
$30/$18/$0C/$06), isDetonating flag for wall detection. Created
`src/objects/weapons/candle-fire.ts` — CandleFire stub: walks 16px then stands 63
frames, isStanding flag for tree detection. Created `src/world/tile-object.ts` —
TileObjectManager: scans tile grid for special square indices 38-43 mapping to tile
object types, quest secret mismatch filtering (Q2-only skipped in Q1), pre-reveal
on revisit via room flags. Three secret handlers: bombable rock wall (bomb within
16px → cave entrance at tile position), burnable tree (standing fire within 16px →
stairs at shortcut position from secrets.json), pushable rock/gravestone (vertical
only, bracelet check for rock, 16-frame push timer + 16px slide → stairs). Fixed
push direction logic per Z_04.asm RockPushDirections (Link below → push Up, above
→ push Down). Updated `src/render/tile-renderer.ts` — renderScreen() accepts tile
override map; cave entrance sampled from reference screen (7,7), stairs rendered as
brown/black stripes. Updated `src/world/overworld-manager.ts` — added RoomFlags,
TileObjectManager, SecretsData; constructor takes secretsData param; initForScreen
on transition/setScreen; updateTileObjects() and renderTileObject() methods;
checkCaveEntry() expanded to detect revealed cave entrances via tile overrides.
Added hasBracelet/setBracelet to Link. Updated `src/main.ts` — loads secrets.json,
bomb/fire arrays, Z key places fire (first press) then bomb (second press per
screen), weapons update/render each frame, tile object secrets update. Added
`extract:secrets` npm script. 44 new tests (670 total). Typecheck clean (only
pre-existing errors). No console errors. Cave entry still works.
**Next: E4.**

### 2026-08-16 — E2 Cave/staircase entry and exit (Claude Opus 4.6)

Created `src/data/cave-data.ts` — SCREEN_CAVE_INDEX mapping (78 cave screens from
ROM LevelBlockOW.dat AttrsB, formula: ((attrsB & 0xFC) - 0x40) / 4),
CAVE_ENTRANCE_TILES (tile 12 = dark opening), helper functions. Created
`src/world/curtain-effect.ts` — CurtainEffect class with close/open directions,
8 steps × 4 frames per step = 32 frames total, draws two black columns from
edges (close) or center (open). Created `src/world/cave-room.ts` — CaveRoom class
rendering cave-map.png background, Old Man from npcs.png, fire placeholders, item
(WoodSword drawn as colored shape), centered text ("IT'S DANGEROUS TO GO ALONE!
TAKE THIS." via BitmapFont). Walk-in auto-walk (32 frames). Item pickup detection
(proximity check), exit detection (bottom of cave). Added CaveTransition and
CaveInterior to GameMode enum. Added cave entry detection to OverworldManager
(checkCaveEntry: checks tile above Link when facing up on cave screen). Walk-into-
darkness phase (8 frames of Link walking into dark tile before curtain). Entry
position saved for overworld return. Changed Link._hasSword default to false —
sword acquired by picking up WoodSword in cave. Updated 6 existing tests to
call setHasSword(true). 13 new cave tests (626 total). Typecheck clean. Visually
verified: walk into cave → curtain close → cave interior → pick up sword → exit →
curtain open → back on overworld → sword swing works. Known polish items: Old Man
sprite has blue background (needs transparency key), HUD shows sword before
acquisition (F1 fix), fire sprites are placeholders.
**Next: E3.**

Older sessions archived → `../PROGRESS.md` (A1–E1, 2026-08-02 through 2026-08-16).
