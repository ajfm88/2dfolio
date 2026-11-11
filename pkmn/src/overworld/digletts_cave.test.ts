// V4 checkpoint-02: real input/dispatch over the checkpoint-01 cartridge data.
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { host, loadMainBattleRig, resetMainBattleRig, world, tick, until } from '../test/main_battle_rig';
import { pinOverworldRandom } from '../test/overworld_random_pin';
import { installOverworldRandom } from './overworld_random';
import { loadWildEncounters, tryWildEncounter } from '../battle/encounter';
import { A, POKEDEX_ORDER } from '../battle/battle_state';
import { getMapPalette } from '../renderer/palettes';
import { getActivePalette } from '../renderer/renderer';
import * as audio from '../audio';
import * as text from '../text';
import type { Direction } from '../core';
import type { SaveData } from '../save';
import type { TextBox } from '../text';

const main = host as typeof host & { textBox: TextBox; writeSave(): void; loadSavedGame(): Promise<void> };

const directions: readonly (readonly [Direction, number, number])[] = [
  ['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0],
];
beforeAll(() => loadMainBattleRig());
beforeEach(() => { resetMainBattleRig(); pinOverworldRandom(255); });
afterEach(() => vi.restoreAllMocks());

async function settle(): Promise<void> {
  // The real transition owns fade callbacks and async map loading. Drive both to completion.
  for (let n = 0; n < 160; n++) { await Promise.resolve(); if (host.state !== 'transition') return; tick(); }
  throw new Error('warp did not finish');
}
async function step(direction: Direction): Promise<void> {
  const x = host.player.x, y = host.player.y;
  for (let n = 0; n < 50; n++) {
    tick([direction]);
    if (host.state === 'transition') { await settle(); return; }
    if (!host.player.isBusy && (host.player.x !== x || host.player.y !== y)) { tick(); return; }
  }
  throw new Error(`step blocked at ${host.player.mapStepX},${host.player.mapStepY} ${direction}`);
}

it.each(['DiglettsCave', 'DiglettsCaveRoute11'])('loads %s with cave palette, dungeon music and its own NPC roster', async name => {
  const music = vi.spyOn(audio, 'playDefaultMusicFadeOutCurrent');
  await world(name, name === 'DiglettsCave' ? 5 : 4, 6);
  for (let n = 0; n < 30; n++) tick();
  expect(getMapPalette(name)).toBe('CAVE'); expect(getActivePalette()).toBe('CAVE');
  expect(music).toHaveBeenCalledWith('dungeon2', false);
  expect(host.gameMap.mapData?.name).toBe(name);
  expect(host.gameMap.isIndoor).toBe(true);
  expect(host.overworldDeps().npcs.map(n => n.data.id)).toEqual(name === 'DiglettsCave' ? [] : ['gambler']);
});

it.each([
  ['DiglettsCaveRoute2', 4, 5, 'up', 'DiglettsCave', 5, 5],
  ['DiglettsCave', 5, 6, 'up', 'DiglettsCaveRoute2', 4, 4],
  ['DiglettsCaveRoute11', 4, 5, 'up', 'DiglettsCave', 37, 31],
  ['DiglettsCave', 37, 32, 'up', 'DiglettsCaveRoute11', 4, 4],
] as const)('walks the real ladder %s to %s and retains player/follower facing', async (source, x, y, direction, dest, dx, dy) => {
  await world(source, x, y); host.player.direction = direction;
  await step(direction);
  expect(host.state).toBe('overworld'); expect(host.gameMap.mapData?.name).toBe(dest);
  expect([host.player.mapStepX, host.player.mapStepY, host.player.direction]).toEqual([dx, dy, direction]);
  expect(host.ow.doorExitStep).toBe(false);
  expect([host.pikachuFollower.visible, host.pikachuFollower.x, host.pikachuFollower.y, host.pikachuFollower.direction])
    .toEqual([true, dx * 16, dy * 16, direction]); // ASM default spawn is on the player tile
});

it('walks the cave end to end using real collision and ordinary steps, then takes the southern ladder', async () => {
  await world('DiglettsCave', 5, 6);
  const queue: [number, number, Direction[]][] = [[5, 6, []]];
  const seen = new Set(['5,6']); let path: Direction[] | undefined;
  for (let i = 0; i < queue.length; i++) {
    const [x, y, previous] = queue[i];
    if (x === 37 && y === 32 && !path) path = previous;
    for (const [d, dx, dy] of directions) {
      const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
      const a = host.gameMap.getTileAt(x * 2, y * 2 + 1), b = host.gameMap.getTileAt(nx * 2, ny * 2 + 1);
      if ((a === 5 && [0x20, 0x41, 0x2a, 0x21].includes(b)) || (b === 5 && [0x20, 0x41, 0x2a, 0x21].includes(a))) continue;
      if (nx < 0 || nx >= 40 || ny < 0 || ny >= 36) {
        expect(host.gameMap.isWalkable(nx * 2, ny * 2), `reachable edge ${nx},${ny}`).toBe(false); continue;
      }
      if (seen.has(key)) continue;
      if (!host.gameMap.isWalkable(nx * 2, ny * 2) || host.gameMap.getWarpAt(nx * 2, ny * 2)) continue;
      seen.add(key); queue.push([nx, ny, [...previous, d]]);
    }
  }
  expect(path).toBeDefined(); expect(path!.length).toBeGreaterThan(32);
  for (const d of path!) { await step(d); expect(host.gameMap.mapData?.name).toBe('DiglettsCave'); }
  expect([host.player.mapStepX, host.player.mapStepY]).toEqual([37, 32]);
  await step('up'); expect(host.gameMap.mapData?.name).toBe('DiglettsCaveRoute11');
});

it('talks to the gambler through the real DisplayTextID program binding', async () => {
  await world('DiglettsCaveRoute11', 2, 4); host.player.direction = 'up';
  const display = vi.spyOn(main.textBox, 'show');
  until(() => host.state === 'textbox', () => ['a'], 10);
  expect(display).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ program: 'DiglettsCaveRoute11GamblerText' }));
  expect(host.overworldDeps().npcs[0].data.sprite).toBe('gambler');
});

it.each([0x20, 0x41, 0x2a, 0x21].flatMap(tile => [[tile, 5], [5, tile]]))(
  'blocks the cartridge CAVERN land pair %i to %i through real player input', async (from, to) => {
    await world('DiglettsCave', 5, 6); host.player.direction = 'down'; host.pikachuFollower.visible = false;
    vi.spyOn(host.gameMap, 'getTileAt').mockImplementation((x, y) => x === 10 && y === 13 ? from : to);
    for (let n = 0; n < 40; n++) tick(['down']);
    expect([host.player.mapStepX, host.player.mapStepY]).toEqual([5, 6]);
    expect(host.player.isMoving).toBe(false);
  },
);

it('does not apply CAVERN land pairs to a different tileset', async () => {
  await world('DiglettsCave', 5, 6); host.player.direction = 'down'; host.pikachuFollower.visible = false;
  // Retain walkability but isolate the tileset gate; FOREST has its own deferred pair table.
  host.gameMap.mapData = { ...host.gameMap.mapData!, tileset: 'FOREST' };
  vi.spyOn(host.gameMap, 'getTileAt').mockImplementation((x, y) => x === 10 && y === 13 ? 0x20 : 5);
  for (let n = 0; n < 32; n++) {
    tick(['down']);
    if (!host.player.isBusy && host.player.mapStepY !== 6) break;
  }
  expect([host.player.mapStepX, host.player.mapStepY]).toEqual([5, 7]);
});

it('a cave turn starts an actual level-18 Diglett battle through main', async () => {
  await world('DiglettsCave', 5, 6); host.player.direction = 'left'; pinOverworldRandom(0);
  until(() => host.state === 'battle', () => ['down']);
  expect(POKEDEX_ORDER[host.session!.state.mem[A.wEnemyMonSpecies] - 1]).toBe(50);
  expect(host.session!.state.mem[A.wEnemyMonLevel]).toBe(18);
});

it('reads all ten cartridge encounter slots and the rate boundary, without encounters in either entrance', async () => {
  const context = { inGrass: false, inWater: false, indoor: true, forest: false,
    controlled: false, movementBlocked: false, onDoorOrWarp: false, outsideMap: false, cooldown: 0, disabled: false };
  await loadWildEncounters('DiglettsCave');
  const rolls = [0, 51, 102, 141, 166, 191, 216, 229, 242, 253];
  const levels = [18, 19, 17, 20, 16, 15, 21, 22, 29, 31];
  for (let i = 0; i < rolls.length; i++) {
    installOverworldRandom({ hRandomAdd: 19, hRandomSub: rolls[i], carry: 0, random: () => 0 });
    const mon = tryWildEncounter(context)!;
    expect([mon.species.id, mon.level]).toEqual([i < 8 ? 50 : 51, levels[i]]);
  }
  installOverworldRandom({ hRandomAdd: 20, hRandomSub: 0, carry: 0, random: () => 0 });
  expect(tryWildEncounter(context)).toBeNull();
  for (const name of ['DiglettsCaveRoute2', 'DiglettsCaveRoute11']) {
    await loadWildEncounters(name); pinOverworldRandom(0); expect(tryWildEncounter(context)).toBeNull();
  }
});

it.each([2, 3])('failed Route11 outside exit at x=%i preserves the source map/palette/NPCs and permits walking back', async x => {
  await world('DiglettsCaveRoute11', x, 6); host.player.direction = 'down';
  const oldMap = host.gameMap.mapData, oldTiles = host.gameMap.tileset, oldNpcs = host.overworldDeps().npcs;
  const borderPalettes: string[] = [], reload = text.reloadBorderTiles;
  const border = vi.spyOn(text, 'reloadBorderTiles').mockImplementation(async () => {
    borderPalettes.push(getActivePalette());
    await reload();
  });
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  await step('down');
  // Door mat is a non-instant warp: pressing into the boundary invokes CheckWarpsCollision.
  for (let n = 0; n < 50 && !warning.mock.calls.length; n++) { tick(['down']); if (host.state === 'transition') await settle(); }
  expect(warning).toHaveBeenCalledWith('Map "Route11" not found, staying on current map');
  expect(host.state).toBe('overworld'); expect(host.gameMap.mapData).toBe(oldMap);
  expect(host.gameMap.tileset).toBe(oldTiles); expect(host.overworldDeps().npcs).toBe(oldNpcs);
  expect(getActivePalette()).toBe('CAVE'); expect(host.fade).toBe(0);
  expect(border).toHaveBeenCalledTimes(2); // destination attempt, then source-palette restoration
  expect(borderPalettes).toEqual(['ROUTE', 'CAVE']); // reload must use the restored palette
  expect([host.player.mapStepX, host.player.mapStepY]).toEqual([x, 7]);
  expect(host.pikachuFollower.visible).toBe(true);
  await step('up'); expect([host.player.mapStepX, host.player.mapStepY]).toEqual([x, 6]);
});

it.each(['DiglettsCave', 'DiglettsCaveRoute11'])('saves and continues %s at the saved position with palette, party and map data', async name => {
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
  await world(name, name === 'DiglettsCave' ? 5 : 4, 6); host.player.direction = 'left';
  main.writeSave(); const saved: SaveData = JSON.parse(storage.get('p151-s')!);
  expect(saved.mapName).toBe(name);
  host.player.x = 0; host.player.y = 0; host.playerParty.splice(0);
  await main.loadSavedGame();
  expect([host.player.x, host.player.y, host.player.direction]).toEqual([saved.playerX, saved.playerY, 'left']);
  expect(getActivePalette()).toBe('CAVE'); expect(host.gameMap.mapData?.name).toBe(name);
  expect(host.playerParty[0].species.id).toBe(25); expect(host.pikachuFollower.visible).toBe(true);
});

it('provides both debug entries at their real ladder indices without a Route11 exterior entry', () => {
  const source = readFileSync('src/debug.ts', 'utf8');
  expect(source).toContain('map: \'DiglettsCave\', warpId: 0');
  expect(source).toContain('map: \'DiglettsCaveRoute11\', warpId: 2');
  expect(source).not.toMatch(/map: ['"]Route11['"]/);
});
