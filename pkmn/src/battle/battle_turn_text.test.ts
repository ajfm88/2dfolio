import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { isHeld } from '../input';
import { TextScreen } from '../text/text_printer';
import { initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms } from '../text/program_data';
import { textBgTransfer } from '../text/bg_transfer';
import { BattleHost } from './battle_host';
import { A, BattleState, encodeText } from './battle_state';
import { getCurrentMove, loadBattleMoveData } from './battle_move_data';
import { announceMove, displayUsedMoveText, getMoveGrammar, usedMoveTextHandlers } from './battle_turn_text';
import type { Frame } from './battle_menu_context';

beforeAll(async () => { await loadBattleMoveData(); await loadTextPrograms(); await initTextSystem(); });
beforeEach(() => { vi.clearAllMocks(); setTextSpeed('fast'); textBgTransfer.enabled = true; textBgTransfer.resetPortion(); });
afterEach(() => vi.restoreAllMocks());

function rig(id: number, turn = 0): [BattleState, BattleHost] {
  const s = new BattleState(); s.hWhoseTurn = turn;
  s.wPlayerSelectedMove = id; s.wEnemySelectedMove = id;
  s.setBytes(A.wBattleMonNick, encodeText('PIKA@'), 11);
  s.setBytes(A.wEnemyMonNick, encodeText('RHYDON@'), 11);
  getCurrentMove(s);
  return [s, new BattleHost(s)];
}
function row(host: BattleHost, y: number): string {
  return Array.from({ length: 18 }, (_, x) => String(host.video.screen.at(x + 1, y) ?? ' ')).join('').trim();
}
function drive(host: BattleHost): Frame[] {
  const frames: Frame[] = []; let down = false;
  for (let i = 0; !host.done && i < 1000; i++) {
    down = host.video.textBox.isWaitingForInput ? !down : false;
    vi.mocked(isHeld).mockImplementation(key => down && key === 'b');
    frames.push(host.step()!);
  }
  expect(host.done).toBe(true); return frames;
}

describe('GetMoveGrammar and its four handler bodies', () => {
  it.each([
    [0, [14, 74]], [1, [105, 120, 133]], [2, [96, 97, 100, 102, 104, 117, 140]],
    [3, [1, 10, 11, 17, 19, 20, 21, 30, 34, 35, 37, 39, 43, 44, 45, 46, 47, 64, 68, 70,
      71, 81, 89, 90, 91, 92, 103, 106, 107, 110, 111, 118, 122, 128, 132, 139, 141, 145, 148,
      150, 151, 154, 156, 159, 163, 164]],
    [4, [33, 38, 94, 165]],
  ] as const)('pins every explicit member of grammar %i', (group, ids) => {
    const s = new BattleState();
    for (const id of ids) { s.wMoveGrammar = id; getMoveGrammar(s); expect(s.wMoveGrammar, `move ${id}`).toBe(group); }
  });
  it.each([14, 105, 117, 1, 33])('selects grammar roots and endings for ID %i, with obedience override', id => {
    const [s] = rig(id); const handlers = usedMoveTextHandlers(s);
    const input = { label: '', column: 7, row: 16 };
    const first = handlers.UsedMoveText(input);
    expect(first).toBe(s.wMoveGrammar < 3 ? 'UsedMove2Text' : 'UsedMove1Text');
    expect(handlers.MoveNameText(input)).toBe(`EndUsedMove${s.wMoveGrammar + 1}Text`);
    expect(handlers.UsedMove1Text(input)).toBe('MoveNameText');
    expect(handlers.UsedMove2Text(input)).toBe('MoveNameText');
    s.wMonIsDisobedient = 1;
    expect(handlers.UsedMoveText(input)).toBe('UsedMove2Text');
    for (const key of ['UsedMove1Text', 'UsedMove2Text'])
      expect(handlers[key](input)).toBe('UsedMoveText_CheckObedience.UsedInsteadText');
    expect(handlers['UsedMoveText_CheckObedience.UsedInsteadText'](input)).toBe('MoveNameText');
  });
});

describe('committed used-move programs over BattleHost', () => {
  it.each([0, 1])('places the live actor and name on side %i, updating UsedMove at its ASM op only', turn => {
    const [s, host] = rig(28, turn);
    s.wPlayerUsedMove = 7; s.wEnemyUsedMove = 8;
    host.start(displayUsedMoveText(s, host));
    expect([s.wPlayerUsedMove, s.wEnemyUsedMove]).toEqual([7, 8]);
    const frames = drive(host);
    expect(host.video.textBox.textReturn).toBe('returned');
    expect(row(host, 14)).toContain(turn === 0 ? 'PIKA' : 'Enemy RHYDON');
    expect(row(host, 16)).toContain('used SAND-ATTACK!');
    expect([s.wPlayerUsedMove, s.wEnemyUsedMove]).toEqual(turn === 0 ? [28, 8] : [7, 28]);
    expect(frames.every(frame => frame === 'serviced')).toBe(true);
  });
  it.each([14, 105, 117, 1, 33])('runs grammar ID %i through its real extracted ending', id => {
    const [s, host] = rig(id); const calls: string[] = [];
    const handlers = usedMoveTextHandlers(s);
    for (const [label, handler] of Object.entries(handlers)) handlers[label] = input => { calls.push(label); return handler(input); };
    host.start(host.printText('UsedMoveText', { stringBuffer: id === 14 ? 'SWORDS DANCE' : 'POUND' }, { asm: handlers }));
    drive(host); expect(host.video.textBox.textReturn).toBe('returned');
    expect(calls).toEqual(['UsedMoveText', s.wMoveGrammar < 3 ? 'UsedMove2Text' : 'UsedMove1Text', 'MoveNameText']);
    expect(row(host, 16).match(/!/g)).toHaveLength(1);
  });
  it.each([0, 1])('disobedient side %i prints instead, and continues through the fourth body', turn => {
    const [s, host] = rig(33, turn); s.wMonIsDisobedient = 1;
    const calls: string[] = []; const handlers = usedMoveTextHandlers(s);
    for (const [label, handler] of Object.entries(handlers)) handlers[label] = input => { calls.push(label); return handler(input); };
    host.start(host.printText('UsedMoveText', { stringBuffer: 'TACKLE' }, { asm: handlers }));
    drive(host);
    expect(calls).toEqual(['UsedMoveText', 'UsedMove2Text', 'UsedMoveText_CheckObedience.UsedInsteadText', 'MoveNameText']);
    expect([row(host, 14), row(host, 16)].join(' ')).toContain('instead,');
    expect(row(host, 16)).toContain('TACKLE!');
  });
  it('the selected ! overwrites the ROM fallthrough ! in the same cell without another PrintText', () => {
    const [s, host] = rig(33); const writes: { column: number; row: number }[] = [];
    const original = TextScreen.prototype.placeString;
    vi.spyOn(TextScreen.prototype, 'placeString').mockImplementation(function* (this: TextScreen, text, noDelay, actors) {
      if (text.startsWith('!')) writes.push(this.bc());
      return yield* original.call(this, text, noDelay, actors);
    });
    const print = vi.spyOn(host, 'printText');
    host.start(displayUsedMoveText(s, host)); drive(host);
    expect(writes).toEqual([{ column: 12, row: 16 }, { column: 12, row: 16 }]);
    expect(row(host, 16)).toBe('used TACKLE!'); expect(print).toHaveBeenCalledTimes(1);
  });
  it('bindings and host actors stay live during the print; no handler registration leaks', () => {
    const [s, host] = rig(33); host.start(displayUsedMoveText(s, host));
    s.hWhoseTurn = 1; s.wEnemySelectedMove = 38; getCurrentMove(s);
    s.setBytes(A.wEnemyMonNick, encodeText('FOE@'), 11);
    drive(host);
    expect(row(host, 14)).toContain('Enemy FOE'); expect(row(host, 16)).toContain('used DOUBLE-EDGE!');
    host.start(host.printText('UsedMoveText')); drive(host);
    expect(host.video.textBox.textReturn).toBe('asm');
  });
  it('the real player announcement finishes text before spending the original slot PP', () => {
    const [s, host] = rig(33); s.wPlayerMoveListIndex = 1; s.mem[A.wBattleMonPP + 1] = 5;
    host.start(announceMove(s, host));
    expect(s.mem[A.wBattleMonPP + 1]).toBe(5); drive(host);
    expect(s.mem[A.wBattleMonPP + 1]).toBe(4);
  });
});
