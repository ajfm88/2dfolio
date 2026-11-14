// Global test setup: mock fetch to serve JSON data files from disk

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { afterEach, beforeAll, vi } from 'vitest';
import { unpinOverworldRandom } from './overworld_random_pin';
import { loadToggleableObjects } from '../overworld/toggleable_objects';

const DATA_DIR = resolve(__dirname, '../../data');

if (!existsSync(DATA_DIR)) {
  console.error(
    '\n\x1b[31mTest data not found.\x1b[0m\n' +
    'Run the setup script first to extract data from your ROM:\n\n' +
    '  npx tsx scripts/extract_dev_data.ts <path-to-pokemon-yellow.gbc>\n',
  );
  process.exit(1);
}

const dataCache: Record<string, unknown> = {};

function readDataFile(filename: string): unknown {
  if (!dataCache[filename]) {
    dataCache[filename] = JSON.parse(
      readFileSync(resolve(DATA_DIR, filename), 'utf-8'),
    );
  }
  return dataCache[filename];
}

beforeAll(async () => {
  vi.stubGlobal('fetch', async (url: string) => {
    const cleanUrl = url.replace(/^\//, '');
    try {
      const data = readDataFile(cleanUrl);
      return {
        ok: true,
        status: 200,
        json: async () => data,
      };
    } catch {
      return { ok: false, status: 404 };
    }
  });
  // Map loads and story scripts read the toggle table (V5c checkpoint-03b), as main's init loads it at startup.
  // The flags start as New Game's. A test that calls vi.resetModules() loads its fresh copy itself.
  await loadToggleableObjects();
});

// DECISIONS #91: a pinned overworld Random lasts one test.
afterEach(() => unpinOverworldRandom());
