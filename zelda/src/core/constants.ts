export const SCREEN_WIDTH = 256;
export const SCREEN_HEIGHT = 240;
export const HUD_HEIGHT = 64;
export const PLAY_AREA_HEIGHT = 176;
export const TILE_SIZE = 16;
export const TILES_X = 16;
export const TILES_Y = 11;
export const TARGET_FPS = 60;
export const FRAME_TIME = 1000 / TARGET_FPS;

export const WALK_ANIM_COUNTER_RESET = 6;
export const LINK_SHEET_COLUMNS = 15;
export const ENEMY_SHEET_COLUMNS = 30;
export const SPRITE_SPACING = 1;

// Link movement — Z_05.asm:7124 InitLinkSpeed, Z_07.asm:2769 MoveObject
export const LINK_SPEED_QFRAC = 0x60; // 96 — quarter speed applied 4× per frame → 1.5 px/frame avg
export const LINK_GRID_SIZE = 8;

// Link collision rect (offset from sprite top-left, at lower center / feet)
export const LINK_HITBOX_OFFSET_X = 4;
export const LINK_HITBOX_OFFSET_Y = 8;
export const LINK_HITBOX_WIDTH = 8;
export const LINK_HITBOX_HEIGHT = 8;

// Screen edge bounds (play-area coordinates, Link's top-left)
export const SCREEN_EDGE_LEFT = 0;
export const SCREEN_EDGE_RIGHT = SCREEN_WIDTH - TILE_SIZE;
export const SCREEN_EDGE_TOP = 0;
export const SCREEN_EDGE_BOTTOM = PLAY_AREA_HEIGHT - TILE_SIZE;

export const LINK_START_X = 120;
export const LINK_START_Y = 80;

// NES overworld default — tiles with NES metatile value < this are walkable
export const DEFAULT_WALKABILITY_THRESHOLD = 0x8D;

// Sword swing — Z_07.asm:4390 UpdateSwordOrRod
export const SWORD_WINDUP_FRAMES = 5;
export const SWORD_EXTENDED_FRAMES = 8;
export const SWORD_RETRACT_FRAMES = 3; // states 3, 4, 5 — 1 frame each
export const SWORD_BEAM_QFRAC = 0xC0; // 192 — 3px/frame via 4× quarter-speed
export const LINK_ATTACK_FRAME_ROW = 2;
export const SWORD_SPRITE_ROW = 3;
export const SWORD_BEAM_START_ROW = 3;

// Push block — Z_04.asm UpdateBlock
export const PUSH_BLOCK_TIMER_THRESHOLD = 0x10; // 16 frames of holding direction
export const PUSH_BLOCK_SLIDE_DISTANCE = 16; // 1 tile = 16px
export const PUSH_BLOCK_ALIGN_THRESHOLD = 17; // 0x11 max distance for push detection

// Enemy projectile — Z_04.asm UpdateMonsterShot
export const ENEMY_PROJECTILE_QFRAC = 0xC0; // 3px/frame via QSpeed
export const DEFLECTION_BOUNCE_FRAMES = 16;

// Damage system — Z_01.asm BeginShove, Z_07.asm Obj_Shove / DecrementInvincibilityTimer
export const LINK_KNOCKBACK_DISTANCE = 0x20; // 32 pixels
export const LINK_KNOCKBACK_SPEED = 4; // pixels per frame (ShoveMoveMin: 4 iterations × 1px)
export const LINK_INVINCIBILITY_TICKS = 0x18; // 24 ticks, decremented every 2 frames = 48 frames
export const LINK_INVINCIBILITY_FLASH_MASK = 0x03; // bottom 2 bits cycle palette

// Death animation — Z_05.asm:2039 InitMode11 / Z_05.asm:2523 UpdateMode11Death_Full
export const DEATH_FLASH_FRAMES = 33; // Sub0-1: ObjTimer[0] = $21 (33 frames flashing)
export const DEATH_SPIN_FRAMES_PER_DIR = 5; // Sub7: ObjTimer[11] = $05 per direction
export const DEATH_SPIN_DIRECTIONS = 4; // Down, Right, Up, Left per rotation
export const DEATH_SPIN_ROTATIONS = 4; // DeathModeCounter = 4
export const DEATH_SPIN_TOTAL_FRAMES =
  DEATH_SPIN_FRAMES_PER_DIR * DEATH_SPIN_DIRECTIONS * DEATH_SPIN_ROTATIONS; // 80
export const DEATH_FADE_STEPS = 4; // Sub8: AnimateWorldFading 4 palette steps
export const DEATH_FADE_FRAMES_PER_STEP = 10; // 10 frames per fade step
export const DEATH_GREY_PAUSE_FRAMES = 24; // Sub9: ObjTimer[11] = $18
export const DEATH_SPARK_SMALL_FRAMES = 9; // SubA: DeathModeCounter >= 6
export const DEATH_SPARK_BIG_FRAMES = 6; // SubA: DeathModeCounter < 6
export const DEATH_BLANK_PAUSE_FRAMES = 46; // SubA→SubB: ObjTimer[11] = $2E
export const DEATH_GAME_OVER_TEXT_FRAMES = 96; // SubB→SubC: ObjTimer[11] = $60

// Game Over screen — Z_05.asm:1369 InitMode8 / Z_05.asm:2199 UpdateMode8ContinueQuestion
export const GAME_OVER_CONFIRM_FLASH_FRAMES = 64; // $40 frames selection flash
export const GAME_OVER_FLASH_TOGGLE_INTERVAL = 4; // toggle visibility every 4 frames
export const GAME_OVER_CURSOR_X = 72;
export const GAME_OVER_TEXT_X = 88;
export const GAME_OVER_OPTION_YS = [79, 103, 127] as const; // $4F, $67, $7F

// Overworld grid
export const OVERWORLD_ROWS = 8;
export const OVERWORLD_COLS = 16;

// Link entry positions after screen transition — placed at the opposite screen edge.
// Uses play-area-relative coords matching SCREEN_EDGE_* bounds so Link doesn't
// immediately re-trigger a transition (checkScreenEdge uses strict inequality).
export const LINK_ENTRY_LEFT = SCREEN_EDGE_LEFT;
export const LINK_ENTRY_RIGHT = SCREEN_EDGE_RIGHT;
export const LINK_ENTRY_TOP = SCREEN_EDGE_TOP;
export const LINK_ENTRY_BOTTOM = SCREEN_EDGE_BOTTOM;

// Boomerang — Z_05.asm:2901 WieldBoomerang, Z_07.asm:3857 UpdateArrowOrBoomerang
export const BOOMERANG_QFRAC = 0xC0;               // 3 px/frame via QSpeed
export const BOOMERANG_SLOW_QFRAC = 0x40;           // 1 px/frame during SlowDown
export const BOOMERANG_NORMAL_LIMIT = 0x31;          // 49 px distance (wood)
export const BOOMERANG_MAGIC_LIMIT = 0xFF;           // 255 px distance (magic)
export const BOOMERANG_SPARK_FRAMES = 3;
export const BOOMERANG_SLOWDOWN_FRAMES = 0x10;       // 16 frames
export const BOOMERANG_RETURN_SLOW_FRAMES = 0x20;    // 32 frames
export const BOOMERANG_CATCH_THRESHOLD = 9;           // px on both axes
export const BOOMERANG_ANIM_COUNTER_RESET = 2;        // frames per animation step

// Bomb — Z_07.asm:4803 UpdateBomb, Z_01.asm:6108 CheckMonsterBombOrFireCollision
export const BOMB_DAMAGE = 0x40;                     // 64 raw damage points
export const BOMB_BLAST_RADIUS = 0x18;               // 24 px from center per axis

// Arrow — Z_05.asm:2954 WieldArrow, Z_01.asm:6242 CheckMonsterArrowOrRodCollision
export const ARROW_QFRAC = 0xC0;                     // 3 px/frame (same as sword beam)
export const ARROW_SPARK_FRAMES = 3;
export const ARROW_DAMAGE = 0x20;                     // 32 — wooden arrow
export const SILVER_ARROW_DAMAGE = 0x40;              // 64 — silver arrow

// Candle fire — Z_01.asm:3991 WieldCandle, Z_07.asm:4658 UpdateFire
export const FIRE_QFRAC = 0x20;                      // 0.5 px/frame via QSpeed
export const FIRE_DAMAGE = 0x10;                      // 16 — same as wooden sword

// Food — Z_05.asm:3003 WieldFood
export const FOOD_PHASE_TIMER = 0xFF;                 // 255 frames per phase
export const FOOD_PHASES = 3;                          // 3 phases × 255 = 765 frames total

// Magic Rod — Z_07.asm:4390 UpdateSwordOrRod (rod path), Z_05.asm:3036 WieldRod
export const ROD_WINDUP_FRAMES = 5;                   // same timing as sword
export const ROD_EXTENDED_FRAMES = 8;                  // same timing as sword
export const MAGIC_SHOT_QFRAC = 0xA0;                 // 2.5 px/frame via QSpeed
export const MAGIC_SHOT_DAMAGE = 0x10;                 // 16 — same as wooden sword
export const BOOK_FIRE_TIMER = 0x4F;                   // 79 frames — fire spawned by Book of Magic

// Ring palette — Z_01.asm:4710 NES palette values for Link's tunic
export const RING_TINT_BLUE = '#0058f0';               // NES palette $32
export const RING_TINT_RED = '#d82800';                // NES palette $16

// Potion — Z_05.asm:3019 WieldPotion
export const HEART_REFILL_INTERVAL = 4;                // frames between each half-heart heal

// Stepladder — Z_07.asm:3225 ladder spawn, Z_05.asm:3217 CheckLadder
export const LADDER_ROOMS_OW = [0x17, 0x18, 0x19, 0x27, 0x4F, 0x5F] as const;
export const LADDER_DISTANCE_THRESHOLD = 0x10;         // 16px — destroy if Link exceeds this
export const WATER_TILE_MIN = 0x8D;                    // 141 — OW water tile range start
export const WATER_TILE_MAX = 0x98;                    // 152 — OW water tile range end

// Raft — Z_04.asm:3863 UpdateDock
export const RAFT_ROOM_A = 0x3F;                       // 63 decimal
export const RAFT_ROOM_B = 0x55;                       // 85 decimal
export const RAFT_DOCK_X_A = 0x60;                     // dock X for room $3F
export const RAFT_DOCK_X_B = 0x80;                     // dock X for room $55
export const RAFT_ARRIVAL_Y = 0x3D;                    // 61 — Link arriving from scroll
export const RAFT_DEPARTURE_Y = 0x7D;                  // 125 — Link at dock
export const RAFT_MIDPOINT_Y = 0x7F;                   // 127 — state 1 stop point
export const RAFT_SPRITE_OFFSET_Y = 6;                 // raft drawn 6px below Link

// Recorder/Flute — Z_07.asm:2500 WieldFlute, Z_01.asm:1893 SummonWhirlwind
export const FLUTE_TIMER = 0x98;                       // 152 frames — gameplay freeze
export const FLUTE_POND_CYCLE_INTERVAL = 8;            // frames between color steps
export const FLUTE_POND_CYCLE_STEPS = 12;              // total color cycle steps
export const FLUTE_POND_WALKABLE_STEP = 10;            // water becomes walkable
export const FLUTE_POND_STAIRS_STEP = 11;              // stairs appear
export const FLUTE_POND_STAIRS_X = 0x60;               // 96 — stairs X position
export const FLUTE_POND_STAIRS_Y = 0x90;               // 144 — stairs Y position
export const WHIRLWIND_SPEED = 2;                      // px/frame
export const WHIRLWIND_CATCH_THRESHOLD = 9;            // px on each axis
export const WHIRLWIND_EXIT_X = 0xF0;                  // 240 — right edge trigger
export const WHIRLWIND_DROP_X = 0x80;                  // 128 — Link released here
export const WHIRLWIND_DEST_ROOMS = [0x36, 0x3B, 0x73, 0x44, 0x0A, 0x21, 0x41, 0x6C] as const;
export const WHIRLWIND_DEST_YS = [0x8D, 0xAD, 0x8D, 0x8D, 0xAD, 0x8D, 0xAD, 0x5D] as const;

// Respawn — Z_07.asm:1442 InitMode3_Sub1
export const RESPAWN_SCREEN_ROW = 7;
export const RESPAWN_SCREEN_COL = 7;
export const RESPAWN_LINK_X = 0x78; // 120 decimal — horizontal center
export const RESPAWN_HEALTH = 6; // 3 full hearts = 6 half-hearts

// Enemy system — Z_07.asm Obj_Shove / InitObject / UpdateMetaObject
export const ENEMY_KNOCKBACK_DISTANCE = 0x40; // 64 pixels (Z_01.asm:6688)
export const ENEMY_KNOCKBACK_SPEED = 4; // pixels per frame
export const ENEMY_INVINCIBILITY_FRAMES = 0x10; // 16 frames (Z_01.asm:6690)
export const SPAWN_CLOUD_FRAMES = 7; // ObjTimer set to 7 for cloud (Z_07.asm:5290)
export const MAX_ENEMY_SLOTS = 10; // NES object slots 1-10 (0x01-0x0A)
export const ENEMY_STUN_FRAMES = 0xA0; // 160 frames boomerang stun

// Sword damage by level — Z_01.asm:5849 CheckMonsterSwordCollision
export const SWORD_DAMAGE = [0x00, 0x10, 0x20, 0x40] as const; // none, wood, white, magic
export const BOOMERANG_DAMAGE = 0x10; // magic boomerang only

// Per-weapon damage-type bits — Z_01.asm:6039-6261 (the value stored in [09]).
// A monster's ObjInvincibilityMask ANDed with a weapon's bit != 0 => immune to it.
export const DamageTypeBit = {
  Sword: 0x01,      // sword, sword beam, magic-rod stab
  Boomerang: 0x02,
  Arrow: 0x04,
  Bomb: 0x08,
  MagicShot: 0x10,  // the magic rod's fired shot
  Fire: 0x20,       // candle fire
} as const;
