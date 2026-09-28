import '../styles/sound-dialog.css';

import { el } from '../dom.js';
import { openDialog } from './dialog.js';

const STEP = 5;
const PERCENT = 100;

/**
 * Music and effects volume. A slider applies live while it moves and is saved when
 * it is let go. Native range inputs for now; the kit's slider sprites need an
 * asset-pipeline change first (issue 26).
 *
 * @param {HTMLElement} root
 * @param {{
 *   audio: { musicVolume: number, sfxVolume: number },
 *   onCommit: () => void,
 * }} opts
 * @returns {{ close: () => void }}
 */
export function openSoundDialog(root, opts) {
  /**
   * @param {string} label
   * @param {() => number} get
   * @param {(v: number) => void} set
   */
  function row(label, get, set) {
    const value = el('output', { class: 'sound__value' });
    const slider = /** @type {HTMLInputElement} */ (el('input', {
      class: 'sound__slider',
      attrs: { type: 'range', min: '0', max: String(PERCENT), step: String(STEP) },
    }));
    const show = () => { value.textContent = `${slider.value}%`; };
    slider.value = String(Math.round(get() * PERCENT / STEP) * STEP);
    show();
    slider.addEventListener('input', () => {
      set(Number(slider.value) / PERCENT);
      show();
    });
    slider.addEventListener('change', () => opts.onCommit());
    return el('label', { class: 'sound__row' }, [
      el('span', { class: 'sound__label', text: label }),
      slider,
      value,
    ]);
  }

  const dialog = openDialog(root, {
    title: 'Sound',
    body: [
      row('Music', () => opts.audio.musicVolume, (v) => { opts.audio.musicVolume = v; }),
      row('Effects', () => opts.audio.sfxVolume, (v) => { opts.audio.sfxVolume = v; }),
    ],
    actions: [{ label: 'Done', primary: true }],
  });

  return { close: dialog.close };
}
