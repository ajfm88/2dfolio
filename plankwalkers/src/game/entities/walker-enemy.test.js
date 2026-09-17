import { describe, it, expect } from 'vitest';

import { TILE, FIXED_DT } from '../../settings.js';
import { deserialise } from '../../level/codec.js';
import { tuning } from '../../data/tuning.js';
import { byId } from '../../data/palette.js';
import atlasJson from '../../data/atlas.json';

import { Stats } from '../stats.js';

const COLS = 40;
const ROWS = 12;
const FLOOR_R = 9;
const GAP_C0 = 10;
const GAP_C1 = 11;
const WALL_C = 5;
const PLAT_R = 5;
const PLAT_C0 = 14;
const PLAT_C1 = 17;

/**
 * Real frame counts, so a state that lasts exactly one play of its clip lasts
 * the right time. A flat `n: 4` mock would silently test the wrong durations.
 * @param {string} id
 */
function clipOf(id) {
  const c = atlasJson[/** @type {keyof typeof atlasJson} */ (id)];
  return { image: {}, fw: c.fw, fh: c.fh, n: c.n, fps: c.fps };
}

function mockAtlas() {
  return { get: clipOf };
}

/**
 * @param {Uint8Array} grid
 */
function rle(grid) {
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

/**
 * Flat floor with one gap, one wall standing on it, and one semi-solid platform.
 */
function testLevel() {
  const terrain = new Uint8Array(COLS * ROWS);
  const platform = new Uint8Array(COLS * ROWS);
  const water = new Uint8Array(COLS * ROWS);

  for (let c = 0; c < COLS; c++) {
    if (c >= GAP_C0 && c <= GAP_C1) continue;
    terrain[FLOOR_R * COLS + c] = 1;
  }
  // One tile tall, at the height a walker's wall sensor sweeps.
  terrain[(FLOOR_R - 1) * COLS + WALL_C] = 1;

  for (let c = PLAT_C0; c <= PLAT_C1; c++) {
    platform[PLAT_R * COLS + c] = 1;
  }

  return deserialise({
    format: 1,
    id: 'lvl_walkertest',
    name: 'Walker Test',
    author: '',
    theme: 'island',
    cols: COLS,
    rows: ROWS,
    created: 0,
    modified: 0,
    spawn: { c: 1, r: FLOOR_R - 1 },
    goal: { c: 18, r: FLOOR_R - 1 },
    layers: { terrain: rle(terrain), platform: rle(platform), water: rle(water) },
    decor: [],
    entities: [],
  });
}

/**
 * @param {number} x
 * @param {number} y
 */
function stubPlayer(x, y) {
  return {
    hitbox: { x, y, w: 18, h: 26 },
    oldRect: { x, y, w: 18, h: 26 },
    vy: 0,
    bounced: 0,
    bounce() {
      this.bounced++;
      this.vy = -tuning.stompBounce;
    },
  };
}

/**
 * Park the player somewhere with no implied movement between frames.
 * @param {ReturnType<typeof stubPlayer>} player
 * @param {number} x
 * @param {number} y
 */
function park(player, x, y) {
  player.hitbox.x = x;
  player.hitbox.y = y;
  player.oldRect.x = x;
  player.oldRect.y = y;
  player.vy = 0;
}

/**
 * Drop the player onto something from above: last frame was clear of `top`.
 * @param {ReturnType<typeof stubPlayer>} player
 * @param {number} x
 * @param {number} top
 */
function falling(player, x, top) {
  player.hitbox.x = x;
  player.hitbox.y = top - player.hitbox.h + 4;
  player.oldRect.x = x;
  player.oldRect.y = top - player.oldRect.h - 2;
  player.vy = 100;
}

/**
 * @param {string} kind
 * @param {number} c
 * @param {number} r
 * @param {{ player?: ReturnType<typeof stubPlayer>, dir?: number }} [opts]
 */
function spawn(kind, c, r, opts = {}) {
  const entry = byId(kind);
  if (!entry || !entry.spawn) throw new Error(`no spawn for ${kind}`);

  const level = testLevel();
  const player = opts.player ?? stubPlayer(-500, 0);
  const stats = new Stats();
  /** @type {Array<{ clip: unknown, x: number, y: number }>} */
  const fx = [];

  const world = {
    atlas: mockAtlas(),
    level,
    player,
    stats,
    /**
     * @param {unknown} clip
     * @param {number} x
     * @param {number} y
     */
    spawnFx(clip, x, y) {
      fx.push({ clip, x, y });
    },
  };

  const rec = opts.dir === undefined ? { k: kind, c, r } : { k: kind, c, r, p: { dir: opts.dir } };
  const enemy = entry.spawn(world, rec);
  return { enemy, world, player, stats, level, entry, fx };
}

/**
 * @param {{ update: (dt: number) => void }} enemy
 * @param {number} seconds
 */
function run(enemy, seconds) {
  const steps = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < steps; i++) enemy.update(FIXED_DT);
}

describe('WalkerEnemy patrol', () => {
  it('takes its start direction from the level record', () => {
    expect(spawn('fierce_tooth', 8, FLOOR_R - 1, { dir: 1 }).enemy.dir).toBe(1);
    expect(spawn('fierce_tooth', 8, FLOOR_R - 1, { dir: -1 }).enemy.dir).toBe(-1);
  });

  it('defaults to -1 when p.dir is absent or junk', () => {
    expect(spawn('fierce_tooth', 8, FLOOR_R - 1).enemy.dir).toBe(-1);
    // @ts-expect-error deliberately malformed p, narrowed at the boundary
    expect(spawn('fierce_tooth', 8, FLOOR_R - 1, { dir: 'left' }).enemy.dir).toBe(-1);
  });

  it('stands on the floor of its cell rather than falling through it', () => {
    const { enemy } = spawn('crabby', 8, FLOOR_R - 1);
    run(enemy, 0.5);
    expect(enemy.hitbox.y + enemy.hitbox.h).toBeCloseTo(FLOOR_R * TILE, 1);
  });

  it('patrols at the entry speed', () => {
    const { enemy, entry } = spawn('fierce_tooth', 8, FLOOR_R - 1, { dir: -1 });
    const x0 = enemy.hitbox.x;
    run(enemy, 0.5);
    expect(x0 - enemy.hitbox.x).toBeCloseTo(entry.speed * 0.5, 0);
  });

  it('turns at a wall', () => {
    const { enemy } = spawn('fierce_tooth', 7, FLOOR_R - 1, { dir: -1 });
    run(enemy, 1.5);
    expect(enemy.dir).toBe(1);
    expect(enemy.hitbox.x).toBeGreaterThanOrEqual((WALL_C + 1) * TILE);
  });

  it('turns at a ledge instead of walking into the gap', () => {
    const { enemy } = spawn('fierce_tooth', 8, FLOOR_R - 1, { dir: 1 });
    run(enemy, 1.5);
    expect(enemy.dir).toBe(-1);
    expect(enemy.hitbox.x).toBeLessThan(GAP_C0 * TILE);
    expect(enemy.hitbox.y + enemy.hitbox.h).toBeCloseTo(FLOOR_R * TILE, 1);
  });

  it('rides a semi-solid platform and turns at both of its edges', () => {
    const { enemy } = spawn('fierce_tooth', 15, PLAT_R - 1, { dir: -1 });
    run(enemy, 6);
    expect(enemy.hitbox.y + enemy.hitbox.h).toBeCloseTo(PLAT_R * TILE, 1);
    expect(enemy.hitbox.x).toBeGreaterThanOrEqual(PLAT_C0 * TILE - 1);
    expect(enemy.hitbox.x + enemy.hitbox.w).toBeLessThanOrEqual((PLAT_C1 + 1) * TILE + 1);
  });

  it('despawns when it ends up below the world', () => {
    const { enemy, level } = spawn('fierce_tooth', 8, FLOOR_R - 1);
    enemy.hitbox.y = level.rows * TILE + 10;
    enemy.update(FIXED_DT);
    expect(enemy.alive).toBe(false);
  });
});

describe('WalkerEnemy contact', () => {
  it('costs one heart on side contact, then invulnerability swallows it', () => {
    const player = stubPlayer(-500, 0);
    const { enemy, stats } = spawn('fierce_tooth', 8, FLOOR_R - 1, { player });
    enemy.update(FIXED_DT);

    park(player, enemy.hitbox.x, enemy.hitbox.y);
    enemy.update(FIXED_DT);
    expect(stats.health).toBe(tuning.startHealth - 1);

    park(player, enemy.hitbox.x, enemy.hitbox.y);
    enemy.update(FIXED_DT);
    expect(stats.health).toBe(tuning.startHealth - 1);
  });

  it('dies to a stomp, bounces the player, and stops damaging', () => {
    const player = stubPlayer(-500, 0);
    const { enemy, stats } = spawn('fierce_tooth', 8, FLOOR_R - 1, { player });
    enemy.update(FIXED_DT);

    falling(player, enemy.hitbox.x, enemy.hitbox.y);
    enemy.update(FIXED_DT);

    expect(enemy.state).toBe('dying');
    expect(player.bounced).toBe(1);
    expect(stats.health).toBe(tuning.startHealth);
    expect(enemy.damages).toBe(false);
  });

  it('despawns once the death clip has played', () => {
    const player = stubPlayer(-500, 0);
    const { enemy } = spawn('fierce_tooth', 8, FLOOR_R - 1, { player });
    enemy.update(FIXED_DT);
    falling(player, enemy.hitbox.x, enemy.hitbox.y);
    enemy.update(FIXED_DT);

    expect(enemy.alive).toBe(true);
    run(enemy, 0.5);
    expect(enemy.alive).toBe(false);
  });

  it('cannot be stomped while un-stompable — it hurts and knocks clear instead', () => {
    const player = stubPlayer(-500, 0);
    const { enemy, stats } = spawn('fierce_tooth', 8, FLOOR_R - 1, { player });
    enemy.update(FIXED_DT);
    enemy.stompable = false;

    falling(player, enemy.hitbox.x, enemy.hitbox.y);
    enemy.update(FIXED_DT);

    expect(enemy.state).not.toBe('dying');
    expect(enemy.alive).toBe(true);
    expect(stats.health).toBe(tuning.startHealth - 1);
    expect(player.bounced).toBe(1);
  });
});

describe('Crabby — two-sided strike', () => {
  /**
   * @param {number} side -1 to stand to its left, 1 to its right
   */
  function standBeside(side) {
    const player = stubPlayer(-500, 0);
    const ctx = spawn('crabby', 8, FLOOR_R - 1, { player });
    ctx.enemy.update(FIXED_DT);
    const hb = ctx.enemy.hitbox;
    park(player, side < 0 ? hb.x - player.hitbox.w - 2 : hb.x + hb.w + 2, hb.y);
    return ctx;
  }

  it('triggers from the left', () => {
    const { enemy } = standBeside(-1);
    enemy.update(FIXED_DT);
    expect(enemy.state).toBe('anticipation');
  });

  it('triggers from the right too — it has no safe side', () => {
    const { enemy } = standBeside(1);
    enemy.update(FIXED_DT);
    expect(enemy.state).toBe('anticipation');
  });

  it('ignores a player out of range', () => {
    const player = stubPlayer(-500, 0);
    const { enemy, entry } = spawn('crabby', 8, FLOOR_R - 1, { player });
    enemy.update(FIXED_DT);
    park(player, enemy.hitbox.x + entry.senseRange + 60, enemy.hitbox.y);
    enemy.update(FIXED_DT);
    expect(enemy.state).toBe('patrol');
  });

  it('spawns the strike effect once, centred on the body', () => {
    const { enemy, fx } = standBeside(-1);
    run(enemy, 0.35);
    expect(enemy.state).toBe('attack');
    expect(fx).toHaveLength(1);
    const clip = /** @type {{ fw: number }} */ (fx[0].clip);
    expect(fx[0].x + clip.fw / 2).toBeCloseTo(enemy.hitbox.x + enemy.hitbox.w / 2, 1);
  });

  it('reaches further than its body during the active frames', () => {
    const { enemy, entry, stats, player } = standBeside(-1);
    run(enemy, 0.35);
    expect(enemy.state).toBe('attack');

    // Outside the body, inside the strike.
    const beyond = enemy.hitbox.x - player.hitbox.w - 20;
    expect(beyond + player.hitbox.w).toBeLessThan(enemy.hitbox.x);
    expect(beyond).toBeGreaterThan(
      enemy.hitbox.x + enemy.hitbox.w / 2 - (entry.strikeW ?? 0) / 2,
    );

    park(player, beyond, enemy.hitbox.y);
    enemy.update(FIXED_DT);
    expect(stats.health).toBe(tuning.startHealth - 1);
  });

  it('drops back to the body box once the claws are in', () => {
    const { enemy } = standBeside(-1);
    run(enemy, 0.35);
    expect(enemy.damageBox).toBe(enemy.strike);
    run(enemy, 0.25);
    expect(enemy.damageBox).toBe(enemy.hitbox);
  });
});

describe('Fierce Tooth — the lunge', () => {
  it('ignores a player behind it', () => {
    const player = stubPlayer(-500, 0);
    const { enemy } = spawn('fierce_tooth', 8, FLOOR_R - 1, { player, dir: 1 });
    enemy.update(FIXED_DT);
    park(player, enemy.hitbox.x - 40, enemy.hitbox.y);
    enemy.update(FIXED_DT);
    expect(enemy.state).toBe('patrol');
  });

  it('triggers on a player in front', () => {
    const player = stubPlayer(-500, 0);
    const { enemy } = spawn('fierce_tooth', 8, FLOOR_R - 1, { player, dir: 1 });
    enemy.update(FIXED_DT);
    park(player, enemy.hitbox.x + 40, enemy.hitbox.y);
    enemy.update(FIXED_DT);
    expect(enemy.state).toBe('anticipation');
  });

  it('covers more ground lunging than patrolling', () => {
    const player = stubPlayer(-500, 0);
    const { enemy } = spawn('fierce_tooth', 6, FLOOR_R - 1, { player, dir: 1 });
    enemy.update(FIXED_DT);
    park(player, enemy.hitbox.x + 40, enemy.hitbox.y);

    run(enemy, 0.35);
    expect(enemy.state).toBe('attack');
    const x0 = enemy.hitbox.x;
    run(enemy, 0.2);
    expect(enemy.hitbox.x - x0).toBeGreaterThan(30 * 0.2 * 2);
  });

  it('stops the lunge at a ledge rather than running off it', () => {
    const player = stubPlayer(-500, 0);
    const { enemy } = spawn('fierce_tooth', 9, FLOOR_R - 1, { player, dir: 1 });
    enemy.update(FIXED_DT);
    park(player, enemy.hitbox.x + 40, enemy.hitbox.y);

    run(enemy, 1);
    expect(enemy.alive).toBe(true);
    expect(enemy.hitbox.x).toBeLessThan(GAP_C0 * TILE);
    expect(enemy.hitbox.y + enemy.hitbox.h).toBeCloseTo(FLOOR_R * TILE, 1);
  });

  it('is stompable again while recovering', () => {
    const player = stubPlayer(-500, 0);
    const { enemy } = spawn('fierce_tooth', 6, FLOOR_R - 1, { player, dir: 1 });
    enemy.update(FIXED_DT);
    park(player, enemy.hitbox.x + 40, enemy.hitbox.y);

    run(enemy, 1);
    expect(enemy.state).toBe('recover');
    expect(enemy.stompable).toBe(true);
  });
});

describe('Pink Star — the spin block', () => {
  it('ignores a player approaching on the ground', () => {
    const player = stubPlayer(-500, 0);
    const { enemy } = spawn('pink_star', 8, FLOOR_R - 1, { player });
    enemy.update(FIXED_DT);
    park(player, enemy.hitbox.x - player.hitbox.w - 2, enemy.hitbox.y);
    enemy.update(FIXED_DT);
    expect(enemy.state).toBe('patrol');
  });

  it('spins up when the player is above it', () => {
    const player = stubPlayer(-500, 0);
    const { enemy } = spawn('pink_star', 8, FLOOR_R - 1, { player });
    enemy.update(FIXED_DT);
    park(player, enemy.hitbox.x, enemy.hitbox.y - player.hitbox.h - 20);
    enemy.update(FIXED_DT);
    expect(enemy.state).toBe('anticipation');
  });

  it('is un-stompable for the whole spin, and stompable again after', () => {
    const player = stubPlayer(-500, 0);
    const { enemy, entry, stats } = spawn('pink_star', 8, FLOOR_R - 1, { player });
    enemy.update(FIXED_DT);
    park(player, enemy.hitbox.x, enemy.hitbox.y - player.hitbox.h - 20);

    run(enemy, 0.35);
    expect(enemy.state).toBe('attack');
    expect(enemy.stompable).toBe(false);

    // A dive onto the spin is punished, not rewarded.
    falling(player, enemy.hitbox.x, enemy.hitbox.y);
    enemy.update(FIXED_DT);
    expect(enemy.alive).toBe(true);
    expect(stats.health).toBe(tuning.startHealth - 1);
    expect(player.bounced).toBe(1);

    park(player, -500, 0);
    run(enemy, (entry.spinTime ?? 0) + 0.1);
    expect(enemy.state).toBe('recover');
    expect(enemy.stompable).toBe(true);
  });

  it('spins for spinTime, not for the length of its clip', () => {
    const player = stubPlayer(-500, 0);
    const { enemy, entry } = spawn('pink_star', 8, FLOOR_R - 1, { player });
    enemy.update(FIXED_DT);
    park(player, enemy.hitbox.x, enemy.hitbox.y - player.hitbox.h - 20);

    run(enemy, 0.35);
    const clipLen = clipOf('star/attack').n / clipOf('star/attack').fps;
    expect(entry.spinTime).toBeGreaterThan(clipLen);

    park(player, -500, 0);
    run(enemy, clipLen + 0.05);
    expect(enemy.state).toBe('attack');
  });
});
