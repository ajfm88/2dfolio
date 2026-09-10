/**
 * @typedef {{ src: string, fw: number, fh: number, n: number, fps?: number }} AtlasEntry
 * @typedef {{ image: CanvasImageSource, fw: number, fh: number, n: number, fps: number }} AtlasClip
 */

/**
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
async function loadImage(src) {
  const img = new Image();
  img.src = src;
  try {
    if (typeof img.decode === 'function') {
      await img.decode();
      return img;
    }
  } catch {
    // fall through to onload
  }
  if (img.complete && img.naturalWidth > 0) return img;
  await new Promise((resolve, reject) => {
    img.onload = () => resolve(undefined);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
  });
  return img;
}

/**
 * @param {Record<string, AtlasEntry>} manifest
 */
export async function loadAtlas(manifest) {
  /** @type {Record<string, AtlasClip>} */
  const clips = {};
  const ids = Object.keys(manifest);
  await Promise.all(
    ids.map(async (id) => {
      const entry = manifest[id];
      const image = await loadImage(`/assets/${entry.src}`);
      clips[id] = {
        image,
        fw: entry.fw,
        fh: entry.fh,
        n: entry.n,
        fps: entry.fps ?? 10,
      };
    }),
  );

  return {
    /**
     * @param {string} id
     * @returns {AtlasClip}
     */
    get(id) {
      const clip = clips[id];
      if (!clip) throw new Error(`unknown atlas clip "${id}"`);
      return clip;
    },
  };
}
