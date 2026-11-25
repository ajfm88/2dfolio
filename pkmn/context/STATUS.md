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

**Last updated:** 2026-11-24 (local) · **Phase:** A2, checkpoint-01 reviewed; checkpoint-02 next · **Milestones done:** 9/36.
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

**Phase R and Phase V are done** (#139). The **Pokémon cries** slice closed on 2026-11-23 (note 140). The **battle-mechanics audit** closed through checkpoint-11 on 2026-11-24; its evidence is `notes/141-battle-mechanics-audit-plan.md`. **A2 is active:** checkpoint-01's machine data is reviewed (note 142); checkpoint-02 is next.
The opening's timing work (12b2c2 remainder, units 3–4) is parked to J2 (#171); the simple opening comes after the
main game (#172, #174).

## 📍 Where things stand — updated 2026-11-15 (V5 complete, Phase V done)

### Setup — done

| Item | State |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Git | Root repo, branch `master`, **no remote**. **Re-initialised 2026-11-23** (the old `.git` was found missing): baseline `16b9ae4` snapshots the tree as of the Boot handoff; every older hash in `context/` and `notes/` refers to the lost history. `.gitattributes`: text LF, `*.png`/`*.tilemap`/`*.gbc` binary. `game/.gitattributes` (the user's, tracked since 2026-10-14, DECISIONS #53) repeats those rules for `game/` and adds linguist hints |
| Committed generated files | `game/data/` (263 JSON) + `game/static/` (536 PNG, 6 tilemaps, 263 JSON), 1068 generated files total. A2 checkpoint-01 adds `machine_data.json` and its mirror; note 142 verifies all 1,066 prior generated files unchanged. Regenerate, never hand-edit |
| Ignored | `*.gbc`/`*.gb` (the ROM), `refs/`, `pkmn-sprites/`, `node_modules/`, `dist/` |
| `game/LICENSE` | **Removed by the user (2026-09-22): "i want it gone".** Deletion committed with R1c. Don't restore it (DECISIONS #28) |
| ROM | `game/pokeyellow.gbc`, SHA1 `cc7d0326…4a38e1` (DECISIONS #14) — re-verified 2026-09-22 |
| `refs/` | All 5 on pinned branches, refreshed **2026-11-17** with `./pull-refs.sh`: `pokeyellow` master `b452f2ab` (unchanged since 2026-11-03; pret's names, R-SYNC note 78), `gen1recomp` dev `53ad85ca` (was `d85a6176`, +39: Android storage, launcher config, CI), `oldamber` main `268d571f` (unchanged), `engine` main `248eaad2` (was `1986dd93`, +6: Zig compatibility, lint), `dmg` main `5e3b785a` (unchanged). No test reads `gen1recomp` or `engine`. `file:line` citations written before note 78 refer to pret `e89ead15` |
| `game/` | `gididaf/pokemon-yellow-typescript` `main` @ `05faa114` (2026-03-27), no `.git/`. Upstream `game/CLAUDE.md` folded into root `CLAUDE.md` → _Engine reference_, then deleted; moved on to `context/ARCHITECTURE.md` and the subsystem docs 2026-10-06 (DECISIONS #42) |
| `npm run setup` | 263 JSON → `data/`; static 536 PNG + 6 tilemaps + 263 JSON mirror (1068 generated files). Clip 17 landed with cries checkpoint-04, clips 28/35/40 with checkpoint-05. A generated-data checkpoint ships a hash manifest and `check-generated.py` (notes 121, 142) |
| Typecheck | Clean |
| Tests | **A2 checkpoint-01 (2026-11-24).** ROM 7,959/7,959; no-ROM 7,573 pass / 386 skip across 308 files. Typecheck clean. Both suites passed with `--maxWorkers=2`. No production source changed; the last measured bundle remains the cries baseline `index-Bh1w6Q55.js`, 708,471 bytes. |

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
Battle audit checkpoint-10b closed 2026-11-24: the 10a RNG stream's affected ledgers were re-recorded,
the nine-failure census reconciled, both full suites passed and Luna independently reviewed the changes (note 141).
Battle audit checkpoint-11 closed 2026-11-24: the move/effect census and note 57 reconciliation found no ordinary path to the two glitch tails. Terra added one loaded-record regression; Luna independently reviewed it and passed. The bounded audit is complete; unreachable glitches stay at J2 (note 141, DECISIONS #176).
A2 checkpoint-01 closed 2026-11-24 (`6e8780d`): the machine move and price tables are extracted into committed JSON with a static mirror; Terra's implementation and Luna's post-completion review passed. A2 remains open (note 142).

## In progress

**A2 in progress:** checkpoint-01 is reviewed and closed. The machine tables
are committed data and unused by runtime code. Next is a separate checkpoint-02
brief for machine item names, prices and HM behavior across bag/Mart/PC. A2,
A3, A4 and B1 remain separate milestones (note 142, DECISIONS #177).

**Battle-mechanics audit (#70) complete.** Plan, routine inventory and bounded evidence:
`notes/141-battle-mechanics-audit-plan.md` (DECISIONS #176). Checkpoints 01–09 are reviewed:
checkpoint-01 damage/hit/Counter (`17651c7`), checkpoint-02 turn/status/residual (`08b014d`),
checkpoint-03 effect dispatch/status family (`3a2d4ae`), checkpoint-04 stat effect
handlers (`e39878f`), checkpoint-05 turn effect handlers (`2734993`), checkpoint-06
HP/copy handlers (`8f8461a`), checkpoint-07 stat arithmetic/names/loaders
(`238272a`), checkpoint-08 trainer AI (`2be1c48`), checkpoint-09a items/catch
(`36b2efe`), and checkpoint-09b faint/EXP/end (`5baa462`). Their checked paths matched the ASM;
each added cross-module regression coverage and no production behavior changed.
**Checkpoint-10 is closed.** Checkpoint-10a (`1d27f50`) added battle VBlank
`Random` with a single frame owner, attached HRAM transfer and shared modeled
carry. Checkpoint-10b reconciled the nine deterministic suite failures from
that stream; Luna independently reviewed its ledger and test changes and passed
them. Note 141 records the ASM checks, carry approximation, session-frame order
limit, census and ledger comparison. Checkpoint-11's source-derived move census
and Luna's independent review close the audit; unreachable glitch behavior
remains parked at J2 under #176.
- **Full green baseline after 11:** ROM 7,957/7,957; no-ROM 7,572 pass / 385 skip,
  307 files; both full suites used `--maxWorkers=2`. Production code and bundle are unchanged
  since the cries baseline `index-Bh1w6Q55.js`, 708,471 bytes; build was not rerun here.
- **Untracked on purpose:** the root `*.py` files and `pkmn-save.txt` (the user's). `*.sav` is gitignored
  (`da83ab1`).

The opening's timing work is parked until after the main game (DECISIONS #171). Its handoff (notes 134–139, the
preview page, timing limits) moved to `HISTORY.md` → *Archived STATUS sections (moved 2026-11-23)*.

## Next up — queue

Claim one planned checkpoint at a time. The roadmap is in `PLAN.md`.

| # | Work | Scope |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 0 | **A2 checkpoint-02** | Brief machine item names, prices and HM behavior across bag/Mart/PC against the ASM (note 142). |
| 1 | **A2 remainder** | Compatibility, teaching and Oak's Aide; brief each checkpoint before implementation. Then A3 → A4 → B1 (#177). |
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

### 2026-11-24 - Codex/Terra/Luna: A2 checkpoint-01 reviewed

- Codex resolved the order A2 → A3 → A4 → B1 (#177) and briefed one data-only checkpoint in note 142. Terra extracted the 55 TM/HM move IDs and 50 packed TM prices into `machine_data.json` and its mirror (`6e8780d`). A manifest checker verified two new generated files and all 1,066 prior files unchanged, including after repeat setup. No runtime item or teaching code changed.
- Terra formally finished before Luna began. Luna checked the source and owned ROM, independently challenged the table boundary and nybble order, and passed the review. Typecheck, focused ROM 12/12 and both full suites passed: ROM 7,959/7,959; no-ROM 7,573 pass / 386 skip across 308 files, two workers. Next: brief A2 checkpoint-02. The user's `context/PLAN.md` edit and root files remain untouched.

### 2026-11-24 - Codex/Terra/Luna: battle-mechanics audit checkpoint-11 reviewed

- Codex briefed the closure in note 141; Terra reconciled note 57 and added a live loaded-record census. The 165 shipped moves have no `$48-$4B` effect; ordinary selection has no proven path to move ID 0 or 166+. The two glitch tails stay at J2 under #176. No production or generated data changed. Luna challenged the Mirror Move zero-ID path, independently checked the census and reviewed PASS.
- Typecheck and focused tests passed. Full ROM 7,957/7,957; no-ROM 7,572 pass / 385 skip across 307 files, both with `--maxWorkers=2`. Next: plan the A2/A3/A4/B1 sequence. The pre-existing `context/PLAN.md` edit and user's root files remain untouched.
- At the user's direction, Luna reviewed committed checkpoint `23814b1` again after Terra formally finished. She passed the source/diff review and independently reran typecheck and both full suites at the same counts (note 141, post-completion review).

### 2026-11-24 - Sol/Terra/Luna: battle-mechanics audit checkpoint-10b reviewed

- Sol wrote the implementation brief in note 141. Terra ran a nine-failure no-ROM census, re-recorded Route 1's per-frame RNG snapshot and repaired six affected test files without changing production code. The new ledger leaves frame hashes, text, audio and outcome unchanged; aside from RNG bytes, one damage byte changes at frame 472. Luna independently checked the ASM, snapshot and diff, reran 170/170 affected tests, and passed the review.
- Typecheck and focused tests passed. Full ROM 7,956/7,956; no-ROM 7,571 pass / 385 skip across 307 files, both with `--maxWorkers=2`. Next: checkpoint-11 closure and glitch triage. The pre-existing `context/PLAN.md` edit and user's root files remain untouched.

### 2026-11-24 - Sol/Terra/Luna: battle-mechanics audit checkpoint-10a reviewed

- Sol scoped 10a frame/RNG ownership and 10b ledger/full-suite closure. Terra wired attached battle VBlank `Random` through the page-lifetime owner (`1d27f50`) and added focused timing/carry tests. Luna caught a constant-carry host callback; Terra corrected it and Luna re-reviewed PASS. Source and focused evidence are in note 141.
- Typecheck, host/RNG 31/31 and session variants 16/16 passed. Existing `battle_session.test.ts` has two known failures (Route 1 wild-win snapshot; Misty X Defend item count) from the changed RNG stream. Full suites were intentionally deferred to 10b. Last green counts remain checkpoint-09b's 7,952 ROM / 7,567 pass + 385 skip no-ROM, 306 files. Next agent: run a full failure census, update each affected RNG ledger from the new source-derived stream, review, run both full suites and replace the baseline. Preserve the pre-existing `context/PLAN.md` edit and user-owned untracked root files.

### 2026-11-24 - Sol/Terra/Luna: battle-mechanics audit checkpoint-09 reviewed

- Sol split the broad row into 09a items/catch and 09b faint/EXP/end. Terra checked each against pret and added a trainer ball item-flow witness (`36b2efe`) and a trainer knockout → EXP.ALL → end witness (`5baa462`). Luna independently reviewed both and passed them. No production discrepancy was proved on the checked paths; note 141 records the coverage and limits.
- Typecheck and focused tests passed. Full ROM 7,952/7,952; no-ROM 7,567 pass / 385 skip across 306 files, both with two workers. Next: checkpoint-10 battle VBlank `Random` and ledger re-recording. The pre-existing `context/PLAN.md` edit and user-owned untracked root files remain untouched.

### 2026-11-24 - Sol/Terra/Luna: battle-mechanics audit checkpoint-08 reviewed

- Sol briefed trainer AI; Terra checked move scoring and class actions against pret and added a Lorelei selection-to-item witness (`2be1c48`). Luna independently reviewed and passed it. No production discrepancy was proved; note 141 records the checked paths, retired backlog claim and limits.
- Typecheck and focused tests passed. Full ROM 7,950/7,950; no-ROM 7,565 pass / 385 skip across 306 files, both with two workers. Next: checkpoint-09 items, catch, faint, EXP and end; split its broad scope before implementation if needed. The pre-existing `context/PLAN.md` edit and user-owned untracked root files remain untouched.

### 2026-11-24 - Sol/Terra/Luna: battle-mechanics audit checkpoint-07 reviewed

- Sol briefed stat arithmetic, names and loaders; Terra audited them against pret and added a trained Rhydon >255 Attack witness (`238272a`). Luna independently reviewed and passed it. No production discrepancy was proved; note 141 records the checked paths, stale backlog claims and limits.
- Typecheck and focused tests passed. Full ROM 7,949/7,949; no-ROM 7,564 pass / 385 skip across 306 files, both with two workers. Next: checkpoint-08 trainer AI. The pre-existing `context/PLAN.md` edit and user-owned untracked root files remain untouched.

### 2026-11-24 - Sol/Terra/Luna: battle-mechanics audit checkpoint-06 reviewed

- Sol briefed all nine HP/copy effect handlers; Terra checked them against pret and added a two-sided Disable dispatch-to-status witness (`8f8461a`). Luna independently reviewed and passed it after the exact RNG draw assertion was added. No production discrepancy was proved; note 141 records the checked paths and limits.
- Typecheck and focused tests passed. Full ROM 7,948/7,948; no-ROM 7,563 pass / 385 skip across 305 files, both with two workers. Next: checkpoint-07 stat arithmetic, names and loaders. The pre-existing `context/PLAN.md` edit and user-owned untracked root files remain untouched.

### 2026-11-24 - Sol/Terra/Luna: battle-mechanics audit checkpoint-05 reviewed

- Sol briefed all eleven turn effect handlers; Terra checked them against pret and added a two-sided Bide initializer-to-release witness (`2734993`). Luna independently reviewed and passed it. No production discrepancy was proved; note 141 records the checked paths and limits.
- Typecheck and focused tests passed. Full ROM 7,946/7,946; no-ROM 7,561 pass / 385 skip across 305 files, both with two workers. Next: checkpoint-06 HP and copy effects. The user-owned untracked root files remain untouched.

### 2026-11-24 - Sol/Terra/Luna: battle-mechanics audit checkpoint-04 reviewed

- Sol briefed stat effects; Terra compared the live handlers with pret and added a both-side Haze execution witness (`e39878f`). Luna independently reviewed and passed it after a pointer-table wording correction. No production discrepancy was proved; note 141 records the checked paths and limits.
- Typecheck and focused tests passed. Full ROM 7,944/7,944; no-ROM 7,559 pass / 385 skip, 304 files, both with two workers. Next: checkpoint-05 turn effect handlers. The user-owned untracked root files remain untouched.

### 2026-11-24 - Codex: battle-mechanics audit checkpoints 01-03 reviewed; handoff updated

- Sol implemented checkpoint-01 damage/hit/Counter immunity witnesses (`17651c7`), checkpoint-02 the live sleep/Leech Seed/enemy/poison turn (`08b014d`), and checkpoint-03 live Leech Seed dispatcher/status gates (`3a2d4ae`). Separate agents independently reviewed each and passed. No production code changed.
- Note 141 is the routine inventory, scope and next checkpoints. Next: checkpoint-04 stat effect handlers. Battle VBlank `Random` and ledger re-recording remain checkpoint-10. The unreachable glitch tails remain a checkpoint-11/J2 triage.
- Typecheck passed. Full ROM suite 7,942/7,942; no-ROM 7,557 pass / 385 skip across 304 files, both with two workers. The test-only audit did not rebuild the cries bundle. The user requested the context update after checkpoint-03.
