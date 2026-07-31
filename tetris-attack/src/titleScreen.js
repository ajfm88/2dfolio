// The intro screen: the box art, held until the player presses a key, clicks,
// or taps. Then it dims in place into the backdrop the menu sits on.
//
// The handoff is what makes it read as one movement rather than two screens.
// This overlay and the menu behind it paint the poster with identical CSS (see
// backdrop.js), so the only things that change across the transition are
// brightness and the menu card arriving -- the art never moves or resizes.

import { audio } from './audio.js';
import { TITLE_ART_CSS } from './backdrop.js';

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
    // pointerdown covers mouse click, pen, and touch tap in one handler.
    this.overlay.addEventListener('pointerdown', () => this._skipFromInput());

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
    clearTimeout(this._armTimer);
    document.removeEventListener('keydown', this._onKeydown, true);

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

  // Click / tap: same arm window as keys so a leftover pointer from page load
  // does not skip the title instantly.
  _skipFromInput() {
    if (!this.armed) return;
    this.advance(true);
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
    // Mark done so a late key/pointer after teardown cannot re-enter advance().
    this.done = true;
    clearTimeout(this._armTimer);
    clearTimeout(this._removeTimer);
    document.removeEventListener('keydown', this._onKeydown, true);
    if (this.backdrop) { this.backdrop.remove(); this.backdrop = null; }
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
  }
}
