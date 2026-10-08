# V1e — The real Viridian old man: probe results + plan

2026-09-25, Claude Opus 5.5. **Status: done 2026-09-25, user-verified** (see *Result*;
decisions in DECISIONS #34).

**Sources.** `refs/pokeyellow` @ `e89ead15`: `scripts/ViridianCity.asm`,
`scripts/ViridianCity_2.asm`, `scripts/OaksLab.asm:572-596`, `scripts/ViridianMart.asm`,
`data/maps/objects/ViridianCity.asm`, `data/maps/toggleable_objects.asm`,
`engine/events/try_pikachu_movement.asm`, `engine/pikachu/pikachu_movement.asm`,
`engine/pikachu/pikachu_follow.asm` (`GetPikachuFacingDirection`),
`engine/movie/oak_speech/init_player_data.asm`. Compared with gen1recomp (`dev`)
`data/scripts/yellow_viridian_old_man.lua`. It departs from the ASM in two places
(§1.5), so pokeyellow wins. Engine code as of `de5e0ba`. This builds on
`notes/02-v1-plan.md` §2.5, which it corrects in places (§1.6).

## TL;DR

- **One slice, one session.** Every text is already extracted (V1a), and the battle
  is ready (V1d: the `catchDemo` script command). What's left is the city's script
  logic and three small data changes.
- **The city runs a small state machine,** `wViridianCityCurScript`, which is saved
  with the game. Three *resting* states matter: `DEFAULT` before the Pokédex,
  `AFTER_POKEDEX` until the demo, and `POST_CATCH_TRAINING` after it. The (19,9) old-man
  trigger and the Gym-door check both hang off it.
- **A Gen 1 quirk falls out of the ASM:** the Gym door's push-back (at 32,8) sends the
  city to `POST_CATCH_TRAINING` from *any* state. Touch the Gym door before the demo and
  the old man at (19,9) stops blocking you. Before the Pokédex, that means walking to
  Route 2 without one. Only a new game resets the index. Hard rule 7 says we keep it; to
  keep it we must save the index (§4 Q1).
- **The pieces:**
  - the sleeping man's push-back, from any direction and when you talk to him;
  - the forced demo, and the walk-away with Pikachu stepping aside;
  - the Mart spawning the walking old man, and his repeatable demo;
  - the locked Gym door;
  - deleting both demo gates (Viridian's invented text, Route 22's fake Blue).

## 1. Probe results

### 1.1 The state machine (`scripts/ViridianCity.asm`)

The city's map script runs every frame, dispatching on `wViridianCityCurScript`:

| # | State | Runs each frame | Leads to |
|---|---|---|---|
| 0 | `DEFAULT` | Gym check, then the sleeping-man check | 6 via the Gym, 5 via (19,9) |
| 1 | `AFTER_POKEDEX` | the waiting-man check, then the Gym check (falls through into 2) | 7 via (19,9), 6 via the Gym |
| 2 | `POST_CATCH_TRAINING` | the Gym check only | 6 via the Gym |
| 3 | `OLD_MAN_START_CATCH_TRAINING` | sets up the repeat demo: RATTATA 5, `ResetEvent EVENT_INITIAL_CATCH_TRAINING` | 4 (the battle starts) |
| 4 | `OLD_MAN_END_CATCH_TRAINING` | `SetEvent EVENT_COMPLETED_CATCH_TRAINING_AGAIN`, "weaken the target" | 2 |
| 5 | `PLAYER_MOVING_DOWN` | waits for the simulated step, Delay3 | **0** |
| 6 | `PLAYER_MOVING_DOWN_POST_TRAINING` | waits for the simulated step, Delay3 | **2** |
| 7 | `OLD_MAN_INITIAL_CATCH_TRAINING` | sets up the first demo: RATTATA 5, `SetEvent EVENT_INITIAL_CATCH_TRAINING` | 8 (the battle starts) |
| 8 | `OLD_MAN_END_INITIAL_CATCH_TRAINING` | `SetEvent EVENT_COMPLETED_CATCH_TRAINING`, "losing my touch" | 9 |
| 9 | `POST_INITIAL_CATCH_TRAINING` | moves Pikachu if needed, starts the old man's walk | 10 |
| 10 | `OLD_MAN_MOVING_DOWN` | waits for the walk, `HideObject TOGGLE_OLD_MAN_2` | 2 |

Who else writes the index:
- `OaksLab.asm:588` sets 1 when the Pokédex is given, whatever the state was.
- The sleeping man's own text handler (`ViridianCity_2.asm:80`) sets 5.
- The walking old man's YES (`ViridianCity_2.asm:137`) sets 3.
- `init_player_data.asm` clears the whole `wGameProgressFlags` block at a new game.

Nothing else touches it (grepped), so it persists through saves, map changes and
blackouts.

States 3–10 happen with input locked (`wJoyIgnore`), so the game can't be saved in
them. Only 0, 1 and 2 ever reach a save. For us, 3–10 are one script-command list
each; only the resting state needs storing.

**The Gym-door quirk, traced.** Before the Pokédex, stand on (32,8):
`ViridianCityCheckGymOpenScript` prints the locked text, pushes you down and sets 6.
State 6 hands over to **2**, not 0. State 2 only runs the Gym check, so the sleeping
man's (19,9) check never runs again, and (19,9) is the only gap past him (the girl
stands at 17,9, he lies at 18,9). The Pokédex later sets 1, which re-arms the waiting
man's check. After the Pokédex, touching the Gym door sends 1 → 2 in the same way,
and the forced demo is skipped. You can still start it by talking to him (§1.3).

### 1.2 Before the Pokédex: the sleeping man

- **(19,9) from any direction** (`ViridianCityCheckSleepingOldMan` reads only
  `wXCoord`/`wYCoord`): "You can't go through here! / This is private property!".
  Then the player is set to face down (`wSpritePlayerStateData1FacingDirection = 0`)
  and one simulated DOWN step follows. **Upstream only fires when facing up.**
  *Corrected in the browser:* (20,9) isn't walkable, so (19,9) can only be entered
  from below or from above. Upstream misses only the arrival from above, which
  needs the Gym-door quirk.
- **Talking to him** (`ViridianCityPrintOldManSleepyText`): the same text, then the
  same one-step push. Upstream shows the text and doesn't push.
- The push is a simulated joypad press. *Refined while building (DECISIONS #34):* it
  takes no turning frame, and it collides **and hops ledges**, because
  `GetSimulatedInput` has already dropped the index to 0 when `CollisionCheckOnLand`
  runs. At the Gym door that means a hop down the ledge at y = 9. So `pushPlayer`
  runs `player.update` with a simulated direction instead of moving the player
  directly.

### 1.3 After the Pokédex: the forced demo

`OaksLab.asm:591-596` hides `TOGGLE_LYING_OLD_MAN` and shows `TOGGLE_OLD_MAN_2`, the
standing man, also at 18,9. Then:

1. **Trigger, (19,9) in state 1** (`ViridianCityCheckWaitingOldMan`), unless
   `EVENT_COMPLETED_CATCH_TRAINING` is set: OLD_MAN2 faces right
   (`SetSpriteFacingDirectionAndDelay`), and the player faces left.
   **Or talk to him** from (18,10) or (18,8). The same handler runs; talking already
   turns him toward you.
2. `ViridianCityOldMan2Text`: the coffee text ("…I'll show you how to catch POKéMON
   as my apology.", `VIRIDIAN_OLDMAN_COFFEE`), then `DelayFrames 2`.
3. `SetEvent EVENT_INITIAL_CATCH_TRAINING`, then the demo: `catchDemo OLD_MAN RATTATA 5`.
   It **fails**: 3 shakes, "Shoot! It was so close too!" (V1d).
4. `SetEvent EVENT_COMPLETED_CATCH_TRAINING`, then "That didn't work! … at POKéMON
   MART." (`VIRIDIAN_OLDMAN_LOSING_TOUCH`). `EVENT_INITIAL_CATCH_TRAINING` **stays
   set**; only the repeat demo resets it.
5. **The walk-away** (`ViridianCityPostInitialCatchTraining`):
   - Player at x = 19: he walks **down 6** from 18,9.
   - Otherwise: `ViridianCityMovePikachu`, then **right 1 and down 6**.
     `…MovementData1` is a single RIGHT that **falls through** into `…MovementData2`
     (6 × DOWN, `$ff`).
6. He's hidden (`TOGGLE_OLD_MAN_2`), and the state becomes 2.

**Pikachu steps aside** (`ViridianCityMovePikachu` → `TryApplyPikachuMovementData`,
b = `SPRITE_FACING_RIGHT`). It runs only if:
- Pikachu is the following starter (`BIT_PIKACHU_SPAWN_STARTER`);
- you're walking (`wWalkBikeSurfState` = 0);
- **Pikachu stands directly to the player's right** (`GetPikachuFacingDirection`
  compares map coordinates: same row, larger X).

That's exactly when Pikachu is in the old man's path: you talked to him from (18,10),
having walked left from (19,10). The data is `$00` start, `$1d` step down, `$1f` step
left, `$38` look right, `$3f` end (`PikachuMovementDatabase`). So Pikachu goes to
(18,11), under the player, and faces right.

**Also in the ASM:** `SetupSprite` saves and restores sprite 3's position around both
demos. Sprite 3 is `VIRIDIANCITY_YOUNGSTER2`, a walker. Our NPCs keep their positions
through a battle anyway, so there's nothing to port.

### 1.4 The Mart and the repeat demo

- **`ViridianMartScript2`** runs every frame in the Mart once the parcel is in hand
  (state `SCRIPT2`). If `EVENT_COMPLETED_CATCH_TRAINING` is set and
  `EVENT_SPAWNED_OLD_MAN_1` isn't, it sets that event, hides OLD_MAN2 and shows OLD_MAN.
  It has the same effect on entry, since nothing inside the Mart changes the condition.
- **OLD_MAN** stands at 17,5, `WALK LEFT_RIGHT`. Upstream's JSON has him as `walk` with
  **no `walkDir`**, so he'd wander any direction. That needs a metadata fix, like V1a's
  maps.
- **Talking to him** (`ViridianCityPrintOldManText`): "Hmm? You want me to show you how
  to catch POKéMON again?", `DelayFrames 2`, then YES/NO.
  - **YES:** "Dandy! Watch what I do closely now!", then state 3:
    `ResetEvent EVENT_INITIAL_CATCH_TRAINING`, and the demo is **caught** ("All right!
    RATTATA was caught!", not kept). Then state 4: `SetEvent
    EVENT_COMPLETED_CATCH_TRAINING_AGAIN`, "First, you need to weaken the target
    POKéMON.", and back to 2. Repeatable forever.
  - **NO:** "Oh... I'm not good enough for you."

### 1.5 The Gym door

`ViridianCityCheckGymOpenScript` runs in states 0, 1 and 2, every frame, anywhere in
the city:
- If `EVENT_VIRIDIAN_GYM_OPEN` is set, nothing happens.
- If the badges are **exactly** all but EARTH (`cp ~(1 << BIT_EARTHBADGE)`), it sets
  `EVENT_VIRIDIAN_GYM_OPEN`. That happens on arrival in the city, not at the door.
- Otherwise, standing on **(32,8)**, the step below the Gym door (the door itself is
  at 32,7): "The GYM's doors are locked...". Then the player faces down, takes one
  simulated DOWN step, and the state goes → 6 → **2** (§1.1).

Today the door at 32,7 leads to the unextracted ViridianGym and fails gracefully. With
the check in place you can't reach it until you hold 7 badges. The badges are
`BADGE_1`…`BADGE_8` flags (`menus/trainer_card.ts`); EARTH is `BADGE_8`.

gen1recomp (§ Sources) differs from pokeyellow in two places:
- It walks the old man right 1 only, missing the fall-through.
- It moves Pikachu right unconditionally.

It also derives everything from flags, so it can't reproduce the Gym-door quirk.

### 1.6 Corrections to `notes/02-v1-plan.md` §2.5

- The walk-away when x ≠ 19 is right **then** down 6, not "first steps right" and
  then disappears.
- Pikachu is moved only when it's on the player's right. The v1 plan implied every time.
- `EVENT_INITIAL_CATCH_TRAINING` is never cleared after the first demo.
- The Gym-door quirk and the saved state index weren't in the v1 plan.

### 1.7 What the engine has today

Search `VIRIDIAN_OLDMAN_DEMO`, "as far as the demo" and `blue_blocking`. The sites are:

| Site | What it does |
|---|---|
| `overworld_controller.ts` `handleStepComplete`, "Viridian City — old man blocks" | (19,9) **facing up only**: hardcoded "private property" text + push; after the Pokédex, hardcoded **invented** "as far as the demo goes!" + push |
| `story_state.ts` `applyStoryNpcState` ViridianCity | after the Pokédex, re-skins the sleeper as a standing gambler with `VIRIDIAN_OLDMAN_DEMO`; hides `oldman1` always |
| `extractors/game_text.ts` post-processing | writes **invented** `VIRIDIAN_OLDMAN_DEMO` into `data/game_text.json` |
| `extractors/maps.ts` `MAP_METADATA.Route22` + `NPC_INDEX_FILTER.Route22: [0]` | the **invented** fake Blue at (8,6), "You've reached the end of the demo!" |
| `extractors/maps.ts` `NPC_INDEX_FILTER.ViridianCity` | drops OLD_MAN2 (ROM index 7) |

Already in place:
- All 9 texts: `VIRIDIAN_OLDMAN_*`, `VIRIDIAN_GYM_LOCKED`, `BATTLE_SO_CLOSE`. Checked
  against `text/ViridianCity.asm`.
- The `catchDemo` script command, and the demo reading `INITIAL_CATCH_TRAINING`.
- `yesNo`, `moveNpc`, `faceNpc`, `facePlayer`, `hideNpc`, `setFlag` and `movePlayer`
  commands.
- The girl's before/after-Pokédex text.

Missing:
- a way to clear a flag from a script;
- a scripted Pikachu step;
- a saved map-script index.

Route 22 without the fake Blue:
- its gate door leads to the unextracted Route22Gate and fails gracefully, like
  Diglett's Cave today;
- its north edge is unreachable (checked in V1a).

## 2. The plan

### 2.1 Data (extractor → `npm run setup` → commit with the engine, DECISIONS #29)

1. `NPC_INDEX_FILTER.ViridianCity` += 7, and `MAP_METADATA.ViridianCity` +=
   `{ id: 'oldman2', direction: 'down', scripted: true }`. The id follows the
   existing `oldman1`. It's a save-key-stable name.
2. `oldman1` gets `walkDir: 'left_right'` (`WALK, LEFT_RIGHT` in the object list).
3. Route 22: drop `blue_blocking`. `NPC_INDEX_FILTER.Route22` becomes `[]`, and the
   metadata `npcs: []`. The two rivals stay out until I1.
4. `game_text.ts`: delete the `VIRIDIAN_OLDMAN_DEMO` post-processing, and its offset if
   nothing else uses it.
5. Expected data diff, checked with `git diff --stat -- game/data`:
   - `maps/ViridianCity.json`: +oldman2, and oldman1's `walkDir`;
   - `maps/Route22.json`: no NPCs;
   - `game_text.json`: −1 key;
   - their `static/` mirrors.

   Anything else is a bug.

### 2.2 Engine

1. **`story/viridian_city.ts`, a new pure module:**
   - the state constants with ASM names;
   - `viridianStepScript(state, x, y, flags, badges)`, which returns what (if anything)
     fires on a step;
   - builders for each command list: sleeping push, Gym push, forced demo, talk to
     OLD_MAN2, repeat demo;
   - `pikachuMustStepAside(player, pikachu)`;
   - `initialViridianState(flags)` for saves made before V1e.

   Upstream's per-map files (`pallet_town.ts`, `oaks_lab.ts`, `viridian_mart.ts`) are
   the model.
2. **A saved map-script index** (§4 Q1): `SaveData.mapScripts?: Record<string, number>`,
   holding only resting states. ViridianCity is its first user.
   - Oak's Pokédex script sets `ViridianCity = 1`, next to its existing `GOT_POKEDEX`.
   - Old saves without the field get 0 / 1 / 2 from `GOT_POKEDEX` and
     `COMPLETED_CATCH_TRAINING`.
3. **`overworld_controller.ts`:** replace the (19,9) block with `viridianStepScript`,
   so it fires from any direction. Talking to `oldman_blocking`, `oldman2` and `oldman1`
   routes to their builders.
4. **`story_state.ts`:** replace the Viridian block with visibility from flags. Each
   rule is equivalent to the toggles, because the toggles only change inside
   input-locked scripts:
   - `oldman_blocking` visible iff `!GOT_POKEDEX`;
   - `oldman2` iff `GOT_POKEDEX && !COMPLETED_CATCH_TRAINING`;
   - `oldman1` iff `SPAWNED_OLD_MAN_1`.

   The girl's text logic is kept.
5. **Script commands:**
   - `clearFlag` (`ResetEvent`);
   - `setMapScript` (writes the resting state);
   - `movePikachu { path, face }`, which steps the follower as
     `ApplyPikachuMovementData` does;
   - `movePlayer` gains a blocked-tile check for the one-step pushes (§1.2).

   The `wJoyIgnore` locks come free: the player can't move while a script runs.
6. **The Mart:** in the existing map-entry hook in `main.ts`, next to the parcel
   script, if `COMPLETED_CATCH_TRAINING && !SPAWNED_OLD_MAN_1`, set `SPAWNED_OLD_MAN_1`.
7. **Delete** the hardcoded texts in `overworld_controller.ts` and use `getText()` keys.

### 2.3 Tests

- **`viridian_city.test.ts`**, the state machine as data:
  - every transition in §1.1;
  - (19,9) from all four directions;
  - the Gym quirk: 0 → 2 disarms the sleeper, and the Pokédex re-arms with 1;
  - 7 badges opens the Gym, while 8, or 7 with EARTH, doesn't;
  - the forced-demo list: coffee → set INITIAL → demo → set COMPLETED → losing touch →
    walk → hide → 2;
  - the x = 19 and x ≠ 19 walks;
  - Pikachu steps aside only when on the right;
  - repeat demo, YES and NO;
  - old-save state derivation.
- **Extraction** (`ROM_PATH`):
  - ViridianCity's 8 NPC ids and facing against `objects/ViridianCity.asm`, and
    oldman1's `left_right`;
  - Route 22 has no NPCs;
  - **no string in `game_text.json` or any `maps/*.json` contains "demo"**, which
    guards against invented text coming back.
- Expected count: roughly +20, so ~470. The slice's log records the exact number.

### 2.4 Verify (the PLAN V1 gate)

Agent browser check on a spare port. Saves are staged in `localStorage`, as in V1c, and
cleared afterwards:

1. **Before the Pokédex:**
   - (19,9) from below and from the right each give the text and a push down.
   - Talking to the sleeper from (18,10) gives the text and a push to (18,11).
   - (32,8) gives the Gym text and a push down.
   - **Then (19,9) no longer stops you:** walk to Route 2 (the quirk).
   - Save → reload keeps it.
2. **After the Pokédex:** (19,9) → he turns right, you turn left → coffee text → demo,
   3 shakes, "so close" → "losing my touch" → he walks down 6 and vanishes.
   RATTATA is seen in the Pokédex.
3. **The talk path from (18,10) with Pikachu on your right:** Pikachu steps down, then
   left, and looks right. He walks right, then down 6.
4. **The V1 gate itself:** Route 2 → Forest → beat a Bug Catcher → north gate.
5. **Mart → Viridian:** the walker paces left/right at y = 5.
   - YES: "Dandy!…" → caught → "weaken the target".
   - NO: "not good enough".
   - YES a second time also works.
6. **Route 22:** no Blue. The gate door fails gracefully.
7. Typecheck, the suite, the build, and no console errors.

Then the user's play-test: new game → Pewter's edge.

## 3. Found on the way — not V1e

| Finding | Where | Home |
|---|---|---|
| The gambler at (30,8) says "GYM always closed". The ASM switches to "GYM leader returned" with 7 badges or after beating Giovanni. Static text is right until then | `ViridianCityPrintGambler1Text` | I1 (Viridian Gym) |
| Route 22's two real rivals (`RIVAL1`/`RIVAL2`, toggle-hidden) | `scripts/Route22.asm` | I1, already planned |
| A saved map-script index will be needed again: Pewter's, Route 22's and Cerulean's scripts all keep state in `w…CurScript` | `wram.asm` `wGameProgressFlags` | reuse §2.2 item 2 |

## 4. Decisions for the user

1. **Save the city's script state (`wViridianCityCurScript`) as a per-map value**
   (`mapScripts` in the save). This reproduces the ASM exactly, including the Gym-door
   quirk (§1.1). Future maps with script state can reuse it. *Recommended.*

   The alternative is upstream's style, where everything is derived from event flags.
   That's simpler, but it can't reproduce the quirk. It would be a silent fix of a
   Gen 1 bug.
2. **Heads-up, not a question (Hard rule 7):** with the quirk, touching the Gym door
   before the demo removes the old man's block. Before the Pokédex, you can walk to
   Route 2 without it. That's the cartridge's behavior. Say so if you'd rather we
   didn't.
3. **One slice.** The data part is three small metadata edits, landing with the engine
   code as DECISIONS #29 allows for V1e. No split. *Recommended.*

## Result — done 2026-09-25

Built as planned (§2). The answers are in DECISIONS #34. Tests 452 → **476**: 21 in
`story/viridian_city.test.ts` (20 state-machine, 1 data guard) and 3 extraction.
Typecheck clean, build OK. The regenerated-data diff was exactly §2.1's three files
and their mirrors.

**Found while building (not in the plan):**
- **The push is the player's own movement code** (`pushPlayer` →
  `player.update(…, simulated)`). The first browser run exposed it: a push into the
  Gym ledge only bumped, where the ASM hops.
- **A step trigger has to undo the step a held key already began.** `player.update`
  starts the next step in the same frame one ends, before the map script runs. With
  the key still held at (32,8), the player ended on the Gym door tile (32,7), and at
  (19,9) Pikachu walked under the player. Viridian's triggers now cancel that step
  (`cancelMovement` + `PikachuFollower.forgetPlayerStep`). Upstream's other step
  triggers (Pallet's Oak grass, the Oak's Lab rival) have the same latent issue;
  logged in STATUS.
- **(20,9) isn't walkable** (§1.2 corrected).

**Verified in the browser:**
- **By the agent** (spare ports :5179 and :5180, saves staged and then cleared):
  - (19,9) from below: text, push to (19,10), facing down.
  - Talking to the sleeper from (18,10): push to (18,11).
  - The Gym door from the left with the key held: text, then a hop to (32,10).
  - Saving: `mapScripts: { ViridianCity: 2 }`. Reloaded at (19,10), the player walked
    to (19,3) with no Pokédex (the quirk).
  - After the Pokédex, a save without `mapScripts` (so its state was derived):
    (19,9) turns the old man right and the player left, then the coffee text.
  - The repeat demo: YES → "Dandy!" → caught. Afterwards `INITIAL_CATCH_TRAINING`
    was cleared, `COMPLETED_CATCH_TRAINING_AGAIN` set, the state back at 2, and
    RATTATA seen.
- **By the user** (their words): the old man "threw the ball, the ratata escaped",
  "i must be losing my touch", then he left. After the Mart, the walking old man's
  repeat demo: "now he caught the ratata"; "it all works as intended". An early "he
  doesn't reply" was the keyboard: the game's A button is **Z**.

**Not checked in the browser:** the talk path with Pikachu stepping aside (unit-tested
only); the full walk Route 2 → Forest → north gate after the gate opened (V1b/V1c
verified those maps through the debug warps); Route 22 without the fake Blue (the
extraction test checks there are no NPCs).
