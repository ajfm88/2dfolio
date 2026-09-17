/** @typedef {'left' | 'right' | 'up' | 'down' | 'jump' | 'pause'} Action */

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
};

/** @type {Action[]} */
const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'pause'];

/**
 * @typedef {{ held: boolean, pressed: boolean, released: boolean }} Button
 */

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ toVirtual: (clientX: number, clientY: number) => { x: number, y: number } }} viewport
 */
export function createInput(canvas, viewport) {
  /** @type {Record<string, boolean>} */
  const want = { left: false, right: false, up: false, down: false, jump: false, pause: false };
  // On-screen (touch) buttons OR keyboard: advance() merges want[dir] || virtual[dir].
  /** @type {Record<string, boolean>} */
  const virtual = { left: false, right: false, up: false, down: false, jump: false, pause: false };
  /** @type {Record<string, Button>} */
  const keys = {
    left: { held: false, pressed: false, released: false },
    right: { held: false, pressed: false, released: false },
    up: { held: false, pressed: false, released: false },
    down: { held: false, pressed: false, released: false },
    jump: { held: false, pressed: false, released: false },
    pause: { held: false, pressed: false, released: false },
  };

  const pointer = {
    down: false,
    pressed: false,
    released: false,
    x: 0,
    y: 0,
    id: /** @type {number | null} */ (null),
  };
  let pointerWantDown = false;
  let pointerWantX = 0;
  let pointerWantY = 0;
  /** @type {number | null} */
  let pointerWantId = null;

  let hasTouch = false;
  /** @type {Array<() => void>} */
  const touchCbs = [];

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
    return undefined;
  }

  /**
   * @param {PointerEvent} e
   */
  function samplePointer(e) {
    const v = viewport.toVirtual(e.clientX, e.clientY);
    pointerWantX = v.x;
    pointerWantY = v.y;
  }

  /**
   * @param {KeyboardEvent} e
   */
  function onKeyDown(e) {
    const dir = dirFromEvent(e);
    if (!dir) return;
    want[dir] = true;
    e.preventDefault();
  }

  /**
   * @param {KeyboardEvent} e
   */
  function onKeyUp(e) {
    const dir = dirFromEvent(e);
    if (!dir) return;
    want[dir] = false;
  }

  /**
   * @param {PointerEvent} e
   */
  function onPointerDown(e) {
    if (e.pointerType === 'touch' && !hasTouch) {
      hasTouch = true;
      for (let i = 0; i < touchCbs.length; i++) touchCbs[i]();
      touchCbs.length = 0;
    }
    // Only the canvas drives the world pointer. Presses on DOM UI (buttons in #ui)
    // must keep their own click/capture, so never capture those to the canvas.
    if (e.target !== canvas) return;
    if (e.isPrimary === false) return;
    if (pointerWantId !== null) return;
    pointerWantId = e.pointerId;
    pointerWantDown = true;
    samplePointer(e);
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
    if (e.pointerId !== pointerWantId) return;
    samplePointer(e);
    pointerWantDown = false;
    pointerWantId = null;
  }

  canvas.tabIndex = 0;
  const cap = { capture: true };
  window.addEventListener('keydown', onKeyDown, cap);
  window.addEventListener('keyup', onKeyUp, cap);
  window.addEventListener('pointerdown', onPointerDown, cap);
  window.addEventListener('pointermove', onPointerMove, cap);
  window.addEventListener('pointerup', onPointerUp, cap);
  window.addEventListener('pointercancel', onPointerUp, cap);

  /**
   * @param {string} action
   * @param {boolean} isDown
   */
  function setVirtual(action, isDown) {
    if (action in virtual) virtual[action] = isDown;
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
    setVirtual,
    bindVirtualButton,
    onTouchDetected,
    get hasTouch() {
      return hasTouch;
    },
    advance() {
      for (let i = 0; i < ACTIONS.length; i++) {
        const dir = ACTIONS[i];
        const button = keys[dir];
        const next = want[dir] || virtual[dir];
        button.pressed = next && !button.held;
        button.released = !next && button.held;
        button.held = next;
      }

      pointer.pressed = pointerWantDown && !pointer.down;
      pointer.released = !pointerWantDown && pointer.down;
      pointer.down = pointerWantDown;
      pointer.x = pointerWantX;
      pointer.y = pointerWantY;
      pointer.id = pointerWantId;
    },
  };
}
