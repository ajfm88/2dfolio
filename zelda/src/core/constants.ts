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

// Respawn — Z_07.asm:1442 InitMode3_Sub1
export const RESPAWN_SCREEN_ROW = 7;
export const RESPAWN_SCREEN_COL = 7;
export const RESPAWN_LINK_X = 0x78; // 120 decimal — horizontal center
export const RESPAWN_HEALTH = 6; // 3 full hearts = 6 half-hearts
