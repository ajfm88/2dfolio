import './styles/hud.css';
import './styles/dialog.css';

import { clear, el } from './dom.js';

/**
 * @typedef {{
 *   levelName: string,
 *   onPause: () => void,
 *   onResume: () => void,
 *   onReplay: () => void,
 * }} HudOpts
 */

/**
 * Format milliseconds as m:ss.cs (centiseconds).
 * @param {number} ms
 * @returns {string}
 */
function formatTime(ms) {
  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const totalS = Math.floor(totalCs / 100);
  const s = totalS % 60;
  const m = Math.floor(totalS / 60);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

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
      const resume = el('button', {
        class: 'btn btn--primary',
        attrs: { type: 'button' },
        text: 'Resume',
        on: { click: () => opts.onResume() },
      });
      openOverlay('Paused', [el('div', { class: 'panel__actions' }, [resume])], opts.onResume);
      resume.focus();
    },

    /** @param {{ coins: number, timeMs: number }} result */
    showResults(result) {
      const stats = el('div', { class: 'panel__stats' }, [
        el('div', { class: 'panel__row' }, [
          el('span', { text: 'Treasure' }),
          el('span', { text: String(result.coins) }),
        ]),
        el('div', { class: 'panel__row' }, [
          el('span', { text: 'Time' }),
          el('span', { text: formatTime(result.timeMs) }),
        ]),
      ]);
      const replay = el('button', {
        class: 'btn btn--primary',
        attrs: { type: 'button' },
        text: 'Play again',
        on: { click: () => opts.onReplay() },
      });
      openOverlay('Level Complete', [stats, el('div', { class: 'panel__actions' }, [replay])]);
      replay.focus();
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
