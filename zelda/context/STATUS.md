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
**Slices:** 51 of 54 done — M1 done in tree, M2 done in tree, L2b pending

---

## Next action

Session stopped. User signed off after L4 sprite fixes (Vire, Bubbles/Goriya/Keese
sheet shift). Next agent: more Q1 playtest. M1/M2 in tree; Q2 deferred.

## Where the game stands

Winnable end to end (Q1). Title → file select → register → play → all 9
dungeons → Ganon → Zelda rescue → ending. Save/load works, audio works,
every entity renders with real sprites.

- **1246 tests pass.** Two pre-existing failures: a stale `recorder.test.ts`
  case and a flaky `digdogger.test.ts` movement test.
- **`src/` typecheck clean** — test files have pre-existing warnings only.

User-confirmed this session: title waterfall; L1 key/compass leftovers; lake
Zoras; overlay Up/Down as Select; new file + file-select on desktop and mobile;
inventory cursor reaches all rows. L4 “boomerangs” diagnosed as Bubbles on the
wrong sheet cells (water room and Like-Like/Zol room).

## Known open bugs

None logged.

## Testing notes

- Vite full-page-reloads on every edit, which restarts the game and zeroes
  Link's keys and items. Re-run `__zelda.giveDungeon()` after any hot reload.
- Debug console helpers hang off `__zelda`: `giveAll`, `giveDungeon`, `godMode`,
  `noclip`, `warp(row,col)`, `goToRoom(id)`, `goToDungeon`, `killAll`,
  `keyInfo`, `saveNow`, `dumpSave`, `step(frames)`, `goToTitle`,
  `goToFileSelect`, `goToRegister`, `goToElimination`, `goToEnding`.
- Dev server this session: http://localhost:5175/ (5173 was taken).
- Mid-game SAVE menu: inventory open, hold Up + A (desktop: Arrow Up + X/Space).

## Session log

Newest first. Older 2026-09-06 notes are in `HISTORY.md`.

### 2026-09-06 — Playtest sign-off (Grok 4.6)

User stopped for the day after L4 sprite work. Re-enter L4 water / Like-Like
rooms to confirm Bubbles are orbs, not boomerangs.

### 2026-09-06 — L4 Bubbles were Goriya boomerang frames (Grok 4.6)

Water-room and Like-Like-room C-shapes were Bubbles. BUBBLE_SPRITES 290/299/308
were the boomerang spin frames; orbs are 321/338/355. Goriya was on those orbs
(real Goriya 222–273). Keese red/dark had been using Goriya cells; red Keese
is the y=28 bats. Like-Like room list 115 = Bubbles + Zols + Like-Likes.

### 2026-09-06 — L4 Vire used Pols Voice cells (Grok 4.6)

VIRE_SPRITES (270,90)/(287,90) were Pols Voice. Now (215,90)/(232,90).

### 2026-09-06 — Touch Select shortcut + name-entry DAS (Grok 4.6)

Overlay has no Select (DECISIONS #15). Game Over Up/Down; name-entry edge
Up/Down cycles files with 16-then-8 DAS so a tap does not skip END.

### 2026-09-06 — Lake Leevers replaced with Zoras (Grok 4.6)

Land enemies on water skipped. CheckZora places a Zora. Body #13–#16, shots
#17–#20.
