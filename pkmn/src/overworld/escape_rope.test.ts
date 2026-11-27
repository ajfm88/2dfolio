import { describe, expect, it } from 'vitest';
import { canUseEscapeRope, escapeRopeDestination } from './escape_rope';

describe('ItemUseEscapeRope', () => {
  it.each(['FOREST', 'CEMETERY', 'CAVERN', 'FACILITY', 'INTERIOR'])('allows %s', tileset => {
    expect(canUseEscapeRope({ mapName: 'Example', tileset })).toBe(true);
  });
  it.each(['OVERWORLD', 'REDS_HOUSE_1', 'MART', 'REDS_HOUSE_2', 'DOJO', 'POKECENTER', 'GYM', 'HOUSE',
    'FOREST_GATE', 'MUSEUM', 'UNDERGROUND', 'GATE', 'SHIP', 'SHIP_PORT', 'LOBBY', 'MANSION', 'LAB',
    'CLUB', 'PLATEAU', 'BEACH_HOUSE', 'UNKNOWN'])('rejects %s', tileset => {
    expect(canUseEscapeRope({ mapName: 'Example', tileset })).toBe(false);
  });
  it.each(['AgathasRoom', 'BillsHouse', 'PokemonFanClub'])('rejects %s regardless of permitted tileset', mapName => {
    expect(canUseEscapeRope({ mapName, tileset: 'INTERIOR' })).toBe(false);
  });
  it('rejects battle', () => expect(canUseEscapeRope({ mapName: 'Example', tileset: 'FOREST', inBattle: true })).toBe(false));
});

describe('Escape Rope destination', () => {
  it.each([['PalletTown', 0, 5, 6], ['ViridianCity', 0, 23, 26], ['PewterCity', 6, 13, 26]] as const)(
    '%s warp %i matches FlyWarpData', (destMap, destWarpId, x, y) => {
      expect(escapeRopeDestination({ destMap, destWarpId })).toEqual({ destMap, stepPos: { x, y } });
    });
  it('uses the map row even for legacy Pewter saves with warp index zero', () => {
    expect(escapeRopeDestination({ destMap: 'PewterCity', destWarpId: 0 })).toEqual({ destMap: 'PewterCity', stepPos: { x: 13, y: 26 } });
  });
  it('rejects a destination without a supported row', () => expect(escapeRopeDestination({ destMap: 'Unknown', destWarpId: 0 })).toBeNull());
});
