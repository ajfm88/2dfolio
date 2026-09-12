/**
 * Shared shapes for the level format.
 *
 * @typedef {{ c: number, r: number }} Cell
 *
 * @typedef {'terrain' | 'platform' | 'water'} LayerName
 *
 * @typedef {{ k: string, c: number, r: number, p?: Record<string, unknown> }} EntityRecord
 *
 * @typedef {{ k: string, c: number, r: number }} DecorRecord
 *
 * @typedef {{
 *   format: number,
 *   id: string,
 *   name: string,
 *   author: string,
 *   theme: string,
 *   cols: number,
 *   rows: number,
 *   created: number,
 *   modified: number,
 *   spawn: Cell,
 *   goal: Cell,
 *   layers: { terrain: string, platform: string, water: string },
 *   decor: DecorRecord[],
 *   entities: EntityRecord[],
 * }} LevelData
 */

export {};
