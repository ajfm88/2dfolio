import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { fromJsonString, toJsonString } from '../src/level/codec.js';
import { findProblems } from '../src/maker/validate.js';
import { buildPerfLevel } from './make-perf-level.mjs';

const fixturePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'perf-stress.json');

describe('buildPerfLevel', () => {
  it('matches the committed fixture byte for byte', () => {
    const file = readFileSync(fixturePath, 'utf8');
    expect(toJsonString(buildPerfLevel()) + '\n').toBe(file);
  });

  it('loads and has nothing wrong with it', () => {
    const level = fromJsonString(readFileSync(fixturePath, 'utf8'));
    expect(findProblems(level)).toEqual([]);
  });

  it('stores 2000 distinct palms in rows 0–19, strictly descending', () => {
    const level = buildPerfLevel();
    expect(level.decor).toHaveLength(2000);
    const seen = new Set();
    for (let i = 0; i < level.decor.length; i++) {
      const d = level.decor[i];
      expect(d.r).toBeGreaterThanOrEqual(0);
      expect(d.r).toBeLessThanOrEqual(19);
      expect(d.k.startsWith('palm_')).toBe(true);
      const key = d.r * level.cols + d.c;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      if (i > 0) {
        const prev = level.decor[i - 1];
        const descending = d.r < prev.r || (d.r === prev.r && d.c < prev.c);
        expect(descending).toBe(true);
      }
    }
  });

  it('places 20 entities on row 19 in columns 4–23', () => {
    const level = buildPerfLevel();
    expect(level.entities).toHaveLength(20);
    for (let i = 0; i < 20; i++) {
      expect(level.entities[i].r).toBe(19);
      expect(level.entities[i].c).toBe(4 + i);
    }
  });

  it('gives every cell in rows 0–23 terrain, a platform or water', () => {
    const level = buildPerfLevel();
    for (let r = 0; r < 24; r++) {
      for (let c = 0; c < level.cols; c++) {
        const filled = level.get('terrain', c, r) || level.get('platform', c, r) || level.get('water', c, r);
        expect(filled).not.toBe(0);
      }
    }
  });
});
