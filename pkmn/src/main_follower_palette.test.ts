import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { host, loadMainBattleRig, resetMainBattleRig, world, mon } from './test/main_battle_rig';
import { captureNative } from './renderer/renderer';
import { RasterCanvas } from './test/raster_canvas';
import { CGB_PALETTES } from './renderer/palettes';
import { uiTiles } from './renderer/ui_tiles';

// Existing Vitest-only main accessors; production exports and the battle rig stay unchanged.
const main = host as typeof host & {
  connectToMap(name: string, direction: 'north', offset: number): Promise<void>;
  writeSave(): void;
  loadSavedGame(): Promise<void>;
  startNewGame(): Promise<void>;
};
beforeAll(() => loadMainBattleRig());
beforeEach(() => {
  resetMainBattleRig();
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
  });
});
afterEach(() => { host.reset(); vi.restoreAllMocks(); });

function colours(draw: () => void): string[] {
  const canvas = captureNative(draw) as unknown as RasterCanvas;
  const result = new Set<string>();
  for (let i = 0; i < canvas.pixels.length; i += 4) {
    if (canvas.pixels[i + 3]) result.add([...canvas.pixels.slice(i, i + 3)].join(','));
  }
  return [...result].sort();
}
function expectDrawnPalette(palette: 'ROUTE' | 'PEWTER' | 'PALLET'): void {
  uiTiles.clear();
  // Warps may deliberately hide an overlapping follower. Latch a standing image to
  // examine the loaded colours without depending on the unrelated follow animation.
  expect(host.pikachuFollower.visible).toBe(true);
  host.pikachuFollower.showStandingImage('up');
  expect(host.pikachuFollower.imageVisible).toBe(true);
  const expected = [0, 1, 3].map(i => CGB_PALETTES[palette][i].join(',')).sort();
  // Capture actual public render calls independently: no map pixels, overlap, or private sheets.
  const player = colours(() => host.player.render(host.player.x - 64, host.player.y - 60));
  const follower = colours(() => host.pikachuFollower.render(
    host.pikachuFollower.x - 64, host.pikachuFollower.y - 60));
  expect(player).toEqual(expected);
  expect(follower).toEqual(expected);
  expect(follower).toEqual(player);
}

it('real main connection Route 2 → Pewter replaces green follower pixels with the player palette', async () => {
  await world('Route2', 4, 1);
  expectDrawnPalette('ROUTE');
  const connection = host.gameMap.getConnection('north')!;
  expect(connection.mapName).toBe('PewterCity');
  await main.connectToMap(connection.mapName, 'north', connection.offset);
  expect(host.gameMap.mapData?.name).toBe('PewterCity');
  expectDrawnPalette('PEWTER');
});

it('real main warp Pewter → Pewter Pokécenter reloads both sheets and draws destination colours', async () => {
  await world('PewterCity', 10, 10);
  expectDrawnPalette('PEWTER');
  const reload = vi.spyOn(host.pikachuFollower, 'loadSprite');
  await host.handleWarpLoad('PewterPokecenter', 0);
  await host.finishFade();
  expect(host.gameMap.mapData?.name).toBe('PewterPokecenter');
  expect(reload).toHaveBeenCalledTimes(1);
  expectDrawnPalette('PEWTER');
});

it('real main CONTINUE in Pewter replaces the previously loaded route palette', async () => {
  await world('PewterCity', 10, 10);
  main.writeSave();
  // Keep the saved location; imitate the route-tinted sheets left by initial boot.
  await world('Route2', 4, 1, []);
  expectDrawnPalette('ROUTE');
  await main.loadSavedGame();
  expect(host.gameMap.mapData?.name).toBe('PewterCity');
  expectDrawnPalette('PEWTER');
});

it('real main NEW GAME reloads the follower under the starting map palette', async () => {
  await world('Route2', 4, 1);
  expectDrawnPalette('ROUTE');
  const reload = vi.spyOn(host.pikachuFollower, 'loadSprite');
  await main.startNewGame();
  expect(host.gameMap.mapData?.name).toBe('RedsHouse2F');
  expect(reload).toHaveBeenCalledTimes(1);
  // NEW GAME has no starter yet. Stage eligibility/placement only, preserving its loaded sheets.
  host.playerParty.push(mon());
  host.pikachuFollower.visible = true;
  host.pikachuFollower.spawn(host.player.x, host.player.y, host.player.direction);
  expectDrawnPalette('PALLET');
});
