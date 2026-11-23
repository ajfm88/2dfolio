import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import type { YellowIntroData } from '../rom/extractors/yellow_intro';
import { IntroCpu } from './intro_cpu';
import { IntroDisplayClock, INTRO_OAM_BYTES } from './intro_display_clock';
import { IntroForegroundRunner, IntroSharedState, introQuietSharedFields } from './intro_foreground_runner';
import { introObjectAnimationSteps } from './intro_movie_timing';
import { introObjectCpuSteps } from './intro_object_cpu_timing';
import { IntroObjectEngine, OBJECT_REGISTER } from './intro_objects';

type Write = [dot: number, workDot: number, offset: number, value: number];
interface NativeCall {
  start: number; end: number; work: number; scene: number; carry: boolean;
  objects: string; registers: string; shadow: string; writes: Write[];
}
interface NativeWindow { calls: NativeCall[]; dmas: [dot: number, source: number, shadow: string][]; end: 'scene2' | 'skip' }
const native: Record<string, NativeWindow> = JSON.parse(readFileSync(resolve(__dirname, '__fixtures__/intro_early_object_reference.json'), 'utf8'));
const tables: YellowIntroData = JSON.parse(readFileSync(resolve(__dirname, '../../data/yellow_intro.json'), 'utf8'));
const bytes = (s: string) => Buffer.from(s, 'hex');

function hardware() {
  const state = new IntroSharedState(introQuietSharedFields());
  const display = new IntroDisplayClock({ scx: 0, wy: 144, wx: 7, lcdc: 0x63, oam: new Uint8Array(INTRO_OAM_BYTES),
    mode0Enabled: false, pending: 0 });
  const cpu = new IntroCpu(display, { ie: 0, ime: false });
  return { state, cpu, audio: { version: 0, forecast: () => 165, update() {} } };
}

function runObject(row: NativeCall) {
  const engine = new IntroObjectEngine(tables);
  engine.objects.set(bytes(row.objects));
  engine.registers.set(bytes(row.registers));
  const h = hardware();
  h.state.shadowOam.set(bytes(row.shadow));
  const cost = introObjectCpuSteps(engine.objects, engine.registers[OBJECT_REGISTER.oamOffset], tables, row.scene);
  let carry: boolean | undefined;
  const runner = new IntroForegroundRunner(h, function* () {
    carry = yield* introObjectAnimationSteps(cost, engine, row.scene);
  });
  runner.runToEnd();
  const stores = runner.events.flatMap(e => e.kind === 'store' ? [[e.dot, Number(e.field.split('.')[1]), e.value]] : []);
  return { stores, work: runner.elapsed, carry, shadow: Buffer.from(h.state.shadowOam).toString('hex') };
}

it.each(Object.entries(native))('publishes every native object byte at its timed offset for %s', (name, window) => {
  const expected = name === 'normal' ? [132, 'scene2', 133] : [18, 'skip', 19];
  expect([window.calls.length, window.end, window.dmas.length]).toEqual(expected);
  const timeline: ([number, 'write', number, number] | [number, 'dma', number, string])[] =
    window.dmas.map(([dot, source, shadow]) => [dot, 'dma', source, shadow]);
  let inside = 0;
  for (const row of window.calls) {
    const run = runObject(row);
    expect([run.work, run.carry]).toEqual([row.work, row.carry]);
    expect(run.stores).toEqual(row.writes.map(([, work, offset, value]) => [work, offset, value]));
    const final = bytes(row.shadow);
    run.stores.forEach(([, offset, value], i) => {
      final[offset] = value;
      // IRQ elapsed time comes from the native ledger here. The isolated run supplies the byte and CPU offset.
      timeline.push([row.writes[i][0], 'write', offset, value]);
    });
    expect(run.shadow).toBe(final.toString('hex'));
    inside += window.dmas.filter(([dot]) => row.start < dot && dot < row.end).length;
  }

  const shadow = bytes(window.calls[0].shadow);
  const first = window.calls[0], firstDma = window.dmas[0][0];
  expect(inside).toBe(1);
  expect(first.writes.filter(([dot]) => dot < firstDma)).toHaveLength(156);
  expect(first.writes.filter(([dot]) => dot > firstDma)).toHaveLength(4);
  for (const event of timeline.sort((a, b) => a[0] - b[0])) {
    if (event[1] === 'write') shadow[event[2]] = event[3];
    else {
      expect(event[2]).toBe(0xc3);
      expect(shadow.toString('hex')).toBe(event[3]);
    }
  }
});

it('keeps the writers scratch bytes private between marked stores', () => {
  const h = hardware();
  h.state.shadowOam.fill(0x55);
  const writer = {
    *runWrites(scratch: Uint8Array) {
      scratch[159] = 0x42;
      yield { offset: 159, value: scratch[159] };
      scratch[158] = 0x43;
      yield { offset: 158, value: scratch[158] };
      return false;
    },
  };
  function* costs() {
    yield { cycles: 2, store: true };
    yield { cycles: 3, store: false };
    yield { cycles: 2, store: true };
    return false;
  }
  const runner = new IntroForegroundRunner(h, function* () {
    yield* introObjectAnimationSteps(costs(), writer, 1);
  });
  expect([...h.state.shadowOam.slice(158)]).toEqual([0x55, 0x55]);
  runner.run(2);
  expect([...h.state.shadowOam.slice(158)]).toEqual([0x55, 0x42]);
  runner.runToEnd();
  expect([...h.state.shadowOam.slice(158)]).toEqual([0x43, 0x42]);
});
