/** @typedef {import('../types.js').LevelData} LevelData */
/** @typedef {import('../types.js').LayerName} LayerName */

import { LevelModel } from './model.js';
import { LevelError, validateLevel } from './schema.js';

/**
 * @param {Uint8Array} cells
 * @returns {string}
 */
export function encodeRle(cells) {
  if (cells.length === 0) return '';
  const parts = [];
  let value = cells[0];
  let count = 1;
  for (let i = 1; i < cells.length; i++) {
    if (cells[i] === value) {
      count++;
    } else {
      parts.push(`${value}:${count}`);
      value = cells[i];
      count = 1;
    }
  }
  parts.push(`${value}:${count}`);
  return parts.join(',');
}

/**
 * @param {string} encoded
 * @param {number} expected
 * @param {string} field
 * @returns {Uint8Array}
 */
export function decodeRle(encoded, expected, field) {
  if (typeof encoded !== 'string' || encoded.length === 0) {
    throw new LevelError(field, 'expected an RLE string');
  }
  const out = new Uint8Array(expected);
  let offset = 0;
  const parts = encoded.split(',');
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const m = /^(\d+):(\d+)$/.exec(part);
    if (!m) throw new LevelError(field, `malformed run "${part}"`);
    const value = Number(m[1]);
    const count = Number(m[2]);
    if (value > 255) throw new LevelError(field, `value ${value} exceeds 255`);
    if (count < 1) throw new LevelError(field, 'run count must be ≥ 1');
    if (offset + count > expected) {
      throw new LevelError(field, `run counts sum past ${expected} (cols × rows)`);
    }
    out.fill(value, offset, offset + count);
    offset += count;
  }
  if (offset !== expected) {
    throw new LevelError(field, `run counts sum to ${offset}, expected ${expected} (cols × rows)`);
  }
  return out;
}

/**
 * @param {LevelModel} model
 * @returns {LevelData}
 */
export function serialise(model) {
  return {
    format: model.format,
    id: model.id,
    name: model.name,
    author: model.author,
    theme: model.theme,
    cols: model.cols,
    rows: model.rows,
    created: model.created,
    modified: model.modified,
    spawn: { c: model.spawn.c, r: model.spawn.r },
    goal: { c: model.goal.c, r: model.goal.r },
    layers: {
      terrain: encodeRle(model.layers.terrain),
      platform: encodeRle(model.layers.platform),
      water: encodeRle(model.layers.water),
    },
    decor: model.decor.map((d) => ({ k: d.k, c: d.c, r: d.r })),
    entities: model.entities.map((e) => ({
      k: e.k,
      c: e.c,
      r: e.r,
      ...(e.p ? { p: { ...e.p } } : {}),
    })),
  };
}

/**
 * @param {unknown} raw
 * @returns {LevelModel}
 */
export function deserialise(raw) {
  const data = validateLevel(raw);
  const n = data.cols * data.rows;
  return new LevelModel(data, {
    terrain: decodeRle(data.layers.terrain, n, 'layers.terrain'),
    platform: decodeRle(data.layers.platform, n, 'layers.platform'),
    water: decodeRle(data.layers.water, n, 'layers.water'),
  });
}

/**
 * @param {LevelModel} model
 * @returns {string}
 */
export function toJsonString(model) {
  return JSON.stringify(serialise(model));
}

/**
 * @param {string} text
 * @returns {LevelModel}
 */
export function fromJsonString(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new LevelError('json', 'malformed JSON');
  }
  return deserialise(raw);
}

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function toBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/**
 * @param {string} text
 * @returns {Uint8Array}
 */
function fromBase64Url(text) {
  const pad = text.length % 4 === 0 ? '' : '='.repeat(4 - (text.length % 4));
  const b64 = text.replaceAll('-', '+').replaceAll('_', '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * @param {Uint8Array} bytes
 * @param {CompressionFormat} format
 * @param {typeof CompressionStream | typeof DecompressionStream} Stream
 * @returns {Promise<Uint8Array>}
 */
async function pipeThrough(bytes, format, Stream) {
  const stream = new Blob([bytes]).stream().pipeThrough(new Stream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * @param {LevelModel} model
 * @param {{ compress?: boolean }} [opts]
 * @returns {Promise<string>}
 */
export async function encodeShare(model, opts = {}) {
  const bytes = new TextEncoder().encode(toJsonString(model));
  let compress = opts.compress !== false;
  if (compress && typeof CompressionStream === 'undefined') compress = false;
  if (compress) {
    try {
      const zipped = await pipeThrough(bytes, 'deflate-raw', CompressionStream);
      return `z${toBase64Url(zipped)}`;
    } catch {
      return `u${toBase64Url(bytes)}`;
    }
  }
  return `u${toBase64Url(bytes)}`;
}

/**
 * @param {unknown} code
 * @returns {Promise<LevelModel>}
 */
export async function decodeShare(code) {
  if (typeof code !== 'string' || code.length < 2) {
    throw new LevelError('encoding', 'empty or too short share code');
  }
  const prefix = code[0];
  let bytes;
  try {
    bytes = fromBase64Url(code.slice(1));
  } catch {
    throw new LevelError('encoding', 'invalid base64url');
  }
  if (prefix === 'z') {
    if (typeof DecompressionStream === 'undefined') {
      throw new LevelError('encoding', 'deflate-raw is unavailable');
    }
    try {
      bytes = await pipeThrough(bytes, 'deflate-raw', DecompressionStream);
    } catch {
      throw new LevelError('encoding', 'deflate-raw failed');
    }
  } else if (prefix !== 'u') {
    throw new LevelError('encoding', `unknown prefix "${prefix}"`);
  }
  return fromJsonString(new TextDecoder().decode(bytes));
}
