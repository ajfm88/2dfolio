# V1d — The catch-demo battle: probe results + plan

2026-09-24, Claude Opus 5.5. **Status: done** (see *Result*) — approved with all four §3 recommendations (DECISIONS #32). §1–§3 are the research
done before any code. Builds on `notes/02-v1-plan.md` §2.5 and §3 V1d, and on DECISIONS #29
("V1d rebuilds Oak's Pikachu catch as the catch demo shared by `BATTLE_TYPE_OLD_MAN` and
`BATTLE_TYPE_PIKACHU`").

**Sources:** `refs/pokeyellow` @ `e89ead15`:
- `engine/battle/init_battle.asm` (`InitWildBattle`, `_InitBattleCommon`);
- `engine/battle/core.asm`: `SlidePlayerAndEnemySilhouettesOnScreen`, `StartBattle`,
  `DisplayBattleMenu` `.doSimulatedMenuInput`, `BagWasSelected`, `UseBagItem`,
  `LoadPlayerBackPic`, `LoadEnemyMonData`;
- `engine/battle/common_text.asm` (`PrintBeginningBattleText`),
  `engine/battle/end_of_battle.asm`, `audio/play_battle_music.asm`;
- `home/list_menu.asm` (`DisplayListMenuID`), `home/tilemap.asm`;
- `engine/items/item_effects.asm` (`ItemUseBall`), `engine/battle/animations.asm`
  (`TossBallAnimation`, `AnimationHideMonPic`);
- `scripts/PalletTown.asm`, `scripts/ViridianCity.asm`, `data/text/text_2.asm`,
  `data/text/text_9.asm`;
- pret's sym file (`git show origin/symbols:pokeyellow.sym`).

Upstream code read: `pikachu/pikachu_battle.ts` (the whole file), `main.ts` (the
`pikachuBattle` action, the `pikachu_battle` state, `startBattle`, the `battle` finish
handler), `battle.ts` (`throwBall`, the wild intro), `battle_ui.ts` (`renderActionMenu`,
`renderItemMenu`, `loadPokemonSprites`), `battle/trainer_flow.ts` (`battleTextPages`),
`story/pallet_town.ts`, `script_controller.ts`, `rom/extractors/game_text.ts`.

## TL;DR

- **V1d is engine work plus one text key.** It's about one session, with a clean cut point
  (§2.3).
- **What it builds:** one catch demo for both battle types. The Pallet Town script calls it
  as Oak's Pikachu catch, and V1e's scripts will call it as the old man's.
  - Both run the ASM's **simulated menu**: ▶ FIGHT, ▶ ITEM, a bag holding one POKé BALL,
    then "PROF.OAK used / POKé BALL!" or "OLD MAN used / POKé BALL!".
  - **Two outcomes.** Caught ("All right! / PIKACHU was / caught!") or, for the old man's
    first demo, three shakes then a break-out ("Shoot! It was so / close too!"). The event
    `INITIAL_CATCH_TRAINING` picks between them, as in `ItemUseBall`.
  - **No ball used, nothing added to the party, the enemy marked seen.**
- **Upstream's Pikachu catch departs from the ASM in 8 places** (§1.3). Examples: no menu,
  the enemy HUD shown too early, a 60-frame wait before the throw instead of 20, and the
  "caught" text ending on its own after 90 frames instead of waiting for A.
- **Nothing calls the old man's demo until V1e.** The old man's side is verified by unit
  tests and a temporary, uncommitted hook for the browser check (decision 2).
- **Found on the way:** the *normal* wild catch has invented texts ("POKé BALL thrown!",
  "Gotcha!"), no toss animation, and no "New POKéDEX data" page (§4).
- **4 decisions (§3), each with a recommendation.** Reply **go** to take all four.

## Result — done 2026-09-24, commit `1658e96`

It landed as planned in §2.1, with all four §3 decisions (DECISIONS #32). **441/441**:
+11 in `battle/catch_demo.test.ts`, +1 extraction. Typecheck clean; build OK. The
regenerated data diff was exactly `game_text.json` +1 key (`BATTLE_PROF_OAK_NAME`).

- `battle/catch_demo.ts` (111 lines) holds the rules and `catchDemoSteps()`.
- `battle/catch_demo_screen.ts` is `pikachu/pikachu_battle.ts`, moved with `git mv`. It
  keeps upstream's frame blocks and drawing helpers, and replaces the phase machine with
  a runner over the steps.
- The script command is `{ type: 'catchDemo', battleType, species, level }` and the
  state is `catch_demo`. `main.ts` marks the enemy seen and ends like other battles.
  The demo reads `INITIAL_CATCH_TRAINING` when it starts, which is equivalent to reading
  it at the throw: nothing can change it in between.
- `renderItemMenu` gained `showCursor` for the list's 3 frames without a cursor.
- Not ported: OLD_MAN's `AnyPartyAlive` check in `StartBattle`. It can't fail in
  Viridian, because a party can't be all-fainted in the overworld.

**Browser check (agent-driven, temporary server on :5179, its test saves cleared).**
Canvas frames were captured on a timeline after each A press.

| Check | Result |
|---|---|
| Oak's catch (staged Pallet save, no flags) | ✓ "Wild PIKACHU / appeared!" with no HUD. A → HUD → ▶ FIGHT → ▶ ITEM → "▶POKé BALL × 1 / CANCEL" → "PROF.OAK used / POKé BALL!", which stays up through the toss, the poof and the shakes. The pic is hidden after the poof, the HUD stays |
| Its result | ✓ "All right! / PIKACHU was" waits for A → "caught!" → A → white → "OAK: Whew…" |
| The rest of the intro | ✓ Oak's texts, the walk to the lab, the lab scene |
| Old man, first demo (temporary hook, flag set) | ✓ old man back pic, OLD MAN's menu and bag, 3 shakes, a poof, the Rattata back, "Shoot! It was so / close too!" → back to the script |
| Old man, repeat demo (hook, flag clear) | ✓ "All right! / RATTATA was" → "caught!" |
| Seen flag | ✓ `isSeen(19)` false before the battle, true during it |
| Console | no errors |

The hook (Pallet's command switched to `OLD_MAN` / `RATTATA`) was reverted before the
commit, and `git diff` confirmed it.

## 1. Probe results

### 1.1 How the ASM runs both battles

The two scripts only set up the battle. The battle engine does the rest, with special
cases for battle types 1 (OLD_MAN) and 4 (PIKACHU):

| Script | Sets |
|---|---|
| `PalletTownPikachuBattleScript` | `wBattleType = BATTLE_TYPE_PIKACHU`, `wCurOpponent = STARTER_PIKACHU`, level 5 |
| `ViridianCityOldManStartCatchTrainingScript.SetupBattle` | `BATTLE_TYPE_OLD_MAN`, `RATTATA`, level 5. The first demo also runs `SetEvent EVENT_INITIAL_CATCH_TRAINING`; the repeat demo runs `ResetEvent` |

The battle, in order. Frame counts are the ASM's `DelayFrames` / `Delay3`:

| # | Step | Source |
|---|---|---|
| 1 | `PlayBattleMusic`: **wildbattle** for both, since the opponent is a species | `play_battle_music.asm` |
| 2 | Battle transition, chosen as for any wild battle (A5) | `DoBattleTransitionAndInitBattleVariables` |
| 3 | `LoadEnemyMonData` **marks the enemy seen** in the Pokédex (random DVs, as for any wild mon) | `core.asm` `LoadEnemyMonData` |
| 4 | The silhouettes slide in. The player side is the **back pic**: `OldManPicBack` / `ProfOakPicBack` (`LoadPlayerBackPic`) | `SlidePlayerAndEnemySilhouettesOnScreen` |
| 5 | "Wild RATTATA / appeared!" (`prompt`, so it waits for A). No party pokéballs for these types (`.doNotDrawPokeballs`). The enemy's cry plays; for PIKACHU, a Pikachu PCM clip | `PrintBeginningBattleText` |
| 6 | The text box is cleared, **then** the enemy HUD is drawn | `_InitBattleCommon` (`PrintText .emptyString`, `DrawEnemyHUDAndHPBar`) |
| 7 | **40 frames**. No "Go! …" and no player HUD: the back pic stays. OLD_MAN checks that a party mon is alive (PIKACHU skips it); in Viridian that's always true | `StartBattle` |
| 8 | The battle menu box. **▶ FIGHT for 20 frames, ▶ ITEM for 20 frames**, then ITEM's cursor turns ▷ | `DisplayBattleMenu` `.doSimulatedMenuInput` |
| 9 | **10 + 3 frames** with the screen frozen: `DisplayListMenuID` turns tile transfer off for its 10-frame delay. Then the bag list appears: **POKé BALL ×1** and CANCEL, the fixed `SimulatedInputBattleItemList`, never the real bag | `BagWasSelected`, `home/list_menu.asm` |
| 10 | **▶ on POKé BALL for 20 frames** | `DisplayListMenuIDLoop` (`wBattleType` ≠ 0) |
| 11 | The list closes. **"OLD MAN used / POKé BALL!"** (`<PLAYER>` is temporarily the demo name: "OLD MAN@" / "PROF.OAK@" at 0f:4fe7 / 0f:4fef). The real name is restored right after this text | `ItemUseText00`, `DisplayBattleMenu.oldManName/.profOakName` |
| 12 | **20 frames**, then the toss animation. The "used" text stays up throughout | `ItemUseBall` `.skipShakeCalculations` |
| 13 | **Outcome.** PIKACHU → caught. OLD_MAN → `wCapturedMonSpecies = 1`, then caught unless `EVENT_INITIAL_CATCH_TRAINING` is set, which forces `$63` (3 shakes, breaks free) | `item_effects.asm:158–176` |
| 14 | **The animation.** `$43` (caught) plays TOSS, POOF, HIDEPIC, SHAKE ×3. `$63` (breaks free) adds POOF, SHOWPIC. HIDEPIC clears only the pic; the HUD stays | `TossBallAnimation`, `AnimationHideMonPic` |
| 15a | Caught: **"All right! / RATTATA was / caught!"** (the last line scrolls in on `cont`), the caught-mon jingle, then a wait for A. Not added to the party, owned flag not set | `.oldManCaughtMon`, `ItemUseBallText05` |
| 15b | Breaks free: **"Shoot! It was so / close too!"**, wait for A | `ItemUseBallText04` |
| 16 | **No ball is removed** (`wBattleType` ≠ 0) | `ItemUseBall` `.done` |
| 17 | `wCapturedMonSpecies` ≠ 0 in both cases, so the battle ends. `wBattleResult = 2` skips evolution and the Pikachu mood update. The screen goes white at once (`GBPalWhiteOut`) and the script carries on | `UseBagItem` `.returnAfterCapturingMon`, `EndOfBattle` |

### 1.2 Texts

| Text | Where from |
|---|---|
| "Wild @" + nick + line "appeared!" | `_WildMonAppearedText` (`text_ram`), transcribed as the normal battle already does |
| "OLD MAN" | `BATTLE_OLD_MAN_NAME`, extracted in V1a |
| "PROF.OAK" | 0f:4fef `DisplayBattleMenu.profOakName`. **Not extracted yet** (decision 4) |
| "<PLAYER> used" / item + "!" | `_ItemUseText001` + `text_low` + `_ItemUseText002` (`text_ram`): transcribed |
| "Shoot! It was so / close too!" | `BATTLE_SO_CLOSE`, extracted in V1a |
| "All right! / nick was / caught!" | `_ItemUseBallText05` (`text_ram`): transcribed, with the ASM citation (DECISIONS #29 item 6) |

### 1.3 Upstream's Pikachu catch vs the ASM

`pikachu_battle.ts` is a hand-built animation, not a battle. Where it departs:

| # | Upstream | ASM |
|---|---|---|
| 1 | No menu: "appeared!" → A → Oak throws | ▶ FIGHT → ▶ ITEM → bag → ▶ POKé BALL (§1.1 steps 7–10) |
| 2 | The enemy HUD is shown during "Wild PIKACHU appeared!" | Drawn after that text closes (step 6) |
| 3 | 60 frames of "PROF.OAK used" before the throw | 20 frames (step 12) |
| 4 | The text box is blanked during the poof and the shakes | "used POKé BALL!" stays up until the result text |
| 5 | The Pikachu pic and its HUD vanish when the ball lands, before the poof | The pic is hidden after the poof; the HUD stays |
| 6 | "All right! PIKACHU" / "was caught!", gone after 90 frames with no input | "All right!" / "PIKACHU was" / "caught!", then a wait for A |
| 7 | The name comes from the PROF_OAK trainer class | The battle engine's own "PROF.OAK@" string |
| 8 | Ends with an 8-frame fade to white | Instant white (`GBPalWhiteOut`), as every other battle already ends here |

Pikachu isn't marked seen either (step 3). Pikachu is owned from Oak's Lab onward, so
nothing shows the difference. It's still part of the shared code, so it comes along.

### 1.4 What stays as upstream has it

These are shared with every battle, and other slices own them:

- **The transition** (upstream's flash + stripes) → A5 picks per the ASM. For the Pikachu
  battle, `GetBattleTransitionID_CompareLevels` runs with an empty party, walking past
  `wPartyMon1HP` until it finds a non-zero HP. A5 must work out what that yields.
- **The slide-in.** Upstream eases in over 40 frames; the ASM slides linearly at 2 px per
  frame for 72 frames (`hSCX` $90 → 0), in both battle intros → A5.
- **The toss, poof and shake timings.** Upstream approximates them (arc 30 frames, poof
  24, each shake 30). The exact frames are in `Subanim_0BallToss*` / `ShakeEnemy` /
  `PoofEnemy` and the base coords → with §4's normal-catch finding.
- **Text that types out and scrolls on `cont`** → A5. Until then, the caught text uses
  V1c's two-line pages (`battleTextPages`): "All right! / PIKACHU was", A, "caught!".
- **Cries** (the "appeared!" cry, the Pikachu clip) → not implemented anywhere yet (J2
  lists cries).
- **The caught-mon jingle** (`SFX_Caught_Mon`, 08:41ce) isn't extracted → V5.

## 2. The plan — V1d

### 2.1 Steps

1. **Pure module `src/battle/catch_demo.ts`** (new, ASM-cited, no DOM), holding the rules
   as data, like `trainer_flow.ts`:
   - `type CatchDemoBattleType = 'OLD_MAN' | 'PIKACHU'`;
   - `catchDemoCaught(battleType, initialCatchTraining)`: PIKACHU → true; OLD_MAN → not
     the flag (§1.1 step 13);
   - `catchDemoBackPic(battleType)`: `/gfx/battle/oldmanb.png` or `prof.oakb.png`
     (`LoadPlayerBackPic`);
   - `CATCH_DEMO_BAG`: one POKé BALL ×1 (`SimulatedInputBattleItemList`);
   - `catchDemoSteps(opts)`: the ordered steps of §1.1 steps 5–15 with their frame
     counts and texts: appeared text (A) → HUD + 40 → menu FIGHT 20 → menu ITEM 20 + 10
     frozen → bag 3 → bag ▶ 20 → used text 20 → animation steps (4 or 6) → result text
     (A).
2. **The runner: move `pikachu/pikachu_battle.ts` to `battle/catch_demo_screen.ts`**
   (`git mv`, so its history follows) and generalize it:
   - `initCatchDemo({ battleType, enemy })` takes a real `BattlePokemon` from
     `createPokemon`, so the HUD shows the real mon;
   - the enemy's front pic loads by dex number with its own palette
     (`getMonsterPalette`), not a hardcoded YELLOWMON; the back pic comes from
     `catchDemoBackPic`, still MEWMON (species 0);
   - it keeps upstream's slide-in, colorize, ball arc, poof and shake drawing (§1.4), and
     walks `catchDemoSteps()` for everything else. That fixes the 8 departures in §1.3;
   - the menu and bag use `battle_ui`'s `renderActionMenu` / `renderItemMenu`. The bag's
     3 frames without a cursor need a small `showCursor` option on `renderItemMenu`;
   - no ball leaves the bag and nothing joins the party: the runner never touches either.
3. **Script command.** `{ type: 'pikachuBattle' }` becomes `{ type: 'catchDemo',
   battleType, species, level }`, mirroring what the scripts set (`wBattleType`,
   `wCurOpponent`, `wCurEnemyLevel`). `story/pallet_town.ts` passes `PIKACHU`,
   `PIKACHU`, 5. V1e's old-man scripts will pass `OLD_MAN`, `RATTATA`, 5 and set or clear
   `INITIAL_CATCH_TRAINING`, which the demo reads when it starts.
4. **`main.ts`:**
   - the `catchDemo` action creates the enemy, marks it seen, plays wildbattle, and runs
     the transition, then `initCatchDemo`;
   - the `pikachu_battle` state is renamed `catch_demo`;
   - at the end: restore the map palette, then instant white and fade in (as the
     `battle` finish handler does), and resume the script.
5. **Data:** `game_text.ts` gains `BATTLE_PROF_OAK_NAME` (0f:4fef), **decision 4**. Then
   `npm run setup pokeyellow.gbc` and diff the regenerated data; the expected diff is
   `game_text.json` +1 key and nothing else.
6. **Docs:**
   - `battle/ARCHITECTURE.md` gets a *Catch demo* section; `pikachu/ARCHITECTURE.md`
     loses its battle section and points there;
   - root `CLAUDE.md`: the module map (`pikachu/` exports), the state machine
     (`catch_demo`), the test baseline;
   - STATUS, DECISIONS #32, the §4 findings.

### 2.2 Tests (≈ +11, 429 → ~440)

- `src/battle/catch_demo.test.ts`:
  - the outcome rule: PIKACHU is always caught; OLD_MAN is caught unless the flag is set;
  - the step lists for OLD_MAN (both outcomes) and PIKACHU: step order, the frame counts
    40 / 20 / 20+10 / 3 / 20 / 20, and the texts ("Wild RATTATA / appeared!", "OLD MAN
    used / POKé BALL!", "PROF.OAK used…", both result texts);
  - the animation steps: 4 when caught, 6 on a break-out (the `$43` / `$63` nybbles);
  - the bag is exactly POKé BALL ×1 whatever the player carries;
  - both back pics and both enemies resolve (`static/gfx/battle/*.png`, `getSpecies`).
- `extraction.test.ts`: `BATTLE_PROF_OAK_NAME` is "PROF.OAK".

### 2.3 Size and cut point

One session. If it runs over, stop after steps 1 and 5 (the pure module, the text key and
their tests), committed. The runner and the wiring (steps 2–4) then become V1d-2. Nothing
half-done gets committed.

### 2.4 Verify

Automated: typecheck, the full suite with the ROM, `npm run build`.

**In the browser, agent-driven, then your play-test.** New game (a staged save in Pallet
Town with no intro flags), walk into the north grass:

| Check | Expected |
|---|---|
| Oak's catch | Transition → slide-in → "Wild PIKACHU / appeared!" with **no HUD** → A → HUD → ▶ FIGHT → ▶ ITEM → bag "POKé BALL ×1 / CANCEL" → ▶ POKé BALL → "PROF.OAK used / POKé BALL!" → throw, poof, 3 shakes → "All right! / PIKACHU was" → A → "caught!" → A → white → Oak's "Whew…" |
| The rest of the intro | Unchanged: the walk to the lab, the lab scene, Pikachu received |
| Old man, first demo (temporary hook, decision 2; flag set) | The old man's back pic, "OLD MAN used / POKé BALL!", 3 shakes, a poof, the Rattata reappears, "Shoot! It was so / close too!" → back to the script |
| Old man, repeat demo (hook, flag clear) | "All right! / RATTATA was" → "caught!" |
| Both old-man runs | Bag and party unchanged; Rattata marked seen; no console errors |

The hook is reverted before the commit, and `git diff` shows it gone.

### 2.5 Not in V1d

- The old man himself: the trigger, his texts, the walk-away, the Mart spawn, the repeat
  offer, the Gym door (V1e).
- The transition choice, the slide-in, typed text (A5); cries (J2); the jingle (V5).
- The exact toss animation, and the normal wild catch (§4).

## 3. Decisions

1. **Build the demo as its own module, beside `Battle` rather than inside it?**
   **Recommended: yes.** The two files are the pure `battle/catch_demo.ts` and
   `battle/catch_demo_screen.ts`, which is `pikachu_battle.ts` moved and generalized.
   The ASM routes these battles through its battle engine, but `Battle` assumes a player
   Pokémon, and Oak's catch runs with an empty party. Folding them into its 2,400 lines
   would also touch every normal battle. Upstream already built the Pikachu catch this
   way, so this keeps the change small.
2. **How to check the old man's demo before V1e?** **Recommended: unit tests, plus a
   temporary hook for my browser check that is never committed** (for example, the Pallet
   script switched to `OLD_MAN` / `RATTATA` for the run). You'd first see his demo in
   V1e, one slice later. The alternative is a debug-overlay button. That adds to
   upstream's non-vanilla tooling, which STATUS says not to grow before J2.
3. **Follow the ASM where upstream's Pikachu catch departs (§1.3)?** **Recommended: yes,
   all 8.** It's the same code both demos share, and each fix is cited. You'll notice it
   in the intro: the menu and bag appear, the HUD comes after "appeared!", the throw
   comes sooner, and "caught!" waits for A.
4. **Extract "PROF.OAK" as a text key (`BATTLE_PROF_OAK_NAME`, 0f:4fef)?**
   **Recommended: yes.** It's one line next to V1a's "OLD MAN" and keeps both demo names
   from the ROM rather than borrowing the trainer class name. That name happens to match,
   but it's a different string.

## 4. Found on the way — not V1d

| Finding | Where | Suggested home |
|---|---|---|
| **The normal wild catch departs from `ItemUseBall`.** Its texts are invented ("POKé BALL thrown!", "Gotcha!" — the ASM says "RED used / POKé BALL!" and "All right! / X was / caught!"). There's no toss animation, no caught-mon jingle, and no "New POKéDEX data will be added…" page on a first catch. The ball also leaves the bag *before* the throw; the ASM removes it after | `battle.ts` `throwBall`, `updateItemMenu` | A5, or a slice of its own; decide when A5 is planned. It can reuse V1d's toss drawing |
| **The normal wild intro shows the enemy HUD during "Wild X appeared!"** and draws no party pokéballs. The ASM draws the pokéballs (`DrawAllPokeballs`) during the text and the HUD after it | `battle.ts` `renderWildIntro` | A5 |
| **Both intros slide in over 40 eased frames**; the ASM slides linearly for 72 | `battle.ts`, the catch demo | A5 |
