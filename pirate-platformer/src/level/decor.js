import { TILE } from '../settings.js';

/** @typedef {import('../core/sprite.js').AtlasClip} AtlasClip */
/** @typedef {import('../types.js').DecorRecord} DecorRecord */

/**
 * @typedef {{ x: number, y: number, w: number, h: number }} DecorRect
 * @typedef {{ z: number, clip: AtlasClip }} ResolvedDecor
 * @typedef {(k: string) => ResolvedDecor | null} DecorResolve
 * @typedef {{ k: string, frameIndex: number, fps: number, n: number, used: boolean }} DecorClock
 * @typedef {{
 *   k: string,
 *   c: number,
 *   r: number,
 *   z: number,
 *   x: number,
 *   y: number,
 *   w: number,
 *   h: number,
 *   clip: AtlasClip,
 *   clock: DecorClock,
 * }} DecorItem
 */

/**
 * Centre the frame on the cell and sit its bottom on the cell bottom.
 * Writes into `out`. `(TILE - fw) / 2` may be fractional; callers round only
 * after subtracting the camera.
 *
 * @param {number} c
 * @param {number} r
 * @param {number} fw
 * @param {number} fh
 * @param {DecorRect} out
 */
export function decorFrameRect(c, r, fw, fh, out) {
  out.x = c * TILE + (TILE - fw) / 2;
  out.y = (r + 1) * TILE - fh;
  out.w = fw;
  out.h = fh;
}

/**
 * True when the sprite rectangle overlaps the camera view. The view's right
 * and bottom edges are exclusive, so a sprite that only touches them is out.
 *
 * @param {DecorRect} rect
 * @param {number} camX
 * @param {number} camY
 * @param {number} viewW
 * @param {number} viewH
 */
export function decorOnScreen(rect, camX, camY, viewW, viewH) {
  return rect.x < camX + viewW
    && rect.x + rect.w > camX
    && rect.y < camY + viewH
    && rect.y + rect.h > camY;
}

/**
 * One step of a decor clock, matching `sprite.js`: add `fps * dt`, then wrap
 * with a floor division. Mutates `clock` and allocates nothing.
 *
 * @param {DecorClock} clock
 * @param {number} dt
 */
export function advanceDecorClock(clock, dt) {
  clock.frameIndex += clock.fps * dt;
  const n = clock.n;
  if (n > 0 && clock.frameIndex >= n) {
    clock.frameIndex -= n * Math.floor(clock.frameIndex / n);
  }
}

/**
 * Earlier in the sorted prefix when `z`, then row, then column, is smaller.
 * Equal keys stay in their current order (insertion sort is stable).
 *
 * @param {DecorItem} a
 * @param {DecorItem} b
 */
function decorBefore(a, b) {
  if (a.z !== b.z) return a.z < b.z;
  if (a.r !== b.r) return a.r < b.r;
  return a.c < b.c;
}

/**
 * @param {DecorItem[]} items
 * @param {number} count
 */
function sortDecorPrefix(items, count) {
  for (let i = 1; i < count; i++) {
    const item = items[i];
    let j = i;
    while (j > 0 && decorBefore(item, items[j - 1])) {
      items[j] = items[j - 1];
      j -= 1;
    }
    items[j] = item;
  }
}

/**
 * @param {DecorClock[]} clocks
 * @param {string} k
 * @param {AtlasClip} clip
 */
function clockFor(clocks, k, clip) {
  for (let i = 0; i < clocks.length; i++) {
    if (clocks[i].k === k) {
      clocks[i].fps = clip.fps;
      clocks[i].n = clip.n;
      return clocks[i];
    }
  }
  const clock = { k, frameIndex: 0, fps: clip.fps, n: clip.n, used: false };
  clocks.push(clock);
  return clock;
}

/**
 * Copy `records` into `items`, skip kinds `resolve` refuses, and sort that copy
 * by `z`, row, column. Does not sort or mutate `records`. Grows `items` only
 * when the live prefix is longer than the pool.
 *
 * @param {DecorRecord[]} records
 * @param {DecorResolve} resolve
 * @param {DecorItem[]} items
 * @param {DecorClock[]} clocks
 * @returns {number} live prefix length
 */
export function buildDecorDrawList(records, resolve, items, clocks) {
  let count = 0;
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    const resolved = resolve(rec.k);
    if (!resolved) continue;
    let item = items[count];
    if (!item) {
      item = {
        k: rec.k,
        c: rec.c,
        r: rec.r,
        z: resolved.z,
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        clip: resolved.clip,
        clock: clockFor(clocks, rec.k, resolved.clip),
      };
      items[count] = item;
    }
    item.k = rec.k;
    item.c = rec.c;
    item.r = rec.r;
    item.z = resolved.z;
    item.clip = resolved.clip;
    item.clock = clockFor(clocks, rec.k, resolved.clip);
    decorFrameRect(rec.c, rec.r, resolved.clip.fw, resolved.clip.fh, item);
    count += 1;
  }
  sortDecorPrefix(items, count);
  return count;
}

/**
 * Shared palm visual for play and the maker. The resolver is injected so this
 * module never imports the palette. `sync` rebuilds the draw list; `update`
 * advances one clock per kind that is currently placed; `draw` only reads.
 *
 * @param {DecorResolve} resolve
 */
export function createDecorVisual(resolve) {
  /** @type {DecorItem[]} */
  const items = [];
  /** @type {DecorClock[]} */
  const clocks = [];
  let count = 0;
  let minZ = 0;
  let maxZ = -1;

  /**
   * @param {DecorRecord[]} records
   */
  function sync(records) {
    count = buildDecorDrawList(records, resolve, items, clocks);
    if (count === 0) {
      minZ = 0;
      maxZ = -1;
      return;
    }
    minZ = items[0].z;
    maxZ = items[count - 1].z;
  }

  /**
   * @param {number} dt
   */
  function update(dt) {
    for (let i = 0; i < count; i++) items[i].clock.used = true;
    for (let i = 0; i < clocks.length; i++) {
      const clock = clocks[i];
      if (!clock.used) continue;
      clock.used = false;
      advanceDecorClock(clock, dt);
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ x: number, y: number }} cam
   * @param {number} viewW
   * @param {number} viewH
   * @param {number} z
   */
  function draw(ctx, cam, viewW, viewH, z) {
    if (count === 0 || z < minZ || z > maxZ) return;
    for (let i = 0; i < count; i++) {
      const item = items[i];
      if (item.z !== z) continue;
      if (!decorOnScreen(item, cam.x, cam.y, viewW, viewH)) continue;
      const clip = item.clip;
      const n = clip.n;
      const frame = n > 0 ? Math.floor(item.clock.frameIndex) % n : 0;
      const dx = Math.round(item.x - cam.x);
      const dy = Math.round(item.y - cam.y);
      ctx.drawImage(
        clip.image, frame * clip.fw, 0, clip.fw, clip.fh, dx, dy, clip.fw, clip.fh,
      );
    }
  }

  /**
   * Frame accumulator for a kind this visual has resolved, or null if it has not.
   * @param {string} k
   * @returns {number | null}
   */
  function frameOf(k) {
    for (let i = 0; i < clocks.length; i++) {
      if (clocks[i].k === k) return clocks[i].frameIndex;
    }
    return null;
  }

  return { sync, update, draw, frameOf };
}
