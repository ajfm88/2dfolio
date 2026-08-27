import { describe, it, expect } from 'vitest';
import { type EnemyUpdateContext, EnemyState } from '../../../src/objects/enemies/enemy.js';
import { createStalfos } from '../../../src/objects/enemies/stalfos.js';
import { Rope } from '../../../src/objects/enemies/rope.js';
import { Goriya } from '../../../src/objects/enemies/goriya.js';
import { Zol } from '../../../src/objects/enemies/zol.js';
import { Gel } from '../../../src/objects/enemies/gel.js';
import { Keese } from '../../../src/objects/enemies/keese.js';
import { WalkerEnemy } from '../../../src/objects/enemies/walker-enemy.js';
import { Direction } from '../../../src/core/types.js';

function mockCtx(linkX = 120, linkY = 80, walkable = true): EnemyUpdateContext {
  return {
    collision: {
      isRectWalkable: () => walkable,
      isPositionWalkable: () => walkable,
    } as unknown as import('../../../src/world/collision.js').TileCollisionMap,
    screen: { id: 0, tiles: Array(11).fill(Array(16).fill(0)) } as unknown as import('../../../src/data/overworld-types.js').OverworldScreen,
    linkX,
    linkY,
  };
}

// Advance an enemy past its spawn cloud into Active.
function finishSpawn(e: { update: (c: EnemyUpdateContext) => void }, ctx: EnemyUpdateContext): void {
  for (let i = 0; i < 8; i++) e.update(ctx);
}

describe('Stalfos', () => {
  it('is a WalkerEnemy with no projectile', () => {
    const s = createStalfos(80, 80, 0x2a, 0x20, 1);
    expect(s).toBeInstanceOf(WalkerEnemy);
    expect(s.objectType).toBe(0x2a);
  });

  it('wanders after spawning', () => {
    const s = createStalfos(80, 80, 0x2a, 0x20, 1);
    const ctx = mockCtx();
    finishSpawn(s, ctx);
    const sx = s.x, sy = s.y;
    for (let i = 0; i < 40; i++) s.update(ctx);
    expect(s.x !== sx || s.y !== sy).toBe(true);
  });
});

describe('Rope', () => {
  it('rushes horizontally when aligned with Link on the Y axis', () => {
    // Rope at (40,80); Link far to the right on the same row → should rush right.
    const rope = new Rope(40, 80, 0x28, 0x10, 1);
    const ctx = mockCtx(200, 80);
    finishSpawn(rope, ctx);
    const startX = rope.x;
    for (let i = 0; i < 20; i++) rope.update(ctx);
    expect(rope.x).toBeGreaterThan(startX);
    expect(rope.direction).toBe(Direction.Right);
  });

  it('stops rushing when blocked by a wall', () => {
    const rope = new Rope(40, 80, 0x28, 0x10, 1);
    const blocked = mockCtx(200, 80, false); // nothing walkable
    finishSpawn(rope, mockCtx(200, 80));
    const startX = rope.x;
    for (let i = 0; i < 20; i++) rope.update(blocked);
    expect(rope.x).toBe(startX); // couldn't move
  });
});

describe('Goriya', () => {
  it('blue Goriya throws a boomerang when Link is in range', () => {
    const g = new Goriya(80, 80, 0x05, 0x50, 1);
    const ctx = mockCtx(96, 80); // Link 16px away, in range
    finishSpawn(g, ctx);
    let projectile = null;
    for (let i = 0; i < 120 && !projectile; i++) {
      g.update(ctx);
      projectile = g.consumeProjectile();
    }
    expect(projectile).not.toBeNull();
  });

  it('is frozen (does not throw a second) while its boomerang is out', () => {
    const g = new Goriya(80, 80, 0x05, 0x50, 1);
    const ctx = mockCtx(96, 80);
    finishSpawn(g, ctx);
    let first = null;
    for (let i = 0; i < 120 && !first; i++) {
      g.update(ctx);
      first = g.consumeProjectile();
    }
    expect(first).not.toBeNull();
    // While the boomerang lives, no new projectile is produced.
    let second = null;
    for (let i = 0; i < 20 && !second; i++) {
      g.update(ctx);
      second = g.consumeProjectile();
    }
    expect(second).toBeNull();
  });
});

describe('Goriya boomerang', () => {
  it('flies out then returns and is caught (goes inactive)', () => {
    const g = new Goriya(80, 80, 0x05, 0x50, 1);
    const ctx = mockCtx(96, 80);
    finishSpawn(g, ctx);
    let boomerang = null;
    for (let i = 0; i < 120 && !boomerang; i++) {
      g.update(ctx);
      boomerang = g.consumeProjectile();
    }
    expect(boomerang).not.toBeNull();
    // Freeze the Goriya's position by not moving Link; drive the boomerang to return.
    let died = false;
    for (let i = 0; i < 200; i++) {
      boomerang!.update();
      if (!boomerang!.isActive()) { died = true; break; }
    }
    expect(died).toBe(true);
  });
});

describe('Zol', () => {
  it('splits into two Gels when hurt but not killed', () => {
    const zol = new Zol(80, 80, 0x13, 0x20, 1);
    const ctx = mockCtx();
    finishSpawn(zol, ctx);
    // A sub-lethal hit (damage < hp 0x20).
    const killed = zol.takeDamage(0x10, Direction.Down);
    expect(killed).toBe(false);
    expect(zol.state).toBe(EnemyState.Dead);
    const children = zol.collectChildSpawns();
    expect(children).toHaveLength(2);
    expect(children.every(c => c.objectType === 0x14)).toBe(true);
  });

  it('dies without splitting on a lethal blow', () => {
    const zol = new Zol(80, 80, 0x13, 0x20, 1);
    const ctx = mockCtx();
    finishSpawn(zol, ctx);
    const killed = zol.takeDamage(0x40, Direction.Down); // exceeds hp
    expect(killed).toBe(true);
    expect(zol.collectChildSpawns()).toHaveLength(0);
  });
});

describe('Gel', () => {
  it('dies in one hit (hp 0)', () => {
    const gel = new Gel(80, 80, 0x14, 0, 1);
    const ctx = mockCtx();
    finishSpawn(gel, ctx);
    const killed = gel.takeDamage(0x10, Direction.Down);
    expect(killed).toBe(true);
  });

  it('moves after spawning', () => {
    const gel = new Gel(80, 80, 0x14, 0, 1);
    const ctx = mockCtx();
    finishSpawn(gel, ctx);
    const sx = gel.x, sy = gel.y;
    for (let i = 0; i < 60; i++) gel.update(ctx);
    expect(gel.x !== sx || gel.y !== sy).toBe(true);
  });
});

describe('Keese', () => {
  it('flies (moves) after spawning and ignores walls', () => {
    const keese = new Keese(80, 80, 0x1b, 0, 1);
    const ctx = mockCtx(120, 40, false); // nothing "walkable" — flyer ignores tiles
    finishSpawn(keese, ctx);
    const sx = keese.x, sy = keese.y;
    for (let i = 0; i < 120; i++) keese.update(ctx);
    expect(keese.x !== sx || keese.y !== sy).toBe(true);
  });

  it('stays within the play-area bounds', () => {
    const keese = new Keese(80, 80, 0x1b, 0, 1);
    const ctx = mockCtx();
    finishSpawn(keese, ctx);
    for (let i = 0; i < 300; i++) {
      keese.update(ctx);
      expect(keese.x).toBeGreaterThanOrEqual(0);
      expect(keese.x).toBeLessThanOrEqual(240);
      expect(keese.y).toBeGreaterThanOrEqual(0);
      expect(keese.y).toBeLessThanOrEqual(160);
    }
  });
});
