import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ROM_PATH = resolve(__dirname, '../../zelda1-disassembly-master/ext/Original.nes');
const ASM_PATH = resolve(__dirname, '../../zelda1-disassembly-master/src/Z_05.asm');
const OBJ_LIST_ADDRS_PATH = resolve(__dirname, '../../zelda1-disassembly-master/src/dat/ObjListAddrs.inc');
const OUTPUT_PATH = resolve(__dirname, '../src/data/enemy-spawns.json');

const INES_HEADER = 16;

// ROM offsets (from bins.xml)
const OBJ_LISTS_OFFSET = 83574 + INES_HEADER;
const OBJ_LISTS_LENGTH = 201;
const LEVEL_BLOCK_OW_OFFSET = 99328 + INES_HEADER;
const LEVEL_BLOCK_OW_LENGTH = 768;
const LEVEL_INFO_OW_OFFSET = 103168 + INES_HEADER;
const LEVEL_INFO_OW_LENGTH = 252;

const SCREENS_TOTAL = 128;
const LI_FOE_COUNTS = 36;

// Object type name map (from UpdateObject_JumpTable, Z_07.asm:5321)
const OBJECT_TYPE_NAMES: Record<number, string> = {
  0x00: 'None',
  0x01: 'BlueLynel',
  0x02: 'RedLynel',
  0x03: 'BlueMoblin',
  0x04: 'RedMoblin',
  0x05: 'BlueGoriya',
  0x06: 'RedGoriya',
  0x07: 'RedSlowOctorok',
  0x08: 'RedFastOctorok',
  0x09: 'BlueSlowOctorok',
  0x0A: 'BlueFastOctorok',
  0x0B: 'RedDarknut',
  0x0C: 'BlueDarknut',
  0x0D: 'BlueTektite',
  0x0E: 'RedTektite',
  0x0F: 'BlueLeever',
  0x10: 'RedLeever',
  0x11: 'Zora',
  0x12: 'Vire',
  0x13: 'Zol',
  0x14: 'ChildGel',
  0x15: 'Gel',
  0x16: 'PolsVoice',
  0x17: 'LikeLike',
  0x18: 'LittleDigdogger',
  0x19: 'Unused19',
  0x1A: 'Peahat',
  0x1B: 'BlueKeese',
  0x1C: 'RedKeese',
  0x1D: 'BlackKeese',
  0x1E: 'Armos',
  0x1F: 'BoulderSet',
  0x20: 'Boulder',
  0x21: 'Ghini',
  0x22: 'FlyingGhini',
  0x23: 'BlueWizzrobe',
  0x24: 'RedWizzrobe',
  0x25: 'PatraChild1',
  0x26: 'PatraChild2',
  0x27: 'Wallmaster',
  0x28: 'Rope',
  0x29: 'Unused29',
  0x2A: 'Stalfos',
  0x2B: 'Bubble',
  0x2C: 'BlueBubble',
  0x2D: 'RedBubble',
  0x2E: 'Whirlwind',
  0x2F: 'PondFairy',
  0x30: 'Gibdo',
  0x31: 'Dodongo',
  0x32: 'Dodongo2',
  0x33: 'BlueGohma',
  0x34: 'RedGohma',
  0x35: 'RupeeStash',
  0x36: 'GrumbleGoriya',
  0x37: 'Zelda',
  0x38: 'Digdogger1',
  0x39: 'Digdogger2',
  0x3A: 'RedLanmola',
  0x3B: 'BlueLanmola',
  0x3C: 'Manhandla',
  0x3D: 'Aquamentus',
  0x3E: 'Ganon',
  0x3F: 'GuardFire',
  0x40: 'StandingFire',
  0x41: 'Moldorm',
  0x42: 'Gleeok2',
  0x43: 'Gleeok3',
  0x44: 'Gleeok4',
  0x45: 'Gleeok4B',
  0x46: 'GleeokHead',
  0x47: 'Patra1',
  0x48: 'Patra2',
  0x49: 'Trap4Way',
  0x4A: 'Trap2Way',
  0x4B: 'UnderworldPerson1',
  0x4C: 'UnderworldPerson2',
  0x4D: 'UnderworldPerson3',
  0x4E: 'UnderworldPerson4',
  0x4F: 'UnderworldPerson5',
  0x50: 'UnderworldPerson6',
  0x51: 'UnderworldPersonLifeOrMoney',
  0x52: 'UnderworldPerson8',
};

// --- ROM reading ---

function readRom(): Buffer {
  const rom = readFileSync(ROM_PATH);
  if (rom.length !== 131088) {
    throw new Error(`Unexpected ROM size: ${rom.length} (expected 131088)`);
  }
  return rom;
}

// --- ObjLists extraction ---

function extractObjLists(rom: Buffer): Uint8Array {
  return new Uint8Array(rom.subarray(
    OBJ_LISTS_OFFSET,
    OBJ_LISTS_OFFSET + OBJ_LISTS_LENGTH,
  ));
}

// --- ObjListAddrs parsing ---

function parseObjListAddrs(): number[] {
  const text = readFileSync(OBJ_LIST_ADDRS_PATH, 'utf-8');
  const offsets: number[] = [];

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    const match = trimmed.match(/\.ADDR\s+ObjLists\+(\d+)/);
    if (match?.[1]) {
      offsets.push(parseInt(match[1], 10));
    }
  }

  if (offsets.length !== 30) {
    throw new Error(`ObjListAddrs: expected 30 entries, got ${offsets.length}`);
  }

  return offsets;
}

function decodeObjectLists(objListsData: Uint8Array, offsets: number[]): number[][] {
  const lists: number[][] = [];

  for (let i = 0; i < offsets.length; i++) {
    const start = offsets[i]!;
    const end = i + 1 < offsets.length ? offsets[i + 1]! : objListsData.length;
    const list: number[] = [];
    for (let j = start; j < end; j++) {
      list.push(objListsData[j]!);
    }
    lists.push(list);
  }

  return lists;
}

// --- ASM parsing ---

function parseByteSection(asmText: string, label: string): number[] {
  const lines = asmText.split('\n');
  const bytes: number[] = [];
  let capturing = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === `${label}:` || trimmed.startsWith(`${label}:`)) {
      capturing = true;
      continue;
    }

    if (capturing) {
      if (trimmed.startsWith('.BYTE')) {
        const dataStr = trimmed.slice(5).split(';')[0]!;
        const values = dataStr.split(',').map(v => {
          const s = v.trim();
          if (s.startsWith('$')) return parseInt(s.slice(1), 16);
          return parseInt(s, 10);
        });
        bytes.push(...values);
      } else if (trimmed === '' || trimmed.startsWith(';')) {
        continue;
      } else {
        break;
      }
    }
  }

  return bytes;
}

function parseSpawnPositionLists(asmText: string): number[][] {
  const lists: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const bytes = parseByteSection(asmText, `SpawnPosList${i}`);
    if (bytes.length !== 9) {
      throw new Error(`SpawnPosList${i}: expected 9 bytes, got ${bytes.length}`);
    }
    lists.push(bytes);
  }
  return lists;
}

// --- Overworld spawn data ---

interface OverworldSpawn {
  screenId: number;
  monsterListId: number;
  monsterCountIndex: number;
  edgeSpawn: boolean;
}

function extractOverworldSpawns(rom: Buffer): OverworldSpawn[] {
  const block = new Uint8Array(rom.subarray(
    LEVEL_BLOCK_OW_OFFSET,
    LEVEL_BLOCK_OW_OFFSET + LEVEL_BLOCK_OW_LENGTH,
  ));

  const spawns: OverworldSpawn[] = [];

  for (let screenId = 0; screenId < SCREENS_TOTAL; screenId++) {
    const attrsC = block[screenId + 256]!;
    const attrsD = block[screenId + 384]!;
    const attrsF = block[screenId + 640]!;

    const monsterListId = (attrsC & 0x3F) | ((attrsD & 0x80) >> 1);
    const monsterCountIndex = (attrsC >> 6) & 0x03;
    const edgeSpawn = (attrsF & 0x08) !== 0;

    spawns.push({ screenId, monsterListId, monsterCountIndex, edgeSpawn });
  }

  return spawns;
}

function extractOverworldFoeCounts(rom: Buffer): number[] {
  const info = new Uint8Array(rom.subarray(
    LEVEL_INFO_OW_OFFSET,
    LEVEL_INFO_OW_OFFSET + LEVEL_INFO_OW_LENGTH,
  ));

  const foeCounts: number[] = [];
  for (let i = 0; i < 4; i++) {
    foeCounts.push(info[LI_FOE_COUNTS + i]!);
  }

  return foeCounts;
}

// --- Validation ---

function validateObjectLists(lists: number[][]): void {
  if (lists.length !== 30) {
    throw new Error(`Expected 30 object lists, got ${lists.length}`);
  }
  for (let i = 0; i < lists.length; i++) {
    const list = lists[i]!;
    if (list.length < 4 || list.length > 8) {
      throw new Error(`Object list ${i}: expected 4-8 entries, got ${list.length}`);
    }
    for (const entry of list) {
      if (entry > 0x52) {
        throw new Error(`Object list ${i}: entry ${entry} exceeds max type 0x52`);
      }
    }
  }
}

function validateOverworldSpawns(spawns: OverworldSpawn[]): void {
  if (spawns.length !== SCREENS_TOTAL) {
    throw new Error(`Expected ${SCREENS_TOTAL} overworld spawns, got ${spawns.length}`);
  }
  for (const spawn of spawns) {
    if (spawn.monsterListId < 0 || spawn.monsterListId > 0x7F) {
      throw new Error(`Screen ${spawn.screenId}: monsterListId ${spawn.monsterListId} out of range 0-127`);
    }
    if (spawn.monsterCountIndex < 0 || spawn.monsterCountIndex > 3) {
      throw new Error(`Screen ${spawn.screenId}: monsterCountIndex ${spawn.monsterCountIndex} out of range 0-3`);
    }
  }
}

// --- Main ---

console.log('Reading ROM...');
const rom = readRom();

console.log('Extracting ObjLists (201 bytes)...');
const objListsData = extractObjLists(rom);

console.log('Parsing ObjListAddrs.inc...');
const listOffsets = parseObjListAddrs();
console.log(`  ${listOffsets.length} list addresses parsed`);

console.log('Decoding 30 object lists...');
const objectLists = decodeObjectLists(objListsData, listOffsets);
validateObjectLists(objectLists);
for (let i = 0; i < objectLists.length; i++) {
  const list = objectLists[i]!;
  const names = list.map(id => OBJECT_TYPE_NAMES[id] ?? `Unknown(${id})`);
  console.log(`  List ${i} (0x${(i + 0x62).toString(16)}): [${names.join(', ')}]`);
}

console.log('Parsing spawn position lists from assembly...');
const asmText = readFileSync(ASM_PATH, 'utf-8');
const spawnPositions = parseSpawnPositionLists(asmText);
console.log(`  ${spawnPositions.length} position lists, ${spawnPositions[0]!.length} positions each`);

console.log('Extracting overworld spawn data (128 screens)...');
const overworldSpawns = extractOverworldSpawns(rom);
validateOverworldSpawns(overworldSpawns);

const screensWithEnemies = overworldSpawns.filter(s => s.monsterListId > 0).length;
const screensWithEdgeSpawn = overworldSpawns.filter(s => s.edgeSpawn).length;
console.log(`  ${screensWithEnemies} screens with enemies, ${screensWithEdgeSpawn} with edge spawning`);

console.log('Extracting overworld foeCounts...');
const overworldFoeCounts = extractOverworldFoeCounts(rom);
console.log(`  foeCounts: [${overworldFoeCounts.join(', ')}]`);

// Build string-keyed object type map for JSON
const objectTypes: Record<string, string> = {};
for (const [id, name] of Object.entries(OBJECT_TYPE_NAMES)) {
  objectTypes[String(id)] = name;
}

const output = {
  objectTypes,
  objectLists,
  spawnPositions,
  overworldSpawns,
  overworldFoeCounts,
};

console.log(`Writing ${OUTPUT_PATH}...`);
writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');
console.log(`Done. ${objectLists.length} object lists, ${overworldSpawns.length} overworld spawns, ${Object.keys(objectTypes).length} object types.`);
