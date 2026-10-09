# Current Issues

The live defect and follow-up queue. Everything found but not fixed lands here.

## How to Use This File

- When a bug is found outside the current unit's scope, **add it here and keep
  going**. Do not fix it inside an unrelated unit.
- When a unit deliberately leaves something incomplete, add it here before marking
  the unit complete.
- When an issue is fixed, move it to **Resolved** with the date and what changed.
- Do not delete entries. This file is the record of what went wrong and why.

## Entry Format

```markdown
### N. Short Title [OPEN | IN PROGRESS | PENDING TEST | FIXED]

**Where:** file or area
**Symptom:** what is observed, not what is guessed
**Expected:** what should happen
**Repro:** the shortest sequence that shows it
**Notes:** anything already ruled out
```

State meanings: `OPEN` — not started. `IN PROGRESS` — being worked. `PENDING TEST`
— code changed, not yet verified by running the game. `FIXED` — verified, ready to
move to Resolved.

## Scope Rules for a Fix

- Fix only what the entry describes.
- Do not refactor surrounding code while fixing a bug.
- Do not change the level schema, the entity registry or an invariant to make a fix
  easier. If the fix requires one of those, stop and say so.
- Add a regression test if the fix is in a tested module — `codec`, `autotile`,
  `schema`, `physics`.
- `npm run build` and `npm test` pass before the entry moves to Resolved.

## Open Issues

### 4. Touch-control layout looks off at phone width [OPEN]

**Where:** `src/ui/styles/touch-controls.css` (Unit 09)
**Symptom:** At a narrow phone viewport the on-screen controls sit awkwardly — the D-pad cluster (left/right with `down` spanning below) and the jump button do not feel well balanced for thumbs. Seen in device emulation during the Unit 09 check.
**Expected:** A comfortable, thumb-reachable control layout at phone widths in both orientations.
**Repro:** Open `/` in device emulation (phone), tap once to reveal controls.
**Notes:** Deferred by the player during Unit 09 ("we can worry about that once the game is completed"). Functionality is correct (movement, jump, drop-through, multi-touch all work); this is layout/ergonomics only. Handle in the responsive pass (around Unit 15 maker UI / a later polish unit), not inside an unrelated unit. Do not change the input wiring — CSS/layout only.

---

### 5. Throwaway atlas debug page still in the tree [OPEN]

**Where:** `atlas.html`, `src/debug-atlas.js`, `src/ui/styles/debug-atlas.css` (Unit 01)
**Symptom:** The Unit 01 clip-verification page is still in the source tree with no decision recorded either way. Unit 01's tracker entry says "`/atlas.html` is removable" once `core/atlas.js` landed; Unit 02's says "`/atlas.html` kept" without saying why or for how long. Nothing since has revisited it, so it reads as an oversight rather than a choice.
**Expected:** Either deleted — its job, proving every clip packs with the right frame count, is done and `core/atlas.js` now covers the runtime path — or explicitly kept as a dev-only tool with that decision recorded here and in the tracker.
**Repro:** `ls atlas.html src/debug-atlas.js src/ui/styles/debug-atlas.css`; run `npm run dev` and open `/atlas.html`.
**Notes:** Found during a context review on 2026-09-16, not during a unit. **It does not ship:** `vite.config.js` declares no extra Rollup input, so the production build has `index.html` only — `dist/` was checked and contains no `atlas.html`. Nothing in `src/main.js` imports `debug-atlas.js`; the page is reachable only through the dev server. So the cost is three unreferenced files, not bundle weight. Useful again whenever `tools/asset-manifest.mjs` gains clips (Units 10, 11, 20), which is an argument for keeping it — decide then, and do not fold the deletion into an unrelated unit.

---

### 6. `jsconfig.json` `baseUrl` is deprecated and now reports as an error [OPEN]

**Where:** `jsconfig.json` line 9 (Unit 00)
**Symptom:** The editor's TypeScript service reports, against `jsconfig.json` itself:
"Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0. Specify compilerOption '\"ignoreDeprecations\": \"6.0\"' to silence this error." Severity is **Error**, so `getDiagnostics` is no longer clean for the project even when every source file is.
**Expected:** A clean diagnostics run, and a `jsconfig.json` that still resolves imports the same way after TypeScript 7.
**Repro:** Run `getDiagnostics` with no file argument.
**Notes:** Found during Unit 10, caused by an editor TypeScript upgrade, not by any code. `"paths"` is `{}` and every import in `src/` is relative, so `baseUrl` is doing nothing — deleting both keys is very likely the whole fix, and is strictly smaller than adding `ignoreDeprecations`. Not done inside Unit 10 because `jsconfig.json` is Unit 00's file and this is unrelated to walker enemies. TypeScript is not a project dependency (`npx tsc` is unavailable), so verify the fix through the editor's diagnostics.

---

### 8. Fixture cannonball always bursts on the pillar, never on lifetime [OPEN]

**Where:** `src/data/fixtures/play-demo.js` — cannon (53,12) + pillar (col 49, rows 11-12)
**Symptom:** The Unit 11 spec's verification checklist expects "a dodged cannonball
dies on lifetime showing `ball-dead`", but with the placement the spec itself
dictates, the pillar at col 49 sits directly in the left-firing cannon's line at
muzzle height, so **every** ball bursts on it (`ball-explode`). There is no player
position that both triggers the cannon (in range + in front + level) and leaves the
ball an unobstructed 450 px (3 s × 150) of travel, so `ball-dead` never shows in
this fixture during normal play.
**Expected:** The fixture demonstrates both cannonball death clips, per the checklist.
**Repro:** Play to the flag run-up; trigger the cannon from anywhere left of it —
the ball always explodes on the pillar.
**Notes:** The fixture was built **exactly** to the spec's placement table, so this
is a spec/fixture inconsistency, not an implementation bug — both death paths are
fully covered by `shooter.test.js` (`ball-explode` on terrain, `ball-dead` on
lifetime and on the level edge). Fix options, none folded into Unit 11: move the
cannon so a second, un-backstopped shot lane exists, or add a note to the checklist
that `ball-dead` is proven by test rather than by this fixture. Do not change the
`Shooter`/`Projectile` code for this — the behaviour is correct.

---

### 9. SFX playback bypasses the master `sfxGain` node [OPEN]

**Where:** `src/core/audio.js` `playSfx` (Unit 12)
**Symptom:** Unit 12 spec graphs `source → perPlayGain (mix) → sfxGain → destination`.
The implementation sets `perPlayGain` to `_sfxVolume * mix` and connects it
straight to `destination`. `sfxGain` is created and written by the `sfxVolume`
setter but no SFX node feeds it.
**Expected:** Per-play gain is the authored mix only; master SFX volume lives on
`sfxGain`, so in-flight sounds follow a volume change.
**Repro:** Call `playSfx('jump')`, then set `sfxVolume` while it is still playing —
the in-flight sound does not change. New plays do honour the setter because they
bake `_sfxVolume` into the per-play gain.
**Notes:** Found while reading Unit 12 against the spec, not during Unit 13.
Functionally OK for fire-and-forget SFX. Do not fold into an unrelated unit; a
fix is one connect target plus dropping `_sfxVolume` from the per-play gain.

---

### 21. Secondary text on the wood board is hard to read [OPEN]

**Where:** `src/ui/components/resize-dialog.js` + its CSS (Unit 15); any `--text-muted` or `--text-display` text on `.panel--board`
**Symptom:** In the Level Size dialog, the "cells" / "rows" unit labels and the "40–400 × 12–48" limits hint (muted text) almost vanish into the brick fill, and the orange "Level Size" heading has low contrast against it. Seen 2026-09-24 in Chrome, desktop, once issue 20 made the board fill render properly.
**Expected:** All dialog text is readable on the board. The playbook has no contrast rule yet, so the target (e.g. WCAG AA 4.5:1 for body text) has to be chosen first.
**Repro:** Maker → Menu → Resize Level.
**Notes:** Not caused by issue 20's fix. The fill colour is the same brick as before, now drawn as a clean frame. Options: put the form on an inner `.panel--paper` (as `3-ui-context.md` already specifies for text inputs), or use `--paper-light`/`--ink` for text on board. That is a token and component decision for `3-ui-context.md` first, so it is not folded into the nine-slice fix.
**2026-09-25 (Unit 17):** measured: the board fill is `--wood` `#ae7764`. Ink text on it reaches 3.4:1, `--paper-light` 2.9:1, and ink on paper 7.4:1. Unit 17's new dialogs and My Levels use the spec's fallback (text on an inner `.panel--paper` sheet, no ghost buttons), so only the resize dialog, the pause/results panels and the maker toolbar status still show text on board. Deciding this issue now means choosing whether those follow the same pattern.
**2026-09-29 (Unit 19):** the pause and results panels now put their title and text on a paper sheet, like every `openDialog` dialog. Only the maker resize dialog (with issue 27) and the maker toolbar status still show text on the board.

---

### 24. Desktop has no way to zoom the maker [OPEN]

**Where:** `src/maker/maker-scene.js` / `src/maker/gestures.js` (Unit 14)
**Symptom:** Maker zoom (0.5× / 1× / 2×) is reachable only through a two-finger pinch. There is no mouse-wheel, key or button path, so a mouse-and-keyboard user is stuck at 1×.
**Expected:** `1-project-overview.md` Maker features: "Pan and zoom at 0.5×, 1× and 2×". Nothing restricts it to touch.
**Repro:** From the code (2026-09-24): `zoom` changes only through `gestures.js` `zoomSnap`, which only a two-touch pinch sets. `input.js` has no wheel listener and no zoom keys, and the toolbar has no zoom control.
**Notes:** Found 2026-09-24 while running the Unit 16 checklist (its "zoom to 2×" step had to use synthesized touch). Needs a small spec decision first (wheel snaps between the three levels about the pointer, and/or `+`/`-` keys through `input.js`), so it is not folded into Unit 16.

---

### 25. `main.js` touches `document`, against the code standards [OPEN]

**Where:** `src/main.js` (Unit 00, grown through Unit 16)
**Symptom:** `main.js` calls `document.getElementById` four times and `document.documentElement.style.setProperty('--ui-scale', …)` in the viewport's `onResize`. `4-code-standards.md` (DOM and CSS) and `2-architecture.md` (`src/ui/`) both say only `src/ui/`, `core/input.js` and `core/viewport.js` may touch `document`.
**Expected:** Either the composition root is listed as an allowed exception, or those calls move behind `ui/dom.js` helpers (for example a `setUiScale` next to `setVeiled`).
**Repro:** `grep -n document src/main.js`.
**Notes:** Found 2026-09-25 while drafting the Unit 17 spec. It has no behavioural impact. The `--ui-scale` formula from `3-ui-context.md` also lives inline there. Unit 17 adds no new `document` access to `main.js`: its page-hidden hook goes through `ui/dom.js`. A doc wording change or a small move, done on its own, not inside Unit 17.

---

### 27. The resize dialog does not use the shared dialog helper [OPEN]

**Where:** `src/ui/components/resize-dialog.js` (Unit 15)
**Symptom:** Unit 17 added `components/dialog.js` (`openDialog`: overlay, Tab trap, Escape, backdrop close, focus return, paper sheet for text). The resize dialog still carries its own copy of the overlay and focus trap, and its text still sits on the board (issue 21).
**Expected:** One dialog implementation.
**Repro:** Compare `resize-dialog.js` with `dialog.js`.
**Notes:** Not folded into Unit 17 (no refactoring of code the unit was not asked to touch). A small change, best done together with issue 21's decision.

---

### 31. Nothing stops the player at a level's left and right edges [OPEN]

**Where:** `src/game/world.js` / `src/game/player.js` (Unit 07)
**Symptom:** Past column 0 or the last column there is no terrain, so the player walks off the side of the level and falls to the bottom death border. Seen 2026-09-26: the campaign bot jumped over Cannon Cove's flag and walked off the right edge.
**Expected:** Undefined today. Unit 07 specified the bottom death border and said nothing about the sides.
**Repro:** Maker → New Level → a floor across the whole width → play and walk left from the spawn.
**Notes:** Every Unit 18 campaign level has a full-height terrain wall in its first and last column, so the campaign is not affected. A maker user's level is. Options: clamp the hitbox to `0..worldW` in `world.js` (a behaviour decision: an invisible wall), or leave it to level design. Needs a player decision. Not folded into Unit 18.

---

### 35. Water in a ship level reads as a flat blue block [OPEN]

**Where:** `src/data/themes.js` `shipTheme.waterClip` (Unit 20, Decision 7)
**Symptom:** The ship reuses the island's `bg/water-tile`, a flat sea-blue tile with no surface. On the island it blends into the sea behind it. On the ship's plank wall, a pool reads as a plain light-blue rectangle, with no surface line and no motion.
**Expected:** Undecided. Decision 7 chose the island tile and left the look to the player ("judge by eye, and log it if it reads wrong").
**Repro:** Import or switch a level to Pirate Ship, paint water, and look in the maker or in play.
**Notes:** Found 2026-10-02 in the Unit 20 review (screenshots, muted headless Chrome). An option exists without new art: `water/top`, the Merchant Ship's animated water surface (96 × 32, 4 frames), has been packed since Unit 01 and is drawn nowhere but the palette's Water icon. Using it for the top row of a pool would be a theme field plus a render rule, so it needs a spec decision. For the player's judgment first.
**2026-10-03 (player, closing Unit 20):** "water looks a bit off inside of the ship, but maybe we can fix that later". Confirmed as a look problem. It is not a blocker and was not scheduled; it needs its own spec decision when picked up.

---

### 36. The HUD level name is faint, worst on the ship wall [OPEN]

**Where:** `src/ui/styles/hud.css` `.hud__name` (Unit 09); shown more clearly by Unit 20's backdrop
**Symptom:** The level name that flashes for 2.5 s at the start of play is `--text-display` (`#dd8f61`) with a 1 px `--ink` shadow, drawn straight over the canvas.
- Against the ship's back wall (`#af8385`) the fill reaches **1.28 : 1**.
- Against the island sky (`#ddc6a1`) it reaches 1.55 : 1, so it was already faint.
- The ink shadow is what makes it legible at all.
**Expected:** A readable title. The playbook still has no contrast target (issue 21).
**Repro:** Play any level, and look at the name at the top centre. Compare a ship level with an island one.
**Notes:** Found 2026-10-02 in the Unit 20 review. It is the same family as issue 21: display text on a coloured field. The fix is a token or component decision, for example the name on a paper strip like every other panel's text, so decide it with issue 21 and do not patch the colour alone.

---

### 41. Horizon bands and line are drawn but never seen [OPEN]

**Where:** `src/level/render.js` `drawBackdrop`; `src/data/themes.js` `horizonBands`, `horizon`, `horizonLine`, `horizonBand` (Unit 05)
**Symptom:** `drawBackdrop` fills three horizon bands (`hy-10` to `hy`) and then the BG Image is drawn over them. The image is opaque and tiled across the full width, so the bands are never visible. Today the renderer's 2 px horizon line at `hy` is the only part that shows. After issue 40, the image's rows 86–87 cover that line as well.
**Expected:** No dead overdraw. Either delete the band and line drawing (and decide whether the theme fields and the `--horizon` / `--horizon-band` CSS mirrors in `3-ui-context.md` stay), or keep them deliberately as a fallback and record why.
**Repro:** Read `drawBackdrop` after issue 40. Every band row lies inside `[hy - 86, hy + 41]`, which the image covers whenever `0 < hy < viewH`.
**Notes:** Found 2026-10-07 while planning issue 40. Kept out of that fix so it stays one draw position plus tests. It has no visible effect, and the cost is four `fillRect` calls a frame. It needs a small decision, not urgency.

---

### 43. The maker keeps a stale horizon after water is painted or erased [OPEN]

**Where:** `src/maker/maker-scene.js` (`parallax` is created in `syncTheme` and on resize only); `src/level/parallax.js` `createParallax` captures `horizonY` once (Unit 13 / Unit 05)
**Symptom:** From the code (2026-10-07): `horizonY` is derived from the water layer when the parallax is created. The maker recreates the parallax only on entering the maker, on a theme change and on resize. Painting the level's first water, painting water higher up, or erasing the top water row leaves the sea, the horizon, the BG Image, the clouds and the reflections at the old line until one of those events happens. Play is unaffected, because it creates a fresh parallax on every enter.
**Expected:** The maker's backdrop follows the derived horizon after every edit, as play does. Invariant 2 means the editor should show what play will show.
**Repro:** Maker → New Level → paint a row of water halfway up. Expected: the horizon moves to it. Then test-play and come back: the horizon is now correct.
**Notes:** Found 2026-10-07 while planning issue 42. Not yet seen in a browser; confirm by eye first. A likely fix:
- recompute the horizon (or recreate the parallax) when a command changes the water layer, including undo/redo;
- or make `horizonY` a getter over the live layer, with a cached row that is invalidated by edits.

Recreating the parallax resets the cloud positions and drift, so the choice affects the look. That needs a small decision. Keep it out of issue 42.

---

### 44. Idle samples attribute allocations to the loop's `frame` [OPEN]

**Where:** `src/core/loop.js` `frame` (Unit 02). Seen in Unit 22 Part E.
**Symptom:** Chrome allocation sampling (`HeapProfiler.startSampling`, `samplingInterval` 1024, 10 s, dev server, no `?perf`) attributes sampled bytes to `frame` with no callee frames. `cellRangeX` and `cellRangeY` never appear, before or after issue 33, and the `frame` totals did not drop after that fix, so this is not those tuples. `frame` itself does not allocate when `onFrame` is absent; the samples are inlined callees collapsed onto it.
**Expected:** No allocation in the per-frame path. This is logged, not fixed. Issue 33 was the only performance fix in Unit 22.
**Repro:** The Part E desktop traces in `specs/22-pwa-and-performance.md`, As Built. Sampled `/src/` bytes on `frame` per 10 s: Perf Stress play 30628 and 34052 before, 35948 and 25276 after; maker idle 20124 and 13684; Castaway Beach 17176 and 0 before, 20200 and 0 after.
**Notes:** Desktop Chrome 154 only. One further sample in a single run, not repeated in that scenario's other run, also landed on the per-frame path. Each is about one sample at this interval. The named functions do not construct objects. Not fixed.

| Function | File | Bytes | Scenario |
| --- | --- | --- | --- |
| `get x` | `src/core/camera.js` | 2296 | S1 before, run 1, draw |
| `autotileAt` | `src/level/autotile.js` | 2092 | S1 before, run 1, draw |
| `drawMakerObjects` | `src/maker/maker-scene.js` | 1080 | S2 before, run 1, draw |
| `get y` | `src/core/camera.js` | 2212 | S1 after, run 1, draw |
| `update` | `src/game/hazards/projectile.js` | 1040 | S1 after, run 2, update |

---

### 45. A 2000-palm decor rebuild takes more than a quarter of a frame [OPEN]

**Where:** `src/level/decor.js` `sync` / `buildDecorDrawList` (Unit 21). Measured in Unit 22 Part E.
**Symptom:** On Perf Stress, erasing one palm and then undoing and redoing it (20 rebuilds, records stored descending) takes a median **8.68 ms** total at no CPU throttle. That is over the 4 ms flag proposed for Unit 22. At 6× CPU slowdown the median total is 25.93 ms. Self time of both functions is about 0, because the samples land in the insertion sort those functions call.
**Expected:** Logged, not fixed. Unit 22's only performance code change is issue 33.
**Repro:** Desktop Chrome 154, dev server, Perf Stress in the maker, CPU profiler at 100 µs. Numbers are in the Unit 22 As Built. Max total was 11.59 ms at no throttle and 34.03 ms at 6×.
**Notes:** These are desktop numbers. They do not establish the phone target. The earlier Node sample (about 4.1 ms descending) was not a browser measurement.

---

## Resolved

### 46. Offline, the cached game never starts: its JS and CSS miss the cache [FIXED]

**Where:** `tools/service-worker.template.js`, fetch handler (Unit 22 Part B, `9e39283`).
**Symptom:** Found in Claude's review on 2026-10-07, with headless Chrome 154, a fresh profile, `vite preview` and the current build (cache `cc-558a819acf4c`, 104 entries).
- Online, the worker activates and controls the page, and the cache holds all 104 files.
- Stop the preview server and reload:
  - the cached `index.html` loads;
  - `/assets/index-CUfwtrz7.js` and `/assets/index-gA8T7xDn.css` fail with `net::ERR_FAILED`;
  - the page stays blank, with no title buttons.
- The manifest and the icon, which are requested without `crossorigin`, are served from the cache with status 200.

**Cause:**
- `vite preview` answers with `Vary: Origin`, and `cache.addAll` stores that header with each response.
- Vite emits the bundle tags with `crossorigin`. The browser's real request for them carries an `Origin` header, which `addAll`'s request did not.
- So `caches.match(request)` honours `Vary` and misses. The worker falls back to `fetch`, and with no network that fetch fails.
- Proof:
  - From a page script, a request to the same URL with `mode: 'cors'` matches. Scripts cannot set `Origin`, which is a forbidden header.
  - A scratch copy of the same build, changed only to `caches.match(key, { ignoreVary: true })`, worked fully offline in the same test: title, level select, Castaway Beach (screenshot), all six sounds from the cache with 200, and `/?perf` with its readout. The only error was the expected `sw.js` update check.
- Whether Netlify sends `Vary: Origin` is unknown; the fix must not depend on it.

**Why Part B's check missed it:** the Part B record says the server was still running while it tested "offline". Emulating offline for the page alone (the DevTools-protocol way) leaves the worker's own `fetch` fallback with real network access, so the misses were quietly served by the server.

**Expected:** With the server stopped, the game boots and plays from the cache.

**Repro:**
1. `npm run build`, then `npx vite preview`.
2. Open `/` once, and wait for the worker to control the page.
3. Stop the preview server and reload: the page is blank.

**Fix plan (2026-10-07, Claude, for the implementer).**

*Before you start:* the tree must be clean. This is one commit, with nothing else in it.

1. **`tools/service-worker.template.js`:** in the fetch handler, change `caches.match(key)` to `caches.match(key, { ignoreVary: true })`. Add a one-line comment: the precache holds one response per URL, and a server's `Vary: Origin` must not hide it from a `crossorigin` request. Change nothing else.
2. **`tools/pwa-plugin.test.js`:** add a test that the real template's fetch handler calls `caches.match` with `ignoreVary: true`. Assert that the template text contains `caches.match(key, { ignoreVary: true })`. Write it first and watch it fail.
2b. **Issue 47, in the same commit (player decision, 2026-10-07).**
   - **`tools/pwa-plugin.mjs` `renderServiceWorker`:** pass replacer functions, `.replace(VERSION_TOKEN, () => JSON.stringify(version))` and `.replace(PRECACHE_TOKEN, () => JSON.stringify(urls))`, so `$` patterns in the inserted text are never interpreted.
   - **Test, written first:** render the real template with urls `['/a$&b.png', "/c$'d.png"]`. The output must contain `const PRECACHE = ["/a$&b.png","/c$'d.png"];` exactly, and `__CC_PRECACHE__` must not appear. Today it fails, because the path comes out as `/a__CC_PRECACHE__b.png`, as Claude confirmed.
3. **Verification. It must really be offline; DevTools' Offline switch is not enough:**
   1. `npm run build`, then `npx vite preview`.
   2. In a fresh Chrome profile, open `/` and wait until the worker controls the page.
   3. **Stop the preview server process**, then reload. The title, Castaway Beach with sound, the maker, Settings and `/?perf` all work.
   4. Record the failed requests: the only one allowed is `sw.js`.
4. **Docs:**
   - Move this issue and issue 47 to Resolved.
   - Correct Part B's "Verify B" step 3 in `specs/22-pwa-and-performance.md` to say "stop the preview server", and add a line to its As Built about this fix.
   - Add a tracker entry.
5. **Commit:** `Fix issues 46 and 47: match precached files regardless of Vary; insert worker values literally (#46 #47)`.
**Closed:** 2026-10-07. The fetch handler calls `caches.match(key, { ignoreVary: true })`. The precache holds one response per URL, and a server's `Vary: Origin` must not hide it from a crossorigin request. The template test was written first and failed, then passed. Verification used a fresh Chrome profile and `npx vite preview` on port 4173. The worker activated and controlled the page (cache `cc-558a819acf4c`, 104 entries). The preview server process was then stopped — a fetch from Node got status 0 — and the page was reloaded. DevTools' Offline switch was not used. The title showed Play, Make and Settings, from `/assets/index-CUfwtrz7.js` and `/assets/index-gA8T7xDn.css`. Settings opened with both slider sprites. Castaway Beach ran with 5 hearts and the pause control; `jump.wav`, `coin.wav`, `damage.wav`, `pearl.wav`, `hit.wav` and `starlight_city.mp3` each returned status 200, and the audio context was `running`. In the maker, a palm enabled Undo, Pirate Ship reported `aria-pressed` true, and test play started. `/?perf` read `0.0 ms avg · 0.1 max · 58 fps`. The page network log recorded no failed request. 399 tests in 34 files. The build logged `pwa: sw.js caches 104 files (version 558a819acf4c)`.

---

### 47. A `$` in a built file name would corrupt the generated worker [FIXED]

**Where:** `tools/pwa-plugin.mjs` `renderServiceWorker` (Unit 22 Part B).
**Symptom:** From the code (Claude's review, 2026-10-07). The function calls `String.prototype.replace` with a plain replacement string. JavaScript treats `$&`, `` $` ``, `$'` and `$n` in a replacement string as special patterns. So a precached path containing `$` would splice the wrong text into `sw.js`.
**Expected:** The URLs are inserted literally.
**Repro:** `renderServiceWorker(template, 'v', ["/a$&b.png"])` produces `PRECACHE` with `__CC_PRECACHE__` text in it.
**Notes:** Latent. Vite's hashed names and every current asset name use only `[A-Za-z0-9._-]`, so no build today is affected. The fix is a replacer function (`() => JSON.stringify(urls)`), with a regression test using `$&`. **Scheduled 2026-10-07:** the player chose to fix this together with issue 46; see step 2b of that plan.
**Closed:** 2026-10-07, in the same commit as issue 46. `renderServiceWorker` passes replacer functions, so `$&`, `` $` ``, `$'` and `$n` in the inserted text are not patterns. The test renders the real template with `['/a$&b.png', "/c$'d.png"]` and requires `const PRECACHE = ["/a$&b.png","/c$'d.png"];`, with no `__CC_PRECACHE__` left. It was written first and failed — the path came out as `/a__CC_PRECACHE__b.png` — then passed.

---

### 28. `/favicon.ico` 404 on every fresh load [FIXED]

**Where:** `index.html` (Unit 00); closed by Unit 22 Part B.
**Symptom:** Chrome requests `/favicon.ico` on first load and logs "Failed to load resource: 404". It is the only console error in a full Unit 17 run.
**Expected:** No console errors in a normal run (workflow rule 6).
**Repro:** Open `/` in a fresh profile and read the console.
**Notes:** Found 2026-09-25 while verifying Unit 17. This existed before the unit. The icon is generated, not hand-added under `public/assets/`.
**Closed:** 2026-10-07. Part B links the generated 32 px icon from `index.html`. On the dev server, a fresh profile loaded with no favicon 404 and no service worker. Commit `9e39283`. Moved here in Part E, once the traces were recorded.

---

### 33. The collision cell ranges allocate on every call [FIXED]

**Where:** `src/game/physics.js` `cellRangeX` / `cellRangeY` (Unit 06)
**Symptom:** Both returned a new two-element array. Every fixed step, `resolveH`, `resolveV`, `resolveSemiSolid`, `checkSolid`, `checkFloor` and the wall checks call them for the player and for every walker and projectile.
**Expected:** `4-code-standards.md` Rendering: "No allocation in the per-frame path … Use module-level scratch objects."
**Repro:** Was `physics.js` returning `[c0, c1]` and `[r0, r1]`.
**Notes:** Found 2026-10-02 while planning issue 30's fix. Not folded into it.
**Closed:** 2026-10-07. The two helpers write into module scratch objects `rangeX` and `rangeY`, and each of the 11 callers copies the values out before the next call. The arithmetic is unchanged. `physics.test.js` passed without edits (32 tests); the suite stayed 397 tests in 34 files. In the Part E samples, `cellRangeX` and `cellRangeY` never appeared before or after the change, so V8 had already kept them off the sampled stacks. The `frame` totals did not drop. The fix stays, because the standard forbids the allocation either way. Commit `f37f43f`. The remaining `frame` samples are issue 44.

---

### 39. Unit 21 allocation profiling remains pending for Unit 22 [FIXED]

**Where:** `context/specs/21-island-decor.md`, Verification checklist / As Built, Cost.
**Symptom:** The allocation-trace checkbox was originally checked without a recorded trace. That documentation claim was corrected and the measurement deferred to Unit 22. A stable heap can include allocations followed by garbage collection. The 2000-palm browser sample stacked almost all records on one cell, so the costly list-rebuild order was unmeasured.
**Expected:** Record allocation profiles of idle maker/play and an edit-time rebuild with 2000 distributed records. Keep desktop and real-phone results distinct.
**Repro:** The Unit 21 As Built had interval and heap samples, and no allocation trace.
**Notes:** Found in the independent Unit 21 review on 2026-10-07. An outside-repo Node harness had measured about 0.11 ms ascending and 4.1 ms descending. Those were not browser numbers.
**Closed:** 2026-10-07. Unit 22 Part E recorded every requested desktop trace: S1–S4 allocation samples (two runs each), the 20-rebuild timing at no throttle and at 6×, and production `?perf` frame times at both rates. The numbers are in the Unit 22 As Built. No phone measurement was made, and none is claimed. Issues 44 and 45 are the findings that were logged and not fixed.

---

### 42. Water reflections shimmer on top of solid rock [FIXED]

**Where:** `src/level/parallax.js` (reflection slots) and `src/level/render.js` `drawReflections` (Unit 05)
**Symptom:** In Castaway Beach, the white water-reflection shimmer (`fx/reflect-big`, 170 × 10, 4 frames) is drawn across the middle of the solid terrain block, about 2 px below the horizon row. Seen in Chrome 2026-10-07 while reviewing issue 40 (the camera is at the level's start).
**Expected:** Reflections appear only on open water: the sea backdrop or water cells. Never over terrain or platforms.
**Repro:** Play Castaway Beach and look at the dark rock under the first floor. There is a thin white shimmer at the horizon row (row 14).
**Notes:**
- `createParallax` places 6 reflections at fixed x `((slot + 0.5) / 6) * worldW` and y `horizonY + reflectGap`, with no check of the cells there.
- `drawLevel` draws them in the water pass, after `Z.bgTiles`, so they cover terrain.
- This has been the case since Unit 05: before Unit 21 they were also drawn after the tiles. Issue 40 did not change their position.
- A fix needs a decision:
  - skip a reflection whose cells at the horizon row are terrain or platform (a parallax-time or draw-time check);
  - or draw reflections before the tiles (but then water cells, which are opaque, would cover them);
  - or place them only over runs of water and empty cells.
- It does not affect collision or the level format.

**Measured 2026-10-07** across the six campaign levels. Each cell under each reflection on the horizon row is classed as **T**errain, **P**latform, **w**ater or empty (**.**):
- 31 of the 36 reflections lie entirely over terrain. 3 are partly over water (`TTTTTTw`, `wwTTTT`, `TTTwwT`), and only 2 are entirely over water (`ww`, `www`).
- Every campaign horizon row is solid rock with pools cut into it, 2–3 cells wide (two of them are 8). Open cells per row: 10/100, 21/130, 9/140, 11/150, 7/150 and 22/180.
- So moving reflections onto open water has almost nowhere to put a 170 px shimmer. Clipping is the fix.

**Decision.** The player chose (2026-10-07) to fix this before Unit 22, as its own change planned for Sol. The approach is Claude's proposal, **draw-time clipping per cell**. The player approves it by handing this plan to Sol:
- Each reflection draws only the columns of its sprite that lie over cells of its row with no terrain and no platform. Water cells and empty cells are open, and so are cells outside the grid (the maker margins, and levels with no water, whose horizon is `rows * TILE`).
- Why at draw time:
  - It reads the live layers, so maker edits are honoured on the next frame.
  - Reflection positions do not change.
  - It allocates nothing.
  - A reflection over open cells draws exactly as today.
- **Visible consequence:** most campaign shimmers disappear, because they sat on rock. A pool under a slot keeps a slice of shimmer.
- Rejected:
  - Skipping a whole reflection when any cell is blocked would also drop the pool slices.
  - Drawing reflections before the tiles would hide them under opaque water cells.
  - Re-placing them over open runs would make them jump while the maker paints, and they would not fit the 2-cell pools.

**Fix plan (2026-10-07, for Sol).**

*Before you start.* `git status` must be clean. This is one commit, with nothing else in it.

*The change. Only these files.*
1. **`src/core/sprite.js`.** Add a `drawSpan(ctx, cam, x, y, k0, k1)` method to the object `createSprite` returns. It draws source columns `[k0, k1)` of the current frame, unflipped:
   ```js
   drawSpan(ctx, cam, x, y, k0, k1) {
     if (k1 <= k0) return;
     const frame = n > 0 ? Math.floor(frameIndex) % n : 0;
     const dx = Math.round(x - cam.x);
     const dy = Math.round(y - cam.y);
     ctx.drawImage(clip.image, frame * clip.fw + k0, 0, k1 - k0, clip.fh,
       dx + k0, dy, k1 - k0, clip.fh);
   },
   ```
   - JSDoc it like `draw`: `k0` and `k1` are whole source columns, `0 ≤ k0 ≤ k1 ≤ fw`.
   - `drawSpan(…, 0, fw)` must issue exactly the call that `draw(…)` issues unflipped.
   - It knows nothing about levels; `core/` stays game-free.
2. **`src/level/render.js`.**
   - Pass `level` into `drawReflections` (`drawLevel` already has it). `drawLevel`'s own signature does not change.
   - Replace each of the three `refl.sprite.draw(ctx, cam, xN, y)` calls with a call to a new module-private helper, `drawReflectionClipped(ctx, cam, refl, xN, y, level)`. Keep each copy's existing on-screen test.
   - **Helper algorithm.** No allocation, plain loops. `w = refl.w` and `h = refl.h`:
     - `dx = Math.round(x - cam.x)`, the same rounding as `drawSpan`.
     - `r0 = Math.floor(y / TILE)` and `r1 = Math.floor((y + h - 1) / TILE)`.
     - For each column `c` from `Math.floor(x / TILE)` to `Math.floor((x + w - 1) / TILE)`:
       - Source columns: `left = clamp(Math.round(c * TILE - cam.x) - dx, 0, w)` and `right = clamp(Math.round((c + 1) * TILE - cam.x) - dx, 0, w)`. These are the screen edges the tiles are drawn at, so the clip meets the drawn tiles exactly, even at a fractional camera or `x`.
       - The cell is **blocked** if, for any `r` in `r0..r1`, `isPresent(level.layers.terrain, cols, rows, c, r)` or `isPresent(level.layers.platform, …)`. `isPresent` treats out-of-grid cells as absent, which makes them open.
       - Merge consecutive open columns into one span, and call `refl.sprite.drawSpan(ctx, cam, x, y, spanStart, spanEnd)` once per span. A fully open reflection is therefore a single `drawSpan(…, 0, w)` call.
     - Write the clamp inline with `Math.min`/`Math.max`. `0` and `TILE` are the only constants; no other raw numbers (code standards).
     - Import `isPresent` from `./autotile.js`. It is already imported there.
   - Update the `drawReflections` doc comment: "drawn only over horizon-row cells with no terrain or platform, clipped per cell".
   - Do not change `parallax.js`, the reflection positions, `reflectGap`, the draw order or the water pass.
3. **Tests. Write each first and see it fail on today's code** (today a blocked reflection still draws in full).
   - **`src/core/sprite.test.js` (new):**
     - **(a)** A fake clip `{ image: {id:'s'}, fw: 10, fh: 3, n: 4, fps: 10 }`, after `update(0.25)` (frame 2). `drawSpan(ctx, {x:0,y:0}, 5, 7, 2, 6)` records `drawImage({id:'s'}, 22, 0, 4, 3, 7, 7, 4, 3)`.
     - **(b)** `drawSpan(…, 0, 10)` records the same arguments as `draw(…)`.
     - **(c)** `k1 <= k0` records nothing.
   - **`src/level/render.test.js`, new `describe('reflections', …)`.** Drive the real `drawLevel`:
     - Level: `createEmptyModel({ cols: 40, rows: 12 })`.
     - Fake atlas: as in the issue 40 tests, with `fw`/`fh` from `atlas.json`. `tiles/island` and `bg/water-tile` are in it.
     - Fake parallax: `{ horizonY: 320, worldW: 1280, bigCloudX: 0, period: 1, small: [], reflects: [refl] }`, where `refl = { x: 100, w: 170, h: 10, sprite }`.
     - `sprite` is a fake with `drawSpan(ctx, cam, x, y, k0, k1)`, which records `[x, k0, k1]`, and a `draw` that throws, so a missed call site fails loudly.
     - `islandTheme`; `reflectGap` is 2, so `y` is 322, row 10.
     - `cam {x:0, y:0}`, `viewW 768`, `viewH 360`.
     - Set cells with `level.layers.<name>[r * 40 + c] = 1`.
     - The reflection at `x = 100`, `w = 170` covers columns 3–8.
     - Cases:
       1. Row 10 empty → exactly `[[100, 0, 170]]`.
       2. Terrain at columns 3–8 of row 10 → no calls.
       3. Terrain at column 5 only → `[[100, 0, 60], [100, 92, 170]]`.
       4. Platform at column 5 only → the same as case 3.
       5. Water at columns 3–8 → `[[100, 0, 170]]`.
       6. Terrain at column 5, `refl.x = 100.5` → `dx` is `Math.round(100.5)` = 101, so `[[100.5, 0, 59], [100.5, 91, 170]]`.
       7. Terrain in row 9 or row 11 only → `[[100, 0, 170]]`: only the reflection's own row matters.
       8. `horizonY: 384` (= `rows * TILE`, out of the grid), with terrain filling row 11, and `cam {x:0, y:64}` → `[[100, 0, 170]]`, the full span. The camera offset keeps the reflection on screen: at `cam.y` 0 its `sy` would be 386, which is past `viewH` and skipped.
     - Filter to the reflection's recorded calls. Other layers draw through the fake context, not the fake sprite.

*Docs, in the same commit.*
- `2-architecture.md`, Rendering Model, the bullet "Water and reflections are the water pass…": add that a reflection draws only over horizon-row cells with no terrain or platform, clipped per cell at draw time.
- `specs/05-parallax-background.md`, under the checklist item "Water reflects animate…", add: "Corrected 2026-10-07 by issue 42: clipped to open horizon-row cells."
- Move this entry to Resolved with the date, test count and commit.
- Add a Completed entry to `6-progress-tracker.md`.

*Verification.*
- `npm test`. Expect 365 + 3 + 8 = 376; report the real count. `npm run build` passes.
- In the browser:
  1. **Castaway Beach.** No shimmer anywhere on the rock under the first floor (the issue 42 screenshot spot, about x 267–437, row 14). The 2-cell pool around x 1333 still shimmers.
  2. **Crabby Shallows.** The `www` pool near x 1040 shows a full `reflect-mid`. The big slot at x 347 shows a slice only over its one water cell.
  3. **Maker.** Edit a copy of Castaway Beach. Paint terrain over the x 1333 pool: its shimmer disappears at once. Undo: it comes back.
  4. **Ship theme.** No reflections, as before.
  5. **No console errors.**
- Commit message: `Fix issue 42: clip water reflections to open horizon cells (#42)`.

*Stop and ask if* the clipped edges do not meet the tile edges in the browser, or if any test outside `sprite.test.js`/`render.test.js` changes. Do not touch issue 43 (the maker's stale horizon); it changes which row is checked, but it is a separate fix.

**Closed:** 2026-10-07. Added unflipped `createSprite.drawSpan` and per-cell draw-time clipping against live terrain/platform cells, merging adjacent open columns and matching the tiles' rounded screen edges. All eleven new tests failed before the source changes; `npm test` then passed 376 tests in 30 files, and `npm run build` passed. Chrome launched Castaway Beach with no shimmer on its first rock block. Fixed-camera campaign renders compared all four reflection frames with reflections omitted: zero changed pixels over terrain/platforms, with shimmer retained in Castaway's pool and Crabby Shallows' full medium slot and four-column big-slot slice. In the actual maker at 844 × 390, a pointer drag over both Castaway pool cells hid the shimmer immediately; one Undo restored it. Switching to Ship drew no reflections. Screenshot/pixel evidence was kept outside the repo. The only console error was the existing favicon 404 (issue 28). Commit: `ee2ce42`. Issue 43 is unchanged.
**Reviewed 2026-10-07 (Claude):**
- The code matches the plan.
- With the pre-fix `render.js` and `sprite.js` restored, all 11 new tests fail; with the fix they pass. 376 tests and the build pass.
- An independent Node sweep ran the real `drawLevel` and `createParallax` over all six campaign levels, with the camera stepped every 7.3 px. It recorded every reflection pixel column and the cell under it at the tiles' rounded edges:
  - **before the fix,** 248,707 of 271,828 columns (91%) were over terrain or platform;
  - **after it,** none of 23,121 were.
  - Starfall Cliffs now draws no shimmer, because all six of its slots are over rock.
- No review fixes were needed.

---


### 40. The island cloud bank sits in the sea, below a second horizon [FIXED]

**Where:** `src/level/render.js` `drawBackdrop`, the BG Image `drawTiledX` call (Unit 05); `src/data/themes.js`
**Symptom:** The player's screenshot (2026-10-07, a level with no water) shows the big cloud band covering a strip of blue sea, with a white horizon line and pink band above the clouds. Every campaign level has water, and in each of them the island backdrop shows **two** horizon lines 42 px apart: the BG Image's painted one, and the renderer's own 2 px line at `horizonY`. The cloud bank's bottom sits on the lower one, so the clouds cover the painted sea.
**Expected:** One horizon, at `horizonY`. The cloud bank rests on it. Below it there is plain sea, and the top row of water cells meets it.
**Repro:** Play Castaway Beach and look at the horizon; or play any island level without water (horizon at the level bottom) and look at the bottom of the screen.
**Cause (measured from `public/assets/sprites/bg-image.png`, 384 × 128, every pixel opaque):**
- Rows 0–41 are sky `#ddc6a1`. Rows 42 and 44–45 are thin `#d1aa9d` lines, and rows 48–85 are the pink `#d1aa9d` band.
- **Row 86 is a painted white `#ffffff` horizon line**, across the full width.
- Rows 87–127 (41 rows) are sea `#92a9ce`, the same colour as `theme.sea` and as every pixel of `bg/water-tile`.
- `drawBackdrop` draws the image at `horizonY - bg.fh` (bottom on the horizon). That puts the painted line at `horizonY - 42` and 41 rows of painted sea above the real horizon.
- `drawClouds` draws `bg/clouds-big` (448 × 101; rows 98–100 opaque across the full width) at `horizonY - 101`, bottom on the real horizon. That matches Super Pirate World `groups.py:95` (`top = horizon_line - large_cloud_height`). So the clouds are right and the BG Image is 42 px too high.
- The Unit 05 spec's "`BG Image` sits on the horizon" was implemented as "its bottom edge sits on the horizon". The image's own horizon is its row 86, not its bottom. This has been the case since Unit 05 (baseline commit `965dcf8`). It is not a Unit 21 regression.

**Decision (player, 2026-10-07).** Claude offered two options. The player asked for a fix plan for Sol to implement, which accepts the recommended one: **move the BG Image down so its painted line is on `horizonY`**. The rejected alternative was lifting the clouds 42 px. That would keep two horizons (the renderer's own line would still show below the image), and the water cells would still start 41 px below the visible horizon.

**Fix plan (2026-10-07, for Sol).**

*Before you start.*
- `git status` must show a clean tree, apart from untracked scratch files outside `src/` and `context/`. The Unit 21 work (`render.js`, `render.test.js`, `decor.js` and others) was uncommitted on 2026-10-07. If it still is, **stop and ask** rather than committing it with this fix.
- This fix touches `render.js`, so it must be a commit of its own.

*The change. Exactly these three edits; touch no other code.*
1. **`src/data/themes.js`:**
   - Add `bgImageHorizonRow: number` to the `Theme` typedef, after `bgImage`.
   - Add `bgImageHorizonRow: 86` to `islandTheme`, right after `bgImage: 'bg/image'`, with a comment that names the measurement, e.g. `// bg/image row 86 is its painted white horizon line; drawn on horizonY`.
   - `shipTheme` inherits it through the spread and never reads it (its `wallTile` returns first). Do not add it to `shipTheme`.
2. **`src/level/render.js` `drawBackdrop`.** In the BG Image `drawTiledX` call, replace
   `Math.round(parallax.horizonY - bg.fh - cam.y),`
   with
   `Math.round(parallax.horizonY - theme.bgImageHorizonRow - cam.y),`
   - Update the `drawBackdrop` doc comment to say that the image's painted horizon row, not its bottom, is drawn on `horizonY`.
   - Leave unchanged:
     - the sky and sea fills, the horizon bands and the horizon line;
     - `drawClouds`, the reflections and `parallax.js`;
     - the parallax factor;
     - the ship branch.
3. **`src/level/render.test.js`.** Add a `describe('drawBackground', …)` with the tests below. **Write them first and watch them fail on today's code** (today the BG Image's `dy` is 168, not 210).
   - **Fakes, all local to the test:**
     - a context recording `drawImage` calls and ignoring `fillStyle` and `fillRect`;
     - `atlas.get(id)` returning `{ image: { id }, fw, fh }`, with `fw`/`fh` from `src/data/atlas.json`;
     - a parallax `{ horizonY: 448, bigCloudX: 0, small: [], period: 1 }`.
     - Cast the fakes with JSDoc `@type` imports, as `decor.test.js` does. No `any`.
   - **Test 1, the painted horizon is on `horizonY` and the cloud bank rests on it.**
     - Setup: `islandTheme`, `cam = { x: 0, y: 152 }`, `viewW 768`, `viewH 360` (Castaway Beach: 16 rows, water from row 14, camera at its bottom clamp).
     - Every `bg/image` call has `dy === 210` (448 − 86 − 152).
     - Every `bg/clouds-big` call has `dy === 195` (448 − 101 − 152).
     - For one call of each: `bgDy + islandTheme.bgImageHorizonRow === cloudsDy + 101`, i.e. both equal `horizonY - cam.y` (296).
     - The `bg/image` calls cover `x` from ≤ 0 to ≥ 768.
   - **Test 2, rounding at a fractional camera.**
     - Same setup with `cam.y = 216.4`: the maker panned into its 2-tile margin below a 16-row level, at a fractional position.
     - `bg/image` `dy === 146`, which is `Math.round(448 - 86 - 216.4)` = `Math.round(145.6)`.
     - At least one `bg/image` call happens. A `dy` at or beyond `viewH` makes `drawTiledX` return early, so a test that checks only the calls it finds would pass vacuously.
   - **Test 3, `bgImageHorizonRow` lies inside the image.**
     - `0 ≤ islandTheme.bgImageHorizonRow < atlas['bg/image'].fh`.
     - `atlas['bg/image'].fh - islandTheme.bgImageHorizonRow - 1 === 41`, the painted sea below the line.
     - Put this test in `themes.test.js`, next to the other theme-shape tests.

*Docs, in the same commit.*
- `2-architecture.md`, Rendering Model, the Horizon Y bullet: change "Sky, sea, horizon bands, `BG Image` and the cloud band all sit on that line" so that the `BG Image`'s painted horizon (its row 86, `theme.bgImageHorizonRow`) and the bottom of the cloud band sit on that line.
- `specs/05-parallax-background.md`, under the checklist item "`BG Image` sits on the horizon", add one line: "Corrected 2026-10-07 by issue 40: its painted row 86 sits on the horizon, not its bottom edge."
- Move this entry to **Resolved** with the date, what changed, the test count and the commit.
- Add a Completed entry to `6-progress-tracker.md`, and refresh its Current Phase.

*Verification.*
- `npm test` (362 + 3 = 365 expected) and `npm run build`, both clean.
- Run the dev server and check by eye, with a screenshot of each:
  1. **Castaway Beach.** One horizon line. The cloud bank's flat bottom rests on it. Pink shows only in the gaps between the clouds; no blue strip sits above or behind the clouds. Below the line, sea and the water cells are one colour, with no seam.
  2. **An island maker level with no water.** In play at the bottom camera clamp, the cloud bank sits on the bottom edge of the screen. In the maker, pan into the margin below the level: the horizon is on the level's bottom edge, with sea below.
  3. **Switch the level to Pirate Ship:** the wall backdrop is unchanged.
  4. **No console errors.**
- Commit message: `Fix issue 40: put the BG Image's painted horizon on the horizon (#40)`.

*Stop and ask if* any other draw position looks wrong after the change, or if a test outside `render.test.js`/`themes.test.js` fails. Do not adjust the clouds, the bands or `horizonY` to compensate.

*Not in this fix:* issue 41.

**Closed:** 2026-10-07. `theme.bgImageHorizonRow` anchors the painted row 86 on `horizonY`; the clouds, bands and ship branch are unchanged. Three new tests failed on the old code, then passed after the correction. `npm test` passed 365 tests in 29 files and `npm run build` passed. Chrome screenshots checked Castaway Beach, a saved no-water level in play and maker, and the ship wall; the maker screenshot temporarily hid the UI to expose the sea below the level edge. The only console error was the existing `/favicon.ico` 404 (issue 28). Commit: `9015741`. Issue 41 remains open.
**Reviewed 2026-10-07 (Claude):**
- The code matches the plan line for line.
- With the old `drawTiledX` line restored, both `render.test.js` tests fail; with the fix they pass. 365 tests and the build pass.
- In Chrome, Castaway Beach shows the cloud bank resting on the sea line, and there are no console errors.
- Review slips fixed: a doubled separator here, and an uneven comment wrap in `drawBackdrop`.
- The same screenshot showed issue 42.

---

### 38. Unit 21 tracker still says implementation has not started [FIXED]

**Where:** `context/6-progress-tracker.md`, Current Goal / In Progress / Next Up.
**Symptom:** Current Phase said Unit 21 was built, while Current Goal and Next Up still said to review the draft and that implementation had not started.
**Closed:** 2026-10-07, with the player's explicit closeout and visual sign-off. Current Phase, Current Goal, In Progress, Next Up and Open Question 8 agree that Units 00–21 are complete. The morning drafting notes are preserved in Completed as history. Unit 22 waits until the player asks. Issue 39 stays open for profiling in Unit 22; today's session ends after the context updates.

---

### 34. Draw order follows the code, not `z` [FIXED]

**Where:** `src/level/render.js` `drawLevel`, `src/game/world.js`, `src/maker/maker-scene.js`
**Symptom:** Every entity set `this.z`, and nothing read it. `drawLevel` drew the background, the tiles and the water, then the world drew entities, the player and fx. Water (`Z.water` 6) sat under actors (`Z.main` 5).
**Expected:** Draw order follows `settings.Z`.
**Closed:** 2026-10-07, Unit 21. `drawLevel` walks the numeric layers and calls a once-built callback after each layer's own content. Actors on a layer keep their old order. Effects stay on `fx`. In the running maker, a crabby in water matched the neighbouring water-only cell, and a crabby on dry ground did not, on both Palm Tree Island and Pirate Ship. Reflections are part of the water pass, so they cover actors where they overlap. The grid, cursor and ghost stay after the passes.

---

### 17. Maker palette category tabs are 28 px tall — under the 44 × 44 hit area [FIXED]

**Where:** `src/ui/styles/maker-palette.css` (`.maker-palette__tab` and `--palette-height`)
**Symptom:** At `--ui-scale: 1` the category tabs were 50–70 × 28 CSS px. Every other toolbar and palette button already met 44 × 44.
**Expected:** Minimum hit area 44 × 44 CSS pixels.
**Closed:** 2026-10-07, Unit 21. The tab's min-height and the tab term of `--palette-height` went from 28px to 44px. That is 16 CSS px at scale 1, taken from the clear canvas. Headless Chrome measured all eight tabs at 44px tall on 844×390 and 1000×360 (palette height 118) and 88px tall on 1280×720 (palette height 236, `--ui-scale` 2). Markers stayed inside the tab row at all three widths.

---

### 37. A solid block of ship terrain reads as a hollow room [FIXED — by design]

**Where:** the Pirate Ship terrain art (`tiles/ship`, terrain copy at (1,1)) as drawn by Unit 20
**Symptom:** The player painted a filled rectangle of terrain in a ship level, put the spawn inside it, and read the maker's "The spawn point is buried in terrain." as a false error. The block looked like a room.
- The blob layout draws a mass as a plank rim around a **dark navy core**: the fill tile and the dark intrusions in its eight neighbours.
- In the ship, empty space shows the pink plank back wall, so a dark core inside a plank frame reads as an opening, not as solid wall.
- The island draws its core the same dark colour, but its stone rim with grass on top reads as rock.
**Expected:** Solid terrain looks solid in every theme. The validation itself is correct.
**Repro:** Maker → Menu → Pirate Ship. Paint a terrain rectangle at least 3 × 3, then place the spawn in its middle. Switching to Palm Tree Island shows the same cells as rock.
**Notes:** Found 2026-10-03 by the player while testing Unit 20. The Unit 20 mockups already showed dark cores in solid ship blocks, but the spec's risk list did not flag that they read as space. Options, each needing the player's decision:
1. **Keep the pack's art.** Ship hulls are built from walls one or two tiles thick, where no dark core appears, and that is said where players will see it.
2. **Draw a planked core for the ship.** The sheet has no seamless planked fill: its only fill tile is the dark one, and every planked tile carries an edge or a notch. So this means new art derived from the pack in the asset pipeline.
3. **Give the ship's core a lighter, solid-reading treatment** at render time, as a theme field.

Not folded into anything: it is a look decision for the player first.

**Closed:** 2026-10-03, by design (player). Once the dark core was explained as the ship's version of the island's rock under the grass, the player rebuilt the level with the deck as terrain and open space as backdrop, and closed Unit 20 with the art as it is. Option 1 stands: hulls read best built from walls one or two tiles thick. Options 2 and 3 can be reopened if solid ship blocks keep confusing players.

---

### 30. The player can slip into a wall and pass through it [FIXED]

**Where:** `src/game/physics.js` `resolveH` / `cellRangeX` (Unit 06)
**Symptom:** A player running into a wall face can end up inside the terrain, stand "on" rows inside it, and walk through it. Seen 2026-09-26 in a headless run of the real world (`world.js`, `player.js`, `physics.js`) on Castaway Beach: the player met the raised block at column 65, rose up its face with `onFloor` true in mid-air, and drifted into the block.
**Expected:** Terrain is solid from every side, always.
**Repro:** From the trace: after any push to a whole-pixel position, `x` advances by 1.6666… px a frame, so every third frame it is a whole number plus float error (for example `2062.0000000000002`). If that lands the hitbox's right edge 1e-13 px past a wall face, `cellRangeX` (`x + w - 0.001`) does not include the wall's column, so nothing pushes it back. On the next frame `oldRect` is already overlapping, so `resolveH`'s "was clear of the tile" test (`oldRect.x + oldRect.w <= tL`) never fires again, and the player walks in. `resolveV` then treats the wall's rows as floors and ceilings.
**Notes:** Found while drafting the Unit 18 campaign, not caused by it. Not fixed inside Unit 18 (a Unit 06 module). A fix makes the overlap test and the cell range agree. Either the range includes any positive overlap, or positions are kept off sub-epsilon offsets. It needs a regression test in `physics.test.js` that starts at `x = tL - w + 1e-13`. The campaign drafts were checked by a bot that rounds positions to 1/1024 px to step around this. Real play may still hit it. Worth fixing before the campaign's final sign-off.
**Original fix plan (2026-10-02; applied below).** Scheduled before Unit 20 as its own change (`specs/20-second-theme.md`, Before This Unit).
- **The change.** Make the far edge of each cell range exact, as the near edge already is. In `cellRangeX`, `c1 = Math.min(cols - 1, Math.ceil((x + w) / TILE) - 1)`. In `cellRangeY`, `r1 = Math.min(rows - 1, Math.ceil((y + h) / TILE) - 1)`.
  - A box that only touches a face (`x + w === tL`) still leaves that tile out.
  - Any positive overlap brings it in, so the frame that crosses the face pushes back.
  - The vertical twin, a floor reached 1e-13 deep and then fallen through, has the same cause and the same fix.
  - Change nothing else: keep the tuple return (issue 33) and every caller.
- **Measured** with a scratch harness over the real `resolveH`:
  - Walking at `tuning.runSpeed * FIXED_DT` into a wall at columns 10, 30, 65, 120 and 250, from 64 whole-pixel starts each, **33 of 320 runs end inside the wall** today. With the fix, none do.
  - A single step from a clear `oldRect` to a right edge 1e-13 past the face stays inside today (`x` 302.0000000000001). With the fix it is pushed to 302.
  - All 322 existing tests pass with the fix applied. The trial was reverted, and the tree is clean.
- **Regression tests** in `physics.test.js`. Write each first, and see it fail on today's code:
  1. `resolveH`: `oldRect` clear of a wall, `hitbox` right edge at `tL + 1e-13` → `hitbox.x === tL - w`.
  2. `resolveH`: the walk above. Walls at columns 10, 30, 65, 120 and 250; starts `tL - w - 100 - k` for `k` 0–63; step `100 * (1 / 60)` for up to 600 frames, with `oldRect` copied before each step. No run ends with `hitbox.x + w > tL`.
  3. `resolveV`: `oldRect` above a floor, `hitbox` bottom at `tT + 1e-13` → `hitbox.y === tT - h`, and it returns true.
  4. A box exactly touching a face (`x + w === tL`, `oldRect` the same) is not moved.
- **In the game:** run into the Castaway Beach block at column 65 from the left, repeatedly. The scratch campaign bot no longer needs its 1/1024 px rounding.
- Its own commit, before Unit 20, with `#30` in the message.


**Resolved 2026-10-02:** exact far-edge ranges now use `Math.ceil(edge / TILE) - 1` on both axes. Three new regression cases failed before the fix; all four pass afterward (326 tests at this commit, build clean). Chrome verified 320 sustained resolver approaches and 64 real `world.js` / `player.js` approaches to the current Castaway Beach block at column 63 (the draft trace used 65). Tuple allocation and other collision code are unchanged. Prerequisite commit: `6c84a7e`.

---


### 26. Sound sliders are native, not the kit's Sliders sprites [FIXED]


**Closed:** 2026-09-29 (Unit 19 Part C, the Settings dialog).

**Where:** `src/ui/components/sound-dialog.js`, `styles/sound-dialog.css` (Unit 17)
**Symptom:** The Music and Effects sliders are native `<input type="range">` tinted with `accent-color: var(--accent)`. `3-ui-context.md` asks for the thumb to be restyled with the Wood and Paper kit's Sliders sprites.
**Expected:** A kit-sprite thumb and track.
**Repro:** My Levels → Sound.
**Notes:** Deliberately left out of Unit 17. The Sliders sprites are not packed, so the fix is an asset-pipeline change (`tools/asset-manifest.mjs`, `npm run assets`) plus the CSS that reads the new output, and the workflow rules split those. Natural home: Unit 19's settings screen.
**2026-09-29 (drafting Unit 19):** the note above is wrong. The sprites **are** packed, and have been since Unit 01: `ui/sliders` in `atlas.json`, `/assets/ui/sliders.png`, 10 frames of 12 × 12 (manifest line `strip('ui/sliders', …)`). Read from the art: 3–5 are a horizontal track (left cap, middle, right cap), 2 is its thumb, 7–9 and 6 are the vertical track and thumb, and 0–1 are arrow ends. So the fix is CSS only, with no asset-pipeline step. The Unit 19 spec proposes it for the settings dialog.
**What changed:** the Settings dialog draws its Music and Effects sliders with the kit sprites, in CSS only (`settings-dialog.css`), at 2x art pixels. The track is frame 4, whose columns 1-10 are identical, stretched across the track (a 1200% sheet at 44.5455%, 200% tall). The rounded caps (frames 3 and 5) cannot be cut from a sheet in CSS, so a 1-art-pixel `--ink` end stands in for their outer column. The thumb is frame 2, with WebKit and Firefox pseudo-elements. The input keeps its 44 px hit area and an `--accent` focus outline. Seen in headless Chrome at 1280 x 720 and 1000 x 360. Firefox and Safari still to be seen.

---

### 7. `PickupFx` name and home no longer fit its use [FIXED]

**Closed:** 2026-09-29 (Unit 19 Part B, step 0, before dust became its fifth user).

**Where:** `src/game/collectibles.js` (`PickupFx`), used from `world.js` `spawnFx`
**Symptom:** `PickupFx` was named and placed for treasure pickups, but as of Unit 11
it is the generic one-shot sprite burst for four different things: pickup fx, the
Crabby strike effect, projectile terrain/lifetime bursts (pearl/dead,
ball-explode, ball-dead). Its name and its home in `collectibles.js` now undersell
what it is.
**Expected:** A neutral name (e.g. `OneShotFx`) in a neutral home (e.g.
`src/game/fx.js`), imported by `world.js` and everything that spawns one.
**Repro:** Grep `PickupFx` — it is imported by `world.js` and referenced by the
collectible, walker (Crabby) and shooter/projectile paths.
**Notes:** Called out by the Unit 11 spec as **not** to be folded into Unit 11 (it
would touch `collectibles.js`, which Unit 11 does not). Pure rename + move, no
behaviour change. It has **no `flip` parameter and must not grow one** — every clip
that uses it is symmetric. Do it as its own small change.
**What changed:** the class moved to `src/game/fx.js` as `OneShotFx`, unchanged, and `world.js` imports it from there. It is still the only `fx` element type, and it still has no flip: the dust clips it gains in Unit 19 are symmetric (measured). `collectibles.js` no longer imports `Z`. No test file referenced it. `npm test` unchanged, build clean.

---

### 2. Autotile hole shows a grass top on the cell below [FIXED — by design]

**Closed:** 2026-09-29 (Unit 19 Part A). The grass is correct, and what looked wrong around it is fixed.

**Where:** Unit 04 fixture mass hole (`src/data/fixtures/autotile-demo.js`); 4-neighbour autotile
**Symptom:** The cell under a 1-tile hole draws a grass *top* edge because its north neighbour is empty.
**Expected:** Inner-corner tiles from the remaining 31 blob cells (Unit 19).
**Repro:** Look at the hole in the solid block on `/`.
**Notes:** Correct for v1 4-neighbour autotile. Do not change the mask table to paper over it.
**What changed:** Unit 19 made the autotile 47-tile, 8-neighbour. The cell under a hole has an empty north and so stays a top edge with grass: a hole's floor is a surface, under 4- and 8-neighbour rules alike. The real defect was the hole's **corners**. Its four diagonal neighbours drew as plain fill, so the rock outline broke off at each corner. Those cells now draw the inner-corner notch facing the hole, and the outline runs continuously. `autotile.test.js` pins both halves (floor still mask 14; diagonals `15:SE`/`15:SW`/`15:NE`/`15:NW`). Seen in the real maker 2026-09-29: painting the hole shut returns plain fill, and undo brings the notches back.

---

### 32. Pixelify Sans ligatures turn "fi" and "fl" into an "A" [FIXED]

**Closed:** 2026-09-29. Verified in the running game (headless Chrome, real app, real font).

**Where:** `src/ui/styles/base.css` (`html, body` font rules, Unit 00); every UI string with "fi" or "fl"
**Symptom:** The font's default `fi` and `fl` ligature glyphs read as a capital A. "Not finished yet" shows as "Not Anished yet", "Place the finish flag to play and save." as "Place the Anish Aag…", and "Export file" and "Choose file…" as "Export Ale" and "Choose Ale…". Seen 2026-09-26 in headless Chrome at 844 × 390 and in a side-by-side render with `font-variant-ligatures: normal` and `none`.
**Expected:** Text reads as written.
**Repro:** Maker → New Level: read the toolbar status. Or level select → Campaign: an unfinished card.
**Notes:** Found while verifying Unit 18, whose Campaign cards use "Not finished yet". It predates Unit 18: the maker's status messages (Unit 16) and the file actions (Unit 17) have always had it. The root fix is one line, `font-variant-ligatures: none` on `html, body`, plus a line under Typography in `3-ui-context.md` (pixel fonts carry their own spacing, and their ligatures are not wanted). Not folded into Unit 18 (Unit 00's file).
**Cause, measured 2026-09-29:** the shipped woff2's `GSUB` has one `liga` lookup with **five** ligatures, not two: fi, fl, ff, ffi and ffl (read with a scratch WOFF2 parser; its other features are `ccmp`, `locl` and `frac`, and `frac` is off by default). So "Starfall Cliffs" was ligated too.
**The one-liner above was not enough.** In the real app's CSS, `font-variant-ligatures: none` on `html, body` fixed paragraphs and spans but left every `<button>` and `<input>` at `normal`: "Choose Ale…", "Export Ale", and a typed "Fire flag field" still showed "Fire Aag Aeld". Browsers give form controls their font through their own `font` shorthand (`font: -webkit-small-control` in Chrome), which resets `font-variant-ligatures`, and a declared value beats inheritance.
**What changed:** `font-variant-ligatures: none` joins `box-sizing` in the `*, *::before, *::after` rule in `base.css`, so every element carries it and no browser reset can undo it. No project CSS uses the `font` shorthand, which is now a rule under Typography in `3-ui-context.md`. No test (CSS is verified by running the game). Checked in the running app at 1280 × 720 in a fresh profile, with an audit of every element's computed `font-variant-ligatures` on each screen: the Campaign cards ("Not finished yet", "Starfall Cliffs"), the maker and its status line ("the finish flag"), the Import dialog ("Choose file…"), the level options dialog ("Export file"), and the rename field with "Fire flag field" typed in. 10 of 10 checks pass, no element anywhere has ligatures on, and the console shows only the known `favicon.ico` 404 (issue 28). `npm test` 308, `npm run build` clean.

---

### 29. The results panel's "Treasure" wraps at 100 [FIXED]

**Closed:** 2026-09-26. Seen in the game: the player finished all six campaign levels, and their saved best treasure of 106, 120, 121 and 154 comes from the new total, which the wrapping meter could never reach.

**Where:** `src/game/stats.js` (`coins` setter, Unit 08), `src/game/play-scene.js` / `src/ui/hud.js` results (Unit 09)
**Symptom:** The results panel shows `stats.coins` as "Treasure". The `coins` setter (the SPW port) turns every 100 into an extra heart and keeps only the remainder, so a run that collects a skull (50), two diamonds (40) and three gold coins (15) finishes with "Treasure 5".
**Expected:** `1-project-overview.md`: the results panel "shows treasure collected". Unit 18's progress also records best treasure, which needs the real total.
**Repro:** From the code (2026-09-26): `stats.js:19-25`; `play-scene.js` passes `world.stats.coins` to `showResults`. In game: collect 100 or more treasure in one run and finish.
**Notes:** Found while drafting the Unit 18 spec. The HUD counter's wrapping is correct: it is the extra-life meter, as in SPW. Only "treasure collected" needs a separate number. Likely fix: `Stats` gains a non-wrapping `treasure` total that a pickup adds to together with `coins` (for example a `collect(n)` method used by `collectibles.js`), and the results panel shows `treasure`. `stats.js` is tested, so it gets a regression test. Unit 18's spec makes this step 0, as its own change.
**What changed (2026-09-26):** `Stats` gained `treasure` (read-only) and `collect(value)`, which adds the value to `treasure` and to `coins`. The `coins` setter still wraps into hearts. `collectibles.js` awards through `collect`. The results panel's Treasure row shows `stats.treasure`: `showResults` now takes `{ treasure, timeMs }`. The HUD's top-right counter still shows the wrapping `coins`. 2 tests in `stats.test.js` (one reproduces the 105-that-showed-as-5 run), and `world.test.js` checks `treasure` on a pickup. `npm test` 277.

---

### 19. Enter on a focused secondary overlay button runs the primary action [FIXED]

**Closed:** 2026-09-24. Player sign-off in the game: "all 3 are fixed".

**Where:** `src/core/input.js` `onKeyDown` (Unit 09 / the 2026-09-13 Enter decision); seen with Unit 16's Back to editor
**Symptom:** `input.js` maps Enter to `pause` and Space to `jump`, and `preventDefault`s both, so a focused `<button>` never receives a keyboard click. On the pause overlay, Tab to **Back to editor** and press Enter: the game resumes instead. On the results panel, Enter on Back to editor replays. The primary buttons only work by coincidence, because `pause` does the same thing they do.
**Expected:** A keyboard user can activate any focused overlay button with Enter or Space.
**Repro:** Test-play a level, press Enter to pause, Tab to Back to editor, press Enter.
**Notes:** Found 2026-09-23 while implementing Unit 16 (from reading `input.js`, not yet reproduced in a browser). Not fixed there — the fix is in `input.js`, which the Unit 16 spec leaves untouched, and it must keep the 2026-09-13 behaviour (Enter pauses and resumes the game when a non-button has focus). Likely fix: in `onKeyDown`, leave Enter and Space to the target when it is a `<button>`, the way form fields already own their keys; then check Resume and Play again still work on Enter by being clicked. Workarounds today: `M` goes back to the editor from anywhere in test-play, and the mouse or a tap works.
**What changed (2026-09-24):** new exported pure helper `isButtonActivation(target, code)` in `input.js`: true for Enter, NumpadEnter or Space aimed at a `<button>`. `onKeyDown` returns early for it (after `fireGesture` and the form-field check) without `preventDefault`, so the focused button gets its native click. Every other key, `M` included, still reaches the game from a focused button, and `onKeyUp` is unchanged. Resume and Play again keep working on Enter because they are focused and now click themselves; Enter on a non-button still pauses and resumes. Checked that nothing keeps a HUD button focused during play: `hud.js` focuses Resume or Play again when an overlay opens, and closing removes it, so focus falls back to the body and Space still jumps. Side effect, standard web behaviour: Space or Enter re-activates the maker toolbar or palette button last clicked with the mouse (neither key does anything else in the maker). 3 tests in `input.test.js`; the `isFormField` test comment corrected. **Not yet seen in a browser** (the extension disconnected): test-play → Enter pauses → Tab to Back to editor → Enter returns to the maker; Enter on Resume resumes; Enter on Play again replays; Space still jumps after resuming with the mouse.

---

### 22. A press and release inside one frame are lost [FIXED]

**Closed:** 2026-09-24. Player sign-off in the game: "all 3 are fixed".

**Where:** `src/core/input.js` `advance()` (lines ~395–402, Unit 02)
**Symptom:** Buttons and the pointer are sampled as levels once per frame: `pressed = next && !held`. If `pointerdown` and `pointerup` (or `keydown` and `keyup`) both arrive between two `advance()` calls, the frame sees nothing and the click is dropped. In the maker, a mouse click that fast places nothing.
**Expected:** Every press the browser delivers produces one `pressed` edge, and its `released` edge follows.
**Repro:** Reproduced 2026-09-24 in a visible Chrome tab running at ~230 fps: a Claude-in-Chrome `left_click` (browser-level mouse input, down and up a few ms apart) on an empty cell with the Goal tool placed nothing, and a 60 ms press on the same cell placed the flag. **Not yet reproduced with physical hardware.** The likely real case is laptop trackpad tap-to-click, which can deliver down and up a few ms apart.
**Notes:** Same class as issue 18 (touch taps), which was fixed in `gestures.js` by emitting press+release together. The engine-level fix would latch an edge: a down seen since the last `advance()` sets `pressed` even if the button is already up again, and `released` fires on the following frame. That changes `input.js`, which Unit 16 does not touch, so it is its own change. Confirm with a trackpad tap in the maker first.
**What changed (2026-09-24):** new exported pure helper `stepButton(button, down, latched)`: `now = down || (latched && !held)`, then the usual edges. `input.js` latches a fresh keydown (auto-repeat does not latch), a virtual-button press (`setVirtual`), and a mouse or pen `pointerdown` together with its button and id. `advance()` runs every action and the pointer through `stepButton` and clears the latches. A press already released before the frame is held for that one frame (`pressed`) and released on the next, so every consumer's existing "pressed, then down, then released" handling works unchanged. On that frame the pointer reports the button and id it was pressed with, because the release reset them (a right-click tap still erases). Touch is deliberately not latched: touch taps belong to `gestures.js` (issue 18) and must respect pan mode. `onBlur` clears the pointer latch. 4 tests in `input.test.js`. **Not yet seen in a browser** (the extension disconnected): a Claude-in-Chrome `left_click` on a cell should now place the selected tool, and a trackpad tap should too.

---

### 23. A fast drag skips cells [FIXED]

**Closed:** 2026-09-24. Player sign-off in the game: "all 3 are fixed".

**Where:** `src/maker/maker-scene.js` paint path (Unit 13)
**Symptom:** A paint drag paints only the cell under the pointer on each frame. When the pointer crosses more than one cell between frames, the cells in between stay empty and a floor drawn in one sweep comes out with gaps.
**Expected:** A drag paints every cell along the path, as a stroke.
**Repro:** Seen 2026-09-24 with synthetic mouse moves of ~1.7 cells per event: a 17-cell floor came out in 7 separate pieces. With moves of ≤ 0.2 cells it was solid. A human sweep at 60 Hz crosses more than one cell per frame at 0.5× zoom or with a quick flick.
**Notes:** Likely fix: remember the last painted cell during a drag and paint the grid line between it and the current cell (Bresenham), per-cell dedupe unchanged, still one command per drag. Pure helper in `tools.js` with tests. Not part of Unit 16.
**What changed (2026-09-24):** new exported pure helper `forEachCellOnLine(c0, r0, c1, r1, visit)` in `tools.js`. It walks the grid path between two cells one axis step at a time (edge-connected, both ends included, the staircase a slow drag paints) using only integer arithmetic. The drag state remembers the last cell under the pointer (`lastC`, `lastR`). When the cell changes, `processPaintFrom` paints the whole path from there. `paintCell(cell)` became `paintAt(c, r)`, which reuses one scratch cell, safe because `applyCell` keeps no reference, so no allocation per painted cell. Per-cell dedupe and one command per drag are unchanged, so a stroke is still one undo step. It covers mouse and touch drags alike, since both go through `processPaintFrom`. 5 tests in `tools.test.js`. **Not yet seen in a browser** (the extension disconnected): the fast synthetic sweep that left 7 pieces on 2026-09-24 should now give one solid floor, and undo should remove it in one step.

---

### 16. Portrait screens stretch the game world ~3× vertically [FIXED]

**Closed:** 2026-09-24. Verified in Chrome (see below), signed off by the player with Unit 16.

**Decision (2026-09-23, player):** option (c) — portrait is not supported for the
canvas; a DOM prompt covers the screen in portrait and asks the player to rotate.
Recorded in `1-project-overview.md` (Input and platform) and `2-architecture.md`
(Rendering Model). The fix is its own small change, not part of Unit 16: a
`ui/` overlay shown when the display aspect is below 1, plus deciding whether the
App holds the simulation while it is up (smallest defensible answer: yes, the same
way it holds during a transition — a player who rotates mid-jump should not die
behind the prompt). **Residual, not covered by the decision:** landscape displays
with an aspect between 1 and 512 / 360 ≈ 1.42 still stretch — 6.7% on a 4:3
tablet, up to 42% on a square desktop window. Revisit if it shows up in play.
**What changed (2026-09-23):** new `src/ui/rotate-prompt.js` +
`styles/rotate-prompt.css` — an opaque `--ink` cover (z-index 10) with a centred
`.panel` ("Turn your device", "Coral Corsairs plays in landscape.") and a CSS phone
outline that turns to landscape (static under reduced motion). It is mounted on
`#app`, not `#ui`, so Unit 16's veiled UI layer can never hide it. `main.js`
computes `portrait = innerWidth < innerHeight` in the viewport's `onResize` and
shows or hides the prompt there; while it is up, `update` only calls
`input.advance()`, so nothing simulates and a press made behind it is dropped, not
replayed. `core/viewport.js` and `VIEW_H` are unchanged.
**Verified 2026-09-24 (Claude in Chrome, a 390 × 844 iframe of the app):** the
prompt shows (mounted on `#app`, "Turn your device" / "Coral Corsairs plays in
landscape."), the game is held (a 400 ms ArrowRight leaves the maker camera
unmoved), resizing the frame to 844 × 390 hides it and the same key then pans.
Still worth a look on a real phone. The title shares issue 21's contrast problem.


**Where:** `src/core/viewport.js` + `#game` CSS (`src/ui/styles/base.css`); the Rendering Model in `2-architecture.md`
**Symptom:** On a 390 × 844 portrait phone the canvas backing store is 512 × 360 (`VIEW_W_MIN` × `VIEW_H`) but CSS fills it to 390 × 844 — x scale 0.76, y scale 2.34, a **3.08× non-uniform stretch**. Tiles, the player and clouds all render tall and thin. Pointer input still maps correctly (`toVirtual` scales each axis separately). Landscape is fine (844 × 390 → 1.01×).
**Expected:** `1-project-overview.md`: "Portrait and landscape both usable; landscape recommended for the maker."
**Repro:** Load `/` in a 390 × 844 viewport (device emulation or an iframe) and compare `canvas.width/height` with its CSS box.
**Notes:** Found 2026-09-22 while verifying Unit 15 in Chrome. This is a **conflict inside the architecture**, not a code slip: "360 units tall, always" + "width clamped to 512–768" + "nothing is letterboxed" cannot all hold when the display aspect is below 512 / 360 ≈ 1.42 (every portrait phone, and 4:3 tablets get a milder 6% stretch). Resolving it needs a decision before any code: (a) letterbox or pillarbox in portrait (the architecture currently forbids it); (b) let the virtual height grow in portrait (breaks "360 tall, always" and changes the field of view); or (c) treat portrait as unsupported for the canvas and ask the player to rotate (changes the overview's promise). Per CLAUDE.md this is reported, not fixed. Possibly related to issue 4's "looks off at phone width".

---

### 18. A quick tap places nothing on touch [FIXED]

**Closed:** 2026-09-24. Verified in Chrome with synthesized touch (see below), signed off by the player with Unit 16.

**Where:** `src/maker/gestures.js` (Unit 14)
**Symptom:** A one-finger tap that lifts before moving 4 px or reaching the 300 ms long-press goes `longPress` → `idle` with no paint event, so nothing is placed. Placing a single coin, enemy or marker on a phone needs a small deliberate drag.
**Expected:** Goal 2 — a first-time user builds a level on a touchscreen without instructions. A tap on a cell should place the selected tool there once, as a mouse click does.
**Repro:** Touch emulation or a phone; pick Gold Coin; tap an empty cell — nothing appears. Drag a few pixels — a coin appears.
**Notes:** Found 2026-09-22 in the repo review, logged 2026-09-23 while writing the Unit 16 spec. Behaves as spec 14 was written (a tap goes to `idle`), so this is a spec gap, not a code slip. Likely fix: on a lift from `longPress` before the threshold, emit `paintPressed` then `paintReleased` at the start point in the same frame, keeping long-press and pan untouched. Not folded into Unit 16 (round trip) — its own change, with a `gestures.test.js` case.
**What changed (2026-09-23):** `gestures.js` — a finger that lifts while still in
`longPress` emits `paintPressed` and `paintReleased` together at its touch-down
point, and reports `active` for that frame so the tap reaches the scene through the
gesture channel. Only a finger that landed on its own can tap (`tapAllowed`): the
finger left behind by a pinch or two-finger pan does not. Pan mode, long-press
eyedrop and drags are unchanged. `maker-scene.js` `processPaintFrom` now handles
release **after** press and drag, so a same-frame press+release places once and
closes its command (one undo step). 2 tests in `gestures.test.js`; a scratch
harness against the real scene confirmed one coin per tap and one undo per tap.
**2026-09-24, Chrome (844 × 390 iframe, synthesized `pointerType: 'touch'` events
through the real `input.js`):** a 40 ms tap with the Goal tool placed the flag,
cleared the status and enabled Undo. The physical-touchscreen check was among the
items the player signed off with Unit 16.

---

### 20. Every nine-slice composite is built from the wrong tiles [FIXED]

**Fixed:** 2026-09-24 (found by the player during Unit 16 testing; scoped fix in Unit 01 / Unit 15 tooling)
**Where:** `tools/asset-manifest.mjs`, `tools/build-assets.mjs` `writeNineSlice`; output `public/assets/ui/{board-yellow,board-green,paper-yellow,button-yellow,button-green}.png`
**Symptom:** The palette bar, toolbar, dialogs and pause/results panels drew scrambled wood: repeating vertical posts, a gap cut into the frame, a row of small squares along the bottom edge.
**Cause:** `writeNineSlice` picked files 1,2,3 / 5,6,7 / 9,10,11, assuming the 16 files are numbered like the 4 × 4 guide picture. They are not. Re-checked on 2026-09-24 with a labelled contact sheet of all five kits: boards and paper have the 3 × 3 frame at files `1–9` in reading order (`10–12` bar, `13–15` column, `16` single); buttons have it at `8–16` (`1` single, `2–4` bar, `5–7` column).
**What changed:** `nineslice()` in the manifest takes a `first` argument, the file number of the frame's top-left tile: `1` for Yellow Board, Green Board and Yellow Paper, `8` for Yellow Button and Green Button. `writeNineSlice` takes nine consecutive files from there and throws if the kit has too few files. `npm run assets` regenerated **only** the five composites. Sizes are unchanged (96 × 96, 42 × 42), and `atlas.json` and `coverage.json` are byte-identical: the packer already marked all 16 tiles of each kit as consumed, so the earlier note that coverage would change was wrong. A second `npm run assets` is byte-identical. `npm test` 223, `npm run build` clean. Verified in Chrome (desktop, 1512 × 795): toolbar, palette bar, toolbar buttons, the Menu dropdown and the resize dialog all draw clean frames, with no console errors. `3-ui-context.md` (Nine-slice panels) and `2-architecture.md` (Asset Pipeline) corrected to the real numbering. Also seen later the same day during the Unit 16 run: the results panel in test-play and the maker at 844 × 390. Player sign-off 2026-09-24: "the ui got fixed".

---

### 1. ~~UI nine-slice source is the kit guide, not a textbook 9-slice~~ [FIXED]

**Fixed:** 2026-09-21 (Unit 15). Moved here from Open Issues on 2026-10-02, where it had been left after it was fixed.
**Where:** `tools/build-assets.mjs` `writeNineSlice`
**What changed:** `writeNineSlice` now extracts the 3×3 nine-slice subset (indices
0,1,2 / 4,5,6 / 8,9,10) from the 16-tile kit guide and composites them into a
`tile × 3` PNG: 96×96 for boards/papers, 42×42 for buttons. `border-image-slice`
at the tile size (32 or 14) produces correct corners, edges and fill. `dialog.css`
`.panel` and `.btn` upgraded to nine-slice `border-image`. All five composites
regenerated and committed. **The tile pick above was wrong:** see issue 20, fixed
2026-09-24.

---

### 3. Small clouds pop out mid-screen instead of exiting left [FIXED]

**Fixed:** 2026-09-13 (found during the Unit 08 play check; scoped bug fix in Unit 05 code)
**Where:** `src/level/parallax.js` `recycleLeftmost` → now `recycleExited` + pure `pickRecyclable`
**Symptom:** Every `cloudTimer` (2.5 s) a small cloud that was still fully visible — near the left edge of the screen — vanished instantly, rather than drifting off the left edge.
**Cause:** `recycleLeftmost` selected the cloud with the **minimum** wrapped `sx` in `[0, period)`. In that coordinate `sx ≈ 0` is a cloud at the left edge but still fully on screen; a cloud that has genuinely exited past the left wraps to `sx ≈ period` (the top of the range), because `wrap` maps a negative screen-x to `period + x`. So the "leftmost" pick was the most-visible left cloud, and teleporting it to the right popped it.
**What changed:** Extracted the selection into an exported pure helper `pickRecyclable(clouds, camX, viewW, period, factor)` that computes the same signed screen x `s` the draw path uses, considers only clouds fully off the left edge (`s + w <= 0`), and returns the most recently exited one (greatest such `s`), or `-1` when none has exited (so a visible cloud is never moved). `recycleExited` is a thin wrapper; the right-edge destination is unchanged. Regression tests added in `parallax.test.js` (4 cases). `npm test` 95 passing, `npm run build` clean. No schema, theme, or invariant change.

---

### 10. Maker toolbar state goes stale while the pointer is off the level [FIXED]

**Fixed:** 2026-09-22 (found in a repo review after Unit 15; scoped fix in Unit 15 code)
**Where:** `src/maker/maker-scene.js` `render`
**Symptom:** On a fresh level, Undo, Redo and **Play** all showed enabled — Play with no goal placed — until the mouse moved over a level cell. Clicking toolbar Undo near the level's left edge could leave Undo enabled on an empty stack.
**Cause:** `toolbar.sync` ran at the very end of `render`, after `if (!level.inBounds(cell.c, cell.r)) return;` for the cursor. The maker opens with the camera 2 tiles past the left edge and the pointer at (0, 0), and the Back/Undo buttons sit over that margin, so the sync was skipped exactly when it mattered. The toolbar's `prevCan*` start at `true`, so nothing disabled the buttons.
**What changed:** The sync block moved above the cursor early-return, so it runs every rendered frame. Verified in Chrome: fresh load shows Undo/Redo/Play disabled; after a paint drag Undo enables; clicking Undo with the pointer parked over the toolbar disables Undo and enables Redo. DOM reconcile stays in `render` (invariant 3). No test — scene/DOM code is verified by running the game.

---

### 11. Game keys swallowed inside form fields; resize dialog outlives the maker [FIXED]

**Fixed:** 2026-09-22 (found in a repo review after Unit 15; scoped fix in Unit 02 / Unit 15 code)
**Where:** `src/core/input.js` `onKeyDown`; `src/ui/components/resize-dialog.js`; `src/maker/maker-scene.js`
**Symptom:** With the resize dialog's number field focused, ArrowUp/ArrowDown panned the maker instead of stepping the value (reproduced in Chrome: three ArrowUp presses left 160 unchanged). Any future text field (Unit 17 level name, share-code paste) could never receive W, A, S, D, M or Space. Pressing `M` while the dialog was open switched to play and left the dialog stranded over the game.
**Cause:** `input.js` listens on `window` in the capture phase and `preventDefault`s every mapped key regardless of target, so the field never got its default action. Separately, `openResizeDialog` appended its overlay to `#ui` with no handle, so `makerScene.unmountUI` could not remove it.
**What changed:** New exported pure helper `isFormField(target)` in `input.js`. `onKeyDown` returns early for form-field targets (after `fireGesture`, so audio unlock still works); `onKeyUp` is unchanged, so a key held before the field took focus still releases. Buttons are deliberately not form fields — the pause overlay relies on Enter reaching `input.js` while Resume has focus (2026-09-13 decision). `openResizeDialog` now returns an idempotent `{ close }`; the maker keeps it and closes it in `unmountUI`, and its `openResizeDialog` param is typed instead of `Function`. 4 tests in new `core/input.test.js`. Verified in Chrome: ArrowUp in the field steps 160 → 163; `M` typed in the field does not switch modes; `M` with focus on the dialog's Cancel button switches to play and the dialog closes with no stray overlay; six page-level `M` presses toggle modes six times.

---

### 12. Music track alone is 85% of Goal 4's 3 MB budget [FIXED]

**Fixed:** 2026-09-22 (found in a repo review after Unit 15; player chose re-encoding over rewording Goal 4)
**Where:** `tools/asset-manifest.mjs` `audio`, `tools/build-assets.mjs`
**Symptom:** `public/assets` was 2.74 MB, of which `starlight_city.mp3` (192 kbps stereo, 106 s) was 2.44 MB. With JS and CSS the shipped game was ~2.83 MB before any campaign level, the ship tilesheet (Unit 20) or PWA files (Unit 21). `attack.wav` (34 KB) also shipped although nothing plays it.
**Expected:** Goal 4 — code, art, audio and campaign under 3 MB — with room for the remaining units.
**What changed:** `ffmpeg-static` (devDependency, install script approved in `package.json` `allowScripts`) re-encodes any audio manifest entry that has a `bitrate`. The music is now 96 kbps CBR, 48 kHz stereo, 1.28 MB. `attack.wav` removed from the manifest. `public/assets` is now 1.49 MB. Two consecutive `npm run assets` runs are byte-identical, and every PNG plus `atlas.json` is unchanged from the previous commit. Verified in Chrome: the new MP3 decodes (106.44 s, 2 ch, 48 kHz) and the game loads with no audio warnings. **Not verified:** how it sounds — 96 kbps joint stereo should be transparent enough for background music, but it needs a listen on the player's speakers or headphones.

---

### 13. Moving platforms promised in the overview, but no unit builds them [FIXED]

**Fixed:** 2026-09-22 (found in a repo review after Unit 15; scope decision by the player: defer)
**Where:** `context/1-project-overview.md` Features; `src/game/player.js`
**Symptom:** The overview's play-mode features listed "moving platforms that carry the player", but no unit in `specs/00-build-plan.md` built one. Unit 06 left an inert `Player.platform = null` field plus a carry branch that nothing ever set; Units 07 and 08 re-deferred it without naming a home.
**Cause:** The feature has no art in the pack — Super Pirate World's moving platforms use its own helicopter sprites, which we do not pack (2026-09-06 decision) — and format 1 has no way to express a platform's path, so no unit ever picked it up.
**What changed:** Moved to **Deferred, not rejected** in `1-project-overview.md` with the reason; dropped from the Features list and from the architecture doc's physics paragraph; Unit 06's line in the build plan notes the stub's removal. Deleted `Player.platform` and its carry branch (dead code — git keeps it). No behaviour change: the field was always `null`. `npm test` unchanged.

---

### 14. Nine-slice sizes drifted after Unit 15 — atlas metadata and three docs [FIXED]

**Fixed:** 2026-09-22 (found in a repo review after Unit 15)
**Where:** `tools/build-assets.mjs` (nineslice branch of `main`); `context/2-architecture.md` Asset Pipeline; `specs/00-build-plan.md` Unit 01; `context/4-code-standards.md` File Organization
**Symptom:** Unit 15 (issue 1) changed `writeNineSlice` to composite a 3 × 3 subset, so the PNGs are 96 × 96 and 42 × 42, but `atlas.json` still declared all five `ui/board-*`, `ui/paper-yellow` and `ui/button-*` entries at 128 × 128 / 56 × 56. The architecture doc and the build plan still described the 4 × 4 layout. Separately, the code standards listed a `core/rng` module that has never existed (the parallax LCG lives in `level/parallax.js`).
**Cause:** The Unit 15 fix updated `writeNineSlice`'s own `size` but not the atlas entry beside its call site (`clip.tile * 4`), and only `3-ui-context.md` was re-synced.
**What changed:** Atlas size is `clip.tile * 3`; regenerated — only those five entries changed, every PNG byte-identical. Docs corrected. No runtime impact: CSS references the PNGs directly and nothing in `src/` reads these five atlas sizes; only the `/atlas.html` debug page drew them at the wrong size.

---

### 15. Dead code and a duplicated level-id generator [FIXED]

**Fixed:** 2026-09-22 (found in a repo review after Unit 15)
**Where:** `src/ui/maker-palette.js`; `src/level/schema.js` + `src/level/model.js`; `src/core/input.js`
**Symptom:** `findGroupForEntry` in the palette was never called and returned its argument. Two level-id generators existed: `schema.newLevelId` (`Math.random`, 6 chars, used by `createBlankLevel`) and a private `model.randomLevelId` (`crypto`, 8 chars, used by `createEmptyModel`), so ids had two shapes depending on which path made the level. `input.js` had an orphaned duplicate JSDoc block above `toVirtual` and `onKeyDown`'s `@param` sitting on `fireGesture`.
**What changed:** Deleted `findGroupForEntry`. One generator: `schema.newLevelId` now uses `crypto.getRandomValues` for `lvl_` + 8 base-36 chars, and `model.js` imports it. Existing ids are untouched (schema only requires a non-empty string). 2 tests added to `schema.test.js`. JSDoc fixed. `npm test` 201.

---

## Known-Risk Watchlist

Not bugs — hazards identified during the reference and asset study that are likely
to bite, with the countermeasure to apply when the relevant unit is built. If one of
these actually happens, promote it to a numbered entry above.

### 1. iOS Safari touch behaviour

**Bites in:** Unit 14 (maker gestures), Unit 09 (on-screen controls).
Double-tap zoom, elastic overscroll, long-press text selection and `pointercancel`
mid-drag all break painting and D-pad holds. Set `touch-action: none` on the canvas
and every control, `user-select: none` and `-webkit-touch-callout: none` on the app
shell, `overscroll-behavior: none` on `html, body`, and handle `pointercancel` as a
release. Never rely on `preventDefault` inside `pointermove` alone.
**Applied in Unit 14:** `-webkit-touch-callout: none` is now on `html, body`.
The other items were already in place from Units 00 / 09 / 13.

### 2. Audio starts suspended

**Bites in:** Unit 12.
`AudioContext` begins in `suspended` state on every browser and must be resumed
inside a real user gesture. Resume on the first `pointerdown` or `keydown` the input
module sees, then preload buffers. Also expect iOS to route Web Audio through the
ringer switch in some configurations — never make audio a precondition for
gameplay to start.

### 3. `localStorage` throws in private mode, and has a hard quota

**Bites in:** Unit 17. **Handled in Unit 17** (`safe-storage.js`: memory fallback
with a notice on My Levels; a quota is reported and never silently moved to memory).
Safari private browsing throws on write; other browsers throw `QuotaExceededError`
at roughly 5 MB. `safe-storage.js` must try/catch every access and fall back to an
in-memory map. Quota exhaustion must surface a readable message with a way to free
space — never a silent failed save.

### 4. Non-integer canvas scale shimmers

**Bites in:** Unit 02.
Because viewport width is derived from the display aspect, the scale factor is
usually fractional, which can make one-pixel edges crawl during camera movement.
Round every draw destination to whole world pixels with `Math.round`, and round the
camera position itself before use. If it is still visible, the fallback is the
optional crisp-scale setting: integer scale with letterboxing.

### 5. 10 FPS art on a 60 Hz simulation

**Bites in:** Unit 02, Unit 04.
The pack is authored at 10 FPS. Advance `frameIndex` in fixed-timestep seconds and
take `Math.floor(frameIndex % frameCount)`; never derive the frame from
`performance.now()` or a render-time delta, or animations will stutter differently
from the simulation.

### 6. `CompressionStream` is not universal

**Bites in:** Unit 17 (UI). **Countermeasure shipped in Unit 03**, and Unit 17's
saves inherit it (`encodeShare` falls back to `u`).
`deflate-raw` is unavailable on older Safari. Codec uses prefix `z` (deflate-raw)
or `u` (uncompressed base64url) and never guesses. Both paths have round-trip tests
in `codec.test.js`. Unit 17 still needs a user-visible fallback if encode fails.

### 7. A backgrounded tab produces an enormous delta

**Bites in:** Unit 02.
Returning to a tab after minutes yields one huge `requestAnimationFrame` delta. Cap
the accumulator at 5 fixed steps per frame and discard the rest, or the player will
tunnel through the floor on resume.

### 8. Camera clamping breaks on small levels

**Bites in:** Unit 02, Unit 04.
Super Pirate World's `camera_constraint` (`code_complete/groups.py`) computes
`right = -width + WINDOW_WIDTH`, which crosses `left` when the level is narrower
than the viewport, and the clamp then fights itself. Our minimum level is 40 × 12
cells = 1280 × 384 world pixels against a maximum viewport of 768 × 360, so there is
only 24 pixels of vertical slack. Clamp with `Math.min`/`Math.max` in an order that
degrades to centring when the level is smaller than the view.

### 9. Renaming an entity kind id silently corrupts saved levels

**Bites in:** any unit touching `src/data/palette.js`.
Kind ids are strings written into every saved level and every share code. Changing
one is a breaking format change. If a rename is unavoidable, bump `format` and add
an alias map in `schema.js` — never rename in place.

### 10. Unbounded undo stack

**Bites in:** Unit 13.
A paint drag across a large level can generate thousands of cell changes. Coalesce
one drag into one command, store the inverse as a compact diff rather than a level
snapshot, and cap the stack (100 commands) so memory stays flat on a phone.

### 11. Sprite strip sampling

**Bites in:** Unit 01, Unit 02.
Frames are packed edge to edge with no padding. Source rectangles passed to
`drawImage` must be exact integers computed as `frameIndex * frameWidth`. If any
bleeding from an adjacent frame appears, the fix is a one-pixel extrude in the
packer, not padding — padding would change the frame stride the manifest declares.

### 12. Web font flash

**Bites in:** Unit 00.
Pixelify Sans is self-hosted with `font-display: swap`, so the first paint uses the
fallback and text reflows. Reserve layout with fixed-size buttons and avoid text
that changes the size of its container, or the title screen will jump.

### 13. iOS Safari evicts script-written storage

**Bites in:** Unit 17 onward; Unit 22 (PWA) is the countermeasure.
Safari deletes a site's script-written storage (`localStorage` included) after
seven days without a visit, unless the site is installed to the home screen. A
player's levels can simply vanish. Share codes and `.json` export are the backup
today. Unit 22 Part B makes the app installable. Unit 22 Part C asks
`navigator.storage.persist()` once per page session, after a level save
succeeds; the browser may still deny it, and nothing is shown to the player.
A gentle "back up your levels" hint is still not built.
