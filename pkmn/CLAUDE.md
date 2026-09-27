# CLAUDE.md

TypeScript browser rewrite of Pokemon Yellow — a full rewrite (not emulation) converting Z80 assembly into HTML5 Canvas. All game content is extracted from a user-uploaded ROM at runtime — no copyrighted assets are shipped with the code.

## Development Prerequisites

This project requires the [pret/pokeyellow](https://github.com/pret/pokeyellow) disassembly as a reference for implementing features. Clone it alongside this repo:

```
your-projects/
├── pokeyellow/          # git clone https://github.com/pret/pokeyellow
└── pokemon-yellow-typescript/    # this repo
```

The ASM source is the single source of truth for all game logic, UI layouts, text strings, and sprite data. Claude Code (and developers) need access to it for:
- Adding new maps → read `data/maps/headers/*.asm`, `data/maps/objects/*.asm`
- Debugging sprites → compare against `gfx/pokemon/front/*.png`
- Implementing features → read `engine/*.asm` for exact logic
- Verifying text → read `data/text/text_*.asm` for exact strings

## CRITICAL: Pixel-Perfect ASM Fidelity

This project is a **pixel-perfect, logic-exact port** of the original Pokemon Yellow. Every implementation MUST:

1. **Read the relevant ASM files FIRST** — never assume how something looks, works, or what text it displays.
2. **Match the original game exactly** — no invented UI, no added text, no modified layouts, no "improvements".
3. **Preserve all Gen 1 bugs and quirks** — they are features of faithful reproduction, not things to fix.
4. **Verify coordinates, dimensions, text, and flow** against the assembly before writing any TypeScript code.
5. **Never add content that doesn't exist in the original game** — no extra labels, no helper text, no UI enhancements.

ASM reference paths (in the pokeyellow disassembly): `engine/` for logic, `data/text/` for strings, `gfx/` for sprites/tiles, `data/maps/` for map data, `constants/` for game constants.

## Commands

```bash
npm run setup <rom>   # Extract dev data from ROM (required before running tests)
npx vite              # Start dev server (ROM upload required on first visit)
npx tsc --noEmit      # Type-check without emitting
npm test              # Run all tests (requires setup first)
npm run test:watch    # Run tests in watch mode
ROM_PATH=<rom> npm test  # Run all tests including ROM extraction verification
```

TypeScript is strict mode with `noUnusedLocals` and `noUnusedParameters` enabled — fix all warnings before committing.

### Testing

375 tests across 12 files using **vitest**:
- **Battle tests** (334): across 11 files in `src/battle/`
- **ROM extraction tests** (41): `src/rom/__tests__/extraction.test.ts` — verifies every extractor against ground-truth JSON files. Requires `ROM_PATH` env var; skipped otherwise
- **Test setup** (`src/test/setup.ts`): Mocks `fetch` globally to serve `data/*.json` from disk. Requires running `npm run setup <rom>` first to generate `data/`
- **Test helpers** (`src/test/helpers.ts`): `makePokemon(overrides?)` factory, `mockRandom(values[])` / `mockRandomFixed(value)` / `restoreRandom()`
- **Message format**: All battle messages are `string[][]`. Access as `result.messages[0][0]` or `result.messages[0].join(' ')`

## Architecture

Entry point: `index.html` -> `src/main.ts`

| Module | Purpose | Key exports |
|--------|---------|-------------|
| `src/core/` | Shared types, constants, player state | `Direction`, `MapData`, `NpcData`, `GB_WIDTH`, `TILE_SIZE`, `BLOCK_PX`, `getPlayerName()`, `setPlayerName()`, `substituteNames()` |
| `src/renderer/` | Canvas 2D rendering | `initRenderer()`, `drawTile()`, `drawSprite()`, `loadTileset()`, `loadSprite()` |
| `src/input/` | Keyboard + touch input (arrows/WASD, Z=A, X=B, Enter=Start; mobile touch overlay with D-pad/A/B/Start/Select) | `updateInput()`, `isHeld()`, `isPressed()`, `setKey()`, `initTouchControls()` |
| `src/text/` | Dialogue text box + game text lookup | `TextBox`, `initTextSystem()`, `charToTile()`, `loadGameText()`, `getText()`, `getFontCanvas()` |
| `src/overworld/` | Maps, player, NPCs, story state, transitions | `GameMap`, `Player`, `Npc`, `applyStoryNpcState()`, `performWarpLoad()` |
| `src/battle/` | Wild/trainer battle system, evolution | `Battle`, `loadBattleData()`, `createPokemon()`, `tryWildEncounter()`, `checkEvolutions()`, `applyEvolution()` |
| `src/menus/` | All menus, title/intro screens | `StartMenu`, `PartyMenu`, `ShopMenu`, `ItemMenu`, `YesNoMenu`, `TownMap`, `BlackboardMenu`, `PcMenu`, `PokecenterPcMenu`, `BillsPcMenu`, `TrainerCard`, `OptionMenu`, `SaveMenu`, `PokedexMenu`, `TitleScreen`, `MainMenu`, `OakSpeech`, `NamingScreen`, `drawBox()`, `loadEdTile()` |
| `src/pikachu/` | Pikachu follower, happiness, battle & emotion | `PikachuFollower`, `modifyPikachuHappiness()`, `initPikachuBattle()` |
| `src/story/` | Per-map story scripts & hidden events | `buildOakGrassScript()`, `buildOaksLabIntroScript()`, `buildOaksLabPokedexScript()`, `buildViridianMartParcelScript()` |
| `src/items.ts` | Bag & PC item storage | `Bag`, `ItemStack`, `addToInventory()`, `initItemNames()`, `getItemName()` |
| `src/save.ts` | Save/load via localStorage | `saveGame()`, `loadGame()` |
| `src/events.ts` | Event flag system | `setFlag()`, `hasFlag()` |
| `src/pokedex_state.ts` | Pokedex seen/owned tracking | `markSeen()`, `markOwned()`, `isSeen()`, `isOwned()`, `restorePokedex()` |
| `src/script/` | Cutscene script engine & controller | `initScript()`, `updateScript()`, `ScriptCommand` |
| `src/audio/` | Game Boy audio engine (4 channels: 2 pulse, wave, noise) | `initAudio()`, `resumeAudio()`, `playMusic()`, `playSFX()`, `stopMusic()`, `tickAudio()`, `isMusicPlaying()`, `isSfxPlaying()`, `suspendAudio()`, `resumeAudioOutput()` |
| `src/rom/` | ROM extraction system — extracts all game data from user-uploaded ROM | `validateRom()`, `extractRom()`, `installRomData()`, `showUploadScreen()` |
| `src/debug.ts` | Debug overlay (backtick key): tile grid, stats, HP, status, stat stages, badges, bag, pikachu mood, warp-to-location | `renderDebugOverlay()`, `updateDebugPanel()`, `consumeDebugWarp()` |

**For detailed subsystem docs, read the `ARCHITECTURE.md` in the relevant `src/` subdirectory.**
Data file format docs are in `data/DATA_FORMATS.md`.

### Game State Machine (`main.ts`)

```
'overworld'        -> player walks, NPCs move, check warps/connections/encounters
'textbox'          -> dialogue text box active
'transition'       -> fade-out -> async map load -> fade-in
'battle'           -> battle controller owns update+render
'battle_transition'-> visual transition effect before battle starts
'trainer_approach'  -> trainer NPC walks toward player
'start_menu'       -> right-side overlay menu
'save_menu'        -> save confirmation + saving flow
'option_menu'      -> full-screen settings
'trainer_card'     -> player card display
'party_menu'       -> party list (STATS, SWITCH, CANCEL)
'shop'             -> pokemart BUY/SELL/QUIT
'item_menu'        -> item bag selection
'pc'               -> player's PC item storage (Red's house PC)
'pokecenter_pc'    -> pokecenter PC (SOMEONE's PC / YELLOW's PC / LOG OFF -> BillsPcMenu / PcMenu)
'blackboard'       -> interactive menu board
'dex'              -> pokedex list/data/area screens
'town_map'         -> map overlay
'pikachu_battle'   -> Oak catches Pikachu cutscene
'pikachu_emotion'  -> animated Pikachu face box
'evolution'        -> post-battle evolution animation (sprite morph, B to cancel)
'script'           -> cutscene script engine running
'splash'           -> "Click to start" screen (unlocks browser audio)
'title_screen'     -> animated title screen with Pikachu
'main_menu'        -> NEW GAME / CONTINUE / OPTION
'oak_speech'       -> Prof Oak intro sequence (portraits, text, naming)
'naming_screen'    -> full keyboard for entering player/rival names
```

### Coordinate Systems

- **Pixels**: raw screen coordinates (160x144 native, scaled up)
- **Tiles**: 8x8 pixels. Player position stored in pixels, `tileX`/`tileY` = `Math.round(px / 8)`
- **Blocks**: 4x4 tiles = 32x32 pixels. Map dimensions are in blocks.
- **Steps**: 16x16 pixels (2 tiles). NPC/warp/sign coords use step units.
- **Camera**: `getCameraX() = player.x - 64`, `getCameraY() = player.y - 60`
- **Walk speed**: 2px/frame, 8 frames per step (assembly: `wWalkCounter=8`, step vector doubled via `add a`). Player/NPC/Pikachu all use same speed.
- **Turn delay**: 1 frame (assembly: sets `BIT_TURNING`, loops back to OverworldLoop once). No multi-frame delay.
- **Wall bump**: Walking-in-place animation + collision SFX repeats every 8 frames while direction held.
- **Map connections mid-step**: When the player walks off a map edge, the connection fires mid-step. `performMapConnection` must call `player.cancelMovement()` after repositioning to clear stale `moving`/`targetX`/`targetY`. Without this, the next `update()` interpolates from the old-map target and snaps the player to a wrong position.
- **Scripted movement**: `startScriptedMove` cancels any in-progress movement. Assembly `SimulateJoypadStates` goes through the full overworld engine (collision + connections); our `updateScriptedMove` moves directly without collision. Don't copy assembly joypad paths that go off-map.

### Asset Pipeline (ROM-Only)

No game assets are shipped with the code. All game data is extracted from a user-uploaded ROM at runtime.

- `publicDir: false` — NO static game data in `dist/` (~348KB total, zero `.json`/`.png` files)
- All data extracted at runtime from user-uploaded ROM via `src/rom/` system
- **Fetch override**: `window.fetch` is intercepted to serve ROM-extracted JSON data. For known game-data paths not in the cache (e.g., `wild/RedsHouse1F.json`), returns a local 404 instantly — no network request.
- **Graphics cache injection**: `rawImageCache` in `renderer.ts` is pre-populated with decoded tile data. `loadImage()` also checks this cache and returns a canvas, so both `getRawImageData()` and direct image loads work.
- **URL normalization**: Both `/gfx/foo.png` and `gfx/foo.png` resolve to the same cache entry via `normalizeUrl()`.
- **IndexedDB caching**: Extracted data stored in browser for instant loads on return visits

**Dev setup** (optional, for running tests):
- `npm run setup <path-to-rom.gbc>` — extracts JSON data to `data/` (gitignored)
- The test suite's mock fetch reads from `data/` — requires this setup step

**Data conventions**:
- **Dynamic names in JSON**: Use `<PLAYER>` and `<RIVAL>` tokens in NPC dialogue and sign text. `TextBox.show()` calls `substituteNames()` to replace these with the actual player/rival names at render time. In TypeScript story scripts, use `getPlayerName()` / `getRivalName()` template literals instead.
- **Pokemon sprite paths use dex numbers**: `/gfx/sprites/front/{dexNum}.png`, not species names. Pass `species.id` to `loadPokemonSprites()`.
- **Dialogue text uses `getText()`**: All dialogue loaded from `game_text.json` via `getText('KEY')` from `src/text/game_text.ts`. Extracted from ROM at runtime.
- **Item display names**: Use `getItemName(id)` from `src/items.ts`. Names loaded from `item_names.json`.
- **Asset paths use real names**: Title screen uses `/gfx/title/pokemon_logo.png`, `/gfx/title/pikachu_bg.png`, etc. Pikachu follower uses `/gfx/sprites/pikachu.png`. Pikachu emotion faces in `/gfx/pikachu/`.

### ROM Extraction System (`src/rom/`)

Extracts all game data from a Pokemon Yellow ROM binary in the browser. No game assets are checked into the repository — `data/` can be generated locally via `npm run setup <rom>` for testing.

| File | Purpose |
|------|---------|
| `src/rom/index.ts` | Public API: `validateRom()`, `extractRom()`, orchestrates all extractors |
| `src/rom/binary_reader.ts` | ArrayBuffer utilities, SHA1 hashing |
| `src/rom/rom_offsets.ts` | Hardcoded ROM byte offsets (from `pokeyellow.sym`) |
| `src/rom/constants.ts` | Non-copyrightable enum constants only: TYPE_NAMES, EFFECT_NAMES, GROWTH_RATE_NAMES |
| `src/rom/sprite_decompress.ts` | Gen 1 sprite decompression (port of `home/uncompress.asm`) |
| `src/rom/tile_decoder.ts` | 1bpp/2bpp Game Boy tile format → grayscale ImageData |
| `src/rom/data_provider.ts` | Install fetch override + graphics cache injection |
| `src/rom/upload_ui.ts` | ROM upload screen UI + IndexedDB cache check |
| `src/rom/rom_cache.ts` | IndexedDB storage for extracted data |
| `src/rom/extractors/*.ts` | Per-data-type extractors (pokemon, moves, types, trainers, wild, maps, audio, etc.) |

**Adding a new extractor**: Create `src/rom/extractors/foo.ts`, export an `extractFoo(rom: BinaryReader, ...)` function that returns data matching the ground-truth JSON format, add it to `index.ts`, add a verification test in `src/rom/__tests__/extraction.test.ts`. For name-string data, accept name lookup tables as parameters (built from ROM in `index.ts` via `readMoveNames()`, `readItemNames()`, etc. from `extractors/text.ts`). For NPC/sign text, use `textOffset` (sym-file ROM offsets) or `readMapText()` (TextPointers → text_far chain).

**Sprite bank lookup** (`src/rom/extractors/sprites.ts`): Pokemon sprite data banks are determined by **internal species ID** thresholds (from `home/pics.asm`), NOT dex numbers. Convert dex→internal ID by scanning the `PokedexOrder` table in reverse. **Pitfall**: `PokedexToIndex` at `10:5086` is a function (machine code), NOT a data table — never read raw bytes from it.

**IndexedDB cache version** (`src/rom/rom_cache.ts`): Bump `CACHE_VERSION` (currently 8) when extraction code or output paths change to invalidate stale cached data.

**Key interception points** (minimal game engine changes):
- `renderer.ts:injectRawImage()` — pre-populate `rawImageCache` with ROM-decoded ImageData. Also `loadImage()` checks the cache and returns a canvas when available.
- `window.fetch` override in `data_provider.ts` — serve JSON/binary from ROM. Returns local 404 for missing game-data paths to prevent network noise.
- `main.ts` — ROM mode is always enabled; IndexedDB cache provides instant loads after first upload

**Extractors implemented** (all verified against ground truth with 41 tests):
pokemon, moves, types, trainers, wild encounters, blocksets, collision tiles, pokedex, maps (12), music (50+ tracks), SFX (37), wave samples, noise instruments, sprite decompression, font, font_extra, font_battle_extra, tilesets, battle HUD, title screen (graphics + tilemaps), all overworld sprites (~70), Pokemon front/back sprites (302), trainer sprites, player sprites, emotes, party icons, town map, pokedex tiles, trainer card, healing machine

### Audio System (`src/audio/`)

Three-layer architecture: **data extraction** (ASM → JSON), **synthesizer** (Web Audio API via ScriptProcessorNode), **music engine** (command interpreter).

**Files:**
| File | Purpose |
|------|---------|
| `src/audio/index.ts` | Public API: `initAudio()`, `resumeAudio()`, `playMusic(name)`, `playSFX(name)`, `stopMusic()`, `tickAudio()` |
| `src/audio/music_engine.ts` | Music command interpreter — ticked at ~59.7Hz, processes music commands, updates synth. Supports channel suppression when SFX is active |
| `src/audio/sfx_engine.ts` | SFX engine — plays sound effects on channels 5-8 that override music channels 1-4. Uses `square_note` (direct frequency) and `pitch_sweep` (NR10 hardware sweep) |
| `src/audio/synthesizer.ts` | ScriptProcessorNode: sample-by-sample generation of all 4 channels. Pulse uses phase accumulator + duty table, wave uses phase accumulator + 32-sample waveform lookup, noise uses LFSR with hardware envelope running at 64Hz inside the audio callback |
| `src/audio/frequency_table.ts` | Note → Hz lookup matching `Audio1_CalculateFrequency` (SRA shift, octave 1=highest) |
| `src/rom/extractors/audio.ts` | ROM extractor: parses binary music/SFX commands from ROM |

**Music data format** (`data/audio/music/*.json`): Each track has `channels[]`, each channel has `commands[]`. Commands: `tempo`, `volume`, `note_type`, `octave`, `note`, `rest`, `duty_cycle`, `vibrato`, `pitch_slide`, `drum_speed`, `drum_note`, `sound_call`/`sound_loop`/`sound_ret`.

**SFX data format** (`data/audio/sfx/*.json`): Each SFX has `channels[]` (id 5-8), each channel has `commands[]`. Commands: `square_note` (direct 11-bit frequency), `noise_note`, `pitch_sweep`, `duty_cycle`, `sound_loop`, `sound_ret`.

**Music tracks extracted**: 50+ tracks extracted from ROM at runtime. The ROM extractor (`src/rom/extractors/audio.ts`) parses binary music commands directly and extracts all tracks listed in the `MUSIC_HEADERS` table.

**Map music system:** `MAP_MUSIC` lookup table in `main.ts` maps each map name to its music track (from `data/maps/songs.asm`). `updateMapMusic()` starts the track only if different from current (avoids restarting same music on indoor transitions within a town).

**Key implementation details:**
- Audio ticks at fixed 59.7275 Hz using `performance.now()` accumulator (independent of game FPS)
- Each note resets volume to `volumeInitial` from last `note_type` (matching GB hardware envelope re-trigger)
- Splash screen ("Click to start") unlocks browser audio before title screen
- Title music starts after splash click and continues through main menu
- Music stops on Continue/New Game selection; map music starts on entering overworld
- Battle music (`wildbattle`/`trainerbattle`) starts at transition effect (before sprites load), NOT after battle init. Victory fanfare (`defeatedwildmon`/`defeatedtrainer`) triggers via `battle.onVictory` callback when last enemy faints. Map music resumes on return to overworld.
- `meetprofoak` plays during the Oak grass cutscene (triggered via script `callback` command in `pallet_town.ts`)
- Pause (`p` key) suspends/resumes the AudioContext to mute audio
- SFX channels 5-8 temporarily suppress corresponding music channels 1-4; music resumes when SFX finishes
- SFX_PRESS_AB plays on all A/B button presses in menus/textboxes; SFX_COLLISION on wall bumps; SFX_START_MENU on start button; SFX_GO_INSIDE/SFX_GO_OUTSIDE on door warps
- Drum notes trigger noise instruments from `data/audio/noise_instruments.json` with hardware envelope simulation
- Wave channel: `note_type` second param = output level (0-3), third = wave instrument index

**Next steps (Phase 3):** Remaining ~36 music tracks, music fade in/out transitions, Pokemon cries, Pikachu cries (PCM).

### Palette System & Color Correction

Palettes are defined in `src/renderer/palettes.ts` using RGB555 values from the assembly's `CGBBasePalettes`. A **GBC LCD color correction** is applied (`gbcCorrect()`) to approximate real hardware output — raw RGB555→RGB888 produces incorrect colors (e.g., pure yellow #FFFF00 instead of the correct warm gold #EBC15C).

When adding a new screen, find which `SET_PAL_*` the assembly uses (in the relevant `.asm` file), trace it through `data/sgb/sgb_packets.asm` → `PAL_SET` → `data/sgb/sgb_palettes.asm` → `CGBBasePalettes` to find the palette name (e.g., `PAL_MEWMON` → `'MEWMON'`). Pass this name to `loadTileset()`/`loadSprite()`. There is no `'DEFAULT'` palette — unknown names fall back to `'ROUTE'`.

### Gen 1 Battle Mechanics (faithfully implemented)

- **1/256 miss glitch**: Even 100% accuracy moves go through the RNG accuracy check, giving a 1/256 miss chance (`damage.ts`)
- **Badge stat boosts**: Boulder→ATK, Thunder→DEF, Soul→SPD, Volcano→SPC, each +12.5%. Applied at battle init, switch-in, level-up, and after ANY stat stage change (Gen 1 reapplication bug). Badges passed from `main.ts` → `Battle` constructor (`damage.ts:applyBadgeStatBoosts`)
- **Focus Energy bug**: Divides crit rate by 4 instead of multiplying (making crits *less* likely)
- **Faint animation**: `SlideDownFaintedMonPic` — sprite slides down off-screen (8 rows × 2 frames), HUD clears after (`battle_ui.ts:renderPlayerSpriteFaintSlide/renderEnemySpriteFaintSlide`)
- **Blackout/whiteout**: When all party Pokemon faint, `SET_PAL_BATTLE_BLACK` (high-contrast B&W filter via `ctx.filter = 'saturate(0) contrast(10)'`) is applied. Shows "<PLAYER> is out of useable POKéMON!" then "<PLAYER> blacked out!". Halves money, heals party, warps to last pokecenter door (`handleBlackoutWarp` in `main.ts`). Last heal location tracked in `lastBlackoutWarp` (persisted in save)
- **Evolution**: Post-battle level-based evolution check (`evolution.ts:checkEvolutions`). White background, colored old sprite → PAL_BLACK silhouettes during animation → colored new sprite. Assembly-accurate 8-cycle accelerating animation (`engine/movie/evolution.asm`: b=1→8 swaps, c=16→2 delay frames, 80-frame pre-delay). B button cancels. Auto-renames if nickname matches old species. Updates Pokedex. Text from `data/text/text_4.asm` (`_EvolvedText`, `_IntoText`, `_StoppedEvolvingText`) and `data/text/text_5.asm` (`_IsEvolvingText`)
- **Move learning flow**: When moveset is full on level-up, `experience.ts` returns `pendingMoves` (no silent replacement). Battle enters interactive states: `learn_move_prompt` → `learn_move_select` → `learn_move_confirm`. Text strings from `data/text/text_7.asm` (TryingToLearnText, WhichMoveToForgetText, AbandonLearningText, OneTwoAndText, PoofText, ForgotAndText, DidNotLearnText). Move select screen: box at `hlcoord 4,7` (`lb bc,4,14`), moves at `(6,8)`, cursor at `(5,8)`, bottom text "Which move should be forgotten?". B on move select or NO on abandon → loops back to full TryingToLearnText (assembly `.loop` label). Yes/no menu only renders when `textQueue` is empty (after all preamble text is dismissed)

### Pikachu Happiness System

Assembly ref: `engine/events/pikachu_happiness.asm`, `engine/pikachu/pikachu_emotions.asm`

State: `pikachuHappiness` (0-255, default 90), `pikachuMood` (0-255, default 128). Face selection uses a mood×happiness matrix → 20 animation scripts. Code: `src/pikachu/pikachu_happiness.ts`.

**Assembly bug (faithfully reproduced):** USEDITEM happiness triggers BEFORE checking if the item has any effect (`item_effects.asm:941`). Using a Potion on full-HP Pikachu still boosts happiness. This applies in both battle and overworld item use.

**Implemented events** (7 of 11):

| Event | Effect (tiers: <100/<200/200+) | Mood target | Trigger location |
|-------|-------------------------------|-------------|-----------------|
| LEVELUP | +5/+3/+2 | 0x8A | `main.ts` — after battle level gain |
| FAINTED | -1/-1/-1 | 0x6C | `main.ts` — when player mon faints (level gap < 30) |
| WALKING | +2/+1/+1 | 0x80 | `overworld_controller.ts` — every 256 steps |
| GYMLEADER | +3/+2/+1 | 0x80 | `main.ts:startTrainerBattle` — before gym leader battles |
| USEDITEM | +5/+3/+2 | 0x83 | `battle.ts:usePotion/useStatusHeal` + `item_menu.ts:useItemOnMon` — on Pikachu only |
| USEDXITEM | +1/+1/+0 | 0x80 | Data ready, no trigger yet (X items not implemented) |
| CARELESSTRAINER | -5/-5/-10 | 0x6C | `battle.ts:checkFaint` + `main.ts` — when enemy is 30+ levels higher |

**NOT YET IMPLEMENTED — add when systems are built:**

| Event | Effect | Mood | ASM trigger | Where to add in JS |
|-------|--------|------|-------------|--------------------|
| USEDXITEM | +1/+1/+0 | 0x80 | `engine/items/item_effects.asm` (X Attack, X Defend, X Speed, X Special, X Accuracy, Dire Hit, Guard Spec) | When X-stat items are added to `battle.ts:handleItemUse`, call `modifyPikachuHappiness('USEDXITEM')` if target is Pikachu |
| USEDTMHM | +1/+1/+0 | 0x94 | `engine/items/item_effects.asm` line 2468 | When TM/HM teaching is implemented, add happiness call after successful teach on Pikachu |
| DEPOSITED | -3/-3/-5 | 0x62 | `engine/pokemon/bills_pc.asm` | When Bill's PC deposit is implemented, add happiness call when depositing Pikachu |
| PSNFNT | -5/-5/-10 | 0x62 | `engine/events/poison.asm` | When overworld poison damage is implemented, add happiness call when Pikachu faints from poison |
| TRADE | -10/-10/-20 | 0x00 | `engine/link/cable_club.asm` | When trading is implemented, add happiness call when trading Pikachu away |
| `wd49b` emotion override | N/A | varies | `engine/pikachu/pikachu_emotions.asm:346` | Special Pikachu reactions to items: evolution stone refusal (1), healing (2), item refusal (4), Thunder/Thunderbolt learning (5). Skips mood target update when set. Add when item reactions are implemented |
| NPC dialogue checks | N/A | N/A | Cerulean Melanie (threshold 147), Museum 2F Hiker (threshold 101), Celadon Mansion | Add `getPikachuHappiness()` checks in map scripts when these maps are created |
