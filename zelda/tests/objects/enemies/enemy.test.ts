import { describe, it, expect } from 'vitest';
import { Enemy, EnemyState, getEnemyHp, type EnemyUpdateContext } from '../../../src/objects/enemies/enemy.js';
import { Direction } from '../../../src/core/types.js';

function mockCtx(): EnemyUpdateContext {
  return {
    collision: {
      isRectWalkable: () => true,
      isPositionWalkable: () => true,
      isWaterTileAt: () => false,
      getTileValueAtPosition: () => 0,
      setWalkableOverride: () => {},
      clearWalkableOverrides: () => {},
    } as unknown as import('../../../src/world/collision.js').TileCollisionMap,
    screen: { id: 0, tiles: Array(11).fill(Array(16).fill(0)) } as unknown as import('../../../src/data/overworld-types.js').OverworldScreen,
    linkX: 120,
    linkY: 80,
  };
}

describe('getEnemyHp', () => {
  const hpPairs = [0x06, 0x43, 0x25, 0x31, 0x12, 0x24, 0x81, 0x14];

  it('even type uses high nibble (AND $F0)', () => {
    expect(getEnemyHp(0, hpPairs)).toBe(0x00);
    expect(getEnemyHp(2, hpPairs)).toBe(0x40);
    expect(getEnemyHp(4, hpPairs)).toBe(0x20);
  });

  it('odd type uses low nibble shifted up (ASL ×4)', () => {
    expect(getEnemyHp(1, hpPairs)).toBe(0x60);
    expect(getEnemyHp(3, hpPairs)).toBe(0x30);
    expect(getEnemyHp(7, hpPairs)).toBe(0x10);
  });

  it('returns $10 for types beyond the table', () => {
    expect(getEnemyHp(100, hpPairs)).toBe(0x10);
  });
});

describe('Enemy', () => {
  const ctx = mockCtx();

  it('starts in Spawning state', () => {
    const enemy = new Enemy(80, 80, 7, 0x10, 7);
    expect(enemy.state).toBe(EnemyState.Spawning);
    expect(enemy.isSpawning).toBe(true);
    expect(enemy.isActive).toBe(true);
  });

  it('transitions to Active after spawn timer expires', () => {
    const enemy = new Enemy(80, 80, 7, 0x10, 3);
    enemy.update(ctx);
    enemy.update(ctx);
    expect(enemy.state).toBe(EnemyState.Spawning);
    enemy.update(ctx);
    expect(enemy.state).toBe(EnemyState.Active);
  });

  it('takes damage and enters knockback', () => {
    const enemy = new Enemy(80, 80, 7, 0x20, 0);
    enemy.update(ctx);
    const killed = enemy.takeDamage(0x10, Direction.Right);
    expect(killed).toBe(false);
    expect(enemy.hp).toBe(0x10);
    expect(enemy.state).toBe(EnemyState.Knockback);
  });

  it('dies when damage >= HP', () => {
    const enemy = new Enemy(80, 80, 7, 0x10, 0);
    enemy.update(ctx);
    const killed = enemy.takeDamage(0x10, Direction.Right);
    expect(killed).toBe(true);
    expect(enemy.hp).toBe(0);
    expect(enemy.state).toBe(EnemyState.Dying);
  });

  it('dies when damage > HP', () => {
    const enemy = new Enemy(80, 80, 7, 0x10, 0);
    enemy.update(ctx);
    const killed = enemy.takeDamage(0x40, Direction.Down);
    expect(killed).toBe(true);
    expect(enemy.isDying).toBe(true);
  });

  it('transitions from Dying to Dead after death timer', () => {
    const enemy = new Enemy(80, 80, 7, 0x10, 0);
    enemy.update(ctx);
    enemy.takeDamage(0x10, Direction.Right);
    expect(enemy.isDying).toBe(true);
    for (let i = 0; i < 12; i++) {
      enemy.update(ctx);
    }
    expect(enemy.isDead).toBe(true);
  });

  it('rejects damage during invincibility', () => {
    const enemy = new Enemy(80, 80, 7, 0x30, 0);
    enemy.update(ctx);
    enemy.takeDamage(0x10, Direction.Right);
    expect(enemy.hp).toBe(0x20);
    const killed = enemy.takeDamage(0x10, Direction.Right);
    expect(killed).toBe(false);
    expect(enemy.hp).toBe(0x20);
  });

  it('rejects damage during spawning', () => {
    const enemy = new Enemy(80, 80, 7, 0x10, 7);
    const killed = enemy.takeDamage(0x10, Direction.Right);
    expect(killed).toBe(false);
    expect(enemy.hp).toBe(0x10);
  });

  it('stun sets state to Stunned', () => {
    const enemy = new Enemy(80, 80, 7, 0x10, 0);
    enemy.update(ctx);
    enemy.stun();
    expect(enemy.isStunned).toBe(true);
  });

  it('stun timer expires and returns to Active', () => {
    const enemy = new Enemy(80, 80, 7, 0x10, 0);
    enemy.update(ctx);
    enemy.stun();
    for (let i = 0; i < 160; i++) {
      enemy.update(ctx);
    }
    expect(enemy.state).toBe(EnemyState.Active);
  });

  it('getHitbox returns 16x16 rect at position', () => {
    const enemy = new Enemy(48, 64, 7, 0x10, 0);
    const rect = enemy.getHitbox();
    expect(rect).toEqual({ x: 48, y: 64, width: 16, height: 16 });
  });

  it('knockback moves enemy in direction', () => {
    const enemy = new Enemy(80, 80, 7, 0x20, 0);
    enemy.update(ctx);
    const startX = enemy.x;
    enemy.takeDamage(0x10, Direction.Right);
    expect(enemy.state).toBe(EnemyState.Knockback);
    enemy.update(ctx);
    expect(enemy.x).toBe(startX + 4);
  });

  it('rejects damage when not vulnerable', () => {
    const enemy = new Enemy(80, 80, 26, 0x10, 0);
    enemy.update(ctx);
    // Force vulnerable to false (e.g., Peahat while flying)
    (enemy as unknown as { _vulnerable: boolean })._vulnerable = false;
    const killed = enemy.takeDamage(0x10, Direction.Right);
    expect(killed).toBe(false);
    expect(enemy.hp).toBe(0x10);
  });
});
