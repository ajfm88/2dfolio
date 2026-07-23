// Match results screen, shown once a board tops out.
// Deliberately translucent so the frozen playfields stay visible behind it.

const RESULT_ITEMS = [
  { id: 'replay', label: 'Play Again' },
  { id: 'menu', label: 'Back to Menu' },
];

const STYLE_ID = 'ta-gameover-style';
const STYLE = `
  #ta-gameover-overlay {
    position: fixed; inset: 0; z-index: 1000;
    display: flex; align-items: center; justify-content: center;
    background: rgba(7, 5, 15, 0.72);
    font-family: 'Press Start 2P', 'Courier New', monospace;
    color: #f4f4ff; user-select: none;
  }
  #ta-gameover-card {
    text-align: center; padding: 30px 46px; min-width: 340px;
    background: rgba(10, 8, 24, 0.92);
    border: 3px solid #ffe14d;
    border-radius: 10px;
    box-shadow: 0 0 28px rgba(255, 225, 77, 0.35), inset 0 0 24px rgba(255, 225, 77, 0.07);
  }
  #ta-gameover-title {
    margin: 0 0 12px; font-size: 24px; line-height: 1.4; color: #ffe14d;
    text-shadow: 0 3px 0 rgba(0, 0, 0, 0.6);
  }
  #ta-gameover-subtitle { margin: 0 0 14px; font-size: 10px; line-height: 1.8; color: #9a9ac4; }
  #ta-gameover-scores {
    margin: 0 0 22px; padding: 10px 0; font-size: 12px; line-height: 2;
    color: #c9c9e6; border-top: 1px solid #333; border-bottom: 1px solid #333;
  }
  #ta-gameover-scores .score-value { color: #ffe14d; }
  #ta-gameover-list { list-style: none; margin: 0; padding: 0; }
  #ta-gameover-list li {
    font-size: 15px; padding: 11px 18px; margin: 6px auto; max-width: 260px;
    border: 2px solid transparent; border-radius: 6px; color: #c9c9e6;
    transition: color 0.08s, background 0.08s;
  }
  #ta-gameover-list li.active {
    color: #07050f; background: #ffe14d; border-color: #ffffff;
    box-shadow: 0 0 14px rgba(255, 225, 77, 0.7);
  }
  #ta-gameover-hint { margin: 24px 0 0; font-size: 10px; line-height: 1.7; color: #7b7ba6; }
`;

export class GameOverOverlay {
  // result is { title, subtitle, scores }; onSelect(choiceId) receives 'replay' or 'menu'.
  // scores is an array of { label, value } objects.
  constructor({ title, subtitle, scores }, onSelect) {
    this.title = title;
    this.subtitle = subtitle;
    this.scores = scores || [];
    this.onSelect = onSelect;
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
    this.overlay.id = 'ta-gameover-overlay';

    const card = document.createElement('div');
    card.id = 'ta-gameover-card';

    const title = document.createElement('h1');
    title.id = 'ta-gameover-title';
    title.textContent = this.title;
    card.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.id = 'ta-gameover-subtitle';
    subtitle.textContent = this.subtitle;
    card.appendChild(subtitle);

    if (this.scores.length > 0) {
      const scoresDiv = document.createElement('div');
      scoresDiv.id = 'ta-gameover-scores';
      for (const s of this.scores) {
        const line = document.createElement('div');
        line.innerHTML = `${s.label}: <span class="score-value">${s.value.toLocaleString()}</span>`;
        scoresDiv.appendChild(line);
      }
      card.appendChild(scoresDiv);
    }

    const list = document.createElement('ul');
    list.id = 'ta-gameover-list';
    this.itemEls = RESULT_ITEMS.map((item, i) => {
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
    hint.id = 'ta-gameover-hint';
    hint.innerHTML = '&uarr;&darr; select &middot; Enter confirm &middot; Esc menu';
    card.appendChild(hint);

    this.overlay.appendChild(card);
    document.body.appendChild(this.overlay);
  }

  _setIndex(i) {
    this.itemEls[this.index].className = '';
    this.index = i;
    this.itemEls[this.index].className = 'active';
  }

  _move(delta) {
    const n = RESULT_ITEMS.length;
    this._setIndex((this.index + delta + n) % n);
  }

  _select() {
    this.onSelect(RESULT_ITEMS[this.index].id);
  }

  _handleKey(e) {
    switch (e.code) {
      case 'ArrowUp': case 'KeyW':
        e.preventDefault(); this._move(-1); break;
      case 'ArrowDown': case 'KeyS':
        e.preventDefault(); this._move(1); break;
      case 'Enter': case 'Space':
        e.preventDefault(); this._select(); break;
      case 'Escape':
        e.preventDefault(); this.onSelect('menu'); break;
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
