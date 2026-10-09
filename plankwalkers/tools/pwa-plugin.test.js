import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cacheVersion, precacheUrls, renderServiceWorker } from './pwa-plugin.mjs';

const templatePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'service-worker.template.js',
);

describe('precacheUrls', () => {
  it('drops the worker and source maps, prefixes a slash and sorts', () => {
    expect(precacheUrls([
      'index.html',
      'sw.js',
      'assets/a.js.map',
      'assets/b.png',
      'fonts/f.woff2',
    ])).toEqual(['/assets/b.png', '/fonts/f.woff2', '/index.html']);
  });
});

describe('cacheVersion', () => {
  const a = { path: 'a.txt', bytes: new Uint8Array([1, 2, 3]) };
  const b = { path: 'b.txt', bytes: new Uint8Array([4, 5]) };

  it('is 12 lowercase hex characters and ignores entry order', () => {
    const first = cacheVersion([a, b]);
    const second = cacheVersion([b, a]);
    expect(first).toMatch(/^[0-9a-f]{12}$/);
    expect(second).toBe(first);
  });

  it('changes when one byte changes', () => {
    const changed = { path: 'a.txt', bytes: new Uint8Array([1, 2, 9]) };
    expect(cacheVersion([changed, b])).not.toBe(cacheVersion([a, b]));
  });

  it('changes when a path is renamed and the bytes stay', () => {
    const renamed = { path: 'c.txt', bytes: a.bytes };
    expect(cacheVersion([renamed, b])).not.toBe(cacheVersion([a, b]));
  });
});

describe('service worker template', () => {
  it('matches a precached URL without honouring Vary', async () => {
    const template = await readFile(templatePath, 'utf8');
    expect(template).toContain('caches.match(key, { ignoreVary: true })');
  });
});

describe('renderServiceWorker', () => {
  it('fills both placeholders from the real template', async () => {
    const template = await readFile(templatePath, 'utf8');
    const out = renderServiceWorker(template, 'abc123def456', ['/index.html']);
    expect(out).toContain('const VERSION = "abc123def456";');
    expect(out).toContain('const PRECACHE = ["/index.html"];');
    expect(out).not.toContain('__CC_VERSION__');
    expect(out).not.toContain('__CC_PRECACHE__');
  });

  it('inserts precache urls that contain $ literally', async () => {
    const template = await readFile(templatePath, 'utf8');
    const out = renderServiceWorker(template, 'v', ['/a$&b.png', "/c$'d.png"]);
    expect(out).toContain("const PRECACHE = [\"/a$&b.png\",\"/c$'d.png\"];");
    expect(out).not.toContain('__CC_PRECACHE__');
  });

  it('throws when the template lacks either placeholder', () => {
    expect(() => renderServiceWorker('const PRECACHE = __CC_PRECACHE__;', 'v', [])).toThrow();
    expect(() => renderServiceWorker("const VERSION = '__CC_VERSION__';", 'v', [])).toThrow();
  });
});
