# The Legend of Zelda (NES) — Browser TypeScript Reimplementation

A personal, local-only reimplementation of the original 1986 NES _Legend of Zelda_
as a pure browser game in TypeScript. Never published, never hosted — localhost
only.

**Status:** The First Quest is playable and winnable end to end — title →
9 dungeons → Ganon → ending — with save/load, audio and touch controls. 54 of
58 slices done; what remains is wiring the Second Quest into gameplay
(L2a3–L2a5) and its playthrough audit (L2b).

**Scope:** 58 atomic slices across 13 phases. One slice per session.

## Live Demo

Play the game in your browser:

<a href="https://zelda-ajfm88.netlify.app"><img src="https://img.shields.io/badge/Live_Demo-Open-blue?style=for-the-badge&logo=rocket&logoColor=white" alt="Play the live version"/></a>

## Quick start

```bash
cd zelda
npm install
npm run dev
# → http://127.0.0.1:5173/
```

## Project structure

```
zelda-nes/
├── CLAUDE.md                         ← start here: rules, folder map, commands
├── context/                          ← project knowledge base (9 files, one level)
├── zelda1-disassembly-master/        ← THE spec: full NES ROM disassembly
├── zelda1-disasm-labels-master/      ← Mesen label file: RAM variable dictionary
├── ZeldaJS-master/                   ← best browser reference (TypeScript)
├── zelda-clone-master/               ← best combat/boss reference (C#)
├── game-zelda-js-master/             ← weapon variety + HUD reference
├── zelda-js-master/                  ← overworld map reference
├── Legend-Of-Zelda-Javascript-main/  ← ECS pattern reference
├── zelda30tribute-master/            ← touch-control art, individual sprite PNGs
├── zelda/                     ← what we are building
├── sprite-pickers/                   ← scratch grids for indexing sprite sheets
└── README.md                         ← this file
```

## Credits

| Author                                            | Repositories                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [aldonunez](https://github.com/aldonunez)         | [Loz](https://github.com/aldonunez/Loz), [zelda1-disasm-labels](https://github.com/aldonunez/zelda1-disasm-labels) |
| [bobbylight](https://github.com/bobbylight)       | [ZeldaJS](https://github.com/bobbylight/ZeldaJS)                                                                   |
| [hfiggs](https://github.com/hfiggs)               | [zelda-clone](https://github.com/hfiggs/zelda-clone)                                                               |
| [humbertodias](https://github.com/humbertodias)   | [game-zelda-js](https://github.com/humbertodias/game-zelda-js)                                                     |
| [Matthew-SA](https://github.com/Matthew-SA)       | [zelda-js](https://github.com/Matthew-SA/zelda-js)                                                                 |
| [jdr81394](https://github.com/jdr81394)           | [Legend-Of-Zelda-Javascript](https://github.com/jdr81394/Legend-Of-Zelda-Javascript)                               |
| [scottlininger](https://github.com/scottlininger) | [zelda30tribute](https://github.com/scottlininger/zelda30tribute)                                                  |

### Tutorial

This project is a modified version of the following tutorial:

<a href="https://www.youtube.com/playlist?list=PLPtPXViVAq2H6z6ksXL9raic9O3r65ygh"><img src="https://github-production-user-asset-6210df.s3.amazonaws.com/151519281/289277158-1736fca5-a031-4854-8c09-bc110e3bc16d.svg"/></a>
