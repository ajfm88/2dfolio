// V5g3 checkpoint-03 (note 108): DisplayTownMap's input plays SFX_TINK (engine/items/town_map.asm:70–90).
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../renderer', () => ({ getCtx: vi.fn(), getScale: () => 1, fillRect: vi.fn(),
  loadTileset: vi.fn(async () => ({ width: 32 })), loadSprite: vi.fn(async () => ({ width: 16, height: 16 })) }));
vi.mock('../input', () => ({ isPressed: vi.fn(() => false) }));
vi.mock('../audio', () => ({ playSFX: vi.fn() }));
vi.mock('./menu_render', () => ({ drawText: vi.fn() }));
import { isPressed } from '../input';
import { playSFX } from '../audio';
import { TownMap } from './town_map';
import type { GameButton } from '../core';

const press = (...keys: GameButton[]) => vi.mocked(isPressed).mockImplementation(key => keys.includes(key));
const cursor = (map: TownMap) => (map as unknown as { cursorIndex: number }).cursorIndex;

describe('the Town Map input (V5g3 checkpoint-03)', () => {
  let map: TownMap;
  beforeEach(async () => { vi.clearAllMocks(); press(); map = new TownMap(); await map.show('PalletTown'); });

  it('nothing pressed: no sound, still open', () => {
    expect(map.update()).toBe('open');
    expect(playSFX).not.toHaveBeenCalled();
  });

  it('A or B plays SFX_TINK and closes the map', () => {
    press('a'); expect(map.update()).toBe('closed');
    press('b'); expect(map.update()).toBe('closed');
    expect(vi.mocked(playSFX).mock.calls).toEqual([['tink'], ['tink']]);
  });

  it('Up and Down play SFX_TINK and move the cursor (Up to the next entry, Down back, wrapping)', () => {
    const start = cursor(map);
    press('up'); expect(map.update()).toBe('open'); expect(cursor(map)).toBe(start + 1);
    press('down'); expect(map.update()).toBe('open'); expect(map.update()).toBe('open');
    expect(cursor(map)).toBe(43); // 44 entries: PalletTown is 0
    expect(vi.mocked(playSFX).mock.calls).toEqual([['tink'], ['tink'], ['tink']]);
  });

  it('Up or Down with A is tested first: the cursor moves and the map stays open', () => {
    press('up', 'a'); expect(map.update()).toBe('open');
    press('down', 'b'); expect(map.update()).toBe('open');
    expect(cursor(map)).toBe(0);
    expect(vi.mocked(playSFX).mock.calls).toEqual([['tink'], ['tink']]);
  });
});
