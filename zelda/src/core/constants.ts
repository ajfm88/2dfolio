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
