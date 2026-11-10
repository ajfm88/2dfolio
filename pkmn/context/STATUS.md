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

**Last updated:** 2026-11-08 · **Phase:** V (Rebuild the lost work), with Phase A slices in between · **Milestones done:** 7 / 36 (R1 ✅, V1 ✅, A6 ✅, A1 ✅, V2 ✅, A5 ✅, V3 ✅); **V4 next**

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
Diglett's Cave + Route 3 → V5 fixes), with Phase A slices in between (DECISIONS #29, #35, #55). **A5 closed** 2026-11-07 (note 87 §27). **V3 closed** 2026-11-08 (note 88 §48). Next: V4. Earlier detail is in `HISTORY.md`.

## 📍 Where things stand — updated 2026-11-06 (A5f checkpoint-03; refs pulled 2026-11-03 evening, see the `refs/` row)

### Setup — done

| Item | State |
|---|---|
| Git | Root repo, branch `master`, **no remote**. Baseline commit `9bf2d7d` = docs + vanilla upstream. `.gitattributes`: text LF, `*.png`/`*.tilemap`/`*.gbc` binary. `game/.gitattributes` (the user's, tracked since 2026-10-14, DECISIONS #53) repeats those rules for `game/` and adds linguist hints |
| Committed generated files | `game/data/` (204 JSON) + `game/static/` (527 PNG, 3 tilemaps, 204 JSON); V3 checkpoint-04 adds `maps/Route3.json` (mirrored) and regenerates PewterCity, text_programs, map_sprite_sets and battle_transitions. checkpoint-05 adds `battle_animations.json` and `audio/sfx/ball_poof.json`. A5f checkpoint-01 adds `audio/sfx/ball_toss.json` and `audio/sfx/tink.json` and regenerates `battle_animations.json` (setup twice, nothing else changed). V3 checkpoint-01 adds `maps/Museum1F.json`, `maps/Museum2F.json`, `maps/PewterGym.json` (each mirrored). Regenerate, never hand-edit |
| Ignored | `*.gbc`/`*.gb` (the ROM), `refs/`, `pkmn-sprites/`, `node_modules/`, `dist/` |
| `game/LICENSE` | **Removed by the user (2026-09-22): "i want it gone".** Deletion committed with R1c. Don't restore it (DECISIONS #28) |
| ROM | `game/pokeyellow.gbc`, SHA1 `cc7d0326…4a38e1` (DECISIONS #14) — re-verified 2026-09-22 |
| `refs/` | All 5 on pinned branches, refreshed **2026-11-03** with `./pull-refs.sh`: `pokeyellow` master `b452f2ab` (was `e89ead15`, +45: pret named every remaining symbol; ROM unchanged; **R-SYNC complete: 63-name mapping applied; historical readers adapted per note78 section6.1**), `gen1recomp` dev `d85a6176` (was `20ab97ab`, +480), `oldamber` main `268d571` (unchanged), `engine` main `1986dd93` (was `79957401`, +21: Gen 1 `calc.zig`/`chance.zig` and build), `dmg` main `5e3b785` (unchanged). `file:line` citations written before note 78 refer to `e89ead15` |
| `game/` | `gididaf/pokemon-yellow-typescript` `main` @ `05faa114` (2026-03-27), no `.git/`. Upstream `game/CLAUDE.md` folded into root `CLAUDE.md` → *Engine reference*, then deleted; moved on to `context/ARCHITECTURE.md` and the subsystem docs 2026-10-06 (DECISIONS #42) |
| `npm run setup` | 204 JSON → `data/`; static 527 PNG + 3 tilemaps + 204 JSON mirror. V3 checkpoint-05 (2026-11-08): setup twice, identical across all 938 generated files; only `text_programs.json` changed (mirrored). |
| Typecheck | Clean |
| Tests | **V3 closed 2026-11-08 (note 88 §47–§48).** ROM 6260/6260; no-ROM 5970 pass / 290 skip, 249 files (236 passed / 13 skipped), default workers. Bundle `index-DtAwi9SA.js`, 668,387 bytes; SHA256 `109e01832ea16f92ec085745615b929a8b9df4267d563c097ce017deafe64f10` |

### What the game has today (upstream audited 2026-09-22, plus every slice since)

| Area | State |
|---|---|
| Runtime data path | ✅ **No ROM** (R1b): the browser loads only `static/` via plain `fetch()` / `<img>`. Upstream's upload gate is deleted; the bundle has no gate code |
| Vite | `publicDir: 'static'`, `base: '/'`, `appType: 'mpa'` (missing file = real 404). Tab title **PKMN** |
| Background tabs | ✅ keeps running unfocused — logic + music (worker ticker, DECISIONS #27). User-verified |
| Maps | **12 playable**: PalletTown, RedsHouse1F/2F, BluesHouse, OaksLab, Route1, Route22, ViridianCity, ViridianPokecenter, ViridianMart, ViridianSchoolHouse, ViridianNicknameHouse. **+7 playable through the debug warps since V1b:** Route2, Route2Gate, Route2TradeHouse, DiglettsCaveRoute2, ViridianForest, ViridianForestSouthGate/NorthGate, with music, palette and Pikachu. **Since V1e the walking path is open:** Viridian → Route 2 → the Forest, once the old man's demo is done. **+5 since V2a:** PewterCity, PewterPokecenter, PewterMart, PewterNidoranHouse, PewterSpeechHouse, reached from Route 2's north edge. **+3 since V3 checkpoint-01:** Museum1F, Museum2F, PewterGym (27 maps). Museum and Gym doors now reachable; the Museum ticket (checkpoint-02a) is closed; the Old Amber and the 2F hiker (checkpoint-02b) are closed; fossil pop-ups (checkpoint-02c) are closed; Brock's talk and battle (checkpoint-03b) are closed. Checkpoint-05 awards the Boulder Badge and TM34 (closed). **+1 since V3 checkpoint-04:** Route3 (28 maps), reached by the debug warp at (4,9). Pewter's east connection to Route3 is open once Brock is beaten; before that the guide still blocks the walk. Route4 stays unextracted and unnamed, so Route3's north edge is the native tree border. |
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
| **V3** (01–05) ✅ | Pewter Gym, the Museum, Route 3 and the first badge: the three maps, the ticket, the Old Amber, the hiker and fossil pop-ups, the Gym's guide, statues, Jr. Trainer and Brock, Route 3 and Pewter's east connection (#106), then Brock's reward. Codex and Grok implemented, Claude and Codex reviewed, **user-verified 2026-11-08**; note 88 |
| **A5f** ✅ | The wild catch and the catch demos: ball animation data, the toss/shake effects, live ball animations, the demos as real battles, the old renderer retired. Checkpoints 01–05, Grok and Codex, each checked by Claude, **user-verified 2026-11-07**; note 87, DECISIONS #105 |
| **Intro animation** ✅ | Oak's speech frame for frame: BGP/OBP0 palette fades (the silhouette, the white fades), the window slide, the tile slides with the BG-thirds tear, the 7-frame pic copies and the shrink wipe, little Red, `SFX_SHRINK`, the intro music's fade-to-stop, the 20-frame entry and 40-frame white exit. CP1–CP5 by Codex, checked by Claude, **user-verified 2026-10-18**; note 64, DECISIONS #51/#69 |

## In progress

**Nothing is in progress.** V3 closed 2026-11-08 (note 88 §48).

**Restart list for the next session:**
1. **Plan V4** (the top of the queue; search `notes/57-findings-backlog.md` for its id first). Route 3's map and Pewter's east connection already landed in V3 (#106).
2. Route 3's trainers, grass, ledges and north edge have tests and a review, but no recorded play-test (note 88 §44). Walk them when V4 opens.

Pret's symbol file: read it into a scratch folder with `git -C refs/pokeyellow show origin/symbols:pokeyellow.sym`, from bash (PowerShell 5.1's `>` writes UTF-16), never into the repo root.

Checkpoint-04 closed: Codex's `9013024`, Claude's review passed (§22), the user's play-test "all passes" (§23, 2026-11-07).

Checkpoint-03 closed: Codex's `ccf0119`, Claude's review passed (§18), the user's play-test reported no failure (§19, 2026-11-07). Checkpoints 01–02 accepted (§12, §15).

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
| 1 | **V4** Diglett's Cave + the rest of Route 3 | V | Route 3's map landed in V3 (#106). Also `RunMapScript` at the hop midpoint (#43; `trainer_tripwires.test.ts` fails first) |
| — | **Attack move animations** (unscheduled) | A | Separate slice (#94), after A5e/A5f; the user places it. A **full pret `move_anim` interpreter** (#94 amended): every attack animation from the cartridge's data/routines. Needs its own plan |
| 2 | **V5** Recovered fixes | V | The battle return's blocking fade (note 57, note 88 §47); PSYCHIC chart, SFX catch-up and bank-aware lookup, species display names, the map-object audit incl. hidden-event facing (note 19 N-2), **the CGB palette-command hold** (2 held frames before each `SET_PAL_*`'s Delay3; DECISIONS #73) |

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

### 2026-11-08 (V3 closed) — Claude (Opus)

- The user's §45.8 play-test: "it all passes" (note 88 §48). Checkpoint-05 and V3 are closed, 7 of 36 milestones. Checkpoint-04 had no separate play-test report (§44). Next: plan V4.

### 2026-11-08 (V3 checkpoint-05 reviewed: passed) — Claude (Opus)

- Grok's `c7e89ef` equals the spike byte for byte. Setup twice and every gate reproduced: bundle `index-DtAwi9SA.js`, ROM 6260/6260, no-ROM 5970/290. All 11 reviewer mutations were AssertionErrors on the first run. Two handoff-doc slips fixed. One older timing difference backlogged for V5 (the battle return doesn't block). Note 88 §47. Next: the user's §45.8 play-test (§48).

### 2026-11-08 (V3 checkpoint-05 implemented, awaiting review) — Grok

- Applied `05-spike.diff` on clean `953194d`. Manifest `PASS 18 source + 2 generated files + patch` before and after V1–V20. Setup twice: 938 generated files identical; only `text_programs.json` changed. Gates once each: typecheck pass, bundle `index-DtAwi9SA.js` 668,387 bytes, marker pass, ROM 6260/6260 (249 files), no-ROM 5970 passed / 290 skipped (236 / 13 files). V1–V20 each an AssertionError and restored. Report is note 88 §46. Next: the review (§47), then the user's full V3 play-test (§48). No later slice was started.

### 2026-11-08 (V3 checkpoint-05 planned for Grok) — Claude (Opus)

- Traced and spiked Brock's win from clean `99d1b91`: the reward as a map-script command list, the talk-again branches, a nested DisplayTextID for the full-bag retry, TM34's ¥2000 price, OLD_AMBER as a key item (a 02b miss), 18 source and 2 generated files. Spike: bundle `index-DtAwi9SA.js`, ROM 6260/6260, no-ROM 5970/290, V1–V20 each an AssertionError, clean roundtrip. The (36,16) scan has no ROM answer and stays a throw (unreachable). Briefed in §45; the patch is not applied. The user's §41.8 play-test isn't recorded (§44).

### 2026-11-08 (V3 checkpoint-04 reviewed: passed, tests strengthened) — Codex

- Grok's `122cbf7` equals the spike; setup twice and the ordered gates reproduce all expected bytes/counts. Independent ROM/ASM audit confirms the north border and ledge proof. Four of six new mutations initially survived: actual battle party, follower placement, destination NPC roster, and sight dispatch at the hop source were unpinned. Added one no-ROM case and assertions; all six now fail with AssertionError and restore. Final gates pass: unchanged bundle, ROM 6246/6246 (249 files), no-ROM 5957/289. §43 has all evidence. No production changes. Next: the user's §41.8 play-test (§44); checkpoint-05 was not started.

### 2026-11-08 (V3 checkpoint-04 implemented, awaiting Codex's review) — Grok

- Applied `04-spike.diff` on clean `30fcd4a`. Manifest `PASS 18 source + 10 generated files + patch` before and after V1–V12. Setup twice: 938 generated files identical; 204 JSON, 527 PNGs, 3 tilemaps. Gates once each: typecheck pass, bundle `index-6P8tD69v.js` 666,543 bytes, marker pass, ROM 6245/6245 (249 files), no-ROM 5956 passed / 289 skipped (236 / 13 files). V1–V12 each an AssertionError and restored. Report is note 88 §42. Next: Codex's review (§43), then the user's play-test (§44). Checkpoint-05 was not started.

### 2026-11-08 (V3 checkpoint-04 planned for Grok) — Codex

- Traced and spiked Route3 from clean `6222954`: 18 source / 10 generated files, 52 text programs, 17 no-ROM cases plus one ROM map comparison. Final gates sequential: bundle `index-6P8tD69v.js` 666,543 bytes, ROM 6245/6245 (249 files), no-ROM 5956/289. V1–V12 each an AssertionError; clean patch/setup roundtrip reproduces all hashes. Game source/data restored. §41 settles the north edge (native tree border until Route4) and pre-Brock access (debug warp; both crossings tested); the outdoor-trainer tripwire is narrowed with an exhaustive ledge/source-sight proof. Grok implements (§42), Codex reviews (§43), then the user play-tests (§44). No checkpoint-05 work.

### 2026-11-08 (V3 checkpoint-03b closed) — Claude (Opus)

- The user's §36.8 play-test: "all works perfectly" (note 88 §39). Checkpoint-03, the Gym, is done. The user asked Codex to plan 04: Claude's partial trace and the method are in §40, with no source changed.

### 2026-11-08 (V3 checkpoint-03b reviewed: passed, assertions added) — Claude (Opus)

- Codex's `1a42eb8` equals the spike byte for byte, and every gate reproduced. R1, R2 and R6 survived (the display's box and outer wait, `StopAllMusic`): the code was right, so three assertions were added, and all six reviewer mutations now fail. ROM 6227/6227, no-ROM 5939/288, bundle unchanged. Note 88 §38. Next: the user's §36.8 play-test.

### 2026-11-08 (V3 checkpoint-03b implemented, awaiting Claude's review) — Codex

- Applied the Brock spike on clean `7e7e5de`; patch hash, six audit rows and manifest match. Setup twice, all 936 generated files identical. Gates once each, fully sequential, default workers: typecheck/marker pass; expected bundle `index-TKTuDyGT.js`, 666,444 bytes and SHA256; ROM 6227/6227 (248 files); no-ROM 5939 passed / 288 skipped (235 / 13 files). V1–V10 each failed with AssertionError and were restored; final manifest passes. Hashes, audit, setup, gates and every witness are in note 88 §37 and committed `impl-` logs. Handoff docs/baselines updated. Next: Claude's review (§38), then the user's play-test (§39). No badge/TM yet, as briefed; checkpoint-04 was not started.

### 2026-11-08 (V3 checkpoint-03a closed; 03b briefed for Codex) — Claude (Opus)

- The user's §32.8 play-test: "all is good" (note 88 §35). Traced and spiked 03b: Brock's talk and battle as gym leader 1, the post-battle script reset, 5 text rows, 6 new cases. No badge or `BEAT_BROCK` yet. Spike: bundle `index-TKTuDyGT.js`, ROM 6227/6227, no-ROM 5939/288, V1–V10 each an AssertionError. Briefed in §36; the patch is not applied.

### 2026-11-08 (V3 checkpoint-03a reviewed: passed, two tests added) — Claude (Opus)

- Codex stopped at a gate-order slip of its own (§33). `030d071` equals the spike byte for byte. The review ran the full ordered sequence: bundle `index-DB0JGlo2.js`, ROM 6220/6220, no-ROM 5932/288, V1–V8 each an AssertionError, and finished the deferred handoff docs. Reviewer mutations R5 and R6 found two test gaps (the game's import of the guide, the Jr. Trainer's battle): tests added, ROM 6221/6221, no-ROM 5933/288. Note 88 §34. Next: the user's §32.8 play-test.
