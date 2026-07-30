// Between-rounds screen for VS and 2P set play.
//
// Shown when a round ends but the set is still live; the set's last round goes
// to the full GAME OVER screen instead. Deliberately translucent and small, like
// the pause menu: the boards are frozen behind it on their WIN!/LOSE signs and
// final character poses, and covering that up would waste the moment.
//
// The win-point lamps are the point of the screen -- the round just won lights
// up here, which is the only place that animation plays.

import { audio } from './audio.js';
import { PixelFont } from './font.js';
import { drawWinPoints, rowWidth, rowHeight, ANIM_TICKS } from './winPoints.js';

const ITEMS = [
  { id: 'next', label: 'Next Round' },
  { id: 'menu', label: 'Quit to Menu' },
];

// Native pixels of the lamp canvas, scaled up by CSS so the art stays crisp.
const PAD = 6;
const LABEL_W = 28;   // 3 chars of the chunky font (24px) plus a little air
const ROW_GAP = 5;
const SCALE = 3;

const TICK_MS = 1000 / 60;

const STYLE_ID = 'ta-roundover-style';
const STYLE = `
  #ta-roundover-overlay {
    position: fixed; inset: 0; z-index: 1000;
    display: flex; align-items: center; justify-content: center;
    background: rgba(7, 5, 15, 0.62);
    font-family: 'Press Start 2P', 'Courier New', monospace;
    color: #f4f4ff; user-select: none;
  }
  #ta-roundover-card {
    text-align: center; padding: 24px 36px; min-width: 320px;
    background: rgba(10, 8, 24, 0.92);
    border: 3px solid #4de0ff;
    border-radius: 10px;
    box-shadow: 0 0 24px rgba(77, 224, 255, 0.35), inset 0 0 24px rgba(77, 224, 255, 0.08);
  }
  #ta-roundover-round { color: #7b7ba6; font-size: 10px; margin: 0 0 8px; letter-spacing: 2px; }
  #ta-roundover-title { color: #ffe14d; font-size: 18px; margin: 0 0 18px; letter-spacing: 2px; }
  #ta-roundover-stars { display: block; margin: 0 auto 18px; image-rendering: pixelated; }
  #ta-roundover-list { list-style: none; margin: 0; padding: 0; }
  #ta-roundover-list li {
    font-size: 13px; padding: 9px 18px; margin: 5px auto; max-width: 240px;
    border: 2px solid transparent; border-radius: 6px; color: #c9c9e6;
    transition: color 0.08s, background 0.08s;
    cursor: pointer;
  }
  #ta-roundover-list li.active {
    color: #07050f; background: #4de0ff; border-color: #ffffff;
    box-shadow: 0 0 14px rgba(77, 224, 255, 0.7);
  }
  #ta-roundover-hint { margin: 18px 0 0; font-size: 10px; line-height: 1.7; color: #7b7ba6; }
`;

export class RoundOver {
  // info is:
  //   { round, title, labels: [p1, p2], wins: [n, n], winsNeeded, awarded }
  // `awarded` is the index of the side that just took a point (null on a draw);
  // that side's newest lamp is the one that animates.
  // onChoice('next' | 'menu')
  constructor(info, onChoice) {
    this.info = info;
    this.onChoice = onChoice;
    this.index = 0;
    this.anim = info.awarded === null || info.awarded === undefined ? ANIM_TICKS : 0;

    this.labelFont = new PixelFont('cyan');

    this._onKeydown = (e) => this._handleKey(e);
    this._injectStyle();
    this._build();
    document.addEventListener('keydown', this._onKeydown, true);
    this._startAnimation();
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
    this.overlay.id = 'ta-roundover-overlay';

    const card = document.createElement('div');
    card.id = 'ta-roundover-card';

    const round = document.createElement('p');
    round.id = 'ta-roundover-round';
    round.textContent = `ROUND ${this.info.round}`;
    card.appendChild(round);

    const title = document.createElement('h2');
    title.id = 'ta-roundover-title';
    title.textContent = this.info.title;
    card.appendChild(title);

    const total = this.info.winsNeeded;
    const canvas = document.createElement('canvas');
    canvas.id = 'ta-roundover-stars';
    canvas.width = PAD * 2 + LABEL_W + rowWidth(total);
    canvas.height = PAD * 2 + rowHeight() * 2 + ROW_GAP;
    canvas.style.width = `${canvas.width * SCALE}px`;
    canvas.style.height = `${canvas.height * SCALE}px`;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    card.appendChild(canvas);

    const list = document.createElement('ul');
    list.id = 'ta-roundover-list';
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
    hint.id = 'ta-roundover-hint';
    hint.innerHTML = '&uarr;&darr; select &middot; Enter confirm';
    card.appendChild(hint);

    this.overlay.appendChild(card);
    document.body.appendChild(this.overlay);

    this._draw();
  }

  // Time-based rather than tick-counting, so a throttled tab still reaches the
  // end state promptly instead of freezing the lamp part-lit.
  _startAnimation() {
    if (this.anim >= ANIM_TICKS) return;
    const start = Date.now();
    this._timer = setInterval(() => {
      const t = Math.floor((Date.now() - start) / TICK_MS);
      this.anim = Math.min(ANIM_TICKS, t);
      if (this.anim >= ANIM_TICKS) this._stopAnimation();
      this._draw();
    }, 16);
  }

  _stopAnimation() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  _draw() {
    const ctx = this.ctx;
    const total = this.info.winsNeeded;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let side = 0; side < 2; side++) {
      const y = PAD + side * (rowHeight() + ROW_GAP);
      // The label sits on the lamp row's vertical centre.
      if (this.labelFont.ready()) {
        this.labelFont.draw(ctx, this.info.labels[side], PAD,
                            y + Math.floor((rowHeight() - this.labelFont.height()) / 2));
      }
      drawWinPoints(ctx, PAD + LABEL_W, y, {
        side: side === 0 ? 'p1' : 'p2',
        won: this.info.wins[side],
        total,
        anim: this.info.awarded === side ? this.anim : null,
      });
    }
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
      case 'Escape':
        e.preventDefault(); audio.play('cancel'); this.onChoice('menu'); break;
      default: break;
    }
    e.stopPropagation();
  }

  destroy() {
    this._stopAnimation();
    document.removeEventListener('keydown', this._onKeydown, true);
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
  }
}
