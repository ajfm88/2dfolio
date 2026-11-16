// V5d checkpoint-01 (note 94): TilePairCollisionsLand as one table, the cartridge routine run over the ROM's
// bytes, and the FOREST rows through real player input.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { host, loadMainBattleRig, resetMainBattleRig, world, tick } from '../test/main_battle_rig';
import { pinOverworldRandom } from '../test/overworld_random_pin';
import { TILE_PAIR_COLLISIONS_LAND, landTilePairCollision } from './tile_pair_collision';

// constants/tileset_constants.asm, in id order.
const TILESETS = ['OVERWORLD', 'REDS_HOUSE_1', 'MART', 'FOREST', 'REDS_HOUSE_2', 'DOJO', 'POKECENTER', 'GYM', 'HOUSE',
  'FOREST_GATE', 'MUSEUM', 'UNDERGROUND', 'GATE', 'SHIP', 'SHIP_PORT', 'CEMETERY', 'INTERIOR', 'CAVERN', 'LOBBY',
  'MANSION', 'LAB', 'CLUB', 'FACILITY', 'PLATEAU', 'BEACH_HOUSE'];
// data/tilesets/pair_collision_tile_ids.asm, typed from the source: land rows, then the terminator.
const LAND_BYTES = '11 20 05 11 41 05 03 30 2e 11 2a 05 11 05 21 03 52 2e 03 55 2e 03 56 2e 03 20 2e 03 5e 2e 03 5f 2e ff';
const WATER_BYTES = '03 14 2e 03 48 2e 11 14 05 ff';
const hex = (bytes: Iterable<number>) => [...bytes].map(b => b.toString(16).padStart(2, '0')).join(' ');
const FOREST_FIRST = [0x30, 0x52, 0x55, 0x56, 0x20, 0x5e, 0x5f];
const CAVERN_ROWS = [[0x20, 0x05], [0x41, 0x05], [0x2a, 0x05], [0x05, 0x21]];

describe('TilePairCollisionsLand', () => {
  it('holds the eleven rows in ROM order', () => {
    expect(hex(TILE_PAIR_COLLISIONS_LAND.flatMap(([tileset, a, b]) => [TILESETS.indexOf(tileset), a, b])) + ' ff').toBe(LAND_BYTES);
  });

  it.each(FOREST_FIRST)('FOREST $%i and $2E block in both directions', tile => {
    expect(landTilePairCollision('FOREST', tile, 0x2e)).toBe(true);
    expect(landTilePairCollision('FOREST', 0x2e, tile)).toBe(true);
  });

  it.each(CAVERN_ROWS)('CAVERN $%i and $%i block in both directions', (a, b) => {
    expect(landTilePairCollision('CAVERN', a, b)).toBe(true);
    expect(landTilePairCollision('CAVERN', b, a)).toBe(true);
  });

  it('a row belongs to its own tileset only', () => {
    for (const tile of FOREST_FIRST) expect(landTilePairCollision('CAVERN', tile, 0x2e)).toBe(false);
    for (const [a, b] of CAVERN_ROWS) expect(landTilePairCollision('FOREST', a, b)).toBe(false);
    expect(landTilePairCollision('OVERWORLD', 0x20, 0x2e)).toBe(false);
    expect(landTilePairCollision(undefined, 0x20, 0x05)).toBe(false);
  });

  it('blocks exactly 14 FOREST and 8 CAVERN ordered pairs, and none on any other tileset', () => {
    const count = (tileset: string) => {
      let n = 0;
      for (let s = 0; s < 256; s++) for (let f = 0; f < 256; f++) if (landTilePairCollision(tileset, s, f)) n++;
      return n;
    };
    expect(TILESETS.map(count).filter(n => n > 0)).toEqual([14, 8]);
    expect([count('FOREST'), count('CAVERN')]).toEqual([14, 8]);
  });

  it('never blocks a tile against itself or two first tiles against each other', () => {
    expect(landTilePairCollision('FOREST', 0x2e, 0x2e)).toBe(false);
    expect(landTilePairCollision('FOREST', 0x20, 0x30)).toBe(false);
    expect(landTilePairCollision('CAVERN', 0x05, 0x05)).toBe(false);
    expect(landTilePairCollision('CAVERN', 0x20, 0x21)).toBe(false);
  });
});

// Addresses from pret origin/symbols:pokeyellow.sym at b452f2ab: TilePairCollisionsLand 00:0ada,
// TilePairCollisionsWater 00:0afc, LoadCurrentMapView 00:0b06.
describe.skipIf(!process.env.ROM_PATH)('CheckForTilePairCollisions over the ROM', () => {
  const LAND = 0x0ada, WATER = 0x0afc, CODE = 0x0b06;
  let rom: Uint8Array;
  beforeAll(() => { rom = readFileSync(resolve(process.env.ROM_PATH!)); });

  /** home/overworld.asm CheckForTilePairCollisions, instruction for instruction; hl starts at the land table. */
  function routine(tileset: number, standing: number, front: number): { carry: boolean; last: number } {
    let hl = LAND, last = LAND;
    const read = (address: number) => { last = Math.max(last, address); return rom[address]; };
    for (let guard = 0; guard < 4096; guard++) {
      const a = read(hl++);                       // ld a, [hli]
      if (a === 0xff) return { carry: false, last }; // .noMatch
      if (a !== tileset) { hl += 2; continue; }   // inc hl / .retry inc hl
      if (read(hl) === standing) {                // .currentTileMatchesFirstInPair
        hl++;
        if (read(hl) === front) return { carry: true, last };
        continue;                                 // jr .tilePairCollisionLoop with hl on the second tile
      }
      hl++;
      if (read(hl) === standing) {                // .currentTileMatchesSecondInPair
        hl--;
        const match = read(hl++) === front;
        hl++;
        if (match) return { carry: true, last };
        continue;
      }
      hl++;                                       // .retry
    }
    throw new Error('CheckForTilePairCollisions did not end');
  }

  it('the two tables sit at their symbols, back to back, and code follows', () => {
    expect(hex(rom.subarray(LAND, WATER))).toBe(LAND_BYTES);
    expect(hex(rom.subarray(WATER, CODE))).toBe(WATER_BYTES);
    expect(hex(rom.subarray(CODE, CODE + 3))).toBe('f0 b8 f5'); // ldh a, [hLoadedROMBank] / push af
  });

  it('answers as the symmetric table for every tileset and every pair of tiles', () => {
    const wrong: string[] = [];
    for (let id = 0; id < TILESETS.length; id++) {
      for (let s = 0; s < 256; s++) for (let f = 0; f < 256; f++) {
        if (routine(id, s, f).carry !== landTilePairCollision(TILESETS[id], s, f)) wrong.push(`${TILESETS[id]} ${s} ${f}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('slips one byte after a first-tile miss and scans the code to the $ff at 00:0b84', () => {
    // FOREST grass to grass: row 9's first tile matches, its second doesn't.
    expect(routine(3, 0x20, 0x20)).toEqual({ carry: false, last: 0x0b84 });
    // The cave floor to itself: row 5 (CAVERN, $05, $21).
    expect(routine(0x11, 0x05, 0x05)).toEqual({ carry: false, last: 0x0b84 });
    expect(rom[0x0b84]).toBe(0xff);
    // The slipped scan reads CAVERN's id as a tileset at 00:0b63; the two bytes after it are no cave tile pair.
    expect(rom[0x0b63]).toBe(0x11);
    // Without a first-tile match the scan stays aligned and ends at the land terminator.
    expect(routine(3, 0x2e, 0x00)).toEqual({ carry: false, last: WATER - 1 });
    expect(routine(0, 0x20, 0x05)).toEqual({ carry: false, last: WATER - 1 });
  });
});

describe('FOREST land pairs through the player', () => {
  beforeAll(() => loadMainBattleRig());
  beforeEach(() => { resetMainBattleRig(); pinOverworldRandom(255); });
  afterEach(() => vi.restoreAllMocks());

  // The player stands on step (16,45): its bottom-left tile is (32,91), the one a step below it (32,93).
  const pressDownFrom = (from: number, to: number) => pressDownOver((x, y) => x === 32 && y === 91 ? from : to);
  async function pressDownOver(tileAt: (x: number, y: number) => number): Promise<[number, number]> {
    await world('ViridianForest', 16, 45); host.player.direction = 'down'; host.pikachuFollower.visible = false;
    vi.spyOn(host.gameMap, 'getTileAt').mockImplementation(tileAt);
    for (let n = 0; n < 40; n++) {
      tick(['down']);
      if (!host.player.isBusy && host.player.mapStepY !== 45) break;
    }
    return [host.player.mapStepX, host.player.mapStepY];
  }

  // $55 and $56 are not passable, so only the step off them shows the pair.
  it.each([
    ...FOREST_FIRST.map(tile => [tile, 0x2e]),
    ...[0x30, 0x52, 0x20, 0x5e, 0x5f].map(tile => [0x2e, tile]),
  ])('blocks the step from $%i to $%i', async (from, to) => {
    expect(await pressDownFrom(from, to)).toEqual([16, 45]);
    expect(host.player.isMoving).toBe(false);
  });

  it.each([[0x20, 0x30], [0x2e, 0x2e], [0x05, 0x20], [0x2e, 0x1e]])('walks from $%i to $%i', async (from, to) => {
    expect(await pressDownFrom(from, to)).toEqual([16, 46]);
  });

  it('compares the bottom-left tile stood on with the bottom-left tile one step ahead', async () => {
    const grassAt = (gx: number, gy: number) => (x: number, y: number) =>
      x === 32 && y === 91 ? 0x2e : x === gx && y === gy ? 0x20 : 0x1e;
    expect(await pressDownOver(grassAt(32, 93))).toEqual([16, 45]);
    for (const [gx, gy] of [[32, 92], [33, 93], [32, 94], [33, 92]]) expect(await pressDownOver(grassAt(gx, gy))).toEqual([16, 46]);
    const standingAt = (sx: number, sy: number) => (x: number, y: number) =>
      x === sx && y === sy ? 0x2e : x === 32 && y === 93 ? 0x20 : 0x1e;
    expect(await pressDownOver(standingAt(32, 91))).toEqual([16, 45]);
    for (const [sx, sy] of [[32, 90], [33, 91], [33, 90]]) expect(await pressDownOver(standingAt(sx, sy))).toEqual([16, 46]);
  });

  it('Viridian Forest holds no $2E tile, in its blocks or its border, so no row fires there', async () => {
    await world('ViridianForest', 16, 45);
    const map = host.gameMap, found: string[] = [];
    expect(map.mapData?.tileset).toBe('FOREST');
    for (let ty = -12; ty < map.heightTiles + 12; ty++) for (let tx = -12; tx < map.widthTiles + 12; tx++) {
      if (map.getTileAt(tx, ty) === 0x2e) found.push(`${tx},${ty}`);
    }
    expect(found).toEqual([]);
  });
});
