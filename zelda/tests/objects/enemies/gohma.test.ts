import { describe, it, expect } from 'vitest';
import { Gohma, GOHMA_BLUE, GOHMA_RED } from '../../../src/objects/enemies/gohma.js';
import { type EnemyUpdateContext } from '../../../src/objects/enemies/enemy.js';
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

function activeBoss(type = GOHMA_BLUE, hp = 0x60): Gohma {
  const boss = new Gohma(0, 0, type, hp, 1);
  boss.update(mockCtx());
  return boss;
}

function forceEyeState(boss: Gohma, targetState: number, ctx: EnemyUpdateContext): void {
  for (let i = 0; i < 2000; i++) {
    if (boss.eyeState === targetState) return;
    boss.update(ctx);
  }
}

describe('Gohma', () => {
  it('spawns at fixed NES position regardless of constructor x/y', () => {
    const boss = new Gohma(10, 10, GOHMA_BLUE, 0x60, 1);
    expect(boss.x).toBe(0x80);
    expect(boss.y).toBe(0x30);
  });

  it('is immune to boomerang, bomb, fire, sword — only arrows pass mask', () => {
    const boss = activeBoss();
    expect(boss.isImmuneToDamageType(DamageTypeBit.Boomerang)).toBe(true);
    expect(boss.isImmuneToDamageType(DamageTypeBit.Bomb)).toBe(true);
    expect(boss.isImmuneToDamageType(DamageTypeBit.Fire)).toBe(true);
    expect(boss.isImmuneToDamageType(DamageTypeBit.Sword)).toBe(true);
    expect(boss.isImmuneToDamageType(DamageTypeBit.Arrow)).toBe(false);
  });

  it('is not stunnable (boss)', () => {
    const boss = activeBoss();
    boss.stun();
    expect(boss.isStunned).toBe(false);
  });

  it('has a wide hitbox (40×16)', () => {
    const boss = activeBoss();
    const hb = boss.getHitbox();
    expect(hb.width).toBe(40);
    expect(hb.height).toBe(16);
  });

  it('rejects damage without hitContext', () => {
    const boss = activeBoss(GOHMA_BLUE, 0x10);
    const ctx = mockCtx();
    forceEyeState(boss, 3, ctx);
    const killed = boss.takeDamage(0x10, Direction.Up);
    expect(killed).toBe(false);
  });

  it('rejects arrow from wrong direction (not Up)', () => {
    const boss = activeBoss(GOHMA_BLUE, 0x10);
    const ctx = mockCtx();
    forceEyeState(boss, 3, ctx);
    const hitCtx = { x: boss.x + 2, y: boss.y + 20, dir: Direction.Left };
    const killed = boss.takeDamage(0x10, Direction.Left, hitCtx);
    expect(killed).toBe(false);
  });

  it('rejects arrow when eye is not half-open', () => {
    const boss = activeBoss(GOHMA_BLUE, 0x10);
    // Eye starts closed (state 0 or 1)
    expect(boss.eyeState).toBeLessThan(2);
    const hitCtx = { x: boss.x + 2, y: boss.y + 20, dir: Direction.Up };
    const killed = boss.takeDamage(0x10, Direction.Up, hitCtx);
    expect(killed).toBe(false);
  });

  it('accepts arrow Up to center when eye is half-open', () => {
    const boss = activeBoss(GOHMA_BLUE, 0x10);
    const ctx = mockCtx();
    forceEyeState(boss, 3, ctx);
    expect(boss.eyeState).toBe(3);
    const hitCtx = { x: boss.x + 2, y: boss.y + 20, dir: Direction.Up };
    const killed = boss.takeDamage(0x10, Direction.Up, hitCtx);
    expect(killed).toBe(true);
  });

  it('rejects arrow that misses the center parts', () => {
    const boss = activeBoss(GOHMA_BLUE, 0x10);
    const ctx = mockCtx();
    forceEyeState(boss, 3, ctx);
    const hitCtx = { x: boss.x - 20, y: boss.y + 20, dir: Direction.Up };
    const killed = boss.takeDamage(0x10, Direction.Up, hitCtx);
    expect(killed).toBe(false);
  });

  it('fires fireballs periodically', () => {
    const boss = activeBoss();
    const ctx = mockCtx();
    let foundProjectile = false;
    for (let i = 0; i < 200; i++) {
      boss.update(ctx);
      const proj = boss.consumeProjectile();
      if (proj) {
        foundProjectile = true;
        break;
      }
    }
    expect(foundProjectile).toBe(true);
  });

  it('eye cycles through all 4 states over time', () => {
    const boss = activeBoss();
    const ctx = mockCtx();
    const seenStates = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      boss.update(ctx);
      seenStates.add(boss.eyeState);
      if (seenStates.size === 4) break;
    }
    expect(seenStates.size).toBe(4);
  });

  it('blue and red Gohma differ only in objectType', () => {
    const blue = activeBoss(GOHMA_BLUE, 0x60);
    const red = activeBoss(GOHMA_RED, 0x60);
    expect(blue.objectType).toBe(GOHMA_BLUE);
    expect(red.objectType).toBe(GOHMA_RED);
    expect(blue.getHitbox().width).toBe(red.getHitbox().width);
  });
});
