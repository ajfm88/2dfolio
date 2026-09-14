/**
 * Visual themes. Autotile logic is theme-agnostic; a theme is a sheet path
 * plus a tile origin. Only island is packed in v1. Unit 20 adds ship at (1,1).
 *
 * World colours match the CSS tokens in 3-ui-context.md (canvas cannot read
 * custom properties). Motion numbers are SPW/Pirate Maker values halved for
 * native 32 px art.
 *
 * @typedef {{
 *   id: string,
 *   sheet: string,
 *   originCol: number,
 *   originRow: number,
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
  sheet: 'tiles/island',
  originCol: 0,
  originRow: 0,
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

/** @type {Record<string, Theme>} */
export const themes = {
  island: islandTheme,
};

/**
 * @param {string} id
 * @returns {Theme}
 */
export function getTheme(id) {
  return themes[id] ?? islandTheme;
}
