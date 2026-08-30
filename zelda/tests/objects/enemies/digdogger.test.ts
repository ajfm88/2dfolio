import { describe, it, expect } from 'vitest';
import { Digdogger, LittleDigdogger, DIGDOGGER1, DIGDOGGER2, LITTLE_DIGDOGGER } from '../../../src/objects/enemies/digdogger.js';
import { type EnemyUpdateContext } from '../../../src/objects/enemies/enemy.js';
import { Direction } from '../../../src/core/types.js';

function mockCtx(overrides: Partial<EnemyUpdateContext> = {}): EnemyUpdateContext {
  return {
    collision: {
      isRectWalkable: () => true,
      isPositionWalkable: () => true,
    } as unknown as import('../../../src/world/collision.js').TileCollisionMap,
    screen: { id: 0, tiles: Array(11).fill(Array(16).fill(0)) } as unknown as import('../../../src/data/overworld-types.js').OverworldScreen,
    linkX: 40,
    linkY: 80,
    ...overrides,
  };
}

function activeBoss(type = DIGDOGGER1, hp = 0x60): Digdogger {
  const boss = new Digdogger(80, 60, type, hp, 1);
  boss.update(mockCtx());
  return boss;
}

describe('Digdogger', () => {
  it('is invulnerable (weapons cannot damage)', () => {
    const boss = activeBoss();
    expect(boss.vulnerable).toBe(false);
  });

  it('is not stunnable', () => {
    const boss = activeBoss();
    boss.stun();
    expect(boss.isStunned).toBe(false);
  });

  it('has a 32×32 hitbox', () => {
    const boss = activeBoss();
    const hb = boss.getHitbox();
    expect(hb.width).toBe(32);
    expect(hb.height).toBe(32);
  });

  it('moves over time', () => {
    const boss = activeBoss();
    const ctx = mockCtx();
    const startX = boss.x;
    const startY = boss.y;
    let moved = false;
    for (let i = 0; i < 200; i++) {
      boss.update(ctx);
      if (boss.x !== startX || boss.y !== startY) {
        moved = true;
        break;
      }
    }
    expect(moved).toBe(true);
  });

  it('flute triggers flickering', () => {
    const boss = activeBoss();
    expect(boss.isFlickering).toBe(false);
    boss.update(mockCtx({ fluteActive: true }));
    expect(boss.isFlickering).toBe(true);
  });

  it('Digdogger1 ($38) spawns 3 children after flute', () => {
    const boss = activeBoss(DIGDOGGER1);
    expect(boss.childCount).toBe(3);
    boss.update(mockCtx({ fluteActive: true }));
    const ctx = mockCtx();
    for (let i = 0; i < 100; i++) {
      boss.update(ctx);
      if (boss.isDead) break;
    }
    expect(boss.isDead).toBe(true);
    const spawns = boss.collectChildSpawns();
    expect(spawns.length).toBe(3);
    for (const s of spawns) {
      expect(s.objectType).toBe(LITTLE_DIGDOGGER);
    }
  });

  it('Digdogger2 ($39) spawns 1 child after flute', () => {
    const boss = activeBoss(DIGDOGGER2);
    expect(boss.childCount).toBe(1);
    boss.update(mockCtx({ fluteActive: true }));
    const ctx = mockCtx();
    for (let i = 0; i < 100; i++) {
      boss.update(ctx);
      if (boss.isDead) break;
    }
    expect(boss.isDead).toBe(true);
    const spawns = boss.collectChildSpawns();
    expect(spawns.length).toBe(1);
    expect(spawns[0]!.objectType).toBe(LITTLE_DIGDOGGER);
  });
});

describe('LittleDigdogger', () => {
  it('is vulnerable (can be damaged)', () => {
    const child = new LittleDigdogger(80, 60, LITTLE_DIGDOGGER, 0x10, 1);
    child.update(mockCtx());
    expect(child.vulnerable).toBe(true);
  });

  it('has a 16×16 hitbox', () => {
    const child = new LittleDigdogger(80, 60, LITTLE_DIGDOGGER, 0x10, 1);
    child.update(mockCtx());
    const hb = child.getHitbox();
    expect(hb.width).toBe(16);
    expect(hb.height).toBe(16);
  });

  it('can be killed by sword damage', () => {
    const child = new LittleDigdogger(80, 60, LITTLE_DIGDOGGER, 0x10, 1);
    child.update(mockCtx());
    const killed = child.takeDamage(0x20, Direction.Right);
    expect(killed).toBe(true);
  });

  it('moves faster than the parent', () => {
    const parent = activeBoss();
    const child = new LittleDigdogger(80, 60, LITTLE_DIGDOGGER, 0x10, 1);
    child.update(mockCtx());

    const ctx = mockCtx();
    let parentDist = 0;
    let childDist = 0;
    const pStartX = parent.x;
    const pStartY = parent.y;
    const cStartX = child.x;
    const cStartY = child.y;

    for (let i = 0; i < 200; i++) {
      parent.update(ctx);
      child.update(ctx);
    }
    parentDist = Math.abs(parent.x - pStartX) + Math.abs(parent.y - pStartY);
    childDist = Math.abs(child.x - cStartX) + Math.abs(child.y - cStartY);
    expect(childDist).toBeGreaterThan(parentDist);
  });
});
