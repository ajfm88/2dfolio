import '../styles/toast.css';

import { el } from '../dom.js';

const TOAST_MS = 2500;

/**
 * One toast at a time, bottom centre. A new one replaces the one showing.
 *
 * @param {HTMLElement} root
 */
export function createToaster(root) {
  /** @type {HTMLElement | null} */
  let current = null;
  let timer = 0;

  function hide() {
    clearTimeout(timer);
    if (current) current.remove();
    current = null;
  }

  return {
    /**
     * @param {string} text
     */
    show(text) {
      hide();
      current = el('div', {
        class: 'panel panel--paper toast',
        text,
        attrs: { role: 'status', 'aria-live': 'polite' },
      });
      root.append(current);
      timer = window.setTimeout(hide, TOAST_MS);
    },
    hide,
  };
}
