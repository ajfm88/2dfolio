// Map sprite sets (A5b2, notes/26-a5b2-plan.md). Extraction only.
//
// Outdoor maps pick a row of MapSpriteSets (engine/overworld/map_sprites.asm).
// A row of $f1–$fc is a SplitMapSpriteSets record, except Route 20, whose
// branch ignores that row. Indoor maps (map id >= FIRST_INDOOR_MAP) do not
// use those rows: LoadSpriteSetFromMapHeader fills eleven slots from the
// live picture ids. This file records the tables, the picture classes and
// the name bridge. A5b4 fetches it and runs the close. Nothing here is
// consulted at runtime yet.

import { BinaryReader } from '../binary_reader';
import { EXTRACTABLE_MAPS, SPRITE_NAMES } from './maps';
import {
  FIRST_INDOOR_MAP_CP,
  FIRST_STILL_PICTURE_CP,
  MAP_SPRITE_SETS,
  MAP_SPRITE_SETS_LD,
  PIKACHU_PICTURE_CP,
  PIKACHU_PICTURE_LD,
  ROUTE20_EAST_SET_LD,
  ROUTE20_EAST_SET_REPEAT,
  ROUTE20_SPLIT_CP,
  ROUTE20_WEST_SET_LD,
  ROUTE20_WEST_SET_REPEAT,
  ROUTE20_X_EAST_CP,
  ROUTE20_X_MIDDLE_CP,
  ROUTE20_X_WEST_CP,
  ROUTE20_Y_HIGH_LD,
  ROUTE20_Y_LOW_LD,
  SPLIT_MAP_SPRITE_SETS,
  SPLIT_MAP_SPRITE_SETS_LD,
  SPLIT_SET_THRESHOLD_CP,
  SPRITE_SETS,
  SPRITE_SETS_LD,
  SPRITE_SHEET_PTRS,
  SPRITE_SHEET_PTRS_LD,
} from '../rom_offsets';

/** Tiles copied in one half. A regular sheet is two of these; a still picture is one. */
export interface SpritePictureMetadata {
  kind: 'walking' | 'still';
  tileCount: 12 | 4;
}

/** SplitMapSpriteSets row. Coordinate < divider takes belowSetId. */
export interface LinearSpriteSplit {
  axis: 'x' | 'y';
  divider: number;
  belowSetId: number;
  atOrAboveSetId: number;
}

/** GetSplitMapSpriteSetID's Route 20 branch. It does not read the $f8 row. */
export interface Route20SpriteSplit {
  splitSetId: number;
  xCuts: [number, number, number];
  yCuts: [number, number];
  westSetId: number;
  eastSetId: number;
}

export interface MapSpriteSetsFile {
  firstIndoorMapId: number;
  firstStillPictureId: number;
  pikachuPictureId: number;
  mapIds: Record<string, number>;
  pictureIdsBySprite: Record<string, number>;
  outdoorSetIds: number[];
  splitSets: Record<number, LinearSpriteSplit>;
  spriteSets: Record<number, number[]>;
  pictures: Record<number, SpritePictureMetadata>;
  route20: Route20SpriteSplit;
}

/** LoadSpriteSetFromMapHeader's regular region, then its still region. */
export const SPRITE_SET_REGULAR_SLOTS = 9;
export const SPRITE_SET_STILL_SLOTS = 2;
export const SPRITE_SET_SLOT_COUNT = SPRITE_SET_REGULAR_SLOTS + SPRITE_SET_STILL_SLOTS;
/** wSprite01StateData1 through wSprite14StateData1. */
export const INDOOR_NPC_SLOT_COUNT = 14;

const OUTDOOR_MAP_COUNT = 0x25;
const SPLIT_ROW_COUNT = 12;
const SPRITE_SET_COUNT = 10;
const PICTURE_COUNT = 82;
const PICTURE_ENTRY_BYTES = 4;
const FIRST_SPLIT_ID = 0xf1;
const LAST_SPLIT_ID = 0xfc;
const OP_LD_HL = 0x21;
const OP_LD_DE = 0x11;
const OP_CP = 0xfe;
const OP_LD_A = 0x3e;
const OP_LD_B = 0x06;

function fail(where: string, detail: string): never {
  throw new Error(`map sprite sets: ${where}: ${detail}`);
}

function hex(n: number): string {
  return n.toString(16);
}

function requireRange(rom: BinaryReader, offset: number, length: number, where: string): void {
  if (!Number.isInteger(offset) || offset < 0 || length < 0 || offset + length > rom.length) {
    fail(where, `${length} bytes at $${hex(offset)} are outside the ROM (${rom.length} bytes)`);
  }
}

function readImm(rom: BinaryReader, insn: number, opcode: number, where: string): number {
  requireRange(rom, insn, 2, where);
  const op = rom.readByte(insn);
  if (op !== opcode) fail(where, `opcode $${hex(op)} at $${hex(insn)}, expected $${hex(opcode)}`);
  return rom.readByte(insn + 1);
}

/** The CPU address a bank-$05 file offset points at. */
function cpuAddress(fileOffset: number): number {
  return (fileOffset & 0x3fff) | 0x4000;
}

function requirePointer(rom: BinaryReader, insn: number, opcode: number, table: number, where: string): void {
  requireRange(rom, insn, 3, where);
  const op = rom.readByte(insn);
  const addr = rom.readByte(insn + 1) | (rom.readByte(insn + 2) << 8);
  const expected = cpuAddress(table);
  if (op !== opcode || addr !== expected) {
    fail(where, `$${hex(op)} $${hex(addr)} at $${hex(insn)}, expected $${hex(opcode)} $${hex(expected)}`);
  }
}

/** Z80 `swap`: the high and low nibbles trade places. $c0 → 12, $40 → 4. */
function swapNibbles(byte: number): number {
  return ((byte & 0x0f) << 4) | (byte >> 4);
}

function pictureKind(id: number, pikachu: number, firstStill: number): 'walking' | 'still' {
  if (id === pikachu) return 'walking';
  if (id >= firstStill) return 'still';
  return 'walking';
}

function requireSetId(id: number, where: string): number {
  if (!Number.isInteger(id) || id < 1 || id > SPRITE_SET_COUNT) {
    fail(where, `set id $${hex(id)} is outside 1–${SPRITE_SET_COUNT}`);
  }
  return id;
}

function requirePictureId(id: number, where: string): number {
  if (!Number.isInteger(id) || id < 1 || id > PICTURE_COUNT) {
    fail(where, `picture id $${hex(id)} is outside 1–${PICTURE_COUNT}`);
  }
  return id;
}

/** Engine asset name → picture id. A repeated name is a registry error, not a last-write. */
export function invertSpriteNames(names: Record<number, string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [raw, name] of Object.entries(names)) {
    if (!name) fail('sprite names', `picture $${hex(Number(raw))} has an empty name`);
    if (Object.prototype.hasOwnProperty.call(out, name)) {
      fail('sprite names', `duplicate sprite name ${name}`);
    }
    const id = Number(raw);
    requirePictureId(id, `sprite name ${name}`);
    out[name] = id;
  }
  return out;
}

function readConstants(rom: BinaryReader): {
  firstIndoor: number;
  pikachu: number;
  firstStill: number;
  route20: Route20SpriteSplit;
} {
  requirePointer(rom, MAP_SPRITE_SETS_LD, OP_LD_HL, MAP_SPRITE_SETS, 'MapSpriteSets ld');
  requirePointer(rom, SPLIT_MAP_SPRITE_SETS_LD, OP_LD_HL, SPLIT_MAP_SPRITE_SETS, 'SplitMapSpriteSets ld');
  requirePointer(rom, SPRITE_SETS_LD, OP_LD_HL, SPRITE_SETS, 'SpriteSets ld');
  requirePointer(rom, SPRITE_SHEET_PTRS_LD, OP_LD_DE, SPRITE_SHEET_PTRS, 'SpriteSheetPointerTable ld');

  const firstIndoor = readImm(rom, FIRST_INDOOR_MAP_CP, OP_CP, 'FIRST_INDOOR_MAP');
  if (firstIndoor !== OUTDOOR_MAP_COUNT) {
    fail('FIRST_INDOOR_MAP', `operand $${hex(firstIndoor)}, expected $${hex(OUTDOOR_MAP_COUNT)}`);
  }
  const pikachuLd = readImm(rom, PIKACHU_PICTURE_LD, OP_LD_A, 'SPRITE_PIKACHU ld');
  const pikachuCp = readImm(rom, PIKACHU_PICTURE_CP, OP_CP, 'SPRITE_PIKACHU cp');
  if (pikachuLd !== pikachuCp || pikachuLd !== 0x3d) {
    fail('SPRITE_PIKACHU', `ld $${hex(pikachuLd)} and cp $${hex(pikachuCp)}, expected $3d`);
  }
  const firstStill = readImm(rom, FIRST_STILL_PICTURE_CP, OP_CP, 'FIRST_STILL_SPRITE');
  if (firstStill !== 0x47 || firstStill <= pikachuLd) {
    fail('FIRST_STILL_SPRITE', `operand $${hex(firstStill)}, expected $47 above Pikachu`);
  }
  const threshold = readImm(rom, SPLIT_SET_THRESHOLD_CP, OP_CP, 'split threshold');
  if (threshold !== FIRST_SPLIT_ID - 1) {
    fail('split threshold', `operand $${hex(threshold)}, expected $${hex(FIRST_SPLIT_ID - 1)}`);
  }
  const route20Id = readImm(rom, ROUTE20_SPLIT_CP, OP_CP, 'Route 20 selector');
  if (route20Id !== 0xf8) fail('Route 20 selector', `operand $${hex(route20Id)}, expected $f8`);

  const xWest = readImm(rom, ROUTE20_X_WEST_CP, OP_CP, 'Route 20 west X');
  const xMiddle = readImm(rom, ROUTE20_X_MIDDLE_CP, OP_CP, 'Route 20 middle X');
  const xEast = readImm(rom, ROUTE20_X_EAST_CP, OP_CP, 'Route 20 east X');
  if (!(xWest < xMiddle && xMiddle < xEast)) {
    fail('Route 20 X cuts', `${xWest}, ${xMiddle}, ${xEast} are not strictly increasing`);
  }
  const yHigh = readImm(rom, ROUTE20_Y_HIGH_LD, OP_LD_B, 'Route 20 Y for X 55–61');
  const yLow = readImm(rom, ROUTE20_Y_LOW_LD, OP_LD_B, 'Route 20 Y for X 43–54');
  const west = readImm(rom, ROUTE20_WEST_SET_LD, OP_LD_A, 'Route 20 west set');
  const westRepeat = readImm(rom, ROUTE20_WEST_SET_REPEAT, OP_LD_A, 'Route 20 west set repeat');
  const east = readImm(rom, ROUTE20_EAST_SET_LD, OP_LD_A, 'Route 20 east set');
  const eastRepeat = readImm(rom, ROUTE20_EAST_SET_REPEAT, OP_LD_A, 'Route 20 east set repeat');
  if (west !== westRepeat || east !== eastRepeat) {
    fail('Route 20 sets', `west ${west}/${westRepeat}, east ${east}/${eastRepeat}`);
  }
  requireSetId(west, 'Route 20 west set');
  requireSetId(east, 'Route 20 east set');

  return {
    firstIndoor,
    pikachu: pikachuLd,
    firstStill,
    route20: {
      splitSetId: route20Id,
      xCuts: [xWest, xMiddle, xEast],
      yCuts: [yLow, yHigh],
      westSetId: west,
      eastSetId: east,
    },
  };
}

export function extractMapSpriteSets(rom: BinaryReader): MapSpriteSetsFile {
  const constants = readConstants(rom);

  requireRange(rom, MAP_SPRITE_SETS, OUTDOOR_MAP_COUNT, 'MapSpriteSets');
  requireRange(rom, SPLIT_MAP_SPRITE_SETS, SPLIT_ROW_COUNT * 4, 'SplitMapSpriteSets');
  requireRange(rom, SPRITE_SETS, SPRITE_SET_COUNT * SPRITE_SET_SLOT_COUNT, 'SpriteSets');
  requireRange(rom, SPRITE_SHEET_PTRS, PICTURE_COUNT * PICTURE_ENTRY_BYTES, 'SpriteSheetPointerTable');

  const pictures: Record<number, SpritePictureMetadata> = {};
  for (let id = 1; id <= PICTURE_COUNT; id++) {
    const entry = SPRITE_SHEET_PTRS + (id - 1) * PICTURE_ENTRY_BYTES;
    const sizeByte = rom.readByte(entry + 2);
    const swapped = swapNibbles(sizeByte);
    if (swapped !== 12 && swapped !== 4) {
      fail(`picture $${hex(id)}`, `size byte $${hex(sizeByte)} swaps to ${swapped} tiles, expected 12 or 4`);
    }
    const tileCount: 12 | 4 = swapped === 12 ? 12 : 4;
    const kind = pictureKind(id, constants.pikachu, constants.firstStill);
    if ((kind === 'walking' && tileCount !== 12) || (kind === 'still' && tileCount !== 4)) {
      fail(`picture $${hex(id)}`, `${kind} picture has ${tileCount} tiles`);
    }
    pictures[id] = { kind, tileCount };
  }

  const spriteSets: Record<number, number[]> = {};
  for (let setId = 1; setId <= SPRITE_SET_COUNT; setId++) {
    const base = SPRITE_SETS + (setId - 1) * SPRITE_SET_SLOT_COUNT;
    const slots: number[] = [];
    for (let slot = 0; slot < SPRITE_SET_SLOT_COUNT; slot++) {
      slots.push(requirePictureId(rom.readByte(base + slot), `set ${setId} slot ${slot}`));
    }
    if (slots[0] !== constants.pikachu) {
      fail(`set ${setId}`, `slot 0 is $${hex(slots[0])}, expected Pikachu $${hex(constants.pikachu)}`);
    }
    for (let slot = 0; slot < SPRITE_SET_SLOT_COUNT; slot++) {
      const meta = pictures[slots[slot]];
      const want = slot < SPRITE_SET_REGULAR_SLOTS ? 'walking' : 'still';
      if (meta.kind !== want) {
        fail(`set ${setId} slot ${slot}`, `picture $${hex(slots[slot])} is ${meta.kind}, expected ${want}`);
      }
    }
    spriteSets[setId] = slots;
  }

  const splitSets: Record<number, LinearSpriteSplit> = {};
  for (let row = 0; row < SPLIT_ROW_COUNT; row++) {
    const id = FIRST_SPLIT_ID + row;
    const base = SPLIT_MAP_SPRITE_SETS + row * 4;
    const axisByte = rom.readByte(base);
    const axis = axisByte === 1 ? 'x' : axisByte === 2 ? 'y' : null;
    if (axis === null) {
      fail(`split $${hex(id)}`, `axis byte $${hex(axisByte)} at $${hex(base)} is not EAST_WEST (1) or NORTH_SOUTH (2)`);
    }
    splitSets[id] = {
      axis,
      divider: rom.readByte(base + 1),
      belowSetId: requireSetId(rom.readByte(base + 2), `split $${hex(id)} below`),
      atOrAboveSetId: requireSetId(rom.readByte(base + 3), `split $${hex(id)} at or above`),
    };
  }
  if (splitSets[constants.route20.splitSetId] === undefined) {
    fail('Route 20', `selector $${hex(constants.route20.splitSetId)} has no split row`);
  }

  const outdoorSetIds: number[] = [];
  for (let mapId = 0; mapId < OUTDOOR_MAP_COUNT; mapId++) {
    const selector = rom.readByte(MAP_SPRITE_SETS + mapId);
    const fixed = selector >= 1 && selector <= SPRITE_SET_COUNT;
    const split = selector >= FIRST_SPLIT_ID && selector <= LAST_SPLIT_ID;
    if (!fixed && !split) {
      fail(`outdoor map $${hex(mapId)}`, `selector $${hex(selector)} is not a set 1–${SPRITE_SET_COUNT} or a split $${hex(FIRST_SPLIT_ID)}–$${hex(LAST_SPLIT_ID)}`);
    }
    if (split && splitSets[selector] === undefined) {
      fail(`outdoor map $${hex(mapId)}`, `selector $${hex(selector)} has no split row`);
    }
    outdoorSetIds.push(selector);
  }

  const mapIds: Record<string, number> = {};
  const seenMapIds = new Set<number>();
  for (const [name, id] of Object.entries(EXTRACTABLE_MAPS)) {
    if (!Number.isInteger(id) || id < 0 || id > 0xff || seenMapIds.has(id)) {
      fail('map ids', `${name} has map id ${id}`);
    }
    seenMapIds.add(id);
    mapIds[name] = id;
  }

  return {
    firstIndoorMapId: constants.firstIndoor,
    firstStillPictureId: constants.firstStill,
    pikachuPictureId: constants.pikachu,
    mapIds,
    pictureIdsBySprite: invertSpriteNames(SPRITE_NAMES),
    outdoorSetIds,
    splitSets,
    spriteSets,
    pictures,
    route20: constants.route20,
  };
}
