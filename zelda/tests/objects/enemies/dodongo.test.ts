import { describe, it, expect } from 'vitest';
import { Dodongo, DODONGO } from '../../../src/objects/enemies/dodongo.js';
import {
  Enemy,
  type EnemyUpdateContext,
  type BombLike,
} from '../../../src/objects/enemies/enemy.js';
import {
  checkWeaponEnemyCollisions,
  type WeaponSet,
} from '../../../src/objects/enemies/enemy-collision.js';
import { BombState } from '../../../src/objects/weapons/bomb.js';
import { DamageTypeBit } from '../../../src/core/constants.js';
import { Direction, type Rect } from '../../../src/core/types.js';

// Dodongo (Z_04.asm) is immune to every direct weapon; only bombs affect it. A
// blast stuns it (→ a single sword kills it); an un-exploded bomb in its mouth is
// eaten (2 eaten = death). HP is irrelevant — death is scripted.

function mockCtx(bombs: readonly BombLike[] = [], linkX = 40, linkY = 80): EnemyUpdateContext {
  return {
    collision: {
      isRectWalkable: () => true,
      isPositionWalkable: () => true,
    } as unknown as import('../../../src/world/collision.js').TileCollisionMap,
    screen: { id: 0, tiles: Array(11).fill(Array(16).fill(0)) } as unknown as import('../../../src/data/overworld-types.js').OverworldScreen,
    linkX,
    linkY,
    bombs,
  };
}

// Spawn + one update to leave the spawn cloud (Active).
function activeDodongo(x = 100, y = 80): Dodongo {
  const d = new Dodongo(x, y, DODONGO, 0x40, 1);
  d.update(mockCtx());
  return d;
}

function fuseBomb(x: number, y: number): BombLike {
  return { x, y, isDetonating: false, state: BombState.Fuse, getExplosionHitbox: () => null };
}

function detonatingBomb(x: number, y: number): BombLike {
  const blast: Rect = { x, y, width: 16, height: 16 };
  return { x, y, isDetonating: true, state: BombState.Detonating, getExplosionHitbox: () => blast };
}

// Place a fuse bomb over the mouth (leading half) given current facing.
function eat(d: Dodongo): void {
  const mouthX = d.direction === Direction.Right ? d.x + 16 : d.x;
  d.update(mockCtx([fuseBomb(mouthX, d.y)]));
}

describe('Dodongo', () => {
  it('is immune to every direct weapon while moving', () => {
    const d = activeDodongo();
    expect(d.phase).toBe('move');
    for (const bit of [
      DamageTypeBit.Sword, DamageTypeBit.Boomerang, DamageTypeBit.Arrow,
      DamageTypeBit.Bomb, DamageTypeBit.MagicShot, DamageTypeBit.Fire,
    ]) {
      expect(d.isImmuneToDamageType(bit)).toBe(true);
    }
    // Sword damage bounces off (no death) while moving.
    expect(d.takeDamage(0x10, Direction.Left)).toBe(false);
    expect(d.isDead).toBe(false);
  });

  it('has a 2-tile-wide hitbox (32×16)', () => {
    const hb = activeDodongo().getHitbox();
    expect(hb.width).toBe(32);
    expect(hb.height).toBe(16);
  });

  it('cannot be boomerang-stunned (stun() is a no-op)', () => {
    const d = activeDodongo();
    d.stun();
    expect(d.phase).toBe('move');
    expect(d.isStunned).toBe(false);
  });

  it('is stunned by a nearby bomb blast, exposing it to the sword', () => {
    const d = activeDodongo(100, 80);
    d.update(mockCtx([detonatingBomb(100, 80)]));
    expect(d.phase).toBe('stunned');
    // While stunned the sword bit is no longer masked.
    expect(d.isImmuneToDamageType(DamageTypeBit.Sword)).toBe(false);
  });

  it('dies from a single sword hit while stunned', () => {
    const d = activeDodongo(100, 80);
    d.update(mockCtx([detonatingBomb(100, 80)]));
    expect(d.phase).toBe('stunned');
    expect(d.takeDamage(0x10, Direction.Left)).toBe(true);
    expect(d.isDying || d.isDead).toBe(true);
  });

  it('dies to a stunned sword hit through the real collision path', () => {
    const d = activeDodongo(100, 80);
    d.update(mockCtx([detonatingBomb(100, 80)]));

    const hit: Rect = { x: 104, y: 82, width: 8, height: 8 }; // overlaps body (100,80,32,16)
    const weapons = {
      swordHitbox: hit,
      swordDirection: Direction.Left,
      swordBeam: null,
      boomerang: null,
      bombs: [],
      arrow: null,
      fires: [],
      magicShot: null,
      magicRod: null,
      linkX: 40,
      linkY: 80,
      swordLevel: 1,
      hasMagicBoomerang: false,
    } as unknown as WeaponSet;
    const results = checkWeaponEnemyCollisions([d], weapons);
    expect(results.some(r => r.killed)).toBe(true);
  });

  it('eats an un-exploded bomb placed in its mouth (→ bloated)', () => {
    const d = activeDodongo();
    eat(d);
    expect(d.phase).toBe('bloated');
    expect(d.bombsEaten).toBe(1);
    expect(d.isDead).toBe(false);
  });

  it('survives one eaten bomb but dies on the second', () => {
    const d = activeDodongo();
    eat(d);
    expect(d.bombsEaten).toBe(1);

    // Wait out the bloated period → back to moving.
    for (let i = 0; i < 400 && d.phase !== 'move'; i++) d.update(mockCtx());
    expect(d.phase).toBe('move');
    expect(d.isDead).toBe(false);

    eat(d); // second bomb
    expect(d.bombsEaten).toBe(2);
    for (let i = 0; i < 400 && !(d.isDying || d.isDead); i++) d.update(mockCtx());
    expect(d.isDying || d.isDead).toBe(true);
  });

  it('regression: a default enemy (mask 0) is still hurt by the sword', () => {
    const enemy = new Enemy(100, 80, 0x07, 0x20, 1);
    enemy.update(mockCtx());
    expect(enemy.isImmuneToDamageType(DamageTypeBit.Sword)).toBe(false);
    expect(enemy.takeDamage(0x10, Direction.Left)).toBe(false); // non-fatal, but damaged
    expect(enemy.hp).toBeLessThan(0x20);
  });
});
