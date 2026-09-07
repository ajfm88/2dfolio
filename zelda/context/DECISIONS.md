# DECISIONS — settled choices and why

Don't relitigate without new information. Add new entries at the bottom, dated.

1. **Localhost only, permanently — never published** (2026-08-02). The sprites,
   tiles, and music are Nintendo's copyrighted work. A public URL would distribute
   them. Running locally is a different situation from distributing. Nothing in the
   codebase should assume a public origin, a CDN, or an analytics endpoint.

2. **Native TypeScript reimplementation, not emulation** (2026-08-02). This is a
   ground-up reimplementation of the game logic in TypeScript, not a NES emulator.
   No CPU emulation, no PPU emulation, no ROM loading. The disassembly is the
   *specification*, not a *build input*. The reference repos inform implementation
   patterns but are not authoritative for behavior.

3. **Canvas 2D, not WebGL2** (2026-08-02). The NES Legend of Zelda has no shader
   effects — no blur, no wobble, no post-processing. Everything is flat sprites
   and tiles. Canvas 2D is simpler, better documented, and more than sufficient.
   Screen flashes and palette swaps are trivial in Canvas 2D. Revisit only if
   performance is a problem (unlikely at NES-level complexity).

4. **Data-driven design: JSON, not hardcoded** (2026-08-02). All map layouts,
   enemy spawn tables, item drop tables, shop inventories, and dungeon room data
   are loaded from JSON files. This is what makes Second Quest a data swap instead
   of a code fork. It also means data extraction (phase B) and game logic
   (phases C–K) can be worked independently.

5. **Sprites from reference repos, not extracted from ROM** (2026-08-02). The
   reference repos (especially bobbylight and humbertodias) already have clean,
   extracted sprite sheets in PNG format. Using these is pragmatic and avoids
   building a CHR ROM extractor. If gaps are found, sprites can be sourced from
   other reference repos or created manually.

6. **The disassembly is the behavioral authority** (2026-08-02). When the
   implementation disagrees with `zelda1-disassembly-master/`, the implementation
   is wrong. The reference repos are all incomplete (5-35%) and may have bugs or
   invented behavior. Use them for code patterns, not for "how the game should
   work." When behavior looks arbitrary, it probably encodes a quirk of the
   original — check the disassembly before "fixing" it.

7. **45 atomic slices** (2026-08-02, user). One slice per session, claimed from
   the tracker queue, finished and logged before stopping. When a slice proves too
   big, split it with a letter suffix (`G4a`, `G4b`) rather than silently
   expanding scope.

8. **Save-slot metadata now (localStorage), full game state in L1 (IndexedDB)**
   (2026-09-01, user). J1's file-select screen needs three save files, but the
   real persistence slice is L1. Decision: J1 ships a thin `SaveManager`
   (`src/save/save-manager.ts`) that persists only slot *metadata* — name, quest,
   registered flag, death count — to `localStorage` under key `zelda-nes:saves:v1`,
   so files survive reload immediately. L1 widens the `SaveSlot` shape to the full
   persisted game state (inventory, hearts, dungeon progress, Triforce count) and
   swaps the backing store to IndexedDB. `SaveManager` is the single seam for this;
   it must stay additive, never a competing save format. All storage access is
   guarded (private-mode/blocked storage degrades to in-memory).

9. **J1 split into J1a / J1b** (2026-09-01, user). J1 (title + file-select + name
   registration + elimination) is larger than one session. J1a = boot refactor +
   title + backstory scroll + file-select + start-game wiring (done 2026-09-01).
   J1b = name-registration character board + elimination mode. The title uses a
   static `title.png` + backstory scroll on idle; the scripted attract-mode
   gameplay demo is intentionally out of scope.

10. **L1 saves to localStorage, not IndexedDB — amends #8** (2026-09-04, user).
    A full save slot (Link's counters, the whole inventory, three 128-byte world-flag
    blocks, visited screens) serializes to roughly 6KB, so all three files fit in
    ~18KB of localStorage's 5MB budget. IndexedDB would buy capacity we do not need
    and cost an async open/upgrade path plus making `SaveManager` construction
    awaitable — the front end builds it at module scope and reads slots
    synchronously. The `SaveSlot` shape widened with a `state` field exactly as #8
    intended; only the backing store changed. Storage key moved to
    `zelda-nes:saves:v2`, and a J1a `v1` payload is still read as metadata-only so
    existing files appear on file select instead of vanishing.

11. **The save file is written only on SAVE, never automatically** (2026-09-04, user).
    Considered autosaving on screen changes and item pickups to imitate battery-backed
    SRAM, but chose the explicit write. Consequence, accepted knowingly: closing the
    tab mid-play loses progress since the last SAVE. `__zelda.saveNow()` is the
    escape hatch while developing.

12. **Mid-game saving via the NES controller-2 chord** (2026-09-04, user).
    `Z_05.asm:362 UpdateMenuActive`: with the inventory subscreen open, controller 2
    holding Up (`$08`) + A (`$80`) (`AND #$88 / CMP #$88`) resets the submenu, sets
    `GameMode = $08` — the same SAVE/CONTINUE/RETRY screen as death — and silences
    sound. So SAVE is reachable without dying. We have no second controller and
    `InputManager` merges every connected pad into one action set, so the chord is
    read from whatever device is present: Start, then hold Up + A. CONTINUE reached
    this way must not increment the death count — on the NES that happens in the
    death sequence (Mode $11), not in Mode $08.

13. **Room flags are per world-flags block, not per dungeon or global**
    (2026-09-04). The NES `WorldFlags` region is `$067F-$07FE` = `$180` bytes = three
    128-byte blocks, mirrored to SRAM as `SaveFileAWorldFlags0/1/2`
    (`Variables.inc:308-310`); `LevelInfo_WorldFlagsAddr` selects a level's block.
    `dungeons.json` already carries the same grouping (levels 1-6 = `uw1q1`, 7-9 =
    `uw2q1`). Until L1, `main.ts` used a single shared 128-byte `RoomFlags` for all
    nine dungeons, so Level 1's room 60 and Level 7's room 60 were the same byte.
    Now one `RoomFlags` exists per block — overworld, `uw1q1`, `uw2q1` — which fixes
    the collision and gives the save format its shape. Q2's `uw1q2`/`uw2q2` slot into
    the same structure in L2.

14. **Context system flattened to one level, entry point moved to root `CLAUDE.md`**
    (2026-09-06, user). `context/` had grown to 16 files across two levels, with
    `context/agent/` duplicating the top-level files it was supposed to point at —
    two architecture docs, two sets of code standards, two session-history files,
    two lists of open questions, and a 52-row slice queue that restated `PLAN.md`.
    Now: one level, ten files, and a root `CLAUDE.md` as the index (an entry point
    should be the thing an agent opens first, not a file three levels in). Each
    fact has exactly one home.

    | Was | Now |
    |---|---|
    | `agent/00-readme.md` | dissolved into root `CLAUDE.md` |
    | `agent/01-progress-tracker.md` | split three ways: live state → `STATUS.md`, the 119-row systems inventory → `IMPLEMENTATION.md`, the session log → `HISTORY.md` |
    | `agent/02-project-overview.md` | merged into `PROJECT.md` (kept its success criteria + "why this is tractable") |
    | `agent/03-architecture.md` | merged into `ARCHITECTURE.md` (stack table, layer boundaries, invariants) |
    | `agent/04-code-standards.md` + `agent/05-ai-workflow-rules.md` | merged into `CONVENTIONS.md` |
    | `agent/06-ui-context.md` | merged into `ARCHITECTURE.md` as the rendering / sprites / HUD / audio / input sections |
    | `agent/enemy-roster-audit.md` | `ENEMY-ROSTER.md` |
    | `PROGRESS.md` | `HISTORY.md` |
    | `context/README.md` | dissolved into root `CLAUDE.md` |

    Two things were dropped rather than moved, both pure duplication: the tracker's
    52-row queue table (`PLAN.md` already carries per-slice status) and its copy of
    the open questions (they live here, below). Three renames worth flagging:
    `PROGRESS.md` → `HISTORY.md`, because "PROGRESS" and "progress-tracker" were two
    files whose names meant opposite things (archive vs. live) and the old README had
    to spend a paragraph disambiguating them; `01-progress-tracker.md` → `STATUS.md`
    for the same reason; and `context/README.md` was dissolved rather than kept,
    because a README inside `context/` reads as that folder's entry point, which is
    now `CLAUDE.md`'s job. No code references any of these paths, so nothing outside
    `context/` changed except the root `README.md`, whose stale "Pre-code" status was
    corrected at the same time.

## Open questions for the user

The one home for these. Answer cheaply, unblock later work. Known *bugs* are not
questions — they live in `STATUS.md`.

- **Asset gaps.** When a reference repo lacks a sprite we need, should we extract
  from another repo, create it manually, or defer? (Largely settled in practice
  by L0/L0b/L0c/L0d, but the policy was never stated.)
- **Music source.** Only `overworld.ogg` and `dungeon.ogg` exist. The engine
  plays silence for title, boss, ending, game-over and fairy tracks. Source the
  missing seven from a reference repo, or leave them silent?
- ~~**Second Quest priority.**~~ Settled: stayed last, shipped as L2a
  (2026-09-05).
