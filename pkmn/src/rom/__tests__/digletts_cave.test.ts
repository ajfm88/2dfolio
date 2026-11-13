// V4 checkpoint-01: expectations transcribed from pret's map constants/objects/text.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { MapData } from '../../core/types';
import { EXTRACTABLE_MAPS } from '../extractors/maps';
import { MAP_TEXT_PTRS } from '../rom_offsets';
import type { TextProgramsFile } from '../extractors/text_programs';

const data = resolve(__dirname, '../../../data');
const refs = resolve(__dirname, '../../../../refs/pokeyellow');
const map = (name: string): MapData => JSON.parse(readFileSync(resolve(data, `maps/${name}.json`), 'utf8'));
const cave = map('DiglettsCave');
const entrance = map('DiglettsCaveRoute11');

describe('Digletts Cave extraction (V4 checkpoint-01)', () => {
  it('has both cartridge map IDs and empty/nonempty text pointer tables', () => {
    expect(EXTRACTABLE_MAPS).toMatchObject({ DiglettsCave: 0xc5, DiglettsCaveRoute11: 0x55 });
    expect(EXTRACTABLE_MAPS).not.toHaveProperty('Route11');
    expect(MAP_TEXT_PTRS.DiglettsCave).toMatchObject({ bank: 0x18, count: 0 });
    expect(MAP_TEXT_PTRS.DiglettsCaveRoute11).toMatchObject({ bank: 7, count: 1 });
  });
  it('has the cartridge dimensions, CAVERN tileset, borders and object counts', () => {
    expect([cave.width, cave.height, cave.tileset, cave.borderBlock]).toEqual([20, 18, 'CAVERN', 0x19]);
    expect([entrance.width, entrance.height, entrance.tileset, entrance.borderBlock]).toEqual([4, 4, 'CAVERN', 0x7d]);
    expect(cave.blocks).toHaveLength(360); expect(entrance.blocks).toHaveLength(16);
    expect(cave.npcs).toEqual([]);
    for (const m of [cave, entrance]) { expect(m.signs).toEqual([]); expect(m.connections).toEqual([]); }
  });
  it('pairs both cave ladders with each entrance third warp, using zero-based destinations', () => {
    expect(cave.warps).toEqual([
      { x: 5, y: 5, destMap: 'DiglettsCaveRoute2', destWarpId: 2 },
      { x: 37, y: 31, destMap: 'DiglettsCaveRoute11', destWarpId: 2 },
    ]);
    expect(map('DiglettsCaveRoute2').warps[2]).toEqual({ x: 4, y: 4, destMap: 'DiglettsCave', destWarpId: 0 });
    expect(entrance.warps).toEqual([
      { x: 2, y: 7, destMap: 'Route11', destWarpId: 4 },
      { x: 3, y: 7, destMap: 'Route11', destWarpId: 4 },
      { x: 4, y: 4, destMap: 'DiglettsCave', destWarpId: 1 },
    ]);
    expect(existsSync(resolve(data, 'maps/Route11.json'))).toBe(false);
  });
  it('retains the stationary gambler and the cartridge dialogue, without trainer metadata', () => {
    expect(entrance.npcs).toEqual([{
      textId: 1, objectId: 1, id: 'gambler', sprite: 'gambler', x: 2, y: 3, movement: 'stay',
      dialogue: 'What a surprise!\nDIGLETTs dug this\nlong tunnel!\fIt goes right to\nVIRIDIAN CITY!',
    }]);
  });
  it('mirrors the two map files and has the empty and one-entry program call tables', () => {
    for (const m of [cave, entrance]) expect(readFileSync(resolve(data, `maps/${m.name}.json`)))
      .toEqual(readFileSync(resolve(__dirname, `../../../static/maps/${m.name}.json`)));
    const programs: TextProgramsFile = JSON.parse(readFileSync(resolve(data, 'text_programs.json'), 'utf8'));
    expect(programs.textPointers.DiglettsCave_TextPointers).toEqual([]);
    expect(programs.textPointers.DiglettsCaveRoute11_TextPointers).toEqual([
      { call: 'text', program: 'DiglettsCaveRoute11GamblerText' },
    ]);
    expect(programs.programs.DiglettsCaveRoute11GamblerText).toEqual([
      { op: 'far', program: '_DiglettsCaveRoute11GamblerText' },
    ]);
  });
  it.skipIf(!existsSync(refs))('matches every block byte in the disassembly assets independently', () => {
    for (const m of [cave, entrance]) expect(m.blocks).toEqual([...readFileSync(resolve(refs, `maps/${m.name}.blk`))]);
  });
});
