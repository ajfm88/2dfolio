// Character selection screen — a DOM overlay in the same style as the menu.
// The player picks one character; the caller chains multiple rounds for 2P.

import { CHARACTERS, PORTRAIT_SIZE, sheet, buildPortraits } from './characters.js';
import { stageById } from './stages.js';
import { audio } from './audio.js';
import { MENU_BACKDROP_CSS, createLogo } from './backdrop.js';

const COLS = 4;
const CELL_PX = 80;

const STYLE_ID = 'ta-charselect-style';
const STYLE = `
  #ta-charselect-overlay {
    position: fixed; inset: 0; z-index: 1000;
    /* flex-start plus auto margins on the card, rather than align-items:center:
       centred content in a scrolling flex container has its top edge clipped
       and unreachable. This card is the tallest screen in the game -- logo,
       13 portraits and three lines of caption -- so it is the one that will
       actually overflow a short window. */
    display: flex; align-items: flex-start; justify-content: center;
    overflow: auto;
    ${MENU_BACKDROP_CSS}
    font-family: 'Press Start 2P', 'Courier New', monospace;
    color: #f4f4ff; user-select: none;
  }
  #ta-charselect-card {
    text-align: center; padding: 22px 32px; margin: auto;
    background: rgba(10, 8, 24, 0.72);
    border: 3px solid #4de0ff;
    border-radius: 10px;
    box-shadow: 0 0 24px rgba(77, 224, 255, 0.35), inset 0 0 24px rgba(77, 224, 255, 0.08);
  }
  #ta-charselect-title {
    color: #ffe14d; font-size: 15px; margin: 0 0 16px;
  }
  .ta-charselect-grid {
    display: grid;
    grid-template-columns: repeat(${COLS}, ${CELL_PX}px);
    gap: 10px;
    justify-content: center;
    margin: 0 auto 14px;
  }
  .ta-charselect-cell {
    width: ${CELL_PX}px; height: ${CELL_PX}px;
    border: 3px solid rgba(200, 200, 230, 0.15); border-radius: 6px;
    background: rgba(20, 16, 40, 0.6);
    display: flex; align-items: center; justify-content: center;
    transition: border-color 0.08s, box-shadow 0.08s;
    cursor: pointer;
    box-sizing: border-box;
  }
  .ta-charselect-cell.active {
    border-color: #4de0ff;
    box-shadow: 0 0 14px rgba(77, 224, 255, 0.7);
    background: rgba(77, 224, 255, 0.12);
  }
  .ta-charselect-cell:last-child {
    grid-column: 1 / -1;
    justify-self: center;
  }
  .ta-charselect-cell canvas {
    width: ${CELL_PX - 10}px; height: ${CELL_PX - 10}px;
    image-rendering: pixelated;
  }
  #ta-charselect-name {
    color: #4de0ff; font-size: 14px; margin: 6px 0 2px;
    min-height: 20px;
  }
  #ta-charselect-stage {
    color: #c9c9e6; font-size: 11px; margin: 2px 0 14px;
    min-height: 16px;
  }
  #ta-charselect-hint {
    font-size: 10px; color: #7b7ba6; margin: 0;
    line-height: 1.7;
  }
`;

export class CharSelect {
  constructor(title, onSelect, onCancel) {
    this.title = title;
    this.onSelect = onSelect;
    this.onCancel = onCancel;
    this.index = 0;
    this._prevCol = 1;
    this._onKeydown = (e) => this._handleKey(e);

    this._injectStyle();
    this._build();
    document.addEventListener('keydown', this._onKeydown, true);

    if (!sheet.complete) {
      sheet.addEventListener('load', () => this._renderPortraits(), { once: true });
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
    this.overlay.id = 'ta-charselect-overlay';

    const card = document.createElement('div');
    card.id = 'ta-charselect-card';

    card.appendChild(createLogo());

    const heading = document.createElement('h2');
    heading.id = 'ta-charselect-title';
    heading.textContent = this.title;
    card.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'ta-charselect-grid';

    this.cells = CHARACTERS.map((char, i) => {
      const cell = document.createElement('div');
      cell.className = 'ta-charselect-cell' + (i === 0 ? ' active' : '');

      const canvas = document.createElement('canvas');
      canvas.width = PORTRAIT_SIZE;
      canvas.height = PORTRAIT_SIZE;
      cell.appendChild(canvas);
      cell._canvas = canvas;

      cell.addEventListener('mouseenter', () => this._setIndex(i));
      cell.addEventListener('click', () => { this._setIndex(i); this._select(); });

      grid.appendChild(cell);
      return cell;
    });
    card.appendChild(grid);

    this.nameEl = document.createElement('p');
    this.nameEl.id = 'ta-charselect-name';
    card.appendChild(this.nameEl);

    this.stageEl = document.createElement('p');
    this.stageEl.id = 'ta-charselect-stage';
    card.appendChild(this.stageEl);

    const hint = document.createElement('p');
    hint.id = 'ta-charselect-hint';
    hint.innerHTML = '&uarr;&darr;&larr;&rarr; move &middot; Enter select &middot; Esc back';
    card.appendChild(hint);

    this.overlay.appendChild(card);
    document.body.appendChild(this.overlay);

    this._renderPortraits();
    this._updateInfo();
  }

  _renderPortraits() {
    const portraits = buildPortraits();
    if (!portraits) return;

    this.cells.forEach((cell, i) => {
      const ctx = cell._canvas.getContext('2d');
      ctx.clearRect(0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE);
      ctx.drawImage(portraits[i], 0, 0);
    });
  }

  _updateInfo() {
    const char = CHARACTERS[this.index];
    this.nameEl.textContent = char.name;
    if (char.stageId) {
      const stage = stageById(char.stageId);
      this.stageEl.textContent = 'Stage: ' + (stage ? stage.name : char.stageId);
    } else {
      this.stageEl.textContent = 'Stage: Random';
    }
  }

  _setIndex(i) {
    if (i === this.index) return;
    this.cells[this.index].classList.remove('active');
    this.index = i;
    this.cells[this.index].classList.add('active');
    this._updateInfo();
  }

  _navigate(dx, dy) {
    const last = CHARACTERS.length - 1; // Bowser

    if (this.index === last) {
      if (dy < 0) {
        const col = this._prevCol !== undefined ? this._prevCol : 1;
        this._setIndex(Math.floor(last / COLS) * COLS - COLS + col);
      }
      return;
    }

    const row = Math.floor(this.index / COLS);
    const col = this.index % COLS;

    if (dx !== 0) {
      const nc = col + dx;
      if (nc >= 0 && nc < COLS) {
        this._setIndex(row * COLS + nc);
      }
    }

    if (dy !== 0) {
      const lastFullRow = Math.floor((last - 1) / COLS);
      const nr = row + dy;
      if (nr >= 0 && nr <= lastFullRow) {
        this._setIndex(nr * COLS + col);
      } else if (nr > lastFullRow) {
        this._prevCol = col;
        this._setIndex(last);
      }
    }
  }

  _select() {
    // The character's own SNES voice clip. The overlay is torn down right
    // after this, but the sound is Web Audio and outlives the DOM node.
    audio.playCharacter(CHARACTERS[this.index].id);
    this.onSelect(CHARACTERS[this.index]);
  }

  _handleKey(e) {
    switch (e.code) {
      // The move blip is keyboard-only on purpose: _setIndex also fires on
      // mouse hover, and running it there machine-guns as the pointer crosses
      // the grid.
      case 'ArrowUp':    case 'KeyW':
        e.preventDefault(); audio.play('move'); this._navigate(0, -1); break;
      case 'ArrowDown':  case 'KeyS':
        e.preventDefault(); audio.play('move'); this._navigate(0, 1); break;
      case 'ArrowLeft':  case 'KeyA':
        e.preventDefault(); audio.play('move'); this._navigate(-1, 0); break;
      case 'ArrowRight': case 'KeyD':
        e.preventDefault(); audio.play('move'); this._navigate(1, 0); break;
      case 'Enter': case 'Space':
        e.preventDefault(); this._select(); break;
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
