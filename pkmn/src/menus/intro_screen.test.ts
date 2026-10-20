import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IntroScreen, type IntroCell } from './intro_screen';
import { textBgTransfer } from '../text/bg_transfer';
import { TextBox, setTextSpeed } from '../text/textbox';

vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: () => true }));
vi.mock('../input', () => ({ isHeld: () => false, syncJoypadRead: vi.fn() }));

beforeEach(() => { textBgTransfer.enabled = true; textBgTransfer.resetPortion(); setTextSpeed('fast'); });
function copy(screen: IntroScreen, picture: string): void {
  const run = screen.copyVideoData(picture); run.next();
  for (let frame = 1; frame <= 7; frame++) { screen.vblank(); expect(run.next().done).toBe(frame === 7); }
}

describe('intro picture slots and shared tilemap', () => {
  it.each([0, 1, 2])('at inherited portion %i, a picture copy changes 8/8/8/8/8/8/1 slots and freezes transfer', portion => {
    const screen = new IntroScreen(); copy(screen, 'red'); screen.placePicture();
    screen.vblank(); screen.vblank(); screen.vblank();
    for (let i = 0; i < portion; i++) screen.vblank();
    const oldScanout = screen.visibleCells;
    screen.clearArea(6, 5, 7, 7);
    const run = screen.copyVideoData('shrink1'); run.next();
    for (let frame = 1; frame <= 7; frame++) {
      expect(textBgTransfer.enabled).toBe(false);
      expect(screen.vblank()).toBeNull();
      expect(textBgTransfer.nextPortion).toBe(portion);
      expect(screen.visibleCells).toEqual(oldScanout);
      expect(screen.slots).toEqual(Array.from({ length: 49 }, (_, tile) => ({
        picture: tile < Math.min(frame * 8, 49) ? 'shrink1' : 'red', tile,
      })));
      expect(run.next().done).toBe(frame === 7);
    }
    expect(textBgTransfer.enabled).toBe(true);
    expect(screen.vblank()).toBe(portion);
  });

  it('keeps the transfer disabled if its caller disabled it, and restores it when a copy is abandoned', () => {
    const screen = new IntroScreen(); textBgTransfer.enabled = false;
    copy(screen, 'oak'); expect(textBgTransfer.enabled).toBe(false);
    textBgTransfer.enabled = true;
    const run = screen.copyVideoData('red'); run.next(); screen.vblank(); run.return(undefined);
    expect(textBgTransfer.enabled).toBe(true);
    expect(screen.slots[7]?.picture).toBe('red'); expect(screen.slots[8]?.picture).toBe('oak');
  });

  it('writes column-major IDs, reverses columns for flipped pics, and never conflates tile zero with a space', () => {
    const screen = new IntroScreen(); screen.placePicture();
    expect(screen.at(6, 4)).toBe(0); expect(screen.at(7, 4)).toBe(7);
    expect(screen.at(6, 10)).toBe(6); expect(screen.at(12, 10)).toBe(48);
    expect(screen.visibleAt(6, 4)).toBe(' ');
    screen.clearScreen(); screen.placePicture(true);
    expect(screen.at(12, 4)).toBe(0); expect(screen.at(6, 4)).toBe(42);
    expect(screen.at(6, 10)).toBe(48); expect(screen.at(5, 4)).toBe(' ');
  });

  it('reuses glyph layout, clears only the requested cells, and keeps ClearScreen behind the shared scanout', () => {
    const screen = new IntroScreen(); screen.placePicture(false, 12);
    screen.textBoxBorder(0, 0, 10, 9); screen.placeString(3, 0, 'NAME@');
    screen.placeString(2, 2, 'NEW NAME<NEXT>YELLOW@'); screen.placeString(1, 14, 'RETAIN');
    expect(screen.at(0, 0)).toBe('┌'); expect(screen.at(10, 11)).toBe('┘');
    expect(screen.at(3, 0)).toBe('N'); expect(screen.at(2, 4)).toBe('Y');
    screen.vblank(); screen.vblank(); screen.vblank();
    screen.clearArea(0, 0, 12, 11);
    expect(screen.at(1, 14)).toBe('R'); expect(screen.at(12, 4)).toBe(0);
    expect(screen.visibleAt(3, 0)).toBe('N'); screen.vblank(); expect(screen.visibleAt(3, 0)).toBe(' ');
    const portion = textBgTransfer.nextPortion; screen.clearScreen();
    expect(textBgTransfer.nextPortion).toBe(portion); expect(screen.visibleAt(1, 14)).toBe('R');
    screen.vblank(); screen.vblank(); screen.vblank();
    expect(screen.visibleCells).toEqual(Array(360).fill(' '));
  });

  it.each(['right', 'left'] as const)('%s slide matches the literal byte region, including each of six torn frames', direction => {
    const screen = new IntroScreen();
    // Unique cell values expose row wrapping, the exact 125-byte bounds and the zero byte.
    for (let index = 0; index < 360; index++) screen.put(index % 20, Math.floor(index / 20), `cell${index}`);
    screen.placePicture(false, direction === 'right' ? 6 : 12);
    screen.vblank(); screen.vblank(); screen.vblank();
    textBgTransfer.tick(); textBgTransfer.tick(); // nonzero inherited phase must be reset
    const expected = screen.cells.slice() as IntroCell[];
    const run = screen.slidePicture(direction); run.next();
    const torn: number[] = [];
    for (let step = 0; step < 6; step++) {
      const before = screen.visibleCells.slice();
      // Independent memmove oracle derived from the traced HL start/end addresses.
      if (direction === 'right') expected.copyWithin(87 + step, 86 + step, 211 + step);
      else { expected.copyWithin(91 - step, 92 - step, 217 - step); expected[216 - step] = 0; }
      expect(screen.cells).toEqual(expected); expect(textBgTransfer.nextPortion).toBe(0);
      for (let third = 0; third < 3; third++) {
        expect(screen.vblank()).toBe(third);
        expect(screen.visibleCells.slice(0, 120)).toEqual(expected.slice(0, 120));
        expect(screen.visibleCells.slice(120, 240)).toEqual((third === 0 ? before : expected).slice(120, 240));
        expect(screen.visibleCells.slice(240)).toEqual((third < 2 ? before : expected).slice(240));
        if (third === 0) torn.push(step * 3 + 1);
        expect(run.next().done).toBe(step === 5 && third === 2);
      }
    }
    expect(torn).toEqual([1, 4, 7, 10, 13, 16]);
    expect(textBgTransfer.nextPortion).toBe(0); expect(textBgTransfer.enabled).toBe(true);
  });

  it('uses one actual TextBox tick: pre-CPU thirds and later first-glyph scanout share the same phase', () => {
    const screen = new IntroScreen(), box = new TextBox();
    box.printStandalone({ text: 'ABC' }, { noDelay: true }); screen.captureText(box);
    expect(screen.at(0, 12)).toBe('┌'); expect(screen.visibleAt(0, 12)).toBe(' ');
    const tick = vi.spyOn(textBgTransfer, 'tick');
    for (let frame = 1; frame <= 6; frame++) {
      screen.vblank(box, true);
      expect(tick).toHaveBeenCalledTimes(frame);
      expect(textBgTransfer.nextPortion).toBe(frame % 3);
      if (frame === 3) {
        expect(screen.at(1, 14)).toBe('A'); expect(screen.visibleAt(1, 14)).toBe(' ');
        expect(screen.visibleAt(0, 12)).toBe('┌');
      }
    }
    expect(screen.visibleAt(1, 14)).toBe('A'); expect(screen.visibleAt(3, 14)).toBe('C');
    expect(box.isComplete).toBe(true); tick.mockRestore();
  });

  it('a retained TextBox shares the copy freeze and resumes its inherited phase with the cleared pic', () => {
    const screen = new IntroScreen(), box = new TextBox(); copy(screen, 'shrink2'); screen.placePicture();
    box.printStandalone({ text: 'STAYS' }, { noDelay: true });
    for (let i = 0; i < 6; i++) screen.vblank(box, true);
    screen.vblank(box); // inherited middle phase
    const p = textBgTransfer.nextPortion, before = screen.visibleCells;
    screen.clearArea(6, 5, 7, 7);
    const run = screen.copyVideoData('shrink2'); run.next();
    for (let i = 0; i < 7; i++) { screen.vblank(box); expect(screen.visibleCells).toEqual(before); run.next(); }
    expect(textBgTransfer.nextPortion).toBe(p);
    for (let i = 0; i < 3; i++) screen.vblank(box);
    expect(screen.visibleAt(6, 4)).toBe(0); expect(screen.visibleAt(6, 5)).toBe(' ');
    expect(screen.visibleAt(1, 14)).toBe('S'); expect(box.isComplete).toBe(true);
  });
});
