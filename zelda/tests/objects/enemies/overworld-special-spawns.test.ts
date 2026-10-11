import { afterEach, describe, expect, it, vi } from 'vitest';
import { Direction } from '../../../src/core/types.js';
import { MAX_ENEMY_SLOTS } from '../../../src/core/constants.js';
import { SpawnManager } from '../../../src/objects/enemies/spawn-manager.js';
import { Boulder, BoulderSet } from '../../../src/objects/enemies/boulder.js';
import { PondFairy } from '../../../src/objects/enemies/pond-fairy.js';
import { Enemy, EnemyState } from '../../../src/objects/enemies/enemy.js';
import { Zora } from '../../../src/objects/enemies/zora.js';
import { TileCollisionMap } from '../../../src/world/collision.js';
import type { OverworldData } from '../../../src/data/overworld-types.js';
import type { EnemySpawnData } from '../../../src/data/enemy-spawn-types.js';
import spawnJson from '../../../src/data/enemy-spawns.json';
import overworldJson from '../../../src/data/overworld.json';
import itemsJson from '../../../src/data/items.json';

const data = spawnJson as EnemySpawnData;
const world = overworldJson as OverworldData;
const collision = new TileCollisionMap(world.squareTable.primary, undefined, world.squareTable.secondary);
const manager = (): SpawnManager => new SpawnManager(data, itemsJson.objectHpPairs);
const screen = (id: number) => world.screens[id]!;

afterEach(() => { vi.restoreAllMocks(); Boulder.resetActiveCount(); });

describe('real overworld special objects', () => {
  it.each([57, 67])('screen %i spawns exactly one fixed fairy, no Zora or placeholder', (id) => {
    const sm = manager();
    sm.spawnForScreen(screen(id), Direction.Down, collision);
    expect(sm.enemies).toHaveLength(1);
    expect(sm.enemies[0]).toBeInstanceOf(PondFairy);
    expect([sm.enemies[0]!.x, sm.enemies[0]!.y]).toEqual([120, 64]);
    expect(sm.enemies[0]!.constructor).not.toBe(Enemy);
  });
  it.each([3, 8, 22, 23, 24, 25])('screen %i spawns one invisible BoulderSet', (id) => {
    const sm = manager();
    sm.spawnForScreen(screen(id), Direction.Down, collision);
    const sets = sm.enemies.filter(e => e instanceof BoulderSet);
    expect(sets).toHaveLength(1);
    expect(sets[0]!.state).toBe(EnemyState.Active);
    expect(sm.enemies.every(e => e.constructor !== Enemy)).toBe(true);
  });
  it.each([57, 67, 3, 8, 22, 23, 24, 25])('screen %i special bypasses water rejection and land nudging', (id) => {
    const sm = manager();
    const nudge = vi.fn(() => false);
    const wet = {
      isPositionWalkable: nudge,
      isWaterTileAt: () => true,
    } as unknown as TileCollisionMap;
    sm.spawnForScreen(screen(id), Direction.Down, wet);
    expect(nudge).not.toHaveBeenCalled();
    expect(sm.enemies.filter(e => e instanceof PondFairy || e instanceof BoulderSet)).toHaveLength(1);
  });
  it('extracts exactly the 37 AttrsA $08 screens, sorted and unique', () => {
    expect(data.overworldZoraScreens).toEqual([
      10,23,24,25,26,30,38,39,40,45,46,53,54,56,62,63,68,70,71,72,79,
      84,85,86,89,90,95,101,105,106,111,117,123,124,125,126,127,
    ]);
    expect(new Set(data.overworldZoraScreens).size).toBe(37);
  });
  it.each([14, 15, 29, 31, 52, 55, 57, 66, 67, 69])('water screen %i has no supplemental Zora', (id) => {
    const sm = manager();
    sm.spawnForScreen(screen(id), Direction.Down, collision);
    expect(sm.enemies.some(e => e instanceof Zora)).toBe(false);
  });
  it('screen 10 with the Zora bit spawns one Zora, not a land enemy in the water', () => {
    const sm = manager();
    sm.spawnForScreen(screen(10), Direction.Down, collision);
    expect(sm.enemies.filter(e => e instanceof Zora)).toHaveLength(1);
  });
  it('leaves explicit Zora monster lists unchanged even without the supplemental bit', () => {
    const sm = new SpawnManager({
      ...data, overworldZoraScreens: [],
      overworldSpawns: [{ screenId: 0, monsterListId: 0x11, monsterCountIndex: 0, edgeSpawn: false }],
    }, itemsJson.objectHpPairs);
    const wet = { isWaterTileAt: () => true } as unknown as TileCollisionMap;
    sm.spawnForScreen({ ...screen(10), id: 0 }, Direction.Down, wet);
    expect(sm.enemies).toHaveLength(1);
    expect(sm.enemies[0]).toBeInstanceOf(Zora);
  });
  it('creates boulder children with no cloud, caps at three and replaces departing boulders', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const sm = manager();
    sm.spawnForScreen(screen(3), Direction.Down, collision);
    const seen = new Set<Enemy>();
    let maxLive = 0;
    for (let frame = 0; frame < 800; frame++) {
      sm.update(collision, screen(3), 120, 112);
      const rocks = sm.enemies.filter(e => e instanceof Boulder);
      maxLive = Math.max(maxLive, rocks.length);
      expect(rocks.length).toBeLessThanOrEqual(3);
      expect(Boulder.activeCount).toBe(rocks.length);
      for (const b of rocks) {
        expect(b.state).toBe(EnemyState.Active);
        if (!seen.has(b)) expect(b.y).toBe(0);
        seen.add(b);
      }
    }
    expect(maxLive).toBe(3);
    expect(seen.size).toBeGreaterThan(3);
  });
  it('respects MAX_ENEMY_SLOTS before requesting a child', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const sm = manager();
    sm.spawnForScreen(screen(3), Direction.Down, collision);
    for (let i = 1; i < MAX_ENEMY_SLOTS; i++) sm.debugSpawn(7, 80, 80);
    for (let i = 0; i < 50; i++) sm.update(collision, screen(3), 120, 112);
    expect(sm.enemies).toHaveLength(MAX_ENEMY_SLOTS);
    expect(sm.enemies.some(e => e instanceof Boulder)).toBe(false);
  });
  it.each(['clear', 'screen', 'dungeon'])('resets ActiveBoulders on %s lifecycle boundary', (boundary) => {
    const sm = manager();
    sm.debugSpawn(0x20, 80, 0);
    expect(Boulder.activeCount).toBe(1);
    if (boundary === 'clear') sm.clear();
    if (boundary === 'screen') sm.spawnForScreen(screen(57), Direction.Down, collision);
    if (boundary === 'dungeon') sm.spawnForDungeonRoom(0, 0, Direction.Down);
    expect(Boulder.activeCount).toBe(0);
  });
  it('fairy heart animation continues while Clock freezes ordinary enemies', () => {
    const sm = manager();
    sm.spawnForScreen(screen(57), Direction.Down, collision);
    const fairy = sm.enemies[0] as PondFairy;
    fairy.tryTrigger(120, 112);
    sm.freezeAll(100);
    sm.update(collision, screen(57), 120, 112);
    expect(fairy.hearts[0]!.x).toBe(116);
    expect(sm.frozen).toBe(true);
  });
  it('Clock exceptions do not drain or discard an ordinary enemy’s pending split', () => {
    const sm = manager();
    sm.spawnForDungeonRoom(0x13, 1, Direction.Down);
    for (let i = 0; i < 12; i++) sm.update(collision, screen(3), 120, 112);
    const zol = sm.enemies[0]!;
    zol.takeDamage(0x01, Direction.Down);
    sm.freezeAll(3);
    for (let i = 0; i < 3; i++) {
      sm.update(collision, screen(3), 120, 112);
      expect(sm.enemies).toContain(zol);
      expect(sm.enemies.some(e => e.objectType === 0x14)).toBe(false);
    }
    sm.update(collision, screen(3), 120, 112);
    const children = sm.enemies.filter(e => e.objectType === 0x14);
    expect(children).toHaveLength(2);
    expect(children.every(e => e.isSpawning)).toBe(true);
  });
});
