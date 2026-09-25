import './ui/styles/base.css';

import { VIEW_H } from './settings.js';
import { createAudio } from './core/audio.js';
import { loadAtlas } from './core/atlas.js';
import { createCamera } from './core/camera.js';
import { createInput } from './core/input.js';
import { createLoop } from './core/loop.js';
import { createTransition } from './core/transition.js';
import { createViewport } from './core/viewport.js';

import { sounds } from './data/sounds.js';
import { getTheme } from './data/themes.js';
import { deserialise } from './level/codec.js';
import { createEmptyModel } from './level/model.js';
import { createPlayScene } from './game/play-scene.js';
import { createMakerScene } from './maker/maker-scene.js';
import { prefersReducedMotion, setVeiled } from './ui/dom.js';
import { createPlayHud } from './ui/hud.js';
import { createMakerPalette } from './ui/maker-palette.js';
import { createMakerToolbar } from './ui/maker-toolbar.js';
import { createPaintPanToggle } from './ui/maker-toggle.js';
import { createRotatePrompt } from './ui/rotate-prompt.js';
import { createTouchControls } from './ui/touch-controls.js';
import { openResizeDialog } from './ui/components/resize-dialog.js';
import atlasJson from './data/atlas.json';

/** @typedef {import('./level/model.js').LevelModel} LevelModel */
/** @typedef {import('./maker/maker-scene.js').MakerSession} MakerSession */
/** @typedef {import('./types.js').LevelData} LevelData */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game'));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
const appRoot = /** @type {HTMLElement} */ (document.getElementById('app'));
const uiRoot = /** @type {HTMLElement} */ (document.getElementById('ui'));

// Portrait is not a supported canvas orientation (2026-09-23): the game is held
// behind a rotate prompt until the display is wider than it is tall.
const rotatePrompt = createRotatePrompt(appRoot);
let portrait = false;

const viewport = createViewport(canvas, ctx, {
  onResize() {
    const dw = window.innerWidth;
    const dh = window.innerHeight;
    const uiScale = Math.max(1, Math.min(3, Math.floor(Math.min(dw / 480, dh / 320))));
    document.documentElement.style.setProperty('--ui-scale', String(uiScale));
    portrait = dw < dh;
    rotatePrompt.setShown(portrait);
  },
});

const audio = createAudio();
const input = createInput(canvas, viewport);
const camera = createCamera();
const transition = createTransition();
const playScene = createPlayScene();
const makerScene = createMakerScene();

input.onFirstGesture(() => audio.resume());

/** @type {Awaited<ReturnType<typeof loadAtlas>> | null} */
let atlas = null;
/** @type {'play' | 'maker'} */
let mode = 'maker';
/** The maker as it was left, held while its level is being test-played. */
/** @type {MakerSession | null} */
let session = null;
/** What the maker handed over; every attempt deserialises it afresh. */
/** @type {LevelData | null} */
let playData = null;
// Set from scene callbacks (DOM events or a scene's update), acted on by the App
// after the scene update returns — the same deferral as a restart.
/** @type {'play' | 'maker' | null} */
let request = null;
let pendingRestart = false;

/**
 * @param {LevelModel} level
 * @param {MakerSession | null} s
 */
function enterMaker(level, s) {
  if (!atlas) return;
  makerScene.enter({
    level,
    session: s ?? undefined,
    theme: getTheme(level.theme),
    atlas,
    input,
    camera,
    viewport,
    ui: {
      createPalette: createMakerPalette,
      createToggle: createPaintPanToggle,
      createToolbar: createMakerToolbar,
    },
    onBack() {},
    onPlay(data, snap) {
      playData = data;
      session = snap;
      request = 'play';
    },
    openResizeDialog,
  });
  makerScene.mountUI(uiRoot);
}

function enterPlay() {
  if (!atlas || !playData) return;
  // The maker proved this data loads before handing it over.
  const level = deserialise(playData);
  playScene.enter({
    level,
    theme: getTheme(level.theme),
    atlas,
    audio,
    input,
    camera,
    viewport,
    ui: { createHud: createPlayHud, createTouch: createTouchControls },
    onDeath() { pendingRestart = true; },
    onReplay() { pendingRestart = true; },
    onEdit() { request = 'maker'; },
  });
  playScene.mountUI(uiRoot);
}

function restartPlay() {
  playScene.unmountUI();
  playScene.exit();
  enterPlay();
}

/**
 * Wipe to the other mode. The scenes swap while the screen is covered.
 * @param {'play' | 'maker'} target
 */
function beginSwitch(target) {
  if (target === mode) return;
  const started = transition.start({
    reducedMotion: prefersReducedMotion(),
    onCover() {
      if (target === 'play') {
        makerScene.unmountUI();
        makerScene.exit();
        mode = 'play';
        enterPlay();
        return;
      }
      playScene.unmountUI();
      playScene.exit();
      mode = 'maker';
      const s = session;
      session = null;
      playData = null;
      if (s) enterMaker(s.level, s);
    },
    onEnd() {
      setVeiled(uiRoot, false);
    },
  });
  if (!started) return;
  setVeiled(uiRoot, true);
  // Fades out under the closing iris.
  if (target === 'maker') audio.stopMusic();
}

/**
 * @param {number} dt
 */
function update(dt) {
  // Held behind the rotate prompt. Input still advances, so a press made behind
  // it is dropped rather than replayed when the device turns back.
  if (portrait) {
    input.advance();
    return;
  }
  // Neither scene steps during a wipe: the old one is frozen under the closing
  // iris, the new one under the opening iris.
  if (transition.active) {
    input.advance();
    transition.update(dt);
    return;
  }
  if (mode === 'maker') {
    makerScene.update(dt);
  } else {
    playScene.update(dt);
    if (pendingRestart) {
      pendingRestart = false;
      restartPlay();
    }
  }
  if (request) {
    const target = request;
    request = null;
    beginSwitch(target);
  }
}

function render() {
  viewport.apply(ctx);
  if (!atlas) {
    ctx.fillStyle = '#ddc6a1';
    ctx.fillRect(0, 0, viewport.viewW, VIEW_H);
    return;
  }
  if (mode === 'maker') makerScene.render(ctx, camera);
  else playScene.render(ctx, camera);
  if (transition.active) {
    // The maker leaves its zoom scale on the context.
    viewport.apply(ctx);
    transition.draw(ctx, viewport.viewW, VIEW_H);
  }
}

const loop = createLoop({ update, render });
loop.start();

Promise.all([
  loadAtlas(atlasJson),
  audio.load(sounds),
]).then(([loaded]) => {
  atlas = loaded;
  mode = 'maker';
  enterMaker(createEmptyModel(), null);
}).catch((err) => {
  console.error('Failed to load:', err);
});
