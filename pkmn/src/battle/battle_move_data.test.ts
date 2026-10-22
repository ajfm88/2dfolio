import { beforeAll, describe, expect, it, vi } from 'vitest';
import { A, BattleState, encodeText, PARTYMON_STRUCT_LENGTH } from './battle_state';
import { BattleUnsupportedState, getCurrentMove, loadBattleMoveData, moveNameBinding, reloadMoveData } from './battle_move_data';
import { announceMove, type BattleTurnTextHost } from './battle_turn_text';

beforeAll(loadBattleMoveData);

describe('big-endian battle union words', () => {
  it.each([
    ['wPlayerBideAccumulatedDamage', A.wPlayerNumHits],
    ['wEnemyBideAccumulatedDamage', A.wEnemyNumHits],
    ['wExpAmountGained', A.wStringBuffer],
  ] as const)('%s reads and writes high first, including overflow', (word, addr) => {
    const s = new BattleState();
    s.mem[addr] = 0x12; s.mem[addr + 1] = 0x34;
    expect(s[word]).toBe(0x1234);
    s[word] = 0x1abcd;
    expect([...s.mem.slice(addr, addr + 2)]).toEqual([0xab, 0xcd]);
    expect(s[word]).toBe(0xabcd);
  });
});

describe('move records and cartridge names', () => {
  it.each([0, 1])('GetCurrentMove selects only side %i, copies exactly six bytes and preserves PP', turn => {
    const s = new BattleState(); s.hWhoseTurn = turn;
    s.wPlayerSelectedMove = 28; s.wEnemySelectedMove = 94;
    s.mem.fill(0xa5, A.wEnemyMoveNum - 1, A.wPlayerMoveMaxPP + 2);
    s.mem.fill(0xbb, A.wStringBuffer, A.wStringBuffer + 20);
    s.mem[A.wBattleMonPP] = 9; s.mem[A.wEnemyMonPP] = 7;
    getCurrentMove(s);
    const addr = turn === 0 ? A.wPlayerMoveNum : A.wEnemyMoveNum;
    expect([...s.mem.slice(addr, addr + 6)]).toEqual(turn === 0 ? [28, 22, 0, 0, 255, 15] : [94, 71, 90, 24, 255, 10]);
    const other = turn === 0 ? A.wEnemyMoveNum : A.wPlayerMoveNum;
    expect([...s.mem.slice(other, other + 6)]).toEqual(Array(6).fill(0xa5));
    expect([s.mem[A.wEnemyMoveNum - 1], s.mem[A.wPlayerMoveMaxPP + 1]]).toEqual([0xa5, 0xa5]);
    expect([s.wNameListIndex, s.wNamedObjectIndex, s.wNameListType, s.wPredefBank]).toEqual([turn === 0 ? 28 : 94, turn === 0 ? 28 : 94, 2, 0x2f]);
    const name = turn === 0 ? 'SAND-ATTACK' : 'PSYCHIC';
    expect(moveNameBinding(s)).toBe(name);
    expect([...s.mem.slice(A.wStringBuffer, A.wStringBuffer + name.length + 1)]).toEqual(encodeText(`${name}@`));
    expect(s.mem[A.wStringBuffer + name.length + 1]).toBe(0xbb);
    expect([s.mem[A.wBattleMonPP], s.mem[A.wEnemyMonPP]]).toEqual([9, 7]);
  });
  it('GetName copies 20 bytes across following names; CopyString copies only through @', () => {
    const s = new BattleState(); s.wPlayerSelectedMove = 1;
    getCurrentMove(s);
    expect([...s.mem.slice(A.wNameBuffer, A.wNameBuffer + 20)]).toEqual(encodeText('POUND@KARATE CHOP@DO'));
    expect([...s.mem.slice(A.wStringBuffer, A.wStringBuffer + 6)]).toEqual(encodeText('POUND@'));
  });
  it.each([
    [3, [3, 29, 15, 0, 216, 10]],
    [57, [57, 0, 95, 21, 255, 15]],
    [165, [165, 48, 50, 0, 255, 10]],
  ] as const)('loads raw accuracy/type/effect for move %i', (id, bytes) => {
    const s = new BattleState(); s.wPlayerSelectedMove = id; getCurrentMove(s);
    expect([...s.mem.slice(A.wPlayerMoveNum, A.wPlayerMoveNum + 6)]).toEqual(bytes);
    if (id === 165) expect([...s.mem.slice(A.wNameBuffer, A.wNameBuffer + 20)])
      .toEqual([...encodeText('STRUGGLE@'), ...Array(11).fill(0)]);
  });
  it('supports every committed legal ID and every display-name glyph', () => {
    const s = new BattleState();
    for (let id = 1; id <= 165; id++) {
      s.wPlayerSelectedMove = id; getCurrentMove(s);
      expect(s.wPlayerMoveNum).toBe(id); expect(moveNameBinding(s).length).toBeGreaterThan(0);
    }
  });
  it.each([0, 166])('rejects unsupported ID %i in either entry without mutating state', id => {
    for (const turn of [0, 1]) {
      const s = new BattleState(); s.hWhoseTurn = turn;
      s.wPlayerSelectedMove = id; s.wEnemySelectedMove = id;
      const before = s.mem.slice();
      expect(() => getCurrentMove(s)).toThrow(BattleUnsupportedState);
      expect(() => reloadMoveData(s, id)).toThrow(`unsupported move id ${id}`);
      expect(s.mem).toEqual(before);
    }
  });
  it('reports missing initialization separately from a cartridge state error', async () => {
    vi.resetModules(); const fresh = await import('./battle_move_data');
    const s = new BattleState(); s.wPlayerSelectedMove = 1;
    expect(() => fresh.getCurrentMove(s)).toThrow('battle move data not loaded');
  });
  it.each([-1, 1.5, NaN])('reload rejects non-byte ID %s', id => {
    expect(() => reloadMoveData(new BattleState(), id)).toThrow(BattleUnsupportedState);
  });
  it('reports a failed committed-name fetch', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: false, status: 404 } as Response);
    await expect(loadBattleMoveData()).rejects.toThrow('move names: HTTP 404'); fetcher.mockRestore();
  });
  it('rejects an unsupported glyph in a raw move-name binding', () => {
    const s = new BattleState(); s.mem[A.wStringBuffer] = 1;
    expect(() => moveNameBinding(s)).toThrow(BattleUnsupportedState);
  });
});

describe('the PP call sites compose existing ports', () => {
  const fake: BattleTurnTextHost = { printText: function* () { yield 'serviced'; } };
  it.each([0, 1])('reload increments the original side %i slot in both copies, even transformed', turn => {
    const s = new BattleState(); s.hWhoseTurn = turn;
    s.wPlayerMoveListIndex = 2; s.wEnemyMoveListIndex = 1;
    s.wPlayerMonNumber = 1; s.wEnemyMonPartyPos = 2; s.wPlayerBattleStatus3 = 8;
    const battle = turn === 0 ? A.wBattleMonPP + 2 : A.wEnemyMonPP + 1;
    const party = turn === 0 ? A.wPartyMons + PARTYMON_STRUCT_LENGTH + 31 : A.wEnemyMons + 2 * PARTYMON_STRUCT_LENGTH + 30;
    s.mem[battle] = 255; s.mem[party] = 255;
    s.wPlayerSelectedMove = 118; s.wEnemySelectedMove = 119;
    reloadMoveData(s, 38);
    expect([s.mem[battle], s.mem[party]]).toEqual([0, 0]);
    expect(moveNameBinding(s)).toBe('DOUBLE-EDGE');
    expect([s.wPlayerSelectedMove, s.wEnemySelectedMove, s.wPlayerUsedMove, s.wEnemyUsedMove]).toEqual([118, 119, 0, 0]);
    expect(s.mem[turn === 0 ? A.wPlayerMoveNum : A.wEnemyMoveNum]).toBe(38);
  });
  it.each([false, true])('announces before decrementing original slot, transformed=%s', transformed => {
    const s = new BattleState(); s.wPlayerSelectedMove = 33; s.wPlayerMoveListIndex = 2;
    s.wPlayerBattleStatus3 = transformed ? 8 : 0;
    s.setBytes(A.wBattleMonMoves, [33, 33, 33, 0], 4);
    s.setBytes(A.wBattleMonPP, [7, 8, 0, 0], 4);
    s.setBytes(A.wPartyMons + 29, [7, 8, 0, 0], 4);
    const p = announceMove(s, fake); expect(p.next().value).toBe('serviced');
    expect(s.mem[A.wBattleMonPP + 2]).toBe(0);
    expect(p.next().done).toBe(true);
    expect([...s.mem.slice(A.wBattleMonPP, A.wBattleMonPP + 4)]).toEqual([7, 8, 255, 0]);
    expect(s.mem[A.wPartyMons + 31]).toBe(transformed ? 0 : 255);
  });
  it.each([0, 1, 2, 4, 0x100])('keeps DecrementPP guard %i at the announcement call site', guard => {
    const s = new BattleState(); s.wPlayerSelectedMove = guard === 0 ? 165 : 33;
    s.wPlayerBattleStatus1 = guard & 0xff; s.wPlayerBattleStatus2 = guard === 0x100 ? 0x40 : 0;
    s.mem[A.wBattleMonPP] = 5;
    const p = announceMove(s, fake); p.next(); p.next(); expect(s.mem[A.wBattleMonPP]).toBe(5);
  });
  it('enemy announcement clears disobedience and never decrements either enemy PP copy', () => {
    const s = new BattleState(); s.hWhoseTurn = 1; s.wMonIsDisobedient = 1;
    s.mem[A.wEnemyMonPP] = 0; s.mem[A.wEnemyMons + 29] = 9;
    const p = announceMove(s, fake); p.next(); expect(s.wMonIsDisobedient).toBe(0); p.next();
    expect([s.mem[A.wEnemyMonPP], s.mem[A.wEnemyMons + 29]]).toEqual([0, 9]);
    expect([s.mem[A.wBattleMonPP], s.mem[A.wPartyMons + 29]]).toEqual([0, 0]);
  });
});
