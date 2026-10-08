# Story & Script System Architecture

## Event Flags

- **Storage** (`src/events.ts`): `Set<string>`, persisted in save data
- **Key flags**: `OAK_APPEARED_IN_PALLET`, `FOLLOWED_OAK_INTO_LAB`, `GOT_STARTER`, `OAK_ASKED_TO_CHOOSE_MON`, `BATTLED_RIVAL_IN_OAKS_LAB`, `GOT_POTION_SAMPLE`, `HIDDEN_ITEM_*` (per hidden item)
- **Story triggers**: Pallet Town north exit -> Oak grass script; OaksLab entry -> lab intro; Route 1 -> free Potion NPC; Viridian City (19,9) / (32,8) -> the old men and the Gym door

## Map Script State (V1e)

- **Storage** (`src/events.ts`): each map's resting `w<Map>CurScript`, via `getMapScript()` / `setMapScript()`, saved as `mapScripts`; cleared by a new game. Only resting states are stored: the ASM's other states run with input locked and are one command list each (`setMapScript` command at their end).
- **Viridian City** (`viridian_city.ts`): `viridianCityStep()` says which check fires per state; the Gym-door push-back leaves the city in `POST_CATCH_TRAINING`, which disables the (19,9) check (a Gen 1 quirk kept on purpose, DECISIONS #34).

## Script Engine Commands

Commands available in `ScriptCommand` union (from `src/script/types.ts`):
`text`, `moveNpc`, `movePlayer`, `pushPlayer` (one simulated joypad step: collides, hops ledges), `movePikachu`, `faceNpc`, `facePlayer`, `wait`, `setFlag`, `clearFlag`, `setMapScript`, `addPokemon`, `showNpc`, `hideNpc`, `unhideNpc`, `callback`, `warp`, `exclamation`, `catchDemo`, `moveParallel`, `awaitInteraction`, `startBattle`, `healParty`, `pokecenterHeal`, `pikachuToNurse`, `hidePikachu`, `showPikachu`, `fadeOut`, `fadeIn`, `yesNo`, `giveItem`, `removeItem`

A1b adds the blocking text routines pickups need (`notes/18-a1b-plan.md` §4):

| Command | Behavior |
|---|---|
| `text` with `end: 'none'` / `'prompt'` | Advances on `TextBox.isComplete`, keeping the box open; the next text replaces its contents |
| `sound` | Plays once, waits for `isSoundFinished()`; `waitForCurrent` waits before playing too |
| `textButtonWait` | Silent A/B wait, without an arrow |
| `closeText` | Holds while A is down, then dismisses on the first A-up frame |
| `hideObject` | Saves a `Map:npcId` key and hides the live NPC/collision slot immediately |

Sound/button/close waits read the joypad every frame and freeze the world. Returning
from these routines runs the next command in the same frame. Retained text likewise
continues through `giveItem`/`setFlag` immediately, preserving the 73/181-update
jingle traces. A script ending with retained text dismisses it as a guard. Legacy
`text` behavior is unchanged; global terminators/paging timings belong to A5.

Saved object toggles are separate from event flags (`hiddenObjects` in `events.ts`).
Only objects that start ON are modeled today. `hideNpc` remains transient.

## Story Script Pattern

Each map's story script is a builder function (e.g., `buildOaksLabIntroScript()`) that returns a `ScriptCommand[]` array. Scripts are started via `initScript(commands)` and executed frame-by-frame by the script controller (`src/script/script_controller.ts`).

Exported builder functions (from `story/index.ts`):
- `buildOakGrassScript()` — Pallet Town Oak grass encounter
- `buildOaksLabIntroScript()` — Oak's Lab intro cutscene
- `buildOaksLabPokedexScript()` — Oak's Lab Pokedex delivery scene
- `buildViridianMartParcelScript()` — Viridian Mart parcel delivery event

## Special NPC Patterns

- **Mom healing**: RedsHouse1F, `__MOM_HEAL__` sentinel on NPC dialogue triggers heal script with fadeOut/fadeIn
- **Pokecenter nurse**: NPCs with `id="nurse"` trigger full heal script (ignoring JSON dialogue): yes/no prompt -> nurse turns UP->LEFT -> pokeball machine animation -> nurse turns UP->DOWN -> bow animation -> farewell. Uses `pokecenterHeal` script command. Assembly ref: `engine/events/pokecenter.asm`, `engine/overworld/healing_machine.asm`.
- **RedsHouse1F TV**: Hidden events with `facing: "up"` for direction-dependent text
- **Oak visibility**: Always hidden in PalletTown via `applyStoryNpcState()`
- **Script NPCs**: Dynamic NPCs in `scriptNpcs[]`, separate from map NPCs, cleared on map change
- **New game start**: RedsHouse2F at tile (6,4), no Pokemon, no items

## Key Files

| File | LOC | Purpose |
|------|-----|---------|
| `oaks_lab.ts` | 366 | Intro cutscene, ball selection, rival battle setup |
| `pallet_town.ts` | 113 | Oak's grass encounter script |
| `viridian_mart.ts` | 45 | Parcel delivery event |
| `viridian_city.ts` | 230 | Viridian City's map script: the three old men, the catch demos, the Gym door (V1e) |
| `hidden_events.ts` | 64 | Scripted hidden events (school notebook, etc.) |
| `../script/` | 880 | Script types, engine (createScript, advanceScript), controller (updateScript, render helpers) |
| `../overworld/story_state.ts` | 182 | NPC visibility/dialogue based on event flags |
