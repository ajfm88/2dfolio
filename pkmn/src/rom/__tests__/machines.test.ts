import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BinaryReader } from '../binary_reader';
import { extractMachines, type MachineData } from '../extractors/machines';
import { TECHNICAL_MACHINES, TECHNICAL_MACHINE_PRICES } from '../rom_offsets';

const dataPath = resolve(__dirname, '../../../data/machine_data.json');
const staticPath = resolve(__dirname, '../../../static/machine_data.json');
const data = JSON.parse(readFileSync(dataPath, 'utf8')) as MachineData;
const sourceRoot = resolve(__dirname, '../../../../refs/pokeyellow');

function source(path: string): string {
  return readFileSync(resolve(sourceRoot, path), 'utf8');
}

it('commits the 55 machine moves and 50 source prices in one static mirror', () => {
  const sourcePrices = [...source('data/items/tm_prices.asm').matchAll(/nybble\s+(\d+)\s*;\s*TM\d{2}/g)]
    .map(match => Number(match[1]));
  expect(sourcePrices).toHaveLength(50);
  expect(data.moves).toHaveLength(55);
  expect(data.moves.every(id => Number.isInteger(id) && id >= 1 && id <= 165)).toBe(true);
  expect(data.prices).toEqual(sourcePrices);
  expect(data.prices[33]).toBe(2); // TM34
  const constants = source('constants/move_constants.asm');
  const bide = constants.match(/\bconst BIDE\s*;\s*([\da-f]+)/i);
  const flash = constants.match(/\bconst FLASH\s*;\s*([\da-f]+)/i);
  expect(bide).not.toBeNull(); expect(flash).not.toBeNull();
  expect(source('constants/item_constants.asm')).toMatch(/add_tm BIDE\s*;\s*\$EA/);
  expect(source('constants/item_constants.asm')).toMatch(/add_hm FLASH\s*;\s*\$C8/);
  expect(data.moves[33]).toBe(parseInt(bide![1], 16));
  expect(data.moves[54]).toBe(parseInt(flash![1], 16));
  expect(readFileSync(staticPath)).toEqual(readFileSync(dataPath));
});

it.skipIf(!process.env.ROM_PATH)('extracts the exact ROM tables and checks the terminator', () => {
  const bytes = readFileSync(process.env.ROM_PATH!);
  const rom = new BinaryReader(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  expect(TECHNICAL_MACHINES).toBe(rom.resolvePointer(0x04, 0x632d));
  expect(TECHNICAL_MACHINE_PRICES).toBe(rom.resolvePointer(0x3d, 0x65f5));
  const rawMoves = [...rom.readBytes(TECHNICAL_MACHINES, 56)];
  expect(rawMoves.slice(0, 55)).toEqual(data.moves);
  expect(rawMoves[55]).toBe(0xff);
  const prices = [...rom.readBytes(TECHNICAL_MACHINE_PRICES, 25)];
  expect(prices).toHaveLength(25);
  expect(prices).toEqual(Array.from({ length: 25 }, (_, i) =>
    (data.prices[i * 2] << 4) | data.prices[i * 2 + 1]));
  expect(extractMachines(rom)).toEqual(data);
  expect(readFileSync(dataPath, 'utf8')).toBe(JSON.stringify(extractMachines(rom), null, 2) + '\n');
});
