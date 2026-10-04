/**
 * Visual themes. Autotile logic is theme-agnostic; a theme is a sheet path
 * plus tile origins. Island uses blob terrain and platforms; ship uses blob
 * terrain, horizontal plank platforms and a repeating below-decks wall.
 *
 * World colours match the CSS tokens in 3-ui-context.md (canvas cannot read
 * custom properties). Motion numbers are SPW/Pirate Maker values halved for
 * native 32 px art.
 * Platform origins select either a 17x5 blob region or a 4x1 bar region.
 * platformOffsetY adjusts only the art; wallTile is an absolute sheet cell,
 * or null for the island's sky/sea backdrop.
 *
 * @typedef {{
 *   id: string,
 *   label: string,
 *   sheet: string,
 *   originCol: number,
 *   originRow: number,
 *   platformSheet: string,
 *   platformOriginCol: number,
 *   platformOriginRow: number,
 *   platformTiling: 'blob' | 'bar',
 *   platformOffsetY: number,
 *   wallTile: readonly [number, number] | null,
 *   waterClip: string,
 *   sky: string,
 *   sea: string,
 *   horizon: string,
 *   horizonBand: string,
 *   horizonBands: ReadonlyArray<readonly [number, number]>,
 *   horizonLine: number,
 *   bgParallax: number,
 *   bigCloudParallax: number,
 *   smallCloudParallax: number,
 *   bigCloudSpeed: number,
 *   smallCloudSpeedMin: number,
 *   smallCloudSpeedMax: number,
 *   cloudTimer: number,
 *   smallCloudCount: number,
 *   reflectGap: number,
 *   bgImage: string,
 *   bigClouds: string,
 *   smallClouds: ReadonlyArray<string>,
 *   reflects: ReadonlyArray<string>,
 * }} Theme
 */

/** @type {Theme} */
export const islandTheme = {
  id: 'island',
  label: 'Palm Tree Island',
  sheet: 'tiles/island',
  originCol: 0,
  originRow: 0,
  platformSheet: 'tiles/island',
  platformOriginCol: 0,
  platformOriginRow: 0,
  platformTiling: 'blob',
  platformOffsetY: 0,
  wallTile: null,
  waterClip: 'bg/water-tile',
  sky: '#ddc6a1',
  sea: '#92a9ce',
  horizon: '#f5f1de',
  horizonBand: '#d1aa9d',
  // Pirate Maker 10/16/20 + line 3, halved for VIEW_H 360
  horizonBands: [
    [5, 5],
    [8, 2],
    [10, 1],
  ],
  horizonLine: 2,
  bgParallax: 0.25,
  bigCloudParallax: 0.5,
  smallCloudParallax: 0.85,
  bigCloudSpeed: 25,
  smallCloudSpeedMin: 25,
  smallCloudSpeedMax: 60,
  cloudTimer: 2.5,
  smallCloudCount: 20,
  reflectGap: 2,
  bgImage: 'bg/image',
  bigClouds: 'bg/clouds-big',
  smallClouds: ['bg/cloud-1', 'bg/cloud-2', 'bg/cloud-3'],
  reflects: ['fx/reflect-big', 'fx/reflect-mid', 'fx/reflect-small'],
};

/** @type {Theme} */
export const shipTheme = {
  ...islandTheme,
  id: 'ship',
  label: 'Pirate Ship',
  sheet: 'tiles/ship',
  originCol: 1,
  originRow: 1,
  platformSheet: 'tiles/ship-platforms',
  platformOriginCol: 1,
  platformOriginRow: 1,
  platformTiling: 'bar',
  // Align the sheet's one-pixel top outline with the collision surface.
  platformOffsetY: -1,
  // Absolute sheet coordinates of the opaque repeating back wall.
  wallTile: [2, 8],
  smallCloudCount: 0,
  reflects: [],
};

/** @type {ReadonlyArray<Theme>} */
export const themeList = [islandTheme, shipTheme];

/** @type {Record<string, Theme>} */
export const themes = {
  island: islandTheme,
  ship: shipTheme,
};

/**
 * @param {string} id
 * @returns {Theme}
 */
export function getTheme(id) {
  return themes[id] ?? islandTheme;
}
