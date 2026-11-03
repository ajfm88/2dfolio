import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { host, loadMainBattleRig, resetMainBattleRig, tick as mainTick, until, world, mon, row,
  openParty, frameNow } from './test/main_battle_rig';
import { StatusScreenSession, loadStatusScreenAssets } from './menus/status_screen';
import { loadPartyTiles } from './menus/party_tiles';
import { PartyMenu } from './menus/party_menu';
import { A, encodeText } from './battle/battle_state';
import { decodeBattleText } from './battle/battle_text_codec';
import * as sessions from './battle/battle_session';
import * as partyBranch from './battle/battle_party_menu';
import type { GameButton } from './core';

const views: StatusScreenSession[] = [];
let sourceDisabled = false;
const main = host as typeof host & { openStartMenu(): void; partyMenu: PartyMenu };
beforeAll(async () => { await loadMainBattleRig(); await loadStatusScreenAssets(); await loadPartyTiles(); });
beforeEach(() => {
  resetMainBattleRig(); views.length = 0; sourceDisabled = false;
  const frame = StatusScreenSession.prototype.frame;
  vi.spyOn(StatusScreenSession.prototype, 'frame').mockImplementation(function (this: StatusScreenSession, read) {
    if (!views.includes(this)) views.push(this);
    return frame.call(this, read);
  });
  const create = sessions.createBattleSession;
  vi.spyOn(sessions, 'createBattleSession').mockImplementation((world, deps) =>
    create(world, { ...deps, random: sessions.createSessionRandom(() => 4) }));
  const branch = partyBranch.partyMenuOrRockOrRun;
  vi.spyOn(partyBranch, 'partyMenuOrRockOrRun').mockImplementation(function* (ctx, host) {
    // The control follows the same real menu/session/input route, omitting only the new source.
    if (sourceDisabled) host.createStatusScreen = (mon, options) => new StatusScreenSession(mon, options);
    return yield* branch(ctx, host);
  });
});
afterEach(() => { host.reset(); vi.restoreAllMocks(); });
function wait(frames: number) { for (let i = 0; i < frames; i++) mainTick(); }
function press(key: GameButton) { for (let i = 0; i < 8; i++) mainTick([key]); wait(12); }
function text(view: StatusScreenSession, shown = false): string {
  return Array.from({ length: 10 }, (_, x) => (shown ? view.tiles.visibleAt(9 + x, 1) : view.tiles.at(9 + x, 1)) ?? ' ').join('').trimEnd();
}
async function battle() {
  await world('Route22', 5, 5, [mon(29, 20), mon(32, 20)]);
  host.startBattle(mon(19, 4)); until(() => host.state === 'battle');
  until(() => row(14).includes('FIGHT') && !host.session!.video.textBox.active); wait(30);
  return host.session!;
}
function stats(slot = 0) {
  openParty(); wait(20);
  if (slot) press('down');
  press('a'); press('down');
  press('a');
  expect(host.session!.foreground).toBe('status');
  wait(32);
  return views[views.length - 1];
}
function page2(view: StatusScreenSession) {
  mainTick(['a']);
  expect(() => host.renderLiveBattle()).not.toThrow();
  wait(3);
  expect(() => host.renderLiveBattle()).not.toThrow();
  expect(text(view, true)).toBe(text(view));
}

it.each([[0, 15, 'NIDORAN♀'], [1, 3, 'NIDORAN♂']] as const)(
  'real main battle STATS slot%i uses internal species%i and renders %s on page2', async (slot, internal, name) => {
    const session = await battle(), view = stats(slot);
    page2(view);
    expect(text(view)).toBe(name);
    expect(session.state.wNamedObjectIndex).toBe(internal);
    expect(decodeBattleText(session.state.mem, A.wNameBuffer)).toBe(name);
  });

it('the source writes only GetMonName cells on the page2 draw frame, leaving page1 and the buffer tail unchanged', async () => {
  const session = await battle();
  openParty(); wait(20); press('a'); press('down');
  // No other battle routine runs while this status screen owns the foreground.
  session.state.setBytes(A.wNameBuffer, Array.from({ length: 20 }, (_, i) => 0x80 + i), 20);
  session.state.wNamedObjectIndex = 0xab;
  const before = session.state.mem.slice();
  press('a'); expect(session.foreground).toBe('status');
  wait(40);
  const view = views[views.length - 1];
  expect(text(view)).toBe('NIDORAN♀');
  expect([...session.state.mem.slice(A.wNameBuffer, A.wNameBuffer + 20)])
    .toEqual([...before.slice(A.wNameBuffer, A.wNameBuffer + 20)]);
  expect(session.state.wNamedObjectIndex).toBe(0xab);
  const beforeDraw = session.state.mem.slice(), at = frameNow();
  mainTick(['a']);
  expect(frameNow()).toBe(at + 1);
  const bytes = encodeText('NIDORAN♀@@@');
  expect(bytes).toHaveLength(11);
  expect([...session.state.mem.slice(A.wNameBuffer, A.wNameBuffer + 11)]).toEqual(bytes);
  expect([...session.state.mem.slice(A.wNameBuffer + 11, A.wNameBuffer + 20)])
    .toEqual([...before.slice(A.wNameBuffer + 11, A.wNameBuffer + 20)]);
  expect(session.state.wNamedObjectIndex).toBe(15);
  const changed = [...session.state.mem.keys()].filter(i => session.state.mem[i] !== beforeDraw[i]);
  expect(changed.length).toBeGreaterThan(0);
  expect(changed.every(i => i === A.wNamedObjectIndex || i >= A.wNameBuffer && i <= A.wNameBuffer + 10)).toBe(true);
  wait(3); expect(text(view, true)).toBe('NIDORAN♀');
});

it('a nicknamed battle mon keeps its page1 nickname and shows the species on page2', async () => {
  await world('Route22', 5, 5, [{ ...mon(29, 20), nickname: 'QUEEN' }, mon(32, 20)]);
  host.startBattle(mon(19, 4)); until(() => host.state === 'battle');
  until(() => row(14).includes('FIGHT') && !host.session!.video.textBox.active); wait(30);
  const view = stats(); expect(text(view)).toBe('QUEEN');
  page2(view); expect(text(view)).toBe('NIDORAN♀');
});

it('real main START → POKéMON → STATS keeps the field page2 NIDORAN-F spelling', async () => {
  await world('Route22', 5, 5, [mon(29, 20)]);
  main.openStartMenu(); wait(35); press('down'); press('a');
  expect(host.state).toBe('party_menu'); wait(35);
  press('a'); press('down'); press('a'); wait(32);
  const view = views[views.length - 1]; expect(view).toBeDefined();
  expect(text(view)).toBe('NIDORAN-F');
  mainTick(['a']); wait(3); main.partyMenu.render();
  expect(text(view, true)).toBe('NIDORAN-F');
});

it('a complete battle with STATS preserves all non-name WRAM, frame counts and pending Pay Day money', async () => {
  async function run(disabled: boolean) {
    resetMainBattleRig(); views.length = 0; sourceDisabled = disabled;
    const session = await battle();
    // Valid accumulated Pay Day total, already waiting to be credited by EndOfBattle.
    session.state.mem[A.wTotalPayDayMoney + 2] = 0x42;
    const trace: { at: number; kind: string; residual: string; names: number[] }[] = [];
    const original = session.tick;
    vi.spyOn(session, 'tick').mockImplementation((...args) => {
      const result = original(...args), bytes = Buffer.from(session.state.mem);
      bytes.fill(0, A.wNameBuffer, A.wNameBuffer + 11); bytes[A.wNamedObjectIndex] = 0;
      trace.push({ at: trace.length, kind: session.foreground,
        residual: createHash('sha256').update(bytes).digest('hex'),
        names: [...session.state.mem.slice(A.wNameBuffer, A.wNameBuffer + 11), session.state.wNamedObjectIndex] });
      return result;
    });
    const view = stats(), drawAt = trace.length; page2(view);
    press('b'); wait(40); expect(session.foreground).toBe('party');
    until(() => session.foreground === 'battle' && row(14).includes('FIGHT'),
      () => frameNow() % 4 === 0 ? ['b'] : []); wait(20);
    until(() => host.state !== 'battle', () => {
      if (frameNow() % 4) return [];
      if (session.foreground === 'party') return ['b'];
      if (row(14).includes('FIGHT') && !session.video.textBox.active) {
        if (session.screen.at(15, 14) === '▶' || session.screen.at(15, 16) === '▶') return ['left'];
        if (row(16).includes('▶')) return ['up'];
      }
      return session.video.textBox.isWaitingForInput ? ['b'] : ['a'];
    });
    return { trace, drawAt, money: host.money, payday: [...session.state.mem.slice(A.wTotalPayDayMoney, A.wTotalPayDayMoney + 3)],
      party: host.playerParty.map(p => ({ hp: p.currentHp, exp: p.exp, moves: p.moves })), done: session.done };
  }
  const control = await run(true), actual = await run(false);
  const residual = (run: typeof actual) => run.trace.map(({ names: _names, ...rest }) => rest);
  expect(residual(actual)).toEqual(residual(control));
  const differences = actual.trace.flatMap((frame, i) => {
    const addresses = frame.names.flatMap((byte, n) => byte === control.trace[i].names[n] ? []
      : [(n < 11 ? A.wNameBuffer + n : A.wNamedObjectIndex).toString(16)]);
    return addresses.length ? [{ at: i, addresses }] : [];
  });
  expect(differences[0].at).toBe(actual.drawAt);
  expect(actual.drawAt).toBe(control.drawAt);
  expect(actual.money).toBe(3042); expect(actual.money).toBe(control.money);
  expect(actual.payday).toEqual(control.payday); expect(actual.party).toEqual(control.party);
  expect(actual.done).toBe(true); expect(control.done).toBe(true);
  if (process.env.PKMN_STATS_AUDIT) writeFileSync(process.env.PKMN_STATS_AUDIT, JSON.stringify({
    frames: actual.trace.length, drawFrame: actual.drawAt, controlFrames: control.trace.length,
    nonNameWram: 'identical at every frame', money: actual.money, controlMoney: control.money,
    payday: actual.payday, controlPayday: control.payday, differences,
  }, null, 2) + '\n');
});
