import { A, BattleState, encodeText } from '../battle/battle_state';
import { BattleScreen } from '../battle/battle_screen';
import type { Frame, Program } from '../battle/battle_menu_context';

export function hpRig(side: 0 | 1 = 0) {
  const s = new BattleState(), screen = new BattleScreen();
  s.hWhoseTurn = side;
  s.wBattleMonHP = 100; s.wBattleMonMaxHP = 160; s.wBattleMonLevel = 25;
  s.wEnemyMonHP = 100; s.wEnemyMonMaxHP = 160; s.wEnemyMonLevel = 30;
  s.wBattleMonSpecies = 0x54; s.mem[A.wPartyMons] = 0x54; s.wEnemyMonSpecies2 = 1;
  s.setBytes(A.wBattleMonNick, encodeText('PIKA@'), 11);
  s.setBytes(A.wEnemyMonNick, encodeText('FOE@'), 11);
  s.random = () => { throw new Error('unexpected BattleRandom'); };
  const c = side === 0
    ? { hp: A.wBattleMonHP, max: A.wBattleMonMaxHP, status: A.wBattleMonStatus,
      flags2: A.wPlayerBattleStatus2, flags3: A.wPlayerBattleStatus3, toxic: A.wPlayerToxicCounter,
      opposite: A.wEnemyMonHP, oppositeMax: A.wEnemyMonMaxHP }
    : { hp: A.wEnemyMonHP, max: A.wEnemyMonMaxHP, status: A.wEnemyMonStatus,
      flags2: A.wEnemyBattleStatus2, flags3: A.wEnemyBattleStatus3, toxic: A.wEnemyToxicCounter,
      opposite: A.wBattleMonHP, oppositeMax: A.wBattleMonMaxHP };
  return { s, screen, c };
}

export function finish<T>(p: Program<T>, onFrame: (frame: Frame) => void = () => {}): { result: T; frames: Frame[] } {
  const frames: Frame[] = [];
  for (let i = 0; i < 30000; i++) {
    const step = p.next();
    if (step.done) return { result: step.value, frames };
    frames.push(step.value); onFrame(step.value);
  }
  throw new Error('Program did not finish');
}
