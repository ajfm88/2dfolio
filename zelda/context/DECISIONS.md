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

## Open questions for the user

- **Asset gaps.** The reference repos may not have every sprite needed (especially
  dungeon tiles, boss sprites, NPC sprites). Strategy when a gap is found: extract
  from another reference repo, manually create, or defer?
- **Second Quest priority.** Currently the last slice (L2). Should it be higher
  priority or is end-of-project fine?
- **Music source.** The reference repos have overworld and dungeon themes in
  OGG/MP3. Are these sufficient, or should we source higher-quality recordings?
