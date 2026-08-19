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

**Last updated:** 2026-08-17 · **Phase:** E (Overworld) complete · **Slices done:** 23 / 45

---

## ⚠ Read this before planning anything

This is a **reimplementation from reference**, not a port or emulator. You read
6502 assembly (the disassembly) and TypeScript/C#/JS (the reference repos) and
write TypeScript by hand. Nothing is transpiled; nothing is emulated.

**Next action: slice F1** — Item model + pickups + drop tables + inventory
subscreen (select + equip to A/B buttons).

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
| Item sprite mapping | `src/data/item-sprites.ts` | ✅ NES item ID → items.png grid position mapping (10×4 grid, 40×40 cells). 32 items mapped. drawItemSprite helper (E4a, not yet used in caves due to black-on-black visibility — deferred to F1) |
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
| 24 | **F1** Item model + inventory | pickups, drops, inventory subscreen |

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

### 2026-08-16 — E1 Overworld map loading (Claude Opus 4.6)

Created `src/world/overworld-manager.ts` — OverworldManager class that owns all
overworld state: screenRow/Col, currentScreen, transition lifecycle, collisionMap,
and visitedScreens (Set<number>). Methods: tryTransition() with boundary clamping
(rejects out-of-bounds instead of wrapping), updateTransition(), setScreen() for
respawn, renderScreen/renderTransition delegation. Replaced wrapping modulo math
with bounds checks against OVERWORLD_ROWS=8/OVERWORLD_COLS=16. Entry positions use
play-area-relative SCREEN_EDGE_* bounds (not NES absolute coords which caused a
bounce-back bug at y=221 > SCREEN_EDGE_BOTTOM=160). Removed D3 demo artifacts
(enemy projectiles, push block, spawn timer) from main.ts. main.ts slimmed from
~416 to ~230 lines — now orchestrator only, delegates world state to
OverworldManager. Added OVERWORLD_ROWS, OVERWORLD_COLS, LINK_ENTRY_* constants.
32 new tests (613 total). Typecheck clean. Visually verified: walk right + up
without bounce, scroll animation correct, no demo clutter.
**Phase E started. Next: E2.**

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
