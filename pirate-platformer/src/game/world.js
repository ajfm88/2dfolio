import { TILE } from '../settings.js';
import { intersects } from '../core/rect.js';
import { createParallax } from '../level/parallax.js';
import { drawLevel } from '../level/render.js';
import { byId } from '../data/palette.js';
import { Player } from './player.js';
import { Flag } from './flag.js';
import { Stats } from './stats.js';
import { PickupFx } from './collectibles.js';

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
 */
export function createWorld(level, theme, atlas, keys) {
  const worldW = level.cols * TILE;
  const worldH = level.rows * TILE;

  const parallax = createParallax(level, theme, atlas);
  const stats = new Stats();

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
    },
    stats,
  );

  const flag = new Flag(level.goal, atlas.get('flag'));

  /** @type {Array<{ update: (dt: number) => void, draw: (ctx: CanvasRenderingContext2D, cam: { x: number, y: number }) => void, z: number, alive?: boolean }>} */
  const entities = [flag];
  /** @type {PickupFx[]} */
  const fx = [];

  const handle = {
    atlas,
    level,
    player,
    stats,
    /**
     * @param {AtlasClip} clip
     * @param {number} x
     * @param {number} y
     */
    spawnFx(clip, x, y) {
      fx.push(new PickupFx(clip, x, y));
    },
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
   * @param {number} dt
   * @param {number} camX
   * @param {number} viewW
   * @returns {'playing' | 'dead' | 'complete'}
   */
  function update(dt, camX, viewW) {
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

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ x: number, y: number }} cam
   * @param {number} viewW
   * @param {number} viewH
   */
  function draw(ctx, cam, viewW, viewH) {
    drawLevel(ctx, cam, viewW, viewH, level, theme, atlas, parallax);

    for (let i = 0; i < entities.length; i++) {
      entities[i].draw(ctx, cam);
    }

    player.draw(ctx, cam);

    for (let i = 0; i < fx.length; i++) {
      fx[i].draw(ctx, cam);
    }
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
