import { describe, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn() }));
import { BattleHost } from './battle_host';
import { BattleMenuScreen } from './battle_menu_screen';
import { BattleRandomState } from './battle_random_state';
import { BattleState } from './battle_state';
import type { Program } from './battle_menu_context';
import { mainOwnsRandom } from './battle_vblank_owner';

describe('VBlank Random ownership', () => {
  it('assigns session and transition frames to main without duplicating host or held frames', () => {
    expect(mainOwnsRandom('session', false, false)).toBe(true);
    expect(mainOwnsRandom(null, false, false)).toBe(true);
    for (const frame of ['serviced', 'held', 'dark'] as const) expect(mainOwnsRandom(frame, false, false)).toBe(false);
    expect(mainOwnsRandom('session', true, false)).toBe(false);
    expect(mainOwnsRandom(null, false, true)).toBe(false);
  });
  it('runs between video and audio on serviced frames only, using TrackPlayTime carry', () => {
    const events: string[] = [], state = new BattleState();
    const owner = new BattleRandomState(() => 0); owner.hRandomAdd = 7; owner.hRandomSub = 9;
    owner.attach(state);
    const video = new BattleMenuScreen();
    vi.spyOn(video, 'vblank').mockImplementation(() => { events.push('video'); });
    const host = new BattleHost(state, video, () => events.push('audio'), () => {
      events.push('random'); owner.vblank(1);
    });
    host.start((function* (): Program { yield 'serviced'; yield 'held'; yield 'dark'; yield 'session'; })());
    host.step(); expect(events).toEqual(['video', 'random', 'audio']);
    expect([state.hRandomAdd, state.hRandomSub]).toEqual([8, 9]);
    host.step(); host.step(); host.step();
    expect(events).toEqual(['video', 'random', 'audio']);
    expect([state.hRandomAdd, state.hRandomSub]).toEqual([8, 9]);
    owner.detach(state);
    expect([owner.hRandomAdd, owner.hRandomSub]).toEqual([8, 9]);
    owner.vblank(0); expect([owner.hRandomAdd, owner.hRandomSub]).toEqual([8, 9]);
  });

  it('uses the shared DIV and attached bytes across the transition and detach', () => {
    let div = 3;
    const owner = new BattleRandomState(() => div), state = new BattleState();
    owner.hRandomAdd = 250; owner.hRandomSub = 20;
    owner.vblank(0); expect([owner.hRandomAdd, owner.hRandomSub]).toEqual([253, 17]);
    owner.attach(state); div = 4;
    owner.vblank(1); expect([state.hRandomAdd, state.hRandomSub]).toEqual([2, 12]);
    owner.detach(state); div = 2;
    owner.vblank(0); expect([owner.hRandomAdd, owner.hRandomSub]).toEqual([4, 10]);
  });

  it('reads the caller carry afresh for each serviced frame', () => {
    let carry: 0 | 1 = 0;
    const owner = new BattleRandomState(() => 0), state = new BattleState();
    owner.attach(state);
    const host = new BattleHost(state, new BattleMenuScreen(), () => {}, () => owner.vblank(carry));
    host.start((function* (): Program { yield 'serviced'; yield 'serviced'; })());
    host.step(); expect(state.hRandomAdd).toBe(0);
    carry = 1; host.step(); expect(state.hRandomAdd).toBe(1);
    owner.detach(state);
  });
});
