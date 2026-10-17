# Story & Script System Architecture

## Event Flags

- **Storage** (`src/events.ts`): `Set<string>`, persisted in save data
- **Key flags**: `OAK_APPEARED_IN_PALLET`, `FOLLOWED_OAK_INTO_LAB`, `GOT_STARTER`, `OAK_ASKED_TO_CHOOSE_MON`, `BATTLED_RIVAL_IN_OAKS_LAB`, `GOT_POTION_SAMPLE`, `HIDDEN_ITEM_*` (per hidden item)
- **Story triggers**: Pallet Town north exit -> Oak grass script; OaksLab entry -> lab intro; Route 1 -> free Potion NPC; Viridian City (19,9) / (32,8) -> the old men and the Gym door

## Map Script State (V1e)

- **Storage** (`src/events.ts`): each map's resting `w<Map>CurScript`, via `getMapScript()` / `setMapScript()`, saved as `mapScripts`; cleared by a new game. Only resting states are stored: the ASM's other states run with input locked and are one command list each (`setMapScript` command at their end).
- **Viridian City** (`viridian_city.ts`): `viridianCityStep()` says which check fires per state; the Gym-door push-back leaves the city in `POST_CATCH_TRAINING`, which disables the (19,9) check (a Gen 1 quirk kept on purpose, DECISIONS #34).

## Script Engine Commands

Commands available in `ScriptCommand` (from `src/script/types.ts`):
`displayOpen`, `printText`, `displayHide`, `displayClose`, `displayCloseInPlace`,
`whiteOut`, `townMap`, `pokemart`, `pc`, `menuBox`, `menuInput`, `restoreSavedScreen`,
`yesNoChoice`, `emotionBubble`, `healJingle`, `restoreMapMusic`, `sound`, `textButtonWait`,
`hideObject`, `moveNpc`, `movePlayer`, `pushPlayer`, `tryPikachuMovement`, `faceNpc`,
`facePlayer`, `wait`, `setFlag`, `clearFlag`, `setMapScript`, `addPokemon`, `showNpc`,
`hideNpc`, `unhideNpc`, `callback`, `warp`, `catchDemo`, `moveParallel`, `awaitInteraction`,
`startBattle`, `healParty`, `pokecenterHeal`, `pikachuToNurse`, `hidePikachu`, `showPikachu`,
`pikachuStandDown`, `updateSprites`, `pikachuFacing`, `ifStarterPikachu`, `fadeOut`,
`fadeIn`, `giveItem`, `removeItem`. `pushPlayer` simulates one joypad step, with collision/ledges.

Retained blocking routines used by pickups (A1b, migrated in A5b4; legacy retirement A5b7g1):

| Command | Behavior |
|---|---|
| `printText` | Runs a named program and returns on `TextBox.isComplete`, retaining the display |
| `sound` | Plays once, waits for `isSoundFinished()`; `waitForCurrent` waits before playing too |
| `textButtonWait` | Silent A/B wait, no arrow; requires an active DisplayTextID session, otherwise throws without reading input |
| `displayClose` | Optional outer silent wait, Hold while A is down, then the map's `5 + 2W` close and trailing UpdateSprites |
| `hideObject` | Saves a `Map:npcId` key and hides the live NPC/collision slot immediately |

Button waits and Hold read Joypad; sound waits and close copies do not. They freeze
the world. Returning from these routines runs the next command in the same frame.
Retained text continues through `giveItem`/`setFlag` immediately, preserving the
73/181-update jingle traces. A script ending with a retained display dismisses it
as a guard. Script `text`/`closeText`, the non-display button-wait fallback and
unused `commandState`/`isCommandDone` scaffolding were retired in A5b7g1.
Terminators and paging belong to the source program/printer; battle text is a
separate union and remains A5c.

## Handler dispatch and retained displays (A5b5a–c)

`text_handlers.ts` registers `(mapName, textId)` handlers with live flag/bag/party,
owned-count, facing/step, live NPC lookup and nurse-only heal-callback context. The controller dispatches
generated `handler` calls to the registry; missing entries retain their existing
path. Generated `script` calls use `registerTextScript`/`getTextScript` by script
kind; `pokecenterNurse` is registered, without an NPC-id dispatch check.
`displayTextID(body, {autoBox, outerWait})` emits the opening, body and
closing envelope. The registry covers Mom, Daisy, Route 1 and Viridian's gambler,
caterpillar youngster, girl and three old men, Pallet Oak and Lab rival/ball/Oak.
Mom's TV uses text ID 2; its hidden
event at (3,1) routes to this handler, which reads the player's facing.
`small_text_handlers.ts` contains branches and source program names; migrated
builders contain no legacy text commands or hand-written game text.

`displayOpen` opens in the dispatch tick, `printText` runs a named program with
bindings, and `displayClose` owns outer wait/Hold/the exact close. Every PrintText
clears and adds three frames; direct prints use `box: 'keep'`. `yesNoChoice` opens
over the retained display on the text's return tick, without another message or
dismissal, and owns its Joypad reads. Its optional Pokécenter layout is HEAL/CANCEL
at (11,6), with the blank first row specified by the cartridge. Legacy script
yesNo is retired; the notebook now uses yesNoChoice too (A5b6).

`emotionBubble` uses A1c's 61-frame counter for player or NPC while retaining the
display; no input/world updates until its trailing font-loaded sprite update.
Pallet and the Lab now use this bubble command. `healJingle` waits for the
music load and CHAN1's final sound_ret, then restores map music. The audio facade's
read-only `isMusicChannelActive(1)` matches Mom's wChannelSoundIDs poll; the
engine's isPlaying latch remains enabled after finite tracks and is unsuitable
for this wait. No audio engine/interpreter/synthesizer change.

Once a script has opened a migrated display, DelayFrames returns into its next
command on the last tick and does not sync input. Instantaneous migrated side
effects also return into their next command in that CPU tick. Pre-display and legacy movement
waits retain their verified timing. START and text close update the same map plus
script NPC list (A5b4 N-2). Current prof_script/prof_enter/prof_desk are removed by
hideNpc before their scenes finish; no current script NPC persists afterward.

Mom heals after rest text and plays the real jingle, preserving the existing
blackout destination (note 33 N-1). Only the nurse calls SetLastBlackoutMap.
Mom's ReloadMapData after the white-out fade is not modelled; the map remains
loaded, so it has no visible effect today (note 33 N-2). Mart's first sprite
update retains the existing map-entry timing (note 33 N-3).
Daisy gives/hides/prints/flags
in source order; Route 1 sets its sample flag before give even if full; Mart has
two direct displays, LEFT/UP/UP, Delay3, then gives after the parcel program and
close. Viridian's Gen 1 state quirks and movement paths remain. School/Town Map and shop/PCs now use their A5b6/A5b7 retained paths.

`pokecenter.ts` owns the nurse's one display and five source programs. Welcome
returns before setting saved `USED_POKECENTER` (wStatusFlags4 BIT_USED_POKECENTER);
ShallWeHeal runs only on the first visit, including when that visit is declined.
Both answers update sprites with the actual box coverage, then YES alone records
the blackout destination. The box hides for Pikachu's walk and for the 40-frame
bow, while the same display remains active; PrintText restores its border with
Delay3. NeedYourPokemon stays up through the machine. The extracted pauses in
ShallWeHeal/Farewell cost 30 frames unless A/B is held. Farewell then updates
sprites and uses the outer wait/Hold/17-frame close. Saved Pikachu live facing
is restored at close start; its image waits for the trailing update. A6e paths,
waits, fainted-slot behavior and the existing machine internals remain.

The machine's fade-out, sounds/jingle/flashes and heal ordering are a separate
approved slice after A5b7 and before V2 (DECISIONS #50). The Pewter LooksContent
branch is deliberately absent, guarded by a map-existence tripwire. Cable club
receptionist/link features need a user decision. `textButtonWait` remains for
the hidden-item full-bag path; `closeText` has been retired.
`exclamation` and `uiEntryUpdates` commands have been removed.

A5b7d moves RED_PC/POKECENTER_PC hidden events onto retained display scripts.
`pc` enters the same MenuSession slot as `pokemart`; ScriptDeps supplies item
storage plus party/boxes/current-box bridge callbacks. Both entries close without
an outer wait. The PC host selects today's Bill screen while its `fullScreen`
flag is set; returning resumes this display. See menus/ARCHITECTURE.md for timing.

## School and Town Map handlers (A5b6)

`hidden_events.ts` owns the notebook and blackboard on one DisplayTextID each,
first glyph +23 and Hold/13-frame close without an outer wait. The notebook's
three TurnPageText returns open yesNoChoice (+3 read, 15-frame answer tail);
NO ends reading, YES reaches page 4 and the girl's arrow-less button wait.
The blackboard loops through `menuBox`, instant Text2, then `menuInput` (+6
from loop start). LEFT/RIGHT re-loop in either column; rows do not wrap.
All five headings come from programs. B/QUIT `restoreSavedScreen`, then close.

HOUSE wall maps dispatch TOWN_MAP_TEXT to `buildTownMapSignScript`: direct
TownMapText +20, promptButton arrow/beep, white-out 3 + font copy 17,
the `townMap` action, `displayCloseInPlace`, then Hold and full-reload
`displayClose`. Two closes and two trailing updates: Blue's House 9/14,
Route 2 trade house 11/17, Nickname House 13/22. Main suppresses an opening
sprite update on the Town Map's return. Its own screen internals remain deferred.

Pallet's HEY_WAIT retains its box across DelayFrames 10 and the player bubble;
it closes without an outer wait. Greeting/Whew wait; ComeWithMe is direct.
Its existing movement geometry and catch demo are preserved. Map-script callback
prefixes that reach a display start in their dispatch tick; async and movement
prefixes keep their existing boundaries.

`lab_text_handlers.ts` selects the rival's three branches and Oak's ordered
owned-count/bag/flag branches at talk time. Ordinary Lab displays disable the
automatic border: opening takes 20 frames, inner PrintText draws it and adds 3.
The ball bubble stays borderless for 61 frames, then closes in 15. The snatch
has five PrintTexts inside one display; the gift has two, waits for the actual
key-item jingle, then adds Pikachu, hides its follower and flags GOT_STARTER.
There is no automatic advice afterward. Follower drawing remains disabled in
the Lab until the existing post-rival escape callback at the first dislike-text
close. Battle strings still use the legacy renderer; source program names are
flattened only at that boundary until A5c.

During the Lab's retained `awaitInteraction`, `guardProgram` is required. Other NPCs run nested registered
handlers or source-program displays and return to the same await. The guard
prints, closes, forces one UP, and waits three frames. The target's A press
starts the ball display in that tick. Every current free-move NPC resolves to a
handler/plain call (tripwired); an unresolved NPC throws instead of falling back
to legacy text. The guard always follows its step with Delay3. Hidden-event and
bookshelf strings still use DisplayTextID until g2, with automatic borders enabled
as their cartridge routines request (A5b7g1 F-1). They return to the same await;
script-id hidden events remain g2's shared-builder work. The temporary prof_desk uses text ID 3.
The parcel's grouped program removes the parcel before its outer wait; the
subsequent seven direct Pokédex displays explicitly enable automatic borders,
first write at +20, and retain the source DelayFrame/Delay3 calls. Flags and
Viridian map state change after the final display. Existing A6 paths remain.

Approved gaps: Oak's rating branch prints its lead-in and closes without a
rating screen. Route 22's Poké Ball gift remains I1; a tripwire detects its
flags becoming settable. PrintText's own sprite update remains J2.

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

- **Mom healing**: RedsHouse1F text ID 1 selects wake or rest/heal/jingle/looking-great at talk time
- **Pokecenter nurse**: generated `pokecenterNurse` script dispatches to `pokecenter.ts`; one display, first-use prompt, HEAL/CANCEL, A6e movement/machine/bow, farewell and outer close. Assembly: `engine/events/pokecenter.asm`.
- **RedsHouse1F TV**: hidden-event coordinates route text ID 2; the handler selects front/back from live facing
- **Oak visibility**: Always hidden in PalletTown via `applyStoryNpcState()`
- **Script NPCs**: Dynamic NPCs in `scriptNpcs[]`, separate from map NPCs, cleared on map change
- **New game start**: RedsHouse2F at tile (6,4), no Pokemon, no items

## Key Files

| File | LOC | Purpose |
|------|-----|---------|
| `oaks_lab.ts` | 188 | Lab source-program displays and retained A6 movement paths |
| `lab_text_handlers.ts` | 32 | Live rival, ball and Oak branches |
| `pallet_town.ts` | 128 | Oak's grass encounter and phase-selected handler |
| `viridian_mart.ts` | 45 | Parcel delivery event |
| `viridian_city.ts` | 230 | Viridian City's map script: the three old men, the catch demos, the Gym door (V1e) |
| `hidden_events.ts` | 64 | Scripted hidden events (school notebook, etc.) |
| `../script/` | 880 | Script types, engine (createScript, advanceScript), controller (updateScript, render helpers) |
| `../overworld/story_state.ts` | 126 | NPC visibility, shop availability and defeated tracking |
