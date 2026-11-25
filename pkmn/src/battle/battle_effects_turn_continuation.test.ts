import { afterEach, beforeAll, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { BattleMenuScreen } from './battle_menu_screen';
import { bindBattleScreen } from './battle_screen';
import { bideEffect } from './battle_effects_turns';
import * as random from './battle_random';
import { loadBattleMoveData } from './battle_move_data';
import { loadTextPrograms } from '../text/program_data';
import { collect, statusRig } from '../test/battle_status_rig';

beforeAll(async () => { await loadBattleMoveData(); await loadTextPrograms(); });
afterEach(() => vi.restoreAllMocks());

// effects.asm BideEffect -> core.asm BideCheck, both actor-specific paths.
it.each([0, 1] as const)('Bide initialization flows through hold and release for actor %i', side => {
  const r = statusRig(side), { s, c } = r;
  bindBattleScreen(s, new BattleMenuScreen().screen);
  const draw = vi.spyOn(random, 'battleRandom').mockReturnValue(0);
  s.writeBE(c.bide, 0xface); s.wPlayerMoveEffect = 26; s.wEnemyMoveEffect = 55;
  const env = { host: r.host, animation: r.ports.animation,
    hideSubstitute: function* () {}, reshowSubstitute: function* () {} };
  collect(bideEffect(s, env));
  expect([s.mem[c.flags], s.mem[c.count], s.readBE(c.bide), s.wPlayerMoveEffect, s.wEnemyMoveEffect])
    .toEqual([1, 2, 0, 0, 0]);
  expect(draw).toHaveBeenCalledTimes(1);
  s.wDamage = 0x00ff;
  expect(collect(r.check()).result).toBe(side === 0 ? 'ExecutePlayerMoveDone' : 'ExecuteEnemyMoveDone');
  expect([s.mem[c.count], s.readBE(c.bide), s.mem[c.move]]).toEqual([1, 0xff, 0]);
  s.wDamage = 2;
  expect(collect(r.check()).result).toBe(side === 0 ? 'HandleIfPlayerMoveMissed' : 'HandleIfEnemyMoveMissed');
  expect([s.mem[c.count], s.mem[c.flags], s.readBE(c.bide), s.wDamage, s.mem[c.move], s.mem[c.move + 2]])
    .toEqual([0, 0, 0, 0x202, 117, 1]);
  expect([s.wBattleMonLevel, s.wEnemyMonLevel]).toEqual(side === 0 ? [20, 30] : [30, 20]);
  expect(r.texts).toEqual(['UnleashedEnergyText']);
  expect(draw).toHaveBeenCalledTimes(1);
});
