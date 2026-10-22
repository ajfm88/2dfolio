import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { isHeld } from '../input';
import { initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms } from '../text/program_data';
import { textBgTransfer } from '../text/bg_transfer';
import { BattleHost } from './battle_host';
import { A, encodeText } from './battle_state';
import { loadBattleMoveData } from './battle_move_data';
import { checkForDisobedience } from './battle_obedience';
import { checkEnemyStatusConditions, checkPlayerStatusConditions, type StatusContinuation } from './battle_turn_status';
import { statusRig } from '../test/battle_status_rig';

beforeAll(async () => { await loadBattleMoveData(); await loadTextPrograms(); await initTextSystem(); });
beforeEach(() => { vi.clearAllMocks(); setTextSpeed('fast'); textBgTransfer.enabled = true; textBgTransfer.resetPortion(); });
afterEach(() => vi.restoreAllMocks());

function drive<T>(host: BattleHost<T>) {
  let down = false;
  for (let i = 0; !host.done && i < 2000; i++) {
    down = host.video.textBox.isWaitingForInput ? !down : false;
    vi.mocked(isHeld).mockImplementation(key => down && key === 'b'); host.step();
  }
  expect(host.done).toBe(true); expect(host.video.textBox.textReturn).toBe('returned');
}
function cells<T>(host: BattleHost<T>): string { return host.video.screen.cells.map(String).join(''); }

it.each([0, 1] as const)('real committed frozen status places actor%i through BattleHost and spends no PP', side => {
  const r = statusRig(side); r.s.mem[r.c.status] = 32;
  r.s.setBytes(A.wBattleMonNick, encodeText('PIKA@'), 11); r.s.setBytes(A.wEnemyMonNick, encodeText('FOE@'), 11);
  const host = new BattleHost<StatusContinuation>(r.s), audio = vi.fn();
  const serviced = vi.spyOn(host.video, 'vblank');
  const active = new BattleHost<StatusContinuation>(r.s, host.video, audio);
  active.start(side === 0 ? checkPlayerStatusConditions(r.s, active, r.ports) : checkEnemyStatusConditions(r.s, active, r.ports));
  drive(active);
  expect(active.result).toBe(side === 0 ? 'ExecutePlayerMoveDone' : 'ExecuteEnemyMoveDone');
  expect(cells(active)).toContain(side === 0 ? 'PIKA' : 'Enemy FOE'); expect(cells(active)).toContain('frozen solid!');
  expect(audio).toHaveBeenCalledTimes(serviced.mock.calls.length);
  expect([r.s.mem[A.wBattleMonPP], r.s.mem[A.wEnemyMonPP]]).toEqual([0, 0]);
});
it.each([0, 1] as const)('disabled selected move on side%i prints its original name buffer', side => {
  const r = statusRig(side); r.s.mem[r.c.disabledId] = 33;
  r.s.setBytes(A.wBattleMonNick, encodeText('PIKA@'), 11); r.s.setBytes(A.wEnemyMonNick, encodeText('FOE@'), 11);
  const host = new BattleHost<StatusContinuation>(r.s);
  host.start(side === 0 ? checkPlayerStatusConditions(r.s, host, r.ports) : checkEnemyStatusConditions(r.s, host, r.ports));
  drive(host); expect(cells(host)).toContain('TACKLE is'); expect(cells(host)).toContain('disabled!');
});
it('real disobedience nap text precedes return, replacing the full status byte', () => {
  const r = statusRig(); r.s.writeBE(A.wPlayerID, 1); r.s.writeBE(A.wPartyMon1OTID, 2);
  r.s.wBattleMonLevel = 50; r.s.wBattleMonStatus = 64; r.rolls(0xa0, 10, 0, 8);
  r.s.setBytes(A.wBattleMonNick, encodeText('PIKA@'), 11);
  const host = new BattleHost<'canUseMove' | 'cannotUseMove'>(r.s);
  host.start(checkForDisobedience(r.s, host, r.ports)); drive(host);
  expect(host.result).toBe('cannotUseMove'); expect(r.s.wBattleMonStatus).toBe(1);
  expect(cells(host)).toContain('PIKA began'); expect(cells(host)).toContain('to nap!');
});

it.each([0, 1, 2, 3])('real ignore text%i binds the party nickname RAM operand', index => {
  const r = statusRig(); r.s.writeBE(A.wPlayerID, 1); r.s.writeBE(A.wPartyMon1OTID, 2);
  r.s.wBattleMonLevel = 50; r.rolls(0xa0, 10, 5, index);
  r.s.setBytes(A.wBattleMonNick, encodeText('PIKA@'), 11);
  const host = new BattleHost<'canUseMove' | 'cannotUseMove'>(r.s);
  host.start(checkForDisobedience(r.s, host, r.ports)); drive(host);
  expect(host.result).toBe('cannotUseMove'); expect(cells(host)).toContain('PIKA');
});
