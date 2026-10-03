# pkmn

A ground-up rewrite of Pokemon Yellow in TypeScript, running in the browser on
HTML5 Canvas, with **no ROM in the final product**. A personal hobby project —
never distributed.

This is **not an emulator.** It is a reimplementation of the original Game Boy
game, ported instruction-by-instruction from the
[pret/pokeyellow](https://github.com/pret/pokeyellow) Z80 assembly disassembly.
The goal is pixel-perfect, logic-exact fidelity to the original, including all
Gen 1 bugs and quirks.

Game data is extracted from the owner's own cartridge dump during development and
committed to this repo, so playing needs no ROM, no emulator and no setup step.
(Work in progress: until Phase R is done, the dev server still asks for the ROM —
see `context/STATUS.md`.)

This repository is **local-only** — it has no remote and is never pushed.

Agents and contributors: **start with [`CLAUDE.md`](CLAUDE.md)**, then
[`context/STATUS.md`](context/STATUS.md).

## Layout

```
pkmn/
  README.md              this file
  CLAUDE.md              entry point — rules, reading order, commands
  context/               project knowledge base (7 files; STATUS.md is the live log)
  notes/                 spec notes, comparisons, probe results
  game/                  the game itself — our copy of gididaf/pokemon-yellow-typescript
  pkmn-sprites/          curated randomizer art (gitignored)
  refs/                  reference clones (gitignored)
  pull-refs.sh           refresh every clone on its pinned branch
```

## Demo scope

The game currently covers the upstream demo, with the rest of Yellow still to build:

- **Title screen** with animated Pikachu and music
- **Prof. Oak intro** — full speech, naming, Pikachu catch sequence
- **Playable area** — Pallet Town, Route 1, Route 22, Viridian City (12 maps with
  NPCs, signs, warps and map connections)
- **Wild and trainer battles** with full Gen 1 mechanics and trainer AI
- **Pikachu follower** with the happiness system
- **Full audio** — 50+ music tracks, 37 SFX, 4-channel Game Boy synthesis
- **Pokedex, party, items, save/load, shops, PC**

## First-time setup

Clone the reference repos. Each one is pinned to the branch it actually develops
on — **`master` is wrong for most of them**:

```sh
./pull-refs.sh
```

That clones anything missing and updates the rest. To do it by hand instead:

```sh
mkdir -p refs
git clone -b master https://github.com/pret/pokeyellow.git       refs/pokeyellow
git clone -b dev    https://github.com/bryanthaboi/gen1recomp.git refs/gen1recomp
git clone -b main   https://github.com/spiritsnails/oldamber.git  refs/oldamber
git clone -b main   https://github.com/pkmn/engine.git            refs/engine
git clone -b main   https://github.com/pkmn/dmg.git               refs/dmg
```

`refs/` is gitignored. These are read-only: we read them, we never edit or commit
them.

Prerequisites: Node.js 18+, and the owner's own ROM (below) for re-extraction.

### The ROM

Extraction needs the owner's own Pokemon Yellow cartridge dump at
**`game/pokeyellow.gbc`** (1,048,576 bytes, SHA1
`cc7d03262ebfaf2f06772c1a480c7d9d5f4a38e1`). It is gitignored (`*.gbc`) and never
distributed — a development-time input only. Once the extracted data is committed
the game runs without it.

## Running the game

Everything below runs inside `game/`:

```sh
npm install                        # first time only
npm run typecheck                  # strict tsc — must stay clean
npm test                           # vitest (334 battle tests + others)
ROM_PATH=pokeyellow.gbc npm test   # full suite incl. ROM extraction verification
npx vite                           # dev server → http://127.0.0.1:5173/
npm run setup pokeyellow.gbc       # re-extract data from the ROM (development only)
npm run build                      # typecheck + production bundle in dist/
```

Use `http://127.0.0.1:5173/` rather than `localhost` — saves live in
`localStorage` and the two are different origins.

## Engine structure

The engine lives in `src/`; `src/main.ts` is the entry point and owns the game
state machine. Modules marked `*` have their own `ARCHITECTURE.md`.

```
src/
  main.ts            entry point: init, game state machine, game loop
  core/              shared types, constants, player state

  renderer/ *        Canvas 2D rendering, palette system
  input/             keyboard and touch input
  text/ *            dialogue box, charmap, game text lookup
  audio/             4-channel Game Boy audio engine

  overworld/ *       maps, player, NPCs, warps, wild encounters
  battle/ *          full Gen 1 battle system (with tests)
  menus/ *           every menu screen: title, start, party, items, pokedex, PC, shops
  pikachu/ *         Pikachu follower, happiness, emotions
  script/            cutscene script engine and controller
  story/ *           per-map cutscenes and hidden events

  items.ts           bag and PC item storage
  events.ts          event flags
  pokedex_state.ts   seen / owned tracking
  save.ts            localStorage save and load
  debug.ts           debug overlay (backtick key)

  rom/               development-time ROM extraction (14 extractors)
  test/              vitest setup and helpers

data/                extracted JSON (pokemon, moves, maps, text, audio, ...)
static/              what the browser loads: data mirror plus PNGs under gfx/
scripts/             extract_dev_data.ts, run by `npm run setup`
context/             project knowledge base
```

### ROM extraction

`src/rom/` holds 14 specialized extractors that parse the raw Game Boy ROM
binary format, at development time only:

- **Pokemon data** — base stats, types, learnsets, evolutions (151 species)
- **Sprites** — Gen 1 sprite decompression (302 Pokemon sprites + trainers + overworld)
- **Maps** — header parsing, block layout, NPCs, warps, signs, connections
- **Audio** — music command sequences, SFX, wave samples, noise instruments
- **Graphics** — 1bpp/2bpp tile decoding, tileset extraction, font rendering
- **Text** — charmap-encoded string decoding from ROM offsets

The extracted JSON and PNGs are committed as static files that the game loads
over plain `fetch()`. See `CLAUDE.md` and `context/ARCHITECTURE.md` for the data
contract.

## Working on it

The golden rule: **always read the assembly source before implementing anything.**
This is a pixel-perfect port — every detail must match the original game.
Per-subsystem notes live in `game/src/*/ARCHITECTURE.md`.

## Sources & credits

This project stands on other people's work. The reference repos in `refs/` are
the spec we build against:

- **[pret/pokeyellow](https://github.com/pret/pokeyellow)** — the Pokemon Yellow
  disassembly. The cartridge, made readable. Our ground truth. (branch `master`)
- **[bryanthaboi/gen1recomp](https://github.com/bryanthaboi/gen1recomp)** — Lua
  full-game recomp + `gen1_faithful`. (branch `dev`)
- **[spiritsnails/oldamber](https://github.com/spiritsnails/oldamber)** — full
  Red/Blue in C. (branch `main`)
- **[pkmn/engine](https://github.com/pkmn/engine)** — the Gen 1 battle oracle:
  cartridge + Showdown fidelity, and fast. (branch `main`)
- **[pkmn/dmg](https://github.com/pkmn/dmg)** — Gen 1 damage calculation.
  (branch `main`)

And the engine this project is built on top of:

- **[gididaf/pokemon-yellow-typescript](https://github.com/gididaf/pokemon-yellow-typescript)**
  — the TypeScript Pokemon Yellow engine that became `game/`. Copied in rather
  than tracked as a remote, since we can't push back upstream.

Pokemon is © Nintendo / Creatures Inc. / GAME FREAK inc. This is a personal
project for personal use, not distributed. No ROM is shipped or required to play;
the cartridge dump is used only during development to extract data.
