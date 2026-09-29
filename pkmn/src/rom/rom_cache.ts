// IndexedDB caching for ROM-extracted data
// Stores extracted data so users only need to upload the ROM once

const DB_NAME = 'p151-db';
const DB_VERSION = 1;
const STORE_NAME = 'rom-data';

// Bump this when extraction code changes to invalidate cached data
export const CACHE_VERSION = 8;

export interface CachedRomData {
  version: number;
  sha1: string;
  extractedAt: number;
  jsonData: Record<string, unknown>;
  imageData: Record<string, { width: number; height: number; pixels: number[] }>;
  binaryData: Record<string, number[]>;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Store extracted ROM data in IndexedDB */
export async function cacheRomData(sha1: string, data: {
  jsonData: Record<string, unknown>;
  imageData: Record<string, ImageData>;
  binaryData: Record<string, Uint8Array>;
}): Promise<void> {
  const db = await openDB();

  // Serialize ImageData (can't store ImageData directly in IndexedDB)
  const serializedImages: CachedRomData['imageData'] = {};
  for (const [key, img] of Object.entries(data.imageData)) {
    serializedImages[key] = {
      width: img.width,
      height: img.height,
      pixels: Array.from(img.data),
    };
  }

  // Serialize Uint8Arrays
  const serializedBinary: CachedRomData['binaryData'] = {};
  for (const [key, buf] of Object.entries(data.binaryData)) {
    serializedBinary[key] = Array.from(buf);
  }

  const cached: CachedRomData = {
    version: CACHE_VERSION,
    sha1,
    extractedAt: Date.now(),
    jsonData: data.jsonData,
    imageData: serializedImages,
    binaryData: serializedBinary,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(cached, sha1);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** Load cached ROM data from IndexedDB. Returns null if not found or version mismatch. */
export async function loadCachedRomData(sha1: string): Promise<{
  jsonData: Record<string, unknown>;
  imageData: Record<string, ImageData>;
  binaryData: Record<string, Uint8Array>;
} | null> {
  try {
    const db = await openDB();
    const cached = await new Promise<CachedRomData | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(sha1);
      req.onsuccess = () => { db.close(); resolve(req.result); };
      req.onerror = () => { db.close(); reject(req.error); };
    });

    if (!cached || cached.version !== CACHE_VERSION) return null;

    // Deserialize ImageData
    const imageData: Record<string, ImageData> = {};
    for (const [key, img] of Object.entries(cached.imageData)) {
      const pixels = new Uint8ClampedArray(img.pixels);
      imageData[key] = new ImageData(pixels, img.width, img.height);
    }

    // Deserialize Uint8Arrays
    const binaryData: Record<string, Uint8Array> = {};
    for (const [key, arr] of Object.entries(cached.binaryData)) {
      binaryData[key] = new Uint8Array(arr);
    }

    return { jsonData: cached.jsonData, imageData, binaryData };
  } catch {
    return null; // IndexedDB not available or error
  }
}

/** Check if we have valid cached data for the known ROM SHA1 */
export async function hasCachedData(sha1: string): Promise<boolean> {
  try {
    const db = await openDB();
    const cached = await new Promise<CachedRomData | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(sha1);
      req.onsuccess = () => { db.close(); resolve(req.result); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
    return cached?.version === CACHE_VERSION;
  } catch {
    return false;
  }
}
