// ItemUseEscapeRope and EscapeRopeTilesets (pret engine/items/item_effects.asm).
const ALLOWED_TILESETS = new Set(['FOREST', 'CEMETERY', 'CAVERN', 'FACILITY', 'INTERIOR']);
const EXCLUDED_MAPS = new Set(['AgathasRoom', 'BillsHouse', 'PokemonFanClub']);

export interface EscapeRopeLocation { mapName: string; tileset: string; inBattle?: boolean }

export function canUseEscapeRope(location: EscapeRopeLocation): boolean {
  return !location.inBattle && !EXCLUDED_MAPS.has(location.mapName) && ALLOWED_TILESETS.has(location.tileset);
}

/** FlyWarpData selects by map, regardless of the saved door index. */
export function escapeRopeDestination(
  last: { destMap: string; destWarpId: number },
): { destMap: string; stepPos: { x: number; y: number } } | null {
  const rows: Record<string, { x: number; y: number }> = {
    PalletTown: { x: 5, y: 6 }, ViridianCity: { x: 23, y: 26 }, PewterCity: { x: 13, y: 26 },
  };
  const stepPos = rows[last.destMap];
  return stepPos ? { destMap: last.destMap, stepPos } : null;
}
