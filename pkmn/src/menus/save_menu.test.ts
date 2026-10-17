import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => { Object.assign(globalThis, { window: { addEventListener() {} } }); });
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ fillRect: vi.fn(), drawTile: vi.fn(), loadFont: async () => ({}), loadTileset: async () => ({}) }));
vi.mock('./menu_render', () => ({ drawText: vi.fn(), drawBox: vi.fn(), drawScreenTile: vi.fn() }));
import { SaveSession, type SaveInfo } from './save_menu';
import { StartMenuSession } from './start_menu';
import { TextBox, initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms } from '../text/program_data';
import { textBgTransfer } from '../text/bg_transfer';
import * as input from '../input';
import { setBattleAndStartSavedMenuItem } from '../list_state';
import { setPlayerName } from '../core/player_state';
import { drawBox, drawText } from './menu_render';
import { playSFX, isSoundFinished } from '../audio';
import { TIME_COLON_GLYPH } from './menu_glyphs';
import type { GameButton } from '../core';

const buttons: GameButton[] = ['a', 'b', 'up', 'down', 'left', 'right', 'start', 'select'];
beforeAll(async () => { await initTextSystem(); await loadTextPrograms(); });
beforeEach(() => {
  vi.restoreAllMocks(); vi.clearAllMocks(); vi.mocked(isSoundFinished).mockReturnValue(true);
  vi.mocked(playSFX).mockImplementation(() => Promise.resolve());
  textBgTransfer.enabled = true; textBgTransfer.resetPortion(); setTextSpeed('fast'); setPlayerName('RED');
  for (const key of buttons) input.setKey(key, false); input.updateInput(); input.syncJoypadRead();
});
function rig(info: Partial<SaveInfo> = {}) {
  setBattleAndStartSavedMenuItem(4);
  const start = new StartMenuSession(() => {}); start.open(true, 'RED');
  for (let i = 0; i < 23; i++) start.frame(input.readJoypad);
  input.setKey('a', true); input.updateInput(); expect(start.frame(input.readJoypad)).toBe('save');
  const box = new TextBox(), sprites = vi.fn(), write = vi.fn();
  const save = new SaveSession(start, box, sprites, write);
  let frame = 0, closed = false, soundFrames = 0;
  const prints: { program: string; at: number }[] = [];
  const print = box.printStandalone.bind(box);
  vi.spyOn(box, 'printStandalone').mockImplementation((source, opts) => {
    if ('program' in source) prints.push({ program: source.program, at: frame });
    expect(opts?.noDelay).toBe(false); print(source, opts);
  });
  const transfer = vi.spyOn(textBgTransfer, 'tick'), read = vi.spyOn(input, 'readJoypad'), sync = vi.spyOn(input, 'syncJoypadRead');
  save.open({ player: 'RED', badges: 0, owned: 0, playTimeMs: 5 * 60000, ...info });
  const step = (...held: GameButton[]) => {
    frame++; if (soundFrames > 0) soundFrames--;
    for (const key of buttons) input.setKey(key, held.includes(key)); input.updateInput();
    const ticks = transfer.mock.calls.length, reads = read.mock.calls.length, syncs = sync.mock.calls.length;
    const result = save.frame(input.readJoypad); if (result === 'close') closed = true;
    expect(transfer.mock.calls.length - ticks).toBe(closed && result !== 'close' ? 0 : 1);
    expect(read.mock.calls.length > reads && sync.mock.calls.length > syncs).toBe(false);
    return result;
  };
  const wait = (n: number) => { for (let i = 0; i < n; i++) step(); };
  const until = (pred: () => boolean, held: GameButton[] = []) => {
    let n = 0; while (!pred() && n++ < 2000) step(...held);
    expect(pred(), `timeout at ${frame}`).toBe(true);
  };
  const question = () => { until(() => box.isComplete); return frame; };
  return { start, box, save, sprites, write, prints, step, wait, until, question, read, sync, transfer,
    time: () => frame, closed: () => closed, sound: (n: number) => {
      soundFrames = n; vi.mocked(isSoundFinished).mockImplementation(() => soundFrames === 0);
    } };
}
describe('SaveMenu source session', () => {
  it('draws information S+5, question S+45, first glyph S+48, first YES/NO read Q+3', () => {
    const r = rig(); expect(r.start.tiles.at(4, 0)).toBe('┌');
    r.wait(4); expect(r.sprites).not.toHaveBeenCalled(); expect(textBgTransfer.enabled).toBe(false);
    r.step(); expect(r.sprites).toHaveBeenCalledOnce(); expect(textBgTransfer.enabled).toBe(true);
    expect(r.start.tiles.at(11, 10)).toBe('▷');
    r.wait(39); expect(r.prints).toEqual([]); r.step();
    expect(r.prints).toEqual([{ program: 'WouldYouLikeToSaveText', at: 45 }]);
    expect(r.box.saveScreen().buffer.every(c => c === ' ')).toBe(true);
    r.wait(2); expect(r.box.saveScreen().buffer.every(c => c === ' ')).toBe(true);
    r.step(); expect(r.box.saveScreen().buffer[41]).toBe('W');
    const q = r.question(), reads = r.read.mock.calls.length;
    r.save.paint(); expect(drawBox).toHaveBeenLastCalledWith(0, 56, 48, 40);
    expect(drawText).toHaveBeenCalledWith('YES', 16, 64); expect(drawText).toHaveBeenCalledWith('NO', 16, 80);
    r.wait(2); expect(r.read).toHaveBeenCalledTimes(reads);
    r.step(); expect(r.time()).toBe(q + 3); expect(r.read).toHaveBeenCalledTimes(reads + 1);
  });
  it.each([[0, 0, 0], [8, 12, 12], [8, 151, 255]])('prints number cells: badges=%i, dex=%i, hours=%i', (badges, owned, hours) => {
    const r = rig({ badges, owned, playTimeMs: hours * 3600000 + 5 * 60000 }); r.wait(5);
    const cells = (x: number, y: number, n: number) => Array.from({ length: n }, (_, i) => r.start.tiles.at(x + i, y)).join('');
    expect(cells(5, 2, 6)).toBe('PLAYER'); expect(cells(12, 2, 3)).toBe('RED');
    expect(cells(5, 6, 7)).toBe('POKéDEX');
    expect(cells(17, 4, 2)).toBe(String(badges).padStart(2)); expect(cells(16, 6, 3)).toBe(String(owned).padStart(3));
    expect(cells(13, 8, 3)).toBe(String(hours).padStart(3));
    expect(r.start.tiles.at(16, 8)).toBe(TIME_COLON_GLYPH); expect(cells(17, 8, 2)).toBe('05');
  });
  it.each(['b', 'no'] as const)('%s returns after 15 frames, restores hollow SAVE and never writes', answer => {
    const r = rig(); r.question(); r.wait(3);
    if (answer === 'no') { r.step('down'); r.wait(3); }
    r.step(answer === 'no' ? 'a' : 'b'); const a0 = r.time();
    r.wait(14); expect(r.closed()).toBe(false); r.step();
    expect(r.closed()).toBe(true); expect(r.time()).toBe(a0 + 15); expect(r.write).not.toHaveBeenCalled();
    expect(r.start.tiles.at(11, 10)).toBe('▷'); expect(r.start.tiles.at(4, 0)).toBeNull();
  });
  it('writes once at A0+25 before text, waits 128/10/current sound/save sound/30, then auto-closes', () => {
    const r = rig(); r.question(); r.wait(3); r.step('a'); const a0 = r.time();
    r.wait(24); expect(r.write).not.toHaveBeenCalled(); r.step();
    expect(r.write).toHaveBeenCalledOnce(); expect(r.time()).toBe(a0 + 25);
    expect(r.prints[1]).toEqual({ program: 'SavingText', at: a0 + 25 });
    expect(r.write.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(r.box.printStandalone).mock.invocationCallOrder[1]);
    r.until(() => r.box.isComplete); const r1 = r.time();
    r.wait(127); expect(r.prints).toHaveLength(2); r.step();
    expect(r.prints[2]).toEqual({ program: 'GameSavedText', at: r1 + 128 });
    r.until(() => r.box.isComplete); const r2 = r.time();
    r.sound(20); r.wait(10); expect(r.time()).toBe(r2 + 10);
    expect(vi.mocked(playSFX).mock.calls.filter(([s]) => s === 'save')).toHaveLength(0);
    vi.mocked(playSFX).mockImplementation(sound => { if (sound === 'save') r.sound(7); return Promise.resolve(); });
    r.wait(10); expect(playSFX).toHaveBeenLastCalledWith('save'); const soundStart = r.time();
    r.wait(7); const w = r.time(); expect(w).toBe(soundStart + 7);
    r.wait(29); expect(r.closed()).toBe(false); r.step(); expect(r.closed()).toBe(true);
    expect(r.time()).toBe(w + 30); expect(r.write).toHaveBeenCalledOnce(); expect(r.start.tiles.at(11, 10)).toBe('▷');
  });
  it('holds restored Buffer2 only while A is held, then closes on release without another button', () => {
    const r = rig(); r.question(); r.wait(3); r.step('down'); r.wait(3); r.step('a');
    for (let i = 0; i < 25; i++) r.step('a');
    expect(r.closed()).toBe(false); expect(r.start.tiles.at(11, 10)).toBe('▷');
    expect(r.start.tiles.at(4, 0)).toBeNull(); expect(r.box.active).toBe(false);
    const ticks = r.transfer.mock.calls.length, reads = r.read.mock.calls.length;
    r.save.paint(); r.save.paint(); expect(r.transfer).toHaveBeenCalledTimes(ticks); expect(r.read).toHaveBeenCalledTimes(reads);
    expect(r.step()).toBe('close'); expect(r.write).not.toHaveBeenCalled();
  });

  it('with no previous sound, starts save exactly ten frames after GameSavedText returns (note 53 V9)', () => {
    const r = rig(); r.question(); r.wait(3); r.step('a');
    r.until(() => r.prints.some(p => p.program === 'GameSavedText'));
    r.until(() => r.box.isComplete); const r2 = r.time();
    r.wait(9); expect(playSFX).not.toHaveBeenCalledWith('save');
    r.step(); expect(r.time()).toBe(r2 + 10);
    expect(vi.mocked(playSFX).mock.calls.filter(([sound]) => sound === 'save')).toEqual([['save']]);
  });

  it.each([0, 1, 2])('keeps the message through Buffer2 restore until its bottom-third transfer, offset %i (note 53 V8)', offset => {
    const r = rig(); r.question(); r.wait(3 + offset); r.step('down'); r.wait(3); r.step('a');
    for (let i = 0; i < 15; i++) r.step('a');
    expect(r.box.active).toBe(true); expect(r.closed()).toBe(false);
    expect(r.start.tiles.at(11, 10)).toBe('▷');
    let bottomCopied = false;
    for (let i = 0; i < 3; i++) {
      const third = textBgTransfer.nextPortion;
      r.step('a'); bottomCopied ||= third === 2;
      expect(r.box.active, `message after transfer third ${third}`).toBe(!bottomCopied);
    }
    expect(bottomCopied).toBe(true); expect(r.closed()).toBe(false);
    expect(r.step()).toBe('close');
  });
});
