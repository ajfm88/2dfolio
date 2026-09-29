// ROM offset table for Pokemon Yellow (UE) [C][!]
// SHA1: cc7d03262ebfaf2f06772c1a480c7d9d5f4a38e1
// Generated from pokeyellow.sym (rgbds v1.0.1 build)
//
// These are just numbers (file byte offsets) — not copyrightable content.
// Formula: bank * 0x4000 + (addr & 0x3FFF)

export const ROM_SHA1 = 'cc7d03262ebfaf2f06772c1a480c7d9d5f4a38e1';
export const ROM_SIZE = 1048576; // 1MB

/** Convert bank:address from .sym file to ROM file offset */
export function symToOffset(bank: number, addr: number): number {
  return bank * 0x4000 + (addr & 0x3FFF);
}

// ── Pokemon Data ──────────────────────────────────────────────
export const BASE_STATS          = symToOffset(0x0e, 0x43de);  // 151 entries × 0x1C bytes
export const MONSTER_NAMES       = symToOffset(0x3a, 0x4000);  // 151 entries × 10 bytes
export const EVOS_MOVES_PTRS     = symToOffset(0x0e, 0x71e5);  // 151 pointers (internal ID order)
export const POKEDEX_ORDER       = symToOffset(0x10, 0x50b1);  // internal ID → dex number
export const POKEDEX_TO_INDEX    = symToOffset(0x10, 0x5086);  // dex number → internal ID
export const POKEDEX_ENTRY_PTRS  = symToOffset(0x10, 0x450b);  // 151 pointers to dex entries

export const BASE_DATA_SIZE = 0x1C;  // 28 bytes per base stats entry
export const NAME_LENGTH    = 10;    // bytes per Pokemon/move/trainer name
export const NUM_POKEMON    = 190;   // internal ID slots (not all valid)
export const NUM_DEX        = 151;   // Pokedex entries

// ── Move Data ─────────────────────────────────────────────────
export const MOVES              = symToOffset(0x0e, 0x4000);  // 165 entries × 6 bytes
export const MOVE_NAMES         = symToOffset(0x2f, 0x4000);  // 165 names × variable length
export const MOVE_LENGTH        = 6;
export const NUM_MOVES          = 165;

// ── Item Data ────────────────────────────────────────────────
export const ITEM_NAMES_OFFSET  = symToOffset(0x01, 0x45b7);  // ItemNames table
export const ITEM_NAME_LENGTH   = 13;    // bytes per item name entry (fixed, 0x50-padded)
export const NUM_ITEM_NAMES     = 97;    // total entries in ItemNames table

// ── Type Data ─────────────────────────────────────────────────
export const TYPE_EFFECTS       = symToOffset(0x0f, 0x65fa);  // 3 bytes each, terminated by 0xFF

// ── Trainer Data ──────────────────────────────────────────────
export const TRAINER_DATA_PTRS  = symToOffset(0x0e, 0x5dd1);  // pointer table per class
export const TRAINER_NAMES      = symToOffset(0x0e, 0x597e);  // name strings
export const TRAINER_PIC_MONEY  = symToOffset(0x0e, 0x5893);  // pic pointer + BCD money
export const TRAINER_MOVE_CHOICES = symToOffset(0x0e, 0x581e); // AI move choice modifiers per class
export const TRAINER_SPECIAL_MOVES = symToOffset(0x0e, 0x5c6b); // special move overrides
export const TRAINER_DATA_END   = symToOffset(0x0e, 0x65b2);   // end of trainer party data (TrainerAI)
export const NUM_TRAINERS       = 47;                          // trainer classes (excluding NOBODY)
export const TRAINER_NAME_LENGTH = 13;                         // bytes per trainer name entry

// ── Map Data ──────────────────────────────────────────────────
export const MAP_HEADER_PTRS    = symToOffset(0x3f, 0x41f2);  // 2-byte ptrs per map
export const MAP_HEADER_BANKS   = symToOffset(0x3f, 0x43e4);  // 1-byte bank per map
export const MAP_SONG_BANKS     = symToOffset(0x3f, 0x4000);  // music bank data
export const WILD_DATA_PTRS     = symToOffset(0x03, 0x4b95);  // wild encounter ptrs

// ── Tileset Data ──────────────────────────────────────────────
export const TILESETS           = symToOffset(0x03, 0x4558);  // 25 tileset headers × 12 bytes
export const TILESET_HEADER_SIZE = 12;
export const NUM_TILESETS       = 25;

// ── Graphics ──────────────────────────────────────────────────
export const FONT_GRAPHICS      = symToOffset(0x04, 0x4600);  // 1bpp font tiles
export const SPRITE_SHEET_PTRS  = symToOffset(0x05, 0x42a9);  // overworld sprite pointers

// Font & battle UI
export const TEXT_BOX_GRAPHICS  = symToOffset(0x04, 0x4e18);  // TextBoxGraphics — 2bpp, 32 tiles (font_extra)
export const HP_BAR_AND_STATUS  = symToOffset(0x04, 0x4a20);  // HpBarAndStatusGraphics — 2bpp, 30 tiles (font_battle_extra)
export const BATTLE_HUD_TILES_1 = symToOffset(0x04, 0x4c00);  // BattleHudTiles1 — 1bpp, 3 tiles
export const BATTLE_HUD_TILES_2 = symToOffset(0x04, 0x4c18);  // BattleHudTiles2 — 1bpp, 3 tiles
export const BATTLE_HUD_TILES_3 = symToOffset(0x04, 0x4c30);  // BattleHudTiles3 — 1bpp, 3 tiles
export const ED_TILE            = symToOffset(0x01, 0x64e5);  // ED_Tile — 1bpp, 1 tile
export const POKEBALL_TILES     = symToOffset(0x0e, 0x6a28);  // PokeballTileGraphics — 2bpp, 4 tiles (balls.png)
export const MOVE_ANIM_TILES_0  = symToOffset(0x1e, 0x4237);  // MoveAnimationTiles0 — 2bpp, 80 tiles (move_anim_0)

// Title screen
export const POKEMON_LOGO_GFX     = symToOffset(0x3d, 0x46fb);  // PokemonLogoGraphics — 2bpp, 128 tiles
export const POKEMON_LOGO_CORNER  = symToOffset(0x3d, 0x4e2b);  // PokemonLogoCornerGraphics — 2bpp, 3 tiles
export const TITLE_PIKACHU_BG     = symToOffset(0x3d, 0x4e5b);  // TitlePikachuBGGraphics — 2bpp, 64 tiles
export const TITLE_PIKACHU_OB     = symToOffset(0x3d, 0x525b);  // TitlePikachuOBGraphics — 2bpp, 12 tiles
export const GAMEFREAK_LOGO_GFX   = symToOffset(0x04, 0x4d78);  // GameFreakLogoGraphics — 2bpp, 9 tiles
export const GAMEFREAK_INTRO_GFX  = symToOffset(0x10, 0x5aa6);  // GameFreakIntro — 2bpp, 20 tiles

// Title screen tilemaps
export const TITLE_POKEMON_LOGO_TILEMAP = symToOffset(0x3d, 0x45f9);  // 112 bytes
export const TITLE_PIKA_BUBBLE_TILEMAP  = symToOffset(0x3d, 0x4673);  // 28 bytes
export const TITLE_PIKACHU_TILEMAP      = symToOffset(0x3d, 0x468f);  // 108 bytes

// Overworld sprites (2bpp, 12 tiles per full walking sprite, 4 tiles for items)
// These are read from the SpriteSheetPointerTable at SPRITE_SHEET_PTRS

// Emote sprites
export const SHOCK_EMOTE    = symToOffset(0x10, 0x51e5);  // 2bpp, 4 tiles

// Player sprites (compressed .pic format)
export const RED_PIC_FRONT    = symToOffset(0x04, 0x5a97);  // RedPicFront — compressed (gfx/player/red.pic)
export const RED_PIC_BACK     = symToOffset(0x3d, 0x43b1);  // RedPicBack — compressed
export const PROF_OAK_PIC_BACK = symToOffset(0x3d, 0x44d2);  // ProfOakPicBack — compressed
export const SHRINK_PIC_1     = symToOffset(0x04, 0x5b96);  // ShrinkPic1 — compressed
export const SHRINK_PIC_2     = symToOffset(0x04, 0x5bf0);  // ShrinkPic2 — compressed

// Trainer front sprites (compressed .pic format, all in bank 0x13)
export const PROF_OAK_PIC     = symToOffset(0x13, 0x613a);  // ProfOakPic — compressed
export const RIVAL1_PIC       = symToOffset(0x13, 0x6049);  // Rival1Pic — compressed

// All trainer front sprite offsets: { filename → ROM offset }
// These are all compressed .pic sprites decompressed at runtime.
export const TRAINER_PIC_OFFSETS: Record<string, number> = {
  'youngster':    symToOffset(0x13, 0x4000),
  'bugcatcher':   symToOffset(0x13, 0x40c6),
  'lass':         symToOffset(0x13, 0x4200),
  'sailor':       symToOffset(0x13, 0x42db),
  'jr.trainerm':  symToOffset(0x13, 0x4450),
  'jr.trainerf':  symToOffset(0x13, 0x4588),
  'pokemaniac':   symToOffset(0x13, 0x46c9),
  'supernerd':    symToOffset(0x13, 0x47f1),
  'hiker':        symToOffset(0x13, 0x48e7),
  'biker':        symToOffset(0x13, 0x4abe),
  'burglar':      symToOffset(0x13, 0x4c91),
  'engineer':     symToOffset(0x13, 0x4e0a),
  'fisher':       symToOffset(0x13, 0x4f87),
  'swimmer':      symToOffset(0x13, 0x5133),
  'cueball':      symToOffset(0x13, 0x524f),
  'gambler':      symToOffset(0x13, 0x5421),
  'beauty':       symToOffset(0x13, 0x55df),
  'psychic':      symToOffset(0x13, 0x5728),
  'rocker':       symToOffset(0x13, 0x5843),
  'juggler':      symToOffset(0x13, 0x597d),
  'tamer':        symToOffset(0x13, 0x5b4e),
  'birdkeeper':   symToOffset(0x13, 0x5cdb),
  'blackbelt':    symToOffset(0x13, 0x5e76),
  'rival1':       symToOffset(0x13, 0x6049),
  'prof.oak':     symToOffset(0x13, 0x613a),
  'scientist':    symToOffset(0x13, 0x6258),
  'giovanni':     symToOffset(0x13, 0x6399),
  'rocket':       symToOffset(0x13, 0x647a),
  'cooltrainerm': symToOffset(0x13, 0x6610),
  'cooltrainerf': symToOffset(0x13, 0x6799),
  'bruno':        symToOffset(0x13, 0x691e),
  'brock':        symToOffset(0x13, 0x6b19),
  'misty':        symToOffset(0x13, 0x6c14),
  'lt.surge':     symToOffset(0x13, 0x6d20),
  'erika':        symToOffset(0x13, 0x6ea5),
  'koga':         symToOffset(0x13, 0x6fc1),
  'blaine':       symToOffset(0x13, 0x713b),
  'sabrina':      symToOffset(0x13, 0x723d),
  'gentleman':    symToOffset(0x13, 0x73bb),
  'rival2':       symToOffset(0x13, 0x74ba),
  'rival3':       symToOffset(0x13, 0x75e1),
  'lorelei':      symToOffset(0x13, 0x76f6),
  'channeler':    symToOffset(0x13, 0x7821),
  'agatha':       symToOffset(0x13, 0x79ee),
  'lance':        symToOffset(0x13, 0x7b1f),
  'jessiejames':  symToOffset(0x13, 0x7c81),
};

// Pikachu emotion sprites — Pic_ entries are compressed, GFX_ entries are raw 2bpp.
// Data lives in banks 0x39 and 0x3c.
// { hexId: { offset, type: 'pic'|'gfx', width, height, tilesWide, dataSize (for gfx only) } }
export interface PikachuEmotionEntry {
  offset: number;
  type: 'pic' | 'gfx';
  width: number;
  height: number;
  tilesWide: number;
  dataSize: number; // raw 2bpp byte count (only used for gfx)
}

export const PIKACHU_EMOTION_SPRITES: Record<string, PikachuEmotionEntry> = {
  'e4000': { offset: symToOffset(0x39, 0x4000), type: 'pic', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e40cc': { offset: symToOffset(0x39, 0x40cc), type: 'gfx', width: 40, height: 8,  tilesWide: 5, dataSize: 80 },
  'e411c': { offset: symToOffset(0x39, 0x411c), type: 'pic', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e41d2': { offset: symToOffset(0x39, 0x41d2), type: 'gfx', width: 40, height: 16, tilesWide: 5, dataSize: 160 },
  'e4272': { offset: symToOffset(0x39, 0x4272), type: 'pic', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e4323': { offset: symToOffset(0x39, 0x4323), type: 'gfx', width: 16, height: 24, tilesWide: 2, dataSize: 96 },
  'e4383': { offset: symToOffset(0x39, 0x4383), type: 'pic', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e444b': { offset: symToOffset(0x39, 0x444b), type: 'gfx', width: 40, height: 32, tilesWide: 5, dataSize: 320 },
  'e458b': { offset: symToOffset(0x39, 0x458b), type: 'pic', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e463b': { offset: symToOffset(0x39, 0x463b), type: 'gfx', width: 16, height: 16, tilesWide: 2, dataSize: 64 },
  'e467b': { offset: symToOffset(0x39, 0x467b), type: 'pic', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e472e': { offset: symToOffset(0x39, 0x472e), type: 'gfx', width: 16, height: 16, tilesWide: 2, dataSize: 64 },
  'e476e': { offset: symToOffset(0x39, 0x476e), type: 'pic', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e4841': { offset: symToOffset(0x39, 0x4841), type: 'gfx', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e49d1': { offset: symToOffset(0x39, 0x49d1), type: 'pic', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e4a99': { offset: symToOffset(0x39, 0x4a99), type: 'gfx', width: 40, height: 16, tilesWide: 5, dataSize: 160 },
  'e4b39': { offset: symToOffset(0x39, 0x4b39), type: 'pic', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e4bde': { offset: symToOffset(0x39, 0x4bde), type: 'gfx', width: 16, height: 24, tilesWide: 2, dataSize: 96 },
  'e4c3e': { offset: symToOffset(0x39, 0x4c3e), type: 'pic', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e4ce0': { offset: symToOffset(0x39, 0x4ce0), type: 'gfx', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e4e70': { offset: symToOffset(0x39, 0x4e70), type: 'gfx', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e5000': { offset: symToOffset(0x39, 0x5000), type: 'pic', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e50af': { offset: symToOffset(0x39, 0x50af), type: 'gfx', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e523f': { offset: symToOffset(0x39, 0x523f), type: 'pic', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e52fe': { offset: symToOffset(0x39, 0x52fe), type: 'gfx', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e548e': { offset: symToOffset(0x39, 0x548e), type: 'pic', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e5541': { offset: symToOffset(0x39, 0x5541), type: 'gfx', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e56d1': { offset: symToOffset(0x39, 0x56d1), type: 'pic', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e5794': { offset: symToOffset(0x39, 0x5794), type: 'gfx', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e5924': { offset: symToOffset(0x39, 0x5924), type: 'pic', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e59ed': { offset: symToOffset(0x39, 0x59ed), type: 'gfx', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e5b7d': { offset: symToOffset(0x39, 0x5b7d), type: 'pic', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e5c4d': { offset: symToOffset(0x39, 0x5c4d), type: 'gfx', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e5ddd': { offset: symToOffset(0x39, 0x5ddd), type: 'pic', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e5e90': { offset: symToOffset(0x39, 0x5e90), type: 'gfx', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e6340': { offset: symToOffset(0x39, 0x6340), type: 'pic', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e63f7': { offset: symToOffset(0x39, 0x63f7), type: 'gfx', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e6587': { offset: symToOffset(0x39, 0x6587), type: 'pic', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'e6646': { offset: symToOffset(0x39, 0x6646), type: 'gfx', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'f0cf4': { offset: symToOffset(0x3c, 0x4cf4), type: 'pic', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
  'f0d82': { offset: symToOffset(0x3c, 0x4d82), type: 'gfx', width: 40, height: 40, tilesWide: 5, dataSize: 400 },
};

// Healing machine animation tiles
export const HEAL_MACHINE_GFX  = symToOffset(0x1c, 0x450b);  // PokeCenterFlashingMonitorAndHealBall — 2bpp, 2 tiles

// Town map
export const TOWN_MAP_TILES     = symToOffset(0x04, 0x5138);  // WorldMapTileGraphics — 2bpp, 16 tiles
export const TOWN_MAP_CURSOR    = symToOffset(0x1c, 0x4fc4);  // TownMapCursor — 1bpp, 4 tiles
export const MON_NEST_ICON      = symToOffset(0x1c, 0x574b);  // MonNestIcon — 1bpp, 1 tile

// Pokedex
export const POKEDEX_TILES      = symToOffset(0x04, 0x5018);  // PokedexTileGraphics — 2bpp, 18 tiles

// Trainer card
export const TRAINER_INFO_GFX   = symToOffset(0x3d, 0x5c24);  // TrainerInfoTextBoxTileGraphics — 2bpp, 9 tiles
export const CIRCLE_TILE        = symToOffset(0x3d, 0x5e14);  // CircleTile — 2bpp, 1 tile
export const BADGE_NUMBERS_GFX  = symToOffset(0x3d, 0x5e24);  // BadgeNumbersTileGraphics — 2bpp, 8 tiles
export const BADGE_GFX          = symToOffset(0x03, 0x691b);  // GymLeaderFaceAndBadgeTileGraphics — 2bpp, 64 tiles

// Party menu icons (2bpp, each icon is 2 tiles per frame, 2 frames)
// These are at known offsets, each frame is 0x20 bytes (2 tiles)
export const BUG_ICON_FRAME1      = symToOffset(0x1c, 0x5a06);
export const PLANT_ICON_FRAME1    = symToOffset(0x1c, 0x5a26);
export const BUG_ICON_FRAME2      = symToOffset(0x1c, 0x5a46);
export const PLANT_ICON_FRAME2    = symToOffset(0x1c, 0x5a66);
export const SNAKE_ICON_FRAME1    = symToOffset(0x1c, 0x5a86);
export const QUADRUPED_ICON_FRAME1 = symToOffset(0x1c, 0x5aa6);
export const SNAKE_ICON_FRAME2    = symToOffset(0x1c, 0x5ac6);
export const QUADRUPED_ICON_FRAME2 = symToOffset(0x1c, 0x5ae6);

// ── Map Text Pointers (for NPC dialogue / sign text extraction) ──
// Each map's TextPointers table: array of 2-byte pointers to text handlers.
// Text handlers starting with 0x17 (TX_FAR) contain a 3-byte far pointer to actual text.
export const MAP_TEXT_PTRS: Record<string, { offset: number; bank: number; count: number }> = {
  PalletTown:          { offset: symToOffset(0x06, 0x4faa), bank: 0x06, count: 8 },
  Route1:              { offset: symToOffset(0x07, 0x435c), bank: 0x07, count: 3 },
  Route22:             { offset: symToOffset(0x14, 0x5169), bank: 0x14, count: 3 },
  ViridianCity:        { offset: symToOffset(0x06, 0x5213), bank: 0x06, count: 16 },
  RedsHouse1F:         { offset: symToOffset(0x12, 0x4106), bank: 0x12, count: 2 },
  RedsHouse2F:         { offset: symToOffset(0x17, 0x40c7), bank: 0x17, count: 0 },
  BluesHouse:          { offset: symToOffset(0x06, 0x5c55), bank: 0x06, count: 3 },
  OaksLab:             { offset: symToOffset(0x07, 0x4910), bank: 0x07, count: 27 },
  ViridianPokecenter:  { offset: symToOffset(0x11, 0x4263), bank: 0x11, count: 5 },
  ViridianMart:        { offset: symToOffset(0x07, 0x4d0d), bank: 0x07, count: 2 },
  ViridianSchoolHouse: { offset: symToOffset(0x07, 0x4d7d), bank: 0x07, count: 3 },
  ViridianNicknameHouse: { offset: symToOffset(0x07, 0x4dd6), bank: 0x07, count: 4 },
};

// ── Palette Data ──────────────────────────────────────────────
export const MONSTER_PALETTES   = symToOffset(0x1c, 0x6921);
export const SUPER_PALETTES     = symToOffset(0x1c, 0x69b9);

// ── Audio Data ────────────────────────────────────────────────
export const SFX_HEADERS_1      = symToOffset(0x02, 0x4000);
export const SFX_HEADERS_2      = symToOffset(0x08, 0x4000);
export const SFX_HEADERS_3      = symToOffset(0x1f, 0x4000);
export const SFX_HEADERS_4      = symToOffset(0x20, 0x4000);

// Banks for pointer resolution
export const EVOS_MOVES_BANK    = 0x0e;
export const WILD_DATA_BANK     = 0x03;
export const TRAINER_DATA_BANK  = 0x0e;
export const POKEDEX_BANK       = 0x10;
