import { describe, it, expect } from 'vitest';
import itemsJson from '../../src/data/items.json';
import type { ItemData } from '../../src/data/item-types.js';

const data = itemsJson as ItemData;

describe('Item data — item names', () => {
  it('has 36 entries (IDs 0-35)', () => {
    expect(Object.keys(data.itemNames)).toHaveLength(36);
    for (let i = 0; i < 36; i++) {
      expect(data.itemNames[String(i)]).toBeDefined();
    }
  });

  it('all names are non-empty strings', () => {
    for (const name of Object.values(data.itemNames)) {
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('spot-check key items', () => {
    expect(data.itemNames['0']).toBe('Bomb');
    expect(data.itemNames['1']).toBe('WoodSword');
    expect(data.itemNames['26']).toBe('HeartContainer');
    expect(data.itemNames['27']).toBe('TriforcePiece');
    expect(data.itemNames['35']).toBe('Fairy');
  });
});

describe('Item data — itemIdToSlot', () => {
  it('has exactly 36 entries', () => {
    expect(data.itemIdToSlot).toHaveLength(36);
  });

  it('all values are in range 0-31', () => {
    for (const val of data.itemIdToSlot) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(31);
    }
  });

  it('spot-check first few values', () => {
    expect(data.itemIdToSlot[0]).toBe(0x01);
    expect(data.itemIdToSlot[1]).toBe(0x00);
    expect(data.itemIdToSlot[4]).toBe(0x06);
    expect(data.itemIdToSlot[5]).toBe(0x05);
  });
});

describe('Item data — itemIdToDescriptor', () => {
  it('has exactly 36 entries', () => {
    expect(data.itemIdToDescriptor).toHaveLength(36);
  });

  it('all values are in range 0-255', () => {
    for (const val of data.itemIdToDescriptor) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(255);
    }
  });
});

describe('Item data — drop tables', () => {
  it('noDropMonsterTypes has 7 entries', () => {
    expect(data.dropTables.noDropMonsterTypes).toHaveLength(7);
  });

  it('dropItemMonsterTypes has 3 groups with lengths 6, 9, 9', () => {
    expect(data.dropTables.dropItemMonsterTypes).toHaveLength(3);
    expect(data.dropTables.dropItemMonsterTypes[0]).toHaveLength(6);
    expect(data.dropTables.dropItemMonsterTypes[1]).toHaveLength(9);
    expect(data.dropTables.dropItemMonsterTypes[2]).toHaveLength(9);
  });

  it('dropItemRates has 4 entries', () => {
    expect(data.dropTables.dropItemRates).toHaveLength(4);
    expect(data.dropTables.dropItemRates).toEqual([0x50, 0x98, 0x68, 0x68]);
  });

  it('dropItemSetBaseOffsets equals [0, 10, 20, 30]', () => {
    expect(data.dropTables.dropItemSetBaseOffsets).toEqual([0, 10, 20, 30]);
  });

  it('dropItemTable has 4 rows of 10 entries each', () => {
    expect(data.dropTables.dropItemTable).toHaveLength(4);
    for (const row of data.dropTables.dropItemTable) {
      expect(row).toHaveLength(10);
    }
  });

  it('drop table row 0 matches known values', () => {
    expect(data.dropTables.dropItemTable[0]).toEqual([
      0x22, 0x18, 0x22, 0x18, 0x23, 0x18, 0x22, 0x22, 0x18, 0x18,
    ]);
  });

  it('all drop table item IDs are valid (0-35)', () => {
    for (const row of data.dropTables.dropItemTable) {
      for (const val of row) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(35);
      }
    }
  });
});

describe('Item data — cave contents', () => {
  it('has exactly 20 caves', () => {
    expect(data.caveContents).toHaveLength(20);
  });

  it('caveIndex values are 0-19 sequential', () => {
    data.caveContents.forEach((cave, i) => {
      expect(cave.caveIndex).toBe(i);
    });
  });

  it('objectType equals 0x6A + caveIndex', () => {
    for (const cave of data.caveContents) {
      expect(cave.objectType).toBe(0x6A + cave.caveIndex);
    }
  });

  it('each cave has 3 items, 3 itemFlags, 3 prices', () => {
    for (const cave of data.caveContents) {
      expect(cave.items).toHaveLength(3);
      expect(cave.itemFlags).toHaveLength(3);
      expect(cave.prices).toHaveLength(3);
    }
  });

  it('all item IDs are in range 0-63 (6-bit)', () => {
    for (const cave of data.caveContents) {
      for (const item of cave.items) {
        expect(item).toBeGreaterThanOrEqual(0);
        expect(item).toBeLessThanOrEqual(63);
      }
    }
  });

  it('all itemFlags are in range 0-3 (2-bit)', () => {
    for (const cave of data.caveContents) {
      for (const flag of cave.itemFlags) {
        expect(flag).toBeGreaterThanOrEqual(0);
        expect(flag).toBeLessThanOrEqual(3);
      }
    }
  });

  it('all prices are in range 0-255', () => {
    for (const cave of data.caveContents) {
      for (const price of cave.prices) {
        expect(price).toBeGreaterThanOrEqual(0);
        expect(price).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe('Item data — cave types', () => {
  it('has exactly 20 entries', () => {
    expect(data.caveTypes).toHaveLength(20);
  });

  it('textSelector values are in range 0-63 (6-bit)', () => {
    for (const ct of data.caveTypes) {
      expect(ct.textSelector).toBeGreaterThanOrEqual(0);
      expect(ct.textSelector).toBeLessThanOrEqual(63);
    }
  });

  it('payFlag and pickUpFlag are booleans', () => {
    for (const ct of data.caveTypes) {
      expect(typeof ct.payFlag).toBe('boolean');
      expect(typeof ct.pickUpFlag).toBe('boolean');
    }
  });

  it('cave 0 has pickUpFlag true (byte $40)', () => {
    expect(data.caveTypes[0]!.pickUpFlag).toBe(true);
    expect(data.caveTypes[0]!.payFlag).toBe(false);
  });
});

describe('Item data — overworld heart container', () => {
  it('is at screen 0x5F with correct coordinates', () => {
    expect(data.overworldHeartContainer.screenId).toBe(0x5F);
    expect(data.overworldHeartContainer.x).toBe(0xC0);
    expect(data.overworldHeartContainer.y).toBe(0x90);
    expect(data.overworldHeartContainer.itemId).toBe(0x1A);
  });
});

describe('Item data — secret Armos', () => {
  it('has exactly 7 entries', () => {
    expect(data.secretArmos).toHaveLength(7);
  });

  it('all roomIds are valid OW screen IDs (0-127)', () => {
    for (const sa of data.secretArmos) {
      expect(sa.roomId).toBeGreaterThanOrEqual(0);
      expect(sa.roomId).toBeLessThanOrEqual(127);
    }
  });

  it('all Y values are 0x80', () => {
    for (const sa of data.secretArmos) {
      expect(sa.y).toBe(0x80);
    }
  });

  it('first entry is room 0x24 at x=0xE0', () => {
    expect(data.secretArmos[0]!.roomId).toBe(0x24);
    expect(data.secretArmos[0]!.x).toBe(0xE0);
  });
});

describe('Item data — flute secrets', () => {
  it('has exactly 11 entries', () => {
    expect(data.fluteSecretRoomIds).toHaveLength(11);
  });

  it('all are valid OW screen IDs (0-127)', () => {
    for (const id of data.fluteSecretRoomIds) {
      expect(id).toBeGreaterThanOrEqual(0);
      expect(id).toBeLessThanOrEqual(127);
    }
  });

  it('contains room 0x42', () => {
    expect(data.fluteSecretRoomIds).toContain(0x42);
  });
});

describe('Item data — object HP pairs', () => {
  it('has exactly 38 entries', () => {
    expect(data.objectHpPairs).toHaveLength(38);
  });

  it('all values are in range 0-255', () => {
    for (const val of data.objectHpPairs) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(255);
    }
  });

  it('first byte is 0x06', () => {
    expect(data.objectHpPairs[0]).toBe(0x06);
  });
});

describe('Item data — money game', () => {
  it('lossAmounts equals [10, 40]', () => {
    expect(data.moneyGame.lossAmounts).toEqual([0x0A, 0x28]);
  });

  it('permutations has 18 entries', () => {
    expect(data.moneyGame.permutations).toHaveLength(18);
  });

  it('permutation values are in range 0-2', () => {
    for (const val of data.moneyGame.permutations) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(2);
    }
  });
});

describe('Item data — cross-references', () => {
  it('all drop table item IDs exist in itemNames', () => {
    for (const row of data.dropTables.dropItemTable) {
      for (const itemId of row) {
        expect(data.itemNames[String(itemId)]).toBeDefined();
      }
    }
  });

  it('all noDropMonsterTypes values are valid object types (0-255)', () => {
    for (const val of data.dropTables.noDropMonsterTypes) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(255);
    }
  });

  it('all secret Armos room IDs are valid OW screens', () => {
    for (const sa of data.secretArmos) {
      expect(sa.roomId).toBeGreaterThanOrEqual(0);
      expect(sa.roomId).toBeLessThanOrEqual(127);
    }
  });
});
