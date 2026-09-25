import './styles/dialog.css';
import './styles/rotate-prompt.css';

import { el } from './dom.js';

/**
 * Full-screen "rotate your device" cover for portrait displays (decision
 * 2026-09-23: a 360-tall view cannot fill a portrait screen without stretching or
 * letterboxing). Mount it outside `#ui`, so a veiled overlay never hides it.
 *
 * @param {HTMLElement} root
 * @returns {{ setShown: (shown: boolean) => void, destroy: () => void }}
 */
export function createRotatePrompt(root) {
  const cover = el('div', {
    class: 'rotate-prompt',
    attrs: { hidden: '' },
  }, [
    el('div', {
      class: 'panel rotate-prompt__panel',
      attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'rotate-prompt-title' },
    }, [
      el('div', { class: 'rotate-prompt__device', attrs: { 'aria-hidden': 'true' } }),
      el('h2', {
        class: 'panel__title',
        text: 'Turn your device',
        attrs: { id: 'rotate-prompt-title' },
      }),
      el('p', { class: 'rotate-prompt__text', text: 'Coral Corsairs plays in landscape.' }),
    ]),
  ]);
  root.append(cover);

  let shown = false;

  return {
    /** @param {boolean} next */
    setShown(next) {
      if (next === shown) return;
      shown = next;
      cover.hidden = !next;
    },
    destroy() {
      cover.remove();
    },
  };
}
