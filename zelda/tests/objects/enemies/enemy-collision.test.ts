import { describe, it, expect } from 'vitest';
import { Enemy, EnemyState } from '../../../src/objects/enemies/enemy.js';
import { checkWeaponEnemyCollisions, checkEnemyLinkCollisions, type WeaponSet } from '../../../src/objects/enemies/enemy-collision.js';
import { Direction } from '../../../src/core/types.js';

function makeActiveEnemy(x = 80, y = 80, hp = 0x10): Enemy {
  const enemy = new Enemy(x, y, 7, hp, 0);
  enemy.update({
    collision: { isRectWalkable: () => true, isPositionWalkable: () => true } as unknown as import('../../../src/world/collision.js').TileCollisionMap,
    screen: { id: 0, tiles: [] } as unknown as import('../../../src/data/overworld-types.js').OverworldScreen,
    linkX: 120, linkY: 80,
  });
  return enemy;
}

function emptyWeapons(): WeaponSet {
  return {
    swordHitbox: null,
    swordDirection: Direction.Right,
    swordBeam: null,
    boomerang: null,
    bombs: [],
    arrow: null,
    fires: [],
    magicShot: null,
    magicRod: null,
    linkX: 120,
    linkY: 80,
    swordLevel: 1,
    hasMagicBoomerang: false,
  };
}

describe('checkWeaponEnemyCollisions', () => {
  it('sword hitbox kills weak enemy', () => {
    const enemy = makeActiveEnemy(80, 80, 0x10);
    const weapons = {
      ...emptyWeapons(),
      swordHitbox: { x: 75, y: 75, width: 24, height: 32 },
      swordDirection: Direction.Right,
      swordLevel: 1, // $10 damage
    };
    const results = checkWeaponEnemyCollisions([enemy], weapons);
    expect(results.length).toBe(1);
    expect(results[0]!.killed).toBe(true);
    expect(enemy.state).toBe(EnemyState.Dying);
  });

  it('sword hitbox damages strong enemy without killing', () => {
    const enemy = makeActiveEnemy(80, 80, 0x30);
    const weapons = {
      ...emptyWeapons(),
      swordHitbox: { x: 75, y: 75, width: 24, height: 32 },
      swordDirection: Direction.Right,
      swordLevel: 1,
    };
    const results = checkWeaponEnemyCollisions([enemy], weapons);
    expect(results.length).toBe(1);
    expect(results[0]!.killed).toBe(false);
    expect(enemy.hp).toBe(0x20);
    expect(enemy.state).toBe(EnemyState.Knockback);
  });

  it('no collision when sword misses', () => {
    const enemy = makeActiveEnemy(80, 80, 0x10);
    const weapons = {
      ...emptyWeapons(),
      swordHitbox: { x: 200, y: 200, width: 24, height: 32 },
    };
    const results = checkWeaponEnemyCollisions([enemy], weapons);
    expect(results.length).toBe(0);
  });

  it('bomb explosion kills enemy', () => {
    const enemy = makeActiveEnemy(80, 80, 0x10);
    const fakeBomb = {
      getExplosionHitbox: () => ({ x: 60, y: 60, width: 48, height: 48 }),
      getHitbox: () => ({ x: 80, y: 80, width: 16, height: 16 }),
      isActive: true,
      isDetonating: true,
    };
    const weapons = {
      ...emptyWeapons(),
      bombs: [fakeBomb as unknown as import('../../../src/objects/weapons/bomb.js').Bomb],
    };
    const results = checkWeaponEnemyCollisions([enemy], weapons);
    expect(results.length).toBe(1);
    expect(results[0]!.killed).toBe(true);
  });

  it('boomerang stuns enemy (normal)', () => {
    const enemy = makeActiveEnemy(80, 80, 0x10);
    let forceReturnCalled = false;
    const fakeBoom = {
      isActive: true,
      getHitbox: () => ({ x: 78, y: 78, width: 8, height: 8 }),
      forceReturn: () => { forceReturnCalled = true; },
    };
    const weapons = {
      ...emptyWeapons(),
      boomerang: fakeBoom as unknown as import('../../../src/objects/weapons/boomerang.js').Boomerang,
      hasMagicBoomerang: false,
    };
    const results = checkWeaponEnemyCollisions([enemy], weapons);
    expect(results.length).toBe(0); // stun only, no kill result
    expect(enemy.isStunned).toBe(true);
    expect(forceReturnCalled).toBe(true);
  });

  it('magic boomerang stuns and damages', () => {
    const enemy = makeActiveEnemy(80, 80, 0x10);
    const fakeBoom = {
      isActive: true,
      getHitbox: () => ({ x: 78, y: 78, width: 8, height: 8 }),
      forceReturn: () => {},
    };
    const weapons = {
      ...emptyWeapons(),
      boomerang: fakeBoom as unknown as import('../../../src/objects/weapons/boomerang.js').Boomerang,
      hasMagicBoomerang: true,
    };
    const results = checkWeaponEnemyCollisions([enemy], weapons);
    expect(results.length).toBe(1);
    expect(results[0]!.killed).toBe(true);
  });

  it('arrow kills enemy and deactivates', () => {
    const enemy = makeActiveEnemy(80, 80, 0x20);
    let deactivated = false;
    const fakeArrow = {
      isActive: true,
      isSilver: false,
      direction: Direction.Right,
      getHitbox: () => ({ x: 78, y: 78, width: 8, height: 8 }),
      deactivate: () => { deactivated = true; },
    };
    const weapons = {
      ...emptyWeapons(),
      arrow: fakeArrow as unknown as import('../../../src/objects/weapons/arrow.js').Arrow,
    };
    const results = checkWeaponEnemyCollisions([enemy], weapons);
    expect(results.length).toBe(1);
    expect(results[0]!.killed).toBe(true);
    expect(deactivated).toBe(true);
  });

  it('skips spawning enemies', () => {
    const enemy = new Enemy(80, 80, 7, 0x10, 7); // still spawning
    const weapons = {
      ...emptyWeapons(),
      swordHitbox: { x: 75, y: 75, width: 24, height: 32 },
    };
    const results = checkWeaponEnemyCollisions([enemy], weapons);
    expect(results.length).toBe(0);
  });
});

describe('checkEnemyLinkCollisions', () => {
  it('detects enemy touching Link', () => {
    const enemy = makeActiveEnemy(80, 80);
    const linkRect = { x: 84, y: 88, width: 8, height: 8 };
    const hit = checkEnemyLinkCollisions([enemy], linkRect);
    expect(hit).toBe(enemy);
  });

  it('returns null when no overlap', () => {
    const enemy = makeActiveEnemy(80, 80);
    const linkRect = { x: 200, y: 200, width: 8, height: 8 };
    const hit = checkEnemyLinkCollisions([enemy], linkRect);
    expect(hit).toBeNull();
  });

  it('skips dying enemies', () => {
    const enemy = makeActiveEnemy(80, 80, 0x10);
    enemy.takeDamage(0x10, Direction.Right); // dying
    const linkRect = { x: 84, y: 88, width: 8, height: 8 };
    const hit = checkEnemyLinkCollisions([enemy], linkRect);
    expect(hit).toBeNull();
  });

  it('skips spawning enemies', () => {
    const enemy = new Enemy(80, 80, 7, 0x10, 7);
    const linkRect = { x: 84, y: 88, width: 8, height: 8 };
    const hit = checkEnemyLinkCollisions([enemy], linkRect);
    expect(hit).toBeNull();
  });
});
