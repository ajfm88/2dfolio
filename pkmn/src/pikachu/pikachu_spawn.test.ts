// Pikachu's spawn states after a warp — expected values from
// engine/pikachu/pikachu_follow.asm and home/overworld.asm WarpFound2
// (the transition table in notes/03-v1b-plan.md §1.4).

import { describe, it, expect } from 'vitest';
import type { Direction } from '../core';
import { warpSpawnState, spawnPlacement, isOutsideTileset, CONNECTION_SPAWN_STATE } from './pikachu_spawn';

// Map → tileset, as in the extracted map JSON
const TILESET: Record<string, string> = {
  PalletTown: 'OVERWORLD', ViridianCity: 'OVERWORLD', Route2: 'OVERWORLD',
  Route4: 'OVERWORLD', Route7: 'OVERWORLD', Route22: 'OVERWORLD',
  OaksLab: 'LAB', ViridianPokecenter: 'POKECENTER', RedsHouse1F: 'REDS_HOUSE_1', RedsHouse2F: 'REDS_HOUSE_2',
  Route2Gate: 'GATE', Route22Gate: 'GATE', Route7Gate: 'GATE', Route2TradeHouse: 'HOUSE',
  DiglettsCaveRoute2: 'CAVERN', MtMoonB1F: 'CAVERN',
  ViridianForest: 'FOREST', ViridianForestSouthGate: 'FOREST_GATE', ViridianForestNorthGate: 'FOREST_GATE',
  SafariZoneEast: 'FOREST', SafariZoneEastRestHouse: 'GATE',
};

const state = (from: string, to: string, facing: Direction) =>
  warpSpawnState(from, TILESET[from], to, TILESET[to], facing);

describe('warpSpawnState', () => {
  it('V1: through the Forest and its gates', () => {
    expect(state('Route2', 'ViridianForestSouthGate', 'up')).toBe(1);        // Outside, not listed
    expect(state('ViridianForestSouthGate', 'ViridianForest', 'up')).toBe(1); // WarpPad, listed
    expect(state('ViridianForest', 'ViridianForestNorthGate', 'up')).toBe(1); // WarpPad, leaving northward
    expect(state('ViridianForestNorthGate', 'Route2', 'up')).toBe(3);        // BackOutside
    // ...and back south
    expect(state('Route2', 'ViridianForestNorthGate', 'down')).toBe(3);      // Outside, listed, facing down
    expect(state('ViridianForestNorthGate', 'ViridianForest', 'down')).toBe(1);
    expect(state('ViridianForest', 'ViridianForestSouthGate', 'down')).toBe(0);
    expect(state('ViridianForestSouthGate', 'Route2', 'down')).toBe(3);
  });

  it('V1: Route2Gate depends on the facing, both ways', () => {
    expect(state('Route2', 'Route2Gate', 'up')).toBe(1);     // south door
    expect(state('Route2', 'Route2Gate', 'down')).toBe(3);   // north side
    expect(state('Route2Gate', 'Route2', 'up')).toBe(1);     // leaving northward
    expect(state('Route2Gate', 'Route2', 'down')).toBe(3);   // leaving southward
  });

  it("V1: Route 2's houses", () => {
    expect(state('Route2', 'Route2TradeHouse', 'up')).toBe(1);
    expect(state('Route2TradeHouse', 'Route2', 'down')).toBe(3);
    expect(state('Route2', 'DiglettsCaveRoute2', 'up')).toBe(1);
    expect(state('DiglettsCaveRoute2', 'Route2', 'down')).toBe(3);
  });

  it('keeps the spawns the existing maps already had', () => {
    expect(state('PalletTown', 'OaksLab', 'up')).toBe(6);                   // left of the player
    expect(state('ViridianCity', 'ViridianPokecenter', 'up')).toBe(1);      // right
    expect(state('ViridianPokecenter', 'ViridianCity', 'down')).toBe(3);    // on the player, door step
    expect(state('RedsHouse2F', 'RedsHouse1F', 'left')).toBe(0);            // stairs: on the player
    expect(state('RedsHouse1F', 'RedsHouse2F', 'up')).toBe(0);
  });

  it('picks the setter by tileset (the Forest is not outside)', () => {
    // FOREST → FOREST_GATE is indoor → indoor (WarpPad), not "back outside"
    expect(state('ViridianForest', 'ViridianForestSouthGate', 'up')).toBe(1);
    expect(isOutsideTileset('OVERWORLD')).toBe(true);
    expect(isOutsideTileset('PLATEAU')).toBe(true);
    expect(isOutsideTileset('FOREST')).toBe(false);
    expect(isOutsideTileset('GATE')).toBe(false);
  });

  it('carries the rest of the ASM lists for later maps', () => {
    expect(state('Route22', 'Route22Gate', 'down')).toBe(3);
    expect(state('Route22', 'Route22Gate', 'up')).toBe(1);
    expect(state('Route22Gate', 'Route22', 'up')).toBe(1);
    expect(state('Route4', 'MtMoonB1F', 'up')).toBe(3);
    expect(state('Route7', 'Route7Gate', 'right')).toBe(4);                // below the player
    expect(state('SafariZoneEast', 'SafariZoneEastRestHouse', 'up')).toBe(1); // WarpPad list
  });
});

describe('spawnPlacement', () => {
  it('states 0 and 3 put Pikachu on the player; 3 faces down', () => {
    expect(spawnPlacement(0, 'left')).toEqual({ dx: 0, dy: 0, facing: 'left' });
    expect(spawnPlacement(3, 'up')).toEqual({ dx: 0, dy: 0, facing: 'down' });
  });

  it('states 1, 4, 5 and 6 are fixed offsets', () => {
    expect(spawnPlacement(1, 'up')).toEqual({ dx: 1, dy: 0, facing: 'up' });     // right
    expect(spawnPlacement(4, 'left')).toEqual({ dx: 0, dy: 1, facing: 'left' }); // below
    expect(spawnPlacement(5, 'up')).toEqual({ dx: 0, dy: -1, facing: 'down' });  // above, facing the player
    expect(spawnPlacement(6, 'up')).toEqual({ dx: -1, dy: 0, facing: 'up' });    // left
  });

  it('state 2 (map connections) is one step behind, facing the way the player faces', () => {
    const behind: Record<Direction, { dx: number; dy: number }> = {
      up: { dx: 0, dy: 1 }, down: { dx: 0, dy: -1 }, left: { dx: 1, dy: 0 }, right: { dx: -1, dy: 0 },
    };
    for (const facing of ['up', 'down', 'left', 'right'] as Direction[]) {
      expect(spawnPlacement(CONNECTION_SPAWN_STATE, facing)).toEqual({ ...behind[facing], facing });
    }
  });

  it('state 7 is in front of the player, facing back at them', () => {
    expect(spawnPlacement(7, 'up')).toEqual({ dx: 0, dy: -1, facing: 'down' });
    expect(spawnPlacement(7, 'right')).toEqual({ dx: 1, dy: 0, facing: 'left' });
  });
});
