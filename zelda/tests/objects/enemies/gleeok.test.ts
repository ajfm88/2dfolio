import { describe, it, expect } from 'vitest';
import {
  GleeokBody, GleeokNeckHead, GleeokFlyingHead, createGleeok,
  GLEEOK2, GLEEOK3, GLEEOK4, GLEEOK4B, GLEEOK_HEAD,
} from '../../../src/objects/enemies/gleeok.js';
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

function activeGleeok(type = GLEEOK2) {
  const { body, heads } = createGleeok(104, 0, type, 0x60, 1);
  const ctx = mockCtx();
  body.update(ctx);
  for (const h of heads) h.update(ctx);
  return { body, heads };
}

describe('Gleeok', () => {
  it('$42 creates 2 heads', () => {
    const { body, heads } = activeGleeok(GLEEOK2);
    expect(body.headCount).toBe(2);
    expect(heads.length).toBe(2);
  });

  it('$43 creates 3 heads', () => {
    const { heads } = activeGleeok(GLEEOK3);
    expect(heads.length).toBe(3);
  });

  it('$44 creates 4 heads', () => {
    const { heads } = activeGleeok(GLEEOK4);
    expect(heads.length).toBe(4);
  });

  it('$45 creates 4 heads', () => {
    const { heads } = activeGleeok(GLEEOK4B);
    expect(heads.length).toBe(4);
  });

  it('body is invulnerable', () => {
    const { body } = activeGleeok();
    expect(body.vulnerable).toBe(false);
  });

  it('heads have mask $FE (sword-only)', () => {
    const { heads } = activeGleeok();
    const head = heads[0]!;
    expect(head.isImmuneToDamageType(DamageTypeBit.Boomerang)).toBe(true);
    expect(head.isImmuneToDamageType(DamageTypeBit.Bomb)).toBe(true);
    expect(head.isImmuneToDamageType(DamageTypeBit.Fire)).toBe(true);
    expect(head.isImmuneToDamageType(DamageTypeBit.Arrow)).toBe(true);
    expect(head.isImmuneToDamageType(DamageTypeBit.Sword)).toBe(false);
  });

  it('killing a head spawns a GleeokFlyingHead child', () => {
    const { body, heads } = activeGleeok();
    const head = heads[0]!;
    // Deal enough damage to kill the head (HP = $A0 = 160)
    head.takeDamage(0xff, Direction.Right);
    const spawns = body.collectChildSpawns();
    expect(spawns.length).toBe(1);
    expect(spawns[0]!.objectType).toBe(GLEEOK_HEAD);
  });

  it('all heads dead kills the body', () => {
    const { body, heads } = activeGleeok(GLEEOK2);
    for (const h of heads) {
      h.takeDamage(0xff, Direction.Right);
    }
    expect(body.isDying || body.isDead).toBe(true);
  });

  it('heads oscillate (move over time)', () => {
    const { body, heads } = activeGleeok();
    const ctx = mockCtx();
    const head = heads[0]!;
    const startX = head.x;
    const startY = head.y;
    let moved = false;
    for (let i = 0; i < 100; i++) {
      body.update(ctx);
      head.update(ctx);
      if (head.x !== startX || head.y !== startY) {
        moved = true;
        break;
      }
    }
    expect(moved).toBe(true);
  });

  it('body shoots fireballs from heads', () => {
    const { body, heads } = activeGleeok();
    const ctx = mockCtx();
    let shot = false;
    for (let i = 0; i < 400; i++) {
      body.update(ctx);
      for (const h of heads) h.update(ctx);
      const proj = body.consumeProjectile();
      if (proj) { shot = true; break; }
    }
    expect(shot).toBe(true);
  });
});

describe('GleeokFlyingHead', () => {
  it('is completely invulnerable', () => {
    const fh = new GleeokFlyingHead(80, 60, GLEEOK_HEAD, 0x10, 1);
    fh.update(mockCtx());
    expect(fh.vulnerable).toBe(false);
    const killed = fh.takeDamage(0xff, Direction.Right);
    expect(killed).toBe(false);
    expect(fh.isDead).toBe(false);
  });

  it('moves around (flyer behavior)', () => {
    const fh = new GleeokFlyingHead(80, 60, GLEEOK_HEAD, 0x10, 1);
    const ctx = mockCtx();
    fh.update(ctx);
    const startX = fh.x;
    const startY = fh.y;
    let moved = false;
    for (let i = 0; i < 200; i++) {
      fh.update(ctx);
      if (fh.x !== startX || fh.y !== startY) {
        moved = true;
        break;
      }
    }
    expect(moved).toBe(true);
  });
});
