// EmotionBubble (engine/overworld/emotion_bubbles.asm): the "!" over a sprite, with sprite
// updates disabled for DelayFrames 60, then DelayFrame and UpdateSprites. VBlank copies OAM
// before PrepareOAMData rebuilds it (home/vblank.asm), so the bubble is on screen for 61
// frames. The trainer path uses it (A1c); the two cutscene bubbles wait for V5.

import type { Npc } from './npc';

/** 60 frames of DelayFrames, then the DelayFrame. */
export const EMOTION_BUBBLE_FRAMES = 61;

export class EmotionBubble<T = Npc> {
  private target: T | null = null;
  private frames = 0;

  /** Put the bubble over this sprite; the hold starts with the next frame. */
  start(target: T): void {
    this.target = target;
    this.frames = 0;
  }

  /** The sprite the bubble is over, while it is on screen (renders T … T+60). */
  get showing(): T | null {
    return this.target;
  }

  clear(): void { this.target = null; }

  /** One frame of the hold. True on the frame it ends (T+61), when the caller runs
   *  EmotionBubble's UpdateSprites and the rest of the pass; the bubble is gone then. */
  tick(): boolean {
    if (!this.target) return false;
    this.frames++;
    if (this.frames < EMOTION_BUBBLE_FRAMES) return false;
    this.target = null;
    return true;
  }
}
