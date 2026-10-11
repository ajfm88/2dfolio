import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WHIRLWIND_DEST_ROOMS,
  WHIRLWIND_DEST_YS,
  WHIRLWIND_DROP_X,
  DEFAULT_WALKABILITY_THRESHOLD,
  TILE_SIZE,
  PLAY_AREA_HEIGHT,
  nesScreenYToPlayArea,
} from '../../../src/core/constants.js';

interface Screen { id: number; tiles: number[][] }
const overworld = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../src/data/overworld.json'), 'utf-8'),
) as { screens: Screen[]; squareTable: { primary: number[] } };

const screens = new Map(overworld.screens.map((s) => [s.id, s]));
const primary = overworld.squareTable.primary;

/** Link's whole 16×16 footprint has to clear the tile map. */
function footprintWalkable(screen: Screen, x: number, y: number): boolean {
  for (const [px, py] of [
    [x, y], [x + TILE_SIZE - 1, y],
    [x, y + TILE_SIZE - 1], [x + TILE_SIZE - 1, y + TILE_SIZE - 1],
  ] as const) {
    if (py < 0 || py >= PLAY_AREA_HEIGHT) return false;
    const tile = screen.tiles[Math.floor(py / TILE_SIZE)]?.[Math.floor(px / TILE_SIZE)];
    if (tile === undefined) return false;
    if (!((primary[tile] ?? 0xff) < DEFAULT_WALKABILITY_THRESHOLD)) return false;
  }
  return true;
}

describe('whirlwind destinations', () => {
  // The flute drops Link at WHIRLWIND_DROP_X on the destination screen. The ROM
  // Y values are NES screen coordinates; used without converting to play-area
  // space, five of these eight land inside a mountain and Link cannot move.
  it('drops Link on walkable ground on every destination screen', () => {
    const stuck: string[] = [];
    for (let i = 0; i < WHIRLWIND_DEST_ROOMS.length; i++) {
      const screen = screens.get(WHIRLWIND_DEST_ROOMS[i]!);
      expect(screen, `screen 0x${WHIRLWIND_DEST_ROOMS[i]!.toString(16)} missing`).toBeDefined();
      const y = nesScreenYToPlayArea(WHIRLWIND_DEST_YS[i]!);
      if (!footprintWalkable(screen!, WHIRLWIND_DROP_X, y)) {
        stuck.push(`dest ${i} (screen 0x${WHIRLWIND_DEST_ROOMS[i]!.toString(16)}, y=${y})`);
      }
    }
    expect(stuck).toEqual([]);
  });

  it('lands every destination on the tile grid', () => {
    for (const nesY of WHIRLWIND_DEST_YS) {
      expect(nesScreenYToPlayArea(nesY) % TILE_SIZE).toBe(0);
    }
  });
});
