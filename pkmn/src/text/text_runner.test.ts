import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { TextScreen, TextPrinter, TEXT_A, TEXT_B } from './text_printer';
import { TextProgramRunner } from './text_runner';
import { substituteNames } from '../core/player_state';
import type { TextPrograms, TextProgramsFile, TextOp } from '../rom/extractors/text_programs';

function rig(programs: TextPrograms, down = 0) {
  const input = { down, sound: true };
  const read = vi.fn(), beep = vi.fn(), playSound = vi.fn(), cry = vi.fn();
  const ports = { buttons: () => input.down, speed: () => 1, soundFinished: () => input.sound,
    joypadRead: read, beep, playSound, cry };
  const screen = new TextScreen(ports, down);
  const runner = new TextProgramRunner(screen, programs, ports);
  const row = () => screen.buffer.slice(41, 59).join('').trimEnd();
  return { input, read, beep, playSound, cry, ports, screen, runner, row };
}

describe('TextCommandProcessor source contracts (A5b4)', () => {
  it.each(['<DONE>', '<PROMPT>'])('FAR resumes its parent after child %s, with the same cursor', end => {
    const r = rig({ P: [{ op: 'text', text: 'A' }, { op: 'far', program: 'C' }, { op: 'text', text: 'D' }],
      C: [{ op: 'text', text: `B${end}` }, { op: 'text', text: 'WRONG' }] });
    const run = r.runner.run('P', {}, true);
    if (end === '<PROMPT>') {
      expect(run.next().done).toBe(false);
      expect(r.screen.buffer[98]).toBe('▼');
      expect(r.read).not.toHaveBeenCalled();
      run.next(); run.next(); r.input.down = TEXT_B;
    }
    expect(run.next()).toEqual({ done: true, value: 'returned' });
    expect(r.row()).toBe('ABD');
  });

  it('ram continues the current cursor, including player-name substitution', () => {
    const r = rig({ P: [{ op: 'text', text: 'A' }, { op: 'ram', binding: 'nameBuffer' }, { op: 'text', text: 'B' }] });
    expect(r.runner.run('P', { nameBuffer: '<PLAYER>' }, true).next().done).toBe(true);
    expect(r.row()).toBe(substituteNames('A<PLAYER>B'));
  });

  it('missing RAM bindings and program labels fail explicitly', () => {
    const r = rig({ P: [{ op: 'ram', binding: 'stringBuffer' }] });
    expect(() => r.runner.run('P').next()).toThrow('missing text binding stringBuffer in P');
    expect(() => r.runner.run('missing').next()).toThrow('missing text program missing');
  });

  it('sound plays once, owns no Joypad reads, and returns on the sound-finished frame', () => {
    const r = rig({ P: [{ op: 'sound', sound: 'get_key_item' }, { op: 'text', text: 'A' }] });
    r.input.sound = false;
    const run = r.runner.run('P', {}, true);
    run.next(); r.input.down = TEXT_A; run.next(); r.input.down = 0; run.next();
    expect(r.playSound).toHaveBeenCalledExactlyOnceWith('get_key_item');
    expect(r.read).not.toHaveBeenCalled(); expect(r.row()).toBe('');
    r.input.sound = true;
    expect(run.next().done).toBe(true); expect(r.row()).toBe('A');
  });

  it.each(['promptButton', 'waitButton'] as const)('%s has no ProtectedDelay3; both wait for sound and beep', op => {
    const r = rig({ P: [{ op }, { op: 'text', text: 'A' }] });
    const run = r.runner.run('P', {}, true);
    run.next(); expect(r.read).toHaveBeenCalledTimes(1);
    expect(r.screen.buffer[98]).toBe(op === 'promptButton' ? '▼' : ' ');
    r.input.down = TEXT_B; r.input.sound = false; run.next();
    const reads = r.read.mock.calls.length;
    r.input.down = 0; run.next(); expect(r.read).toHaveBeenCalledTimes(reads);
    r.input.sound = true; expect(run.next().done).toBe(true);
    expect(r.beep).toHaveBeenCalledTimes(1); expect(r.screen.buffer[98]).toBe(' ');
  });

  it.each(['promptButton', 'waitButton'] as const)('%s and tile (18,16): only the arrow form overwrites it (A5b4 N-1)', op => {
    const r = rig({ P: [{ op }] });
    r.screen.buffer[98] = 'X'; // a glyph in the last column of the second line
    const run = r.runner.run('P', {}, true);
    expect(run.next().done).toBe(false); // waiting for a fresh A/B
    r.input.down = TEXT_A;
    expect(run.next().done).toBe(true); expect(r.beep).toHaveBeenCalledOnce();
    expect(r.screen.buffer[98]).toBe(op === 'promptButton' ? ' ' : 'X');
  });

  it('pause reads once, waits exactly 30 frames without reads, then continues', () => {
    const r = rig({ P: [{ op: 'pause' }, { op: 'text', text: 'A' }] });
    const run = r.runner.run('P', {}, true);
    for (let frame = 0; frame < 30; frame++) expect(run.next().done).toBe(false);
    expect(r.row()).toBe(''); expect(r.read).toHaveBeenCalledTimes(1);
    expect(run.next().done).toBe(true); expect(r.row()).toBe('A');
  });

  it.each([TEXT_A, TEXT_B])('held input %i skips pause after one read', down => {
    const r = rig({ P: [{ op: 'pause' }, { op: 'text', text: 'A' }] }, down);
    expect(r.runner.run('P', {}, true).next().done).toBe(true);
    expect(r.read).toHaveBeenCalledTimes(1); expect(r.row()).toBe('A');
  });

  it('cry emits a declared cue without frames or playback; asm reports its handoff', () => {
    const r = rig({ P: [{ op: 'cry', species: 'PIKACHU' }, { op: 'asm' }, { op: 'text', text: 'WRONG' }] });
    expect(r.runner.run('P').next()).toEqual({ done: true, value: 'asm' });
    expect(r.cry).toHaveBeenCalledExactlyOnceWith('PIKACHU');
    expect(r.playSound).not.toHaveBeenCalled(); expect(r.row()).toBe('');
  });

  it.each<TextOp>([
    { op: 'bcd', binding: 'money', bytes: 3, leadingZeroes: false, leftAlign: false, moneySign: true },
    { op: 'decimal', binding: 'hpDifference', bytes: 2, digits: 3 },
    { op: 'move', row: 1, col: 1 }, { op: 'box', row: 1, col: 1, width: 1, height: 1 },
    { op: 'low' }, { op: 'scroll' }, { op: 'dots', count: 1 },
  ])('unsupported $op fails with its program label and audit home', op => {
    const r = rig({ P: [op] });
    expect(() => r.runner.run('P').next()).toThrow(`unsupported text op ${op.op} (A5b7) in P`);
  });

  it('no-delay mode writes all glyphs at once and does not call PrintLetterDelay/Joypad', () => {
    const r = rig({ P: [{ op: 'text', text: "AB'd" }] });
    expect(r.runner.run('P', {}, true).next().done).toBe(true);
    expect(r.row()).toBe("AB'd"); expect(r.read).not.toHaveBeenCalled();
  });
});

const file = JSON.parse(readFileSync(resolve(__dirname, '../../data/text_programs.json'), 'utf8')) as TextProgramsFile;

describe('committed program contracts (A5b4)', () => {
  it('pins the exact op census; numeric ops alone are deferred among extracted programs', () => {
    const kinds = [...new Set(Object.values(file.programs).flat().map(op => op.op))].sort();
    expect(kinds).toEqual(['asm', 'bcd', 'cry', 'decimal', 'far', 'pause', 'promptButton', 'ram', 'sound', 'text', 'waitButton']);
  });

  it('all binding-free plain NPC/sign programs match flattened string buffers and frame counts', () => {
    function flatten(label: string): string | null {
      let text = '';
      for (const op of file.programs[label]) {
        if (op.op === 'sound') continue; // immediate mocked completion, no frames
        if (op.op === 'far') {
          const child = flatten(op.program);
          if (child === null) return null;
          text += child.replace(/<DONE>$/, '');
        } else if (op.op === 'text') {
          text += op.text;
          if (/<(?:DONE|PROMPT)>$/.test(op.text)) break;
        } else return null; // binding/handler programs are outside this equivalence surface
      }
      return substituteNames(text);
    }
    let checked = 0;
    for (const call of Object.values(file.textPointers).flat()) {
      if (call.call !== 'text' && call.call !== 'printText') continue;
      const text = flatten(call.program);
      if (text === null) continue;
      const a = rig(file.programs), b = rig({});
      const run = a.runner.run(call.program);
      let current = run.next();
      const old = new TextPrinter(text, b.ports);
      let frame = 0;
      while ((!current.done || !old.complete) && frame < 5000) {
        frame++;
        a.input.down = b.input.down = frame % 16 < 8 ? TEXT_B : 0;
        current = run.next(); old.advance();
        expect(a.screen.buffer, `${call.program} at ${frame}`).toEqual(old.buffer);
        expect(current.done, `${call.program} at ${frame}`).toBe(old.complete);
      }
      expect(current.done, call.program).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(60);
  });
});
