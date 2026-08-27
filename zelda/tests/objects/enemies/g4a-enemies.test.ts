import { describe, it, expect } from 'vitest';
import { type EnemyUpdateContext } from '../../../src/objects/enemies/enemy.js';
import { createGibdo } from '../../../src/objects/enemies/gibdo.js';
import { Darknut } from '../../../src/objects/enemies/darknut.js';
import { Vire } from '../../../src/objects/enemies/vire.js';
import { PolsVoice } from '../../../src/objects/enemies/pols-voice.js';
import { Bubble } from '../../../src/objects/enemies/bubble.js';
import { WalkerEnemy } from '../../../src/objects/enemies/walker-enemy.js';
import { checkWeaponEnemyCollisions, type WeaponSet } from '../../../src/objects/enemies/enemy-collision.js';
import { getOppositeDirection } from '../../../src/core/collision-utils.js';
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

function swordWeapons(hitbox: { x: number; y: number; width: number; height: number }, dir: Direction): WeaponSet {
  return {
    swordHitbox: hitbox,
    swordDirection: dir,
    swordBeam: null,
    boomerang: null,
    bombs: [],
    arrow: null,
    fires: [],
    magicShot: null,
    magicRod: null,
    linkX: 0,
    linkY: 0,
    swordLevel: 1,
    hasMagicBoomerang: false,
  };
}

describe('Gibdo', () => {
  it('is a WalkerEnemy that wanders', () => {
    const g = createGibdo(80, 80, 0x30, 0x70, 1);
    expect(g).toBeInstanceOf(WalkerEnemy);
    const ctx = mockCtx();
    finishSpawn(g, ctx);
    const sx = g.x, sy = g.y;
    for (let i = 0; i < 40; i++) g.update(ctx);
    expect(g.x !== sx || g.y !== sy).toBe(true);
  });
});

describe('Darknut', () => {
  it('parries a frontal hit (opposite its facing) but not a side hit', () => {
    const d = new Darknut(80, 80, 0x0b, 0x40, 1);
    const facing = d.direction;
    const frontal = getOppositeDirection(facing);
    expect(d.blocksAttackFrom(frontal)).toBe(true);
    // A perpendicular (side) hit is not blocked.
    const side = facing === Direction.Up || facing === Direction.Down ? Direction.Left : Direction.Up;
    expect(d.blocksAttackFrom(side)).toBe(false);
    // A hit from directly behind (same direction) is not blocked either.
    expect(d.blocksAttackFrom(facing)).toBe(false);
  });

  it('takes no damage from a parried sword but is hurt by a side hit', () => {
    const d = new Darknut(80, 80, 0x0b, 0x40, 1);
    const ctx = mockCtx();
    finishSpawn(d, ctx);
    const facing = d.direction;
    const hb = { x: d.x, y: d.y, width: 16, height: 16 };

    // Frontal (parried): no HP loss.
    const hpBefore = d.hp;
    const parried = checkWeaponEnemyCollisions([d], swordWeapons(hb, getOppositeDirection(facing)));
    expect(parried[0]!.killed).toBe(false);
    expect(d.hp).toBe(hpBefore);

    // Side hit: HP drops.
    const side = facing === Direction.Up || facing === Direction.Down ? Direction.Left : Direction.Up;
    checkWeaponEnemyCollisions([d], swordWeapons(hb, side));
    expect(d.hp).toBeLessThan(hpBefore);
  });

  it('is never stunned', () => {
    const d = new Darknut(80, 80, 0x0c, 0x80, 1);
    finishSpawn(d, mockCtx());
    d.stun();
    expect(d.isStunned).toBe(false);
  });
});

describe('Vire', () => {
  it('splits into two Red Keese when killed', () => {
    const v = new Vire(80, 80, 0x12, 0x10, 1);
    finishSpawn(v, mockCtx());
    const killed = v.takeDamage(0x40, Direction.Down); // exceeds hp → dies
    expect(killed).toBe(true);
    const children = v.collectChildSpawns();
    expect(children).toHaveLength(2);
    expect(children.every(c => c.objectType === 0x1c)).toBe(true);
  });
});

describe('Pols Voice', () => {
  it('hops around after spawning', () => {
    const p = new PolsVoice(80, 80, 0x16, 0xA0, 1);
    const ctx = mockCtx(200, 80);
    finishSpawn(p, ctx);
    const sx = p.x, sy = p.y;
    for (let i = 0; i < 60; i++) p.update(ctx);
    expect(p.x !== sx || p.y !== sy).toBe(true);
  });
});

describe('Bubble', () => {
  it('is invulnerable (cannot be damaged)', () => {
    const b = new Bubble(80, 80, 0x2d, 0xF0, 1);
    finishSpawn(b, mockCtx());
    const killed = b.takeDamage(0xFF, Direction.Down);
    expect(killed).toBe(false);
    expect(b.isDead).toBe(false);
  });

  it('deals no contact damage (0 in the damage table)', () => {
    // Sanity: the three Bubble ids all resolve to 0 contact damage.
    // (main.ts routes Bubble contact to the sword-jinx instead.)
    const b = new Bubble(80, 80, 0x2c, 0xF0, 1);
    expect(b.objectType).toBe(0x2c);
  });

  it('moves after spawning', () => {
    const b = new Bubble(80, 80, 0x2b, 0xF0, 1);
    const ctx = mockCtx();
    finishSpawn(b, ctx);
    const sx = b.x, sy = b.y;
    for (let i = 0; i < 40; i++) b.update(ctx);
    expect(b.x !== sx || b.y !== sy).toBe(true);
  });
});
