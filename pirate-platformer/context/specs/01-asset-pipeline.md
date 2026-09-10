# Unit 01: Asset Pipeline

## Goal

Build the build-time packer that turns the Treasure Hunters sprite pile and Super
Pirate World's CC0 audio into committed runtime files. `npm run assets` is
deterministic, every clip the manifest names exists under `public/assets/`, a
throwaway debug page draws every clip with the correct frame count, and the
coverage report's numerator plus unused list equals 1195.

This unit does **not** port Python gameplay and does **not** load sprites at
runtime. `src/core/atlas.js` is Unit 02.

## Design

The packer is a Node script. The game never imports `tools/` or `reference/`.
Generated output is committed so `npm run dev` works without the art pack.

Output layout (from `2-architecture.md`):

```
public/assets/sprites/<clip>.png   horizontal strips and unique-size copies
public/assets/tiles/<name>.png     tilesheets copied as-is
public/assets/ui/<part>.png        nine-slices and packed UI strips
public/assets/audio/*              copied CC0 audio
src/data/atlas.json                runtime manifest
tools/coverage.json                unused-source report
```

`atlas.json` is a flat map of clip id → `{ src, fw, fh, n, fps? }`. `src` is
posix, relative to `/assets/`. Keys are sorted. JSON is 2-space with a trailing
newline. Audio is not in the atlas.

There is one theme packed now (Palm Tree Island). Pirate Ship tilesheets wait
for Unit 20.

## Implementation

### Inputs (read-only)

- Images: `reference/treasure-hunters/**/Sprites/**`
- Audio: `reference/super-pirate-world/audio/*`
- Never read `pirate-maker/graphics/` or `super-pirate-world/graphics/` — those
  mix Treasure Hunters with Pixel Adventure and 2× upscales.

If `reference/treasure-hunters` is missing, exit 1 with a message that the art
pack must be restored to regenerate, and that `npm run dev` still works from
committed assets.

### `tools/asset-manifest.mjs`

Declarative clip list. The packer has no game knowledge. Three clip kinds plus
audio:

- `strip` — frames in `dir`, optional `match` regex, numeric sort by the last
  integer in the filename, composite a horizontal strip. Default dest
  `sprites/<id-with-dashes>.png`. Declared `fw`, `fh`, `n` are asserted.
- `copy` — byte-copy one PNG to `dest`. Do not recompress through sharp.
- `nineslice` — files `1.png`–`16.png` in `dir`, skip `*(guide).png`, row-major
  4×4 composite of `tile` px cells.

Frame sort must be numeric. UI `1.png`…`16.png` sorts wrong lexicographically.

Every source frame of a strip must equal declared `fw×fh`. Do not resize.

`coverageExcludes` lists the nine `* (guide).png` files. That is the only legal
way a file under `Sprites/` leaves the 1195 denominator.

### Clip list (v1)

Pack what Coral Corsairs v1 uses, not what the Python games imported. Unarmed
Captain, three walkers, Cannon + Seashell, three diamond colours, Wood and Paper
UI. Skip sword, totems, maps, merchant hull, ship interior, dialogue, inventory,
Pirate Ship tilesheets, Green Bottle, enemy jump/fall/ground.

Player (unarmed, 64×40): idle 5, run 6, jump 3, fall 1, ground 2, hit 4,
dead-hit 4, dead-ground 4.

Dust from Captain `Dust Particles/` via prefix match (52×20): jump 6, fall 5,
run 5.

Walkers — idle, run, anticipation, attack, hit, dead-hit, dead-ground,
attack-effect. Skip jump/fall/ground.

- Crabby 72×32 (attack-effect 118×24): 9, 6, 3, 4, 4, 4, 4, 3
- Fierce Tooth 34×30 (attack-effect 22×24): 8, 6, 3, 5, 4, 4, 4, 3
- Pink Star 34×30 (attack-effect 16×12): 8, 6, 3, 4, 4, 4, 4, 4

Cannon: idle 1 (40×26), fire 6 (40×26), fire-effect 6 (20×28), ball 1 (16×16),
ball-explode 7 (54×60), ball-dead 3 (16×16).

Seashell: idle 1 (48×38), fire 6 (48×38), pearl 1 (16×16), pearl-dead 3 (16×16).

Treasure: gold/silver 4×16×16, red/green/blue diamond 4×24×24, skull 8×24×28,
red/blue potion 7×13×17, fx coin 3×16×16, diamond 4×24×24, potion 4×16×39,
skull 5×24×28.

Island: terrain sheet 544×160, palm-platform sheet 96×96, spikes 32×32, flag
01–09 (34×93, exclude `Platform.png`), palm front 4×39×32, back regular 4×64×64,
back left 4×51×53, back right 4×52×53.

Parallax copies: BG Image 384×128, Big Clouds 448×101, Small Cloud 1/2/3
(74×24, 133×35, 140×39 — three copies, not one strip), Additional Sky 32×32,
Additional Water 32×32 (water body tile).

Water animation from Merchant Ship (island pack has none): top 4×96×32, bottom
96×32. Do not slice; drawing is Unit 04/07.

Water reflects: big 4×170×10, mid 4×53×3, small 4×35×3.

UI nine-slices: yellow/green board and yellow paper at tile 32 → 128×128;
yellow/green button at tile 14 → 56×56.

UI strips: hearts (Big Bars 4×32×32), icons (Mobile Buttons 8×28×28), small
icons (25×8×6), sliders (10×12×12).

Audio — copy all seven files from `reference/super-pirate-world/audio/`:
`coin.wav`, `jump.wav`, `damage.wav`, `pearl.wav`, `attack.wav`, `hit.wav`,
`starlight_city.mp3`. Do not copy `pirate-maker/audio/`.

Exact dirs, match regexes and dest paths live in `tools/asset-manifest.mjs`.
That file is the source of truth for paths; this spec is the source of truth
for *what* is packed.

### `tools/build-assets.mjs`

1. Resolve repo root from `import.meta.url`. Tools never import `src/`.
2. Empty `public/assets/{sprites,tiles,ui,audio}` then recreate them.
3. Process each clip; record consumed source paths (posix, relative to the pack
   root).
4. Copy audio as-is.
5. Write `src/data/atlas.json` (every packed image except audio; copies measured
   with sharp metadata; nine-slices `n: 1`, `fw/fh` = 4 × tile; strips include
   `fps`, default 10).
6. Walk `reference/treasure-hunters/**/Sprites/**/*.png`. Subtract
   `coverageExcludes` and consumed files. Write `tools/coverage.json`. Print:

   ```
   assets: N / 1195 source files packed (P%)
     unused: <parent dir>  (K frames)
             ...
             ... M more — see coverage.json
   ```

   Packed + unused must equal 1195. Fail the build if not.

PNG encode for composites: `compressionLevel: 9`, `adaptiveFiltering: false`,
no palette. Strip metadata. Frame `i` is placed at `x = i * fw`.

Nine-slice tile `k` (1–16) at column `(k-1) % 4`, row `floor((k-1) / 4)`.

### Debug page

`atlas.html` at the repo root (Vite MPA, `/atlas.html`). Loads
`src/debug-atlas.js`, which imports `src/data/atlas.json` and draws every clip
at 2× with `imageSmoothingEnabled = false`, labelled `id  n×fw×fh`. Scrollable
document, not the game canvas. Do not change `index.html` or `src/main.js`.

Throwaway — removable in Unit 02.

### `package.json`

- `"assets": "node tools/build-assets.mjs"`
- `sharp` as a devDependency. No other new packages. No `predev` hook.

## Dependencies

- `sharp` (devDependency) — PNG composite and metadata.

## Verify when done

- [ ] `npm run assets` succeeds with `reference/` present.
- [ ] Missing `reference/treasure-hunters` exits 1 with a readable error.
- [ ] Two consecutive runs produce byte-identical `public/assets/**` and
      `src/data/atlas.json`.
- [ ] Every clip id in the manifest exists at its `src` under `public/assets/`.
- [ ] `/atlas.html` draws every clip; frame counts match `n`; no smoothing.
- [ ] Coverage packed + unused = 1195; unused list is posix, sorted, no guides.
- [ ] `player/idle` strip is 320×40.
- [ ] Yellow board composite is 128×128; yellow button is 56×56.
- [ ] `npm run dev` still serves the Unit 00 sky canvas at `/` with ~60 ticks/s.
- [ ] `npm run build` passes with no errors.
- [ ] No console errors on `/` or `/atlas.html`.
