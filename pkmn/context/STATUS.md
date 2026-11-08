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

**Last updated:** 2026-11-06 · **Phase:** V (Rebuild the lost work), with Phase A slices in between · **Milestones done:** 5 / 36 (R1 ✅, V1 ✅, A6 ✅, A1 ✅, V2 ✅); A5 in progress (A5a ✅, A5b ✅, A5d ✅, A5c ✅, A5e ✅; A5f left)

---

## ⚠ Read this before planning anything

**The code from the July–August sessions was lost** (found 2026-09-22; DECISIONS
#26). Those sessions worked on a modified copy of the engine — 30 maps, ROM gate
removed, `static/` + PNGs, Psychic fix, 49 SFX — and **no copy of it exists
anywhere**. `game/` is a fresh copy of **vanilla upstream**. What those sessions
*learned* survives in `ARCHITECTURE.md` / `CONVENTIONS.md` / `DECISIONS.md`, so
rebuilding is cheaper than the first time. The rebuild is **Phase V**.

If a context file claims "30 maps", "395 tests", "the gate was deleted (P5-2)"
or "PSYCHIC chart implemented" without a *lost* marker, it is stale — trust this
file and the code, and fix the stale line.

**Commit policy (user, 2026-09-22):** commit **locally** at the end of every
slice — `git add` + `git commit` from the root, message ending with the
co-author line. **Never push** — there is no remote and there must never be one
(Hard rule #9, DECISIONS #24).

---

## Current phase

**Phase R is done** (2026-09-22). **Phase V** rebuilds the lost 30-map state (V1 ✅ → V2 ✅ → V3 Gym + Museum → V4
Diglett's Cave + Route 3 → V5 fixes), with Phase A slices in between (DECISIONS #29, #35, #55). **Now: A5c–A5f** (note 65,
#70): A5d ✅ and **A5c ✅ complete**: A5c1, A5c2 and A5c3a–f. A5c3f is the switch-over (note 72); the game has run on the new battle
engine since its 09b, and the user's play-test passed on 2026-11-01. Two small slices followed on 2026-11-02: the
timing tests (#90, note 73) and the overworld RNG (#91, note 74). **A5e is now in progress:** checkpoint-01's trace
is complete; checkpoint-02, checkpoint-03a and checkpoint-03b were independently accepted on2026-11-03
(notes75–77). **R-SYNC complete (note78, Codex): pret names synchronized.** **04a accepted by Claude 2026-11-04** (note79 §7): ROM6033/6033. **Checkpoint-04 closed 2026-11-04:** 04b accepted (note79 §10; ROM6038/6038) and user play-test passed. **Checkpoint-05 (poof data) accepted 2026-11-05 (note 80 §6). Checkpoint-06 (06a, 06b) accepted 2026-11-05 (note 81 §7, §10). Checkpoint-07 (the live poof) closed 2026-11-05 (note 82 §8–§9). Checkpoint-08a accepted (note 83 §7). Checkpoint-08b accepted (note 83 §10). Checkpoint-08c closed 2026-11-06 (note 84 §9–§10).** A5e is closed. The screen-model merge is done (note 86 §14). **A5f checkpoint-03 implemented, awaiting Claude's review** (note 87 section 17). Do not start checkpoint-04. Earlier detail is in `HISTORY.md`.

## 📍 Where things stand — updated 2026-11-06 (A5f checkpoint-03; refs pulled 2026-11-03 evening, see the `refs/` row)

### Setup — done

| Item | State |
|---|---|
| Git | Root repo, branch `master`, **no remote**. Baseline commit `9bf2d7d` = docs + vanilla upstream. `.gitattributes`: text LF, `*.png`/`*.tilemap`/`*.gbc` binary. `game/.gitattributes` (the user's, tracked since 2026-10-14, DECISIONS #53) repeats those rules for `game/` and adds linguist hints |
| Committed generated files | `game/data/` (200 JSON) + `game/static/` (525 PNG, 3 tilemaps, 200 JSON); checkpoint-05 adds `battle_animations.json` and `audio/sfx/ball_poof.json`. A5f checkpoint-01 adds `audio/sfx/ball_toss.json` and `audio/sfx/tink.json` and regenerates `battle_animations.json` (setup twice, nothing else changed). Regenerate, never hand-edit |
| Ignored | `*.gbc`/`*.gb` (the ROM), `refs/`, `pkmn-sprites/`, `node_modules/`, `dist/` |
| `game/LICENSE` | **Removed by the user (2026-09-22): "i want it gone".** Deletion committed with R1c. Don't restore it (DECISIONS #28) |
| ROM | `game/pokeyellow.gbc`, SHA1 `cc7d0326…4a38e1` (DECISIONS #14) — re-verified 2026-09-22 |
| `refs/` | All 5 on pinned branches, refreshed **2026-11-03** with `./pull-refs.sh`: `pokeyellow` master `b452f2ab` (was `e89ead15`, +45: pret named every remaining symbol; ROM unchanged; **R-SYNC complete: 63-name mapping applied; historical readers adapted per note78 section6.1**), `gen1recomp` dev `d85a6176` (was `20ab97ab`, +480), `oldamber` main `268d571` (unchanged), `engine` main `1986dd93` (was `79957401`, +21: Gen 1 `calc.zig`/`chance.zig` and build), `dmg` main `5e3b785` (unchanged). `file:line` citations written before note 78 refer to `e89ead15` |
| `game/` | `gididaf/pokemon-yellow-typescript` `main` @ `05faa114` (2026-03-27), no `.git/`. Upstream `game/CLAUDE.md` folded into root `CLAUDE.md` → *Engine reference*, then deleted; moved on to `context/ARCHITECTURE.md` and the subsystem docs 2026-10-06 (DECISIONS #42) |
| `npm run setup` | 200 JSON → `data/`; static 525 PNG + 3 tilemaps + 200 JSON mirror. A5f checkpoint-01 (2026-11-06): setup twice, only `battle_animations.json`, `audio/sfx/ball_toss.json` and `audio/sfx/tink.json` (each mirrored). |
| Typecheck | Clean |
| Tests | **A5f checkpoint-02 implemented 2026-11-06 (note 87 §14), awaiting Claude's review.** ROM 6169/6169; no-ROM 5887 pass / 282 skip, 245 files (232 passed / 13 skipped), default workers. Bundle `index-hN_k_3SH.js`, 671,318 bytes; SHA256 `5c1cc152c3209ea10dfb655a4f0c8a2985df253c5b2cfa24f342aefcc90f0439` |

### What the game has today (upstream audited 2026-09-22, plus every slice since)

| Area | State |
|---|---|
| Runtime data path | ✅ **No ROM** (R1b): the browser loads only `static/` via plain `fetch()` / `<img>`. Upstream's upload gate is deleted; the bundle has no gate code |
| Vite | `publicDir: 'static'`, `base: '/'`, `appType: 'mpa'` (missing file = real 404). Tab title **PKMN** |
| Background tabs | ✅ keeps running unfocused — logic + music (worker ticker, DECISIONS #27). User-verified |
| Maps | **12 playable**: PalletTown, RedsHouse1F/2F, BluesHouse, OaksLab, Route1, Route22, ViridianCity, ViridianPokecenter, ViridianMart, ViridianSchoolHouse, ViridianNicknameHouse. **+7 playable through the debug warps since V1b:** Route2, Route2Gate, Route2TradeHouse, DiglettsCaveRoute2, ViridianForest, ViridianForestSouthGate/NorthGate, with music, palette and Pikachu. **Since V1e the walking path is open:** Viridian → Route 2 → the Forest, once the old man's demo is done. **+5 since V2a:** PewterCity, PewterPokecenter, PewterMart, PewterNidoranHouse, PewterSpeechHouse, reached from Route 2's north edge (24 maps). The Museum and Gym doors fail gracefully until V3; the east road waits for V4 |
| Warps | ✅ since V1b: the player keeps their facing through warps, as in the ASM; Pikachu appears where Yellow's spawn states put it (`pikachu/pikachu_spawn.ts`) |
| Demo gates | ✅ **Gone since V1e**: the invented Viridian text and Route 22's fake Blue. A test fails if "demo" appears anywhere in `data/game_text.json` or `data/maps/*.json` |
| Viridian old men | ✅ **since V1e, as `scripts/ViridianCity.asm` runs them** (`story/viridian_city.ts`): the sleeping man's push-back; the forced demo after the Pokédex (fails, walk-away, Pikachu steps aside); the Mart spawning the walking old man and his repeatable demo (caught); the locked Gym door (hop down the ledge). The city's `wViridianCityCurScript` is saved (`mapScripts`), which keeps the Gym-door quirk (DECISIONS #34). User-verified |
| Route 22 | no NPCs (the rivals are I1). Its gate door leads to the unextracted `Route22Gate` and fails gracefully |
| Wild data | 57 `wild/*.json` |
| Music | **46** tracks extract; A5c3e checkpoint-02 removes the invalid `pokefluteinbattle` music entry (the real streams are unused SFX data) |
| SFX | **21** preloaded, including A5c2 CP2's RUN (bank `$08`, header `$41c5`, ID `$97`; no playback caller yet), the nurse's `healing_machine` and intro animation's preloaded `shrink`. Wired: `press_ab`, `collision`, `start_menu`, `go_inside`/`go_outside`, the two field-medicine sounds, the machine, and shrink. A5c3f checkpoint-02 adds four unused files (`damage`, `not_very_effective`, `super_effective`, `trainer_appeared`); checkpoint-05 adds unused `ball_poof` (Audio 2, `$93`). A5f checkpoint-01 adds unused `ball_toss` (Audio 2, `$91`) and `tink` (Audio 2, `$8C`). 34 SFX JSON files, 13 unused. Other SFX and bank-aware lookup → V5 |
| Type chart | **PSYCHIC bug present** — chart uses `PSYCHIC_TYPE` on both sides, species use `PSYCHIC`, so Bug→Psychic 2×, Fighting→Psychic ½×, Psychic→Psychic ½×, Ghost→Psychic 0× never apply (DECISIONS #10) → V5 |
| Hidden items | ✅ **A1b, user-verified; A5b4 timing reviewed and user-verified:** DisplayTextID opens, found program begins at T+20 before give, flag on success, longer jingle and full map close; cartridge full-bag waits. Forest Potion/Antidote and Viridian City Potion |
| Item balls | ✅ **A1b, user-verified; A5b4 timing reviewed and user-verified:** extracted `item` selects `PickUpItem`; box opens at T, give/hide T+20, found program T+23, `get_item1`, full map close after sound and A's release. Saved `hiddenObjects` keeps balls gone and tiles free. Full-bag failure keeps the ball. Route 1's sample preserves the flag-first quirk. Trade kid (A4) and Oak's Aide (A2) still await their handlers |
| Trainers | ✅ **since V1c, as `home/trainers.asm` runs them**: before-battle text → meet music (male / female / evil) → battle; on a win the fanfare after the last Pokémon, "defeated", the pic scrolling back in, "CLASS: " + end text, money; beaten only after a win (saved); after-battle text when talked to again. Oak's Lab rival: his texts, no blackout on a loss, `rivalStarter` saved. Since A5d every entry runs the shared transitions (user-verified 2026-10-18) |
| Trainer sight | ✅ **A1c, user-verified 2026-10-06** (`notes/20-a1c-plan.md`, DECISIONS #43): the Forest's map script runs `TrainerEngage` on standing passes ($fc quirk, pop-in), the meet music at spotting, EmotionBubble (61 frames), the `MoveSprite` walk-up, `wJoyIgnore`/`BIT_SEEN_BY_TRAINER`, `EndTrainerBattle`'s pass. Forest sight ranges 4, 4, 1, 0, 4. The hop-midpoint `RunMapScript` → V4 (tripwire test) |
| Catch demo | ✅ **since V1d**: Oak's Pikachu catch runs the ASM's simulated FIGHT → ITEM → POKé BALL input, with both outcomes (caught, or 3 shakes and "Shoot! It was so close too!"). Since V1e the Viridian old man uses it too |
| Whiteout | ✅ `handleBlackoutWarp` — halves money, heals, warps to last Pokécenter |
| Badge stat boosts | ✅ `battle_loaders.ts` `applyBadgeStatBoosts` (the cartridge's, on the battle copy). Nothing awards a badge yet → V3 |
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
| Debug overlay + warps | Backtick (warps: Pallet, Viridian, Route 1, Route 22, Lab, houses, Pokécenter, Mart; since V1b also Route 2 south and north, the Forest, both Forest gates, Route 2 Gate, the trade house, and the Diglett's Cave entrance). Its **Skip Intro** button sets the intro flags and adds a Lv5 Pikachu, which is enough to test Pikachu following |
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
| **Intro animation** ✅ | Oak's speech frame for frame: BGP/OBP0 palette fades (the silhouette, the white fades), the window slide, the tile slides with the BG-thirds tear, the 7-frame pic copies and the shrink wipe, little Red, `SFX_SHRINK`, the intro music's fade-to-stop, the 20-frame entry and 40-frame white exit. CP1–CP5 by Codex, checked by Claude, **user-verified 2026-10-18**; note 64, DECISIONS #51/#69 |

## In progress

**A5f checkpoint-03 (the ball animations live): Claude's code review passed (note 87 §18); awaiting the user's catch play-test (§16.8).** Codex implemented it (`ccf0119`; the user's choice). ROM 6169/6169, no-ROM 5887/282, bundle `index-acc-zS92.js`. Checkpoints 01–02 accepted (§12, §15).

**Stopped for today at the user's request (2026-11-06). Next session:** the user plays §16.8 (A = X, B = Z; balls from the debug panel's BAG) and the result is recorded as note 87 §19. Then plan **checkpoint-04** (the catch demos as real battles): note 87 §2.2 and §18's reading list hold the traced anchors. Claude plans and reviews; the user names the implementer.

Note75 §4 gives the later checkpoint sequence; checkpoint-03b is accepted in note77 §9. Existing growth,
Pikachu entrance, retreat and slide bodies already work (A5c3f10c); do not re-port them from stale cue prose.
**O-50 answered 2026-11-04 → DECISIONS #94:** attack move animations are a separate future slice; A5e keeps them
OFF and its sub-animation player covers only the traced presentation IDs (poof). The screen-model merge
is done (note 86 §14). Catch animations/demo retirement stay A5f; battle VBlank RNG stays backlogged.

**Current A5e workflow (decisions #95, #98, #102, #103):** planner traces and spikes one checkpoint, captures its diff,
restores the source, and briefs exact gates/stops and mutation witnesses. The named implementer applies and audits
it, verifies and commits locally; the reviewer re-runs gates and adds a mutation. **09: Claude plans/reviews, Codex
implements (#103).** Earlier checkpoint assignments are historical. Visible live changes
need the user's play-test after code review; stop at each checkpoint.

**Rules learned in A5c3f's checkpoint 11 (note 72):**
- census rows go only when the source text they record is deleted (§11.89);
- snapshots may only lose subtrees named after deleted things (§11.85);
- a `keep` case reading dead code is replaced by a new-engine test (§11.88).

**Since note 73: one 30 s suite timeout and no re-run-alone fallback.** A timeout in a full run is a real failure.

The finished A5c3f / timing / RNG detail moved to `HISTORY.md` → *Archived STATUS sections (moved 2026-11-02)*.

## Next up — queue

Claim the top one, finish it, verify, **commit locally**, log it, stop. Full roadmap in `PLAN.md`.

| # | Slice | Phase | Notes |
|---|---|---|---|
| 1 | **A5f** the wild catch and the catch demos | A | **Checkpoint-03 review passed (note 87 §18); the user's catch play-test (§16.8) is next.** Then 04 the demos as real battles, 05 retirement and the full A5f play-test; each briefed after the previous review. 01–02 accepted. |
| 2 | **V3** Pewter Gym + Museum | V | Brock → BADGE_1; Museum 1F/2F |
| 3 | **V4** Diglett's Cave + Route 3 | V | Also `RunMapScript` at the hop midpoint (#43; `trainer_tripwires.test.ts` fails first) |
| — | **Attack move animations** (unscheduled) | A | Separate slice (#94), after A5e/A5f; the user places it. A **full pret `move_anim` interpreter** (#94 amended): every attack animation from the cartridge's data/routines. Needs its own plan |
| 4 | **V5** Recovered fixes | V | PSYCHIC chart, SFX catch-up and bank-aware lookup, species display names, the map-object audit incl. hidden-event facing (note 19 N-2), **the CGB palette-command hold** (2 held frames before each `SET_PAL_*`'s Delay3; DECISIONS #73) |

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

### 2026-11-06 (A5f checkpoint-03 reviewed: passed; end of day) — Claude (Opus)

- Codex's `ccf0119` (the user gave 03 to Codex): byte-identical to the spike, witnesses match, archive verbatim. R1 (a wrong tink ID) caught. Gates: ROM 6169/6169, no-ROM 5887/282, bundle `index-acc-zS92.js`. Fixed one census row (the catch's poof is live). Note 87 §18. End of day: next is the user's catch play-test (§16.8), then plan checkpoint-04.

### 2026-11-06 (A5f checkpoint-03 implemented, awaiting Claude's review) - Codex

- Applied the exact five-file patch at `4c51968`; manifest PASS, four-row source audit agrees. Only section 16.4's planned test changes; no snapshots or generated data changed.
- Ordered gates once, default workers: typecheck/build/marker pass; ROM 6169/6169 (245 files), no-ROM 5887 pass / 282 skip. Bundle `index-acc-zS92.js`, 671,418 bytes, SHA256 `cc506c53...31b4`. X1-X3 each caught by an AssertionError and restored. Report: note 87 section 17. Claude reviews next; user play-test follows. Checkpoint-04 not started.

### 2026-11-06 (A5f checkpoint-03 briefed for Grok) — Claude (Opus)

- Spiked the live binding (one sub-animation host with the ball sounds; two sounds preloaded). Seven planned test changes in three files, each matching checkpoint-02's ledgers; `wNumShakes` now ends 0; live sound order pinned. ROM 6169/6169, no-ROM 5887/282, bundle `index-acc-zS92.js`, X1–X3 caught. Note 87 §16.

### 2026-11-06 (A5f checkpoint-02 reviewed: accepted) — Claude (Opus)

- Grok's `ca7239b`: byte-identical to the spike, witnesses match, archive verbatim. R1 (GROWL's table ID) caught by the source-table test. Gates: ROM 6169/6169, no-ROM 5887/282, bundle `index-hN_k_3SH.js`. Note 87 §15. Next: brief checkpoint-03.

### 2026-11-06 (A5f checkpoint-02 implemented, awaiting Claude's review) — Grok 4.7

- Applied `02-spike.diff` on `f7cdd24`. Manifest PASS, two files. The five-row audit agrees (note 87 §14). No existing test, snapshot, session or data change.
- Gates once, default workers: typecheck, build, 09c marker, ROM 6169/6169 (245 files), no-ROM 5887 pass / 282 skip (232 passed / 13 skipped). Bundle `index-hN_k_3SH.js`, 671,318 bytes, SHA256 `5c1cc152c3209ea10dfb655a4f0c8a2985df253c5b2cfa24f342aefcc90f0439`. W1–W10 each an AssertionError and restored. Checkpoint-03 not started.
- Archived 2 oldest session entries verbatim to HISTORY.md (DECISIONS #61).

### 2026-11-06 (A5f checkpoint-02 briefed for Grok) — Claude (Opus)

- Spiked the toss and shake special effects (unused; `BLOCKBALL_ANIM` has none, by the table): ROM 6169/6169, no-ROM 5887/282, bundle `index-hN_k_3SH.js`, 15 new cases, no existing test change. W1–W10 caught as assertions (W5 and the block case revised after two first tries were caught only by thrown errors). Note 87 §13, `02-spike.diff`, manifest, runner.

### 2026-11-06 (A5f checkpoint-01 reviewed: accepted) — Claude (Opus)

- Grok's `52310a9`: code byte-identical to the spike, manifest PASS 15, witnesses match, docs per §9. R1 (a corrupted `tink.json` frequency) caught by the source-encoding test. Gates: bundle unchanged, ROM 6154/6154, no-ROM 5872/282. Note 87 §12. Next: brief checkpoint-02.

### 2026-11-06 (A5f checkpoint-01 implemented, awaiting Claude's review) — Grok 4.7

- Applied `01-spike.diff` on `8e3ee56`. Manifest PASS, 15 files. Setup twice, byte-identical: six generated files only. The four-row audit agrees (note 87 §11). No engine code, preload or snapshot change.
- Gates once, default workers: typecheck, build, 09c marker, ROM 6154/6154 (244 files), no-ROM 5872 pass / 282 skip (231 passed / 13 skipped). Bundle unchanged, `index-BOisyFSK.js`, 670,274 bytes, SHA256 `886fa0103aa8f102924494435d35de6c8dda4c1af71a24d3d0079e076b6d2742`. M1–M5 each an AssertionError and restored. Checkpoint-02 not started.

### 2026-11-06 (A5f planned; checkpoint-01 briefed for Grok) — Claude (Opus)

- Traced what A5f still needs: `ItemUseBall` and the toss sequence are live; the ball's OAM sub-animations ($C1–$C6) and their special effects are zero-frame, and the demos still use the old renderer. Ball animations play whatever the option says (`MoveAnimation` → `TossBallAnimation` first). Spiked checkpoint-01 (data): setup twice identical, bundle unchanged, ROM 6154/6154, no-ROM 5872/282, M1–M5 caught (two filter bugs fixed in the runner). Wrote note 87, `01-spike.diff`, the manifest and runner; DECISIONS #105; a backlog entry (`wGrassRate`).

### 2026-11-06 (screen-model merge play-tested: done) — Claude (Opus)

- The user ran note 86 §11.7's five checks and reported "all passes". Recorded as §14; closed the merge in STATUS, PROJECT, CLAUDE.md, DECISIONS #104 and note 57. No code changed. Next: plan A5f.

### 2026-11-06 (screen-model merge checkpoint-02 reviewed: passed) — Claude (Opus)

- Grok's `869b3ee` equals the spike byte for byte; manifest PASS; witness counts and restores match the planner's. R1 (`cells` returning the shown copy) caught by 12 cases. Gates: bundle `index-BOisyFSK.js`, ROM 6149/6149, no-ROM 5872/277. Note 86 §13. Next: the user's play-test (§11.7).

### 2026-11-06 (screen-model merge checkpoint-02 implemented, awaiting Claude's review) — Grok 4.7

- Applied `02-spike.diff` on `70424ae`. Manifest PASS, three files. The four-row audit agrees (note 86 §12). No test, snapshot, renderer or data change.
- Gates once, default workers: typecheck, build, 09c marker, ROM 6149/6149 (244 files), no-ROM 5872 pass / 277 skip (231 passed / 13 skipped). Bundle `index-BOisyFSK.js`, 670,274 bytes, SHA256 `886fa0103aa8f102924494435d35de6c8dda4c1af71a24d3d0079e076b6d2742`. W1–W12 failure counts match §11.5; each is an AssertionError and was restored. A5f not started.

### 2026-11-06 (screen-model merge checkpoint-02 briefed for Grok) — Claude (Opus)

- Fresh spike at `a87637b` (byte-identical to the 01-time preview): typecheck clean, bundle `index-BOisyFSK.js`, ROM 6149/6149, no-ROM 5872/277, no test changed. W1–W12 each caught by existing tests (the first runner missed W1 by omitting `battle_effects.test.ts`; a full run failed 37). Wrote note 86 §11, `02-spike.diff`, the manifest and runner.

### 2026-11-06 (screen-model merge checkpoint-01 reviewed: accepted) — Claude (Opus)

- Grok's `0eca04e`: manifest PASS, only the test imports the core, report and witnesses agree, the STATUS archive is verbatim. R1 (shown aliasing wTileMap) caught by 8 cases. Gates: bundle unchanged, ROM 6149/6149, no-ROM 5872/277. Note 86 §10. Next: brief checkpoint-02.

### 2026-11-06 (screen-model merge checkpoint-01 implemented, awaiting Claude's review) — Grok 4.7

- Applied `01-spike.diff` on `1bc787f`. Manifest PASS. The four-row audit agrees (note 86 §9). Nothing imports `screen_model.ts`.
- Gates once, default workers: typecheck, build, 09c marker, ROM 6149/6149 (244 files), no-ROM 5872 pass / 277 skip (231 passed / 13 skipped). Bundle `index-CW6CErI9.js`, 670,718 bytes, SHA256 `0f66990479c1be52952236a1345155e1ce2d93ff28601ec8ba9c5dee582d2bca`, unchanged. M1–M8 each failed as an AssertionError and were restored (`grok-mutation-M*.log`). Checkpoint-02 not started.

### 2026-11-06 (screen-model merge planned; checkpoint-01 briefed for Grok) — Claude (Opus)

- The user chose a shared core (renderers unchanged). Traced the three models: the tile map's thirds, the copy queue and the message-box capture match line for line. Spiked both checkpoints: 01 alone keeps the bundle byte-identical, ROM 6149/6149, no-ROM 5872/277, M1–M8 caught; 01+02 also pass with no existing test changed (bundle `index-BOisyFSK.js`). Wrote note 86, `01-spike.diff`, the manifest, the mutation runner and the 02 preview; DECISIONS #104 amended.

### 2026-11-06 (O-52 answered: screen-model merge before A5f) — Claude (Opus)

- The user: "we can do that before A5f". Recorded as DECISIONS #104; queued the merge as row 1, ahead of A5f. Next: plan it.

### 2026-11-06 (A5e checkpoint-09 play-tested: A5e closed) — Claude (Opus)

- The user ran note 85 §7's nine checks and reported "all passes". Recorded as §12; closed checkpoint-09 and A5e in STATUS, PLAN, PROJECT, CLAUDE.md, note 75 and the battle ARCHITECTURE. No code changed. Next: plan A5f. Open: O-52 (the screen-model merge's place).

### 2026-11-06 (A5e checkpoint-09 reviewed: passed) — Claude (Opus)

- Codex's `ad64da2` equals the spike byte for byte; manifest PASS, docs per §5–§6. Fixed 10 more not-live comment lines (the brief's sweep gap; seven were Codex's findings) and two ARCHITECTURE lines, comment-only against `ad64da2`. Gates: ROM 6131/6131, no-ROM 5854/277, bundle unchanged. R1 (an extractor key rename) caught by the checker. Note 85 §11. Next: the user's full A5e play-test (§7).

