import { describe, expect, it } from 'vitest';

import { deserialise, encodeShare, serialise, toJsonString } from '../level/codec.js';
import { createBlankLevel } from '../level/schema.js';
import { ImportError, readLevelText } from './import-level.js';

function level() {
  const model = deserialise(createBlankLevel({ name: 'Shared' }));
  model.entities.push({ k: 'crabby', c: 10, r: 5, p: { dir: -1 } });
  return model;
}

/**
 * @param {string} text
 * @returns {Promise<string>} the ImportError message
 */
async function refusal(text) {
  try {
    await readLevelText(text);
  } catch (err) {
    expect(err).toBeInstanceOf(ImportError);
    return /** @type {Error} */ (err).message;
  }
  throw new Error('expected an ImportError');
}

describe('readLevelText', () => {
  it('reads a share code', async () => {
    const model = level();
    const got = await readLevelText(await encodeShare(model));
    expect(toJsonString(got)).toBe(toJsonString(model));
  });

  it('reads an uncompressed share code', async () => {
    const model = level();
    const got = await readLevelText(await encodeShare(model, { compress: false }));
    expect(toJsonString(got)).toBe(toJsonString(model));
  });

  it('reads JSON', async () => {
    const model = level();
    const got = await readLevelText(`  ${toJsonString(model)}\n`);
    expect(toJsonString(got)).toBe(toJsonString(model));
  });

  it('strips line wrapping from a pasted code', async () => {
    const model = level();
    const code = await encodeShare(model);
    const wrapped = code.replace(/(.{20})/g, '$1\n  ');
    const got = await readLevelText(wrapped);
    expect(toJsonString(got)).toBe(toJsonString(model));
  });

  it('refuses empty text', async () => {
    expect(await refusal('   \n')).toBe('Paste a level code first.');
  });

  it('names the field when the level is malformed', async () => {
    expect(await refusal('xnot-a-code')).toMatch(/^That isn't a valid level \(encoding: /);
    const data = serialise(level());
    data.layers.terrain = '0:1';
    expect(await refusal(JSON.stringify(data))).toMatch(/layers\.terrain/);
  });

  it('says so when the level comes from a newer version', async () => {
    const data = { ...serialise(level()), format: 2 };
    expect(await refusal(JSON.stringify(data))).toBe(
      'This level was made with a newer version of Coral Corsairs.',
    );
  });

  it('refuses decoration this version does not have', async () => {
    const data = serialise(level());
    data.decor.push({ k: 'chandelier', c: 2, r: 2 });
    expect(await refusal(JSON.stringify(data))).toBe(
      'This level uses objects this version doesn\'t have: chandelier.',
    );
  });

  it('imports the three palm kinds', async () => {
    const model = level();
    model.decor.push(
      { k: 'palm_back', c: 4, r: 10 },
      { k: 'palm_back_left', c: 5, r: 10 },
      { k: 'palm_back_right', c: 6, r: 10 },
    );
    const got = await readLevelText(toJsonString(model));
    expect(got.decor).toEqual(model.decor);
  });

  it('refuses objects this version does not have', async () => {
    const data = serialise(level());
    data.entities.push({ k: 'kraken', c: 1, r: 1 }, { k: 'ghost_ship', c: 2, r: 1 });
    expect(await refusal(JSON.stringify(data))).toBe(
      'This level uses objects this version doesn\'t have: kraken, ghost_ship.',
    );
  });

  it('does not refuse a level with playability problems', async () => {
    const model = level();
    model.set('terrain', model.spawn.c, model.spawn.r, 1);
    const got = await readLevelText(toJsonString(model));
    expect(got.get('terrain', model.spawn.c, model.spawn.r)).toBe(1);
  });
});
