// Touch controls for mobile/tablet — Game Boy button overlay
// Auto-detected and shown only on touch-capable devices

import type { GameButton } from '../core';
import { setKey } from './input';
import { resizeCanvas } from '../renderer';

interface ButtonDef {
  id: string;
  button: GameButton;
  label: string;
  className: string;
}

const DPAD_BUTTONS: ButtonDef[] = [
  { id: 'touch-up', button: 'up', label: '▲', className: 'dpad-up' },
  { id: 'touch-down', button: 'down', label: '▼', className: 'dpad-down' },
  { id: 'touch-left', button: 'left', label: '◀', className: 'dpad-left' },
  { id: 'touch-right', button: 'right', label: '▶', className: 'dpad-right' },
];

const ACTION_BUTTONS: ButtonDef[] = [
  { id: 'touch-a', button: 'a', label: 'A', className: 'btn-a' },
  { id: 'touch-b', button: 'b', label: 'B', className: 'btn-b' },
];

const META_BUTTONS: ButtonDef[] = [
  { id: 'touch-select', button: 'select', label: 'SELECT', className: 'btn-select' },
  { id: 'touch-start', button: 'start', label: 'START', className: 'btn-start' },
];

function createButton(def: ButtonDef): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.id = def.id;
  btn.className = `touch-btn ${def.className}`;
  btn.textContent = def.label;
  btn.setAttribute('data-button', def.button);

  // Prevent default to avoid scrolling, zooming, text selection
  btn.style.touchAction = 'none';
  btn.style.userSelect = 'none';
  btn.style.webkitUserSelect = 'none';

  // Track active pointers for multi-touch
  const activePointers = new Set<number>();

  const press = (e: PointerEvent) => {
    e.preventDefault();
    activePointers.add(e.pointerId);
    btn.setPointerCapture(e.pointerId);
    setKey(def.button, true);
    btn.classList.add('active');
  };

  const release = (e: PointerEvent) => {
    e.preventDefault();
    activePointers.delete(e.pointerId);
    if (activePointers.size === 0) {
      setKey(def.button, false);
      btn.classList.remove('active');
    }
  };

  btn.addEventListener('pointerdown', press);
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('pointerleave', release);

  // Prevent context menu on long press
  btn.addEventListener('contextmenu', (e) => e.preventDefault());

  return btn;
}

export function initTouchControls(): void {
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!isTouchDevice) return;

  document.body.classList.add('touch-enabled');

  // Prevent double-tap zoom on the canvas
  const canvas = document.getElementById('screen');
  if (canvas) canvas.style.touchAction = 'manipulation';

  // Create touch overlay container
  const overlay = document.createElement('div');
  overlay.id = 'touch-controls';

  // D-pad container
  const dpad = document.createElement('div');
  dpad.className = 'touch-dpad';
  for (const def of DPAD_BUTTONS) {
    dpad.appendChild(createButton(def));
  }
  overlay.appendChild(dpad);

  // Meta buttons (Select/Start)
  const meta = document.createElement('div');
  meta.className = 'touch-meta';
  for (const def of META_BUTTONS) {
    meta.appendChild(createButton(def));
  }
  overlay.appendChild(meta);

  // Action buttons (A/B)
  const actions = document.createElement('div');
  actions.className = 'touch-actions';
  for (const def of ACTION_BUTTONS) {
    actions.appendChild(createButton(def));
  }
  overlay.appendChild(actions);

  document.body.appendChild(overlay);

  // Re-resize canvas now that touch controls have a measured height
  resizeCanvas();

  // Re-resize on orientation change
  window.addEventListener('orientationchange', () => {
    setTimeout(resizeCanvas, 100);
  });
}
