import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { isHeld } from '../input';
import { loadTextPrograms } from '../text/program_data';
import { initTextSystem, setTextSpeed } from '../text/textbox';
import { textBgTransfer } from '../text/bg_transfer';
import { loadBattleMoveData } from './battle_move_data';
import { A, PARTYMON_STRUCT_LENGTH } from './battle_state';
import { BattleHost } from './battle_host';
import { executePlayerMove, executeEnemyMove, type ExecutePorts, type ExecuteResult } from './battle_execute';
import { hpRig } from '../test/battle_hp_rig';
import { namedBattleRandom } from '../test/battle_random_log';
import { battleRandom } from './battle_random';

beforeAll(async () => { await loadBattleMoveData(); await loadTextPrograms(); await initTextSystem(); });
beforeEach(() => { vi.clearAllMocks(); setTextSpeed('fast'); textBgTransfer.enabled = true; textBgTransfer.resetPortion(); });
afterEach(() => vi.restoreAllMocks());

for (const side of [0, 1] as const) it.each([1, 119, 118])(`real used-move Programs update actor ${side}, called move %i and original-slot PP`, id => {
  const r = hpRig(side), s = r.s, host = new BattleHost<ExecuteResult>(s);
  s.wBattleMonSpecies = 1; s.wEnemyMonSpecies = 2; s.wBattleMonAttack = 20; s.wEnemyMonDefense = 20;
  s.wBattleMonDefense = 20; s.wEnemyMonAttack = 20; s.wBattleMonType1 = 3; s.wBattleMonType2 = 3;
  s.wEnemyMonType1 = 3; s.wEnemyMonType2 = 3;
  s.species = () => ({ name: 'MON', base: [50, 50, 50, 36, 50], type1: 0, type2: 0, catchRate: 0, baseExp: 0, moves: [1, 0, 0, 0], learnset: [] });
  s.mem.fill(7, A.wPlayerMonStatMods, A.wPlayerMonStatMods + 8); s.mem.fill(7, A.wEnemyMonStatMods, A.wEnemyMonStatMods + 8);
  s.wPlayerSelectedMove = id; s.wEnemySelectedMove = id; s.wPlayerUsedMove = 1; s.wEnemyUsedMove = 1;
  s.wPlayerMoveListIndex = 2; s.wEnemyMoveListIndex = 2;
  const pp = (side ? A.wEnemyMonPP : A.wBattleMonPP) + 2;
  const party = (side ? A.wEnemyMons : A.wPartyMons) + PARTYMON_STRUCT_LENGTH + 31;
  s.wPlayerMonNumber = 1; s.wEnemyMonPartyPos = 1; s.mem[pp] = 12; s.mem[party] = 12;
  const log = namedBattleRandom(s, 'execute', id === 118 ? [0, 165, 118, 1, 8, 179, 0] : [8, 179, 0]);
  s.random = () => battleRandom(s);
  const ports: ExecutePorts = {
    animation: function* () {}, statModifierUpEffect: function* () {}, hideSubstitute: function* () {},
    reshowSubstitute: function* () {}, substituteBreak: function* () {}, shake: function* () {},
    jumpMoveEffect: function* () { return 1; },
  };
  const print = vi.spyOn(host, 'printText');
  host.start((side ? executeEnemyMove : executePlayerMove)(s, host.video.screen, host, ports));
  let down = false, frames = 0;
  while (!host.done && frames++ < 4000) {
    down = host.video.textBox.isWaitingForInput ? !down : false;
    vi.mocked(isHeld).mockImplementation(key => down && key === 'b'); host.step();
  }
  expect(host.done).toBe(true); expect(host.result).toEqual({ b: 1, exit: 'done' });
  expect(s.mem[side ? A.wEnemyUsedMove : A.wPlayerUsedMove]).toBe(1);
  expect(s.mem[pp]).toBe(side ? (id === 1 ? 12 : 13) : 11); expect(s.mem[party]).toBe(s.mem[pp]);
  expect(print.mock.calls.filter(call => call[0] === 'UsedMoveText')).toHaveLength(id === 1 ? 1 : 2);
  expect(log).toHaveLength(id === 118 ? 7 : 3);
});
