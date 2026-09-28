import './styles/hud.css';
import './styles/dialog.css';

import { clear, el } from './dom.js';
import { formatTime } from './format.js';

/**
 * The pause and results panels also offer a way out: Back to editor with `onEdit`
 * (a test-play from the maker), otherwise Level select with `onQuit` (a level
 * played from level select). With `onNext` (the campaign, before its last level),
 * Next level leads the results panel.
 *
 * @typedef {{
 *   levelName: string,
 *   onPause: () => void,
 *   onResume: () => void,
 *   onReplay: () => void,
 *   onEdit?: () => void,
 *   onQuit?: () => void,
 *   onNext?: () => void,
 * }} HudOpts
 */

/**
 * Build the play-mode HUD into `root` (the #ui overlay). All document access for
 * the HUD lives here. Sync methods are diff-based and safe to call every frame.
 *
 * @param {HTMLElement} root
 * @param {HudOpts} opts
 */
export function createPlayHud(root, opts) {
  const hearts = el('div', { class: 'hud__hearts' });

  const coinIcon = el('span', { class: 'hud__coin-icon' });
  const coinCount = el('span', { class: 'hud__coin-count', text: '0' });
  const coins = el('div', { class: 'hud__coins' }, [coinIcon, coinCount]);

  const name = el('div', { class: 'hud__name', text: opts.levelName || '' });

  const pause = el(
    'button',
    {
      class: 'hud__pause',
      attrs: { type: 'button', 'aria-label': 'Pause' },
      on: { click: () => opts.onPause() },
    },
    [el('span', { class: 'hud__pause-bar' }), el('span', { class: 'hud__pause-bar' })],
  );

  root.append(hearts, coins, name, pause);

  let heartCount = -1;
  let coinValue = -1;

  /** @type {HTMLElement | null} */
  let overlay = null;
  /** @type {(() => void) | null} */
  let overlayTeardown = null;

  function closeOverlay() {
    if (overlayTeardown) {
      overlayTeardown();
      overlayTeardown = null;
    }
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
  }

  /**
   * @param {string} title
   * @param {HTMLElement[]} body
   * @param {(() => void)} [onDismiss] backdrop tap and Escape (omit for a modal result)
   * @returns {HTMLElement} the panel element
   */
  function openOverlay(title, body, onDismiss) {
    closeOverlay();
    const panel = el(
      'div',
      { class: 'panel', attrs: { role: 'dialog', 'aria-modal': 'true' } },
      [el('h2', { class: 'panel__title', text: title }), ...body],
    );
    const ov = el('div', { class: 'overlay' }, [panel]);
    overlay = ov;
    root.append(ov);

    if (onDismiss) {
      /** @param {PointerEvent} e */
      const onPointer = (e) => {
        if (e.target === ov) onDismiss();
      };
      /** @param {KeyboardEvent} e */
      const onKey = (e) => {
        if (e.key === 'Escape') onDismiss();
      };
      ov.addEventListener('pointerdown', /** @type {EventListener} */ (onPointer));
      window.addEventListener('keydown', onKey);
      overlayTeardown = () => {
        ov.removeEventListener('pointerdown', /** @type {EventListener} */ (onPointer));
        window.removeEventListener('keydown', onKey);
      };
    }
    return panel;
  }

  /**
   * @param {string} text
   * @param {() => void} onClick
   * @param {boolean} [primary]
   */
  function button(text, onClick, primary = false) {
    return el('button', {
      class: primary ? 'btn btn--primary' : 'btn',
      attrs: { type: 'button' },
      text,
      on: { click: () => onClick() },
    });
  }

  /**
   * A panel's action row: its own buttons, primary first, then the way out — Back
   * to editor, or Level select — when there is one.
   * @param {HTMLElement[]} buttons
   */
  function actions(buttons) {
    const row = el('div', { class: 'panel__actions' }, buttons);
    const { onEdit, onQuit } = opts;
    if (onEdit) row.append(button('Back to editor', onEdit));
    else if (onQuit) row.append(button('Level select', onQuit));
    return row;
  }

  return {
    /** @param {number} n */
    syncHearts(n) {
      if (n === heartCount) return;
      heartCount = n;
      clear(hearts);
      for (let i = 0; i < n; i++) hearts.append(el('div', { class: 'hud__heart' }));
    },

    /** @param {number} n */
    syncCoins(n) {
      if (n === coinValue) return;
      coinValue = n;
      coinCount.textContent = String(n);
    },

    /** @param {boolean} isPaused */
    setPaused(isPaused) {
      if (!isPaused) {
        closeOverlay();
        return;
      }
      const resume = button('Resume', opts.onResume, true);
      openOverlay('Paused', [actions([resume])], opts.onResume);
      resume.focus();
    },

    /** @param {{ treasure: number, timeMs: number }} result */
    showResults(result) {
      const stats = el('div', { class: 'panel__stats' }, [
        el('div', { class: 'panel__row' }, [
          el('span', { text: 'Treasure' }),
          el('span', { text: String(result.treasure) }),
        ]),
        el('div', { class: 'panel__row' }, [
          el('span', { text: 'Time' }),
          el('span', { text: formatTime(result.timeMs) }),
        ]),
      ]);
      const onNext = opts.onNext;
      const primary = onNext
        ? button('Next level', onNext, true)
        : button('Play again', opts.onReplay, true);
      const own = onNext ? [primary, button('Play again', opts.onReplay)] : [primary];
      openOverlay('Level Complete', [stats, actions(own)]);
      primary.focus();
    },

    destroy() {
      closeOverlay();
      hearts.remove();
      coins.remove();
      name.remove();
      pause.remove();
    },
  };
}
