import { describe, it, expect } from 'vitest';
import { TILE } from '../settings.js';
import { getTheme } from '../data/themes.js';
import { createPlayFixture } from '../data/fixtures/play-demo.js';
import { createWorld } from './world.js';
import { tuning } from '../data/tuning.js';

function mockAtlas() {
  return {
    /**
     * @param {string} _id
     */
    get(_id) {
      return { image: {}, fw: 32, fh: 32, n: 4, fps: 10 };
    },
  };
}

function idleKeys() {
  const btn = () => ({ held: false, pressed: false, released: false });
  return {
    left: btn(),
    right: btn(),
    up: btn(),
    down: btn(),
    jump: btn(),
  };
}

/**
 * @param {import('./player.js').Player} player
 * @param {number} x
 * @param {number} y
 */
function place(player, x, y) {
  player.hitbox.x = x;
  player.hitbox.y = y;
  player.oldRect.x = x;
  player.oldRect.y = y;
  player.vx = 0;
  player.vy = 0;
}

function makeWorld() {
  const level = createPlayFixture();
  return createWorld(level, getTheme(level.theme), mockAtlas(), idleKeys());
}

describe('createWorld collectibles and hazards', () => {
  it('starts a run at full health and zero coins', () => {
    const world = makeWorld();
    expect(world.stats.health).toBe(tuning.startHealth);
    expect(world.stats.coins).toBe(0);
    expect(world.stats.dead).toBe(false);
  });

  it('collects a gold coin and awards coinGold', () => {
    const world = makeWorld();
    // coin_gold at (5, 12), sprite centred/bottom-aligned in the cell
    place(world.player, 5 * TILE + 8, 12 * TILE + 6);
    world.update(1 / 60, 0, 640);
    expect(world.stats.coins).toBe(tuning.coinGold);
  });

  it('spikes hurt once then ignore contact during invuln', () => {
    const world = makeWorld();
    // spikes at (12, 12), hitbox bottom 16 px of the cell
    place(world.player, 12 * TILE + 7, 13 * TILE - 26);
    const first = world.update(1 / 60, 0, 640);
    expect(first).toBe('playing');
    expect(world.stats.health).toBe(tuning.startHealth - 1);
    expect(world.stats.invuln).toBeGreaterThan(0);

    place(world.player, 12 * TILE + 7, 13 * TILE - 26);
    world.update(1 / 60, 0, 640);
    expect(world.stats.health).toBe(tuning.startHealth - 1);
  });

  it('potion restores a heart after spike damage', () => {
    const world = makeWorld();
    place(world.player, 12 * TILE + 7, 13 * TILE - 26);
    world.update(1 / 60, 0, 640);
    expect(world.stats.health).toBe(tuning.startHealth - 1);

    world.stats.invuln = 0;
    // potion_red at (14, 12)
    place(world.player, 14 * TILE + 8, 12 * TILE + 6);
    world.update(1 / 60, 0, 640);
    expect(world.stats.health).toBe(tuning.startHealth);
  });

  it('health 0 returns dead', () => {
    const world = makeWorld();
    world.stats.health = 1;
    place(world.player, 12 * TILE + 7, 13 * TILE - 26);
    expect(world.update(1 / 60, 0, 640)).toBe('dead');
    expect(world.stats.dead).toBe(true);
  });

  it('unknown entity kinds are skipped', () => {
    const level = createPlayFixture();
    level.entities.push({ k: 'not_a_real_kind', c: 6, r: 12 });
    const world = createWorld(level, getTheme(level.theme), mockAtlas(), idleKeys());
    expect(() => world.update(1 / 60, 0, 640)).not.toThrow();
    expect(world.stats.coins).toBe(0);
  });
});
