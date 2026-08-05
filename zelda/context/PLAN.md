# PLAN — 90 slices to a playable browser build

Status legend: ✅ done · 🔨 in progress · ⬜ pending · ⏸ parked

**Live status is not here.** This file is the map. What is actually done, in
progress, and next lives in `context/agent/01-progress-tracker.md` — read that first.

A **slice** is one focused agent session (~1–3 hours), sized so it ends with
something demonstrably working. Slices are atomic by design (user, 2026-08-01):
claim one, finish it, log it, stop.

**Budget: 90 slices ≈ 3 months** (user estimate, 2026-08-01). Roughly one slice
per weekday. The count is a target, not a contract — split a slice that turns out
too big and renumber with a letter suffix (`H4a`, `H4b`), and record it.

---

## Phase map

| Phase | Slices | Theme | Gate |
|---|---|---|---|
| **A** | A1–A7 | Foundation & tooling | blank canvas renders, loop runs |
| **B** | B1–B12 | Asset format decoding | every asset parses to JSON |
| **C** | C1–C9 | Rendering | a real map draws on screen |
| **D** | D1–D8 | Player & physics | Link walks, swings, collides |
| **E** | E1–E7 | World & map systems | walk between maps |
| **F** | F1–F7 | Interactables | cut grass, lift pots, open chests |
| **G** | G1–G6 | Items & inventory | equip and use the item set |
| **H** | H1–H10 | Enemies | combat works |
| **I** | I1–I5 | NPCs & dialogue | talk to the village |
| **J** | J1–J6 | Bosses & minibosses | dungeons completable |
| **K** | K1–K5 | UI, menus, HUD | full menu system |
| **L** | L1–L5 | Audio | music and SFX |
| **M** | M1–M3 | Save, verify, ship | full playthrough |

**Critical path:** A → B → C → D → E. Nothing is playable until E is done.
Phases F–J are the wide part and can be worked in any order once D and E land.

---

## Phase A — Foundation & tooling (7 slices)

Goal: an empty but *correct* project. No game logic.

| ID | Slice | Verify |
|---|---|---|
| A1 ✅ | Scaffold `zelda-links-awakening-ts/`: Vite + TS strict (`noUnusedLocals`, `noUnusedParameters`), vitest, ESLint, folder skeleton per ARCHITECTURE | `npm run dev` serves; `npm run typecheck` clean |
| A2 ⬜ | Canvas + WebGL2 context; fixed-timestep loop (accumulator, decoupled update/render); pause on blur | clear colour animates at stable 60 fps |
| A3 ⬜ | `npm run assets`: copy PNG/WAV from `_fixtest`, emit manifest, verify counts. **Language allow-list = `["eng","esp"]`** (DECISIONS #11) — one constant, easy to extend. Idempotent, re-runnable | rerun twice → byte-identical output; non-allowed languages absent |
| A4 ⬜ | `BinaryReader`: LE ints, floats, length-prefixed + null-terminated strings, **CRLF-aware** line reads | unit tests on synthetic buffers |
| A5 ⬜ | Input: keyboard + Gamepad API, remappable, action-name abstraction (not key codes) | on-screen debug shows live action states |
| A6 ⬜ | Debug overlay (backtick): fps, entity count, camera, free-warp hook | toggles, renders over the canvas |
| A7 ⬜ | Test harness: golden-fixture helper, `tests/fixtures/`, CI-less `npm test` | one passing golden round-trip |

## Phase B — Asset format decoding (12 slices)

Goal: **every** asset becomes plain JSON/typed objects. Pure functions, no DOM.
This is the highest-risk phase — the formats are undocumented and bespoke.
Each slice cites its C# authority.

| ID | Slice | C# authority | Verify |
|---|---|---|---|
| B1 ⬜ | `.atlas` parser (**20** files — `intro_chn.atlas` dropped per DECISIONS #11) | `DictAtlasEntry.cs` | all 20 parse; regions match PNG bounds |
| B2 ⬜ | `.ani` structure: header, sprite refs (285 files) | `AnimatorSaveLoad.cs` | all 285 parse without error |
| B3 ⬜ | `.ani` frames: timing, offsets, loop flags | `Animator.cs` | frame counts match C# for 10 sampled files |
| B4 ⬜ | `.map` header + tile layers (131 files) | `SaveLoadMap.cs` | all 131 parse; dims sane |
| B5 ⬜ | `.map` object placement + properties | `SaveLoadMap.cs` | object counts match C# for `overworld.map` |
| B6 ⬜ | `.map.data` sidecars | `DataMapSerializer.cs` | pair up with their `.map` |
| B7 ⬜ | `.lng` language files — **6 of 33**: `eng`/`esp` × (base, `achieve_`, `dialog_`), DECISIONS #11. Loader stays generic | `Language.cs` | all 6 parse; `eng` and `esp` key sets match |
| B8 ⬜ | `.data` blobs (133) — classify + parse | `MusicPlayer.cs` | every file classified, none unknown |
| B9 ⬜ | `.txt` data files (17) | grep call sites | parsed into typed records |
| B10 ⬜ | `.zScript` lexer → token stream | `DialogPathLoader.cs` | tokenizes `scripts.zScript` fully |
| B11 ⬜ | `.zScript` parser → AST | `DialogPathLoader.cs` | AST covers every construct used |
| B12 ⬜ | Bitmap fonts from `.spritefont`/`.fnt` → glyph atlas. **No CJK path** — `smallFont_chn*.fnt` dropped (DECISIONS #11). Latin + VWF only | `Content/Fonts/` | glyph metrics render legibly; `smallFont_vwf` handles Spanish accents |

## Phase C — Rendering (9 slices)

| ID | Slice | Verify |
|---|---|---|
| C1 ⬜ | WebGL2 sprite batcher: instanced quads, one draw call per texture | 10k sprites at 60 fps |
| C2 ⬜ | Texture manager: atlas upload, nearest-neighbour, no bleed | zoomed sprite has crisp edges |
| C3 ⬜ | Tile layer renderer from parsed `.map` | a real map's terrain draws |
| C4 ⬜ | Depth sorting (Link behind/in front correctly) | sort order matches C# `Depth` semantics |
| C5 ⬜ | Camera: modern (smooth follow) | follows a dummy entity |
| C6 ⬜ | Camera: **Classic** screen-based scrolling (v1.4.3 feature) | screen-snap transitions match original |
| C7 ⬜ | Shaders 1/3 — colour family: `ColorShader`, `DamageShader`, `SaturationFilter`, `LightFadeShader`, `ColorCloud` | visual parity vs C# screenshots |
| C8 ⬜ | Shaders 2/3 — blur family: `BlurH/V`, `BBlurH/V`, `EffectBlur`, `RoundedCorner`, `RoundedCornerEffectBlur` | ditto |
| C9 ⬜ | Shaders 3/3 — effects: `WobbleShader`, `ShockEffect`, `WaleShader`, `CircleShader`, `LightShader`, `FullShadowEffect`, `PixelGrid`, `Thanos` | ditto; all 20 accounted for |

## Phase D — Player & physics (8 slices)

| ID | Slice | C# authority | Verify |
|---|---|---|---|
| D1 ⬜ | Entity/component model | `GameObjects/Base` (55 files) | dummy entity updates + draws |
| D2 ⬜ | Collision: AABB + tile grid | `GameObjects/Base` | Link cannot walk through walls |
| D3 ⬜ | Height/depth: jumping, ledges, falling | | jump arc matches original |
| D4 ⬜ | Player state machine: idle/walk/run | | 8-direction movement feels right |
| D5 ⬜ | Sword: swing, spin, beam | | hitboxes match C# |
| D6 ⬜ | Shield, push, pull, carry | | |
| D7 ⬜ | Damage, knockback, i-frames, death | | knockback vectors match |
| D8 ⬜ | Holes/pits: absorb, fall, respawn | | respawn position correct |

## Phase E — World & map systems (7 slices)

| ID | Slice | C# authority | Verify |
|---|---|---|---|
| E1 ⬜ | Map loader: parsed `.map` → live world | `InGame/Map` | `overworld.map` loads |
| E2 ⬜ | **Map transitions as async** — replaces the C# loading thread | `MapTransitionSystem.cs:396` | no frame hitch on transition |
| E3 ⬜ | Warps, doors, stairs | | walk between two maps |
| E4 ⬜ | Overworld assembly + streaming | | walk the full overworld |
| E5 ⬜ | Dungeon room assembly | | enter dungeon 1 |
| E6 ⬜ | Minimap / map-show system | `MapShowSystem.cs:137` | minimap tracks position |
| E7 ⬜ | Light system, water, conveyors, currents | | dark rooms need the lamp |

## Phase F — Interactables (7 slices) · `Things`, 139 files

| ID | Slice | Verify |
|---|---|---|
| F1 ⬜ | Grass, bushes, cuttables | cut grass drops items |
| F2 ⬜ | Pots, rocks, liftables | lift + throw arcs |
| F3 ⬜ | Chests + contents table | opening yields the right item |
| F4 ⬜ | Switches, buttons, triggers | |
| F5 ⬜ | Doors, key blocks, locks | |
| F6 ⬜ | Moving platforms, conveyors | |
| F7 ⬜ | Torches, crystals, pegs, signs, remainder | audit: all 139 accounted for |

## Phase G — Items & inventory (6 slices)

| ID | Slice | Verify |
|---|---|---|
| G1 ⬜ | Item model, pickup, drop tables | |
| G2 ⬜ | Inventory + 4–6 assignable buttons | |
| G3 ⬜ | Sword, shield, power bracelet | |
| G4 ⬜ | Bombs, bow, arrows, bomb arrows | |
| G5 ⬜ | Boomerang, hookshot | hookshot collision matches C# |
| G6 ⬜ | Magic rod, powder, feather, boots, ocarina, trade/quest items | |

## Phase H — Enemies (10 slices) · 109 files, 18,272 lines

Slice by *appearance order*, so each is playtestable as you go.

| ID | Slice | Verify |
|---|---|---|
| H1 ⬜ | Enemy base, AI scaffolding, spawn/despawn | |
| H2 ⬜ | Overworld basics: Octorok, Zol, Gel, Green Zol | knockback + death match CHANGELOG notes |
| H3 ⬜ | Moblin family, sworded enemies | |
| H4 ⬜ | Aquatic: Zora (spawn patterns per v2.0.2), fish | spawn timing matches |
| H5 ⬜ | Flying: Keese, Bomber, seagulls | |
| H6 ⬜ | Armoured: Stalfos, Arm Mimic, Pols Voice | Arm Mimic absorbs *all* projectiles |
| H7 ⬜ | Dungeon 1–2 roster | |
| H8 ⬜ | Dungeon 3–5 roster | |
| H9 ⬜ | Dungeon 6–8 roster | |
| H10 ⬜ | Projectiles, fireballs, green-smoke death; **roster audit** | all 109 files accounted for |

## Phase I — NPCs & dialogue (5 slices)

| ID | Slice | Verify |
|---|---|---|
| I1 ⬜ | NPC base + pathing | |
| I2 ⬜ | Dialogue box: rendering, VWF, pagination | text matches `.lng` |
| I3 ⬜ | zScript runtime — executes the B11 AST | a real conversation runs |
| I4 ⬜ | Village NPCs, quest-state gating | |
| I5 ⬜ | Shops, Trendy Game, cutscene sequencer | |

## Phase J — Bosses & minibosses (6 slices) · 56 files, 14,166 lines

| ID | Slice | Verify |
|---|---|---|
| J1 ⬜ | Boss framework: phases, health, arena | |
| J2 ⬜ | Minibosses 1/2 (incl. Moblin King, Dodongo Snakes) | |
| J3 ⬜ | Minibosses 2/2 (incl. Smasher — see v2.0.1 notes) | |
| J4 ⬜ | Nightmares 1–3 | |
| J5 ⬜ | Nightmares 4–6 | |
| J6 ⬜ | Nightmares 7–8 + final sequence | |

## Phase K — UI, menus, HUD (5 slices)

| ID | Slice | Verify |
|---|---|---|
| K1 ⬜ | HUD: hearts, items, rupees, keys | |
| K2 ⬜ | Inventory page + assignment | |
| K3 ⬜ | Map page, dungeon maps, minimap nav | |
| K4 ⬜ | File select, save slots, new-game types (incl. **Purist** preset) | |
| K5 ⬜ | Settings, presets, achievements, photo album | |

## Phase L — Audio (5 slices)

| ID | Slice | Verify |
|---|---|---|
| L1 ⬜ | Web Audio graph + SFX bank (164 wav → ogg) | SFX fire on events |
| L2 ⬜ | Music streaming + crossfade | overworld music plays |
| L3 ⏸ | **GB CPU core** — `GameBoyCPU.cs` + `GameBoyCPUInstructions.cs` (51 KB) | passes an instruction test suite |
| L4 ⏸ | **GB APU** — `Sound.cs` (29.6 KB) | `.gbs` output matches reference recording |
| L5 ⏸ | `AudioWorklet` integration + classic/remake toggle | no audio glitches under load |

**L3–L5 are deferrable.** They only power *classic* music mode. Ship L1–L2, play
the game, come back. Do not let the emulator block the critical path.

## Phase M — Save, verify, ship (3 slices)

| ID | Slice | C# authority | Verify |
|---|---|---|---|
| M1 ⬜ | `SaveData` model + IndexedDB (replaces filesystem saves) | `SaveGameSaveLoad.cs`, `SaveManager.cs` | save → reload → identical state |
| M2 ⬜ | Full playthrough harness + perf pass | | start → credits |
| M3 ⬜ | Final audit vs `CHANGELOG.md` v2.0.2 | | documented parity gaps only |

---

## Sequencing notes

- **Do not start C before B.** Rendering a map needs a `.map` parser. Every attempt
  to shortcut this ends in a hand-rolled format that breaks on file 40.
- **D and E unlock everything.** Once Link walks between maps, F–J are independent
  and can be reordered freely to keep the work interesting.
- **Audit slices matter** (F7, H10, M3). The roster is large enough that things get
  silently skipped; the audits are what make "done" mean something.
- **When a slice exceeds one session**, split it (`H4a`/`H4b`), log the split in the
  tracker, and note it in `DECISIONS.md` if the shape of the plan changed.

## Parked

- **Level editor** (`Editor/` in the C# tree). Play first.
- **Mod support** (`.lahdmod`, `.lahdpak`).
- **Touch/mobile controls.** `ANDROID.md` is the reference when this opens.
- **Hosting/deploy.** Permanently out of scope — `DECISIONS.md` #1.
