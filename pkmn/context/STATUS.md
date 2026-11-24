# STATUS — the live handoff log

> **Every agent, every session: read this file FIRST and update it LAST.**
> This is the only file that records what is actually happening. If you skip the
> update, the next agent restarts from zero and the user pays twice for the same
> work. An unlogged session is a lost session.
>
> This file is **state, not knowledge**. Facts go in `ARCHITECTURE.md` /
> `DECISIONS.md` / `CONVENTIONS.md`; status goes here. Older session entries are
> archived in `HISTORY.md`.

**Project:** pkmn — Pokemon Yellow playable in the browser, zero ROM dependency.
**Working dir for all commands:** `game/`

**Last updated:** 2026-11-23 (local) · **Phase:** Pokémon cries closed (note 140 §8.35); next is the battle-mechanics audit (#70), not yet planned · **Milestones done:** 9/36.
**Notes 134-137 and reviews 07b/08b are closed.** The permanent note 137 pacing regression passed all gates.
**Opening timing work parked until the end of the game (DECISIONS #171).** The live opening is unchanged. 12b2c2's reviewed timing code stays
committed and unused. The queue moves to the core game.

---

## ⚠ Read this before planning anything

**The code from the July–August sessions was lost** (found 2026-09-22; DECISIONS
#26). Those sessions worked on a modified copy of the engine — 30 maps, ROM gate
removed, `static/` + PNGs, Psychic fix, 49 SFX — and **no copy of it exists
anywhere**. `game/` is a fresh copy of **vanilla upstream**. What those sessions
_learned_ survives in `ARCHITECTURE.md` / `CONVENTIONS.md` / `DECISIONS.md`, so
rebuilding is cheaper than the first time. The rebuild is **Phase V**.

If a context file claims "30 maps", "395 tests" or "the gate was deleted (P5-2)"
without a _lost_ marker, it is stale — trust this
file and the code, and fix the stale line. V4 checkpoint-02 wires all 30 extracted maps
at runtime. The rebuilt cave and Route 3 passed the user's play-tests on 2026-11-10.

**Commit policy (user, 2026-09-22):** commit **locally** at the end of every
slice — `git add` + `git commit` from the root, message ending with the
co-author line. **Never push** — there is no remote and there must never be one
(Hard rule #9, DECISIONS #24).

---

## Current phase

**Phase R and Phase V are done** (#139). The **Pokémon cries** slice closed on 2026-11-23 (note 140). Next: the **battle-mechanics audit** (#70).
The opening's timing work (12b2c2 remainder, units 3–4) is parked to J2 (#171); the simple opening comes after the
main game (#172, #174).

## 📍 Where things stand — updated 2026-11-15 (V5 complete, Phase V done)

### Setup — done

| Item | State |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Git | Root repo, branch `master`, **no remote**. **Re-initialised 2026-11-23** (the old `.git` was found missing): baseline `16b9ae4` snapshots the tree as of the Boot handoff; every older hash in `context/` and `notes/` refers to the lost history. `.gitattributes`: text LF, `*.png`/`*.tilemap`/`*.gbc` binary. `game/.gitattributes` (the user's, tracked since 2026-10-14, DECISIONS #53) repeats those rules for `game/` and adds linguist hints |
| Committed generated files | `game/data/` (262 JSON) + `game/static/` (536 PNG, 6 tilemaps, 262 JSON), 1066 generated files total. Checkpoint-10 adds unused `yellow_intro.json`, three intro PNGs and three cloud tilemaps. Each slice's additions are in its note and in `HISTORY.md` (the full row, archived 2026-11-17). Regenerate, never hand-edit |
| Ignored | `*.gbc`/`*.gb` (the ROM), `refs/`, `pkmn-sprites/`, `node_modules/`, `dist/` |
| `game/LICENSE` | **Removed by the user (2026-09-22): "i want it gone".** Deletion committed with R1c. Don't restore it (DECISIONS #28) |
| ROM | `game/pokeyellow.gbc`, SHA1 `cc7d0326…4a38e1` (DECISIONS #14) — re-verified 2026-09-22 |
| `refs/` | All 5 on pinned branches, refreshed **2026-11-17** with `./pull-refs.sh`: `pokeyellow` master `b452f2ab` (unchanged since 2026-11-03; pret's names, R-SYNC note 78), `gen1recomp` dev `53ad85ca` (was `d85a6176`, +39: Android storage, launcher config, CI), `oldamber` main `268d571f` (unchanged), `engine` main `248eaad2` (was `1986dd93`, +6: Zig compatibility, lint), `dmg` main `5e3b785a` (unchanged). No test reads `gen1recomp` or `engine`. `file:line` citations written before note 78 refer to pret `e89ead15` |
| `game/` | `gididaf/pokemon-yellow-typescript` `main` @ `05faa114` (2026-03-27), no `.git/`. Upstream `game/CLAUDE.md` folded into root `CLAUDE.md` → _Engine reference_, then deleted; moved on to `context/ARCHITECTURE.md` and the subsystem docs 2026-10-06 (DECISIONS #42) |
| `npm run setup` | 262 JSON → `data/`; static 536 PNG + 6 tilemaps + 262 JSON mirror (1066 generated files). Clip 17 landed with cries checkpoint-04, clips 28/35/40 with checkpoint-05. A generated-data checkpoint ships a hash manifest and `check-generated.py` (note 121) |
| Typecheck | Clean |
| Tests | **Cries checkpoint-05 (2026-11-23).** ROM 7,929/7,929 and no-ROM 7,544 pass / 385 skip across 304 files (290 passed / 14 skipped without ROM). Build `index-Bh1w6Q55.js`, 708,471 bytes. Was ROM 7,911/7,911 and no-ROM 7,535 pass / 376 skip, 304 files. |

### What the game has today (upstream audited 2026-09-22, plus every slice since)

| Area | State |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime data path | ✅ **No ROM** (R1b): the browser loads only `static/` via plain `fetch()` / `<img>`. Upstream's upload gate is deleted; the bundle has no gate code |
| Vite | `publicDir: 'static'`, `base: '/'`, `appType: 'mpa'` (missing file = real 404). Tab title **PKMN** |
| Background tabs | ✅ keeps running unfocused — logic + music (worker ticker, DECISIONS #27). User-verified |
| Maps | **12 playable**: PalletTown, RedsHouse1F/2F, BluesHouse, OaksLab, Route1, Route22, ViridianCity, ViridianPokecenter, ViridianMart, ViridianSchoolHouse, ViridianNicknameHouse. **+7 playable through the debug warps since V1b:** Route2, Route2Gate, Route2TradeHouse, DiglettsCaveRoute2, ViridianForest, ViridianForestSouthGate/NorthGate, with music, palette and Pikachu. **Since V1e the walking path is open:** Viridian → Route 2 → the Forest, once the old man's demo is done. **+5 since V2a:** PewterCity, PewterPokecenter, PewterMart, PewterNidoranHouse, PewterSpeechHouse, reached from Route 2's north edge. **+3 since V3 checkpoint-01:** Museum1F, Museum2F, PewterGym (27 maps). Museum and Gym doors now reachable; the Museum ticket (checkpoint-02a) is closed; the Old Amber and the 2F hiker (checkpoint-02b) are closed; fossil pop-ups (checkpoint-02c) are closed; Brock's talk and battle (checkpoint-03b) are closed. Checkpoint-05 awards the Boulder Badge and TM34 (closed). **+1 since V3 checkpoint-04:** Route3 (28 maps), reached by the debug warp at (4,9). Pewter's east connection to Route3 is open once Brock is beaten; before that the guide still blocks the walk. Route4 stays unextracted and unnamed, so Route3's north edge is the native tree border. **V4 checkpoint-02 wires DiglettsCave and DiglettsCaveRoute11 (30 runtime-wired maps).** Dungeon2 music, CAVE palette, ladders, the gambler program, CAVERN land pairs and the failed Route11 exits are in. User-verified 2026-11-10 (note89 ?21). Route11 outdoors is not extracted. |
| Warps | ✅ since V1b: the player keeps their facing through warps, as in the ASM; Pikachu appears where Yellow's spawn states put it (`pikachu/pikachu_spawn.ts`) |
| Demo gates | ✅ **Gone since V1e**: the invented Viridian text and Route 22's fake Blue. A test fails if "demo" appears anywhere in `data/game_text.json` or `data/maps/*.json` |
| Viridian old men | ✅ **since V1e, as `scripts/ViridianCity.asm` runs them** (`story/viridian_city.ts`): the sleeping man's push-back; the forced demo after the Pokédex (fails, walk-away, Pikachu steps aside); the Mart spawning the walking old man and his repeatable demo (caught); the locked Gym door (hop down the ledge). The city's `wViridianCityCurScript` is saved (`mapScripts`), which keeps the Gym-door quirk (DECISIONS #34). User-verified |
| Route 22 | no NPCs (the rivals are I1). Its gate door leads to the unextracted `Route22Gate` and fails gracefully |
| Wild data | 57 `wild/*.json` |
| Music | **46** tracks extract; A5c3e checkpoint-02 removes the invalid `pokefluteinbattle` music entry (the real streams are unused SFX data) |
| SFX | **79** SFX JSON files (38 are cry00–cry25); **28** preloaded by the field, with battle sounds loaded by the battle session. The title now plays `intro_crash` and `intro_whoosh`; the star plays `shooting_star` (checkpoint-09, reviewed and user-verified, note 120 §11). Every field request is `Audio1_PlaySound`: the current music's bank picks the file through `SFX_FILES` (V5g1; Audio 3's `save_3`, `turn_on_pc_3`, `enter_pc_3`), the header walk sets priority and two SFX play at once on different channels (V5g2), and the call sites match the cartridge on today's maps: door sound by tile, `SFX_LEDGE`, the Town Map's `SFX_TINK`, text sounds through `TEXT_SOUND_IDS` (V5g3). The battle's sounds and text sounds use the same table. The title preloads clips 1 and 11. Startup preloads clips 4, 11, 17, 28, 35, 37 and 40 (battle, status screen, Bill's PC). Pokémon cries play with their waits in battle (checkpoint-03), in Oak's speech, the Nidoran/Spearow houses, the Pokécenter Chansey, the status screen (starter: clip 17) and the Pokédex data page and side-menu CRY (checkpoint-04); all reviewed and user-verified (note 140 §8.15–§8.16, §8.25–§8.26). Bill's PC plays regular cries for deposit, withdraw and release, with their waits, and the starter's clips 28/35/40 (checkpoint-05, reviewed PASS, note 140 §8.34). Still not in: the field party's `SFX_SWAP` (J2) |
| Type chart | ✅ **The old PSYCHIC string-key bug is absent.** The live engine compares byte 24 on both sides; Bug 2×, Fighting ½×, Psychic ½× and Ghost 0× are pinned through wild, trainer and party loaders plus the AI by `battle_type_chart_live.test.ts` (V5a checkpoint-01). The ROM chart stays unmodified; #10's fix is withdrawn (#111). |
| Hidden items | ✅ **A1b, user-verified; A5b4 timing reviewed and user-verified:** DisplayTextID opens, found program begins at T+20 before give, flag on success, longer jingle and full map close; cartridge full-bag waits. Forest Potion/Antidote and Viridian City Potion |
| Item balls | ✅ **A1b, user-verified; A5b4 timing reviewed and user-verified:** extracted `item` selects `PickUpItem`; box opens at T, give/hide T+20, found program T+23, `get_item1`, full map close after sound and A's release. Saved `hiddenObjects` keeps balls gone and tiles free. Full-bag failure keeps the ball. Route 1's sample preserves the flag-first quirk. Trade kid (A4) and Oak's Aide (A2) still await their handlers |
| Trainers | ✅ **since V1c, as `home/trainers.asm` runs them**: before-battle text → meet music (male / female / evil) → battle; on a win the fanfare after the last Pokémon, "defeated", the pic scrolling back in, "CLASS: " + end text, money; beaten only after a win (saved); after-battle text when talked to again. Oak's Lab rival: his texts, no blackout on a loss, `rivalStarter` saved. Since A5d every entry runs the shared transitions (user-verified 2026-10-18) |
| Trainer sight | ✅ **A1c, user-verified 2026-10-06** (`notes/20-a1c-plan.md`, DECISIONS #43): the Forest's map script runs `TrainerEngage` on standing passes ($fc quirk, pop-in), the meet music at spotting, EmotionBubble (61 frames), the `MoveSprite` walk-up, `wJoyIgnore`/`BIT_SEEN_BY_TRAINER`, `EndTrainerBattle`'s pass. Forest sight ranges 4, 4, 1, 0, 4. V4 checkpoint-04's midpoint trainer interruption passed review after repair (note89 §19); the busy-trainer guard and outdoor-sight tripwire are retired. |
| Catch demo | ✅ **since V1d**: Oak's Pikachu catch runs the ASM's simulated FIGHT → ITEM → POKé BALL input, with both outcomes (caught, or 3 shakes and "Shoot! It was so close too!"). Since V1e the Viridian old man uses it too |
| Whiteout | ✅ `handleBlackoutWarp` — halves money, heals, warps to last Pokécenter |
| Badge stat boosts | ✅ `battle_loaders.ts` `applyBadgeStatBoosts` (the cartridge's, on the battle copy). Brock awards the first (V3); the repeated-application bug is pinned |
| Battles | ✅ **The new engine since A5c3f 09b** (notes66–72): byte-backed turn/effects/items/AI/end; old engine deleted.10c already wired growth, starter Pikachu entrance, retreat and slide-offs. Remaining presentation: poof/OAM after the live silhouette intro (live since 04b; user play-test passed 2026-11-04), substitute/minimize/transform and other named cues; move animations stay OFF (#83; their own later slice, #94); catch screens/demo retirement stay A5f. Last user battle play-test2026-11-01; 04a changes nothing visible |
| Random numbers | ✅ **The cartridge's `Random` / `BattleRandom` everywhere** (note 74): one page-lifetime owner of `hRandomAdd` / `hRandomSub`, VBlank's per-frame call outside battle, each site's carry. No production `Math.random` (a census pins it). Battle frames skip the VBlank call (backlogged) |
| TM/HM teaching | ❌ → A2 |
| Poison walking, Repel, Escape Rope | ❌ (items exist in the price table only) → A3 |
| Text and menus | ✅ **A5a/A5b**: every overworld text, sign, hidden event, bookshelf, story scene and menu text runs the cartridge's text programs with its timing (printer, DisplayTextID open/close, PrintText); the Mart, bag, field medicine, HP bar, item/Pokécenter/Bill's PCs, START and SAVE are the cartridge's. Battle text runs on the cartridge's programs too, since A5c3f. The StatusScreen port (stats pages, shared party opening, corrected medicine timing) is user-verified |
| Evolution, move learning, Pokédex, PC, shops, save | ✅ (see `ARCHITECTURE.md` → _Engine reference_ and `game/src/battle/ARCHITECTURE.md`) |
| Save | `localStorage` key `p151-s` — use **`http://127.0.0.1:5173/`** |
| Overworld pace | ✅ **since A6a (2026-09-28): the ASM's 2-frame pass.** Player and Pikachu 16 frames a step (measured 15.99), NPCs 34 (Yellow's fast codes 18, walking in step with the player 16), the mirrored up/down walking frame, the turn rule, the ledge jump table, the joypad read on standing passes, held-key triggers fixed (`overworld/walk_pace.ts`, DECISIONS #36). The user: "he walks at a perfect, gb speed". **Every cutscene, a ledge, NPC/Pikachu pace and START across a step user-verified 2026-10-01** |
| Overworld behavior | ✅ **A6b** the order inside a pass, pop-in, hiding under UI, encounter gates (2026-10-01). ✅ **A6c** NPCs wander and turn by Yellow's movement bytes with pixel sprite collisions, beaten trainers turn, Pikachu idles, glances and does its antics (2026-10-04). ✅ **A6d** the ledge shadow, the landing pass, and Pikachu on Yellow's follow-command buffer (2026-10-04). ✅ **A6e** Pikachu's scripted moves run Yellow's own interpreter — the step-aside, the nurse, Oak's Lab, the emotion preludes (2026-10-05). All user-verified |
| Sim FPS | ✅ **Game Boy rate, 59.7275 Hz** since 2026-09-25 (DECISIONS #33, `core/tick_clock.ts`), holding that rate at any display refresh. `-` / `+` step through multiples of 5 (10–200) with the Game Boy rate as a stop between 55 and 60 |

### Controls (upstream)

| Action | Keys |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-pad | Arrows or WASD |
| A / B | X / Z (swapped from upstream's Z / X at the user's request, DECISIONS #71) |
| Start / Select | Enter / Shift |
| Unlock audio | Click once on "Click to start" |
| Pause | `p` |
| Debug overlay + warps | Backtick (warps: Pallet, Viridian, Route 1, Route 22, Lab, houses, Pokécenter, Mart; since V1b also Route 2 south and north, the Forest, both Forest gates, Route 2 Gate, the trade house, the Diglett's Cave entrance, and since V4 checkpoint-02 the cave itself and the Route 11 entrance). Its **Skip Intro** button sets the intro flags and adds a Lv5 Pikachu, which is enough to test Pikachu following |
| Sim FPS | `-` / `+` (the Game Boy rate is the stop between 55 and 60) |

### Scope freezes (user)

- **1:1 vanilla Yellow.** No rebalancing, no improvements, no added content. Gen 1
  bugs reproduced deliberately.
- **Sprites are vanilla Yellow from ROM extraction** for the whole build.
  `pkmn-sprites/` stays untouched.
- **Randomizer = year-two idea** (X1, dead last, DECISIONS #21–#23). Don't start it,
  don't design around it.
- **Local only, never pushed** (DECISIONS #24). Saves on `127.0.0.1`.
- **Timeline: 1–2 years, ~700–800 sessions.** Milestones, not sittings. A session
  that delivers one small verified thing is a good session.

---

## Completed

Milestones R1, V1–V5, A1, A5 and A6 are done (9/36; CLAUDE.md, PROJECT.md *State*). The one-line-per-slice table moved
to `HISTORY.md` → *Archived STATUS sections (moved 2026-11-23)* to keep this file under 40 KB; the full per-slice
table (results, commits, counts) is further down in HISTORY. Plans and reviews are in `notes/`.

## In progress

**Nothing in progress.** The Pokémon cries slice (note 140, #174) closed on 2026-11-23: five checkpoints, each
reviewed PASS and play-tested by the user (§8.35). The next slice, the battle-mechanics audit (#70, queue row 0),
has no plan yet. Its first step is a planning pass:
- inventory every battle routine (ported from the ASM in A5c3, or still upstream's body);
- attach the backlog entries routed to #70 (note 57: damage flooring per type row, set-damage moves and Counter,
  the AI modification gates, glitch move ids, `GetMonName`, stat text past EVADE, stats past 255);
- include VBlank's per-frame `Random` in battle, which re-records the battle ledgers;
- split the work into checkpoints with a size estimate for the user.
- **Baseline at `e4e7821`:** ROM 7,929/7,929; no-ROM 7,544 pass / 385 skip, 304 files; bundle
  `index-Bh1w6Q55.js`, 708,471 bytes.
- **Untracked on purpose:** the root `*.py` files and `pkmn-save.txt` (the user's). `*.sav` is gitignored
  (`da83ab1`).
- After the play-test, the cries slice is closed and the queue moves to row 1.

The opening's timing work is parked until after the main game (DECISIONS #171). Its handoff (notes 134–139, the
preview page, timing limits) moved to `HISTORY.md` → *Archived STATUS sections (moved 2026-11-23)*.

## Next up — queue

Claim one planned checkpoint at a time. The roadmap is in `PLAN.md`.

| # | Work | Scope |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 0 | **Battle-mechanics audit (#70)** | Plan it first (see *In progress*): inventory, backlog entries, VBlank `Random`, checkpoints and size. |
| 1 | **B1 Mt. Moon, A2** | Then Mt. Moon and gym rewards/TMs. PLAN wants A4 (trades) before B1; settle that with A3 when planning B1. |
| — | **After the main game** | Simple opening (#172, #174). Live boot still uses the default path. |
| — | **Parked to J2** | PCM crackle fix (#173); opening 12b2c2 timing remainder (#171). |

Before planning a slice, search `notes/57-findings-backlog.md` for its ID.

### Slice notes (for whoever claims them)

- **Driving the game from browser automation:** synthetic key taps shorter than
  one read are lost, because `input.ts` polls key _state_: once per tick (16.7 ms)
  in menus and text, and since A6a once per standing pass (33.5 ms) in the overworld. Hold each key ~100 ms (keydown → wait → keyup via
  `window.dispatchEvent`, `e.key` names: `x` = A, `z` = B (since DECISIONS #71; harnesses in `notes/` before 2026-10-18's swap used `z` = A), `Enter` = Start, arrows).
  Walking one step = ~160 ms held. More from V1b:
  - Start a temporary server with `npx vite --host 127.0.0.1 --port <spare>
--strictPort`. Plain `npx vite` binds `localhost`, which is IPv6 `::1` here, so
    `127.0.0.1` URLs time out.
  - The splash needs a real click, then about a second before the title shows.
  - Debug overlay: backtick, then Skip Intro (Pikachu), then the warp dropdown + Warp.
  - The debug panel shows `Map … step x,y … dir:`, which is handy to read back with
    JS.
  - The first step after any warp skips the warp check (`justWarped`). A debug warp
    next to a door needs one step away and back.
  - A text box with `cont` lines needs one A press per scroll.
  - From V1c: a `javascript_exec` call times out after **45 s**, so keep each walk or
    button loop short. A stray A press that opens a text box makes every walk loop
    stall. The tab can turn `hidden`: rAF stops, and the debug panel stops
    rebuilding until the tab is visible again.
  - To stage a story state, edit the save in `localStorage` (`p151-s`: `mapName`,
    `playerX/Y` in px = step × 16, `eventFlags`, `party`) and CONTINUE. That's how
    V1c reached the lab rival. Use a spare port (V1c used 5179), so test saves never
    touch the user's 5173 origin, and clear them afterwards.
  - Music changes show up as `performance.getEntriesByType('resource')` entries
    under `/audio/music/`, one per track per page load.
  - From V2a CP4: arrow keys are `ArrowUp`/`ArrowDown`/…; text boxes close with **B** (A re-talks); after `NEW GAME` →
    "Skip intro? YES" the party is **empty** (the debug panel may still show a stale lead — type a species + `+ Add`); the panel
    lags about a second; the game only advances while a script runs in the page; don't press `-`/`=`; don't poll `getImageData`
    every frame. Details: `notes/60-v2-plan.md` §16.
- **Browser automation:** the game's A button is **X** and B is **Z** (DECISIONS #71, 2026-10-18; before that it was
  the other way round). Say so when handing over for a play-test.
- Notes for finished slices (R1, V1's reusable patterns, A6, A1) are in `HISTORY.md` → _Archived STATUS sections (moved
  2026-10-24)_; each slice's own plan in `notes/` has the detail.

## Open questions

- **O-60 ✅ answered 2026-11-22 → DECISIONS #169:** split 2c3 into 2c3a (the movie's own streams) and 2c3b (the
  whole timed foreground). Sol implements.
- **O-59 direction answered 2026-11-19 → #159; implementation incomplete.** The user chooses the audio
  timing model together with clock composition now. Note 127's c1 is the first verified domain: the movie song,
  1309 updates plus idle/branch witnesses. General title/menu/battle/SFX/drum/pitch-slide coverage and corrections
  to clip holds remain before checkpoint-15. The old measurements remain relevant: clip 1 sometimes needs 47
  rather than 46 frames (6.3% of title positions), clip 11 sometimes 37 rather than 36 (0.03%); battle clip 4's
  2735-cycle limit is tighter. Current fixed 46/36 holds are unchanged by this unused component. Do not ask the
  user to choose the direction again or mark all of O-59 complete from movie-only coverage.
- **O-58 ✅ answered 2026-11-16 → DECISIONS #141:** the title first; "Click to start" stays; the clear-save dialogue and the battle's three clips are in this slice; cries get their own slice right after it; one JSON file per clip; Codex implements, Grok reviews.
- **O-54, O-55, O-56 ✅ answered 2026-11-11 → DECISIONS #110, #111, #112:** V5's seven sub-slices in note 90's order; #10's PSYCHIC post-processing withdrawn; the `DisableLCD` audit, the party list on tiles and the tileset trim leave V5.
- **O-57 ✅ answered 2026-11-11:** Codex implements V5a checkpoint-01 ("let me have codex implement"); Claude reviews.
- **O-53 ✅ answered 2026-11-07 → DECISIONS #106:** A. Route 3's map and Pewter's east connection become V3 checkpoint-04, before Brock's win (05).
- **O-52 ✅ answered 2026-11-06 → DECISIONS #104:** the screen-model merge runs next, before A5f.
- **O-51 ✅ answered 2026-11-04 → DECISIONS #97:** yes. The LCD-off span and the first frame after `EnableLCD` are white (Pan Docs, SameBoy's measured logic); the intro gets two dark ticks (note 79 §8.1).
- **O-50 ✅ answered 2026-11-04 → DECISIONS #94:** attack move animations get their own separate slice, not A5e.
- **O-49 ✅ answered 2026-11-02 → DECISIONS #91:** yes. The overworld RNG slice ran before A5e (note 74).
- **O-48 ✅ answered 2026-10-30 → DECISIONS #86:** option A. After a battle, an un-nicknamed mon's name goes back as
  upstream's `species.name`; 09's write-back implements it.
- **O-47 ✅ answered 2026-10-30 → DECISIONS #85:** the battle's species names come from the cartridge's `MonsterNames`, in
  checkpoint-08g before 09 (Claude briefs it next session).
- **O-46 ✅ answered 2026-11-02 → DECISIONS #90:** yes. A small separate slice for the load-sensitive timing tests runs
  after A5c3f, before A5e. It landed as note 73, and §11.16's re-run-alone rule is retired.
- **O-2: Crystal animated GIFs in the randomizer pool?** Not blocking; decide when
  X1 starts. (`DECISIONS.md` → _Open_.)

Resolved questions (O-5 … O-29; O-30 … O-38 since; O-42 … O-45 on 2026-11-02) moved to `HISTORY.md` → _Archived STATUS sections_ on 2026-10-16; each
outcome is a numbered entry in `DECISIONS.md`.

## Notes for later

Findings that each have a future home moved verbatim to **`notes/57-findings-backlog.md`** on 2026-10-16.
**When you plan a slice, search that file for its id** (`V2`, `V5`, `J2`, `A5c`, `E1`, …). Most
entries point at V5 or J2; a few at A5c–A5f, V3, V4, I1 and E1. New findings go there too.

- Cable club receptionist (`ViridianPokecenter:4`): link features need a user decision; no slice is invented for it.

## Session log

### 2026-11-23 - Claude: Pokémon cries closed (note 140 §8.35)

- The user play-tested checkpoint-05 in Bill's PC and reported that it all works. The cries slice is closed after
  five checkpoints. §8.34's stale-row finding was fixed in `e4e7821`.
- The queue moves to the battle-mechanics audit (#70). Its planning pass comes first.

### 2026-11-23 - Grok: cries checkpoint-05 review (note 140 §8.34)

- PASS. Deposit, withdraw and release match the ASM order, including the silent YES and the starter's clip 40 refusal. The five Bill's PC starter sites compare species, OT id 0 and five name bytes. Clips 28/35/40 are in the boot preload. Six spot mutations each failed a test and were restored.
- Gates match §8.33: typecheck passed; `index-Bh1w6Q55.js`, 708,471 bytes; no-ROM 7,544 passed / 385 skipped; ROM 7,929/7,929. Both suites covered 304 files.
- The setup rows and the SFX row still say 259 JSON and that clips 28/35/40 remain open. Next is the user's play-test.

### 2026-11-23 - Codex: cries checkpoint-05 starter PCM complete (note 140 §8.33)

- Extracted clips 28/35/40 to `data/` and `static/` (259 to 262 JSON in each), preloaded them with
  clip 17 and wired Bill's PC deposit, withdraw and release through the shared cue. Frozen frames:
  94/94/78. No stored snapshot moved. Review is §8.34; then user play-test.
- Typecheck and build passed (`index-Bh1w6Q55.js`, 708,471 bytes). No ROM: 7,544 passed,
  385 skipped; ROM: 7,929/7,929. Both suites covered 304 files.

### 2026-11-23 - Codex: Bill's PC regular cries and starter ownership (note 140 §8.32)

- Wired the three ordinary cries and their waits, removed the stub, and applied the full starter check at the
  Bill's PC branches. Two traded-Pikachu cases exercise the real audio engine and preserve happiness.
- Typecheck and build passed (`index-RPQ4pVo7.js`, 708,310 bytes). No ROM: 7,538 passed, 376 skipped.
  ROM: 7,914/7,914. Both suites covered 304 files.
- Starter PCM extraction and playback remain open. No generated data or snapshots changed.

### 2026-11-23 - Claude: checked `82ebd9f`; ruled on the Bill's PC starter check (note 140 §8.31)

- `82ebd9f` lands tests and docs only. Playback, clip extraction and stub removal are still open. No review until
  they're in.
- §8.28's starter-predicate finding is a real bug: Bill's PC uses species-only checks. The five Bill's PC sites
  get the full species + OT id + OT name check. Other callers are backlogged for the Pikachu audit.

### 2026-11-23 - Codex: cries checkpoint-05 release ruling and independent checks (note 140 §8.29–§8.30)

- Recorded Claude's ruling verbatim, restored the three Pokédex assertions, and added a Bill's PC test for
  silent YES and the existing sound-completion check. Updated the cries architecture, test list and backlog.
- Typecheck and build passed (`index-C6Qzfxzr.js`, 707,847 bytes). No ROM: 7,536 passed, 376 skipped.
  ROM: 7,912/7,912. Both runs covered 304 files.
- Next is §8.31 review of these changes. Bill's PC playback and clip extraction remain open.

### 2026-11-23 - Codex: paused cries checkpoint-05 on the Bill's PC release sound (note 140 §8.28)

- The generic PC leaves menu-button silence set through Release → YES. The post-removal wait checks the current
  sound before the cry. §8.28 records the ASM trace, the species-only starter stand-ins, and clip timing.
- Typecheck, build and both suites confirmed the baseline. Bill's PC implementation and setup remain pending.
  Next is review of the trace in §8.29.

### 2026-11-23 - Claude: cries checkpoint-04 closed; checkpoint-05 briefed; context handoff (note 140 §8.26–§8.27)

- Grok's review of checkpoint-04 (`bc2cd27`) is PASS (§8.25). The user play-tested it and reported no problems.
- §8.26: the starter checks use OT id 0 until A4 adds the player ID (added to the backlog's A4 line); three
  Pokédex assertions go back in with checkpoint-05.
- §8.27 briefs checkpoint-05. It corrects §2.5: releasing the starter plays clip 40, so the checkpoint adds
  clips 28, 35 and 40.
- STATUS moved its pre-11-23 session log and the parked opening handoff to `HISTORY.md` (113 KB → under 40 KB).
- CLAUDE.md's test baseline is now `6c1d414`'s.

- 2026-11-23 — Grok reviewed cries checkpoint-04. PASS. Note 140 §8.25. Gates match §8.24. Six spot mutations each failed a test and were restored. The field starter test compares the OT id with 0. Next is the §8.17 play-test. Checkpoint-05 stays unstarted.

- 2026-11-23 — Codex implemented cries checkpoint-04. Oak, the four map mons, status and the Pokédex use the shared cry path; starter status uses clip 17, which freezes 42 frames. Both suites pass. Note 140 §8.24 records timing and gates. Checkpoint-04 awaits review (§8.25).

- 2026-11-23 — Codex paused cries checkpoint-04 before implementation. The first status-screen poll uses the last foreground sample as its edge baseline, so B pressed during setup and held through playback can turn the page. Note 140 §8.22 records the clip sample and edge trace.

- 2026-11-23 — Codex paused cries checkpoint-04 before implementation. The status screen can accept a button first pressed during the cry and still held at the first poll. Note 140 §8.20 records the ASM trace for review.

### 2026-11-23 - Claude: ruled on cries §8.22 (note 140 §8.23)

- §8.22 is right: the status screen's edge baseline is the last foreground joypad read, which can come before the whole setup, and the text runner's `cry` op still needs §8.17 ruling 2's wait. Both are fixes to the brief's wording; the rule (no joypad read until the first page-1 poll) is unchanged. Implementers now stop only for behaviour the brief got wrong. Checkpoint-04 may resume; implementation §8.24, review §8.25.

### 2026-11-23 - Claude: ruled on cries §8.20 (note 140 §8.21)

- §8.20 is right: a button pressed during the status screen's cry and still held at the first poll turns the page; a tap released during the cry is lost. §8.17 ruling 4 is amended. Checkpoint-04 may resume; implementation §8.22, review §8.23.

### 2026-11-23 - Claude: ruled on cries §8.18 (note 140 §8.19)

- §8.18 is right: the Pokédex side menu's five items sit on rows 8, 10, 12, 14 and 16, and the cursor clamps at DATA and QUIT with no wrap. §8.17 ruling 6 and its tests are amended. Checkpoint-04 may resume; implementation §8.20, review §8.21.

- 2026-11-23 — Codex paused cries checkpoint-04 before implementation. The Pokédex side-menu labels and cursor use tile rows 8, 10, 12, 14 and 16, and the cursor stops at either end. Note 140 §8.18 records the ASM trace for review.

### 2026-11-23 - Claude: cries checkpoint-03 closed; checkpoint-04 briefed (note 140 §8.16–§8.17)

- The user play-tested checkpoint-03 on the dev server: all four battle sites PASS (§8.16).
- Checkpoint-04's brief (§8.17) covers the field sites: the text `cry` op, Nidoran/Spearow/Chansey, the status screen with clip 17, the Pokédex data page, and the side menu on the ASM's five rows. PRNT does nothing until J2, as in the VC build. Battle-hosted screens use the session's voice port.
- `*.sav` was added to `.gitignore` (`da83ab1`); `game/pokeyellow.sav` is an emulator save from tracing.

- 2026-11-23 — Grok reviewed cries checkpoint-03 (`254f12e`). PASS. Note 140 §8.15. Four gates match: typecheck passed; build `index-Cp3Lg0Ba.js` 705,829 bytes; no-ROM 7,525 passed / 373 skipped, 304 files; ROM 7,898/7,898. Six spot mutations each failed a test and were restored. Next is the user's battle play-test. Checkpoint-04 stays unstarted.

- 2026-11-23 — Codex implemented cries checkpoint-03. The battle waits at all four voice sites, with one in-call PCM ID clear before the resumed VBlank. All four gates passed, with ROM 7,898/7,898 and no-ROM 7,525 passed / 373 skipped across 304 files. Checkpoint-03 awaits review (note 140 §8.14).

### 2026-11-23 - Claude: ruled on cries §8.12 (note 140 §8.13)

- The implementer's stop was right: one ID clear, inside `startPikachuClip`, before the extra yield. Amended §8.11
  ruling 3 and its test. Docs only.

- 2026-11-23 — Codex paused cries checkpoint-03 before implementation. The PCM facade already clears the battle ids through the shared SFX engine. A second clear after the pending VBlank would erase a possible alarm write. The trace in note 140 §8.12 awaits review.

### 2026-11-23 - Claude: cries checkpoint-02 closed; checkpoint-03 briefed (note 140 §8.10–§8.11)

- The user's listening test passed. Checkpoint-03 (the four battle sites, the starter's clips 4/11/37, the alarm
  restored after the wait) is briefed in §8.11. Docs only.

- 2026-11-23 — Grok reviewed cries checkpoint-02 (`62deec3`). PASS. Note 140 §8.9. Four gates match: typecheck passed; build `index-Cy5imu0j.js` 705,731 bytes; no-ROM 7,517 passed / 373 skipped, 304 files; ROM 7,890/7,890. Six spot mutations each failed `cries.test.ts` and were restored. CryData compiled into the bundle is recorded for the user. Next is the listening test. Checkpoint-03 stays unstarted.

- 2026-11-23 — Codex implemented cries checkpoint-02. The console wait follows the last of CHAN5, 6 and 8. All four gates passed, with ROM 7,890/7,890 and no-ROM 7,517 passed / 373 skipped across 304 files. Checkpoint-02 awaits review (note 140 §8.8).

### 2026-11-23 - Claude: ruled on cries §8.6 (note 140 §8.7)

- The implementer's stop was right; the plan was wrong about the cry's length. Corrected §2.3 and checkpoint-02's
  tests; checkpoint-02 resumes and records as §8.8. Docs only.

- 2026-11-23 — Codex traced checkpoint-02 and paused before implementation. Kangaskhan's CHAN8 return follows CHAN5 by seven updates, which extends `WaitForSoundToFinish`. Note 140 §8.6 records the wait, noise pitch and bank traces for review.

- 2026-11-23 — Grok re-reviewed the cries checkpoint-01 test repair (`7a70d9b`). PASS. Note 140 §8.5. The game change is the bank-comparison test. Four gates match. Dropping one expected index, plus §8.4's three mutations, each failed that assertion for bank $08 and the test file was restored. Checkpoint-02 is next.

- 2026-11-23 — Codex repaired the cries checkpoint-01 bank comparison. All three mutations failed at the exact byte-index assertion and were restored. Note 140 §8.4 records verification. Re-review is next.

- 2026-11-23: Codex reviewed cries checkpoint-01; note 140 ?8.2 records FAIL because a widened bank-comparison mask survived the requested mutation. All four gates passed; implementation was not changed.

### 2026-11-23 - Grok: cries checkpoint-01, the data (note 140)

- Extracted `cries.json` (190 rows) and `audio/sfx/cry00.json`–`cry25.json` from bank $02. Nothing plays them.
- Banks $08, $1f and $20 match. Only cry0d channel 5's `sound_loop` address differs. Six channels fall through into the next label's `sound_ret`.
- ROM 7,882/7,882. No-ROM 7,509 pass / 373 skip, 303 files. Bundle unchanged. Data JSON 219 → 258 in `data/` and in `static/`.
- Commit `a66dd93`. Stopped for review. Next is Nemotron or Luna on note 140 §6, then checkpoint-02. Do not start it here.

### 2026-11-23 - Claude: the user answered note 140 §7 (#174)

- Yes to the bar, Pikachu's clips and the Pokédex CRY item. Cries go first; the simple opening waits for the main game.
- Dropped the old-commit comparisons from `battle_end_data` and `battle_item_data`. Typecheck clean; ROM 7,877/7,877,
  no-ROM 7,509/368. Next: Grok implements cries checkpoint-01; Nemotron or Luna reviews (user changed roles).

### 2026-11-23 - Claude: fresh git baseline; Pokémon cries planned (note 140)

- The root `.git` was missing. `git init` + baseline `16b9ae4` from the current tree (8,924 files; ROM, `refs/`,
  `pkmn-sprites/`, `dist/` excluded; the three root `*.py` scratch scripts and `pkmn-save.txt` left untracked). The
  working copy had 2,219 CRLF files; rewritten to LF from the index. The lost notes' references were removed at the user's request.
- Gates on the baseline: typecheck clean; ROM 7,875/7,877. Two tests `git show` lost commits (see *Setup → Tests*).
- Planned cries in `notes/140-pokemon-cries-plan.md`: data, engine + `PlayCry`, battle, field, Bill's PC. Sol
  starts checkpoint-01 once the user answers §7 (bar/size, Pikachu clips, Pokédex CRY item, order vs simple opening).

