// CP3 tripwires read the ROM and committed data only; never refs/ or an ASM parser.
import { beforeAll, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CIRCLE_DATA, FLASH_SCREEN_PALETTES, HALF_CIRCLE_1, HALF_CIRCLE_2 } from '../../overworld/battle_transition_tables';
import { EXTRACTABLE_MAPS } from '../extractors/maps';

const ROM_PATH = process.env.ROM_PATH;
let rom: Buffer;
beforeAll(() => { if (ROM_PATH) rom = readFileSync(ROM_PATH); });
const DATA = resolve(__dirname, '../../../data');
const json = <T>(file: string): T => JSON.parse(readFileSync(resolve(DATA, file), 'utf8')) as T;

it.skipIf(!ROM_PATH)('guards the complete flash palette table at 1c:4be8', () => {
  expect([...FLASH_SCREEN_PALETTES]).toEqual([...rom.subarray(0x70be8, 0x70be8 + 13)]);
});
it.skipIf(!ROM_PATH).each([0, 1, 2, 3, 4])('guards CircleData%i including its terminator at its symbol address', index => {
  const offsets = [0x70e74, 0x70e7a, 0x70e84, 0x70e96, 0x70ea4];
  const lengths = [6, 10, 18, 14, 16];
  expect([...CIRCLE_DATA[index]]).toEqual([...rom.subarray(offsets[index], offsets[index] + lengths[index])]);
});
it.skipIf(!ROM_PATH).each([0, 1])('guards HalfCircle%i quadrant, data pointers and actual WRAM target pointers', index => {
  const table = [HALF_CIRCLE_1, HALF_CIRCLE_2][index];
  const offset = [0x70dd7, 0x70e09][index];
  const pointers = [0x4e74, 0x4e7a, 0x4e84, 0x4e96, 0x4ea4];
  expect(table).toHaveLength(10);
  table.forEach(([quadrantX, data, x, y], row) => {
    const entry = offset + row * 5;
    expect(quadrantX).toBe(rom[entry]);
    expect(pointers[data]).toBe(rom.readUInt16LE(entry + 1));
    expect(0xc3a0 + y * 20 + x).toBe(rom.readUInt16LE(entry + 3));
  });
});

it.skipIf(!ROM_PATH)('every retained NPC textId is its ROM object slot, independently of text IDs in the ROM', () => {
  const pictures = json<{ pictureIdsBySprite: Record<string, number> }>('map_sprite_sets.json').pictureIdsBySprite;
  let checked = 0;
  for (const [name, id] of Object.entries(EXTRACTABLE_MAPS)) {
    const bank = rom[0xfc3e4 + id];
    const address = rom.readUInt16LE(0xfc1f2 + id * 2);
    const fileAddress = (addr: number): number => bank * 0x4000 + (addr & 0x3fff);
    const header = fileAddress(address), connections = rom[header + 9];
    const count = [1, 2, 4, 8].filter(bit => (connections & bit) !== 0).length;
    let p = fileAddress(rom.readUInt16LE(header + 10 + count * 11)) + 1;
    const warps = rom[p++]; p += warps * 4;
    const signs = rom[p++]; p += signs * 3;
    const objectCount = rom[p++];
    const objects: { slot: number; picture: number; x: number; y: number }[] = [];
    for (let index = 0; index < objectCount; index++) {
      objects.push({ slot: index + 1, picture: rom[p], x: rom[p + 2] - 4, y: rom[p + 1] - 4 });
      const flags = rom[p + 5]; p += flags & 0x40 ? 8 : flags & 0x80 ? 7 : 6;
    }
    const map = json<{ npcs: { id: string; textId: number; sprite: string; x: number; y: number }[] }>(`maps/${name}.json`);
    for (const npc of map.npcs) {
      // Match by original picture/coordinates; matching by textId would hide the bug this guards.
      const matches = objects.filter(object => object.picture === pictures[npc.sprite] && object.x === npc.x && object.y === npc.y);
      expect(matches, `${name}:${npc.id} must identify one original object`).toHaveLength(1);
      expect(npc.textId, `${name}:${npc.id} cartridge slot`).toBe(matches[0].slot);
      checked++;
    }
  }
  expect(checked).toBeGreaterThan(70);
});
