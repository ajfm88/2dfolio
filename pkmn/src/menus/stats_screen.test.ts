import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { StatsScreen } from './stats_screen';
import { PartyMenu } from './party_menu';
import { createPokemon, loadBattleData } from '../battle/data';
import { loadTextPrograms } from '../text/program_data';
import { drawText } from './menu_render';
import { isPressed } from '../input';
import { playSFX } from '../audio';
import type { GameButton } from '../core';
import { setPartyAndBillsSavedMenuItem } from '../list_state';

vi.mock('../renderer', () => ({ fillRect: vi.fn(), drawTile: vi.fn(), loadTileset: async () => ({}), loadFont: async () => ({}) }));
vi.mock('../input', () => ({ isPressed: vi.fn(() => false) }));
vi.mock('../audio', () => ({ playSFX: vi.fn() }));
vi.mock('./menu_render', () => ({ drawText: vi.fn(), drawBox: vi.fn() }));
vi.mock('./party_icons', () => ({ loadPartyIcons: vi.fn(), drawPartyIcon: vi.fn() }));
vi.mock('../battle', () => ({ loadPokemonSprites: async () => ({ front: null }), expToNextLevel: () => 123 }));
beforeAll(async () => { await loadBattleData(); await loadTextPrograms(); });
beforeEach(() => { vi.clearAllMocks(); setPartyAndBillsSavedMenuItem(0); });
const press = (key: GameButton) => vi.mocked(isPressed).mockImplementation(button => button === key);

it('Party STATS and the reusable screen draw identical page 1/page 2 text and preserve the selected mon', () => {
  const mon = createPokemon('PIKACHU', 18, 'Sparky')!; mon.currentHp = 7; mon.moves[0].pp = 1;
  const before = JSON.stringify(mon);
  const party = new PartyMenu(); party.show([mon]);
  press('a'); party.update(); press('down'); party.update(); press('a'); party.update();
  const stats = new StatsScreen(true); stats.show(mon);
  for (let page = 1; page <= 2; page++) {
    vi.mocked(drawText).mockClear(); party.render(); const expected = vi.mocked(drawText).mock.calls.slice();
    vi.mocked(drawText).mockClear(); stats.render(); stats.render();
    expect(vi.mocked(drawText).mock.calls).toEqual([...expected, ...expected]);
    expect(expected).toContainEqual(['SPARKY', 72, 8]);
    if (page === 2) expect(expected.some(call => call[0] === 'PP')).toBe(true);
    press('a'); party.update(); expect(stats.update(isPressed)).toBe(page === 2);
  }
  expect(JSON.stringify(mon)).toBe(before);
});

it('the Bill screen accepts one page per A and B closes immediately, without sounds or render input', () => {
  const stats = new StatsScreen(true); stats.show(createPokemon('RATTATA', 5)!);
  vi.mocked(playSFX).mockClear(); vi.mocked(isPressed).mockClear(); stats.render(); stats.render();
  expect(isPressed).not.toHaveBeenCalled(); press('a'); expect(stats.update()).toBe(false);
  press('b'); expect(stats.update()).toBe(true); expect(playSFX).not.toHaveBeenCalled();
});
