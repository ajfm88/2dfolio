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

**Last updated:** 2026-11-19 · **Phase:** opening/title (#69), Part 3 · **Milestones done:** 9/36.
**12b2b closed** (`43b56cb6`). **12b2c1 review PASS 2026-11-19 (Nemotron)**: movie audio 1309 updates and clock 6 histories match native oracles; no production caller. Parent 12b2c stays open. O-59 coverage and 07b/08b reviews remain owed.
**12b2c2-1 closed:** Sonnet `d09c218f`, Grok PASS `64afc3ce`; unused `IntroDisplayClock`. ROM7414/7414,
no-ROM7046/368, 290 files; bundle unchanged. **Today ends with context closeout. Tomorrow: fresh-agent
12b2c2-2 planning only.** Parents12b2c2/12b2c remain open; review corrections below are binding dependencies.

---

## ⚠ Read this before planning anything

**The code from the July–August sessions was lost** (found 2026-09-22; DECISIONS
#26). Those sessions worked on a modified copy of the engine — 30 maps, ROM gate
removed, `static/` + PNGs, Psychic fix, 49 SFX — and **no copy of it exists
anywhere**. `game/` is a fresh copy of **vanilla upstream**. What those sessions
*learned* survives in `ARCHITECTURE.md` / `CONVENTIONS.md` / `DECISIONS.md`, so
rebuilding is cheaper than the first time. The rebuild is **Phase V**.

If a context file claims "30 maps", "395 tests" or "the gate was deleted (P5-2)"
without a *lost* marker, it is stale — trust this
file and the code, and fix the stale line. V4 checkpoint-02 wires all 30 extracted maps
at runtime. The rebuilt cave and Route 3 passed the user's play-tests on 2026-11-10.

**Commit policy (user, 2026-09-22):** commit **locally** at the end of every
slice — `git add` + `git commit` from the root, message ending with the
co-author line. **Never push** — there is no remote and there must never be one
(Hard rule #9, DECISIONS #24).

---

## Current phase

**Phase R and Phase V are done** (#139). Opening/title (#69, note 110), Part 3: 12b2b closed by Nemotron
`43b56cb6` (note 126). The user chooses option 1: include audio timing now and use it in the clock (#159).
**12b2c1 closed** (`961e1dec`), and **12b2c2-1 closed** (Grok `64afc3ce`): movie music cost, explicit-profile
clock and dot display-policy helpers remain unused. Approved split: **unit2 planning next session** (native
handler/foreground budgets, SFX194 setup, CPU control/dispatch); unit3 visible setup/loop/skip/exit/scenes0–5/
Boot/main; unit4 expanded combined audit. No unit2 work today. Then13–15; broader O-59/clip timing before15,
PCM crackle afterward, cries, battle audit, A2–A4 and Phase B. Parents12b2c2/12b2c and07b/08b reviews stay open.

## 📍 Where things stand — updated 2026-11-15 (V5 complete, Phase V done)

### Setup — done

| Item | State |
|---|---|
| Git | Root repo, branch `master`, **no remote**. Baseline commit `9bf2d7d` = docs + vanilla upstream. `.gitattributes`: text LF, `*.png`/`*.tilemap`/`*.gbc` binary. `game/.gitattributes` (the user's, tracked since 2026-10-14, DECISIONS #53) repeats those rules for `game/` and adds linguist hints |
| Committed generated files | `game/data/` (219 JSON) + `game/static/` (536 PNG, 6 tilemaps, 219 JSON), 980 generated files total. Checkpoint-10 adds unused `yellow_intro.json`, three intro PNGs and three cloud tilemaps. Each slice's additions are in its note and in `HISTORY.md` (the full row, archived 2026-11-17). Regenerate, never hand-edit |
| Ignored | `*.gbc`/`*.gb` (the ROM), `refs/`, `pkmn-sprites/`, `node_modules/`, `dist/` |
| `game/LICENSE` | **Removed by the user (2026-09-22): "i want it gone".** Deletion committed with R1c. Don't restore it (DECISIONS #28) |
| ROM | `game/pokeyellow.gbc`, SHA1 `cc7d0326…4a38e1` (DECISIONS #14) — re-verified 2026-09-22 |
| `refs/` | All 5 on pinned branches, refreshed **2026-11-17** with `./pull-refs.sh`: `pokeyellow` master `b452f2ab` (unchanged since 2026-11-03; pret's names, R-SYNC note 78), `gen1recomp` dev `53ad85ca` (was `d85a6176`, +39: Android storage, launcher config, CI), `oldamber` main `268d571f` (unchanged), `engine` main `248eaad2` (was `1986dd93`, +6: Zig compatibility, lint), `dmg` main `5e3b785a` (unchanged). No test reads `gen1recomp` or `engine`. `file:line` citations written before note 78 refer to pret `e89ead15` |
| `game/` | `gididaf/pokemon-yellow-typescript` `main` @ `05faa114` (2026-03-27), no `.git/`. Upstream `game/CLAUDE.md` folded into root `CLAUDE.md` → *Engine reference*, then deleted; moved on to `context/ARCHITECTURE.md` and the subsystem docs 2026-10-06 (DECISIONS #42) |
| `npm run setup` | 219 JSON → `data/`; static 536 PNG + 6 tilemaps + 219 JSON mirror (980 generated files). A generated-data checkpoint ships a hash manifest and `check-generated.py` (note 121) |
| Typecheck | Clean |
| Tests | **Opening checkpoint-12b2c2-1 review PASS 2026-11-19 (Grok).** ROM 7414/7414; no-ROM 7046 pass / 368 skip, 290 files (277 passed / 13 skipped), default workers (+344 tests, +1 file over 7070 / 6702 / 289). Bundle `index-DSqCF7ZE.js`, 694,404 bytes, unchanged; SHA256 `8aacb584e3d541c75f291b9f6af1ababd2155fb4e36fa308b0b9e0bbb025e5e1`. `intro_display_clock.ts` SHA256 `4139968e14da66100427fdc2481abf9bd4d9648a2cdbf2e14e4f42cc1fb37c27`. Fresh review census 48/48 assertion kills; independent both-bits clear killed 1. c1 oracles unchanged (1309 updates; 6 histories / 1748 calls / 475 slices). No generated/snapshot/bundle changes |

### What the game has today (upstream audited 2026-09-22, plus every slice since)

| Area | State |
|---|---|
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
| SFX | **41** SFX JSON files; **28** preloaded by the field, with battle sounds loaded by the battle session. The title now plays `intro_crash` and `intro_whoosh`; the star plays `shooting_star` (checkpoint-09, reviewed and user-verified, note 120 §11). Every field request is `Audio1_PlaySound`: the current music's bank picks the file through `SFX_FILES` (V5g1; Audio 3's `save_3`, `turn_on_pc_3`, `enter_pc_3`), the header walk sets priority and two SFX play at once on different channels (V5g2), and the call sites match the cartridge on today's maps: door sound by tile, `SFX_LEDGE`, the Town Map's `SFX_TINK`, text sounds through `TEXT_SOUND_IDS` (V5g3). The battle's sounds and text sounds use the same table. Pikachu's PCM player has its first game caller in the title (clip 1, 46 frozen ticks; clips 1 and 11 preloaded); the battle waits for 15. Not yet: Pokémon cries (their own slice after the opening, #141), the field party's `SFX_SWAP` (J2) |
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
| Evolution, move learning, Pokédex, PC, shops, save | ✅ (see `ARCHITECTURE.md` → *Engine reference* and `game/src/battle/ARCHITECTURE.md`) |
| Save | `localStorage` key `p151-s` — use **`http://127.0.0.1:5173/`** |
| Overworld pace | ✅ **since A6a (2026-09-28): the ASM's 2-frame pass.** Player and Pikachu 16 frames a step (measured 15.99), NPCs 34 (Yellow's fast codes 18, walking in step with the player 16), the mirrored up/down walking frame, the turn rule, the ledge jump table, the joypad read on standing passes, held-key triggers fixed (`overworld/walk_pace.ts`, DECISIONS #36). The user: "he walks at a perfect, gb speed". **Every cutscene, a ledge, NPC/Pikachu pace and START across a step user-verified 2026-10-01** |
| Overworld behavior | ✅ **A6b** the order inside a pass, pop-in, hiding under UI, encounter gates (2026-10-01). ✅ **A6c** NPCs wander and turn by Yellow's movement bytes with pixel sprite collisions, beaten trainers turn, Pikachu idles, glances and does its antics (2026-10-04). ✅ **A6d** the ledge shadow, the landing pass, and Pikachu on Yellow's follow-command buffer (2026-10-04). ✅ **A6e** Pikachu's scripted moves run Yellow's own interpreter — the step-aside, the nurse, Oak's Lab, the emotion preludes (2026-10-05). All user-verified |
| Sim FPS | ✅ **Game Boy rate, 59.7275 Hz** since 2026-09-25 (DECISIONS #33, `core/tick_clock.ts`), holding that rate at any display refresh. `-` / `+` step through multiples of 5 (10–200) with the Game Boy rate as a stop between 55 and 60 |

### Controls (upstream)

| Action | Keys |
|---|---|
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

Milestones and sub-slices, one line each. The full per-slice table (results, commit hashes, test counts) moved
to `HISTORY.md` → *Archived STATUS sections* on 2026-10-16. Plans and reviews are in `notes/`.

| Work | Result |
|---|---|
| **R1** (R1a–c) ✅ | Phase R: the game runs from committed `data/` + `static/`, no ROM, no setup (2026-09-22) |
| **V1** (V1a–e) ✅ | Route 2, Viridian Forest, trainer battles, the catch demo, the real Viridian old men (2026-09-25) |
| **A6** (A6a–e) ✅ | The overworld at Game Boy pace: the 2-frame pass, NPC wandering, Pikachu idle and follow buffer, ledge hops, scripted Pikachu movement (2026-10-05) |
| **A1** (A1a–c) ✅ | Item jingles and the music engine; item balls, hidden items, bag rules; trainer sight (2026-10-06) |
| **A5a** ✅ | The text printer (2026-10-06) |
| **A5b** (A5b1–A5b7) ✅ | Script and menu texts on the cartridge's programs: text data, sprite sets, SFX, the text runner and exact close (A5b1–4); story handlers and the nurse (A5b5); school, Town Map sign, Oak's speech (A5b6); number printing, the Mart, bag/medicine/HP bar, item and Pokécenter PCs, Bill's PC, START and SAVE (A5b7a–f); legacy retirement, hidden events and bookshelves as programs (A5b7g). **A5b7 user-verified complete 2026-10-16**; reviews `notes/40…56` |
| **StatusScreen** ✅ | The stats pages (`StatusScreen`/`StatusScreen2`) for START, Bill's PC and battle, plus the shared `DisplayPartyMenu` opening and corrected medicine timing (F-1/F-2). CP1–CP5 by Sol, reviewed by Claude, **user-verified 2026-10-16**; note 58, DECISIONS #62 |
| **V2** (V2a–c) ✅ | Pewter City: the five maps and the Route 2 connection, the Marts from the ROM (V2a); the museum and gym guides on the cartridge's simulated joypad, the east block (V2b); Jigglypuff's song and the sleeping Pikachu with its readers, emotion 26, the party-menu rules (V2c). **User-verified 2026-10-17**; notes 60–62, DECISIONS #64–#66 |
| **Healing machine** ✅ | The Pokécenter's `AnimateHealingMachine`: the music fade-out engine, NR50 (n+1)/8, `SFX_HEALING_MACHINE`, the balls, OBP1 flashes and jingle wait, then `HealParty` and the map music in the return tick; note 56 N-2's TV test. CP1–CP4 by Sol, reviewed by Claude, **user-verified 2026-10-16**; note 59, DECISIONS #50/#63 |
| **Map-music fade-out** ✅ | `PlayDefaultMusicFadeOutCurrent` for warps, connections, battle returns, the blackout and CONTINUE; the shared PlaySound state; the Pallet/Lab "follow me" theme; the warp waits for the door sound. CP1–CP4 by Codex/Sonnet, checked by Claude, **user-verified 2026-10-18**; note 63, DECISIONS #67/#68 |
| **A5d** ✅ | All 8 battle transitions and the cartridge's 3-bit choice, the dungeon lists, the prologue and OAM clear (the source sprite survives), the flash on BGP only, `PlayBattleMusic`'s one-frame gap, the tail, black held until the battle is ready; every battle start routed through it. CP1 Sonnet, CP2–CP4 Codex, CP5 Codex + Sonnet, each checked by Claude, **user-verified 2026-10-18**; note 65, DECISIONS #70 |
| **A5c1** ✅ | Battle foundations, unused until A5c3: 360 battle text programs extracted (633 → 993) with op-and-address bindings; `BattleScreen` and its pure renderer (32 × 32 BG, the CGB attribute map, 8 OBJ palettes, `SET_PAL_BATTLE`'s 2 held + 3 frames); the HUD writers and `UpdateHPBar` both ways; the low-health alarm on its own pulse-1 voice. CP1 Codex, CP2 Codex + Grok, CP3–CP5 Grok, each checked by Claude (2026-10-19); note 66, DECISIONS #72 |
| **A5c2** ✅ | The battle's menus, unused until A5c3: `DisplayBattleMenu` (normal, Safari, the catch demos' simulated input), the bag on `DisplayListMenuID`, RUN with `SFX_RUN`, the party hand-off (SWITCH/STATS/CANCEL), `MoveSelectionMenu` (all three types, SELECT swap); `TileSurface` shared with the field menus. CP1–CP5 Codex, each checked by Claude (2026-10-19); note 67, DECISIONS #74 |
| **A5c3a** ✅ | The battle's state and plumbing, unused until A5c3f: the text runner's battle features, `BattleState` (one cell per WRAM address, A5c2's contexts as views), the loaders, the stat routines, the math ports and `BattleRandom`, the program host. Checkpoints 01–05, Grok and Codex, each checked by Claude (2026-10-20); note 68 §11.13 |
| **A5c3b** ✅ | The turn, unused: `MainInBattleLoop`, `SelectEnemyMove`, both `ExecuteMove` programs, the status checks, disobedience, the damage, hit and crit routines from the ASM (#77), residual damage. Checkpoints 01–07, Codex and Grok, each checked by Claude (2026-10-20); note 68 §11.34 |
| **A5c3c** ✅ | Every move effect from `effects.asm` and `move_effects/*.asm`, unused: 86 ids through one registry, the bug pins, the 139-row retirement manifest for `effects.test.ts`. Ten checkpoints, Codex and Grok, each checked by Claude (2026-10-22); note 69 §10.20 |
| **A5c3d** ✅ | Faint, EXP, switching and the end, unused: send-out and SHIFT, EXP and level-up, `LearnMove`, both faint handlers, victory and blackout, `EndOfBattle` and the loop driver, whole-battle ledgers and the 26/17 retirement manifests; stat experience in the save (the one live change, no behaviour change, #80). Thirteen checkpoints, Codex, each checked by Claude (2026-10-24); note 70 §9.30 |
| **A5c3e** ✅ | Items in battle and the trainer AI, unused until A5c3f: every battle item body, the 47 trainer-class AI rows, switching. Checkpoints 01–10b, Codex then Grok, each checked by Claude (2026-10-26); note 71, DECISIONS #82 |
| **A5c3f** ✅ | The switch-over: the live game on the new battle engine (09b), the user's play-test (passed 2026-11-01 after 10c–10f), then the old engine retired (11a–11f: RUN on `BattleRandom`, manifests, 7,651 lines deleted, carries, test helpers). Codex, Grok and Codex, each checked by Claude (2026-11-02); note 72, DECISIONS #83–#89 |
| **Timing tests** ✅ | One 30 s suite timeout, no per-test overrides (a guard pins it), the 1 ms render case best-of-10; the re-run-alone rule retired. Codex, checked by Claude (2026-11-02); note 73, DECISIONS #90 |
| **Overworld RNG** ✅ | The cartridge's `Random` outside battle: VBlank's per-frame call, the encounter's two bytes, NPC / Pikachu / gift carries, no `Math.random`. Codex, checked by Claude (+1 pin) (2026-11-02); note 74, DECISIONS #91 |
| **A5e through checkpoint-05** ✅ | 05 poof animation data + `SFX_BALL_POOF`, data only (`eb9bd6e`, Grok; accepted by Claude, note80 §6, #98); 04 live silhouette intro (04a `2bb547d`, 04b `090e05b`; review `d19ca04`; user play-test passed 2026-11-04; note79, #96/#97); 01 source inventory/trace;02 LCD-off staging (`115b59d`, review `6c9a822`);03a default-disabled third scroll band (`67e14ee`, review `7f5ddb4`);03b unused Program/raster contract (`6dc2536`+`3c201d9`, review `8861a58`). Sonnet implemented; Codex independently checked. Notes75–77,35 new cases; **A5e itself remains open** |
| **V3** (01–05) ✅ | Pewter Gym, the Museum, Route 3 and the first badge: the three maps, the ticket, the Old Amber, the hiker and fossil pop-ups, the Gym's guide, statues, Jr. Trainer and Brock, Route 3 and Pewter's east connection (#106), then Brock's reward. Codex and Grok implemented, Claude and Codex reviewed, **user-verified 2026-11-08**; note 88 |
| **V4** (01–04) ✅ | Diglett's Cave and its Route11 entrance, runtime integration, hop-midpoint map scripts and trainer interruption. Grok and Sonnet implemented, Codex reviewed; Route 3 and cave play-tests **user-verified 2026-11-10**; note89 §21 |
| **V5a** ✅ | Type-chart closure: #10's fix withdrawn (#111), the four Psychic-defender rows and Ground vs Fire/Rock pinned through the real loaders and the AI, stale docs corrected. Codex implemented, Claude reviewed (2026-11-11); note 91 |
| **V5b** ✅ | The battle return blocks as the cartridge's: `.battleOccurred`'s 10 white frames, `GBFadeInFromWhite`'s three 8-frame steps, the map song inside `LoadMapData`, `UpdateSprites` at D+34, the first pass and any owning script at D+36. Codex implemented, Claude reviewed, **user-verified 2026-11-11**; note 92 |
| **V5c** (01–06) ✅ | Map-object audit: ROM object order and toggle model, OAK2 and walking Daisy, hidden-event facing, Red's first facing, and three dead text keys removed. All checkpoints reviewed; user play-tests passed 2026-11-13 (note 93 §29). Final baseline ROM 6388/6388; no-ROM 6093 pass / 295 skip, 263 files |
| **V5d** ✅ | Overworld leftovers: `TilePairCollisionsLand` as one table with all eleven rows (no FOREST row fires in Viridian Forest), the cartridge routine's pointer slip pinned against the ROM; the two "!" bubbles were already done in A5b5b. One checkpoint, Sol implemented, Claude reviewed (2026-11-13); nothing visible, no play-test; note 94, DECISIONS #121. ROM 6424/6424; no-ROM 6126 pass / 298 skip, 264 files |
| **V5e** ✅ | Species display names and nicknames: `speciesDisplayName` from `MonsterNames` in the Pokédex, status page 2 and Oak's gift (01); the nickname is the record's name, printed as stored, #86's mappings retired, `RenameEvolvedMon` exact, version-1 saves migrated (02). Sol and Codex implemented, Claude and Grok reviewed, **user-verified 2026-11-14**; note 95, DECISIONS #122, #123. ROM 6473/6473; no-ROM 6175 pass / 298 skip, 265 files |
| **A5f** ✅ | The wild catch and the catch demos: ball animation data, the toss/shake effects, live ball animations, the demos as real battles, the old renderer retired. Checkpoints 01–05, Grok and Codex, each checked by Claude, **user-verified 2026-11-07**; note 87, DECISIONS #105 |
| **Intro animation** ✅ | Oak's speech frame for frame: BGP/OBP0 palette fades (the silhouette, the white fades), the window slide, the tile slides with the BG-thirds tear, the 7-frame pic copies and the shrink wipe, little Red, `SFX_SHRINK`, the intro music's fade-to-stop, the 20-frame entry and 40-frame white exit. CP1–CP5 by Codex, checked by Claude, **user-verified 2026-10-18**; note 64, DECISIONS #51/#69 |
| **V5f** (01, 02, 03a–c) ✅ | The CGB palette command's two held frames outside battle and in the shared party screens: START's returns, field medicine, Bill's PC (01); the bag's `ItemMenuLoop` (02); the full party opening (03a), the battle redraw (03b) and StatusScreen (03c) in every host. Codex and Grok implemented, Grok and Nemotron reviewed, **user-verified 2026-11-15**; notes 96–100, DECISIONS #124–#128. ROM 6526/6526; no-ROM 6228 pass / 298 skip, 266 files |
| **V5g** (g1 01–03, g2, g3 01–04) ✅ | The SFX catch-up: Audio 3's copies and the bank-aware `SFX_FILES` lookup, the battle's text sound on the same table (g1); the field's `Audio1_PlaySound` priority, two SFX at once (g2); the door sound by tile, `SFX_LEDGE`, the Town Map's tinks, the field's text sounds (g3). Codex implemented, Grok reviewed, **user-verified 2026-11-15**; notes 101–109, DECISIONS #129–#139. ROM 6590/6590; no-ROM 6274 pass / 316 skip, 268 files |
| **V5** ✅ | **Milestone complete 2026-11-15** (#139): V5a–V5g. **Phase V is done** |
| **Opening 01–05** ✅ | The opening slice's foundations (#140–#144): the title's and the star's three sounds (01), six images (02), Pikachu's four voice clips as data (03), the PCM player and the frozen-frame hold (04, heard by the user 2026-11-17), the title's build as a frame program on the new opening screen model (05, play-tested 2026-11-17). Codex implemented, Grok reviewed; notes 110–114. 06–11 are closed (notes 115–122). **12a review passed 2026-11-18 (Nemotron)**: counted audio + unused assets; no play-test. **12b1 review passed 2026-11-18 (Nemotron)**: resumable OAM writes; no play-test. **12b2a review passed 2026-11-18 (Nemotron)**: CPU store timing lookahead; no play-test. **12b2b review passed 2026-11-19 (Nemotron)**: instruction-boundary timing; no play-test. **12b2c1 review PASS 2026-11-19 (Nemotron)**: movie audio timing (1309 updates) and clock (6 histories); no play-test. Parent 12b2c stays open |

## In progress

**2026-11-19: session finished after review/context reconciliation; no active implementation.** Unit1 review
PASS `64afc3ce` (Grok), implementation `d09c218f` (Sonnet), review handoff `217eba2a`, split `d8b6a4d4`.
Authoritative report: `notes/129-opening-checkpoint-12b2c2-1-review/report.md`; raw fresh gates/mutations beside it.
Unused clock, 344 new tests; fresh48/48 assertion kills and independent acknowledge-both-IF-bits fault failed1,
all restored. Parents and user play-test remain open; no play-test needed for this unused unit.

**Carry forward these review corrections:**

- Scene0 does not write LCDC=$E3. `YellowIntro_PrepareNextScenePalette` does, after hWY=$90. Hardware rWY is
  latched later, so stale-WY/window plus selected objects reachability is still open for units2/3.
- A natural line143 gap is204−extra dots; a STAT-select write can request one dot before VBlank. No universal
  200-dot separation. `takeInterrupt` samples once; HALT/EI/RETI, dispatch duration and vector re-evaluation
  are unimplemented. Boundary observations do not certify dispatch length; unit2 must model/prove it.
- Four trailing dots applies to the measured single-write LCDC paths, not arbitrary I/O/tile-select glitches.
  STAT's first effect and the probe's second write callback are distinct. Respect the report's precise scope.
- Unsupported window+objects, BG/OBJ disabled, guarded register changes and near-scan DMA remain refused;
  future live callers must prove reachability or extend with native evidence. No fixed profile/remainder shortcut.

**Baseline:** ROM 7414/7414; no-ROM 7046 pass / 368 skip, 290 files; bundle `index-DSqCF7ZE.js`, 694404 bytes,
SHA256 `8aacb584e3d541c75f291b9f6af1ababd2155fb4e36fa308b0b9e0bbb025e5e1`.

**Restart list:**

1. **Tomorrow's fresh agent: plan checkpoint-12b2c2-2 only.** Read this handoff, note129 split §§1/3, unit1
   implementation/review reports and `game/src/menus/ARCHITECTURE.md`; then inspect the reviewed API and relevant
   native ASM. Scope: source-branch VBlank/foreground budgets, live SFX194 setup timing, HALT/EI/RETI and dispatch/
   vector re-evaluation. Respect the corrections above. Unit2 is not started; do not treat the old all-in-one
   note128 prompt or unit1 review prompt as a new implementation instruction.
2. **Pre-edit checks for that session:** `python notes/129-opening-checkpoint-12b2c2-1/verify-unit1.py` without
   `--write`; keep note128's protected/artifact checks and existing fixtures. Old note128 full-base checks refer
   to a pre-unit1 checkout. Preserve review/implementation logs and use new paths for new-unit evidence.
3. **Grok: review 08b** per note119 §8 and **07b** per note117 §8 (separate commits; play-tests passed).
4. **O-59:** direction approved; general audio-domain/clip corrections remain required before checkpoint15.
5. After visible c2: 13–15; PCM crackle (#146), cries (#141), battle audit (#70), A2–A4, B.

**Workflow (V5):** The assigned planner traces, spikes, captures the spike as `notes/NN-.../NN-spike.diff`, restores the source and
briefs exact gates, mutations and stops; the implementer applies, verifies, writes the report section and commits;
The named reviewer reviews (re-runs gates, adds a mutation; a surviving mutation that is a planning gap gets a witness test in
the review commit); visible checkpoints end with the user's play-test. Generated-data checkpoints carry a hash
manifest and checker (note 93 checkpoint-02).

**Tooling notes:** `game/src` files are LF in this checkout (checked 2026-11-18); edit with the Edit tool or byte-exact scripts.
Long bash heredocs containing quotes can break the shell; write scripts to files instead. Pret's symbol file:
`git -C refs/pokeyellow show origin/symbols:pokeyellow.sym` into the scratchpad, from bash. PowerShell `>` logs are
UTF-16 (git shows them as binary; harmless). One 30 s suite timeout; a timeout in a full run is a real failure (#90).

## Next up — queue

Claim the top one, finish it, verify, **commit locally**, log it, stop. Full roadmap in `PLAN.md`.

| # | Slice | Phase | Notes |
|---|---|---|---|
| 1 | **Opening checkpoint-12b2c2-2 planning** (Codex) | — | Reviewed unit-1 API. Handler/foreground budgets, SFX 194, CPU control, dispatch. Do not implement in that session. Units 3-4 and the parent stay open |
| 2 | **Opening checkpoint-08b review** (Grok) | — | Note 119 §8; the user checked it on the dev server (§11). Still owed |
| 3 | **Opening checkpoint-07b review** (Grok) | — | Note 117 §8; the user's play-test already passed (§11). Still owed |
| 4 | **PCM crackle fix** (audio fidelity) | — | #146: right after opening checkpoint 15, before cries |
| 5 | **Battle-mechanics audit — plan** | A | #70, after the opening and cries |
| — | **Attack move animations** (unscheduled) | A | Separate slice (#94), after A5e/A5f; the user places it. A **full pret `move_anim` interpreter** (#94 amended): every attack animation from the cartridge's data/routines. Needs its own plan |

After that: **the opening and title screen** (DECISIONS #69: copyright, Game Freak star, Yellow's intro movie, the title
animation and Pikachu's PCM clips; backlog entry in note 57), then **Pokémon cries** (#141), then **the battle-mechanics audit** (#70), then A2, A3, A4
(in-game trades, plus the player ID and the older-save question, #59), then Phase B.
Before planning any of these, search `notes/57-findings-backlog.md` for the slice id.

### Slice notes (for whoever claims them)

- **Driving the game from browser automation:** synthetic key taps shorter than
  one read are lost, because `input.ts` polls key *state*: once per tick (16.7 ms)
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
- Notes for finished slices (R1, V1's reusable patterns, A6, A1) are in `HISTORY.md` → *Archived STATUS sections (moved
  2026-10-24)*; each slice's own plan in `notes/` has the detail.

## Open questions

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
  X1 starts. (`DECISIONS.md` → *Open*.)

Resolved questions (O-5 … O-29; O-30 … O-38 since; O-42 … O-45 on 2026-11-02) moved to `HISTORY.md` → *Archived STATUS sections* on 2026-10-16; each
outcome is a numbered entry in `DECISIONS.md`.

## Notes for later

Findings that each have a future home moved verbatim to **`notes/57-findings-backlog.md`** on 2026-10-16.
**When you plan a slice, search that file for its id** (`V2`, `V5`, `J2`, `A5c`, `E1`, …). Most
entries point at V5 or J2; a few at A5c–A5f, V3, V4, I1 and E1. New findings go there too.

- Cable club receptionist (`ViridianPokecenter:4`): link features need a user decision; no slice is invented for it.

## Session log

### 2026-11-19 (end-of-day context closeout) — Codex

- User returns Grok PASS `64afc3ce` on Sonnet `d09c218f`; unit1 is closed. Reconciled all seven context files
  and relevant subsystem contracts with reviewed baseline, actual roles/commits, source/dispatch corrections
  and restart steps. No production edits, new tests or repeated full gates; checked saved evidence/hashes.
  Tomorrow starts fresh-agent unit2 planning only. Units2–4, parent12b2c2/12b2c, O-59 and07b/08b remain open.
  No push/remote. User ends today's work here; no unit2 research/planning/implementation was started.
