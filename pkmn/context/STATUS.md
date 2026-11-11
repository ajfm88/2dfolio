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

**Last updated:** 2026-11-09 · **Phase:** V (Rebuild the lost work), with Phase A slices in between · **Milestones done:** 7 / 36 (R1 ✅, V1 ✅, A6 ✅, A1 ✅, V2 ✅, A5 ✅, V3 ✅); **V4 checkpoint-03 accepted; checkpoint-02 user play-test pending**

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
file and the code, and fix the stale line. V4 checkpoint-02 wires all 30 extracted maps
at runtime. That count is not the lost copy, and the cave is not user-verified.

**Commit policy (user, 2026-09-22):** commit **locally** at the end of every
slice — `git add` + `git commit` from the root, message ending with the
co-author line. **Never push** — there is no remote and there must never be one
(Hard rule #9, DECISIONS #24).

---

## Current phase

**Phase R is done** (2026-09-22). **Phase V** rebuilds the lost 30-map state (V1 ✅ → V2 ✅ → V3 Gym + Museum → V4
Diglett's Cave + Route 3 → V5 fixes), with Phase A slices in between (DECISIONS #29, #35, #55). **A5 closed** 2026-11-07 (note 87 §27). **V3 closed** 2026-11-08 (note 88 §48). V4 checkpoint-01 is accepted (note 89 §7). Checkpoint-02 passed review (§10), user play-test still pending. Checkpoint-03 is accepted after review (§13). Earlier detail is in `HISTORY.md`.

## 📍 Where things stand — updated 2026-11-06 (A5f checkpoint-03; refs pulled 2026-11-03 evening, see the `refs/` row)

### Setup — done

| Item | State |
|---|---|
| Git | Root repo, branch `master`, **no remote**. Baseline commit `9bf2d7d` = docs + vanilla upstream. `.gitattributes`: text LF, `*.png`/`*.tilemap`/`*.gbc` binary. `game/.gitattributes` (the user's, tracked since 2026-10-14, DECISIONS #53) repeats those rules for `game/` and adds linguist hints |
| Committed generated files | `game/data/` (206 JSON) + `game/static/` (527 PNG, 3 tilemaps, 206 JSON). V4 checkpoint-01 adds `maps/DiglettsCave.json` and `maps/DiglettsCaveRoute11.json` (each mirrored) and regenerates text_programs, map_sprite_sets and battle_transitions. V3 checkpoint-04 adds `maps/Route3.json` (mirrored). Regenerate, never hand-edit |
| Ignored | `*.gbc`/`*.gb` (the ROM), `refs/`, `pkmn-sprites/`, `node_modules/`, `dist/` |
| `game/LICENSE` | **Removed by the user (2026-09-22): "i want it gone".** Deletion committed with R1c. Don't restore it (DECISIONS #28) |
| ROM | `game/pokeyellow.gbc`, SHA1 `cc7d0326…4a38e1` (DECISIONS #14) — re-verified 2026-09-22 |
| `refs/` | All 5 on pinned branches, refreshed **2026-11-03** with `./pull-refs.sh`: `pokeyellow` master `b452f2ab` (was `e89ead15`, +45: pret named every remaining symbol; ROM unchanged; **R-SYNC complete: 63-name mapping applied; historical readers adapted per note78 section6.1**), `gen1recomp` dev `d85a6176` (was `20ab97ab`, +480), `oldamber` main `268d571` (unchanged), `engine` main `1986dd93` (was `79957401`, +21: Gen 1 `calc.zig`/`chance.zig` and build), `dmg` main `5e3b785` (unchanged). `file:line` citations written before note 78 refer to `e89ead15` |
| `game/` | `gididaf/pokemon-yellow-typescript` `main` @ `05faa114` (2026-03-27), no `.git/`. Upstream `game/CLAUDE.md` folded into root `CLAUDE.md` → *Engine reference*, then deleted; moved on to `context/ARCHITECTURE.md` and the subsystem docs 2026-10-06 (DECISIONS #42) |
| `npm run setup` | 206 JSON → `data/`; static 527 PNG + 3 tilemaps + 206 JSON mirror. V4 checkpoint-03 (2026-11-09): setup twice, all 942 generated files unchanged from checkpoint-02. |
| Typecheck | Clean |
| Tests | **V4 checkpoint-03 review passed 2026-11-09 (note 89 §13).** ROM 6299/6299; no-ROM 6007 pass / 292 skip, 252 files (239 passed / 13 skipped), default workers. Bundle `index-CoPfOLj1.js`, 669,049 bytes; SHA256 `dd682f9331feed3f23aa63686e4773b11d670660fb510e122d97103d3a0138e2` |

### What the game has today (upstream audited 2026-09-22, plus every slice since)

| Area | State |
|---|---|
| Runtime data path | ✅ **No ROM** (R1b): the browser loads only `static/` via plain `fetch()` / `<img>`. Upstream's upload gate is deleted; the bundle has no gate code |
| Vite | `publicDir: 'static'`, `base: '/'`, `appType: 'mpa'` (missing file = real 404). Tab title **PKMN** |
| Background tabs | ✅ keeps running unfocused — logic + music (worker ticker, DECISIONS #27). User-verified |
| Maps | **12 playable**: PalletTown, RedsHouse1F/2F, BluesHouse, OaksLab, Route1, Route22, ViridianCity, ViridianPokecenter, ViridianMart, ViridianSchoolHouse, ViridianNicknameHouse. **+7 playable through the debug warps since V1b:** Route2, Route2Gate, Route2TradeHouse, DiglettsCaveRoute2, ViridianForest, ViridianForestSouthGate/NorthGate, with music, palette and Pikachu. **Since V1e the walking path is open:** Viridian → Route 2 → the Forest, once the old man's demo is done. **+5 since V2a:** PewterCity, PewterPokecenter, PewterMart, PewterNidoranHouse, PewterSpeechHouse, reached from Route 2's north edge. **+3 since V3 checkpoint-01:** Museum1F, Museum2F, PewterGym (27 maps). Museum and Gym doors now reachable; the Museum ticket (checkpoint-02a) is closed; the Old Amber and the 2F hiker (checkpoint-02b) are closed; fossil pop-ups (checkpoint-02c) are closed; Brock's talk and battle (checkpoint-03b) are closed. Checkpoint-05 awards the Boulder Badge and TM34 (closed). **+1 since V3 checkpoint-04:** Route3 (28 maps), reached by the debug warp at (4,9). Pewter's east connection to Route3 is open once Brock is beaten; before that the guide still blocks the walk. Route4 stays unextracted and unnamed, so Route3's north edge is the native tree border. **V4 checkpoint-02 wires DiglettsCave and DiglettsCaveRoute11 (30 runtime-wired maps).** Dungeon2 music, CAVE palette, ladders, the gambler program, CAVERN land pairs and the failed Route11 exits are in. Not user-verified. Route11 outdoors is not extracted. |
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
| Trainer sight | ✅ **A1c, user-verified 2026-10-06** (`notes/20-a1c-plan.md`, DECISIONS #43): the Forest's map script runs `TrainerEngage` on standing passes ($fc quirk, pop-in), the meet music at spotting, EmotionBubble (61 frames), the `MoveSprite` walk-up, `wJoyIgnore`/`BIT_SEEN_BY_TRAINER`, `EndTrainerBattle`'s pass. Forest sight ranges 4, 4, 1, 0, 4. Checkpoint-03 exposes the hop-midpoint map-script boundary; trainer interruption and the tripwire stay until checkpoint-04. |
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
| **A5f** ✅ | The wild catch and the catch demos: ball animation data, the toss/shake effects, live ball animations, the demos as real battles, the old renderer retired. Checkpoints 01–05, Grok and Codex, each checked by Claude, **user-verified 2026-11-07**; note 87, DECISIONS #105 |
| **Intro animation** ✅ | Oak's speech frame for frame: BGP/OBP0 palette fades (the silhouette, the white fades), the window slide, the tile slides with the BG-thirds tear, the 7-frame pic copies and the shrink wipe, little Red, `SFX_SHRINK`, the intro music's fade-to-stop, the 20-frame entry and 40-frame white exit. CP1–CP5 by Codex, checked by Claude, **user-verified 2026-10-18**; note 64, DECISIONS #51/#69 |

## In progress

**End-of-day handoff, 2026-11-09.** V4 checkpoint-03 is accepted after review (Grok `d6bc442`, review `66b6d26`, note89 §13). Checkpoint-02 review passed (`b986256`, note89 §10). **The user began testing but did not report completion of §8.7; checkpoint-02 remains pending user acceptance.** They confirmed silent opponent cries; read-only ASM/code audit found the existing empty cry callback, logged in note57 (`9c1d9d6`). No audio fix or checkpoint-04 work. All 942 generated files unchanged; trainer guard, tripwire and Route3 proof remain. Dev server stopped for the day. V4 stays open.

**Restart list for the next session:**
1. **Resume the user play-test of checkpoint-02**, note89 §8.7, including Route3. Restart from game/: `npx vite --host 127.0.0.1 --port 5173 --strictPort`. Let the user drive; record their actual report before closing checkpoint-02. Checkpoint-03 is accepted; checkpoint-04 needs its own plan and was not started. Do not remove the trainer gate or close V4.
2. Route 3's trainers, grass, ledges and north edge have tests and a review, but no recorded play-test (note 88 §44). Walk them in the §8.7 play-test.
3. Silent battle cries are confirmed and already backlogged (note57, J2); opponent send-out is growth then cry, without the player's poof animation. Do not add an enemy ball-poof sound to compensate. The user has not assigned an audio implementation slice or changed its sequencing.

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
| 1 | **V4** Diglett's Cave + the rest of Route 3 | V | Checkpoint-03 accepted after review (§13). Checkpoint-02's user §8.7 play-test pending. Checkpoint-04 retains trainer interruption and tripwire retirement (#108); needs a separate plan. No V4 closure yet |
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

### 2026-11-09 (end-of-day context handoff) — Codex

- User ended the session and requested context updates. Refreshed PROJECT's stale V3 summary to the live V4 state and recorded restart instructions. Checkpoints 01–03 passed code review; checkpoint-02 cave/Route3 play-test remains incomplete, with only the silent-cry observation confirmed. Cries remain an existing deferred audio feature, not an implemented fix. Dev server stopped. No checkpoint-04 work or V4 closure. No new code/tests in this docs-only wrap-up; current baseline remains ROM 6299/6299 and no-ROM 6007/292.

### 2026-11-09 (user play-test observation: silent opponent send-outs) — Codex

- Read-only ASM/code check confirms the user's missing opponent cries: live voice.cry is a no-op, as already deferred in note57 to J2. Trainer send-out has silent growth then PlayCry in ASM; it does not use the player's ball-poof animation/sound. Logged the live confirmation and exact source owners in note57. No game change or tests needed for this source check; dev server remains running and the user's checkpoint-02 play-test is still in progress, with no acceptance inferred.

### 2026-11-09 (V4 checkpoint-03 reviewed: passed; checkpoint-02 play-test handed over) — Codex

- Reviewed `d6bc442`: exact spike bytes and independent source/geometry audit. Setup twice unchanged (942 hashes), ordered gates reproduce bundle and ROM 6299/6299 / no-ROM 6007/292; V1–V5 and independent R1/R2 caught and restored. No code/test change needed. Note89 §13 accepts checkpoint-03; checkpoint-04 not started. At the user's request, started Vite at 127.0.0.1:5173 and handed over §8.7 for checkpoint-02; no play-test result inferred. Archived oldest four log entries verbatim to HISTORY.

### 2026-11-09 (V4 checkpoint-03 implemented, awaiting review) — Grok

- Applied `03-spike.diff` on clean `1497811`. Setup twice: all 942 generated files unchanged. Gates once each: typecheck pass, bundle `index-CoPfOLj1.js` 669,049 bytes, ROM 6299/6299 (252 files), no-ROM 6007 passed / 292 skipped (239 / 13 files), marker pass. V1–V5 each an AssertionError and restored. The busy-trainer guard and Route3 proof stay. Report is note 89 §12. Next: independent review. Checkpoint-04 was not started. Checkpoint-02's user play-test is still pending.

### 2026-11-09 (V4 checkpoint-03 planned for Grok) — Codex

- At the user's explicit follow-up, traced and spiked the next boundary foundation after checkpoint-02's clean review. Split interruption aftermath into checkpoint-04 (#108). Six source/test files, seven no-ROM cases; setup twice with all 942 hashes unchanged. Ordered gates: ROM 6299/6299, no-ROM 6007/292, bundle index-CoPfOLj1.js (669,049 bytes); V1–V5 caught, clean roundtrip and source restored. Ordinary trigger geometry has no new midpoint candidates; Viridian's Gym square is an already-checked source. Brief: note89 §11. Next: Grok implements only that foundation. Checkpoint-02 user play-test remains pending.

### 2026-11-09 (V4 checkpoint-02 reviewed: passed, assertions strengthened) — Codex

- Reviewed `a34a3fe`: exact spike bytes, source audit and original gates reproduced. R1/R3 initially survived; pinned border-reload palette order and added a tileset-scope case. Final ordered gates: unchanged bundle, all 942 generated hashes unchanged, ROM 6292/6292, no-ROM 6000/292; V1–V9 and R1–R3 caught and restored. No production change. Note89 §10; user's §8.7 play-test is pending. User explicitly requests checkpoint-03 planning next if review is clean. Archived the oldest four log entries verbatim to HISTORY to keep STATUS short.

### 2026-11-09 (V4 checkpoint-02 implemented, awaiting review) — Grok

- Applied `02-spike.diff` on clean `3577666`. Setup twice: all 942 generated files unchanged. Gates once each: typecheck pass, bundle `index-Bb9iGKew.js` 668,859 bytes, ROM 6291/6291 (251 files), no-ROM 5999 passed / 292 skipped (238 / 13 files), marker pass. V1–V9 each an AssertionError and restored. Report is note 89 §9. Next: independent review, then the user's §8.7 play-test. Checkpoint-03 was not started.

### 2026-11-09 (V4 checkpoint-02 planned for Grok) — Codex

- Traced and spiked cave runtime (note89 §8): seven source/test files, 23 no-ROM cases, no generated changes. Fixed in the spike the missing CAVERN land pairs, gambler's flattened fallback and failed-load palette/font leak; Forest/water pair omissions are backlogged in note57. Setup twice: all 942 hashes unchanged. Sequential gates: ROM 6291/6291, no-ROM 5999/292, bundle index-Bb9iGKew.js (668,859 bytes); V1–V9 caught, clean roundtrip and source restored. Next: Grok implements §8; independent review and user play-test follow. No checkpoint-03 work.

### 2026-11-09 (V4 checkpoint-01 reviewed: passed) — Codex

- Reviewed Grok's `bef9884`: exact spike bytes, direct ASM/ROM audit, setup twice with all 942 hashes reproduced. Sequential gates pass: unchanged bundle, ROM 6268/6268, no-ROM 5976/292. V1–V5 and independent R1/R2 each fail with AssertionError and restore; final manifest passes. No game changes needed. Note89 §7 accepts checkpoint-01; next is checkpoint-02 planning, not implementation. Oldest four STATUS session entries archived verbatim to HISTORY to keep the handoff short.

### 2026-11-09 (V4 checkpoint-01 implemented, awaiting review) — Grok

- Applied `01-spike.diff` on clean `4f85be8`. Setup twice: 942 generated files identical to the spike. Gates once each: typecheck pass, bundle `index-DtAwi9SA.js` unchanged, ROM 6268/6268 (250 files), no-ROM 5976 passed / 292 skipped (237 / 13 files). V1–V5 each an AssertionError and restored. Manifest passed before and after. Report is note 89 §6. Next: independent review. Checkpoint-02 was not started.

### 2026-11-09 (V4 checkpoint-01 planned for Grok) — Codex

- Traced the two remaining cave maps, symbols, ladders and Route11 LAST_MAP override; scoped V4 into extraction, runtime acceptance and hop-midpoint checkpoints (note89). Spiked checkpoint-01, verified regeneration/gates/mutations and restored game source/data. Exact implementation brief and evidence are in note89 §4–§5. Next: Grok applies checkpoint-01, verifies and commits; independent review follows. V4 stays open and Route3's play-test reminder remains for checkpoint-02.

### 2026-11-09 (context and codebase orientation) — Codex

- Read the entry-point rules, current handoff, project context and subsystem references; traced startup, the tick loop, overworld dispatch, battle-session wiring, scripts, extraction and test setup. No implementation slice claimed and no game code changed; tests were not run for this read-through. Next remains planning V4, including the Route 3 play-test reminder above.
