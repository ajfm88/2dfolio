/**
 * Visual themes. Autotile logic is theme-agnostic; a theme is a sheet path
 * plus a tile origin. Only island is packed in v1. Unit 20 adds ship at (1,1).
 *
 * @typedef {{
 *   id: string,
 *   sheet: string,
 *   originCol: number,
 *   originRow: number,
 *   waterClip: string,
 * }} Theme
 */

/** @type {Theme} */
export const islandTheme = {
  id: 'island',
  sheet: 'tiles/island',
  originCol: 0,
  originRow: 0,
  waterClip: 'bg/water-tile',
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
