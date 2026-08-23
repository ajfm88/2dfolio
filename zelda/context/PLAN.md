# PLAN — 45 slices to a playable browser build

Status legend: ✅ done · 🔨 in progress · ⬜ pending

**Live status is not here.** This file is the map. What is actually done, in
progress, and next lives in `context/agent/01-progress-tracker.md` — read that
first.

A **slice** is one focused agent session, sized so it ends with something
demonstrably working. Slices are atomic by design (user, 2026-08-02): claim one,
finish it, log it, stop.

**Budget: 45 slices** (user estimate, 2026-08-02). The count is a target, not a
contract — split a slice that turns out too big with a letter suffix (`G4a`,
`G4b`), and record it.

---

## Phase map

| Phase | Slices | Theme | Gate |
|---|---|---|---|
| **A** | A1–A5 | Foundation & tooling | blank canvas renders, loop runs |
| **B** | B1–B5 | Data extraction | all game data in JSON |
| **C** | C1–C4 | Rendering | a real screen draws |
| **D** | D1–D5 | Player & combat | Link walks, swings, takes damage |
| **E** | E1–E4 | Overworld | walk between screens |
| **F** | F1–F4 | Items & inventory | equip and use the item set |
| **G** | G1–G5 | Enemies | combat works |
| **H** | H1–H4 | Dungeons | enter and explore dungeons |
| **I** | I1–I3 | Bosses | dungeons completable |
| **J** | J1–J2 | UI & game states | title, game over, ending |
| **K** | K1–K2 | Audio | music and SFX |
| **L** | L1–L2 | Save, Second Quest & ship | full playthrough |

**Critical path:** A → B → C → D → E. Nothing is playable until E is done.
Phases F–I are the wide part and can be worked in any order once D and E land.

---

## Phase A — Foundation & Tooling (5 slices)

Goal: an empty but *correct* project. No game logic.

| ID | Slice | Verify |
|---|---|---|
| A1 ✅ | Scaffold `zelda-nes-ts/`: Vite + TS strict (`noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`), vitest, ESLint, folder skeleton per ARCHITECTURE | `npm run dev` serves; `npm run typecheck` clean |
| A2 ✅ | Canvas renderer (256×240, integer-scaled, pixelated) + fixed-timestep game loop (60 fps, accumulator, pause on blur) | clear colour animates at stable 60 fps |
| A3 ✅ | Asset curation: collect sprites, tiles, audio from reference repos into `public/assets/`. Organize by category. Create manifest | all assets load; no 404s |
| A4 ✅ | Input system: keyboard + Gamepad API, action-name abstraction (not key codes), remappable | on-screen debug shows live action states |
| A5 ✅ | Debug overlay (backtick toggle: fps, screen coords, entity count) + vitest test harness | overlay toggles; one passing test |

## Phase B — Data Extraction (5 slices)

Goal: **all** game data from the disassembly becomes typed JSON. These are
Node scripts that parse the assembly source — run once, commit output.

| ID | Slice | Disassembly source | Verify |
|---|---|---|---|
| B1 ✅ | Overworld map data: 128 screens of tile layouts | `Z_03.asm`, `Z_06.asm` (column tables) | all 128 screens produce valid tile grids |
| B2 ✅ | Dungeon room data: all 9 dungeon layouts, room tiles, door/wall types | `Z_06.asm` | all dungeon rooms parse; room counts match |
| B3 ✅ | Enemy spawn tables: per-screen enemy types, counts, positions | `Z_04.asm`, `Z_07.asm` | every screen has a spawn entry |
| B4 ✅ | Item tables: drop tables, shop inventories, cave contents, heart container locations | `Z_05.asm`, `Z_06.asm` | every item placement accounted for |
| B5 ✅ | Sprite animation data: frame counts, timing, directional sprites for Link, enemies, items, effects | Reference repos + disassembly | animation data loads for all entity types |

## Phase C — Rendering (4 slices)

| ID | Slice | Verify |
|---|---|---|
| C1 ✅ | Tile renderer: draw 16×11 play area from B1 map data. Tileset loading, tile ID → pixel mapping | a real overworld screen draws |
| C2 ✅ | Sprite renderer + animation system: draw animated sprites, flip/mirror, depth sorting | Link sprite animates on screen |
| C3 ✅ | HUD / status bar: hearts, rupees, keys, bombs, minimap dot, equipped item slots (A + B) | HUD renders with placeholder values |
| C4 ✅ | Screen transition: 4-directional scrolling between screens (push-scroll, ~32 frames) | scroll matches NES timing |

## Phase D — Player & Combat (5 slices)

| ID | Slice | Reference | Verify |
|---|---|---|---|
| D1 ✅ | Link movement: 4-direction, 8×8 hitbox, tile collision, screen-edge detection | `Z_05.asm` (player logic) | Link walks, stops at walls, triggers screen change at edges |
| D2 ✅ | Sword attack: melee swing (4 directions) + sword beam at full health | `Z_05.asm` | hitbox active for correct frames; beam fires |
| D3 ✅ | Shield: block projectiles when facing them. Push/pull mechanics | `Z_05.asm` | projectile blocked; push block moves |
| D4 ✅ | Damage system: knockback, invincibility frames, health (half-hearts) | `Z_05.asm` | knockback direction + distance match original |
| D5 ✅ | Death + respawn: death animation, game over trigger, continue at dungeon entrance or screen start | `Z_05.asm` | death plays; respawn position correct |

## Phase E — Overworld (4 slices)

| ID | Slice | Verify |
|---|---|---|
| E1 ✅ | Overworld map loading + screen-to-screen scrolling transitions | walk across multiple screens |
| E2 ✅ | Cave/staircase entry and exit: fade out → cave interior → fade in. Support for multi-room caves | enter sword cave, get wooden sword |
| E3 ✅ | Overworld secrets: bombable walls (reveal cave), burnable bushes (blue/red candle), pushable rocks | bomb reveals cave; bush burns |
| E4 ✅ | NPCs + shops: Old Man dialogue, merchant shops (buy items for rupees), gambling game, item caves (split E4a/E4b) | buy item from shop; receive gift from Old Man |

## Phase F — Items & Inventory (4 slices)

| ID | Slice | Verify |
|---|---|---|
| F1 ✅ | Item model + pickups + drop tables + inventory subscreen (select + equip to A/B buttons) | open inventory; equip item; close |
| F2 ✅ | Boomerang (normal: stuns; magical: stuns + damages), Bombs (place, timer, explosion radius, break walls) | boomerang returns; bomb explodes |
| F3 ✅ | Bow + Arrow + Silver Arrow, Candle (blue: once per screen; red: unlimited), Food/Bait | arrow flies; candle burns bush; bait lures |
| F4a ✅ | Magic Rod + Book of Magic fire, Ring palette tinting, Potion + heart refill, Letter delivery at potion shop, Power Bracelet/Magic Key/Ring wiring verified | rod fires magic shot; ring tints Link; potion heals |
| F4b ✅ | Link halted mechanism, collision water detection, Stepladder (auto-activation + movement override), Raft (dock detection + travel + screen scroll) | ladder bridges water; raft crosses water |
| F4c ✅ | Recorder/Flute: 152f gameplay freeze, pond-drying animation (12 steps), whirlwind teleport to dungeon entrances via triforce bitmask | flute reveals secret; whirlwind warps |

## Phase G — Enemies (5 slices)

Sliced by environment so each is playtestable as you go.

| ID | Slice | Verify |
|---|---|---|
| G1 ⬜ | Enemy base system: AI state machine, spawn/despawn lifecycle, item drops, damage reception, death animation | dummy enemy spawns, takes damage, drops item, dies |
| G2 ⬜ | Overworld enemies: Octorok (red/blue), Tektite (red/blue), Leever (red/blue), Peahat, Zora, Moblin (red/blue), Lynel (red/blue), Armos, Ghini | each enemy moves + attacks per its AI pattern |
| G3 ⬜ | Dungeon enemies tier 1: Stalfos, Keese, Gel, Zol (splits into Gels), Rope, Goriya (red/blue, throws boomerang) | enemies behave in dungeon rooms |
| G4 ⬜ | Dungeon enemies tier 2: Darknut (red/blue), Wizzrobe (red/blue), Gibdo, Like-Like (eats shield), Wallmaster (grabs to entrance), Pols Voice, Vire (splits), Bubble, Lanmola | all tier 2 mechanics correct |
| G5 ⬜ | Enemy projectiles (rocks, arrows, boomerangs, magic blasts, fireballs) + **full roster audit** | all enemy types accounted for; projectiles collide correctly |

## Phase H — Dungeons (4 slices)

| ID | Slice | Verify |
|---|---|---|
| H1 ⬜ | Dungeon system: room loading, locked doors (key), bombable walls, shutters (kill all enemies), push blocks, spike traps, Map + Compass items, dungeon minimap | navigate dungeon rooms; use key on door |
| H2 ⬜ | Dungeons 1–3: Eagle, Moon, Manji — room layouts, enemy placement, item placement, Triforce piece | complete dungeon 1 start to Triforce |
| H3 ⬜ | Dungeons 4–6: Snake, Lizard, Dragon — progressively harder layouts and enemy mixes | all 3 dungeons navigable |
| H4 ⬜ | Dungeons 7–9: Demon, Lion, Death Mountain — including the final dungeon's unique mechanics | reach Ganon in dungeon 9 |

## Phase I — Bosses (3 slices)

| ID | Slice | Verify |
|---|---|---|
| I1 ⬜ | Boss framework (health, arena, phases, Triforce drop on death) + Aquamentus (fireball pattern), Dodongo (bomb-feeding mechanic), Manhandla (4 pincers, accelerates) | all 3 bosses defeatable |
| I2 ⬜ | Gleeok (2/3/4 detaching heads), Digdogger (shrinks with Recorder), Gohma (red/blue, eye vulnerability) | all 3 bosses defeatable with correct items |
| I3 ⬜ | Patra (orbiting flies), Ganon (invisible, Silver Arrow kill), Zelda rescue sequence | beat Ganon; rescue Zelda; game ends |

## Phase J — UI & Game States (2 slices)

| ID | Slice | Verify |
|---|---|---|
| J1 ⬜ | Title screen (with demo playback or static), file select (3 slots), name entry (register), elimination mode | create file; start game; delete file |
| J2 ⬜ | Game over screen (continue/save/retry), ending sequence + credits scroll | game over → continue works; ending plays after Ganon |

## Phase K — Audio (2 slices)

| ID | Slice | Verify |
|---|---|---|
| K1 ⬜ | Web Audio SFX engine: sword, bomb, item pickup, damage, enemy hit/kill, secret reveal, low health beep, text crawl, stairs, door unlock, shield block | all SFX fire on the correct events |
| K2 ⬜ | Music engine: overworld, dungeon, final dungeon, boss fight, game over, title, ending, fairy, item fanfare. Crossfade on area transitions | music plays and transitions correctly |

## Phase L — Save, Second Quest & Ship (2 slices)

| ID | Slice | Verify |
|---|---|---|
| L1 ⬜ | Save system: 3 slots via IndexedDB. Save on death/quit, load from file select. Persist: inventory, hearts, dungeon progress, Triforce count, quest number | save → reload → identical state |
| L2 ⬜ | Second Quest: load alternate overworld/dungeon JSON data (different secrets, dungeons, enemy placement). Unlocks after first completion. + Full playthrough audit | Quest 1 → ending → Quest 2 starts; documented parity gaps only |

---

## Sequencing notes

- **Do not start C before B.** Rendering a screen needs tile data. Every attempt
  to shortcut this ends in hardcoded data that breaks when the real data arrives.
- **D and E unlock everything.** Once Link walks between screens, F–I are
  independent and can be reordered freely.
- **The roster audit (G5) matters.** The enemy list is large enough that types
  get silently skipped; the audit is what makes "done" mean something.
- **When a slice exceeds one session**, split it (`G4a`/`G4b`), log the split in
  the tracker, and note it in `DECISIONS.md` if the shape of the plan changed.
- **Second Quest (L2) is data, not code.** If the engine is data-driven (decision
  #4), Second Quest is just loading alternate JSON files.
