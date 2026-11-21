// Opening checkpoint-11: execute the pure port against native cartridge traces, without requiring a ROM at test time.
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { IntroObjectEngine, introSine, OBJECT_FIELD as F, OBJECT_REGISTER as R, type IntroObjectTables } from './intro_objects';
import type { YellowIntroData } from '../rom/extractors/yellow_intro';

const SRC = resolve(__dirname, '..');
const data: YellowIntroData = JSON.parse(readFileSync(resolve(SRC, '../data/yellow_intro.json'), 'utf8'));
type Overrides = {
  spawnStates?: Record<string, [number, number, number]>;
  framesets?: Record<string, number[]>;
  oamSets?: Record<string, { tileOffset: number; entries: [number, number, number, number][] }>;
};
type Operation =
  | { op: 'spawn'; id: number; x: number; y: number }
  | { op: 'run'; repeat: number; scene: number; reset: boolean }
  | { op: 'mask'; slot: number } | { op: 'maskAll' | 'clear' }
  | { op: 'setFrameset'; slot: number; id: number }
  | { op: 'object'; slot: number; bytes: [number, number][] }
  | { op: 'registers'; bytes: [number, number][] } | { op: 'oam'; value: number };
interface OracleCase { name: string; tables?: Overrides; ops: Operation[]; trace: string[] }
const fixture: { cases: OracleCase[]; sine: { amplitude: number; values: number[] }[] } =
  JSON.parse(readFileSync(resolve(__dirname, '__fixtures__/intro_objects_oracle.json'), 'utf8'));
function tables(overrides?: Overrides): IntroObjectTables {
  const copy: IntroObjectTables = structuredClone(data);
  for (const [id, value] of Object.entries(overrides?.spawnStates ?? {})) copy.spawnStates[Number(id)] = value;
  for (const [id, value] of Object.entries(overrides?.framesets ?? {})) copy.framesets[Number(id)] = value;
  for (const [id, value] of Object.entries(overrides?.oamSets ?? {})) copy.oamSets[Number(id)] = value;
  return copy;
}
function execute(test: OracleCase): string[] {
  const engine = new IntroObjectEngine(tables(test.tables)), oam = new Uint8Array(160), trace: string[] = [];
  const record = (result: number | boolean | null): void => {
    const hex = (raw: Uint8Array): string => Buffer.from(raw).toString('hex');
    trace.push(createHash('sha256').update(JSON.stringify([result, hex(engine.objects), hex(engine.registers), hex(oam)])).digest('hex'));
  };
  for (const op of test.ops) {
    let result: number | boolean | null = null;
    switch (op.op) {
      case 'spawn': result = engine.spawn(op.id, op.x, op.y); break;
      case 'clear': engine.clear(); break;
      case 'mask': engine.mask(op.slot); break;
      case 'maskAll': engine.maskAll(); break;
      case 'setFrameset': engine.setFrameset(op.slot, op.id); break;
      case 'object': for (const [field, value] of op.bytes) engine.objects[op.slot * 16 + field] = value; break;
      case 'registers': for (const [field, value] of op.bytes) engine.registers[field] = value; break;
      case 'oam': oam.fill(op.value); break;
      case 'run':
        for (let i = 0; i < op.repeat; i++) {
          if (op.reset) engine.registers[R.oamOffset] = 0;
          record(engine.run(oam, op.scene));
        }
        continue;
    }
    record(result);
  }
  return trace;
}

describe('Intro object engine: native ASM trace after every call', () => {
  for (const test of fixture.cases) it(test.name, () => expect(execute(test)).toEqual(test.trace));
  for (const test of fixture.sine) it(`Intro_Sine: all 256 phases at amplitude ${test.amplitude}`, () => {
    expect(Array.from({ length: 256 }, (_, phase) => introSine(phase, test.amplitude, data.sineWave))).toEqual(test.values);
  });
});

describe('Intro object engine: ownership and named cartridge quirks', () => {
  it('uses ten sixteen-byte slots; spawn ignores row byte three and initializes every field', () => {
    const engine = new IntroObjectEngine(tables({ spawnStates: { 1: [1, 1, 253] } }));
    engine.objects.fill(0xa5); engine.objects[0] = 0;
    expect(engine.spawn(1, 258, -1)).toBe(0);
    expect(Array.from(engine.objects.slice(0, 16))).toEqual([1, 1, 1, 0, 2, 255, 0, 0, 0, 0, 255, 0, 0, 0, 0, 0]);
    expect(engine.objects.length).toBe(160);
  });
  it('full allocation returns null without changing state; masking frees the first matching slot', () => {
    const engine = new IntroObjectEngine(tables());
    for (let i = 0; i < 10; i++) expect(engine.spawn(1, i, i)).toBe(i);
    const before = engine.objects.slice(), registers = engine.registers.slice();
    expect(engine.spawn(1, 0, 0)).toBeNull(); expect(engine.objects).toEqual(before); expect(engine.registers).toEqual(registers);
    engine.mask(2); expect(engine.objects[2 * 16 + F.x]).toBe(2); expect(engine.spawn(2, 0, 0)).toBe(2);
  });
  it('clear resets engine bytes without owning or clearing the supplied OAM', () => {
    const engine = new IntroObjectEngine(tables()), oam = new Uint8Array(160).fill(0xa5);
    engine.spawn(1, 88, 88); engine.registers.fill(9); engine.clear();
    expect(engine.objects.every(n => n === 0)).toBe(true); expect(engine.registers.every(n => n === 0)).toBe(true);
    expect(oam.every(n => n === 0xa5)).toBe(true);
  });
  it('setFrameset writes byte one and resets only the three frame-state bytes', () => {
    const engine = new IntroObjectEngine(tables()); engine.spawn(4, 90, 91);
    engine.objects[F.duration] = 7; engine.objects[F.durationOffset] = 9; engine.objects[F.fieldB] = 42;
    engine.setFrameset(0, 9);
    expect(Array.from(engine.objects.slice(0, 16))).toEqual([1, 9, 2, 0, 90, 91, 0, 0, 0, 0, 255, 42, 0, 0, 0, 0]);
  });
  it('a stored duration of four displays each running frame for five updates', () => {
    const engine = new IntroObjectEngine(tables()), oam = new Uint8Array(160), tiles: number[] = [];
    engine.spawn(1, 88, 88);
    for (let i = 0; i < 16; i++) { engine.registers[R.oamOffset] = 0; engine.run(oam, 0); tiles.push(oam[2]); }
    expect(tiles).toEqual([...Array<number>(5).fill(0x96), ...Array<number>(5).fill(0x98), ...Array<number>(5).fill(0x9a), 0x96]);
  });
  it('endanim repeats the final frame and reloads its duration instead of deleting it', () => {
    const engine = new IntroObjectEngine(tables()), oam = new Uint8Array(160); engine.spawn(0, 88, 88);
    for (let i = 0; i < 34; i++) { engine.registers[R.oamOffset] = 0; engine.run(oam, 0); }
    expect(engine.objects[F.index]).toBe(1); expect(engine.objects[F.frameIndex]).toBe(0); expect(engine.objects[F.duration]).toBe(32);
  });
  it('surfing derives Y from the updated X and keeps old Y once X reaches $58', () => {
    const engine = new IntroObjectEngine(tables()), oam = new Uint8Array(160); engine.spawn(5, 0xf8, 0x40);
    engine.run(oam, 7); expect([engine.objects[F.x], engine.objects[F.y]]).toEqual([0xfc, 0xfd]);
    engine.registers[R.oamOffset] = 0; engine.run(oam, 7); expect([engine.objects[F.x], engine.objects[F.y]]).toEqual([0, 1]);
    for (let i = 0; i < 24; i++) { engine.registers[R.oamOffset] = 0; engine.run(oam, 7); }
    expect([engine.objects[F.x], engine.objects[F.y]]).toEqual([0x58, 0x55]);
  });
  it('flying reaches Y=$58 before entering the bob state on the next update', () => {
    const engine = new IntroObjectEngine(tables()), oam = new Uint8Array(160); engine.spawn(6, 88, 0x98);
    for (let i = 0; i < 32; i++) { engine.registers[R.oamOffset] = 0; engine.run(oam, 11); }
    expect([engine.objects[F.y], engine.objects[F.fieldB], engine.objects[F.fieldC]]).toEqual([88, 0, 0]);
    engine.registers[R.oamOffset] = 0; engine.run(oam, 11);
    expect([engine.objects[F.y], engine.objects[F.fieldB], engine.objects[F.fieldC], engine.objects[F.yOffset]]).toEqual([88, 1, 1, 0]);
  });
  it('the caller owns the OAM offset and run clears every tail byte while preserving the prefix', () => {
    const engine = new IntroObjectEngine(tables()), oam = new Uint8Array(160).fill(0xa5);
    engine.registers[R.oamOffset] = 12; engine.run(oam, 0);
    expect(Array.from(oam.slice(0, 12))).toEqual(Array<number>(12).fill(0xa5)); expect(oam.slice(12).every(n => n === 0)).toBe(true);
  });
  it('OAM-full returns carry after forty entries and never runs the later speed-bar callback', () => {
    const engine = new IntroObjectEngine(tables()), oam = new Uint8Array(160);
    engine.spawn(5, 88, 88); engine.spawn(1, 88, 88); engine.spawn(8, 100, 88); engine.objects[32 + F.fieldB] = 7;
    expect(engine.run(oam, 0)).toBe(true); expect(engine.registers[R.oamOffset]).toBe(160);
    expect(engine.objects[32 + F.x]).toBe(100); expect(engine.objects[32 + F.frameIndex]).toBe(255);
  });
  it('scene seven skips each attribute write but still clears the unused tail', () => {
    const engine = new IntroObjectEngine(tables()), oam = new Uint8Array(160).fill(0xa7); engine.spawn(5, 88, 88);
    engine.run(oam, 7);
    expect(Array.from({ length: 36 }, (_, i) => oam[i * 4 + 3])).toEqual(Array<number>(36).fill(0xa7));
    expect(oam.slice(144).every(n => n === 0)).toBe(true);
  });
  it('remains unused; the only movie-data path is in the unused asset loader', () => {
    const holding: string[] = [];
    const walk = (folder: string): void => {
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        const path = resolve(folder, entry.name);
        if (entry.isDirectory()) { if (entry.name !== 'rom') walk(path); }
        else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') &&
          /IntroObjectEngine|intro_objects|yellow_intro\.json/.test(readFileSync(path, 'utf8'))) holding.push(relative(SRC, path).replace(/\\/g, '/'));
      }
    };
    // 12a owns the unused JSON loader; both unused timing helpers import the field layout and table type.
    walk(SRC); expect(holding.sort()).toEqual(['menus/intro_movie_assets.ts', 'menus/intro_object_cpu_timing.ts', 'menus/intro_object_timing.ts', 'menus/intro_objects.ts']);
  });
});
