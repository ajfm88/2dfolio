// Checkpoint-12b1: every intermediate OAM store and semantic byte checked against native cartridge code.
import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { IntroObjectEngine, OBJECT_FIELD as F, OBJECT_REGISTER as R, type IntroObjectTables } from './intro_objects';
import { OpeningScreen } from './opening_screen';
import type { YellowIntroData } from '../rom/extractors/yellow_intro';

const data: YellowIntroData = JSON.parse(readFileSync(resolve(__dirname, '../../data/yellow_intro.json'), 'utf8'));
type Operation =
  | { op: 'spawn'; id: number; x: number; y: number }
  | { op: 'run'; repeat: number; scene: number; reset: boolean }
  | { op: 'mask'; slot: number } | { op: 'maskAll' | 'clear' }
  | { op: 'setFrameset'; slot: number; id: number }
  | { op: 'object'; slot: number; bytes: [number, number][] }
  | { op: 'registers'; bytes: [number, number][] } | { op: 'oam'; value: number };
interface Inputs {
  name: string; ops: Operation[];
  tables?: { spawnStates?: Record<string, [number, number, number]>; framesets?: Record<string, number[]>;
    oamSets?: Record<string, { tileOffset: number; entries: [number, number, number, number][] }> };
}
type State = [number | boolean | null, string, string, string];
interface Expected { name: string; events: number; writes: string; completion: string; partial?: State; finished?: State }
const old: { cases: Inputs[] } = JSON.parse(readFileSync(resolve(__dirname, '__fixtures__/intro_objects_oracle.json'), 'utf8'));
const native: { cases: Expected[]; kick: Inputs & { cut: number; movieOam: string } } =
  JSON.parse(readFileSync(resolve(__dirname, '__fixtures__/intro_object_writes_oracle.json'), 'utf8'));
const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');
const state = (engine: IntroObjectEngine, oam: Uint8Array, result: number | boolean | null): State =>
  [result, hex(engine.objects), hex(engine.registers), hex(oam)];
function tables(input?: Inputs): IntroObjectTables {
  const copy = structuredClone(data);
  for (const [id, row] of Object.entries(input?.tables?.spawnStates ?? {})) copy.spawnStates[Number(id)] = row;
  for (const [id, row] of Object.entries(input?.tables?.framesets ?? {})) copy.framesets[Number(id)] = row;
  for (const [id, row] of Object.entries(input?.tables?.oamSets ?? {})) copy.oamSets[Number(id)] = row;
  return copy;
}
function setup(engine: IntroObjectEngine, oam: Uint8Array, op: Exclude<Operation, { op: 'run' }>): number | null {
  switch (op.op) {
    case 'spawn': return engine.spawn(op.id, op.x, op.y);
    case 'mask': engine.mask(op.slot); break;
    case 'maskAll': engine.maskAll(); break;
    case 'clear': engine.clear(); break;
    case 'setFrameset': engine.setFrameset(op.slot, op.id); break;
    case 'object': for (const [field, value] of op.bytes) engine.objects[op.slot * 16 + field] = value; break;
    case 'registers': for (const [field, value] of op.bytes) engine.registers[field] = value; break;
    case 'oam': oam.fill(op.value); break;
  }
  return null;
}
function execute(input: Inputs): Expected {
  const engine = new IntroObjectEngine(tables(input)), oam = new Uint8Array(160);
  const writes = createHash('sha256'), completion = createHash('sha256');
  let events = 0;
  for (const op of input.ops) {
    if (op.op !== 'run') { completion.update(JSON.stringify(state(engine, oam, setup(engine, oam, op)))); continue; }
    for (let i = 0; i < op.repeat; i++) {
      if (op.reset) engine.registers[R.oamOffset] = 0;
      const program = engine.runWrites(oam, op.scene);
      let step = program.next();
      while (!step.done) {
        const { offset, value } = step.value;
        writes.update(JSON.stringify([offset, value, ...state(engine, oam, null).slice(1)])); events++;
        step = program.next();
      }
      completion.update(JSON.stringify(state(engine, oam, step.value)));
    }
  }
  return { name: input.name, events, writes: writes.digest('hex'), completion: completion.digest('hex') };
}
for (const input of [...old.cases, native.kick]) {
  it(`native write stream: ${input.name}`, () => {
    const expected = native.cases.find(row => row.name === input.name)!;
    const { name, events, writes, completion } = expected;
    expect(execute(input)).toEqual({ name, events, writes, completion });
  });
}
function kick(oam = new Uint8Array(160)): IntroObjectEngine {
  const engine = new IntroObjectEngine(tables());
  for (const op of native.kick.ops) if (op.op !== 'run') setup(engine, oam, op);
  return engine;
}
function drain(program: ReturnType<IntroObjectEngine['runWrites']>): boolean {
  let step = program.next(); while (!step.done) step = program.next(); return step.value;
}

it('iterator construction is lazy; each resume exposes exactly one completed store and no later bytes', () => {
  const engine = new IntroObjectEngine(tables()), oam = new Uint8Array(160).fill(0xa5);
  engine.spawn(1, 88, 88);
  const before = state(engine, oam, null), program = engine.runWrites(oam, 0);
  expect(state(engine, oam, null)).toEqual(before);
  expect(program.next()).toEqual({ done: false, value: { offset: 0, value: 80 } });
  expect(oam[0]).toBe(80);
  expect(oam.slice(1).every(n => n === 0xa5)).toBe(true); expect(engine.registers[R.oamOffset]).toBe(0);
  expect(program.next()).toEqual({ done: false, value: { offset: 1, value: 80 } });
  expect(oam.slice(2).every(n => n === 0xa5)).toBe(true); expect(engine.objects[F.duration]).toBe(4);
});
it('111 writes reproduce the real movie partial OAM; DMA retains that prefix until the next VBlank', () => {
  const screen = new OpeningScreen(), engine = kick(screen.oam), program = engine.runWrites(screen.oam, 3);
  const expected = native.cases.find(row => row.name === native.kick.name)!;
  for (let i = 0; i < native.kick.cut; i++) expect(program.next().done).toBe(false);
  expect(state(engine, screen.oam, null)).toEqual(expected.partial);
  expect(hex(screen.oam)).toBe(native.kick.movieOam);
  expect(engine.registers[R.oamOffset]).toBe(108); // final seventh-bar attribute store is still pending
  screen.vblank(); expect(hex(screen.shownOam)).toBe(native.kick.movieOam);
  const result = drain(program);
  expect(state(engine, screen.oam, result)).toEqual(expected.finished);
  expect(hex(screen.shownOam)).toBe(native.kick.movieOam);
  expect(hex(screen.oam)).not.toBe(native.kick.movieOam);
  screen.vblank(); expect(screen.shownOam).toEqual(screen.oam);
});
it('tail zeroing is itself resumable, preserving its prefix and every later unwritten byte', () => {
  const engine = new IntroObjectEngine(tables()), oam = new Uint8Array(160).fill(0xa5);
  engine.registers[R.oamOffset] = 12;
  const program = engine.runWrites(oam, 0);
  expect(program.next()).toEqual({ done: false, value: { offset: 12, value: 0 } });
  expect(Array.from(oam.slice(0, 12))).toEqual(Array<number>(12).fill(0xa5));
  expect(oam.slice(13).every(n => n === 0xa5)).toBe(true);
  expect(drain(program)).toBe(false); expect(oam.slice(12).every(n => n === 0)).toBe(true);
  expect(engine.registers[R.oamOffset]).toBe(12);
});
it('scene seven yields only actual stores, leaves attributes alone and still emits the zero-tail stores', () => {
  const engine = new IntroObjectEngine(tables()), oam = new Uint8Array(160).fill(0xa7); engine.spawn(5, 88, 88);
  const writes = [...engine.runWrites(oam, 7)];
  expect(writes.map(w => w.offset)).toEqual([
    ...Array.from({ length: 36 }, (_, i) => [i * 4, i * 4 + 1, i * 4 + 2]).flat(),
    ...Array.from({ length: 16 }, (_, i) => i + 144),
  ]);
  expect(Array.from({ length: 36 }, (_, i) => oam[i * 4 + 3])).toEqual(Array<number>(36).fill(0xa7));
});
it('OAM-full carry completes after the last yielded store; later callbacks stay unrun', () => {
  const engine = new IntroObjectEngine(tables()), oam = new Uint8Array(160);
  engine.spawn(5, 88, 88); engine.spawn(1, 88, 88); engine.spawn(8, 100, 88); engine.objects[32 + F.fieldB] = 7;
  const program = engine.runWrites(oam, 0);
  for (let i = 0; i < 160; i++) expect(program.next().done).toBe(false);
  expect(engine.registers[R.oamOffset]).toBe(156); expect(engine.objects[32 + F.x]).toBe(100);
  expect(program.next()).toEqual({ done: true, value: true });
  expect(engine.registers[R.oamOffset]).toBe(160); expect(engine.objects[32 + F.frameIndex]).toBe(255);
});
it('resuming does not re-run a callback or advance duration a second time', () => {
  const engine = new IntroObjectEngine(tables()), oam = new Uint8Array(160); engine.spawn(8, 100, 88); engine.objects[F.fieldB] = 7;
  const program = engine.runWrites(oam, 0); program.next();
  expect([engine.objects[F.x], engine.objects[F.duration]]).toEqual([107, 32]);
  for (let i = 0; i < 100; i++) program.next();
  expect([engine.objects[F.x], engine.objects[F.duration]]).toEqual([107, 32]);
  expect(drain(program)).toBe(false);
  expect([engine.objects[F.x], engine.objects[F.duration]]).toEqual([107, 32]);
});
it('the complete-update compatibility API retains the same native final state and carry', () => {
  const oam = new Uint8Array(160), engine = kick(oam);
  const result = engine.run(oam, 3);
  expect(state(engine, oam, result)).toEqual(native.cases.find(row => row.name === native.kick.name)!.finished);
});
