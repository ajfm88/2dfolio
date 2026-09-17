import './ui/styles/base.css';

import { VIEW_H } from './settings.js';
import { loadAtlas } from './core/atlas.js';
import { createCamera } from './core/camera.js';
import { createInput } from './core/input.js';
import { createLoop } from './core/loop.js';
import { createViewport } from './core/viewport.js';

import { getTheme } from './data/themes.js';
import { createPlayFixture } from './data/fixtures/play-demo.js';
import { createPlayScene } from './game/play-scene.js';
import { createPlayHud } from './ui/hud.js';
import { createTouchControls } from './ui/touch-controls.js';
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

const input = createInput(canvas, viewport);
const camera = createCamera();
const scene = createPlayScene();

/** @type {Awaited<ReturnType<typeof loadAtlas>> | null} */
let atlas = null;

function enterLevel() {
  if (!atlas) return;
  const level = createPlayFixture();
  const theme = getTheme(level.theme);
  scene.enter({
    level,
    theme,
    atlas,
    input,
    camera,
    viewport,
    ui: { createHud: createPlayHud, createTouch: createTouchControls },
    onDeath() { pendingRestart = true; },
    onReplay() { pendingRestart = true; },
  });
  scene.mountUI(uiRoot);
}

// Death and replay are requested from inside scene.update; the actual scene
// transition (which mounts/unmounts DOM) runs here, after update returns, so the
// scene's update never touches the DOM (invariant 3).
let pendingRestart = false;

function restart() {
  scene.unmountUI();
  scene.exit();
  enterLevel();
}

/**
 * @param {number} dt
 */
function update(dt) {
  scene.update(dt);
  if (pendingRestart) {
    pendingRestart = false;
    restart();
  }
}

function render() {
  viewport.apply(ctx);
  if (!atlas) {
    ctx.fillStyle = '#ddc6a1';
    ctx.fillRect(0, 0, viewport.viewW, VIEW_H);
    return;
  }
  scene.render(ctx, camera);
}

const loop = createLoop({ update, render });
loop.start();

loadAtlas(atlasJson).then((loaded) => {
  atlas = loaded;
  enterLevel();
}).catch((err) => {
  console.error('Failed to load atlas:', err);
});
