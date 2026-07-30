// Settings screen (the rest of Step 11), reached from the main menu.
//
// Two kinds of row: a *value* row that left/right cycles through options, and an
// *action* row (Back) that Enter triggers. Up/down moves between them, which is
// the one place this differs from the speed picker -- there, with a single value
// to set, up/down adjusted it too.
//
// Every change is written straight through to settings.js, so there is no
// save/cancel: what you see is already in effect. That is why the volume row
// plays a blip as it moves -- it is the only way to hear what you are setting.
//
// The controls reference at the bottom is read-only. Remapping is a bigger job
// (input.js binds by KeyboardEvent.code in three places), and the immediate
// problem it solves is discoverability: mute-on-M was documented nowhere the
// player could see.

import { audio } from './audio.js';
import { MENU_BACKDROP_CSS } from './backdrop.js';
import { get as getSetting, update as updateSettings, MATCH_LENGTHS, VOLUME_STEP } from './settings.js';

// A set length reads better as "Best of 5" than "5", and 1 is not a set at all.
function matchLengthLabel(n) {
  return n === 1 ? 'Single game' : `Best of ${n}`;
}

const CONTROLS_HTML = `
  <table>
    <tr><th></th><th>Player 1</th><th>Player 2</th></tr>
    <tr><td>Move</td><td>Arrow Keys</td><td>W A S D</td></tr>
    <tr><td>Swap</td><td>Space</td><td>G</td></tr>
    <tr><td>Raise stack</td><td>Right Shift</td><td>H</td></tr>
  </table>
  <p class="dim">Pause: <b>Esc</b> or <b>P</b> &middot; Mute: <b>M</b> &middot; Frame-step: <b>F</b></p>
`;

const STYLE_ID = 'ta-settings-style';
const STYLE = `
  #ta-settings-overlay {
    position: fixed; inset: 0; z-index: 1000;
    display: flex; align-items: center; justify-content: center;
    ${MENU_BACKDROP_CSS}
    font-family: 'Press Start 2P', 'Courier New', monospace;
    color: #f4f4ff; user-select: none;
  }
  #ta-settings-card {
    text-align: center; padding: 28px 40px; min-width: 420px;
    background: rgba(10, 8, 24, 0.72);
    border: 3px solid #4de0ff;
    border-radius: 10px;
    box-shadow: 0 0 24px rgba(77, 224, 255, 0.35), inset 0 0 24px rgba(77, 224, 255, 0.08);
  }
  #ta-settings-title { color: #ffe14d; font-size: 15px; margin: 0 0 24px; letter-spacing: 2px; }
  #ta-settings-list { list-style: none; margin: 0; padding: 0; }
  #ta-settings-list li {
    display: flex; align-items: center; justify-content: space-between; gap: 18px;
    font-size: 12px; padding: 10px 14px; margin: 4px 0;
    border: 2px solid transparent; border-radius: 6px; color: #c9c9e6;
    transition: color 0.08s, background 0.08s;
    cursor: pointer;
  }
  #ta-settings-list li.active {
    color: #07050f; background: #4de0ff; border-color: #ffffff;
    box-shadow: 0 0 14px rgba(77, 224, 255, 0.7);
  }
  #ta-settings-list li.action { justify-content: center; margin-top: 16px; }
  .ta-settings-value { display: flex; align-items: center; gap: 10px; color: #ffffff; }
  #ta-settings-list li.active .ta-settings-value { color: #07050f; }
  .ta-settings-arrow { color: #4de0ff; width: 12px; }
  #ta-settings-list li.active .ta-settings-arrow { color: #07050f; }
  .ta-settings-arrow.disabled { opacity: 0.25; }
  .ta-settings-readout { min-width: 118px; text-align: center; }
  /* A volume bar of filled/empty pips, so the level reads at a glance. */
  .ta-settings-bar { letter-spacing: 2px; }
  #ta-settings-controls { margin: 24px 0 0; border-top: 1px solid #2c2850; padding-top: 14px; }
  #ta-settings-controls table {
    font-size: 10px; margin: 0 auto; border-collapse: collapse; width: 100%;
  }
  #ta-settings-controls th, #ta-settings-controls td { padding: 4px 10px; text-align: left; }
  #ta-settings-controls th { color: #4de0ff; }
  #ta-settings-controls td:first-child { color: #ffe14d; }
  #ta-settings-controls .dim { color: #8888b0; font-size: 10px; margin: 10px 0 0; text-align: center; }
  #ta-settings-hint { margin: 20px 0 0; font-size: 10px; line-height: 1.7; color: #7b7ba6; }
`;

export class SettingsMenu {
  // onClose() is called when the player backs out (Back row, or Esc).
  constructor(onClose) {
    this.onClose = onClose;
    this.index = 0;
    this.rows = this._buildRows();
    this._onKeydown = (e) => this._handleKey(e);

    this._injectStyle();
    this._build();
    document.addEventListener('keydown', this._onKeydown, true);
  }

  // Each value row owns its own get/set, so the row list stays declarative and
  // nothing here needs to know which setting lives where.
  _buildRows() {
    const volumes = [];
    for (let v = 0; v <= 1.0001; v += VOLUME_STEP) volumes.push(Math.round(v * 100) / 100);

    return [
      {
        id: 'volume',
        label: 'Volume',
        options: volumes,
        get: () => {
          // Snap to the nearest step, so a hand-edited value still lands on the scale.
          const v = audio.volume;
          return volumes.reduce((best, o) => (Math.abs(o - v) < Math.abs(best - v) ? o : best), volumes[0]);
        },
        set: (v) => audio.setVolume(v),
        // 10 pips, one per step.
        render: (v) => {
          const filled = Math.round(v * 10);
          return `<span class="ta-settings-bar">${'■'.repeat(filled)}${'□'.repeat(10 - filled)}</span>`;
        },
      },
      {
        id: 'muted',
        label: 'Sound',
        options: [false, true],
        get: () => audio.muted,
        set: (m) => audio.setMuted(m),
        render: (m) => (m ? 'Muted' : 'On'),
      },
      {
        id: 'matchLength',
        label: 'VS match',
        options: MATCH_LENGTHS,
        get: () => getSetting('matchLength'),
        set: (n) => updateSettings({ matchLength: n }),
        render: matchLengthLabel,
      },
      { id: 'back', label: 'Back', action: true },
    ];
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
    this.overlay.id = 'ta-settings-overlay';

    const card = document.createElement('div');
    card.id = 'ta-settings-card';

    const title = document.createElement('h2');
    title.id = 'ta-settings-title';
    title.textContent = 'SETTINGS';
    card.appendChild(title);

    const list = document.createElement('ul');
    list.id = 'ta-settings-list';
    this.rowEls = this.rows.map((row, i) => {
      const li = document.createElement('li');
      if (row.action) {
        li.className = 'action';
        li.textContent = row.label;
        li.addEventListener('click', () => this._select());
      } else {
        const label = document.createElement('span');
        label.textContent = row.label;
        li.appendChild(label);

        const value = document.createElement('span');
        value.className = 'ta-settings-value';

        const left = document.createElement('span');
        left.className = 'ta-settings-arrow';
        left.textContent = '◀';
        left.addEventListener('click', (e) => { e.stopPropagation(); this._setIndex(i); this._adjust(-1); });

        const readout = document.createElement('span');
        readout.className = 'ta-settings-readout';

        const right = document.createElement('span');
        right.className = 'ta-settings-arrow';
        right.textContent = '▶';
        right.addEventListener('click', (e) => { e.stopPropagation(); this._setIndex(i); this._adjust(1); });

        value.append(left, readout, right);
        li.appendChild(value);
        row.els = { left, readout, right };
        // Clicking the row body cycles forward, matching the arrows.
        li.addEventListener('click', () => { this._setIndex(i); this._adjust(1); });
      }
      li.addEventListener('mouseenter', () => this._setIndex(i));
      list.appendChild(li);
      return li;
    });
    card.appendChild(list);

    const controls = document.createElement('div');
    controls.id = 'ta-settings-controls';
    controls.innerHTML = CONTROLS_HTML;
    card.appendChild(controls);

    const hint = document.createElement('p');
    hint.id = 'ta-settings-hint';
    hint.innerHTML = '&uarr;&darr; select &middot; &larr;&rarr; change &middot; Esc back';
    card.appendChild(hint);

    this.overlay.appendChild(card);
    document.body.appendChild(this.overlay);

    this._refresh();
    this._setIndex(0);
  }

  _refresh() {
    for (const row of this.rows) {
      if (!row.els) continue;
      const value = row.get();
      const i = row.options.indexOf(value);
      row.els.readout.innerHTML = row.render(value);
      row.els.left.classList.toggle('disabled', i <= 0);
      row.els.right.classList.toggle('disabled', i < 0 || i >= row.options.length - 1);
    }
  }

  _setIndex(i) {
    this.index = (i + this.rows.length) % this.rows.length;
    this.rowEls.forEach((el, n) => {
      el.classList.toggle('active', n === this.index);
    });
  }

  _move(delta) {
    this._setIndex(this.index + delta);
    audio.play('move');
  }

  _adjust(delta) {
    const row = this.rows[this.index];
    if (!row || row.action) return;
    const i = row.options.indexOf(row.get());
    const next = i + delta;
    // Clamp rather than wrap: a wrapping volume would jump from silent to full.
    if (next < 0 || next >= row.options.length) return;
    row.set(row.options[next]);
    this._refresh();
    // Blip *after* the change, so the volume row is audible at its new level.
    // Muting needs no special case: play() is a no-op while muted, so turning
    // sound off is silent and turning it back on blips.
    audio.play('move');
  }

  _select() {
    const row = this.rows[this.index];
    if (row.action) {
      audio.play('cancel');
      this.onClose();
    } else {
      // Enter on a value row cycles it, so the screen is usable without
      // discovering left/right.
      this._adjust(1);
    }
  }

  _handleKey(e) {
    switch (e.code) {
      case 'ArrowUp': case 'KeyW':
        e.preventDefault(); this._move(-1); break;
      case 'ArrowDown': case 'KeyS':
        e.preventDefault(); this._move(1); break;
      case 'ArrowLeft': case 'KeyA':
        e.preventDefault(); this._adjust(-1); break;
      case 'ArrowRight': case 'KeyD':
        e.preventDefault(); this._adjust(1); break;
      case 'Enter': case 'Space':
        e.preventDefault(); this._select(); break;
      case 'Escape':
        e.preventDefault(); audio.play('cancel'); this.onClose(); break;
      default: break;
    }
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
