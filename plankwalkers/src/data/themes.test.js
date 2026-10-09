import { describe, expect, it } from 'vitest';
import atlas from './atlas.json';
import { getTheme, islandTheme, shipTheme, themeList, themes } from './themes.js';
import { TILE } from '../settings.js';

// Cells each sheet layout spans: the 17 × 5 blob set, or one row of four planks.
const BLOB_COLS = 17;
const BLOB_ROWS = 5;
const BAR_COLS = 4;
const BAR_ROWS = 1;

describe('theme registry', () => {
  it('offers labelled, unique island and ship themes using registry objects', () => {
    expect(themeList.map((t) => t.id)).toEqual(['island', 'ship']);
    expect(new Set(themeList.map((t) => t.id)).size).toBe(themeList.length);
    for (const theme of themeList) {
      expect(theme.label.length).toBeGreaterThan(0);
      expect(getTheme(theme.id)).toBe(theme);
      expect(themes[theme.id]).toBe(theme);
    }
    expect(getTheme('unknown')).toBe(islandTheme);
    expect(getTheme('ship')).toBe(shipTheme);
  });

  it('references packed clips and keeps all tile samples inside their sheets', () => {
    for (const theme of themeList) {
      for (const id of [theme.sheet, theme.platformSheet, theme.waterClip,
        theme.bgImage, theme.bigClouds, ...theme.smallClouds, ...theme.reflects]) {
        expect(atlas[id], id).toBeDefined();
      }
      const terrain = atlas[theme.sheet];
      const platform = atlas[theme.platformSheet];
      expect((theme.originCol + BLOB_COLS) * TILE).toBeLessThanOrEqual(terrain.fw);
      expect((theme.originRow + BLOB_ROWS) * TILE).toBeLessThanOrEqual(terrain.fh);
      const bar = theme.platformTiling === 'bar';
      const platformCols = bar ? BAR_COLS : BLOB_COLS;
      const platformRows = bar ? BAR_ROWS : BLOB_ROWS;
      expect((theme.platformOriginCol + platformCols) * TILE).toBeLessThanOrEqual(platform.fw);
      expect((theme.platformOriginRow + platformRows) * TILE).toBeLessThanOrEqual(platform.fh);
      if (theme.wallTile) {
        expect((theme.wallTile[0] + 1) * TILE).toBeLessThanOrEqual(terrain.fw);
        expect((theme.wallTile[1] + 1) * TILE).toBeLessThanOrEqual(terrain.fh);
      }
    }
  });

  it('preserves island platforms and configures ship planks and the wall', () => {
    expect(islandTheme.platformSheet).toBe(islandTheme.sheet);
    expect(islandTheme.platformOriginCol).toBe(islandTheme.originCol);
    expect(islandTheme.platformOriginRow).toBe(islandTheme.originRow);
    expect(islandTheme.platformTiling).toBe('blob');
    expect(islandTheme.platformOffsetY).toBe(0);
    expect(islandTheme.wallTile).toBeNull();
    expect(shipTheme.platformTiling).toBe('bar');
    expect(shipTheme.platformOffsetY).toBe(-1);
    expect(shipTheme.wallTile).toEqual([2, 8]);
    expect(shipTheme.smallCloudCount).toBe(0);
    expect(shipTheme.reflects).toEqual([]);
  });

  it('keeps the island image horizon inside the sprite, with 41 sea rows below', () => {
    const row = islandTheme.bgImageHorizonRow;
    expect(row).toBeGreaterThanOrEqual(0);
    expect(row).toBeLessThan(atlas['bg/image'].fh);
    expect(atlas['bg/image'].fh - row - 1).toBe(41);
  });
});
