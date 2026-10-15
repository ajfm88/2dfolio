import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { mapTextKind, mapTextTable } from './map_text_calls';
import type { TextProgramsFile } from '../rom/extractors/text_programs';
const data = JSON.parse(readFileSync(resolve(__dirname, '../../data/text_programs.json'), 'utf8')) as TextProgramsFile;

describe('current map text-pointer bridge (A5b4)', () => {
  it('resolves all 19 current maps, plus both source-selected alternate tables', () => {
    const maps = readdirSync(resolve(__dirname, '../../data/maps')).map(name => name.replace(/\.json$/, ''));
    expect(maps).toHaveLength(19);
    for (const map of maps) expect(data.textPointers[mapTextTable(map)], map).toBeDefined();
    for (const map of ['OaksLab', 'ViridianMart']) expect(data.textPointers[mapTextTable(map, true)]).toBeDefined();
  });
  it('pins direct/wrapped Viridian signs, and leaves handlers/script entries unmigrated', () => {
    expect(mapTextKind('ViridianCity', 9, data)).toBe('printText');
    expect(mapTextKind('ViridianCity', 12, data)).toBe('text');
    expect(mapTextKind('ViridianCity', 6, data)).toBeUndefined(); // Fisher's TM-gift handler
    expect(mapTextKind('ViridianPokecenter', 1, data)).toBeUndefined();
    expect(mapTextKind('PalletTown', undefined, data)).toBeUndefined();
  });
});
