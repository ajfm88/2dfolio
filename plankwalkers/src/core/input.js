/** @type {Record<string, 'left' | 'right' | 'up' | 'down'>} */
const KEY_TO_DIR = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
};

const DIRS = ['left', 'right', 'up', 'down'];

/**
 * @typedef {{ held: boolean, pressed: boolean, released: boolean }} Button
 */

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ toVirtual: (clientX: number, clientY: number) => { x: number, y: number } }} viewport
 */
export function createInput(canvas, viewport) {
  /** @type {Record<string, boolean>} */
  const want = { left: false, right: false, up: false, down: false };
  /** @type {Record<string, Button>} */
  const keys = {
    left: { held: false, pressed: false, released: false },
    right: { held: false, pressed: false, released: false },
    up: { held: false, pressed: false, released: false },
    down: { held: false, pressed: false, released: false },
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

  /**
   * @param {KeyboardEvent} e
   * @returns {'left' | 'right' | 'up' | 'down' | undefined}
   */
  function dirFromEvent(e) {
    if (KEY_TO_DIR[e.code]) return KEY_TO_DIR[e.code];
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') return 'left';
    if (k === 'arrowright' || k === 'd') return 'right';
    if (k === 'arrowup' || k === 'w') return 'up';
    if (k === 'arrowdown' || k === 's') return 'down';
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

  return {
    keys,
    pointer,
    advance() {
      for (let i = 0; i < DIRS.length; i++) {
        const dir = DIRS[i];
        const button = keys[dir];
        const next = want[dir];
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
