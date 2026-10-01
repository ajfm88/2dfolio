# Story & Script System Architecture

## Event Flags

- **Storage** (`src/events.ts`): `Set<string>`, persisted in save data
- **Key flags**: `OAK_APPEARED_IN_PALLET`, `FOLLOWED_OAK_INTO_LAB`, `GOT_STARTER`, `OAK_ASKED_TO_CHOOSE_MON`, `BATTLED_RIVAL_IN_OAKS_LAB`, `GOT_POTION_SAMPLE`, `HIDDEN_ITEM_*` (per hidden item)
- **Story triggers**: Pallet Town north exit -> Oak grass script; OaksLab entry -> lab intro; Route 1 -> free Potion NPC

## Script Engine Commands

Commands available in `ScriptCommand` union (from `src/script/types.ts`):
`text`, `moveNpc`, `movePlayer`, `faceNpc`, `facePlayer`, `wait`, `setFlag`, `addPokemon`, `showNpc`, `hideNpc`, `unhideNpc`, `callback`, `warp`, `exclamation`, `pikachuBattle`, `moveParallel`, `awaitInteraction`, `startBattle`, `healParty`, `pokecenterHeal`, `pikachuToNurse`, `hidePikachu`, `showPikachu`, `fadeOut`, `fadeIn`, `yesNo`, `giveItem`, `removeItem`

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
| `hidden_events.ts` | 64 | Scripted hidden events (school notebook, etc.) |
| `../script/` | 880 | Script types, engine (createScript, advanceScript), controller (updateScript, render helpers) |
| `../overworld/story_state.ts` | 182 | NPC visibility/dialogue based on event flags |
