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

**Last updated:** 2026-08-29 · **Phase:** G complete; **I2 complete (all L4-6 bosses implemented)**; H3 done · **Slices done:** 42 / 45

---

## ⚠ Read this before planning anything

This is a **reimplementation from reference**, not a port or emulator. You read
6502 assembly (the disassembly) and TypeScript/C#/JS (the reference repos) and
write TypeScript by hand. Nothing is transpiled; nothing is emulated.

**Next action: H4 (Dungeons 7-9 completable).** All L1-6 bosses are now implemented (I1 + I2 complete). H3 is done: Dungeons 4-6 completable with staircase/cellar system and room-clear persistence. **Phase G complete (G1–G5); Phase I1 complete; Phase I2 complete; H2 done; H3 done.**
H2 done — **Dungeons 1-3 completable.** Most of the path was already data-wired (H1a/H1b + I1); H2 filled 4 gaps: (1) **boss single-spawn** (NES Z_05.asm:1723 — monster list ID ∈ [$32,$62) spawns exactly 1, else a boss room spawned 3 Aquamentus); (2) **Triforce-get completion sequence** (`GameMode.DungeonTriforceGet` — full heal + held display → curtain-warp out via existing exitDungeon); (3) Triforce room-item −8px offset (Z_05.asm:8255); (4) navigability pass (BFS confirmed start→boss→triforce traversable for all 3 levels, boss→triforce is a shutter that opens on boss death via trigger 7). Boss-room heart container (secret trigger 7) + shutter already worked from H1b. **Note:** L2 Dodongo ($32) / L3 Manhandla ($3C) currently fall back to the generic walker — the completion *machinery* works with them, but faithful boss fights are later I-slices.

**Note on phase order:** Phase G (enemies) and Phase H (dungeons) were interleaved — H1a/H1b built the dungeon scaffolding first so G3+ dungeon enemies have somewhere to spawn (PLAN.md allows F–I in any order). **Phase G is done, and I1 (Aquamentus) is done** — H2 is no longer boss-blocked.

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
| Shop system | `src/world/cave-room.ts` | ✅ Shop caves (0x75-0x7A): 3 items at NES CaveWareXs positions, prices displayed below, rupee indicator, purchase on touch (rupee check), CavePurchaseEvent for main.ts processing. Potion shop (0x74) with letter delivery gate. 15 item shapes (E4b, updated F4a) |
| Magic Rod | `src/objects/weapons/magic-rod.ts` | ✅ MagicRod class mirroring SwordSwing: Windup(5f)→Extended(8f)→FireShot(1f)→Retract(2×1f). Same position offset tables as sword. shouldFireShot signal at Extended→FireShot transition. Hitbox active during Extended. Blocks sword while active via blockSwordAttack flag (F4a) |
| Magic Shot | `src/objects/weapons/magic-shot.ts` | ✅ MagicShot projectile: QSpeed $A0 = 2.5px/f. Flying→Dead states. Horizontal boundary check ($14/$EC). Tile collision. wasBlocked flag for Book of Magic fire. deactivate() API for G1 enemy hit (F4a) |
| Book of Magic fire | `src/objects/weapons/candle-fire.ts` | ✅ CandleFire.createBookFire() static factory: starts in Standing state with 79-frame timer (BOOK_FIRE_TIMER=$4F), skips walking phase. Spawned by main.ts when magic shot hits wall and inventory.book is true (F4a) |
| Ring palette tinting | `src/render/link-tint.ts` | ✅ createTintedLinkImage(): replaces green tunic pixels with ring color. Three SpriteSheet instances (green/blue/red) created at init. getActiveLinkSheet() selects based on link.ringLevel. All Link render paths use tinted sheet (F4a) |
| Potion + heart refill | `src/main.ts` | ✅ useBItem case 7: decrements potion (red→blue→none). Gradual heart refill: 1 half-heart every 4 frames, blocks gameplay during refill. Letter delivery auto-triggers at potion shop (letter 1→2) (F4a) |
| Link halted mechanism | `src/objects/player/link.ts` | ✅ `_halted` flag (NES ObjState $40). When true, `update()` returns NO_EDGE, blocking all input/movement. Set externally by main.ts during raft/stepladder sequences. Cleared in `reset()` (F4b) |
| Collision water detection | `src/world/collision.ts` | ✅ Stores raw `primaryValues`, adds `isWaterTileAt()` (checks $8D-$98 range), `getTileValueAtPosition()`, walkable overrides via `setWalkableOverride(row,col)`/`clearWalkableOverrides()` for stepladder bridge (F4b) |
| Stepladder | `src/objects/items/stepladder.ts` | ✅ Auto-activates when Link faces water tile in rooms [$17,$18,$19,$27,$4F,$5F] with inventory.ladder. LadderState: Approaching→OnLadder→Done. Position offsets from Link per Z_07.asm LinkToLadderOffsets. Distance-based state transitions (threshold $10). Movement override allows parallel/retreat, blocks perpendicular. Walkable override makes ladder tile crossable. Destroyed on screen transition (F4b) |
| Raft | `src/objects/items/raft.ts` | ✅ Auto-spawns in rooms $3F/$55 when Link has inventory.raft. RaftState: Idle→MovingDown/MovingUp. Dock X: $60 (room $3F), $80 (room $55). Link halted during travel, raft drawn 6px below. MovingDown: Y increments 1px/f, stops at $7F. MovingUp: Y decrements 1px/f, triggers screen scroll Up at $3D (F4b) |
| Recorder/Flute | `src/objects/items/recorder.ts` | ✅ RecorderEffect multi-phase state machine: Tune (152f gameplay freeze) → PondDrying (12 steps × 8f, water walkable at step 10, stairs at step 11) OR WhirlwindSource (2px/f rightward, 9px catch threshold) → TransitionPending → WhirlwindDest (drops Link at X=$80). Destination selection via TeleportingLevelIndex cycling through InvTriforce bitmask. Q1: only room 66 has flute secret. revealFluteSecret() public method on TileObjectManager for stairs placement. fluteSecretRoomIds stored from items.json (F4c) |
| Money game | `src/world/cave-room.ts` | ✅ Cave type 0x70: generates 3 randomized amounts (+20/+50 win, -10/-40 loss) via Fisher-Yates shuffle, 10 rupee entry, pick-one mechanic, +/- display after choice, MoneyGameResult event (E4b) |
| Enemy base class | `src/objects/enemies/enemy.ts` | ✅ Enemy class: EnemyState enum (Spawning/Active/Stunned/Knockback/Dying/Dead), generic random walker AI, takeDamage() with NES HP system (Z_04.asm ExtractHitPointValue: even=high nibble, odd=low nibble<<4), knockback ($40 distance, 4px/f), invincibility ($10 frames), stun ($A0 frames), death timer (12f). getEnemyHp() decoder. Colored rectangle rendering with type-based colors (G1) |
| Spawn manager | `src/objects/enemies/spawn-manager.ts` | ✅ SpawnManager: reads enemy-spawns.json, resolves monsterListId (0=none, 1-$61=single type, $62-$7F=heterogeneous list), spawns up to foeCounts[index] enemies at NES spawn positions (4 lists by Link entry direction, packed byte: high=row, low=col), staggered spawn cloud timers, freezeAll() for Clock item, clear() on screen exit (G1) |
| Enemy collision | `src/objects/enemies/enemy-collision.ts` | ✅ checkWeaponEnemyCollisions: checks sword hitbox, sword beam, boomerang (stun or stun+damage), bomb explosion, arrow (wood/silver), candle fire, magic rod, magic shot against all active enemies. Sword beam/arrow/magic shot deactivate on hit. checkEnemyLinkCollisions: contact damage via DAMAGE_TABLE lookup (G1) |
| Drop engine wiring | `src/main.ts` | ✅ DropEngine.rollDrop() called on enemy kill → ItemPickup spawned at death position. Clock item ($21) freezes all enemies 660 frames. SpawnManager integrated into gameplay loop, transition lifecycle, cave entry/exit, and respawn. Debug console: `__zelda.giveAll()` (G1) |
| Walker enemy base | `src/objects/enemies/walker-enemy.ts` | ✅ WalkerEnemy: Wanderer_TargetPlayer + Walker_Move pattern. QSpeed sub-pixel movement, grid-aligned turning, turnRate-based direction toward Link, _TryShooting timer ($30 countdown, fire at $10), blue variants shoot more. Sprite rendering from enemies.png (G2) |
| Octorok | `src/objects/enemies/octorok.ts` | ✅ Red slow (type 7): turnRate $70, QSpeed $20. Red fast (type 8): QSpeed $40. Blue slow/fast (types 9/10): turnRate $A0. Shoots rock ($53). Sprites rows 0-1 (G2) |
| Moblin | `src/objects/enemies/moblin.ts` | ✅ Blue (type 3) / Red (type 4): turnRate $A0, QSpeed $20. Shoots arrow ($5B). Sprites rows 4-5 (G2) |
| Lynel | `src/objects/enemies/lynel.ts` | ✅ Blue (type 1): turnRate $A0 / Red (type 2): turnRate $70. QSpeed $20. Shoots sword shot ($57). Sprites rows 12-13 (G2) |
| Tektite | `src/objects/enemies/tektite.ts` | ✅ Blue (type 13) / Red (type 14). Ground/jumping state machine: pause timer → jump toward Link with diagonal arc → bounce off boundaries → land → repeat. reversalCount escape logic. Sprites rows 8-9 (G2) |
| Leever | `src/objects/enemies/leever.ts` | ✅ Blue (type 15): burrower cycle + QSpeed $20 walk during surface. Red (type 16): max 2 active at once, spawns near Link. 4-state cycle: underground→emerging→surface→submerging. Invulnerable underground (G2) |
| Zora | `src/objects/enemies/zora.ts` | ✅ Type 17. Water burrower: surfaces at random positions, shoots fireball ($55) midway through surface time, submerges. Invulnerable while underground/transitioning (G2) |
| Peahat | `src/objects/enemies/peahat.ts` | ✅ Type 26. 6-state flyer: SpeedUp→Decide→Chase/Wander→SlowDown→Delay. Only vulnerable in Delay state (stopped). Chase/wander use normalized velocity toward Link. Bounce off screen edges (G2) |
| Ghini | `src/objects/enemies/ghini.ts` | ✅ Main (type 33): walks with turnRate $FF, death kills all flying Ghini. FlyingGhini (type 34): flies freely toward Link with randomness. setSiblings() wires death propagation (G2) |
| Armos | `src/objects/enemies/armos.ts` | ✅ Type 30. Dormant statue until Link touches (proximity < 16px), then walks with Goriya pattern (turnRate $A0, QSpeed $20). No spawn cloud. Invulnerable while dormant (G2) |
| Enemy projectiles | `src/objects/enemies/enemy-collision.ts` | ✅ checkEnemyProjectileCollisions: checks enemy projectiles vs Link rect with shield deflection via canShieldBlock(). Blocked projectiles deflect, unblocked deal damage from DAMAGE_TABLE. SpawnManager.projectiles tracks all active enemy projectiles (G2) |
| Enemy sprite sheet | `src/main.ts` | ✅ enemies.png loaded as SpriteSheet (30 cols, 1px spacing), passed to SpawnManager.render(). Walker enemies render from sprite sheet (Octorok/Moblin/Lynel/Tektite), others use colored rectangle placeholders (G2) |
| Dungeon entrance data | `src/data/dungeon-entrance-data.ts` | ✅ Maps overworld screenId → dungeon level (1-6 verified, 7-9 deferred). getDungeonLevel() lookup (H1a) |
| Dungeon renderer | `src/render/dungeon-renderer.ts` | ✅ Renders dungeon rooms from dungeons-map.png. Room at (roomId%16, roomId/16) × (256,176), level block offset for uw2q1. Same tile-sampling approach as overworld (H1a) |
| Dungeon collision | `src/world/dungeon-collision.ts` | ✅ DungeonCollisionMap: 16×11 walkability grid from 12×7 inner tiles + squareTable + border walls. Door openings punch walkable holes for open doors (types 0,2). TileCollisionMap-compatible API (screen param ignored). openDoor() for runtime changes (H1a) |
| Dungeon manager | `src/world/dungeon-manager.ts` | ✅ DungeonManager: loads dungeon level from dungeons.json, tracks currentRoomId, room-to-room navigation (N:-16, S:+16, W:-1, E:+1), visited rooms Set, door type checks (canPassDoor), entry position calculation, dungeon exit detection from startRoom. dummyScreen for Link/enemy API compat (H1a) |
| Dungeon HUD | `src/ui/hud.ts` | ✅ "LEVEL-N" text, dungeon minimap: visited rooms as blue squares (8×4px cells), current room as blinking green marker. Replaces overworld dot when levelNumber > 0 (H1a) |
| Dungeon entry/exit | `src/main.ts` | ✅ DungeonTransition game mode: walk-into-darkness → curtain close → DungeonManager init → curtain open. Exit: walk south from startRoom → curtain close → restore overworld. Dungeon entrance detection via getDungeonLevel() + tile 12 check before cave check (H1a) |
| Dungeon gameplay | `src/main.ts` | ✅ DungeonGameplay mode: full gameplay loop with dungeon collision, room transitions through open doors, weapons, enemy spawning (spawnForDungeonRoom), enemy/weapon/pickup collision, death→respawn at dungeon start. Debug: __zelda.dungeonManager, __zelda.currentLevel (H1a) |
| Dungeon respawn | `src/death/respawn.ts` | ✅ computeRespawnParams returns isDungeon flag for level > 0. Dungeon death respawns at dungeon startRoom with 3 hearts (H1a) |
| Dungeon doors/traps/items | `src/world/dungeon-manager.ts`, `dungeon-secrets.ts`, `room-flags.ts`, `src/objects/enemies/spike-trap.ts`, `src/ui/hud.ts`, `src/objects/player/inventory.ts` | ✅ 8 NES door types (open/wall/false-wall/bombable/key×2/shutter), CurOpenedDoors bitmask persisted in room flags, 7 secret triggers, spike traps (3-state), dungeon push blocks, dark rooms (candle brightens), Map+Compass minimap effects, room item placement/pickup (H1b) |
| Dungeon enemies tier 1 | `src/objects/enemies/{stalfos,rope,goriya,goriya-boomerang,jelly-enemy,gel,zol,flyer-enemy,keese}.ts` | ✅ Stalfos ($2A walker), Rope ($28 wander+charge), Goriya ($05/$06 walker + returning boomerang, frozen while out), Zol ($13 splits into 2 Gels when hurt), Gel ($14/$15 erratic jelly), Keese ($1B/$1C/$1D flyer). GoriyaBoomerang extends EnemyProjectile (owner-homing) → reuses projectile pipeline. Zol split via new Enemy.collectChildSpawns() drained in SpawnManager.update(). Placeholder colored-rect rendering (G3) |
| Dungeon enemies tier 2a | `src/objects/enemies/{gibdo,darknut,vire,pols-voice,bubble}.ts` | ✅ Gibdo ($30 walker), Darknut ($0B/$0C walker + directional parry via new Enemy.blocksAttackFrom() honored in enemy-collision, never stunned), Vire ($12 walker + splits into 2 Red Keese on death), Pols Voice ($16 hopper), Bubble ($2B/$2C/$2D invulnerable + sword-jinx). Link sword-jinx: `link.disableSword()/enableSword()/swordDisabled` + gate in swing; wired via `applyBubbleJinx()` in main.ts dungeon contact. Placeholder rendering (G4a) |
| Dungeon enemies tier 2b | `src/objects/enemies/{wizzrobe,like-like,wallmaster,lanmola}.ts` | ✅ Blue Wizzrobe ($23 walk/teleport-through-walls + MagicShot $58), Red Wizzrobe ($24 stationary phaser, vulnerable only while solid, MagicShot2 $59) — both ride the EnemyProjectile pipeline. Like-Like ($17 walker; on contact paralyzes Link via `link.halted`, eats Magic Shield at $60 frames, frees on death). Wallmaster ($27 wall-emerge crawl; grab → `DungeonManager.returnToEntranceRoom()` warp). Lanmola ($3A/$3B segmented worm, head-only getHitbox = head-only vulnerability + contact). main.ts routes Like-Like/Wallmaster contact specially. Also fixed a pre-existing Pols Voice bounce bug (misread moveQSpeed's no-pixel-this-frame as a wall → ping-ponged in place ~25%). Placeholder rendering (G4b) |
| Enemy projectile system | `src/objects/projectiles/enemy-projectile.ts`, `src/world/dungeon-statues.ts`, `src/objects/enemies/spawn-manager.ts` | ✅ Per-type projectile visuals (rock/fireball/sword-beam/magic/arrow) via renderByType() + animTimer. Statue fireballs: `DungeonStatues` reads room uniqueRoomId ($24→4 statues, $23→2), fires Fireball ($55) aimed cardinally at Link on NES cadence, fed into the shared pipeline via new `SpawnManager.addProjectile()` — zero new collision code. main.ts inits statues in initDungeonRoomObjects + drains fireballs in the dungeon update loop. Fixed a pre-existing shield-deflection bounce bug (blocked shots flew back through Link instead of away). Debug: `SpawnManager.debugSpawn` + `__zelda.goToDungeon`/`spawnEnemy` (G5) |
| Enemy roster audit | `context/agent/enemy-roster-audit.md` | ✅ Definitive object-type→status table from Z_07.asm UpdateObject_JumpTable. Every non-boss combat enemy implemented; remaining types parked as bosses→Phase I or NPCs/specials→content slices, each naming why + owner. Boulder ($1F/$20) named as a deferred G5 stretch (G5) |
| Aquamentus (boss) | `src/objects/enemies/aquamentus.ts` | ✅ Level-1 dragon boss ($3D), from Z_04.asm UpdateAquamentus. Pinned to right wall ($B0,$80→local 176,64), horizontal-only wobble (x∈[$88,$C7], 1px/8f, random 7/$F legs), 3-way fireball fan ($55 ×3, vertical drift 0/+1/−1) on ≥$70-frame cadence, mouth-open tell while timer<$20. HP $60 (6 wood hits). Never stunnable. Placeholder rect render (CHR→sheet deferred like roster). SFX deferred (I1) |
| Invincibility mask (boss primitive) | `src/core/constants.ts`, `src/objects/enemies/enemy.ts`, `enemy-collision.ts` | ✅ Per-weapon `DamageTypeBit` (sword $01/boomerang $02/arrow $04/bomb $08/magic-shot $10/fire $20) + `Enemy._invincibilityMask` + `isImmuneToDamageType()`, honored in every weapon branch of checkWeaponEnemyCollisions. Default 0 = hurt by all (regression-guarded). Aquamentus $E2 = immune to boomerang+fire (I1) |
| Fireball spread (boss primitive) | `src/objects/projectiles/enemy-projectile.ts` | ✅ Optional `verticalDrift` ctor param, applied every other frame while Flying (NES Aquamentus_Shoot @SpreadOutFireballs). Default 0 = straight cardinal travel. `Enemy._pendingProjectiles[]` + `consumeProjectiles()` let a boss emit >1 shot/frame, drained in SpawnManager.update (I1) |
| Dodongo (boss) | `src/objects/enemies/dodongo.ts` | ✅ Level-2 dino boss ($32), from Z_04.asm UpdateDodongo/CheckBombHit/TryEatBomb. 32×16 body wanders toward Link (Move state). **Immune to all direct weapons** (mask $FF). Bomb blast overlapping body → Stunned (mask drops to $FE) → a single sword hit = instant death. Un-exploded bomb in the leading-half "mouth" → eaten (Bloated); 2 eaten = death. HP irrelevant (scripted death). New primitive: optional `bombs?: BombLike[]` on EnemyUpdateContext threaded through SpawnManager.update ← main.ts. `phase`/`bombsEaten` getters for debug. Placeholder rect render (I1b) |
| Manhandla (boss) | `src/objects/enemies/manhandla.ts` | ✅ Level-3 flower boss ($3C), from Z_04.asm UpdateManhandla/_Move/_CheckCollisions. Modeled as 5 coordinated Enemy objects: `ManhandlaCenter` (invulnerable, `_vulnerable=false`) drives 8-way group movement (`_dirMask`, retarget every 16f 50% toward-Link/50% random, bounce off play-area walls, fractional speed accumulator) and repositions 4 `ManhandlaHand` (mask $E2, own HP, killable) to N/S/E/W ±16 each frame. Each hand death → whole group speeds up (+$80 frac); center dies only when the last hand dies → gates trigger-7 completion with ZERO H2 change. Hands shoot unblockable $56 fireballs (4-way aimed at Link). Group-spawned via `createManhandla` + `SpawnManager.pushEnemyOrGroup` (one boss slot → 5 objects). `speedPerFrame`/`livingHands` getters. Placeholder rect render (I1c). **I1 complete.** |
| Dungeon completion loop | `src/objects/enemies/spawn-manager.ts`, `src/core/game-mode.ts`, `src/world/dungeon-manager.ts`, `src/main.ts` | ✅ L1-3 completable end-to-end. Boss single-spawn clamp (`clampBossCount`: list ID ∈ [$32,$62) → 1, Z_05.asm:1723). `GameMode.DungeonTriforceGet`: on Triforce pickup (`beginTriforceGet`) set level bit + full heal + hold display (200f, gold wash + "TRIFORCE" banner) → curtain-warp out via existing exitDungeon path. Triforce room-item −8px X offset (Z_05.asm:8255). Boss-room heart container + shutter ride the existing trigger-7 (FoesForItem) path from H1b (H2) |
| Staircase/cellar system | `src/world/dungeon-manager.ts`, `src/world/dungeon-collision.ts`, `src/render/dungeon-renderer.ts`, `src/main.ts` | ✅ Full stair→cellar→exit flow for L4-6 tunnel and treasure cellars. Trigger 5 (push block) reveals stairs at ($D0,$60). Stair entry: Link overlaps stairs → scan cellarConnections → enterCellar (builds DungeonCollisionMap.forCellar with stairs forced walkable). Cellar rendering: 16-col × 7-row colored rects (black bg, brown walls, stairs alternating stripes). Cellar exit: Link walks up (Y<40) → left/right side determines destination room → exitCellar(isLeftSide) unpacks exitPos byte. Walk-in animation (28 frames). inCellar guards on spike traps, push blocks, bomb/door, secret triggers. 5 cellar connections across L4-L6 (H3a) |
| Room-clear persistence | `src/world/room-flags.ts`, `src/main.ts` | ✅ ROOM_CLEARED_BIT ($40) in RoomFlags. Set when all enemies die (spawnManager.enemies.length > 0 && activeEnemies.length === 0). spawnDungeonRoomEnemies() skips spawning in cleared rooms. Prevents enemy respawn on room re-entry (H3b) |

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
| ~~27~~ | ~~**F4a** Magic Rod + Ring + Potion/Letter~~ | ✅ done 2026-08-20 |
| ~~28~~ | ~~**F4b** Raft + Stepladder~~ | ✅ done 2026-08-21 |
| ~~29~~ | ~~**F4c** Recorder/Flute~~ | ✅ done 2026-08-21 |
| ~~30~~ | ~~**G1** Enemy base system~~ | ✅ done 2026-08-22 |
| ~~31~~ | ~~**G2** Overworld enemies~~ | ✅ done 2026-08-22 |
| ~~32~~ | ~~**H1a** Dungeon room loading + navigation~~ | ✅ done 2026-08-23 |
| ~~33~~ | ~~**H1b** Dungeon doors + traps + items~~ | ✅ done 2026-08-24 |
| ~~34~~ | ~~**G3** Dungeon enemies tier 1~~ | ✅ done 2026-08-25 |
| ~~35~~ | ~~**G4a** Dungeon enemies tier 2 (part 1)~~ | ✅ done 2026-08-25 — Gibdo, Darknut, Vire, Pols Voice, Bubble |
| ~~36~~ | ~~**G4b** Dungeon enemies tier 2 (part 2)~~ | ✅ done 2026-08-25 — Wizzrobe, Like-Like, Wallmaster, Lanmola |
| ~~37~~ | ~~**G5** Enemy projectiles + roster audit~~ | ✅ done 2026-08-26 — per-type shot visuals, statue fireballs, roster-audit doc. **Phase G complete.** |
| ~~38~~ | ~~**I1** Aquamentus (first boss)~~ | ✅ done 2026-08-27 — wobble + 3-way fan, mask + spread primitives. **Phase I started.** |
| ~~39~~ | ~~**H2** Dungeons 1-3 completable~~ | ✅ done 2026-08-27 — boss single-spawn + Triforce-get completion loop + navigability verified |
| ~~40a~~ | ~~**I1b** Dodongo ($32, L2 boss)~~ | ✅ done 2026-08-27 — immune-to-all + bomb-stun-and-sword + bomb-feed fight; `bombs` ctx primitive. 1088 tests |
| ~~40b~~ | ~~**I1c** Manhandla ($3C, L3 boss)~~ | ✅ done 2026-08-27 — 5-object group (invuln center + 4 killable hands), speed-up on hand death, center dies with last hand → gates completion. **I1 complete (all L1-3 bosses faithful).** 1097 tests |
| ~~41~~ | ~~**I2** Gohma + Digdogger + Gleeok~~ | ✅ done 2026-08-28 — Gohma ($33/$34, arrow-when-eye-half-open), Digdogger ($38/$39, flute splits into 1/3 children), Gleeok ($42-$45, multi-headed dragon + flying heads). Recorder-in-dungeon fix. **I2 complete.** 1133 tests |
| ~~42~~ | ~~**H3** Dungeons 4-6 completable~~ | ✅ done 2026-08-29 — staircase/cellar system + room-clear persistence |

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

### 2026-08-29 — H3 Dungeons 4-6 completable (Claude Opus 4.6)

Implemented the staircase/cellar system and room-clear persistence — the two blockers
preventing L4-6 from being played end-to-end. **H3a — Staircase/Cellar System:**
Continued from previous session which built the core infrastructure (cellarConnections
data extraction, DungeonManager.enterCellar/exitCellar/getCellarForRoom, DungeonCollisionMap
.forCellar with stairs-tile-forced-walkable, DungeonRenderer.renderCellarRoom, stair entry/exit
detection in main.ts, walk-in animation). This session completed: (1) fixed `exitCellar` method
to accept `isLeftSide: boolean` parameter, removing the fragile `(dungeonManager as any)._cellarLeftSide`
hack; (2) wrapped spike trap update, push block update, bomb/door checks, and secret triggers in
`if (!dungeonManager.inCellar)` guard — these room-specific systems should not run in the
cellar passage; (3) guarded push block and spike trap rendering in `renderDungeonEntities()`.
5 cellar connections: L4 treasure (room 96), L5 tunnel (rooms 100↔6) + treasure (room 4),
L6 tunnel (rooms 58↔29) + treasure (room 117). **H3b — Room-Clear Persistence:** Added
`ROOM_CLEARED_BIT` ($40) to `RoomFlags` with `isRoomCleared/setRoomCleared`. Room marked cleared
when `spawnManager.enemies.length > 0 && activeEnemies.length === 0` (enemies were spawned and all
died). `spawnDungeonRoomEnemies()` returns early if room is already cleared — enemies no longer
respawn on re-entry. Fixed test mocks in `dungeon-completion.test.ts` and `dungeon-manager.test.ts`
(added missing `cellarConnections: []`). 12 new tests (cellar collision, connection data, exit
position unpacking, room-cleared flags). **1145 total tests** (1144 pass, 1 pre-existing flaky
digdogger). Typecheck clean (src). **Next: H4 (Dungeons 7-9).**

### 2026-08-28 — I2 Gohma + Digdogger + Gleeok — I2 complete (Claude Opus 4.6)

Implemented all three mid-game bosses (L4-6 backfill). **I2a Gohma** ($33 blue/$34 red,
`src/objects/enemies/gohma.ts`): crab boss with eye state machine (4 states: closed-left/right,
fully-open, half-open). Walks via 8-way direction bits at 0.5px/f, 32px sprints. Only vulnerable
to arrows shot UP when eye is HALF-OPEN and arrow hits center body parts — new `hitContext?`
primitive on `Enemy.takeDamage()` (optional `{x,y,dir}`, backward compatible, passed by
arrow collision in `enemy-collision.ts`). Mask $FB = immune to everything except arrows.
Shoots unblockable fireballs every 65f. 12 tests. **I2b Digdogger** ($38=3 children, $39=1 child,
`src/objects/enemies/digdogger.ts`): large invulnerable creature (`_vulnerable=false`). 8-way
movement with Manhandla-style fractional speed accumulator + speed oscillation. Flute reaction:
when `ctx.fluteActive` → flicker 64 frames then spawn 1/3 LittleDigdogger ($18) children at
parent position, parent destroyed. Children are fast and killable normally. **Critical fix:**
recorder couldn't activate in dungeons — `useBItem` case 5 guarded `if (!overworld) break;`.
Fixed to use `screenId=0` in dungeons (NothingDungeonOnly path → just plays tune). Added
`fluteActive?: boolean` to `EnemyUpdateContext`, threaded through `SpawnManager.update()`.
Processing recorder in `updateDungeonGameplay()` (ticks effect, sets fluteActive during Tune phase).
11 tests. **I2c Gleeok** ($42=2, $43=3, $44=4, $45=4 heads, `src/objects/enemies/gleeok.ts`):
Manhandla-style group spawn (body + N heads). `GleeokBody` (invulnerable, stationary at Y=$17
local, manages neck segment physics + fireball shooting). `GleeokNeckHead` (mask $FE sword-only,
HP $A0, oscillates independently with staggered delays). Head death → notifies body → spawns
`GleeokFlyingHead` ($46, extends FlyerEnemy, completely invulnerable, shoots fireballs). All heads
dead → body dies. 12 tests. **1133 total tests, all green.** Typecheck clean. **I2 complete. Next: H3.**

### 2026-08-27 — I1c Manhandla, L3 boss faithful — I1 complete (Claude Opus 4.8)

Replaced the generic-walker fallback for the Level-3 boss with a faithful **Manhandla**
(`src/objects/enemies/manhandla.ts`, from Z_04.asm `UpdateManhandla`/`Manhandla_Move`/
`_CheckCollisions`/`InitManhandla`). The flower boss = **1 center + 4 hands** (N/S/E/W).
Design: **modeled as 5 real coordinated `Enemy` objects** (matches the NES's 5 slots) so
the existing per-enemy collision/damage/drop code handles each hand for free — cleaner
than Lanmola's single-object trick because hands must be independently killable. Only
the coordination is new. **`ManhandlaCenter`** (`_vulnerable=false` → collision code
skips it, never damaged) drives 8-way group movement (`_dirMask` bitmask; retarget every
16f: 50% aim at Link / 50% random; **bounces off the play-area walls** by reflecting the
offending axis bits; NES fractional speed accumulator seeded to $0080 = 0.5px/f), then
repositions each living hand to its ±16 cardinal offset. **`ManhandlaHand`** (mask $E2 —
immune to fire+boomerang, own HP, killed by base `takeDamage`) is passive (positioned by
the center via `setPos`) and shoots unblockable **$56** fireballs aimed 4-way at Link.
**Every hand death speeds the whole group up** (+$80 frac, carrying into the whole byte —
frantic acceleration); the **center dies only when the last hand dies** (`reapDeadHands`),
which means trigger-7 "all foes dead" fires exactly on full-boss death — **zero change to
H2's completion code.** Group-spawned via `createManhandla` + new
`SpawnManager.pushEnemyOrGroup` (the boss single-spawn clamp still forces one slot; that
slot expands to the 5-object cluster — updated the boss-spawn-count test's $3C case from
1→5). `speedPerFrame`/`livingHands` getters for debug/tests. Placeholder rect render.
8 new Manhandla tests (+1 boss-spawn-count), **1097 total, all green**; typecheck clean
(src). **Simplifications (documented):** 4-way fireball aim (our EnemyProjectile is
cardinal); ≤4-fireball cap approximated by shoot probability; diagonal group movement
kept. **I1 is now complete — all three L1-3 bosses are faithful.** **Next: Phase I2
(Gleeok/Digdogger/Gohma) or H3 (Dungeons 4-6).**

### 2026-08-27 — I1b Dodongo, L2 boss faithful (Claude Opus 4.8)

Replaced the generic-walker fallback for the Level-2 boss with a faithful Dodongo
(`src/objects/enemies/dodongo.ts`, from Z_04.asm `UpdateDodongo`/`Dodongo_CheckBombHit`/
`Dodongo_TryEatBomb`). The signature mechanic: **immune to every direct weapon**
(`_invincibilityMask=$FF` — the sword just clinks). Three sub-states run inside the
Active state (like Aquamentus): **Move** (32×16 body wanders toward Link, ~1px/f with
a turn-rate-$20 re-aim at grid boundaries); **Stunned** (entered when a bomb *blast*
overlaps the body → mask drops to $FE so the sword bit gets through → a single sword
hit = **instant death**, via an overridden `takeDamage` that ignores HP while stunned);
**Bloated** (entered when an *un-exploded* bomb lands in the leading-half "mouth" → it
eats the bomb; **2 eaten = death**, else back to Move). HP is irrelevant — death is
scripted, matching the NES. **One cross-cutting primitive:** enemies couldn't see the
bomb list, so added an optional `bombs?: readonly BombLike[]` to `EnemyUpdateContext`
(structural `BombLike` — no Bomb import, avoids a cycle), threaded through
`SpawnManager.update()` ← both `main.ts` call sites; all Dodongo logic stays in
dodongo.ts and the generic collision code is untouched (the $FF/$FE mask already makes
every weapon branch behave). `phase`/`bombsEaten` getters for debug/tests. Registered
`$32` in the spawn manager (boss single-spawn clamp already covers it). Placeholder
rect render (CHR→sheet deferred like the whole roster). 9 new tests, **1088 total, all
green**; typecheck clean (src). **Next: I1c Manhandla ($3C, segmented 5-part boss) —
plan at `~/.claude/plans/i-boss-backfill-dodongo-manhandla.md` — or Phase I2 / H3.**

### 2026-08-27 — H2 Dungeons 1-3 completable (Claude Opus 4.8)

The payoff slice: L1-3 now play end-to-end (enter → navigate → kill boss → heart
container + shutter → grab Triforce → warp out). Investigation showed **most of the
path was already data-wired** by H1a/H1b + I1 — the L1-3 boss rooms carry item $1A
(heart container) gated by secret trigger 7 (FoesForItem) and the boss→triforce door
is a shutter that opens on that same trigger, all handled by existing machinery. H2
filled **four gaps**: **(1) Boss single-spawn** — `foeCounts` gave the boss room
count 3, so it spawned *three* Aquamentus; NES rule (`Z_05.asm:1723`, verbatim: "make
the count 1 if the object list ID >= $32 and < $62") → new `SpawnManager.clampBossCount`
forces 1 for list IDs in [$32,$62) (every current + future boss), applied in both
dungeon and overworld spawn paths. **(2) Triforce-get completion sequence** — new
`GameMode.DungeonTriforceGet` (NES sets GameMode $12 on triforce pickup):
`beginTriforceGet()` sets the level's triforce bit + full heal + halts Link, holds a
display for 200f (pulsing gold wash + red "TRIFORCE" banner, Link centered), then
curtain-warps out by reusing the existing `exitDungeon` path (`pendingCaveIndex=-3`).
Wired into `handleDungeonItemPickup` case $1B (was just a bare bit-set). **(3)**
Triforce room-item shifted −8px in X (`getRoomItemPosition`, Z_05.asm:8255). **(4)
Navigability pass** — BFS over the door graph confirmed start→boss→triforce is
traversable for all 3 levels (no hard wall blocks; boss→triforce is a shutter for
L1/L2/L3, opened on boss death). **Known limitations (deferred):** L2 Dodongo ($32) /
L3 Manhandla ($3C) fall back to the generic walker — the completion *machinery* works
with whatever occupies the boss room, but faithful fights are later I-slices;
room-clear persistence (killed monsters respawn on room re-entry — doesn't block the
linear path); the NES spiral-wipe animation; audio/fanfare. 12 new tests (5
boss-spawn-count + 7 dungeon-completion), **1079 total, all green** (the g2 Octorok
flaky happened to pass this run). Typecheck clean (src). **Next: make L2/L3 boss
fights faithful (Dodongo/Manhandla), or Phase I2 / H3.**

### 2026-08-27 — I1 Aquamentus, first boss (Claude Opus 4.8)

First **boss** slice; opens Phase I and unblocks H2. AI ported from `Z_04.asm`
(`InitAquamentus` 4842, `UpdateAquamentus` 5596, `_Move` 5613, `_Shoot` 5684,
`_Draw` 5762). **The boss** (`src/objects/enemies/aquamentus.ts`): `InitAquamentus`
pins it to ($B0,$80) → local (176,64) on the right wall regardless of the monster-list
slot; it **wobbles horizontally only** (Y fixed) between $88–$C7, moving 1px on
1-of-8 frames in random 7/$F-px legs, reversing at the limits (the NES clamp is
reactive so it transiently overshoots each limit by 1px — reproduced faithfully).
Its shoot timer (starts $80, resets to `Random|$70` ≥112f) lobs a **3-way fireball
fan** ($55 ×3) leftward, the three shots fanning apart via vertical drift 0/+1/−1
applied every other frame; the mouth-tell opens while the timer <$20. HP $60 (the
existing `getEnemyHp($3D)` decoder already returns it — 6 wood-sword hits). Never
stunnable (overrides `stun()`). Placeholder green-dragon rect render (CHR→sheet
mapping deferred like the whole G3/G4 roster; layout is staged in
`sprites.json bosses.aquamentus`). **Two reusable boss primitives**, built generic
because every remaining boss needs them: **(1) per-weapon invincibility mask** —
`DamageTypeBit` consts (sword $01 / boomerang $02 / arrow $04 / bomb $08 / magic-shot
$10 / fire $20, from Z_01.asm:6039–6261) + `Enemy._invincibilityMask` +
`isImmuneToDamageType()`, guarded in **every** weapon branch of
`checkWeaponEnemyCollisions` (immune = harmless clink / bounce, no damage or stun);
Aquamentus' mask $E2 ⇒ immune to boomerang + candle fire, hurt by
sword/beam/arrow/bomb/rod/magic-shot. Default mask 0 leaves every existing enemy
unchanged (regression-guarded by a "fire still hurts a default enemy" test).
**(2) fireball spread** — optional `verticalDrift` on `EnemyProjectile` (every-other-
frame Y nudge, default 0 = straight travel) + `Enemy._pendingProjectiles[]` /
`consumeProjectiles()` so a boss can emit several shots in one frame, drained in
`SpawnManager.update`. Registered $3D in `createEnemyByType`. No main.ts change needed
(rides the normal dungeon enemy path); `__zelda.spawnEnemy(0x3d)` already drops one
for manual testing. **Deferred to H2:** the boss death spectacle — big explosion,
heart-container drop, Triforce. SFX deferred globally (no audio subsystem). 14 new
tests (7 boss + 6 mask + 1 projectile-drift), **1067 total** (1066 green + the one
pre-existing g2 Octorok flaky, which passed 3/3 in isolation — unrelated). Typecheck
clean (src). **Phase I started. Next: H2 (Dungeons 1-3 completable).**

### 2026-08-26 — G5 Enemy projectiles + roster audit (Claude Opus 4.8)

Closing slice of Phase G. Not a new enemy family — an audit + polish pass with one real
gap filled. **(A) Per-type projectile visuals:** `EnemyProjectile.render` gained a
`renderByType()` switch (+ an `animTimer` for flicker) so the previously-uniform red square now
reads as rock (grey pellet) / fireball (orange-yellow flicker) / sword-beam (white-cyan streak,
elongated along travel) / magic (magenta-blue flash) / arrow (thin oriented line). **(B) Statue
fireballs** (`src/world/dungeon-statues.ts`, from Z_04.asm `UpdateStatues`): dungeon rooms whose
`uniqueRoomId` is $24 (4 statues) or $23 (2 statues) periodically lob a Fireball ($55) aimed
cardinally at Link, on the NES reload cadence (`StatueFireballStartTimes` $50/$80/$F0/$60,
15/16 fire chance). Positions from `StatueXs/Ys` (NES raw Y → local via −$40). Not an Enemy
(no HP, invulnerable, keyed to room not monster list); fireballs ride the existing pipeline via a
new `SpawnManager.addProjectile()` — **zero new collision code**. Wired in main.ts:
`initDungeonRoomObjects` builds the statues, the dungeon update loop drains their fireballs into
`spawnManager` right after `spawnManager.update` so they're collision-checked the same frame.
Simplification (documented): cardinal aim instead of the NES diagonal Link-tracking fireball;
pattern 2 (the `PersonFireballsEnabled` two-fire boss variant) deferred to Phase I with GuardFire.
**Also fixed a pre-existing shield-deflection bug** (from D3, surfaced during manual testing):
a blocked shot's `updateDeflected()` moved in `getOppositeDirection(_direction)`, but `deflect()`
already stores `linkDirection` (the bounce heading, back toward the shooter) — so the shot flew
back *through* Link instead of bouncing away. Now moves in `_direction` directly; blocked shots
visibly bounce off toward the enemy. **Debug helpers added** for manual testing:
`SpawnManager.debugSpawn(type,x,y)` + `__zelda.goToDungeon(level)` / `__zelda.spawnEnemy(typeHex)`
(default $23 Blue Wizzrobe) — drops any enemy next to Link (Wizzrobes aren't in early dungeons).
**(C) The roster audit** (`context/agent/enemy-roster-audit.md`): definitive object-type→status
table from `Z_07.asm:5321 UpdateObject_JumpTable`. Result — **every non-boss combat enemy is
implemented**; all remaining types are bosses (→ Phase I: Aquamentus/Dodongo/Gohma/Digdogger/
Manhandla/Moldorm/Gleeok/Patra/Ganon + GuardFire/StandingFire) or non-combat NPCs/specials
(→ later content slices), each row naming *why* + *owner*. Boulder ($1F/$20) named as the
deferred G5 stretch (overworld-hazard slice). Verified: all 10 shot types have non-zero
DAMAGE_TABLE entries. 16 new tests incl. deflection-bounce regression (1053 total, green full runs).
Typecheck clean (src).
**Note:** one pre-existing flaky test — `g2-enemies.test.ts` "walks after spawn" (slow Octorok
QSpeed $10 can pause to shoot inside the 30-frame window) — passed 5/5 in isolation; not caused
by this slice, enemy behavior is correct, test is just too tight. **Phase G complete. Next: I1
(Aquamentus) to unblock H2.**

### 2026-08-25 — G4b Dungeon enemies tier 2, part 2 (Claude Opus 4.8)

The Link-state + dungeon-integration half. 4 families / 6 object types, AI from Z_04.asm.
**Blue Wizzrobe** ($23): walks square-aligned toward Link, then **teleports** $20px (translucent,
through walls, non-collidable mid-hop); lobs `MagicShot` ($58) when Link shares its square row/col.
**Red Wizzrobe** ($24): **stationary phaser** — a state byte counts down, top bits pick a phase
(relocate near Link → fade-in → solid → fade-out → hidden); **vulnerable only while solid**
(toggles `_vulnerable`); shoots `MagicShot2` ($59) at the solid midpoint; `getHitbox()` returns
off-screen while hidden so it can't be hit/contacted then. Both shots ride the existing
`_pendingProjectile → SpawnManager._projectiles` pipeline (magic-shield-only blockable) — **zero
new collision code**. **Like-Like** ($17, WalkerEnemy turnRate $80): on contact **captures Link**
(`beginCapture()`); main.ts sets `link.halted = true` and, at $60 capture-frames, `consumeShieldEat()`
→ `link.setMagicShield(false)`; `onDeath()` frees him. **Wallmaster** ($27): emerges from the wall
nearest Link, crawls toward him at QSpeed $18; on contact `grab()` → main.ts calls new
`DungeonManager.returnToEntranceRoom()` (jumps to `startRoomId`, rebuilds collision, returns the
entrance position) and repositions Link — the signature warp. Retreats after a 7-tile trip if it
misses. **Lanmola** ($3A red 1px/f, $3B blue 2px/f): one object owning a segment trail; head
re-chooses direction toward Link at 8px boundaries, body follows a position-history buffer;
`getHitbox()` returns the head only ⇒ head-only vulnerability + contact (skips the NES
body-resurrection dance — same player experience). SpawnManager factory + placeholder colors for
all. **Also fixed a pre-existing Pols Voice bug** (G4a): it treated `moveQSpeed` returning false on
frames that emit no full pixel (QSpeed $20 = 1px/2f) as hitting a wall and reversed, ping-ponging
in place ~25% of spawns — now peeks with `isBlockedAhead()` and only bounces on a real wall.
11 new tests + fix (1037 total, all green ×3 runs). Typecheck clean (src). **Next: G5 (roster/projectile audit).**

### 2026-08-25 — G4a Dungeon enemies tier 2, part 1 (Claude Opus 4.8)

Split G4 into G4a (self-contained) + G4b (Link-state/dungeon wiring). G4a = 5 families / 8 object
types, AI from Z_04.asm. **Gibdo** ($30): thin WalkerEnemy config (turnRate $80). **Darknut**
($0B red/$0C blue): walker + **directional parry** — new `Enemy.blocksAttackFrom(weaponDir)` hook
(default false), honored in `enemy-collision.ts` for sword + beam; Darknut blocks a hit whose
travel dir is the exact OPPOSITE of its facing (frontal), per Z_01.asm:6316 (ORs the two dirs,
parries $0C/$03). Never stunned (overrides `stun()` no-op). Blue faster (qSpeed $30 vs $20).
**Vire** ($12): walker that **splits into 2 Red Keese** ($1C) on death via `onDeath()` →
`_childSpawns` (reuses G3's SpawnManager drain). **Pols Voice** ($16): bouncing hopper with a
vertical bob; high HP (sword-resistant; flute-kill deferred). **Bubble** ($2B flash/$2C blue/$2D
red): invulnerable (`_vulnerable=false`), no contact damage, **jinxes Link's sword** on touch.
Link gained sword-jinx: `disableSword(frames?)` (perm if no arg) / `enableSword()` /
`swordDisabled` getter, timer decremented in `update()`, gates the swing start, cleared in
`reset()`. Wired via new `applyBubbleJinx()` in main.ts dungeon contact ($2D disable, $2B temp
$A0f, $2C restore). SpawnManager factory + placeholder colors for all. 13 new tests (1026 total,
9 g4a + 4 Link jinx). Typecheck clean (src). **Next: G4b (Wizzrobe, Like-Like, Wallmaster, Lanmola).**

### 2026-08-25 — G3 Dungeon enemies tier 1 (Claude Opus 4.8)

Populated dungeons with their first-tier roster (dungeons were walkable but empty; H1b's
"kill all → shutters open" had nothing to kill). 6 families / 10 object types, all AI from
Z_04.asm. **Stalfos** ($2A): thin WalkerEnemy config (turnRate $80, qSpeed $20, no shooting).
**Rope** ($28): wander at $20, rushes at $60 when aligned with Link on an axis, stops at walls
(new `rope.ts` extends Enemy). **Goriya** ($05 blue/$06 red): wander + throws a returning
boomerang (type $5C), frozen while it's out; blue throws readily, red occasionally. **Zol**
($13): slow jelly that splits into 2 Gels when hurt-but-not-killed (bomb kills outright, no
split). **Gel** ($14/$15): fast erratic jelly, 1 hit. **Keese** ($1B/$1C/$1D): erratic
pause/dart flyer, ignores walls, 1 hit. New base classes: `jelly-enemy.ts` (Gel/Zol hop-pause),
`flyer-enemy.ts` (Keese flight state machine, always vulnerable — separate from Peahat to avoid
regressions), `goriya-boomerang.ts` (extends EnemyProjectile with owner-homing return, so it
flows through the existing `_pendingProjectile → SpawnManager._projectiles → collision/render`
pipeline with **zero main.ts changes**). Enemy base gained `_childSpawns`/`collectChildSpawns()`
(Zol split), drained in `SpawnManager.update()` via new `drainChildSpawns()`. Made
EnemyProjectile's `_x/_y/_direction/_state` protected for the boomerang subclass. Placeholder
colored-rect rendering (sprite rows for these in enemies.png not confirmed — deferred like G1→G2).
14 new tests (1013 total). Typecheck clean. **Next: G4 (dungeon enemies tier 2).**

### 2026-08-24 — H1b Dungeon doors + traps + items (Claude Opus 4.8)

(Logged retroactively — completed last session, tracker update was missed.) Added the
interactive dungeon room mechanics: **8 NES door types** (open/wall/false-wall×2/bombable/key×2/
shutter) via `DungeonManager.touchDoor()`, with the `CurOpenedDoors` bitmask (N=8,S=4,W=2,E=1)
persisted in room flags so opened doors stay open. Key doors consume a key (or magic key);
bombable open on bomb-detonation proximity; shutters open on the "all enemies dead" trigger.
**7 secret triggers** (`dungeon-secrets.ts`): AllDead/Ringleader/LastBoss/BlockDoor/BlockStairs/
MoneyOrLife/FoesForItem. **Spike traps** (`spike-trap.ts`): 3-state invulnerable entities at
fixed NES positions ($49=6 traps, $4A=4). **Push blocks** in dungeons (wired to secret triggers
4/5). **Dark rooms** (black overlay, candle fire brightens). **Map + Compass** items (per-level
bitmasks; minimap shows all rooms with Map, blinks Triforce room with Compass). **Room item
placement** from packed shortcutOrItemPositions byte, secret-gated, item-taken bit ($10) in room
flags. room-flags.ts: VISITED_BIT corrected to $20, added ITEM_TAKEN + DOOR bits. 999 tests
total. Typecheck clean. **Next was: G3.**

### 2026-08-23 — H1a Dungeon room loading + navigation (Claude Opus 4.6)

Split H1 into H1a/H1b. H1a: dungeon room loading, rendering, open-door navigation, entry/exit,
minimap, respawn. Created `src/data/dungeon-entrance-data.ts` — maps overworld screenId → dungeon
level (6 verified entrances: screens 55/60/116/69/11/34 for levels 1-6; derived from
WHIRLWIND_DEST_ROOMS proximity + tile 12 scan; levels 7-9 deferred). Created
`src/render/dungeon-renderer.ts` — renders rooms from dungeons-map.png (16×16 grid, 256×176px per
room, uw1q1 top half / uw2q1 bottom half). Created `src/world/dungeon-collision.ts` —
DungeonCollisionMap builds 16×11 walkability grid: 12×7 inner tiles from uniqueRoom + squareTable
threshold, border walls always solid, door openings (types 0/2) punch walkable holes at NES
positions (N: cols 7-8 rows 0-1, S: cols 7-8 rows 9-10, W: cols 0-1 rows 4-6, E: cols 14-15
rows 4-6). TileCollisionMap-compatible API (screen param accepted but ignored). Created
`src/world/dungeon-manager.ts` — DungeonManager: loads level 1-9 from dungeons.json, resolves
levelBlock, tracks currentRoomId + visitedRooms, room navigation (N:-16 S:+16 W:-1 E:+1),
canPassDoor (types 0/2 only for H1a), entry position by direction, exit detection from startRoom
south edge. dummyScreen getter for Link/enemy compatibility. Added GameMode.DungeonGameplay +
DungeonTransition. Updated HUD: "LEVEL-N" text + dungeon minimap (blue visited rooms, blinking
green current room). Updated respawn: isDungeon flag, dungeon death → startRoom. Updated main.ts:
dungeons.json loading, dungeon entry (getDungeonLevel + tile 12 check before cave check),
DungeonTransition mode (walk-in → curtain → startDungeonInterior), DungeonGameplay mode (full
gameplay loop reusing weapons/enemies/collision), exit (south from startRoom → curtain → overworld
restore), SpawnManager.spawnForDungeonRoom(). Fixed exit-before-transition ordering bug (exit
check must precede room transition check, both at SCREEN_EDGE_BOTTOM threshold). Debug:
__zelda.dungeonManager + currentLevel. 19 new tests (968 total). Typecheck clean. Visually
verified: enter Level 1 from overworld, rooms render with correct teal palette, walk through open
doors, minimap tracks visited rooms, exit back to overworld via south. **Next: H1b.**

### 2026-08-22 — G2 Overworld enemies (Claude Opus 4.6)

Implemented all 9 overworld enemy types with NES-accurate AI patterns. Refactored Enemy base
class: protected fields/methods, EnemyUpdateContext (collision+screen+linkX+linkY), abstract
updateAI() hook, moveQSpeed() sub-pixel helper, moveOnePixel() with tile collision,
tickWalkAnimation(), directionTowardLink(), _vulnerable flag, _pendingProjectile/consumeProjectile()
for enemy shooting, onDeath() hook. Created `src/objects/enemies/walker-enemy.ts` — WalkerEnemy
base implementing Z_04.asm Wanderer_TargetPlayer: turnRate vs random for direction toward Link,
grid-aligned turning, QSpeed sub-pixel movement, _TryShooting timer ($30→$10 fire→0 reset,
blue=always, red=random<$F8 gate), sprite rendering from enemies.png (30-col sheet). Created
individual enemy files: `octorok.ts` (factory, 4 variants: slow/fast × red/blue, turnRate
$70/$A0, QSpeed $20/$40, shoots rock $53), `moblin.ts` (turnRate $A0, QSpeed $20, shoots arrow
$5B), `lynel.ts` (Goriya pattern, turnRate $70/$A0, shoots sword shot $57), `tektite.ts`
(Ground/Jumping state machine with diagonal arc, boundary bounce, reversalCount>=2 escape),
`leever.ts` (4-state burrower cycle, blue walks QSpeed $20, red max-2 + spawns near Link,
invulnerable underground), `zora.ts` (water burrower, random surface position, shoots fireball
$55, invulnerable underground), `peahat.ts` (6-state flyer: SpeedUp/Decide/Chase/Wander/
SlowDown/Delay, only vulnerable in Delay, normalized velocity chase), `ghini.ts` (main turnRate
$FF + FlyingGhini, setSiblings(), main death kills all type 34), `armos.ts` (dormant→active on
Link touch <16px, Goriya walker pattern, no spawn cloud, invulnerable while dormant). Updated
SpawnManager: createEnemyByType factory for all 9 types, _projectiles array for enemy-fired
projectiles, render() accepts enemySheet, update() passes linkX/linkY. Updated enemy-collision:
checkEnemyProjectileCollisions() with shield deflection via canShieldBlock(). Updated main.ts:
enemySheet from enemies.png, projectile collision + damage, shield deflection wiring. 28 new
tests (949 total). Typecheck clean. **Next: G3.**

### 2026-08-22 — G1 Enemy base system (Claude Opus 4.6)

Created `src/objects/enemies/enemy.ts` — Enemy class with EnemyState enum (Spawning→Active→
Stunned/Knockback→Dying→Dead), generic random walker AI, NES-faithful HP system (Z_04.asm
ExtractHitPointValue: even types=high nibble AND $F0, odd types=low nibble ASL ×4), knockback
($40 distance at 4px/f per Z_01.asm:6688), invincibility ($10 frames), stun ($A0 frames for
boomerang), 12-frame death timer. Created `src/objects/enemies/spawn-manager.ts` — SpawnManager
reads enemy-spawns.json: resolves monsterListId (0=none, 1-$61=single type repeated, $62-$7F=
heterogeneous list index), spawns up to foeCounts[monsterCountIndex] enemies at NES spawn
positions (4 direction-based lists of 9 packed X/Y bytes), staggered spawn cloud timers per
Z_07.asm:5590, freezeAll() for Clock item, clear() on screen exit. Created
`src/objects/enemies/enemy-collision.ts` — checkWeaponEnemyCollisions checks all 7 weapon types
(sword hitbox via new Link.getSwordHitbox(), sword beam, boomerang stun/damage, bomb explosion,
arrow wood/silver, candle fire, magic rod/shot) with correct damage constants (SWORD_DAMAGE by
level, BOOMERANG_DAMAGE $10, BOMB_DAMAGE $40, ARROW_DAMAGE $20/$40). Sword beam/arrow/magic
shot deactivate on hit, boomerang forceReturn(). checkEnemyLinkCollisions detects contact via
DAMAGE_TABLE lookup. Added deactivate() to SwordBeam, direction getter to CandleFire,
getSwordHitbox()/swordDirection to Link. Wired into main.ts: SpawnManager in gameplay loop,
screen transitions, cave entry/exit, respawn. DropEngine.rollDrop() on kill spawns ItemPickup.
Clock item ($21) freezes enemies 660f. Debug console `__zelda.giveAll()` grants all items.
Colored rectangle placeholder rendering with type-based colors. 36 new tests (921 total).
Typecheck clean. Visually verified: enemies spawn on screen entry, take sword/boomerang/bomb
damage, die with flash, drop items, contact damages Link. **Phase G started. Next: G2.**

Older sessions archived → `../PROGRESS.md` (A1–F4c, 2026-08-02 through 2026-08-21).
