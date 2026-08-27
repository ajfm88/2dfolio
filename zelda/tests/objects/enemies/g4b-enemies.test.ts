import { describe, it, expect } from 'vitest';
import { type EnemyUpdateContext } from '../../../src/objects/enemies/enemy.js';
import { BlueWizzrobe, RedWizzrobe } from '../../../src/objects/enemies/wizzrobe.js';
import { LikeLike } from '../../../src/objects/enemies/like-like.js';
import { Wallmaster } from '../../../src/objects/enemies/wallmaster.js';
import { Lanmola } from '../../../src/objects/enemies/lanmola.js';
import { ProjectileType } from '../../../src/objects/player/shield.js';
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

function finishSpawn(e: { update: (c: EnemyUpdateContext) => void }, ctx: EnemyUpdateContext): void {
  for (let i = 0; i < 8; i++) e.update(ctx);
}

describe('Blue Wizzrobe', () => {
  it('moves after spawning', () => {
    const w = new BlueWizzrobe(80, 80, 0x23, 0x20, 1);
    const ctx = mockCtx(200, 80);
    finishSpawn(w, ctx);
    const sx = w.x, sy = w.y;
    for (let i = 0; i < 40; i++) w.update(ctx);
    expect(w.x !== sx || w.y !== sy).toBe(true);
  });

  it('shoots a MagicShot when Link shares its row', () => {
    const w = new BlueWizzrobe(80, 80, 0x23, 0x20, 1);
    finishSpawn(w, mockCtx(200, 80));
    let shot: ProjectileType | null = null;
    for (let i = 0; i < 40 && shot === null; i++) {
      // Keep Link on the wizzrobe's current row so alignment is deterministic.
      const ctx = mockCtx(200, w.y);
      w.update(ctx);
      const p = w.consumeProjectile();
      if (p) shot = p.type;
    }
    expect(shot).toBe(ProjectileType.MagicShot);
  });
});

describe('Red Wizzrobe', () => {
  it('is only vulnerable while solid', () => {
    const w = new RedWizzrobe(80, 80, 0x24, 0x20, 1);
    finishSpawn(w, mockCtx());
    // Right after spawning it is fading/hidden — not vulnerable.
    expect(w.vulnerable).toBe(false);
    // Somewhere in its cycle it becomes solid (vulnerable) then not again.
    let wasVulnerable = false;
    let wasInvulnerable = false;
    for (let i = 0; i < 256; i++) {
      w.update(mockCtx());
      if (w.vulnerable) wasVulnerable = true;
      else wasInvulnerable = true;
    }
    expect(wasVulnerable).toBe(true);
    expect(wasInvulnerable).toBe(true);
  });

  it('shoots a MagicShot2 during its solid phase', () => {
    const w = new RedWizzrobe(80, 80, 0x24, 0x20, 1);
    finishSpawn(w, mockCtx(120, 80));
    let shot: ProjectileType | null = null;
    for (let i = 0; i < 200 && shot === null; i++) {
      w.update(mockCtx(120, 80));
      const p = w.consumeProjectile();
      if (p) shot = p.type;
    }
    expect(shot).toBe(ProjectileType.MagicShot2);
  });
});

describe('Like-Like', () => {
  it('captures Link, eats the Magic Shield after $60 frames, then frees on death', () => {
    const ll = new LikeLike(80, 80, 0x17, 0x20, 1);
    const ctx = mockCtx(80, 80);
    finishSpawn(ll, ctx);

    expect(ll.capturing).toBe(false);
    ll.beginCapture();
    expect(ll.capturing).toBe(true);

    // Before $60 frames it has not eaten the shield.
    let ate = false;
    for (let i = 0; i < 0x5f; i++) {
      ll.update(ctx);
      if (ll.consumeShieldEat()) ate = true;
    }
    expect(ate).toBe(false);

    // It eats the shield exactly once around the $60-frame mark.
    for (let i = 0; i < 4; i++) {
      ll.update(ctx);
      if (ll.consumeShieldEat()) ate = true;
    }
    expect(ate).toBe(true);
    expect(ll.consumeShieldEat()).toBe(false); // only once

    // Killing it frees Link.
    const killed = ll.takeDamage(0x80, Direction.Down);
    expect(killed).toBe(true);
    expect(ll.capturing).toBe(false);
  });
});

describe('Wallmaster', () => {
  it('emerges from the wall nearest Link', () => {
    const w = new Wallmaster(80, 80, 0x27, 0x20, 1);
    const ctx = mockCtx(200, 80); // Link near the right wall
    finishSpawn(w, ctx);
    w.update(ctx);
    // Emerged from the right wall (x near screen-right 240), crawling left.
    expect(w.x).toBeGreaterThan(200);
    expect(w.direction).toBe(Direction.Left);
  });

  it('raises grabbed when it grabs Link', () => {
    const w = new Wallmaster(80, 80, 0x27, 0x20, 1);
    finishSpawn(w, mockCtx());
    expect(w.grabbed).toBe(false);
    w.grab();
    expect(w.grabbed).toBe(true);
  });
});

describe('Lanmola', () => {
  it('head-only hitbox tracks the head position', () => {
    const l = new Lanmola(40, 80, 0x3b, 0x20, 1);
    const hb = l.getHitbox();
    expect(hb.x).toBe(l.x);
    expect(hb.y).toBe(l.y);
    expect(hb.width).toBe(16);
  });

  it('blue moves faster than red (speed by type)', () => {
    const red = new Lanmola(40, 80, 0x3a, 0x20, 1);
    const blue = new Lanmola(40, 80, 0x3b, 0x20, 1);
    const ctx = mockCtx(40, 150); // Link straight below → both head down
    finishSpawn(red, ctx);
    finishSpawn(blue, ctx);
    const redY0 = red.y, blueY0 = blue.y;
    red.update(ctx);
    blue.update(ctx);
    const redMoved = Math.abs(red.y - redY0) + Math.abs(red.x - 40);
    const blueMoved = Math.abs(blue.y - blueY0) + Math.abs(blue.x - 40);
    expect(blueMoved).toBeGreaterThan(redMoved);
  });

  it('moves after spawning', () => {
    const l = new Lanmola(40, 80, 0x3a, 0x20, 1);
    const ctx = mockCtx(200, 80);
    finishSpawn(l, ctx);
    const sx = l.x, sy = l.y;
    for (let i = 0; i < 20; i++) l.update(ctx);
    expect(l.x !== sx || l.y !== sy).toBe(true);
  });
});
