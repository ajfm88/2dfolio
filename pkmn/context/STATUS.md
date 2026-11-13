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

**Last updated:** 2026-11-11 · **Phase:** V (Rebuild the lost work), with Phase A slices in between · **Milestones done:** 8 / 36 (R1 ✅, V1 ✅, A6 ✅, A1 ✅, V2 ✅, A5 ✅, V3 ✅, V4 ✅); **V5a and V5b done; V5c checkpoints 01–02 accepted, 03 (the toggle model) next**

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

**Phase R is done** (2026-09-22). **Phase V** rebuilds the lost 30-map state (V1 ✅ → V2 ✅ → V3 Gym + Museum → V4
Diglett's Cave + Route 3 → V5 fixes), with Phase A slices in between (DECISIONS #29, #35, #55). **A5 closed** 2026-11-07 (note 87 §27). **V3 closed** 2026-11-08 (note 88 §48). **V4 closed** 2026-11-10 (note89 §21), after all four code reviews and the user's Route 3 and cave play-tests. V5's recovered fixes are next. Earlier detail is in `HISTORY.md`.

## 📍 Where things stand — updated 2026-11-06 (A5f checkpoint-03; refs pulled 2026-11-03 evening, see the `refs/` row)

### Setup — done

| Item | State |
|---|---|
| Git | Root repo, branch `master`, **no remote**. Baseline commit `9bf2d7d` = docs + vanilla upstream. `.gitattributes`: text LF, `*.png`/`*.tilemap`/`*.gbc` binary. `game/.gitattributes` (the user's, tracked since 2026-10-14, DECISIONS #53) repeats those rules for `game/` and adds linguist hints |
| Committed generated files | `game/data/` (207 JSON) + `game/static/` (527 PNG, 3 tilemaps, 207 JSON), 944 generated files total. V5c checkpoint-01 adds unused `toggleable_objects.json` and its mirror; all 942 existing generated files unchanged. V4 checkpoint-01 adds `maps/DiglettsCave.json` and `maps/DiglettsCaveRoute11.json` (each mirrored) and regenerates text_programs, map_sprite_sets and battle_transitions. V3 checkpoint-04 adds `maps/Route3.json` (mirrored). Regenerate, never hand-edit |
| Ignored | `*.gbc`/`*.gb` (the ROM), `refs/`, `pkmn-sprites/`, `node_modules/`, `dist/` |
| `game/LICENSE` | **Removed by the user (2026-09-22): "i want it gone".** Deletion committed with R1c. Don't restore it (DECISIONS #28) |
| ROM | `game/pokeyellow.gbc`, SHA1 `cc7d0326…4a38e1` (DECISIONS #14) — re-verified 2026-09-22 |
| `refs/` | All 5 on pinned branches, refreshed **2026-11-03** with `./pull-refs.sh`: `pokeyellow` master `b452f2ab` (was `e89ead15`, +45: pret named every remaining symbol; ROM unchanged; **R-SYNC complete: 63-name mapping applied; historical readers adapted per note78 section6.1**), `gen1recomp` dev `d85a6176` (was `20ab97ab`, +480), `oldamber` main `268d571` (unchanged), `engine` main `1986dd93` (was `79957401`, +21: Gen 1 `calc.zig`/`chance.zig` and build), `dmg` main `5e3b785` (unchanged). `file:line` citations written before note 78 refer to `e89ead15` |
| `game/` | `gididaf/pokemon-yellow-typescript` `main` @ `05faa114` (2026-03-27), no `.git/`. Upstream `game/CLAUDE.md` folded into root `CLAUDE.md` → *Engine reference*, then deleted; moved on to `context/ARCHITECTURE.md` and the subsystem docs 2026-10-06 (DECISIONS #42) |
| `npm run setup` | 206 JSON → `data/`; static 527 PNG + 3 tilemaps + 206 JSON mirror. V4 checkpoint-03 (2026-11-09): setup twice, all 942 generated files unchanged from checkpoint-02. |
| Typecheck | Clean |
| Tests | **V5c checkpoint-02 accepted after review, 2026-11-11 (note93 §11).** ROM 6337/6337; no-ROM 6042 pass / 295 skip, 257 files (244 passed / 13 skipped), default workers. Bundle `index-_kTTYOPq.js`, 671,475 bytes; SHA256 `0ea1c5b61830081f334e014628b7988cf669c7debe3449f5dae78a7c117333da`. 944 generated files |

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
| SFX | **21** preloaded, including A5c2 CP2's RUN (bank `$08`, header `$41c5`, ID `$97`; no playback caller yet), the nurse's `healing_machine` and intro animation's preloaded `shrink`. Wired: `press_ab`, `collision`, `start_menu`, `go_inside`/`go_outside`, the two field-medicine sounds, the machine, and shrink. A5c3f checkpoint-02 adds four unused files (`damage`, `not_very_effective`, `super_effective`, `trainer_appeared`); checkpoint-05 adds unused `ball_poof` (Audio 2, `$93`). A5f checkpoint-01 adds unused `ball_toss` (Audio 2, `$91`) and `tink` (Audio 2, `$8C`). 34 SFX JSON files, 13 unused. Other SFX and bank-aware lookup → V5 |
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
| **A5f** ✅ | The wild catch and the catch demos: ball animation data, the toss/shake effects, live ball animations, the demos as real battles, the old renderer retired. Checkpoints 01–05, Grok and Codex, each checked by Claude, **user-verified 2026-11-07**; note 87, DECISIONS #105 |
| **Intro animation** ✅ | Oak's speech frame for frame: BGP/OBP0 palette fades (the silhouette, the white fades), the window slide, the tile slides with the BG-thirds tear, the 7-frame pic copies and the shrink wipe, little Red, `SFX_SHRINK`, the intro music's fade-to-stop, the 20-frame entry and 40-frame white exit. CP1–CP5 by Codex, checked by Claude, **user-verified 2026-10-18**; note 64, DECISIONS #51/#69 |

## In progress

**End-of-day handoff, 2026-11-11 (Claude).** V5 is under way (DECISIONS #110: V5a → V5g). **V5a and V5b are done**
(notes 91, 92; V5b user-verified). **V5c is in progress**: checkpoints 01 and 02 are accepted (note 93 §8, §11);
**checkpoint-03 is next and not yet traced or briefed.** The user stopped for the day; nothing is mid-flight and
the tree is clean.

**Restart list:**
1. **Trace, spike and brief V5c checkpoint-03, the toggle model** (note 93 §3–§4; DECISIONS #115). Scope:
   `wToggleableObjectFlags` (256 bits, in the save); `InitializeToggleableObjectsFlags` at New Game (OFF rows set);
   at map load, each NPC hidden by its toggle bit via `objectId` + `toggleable_objects.json`'s `mapFirst`;
   `hideObject` / `showObject` set and reset the bit (keep the `(map, npcId)` call shape if the trace allows) and end
   in `UpdateSprites`; old saves migrated from `hiddenObjects` (`Map:npcId`) and from the story flags behind
   `story_state.ts`'s rules; retire the rules in `story_state.ts` that are really toggles (17 `npc.hidden` lines;
   the non-toggle ones stay). **No visible change** in 03. Expect to split it: 03a model + save + migration, 03b
   callers and `story_state.ts`. Write the trace and brief as note 93 §12 onward, spike first, capture the diff, restore.
2. The user names the implementer for each checkpoint (Codex has run V5a–V5c 02). Give a paste-ready prompt:
   read CLAUDE.md first, the note section, the gates, "never push".
3. After 03: 04 objects in ROM order with ROM-derived facing/walk range, OAK2 / walking Daisy / Route 22 rivals
   present and hidden (visible; play-test); 05 walking Daisy's script; 06 Red's first facing, the hidden-event
   facing filter, the three dead text keys. Then V5d → V5e → V5f → V5g.

**Workflow (V5):** Claude traces, spikes, captures the spike as `notes/NN-.../NN-spike.diff`, restores the source and
briefs exact gates, mutations and stops; the implementer applies, verifies, writes the report section and commits;
Claude reviews (re-runs gates, adds a mutation; a surviving mutation that is a planning gap gets a witness test in
the review commit); visible checkpoints end with the user's play-test. Generated-data checkpoints carry a hash
manifest and checker (note 93 checkpoint-02).

**Tooling notes:** many `game/src` files are CRLF on disk; edit with line-ending-aware scripts or the Edit tool.
Long bash heredocs containing quotes can break the shell; write scripts to files instead. Pret's symbol file:
`git -C refs/pokeyellow show origin/symbols:pokeyellow.sym` into the scratchpad, from bash. PowerShell `>` logs are
UTF-16 (git shows them as binary; harmless). One 30 s suite timeout; a timeout in a full run is a real failure (#90).

## Next up — queue

Claim the top one, finish it, verify, **commit locally**, log it, stop. Full roadmap in `PLAN.md`.

| # | Slice | Phase | Notes |
|---|---|---|---|
| 1 | **V5c** checkpoint-03, the toggle model | V | To trace, spike and brief (note 93 §4); may split into model+save and callers. Then 04 ROM order and facing, 05 walking Daisy, 06 the small items. Then V5d → V5e → V5f → V5g (#110) |
| — | **Attack move animations** (unscheduled) | A | Separate slice (#94), after A5e/A5f; the user places it. A **full pret `move_anim` interpreter** (#94 amended): every attack animation from the cartridge's data/routines. Needs its own plan |

After that: **the opening and title screen** (DECISIONS #69: copyright, Game Freak star, Yellow's intro movie, the title
animation and Pikachu's PCM clips; backlog entry in note 57), then **the battle-mechanics audit** (#70), then A2, A3, A4
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

### 2026-11-11 (end of day: context handoff) — Claude

- The user stopped for the day. Rewrote STATUS → *In progress* as the restart list (V5c checkpoint-03 next, untraced), and refreshed CLAUDE.md, PROJECT and PLAN's V5 row. Docs only; baseline unchanged: ROM 6337/6337, no-ROM 6042 / 295 skipped, 257 files; bundle `index-_kTTYOPq.js`.

### 2026-11-11 (V5c checkpoint-02 reviewed: passed) — Claude

- Reviewed Codex's `066f2d7`: source equals the spike, all 54 committed generated files match the manifest, no runtime reader. Setup twice clean; gates re-run (bundle unchanged, ROM 6337/6337, no-ROM 6042 / 295 skipped, 257 files). Reviewer mutation R1 (two Route 3 objectIds swapped in the data) caught with AssertionError. Note 93 §11. Next: checkpoint-03, the toggle model.

### 2026-11-11 (V5c checkpoint-02 implemented; awaiting review) — Codex

- Applied note93 §9's exact four-file spike, checked the original ROM object index and 1-based sprite-slot contract against pret, and made step 3's docs. Setup twice; checker prints `PASS 54 generated files`. All generated changes are only objectId lines for 102 NPCs; prior fields/order unchanged. Ordered gates once each: typecheck/build pass, unchanged bundle, ROM 6337/6337 and no-ROM 6042/295, 257 files. O1–O3 fail with AssertionError as briefed; maps.ts and Oak's Lab JSON hashes unchanged afterwards. No runtime reader or visible change. Report: note93 §10. Next: Claude reviews, then checkpoint-03's trace/brief; no checkpoint-03 work started.

### 2026-11-11 (V5c checkpoint-02 traced, spiked and briefed for Codex) — Claude

- Spiked `objectId` (the 1-based `object_event` place) on every map NPC, plus a type-only `NpcData` field. Setup changes 54 generated files, one line per NPC; nothing reads the field. Three new no-ROM cases check every NPC against pret's lists, pin the reordered maps and show 19 of today's 23 toggle rows finding their NPC (the other 4 are the dropped objects). Gates with the patch: typecheck clean, bundle unchanged, ROM 6337/6337, no-ROM 6042 / 295 skipped, 257 files; O1–O3 each AssertionError. Patch, hash manifest and checker (round-tripped) in `notes/93-v5c-checkpoint-02/`; the source is restored. The user named Codex (#116).

### 2026-11-11 (V5c checkpoint-01 reviewed: accepted, one test added) — Claude

- Reviewed Codex's `7ad7cac`: source equals the spike, both JSON files at the expected hash, no runtime reader. Setup twice clean; gates re-run (bundle unchanged, ROM 6333/6333, no-ROM 6039 / 294). Reviewer mutation R1 (no map-ownership check on a pointer) survived. That was a planning gap, so I added a ROM-only witness case; R1 now fails with AssertionError. New baseline ROM 6334/6334, no-ROM 6039 / 295 skipped, 256 files. Note 93 §8. Next: checkpoint-02's trace and brief.

### 2026-11-11 (V5c checkpoint-01 implemented; awaiting review) — Codex

- Applied note93's exact six-file spike and checked the extractor/test against pret's toggle table, constants, object numbers and symbol offsets. Setup twice: only two new JSON files, both expected SHA256; all 942 prior generated hashes unchanged, all 944 identical between runs. Made §6.3's docs. Ordered gates once each: typecheck/build pass, unchanged bundle, ROM 6333/6333 and no-ROM 6039/294, 256 files. N1–N6 fail with AssertionError in the expected cases; extractor SHA256 unchanged afterwards. No runtime reader or visible change. Report: note93 §7. Next: Claude reviews, then checkpoint-02's trace/brief; V5c remains open.

### 2026-11-11 (V5c planned; checkpoint-01 traced, spiked and briefed) — Claude

- Audited every map's NPCs against pret's object events: Route 1's youngsters and the Pokécenter gentleman lack their walk axes, five STAY NONE objects carry a fixed facing, Oak's Lab and Viridian City have the wrong slot order, and OAK2, walking Daisy and the Route 22 rivals are dropped. The root cause is that there are no toggleable objects in the port. Wrote note 93's six-checkpoint plan. Spiked checkpoint-01, extracting `ToggleableObjectStates` (239 rows) and `ToggleableObjectMapPointers`, unused: typecheck clean, ROM 6333/6333, no-ROM 6039 / 294 skipped, 256 files, bundle unchanged, setup idempotent, N1–N6 each AssertionError. Captured as `notes/93-v5c-checkpoint-01/01-spike.diff`; the source is restored (the tree is still at 6329). Next: the user names the implementer for note 93 §6.

### 2026-11-11 (V5b play-test passed; V5b closed) — Claude

- The user play-tested note 92 §5.6: "just tested, all pass". Recorded as note 92 §9; V5b is done. Next: V5c planning (note 93). No code or tests changed.

### 2026-11-11 (V5b checkpoint-01 reviewed: passed) — Claude

- Reviewed Codex's `275e1ad`: game code identical to the spike, every §5.2 doc edit present. Re-ran the gates: typecheck clean, bundle `index-_kTTYOPq.js` (671,475 bytes, matching SHA256), ROM 6329/6329, no-ROM 6037 / 292 skipped, 255 files. Reviewer mutations R1 (evolution queue skips the return) and R2 (FadePal7 BGP `$80`) each fail with AssertionError; `main.ts` restored. Note 92 §8. Next: the user's play-test (§5.6).

### 2026-11-11 (V5b checkpoint-01 implemented; awaiting review) — Codex

- Applied note92's exact six-file spike; verified 10 white frames, three 8-frame palette steps and D+10/34/36 against the cited ASM/frame model. Made §5.2's doc edits and logged both deferred timing/input items. Ordered gates once each: typecheck/build pass; bundle `index-_kTTYOPq.js`, 671,475 bytes, expected SHA256; ROM 6329/6329 and no-ROM 6037/292, 255 files. M1–M8 fail with AssertionError in the expected cases; `main.ts` SHA256 unchanged afterwards. No generated-data changes or setup. Report: note92 §7. Next: Claude reviews, then the user play-tests (§5.6); V5b remains open and V5c is not started.

### 2026-11-11 (V5b traced, spiked and briefed for Codex) — Claude

- Traced `.battleOccurred` → `EnterMap` → `MapEntryAfterBattle` and the port's return. Spiked a blocking `battle_return` state in `main.ts`: 10 white frames from the session's last tick, FadePal7/6/5 for 8 frames each drawn by one BGP pass over the composed scene (exact for these registers), the map song at D+10, `UpdateSprites` at D+34, first pass D+36; scripts resume on that pass. Nine existing cases needed only to wait out the return. With the patch: typecheck clean, ROM 6329/6329, no-ROM 6037 / 292 skipped, 255 files, bundle `index-_kTTYOPq.js`; M1–M8 each fail with AssertionError. Captured as `notes/92-v5b-checkpoint-01/01-spike.diff` (round-tripped) and the source restored, so the tree is still at the 6323 baseline. The user named Codex (#114). Next: Codex implements note 92 §5; Claude reviews; the user play-tests.

### 2026-11-11 (V5a reviewed: passed) — Claude

- Reviewed Codex's `6156b70`: test file identical to the spike, all §4.2 doc edits present and nothing else touched. Re-ran the gates: typecheck clean, bundle `index-BfVzYOru.js` unchanged, ROM 6323/6323, no-ROM 6031 / 292 skipped, 254 files. Reviewer mutations: R1 (no miss on zero damage) caught by the new file; R2 (AI keeps the last row) survives the new file but is caught by the existing `battle_ai_moves.test.ts`. Note 91 §6. V5a is done; next is V5b's trace, spike and brief (note 92).

### 2026-11-11 (V5a checkpoint-01 implemented; awaiting review) — Codex

- Applied note91's exact spike (six tests), checked all cases against pret's type constants, matchups and battle routines, and corrected the specified docs. Ordered gates once each: typecheck/build pass; bundle name, 670,982-byte size and SHA256 unchanged; ROM 6323/6323 and no-ROM 6031/292, 254 files. M1–M5 fail with AssertionError in exactly the expected cases, logs saved, source restored byte-for-byte. No production or generated-data changes, setup or play-test. Report: note91 §5. Next: Claude reviews and adds a mutation; V5a is not closed and V5b is not started.

### 2026-11-11 (V5 split approved; V5a checkpoint-01 briefed) — Claude

- The user answered O-54–O-56 ("yes to 0-54 as ordered, yes to 0-55 and all 3 for 0-56"); recorded as DECISIONS #110–#112 and in PLAN's V5 row. Traced and spiked V5a: one new test file through the real wild, trainer and party loaders plus the AI lookup and Ground vs Fire/Rock. With it in place: typecheck clean, ROM 6323/6323, no-ROM 6031 / 292 skipped, 254 files; five mutations each fail with AssertionError. Captured as `notes/91-v5a-checkpoint-01/01-spike.diff` and the source restored, so the committed tree is still at the 6317 baseline. Brief: `notes/91-v5a-plan.md` §4. Next: the user names an implementer; Claude reviews; then V5b's trace and brief.

### 2026-11-11 (V5 planned; questions for the user) — Claude

- Read the context files and note 57, then sized each V5 item against the code. Wrote `notes/90-v5-plan.md`: 20 items, seven sub-slices, a proposed order, three proposed moves out of V5. Main finding: the PSYCHIC bug is not in the live engine (numeric type bytes since A5c3f); checked with a throwaway test of `adjustDamageForMoveType`, deleted afterwards. No game code, data or test changed; the full suite was not run (baseline still ROM 6317/6317, no-ROM 6025/292). Next: the user's answers to O-54–O-57, then V5a checkpoint-01's trace, spike and brief (note 91).

### 2026-11-11 (context and codebase orientation) — Codex

- Read the entry-point rules, live handoff, project/roadmap, architecture and relevant conventions/decisions; sampled subsystem docs and traced startup, overworld passes, battle sessions, saves, extraction and test setup. V4 is closed after both user play-tests; V5 planning from PLAN and note57 is next, with no brief or checkpoint order yet. No game changes, server start or tests; the recorded baseline remains ROM 6317/6317 and no-ROM 6025/292. V5 was not started.

*Older entries (2026-11-10 and before) → `HISTORY.md` → *Recent session archive*.*
