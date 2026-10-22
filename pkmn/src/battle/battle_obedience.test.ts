import { beforeAll, describe, expect, it } from 'vitest';
import { A, LINK_STATE_BATTLING, PARTYMON_STRUCT_LENGTH } from './battle_state';
import { BattleUnsupportedState, loadBattleMoveData, moveNameBinding } from './battle_move_data';
import { checkForDisobedience } from './battle_obedience';
import { loadTextPrograms } from '../text/program_data';
import { collect, statusRig } from '../test/battle_status_rig';

beforeAll(async () => { await loadBattleMoveData(); await loadTextPrograms(); });
function traded(level = 50) {
  const r = statusRig(); r.s.wPlayerMonNumber = 1;
  r.s.writeBE(A.wPlayerID, 0x1234); r.s.writeBE(A.wPartyMon1OTID + PARTYMON_STRUCT_LENGTH, 0xabcd);
  r.s.wBattleMonLevel = level; r.s.wMonIsDisobedient = 9;
  r.s.setBytes(A.wBattleMonMoves, [33, 45, 0, 0], 4);
  r.s.setBytes(A.wBattleMonPP, [5, 5, 0, 0], 4);
  r.s.wMaxMenuItem = 3; r.s.wCurrentMenuItem = 0; r.s.wPlayerMoveListIndex = 0;
  return { ...r, run: () => collect(checkForDisobedience(r.s, r.host, r.ports)) };
}

describe('OT IDs, link and Yellow badge caps', () => {
  it('uses the exact WRAM addresses and the active party OT word, without comparing names', () => {
    expect([A.wObtainedBadges, A.wPlayerID, A.wPartyMon1OTID]).toEqual([0xd355, 0xd358, 0xd176]);
    const r = traded(255); r.s.writeBE(A.wPartyMon1OTID + PARTYMON_STRUCT_LENGTH, 0x1234);
    expect(r.run()).toEqual({ result: 'canUseMove', frames: [] }); expect(r.s.wMonIsDisobedient).toBe(0);
  });
  it('link obeys before OT/level/RNG, clearing disobedience', () => {
    const r = traded(255); r.s.wLinkState = LINK_STATE_BATTLING;
    expect(r.run().result).toBe('canUseMove'); expect(r.s.wMonIsDisobedient).toBe(0); expect(r.events).toEqual([]);
  });
  it.each([0x1235, 0x2234])('both OT bytes matter (%i differs), and other party slots cannot authorize', id => {
    const r = traded(); r.s.writeBE(A.wPartyMon1OTID, 0x1234);
    r.s.writeBE(A.wPartyMon1OTID + PARTYMON_STRUCT_LENGTH, id); const roll = r.rolls(0x90);
    expect(r.run().result).toBe('canUseMove'); expect(roll).toHaveBeenCalledTimes(1);
  });
  it.each([[0, 10], [2, 30], [8, 50], [32, 70], [128, 101], [255, 101], [0x2a, 70], [0x0a, 50]] as const)
  ('badges%i permit the cap%i and below without RNG, but above enters sampling', (badges, cap) => {
    for (const level of [cap - 1, cap]) {
      const r = traded(level); r.s.wObtainedBadges = badges;
      expect(r.run().result).toBe('canUseMove'); expect(r.events).toEqual([]);
    }
    const r = traded(cap + 1); r.s.wObtainedBadges = badges; const random = r.rolls(0);
    expect(r.run().result).toBe('canUseMove'); expect(random).toHaveBeenCalledTimes(1);
  });
  it('unrelated badge bits keep cap10', () => {
    const r = traded(11); r.s.wObtainedBadges = 0x55; const random = r.rolls(0);
    expect(r.run().result).toBe('canUseMove'); expect(random).toHaveBeenCalledTimes(1);
  });
});

describe('disobedience random decisions in cartridge order', () => {
  it('first sample SWAPs the same draw once, rejects >=bound, obeys below cap', () => {
    const r = traded(); const random = r.rolls(255, 0xc3, 0x90); // swapped255,60 reject;9 obeys.
    expect(r.run().result).toBe('canUseMove'); expect(random).toHaveBeenCalledTimes(3);
    expect(r.texts).toEqual([]); expect(r.s.wMonIsDisobedient).toBe(0);
  });
  it('first sample equal to cap does not obey, then second sample is not SWAPped', () => {
    const r = traded(); const random = r.rolls(0xa0, 1, 1); // swap10; raw1<10; slot1.
    expect(r.run().result).toBe('canUseMove'); expect(random).toHaveBeenCalledTimes(3);
    expect(r.s.wPlayerSelectedMove).toBe(45); expect(r.s.wMonIsDisobedient).toBe(1);
  });
  it('second sample rejects the exact bound; equal cap goes to the third decision', () => {
    const r = traded(); const random = r.rolls(0xa0, 60, 10, 5, 2);
    expect(r.run().result).toBe('cannotUseMove'); expect(r.texts).toEqual(['TurnedAwayText']);
    expect(random).toHaveBeenCalledTimes(5);
  });
  it('level+cap saturates at255 before the rejection tests', () => {
    const r = traded(250); r.s.wObtainedBadges = 128; const random = r.rolls(255, 0);
    expect(r.run().result).toBe('canUseMove'); expect(random).toHaveBeenCalledTimes(2);
  });
  it('nap uses unsigned borrow, then byte ADD/SWAP/&7 with zero retries, overwriting status', () => {
    const r = traded(); r.s.wBattleMonStatus = 64;
    const random = r.rolls(0xa0, 10, 0, 0, 0x80, 8);
    expect(r.run()).toEqual({ result: 'cannotUseMove', frames: [] });
    expect(r.s.wBattleMonStatus).toBe(1); expect(r.texts).toEqual(['BeganToNapText']);
    expect(random).toHaveBeenCalledTimes(6); expect(r.s.wMonIsDisobedient).toBe(0);
  });
  it('an unsigned positive remainder above127 ignores, rather than treating it as a negative nap', () => {
    const r = traded(); r.rolls(0xa0, 10, 0x8c, 0); // swapped200 -40 =160, unsigned >=40.
    expect(r.run().result).toBe('cannotUseMove'); expect(r.texts).toEqual(['LoafingAroundText']);
  });
  it.each([1, 2, 3, 4, 5, 6, 7])('nap duration%i comes from ADD/SWAP/&7', duration => {
    const r = traded(); r.rolls(0xa0, 10, 0, duration * 8);
    expect(r.run().result).toBe('cannotUseMove'); expect(r.s.wBattleMonStatus).toBe(duration);
  });
  it.each([0, 1, 2, 3])('ignore text%i consumes a fresh masked draw', index => {
    const r = traded(); const random = r.rolls(0xa0, 10, 5, 0xfc | index);
    expect(r.run().result).toBe('cannotUseMove');
    expect(r.texts).toEqual([['LoafingAroundText', 'WontObeyText', 'TurnedAwayText', 'IgnoredOrdersText'][index]]);
    expect(random).toHaveBeenCalledTimes(4);
  });
  it.each([[39, 'BeganToNapText'], [40, 'WontObeyText'], [79, 'WontObeyText'], [80, 'LoafingAroundText']] as const)
  ('third swapped roll%i selects %s at exact difference boundaries', (value, text) => {
    const r = traded(); const raw = ((value << 4) | (value >> 4)) & 255;
    r.rolls(...(value < 40 ? [0xa0, 10, raw, 8] : value >= 80 ? [0xa0, 10, raw, 0] : [0xa0, 10, raw]));
    expect(r.run().result).toBe('cannotUseMove'); expect(r.texts[0]).toBe(text);
    expect(r.events.includes('apply:0')).toBe(value >= 40 && value < 80);
  });
  it('disobedient self-hit uses the shared fake math/application and does not cancel multi-turn flags', () => {
    const r = traded(); r.s.wPlayerBattleStatus1 = 0x73; r.s.wPlayerMoveEffect = 0x2b;
    r.rolls(0xa0, 10, 0x82); // third swap40 => self-hit.
    expect(r.run().frames).toEqual(Array(3).fill('serviced'));
    expect(r.events).toEqual(['random:160', 'random:10', 'random:130', 'text:WontObeyText', 'text:HurtItselfText',
      'calc:0', 'anim:1:1', 'hud:1', 'apply:0']);
    expect(r.s.wPlayerBattleStatus1).toBe(0x73); expect(r.s.wMonIsDisobedient).toBe(0);
    expect(r.s.wPlayerMoveEffect).toBe(0x2b); expect(r.s.hWhoseTurn).toBe(0);
  });
});

describe('alternate move keeps original PP slot and raw bytes', () => {
  it.each(['only move', 'disabled', 'Struggle', 'only one masked PP'] as const)('ineligible: %s goes to ignore with its draw', reason => {
    const r = traded();
    if (reason === 'only move') r.s.mem[A.wBattleMonMoves + 1] = 0;
    if (reason === 'disabled') r.s.wPlayerDisabledMoveNumber = 45;
    if (reason === 'Struggle') r.s.wPlayerSelectedMove = 165;
    if (reason === 'only one masked PP') r.s.setBytes(A.wBattleMonPP, [0x85, 0x40, 0x80, 0xc0], 4);
    const random = r.rolls(0xa0, 0, 2);
    expect(r.run().result).toBe('cannotUseMove'); expect(r.texts).toEqual(['TurnedAwayText']);
    expect(random).toHaveBeenCalledTimes(3); expect(r.s.wMonIsDisobedient).toBe(0);
  });
  it('rerolls max/original/empty slots, writes attempted cursor before raw PP test, and keeps original C', () => {
    const r = traded(); let count = 0;
    const bytes = [0xa0, 0, 3, 0, 2, 0, 1];
    r.s.random = () => {
      if (count === 3 || count === 4) expect(r.s.wCurrentMenuItem).toBe(0);
      if (count === 5 || count === 6) expect(r.s.wCurrentMenuItem).toBe(2);
      return bytes[count++];
    };
    expect(r.run().result).toBe('canUseMove'); expect(count).toBe(7);
    expect([r.s.wPlayerSelectedMove, r.s.wCurrentMenuItem, r.s.wPlayerMoveListIndex, r.s.wMonIsDisobedient]).toEqual([45, 1, 0, 1]);
    expect(r.s.wPlayerMoveNum).toBe(45); expect(moveNameBinding(r.s)).toBe('GROWL');
    expect([...r.s.mem.slice(A.wBattleMonPP, A.wBattleMonPP + 4)]).toEqual([5, 5, 0, 0]); expect(r.texts).toEqual([]);
  });
  it('raw PP-Up-only byte is selectable when another slot supplies masked PP', () => {
    const r = traded(); r.s.setBytes(A.wBattleMonMoves, [33, 45, 46, 0], 4);
    r.s.setBytes(A.wBattleMonPP, [5, 0x40, 1, 0], 4); r.s.wMaxMenuItem = 4;
    r.rolls(0xa0, 0, 1); expect(r.run().result).toBe('canUseMove'); expect(r.s.wPlayerSelectedMove).toBe(45);
    expect(r.s.mem[A.wBattleMonPP + 1]).toBe(0x40);
  });
  it('masked PP in slot3 makes an alternate possible; selected PP-Up bits do not enter the sum', () => {
    const r = traded(); r.s.setBytes(A.wBattleMonMoves, [33, 45, 46, 1], 4);
    r.s.setBytes(A.wBattleMonPP, [0x85, 0x40, 0, 1], 4); r.s.wMaxMenuItem = 5;
    r.rolls(0xa0, 0, 1); expect(r.run().result).toBe('canUseMove');
    expect(r.s.wPlayerSelectedMove).toBe(45);
  });
  it('slot0 is a valid accepted result, with masked candidate index and original index untouched', () => {
    const r = traded(); r.s.wCurrentMenuItem = 1; r.s.wPlayerMoveListIndex = 1; r.s.wPlayerSelectedMove = 45;
    r.rolls(0xa0, 0, 0xfc);
    expect(r.run().result).toBe('canUseMove'); expect([r.s.wPlayerSelectedMove, r.s.wPlayerMoveListIndex, r.s.wCurrentMenuItem]).toEqual([33, 1, 0]);
  });
});

describe('256 actual-draw retry guards', () => {
  it.each(['first', 'second', 'nap', 'alternate'] as const)('%s loop throws before a257th attempt', phase => {
    const r = traded();
    const prefix = phase === 'first' ? [] : phase === 'second' ? [0xa0] : phase === 'nap' ? [0xa0, 10, 0] : [0xa0, 0];
    const bad = phase === 'first' || phase === 'second' ? 255 : 0;
    const random = r.rolls(...prefix, ...Array(256).fill(bad));
    expect(() => r.run()).toThrow(BattleUnsupportedState); expect(random).toHaveBeenCalledTimes(prefix.length + 256);
  });
  it('accepts a successful256th draw, without a257th draw or a phantom RNG step', () => {
    const r = traded(); const random = r.rolls(...Array(255).fill(255), 0);
    expect(r.run().result).toBe('canUseMove'); expect(random).toHaveBeenCalledTimes(256);
  });
  it('each separate rejection loop has its own256-draw limit', () => {
    const r = traded(); const random = r.rolls(...Array(255).fill(255), 0xa0, ...Array(255).fill(255), 1, 1);
    expect(r.run().result).toBe('canUseMove'); expect(random).toHaveBeenCalledTimes(513);
  });
  it('preserves earlier text and injected port frame kinds across disobedient self-hit', () => {
    const r = traded(); r.rolls(0xa0, 10, 0x82);
    r.ports.calculateSelfHit = function* () { yield 'held'; };
    r.ports.applySelfHit = function* () { yield 'session'; };
    expect(r.run().frames).toEqual(['held', 'serviced', 'serviced', 'serviced', 'session']);
  });
});
