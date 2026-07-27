// Cuts frames out of a sprite sheet that ships on a flat, opaque background.
//
// The Zeek Yoshi rip (`assets/yoshi_little_yoshi.png`) is RGBA but completely
// opaque: its background is plain white, and Yoshi himself is full of white --
// the egg, his belly, his shoes. Keying every white pixel would punch holes
// straight through the sprites. So the background is found by flooding inward
// from the sheet border instead: only white that is reachable from outside the
// artwork counts as background, and enclosed white stays put.
//
// The flood runs once per sheet and the result is cached, as are the individual
// frames, so this costs one pass over the image for the whole session.

const WHITE = 248;

function isWhite(d, i) {
  return d[i] >= WHITE && d[i + 1] >= WHITE && d[i + 2] >= WHITE;
}

// Make border-connected white transparent, in place.
function clearBackground(imageData, w, h) {
  const d = imageData.data;
  const seen = new Uint8Array(w * h);
  // Typed-array stack rather than a plain array: this sheet is ~933k pixels and
  // three quarters of it is background, so the stack gets big and array growth
  // shows up as a hitch on the frame that first needs the sprite. A pixel is
  // only ever pushed once (it is marked seen first), so w*h is a hard bound.
  const stack = new Int32Array(w * h);
  let top = 0;

  const push = (x, y) => {
    const p = y * w + x;
    if (!seen[p] && isWhite(d, p * 4)) {
      seen[p] = 1;
      stack[top++] = p;
    }
  };

  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }

  while (top > 0) {
    const p = stack[--top];
    d[p * 4 + 3] = 0;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
}

export class KeyedSheet {
  constructor(url) {
    this.image = new Image();
    this.image.src = url;
    this.sheet = null;
    this.failed = false;
    this._frames = new Map();
  }

  // The de-backgrounded sheet, or null while the PNG is still decoding.
  _prepare() {
    if (this.sheet || this.failed) return this.sheet;
    const img = this.image;
    if (!img.complete || img.naturalWidth === 0) return null;
    try {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, w, h);
      clearBackground(data, w, h);
      ctx.putImageData(data, 0, 0);
      this.sheet = canvas;
    } catch (e) {
      // getImageData throws on a tainted canvas (e.g. served from file://).
      this.failed = true;
    }
    return this.sheet;
  }

  ready() {
    return this._prepare() != null;
  }

  // A canvas holding just `rect`, at native size. Cached; null until ready.
  frame(rect) {
    const sheet = this._prepare();
    if (!sheet) return null;
    const key = `${rect.x},${rect.y},${rect.w},${rect.h}`;
    if (this._frames.has(key)) return this._frames.get(key);

    const canvas = document.createElement('canvas');
    canvas.width = rect.w;
    canvas.height = rect.h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sheet, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
    this._frames.set(key, canvas);
    return canvas;
  }
}

// Sheets are shared across boards and matches, so keep one instance per URL.
const sheets = new Map();

export function keyedSheet(url) {
  if (!sheets.has(url)) sheets.set(url, new KeyedSheet(url));
  return sheets.get(url);
}
