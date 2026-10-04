import './styles/touch-controls.css';

import { el } from './dom.js';

/** @typedef {ReturnType<import('../core/input.js').createInput>} Input */

/**
 * Build the on-screen controls into `root`, starting hidden. The play scene decides
 * each frame whether they show (the controls setting, and whether a touch was seen). Every button is
 * wired through `input.bindVirtualButton`, so no input listeners live here.
 *
 * @param {HTMLElement} root
 * @param {Input} input
 */
export function createTouchControls(root, input) {
  /** @type {Array<() => void>} */
  const unbinds = [];

  /**
   * @param {string} cls modifier class for grid placement
   * @param {number} frame icon index in /assets/ui/icons.png
   * @param {'left' | 'right' | 'up' | 'down' | 'jump'} action
   * @param {string} label accessible name
   * @returns {HTMLElement}
   */
  function btn(cls, frame, action, label) {
    const glyph = el('span', {
      class: 'touch-btn__glyph',
      style: { '--frame': String(frame) },
    });
    const b = el(
      'button',
      { class: `touch-btn ${cls}`, attrs: { type: 'button', 'aria-label': label } },
      [glyph],
    );
    unbinds.push(input.bindVirtualButton(b, action));
    return b;
  }

  const pad = el('div', { class: 'touch__pad' }, [
    btn('touch-btn--left', 2, 'left', 'Left'),
    btn('touch-btn--right', 3, 'right', 'Right'),
    btn('touch-btn--down', 0, 'down', 'Drop through'),
  ]);
  const jump = el('div', { class: 'touch__jump' }, [
    btn('touch-btn--jump', 1, 'jump', 'Jump'),
  ]);

  const container = el('div', { class: 'touch' }, [pad, jump]);
  container.hidden = true;
  root.append(container);
  let shown = false;

  return {
    /**
     * Diff-based, so it is safe to call every frame.
     * @param {boolean} next
     */
    setShown(next) {
      if (next === shown) return;
      shown = next;
      container.hidden = !next;
    },
    destroy() {
      for (let i = 0; i < unbinds.length; i++) unbinds[i]();
      unbinds.length = 0;
      container.remove();
    },
  };
}
