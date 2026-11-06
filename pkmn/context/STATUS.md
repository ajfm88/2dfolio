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

**Last updated:** 2026-11-04 · **Phase:** V (Rebuild the lost work), with Phase A slices in between · **Milestones done:** 5 / 36 (R1 ✅, V1 ✅, A6 ✅, A1 ✅, V2 ✅); A5 in progress (A5a ✅, A5b ✅, A5d ✅, A5c ✅; A5e and A5f left)

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
(notes75–77). **R-SYNC complete (note78, Codex): pret names synchronized.** **04a accepted by Claude 2026-11-04** (note79 §7): ROM6033/6033. **Checkpoint-04 closed 2026-11-04:** 04b accepted (note79 §10; ROM6038/6038) and user play-test passed. Next: plan checkpoint-05 (poof data, note75 §4). Then finish A5e, A5f and V3. Earlier detail is in `HISTORY.md`.

## 📍 Where things stand — updated 2026-11-04 (*Setup* not reinstalled today; refs pulled 2026-11-03 evening, see the `refs/` row)

### Setup — done

| Item | State |
|---|---|
| Git | Root repo, branch `master`, **no remote**. Baseline commit `9bf2d7d` = docs + vanilla upstream. `.gitattributes`: text LF, `*.png`/`*.tilemap`/`*.gbc` binary. `game/.gitattributes` (the user's, tracked since 2026-10-14, DECISIONS #53) repeats those rules for `game/` and adds linguist hints |
| Committed generated files | `game/data/` (196 JSON) + `game/static/` (525 PNG, 3 tilemaps, 196 JSON); R-SYNC setup2026-11-03 changed only the two text-program JSON files by one key, with identical ops. Regenerate, never hand-edit |
| Ignored | `*.gbc`/`*.gb` (the ROM), `refs/`, `pkmn-sprites/`, `node_modules/`, `dist/` |
| `game/LICENSE` | **Removed by the user (2026-09-22): "i want it gone".** Deletion committed with R1c. Don't restore it (DECISIONS #28) |
| ROM | `game/pokeyellow.gbc`, SHA1 `cc7d0326…4a38e1` (DECISIONS #14) — re-verified 2026-09-22 |
| `refs/` | All 5 on pinned branches, refreshed **2026-11-03** with `./pull-refs.sh`: `pokeyellow` master `b452f2ab` (was `e89ead15`, +45: pret named every remaining symbol; ROM unchanged; **R-SYNC complete: 63-name mapping applied; historical readers adapted per note78 section6.1**), `gen1recomp` dev `d85a6176` (was `20ab97ab`, +480), `oldamber` main `268d571` (unchanged), `engine` main `1986dd93` (was `79957401`, +21: Gen 1 `calc.zig`/`chance.zig` and build), `dmg` main `5e3b785` (unchanged). `file:line` citations written before note 78 refer to `e89ead15` |
| `game/` | `gididaf/pokemon-yellow-typescript` `main` @ `05faa114` (2026-03-27), no `.git/`. Upstream `game/CLAUDE.md` folded into root `CLAUDE.md` → *Engine reference*, then deleted; moved on to `context/ARCHITECTURE.md` and the subsystem docs 2026-10-06 (DECISIONS #42) |
| `npm run setup` | 196 JSON → `data/`; static 525 PNG + 3 tilemaps + 196 JSON mirror (A5c3f checkpoint-08g adds `monster_names.json`, note 72 §10.18; setup twice, only the two new name-table files). A5c3e checkpoint-02: setup twice byte-identical across 909 files; three new SFX assets, old bogus flute music removed, four text keys added; all 901 other surviving files unchanged (note 71 §10.2.4) |
| Typecheck | Clean |
| Tests | **04b implemented, gates passed: ROM6038/6038; no-ROM5781 pass / 257 skip**, 239 files, default workers (note79 §9.7). Bundle `index-JN4Ut5jo.js`, 659,202 bytes; SHA256 `da986d0147289732689d52143f9864645654192e2a8e0f2cf95a092a30992843`. Awaiting Claude review and user play-test |

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
| SFX | **21** preloaded, including A5c2 CP2's RUN (bank `$08`, header `$41c5`, ID `$97`; no playback caller yet), the nurse's `healing_machine` and intro animation's preloaded `shrink`. Wired: `press_ab`, `collision`, `start_menu`, `go_inside`/`go_outside`, the two field-medicine sounds, the machine, and shrink. A5c3f checkpoint-02 adds four unused files (`damage`, `not_very_effective`, `super_effective`, `trainer_appeared`); 31 SFX JSON files, 10 unused. Other SFX and bank-aware lookup → V5 |
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
| **A5e through checkpoint-04** ✅ | 04 live silhouette intro (04a `2bb547d`, 04b `090e05b`; review `d19ca04`; user play-test passed 2026-11-04; note79, #96/#97); 01 source inventory/trace;02 LCD-off staging (`115b59d`, review `6c9a822`);03a default-disabled third scroll band (`67e14ee`, review `7f5ddb4`);03b unused Program/raster contract (`6dc2536`+`3c201d9`, review `8861a58`). Sonnet implemented; Codex independently checked. Notes75–77,35 new cases; **A5e itself remains open** |
| **Intro animation** ✅ | Oak's speech frame for frame: BGP/OBP0 palette fades (the silhouette, the white fades), the window slide, the tile slides with the BG-thirds tear, the 7-frame pic copies and the shrink wipe, little Red, `SFX_SHRINK`, the intro music's fade-to-stop, the 20-frame entry and 40-frame white exit. CP1–CP5 by Codex, checked by Claude, **user-verified 2026-10-18**; note 64, DECISIONS #51/#69 |

## In progress

**No active implementation. A5e checkpoint-04 closed 2026-11-04.**
- 04a: Grok 4.7 implemented; Claude accepted (note79 §7).
- 04b: Grok, then Codex after four valid stops ruled in §8.11–§8.14. Claude accepted it (§10), and the user
  play-tested it the same night.
- The live silhouette intro now runs in every battle:
  - the transition's black registers carry into the battle screen;
  - 2 LCD-off dark ticks give the ~3-frame white blink;
  - the real slide; music pauses during the dark ticks.
- ROM6038/6038; no-ROM5781 pass / 257 skip; 239 files. Bundle `index-JN4Ut5jo.js`, 659,202 bytes.

**Restart list (Claude, the planner):**
1. Read root CLAUDE.md, then this handoff.
2. Read note75 §4 (the A5e sequence; checkpoint-05 is next: poof subanimation/frame/coordinate data plus the
   Audio2 ball-poof sound, data only), then note79 §10 (three findings to carry into the next brief), then the
   battle architecture's A5e section.
3. Trace or spike 05, write its brief, and give the user a paste-ready, implementer-neutral prompt. The user picks
   the implementer, usually Codex.

Note75 §4 gives the later checkpoint sequence; checkpoint-03b is accepted in note77 §9. Existing growth,
Pikachu entrance, retreat and slide bodies already work (A5c3f10c); do not re-port them from stale cue prose.
**O-50 answered 2026-11-04 → DECISIONS #94:** attack move animations are a separate future slice; A5e keeps them
OFF and its sub-animation player covers only the traced presentation IDs (poof). The screen-model merge
still waits until after A5e. Catch animations/demo retirement stay A5f; battle VBlank RNG stays backlogged.

**Current A5e workflow (user assignment,2026-11-03):** Codex traces/spikes a checkpoint, captures its whole diff,
restores the tree and briefs stops, exact counts and plain mutation witnesses. Sonnet applies/audits it, runs
ordered gates, reports and commits locally. Codex independently re-runs gates and adds a mutation. Stop at
each review; visible live changes later need the user's play-test. Earlier Claude/Codex assignments are historical.

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
| 1 | **A5e** intros and animations | A | **Checkpoint-04 closed (04b accepted, note79 §10; user play-test passed 2026-11-04). Next: Claude plans checkpoint-05 (poof data, note75 §4), carrying §10's findings.** Parent scope note65 §4 (#70); attack animations excluded (#94). Then **A5f**, the wild catch's animations and catch demo integration |
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

### 2026-11-04 (A5e checkpoint-04b reviewed: accepted) — Claude (Opus)

- Re-ran all gates at 090e05b: ROM6038/6038, no-ROM5781/257, bundle `index-JN4Ut5jo.js` 659,202 bytes, markers PASS.
- Two probes (3 dark frames; no `$FF` registers) both caught. Three non-blocking findings (note79 §10). User play-test passed the same night: checkpoint-04 closed. Next: plan checkpoint-05.

### 2026-11-04 (A5e checkpoint-04b implemented) - Codex

- Applied only §8.14's session register assignment and specified comment; no tests or snapshots changed. Finished note79 §9 and completion docs, including §8.13/§8.14 departures.
- All five ordered gates passed once from game/, default workers: typecheck/build/markers; ROM6038/6038, no-ROM5781/257, 239 files. Bundle `index-JN4Ut5jo.js`, 659,202 bytes (SHA256 in §9.7). 04b implemented, awaiting Claude's review and the user's play-test. Local commit only.

### 2026-11-04 (A5e checkpoint-04b resume; stopped at ROM gate) - Codex

- Applied §8.13's exact copy fix and corrected §9 encoding. Typecheck, build and bundle-marker check passed once from game/; bundle index-BlAefkm4.js, 659,151 bytes (hash in note79 §9.6).
- ROM gate: 6037 pass / 1 fail, 239 files. New production-session test sees 38 white frames, expected 3. Stopped under §8.8 without rerun or no-ROM gate. Completion status deferred.


### 2026-11-04 (A5e checkpoint-04b takeover; stopped) ? Codex

- Confirmed only 11 init snapshot failures; preserved inherited implementation. Applied ?8.12 audit rules; fresh init/start/Route1/pixel audits passed, then updated their snapshots (11/16/1/1). All seven mutations produced assertion witnesses and were restored.
- Typecheck failed TS2769 in inherited presentation code; stopped per explicit user instruction. Remaining gates and completion status deferred. Note79 ?9 records ownership, both previous stops/rulings, current stop and hashes.


### 2026-11-04 (A5e checkpoint-04b briefed; O-51 answered) — Claude (Opus)

- O-51: Pan Docs + SameBoy's hardware-measured LCD code: white while off and for the first frame after LCD-on. Counted Yellow's LCD-off work at ≈ 33,000 M-cycles ≈ 1.88 frames → two `'dark'` ticks, three white presented frames, no sound updates (DECISIONS #97).
- Spike on 04a (reverted; the patch is kept outside the repo; isolated worktrees): 36 failures in 6 files, all classified. Route 1 under a DIV control: result, texts, frames and writes identical shifted +78; no-music audio identical shifted +76 (`compare-route1.py`). Opening-frame pixels: 101 party-ball pixels from the slide's OBP0 `$E4`. Misty passes under the control.
- Wrote note 79 §8 (the 04b brief) and #97. No game code changed. Next: an implementer runs 04b.

### 2026-11-04 (codebase orientation) — Codex

- Read the project guidance, current status and engine/battle architecture. No implementation or tests; 04b remains unstarted.

### 2026-11-04 (A5e checkpoint-04a reviewed and accepted) — Claude (Opus)

- Reviewed `2bb547d`: the diff is exactly note 79 §4; unbound `BattleHost.step()` unchanged; capture and timing off the bundle. Re-ran every gate: identical bundle hash, ROM 6033/6033, no-ROM 5776/257.
- Three extra probes: anchor 153 passes all behavior (confirms 146–153 equivalence), anchor 145 fails 8, a non-copying capture fails 4. Two non-blocking test findings go into 04b's brief (note 79 §7). CLAUDE.md baseline updated. Accepted.

### 2026-11-04 (A5e checkpoint-04a implemented; accepted, see above) — Grok 4.7

- Implemented note 79 §4 only. Serviced boundaries anchor at LY 146. `disableLCD` yields that deferred VBlank as one serviced frame. `BattleHost.bindRaster` seals before VBlank; `IntroRasterCapture` stays off the bundle. No production caller. 04b not started.
- Nine mutations, each a plain AssertionError, restored byte-for-byte (`notes/79-a5e-checkpoint-04a/codex-mutation-*.log`). One type narrowing in the new live test (`Frame` vs `boundary`'s serviced/held), then the ordered gates once: typecheck, build, 09c marker, ROM 6033/6033, no-ROM 5776 pass / 257 skip, 239 files. Bundle `index-pI5Lpy08.js`, 655,527 bytes. Report is note 79 §6.
- Nothing visible changes, so no play-test. Local commit, never pushed. Next: Claude reviews.

### 2026-11-04 (A5e checkpoint-04 planned) — Claude (Opus)

- User moved planning to Claude, implementation to Codex (#95). Traced core.asm/lcd.asm/vblank.asm/oam_dma.asm: post-VBlank
  CPU resumes at LY146+, and DisableLCD's masked VBlank is deferred (serviced), not dropped, which corrects 03b (#96).
- Two throwaway spikes, both reverted: the live switch breaks 34 tests in 4 files (04b, §5.2); the timing correction
  changes exactly 7 of 03b's 21 cases. Wrote note79: trace, 04a brief (14 new tests, 9 mutations), 04b outline.
- Backlog: other DisableLCD ports, O-51. No game code changed. Next: Codex implements 04a.

### 2026-11-04 (O-50 answered) — Claude (Opus)

- Studied the context and code. The user chose a separate slice for attack move animations → DECISIONS #94; added an
  unscheduled queue row and refreshed the O-50 mentions. Docs only, no tests run. Next is unchanged: Codex plans04.
- The user then chose a **full** pret `move_anim` interpreter for that slice: #94 amended, PROJECT's non-goal removed.

### 2026-11-03 (R-SYNC complete after the authorized historical-reader shims) — Codex

- Confirmed ref/baseline; applied141 replacements in50 files and regenerated only two one-key JSON changes. Stopped correctly on four historical-reader failures; resumed with exactly note78 §6.1's four shims. Fixed the stop-entry encoding; frozen history/pin unchanged.
- All resumed gates pass first run/default workers: old-name count8 in the four shims, typecheck, ROM6019/6019, no-ROM5762/257, build. Both mutation witnesses fail as required and restore byte-for-byte. Bundle655,183 bytes; full hash/report in note78 §7.
- Row0 removed; one local slice commit, never pushed. Next is checkpoint-04 planning, still unstarted/unbriefed; O-50 remains open. Logs in `%TEMP%/pkmn-rsync-*.log`; no later checkpoint work.

### 2026-11-03 (refs pulled; pret rename sync planned) — Claude (Opus)

Ran `./pull-refs.sh` at the user's request: pokeyellow +45 (pret named every symbol), gen1recomp +480, engine +21. Full ROM
suite after the pull: **6015/6019**, with 4 `text_programs.test.ts` failures on the renamed `PartyMenuText_12cc`. Scoped every old pret
name our files cite (63 symbols: 141 uses in `game/`, more in notes) and wrote `notes/78-pret-rename-plan.md` as Codex's
executable brief, queued as row 0. No code changed. Checkpoint-04's brief moves to note 79.

### 2026-11-03 (day wrap: all context refreshed; stopped after03b) — Codex

- Updated all seven project context files, root entry point and battle/render docs. Consolidated today's checkpoints, roles, commits, current baseline and04 restart list; archived older STATUS entries and the stale PROJECT state verbatim to HISTORY.
- Final checked state remains note77 §9: ROM6019/6019, no-ROM5762/257, unchanged655166-byte bundle/hash.02/03a/03b accepted; no active implementation,04 unstarted/unbriefed, O-50 open. No runtime/test/data changes or additional test run in this documentation-only wrap.
- User ended the day. Next session: Codex plans04, then Sonnet implements its reviewed brief. Local docs commit, never pushed.

### 2026-11-03 (A5e checkpoint-03b checked and accepted) — Codex

- Independently reviewed both Sonnet commits (`6dc2536`+`3c201d9`) against the source, spec and retained patch. No correctness/scope findings or code fixes. Documented the two-commit process deviation; no runtime import or old test/data/snapshot changes.
- All18 prescribed mutants and an independent omitted hSCY reset fail plain assertions and restore byte-for-byte. Ordered gates pass first time/default workers: typecheck/build/marker, ROM6019/6019, no-ROM5762/257; bundle/hash unchanged. Evidence note77 §9 and `review-*`.
- Accepted only the unused Program/phase contract. Next:04 needs its own real-driver/phase/capture/audio/text trace, spike and brief; not started. O-50 open. Baselines refreshed; oldest entries archived verbatim. Review committed locally, never pushed.

### 2026-11-03 (A5e checkpoint-03b implemented; awaiting Codex review) — Claude Sonnet

- Applied note77's `spike.diff` (SHA256 `4c660457…24cb3`); the three source hashes match. Audited the Program against `core.asm:9–132` (LCD-off staging, 72 iterations from B=$70/C=$90 with split writes at LY64/96, 21 shadow head X −2, hSCX after, tail, HideSprites Y-only) and the §3 timing contract.
- Eighteen mutations each caught by an AssertionError; both sources restored byte-for-byte. Ordered gates pass first time, default workers: typecheck, build, 09c marker, ROM 6019/6019 (238 files), no-ROM 5762 pass/257 skip. Bundle `index-D4Ol9Anq.js` 655,166 bytes, hash unchanged. Logs `notes/77-a5e-checkpoint-03b/sonnet-*`.
- No departures. Two local commits (code+logs, then docs), never pushed. Checkpoint-04 and live wiring not started. O-50 open.

### 2026-11-03 (A5e checkpoint-03b spiked and briefed) — Codex

- Note77 briefs the complete unused silhouette Program and phase-aware raster/capture contract. The LCD wait is zero/one boundary by entry LY; the final raster freezes its upper96 rows before the window opens. Real session/phase/audio/text integration remains04; no live timing approval is inferred from the fixture model.
- Spike:21 cases,18 plain mutation witnesses with byte-for-byte restoration. Ordered gates pass first time/default workers: typecheck/build/marker, ROM6019/6019, no-ROM5762/257; bundle/hash unchanged. Captured patch/logs, removed game files and checked applicability. No implementation landed; baseline remains5998.
- Next: Sonnet implements only note77 and stops for Codex review.04 unbriefed; O-50 open. Oldest entries archived verbatim to HISTORY to keep the live log short. Planning committed locally, never pushed.

### 2026-11-03 (A5e checkpoint-03a checked and accepted) — Codex

- Reviewed `67e14ee` independently against the source, spec and retained spike: no correctness/scope findings; no game changes needed. No live caller enables the field; existing tests/snapshots/data unchanged.
- All seven prescribed mutants and an independent early body-end mutation fail plain assertions and restore byte-for-byte. Ordered gates pass first time/default workers: typecheck/build/marker, ROM5998/5998, no-ROM5741/257; bundle655166 bytes/hash exactly as briefed. Evidence note76 §7 and `review-*`.
- Refreshed checked baseline references, including CLAUDE (no pending user edit), and archived oldest STATUS entries verbatim. Next:03b needs its own trace/spike/brief; not started. O-50 remains open. Local review commit, never pushed.

