/**
 * Build the Perf Stress level and, when run directly, write the fixture.
 * `npm run perf-level` is the direct run. Tests import `buildPerfLevel` only.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { toJsonString } from '../src/level/codec.js';
import { createEmptyModel } from '../src/level/model.js';

const KINDS = ['crabby', 'fierce_tooth', 'pink_star', 'cannon', 'seashell'];
const PALMS = ['palm_back', 'palm_back_left', 'palm_back_right'];
const COLS = 160;
const ROWS = 24;

/** @returns {import('../src/level/model.js').LevelModel} */
export function buildPerfLevel() {
  const model = createEmptyModel({ cols: COLS, rows: ROWS, theme: 'island' });
  model.id = 'lvl_perfstrs';
  model.name = 'Perf Stress';
  model.author = '';
  model.theme = 'island';
  model.spawn.c = 1;
  model.spawn.r = 19;
  model.goal = { c: 158, r: 19 };

  const terrain = model.layers.terrain;
  const platform = model.layers.platform;
  const water = model.layers.water;
  for (let r = 20; r <= 23; r++) {
    const row = r * COLS;
    for (let c = 0; c <= 119; c++) terrain[row + c] = 1;
    for (let c = 120; c <= 159; c++) water[row + c] = 1;
  }
  for (let r = 0; r <= 19; r++) {
    const row = r * COLS;
    terrain[row + 3] = 1;
    for (let c = 0; c < COLS; c++) {
      if (c !== 3) platform[row + c] = 1;
    }
  }

  model.entities = [];
  for (let i = 0; i < 20; i++) {
    model.entities.push({
      k: KINDS[i % KINDS.length],
      c: 4 + i,
      r: 19,
      p: { dir: -1 },
    });
  }

  // Descending by row, then column: the worst case for the decor insertion sort.
  /** @type {import('../src/types.js').DecorRecord[]} */
  const decor = [];
  for (let r = 19; r >= 0; r--) {
    for (let c = COLS - 1; c >= 0; c--) {
      if ((c + 3 * r) % 8 < 5) {
        decor.push({ k: PALMS[(c + r) % 3], c, r });
      }
    }
  }
  model.decor = decor;

  // After the layer writes. createEmptyModel stamps Date.now(), and model.set would too.
  model.created = 1759795200000;
  model.modified = 1759795200000;
  return model;
}

const entry = process.argv[1];
if (entry && path.resolve(entry) === fileURLToPath(import.meta.url)) {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'perf-stress.json'), toJsonString(buildPerfLevel()) + '\n');
}
