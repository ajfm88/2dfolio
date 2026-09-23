import './ui/styles/base.css';

import { VIEW_H } from './settings.js';
import { createAudio } from './core/audio.js';
import { loadAtlas } from './core/atlas.js';
import { createCamera } from './core/camera.js';
import { createInput } from './core/input.js';
import { createLoop } from './core/loop.js';
import { createViewport } from './core/viewport.js';

import { sounds } from './data/sounds.js';
import { getTheme } from './data/themes.js';
import { createEmptyModel } from './level/model.js';
import { createPlayScene } from './game/play-scene.js';
import { createMakerScene } from './maker/maker-scene.js';
import { createMakerPalette } from './ui/maker-palette.js';
import { createMakerToolbar } from './ui/maker-toolbar.js';
import { createPaintPanToggle } from './ui/maker-toggle.js';
import { openResizeDialog } from './ui/components/resize-dialog.js';
import atlasJson from './data/atlas.json';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game'));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
const uiRoot = /** @type {HTMLElement} */ (document.getElementById('ui'));

const viewport = createViewport(canvas, ctx, {
  onResize() {
    const dw = window.innerWidth;
    const dh = window.innerHeight;
    const uiScale = Math.max(1, Math.min(3, Math.floor(Math.min(dw / 480, dh / 320))));
    document.documentElement.style.setProperty('--ui-scale', String(uiScale));
  },
});

const audio = createAudio();
const input = createInput(canvas, viewport);
const camera = createCamera();
const playScene = createPlayScene();
const makerScene = createMakerScene();

input.onFirstGesture(() => audio.resume());

/** @type {Awaited<ReturnType<typeof loadAtlas>> | null} */
let atlas = null;
/** @type {ReturnType<typeof createEmptyModel> | null} */
let level = null;
/** @type {'play' | 'maker'} */
let currentMode = 'maker';

let makerCamX = 0;
let makerCamY = 0;
let hasMakerCam = false;

let pendingRestart = false;

function createStubHud() {
  return {
    syncHearts() {},
    syncCoins() {},
    setPaused() {},
    showResults() {},
    destroy() {},
  };
}

function createStubTouch() {
  return { show() {}, hide() {}, destroy() {} };
}

function enterMaker() {
  if (!atlas || !level) return;
  makerScene.enter({
    level,
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
    onPlay() { switchToPlay(); },
    openResizeDialog,
  });
  makerScene.mountUI(uiRoot);
  if (hasMakerCam) {
    camera.x = makerCamX;
    camera.y = makerCamY;
  }
}

function enterPlay() {
  if (!atlas || !level) return;
  playScene.enter({
    level,
    theme: getTheme(level.theme),
    atlas,
    audio,
    input,
    camera,
    viewport,
    ui: { createHud: createStubHud, createTouch: createStubTouch },
    onDeath() { pendingRestart = true; },
    onReplay() { pendingRestart = true; },
  });
  playScene.mountUI(uiRoot);
}

function switchToPlay() {
  const editing = makerScene.getLevel();
  if (editing) level = editing;
  if (!level || level.goal == null) {
    console.warn('Place a goal flag before playing');
    return;
  }
  makerCamX = camera.x;
  makerCamY = camera.y;
  hasMakerCam = true;
  makerScene.unmountUI();
  makerScene.exit();
  currentMode = 'play';
  enterPlay();
}

function switchToMaker() {
  playScene.unmountUI();
  playScene.exit();
  audio.stopMusic();
  currentMode = 'maker';
  enterMaker();
}

function restartPlay() {
  playScene.unmountUI();
  playScene.exit();
  enterPlay();
}

/**
 * @param {number} dt
 */
function update(dt) {
  if (currentMode === 'maker') {
    makerScene.update(dt);
    if (input.keys.modeSwitch.pressed) switchToPlay();
  } else {
    playScene.update(dt);
    if (pendingRestart) {
      pendingRestart = false;
      restartPlay();
    }
    if (input.keys.modeSwitch.pressed) switchToMaker();
  }
}

function render() {
  viewport.apply(ctx);
  if (!atlas) {
    ctx.fillStyle = '#ddc6a1';
    ctx.fillRect(0, 0, viewport.viewW, VIEW_H);
    return;
  }
  if (currentMode === 'maker') makerScene.render(ctx, camera);
  else playScene.render(ctx, camera);
}

const loop = createLoop({ update, render });
loop.start();

Promise.all([
  loadAtlas(atlasJson),
  audio.load(sounds),
]).then(([loaded]) => {
  atlas = loaded;
  level = createEmptyModel();
  currentMode = 'maker';
  enterMaker();
}).catch((err) => {
  console.error('Failed to load:', err);
});
