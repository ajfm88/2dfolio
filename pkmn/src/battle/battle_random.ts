// core.asm:6728–6784; home/random.asm; engine/math/random.asm.
import { A, LINK_STATE_BATTLING, type BattleState } from './battle_state';

/** home/random.asm; engine/math/random.asm:1-14. ADC's incoming carry belongs to the caller. */
export function random(state: BattleState, carryIn: 0 | 1): number {
  const sum = state.hRandomAdd + (state.readDIV() & 0xff) + carryIn;
  state.hRandomAdd = sum;
  state.hRandomSub = state.hRandomSub - (state.readDIV() & 0xff) - (sum > 255 ? 1 : 0);
  return state.hRandomAdd;
}

export function battleRandom(state: BattleState): number {
  if (state.wLinkState !== LINK_STATE_BATTLING) {
    // CP LINK_STATE_BATTLING supplies the incoming carry to Random_'s ADC.
    return random(state, state.wLinkState < LINK_STATE_BATTLING ? 1 : 0);
  }
  const index = state.wLinkBattleRandomNumberListIndex;
  const value = state.mem[A.wLinkBattleRandomNumberList + index];
  state.wLinkBattleRandomNumberListIndex = index + 1;
  if (state.wLinkBattleRandomNumberListIndex < 9) return value;
  state.wLinkBattleRandomNumberListIndex = 0;
  for (let i = 0; i < 9; i++) {
    const address = A.wLinkBattleRandomNumberList + i;
    state.mem[address] = state.mem[address] * 5 + 1;
  }
  return value;
}
