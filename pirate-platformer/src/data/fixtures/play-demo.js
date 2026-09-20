import { deserialise } from '../../level/codec.js';

/**
 * 60×16 fixture for Units 07–10: terrain floor with gaps, water, platforms,
 * spawn left, goal right, treasure and spikes on the path, and one of each
 * walker enemy placed where its own behaviour is the thing being tested.
 * @returns {import('../../level/model.js').LevelModel}
 */
export function createPlayFixture() {
  /** @type {import('../../types.js').LevelData} */
  const data = {
    format: 1,
    id: 'lvl_playdemo',
    name: 'Play Demo',
    author: '',
    theme: 'island',
    cols: 60,
    rows: 16,
    created: 0,
    modified: 0,
    spawn: { c: 3, r: 12 },
    goal: { c: 55, r: 12 },
    layers: {
      terrain: buildTerrainRle(),
      platform: buildPlatformRle(),
      water: buildWaterRle(),
    },
    decor: [],
    entities: [
      { k: 'coin_gold', c: 5, r: 12 },
      { k: 'coin_silver', c: 7, r: 12 },
      { k: 'spikes', c: 12, r: 12 },
      { k: 'potion_red', c: 14, r: 12 },
      { k: 'diamond_red', c: 14, r: 8 },
      { k: 'diamond_green', c: 15, r: 8 },
      { k: 'diamond_blue', c: 16, r: 8 },
      { k: 'potion_blue', c: 21, r: 10 },
      { k: 'coin_gold', c: 26, r: 12 },
      { k: 'spikes', c: 33, r: 12 },
      { k: 'spikes', c: 34, r: 12 },
      { k: 'spikes', c: 35, r: 12 },
      { k: 'skull', c: 44, r: 12 },
      { k: 'coin_silver', c: 48, r: 12 },
      { k: 'coin_silver', c: 50, r: 12 },
      // Fires pearls left toward the col-10 wall (~3.2 s at 75 px/s, inside the
      // 5 s lifetime), so they burst on terrain in the cols 11–19 lane the player
      // enters right after wall-jumping the col-10 wall.
      { k: 'seashell', c: 19, r: 12, p: { dir: -1 } },
      // Fires cannonballs left into the col-49 pillar 3 tiles away, so standing
      // left of the pillar on the run-up to the flag is safe — terrain blocks it.
      { k: 'cannon', c: 53, r: 12, p: { dir: -1 } },
      // Patrols between the col-10 wall and the col-20 pit edge, so it turns at
      // both a wall and a ledge, and lunges along the flat between them.
      { k: 'fierce_tooth', c: 17, r: 12, p: { dir: -1 } },
      // Directly under the drop off the east end of the row-11 platform: dive on
      // it and meet the spin block.
      { k: 'pink_star', c: 25, r: 12 },
      // Rides the semi-solid platform over the second pit, turning at both edges.
      { k: 'crabby', c: 39, r: 10 },
      // Guards the skull at (44, 12): taking it means stepping into the strike.
      { k: 'crabby', c: 46, r: 12 },
    ],
  };

  return deserialise(data);
}

function buildTerrainRle() {
  const cols = 60;
  const rows = 16;
  const grid = new Uint8Array(cols * rows);

  for (let c = 0; c < cols; c++) {
    grid[13 * cols + c] = 1;
    grid[14 * cols + c] = 1;
  }

  // gap at cols 20-23 (pit death)
  for (let c = 20; c <= 23; c++) {
    grid[13 * cols + c] = 0;
    grid[14 * cols + c] = 0;
  }

  // gap at cols 38-40 (wider pit over water)
  for (let c = 38; c <= 40; c++) {
    grid[13 * cols + c] = 0;
    grid[14 * cols + c] = 0;
  }

  // wall at col 10 for wall-jump testing
  for (let r = 8; r <= 12; r++) {
    grid[r * cols + 10] = 1;
  }

  // ceiling overhang at cols 28-30 for head-bump
  for (let c = 28; c <= 30; c++) {
    grid[9 * cols + c] = 1;
  }

  // 2-tile pillar at col 49 (rows 11-12): the cannon's backstop, so a ball
  // explodes on terrain rather than only ever running out its lifetime.
  grid[11 * cols + 49] = 1;
  grid[12 * cols + 49] = 1;

  return rleEncode(grid);
}

function buildPlatformRle() {
  const cols = 60;
  const rows = 16;
  const grid = new Uint8Array(cols * rows);

  // platforms over the first gap
  for (let c = 19; c <= 24; c++) {
    grid[11 * cols + c] = 1;
  }

  // platforms over the second gap
  for (let c = 37; c <= 41; c++) {
    grid[11 * cols + c] = 1;
  }

  // high platform for vertical play
  for (let c = 14; c <= 17; c++) {
    grid[9 * cols + c] = 1;
  }

  return rleEncode(grid);
}

function buildWaterRle() {
  const cols = 60;
  const rows = 16;
  const grid = new Uint8Array(cols * rows);

  // water in the bottom row
  for (let c = 0; c < cols; c++) {
    grid[15 * cols + c] = 1;
  }

  return rleEncode(grid);
}

/**
 * @param {Uint8Array} grid
 * @returns {string}
 */
function rleEncode(grid) {
  const parts = [];
  let val = grid[0];
  let count = 1;
  for (let i = 1; i < grid.length; i++) {
    if (grid[i] === val) {
      count++;
    } else {
      parts.push(`${val}:${count}`);
      val = grid[i];
      count = 1;
    }
  }
  parts.push(`${val}:${count}`);
  return parts.join(',');
}
