import { describe, it, expect } from 'vitest';
import {
  createManhandla,
  ManhandlaCenter,
  ManhandlaHand,
  MANHANDLA,
} from '../../../src/objects/enemies/manhandla.js';
import { type EnemyUpdateContext } from '../../../src/objects/enemies/enemy.js';
import { EnemyProjectile } from '../../../src/objects/projectiles/enemy-projectile.js';
import { ProjectileType } from '../../../src/objects/player/shield.js';
import { DamageTypeBit } from '../../../src/core/constants.js';
import { Direction } from '../../../src/core/types.js';

// Manhandla (Z_04.asm): 1 center + 4 hands. Hands are normal killable Enemies
// (mask $E2); the center is invulnerable and dies only with the last hand. Each
// hand death speeds the whole group up.

function mockCtx(linkX = 40, linkY = 40): EnemyUpdateContext {
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

// Build the cluster and advance every part past its spawn cloud (Active).
function activeGroup(cx = 120, cy = 80) {
  const { center, hands } = createManhandla(cx, cy, 0x40, 1);
  center.update(mockCtx());
  for (const h of hands) h.update(mockCtx());
  return { center, hands };
}

describe('Manhandla', () => {
  it('createManhandla builds 1 center + 4 hands, all type $3C', () => {
    const { center, hands } = createManhandla(120, 80, 0x40, 1);
    expect(center).toBeInstanceOf(ManhandlaCenter);
    expect(hands.length).toBe(4);
    for (const h of hands) {
      expect(h).toBeInstanceOf(ManhandlaHand);
      expect(h.objectType).toBe(MANHANDLA);
    }
    expect(center.objectType).toBe(MANHANDLA);
  });

  it('positions the four hands N/S/E/W ±16 around the center', () => {
    const { center, hands } = activeGroup(120, 80);
    center.update(mockCtx()); // reposition (no move on this frame)
    const [up, down, left, right] = hands;
    expect({ x: up!.x, y: up!.y }).toEqual({ x: 120, y: 64 });
    expect({ x: down!.x, y: down!.y }).toEqual({ x: 120, y: 96 });
    expect({ x: left!.x, y: left!.y }).toEqual({ x: 104, y: 80 });
    expect({ x: right!.x, y: right!.y }).toEqual({ x: 136, y: 80 });
  });

  it('hands are immune to fire and boomerang but not sword or arrow', () => {
    const { hands } = activeGroup();
    const hand = hands[0]!;
    expect(hand.isImmuneToDamageType(DamageTypeBit.Fire)).toBe(true);
    expect(hand.isImmuneToDamageType(DamageTypeBit.Boomerang)).toBe(true);
    expect(hand.isImmuneToDamageType(DamageTypeBit.Sword)).toBe(false);
    expect(hand.isImmuneToDamageType(DamageTypeBit.Arrow)).toBe(false);
  });

  it('speeds the group up when a hand dies', () => {
    const { center, hands } = activeGroup();
    const before = center.speedPerFrame;
    expect(hands[0]!.takeDamage(0x80, Direction.Left)).toBe(true); // one-shot kill
    center.update(mockCtx()); // center reaps the dead hand → speeds up
    expect(center.speedPerFrame).toBeGreaterThan(before);
    expect(center.livingHands).toBe(3);
  });

  it('center is invulnerable while any hand lives', () => {
    const { center } = activeGroup();
    expect(center.vulnerable).toBe(false);
    expect(center.takeDamage(0x80, Direction.Left)).toBe(false);
    expect(center.isDead).toBe(false);
  });

  it('the whole boss dies once the last hand is gone', () => {
    const { center, hands } = activeGroup();
    for (const h of hands) h.takeDamage(0x80, Direction.Left);
    // Advance everyone until the death animations complete.
    for (let i = 0; i < 40; i++) {
      center.update(mockCtx());
      for (const h of hands) h.update(mockCtx());
    }
    expect(center.livingHands).toBe(0);
    // All 5 objects fully dead → activeEnemies (filter !isDead) would be empty.
    expect([center, ...hands].every(e => e.isDead)).toBe(true);
  });

  it('a hand fires an unblockable $56 fireball aimed roughly at Link', () => {
    const { hands } = activeGroup();
    const hand = hands[0]!;
    let shot: EnemyProjectile | null = null;
    for (let i = 0; i < 3000 && !shot; i++) {
      hand.update(mockCtx());
      shot = hand.consumeProjectile();
    }
    expect(shot).not.toBeNull();
    expect(shot!.type).toBe(ProjectileType.Fireball2Unblockable);
  });

  it('bounces off the walls — the center stays in bounds indefinitely', () => {
    const { center, hands } = activeGroup(120, 80);
    for (let i = 0; i < 2000; i++) {
      center.update(mockCtx(200, 150)); // pull it toward a corner
      for (const h of hands) h.update(mockCtx());
      expect(center.x).toBeGreaterThanOrEqual(16);
      expect(center.x).toBeLessThanOrEqual(224);
      expect(center.y).toBeGreaterThanOrEqual(16);
      expect(center.y).toBeLessThanOrEqual(144);
    }
  });
});
