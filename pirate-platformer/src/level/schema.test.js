import { describe, expect, it } from 'vitest';
import {
  LevelError,
  createBlankLevel,
  validateLevel,
} from './schema.js';

/**
 * @param {Record<string, unknown>} [over]
 */
function valid(over = {}) {
  const cols = /** @type {number} */ (over.cols ?? 40);
  const rows = /** @type {number} */ (over.rows ?? 12);
  const cells = cols * rows;
  const layers = {
    terrain: `0:${cells}`,
    platform: `0:${cells}`,
    water: `0:${cells}`,
    ...(typeof over.layers === 'object' && over.layers !== null ? over.layers : {}),
  };
  const { layers: _ignored, ...rest } = over;
  return {
    format: 1,
    id: 'lvl_test01',
    name: 'Test',
    author: '',
    theme: 'island',
    cols,
    rows,
    created: 1,
    modified: 1,
    spawn: { c: 1, r: 1 },
    goal: { c: 2, r: 2 },
    layers,
    decor: [],
    entities: [],
    ...rest,
    layers,
  };
}

/**
 * @param {unknown} raw
 * @param {string} field
 */
function expectField(raw, field) {
  try {
    validateLevel(raw);
    throw new Error('expected LevelError');
  } catch (err) {
    expect(err).toBeInstanceOf(LevelError);
    expect(/** @type {LevelError} */ (err).field).toBe(field);
  }
}

describe('validateLevel', () => {
  it('accepts a valid 40×12 level', () => {
    const data = validateLevel(valid());
    expect(data.format).toBe(1);
    expect(data.cols).toBe(40);
    expect(data.rows).toBe(12);
  });

  it('rejects a missing object', () => {
    expectField(null, 'level');
  });

  it('rejects unknown format', () => {
    expectField(valid({ format: 2 }), 'format');
  });

  it('rejects a non-integer format', () => {
    expectField(valid({ format: 1.5 }), 'format');
  });

  it('rejects an empty id', () => {
    expectField(valid({ id: '' }), 'id');
  });

  it('rejects a non-string name', () => {
    expectField(valid({ name: 3 }), 'name');
  });

  it('defaults missing author to empty string', () => {
    const raw = valid();
    delete raw.author;
    expect(validateLevel(raw).author).toBe('');
  });

  it('rejects an empty theme', () => {
    expectField(valid({ theme: '' }), 'theme');
  });

  it('rejects cols below 40', () => {
    expectField(valid({ cols: 39 }), 'cols');
  });

  it('rejects cols above 400', () => {
    expectField(valid({ cols: 401, layers: {
      terrain: '0:4812', platform: '0:4812', water: '0:4812',
    } }), 'cols');
  });

  it('rejects rows below 12', () => {
    expectField(valid({ rows: 11 }), 'rows');
  });

  it('rejects rows above 48', () => {
    expectField(valid({ rows: 49 }), 'rows');
  });

  it('rejects missing spawn', () => {
    const raw = valid();
    delete raw.spawn;
    expectField(raw, 'spawn');
  });

  it('rejects spawn.r out of range', () => {
    expectField(valid({ spawn: { c: 1, r: 12 } }), 'spawn.r');
  });

  it('rejects missing goal', () => {
    const raw = valid();
    delete raw.goal;
    expectField(raw, 'goal');
  });

  it('rejects RLE that does not fill the grid', () => {
    expectField(valid({ layers: { terrain: '0:10', platform: '0:480', water: '0:480' } }), 'layers.terrain');
  });

  it('rejects malformed RLE', () => {
    expectField(valid({ layers: { terrain: 'nope', platform: '0:480', water: '0:480' } }), 'layers.terrain');
  });

  it('rejects a non-array entities', () => {
    expectField(valid({ entities: {} }), 'entities');
  });

  it('rejects too many entities', () => {
    const entities = [];
    for (let i = 0; i < 401; i++) entities.push({ k: 'crabby', c: 0, r: 0 });
    expectField(valid({ entities }), 'entities');
  });

  it('rejects a numeric kind id', () => {
    expectField(valid({ entities: [{ k: 8, c: 0, r: 0 }] }), 'entities[0].k');
  });

  it('rejects entity c out of range', () => {
    expectField(valid({ entities: [{ k: 'crabby', c: 40, r: 0 }] }), 'entities[0].c');
  });

  it('rejects a non-object entity p', () => {
    expectField(valid({ entities: [{ k: 'crabby', c: 0, r: 0, p: 1 }] }), 'entities[0].p');
  });

  it('rejects too many decor', () => {
    const decor = [];
    for (let i = 0; i < 2001; i++) decor.push({ k: 'palm_back', c: 0, r: 0 });
    expectField(valid({ decor }), 'decor');
  });
});

describe('createBlankLevel', () => {
  it('builds a valid default 160×24 level', () => {
    const data = createBlankLevel();
    expect(data.cols).toBe(160);
    expect(data.rows).toBe(24);
    expect(data.layers.terrain).toBe('0:3840');
    expect(data.id.startsWith('lvl_')).toBe(true);
  });

  it('respects cols, rows, and name', () => {
    const data = createBlankLevel({ cols: 40, rows: 12, name: 'Tiny' });
    expect(data.cols).toBe(40);
    expect(data.name).toBe('Tiny');
    expect(data.layers.water).toBe('0:480');
  });
});
