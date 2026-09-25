import '../styles/dialog.css';
import '../styles/resize-dialog.css';

import { el } from '../dom.js';
import {
  COLS_MIN, COLS_MAX,
  ROWS_MIN, ROWS_MAX,
} from '../../level/schema.js';

/**
 * The returned `close` is idempotent. The opener calls it when its own UI is torn
 * down, so the dialog never outlives the scene that opened it.
 *
 * @param {HTMLElement} root
 * @param {{
 *   cols: number,
 *   rows: number,
 *   onApply: (cols: number, rows: number) => void,
 * }} opts
 * @returns {{ close: () => void }}
 */
export function openResizeDialog(root, opts) {
  const colsInput = /** @type {HTMLInputElement} */ (el('input', {
    attrs: {
      type: 'number',
      min: String(COLS_MIN),
      max: String(COLS_MAX),
      step: '1',
      value: String(opts.cols),
    },
  }));

  const rowsInput = /** @type {HTMLInputElement} */ (el('input', {
    attrs: {
      type: 'number',
      min: String(ROWS_MIN),
      max: String(ROWS_MAX),
      step: '1',
      value: String(opts.rows),
    },
  }));

  const warning = el('p', {
    class: 'resize-dialog__warning',
    text: 'Content outside the new bounds will be removed.',
    attrs: { hidden: '' },
  });

  const applyBtn = /** @type {HTMLButtonElement} */ (el('button', {
    class: 'btn btn--primary',
    text: 'Apply',
    attrs: { type: 'button' },
  }));

  const cancelBtn = /** @type {HTMLButtonElement} */ (el('button', {
    class: 'btn',
    text: 'Cancel',
    attrs: { type: 'button' },
  }));

  const panel = el('div', { class: 'panel resize-dialog' }, [
    el('h2', { class: 'panel__title', text: 'Level Size' }),
    el('div', { class: 'resize-dialog__fields' }, [
      el('div', { class: 'resize-dialog__field' }, [
        el('label', { text: 'Width' }),
        colsInput,
        el('span', { text: 'cols' }),
      ]),
      el('div', { class: 'resize-dialog__field' }, [
        el('label', { text: 'Height' }),
        rowsInput,
        el('span', { text: 'rows' }),
      ]),
    ]),
    el('p', {
      class: 'resize-dialog__hint',
      text: `${COLS_MIN}–${COLS_MAX} × ${ROWS_MIN}–${ROWS_MAX}`,
    }),
    warning,
    el('div', { class: 'panel__actions' }, [cancelBtn, applyBtn]),
  ]);

  const overlay = el('div', { class: 'overlay' }, [panel]);
  root.append(overlay);

  /** @type {Element[]} */
  const focusable = [colsInput, rowsInput, cancelBtn, applyBtn];
  colsInput.focus();
  colsInput.select();

  function getValues() {
    const c = parseInt(colsInput.value, 10);
    const r = parseInt(rowsInput.value, 10);
    return { c, r };
  }

  function isValid() {
    const { c, r } = getValues();
    return Number.isInteger(c) && Number.isInteger(r)
      && c >= COLS_MIN && c <= COLS_MAX
      && r >= ROWS_MIN && r <= ROWS_MAX;
  }

  function updateState() {
    const { c, r } = getValues();
    applyBtn.disabled = !isValid();

    const shrinking = c < opts.cols || r < opts.rows;
    if (shrinking && isValid()) {
      warning.removeAttribute('hidden');
    } else {
      warning.setAttribute('hidden', '');
    }
  }

  let closed = false;

  function close() {
    if (closed) return;
    closed = true;
    overlay.removeEventListener('pointerdown', onOverlayClick);
    document.removeEventListener('keydown', onKeyDown);
    colsInput.removeEventListener('input', updateState);
    rowsInput.removeEventListener('input', updateState);
    overlay.remove();
  }

  function apply() {
    if (!isValid()) return;
    const { c, r } = getValues();
    close();
    opts.onApply(c, r);
  }

  /** @param {Event} e */
  function onOverlayClick(e) {
    if (e.target === overlay) close();
  }

  /** @param {KeyboardEvent} e */
  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const idx = focusable.indexOf(/** @type {Element} */ (document.activeElement));
      const next = e.shiftKey
        ? (idx <= 0 ? focusable.length - 1 : idx - 1)
        : (idx >= focusable.length - 1 ? 0 : idx + 1);
      /** @type {HTMLElement} */ (focusable[next]).focus();
      return;
    }
    if (e.key === 'Enter' && document.activeElement !== cancelBtn) {
      e.preventDefault();
      apply();
    }
  }

  overlay.addEventListener('pointerdown', onOverlayClick);
  document.addEventListener('keydown', onKeyDown);
  colsInput.addEventListener('input', updateState);
  rowsInput.addEventListener('input', updateState);
  applyBtn.addEventListener('click', apply);
  cancelBtn.addEventListener('click', close);

  updateState();

  return { close };
}
