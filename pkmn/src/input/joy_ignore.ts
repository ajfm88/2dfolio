// wJoyIgnore (engine/joypad.asm _Joypad): buttons masked out of hJoyHeld and hJoyPressed.
// hJoyLast stays raw, so a button held through the mask isn't "pressed" when it clears.
// Pure: no window, so the overworld controller can set it in tests.

import type { GameButton } from '../core';

/** wJoyIgnore: none, D-pad, SELECT|START|D-pad (controls), or $ff (all). */
export type JoyIgnore = 'none' | 'dpad' | 'controls' | 'all';

const DPAD: ReadonlySet<GameButton> = new Set<GameButton>(['up', 'down', 'left', 'right']);

let mask: JoyIgnore = 'none';

export function setJoyIgnore(next: JoyIgnore): void {
  mask = next;
}

export function joyIgnore(): JoyIgnore {
  return mask;
}

/** Is this button masked out of the joypad reads? */
export function joyIgnored(button: GameButton): boolean {
  return mask === 'all' || ((mask === 'dpad' || mask === 'controls') && DPAD.has(button))
    || (mask === 'controls' && (button === 'start' || button === 'select'));
}
