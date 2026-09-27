import type { GameButton } from '../core';

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

export function updateInput(): void {
  for (const k of Object.keys(keys) as GameButton[]) {
    justPressed[k] = keys[k] && !prevKeys[k];
    prevKeys[k] = keys[k];
  }
}

export function isHeld(button: GameButton): boolean {
  return keys[button];
}

export function isPressed(button: GameButton): boolean {
  return justPressed[button];
}

/** Set a button state programmatically (used by touch controls). */
export function setKey(button: GameButton, pressed: boolean): void {
  keys[button] = pressed;
}
