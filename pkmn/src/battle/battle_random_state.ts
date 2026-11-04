// The page-lifetime HRAM owner of hRandomAdd / hRandomSub. pret home/random.asm:1-4, engine/math/random.asm:1-14.
// Outside a battle it runs Random itself (VBlank and the overworld, DECISIONS #91); a battle attaches the bytes.
import type { BattleState } from './battle_state';
import { RANDOM_CYCLES } from './battle_random_cycles';

export class BattleRandomState {
  hRandomAdd = 0;
  hRandomSub = 0;
  /** Random_'s exit carry: the SBC's borrow. */
  carry: 0 | 1 = 0;
  private attached: BattleState | null = null;
  private previousDIV: (() => number) | null = null;
  private previousCycles: ((cycles: number) => void) | undefined;

  /** pret engine/math/random.asm:1-14. DIV is supplied by the host; it is not reset for each battle. */
  constructor(readonly readDIV: () => number, private readonly advanceCycles?: (cycles: number) => void) {}

  get isAttached(): boolean { return this.attached !== null; }

  /** home/random.asm; engine/math/random.asm:1-14, on the retained bytes. ADC's incoming carry belongs to the caller.
   * Same arithmetic and cycle accounting as battle_random.ts random(). */
  random(carryIn: 0 | 1): number {
    if (this.attached) throw new Error('a battle owns hRandomAdd / hRandomSub');
    this.advanceCycles?.(RANDOM_CYCLES.beforeFirst);
    const sum = this.hRandomAdd + (this.readDIV() & 0xff) + carryIn;
    this.hRandomAdd = sum & 0xff;
    this.advanceCycles?.(RANDOM_CYCLES.betweenReads);
    const difference = this.hRandomSub - (this.readDIV() & 0xff) - (sum > 0xff ? 1 : 0);
    this.hRandomSub = difference & 0xff;
    this.carry = difference < 0 ? 1 : 0;
    this.advanceCycles?.(RANDOM_CYCLES.afterSecond);
    return this.hRandomAdd;
  }

  /** pret engine/math/random.asm:1-14. Install the retained HRAM bytes before LoadEnemyMonData. */
  attach(state: BattleState): void {
    if (this.attached) throw new Error('battle random state already attached');
    this.attached = state;
    this.previousDIV = state.readDIV;
    this.previousCycles = state.advanceRandomCycles;
    state.hRandomAdd = this.hRandomAdd;
    state.hRandomSub = this.hRandomSub;
    state.readDIV = this.readDIV;
    state.advanceRandomCycles = this.advanceCycles;
  }

  /** pret engine/math/random.asm:1-14. Return live HRAM to its longer-lived owner after the battle. */
  detach(state: BattleState): void {
    if (this.attached !== state) throw new Error('different battle random state attached');
    this.hRandomAdd = state.hRandomAdd;
    this.hRandomSub = state.hRandomSub;
    state.readDIV = this.previousDIV!;
    state.advanceRandomCycles = this.previousCycles;
    this.attached = null;
    this.previousDIV = null;
    this.previousCycles = undefined;
  }
}
