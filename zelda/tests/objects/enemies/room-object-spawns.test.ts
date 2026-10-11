// SpawnManager group spawns for the Q1 dungeon objects that used to fall through
// to the generic placeholder walker.
import { describe, it, expect } from 'vitest';
import { SpawnManager } from '../../../src/objects/enemies/spawn-manager.js';
import { Direction } from '../../../src/core/types.js';
import { Enemy } from '../../../src/objects/enemies/enemy.js';
import { Dodongo } from '../../../src/objects/enemies/dodongo.js';
import { MoldormSegment } from '../../../src/objects/enemies/moldorm.js';
import { RupeeStash } from '../../../src/objects/enemies/rupee-stash.js';
import { Grumble } from '../../../src/objects/enemies/grumble.js';
import { UnderworldPerson, UnderworldPersonLifeOrMoney } from '../../../src/objects/enemies/underworld-person.js';
import { StandingFire } from '../../../src/objects/enemies/guard-fire.js';
import { BONFIRE_XS, PERSON_Y } from '../../../src/objects/enemies/room-person.js';
import type { EnemySpawnData } from '../../../src/data/enemy-spawn-types.js';
import type { ItemData } from '../../../src/data/item-types.js';
import enemySpawnJson from '../../../src/data/enemy-spawns.json';
import itemsJson from '../../../src/data/items.json';

function spawn(listId: number, count = 3): readonly Enemy[] {
  const sm = new SpawnManager(enemySpawnJson as EnemySpawnData, (itemsJson as ItemData).objectHpPairs);
  sm.spawnForDungeonRoom(listId, count, Direction.Down);
  return sm.enemies;
}

describe('dungeon room object spawns', () => {
  it('$31 spawns the room\'s full count of Dodongos (below the $32 boss clamp)', () => {
    const e = spawn(0x31, 3);
    expect(e).toHaveLength(3);
    expect(e.every((d) => d instanceof Dodongo)).toBe(true);
  });

  it('$32 is still clamped to one Dodongo', () => {
    expect(spawn(0x32, 3)).toHaveLength(1);
  });

  it('$41 spawns two five-segment Moldorms', () => {
    const e = spawn(0x41);
    expect(e).toHaveLength(10);
    expect(e.every((s) => s instanceof MoldormSegment)).toBe(true);
  });

  it('$35 spawns the ten-rupee stash', () => {
    const e = spawn(0x35);
    expect(e).toHaveLength(10);
    expect(e.every((r) => r instanceof RupeeStash)).toBe(true);
  });

  it.each([0x4b, 0x4c, 0x4d, 0x4e, 0x4f, 0x50, 0x52])('$%s spawns an old man between two bonfires', (type) => {
    const e = spawn(type);
    expect(e).toHaveLength(3);
    expect(e[0]).toBeInstanceOf(UnderworldPerson);
    const fires = e.slice(1);
    expect(fires.every((f) => f instanceof StandingFire)).toBe(true);
    expect(fires.map((f) => f.x)).toEqual([...BONFIRE_XS]);
    expect(fires.every((f) => f.y === PERSON_Y)).toBe(true);
  });

  it('$51 spawns the life-or-money man', () => {
    expect(spawn(0x51)[0]).toBeInstanceOf(UnderworldPersonLifeOrMoney);
  });

  it('$36 spawns Grumble with the same bonfires', () => {
    const e = spawn(0x36);
    expect(e[0]).toBeInstanceOf(Grumble);
    expect(e.slice(1).every((f) => f instanceof StandingFire)).toBe(true);
  });

  it('none of them is the generic placeholder Enemy any more', () => {
    for (const type of [0x31, 0x35, 0x36, 0x41, 0x4b, 0x4c, 0x4d, 0x4e, 0x4f, 0x50, 0x51, 0x52]) {
      for (const e of spawn(type)) expect(e.constructor).not.toBe(Enemy);
    }
  });
});
