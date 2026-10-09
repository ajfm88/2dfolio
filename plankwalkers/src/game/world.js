import { TILE, Z } from '../settings.js';
import { intersects } from '../core/rect.js';
import { createDecorVisual } from '../level/decor.js';
import { createParallax } from '../level/parallax.js';
import { drawLevel } from '../level/render.js';
import { byId } from '../data/palette.js';
import { Player } from './player.js';
import { Flag } from './flag.js';
import { Stats } from './stats.js';
import { OneShotFx } from './fx.js';

/** @typedef {import('../level/model.js').LevelModel} LevelModel */
/** @typedef {import('../data/themes.js').Theme} Theme */
/** @typedef {Awaited<ReturnType<import('../core/atlas.js').loadAtlas>>} Atlas */
/** @typedef {import('./player.js').Keys} Keys */
/** @typedef {import('../core/sprite.js').AtlasClip} AtlasClip */

/**
 * @param {Array<{ alive?: boolean }>} list
 */
function compactAlive(list) {
  let write = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i].alive !== false) list[write++] = list[i];
  }
  list.length = write;
}

/**
 * @param {LevelModel} level
 * @param {Theme} theme
 * @param {Atlas} atlas
 * @param {Keys} keys
 * @param {(id: string) => void} [playSfx]
 */
export function createWorld(level, theme, atlas, keys, playSfx = () => {}) {
  const worldW = level.cols * TILE;
  const worldH = level.rows * TILE;

  const parallax = createParallax(level, theme, atlas);
  const stats = new Stats();
  /** @type {OneShotFx[]} */
  const fx = [];
  /**
   * @param {AtlasClip} clip
   * @param {number} x
   * @param {number} y
   */
  const spawnFx = (clip, x, y) => {
    fx.push(new OneShotFx(clip, x, y));
  };

  const player = new Player(
    level.spawn,
    level,
    keys,
    {
      idle: atlas.get('player/idle'),
      run: atlas.get('player/run'),
      jump: atlas.get('player/jump'),
      fall: atlas.get('player/fall'),
      hit: atlas.get('player/hit'),
      dustJump: atlas.get('fx/dust-jump'),
      dustLand: atlas.get('fx/dust-fall'),
    },
    stats,
    playSfx,
    spawnFx,
  );

  const flag = new Flag(level.goal, atlas.get('flag'));

  /** @type {Array<{ update: (dt: number) => void, draw: (ctx: CanvasRenderingContext2D, cam: { x: number, y: number }) => void, z: number, alive?: boolean }>} */
  const entities = [flag];

  const handle = {
    atlas,
    level,
    player,
    stats,
    playSfx,
    spawnFx,
    /**
     * Add an entity created at runtime (e.g. a shooter's projectile). The update
     * loop snapshots its length first, so a spawn this frame runs from the next.
     * @param {typeof entities[0]} ent
     */
    spawnEntity(ent) {
      entities.push(ent);
    },
  };

  for (let i = 0; i < level.entities.length; i++) {
    const rec = level.entities[i];
    const entry = byId(rec.k);
    if (!entry || typeof entry.spawn !== 'function') continue;
    const ent = entry.spawn(handle, rec);
    if (ent) entities.push(/** @type {typeof entities[0]} */ (ent));
  }

  /**
   * Palette lookup stays here. `level/decor.js` must not import the palette.
   * @param {string} k
   * @returns {{ z: number, clip: import('../core/sprite.js').AtlasClip } | null}
   */
  function resolveDecor(k) {
    const entry = byId(k);
    if (!entry || entry.placement !== 'decor') return null;
    return { z: entry.z, clip: atlas.get(entry.icon) };
  }
  const decorVisual = createDecorVisual(resolveDecor);
  decorVisual.sync(level.decor);

  /**
   * @param {number} dt
   * @param {number} camX
   * @param {number} viewW
   * @returns {'playing' | 'dead' | 'complete'}
   */
  function update(dt, camX, viewW) {
    decorVisual.update(dt);
    player.update(dt);
    stats.tick(dt);

    // Snapshot the count so an entity spawned mid-loop (a projectile) is updated
    // from the next frame, not the one it was created in — otherwise it starts
    // life one step downrange.
    const n = entities.length;
    for (let i = 0; i < n; i++) {
      entities[i].update(dt);
    }
    compactAlive(entities);

    for (let i = 0; i < fx.length; i++) {
      fx[i].update(dt);
    }
    compactAlive(fx);

    parallax.update(dt, camX, viewW);

    if (player.hitbox.y > worldH) return 'dead';

    const footC = Math.floor((player.hitbox.x + player.hitbox.w / 2) / TILE);
    const footR = Math.floor((player.hitbox.y + player.hitbox.h) / TILE);
    if (level.inBounds(footC, footR) && level.get('water', footC, footR) !== 0) {
      return 'dead';
    }

    if (stats.dead) return 'dead';

    if (intersects(player.hitbox, flag.hitbox)) return 'complete';

    return 'playing';
  }

  // Assigned at the start of draw. The layer callback closes over them and is
  // created once, so a frame does not allocate a callback or a camera copy.
  /** @type {CanvasRenderingContext2D | null} */
  let paintCtx = null;
  /** @type {{ x: number, y: number } | null} */
  let paintCam = null;
  let paintViewW = 0;
  let paintViewH = 0;

  /**
   * Objects at one `z`, in the order the architecture requires: flag and entities
   * as they already stand, then the player, then effects. The entity array is not
   * sorted.
   * @param {number} z
   */
  function drawObjects(z) {
    const ctx = paintCtx;
    const cam = paintCam;
    if (!ctx || !cam) return;
    decorVisual.draw(ctx, cam, paintViewW, paintViewH, z);
    for (let i = 0; i < entities.length; i++) {
      const ent = entities[i];
      if (ent.z === z) ent.draw(ctx, cam);
    }
    if (player.z === z) player.draw(ctx, cam);
    if (z === Z.fx) {
      for (let i = 0; i < fx.length; i++) fx[i].draw(ctx, cam);
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ x: number, y: number }} cam
   * @param {number} viewW
   * @param {number} viewH
   */
  function draw(ctx, cam, viewW, viewH) {
    paintCtx = ctx;
    paintCam = cam;
    paintViewW = viewW;
    paintViewH = viewH;
    drawLevel(ctx, cam, viewW, viewH, level, theme, atlas, parallax, drawObjects);
  }

  return {
    level,
    player,
    stats,
    worldW,
    worldH,
    update,
    draw,
  };
}
