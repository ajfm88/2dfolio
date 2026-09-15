import { describe, it, expect } from 'vitest';
import { Stats } from './stats.js';
import { tuning } from '../data/tuning.js';

describe('Stats', () => {
  it('starts at 0 coins, startHealth hearts, no invuln', () => {
    const stats = new Stats();
    expect(stats.coins).toBe(0);
    expect(stats.health).toBe(tuning.startHealth);
    expect(stats.invuln).toBe(0);
    expect(stats.dead).toBe(false);
  });

  it('coins += 1 sticks', () => {
    const stats = new Stats();
    stats.coins += 1;
    expect(stats.coins).toBe(1);
    expect(stats.health).toBe(tuning.startHealth);
  });

  it('coins += 100 wraps to 0 and grants a heart', () => {
    const stats = new Stats();
    stats.coins += 100;
    expect(stats.coins).toBe(0);
    expect(stats.health).toBe(tuning.startHealth + 1);
  });

  it('coins += 250 from 0 wraps twice', () => {
    const stats = new Stats();
    stats.coins += 250;
    expect(stats.coins).toBe(50);
    expect(stats.health).toBe(tuning.startHealth + 2);
  });

  it('health += 1 has no max', () => {
    const stats = new Stats();
    stats.health += 1;
    expect(stats.health).toBe(tuning.startHealth + 1);
    stats.health += 10;
    expect(stats.health).toBe(tuning.startHealth + 11);
  });

  it('health setter clamps below 0', () => {
    const stats = new Stats();
    stats.health = -3;
    expect(stats.health).toBe(0);
    expect(stats.dead).toBe(true);
  });

  it('hurt decrements health and starts invuln', () => {
    const stats = new Stats();
    expect(stats.hurt(1)).toBe(true);
    expect(stats.health).toBe(tuning.startHealth - 1);
    expect(stats.invuln).toBe(tuning.hitInvuln);
  });

  it('hurt while invuln is a no-op', () => {
    const stats = new Stats();
    stats.hurt(1);
    expect(stats.hurt(1)).toBe(false);
    expect(stats.health).toBe(tuning.startHealth - 1);
  });

  it('tick reduces invuln; hurt works again at 0', () => {
    const stats = new Stats();
    stats.hurt(1);
    stats.tick(tuning.hitInvuln);
    expect(stats.invuln).toBe(0);
    expect(stats.hurt(1)).toBe(true);
    expect(stats.health).toBe(tuning.startHealth - 2);
  });

  it('killing hurt does not start invuln', () => {
    const stats = new Stats();
    stats.health = 1;
    expect(stats.hurt(1)).toBe(true);
    expect(stats.health).toBe(0);
    expect(stats.dead).toBe(true);
    expect(stats.invuln).toBe(0);
  });

  it('hurt when dead returns false', () => {
    const stats = new Stats();
    stats.health = 0;
    expect(stats.hurt(1)).toBe(false);
    expect(stats.health).toBe(0);
  });
});
