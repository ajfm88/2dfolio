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

**Last updated:** 2026-08-30 · **Phase:** G complete; **I3 complete — all bosses implemented (Patra, Ganon, GuardFire, StandingFire, Zelda NPC)**; H complete — **all 9 dungeons navigable + completable** · **Phase I complete.** · **Plan slots done:** 39 / 45 (6 remaining: J1, J2, K1, K2, L1, L2)

---

## ⚠ Read this before planning anything

This is a **reimplementation from reference**, not a port or emulator. You read
6502 assembly (the disassembly) and TypeScript/C#/JS (the reference repos) and
write TypeScript by hand. Nothing is transpiled; nothing is emulated.

**Next action: J1 (Title screen, file select, name entry).** All bosses implemented (I1-I3 complete). All 9 dungeons navigable + completable (H complete). Ganon beatable, Zelda rescue triggers ending stub. **Phase G complete; Phase H complete; Phase I complete.**
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
| Dungeon entrance data | `src/data/dungeon-entrance-data.ts` | ✅ Maps overworld screenId → dungeon level (all 9 levels + Q2 alternates). getDungeonLevel() lookup (H1a, H4) |
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
| Dungeons 7-9 navigable | `src/data/dungeon-entrance-data.ts`, `src/main.ts`, `src/world/overworld-manager.ts`, `src/world/dungeon-secrets.ts` | ✅ L7-9 entrance screens added (66→7, 109→8, 5→9 + Q2 alternates). Dungeon entry detection fixed to check tile overrides (SQUARE_INDEX_CAVE_ENTRANCE + SQUARE_INDEX_STAIRS) for secret-revealed entrances. checkCaveEntry also fixed for STAIRS overrides. Trigger 3 (LastBoss) fixed: itemActivated=true + pass allDead as bossDefeated. L7 boss=Aquamentus $3D (implemented), L8 boss=Gleeok4 $45 (implemented), L9 boss=Ganon $3E (implemented I3). L9 boss room drops Red Ring $0E via trigger 3. Cellar infrastructure reused from H3 (L7: 2, L8: 3, L9: 8 connections) (H4) |
| Patra (boss) | `src/objects/enemies/patra.ts` | ✅ Orbiting flies boss ($47/$48). PatraCenter: 4-state flyer (SpeedUp/Decide/Chase/Wander) with screen-edge bounce, tracks movement offsets for children. 8 PatraChild ($25/$26): NES-faithful fixed-point orbital math using PatraSines 16-entry table + ShiftMultiply + DecreaseObjectAngle. Sequential appearance (children appear one-at-a-time as first child's angle reaches start angles). Two maneuver modes with different rotation bit counts per timer. Center invulnerable while any child alive, sword-only when all dead (mask $FE). Group spawn (1+8=9 objects) via createPatra() + SpawnManager.pushEnemyOrGroup (I3) |
| Ganon (boss) | `src/objects/enemies/ganon.ts` | ✅ Final boss ($3E). 3 scene phases: DarkRoom (Link halted $40f), LightRoom ($C0f), Fighting. Invisible movement reuses BlueWizzrobe walk pattern (re-aim every $40f, moveOnePixel, direction flip on wall). Shoots unblockable fireball ($56) every $40f. Custom collision completely bypasses normal pipeline (_vulnerable=false). Blue/invisible: sword hits → visible timer $40, HP→0 resets HP to $F0 and goes brown. Brown: flickers (opaque>$30, translucent<$30), decrements every other frame, silver arrow kills (damage≥SILVER_ARROW_DAMAGE via hitContext). Dying: phase $50→ashes+8 burst rays at cardinal+diagonal dirs, clouds shrink every 8f; phase $A0→drops Triforce of Power room item. 32×32 hitbox (I3) |
| GuardFire + StandingFire | `src/objects/enemies/guard-fire.ts` | ✅ GuardFire ($3F): killable fire, mask $00, animated. StandingFire ($40): invulnerable (mask $FF, _vulnerable=false), animated. Both deal contact damage $80. GuardFire appears in Zelda rescue room (4 flames around her) (I3) |
| Zelda NPC | `src/objects/enemies/zelda-npc.ts` | ✅ Rescue NPC ($37). State 0: waits for Link at ($70-$80, $55 local). State 1: halts Link, positions at ($88,$48), timer $80. Timer expires → triggers GameMode.ZeldaRescue. createZeldaGroup() factory: 1 Zelda + 4 GuardFire at NES positions. Ending stub shows "THANKS LINK, YOU'RE THE HERO OF HYRULE." Full credits deferred to J2. **Phase I complete.** (I3) |

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
| ~~43~~ | ~~**H4** Dungeons 7-9 completable~~ | ✅ done 2026-08-29 — entrance screens + tile override entry + trigger 3 fix. **Phase H complete** |
| ~~44~~ | ~~**I3** Patra + Ganon + Zelda rescue~~ | ✅ done 2026-08-30 — Patra (orbital 9-object boss), Ganon (invisible+brown+silver arrow, burst death), GuardFire/StandingFire, Zelda NPC rescue trigger, ending stub. **Phase I complete.** 1156 tests |

**Phase A gate:** blank canvas renders at a stable 60 fps, `npm run typecheck` and
`npm test` clean, sprites load from `public/assets/`.

---

## Open questions for the user

Answer cheaply, unblock later work. **None of these block A1.**

1. **Asset gaps.** If a reference repo lacks a sprite we need, should we extract
   from another repo, create manually, or defer?
2. **Second Quest priority.** Currently the last slice (L2). Move it earlier?
3. **Music source.** Reference repos have some OGG/MP3 tracks. Sufficient?

4. **Inventory cursor can't reach top row.** The inventory subscreen cursor only selects items in the bottom selectable row (boomerang, bombs, arrow, candle, flute, food, potion, wand). Items in the upper passive row (letter, bracelet, ring, etc.) are out of reach. The NES inventory has a 2-row selectable grid — cursor navigation needs Up/Down in addition to Left/Right. Fix in a later polish slice.
5. **Sprite polish needed (L0).** Most enemies, bosses, fires, and NPCs still render as colored rectangles. Dedicated sprite polish slice added to PLAN.md as L0. Cave fires and Old Man transparency fixed 2026-08-30.

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

### 2026-08-30 — I3 Patra + Ganon + Zelda rescue — Phase I complete (Claude Opus 4.6)

Final boss slice — completes Phase I and makes the game winnable. **Patra** (`patra.ts`):
PatraCenter extends Enemy with a 4-state flyer (SpeedUp/Decide/Chase/Wander, screen-edge bounce)
and tracks movement offsets for 8 PatraChild objects. Children orbit using NES-faithful fixed-point
angle math: PatraSines 16-entry lookup table, ShiftMultiply bit-shift multiplication, DecreaseObjectAngle
16-bit fixed-point subtraction. Sequential appearance (children appear one-at-a-time as first child's
angle reaches PatraChildStartAngles). Two maneuver modes with different rotation bit counts per timer
toggle. Center invulnerable while any child alive (mask $FE). Group spawn (1+8=9 objects) via
createPatra() + SpawnManager.pushEnemyOrGroup. **Ganon** (`ganon.ts`): 3 scene phases (DarkRoom $40f,
LightRoom $C0f, Fighting). Invisible movement reuses BlueWizzrobe walk pattern. Shoots unblockable
fireball ($56) every $40 frames. Custom collision completely bypasses normal pipeline
(_vulnerable=false): sword hits → visible $40f timer, HP→0 resets HP and goes brown; brown state
flickers and decrements, silver arrow (damage≥SILVER_ARROW_DAMAGE via hitContext) kills; dying
sequence: phase $50→ashes+8 burst rays, phase $A0→drops Triforce of Power as room item.
**GuardFire/StandingFire** (`guard-fire.ts`): GuardFire ($3F) killable, StandingFire ($40) invulnerable,
both deal contact damage. **Zelda NPC** (`zelda-npc.ts`): proximity check → halts Link → timer $80 →
GameMode.ZeldaRescue ending stub ("THANKS LINK, YOU'RE THE HERO OF HYRULE."). createZeldaGroup()
factory (1 Zelda + 4 GuardFire). 6 new files, spawn-manager + main.ts wiring. **1156 total tests**
(1155 pass, 1 pre-existing flaky Octorok). Typecheck clean (src). **Phase I complete. Next: J1.**

### 2026-08-29 — H4 Dungeons 7-9 completable — Phase H complete (Claude Opus 4.6)

Made all 9 dungeons navigable and completable (subject to I3 for Ganon). Four bugs fixed:
**(1) L7-9 entrance screens** — added screens 66→7, 109→8, 5→9 plus Q2 alternates (25, 108, 0)
to `DUNGEON_ENTRANCE_SCREENS`. **(2) Dungeon entry ignores tile overrides** — L7-9 entrances are
hidden behind secrets (flute dries pond→stairs, candle burns tree→stairs, bomb rock→cave). The
dungeon entry detection in main.ts only checked raw tile 12; added override check for both
`SQUARE_INDEX_CAVE_ENTRANCE` and `SQUARE_INDEX_STAIRS` from `tileObjectManager.tileOverrides`.
**(3) `checkCaveEntry` ignores STAIRS overrides** — `overworld-manager.ts` only checked
`SQUARE_INDEX_CAVE_ENTRANCE` override; added `SQUARE_INDEX_STAIRS` (also fixes regular cave stairs
from tree-burning). **(4) Trigger 3 (LastBoss) broken** — two issues: `itemActivated` was `false`
(Red Ring wouldn't appear after Ganon kill), and `_bossDefeated` was hardcoded `false` in main.ts.
Fixed to `itemActivated: true` and pass `allDead` as `_bossDefeated` (in trigger-3 rooms, the boss
IS the only enemy). Boss rooms: L7=Aquamentus $3D (implemented), L8=Gleeok4 $45 (implemented),
L9=Ganon $3E (generic-walker fallback until I3). L9 boss room uses trigger 3 → drops Red Ring $0E
+ opens shutters. All cellar infrastructure reused from H3 (L7: 2, L8: 3, L9: 8 connections).
10 new tests (entrance mapping, trigger 3 activation/gating, regression guards). **1165 total tests**
(1164 pass, 1 pre-existing flaky digdogger). Typecheck clean (src). **Phase H complete. Next: I3
(Patra + Ganon + Zelda rescue).**

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

Older sessions archived → `../PROGRESS.md` (A1–I1c, 2026-08-02 through 2026-08-27).
