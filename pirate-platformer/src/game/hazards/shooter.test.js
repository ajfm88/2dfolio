import { describe, it, expect } from 'vitest';

import { TILE, FIXED_DT } from '../../settings.js';
import { deserialise } from '../../level/codec.js';
import { tuning } from '../../data/tuning.js';
import { byId } from '../../data/palette.js';
import atlasJson from '../../data/atlas.json';

import { Stats } from '../stats.js';
import { Projectile } from './projectile.js';

const COLS = 40;
const ROWS = 12;
const FLOOR_R = 10;
// Terrain block at col 5, rows 5-6 (y 160-224) — a leftward shot at y≈200 hits it.
const BLOCK_C = 5;
const BLOCK_R0 = 5;
const BLOCK_R1 = 6;

/**
 * Real frame counts, so the fire clip actually lasts six frames and frame 3 is a
 * real frame. A flat mock would silently test the wrong fire cadence. The `id`
 * lets a test assert which fx clip a death spawned.
 * @param {string} id
 */
function clipOf(id) {
  const c = atlasJson[/** @type {keyof typeof atlasJson} */ (id)];
  return { id, image: {}, fw: c.fw, fh: c.fh, n: c.n, fps: c.fps };
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

function testLevel() {
  const terrain = new Uint8Array(COLS * ROWS);
  const platform = new Uint8Array(COLS * ROWS);
  const water = new Uint8Array(COLS * ROWS);

  for (let c = 0; c < COLS; c++) terrain[FLOOR_R * COLS + c] = 1;
  for (let r = BLOCK_R0; r <= BLOCK_R1; r++) terrain[r * COLS + BLOCK_C] = 1;

  return deserialise({
    format: 1,
    id: 'lvl_shootertest',
    name: 'Shooter Test',
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
  return { hitbox: { x, y, w: 18, h: 26 } };
}

/**
 * @param {import('../../level/model.js').LevelModel} level
 * @param {ReturnType<typeof stubPlayer>} player
 */
function makeWorld(level, player) {
  const stats = new Stats();
  /** @type {Array<{ clip: { id: string }, x: number, y: number }>} */
  const fx = [];
  /** @type {Array<import('./projectile.js').Projectile>} */
  const spawned = [];
  const world = {
    atlas: mockAtlas(),
    level,
    player,
    stats,
    /**
     * @param {import('./projectile.js').Projectile} ent
     */
    spawnEntity(ent) {
      spawned.push(ent);
    },
    /**
     * @param {{ id: string }} clip
     * @param {number} x
     * @param {number} y
     */
    spawnFx(clip, x, y) {
      fx.push({ clip, x, y });
    },
  };
  return { world, stats, fx, spawned };
}

/**
 * @param {string} kind
 * @param {number} c
 * @param {number} r
 * @param {{ player?: ReturnType<typeof stubPlayer>, dir?: number }} [opts]
 */
function spawnShooter(kind, c, r, opts = {}) {
  const entry = byId(kind);
  if (!entry || !entry.spawn) throw new Error(`no spawn for ${kind}`);

  const level = testLevel();
  const player = opts.player ?? stubPlayer(-500, 0);
  const { world, stats, fx, spawned } = makeWorld(level, player);

  const rec = opts.dir === undefined ? { k: kind, c, r } : { k: kind, c, r, p: { dir: opts.dir } };
  const shooter = /** @type {import('./shooter.js').Shooter} */ (entry.spawn(world, rec));
  return { shooter, world, player, stats, fx, spawned, entry, level };
}

/**
 * Place the player's centre at the shooter's centre plus (dx, dy).
 * @param {ReturnType<typeof stubPlayer>} player
 * @param {{ hitbox: { x: number, y: number, w: number, h: number } }} shooter
 * @param {number} dx
 * @param {number} dy
 */
function parkPlayer(player, shooter, dx, dy) {
  const cx = shooter.hitbox.x + shooter.hitbox.w / 2;
  const cy = shooter.hitbox.y + shooter.hitbox.h / 2;
  player.hitbox.x = cx + dx - player.hitbox.w / 2;
  player.hitbox.y = cy + dy - player.hitbox.h / 2;
}

/**
 * @param {{ update: (dt: number) => void }} obj
 * @param {number} seconds
 */
function run(obj, seconds) {
  const steps = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < steps; i++) obj.update(FIXED_DT);
}

const SHOOTER_C = 20;
const SHOOTER_R = FLOOR_R - 1;

describe('Shooter — trigger', () => {
  it('does not fire when the player is behind it', () => {
    const { shooter, player, spawned } = spawnShooter('cannon', SHOOTER_C, SHOOTER_R, { dir: -1 });
    parkPlayer(player, shooter, 100, 0); // to the right of a left-facing cannon
    run(shooter, 0.7);
    expect(shooter.state).toBe('idle');
    expect(spawned.length).toBe(0);
  });

  it('does not fire when the player is out of range', () => {
    const { shooter, player, spawned } = spawnShooter('cannon', SHOOTER_C, SHOOTER_R, { dir: -1 });
    parkPlayer(player, shooter, -300, 0); // beyond the 208 px range
    run(shooter, 0.7);
    expect(spawned.length).toBe(0);
  });

  it('does not fire when the player is above the height band', () => {
    const { shooter, player, spawned } = spawnShooter('cannon', SHOOTER_C, SHOOTER_R, { dir: -1 });
    parkPlayer(player, shooter, -40, -60); // in front and near, but 60 px up
    run(shooter, 0.7);
    expect(spawned.length).toBe(0);
  });

  it('fires when the player is near, in front and level', () => {
    const { shooter, player, spawned } = spawnShooter('cannon', SHOOTER_C, SHOOTER_R, { dir: -1 });
    parkPlayer(player, shooter, -100, 0);
    run(shooter, 0.7);
    expect(spawned.length).toBe(1);
  });
});

describe('Shooter — fire cadence', () => {
  it('fires exactly one projectile per cycle (the hasFired guard)', () => {
    const { shooter, player, spawned } = spawnShooter('cannon', SHOOTER_C, SHOOTER_R, { dir: -1 });
    parkPlayer(player, shooter, -100, 0);
    // Step the whole 6-frame fire clip: frame 3 spans six ticks, so an unguarded
    // check would spawn six here.
    run(shooter, 0.7);
    expect(spawned.length).toBe(1);
  });

  it('fires on the fire frame, not on entry to the fire state', () => {
    const { shooter, player, spawned } = spawnShooter('cannon', SHOOTER_C, SHOOTER_R, { dir: -1 });
    parkPlayer(player, shooter, -100, 0);
    shooter.update(FIXED_DT); // enters fire this tick
    expect(shooter.state).toBe('fire');
    expect(spawned.length).toBe(0);
    run(shooter, 0.5); // now step past frame 3
    expect(spawned.length).toBe(1);
  });

  it('does not fire again until the cooldown elapses', () => {
    const { shooter, player, spawned } = spawnShooter('cannon', SHOOTER_C, SHOOTER_R, { dir: -1 });
    parkPlayer(player, shooter, -100, 0);
    run(shooter, 0.7); // one full cycle → cooldown = 3 s
    expect(spawned.length).toBe(1);
    run(shooter, 2); // still cooling down
    expect(spawned.length).toBe(1);
    run(shooter, 1.5); // cooldown elapsed → fires again
    expect(spawned.length).toBe(2);
  });
});

describe('Shooter — muzzle', () => {
  it('launches from the muzzle on the left when facing left', () => {
    const { shooter, player, spawned, entry } = spawnShooter('cannon', SHOOTER_C, SHOOTER_R, {
      dir: -1,
    });
    parkPlayer(player, shooter, -100, 0);
    run(shooter, 0.7);
    const proj = spawned[0];
    const cx = proj.hitbox.x + proj.hitbox.w / 2;
    const cy = proj.hitbox.y + proj.hitbox.h / 2;
    expect(cx).toBeCloseTo(shooter.hitbox.x + (entry.muzzleX ?? 0), 1);
    expect(cy).toBeCloseTo(shooter.hitbox.y + (entry.muzzleY ?? 0), 1);
    expect(proj.dir).toBe(-1);
  });

  it('mirrors the muzzle to the right when facing right', () => {
    const { shooter, player, spawned, entry } = spawnShooter('cannon', SHOOTER_C, SHOOTER_R, {
      dir: 1,
    });
    parkPlayer(player, shooter, 100, 0); // in front of a right-facing cannon
    run(shooter, 0.7);
    const proj = spawned[0];
    const cx = proj.hitbox.x + proj.hitbox.w / 2;
    expect(cx).toBeCloseTo(shooter.hitbox.x + shooter.hitbox.w - (entry.muzzleX ?? 0), 1);
    expect(proj.dir).toBe(1);
  });

  it('the seashell muzzle sits 25 px from its hitbox centre', () => {
    const { shooter, player, spawned } = spawnShooter('seashell', SHOOTER_C, SHOOTER_R, {
      dir: -1,
    });
    parkPlayer(player, shooter, -80, 0);
    run(shooter, 0.7);
    const proj = spawned[0];
    const cx = proj.hitbox.x + proj.hitbox.w / 2;
    const shooterCx = shooter.hitbox.x + shooter.hitbox.w / 2;
    expect(shooterCx - cx).toBeCloseTo(25, 1);
  });
});

describe('Shooter — body is harmless', () => {
  it('costs nothing to stand against the body while it fires', () => {
    const player = stubPlayer(0, 0);
    const { shooter, stats, spawned } = spawnShooter('cannon', SHOOTER_C, SHOOTER_R, {
      player,
      dir: -1,
    });
    parkPlayer(player, shooter, -5, 0); // pressed against, still in front
    run(shooter, 1);
    expect(spawned.length).toBeGreaterThan(0); // it did fire past us
    expect(stats.health).toBe(tuning.startHealth); // the body itself never hurt
  });
});

describe('Projectile', () => {
  const cannonSpec = /** @type {import('./projectile.js').ProjectileSpec} */ (
    byId('cannon')?.projectile
  );

  it('travels at dir × speed', () => {
    const { world } = makeWorld(testLevel(), stubPlayer(-500, 0));
    const proj = new Projectile(world, 500, 200, -1, cannonSpec);
    const x0 = proj.hitbox.x;
    proj.update(FIXED_DT);
    expect(x0 - proj.hitbox.x).toBeCloseTo(cannonSpec.speed * FIXED_DT, 3);
  });

  it('dies on terrain and spawns the hit fx', () => {
    const { world, fx } = makeWorld(testLevel(), stubPlayer(-500, 0));
    const proj = new Projectile(world, 300, 200, -1, cannonSpec);
    run(proj, 2);
    expect(proj.alive).toBe(false);
    expect(fx.length).toBe(1);
    expect(fx[0].clip.id).toBe('cannon/ball-explode');
  });

  it('dies on lifetime and spawns the end fx — a different clip', () => {
    const { world, fx } = makeWorld(testLevel(), stubPlayer(-500, 0));
    const proj = new Projectile(world, 700, 200, -1, cannonSpec);
    run(proj, 3.2);
    expect(proj.alive).toBe(false);
    expect(fx.length).toBe(1);
    expect(fx[0].clip.id).toBe('cannon/ball-dead');
  });

  it('dies at the level edge', () => {
    const { world, fx } = makeWorld(testLevel(), stubPlayer(-500, 0));
    const proj = new Projectile(world, 20, 200, -1, cannonSpec);
    run(proj, 0.5);
    expect(proj.alive).toBe(false);
    expect(fx[0].clip.id).toBe('cannon/ball-dead');
  });

  it('hurts the player once, then invulnerability swallows the next', () => {
    const player = stubPlayer(500, 195);
    const { world, stats } = makeWorld(testLevel(), player);

    const proj = new Projectile(world, 505, 200, -1, cannonSpec);
    proj.update(FIXED_DT);
    expect(stats.health).toBe(tuning.startHealth - 1);
    expect(proj.alive).toBe(false);

    const proj2 = new Projectile(world, 505, 200, -1, cannonSpec);
    proj2.update(FIXED_DT);
    expect(stats.health).toBe(tuning.startHealth - 1);
    expect(proj2.alive).toBe(false);
  });
});

describe('Shooter — no cross-leak between worlds', () => {
  it('two shooters on two handles never see each other’s projectiles', () => {
    const a = spawnShooter('cannon', SHOOTER_C, SHOOTER_R, { dir: -1 });
    const b = spawnShooter('cannon', SHOOTER_C, SHOOTER_R, { dir: -1 });
    parkPlayer(a.player, a.shooter, -100, 0);
    parkPlayer(b.player, b.shooter, -100, 0);
    run(a.shooter, 0.7);
    run(b.shooter, 0.7);
    expect(a.spawned.length).toBe(1);
    expect(b.spawned.length).toBe(1);
    expect(a.spawned[0]).not.toBe(b.spawned[0]);
  });
});
