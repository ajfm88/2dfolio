import './styles/maker-toolbar.css';

import { el } from './dom.js';

/**
 * @typedef {{
 *   sync: (state: { canUndo: boolean, canRedo: boolean, canPlay: boolean }) => void,
 *   destroy: () => void,
 * }} ToolbarController
 */

/**
 * @param {HTMLElement} root
 * @param {{
 *   onBack: () => void,
 *   onPlay: () => void,
 *   onUndo: () => void,
 *   onRedo: () => void,
 *   onResize: () => void,
 * }} opts
 * @returns {ToolbarController}
 */
export function createMakerToolbar(root, opts) {
  let prevCanUndo = true;
  let prevCanRedo = true;
  let prevCanPlay = true;

  const undoBtn = /** @type {HTMLButtonElement} */ (el('button', {
    class: 'maker-toolbar__btn',
    text: 'Undo',
    attrs: { type: 'button', 'aria-label': 'Undo', title: 'Undo' },
    on: { click: () => opts.onUndo() },
  }));

  const redoBtn = /** @type {HTMLButtonElement} */ (el('button', {
    class: 'maker-toolbar__btn',
    text: 'Redo',
    attrs: { type: 'button', 'aria-label': 'Redo', title: 'Redo' },
    on: { click: () => opts.onRedo() },
  }));

  const playBtn = /** @type {HTMLButtonElement} */ (el('button', {
    class: 'maker-toolbar__btn maker-toolbar__btn--primary',
    text: 'Play',
    attrs: { type: 'button', 'aria-label': 'Play', title: 'Play' },
    on: { click: () => opts.onPlay() },
  }));

  const menuPanel = el('div', {
    class: 'maker-toolbar__menu-panel',
    attrs: { hidden: '' },
  }, [
    el('button', {
      class: 'maker-toolbar__menu-item',
      text: 'Resize Level',
      attrs: { type: 'button' },
      on: {
        click: () => {
          closeMenu();
          opts.onResize();
        },
      },
    }),
  ]);

  let menuOpen = false;
  /** @type {((e: Event) => void) | null} */
  let outsideListener = null;

  function closeMenu() {
    menuPanel.setAttribute('hidden', '');
    menuOpen = false;
    if (outsideListener) {
      window.removeEventListener('pointerdown', outsideListener, true);
      outsideListener = null;
    }
  }

  function toggleMenu() {
    if (menuOpen) {
      closeMenu();
    } else {
      menuPanel.removeAttribute('hidden');
      menuOpen = true;
      outsideListener = (e) => {
        if (e.target instanceof Node && menuWrap.contains(e.target)) return;
        closeMenu();
      };
      window.addEventListener('pointerdown', outsideListener, true);
    }
  }

  const menuWrap = el('div', { class: 'maker-toolbar__menu-wrap' }, [
    el('button', {
      class: 'maker-toolbar__btn',
      attrs: { type: 'button', 'aria-label': 'Menu', title: 'Menu' },
      on: { click: toggleMenu },
    }, [
      el('div', { class: 'maker-toolbar__menu-icon' }, [
        el('span'), el('span'), el('span'),
      ]),
    ]),
    menuPanel,
  ]);

  const bar = el('div', { class: 'maker-toolbar' }, [
    el('div', { class: 'maker-toolbar__group' }, [
      el('button', {
        class: 'maker-toolbar__btn',
        attrs: { type: 'button', 'aria-label': 'Back', title: 'Back' },
        on: { click: () => opts.onBack() },
      }, [el('span', { class: 'maker-toolbar__back-arrow' })]),
      undoBtn,
      redoBtn,
    ]),
    el('div', { class: 'maker-toolbar__group' }, [
      playBtn,
      menuWrap,
    ]),
  ]);

  root.append(bar);

  return {
    /** @param {{ canUndo: boolean, canRedo: boolean, canPlay: boolean }} state */
    sync(state) {
      if (state.canUndo !== prevCanUndo) {
        undoBtn.disabled = !state.canUndo;
        prevCanUndo = state.canUndo;
      }
      if (state.canRedo !== prevCanRedo) {
        redoBtn.disabled = !state.canRedo;
        prevCanRedo = state.canRedo;
      }
      if (state.canPlay !== prevCanPlay) {
        playBtn.disabled = !state.canPlay;
        prevCanPlay = state.canPlay;
      }
    },
    destroy() {
      closeMenu();
      bar.remove();
    },
  };
}
