# A1 — Item balls + trainer sight: probe results + plan

2026-09-27, Claude Opus 5.5. **Status: plan, awaiting the go-ahead (§4).** No code yet.
§1 is the research, §2 the plan, §3 what turned up on the way, §4 the decisions.

**Sources:** `refs/pokeyellow` @ `e89ead15`:
- items: `engine/events/pick_up_item.asm`, `engine/events/hidden_items.asm`,
  `engine/items/inventory.asm`, `home/give.asm`, `engine/overworld/toggleable_objects.asm`,
  `data/maps/toggleable_objects.asm`;
- text and sound: `home/text.asm`, `home/delay.asm`, `home/text_script.asm`,
  `engine/menus/display_text_id_init.asm`, `audio/headers/sfxheaders1.asm`,
  `audio/sfx/get_item{1,2}_*.asm`;
- trainers: `home/trainers.asm`, `engine/overworld/trainer_sight.asm`,
  `engine/overworld/emotion_bubbles.asm`, `scripts/ViridianForest.asm`,
  `macros/scripts/maps.asm`;
- the loop: `home/overworld.asm`, `engine/overworld/movement.asm`,
  `engine/overworld/advance_player_sprite.asm`;
- pret's sym file (`git show origin/symbols:pokeyellow.sym`).

Compared with gen1recomp (`src/world/OverworldController.lua` `checkTrainerSight`,
`NPC.lua`, `Player.lua`, `PikachuFollower.lua`).

Upstream code read: `overworld_controller.ts`, `npc.ts`, `player.ts`, `main.ts` (the
trainer flow, `trainer_approach`, the textbox state, `runDueTicks`), `items.ts`,
`save.ts`, `story_state.ts`, `audio/sfx_engine.ts`, `audio/music_engine.ts`,
`rom/extractors/audio.ts`, `rom/extractors/maps.ts` and `renderer.ts`.

## TL;DR

- **A1 is three slices.**
  - **A1a — the item jingles.** When you pick up an item, a jingle plays and the text box
    closes once it ends. Neither jingle can play today (§1.3). The extractor misreads
    SFX written in music mode, and the SFX engine can't play them. A1a fixes both for
    `get_item1` and `get_item2`.
  - **A1b — item balls.** It also fixes hidden items, whose pickup departs from the ASM
    in three ways (§1.2).
  - **A1c — trainer sight, as `TrainerEngage` runs it** (§1.4–§1.5).
- **Found: the overworld runs at twice the Game Boy's speed** (§1.6).
  - The ASM's overworld loop takes 2 frames per pass. The player walks one step in 16
    frames, and NPCs in 32.
  - Ours takes 8 ticks per step for both. Since DECISIONS #33 a tick is one frame, so
    **the player and Pikachu walk at 2×, and NPCs at 4×**.
  - Before #33, upstream's broken loop ran 30 ticks/s on a 60 Hz display, and that
    happened to give the right walking speed.
  - Trainer sight runs on this loop: when the check runs, how fast the trainer walks up,
    and when sprites pop in. So **A1c needs the loop fixed first.** Proposed: a new
    milestone, **A6 "Overworld pace per the ASM"**, between A1b and A1c.
- **6 decisions (§4)**, each with a recommendation. Reply **go** to take all six.

## 1. Probe results

### 1.1 Item balls — `PickUpItem` (`engine/events/pick_up_item.asm`)

An item ball's text entry is `PickUpItemText` (`home/overworld_text.asm:28`). It runs
`PickUpItem` inside `DisplayTextID`:

| # | ASM | What the player sees |
|---|---|---|
| 1 | `DisplayTextIDInit` draws the text box | an empty box |
| 2 | `GiveItem` (item, 1) → `AddItemToInventory_` | — |
| 3 | success: `HideObject` sets the ball's toggleable-object flag, then `UpdateSprites` | the ball disappears |
| 4 | `wDoNotWaitForButtonPressAfterDisplayingText` = 1, then `FoundItemText` | "YELLOW found / POTION!" types out |
| 5 | `sound_get_item_1` → `TextCommand_SOUND` (`home/text.asm:513`): `PlaySound SFX_GET_ITEM_1`, then `WaitForSoundToFinish` | the jingle, with the text still up |
| 6 | `DisplayTextID` skips the button wait; `HoldTextDisplayOpen` loops while A is held | **the box closes by itself** once the jingle ends and A is up |
| 3′ | bag full: `NoMoreRoomForItemText` ("No more room for / items!"). No flag is set, and the button wait stays | the text, then A; **the ball stays** |

- **The ball stays gone.** `HideObject` (`toggleable_objects.asm:133`) sets the object's
  bit in `wToggleableObjectFlags`, which the save keeps. `data/maps/toggleable_objects.asm`
  names each ball by its object constant, so `VIRIDIANFOREST_POTION1` is our
  `ViridianForest:potion1`. The Forest's and Route 2's balls all start ON.
- **`GiveItem` → `AddItemToInventory_`** (`engine/items/inventory.asm`). The bag holds 20
  slots.
  - **Item already in the bag:** add to its slot. If the total would reach 100, the slot
    becomes 99 and the rest goes into a new slot, but only if there is room. Without
    room the whole add fails and the slot is left as it was.
  - **New item:** a new slot if the bag has fewer than 20, else fail.
  - **Upstream's `addToInventory`** has no 99 limit, so a stack can grow past 99.
- **`WaitForSoundToFinish`** (`home/delay.asm:15`) waits for SFX channels 5, 6 and 8. It
  skips channel 7 (`inc hl` three times).
- **Balls in the extracted maps:**
  - Viridian Forest: POTION (25,11), POTION (12,29), POKé BALL (1,31).
  - Route 2: MOON STONE (13,54) and HP UP (13,45). Both are behind a Cut tree (V1b's
    flood fill).
- **Upstream today:** talking to a ball does nothing. V1b made balls inert until A1.

### 1.2 Hidden items — `HiddenItems` (`engine/events/hidden_items.asm`)

Hidden items already work upstream (Viridian City's Potion, the Forest's two), with
three departures:

| | ASM | Upstream |
|---|---|---|
| Order | "found X!" prints **first** (`FoundHiddenItemText`), then `GiveItem` | gives first, then prints |
| Success | `SFX_GET_ITEM_2`, a different jingle; the box closes by itself (the flag is set) | no jingle; waits for A |
| Bag full | "YELLOW found / X!", A, then "But, YELLOW has / no more room for / other items!" (`_HiddenItemBagFullText`), A | "No more room for / items!", the item-ball text |

### 1.3 The jingles — why the pickup needs audio work first

- `SFX_GET_ITEM_1` (02:4192) and `SFX_GET_ITEM_2` (02:419b) use channels 5, 6 and 7.
  - Each channel starts with **`execute_music`**. Everything after it is music commands:
    `tempo`, `volume`, `vibrato`, `duty_cycle`, `toggle_perfect_pitch`, `note_type`,
    `octave`, `note` and `rest`.
  - Channel 7 is the wave channel.
  - Audio banks 1–3 hold identical copies, so one extraction each is enough.
- **The extractor decodes them wrongly.** `extractors/audio.ts` `decodeChannelCommands`
  records `execute_music` but keeps decoding in SFX mode.
  - In SFX mode `$10` is `pitch_sweep` and `$20–$2F` is `square_note`, but in music mode
    those bytes are notes C♯ and D.
  - So `get_item2`'s first `note D_, 4` would come out as a `square_note`.
- **The SFX engine can't play them.** `audio/sfx_engine.ts` knows only the SFX-mode
  commands and skips `note`, `note_type` and `octave`. Both jingles would be silent and
  end at once.
- **The music engine already can.** `music_engine.ts` handles every command they use. A1a
  makes an SFX channel in music mode run through that same interpreter, with the SFX
  tempo, on the channel it overrides.
- **Setup needs only the headers.** Neither jingle is in `SFX_HEADERS`, but both setup
  name lists already include `get_item1` and `get_item2`. None of the 10 SFX we extract
  today uses `execute_music`.
- **Other music-mode SFX** (get key item, level up, caught mon, and so on) need the same
  mechanism. They stay in V5, which will then only need header entries and call sites.

### 1.4 Trainer sight — when the check runs and what it tests

**When.** A map with trainers runs `CheckFightingMapTrainers` as its default map script
(the Forest's `SCRIPT_VIRIDIANFOREST_DEFAULT`). Map scripts run from `JoypadOverworld`
(`home/overworld.asm:1579`). That happens at the **start of every overworld loop pass
while the player isn't mid-step**, before the joypad is read. So:
- **A standing player can be spotted:** after a wild battle, after a text box, on entering
  a map, or when a trainer turns.
- **A wild battle comes first.** After a step, the wild-encounter check (`NewBattle`) runs
  in the same pass, and the sight check at the start of the next one. Stepping onto a
  trainer's line in grass can start a wild battle; **the trainer then spots you as soon
  as it ends**.
- **A held direction doesn't carry the player on.** On engaging, `hJoyHeld` is cleared
  and the d-pad ignored (`wJoyIgnore`), so no next step starts.

**Which trainer.** `CheckForEngagingTrainers` (`home/trainers.asm:257`) walks the map's
trainer headers in order and skips beaten trainers. **The first one that engages wins.**
A header's first byte is its sprite index, and `def_trainers` counts up from it, so header
order is object order. The Forest's JSON already lists the trainers in that order.

**`TrainerEngage`** (`engine/overworld/trainer_sight.asm:164`) works in 8-bit **screen
pixels**. The player is always at ($40, $3c). A trainer on the grid sits at
$40 + 16·dx, $3c + 16·dy (mod 256).
1. **An off-screen trainer never engages.** The sprite's image index must not be `$ff`.
   `CheckSpriteAvailability` (`movement.asm:448`) sets it to `$ff` while the sprite is
   outside a window reaching 4 steps up, down and left of the player, and 5 steps right.
2. The trainer must share the player's row (screen Y = $3c) or column (screen X = $40).
   The distance is `CalcDifference` in pixels, and 0 doesn't count.
3. `CheckSpriteCanSeePlayer`: distance ≤ sight × 16, and the trainer faces along that axis.
4. `CheckPlayerIsInFrontOfSprite`: the player is on the side the trainer faces. The Power
   Plant skips this check, for its Voltorbs.
5. Engage: set `BIT_SEEN_BY_TRAINER` and call `EngageMapTrainer`. **The meet music starts
   here, at spotting** (`PlayTrainerMusic`).

**Two quirks come out of this, and both stay (Hard rule 7):**
- **A trainer facing down can't see exactly 4 steps.**
  - The sprite 4 steps above the player has screen Y = $3c − $40 = **$fc**.
    `CalcDifference($3c, $fc)` gives $c0 = 192, which is more than 64.
  - So a down-facing trainer with sight 4 only sees 3. gen1recomp hit this on Route 9
    (its issue #76).
  - `CheckPlayerIsInFrontOfSprite` does special-case $fc, but it only runs after step 3
    has already failed.
- **Sprites pop in one pass late.**
  - The player's map coordinates change only at the end of a step (`_AdvancePlayerSprite`),
    and `CheckSpriteAvailability` judges the window from them. So a sprite that scrolls
    into view during a step keeps image index `$ff` until the next `UpdateSprites`.
  - In the pass after a step, that `UpdateSprites` runs *after* the sight check.
  - So when you walk steadily toward a trainer standing exactly at the window's edge (4 up,
    down or left), it spots you **one step closer** than its sight says. If you stop on
    that step, it spots you one pass later at the full distance.
  - This is my reading of the loop order. gen1recomp doesn't model it, and A1c will pin it
    with a test. The same rule makes NPCs pop in at the screen edges after each step,
    which is part of A6.

Gen 1 has no line-of-sight test through walls or other sprites.

### 1.5 After spotting — the bubble, the walk-up, the battle

| # | ASM | Detail |
|---|---|---|
| 1 | `EngageMapTrainer` → `PlayTrainerMusic` | meet music: male, female or evil (V1c's `meetMusicFor`) |
| 2 | `EmotionBubble` (`emotion_bubbles.asm`) | the "!" (`gfx/emotes/shock`) 16 px above the trainer, over the other sprites. It stays **60 frames** with sprite updates off, then one more frame and `UpdateSprites`. Upstream's `drawExclamationBubble` already draws it in that spot |
| 3 | `TrainerWalkUpToPlayer` (`trainer_sight.asm:77`) | steps = pixel distance ÷ 16 − 1, in the trainer's facing direction; **an adjacent trainer doesn't walk** |
| 4 | `DisplayEnemyTrainerTextAndStartBattle` (`home/trainers.asm:156`) | waits for the walk to end, then shows the before-battle text through `TalkToTrainer`, which skips `EngageMapTrainer` because the music is already playing. A starts the battle |
| 5 | `EndTrainerBattle` | beaten only on a win (V1c). The trainer **stays where it walked to**: `LoadMapData` skips `InitSprites` after a battle. It returns to its spot when the map loads again |

- **The walk-up ignores collisions.** Scripted NPC steps skip them (`CanWalkOntoTile`:
  "always allow walking if the movement is scripted"), so the trainer walks through
  Pikachu if it's in the way.
- **Other NPCs keep moving** during the walk-up, which goes at NPC pace (§1.6).
- **The player doesn't turn** toward the trainer. Nothing in this path turns them.
- **A and START do nothing** from the bubble to the text (`BIT_TRAINER_BATTLE`,
  `BIT_SEEN_BY_TRAINER`).

### 1.6 The overworld runs at twice the Game Boy's speed

- **The ASM's overworld loop takes two frames per pass.** `OverworldLoop` calls
  `DelayFrame` twice (`home/overworld.asm:43–46`).
  - While walking, each pass moves the player 2 px: the step vector is doubled
    (`add a` in `_AdvancePlayerSprite`), and `wWalkCounter` starts at 8.
  - Each walking pass returns through `CheckMapConnections` → `jp OverworldLoop`.
  - So a player step takes **16 frames**.
- **NPCs move 1 px per `UpdateSprites`.** `UpdateSprites` runs once per pass, and a step is
  16 moves (`TryWalking` sets the walk counter to 16, `movement.asm:267`).
  - So an NPC step takes **32 frames**, half the player's speed.
  - Back-to-back scripted steps each need one extra pass to start, by my reading of
    `UpdateNPCSprite`. gen1recomp uses a flat 32.
- **Ours:** `player.ts`, `npc.ts` and `pikachu_follower.ts` all move 2 px per tick, so a step
  takes 8 ticks. Since DECISIONS #33 a tick is one frame. So **the player and Pikachu walk
  at 2×, and NPCs at 4×**.
- **How it happened:**
  - On a 60 Hz display, upstream's loop ran its "50 fps" as 30 ticks/s, and 8 ticks per
    step came out right by accident. On the user's 240 Hz display it ran 48 ticks/s, which
    is 1.6×.
  - O-5 was right for everything that counts real frames: text (3 frames per letter at
    medium), battles and audio. The overworld's movement had been tuned against the
    accidental 30.
- **gen1recomp agrees:** 16 frames per step in `Player.lua` ("the same
  2-frames-per-iteration cadence"), 32 in `NPC.lua`, 16 in `PikachuFollower.lua`.
- **What A6 would touch** (A6's own plan settles it):
  - the pace of the player, NPCs and Pikachu;
  - the order inside a pass (map script → joypad → step). This would also fix the held-key
    step triggers STATUS logs for Pallet and Oak's Lab;
  - `UpdateSprites` timing and sprite pop-in;
  - NPC random-walk delays: ASM 0–127 passes (0 counts as 256), ours 60–180 ticks;
  - turning, bumps, ledge hops and scripted walks.

### 1.7 What the engine has today for sight

Upstream has `npc.ts` `isPlayerInSight`, `startApproach` and `updateApproach`, and
`main.ts`'s `trainer_approach` state. Since V1c that state ends in
`engageTrainer(npc, true)`, but no map sets `sightRange`, so none of it runs:

| | ASM | Upstream |
|---|---|---|
| When it checks | every pass while the player isn't mid-step, before input | only on the tick a step ends, after everything else, and never after a wild battle |
| Geometry | 8-bit screen pixels, with the $fc quirk; the trainer must be on screen | tiles along the facing; no screen check |
| Order | header order, first wins | `npcs` order, which is the same today |
| Meet music | at spotting | none on this path |
| "!" | 60 + 1 frames, every sprite frozen | 40 ticks, other NPCs frozen |
| Walk-up | NPC pace; other NPCs keep moving | 8 ticks per step; other NPCs frozen |
| Sight data | header byte 1 = sight << 4 | not extracted (V1a held it back) |

## 2. The plan

Each slice ends with verify, a STATUS update and a local commit, and the game stays
playable between them.

### 2.1 A1a — Music-mode SFX: the two item jingles

> **2026-10-06: superseded in detail by `notes/16-a1a-plan.md`.** The probes there found that
> sharing the music interpreter also needs the SFX tempo, channel mapping, perfect pitch,
> vibrato, wave-octave and hand-off rules, and that the wait includes channel 8's drums.
> Implement from that plan, not from the outline below.

1. **Extractor** (`extractors/audio.ts`): after `execute_music`, decode the rest of the
   channel as music. Add `get_item1` (02:4192) and `get_item2` (02:419b) to `SFX_HEADERS`.
   `npm run setup` then writes 2 more SFX JSON files, 12 in all. **The regenerated diff
   must be exactly those 2 files and their `static/` mirrors.**
2. **Engine** (`sfx_engine.ts`, `music_engine.ts`): an SFX channel that begins with
   `execute_music` runs through the music engine's channel interpreter (shared, not
   copied). It uses the SFX tempo and overrides its music channel the way SFX-mode
   channels already do.
3. `audio/index.ts`: add a `WaitForSoundToFinish` check that watches channels 5, 6 and 8,
   not 7.
4. **Tests:**
   - ROM tests: both jingles decode to the ASM's command lists
     (`audio/sfx/get_item{1,2}_1.asm`).
   - Engine tests: frames per note on each channel, and the frame on which the wait
     releases.
5. **Verify:** typecheck, the full suite and the build. In the browser, a temporary hook
   plays both jingles over the Forest music, and it's removed before the commit. **Your
   ear is the check here**, since the agent can't hear them.

### 2.2 A1b — Item balls and hidden items (engine)

1. `items.ts` `addToInventory`: `AddItemToInventory_`'s 99-per-slot rule (decision 4).
2. **Save:** a new `hiddenObjects` list of `Map:npcId` keys, like the ASM's toggleable-object
   flags (decision 5).
   - It's applied when a map loads, like `applyDefeatedTrainers`.
   - A new game clears it, and older saves start with it empty.
3. **A pure module, `overworld/item_pickup.ts`**, with ASM citations and tests, following
   the V1c pattern. As data it holds the steps for an item ball (found / bag full) and a
   hidden item (found / bag full).
4. **The text box learns not to wait for A:** it types the text, plays the jingle, waits
   for the sound to finish, then closes once A is up (`HoldTextDisplayOpen`).
   - The texts are transcribed with ASM citations, since they carry runtime values
     (DECISIONS #29): `_FoundItemText`, `_NoMoreRoomForItemText`, `_FoundHiddenItemText`
     and `_HiddenItemBagFullText`.
5. `overworld_controller.ts`: an NPC with `item` runs the pickup, and the hidden-item
   branch runs the new steps.
6. **Tests:**
   - the 99 rule: 99 + 1 gives 99 plus a new slot of 1; a full bag fails and leaves the
     slot alone; the bag holds 20 slots;
   - the step lists;
   - `hiddenObjects` saved and applied.
7. **Verify** (the agent first, then your play-test):
   - **The Forest's balls:** the box appears, the ball disappears, the text types, the
     jingle plays, and the box closes by itself.
   - **A full bag** (20 slots): "No more room for / items!", then A, and the ball stays.
   - **Save → reload:** the balls stay gone.
   - **The Forest's hidden POTION:** the text, then the second jingle. With a full bag:
     "found", A, then "But, … other items!".
   - **Route 2's balls** through a staged save, since they're behind Cut.

### 2.3 A6 — Overworld pace per the ASM (new milestone, decision 2)

A6 gets its own probe and plan when it's claimed, and will probably be split. Its scope,
from §1.6:
- the overworld runs on 2-frame passes: the player moves 2 px per pass, NPCs 1 px, and
  Pikachu at the pace `pikachu_follow.asm` gives;
- the ASM's order inside a pass;
- `UpdateSprites` timing, with sprite pop-in;
- NPC random movement and turning: STAY/NONE NPCs turning, fixed-facing NPCs turning back
  after a talk, and beaten trainers turning. STATUS already logs all three;
- ledges, bumps and scripted walks.

Text, battles, audio and script `wait`s keep counting real frames.

### 2.4 A1c — Trainer sight (data and engine, after A6)

1. **Data:** `sightRange` (header byte 1 >> 4) on every map trainer: youngster2 4,
   youngster3 4, youngster4 1, cooltrainer_f 0, youngster5 4. Tests: a ROM test against
   the `trainer` macros in `scripts/ViridianForest.asm`, and one that each map's trainers
   come in header order. The regenerated diff must be that field only.
2. **A pure module, `overworld/trainer_sight.ts`:**
   - `trainerEngages()`, as §1.4: 8-bit screen math, the on-screen flag, $fc, the in-front
     check and the Power Plant exception;
   - `engagingTrainer()`: header order, first wins;
   - `walkUpSteps()`.
3. **When it runs:** where A6 puts map scripts, in every pass while the player isn't
   mid-step and before input, while the Forest's script is in its default state.
4. **On engaging:** the meet music, then "!" for 60 + 1 frames with every sprite frozen,
   then the walk-up at A6's NPC pace (other NPCs moving, collisions ignored), then V1c's
   `engageTrainer(npc, true)`.
5. Remove upstream's `isPlayerInSight`, `startApproach` and `updateApproach`.
6. **Tests:** each quirk from §1.4 as a case; the order; walk-up steps, including 0 for an
   adjacent trainer; the step list (music, 61 frames, walk, text).
7. **Verify, per Forest trainer:**
   - spotted at the ASM's distance. youngster5, approached from the right, spots you at 4
     if you stop and at 3 if you keep walking (the pop-in);
   - the meet music at the moment you're spotted;
   - "!" for about 1 s, the walk-up, the text, the battle;
   - once beaten, no second engagement;
   - after a loss, spotted again when you come back;
   - spotted right after a wild battle on the trainer's line.

### 2.5 Order and size

A1a (1 session) → A1b (1) → A6 (its own plan, likely 2–4 sessions) → A1c (1–2) → A5 → V2.
A1a and A1b don't depend on A6.

## 3. Found on the way — not A1

| Finding | ASM | Proposed home |
|---|---|---|
| The overworld at 2× (§1.6) | `home/overworld.asm`, `movement.asm` | A6 |
| Sprites pop in at the screen edges after a step (§1.4) | `CheckSpriteAvailability` | A6 |
| After a text box, the ASM leaves an NPC facing the player: `DisplayTextIDInit` saves its facing after it has turned, then restores that. A fixed-facing STAY NPC turns back only when its random delay runs out. Upstream turns it back after 120 ticks | `display_text_id_init.asm`, `movement.asm` | A6, with the NPC-turning finding |
| More jingle call sites: Route 1's Potion sample (`sound_get_item_1`); Daisy's Town Map and Oak's parcel, Poké Balls and Pokédex (`sound_get_key_item`) | `scripts/Route1_2.asm`, `BluesHouse.asm`, `OaksLab.asm` | V5; after A1a these need only headers and call sites |
| `WaitForSoundToFinish` ignores channel 7 | `home/delay.asm` | handled in A1a |

## 4. Decisions

1. **Split A1 into A1a (jingles), A1b (item balls and hidden items) and A1c (trainer
   sight)?** **Recommended: yes.** The pickup can't be right without its jingle, and sight
   is a different system. A1a extracts only the two item jingles; the other music-mode
   SFX stay in V5.
2. **Add A6 "Overworld pace per the ASM" as milestone 36, between A1b and A1c?**
   **Recommended: yes.**
   - Sight is timed by the loop: when the check runs, the walk-up pace and the pop-in. Built
     at today's pace, it would be timed wrong and redone in A6.
   - A1a and A1b don't touch the loop, so they can go first.
   - The alternative is A6 before A1a, because every play-test runs at 2× until it lands.
     Reply "A6 first" for that.
3. **Fix the hidden-item pickup in A1b?** **Recommended: yes.** It's the same pickup with
   the same text box change, and it plays the other jingle.
4. **Port `GiveItem`'s 99-per-slot rule into `addToInventory` in A1b?** **Recommended:
   yes.** Pickups go through it. It also governs shop and PC adds, but those change only
   past 99.
5. **Keep picked-up balls in a saved `hiddenObjects` list (`Map:npcId`)?** **Recommended:
   yes.** It's the ASM's toggleable-object flags. Later `HideObject` users (Mt. Moon's
   fossils, the Snorlaxes, Pokémon placed as trainers) can reuse it.
6. **Let the two small data changes ride with their engine slices?** **Recommended: yes.**
   - A1a carries the decoder fix and 2 headers; A1c carries `sightRange`.
   - Neither does anything without its engine code, and each regenerated diff has to show
     only that change, as with V1c and V1e.
   - Otherwise CONVENTIONS' "don't mix extraction and engine" would ask for two more
     one-field slices.

Reply **go** to take all six, or answer by number.
