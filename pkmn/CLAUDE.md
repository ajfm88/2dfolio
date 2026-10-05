# pkmn — Pokemon Yellow in the browser, no ROM in the final product

A local-only, **1:1 replica of vanilla Pokemon Yellow** in browser TypeScript,
built on `gididaf/pokemon-yellow-typescript` (copied into `game/`). Personal
hobby project, never distributed.

**We are porting, not designing.** Nothing about the game changes — no
rebalancing, no improvements, no added content; Gen 1 bugs are reproduced
deliberately. The repos in `refs/` are how we get it right.

**Sprites: vanilla Yellow, extracted from the ROM.** That is the baseline and it
already works — `/gfx/sprites/front/<dex>.png` (decoded in the browser today,
committed PNGs after Phase R). Build the whole game on those.

Game data is extracted from the user's own cartridge dump during development,
then committed to the repo so the final product needs no ROM at all.

**Scale:** ~1–2 years, on the order of **700–800 sessions**. The 34 milestones in
`context/PLAN.md` are not sittings — split them freely, log every session.
Nobody is expecting a Yellow port in two weeks.

> A per-encounter sprite randomizer (`pkmn-sprites/`) is the one deviation from
> vanilla we eventually want — but it is **Phase X1, dead last**, after the game
> is beatable and audited. Realistically year two. Don't design around it, don't
> start it, don't let it shape engine work. DECISIONS #21–#23 have the detail for
> when that day comes.

**This file is the entry point.** Everything else lives in `context/` — seven
flat files, no nesting.

## ⚠ The one rule: `context/STATUS.md`

That file is **the live handoff log** — current phase, the ordered queue of work
slices, open questions, and the session log. This project is built a little at a
time by whichever agent is available (Claude, Grok, GPT), so:

- **Read it first, every session.** It tells you what actually happened last time.
- **Claim one slice** from its _Next up_ table. One slice per session — don't batch.
- **Update it, then commit locally, before you stop.** An unlogged session is a
  lost session: the next agent restarts from zero and the user pays twice for the
  same work. Every finished slice ends in a local commit (never pushed) —
  `CONVENTIONS.md` → *The session contract*, step 6.

## The context system — `context/`

Read in this order. Skim what your slice needs; don't re-explore what
`ARCHITECTURE.md` already answers — that research is already paid for.

| File | Role | When |
|---|---|---|
| **`STATUS.md`** | ⚠ live handoff log: phase, queue, open questions, session log | **always, first** |
| `PROJECT.md` | what we're building and why; goals, non-goals, success criteria | new to the project |
| `ARCHITECTURE.md` | data pipeline, the data contract, invariants, verified format findings, Game Boy rendering + asset rules | before touching data, assets or rendering |
| `PLAN.md` | the phased roadmap — 34 milestones (R1, V1–V5, A1–A4, B1–X2; R1 ran as slices R1a–c, V1 runs as V1a–e) | when picking or sizing work |
| `CONVENTIONS.md` | session contract (incl. the per-slice local commit), code standards, naming traps, verification workflow | before writing code |
| `DECISIONS.md` | settled choices and rationale (#1–#30), plus open questions that need the user | before proposing a change to a settled choice |
| `HISTORY.md` | archived session entries + the table of lost prior work | rarely — background only |

`context/_reference-article.md` is a third-party article (JavaScript Mastery's
context-engineering playbook) that the original template came from — human
background reading. **Agents: skip it.**

For engine internals (rendering, battle, audio, save), read **_Engine reference_**
at the bottom of this file and the per-subsystem
`game/src/{battle,menus,overworld,pikachu,renderer,story,text}/ARCHITECTURE.md`
before touching engine code.

## Workspace layout

This root is the git repo. `refs/` holds read-only clones of the spec repos and
is **gitignored** — it is never committed, never edited, never pushed to.

```
pkmn/                    ← the git repo
  README.md              what this is + credits to our sources
  CLAUDE.md              you are here — the entry point
  context/               the 7 context files (see above)
  notes/                 our spec notes, comparisons, probe results
  game/                  our copy of gididaf/pokemon-yellow-typescript — the thing we change
    pokeyellow.gbc       the ROM — GITIGNORED (*.gbc), development-time extraction only
  pkmn-sprites/          GITIGNORED — user-curated randomizer art (ours)
  refs/                  GITIGNORED clones of the reference repos
    pokeyellow/  gen1recomp/  oldamber/  engine/  dmg/
  pull-refs.sh           refresh every clone in refs/ on its correct branch
  .gitignore
```

`game/` is a **copy, not a remote.** We cannot push back upstream, so the files
were copied into this repo and we own them from here.

## Reference repos — `refs/` (read-only, gitignored)

Consult these; never edit them, never commit them. Each is pinned to a specific
branch — **do not use `origin/master` blindly**, most of these don't develop there.

| Dir | Repo | Branch | Consult it for |
| --- | --- | --- | --- |
| `refs/pokeyellow/` | [pret/pokeyellow](https://github.com/pret/pokeyellow) | `master` | The cartridge itself — the disassembly. Ground truth for maps, text, data layout, engine behavior |
| `refs/gen1recomp/` | [bryanthaboi/gen1recomp](https://github.com/bryanthaboi/gen1recomp) | **`dev`** | Lua full-game recomp + `gen1_faithful` — a working end-to-end implementation to compare against |
| `refs/oldamber/` | [spiritsnails/oldamber](https://github.com/spiritsnails/oldamber) | `main` | C implementation of full Red/Blue — reach for it when implementing past Viridian |
| `refs/engine/` | [pkmn/engine](https://github.com/pkmn/engine) | `main` | **Battle oracle.** Best Gen 1 battle sim for cartridge + Showdown fidelity. Don't reinvent 1/256 crits or the wrap/counter/psywave mess from memory |
| `refs/dmg/` | [pkmn/dmg](https://github.com/pkmn/dmg) | `main` | One-move damage math — settle a single calculation |

Refresh them all with `./pull-refs.sh` (fetch + checkout + ff-only pull, and it
clones anything missing). First-time setup is in `README.md`.

## Hard rules

1. **The game must run with no ROM. Ever.** This is a full TypeScript
   implementation of Pokemon Yellow — **not an emulator**, and not a wrapper that
   loads a ROM. `pokeyellow.gbc` exists for one purpose: development-time
   reference and asset/data extraction. It is never read at runtime, never
   shipped, never required to play. Everything the game needs is committed static
   JSON + PNG. Upstream shipped a ROM upload gate in `main.ts` `init()`; it was
   removed in R1b (2026-09-22) and must never come back — no ROM-loading, upload, or
   emulation path, ever. DECISIONS #2, #14, #18.
2. **Never write into `refs/**`** — read-only clones. Never edit, never commit,
   never push. If a ref needs updating, run `./pull-refs.sh`.
3. Never modify `pkmn-sprites/` — it is the user's curated source data.
4. Generated JSON must match the existing extractor schemas exactly.
   `src/rom/extractors/*.ts` is the authoritative contract; consumers in
   `src/battle/data.ts` and the tests prove it.
5. **ASM fidelity.** Read the relevant `refs/pokeyellow/` ASM *before* writing
   engine code, and match it exactly — see *Engine reference → Fidelity rules*.
6. Leave `src/rom/` in place — it is the extraction system and schema authority.
7. Gen 1 bugs are features. Do not fix them.
8. Update `context/STATUS.md` before ending a session. Not optional.
9. **This repo is local-only. Never push it anywhere.** No `git remote add`, no
   `git push`, no GitHub/GitLab repo, no `gh repo create`, no uploading the code
   to any service. Commits stay on this machine. DECISIONS #24.

## Commands

Refresh the reference clones from the root: `./pull-refs.sh`

Everything else runs inside `game/`:

- `npm install` — first time only
- `npm run typecheck` — strict tsc (`noUnusedLocals`, `noUnusedParameters`) over
  `src/` and `scripts/`, must stay clean
- `npm run setup pokeyellow.gbc` — extract from the ROM (development): JSON →
  `data/`, then rebuild `static/` (519 PNGs + 3 tilemaps + a JSON mirror). ~1.5 s
- `npm test` — vitest (needs `data/`; the suite exits if it is missing). Without
  `ROM_PATH` the 65 ROM tests skip
- `npm run test:watch` — vitest in watch mode
- `ROM_PATH=pokeyellow.gbc npm test` — full suite incl. extraction + static-export
  tests. **Baseline 2026-09-22 (after V1b): 409/409.**
- `npx vite` — dev server serving `static/` (no ROM involved); prefer
  `http://127.0.0.1:5173/` (saves are origin-scoped). Missing files are real 404s
  (`appType: 'mpa'`)
- `npm run build` — typecheck + production bundle in `dist/` (includes `static/`)

Lost with the old copy (rebuild only if needed): `scripts/_extract_maps_only.ts`,
`scripts/smoke_p5_3.mjs`.

## Where things stand

**2026-09-22: Phase R done — the game runs with no ROM, from committed files.**
`game/` is vanilla upstream (12 maps) plus our changes: `npm run setup` exports
`static/`, the browser loads only those files (ROM gate deleted), `data/` +
`static/` are committed, and the game keeps running in background tabs. A fresh
clone with no ROM installs, tests, builds and plays.

⚠ The earlier sessions' modified copy (30 maps) was **lost** (DECISIONS #26) and
is being rebuilt as **Phase V**. **V1 (Route 2 + Viridian Forest)** is in progress,
split into five slices (DECISIONS #29, `notes/v1-plan.md`). V1a (the 7 maps and their
trainer data, extracted) and V1b (made playable through the debug warps, with Yellow's
Pikachu spawn states and the player's facing kept through warps) are done. **409/409**,
typecheck clean. Next is V1c, then A1, then V2.
Git: local repo, commit per slice, never pushed. Live detail: `context/STATUS.md`.

**Generated data is committed but never hand-edited.** To change it: edit the
extractor → `npm run setup pokeyellow.gbc` → commit the regenerated `data/` +
`static/` with the code. `static_export.test.ts` fails if you forget the re-run.

---

## Engine reference

Transcribed 2026-09-22 from upstream's `game/CLAUDE.md` (gididaf), which was then
deleted — this section replaces it. Dropped as wrong for us: the "clone
pokeyellow alongside" setup (we have `refs/`) and the "no assets shipped, ROM
uploaded at runtime" framing (Hard rule #1 and R1 replace it). Rendering,
palettes, coordinates and asset rules are in `context/ARCHITECTURE.md`.
Per-subsystem detail: `game/src/{battle,menus,overworld,pikachu,renderer,story,text}/ARCHITECTURE.md`.
(Upstream also cites `data/DATA_FORMATS.md` — it does not exist.)

### Fidelity rules — the engine's house rule

A pixel-perfect, logic-exact port. Every implementation must:

1. **Read the relevant ASM first** — never assume how something looks, works or
   what text it shows.
2. **Match the original exactly** — no invented UI, no added text, no modified
   layouts, no "improvements".
3. **Preserve all Gen 1 bugs and quirks.**
4. **Verify coordinates, dimensions, text and flow** against the ASM before
   writing TypeScript.
5. **Never add content that isn't in the original** — no extra labels, helper
   text or UI enhancements.

Where to look in `refs/pokeyellow/`: `engine/` logic · `data/text/text_*.asm`
strings · `gfx/` sprites/tiles (`gfx/pokemon/front/*.png` to debug sprites) ·
`data/maps/headers/*.asm` + `data/maps/objects/*.asm` for new maps ·
`constants/` constants.

### Module map (`game/src/`)

Entry point: `index.html` → `src/main.ts`.

| Module | Purpose | Key exports |
|---|---|---|
| `core/` | Shared types, constants, player state | `Direction`, `MapData`, `NpcData`, `GB_WIDTH`, `TILE_SIZE`, `BLOCK_PX`, `getPlayerName()`, `setPlayerName()`, `substituteNames()` |
| `renderer/` | Canvas 2D rendering | `initRenderer()`, `drawTile()`, `drawSprite()`, `loadTileset()`, `loadSprite()` |
| `input/` | Keyboard + touch (arrows/WASD, Z=A, X=B, Enter=Start; mobile overlay) | `updateInput()`, `isHeld()`, `isPressed()`, `setKey()`, `initTouchControls()` |
| `text/` | Dialogue box + game text lookup | `TextBox`, `initTextSystem()`, `charToTile()`, `loadGameText()`, `getText()`, `getFontCanvas()` |
| `overworld/` | Maps, player, NPCs, story state, transitions | `GameMap`, `Player`, `Npc`, `applyStoryNpcState()`, `performWarpLoad()` |
| `battle/` | Wild/trainer battles, evolution | `Battle`, `loadBattleData()`, `createPokemon()`, `tryWildEncounter()`, `checkEvolutions()`, `applyEvolution()` |
| `menus/` | All menus, title/intro screens | `StartMenu`, `PartyMenu`, `ShopMenu`, `ItemMenu`, `YesNoMenu`, `TownMap`, `BlackboardMenu`, `PcMenu`, `PokecenterPcMenu`, `BillsPcMenu`, `TrainerCard`, `OptionMenu`, `SaveMenu`, `PokedexMenu`, `TitleScreen`, `MainMenu`, `OakSpeech`, `NamingScreen`, `drawBox()`, `loadEdTile()` |
| `pikachu/` | Follower, happiness, battle & emotion; spawn states after a warp (`pikachu_spawn.ts`, V1b) | `PikachuFollower`, `modifyPikachuHappiness()`, `initPikachuBattle()`, `warpSpawnState()` |
| `story/` | Per-map story scripts & hidden events | `buildOakGrassScript()`, `buildOaksLabIntroScript()`, `buildOaksLabPokedexScript()`, `buildViridianMartParcelScript()` |
| `script/` | Cutscene script engine & controller | `initScript()`, `updateScript()`, `ScriptCommand` |
| `audio/` | GB audio engine (2 pulse, wave, noise) | `initAudio()`, `resumeAudio()`, `playMusic()`, `playSFX()`, `stopMusic()`, `tickAudio()`, `isMusicPlaying()`, `isSfxPlaying()`, `suspendAudio()`, `resumeAudioOutput()` |
| `rom/` | Extraction system — see below | `validateRom()`, `extractRom()`, `installRomData()`, `showUploadScreen()` |
| `items.ts` | Bag & PC item storage | `Bag`, `ItemStack`, `addToInventory()`, `initItemNames()`, `getItemName()` |
| `save.ts` | Save/load via localStorage | `saveGame()`, `loadGame()` |
| `events.ts` | Event flags | `setFlag()`, `hasFlag()` |
| `pokedex_state.ts` | Seen/owned tracking | `markSeen()`, `markOwned()`, `isSeen()`, `isOwned()`, `restorePokedex()` |
| `debug.ts` | Debug overlay (backtick): tile grid, stats, HP, status, stat stages, badges, bag, Pikachu mood, warp-to-location | `renderDebugOverlay()`, `updateDebugPanel()`, `consumeDebugWarp()` |

### Game state machine (`main.ts`)

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
trainer_approach  trainer NPC walks toward player
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
pikachu_battle    Oak catches Pikachu cutscene
pikachu_emotion   animated Pikachu face box
evolution         post-battle evolution (sprite morph, B cancels)
script            cutscene script engine running
```

Other keys: `p` pauses (suspends the AudioContext); `-` / `+` change the sim FPS
(upstream: default 50, range 10–200, stored in localStorage `p151-f`).

**Game loop (ours, R1b — DECISIONS #27).** `gameLoop()` (rAF) calls
`runDueTicks()` then renders. Browsers stop rAF in background tabs, so
`startBackgroundTicker()` runs a tiny inline Web Worker (`setInterval` 8 ms,
not throttled like main-thread timers) that calls `runDueTicks()` whenever rAF
has been idle for 100 ms. Game logic and `tickAudio()` keep running unfocused;
drawing resumes with rAF. `input.ts` releases every held key on window `blur`,
because the keyup events are lost while unfocused. `p` still pauses everything.

### Overworld movement pitfalls

- **Turn delay** is 1 frame (ASM sets `BIT_TURNING`, loops back to OverworldLoop
  once) — no multi-frame delay.
- **Wall bump**: walk-in-place animation + collision SFX repeats every 8 frames
  while the direction is held.
- **Map connections fire mid-step.** `performMapConnection` must call
  `player.cancelMovement()` after repositioning, or the next `update()`
  interpolates from the old map's target and snaps the player to a wrong spot.
- **Scripted movement**: `startScriptedMove` cancels in-progress movement. ASM
  `SimulateJoypadStates` goes through the full overworld engine (collision +
  connections); our `updateScriptedMove` moves directly without collision — don't
  copy ASM joypad paths that go off-map.

### Data conventions

- **Names in JSON**: `<PLAYER>` / `<RIVAL>` tokens in NPC dialogue and signs —
  `TextBox.show()` substitutes them. In TypeScript story scripts use
  `getPlayerName()` / `getRivalName()` template literals instead.
- **Pokemon sprites by dex number**: `/gfx/sprites/front/{dex}.png`; pass
  `species.id` to `loadPokemonSprites()`.
- **Dialogue** via `getText('KEY')` (`src/text/game_text.ts`, from `game_text.json`).
- **Item names** via `getItemName(id)` (`src/items.ts`, from `item_names.json`).
- **Asset paths use real names**: `/gfx/title/pokemon_logo.png`,
  `/gfx/title/pikachu_bg.png`, `/gfx/sprites/pikachu.png` (follower),
  `/gfx/pikachu/` (emotion faces).

### ROM extraction system (`src/rom/`)

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
  Viridian Forest set; NPCs can carry `item` and trainer fields), music (47 listed, 46 actually
  extract), SFX (**10** extract: only names with an entry in `audio.ts`
  `SFX_HEADERS` — `index.ts` lists 36 unique names, the setup script 46, and
  `extractSfx()` returns null for the rest; V5 expands `SFX_HEADERS`),
  wave samples, noise instruments, font / font_extra / font_battle_extra,
  tilesets, battle HUD, title screen (+ tilemaps), overworld sprites (~70),
  Pokemon front/back (302), trainer & player sprites, emotes, party icons, town
  map, Pokédex tiles, trainer card, heal machine.

### Testing

409 tests in 14 files (vitest, `environment: 'node'`):

- **Battle** — 334 tests across 11 files in `src/battle/`.
- **Pikachu spawn** — 10 in `src/pikachu/pikachu_spawn.test.ts` (V1b): Yellow's
  spawn states per warp, and placement + facing per state.
- **Extraction** — 59 in `src/rom/__tests__/extraction.test.ts`; compares each
  extractor with the JSON in `data/`. Needs `ROM_PATH`, skipped otherwise.
  Its Pikachu and old-man pixel tests compare against pret's PNGs in
  `refs/pokeyellow/gfx/` and return early if `refs/` isn't cloned. The V1 block
  (added in V1a) checks the new maps against values transcribed from the ASM:
  trainer headers, NPC ids and facing parsed from `data/maps/objects/*.asm`,
  item balls, and the leaving-sign bug.
- **Static export** — 6 in `src/rom/__tests__/static_export.test.ts` (R1a): key
  shape, the four grays, lossless PNG round-trip of all 519 images, extracted JSON
  == `data/`, and **`static/` not stale**. If that last one fails after an
  extractor edit, re-run `npm run setup pokeyellow.gbc`. Needs `ROM_PATH`.
- **Setup** (`src/test/setup.ts`) stubs `fetch` to serve `data/*.json`, and calls
  `process.exit(1)` if `data/` is missing.
- **Helpers** (`src/test/helpers.ts`): `makePokemon(overrides?)`,
  `mockRandom(values[])`, `mockRandomFixed(value)`, `restoreRandom()`.
- **Battle messages** are `string[][]` — `result.messages[0][0]` or
  `result.messages[0].join(' ')`.

### Audio (`src/audio/`)

Three layers: extraction (ROM → JSON), synthesizer (Web Audio
`ScriptProcessorNode`), music engine (command interpreter).

| File | Purpose |
|---|---|
| `index.ts` | `initAudio()`, `resumeAudio()`, `playMusic(name)`, `playSFX(name)`, `stopMusic()`, `tickAudio()` |
| `music_engine.ts` | Interpreter ticked at ~59.7 Hz; channel suppression while SFX play |
| `sfx_engine.ts` | SFX on channels 5–8 overriding music channels 1–4; `square_note` (direct frequency), `pitch_sweep` (NR10) |
| `synthesizer.ts` | Per-sample generation of all 4 channels: pulse (phase accumulator + duty table), wave (32-sample lookup), noise (LFSR + 64 Hz hardware envelope in the callback) |
| `frequency_table.ts` | Note → Hz, matching `Audio1_CalculateFrequency` (SRA shift, octave 1 = highest) |
| `src/rom/extractors/audio.ts` | Parses binary music/SFX commands from the ROM |

- **Music JSON** (`audio/music/*.json`): `channels[].commands[]` — `tempo`,
  `volume`, `note_type`, `octave`, `note`, `rest`, `duty_cycle`, `vibrato`,
  `pitch_slide`, `drum_speed`, `drum_note`, `sound_call` / `sound_loop` / `sound_ret`.
- **SFX JSON** (`audio/sfx/*.json`): channels 5–8 — `square_note`, `noise_note`,
  `pitch_sweep`, `duty_cycle`, `sound_loop`, `sound_ret`.
- **Map music**: `MAP_MUSIC` in `main.ts` (from `data/maps/songs.asm`);
  `updateMapMusic()` only restarts when the track changes. Every new map needs an
  entry — and outdoor maps need adding to `OUTDOOR_MAPS` (door SFX choice).
- Audio ticks at a fixed 59.7275 Hz off `performance.now()`, independent of game FPS.
- Each note resets volume to `volumeInitial` from the last `note_type` (GB
  envelope re-trigger). Wave `note_type` 2nd param = output level (0–3), 3rd =
  wave instrument. Drum notes use `audio/noise_instruments.json`.
- Flow: splash click unlocks audio → title music through main menu → stops on
  Continue/New Game → map music in the overworld. Battle music starts at the
  transition, not after battle init. Victory fanfare
  (`defeatedwildmon`/`defeatedtrainer`) fires from `battle.onVictory` when the last
  enemy faints; map music resumes after. `meetprofoak` plays in the Oak grass
  cutscene (`pallet_town.ts` `callback`).
- SFX wired upstream: `press_ab` on every A/B in menus/textboxes, `collision` on
  wall bumps, `start_menu`, `go_inside` / `go_outside` on door warps.
- Upstream's own to-do: remaining music tracks, music fade in/out, Pokemon cries,
  Pikachu PCM cries.

### Battle mechanics already implemented (upstream)

- **1/256 miss**: even 100%-accuracy moves roll, 1/256 miss (`damage.ts`).
- **Badge stat boosts**: Boulder→ATK, Thunder→DEF, Soul→SPD, Volcano→SPC, +12.5%
  each; applied at battle init, switch-in, level-up and after **any** stat-stage
  change (Gen 1 reapplication bug). Badges flow `main.ts` → `Battle`
  (`damage.ts:applyBadgeStatBoosts`).
- **Focus Energy bug**: divides crit rate by 4.
- **Faint**: `SlideDownFaintedMonPic` — slides down 8 rows × 2 frames, HUD clears after.
- **Blackout**: `SET_PAL_BATTLE_BLACK` filter, "out of useable POKéMON!" /
  "blacked out!", halves money, heals party, warps to the last Pokécenter door
  (`handleBlackoutWarp`, `lastBlackoutWarp` saved).
- **Evolution**: level-based, post-battle (`evolution.ts:checkEvolutions`),
  8-cycle accelerating animation per `engine/movie/evolution.asm`, B cancels,
  auto-renames an un-nicknamed mon, updates the Pokédex.
- **Move learning** with a full moveset: `pendingMoves` →
  `learn_move_prompt` → `learn_move_select` → `learn_move_confirm`, text from
  `data/text/text_7.asm`; B / NO loops back to the full TryingToLearn text.

### Pikachu happiness (`src/pikachu/pikachu_happiness.ts`)

ASM: `engine/events/pikachu_happiness.asm`, `engine/pikachu/pikachu_emotions.asm`.
State: `pikachuHappiness` 0–255 (default 90), `pikachuMood` 0–255 (default 128);
face = mood × happiness matrix → 20 animation scripts. **Bug reproduced:**
USEDITEM happiness fires *before* checking whether the item has any effect
(`item_effects.asm:941`) — a Potion on full-HP Pikachu still counts.

Implemented (effect tiers are happiness <100 / <200 / 200+):

| Event | Effect | Mood | Trigger |
|---|---|---|---|
| LEVELUP | +5/+3/+2 | 0x8A | `main.ts` after level gain |
| FAINTED | −1/−1/−1 | 0x6C | `main.ts`, player mon faints (level gap < 30) |
| WALKING | +2/+1/+1 | 0x80 | `overworld_controller.ts`, every 256 steps |
| GYMLEADER | +3/+2/+1 | 0x80 | `main.ts:startTrainerBattle`, before gym leaders |
| USEDITEM | +5/+3/+2 | 0x83 | `battle.ts:usePotion/useStatusHeal`, `item_menu.ts:useItemOnMon` — Pikachu only |
| CARELESSTRAINER | −5/−5/−10 | 0x6C | `battle.ts:checkFaint` + `main.ts`, enemy 30+ levels higher |

**Not yet implemented — add when the system is built:**

| Event | Effect | Mood | ASM | Add where |
|---|---|---|---|---|
| USEDXITEM | +1/+1/+0 | 0x80 | `engine/items/item_effects.asm` (X items, Dire Hit, Guard Spec) | `battle.ts:handleItemUse` when X items land, if target is Pikachu (data ready, no trigger) |
| USEDTMHM | +1/+1/+0 | 0x94 | `item_effects.asm` ~l.2468 | after a successful TM/HM teach on Pikachu (**A2**) |
| DEPOSITED | −3/−3/−5 | 0x62 | `engine/pokemon/bills_pc.asm` | Bill's PC deposit of Pikachu (**E2**) |
| PSNFNT | −5/−5/−10 | 0x62 | `engine/events/poison.asm` | Pikachu faints from overworld poison (**A3**) |
| TRADE | −10/−10/−20 | 0x00 | `engine/link/cable_club.asm` | trading Pikachu away |
| `wd49b` emotion override | — | varies | `pikachu_emotions.asm:346` | item reactions: stone refusal (1), healing (2), item refusal (4), Thunder/Thunderbolt learning (5); skips mood update when set |
| NPC happiness checks | — | — | Cerulean Melanie (147), Museum 2F Hiker (101), Celadon Mansion | `getPikachuHappiness()` in those map scripts (**V3** Museum, **B2**, **D3**) |
