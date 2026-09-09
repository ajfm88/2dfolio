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
**Last updated:** 2026-09-08 · **Phase:** L (L2a1 done; L2a2–L2a5 open) ·
**Slices:** L2a split into L2a1–L2a5; L2a1 done. M1/M2 in tree. L2b blocked.

---

## Next action

**L2a2 only** (data extract). Full recipe is in `PLAN.md` under “L2a remaining”.

- Spec: `Z_06.asm:203` LevelInfo overlays from offset `$29`; `@PatchQ2Rooms` at `:239`.
- Output: `dungeonsQ2` in `dungeons.json` + overworld attr patches. Tests for 2↔3 level swap and screen 52.
- Do **not** touch `DungeonManager` / renderer / secrets runtime (that is L2a3–L2a4).
- HISTORY 2026-09-05 is a ghost — the extract/wiring it describes is **not in the tree**.

## Where the game stands

Winnable end to end (Q1). Title → file select → register → play → all 9
dungeons → Ganon → Zelda rescue → ending. Save/load works, audio works,
every entity renders with real sprites.

- **1282 tests pass.** One pre-existing failure: stale `recorder.test.ts`
  TeleportY case (expected 173, got 112). Digdogger did not flake this run.
- **`src/` typecheck clean.** `npm run build` succeeds; JSON is bundled.

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

### 2026-09-08 — L2a1 Quest flag / ZELDA / ending wipe (Grok 4.6)

`nameStartsSecondQuest` (5-char `ZELDA`, `Z_02.asm:1683`). File-select draws a
small sword left of Q2 names. `switchToSecondQuest` now wipes inventory, world
flags, hearts, bombs (`Z_02.asm:4037`) so a beaten Q1 file does not keep the
Magical Sword. `currentQuest` set in `startGameFromSlot`. Not yet used by
dungeons/overworld. Next: L2a2 data extract.

### 2026-09-08 — Second Quest code audit (Grok 4.6)

PLAN L2a claimed full Q2 wiring. The tree has Q2 **data** (`uw1q2`/`uw2q2`
rooms, `questSecretByScreen`, save `quest` flag, `switchToSecondQuest` after
the ending) but **no runtime read of quest**. DungeonManager always
`dungeons[level-1]` (9 Q1 LevelInfos). `saveManager.register(slot, name)` never
passes quest 2 for "ZELDA". Tile-object `if (questSecret === 2) return`.
Stalfos constructed with `canShoot=false`. File-select draws name + deaths
only. Corrected PLAN/STATUS.

### 2026-09-08 — Production build for temporary Netlify (Grok 4.6)

User overrode #1 for a short-lived preview (#16). Applied only in
`zelda-nes-ts/`. (1) Unused `BTN_FRAME_PRESSED`. (2) tsconfig `include:
["src"]` + `noEmit`. (3) Game JSON imported in `main.ts` instead of
`fetch('/src/data/...')`. (4) `netlify.toml`: `npm run build` → `dist`,
Node 22. Verified `vite preview` on :4173 (HTML/JS/title/map/music 200;
bundle contains uniqueRoomId; no `/src/data/` fetch). 1282 tests pass;
recorder TeleportY still stale.

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
