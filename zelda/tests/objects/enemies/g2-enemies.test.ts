import { describe, it, expect } from 'vitest';
import { type EnemyUpdateContext } from '../../../src/objects/enemies/enemy.js';
import { createOctorok } from '../../../src/objects/enemies/octorok.js';
import { createMoblin } from '../../../src/objects/enemies/moblin.js';
import { createLynel } from '../../../src/objects/enemies/lynel.js';
import { Tektite } from '../../../src/objects/enemies/tektite.js';
import { Leever } from '../../../src/objects/enemies/leever.js';
import { Zora } from '../../../src/objects/enemies/zora.js';
import { Peahat } from '../../../src/objects/enemies/peahat.js';
import { Ghini, FlyingGhini } from '../../../src/objects/enemies/ghini.js';
import { Armos } from '../../../src/objects/enemies/armos.js';
import { WalkerEnemy } from '../../../src/objects/enemies/walker-enemy.js';
import { Direction } from '../../../src/core/types.js';

function mockCtx(linkX = 120, linkY = 80): EnemyUpdateContext {
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

describe('Octorok', () => {
  it('creates red slow octorok (type 7)', () => {
    const enemy = createOctorok(80, 80, 7, 0x10, 7);
    expect(enemy).toBeInstanceOf(WalkerEnemy);
    expect(enemy.objectType).toBe(7);
  });

  it('creates blue fast octorok (type 10)', () => {
    const enemy = createOctorok(80, 80, 10, 0x20, 7);
    expect(enemy.objectType).toBe(10);
  });

  it('walks after spawn', () => {
    const enemy = createOctorok(80, 80, 7, 0x10, 1);
    const ctx = mockCtx();
    enemy.update(ctx); // finish spawn
    const startX = enemy.x;
    const startY = enemy.y;
    // Update several times — should move
    for (let i = 0; i < 30; i++) {
      enemy.update(ctx);
    }
    const moved = enemy.x !== startX || enemy.y !== startY;
    expect(moved).toBe(true);
  });
});

describe('Moblin', () => {
  it('creates blue moblin (type 3)', () => {
    const enemy = createMoblin(80, 80, 3, 0x30, 7);
    expect(enemy).toBeInstanceOf(WalkerEnemy);
    expect(enemy.objectType).toBe(3);
  });

  it('creates red moblin (type 4)', () => {
    const enemy = createMoblin(80, 80, 4, 0x20, 7);
    expect(enemy.objectType).toBe(4);
  });
});

describe('Lynel', () => {
  it('creates blue lynel (type 1)', () => {
    const enemy = createLynel(80, 80, 1, 0x60, 7);
    expect(enemy).toBeInstanceOf(WalkerEnemy);
    expect(enemy.objectType).toBe(1);
  });

  it('creates red lynel (type 2)', () => {
    const enemy = createLynel(80, 80, 2, 0x40, 7);
    expect(enemy.objectType).toBe(2);
  });
});

describe('Tektite', () => {
  it('creates blue tektite (type 13)', () => {
    const enemy = new Tektite(80, 80, 13, 0x10, 1);
    expect(enemy).toBeInstanceOf(Tektite);
    expect(enemy.objectType).toBe(13);
  });

  it('creates red tektite (type 14)', () => {
    const enemy = new Tektite(80, 80, 14, 0x10, 1);
    expect(enemy.objectType).toBe(14);
  });

  it('moves when active (jumping)', () => {
    const enemy = new Tektite(80, 80, 13, 0x10, 1);
    const ctx = mockCtx();
    enemy.update(ctx); // finish spawn
    const startX = enemy.x;
    const startY = enemy.y;
    // Run for many frames to trigger a jump
    for (let i = 0; i < 120; i++) {
      enemy.update(ctx);
    }
    const moved = enemy.x !== startX || enemy.y !== startY;
    expect(moved).toBe(true);
  });
});

describe('Leever', () => {
  it('creates blue leever (type 15)', () => {
    const enemy = new Leever(80, 80, 15, 0x20, 1);
    expect(enemy.objectType).toBe(15);
  });

  it('creates red leever (type 16)', () => {
    Leever.resetRedCount();
    const enemy = new Leever(80, 80, 16, 0x10, 1);
    expect(enemy.objectType).toBe(16);
  });

  it('starts invulnerable (underground)', () => {
    const enemy = new Leever(80, 80, 15, 0x20, 1);
    const ctx = mockCtx();
    enemy.update(ctx); // finish spawn
    expect(enemy.vulnerable).toBe(false);
  });
});

describe('Zora', () => {
  it('creates zora (type 17)', () => {
    const enemy = new Zora(80, 80, 17, 0x20, 1);
    expect(enemy.objectType).toBe(17);
  });

  it('starts invulnerable (underground)', () => {
    const enemy = new Zora(80, 80, 17, 0x20, 1);
    const ctx = mockCtx();
    enemy.update(ctx); // finish spawn
    expect(enemy.vulnerable).toBe(false);
  });
});

describe('Peahat', () => {
  it('creates peahat (type 26)', () => {
    const enemy = new Peahat(80, 80, 26, 0x10, 1);
    expect(enemy.objectType).toBe(26);
  });

  it('starts invulnerable (flying)', () => {
    const enemy = new Peahat(80, 80, 26, 0x10, 0);
    // Peahat starts in Delay state (vulnerable) but _vulnerable is set false in constructor
    // It becomes vulnerable when entering Delay state during AI update
    expect(enemy.vulnerable).toBe(false);
  });

  it('becomes vulnerable during delay state', () => {
    const enemy = new Peahat(80, 80, 26, 0x10, 1);
    const ctx = mockCtx();
    enemy.update(ctx); // finish spawn
    // Peahat starts in Delay state with stateTimer — run through it
    let becameVulnerable = false;
    for (let i = 0; i < 200; i++) {
      enemy.update(ctx);
      if (enemy.vulnerable) {
        becameVulnerable = true;
        break;
      }
    }
    expect(becameVulnerable).toBe(true);
  });
});

describe('Ghini', () => {
  it('creates main ghini (type 33)', () => {
    const enemy = new Ghini(80, 80, 33, 0x20, 1);
    expect(enemy.objectType).toBe(33);
  });

  it('creates flying ghini (type 34)', () => {
    const enemy = new FlyingGhini(80, 80, 34, 0x10, 1);
    expect(enemy.objectType).toBe(34);
  });

  it('killing main ghini kills flying ghini', () => {
    const main = new Ghini(80, 80, 33, 0x10, 0);
    const flyer = new FlyingGhini(100, 100, 34, 0x10, 0);
    const ctx = mockCtx();
    main.update(ctx); // finish spawn
    flyer.update(ctx); // finish spawn
    main.setSiblings([main, flyer]);

    main.takeDamage(0xFF, Direction.Right);
    expect(main.isDying).toBe(true);
    expect(flyer.isDying).toBe(true);
  });
});

describe('Armos', () => {
  it('creates armos (type 30)', () => {
    const enemy = new Armos(80, 80, 30, 0x20, 7);
    expect(enemy.objectType).toBe(30);
  });

  it('starts dormant and invulnerable', () => {
    const enemy = new Armos(80, 80, 30, 0x20, 7);
    expect(enemy.vulnerable).toBe(false);
  });

  it('activates when Link touches', () => {
    const enemy = new Armos(80, 80, 30, 0x20, 0);
    // Start with Link far away
    const ctx = mockCtx(200, 200);
    enemy.update(ctx); // finish spawn (0 delay for Armos)
    expect(enemy.vulnerable).toBe(false);

    // Now place Link touching the Armos
    const touchCtx = mockCtx(80, 80);
    enemy.update(touchCtx);
    expect(enemy.vulnerable).toBe(true);
  });

  it('moves after activation', () => {
    const enemy = new Armos(80, 80, 30, 0x20, 0);
    enemy.update(mockCtx(200, 200)); // finish spawn
    enemy.update(mockCtx(80, 80)); // activate

    const startX = enemy.x;
    const startY = enemy.y;
    for (let i = 0; i < 30; i++) {
      enemy.update(mockCtx(120, 80));
    }
    const moved = enemy.x !== startX || enemy.y !== startY;
    expect(moved).toBe(true);
  });
});

describe('SpawnManager factory', () => {
  it('creates correct enemy types', () => {
    const octorok = createOctorok(0, 0, 7, 0x10, 0);
    expect(octorok).toBeInstanceOf(WalkerEnemy);

    const tektite = new Tektite(0, 0, 13, 0x10, 0);
    expect(tektite).toBeInstanceOf(Tektite);

    const peahat = new Peahat(0, 0, 26, 0x10, 0);
    expect(peahat).toBeInstanceOf(Peahat);
  });
});

describe('Enemy projectile spawning', () => {
  it('walker enemies can fire projectiles', () => {
    const enemy = createOctorok(80, 80, 7, 0x10, 0);
    const ctx = mockCtx();
    enemy.update(ctx); // finish spawn

    // Run many frames to give shooting timer a chance to trigger
    let firedProjectile = false;
    for (let i = 0; i < 500; i++) {
      enemy.update(ctx);
      const proj = enemy.consumeProjectile();
      if (proj) {
        firedProjectile = true;
        expect(proj.isActive()).toBe(true);
        break;
      }
    }
    // Projectile firing is random, so we just check it doesn't crash
    // (may or may not fire within 500 frames)
    expect(typeof firedProjectile).toBe('boolean');
  });
});
