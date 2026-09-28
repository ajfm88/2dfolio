import { el } from '../dom.js';
import { openDialog } from './dialog.js';

const COPIED_MS = 1500;

/**
 * Shows a level's share code with a Copy button. Nothing is copied on open: the
 * clipboard wants a user gesture, and the code may still be compressing, so the
 * Copy tap is that gesture. If the clipboard is refused or missing (it is absent on
 * plain-http origins), the code is selected for copying by hand.
 *
 * @param {HTMLElement} root
 * @param {{ code: Promise<string> }} opts  a rejection's message is shown instead of a code
 * @returns {{ close: () => void }}
 */
export function openShareDialog(root, opts) {
  const field = /** @type {HTMLTextAreaElement} */ (el('textarea', {
    class: 'field field--code',
    attrs: { readonly: '', rows: '3', spellcheck: 'false', 'aria-label': 'Share code' },
  }));
  field.value = 'Preparing code…';
  const intro = el('p', {
    class: 'dialog__text',
    text: 'Anyone can paste this code into Import to get their own copy.',
  });
  const status = el('p', {
    class: 'dialog__hint',
    attrs: { role: 'status', 'aria-live': 'polite' },
  });

  /** @type {string | null} */
  let code = null;
  let timer = 0;

  /** @param {string} text */
  function say(text) {
    clearTimeout(timer);
    status.textContent = text;
  }

  async function copy() {
    if (code === null) return;
    try {
      await navigator.clipboard.writeText(code);
      say('Copied');
      timer = window.setTimeout(() => { status.textContent = ''; }, COPIED_MS);
    } catch {
      field.focus();
      field.select();
      say("Couldn't copy. Select the code and copy it yourself.");
    }
  }

  const dialog = openDialog(root, {
    title: 'Share level',
    body: [intro, field, status],
    actions: [
      { label: 'Done' },
      { label: 'Copy', primary: true, focus: true, keepOpen: true, onClick: () => { copy(); } },
    ],
    onClose() { clearTimeout(timer); },
  });
  const copyBtn = dialog.buttons[1];
  copyBtn.disabled = true;

  opts.code.then(
    (c) => {
      code = c;
      field.value = c;
      copyBtn.disabled = false;
      copyBtn.focus();
    },
    (err) => {
      field.hidden = true;
      intro.hidden = true;
      say(err instanceof Error ? err.message : String(err));
      dialog.buttons[0].focus();
    },
  );

  return { close: dialog.close };
}
