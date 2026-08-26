import { describe, it, expect } from 'vitest';
import { SpawnManager } from '../../../src/objects/enemies/spawn-manager.js';
import { Direction } from '../../../src/core/types.js';
import type { EnemySpawnData } from '../../../src/data/enemy-spawn-types.js';

function mockCollision() {
  return {
    isRectWalkable: () => true,
    isPositionWalkable: () => true,
    isWaterTileAt: () => false,
    getTileValueAtPosition: () => 0,
    setWalkableOverride: () => {},
    clearWalkableOverrides: () => {},
  } as unknown as import('../../../src/world/collision.js').TileCollisionMap;
}

function mockScreen(id = 0) {
  return { id, tiles: Array(11).fill(Array(16).fill(0)) } as unknown as import('../../../src/data/overworld-types.js').OverworldScreen;
}

const hpPairs = [0x06, 0x43, 0x25, 0x31, 0x12, 0x24, 0x81, 0x14];

function createTestSpawnData(): EnemySpawnData {
  return {
    objectTypes: { '7': 'RedSlowOctorok', '8': 'RedFastOctorok' },
    objectLists: [
      [7, 8, 7, 8],
      [3, 4, 3],
    ],
    spawnPositions: [
      [0x55, 0xB5, 0x78, 0x98, 0x7A, 0x9A, 0x6C, 0xAC, 0x8D],
      [0x82, 0x63, 0xA3, 0x75, 0x95, 0x77, 0x97, 0x5A, 0xBA],
      [0xA3, 0x75, 0xB5, 0x96, 0x87, 0x99, 0x7A, 0xBA, 0xAC],
      [0x63, 0x55, 0x95, 0x76, 0x88, 0x79, 0x5A, 0x9A, 0x6C],
    ],
    overworldSpawns: [
      { screenId: 0, monsterListId: 0, monsterCountIndex: 0, edgeSpawn: false },
      { screenId: 1, monsterListId: 7, monsterCountIndex: 1, edgeSpawn: false },
      { screenId: 2, monsterListId: 0x62, monsterCountIndex: 1, edgeSpawn: false },
    ],
    overworldFoeCounts: [1, 4, 5, 6],
  };
}

describe('SpawnManager', () => {
  it('spawns no enemies for monsterListId=0', () => {
    const data = createTestSpawnData();
    const sm = new SpawnManager(data, hpPairs);
    sm.spawnForScreen(mockScreen(0), Direction.Right);
    expect(sm.enemies.length).toBe(0);
  });

  it('spawns single-type enemies for monsterListId in 0x01-0x61 range', () => {
    const data = createTestSpawnData();
    const sm = new SpawnManager(data, hpPairs);
    // Screen 1 has monsterListId=7 (RedSlowOctorok), monsterCountIndex=1, foeCounts[1]=4
    sm.spawnForScreen(mockScreen(1), Direction.Right);
    expect(sm.enemies.length).toBe(4);
    // All should be type 7 (RedSlowOctorok)
    for (const enemy of sm.enemies) {
      expect(enemy.objectType).toBe(7);
    }
  });

  it('spawns heterogeneous list enemies for monsterListId >= 0x62', () => {
    const data = createTestSpawnData();
    const sm = new SpawnManager(data, hpPairs);
    // Screen 2 has monsterListId=0x62 (list index 0 = [7,8,7,8]), monsterCountIndex=1, foeCounts[1]=4
    sm.spawnForScreen(mockScreen(2), Direction.Right);
    expect(sm.enemies.length).toBe(4);
    expect(sm.enemies[0]!.objectType).toBe(7);
    expect(sm.enemies[1]!.objectType).toBe(8);
    expect(sm.enemies[2]!.objectType).toBe(7);
    expect(sm.enemies[3]!.objectType).toBe(8);
  });

  it('places enemies at correct positions from spawn position list', () => {
    const data = createTestSpawnData();
    const sm = new SpawnManager(data, hpPairs);
    // Direction.Right → spawn list 0, first position $55 → col=5, row=5 → x=80, y=77
    sm.spawnForScreen(mockScreen(1), Direction.Right);
    expect(sm.enemies[0]!.x).toBe(5 * 16);  // col 5 → x=80
    expect(sm.enemies[0]!.y).toBe(5 * 16 - 3);  // row 5 → y=77
  });

  it('clear removes all enemies', () => {
    const data = createTestSpawnData();
    const sm = new SpawnManager(data, hpPairs);
    sm.spawnForScreen(mockScreen(1), Direction.Right);
    expect(sm.enemies.length).toBe(4);
    sm.clear();
    expect(sm.enemies.length).toBe(0);
  });

  it('update removes dead enemies', () => {
    const data = createTestSpawnData();
    const sm = new SpawnManager(data, hpPairs);
    sm.spawnForScreen(mockScreen(1), Direction.Right);
    const col = mockCollision();
    const scr = mockScreen(1);

    // Wait for spawn timers
    for (let i = 0; i < 20; i++) {
      sm.update(col, scr, 120, 80);
    }

    // Kill the first enemy
    const enemy = sm.enemies[0]!;
    enemy.takeDamage(0xFF, Direction.Right);
    // Tick through death timer
    for (let i = 0; i < 20; i++) {
      sm.update(col, scr, 120, 80);
    }

    // Dead enemy should be removed
    expect(sm.enemies).not.toContain(enemy);
  });

  it('freezeAll stops enemy updates', () => {
    const data = createTestSpawnData();
    const sm = new SpawnManager(data, hpPairs);
    sm.spawnForScreen(mockScreen(1), Direction.Right);
    const col = mockCollision();
    const scr = mockScreen(1);

    // Wait for spawn
    for (let i = 0; i < 20; i++) {
      sm.update(col, scr, 120, 80);
    }

    const x0 = sm.enemies[0]!.x;
    sm.freezeAll(100);
    expect(sm.frozen).toBe(true);

    // Enemy should not move during freeze
    sm.update(col, scr, 120, 80);
    expect(sm.enemies[0]!.x).toBe(x0);
  });

  it('freeze expires after timer', () => {
    const data = createTestSpawnData();
    const sm = new SpawnManager(data, hpPairs);
    sm.spawnForScreen(mockScreen(1), Direction.Right);
    const col = mockCollision();
    const scr = mockScreen(1);

    sm.freezeAll(3);
    for (let i = 0; i < 3; i++) {
      sm.update(col, scr, 120, 80);
    }
    expect(sm.frozen).toBe(false);
  });

  it('activeEnemies filters out dead enemies', () => {
    const data = createTestSpawnData();
    const sm = new SpawnManager(data, hpPairs);
    sm.spawnForScreen(mockScreen(1), Direction.Right);
    const col = mockCollision();
    const scr = mockScreen(1);

    // Wait for spawn
    for (let i = 0; i < 20; i++) {
      sm.update(col, scr, 120, 80);
    }

    const initial = sm.activeEnemies.length;
    expect(initial).toBe(4);

    // Kill one — enters Dying state first
    sm.enemies[0]!.takeDamage(0xFF, Direction.Right);
    // Dying enemies are still "active" (on screen) until death timer finishes
    // Tick through death timer to reach Dead state
    for (let i = 0; i < 15; i++) {
      sm.update(col, scr, 120, 80);
    }
    // Now the dead enemy should be removed by update()
    expect(sm.activeEnemies.length).toBe(3);
  });
});
