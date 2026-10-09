/**
 * Build-time service worker. Writes dist/sw.js after a production build.
 * Never imported by src/.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION_TOKEN = "'__CC_VERSION__'";
const PRECACHE_TOKEN = '__CC_PRECACHE__';

/**
 * Every built file the service worker must cache, as root-relative URLs, sorted.
 * Excludes the worker itself and source maps.
 * @param {string[]} files posix paths relative to outDir
 * @returns {string[]}
 */
export function precacheUrls(files) {
  /** @type {string[]} */
  const urls = [];
  for (const file of files) {
    if (file === 'sw.js' || file.endsWith('.map')) continue;
    urls.push(`/${file}`);
  }
  urls.sort();
  return urls;
}

/**
 * Cache version: the first 12 hex characters of a SHA-256 over every
 * (path, content) pair in path order, so any changed byte or renamed file
 * changes it, and identical builds give identical workers.
 * @param {{ path: string, bytes: Uint8Array }[]} entries
 * @returns {string}
 */
export function cacheVersion(entries) {
  const sorted = entries.slice().sort((a, b) => (
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0
  ));
  const hash = createHash('sha256');
  for (const entry of sorted) {
    hash.update(entry.path);
    hash.update('\0');
    hash.update(entry.bytes);
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 12);
}

/**
 * @param {string} text
 * @param {string} token
 * @returns {number}
 */
function occurrences(text, token) {
  return text.split(token).length - 1;
}

/**
 * @param {string} template service-worker.template.js source
 * @param {string} version
 * @param {string[]} urls
 * @returns {string} throws if either placeholder is not found exactly once
 */
export function renderServiceWorker(template, version, urls) {
  if (occurrences(template, VERSION_TOKEN) !== 1) {
    throw new Error(`${VERSION_TOKEN} must appear exactly once`);
  }
  if (occurrences(template, PRECACHE_TOKEN) !== 1) {
    throw new Error(`${PRECACHE_TOKEN} must appear exactly once`);
  }
  return template
    .replace(VERSION_TOKEN, () => JSON.stringify(version))
    .replace(PRECACHE_TOKEN, () => JSON.stringify(urls));
}

/**
 * @param {string} dir
 * @param {string} prefix posix path relative to outDir
 * @returns {Promise<string[]>}
 */
async function walk(dir, prefix) {
  const entries = await readdir(dir, { withFileTypes: true });
  /** @type {string[]} */
  const files = [];
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...await walk(path.join(dir, entry.name), rel));
    } else if (entry.isFile()) {
      files.push(rel);
    }
  }
  return files;
}

/** @returns {import('vite').Plugin} */
export function pwaPlugin() {
  /** @type {string} */
  let outDir = '';
  return {
    name: 'coral-corsairs-pwa',
    apply: 'build',
    /** @param {import('vite').ResolvedConfig} config */
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const files = await walk(outDir, '');
      const urls = precacheUrls(files);
      /** @type {{ path: string, bytes: Uint8Array }[]} */
      const entries = [];
      for (const file of files) {
        if (file === 'sw.js' || file.endsWith('.map')) continue;
        const bytes = new Uint8Array(await readFile(path.join(outDir, ...file.split('/'))));
        entries.push({ path: file, bytes });
      }
      const version = cacheVersion(entries);
      const templatePath = path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        'service-worker.template.js',
      );
      const template = await readFile(templatePath, 'utf8');
      await writeFile(path.join(outDir, 'sw.js'), renderServiceWorker(template, version, urls));
      console.log(`pwa: sw.js caches ${urls.length} files (version ${version})`);
    },
  };
}
