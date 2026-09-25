/**
 * Pack Treasure Hunters frames and Super Pirate World audio into public/assets/.
 * Run with `npm run assets`. Never imported by src/.
 */
import { execFile } from 'node:child_process';
import { access, copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';
import {
  AUDIO_ROOT,
  PACK_ROOT,
  audio,
  clips,
  coverageExcludes,
} from './asset-manifest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACK = path.join(ROOT, ...PACK_ROOT.split('/'));
const AUDIO = path.join(ROOT, ...AUDIO_ROOT.split('/'));
const OUT = path.join(ROOT, 'public', 'assets');
const TOTAL = 1195;

const PNG = { compressionLevel: 9, adaptiveFiltering: false };

/** @param {string} posix */
function fromPack(posix) {
  return path.join(PACK, ...posix.split('/'));
}

/** @param {string} abs */
function toPosix(abs) {
  return abs.slice(PACK.length + 1).split(path.sep).join('/');
}

/** @param {string} name */
function frameNumber(name) {
  const m = name.match(/(\d+)(?=\.[^.]+$)/);
  if (!m) throw new Error(`no frame number in "${name}"`);
  return Number(m[1]);
}

/**
 * @param {string} dirAbs
 * @param {RegExp} [match]
 */
async function listFrames(dirAbs, match) {
  let names;
  try {
    names = await readdir(dirAbs);
  } catch (err) {
    throw new Error(`cannot read ${dirAbs}: ${err.message}`);
  }
  const frames = names.filter((name) => {
    if (!name.toLowerCase().endsWith('.png')) return false;
    if (/\(guide\)/i.test(name)) return false;
    if (match && !match.test(name)) return false;
    return true;
  });
  frames.sort((a, b) => frameNumber(a) - frameNumber(b) || a.localeCompare(b));
  return frames.map((name) => path.join(dirAbs, name));
}

async function emptyDir(dir) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
}

const run = promisify(execFile);

/**
 * Re-encode an MP3 at a constant bitrate. The bitexact flags and the stripped
 * metadata keep the output byte-identical across runs (no encoder version or
 * source tags), so regeneration stays deterministic.
 *
 * @param {string} srcAbs
 * @param {string} destAbs
 * @param {string} bitrate e.g. '96k'
 */
async function transcodeMp3(srcAbs, destAbs, bitrate) {
  if (!ffmpegPath) throw new Error('ffmpeg-static has no binary for this platform');
  await run(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', srcAbs,
    '-map', '0:a:0', '-map_metadata', '-1',
    '-fflags', '+bitexact', '-flags:a', '+bitexact',
    '-c:a', 'libmp3lame', '-b:a', bitrate,
    '-id3v2_version', '0', '-write_id3v1', '0',
    destAbs,
  ]);
}

/**
 * @param {string[]} files
 * @param {number} fw
 * @param {number} fh
 * @param {string} outAbs
 */
async function writeStrip(files, fw, fh, outAbs) {
  for (const file of files) {
    const meta = await sharp(file).metadata();
    if (meta.width !== fw || meta.height !== fh) {
      throw new Error(
        `${path.basename(file)} is ${meta.width}x${meta.height}, expected ${fw}x${fh}`,
      );
    }
  }
  await mkdir(path.dirname(outAbs), { recursive: true });
  await sharp({
    create: {
      width: fw * files.length,
      height: fh,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(files.map((input, i) => ({ input, left: i * fw, top: 0 })))
    .png(PNG)
    .toFile(outAbs);
}

/**
 * @param {string[]} files
 * @param {number} tile
 * @param {string} outAbs
 */
async function writeNineSlice(files, tile, outAbs) {
  if (files.length < 11) {
    throw new Error(`nineslice needs at least 11 tiles, got ${files.length}`);
  }
  // The kit ships 16 tiles arranged as a guide image. The usable nine-slice is
  // the top-left 3×3: indices 0,1,2 / 4,5,6 / 8,9,10 (0-based, row-major-4).
  const pick = [0, 1, 2, 4, 5, 6, 8, 9, 10];
  for (const idx of pick) {
    const meta = await sharp(files[idx]).metadata();
    if (meta.width !== tile || meta.height !== tile) {
      throw new Error(
        `${path.basename(files[idx])} is ${meta.width}x${meta.height}, expected ${tile}x${tile}`,
      );
    }
  }
  const size = tile * 3;
  await mkdir(path.dirname(outAbs), { recursive: true });
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(
      pick.map((srcIdx, i) => ({
        input: files[srcIdx],
        left: (i % 3) * tile,
        top: Math.floor(i / 3) * tile,
      })),
    )
    .png(PNG)
    .toFile(outAbs);
}

/** @returns {Promise<string[]>} */
async function walkPngs(dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkPngs(abs, acc);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
      acc.push(toPosix(abs));
    }
  }
  return acc;
}

function stripDest(clip) {
  return clip.dest ?? `sprites/${clip.id.replaceAll('/', '-')}.png`;
}

/** @param {Set<string>} set @param {string} file */
function consume(set, file) {
  if (set.has(file)) throw new Error(`source used twice: ${file}`);
  set.add(file);
}

async function main() {
  try {
    await access(PACK);
  } catch {
    console.error(
      'reference/treasure-hunters not found; restore the art pack to regenerate. ' +
        'npm run dev still works from committed assets.',
    );
    process.exit(1);
  }

  await emptyDir(path.join(OUT, 'sprites'));
  await emptyDir(path.join(OUT, 'tiles'));
  await emptyDir(path.join(OUT, 'ui'));
  await emptyDir(path.join(OUT, 'audio'));

  /** @type {Set<string>} */
  const consumed = new Set();
  /** @type {Record<string, { src: string, fw: number, fh: number, n: number, fps?: number }>} */
  const atlas = {};

  for (const clip of clips) {
    try {
      if (clip.kind === 'strip') {
        const files = await listFrames(fromPack(clip.dir), clip.match);
        if (files.length !== clip.n) {
          throw new Error(`expected ${clip.n} frames, found ${files.length}`);
        }
        const dest = stripDest(clip);
        await writeStrip(files, clip.fw, clip.fh, path.join(OUT, ...dest.split('/')));
        for (const file of files) consume(consumed, toPosix(file));
        atlas[clip.id] = {
          src: dest,
          fw: clip.fw,
          fh: clip.fh,
          n: clip.n,
          fps: clip.fps ?? 10,
        };
      } else if (clip.kind === 'copy') {
        const srcAbs = fromPack(clip.src);
        const destAbs = path.join(OUT, ...clip.dest.split('/'));
        await mkdir(path.dirname(destAbs), { recursive: true });
        await copyFile(srcAbs, destAbs);
        const meta = await sharp(srcAbs).metadata();
        consume(consumed, clip.src);
        atlas[clip.id] = {
          src: clip.dest,
          fw: meta.width ?? 0,
          fh: meta.height ?? 0,
          n: 1,
        };
      } else if (clip.kind === 'nineslice') {
        const files = await listFrames(fromPack(clip.dir));
        files.sort((a, b) => frameNumber(path.basename(a)) - frameNumber(path.basename(b)));
        const dest = clip.dest;
        await writeNineSlice(files, clip.tile, path.join(OUT, ...dest.split('/')));
        for (const file of files) consume(consumed, toPosix(file));
        // writeNineSlice composites the 3×3 subset, so the image is 3 tiles square.
        const size = clip.tile * 3;
        atlas[clip.id] = { src: dest, fw: size, fh: size, n: 1 };
      } else {
        throw new Error(`unknown kind "${clip.kind}"`);
      }
    } catch (err) {
      throw new Error(`clip ${clip.id}: ${err.message}`);
    }
  }

  for (const item of audio) {
    const srcAbs = path.join(AUDIO, item.src);
    const destAbs = path.join(OUT, ...item.dest.split('/'));
    try {
      await access(srcAbs);
    } catch {
      throw new Error(`audio missing: ${AUDIO_ROOT}/${item.src}`);
    }
    await mkdir(path.dirname(destAbs), { recursive: true });
    if (item.bitrate) {
      await transcodeMp3(srcAbs, destAbs, item.bitrate);
    } else {
      await copyFile(srcAbs, destAbs);
    }
  }

  const ids = Object.keys(atlas).sort();
  /** @type {typeof atlas} */
  const sorted = {};
  for (const id of ids) sorted[id] = atlas[id];
  await writeFile(
    path.join(ROOT, 'src', 'data', 'atlas.json'),
    `${JSON.stringify(sorted, null, 2)}\n`,
  );

  const allPngs = await walkPngs(PACK);
  const inSprites = allPngs.filter((p) => p.includes('/Sprites/'));
  const exclude = new Set(coverageExcludes);
  const shippable = inSprites.filter((p) => !exclude.has(p));
  if (shippable.length !== TOTAL) {
    throw new Error(
      `shippable PNG count is ${shippable.length}, expected ${TOTAL} ` +
        `(${inSprites.length} under Sprites/ minus ${exclude.size} guides)`,
    );
  }

  const shippableSet = new Set(shippable);
  const unused = shippable.filter((p) => !consumed.has(p)).sort();
  const packed = shippable.length - unused.length;
  if (packed + unused.length !== TOTAL) {
    throw new Error(`coverage math failed: ${packed} + ${unused.length} !== ${TOTAL}`);
  }
  for (const file of consumed) {
    if (!shippableSet.has(file) && !exclude.has(file)) {
      throw new Error(`consumed a non-shippable file: ${file}`);
    }
  }

  await writeFile(
    path.join(ROOT, 'tools', 'coverage.json'),
    `${JSON.stringify({ packed, total: TOTAL, unused }, null, 2)}\n`,
  );

  const pct = ((packed / TOTAL) * 100).toFixed(1);
  console.log(`assets: ${packed} / ${TOTAL} source files packed (${pct}%)`);

  /** @type {Map<string, number>} */
  const groups = new Map();
  for (const file of unused) {
    const dir = file.slice(0, file.lastIndexOf('/'));
    groups.set(dir, (groups.get(dir) ?? 0) + 1);
  }
  const groupList = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const shown = groupList.slice(0, 12);
  for (const [dir, count] of shown) {
    const noun = count === 1 ? 'frame' : 'frames';
    console.log(`  unused: ${dir}  (${count} ${noun})`);
  }
  const hidden = groupList.length - shown.length;
  if (hidden > 0) {
    const hiddenFiles = groupList.slice(12).reduce((n, [, c]) => n + c, 0);
    console.log(`          ... ${hidden} more folders, ${hiddenFiles} files — see coverage.json`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
