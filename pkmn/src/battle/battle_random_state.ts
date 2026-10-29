// Unused session-lived HRAM owner. pret home/random.asm:1-4, engine/math/random.asm:1-14.
import type { BattleState } from './battle_state';

export class BattleRandomState {
  hRandomAdd = 0;
  hRandomSub = 0;
  private attached: BattleState | null = null;
  private previousDIV: (() => number) | null = null;

  /** pret engine/math/random.asm:1-14. DIV is supplied by the host; it is not reset for each battle. */
  constructor(readonly readDIV: () => number) {}

  /** pret engine/math/random.asm:1-14. Install the retained HRAM bytes before LoadEnemyMonData. */
  attach(state: BattleState): void {
    if (this.attached) throw new Error('battle random state already attached');
    this.attached = state;
    this.previousDIV = state.readDIV;
    state.hRandomAdd = this.hRandomAdd;
    state.hRandomSub = this.hRandomSub;
    state.readDIV = this.readDIV;
  }

  /** pret engine/math/random.asm:1-14. Return live HRAM to its longer-lived owner after the battle. */
  detach(state: BattleState): void {
    if (this.attached !== state) throw new Error('different battle random state attached');
    this.hRandomAdd = state.hRandomAdd;
    this.hRandomSub = state.hRandomSub;
    state.readDIV = this.previousDIV!;
    this.attached = null;
    this.previousDIV = null;
  }
}
