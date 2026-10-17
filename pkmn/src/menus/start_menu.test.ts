import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => { Object.assign(globalThis, { window: { addEventListener() {} } }); });
vi.mock('../audio', () => ({ playSFX: vi.fn() }));
vi.mock('./menu_render', () => ({ drawText: vi.fn(), drawBox: vi.fn(), drawScreenTile: vi.fn() }));
vi.mock('../renderer/ui_tiles', () => ({ uiTiles: { cover: vi.fn() } }));

import { StartMenuSession } from './start_menu';
import { BgTransfer } from '../text/bg_transfer';
import { CloseSequence } from '../text/close_sequence';
import { getNoTextDelay } from '../text/text_flags';
import { setKey, updateInput, readJoypad, syncJoypadRead } from '../input';
import { getBattleAndStartSavedMenuItem, setBattleAndStartSavedMenuItem, resetListStateForEmptySlot } from '../list_state';
import { playSFX } from '../audio';
import { drawScreenTile } from './menu_render';
import type { GameButton } from '../core';

const keys: GameButton[] = ['a', 'b', 'start', 'select', 'up', 'down', 'left', 'right'];
beforeEach(() => {
  for (const key of keys) setKey(key, false);
  updateInput(); syncJoypadRead(); setBattleAndStartSavedMenuItem(0); vi.clearAllMocks();
});

function rig(dex = false) {
  const transfer = new BgTransfer();
  const tick = vi.spyOn(transfer, 'tick');
  const sprites = vi.fn();
  const session = new StartMenuSession(sprites, transfer);
  const read = vi.fn(readJoypad);
  const frame = (...held: GameButton[]) => {
    for (const key of keys) setKey(key, held.includes(key));
    updateInput(); return session.frame(read);
  };
  const wait = (n: number) => { for (let i = 0; i < n; i++) frame(); };
  session.open(dex, 'RED');
  return { session, transfer, tick, sprites, read, frame, wait };
}

describe('START source session (home/start_menu.asm)', () => {
  it.each([
    ['dex', 3, false], ['party', 35, true], ['item', 5, false],
    ['trainer', 20, true], ['option', 5, false],
  ] as const)('holds input during the %s tail and resumes only after redraw +3', (kind, waits, white) => {
    const r = rig(); r.wait(23); r.frame('a');
    const sound = vi.mocked(playSFX).mock.calls.length;
    r.session.redisplay(kind); expect(r.session.paletteWhite).toBe(white);
    const reads = r.read.mock.calls.length;
    for (let i = 1; i <= waits; i++) {
      expect(r.frame('b')).toBeNull(); expect(r.read).toHaveBeenCalledTimes(reads);
      if (kind === 'item' || kind === 'option') expect(r.transfer.enabled).toBe(i === waits);
      if (kind === 'trainer') expect(r.transfer.enabled).toBe(i >= 17);
      if (kind === 'party') expect(r.transfer.enabled).toBe(i < 3 || i >= 29);
    }
    expect(r.session.paletteWhite).toBe(false);
    expect(playSFX).toHaveBeenCalledTimes(sound);
    r.frame(); r.frame(); expect(r.read).toHaveBeenCalledTimes(reads);
    r.frame(); expect(r.read).toHaveBeenCalledTimes(reads + 1);
  });

  it('opens with border copy +3, sound/labels +20, first read +23 and one transfer tick per frame', () => {
    const r = rig();
    expect(r.sprites).toHaveBeenCalledOnce();
    expect(r.session.tiles.at(10, 0)).toBe('┌');
    expect(r.transfer.enabled).toBe(false);
    r.session.paint(); expect(drawScreenTile).not.toHaveBeenCalled();
    r.wait(2); r.session.paint(); expect(drawScreenTile).not.toHaveBeenCalled();
    r.frame(); r.session.paint(); expect(drawScreenTile).toHaveBeenCalled();
    expect(r.session.tiles.at(12, 2)).toBe(' ');
    r.wait(16); expect(playSFX).not.toHaveBeenCalled();
    r.frame(); expect(playSFX).toHaveBeenCalledExactlyOnceWith('start_menu');
    expect(r.session.tiles.at(12, 2)).toBe('P');
    expect(r.session.tiles.at(11, 2)).toBe('▶');
    expect(r.sprites).toHaveBeenCalledTimes(2);
    expect(getNoTextDelay()).toBe(false);
    r.wait(2); expect(r.read).not.toHaveBeenCalled();
    r.frame(); expect(r.read).toHaveBeenCalledOnce();
    expect(r.tick).toHaveBeenCalledTimes(23);
  });

  it.each([false, true])('draws the cartridge layout, dex=%s', dex => {
    const r = rig(dex); r.wait(20);
    const labels = [...(dex ? ['POKéDEX'] : []), 'POKéMON', 'ITEM', 'RED', 'SAVE', 'OPTION', 'EXIT'];
    labels.forEach((label, i) => {
      expect(Array.from({ length: label.length }, (_, x) => r.session.tiles.at(12 + x, 2 + 2 * i)).join('')).toBe(label);
    });
    expect(r.session.tiles.at(10, dex ? 15 : 13)).toBe('└');
    expect(r.session.tiles.at(19, dex ? 15 : 13)).toBe('┘');
    expect(r.session.tiles.at(9, 2)).toBeNull();
  });

  it.each([0, 1, 2])('accepts a one-frame A tap after %s idle frames', idle => {
    const r = rig(); r.wait(23 + idle);
    expect(r.frame('a')).toBe('party');
    expect(r.session.tiles.at(11, 2)).toBe('▷');
    expect(r.session.buffer2()[2 * 20 + 11]).toBe('▷');
    expect(playSFX).toHaveBeenLastCalledWith('press_ab');
    const reads = r.read.mock.calls.length, ticks = r.tick.mock.calls.length;
    r.frame(); r.session.paint(); r.session.paint();
    expect(r.read).toHaveBeenCalledTimes(reads); expect(r.tick).toHaveBeenCalledTimes(ticks);
  });

  it('wraps only on Up from last-placed zero; Down erases the old bottom cursor and skips the hidden row', () => {
    const r = rig(); r.wait(22);
    r.frame('down'); expect(r.session.tiles.at(11, 4)).toBe('▶');
    r.wait(2); r.frame('up');
    expect(r.session.tiles.at(11, 2)).toBe('▶'); // row 1 -> 0 must not wrap
    r.wait(3); r.frame('up'); // release must reach Joypad after Delay3 before another Up edge
    expect(r.session.tiles.at(11, 12)).toBe('▶');
    expect(r.session.tiles.at(11, 2)).toBe(' ');
    r.wait(2); r.frame('down');
    expect(r.session.tiles.at(11, 2)).toBe('▶');
    expect(r.session.tiles.at(11, 12)).toBe(' ');
    expect(r.session.tiles.at(11, 14)).toBeNull();
    expect(playSFX).toHaveBeenCalledExactlyOnceWith('start_menu');
  });

  it('does not repeat held arrows and re-arms Delay3 after unwatched input', () => {
    const r = rig(); r.wait(22); r.frame('down');
    for (let i = 0; i < 40; i++) r.frame('down');
    expect(r.session.tiles.at(11, 4)).toBe('▶');
    r.frame('right'); const reads = r.read.mock.calls.length;
    r.frame(); r.frame(); expect(r.read).toHaveBeenCalledTimes(reads);
    expect(r.frame('a')).toBe('item');
  });

  it('checks arrows before dispatch even when A suppresses the underlying move', () => {
    const r = rig(); r.wait(22);
    expect(r.frame('a', 'up')).toBeNull();
    expect(r.session.tiles.at(11, 12)).toBe('▶');
    expect(playSFX).toHaveBeenLastCalledWith('press_ab');
    expect(() => r.session.buffer2()).toThrow();
  });

  it.each(['a', 'b', 'start'] as const)('hollows/saves on %s; adds exactly five close-copy waits before the unchanged core', key => {
    const r = rig(); r.wait(22); r.frame('up'); // EXIT
    r.wait(2); const before = r.read.mock.calls.length;
    expect(r.frame(key)).toBeNull();
    expect(r.session.closing).toBe(true);
    expect(r.session.tiles.at(11, 12)).toBe('▷');
    expect(getBattleAndStartSavedMenuItem()).toBe(5);
    expect(r.read).toHaveBeenCalledTimes(before + 2); // HandleMenuInput + CloseStartMenu's Joypad
    expect(vi.mocked(playSFX).mock.calls.filter(([sound]) => sound === 'press_ab')).toHaveLength(key === 'start' ? 0 : 1);
    if (key === 'a') expect(r.session.buffer2()[12 * 20 + 11]).toBe('▷');
    else expect(() => r.session.buffer2()).toThrow();
    const portion = r.transfer.nextPortion;
    expect(r.transfer.enabled).toBe(false);
    for (let i = 0; i < 4; i++) expect(r.frame(key)).toBeNull();
    expect(r.transfer.nextPortion).toBe(portion);
    expect(r.frame(key)).toBe('exit'); // held EXIT A does not stall on hJoyHeld
    expect(r.transfer.enabled).toBe(true);
    expect(r.read).toHaveBeenCalledTimes(before + 2);
    const done = vi.fn(), core = new CloseSequence(7, done); // Red's Room: 1+2*1+4
    for (let i = 0; i < 6; i++) core.advance();
    expect(done).not.toHaveBeenCalled(); core.advance(); expect(done).toHaveBeenCalledOnce();
  });

  it('keeps the raw saved row across reopen and Pokédex acquisition; bag slot resets leave it alone', () => {
    const r = rig(); r.wait(22); r.frame('down'); r.wait(2);
    expect(r.frame('a')).toBe('item');
    resetListStateForEmptySlot(); expect(getBattleAndStartSavedMenuItem()).toBe(1);
    r.session.open(true, 'RED'); r.wait(22);
    expect(r.session.tiles.at(11, 4)).toBe('▶');
    r.frame(); // observe release before next press
    expect(r.frame('a')).toBe('party');
  });

  it('redisplays an empty-party return immediately, with its next read +3 and no opening sound', () => {
    const r = rig(); r.wait(22); expect(r.frame('a')).toBe('party');
    r.session.redisplay(); expect(r.session.tiles.at(11, 2)).toBe('▶');
    const reads = r.read.mock.calls.length;
    r.frame(); r.frame(); expect(r.read).toHaveBeenCalledTimes(reads);
    r.frame(); expect(r.read).toHaveBeenCalledTimes(reads + 1);
    expect(r.sprites).toHaveBeenCalledTimes(3);
    expect(vi.mocked(playSFX).mock.calls.filter(([s]) => s === 'start_menu')).toHaveLength(1);
  });

  it('saves Buffer2 by value and restores logical cells without advancing visible thirds or input', () => {
    const r = rig(); r.wait(23); expect(r.frame('a')).toBe('party');
    const saved = r.session.buffer2(), portion = r.transfer.nextPortion;
    r.session.tiles.put(12, 2, 'X');
    const visible = r.session.tiles.visibleAt(12, 2);
    r.session.restore();
    expect(r.session.tiles.at(12, 2)).toBe('P');
    expect(r.session.tiles.visibleAt(12, 2)).toBe(visible);
    expect(r.transfer.nextPortion).toBe(portion);
    expect(saved[2 * 20 + 12]).toBe('P');
    expect(r.transfer.enabled).toBe(true);
    const ticks = r.tick.mock.calls.length, reads = r.read.mock.calls.length;
    r.session.paint(); r.session.paint(); r.frame();
    expect(r.tick).toHaveBeenCalledTimes(ticks); expect(r.read).toHaveBeenCalledTimes(reads);
  });
});
