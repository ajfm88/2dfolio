/**
 * @typedef {{ x: number, y: number, w: number, h: number }} Rect
 */

/**
 * @param {Rect} r
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @returns {Rect}
 */
export function set(r, x, y, w, h) {
  r.x = x;
  r.y = y;
  r.w = w;
  r.h = h;
  return r;
}

/**
 * @param {Rect} from
 * @param {Rect} to
 * @returns {Rect}
 */
export function copy(from, to) {
  to.x = from.x;
  to.y = from.y;
  to.w = from.w;
  to.h = from.h;
  return to;
}

/**
 * @param {Rect} a
 * @param {Rect} b
 */
export function intersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
