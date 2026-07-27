// Main menu / mode-select, rebuilt as an ES6 module.
// Concept ported from tetris-attack-ai's UI.js + MenuListener.js (Luciano Rubio, 2014),
// reimplemented here as a self-contained DOM overlay instead of global-script code.

// Playable modes call back into the app; info items open an in-menu panel.

import { audio } from './audio.js';

const MENU_ITEMS = [
  { id: 'vsai', label: 'VS AI', play: true },
  { id: '1p', label: '1P Endless', play: true },
  { id: '2p', label: '2P Local', play: true },
  { id: 'howto', label: 'How to Play', play: false },
  { id: 'credits', label: 'Credits', play: false },
];

const HOWTO_HTML = `
  <h2>How to Play</h2>
  <p>Swap adjacent panels to line up <b>3 or more</b> of the same color.
     Clear them before the rising stack reaches the top.
     Combos and chains send garbage blocks to your opponent.</p>
  <table>
    <tr><th></th><th>Player 1</th><th>Player 2</th></tr>
    <tr><td>Move</td><td>Arrow Keys</td><td>W A S D</td></tr>
    <tr><td>Swap</td><td>Space</td><td>G</td></tr>
    <tr><td>Raise stack</td><td>Right Shift</td><td>H</td></tr>
  </table>
  <p class="dim">Pause: <b>Esc</b> or <b>P</b> &middot; Mute: <b>M</b> &middot; Frame-step: <b>F</b></p>
  <p class="back">&laquo; Esc / Enter to go back</p>
`;

const CREDITS_HTML = `
  <h2>Credits</h2>
  <p>A "best-of" build assembled on top of
     <b>player-vs-ai-tetris-attack</b> (2021).</p>
  <ul>
    <li>Menu &amp; mode-select concept &mdash; <i>tetris-attack-ai</i>, Luciano Rubio (2014)</li>
    <li>Scoring &amp; faithful timing ideas &mdash; <i>normal-tetris-attack</i>, Tijmen Zwaan (2015)</li>
  </ul>
  <p class="dim">Tetris Attack / Panel de Pon is &copy; Nintendo. This is a fan re-implementation.</p>
  <p class="back">&laquo; Esc / Enter to go back</p>
`;

const STYLE_ID = 'ta-menu-style';
const STYLE = `
  #ta-menu-overlay {
    position: fixed; inset: 0; z-index: 1000;
    display: flex; align-items: center; justify-content: center;
    background: radial-gradient(circle at 50% 35%, #2a2350 0%, #100c22 70%, #07050f 100%);
    font-family: 'Press Start 2P', 'Courier New', monospace;
    color: #f4f4ff; user-select: none;
  }
  #ta-menu-card {
    text-align: center; padding: 32px 44px; min-width: 340px;
    background: rgba(10, 8, 24, 0.72);
    border: 3px solid #4de0ff;
    border-radius: 10px;
    box-shadow: 0 0 24px rgba(77, 224, 255, 0.35), inset 0 0 24px rgba(77, 224, 255, 0.08);
  }
  #ta-menu-logo {
    display: block; margin: 4px auto 26px;
    width: 326px; max-width: 82%; height: auto;
    /* Keep the pixel-art logo crisp when scaled up. */
    image-rendering: pixelated;
    filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.6));
  }
  #ta-menu-list { list-style: none; margin: 0; padding: 0; }
  #ta-menu-list li {
    font-size: 17px; padding: 11px 18px; margin: 6px auto; max-width: 260px;
    border: 2px solid transparent; border-radius: 6px; color: #c9c9e6;
    transition: color 0.08s, background 0.08s;
  }
  #ta-menu-list li.active {
    color: #07050f; background: #4de0ff; border-color: #ffffff;
    box-shadow: 0 0 14px rgba(77, 224, 255, 0.7);
  }
  #ta-menu-hint { margin: 26px 0 0; font-size: 10px; line-height: 1.7; color: #7b7ba6; }
  #ta-menu-panel { text-align: left; max-width: 520px; }
  #ta-menu-panel h2 { color: #ffe14d; font-size: 18px; margin: 0 0 16px; text-align: center; }
  #ta-menu-panel p { font-size: 11px; line-height: 1.9; color: #d0d0ee; }
  #ta-menu-panel ul { font-size: 11px; line-height: 2; color: #d0d0ee; padding-left: 18px; }
  #ta-menu-panel table { font-size: 11px; margin: 14px auto; border-collapse: collapse; width: 100%; }
  #ta-menu-panel th, #ta-menu-panel td { padding: 6px 12px; text-align: left; }
  #ta-menu-panel th { color: #4de0ff; }
  #ta-menu-panel td:first-child { color: #ffe14d; }
  #ta-menu-panel .dim { color: #8888b0; font-size: 10px; }
  #ta-menu-panel .back { color: #7b7ba6; font-size: 10px; text-align: center; margin-top: 20px; }
`;

export class Menu {
  // onSelect(modeId) is called when a playable mode is chosen.
  constructor(onSelect) {
    this.onSelect = onSelect;
    this.index = 0;
    this.panel = null; // 'howto' | 'credits' | null
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
    this.overlay.id = 'ta-menu-overlay';

    this.card = document.createElement('div');
    this.card.id = 'ta-menu-card';
    this.overlay.appendChild(this.card);

    document.body.appendChild(this.overlay);
    this._renderList();
  }

  _renderList() {
    this.panel = null;
    this.card.innerHTML = '';

    const logo = document.createElement('img');
    logo.id = 'ta-menu-logo';
    logo.src = 'assets/logo.png';
    logo.alt = 'TETRIS ATTACK';
    this.card.appendChild(logo);

    const list = document.createElement('ul');
    list.id = 'ta-menu-list';
    this.itemEls = MENU_ITEMS.map((item, i) => {
      const li = document.createElement('li');
      li.textContent = item.label;
      if (i === this.index) li.className = 'active';
      // Mouse support: hover highlights, click selects.
      li.addEventListener('mouseenter', () => this._setIndex(i));
      li.addEventListener('click', () => this._select());
      list.appendChild(li);
      return li;
    });
    this.card.appendChild(list);

    const hint = document.createElement('p');
    hint.id = 'ta-menu-hint';
    hint.innerHTML = '&uarr;&darr; select &middot; Enter start';
    this.card.appendChild(hint);
  }

  _renderPanel(which) {
    this.panel = which;
    this.card.innerHTML = '';
    const panel = document.createElement('div');
    panel.id = 'ta-menu-panel';
    panel.innerHTML = which === 'howto' ? HOWTO_HTML : CREDITS_HTML;
    // Clicking a panel closes it, matching the Esc/Enter hint.
    panel.addEventListener('click', () => this._renderList());
    this.card.appendChild(panel);
  }

  _setIndex(i) {
    if (this.panel) return;
    this.itemEls[this.index].className = '';
    this.index = i;
    this.itemEls[this.index].className = 'active';
  }

  _move(delta) {
    const n = MENU_ITEMS.length;
    this._setIndex((this.index + delta + n) % n);
  }

  _select() {
    const item = MENU_ITEMS[this.index];
    if (item.play) {
      this.onSelect(item.id);
    } else {
      this._renderPanel(item.id);
    }
  }

  _handleKey(e) {
    // If an info panel is open, only Esc/Enter/Space close it.
    if (this.panel) {
      if (['Escape', 'Enter', 'Space'].includes(e.code)) {
        e.preventDefault();
        this._renderList();
      }
      return;
    }

    switch (e.code) {
      case 'ArrowUp': case 'KeyW':
        e.preventDefault(); audio.play('move'); this._move(-1); break;
      case 'ArrowDown': case 'KeyS':
        e.preventDefault(); audio.play('move'); this._move(1); break;
      case 'Enter': case 'Space':
        e.preventDefault(); audio.play('confirm'); this._select(); break;
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
