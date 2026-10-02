# Pokemon Yellow TypeScript

**[Live Demo](https://gididaf.github.io/pokemon-yellow-typescript/)** (bring your own ROM)

A complete rewrite of Pokemon Yellow in TypeScript, running in the browser on HTML5 Canvas.

This is **not an emulator** — it's a ground-up reimplementation of the original Game Boy game, ported instruction-by-instruction from the [pret/pokeyellow](https://github.com/pret/pokeyellow) Z80 assembly disassembly into modern TypeScript. The goal is pixel-perfect, logic-exact fidelity to the original game, including all Gen 1 bugs and quirks.

## How It Works

The game engine is pure TypeScript (~280KB). **No game assets are included in the repository.** Instead, all game data (graphics, music, dialogue, Pokemon stats, maps) is extracted at runtime from a user-provided Pokemon Yellow ROM file directly in the browser.

- Upload your own ROM once — it's validated, extracted, and cached in IndexedDB
- Return visits load instantly from the browser cache
- The ROM never leaves your machine

## Demo Scope

This is a work-in-progress demo covering:

- **Title screen** with animated Pikachu and music
- **Prof. Oak intro** — full speech, naming, Pikachu catch sequence
- **Playable area** — Pallet Town, Route 1, Route 22, Viridian City
- **12 maps** with NPCs, signs, warps, and map connections
- **Wild battles** on Route 1 and Route 22 with full Gen 1 mechanics
- **Trainer battles** with AI
- **Pikachu follower** with happiness system
- **Full audio** — 50+ music tracks, 37 SFX, 4-channel Game Boy synthesis
- **Pokedex, party, items, save/load, shops, PC**

## Running

```bash
npm install
npx vite
```

Open `http://localhost:5173` in your browser and upload your Pokemon Yellow ROM.

## Building for Production

```bash
npm run build
```

Produces a `dist/` folder (~348KB) containing only the game engine — zero game assets. Deploy anywhere as a static site.

## Development

### Prerequisites

- Node.js 18+
- A Pokemon Yellow ROM file (`.gbc`)
- The [pret/pokeyellow](https://github.com/pret/pokeyellow) disassembly (for ASM reference when implementing features)

### Setup

```bash
npm install
npm run setup <path-to-your-rom.gbc>   # Extracts game data for tests
```

### Commands

```bash
npx vite                    # Dev server
npx tsc --noEmit            # Type-check
npm test                    # Run tests (334 battle + other tests)
ROM_PATH=<rom> npm test     # Run all tests including ROM extraction verification
```

### Project Structure

```
src/
  core/       # Shared types, constants, player state
  renderer/   # Canvas 2D rendering, palette system
  input/      # Keyboard input handling
  text/       # Dialogue system, charmap
  overworld/  # Maps, player, NPCs, movement
  battle/     # Full Gen 1 battle system
  menus/      # All menu screens (party, items, pokedex, title, etc.)
  audio/      # 4-channel Game Boy audio engine
  pikachu/    # Pikachu follower & happiness
  story/      # Cutscene scripts
  rom/        # ROM extraction system (14 extractors)
  script/     # Cutscene script engine
```

## Architecture

The ROM extraction system (`src/rom/`) contains 14 specialized extractors that parse the raw Game Boy ROM binary format:

- **Pokemon data** — base stats, types, learnsets, evolutions (151 species)
- **Sprites** — custom Gen 1 compression decompression (302 Pokemon sprites + trainers + overworld)
- **Maps** — header parsing, block layout, NPCs, warps, signs, connections
- **Audio** — music command sequences, SFX, wave samples, noise instruments
- **Graphics** — 1bpp/2bpp tile decoding, tileset extraction, font rendering
- **Text** — charmap-encoded string decoding from ROM offsets

All extracted data is served to the game engine via a `fetch()` override — the game code doesn't know whether it's reading static files or ROM-extracted data.

## Legal

This repository contains **no copyrighted Nintendo content**. It is a clean-room style engine implementation that requires users to provide their own legally obtained ROM file. No ROM files, game assets, sprites, music, or dialogue text are included or distributed.

The project references the [pret/pokeyellow](https://github.com/pret/pokeyellow) disassembly (a community reverse-engineering project) as a technical reference for reimplementation.

## Contributing

This project is actively looking for contributors! The demo covers Pallet Town through Viridian City — there's an entire game left to build.

**Ways to contribute:**

- **Add new maps** — Pewter City, Mt. Moon, Cerulean City and beyond. Each map needs header parsing, tileset rendering, NPCs, warps, and story scripts
- **Implement missing features** — PC box system, TM/HM teaching, fishing, overworld poison, bike, Surf/Fly
- **Battle mechanics** — trainer rosters for new areas, missing move effects, Pokemon cries
- **ROM extraction** — extend the extractors to cover more data from the ROM

**Getting started:**

1. Clone this repo + the [pret/pokeyellow](https://github.com/pret/pokeyellow) disassembly side by side
2. Run `npm install && npm run setup <your-rom.gbc>`
3. Read `CLAUDE.md` for architecture details and conventions

The golden rule: **always read the assembly source before implementing anything.** This is a pixel-perfect port — every detail must match the original game.
