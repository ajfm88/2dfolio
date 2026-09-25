import { describe, expect, it } from 'vitest';
import { ENTITIES_MAX } from '../level/schema.js';
import { createEmptyModel } from '../level/model.js';
import { findProblems } from './validate.js';

/** A small level with the flag placed and nothing wrong with it. */
function validLevel() {
  const level = createEmptyModel({ cols: 40, rows: 12 });
  level.goal = { c: 30, r: 6 };
  return level;
}

/** @param {ReturnType<typeof findProblems>} problems */
function codes(problems) {
  return problems.map((p) => p.code);
}

describe('findProblems', () => {
  it('returns nothing for a playable level', () => {
    expect(findProblems(validLevel())).toEqual([]);
  });

  it('a fresh maker level needs its flag', () => {
    const problems = findProblems(createEmptyModel());
    expect(codes(problems)).toEqual(['no-goal']);
    expect(problems[0].message).toBe('Place the finish flag to play.');
  });

  it('spawn buried in terrain', () => {
    const level = validLevel();
    level.set('terrain', level.spawn.c, level.spawn.r, 1);
    expect(codes(findProblems(level))).toEqual(['spawn-in-terrain']);
  });

  it('spawn underwater', () => {
    const level = validLevel();
    level.set('water', level.spawn.c, level.spawn.r, 1);
    expect(codes(findProblems(level))).toEqual(['spawn-in-water']);
  });

  it('terrain next to the spawn is fine — only its own cell counts', () => {
    const level = validLevel();
    level.set('terrain', level.spawn.c, level.spawn.r + 1, 1);
    level.set('terrain', level.spawn.c + 1, level.spawn.r, 1);
    expect(findProblems(level)).toEqual([]);
  });

  it('flag buried in terrain', () => {
    const level = validLevel();
    level.set('terrain', 30, 6, 1);
    expect(codes(findProblems(level))).toEqual(['goal-in-terrain']);
  });

  it('a platform or water under the flag is not a problem', () => {
    const level = validLevel();
    level.set('platform', 30, 6, 1);
    level.set('water', 30, 7, 1);
    expect(findProblems(level)).toEqual([]);
  });

  it('spawn and flag on one cell', () => {
    const level = validLevel();
    level.goal = { c: level.spawn.c, r: level.spawn.r };
    expect(codes(findProblems(level))).toEqual(['spawn-on-goal']);
  });

  it('more entities than a level may hold', () => {
    const level = validLevel();
    for (let i = 0; i <= ENTITIES_MAX; i++) level.entities.push({ k: 'coin_gold', c: 0, r: 0 });
    const problems = findProblems(level);
    expect(codes(problems)).toEqual(['too-many-entities']);
    expect(problems[0].message).toBe(`Too many objects: ${ENTITIES_MAX + 1} of ${ENTITIES_MAX}.`);
  });

  it('exactly the limit is fine', () => {
    const level = validLevel();
    for (let i = 0; i < ENTITIES_MAX; i++) level.entities.push({ k: 'coin_gold', c: 0, r: 0 });
    expect(findProblems(level)).toEqual([]);
  });

  it('unknown kinds, once per kind, including a kind in the wrong list', () => {
    const level = validLevel();
    level.entities.push({ k: 'kraken', c: 1, r: 1 });
    level.entities.push({ k: 'kraken', c: 2, r: 1 });
    // A tile id is in the registry, but it is not an entity.
    level.entities.push({ k: 'terrain', c: 3, r: 1 });
    // An entity id is not decor.
    level.decor.push({ k: 'crabby', c: 4, r: 1 });
    const problems = findProblems(level);
    expect(codes(problems)).toEqual(['unknown-kind', 'unknown-kind', 'unknown-kind']);
    expect(problems.map((p) => p.message)).toEqual([
      'Unknown object "kraken".',
      'Unknown object "terrain".',
      'Unknown object "crabby".',
    ]);
  });

  it('reports every problem in table order', () => {
    const level = createEmptyModel({ cols: 40, rows: 12 });
    level.entities.push({ k: 'kraken', c: 1, r: 1 });
    level.set('water', level.spawn.c, level.spawn.r, 1);
    level.set('terrain', level.spawn.c, level.spawn.r, 1);
    expect(codes(findProblems(level))).toEqual([
      'no-goal',
      'spawn-in-terrain',
      'spawn-in-water',
      'unknown-kind',
    ]);
  });
});
