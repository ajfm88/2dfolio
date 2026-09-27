// Global test setup: mock fetch to serve JSON data files from disk

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { beforeAll, vi } from 'vitest';

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

beforeAll(() => {
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
});
