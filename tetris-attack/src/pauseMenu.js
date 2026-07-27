// In-match pause menu (Step 11), replacing the debug-only pause toggle.
//
// Unlike the other overlays this one is deliberately translucent: the match is
// frozen behind it, and keeping the boards visible is what makes the screen read
// as "paused" rather than as a new screen. It also stays small and centred so it
// covers as little of the two stage frames as possible.

import { audio } from './audio.js';

const ITEMS = [
  { id: 'resume', label: 'Resume' },
  { id: 'restart', label: 'Restart' },
  { id: 'menu', label: 'Quit to Menu' },
];

const STYLE_ID = 'ta-pause-style';
const STYLE = `
  #ta-pause-overlay {
    position: fixed; inset: 0; z-index: 1000;
    display: flex; align-items: center; justify-content: center;
    background: rgba(7, 5, 15, 0.62);
    font-family: 'Press Start 2P', 'Courier New', monospace;
    color: #f4f4ff; user-select: none;
  }
  #ta-pause-card {
    text-align: center; padding: 26px 40px; min-width: 300px;
    background: rgba(10, 8, 24, 0.92);
    border: 3px solid #4de0ff;
    border-radius: 10px;
    box-shadow: 0 0 24px rgba(77, 224, 255, 0.35), inset 0 0 24px rgba(77, 224, 255, 0.08);
  }
  #ta-pause-title {
    color: #ffe14d; font-size: 20px; margin: 0 0 22px;
    letter-spacing: 2px;
  }
  #ta-pause-list { list-style: none; margin: 0; padding: 0; }
  #ta-pause-list li {
    font-size: 15px; padding: 10px 18px; margin: 6px auto; max-width: 240px;
    border: 2px solid transparent; border-radius: 6px; color: #c9c9e6;
    transition: color 0.08s, background 0.08s;
    cursor: pointer;
  }
  #ta-pause-list li.active {
    color: #07050f; background: #4de0ff; border-color: #ffffff;
    box-shadow: 0 0 14px rgba(77, 224, 255, 0.7);
  }
  #ta-pause-hint { margin: 22px 0 0; font-size: 10px; line-height: 1.7; color: #7b7ba6; }
`;

export class PauseMenu {
  // onChoice('resume' | 'restart' | 'menu')
  constructor(onChoice) {
    this.onChoice = onChoice;
    this.index = 0;
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
    this.overlay.id = 'ta-pause-overlay';

    const card = document.createElement('div');
    card.id = 'ta-pause-card';

    const title = document.createElement('h2');
    title.id = 'ta-pause-title';
    title.textContent = 'PAUSED';
    card.appendChild(title);

    const list = document.createElement('ul');
    list.id = 'ta-pause-list';
    this.itemEls = ITEMS.map((item, i) => {
      const li = document.createElement('li');
      li.textContent = item.label;
      if (i === this.index) li.className = 'active';
      li.addEventListener('mouseenter', () => this._setIndex(i));
      li.addEventListener('click', () => this._select());
      list.appendChild(li);
      return li;
    });
    card.appendChild(list);

    const hint = document.createElement('p');
    hint.id = 'ta-pause-hint';
    hint.innerHTML = '&uarr;&darr; select &middot; Enter confirm &middot; Esc resume';
    card.appendChild(hint);

    this.overlay.appendChild(card);
    document.body.appendChild(this.overlay);
  }

  _setIndex(i) {
    this.index = (i + ITEMS.length) % ITEMS.length;
    this.itemEls.forEach((el, n) => {
      el.className = n === this.index ? 'active' : '';
    });
  }

  _select() {
    this.onChoice(ITEMS[this.index].id);
  }

  _handleKey(e) {
    switch (e.code) {
      case 'ArrowUp': case 'KeyW':
        e.preventDefault(); audio.play('move'); this._setIndex(this.index - 1); break;
      case 'ArrowDown': case 'KeyS':
        e.preventDefault(); audio.play('move'); this._setIndex(this.index + 1); break;
      case 'Enter': case 'Space':
        e.preventDefault(); audio.play('confirm'); this._select(); break;
      // Esc and the pause key both back out of the menu, so the key that opened
      // it always closes it too.
      case 'Escape': case 'KeyP':
        e.preventDefault(); this.onChoice('resume'); break;
      default: break;
    }
    // Swallow everything else as well, so gameplay keys held down over the
    // pause menu never leak into the frozen match.
    e.stopPropagation();
  }

  destroy() {
    document.removeEventListener('keydown', this._onKeydown, true);
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
  }
}
