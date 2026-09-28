import { decodeShare, fromJsonString } from '../level/codec.js';
import { FORMAT, LevelError } from '../level/schema.js';
import { findProblems } from './validate.js';

/** @typedef {import('../level/model.js').LevelModel} LevelModel */

/** A reason an import was refused, worded for the player. */
export class ImportError extends Error {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(message);
    this.name = 'ImportError';
  }
}

/**
 * Turn pasted text — a share code or a level's JSON — into a level. The codec
 * validates the format; the registry check is the maker's, which is why this lives
 * here: a level from a newer version would otherwise lose objects silently.
 * Playability problems, such as a buried spawn, do not block an import. The maker
 * shows them like any other.
 *
 * @param {string} text
 * @returns {Promise<LevelModel>} the caller gives it a fresh id before saving
 */
export async function readLevelText(text) {
  const trimmed = text.trim();
  if (trimmed.length === 0) throw new ImportError('Paste a level code first.');

  let model;
  try {
    model = trimmed.startsWith('{')
      ? fromJsonString(trimmed)
      // Codes pasted from chat apps arrive line-wrapped.
      : await decodeShare(trimmed.replace(/\s+/g, ''));
  } catch (err) {
    if (!(err instanceof LevelError)) throw err;
    const version = /unsupported version (\d+)/.exec(err.message);
    if (err.field === 'format' && version && Number(version[1]) > FORMAT) {
      throw new ImportError('This level was made with a newer version of Coral Corsairs.');
    }
    throw new ImportError(`That isn't a valid level (${err.message}).`);
  }

  const unknown = findProblems(model).filter((p) => p.code === 'unknown-kind');
  if (unknown.length > 0) {
    const kinds = unknown.map((p) => p.k).join(', ');
    throw new ImportError(`This level uses objects this version doesn't have: ${kinds}.`);
  }
  return model;
}
