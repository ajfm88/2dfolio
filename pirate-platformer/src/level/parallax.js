import { createSprite } from '../core/sprite.js';

import { TILE, VIEW_W_MAX } from '../settings.js';

/** @typedef {import('./model.js').LevelModel} LevelModel */
/** @typedef {import('../data/themes.js').Theme} Theme */

/**
 * World Y of the horizon: top of the first water row, or the bottom edge.
 * A mid-level pool still sets one global horizon.
 *
 * @param {{ layers: { water: Uint8Array }, cols: number, rows: number }} level
 * @returns {number}
 */
export function horizonY(level) {
  const water = level.layers.water;
  const cols = level.cols;
  const rows = level.rows;
  const cells = cols * rows;
  for (let i = 0; i < cells; i++) {
    if (water[i] !== 0) return Math.floor(i / cols) * TILE;
  }
  return rows * TILE;
}

/**
 * Positive modulo. Negative camera offsets must not pop.
 *
 * @param {number} x
 * @param {number} w
 * @returns {number}
 */
export function wrap(x, w) {
  if (w <= 0) return 0;
  return ((x % w) + w) % w;
}

/**
 * @param {string} id
 * @returns {number}
 */
function seedFromId(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * @param {number} seed
 * @returns {() => number}
 */
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Decorative sky state. `update` mutates; drawing lives in render.js.
 *
 * @param {LevelModel} level
 * @param {Theme} theme
 * @param {{ get: (id: string) => import('../core/sprite.js').AtlasClip }} atlas
 */
export function createParallax(level, theme, atlas) {
  const hy = horizonY(level);
  const worldW = level.cols * TILE;
  const rand = lcg(seedFromId(level.id));

  let widest = 0;
  for (let i = 0; i < theme.smallClouds.length; i++) {
    const w = atlas.get(theme.smallClouds[i]).fw;
    if (w > widest) widest = w;
  }
  const period = Math.max(worldW, VIEW_W_MAX) + 2 * widest;

  const maxAbove = Math.max(1, hy);
  /** @type {{ clip: import('../core/sprite.js').AtlasClip, x: number, above: number, speed: number, w: number, h: number }[]} */
  const small = [];
  for (let i = 0; i < theme.smallCloudCount; i++) {
    const ids = theme.smallClouds;
    const clip = atlas.get(ids[Math.floor(rand() * ids.length) % ids.length]);
    const span = Math.max(1, maxAbove - clip.fh);
    small.push({
      clip,
      x: rand() * period,
      above: clip.fh + rand() * span,
      speed: theme.smallCloudSpeedMin
        + rand() * (theme.smallCloudSpeedMax - theme.smallCloudSpeedMin),
      w: clip.fw,
      h: clip.fh,
    });
  }

  /** @type {{ sprite: ReturnType<typeof createSprite>, x: number, w: number, h: number }[]} */
  const reflects = [];
  const slots = theme.reflects.length * 2;
  for (let n = 0; n < 2; n++) {
    for (let i = 0; i < theme.reflects.length; i++) {
      const clip = atlas.get(theme.reflects[i]);
      const slot = n * theme.reflects.length + i;
      reflects.push({
        sprite: createSprite(clip),
        x: ((slot + 0.5) / slots) * worldW,
        w: clip.fw,
        h: clip.fh,
      });
    }
  }

  let bigCloudX = 0;
  let timer = 0;

  /**
   * @param {number} camX
   * @param {number} viewW
   */
  function recycleLeftmost(camX, viewW) {
    let best = 0;
    let bestSx = Infinity;
    const factor = theme.smallCloudParallax;
    for (let i = 0; i < small.length; i++) {
      const sx = wrap(small[i].x - camX * factor, period);
      if (sx < bestSx) {
        bestSx = sx;
        best = i;
      }
    }
    const cloud = small[best];
    cloud.x = wrap(camX * factor + viewW + cloud.w, period);
  }

  return {
    horizonY: hy,
    worldW,
    period,
    small,
    reflects,
    get bigCloudX() {
      return bigCloudX;
    },
    /**
     * @param {number} dt
     * @param {number} camX
     * @param {number} viewW
     */
    update(dt, camX, viewW) {
      const bigW = atlas.get(theme.bigClouds).fw;
      bigCloudX -= theme.bigCloudSpeed * dt;
      bigCloudX = wrap(bigCloudX, bigW);

      for (let i = 0; i < small.length; i++) {
        const cloud = small[i];
        cloud.x -= cloud.speed * dt;
        cloud.x = wrap(cloud.x, period);
      }

      timer += dt;
      if (timer >= theme.cloudTimer) {
        timer -= theme.cloudTimer;
        recycleLeftmost(camX, viewW);
      }

      for (let i = 0; i < reflects.length; i++) {
        reflects[i].sprite.update(dt);
      }
    },
  };
}
