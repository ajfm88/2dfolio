import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { TextScreen, TEXT_A, TEXT_B } from './text_printer';
import { TextProgramRunner } from './text_runner';
import type { TextBindings } from './text_runner';
import type { TextOp, TextPrograms, TextProgramsFile } from '../rom/extractors/text_programs';

const file = JSON.parse(readFileSync(resolve(__dirname, '../../data/text_programs.json'), 'utf8')) as TextProgramsFile;
const bcd = (flags: Partial<Extract<TextOp, { op: 'bcd' }>> = {}): TextOp => ({
  op: 'bcd', binding: 'money', bytes: 2, leadingZeroes: true, leftAlign: true, moneySign: false, ...flags,
});
function rig(programs: TextPrograms, speed = 3, down = 0) {
  const input = { down };
  const read = vi.fn();
  const ports = { buttons: () => input.down, speed: () => speed, soundFinished: () => true,
    joypadRead: read, beep: vi.fn(), playSound: vi.fn(), cry: vi.fn() };
  const screen = new TextScreen(ports, down);
  const runner = new TextProgramRunner(screen, programs, ports);
  const row = (n = 2) => screen.buffer.slice(n * 20 + 1, n * 20 + 19).join('');
  return { input, read, screen, runner, row, ports };
}

describe('PrintBCDNumber flags and cursor (home/print_bcd.asm)', () => {
  // Expected tiles are specified independently, including untouched cells (.).
  it.each([
    [false, false, false, '0012!', '0000!'],
    [false, false, true, '¥0012!', '¥0000!'],
    [false, true, false, '0012!', '0000!'],
    [false, true, true, '¥0012!', '¥0000!'],
    [true, false, false, '..12!', '...0!'],
    [true, false, true, '..¥12!', '...¥0!'],
    [true, true, false, '12!', '0!'],
    [true, true, true, '¥12!', '¥0!'],
  ] as const)('flags suppress=%s left=%s money=%s preserve skipped cells', (leadingZeroes, leftAlign, moneySign, nonzero, zero) => {
    for (const [money, expected] of [[12, nonzero], [0, zero]] as const) {
      const r = rig({ P: [bcd({ leadingZeroes, leftAlign, moneySign }), { op: 'text', text: '!' }] });
      r.screen.buffer.fill('.');
      expect(r.runner.run('P', { money }, true).next().done).toBe(true);
      expect(r.row()).toBe(expected.padEnd(18, '.'));
      expect(r.read).not.toHaveBeenCalled();
    }
  });

  it.each([0, 1, 10, 100, 999999])('prints the decimal value %i from a three-byte BCD operand', money => {
    const r = rig({ P: [bcd({ bytes: 3 })] });
    expect(r.runner.run('P', { money }, true).next().done).toBe(true);
    expect(r.row().trimEnd()).toBe(String(money));
  });

  it.each([0, TEXT_A, TEXT_B])('digits alone own letter delays; held=%i', held => {
    const r = rig({ P: [bcd({ leadingZeroes: true, leftAlign: false, moneySign: true })] }, 3, held);
    const run = r.runner.run('P', { money: 12 });
    const perDigit = held ? 1 : 3;
    expect(run.next().done).toBe(false);
    expect(r.row()).toBe('  ¥1'.padEnd(18)); // ¥ and skipped cells have no delays or reads
    expect(r.read).toHaveBeenCalledTimes(1);
    for (let frame = 1; frame < perDigit; frame++) {
      expect(run.next().done).toBe(false);
      expect(r.row()).toBe('  ¥1'.padEnd(18));
    }
    expect(run.next().done).toBe(false);
    expect(r.row()).toBe('  ¥12'.padEnd(18));
    for (let frame = 1; frame < perDigit; frame++) expect(run.next().done).toBe(false);
    expect(run.next()).toEqual({ done: true, value: 'returned' });
    expect(r.read).toHaveBeenCalledTimes(held ? 2 : 8);
  });

  it('the all-zero right-aligned fallback delays only its final digit', () => {
    const r = rig({ P: [bcd({ leftAlign: false, moneySign: true })] });
    const run = r.runner.run('P', { money: 0 });
    expect(run.next().done).toBe(false);
    expect(r.row()).toBe('   ¥0'.padEnd(18));
    expect(r.read).toHaveBeenCalledTimes(1);
    run.next(); run.next();
    expect(run.next().done).toBe(true);
    expect(r.read).toHaveBeenCalledTimes(4);
  });

  it('no-delay numeric output has no reads, while the following pause still owns its 30 frames', () => {
    const r = rig({ P: [bcd(), { op: 'pause' }] });
    const run = r.runner.run('P', { money: 10 }, true);
    for (let frame = 0; frame < 30; frame++) expect(run.next().done).toBe(false);
    expect(r.row().trimEnd()).toBe('10');
    expect(r.read).toHaveBeenCalledTimes(1);
    expect(run.next().done).toBe(true);
  });

  it('FAR shares the numeric cursor with its caller and preserves clipped logical writes', () => {
    const r = rig({ P: [{ op: 'text', text: 'A' }, { op: 'far', program: 'C' }, { op: 'text', text: '!' }],
      C: [bcd(), { op: 'text', text: '<DONE>' }] });
    expect(r.runner.run('P', { money: 12 }, true).next().done).toBe(true);
    expect(r.row().trimEnd()).toBe('A12!');
    r.screen.resetCursor();
    r.screen.moveCursor(17);
    expect(r.runner.run('C', { money: 12 }, true).next().done).toBe(true);
    expect(r.row()[17]).toBe('1'); // second digit is clipped, not wrapped
    r.screen.moveCursor(-2);
    r.screen.writeGlyph('X', true).next();
    expect(r.row()[17]).toBe('X');
    expect(r.row(4).trimEnd()).toBe('');
  });
});

describe('TX_NUM / PrintNumber (home/print_num.asm)', () => {
  it.each([
    [1, 3, 0], [1, 3, 1], [1, 3, 10], [1, 3, 100], [1, 3, 255],
    [2, 5, 65535], [3, 7, 0x010203], [3, 7, 9999999],
  ])('%i-byte, %i-digit operand %i is left-aligned and immediate', (bytes, digits, hpDifference) => {
    const r = rig({ P: [{ op: 'decimal', binding: 'hpDifference', bytes, digits }, { op: 'text', text: '!' }] });
    // With normal letter delay the entire number AND suffix are placed in the initial CPU work.
    const run = r.runner.run('P', { hpDifference });
    expect(run.next().done).toBe(false);
    expect(r.row().trimEnd()).toBe(`${hpDifference}!`);
    expect(r.read).toHaveBeenCalledTimes(1); // suffix only
    run.next(); run.next(); expect(run.next().done).toBe(true);
    expect(r.read).toHaveBeenCalledTimes(4);
  });

  it.each([0, 1, 10, 100, 999])('runs the committed PotionText with HP difference %i and its suffix', hpDifference => {
    const r = rig(file.programs);
    expect(r.runner.run('PotionText', { nameBuffer: 'PIKACHU', hpDifference }, true).next().done).toBe(true);
    expect(r.row().trimEnd()).toBe('PIKACHU');
    expect(r.row(4).trimEnd()).toBe(`recovered by ${hpDifference}!`);
    expect(r.read).not.toHaveBeenCalled();
  });
});

describe('numeric binding validation and committed price programs', () => {
  it.each(['PokemartTellBuyPriceText', 'PokemartTellSellPriceText'])('%s retains native line controls around numeric output', label => {
    const r = rig(file.programs);
    const run = r.runner.run(label, { stringBuffer: 'POTION', money: 123456 }, true);
    let result = run.next();
    for (let frame = 1; !result.done && frame < 100; frame++) {
      r.input.down = frame % 8 < 4 ? TEXT_B : 0;
      result = run.next();
    }
    expect(result.done).toBe(true);
    expect(r.row().trimEnd()).toBe(label === 'PokemartTellBuyPriceText' ? 'That will be' : 'I can pay you');
    expect(r.row(4).trimEnd()).toBe(label === 'PokemartTellBuyPriceText' ? '¥123456. OK?' : '¥123456 for that.');
    expect(r.ports.beep).toHaveBeenCalledTimes(label === 'PokemartTellBuyPriceText' ? 1 : 0);
  });

  it.each([
    ['bcd', undefined], ['bcd', '12'], ['bcd', -1], ['bcd', 1.5], ['bcd', NaN],
    ['bcd', Infinity], ['bcd', 1000000], ['decimal', undefined], ['decimal', '12'],
    ['decimal', -1], ['decimal', 0.5], ['decimal', 1000], ['decimal', Number.MAX_SAFE_INTEGER + 1],
  ] as const)('%s rejects invalid money binding %s with its source label', (op, money) => {
    const r = rig({ Price: [op === 'bcd' ? bcd({ bytes: 3 }) : { op, binding: 'money', bytes: 2, digits: 3 }] });
    const bindings = { money } as unknown as TextBindings;
    expect(() => r.runner.run('Price', bindings).next()).toThrow(`${money === undefined ? 'missing text binding' : 'invalid numeric text binding'} money in Price`);
  });

  it('enforces the byte range even when the decimal display has spare digits', () => {
    const r = rig({ P: [{ op: 'decimal', binding: 'hpDifference', bytes: 1, digits: 3 }] });
    expect(() => r.runner.run('P', { hpDifference: 256 }).next()).toThrow('invalid numeric text binding hpDifference in P');
  });

  it('RAM rejects numeric input instead of coercing it into a string', () => {
    const r = rig({ P: [{ op: 'ram', binding: 'nameBuffer' }] });
    expect(() => r.runner.run('P', { nameBuffer: 12 } as unknown as TextBindings).next())
      .toThrow('invalid string text binding nameBuffer in P');
  });
});
