// V5g3 checkpoint-01 (note 106): PlayMapChangeSound picks the door sound from the tile under the player.
import { describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
vi.mock('../renderer', async original => ({ ...await original<typeof import('../renderer')>(),
  getActivePalette: () => 'PALLET', loadTileset: async () => ({ width: 128 }), loadTilesetTransparent: async () => ({ width: 128 }),
  loadSpriteMapped: async () => ({ width: 8, height: 16 }) }));
import { GameMap } from './map';
import { mapChangeSound } from './map_change_sound';

describe('PlayMapChangeSound (home/overworld.asm:665–683)', () => {
  it('only tile $0B is a door, and never in FACILITY or CEMETERY', () => {
    expect(mapChangeSound('OVERWORLD', 0x0b)).toBe('go_inside');
    expect(mapChangeSound('HOUSE', 0x0b)).toBe('go_inside'); // the tileset is not checked otherwise
    for (const tile of [0x0a, 0x0c, 0x1b, 0x2c, 0x00]) expect(mapChangeSound('OVERWORLD', tile)).toBe('go_outside');
    expect(mapChangeSound('FACILITY', 0x0b)).toBe('go_outside');
    expect(mapChangeSound('CEMETERY', 0x0b)).toBe('go_outside');
  });

  it('every committed warp: 19 doors play GO_INSIDE; stairs, gates, ladders and the rest play GO_OUTSIDE', async () => {
    const dir = resolve(__dirname, '../../data/maps');
    const names = readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5))
      .filter(name => Array.isArray((JSON.parse(readFileSync(resolve(dir, `${name}.json`), 'utf8')) as { warps?: unknown }).warps));
    const sounds = new Map<string, string>();
    for (const name of names) {
      const map = new GameMap(); await map.load(name);
      map.mapData!.warps.forEach((warp, index) => {
        sounds.set(`${name}:${index}`, mapChangeSound(map.mapData!.tileset, map.getTileAt(2 * warp.x, 2 * warp.y)));
      });
    }
    expect(sounds.size).toBe(83);
    expect([...sounds.values()].filter(sound => sound === 'go_inside')).toHaveLength(19);
    for (const key of ['PalletTown:0', 'PalletTown:1', 'ViridianCity:0', 'PewterCity:0'])
      expect(sounds.get(key), key).toBe('go_inside');
    // The 18 warps the destination-name guess played as GO_INSIDE (discovery/door-sound-probe.txt).
    for (const key of ['RedsHouse1F:2', 'RedsHouse2F:0', 'Museum1F:4', 'Museum2F:0', 'Route2:0', 'Route2:1', 'Route2:3',
      'Route2:6', 'ViridianForest:0', 'ViridianForest:1', 'ViridianForest:2', 'ViridianForest:3', 'ViridianForest:4',
      'ViridianForest:5', 'DiglettsCave:0', 'DiglettsCave:1', 'DiglettsCaveRoute2:2', 'DiglettsCaveRoute11:2'])
      expect(sounds.get(key), key).toBe('go_outside');
  });
});
