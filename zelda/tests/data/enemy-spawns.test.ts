import { describe, it, expect } from 'vitest';
import spawnJson from '../../src/data/enemy-spawns.json';
import type { EnemySpawnData } from '../../src/data/enemy-spawn-types.js';

const data = spawnJson as EnemySpawnData;

describe('Enemy spawn data — object types', () => {
  it('has entries for all IDs 0x00-0x52', () => {
    for (let id = 0; id <= 0x52; id++) {
      expect(data.objectTypes[String(id)]).toBeDefined();
    }
  });

  it('all names are non-empty strings', () => {
    for (const name of Object.values(data.objectTypes)) {
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('includes known enemy names', () => {
    expect(data.objectTypes['1']).toBe('BlueLynel');
    expect(data.objectTypes['7']).toBe('RedSlowOctorok');
    expect(data.objectTypes['11']).toBe('RedDarknut');
    expect(data.objectTypes['42']).toBe('Stalfos');
    expect(data.objectTypes['61']).toBe('Aquamentus');
    expect(data.objectTypes['62']).toBe('Ganon');
  });
});

describe('Enemy spawn data — object lists', () => {
  it('has exactly 30 lists', () => {
    expect(data.objectLists).toHaveLength(30);
  });

  it('each list has 4-8 entries', () => {
    for (let i = 0; i < data.objectLists.length; i++) {
      const list = data.objectLists[i]!;
      expect(list.length).toBeGreaterThanOrEqual(4);
      expect(list.length).toBeLessThanOrEqual(8);
    }
  });

  it('all entries are valid object type IDs (0-0x52)', () => {
    for (const list of data.objectLists) {
      for (const entry of list) {
        expect(entry).toBeGreaterThanOrEqual(0);
        expect(entry).toBeLessThanOrEqual(0x52);
      }
    }
  });

  it('list 0 (0x62) has BlueMoblin/RedMoblin mix', () => {
    const list = data.objectLists[0]!;
    expect(list).toHaveLength(5);
    for (const entry of list) {
      expect([3, 4]).toContain(entry);
    }
  });

  it('list 11 (0x6D) starts with Trap2Way', () => {
    expect(data.objectLists[11]![0]).toBe(0x4A);
  });
});

describe('Enemy spawn data — spawn positions', () => {
  it('has exactly 4 position lists', () => {
    expect(data.spawnPositions).toHaveLength(4);
  });

  it('each list has exactly 9 positions', () => {
    for (const list of data.spawnPositions) {
      expect(list).toHaveLength(9);
    }
  });

  it('all position values are 0-255', () => {
    for (const list of data.spawnPositions) {
      for (const pos of list) {
        expect(pos).toBeGreaterThanOrEqual(0);
        expect(pos).toBeLessThanOrEqual(255);
      }
    }
  });

  it('list 0 starts with known values', () => {
    expect(data.spawnPositions[0]![0]).toBe(0x55);
    expect(data.spawnPositions[0]![1]).toBe(0xB5);
  });
});

describe('Enemy spawn data — overworld spawns', () => {
  it('has exactly 128 entries', () => {
    expect(data.overworldSpawns).toHaveLength(128);
  });

  it('entries have sequential screen IDs 0-127', () => {
    data.overworldSpawns.forEach((spawn, i) => {
      expect(spawn.screenId).toBe(i);
    });
  });

  it('all monsterListIds are in range 0-127', () => {
    for (const spawn of data.overworldSpawns) {
      expect(spawn.monsterListId).toBeGreaterThanOrEqual(0);
      expect(spawn.monsterListId).toBeLessThanOrEqual(127);
    }
  });

  it('all monsterCountIndexes are in range 0-3', () => {
    for (const spawn of data.overworldSpawns) {
      expect(spawn.monsterCountIndex).toBeGreaterThanOrEqual(0);
      expect(spawn.monsterCountIndex).toBeLessThanOrEqual(3);
    }
  });

  it('edgeSpawn is a boolean', () => {
    for (const spawn of data.overworldSpawns) {
      expect(typeof spawn.edgeSpawn).toBe('boolean');
    }
  });

  it('most screens have enemies (> 100)', () => {
    const withEnemies = data.overworldSpawns.filter(s => s.monsterListId > 0).length;
    expect(withEnemies).toBeGreaterThan(100);
  });

  it('some screens have edge spawning', () => {
    const edgeSpawns = data.overworldSpawns.filter(s => s.edgeSpawn).length;
    expect(edgeSpawns).toBeGreaterThan(0);
    expect(edgeSpawns).toBeLessThan(40);
  });
});

describe('Enemy spawn data — overworld foeCounts', () => {
  it('has exactly 4 entries', () => {
    expect(data.overworldFoeCounts).toHaveLength(4);
  });

  it('matches known overworld foeCounts [1, 4, 5, 6]', () => {
    expect(data.overworldFoeCounts).toEqual([1, 4, 5, 6]);
  });
});

describe('Enemy spawn data — cross-references', () => {
  it('list IDs 0x62-0x7F used by overworld screens have corresponding object lists', () => {
    for (const spawn of data.overworldSpawns) {
      if (spawn.monsterListId >= 0x62) {
        const listIndex = spawn.monsterListId - 0x62;
        expect(listIndex).toBeLessThan(data.objectLists.length);
        expect(data.objectLists[listIndex]).toBeDefined();
      }
    }
  });

  it('single-type IDs (0x01-0x61) used by overworld screens are valid object types', () => {
    for (const spawn of data.overworldSpawns) {
      if (spawn.monsterListId >= 0x01 && spawn.monsterListId <= 0x61) {
        expect(data.objectTypes[String(spawn.monsterListId)]).toBeDefined();
      }
    }
  });
});
