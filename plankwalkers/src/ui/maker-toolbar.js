import './styles/maker-toolbar.css';

import { el } from './dom.js';

/**
 * `problem` is the reason the level cannot be played, or null when it can. Play
 * is enabled exactly when it is null, and the reason shows in the status slot.
 *
 * `theme` is the level's theme id; the Menu shows the matching choice pressed.
 *
 * @typedef {{
 *   canUndo: boolean,
 *   canRedo: boolean,
 *   problem: string | null,
 *   theme: string,
 * }} ToolbarState
 *
 * @typedef {{
 *   sync: (state: ToolbarState) => void,
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
 *   onShare: () => void,
 *   onResize: () => void,
 *   themes: ReadonlyArray<{ id: string, label: string }>,
 *   onTheme: (id: string) => void,
 * }} opts
 * @returns {ToolbarController}
 */
export function createMakerToolbar(root, opts) {
  let prevCanUndo = true;
  let prevCanRedo = true;
  /** @type {string | null} */
  let prevProblem = null;
  /** @type {string | null} */
  let prevTheme = null;

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
      text: 'Share',
      attrs: { type: 'button' },
      on: {
        click: () => {
          closeMenu();
          opts.onShare();
        },
      },
    }),
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

  const themeButtons = opts.themes.map((theme) => el('button', {
    class: 'maker-toolbar__menu-item maker-toolbar__menu-choice',
    text: theme.label,
    attrs: { type: 'button', 'data-theme': theme.id, 'aria-pressed': 'false' },
    on: { click: () => { closeMenu(); opts.onTheme(theme.id); } },
  }));
  menuPanel.append(
    el('span', {
      class: 'maker-toolbar__menu-label', text: 'Theme',
      attrs: { 'aria-hidden': 'true' },
    }),
    el('div', { attrs: { role: 'group', 'aria-label': 'Theme' } }, themeButtons),
  );

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

  const statusText = el('span', { class: 'maker-toolbar__status-text' });
  const status = el('div', {
    class: 'maker-toolbar__status maker-toolbar__status--clear',
    attrs: { role: 'status', 'aria-live': 'polite' },
  }, [
    el('span', { class: 'maker-toolbar__status-pip', attrs: { 'aria-hidden': 'true' } }),
    statusText,
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
    status,
    el('div', { class: 'maker-toolbar__group' }, [
      playBtn,
      menuWrap,
    ]),
  ]);

  root.append(bar);

  return {
    /** @param {ToolbarState} state */
    sync(state) {
      if (state.theme !== prevTheme) {
        for (let i = 0; i < themeButtons.length; i++) {
          const button = themeButtons[i];
          button.setAttribute('aria-pressed', String(button.dataset.theme === state.theme));
        }
        prevTheme = state.theme;
      }
      if (state.canUndo !== prevCanUndo) {
        undoBtn.disabled = !state.canUndo;
        prevCanUndo = state.canUndo;
      }
      if (state.canRedo !== prevCanRedo) {
        redoBtn.disabled = !state.canRedo;
        prevCanRedo = state.canRedo;
      }
      if (state.problem !== prevProblem) {
        const clear = state.problem === null;
        playBtn.disabled = !clear;
        statusText.textContent = state.problem ?? '';
        status.title = state.problem ?? '';
        status.classList.toggle('maker-toolbar__status--clear', clear);
        prevProblem = state.problem;
      }
    },
    destroy() {
      closeMenu();
      bar.remove();
    },
  };
}
