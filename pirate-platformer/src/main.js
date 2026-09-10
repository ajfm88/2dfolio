import './ui/styles/base.css';

import { TILE, VIEW_H } from './settings.js';
import { loadAtlas } from './core/atlas.js';
import { createCamera } from './core/camera.js';
import { createInput } from './core/input.js';
import { createLoop } from './core/loop.js';
import { createSprite } from './core/sprite.js';
import { createViewport } from './core/viewport.js';

import atlasJson from './data/atlas.json';

const WORLD_COLS = 80;
const WORLD_ROWS = 24;
const WORLD_W = WORLD_COLS * TILE;
const WORLD_H = WORLD_ROWS * TILE;
const DEMO_SPEED = 100;
const SKY = '#ddc6a1';
const INK = '#33323d';

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

/** @type {ReturnType<typeof createSprite> | null} */
let sprite = null;
let clipW = 64;
let clipH = 40;
let capX = (WORLD_W - clipW) / 2;
let capY = (WORLD_H - clipH) / 2;
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

function drawGrid() {
  const left = camera.x;
  const top = camera.y;
  const right = left + viewport.viewW;
  const bottom = top + VIEW_H;
  const x0 = Math.floor(left / TILE) * TILE;
  const y0 = Math.floor(top / TILE) * TILE;

  ctx.strokeStyle = INK;
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = x0; x <= right; x += TILE) {
    const sx = Math.round(x - left) + 0.5;
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, VIEW_H);
  }
  for (let y = y0; y <= bottom; y += TILE) {
    const sy = Math.round(y - top) + 0.5;
    ctx.moveTo(0, sy);
    ctx.lineTo(viewport.viewW, sy);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  const bx = Math.round(0 - left) + 0.5;
  const by = Math.round(0 - top) + 0.5;
  ctx.strokeStyle = INK;
  ctx.strokeRect(bx, by, WORLD_W - 1, WORLD_H - 1);
}

function render() {
  viewport.apply(ctx);
  ctx.fillStyle = SKY;
  ctx.fillRect(0, 0, viewport.viewW, VIEW_H);
  drawGrid();
  if (sprite) sprite.draw(ctx, camera, capX, capY, facing < 0);
}

const loop = createLoop({ update, render });
loop.start();

loadAtlas(atlasJson).then((atlas) => {
  const clip = atlas.get('player/idle');
  clipW = clip.fw;
  clipH = clip.fh;
  capX = (WORLD_W - clipW) / 2;
  capY = (WORLD_H - clipH) / 2;
  sprite = createSprite(clip);
}).catch((err) => {
  console.error(err);
});
