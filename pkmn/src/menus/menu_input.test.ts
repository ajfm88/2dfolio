import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MenuInput } from './menu_input';
import { isPassPressed } from '../input';
import type { GameButton } from '../core';
vi.mock('../input', () => ({ isPassPressed: vi.fn(() => false) }));

/** Frame driver: `press` is what the next actual read sees; reads are counted. */
function rig(config: ConstructorParameters<typeof MenuInput>[0]) {
  const menu = new MenuInput(config);
  let next: GameButton[] = [];
  const read = vi.fn(() => { const seen = next; next = []; vi.mocked(isPassPressed).mockImplementation(k => seen.includes(k)); });
  const sound = vi.fn();
  return {
    menu, read, sound,
    press: (...keys: GameButton[]) => { next = keys; },
    frame: () => menu.update(read, sound),
  };
}
const blackboard = { watched: ['left', 'right', 'a', 'b'] as GameButton[], maxItem: 2, topX: 1, topY: 2 };

beforeEach(() => { vi.mocked(isPassPressed).mockReset(); vi.mocked(isPassPressed).mockReturnValue(false); });

describe('HandleMenuInput_ (home/window.asm)', () => {
  it('Delay3 first: the first Joypad read is on the third frame, then one read a frame', () => {
    const r = rig(blackboard);
    expect(r.frame()).toBeNull(); expect(r.frame()).toBeNull(); expect(r.read).not.toHaveBeenCalled();
    expect(r.frame()).toBeNull(); expect(r.read).toHaveBeenCalledTimes(1);
    r.frame(); r.frame(); expect(r.read).toHaveBeenCalledTimes(3);
    expect(r.menu.cursor).toEqual({ x: 1, y: 2 });
  });

  it('Up/Down move without wrapping, and each re-arms Delay3 (unwatched) with no sound', () => {
    const r = rig(blackboard); r.frame(); r.frame();
    r.press('up'); r.frame(); expect(r.menu.item).toBe(0); // already at the top
    expect(r.frame()).toBeNull(); expect(r.frame()).toBeNull(); expect(r.read).toHaveBeenCalledTimes(1);
    r.press('down'); r.frame(); expect(r.read).toHaveBeenCalledTimes(2); expect(r.menu.item).toBe(1);
    r.frame(); r.frame(); r.press('down'); r.frame(); expect(r.menu.item).toBe(2);
    r.frame(); r.frame(); r.press('down'); r.frame(); expect(r.menu.item).toBe(2); // no wrap to 0
    expect(r.menu.cursor).toEqual({ x: 1, y: 6 });
    expect(r.sound).not.toHaveBeenCalled();
  });

  it('an unwatched key (START, or B on an A-only menu) re-arms Delay3 silently', () => {
    const r = rig({ watched: ['a'], maxItem: 3, topX: 1, topY: 2 }); r.frame(); r.frame();
    r.press('b'); expect(r.frame()).toBeNull();
    r.frame(); r.frame(); expect(r.read).toHaveBeenCalledTimes(1);
    r.press('start'); r.frame(); expect(r.read).toHaveBeenCalledTimes(2);
    r.frame(); r.frame(); r.press('a'); expect(r.frame()).toEqual(['a']);
    expect(r.sound).toHaveBeenCalledOnce();
  });

  it('a watched key returns at once: A/B with SFX_PRESS_AB, LEFT/RIGHT without; no tail', () => {
    for (const [key, sound] of [['a', 1], ['b', 1], ['left', 0], ['right', 0]] as const) {
      const r = rig(blackboard); r.frame(); r.frame(); r.press(key);
      expect(r.frame()).toEqual([key]); expect(r.sound).toHaveBeenCalledTimes(sound);
    }
  });

  it('A with Up skips the move (bit B_PAD_A jumps to .checkOtherKeys); B with Up still moves', () => {
    const r = rig({ ...blackboard, item: 1 }); r.frame(); r.frame();
    r.press('a', 'up'); expect(r.frame()).toEqual(['a', 'up']); expect(r.menu.item).toBe(1);
    const s = rig({ ...blackboard, item: 1 }); s.frame(); s.frame();
    s.press('b', 'up'); expect(s.frame()).toEqual(['b', 'up']); expect(s.menu.item).toBe(0);
  });
});
