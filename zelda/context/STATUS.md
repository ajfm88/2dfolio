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
**Last updated:** 2026-09-09 · **Phase:** L (L2a1–L2a2 done; L2a3–L2a5 open) ·
**Slices:** L2a1+L2a2 done. M1 core in (hybrid fill parked). M2 in tree.
L2b blocked.

---

## Next action

**L2a3** (dungeon runtime). Recipe in `PLAN.md` under “L2a remaining”.

- `DungeonManager` takes a quest and selects `dungeonsQ2[curLevel-1]` + that row's
  `levelBlock` (`uw1q2`/`uw2q2`). The Q2 data landed in L2a2 and is unused so far.
- **The trap:** `dungeonsQ2` is indexed by NES CurLevel − 1, but `.level` is the
  *displayed* number and they disagree (Q2 displays `1,3,2,5,4,6,8,7,9`).
  `enterDungeon` must key off the AttrsB cave index, never `.level`.
- `DungeonRenderer` has no Q2 painting — donor-blit by `uniqueRoomId` from the Q1
  `dungeons-map.png` and log palette drift as an L2b gap.
- Room flags still key `uw1q1`/`uw2q1` (DECISIONS #13). Do **not** add `uw1q2` flag maps.
- Do **not** touch overworld secrets/caves/flute (L2a4) or enemies (L2a5).
- HISTORY 2026-09-05 is a ghost — the wiring it describes is **not in the tree**.

M1 hybrid fill policy is **parked** — user prefers whole device-pixel scaling as-is.

## Where the game stands

Winnable end to end (Q1). Title → file select → register → play → all 9
dungeons → Ganon → Zelda rescue → ending. Save/load works, audio works,
every entity renders with real sprites.

- **1313 tests pass.** One failure, pre-existing and unrelated: stale
  `recorder.test.ts` TeleportY case (expected 173, got 112).
  `digdogger.test.ts` "moves faster than the parent" is intermittently flaky.
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

### 2026-09-09 — HUD ghost fix + AJFM88 cheat code + Netlify npm fix (Claude Opus 4.6)

**HUD counter ghost:** `hud.png` had "X0" baked into the key/bomb counter areas.
When `BitmapFont` drew a new digit on top, the narrower glyph (e.g. "1") didn't
fully cover the baked "0". Fixed by blacking out all three counter areas
(rupees/keys/bombs) in `processHudImage` at init time. User confirmed fix.

**AJFM88 cheat code:** Registering the name "AJFM88" grants a full loadout on
game start: magic sword, all items (both boomerangs, silver arrows, red candle,
red ring, magic key, etc.), 999 rupees, 99 bombs (max raised to 99), 16 hearts,
all maps/compasses/triforce, letter delivered, red potion, 9 keys. Keys refill
to 9 on every dungeon entry. `nameIsCheatCode()` in `save-manager.ts`,
`applyCheatLoadout()` in `main.ts`, `Link.setMaxBombs()` added,
`restoreStats` bomb clamp raised to 99. User confirmed working.

**Netlify deploy fix:** `npm install` failed because lockfile was generated with
npm 11 (Node 24) but Netlify's Node 22 ships npm 10. Added `NPM_VERSION = "11"`
to `netlify.toml`.

**M1 hybrid fill parked:** User prefers whole device-pixel scaling as-is.

**M2 button press visuals:** Attempted sprite-sheet-cropped pressed overlays
from Frame 1 of controller2.png (matching zelda30tribute). User rejected the
look — reverted to the dark circle/rect overlays. M2 button visuals remain a
future polish item.

### 2026-09-09 — M1 responsive layout, core fix (Claude Opus 5)

User reported the game rendering as a small island mid-screen on a Galaxy Note 10+
in Samsung Internet, with the bottom hidden behind the touch pads.

Root cause was **integer CSS scaling**: `floor(innerWidth / 256)` is 1 for any
viewport under 512 CSS px, i.e. every phone in portrait. `devicePixelRatio` was not
consulted anywhere in the project. Second cause: the canvas was flex-centred in a
`min-height: 100vh` box, which Samsung Internet measures against the collapsed-
toolbar height.

Fix: new `src/render/canvas-layout.ts` with a pure `computeCanvasLayout()` (DOM-free
so it tests under the `node` vitest env — same reasoning as `transparency.ts`).
Scales in whole **device** pixels, canvas positioned absolutely and centred in the
band above the pads. `index.html` moves to `100dvh` + `viewport-fit=cover` + safe-area
vars + `touch-action: none`. Renderer now also listens on `visualViewport` and
`orientationchange`, rAF-debounced. 11 new tests; 1313 passing.

**The touch pads were deliberately left alone** (user instruction). Their negative
`left`/`right` offsets are intentional art bleed, not a bug. `touch-controls.ts` got
only an additive `TOUCH_PAD_RESERVE_PX` export and a `reservedBottomPx()` method.

Two things the next agent must not assume are finished:

- I told the user this fills "~95% of the width". **That was wrong** — it was true
  only for the dpr I assumed. Measured, it ranges 83–95% and drops to 68% at
  375px/dpr 2. The user then approved a **hybrid** policy (integer when it fills
  ≥ 90%, else fractional fill) — **that is approved but NOT implemented.**
- **Never tested on a real phone.** Desktop (verified: 3× at 1920×855, centred, no
  horizontal scroll) and DevTools emulation at 375×667/dpr 2 only.

`tests/render/canvas-layout.test.ts` uses dpr 2.625 as a representative phone; the
reporter's actual Note 10+ is more likely dpr 3.5 at a 412px viewport. The tests
exercise the maths, not that device profile.

### 2026-09-09 — L2a2 Q2 LevelInfo overlay + OW attr patches (Claude Opus 5)

Data only; nothing at runtime reads it yet. `extract-dungeons.ts` now also parses
`Z_06.asm` and emits **`dungeonsQ2`** — Q1's LevelInfo with
`LevelInfoUWQ2ReplacementsN` overlaid from offset `$29`/41 (`Z_06.asm:203`).
Verified the overlay is real: an earlier reading of `Z_06.asm:15-52` suggested Q2
shares LevelInfo wholesale, but that only describes the *load*, which
`UpdateMode2Load_Full` then patches in place. Display levels come out
`1,3,2,5,4,6,8,7,9` as predicted. `foeCounts`/`startY` sit below offset 41 and are
correctly inherited from Q1.

Two things the next agent should not re-derive:

- The NES copy loop writes `size+1` bytes and so reads one byte past each table.
  It only ever lands in `StatusBarMapTransferBuf`, which we don't model — ignored
  deliberately, commented in the script.
- `extractLevelInfo` used to pick the level block via the *displayed* level number.
  Harmless in Q1, a trap under the Q2 swap; it is now keyed on CurLevel for both.

New `scripts/extract-q2-overworld.ts` → **`src/data/q2-overworld.json`**
(`@PatchQ2Rooms`, `Z_06.asm:239`): 15 writes over 8 screens, emitted both raw and
decoded. Dungeon entrances move to screens 52/60/69 (CurLevel 3/2/4). The `$8B`
offset overruns AttrsB into AttrsC — preserved, see DECISIONS #17.

Q1 output is byte-identical apart from the added `dungeonsQ2` key (diffed before/
after). Typecheck clean, title screen renders, no console errors.

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
