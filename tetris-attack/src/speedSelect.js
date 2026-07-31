// Starting speed selector — a DOM overlay between character select and match start.
// The player picks a starting speed level (1-10) that determines how fast the
// stack rises at the beginning of the match; the speed ramp continues from there.

import { audio } from './audio.js';
import { MENU_BACKDROP_CSS, createLogo } from './backdrop.js';

const MAX_START_SPEED = 10;

const STYLE_ID = 'ta-speedselect-style';
const STYLE = `
  #ta-speedselect-overlay {
    position: fixed; inset: 0; z-index: 1000;
    display: flex; align-items: flex-start; justify-content: center;
    overflow: auto;
    padding: max(12px, env(safe-area-inset-top))
             max(12px, env(safe-area-inset-right))
             max(12px, env(safe-area-inset-bottom))
             max(12px, env(safe-area-inset-left));
    box-sizing: border-box;
    ${MENU_BACKDROP_CSS}
    font-family: 'Press Start 2P', 'Courier New', monospace;
    color: #f4f4ff; user-select: none;
  }
  #ta-speedselect-card {
    margin: auto;
    text-align: center;
    padding: clamp(16px, 4vw, 28px) clamp(16px, 5vw, 44px);
    width: min(100%, 420px);
    box-sizing: border-box;
    background: rgba(10, 8, 24, 0.72);
    border: 3px solid #4de0ff;
    border-radius: 10px;
    box-shadow: 0 0 24px rgba(77, 224, 255, 0.35), inset 0 0 24px rgba(77, 224, 255, 0.08);
  }
  #ta-speedselect-title {
    color: #ffe14d; font-size: clamp(12px, 3.5vw, 15px); margin: 0 0 24px;
  }
  #ta-speedselect-picker {
    display: flex; align-items: center; justify-content: center;
    gap: 12px; margin: 0 0 20px;
  }
  .ta-speedselect-arrow {
    font-size: 28px; color: #4de0ff; cursor: pointer;
    transition: color 0.08s;
    width: 44px; min-height: 44px;
    display: flex; align-items: center; justify-content: center;
    text-align: center;
  }
  .ta-speedselect-arrow:hover { color: #ffffff; }
  .ta-speedselect-arrow.disabled { color: #3a3a5a; cursor: default; }
  #ta-speedselect-value {
    font-size: clamp(32px, 10vw, 48px); color: #ffffff;
    min-width: 80px;
    text-shadow: 0 0 12px rgba(77, 224, 255, 0.5);
  }
  #ta-speedselect-desc {
    color: #c9c9e6; font-size: 11px; margin: 0 0 20px;
    min-height: 16px;
  }
  #ta-speedselect-hint {
    font-size: clamp(9px, 2.4vw, 10px); color: #7b7ba6; margin: 0 0 16px;
    line-height: 1.7;
  }
  #ta-speedselect-actions {
    display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;
  }
  .ta-speedselect-action {
    min-height: 44px; min-width: 100px; padding: 10px 16px;
    font-family: inherit; font-size: clamp(10px, 2.8vw, 12px);
    color: #4de0ff; background: rgba(10, 8, 24, 0.6);
    border: 2px solid #4de0ff; border-radius: 6px; cursor: pointer;
  }
  .ta-speedselect-action.primary {
    color: #07050f; background: #4de0ff; border-color: #ffffff;
  }
`;

export class SpeedSelect {
  constructor(onSelect, onCancel, initialSpeed = 1) {
    this.onSelect = onSelect;
    this.onCancel = onCancel;
    this.speed = Math.max(1, Math.min(MAX_START_SPEED, initialSpeed));
    this._onKeydown = (e) => this._handleKey(e);

    this._injectStyle();
    this._build();
    document.addEventListener('keydown', this._onKeydown, true);
  }

  _injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  _build() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'ta-speedselect-overlay';

    const card = document.createElement('div');
    card.id = 'ta-speedselect-card';

    card.appendChild(createLogo());

    const title = document.createElement('h2');
    title.id = 'ta-speedselect-title';
    title.textContent = 'STARTING SPEED';
    card.appendChild(title);

    const picker = document.createElement('div');
    picker.id = 'ta-speedselect-picker';

    this.leftArrow = document.createElement('span');
    this.leftArrow.className = 'ta-speedselect-arrow';
    this.leftArrow.textContent = '◀';
    this.leftArrow.addEventListener('click', () => this._adjust(-1));
    picker.appendChild(this.leftArrow);

    this.valueEl = document.createElement('span');
    this.valueEl.id = 'ta-speedselect-value';
    picker.appendChild(this.valueEl);

    this.rightArrow = document.createElement('span');
    this.rightArrow.className = 'ta-speedselect-arrow';
    this.rightArrow.textContent = '▶';
    this.rightArrow.addEventListener('click', () => this._adjust(1));
    picker.appendChild(this.rightArrow);

    card.appendChild(picker);

    this.descEl = document.createElement('p');
    this.descEl.id = 'ta-speedselect-desc';
    card.appendChild(this.descEl);

    const hint = document.createElement('p');
    hint.id = 'ta-speedselect-hint';
    hint.innerHTML = '&larr;&rarr; adjust &middot; Enter start &middot; Esc back';
    card.appendChild(hint);

    const actions = document.createElement('div');
    actions.id = 'ta-speedselect-actions';
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'ta-speedselect-action';
    backBtn.textContent = 'BACK';
    backBtn.addEventListener('click', () => { audio.play('cancel'); this.onCancel(); });
    const startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.className = 'ta-speedselect-action primary';
    startBtn.textContent = 'START';
    startBtn.addEventListener('click', () => {
      audio.play('confirm');
      this.onSelect(this.speed);
    });
    actions.appendChild(backBtn);
    actions.appendChild(startBtn);
    card.appendChild(actions);

    this.overlay.appendChild(card);
    document.body.appendChild(this.overlay);

    this._updateDisplay();
  }

  _adjust(delta) {
    const next = this.speed + delta;
    if (next >= 1 && next <= MAX_START_SPEED) {
      this.speed = next;
      // Only on a real change, so holding against a bound stays silent.
      audio.play('move');
      this._updateDisplay();
    }
  }

  _updateDisplay() {
    this.valueEl.textContent = String(this.speed);
    this.leftArrow.classList.toggle('disabled', this.speed <= 1);
    this.rightArrow.classList.toggle('disabled', this.speed >= MAX_START_SPEED);
    if (this.speed === 1) {
      this.descEl.textContent = 'Slow and steady';
    } else if (this.speed <= 3) {
      this.descEl.textContent = 'Easy';
    } else if (this.speed <= 6) {
      this.descEl.textContent = 'Medium';
    } else if (this.speed <= 8) {
      this.descEl.textContent = 'Fast';
    } else {
      this.descEl.textContent = 'Expert';
    }
  }

  _handleKey(e) {
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA':
        e.preventDefault(); this._adjust(-1); break;
      case 'ArrowRight': case 'KeyD':
        e.preventDefault(); this._adjust(1); break;
      case 'ArrowUp': case 'KeyW':
        e.preventDefault(); this._adjust(1); break;
      case 'ArrowDown': case 'KeyS':
        e.preventDefault(); this._adjust(-1); break;
      case 'Enter': case 'Space':
        e.preventDefault(); audio.play('confirm'); this.onSelect(this.speed); break;
      case 'Escape':
        e.preventDefault(); audio.play('cancel'); this.onCancel(); break;
      default: break;
    }
  }

  destroy() {
    document.removeEventListener('keydown', this._onKeydown, true);
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
  }
}
