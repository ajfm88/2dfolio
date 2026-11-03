import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { host, loadMainBattleRig, resetMainBattleRig, tick, until, world, mon, row, frameNow } from '../test/main_battle_rig';
import { A, BattleState, battleContext } from './battle_state';
import * as menu from './battle_menu';
import * as rng from './battle_random';
import * as selection from './battle_math';
import * as damage from './battle_damage_asm';
import * as hit from './battle_hit';
import type { GameButton } from '../core';

beforeAll(() => loadMainBattleRig());
beforeEach(resetMainBattleRig);
afterEach(() => { host.reset(); vi.restoreAllMocks(); });
function state(player: number, enemy: number, attempts = 1, div = 64) {
  const s = new BattleState();
  s.wBattleMonSpeed = player; s.wEnemyMonSpeed = enemy; s.wNumRunAttempts = attempts;
  s.readDIV = vi.fn(() => div);
  return s;
}
const randomCells = (s: BattleState) => [s.hRandomAdd, s.hRandomSub, s.wLinkBattleRandomNumberListIndex];
function early(player: number, enemy: number, attempts = 1) {
  const s = state(player, enemy, attempts), before = randomCells(s);
  let escaped = false;
  expect(() => { escaped = menu.battleRunOdds(s); }).not.toThrow();
  expect(escaped).toBe(true); expect(s.readDIV).not.toHaveBeenCalled();
  expect(randomCells(s)).toEqual(before); return s;
}
function compare(player: number, enemy: number, attempts: number, div: number, escaped: boolean) {
  const s = state(player, enemy, attempts, div);
  expect(randomCells(s)).toEqual([0, 0, 0]);
  expect(menu.battleRunOdds(s)).toBe(escaped);
  expect(s.readDIV).toHaveBeenCalledTimes(2);
  // Non-link CP supplies carry1: Add = DIV+1; Sub subtracts DIV and ADC carry.
  expect(randomCells(s)).toEqual([(div + 1) & 255, (-div - (div === 255 ? 1 : 0)) & 255, 0]);
  return s;
}

it('player faster escapes without a BattleRandom draw', () => { early(100, 50); });
it('equal speeds escape without a BattleRandom draw', () => { early(100, 100); });
it('enemy speeds zero through three escape without a BattleRandom draw', () => {
  for (const enemy of [0, 1, 2, 3]) early(1, enemy);
});
it('enemy speed1024 discards the shifted high byte and escapes without a draw', () => { early(1, 1024); });
it('compare below the factor escapes with exactly one BattleRandom draw', () => {
  // 50*32 / floor(100/4) = 1600/25 =64; pinned DIV62 gives Random63, so64>=63.
  const s = compare(50, 100, 1, 62, true);
  expect([...s.mem.slice(A.hProduct, A.hProduct + 4)]).toEqual([0, 0, 0, 64]);
});
it('compare equal to the factor escapes with exactly one BattleRandom draw', () => { compare(50, 100, 1, 63, true); });
it('compare above the factor fails with exactly one BattleRandom draw', () => { compare(50, 100, 1, 64, false); });
it('each earlier attempt adds exactly30 before the compare', () => {
  // q64 +30 =94 on attempt2; +60 =124 on attempt3. DIV93/123 gives equality.
  compare(50, 100, 2, 93, true); compare(50, 100, 3, 123, true);
});
it('the addition carry escapes without a BattleRandom draw', () => {
  // q floor(10*32/50)=6. Attempt10 reaches6+9*30=276, stored low20, carry escapes.
  const s = early(10, 200, 10); expect(s.mem[A.hProduct + 3]).toBe(20);
});
it('a quotient above255 escapes without a BattleRandom draw', () => {
  const s = early(10, 1028); // divisor257&255=1, quotient320 = $0140.
  expect([...s.mem.slice(A.hProduct + 2, A.hProduct + 4)]).toEqual([1, 64]);
});
it('a very slow first attempt fails against random255', () => { compare(10, 200, 1, 254, false); });

it('the 256th attempt wraps to0 and escapes on the byte-loop carry with no draw or frame', () => {
  const s = state(10, 200, 255); s.wIsInBattle = 1;
  const texts: string[] = [];
  const program = menu.tryRunningFromBattle(battleContext(s), {
    runOdds: () => menu.battleRunOdds(s), printText: function* (label) { texts.push(label); },
    loadScreenTilesFromBuffer1() {}, saveScreenTilesToBuffer1() {},
    waitForSound: function* () {}, playSound() {},
  });
  expect(program.next()).toEqual({ done: true, value: { carry: true } });
  expect(s.wNumRunAttempts).toBe(0); expect(s.mem[A.hProduct + 3]).toBe(20);
  // DEC0 ->255 permits255 additions; the ninth addition already carries, ending the loop.
  expect(s.readDIV).not.toHaveBeenCalled(); expect(randomCells(s)).toEqual([0, 0, 0]);
  expect(texts).toEqual(['GotAwayText']);
});

function press(key: GameButton) { for (let i = 0; i < 8; i++) tick([key]); for (let i = 0; i < 12; i++) tick(); }
async function ready(div = 64) {
  await world('Route1', 5, 5, [mon(25, 20)]); host.startBattle(mon(19, 3));
  until(() => host.state === 'battle');
  until(() => row(14).includes('FIGHT') && !host.session!.video.textBox.active);
  for (let i = 0; i < 30; i++) tick();
  press('right'); press('down');
  const session = host.session!, s = session.state;
  s.wBattleMonSpeed = 50; s.wEnemyMonSpeed = 100; s.wNumRunAttempts = 0;
  s.hRandomAdd = s.hRandomSub = 0; s.readDIV = () => div;
  return session;
}
function runPress() { tick(['a']); tick(); }
function runKeys(): GameButton[] {
  if (frameNow() % 4) return [];
  const s = host.session!;
  if (row(14).includes('FIGHT') && !s.video.textBox.active) {
    const right = s.screen.at(15, 14) === '▶' || s.screen.at(15, 16) === '▶';
    if (!right) return ['right'];
    if (!row(16).includes('▶')) return ['down'];
  }
  return s.video.textBox.isWaitingForInput ? ['b'] : ['a'];
}

it.each([{ name: 'escape63', div: 62, escape: true }, { name: 'failure65', div: 64, escape: false }])(
  'real session $name uses the worked compare and no Math.random', async ({ div, escape }) => {
    // Both q64, before RNG Add/Sub0. DIV62 ->63 escapes; DIV64 ->65 fails.
    const session = await ready(div), before = randomCells(session.state);
    const math = vi.spyOn(Math, 'random');
    const call = menu.battleRunOdds;
    const checks: { before: number[]; after: number[]; result: boolean }[] = [];
    vi.spyOn(menu, 'battleRunOdds').mockImplementation(s => {
      const old = randomCells(s), result = call(s);
      checks.push({ before: old, after: randomCells(s), result }); return result;
    });
    runPress();
    expect(math).not.toHaveBeenCalled();
    expect(checks).toEqual([{ before, after: [div + 1, (-div) & 255, 0], result: escape }]);
    until(() => session.textLog.some(t => t.label === (escape ? 'GotAwayText' : 'CantEscapeText')), () => []);
    if (!escape) expect(session.state.wActionResultOrTookBattleTurn).toBe(1);
  });

it('failed RUN advances the real enemy roll ledger one draw beyond a draw-free escape control', async () => {
  const session = await ready(64), s = session.state;
  s.setBytes(A.wEnemyMonMoves, [33, 33, 33, 33], 4); // all bands legal; isolate stream position from selector retries.
  const draws: { phase: string; value: number }[] = [];
  let phase = 'other';
  const random = rng.battleRandom;
  vi.spyOn(rng, 'battleRandom').mockImplementation(state => {
    const value = random(state); if (state === s) draws.push({ phase, value }); return value;
  });
  const run = menu.battleRunOdds;
  vi.spyOn(menu, 'battleRunOdds').mockImplementation(state => { phase = 'run'; const result = run(state); phase = 'other'; return result; });
  const select = selection.selectEnemyMove;
  vi.spyOn(selection, 'selectEnemyMove').mockImplementation((...args) => { phase = 'select'; select(...args); phase = 'other'; });
  const crit = damage.criticalHitTest;
  vi.spyOn(damage, 'criticalHitTest').mockImplementation(state => { phase = 'crit'; crit(state); phase = 'other'; });
  const range = damage.randomizeDamage;
  vi.spyOn(damage, 'randomizeDamage').mockImplementation(state => { phase = 'range'; range(state); phase = 'other'; });
  const accuracy = hit.moveHitTest;
  vi.spyOn(hit, 'moveHitTest').mockImplementation(state => { phase = 'hit'; const result = accuracy(state); phase = 'other'; return result; });
  runPress(); expect(draws).toEqual([{ phase: 'run', value: 65 }]);
  until(() => draws.some(d => d.phase === 'hit'), runKeys);
  // DIV64 adds65 per BattleRandom. RUN65; select130; crit195; RRCA ranges2,162,67,227;
  // only227 >=217, so range raw4/69/134/199; hit8. No expected value is sampled from a trial.
  expect(draws).toEqual([{ phase: 'run', value: 65 }, { phase: 'select', value: 130 },
    { phase: 'crit', value: 195 }, ...[4, 69, 134, 199].map(value => ({ phase: 'range', value })), { phase: 'hit', value: 8 }]);
  until(() => host.state !== 'battle', runKeys); expect(session.done).toBe(true);

  // A real early-escape control has no enemy turn. Probe its unused continuation stream
  // after completion rather than inventing an enemy action after an escaped RUN.
  resetMainBattleRig(); const control = await ready(64); control.state.wBattleMonSpeed = 100;
  runPress(); until(() => host.state !== 'battle', runKeys);
  expect(control.done).toBe(true); expect(randomCells(control.state)).toEqual([0, 0, 0]);
  const probe = new BattleState(); probe.hRandomAdd = control.state.hRandomAdd; probe.hRandomSub = control.state.hRandomSub;
  probe.readDIV = () => 64;
  const continuation = Array.from({ length: 8 }, () => random(probe));
  expect(continuation).toEqual([65, 130, 195, 4, 69, 134, 199, 8]);
  expect(draws.slice(1, 8).map(d => d.value)).toEqual(continuation.slice(1));
});
