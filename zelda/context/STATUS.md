# STATUS — the live handoff log

> **Read this first, update it last. Every session.**
>
> This is the only file that says what is actually happening right now. Skip the
> update and the next agent restarts from zero.
>
> Keep it short. It is *state*, not knowledge — facts go to `ARCHITECTURE.md`,
> `IMPLEMENTATION.md` and `DECISIONS.md`, finished sessions go to `HISTORY.md`.

**Project:** zelda-nes — *The Legend of Zelda* (NES, 1986) as native TypeScript
in the browser.
**Run commands from:** `zelda-nes-ts/`
**Last updated:** 2026-09-06 · **Phase:** L (bug fixes, Q2 deferred) ·
**Slices:** 51 of 54 done — M1–M2 pending

---

## Next action

**M1 (responsive layout), then M2 (touch controls)** — the user chose to do the
mobile phase next. Second Quest (Q2) is deferred — no Q2 code has been kept.

## Where the game stands

Winnable end to end (Q1). Title → file select → register → play → all 9
dungeons → Ganon → Zelda rescue → ending. Save/load works, audio works,
every entity renders with real sprites.

- **1246 tests pass.** Two pre-existing failures: a stale `recorder.test.ts`
  case and a flaky `digdogger.test.ts` movement test.
- **`src/` typecheck clean** — test files have pre-existing warnings only.

## Known open bugs

1. **Inventory cursor can't reach the top row.** Only the bottom selectable row
   (boomerang, bombs, arrow, candle, flute, food, potion, wand) is reachable.
   The NES grid is two selectable rows — cursor navigation needs Up/Down as well
   as Left/Right.

## Testing notes

- Vite full-page-reloads on every edit, which restarts the game and zeroes
  Link's keys and items. Re-run `__zelda.giveDungeon()` after any hot reload.
- Debug console helpers hang off `__zelda`: `giveAll`, `giveDungeon`, `godMode`,
  `noclip`, `warp(row,col)`, `goToRoom(id)`, `goToDungeon`, `killAll`,
  `keyInfo`, `saveNow`, `dumpSave`, `step(frames)`, `goToTitle`,
  `goToFileSelect`, `goToRegister`, `goToElimination`, `goToEnding`.

## Session log

Newest first, one short paragraph each. Move entries to `HISTORY.md` once this
passes ~5, so the file stays short enough that agents actually read it.

### 2026-09-06 — Bug fixes + context cleanup + touch controls (Claude Opus 4.6 1M)

Deleted old `context/agent/*`, `PROGRESS.md`, `README.md` — context/ is now 10
files at one level matching CLAUDE.md. Eight Q1 dungeon/overworld bug fixes
re-implemented from L2a/L2b notes (no Q2 code kept): (1) Stalfos walk animation
via horizontal flip, (2) `getRoomItemPosition` HUD_HEIGHT subtraction, (3)
`ItemPickup.persistent` flag for room items, (4) `maskBakedRoomItem` covers
baked-in items from dungeons-map.png, (5) door overlays from dungeon-doors.png
for bombable/key/shutter doors, (6) door alcove walkability
(`setDoorAlcoveOpen`), (7) `tryOpenBlockedDoor` for key doors on touch, (8)
`nudgeToWalkable` for overworld enemy spawns. False-wall type 3 added to
`OPEN_DOOR_TYPES`. Save-load now restores full hearts instead of 3.

Touch controls (Phase M2): `src/ui/touch-controls.ts` + controller assets from
zelda30tribute. NES-style d-pad (bottom-left) + Start/B/A buttons (bottom-right)
using `controller2.png` sprite strip + `dpad.png` cross overlay. Touch events
feed into `InputManager.setActionHeld()` (new external action API). D-pad tilts
via CSS 3D transforms. Only shown on touch-capable devices. Per-button press
indicators (dark circle overlays). Multi-touch supported. 1246 tests pass.

### 2026-09-06 — Context system flattened (Claude Opus 5)

Reworked `context/` from 16 files across two levels into 10 files at one level,
with a new root `CLAUDE.md` as the entry point. Dissolved the `agent/` subfolder:
its five knowledge files merged into their top-level counterparts, and
`01-progress-tracker.md` split into this file (live state), `IMPLEMENTATION.md`
(the 119-row systems inventory it had accumulated) and `HISTORY.md` (its session
log, merged with the old `PROGRESS.md`). Dropped the 52-row queue table — `PLAN.md`
already carries per-slice status. Open questions now have one home,
`DECISIONS.md`. Recorded as `DECISIONS.md` #14 with the full old→new mapping. No
code touched; no dangling links remain.
