import { beforeEach, describe, expect, it, vi } from 'vitest';
import { YesNoMenu } from './yes_no_menu';
import { isPassPressed, isPressed } from '../input';
import { playSFX } from '../audio';
import { drawText, drawBox } from './menu_render';
import { getNoTextDelay, setNoTextDelay } from '../text/text_flags';
vi.mock('../input', () => ({ isPassPressed: vi.fn(() => false), isPressed: vi.fn(() => false) }));
vi.mock('../audio', () => ({ playSFX: vi.fn() }));
vi.mock('./menu_render', () => ({ drawText: vi.fn(), drawBox: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(isPassPressed).mockReturnValue(false); vi.mocked(isPressed).mockReturnValue(false); });
const press = (key: string) => vi.mocked(isPassPressed).mockImplementation(k => k === key);
describe('DisplayTwoOptionMenu / HandleMenuInput cartridge delays', () => {
  it('left YES/NO uses SAVE coordinates and leaves the default chooser unchanged', () => {
    const menu = new YesNoMenu(); menu.show({ actualRead: true, position: 'left' }); menu.render();
    expect(drawBox).toHaveBeenLastCalledWith(0, 56, 48, 40); expect(drawText).toHaveBeenLastCalledWith('▶', 8, 64);
    menu.show({ actualRead: true }); menu.render(); expect(drawBox).toHaveBeenLastCalledWith(112, 56, 48, 40);
  });
  it('clears shared no-text-delay before the first input delay', () => {
    setNoTextDelay(true);
    const menu = new YesNoMenu();
    menu.show({ actualRead: true });
    expect(getNoTextDelay()).toBe(false);
    const read = vi.fn();
    menu.update(read); menu.update(read);
    expect(read).not.toHaveBeenCalled();
  });
  it('PC silence suppresses only the answer sound, retaining Delay3 and the 15-frame tail', () => {
    const menu = new YesNoMenu(); const read = vi.fn();
    menu.show({ actualRead: true, silent: true });
    menu.update(read); menu.update(read); press('b');
    expect(menu.update(read)).toBeNull();
    expect(read).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 14; i++) expect(menu.update(read)).toBeNull();
    expect(menu.update(read)).toBe('no');
    expect(read).toHaveBeenCalledTimes(1);
    expect(playSFX).not.toHaveBeenCalled();
    menu.show({ actualRead: true });
    menu.update(read); menu.update(read); menu.update(read);
    expect(playSFX).toHaveBeenCalledWith('press_ab');
  });
  it.each(['up', 'down', 'left', 'right', 'start', 'select'])('%s re-arms Delay3; idle polls once per frame', key => {
    const menu = new YesNoMenu(); const read = vi.fn(); menu.show({ actualRead: true });
    menu.update(read); menu.update(read); expect(read).not.toHaveBeenCalled();
    menu.update(read); expect(read).toHaveBeenCalledTimes(1);
    menu.update(read); expect(read).toHaveBeenCalledTimes(2);
    press(key); menu.update(read); expect(read).toHaveBeenCalledTimes(3);
    vi.mocked(isPassPressed).mockReturnValue(false);
    menu.update(read); menu.update(read); expect(read).toHaveBeenCalledTimes(3);
    menu.update(read); expect(read).toHaveBeenCalledTimes(4);
  });
  it.each(['a', 'b'])('%s keeps the menu and drawn cursor for 15 frames with no reads', key => {
    const menu = new YesNoMenu(); const read = vi.fn(); menu.show({ actualRead: true }); press(key);
    menu.update(read); menu.update(read); expect(menu.update(read)).toBeNull();
    expect(playSFX).toHaveBeenCalledExactlyOnceWith('press_ab');
    for (let t = 0; t < 15; t++) {
      if (t > 0) expect(menu.update(read)).toBeNull();
      menu.render();
      expect(drawText).toHaveBeenLastCalledWith('\u25B6', 120, 64);
    }
    expect(menu.update(read)).toBe(key === 'a' ? 'yes' : 'no'); expect(read).toHaveBeenCalledTimes(1);
  });
  it('Down then A chooses NO without wrapping; B wins over simultaneous A', () => {
    const menu = new YesNoMenu(); menu.show({ actualRead: true }); press('down');
    menu.update(); menu.update(); menu.update();
    press('a'); menu.update(); menu.update(); menu.update();
    let answer: string | null = null; for (let t = 0; t < 15; t++) answer = menu.update(); expect(answer).toBe('no');
    menu.show({ actualRead: true }); vi.mocked(isPassPressed).mockImplementation(k => k === 'a' || k === 'b');
    menu.update(); menu.update(); menu.update(); for (let t = 0; t < 15; t++) answer = menu.update(); expect(answer).toBe('no');
  });
  it('legacy yesNo still reads and resolves immediately', () => {
    const menu = new YesNoMenu(); menu.show(); vi.mocked(isPressed).mockImplementation(k => k === 'a');
    expect(menu.update()).toBe('yes');
  });
  it('detects initial Delay3 removed in memory', () => {
    const menu = new YesNoMenu(); menu.show({ actualRead: true }); const read = vi.fn();
    Reflect.set(menu, 'readDelay', 0); menu.update(read);
    expect(() => expect(read).not.toHaveBeenCalled()).toThrow();
  });
  it('detects the 15-frame answer tail removed in memory', () => {
    const menu = new YesNoMenu(); menu.show({ actualRead: true }); press('a');
    menu.update(); menu.update(); menu.update(); Reflect.set(menu, 'answerDelay', 0);
    expect(() => expect(menu.update()).toBeNull()).toThrow();
  });
});
