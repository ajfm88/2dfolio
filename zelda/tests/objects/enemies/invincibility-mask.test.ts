import { describe, it, expect } from 'vitest';
import {
  checkWeaponEnemyCollisions,
  type WeaponSet,
} from '../../../src/objects/enemies/enemy-collision.js';
import { Aquamentus, AQUAMENTUS } from '../../../src/objects/enemies/aquamentus.js';
import { Enemy, type EnemyUpdateContext } from '../../../src/objects/enemies/enemy.js';
import { Direction, type Rect } from '../../../src/core/types.js';

// Per-weapon invincibility mask (Z_04 InitXxx ObjInvincibilityMask). Aquamentus
// ($E2) is immune to boomerang and fire, hurt by everything else. A default enemy
// (mask 0) must remain hurt by every weapon — the regression guard.

function mockCtx(): EnemyUpdateContext {
  return {
    collision: { isRectWalkable: () => true, isPositionWalkable: () => true } as unknown as import('../../../src/world/collision.js').TileCollisionMap,
    screen: { id: 0, tiles: Array(11).fill(Array(16).fill(0)) } as unknown as import('../../../src/data/overworld-types.js').OverworldScreen,
    linkX: 40,
    linkY: 80,
  };
}

function activeBoss(): Aquamentus {
  const b = new Aquamentus(0, 0, AQUAMENTUS, 0x60, 1);
  b.update(mockCtx());
  return b;
}

// Empty weapon set; individual tests fill in the one weapon under test.
function emptyWeapons(overlap: Rect): WeaponSet {
  return {
    swordHitbox: null,
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
    _overlap: overlap,
  } as unknown as WeaponSet & { _overlap: Rect };
}

// A rect overlapping the boss body at (176,64,24,32).
const HIT: Rect = { x: 180, y: 72, width: 8, height: 8 };

describe('invincibility mask', () => {
  it('sword hurts Aquamentus', () => {
    const boss = activeBoss();
    const w = { ...emptyWeapons(HIT), swordHitbox: HIT };
    checkWeaponEnemyCollisions([boss], w);
    expect(boss.hp).toBeLessThan(0x60);
  });

  it('arrow hurts Aquamentus', () => {
    const boss = activeBoss();
    const arrow = { isActive: true, isSilver: false, direction: Direction.Left, getHitbox: () => HIT, deactivate: () => {} };
    const w = { ...emptyWeapons(HIT), arrow: arrow as unknown as WeaponSet['arrow'] };
    checkWeaponEnemyCollisions([boss], w);
    expect(boss.hp).toBeLessThan(0x60);
  });

  it('bomb hurts Aquamentus', () => {
    const boss = activeBoss();
    const bomb = { getExplosionHitbox: () => HIT };
    const w = { ...emptyWeapons(HIT), bombs: [bomb] as unknown as WeaponSet['bombs'] };
    checkWeaponEnemyCollisions([boss], w);
    expect(boss.hp).toBeLessThan(0x60);
  });

  it('boomerang bounces off Aquamentus without damage or stun', () => {
    const boss = activeBoss();
    let returned = false;
    const boomerang = { isActive: true, getHitbox: () => HIT, forceReturn: () => { returned = true; } };
    const w = { ...emptyWeapons(HIT), boomerang: boomerang as unknown as WeaponSet['boomerang'] };
    checkWeaponEnemyCollisions([boss], w);
    expect(returned).toBe(true);       // it still reflects
    expect(boss.hp).toBe(0x60);        // but deals nothing
    expect(boss.isStunned).toBe(false);
  });

  it('candle fire does not hurt Aquamentus', () => {
    const boss = activeBoss();
    const fire = { isActive: true, direction: Direction.Left, getHitbox: () => HIT };
    const w = { ...emptyWeapons(HIT), fires: [fire] as unknown as WeaponSet['fires'] };
    checkWeaponEnemyCollisions([boss], w);
    expect(boss.hp).toBe(0x60);
  });

  it('regression: a default enemy (mask 0) is still hurt by fire', () => {
    const enemy = new Enemy(180, 72, 0x07, 0x20, 1);
    enemy.update(mockCtx()); // finish spawn → Active
    const fire = { isActive: true, direction: Direction.Left, getHitbox: () => HIT };
    const w = { ...emptyWeapons(HIT), fires: [fire] as unknown as WeaponSet['fires'] };
    checkWeaponEnemyCollisions([enemy], w);
    expect(enemy.hp).toBeLessThan(0x20);
  });
});
