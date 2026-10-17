import { describe, it, expect } from 'vitest';
import { tossItemPrompt, finishTossItem } from './toss_item';
import { setListScrollOffset, getListScrollOffset } from '../list_state';

describe('shared TossItem_', () => {
  it.each(['TOWN_MAP', 'OAKS_PARCEL', 'HM01', 'HM05'])('refuses %s before confirmation', id => {
    const source = [{ id, count: 1 }];
    expect(tossItemPrompt(id, id).program).toBe('TooImportantToTossText');
    expect(finishTossItem(source, 0, 1, id, 'yes')).toBeNull();
    expect(source).toHaveLength(1);
  });
  it('NO preserves both duplicate slots; YES removes only the selected quantity', () => {
    const source = [{ id: 'POTION', count: 4 }, { id: 'POTION', count: 3 }];
    expect(tossItemPrompt('POTION', 'POTION').bindings).toEqual({ stringBuffer: 'POTION' });
    expect(finishTossItem(source, 1, 2, 'POTION', 'no')).toBeNull();
    expect(source[1].count).toBe(3);
    expect(finishTossItem(source, 1, 2, 'POTION', 'yes')).toEqual({ program: 'ThrewAwayItemText', bindings: { nameBuffer: 'POTION' } });
    expect(source.map(s => s.count)).toEqual([4, 1]);
    setListScrollOffset(3);
    finishTossItem(source, 1, 1, 'POTION', 'yes');
    expect(getListScrollOffset()).toBe(0);
    expect(source).toEqual([{ id: 'POTION', count: 4 }]);
  });
});
