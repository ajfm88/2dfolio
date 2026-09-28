import { el } from '../dom.js';
import { openDialog } from './dialog.js';

// A UI limit that keeps cards and file names tidy, not a format rule: an imported
// level with a longer name still loads.
const NAME_MAX = 40;

/**
 * @param {HTMLElement} root
 * @param {{ name: string, onRename: (name: string) => void }} opts
 * @returns {{ close: () => void }}
 */
export function openRenameDialog(root, opts) {
  const input = /** @type {HTMLInputElement} */ (el('input', {
    class: 'field',
    attrs: {
      type: 'text',
      maxlength: String(NAME_MAX),
      spellcheck: 'false',
      autocomplete: 'off',
      placeholder: 'Untitled level',
      'aria-label': 'Level name',
    },
  }));
  input.value = opts.name;

  function apply() {
    dialog.close();
    opts.onRename(input.value.trim());
  }

  const dialog = openDialog(root, {
    title: 'Rename level',
    body: [input],
    actions: [
      { label: 'Cancel' },
      { label: 'Rename', primary: true, keepOpen: true, onClick: apply },
    ],
    initialFocus: input,
  });
  input.select();
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    apply();
  });

  return { close: dialog.close };
}
