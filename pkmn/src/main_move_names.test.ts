import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { host, output, loadMainBattleRig, resetMainBattleRig, tick, until, world, mon, row } from './test/main_battle_rig';
import * as menus from './battle/move_selection_menu';
import type { MoveMenuHost } from './battle/battle_menu_context';
import { renderBattleScreen } from './battle/battle_screen_render';
import { A } from './battle/battle_state';

const keys = ['THUNDERSHOCK', 'SLAM', 'QUICK_ATTACK', 'THUNDER_WAVE'];
const names = ['THUNDERSHOCK', 'SLAM', 'QUICK ATTACK', 'THUNDER WAVE'];
let menuHost: MoveMenuHost;
beforeAll(() => loadMainBattleRig());
beforeEach(() => {
  resetMainBattleRig();
  const original = menus.moveSelectionMenu;
  vi.spyOn(menus, 'moveSelectionMenu').mockImplementation((ctx, host) => {
    menuHost = host;
    return original(ctx, host);
  });
});
afterEach(() => { host.reset(); vi.restoreAllMocks(); });
function shownNames(): string[] {
  const screen = host.session!.screen;
  return names.map((_, slot) => Array.from({ length: 13 }, (_, x) =>
    String(screen.visibleAt(6 + x, 13 + slot) ?? ' ')).join('').trimEnd());
}
async function fight() {
  const pika = mon(25, 25);
  pika.moves = keys.map((id, slot) => ({ id, pp: [27, 20, 30, 20][slot], maxPp: [30, 20, 30, 20][slot] }));
  await world('Route2', 4, 10, [pika]);
  host.startBattle(mon(19, 4));
  until(() => host.state === 'battle');
  until(() => row(14).includes('FIGHT') && !host.session!.video.textBox.active);
  for (let i = 0; i < 30; i++) tick();
  host.renderLiveBattle();
  const before = output.pixels.slice(96 * 160 * 4);
  // Render every frame from the FIGHT press until the menu's first complete transfer.
  for (let i = 0; i < 30; i++) {
    tick(i === 0 ? ['a'] : []);
    expect(() => host.renderLiveBattle()).not.toThrow();
    if (shownNames().join('|') === names.join('|')) return { before, frames: i + 1 };
  }
  throw new Error(`move menu did not transfer: ${shownNames()}`);
}

it('real main renders the user’s four cartridge move names on every FIGHT-entry frame', async () => {
  const { before, frames } = await fight();
  expect(frames).toBeLessThanOrEqual(6);
  expect(shownNames()).toEqual(names);
  // Check the session's read-only MoveMenuHost name source too, independently of formatting.
  expect([84, 21, 98, 86].map(id => menuHost.getMove(id).name)).toEqual(names);
  const expected = renderBattleScreen(host.session!.screen, host.session!.renderTiles);
  expect([...output.pixels.slice(96 * 160 * 4)]).toEqual([...expected.slice(96 * 160 * 4)]);
  expect(output.pixels.slice(96 * 160 * 4)).not.toEqual(before);
});

it('real main SELECT swaps QUICK ATTACK into slot 1 and redraws cartridge names', async () => {
  await fight();
  // Finish the initial input Delay3 before the first fresh SELECT.
  for (let i = 0; i < 12; i++) tick();
  const press = (key: 'down' | 'select' | 'up') => {
    for (let i = 0; i < 8; i++) { tick([key]); host.renderLiveBattle(); }
    for (let i = 0; i < 12; i++) { tick(); host.renderLiveBattle(); }
  };
  press('select'); press('down'); press('down'); press('select');
  expect(shownNames()).toEqual(['QUICK ATTACK', 'SLAM', 'THUNDERSHOCK', 'THUNDER WAVE']);
  expect([...host.session!.state.mem.slice(A.wBattleMonMoves, A.wBattleMonMoves + 4)]).toEqual([98, 21, 84, 86]);
});
