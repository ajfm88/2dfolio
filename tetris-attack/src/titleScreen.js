// The intro screen: the box art, held for a beat, then dimming away into the
// backdrop the menu sits on.
//
// The handoff is what makes it read as one movement rather than two screens.
// This overlay and the menu behind it paint the poster with identical CSS (see
// backdrop.js), so the only things that change across the transition are
// brightness and the menu card arriving -- the art never moves or resizes.

import { audio } from './audio.js';
import { TITLE_ART_CSS } from './backdrop.js';

// How long the poster holds before it moves on by itself. Long enough to read,
// short enough that it is not in the way on the tenth launch -- and any key or
// click skips the rest of it.
//
// This is 4.2 seconds of *visible* time, counted off requestAnimationFrame
// rather than a setTimeout. Two reasons. A background tab has its timers
// throttled hard, so a plain timeout can leave the intro apparently stuck until
// the player comes back and presses something -- which is exactly what it looks
// like when it happens. And holding while nobody is looking is the behaviour
// you want anyway: rAF simply does not run while the tab is hidden, so the
// countdown pauses and resumes on its own.
const AUTO_ADVANCE_MS = 4200;
// A frame gap longer than this means the tab was hidden or the machine stalled,
// so it is not credited to the hold.
const MAX_FRAME_GAP_MS = 100;
// Keys pressed in the first moments are almost always left over from whatever
// the player was doing before the page loaded, so ignore them rather than blow
// straight past the screen.
const SKIP_ARMS_AFTER_MS = 500;
// Must match the CSS transition below.
const FADE_MS = 900;

const STYLE_ID = 'ta-title-style';
const STYLE = `
  #ta-title-overlay {
    position: fixed; inset: 0; z-index: 1100;
    ${TITLE_ART_CSS}
    display: flex; align-items: flex-end; justify-content: center;
    font-family: 'Press Start 2P', 'Courier New', monospace;
    user-select: none; cursor: pointer;
    /* Fades up from black on load, and back down on the way out. */
    opacity: 0;
    transition: opacity ${FADE_MS}ms ease-in-out;
  }
  #ta-title-overlay.ta-visible { opacity: 1; }
  /* The black the first fade comes up from -- behind the overlay, not part of
     it, so the poster itself never tints. */
  #ta-title-backdrop {
    position: fixed; inset: 0; z-index: 1099;
    background: #000000;
  }
  #ta-title-prompt {
    margin: 0 0 7vh; padding: 12px 22px;
    font-size: 13px; letter-spacing: 3px; color: #ffffff;
    text-shadow: 0 0 10px rgba(0, 0, 0, 0.9), 0 2px 4px rgba(0, 0, 0, 0.9);
    opacity: 0;
    transition: opacity 400ms ease-in;
  }
  #ta-title-prompt.ta-visible {
    opacity: 1;
    animation: ta-title-blink 1.4s steps(1, end) 400ms infinite;
  }
  @keyframes ta-title-blink {
    0%, 60% { opacity: 1; }
    61%, 100% { opacity: 0.15; }
  }
  @media (prefers-reduced-motion: reduce) {
    #ta-title-overlay, #ta-title-prompt { transition-duration: 1ms; }
    #ta-title-prompt.ta-visible { animation: none; }
  }
`;

export class TitleScreen {
  // onDone() is called once the poster has begun dimming away, so the caller
  // can build the menu underneath it -- see App.showTitle.
  constructor(onDone) {
    this.onDone = onDone;
    this.done = false;
    this.armed = false;

    this._onKeydown = (e) => this._handleKey(e);
    this._injectStyle();
    this._build();

    document.addEventListener('keydown', this._onKeydown, true);
    this._armTimer = setTimeout(() => { this.armed = true; }, SKIP_ARMS_AFTER_MS);
    this._startHold();
  }

  _startHold() {
    this.held = 0;
    let last = null;
    const step = (now) => {
      if (this.done) return;
      if (last !== null) this.held += Math.min(now - last, MAX_FRAME_GAP_MS);
      last = now;
      if (this.held >= AUTO_ADVANCE_MS) {
        this.advance();
        return;
      }
      this._raf = requestAnimationFrame(step);
    };
    this._raf = requestAnimationFrame(step);
  }

  _injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  _build() {
    this.backdrop = document.createElement('div');
    this.backdrop.id = 'ta-title-backdrop';
    document.body.appendChild(this.backdrop);

    this.overlay = document.createElement('div');
    this.overlay.id = 'ta-title-overlay';
    this.overlay.addEventListener('pointerdown', () => this.advance(true));

    this.prompt = document.createElement('p');
    this.prompt.id = 'ta-title-prompt';
    this.prompt.textContent = 'PRESS ANY KEY';
    this.overlay.appendChild(this.prompt);

    document.body.appendChild(this.overlay);

    // Let the element land in the DOM at opacity 0 before flipping the class,
    // or the browser coalesces the two and there is no transition to run.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!this.overlay) return;
        this.overlay.classList.add('ta-visible');
        this.prompt.classList.add('ta-visible');
      });
    });
  }

  // Start the handoff: tell the app to build the menu underneath, then fade the
  // poster out over it. Because the menu paints the same poster (dimmed), what
  // the player sees is the art receding rather than a screen being replaced.
  advance(fromInput = false) {
    // `overlay` is null once destroyed. Guarded as well as `done` because the
    // two can come apart: a screen torn down from outside never advanced.
    if (this.done || !this.overlay) return;
    this.done = true;
    // The hold loop stops on `done`; only the arm timer needs cancelling.
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    clearTimeout(this._armTimer);
    document.removeEventListener('keydown', this._onKeydown, true);

    // Only acknowledge a real press. On the timed exit there was no input to
    // confirm, and a blip out of nowhere would read as something going wrong.
    if (fromInput) audio.play('confirm');
    this.onDone();

    this.overlay.classList.remove('ta-visible');
    this.prompt.classList.remove('ta-visible');
    // The black backdrop has to go now, not with the overlay: it sits *behind*
    // the poster, so leaving it would darken the menu underneath as the poster
    // fades through.
    this.backdrop.remove();
    this.backdrop = null;
    this._removeTimer = setTimeout(() => this.destroy(), FADE_MS);
  }

  _handleKey(e) {
    if (!this.armed) return;
    // Let the browser's own shortcuts through.
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    // Not stopImmediatePropagation: the app's own capture-phase listener on
    // document is what unlocks the AudioContext, and it must still see this
    // keypress or the first sound of the session is swallowed.
    e.stopPropagation();
    this.advance(true);
  }

  destroy() {
    // Stop the hold loop. Without this a screen destroyed from outside (via
    // App._clearOverlays, which does not go through advance()) leaves its rAF
    // running, and 4.2s later it calls advance() on a torn-down overlay --
    // which both throws and yanks the app back to the menu from wherever it
    // had got to.
    this.done = true;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    clearTimeout(this._armTimer);
    clearTimeout(this._removeTimer);
    document.removeEventListener('keydown', this._onKeydown, true);
    if (this.backdrop) { this.backdrop.remove(); this.backdrop = null; }
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
  }
}

