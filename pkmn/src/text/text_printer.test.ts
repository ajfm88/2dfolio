import { describe, expect, it, vi } from 'vitest';
import { TextPrinter, tokenizeText, TEXT_A, TEXT_B } from './text_printer';
import { charToTile, extraCharToTile } from './charmap';

function rig(text: string, speed = 3, initialJoy = 0) {
  const input = { down: initialJoy, sound: true };
  const beep = vi.fn(); const read = vi.fn();
  const printer = new TextPrinter(text, { buttons: () => input.down, speed: () => speed,
    soundFinished: () => input.sound, beep, joypadRead: read }, initialJoy);
  const frames = (count: number) => { for (let i = 0; i < count; i++) printer.advance(); };
  const row = (index: number) => printer.buffer.slice(index * 20 + 1, index * 20 + 19).join('').trimEnd();
  return { printer, input, beep, read, frames, row };
}

describe('PlaceString frame traces', () => {
  it.each([1, 3, 5])('places first, then delays %i frames, including the final letter', speed => {
    const r = rig('AB', speed);
    expect(r.row(2)).toBe('A');
    r.frames(speed - 1); expect(r.row(2)).toBe('A'); expect(r.printer.complete).toBe(false);
    r.frames(1); expect(r.row(2)).toBe('AB'); expect(r.printer.complete).toBe(false);
    r.frames(speed - 1); expect(r.printer.complete).toBe(false);
    r.frames(1); expect(r.printer.complete).toBe(true);
  });
  it.each([TEXT_A, TEXT_B])('held button %i makes each glyph cost one frame', button => {
    const r = rig('ABC', 5, button); r.frames(1); expect(r.row(2)).toBe('AB');
    r.frames(2); expect(r.printer.complete).toBe(true);
  });
  it('a press during the letter delay ends the delay one frame later', () => {
    const r = rig('AB', 5); r.frames(2); r.input.down = TEXT_A;
    r.frames(1); expect(r.row(2)).toBe('A'); r.frames(1); expect(r.row(2)).toBe('AB');
  });
  it('line one to line two takes no extra frame', () => {
    const r = rig('A\nB', 1); r.frames(1); expect(r.row(4)).toBe('B');
    expect(r.beep).not.toHaveBeenCalled(); r.frames(1); expect(r.printer.complete).toBe(true);
  });
  it('cont protects three frames, accepts the pending press and scrolls 5 + 5', () => {
    const r = rig('A\nB\nC', 1); r.frames(2);
    expect(r.printer.buffer[98]).toBe('▼'); const reads = r.read.mock.calls.length;
    r.input.down = TEXT_A; r.frames(2); expect(r.read).toHaveBeenCalledTimes(reads);
    r.frames(1); expect(r.beep).toHaveBeenCalledTimes(1);
    expect(r.row(1)).toBe('A'); expect(r.row(3)).toBe('B'); expect(r.row(4)).toBe('');
    r.frames(4); expect(r.row(3)).toBe('B'); r.frames(1);
    expect(r.row(2)).toBe('B'); expect(r.row(4)).toBe('');
    r.frames(4); expect(r.row(4)).toBe(''); r.frames(1); expect(r.row(4)).toBe('C');
  });
  it('held A from typing cannot accept cont until release and a new press', () => {
    const r = rig('A\nB\nC', 1, TEXT_A); r.frames(20);
    expect(r.beep).not.toHaveBeenCalled(); r.input.down = 0; r.frames(1);
    r.input.down = TEXT_A; r.frames(1); expect(r.beep).toHaveBeenCalledTimes(1);
  });
  it('sound wait retains the accepted button and performs no joypad reads', () => {
    const r = rig('A<PROMPT>', 1); r.frames(1); r.input.sound = false; r.input.down = TEXT_B;
    r.frames(3); const reads = r.read.mock.calls.length; r.input.down = 0; r.frames(10);
    expect(r.read).toHaveBeenCalledTimes(reads); expect(r.beep).not.toHaveBeenCalled();
    r.input.sound = true; r.frames(1); expect(r.beep).toHaveBeenCalledTimes(1);
    expect(r.printer.complete).toBe(true); expect(r.printer.buffer[98]).toBe(' ');
  });
  it('para clears all four inside rows, holds 20 frames, then starts row 14', () => {
    const r = rig('A\nB\fC', 1); r.frames(2); r.input.down = TEXT_B; r.frames(3);
    for (let row = 1; row <= 4; row++) expect(r.row(row)).toBe('');
    const reads = r.read.mock.calls.length; r.frames(19); expect(r.row(2)).toBe('');
    expect(r.read).toHaveBeenCalledTimes(reads); r.frames(1); expect(r.row(2)).toBe('C');
  });
  it.each(['', '<DONE>'])('done/text_end %s returns without a prompt or beep', end => {
    const r = rig(`A${end}`, 1); r.frames(1); expect(r.printer.complete).toBe(true);
    expect(r.printer.waiting).toBe(false); expect(r.beep).not.toHaveBeenCalled();
  });
  it('<CONT> on the first row scrolls that line away', () => {
    const r = rig('A<CONT>B', 1); r.frames(1); r.input.down = TEXT_B; r.frames(13);
    expect(r.row(2)).toBe(''); expect(r.row(4)).toBe('B');
  });
  it('<LINE> overwrites the second row without scrolling', () => {
    const r = rig('A\nBC<LINE>D', 1); r.frames(3); expect(r.row(4)).toBe('DC');
    expect(r.beep).not.toHaveBeenCalled();
  });
  it('<NEXT> moves two rows and clips off-box writes', () => {
    const r = rig('A<NEXT>B<NEXT>C', 1); r.frames(3);
    expect(r.row(2)).toBe('A'); expect(r.row(4)).toBe('B');
    expect(r.printer.buffer).not.toContain('C');
  });
  it('<SCROLL> scrolls without a prompt, beep or joypad reads in its ten frames', () => {
    const r = rig('A\nB<SCROLL>C', 1); r.frames(2); const reads = r.read.mock.calls.length;
    r.frames(9); expect(r.read).toHaveBeenCalledTimes(reads); expect(r.beep).not.toHaveBeenCalled();
    r.frames(1); expect(r.row(2)).toBe('B'); expect(r.row(4)).toBe('C');
  });
  it('no automatic wrap; long lines are clipped', () => {
    const r = rig('A'.repeat(19) + 'B', 1); r.frames(20);
    expect(r.row(2)).toBe('A'.repeat(18)); expect(r.row(4)).toBe('');
  });
  it('blink starts after Delay3 and toggles each thirty waiting frames', () => {
    const r = rig('A<PROMPT>', 1); r.frames(4);
    r.frames(29); expect(r.printer.buffer[98]).toBe('▼');
    r.frames(1); expect(r.printer.buffer[98]).toBe(' ');
    r.frames(30); expect(r.printer.buffer[98]).toBe('▼');
  });
  it.each([["It's", 3], ["you're", 5], ["don't", 4], ["I'm", 2]])('contraction %s has %i glyphs', (text, length) => {
    expect(tokenizeText(text)).toHaveLength(length);
  });
  it('contractions and extra-font glyphs use their cartridge tiles', () => {
    expect(["'d", "'l", "'s", "'t", "'v", "'r", "'m"].map(charToTile)).toEqual([59, 60, 61, 62, 63, 100, 101]);
    expect(['‘', '’', '“', '”', '…'].map(extraCharToTile)).toEqual([16, 17, 18, 19, 21]);
    expect(charToTile('\uE001')).toBe(97); expect(charToTile('\uE002')).toBe(98);
  });
});
