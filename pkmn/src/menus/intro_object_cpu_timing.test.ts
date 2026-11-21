// Checkpoint-12b2b: every instruction boundary and store marker checked against native execution.
import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { IntroObjectEngine, OBJECT_REGISTER as R, type IntroObjectTables } from './intro_objects';
import { introObjectWriteTimes } from './intro_object_timing';
import { introObjectCpuSteps } from './intro_object_cpu_timing';
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

interface CpuExpected extends Expected {
  instructions: number; instructionDigest: string; calls: [number, number, boolean][];
  instructionSample: [number, boolean][]; boundaries: [number, number, number][];
}
const cpuNative: { cases: CpuExpected[] } = JSON.parse(readFileSync(
  resolve(__dirname, '__fixtures__/intro_object_cpu_timing_oracle.json'), 'utf8'));

function execute(input: Inputs) {
  const bound = tables(input), engine = new IntroObjectEngine(bound), oam = new Uint8Array(160);
  const instructionHash = createHash('sha256'), writes = createHash('sha256'), completion = createHash('sha256');
  let instructions = 0, events = 0, valid = true;
  const calls: [number, number, boolean][] = [], sample: [number, boolean][] = [];
  for (const op of input.ops) {
    if (op.op !== 'run') { completion.update(JSON.stringify(state(engine, oam, setup(engine, oam, op)))); continue; }
    for (let i = 0; i < op.repeat; i++) {
      if (op.reset) engine.registers[R.oamOffset] = 0;
      const program = introObjectCpuSteps(engine.objects, engine.registers[R.oamOffset], bound, op.scene);
      const timing = introObjectWriteTimes(engine.objects, engine.registers[R.oamOffset], bound, op.scene);
      let step = program.next(), time = timing.next(); // both snapshot before the writer
      const writer = engine.runWrites(oam, op.scene);
      let cycles = 0; const startCount = instructions;
      while (!step.done) {
        const {cycles: cost, store} = step.value;
        valid &&= Number.isInteger(cost) && cost >= 1 && cost <= 6;
        instructions++; cycles += cost;
        instructionHash.update(Buffer.from([cost | (store ? 128 : 0)]));
        if (sample.length < 12) sample.push([cost, store]);
        if (store) {
          const written = writer.next();
          valid &&= !written.done && !time.done && time.value === cycles;
          if (!written.done) { writes.update(JSON.stringify([cycles, written.value.offset, written.value.value])); events++; }
          time = timing.next();
        }
        step = program.next();
      }
      const result = writer.next();
      valid &&= !!result.done && time.done === true && result.value === step.value;
      if (time.done) valid &&= time.value.cycles === cycles && time.value.full === step.value;
      calls.push([instructions - startCount, cycles, step.value]);
      completion.update(JSON.stringify(state(engine, oam, step.value)));
    }
  }
  return { instructions, instructionDigest: instructionHash.digest('hex'), calls, instructionSample: sample,
    events, writes: writes.digest('hex'), completion: completion.digest('hex'), valid };
}
for (const input of [...old.cases, native.kick]) {
  it(`matches every native instruction and completed store: ${input.name}`, () => {
    const expected = cpuNative.cases.find(row => row.name === input.name)!;
    const result = execute(input);
    expect(result.valid).toBe(true);
    expect(result).toEqual({ instructions: expected.instructions, instructionDigest: expected.instructionDigest,
      calls: expected.calls, instructionSample: expected.instructionSample, events: expected.events,
      writes: expected.writes, completion: expected.completion, valid: true });
  });
}
function kick() {
  const bound = tables(), screen = new OpeningScreen(), engine = new IntroObjectEngine(bound);
  for (const op of native.kick.ops) if (op.op !== 'run') setup(engine, screen.oam, op);
  return {bound, screen, engine};
}
const kickExpected = cpuNative.cases.find(row => row.name === native.kick.name)!;
for (const [request, expectedWork, expectedStores] of kickExpected.boundaries) {
  it(`completes the current instruction before interruption requested at CPU work ${request}`, () => {
    const {bound, screen, engine} = kick();
    const before = state(engine, screen.oam, null), tableBytes = JSON.stringify(bound);
    const program = introObjectCpuSteps(engine.objects, 0, bound, 3);
    let step = program.next(), work = 0, stores = 0;
    const writer = engine.runWrites(screen.oam, 3);
    while (!step.done && work < request) {
      work += step.value.cycles;
      if (step.value.store) { expect(writer.next().done).toBe(false); stores++; }
      step = program.next();
    }
    expect([request, work, stores]).toEqual([request, expectedWork, expectedStores]);
    if (stores === 111) expect(state(engine, screen.oam, null)).toEqual(native.cases[native.cases.length - 1].partial);
    screen.vblank(); const shown = screen.shownOam;
    while (!step.done) {
      if (step.value.store) writer.next();
      step = program.next();
    }
    const final = writer.next(); expect(final.done).toBe(true);
    expect(state(engine, screen.oam, final.value as boolean)).toEqual(native.cases[native.cases.length - 1].finished);
    expect(screen.shownOam).toEqual(shown);
    expect(JSON.stringify(bound)).toBe(tableBytes);
    expect(before).not.toEqual(state(engine, screen.oam, null));
  });
}
it('is lazy, pure and snapshots object inputs on the first resume', () => {
  const bound = tables(), engine = new IntroObjectEngine(bound), oam = new Uint8Array(160).fill(0xa5);
  const program = introObjectCpuSteps(engine.objects, 0, bound, 0);
  engine.spawn(1, 88, 88); // construction has not snapshotted yet
  const before = state(engine, oam, null), tableBytes = JSON.stringify(bound);
  const first = program.next(); expect(first).toEqual({done:false, value:{cycles:3, store:false}});
  const expected = [...introObjectCpuSteps(engine.objects, 0, bound, 0)];
  engine.objects.fill(0); // the primed lookahead retains its own input snapshot
  const changed = state(engine, oam, null);
  expect([first.value, ...program]).toEqual(expected);
  expect(state(engine, oam, null)).toEqual(changed);
  expect(changed).not.toEqual(before); expect(JSON.stringify(bound)).toBe(tableBytes);
});
it('empty traversal exposes instructions and its first store completes at 169 machine cycles', () => {
  const bound = tables(), engine = new IntroObjectEngine(bound);
  const program = introObjectCpuSteps(engine.objects, 0, bound, 0);
  let work = 0, step = program.next(); const stores: number[] = [];
  while (!step.done) { work += step.value.cycles; if (step.value.store) stores.push(work); step = program.next(); }
  expect(stores.slice(0, 2)).toEqual([169, 180]); expect(stores).toHaveLength(160);
  expect([work, step.value]).toEqual([1931, false]);
});
it('a cursor at the OAM end still exposes all 171 cycles including final RET', () => {
  const bound = tables(), program = introObjectCpuSteps(new Uint8Array(160), 160, bound, 0);
  const stream = []; let work = 0, step = program.next();
  while (!step.done) { stream.push(step.value); work += step.value.cycles; step = program.next(); }
  expect(stream.some(row => row.store)).toBe(false); expect(work).toBe(171);
  expect(stream[stream.length - 1]).toEqual({cycles:4, store:false}); expect(step.value).toBe(false);
});

it('has no production caller or instruction-stream import outside its own module', () => {
  const root = resolve(__dirname, '..'), owners: string[] = [];
  function walk(folder: string): void {
    for (const entry of readdirSync(folder, {withFileTypes:true})) {
      const path = resolve(folder, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') &&
        /introObjectCpuSteps|intro_object_cpu_timing/.test(readFileSync(path, 'utf8')))
        owners.push(relative(root, path).replace(/\\/g, '/'));
    }
  }
  walk(root); expect(owners).toEqual(['menus/intro_object_cpu_timing.ts']);
});
