import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { isHeld } from '../input';
import { loadTextPrograms } from '../text/program_data';
import { initTextSystem, setTextSpeed } from '../text/textbox';
import { textBgTransfer } from '../text/bg_transfer';
import { BattleHost } from './battle_host';
import { printMoveFailureText, printCriticalOHKOText, printDoesntAffectText, displayEffectiveness,
  attackSubstitute, type ApplyPorts } from './battle_apply';
import type { Frame, Program } from './battle_menu_context';
import { hpRig } from '../test/battle_hp_rig';

beforeAll(async () => { await loadTextPrograms(); await initTextSystem(); });
beforeEach(() => {
  vi.clearAllMocks(); setTextSpeed('fast'); textBgTransfer.enabled = true; textBgTransfer.resetPortion();
});
afterEach(() => vi.restoreAllMocks());

function drive(host: BattleHost): Frame[] {
  const frames: Frame[] = []; let down = false;
  for (let i = 0; !host.done && i < 3000; i++) {
    down = host.video.textBox.isWaitingForInput ? !down : false;
    vi.mocked(isHeld).mockImplementation(key => down && key === 'b');
    frames.push(host.step()!);
  }
  expect(host.done).toBe(true); return frames;
}

for (const side of [0, 1] as const) {
  it.each([
    ['immune', 'DoesntAffectMonText', "doesn't affect"], ['unaffected', 'UnaffectedText', 'unaffected'],
    ['miss', 'AttackMissedText', 'missed'], ['critical', 'CriticalHitText', 'Critical hit!'],
    ['ohko', 'OHKOText', 'One-hit KO!'], ['super', 'SuperEffectiveText', 'super effective!'],
    ['weak', 'NotVeryEffectiveText', 'not very effective'], ['direct', 'DoesntAffectMonText', "doesn't affect"],
  ])(`committed %s root runs through the text runner, actor ${side}`, (kind, label, phrase) => {
    const r = hpRig(side), s = r.s, host = new BattleHost(s);
    const ports: ApplyPorts = { substituteBreak: function* () {}, shake: function* () {} };
    s.wDamageMultipliers = kind === 'immune' ? 0 : kind === 'weak' ? 5 : 20;
    s.wCriticalHitOrOHKO = kind === 'unaffected' ? 255 : kind === 'critical' ? 1 : kind === 'ohko' ? 2 : 0;
    const print = vi.spyOn(host, 'printText');
    let p: Program;
    if (kind === 'critical' || kind === 'ohko') p = printCriticalOHKOText(s, host);
    else if (kind === 'super' || kind === 'weak') p = displayEffectiveness(s, host);
    else if (kind === 'direct') p = printDoesntAffectText(host);
    else p = printMoveFailureText(s, host.video.screen, host, ports);
    host.start(p); const frames = drive(host);
    expect(print).toHaveBeenCalledWith(label);
    const text = [14, 16].map(y => Array.from({ length: 18 }, (_, x) =>
      String(host.video.screen.at(x + 1, y) ?? ' ')).join('')).join(' ').replace(/\s+/g, ' ');
    expect(text).toContain(phrase);
    if (kind === 'immune' || kind === 'direct' || kind === 'unaffected')
      expect(text).toContain(side === 0 ? 'Enemy FOE' : 'PIKA');
    if (kind === 'miss') expect(text).toContain(side === 0 ? 'PIKA' : 'Enemy FOE');
    expect(host.video.textBox.textReturn).toBe('returned');
    expect(frames.every(frame => frame === 'serviced')).toBe(true);
    if (kind === 'critical' || kind === 'ohko') expect(frames.slice(-20)).toEqual(Array(20).fill('serviced'));
  });
  it('committed Substitute took/broke text, break presentation and HUD frames are ordered', () => {
    const r = hpRig(side), s = r.s, host = new BattleHost(s), events: string[] = [];
    s.wDamage = 256; s.wPlayerBattleStatus2 = 0x10; s.wEnemyBattleStatus2 = 0x10;
    const print = vi.spyOn(host, 'printText');
    const ports: ApplyPorts = {
      substituteBreak: function* (state) { events.push(`break:${state.hWhoseTurn}`); yield 'held'; },
      shake: function* () {},
    };
    host.start(attackSubstitute(s, host.video.screen, host, ports));
    const frames = drive(host);
    expect(print.mock.calls.map(call => call[0])).toEqual(['SubstituteTookDamageText', 'SubstituteBrokeText']);
    expect(events).toEqual([`break:${side ^ 1}`]); expect(s.hWhoseTurn).toBe(side);
    expect(frames[frames.length - 1]).toBe('held');
    expect([host.video.screen.at(10, 9), host.video.screen.at(2, 2)]).toEqual([0x71, 0x71]);
  });
  it('committed crash text precedes shake, then own HP changes', () => {
    const r = hpRig(side), s = r.s, host = new BattleHost(s), events: string[] = [];
    s.wDamage = 0; s.wDamageMultipliers = 10;
    if (side === 0) s.wPlayerMoveEffect = 0x2d; else s.wEnemyMoveEffect = 0x2d;
    const print = vi.spyOn(host, 'printText');
    const ports: ApplyPorts = {
      substituteBreak: function* () {},
      shake: function* (state, b) {
        events.push(`shake:${state.hWhoseTurn}:${b}:${state.readBE(r.c.hp)}`);
        const text = Array.from({ length: 18 }, (_, x) => String(host.video.screen.at(x + 1, 16) ?? ' ')).join('');
        expect(text).toContain('crashed!'); yield 'held';
      },
    };
    host.start(printMoveFailureText(s, host.video.screen, host, ports)); drive(host);
    expect(print.mock.calls.map(call => call[0])).toEqual(['AttackMissedText', 'KeptGoingAndCrashedText']);
    expect(events).toEqual([`shake:${side}:4:100`]); expect(s.readBE(r.c.hp)).toBe(99);
    expect(s.readBE(r.c.opposite)).toBe(100);
  });
}
