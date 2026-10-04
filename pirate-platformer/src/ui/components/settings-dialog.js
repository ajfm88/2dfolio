import '../styles/settings-dialog.css';

import { el } from '../dom.js';
import { openDialog } from './dialog.js';

/** @typedef {import('../../storage/settings-store.js').ControlsMode} ControlsMode */

const STEP = 5;
const PERCENT = 100;

/** @type {ReadonlyArray<{ mode: ControlsMode, label: string, hint: string }>} */
const CONTROLS = [
  { mode: 'auto', label: 'Auto', hint: 'Auto: touch buttons once the screen is touched' },
  { mode: 'on', label: 'On', hint: 'On: always show touch buttons' },
  { mode: 'off', label: 'Off', hint: 'Off: never show touch buttons' },
];

/**
 * Settings: music and effects volume, and the on-screen controls. Opened from the
 * Title, level select and the pause menu. A slider applies live while it moves and
 * is saved when it is let go; a controls choice applies and saves at once.
 *
 * @param {HTMLElement} root
 * @param {{
 *   audio: { musicVolume: number, sfxVolume: number },
 *   controls: () => ControlsMode,
 *   setControls: (mode: ControlsMode) => void,
 *   onCommit: () => void,
 * }} opts
 * @returns {{ close: () => void }}
 */
export function openSettingsDialog(root, opts) {
  /**
   * @param {string} label
   * @param {() => number} get
   * @param {(v: number) => void} set
   */
  function slider(label, get, set) {
    const value = el('output', { class: 'settings__value' });
    const input = /** @type {HTMLInputElement} */ (el('input', {
      class: 'settings__slider',
      attrs: { type: 'range', min: '0', max: String(PERCENT), step: String(STEP) },
    }));
    const show = () => { value.textContent = `${input.value}%`; };
    input.value = String(Math.round(get() * PERCENT / STEP) * STEP);
    show();
    input.addEventListener('input', () => {
      set(Number(input.value) / PERCENT);
      show();
    });
    input.addEventListener('change', () => opts.onCommit());
    return el('label', { class: 'settings__row' }, [
      el('span', { class: 'settings__label', text: label }),
      input,
      value,
    ]);
  }

  const choices = CONTROLS.map((c) => /** @type {HTMLButtonElement} */ (el('button', {
    class: 'btn settings__choice',
    text: c.label,
    attrs: { type: 'button', 'aria-pressed': 'false', title: c.hint, 'aria-label': c.hint },
    on: {
      click: () => {
        opts.setControls(c.mode);
        paintChoices();
      },
    },
  })));

  function paintChoices() {
    const mode = opts.controls();
    for (let i = 0; i < CONTROLS.length; i++) {
      choices[i].setAttribute('aria-pressed', String(CONTROLS[i].mode === mode));
    }
  }
  paintChoices();

  // One row like the sliders: a short label, then the choice. The full meaning of
  // each choice is its title and accessible name (which starts with the visible
  // word, for voice control), keeping the dialog short enough for a 360-tall
  // landscape phone.
  const controlsRow = el('div', { class: 'settings__row' }, [
    el('span', { class: 'settings__label', text: 'Touch', attrs: { 'aria-hidden': 'true' } }),
    el('div', {
      class: 'settings__choices',
      attrs: { role: 'group', 'aria-label': 'On-screen touch buttons' },
    }, choices),
  ]);

  const dialog = openDialog(root, {
    title: 'Settings',
    body: [
      slider('Music', () => opts.audio.musicVolume, (v) => { opts.audio.musicVolume = v; }),
      slider('Effects', () => opts.audio.sfxVolume, (v) => { opts.audio.sfxVolume = v; }),
      controlsRow,
    ],
    actions: [{ label: 'Done', primary: true }],
  });

  return { close: dialog.close };
}
