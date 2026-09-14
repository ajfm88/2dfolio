import './ui/styles/base.css';

import { TILE, VIEW_H } from './settings.js';
import { loadAtlas } from './core/atlas.js';
import { createCamera } from './core/camera.js';
import { createInput } from './core/input.js';
import { createLoop } from './core/loop.js';
import { createViewport } from './core/viewport.js';

import { createParallax } from './level/parallax.js';
import { drawLevel } from './level/render.js';

import { createAutotileFixture } from './data/fixtures/autotile-demo.js';
import { getTheme } from './data/themes.js';
import { Player } from './game/player.js';
import atlasJson from './data/atlas.json';

const level = createAutotileFixture();
const theme = getTheme(level.theme);
const WORLD_W = level.cols * TILE;
const WORLD_H = level.rows * TILE;

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game'));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

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

/** @type {Awaited<ReturnType<typeof loadAtlas>> | null} */
let atlas = null;
/** @type {ReturnType<typeof createParallax> | null} */
let parallax = null;
/** @type {Player | null} */
let player = null;

/**
 * @param {number} dt
 */
function update(dt) {
  input.advance();
  if (!player || !parallax) return;

  player.update(dt);
  parallax.update(dt, camera.x, viewport.viewW);

  const cx = player.hitbox.x + player.hitbox.w / 2;
  const cy = player.hitbox.y + player.hitbox.h / 2;
  camera.follow(cx, cy, viewport.viewW, VIEW_H, WORLD_W, WORLD_H);
}

function render() {
  viewport.apply(ctx);
  if (atlas && parallax) {
    drawLevel(ctx, camera, viewport.viewW, VIEW_H, level, theme, atlas, parallax);
  } else {
    ctx.fillStyle = theme.sky;
    ctx.fillRect(0, 0, viewport.viewW, VIEW_H);
  }
  if (player) player.draw(ctx, camera);
}

const loop = createLoop({ update, render });
loop.start();

loadAtlas(atlasJson).then((loaded) => {
  atlas = loaded;
  parallax = createParallax(level, theme, loaded);

  player = new Player(
    level.spawn,
    level,
    input.keys,
    {
      idle: loaded.get('player/idle'),
      run: loaded.get('player/run'),
      jump: loaded.get('player/jump'),
      fall: loaded.get('player/fall'),
    },
  );
}).catch((err) => {
  console.error(err);
});
