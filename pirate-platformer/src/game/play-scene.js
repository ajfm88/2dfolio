import { VIEW_H } from '../settings.js';
import { createWorld } from './world.js';

/** @typedef {import('../level/model.js').LevelModel} LevelModel */
/** @typedef {import('../data/themes.js').Theme} Theme */
/** @typedef {Awaited<ReturnType<import('../core/atlas.js').loadAtlas>>} Atlas */

/**
 * @typedef {{
 *   level: LevelModel,
 *   theme: Theme,
 *   atlas: Atlas,
 *   input: ReturnType<import('../core/input.js').createInput>,
 *   camera: ReturnType<import('../core/camera.js').createCamera>,
 *   viewport: ReturnType<import('../core/viewport.js').createViewport>,
 *   onDeath: () => void,
 *   onComplete: () => void,
 * }} PlaySceneParams
 */

export function createPlayScene() {
  /** @type {ReturnType<typeof createWorld> | null} */
  let world = null;
  /** @type {PlaySceneParams | null} */
  let params = null;

  return {
    /**
     * @param {PlaySceneParams} p
     */
    enter(p) {
      params = p;
      world = createWorld(p.level, p.theme, p.atlas, p.input.keys);
    },

    exit() {
      world = null;
      params = null;
    },

    /**
     * @param {number} dt
     */
    update(dt) {
      if (!world || !params) return;

      params.input.advance();

      const status = world.update(dt, params.camera.x, params.viewport.viewW);

      const cx = world.player.hitbox.x + world.player.hitbox.w / 2;
      const cy = world.player.hitbox.y + world.player.hitbox.h / 2;
      params.camera.follow(
        cx, cy,
        params.viewport.viewW, VIEW_H,
        world.worldW, world.worldH,
      );

      if (status === 'dead') params.onDeath();
      else if (status === 'complete') params.onComplete();
    },

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {{ x: number, y: number }} cam
     */
    render(ctx, cam) {
      if (!world || !params) return;
      world.draw(ctx, cam, params.viewport.viewW, VIEW_H);
    },

    mountUI() {},
    unmountUI() {},
  };
}
