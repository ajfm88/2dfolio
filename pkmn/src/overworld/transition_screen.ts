import { textBgTransfer } from '../text/bg_transfer';
import { battleTransitionOamSlots, battleTransitionSurvivors } from './battle_transition_choice';
import type { TransitionSpriteSlot } from './battle_transition_choice';

export const TRANSITION_WIDTH = 20;
export const TRANSITION_HEIGHT = 18;
/** Captured-cell IDs include 255, so the ROM tile $ff needs a separate sentinel. */
export const TRANSITION_BLACK = -1;
export const TRANSITION_BLANK = -2; // ClearScreen's tile $7f
const OUTSIDE_NON_FF = -3;

/** wTileMap + window scanout. Only vblank advances shared BG phase/OAM DMA/WY. */
export class TransitionScreen {
  bgp = 0xe4;
  obp0 = 0xd0;
  obp1 = 0xe0;
  wy = 0x90;
  windowY = 0x90;
  spriteUpdatesEnabled = true;
  tileAnimationsEnabled = true;
  transitionTileLoaded = false;
  hpBarTilesLoaded = false;
  hud1Loaded = false;
  hud2Loaded = false;
  black = false;
  private readonly logical = Array.from({ length: 360 }, (_, i) => i);
  private readonly shown = [...this.logical];
  private readonly outside = new Map<number, number>();
  private pendingOam: number[];
  private shownOam: number[];
  private readonly survivors: number[];

  constructor(slots: readonly TransitionSpriteSlot[] = [{ slot: 0, occupied: true, visible: true }], spriteIndex = 0) {
    const order = battleTransitionOamSlots(slots);
    this.pendingOam = order;
    this.shownOam = [...order];
    const blocks = battleTransitionSurvivors(slots, spriteIndex);
    this.survivors = order.filter((_, block) => blocks.includes(block));
  }
  get cells(): readonly number[] { return this.logical.slice(); }
  get visibleCells(): readonly number[] { return this.shown.slice(); }
  /** Slots, in hardware OAM priority order (slot 0 has highest priority). */
  get visibleSprites(): readonly number[] { return this.shownOam.slice(); }
  read(pointer: number): number {
    return pointer >= 0 && pointer < 360 ? this.logical[pointer] : this.outside.get(pointer) ?? OUTSIDE_NON_FF;
  }
  write(pointer: number, cell = TRANSITION_BLACK): void {
    if (pointer >= 0 && pointer < 360) this.logical[pointer] = cell;
    else this.outside.set(pointer, cell); // outward spiral's 19 row-18 writes
  }
  clearOamExceptSurvivors(): void { this.pendingOam = [...this.survivors]; }
  clearSprites(): void { this.pendingOam = []; }
  clearScreen(): void { this.logical.fill(TRANSITION_BLANK); }

  vblank(): number | null {
    this.windowY = this.wy;
    this.shownOam = [...this.pendingOam];
    const third = textBgTransfer.enabled ? textBgTransfer.nextPortion : null;
    if (third !== null) {
      const start = third * 120;
      for (let cell = start; cell < start + 120; cell++) this.shown[cell] = this.logical[cell];
    }
    textBgTransfer.tick();
    return third;
  }
}
