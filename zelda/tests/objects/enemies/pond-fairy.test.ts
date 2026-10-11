import { describe, expect, it } from 'vitest';
import { PondFairy, advanceFairyRefill } from '../../../src/objects/enemies/pond-fairy.js';
import { EnemyState, type EnemyUpdateContext } from '../../../src/objects/enemies/enemy.js';
import { Direction } from '../../../src/core/types.js';
import { Link } from '../../../src/objects/player/link.js';
import { checkEnemyLinkCollisions } from '../../../src/objects/enemies/enemy-collision.js';

const ctx = { linkX: 0, linkY: 0 } as EnemyUpdateContext;

describe('PondFairy', () => {
  it('is fixed at (120,64), active without a cloud, harmless and indestructible', () => {
    const f = new PondFairy();
    expect([f.x, f.y]).toEqual([120, 64]);
    expect(f.state).toBe(EnemyState.Active);
    expect(f.vulnerable).toBe(false);
    expect(f.touchesLink).toBe(false);
    expect(f.takeDamage(0xff, Direction.Up)).toBe(false);
    f.stun(); f.debugKill();
    for (let i = 0; i < 100; i++) f.update(ctx);
    expect(f.state).toBe(EnemyState.Active);
    expect([f.x, f.y]).toEqual([120, 64]);
    expect(checkEnemyLinkCollisions([f], f.getHitbox())).toBeNull();
  });
  it.each([112, 120, 128])('triggers at x=%i, y=112', (x) => {
    const f = new PondFairy();
    expect(f.tryTrigger(x, 112)).toBe(true);
    expect(f.haltsLink).toBe(true);
    expect(f.fillingHearts).toBe(true);
    expect(f.hearts).toHaveLength(1);
    expect([f.hearts[0]!.x, f.hearts[0]!.y]).toEqual([120, 36]);
  });
  it.each([[120, 111], [120, 113], [111, 112], [129, 112]])('does not trigger at (%i,%i)', (x, y) => {
    expect(new PondFairy().tryTrigger(x, y)).toBe(false);
  });
  it('appears sequentially, moves left first, and keeps eight hearts within the ring', () => {
    const f = new PondFairy();
    f.tryTrigger(120, 112);
    f.update(ctx);
    expect(f.hearts[0]!.x).toBe(116);
    expect(f.hearts[0]!.y).toBe(36);
    expect(f.hearts).toHaveLength(1);
    for (let i = 0; i < 79; i++) f.update(ctx);
    expect(f.hearts).toHaveLength(8);
    for (let i = 0; i < 256; i++) {
      f.update(ctx);
      for (const h of f.hearts) {
        expect(Math.abs(h.x - 120)).toBeLessThanOrEqual(60);
        expect(Math.abs(h.y - 90)).toBeLessThanOrEqual(60);
        expect(h.qSpeedFrac).toBe(0x20);
      }
    }
  });
  it('fills, holds for exactly $50 further frames, then releases without retriggering', () => {
    const f = new PondFairy();
    f.tryTrigger(120, 112);
    expect(f.tryTrigger(120, 112)).toBe(false);
    f.finishFilling();
    f.finishFilling(); // Idempotent: must not extend the tail.
    expect(f.phase).toBe(2);
    expect(f.fillingHearts).toBe(false);
    for (let i = 0; i < 79; i++) f.update(ctx);
    expect(f.haltsLink).toBe(true);
    expect(f.hearts.length).toBeGreaterThan(0);
    f.update(ctx);
    expect(f.phase).toBe(3);
    expect(f.haltsLink).toBe(false);
    expect(f.hearts).toHaveLength(0);
    expect(f.tryTrigger(120, 112)).toBe(false);
  });
  it('refills one half heart every 21–22 frames while the hearts keep moving', () => {
    const f = new PondFairy();
    const link = new Link();
    link.setHealth(4, 32);
    f.tryTrigger(120, 112);
    let fraction = 0, lastHeal = 0;
    for (let frame = 1; frame <= 600; frame++) {
      f.update(ctx);
      const r = advanceFairyRefill(fraction);
      fraction = r.fraction;
      if (r.halfHearts) {
        expect(frame - lastHeal).toBeGreaterThanOrEqual(21);
        expect(frame - lastHeal).toBeLessThanOrEqual(22);
        lastHeal = frame;
        link.heal(r.halfHearts);
      }
    }
    expect(link.health).toBe(link.maxHealth);
    expect(f.hearts).toHaveLength(8);
    expect(f.hearts[0]!.x).not.toBe(120);
  });
});
