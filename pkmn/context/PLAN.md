# PLAN — 34 milestones to a complete ROM-free Pokemon Yellow

Status legend: ✅ done · 🔨 in progress · ⬜ pending

**Live status is not here.** This file is the map. What is actually done, in
progress, and next lives in `STATUS.md` — read that first.

## ⚠ These are milestones, not sessions (2026-09-05)

The user's stated expectation is **one to two years, on the order of 700–800
sessions** (DECISIONS #21), all of it on vanilla Yellow sprites. Read the 34
below as the *shape* of the work (the ordered list of gates that make a 1:1
Yellow), not as 34 sittings.

A slice like **D4 (Rocket Hideout)** is a whole area: four floors, spinner tiles,
a Lift Key, an elevator, a Giovanni fight. That is many sessions. **Split freely**
with letter suffixes (`D4a`, `D4b`, `D4c`…), log each split in `STATUS.md`, and
don't treat a milestone as failed because it took ten sittings — that is the
expected rate. What matters is that every session ends with something verifiable,
**committed locally**, and logged.

So: a **session** is one focused sitting, atomic — claim one unit of work, finish
it, commit it, log it, stop. A **slice/milestone** below is a gate you may need
many sessions to reach.

**History of this plan:** 90 slices (2026-08-02) → 28 (2026-08-04, R1–X2) → 33
(2026-09-22): the July–August code was lost, so **Phase V** (5 slices) was added
to rebuild it, and R1 was split into R1a–c (DECISIONS #26). The docs said "29"
and then "34"; both were one too many (R1 + 27 rows A1–X2 = 28), corrected
2026-09-22. Count R1 once — its three slices are one milestone. The same day the
V1 plan added **A4 in-game trades**, which makes **34** (DECISIONS #29).

---

## Starting point (2026-09-22)

`game/` is **vanilla** `gididaf/pokemon-yellow-typescript` @ `05faa114`:
12 maps (Pallet, Reds/Blues houses, Oak's Lab, Route 1, Route 22, Viridian City
+ 4 buildings), typecheck clean, **375/375** tests, and a **ROM upload gate** —
the browser still extracts everything from the ROM at runtime. Full audit in
`STATUS.md` → *What the game has today*. Baseline commit `9bf2d7d`.

The earlier work that reached 30 maps is gone; it is listed, with where each
piece gets rebuilt, in `HISTORY.md` → *Prior work — code lost*.

---

## Phase map

| Phase | Slices | Theme | Gate |
|---|---|---|---|
| **R** ✅ | R1 (a–c) | Commit extracted data — permanent ROM-free | a fresh clone plays with no ROM and no setup — **passed 2026-09-22** |
| **V** | V1–V5 | Rebuild the lost work | 30 maps, Brock beatable, Psychic fix + SFX back |
| **A** | A1–A4 | Core systems the upstream engine lacks | item balls, trainer sight, TMs, field effects, in-game trades |
| **B** | B1–B2 | Mt. Moon → Cerulean | Misty beaten, S.S. Ticket obtained |
| **C** | C1–C3 | Vermilion | have Cut, Lt. Surge beaten |
| **D** | D1–D5 | Lavender + Celadon | have Silph Scope, Erika beaten, Poke Flute |
| **E** | E1–E2 | Systems catch-up | PC/fishing/evolution/Snorlax work |
| **F** | F1–F2 | Fuchsia + Safari Zone | Koga beaten, have Surf/Strength/Fly |
| **G** | G1–G2 | Saffron | Silph Co cleared, Sabrina beaten |
| **H** | H1–H2 | Sea routes + Cinnabar | Articuno, Blaine beaten, 7 badges |
| **I** | I1–I2 | Victory Road + Champion | credits roll — game beatable |
| **J** | J1–J2 | Postgame + polish | Mewtwo, Zapdos, full audit |
| **X** | X1–X2 | Extras: randomizer + deploy | DEAD LAST — optional, may never happen |

**Critical path:** R makes the game ROM-free. V gets back to where the lost work
was. A adds the core systems every later area needs. B–I follow the story in
order. J is postgame. **The game is done at J2** — on vanilla ROM sprites. X is
optional year-two extras that may never happen.

---

## Phase R — Commit Extracted Data (1 milestone, 3 slices)

Goal: make the game permanently ROM-free. The ROM (`game/pokeyellow.gbc`) is used
during development to extract; the output is committed so the product needs no
ROM at all. Upstream extracts **in the browser** from an uploaded ROM, and its
`npm run setup` wrote JSON only — no PNG existed on disk. That is why R1 is three
slices. **✅ Phase R done 2026-09-22** — setup writes `static/`, the browser loads
only those files (ROM gate deleted), the data is committed, and a fresh clone
with no ROM installs, tests, builds and plays (incl. save → CONTINUE). Also: the
game keeps running in background tabs (DECISIONS #27). 381 tests.

| ID | Slice | Verify |
|---|---|---|
| R1a ✅ | **Export graphics** (extraction side only) — `npm run setup` also writes `static/`: call the browser's own `extractRom()` from Node, write every `ImageData` as a lossless PNG at its exact URL key, `.tilemap` binaries verbatim, mirror `data/` JSON | test: every PNG decodes pixel-identical to its `ImageData`; setup twice → byte-identical; typecheck + 375 |
| R1b ✅ | **Browser runs from files** (engine side only) — `vite.config.ts` `publicDir: 'static'`, `base: '/'`; delete the ROM gate in `main.ts` `init()`; tab title PKMN. `src/rom/` stays | `127.0.0.1:5173`: title → Oak intro → Pallet → Pikachu → Route 1 battle → Viridian → heal → save → reload → CONTINUE, zero failed requests, no ROM prompt |
| R1c ✅ | **Commit the data** — un-ignore `data/` + `static/` in `game/.gitignore`; root `.gitattributes` (`*.png binary`, `*.tilemap binary`, `*.sh text eol=lf`); commit | `git clone` the local repo to scratch → `npm install` → `npm test` (no `ROM_PATH`) → `npx vite` plays. **Phase R gate** |

### R-phase notes

- `src/rom/` stays as the extraction system and schema authority (Hard rule #6,
  DECISIONS #4). Since R1b the browser no longer imports its runtime files
  (`upload_ui.ts`, `rom_cache.ts`, `data_provider.ts`).
- `data/` stays the vitest source; `static/` is the Vite `publicDir` (DECISIONS #16).
- The ROM itself stays ignored (`*.gbc`, `*.gb`).

---

## Phase V — Rebuild the lost work (5 slices)

Goal: get back to where the lost July–August code was (30 maps, Brock, SFX,
Psychic fix), on the committed-data pipeline from Phase R. Comes **before** A
because A's verify steps need Route 2, the Forest and Brock. The exception is A1,
which runs right after V1 (DECISIONS #29). Each slice is likely several sessions —
split freely.

| ID | Slice | Verify |
|---|---|---|
| V1 🔨 | **Route 2 + Viridian Forest** — Route2, Route2Gate, Route2TradeHouse, DiglettsCaveRoute2, ViridianForest, ViridianForestSouthGate/NorthGate; Viridian north connection; replace the upstream demo gate (Viridian old man, "as far as the demo goes") with the real ASM behavior; Forest trainers battle when talked to; music + debug warps. **Five slices (DECISIONS #29, detail in `notes/v1-plan.md`):** V1a ✅ (2026-09-22) extract the maps + trainer data → V1b ✅ (2026-09-22) make them playable (music, palettes, warps, Pikachu spawn states, facing kept through warps; Oak's Aide moved to A2) → V1c trainer battles per `home/trainers.asm` → V1d catch-demo battle type (old man + Oak's Pikachu) → V1e the real old man, removing both demo gates (Viridian + Route 22's fake Blue) | walk Viridian → Route 2 → Forest → north gate; battle a Bug Catcher |
| V2 ⬜ | **Pewter City** — PewterCity, PewterPokecenter, PewterMart, PewterNidoranHouse, PewterSpeechHouse; Route 2 ↔ Pewter connection; city scripts per ASM | enter Pewter from the Forest; heal; shop; talk to every NPC |
| V3 ⬜ | **Pewter Gym + Museum** — PewterGym (Jr. Trainer, Brock; BADGE_1 on win, gym-leader music), Museum1F/2F (admission, Old Amber per ASM) | beat Brock → BADGE_1 on the trainer card; ATK boost applies in the next battle |
| V4 ⬜ | **Diglett's Cave + Route 3** — DiglettsCave, DiglettsCaveRoute11 (entrance building; Route 11 outdoors is F1), Route3 + trainers; Pewter east exit | walk the cave end to end; Route 3 trainers battle |
| V5 ⬜ | **Recovered fixes** — PSYCHIC asymmetric type chart as a post-processing step (DECISIONS #10, bug re-confirmed 2026-09-22); SFX catch-up (expand `SFX_HEADERS` from pret `audio/sfx`, wire call sites per ASM: faint, level up, heal, ball, save, shop, ledge, items…); resolve O-5 (sim FPS default); *candidate:* trim the 16×768 overworld sheets and padded tileset reads to pret's true sizes (`notes/r1a-graphics-export.md` — changes engine input, so verify every map) | Bug move vs Psychic mon = super effective; each wired SFX plays at its ASM trigger |

---

## Phase A — Core systems (4 slices)

Re-scoped 2026-09-22 against what upstream **already has**: whiteout
(`handleBlackoutWarp`), badge stat boosts, hidden-item pickup, the trainer
line-of-sight engine and `trainer_approach` state all work. What's missing:

| ID | Slice | Verify |
|---|---|---|
| A1 ⬜ | **Item balls + trainer sight data** — **runs right after V1, before V2** (DECISIONS #29). Visible item balls become collectible and stay gone once taken (V1a already emits each ball's `item`). Populate each trainer's `sightRange` from the trainer header V1a already parses, and check the existing sight engine against `engine/overworld/trainer_sight.asm` | pick up an item ball in Viridian Forest; step into a Bug Catcher's line of sight → approach + battle |
| A2 ⬜ | **Gym rewards + TM/HM teaching** — TM/HM items in the bag (none exist yet: machine names via `GetMachineName`, the `TechnicalMachines` table, HMs untossable); TM gifts after gym wins (Brock → TM34); teach TMs/HMs from the bag with ASM compatibility checks; USEDTMHM Pikachu happiness. **Plus Oak's Aide** in Route2Gate (HM05 for 10 owned, `OaksAideScript` — reusable for the later aides; moved here from V1b, DECISIONS #30) | beat Brock → receive TM34; teach it to a compatible mon; incompatible refused; Oak's Aide gives HM05 with 10 owned and refuses with fewer |
| A3 ⬜ | **Field effects** — overworld poison damage per `engine/events/poison.asm` (+ PSNFNT happiness), Repel step counter, Escape Rope; re-verify whiteout | poisoned mon loses HP while walking; Repel suppresses weaker encounters; Escape Rope exits the Forest/cave |
| A4 ⬜ | **In-game trades** (DECISIONS #29) — `DoInGameTradeDialogue` (`engine/events/in_game_trades.asm`, table `data/events/trades.asm`): the dialogue sets, choosing a party mon, the trade animation, and the received mon's nickname and OT. Yellow uses 7 trades: Route 2 trade house (Clefairy → Mr. Mime "MILES"), Route 11 gate 2F, Underground Path Route 5, Route 18 gate 2F, and 3 in the Cinnabar Lab. Must land before B1, the first point where the player can have a Clefairy | trade a Clefairy in the Route 2 trade house → receive "MILES"; talking again gives the after-trade text; the wrong species is refused |

## Phase B — Mt. Moon → Cerulean (2 slices)

| ID | Slice | Verify |
|---|---|---|
| B1 ⬜ | **Mt. Moon** — Route 4, Mt Moon 1F/B1F/B2F; cave trainers, items, Rockets, fossil choice event | enter Mt Moon; battle trainers; choose Dome or Helix Fossil; exit east |
| B2 ⬜ | **Cerulean City** — city + buildings, Misty (Cascade Badge + TM11), Route 24 Nugget Bridge, Route 25 + Bill → S.S. Ticket, BikeShop | beat Misty; cross Nugget Bridge; help Bill → S.S. Ticket |

## Phase C — Vermilion (3 slices)

| ID | Slice | Verify |
|---|---|---|
| C1 ⬜ | **Travel + city** — Routes 5/6, Underground Path, Saffron gates (locked), Vermilion City + buildings, Fan Club | walk Cerulean → underground → Vermilion; all buildings; get Bike Voucher |
| C2 ⬜ | **S.S. Anne** — all floors + NPCs, Rival battle on 2F, Captain → HM01 Cut; ship departs | board with ticket; beat Rival; receive HM01 |
| C3 ⬜ | **Cut + Lt. Surge** — field Cut mechanic (badge-gated), tree cutting in overworld; Vermilion Gym trash can puzzle, Thunder Badge + TM24 | teach Cut; cut tree; solve trash cans; beat Surge → badge + TM |

## Phase D — Lavender + Celadon (5 slices)

| ID | Slice | Verify |
|---|---|---|
| D1 ⬜ | **Routes + Rock Tunnel** — Routes 7-10, HM Flash (cave darkness + badge-gated), Rock Tunnel 1F + B1F, arrive Lavender | walk east from Cerulean; Flash in cave; exit to Lavender |
| D2 ⬜ | **Pokemon Tower** — Lavender Town + buildings, Tower 1F-6F: Rival on 2F, ghost floors, channelers | enter Tower; beat Rival; ghosts unbeatable without Silph Scope |
| D3 ⬜ | **Celadon City + Gym** — Routes 7-8, city + buildings, Dept Store (6 floors), Mansion + Eevee, Erika (Rainbow Badge + TM21) | buy Fresh Water; get Eevee; cut tree to gym; beat Erika |
| D4 ⬜ | **Rocket Hideout** — Game Corner, prize room; Hideout B1F-B4F (spinner tiles, Lift Key, elevator); Giovanni → Silph Scope | navigate spinners; beat Giovanni → Silph Scope |
| D5 ⬜ | **Tower endgame** — Tower 7F: Silph Scope reveals ghosts, Marowak battle, Rockets, Mr. Fuji rescue → Poke Flute | use Scope; beat Marowak ghost; rescue Fuji → Poke Flute |

## Phase E — Systems Catch-Up (2 slices)

| ID | Slice | Verify |
|---|---|---|
| E1 ⬜ | **Key items + Snorlax** — Silph Scope ghost reveal, Poke Flute wakes Snorlax on Routes 12 and 16 | use Flute on Snorlax → battle; road clears |
| E2 ⬜ | **PC + fishing + evolution + misc** — Bill's PC deposit/withdraw/release (upstream has a PC menu — audit first), fishing rods (Old/Good/Super), stone + trade evolution (level-up evolution already works), Daycare, Name Rater; DEPOSITED Pikachu happiness | deposit Pokemon; fish on water; evolve Eevee with Water Stone |

## Phase F — Fuchsia + Safari Zone (2 slices)

| ID | Slice | Verify |
|---|---|---|
| F1 ⬜ | **Routes to Fuchsia + Koga** — Routes 11-18 (both east and west paths; Route 11 also opens the Diglett's Cave east exit from V4), Fuchsia City + buildings, Koga (Soul Badge + TM06) | walk both paths to Fuchsia; navigate invisible walls; beat Koga |
| F2 ⬜ | **Safari Zone + HMs** — Safari mechanics (500¥, 30 balls, 600 steps, Bait/Rock), all 4 areas, Gold Teeth → HM04 Strength, Secret House → HM03 Surf, Route 16 → HM02 Fly | enter Safari; find HMs; Surf on water; push boulder; Fly to city |

## Phase G — Saffron (2 slices)

| ID | Slice | Verify |
|---|---|---|
| G1 ⬜ | **Silph Co** — Saffron City + buildings (guards cleared), Silph Co all 11 floors: Card Key, warp tiles, Rockets, Rival, Giovanni → Master Ball + Lapras gift | navigate warp tiles; beat Rival + Giovanni → Master Ball; talk NPC → Lapras |
| G2 ⬜ | **Sabrina + Fighting Dojo** — Sabrina's Gym (teleporter puzzle), Marsh Badge + TM46; Fighting Dojo (5 trainers, Hitmonlee/Hitmonchan choice); Copycat → Poke Doll trade | navigate teleporters; beat Sabrina; choose fighting Pokemon |

## Phase H — Sea Routes + Cinnabar (2 slices)

| ID | Slice | Verify |
|---|---|---|
| H1 ⬜ | **Sea routes + Seafoam** — Routes 19-20 (Surf south from Fuchsia), swimmers; Seafoam Islands all floors, Strength boulder puzzles, Articuno | Surf south; push boulders; battle/catch Articuno |
| H2 ⬜ | **Cinnabar** — Route 21, Cinnabar Island + buildings, Pokemon Mansion (4 floors, switch puzzles, Secret Key), Blaine (Volcano Badge + TM38), Fossil Lab (revival) | find Secret Key; beat Blaine; revive fossil |

## Phase I — Victory Road + Champion (2 slices)

| ID | Slice | Verify |
|---|---|---|
| I1 ⬜ | **Victory Road** — Viridian Gym (Giovanni, Earth Badge + TM27), Route 22 (real Rival battle) + Route22Gate, Route 23 (8 badge gates), Victory Road 1F-3F + Moltres | beat Giovanni → 8th badge; pass gates; catch Moltres |
| I2 ⬜ | **Elite Four + Champion** — Lorelei, Bruno, Agatha, Lance (continuous gauntlet, no Pokecenter); Champion Rival; Hall of Fame + credits | beat all four + Champion → credits → THE END |

## Phase J — Postgame + Polish (2 slices)

| ID | Slice | Verify |
|---|---|---|
| J1 ⬜ | **Legendary caves** — Cerulean Cave (3 floors, unlocked after Champion), Mewtwo; Power Plant (Surf from Route 10), Zapdos | enter caves; battle/catch Mewtwo and Zapdos |
| J2 ⬜ | **Full audit** — Town Map location tracking, Pokedex area/rating, Options menu, Pokemon cries; decide with the user which of upstream's non-vanilla additions stay (Skip-intro prompt, FPS keys, debug overlay, touch controls — `STATUS.md` → *Notes for later*); full playthrough Pallet → credits → postgame; document any gaps | play start to finish; every gap logged and fixed |

## Phase X — Extras (2 slices, DEAD LAST — optional, year two)

Neither of these is part of the deliverable. The game is **done** when I2 rolls
the credits and J2 finds no gaps — on vanilla ROM sprites, playing locally. X1 and
X2 are things the user may want afterwards, and it is fine if they never happen.
Do not start either, and do not shape earlier work around them.

| ID | Slice | Verify |
|---|---|---|
| X1 ⬜ | **Sprite randomizer** *(optional; the one deviation from vanilla we'd eventually like)*. Pool = 6 sets (Gen1 red-blue/red-green/yellow + Gen2 gold/silver/crystal, dex 0001–0151). **Roll per battle encounter, not per save** — no seed persisted. Full-color bypass path in `loadPokemonSprites`, cache re-keyed to include the variant, 48×48 Gen2 backs handled, debug overlay | same Rattata looks different across encounters; toggle shows real/randomized; battle logic unaffected. DECISIONS #21–#23 |
| X2 ⬜ | **Deploy** — `npm run build`; publish `dist/` to Netlify; verify play + save on deployed URL. Needs the user's explicit go-ahead: the git repo itself stays local-only regardless (DECISIONS #24) | game loads and saves on Netlify URL |

---

## Sequencing notes

- **Phase R** makes the game ROM-free in three slices: export files (R1a), run
  from files (R1b), commit them (R1c). After R1c a fresh clone needs no ROM and
  no setup.
- **Phase V** rebuilds the lost 30-map state before Phase A, because A's verify
  steps use Route 2, the Forest and Brock.
- **Phase A** adds only what upstream lacks (re-audited 2026-09-22 — see its
  intro). Audit again before claiming: the engine may already do part of a slice.
  **A1 runs right after V1** (DECISIONS #29), so every map from Pewter on is built
  with trainer sight and item balls working. The order is V1 → A1 → V2–V5 → A2–A4 →
  B. A4 (trades) only has to land before B1.
- **Phases B–I follow the game's story order.** Each area depends on items and
  events from the previous one.
- **Map expansion pattern (V, B–I):** add the map to `EXTRACTABLE_MAPS` +
  `MAP_METADATA` in `src/rom/extractors/maps.ts` and `MAP_TEXT_PTRS` in
  `src/rom/rom_offsets.ts`; re-run `npm run setup pokeyellow.gbc` (rewrites `data/` +
  `static/`); add `MAP_MUSIC` (and `OUTDOOR_MAPS` for outdoor
  maps) in `main.ts`, a debug warp in `debug.ts`; wire scripts/events; verify;
  commit the new extracted output with the code.
- **D5 depends on D4.** Pokemon Tower endgame requires Silph Scope from
  Rocket Hideout. Do D1-D4, then D5.
- **Phase E is a system catch-up.** PC, fishing, evolution positioned here
  because the story now requires them.
- **Phase F unlocks the late game.** Surf, Strength, Fly from Safari Zone
  open water routes, boulder puzzles, and fast travel.
- **Phase X is DEAD LAST and optional.** User directive, reaffirmed 2026-09-06:
  build the whole game on vanilla Yellow sprites first — "we can just start with
  yellow sprites and work on those for 700 or 800 slices". The randomizer is a
  year-two idea; deploy waits until the user says the product is done. Nothing
  before X may be shaped around either.
- **When a slice exceeds one session,** split it with a letter suffix (`D4a`,
  `D4b`), log the split in the tracker, and note it in `DECISIONS.md`.
