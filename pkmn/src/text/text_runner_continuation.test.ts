import { beforeAll, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: () => true }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(),
  loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TextScreen, TEXT_B } from './text_printer';
import { TextProgramRunner } from './text_runner';
import type { TextAsmContinuation, TextAsmState, TextBindings, TextReturn } from './text_runner';
import type { TextPrograms, TextProgramsFile } from '../rom/extractors/text_programs';
import { TextBox, initTextSystem } from './textbox';
import { loadTextPrograms } from './program_data';
import { rig as audioRig, sfxData } from '../test/audio_rig';
import { BattleAudio } from '../battle/battle_audio';
import { setLowHealthAlarm, setLowHealthChannel5 } from '../audio/low_health_alarm';

const file = JSON.parse(readFileSync(resolve(__dirname, '../../data/text_programs.json'), 'utf8')) as TextProgramsFile;
beforeAll(async () => { await initTextSystem(); await loadTextPrograms(); });
beforeEach(() => { setLowHealthAlarm(0); setLowHealthChannel5(0); });

function rig(programs: TextPrograms = file.programs) {
  const input = { down: 0 };
  const ports = { buttons: () => input.down, speed: () => 1, soundFinished: () => true,
    joypadRead: vi.fn(), beep: vi.fn(), playSound: vi.fn(), cry: vi.fn() };
  const screen = new TextScreen(ports);
  const runner = new TextProgramRunner(screen, programs, ports);
  const row = (n = 2) => screen.buffer.slice(n * 20 + 1, n * 20 + 19).join('').trimEnd();
  return { input, ports, screen, runner, row };
}

describe('optional per-print text_asm continuations', () => {
  it('suspends once per yield and redirects on the same screen, preserving BC and bindings without new reads', () => {
    const r = rig({ P: [{ op: 'text', text: 'A' }, { op: 'asm' }, { op: 'text', text: 'WRONG' }],
      C: [{ op: 'ram', binding: 'stringBuffer' }] });
    const seen: TextAsmState[] = []; const events: number[] = [];
    const continuation: TextAsmContinuation = function* (state) {
      seen.push(state); events.push(0); yield; events.push(1); yield; events.push(2); yield; return 'C';
    };
    const run = r.runner.run('P', { stringBuffer: 'B' }, true, { P: continuation });
    for (let i = 0; i < 3; i++) {
      expect(run.next()).toEqual({ done: false, value: undefined });
      expect(r.row()).toBe('A'); expect(r.screen.bc()).toEqual({ column: 2, row: 14 });
      expect(events).toEqual([0, 1, 2].slice(0, i + 1));
    }
    expect(run.next()).toEqual({ done: true, value: 'returned' });
    expect(r.row()).toBe('AB'); expect(seen).toEqual([{ label: 'P', column: 2, row: 14 }]);
    expect(r.ports.joypadRead).not.toHaveBeenCalled();
  });

  it('continues after asm when the yielding handler returns void', () => {
    const r = rig({ P: [{ op: 'text', text: 'A' }, { op: 'asm' }, { op: 'text', text: 'B' }] });
    const run = r.runner.run('P', {}, true, { P: function* () { yield; } });
    expect(run.next().done).toBe(false); expect(r.row()).toBe('A');
    expect(run.next()).toEqual({ done: true, value: 'returned' }); expect(r.row()).toBe('AB');
  });

  it('threads continuations through FAR calls and redirects, then resumes only the parent FAR caller', () => {
    const r = rig({ Root: [{ op: 'text', text: 'A' }, { op: 'far', program: 'Child' }, { op: 'text', text: 'Z' }],
      Child: [{ op: 'asm' }, { op: 'text', text: 'WRONG' }], Redirect: [{ op: 'asm' }],
      Last: [{ op: 'text', text: 'B' }] });
    const seen: string[] = [];
    const continuations = {
      Child: function* () { seen.push('Child'); yield; return 'Redirect'; },
      Redirect: function* () { seen.push('Redirect'); yield; return 'Last'; },
    };
    const run = r.runner.run('Root', {}, true, continuations);
    expect(run.next().done).toBe(false); expect(run.next().done).toBe(false);
    expect(run.next()).toEqual({ done: true, value: 'returned' });
    expect(seen).toEqual(['Child', 'Redirect']); expect(r.row()).toBe('ABZ');
  });

  it('does not leak a per-print override into later prints or the synchronous registry', () => {
    const r = rig({ P: [{ op: 'asm' }], Sync: [{ op: 'text', text: 'S' }], Async: [{ op: 'text', text: 'Y' }] });
    const sync = vi.fn(() => 'Sync'); r.runner.registerAsm('P', sync);
    const run = r.runner.run('P', {}, true, { P: function* () { yield; return 'Async'; } });
    expect(run.next().done).toBe(false); expect(run.next().done).toBe(true); expect(r.row()).toBe('Y');
    expect(sync).not.toHaveBeenCalled();
    r.screen.resetCursor(); expect(r.runner.run('P', {}, true).next().done).toBe(true);
    expect(sync).toHaveBeenCalledOnce(); expect(r.row()).toBe('S');
  });

  it('retains separate continuation instances for interleaved prints on the same runner', () => {
    const r = rig({ P: [{ op: 'asm' }] }); const events: string[] = [];
    const make = (name: string): TextAsmContinuation => function* () { events.push(name); yield; events.push(`${name}:return`); };
    const a = r.runner.run('P', {}, true, { P: make('a') });
    const b = r.runner.run('P', {}, true, { P: make('b') });
    expect(a.next().done).toBe(false); expect(b.next().done).toBe(false);
    expect(a.next().done).toBe(true); expect(b.next().done).toBe(true);
    expect(events).toEqual(['a', 'b', 'a:return', 'b:return']);
    expect(r.runner.run('P', {}, true).next()).toEqual({ done: true, value: 'asm' });
  });

  it('leaves unregistered asm exits intact after a yielding redirect', () => {
    const r = rig({ P: [{ op: 'asm' }], Unregistered: [{ op: 'asm' }] });
    const run = r.runner.run('P', {}, true, { P: function* () { yield; return 'Unregistered'; } });
    expect(run.next().done).toBe(false); expect(run.next()).toEqual({ done: true, value: 'asm' });
  });

  it('keeps letter delays enabled in a redirected program', () => {
    const r = rig({ P: [{ op: 'asm' }], C: [{ op: 'text', text: 'AB' }] });
    const run = r.runner.run('P', {}, false, { P: function* () { yield; return 'C'; } });
    expect(run.next().done).toBe(false); expect(r.row()).toBe('');
    expect(run.next().done).toBe(false); expect(r.row()).toBe('A');
    expect(run.next().done).toBe(false); expect(r.row()).toBe('AB');
    expect(run.next().done).toBe(true);
  });

  it('continues committed OneTwoAndText through real swap waits to PoofText on the retained cursor', () => {
    const r = rig(); const audio = audioRig(); const bridge = new BattleAudio(audio.sfx, audio.music);
    const state: TextAsmState[] = []; const timeline: unknown[] = [];
    const continuation: TextAsmContinuation = function* (current) {
      state.push(current); timeline.push([audio.synth.update, 'entry', r.screen.bc()]);
      const reads = r.ports.joypadRead.mock.calls.length;
      for (const frame of bridge.playSwap({ id: 0xae, data: sfxData('swap') })) {
        expect(frame).toBe('serviced'); yield;
      }
      expect(r.ports.joypadRead).toHaveBeenCalledTimes(reads);
      timeline.push([audio.synth.update, 'return', r.screen.bc()]); return 'PoofText';
    };
    const run = r.runner.run('OneTwoAndText', { learnMoveMonName: 'PIKACHU', nameBuffer: 'GROWL' }, true,
      { OneTwoAndText: continuation });
    let step = run.next();
    for (let frame = 0; !step.done && frame < 300; frame++) {
      if (frame === 29) bridge.play({ id: 0x90, data: sfxData('press_ab') });
      if (r.screen.waiting) r.input.down = r.input.down ? 0 : TEXT_B;
      audio.update(); step = run.next();
      if (audio.synth.update === 59) {
        expect(r.row()).toBe('1, 2 and... Poof!');
        expect(bridge.audioBank).toBe(8); expect(bridge.savedAudioBank).toBe(8);
      }
    }
    expect(step).toEqual({ done: true, value: 'returned' });
    expect(state).toEqual([{ label: 'OneTwoAndText', column: 12, row: 14 }]);
    expect(timeline).toEqual([[30, 'entry', { column: 12, row: 14 }], [59, 'return', { column: 12, row: 14 }]]);
    expect(audio.synth.values('freq0').slice(-1)).toEqual([[47, 1856]]);
    expect(r.row()).toBe('And...');
  });

  it('passes the per-print continuation through TextBox without reopening PrintText or adding Delay3', () => {
    const sprites = vi.fn(); const box = new TextBox({ closeFrames: () => 7, updateSprites() {}, printTextSprites: sprites });
    const seen: TextAsmState[] = []; let frame = 0; let returnedAt = -1;
    box.printStandalone({ program: 'OneTwoAndText' }, { noDelay: true,
      asmContinuations: { OneTwoAndText: function* (state) { seen.push(state); yield; returnedAt = frame; return '_PoofText'; } } });
    while (!box.isComplete && frame < 50) { frame++; box.update(); }
    expect(frame).toBe(34); expect(returnedAt).toBe(34); expect(sprites).toHaveBeenCalledOnce();
    expect(seen).toEqual([{ label: 'OneTwoAndText', column: 12, row: 14 }]);
    expect(box.saveScreen().buffer.slice(41, 59).join('').trimEnd()).toBe('1, 2 and... Poof!');
    box.printStandalone({ program: 'OneTwoAndText' }, { noDelay: true });
    for (let i = 0; !box.isComplete && i < 50; i++) box.update();
    expect(box.textReturn).toBe('asm'); expect(seen).toHaveLength(1);
  });
});

describe('battle money numeric bindings', () => {
  it('types both new BCD bindings as numeric inputs', () => {
    expectTypeOf<TextBindings['amountMoneyWon']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<TextBindings['totalPayDayMoney']>().toEqualTypeOf<number | undefined>();
  });
  it.each(['amountMoneyWon', 'totalPayDayMoney'] as const)('prints committed %s BCD operands as numbers', binding => {
    const program = binding === 'amountMoneyWon' ? 'MoneyForWinningText' : 'PickUpPayDayMoneyText';
    for (const value of [0, 1, 123456, 999999]) {
      const r = rig(); const bindings: TextBindings = { [binding]: value };
      const run: Generator<void, TextReturn> = r.runner.run(program, bindings, true);
      let step = run.next();
      for (let frame = 0; !step.done && frame < 100; frame++) {
        if (r.screen.waiting) r.input.down = r.input.down ? 0 : TEXT_B;
        step = run.next();
      }
      expect(step.done).toBe(true);
      expect(`${r.row()}${r.row(4)}`).toContain(`¥${value}`);
    }
  });

  it.each(['amountMoneyWon', 'totalPayDayMoney'] as const)('keeps numeric validation for %s', binding => {
    const program = binding === 'amountMoneyWon' ? 'MoneyForWinningText' : 'PickUpPayDayMoneyText';
    expect(() => rig().runner.run(program, {}, true).next()).toThrow(`missing text binding ${binding}`);
    for (const value of [-1, 1.5, 1000000, '123', NaN]) {
      const bindings = { [binding]: value } as unknown as TextBindings;
      expect(() => rig().runner.run(program, bindings, true).next()).toThrow(`invalid numeric text binding ${binding}`);
    }
  });
});
