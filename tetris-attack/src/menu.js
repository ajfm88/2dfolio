// Main menu / mode-select, rebuilt as an ES6 module.
// Concept ported from tetris-attack-ai's UI.js + MenuListener.js (Luciano Rubio, 2014),
// reimplemented here as a self-contained DOM overlay instead of global-script code.

// Playable modes call back into the app; info items open an in-menu panel.

import { audio } from './audio.js';
import { MENU_BACKDROP_CSS } from './backdrop.js';

// `play` starts a match; `app` hands the item to the App (which owns the
// screen); anything else opens an in-menu info panel.
const MENU_ITEMS = [
  { id: '1p', label: '1P Endless', play: true },
  { id: 'vsai', label: '1P VS AI', play: true },
  { id: '2p', label: '2P Local', play: true },
  { id: 'settings', label: 'Settings', app: true },
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
  <p class="dim">On phones: on-screen D-pad, Swap, Raise, Pause, Mute</p>
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

// The mode list stands straight on the poster, with no card behind it -- tried
// against the framed card on 2026-07-29 and kept. Flip this to false for the
// card back; everything it changes hangs off the `ta-bare` class.
//
// It works because the list sits over the poster's lower half, which is dark:
// sampled through the 38% dim, the art behind the rows runs 54-107 mean
// luminance and peaks at 158, so light text with a hard black halo has room.
// Moving the list up over the logo, or lightening the dim much further, would
// take that away.
//
// The info panels (How to Play / Credits) keep the card regardless: they are
// dense paragraphs and a table, and those are not readable over artwork.
const BARE_MENU = true;

const STYLE_ID = 'ta-menu-style';
const STYLE = `
  #ta-menu-overlay {
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
  /* With no card in the way the art carries the screen, so it is dimmed much
     less than the other overlays dim it. This wins over MENU_BACKDROP_CSS's
     own shadow by coming later. */
  #ta-menu-overlay.ta-bare-bg {
    box-shadow: inset 0 0 0 100vmax rgba(7, 5, 15, 0.38);
    align-items: flex-end;
  }
  #ta-menu-card {
    margin: auto;
    text-align: center;
    padding: clamp(16px, 4vw, 32px) clamp(16px, 5vw, 44px);
    width: min(100%, 340px);
    box-sizing: border-box;
    background: rgba(10, 8, 24, 0.72);
    border: 3px solid #4de0ff;
    border-radius: 10px;
    box-shadow: 0 0 24px rgba(77, 224, 255, 0.35), inset 0 0 24px rgba(77, 224, 255, 0.08);
    /* The card arrives as the title poster dims behind it, which is what makes
       the intro read as one movement rather than a screen swap. Timed to land
       inside the title screen's own fade. */
    animation: ta-menu-rise 700ms ease-out both;
  }
  @keyframes ta-menu-rise {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    #ta-menu-card { animation-duration: 1ms; }
  }
  /* --- the bare treatment ------------------------------------------------ */
  /* The poster carries its own logo, so the pixel one is redundant here, and
     the list moves down off the artwork's title into the panels below it. */
  #ta-menu-card.ta-bare {
    background: none; border: none; box-shadow: none;
    padding: 0 24px; margin-bottom: 7vh; min-width: 0;
  }
  #ta-menu-card.ta-bare #ta-menu-logo { display: none; }
  /* Nothing behind the text now, so it gets its own weight: a hard dark halo
     rather than a panel. */
  #ta-menu-card.ta-bare #ta-menu-list li {
    text-shadow:
      0 0 6px rgba(0, 0, 0, 0.95), 0 2px 0 rgba(0, 0, 0, 0.9),
      2px 0 0 rgba(0, 0, 0, 0.9), -2px 0 0 rgba(0, 0, 0, 0.9),
      0 -2px 0 rgba(0, 0, 0, 0.9);
    color: #eaeaff;
    margin: 3px auto;
  }
  #ta-menu-card.ta-bare #ta-menu-list li.active {
    color: #ffe14d;
    background: none; border-color: transparent; box-shadow: none;
    text-shadow:
      0 0 10px rgba(0, 0, 0, 1), 0 2px 0 rgba(0, 0, 0, 0.95),
      2px 0 0 rgba(0, 0, 0, 0.95), -2px 0 0 rgba(0, 0, 0, 0.95),
      0 -2px 0 rgba(0, 0, 0, 0.95);
  }
  /* The cursor replaces the highlight bar the card version used. */
  #ta-menu-card.ta-bare #ta-menu-list li.active::before {
    content: '\\25B6'; margin-right: 12px; color: #4de0ff;
  }
  #ta-menu-card.ta-bare #ta-menu-list li:not(.active)::before {
    content: '\\25B6'; margin-right: 12px; color: transparent;
  }
  #ta-menu-card.ta-bare #ta-menu-hint {
    margin-top: 16px;
    text-shadow: 0 0 6px rgba(0, 0, 0, 0.95), 0 1px 0 rgba(0, 0, 0, 0.9);
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
    font-size: clamp(13px, 3.6vw, 17px); padding: 12px 18px; margin: 6px auto;
    max-width: 260px; min-height: 44px; box-sizing: border-box;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid transparent; border-radius: 6px; color: #c9c9e6;
    transition: color 0.08s, background 0.08s;
    cursor: pointer;
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
  // onSelect(id) is called for a playable mode and for the app-owned screens
  // (Settings); the info panels are handled in here.
  // `initialId` is how coming back from Settings lands on Settings again rather
  // than jumping the cursor to the top of the list. Unknown ids start at the top.
  constructor(onSelect, initialId = null) {
    this.onSelect = onSelect;
    this.index = Math.max(0, MENU_ITEMS.findIndex((item) => item.id === initialId));
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

  // The list is the only screen that goes bare; the panels below keep the card.
  _setBare(bare) {
    const on = bare && BARE_MENU;
    this.card.classList.toggle('ta-bare', on);
    this.overlay.classList.toggle('ta-bare-bg', on);
  }

  _renderList() {
    this.panel = null;
    this._setBare(true);
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
    this._setBare(false);
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
    if (item.play || item.app) {
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
