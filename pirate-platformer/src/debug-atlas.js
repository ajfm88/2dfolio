import './ui/styles/base.css';
import './ui/styles/debug-atlas.css';
import atlasJson from './data/atlas.json';

/** @typedef {{ src: string, fw: number, fh: number, n: number, fps?: number }} AtlasClip */

/** @type {Record<string, AtlasClip>} */
const atlas = atlasJson;

const SCALE = 2;
const root = document.getElementById('atlas');
if (!root) throw new Error('#atlas missing');

const ids = Object.keys(atlas);
const heading = document.createElement('h1');
heading.className = 'atlas__head';
heading.textContent = `Atlas — ${ids.length} clips`;
root.append(heading);

/**
 * @param {string} id
 * @param {{ src: string, fw: number, fh: number, n: number, fps?: number }} clip
 */
function mountClip(id, clip) {
  const row = document.createElement('section');
  row.className = 'clip';

  const label = document.createElement('div');
  label.className = 'clip__label';
  const fps = clip.fps != null ? `  ${clip.fps}fps` : '';
  label.textContent = `${id}  ${clip.n}×${clip.fw}×${clip.fh}${fps}`;
  row.append(label);

  const canvas = document.createElement('canvas');
  canvas.width = clip.fw * clip.n * SCALE;
  canvas.height = clip.fh * SCALE;
  canvas.style.width = `${clip.fw * clip.n * SCALE}px`;
  canvas.style.height = `${clip.fh * SCALE}px`;
  row.append(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context missing');
  ctx.imageSmoothingEnabled = false;

  const img = new Image();
  img.decoding = 'async';
  img.addEventListener('load', () => {
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.drawImage(img, 0, 0);
  });
  img.addEventListener('error', () => {
    label.textContent = `${id}  FAILED to load /assets/${clip.src}`;
  });
  img.src = `/assets/${clip.src}`;

  root.append(row);
}

for (const id of ids) {
  mountClip(id, atlas[id]);
}
