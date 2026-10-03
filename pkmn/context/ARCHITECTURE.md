# ARCHITECTURE — how the pieces fit

Engine internals are documented in the root `CLAUDE.md` → *Engine reference*
(module map, state machine, extraction system, audio, battle, Pikachu — transcribed
from upstream's `game/CLAUDE.md`, deleted 2026-09-22) plus per-subsystem
`game/src/{battle,menus,overworld,pikachu,renderer,story,text}/ARCHITECTURE.md`.
Read those before touching engine code. This file covers the data pipeline, the
boundaries, and the rendering rules — the things that are true above the engine.

The research below is **already paid for**. Reuse it; don't re-explore it.

## Stack

| Layer | Technology | Role |
|---|---|---|
| Game engine | TypeScript (strict) + HTML5 Canvas 2D | Complete Gen-1 reimplementation, not emulation |
| Build/dev | Vite 7 | Dev server, static asset serving, bundling |
| Extraction | Node + `tsx`, `pngjs` | ROM → `data/` JSON + `static/` PNG/tilemaps/JSON (`npm run setup pokeyellow.gbc`) |
| Tests | vitest — baseline **381** passing (2026-09-22, R1a) | Battle logic + extractor ground truth + `static/` export |
| Data source | User's own cartridge dump | `pokeyellow.gbc`, gitignored, dev-time only |
| Reference | 5 pinned clones in `refs/` | Disassembly + 4 independent Gen 1 implementations — see *Reference repos* below |

## Workspace layout

The `pkmn/` root is the git repo. `refs/` holds clones of the reference repos and
is **gitignored** — it is a read-only spec library, not part of the product.

```
pkmn/                    ← the git repo
  README.md              what this is + credits to our sources
  CLAUDE.md              entry point
  context/               these files
  notes/                 our spec notes, comparisons, probe results
  game/                  our copy of gididaf/pokemon-yellow-typescript
    pokeyellow.gbc       the ROM — GITIGNORED (*.gbc), development input only
  pkmn-sprites/          GITIGNORED — user-curated randomizer art (ours)
  refs/                  GITIGNORED clones — pokeyellow, gen1recomp, oldamber, engine, dmg
  pull-refs.sh           refresh every clone on its correct branch
  .gitignore
```

`game/` is a **copy, not a git remote.** Upstream
(`gididaf/pokemon-yellow-typescript`) cannot be pushed to, so its files were
copied into this repo; we own them from here and take no upstream updates.

## Where the ROM lives

**`game/pokeyellow.gbc`** — the user's own cartridge dump, placed and verified
2026-09-05 (1,048,576 bytes, SHA1 `cc7d03262ebfaf2f06772c1a480c7d9d5f4a38e1`,
matching pret's `roms.sha1` for *Pokemon Yellow (UE) [C][!]*; DECISIONS #14).
Re-verified 2026-09-22 (DECISIONS #25).

It sits in `game/` because that is where the extraction system runs — `npm run
setup pokeyellow.gbc` and `ROM_PATH=pokeyellow.gbc npm test` both resolve it
relative to `game/`. `game/` itself is tracked by git; the ROM is kept out by the
root `.gitignore`'s `*.gbc` / `*.gb` patterns, so it is never committed and never
shipped. Check `git status --ignored` if in doubt.

**It does not belong in `pkmn-sprites/`.** That directory is the user's curated
*randomizer* art pool for X1 — hand-assembled and unrelated to extraction.
Nothing is derived from the ROM *into* it: ROM extraction writes to `game/data/`
and `game/static/gfx/**`.

## System boundaries

- `game/src/` — the game engine. Mostly finished; touch for game feature
  expansion (item pickup, trainer sight, etc.).
- `game/src/rom/` — the extraction system. It is both the authoritative schema
  definition *and* live extraction code (`npm run setup` runs it). Never called by
  the browser bundle.
- `game/scripts/` — `extract_dev_data.ts` is the setup entry point, used during
  development to extract and re-extract data.
- `refs/**` — read-only clones. **Never write here, never commit them.** Refresh
  with `./pull-refs.sh`.
- `pkmn-sprites/` — read-only randomizer art (user-curated; grows over time).
- `notes/` — our own spec notes and comparisons. Free to write.

## Reference repos — `refs/`

Five clones, each pinned to a specific branch. **Do not use `origin/master`
blindly** — most of these do not develop there.

| Dir | Repo | Branch | What it is, and when to reach for it |
| --- | --- | --- | --- |
| `pokeyellow/` | [pret/pokeyellow](https://github.com/pret/pokeyellow) | `master` | The cartridge itself — the disassembly. Ground truth for maps, text, data layout and engine behavior. Our primary source (pret still uses `master`) |
| `gen1recomp/` | [bryanthaboi/gen1recomp](https://github.com/bryanthaboi/gen1recomp) | **`dev`** | Lua full-game recomp + `gen1_faithful`. A complete working implementation to compare behavior against when ours diverges |
| `oldamber/` | [spiritsnails/oldamber](https://github.com/spiritsnails/oldamber) | `main` | C implementation of the full Red/Blue game — same "native engine + user ROM" idea as ours. Becomes useful once we implement past Viridian |
| `engine/` | [pkmn/engine](https://github.com/pkmn/engine) | `main` | **The battle oracle.** Best existing Gen 1 battle sim for cartridge + Showdown fidelity and speed. Use it or steal its research — do not reinvent 1/256 crits or the wrap/counter/psywave mess from memory |
| `dmg/` | [pkmn/dmg](https://github.com/pkmn/dmg) | `main` | One-move damage math. Reach for it to settle a single calculation |

`./pull-refs.sh` refreshes all five (fetch, checkout the pinned branch, ff-only
pull) and clones any that are missing. First-time setup is documented in the root
`README.md`, which also credits every source.

Where a reference disagrees with `refs/pokeyellow/`, **the disassembly wins** — it
is the cartridge. The others are implementations of it, useful for behavior we
find hard to read out of ASM.

## Data flow

**Live since R1b (2026-09-22):**

```
game/pokeyellow.gbc  (user's own dump, development-time extraction, gitignored)
        │  npm run setup pokeyellow.gbc  →  src/rom/extractors/* + extractRom()  (Node)
        ▼
data/          JSON for vitest                        ←── committed in R1c
static/        Vite publicDir = data/ mirror + gfx/**  ←── written since R1a, committed in R1c
        │  plain fetch('pokemon.json') / <img src="/gfx/…">  (base '/')
        ▼
game/ engine (consumers unchanged) — needs no ROM
```

**Removed in R1b — what upstream did instead (never bring it back):**

```
browser → ROM upload screen (main.ts init → rom/upload_ui.ts, cached in IndexedDB)
        → rom/index.ts extractRom() runs every extractor in the browser
        → rom/data_provider.ts: window.fetch override serves the JSON;
          renderer.ts injectRawImage() pre-fills rawImageCache with ImageData
```

The engine already fell back to plain `fetch()` / `<img src>` whenever nothing was
injected (`renderer.ts:72-91` `loadImage`, `getRawImageData`). So once `static/`
held the files, deleting the gate was the whole runtime change: no loader was
touched. JSON is fetched by relative path (`'pokemon.json'`) and graphics by
absolute `/gfx/…`, which is why Vite `base` must be `'/'`. `vite.config.ts` also
sets `appType: 'mpa'`: no SPA fallback, so a missing asset is a real 404 (as the
ROM path's fetch override returned), not `index.html` with a 200.

**Development workflow:** extract with `npm run setup pokeyellow.gbc`, commit the
output. When maps or data are added, re-extract and commit the new output with
the code that uses it.

**Final product:** runs from committed static files. No ROM, no setup, no
extraction. Deploy is **local; Netlify maybe, dead last; never GH Pages**
(DECISIONS #17).

## Storage model

- **`data/`** — JSON only, produced by `npm run setup` (156 files, 9.7 MB).
  Vitest's mock fetch reads here (`src/test/setup.ts`), and the suite hard-exits
  if it is missing. Ignored by upstream's `game/.gitignore` until R1c.
- **`static/`** (DECISIONS #16) — Vite `publicDir`, **100% generated** by setup
  (since R1a), which deletes and rebuilds it every run. It holds 518 PNGs + 3 title
  `.tilemap`s under `gfx/`, plus a mirror of `data/`'s 156 JSON files. That lets
  the browser `fetch('pokemon.json')` and load `/gfx/...` without ROM injection.
  - **How:** `scripts/extract_dev_data.ts` runs the browser's own `extractRom()`
    in Node (`src/rom/node_image_data.ts` supplies `ImageData`).
    `src/rom/static_export.ts` writes each `ImageData` as a lossless 8-bit PNG:
    grayscale, or gray+alpha for the 2 images with alpha-0 slots.
  - **Checked:** byte-identical across runs; `static_export.test.ts` proves
    lossless round-trips, that the JSON matches `data/`, and that `static/` is
    not stale.
  - **Git:** ignored until R1c commits it. Don't hand-edit anything in it.
- **Why two dirs:** tests hard-exit without `data/`; the browser needs a single
  public root that also holds graphics. One mirrored copy at setup end is simpler
  than dual-writing every JSON path.
- **localStorage** — saves (`p151-s` in `src/save.ts`), sim FPS (`p151-f`).
  Origin-scoped: `127.0.0.1` ≠ `localhost`.
- **IndexedDB** — upstream's extracted-ROM cache (`src/rom/rom_cache.ts`). Unused
  since R1b; a browser that ran the upstream gate may still hold a stale one
  (harmless — nothing reads it).
- ⚠ Upstream's `game/.gitignore` has unanchored `data/` and `gfx` patterns — `gfx`
  would also swallow `static/gfx/`. R1c must remove both (check with
  `git status --ignored`).

## Invariants

1. **No ROM at runtime, ever.** The shipped game is a full TypeScript
   implementation — **not an emulator**, not a ROM wrapper. `pokeyellow.gbc` is a
   development-time input only: reference and extraction. The browser never reads
   it, never receives it, and never asks for it; `init()` loads committed static
   files and nothing else. Vanilla upstream shipped an upload/cache gate in
   `main.ts` `init()`; **R1b deleted it (2026-09-22) and it must never come back**
   (the lost copy had deleted it once before, as P5-2). If a feature seems to need
   the ROM at runtime, the data for it belongs in `data/` + `static/` instead —
   extract it, commit it. DECISIONS #2, #14, #18.
2. Generated JSON matches the `src/rom/extractors/*.ts` interfaces exactly — key
   names, `[0] = null` array padding, constant-string style. The extractor source
   is the contract; nothing else is.
3. Never write into `refs/**` or `pkmn-sprites/`. `refs/` is gitignored and stays
   that way — clones are refreshed with `./pull-refs.sh`, never edited.
4. `npm run typecheck` stays clean at every stopping point.
5. Extractors are idempotent and re-runnable; no manual post-editing of output.
6. The engine is not modified to accommodate extraction output. If output does
   not fit, the extractor is wrong.
7. The randomizer never influences battle logic — species, stats, types and moves
   are untouched.

## The data contract (what to generate)

Authority: `src/rom/extractors/*.ts` interfaces + `src/rom/__tests__/extraction.test.ts`.
Summary of path → shape → source:

| Path | Shape (see extractor) | Source |
|---|---|---|
| `pokemon.json` | `(PokemonEntry\|null)[152]`, [0]=null (`pokemon.ts`) | ROM via extractor; also available in `refs/pokeyellow/data/pokemon/base_stats/*.asm` |
| `moves.json` | `Record<moveName, MoveEntry>` (`moves.ts`) | ROM via extractor |
| `type_chart.json` | `{attacker,defender,multiplier}[]` (`types.ts`) | ROM via extractor |
| `trainers.json` | `Record<class, TrainerClass>` (`trainers.ts`) | ROM via extractor |
| `wild/<Map>.json` | `{grassRate,grass[],waterRate,water[]}` (`wild.ts`) | ROM via extractor |
| `pokedex.json` | `(PokedexEntry\|null)[152]` (`pokedex.ts`) | ROM via extractor |
| `item_names.json` | `Record<CONSTANT, display>` (`text.ts:readItemDisplayNames`) | ROM via extractor |
| `game_text.json` | flat `Record<key, string>` (`game_text.ts`) | ROM via extractor |
| `maps/<Map>.json` | `MapData` (`maps.ts`) | ROM via extractor; map list controlled by `EXTRACTABLE_MAPS` |
| `blockset_<name>.json` | `number[][]` 16 tile-ids per block (`blocksets.ts`) | ROM via extractor |
| `collision_tiles.json` | `Record<collGroup, number[]>` (`collision.ts`) | ROM via extractor |
| `town_map.json` | already static TS (`src/rom/town_map_data.ts`) | nothing to do |
| `audio/**` | `channels[].commands[]` (`audio.ts`) | ROM via extractor |

## Verified format findings (2026-07-29 — measured, not assumed)

These were checked directly against pret and the engine. Do not re-investigate
them. (The lost copy's PNG dumper was built on them; R1a rebuilds it.)

**Graphics are a near-perfect 1:1 match.** The ROM extractors' URL keys and pixel
format match pret's tree — `tile_decoder.ts` emits gray 255/170/85/0, the same
values browsers expand pret's 2bpp PNGs to:

- All **596** pret PNGs are grayscale colortype 0 — 589 at 2bpp, 7 at 1bpp.
  Browsers expand these to gray 0/85/170/255, which lands exactly on
  `grayToColorIndex()`'s 192/128/64 thresholds. No conversion needed.
- Every `gfx/tilesets/*.png` is **128 px wide = 16 tiles**, matching
  `TILESET_TILES_WIDE = 16` (`extractors/graphics.ts:81`) and the width-derived
  indexing in `drawTile()`.
- `gfx/title/*.tilemap` binaries exist verbatim (`pokemon_logo.tilemap`,
  `pikachu.tilemap`, `pika_bubble.tilemap`).
- Paths match one-for-one: `gfx/font/ED.png`, `gfx/battle/battle_hud_{1,2,3}.png`,
  `gfx/emotes/shock.png`, `gfx/icons/*.png`, `gfx/player/{red,redb,shrink1,shrink2}.png`,
  `gfx/town_map/*`, `gfx/trainer_card/*`, `gfx/pokedex/pokedex.png`, and even
  `gfx/pikachu/unknown_<hex>.png` (61 files, extractor builds the same names).
- Only real transform: Pokemon sprites are named by species in pret
  (`bulbasaur.png`, back = `bulbasaurb.png`) but the engine fetches them by **dex
  number** (`/gfx/sprites/front/25.png`). Fronts 40×40, backs 32×32.
- `.bst` blockset filenames already equal the engine's blockset keys
  (`overworld.bst` → `blockset_overworld.json`), 16 bytes per block confirmed
  (overworld = 2048 B = 128 blocks).

**Text macros map cleanly to engine strings.** pret's source already contains the
exact tokens the engine expects — `<PLAYER>`, `<RIVAL>` literal in the ASM, and
`#` for `POKé`. Renderer mapping: `text`→literal, `line`/`next`/`cont`→`\n`,
`para`→`\f`, `done`/`prompt`/`@`→terminate.

**Map ASM is regular and simple**: `map_header Name, CONST, TILESET, CONNECTIONS`,
`connection dir, Map, CONST, offset`, `db $b ; border block`, `warp_event x, y,
DEST, id`, `bg_event x, y, TEXT_ID`, `object_event x, y, SPRITE, MOVEMENT, DIR,
TEXT_ID`. `.blk` is one byte per block (PalletTown = 90 B = 10×9).

**The test suite depends on `data/`.** `src/test/setup.ts` calls `process.exit(1)`
when the directory is absent. After R1c, `data/` is committed and always present.
Baseline 2026-09-22 (vanilla upstream): **375/375**. (The lost copy reached 395.)

**PSYCHIC — decided, not implemented** (DECISIONS #10): the asymmetric chart
(`attacker: PSYCHIC_TYPE`, `defender: PSYCHIC`) as a post-processing step on
`extractTypeChart`'s output. The lost copy had it; upstream doesn't — re-confirmed
2026-09-22: `type_chart.json` has `PSYCHIC_TYPE` on both sides, Alakazam is
`PSYCHIC`, `PSYCHIC_M` is `PSYCHIC_TYPE`. Rebuild in **V5**.

---

# Rendering & asset conventions

This is not a web app. There is no design system, no CSS framework, no component
library. The entire UI is a 160×144 Game Boy screen drawn to one `<canvas>`, and
its "design tokens" are the original hardware's palettes and tile grid. Nothing
here is a style preference — it is fidelity to the original game.

Engine-side detail: `game/src/renderer/ARCHITECTURE.md`
and root `CLAUDE.md` → *Engine reference*.

## Theme

Pixel-exact Pokemon Yellow. No modern chrome, no added labels, no helper text,
no invented screens. If it is not in the assembly, it does not go on screen.
Gen 1 bugs and quirks are reproduced deliberately.

## Coordinate systems

| Unit | Size | Used for |
|---|---|---|
| Pixel | 1 | Native screen is 160×144, scaled up |
| Tile | 8×8 px | Tilesets, fonts, sprite sheets |
| Block | 4×4 tiles (32×32 px) | Map dimensions are in blocks |
| Step | 2×2 tiles (16×16 px) | NPC, warp and sign coordinates |

Camera: `x = player.x - 64`, `y = player.y - 60`. Walk speed 2 px/frame, 8 frames
per step.

## Color

- Source art is **4-shade grayscale**, never colored. Color is applied at draw
  time by remapping shades through a named palette.
- `grayToColorIndex()` (`renderer.ts`) buckets gray with thresholds 192 / 128 / 64
  into shade indices 0 (lightest) → 3 (darkest).
- Palettes live in `src/renderer/palettes.ts` as RGB555 values from the assembly's
  `CGBBasePalettes`, run through `gbcCorrect()` to approximate real LCD output.
  Raw RGB555→RGB888 gives visibly wrong colors — always go through the correction.
- There is **no `DEFAULT` palette**; unknown names fall back to `ROUTE`.
- Sprites use the OBP0 shade mapping `[0, 0, 1, 3]` and treat shade 0 as transparent.
- To find the right palette for a new screen, trace the assembly's `SET_PAL_*`
  through `data/sgb/sgb_packets.asm` → `PAL_SET` → `data/sgb/sgb_palettes.asm`.

## Asset format rules

- **Tilesets**: PNG, exactly 128 px wide = 16 tiles per row. `drawTile()` derives
  `tilesPerRow` from image width, so a wrong width silently scrambles every tile
  index on the map. `extractTilesetGraphics` decodes them at 16 tiles wide; R1a
  must write them at that width, unpadded.
- **Pokemon sprites**: `/gfx/sprites/front/<dex>.png` and `/gfx/sprites/back/<dex>.png`
  — **dex number, not species name**. Fronts are 40×40 (56×56 for larger mons),
  backs are 32×32. Decompressed from the ROM (`extractors/sprites.ts`); pret's
  `gfx/pokemon/front/<name>.png` is the visual reference.
- **Overworld sprites**: `/gfx/sprites/<sprite_name>.png`, 16 px wide vertical
  strips. ⚠ Upstream's `extractOverworldSprites` produces **16×768** sheets: pret's
  table byte is already a byte count (`db \2 tiles` = tiles × 16,
  `data/sprites/sprites.asm`), but the extractor multiplies it by 16 again. The
  real 24-tile sheet sits in the top 96 px, pixel-identical to pret's 16×96. The
  rest is ROM data that no frame ever indexes. Harmless; trimming it is a V5
  candidate (`notes/r1a-graphics-export.md`).
- **Padded reads**: tilesets read a fixed 0x600 bytes (or up to the next tileset),
  and `move_anim_0` / `pokemon_logo` read up to the next label, so their last tile
  row can hold ROM data past the real tiles (15 images differ from pret there
  only). Partial last rows have alpha-0 slots (`reds_house`, `move_anim_0`).
  Blocksets never reference those tiles.
- **Fonts**: 1bpp PNGs, loaded through `loadFont()` (black on transparent).
- **Tilemaps**: raw binary `.tilemap` files (`extractTitleTilemaps`), byte-identical
  to pret's. Binary: keep git from touching their line endings (R1c).
- All pret PNGs are grayscale (colortype 0) — 2bpp for art, 1bpp for fonts — which
  the browser expands to gray 0/85/170/255, landing exactly on the shade
  thresholds above. R1a's PNGs must decode to those same four values; verify any
  newly added asset still meets this.
- Tileset wiring lives in `src/overworld/map.ts`: `TILESET_FILES`,
  `TILESET_BLOCKSET`, `COLLISION_NAMES`. All engine art loads from `/gfx/**`;
  the manifest is the key set in `graphics.ts` + `sprites.ts`.

## Text rendering

- Dialogue comes from `game_text.json` via `getText('KEY')`.
- `<PLAYER>` and `<RIVAL>` tokens are substituted at render time by
  `substituteNames()` — keep them literal in the data. pret's ASM already uses
  exactly these tokens.
- `\n` = new line, `\f` = page break (player must press A).
- `POKé` is a real character sequence in the charmap (ASM `#`), not a typo.

---

## ROM gate

**Removed in R1b (2026-09-22).** Upstream's `init()` awaited
`rom/upload_ui.ts` `tryLoadFromCache()` / `showUploadScreen()` before anything
else. That block is gone; `init()` now loads static files only, and the production
bundle contains no gate code (checked: 0 matches for `rom-dropzone`,
`showUploadScreen`, `indexedDB`, "Unsupported ROM"). `src/rom/` remains for
extraction during development and as schema authority (Hard rule #6). The lost
copy had removed it once before (P5-2).

## Game loop & background tabs (ours, R1b)

Upstream ran every tick from `requestAnimationFrame`, which browsers stop in
hidden tabs, so tabbing away froze the game and its music. At the user's request
(DECISIONS #27) the game now keeps running unfocused. An inline Web Worker ticks
`runDueTicks()` while rAF is idle; rendering waits for rAF; held keys are released
on window `blur`. Details: root `CLAUDE.md` → *Engine reference → Game loop*.
Caveat: a **silent** tab left in the background for minutes can still be frozen
by the browser's own tab-freezing; tabs playing audio are exempt.

## The sprite randomizer (Phase X1 — do not start early)

This is **the project's only deliberate deviation from vanilla** (DECISIONS #21).
Everything else is a faithful port; this one thing is ours.

**Behavior:** every battle encounter, each Pokemon's sprite is rolled at random
from six art sets. The same Rattata species looks different from one encounter to
the next. **Per encounter, not per save** — nothing is persisted (DECISIONS #22).
Cosmetic only: it never influences battle logic.

### The pool — measured 2026-09-05, not assumed

Six sets, each covering dex **0001–0151** with a matching `back/`. Filenames are
zero-padded 4-digit dex numbers (`0019.png` = Rattata) — *not* species names, and
*not* the engine's own `/gfx/sprites/front/25.png` convention.

| Set | Path | Front | Back |
|---|---|---|---|
| Red/Blue | `pkmn-sprites/pokemonGen1/Gen1/red-blue/` | 40×40 | 32×32 |
| Red/Green | `pkmn-sprites/pokemonGen1/Gen1/red-green/` | 40×40 | 32×32 |
| Yellow | `pkmn-sprites/pokemonGen1/Gen1/yellow/` | 40×40 | 32×32 |
| Gold | `pkmn-sprites/pokemonGen2/Gen2/gold/` | 40×40 | **48×48** |
| Silver | `pkmn-sprites/pokemonGen2/Gen2/silver/` | 40×40 | **48×48** |
| Crystal | `pkmn-sprites/pokemonGen2/Gen2/crystal/` | 40×40 | **48×48** |

Gen 2 sets also contain dex 0152–0251, plus `shiny/` folders, and Crystal has
`animated/` (252 GIFs). **All unused** — we take skins for the first 151 only.
Gen 2 *content* is not in scope; animated GIFs are open question O-2.

### Integration points

- **Chokepoint**: `loadPokemonSprites(speciesName, dexNumber)` in
  `src/battle/battle_ui.ts:75-98` — sole resolver for battle front/back, PartyMenu
  stats sprite, and Pokedex sprite. Rolling inside this function is invisible to
  every caller.
- **⚠ Cache trap**: `battle_ui.ts:54-55` caches by `speciesName`. With a
  per-encounter roll that would freeze the first variant for the whole session —
  the exact opposite of the intent. Include the chosen variant in the cache key,
  or bypass the cache on the randomized path.
- **⚠ Palette trap (confirmed)**: `loadBattleSprite` → `remapToPalette()` snaps
  every pixel to one of four palette colors. Pool art is **full color**, unlike
  every other asset in the project, so it needs a draw path that skips remapping
  entirely.
- **⚠ Size mismatch**: fronts are all 40×40, which is what the engine already
  expects — free. But Gen 2 **backs are 48×48 where the engine expects 32×32**.
  Scale, crop, or let gold/silver/crystal contribute fronts only.
- **No persistence needed**: `SaveData` (`src/save.ts:29-51`) is untouched. The
  seed field #6 originally planned is dropped (DECISIONS #22).
- **Party-list icons** (`src/menus/party_icons.ts`) use a separate category-icon
  system — intentionally left alone.
