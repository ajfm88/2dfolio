/** @typedef {'left' | 'right' | 'up' | 'down' | 'jump' | 'pause' | 'undo' | 'redo' | 'modeSwitch'} Action */

/** @type {Record<string, Action>} */
const KEY_TO_DIR = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  Space: 'jump',
  Enter: 'pause',
  KeyM: 'modeSwitch',
};

/** @type {Action[]} */
const ACTIONS = [
  'left', 'right', 'up', 'down', 'jump', 'pause', 'undo', 'redo', 'modeSwitch',
];

/**
 * @typedef {{ held: boolean, pressed: boolean, released: boolean }} Button
 */

/**
 * Advance one button by one frame. `down` is its level now; `latched` is true when a
 * press arrived since the last frame. A press that was also released before this
 * frame (a fast click or key tap) still counts: it is held for this one frame and
 * released on the next, so every press the browser delivers yields one `pressed`.
 *
 * @param {Button} button mutated in place
 * @param {boolean} down
 * @param {boolean} latched
 */
export function stepButton(button, down, latched) {
  const now = down || (latched && !button.held);
  button.pressed = now && !button.held;
  button.released = !now && button.held;
  button.held = now;
}

/**
 * True for an element that owns its own keys: an input, textarea, select or
 * contenteditable. Game keys (WASD, arrows, Space, Enter, M, Ctrl+Z) typed into
 * one must reach the field, not become actions — and must not be preventDefaulted,
 * or the characters never arrive.
 *
 * @param {EventTarget | null} target
 * @returns {boolean}
 */
export function isFormField(target) {
  if (target === null || typeof target !== 'object') return false;
  const t = /** @type {{ tagName?: unknown, isContentEditable?: unknown }} */ (target);
  if (t.isContentEditable === true) return true;
  return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT';
}

/**
 * True when a keydown should activate the focused button rather than become a game
 * action: Enter or Space aimed at a `<button>`. Without this, a keyboard user who
 * tabs to Back to editor and presses Enter gets the pause action (Resume) instead.
 * Every other key, M included, still reaches the game from a focused button.
 *
 * @param {EventTarget | null} target
 * @param {string} code KeyboardEvent.code
 * @returns {boolean}
 */
export function isButtonActivation(target, code) {
  if (code !== 'Enter' && code !== 'NumpadEnter' && code !== 'Space') return false;
  if (target === null || typeof target !== 'object') return false;
  return /** @type {{ tagName?: unknown }} */ (target).tagName === 'BUTTON';
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ toVirtual: (clientX: number, clientY: number) => { x: number, y: number } }} viewport
 */
export function createInput(canvas, viewport) {
  /** @type {Record<string, boolean>} */
  const want = {
    left: false, right: false, up: false, down: false, jump: false, pause: false,
    undo: false, redo: false, modeSwitch: false,
  };
  // On-screen (touch) buttons OR keyboard: advance() merges want[dir] || virtual[dir].
  /** @type {Record<string, boolean>} */
  const virtual = {
    left: false, right: false, up: false, down: false, jump: false, pause: false,
    undo: false, redo: false, modeSwitch: false,
  };
  // A press seen since the last advance(), kept even if it has already been released.
  /** @type {Record<string, boolean>} */
  const latched = {
    left: false, right: false, up: false, down: false, jump: false, pause: false,
    undo: false, redo: false, modeSwitch: false,
  };
  /** @type {Record<string, Button>} */
  const keys = {
    left: { held: false, pressed: false, released: false },
    right: { held: false, pressed: false, released: false },
    up: { held: false, pressed: false, released: false },
    down: { held: false, pressed: false, released: false },
    jump: { held: false, pressed: false, released: false },
    pause: { held: false, pressed: false, released: false },
    undo: { held: false, pressed: false, released: false },
    redo: { held: false, pressed: false, released: false },
    modeSwitch: { held: false, pressed: false, released: false },
  };

  const pointer = {
    down: false,
    pressed: false,
    released: false,
    x: 0,
    y: 0,
    button: 0,
    id: /** @type {number | null} */ (null),
  };
  let pointerWantDown = false;
  // Mouse and pen only: touch taps are the gesture module's (issue 18), and must
  // respect its pan mode.
  let pointerLatched = false;
  let pointerLatchedButton = 0;
  /** @type {number | null} */
  let pointerLatchedId = null;
  /** @type {Button} */
  const pointerEdge = { held: false, pressed: false, released: false };
  let pointerWantX = 0;
  let pointerWantY = 0;
  let pointerWantButton = 0;
  /** @type {number | null} */
  let pointerWantId = null;

  /** @type {Array<{ id: number, x: number, y: number }>} */
  const rawTouches = [];
  /** @type {Array<{ id: number, x: number, y: number }>} */
  const touches = [];

  let hasTouch = false;
  /** @type {Array<() => void>} */
  const touchCbs = [];

  let gestured = false;
  /** @type {Array<() => void>} */
  const gestureCbs = [];

  /**
   * @param {KeyboardEvent} e
   * @returns {Action | undefined}
   */
  function dirFromEvent(e) {
    if (KEY_TO_DIR[e.code]) return KEY_TO_DIR[e.code];
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') return 'left';
    if (k === 'arrowright' || k === 'd') return 'right';
    if (k === 'arrowup' || k === 'w') return 'up';
    if (k === 'arrowdown' || k === 's') return 'down';
    if (k === ' ') return 'jump';
    if (k === 'enter') return 'pause';
    if (k === 'm') return 'modeSwitch';
    return undefined;
  }

  /**
   * @param {PointerEvent} e
   * @returns {{ x: number, y: number }}
   */
  function toVirtual(e) {
    return viewport.toVirtual(e.clientX, e.clientY);
  }

  /**
   * @param {PointerEvent} e
   */
  function samplePointer(e) {
    const v = toVirtual(e);
    pointerWantX = v.x;
    pointerWantY = v.y;
  }

  /**
   * @param {number} id
   */
  function touchIndex(id) {
    for (let i = 0; i < rawTouches.length; i++) {
      if (rawTouches[i].id === id) return i;
    }
    return -1;
  }

  function fireGesture() {
    if (gestured) return;
    gestured = true;
    for (let i = 0; i < gestureCbs.length; i++) gestureCbs[i]();
    gestureCbs.length = 0;
  }

  /**
   * @param {KeyboardEvent} e
   */
  function onKeyDown(e) {
    fireGesture();
    // Presses aimed at a form field belong to it. Releases are still honoured in
    // onKeyUp, so a key held before the field took focus cannot stick down.
    if (isFormField(e.target)) return;
    // Not preventDefaulted, so the button gets its native click.
    if (isButtonActivation(e.target, e.code)) return;
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
      press(e.shiftKey ? 'redo' : 'undo');
      e.preventDefault();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
      press('redo');
      e.preventDefault();
      return;
    }
    const dir = dirFromEvent(e);
    if (!dir) return;
    press(dir);
    e.preventDefault();
  }

  /**
   * @param {Action} action
   */
  function press(action) {
    // Auto-repeat keydowns arrive while the key is already down; only a fresh press latches.
    if (!want[action]) latched[action] = true;
    want[action] = true;
  }

  /**
   * @param {KeyboardEvent} e
   */
  function onKeyUp(e) {
    if (e.code === 'KeyZ') {
      want.undo = false;
      want.redo = false;
      return;
    }
    if (e.code === 'KeyY') {
      want.redo = false;
      return;
    }
    const dir = dirFromEvent(e);
    if (!dir) return;
    want[dir] = false;
  }

  /**
   * @param {PointerEvent} e
   */
  function onPointerDown(e) {
    fireGesture();
    if (e.pointerType === 'touch' && !hasTouch) {
      hasTouch = true;
      for (let i = 0; i < touchCbs.length; i++) touchCbs[i]();
      touchCbs.length = 0;
    }
    // Only the canvas drives the world pointer. Presses on DOM UI (buttons in #ui)
    // must keep their own click/capture, so never capture those to the canvas.
    if (e.target !== canvas) return;
    // Mouse/pen non-primary is ignored; the second touch finger must pass through.
    if (e.pointerType !== 'touch' && e.isPrimary === false) return;

    if (e.pointerType === 'touch' && rawTouches.length < 2 && touchIndex(e.pointerId) < 0) {
      const v = toVirtual(e);
      rawTouches.push({ id: e.pointerId, x: v.x, y: v.y });
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // window-level move/up still track the drag
      }
    }

    if (pointerWantId !== null) return;
    pointerWantId = e.pointerId;
    pointerWantDown = true;
    pointerWantButton = e.button;
    if (e.pointerType !== 'touch') {
      pointerLatched = true;
      pointerLatchedButton = e.button;
      pointerLatchedId = e.pointerId;
    }
    samplePointer(e);
    if (e.button === 1 || e.button === 2) e.preventDefault();
    canvas.focus();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // window-level move/up still track the drag
    }
  }

  /**
   * @param {PointerEvent} e
   */
  function onPointerMove(e) {
    const ti = touchIndex(e.pointerId);
    if (ti >= 0) {
      const v = toVirtual(e);
      rawTouches[ti].x = v.x;
      rawTouches[ti].y = v.y;
    }
    if (pointerWantId === null) {
      samplePointer(e);
      return;
    }
    if (e.pointerId !== pointerWantId) return;
    samplePointer(e);
  }

  /**
   * @param {PointerEvent} e
   */
  function onPointerUp(e) {
    const ti = touchIndex(e.pointerId);
    if (ti >= 0) rawTouches.splice(ti, 1);
    if (e.pointerId !== pointerWantId) return;
    samplePointer(e);
    pointerWantDown = false;
    pointerWantButton = 0;
    pointerWantId = null;
  }

  /**
   * @param {MouseEvent} e
   */
  function onContextMenu(e) {
    e.preventDefault();
  }

  function onBlur() {
    pointerWantDown = false;
    pointerLatched = false;
    pointerWantButton = 0;
    pointerWantId = null;
    rawTouches.length = 0;
  }

  canvas.tabIndex = 0;
  const cap = { capture: true };
  window.addEventListener('keydown', onKeyDown, cap);
  window.addEventListener('keyup', onKeyUp, cap);
  window.addEventListener('pointerdown', onPointerDown, cap);
  window.addEventListener('pointermove', onPointerMove, cap);
  window.addEventListener('pointerup', onPointerUp, cap);
  window.addEventListener('pointercancel', onPointerUp, cap);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('contextmenu', onContextMenu);

  /**
   * @param {string} action
   * @param {boolean} isDown
   */
  function setVirtual(action, isDown) {
    if (!(action in virtual)) return;
    if (isDown && !virtual[action]) latched[action] = true;
    virtual[action] = isDown;
  }

  /**
   * Bind an on-screen control element to a virtual action. All pointer wiring for
   * input lives in this module, never in ui/ or game code (invariant 8). Each bound
   * element tracks its own pointer id, so several controls work at once (multi-touch).
   * Returns an unbind function.
   *
   * @param {HTMLElement} el
   * @param {'left' | 'right' | 'up' | 'down' | 'jump'} action
   * @returns {() => void}
   */
  function bindVirtualButton(el, action) {
    /** @type {number | null} */
    let heldId = null;

    /** @param {PointerEvent} e */
    function down(e) {
      heldId = e.pointerId;
      setVirtual(action, true);
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // release is still tracked via pointerup/pointercancel below
      }
      e.preventDefault();
    }

    /** @param {PointerEvent} e */
    function up(e) {
      if (e.pointerId !== heldId) return;
      heldId = null;
      setVirtual(action, false);
    }

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);

    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('lostpointercapture', up);
      setVirtual(action, false);
    };
  }

  /**
   * Register a callback for the first touch pointer. Fires immediately if a touch
   * has already been seen, otherwise once when the first one arrives. Returns an
   * unsubscribe function (a no-op once it has fired).
   *
   * @param {() => void} cb
   * @returns {() => void}
   */
  function onTouchDetected(cb) {
    if (hasTouch) {
      cb();
      return () => {};
    }
    touchCbs.push(cb);
    return () => {
      const i = touchCbs.indexOf(cb);
      if (i >= 0) touchCbs.splice(i, 1);
    };
  }

  return {
    keys,
    pointer,
    touches,
    setVirtual,
    bindVirtualButton,
    onTouchDetected,
    get hasTouch() {
      return hasTouch;
    },
    /**
     * @param {() => void} cb
     * @returns {() => void}
     */
    onFirstGesture(cb) {
      if (gestured) {
        cb();
        return () => {};
      }
      gestureCbs.push(cb);
      return () => {
        const i = gestureCbs.indexOf(cb);
        if (i >= 0) gestureCbs.splice(i, 1);
      };
    },
    advance() {
      for (let i = 0; i < ACTIONS.length; i++) {
        const dir = ACTIONS[i];
        stepButton(keys[dir], want[dir] || virtual[dir], latched[dir]);
        latched[dir] = false;
      }

      stepButton(pointerEdge, pointerWantDown, pointerLatched);
      // A click already released before this frame is held for this frame only, and
      // needs the button and id it was pressed with (the release reset them).
      const tapped = pointerEdge.held && !pointerWantDown;
      pointerLatched = false;
      pointer.pressed = pointerEdge.pressed;
      pointer.released = pointerEdge.released;
      pointer.down = pointerEdge.held;
      pointer.x = pointerWantX;
      pointer.y = pointerWantY;
      pointer.button = tapped ? pointerLatchedButton : pointerWantButton;
      pointer.id = tapped ? pointerLatchedId : pointerWantId;

      touches.length = rawTouches.length;
      for (let i = 0; i < rawTouches.length; i++) {
        if (!touches[i]) touches[i] = { id: 0, x: 0, y: 0 };
        touches[i].id = rawTouches[i].id;
        touches[i].x = rawTouches[i].x;
        touches[i].y = rawTouches[i].y;
      }
    },
  };
}
