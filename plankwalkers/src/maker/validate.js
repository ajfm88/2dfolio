import { ENTITIES_MAX } from '../level/schema.js';
import { byId } from '../data/palette.js';

/** @typedef {import('../level/model.js').LevelModel} LevelModel */

/**
 * @typedef {'no-goal'
 *   | 'spawn-in-terrain'
 *   | 'spawn-in-water'
 *   | 'goal-in-terrain'
 *   | 'spawn-on-goal'
 *   | 'too-many-entities'
 *   | 'unknown-kind'} ProblemCode
 *
 * @typedef {{ code: ProblemCode, message: string }} Problem
 */

/**
 * Every reason the level cannot be test-played, in reporting order. This is a
 * playability check for the maker, not a format rule — `level/schema.js` stays the
 * format validator and never imports the palette (it would pull `game/` into
 * `level/`). Allocates its result, so call it when the level changes, not per frame.
 *
 * @param {LevelModel} level
 * @returns {Problem[]} empty when the level can be played
 */
export function findProblems(level) {
  /** @type {Problem[]} */
  const problems = [];
  const { spawn, goal } = level;

  if (goal === null) {
    problems.push({ code: 'no-goal', message: 'Place the finish flag to play.' });
  }
  // The player spawns with its feet on the cell's bottom edge; inside a solid cell
  // the resolver has no clean edge to push it out through, so it starts stuck.
  if (level.get('terrain', spawn.c, spawn.r) !== 0) {
    problems.push({
      code: 'spawn-in-terrain',
      message: 'The spawn point is buried in terrain.',
    });
  }
  // Water under the player's feet is death on the first frame: an endless restart.
  if (level.get('water', spawn.c, spawn.r) !== 0) {
    problems.push({ code: 'spawn-in-water', message: 'The spawn point is underwater.' });
  }
  if (goal !== null) {
    // The flag's hitbox sits inside its cell; a player resolved against the
    // surrounding solid can never overlap it, so the level cannot be finished.
    if (level.get('terrain', goal.c, goal.r) !== 0) {
      problems.push({
        code: 'goal-in-terrain',
        message: 'The finish flag is buried in terrain.',
      });
    }
    // The player would finish on the first frame.
    if (goal.c === spawn.c && goal.r === spawn.r) {
      problems.push({
        code: 'spawn-on-goal',
        message: 'The spawn point and the finish flag share a cell.',
      });
    }
  }
  // The maker places without a cap; the codec does not load past it.
  if (level.entities.length > ENTITIES_MAX) {
    problems.push({
      code: 'too-many-entities',
      message: `Too many objects: ${level.entities.length} of ${ENTITIES_MAX}.`,
    });
  }

  // Kind-in-registry check. The maker cannot produce an unknown kind, but a level
  // from a fixture or an import can.
  /** @type {string[]} */
  const unknown = [];
  for (let i = 0; i < level.entities.length; i++) {
    const k = level.entities[i].k;
    const entry = byId(k);
    if ((!entry || entry.placement !== 'entity') && !unknown.includes(k)) unknown.push(k);
  }
  for (let i = 0; i < level.decor.length; i++) {
    const k = level.decor[i].k;
    const entry = byId(k);
    if ((!entry || entry.placement !== 'decor') && !unknown.includes(k)) unknown.push(k);
  }
  for (let i = 0; i < unknown.length; i++) {
    problems.push({ code: 'unknown-kind', message: `Unknown object "${unknown[i]}".` });
  }

  return problems;
}
