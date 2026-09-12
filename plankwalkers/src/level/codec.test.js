import { describe, expect, it } from 'vitest';
import {
  decodeRle,
  decodeShare,
  deserialise,
  encodeRle,
  encodeShare,
  fromJsonString,
  serialise,
  toJsonString,
} from './codec.js';
import { LevelError, createBlankLevel } from './schema.js';

const CANNON_COVE = {
  format: 1,
  id: 'lvl_7k3n8q',
  name: 'Cannon Cove',
  author: '',
  theme: 'island',
  cols: 160,
  rows: 24,
  created: 1757030400000,
  modified: 1757030400000,
  spawn: { c: 4, r: 18 },
  goal: { c: 152, r: 16 },
  layers: {
    terrain: '0:412,1:18,0:3,1:9,0:3398',
    platform: '0:3840',
    water: '0:3600,1:240',
  },
  decor: [{ k: 'palm_back', c: 12, r: 14 }],
  entities: [{ k: 'crabby', c: 30, r: 17, p: { dir: -1 } }],
};

describe('RLE', () => {
  it('round-trips empty, full, and mixed runs', () => {
    const empty = new Uint8Array(8);
    expect(encodeRle(empty)).toBe('0:8');
    expect(decodeRle('0:8', 8, 'layers.terrain')).toEqual(empty);

    const full = new Uint8Array(8).fill(1);
    expect(encodeRle(full)).toBe('1:8');
    expect(decodeRle('1:8', 8, 'layers.terrain')).toEqual(full);

    const mixed = Uint8Array.from([0, 0, 1, 1, 1, 0]);
    expect(encodeRle(mixed)).toBe('0:2,1:3,0:1');
    expect(decodeRle('0:2,1:3,0:1', 6, 'layers.terrain')).toEqual(mixed);
  });

  it('rejects a short run against cols × rows', () => {
    try {
      decodeRle('0:10', 480, 'layers.terrain');
      throw new Error('expected LevelError');
    } catch (err) {
      expect(err).toBeInstanceOf(LevelError);
      expect(/** @type {LevelError} */ (err).field).toBe('layers.terrain');
      expect(/** @type {Error} */ (err).message).toMatch(/cols × rows/);
    }
  });
});

describe('JSON serialise', () => {
  it('round-trips the Cannon Cove fixture byte-for-byte on layers', () => {
    const model = deserialise(CANNON_COVE);
    expect(model.cols).toBe(160);
    expect(model.rows).toBe(24);
    expect(model.layers.terrain.length).toBe(3840);
    expect(model.entities[0]).toEqual({ k: 'crabby', c: 30, r: 17, p: { dir: -1 } });

    const data = serialise(model);
    expect(data.layers.terrain).toBe(CANNON_COVE.layers.terrain);
    expect(data.layers.platform).toBe(CANNON_COVE.layers.platform);
    expect(data.layers.water).toBe(CANNON_COVE.layers.water);

    const again = deserialise(data);
    expect(again.layers.terrain).toEqual(model.layers.terrain);
    expect(again.layers.platform).toEqual(model.layers.platform);
    expect(again.layers.water).toEqual(model.layers.water);
    expect(again.spawn).toEqual({ c: 4, r: 18 });
    expect(again.goal).toEqual({ c: 152, r: 16 });
  });

  it('rejects malformed JSON with field json', () => {
    try {
      fromJsonString('{');
      throw new Error('expected LevelError');
    } catch (err) {
      expect(err).toBeInstanceOf(LevelError);
      expect(/** @type {LevelError} */ (err).field).toBe('json');
    }
  });

  it('toJsonString is the only stringify path and round-trips', () => {
    const model = deserialise(createBlankLevel({ cols: 40, rows: 12 }));
    model.set('water', 0, 11, 1);
    const copy = fromJsonString(toJsonString(model));
    expect(copy.get('water', 0, 11)).toBe(1);
    expect(copy.cols).toBe(40);
  });
});

describe('share codes', () => {
  it('uncompressed codes start with u and round-trip', async () => {
    const model = deserialise(createBlankLevel({ cols: 40, rows: 12, name: 'Share' }));
    model.set('terrain', 2, 2, 1);
    const code = await encodeShare(model, { compress: false });
    expect(code.startsWith('u')).toBe(true);
    const copy = await decodeShare(code);
    expect(copy.name).toBe('Share');
    expect(copy.get('terrain', 2, 2)).toBe(1);
    expect(copy.layers.terrain).toEqual(model.layers.terrain);
  });

  it('compressed codes start with z and round-trip', async () => {
    const model = deserialise(CANNON_COVE);
    const code = await encodeShare(model, { compress: true });
    expect(code.startsWith('z')).toBe(true);
    const copy = await decodeShare(code);
    expect(copy.id).toBe('lvl_7k3n8q');
    expect(copy.layers.terrain).toEqual(model.layers.terrain);
    expect(copy.entities).toEqual(model.entities);
    expect(copy.decor).toEqual(model.decor);
  });

  it('rejects an unknown prefix', async () => {
    try {
      await decodeShare('xAAAA');
      throw new Error('expected LevelError');
    } catch (err) {
      expect(err).toBeInstanceOf(LevelError);
      expect(/** @type {LevelError} */ (err).field).toBe('encoding');
    }
  });
});
