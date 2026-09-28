# Unit 17 — Persistence and Sharing

> **Status: COMPLETE 2026-09-25** (player sign-off). Approved the same day. Decision 2: option A, as recommended. Decision 13:
> a Sound dialog on **My Levels only** (the player's call), not in the maker Menu.

## What This Unit Builds

Levels stop living only in memory. After this unit:

- The app boots into a **My Levels** screen: a grid of saved levels with **New
  Level**, **Import** and **Sound**. From a card you can edit, share, rename,
  duplicate, export and delete.
- The maker **autosaves** while you edit and saves again when you leave, before
  test-play and when the page is hidden. **Back** returns to My Levels.
- Reopening the level you last edited restores its camera, zoom and tool.
- **Share codes**: copy one from a card or from the maker Menu, and paste one (or
  a level's JSON) into Import.
- **`.json` export and import by file** on devices with a fine pointer.
- Music and effects volumes, set in a small **Sound** dialog, survive a reload
  (moved here from Unit 12).
- Private mode, blocked storage and a full quota all degrade with a readable
  message. None of them throws or loses work silently.

The storage modules are `storage/safe-storage.js`, `storage/levels.js` and
`storage/settings-store.js`, as the build plan names them.

**Depends on:** Unit 16. **Installs:** none.

## Constraints That Shape This Unit

1. **A goal-less level cannot be serialised.** `codec.serialise` throws when
   `goal` is null. Levels are stored as share codes, which go through `serialise`.
   The architecture already says "`goal` may be `null` only on a model that has
   never been serialised". So a brand-new level cannot be written to storage until
   its flag is placed. Decision 2 settles what that means for the user.
2. **Stored levels must load.** The maker places objects without a cap, but
   `validateLevel` rejects more than 400 entities. If autosave wrote such a level,
   it would be saved but could never be opened again. The same reasoning as
   Unit 16's proof-load applies (invariant 2): **a level is written only if it
   passes the schema.**
3. **Compression is async and the game loop is not.** `encodeShare` awaits
   `CompressionStream`, so every write finishes after the frame that asked for it.
   The maker only *requests* a save. The store serialises synchronously at call
   time, then encodes and writes later, and it must keep overlapping writes in
   order.
4. **Only `src/storage/` touches `localStorage`, only through `safe-storage.js`**
   (invariant 6). Scenes never import `storage/`. They get callbacks and dialog
   openers injected, the same pattern as the HUD and the resize dialog.

## Decisions Settled Here

| # | Question | Decision |
| --- | --- | --- |
| 1 | Where the app starts | **My Levels.** Title and level select are Unit 18. When they land, My Levels becomes the destination of **Make**. |
| 2 | When a level can be saved | **Decided (A), 2026-09-25: once it would load.** That means it has a finish flag and passes `validateLevel` (at most 400 objects). A new level lives only in memory until its flag is placed. Leaving it before then asks first, and a reload loses it. The toolbar hint becomes "Place the finish flag to play and save." *Alternatives:* **(C)** allow `goal: null` in stored levels. That is a format change: the schema, the codec, a `format` bump and a migration. **(H)** Pre-place the flag on every new level, as Mario Maker does. That reverses the Unit 13 decision and the overview's "user places the finish flag", and it removes the first-run hint. A needs no format, codec or invariant change, and its risk window is the minutes before the first flag. |
| 3 | Autosave timing | Save **1 s after the last edit**, or **5 s after the first unsaved edit** if edits keep coming. Never mid-drag. Timers run in fixed-timestep seconds. Also save on **Back**, **before test-play** and **when the page is hidden**. Nothing is written when nothing changed, so opening a level and leaving does not reorder the list. |
| 4 | What is saved besides the level | The resume point `cc:v1:maker:last` = `{ levelId, camX, camY, zoom, tool }`, exactly the architecture's shape. `tool` is a palette id or `null`, and the eraser is not persisted. **Undo history is not persisted**: a reopened level starts with an empty stack. |
| 5 | Does a reload reopen the maker? | **No.** Boot always lands on My Levels. The resume point applies when that level is opened again, and it is the first card because the list is newest-first. |
| 6 | Where renaming happens | **The level card only.** A rename inside the maker would be a model edit outside the command stack (invariant 7), and an undoable rename command is not worth it for v1. |
| 7 | New level names | Created with `name: ''` and shown as **"Untitled level"**. No name prompt, because Goal 2 is "build a level in under three minutes without instructions". |
| 8 | Imported level ids | **Always a fresh id** (`newLevelId`). Importing never overwrites. Importing the same code twice gives two levels. |
| 9 | What blocks an import | The codec's own validation (`decodeShare` / `fromJsonString`), plus `findProblems`' **`unknown-kind`** rule. This is the Unit 16 hand-off: a level from a newer version would otherwise lose objects silently. Playability problems such as a buried spawn do **not** block an import. The maker shows them as usual. |
| 10 | Share UX | **Share** opens a dialog with the code in a read-only `--font-code` field and a **Copy** button. Copy says "Copied" inline for 1.5 s (3-ui-context). If the clipboard is refused or missing, the code is selected and the message says to copy it manually. Copying needs the Copy tap as its own gesture, so nothing is copied automatically when the dialog opens. |
| 11 | What Import accepts | A share code **or** a level's JSON, told apart by a leading `{`. Whitespace is stripped from share codes, because codes pasted from chat apps arrive line-wrapped. |
| 12 | Where `.json` export and import show | Where `matchMedia('(pointer: fine)')` matches. The overview says "desktop also gets". Phones and tablets use share codes. |
| 13 | Where the volume controls live | **Decided 2026-09-25:** a small **Sound** dialog (Music and Effects sliders), opened from the **My Levels header only**. The maker Menu gets Share, not Sound. Unit 19's settings screen absorbs it later. |
| 14 | What `cc:v1:settings` holds | `{ music, sfx }` only. `controls` and `crispScale` are added by the unit that builds those features. Nothing is stored for a feature that does not exist. |
| 15 | Private mode, blocked storage, full quota | Blocked or unavailable storage: `safe-storage` switches to memory, and My Levels shows a notice for as long as it is in memory mode. Full quota: the save reports it, and **one** "Storage is full" dialog appears per episode (reset by the next successful write) with a **Copy share code** action so the level is not lost. |
| 16 | Dialog text on the wood board | This unit adds eight dialogs. **Issue 21 should be decided and fixed first** (see Implementation Order, step 0). If it is still open when the UI steps start, dialog body text and fields sit on an inner `.panel--paper`, which 3-ui-context already specifies for text inputs, and no `--text-muted` or `--text-display` text goes on the board. |
| 17 | `modified` in the index | The level's own `modified`, which every maker edit already stamps (`tools.js`, `commands.js`). The list sorts by it, newest first. |
| 18 | Transition between My Levels and the maker | The same circle wipe as test-play. Every mode switch goes through it (architecture, Scene and Mode Model). |
| 19 | Playing a level from My Levels | **Not in this unit.** Playing outside the maker is Unit 18's level select. Test-play from the maker is unchanged. |

## Scope Boundary

This unit covers: the three storage modules, the My Levels screen, autosave and
explicit saves, the resume point, rename / duplicate / delete, share-code copy and
import, `.json` export and import, the Sound dialog and volume persistence, a
generic dialog and a toast, and the storage failure paths.

This unit does **not** cover:

- the title screen, the level-select grid, playing from a card, `storage/progress.js`
  or campaign levels (Unit 18)
- the settings screen or pause-menu settings (Unit 19)
- level thumbnails, search, sorting options, multi-select, or a storage usage meter
- persisting undo history, or renaming from inside the maker
- `navigator.storage.persist()`, service workers or offline work (Unit 21)
- restyling the sliders with the kit's Sliders sprites. That needs an
  asset-pipeline change, so it is logged as an issue.
- migrating the resize dialog onto the new dialog helper (logged, not folded in)
- any change to the level schema, `codec.js`, `model.js`, the entity registry,
  `core/audio.js`, `core/input.js`, `world.js` or the play scene

---

## Files

### New

| File | Role |
| --- | --- |
| `src/storage/safe-storage.js` | `createSafeStorage(getBacking)`: get, set, remove and keys, with a memory fallback and quota reporting |
| `src/storage/safe-storage.test.js` | Normal use, a throwing getter, a throwing probe, mid-session failure, quota, key listing |
| `src/storage/levels.js` | `createLevelStore(storage)`: the index, levels as share codes, ordered async writes, the resume point |
| `src/storage/levels.test.js` | Round trip, synchronous snapshot, ordering, stale-write drop, delete guard, an uncompressed save landing within the same task, reconciliation, quota, resume validation |
| `src/storage/settings-store.js` | `createSettingsStore(storage)`: `{ music, sfx }` |
| `src/storage/settings-store.test.js` | Defaults, clamping, malformed data |
| `src/maker/import-level.js` | `readLevelText(text)` → `LevelModel`, or an `ImportError` with a user-facing message |
| `src/maker/import-level.test.js` | Share code, JSON, whitespace, bad input, newer format, unknown kind |
| `src/ui/screens/level-list.js` + `styles/level-list.css` | My Levels |
| `src/ui/components/dialog.js` | `openDialog` and `openConfirm`: overlay, focus trap, Escape and backdrop close, a `close` handle |
| `src/ui/components/rename-dialog.js` | Name field (Enter applies) |
| `src/ui/components/share-dialog.js` | Code field and Copy (styled by `dialog.css`) |
| `src/ui/components/import-dialog.js` | Paste field, Import, and *Choose file…* on a fine pointer |
| `src/ui/components/sound-dialog.js` + `styles/sound-dialog.css` | Music and Effects sliders |
| `src/ui/components/toast.js` + `styles/toast.css` | One toast at a time, bottom centre, 2.5 s |
| `src/ui/files.js` | `downloadText`, `fileNameFor` |
| `src/ui/files.test.js` | `fileNameFor` |

### Modified

| File | Change |
| --- | --- |
| `src/settings.js` | `AUTOSAVE_IDLE = 1`, `AUTOSAVE_MAX = 5` (seconds) |
| `src/maker/maker-scene.js` | Autosave timer, `flush()`, `saveBlocker()`, `resumePoint()`, the `resume` param, Share through an injected opener, `savedRevision` carried across the round trip |
| `src/maker/validate.js` + test | `no-goal` message: "Place the finish flag to play and save." |
| `src/maker/gestures.js` | Export `ZOOM_LEVELS`, so a stored zoom can be checked. No behaviour change. |
| `src/ui/maker-toolbar.js` | Menu gains **Share** above Resize Level |
| `src/ui/dom.js` | `onPageHidden(cb)`, `hasFinePointer()` |
| `src/ui/styles/dialog.css` | Shared `.field` rules for text inputs and textareas, including `user-select: text` |
| `src/main.js` | Three modes (`list`, `maker`, `play`), storage wiring, boot on My Levels, save reporting, flush on hide, resume, the leave-confirm and storage-full dialogs |

### Not modified

`src/level/*`, `src/data/*`, `src/game/*`, `src/core/*`, `src/ui/hud.js`,
`src/ui/touch-controls.js`, `src/ui/components/resize-dialog.js`, `tools/*`,
`public/assets/*`.

---

## `src/storage/safe-storage.js`

### API

```js
/**
 * @typedef {'local' | 'memory'} StorageMode
 * @typedef {'ok' | 'quota'} SetResult
 *
 * @param {() => Storage} getBacking  e.g. () => window.localStorage; may throw
 */
export function createSafeStorage(getBacking) {
  return {
    get mode() {},            // StorageMode
    /** @returns {string | null} */ get(key) {},
    /** @returns {SetResult} */     set(key, value) {},
    remove(key) {},
    /** @returns {string[]} every key starting with prefix */ keys(prefix) {},
  };
}
```

No method ever throws.

### Behaviour

- **Creation.** Call `getBacking()` and probe it by writing, reading and removing
  `cc:v1:probe`. If any step throws (a `SecurityError` from blocked storage, old
  Safari's private mode, or a store that is already full), start in **memory
  mode**. Before switching, copy every readable `cc:v1:` key into the memory map,
  so levels saved earlier stay visible even though new writes cannot persist.
- **`get` / `keys`** read the active store. A read that throws returns
  `null` / `[]`.
- **`set`:**
  - Success → `'ok'`.
  - A **quota** error (`name === 'QuotaExceededError'`, or legacy code 22 or
    1014) → `'quota'`, and the mode stays `local`. It must **not** fall back to
    memory here: that would report a save that a reload loses.
  - **Any other** error → copy into memory as above, switch to memory mode, write
    the value there, and return `'ok'`.
- **`remove`** never throws. In memory mode it only touches the map.
- Memory mode is one-way for the life of the page.

---

## `src/storage/levels.js`

### Keys

| Key | Contents |
| --- | --- |
| `cc:v1:levels:index` | JSON array of `LevelSummary` `{ id, name, theme, cols, rows, modified }` |
| `cc:v1:level:<id>` | The level as a share code, from `encodeShare` |
| `cc:v1:maker:last` | JSON `{ levelId, camX, camY, zoom, tool }` |

### API

```js
/**
 * @typedef {{ id: string, name: string, theme: string, cols: number, rows: number, modified: number }} LevelSummary
 * @typedef {{ ok: true } | { ok: false, reason: 'quota' }} SaveResult
 * @typedef {{ levelId: string, camX: number, camY: number, zoom: number, tool: string | null }} ResumePoint
 *
 * @param {ReturnType<typeof createSafeStorage>} storage
 */
export function createLevelStore(storage) {
  return {
    /** Newest first. Waits for in-flight writes, then reconciles. @returns {Promise<LevelSummary[]>} */
    list() {},
    /** @returns {Promise<LevelModel>} throws LevelError when the stored code is corrupt */
    load(id) {},
    /** @returns {string | null} the stored share code */
    getCode(id) {},
    /**
     * Serialises synchronously, before returning, so later edits to the model cannot
     * leak into this write. Never rejects.
     * @param {LevelModel} model
     * @param {{ compress?: boolean }} [opts]
     * @returns {Promise<SaveResult>}
     */
    save(model, opts) {},
    /** Fresh id, then save. Used by duplicate and import. @returns {Promise<SaveResult & { id: string }>} */
    add(model) {},
    /** Loads, sets the name, saves. @returns {Promise<SaveResult>} */
    rename(id, name) {},
    /** @returns {Promise<SaveResult & { id: string }>} */
    duplicate(id) {},
    /** Removes the level and its index entry; clears the resume point if it names it. */
    remove(id) {},
    /** @returns {ResumePoint | null} shape-validated; null when missing or malformed */
    loadResume() {},
    /** @param {ResumePoint} r */
    saveResume(r) {},
  };
}
```

### Rules

- **The synchronous snapshot.** `save` builds the index entry from the model and
  calls `encodeShare(model, opts)` before its first `await`. `encodeShare`
  serialises before its own first `await`, so the model is copied at call time.
  This dependency is covered by a test: mutate the model right after `save()`
  returns, then check the stored level does not have the mutation.
- **Ordered writes.** Each `save` takes a per-id sequence number. When its code is
  ready, it writes only if it is still the newest request for that id. Otherwise
  it resolves `{ ok: true }` without writing, because a newer save supersedes it.
  An in-flight set is tracked, and `list()` waits for it, so leaving the maker and
  landing on My Levels always shows the save that was just made.
- **Write order:** the level first, then the index. A `'quota'` on either one
  returns `{ ok: false, reason: 'quota' }`.
- **Delete guard.** `remove(id)` marks the id deleted, so an in-flight save for it
  resolves without writing. Otherwise a Back-save still encoding could bring back a
  level the user just deleted.
- **Duplicate:** load, `name = '<display name> (copy)'`, `created = modified = now`,
  then `add`.
- **Reconciliation in `list()`.** Read the index and validate every entry at the
  boundary. Drop malformed entries, and entries whose `cc:v1:level:<id>` key is
  missing. Then look for level keys with no index entry, decode each one to build
  its summary, and add it. Codes that fail to decode are left alone and not
  listed. Write the index back if anything changed. This one path covers a
  missing index, a corrupt index, a crash between the level write and the index
  write, and dangling entries. Normally there are no orphans, so nothing is
  decoded.
- **Resume validation:** `levelId` is a non-empty string, `camX`, `camY` and `zoom`
  are finite numbers, and `tool` is a string or `null`. Anything else gives
  `null`. Whether the zoom is a real zoom level and the tool a real palette id is
  checked by the maker, which owns those.

---

## `src/storage/settings-store.js`

```js
/** @param {ReturnType<typeof createSafeStorage>} storage */
export function createSettingsStore(storage) {
  return {
    /** @returns {{ music?: number, sfx?: number }} only the valid fields, clamped to 0..1 */
    load() {},
    /** @param {{ music: number, sfx: number }} s @returns {SetResult} */
    save(s) {},
  };
}
```

Missing fields are left out, so `core/audio.js` keeps its own defaults (0.4 and
0.7) and no default is written down twice. Malformed JSON loads as `{}`.

---

## `src/maker/import-level.js`

```js
export class ImportError extends Error {}   // message is shown to the user as-is

/** @param {string} text @returns {Promise<LevelModel>} */
export async function readLevelText(text) {}
```

1. Trim it. If it is empty, throw `ImportError('Paste a level code first.')`.
2. If it starts with `{`, use `fromJsonString(text)`. Otherwise use
   `decodeShare(text.replace(/\s+/g, ''))`.
3. A `LevelError` on `format` becomes "This level was made with a newer version of
   Coral Corsairs." Any other `LevelError` becomes "That isn't a valid level
   (`<err.message>`)." The message names the field, as the code standards require.
4. Run `findProblems` and collect the `unknown-kind` problems. If there are any,
   throw "This level uses objects this version doesn't have: `<k, k>`."
5. Return the model. The caller gives it a fresh id through `levels.add`.

It lives in `maker/` because it applies the maker's registry check. `ui/` may
import `maker/`, and `storage/` must not.

---

## Maker Scene (`src/maker/maker-scene.js`)

### New params

```js
/**
 * onSave:            (level, opts?: { immediate?: boolean }) => void — the App's save;
 *                    called with the live level, which the store snapshots synchronously
 * resume:            from cc:v1:maker:last, only when it names this level
 * openShareDialog:   (root, { name, code: Promise<string> }) => { close }
 */
```

### Save state

- `savedRevision`: the `stack.revision` last saved. With a session it is set to
  `session.stack.revision`, because `requestPlay` always saves first. Otherwise it
  is `0`.
- `idleTime` and `dirtyTime` are fixed-dt accumulators, reset whenever
  `stack.revision` changes.
- `canSave()`: `goal !== null`, and `validateLevel(serialise(level))` does not
  throw. It runs only when a save is due, never per frame.

### Autosave (end of `update`, after `refreshProblems`)

When `stack.revision !== savedRevision` and there is no drag, advance `idleTime`
and `dirtyTime`. When `idleTime >= AUTOSAVE_IDLE` or `dirtyTime >= AUTOSAVE_MAX`:
if `canSave()`, call `params.onSave(level)` and set `savedRevision`. If it cannot
save, reset both timers so it does not re-check every frame. The status line
already explains why.

### `flush(opts?: { immediate?: boolean })` → `'clean' | 'saved' | 'unsaveable'`

This is the explicit save, called by the App from DOM handlers (Back, page hidden)
and internally by `requestPlay`. If a drag is open it is closed first, with the
same `finalizeDrag` that `exit` uses. Then:

- not dirty → `'clean'`
- dirty and `canSave()` → `onSave(level, opts)`, then `'saved'`
- otherwise → `'unsaveable'`

`requestPlay` calls it after its own checks pass, so the level on disk always
matches the one being test-played.

### `resumePoint()` → `ResumePoint`

`{ levelId: level.id, camX, camY, zoom, tool: palette?.getSelectedEntry()?.id ?? null }`.

### `enter` with `resume` (no session)

- `zoom` is `resume.zoom` when it is in `ZOOM_LEVELS`, otherwise `1`.
- `activeTool` is `byId(resume.tool) ?? null`, and `erasing = false`.
- The camera is set to `camX` / `camY` and clamped (`panBy(0, 0, …)`), in place of
  `frameCameraOnSpawn`.
- The palette's `initial` is `{ group: activeTool.group, toolId: activeTool.id, erasing: false }`
  when a tool was restored.
  The palette already falls back to the first visible tab.

### Menu: Share

- **Share**: when `canSave()` passes, `code = encodeShare(level)`. Otherwise
  `code = Promise.reject(new Error('Place the finish flag before sharing.'))`, and
  the dialog shows that message.
- The handle joins `resizeDialog` and is closed in `unmountUI`.

`onBack` is unchanged in the scene. The App decides what Back does (see below).

---

## App (`src/main.js`)

### State

```js
let mode = 'list';               // 'list' | 'maker' | 'play'
let makerEntry = null;           // { level, resume? } for the next maker enter
let request = null;              // 'list' | 'maker' | 'play'
let appDialog = null;            // leave-confirm or storage-full: { close }
let storageFullShown = false;    // one dialog per episode
let memoryNoticeShown = false;   // one toast if the store drops to memory mid-session
```

### Boot

Create `storage = createSafeStorage(() => window.localStorage)`, the level store
and the settings store. Apply `settings.load()` to `audio.musicVolume` and
`audio.sfxVolume`. Once the atlas and audio load, `enterList()`.

### Modes

- **`list`**: `update` only calls `input.advance()`. `render` fills the view with
  the sky colour, the same fill as the loading state. The screen is mounted by
  `enterList()` and destroyed at the next switch's `onCover`.
- **`beginSwitch(target)`** generalises to three modes. `onCover` leaves the
  current mode (destroys the list, or unmounts and exits a scene), closes
  `appDialog`, and enters the target. Music behaviour is unchanged: play starts
  it, and leaving play stops it.

### Callbacks

- **List → New Level:** `makerEntry = { level: createEmptyModel() }`,
  `request = 'maker'`.
- **List → Edit:** `levels.load(id)` (async, compression). On success,
  `makerEntry = { level, resume }`, where `resume` is `levels.loadResume()` when its
  `levelId === id`. Then `request = 'maker'`. On a `LevelError`, show the toast
  "This level couldn't be opened (`<message>`)." A second tap while loading is
  ignored.
- **Maker `onSave(level, opts)`:**
  `levels.save(level, { compress: !opts?.immediate }).then((r) => report(r, level))`.
  `report` keeps the level, so the storage-full dialog's **Copy share code** can
  encode it.
- **Maker `onBack`:** `r = makerScene.flush()`, then
  `levels.saveResume(makerScene.resumePoint())`.
  - If `r` is not `'unsaveable'`, `request = 'list'`.
  - Otherwise open a leave-confirm dialog. Its body depends on whether the level
    is already stored:
    - "This level has no finish flag, so it can't be saved." (it is not stored)
    - "Your latest changes can't be saved until the level has a finish flag. The
      last saved version will be kept." (it is stored)
    - With more than 400 objects, the reason reads "…it has more than 400 objects"
      instead.

    The buttons are **Keep editing** (primary, focused) and **Leave**, which sets
    `request = 'list'`.
- **`report(result, level)`:**
  - On `quota`, when `storageFullShown` is not set: open the storage-full dialog.
    Its text is "Coral Corsairs couldn't save because this browser's storage for it
    is full. Delete levels you don't need in My Levels, or copy this level's share
    code to keep it safe." Its actions are **Copy share code** (opens the share
    dialog) and **OK**.
  - On `ok`: clear `storageFullShown`.
  - If `storage.mode` became `'memory'` and `memoryNoticeShown` is not set: toast
    "Saving isn't available in this browser window. Levels will be lost when it
    closes."
- **Page hidden** (`onPageHidden`), where a mobile browser may kill the tab:
  - In the maker: `makerScene.flush({ immediate: true })`, plus `saveResume`.
  - In play: `saveResume` from the held session.

  An immediate save is uncompressed. That path waits on no stream, so the write
  lands in a microtask of the same task, before the page can be frozen. The next
  autosave writes a compressed code over it.

---

## My Levels (`src/ui/screens/level-list.js`)

```js
/**
 * @param {HTMLElement} root
 * @param {{
 *   levels: LevelStore,
 *   storageMode: () => StorageMode,
 *   onNew: () => void,
 *   onEdit: (id: string) => void,
 *   openSound: (root: HTMLElement) => { close: () => void },
 *   toast: (text: string) => void,
 * }} opts
 * @returns {{ destroy: () => void }}
 */
export function createLevelListScreen(root, opts) {}
```

### Layout

The layout follows 3-ui-context's level-select pattern, so Unit 18 can grow from
it:

- A full-viewport `section.level-list` with `pointer-events: auto`, a `--sky`
  background, `overflow-y: auto`, `touch-action: pan-y`, and safe-area padding on
  every edge.
- **Sticky header** on a `.panel--paper` (as built; see As Built): the title "My Levels", then **Sound**
  (`.btn`), **Import** (`.btn`) and **New Level** (`.btn--primary`, the one primary
  on the screen).
- **Storage notice.** In memory mode, one `.panel--paper` line under the header:
  "Saving isn't available in this browser window. Levels will be lost when it
  closes."
- **Grid:** 2 columns under 600 px, 3 under 900 px, 4 above.
- **Card** (`.panel.panel--paper`):
  - The name, or "Untitled level", on one line with an ellipsis and the full name
    in `title`.
  - A `--fs-sm` meta line: `160 × 24 · Edited 25 Sep 2026`, from
    `toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })`.
  - Actions: **Edit**, **Share** and **⋯** (all `.btn`, each at least 44 × 44).
- **⋯** opens an options dialog titled with the level name: **Rename**,
  **Duplicate**, **Export file** (fine pointer only), **Delete** and **Cancel**.
  It is a dialog, not a dropdown, because a dropdown inside a scrolling grid gets
  clipped.
- **Empty state:** one paper panel reading "No levels yet. Press New Level to build
  one."

### Behaviour

- On create it calls `levels.list()` and renders. It re-renders after every rename,
  duplicate, delete or import.
- **Rename:** the rename dialog is prefilled with the current name, has
  `maxlength` 40 (a UI limit, not a format rule), and applies on Enter. An empty
  name is allowed and shows as "Untitled level".
- **Delete:** `openConfirm` with the title "Delete level?", the body
  "'`<name>`' will be gone for good.", and the buttons **Cancel** (focused) and
  **Delete**.
- **Share:** `openShareDialog` with `code: Promise.resolve(levels.getCode(id))`.
  The stored value is already a share code.
- **Export file:** `levels.load(id)`, then `downloadText(fileNameFor(name, id),
  toJsonString(model))`.
- **Import:** the import dialog calls `readLevelText`, then `levels.add`, then
  toasts "Imported '`<name>`'.". An `ImportError` shows inline in the dialog and the
  dialog stays open.
- Every result goes through the App's `report`, so quota is handled in one place.
- `destroy()` closes any dialog the screen opened (code standards: no DOM outlives
  its screen).

---

## Dialog, Toast and the Other Components

### `components/dialog.js`

```js
/**
 * @param {HTMLElement} root
 * @param {{
 *   title: string,
 *   body?: Node[],
 *   actions: { label: string, primary?: boolean, focus?: boolean, keepOpen?: boolean,
 *              onClick: () => void }[],
 *   onClose?: () => void,
 * }} opts
 * @returns {{ close: () => void }}   idempotent
 */
export function openDialog(root, opts) {}

/** Two buttons: cancel (focused), confirm. @returns {{ close: () => void }} */
export function openConfirm(root, { title, text, confirmLabel, cancelLabel, onConfirm }) {}
```

- It uses `.overlay` and `.panel`, a Tab focus trap over the panel's focusable
  elements, Escape, and a backdrop `pointerdown` that closes it. Clicking an
  action closes the dialog and then calls its `onClick`. This is the same
  behaviour as the resize dialog, now shared. The resize dialog itself is not
  migrated (logged).
- Every dialog in this unit is built on it: options, rename, confirm, share,
  import, sound, leave-confirm and storage-full.

### Share dialog

- A `<textarea readonly>` in `--font-code` with `word-break: break-all` and 3 rows.
  It shows "Preparing code…" until the promise settles.
- **Copy** is disabled until then. It calls `navigator.clipboard.writeText` inside
  a try/catch and shows "Copied" for 1.5 s. On failure it selects the text and
  shows "Couldn't copy. Select the code and copy it yourself."
- If the promise rejects, the field is replaced by the rejection message.

### Import dialog

- A `<textarea>` in `--font-code` with the placeholder "Paste a level code".
  **Import** is the primary button. Errors show inline in `--danger` on the paper.
- On a fine pointer there is also **Choose file…**: a hidden
  `<input type="file" accept=".json,application/json">`, whose `File.text()` result
  goes through the same `readLevelText`.

### Sound dialog

- Two native `<input type="range">` controls, 0–100 in steps of 5, labelled
  **Music** and **Effects**, each with a live percentage. They use
  `accent-color: var(--accent)`. The kit sprite thumb is logged as an issue.
- `input` sets the audio volume live. `change` calls `settings.save`.
- **Done** is the primary button.

### Toast

`showToast(root, text)` shows a bottom-centre `.panel--paper` with safe-area
padding and `role="status"`. A new toast replaces the current one. It dismisses
after 2.5 s. `setTimeout` is fine here, because this is UI, not the game loop.

### `ui/files.js`

- `downloadText(filename, text)`: a Blob, an object URL, a temporary `<a download>`
  that is clicked, then the URL is revoked.
- `fileNameFor(name, id)`: lowercase, runs of anything other than `a-z0-9`
  replaced by `-`, trimmed of dashes, at most 40 characters, then `.json`. It falls
  back to the id when the result is empty. Pure and tested.

### `ui/dom.js`

- `onPageHidden(cb)` calls `cb` on `visibilitychange` to hidden and on `pagehide`,
  and returns an unsubscribe function.
- `hasFinePointer()` returns `matchMedia('(pointer: fine)').matches`.

### Text fields (`dialog.css`)

`html, body` set `user-select: none`, which on iOS stops a field from being
selected, copied or pasted into. `.field` (inputs and textareas) resets
`user-select: text` and `-webkit-user-select: text`, and gets an `--ink` inset
border on `--paper`, per 3-ui-context. `input.js` already leaves keys in form
fields alone.

---

## Implementation Order

Each step is verified before the next starts.

0. **Before this unit, as a separate change: decide and fix issue 21.** This unit
   adds eight dialogs with text on the board. If it is still open, apply the
   fallback in Decision 16.
1. **Pure and storage modules with tests:** `safe-storage`, `levels`,
   `settings-store`, `import-level` and `fileNameFor`. `npm test` green.
2. **The spine.** Three modes in the App, a read-only My Levels (New and Edit), the
   Back → list switch, autosave, `flush`, the resume point and the hide flush.
   Verify that a level survives a reload.
3. **Card actions:** the dialog helper, toast, rename, duplicate and delete.
4. **Sharing:** the share dialog (card and maker Menu), the import dialog (paste
   and file), and export.
5. **Sound:** the Sound dialog and settings persistence.
6. **Failure paths:** the memory-mode notice, the storage-full dialog and the
   leave-confirm.
7. **Verify and update docs.** The full checklist below, then the doc list.

## Not Built

- Title, level select, playing from a card, progress, campaign (Unit 18). Settings
  screen (Unit 19).
- Persisted undo history, renaming from the maker, a name prompt for new levels.
- Thumbnails, search, sorting options, a storage meter, bulk delete.
- Share links or `?code=` URLs. Sharing stays copy-paste text.
- `navigator.storage.persist()` and offline work (Unit 21).
- Kit-sprite slider thumbs, and moving the resize dialog onto `openDialog` (both
  logged).

## Risks To Watch

- **iOS Safari evicts script-written storage** after 7 days without a visit
  (unless the site is installed to the home screen), so levels can vanish. Share
  codes and export are the user's backup. `storage.persist()` and the PWA are
  Unit 21. Add this to the known-risk watchlist.
- **Testing a phone over the LAN** (`http://192.168…`) is not a secure context, so
  `navigator.clipboard` is missing there and the Copy fallback runs. It is also a
  different origin from `localhost`, so levels do not carry between the two.
  Neither of these is a bug.
- **The on-screen keyboard in landscape** can cover a centred dialog. Check the
  rename and import dialogs on a real phone.
- **Arrow keys on My Levels** are consumed by `input.js` (preventDefault) even
  though nothing uses them, so they do not scroll the list. Tab and touch still
  work. Note it if it bothers the player; do not change `input.js` in this unit.

## Docs To Update In The Same Change

| File | Update |
| --- | --- |
| `2-architecture.md` | Storage Model: settings is `{ music, sfx }` for now, the index `modified` is the level's own, what `maker:last` does, the write-only-if-it-loads rule, memory mode and quota behaviour. Scene and Mode Model: Boot → My Levels ⇄ Maker ⇄ Play, with Title and LevelSelect in Unit 18. `storage/` and `ui/screens/` descriptions. `goal`: "a goal-less level is never written to storage". |
| `1-project-overview.md` | Making a level: Back goes to My Levels, autosave starts once the flag is placed, and Share is in the Menu. Persistence: rename is on the card. |
| `3-ui-context.md` | The My Levels layout, the dialog and toast components, `.field` with `user-select: text`, the share and import fields, and the Sound sliders (native, with `accent-color`, until the sprite thumb lands). |
| `4-code-standards.md` | Constants: `AUTOSAVE_*`. Async: add "file reading (import by file)". File organization: the new storage, ui and maker files. |
| `specs/00-build-plan.md` | Unit 17 line matches this spec, including the Sound dialog if Decision 13 stands. |
| `6-progress-tracker.md` | Unit entry, decisions and Session Notes. |
| `7-current-issues.md` | The slider sprite thumb, the resize-dialog migration, and anything else found. The iOS eviction risk goes on the watchlist. |

---

## Verification Checklist

### Persistence

- [ ] New Level → paint → place the flag → wait 1 s → reload: the level is on My Levels and opens byte-identical (`toJsonString` matches)
- [ ] Continuous painting for 10 s saves at least once (the 5 s cap)
- [ ] No write happens mid-drag. A stroke is saved whole after release.
- [ ] Opening a level and pressing Back without editing does not change its place in the list
- [ ] Back right after an edit: My Levels already shows the change (`list()` waits for the write)
- [ ] Test-play, then reload during play: the level has everything made before Play
- [ ] Hiding the tab (switching tabs, or a phone's app switcher) right after an edit, then killing and reopening: the edit is kept
- [ ] Reopening the last-edited level restores the camera, zoom and tool. Another level opens framed on its spawn at 1×.
- [ ] A new level with edits but no flag: Back asks, Keep editing stays, and Leave discards it (it is not listed)
- [ ] A saved level with its flag undone: Back asks with the "last saved version is kept" wording
- [ ] 401 objects (by import or by hand): not saved, and Back asks with the object-count wording
- [ ] The status reads "Place the finish flag to play and save." on a fresh level

### My Levels

- [ ] Empty state on first run. Cards newest first. Long names ellipsise, with the full name in `title`.
- [ ] Rename (Enter applies, Escape cancels, empty shows "Untitled level"), Duplicate ("(copy)", new id, at the top), Delete (confirm, gone after a reload)
- [ ] Deleting the resume level clears the resume point. Deleting right after a Back-save does not bring the level back.
- [ ] 2, 3 and 4 columns at 590, 844 and 1200 px wide. Every button is at least 44 × 44. Safe areas are respected. The list scrolls by touch.
- [ ] My Levels ⇄ maker uses the wipe in both directions, and the list is inert while it runs

### Sharing

- [ ] Share from a card and from the maker Menu: Copy says "Copied", and the pasted text decodes
- [ ] Share from the maker without a flag shows the reason, not a code
- [ ] Import a share code into **another browser profile**: it appears, opens, and plays identically
- [ ] Import the same code twice: two levels with different ids
- [ ] Import JSON pasted as text, and import a `.json` file (desktop). Export a file and re-import it: byte-identical apart from `id`.
- [ ] A code with line breaks in it imports. A garbage code shows the field-naming error inline. A `format: 2` level says "newer version". An unknown kind names the kind.
- [ ] Clipboard refused (via DevTools permissions): the fallback selects the code and says so
- [ ] Export and Choose file are hidden with touch emulation (coarse pointer)

### Sound

- [ ] Sliders change volume live (music heard in test-play, effects on the next jump)
- [ ] Both values survive a reload. Setting 0 mutes, and no errors occur.

### Failure paths

- [ ] Site data blocked for the dev origin (Chrome site settings): the notice shows, levels work until the tab closes, and no console errors occur
- [ ] Quota filled from the console: an edit shows the storage-full dialog **once**, Copy share code works, and freeing space then editing saves again without a second dialog
- [ ] A corrupt `cc:v1:levels:index` (hand-edited in DevTools) is rebuilt from the level keys. A corrupt level code is not listed, and nothing throws.

### Regression and build

- [ ] Unit 16's round trip is still lossless (spot check: 3 round trips, undo and redo tail intact)
- [ ] Painting, gestures, eyedropper, resize, `M`, the rotate prompt
- [ ] `npm test`: the prior 235 plus the new storage, import and files tests
- [ ] `npm run build`: no errors. `getDiagnostics` is clean on every touched file.
- [ ] No console errors or warnings in a full session
- [ ] Phone landscape (844 × 390) and desktop, touch emulation on and off. A real phone for the keyboard over the rename and import dialogs, and for the hide flush.

---

## As Built (2026-09-25)

Differences from the text above, found while building. Each one is already
reflected in the context files.

- **Sound is on My Levels only** (Decision 13). The maker Menu has Share and
  Resize Level, and the maker has no Sound opener.
- **`SaveResult` has a third case**, `{ ok: false, reason: 'invalid' }`, for a level
  `encodeShare` refuses. The maker never saves one (it checks `saveBlocker()`
  first), so the App shows a plain "couldn't be saved" toast if it ever happens.
- **The store gained `has(id)`**, for the leave-confirm wording and the resume
  write. **`duplicate(id, name)`** takes the copy's name from the UI, so storage
  holds no display text.
- **The maker gained `saveBlocker()`**, which returns `'it has no finish flag'`,
  `'it has more than 400 objects'`, or a schema message. `canSave()` is
  `saveBlocker() === null`. The leave-confirm text is "This level can't be saved:
  `<reason>`. If you leave, it will be lost." or "Your latest changes can't be
  saved: `<reason>`. The last saved version will be kept."
- **The resume point is written only for a level that is saved or being saved**
  (`flush` returned `'saved'`, or `has(id)`). Otherwise a discarded new level would
  overwrite the resume point of the level before it.
- **Every dialog body sits on an inner paper sheet, and the My Levels header and
  cards are paper too** (Decision 16's fallback, since issue 21 is still open). The
  board fill is `--wood` (`#ae7764`), where ink text reaches only 3.4:1. On paper
  it reaches 7.4:1. **There is no ghost button**: a bare label on the wood would be
  unreadable, so Cancel is a framed `.btn`. Error text stays ink with a `--danger`
  bar, because `--danger` text on paper is only about 2.4:1.
- **The grid is `repeat(auto-fill, minmax(240 × ui-scale, 1fr))`**, not fixed
  breakpoints. At UI scale 1 that gives 2 columns at 590 px, 3 at 844 and 4 at
  1200. At UI scale 2 the cards are twice as big, so a 1280 × 720 window shows 2.
- **Dates use `en-GB`**, which current Chrome renders as "25 Sept 2026".
- **Verification** used a scratch headless-Chrome harness (the Chrome extension was
  not connected). It drove the real app with mouse, keyboard and DOM events, over
  four browser profiles (normal, a second profile for import, blocked storage, and
  a quota fault injected into `Storage.prototype.setItem`). 60 of its 61 checks
  passed. The one failure was the harness's own date regex. Screenshots were
  checked at 844 × 390, 1200 × 560 and 1280 × 720. Not seen here, so it needs the
  player: a real phone (the keyboard over the rename and import dialogs, the hide
  flush when the app is switched away, the clipboard on a LAN http origin), the
  wipe look between My Levels and the maker, and audio by ear.
