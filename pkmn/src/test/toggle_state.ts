// Test helpers for wToggleableObjectFlags (V5c checkpoint-03b, note 93 §16).
import { getToggleableObjectFlags, initializeToggleableObjectFlags, restoreToggleableObjectFlags,
  legacyToggleableObjectFlags, isToggledOff } from '../overworld/toggleable_objects';
import { hasFlag } from '../events';

/** The toggle indexes whose flag differs from New Game's: hidden since, and shown since. */
export function toggleChanges(): { hidden: number[]; shown: number[] } {
  const now = getToggleableObjectFlags();
  initializeToggleableObjectFlags();
  const hidden: number[] = [], shown: number[] = [];
  for (let index = 0; index < 0x100; index++) {
    const start = isToggledOff(index), off = (now[index >> 3] & (1 << (index & 7))) !== 0;
    if (off && !start) hidden.push(index);
    if (!off && start) shown.push(index);
  }
  restoreToggleableObjectFlags(now);
  return { hidden, shown };
}

/** For a test that stages a story state by event flags alone: the toggle flags a save with those events
 *  stands for (the old-save migration), as the scripts that set the events would have left them. */
export function stageTogglesFromEvents(): void {
  restoreToggleableObjectFlags(legacyToggleableObjectFlags([], hasFlag));
}
