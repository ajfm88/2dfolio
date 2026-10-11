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
**Last updated:** 2026-10-09 · **Phase:** L (L2a1–L2a2 done; L2a3–L2a5 open).
**Slices:** L2a1+L2a2 done. M1/M2 in tree. L2b blocked.

---

## Next action

**L2a3** (dungeon runtime) in `zelda-nes-ts/`. Recipe in `PLAN.md` under
“L2a remaining”.

- `DungeonManager` takes a quest and selects `dungeonsQ2[curLevel-1]` + that row's
  `levelBlock` (`uw1q2`/`uw2q2`). The Q2 data landed in L2a2 and is unused so far.
- **The trap:** `dungeonsQ2` is indexed by NES CurLevel − 1, but `.level` is the
  *displayed* number and they disagree (Q2 displays `1,3,2,5,4,6,8,7,9`).
  `enterDungeon` must key off the AttrsB cave index, never `.level`.
- `DungeonRenderer` has no Q2 painting — donor-blit by `uniqueRoomId` from the Q1
  `dungeons-map.png` and log palette drift as an L2b gap. Look donors up through
  `roomMapCell()` (the `uw2q1` half of the PNG has its 8-column halves swapped,
  DECISIONS #23). **Q2 unique rooms 11, 16, 32 have no Q1 donor anywhere** — they
  need a fallback. Blank-floor layout 38 is already repainted from data.
- Room flags still key `uw1q1`/`uw2q1` (DECISIONS #13). Do **not** add `uw1q2` flag maps.
- Do **not** touch overworld secrets/caves/flute (L2a4) or enemies (L2a5).
- HISTORY 2026-09-05 is a ghost — the wiring it describes is **not in the tree**.

For **L2a4** later: `OverworldManager.isOnWarpTile` + `getDungeonLevel` /
`getScreenCaveIndex` are where quest-aware entrance tables plug in, and the
`@PatchQ2Rooms` AttrsA writes must be applied to `enemy-spawns.json`
`overworldZoraScreens` (Q1-only today).

M1 hybrid fill policy is **parked** — user prefers whole device-pixel scaling as-is.

## Where the game stands

Winnable end to end (Q1). Title → file select → register → play → all 9
dungeons → Ganon → Zelda rescue → ending. Save/load works, audio works.
No known placeholder objects remain (Q1): every spawned type has NES behaviour
and a real sprite as of 2026-10-09 (dungeon people, Grumble, rupee stash,
Moldorm, Dodongo ×3, Pond Fairy, Boulders).

- **1459 tests pass.** One failure, pre-existing and unrelated: stale
  `recorder.test.ts` TeleportY case (expected 173, got 112).
  `digdogger.test.ts` "moves faster than the parent" is intermittently flaky.
- **`src/` typecheck clean.** `npm run build` succeeds; JSON is bundled.
- **Lint:** 4 pre-existing errors (`ghini.ts` useless constructor, `link.ts`
  unused `moved`, two `any` in `dungeon-collision.ts`), ~210 warnings.

## Known open bugs

- User reported "bugs and errors" in the snowy mountains beyond the boulders —
  not reproduced; ask what they saw.
- **Pushed rocks don't visibly move.** Generic tile overrides re-blit the original
  map tile, so the rock still shows at its start square (now floor, walkable) and
  the destination looks empty but blocks (collision honours overrides since
  2026-10-09). `tile-renderer.ts renderOverrideTile`.
- **Potion refill is ~5× too fast**: `HEART_REFILL_INTERVAL` gives a half heart
  every 4 frames; NES `World_FillHearts` is +6/256 per frame (≈21 frames per half
  heart — the Pond Fairy already uses the NES rate).
- Cosmetic: no NES "rise out of the cave mouth" animation on cave/dungeon exit.

## Testing notes

- Vite full-page-reloads on every edit, which restarts the game and zeroes
  Link's keys and items. Re-run `__zelda.giveDungeon()` after any hot reload.
- Debug console helpers hang off `__zelda`: `giveAll`, `giveDungeon`, `godMode`,
  `noclip`, `warp(row,col)`, `goToRoom(id)`, `goToDungeon`, `killAll`,
  `keyInfo`, `saveNow`, `dumpSave`, `step(frames)`, `goToTitle`,
  `goToFileSelect`, `goToRegister`, `goToElimination`, `goToEnding`,
  `registerTest(slot,name)`, `startGame(slot)`.
- `registerTest(0,'AJFM88'); startGame(0)` gives the full cheat loadout.
- A background tab pauses the game loop; drive it with `__zelda.step(frames)`.
- `giveDungeon()` requires being in a dungeon; use `goToDungeon(1)` first.
- `goToRoom(id)` puts Link on the south edge — if that door is open he walks
  straight into the next room; move him (`__zelda.link.setPosition`) first.
- `warp()` from inside a dungeon keeps dungeon mode; `startGame(0)` first.
- Mid-game SAVE menu: inventory open, hold Up + A (desktop: Arrow Up + X/Space).

## Session log

Finished sessions live in `HISTORY.md` (oldest first; latest entries 2026-10-09).
Add the next session's entry here, then move it to HISTORY when it is done.
