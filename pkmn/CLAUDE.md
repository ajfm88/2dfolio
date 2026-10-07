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

**Scale:** ~1–2 years, on the order of **700–800 sessions**. The 36 milestones in
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
| `PLAN.md` | the phased roadmap — 36 milestones (R1, V1–V5, A1–A6, B1–X2; R1 ran as slices R1a–c, V1 runs as V1a–e) | when picking or sizing work |
| `CONVENTIONS.md` | session contract (incl. the per-slice local commit), code standards, naming traps, verification workflow | before writing code |
| `DECISIONS.md` | settled choices and rationale (#1–#35), plus open questions that need the user | before proposing a change to a settled choice |
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
  `data/`, then rebuild `static/` (520 PNGs + 3 tilemaps + a JSON mirror). ~1.5 s
- `npm test` — vitest (needs `data/`; the suite exits if it is missing). Without
  `ROM_PATH` the 74 ROM tests skip
- `npm run test:watch` — vitest in watch mode
- `ROM_PATH=pokeyellow.gbc npm test` — full suite incl. extraction + static-export
  tests. **Baseline 2026-10-06 (A1a): 812/812.**
- `npx vite --host 127.0.0.1 --port 5173 --strictPort` — dev server serving `static/`
  (no ROM involved). Plain `npx vite` binds IPv6 `::1` on this machine, so
  `127.0.0.1` won't connect; saves live on `http://127.0.0.1:5173/` (origin-scoped). Missing files are real 404s
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
is being rebuilt as **Phase V**. **V1 (Route 2 + Viridian Forest) is done**
(2026-09-25), in five slices (DECISIONS #29, `notes/v1-plan.md`):
- V1a extracted the 7 maps and their trainer data.
- V1b made them playable, with Yellow's Pikachu spawn states and the player's facing
  kept through warps.
- V1c runs trainer battles as `home/trainers.asm` does.
- V1d built the catch demo that the old man and Oak's Pikachu catch share.
- V1e ported the real Viridian old men and deleted both upstream demo gates. The city's
  script state is saved (DECISIONS #34). The walk north is open.

Also, since 2026-09-25 the game ticks at the Game Boy's 59.7275 Hz (DECISIONS #33). Since
2026-09-28 (A6a) the overworld moves on the ASM's 2-frame pass: the player walks 16 frames
a step, NPCs 34 (DECISIONS #36). Upstream had run the player at 2× and NPCs at 4×.
A6a was user-verified in the browser on 2026-10-01.
A6b (2026-10-01) ported the order inside a pass: map scripts before input, the step-end
order, the encounter rules, NPC pop-in and hiding under menus, and NPCs keeping their
facing. Reviewed and user-verified. **570/570**, typecheck/build clean.
A6c (**done, user-verified 2026-10-04**): NPCs
turn and wander by Yellow's direction byte, displacement bytes and pixel sprite
collisions; beaten trainers turn at random; Pikachu glances and does its four antics;
turning into Pikachu blocks seven checks; boxes and menus hide or reset Pikachu as
DisplayTextIDInit does. **705/705**, typecheck/build clean.
A6d (**done, user-verified 2026-10-04**; planned by Claude, implemented by Sol, reviewed
by Claude): the ROM ledge shadow, the extra landing UpdateSprites, and Pikachu on Yellow's
follow-command buffer: it waits on the takeoff tile and crosses the ledge in one flat
2-tile move on the next step. **729/729**, typecheck/build clean; no-ROM suite
**657 pass, 72 skip**.
A6e (**done, user-verified 2026-10-05**; planned by Sol, implemented by Claude, reviewed
by Sol): Yellow's `ApplyPikachuMovementData` interpreter
(`pikachu/pikachu_movement.ts`, data `pikachu_movement.json`) drives Viridian's
step-aside, Oak's Lab's step after "GRAMPS!" (missing before), the walk to the nurse
with the heal's Pikachu handoffs, and the emotion preludes before the portrait.
It runs in the cartridge's byte coordinates. **776/776**, typecheck/build clean; no-ROM
suite **702 pass, 74 skip**. **Milestone A6 is done** (A6a–A6e).
A1a (**done 2026-10-06**: reviewed by Codex with no findings, `notes/a1a-review.md`; user-verified by ear: "very high fidelity and very close to what the game boy sounds like";
`notes/a1a-plan.md`, DECISIONS #40):
- The item jingles are extracted and play as music-mode SFX on one shared channel
  interpreter.
- That interpreter now follows `engine_1.asm` for the music too:
  - the wave channel an octave lower;
  - perfect pitch;
  - vibrato, including rate 0;
  - silent rests;
  - the SFX hand-off.
- `isSoundFinished()` answers `WaitForSoundToFinish`.

**812/812**; no-ROM **731 pass, 81 skip**. Next: A1b, A1c, A5, V2.
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
| `input/` | Keyboard + touch (arrows/WASD, Z=A, X=B, Enter=Start; mobile overlay); the overworld's joypad read per standing pass (A6a) | `updateInput()`, `isHeld()`, `isPressed()`, `readJoypad()`, `syncJoypadRead()`, `isPassPressed()`, `setKey()`, `initTouchControls()` |
| `text/` | Dialogue box + game text lookup | `TextBox`, `initTextSystem()`, `charToTile()`, `loadGameText()`, `getText()`, `getFontCanvas()` |
| `overworld/` | Maps, player, NPCs, story state, transitions; the overworld's pace (`walk_pace.ts`, A6a); sprite collisions (`sprite_collision.ts`, A6c) | `GameMap`, `Player`, `Npc`, `applyStoryNpcState()`, `performWarpLoad()`, `PassClock`, `PlayerWalk`, `NpcWalk`, `updateSprites()`, `spriteTable()`, `collisionMask()` |
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
`PassClock` for the states `overworld`, `script` and `trainer_approach`: their movement,
`UpdateSprites` and the joypad read (standing passes only) happen on every second tick.
Text, script `wait`s, fades, audio and battles still count frames. The state machines are
in `overworld/walk_pace.ts`; details in `src/overworld/ARCHITECTURE.md` → *Pace*.

### Overworld movement pitfalls

- **Everything that moves counts passes, not frames** (A6a): the player 2 px a pass
  (16 frames a step), NPCs 1 px after a start pass (34), Yellow's fast NPC codes 18.
  New movement code goes through `PlayerWalk` / `NpcWalk`, never a per-frame speed.
- **Turning** takes one pass, only while `wCheckFor180DegreeTurn` is set (a pass with
  nothing pressed sets it, only a turn clears it) and toward a direction other than the
  last stop direction. The turning pass skips `UpdateSprites`.
- **Wall bump**: walk-in-place animation every pass; `collision` replays only when it
  isn't already playing (`isSfxPlaying('collision')`).
- **Map connections fire mid-step.** `performMapConnection` must call
  `player.cancelMovement()` after repositioning, or the next `update()`
  interpolates from the old map's target and snaps the player to a wrong spot.
- **Scripted movement**: `startScriptedMove` cancels in-progress movement. ASM
  `SimulateJoypadStates` goes through the full overworld engine (collision +
  connections); our `updateScriptedMove` moves directly without collision — don't
  copy ASM joypad paths that go off-map.
- **One-step push-backs are `pushPlayer`, not `movePlayer`** (V1e, DECISIONS #34):
  `pushPlayer` runs `player.update` with a simulated direction, so the step collides,
  hops ledges (the Viridian Gym door hops the ledge below it) and takes no turning
  frame, as `StartSimulatingJoypadStates` does.
- **Step triggers vs. a held key** — fixed by A6a: a held direction starts the next step
  on the pass after one ends. A6b moves the map triggers into `runMapScript`, before
  `readJoypad` on every standing pass, including returns from text/battles/warps. The
  old take-the-step-back workaround (`forgetPlayerStep`) is gone.
- **Sprite blocking is pixel geometry, not tile claims** (A6c): `sprite_collision.ts` in
  the Game Boy screen basis, the player's mask taken before NPCs move, NPCs in slot order,
  the exact-front check after. Don't reintroduce `claimedTile` reservations or an origin
  box; wanderers are bounded by the displacement bytes and the screen edge.
- **Pikachu has three update paths**: `updateSprite(ctx)` from `updateSprites` (idles,
  antics), `fontLoadedUpdate(ctx)` once per UI opening (`overworld/ui_entry.ts`, from
  `main.ts` `checkUiEntry`), and `startMovement` / `tickMovement` for Yellow's movement
  interpreter (A6e; never idles). New cutscene code that moves Pikachu runs one of its
  byte programs (extract it into `pikachu_movement.json`), never pixel paths; a map
  script's call is `tryPikachuMovement` (guard + refresh), a direct call has neither.
  New UI states that draw over the map belong in `ui_entry.ts`'s list.
- **Pikachu's map position is its own state** (A6e): `mapStepX/Y` are MAPX/MAPY, not
  rounded pixels. Follow commands move it as they start, the interpreter as each absolute
  command ends; a call blocks the script, holds the pass clock and draws Pikachu in slot 0.
- **Pikachu follows the native command buffer (A6d)** (`pikachu/follow_buffer.ts`):
  `recordStepForPikachu` uses `startedFollowStep` after UpdateSprites, including both
  halves of a hop. The newest entry stays retained; follow hops move two tiles without
  an arc on the next player step.
- **Map script state** (`w<Map>CurScript`): keep a map's resting state with
  `getMapScript` / `setMapScript` (`events.ts`, saved as `mapScripts`). Viridian City
  is the first user (`story/viridian_city.ts`).

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

### Testing

812 tests in 33 files (vitest, `environment: 'node'`):

- **A1a** adds 36:
  - `audio/sound_channel.test.ts` (18): channels by id, the wave octave, perfect pitch,
    vibrato (period, rate 0, clamps, direction across notes), the note arithmetic (with a
    whole-library zero-delay check), silent rests, suppression, the SFX tempo, the hand-off
    and the update order (mutation-checked).
  - `audio/sfx_jingles.test.ts` (11): both jingles' note and end updates; the wait
    (73 / 181, channel 7 skipped, drums, channel 8, loading); drum drop and cancel;
    `press_ab` timing; a stopped SFX's release; the preload list.
  - 7 extraction tests: the headers against the sym file, and every channel against
    pret's asm parsed directly.
  - The rig is `src/test/audio_rig.ts`: a logging `GBSynthesizer` and `audioUpdate()`.
    Audio tests import the engines, never `audio/index.ts` (it touches `window`).

- **A6e** adds 38 (net): `pikachu/pikachu_movement.test.ts` (21: every opcode family,
  durations 37/69/67/35, the sine traces, the subtimer animation bug, turns, shadow and
  grass, no-init programs, the side check); 2 extraction tests (the JSON, and every
  record against the disassembly); controller tests for TryApply's guard and refresh on
  both pass parities, both lab branches, the nurse's three walks and a whole-heal trace
  (healthy, fainted and no starter), and the frozen world; `ui_entry.test.ts` for the
  emotion phases (entry turn, prelude, border 3 + 3, render frequency).

- **A6d** adds 24 tests: native buffer states and guard, hop-half toggle, flat hop and
  catch-up speeds, landing timing and input gates, shadow composition, two consecutive
  ledges, START refresh, healing and script completion. A 30-step pixel trace matches
  the committed position-buffer follower; a 200-step seeded walk keeps at most two
  entries. The ROM shadow matches pret's PNG pixel for pixel.

- **A6c** — `walk_pace.test.ts` grew to 55 (the direction byte, displacement bytes, the
  rewritten NPC block, the player's vector and Pikachu counter);
  `overworld/sprite_collision.test.ts` (29: geometry, screen edge, sprite in front, the
  counter rule); `pikachu/pikachu_idle.test.ts` (25) and `pikachu/pikachu_follower.test.ts`
  (23, render spy, UI coverage and the font-loaded reset); `overworld/ui_entry.test.ts`
  (9, the real START menu and Pikachu portrait through `captureUi`); 22 more controller tests (walking into
  Pikachu, slot order, beaten trainers, text and nurse openings).

- **Walk pace** — 29 in `src/overworld/walk_pace.test.ts` (A6a + A6b): the pass clock and `Delay3`,
  frames per step for the player (16), a normal NPC (34), a fast NPC (18) and an NPC in
  step with the player, the turn rule, the `UpdateSprites` call points, the walk
  animation with the mirrored frame, the ledge hop's jump table, wanderers' rests, and
  Pikachu's happiness-dependent animation.

- **A6b** — 15 step-end/Pikachu tests, 16 sprite visibility tests, 23 controller/NPC
  integration tests and 1 UI capture test. Covers the check order, counters, walking
  bonus/mood, turns, both hop halves, door exits, stationary/held-key triggers, pop-in,
  whole-sprite UI hiding and Oak's in-step animation. Walk pace adds fixed STAY delays.

- **Viridian City** — 21 in `src/story/viridian_city.test.ts` (V1e): the city's map
  script as data (which check fires per resting state, the Gym-door quirk, the badge
  rule), every command list (sleeping push, Gym push, forced demo, walk-aways, Pikachu
  stepping aside, repeat demo), old-save state derivation, and a guard that no "demo"
  text is back in `data/`.

- **Tick clock** — 11 in `src/core/tick_clock.test.ts` (2026-09-25): the Game Boy rate
  held on 60/120/144/165 Hz displays and the background worker, the leftover time kept,
  the backlog dropped after a long gap, and the `-`/`+` stops.
- **Battle** — 373 tests across 13 files in `src/battle/`. `encounter.test.ts` adds the
  A6b encounter gates and indoor/FOREST/water rules. `catch_demo.test.ts` (V1d, 11)
  covers the catch demo: the outcome rule, back pics and names, the one-ball bag, the
  toss animations, and the step list with its ASM frame counts. `trainer_flow.test.ts` (V1c)
  covers the trainer rules as data: meet/victory music, end-text pages (every map
  trainer's first line fits), the pic scroll, the win/loss step lists, and that every
  trainer class resolves to an exported pic. `data.test.ts` checks every trainer-party
  and wild species resolves (V1c).
- **Pikachu spawn** — 10 in `src/pikachu/pikachu_spawn.test.ts` (V1b): Yellow's
  spawn states per warp, and placement + facing per state.
- **Extraction** — 75 in `src/rom/__tests__/extraction.test.ts`; compares each
  extractor with the JSON in `data/`. Needs `ROM_PATH`, skipped otherwise.
  Its Pikachu and old-man pixel tests compare against pret's PNGs in
  `refs/pokeyellow/gfx/` and return early if `refs/` isn't cloned. The V1 block
  (added in V1a) checks the new maps against values transcribed from the ASM:
  trainer headers, NPC ids and facing parsed from `data/maps/objects/*.asm`,
  item balls, and the leaving-sign bug.
- **Static export** — 6 in `src/rom/__tests__/static_export.test.ts` (R1a): key
  shape, the four grays, lossless PNG round-trip of all 520 images, extracted JSON
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
| `index.ts` | `initAudio()`, `resumeAudio()`, `playMusic(name)`, `playSFX(name)`, `stopMusic()`, `tickAudio()`, `isSoundFinished()` (A1a), the SFX preload, the `_playSFX(name)` console helper |
| `sound_channel.ts` | **(A1a)** `SoundChannel`: one software channel of `Audio1_UpdateMusic`, the interpreter the music and music-mode SFX share (DECISIONS #40) |
| `music_engine.ts` | The track's channels (CHAN1–4) and `wMusicTempo`; suppression while SFX play; `releaseChannel`; channel 8's drum occupancy |
| `sfx_engine.ts` | SFX on channels 5–8 overriding music channels 1–4: SFX-mode `square_note` / `noise_note` / `pitch_sweep`, or, after `execute_music`, a `SoundChannel` at tempo $0100 |
| `sound_wait.ts` | **(A1a)** `audioUpdate()` (music, then SFX, each update) and `soundFinished()` (`WaitForSoundToFinish`: channels 5, 6, 8) |
| `sfx_names.ts` | **(A1a)** the extracted SFX, preloaded |
| `synthesizer.ts` | Per-sample generation of all 4 channels: pulse (phase accumulator + duty table), wave (32-sample lookup), noise (LFSR + 64 Hz hardware envelope in the callback) |
| `frequency_table.ts` | Note → Hz, matching `Audio1_CalculateFrequency` (SRA shift, octave 1 = highest); `waveRegisterToHz` (65536/(2048−x)) |
| `src/rom/extractors/audio.ts` | Parses binary music/SFX commands from the ROM; an SFX channel decodes as music after `execute_music` |

- **Music JSON** (`audio/music/*.json`): `channels[].commands[]` — `tempo`,
  `volume`, `note_type`, `octave`, `note`, `rest`, `duty_cycle`, `vibrato`,
  `pitch_slide`, `drum_speed`, `drum_note`, `sound_call` / `sound_loop` / `sound_ret`.
- **SFX JSON** (`audio/sfx/*.json`): channels 5–8 — `square_note`, `noise_note`,
  `pitch_sweep`, `duty_cycle`, `sound_loop`, `sound_ret`; a music-mode channel starts with
  `execute_music` and then uses the music commands (the item jingles `get_item1` /
  `get_item2`, A1a).
- **Map music**: `MAP_MUSIC` in `main.ts` (from `data/maps/songs.asm`);
  `updateMapMusic()` only restarts when the track changes. Every new map needs an
  entry — and outdoor maps need adding to `OUTDOOR_MAPS` (door SFX choice).
- Audio ticks at a fixed 59.7275 Hz off `performance.now()`, independent of game FPS.
  Each update runs the music channels, then the SFX channels (`audioUpdate`).
- **The interpreter's rules (A1a, `engine_1.asm`; detail in `sound_channel.ts` and
  `notes/a1a-plan.md`):**
  - **Channels:** the hardware channel comes from the id, `(id − 1) & 3`.
  - **Note lengths:** `(length × speed) & $ff` × tempo + the fraction, as 16 bits, into an
    8-bit counter.
  - **SFX tempo:** always $0100 (an SFX's `tempo` never reaches the music).
  - **Perfect pitch:** +1 on the frequency low byte.
  - **Vibrato:** every rate + 1 updates; rate 0 = every update. Low byte only, clamped;
    the direction is kept across notes.
  - **Wave channel:** an octave below a pulse at the same register. Every wave note loads
    the channel's own instrument.
  - **Envelope:** each note re-triggers it from the last `note_type` (`noteVolume` /
    `noteFade`). The software stand-in runs only for the channel's own trigger, so **a
    rest stays silent**.
- **SFX over music:** a music channel whose SFX channel is busy only counts. When the SFX
  ends (or is stopped), the music channel stays silent until its next note or rest. There
  is no mid-note restore. Drum hits hold software channel 8 for their instrument's length
  (a hit is dropped while it's busy); `isSoundFinished()` waits on channels 5, 6 and 8.
- Drum notes use `audio/noise_instruments.json`.
- Flow: splash click unlocks audio → title music through main menu → stops on
  Continue/New Game → map music in the overworld. Battle music starts at the
  transition, not after battle init. Victory fanfare
  (`defeatedwildmon`/`defeatedtrainer`) fires from `battle.onVictory`: a wild battle's
  when the enemy faints, a trainer's once the whole party is down (V1c); map music
  resumes after. Talking to a map trainer starts `meetmaletrainer` /
  `meetfemaletrainer` / `meeteviltrainer` when the before-battle text has typed
  (V1c, `trainer_flow.ts` `meetMusicFor`). `meetprofoak` plays in the Oak grass
  cutscene (`pallet_town.ts` `callback`).
- SFX wired upstream: `press_ab` on every A/B in menus/textboxes, `collision` on
  wall bumps, `start_menu`, `go_inside` / `go_outside` on door warps. The item jingles
  are extracted and playable (A1a). Nothing in the game plays them until A1b.
- Known audio departures, each with a home, are in `notes/a1a-plan.md` §8:
  - the pulse envelope runs per frame count, not at 64 Hz, and SFX tails are cut;
  - SFX priority isn't modelled;
  - the pitch-slide algorithm differs;
  - `.wave5` isn't extracted;
  - noise-channel rests don't silence it.
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
- **Trainer battles (V1c)**: before-battle text → meet music → battle; on a win the
  fanfare, "defeated", the pic scrolling back in, 40 frames, "CLASS: " + end text,
  money; beaten only after a win; after-battle text when talked to again; the Oak's
  Lab rival's loss has no blackout and records `rivalStarter`. Detail:
  `src/battle/ARCHITECTURE.md` → *Trainer Battles*.
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
| `wPikachuEmotionModifier` | — | — | `poison.asm` `.clearEmotionModifier`, `pikachu_happiness.asm` | blocks certain mood increases; walking clears it when mood reaches 128. Separate from `wd49b`; not implemented yet → Pikachu state audit / J2 |
| NPC happiness checks | — | — | Cerulean Melanie (147), Museum 2F Hiker (101), Celadon Mansion | `getPikachuHappiness()` in those map scripts (**V3** Museum, **B2**, **D3**) |
| Mood floor after battle | — | ≥ 130 ($82) | `engine/battle/end_of_battle.asm` → `pikachu_status.asm:117` `UpdatePikachuMoodAfterBattle` — after any battle not lost, if the starter Pikachu is alive in the party | `main.ts` battle-finish handler (found in V1c) |
