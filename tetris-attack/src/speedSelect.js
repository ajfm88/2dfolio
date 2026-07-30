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
    display: flex; align-items: center; justify-content: center;
    ${MENU_BACKDROP_CSS}
    font-family: 'Press Start 2P', 'Courier New', monospace;
    color: #f4f4ff; user-select: none;
  }
  #ta-speedselect-card {
    text-align: center; padding: 28px 44px;
    background: rgba(10, 8, 24, 0.72);
    border: 3px solid #4de0ff;
    border-radius: 10px;
    box-shadow: 0 0 24px rgba(77, 224, 255, 0.35), inset 0 0 24px rgba(77, 224, 255, 0.08);
  }
  #ta-speedselect-title {
    color: #ffe14d; font-size: 15px; margin: 0 0 24px;
  }
  #ta-speedselect-picker {
    display: flex; align-items: center; justify-content: center;
    gap: 20px; margin: 0 0 20px;
  }
  .ta-speedselect-arrow {
    font-size: 28px; color: #4de0ff; cursor: pointer;
    transition: color 0.08s;
    width: 36px; text-align: center;
  }
  .ta-speedselect-arrow:hover { color: #ffffff; }
  .ta-speedselect-arrow.disabled { color: #3a3a5a; cursor: default; }
  #ta-speedselect-value {
    font-size: 48px; color: #ffffff;
    min-width: 80px;
    text-shadow: 0 0 12px rgba(77, 224, 255, 0.5);
  }
  #ta-speedselect-desc {
    color: #c9c9e6; font-size: 11px; margin: 0 0 20px;
    min-height: 16px;
  }
  #ta-speedselect-hint {
    font-size: 10px; color: #7b7ba6; margin: 0;
    line-height: 1.7;
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
