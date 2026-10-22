import { expect, vi } from 'vitest';
import { A, BattleState } from '../battle/battle_state';
import { getCurrentMove } from '../battle/battle_move_data';
import { checkEnemyStatusConditions, checkPlayerStatusConditions, type BattleSide, type StatusPorts } from '../battle/battle_turn_status';
import type { BattleTurnTextHost } from '../battle/battle_turn_text';
import type { Frame, Program } from '../battle/battle_menu_context';
import { getTextPrograms } from '../text/program_data';

export function collect<T>(program: Program<T>): { result: T; frames: Frame[] } {
  const frames: Frame[] = [];
  for (let count = 0; count < 5000; count++) {
    const step = program.next();
    if (step.done) return { result: step.value, frames };
    frames.push(step.value);
  }
  throw new Error('test Program did not finish');
}

export function statusRig(side: BattleSide = 0) {
  const s = new BattleState(), events: string[] = [], texts: string[] = [];
  s.hWhoseTurn = side; s.wPlayerSelectedMove = 33; s.wEnemySelectedMove = 33;
  getCurrentMove(s); s.wPlayerUsedMove = 10; s.wEnemyUsedMove = 11;
  s.wBattleMonLevel = 20; s.wEnemyMonLevel = 30;
  const c = side === 0
    ? { status: A.wBattleMonStatus, flags: A.wPlayerBattleStatus1, flags2: A.wPlayerBattleStatus2,
      opposite: A.wEnemyBattleStatus1, disabled: A.wPlayerDisabledMove, disabledId: A.wPlayerDisabledMoveNumber,
      count: A.wPlayerNumAttacksLeft, confused: A.wPlayerConfusedCounter, move: A.wPlayerMoveNum,
      used: A.wPlayerUsedMove, bide: A.wPlayerNumHits }
    : { status: A.wEnemyMonStatus, flags: A.wEnemyBattleStatus1, flags2: A.wEnemyBattleStatus2,
      opposite: A.wPlayerBattleStatus1, disabled: A.wEnemyDisabledMove, disabledId: A.wEnemyDisabledMoveNumber,
      count: A.wEnemyNumAttacksLeft, confused: A.wEnemyConfusedCounter, move: A.wEnemyMoveNum,
      used: A.wEnemyUsedMove, bide: A.wEnemyNumHits };
  const host: BattleTurnTextHost = { printText: function* (label, bindings) {
    expect(getTextPrograms()[label], `committed program ${label}`).toBeDefined();
    texts.push(label); events.push(`text:${label}`);
    if (bindings?.nameBuffer !== undefined) events.push(`name:${bindings.nameBuffer}`);
  } };
  const ports: StatusPorts = {
    animation: function* (state) { events.push(`anim:${state.wAnimationID}:${state.hWhoseTurn}`); },
    calculateSelfHit: function* (state, actor) { events.push(`calc:${actor}`); state.wDamage = 12; },
    applySelfHit: function* (_state, actor) { events.push(`apply:${actor}`); },
    drawPlayerHud: function* (state) { events.push(`hud:${state.hWhoseTurn}`); },
  };
  s.random = () => { throw new Error('unexpected BattleRandom draw'); };
  function rolls(...bytes: number[]) {
    let index = 0;
    const random = vi.fn(() => {
      if (index >= bytes.length) throw new Error('BattleRandom rolls exhausted');
      const byte = bytes[index++]; events.push(`random:${byte}`); return byte;
    });
    s.random = random; return random;
  }
  const check = () => side === 0 ? checkPlayerStatusConditions(s, host, ports) : checkEnemyStatusConditions(s, host, ports);
  return { s, c, host, ports, events, texts, rolls, check };
}
