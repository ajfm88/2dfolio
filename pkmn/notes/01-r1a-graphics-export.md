# R1a — graphics export: probe results + plan

2026-09-22, Claude Opus 5.5. Probe run from the session scratchpad against
`game/pokeyellow.gbc` and `refs/pokeyellow` @ `e89ead15`. Nothing in the repo was
changed by the probe.

## Probe results (measured)

**`extractRom()` runs in Node unchanged.** The only browser API it needs is a
global `ImageData`. `tile_decoder.ts:48,89` is the only place that constructs one,
and no graphics extractor touches a canvas or the DOM. With a 6-line stand-in
class it runs cleanly.

**Its JSON is byte-identical to `data/`**: all 156 `jsonData` entries match the
files `npm run setup` writes (`JSON.stringify(x, null, 2) + '\n'`). So mirroring
`data/` into `static/` gives the browser exactly the JSON it gets today from the
in-browser extraction.

**Output:** 518 images, 3 binaries (`gfx/title/{pokemon_logo,pika_bubble,pikachu}.tilemap`
— no leading slash, unlike the image keys), 156 JSON.

- Every image key is `/gfx/…/*.png`. By directory: sprites/front 151, sprites/back
  151, sprites (overworld) 67, trainers 46, pikachu 41, tilesets, font, battle,
  title, player, emotes, town_map 3, trainer_card 4, icons 4, pokedex 1, overworld 1.
- Every pixel is gray (R=G=B) with one of **0 / 85 / 170 / 255**. That is exactly
  what browsers expand pret's 2bpp PNGs to (ARCHITECTURE *Verified format findings*).
- 516 images are fully opaque. **2 have alpha-0 pixels**: `/gfx/tilesets/reds_house.png`
  (256 px) and `/gfx/battle/move_anim_0.png` (64 px). These are unfilled slots at
  the end of a partial last tile row (`decode2bpp` zero-fills the buffer and only
  sets alpha on pixels it writes). RGB is 0 there.
- Dimensions: tilesets all 128 px wide ✅, Pikachu front 40×40, back 32×32, font
  128×64, overworld sheets **16×768**.
- Encoded as 8-bit grayscale PNG: **~470 KB total**.

**Against pret (same relative path, 215 files):**

| Result | Count | Why |
|---|---|---|
| pixel-identical | 125 | — |
| ours taller, overlapping region identical | 75 | mostly the 67 overworld sheets: `extractOverworldSprites` reads the table's size byte as a tile count, but pret's macro is `db \2 tiles` = **byte count** (`data/sprites/sprites.asm`). It reads 16× too much: the real 24 tiles sit in the top 96 px, identical to pret, and ROM garbage follows |
| differ only in pret's **last tile row** | 15 | 13 tilesets, `move_anim_0`, `pokemon_logo`: the extractor reads a fixed 0x600 bytes, or up to the next label, past the real tile data. pret's PNG stops at the real tile count (blank-padded) |
| no same-path pret file | 303 | dex-numbered Pokemon sprites, trainers, etc. — different naming |

None of the garbage tiles are referenced by blocksets or sprite frames, which is
why upstream renders correctly. **R1a exports what the engine uses today**,
garbage rows included. Trimming to pret's true sizes changes what the engine sees,
so it's a separate, verified change (proposed for V5).

**Other facts found:**
- No existing test covers the graphics extractors. `extraction.test.ts` tests only
  JSON extractors, plus sprite decompression via raw pixels.
- `npm run typecheck` covers `src/` only (`tsconfig.json` `include: ["src"]`), so
  `scripts/extract_dev_data.ts` is **not typechecked** today.
- `pngjs` can write colorType 0 (gray) and 4 (gray+alpha), 8-bit only, from RGBA
  input.
- `package.json` has no `"type": "module"`, so tsx runs the script as CJS. No
  top-level await: wrap it in `async function main()`.
- `game/.gitignore` has no `static/` entry. Its unanchored `gfx` pattern would
  ignore `static/gfx/` anyway, but not the mirrored JSON.

## Result — R1a done 2026-09-22 (plan below was followed, incl. optional a + b)

- `npm run setup` → `data/` (156 JSON) + `static/` (518 PNG + 3 `.tilemap` +
  156 JSON), ~1.4 s. Two runs → all 677 files byte-identical.
- Tests: **381/381** with `ROM_PATH` (375 + 6 in `static_export.test.ts`); 334
  pass / 47 skip without it. Negative control: swapping `front/25.png` for
  Bulbasaur makes "static/ is up to date" fail, naming the file.
- Optional a: `tsconfig.json` now includes `scripts/`. Upstream's script
  typechecked clean, no fixes needed.
- Optional b: the Pikachu pixel test now reads `refs/pokeyellow/…/pikachu.png`
  and **passes** (ROM decompressor == pret, pixel for pixel).
- Viewed directly: Pikachu front, overworld tileset, title logo, font — correct.
- **R1c must-know:** 2 of the 3 `.tilemap` files contain no NUL byte, so git would
  treat them as text and `core.autocrlf=true` would rewrite them. Mark them binary
  in `.gitattributes`.

## Plan (as proposed 2026-09-22 — approved and executed)

Scope: **extraction side only.** No engine, Vite or gate change (that's R1b), and
no commit of `static/` (that's R1c).

1. **`src/rom/node_image_data.ts`** — minimal `ImageData` class (data, width,
   height), installed on `globalThis` only if missing. Node-only; never imported
   by browser code.
2. **`src/rom/static_export.ts`** — Node-only helpers, placed in `src/` so they're
   typechecked and testable:
   - `encodePng(img)`: 8-bit grayscale (colorType 0) when fully opaque, else
     gray+alpha (colorType 4). Lossless; the same format family as pret. Throws on
     any non-gray pixel.
   - `writeStatic(extracted, dataDir, staticDir)`: wipe `static/` (100%
     generated), write each image at `static/` + key, binaries verbatim, copy
     `data/**/*.json` → `static/`. Throws if a key isn't `/gfx/…` / `gfx/…` (no
     path escapes).
3. **`scripts/extract_dev_data.ts`** — existing JSON code untouched. Afterwards:
   install the polyfill, `await extractRom(buffer)`, `writeStatic(...)`, print
   counts. Wrap in `async main()`.
4. **`src/rom/__tests__/static_export.test.ts`** — gated on `ROM_PATH` like
   the extraction suite:
   - every one of the 518 images → `encodePng` → decode with pngjs → identical
     dimensions and all 4 channels;
   - key shape: all `/gfx/**.png`, exactly 3 tilemaps;
   - `extractRom()` JSON deep-equals the `data/` files (the browser gets the same
     JSON after R1b);
   - if `static/` exists: files on disk equal a fresh export (catches a stale
     `static/` after future extractor edits).
5. **`game/.gitignore`** += `static/` until R1c (R1c removes `data/`, `gfx`,
   `static/` together).
6. **Docs**: ARCHITECTURE asset rules (16×768 overworld sheets; padded reads;
   `static/` now produced), root CLAUDE.md commands, STATUS.

**Verify:** typecheck clean; `ROM_PATH=pokeyellow.gbc npm test` = 375 + new, all
green; plain `npm test` still passes (new suite skips); run setup twice → identical
SHA1 manifest of `static/`; `static/` holds 518 PNG + 3 `.tilemap` + 156 JSON;
view a handful of PNGs directly (Pikachu front, overworld tileset, font, title
logo, `red.png`); `git status --ignored` shows `static/` and the ROM ignored;
commit locally.

**Optional, small, same area — user's call:**
- a. Add `scripts` to `tsconfig.json` `include` so the setup script we're editing
  gets typechecked. It may surface errors in upstream's script; fix minimally.
- b. `extraction.test.ts:313` looks for pret's `pikachu.png` at `pkmn/gfx/…`, but
  it lives at `refs/pokeyellow/gfx/…`. A one-line path fix turns on a pixel check
  that currently skips silently.

**Deferred (log, don't do):** trim overworld sheets / padded tileset reads to
pret's true sizes (V5 candidate — changes engine input).
