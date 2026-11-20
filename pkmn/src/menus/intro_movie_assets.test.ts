import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import type { OpeningImage } from './opening_screen';
const mocks = vi.hoisted(() => ({ preload: vi.fn(), image: vi.fn() }));
vi.mock('../audio', () => ({ preloadMusic: mocks.preload }));
vi.mock('../renderer', () => ({ getRawImageData: mocks.image }));
import { loadIntroMovieAssets } from './intro_movie_assets';
import type { YellowIntroData } from '../rom/extractors/yellow_intro';

const data: YellowIntroData = JSON.parse(readFileSync(resolve(__dirname, '../../data/yellow_intro.json'), 'utf8'));
const objects: OpeningImage = { width: 128, height: 128, data: [] };
const background: OpeningImage = { width: 128, height: 64, data: [] };
beforeEach(() => {
  mocks.preload.mockReset().mockResolvedValue(undefined);
  mocks.image.mockReset().mockImplementation(async (url: string) => url.includes('_2.') ? objects : background);
});
afterEach(() => vi.restoreAllMocks());
it('loads the two committed sheets and unchanged literal tables, and warms music without playing it', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch');
  const assets = await loadIntroMovieAssets();
  expect(mocks.image.mock.calls).toEqual([['/gfx/intro/yellow_intro_2.png'], ['/gfx/intro/yellow_intro_1.png']]);
  expect(fetch.mock.calls).toEqual([['yellow_intro.json']]);
  expect(mocks.preload.mock.calls).toEqual([['yellowintro']]);
  expect(Object.keys(assets)).toEqual(['objects', 'background', 'data']);
  expect(assets.objects).toBe(objects); expect(assets.background).toBe(background); expect(assets.data).toEqual(data);
  fetch.mockRestore();
});
it('keeps the full 256-tile object sheet; copy limits belong to the later caller', async () => {
  const assets = await loadIntroMovieAssets();
  expect(assets.objects.width * assets.objects.height / 64).toBe(256);
  expect(assets.background.width * assets.background.height / 64).toBe(128);
});
it('uses an injected image loader while retaining the same URL-to-sheet binding', async () => {
  const image = vi.fn(async (url: string) => url.includes('_2.') ? objects : background);
  const assets = await loadIntroMovieAssets(image);
  expect(mocks.image).not.toHaveBeenCalled(); expect(image).toHaveBeenCalledTimes(2);
  expect([assets.objects, assets.background]).toEqual([objects, background]);
});
it('does not resolve until the music preload completes', async () => {
  let release!: () => void, done = false;
  mocks.preload.mockImplementation(() => new Promise<void>(resolve => { release = resolve; }));
  const pending = loadIntroMovieAssets().then(() => { done = true; });
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(done).toBe(false); release(); await pending; expect(done).toBe(true);
});
it('rejects a missing JSON file before trying to decode the response', async () => {
  const json = vi.fn(); const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, json } as unknown as Response);
  await expect(loadIntroMovieAssets()).rejects.toThrow('Failed to load yellow_intro.json');
  expect(json).not.toHaveBeenCalled(); fetch.mockRestore();
});
it('propagates image-load failure instead of returning incomplete assets', async () => {
  mocks.image.mockRejectedValue(new Error('missing sheet'));
  await expect(loadIntroMovieAssets()).rejects.toThrow('missing sheet');
});
it('propagates invalid JSON instead of constructing different movie data', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError('invalid JSON'); } } as unknown as Response);
  await expect(loadIntroMovieAssets()).rejects.toThrow('invalid JSON'); fetch.mockRestore();
});
it('has no production caller, preload or movie data reader outside the new unused loader', () => {
  const src = resolve(__dirname, '..'), found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== 'rom') walk(path); }
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') &&
        /loadIntroMovieAssets|intro_movie_assets|yellow_intro\.json/.test(readFileSync(path, 'utf8'))) found.push(relative(src, path).replace(/\\/g, '/'));
    }
  };
  walk(src); expect(found.sort()).toEqual(['menus/intro_movie_assets.ts']);
});
