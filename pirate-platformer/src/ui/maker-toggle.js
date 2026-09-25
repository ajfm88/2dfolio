import './styles/maker-toggle.css';

import { el } from './dom.js';

/** @typedef {ReturnType<import('../core/input.js').createInput>} Input */

/**
 * Paint / pan toggle for touch. Hidden until the first touch pointer is seen.
 *
 * @param {HTMLElement} root
 * @param {Input} input
 * @param {{ panMode?: boolean }} [opts] the mode to restore after a test-play
 * @returns {{ isPanMode: () => boolean, destroy: () => void }}
 */
export function createPaintPanToggle(root, input, opts = {}) {
  let panMode = opts.panMode ?? false;

  const mark = el('span', {
    class: 'maker-toggle__mark maker-toggle__mark--paint',
    attrs: { 'aria-hidden': 'true' },
  });
  const btn = el(
    'button',
    {
      class: 'maker-toggle',
      attrs: {
        type: 'button',
        'aria-label': 'Paint mode',
        title: 'Paint',
        hidden: '',
      },
    },
    [mark],
  );
  root.append(btn);

  function paint() {
    btn.classList.toggle('maker-toggle--pan', panMode);
    mark.classList.toggle('maker-toggle__mark--paint', !panMode);
    mark.classList.toggle('maker-toggle__mark--pan', panMode);
    btn.setAttribute('aria-label', panMode ? 'Pan mode' : 'Paint mode');
    btn.title = panMode ? 'Pan' : 'Paint';
  }

  function onClick() {
    panMode = !panMode;
    paint();
  }

  paint();
  btn.addEventListener('click', onClick);
  const unsub = input.onTouchDetected(() => {
    btn.removeAttribute('hidden');
  });

  return {
    isPanMode() {
      return panMode;
    },
    destroy() {
      unsub();
      btn.removeEventListener('click', onClick);
      btn.remove();
    },
  };
}
