// CGB (Game Boy Color) palette data
// Extracted from data/sgb/sgb_palettes.asm — CGBBasePalettes section
// Each palette has 4 colors: [lightest, light, dark, darkest]

type Rgb = [number, number, number];
type Palette = [Rgb, Rgb, Rgb, Rgb];

/** Apply GBC LCD color correction to RGB555 triplet.
 *  Real GBC hardware shifts colors due to LCD response characteristics.
 *  This approximates the color output of actual hardware. */
function gbcCorrect(r5: number, g5: number, b5: number): Rgb {
  // Cross-channel blending (GBC LCD mixes color channels)
  const r = r5 * 26 + g5 * 4 + b5 * 2;
  const g = g5 * 24 + b5 * 8;
  const b = r5 * 6 + g5 * 4 + b5 * 22;
  // Max value = 31*32 = 992; scale to 0-255
  return [
    Math.min(255, Math.round(r * 255 / 992)),
    Math.min(255, Math.round(g * 255 / 992)),
    Math.min(255, Math.round(b * 255 / 992)),
  ];
}

/** Build a palette from four RGB555 triplets with GBC LCD correction. */
function pal(
  r0: number, g0: number, b0: number,
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
  r3: number, g3: number, b3: number,
): Palette {
  return [
    gbcCorrect(r0, g0, b0),
    gbcCorrect(r1, g1, b1),
    gbcCorrect(r2, g2, b2),
    gbcCorrect(r3, g3, b3),
  ];
}

// CGB base palettes (from CGBBasePalettes in sgb_palettes.asm)
export const CGB_PALETTES: Record<string, Palette> = {
  ROUTE:     pal(31,31,31, 16,31, 4, 11,23,31,  3, 3, 3),
  PALLET:    pal(31,31,31, 23,17,31, 11,23,31,  3, 3, 3),
  VIRIDIAN:  pal(31,31,31, 19,31, 0, 11,23,31,  3, 3, 3),
  PEWTER:    pal(31,31,31, 18,18,15, 11,23,31,  3, 3, 3),
  CERULEAN:  pal(31,31,31,  5, 8,31, 11,23,31,  3, 3, 3),
  LAVENDER:  pal(31,31,31, 25, 4,31, 11,23,31,  3, 3, 3),
  VERMILION: pal(31,31,31, 31,19, 0, 11,23,31,  3, 3, 3),
  CELADON:   pal(31,31,31,  5,31, 5, 11,23,31,  3, 3, 3),
  FUCHSIA:   pal(31,31,31, 31,15,15, 11,23,31,  3, 3, 3),
  CINNABAR:  pal(31,31,31, 31, 8, 8, 11,23,31,  3, 3, 3),
  INDIGO:    pal(31,31,31, 11, 8,31, 11,23,31,  3, 3, 3),
  SAFFRON:   pal(31,31,31, 31,31, 0, 11,23,31,  3, 3, 3),
  CAVE:      pal(31,31,31, 23, 8, 0, 17,14,11,  3, 3, 3),
  TOWNMAP:   pal(31,31,31,  0,21,31, 10,28, 0,  1, 1, 1),

  // Monster battle palettes (from CGBBasePalettes in sgb_palettes.asm)
  MEWMON:    pal(31,31,31, 31,31, 0, 31, 1, 1,  3, 3, 3),
  BLUEMON:   pal(31,31,31, 16,18,31,  0, 1,25,  3, 3, 3),
  REDMON:    pal(31,31,31, 31,17, 0, 31, 0, 0,  3, 3, 3),
  CYANMON:   pal(31,31,31, 16,26,31,  0,17,31,  3, 3, 3),
  PURPLEMON: pal(31,31,31, 25,15,31, 19, 0,22,  3, 3, 3),
  BROWNMON:  pal(31,31,31, 29,18,10, 17, 9, 5,  3, 3, 3),
  GREENMON:  pal(31,31,31, 17,31,11,  1,22, 6,  3, 3, 3),
  PINKMON:   pal(31,31,31, 31,15,18, 31, 0, 6,  3, 3, 3),
  YELLOWMON: pal(31,31,31, 31,31, 0, 28,14, 0,  3, 3, 3),
  GRAYMON:   pal(31,31,31, 20,23,10, 11,11, 5,  3, 3, 3),

  // HP bar palettes (from CGBBasePalettes)
  GREENBAR:  pal(31,31,31, 31,31, 0,  0,31, 0,  3, 3, 3),
  YELLOWBAR: pal(31,31,31, 31,31, 0, 31,18, 0,  3, 3, 3),
  REDBAR:    pal(31,31,31, 31,31, 0, 31, 0, 0,  3, 3, 3),

  // Title screen palettes (from CGBBasePalettes — PAL_LOGO2)
  // Used for Pokemon logo: yellow letters, deep blue shadows
  LOGO2:     pal(31,31,31, 31,31, 0,  7, 7,25,  0, 0,17),
};

// Map name → palette name
// Outdoor maps use their town/route palette directly.
// Indoor maps use the palette of the parent town (mimicking wLastMap behavior).
const MAP_PALETTE: Record<string, string> = {
  // Pallet Town area
  PalletTown: 'PALLET',
  RedsHouse1F: 'PALLET',
  RedsHouse2F: 'PALLET',
  BluesHouse: 'PALLET',
  OaksLab: 'PALLET',

  // Routes
  Route1: 'ROUTE',

  // Viridian City area
  ViridianCity: 'VIRIDIAN',
  ViridianPokecenter: 'VIRIDIAN',
  ViridianMart: 'VIRIDIAN',
  ViridianSchoolHouse: 'VIRIDIAN',
  ViridianNicknameHouse: 'VIRIDIAN',

};

/** Get the palette name for a map. Falls back to 'ROUTE' for unknown maps. */
export function getMapPalette(mapName: string): string {
  return MAP_PALETTE[mapName] ?? 'ROUTE';
}

/** Get the RGBA palette array for a given palette name. */
export function getPaletteColors(paletteName: string): Palette {
  return CGB_PALETTES[paletteName] ?? CGB_PALETTES['ROUTE'];
}

/** Get the hex color string for a palette color index. */
export function paletteToHex(paletteName: string): [string, string, string, string] {
  const p = getPaletteColors(paletteName);
  return p.map(([r, g, b]) =>
    '#' + r.toString(16).padStart(2, '0') +
          g.toString(16).padStart(2, '0') +
          b.toString(16).padStart(2, '0')
  ) as [string, string, string, string];
}

// Pokemon dex number → battle palette (from data/pokemon/palettes.asm MonsterPalettes)
// Palette indices: 0=MEWMON 1=BLUEMON 2=REDMON 3=CYANMON 4=PURPLEMON 5=BROWNMON 6=GREENMON 7=PINKMON 8=YELLOWMON 9=GRAYMON
const PAL_NAMES = ['MEWMON','BLUEMON','REDMON','CYANMON','PURPLEMON','BROWNMON','GREENMON','PINKMON','YELLOWMON','GRAYMON'];
// Index 0 = no-pokemon fallback (MEWMON), indices 1-151 = dex number → palette index
const MONSTER_PAL_IDS: number[] = [0,6,6,6,2,2,2,3,3,3,6,6,3,8,8,8,5,5,5,9,9,5,5,4,4,8,8,5,5,1,1,1,4,4,4,7,7,2,8,7,7,1,1,6,2,2,2,2,4,4,5,5,8,8,8,3,5,5,5,2,1,1,1,8,8,8,9,9,9,6,6,6,3,3,9,9,9,2,2,7,7,9,9,5,5,5,1,1,4,4,9,9,4,4,4,9,8,8,2,2,8,8,7,6,9,9,5,5,7,4,4,9,9,7,1,5,3,3,2,2,2,9,7,6,0,8,2,5,9,2,1,3,9,9,3,8,2,9,1,1,5,5,9,7,1,8,2,9,1,5,0,0];

/** Get the battle palette name for a Pokemon by dex number (0 = no-pokemon fallback). */
export function getMonsterPalette(dexNumber: number): string {
  return PAL_NAMES[MONSTER_PAL_IDS[dexNumber] ?? 9] ?? 'GRAYMON';
}
