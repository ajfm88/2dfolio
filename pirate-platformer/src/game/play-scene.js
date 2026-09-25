import { VIEW_H } from '../settings.js';
import { createWorld } from './world.js';

/** @typedef {import('../level/model.js').LevelModel} LevelModel */
/** @typedef {import('../data/themes.js').Theme} Theme */
/** @typedef {Awaited<ReturnType<import('../core/atlas.js').loadAtlas>>} Atlas */
/** @typedef {ReturnType<import('../core/input.js').createInput>} Input */

/**
 * UI controllers are created by the App (the composition root) and injected here as
 * factories, so game code never imports from ui/ (dependencies point inward).
 *
 * @typedef {{
 *   syncHearts: (n: number) => void,
 *   syncCoins: (n: number) => void,
 *   setPaused: (paused: boolean) => void,
 *   showResults: (result: { coins: number, timeMs: number }) => void,
 *   destroy: () => void,
 * }} HudController
 *
 * @typedef {{ show: () => void, hide: () => void, destroy: () => void }} TouchController
 *
 * @typedef {{
 *   createHud: (root: HTMLElement, opts: {
 *     levelName: string,
 *     onPause: () => void,
 *     onResume: () => void,
 *     onReplay: () => void,
 *     onEdit?: () => void,
 *   }) => HudController,
 *   createTouch: (root: HTMLElement, input: Input) => TouchController,
 * }} UiFactories
 */

/** @typedef {ReturnType<import('../core/audio.js').createAudio>} Audio */

/**
 * `onEdit` is present only for a test-play started from the maker — the scene knows
 * there is somewhere to go back to, not what it is.
 *
 * @typedef {{
 *   level: LevelModel,
 *   theme: Theme,
 *   atlas: Atlas,
 *   audio: Audio,
 *   input: Input,
 *   camera: ReturnType<import('../core/camera.js').createCamera>,
 *   viewport: ReturnType<import('../core/viewport.js').createViewport>,
 *   ui: UiFactories,
 *   onDeath: () => void,
 *   onReplay: () => void,
 *   onEdit?: () => void,
 * }} PlaySceneParams
 */

export function createPlayScene() {
  /** @type {ReturnType<typeof createWorld> | null} */
  let world = null;
  /** @type {PlaySceneParams | null} */
  let params = null;

  /** @type {HudController | null} */
  let hud = null;
  /** @type {TouchController | null} */
  let touch = null;
  /** @type {(() => void) | null} */
  let touchUnsub = null;

  let paused = false;
  let finished = false;
  let elapsedMs = 0;
  // Overlay reconcile trackers (view-sync only; the overlay is driven from render,
  // never from update — invariant 3).
  let lastPausedShown = false;
  let resultsShown = false;

  function followPlayer() {
    if (!world || !params) return;
    const hb = world.player.hitbox;
    params.camera.follow(
      hb.x + hb.w / 2, hb.y + hb.h / 2,
      params.viewport.viewW, VIEW_H,
      world.worldW, world.worldH,
    );
  }

  return {
    /**
     * @param {PlaySceneParams} p
     */
    enter(p) {
      params = p;
      world = createWorld(p.level, p.theme, p.atlas, p.input.keys,
        (id) => p.audio.playSfx(id));
      paused = false;
      finished = false;
      elapsedMs = 0;
      lastPausedShown = false;
      resultsShown = false;
      // Framed now, not on the first update: a mode-switch wipe draws this scene
      // for a while before it is first stepped.
      followPlayer();
      p.audio.playMusic('music');
    },

    exit() {
      world = null;
      params = null;
    },

    /**
     * @param {HTMLElement} root
     */
    mountUI(root) {
      if (!params || !world) return;

      // These run from DOM events (button / Escape / backdrop) and only flip state;
      // render() reconciles the overlay, so pause has one code path (button or Enter).
      const onPause = () => {
        if (finished) return;
        paused = true;
      };
      const onResume = () => {
        paused = false;
      };

      hud = params.ui.createHud(root, {
        levelName: params.level.name,
        onPause,
        onResume,
        onReplay: () => params.onReplay(),
        onEdit: params.onEdit,
      });
      touch = params.ui.createTouch(root, params.input);
      const t = touch;
      touchUnsub = params.input.onTouchDetected(() => t.show());
    },

    unmountUI() {
      if (touchUnsub) {
        touchUnsub();
        touchUnsub = null;
      }
      if (hud) {
        hud.destroy();
        hud = null;
      }
      if (touch) {
        touch.destroy();
        touch = null;
      }
    },

    /**
     * @param {number} dt
     */
    update(dt) {
      if (!world || !params) return;

      params.input.advance();

      // `M` goes back to the maker from anywhere — running, paused or finished.
      if (params.onEdit && params.input.keys.modeSwitch.pressed) {
        params.onEdit();
        return;
      }

      // Enter (edge): replay on the results screen, otherwise toggle pause. This only
      // flips state — the overlay is opened/closed in render (invariant 3).
      if (params.input.keys.pause.pressed) {
        if (finished) {
          params.onReplay();
          return;
        }
        paused = !paused;
      }

      // Frozen while paused or after completion: input still advances so buttons
      // do not stick, but the simulation does not step.
      if (paused || finished) return;

      const status = world.update(dt, params.camera.x, params.viewport.viewW);
      followPlayer();

      if (status === 'dead') {
        params.onDeath();
        return;
      }
      if (status === 'complete') {
        finished = true;
        return;
      }
      elapsedMs += dt * 1000;
    },

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {{ x: number, y: number }} cam
     */
    render(ctx, cam) {
      if (!world || !params) return;
      world.draw(ctx, cam, params.viewport.viewW, VIEW_H);
      // Reconcile HUD DOM to game state (reads only; invariant 3 permits DOM in
      // render, forbids it in update). Diff-based, so this is cheap per frame.
      if (!hud) return;
      hud.syncHearts(world.stats.health);
      hud.syncCoins(world.stats.coins);
      if (finished) {
        if (!resultsShown) {
          hud.showResults({ coins: world.stats.coins, timeMs: elapsedMs });
          resultsShown = true;
        }
      } else if (paused !== lastPausedShown) {
        hud.setPaused(paused);
        lastPausedShown = paused;
      }
    },
  };
}
