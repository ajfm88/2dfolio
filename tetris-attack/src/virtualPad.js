// On-screen D-pad + Swap / Raise / Pause for touch play.
// Pause is a UI action (App.pauseMatch), not Buttons.GAME_TOGGLE_PAUSE.
// See docs/context/specs/07-touch-input.md.

import { Buttons } from './input.js';
import { audio } from './audio.js';
import { showToast } from './toast.js';

const STYLE_ID = 'ta-virtualpad-style';
const STYLE = `
  #ta-virtual-pad {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    z-index: 100;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 12px;
    padding: 10px max(12px, env(safe-area-inset-right))
             max(12px, env(safe-area-inset-bottom))
             max(12px, env(safe-area-inset-left));
    box-sizing: border-box;
    pointer-events: none;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  #ta-virtual-pad.ta-pad-hidden { display: none; }
  .ta-pad-side {
    display: flex;
    gap: 8px;
    pointer-events: auto;
  }
  .ta-pad-dpad {
    display: grid;
    grid-template-columns: 56px 56px 56px;
    grid-template-rows: 56px 56px 56px;
    gap: 4px;
  }
  .ta-pad-dpad .ta-pad-btn[data-dir="up"]    { grid-column: 2; grid-row: 1; }
  .ta-pad-dpad .ta-pad-btn[data-dir="left"]  { grid-column: 1; grid-row: 2; }
  .ta-pad-dpad .ta-pad-btn[data-dir="right"] { grid-column: 3; grid-row: 2; }
  .ta-pad-dpad .ta-pad-btn[data-dir="down"]  { grid-column: 2; grid-row: 3; }
  .ta-pad-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }
  .ta-pad-btn {
    min-width: 56px;
    min-height: 44px;
    height: 56px;
    margin: 0;
    padding: 0 12px;
    box-sizing: border-box;
    font-family: 'Press Start 2P', 'Courier New', monospace;
    font-size: 11px;
    color: #4de0ff;
    background: rgba(10, 8, 24, 0.72);
    border: 3px solid #4de0ff;
    border-radius: 6px;
    box-shadow: 0 0 10px rgba(77, 224, 255, 0.25);
    cursor: pointer;
    touch-action: none;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }
  .ta-pad-btn.ta-pad-pressed,
  .ta-pad-btn:active {
    color: #07050f;
    background: #4de0ff;
    border-color: #ffffff;
  }
  .ta-pad-btn.ta-pad-wide { min-width: 88px; }
  @media (max-width: 360px) {
    .ta-pad-dpad {
      grid-template-columns: 48px 48px 48px;
      grid-template-rows: 48px 48px 48px;
    }
    .ta-pad-btn { min-width: 48px; height: 48px; font-size: 10px; }
  }
`;

const DIR_MAP = {
  up: Buttons.UP,
  down: Buttons.DOWN,
  left: Buttons.LEFT,
  right: Buttons.RIGHT,
};

export class VirtualPad {
  /**
   * @param {{ input: import('./touchInput.js').TouchInput, onPause: () => void }} opts
   */
  constructor({ input, onPause }) {
    this.input = input;
    this.onPause = onPause;
    this._pointerButtons = new Map(); // pointerId → button | 'pause' | 'mute'
    this._injectStyle();
    this._build();
  }

  _injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  _build() {
    this.root = document.createElement('div');
    this.root.id = 'ta-virtual-pad';

    const dpad = document.createElement('div');
    dpad.className = 'ta-pad-side ta-pad-dpad';
    for (const dir of ['up', 'left', 'right', 'down']) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ta-pad-btn';
      btn.dataset.dir = dir;
      btn.setAttribute('aria-label', dir);
      btn.textContent = ({ up: '▲', down: '▼', left: '◀', right: '▶' })[dir];
      this._bindHold(btn, DIR_MAP[dir]);
      dpad.appendChild(btn);
    }
    this.root.appendChild(dpad);

    const actions = document.createElement('div');
    actions.className = 'ta-pad-side ta-pad-actions';

    const swap = document.createElement('button');
    swap.type = 'button';
    swap.className = 'ta-pad-btn ta-pad-wide';
    swap.textContent = 'SWAP';
    this._bindHold(swap, Buttons.SWAP);
    actions.appendChild(swap);

    const raise = document.createElement('button');
    raise.type = 'button';
    raise.className = 'ta-pad-btn ta-pad-wide';
    raise.textContent = 'RAISE';
    this._bindHold(raise, Buttons.SCROLL);
    actions.appendChild(raise);

    const pause = document.createElement('button');
    pause.type = 'button';
    pause.className = 'ta-pad-btn ta-pad-wide';
    pause.textContent = 'PAUSE';
    this._bindTap(pause, () => {
      if (typeof this.onPause === 'function') this.onPause();
    });
    actions.appendChild(pause);

    const mute = document.createElement('button');
    mute.type = 'button';
    mute.className = 'ta-pad-btn ta-pad-wide';
    mute.textContent = 'MUTE';
    this._bindTap(mute, () => {
      showToast(audio.toggleMute() ? 'SOUND OFF' : 'SOUND ON');
    });
    actions.appendChild(mute);

    this.root.appendChild(actions);
    document.body.appendChild(this.root);
  }

  _bindHold(el, button) {
    const press = (e) => {
      e.preventDefault();
      // Do NOT stopPropagation — App's capture listener must unlock AudioContext.
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      this._pointerButtons.set(e.pointerId, button);
      this.input.press(button);
      el.classList.add('ta-pad-pressed');
    };
    const release = (e) => {
      const btn = this._pointerButtons.get(e.pointerId);
      if (btn === button) {
        this.input.release(button);
        this._pointerButtons.delete(e.pointerId);
      }
      el.classList.remove('ta-pad-pressed');
    };
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
  }

  _bindTap(el, fn) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.classList.add('ta-pad-pressed');
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    });
    const up = (e) => {
      el.classList.remove('ta-pad-pressed');
      // Fire on release over the button (simple tap).
      const r = el.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right &&
          e.clientY >= r.top && e.clientY <= r.bottom) {
        fn();
      }
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', () => el.classList.remove('ta-pad-pressed'));
    el.addEventListener('lostpointercapture', () => el.classList.remove('ta-pad-pressed'));
  }

  setVisible(visible) {
    if (!this.root) return;
    this.root.classList.toggle('ta-pad-hidden', !visible);
  }

  destroy() {
    this.input.releaseAll();
    if (this.root && this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
    this.root = null;
    this._pointerButtons.clear();
  }
}
