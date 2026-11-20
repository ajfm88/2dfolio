// Checkpoint-12b2a: completed-store times and return costs checked against native cartridge instructions.
import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { IntroObjectEngine, OBJECT_REGISTER as R, type IntroObjectTables } from './intro_objects';
import { introObjectWriteTimes } from './intro_object_timing';
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
interface Expected {
  name: string; events: number; writes: string; completion: string; totals: [number, boolean][]; sample: number[];
  partial?: State; finished?: State; cutTimes?: number[];
}
const old: { cases: Inputs[] } = JSON.parse(readFileSync(resolve(__dirname, '__fixtures__/intro_objects_oracle.json'), 'utf8'));
const native: { cases: Expected[]; kick: Inputs & { cut: number; movieOam: string } } =
  JSON.parse(readFileSync(resolve(__dirname, '__fixtures__/intro_object_timing_oracle.json'), 'utf8'));
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
  const bound = tables(input), engine = new IntroObjectEngine(bound), oam = new Uint8Array(160);
  const writes = createHash('sha256'), completion = createHash('sha256');
  let events = 0; const totals: [number, boolean][] = [], sample: number[] = [];
  for (const op of input.ops) {
    if (op.op !== 'run') { completion.update(JSON.stringify(state(engine, oam, setup(engine, oam, op)))); continue; }
    for (let i = 0; i < op.repeat; i++) {
      if (op.reset) engine.registers[R.oamOffset] = 0;
      const timing = introObjectWriteTimes(engine.objects, engine.registers[R.oamOffset], bound, op.scene);
      let time = timing.next();
      const program = engine.runWrites(oam, op.scene);
      let step = program.next();
      while (!step.done) {
        const { offset, value } = step.value;
        expect(time.done).toBe(false);
        if (time.done) throw new Error('Early timing completion');
        writes.update(JSON.stringify([time.value, offset, value])); events++;
        if (sample.length < 8) sample.push(time.value);
        step = program.next();
        time = timing.next();
      }
      const end = time; expect(end.done).toBe(true);
      if (!end.done) throw new Error('Extra store time');
      expect(end.value.full).toBe(step.value); totals.push([end.value.cycles, end.value.full]);
      completion.update(JSON.stringify(state(engine, oam, step.value)));
    }
  }
  return { name: input.name, events, totals, sample, writes: writes.digest('hex'), completion: completion.digest('hex') };
}

it('timing lookahead leaves objects, scratch registers, OAM and tables unchanged', () => {
  const bound = tables(), engine = new IntroObjectEngine(bound), oam = new Uint8Array(160).fill(0xa5);
  engine.spawn(1, 88, 88);
  const before = state(engine, oam, null), tableBytes = JSON.stringify(bound);
  const timing = introObjectWriteTimes(engine.objects, 0, bound, 1);
  expect(state(engine, oam, null)).toEqual(before);
  expect(timing.next()).toEqual({done: false, value: 354});
  expect(state(engine, oam, null)).toEqual(before);
  expect([...timing]).toHaveLength(159);
  expect(state(engine, oam, null)).toEqual(before);
  expect(JSON.stringify(bound)).toBe(tableBytes);
});

it('empty traversal still costs time and already-zero tail stores still consume eleven cycles each', () => {
  const engine = new IntroObjectEngine(tables()), timing = introObjectWriteTimes(engine.objects, 0, tables(), 0);
  expect(timing.next()).toEqual({done: false, value: 169});
  expect(timing.next()).toEqual({done: false, value: 180});
  let step = timing.next(); while (!step.done) step = timing.next();
  expect(step.value).toEqual({cycles: 1931, full: false});
});

it('a tail pointer already at the end emits nothing but includes traversal, final test and RET', () => {
  const engine = new IntroObjectEngine(tables());
  expect(introObjectWriteTimes(engine.objects, 160, tables(), 0).next())
    .toEqual({done: true, value: {cycles: 171, full: false}});
});

function kick() {
  const bound = tables(), screen = new OpeningScreen(), engine = new IntroObjectEngine(bound);
  for (const op of native.kick.ops) if (op.op !== 'run') setup(engine, screen.oam, op);
  return {bound, screen, engine};
}

it('kick times strictly increase beyond a byte and the completed call includes work after its last store', () => {
  const {bound, engine} = kick(), timing = introObjectWriteTimes(engine.objects, 0, bound, 3);
  const times: number[] = []; let step = timing.next();
  while (!step.done) { times.push(step.value); step = timing.next(); }
  expect(times).toHaveLength(160);
  expect(times.every((time, i) => time > (times[i - 1] ?? 0))).toBe(true);
  expect(times[times.length - 1]).toBeGreaterThan(0xff);
  const expected = native.cases.find(row => row.name === native.kick.name)!;
  expect([step.value.cycles, step.value.full]).toEqual(expected.totals[0]);
  expect(step.value.cycles).toBeGreaterThan(times[times.length - 1]);
});

// Synthetic CPU-work deadlines, not claimed movie/VBlank times: the owner must account for interrupt work.
for (const boundary of ['before-111', 'at-111', 'before-112', 'at-112'] as const) {
  it(`look ahead before advancing the writer at a native store boundary: ${boundary}`, () => {
    const {bound, screen, engine} = kick(), expected = native.cases.find(row => row.name === native.kick.name)!;
    const [at111, at112] = expected.cutTimes!;
    const deadline = {'before-111':at111 - 1, 'at-111':at111, 'before-112':at112 - 1, 'at-112':at112}[boundary];
    const count = {'before-111':110, 'at-111':111, 'before-112':111, 'at-112':112}[boundary];
    const timing = introObjectWriteTimes(engine.objects, 0, bound, 3), writer = engine.runWrites(screen.oam, 3);
    let next = timing.next(), written = 0;
    while (!next.done && next.value <= deadline) {
      expect(writer.next().done).toBe(false); written++; next = timing.next();
    }
    expect(written).toBe(count);
    if (count === 111) expect(state(engine, screen.oam, null)).toEqual(expected.partial);
    screen.vblank(); const shown = screen.shownOam.slice();
    while (!next.done) { expect(writer.next().done).toBe(false); next = timing.next(); }
    const result = writer.next(); expect(result.done).toBe(true);
    expect(state(engine, screen.oam, result.value as boolean)).toEqual(expected.finished);
    expect(screen.shownOam).toEqual(shown);
    screen.vblank(); expect(screen.shownOam).toEqual(screen.oam);
  });
}
for (const input of [...old.cases, native.kick]) {
  it(`native instruction-end timing: ${input.name}`, () => {
    const expected = native.cases.find(row => row.name === input.name)!;
    const { name, events, writes, completion, totals, sample } = expected;
    const actual = execute(input); expect(actual).toEqual({ name, events, writes, completion, totals, sample });
  });
}
