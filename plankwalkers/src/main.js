import './ui/styles/base.css';

import { TILE, VIEW_H } from './settings.js';
import { loadAtlas } from './core/atlas.js';
import { createCamera } from './core/camera.js';
import { createInput } from './core/input.js';
import { createLoop } from './core/loop.js';
import { createSprite } from './core/sprite.js';
import { createViewport } from './core/viewport.js';

import { drawTiles } from './level/render.js';

import { createAutotileFixture } from './data/fixtures/autotile-demo.js';
import { getTheme } from './data/themes.js';
import atlasJson from './data/atlas.json';

const DEMO_SPEED = 100;
const SKY = '#ddc6a1';

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
/** @type {ReturnType<typeof createSprite> | null} */
let sprite = null;
let clipW = 64;
let clipH = 40;
let capX = level.spawn.c * TILE;
let capY = level.spawn.r * TILE;
let facing = 1;
let dragCapX = 0;
let dragCapY = 0;
let dragPtrX = 0;
let dragPtrY = 0;

/**
 * @param {number} dt
 */
function update(dt) {
  input.advance();
  if (!sprite) return;

  if (input.pointer.pressed) {
    capX = camera.x + input.pointer.x - clipW / 2;
    capY = camera.y + input.pointer.y - clipH / 2;
    dragCapX = capX;
    dragCapY = capY;
    dragPtrX = input.pointer.x;
    dragPtrY = input.pointer.y;
  }

  if (input.pointer.down) {
    const nextX = dragCapX + (input.pointer.x - dragPtrX);
    if (nextX > capX) facing = 1;
    else if (nextX < capX) facing = -1;
    capX = nextX;
    capY = dragCapY + (input.pointer.y - dragPtrY);
  } else {
    let vx = 0;
    let vy = 0;
    if (input.keys.left.held) vx -= 1;
    if (input.keys.right.held) vx += 1;
    if (input.keys.up.held) vy -= 1;
    if (input.keys.down.held) vy += 1;
    if (vx !== 0 || vy !== 0) {
      const len = Math.sqrt(vx * vx + vy * vy);
      capX += (vx / len) * DEMO_SPEED * dt;
      capY += (vy / len) * DEMO_SPEED * dt;
      if (vx !== 0) facing = vx;
    }
  }

  if (capX < 0) capX = 0;
  else if (capX > WORLD_W - clipW) capX = WORLD_W - clipW;
  if (capY < 0) capY = 0;
  else if (capY > WORLD_H - clipH) capY = WORLD_H - clipH;

  sprite.update(dt);
  if (!input.pointer.down) {
    camera.follow(capX + clipW / 2, capY + clipH / 2, viewport.viewW, VIEW_H, WORLD_W, WORLD_H);
  }
}

function render() {
  viewport.apply(ctx);
  ctx.fillStyle = SKY;
  ctx.fillRect(0, 0, viewport.viewW, VIEW_H);
  if (atlas) {
    drawTiles(ctx, camera, viewport.viewW, VIEW_H, level, theme, atlas);
  }
  if (sprite) sprite.draw(ctx, camera, capX, capY, facing < 0);
}

const loop = createLoop({ update, render });
loop.start();

loadAtlas(atlasJson).then((loaded) => {
  atlas = loaded;
  const clip = loaded.get('player/idle');
  clipW = clip.fw;
  clipH = clip.fh;
  capX = level.spawn.c * TILE;
  capY = level.spawn.r * TILE - (clipH - TILE);
  sprite = createSprite(clip);
}).catch((err) => {
  console.error(err);
});
