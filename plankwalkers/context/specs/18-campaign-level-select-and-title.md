# Unit 18 — Campaign, Level Select and Title

> **Status: COMPLETE 2026-09-26** (closed by the player after a full keyboard
> playthrough; the phone run waits for the Netlify deploy, by the player's
> decision). Approved the same day. Decisions 1–4 and 7 are the
> player's (2026-09-26). The player approved the Proposed rows (6, 8, 9, 13) by
> asking for the unit to be built. The six levels are **our own designs**: the
> player ruled out porting Super Pirate World's maps (2026-09-26).

## What This Unit Builds

The game gets a front door and a campaign. After this unit:

- The app boots into a **Title** screen with **Play** and **Make**.
- **Level select** is one screen with two tabs, **Campaign** and **My Levels**.
  The My Levels tab is the Unit 17 screen, with a **Play** button added to every
  card. Play on the title opens the Campaign tab. Make opens My Levels.
- **Six campaign levels**, drafted by Claude as real maker exports and tuned by the
  player in the maker, ship in `src/data/campaign/`.
- Finishing a campaign level records **progress** (`storage/progress.js`): done,
  best time and best treasure. It survives a reload and shows on the card.
- A campaign card can **Play**, **Share** and **Edit a copy**. The copy lands in
  My Levels and opens in the maker.
- **Death returns to level select** in the campaign and in a level played from My
  Levels. Test-play from the maker still restarts at the spawn.
- The pause and results panels get **Level select**, and the campaign results
  panel gets **Next level**.

**Depends on:** Unit 17, and issue 29 (the treasure total) fixed first as its own
change. **Installs:** none.

## Constraints That Shape This Unit

1. **Campaign levels are maker exports** (invariant 2, Goal 3). Each file in
   `src/data/campaign/` must be exactly what **Export file** writes:
   `toJsonString` of a model. A test checks this, so a hand-edited or
   out-of-date file cannot slip in.
2. **Progress needs a stable key.** A tuned level comes back as an exported copy,
   and the copy has its own fresh id. If progress were keyed by the file's `id`,
   every tuning pass would orphan the player's progress. So the campaign manifest
   owns each level's id, and it overrides the file's.
3. **Scenes never import `storage/` or `ui/`.** Progress is recorded by the App
   through an injected `onComplete`, the same way the maker saves through
   `onSave`.
4. **`Stats.coins` wraps at 100** into an extra heart (the SPW port), so it cannot
   serve as "treasure collected". Issue 29 adds a non-wrapping total. This unit
   reads that total for the results panel's number and for progress.

## Decisions Settled Here

| # | Question | Decision |
| --- | --- | --- |
| 1 | Level select layout | **Decided (player, 2026-09-26):** two tabs, **Campaign** and **My Levels**. Resolves the overview/UI-context disagreement; the overview is already updated. |
| 2 | How the My Levels tab relates to the Unit 17 screen | **Decided (player):** they are one screen. The My Levels tab *is* the Unit 17 screen, with a Play button added to each card. Title → Play opens the Campaign tab, Title → Make opens My Levels. |
| 3 | Death | **Decided (player):** any death (hearts at 0, a pit, water) in the campaign or in a level played from My Levels **wipes back to level select**, on the tab the level came from. There is no death panel and no toast, because the iris closing on the frozen scene is the feedback. Test-play from the maker is unchanged and restarts at the spawn. |
| 4 | Campaign card actions | **Decided (player):** **Play**, **Share** and **Edit a copy**. The bundled level is never changed. Edit a copy saves a new level in My Levels (fresh id, the same name, `created = modified = now`) and opens it in the maker. |
| 5 | Campaign ids | `campaign_01` … `campaign_06`, set in `data/campaign.js` and **overriding the file's `id`** (Constraint 2). The progress key is this id. |
| 6 | Campaign length (Open Question 1) | **Proposed: six levels,** one per mechanic, listed under **Campaign Levels** below. The target stays five to eight. |
| 7 | Who authors the levels | **Decided (player):** Claude drafts them through `model.js` and `codec.js`, so each one is a real export, and the player tunes them in the maker (Edit a copy → Export file → the file replaces the draft). |
| 8 | Locking | **Proposed: every campaign level is open from the start**, and finished ones say **Done**. The overview does not mention locking, and a lock can strand a player on a level they find too hard. *Alternative:* level N+1 unlocks when N is done. That costs a locked card state and one more rule in the progress store. |
| 9 | Results panel buttons | **Proposed.** Campaign: **Next level** (primary, focused), **Play again**, **Level select**. On the last level, **Play again** is primary and there is no Next level. My Levels: **Play again** (primary), **Level select**. Test-play is unchanged: **Play again**, **Back to editor**. Enter on the panel activates the focused primary. |
| 10 | Pause panel | **Resume**, plus **Level select** in the campaign and My Levels (in place of Back to editor). |
| 11 | What progress records | `{ done, bestTreasure, bestTimeMs }` per campaign id. Best treasure and best time are each the best across finished runs, not necessarily from the same run. Only finished runs count. **My Levels play records nothing.** This renames the architecture's planned `bestCoins`; nothing has been stored under it yet. |
| 12 | Next level | A wipe from play to play. Music keeps playing, because only leaving play for another mode stops it. Hearts and coins start fresh, as they do on every `enter`. |
| 13 | Title screen | **Proposed:** a centred column over the sky fill. The wordmark "Coral Corsairs" sits on a `.panel--paper` (issue 21: text goes on paper), with **Play** (`.btn--primary`, focused) and **Make** (`.btn`) below it. There is **no settings button**, because the settings screen is Unit 19, and Sound stays in the level-select header. There is **no animated level backdrop**: that is canvas work, and the workflow splits canvas and DOM changes. |
| 14 | Level-select header | **Back** (to the title), the two tabs, then **Sound**. The My Levels tab adds **Import** and **New Level** (the one primary). The Campaign tab adds nothing. |
| 15 | Playing a stored level that has problems | Play from a My Levels card runs `findProblems` after loading. If there are any, it shows a toast "Can't play yet: `<first message>`" and stays on the list. (Unit 17 lets such levels be saved and imported.) |
| 16 | `M` in the campaign and My Levels play | Nothing, as decided in Unit 16. `M` needs `onEdit`, which only test-play has. |
| 17 | Where the level-select tab comes from | It is decided by the App on each entry. Title Play → Campaign, Title Make → My Levels, maker Back → My Levels, and play → the tab the level came from. The tab is not persisted. |

## Scope Boundary

This unit covers: the Title screen, level select with both tabs, playing from
either tab, `storage/progress.js`, `data/campaign.js` and six campaign levels,
Edit a copy and Share for campaign levels, death / quit / next-level routing, the
new pause and results buttons, and the App's `title` and `select` modes.

This unit does **not** cover:

- the treasure total itself (issue 29, fixed before this unit)
- the settings screen, a settings button, pause-menu settings (Unit 19)
- an animated title backdrop, a loading screen, level thumbnails, the theme on
  cards (it joins when Unit 20 adds a second theme)
- a "new best" highlight, campaign-wide totals, a world map
- locking (unless Decision 8 changes)
- persisting the selected tab or the list's scroll position
- any change to the level schema, `codec.js`, `model.js`, the entity registry,
  `core/*`, `world.js`, the maker scene or `storage/levels.js`

---

## Files

### New

| File | Role |
| --- | --- |
| `src/data/campaign.js` | `campaign`: `{ id, data }[]` in play order. Declarative; imports the JSON files. |
| `src/data/campaign/01-castaway-beach.json` … `06-cannon-cove.json` | The six levels, each byte-for-byte an **Export file** output |
| `src/data/campaign.test.js` | 5–8 entries; unique ids; each file canonical and playable (see below) |
| `src/storage/progress.js` | `createProgressStore(storage)` |
| `src/storage/progress.test.js` | Empty, record, best-of merging, malformed data, quota |
| `src/ui/format.js` | `formatTime(ms)` → `m:ss.cs`, moved out of `hud.js` now that the card needs it too |
| `src/ui/format.test.js` | Zero, sub-second, minutes, rounding down |
| `src/ui/screens/title.js` + `styles/title.css` | Title |
| `src/ui/screens/level-select.js` | The shell: header, Back, tabs, Sound, one dialog at a time, `destroy` |
| `src/ui/screens/campaign-tab.js` | Campaign cards |

### Renamed

| From | To | Change |
| --- | --- | --- |
| `src/ui/screens/level-list.js` | `src/ui/screens/my-levels-tab.js` | Loses its header and screen section. It returns its header actions (Import, New Level) for the shell to show, and each card gains **Play**. Everything else is unchanged. |
| `src/ui/styles/level-list.css` | `src/ui/styles/level-select.css` | `.level-list` → `.level-select`; tab styles; card actions wrap |

### Modified

| File | Change |
| --- | --- |
| `src/main.js` | Modes `title`, `select`, `maker`, `play`; boot on Title; play sources; progress wiring; play → play switch |
| `src/game/play-scene.js` | Optional `onQuit`, `onNext`, `onComplete` params; Enter on results runs `onNext` when present |
| `src/ui/hud.js` | Level select and Next level buttons; `formatTime` imported from `format.js` |

### Not modified

`src/level/*`, `src/core/*`, `src/maker/*`, `src/game/world.js`, `src/data/palette.js`,
`src/storage/levels.js`, `src/storage/safe-storage.js`, `tools/*`, `public/assets/*`.

---

## `src/data/campaign.js`

```js
import castawayBeach from './campaign/01-castaway-beach.json';
// … one import per level

/**
 * The campaign in play order. `id` is the progress key and overrides the file's
 * own id, so a tuned level re-exported from the maker drops in unchanged.
 * @type {{ id: string, data: import('../types.js').LevelData }[]}
 */
export const campaign = [
  { id: 'campaign_01', data: castawayBeach },
  // …
];
```

It is plain data with no behaviour, and it follows `main.js`'s precedent for JSON
imports (`atlas.json`). The App plays `{ ...entry.data, id: entry.id }`.

### `campaign.test.js`

- There are 5–8 entries, and the ids are unique.
- **Canonical:** `JSON.stringify(serialise(deserialise(data)))` equals
  `JSON.stringify(data)`. This proves the file is exactly what Export file
  writes, with nothing hand-added, reordered or left over from an older shape.
- **Playable:** `findProblems(deserialise(data))` is empty. That covers the flag,
  spawn and flag in usable cells, the object cap and known kinds.
- Every level uses the `island` theme (the only one until Unit 20).

---

## `src/storage/progress.js`

### Key

`cc:v1:progress` → `{ campaign: { [id]: { done, bestTreasure, bestTimeMs } } }`

### API

```js
/**
 * @typedef {{ done: boolean, bestTreasure: number, bestTimeMs: number }} LevelProgress
 * @param {ReturnType<typeof import('./safe-storage.js').createSafeStorage>} storage
 */
export function createProgressStore(storage) {
  return {
    /** @returns {LevelProgress | null} null when never finished or malformed */
    get(id) {},
    /**
     * A finished run: done, best treasure = max, best time = min.
     * @param {string} id
     * @param {{ treasure: number, timeMs: number }} run
     * @returns {import('./safe-storage.js').SetResult}
     */
    record(id, run) {},
  };
}
```

- The data is read and validated at the boundary on every call. An entry counts
  only if `done` is a boolean and both numbers are finite and non-negative.
  Anything else reads as `null`. Malformed JSON, or a missing `campaign` object,
  reads as empty.
- `record` keeps every other entry as it was, including ids the current campaign
  no longer has, so a later campaign reorder loses nothing.
- It never throws. The App passes a `'quota'` result to `report`, as the
  settings store's result already is.

---

## Play (`src/game/play-scene.js`, `src/ui/hud.js`)

### New optional params

```js
/**
 * onQuit:     () => void                        Level select on pause and results
 * onNext:     () => void                        Next level on results
 * onComplete: (run: { treasure: number, timeMs: number }) => void
 */
```

- `onComplete` is called once, from `update`, on the frame the world returns
  `'complete'`, with `world.stats.treasure` (issue 29) and `elapsedMs`. It is a
  callback, like `onDeath`. The App writes storage, and the scene touches nothing.
- Enter on the results panel (when no button has focus) runs `onNext` if it
  exists, otherwise `onReplay`. When a button has focus, Enter already clicks it
  (issue 19).
- These are passed through to the HUD next to `onEdit`. The scene still knows
  only that somewhere exists to go back to, not what it is.

### HUD panels

| Source | Pause | Results |
| --- | --- | --- |
| Test-play (`onEdit`) | Resume · Back to editor | Play again · Back to editor |
| Campaign, not last (`onNext`, `onQuit`) | Resume · Level select | **Next level** · Play again · Level select |
| Campaign, last level (`onQuit`) | Resume · Level select | **Play again** · Level select |
| My Levels (`onQuit`) | Resume · Level select | **Play again** · Level select |

Bold is the primary (`.btn--primary`, focused). The results panel's Treasure row
shows `stats.treasure` (issue 29). `formatTime` moves to `ui/format.js`.

---

## App (`src/main.js`)

### State

```js
/** @type {'title' | 'select' | 'maker' | 'play'} */ let mode;
/** @type {'campaign' | 'mine'} */ let selectTab = 'campaign';
/**
 * What is being played, which decides every play callback.
 * @type {{ kind: 'test' } | { kind: 'campaign', index: number } | { kind: 'mine', id: string } | null}
 */
let playSource = null;
const progress = createProgressStore(storage);
```

`'list'` becomes `'select'`, and every other Unit 17 flag stays.

### Boot

It is the same as Unit 17, except that once the atlas and audio load it enters
**Title**. A reload always lands there.

### Play callbacks, by source

| | test | campaign | mine |
| --- | --- | --- | --- |
| `onDeath` | restart | → select (Campaign) | → select (My Levels) |
| `onReplay` | restart | restart | restart |
| `onEdit` | → maker | — | — |
| `onQuit` | — | → select (Campaign) | → select (My Levels) |
| `onNext` | — | the next index, if there is one | — |
| `onComplete` | — | `progress.record(id, run)`, then report quota | — |

Every "→" is a `requestSwitch`, acted on after the scene update returns, as today.

### Switches

- `beginSwitch` allows **play → play** (Next level). It sets `playSource` and
  `playData` to the next level, and the wipe leaves and re-enters play under the
  iris. Music stops only when leaving play for a different mode.
- **Campaign Play:** `playSource = { kind: 'campaign', index }`,
  `playData = { ...campaign[index].data, id: campaign[index].id }`, then → play.
- **My Levels Play:** `levels.load(id)` (async; the Unit 17 `opening` guard), then
  `findProblems` (Decision 15), then `playData = serialise(level)`,
  `playSource = { kind: 'mine', id }`, then → play. A `LevelError` shows the same
  toast as Edit.
- **Edit a copy:** `deserialise` the campaign data, set `created = modified = now`,
  `levels.add(model)` (which gives a fresh id), then `report` the result. On
  success, `makerEntry = { level: model }` and → maker. Its Back goes to My
  Levels, where the copy is now the newest card.
- **Test-play** sets `playSource = { kind: 'test' }` in the maker's `onPlay`.
  Nothing else about the round trip changes.
- **Title:** Play → `selectTab = 'campaign'` → select. Make → `selectTab = 'mine'`
  → select. **Level select Back** → title. **Maker Back** → `selectTab = 'mine'`
  → select (the Unit 17 flush and leave-confirm are unchanged).

---

## Title (`src/ui/screens/title.js`)

```js
/** @returns {{ destroy: () => void }} */
export function createTitleScreen(root, { onPlay, onMake }) {}
```

- A full-viewport `section.title` with `pointer-events: auto`, over the canvas's
  sky fill, and a centred column with safe-area padding.
- The wordmark "Coral Corsairs" is at `--fs-xl`, in `--text` on a `.panel--paper`.
- **Play** is `.btn--primary` and focused on mount, so Enter or Space starts it.
  **Make** is a `.btn`. Both are the same width and at least 44 × 44.
- It uses no canvas, no scene and no timers.

## Level Select (`src/ui/screens/level-select.js`)

```js
/**
 * @param {HTMLElement} root
 * @param {{
 *   tab: 'campaign' | 'mine',
 *   campaign: { id: string, name: string }[],
 *   getProgress: (id: string) => LevelProgress | null,
 *   onBack: () => void,
 *   onPlayCampaign: (index: number) => void,
 *   onEditCampaignCopy: (index: number) => void,
 *   shareCampaign: (index: number) => Promise<string>,
 *   // …and every Unit 17 My Levels option (levels, storageMode, onNew, onEdit,
 *   // openSound, report, toast), plus onPlay: (id: string) => void
 * }} opts
 * @returns {{ destroy: () => void }}
 */
export function createLevelSelectScreen(root, opts) {}
```

### Layout

- `section.level-select` keeps everything Unit 17's `.level-list` had: full
  viewport, `--sky`, vertical scroll, `touch-action: pan-y`, safe areas.
- **Sticky paper header:** **Back**, then a `role="tablist"` with two `.btn`
  tabs (`role="tab"`, `aria-selected`), then **Sound**, then the active tab's own
  actions. The selected tab is drawn pressed, with an `--accent` bar under its
  label (`box-shadow: inset 0 calc(-3px * var(--ui-scale)) 0 var(--accent)`). A tab
  is not an action, so the selected one is never `.btn--primary`. The header
  wraps at narrow widths.
- The grid is unchanged from Unit 17 (`auto-fill`, 240 × ui-scale). Card action
  rows get `flex-wrap: wrap`, so four buttons (My Levels) or a long "Edit a copy"
  (Campaign) wrap instead of overflowing.
- Switching tabs swaps the grid's contents and the header's actions. It closes
  any open dialog and scrolls to the top.

### Campaign tab (`campaign-tab.js`)

```js
/** @returns {{ actions: HTMLElement[], destroy: () => void }} */
export function createCampaignTab(grid, ctx) {}
```

- Cards are listed in campaign order, each a `.panel--paper` `.level-card`:
  - the name (ellipsis, full name in `title`)
  - meta line 1: `Level 1 · Done`, or `Level 1 · Not finished yet`
  - meta line 2, when done: `Best 0:42.13 · 85 treasure` (`formatTime`)
  - **Play**, **Share** and **Edit a copy** (all `.btn`)
- Share opens the share dialog with `shareCampaign(index)`, which is
  `encodeShare(deserialise(data))`.
- `actions` is empty.

### My Levels tab (`my-levels-tab.js`)

It is Unit 17's `createLevelListScreen` with its header and section removed:

```js
/** @returns {{ actions: HTMLElement[], destroy: () => void }} */
export function createMyLevelsTab(grid, ctx) {}
```

- `actions` is **Import** and **New Level** (primary).
- Cards gain **Play** first: **Play**, **Edit**, **Share**, **⋯**.
- The memory-mode notice stays, shown above the grid.
- Rename, duplicate, export, delete and import are unchanged. Dialogs go through
  the shell's one-at-a-time slot.

---

## Campaign Levels

Six levels, island theme, each introducing one idea and then using it once more
with a twist. The sizes are a starting point for the drafts.

| # | File | Name | Size | Introduces |
| --- | --- | --- | --- | --- |
| 1 | `01-castaway-beach.json` | Castaway Beach | 100 × 16 | Run, jump, one- and two-tile gaps, coins, a first one-way platform, a water pool |
| 2 | `02-crabby-shallows.json` | Crabby Shallows | 130 × 16 | Crabby (go over it), water gaps up to three tiles, platforms over water, a diamond up high |
| 3 | `03-spike-ridge.json` | Spike Ridge | 140 × 20 | Spikes, Fierce Tooth (bait the lunge), a wall-jump chimney to an optional skull, a potion |
| 4 | `04-pearl-reef.json` | Pearl Reef | 150 × 20 | Seashells across lanes, dropping through platforms to dodge pearls |
| 5 | `05-starfall-cliffs.json` | Starfall Cliffs | 150 × 24 | Vertical climbing, wall jumps, Pink Star (no lazy stomps) |
| 6 | `06-cannon-cove.json` | Cannon Cove | 180 × 24 | Cannons, then everything together; the golden skull as the prize |

### Drafting rules

- **Reach**, from `tuning.js`: a full jump rises 450² / (2 × 650) ≈ 156 px
  (4.9 tiles) and covers about 138 px (4.3 tiles) of flat distance. The critical
  path uses **steps of at most 3 tiles** and **gaps of at most 3 tiles**. 4-tile gaps
  appear only in levels 5–6, and only on an optional route.
- Every level has a water row along the bottom, which sets the horizon, and a
  floor path from the spawn to the flag with no blind drops. A hazard on the
  critical path is always visible before the player commits.
- Enemies are at least 6 tiles from the spawn. Treasure marks the intended route,
  and the high-value pieces (diamonds, the skull) sit on optional routes.
- Drafts are built by a **scratch script in the session scratchpad** (not
  committed, and not a second authoring tool). It uses `createEmptyModel`, the
  model's setters and `toJsonString`, and gives each draft a fixed `created` /
  `modified` so the output is deterministic. From then on, the maker is the only
  tool that changes them.
- **Tuning loop (player):** Campaign → Edit a copy → change the level → ⋯ → Export
  file → the file replaces `src/data/campaign/NN-….json`. The manifest restores
  the campaign id, and `campaign.test.js` checks the file.

---

## Implementation Order

Each step is verified before the next starts.

0. **Before this unit, as its own change: issue 29.** Stats gains a non-wrapping
   treasure total, and the results panel shows it.
1. **Pure modules with tests:** `progress.js`, `format.js` (moving `formatTime`
   out of `hud.js`). `npm test` green.
2. **The spine:** App modes `title` / `select`, the Title screen, level select with
   the My Levels tab (the renamed Unit 17 screen, plus Back and the tabs) and an
   empty Campaign tab. Verify Title → Make → the maker → Back → My Levels, and
   Title → Play → Campaign.
3. **Playing from My Levels:** Play on the card, Decision 15, `onQuit`, death →
   select, and the pause and results buttons.
4. **The campaign path with one drafted level:** `campaign.js`, the Campaign tab,
   Play, progress on completion, Share and Edit a copy. With one level there is no
   Next level yet. It is verified in step 5.
5. **The other five levels,** then `campaign.test.js` at full count, then Next
   level through the whole campaign. Hand over to the player for tuning.
6. **Verify and update the docs.**

## Not Built

- A settings button or screen (Unit 19). Locking (Decision 8, unless changed).
- An animated title backdrop, a loading screen, thumbnails, the theme on cards, a
  "new best" highlight, campaign totals, a world map.
- Persisting the selected tab. Keyboard arrow keys between tabs: `input.js`
  consumes arrows on the page (Unit 17 risk note), so Tab and Enter are the
  keyboard path.

## Risks To Watch

- **Card width.** At 240 × ui-scale, four buttons or "Edit a copy" will not fit on
  one row. The rows wrap by design. Check at 590, 844 and 1200 px, and at UI scale 2.
- **A draft that cannot be finished.** The drafting rules keep the critical path
  inside the jump envelope, but only a playthrough proves it. Every level is
  played start to finish, on keyboard and on touch, before sign-off.
- **Play → play** is a new switch shape. Check that exactly one wipe runs, that
  nothing is pressed mid-wipe and replayed, that music does not dip, and that
  `playSource` and `playData` change together.
- **Progress keys.** Reordering the campaign later must keep each level's id with
  its level, not its position.

## Docs To Update In The Same Change

| File | Update |
| --- | --- |
| `1-project-overview.md` | First run steps 2–6 (Title, the two tabs, death → level select, results buttons); already partly done 2026-09-26 |
| `2-architecture.md` | Scene and Mode Model: Boot → Title → LevelSelect(tab) ⇄ Maker ⇄ Play, and play → play. Storage: `cc:v1:progress` shape with `bestTreasure`. `data/campaign.js` and the id override. `ui/screens/` list. |
| `3-ui-context.md` | Title and Level select layouts (merge the My Levels entry into Level select), the tab style, card contents per tab, wrapping action rows, pause and results buttons |
| `4-code-standards.md` | File organization: `storage/progress.js`, `ui/format.js`, the screens, `data/campaign.js` |
| `specs/00-build-plan.md` | The Unit 18 line matches this spec |
| `6-progress-tracker.md` | Unit entry, decisions, Open Question 1 resolved, Session Notes (boot is Title; `npm run dev` no longer opens the maker) |
| `7-current-issues.md` | Issue 29 closed first; anything found |

---

## Verification Checklist

### Title and navigation

- [x] A reload lands on Title. Play is focused, and Enter starts it.
- [x] Title → Play → Campaign tab. Title → Make → My Levels tab. Back → Title. Every switch wipes, and the UI is inert mid-wipe.
- [x] Maker Back → My Levels tab (the Unit 17 flush and leave-confirm unchanged)
- [ ] Tabs: switching swaps cards and header actions and closes an open dialog. Selected state is visible and announced (`aria-selected`).

### Campaign

- [x] Six cards in order. Unfinished ones say "Not finished yet".
- [ ] Play → the level. Finish it: the results panel shows the treasure total and time. Next level wipes into level 2 with the music continuous.
- [ ] After finishing, the card shows Done, best time and best treasure. A slower run with more treasure keeps the best of each. A reload keeps them.
- [ ] The last level's results panel has no Next level, and Play again is primary.
- [ ] Death by pit, by water and by hearts → level select, Campaign tab. Nothing is recorded for a death.
- [x] Pause → Level select → Campaign tab. `M` does nothing.
- [ ] Share → the code imports into My Levels and plays identically.
- [x] Edit a copy → the maker opens the copy. Back → it is the newest card in My Levels. Export file → identical to the campaign file apart from `id`, `created` and `modified`.
- [ ] **The whole campaign is finished start to finish on keyboard, and again on touch** (the player)

### My Levels

- [x] Play on a card plays the level. Its death, pause and results go back to the My Levels tab.
- [ ] A stored level with a buried spawn: Play shows "Can't play yet: …" and stays
- [ ] Unit 17 regression: New Level, Edit, Share, rename, duplicate, export, delete, import, Sound, the memory notice, storage full

### Test-play regression

- [ ] The maker round trip is lossless (3 round trips, undo and redo intact). Death restarts at the spawn. Back to editor and `M` work.

### Build

- [x] `npm test`: the prior 275 plus progress, format and campaign tests
- [x] `npm run build`: no errors. `getDiagnostics` clean on every touched file.
- [ ] No console errors or warnings in a full session
- [ ] Phone landscape (844 × 390), 590, 1200, and UI scale 2; touch emulation on and off. Card rows wrap cleanly; every button ≥ 44 × 44.

---

## As Built (2026-09-26)

Differences from the text above, found while building. Each one is already
reflected in the context files.

- **Facing entities all face left.** The maker places every facing entity with its
  `defaultProps` (`dir: -1`) and has no way to turn one around. A campaign level
  with `dir: 1` would be something the maker cannot reproduce, so every enemy and
  shooter in the drafts faces left, toward the player coming from the spawn.
- **End walls.** Nothing in the engine stops the player at a level's sides (logged
  as **issue 31**), so every campaign level has a full-height terrain column at
  both ends.
- **Finished runs are recorded after the scene update.** `onComplete` only stores
  the run (`finishedRun`), and the App records it after `playScene.update`
  returns, like a restart. Recording can open the storage-full dialog, and DOM
  work does not belong inside a scene update (invariant 3).
- **The Title focuses Play after the wipe.** A screen mounted under the wipe is
  inside the inert, veiled UI layer and cannot take focus. `createTitleScreen`
  returns `focus()`, which the App calls on mount when the layer is live, and
  again when a wipe ends on the Title.
- **The shell owns the memory notice**, and it shows on both tabs, because
  progress is lost with levels. Its text is now "Levels and progress will be lost
  when it closes." (the App's toast too). The My Levels tab asks the shell to
  re-check it after each refresh (`syncNotice`).
- **Shell types.** `level-select.js` exports `TabView` (`{ actions, destroy }`) and
  `ShowDialog` (the one-dialog slot), which both tabs use.
- **Share for a campaign level** builds the code inside a promise, so a level that
  fails to load becomes the share dialog's message instead of a throw.
- **Card action rows** sit at the bottom of the card (`margin-block-start: auto`),
  so cards in a row with and without a Best line line up.
- **The drafts** were built by a scratch script (session scratchpad, not
  committed) through `createEmptyModel`, the model's setters and `toJsonString`,
  with `created` and `modified` fixed at 2026-09-26. They hold 33–67 objects
  each and are 1.8–3.2 KB (14 KB in all). A second scratch script ran each one in
  the real simulation (`world.js`, `player.js`, `physics.js`, mock atlas) with a
  bot that holds right and jumps at walls and at drops with nothing to land on,
  with damage switched off. All six finish. It found four layout problems, now
  fixed:
  - a 1-wide landing after a 3-tile drop (level 1)
  - 2-wide platforms separated by 1-tile gaps, which a full jump overshoots
    (levels 2 and 6)
  - a pillar whose drop carried the player over the flag and off the level (6)

  Both optional chimneys (levels 3 and 5) were climbed with one scripted wall
  jump, and the skull was collected.
- **Issue 30 was found** by that bot: a sub-0.001 px overlap with a wall is never
  resolved, so the player can walk into terrain. The bot rounds positions to
  1/1024 px to measure the geometry rather than the bug. It is logged, not fixed
  here (a Unit 06 module).

### Verification (2026-09-26)

- **Automated:** `npm test` 308. `npm run build` is clean. TypeScript 5.9 over
  `jsconfig.json` reports nothing new against HEAD. The scratch bot finishes all
  six levels in the real simulation.
- **Browser harness:** scratch puppeteer-core, a fresh headless Chrome profile
  against the dev server, 844 × 390 unless noted. **84 of 84 checks pass:**
  - Title: boots there, Play is focused, Enter starts it, and focus returns
    after the wipe back.
  - Tabs: both tabs, their header actions and the empty state. The selected
    tab's accent bar is visible (fixed during verification: an inset shadow had
    been hidden under the nine-slice fill).
  - Campaign: six cards in order, Share (the code decodes to the level), Play,
    pause → Level select → Campaign tab, and a Done card with its bests.
  - Edit a copy: the stored copy equals the campaign level apart from id and
    dates, and maker Back lands on My Levels with the copy newest.
  - My Levels play: Play; the problem toast for a spawn in water; death →
    My Levels tab with no results panel; pause → Level select; the results
    panel with a treasure total, Play again focused and Enter replaying; no
    progress recorded; `M` doing nothing.
  - Regressions: Sound on both tabs, Duplicate and Delete, and a test-play
    round trip (`M`, a death that restarts in place, Back to editor, maker Back).
  - Layout at 844 × 390, 590 × 390, 1200 × 560 and 1280 × 720 (UI scale 2): 3,
    2, 4 and 2 columns, every button ≥ 44 × 44, no card action outside its
    card, and no horizontal scroll.
  - The console shows only the known `favicon.ico` 404 (issue 28).
- **The player** finished all six levels on the keyboard in Chrome the same day
  ("breathtaking stuff"). Their saved progress holds all six as done, with best treasure 90–154,
  so `onComplete` → progress works in play, and the treasure total (issue 29)
  goes past 100.
- **Found:** issue 32 (the font's `fi` / `fl` ligatures read as "A", including this
  unit's "Not finished yet"), logged. Issues 30 and 31 were found while drafting.
- **Not yet seen:**
  - The whole campaign on a phone. Deferred by the player until the game is
    deployed on Netlify.
  - Next level's music continuity, by ear.
  - The last level's results panel, as described by the player.
  - Rename, export, New Level and storage-full, which are unchanged Unit 17
    code moved into the tab.
  - Touch emulation of level select.
