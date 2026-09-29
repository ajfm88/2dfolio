// Extract uncompressed graphics from ROM: tilesets, fonts, battle HUD tiles,
// title screen, overworld sprites, UI elements, trainer/player sprites.
// These are raw 1bpp/2bpp tile data at known offsets, plus compressed .pic sprites.

import { BinaryReader } from '../binary_reader';
import {
  FONT_GRAPHICS, TILESETS, TILESET_HEADER_SIZE, NUM_TILESETS,
  TEXT_BOX_GRAPHICS,
  HP_BAR_AND_STATUS, BATTLE_HUD_TILES_1, BATTLE_HUD_TILES_2, BATTLE_HUD_TILES_3,
  ED_TILE, POKEBALL_TILES, MOVE_ANIM_TILES_0,
  POKEMON_LOGO_GFX, POKEMON_LOGO_CORNER, TITLE_PIKACHU_BG, TITLE_PIKACHU_OB,
  GAMEFREAK_LOGO_GFX,
  TITLE_POKEMON_LOGO_TILEMAP, TITLE_PIKA_BUBBLE_TILEMAP, TITLE_PIKACHU_TILEMAP,
  SHOCK_EMOTE,
  RED_PIC_FRONT, RED_PIC_BACK, PROF_OAK_PIC_BACK, SHRINK_PIC_1, SHRINK_PIC_2,
  HEAL_MACHINE_GFX,
  TOWN_MAP_TILES, TOWN_MAP_CURSOR, MON_NEST_ICON,
  POKEDEX_TILES,
  TRAINER_INFO_GFX, CIRCLE_TILE, BADGE_NUMBERS_GFX, BADGE_GFX,
  BUG_ICON_FRAME1, PLANT_ICON_FRAME1, BUG_ICON_FRAME2, PLANT_ICON_FRAME2,
  SNAKE_ICON_FRAME1, QUADRUPED_ICON_FRAME1, SNAKE_ICON_FRAME2, QUADRUPED_ICON_FRAME2,
  SPRITE_SHEET_PTRS,
  TRAINER_PIC_OFFSETS,
  PIKACHU_EMOTION_SPRITES,
} from '../rom_offsets';
import { decode1bpp, decode2bpp } from '../tile_decoder';
import { decompressSprite } from '../sprite_decompress';

/** Tileset info extracted from tileset headers */
interface TilesetGfxInfo {
  bank: number;
  gfxAddr: number;
  gfxOffset: number;  // file offset
}

/** Read tileset header table to get GFX locations */
function readTilesetHeaders(rom: BinaryReader): TilesetGfxInfo[] {
  const headers: TilesetGfxInfo[] = [];
  for (let i = 0; i < NUM_TILESETS; i++) {
    const offset = TILESETS + i * TILESET_HEADER_SIZE;
    const bank = rom.readByte(offset);
    const gfxAddr = rom.readWord(offset + 3);
    const gfxOffset = bank * 0x4000 + (gfxAddr & 0x3FFF);
    headers.push({ bank, gfxAddr, gfxOffset });
  }
  return headers;
}

// Tileset ID → filename mapping (matches gfx/tilesets/ PNG names)
const TILESET_FILENAMES: string[] = [
  'overworld',    // 0
  'reds_house',   // 1
  'reds_house',   // 2 (MART uses same tileset as REDS_HOUSE_1 in the data files? No, actually different)
  'forest',       // 3
  'reds_house',   // 4 (REDS_HOUSE_2)
  'reds_house',   // 5 (DOJO — uses same)
  'pokecenter',   // 6
  'gym',          // 7
  'house',        // 8
  'gate',         // 9 (FOREST_GATE)
  'house',        // 10 (MUSEUM — uses house tileset)
  'underground',  // 11
  'gate',         // 12
  'ship',         // 13
  'ship_port',    // 14
  'cemetery',     // 15
  'interior',     // 16
  'cavern',       // 17
  'lobby',        // 18
  'mansion',      // 19
  'lab',          // 20
  'club',         // 21
  'facility',     // 22
  'plateau',      // 23
  'beach_house',  // 24 (BEACH_HOUSE)
];

// Standard tileset has 0x60 (96) tiles of 2bpp = 96 × 16 = 1536 bytes
// Some tilesets have more/fewer tiles
// We determine the size from the gap between consecutive GFX pointers in the same bank
const TILESET_TILES_WIDE = 16; // all tileset PNGs are 128px = 16 tiles wide

/**
 * Extract all tileset graphics as grayscale ImageData.
 * Returns a map of URL path → ImageData.
 */
export function extractTilesetGraphics(rom: BinaryReader): Record<string, ImageData> {
  const headers = readTilesetHeaders(rom);
  const result: Record<string, ImageData> = {};

  // Track which unique GFX offsets we've already decoded to avoid duplicates
  const decoded = new Map<number, ImageData>();

  for (let i = 0; i < NUM_TILESETS; i++) {
    const hdr = headers[i];
    const filename = TILESET_FILENAMES[i];
    if (!filename) continue;

    const url = `/gfx/tilesets/${filename}.png`;
    if (url in result) continue; // already decoded this filename

    // Check if we've already decoded this exact GFX offset
    if (decoded.has(hdr.gfxOffset)) {
      result[url] = decoded.get(hdr.gfxOffset)!;
      continue;
    }

    // Determine the size: find the next GFX offset in the same bank
    let gfxSize = 0x600; // default: 96 tiles × 16 bytes = 1536 bytes
    for (let j = 0; j < NUM_TILESETS; j++) {
      if (j === i) continue;
      if (headers[j].bank === hdr.bank && headers[j].gfxOffset > hdr.gfxOffset) {
        const gap = headers[j].gfxOffset - hdr.gfxOffset;
        if (gap < gfxSize) gfxSize = gap;
      }
    }

    const tileData = rom.readBytes(hdr.gfxOffset, gfxSize);
    const imageData = decode2bpp(tileData, TILESET_TILES_WIDE);

    decoded.set(hdr.gfxOffset, imageData);
    result[url] = imageData;
  }

  return result;
}

/**
 * Extract the main font (1bpp, 128 tiles, 16 tiles wide = 128x64px).
 */
export function extractFontGraphics(rom: BinaryReader): ImageData {
  const FONT_TILES = 128;
  const FONT_BYTES = FONT_TILES * 8; // 1bpp = 8 bytes/tile
  const data = rom.readBytes(FONT_GRAPHICS, FONT_BYTES);
  return decode1bpp(data, 16);
}

// ── Font & Battle UI Graphics ─────────────────────────────────────

/**
 * Extract font_extra.png (TextBoxGraphics).
 * 2bpp, 32 tiles, 16 tiles wide = 128x16px.
 */
export function extractFontExtra(rom: BinaryReader): ImageData {
  const data = rom.readBytes(TEXT_BOX_GRAPHICS, 32 * 16); // 32 tiles × 16 bytes (2bpp)
  return decode2bpp(data, 16);
}

/**
 * Extract font_battle_extra.png (HpBarAndStatusGraphics).
 * 2bpp, 30 tiles, 15 tiles wide = 120x16px.
 */
export function extractFontBattleExtra(rom: BinaryReader): ImageData {
  const data = rom.readBytes(HP_BAR_AND_STATUS, 30 * 16); // 30 tiles × 16 bytes/tile (2bpp)
  return decode2bpp(data, 15);
}

/**
 * Extract battle_hud_1.png (BattleHudTiles1).
 * 1bpp, 3 tiles, 3 tiles wide = 24x8px.
 */
export function extractBattleHud1(rom: BinaryReader): ImageData {
  const data = rom.readBytes(BATTLE_HUD_TILES_1, 3 * 8); // 3 tiles × 8 bytes/tile (1bpp)
  return decode1bpp(data, 3);
}

/**
 * Extract battle_hud_2.png (BattleHudTiles2).
 * 1bpp, 3 tiles, 3 tiles wide = 24x8px.
 */
export function extractBattleHud2(rom: BinaryReader): ImageData {
  const data = rom.readBytes(BATTLE_HUD_TILES_2, 3 * 8);
  return decode1bpp(data, 3);
}

/**
 * Extract battle_hud_3.png (BattleHudTiles3).
 * 1bpp, 3 tiles, 3 tiles wide = 24x8px.
 */
export function extractBattleHud3(rom: BinaryReader): ImageData {
  const data = rom.readBytes(BATTLE_HUD_TILES_3, 3 * 8);
  return decode1bpp(data, 3);
}

/**
 * Extract ED.png (ED_Tile).
 * 1bpp, 1 tile = 8x8px.
 */
export function extractEdTile(rom: BinaryReader): ImageData {
  const data = rom.readBytes(ED_TILE, 8); // 1 tile × 8 bytes (1bpp)
  return decode1bpp(data, 1);
}

/**
 * Extract balls.png (PokeballTileGraphics).
 * 2bpp, 4 tiles, 4 tiles wide = 32x8px.
 */
export function extractBallTiles(rom: BinaryReader): ImageData {
  const data = rom.readBytes(POKEBALL_TILES, 4 * 16); // 4 tiles × 16 bytes (2bpp)
  return decode2bpp(data, 4);
}

/**
 * Extract move_anim_0.png (MoveAnimationTiles0).
 * 2bpp, 79 tiles, 16 tiles wide = 128x40px.
 * Size from MoveAnimationTiles0 (1e:4237) to MoveAnimationTiles1 (1e:4727) = 0x4F0 bytes = 79 tiles.
 */
export function extractMoveAnim0(rom: BinaryReader): ImageData {
  const SIZE = 0x4F0; // 79 tiles × 16 bytes (actually the gap to next label)
  const data = rom.readBytes(MOVE_ANIM_TILES_0, SIZE);
  return decode2bpp(data, 16);
}

// ── Title Screen Graphics ─────────────────────────────────────────

/**
 * Extract pokemon_logo.png (PokemonLogoGraphics).
 * 2bpp, 128 tiles, 16 tiles wide = 128x64px.
 */
export function extractPokemonLogo(rom: BinaryReader): ImageData {
  const data = rom.readBytes(POKEMON_LOGO_GFX, 128 * 16);
  return decode2bpp(data, 16);
}

/**
 * Extract pokemon_logo_corner.png (PokemonLogoCornerGraphics).
 * 2bpp, 3 tiles, 3 tiles wide = 24x8px.
 */
export function extractPokemonLogoCorner(rom: BinaryReader): ImageData {
  const data = rom.readBytes(POKEMON_LOGO_CORNER, 3 * 16);
  return decode2bpp(data, 3);
}

/**
 * Extract pikachu_bg.png (TitlePikachuBGGraphics).
 * 2bpp, 64 tiles, 16 tiles wide = 128x32px.
 */
export function extractTitlePikachuBG(rom: BinaryReader): ImageData {
  const data = rom.readBytes(TITLE_PIKACHU_BG, 64 * 16);
  return decode2bpp(data, 16);
}

/**
 * Extract pikachu_ob.png (TitlePikachuOBGraphics).
 * 2bpp, 12 tiles, 12 tiles wide = 96x8px.
 */
export function extractTitlePikachuOB(rom: BinaryReader): ImageData {
  const data = rom.readBytes(TITLE_PIKACHU_OB, 12 * 16);
  return decode2bpp(data, 12);
}

/**
 * Extract gamefreak_inc.png (GameFreakLogoGraphics).
 * 2bpp, 9 tiles, 9 tiles wide = 72x8px.
 * At 04:4d78, size 0x90 (9 tiles × 16 bytes).
 */
export function extractGamefreakLogo(rom: BinaryReader): ImageData {
  const data = rom.readBytes(GAMEFREAK_LOGO_GFX, 9 * 16);
  return decode2bpp(data, 9);
}

/**
 * Extract title screen tilemaps as binary data.
 */
export function extractTitleTilemaps(rom: BinaryReader): Record<string, Uint8Array> {
  // Keys without leading slash — the fetch override strips the leading '/' from URLs
  return {
    'gfx/title/pokemon_logo.tilemap': rom.readBytes(TITLE_POKEMON_LOGO_TILEMAP, 112),
    'gfx/title/pika_bubble.tilemap': rom.readBytes(TITLE_PIKA_BUBBLE_TILEMAP, 28),
    'gfx/title/pikachu.tilemap': rom.readBytes(TITLE_PIKACHU_TILEMAP, 108),
  };
}

// ── Overworld Sprites ─────────────────────────────────────────────

// Sprite name → { label sym offset, tileCount }
// SpriteSheetPointerTable entries are 4 bytes each: 2-byte address, 1-byte tile count, 1-byte bank
// Full walking sprites have 12 tiles (16x96 = 2 tiles wide × 12 tiles per direction × 2 directions = 24 tiles)
// 4-tile sprites (items) are 16x16

// Map of filename → sprite sheet pointer table index (1-based, matching the assembly SPRITE_* constants)
// We extract every unique sprite used in the game
const OVERWORLD_SPRITE_ENTRIES: { filename: string; index: number }[] = [
  { filename: 'red', index: 1 },
  { filename: 'blue', index: 2 },
  { filename: 'prof', index: 3 },
  { filename: 'youngster', index: 4 },
  { filename: 'monster', index: 5 },
  { filename: 'cooltrainer_f', index: 6 },
  { filename: 'cooltrainer_m', index: 7 },
  { filename: 'little_girl', index: 8 },
  { filename: 'bird', index: 9 },
  { filename: 'middle_aged_man', index: 10 },
  { filename: 'gambler', index: 11 },
  { filename: 'super_nerd', index: 12 },
  { filename: 'girl', index: 13 },
  { filename: 'hiker', index: 14 },
  { filename: 'beauty', index: 15 },
  { filename: 'gentleman', index: 16 },
  { filename: 'daisy', index: 17 },
  { filename: 'biker', index: 18 },
  { filename: 'sailor', index: 19 },
  { filename: 'cook', index: 20 },
  { filename: 'bike_shop_clerk', index: 21 },
  { filename: 'mr_fuji', index: 22 },
  { filename: 'giovanni', index: 23 },
  { filename: 'rocket', index: 24 },
  { filename: 'channeler', index: 25 },
  { filename: 'waiter', index: 26 },
  { filename: 'silph_worker_f', index: 27 },
  { filename: 'middle_aged_woman', index: 28 },
  { filename: 'brunette_girl', index: 29 },
  { filename: 'lance', index: 30 },
  // index 31 = UNUSED_RED_1 (same as red)
  { filename: 'scientist', index: 32 },
  { filename: 'rocker', index: 33 },
  { filename: 'swimmer', index: 34 },
  { filename: 'safari_zone_worker', index: 35 },
  { filename: 'gym_guide', index: 36 },
  { filename: 'gramps', index: 37 },
  { filename: 'clerk', index: 38 },
  { filename: 'fishing_guru', index: 39 },
  { filename: 'granny', index: 40 },
  { filename: 'nurse', index: 41 },
  { filename: 'link_receptionist', index: 42 },
  { filename: 'silph_president', index: 43 },
  { filename: 'silph_worker_m', index: 44 },
  { filename: 'warden', index: 45 },
  { filename: 'captain', index: 46 },
  { filename: 'fisher', index: 47 },
  { filename: 'koga', index: 48 },
  { filename: 'guard', index: 49 },
  // index 50 = UNUSED_RED_2 (same as red)
  { filename: 'mom', index: 51 },
  { filename: 'balding_guy', index: 52 },
  { filename: 'little_boy', index: 53 },
  // index 54 = UNUSED_RED_3 (same as red)
  { filename: 'gameboy_kid', index: 55 },
  { filename: 'fairy', index: 56 },
  { filename: 'agatha', index: 57 },
  { filename: 'bruno', index: 58 },
  { filename: 'lorelei', index: 59 },
  { filename: 'seel', index: 60 },
  { filename: 'pikachu', index: 61 },
  { filename: 'officer_jenny', index: 62 },
  { filename: 'sandshrew', index: 63 },
  { filename: 'oddish', index: 64 },
  { filename: 'bulbasaur', index: 65 },
  { filename: 'jigglypuff', index: 66 },
  { filename: 'clefairy', index: 67 },
  { filename: 'chansey', index: 68 },
  { filename: 'jessie', index: 69 },
  { filename: 'james', index: 70 },
  { filename: 'poke_ball', index: 71 },
  { filename: 'fossil', index: 72 },
  { filename: 'boulder', index: 73 },
  { filename: 'paper', index: 74 },
  { filename: 'pokedex', index: 75 },
  { filename: 'clipboard', index: 76 },
  { filename: 'snorlax', index: 77 },
  // index 78 = UNUSED_OLD_AMBER (same as old_amber)
  { filename: 'old_amber', index: 79 },
  // index 80-82 = gambler_asleep variants
  { filename: 'gambler_asleep', index: 80 },
  { filename: 'question_mark', index: -1 }, // Special: not in table, handled separately
];

/**
 * Extract all overworld sprites from ROM using the SpriteSheetPointerTable.
 * Returns a map of URL path → ImageData.
 */
export function extractOverworldSprites(rom: BinaryReader): Record<string, ImageData> {
  const result: Record<string, ImageData> = {};
  const decodedOffsets = new Map<number, ImageData>();

  for (const entry of OVERWORLD_SPRITE_ENTRIES) {
    if (entry.index < 1) continue; // Skip special cases

    // Each table entry is 4 bytes: 2-byte address, 1-byte tile count (in units of 16 bytes), 1-byte bank
    const tableOffset = SPRITE_SHEET_PTRS + (entry.index - 1) * 4;
    const addr = rom.readWord(tableOffset);
    const tileCountRaw = rom.readByte(tableOffset + 2);
    const bank = rom.readByte(tableOffset + 3);

    // tileCountRaw is in units of 16 bytes (tile size in 2bpp)
    const tileCount = tileCountRaw;
    const dataSize = tileCount * 16; // 2bpp: 16 bytes per tile
    const romOffset = bank * 0x4000 + (addr & 0x3FFF);

    // Skip if already decoded this exact offset
    if (decodedOffsets.has(romOffset)) {
      result[`/gfx/sprites/${entry.filename}.png`] = decodedOffsets.get(romOffset)!;
      continue;
    }

    const tileData = rom.readBytes(romOffset, dataSize);
    // Walking sprites: 16px wide (2 tiles), variable height
    // 4-tile sprites: 16px wide (2 tiles), 16px tall (2 tiles)
    const tilesWide = 2;
    const imageData = decode2bpp(tileData, tilesWide);

    decodedOffsets.set(romOffset, imageData);
    result[`/gfx/sprites/${entry.filename}.png`] = imageData;
  }

  return result;
}

// ── Emote Sprites ─────────────────────────────────────────────────

/**
 * Extract shock emote sprite (and other emotes if needed).
 * 2bpp, 4 tiles (16x16px), 2 tiles wide.
 */
export function extractEmotes(rom: BinaryReader): Record<string, ImageData> {
  const result: Record<string, ImageData> = {};
  // Each emote is 4 tiles (2x2) = 64 bytes of 2bpp
  const emotes: { name: string; offset: number }[] = [
    { name: 'shock', offset: SHOCK_EMOTE },
  ];
  for (const e of emotes) {
    const data = rom.readBytes(e.offset, 4 * 16);
    result[`/gfx/emotes/${e.name}.png`] = decode2bpp(data, 2);
  }
  return result;
}

// ── Compressed Trainer/Player Sprites ─────────────────────────────

/**
 * Extract a compressed .pic sprite and return as ImageData.
 */
function extractCompressedSprite(rom: BinaryReader, offset: number): ImageData | null {
  try {
    const { width, tiles2bpp } = decompressSprite(rom, offset);
    return decode2bpp(tiles2bpp, width / 8);
  } catch {
    return null;
  }
}

/**
 * Extract player and trainer compressed sprites.
 */
export function extractPlayerAndTrainerSprites(rom: BinaryReader): Record<string, ImageData> {
  const result: Record<string, ImageData> = {};

  // Note: trainer front sprites (prof.oak, rival1, etc.) are now in extractAllTrainerSprites()
  const sprites: { url: string; offset: number }[] = [
    { url: '/gfx/player/redb.png', offset: RED_PIC_BACK },
    { url: '/gfx/battle/prof.oakb.png', offset: PROF_OAK_PIC_BACK },
    { url: '/gfx/player/shrink1.png', offset: SHRINK_PIC_1 },
    { url: '/gfx/player/shrink2.png', offset: SHRINK_PIC_2 },
  ];

  for (const s of sprites) {
    const img = extractCompressedSprite(rom, s.offset);
    if (img) {
      result[s.url] = img;
    }
  }

  return result;
}

/**
 * Extract the player's front portrait (red.png in gfx/player/).
 * RedPicFront at 04:5a97 — compressed .pic, 56x56 (7x7 tiles).
 */
export function extractPlayerFrontSprite(rom: BinaryReader): ImageData | null {
  return extractCompressedSprite(rom, RED_PIC_FRONT);
}

// ── Healing Machine ───────────────────────────────────────────────

/**
 * Extract heal_machine.png (PokeCenterFlashingMonitorAndHealBall).
 * 2bpp, 2 tiles, 1 tile wide = 8x16px.
 */
export function extractHealMachine(rom: BinaryReader): ImageData {
  const data = rom.readBytes(HEAL_MACHINE_GFX, 2 * 16);
  return decode2bpp(data, 1);
}

// ── Town Map ──────────────────────────────────────────────────────

/**
 * Extract town_map.png (WorldMapTileGraphics).
 * 2bpp, 16 tiles, 4 tiles wide = 32x32px.
 */
export function extractTownMapTiles(rom: BinaryReader): ImageData {
  const data = rom.readBytes(TOWN_MAP_TILES, 16 * 16);
  return decode2bpp(data, 4);
}

/**
 * Extract town_map_cursor.png (TownMapCursor).
 * 1bpp, 4 tiles, 2 tiles wide = 16x16px.
 */
export function extractTownMapCursor(rom: BinaryReader): ImageData {
  const data = rom.readBytes(TOWN_MAP_CURSOR, 4 * 8); // 1bpp
  return decode1bpp(data, 2);
}

/**
 * Extract mon_nest_icon.png (MonNestIcon).
 * 1bpp, 1 tile = 8x8px.
 */
export function extractMonNestIcon(rom: BinaryReader): ImageData {
  const data = rom.readBytes(MON_NEST_ICON, 1 * 8); // 1bpp
  return decode1bpp(data, 1);
}

// ── Pokedex ───────────────────────────────────────────────────────

/**
 * Extract pokedex.png (PokedexTileGraphics).
 * 2bpp, 18 tiles, 3 tiles wide = 24x48px.
 */
export function extractPokedexTiles(rom: BinaryReader): ImageData {
  const data = rom.readBytes(POKEDEX_TILES, 18 * 16);
  return decode2bpp(data, 3);
}

// ── Trainer Card ──────────────────────────────────────────────────

/**
 * Extract trainer_info.png (TrainerInfoTextBoxTileGraphics).
 * 2bpp, 9 tiles, 3 tiles wide = 24x24px.
 */
export function extractTrainerInfo(rom: BinaryReader): ImageData {
  const data = rom.readBytes(TRAINER_INFO_GFX, 9 * 16);
  return decode2bpp(data, 3);
}

/**
 * Extract circle_tile.png (CircleTile).
 * 2bpp, 1 tile = 8x8px.
 */
export function extractCircleTile(rom: BinaryReader): ImageData {
  const data = rom.readBytes(CIRCLE_TILE, 1 * 16);
  return decode2bpp(data, 1);
}

/**
 * Extract badge_numbers.png (BadgeNumbersTileGraphics).
 * 2bpp, 8 tiles, 2 tiles wide = 16x32px.
 */
export function extractBadgeNumbers(rom: BinaryReader): ImageData {
  const data = rom.readBytes(BADGE_NUMBERS_GFX, 8 * 16);
  return decode2bpp(data, 2);
}

/**
 * Extract badges.png (GymLeaderFaceAndBadgeTileGraphics).
 * 2bpp, 64 tiles, 2 tiles wide = 16x256px.
 */
export function extractBadges(rom: BinaryReader): ImageData {
  const data = rom.readBytes(BADGE_GFX, 64 * 16);
  return decode2bpp(data, 2);
}

// ── Party Menu Icons ──────────────────────────────────────────────

/**
 * Extract party menu icon PNGs (bug, plant, snake, quadruped).
 * Each icon has 2 frames of 2 tiles each = 4 tiles total per icon.
 * Assembly stores frames separately; we combine them into the expected layout:
 * 1 tile wide × 4 tiles tall = 8x32px (frame1 top, frame1 bottom, frame2 top, frame2 bottom)
 */
function extractPartyIcon(
  rom: BinaryReader,
  frame1Offset: number,
  frame2Offset: number,
): ImageData {
  // Each frame is 2 tiles of 2bpp = 0x20 bytes
  const frame1Data = rom.readBytes(frame1Offset, 0x20);
  const frame2Data = rom.readBytes(frame2Offset, 0x20);
  // Combine: frame1 tiles then frame2 tiles = 4 tiles
  const combined = new Uint8Array(0x40);
  combined.set(frame1Data, 0);
  combined.set(frame2Data, 0x20);
  return decode2bpp(combined, 1); // 1 tile wide × 4 tiles tall = 8x32
}

export function extractPartyIcons(rom: BinaryReader): Record<string, ImageData> {
  return {
    '/gfx/icons/bug.png': extractPartyIcon(rom, BUG_ICON_FRAME1, BUG_ICON_FRAME2),
    '/gfx/icons/plant.png': extractPartyIcon(rom, PLANT_ICON_FRAME1, PLANT_ICON_FRAME2),
    '/gfx/icons/snake.png': extractPartyIcon(rom, SNAKE_ICON_FRAME1, SNAKE_ICON_FRAME2),
    '/gfx/icons/quadruped.png': extractPartyIcon(rom, QUADRUPED_ICON_FRAME1, QUADRUPED_ICON_FRAME2),
  };
}

// ── All Trainer Front Sprites ─────────────────────────────────────

/**
 * Extract ALL trainer front sprites (compressed .pic format).
 * Returns a map of URL path → ImageData for each trainer.
 */
export function extractAllTrainerSprites(rom: BinaryReader): Record<string, ImageData> {
  const result: Record<string, ImageData> = {};

  for (const [filename, offset] of Object.entries(TRAINER_PIC_OFFSETS)) {
    try {
      const { width, tiles2bpp } = decompressSprite(rom, offset);
      const img = decode2bpp(tiles2bpp, width / 8);
      result[`/gfx/trainers/${filename}.png`] = img;
    } catch {
      // Skip sprites that fail to decompress
    }
  }

  return result;
}

// ── Pikachu Emotion Sprites ──────────────────────────────────────

/**
 * Extract all Pikachu emotion face and overlay sprites.
 * Pic_ entries use Gen 1 sprite compression; GFX_ entries are raw 2bpp.
 * Returns a map of URL path → ImageData.
 */
export function extractPikachuEmotionSprites(rom: BinaryReader): Record<string, ImageData> {
  const result: Record<string, ImageData> = {};

  for (const [hexId, entry] of Object.entries(PIKACHU_EMOTION_SPRITES)) {
    const url = `/gfx/pikachu/unknown_${hexId}.png`;

    if (entry.type === 'pic') {
      // Compressed sprite — use decompressSprite
      try {
        const { width, tiles2bpp } = decompressSprite(rom, entry.offset);
        result[url] = decode2bpp(tiles2bpp, width / 8);
      } catch {
        // Skip sprites that fail to decompress
      }
    } else {
      // Raw 2bpp data — read directly
      const data = rom.readBytes(entry.offset, entry.dataSize);
      result[url] = decode2bpp(data, entry.tilesWide);
    }
  }

  return result;
}

// ── Master extraction function ────────────────────────────────────

/**
 * Extract ALL additional graphics (beyond tilesets/font/pokemon sprites).
 * Returns { images, binaries } for imageData and binaryData maps.
 */
export function extractAllAdditionalGraphics(rom: BinaryReader): {
  images: Record<string, ImageData>;
  binaries: Record<string, Uint8Array>;
} {
  const images: Record<string, ImageData> = {};
  const binaries: Record<string, Uint8Array> = {};

  // Font & battle UI
  images['/gfx/font/font_extra.png'] = extractFontExtra(rom);
  images['/gfx/font/font_battle_extra.png'] = extractFontBattleExtra(rom);
  images['/gfx/battle/battle_hud_1.png'] = extractBattleHud1(rom);
  images['/gfx/battle/battle_hud_2.png'] = extractBattleHud2(rom);
  images['/gfx/battle/battle_hud_3.png'] = extractBattleHud3(rom);
  images['/gfx/font/ED.png'] = extractEdTile(rom);
  images['/gfx/battle/balls.png'] = extractBallTiles(rom);
  images['/gfx/battle/move_anim_0.png'] = extractMoveAnim0(rom);

  // Title screen graphics
  images['/gfx/title/pokemon_logo.png'] = extractPokemonLogo(rom);
  images['/gfx/title/pokemon_logo_corner.png'] = extractPokemonLogoCorner(rom);
  images['/gfx/title/pikachu_bg.png'] = extractTitlePikachuBG(rom);
  images['/gfx/title/pikachu_ob.png'] = extractTitlePikachuOB(rom);
  images['/gfx/title/gamefreak_inc.png'] = extractGamefreakLogo(rom);

  // Title screen tilemaps (binary)
  const tilemaps = extractTitleTilemaps(rom);
  for (const [url, data] of Object.entries(tilemaps)) {
    binaries[url] = data;
  }

  // Overworld sprites (all walking and item sprites)
  const overworldSprites = extractOverworldSprites(rom);
  for (const [url, img] of Object.entries(overworldSprites)) {
    images[url] = img;
  }

  // Emotes
  const emotes = extractEmotes(rom);
  for (const [url, img] of Object.entries(emotes)) {
    images[url] = img;
  }

  // Compressed player/trainer sprites (backsprites, shrinks)
  const trainerSprites = extractPlayerAndTrainerSprites(rom);
  for (const [url, img] of Object.entries(trainerSprites)) {
    images[url] = img;
  }

  // ALL trainer front sprites (compressed, from bank 0x13)
  const allTrainers = extractAllTrainerSprites(rom);
  for (const [url, img] of Object.entries(allTrainers)) {
    images[url] = img;
  }

  // Player front sprite (red.png under gfx/player/)
  const playerFront = extractPlayerFrontSprite(rom);
  if (playerFront) {
    images['/gfx/player/red.png'] = playerFront;
  }

  // Pikachu emotion sprites (faces + overlays)
  const pikachuEmotions = extractPikachuEmotionSprites(rom);
  for (const [url, img] of Object.entries(pikachuEmotions)) {
    images[url] = img;
  }

  // Healing machine
  images['/gfx/overworld/heal_machine.png'] = extractHealMachine(rom);

  // Town map
  images['/gfx/town_map/town_map.png'] = extractTownMapTiles(rom);
  images['/gfx/town_map/town_map_cursor.png'] = extractTownMapCursor(rom);
  images['/gfx/town_map/mon_nest_icon.png'] = extractMonNestIcon(rom);

  // Pokedex
  images['/gfx/pokedex/pokedex.png'] = extractPokedexTiles(rom);

  // Trainer card
  images['/gfx/trainer_card/trainer_info.png'] = extractTrainerInfo(rom);
  images['/gfx/trainer_card/circle_tile.png'] = extractCircleTile(rom);
  images['/gfx/trainer_card/badge_numbers.png'] = extractBadgeNumbers(rom);
  images['/gfx/trainer_card/badges.png'] = extractBadges(rom);

  // Party menu icons
  const icons = extractPartyIcons(rom);
  for (const [url, img] of Object.entries(icons)) {
    images[url] = img;
  }

  return { images, binaries };
}
