import { describe, it, expect } from 'vitest';
import { Aquamentus, AQUAMENTUS } from '../../../src/objects/enemies/aquamentus.js';
import { type EnemyUpdateContext } from '../../../src/objects/enemies/enemy.js';
import { ProjectileType } from '../../../src/objects/player/shield.js';
import { EnemyProjectile } from '../../../src/objects/projectiles/enemy-projectile.js';
import { DamageTypeBit } from '../../../src/core/constants.js';
import { Direction } from '../../../src/core/types.js';

function mockCtx(linkX = 40, linkY = 80): EnemyUpdateContext {
  return {
    collision: {
      isRectWalkable: () => true,
      isPositionWalkable: () => true,
    } as unknown as import('../../../src/world/collision.js').TileCollisionMap,
    screen: { id: 0, tiles: Array(11).fill(Array(16).fill(0)) } as unknown as import('../../../src/data/overworld-types.js').OverworldScreen,
    linkX,
    linkY,
  };
}

// Advance past the spawn cloud so the boss is Active.
function activeBoss(hp = 0x60): Aquamentus {
  const boss = new Aquamentus(0, 0, AQUAMENTUS, hp, 1);
  boss.update(mockCtx()); // finish spawn
  return boss;
}

describe('Aquamentus', () => {
  it('pins itself to the NES boss position regardless of spawn slot', () => {
    const boss = new Aquamentus(10, 10, AQUAMENTUS, 0x60, 1);
    expect(boss.x).toBe(0xb0);          // 176
    expect(boss.y).toBe(0x80 - 0x40);   // 64
    expect(boss.objectType).toBe(AQUAMENTUS);
  });

  it('is immune to boomerang and fire, but not to sword', () => {
    const boss = activeBoss();
    expect(boss.isImmuneToDamageType(DamageTypeBit.Boomerang)).toBe(true);
    expect(boss.isImmuneToDamageType(DamageTypeBit.Fire)).toBe(true);
    expect(boss.isImmuneToDamageType(DamageTypeBit.Sword)).toBe(false);
    expect(boss.isImmuneToDamageType(DamageTypeBit.Arrow)).toBe(false);
    expect(boss.isImmuneToDamageType(DamageTypeBit.Bomb)).toBe(false);
  });

  it('wobbles horizontally within limits and never moves vertically', () => {
    const boss = activeBoss();
    const ctx = mockCtx();
    const startY = boss.y;
    // The NES clamp is reactive (it fires the frame AFTER a limit is crossed),
    // so the boss transiently overshoots each limit by 1px before snapping back.
    for (let i = 0; i < 3000; i++) {
      boss.update(ctx);
      expect(boss.x).toBeGreaterThanOrEqual(0x87); // 135 (136 limit − 1 overshoot)
      expect(boss.x).toBeLessThanOrEqual(0xc8);     // 200 (199 limit + 1 overshoot)
      expect(boss.y).toBe(startY);
    }
  });

  it('is not stunnable (boss)', () => {
    const boss = activeBoss();
    boss.stun();
    expect(boss.isStunned).toBe(false);
  });

  it('fires a 3-way fireball fan travelling Left', () => {
    const boss = activeBoss();
    const ctx = mockCtx();
    let shots: EnemyProjectile[] = [];
    for (let i = 0; i < 400 && shots.length === 0; i++) {
      boss.update(ctx);
      shots = boss.consumeProjectiles();
    }
    expect(shots.length).toBe(3);
    for (const s of shots) {
      expect(s.type).toBe(ProjectileType.Fireball);
      expect(s.direction).toBe(Direction.Left);
    }
  });

  it('spreads the fan vertically as it flies (one up, one level, one down)', () => {
    const boss = activeBoss();
    const ctx = mockCtx();
    let shots: EnemyProjectile[] = [];
    for (let i = 0; i < 400 && shots.length === 0; i++) {
      boss.update(ctx);
      shots = boss.consumeProjectiles();
    }
    expect(shots.length).toBe(3);
    const startY = shots.map(s => s.y);
    for (let i = 0; i < 20; i++) shots.forEach(s => s.update());
    const endY = shots.map(s => s.y);
    // All start at the same Y; after flight one drifted up, one down, one level.
    const deltas = endY.map((y, i) => y - startY[i]!);
    expect(deltas.some(d => d > 0)).toBe(true);  // lower fireball
    expect(deltas.some(d => d < 0)).toBe(true);  // upper fireball
    expect(deltas.some(d => d === 0)).toBe(true); // middle fireball
    // All still moved left in X.
    for (const s of shots) expect(s.x).toBeLessThan(0xb0);
  });

  it('has a full-body hitbox (24×32)', () => {
    const boss = activeBoss();
    const hb = boss.getHitbox();
    expect(hb.width).toBe(24);
    expect(hb.height).toBe(32);
  });
});
