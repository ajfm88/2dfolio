// Unused UpdateHPBar2 / UpdateCurMonHPBar. hp_bar.asm:48–159,204–283; core.asm:677–690.
import { HpBarAnimation } from '../menus/hp_bar';
import { A, type BattleState } from './battle_state';
import { BattleScreen, battleGlyphTile } from './battle_screen';
import { drawHpBar } from './battle_hud';
import type { Program } from './battle_menu_context';

/** These scratch words are little-endian; battle HP itself remains big-endian. */
export function readHpBarWord(state: BattleState, address: number): number {
  return state.mem[address] | (state.mem[address + 1] << 8);
}
export function writeHpBarWord(state: BattleState, address: number, value: number): void {
  state.mem[address] = value; state.mem[address + 1] = value >> 8;
}

export function* updateHPBar2(
  state: BattleState, screen: BattleScreen, x: number, y: number, type: 0 | 1,
  oldHp: number, newHp: number, maxHp: number,
): Program {
  writeHpBarWord(state, A.wHPBarOldHP, oldHp);
  writeHpBarWord(state, A.wHPBarNewHP, newHp);
  writeHpBarWord(state, A.wHPBarMaxHP, maxHp);
  state.wHPBarType = type;
  state.writeBE(A.wHPBarHPDifference, Math.abs(newHp - oldHp));
  const animation = new HpBarAnimation(oldHp, newHp, maxHp, type);
  if (animation.done) return;
  const delta = newHp > oldHp ? 1 : -1;
  state.wHPBarDelta = delta;
  while (!animation.done) {
    const frame = animation.tick();
    writeHpBarWord(state, A.wHPBarOldHP, frame.shownHp);
    writeHpBarWord(state, A.wHPBarNewHP, frame.shownHp === newHp ? newHp : frame.shownHp + delta);
    drawHpBar(screen, x, y, frame.pixels, type);
    if (type === 1) {
      state.writeBE(A.wHPBarTempHP, frame.shownHp);
      const number = String(frame.shownHp).padStart(3, ' ');
      for (let i = 0; i < 3; i++) screen.put(x + 1 + i, y + 1, battleGlyphTile(number[i]));
    }
    // The tick reporting done is still a scheduled frame, including the Delay3 tail.
    yield 'serviced';
  }
}

export function* updateCurMonHPBar(state: BattleState, screen: BattleScreen): Program {
  const player = state.hWhoseTurn === 0;
  yield* updateHPBar2(state, screen, player ? 10 : 2, player ? 9 : 2, player ? 1 : 0,
    readHpBarWord(state, A.wHPBarOldHP), readHpBarWord(state, A.wHPBarNewHP), readHpBarWord(state, A.wHPBarMaxHP));
}
