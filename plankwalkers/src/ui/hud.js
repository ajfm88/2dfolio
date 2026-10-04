import './styles/hud.css';
import './styles/dialog.css';

import { clear, el } from './dom.js';
import { formatTime } from './format.js';

/**
 * The pause and results panels also offer a way out: Back to editor with `onEdit`
 * (a test-play from the maker), otherwise Level select with `onQuit` (a level
 * played from level select). With `onNext` (the campaign, before its last level),
 * Next level leads the results panel. The pause menu's Restart is `onReplay`, and
 * its Settings opens `openSettings` over the panel.
 *
 * @typedef {{
 *   levelName: string,
 *   onPause: () => void,
 *   onResume: () => void,
 *   onReplay: () => void,
 *   onEdit?: () => void,
 *   onQuit?: () => void,
 *   onNext?: () => void,
 *   openSettings?: (root: HTMLElement) => { close: () => void },
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
  /** The Settings dialog opened from the pause menu, which the HUD must close. */
  /** @type {{ close: () => void } | null} */
  let settings = null;

  function closeSettings() {
    if (settings) settings.close();
    settings = null;
  }

  function closeOverlay() {
    closeSettings();
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
   * A board panel whose title and text sit on a paper sheet, like every dialog
   * (issue 21), with the buttons on the board below.
   *
   * @param {string} title
   * @param {HTMLElement[]} sheetBody
   * @param {HTMLElement} actionRow
   * @param {(() => void)} [onDismiss] backdrop tap and Escape (omit for a modal result)
   */
  function openOverlay(title, sheetBody, actionRow, onDismiss) {
    closeOverlay();
    const panel = el(
      'div',
      { class: 'panel dialog hud__panel', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': title } },
      [
        el('div', { class: 'panel panel--paper dialog__sheet' }, [
          el('h2', { class: 'dialog__title', text: title }),
          ...sheetBody,
        ]),
        actionRow,
      ],
    );
    const ov = el('div', { class: 'overlay' }, [panel]);
    overlay = ov;
    root.append(ov);

    if (onDismiss) {
      /** @param {PointerEvent} e */
      const onPointer = (e) => {
        if (e.target === ov) onDismiss();
      };
      // Escape closes only the top panel. With Settings open over this one, the
      // dialog has already taken the key (it listens on document, before window,
      // and prevents the default), so the game stays paused.
      /** @param {KeyboardEvent} e */
      const onKey = (e) => {
        if (e.key === 'Escape' && !e.defaultPrevented) onDismiss();
      };
      ov.addEventListener('pointerdown', /** @type {EventListener} */ (onPointer));
      window.addEventListener('keydown', onKey);
      overlayTeardown = () => {
        ov.removeEventListener('pointerdown', /** @type {EventListener} */ (onPointer));
        window.removeEventListener('keydown', onKey);
      };
    }
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

  /** The way out, when there is one: Back to editor, or Level select. */
  function wayOut() {
    if (opts.onEdit) return button('Back to editor', opts.onEdit);
    if (opts.onQuit) return button('Level select', opts.onQuit);
    return null;
  }

  /**
   * @param {HTMLElement[]} buttons
   * @param {boolean} stacked
   */
  function actionRow(buttons, stacked) {
    const out = wayOut();
    return el('div', {
      class: stacked ? 'panel__actions dialog__actions--stack' : 'panel__actions',
    }, out ? [...buttons, out] : buttons);
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

    /**
     * The pause menu: Resume, Restart, Settings, and the way out, stacked.
     * @param {boolean} isPaused
     */
    setPaused(isPaused) {
      if (!isPaused) {
        closeOverlay();
        return;
      }
      const resume = button('Resume', opts.onResume, true);
      const buttons = [resume, button('Restart', opts.onReplay)];
      const openSettings = opts.openSettings;
      if (openSettings) {
        buttons.push(button('Settings', () => {
          closeSettings();
          settings = openSettings(root);
        }));
      }
      openOverlay('Paused', [], actionRow(buttons, true), opts.onResume);
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
      openOverlay('Level Complete', [stats], actionRow(own, false));
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
