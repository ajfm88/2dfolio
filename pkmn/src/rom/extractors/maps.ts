// Extract map data from ROM → same format as data/maps/*.json
// Reads structural data (header, blocks, connections, warps, NPC positions) from ROM binary.
// Text content is read from ROM via TextPointers table → text_far pointer chain.
// Per-map metadata provides NPC ids and structural overrides, but NO copyrighted text.

import { BinaryReader } from '../binary_reader';
import { MAP_HEADER_PTRS, MAP_HEADER_BANKS, MAP_TEXT_PTRS, PICK_UP_ITEM_TEXT_ADDR, symToOffset } from '../rom_offsets';
import { decodeMapText } from './text';

// ── Constants ───────────────────────────────────────────────────

/** Map constant ID → PascalCase name (only maps we extract) */
const MAP_ID_TO_NAME: Record<number, string> = {
  0x00: 'PalletTown',
  0x01: 'ViridianCity',
  0x0C: 'Route1',
  0x21: 'Route22',
  0x22: 'Route23',    // Referenced by Route22 connection
  0x25: 'RedsHouse1F',
  0x26: 'RedsHouse2F',
  0x27: 'BluesHouse',
  0x28: 'OaksLab',
  0x29: 'ViridianPokecenter',
  0x2A: 'ViridianMart',
  0x2B: 'ViridianSchoolHouse',
  0x2C: 'ViridianNicknameHouse',
  0x2D: 'ViridianGym',      // Referenced by ViridianCity warp
  0xC1: 'Route22Gate',      // Referenced by Route22 warp
  // V1 — Route 2 + Viridian Forest
  0x0D: 'Route2',
  0x2E: 'DiglettsCaveRoute2',
  0x2F: 'ViridianForestNorthGate',
  0x30: 'Route2TradeHouse',
  0x31: 'Route2Gate',
  0x32: 'ViridianForestSouthGate',
  0x33: 'ViridianForest',
  0xC5: 'DiglettsCave',     // Referenced by DiglettsCaveRoute2 warp (extracted in V4)
  // Additional maps referenced by connections but not extracted
  0x20: 'Route21',
  // PewterCity (0x02) stays out until V2 extracts it: a connection to a missing map
  // would hang the game (performMapConnection doesn't catch), so Route 2's north
  // connection is dropped and its north edge is a tree wall until then.
};

/** Tileset byte ID → JSON tileset name string */
const TILESET_NAMES: Record<number, string> = {
  0: 'OVERWORLD',
  1: 'REDS_HOUSE_1',
  2: 'MART',
  3: 'FOREST',
  4: 'REDS_HOUSE_2',
  5: 'DOJO',
  6: 'POKECENTER',
  7: 'GYM',
  8: 'HOUSE',
  9: 'FOREST_GATE',
  10: 'MUSEUM',
  11: 'UNDERGROUND',
  12: 'GATE',
  13: 'SHIP',
  14: 'SHIP_PORT',
  15: 'CEMETERY',
  16: 'INTERIOR',
  17: 'CAVERN',
  18: 'LOBBY',
  19: 'MANSION',
  20: 'LAB',
  21: 'CLUB',
  22: 'FACILITY',
  23: 'PLATEAU',
  24: 'BEACH_HOUSE',
};

/** Sprite byte ID → JSON sprite name string */
const SPRITE_NAMES: Record<number, string> = {
  0x01: 'red',
  0x02: 'blue',
  0x03: 'prof',
  0x04: 'youngster',
  0x05: 'monster',
  0x06: 'cooltrainer_f',
  0x07: 'cooltrainer_m',
  0x08: 'little_girl',
  0x09: 'bird',
  0x0A: 'middle_aged_man',
  0x0B: 'gambler',
  0x0C: 'super_nerd',
  0x0D: 'girl',
  0x0E: 'hiker',
  0x0F: 'beauty',
  0x10: 'gentleman',
  0x11: 'daisy',
  0x12: 'biker',
  0x13: 'sailor',
  0x14: 'cook',
  0x15: 'bike_shop_clerk',
  0x16: 'mr_fuji',
  0x17: 'giovanni',
  0x18: 'rocket',
  0x19: 'channeler',
  0x1A: 'waiter',
  0x1B: 'silph_worker_f',
  0x1C: 'middle_aged_woman',
  0x1D: 'brunette_girl',
  0x1E: 'lance',
  0x20: 'scientist',
  0x21: 'rocker',
  0x22: 'swimmer',
  0x23: 'safari_zone_worker',
  0x24: 'gym_guide',
  0x25: 'gramps',
  0x26: 'clerk',
  0x27: 'fishing_guru',
  0x28: 'granny',
  0x29: 'nurse',
  0x2A: 'link_receptionist',
  0x2B: 'silph_president',
  0x2C: 'silph_worker_m',
  0x2D: 'warden',
  0x2E: 'captain',
  0x2F: 'fisher',
  0x30: 'koga',
  0x31: 'guard',
  0x33: 'mom',
  0x34: 'balding_guy',
  0x35: 'little_boy',
  0x37: 'gameboy_kid',
  0x38: 'fairy',
  0x39: 'agatha',
  0x3A: 'bruno',
  0x3B: 'lorelei',
  0x3C: 'seel',
  0x3D: 'pikachu',
  0x3E: 'officer_jenny',
  0x3F: 'sandshrew',
  0x40: 'oddish',
  0x41: 'bulbasaur',
  0x42: 'jigglypuff',
  0x43: 'clefairy',
  0x44: 'chansey',
  0x45: 'jessie',
  0x46: 'james',
  0x47: 'poke_ball',
  0x48: 'fossil',
  0x49: 'boulder',
  0x4A: 'paper',
  0x4B: 'pokedex',
  0x4C: 'clipboard',
  0x4D: 'snorlax',
  0x52: 'gambler_asleep',
};

/** Movement byte → JSON movement string */
const MOVEMENT_NAMES: Record<number, string> = {
  0xFE: 'walk',
  0xFF: 'stay',
};

/** Connection direction bit masks (in order: NORTH, SOUTH, WEST, EAST) */
const CONNECTION_BITS = [
  { bit: 8, direction: 'north' },
  { bit: 4, direction: 'south' },
  { bit: 2, direction: 'west' },
  { bit: 1, direction: 'east' },
] as const;

/** Connection data size in bytes per direction */
const CONNECTION_SIZE = 11;

// ── ROM Text Reading ─────────────────────────────────────────

/** TX_FAR opcode — text_far handler stores a 3-byte far pointer after this byte */
const TX_FAR = 0x17;

/**
 * Read text for a given text ID from a map's TextPointers table.
 * Follows: TextPointers[textId] → handler offset → text_far 3-byte pointer → actual text.
 * Returns the decoded text string, or '' if the handler isn't a simple text_far.
 */
function readMapText(rom: BinaryReader, mapName: string, textId: number): string {
  const textPtrs = MAP_TEXT_PTRS[mapName];
  if (!textPtrs || textId < 1 || textId > textPtrs.count) return '';

  // Read the 2-byte pointer for this text ID (1-based: first entry = textId 1)
  const ptrOffset = textPtrs.offset + (textId - 1) * 2;
  const handlerAddr = rom.readWord(ptrOffset);
  const handlerOffset = rom.resolvePointer(textPtrs.bank, handlerAddr);

  // Check if handler starts with TX_FAR (0x17)
  const firstByte = rom.readByte(handlerOffset);
  if (firstByte === TX_FAR) {
    // Read 3-byte far pointer: addr_lo, addr_hi, bank
    const farAddrLo = rom.readByte(handlerOffset + 1);
    const farAddrHi = rom.readByte(handlerOffset + 2);
    const farBank = rom.readByte(handlerOffset + 3);
    const farAddr = (farAddrHi << 8) | farAddrLo;
    const textOffset = rom.resolvePointer(farBank, farAddr);
    return decodeMapText(rom, textOffset);
  }

  // For text_asm (0x08) handlers, scan for the FIRST text_far within ~80 bytes.
  // This handles common patterns: event flag checks, jr/jp branches, then text_far.
  // Heuristic: the first TX_FAR found with valid-looking text is the default dialogue.
  if (firstByte === 0x08) {
    for (let i = 1; i < 80; i++) {
      if (rom.readByte(handlerOffset + i) === TX_FAR) {
        const farAddrLo = rom.readByte(handlerOffset + i + 1);
        const farAddrHi = rom.readByte(handlerOffset + i + 2);
        const farBank = rom.readByte(handlerOffset + i + 3);
        // Sanity: bank should be in valid range (0x00-0x3F for 1MB ROM)
        if (farBank > 0x3F) continue;
        const farAddr = (farAddrHi << 8) | farAddrLo;
        // Sanity: address should be in banked range (0x4000-0x7FFF)
        if (farAddr < 0x4000 || farAddr > 0x7FFF) continue;
        const textOffset = rom.resolvePointer(farBank, farAddr);
        const text = decodeMapText(rom, textOffset);
        if (text.length > 3) return text;
      }
    }
  }

  return '';  // couldn't extract text
}

// ── JSON output types ──────────────────────────────────────────

export interface MapConnection {
  direction: string;
  mapName: string;
  offset: number;
}

export interface MapWarp {
  x: number;
  y: number;
  destMap: string;
  destWarpId: number;
}

export interface MapSign {
  x: number;
  y: number;
  text: string;
}

export interface MapHiddenEvent {
  x: number;
  y: number;
  text?: string;
  textOffset?: number;  // ROM offset for text reading (numbers, not copyrightable)
  facing?: string;
  scriptId?: string;
  item?: string;
  flag?: string;
}

export interface MapNpc {
  id: string;
  sprite: string;
  x: number;
  y: number;
  movement: string;
  direction?: string;
  walkDir?: string;
  object?: boolean;
  dialogue: string;
  shopItems?: string[];
  /** Item balls: the item they hold (A1 makes them collectible). */
  item?: string;
  /** Standard map trainers (see readTrainerTexts). `dialogue` is the before-battle text. */
  trainerClass?: string;      // trainers.json key, e.g. "BUG_CATCHER"
  trainerParty?: number;      // 0-based index into that class's parties
  endBattleText?: string;     // in battle after "PLAYER defeated CLASS!", shown as "CLASS: " + text
  afterBattleText?: string;   // talking to the trainer once beaten
}

export interface MapData {
  name: string;
  width: number;
  height: number;
  tileset: string;
  connections: MapConnection[];
  blocks: number[];
  borderBlock: number;
  warps: MapWarp[];
  signs: MapSign[];
  hiddenEvents?: MapHiddenEvent[];
  npcs: MapNpc[];
}

// ── Per-map metadata (data not extractable from ROM binary) ────

/** Curated NPC metadata per map: identifiers and structural overrides.
 *  Dialogue text is read from ROM via TextPointers, NOT hardcoded here.
 *  Optional dialogue override is only for demo-only custom text (not from ROM). */
interface NpcMeta {
  id: string;
  dialogue?: string;  // only used for demo-custom text NOT from ROM
  textOffset?: number;  // ROM offset fallback for complex text_asm handlers
  direction?: string;
  walkDir?: string;
  object?: boolean;
  shopItems?: string[];
  x?: number;
  y?: number;
  sprite?: string;
  movement?: string;
  /** Text comes from engine code (e.g. OaksAideScript, an in-game trade), so emit no
   *  dialogue: the TextPointers fallback would pick up the wrong text. */
  scripted?: boolean;
}

/** Per-map metadata: structural overrides and text offsets.
 *  All text is read from ROM at runtime — no copyrighted strings in code. */
interface MapMeta {
  connectionFilter?: string[];
  connectionOrder?: string[];
  signTextOffsets: number[];  // ROM offsets for each sign's text (from sym file)
  npcs: NpcMeta[];
  hiddenEvents?: MapHiddenEvent[];
}

const MAP_METADATA: Record<string, MapMeta> = {
  PalletTown: {
    connectionFilter: ['north'],
    signTextOffsets: [
      symToOffset(0x2d, 0x4420), // OAK POKEMON RESEARCH LAB
      symToOffset(0x2d, 0x4437), // PALLET TOWN sign
      symToOffset(0x2d, 0x4462), // PLAYER's house
      symToOffset(0x2d, 0x446d), // RIVAL's house
    ],
    npcs: [
      { id: 'prof' },
      { id: 'girl' },
      { id: 'fisher' },
    ],
  },
  Route1: {
    signTextOffsets: [symToOffset(0x28, 0x6d32)],
    npcs: [
      { id: 'youngster1', textOffset: symToOffset(0x28, 0x6bd1) },
      { id: 'youngster2', textOffset: symToOffset(0x28, 0x6cb1) },
    ],
  },
  Route22: {
    connectionOrder: ['east', 'north'],
    signTextOffsets: [symToOffset(0x29, 0x6c41)],
    npcs: [
      // Demo-only NPC: custom text NOT from Nintendo (our original content)
      { id: 'blue_blocking', dialogue: 'Hey! <PLAYER>!\nYou\'ve reached the\nend of the demo!\fEverything beyond\nhere is still being\nbuilt.\fThanks for playing!', direction: 'left', x: 8, y: 6, sprite: 'blue' },
    ],
  },
  ViridianCity: {
    signTextOffsets: [
      symToOffset(0x2d, 0x496a), // VIRIDIAN CITY sign
      symToOffset(0x2d, 0x4997), // TRAINER TIPS 1
      symToOffset(0x2d, 0x49fa), // TRAINER TIPS 2
      symToOffset(0x26, 0x40d2), // POKEMON MART sign
      symToOffset(0x26, 0x40fc), // POKEMON CENTER sign
      symToOffset(0x2d, 0x4a80), // VIRIDIAN CITY GYM sign
    ],
    hiddenEvents: [
      { x: 14, y: 4, item: 'POTION', flag: 'HIDDEN_ITEM_VIRIDIAN_CITY_POTION' },
    ],
    npcs: [
      { id: 'youngster1', textOffset: symToOffset(0x2d, 0x45bd) },
      { id: 'gambler1', textOffset: symToOffset(0x2d, 0x4629) },
      { id: 'youngster2', textOffset: symToOffset(0x2d, 0x4686) },
      { id: 'girl1', direction: 'right', textOffset: symToOffset(0x2d, 0x4717) },
      { id: 'fisher1', direction: 'down', textOffset: symToOffset(0x2d, 0x47dc) },
      { id: 'oldman1', textOffset: symToOffset(0x2d, 0x48eb) },
      { id: 'oldman_blocking', direction: 'down', textOffset: symToOffset(0x2d, 0x47a7) },
    ],
  },
  RedsHouse1F: {
    signTextOffsets: [],
    hiddenEvents: [
      { x: 3, y: 1, facing: 'up', textOffset: symToOffset(0x2a, 0x450a) },  // TV movie text
      { x: 3, y: 1, textOffset: symToOffset(0x2a, 0x455c) },  // wrong side text
    ],
    npcs: [
      { id: 'mom', direction: 'left', textOffset: symToOffset(0x2a, 0x440c) },
    ],
  },
  RedsHouse2F: {
    signTextOffsets: [],
    hiddenEvents: [
      { x: 0, y: 1, scriptId: 'RED_PC', facing: 'up' },
      { x: 3, y: 5, textOffset: symToOffset(0x27, 0x6dd8) },  // SNES text
    ],
    npcs: [],
  },
  BluesHouse: {
    signTextOffsets: [],
    hiddenEvents: [
      { x: 0, y: 1, facing: 'up', textOffset: symToOffset(0x27, 0x7499) },  // bookshelf
      { x: 1, y: 1, facing: 'up', textOffset: symToOffset(0x27, 0x7499) },  // same bookshelf text
      { x: 7, y: 1, facing: 'up', textOffset: symToOffset(0x27, 0x7499) },  // same bookshelf text
    ],
    npcs: [
      { id: 'daisy', direction: 'right' },
      { id: 'town_map', object: true, direction: 'down' },
    ],
  },
  OaksLab: {
    signTextOffsets: [],
    hiddenEvents: [
      { x: 4, y: 0, facing: 'up', textOffset: symToOffset(0x27, 0x64c5) },  // push START
      { x: 5, y: 0, facing: 'up', textOffset: symToOffset(0x27, 0x64e3) },  // SAVE option
      { x: 0, y: 1, facing: 'up', textOffset: symToOffset(0x27, 0x6911) },  // email
      { x: 1, y: 1, facing: 'up', textOffset: symToOffset(0x27, 0x6911) },  // same email
    ],
    npcs: [
      { id: 'prof', direction: 'down', textOffset: symToOffset(0x2a, 0x476f) },
      { id: 'rival', textOffset: symToOffset(0x2a, 0x468f) },
      { id: 'item_ball', object: true, direction: 'down' },
      { id: 'pokedex1', object: true, direction: 'down' },
      { id: 'pokedex2', object: true, direction: 'down' },
      { id: 'girl', walkDir: 'up_down' },
      { id: 'scientist1' },
      { id: 'scientist2' },
    ],
  },
  ViridianPokecenter: {
    signTextOffsets: [],
    hiddenEvents: [
      { x: 0, y: 4, facing: 'left', textOffset: symToOffset(0x27, 0x60a0) },  // pokecenter sign
      { x: 13, y: 3, scriptId: 'POKECENTER_PC', facing: 'up' },
    ],
    npcs: [
      { id: 'nurse', direction: 'down', textOffset: symToOffset(0x2c, 0x7772) },
      { id: 'gentleman1', textOffset: symToOffset(0x2a, 0x56a9) },
      { id: 'cooltrainer1', direction: 'up', textOffset: symToOffset(0x2a, 0x56f0) },
      { id: 'receptionist1', direction: 'down', textOffset: symToOffset(0x2c, 0x788d) },
      { id: 'chansey1', direction: 'down', textOffset: symToOffset(0x26, 0x431d) },
    ],
  },
  ViridianMart: {
    signTextOffsets: [],
    npcs: [
      { id: 'clerk', direction: 'right', shopItems: ['POKE_BALL', 'POTION', 'ANTIDOTE', 'PARALYZE_HEAL', 'BURN_HEAL'], textOffset: symToOffset(0x2c, 0x74a1) },
      { id: 'youngster1', walkDir: 'up_down', textOffset: symToOffset(0x2a, 0x57dd) },
      { id: 'cooltrainer_m', textOffset: symToOffset(0x2a, 0x5805) },
    ],
  },
  ViridianSchoolHouse: {
    signTextOffsets: [],
    hiddenEvents: [
      { x: 3, y: 0, scriptId: 'VIRIDIAN_SCHOOL_BLACKBOARD', facing: 'up' },
      { x: 3, y: 4, scriptId: 'VIRIDIAN_SCHOOL_NOTEBOOK' },
    ],
    npcs: [
      { id: 'brunette_girl', direction: 'up', textOffset: symToOffset(0x2a, 0x5832) },
      { id: 'cooltrainer_f', direction: 'down', textOffset: symToOffset(0x2a, 0x5897) },
      { id: 'little_girl', direction: 'up', textOffset: symToOffset(0x2a, 0x585d) },
    ],
  },
  ViridianNicknameHouse: {
    signTextOffsets: [],
    npcs: [
      { id: 'balding_guy' },
      { id: 'little_girl', walkDir: 'up_down' },
      { id: 'spearow', walkDir: 'left_right' },
      { id: 'speary_sign' },
    ],
  },

  // ── V1: Route 2 + Viridian Forest (notes/v1-plan.md) ──
  // NPC ids are pret's const_export names minus the map prefix, lowercased
  // (data/maps/objects/<Map>.asm), in ROM object order. direction / walkDir mirror
  // the object_event bytes: STAY <dir> → direction, WALK UP_DOWN / LEFT_RIGHT →
  // walkDir, NONE / ANY_DIR → omitted.
  Route2: {
    signTextOffsets: [
      symToOffset(0x28, 0x6d57), // _Route2SignText
      symToOffset(0x28, 0x6d7c), // _Route2DiglettsCaveSignText
    ],
    npcs: [
      { id: 'moon_stone', object: true },
      { id: 'hp_up', object: true },
    ],
  },
  Route2Gate: {
    signTextOffsets: [],
    npcs: [
      // Talks through OaksAideScript (engine/events/oaks_aide.asm) — V1b
      { id: 'oaks_aide', direction: 'left', scripted: true },
      { id: 'youngster', walkDir: 'left_right' },
    ],
  },
  Route2TradeHouse: {
    signTextOffsets: [],
    npcs: [
      { id: 'scientist', direction: 'right' },
      // In-game trade TRADE_FOR_MILES (DoInGameTradeDialogue) — slice A4
      { id: 'gameboy_kid', direction: 'down', scripted: true },
    ],
  },
  DiglettsCaveRoute2: {
    signTextOffsets: [],
    npcs: [
      { id: 'fishing_guru' },
    ],
  },
  ViridianForest: {
    signTextOffsets: [
      symToOffset(0x26, 0x45fa), // _ViridianForestTrainerTips1Text
      symToOffset(0x26, 0x4643), // _ViridianForestUseAntidoteSignText
      symToOffset(0x26, 0x4674), // _ViridianForestTrainerTips2Text
      symToOffset(0x26, 0x46b6), // _ViridianForestTrainerTips3Text
      symToOffset(0x26, 0x4703), // _ViridianForestTrainerTips4Text
      // Yellow bug, reproduced on purpose: the LEAVING VIRIDIAN FOREST sign prints
      // TRAINER TIPS 1 (scripts/ViridianForest.asm ViridianForestLeavingSignText:
      // "supposed to be ViridianForestPrintLeavingSignText")
      symToOffset(0x26, 0x45fa),
    ],
    hiddenEvents: [
      // data/events/hidden_events.asm
      { x: 1, y: 18, item: 'POTION', flag: 'HIDDEN_ITEM_VIRIDIAN_FOREST_POTION' },
      { x: 16, y: 42, item: 'ANTIDOTE', flag: 'HIDDEN_ITEM_VIRIDIAN_FOREST_ANTIDOTE' },
    ],
    npcs: [
      { id: 'youngster1' },
      { id: 'youngster2', direction: 'left' },   // Bug Catcher
      { id: 'youngster3', direction: 'left' },   // Bug Catcher
      { id: 'youngster4', direction: 'left' },   // Bug Catcher
      { id: 'cooltrainer_f' },                    // Lass
      { id: 'youngster5', direction: 'right' },  // Bug Catcher
      { id: 'potion1', object: true },
      { id: 'potion2', object: true },
      { id: 'poke_ball', object: true },
      { id: 'youngster6' },
    ],
  },
  ViridianForestSouthGate: {
    signTextOffsets: [],
    npcs: [
      { id: 'girl', direction: 'left' },
      { id: 'little_girl', walkDir: 'up_down' },
    ],
  },
  ViridianForestNorthGate: {
    signTextOffsets: [],
    npcs: [
      { id: 'super_nerd' },
      { id: 'gramps' },
    ],
  },
};

// ── Map names that we extract ──────────────────────────────────

const EXTRACTABLE_MAPS: Record<string, number> = {
  PalletTown: 0x00,
  ViridianCity: 0x01,
  Route1: 0x0C,
  Route22: 0x21,
  RedsHouse1F: 0x25,
  RedsHouse2F: 0x26,
  BluesHouse: 0x27,
  OaksLab: 0x28,
  ViridianPokecenter: 0x29,
  ViridianMart: 0x2A,
  ViridianSchoolHouse: 0x2B,
  ViridianNicknameHouse: 0x2C,
  Route2: 0x0D,
  DiglettsCaveRoute2: 0x2E,
  ViridianForestNorthGate: 0x2F,
  Route2TradeHouse: 0x30,
  Route2Gate: 0x31,
  ViridianForestSouthGate: 0x32,
  ViridianForest: 0x33,
};

// ── NPC index overrides (when ROM has more NPCs than JSON) ─────

/** For maps where the ROM has more NPCs than the JSON, specify which ROM
 *  NPC indices (0-based) to include. undefined = include all. */
const NPC_INDEX_FILTER: Record<string, number[]> = {
  // OaksLab ROM has 9 NPCs; JSON has 8 (skip OAK2 at index 5)
  // ROM: 0=RIVAL(trainer), 1=EEVEE_BALL, 2=OAK1(DOWN), 3=POKEDEX1, 4=POKEDEX2, 5=OAK2(UP), 6=GIRL, 7=SCI1, 8=SCI2
  // JSON order: prof(=OAK1@2), rival(=0), item_ball(=1), pokedex1(=3), pokedex2(=4), girl(=6), sci1(=7), sci2(=8)
  OaksLab: [2, 0, 1, 3, 4, 6, 7, 8],

  // Route22 ROM has 2 NPCs (RIVAL1, RIVAL2); JSON has 1 demo-only NPC with overridden coords
  Route22: [0],

  // ViridianCity ROM has 8 NPCs; JSON has 7 (skip OLD_MAN2 at index 7)
  // ROM: 0=YOUNGSTER1, 1=GAMBLER1, 2=YOUNGSTER2, 3=GIRL, 4=OLD_MAN_SLEEPY, 5=FISHER, 6=OLD_MAN, 7=OLD_MAN2
  ViridianCity: [0, 1, 2, 3, 5, 6, 4],

  // BluesHouse ROM has 3 NPCs; JSON has 2 (skip DAISY2 walking at index 1)
  // ROM: 0=DAISY1(sitting), 1=DAISY2(walking), 2=TOWN_MAP
  BluesHouse: [0, 2],
};

// ── ROM parsing ────────────────────────────────────────────────

interface RomConnection {
  direction: string;
  mapId: number;
  offset: number;
}

interface RomWarp {
  y: number;
  x: number;
  destWarpId: number;
  destMapId: number;
}

interface RomSign {
  y: number;
  x: number;
  textId: number;
}

interface RomNpc {
  sprite: number;
  x: number;
  y: number;
  movement: number;
  rangeDir: number;
  textId: number;
  isTrainer: boolean;
  isItem: boolean;
  /** Trainer objects: class byte — an OPP_* value (≥ OPP_ID_OFFSET), or a species for a static Pokémon */
  trainerClassId?: number;
  /** Trainer objects: which party of the class (1-based), or the static Pokémon's level */
  trainerSet?: number;
  /** Item-flagged objects: the item byte (an item ball only if its text is PickUpItemText) */
  itemId?: number;
}

function parseMapHeader(rom: BinaryReader, mapId: number): {
  tileset: number;
  height: number;
  width: number;
  blockPtr: number;
  connectionFlags: number;
  connections: RomConnection[];
  objectPtr: number;
  bank: number;
} {
  const bank = rom.readByte(MAP_HEADER_BANKS + mapId);
  const headerAddr = rom.readWord(MAP_HEADER_PTRS + mapId * 2);
  const headerOffset = rom.resolvePointer(bank, headerAddr);

  const tileset = rom.readByte(headerOffset);
  const height = rom.readByte(headerOffset + 1);
  const width = rom.readByte(headerOffset + 2);
  const blockPtr = rom.readWord(headerOffset + 3);
  // textPtr at +5, scriptPtr at +7 (skip)
  const connectionFlags = rom.readByte(headerOffset + 9);

  let pos = headerOffset + 10;
  const connections: RomConnection[] = [];

  for (const { bit, direction } of CONNECTION_BITS) {
    if (connectionFlags & bit) {
      const mapIdConn = rom.readByte(pos);
      // bytes 1-6: block ptr, overworldmap ptr, strip length, connected width
      // bytes 7-8: y_align, x_align (signed)
      const yAlign = rom.readSignedByte(pos + 7);
      const xAlign = rom.readSignedByte(pos + 8);

      let offset: number;
      if (direction === 'north' || direction === 'south') {
        offset = Math.floor(-xAlign / 2) || 0;  // || 0 converts -0 to 0
      } else {
        offset = Math.floor(-yAlign / 2) || 0;
      }

      connections.push({ direction, mapId: mapIdConn, offset });
      pos += CONNECTION_SIZE;
    }
  }

  const objectPtr = rom.readWord(pos);

  return { tileset, height, width, blockPtr, connectionFlags, connections, objectPtr, bank };
}

function parseMapObjects(rom: BinaryReader, objectPtr: number, bank: number): {
  borderBlock: number;
  warps: RomWarp[];
  signs: RomSign[];
  npcs: RomNpc[];
} {
  const offset = rom.resolvePointer(bank, objectPtr);
  let pos = offset;

  const borderBlock = rom.readByte(pos);
  pos++;

  // Warps
  const warpCount = rom.readByte(pos);
  pos++;
  const warps: RomWarp[] = [];
  for (let i = 0; i < warpCount; i++) {
    const y = rom.readByte(pos);
    const x = rom.readByte(pos + 1);
    const destWarpId = rom.readByte(pos + 2);
    const destMapId = rom.readByte(pos + 3);
    warps.push({ y, x, destWarpId, destMapId });
    pos += 4;
  }

  // Signs (bg events)
  const signCount = rom.readByte(pos);
  pos++;
  const signs: RomSign[] = [];
  for (let i = 0; i < signCount; i++) {
    const y = rom.readByte(pos);
    const x = rom.readByte(pos + 1);
    const textId = rom.readByte(pos + 2);
    signs.push({ y, x, textId });
    pos += 3;
  }

  // NPCs (object events)
  const npcCount = rom.readByte(pos);
  pos++;
  const npcs: RomNpc[] = [];
  for (let i = 0; i < npcCount; i++) {
    const sprite = rom.readByte(pos);
    const yPlus4 = rom.readByte(pos + 1);
    const xPlus4 = rom.readByte(pos + 2);
    const movement = rom.readByte(pos + 3);
    const rangeDir = rom.readByte(pos + 4);
    const textIdByte = rom.readByte(pos + 5);

    const isTrainer = !!(textIdByte & 0x40);
    const isItem = !!(textIdByte & 0x80);
    const textId = textIdByte & 0x3F;

    let size = 6;
    if (isTrainer) size = 8;
    else if (isItem) size = 7;

    npcs.push({
      sprite,
      x: xPlus4 - 4,
      y: yPlus4 - 4,
      movement,
      rangeDir,
      textId,
      isTrainer,
      isItem,
      ...(isTrainer ? { trainerClassId: rom.readByte(pos + 6), trainerSet: rom.readByte(pos + 7) } : {}),
      ...(isItem ? { itemId: rom.readByte(pos + 6) } : {}),
    });
    pos += size;
  }

  return { borderBlock, warps, signs, npcs };
}

// ── Trainer headers ────────────────────────────────────────────

/** constants/trainer_constants.asm: object class bytes from here up are trainer
 *  classes (OPP_* = 200 + class ID); lower values are species (static Pokémon). */
const OPP_ID_OFFSET = 200;

const TX_ASM = 0x08;   // text_asm — the TextPointers handler is Z80 code
const LD_HL_NN = 0x21; // ld hl, nn

interface TrainerTexts {
  battleText: string;       // TRAINER_BEFORE_BATTLE_TEXT
  endBattleText: string;    // TRAINER_WON_BATTLE_TEXT
  afterBattleText: string;  // TRAINER_AFTER_BATTLE_TEXT
}

/** The raw TextPointers entry (a CPU address) for a map text ID, or null. */
function textPointerAddr(rom: BinaryReader, mapName: string, textId: number): number | null {
  const textPtrs = MAP_TEXT_PTRS[mapName];
  if (!textPtrs || textId < 1 || textId > textPtrs.count) return null;
  return rom.readWord(textPtrs.offset + (textId - 1) * 2);
}

/** Decode the text behind a `text_far` handler, or null if it isn't one. */
function readFarText(rom: BinaryReader, handlerOffset: number): string | null {
  if (rom.readByte(handlerOffset) !== TX_FAR) return null;
  const addr = rom.readWord(handlerOffset + 1);
  const bank = rom.readByte(handlerOffset + 3);
  return decodeMapText(rom, rom.resolvePointer(bank, addr));
}

/**
 * Read a standard map trainer's texts from its trainer header.
 *
 * Standard trainers' TextPointers handlers are `text_asm; ld hl, <Map>TrainerHeaderN`
 * followed by `TalkToTrainer` (home/trainers.asm). The header — the `trainer` macro —
 * is 12 bytes: event-flag bit, view range << 4, event-flag pointer, then pointers to
 * the before-battle, after-battle, won and lost texts, each a `text_far` handler in
 * the map script's bank. (Won and lost are the same text for map trainers.)
 *
 * Returns null for anything else — rivals and gym leaders run custom scripts — so
 * a mismatch never yields a wrong text. (The generic TextPointers fallback gives
 * every Viridian Forest trainer the first trainer's line: notes/v1-plan.md §2.2.)
 */
function readTrainerTexts(rom: BinaryReader, mapName: string, textId: number): TrainerTexts | null {
  const textPtrs = MAP_TEXT_PTRS[mapName];
  const handlerAddr = textPointerAddr(rom, mapName, textId);
  if (!textPtrs || handlerAddr === null) return null;

  // An address in the map script's ROM bank → file offset; null for home bank / RAM
  const inBank = (addr: number): number | null =>
    addr >= 0x4000 && addr <= 0x7FFF ? rom.resolvePointer(textPtrs.bank, addr) : null;

  const handler = inBank(handlerAddr);
  if (handler === null) return null;
  if (rom.readByte(handler) !== TX_ASM || rom.readByte(handler + 1) !== LD_HL_NN) return null;
  const header = inBank(rom.readWord(handler + 2));
  if (header === null) return null;

  const text = (field: number): string | null => {
    const h = inBank(rom.readWord(header + field));
    return h === null ? null : readFarText(rom, h);
  };
  const battleText = text(4);
  const afterBattleText = text(6);
  const endBattleText = text(8);
  if (battleText === null || afterBattleText === null || endBattleText === null) return null;
  return { battleText, endBattleText, afterBattleText };
}

// ── Public API ─────────────────────────────────────────────────

/** Extract a single map by name, producing output matching data/maps/<name>.json.
 *  itemNames / trainerClassNames: from readItemNames() / readTrainerClassNames(). */
export function extractMap(
  rom: BinaryReader,
  mapName: string,
  itemNames: Record<number, string>,
  trainerClassNames: string[],
): MapData | null {
  const mapId = EXTRACTABLE_MAPS[mapName];
  if (mapId === undefined) return null;

  const meta = MAP_METADATA[mapName];
  if (!meta) return null;

  const header = parseMapHeader(rom, mapId);
  const objects = parseMapObjects(rom, header.objectPtr, header.bank);

  // Read block data
  const blockOffset = rom.resolvePointer(header.bank, header.blockPtr);
  const blockCount = header.width * header.height;
  const blocks: number[] = [];
  for (let i = 0; i < blockCount; i++) {
    blocks.push(rom.readByte(blockOffset + i));
  }

  // Build connections
  let filteredConnections = header.connections;
  if (meta.connectionFilter) {
    filteredConnections = filteredConnections.filter(c => meta.connectionFilter!.includes(c.direction));
  }

  // Build connection objects
  const connectionMap = new Map<string, MapConnection>();
  for (const conn of filteredConnections) {
    const connMapName = MAP_ID_TO_NAME[conn.mapId];
    if (!connMapName) continue;
    connectionMap.set(conn.direction, {
      direction: conn.direction,
      mapName: connMapName,
      offset: conn.offset,
    });
  }

  // Apply explicit ordering if specified, otherwise use ROM order
  const connections: MapConnection[] = [];
  if (meta.connectionOrder) {
    for (const dir of meta.connectionOrder) {
      const conn = connectionMap.get(dir);
      if (conn) connections.push(conn);
    }
  } else {
    for (const conn of filteredConnections) {
      const mapped = connectionMap.get(conn.direction);
      if (mapped) connections.push(mapped);
    }
  }

  // Build warps
  const warps: MapWarp[] = objects.warps.map(w => {
    // Map dest map ID 0xFF (LAST_MAP) to the parent outdoor map name
    let destMap: string;
    if (w.destMapId === 0xFF) {
      destMap = resolveLastMap(mapName);
    } else {
      destMap = MAP_ID_TO_NAME[w.destMapId] || `UnknownMap_${w.destMapId}`;
    }
    return {
      x: w.x,
      y: w.y,
      destMap,
      destWarpId: w.destWarpId,
    };
  });

  // Build signs from ROM coordinates + ROM text (via pre-computed sym-file offsets)
  const signs: MapSign[] = [];
  for (let i = 0; i < objects.signs.length && i < meta.signTextOffsets.length; i++) {
    const text = decodeMapText(rom, meta.signTextOffsets[i]);
    signs.push({
      x: objects.signs[i].x,
      y: objects.signs[i].y,
      text,
    });
  }

  // Build NPCs from ROM binary + metadata
  const npcFilter = NPC_INDEX_FILTER[mapName];
  const romNpcIndices = npcFilter || Array.from({ length: objects.npcs.length }, (_, i) => i);

  const npcs: MapNpc[] = [];
  for (let metaIdx = 0; metaIdx < meta.npcs.length; metaIdx++) {
    if (metaIdx >= romNpcIndices.length) break;
    const romIdx = romNpcIndices[metaIdx];
    const romNpc = objects.npcs[romIdx];
    const npcMeta = meta.npcs[metaIdx];

    // Use metadata overrides when present, otherwise derive from ROM
    const spriteName = npcMeta.sprite || SPRITE_NAMES[romNpc.sprite] || `sprite_${romNpc.sprite}`;
    const movementName = npcMeta.movement || MOVEMENT_NAMES[romNpc.movement] || 'stay';
    const npcX = npcMeta.x !== undefined ? npcMeta.x : romNpc.x;
    const npcY = npcMeta.y !== undefined ? npcMeta.y : romNpc.y;

    // Standard map trainer: class and party come from the object, texts from its header
    const trainerClassId = romNpc.trainerClassId ?? 0;
    const trainer = trainerClassId >= OPP_ID_OFFSET
      ? readTrainerTexts(rom, mapName, romNpc.textId)
      : null;

    // Item ball = item-flagged object whose text is PickUpItemText
    const isItemBall = romNpc.isItem &&
      textPointerAddr(rom, mapName, romNpc.textId) === PICK_UP_ITEM_TEXT_ADDR;

    // Read dialogue: metadata override (demo-custom text) > trainer header (before-battle
    // text) > textOffset (sym-file) > TextPointers (auto). Engine-driven text — scripted
    // NPCs and item balls — gets none, so the fallback can't guess.
    const engineText = npcMeta.scripted === true || isItemBall;
    let dialogue = npcMeta.dialogue || '';
    if (!dialogue && trainer) {
      dialogue = trainer.battleText;
    }
    if (!dialogue && !engineText && npcMeta.textOffset) {
      dialogue = decodeMapText(rom, npcMeta.textOffset);
    }
    if (!dialogue && !engineText) {
      dialogue = readMapText(rom, mapName, romNpc.textId) || '';
    }

    const npc: MapNpc = {
      id: npcMeta.id,
      sprite: spriteName,
      x: npcX,
      y: npcY,
      movement: movementName,
      dialogue,
    };

    // Add direction/walkDir from metadata (gives exact control over JSON output)
    if (npcMeta.direction) {
      npc.direction = npcMeta.direction;
    }
    if (npcMeta.walkDir) {
      npc.walkDir = npcMeta.walkDir;
    }

    // Add object flag
    if (npcMeta.object) {
      npc.object = true;
    }

    // Add shop items
    if (npcMeta.shopItems) {
      npc.shopItems = npcMeta.shopItems;
    }

    // Item ball: the item it holds
    if (isItemBall && romNpc.itemId !== undefined) {
      npc.item = itemNames[romNpc.itemId] ?? `ITEM_${romNpc.itemId}`;
    }

    // Standard trainer: class, 0-based party, and the texts after the battle
    if (trainer) {
      npc.trainerClass = trainerClassNames[trainerClassId - OPP_ID_OFFSET] ?? `TRAINER_${trainerClassId}`;
      npc.trainerParty = (romNpc.trainerSet ?? 1) - 1;
      npc.endBattleText = trainer.endBattleText;
      npc.afterBattleText = trainer.afterBattleText;
    }

    npcs.push(npc);
  }

  // Build result
  const result: MapData = {
    name: mapName,
    width: header.width,
    height: header.height,
    tileset: TILESET_NAMES[header.tileset] || `TILESET_${header.tileset}`,
    connections,
    blocks,
    borderBlock: objects.borderBlock,
    warps,
    signs,
    npcs,
  };

  // Add hidden events if present
  // Hidden events read text from ROM via textOffset (pre-computed sym-file offset).
  if (meta.hiddenEvents && meta.hiddenEvents.length > 0) {
    const resolvedHiddenEvents: MapHiddenEvent[] = [];
    for (const he of meta.hiddenEvents) {
      if (he.scriptId || he.item) {
        // Script/item-based hidden event — no text to read
        const { textOffset: _unused, ...rest } = he;
        void _unused;
        resolvedHiddenEvents.push(rest);
      } else if (he.textOffset) {
        // Read text from ROM at the pre-computed offset
        const text = decodeMapText(rom, he.textOffset);
        const { textOffset: _unused, ...rest } = he;
        void _unused;
        resolvedHiddenEvents.push({ ...rest, text: text || '' });
      } else {
        resolvedHiddenEvents.push(he);
      }
    }
    result.hiddenEvents = resolvedHiddenEvents;
  }

  return result;
}

/** Resolve LAST_MAP (0xFF) destination to the parent outdoor map name */
function resolveLastMap(mapName: string): string {
  const parentMap: Record<string, string> = {
    RedsHouse1F: 'PalletTown',
    RedsHouse2F: 'RedsHouse1F',
    BluesHouse: 'PalletTown',
    OaksLab: 'PalletTown',
    ViridianPokecenter: 'ViridianCity',
    ViridianMart: 'ViridianCity',
    ViridianSchoolHouse: 'ViridianCity',
    ViridianNicknameHouse: 'ViridianCity',
    Route2Gate: 'Route2',
    Route2TradeHouse: 'Route2',
    DiglettsCaveRoute2: 'Route2',  // its map script also forces wLastMap = ROUTE_2
    ViridianForestSouthGate: 'Route2',
    ViridianForestNorthGate: 'Route2',
  };
  return parentMap[mapName] || 'PalletTown';
}

/** Extract every map in EXTRACTABLE_MAPS, keyed by map name */
export function extractAllMaps(
  rom: BinaryReader,
  itemNames: Record<number, string>,
  trainerClassNames: string[],
): Record<string, MapData> {
  const result: Record<string, MapData> = {};
  for (const mapName of Object.keys(EXTRACTABLE_MAPS)) {
    const data = extractMap(rom, mapName, itemNames, trainerClassNames);
    if (data) {
      result[mapName] = data;
    }
  }
  return result;
}
