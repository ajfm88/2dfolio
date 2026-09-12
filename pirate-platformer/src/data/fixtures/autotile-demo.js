import { deserialise } from '../../level/codec.js';
import { createBlankLevel } from '../../level/schema.js';

/**
 * 40×12 fixture: singles, a column, a bar, a mass with a hole, platforms, water.
 * @returns {import('../../level/model.js').LevelModel}
 */
export function createAutotileFixture() {
  const level = deserialise(createBlankLevel({
    cols: 40,
    rows: 12,
    name: 'Autotile',
    id: 'lvl_autotile',
  }));

  for (let c = 0; c < 40; c++) {
    level.set('terrain', c, 10, 1);
    level.set('water', c, 11, 1);
  }

  level.set('terrain', 2, 8, 1);
  level.set('terrain', 3, 6, 1);

  for (let r = 4; r <= 10; r++) {
    level.set('terrain', 6, r, 1);
  }

  for (let c = 17; c <= 24; c++) {
    for (let r = 7; r <= 10; r++) {
      level.set('terrain', c, r, 1);
    }
  }
  level.set('terrain', 20, 8, 0);

  for (let c = 10; c <= 16; c++) {
    level.set('platform', c, 6, 1);
  }

  level.spawn = { c: 18, r: 6 };
  level.goal = { c: 36, r: 9 };
  return level;
}
