import { el } from '../dom.js';
import { openDialog } from './dialog.js';

/**
 * Paste a share code or a level's JSON, or (with a fine pointer) choose a `.json`
 * file. `onImport` returns an error to show inline, or null once the level is
 * saved, which closes the dialog.
 *
 * @param {HTMLElement} root
 * @param {{
 *   allowFile: boolean,
 *   onImport: (text: string) => Promise<string | null>,
 * }} opts
 * @returns {{ close: () => void }}
 */
export function openImportDialog(root, opts) {
  const field = /** @type {HTMLTextAreaElement} */ (el('textarea', {
    class: 'field field--code',
    attrs: {
      rows: '4',
      spellcheck: 'false',
      autocomplete: 'off',
      placeholder: 'Paste a level code',
      'aria-label': 'Level code',
    },
  }));
  const error = el('p', { class: 'dialog__error', attrs: { role: 'alert', hidden: '' } });
  const fileInput = /** @type {HTMLInputElement} */ (el('input', {
    attrs: { type: 'file', accept: '.json,application/json', hidden: '' },
  }));

  let busy = false;

  /** @param {string | null} message */
  function showError(message) {
    error.textContent = message ?? '';
    error.hidden = message === null;
  }

  /** @param {string} text */
  async function run(text) {
    if (busy) return;
    busy = true;
    importBtn.disabled = true;
    showError(null);
    try {
      const message = await opts.onImport(text);
      if (message === null) dialog.close();
      else showError(message);
    } finally {
      busy = false;
      importBtn.disabled = false;
    }
  }

  /** @type {import('./dialog.js').DialogAction[]} */
  const actions = [];
  if (opts.allowFile) {
    actions.push({ label: 'Choose file…', keepOpen: true, onClick: () => fileInput.click() });
  }
  actions.push({ label: 'Cancel' });
  actions.push({ label: 'Import', primary: true, keepOpen: true, onClick: () => { run(field.value); } });

  const dialog = openDialog(root, {
    title: 'Import level',
    body: [field, error, fileInput],
    actions,
    initialFocus: field,
  });
  const importBtn = dialog.buttons[dialog.buttons.length - 1];

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    let text;
    try {
      text = await file.text();
    } catch {
      showError("That file couldn't be read.");
      return;
    }
    run(text);
  });

  return { close: dialog.close };
}
