// AI difficulty selector — a DOM overlay shown after character select in
// VS AI mode, before the starting-speed picker. EASY / NORMAL / HARD, the
// same three tiers the SNES offers on its own VS setup screen.

import { audio } from './audio.js';
import { MENU_BACKDROP_CSS, createLogo } from './backdrop.js';

const LEVELS = [
  { id: 'easy',   label: 'EASY',   color: '#7dff8a', desc: 'Slow hands, never presses the attack' },
  { id: 'normal', label: 'NORMAL', color: '#ffffff', desc: 'The classic opponent' },
  { id: 'hard',   label: 'HARD',   color: '#ff6b5e', desc: 'Fast hands, builds chains' },
];

const STYLE_ID = 'ta-diffselect-style';
const STYLE = `
  #ta-diffselect-overlay {
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
  #ta-diffselect-card {
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
  #ta-diffselect-title {
    color: #ffe14d; font-size: clamp(12px, 3.5vw, 15px); margin: 0 0 24px;
  }
  #ta-diffselect-picker {
    display: flex; align-items: center; justify-content: center;
    gap: 12px; margin: 0 0 20px;
  }
  .ta-diffselect-arrow {
    font-size: 28px; color: #4de0ff; cursor: pointer;
    transition: color 0.08s;
    width: 44px; min-height: 44px;
    display: flex; align-items: center; justify-content: center;
    text-align: center;
  }
  .ta-diffselect-arrow:hover { color: #ffffff; }
  .ta-diffselect-arrow.disabled { color: #3a3a5a; cursor: default; }
  #ta-diffselect-value {
    font-size: clamp(18px, 6vw, 30px); color: #ffffff;
    min-width: min(220px, 40vw);
    text-shadow: 0 0 12px rgba(77, 224, 255, 0.5);
  }
  #ta-diffselect-desc {
    color: #c9c9e6; font-size: 11px; margin: 0 0 20px;
    min-height: 16px;
  }
  #ta-diffselect-hint {
    font-size: clamp(9px, 2.4vw, 10px); color: #7b7ba6; margin: 0 0 16px;
    line-height: 1.7;
  }
  #ta-diffselect-actions {
    display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;
  }
  .ta-diffselect-action {
    min-height: 44px; min-width: 100px; padding: 10px 16px;
    font-family: inherit; font-size: clamp(10px, 2.8vw, 12px);
    color: #4de0ff; background: rgba(10, 8, 24, 0.6);
    border: 2px solid #4de0ff; border-radius: 6px; cursor: pointer;
  }
  .ta-diffselect-action.primary {
    color: #07050f; background: #4de0ff; border-color: #ffffff;
  }
`;

export class DifficultySelect {
  constructor(onSelect, onCancel, initialDifficulty = 'normal') {
    this.onSelect = onSelect;
    this.onCancel = onCancel;
    this.index = Math.max(0, LEVELS.findIndex(l => l.id === initialDifficulty));
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
    this.overlay.id = 'ta-diffselect-overlay';

    const card = document.createElement('div');
    card.id = 'ta-diffselect-card';

    card.appendChild(createLogo());

    const title = document.createElement('h2');
    title.id = 'ta-diffselect-title';
    title.textContent = 'AI DIFFICULTY';
    card.appendChild(title);

    const picker = document.createElement('div');
    picker.id = 'ta-diffselect-picker';

    this.leftArrow = document.createElement('span');
    this.leftArrow.className = 'ta-diffselect-arrow';
    this.leftArrow.textContent = '◀';
    this.leftArrow.addEventListener('click', () => this._adjust(-1));
    picker.appendChild(this.leftArrow);

    this.valueEl = document.createElement('span');
    this.valueEl.id = 'ta-diffselect-value';
    picker.appendChild(this.valueEl);

    this.rightArrow = document.createElement('span');
    this.rightArrow.className = 'ta-diffselect-arrow';
    this.rightArrow.textContent = '▶';
    this.rightArrow.addEventListener('click', () => this._adjust(1));
    picker.appendChild(this.rightArrow);

    card.appendChild(picker);

    this.descEl = document.createElement('p');
    this.descEl.id = 'ta-diffselect-desc';
    card.appendChild(this.descEl);

    const hint = document.createElement('p');
    hint.id = 'ta-diffselect-hint';
    hint.innerHTML = '&larr;&rarr; adjust &middot; Enter next &middot; Esc back';
    card.appendChild(hint);

    const actions = document.createElement('div');
    actions.id = 'ta-diffselect-actions';
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'ta-diffselect-action';
    backBtn.textContent = 'BACK';
    backBtn.addEventListener('click', () => { audio.play('cancel'); this.onCancel(); });
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'ta-diffselect-action primary';
    nextBtn.textContent = 'NEXT';
    nextBtn.addEventListener('click', () => {
      audio.play('confirm');
      this.onSelect(LEVELS[this.index].id);
    });
    actions.appendChild(backBtn);
    actions.appendChild(nextBtn);
    card.appendChild(actions);

    this.overlay.appendChild(card);
    document.body.appendChild(this.overlay);

    this._updateDisplay();
  }

  _adjust(delta) {
    const next = this.index + delta;
    if (next >= 0 && next < LEVELS.length) {
      this.index = next;
      // Only on a real change, so holding against a bound stays silent.
      audio.play('move');
      this._updateDisplay();
    }
  }

  _updateDisplay() {
    const level = LEVELS[this.index];
    this.valueEl.textContent = level.label;
    this.valueEl.style.color = level.color;
    this.descEl.textContent = level.desc;
    this.leftArrow.classList.toggle('disabled', this.index <= 0);
    this.rightArrow.classList.toggle('disabled', this.index >= LEVELS.length - 1);
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
        e.preventDefault(); audio.play('confirm'); this.onSelect(LEVELS[this.index].id); break;
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
