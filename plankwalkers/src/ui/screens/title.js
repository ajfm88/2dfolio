import '../styles/title.css';

import { el } from '../dom.js';

/**
 * The front door: Play goes to the campaign, Make to the player's own levels. A
 * DOM screen over the canvas's sky fill, like level select.
 *
 * @param {HTMLElement} root
 * @param {{ onPlay: () => void, onMake: () => void }} opts
 * @returns {{ focus: () => void, destroy: () => void }}
 */
export function createTitleScreen(root, opts) {
  const play = el('button', {
    class: 'btn btn--primary title__button',
    text: 'Play',
    attrs: { type: 'button' },
    on: { click: () => opts.onPlay() },
  });
  const make = el('button', {
    class: 'btn title__button',
    text: 'Make',
    attrs: { type: 'button' },
    on: { click: () => opts.onMake() },
  });
  const screen = el('section', { class: 'title', attrs: { 'aria-label': 'Coral Corsairs' } }, [
    el('h1', { class: 'panel panel--paper title__wordmark', text: 'Coral Corsairs' }),
    el('div', { class: 'title__buttons' }, [play, make]),
  ]);
  root.append(screen);

  return {
    /** Play takes the focus, so Enter or Space starts it. */
    focus() {
      play.focus();
    },
    destroy() {
      screen.remove();
    },
  };
}
