// Match results screen, rebuilt on the SNES VS-mode GAME OVER screen.
//
// `src/assets/gameover.png` was ripped by JigglypuffGirl ("Credit?: Yes, Free
// Use?: Yes"); the original art is (c) Nintendo / Intelligent Systems. The sheet
// carries the whole screen as one 256x224 background (GAME OVER logo baked in)
// plus loose sprites to composite on top, all on a (21,0,43) key colour.
//
// The original offers TRY AGAIN? / YES / NO, which map onto the two choices this
// game already had: YES replays the match, NO returns to the menu. YES and NO
// each ship in an orange and a blue copy -- that is the selected/unselected
// pair, and the reference screenshot confirms it (orange YES beside blue NO).
//
// Everything is drawn at native SNES resolution and scaled up by CSS, so the
// pixel art stays on whole pixels.

import { PixelFont } from './font.js';
import { drawWinPoints, rowWidth } from './winPoints.js';

const SHEET_URL = 'assets/gameover.png';
const KEY = [21, 0, 43]; // sheet background, keyed to transparent

const SCREEN_W = 256;
const SCREEN_H = 224;

// Source rects on the sheet, measured by decoding it (see CLAUDE.md).
const SPRITES = {
  background: { x: 5, y: 5, w: SCREEN_W, h: SCREEN_H },
  yoshi: { x: 271, y: 6, w: 192, h: 86 },
  // 19 tall, not 25: the red selection blob sits directly below from y=130 and
  // overlaps this sprite's x-range, so an over-tall rect drags its edge in.
  tryAgain: { x: 296, y: 106, w: 127, h: 19 },
  yesOn: { x: 298, y: 142, w: 40, h: 19 },
  noOn: { x: 342, y: 142, w: 35, h: 19 },
  yesOff: { x: 300, y: 166, w: 40, h: 19 },
  noOff: { x: 344, y: 166, w: 35, h: 19 },
};

// Placement on the 256x224 screen. The art has three bands: the logo down to
// y=69, a bright "floor" band y=82..142, then a dark band from y=148. Yoshi is
// bottom-aligned to the floor band; the prompt and choices sit in the dark one.
const LAYOUT = {
  yoshi: { x: 32, y: 62 },
  outcomeY: 61, // under the logo, in the top band
  scoresY: 152,
  tryAgain: { x: 64, y: 164 },
  choicesY: 196,
  yesX: 88,
  noX: 132, // the sheet spaces NO 44px after YES
  // Ending a *set* shows the win-point lamps instead of the score line: the
  // tally is the headline result, and the dark band has room for one or the
  // other, not both. The 15px lamps need six more pixels than the 6px score
  // line, so TRY AGAIN drops out of their way -- the choices below it do not
  // move, which keeps their hit-testing untouched.
  starsY: 150,
  tryAgainStarsY: 170,
  // Space between Player 1's lamps and Player 2's, so the two rows read as
  // two tallies rather than one long one.
  starGap: 40,
};

const CHOICES = [
  { id: 'replay', key: 'yes' },
  { id: 'menu', key: 'no' },
];

const STYLE_ID = 'ta-gameover-style';
const STYLE = `
  #ta-gameover-overlay {
    position: fixed; inset: 0; z-index: 1000;
    display: flex; align-items: center; justify-content: center;
    background: rgba(7, 5, 15, 0.82);
    user-select: none;
  }
  #ta-gameover-screen {
    width: min(92vw, 82vh * 256 / 224, 768px);
    aspect-ratio: 256 / 224;
    image-rendering: pixelated;
    cursor: pointer;
    box-shadow: 0 0 32px rgba(0, 0, 0, 0.8);
  }
`;

const sheet = new Image();
sheet.src = SHEET_URL;

export class GameOverOverlay {
  // result is { title, subtitle, scores, setWins?, winsNeeded? };
  // onSelect(choiceId) gets 'replay' or 'menu'. scores is an array of
  // { label, value }. setWins/winsNeeded are present only when a set just
  // finished, and swap the score line for the win-point lamps.
  constructor({ title, subtitle, scores, setWins, winsNeeded }, onSelect) {
    this.title = title;
    this.subtitle = subtitle;
    this.scores = scores || [];
    this.setWins = setWins || null;
    this.winsNeeded = winsNeeded || 0;
    this.onSelect = onSelect;
    this.index = 0;
    this.sprites = null;

    this.labelFont = new PixelFont('cyan');
    this.valueFont = new PixelFont('white');

    this._onKeydown = (e) => this._handleKey(e);
    this._injectStyle();
    this._build();
    document.addEventListener('keydown', this._onKeydown, true);

    this._draw();
    // The sheet may still be decoding on the first frame.
    if (!sheet.complete) {
      sheet.addEventListener('load', () => this._draw(), { once: true });
    }
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

    const canvas = document.createElement('canvas');
    canvas.id = 'ta-gameover-screen';
    canvas.width = SCREEN_W;
    canvas.height = SCREEN_H;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    canvas.addEventListener('mousemove', (e) => this._handleHover(e));
    canvas.addEventListener('click', (e) => {
      const hit = this._hitTest(e);
      if (hit >= 0) {
        this.index = hit;
        this._select();
      }
    });

    this.overlay.appendChild(canvas);
    document.body.appendChild(this.overlay);
  }

  // Cut each sprite out of the sheet once, keying the flat background colour to
  // transparent so the pieces composite onto the screen art.
  _buildSprites() {
    if (this.sprites || this.spritesFailed) return this.sprites;
    if (!sheet.complete || sheet.naturalWidth === 0) return null;

    try {
      const out = {};
      for (const [name, r] of Object.entries(SPRITES)) {
        const c = document.createElement('canvas');
        c.width = r.w;
        c.height = r.h;
        const cx = c.getContext('2d');
        cx.imageSmoothingEnabled = false;
        cx.drawImage(sheet, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
        // The full-screen background is opaque art, not a keyed sprite.
        if (name !== 'background') {
          const img = cx.getImageData(0, 0, r.w, r.h);
          const d = img.data;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i] === KEY[0] && d[i + 1] === KEY[1] && d[i + 2] === KEY[2]) {
              d[i + 3] = 0;
            }
          }
          cx.putImageData(img, 0, 0);
        }
        out[name] = c;
      }
      this.sprites = out;
    } catch (e) {
      // Sheet could not be read back (tainted canvas, e.g. served from file://).
      this.spritesFailed = true;
    }
    return this.sprites;
  }

  _draw() {
    const ctx = this.ctx;
    const sprites = this._buildSprites();
    if (!sprites) {
      this._drawFallback();
      return;
    }

    ctx.drawImage(sprites.background, 0, 0);
    ctx.drawImage(sprites.yoshi, LAYOUT.yoshi.x, LAYOUT.yoshi.y);

    const stars = this._drawWinPoints();
    ctx.drawImage(sprites.tryAgain, LAYOUT.tryAgain.x,
                  stars ? LAYOUT.tryAgainStarsY : LAYOUT.tryAgain.y);

    const yesSelected = this.index === 0;
    ctx.drawImage(yesSelected ? sprites.yesOn : sprites.yesOff, LAYOUT.yesX, LAYOUT.choicesY);
    ctx.drawImage(yesSelected ? sprites.noOff : sprites.noOn, LAYOUT.noX, LAYOUT.choicesY);

    // The logo already says GAME OVER, so only a result that adds something --
    // who won a two-board match -- is worth printing under it.
    if (this.title && this.title !== 'GAME OVER') {
      this._drawCentred(this.labelFont, this.title, LAYOUT.outcomeY);
    }
    if (!stars) {
      this._drawCentred(this.valueFont, this._scoreLine(), LAYOUT.scoresY);
    }
  }

  // The two tallies, side by side and centred as a pair. Returns false when
  // there is no set to show, or the lamps are not decoded yet -- in which case
  // the caller falls back to the score line and the normal TRY AGAIN position,
  // so a slow decode never leaves a hole in the screen.
  _drawWinPoints() {
    if (!this.setWins) return false;
    const total = this.winsNeeded;
    const each = rowWidth(total);
    const left = Math.round((SCREEN_W - (each * 2 + LAYOUT.starGap)) / 2);
    const drawn = drawWinPoints(this.ctx, left, LAYOUT.starsY,
                                { side: 'p1', won: this.setWins[0], total });
    if (!drawn) return false;
    drawWinPoints(this.ctx, left + each + LAYOUT.starGap, LAYOUT.starsY,
                  { side: 'p2', won: this.setWins[1], total });
    return true;
  }

  // "YOU 4550   AI 3200" -- the outcome detail the SNES screen has no room for.
  _scoreLine() {
    return this.scores.map((s) => `${s.label} ${s.value}`).join('   ');
  }

  _drawCentred(font, text, y) {
    if (!text || !font.ready()) return;
    const x = Math.max(2, Math.round((SCREEN_W - font.width(text)) / 2));
    font.draw(this.ctx, text, x, y);
  }

  // Shown only until gameover.png decodes, or if it can never be read back.
  _drawFallback() {
    const ctx = this.ctx;
    ctx.fillStyle = '#1818d0';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = '16px monospace';
    ctx.fillText(this.title || 'GAME OVER', SCREEN_W / 2, 100);
    ctx.font = '10px monospace';
    ctx.fillText('TRY AGAIN?', SCREEN_W / 2, 140);
    ctx.fillText(this.index === 0 ? '[YES]  NO' : 'YES  [NO]', SCREEN_W / 2, 165);
  }

  // Which choice, if any, is under the pointer. Returns -1 for neither.
  _hitTest(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SCREEN_W;
    const y = ((e.clientY - rect.top) / rect.height) * SCREEN_H;
    if (y < LAYOUT.choicesY || y > LAYOUT.choicesY + SPRITES.yesOn.h) return -1;
    if (x >= LAYOUT.yesX && x <= LAYOUT.yesX + SPRITES.yesOn.w) return 0;
    if (x >= LAYOUT.noX && x <= LAYOUT.noX + SPRITES.noOn.w) return 1;
    return -1;
  }

  _handleHover(e) {
    const hit = this._hitTest(e);
    if (hit >= 0) this._setIndex(hit);
  }

  _setIndex(i) {
    if (i === this.index) return;
    this.index = i;
    this._draw();
  }

  _move(delta) {
    this._setIndex((this.index + delta + CHOICES.length) % CHOICES.length);
  }

  _select() {
    this.onSelect(CHOICES[this.index].id);
  }

  _handleKey(e) {
    switch (e.code) {
      // YES and NO sit side by side, so left/right is the natural pairing --
      // up/down still works for anyone who learned the old vertical list.
      case 'ArrowLeft': case 'KeyA': case 'ArrowUp': case 'KeyW':
        e.preventDefault(); this._move(-1); break;
      case 'ArrowRight': case 'KeyD': case 'ArrowDown': case 'KeyS':
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
