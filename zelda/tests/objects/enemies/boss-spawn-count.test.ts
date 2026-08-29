import { describe, it, expect } from 'vitest';
import { SpawnManager } from '../../../src/objects/enemies/spawn-manager.js';
import { Aquamentus } from '../../../src/objects/enemies/aquamentus.js';
import { Direction } from '../../../src/core/types.js';
import type { EnemySpawnData } from '../../../src/data/enemy-spawn-types.js';

// NES Z_05.asm:1723 — a monster list ID in [$32,$62) (bosses + non-recurring
// objects) spawns exactly one, regardless of the room's foe-count nibble.

const hpPairs = [0x06, 0x43, 0x25, 0x31, 0x12, 0x24, 0x81, 0x14, 0x46, 0x46,
  0x46, 0x46, 0x46, 0x46, 0x46, 0x46, 0x46, 0x46, 0x46, 0x46, 0x46, 0x46, 0x46,
  0x46, 0x46, 0x46, 0x46, 0x46, 0x46, 0x46, 0x46, 0x46];

function spawnData(): EnemySpawnData {
  return {
    objectTypes: {},
    objectLists: [[7, 8, 7, 8]],
    spawnPositions: [
      [0x55, 0xB5, 0x78, 0x98, 0x7A, 0x9A, 0x6C, 0xAC, 0x8D],
      [0x82, 0x63, 0xA3, 0x75, 0x95, 0x77, 0x97, 0x5A, 0xBA],
      [0xA3, 0x75, 0xB5, 0x96, 0x87, 0x99, 0x7A, 0xBA, 0xAC],
      [0x63, 0x55, 0x95, 0x76, 0x88, 0x79, 0x5A, 0x9A, 0x6C],
    ],
    overworldSpawns: [],
    overworldFoeCounts: [1, 4, 5, 6],
  } as unknown as EnemySpawnData;
}

describe('boss single-spawn clamp', () => {
  it('spawns exactly one Aquamentus ($3D) even with a foe count of 3', () => {
    const sm = new SpawnManager(spawnData(), hpPairs);
    sm.spawnForDungeonRoom(0x3d, 3, Direction.Down);
    expect(sm.enemies.length).toBe(1);
    expect(sm.enemies[0]).toBeInstanceOf(Aquamentus);
  });

  it('spawns exactly one Dodongo ($32) even with a foe count of 3', () => {
    const sm = new SpawnManager(spawnData(), hpPairs);
    sm.spawnForDungeonRoom(0x32, 3, Direction.Down);
    expect(sm.enemies.length).toBe(1);
    expect(sm.enemies[0]!.objectType).toBe(0x32);
  });

  it('spawns Manhandla ($3C) as one 5-part cluster (1 center + 4 hands), not 3', () => {
    // The clamp still forces a single spawn slot; Manhandla expands that slot into
    // its 5-object cluster. Without the clamp it would be 3 clusters (15 objects).
    const sm = new SpawnManager(spawnData(), hpPairs);
    sm.spawnForDungeonRoom(0x3c, 3, Direction.Down);
    expect(sm.enemies.length).toBe(5);
    for (const e of sm.enemies) expect(e.objectType).toBe(0x3c);
  });

  it('does NOT clamp a normal enemy just below the boss range ($31 → 3)', () => {
    const sm = new SpawnManager(spawnData(), hpPairs);
    sm.spawnForDungeonRoom(0x31, 3, Direction.Down);
    expect(sm.enemies.length).toBe(3);
  });

  it('does NOT clamp a normal enemy ($07 Octorok → 3) — regression guard', () => {
    const sm = new SpawnManager(spawnData(), hpPairs);
    sm.spawnForDungeonRoom(0x07, 3, Direction.Down);
    expect(sm.enemies.length).toBe(3);
  });

  it('does NOT clamp a heterogeneous list ($62 → full count)', () => {
    const sm = new SpawnManager(spawnData(), hpPairs);
    sm.spawnForDungeonRoom(0x62, 3, Direction.Down);
    expect(sm.enemies.length).toBe(3);
  });
});

describe('dungeon spawn stays inside the walkable inner area', () => {
  // The overworld "Down" list reaches rows 9-11 (0xA3, 0xB5, 0xBA…) which are the
  // dungeon's bottom wall. Enemies spawned there are unreachable → a shutter/kill-all
  // room can never be cleared (soft-lock). Positions must clamp to rows 2-8, cols 2-13.
  it('never spawns an enemy embedded in the wall border', () => {
    const sm = new SpawnManager(spawnData(), hpPairs);
    sm.spawnForDungeonRoom(0x07, 9, Direction.Down); // max the count to use every slot
    expect(sm.enemies.length).toBeGreaterThan(0);
    for (const e of sm.enemies) {
      // cols 2-13 → x 32-208; rows 2-8 → y (row*16-3) 29-125.
      expect(e.x, `x=${e.x}`).toBeGreaterThanOrEqual(32);
      expect(e.x, `x=${e.x}`).toBeLessThanOrEqual(208);
      expect(e.y, `y=${e.y}`).toBeGreaterThanOrEqual(29);
      expect(e.y, `y=${e.y}`).toBeLessThanOrEqual(125);
    }
  });
});
