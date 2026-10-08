# V1 — Route 2 + Viridian Forest: probe results + plan

2026-09-22, Claude Opus 5.5. **Status: approved 2026-09-22.** The user accepted the
split and all six §4 recommendations (DECISIONS #29). **V1a done** (see *Progress*);
V1b is next.

**Sources.** `refs/pokeyellow` @ `e89ead15` (the ASM). pret's `symbols` branch @
`573535d7`, read with `git -C refs/pokeyellow show origin/symbols:pokeyellow.sym`
(already fetched, so this doesn't write to the clone). It matches our ROM: the 5
offsets upstream already hardcodes line up exactly. A read-only probe parsed the
V1 maps straight from `game/pokeyellow.gbc` the way `extractors/maps.ts` does,
including a replica of its text fallback (script left in that session's
scratchpad; every number below is its output).

## TL;DR

- V1 is bigger than its one PLAN row: **5 slices, about 5–6 sessions** (§3).
- Five findings drive the split:
  1. **The extractor's NPC-text fallback returns the wrong text** for everything V1
     needs that isn't a plain `text_far` (§2.2). Trainers must be read from their
     trainer headers; the Forest signs need explicit offsets.
  2. **Upstream's trainer flow departs from `home/trainers.asm` in 4 ways** (§2.4):
     no pre-battle text or meet music, no end-battle text, the trainer counts as
     beaten before the battle, and invented "I lost to you..." afterwards.
  3. **Yellow's Viridian old man is a forced catching demo**, not a text box (§2.5):
     a third NPC the extractor drops today (`OLD_MAN2`), a scripted
     `BATTLE_TYPE_OLD_MAN` battle against a Lv5 Rattata that **fails** in Yellow, a
     walk-away, and a repeatable demo once you visit the Mart. The "demo gate" is
     three sites, found by searching `VIRIDIAN_OLDMAN_DEMO` and "as far as the demo":
     `overworld_controller.ts`, `story_state.ts`, and `extractors/game_text.ts`, which
     writes invented text into `data/game_text.json`. (Line numbers drift; they were
     411 / 78 / 293 / 91 at planning time.)
  4. **A Yellow bug to reproduce:** the "LEAVING VIRIDIAN FOREST" sign shows the
     TRAINER TIPS 1 text (`scripts/ViridianForest.asm`: "supposed to be
     ViridianForestPrintLeavingSignText").
  5. **Not in PLAN.md at all:** the Route 2 trade house runs an in-game trade
     (Clefairy → Mr. Mime "MILES"), and Route 22 has a second upstream demo gate — a
     fake Blue with invented text (`blue_blocking` in `maps.ts`).

## Progress

### V1a result — done 2026-09-22, commit `ca93482`

Landed as planned in §3. The regenerated-data diff showed that the existing 12 maps
are unchanged apart from Viridian's new north connection.

- **What the JSON now carries:**
  - NPCs: `item` on item balls. On standard map trainers, `trainerClass`,
    `trainerParty` (0-based), `endBattleText` and `afterBattleText`, with `dialogue`
    holding the before-battle text. No `dialogue` for NPCs marked `scripted`
    (Oak's Aide, the Game Boy kid) or for item balls.
  - Maps: Viridian → north to Route2 (offset 5). Route2 → south only.
- **Refinement: what counts as an item ball.** The plan said "item-flagged object".
  The diff caught Yellow's Blue's house: Daisy and the Town Map end in a stray `, 0`
  (`objects/BluesHouse.asm`), so they're item-flagged with item 0, and their text got
  blanked. An item ball is now an item-flagged object whose TextPointers entry is
  `PickUpItemText` (00:23ef, `PICK_UP_ITEM_TEXT_ADDR`). A test guards Blue's house.
- **Trainer rule:** class byte ≥ `OPP_ID_OFFSET` (200) **and** the handler is
  `text_asm; ld hl, <header>` with 4 `text_far` texts in the map's bank. Oak's Lab's
  rival (`text_asm; CheckEvent`) and Route 22's rivals (`farcall`, not trainer
  objects) correctly get nothing.
- **Extra text keys** beyond the plan's list: `BATTLE_SO_CLOSE` (`_ItemUseBallText04`)
  and `BATTLE_OLD_MAN_NAME` ("OLD MAN", `DisplayBattleMenu.oldManName` 0f:4fe7), both
  for V1d.
- **Checked:** Route 22's existing north connection to the unextracted Route 23 can't
  be reached (no walkable step on its top row, solid border block), so it can't hang
  the game.
- **Tests:** 381 → **399**: 7 deep comparisons for the new maps, 10 V1 checks, and the
  old man pic pixel-identical to pret. The V1 checks cover the trainer headers vs
  `text/ViridianForest.asm`, NPC ids and facing vs the ASM object lists, item balls,
  Blue's house, scripted NPCs, the leaving-sign bug, connections, LAST_MAP exits and
  hidden items. Setup run twice → 848 files byte-identical. `npm run build` OK. The
  dev server serves every new file.
- **Next: V1b** — engine only; all the data it needs is in place.

## 1. What V1 contains (measured)

| Map | ID | Tileset | Blocks | Music | Palette | Contents |
|---|---|---|---|---|---|---|
| Route2 | $0D | OVERWORLD | 10×36 | routes1 | ROUTE | 7 warps, 2 signs, 2 item balls (Moon Stone, HP Up); N→Pewter, S→Viridian |
| Route2Gate | $31 | GATE | 5×4 | cities1 | ROUTE | Oak's Aide (HM05 for 10 owned), youngster walking left/right |
| Route2TradeHouse | $30 | HOUSE | 4×4 | cities1 | ROUTE | scientist, Game Boy kid (in-game trade) |
| DiglettsCaveRoute2 | $2E | CAVERN | 4×4 | dungeon2 | **CAVE** | fishing guru; warp into DiglettsCave (V4) |
| ViridianForest | $33 | FOREST | 17×24 | dungeon2 | ROUTE | 5 trainers, 2 NPCs, 3 item balls, 2 hidden items, 6 signs; **no connections** |
| ViridianForestSouthGate | $32 | FOREST_GATE | 5×4 | cities1 | ROUTE | girl, little girl walking up/down |
| ViridianForestNorthGate | $2F | FOREST_GATE | 5×4 | cities1 | ROUTE | super nerd, gramps |

- **Palettes:** `SetPal_Overworld` gives an indoor map its `wLastMap`'s palette
  (Route 2 → ROUTE, already `getMapPalette`'s fallback) but forces PAL_CAVE for the
  CAVERN tileset. Only DiglettsCaveRoute2 needs a `MAP_PALETTE` entry.
- **Already in place:** tilesets `forest`/`gate`/`cavern`, their blocksets and
  collision groups; FOREST grass tile `$20`; door and warp tiles; all 11 sprite IDs
  and sheets; the 3 music tracks; `wild/Route2.json` and `wild/ViridianForest.json`;
  trainer pics `bugcatcher` and `lass`; talking across counters (`player.ts:113`).
- **Hidden items** (`data/events/hidden_events.asm`): Forest POTION (1,18),
  ANTIDOTE (16,42). Route 2 has none.
- **Toggleable objects** (`data/maps/toggleable_objects.asm`): the Route 2 and
  Forest item balls start ON. Viridian: OLD_MAN_SLEEPY ON, OLD_MAN OFF, OLD_MAN2 OFF.

## 2. Probe results

### 2.1 Extractor facts

- `MAP_ID_TO_NAME` knows Route2 but not the other six maps; an unknown ID becomes
  `UnknownMap_<n>`.
- ViridianCity's `connectionFilter: ['south', 'west']` drops the Route 2 connection.
  Adding `'north'` emits it with offset 5.
- Route 2's north connection targets PewterCity ($02). While PewterCity stays out of
  `MAP_ID_TO_NAME` (until V2), the extractor drops that connection and Route 2's north
  edge is a wall: border block `$0F` is trees, and none of the tiles the walkability
  check reads are walkable. **Never emit a connection to a map that isn't
  extracted:** a warp to a missing map fails gracefully (`performWarpLoad` catches),
  but `performMapConnection` has no try/catch, so the game would hang in `transition`.
- Every gate and house exit is LAST_MAP ($FF), so `resolveLastMap()` needs 5 new
  parents → Route2. (DiglettsCaveRoute2's script forces `wLastMap = ROUTE_2`, which
  the static table already models.)
- Warp destinations (0-based, measured):
  - Route2 → DiglettsCaveRoute2 0, NorthGate 1, TradeHouse 0, Route2Gate 1, Route2Gate 2, SouthGate 2, Route2Gate 1
  - Route2Gate → Route2 3, 3, 4, 4 · TradeHouse → Route2 2, 2 · DiglettsCaveRoute2 → Route2 0, 0, DiglettsCave 0
  - ViridianForest → NorthGate 2 ×2, SouthGate 1 ×4 · SouthGate → Forest 3 ×2, Route2 5 ×2 · NorthGate → Route2 1 ×2, Forest 0 ×2
- `MAP_TEXT_PTRS` from the sym file (bank:addr, count): Route2 15:54fa (4),
  Route2Gate 17:54e1 (2), Route2TradeHouse 07:57fa (2), DiglettsCaveRoute2 07:57c2 (1),
  ViridianForest 18:5112 (16), ViridianForestSouthGate 17:556a (2),
  ViridianForestNorthGate 17:5494 (2).

### 2.2 What the text fallback would emit (measured)

`readMapText()` follows a `text_far` directly. For a `text_asm` handler it takes the
first `text_far` in the next 80 bytes. Against the real ROM:

| NPC / sign | Handler | Fallback returns | Correct source |
|---|---|---|---|
| Plain NPCs (gate NPCs, trade-house scientist, fishing guru, Forest youngsters 1 and 6) and Route 2's signs | `text_far` | ✓ the right text | — |
| Forest trainers 2–5 and the Lass | `text_asm; ld hl, <header>` | ✗ **all five** get trainer 1's "Hey! You have POKéMON!…" | the trainer header |
| Oak's Aide | `text_asm` → `OaksAideScript` | ✗ his after-the-gift FLASH line | a script (V1b) |
| Game Boy kid | `text_asm` → trade | `''` | inert until trades exist |
| Forest signs (6) | `text_asm` → bankswitch | `''` | `signTextOffsets` |
| Item balls | `PickUpItemText` (home bank) | `''` | inert until A1 |
| Viridian City NPCs (for comparison) | `text_asm` → farcall | ✗ "First, you need to weaken the target POKéMON." for 6 of 8 | why upstream hand-picked offsets there |

Every trainer handler starts `08 21 lo hi` — `text_asm; ld hl, <TrainerHeader>` — so
the extractor can reach each header from the NPC's own TextPointers entry. No
per-trainer offsets are needed. A header is 12 bytes: event-flag bit, `sight << 4`,
flag pointer, then before-battle, after-battle, won and lost text pointers. For map
trainers "won" and "lost" are the same text.

### 2.3 The Forest trainers (measured)

| NPC id | Pos | Faces | Class, party (0-based) | Sight | Before battle | End (won) | After battle |
|---|---|---|---|---|---|---|---|
| youngster2 | 30,33 | left | BUG_CATCHER 0 — Caterpie 7 ×2 | 4 | Hey! You have POKéMON! Come on! Let's battle 'em! | No! CATERPIE can't cut it! | Ssh! You'll scare the bugs away! |
| youngster3 | 30,19 | left | BUG_CATCHER 1 — Metapod, Caterpie, Metapod 6 | 4 | Yo! You can't jam out if you're a POKéMON trainer! | Huh? I ran out of POKéMON! | Darn! I'm going to catch some stronger ones! |
| youngster4 | 2,18 | left | BUG_CATCHER 2 — Caterpie 10 | 1 | Hey, wait up! What's the hurry? | I give! You're good at this! | Sometimes, you can find stuff on the ground! … |
| cooltrainer_f | 2,41 | — | LASS 18 — Nidoran♀ 6, Nidoran♂ 6 | 0 | Hi, do you have a PIKACHU? | Oh no, really? | I looked forever, but I never found a PIKACHU here! |
| youngster5 | 13,17 | right | BUG_CATCHER 14 — Caterpie 8, Metapod 8 (move overrides) | 4 | I'm gonna be the best. You just can't beat me! | After all I did... | A METAPOD is cool because its attack is its defense! |

Object bytes: class = byte − 200 (`OPP_*`), party = byte − 1. They match
`trainers.json` (`BUG_CATCHER` id 2, `LASS` id 3).

### 2.4 Trainer flow: ASM vs upstream

From `home/trainers.asm` and `engine/battle/core.asm`:

| Step | ASM | Upstream today |
|---|---|---|
| Talk, not beaten | before-battle text, then `EngageMapTrainer` → `PlayTrainerMusic`, then the battle. Meet music: female list LASS / JR_TRAINER_F / BEAUTY / COOLTRAINER_F; evil list gambler, rocker, juggler, chief, scientist, Giovanni, Rocket; everyone else male; none for rivals or gym leaders | battle starts immediately: no text, no meet music |
| Victory | "RED defeated BUG CATCHER!" → trainer pic scrolls back in → 40 frames → "BUG CATCHER: " + end text → money. The name prefix is `_TrainerNameText`, which is why every end text starts with a one-word line | "defeated" and money only |
| Beaten flag | set by `EndTrainerBattle`, **only if the battle wasn't lost** | set when the battle *starts*, on both the talk and the sight path; lose, and the trainer still counts as beaten |
| Talk, beaten | after-battle text | invented "I lost to you..." |

### 2.5 The Viridian old man in Yellow

Sources: `scripts/ViridianCity.asm`, `scripts/ViridianCity_2.asm`, `OaksLab.asm:588`,
`ViridianMart.asm` Script2. Three objects are involved: OLD_MAN_SLEEPY (lying at
18,9), OLD_MAN2 (standing at 18,9; `NPC_INDEX_FILTER` drops him today) and OLD_MAN
(walks left/right at 17,5; always hidden upstream).

1. **Before the Pokédex:** standing on (19,9) — from any direction; upstream only
   checks facing up — prints "You can't go through here! This is private property!"
   and walks you one step down. The same routine blocks the Gym door at (32,8) with
   "The GYM's doors are locked..." until you hold the other 7 badges. Upstream has no
   Gym check.
2. **Receiving the Pokédex** (OaksLab) hides the sleeping old man and shows OLD_MAN2.
3. **After that,** on (19,9) with the demo not done yet: OLD_MAN2 faces right, you
   face left, and he says "Ahh, I've had my coffee now … I'll show you how to catch
   POKéMON as my apology." Then comes a **forced** catch demo: `BATTLE_TYPE_OLD_MAN`,
   **RATTATA Lv5**, with `EVENT_INITIAL_CATCH_TRAINING` set. His ball shakes 3 times
   and fails: "Shoot! It was so close too!" He follows with "That didn't work! I must
   be losing my touch. I've run out of POKé BALLs too. I have to get some at POKéMON
   MART." Then he walks 6 steps down and disappears. If you're not at x=19 he first
   steps right, and Pikachu is moved out of the way (`ViridianCityMovePikachu`).
4. **Visiting the Viridian Mart** after that shows OLD_MAN, the walker.
5. **OLD_MAN repeats the demo:** "Hmm? You want me to show you how to catch POKéMON
   again?" YES → "Dandy! Watch what I do closely now!" → the same battle, but **caught**
   this time ("All right! RATTATA was caught!"; he doesn't keep it) → "First, you need
   to weaken the target POKéMON." NO → "Oh... I'm not good enough for you."

**The battle itself.** Sources: `core.asm` DisplayBattleMenu `.doSimulatedMenuInput`,
`home/list_menu.asm`, and `item_effects.asm` ItemUseBall.
- The player name is temporarily "OLD MAN", and the back pic is `OldManPicBack`
  (`gfx/battle/oldmanb.pic`, 3d:4441 — not extracted yet).
- Input is simulated: ▶ FIGHT for 20 frames, ▶ ITEM for 20 frames, then a bag with
  one POKé BALL for 20 frames, then the throw.
- No ball is used up and the Rattata isn't kept. The battle ends either way, because
  `wCapturedMonSpecies` is set to 1 before the throw.
- `LoadEnemyMonData` marks the Rattata **seen**.

`BATTLE_TYPE_PIKACHU` (Oak's catch in the intro) runs through the same code at every
site. Upstream's `pikachu_battle.ts` implements it minus the simulated menu, which
makes it the template.

### 2.6 Pikachu

`engine/pikachu/pikachu_follow.asm` has spawn states for exactly these maps:
- `SetPikachuSpawnOutside`: ROUTE_2_GATE and VIRIDIAN_FOREST_NORTH_GATE get state 3
  when you face down, else 1.
- `SetPikachuSpawnWarpPad`: the NorthGate exit, the SouthGate entrance, and
  VIRIDIAN_FOREST.
- `SetPikachuSpawnBackOutside`: ROUTE_2_GATE.

Upstream uses a 3-case outdoor/indoor model keyed on "the map has connections"
(`map_transitions.ts`). The Forest has no connections, so upstream treats it as
indoor.

## 3. The plan — five slices

Each slice ends with verify, a STATUS update, and a local commit. Between slices the
game stays playable. The demo gate stays until V1e, so until then Route 2 is reached
with the debug warps (backtick).

### V1a — Extract the seven maps (extraction only)

Files: `src/rom/extractors/maps.ts`, `src/rom/rom_offsets.ts`,
`src/rom/extractors/graphics.ts`, `src/rom/extractors/game_text.ts`, their tests,
and the regenerated `data/` + `static/`.

1. `MAP_ID_TO_NAME` += the six new maps, plus `DiglettsCave` ($C5) as a warp target
   only. **Not** PewterCity, which comes with V2.
2. `EXTRACTABLE_MAPS` += 7. `MAP_TEXT_PTRS` += 7 (§2.1). `resolveLastMap` += 5 parents
   → Route2.
3. `MAP_METADATA` += 7 entries, with values straight from the probe:
   - **NPC ids** are pret's `const_export` names minus the map prefix, lowercased
     (`oaks_aide`, `gameboy_kid`, `youngster1`…`youngster6`, `cooltrainer_f`,
     `potion1`, …), which matches the existing style. These ids end up in save keys
     (`Map:npcId`), so fix them now.
   - **Facing and walkDir** from the ROM bytes (STAY LEFT → `direction: 'left'`,
     WALK LEFT_RIGHT → `walkDir: 'left_right'`).
   - **Item balls** get `object: true`.
   - **`signTextOffsets`:** Route 2 28:6d57, 28:6d7c. Forest 26:45fa, 26:4643,
     26:4674, 26:46b6, 26:4703, and **26:45fa again for the leaving sign** — the
     Yellow bug, with a comment citing the ASM.
   - **Forest `hiddenEvents`:** POTION (1,18) and ANTIDOTE (16,42), flags
     `HIDDEN_ITEM_VIRIDIAN_FOREST_POTION` and `…_ANTIDOTE`.
4. ViridianCity: add `'north'` to `connectionFilter`.
5. **Trainer data** — additive `MapNpc` fields:
   - `trainerClass`, `trainerParty`: from object bytes 6–7, with the class name taken
     from the table `extractors/trainers.ts` already uses.
   - `endBattleText`, `afterBattleText`; `dialogue` holds the before-battle text.
   - All texts come from the header reached via `ld hl` (§2.2).

   `NpcData` already declares `trainerClass` and `trainerParty`; V1c adds the two text
   fields. **No `sightRange`:** the existing sight code would go live on it, and that
   is A1's job.
6. Item balls also emit `item` (e.g. `MOON_STONE`) from object byte 6. Nothing reads
   it until A1, which then needs no extractor pass for these maps.
7. A new `NpcMeta` flag for NPCs whose text comes from a script (Oak's Aide, the
   Game Boy kid), so the fallback's wrong text is never emitted.
8. `OLD_MAN_PIC_BACK` = 3d:4441 → `/gfx/battle/oldmanb.png`, next to
   `prof.oakb.png`. That takes the PNG count from 518 to 519; nothing loads it until
   V1d.
9. `game_text.ts` keys for the static texts V1b–V1e will need: the full coffee text,
   "losing my touch", "weaken the target", "show you again", "watch closely", "not
   good enough", "private property", "Gym locked", and the FLASH explanation. Nothing
   reads them yet.
10. Tests:
    - Update "should extract all 12 demo maps" to 19 maps, plus `ALL_MAP_NAMES`.
    - Update the static-export image count from 518 to 519.
    - New ROM tests: the 5 trainers from §2.3, the leaving-sign bug, Viridian's north
      connection, and `oldmanb.png` pixel-identical to pret's
      `gfx/battle/oldmanb.png` (32×32), like the existing Pikachu test.

**Held back for V1e:** adding OLD_MAN2 and deleting `VIRIDIAN_OLDMAN_DEMO`. Either
change would visibly break today's Viridian City on its own, so both land atomically
with the engine change that uses them.

**Verify:**
- Typecheck clean, and the `ROM_PATH` suite green at its new count.
- `npm run setup` run twice gives byte-identical output.
- The 7 JSON files spot-checked against §2.
- The game plays exactly as before. The one visible difference is Route 2's edge now
  drawn north of Viridian, as in vanilla.

### V1b — Route 2 and the Forest, playable (engine)

1. `MAP_MUSIC` (7 entries), `MAP_PALETTE` (DiglettsCaveRoute2 → CAVE), and debug
   warps (7). `OUTDOOR_MAPS` already lists Route2 and ViridianForest.
2. Pikachu spawn states for the gates and the Forest (§2.6). First map what states
   0/1/3/4/6/7 mean, then extend `map_transitions.ts`.
3. Talking to an item ball or the Game Boy kid does nothing, instead of opening an
   empty text box. This lasts until A1 and the trade slice.
4. Oak's Aide, written as a reusable script because four more aides come later:
   `OaksAideScript` via `yesNo` + `getOwnedCount()` + `giveItem`, then `EVENT_GOT_HM05`
   and the FLASH explanation.
   - His texts embed runtime values (`text_decimal`, `text_ram`), which the extractor
     can't decode, so transcribe them with ASM citations, as upstream does for its
     other dynamic texts (§4 Q6).
   - The get-item jingle waits for V5's SFX work.

**Verify:**
- Warp to each map.
- Walk every warp and connection. Route 2 ↔ Viridian works; the Diglett's Cave warp
  does nothing, gracefully, until V4; Route 2's north edge is a wall.
- Music and palette are right on every map.
- Pikachu follows through every gate.
- Every NPC and sign shows its ROM text; the leaving sign shows TRAINER TIPS 1.
- Both hidden items can be found, and the Forest has wild encounters.
- Oak's Aide: the NO answer and the too-few path in play; the enough path by unit
  test.

Until V1c lands, talking to a Forest trainer still uses upstream's flow (§2.4). That's
current behavior, not a regression.

### V1c — Trainer battles per the ASM (engine)

Fix the four departures in §2.4 for trainers you talk to:
- before-battle text → meet music → battle;
- on victory, the pic scrolls back in, 40 frames pass, then "CLASS: end text", then
  money;
- the trainer counts as beaten only after a win;
- the after-battle text replaces "I lost to you...".

Apply the same beaten timing to the sight path so A1 inherits it. `NpcData` gains
`endBattleText` and `afterBattleText`.

**Verify:**
- Every Forest trainer: text → meet music (male; female for the Lass) → battle → end
  text → money. Talking again gives the after-battle text.
- Losing leaves the trainer unbeaten.
- Save → reload keeps defeats.
- The Oak's Lab rival battle still works (see §5).
- Battle unit tests cover the victory sequence.

### V1d — The catch-demo battle (engine)

Turn `pikachu_battle.ts` into one scripted catch demo serving both
`BATTLE_TYPE_OLD_MAN` and `BATTLE_TYPE_PIKACHU` (§2.5). It covers:
- the back pic and the temporary player-name swap;
- the simulated FIGHT → ITEM → POKé BALL input;
- both outcomes, "caught" and "3 shakes, breaks free", each with its texts;
- no ball used, the mon not kept, the enemy marked seen.

It needs `oldmanb.png` from V1a. It also adds the simulated menu to Oak's Pikachu
catch (§4 Q3).

**Verify:**
- Unit tests for both outcomes.
- New game → Oak's Pikachu catch still works, now with the menu.
- The old man demo through a test or a debug hook.

### V1e — The real Viridian old man (replaces the demo gate)

Implement all of §2.5, steps 1–5:
- The three old men's visibility, driven by flags (`COMPLETED_CATCH_TRAINING`,
  `SPAWNED_OLD_MAN_1`, …).
- The (19,9) trigger from any direction.
- The forced demo and the walk-away, including the Pikachu move.
- The Mart spawn, the repeatable demo, and the Gym door (same ASM routine).

The data changes land atomically with this: `oldman2` joins ViridianCity's
`NPC_INDEX_FILTER`, and `VIRIDIAN_OLDMAN_DEMO` and both hardcoded demo strings are
deleted. If §4 Q4 is yes, Route 22's fake Blue goes too.

**Verify = PLAN's V1 gate:**
- New game → Pokédex → walk north in Viridian: the forced demo plays, and Rattata is
  seen in the Pokédex afterwards.
- → Route 2 → Forest → north gate, beating a Bug Catcher on the way.
- Visit the Mart → the walking old man appears → his repeat demo is caught.
- Before the Pokédex, you're pushed back at (19,9) from every side, and at the Gym
  door.

### Order and size

V1a → V1b → V1c → V1d → V1e. V1d can go anywhere before V1e. Roughly 5–6 sessions;
split further (`V1b1`, …) if one doesn't fit a sitting.

## 4. Decisions for the user

1. **The split above** — OK?
2. **Move A1 (item balls + trainer sight) to right after V1?** Recommended. Its verify
   needs only V1, it inherits V1c's trainer flow, and Pewter, Route 3 and Diglett's
   Cave then get built with sight and item balls already working. Otherwise the Forest
   trainers stay talk-only through V5.
3. **V1d reworks Oak's Pikachu catch** into the shared demo, adding the ASM's
   simulated menu to the intro you've already played. Recommended.
4. **Remove Route 22's fake Blue** ("You've reached the end of the demo!") in V1e?
   Recommended: it's invented content. The real Route 22 rival battle stays in I1.
5. **In-game trades** aren't in PLAN.md. Route 2's trade is the first, but it needs a
   Clefairy from Mt. Moon, so it can't be done before B1. Proposed: a new slice
   **A4 In-game trades**.
6. **Texts with runtime values** (Oak's Aide now; later every "PLAYER got X!", the
   trades, the other aides): transcribe them with ASM citations, as upstream already
   does, or first teach the extractor `text_ram` / `text_decimal`? Recommended:
   transcribe for now and log the extractor feature.

## 5. Found on the way — not V1

| Finding | Where | Suggested home |
|---|---|---|
| The Viridian Fisher says "you can have this" but never gives TM42 | `ViridianCityPrintFisherText` | a small slice after V1e |
| STAY/NONE NPCs should turn in place at random: "no movement allowed (however, changing direction is)" (`movement.asm` CanWalkOntoTile). Upstream never turns stationary NPCs | every map | Phase A or V5 |
| No tile animation (water, flowers) anywhere | `tileset_headers.asm` TILEANIM_* | V5 or its own slice |
| The Oak's Lab rival probably never shows his win/lose texts, since upstream has no end-text support. Wire them up with V1c's mechanism | `OaksLab.asm` | V1c follow-up |
| Door SFX: the ASM picks go-inside/go-outside from the tile under the player (`PlayMapChangeSound`); upstream picks by destination map | `main.ts:1644` | V5 SFX |
| Music list typo `'meetevilttrainer'`, hence 46 of 47 tracks; Rockets need it (B1) | `rom/index.ts` | V5 |
| `readMapText` resolves home-bank handlers against the map's bank | `maps.ts:176` | harmless today; note only |
