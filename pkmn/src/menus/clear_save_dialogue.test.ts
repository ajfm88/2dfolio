// Opening checkpoint-07b (note 117): DoClearSaveDialogue as a frame program, with real input and text, on a mocked audio
// facade, renderer and save. main_title.test.ts drives it through main's real tick from the title's exit.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const record = vi.hoisted(() => {
  Object.assign(globalThis, { window: { addEventListener() {} } });
  return { frame: 0, calls: [] as [number, string, unknown][] };
});
vi.mock('../audio', () => ({
  playSFX: (name: string) => { record.calls.push([record.frame, 'sfx', name]); return Promise.resolve(); },
  isSoundFinished: () => true,
}));
vi.mock('../renderer', () => ({
  setActivePalette: (name: string) => { record.calls.push([record.frame, 'palette', name]); },
  loadTileset: vi.fn(async () => ({ width: 128, height: 16 })), loadFont: async () => ({ width: 128 }),
  fillRect: vi.fn(), drawTile: vi.fn(), getScale: () => 1, getCtx: () => ({}),
}));
vi.mock('./intro_screen_render', () => ({ renderIntroScreen: () => {} }));
vi.mock('../save', () => ({ clearSave: () => { record.calls.push([record.frame, 'clearSave', null]); } }));
import { ClearSaveDialogue, CLEAR_SRAM_FRAMES, NO_YES_BOX, NO_YES_CURSOR, TWO_OPTION_TAIL, type ClearSaveAnswer } from './clear_save_dialogue';
import { initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms } from '../text/program_data';
import { setFastTextDelay } from '../text/text_flags';
import { textBgTransfer } from '../text/bg_transfer';
import { isVBlankHeld, resetVBlankHold } from '../core/vblank_hold';
import * as input from '../input';
import type { GameButton } from '../core';

const buttons: GameButton[] = ['a', 'b', 'start', 'select', 'up', 'down', 'left', 'right'];
let dialogue: ClearSaveDialogue;
interface Tick { stage: string; held: boolean; transfer: boolean; answer: ClearSaveAnswer | null }
function tick(pressed: GameButton[] = []): Tick {
  buttons.forEach(button => input.setKey(button, pressed.includes(button)));
  input.updateInput();
  const held = isVBlankHeld();
  record.frame++;
  const answer = dialogue.update();
  return { stage: dialogue.inspection.stage, held, transfer: textBgTransfer.enabled, answer };
}
const run = (count: number, pressed: GameButton[] = []): Tick[] => Array.from({ length: count }, () => tick(pressed));
const row = (y: number, cells = dialogue.inspection.cells): string => cells.slice(y * 20, y * 20 + 20).map(String).join('');
/** Ticks until the text is printed; returns how many. */
function toMenu(): number {
  let n = 0;
  while (dialogue.inspection.stage !== 'menu') { tick(); if (++n > 400) throw new Error('menu bound'); }
  return n;
}

beforeAll(async () => { await initTextSystem(); await loadTextPrograms(); });
beforeEach(async () => {
  record.frame = 0; record.calls.length = 0; resetVBlankHold();
  textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  input.setJoyIgnore('none'); buttons.forEach(button => input.setKey(button, false)); input.updateInput(); input.syncJoypadRead();
  setFastTextDelay(false); setTextSpeed('medium');
  dialogue = new ClearSaveDialogue(); await dialogue.load(); dialogue.start();
});
afterEach(() => { input.setJoyIgnore('none'); setFastTextDelay(true); });

const BOOT_MENU_FRAME = 53;
/** Slow (5 a letter), medium (3), and medium with A held from the 41st frame: 33 frames, then 20 letters. */
const B_PATH_FRAMES = [133, 93, 60];

describe('DoClearSaveDialogue, frame by frame', () => {
  it('ClearScreen 1–3; the palette command at 3 (held 4–5, Delay3 6–8); the two tile loads 9–30 with no BG transfer', () => {
    const t = run(31);
    expect(t.slice(0, 2).map(f => f.stage)).toEqual(['clear', 'clear']);
    expect(record.calls.filter(call => call[1] === 'palette')).toEqual([[3, 'palette', 'MEWMON']]);
    expect(t.map(f => f.held)).toEqual(t.map((_, i) => i === 3 || i === 4));
    // CopyVideoDataDouble's 17 frames, then CopyVideoData's 5; the flag comes back in the last one's step.
    expect(t.map(f => f.transfer)).toEqual(t.map((_, i) => i < 7 || i >= 29));
    expect(t.slice(7, 29).every(f => f.stage === 'tiles')).toBe(true);
    expect(dialogue.inspection.requests.find(r => r.kind === 'text')).toEqual({ frame: 30, kind: 'text', value: 'ClearSaveDataText' });
    expect(row(12)).toBe('┌' + '─'.repeat(18) + '┐');
    expect(dialogue.inspection.cells.slice(0, 12 * 20).every(cell => cell === ' ')).toBe(true);
  });

  it('boot path (BIT_FAST_TEXT_DELAY clear): one frame a letter, whatever the options; the menu opens after "data?"', () => {
    setTextSpeed('slow');
    run(32);
    expect(row(14)).toBe('│' + ' '.repeat(18) + '│');
    const firstGlyph = 32 + run(20).findIndex(() => row(14).includes('C')) + 1;
    expect(firstGlyph).toBe(33);
    expect(52 + toMenu()).toBe(BOOT_MENU_FRAME);
    expect(row(14)).toBe('│Clear all saved   │');
    expect(row(16)).toBe('│data?             │');
  });

  it('B path (BIT_FAST_TEXT_DELAY set by the main menu): the options\' speed, held A or B one frame a letter', () => {
    setFastTextDelay(true);
    setTextSpeed('slow');
    const slow = toMenu();
    dialogue.start(); record.frame = 0;
    setTextSpeed('medium');
    const medium = toMenu();
    dialogue.start(); record.frame = 0;
    let n = 0;
    while (dialogue.inspection.stage !== 'menu') { tick(n > 40 ? ['a'] : []); if (++n > 400) throw new Error('bound'); }
    expect([slow, medium, n]).toEqual(B_PATH_FRAMES);
  });
});

describe('the NO/YES menu (DisplayTwoOptionMenu, NO_YES_MENU)', () => {
  it('the box at (14, 7), NO and YES, the cursor on NO; B is masked (wJoyIgnore = PAD_B) until the menu closes', () => {
    toMenu();
    expect(dialogue.inspection.requests.find(r => r.kind === 'menu')!.frame).toBe(BOOT_MENU_FRAME);
    expect([7, 8, 9, 10, 11].map(y => row(y).slice(14))).toEqual(['┌────┐', '│▶NO │', '│    │', '│ YES│', '└────┘']);
    expect([NO_YES_BOX.x, NO_YES_BOX.y, NO_YES_CURSOR.x, NO_YES_CURSOR.y]).toEqual([14, 7, 15, 8]);
    expect(input.joyIgnore()).toBe('b');
    // B, held for frames: nothing is read, nothing plays, the cursor stays.
    const withB = run(10, ['b']);
    expect(withB.every(f => f.answer === null && f.stage === 'menu')).toBe(true);
    expect(record.calls.filter(call => call[1] === 'sfx')).toEqual([]);
    expect(dialogue.inspection.menu!.item).toBe(0);
  });

  it('NO: A on the first item, press_ab, 15 frames, the menu\'s tiles restored and Init in that step; the save is kept', () => {
    toMenu();
    run(3);
    const pressFrame = record.frame + 1;
    tick(['a']);
    expect(record.calls.filter(call => call[1] === 'sfx')).toEqual([[pressFrame, 'sfx', 'press_ab']]);
    const tail = run(TWO_OPTION_TAIL);
    expect(tail.map(f => f.answer)).toEqual([...Array<null>(14).fill(null), 'no']);
    expect([7, 8, 9, 10, 11].every(y => row(y).slice(14) === '      ')).toBe(true);
    expect(record.calls.some(call => call[1] === 'clearSave')).toBe(false);
    expect(input.joyIgnore()).toBe('none');
    expect(TWO_OPTION_TAIL).toBe(15);
  });

  it('YES: Down, then A; 15 frames; ClearAllSRAMBanks clears the save and runs 13 more frames before Init', () => {
    toMenu();
    run(3);
    // Down is not watched: HandleMenuInput goes back to .loop1, and Delay3 holds the next read for three frames.
    tick(['down']); run(2);
    expect(dialogue.inspection.menu!.item).toBe(1);
    expect(row(8).slice(14)).toBe('│ NO │');
    expect(row(10).slice(14)).toBe('│▶YES│');
    tick(['a']);
    expect(record.calls.filter(call => call[1] === 'sfx').map(call => call[2])).toEqual(['press_ab']);
    const tail = run(TWO_OPTION_TAIL);
    expect(tail.every(f => f.answer === null)).toBe(true);
    const clearFrame = record.frame;
    expect(record.calls.filter(call => call[1] === 'clearSave')).toEqual([[clearFrame, 'clearSave', null]]);
    expect(CLEAR_SRAM_FRAMES).toBe(13);
    expect(run(CLEAR_SRAM_FRAMES).map(f => f.answer)).toEqual([...Array<null>(12).fill(null), 'yes']);
  });
});
