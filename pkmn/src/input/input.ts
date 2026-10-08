import type { GameButton } from '../core';
import { joyIgnored } from './joy_ignore';

const keys: Record<GameButton, boolean> = {
  up: false, down: false, left: false, right: false,
  a: false, b: false, start: false, select: false,
};

const justPressed: Record<GameButton, boolean> = { ...keys };
const prevKeys: Record<GameButton, boolean> = { ...keys };

const keyMap: Record<string, GameButton> = {
  'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left', 'ArrowRight': 'right',
  'w': 'up', 's': 'down', 'a': 'left', 'd': 'right',
  'z': 'a', 'x': 'b', 'Enter': 'start', 'Shift': 'select',
};

window.addEventListener('keydown', (e) => {
  const btn = keyMap[e.key];
  if (btn) { keys[btn] = true; e.preventDefault(); }
});

window.addEventListener('keyup', (e) => {
  const btn = keyMap[e.key];
  if (btn) { keys[btn] = false; e.preventDefault(); }
});

// Losing focus swallows the keyup events. The game keeps running in the
// background (main.ts), so a held key would stay "held" — release everything.
window.addEventListener('blur', () => {
  for (const k of Object.keys(keys) as GameButton[]) keys[k] = false;
});

export function updateInput(): void {
  for (const k of Object.keys(keys) as GameButton[]) {
    justPressed[k] = keys[k] && !prevKeys[k];
    prevKeys[k] = keys[k];
  }
}

// wJoyIgnore (joy_ignore.ts) masks every read, as _Joypad masks hJoyHeld and hJoyPressed.
export function isHeld(button: GameButton): boolean {
  return keys[button] && !joyIgnored(button);
}

export function isPressed(button: GameButton): boolean {
  return justPressed[button] && !joyIgnored(button);
}

// The overworld reads the joypad once per standing pass (JoypadOverworld → Joypad, every
// two frames, and not mid-step): a button counts as pressed when it is down at a read and
// wasn't at the one before. Menus and text boxes read it every frame.
const lastRead: Record<GameButton, boolean> = { ...keys };
const readPressed: Record<GameButton, boolean> = { ...keys };

/** The overworld's joypad read (a standing pass). The edge is raw (hJoyLast); the mask
 *  applies to what the read reports. */
export function readJoypad(): void {
  for (const k of Object.keys(keys) as GameButton[]) {
    readPressed[k] = keys[k] && !lastRead[k] && !joyIgnored(k);
    lastRead[k] = keys[k];
  }
}

/** A frame where something else read the joypad (a menu, a text box). */
export function syncJoypadRead(): void {
  for (const k of Object.keys(keys) as GameButton[]) {
    lastRead[k] = keys[k];
    readPressed[k] = false;
  }
}

/** Pressed at the overworld's last joypad read (use in the pass logic). */
export function isPassPressed(button: GameButton): boolean {
  return readPressed[button];
}

/** Set a button state programmatically (used by touch controls). */
export function setKey(button: GameButton, pressed: boolean): void {
  keys[button] = pressed;
}
