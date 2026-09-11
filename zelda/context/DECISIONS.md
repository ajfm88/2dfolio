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
    the collision and gives the save format its shape. Q2 **reuses** those three
    blocks (NES `WorldFlagBlockAddrs`); `switchToSecondQuest` clears them rather
    than allocating `uw1q2`/`uw2q2` SRAM.

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

15. **Touch overlay has no Select; D-pad Up/Down is the Select shortcut** (2026-09-06, user).
    The on-screen pad is arrows + A/B/Start. On Continue/Save/Retry, overlay Down
    cycles forward and Up cycles back (keyboard still uses Shift). On name
    registration the letter board still uses the D-pad, but overlay Down from the
    bottom row / Up from the top row (or Up/Down while parked on END) cycles files
    the way Select does, so a touch player can reach END and commit. File select
    and elimination already use Up/Down, so they never needed Select. User
    confirmed 2026-09-06: desktop Shift-only to leave the letter grid is correct;
    new-file create and file-select navigation work on desktop and mobile.

16. **Temporary Netlify preview is allowed — amends #1 for preview only**
    (2026-09-08, user). User asked for a short-lived Netlify deploy they will
    take down. `npm run build` must succeed (tsc on `src` only; game JSON is
    bundled, not fetched from `/src/data/`). `zelda-nes-ts/netlify.toml` is the
    build recipe. Still no analytics, no CDN, no custom domain. The game must
    not assume a public origin at runtime.

17. **Q2 overworld patches get their own file and script; the `$8B` overrun is
    preserved** (2026-09-09, user). Two calls made in L2a2.

    *Placement.* `@PatchQ2Rooms` (`Z_06.asm:239`) data lives in a new
    `src/data/q2-overworld.json`, written by a new
    `scripts/extract-q2-overworld.ts`, rather than being folded into
    `secrets.json`. `secrets.json` is scoped to AttrsF-derived *secret gating*;
    this is AttrsA/B/C/D/F *attribute patching*, and its extractor doesn't read
    those planes. Keeping them apart preserves the repo's one-script-one-JSON
    convention. The file emits both faithful `{table,screen,value}` `patches` and
    decoded `screenOverrides` — the bit layouts are already known in the extract
    script, so decoding there keeps them out of runtime code in L2a4.

    *The `$8B` overrun.* `LevelBlockAttrsBQ2ReplacementOffsets` ends with `$8B`
    (139), past the 128-screen AttrsB plane. `LevelBlockAttrsB` (`$68FE`) and
    `LevelBlockAttrsC` (`$697E`) are contiguous, so the NES write lands on
    **`AttrsC + 11`** — it changes screen 11's monster list, not any AttrsB
    screen. This is original-ROM behaviour and stays: the record is emitted as
    `{ table: "C", screen: 11, value: 0x2F }`. Do not "fix" it to AttrsB screen 11.

    *Corollary for L2a3.* `dungeonsQ2` is indexed by NES CurLevel − 1, while
    `.level` is the displayed number and Q2 shuffles it to `1,3,2,5,4,6,8,7,9`.
    Anything selecting a dungeon must use the AttrsB cave index, never `.level`.

18. **Canvas scales in whole *device* pixels; hybrid fill policy approved but not yet
    built** (2026-09-09, user). M1.

    *The bug.* `Renderer.resize()` scaled in whole **CSS** pixels
    (`floor(innerWidth / 256)`), so any viewport under 512 CSS px wide — i.e. every
    phone in portrait — got exactly 1×. Combined with `body { align-items: center;
    min-height: 100vh }`, the 256×240 canvas sat centred in a box Samsung Internet
    measures against the *collapsed*-toolbar height, so it floated mid-screen with a
    black band above and its bottom edge behind the touch pads.

    *The decision.* Scale in whole **device** pixels instead
    (`floor(availablePx × devicePixelRatio / 256)`), keeping the backing store at
    256×240 and letting the CSS box be deliberately fractional — `256 × scale / dpr`
    CSS px is exactly `256 × scale` device px. Rounding that to whole CSS px would
    reintroduce the uneven pixel widths the approach exists to avoid.

    *The correction, and what is still open.* The plan claimed this "fills ~95% of
    the width". That was true only for the assumed dpr 2.625; measured across real
    ratios at a 412px viewport it ranges 83–95%, and at 375px/dpr 2 (iPhone SE, 8)
    it falls to **68%**. The user was told this after the fact and chose a **hybrid**:
    use the integer scale when it fills ≥ 90% of the perfect-fit width, else fall
    back to fractional fill. **That hybrid is approved but NOT implemented** — the
    code currently ships pure integer scaling. Implementing it is a small change to
    `computeCanvasLayout` plus cases in `tests/render/canvas-layout.test.ts`.

    *The pad reserve.* The touch pads are unchanged — their `left: -60px` /
    `right: -30px` bleed is deliberate. The canvas keeps clear of them by reserving
    `TOUCH_PAD_RESERVE_PX` (260) at the bottom **in portrait only**. In landscape the
    canvas is height-limited and the pads fall into the left/right letterbox margins;
    reserving there would crush the game into a ~150px strip.

19. **AJFM88 cheat code** (2026-09-09, user). Registering the name "AJFM88"
    grants a full loadout on game start: magic sword, both boomerangs, silver
    arrows, red candle, red ring, magic key, all items, 999 rupees, 99 bombs
    (max bombs raised to 99), 16 hearts, all maps/compasses/triforce, letter
    delivered, red potion, 9 keys. Keys refill to 9 on every dungeon entry.
    Pattern mirrors `nameStartsSecondQuest` for "ZELDA". The `restoreStats`
    bomb clamp was raised from 16 to 99 so cheat saves round-trip correctly.

20. **M1 hybrid fill policy parked** (2026-09-09, user). The user prefers whole
    device-pixel scaling as shipped. The approved-but-unbuilt hybrid (integer
    when ≥ 90% fill, else fractional) is no longer planned. Pure integer
    device-pixel scaling stays.

## Open questions for the user

The one home for these. Answer cheaply, unblock later work. Known *bugs* are not
questions — they live in `STATUS.md`.

- **Asset gaps.** When a reference repo lacks a sprite we need, should we extract
  from another repo, create it manually, or defer? (Largely settled in practice
  by L0/L0b/L0c/L0d, but the policy was never stated.)
- **Music source.** Only `overworld.ogg` and `dungeon.ogg` exist. The engine
  plays silence for title, boss, ending, game-over and fairy tracks. Source the
  missing seven from a reference repo, or leave them silent?
- ~~**Second Quest priority.**~~ Settled as last (L2). L2a **data** is in
  tree; **runtime wiring is not** (code audit 2026-09-08). L2b playthrough
  blocked until gameplay reads `slot.quest`.
