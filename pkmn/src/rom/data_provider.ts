// Data provider: installs fetch override + graphics cache injection
// After ROM extraction, this intercepts all game data requests and serves from ROM

import { injectRawImage } from '../renderer/renderer';

export interface ExtractedData {
  jsonData: Record<string, unknown>;       // path → parsed JSON data
  imageData: Record<string, ImageData>;    // path → decoded grayscale pixels
  binaryData: Record<string, Uint8Array>;  // path → raw binary (tilemaps, etc.)
}

const originalFetch = typeof window !== 'undefined' ? window.fetch.bind(window) : null;

/**
 * Install the fetch override that serves ROM-extracted JSON/binary data.
 * Falls through to original fetch for anything not in the extracted set.
 */
export function installFetchOverride(data: ExtractedData): void {
  if (!originalFetch) return;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = (typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)
      .replace(/^\//, '');

    // Check JSON data
    if (url in data.jsonData) {
      return new Response(JSON.stringify(data.jsonData[url]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check binary data
    if (url in data.binaryData) {
      return new Response(data.binaryData[url].buffer as ArrayBuffer, { status: 200 });
    }

    // In production mode, don't make network requests for game data that
    // should come from ROM. Return 404 locally to avoid unnecessary calls.
    if (url.endsWith('.json') || url.startsWith('gfx/') || url.startsWith('maps/') || url.startsWith('wild/') || url.startsWith('audio/')) {
      return new Response(null, { status: 404, statusText: 'Not Found' });
    }

    // Fall through to original fetch for non-game URLs (external APIs, etc.)
    return originalFetch(input, init);
  };
}

/**
 * Inject all ROM-extracted graphics into the renderer's rawImageCache.
 * This makes the existing palette pipeline work unchanged.
 */
export function installGraphics(imageData: Record<string, ImageData>): void {
  for (const [url, data] of Object.entries(imageData)) {
    injectRawImage(url, data);
  }
}

/**
 * Install all ROM data providers (fetch override + graphics).
 */
export function installRomData(data: ExtractedData): void {
  installFetchOverride(data);
  installGraphics(data.imageData);
}
