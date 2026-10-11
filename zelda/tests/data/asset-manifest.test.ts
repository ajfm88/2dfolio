import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';
import {
  SPRITE_ASSETS,
  TILE_ASSETS,
  UI_ASSETS,
  MAP_ASSETS,
  SFX_ASSETS,
  MUSIC_ASSETS,
} from '../../src/data/asset-manifest.js';

const publicDir = resolve(import.meta.dirname, '../../public');

function assertFilesExist(label: string, manifest: Record<string, string>) {
  describe(label, () => {
    for (const [key, assetPath] of Object.entries(manifest)) {
      it(`${key} → ${assetPath}`, () => {
        const fullPath = resolve(publicDir, `.${assetPath}`);
        expect(existsSync(fullPath), `Missing: ${fullPath}`).toBe(true);
      });
    }
  });
}

describe('Asset manifest — all files exist on disk', () => {
  assertFilesExist('sprites', SPRITE_ASSETS);
  assertFilesExist('tiles', TILE_ASSETS);
  assertFilesExist('ui', UI_ASSETS);
  assertFilesExist('maps', MAP_ASSETS);
  assertFilesExist('sfx', SFX_ASSETS);
  assertFilesExist('music', MUSIC_ASSETS);
});
