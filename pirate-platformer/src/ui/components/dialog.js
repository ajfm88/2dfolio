import '../styles/dialog.css';

import { el } from '../dom.js';

/**
 * There is no ghost (frameless) variant: a bare label on the board's wood fill is
 * too faint to read (issue 21), so Cancel is a framed button like the rest.
 * `keepOpen` actions run without closing the dialog (Copy, Import). Every other
 * action closes it first, then runs.
 *
 * @typedef {{
 *   label: string,
 *   primary?: boolean,
 *   focus?: boolean,
 *   keepOpen?: boolean,
 *   onClick?: () => void,
 * }} DialogAction
 *
 * @typedef {{
 *   close: () => void,
 *   buttons: HTMLButtonElement[],
 * }} DialogHandle
 */

const FOCUSABLE = [
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"]):not([hidden])',
  'textarea:not([disabled]):not([hidden])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * A centred wood panel over the scrim. Its text sits on an inner paper sheet,
 * because text on the board's wood fill is too faint to read (issue 21). Focus is
 * trapped, and Escape or a backdrop tap closes it. The returned `close` is
 * idempotent; whoever opens a dialog closes it when their own UI is torn down.
 *
 * @param {HTMLElement} root
 * @param {{
 *   title: string,
 *   body?: Node[],
 *   actions: DialogAction[],
 *   stackActions?: boolean,
 *   initialFocus?: HTMLElement,
 *   onClose?: () => void,
 * }} opts
 * @returns {DialogHandle}
 */
export function openDialog(root, opts) {
  const buttons = opts.actions.map((a) => /** @type {HTMLButtonElement} */ (el('button', {
    class: a.primary ? 'btn btn--primary' : 'btn',
    text: a.label,
    attrs: { type: 'button' },
  })));

  const sheet = el('div', { class: 'panel panel--paper dialog__sheet' }, [
    el('h2', { class: 'dialog__title', text: opts.title }),
    ...(opts.body ?? []),
  ]);
  const actions = el('div', {
    class: opts.stackActions ? 'panel__actions dialog__actions--stack' : 'panel__actions',
  }, buttons);
  const panel = el('div', {
    class: 'panel dialog',
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title },
  }, [sheet, actions]);
  const overlay = el('div', { class: 'overlay' }, [panel]);

  const previousFocus = document.activeElement;
  let closed = false;

  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeyDown);
    overlay.remove();
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    if (opts.onClose) opts.onClose();
  }

  /** @param {KeyboardEvent} e */
  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = /** @type {HTMLElement[]} */ ([...panel.querySelectorAll(FOCUSABLE)]);
    if (focusable.length === 0) return;
    e.preventDefault();
    const i = focusable.indexOf(/** @type {HTMLElement} */ (document.activeElement));
    const next = e.shiftKey
      ? (i <= 0 ? focusable.length - 1 : i - 1)
      : (i < 0 || i >= focusable.length - 1 ? 0 : i + 1);
    focusable[next].focus();
  }

  for (let i = 0; i < buttons.length; i++) {
    const action = opts.actions[i];
    buttons[i].addEventListener('click', () => {
      if (!action.keepOpen) close();
      if (action.onClick) action.onClick();
    });
  }
  overlay.addEventListener('pointerdown', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', onKeyDown);

  root.append(overlay);
  const focusIndex = opts.actions.findIndex((a) => a.focus);
  const first = opts.initialFocus
    ?? (focusIndex >= 0 ? buttons[focusIndex] : null)
    ?? /** @type {HTMLElement | null} */ (panel.querySelector(FOCUSABLE));
  if (first) first.focus();

  return { close, buttons };
}

/**
 * A yes/no question. Cancel is focused, so Enter never confirms by accident.
 *
 * @param {HTMLElement} root
 * @param {{
 *   title: string,
 *   text: string,
 *   confirmLabel: string,
 *   cancelLabel?: string,
 *   onConfirm: () => void,
 * }} opts
 * @returns {DialogHandle}
 */
export function openConfirm(root, opts) {
  return openDialog(root, {
    title: opts.title,
    body: [el('p', { class: 'dialog__text', text: opts.text })],
    actions: [
      { label: opts.cancelLabel ?? 'Cancel', focus: true },
      { label: opts.confirmLabel, onClick: opts.onConfirm },
    ],
  });
}
