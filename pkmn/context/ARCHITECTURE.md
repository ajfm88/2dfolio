# ARCHITECTURE — how the pieces fit

This file has three parts: the data pipeline and boundaries, the rendering rules, and
the **engine reference** at the end. The engine reference holds the module map, the state
machine, the data conventions and the extraction system. It came from upstream's
`game/CLAUDE.md` and was moved here from root `CLAUDE.md` on 2026-10-06 (DECISIONS #42).
Subsystem detail is in
`game/src/{audio,battle,menus,overworld,pikachu,renderer,story,text}/ARCHITECTURE.md`.
Read those, and root `CLAUDE.md` → *Fidelity rules*, before touching engine code.

The research below is **already paid for**. Reuse it; don't re-explore it.

## Stack

| Layer | Technology | Role |
|---|---|---|
| Game engine | TypeScript (strict) + HTML5 Canvas 2D | Complete Gen-1 reimplementation, not emulation |
| Build/dev | Vite 7 | Dev server, static asset serving, bundling |
| Extraction | Node + `tsx`, `pngjs` | ROM → `data/` JSON + `static/` PNG/tilemaps/JSON (`npm run setup pokeyellow.gbc`) |
| Tests | vitest — baseline **963** passing (2026-10-06, A5a implementation) | Battle logic + cartridge behavior + extractor ground truth + `static/` export |
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
data/          JSON for vitest                        ←── committed (R1c)
static/        Vite publicDir = data/ mirror + gfx/**  ←── committed (R1c)
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

- **`data/`** — JSON only, produced by `npm run setup` (169 files, 9.4 MB; `pikachu_movement.json` since A6e, the two item jingles since A1a, `text_programs.json` since A5b1, `map_sprite_sets.json` since A5b2).
  Vitest's mock fetch reads here (`src/test/setup.ts`), and the suite hard-exits
  if it is missing. Committed since R1c.
- **`static/`** (DECISIONS #16) — Vite `publicDir`, **100% generated** by setup
  (since R1a), which deletes and rebuilds it every run. It holds 520 PNGs + 3 title
  `.tilemap`s under `gfx/`, plus a mirror of `data/`'s 169 JSON files. That lets
  the browser `fetch('pokemon.json')` and load `/gfx/...` without ROM injection.
  - **How:** `scripts/extract_dev_data.ts` runs the browser's own `extractRom()`
    in Node (`src/rom/node_image_data.ts` supplies `ImageData`).
    `src/rom/static_export.ts` writes each `ImageData` as a lossless 8-bit PNG:
    grayscale, or gray+alpha for the 2 images with alpha-0 slots.
  - **Checked:** byte-identical across runs; `static_export.test.ts` proves
    lossless round-trips, that the JSON matches `data/`, and that `static/` is
    not stale.
  - **Git:** committed since R1c. Never hand-edit it — change the extractor, re-run
    setup, commit the regenerated output with the code.
- **Why two dirs:** tests hard-exit without `data/`; the browser needs a single
  public root that also holds graphics. One mirrored copy at setup end is simpler
  than dual-writing every JSON path.
- **localStorage** — saves (`p151-s` in `src/save.ts`), sim FPS (`p151-f`).
  Origin-scoped: `127.0.0.1` ≠ `localhost`.
  Since A1b saves include optional `hiddenObjects` (`Map:npcId` keys for collected
  balls); old saves default to an empty set. Bag/PC stacks are restored verbatim,
  including duplicate ids created by the cartridge's 99-per-slot rule.
- **IndexedDB** — upstream's extracted-ROM cache (`src/rom/rom_cache.ts`). Unused
  since R1b; a browser that ran the upstream gate may still hold a stale one
  (harmless — nothing reads it).
- **Git (R1c):** `game/.gitignore` now ignores only `node_modules/`, `dist/`,
  `*.gbc`, `*.gb`, `.DS_Store` (upstream's unanchored `data/` + `gfx` patterns
  removed). The root `.gitattributes` keeps every text file LF on checkout, so
  generated JSON stays byte-identical despite this machine's `core.autocrlf=true`,
  and marks `*.png` / `*.tilemap` / `*.gbc` / `*.gb` binary.

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
| `game_text.json` | flat `Record<key, string>` (`game_text.ts`); a `prompt` text keeps its trailing `<PROMPT>` (A5b1) | ROM via extractor |
| `text_programs.json` | `{programs: Record<label, TextOp[]>, textPointers: Record<table, MapTextCall[]>}` (`text_programs.ts`, A5b1) — TextCommandProcessor programs by pret label, and each map text's `DisplayTextID` call | ROM via extractor; labels/addresses in `rom/text_program_symbols.ts` |
| `map_sprite_sets.json` | `MapSpriteSetsFile` (`map_sprite_sets.ts`, A5b2): 37 outdoor selectors, 12 linear splits including the unused `$f8` row, sets 1–10 (11 picture ids), pictures 1–82 (`walking`/`still` and 12 or 4 tiles), Route 20's branch, current map ids and canonical sprite names. Not loaded at runtime (A5b4) | ROM via extractor |
| `maps/<Map>.json` | `MapData` (`maps.ts`) — since V1a an NPC can also carry `item` (item balls: item-flagged **and** text `PickUpItemText`) and, for standard map trainers, `trainerClass` / `trainerParty` (0-based) / `endBattleText` / `afterBattleText`, with `dialogue` = the before-battle text, all read from the trainer header | ROM via extractor; map list controlled by `EXTRACTABLE_MAPS` |
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
`#` for `POKé`. Since A5a, map text uses `\n` for line/next from the first row and
cont from the second; exceptional cursor behavior keeps `<LINE>`/`<NEXT>`/`<CONT>`.
`para`→`\f`, `prompt`→trailing `<PROMPT>`, `done`/`@`→end of string.
Contractions count as one glyph; PK/MN and extra-font punctuation are decoded too.
`game_text.json` keeps `prompt` endings since A5b1 (`getText()` strips them for unmigrated
callers); `text_programs.json` holds the full programs. The shared decoder throws on
unknown string bytes rather than dropping them. See `game/src/text/ARCHITECTURE.md`.

**Map ASM is regular and simple**: `map_header Name, CONST, TILESET, CONNECTIONS`,
`connection dir, Map, CONST, offset`, `db $b ; border block`, `warp_event x, y,
DEST, id`, `bg_event x, y, TEXT_ID`, `object_event x, y, SPRITE, MOVEMENT, DIR,
TEXT_ID`. `.blk` is one byte per block (PalletTown = 90 B = 10×9).

**The test suite depends on `data/`.** `src/test/setup.ts` calls `process.exit(1)`
when the directory is absent. Since R1c, `data/` is committed and always present.
Baseline: **375/375** on vanilla upstream, 381/381 after R1a, 399/399 after V1a, 409/409 after V1b, 429/429 after V1c, 441/441 after V1d, 452/452 after the tick clock (O-5), 476/476 after V1e, 502/502 after A6a, 570/570 after A6b, 705/705 after A6c, 729/729 after A6d, 767/767 after A6e, 776/776 after its revision, 812/812 after A1a, 864/864 after A1b, 910/910 after A1c, **963/963** after A5a implementation (2026-10-06; 878 pass / 85 skip without ROM).
(The lost copy reached 395.)

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
and *Engine reference* below.

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

Camera: `x = player.x - 64`, `y = player.y - 60`. Movement runs on the overworld
pass (2 frames, A6a): the player 2 px a pass, 16 frames a step; a normal NPC 34
frames a step (DECISIONS #36, `src/overworld/ARCHITECTURE.md` → *Pace*).

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
  candidate (`notes/01-r1a-graphics-export.md`).
- **Padded reads**: tilesets read a fixed 0x600 bytes (or up to the next tileset),
  and `move_anim_0` / `pokemon_logo` read up to the next label, so their last tile
  row can hold ROM data past the real tiles (15 images differ from pret there
  only). Partial last rows have alpha-0 slots (`reds_house`, `move_anim_0`).
  Blocksets never reference those tiles.
- **Fonts**: 1bpp PNGs, loaded through `loadFont()` (black on transparent).
- **Tilemaps**: raw binary `.tilemap` files (`extractTitleTilemaps`), byte-identical
  to pret's. Marked `binary` in the root `.gitattributes` (R1c) — 2 of the 3 have
  no NUL byte, so git would otherwise treat them as text.
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
on window `blur`. Details: *Engine reference → Game state machine* below.
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

---

# Engine reference

How the engine in `game/src/` is put together. Read it before touching engine code,
together with root `CLAUDE.md` → *Fidelity rules* (the house rule) and the doc for your
subsystem: `game/src/{audio,battle,menus,overworld,pikachu,renderer,story,text}/ARCHITECTURE.md`.
The test suite is described in `CONVENTIONS.md` → *The test suite*.

Transcribed 2026-09-22 from upstream's `game/CLAUDE.md` (gididaf) into root `CLAUDE.md`,
and moved here on 2026-10-06 (DECISIONS #42). That move also sent the audio section, the
overworld movement pitfalls, the battle mechanics and the Pikachu happiness tables to their
subsystem docs. Dropped as wrong for us: the "clone pokeyellow alongside" setup (we have
`refs/`) and the "no assets shipped, ROM uploaded at runtime" framing (Hard rule #1 and R1
replace it). (Upstream also cites `data/DATA_FORMATS.md` — it does not exist.)

## Module map (`game/src/`)

Entry point: `index.html` → `src/main.ts`.

| Module | Purpose | Key exports |
|---|---|---|
| `core/` | Shared types, constants, player state | `Direction`, `MapData`, `NpcData`, `GB_WIDTH`, `TILE_SIZE`, `BLOCK_PX`, `getPlayerName()`, `setPlayerName()`, `substituteNames()` |
| `renderer/` | Canvas 2D rendering | `initRenderer()`, `drawTile()`, `drawSprite()`, `loadTileset()`, `loadSprite()` |
| `input/` | Keyboard + touch (arrows/WASD, Z=A, X=B, Enter=Start; mobile overlay); the overworld's joypad read per standing pass (A6a); `wJoyIgnore` (`joy_ignore.ts`, A1c) | `updateInput()`, `isHeld()`, `isPressed()`, `readJoypad()`, `syncJoypadRead()`, `isPassPressed()`, `setKey()`, `initTouchControls()`, `setJoyIgnore()` |
| `text/` | Dialogue box + game text lookup | `TextBox`, `initTextSystem()`, `charToTile()`, `loadGameText()`, `getText()`, `getFontCanvas()` |
| `overworld/` | Maps, player, NPCs, story state, transitions; the overworld's pace (`walk_pace.ts`, A6a); sprite collisions (`sprite_collision.ts`, A6c); trainer sight (`trainer_sight.ts`, `map_trainers.ts`, `emotion_bubble.ts`, A1c) | `GameMap`, `Player`, `Npc`, `applyStoryNpcState()`, `performWarpLoad()`, `PassClock`, `PlayerWalk`, `NpcWalk`, `updateSprites()`, `spriteTable()`, `collisionMask()`, `trainerEngages()`, `trainerMapScript()`, `EmotionBubble` |
| `battle/` | Wild/trainer battles, evolution; the catch demo (old man + Oak's Pikachu, V1d) | `Battle`, `loadBattleData()`, `createPokemon()`, `tryWildEncounter()`, `checkEvolutions()`, `applyEvolution()`, `initCatchDemo()` |
| `menus/` | All menus, title/intro screens | `StartMenu`, `PartyMenu`, `ShopMenu`, `ItemMenu`, `YesNoMenu`, `TownMap`, `BlackboardMenu`, `PcMenu`, `PokecenterPcMenu`, `BillsPcMenu`, `TrainerCard`, `OptionMenu`, `SaveMenu`, `PokedexMenu`, `TitleScreen`, `MainMenu`, `OakSpeech`, `NamingScreen`, `drawBox()`, `loadEdTile()` |
| `pikachu/` | Follower, happiness & emotion; spawn states after a warp (`pikachu_spawn.ts`, V1b). Oak's catch moved to `battle/` in V1d; idle glances and antics (`pikachu_idle.ts`, A6c) | `PikachuFollower`, `PikachuIdle`, `modifyPikachuHappiness()`, `warpSpawnState()` |
| `pikachu/follow_buffer.ts` | Native retained follow-command queue (A6d), hop commands and catch-up threshold | `PikachuFollowBuffer` |
| `pikachu/pikachu_movement.ts` | `ApplyPikachuMovementData` (A6e): decoder, both function tables, timers, sine jump, shadow, 2-frame holds; `pikachu_movement_data.ts` loads its JSON | `PikachuMovementRun`, `pikachuSide()`, `loadPikachuMovementData()` |
| `story/` | Per-map story scripts & hidden events; Viridian City's map script (V1e) | `buildOakGrassScript()`, `buildOaksLabIntroScript()`, `buildOaksLabPokedexScript()`, `buildViridianMartParcelScript()`, `viridianCityStep()`, `buildOldMan2Script()` |
| `script/` | Cutscene script engine & controller | `initScript()`, `updateScript()`, `ScriptCommand` |
| `audio/` | GB audio engine (2 pulse, wave, noise) | `initAudio()`, `resumeAudio()`, `playMusic()`, `playSFX()`, `stopMusic()`, `tickAudio()`, `isMusicPlaying()`, `isSfxPlaying()`, `isSoundFinished()` (A1a), `suspendAudio()`, `resumeAudioOutput()`; `SoundChannel` (`sound_channel.ts`, the shared interpreter) |
| `rom/` | Extraction system — see below | `validateRom()`, `extractRom()`, `installRomData()`, `showUploadScreen()` |
| `items.ts` | Bag & PC item storage | `Bag`, `ItemStack`, `addToInventory()`, `initItemNames()`, `getItemName()` |
| `save.ts` | Save/load via localStorage | `saveGame()`, `loadGame()` |
| `events.ts` | Event flags | `setFlag()`, `hasFlag()` |
| `pokedex_state.ts` | Seen/owned tracking | `markSeen()`, `markOwned()`, `isSeen()`, `isOwned()`, `restorePokedex()` |
| `debug.ts` | Debug overlay (backtick): tile grid, stats, HP, status, stat stages, badges, bag, Pikachu mood, warp-to-location | `renderDebugOverlay()`, `updateDebugPanel()`, `consumeDebugWarp()` |

## Game state machine (`main.ts`)

```
splash            "Click to start" (unlocks browser audio)
title_screen      animated title with Pikachu
main_menu         NEW GAME / CONTINUE / OPTION
oak_speech        Oak intro (portraits, text, naming)
naming_screen     keyboard for player/rival names
overworld         walk, NPCs move, warps/connections/encounters
textbox           dialogue box active
transition        fade out → async map load → fade in
battle_transition visual effect before a battle
battle            battle controller owns update+render
emotion_bubble    the "!" over a spotting trainer: 61 frames, nothing moves (A1c); the walk-up then runs in overworld
start_menu        right-side overlay menu
save_menu         save confirmation + saving
option_menu       full-screen settings
trainer_card      player card
party_menu        party list (STATS, SWITCH, CANCEL)
shop              Poké Mart BUY/SELL/QUIT
item_menu         bag
pc                Red's house item PC
pokecenter_pc     SOMEONE's PC / YELLOW's PC / LOG OFF → BillsPcMenu / PcMenu
blackboard        interactive board menu
dex               Pokédex list/data/area
town_map          map overlay
catch_demo        the catch demo: Oak catches Pikachu, the old man (V1d)
pikachu_emotion   animated Pikachu face box
evolution         post-battle evolution (sprite morph, B cancels)
script            cutscene script engine running
```

Other keys: `p` pauses (suspends the AudioContext); `-` / `+` change the sim FPS
(range 10–200 in steps of 5, stored in localStorage `p151-f`). The default is the
Game Boy's 59.7275 Hz since 2026-09-25 (upstream: 50), and it is one of the `-`/`+`
stops (`core/tick_clock.ts`, DECISIONS #33).

**Game loop (ours, R1b — DECISIONS #27).** `gameLoop()` (rAF) calls
`runDueTicks()` then renders. `runDueTicks()` asks `TickClock` (`core/tick_clock.ts`)
how many ticks are due; it keeps leftover time, so the rate holds on any display.
Browsers stop rAF in background tabs, so
`startBackgroundTicker()` runs a tiny inline Web Worker (`setInterval` 8 ms,
not throttled like main-thread timers) that calls `runDueTicks()` whenever rAF
has been idle for 100 ms. Game logic and `tickAudio()` keep running unfocused;
drawing resumes with rAF. `input.ts` releases every held key on window `blur`,
because the keyup events are lost while unfocused. `p` still pauses everything.

**The overworld pass (A6a, DECISIONS #36).** The ASM's `OverworldLoop` waits two frames
per pass, and everything that moves advances once per pass. `main.ts` runs a
`PassClock` for the states `overworld` and `script`: their movement,
`UpdateSprites` and the joypad read (standing passes only) happen on every second tick.
Text, script `wait`s, fades, audio and battles still count frames. The state machines are
in `overworld/walk_pace.ts`; details in `src/overworld/ARCHITECTURE.md` → *Pace*.

## Data conventions

- **Names in JSON**: `<PLAYER>` / `<RIVAL>` tokens in NPC dialogue and signs —
  `TextBox.show()` substitutes them. In TypeScript story scripts use
  `getPlayerName()` / `getRivalName()` template literals instead.
- **Pokemon sprites by dex number**: `/gfx/sprites/front/{dex}.png`; pass
  `species.id` to `loadPokemonSprites()`.
- **Dialogue** via `getText('KEY')` (`src/text/game_text.ts`, from `game_text.json`).
- **Item names** via `getItemName(id)` (`src/items.ts`, from `item_names.json`).
- **Inventory slots (A1b):** duplicate item ids are valid. `addToInventory` splits at
  99 only with a free slot; a full inventory rejects its first overflowing match,
  even if a later match has room. Menus use `removeAt` for the selected slot;
  scripts use `remove` for the first match. Saves restore slots verbatim.
- **Pickup objects (A1b):** an NPC's extracted `item` selects `itemBallScript`.
  Collected balls persist as `hiddenObjects` keys (`Map:npcId`), separate from
  hidden-item event flags. Old saves default to no hidden objects; new games clear them.
- **Asset paths use real names**: `/gfx/title/pokemon_logo.png`,
  `/gfx/title/pikachu_bg.png`, `/gfx/sprites/pikachu.png` (follower),
  `/gfx/pikachu/` (emotion faces).

## ROM extraction system (`src/rom/`)

| File | Purpose |
|---|---|
| `index.ts` | `validateRom()`, `extractRom()` — orchestrates every extractor; returns `{jsonData, imageData, binaryData}` keyed by URL path |
| `binary_reader.ts` | ArrayBuffer utilities, SHA1 |
| `rom_offsets.ts` | Hardcoded ROM byte offsets (from `pokeyellow.sym`), `ROM_SHA1`, `ROM_SIZE` |
| `constants.ts` | Enum constants only: `TYPE_NAMES`, `EFFECT_NAMES`, `GROWTH_RATE_NAMES` |
| `sprite_decompress.ts` | Gen 1 sprite decompression (port of `home/uncompress.asm`) |
| `tile_decoder.ts` | 1bpp/2bpp → grayscale `ImageData` (2bpp shades 255/170/85/0) |
| `data_provider.ts` | *Dead since R1b.* Was: `window.fetch` override + `injectRawImage` graphics injection |
| `upload_ui.ts` | *Dead since R1b.* Was: ROM upload screen + IndexedDB cache check |
| `rom_cache.ts` | *Dead since R1b.* Was: IndexedDB store (`CACHE_VERSION` 8) |
| `town_map_data.ts` | Static town-map coordinates (not from ROM) |
| `node_image_data.ts` | *(ours, R1a)* Node stand-in for `ImageData` so `extractRom()` runs in the setup script and tests |
| `static_export.ts` | *(ours, R1a)* Node-only: `encodePng()` (lossless 8-bit gray / gray+alpha), `writeStatic()` rebuilds `static/`, `staticPathFor()` refuses keys outside `gfx/` |
| `extractors/*.ts` | One per data type — the **schema authority** (Hard rule #4) |

The three *Dead* files are upstream's in-browser ROM path. Since R1b nothing
imports them and the production bundle contains none of their code. They stay in
the tree (Hard rule #6) — never import them again (Hard rule #1). `index.ts`'s
`extractRom()` is still live: the setup script and tests call it in Node. `scripts/extract_dev_data.ts`
(`npm run setup`) runs the same extractors in Node; its SFX name list is longer than
`index.ts`'s, but both are filtered by `extractors/audio.ts` `SFX_HEADERS` (see below).

- **Adding an extractor**: create `extractors/foo.ts` exporting
  `extractFoo(rom: BinaryReader, ...)` returning the ground-truth JSON shape; wire
  it into `index.ts` **and** `scripts/extract_dev_data.ts`; add a test in
  `src/rom/__tests__/extraction.test.ts`. Name-string data takes lookup tables as
  parameters (`readMoveNames()`, `readItemNames()`, … from `extractors/text.ts`).
  NPC/sign text: `textOffset` (sym-file offsets) or `readMapText()` (TextPointers →
  `text_far` chain).
- **Sprite bank pitfall** (`extractors/sprites.ts`): Pokemon sprite banks are
  chosen by **internal species ID** thresholds (`home/pics.asm`), not dex number.
  Convert dex → internal ID by scanning `PokedexOrder` in reverse. `PokedexToIndex`
  at `10:5086` is **machine code, not a data table** — never read bytes from it.
- **Implemented extractors** (upstream): pokemon, moves, types, trainers, wild,
  blocksets, collision, pokedex, maps (**19** since V1a: upstream's 12 + the Route 2 /
  Viridian Forest set; NPCs can carry `item` and trainer fields), music (47 listed, all 47
  extract since V1c fixed the `meeteviltrainer` typo), SFX (**12** extract since A1a, the
  item jingles included: only names with an entry in `audio.ts` `SFX_HEADERS` —
  `index.ts` lists 36 unique names, the setup script 46, and `extractSfx()` returns null
  for the rest; V5 expands `SFX_HEADERS`),
  wave samples, noise instruments, font / font_extra / font_battle_extra,
  tilesets, battle HUD, title screen (+ tilemaps), overworld sprites (~70),
  Pokemon front/back (302), trainer & player sprites, emotes, party icons, town
  map, Pokédex tiles, trainer card, heal machine, the ledge shadow (A6d), and
  Pikachu's movement database, sine table and programs (`pikachu_movement.json`, A6e).
