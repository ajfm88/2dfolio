# A6b — review of Sol 6.1's implementation

## Final review — commit `eac3dd3` (2026-10-01): ✅ passed

Re-reviewed the committed diff (`164d4bf..eac3dd3`, 27 files, engine and docs only, no
`data/` / `static/` / `refs/` change).

- **Checks:** typecheck clean; **570/570** with `ROM_PATH`; build OK.
- **Every interim item is resolved or logged:**
  - **R-1 fixed:** `npc.render` passes `screenY + 4` (the Game Boy's `YPIXELS`), with
    render tests at START's lower edge, with and without the Pokédex.
  - **N-1 fixed:** `IndigoPlateau` is outdoor (an `OUTDOOR_MAPS` set).
  - **N-4:** Sol checked the catch-demo path against `_InitBattleCommon` →
    `EndOfBattle`.
  - **N-2, N-3, N-5 and F-1** are logged in STATUS with homes.
- **New since the interim, checked against the ASM:**
  - **WALKING leaves the mood unchanged** inside `modifyPikachuHappiness`. In
    `ModifyPikachuHappiness`, `PIKAHAPPY_WALKING` = 6 → `PikachuMoods[5]` = `$80` →
    `.done`. The happiness change still applies first. ✓
  - **The walking bonus needs a living starter Pikachu.** It goes through
    `IsStarterPikachuAliveInOurParty` (`.checkanywhereinparty`). The random byte is
    still drawn when there is no starter, as in the ASM. ✓
    - Small gap: the ASM also matches the OT ID and OT name. Ours checks only species
      25 and HP, so a traded-in Pikachu would also count. Caught Pikachu carry the
      player's OT, so this can't happen without trades. It's covered by Sol's logged
      "Pikachu state audit".
  - **Oak's in-step image** (`DoScriptedNPCMovement` writes `IMAGEINDEX` mid-step) keeps
    his walking frames during the pop-in latch. ✓ A good catch, pinned by a test.
  - **The UI capture** draws exactly the states the old final render branch drew
    (`overworld`, `script`, `trainer_approach`, `textbox`, `start_menu`), plus the
    menu states that had their own branches. No text box is lost. ✓
- **Already logged by Sol:** upstream's `modifyPikachuHappiness` nudges the mood by 1,
  where the ASM sets it straight to the target (with a starter, OT and modifier guard);
  `$80` targets should leave it alone. Home: a Pikachu state audit / J2.

**Verdict:** A6b is correct against the ASM as far as code review and tests can show.
What remains is the user's play-test of `notes/08-a6-plan.md` §5.3-8.

---

## Interim review (working tree, before the commit)

2026-10-01, Claude Opus 5.5. **Interim review of the uncommitted working tree**, taken
while Sol was still working (files last modified 19:58). Re-review once Sol marks A6b
"awaiting review". The plan is `notes/08-a6-plan.md` §5, with the decisions in DECISIONS #37.

**Snapshot:** typecheck clean; `ROM_PATH=pokeyellow.gbc npm test` **565/565** (+63); no
`data/`, `static/` or `refs/` change.

## Verdict so far

The structure is right and close to the ASM throughout. There is **one bug to fix**
(R-1). The rest are small notes, and some are findings to log rather than fix.

Checked against the ASM and found right:
- **The map-script hook** runs before `readJoypad` on standing passes
  (`JoypadOverworld` → `RunMapScript`).
  - Pallet's trigger is `wYCoord == 0` with no facing check, and only
    `EVENT_FOLLOWED_OAK_INTO_LAB` (`PalletTownDefaultScript`).
  - The Oak's Lab trigger is `y == 6` (`cp 6`). It used to be `>= 6`, a good catch.
- **The step-end order** (`step_end.ts`): count → Pikachu → encounter → warp →
  connection. Simulated steps do warps and connections only.
  - Happiness is skipped with an empty party (`ApplyOutOfBattlePoisonDamage`).
- **`EnterMap` resets** run on warps, blackout and battle end, and not on connections.
  Verified: `CheckMapConnections` → `jp OverworldLoopLessDelay`, so it never reaches
  `EnterMap`.
- **The cooldown:** the third step can roll, because the count runs before
  `NewBattle`.
- **Walking happiness:** the 50% roll only at counter 0. The mood drift matches
  `UpdatePikachuHappinessAndMood`.
- **The encounter gates** (`encounterTerrain`):
  - the grass, water ($14) and indoor rules, with FOREST excluded;
  - the water pool used on water tiles;
  - the turn roll, which doesn't count down.
- **The hop:** `finishedStep` at the midpoint and the landing, both simulated. Script
  pushes wait on `isBusy`, so the midpoint flag doesn't end them early.
- **The sprite window** is 4 up / 4 down / 4 left / 5 right, from the NPC's map
  position (the claimed tile). Scripted sprites are exempt, and an invisible sprite
  doesn't advance.
- **The image refresh:** with a direction held, `updateSprites()` runs before
  `moving = true`, so images refresh on each step's first pass, as in `.noDirectionChange`.
- **The fixed-facing STAY cycle** only applies to NPCs with a map direction. `NONE` is
  omitted by the extractor, so those NPCs (the lab rival, Pallet's Oak and others) are
  untouched until A6c.
- **`captureUi`:** scale is always 1, and no module keeps its own copy of the canvas
  context, so swapping it is safe.

## R-1 (bug, fix in A6b): `npc.render` checks menu coverage one tile row too high

`spriteCovered()` expects the Game Boy's `YPIXELS`, and its unit tests use 60 for the
player's row. That part is right:
- The player sprite's `YPIXELS` is `$3c` = 60 (`player_animations.asm:89`).
- The player's block sits on screen tile rows 8–9 (`hlcoord 8, 9`).
- Yellow's `GetTileSpriteStandsOn` uses `and $f8`, so the top row is
  `floor((ypix + 4) / 8)`.

But `npc.render` passes **our** `screenY = this.y - cameraY - 4`, which is 56 for the
player's row. **Our scene is drawn 4 px above the Game Boy's** (see F-1). So the
footprint it checks is one tile row too high.

- **Failure:** open START (with the Pokédex, the box covers rows 0–15). Take an NPC 4
  steps below the player and 1 step right (screen column 10):
  - On the Game Boy its rows are 16–17. It is **visible**.
  - Ours checks rows 15–16 and **hides** it.
  - Without the Pokédex (rows 0–13), the same happens 3 steps below.
- The text box (rows 12–17) gives the right answer only by luck: NPCs 1 step below stay
  visible, and 2 steps below are hidden, either way.
- **Fix:** `spriteCovered(screenX, screenY + 4, uiTiles.tileAt)` in `npc.render`, with a
  comment pointing at F-1.
- **Add a test:** an NPC through `npc.render` with the START box covering
  `(80, 0, 80, 128)`:
  - 4 steps below the player, 1 right: drawn;
  - 3 below: hidden.

  The existing integration test only straddles the menu edge horizontally.

## Small notes (fix if cheap, otherwise log)

- **N-1 `GameMap.isIndoor`:** the towns list leaves out `IndigoPlateau`. In
  `map_constants.asm` it's a town (`$09`), below `FIRST_INDOOR_MAP`. It's harmless
  because it has no wild data, but it's a one-word fix.
- **N-2 `wMovementFlags` `BIT_STANDING_ON_WARP`:** `CheckWarpsNoCollision` sets it when a
  step ends on a warp tile. It is cleared only at `.newBattle`, *after* `NewBattle`.
  `TryDoWildEncounter` returns early on any `wMovementFlags` bit. So **the step after a
  step that ended on a warp tile can't roll**. `movementBlocked: player.isBusy` doesn't
  model this. It's rare (a warp tile next to grass), so log it if it isn't cheap.
- **N-3 the hop midpoint and trainer sight:** `justFinishedStep` now fires at the hop's
  midpoint, and the existing step-end sight check in `updateOverworld` runs there too.
  Today no trainer stands near a ledge, but **A1c** (which moves sight into the map-script
  hook) should know. Log it in STATUS → *Notes for later* under A1c.
- **N-4 the catch demo cooldown:** `catch_demo` sets the cooldown, as if
  `EndOfBattle` runs for `BATTLE_TYPE_OLD_MAN` / `PIKACHU`. I haven't verified that
  path. It can't matter today (no grass at either spot), so a comment saying so is
  enough.
- **N-5 `wPikachuEmotionModifier`:** the ASM clears it when the mood reaches 128. We
  have no emotion modifier yet (CLAUDE.md's *not yet implemented* table, `wd49b`), so
  nothing to do. Add it to that table's row as a note.

## F-1 (finding, not A6b): the whole overworld is drawn 4 px higher than the Game Boy's

- Upstream's camera is `player.y - 60`, so the player's block is drawn at screen y = 60
  and the player sprite at 56.
- On the Game Boy the block sits at 64 (tile rows 8–9) and the sprite at 60 (`$3c`).
- So the view shows 3.75 blocks above the player and 4.25 below, where the Game Boy
  shows 4 and 4.
- Every overworld frame is affected, including where text boxes and menus fall over
  the map.
- Fixing it touches the camera and every screen-relative overlay: the "!" bubble, the
  grass overlay, the Pokécenter heal, and Pikachu's emotion box.
- **Proposed home:** a small slice of its own, decided with the user. Not A6b.

## Process

- When done: a *A6b result* section in `notes/08-a6-plan.md`, STATUS marked "awaiting
  review", and a local commit (never pushed). Then Claude re-reviews the diff, and the
  user plays `notes/08-a6-plan.md` §5.3-8.
- Please log F-1 and N-3 (and N-2 / N-5 if not fixed) in STATUS → *Notes for later*.
