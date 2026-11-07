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

**Last updated:** 2026-11-05 · **Phase:** V (Rebuild the lost work), with Phase A slices in between · **Milestones done:** 5 / 36 (R1 ✅, V1 ✅, A6 ✅, A1 ✅, V2 ✅); A5 in progress (A5a ✅, A5b ✅, A5d ✅, A5c ✅; A5e and A5f left)

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
(notes75–77). **R-SYNC complete (note78, Codex): pret names synchronized.** **04a accepted by Claude 2026-11-04** (note79 §7): ROM6033/6033. **Checkpoint-04 closed 2026-11-04:** 04b accepted (note79 §10; ROM6038/6038) and user play-test passed. **Checkpoint-05 (poof data) accepted 2026-11-05 (note 80 §6). Checkpoint-06 (06a, 06b) accepted 2026-11-05 (note 81 §7, §10). Checkpoint-07 (the live poof) closed 2026-11-05 (note 82 §8–§9). Checkpoint-08a accepted (note 83 §7). Checkpoint-08b accepted (note 83 §10). Checkpoint-08c code review passed; user play-test pending (note 84 §9).** Then finish A5e, A5f and V3. Earlier detail is in `HISTORY.md`.

## 📍 Where things stand — updated 2026-11-05 (*Setup* run twice for checkpoint-05; refs pulled 2026-11-03 evening, see the `refs/` row)

### Setup — done

| Item | State |
|---|---|
| Git | Root repo, branch `master`, **no remote**. Baseline commit `9bf2d7d` = docs + vanilla upstream. `.gitattributes`: text LF, `*.png`/`*.tilemap`/`*.gbc` binary. `game/.gitattributes` (the user's, tracked since 2026-10-14, DECISIONS #53) repeats those rules for `game/` and adds linguist hints |
| Committed generated files | `game/data/` (198 JSON) + `game/static/` (525 PNG, 3 tilemaps, 198 JSON); checkpoint-05 adds `battle_animations.json` and `audio/sfx/ball_poof.json` (setup twice, nothing else changed). Regenerate, never hand-edit |
| Ignored | `*.gbc`/`*.gb` (the ROM), `refs/`, `pkmn-sprites/`, `node_modules/`, `dist/` |
| `game/LICENSE` | **Removed by the user (2026-09-22): "i want it gone".** Deletion committed with R1c. Don't restore it (DECISIONS #28) |
| ROM | `game/pokeyellow.gbc`, SHA1 `cc7d0326…4a38e1` (DECISIONS #14) — re-verified 2026-09-22 |
| `refs/` | All 5 on pinned branches, refreshed **2026-11-03** with `./pull-refs.sh`: `pokeyellow` master `b452f2ab` (was `e89ead15`, +45: pret named every remaining symbol; ROM unchanged; **R-SYNC complete: 63-name mapping applied; historical readers adapted per note78 section6.1**), `gen1recomp` dev `d85a6176` (was `20ab97ab`, +480), `oldamber` main `268d571` (unchanged), `engine` main `1986dd93` (was `79957401`, +21: Gen 1 `calc.zig`/`chance.zig` and build), `dmg` main `5e3b785` (unchanged). `file:line` citations written before note 78 refer to `e89ead15` |
| `game/` | `gididaf/pokemon-yellow-typescript` `main` @ `05faa114` (2026-03-27), no `.git/`. Upstream `game/CLAUDE.md` folded into root `CLAUDE.md` → *Engine reference*, then deleted; moved on to `context/ARCHITECTURE.md` and the subsystem docs 2026-10-06 (DECISIONS #42) |
| `npm run setup` | 198 JSON → `data/`; static 525 PNG + 3 tilemaps + 198 JSON mirror. Checkpoint-05 (2026-11-05): setup twice, only `battle_animations.json` and `audio/sfx/ball_poof.json` (each mirrored). |
| Typecheck | Clean |
| Tests | **08c code review passed; user play-test pending (note 84 §9).** ROM 6131/6131; no-ROM 5854 pass / 277 skip, 243 files (230 passed / 13 skipped), default workers. Bundle `index-CW6CErI9.js`, 670,718 bytes; SHA256 `0f66990479c1be52952236a1345155e1ce2d93ff28601ec8ba9c5dee582d2bca` |

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
| SFX | **21** preloaded, including A5c2 CP2's RUN (bank `$08`, header `$41c5`, ID `$97`; no playback caller yet), the nurse's `healing_machine` and intro animation's preloaded `shrink`. Wired: `press_ab`, `collision`, `start_menu`, `go_inside`/`go_outside`, the two field-medicine sounds, the machine, and shrink. A5c3f checkpoint-02 adds four unused files (`damage`, `not_very_effective`, `super_effective`, `trainer_appeared`); checkpoint-05 adds unused `ball_poof` (Audio 2, `$93`). 32 SFX JSON files, 11 unused. Other SFX and bank-aware lookup → V5 |
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

**A5e checkpoint-08c code review passed (Codex, note84 section 9); awaiting the user's play-test (section 7).**
Reviewed Grok's `478f45f`: scope/hashes/audit agree; no blocking findings. The checkpoint remains open and is
not play-tested or closed. Do not start checkpoint-09 or A5f before the play-test result is recorded.

**Stopped for today at the user's request (2026-11-05). Next session:** user runs note84 section 7 (A = X, B = Z); record each result. Codex then resolves any findings and,
if all checks pass, closes 08c. The current #94 animation-option boundary remains intentional.

Codex re-ran the ordered gates once, default workers: ROM **6131/6131**, no-ROM **5854/277**, 243 files;
bundle `index-CW6CErI9.js`, 670,718 bytes, SHA256
`0f66990479c1be52952236a1345155e1ce2d93ff28601ec8ba9c5dee582d2bca`. Independent mutation R1 (wrong back-picture
species owner during Transform) was caught as an AssertionError and restored. No production or test code changed.

Note75 §4 gives the later checkpoint sequence; checkpoint-03b is accepted in note77 §9. Existing growth,
Pikachu entrance, retreat and slide bodies already work (A5c3f10c); do not re-port them from stale cue prose.
**O-50 answered 2026-11-04 → DECISIONS #94:** attack move animations are a separate future slice; A5e keeps them
OFF and its sub-animation player covers only the traced presentation IDs (poof). The screen-model merge
still waits until after A5e. Catch animations/demo retirement stay A5f; battle VBlank RNG stays backlogged.

**Current A5e workflow (decisions #95, #98, #102):** planner traces and spikes one checkpoint, captures its diff,
restores the source, and briefs exact gates/stops and mutation witnesses. The named implementer applies and audits
it, verifies and commits locally; the reviewer re-runs gates and adds a mutation. **08c: Codex plans/reviews, Grok
implements (#102).** Earlier Claude plans/reviews and implementation assignments are historical. Visible live changes
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
| 1 | **A5e** intros and animations | A | **Checkpoint-08c code review passed; awaiting user play-test (note 84 §9).** Then the user's play-test (§7). 08b accepted (note 83 §10). 08a accepted. Checkpoint-07 closed 2026-11-05. Checkpoint-06 closed 2026-11-05. 05 accepted 2026-11-05. Checkpoint-04 closed 2026-11-04. Parent scope note65 §4 (#70); attack animations excluded (#94). Then **A5f**, the wild catch's animations and catch demo integration |
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

### 2026-11-05 (A5e checkpoint-08c code review passed) - Codex

- Reviewed Grok's `478f45f`: seven hashes exact, source audit agrees, twelve witness records match; no blocking findings. Ordered gates re-run: ROM 6131/6131, no-ROM 5854/277, bundle unchanged. Reviewer mutation R1 (wrong Transform back-picture species source) caught and restored.
- Note84 section 9 records the review. No source/test changes. User play-test (section 7) pending; 08c stays open. Updated all seven context files for the end-of-day stop; archived three oldest session entries under #61.

### 2026-11-05 (A5e checkpoint-08c implemented) — Grok 4.7

- Applied `08c-spike.diff` at `2fef447`. Seven product files; hashes match the manifest. The twelve-item ASM audit agrees (note 84 §8). Twelve mutations (`grok-mutation-W*.log`) each failed as an AssertionError and were restored. No snapshot, data, or static edits.
- Gates once, default workers, from `game/`: typecheck, build, 09c marker, ROM 6131/6131, no-ROM 5854 pass / 277 skip, 243 files. Bundle `index-CW6CErI9.js`, 670,718 bytes, SHA256 `0f66990479c1be52952236a1345155e1ce2d93ff28601ec8ba9c5dee582d2bca`. Awaiting Codex review. No play-test.

### 2026-11-05 (A5e checkpoint-08c spiked and briefed for Grok) - Codex

- Prepared note84 and a seven-file spike: live picture ports, session-local assets, existing crash shake, debug party/enemy move setup. ROM 6131/6131, no-ROM 5854/277, 243 files; 12 assertion-based mutations caught. No existing snapshot changes.
- Captured patch/hashes/logs, restored all game source and rebuilt the baseline bundle. Grok implements, Codex reviews (#102); user play-test afterwards. Checked-in baseline remains 6114/6114. Archived the oldest three session entries under #61.

### 2026-11-05 (codebase and context study) — Codex

- Read the project rules, live handoff, architecture, roadmap, conventions, recent decisions and note 83; traced runtime initialization, ticks, battle sessions/host, picture variants, text, extraction and saves.
- Study only; no implementation slice claimed and no tests run. The recorded baseline remains ROM 6114/6114, no-ROM 5837/277. Next remains Claude's checkpoint-08c spike and brief.

### 2026-11-05 (A5e checkpoint-08b reviewed) — Claude (Opus)

- Reviewed Grok's `3a85e44`: scope, hashes, audit and mutation logs match §8. Re-ran the gates: ROM 6114/6114, no-ROM 5837/277, bundle unchanged. Reviewer mutations R1 (wrong copy side, caught as TypeErrors) and R2 (BG transfer left off) were caught. Accepted in note 83 §10; archived old STATUS entries.

### 2026-11-05 (A5e checkpoint-08b implemented) — Grok 4.7

- Applied `08b-spike.diff`. `battle_pic_variants.ts` and 21 no-ROM tests are new; `battle_init.ts` only exports `placePicture`. The eleven-item ASM audit agrees (note 83 §9). Ten mutations each failed as specified and were restored. Every failure is an AssertionError.
- Gates once, default workers: typecheck, build, 09c marker, ROM 6114/6114, no-ROM 5837 pass / 277 skip, 242 files. Bundle unchanged, `index-ZrEHQMBj.js`, 664,949 bytes, SHA256 `88c6c91aaab26c07264dc9016d0daa1a8583f8fa02483f7f3a5798738ca7f08b`. Report is note 83 §9. Unused, so no play-test. Awaiting Claude's review.

### 2026-11-05 (A5e checkpoint-08b spiked and briefed) — Claude (Opus)

- Spiked `battle_pic_variants.ts` (250 lines) and 21 tests, then reverted. There was no `BattleScreen` or renderer change and no existing test moved, so no split. `ChangeMonPic`'s `.done` runs SET_PAL_BATTLE; the port's MissingNo throw is pre-existing. ROM 6114/6114, no-ROM 5837/277, bundle unchanged. 10 mutations, AssertionErrors only. Wrote note83 §8 and `08b-spike.diff`.

### 2026-11-05 (A5e checkpoint-08a reviewed: accepted) — Claude (Opus)

- Reviewed Grok's `ca3551b`: hashes exact, audit agrees, setup leaves no diff. Gates re-run: ROM 6093/6093, no-ROM 5816/277, bundle `index-ZrEHQMBj.js`. Reviewer mutation R1 (rows reversed) caught. Wrote note83 §7. Next: spike and brief 08b.

### 2026-11-05 (A5e checkpoint-08a implemented) — Grok 4.7

- Applied the code hunks of `08a-spike.diff` and ran setup twice. Only `battle_animations.json` and its static mirror changed; the second run matched the first. The four-item ASM audit agrees (note 83 §6). Six mutations each failed as specified and were restored. M5 and M6 also surface the extractor `Error`.
- Gates once, default workers: typecheck, build, 09c marker, ROM 6093/6093, no-ROM 5816 pass / 277 skip, 241 files. Bundle `index-ZrEHQMBj.js`, 664,949 bytes, SHA256 `88c6c91aaab26c07264dc9016d0daa1a8583f8fa02483f7f3a5798738ca7f08b`. Report is note 83 §6. Data only, so no play-test. Awaiting Claude's review.

### 2026-11-05 (A5e checkpoint-08 planned; 08a briefed) — Claude (Opus)

- Inventoried every placeholder cue against the ASM (note83 §1.1). The user kept #94's boundary for the ON path (#101). `updateSprites` is the cartridge's battle no-op; the crash shake is already ported.
- Split 08 into 08a/b/c. Spiked 08a (MinimizedMonSprite read from AnimationMinimizeMon's operands): setup twice, one JSON. ROM 6093/6093, no-ROM 5816/277, bundle `index-ZrEHQMBj.js`; 6 mutations. Reverted; wrote note83 and `08a-spike.diff`.

### 2026-11-05 (A5e checkpoint-07 play-tested: closed) — Claude (Opus)

- The user passed all six note82 §5 checks ("all checked, all working well"); the poof and its sound are confirmed. Wrote note82 §9 and closed 07 here, in note75, CLAUDE.md and the docs. Next: plan checkpoint-08.

### 2026-11-05 (debug panel: DV inputs) — Claude (Opus)

- The user asked for it during 07's play-test. `debug.ts` only: **Add** and **Replace** take Atk/Def/Spd/Spc DVs (0–15; the HP DV is derived), passed to `createPokemon`. Typecheck clean; no-ROM 5816/273; ROM 6089/6089. The bundle moves to `index-BVX0wFAN.js`, 664,949 bytes (debug code only; note82's `KIV9XXwR` was 07's own gate). Answered: a level-6 Mew at DVs 0 is 28 HP, 17 in every other stat.

### 2026-11-05 (A5e checkpoint-07 reviewed: accepted) — Claude (Opus)

- Reviewed Grok's `2bd65e6`: hashes exact, audit agrees, logs witness-only. Re-ran the gates: ROM 6089/6089, no-ROM 5816/273, bundle `index-KIV9XXwR.js` 664,311. Reviewer mutation R1 (OFF also runs ShareMoveAnimations) caught. Wrote note82 §8. Next: the user's play-test (note82 §5).

### 2026-11-05 (A5e checkpoint-07 implemented) — Grok 4.7

- Applied `notes/82-a5e-checkpoint-07/07-spike.diff`. The six hashes matched. The six-item ASM audit agrees (note 82 §7). Eight mutations each failed as specified and were restored; Q1's Route 1 session failure is the one snapshot mismatch.
- Gates once, default workers: typecheck, build, 09c marker, ROM 6089/6089, no-ROM 5816 pass / 273 skip, 241 files. Bundle `index-KIV9XXwR.js`, 664,311 bytes, SHA256 `7f35ecdda3d7b509bc4642557393030b7716b7ea05f79ff89ae55d6e1d34e421`. Report is note 82 §7. Awaiting Claude's review and the user's play-test (note 82 §5).

### 2026-11-05 (A5e checkpoint-07 planned) — Claude (Opus)

- Traced `MoveAnimation`'s ON branch and `ShareMoveAnimations`, plus all three `SendOutMon` callers. Each calls `ClearSprites` first, so no ball OAM shows beside the poof (port probe: 63/63 empty). The stale `wAnimationType` gives a silent shake after a faint replacement. The enemy-side poof is A5f's, correcting note81 §10.2.
- Spiked and reverted: 6 files, 3 planned fallouts, 5 new tests. ROM 6089/6089, no-ROM 5816/273, bundle `index-KIV9XXwR.js` 664,311. 8 mutations. Live, ON reaches the menu 10 frames after OFF. Wrote note82 and `07-spike.diff`, plus DECISIONS #100. No game code committed.

### 2026-11-05 (A5e checkpoint-06b reviewed: accepted) — Claude (Opus)

- Reviewed Grok's `d33fb4a`: hashes exact, audit agrees, logs witness-only. Re-ran the gates: ROM 6084/6084, no-ROM 5811/273, bundle unchanged. Reviewer mutation R2 (palette reset hoisted out of the tile loop) caught by 4 synthetic cases; the real player-side poof never reaches X ≥ 88, so 07 should pin the enemy side. Wrote note81 §10. Checkpoint-06 closed. Next: plan 07.
