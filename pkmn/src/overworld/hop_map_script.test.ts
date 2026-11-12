// V4 checkpoint-03: wWalkCounter boundaries, independent of the hop animation's full duration.
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { PlayerWalk } from './walk_pace';
import { host, world, tick, until, loadMainBattleRig, resetMainBattleRig } from '../test/main_battle_rig';
import { pinOverworldRandom } from '../test/overworld_random_pin';
import * as overworld from './index';
import * as trainer from './map_trainers';
import * as pewter from '../story/pewter_city';
import type { Direction } from '../core';

beforeAll(() => loadMainBattleRig());
beforeEach(() => { resetMainBattleRig(); pinOverworldRandom(255); });
afterEach(() => vi.restoreAllMocks());

it.each(['down', 'left', 'right'] as const)('exposes the native %s hop boundary before passes 1 and 9, excluding landing', d => {
  const walk = new PlayerWalk();
  expect(walk.mapScriptBoundary).toBe(true);
  walk.pass(d, true, () => 'hop', () => {});
  expect(walk.armedHop).toBe(true); expect(walk.mapScriptBoundary).toBe(true);
  const passes: number[] = [];
  for (let p = 1; p <= 17; p++) {
    if (walk.mapScriptBoundary) passes.push(p);
    walk.pass(null, false, () => 'walk', () => {});
  }
  expect(passes).toEqual([1, 9]);
  expect(walk.mapScriptBoundary).toBe(true);
  walk.pass(d, true, () => 'walk', () => {});
  expect(walk.mapScriptBoundary).toBe(false);
  walk.cancel(); expect(walk.mapScriptBoundary).toBe(true);
});

async function armHop(): Promise<{ d: Direction; x: number; y: number; steps: number }> {
  await world('Route1', 5, 5); host.pikachuFollower.visible = false;
  const dirs = [['down', 0, 1], ['left', -1, 0], ['right', 1, 0]] as const;
  for (let y = 0; y < host.gameMap.height * 2; y++) for (let x = 0; x < host.gameMap.width * 2; x++) {
    for (const [d, dx, dy] of dirs) {
      if (!host.gameMap.isLedge(x * 2, y * 2, d) || !host.gameMap.isWalkable((x + 2 * dx) * 2, (y + 2 * dy) * 2)) continue;
      if (host.overworldDeps().npcs.some(n => Math.abs(n.mapStepX - x) + Math.abs(n.mapStepY - y) <= 2)) continue;
      host.player.setTilePosition(x * 2, y * 2); host.player.direction = d;
      until(() => host.player.ledgeHopFlag && !host.player.isMoving, () => [d], 40);
      return { d, x, y, steps: host.player.stepsCompleted };
    }
  }
  throw new Error('no ordinary Route1 ledge fixture');
}

async function midpoint() {
  const start = await armHop();
  until(() => host.player.isMoving && host.player.stepsCompleted === start.steps + 1, () => [start.d], 40);
  expect(host.player.mapScriptBoundary).toBe(true);
  return start;
}

it('calls the live map-script dispatcher once at midpoint, before the second half advances', async () => {
  const start = await midpoint(), trace: string[] = [];
  const script = overworld.runMapScript, update = host.player.update.bind(host.player);
  vi.spyOn(overworld, 'runMapScript').mockImplementation((deps, state) => {
    if (host.player.isMoving && host.player.mapScriptBoundary) trace.push('script');
    return script(deps, state);
  });
  vi.spyOn(host.player, 'update').mockImplementation((...args) => {
    if (host.player.isMoving && host.player.mapScriptBoundary) trace.push('movement');
    return update(...args);
  });
  for (let n = 0; n < 4 && host.player.mapScriptBoundary; n++) tick();
  expect(trace).toEqual(['script', 'movement']);
  expect(host.player.stepsCompleted).toBe(start.steps + 1);
  expect(host.state).toBe('overworld');
});

it('allows the ordinary map-script body to run at midpoint without waiting for the full hop', async () => {
  await midpoint();
  const commands = [{ type: 'wait' as const, frames: 1 }];
  const builder = vi.spyOn(pewter, 'pewterCityScript').mockReturnValue(commands);
  const deps = { ...host.overworldDeps(), currentMapName: 'PewterCity' };
  expect(overworld.runMapScript(deps, host.ow)).toEqual({ type: 'script', commands });
  expect(builder).toHaveBeenCalledOnce();
});

it('dispatches the trainer map script at midpoint (checkpoint-04 removed the busy-trainer gate)', async () => {
  await midpoint();
  const dispatch = vi.spyOn(trainer, 'trainerMapScript');
  const deps = { ...host.overworldDeps(), currentMapName: 'Route3', npcs: [] };
  expect(overworld.runMapScript(deps, host.ow)).toBeNull();
  expect(dispatch).toHaveBeenCalledOnce();
});
