import { VIEW_H } from '../settings.js';

import { tuning } from '../data/tuning.js';

import { shakeOffset } from './shake.js';
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
 *   showResults: (result: { treasure: number, timeMs: number }) => void,
 *   destroy: () => void,
 * }} HudController
 *
 * @typedef {{ setShown: (shown: boolean) => void, destroy: () => void }} TouchController
 *
 * @typedef {{
 *   createHud: (root: HTMLElement, opts: {
 *     levelName: string,
 *     onPause: () => void,
 *     onResume: () => void,
 *     onReplay: () => void,
 *     onEdit?: () => void,
 *     onQuit?: () => void,
 *     onNext?: () => void,
 *     openSettings?: (root: HTMLElement) => { close: () => void },
 *   }) => HudController,
 *   createTouch: (root: HTMLElement, input: Input) => TouchController,
 * }} UiFactories
 */

/** @typedef {ReturnType<import('../core/audio.js').createAudio>} Audio */

/**
 * `onEdit` is present only for a test-play started from the maker, and `onQuit` for
 * a level played from level select — the scene knows there is somewhere to go back
 * to, not what it is. `onNext` is the campaign's next level. `onComplete` reports a
 * finished run once; what it means (progress, or nothing) is the App's call.
 * `reducedMotion` reads a flag the App keeps current, never the DOM, so `update`
 * can ask it (invariant 3). `controls` is the on-screen controls setting, read in
 * `render`. `openSettings` is passed through to the pause menu.
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
 *   onQuit?: () => void,
 *   onNext?: () => void,
 *   onComplete?: (run: { treasure: number, timeMs: number }) => void,
 *   reducedMotion?: () => boolean,
 *   controls?: () => 'auto' | 'on' | 'off',
 *   openSettings?: (root: HTMLElement) => { close: () => void },
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

  let paused = false;
  let finished = false;
  let elapsedMs = 0;
  // Overlay reconcile trackers (view-sync only; the overlay is driven from render,
  // never from update — invariant 3).
  let lastPausedShown = false;
  let resultsShown = false;

  // Seconds of screen shake left, and its offset this frame (reused, never allocated).
  let shakeLeft = 0;
  const shake = { x: 0, y: 0 };

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
      shakeLeft = 0;
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
        onQuit: params.onQuit,
        onNext: params.onNext,
        openSettings: params.openSettings,
      });
      touch = params.ui.createTouch(root, params.input);
    },

    unmountUI() {
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

      // Enter (edge): the results panel's primary action (next level, or replay),
      // otherwise toggle pause. This only flips state — the overlay is opened and
      // closed in render (invariant 3).
      if (params.input.keys.pause.pressed) {
        if (finished) {
          if (params.onNext) params.onNext();
          else params.onReplay();
          return;
        }
        paused = !paused;
      }

      // Frozen while paused or after completion: input still advances so buttons
      // do not stick, but the simulation does not step.
      if (paused || finished) return;

      const healthBefore = world.stats.health;
      const status = world.update(dt, params.camera.x, params.viewport.viewW);
      followPlayer();

      if (status === 'dead') {
        params.onDeath();
        return;
      }
      if (status === 'complete') {
        finished = true;
        if (params.onComplete) {
          params.onComplete({ treasure: world.stats.treasure, timeMs: elapsedMs });
        }
        return;
      }

      // A heart lost, and survived, shakes the view. Added after the camera has
      // followed the player, so it never accumulates; the setters keep it whole.
      const reduced = params.reducedMotion ? params.reducedMotion() : false;
      if (world.stats.health < healthBefore && !reduced) shakeLeft = tuning.shakeTime;
      if (shakeLeft > 0) {
        shakeOffset(shakeLeft, tuning.shakeTime, tuning.shakeAmplitude, shake);
        params.camera.x += shake.x;
        params.camera.y += shake.y;
        shakeLeft -= dt;
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
      // On-screen controls: always, never, or once a touch has been seen. Reconciled
      // here rather than on an event, so a change made in Settings mid-level applies
      // on the next frame.
      if (touch) {
        const mode = params.controls ? params.controls() : 'auto';
        touch.setShown(mode === 'on' || (mode === 'auto' && params.input.hasTouch));
      }
      // Reconcile HUD DOM to game state (reads only; invariant 3 permits DOM in
      // render, forbids it in update). Diff-based, so this is cheap per frame.
      if (!hud) return;
      hud.syncHearts(world.stats.health);
      hud.syncCoins(world.stats.coins);
      if (finished) {
        if (!resultsShown) {
          hud.showResults({ treasure: world.stats.treasure, timeMs: elapsedMs });
          resultsShown = true;
        }
      } else if (paused !== lastPausedShown) {
        hud.setPaused(paused);
        lastPausedShown = paused;
      }
    },
  };
}
