# A5b5 — the existing story handlers on the display session

**2026-10-11 · planned by Claude (Sonnet 5.5) · implementer: Sol (GPT-6.1), reviewer: Claude.** Planning only;
the only files this session added or changed are Markdown.

**Approved 2026-10-11.** The user answered *"go"* to §10: all six recommendations are settled as O-20 /
DECISIONS #49. §10 is kept for the reasoning.

A5b5 is the fifth A5b increment (`23-a5b-plan.md` §5–§6, DECISIONS #45): *"Pallet, Lab, Mart parcel, Mom,
Daisy, Route 1, Viridian, nurse; migrate grouped calls and bubbles."* A5b4 (user-verified 2026-10-11: "it
all works perfect") built the pieces: the text runner, the display session (`displayOpen` / `printText` /
`displayClose`), the exact `CloseTextDisplay`, the pickups. A5b5 is the first slice that moves **story
flows** onto them, so it is also the first that changes cutscene text timing you will see in a new game.

Read before coding: root `CLAUDE.md`, `context/STATUS.md`, `context/CONVENTIONS.md`,
`game/src/text/ARCHITECTURE.md`, `game/src/story/ARCHITECTURE.md`, `game/src/overworld/ARCHITECTURE.md`,
`30-a5b4-plan.md` and `31-a5b4-review.md` (the contracts this builds on), `23-a5b-plan.md` §3 and §5,
DECISIONS #44–#48, and this note. Start from **`7f1b7e7`** plus the docs commit that carries this plan
(clean tree). Baseline, as recorded by the A5b4 review and re-run by me then: **1064/1064** with `ROM_PATH`,
**944 pass / 120 skip** without; typecheck and build clean. This planning session did not re-run them.

## TL;DR

- **Three sub-slices, each its own commit set and review** (decision 1): **A5b5a** the handler
  foundation plus the small handlers (Mom and the TV, Daisy, Route 1, the Mart, Viridian's talkers and old
  men); **A5b5b** Pallet Town's Oak scene and all of Oak's Lab; **A5b5c** the Pokécenter nurse and the
  cleanup that deletes the old string-swapping. Do them in that order; Sol stops after each.
- **The idea that makes it small:** on the cartridge a `text_asm` handler *decides at the moment you talk*,
  from flags, what to print. The engine instead pre-swaps `npc.data.dialogue` strings from `story_state.ts`
  and uses sentinels (`__MOM_HEAL__`, `__DAISY_TOWN_MAP__`). A5b5 adds a **handler registry** — `(map,
  textId) → function returning the flow` — built on A5b4's session, and deletes the swaps. That also fixes
  A5a's N-1 (Route 1's youngster and Viridian's Drowzee man print the wrong first text) properly.
- **Every flow below was traced in the ASM this session** (§3): each `DisplayTextID`, `PrintText`, flag,
  delay, bubble and sound, in order. Sol re-derives them before coding each sub-slice.
- **The audit found places where today's TypeScript differs from the cartridge** (§5), including a text
  that does not exist on the cartridge (Oak's "advice" right after he gives you Pikachu), a missing healing
  jingle at Mom, a reversed Mart walk, and a `giveItem` before text where the cartridge gives after. Decision
  3 asks you to approve fixing them (you set the rule: no invented content).
- **Deliberately not here:** the Fisher's TM42 (needs TMs, A2), the Chansey and Spearow cries (J2), the
  Pokécenter receptionist's PC (A5b7), the Pokédex rating screen (not built), the school and Town Map
  (A5b6), the shop and menus (A5b7).

## 1. Deliverable and boundary

After A5b5:

1. A **handler registry** (`story/text_handlers.ts`) runs the cartridge's `text_asm` handlers for the
   current maps: the NPC or sign whose generated call kind is `handler` (and has an entry) opens a display
   session, runs the handler's body (conditions evaluated when you talk, as the ASM does), and ends with the
   handler's own ending (outer wait or not).
2. Every migrated flow prints through **text programs**, never TypeScript string literals or `getText()`.
3. The cutscenes in §3 run as the cartridge runs them: one `DisplayTextID` per call, `PrintText`s inside
   it, `EmotionBubble` while the box is up, `Delay3`/`DelayFrames` where the source has them, and the exact
   close (5 + 2W frames) after each display.
4. `story_state.ts` no longer swaps dialogue strings for migrated NPCs; the sentinels are gone.

**Not in A5b5** (homes in §9): anything listed under "Deliberately not here" above, the START menu and its
sub-menus, the shop, PCs, save, battle text, Pikachu's cries, `PrintText`'s own font-loaded `UpdateSprites`
(J2), movement timing (A6), and any new map or mechanic.

Hard rules hold: no ROM at runtime; `refs/**` and `pkmn-sprites/` read-only; generated files only from
`npm run setup`; Gen 1 quirks kept; local commits only, never pushed; do not edit the audio engines.

## 2. What exists (read this session)

| Piece | Today |
|---|---|
| `script/types.ts` | A5b4's `displayOpen {autoBox?, spriteUpdate?}`, `printText {program, bindings?, box?}`, `displayClose {outerWait}`; legacy `text`, `yesNo {message, yesBranch, noBranch}`, `textButtonWait`, `closeText`, `exclamation {target, frames}` (a fixed-frame bubble, 40 in Pallet, 30 in the Lab), `fadeOut/fadeIn`, `healParty`, `pokecenterHeal`, `giveItem` with branches, `tryPikachuMovement`, `moveParallel`, `awaitInteraction` … |
| `story/*.ts`, `overworld_controller.ts` | Pallet's Oak scene, the whole Lab, the Mart parcel, Viridian's old men, the nurse and Mom are command lists using `text` + `getText()` + hard-coded strings (the Daisy offer, "We hope to see you again!", the Caterpie speech) |
| `story_state.ts` | swaps `npc.data.dialogue` per flag for Mom, Route 1, Viridian (girl, Mart clerk), the Lab (Oak, rival) and Blue's House (Daisy, with sentinels) |
| Generated data | `text_programs.json` already has every handler's child programs, e.g. `OaksLabOak1Text.DeliverParcelText`, `PalletTownOakText.HeyWaitDontGoOutText`, `ViridianCityPrintYoungster2Text.YouWantToKnowAboutText`, `GotMapText`, `RedsHouse1FPrintMomText.WakeUpText` (112 handler/wrapper programs for these maps); map NPCs/signs carry `textId` and the call table says `handler` for 30 of them |
| A5b4 session | `open` (20 frames; border unless `autoBox: false`), `print` (`new` = clear + 3 frames; `keep` = neither), `finish` (outer wait / Hold / exact close); `startScript` runs a script's first update at once only when it begins with `displayOpen` |

Current maps' `handler`/`script` NPCs and signs (30): Pallet Oak; Mom; Daisy; Route 1 youngster1; the Lab's
Oak, rival and Eevee ball; Viridian's gambler, caterpillar youngster, girl, fisher, three old men; the Mart
needs scripts only (its clerk is the shop); the Forest and Route 2 item balls (A5b4); trainers (TalkToTrainer,
A5b4); Route 2 Gate's Aide and the Trade House kid (inert until A2/A4); the Nickname House's Spearow and the
Pokécenter's Chansey (cries, J2); the nurse and the receptionist (§9).

## 3. Cartridge flows (ASM-traced; cite `scripts/*.asm`, re-verify before coding)

Notation: **D(text)** = `DisplayTextID`: `DisplayTextIDInit` (20 frames; border unless the map disabled it),
the text's handler/program, the outer silent wait unless `wDoNotWait…` is set, Hold, the exact close
(`5 + 2W`; W for Pallet 9 → 23, Lab 5 → 15, Mart 4 → 13, Red's 1F 2 → 9, Blue's House 2 → 9, Viridian City
9 → 23, Pokécenter 6 → 17). **P(text)** = `PrintText`: clear + 3 frames. `EnableAutoTextBoxDrawing` also zeroes
`wDoNotWait…`; **only Oak's Lab disables the automatic box** (`OaksLab_Script`, every pass, and zeroes the
flag too). Every other current map enables it.

### 3.1 Small handlers (A5b5a)

| Flow | Sequence (ASM) |
|---|---|
| Mom, no starter (`RedsHouse1FPrintMomText`) | D(MOM): P(WakeUpText); outer wait |
| Mom, with starter | D(MOM): P(YouShouldRest); `GBFadeOutToWhite`; `ReloadMapData`; `HealParty`; play `MUSIC_PKMN_HEALED` and **wait until it finishes**; restore map music; `GBFadeInFromWhite`; P(LookingGreat); outer wait. Preserves the blackout map (corrected by note 33 N-1; only the nurse calls SetLastBlackoutMap) |
| TV | D(TV): P(StandByMe) if facing up else P(WrongSide) (handler reads the facing); outer wait |
| Daisy sitting (`BluesHouseDaisySittingText`) | D: `GOT_TOWN_MAP` → P(UseMap); else `GOT_POKEDEX` → P(OfferMap), `GiveItem TOWN_MAP`: ok → `HideObject TOWN_MAP`, P(GotMapText: key-item jingle), `SetEvent GOT_TOWN_MAP`; full → P(BagFull); else P(RivalAtLab). Outer wait. (Order: give, hide, text, flag) |
| Route 1 youngster1 (`Route1PrintYoungster1Text`) | D: flag-first (`CheckAndSetEvent GOT_POTION_SAMPLE`); already → P(AlsoGotPokeballs); else P(MartSample), `GiveItem POTION`: ok → P(GotPotion: `get_item1`), full → P(NoRoom). Outer wait |
| Mart entry (`ViridianMartDefaultScript`, map script, once) | `UpdateSprites`; D(CLERK_YOU_CAME_FROM_PALLET_TOWN: direct text) ; player **LEFT ×1, UP ×2** (simulated joypad); then (`ViridianMartOaksParcelScript`, when the push ends) `Delay3`; D(CLERK_PARCEL_QUEST: text + `get_key_item`); **then** `GiveItem OAKS_PARCEL`, `SetEvent GOT_OAKS_PARCEL`. No "got the parcel" text of its own |
| Mart clerk talk after delivery | table 2 text `ViridianMartClerkText` is the shop (A5b7); `…SayHiToOak` is table 1 |
| Viridian gambler1 | D: `GymLeaderReturned` if `wObtainedBadges == ~EARTHBADGE` or `BEAT_VIRIDIAN_GYM_GIOVANNI`, else `GymAlwaysClosed`. Outer wait |
| Viridian caterpillar youngster | D: P(YouWantToKnowAbout); `YesNoChoice`; no → P(OkThen); yes → P(CaterpieAndWeedleDescription); outer wait. Reads straight into the menu (no A press) |
| Viridian girl | D: `GOT_POKEDEX` → P(WhenIGoShop) else P(HasntHadHisCoffeeYet) |
| Viridian old man (sleeping) | D (handler): P(PrivateProperty); then `StartSimulatingJoypadStates` DOWN ×1 and `wViridianCityCurScript` — **after** the close (A5b4 already orders the script after the display; keep V1e's state machine) |
| Viridian old man 2, demo asker | D: P(HadMyCoffeeNow) then `DelayFrames 2` then script state → the catch demo; or, completed: P(LosingMyTouch). **Old man 1** (the repeat demo): P(WantMeToShowYouAgain), `DelayFrames 2`, `YesNoChoice`, yes → P(WatchCloselyText), script state → demo; no → P(NotGoodEnough) |
| Viridian fisher (TM42) | **excluded** (needs TM items, A2): the handler stays the legacy string |

The map-script–triggered texts in Viridian (gym-locked D, forced demo) already exist in `story/viridian_city.ts`
as scripts; they move to `displayOpen`/`printText`/`displayClose` here too (their programs exist:
`ViridianCityPrintGymLockedText.text`, …).

### 3.2 Pallet Town (A5b5b) — `PalletTown.asm`, `wOakWalkedToPlayer` selects the text

1. Default script at Y = 0 without `FOLLOWED_OAK_INTO_LAB`: `wJoyIgnore` mask, `StopAllMusic`, `MUSIC_MEET_PROF_OAK`,
   `SetEvent OAK_APPEARED_IN_PALLET`.
2. HEY_WAIT: `wOakWalkedToPlayer = 0`; **D(OAK)**: handler sets `wDoNotWait… = 1` and P(HeyWaitDontGoOutText): the
   program is `far text`, then **`asm`**: `DelayFrames 10`, player faces down, **`EmotionBubble` (player, "!", 61
   frames)**, `TextScriptEnd`. No outer wait → Hold → close. The bubble happens **inside** the open display.
   Then Oak appears at (14, 8) status 2, facing up.
3. OAK_WALKS_TO_PLAYER: `Delay3`, path, `MoveSprite`.
4. GREETS_PLAYER (when the walk ends): `wOakWalkedToPlayer = 1`; **D(OAK)** → P(ThatWasClose), outer wait; Oak faces
   the grass (left or right by `EVENT_PLAYER_AT_RIGHT_EXIT_TO_PALLET_TOWN`).
5. PIKACHU_BATTLE (the catch demo; unchanged).
6. AFTER_BATTLE: `wOakWalkedToPlayer = 2`; **D(OAK)** → P(Whew), outer wait; Oak faces up; **D(OAK_COME_WITH_ME)**
   (direct text); then the walk to the lab (unchanged).

### 3.3 Oak's Lab (A5b5b) — `OaksLab.asm`; **autoBox is off in every D here**

| Script state | Sequence |
|---|---|
| CHOOSE_MON_SPEECH | `SetEvent OAK_ASKED_TO_CHOOSE_MON`; mask; **D(RIVAL_FED_UP)**, `Delay3`, **D(OAK_CHOOSE_MON)**, `Delay3`, Oak/rival status+facing, **D(RIVAL_WHAT_ABOUT_ME)**, `Delay3`, **D(OAK_BE_PATIENT)**; mask off. Each is a `printText` wrapper (box appears with the P, 23 frames after D starts; close 15) |
| DONT_GO_AWAY (player Y = 6) | Oak/rival face down (`SetSpriteFacingDirectionAndDelay`), `UpdateSprites`, **D(OAK_DONT_GO_AWAY_YET)**, then simulated UP ×1 |
| Eevee ball (`OaksLabEeveePokeBallText`) | **D(ball)**: if `OAK_ASKED_TO_CHOOSE_MON`: `wDoNotWait… = 1`, `EmotionBubble` (rival, "!", 61) *inside the borderless display*, script → CHOSE_STARTER, `TextScriptEnd` → Hold → close; else `wDoNotWait… = 0`, P(ThatsAPokeball), outer wait |
| CHOSE_STARTER / RIVAL_TAKES_POKEBALL | rival `MoveSprite` push (A6 code, unchanged); when it ends: `HideObject` ball, rival faces up, `wRivalStarter`, **D(RIVAL_RECEIVED_MON)**: five P's in one display (`RivalTakesText1…5`, text 2 plays `get_key_item`), flag 0 → outer wait → close |
| WALKS_TO_OAK / RECEIVES_PIKACHU | walk (unchanged); **D(PLAYER_RECEIVED_MON)**: `wDoNotWait… = 1`; P(OakGives), P(Received: `get_key_item`), **then** `AddPartyMon`, `DisablePikachuOverworldSpriteDrawing`, `SetEvent GOT_STARTER`; no outer wait → close. `wJoyIgnore = 0`. **No other text follows** |
| RIVAL_CHALLENGES (Y = 6) | rival faces down, `MUSIC_MEET_RIVAL`, **D(RIVAL_ILL_TAKE_YOU_ON)**, path, battle (unchanged) |
| RIVAL_STARTS_EXIT | `DelayFrames 20`, **D(RIVAL_SMELL_YOU_LATER)**, alternate-start music, exit walk (unchanged) |
| PIKACHU_ESCAPES / DISLIKES | Pikachu out (A6e), **D(PIKACHU_DISLIKES_1)**, **D(…_2)** (each a `printText` wrapper), mask off |
| Parcel: Oak talk (`OaksLabOak1Text` `.got_parcel`) | **D(OAK1)**: P(DeliverParcelText: text, `get_key_item`, text) , `OaksLabScript_RemoveParcel`, script → RIVAL_ARRIVES; outer wait → close |
| RIVAL_ARRIVES | `hJoyHeld = 0`, `EnableAutoTextBoxDrawing` (**turns the box on**), `StopAllMusic`, rival music, **D(RIVAL_GRAMPS)** (direct text), Pikachu movement, rival walks up |
| OAK_GIVES_POKEDEX | `EnableAutoTextBoxDrawing`, `PlayDefaultMusic`, mask; facing script; **D** ×(MY_POKEMON_HAS_GROWN_STRONGER, I_HAVE_A_REQUEST, MY_INVENTION_POKEDEX), `DelayFrame` between each, then **D(GOT_POKEDEX: `get_key_item`)**, `Delay3`, hide Pokédex objects, facing, **D(THAT_WAS_MY_DREAM)**, rival faces right, `Delay3`, **D(RIVAL_LEAVE_IT_ALL_TO_ME)**, then the flags, Viridian old-man toggles and the rival's exit (unchanged) |
| Oak talk otherwise (`OaksLabOak1Text`) | full branch list in the ASM (lines 807–882); implement the reachable branches (§6 decision 5) |
| Rival talk | `OaksLabRivalText`: `FOLLOWED_OAK_INTO_LAB_2` no → GrampsIsntAround; `GOT_STARTER` no → IllGetABetterPokemon; else MyPokemonLooksStronger |
| Girl, scientist, Pokédex object | `printText` wrappers (`OaksLabGirlText.Text` …) via `MapDialogue` — with **`autoBox: false` for the Lab** |

### 3.4 The Pokécenter nurse (A5b5c) — `engine/events/pokecenter.asm`, via `TX_SCRIPT_POKECENTER_NURSE`

D(nurse) → `DisplayPokemonCenterDialogue_` → **AfterDisplayingTextID** (outer wait after the farewell). Inside: P(Welcome);
first use of the Pokécenter (`BIT_USED_POKECENTER` clear) → P(ShallWeHeal: its program starts with `pause`) else
skipped; `YesNoChoicePokeCenter`; `UpdateSprites`; **no** → `LoadScreenTilesFromBuffer1`; **yes** → blackout map,
Pikachu walk (A6e), P(NeedYourPokemon), 64 frames, … machine, `HealParty`, music restore, P(FightingFit) …, the bow;
then `.done`: P(Farewell: `pause` first), `UpdateSprites`, return → outer wait → Hold → close. The existing A6e
`buildNurseScript` already encodes everything except the display envelope: it becomes `displayOpen` + `printText`s
+ the yes/no menu + `displayClose {outerWait: true}`. **Pewter's Pikachu special case is not built yet**
(`LooksContentText`); do not add it.

## 4. Design

### 4.1 Foundation (A5b5a)

- **Registry.** `story/text_handlers.ts`: `registerTextHandler(map, textId, (ctx) => ScriptCommand[])`, where
  `ctx` gives flag reads, the bag, the Pokédex count, the player's facing and step, the party. The overworld
  controller, for an NPC or sign whose call kind is `handler`, looks it up by `(mapName, textId)` (the Lab
  and Mart choose their second table by flag, as A5b4's `mapTextKind` already does) and returns
  `{ type: 'script', commands }`; with no entry it keeps today's string path. A test lists every `handler`
  call on the 19 maps as *migrated* or *excluded with a reason* (§9); a new extraction cannot silently add one.
- **Envelope helper.** `displayTextID(body, { autoBox = true, outerWait = true })` returns
  `[displayOpen{autoBox}, …body, displayClose{outerWait}]`; a handler that sets `wDoNotWait…` passes
  `outerWait: false`.
- **New script commands.** `yesNoChoice {yes, no, pokeCenter?}` (the menu over the open display, no message:
  `YesNoChoice` / `YesNoChoicePokeCenter` positions; the menu appears the tick the text returns);
  `emotionBubble {target}` (reuse A1c's `EmotionBubble`: 61 frames, nothing moves, then the sprite update;
  replaces `exclamation` for Pallet and the Lab); `healJingle` (play `pkmnhealed`, wait for it, restore the
  map music; the Pokécenter already has this inside `pokecenterHeal`, which is separate). `wait` stays
  `DelayFrames`. `fadeOut`/`fadeIn` stay. Anything else, reuse.
- **Dispatch.** A script whose first command is `displayOpen` starts in its dispatch tick (A5b4). Map-script
  scripts (Pallet, Lab, Mart) also start in the map script's tick; scripts that begin with movement keep their
  verified A6 timing — do not change `startScript` for them.
- **Closes between displays.** Each `D` ends with the exact close and its trailing `UpdateSprites`; the
  `Delay3`/`DelayFrame`/`DelayFrames` in the tables are *after* the close.
- **N-2 from the A5b4 review:** make the close's trailing update use `[...npcs, ...scriptNpcs]` in the START
  exit as well (the script controller's rule), and confirm no script NPC outlives its script on current maps.

### 4.2 Rules for every migrated flow

- No `getText()` and no game-text string literal in a migrated builder; text comes from `printText {program}`
  with bindings (`stringBuffer`, `nameBuffer`, names via `<PLAYER>`/`<RIVAL>` in the programs).
- Order of side effects is the ASM's (give → hide → text → flag for Daisy; text → give for the Mart parcel).
- A tripwire test: for each migrated builder, the produced command list contains **no** legacy `text` command.
- Delete, as each NPC migrates: its `story_state.ts` dialogue swap, its sentinel in `overworld_controller.ts`,
  and the now-unused `game_text` keys' callers (keys stay in the JSON).
- Keep Gen 1 quirks as the ASM has them (for example, the flag-first Route 1 sample).

## 5. Departures found in today's TypeScript (each to be re-checked against the ASM, then fixed)

| # | Where | Today | Cartridge |
|---|---|---|---|
| D1 | Lab, after the Pikachu gift | wait 15, Oak faces down, then `LAB_OAK_ADVICE` text (also in the "await ball" script) | **No such text.** The advice is only what Oak says when you *talk* to him (`.already_got_pokemon`). Remove |
| D2 | Lab, Pikachu gift | text, `addPokemon`, text | P(OakGives), P(Received+jingle), **then** `AddPartyMon` and `DisablePikachuOverworldSpriteDrawing`; one display, no outer wait |
| D3 | Lab, rival snatch | five separate legacy boxes, each ending on its own A press | one display, five `PrintText`s, outer wait after the fifth |
| D4 | Mom (with starter) | fade, heal, `wait 30`, fade | `GBFadeOutToWhite`, heal, **pkmnhealed jingle until done**, music restored, fade in |
| D5 | Mart walk | up, up, left | **LEFT ×1, UP ×2** |
| D6 | Mart parcel | text, `giveItem`, a second "got OAK's PARCEL" text, flag | one program (text + `get_key_item`), **then** `GiveItem`, flag. Verify that the extracted program contains the "got" sentence |
| D7 | Daisy | text → give → text → flag → hide; the bag-full string is hand-typed | give → hide → P(GotMapText) → flag; bag-full is `BluesHouseDaisyBagFullText` |
| D8 | Pallet bubble | `exclamation` 40 frames after the box closed | 10 frames, then the 61-frame `EmotionBubble` **inside** the open display |
| D9 | Lab ball bubble | `exclamation` 30 frames | 61-frame `EmotionBubble` inside a borderless display; then the close; then the rival walks |
| D10 | Oak's Lab dialogue | plain NPC texts open a bordered box at +3 | the Lab disables the automatic box: **no border until `PrintText`** (+23) |
| D11 | Viridian caterpillar youngster | hand-typed Yes/No answers | programs `OkThen` / `CaterpieAndWeedleDescription` |
| D12 | Nurse | "We hope to see you again!" hand-typed; texts have their own endings | programs; one display; outer wait after the farewell |

D5 and D6 change what a new game visibly does; D1 removes a text players have seen. They are fidelity fixes
under the project rule. If you would rather keep any one, say so in decision 3.

## 6. Checkpoints and verification

Gates for every checkpoint: `npm run typecheck`; `ROM_PATH=pokeyellow.gbc npm test` (PowerShell:
`$env:ROM_PATH='pokeyellow.gbc'; npm test`); the no-ROM run; `npm run build`; `git diff --check`; clean
`git status`. Stage specific paths; never commit edits you did not make (an editor's formatter once
reformatted `STATUS.md`; if `context/*.md` shows changes you did not make, ask the user).

**A5b5a** — CP1 foundation (registry, helper, `yesNoChoice`, `emotionBubble`, `healJingle`, N-2) with unit
tests and no behaviour change; CP2 Mom and TV, Daisy, Route 1, the Mart, Viridian's talkers and old men
(§3.1), deleting their swaps and sentinels. **A5b5b** — CP3 Pallet; CP4 the Lab (§3.3, in script-state order).
**A5b5c** — CP5 the nurse; CP6 cleanup (remove the dead `story_state` branches and sentinels, update the
consumer inventory in `notes/24-a5b1-text-data.md`, docs).

**Per-flow tests** (one table-driven test per flow, from the ASM sequences above): the ordered list of
`printText` programs and bindings; `autoBox`; outer wait or not; the frame of the first glyph (`+20`/`+23`);
the close cost for the map; side effects at their frame (give, hide, flag, bubble start/end); the branch
chosen by each flag combination (including the gambler's two badge/flag conditions and the three Oak1
branches reachable today). Plus: the handler census test (§4.1), the no-`text`-command tripwire, and the
existing A6/A1 timing tests unchanged.

**Browser smoke (required at the end of each sub-slice; no ears):** spare port, isolated origin, staged saves
as in A1c/A5b4. A5b5a: talk to Mom (with a starter), the TV from both sides, Daisy (with and without a
Pokédex), Route 1's youngster twice, a fresh Mart entry, Viridian's gambler/girl/youngster/old men.
A5b5b: a **full new game** from Pallet's grass through the Lab to the rival battle and then the parcel and
Pokédex scene (stage the parcel by editing the save). A5b5c: the nurse yes, no, and a second visit.
Record tick counts for the first glyph and each close, and zero console errors.

**The user's play-test (A = Z, B = X)** after A5b5b and A5b5c: a brand-new game to the Pokédex, then Mom, Daisy,
the Mart, Viridian's people and a Pokécenter visit. The words are unchanged; what changes is where the boxes
open and close, the two bubbles, the missing advice text and the reversed Mart walk (§5).

## 7. Mutation checks (do at least three per sub-slice, in memory)

A handler returning the wrong branch for one flag; `outerWait` flipped on a `wDoNotWait… = 1` flow; the
bubble placed after the close instead of inside; the Lab's `autoBox` left on; the give placed before the
text in the Mart; the `+3` dropped for a `PrintText`; the healing jingle skipped.

## 8. Existing tests expected to change (list each with its cartridge reason; do not loosen)

`story/viridian_city.test.ts` (text steps become sessions), `script/text_commands.test.ts` and
`overworld/item_pickup.test.ts` only if shared vocabulary changes, the controller tests that assert
`{ type: 'script', commands }` for Mom/Daisy/Route 1/Lab, any test pinning the sentinels or the swapped
strings, and the A6e nurse trace tests (their frame counts must stay; only the text steps change).

## 9. Not in A5b5, each with a home

| Finding | Home |
|---|---|
| Fisher's TM42 (`GiveItem TM_DREAM_EATER`, `get_item2`) | A2 (TM items) |
| Chansey and Spearow cries | J2 (cries) |
| Receptionist and the Pokécenter PC; the shop; item menus; save | A5b7 |
| Notebook, blackboard, Town Map sign, Oak's speech; `waitButton` clearing tile (18, 16) (A5b4 N-1) | A5b6 |
| Pokédex rating screen after Oak's "How is your POKéDEX coming?" | later Pokédex work (J2 audit lists it) |
| Oak giving 5 Poké Balls (`EVENT_BEAT_ROUTE22_RIVAL_1ST_BATTLE`, `…POKEBALLS`) | Route 22 rival (I1); a tripwire test fails if those flags become settable |
| Pewter Pokécenter's sleeping-Pikachu check | V2 |
| `PrintText`'s own `UpdateSprites`; `.displayDialogue`'s | J2 |
| Walking Daisy (`DAISY_WALKING`), slot-order audit | V5 map-object audit |

## 10. Decisions (O-20) — **resolved 2026-10-11: the user took all six recommendations**

1. **Split into A5b5a / b / c, implemented and reviewed in that order.** Recommended: **yes.** One slice would
   be ~25 flows in one review. Alternative: one slice with the six checkpoints and one review.
2. **A handler registry replaces the dialogue swaps and sentinels** for migrated NPCs. Recommended: **yes**
   (it is how the cartridge decides, and it closes A5a's N-1).
3. **Fix the §5 departures, including removing Oak's invented "advice" text and reversing the Mart walk.**
   Recommended: **yes** (project rule: nothing invented). Say which, if any, to keep.
4. **Exclusions in §9** (Fisher, cries, receptionist/PC, shop, Pokédex rating, Route 22 balls gift).
   Recommended: **yes.**
5. **Oak's talk branch with two or more Pokémon owned** shows "How is your POKéDEX coming?" and then the rating
   screen, which is not built: print the text and close, log the gap. Recommended: **yes.**
6. **Who:** Sol (GPT-6.1) implements each sub-slice, Claude reviews each, the user play-tests after b and c
   (assumed, as for A5b3 and A5b4).

## 11. Handoff for Sol

> Implement **A5b5a** first, exactly as `notes/32-a5b5-plan.md` says, ; the user approved it with every
> recommendation (O-20, DECISIONS #49). Claim the slice in `context/STATUS.md` → *In progress* with your model name and the
> date. Before coding each checkpoint, **re-read the ASM for its flows (§3 cites the files) and re-derive the
> sequences**; if anything in this note disagrees with the disassembly, stop and tell the user. Check each
> map script for `EnableAutoTextBoxDrawing` / `wDoNotWaitForButtonPressAfterDisplayingText` yourself; the
> flag's value at each `DisplayTextID` is the thing most likely to be wrong in a plan. Do not touch the audio
> engines, A6's movement code, the A5a printer's timing or A5b4's close; do not start A5b5b until A5b5a is
> reviewed. Many files under `game/src` are CRLF on disk: use the Edit tool for multi-line changes and run
> `git diff --check`. Stage specific paths. Never push.
>
> Finish each checkpoint by updating `STATUS.md` (log); finish the sub-slice by updating `CONVENTIONS.md`
> (test-suite section), `game/src/story/ARCHITECTURE.md`, `game/src/text/ARCHITECTURE.md` as needed, root
> `CLAUDE.md` (baseline only) and writing the **Implementation result** at the bottom of this note: commits,
> counts, every §8 test edit with its reason, the browser numbers, the mutations you ran, the §5 items you
> confirmed or disproved, and anything that surprised you. Claude reviews next (`notes/33-a5b5a-review.md`).

> **Added after the A5b5a review (`notes/33-a5b5a-review.md`, N-1):** the first commit of A5b5b removes Mom's
> `callback` (blackout map) from `momText`. The cartridge calls `SetLastBlackoutMap` only from the Pokécenter
> (`engine/events/pokecenter.asm:27`). My §3.1 row was wrong. Change `small_text_handlers.test.ts:76` to assert Mom
> does not call `onHeal`, and add a test with a blackout map already set.

## Planning verification (what I read and ran; no repository file changed except this note and STATUS)

- Read, in full or the relevant parts: `PalletTown.asm`; `OaksLab.asm` (script table, intro, choose-mon,
  snatch, receive, rival challenge/exit, Pikachu escape, parcel/Pokédex scripts, every text handler);
  `RedsHouse1F.asm`, `RedsHouse1F_2.asm`; `BluesHouse.asm`; `ViridianMart.asm`; `Route1_2.asm`;
  `ViridianCity.asm` and `ViridianCity_2.asm` (handlers); `engine/events/pokecenter.asm`; the auto-text-box
  sites in `scripts/` and `engine/`; `home/text_script.asm` for the envelope. The code: `story/pallet_town.ts`,
  `oaks_lab.ts`, `viridian_mart.ts`, `hidden_events.ts`, `viridian_city.ts` (texts), `story_state.ts`,
  `overworld_controller.ts` (interaction and the nurse/Mom builders), `script/types.ts` and the A5b4 command
  handling in `script_controller.ts`.
- Ran: the census of `handler`/`script` NPCs and signs on the 19 maps (30); the list of extracted handler
  programs for these callers (112, all present); the per-map auto-text-box check (only the Lab disables it).
- **Not** run: typecheck, tests, build, setup or a browser. The `wDoNotWait…` flag values, the Mart walk
  order, the missing advice text and the missing healing jingle are my readings of the ASM against the
  TypeScript, listed in §5 for Sol to confirm or disprove, not tested facts.

## A5b5a implementation result — Codex / Sol, 2026-10-11

**A5b5a is implemented and stops here for Claude's review in
`notes/33-a5b5a-review.md`.** A5b5b (Pallet/Lab) and A5b5c (nurse) have not
started. The user's play-tests remain after b and c. No push.

| Checkpoint | Commit | ROM suite | No-ROM suite | Other gates |
|---|---|---|---|---|
| CP1 foundation | `0df47e8` | 1071/1071 | 951 pass / 120 skip | typecheck, build, diff check |
| CP2 small handlers | Commit containing this result | 1113/1113 | 993 pass / 120 skip | typecheck, build, diff check, muted browser |

Started from clean `f07f9f2`, carrying the approved plan. Final suite: 52 files,
49 added tests (2 registry/helper, 7 display-command, 40 small-handler tests).
Build: 118 modules, 337.40 kB JS. No extractor/generated asset change; no ROM at
runtime. No edits to the audio engines/interpreter/synthesizer, A6 movement
rules, A5a printer timing, A5b4 close, Pallet/Lab builders, or nurse builder.

**ASM re-derivation.** Read RedsHouse1F/RedsHouse1F_2, BluesHouse, Route1/Route1_2,
ViridianMart, ViridianCity/ViridianCity_2, home/yes_no, two-option menu strings,
EmotionBubble, and PkmnHealed CH1. These maps enable the automatic box and do
not set the do-not-wait flag for these handlers: each enclosing display uses
the silent outer wait, Hold and map close. The inner PrintText costs three
frames, so handlers first write at +23; Mart's two direct programs at +20.
Daisy prints its offer, gives/hides, prints GotMap (with RAM binding/jingle),
then flags. Route 1 sets its flag inside the handler before text/give, including
full-bag failure. Mart walks LEFT/UP/UP, waits three, runs the one parcel program
containing the receipt and jingle, closes, then gives/flags. Old-men DelayFrames
2 remains inside the first display, before its outer ending/menu. All source
sequences agree with the plan; no disassembly contradiction required a stop.

**Foundation and migration.** The map/text-ID registry evaluates live flags,
bag/party, owned count, facing/step and heal callback. Nine current NPC handlers
plus the TV handler are registered. Generated call kinds gate controller
dispatch; unregistered/excluded callers retain their existing paths. TV's
existing hidden-event coordinates route text ID 2 without editing generated
data; its branch reads live facing. The envelope helper emits open/body/close.
Small builders contain only extracted program names and required bindings.
Removed Mom/Daisy sentinels, Route 1/girl swaps and Mart clerk dialogue swaps;
shop availability and existing object visibility remain flag driven. The Mart's
table-1 reminder also uses its direct program; its table-2 shop stays A5b7.

Message-free yesNoChoice appears on the text-return tick, retains the display,
and uses actual Joypad reads; its future nurse option provides source HEAL/CANCEL
coordinates and blank first row. EmotionBubble shares A1c's 61-frame counter,
supports player/NPC, retains the display, reads no input, then calls the
font-loaded sprite update with the retained UI coverage. Existing Pallet/Lab
exclamation commands remain for b. Migrated DelayFrames reads nothing and
returns into the next command on its last tick; pre-display/legacy movement
wait timing stays unchanged. START close now uses map plus script NPCs (N-2).
The three current dynamic Oak actors are removed with hideNpc before their
scripts finish; no current script NPC outlives its script.

**Healing finding and fix.** The first browser run found Mom stalled after
healing. MusicEngine.isPlaying is a track-enabled latch that remains true after
all channels return. The ASM polls wChannelSoundIDs' first channel, so the
audio facade now exposes a read-only `isMusicChannelActive(id)` using the
engine's existing getChannel/active inspection. healJingle waits for loading,
then CHAN1's return, and forces map-music restoration. No engine semantics
changed. The real audio rig pins PkmnHealed CH1 sound_ret at update **136**:
20 source units × speed 12 × tempo 144 / 256 = 135 ticks, plus the initial
update. It proves the handler resumes while isPlaying still reports true.

**Existing-test edits (each with its cartridge reason).**

- `story/viridian_city.test.ts`: Gym/sleeping text assertions now pin programs
  inside display envelopes; the first-demo command list includes both displays
  and the two-frame wait inside the first. The talk prefix starts with a display,
  while all existing movement vectors, six-frame trigger turn, flags, resting
  states and Pikachu guards remain asserted. Repeat YES/NO tests inspect
  yesNoChoice, close before battle, and the direct post-demo program. The former
  missing-string test now checks actual program existence, including both
  branches; it cannot silently pass by filtering an empty legacy-text list.
- `overworld/item_pickup.test.ts`: only the Route 1 builder, its string fixture
  indices and its two success/full-bag traces change. The opening precedes the
  handler: flag stays clear through opening, sets at frame 20 before giving;
  embedded prompt/jingle and the final silent wait/close are driven through
  the retained screen. Potion success binds stringBuffer. Follow-up verifies
  talk-time program selection and unchanged generated dialogue instead of a
  swapped string. Bag counts, flag-first full-bag loss and jingle assertions
  remain. Ball/hidden-item timing tests remain unchanged.
- `script/display_commands.test.ts` was new in CP1: CP2 strengthens YES/NO to
  prove different branches, adjusts the new music-port mock to CHAN1, and adds
  migrated DelayFrames and real healing-track completion regressions.

No other pre-existing test file was edited. All 67 controller tests, 23 trainer
map tests, A6/Pikachu/nurse traces, printer and close tests pass unchanged.

**New evidence.** Branch tables cover Mom/TV, all Daisy states, Route 1 first/
repeat, gambler's exact seven-badge mask versus eight badges and Giovanni flag,
girl's two states, completed old man 2, and both caterpillar branches. Tests pin
ordered programs, bindings, autoBox/outer wait, first-write and map close costs,
Daisy's give/hide-before-flag frame ordering and full bag, real Mom HP/status/PP
healing, and actual TV interaction routing. No-legacy-text and program-existence
tripwires cover every migrated builder. The independent generated-object census
requires all **30** current handler/script NPC/sign calls to be registered or
classified with a reason (existing A5b4 paths, b/c, A2/A4, J2, A5b7); the TV is
checked separately. A new extraction cannot add a handler silently.

**Three in-memory mutations actually run:** wrong girl flag branch fails the
pre-Pokédex program assertion; moving Mart GiveItem before its displays fails
the give-after-close ordering assertion; removing Mom's healing jingle fails
the required command assertion. Each is confined to its test instance.

**Muted browser smoke.** Headless Chrome with `--mute-audio`, isolated profile
and `http://127.0.0.1:5188/`; `:5173` and user saves untouched. Response-only
tick/state probes, staged flags/positions and stabilized NPC fixtures; actual
interaction/controller/script/audio/demo paths then run. No product debug
hooks. Z/X inputs held about 100 ms, including the catch-demo text prompts.

| Flow | First glyph from opening | Close frames | Outcome |
|---|---|---|---|
| Mom with starter | 23 | 9 | Real jingle returns, HP healed, map music restored |
| TV front and back (2 checks) | 23 | 9 each | Both facing branches finish |
| Daisy before dex and gift (2) | 23 | 9 each | Gift adds one Town Map |
| Route 1 first and repeat (2) | 23 | 23 each | First adds one Potion; repeat finishes |
| Fresh Mart entry | 20 | 13, 13 | LEFT/UP/UP to (3,5), one parcel given |
| Gambler, girl before/after dex (3) | 23 | 23 each | Correct handlers finish |
| Caterpillar NO/YES (2) | 23 | 23 each | Both menus/branches finish |
| Sleeping old man | 23 | 23 | Push completes after display close |
| Old man 2 first demo | 23 | 23, 23 | Failed catch, second display and walk-away complete |
| Old man 1 NO | 23 | 23 | Decline finishes |
| Old man 1 YES | 23 | 23, 23 | Caught demo and post-demo display complete |

**17 checks passed, zero console errors**, in the final uninterrupted run.
The paused Mart dispatch precedes its first recorded tick; its opening tick is
included when deriving +20. Browser fixtures needed B presses for the demo's
text prompts; a run interrupted by Vite reloading was discarded and rerun.
Storage cleared; Chrome and spare server closed. Final gates rerun after the
last foundation coverage-port adjustment.

**§5 findings:** D4 (Mom jingle), D5/D6 (Mart walk/grouped receipt/give), D7
(Daisy order/full-bag program), D11 (caterpillar programs) confirmed and fixed.
D1/D2/D3/D8/D9/D10 belong to b and remain untouched; D12 belongs to c. No
premature cleanup of those callers, school/Town Map, cries, Fisher TM42, shop,
PCs, Pokédex rating or Route 22 gifts. Required status, baseline and subsystem
docs are updated. Claude can review A5b5a now; do not start b before that review.

## A5b5b implementation result — Codex / Sol, 2026-10-11

**A5b5b is implemented and stops here for Claude's review in
`notes/34-a5b5b-review.md`.** A5b5a had passed note 33. The first commit fixes
its Mom blackout finding. A5b5c/nurse has not started; the user's fresh-game
play-test follows b's review. Nothing pushed.

| Checkpoint | Commit | ROM suite | No-ROM suite | Other gates |
|---|---|---|---|---|
| Note 33 N-1: Mom blackout fix | `0d78633` | 1113/1113 | 993 pass / 120 skip | typecheck, build, diff check |
| CP3 Pallet | `aa4479d` | 1120/1120 | 1000 pass / 120 skip | typecheck, build, diff check |
| CP4 Lab | Commit containing this result | 1152/1152 | 1032 pass / 120 skip | typecheck, build, diff check, full muted browser |

Started from clean `50ed3da`. Final suite: **55 files, +39 tests** (7 Pallet,
30 Lab, 2 rival music). Build: 120 modules, 340.64 kB JS. No extractor or
generated-asset edits; no runtime ROM dependency. Audio engines/interpreter/
synthesizer, A6 movement rules, A5a printer timing, A5b4 close, Town Map ending
and the nurse builder remain unchanged.

**ASM re-derivation.** Read the full Pallet script and the Lab's entry, choose,
guard, ball/snatch/gift, challenge/exit, Pikachu escape, parcel/Pokédex and text
handlers; checked the auto-box and do-not-wait values at each call. Rechecked
CloseTextDisplay/InitMapSprites/LoadWalkingTilePattern/player reload: one
DelayFrame, two copy frames per moving slot and four player frames, **5 + 2W**.
Pallet's outdoor set has W=9, close **23**; Lab's unique moving pictures plus
Pikachu give W=5 (still objects excluded), close **15**, including the empty
ball display. These agree with the plan. The Lab's arrival/Pokédex states
explicitly enable autoBox, as the table says; ordinary Lab handlers leave it
off. PrintText's own Delay3 makes their first glyph +23; direct calls use +20.

Pallet's mutable Oak phase selects its source program. HEY_WAIT keeps the
display across DelayFrames 10, face-down and the 61-frame player bubble, and
has no outer wait. Greeting/Whew wait; ComeWithMe is direct. Its existing A6
movement geometry and catch demo are retained. The callback prefix reaches
the first display in the map-script dispatch tick without advancing an async
or movement command through its boundary.

The Lab runs four choose displays with their post-close Delay3s and sets the
asked flag first. Its free-movement await supports nested live handlers and
plain source programs, then returns to the retained await. The guard prints,
closes, forces one UP, and waits three. The ball's A press opens its display
that tick: **20 opening + 61 bubble + 15 close = 96**. The rival's five snatch
PrintTexts share one display. The gift's two PrintTexts and real key-item
jingle precede AddPartyMon, drawing disable and GOT_STARTER; no outer wait or
automatic advice follows. The real audio rig pins the jingle return at update
**121** before party/flag changes.

The rival battle preserves its party, movement and legacy text renderer; its
end text is now named by source program and flattened only at that boundary.
Post-battle heal/flag, DelayFrames 20, exit and both Pikachu displays follow
the source. The existing A6 follower-spawn callback stays at the first
dislike display's close. Main also keeps gifted Pikachu hidden when the gift
script finishes or a pre-battle Lab save is loaded, so it cannot appear early.
The grouped parcel program removes the item before the outer wait. Seven
subsequent direct displays enable the box, preserve DelayFrame/Delay3 calls,
hide the Pokédex objects, then set the flags and Viridian state after the last
display. All existing paths/modes and object positions are retained.

`lab_text_handlers.ts` covers every reachable Oak/rival/ball branch in source
order, including bag and owned count. Lab plain talkers/objects execute their
generated programs with autoBox false via MapDialogue. Their dialogue swaps
and the controller's special ball/parcel branches are removed. Approved gaps
remain: rating lead-in then close (no rating screen), Route 22 Poké Ball gift
behind the I1 tripwire, PrintText's own sprite update/cry work J2.

**Two integration details found while wiring the flows.** Consecutive displays
can close and reopen in one CPU tick. The previous boolean UI edge missed that
opening's sprite update; a per-display revision now identifies every opening
once. Grouped PrintTexts retain one revision. The source also uses
Music_RivalAlternateStart at rival arrivals/exits. The committed decoded track
already contains all three alternate entries: a facade adapter locates their
source-matched prefixes, clones/shifts targets and prepends an instantaneous
jump. It uses existing music data and interpreter behavior; normal starts,
cached data and engines are unchanged. Tests independently parse the ASM
prefixes and run the actual interpreter through its loop.

**Existing-test edits and reasons.** Only `story/small_text_handlers.test.ts`
changes: per note 33 N-1, Mom's order test asserts no onHeal callback, and the
real HP/status/PP healing test starts with a Viridian blackout destination and
proves it survives. The generated-object census removes Pallet/Lab from the
exclusion list because they are registered now. Its total remains 30; no
assertion is loosened. All 67 controller tests, existing A6/Pikachu/nurse
traces, printer, close and battle tests pass unchanged. The three new test
files cover source ordering, endings, bindings, live branches, border and
first-write costs, guard/free-handler returns, grouped real jingles, visibility,
movement arrays, battle metadata, revisions and no-legacy-text/program checks.

**Five in-memory mutations actually run.** Pallet bubble moved after close
fails the envelope assertion; an extra HEY_WAIT outer wait stalls the runtime;
dropping PrintText Delay3 moves first read from +23 to +20. Lab autoBox on
fails its borderless-opening assertion; AddPartyMon before the gift text
fails the real jingle/party ordering assertion. Mutations stay in test instances.

**Muted browser smoke.** Headless Chrome with `--mute-audio`, isolated profile
and `http://127.0.0.1:5188/`. Response-only probes; no product debug hooks.
The real new-game initializer starts with no flags, party or items; title/Oak
speech is outside this slice. Actual key-driven walking goes downstairs,
through the house door, into Pallet grass, the catch demo and the Lab. Optional
Oak/rival talks and the real guard are included, then ball/snatch/gift, the real
rival battle and both Pikachu texts. Parcel staging edits only this isolated
save's bag and uses the real save loader; the full Pokédex scene follows.
One ordinary scientist interaction is checked afterward. Z/X and arrows use
real keyboard events, including B for catch-demo text prompts.

| Display group | Count | First glyph from opening | Each close |
|---|---|---|---|
| Pallet HEY_WAIT, greeting, Whew | 3 | +23 | 23 |
| Pallet ComeWithMe (direct) | 1 | +20 | 23 |
| Lab choose speech | 4 | +23 | 15 |
| Free Oak/rival talks | 2 | +23 | 15 |
| Guard | 1 | +23 | 15 |
| Borderless rival bubble | 1 | No glyph; bubble begins +20 | 15 |
| Grouped snatch (5 prints) | 1 | +23 | 15 |
| Grouped gift (2 prints) | 1 | +23 | 15 |
| Challenge, exit, Pikachu dislikes 1/2 | 4 | +23 | 15 |
| Grouped parcel delivery | 1 | +23 | 15 |
| Direct rival arrival/Pokédex scene | 7 | +20 | 15 |
| Plain scientist | 1 | +23 | 15 |

**27 displays, 31 PrintTexts, 27 closes, 27 opening sprite updates, zero console
errors** in the final uninterrupted run. Every first glyph and close is
asserted from the tick trace, including same-tick reopenings. Both bubbles
last **61** frames; the player's bubble starts **10** after the first program
returns; the ball display totals **96**. The party appears on the received
program's return tick with the follower hidden. It becomes visible at the
existing post-rival callback; the parcel is gone, both Pokédex objects and
rival are hidden, and GOT_POKEDEX/OAK_GOT_PARCEL are set at completion.
Initial harness trials needed the existing door's second DOWN press and a
free-script movement wait correction; discarded runs are not counted.
Storage cleared; Chrome and spare server closed; user :5173/saves untouched.

**§5 findings:** D1/D2 (retained player/rival bubbles), D3 (five grouped snatch
prints), D8 (both Pikachu wrapper displays), D9 (remove automatic advice), D10
(starter text/jingle before give/hide/flag) confirmed and fixed. Note 33 N-1 is
fixed first; N-2/N-3 remain explicitly documented. D12 is c and untouched.
Required baseline/subsystem docs and STATUS are updated. Claude can review b
now; stop before c. The user's next play-test is a fresh game from Pallet's
grass through the Lab to the Pokédex scene, with **A = Z, B = X**.

**2026-10-12 follow-up (A5b5c CP1):** note 34 F-1/F-2 fixed: choose speech turns the rival up and keeps Oak down; all four default-music sites use the live map restore. Muted Lab browser confirms `oakslab` and Oak down; 1154 tests pass.
