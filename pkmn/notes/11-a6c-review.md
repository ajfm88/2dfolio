# A6c — Codex review of Claude's implementation

## Re-review — `4d3c407` (2026-10-03): changes requested on R-3

Reviewed **`4d3c40741ea2fb63b6cb10d1d3cc5fee099470cb`**, Claude's R-1/R-2
revision on `47a940e`. Compared all 15 changed files with that reviewed parent
and rechecked the relevant Yellow ASM at read-only `e89ead15`.
The original START clipping and ordinary text/nurse antic-reset reproductions
are fixed. **One new P2 regression prevents approval: talking to Pikachu can
leave its turn pending through the real face popup and apply it during an
unrelated later dialogue.** No engine changes made by Codex.

### Original findings: resolved

| Finding | Re-review result |
|---|---|
| R-1: native UI footprint/availability guard | Resolved. `pikachuCovered` implements X+2, 16-pixel Y alignment and byte wrap. Both ordinary/UI follower dispatch reject covered sprites before advancing state. Rendering also hides the whole sprite on the first UI frame. Actual START capture is tested. Collision availability reads the simulated image latch. |
| R-2: uncovered font-loaded reset and nurse no-move route | Original reproductions resolved. An uncovered follower takes the standing/reset/reseed branch; a covered follower freezes first. All four antics and the fresh 256-update wait are tested. The nurse explicitly runs the map-view/font pass before deciding whether any moves are needed. The newly changed Pikachu interaction path has R-3 below. |

The tick captures coverage itself, so these simulation transitions do not
depend on render frequency or coverage from a previous rendered frame. The
revision preserves the camera, ordinary movement pass order and no-idle-RNG
script movement. A bounce hidden by a box remains image-hidden until a later
routine redraws it, matching `asm_fc87f`'s retained image behavior.

### R-3 — P2: serve the face-player request with the real portrait lifecycle

**Locations at the reviewed commit:**

- `game/src/overworld/overworld_controller.ts:161`: direct talk-facing was
  replaced with `requestFacePlayer()`.
- `game/src/main.ts:1533` / `:1548`: `checkUiEntry` captures the already-visible
  portrait box before the only pending-turn handler runs.
- `game/src/pikachu/pikachu_follower.ts:254`: `fontLoadedUpdate` returns on UI
  coverage before checking `facePlayerPending` at `:259`.
- `game/src/pikachu/pikachu_follower.ts:214`: ordinary `updateSprite` never
  checks that pending flag.

The actual portrait renderer (`pikachu_emotion.ts:108`) draws a box at
**`(48,40)` with size `56×56`**. All four normal adjacent follower positions
have a native footprint inside this box. When you talk to Pikachu, UI capture
therefore hides it and returns before the turn. Closing the popup runs no
map-view/font pass, and ordinary updates ignore the pending turn. Pikachu
reappears facing its previous direction rather than facing you. Opening an
unrelated uncovered text later can finally consume the old request using the
player's direction at that later time.

**Independent reproduction:** outside the repository, bundled the real
follower, `UiEntry`, `fontLoadedUpdateSprites`, renderer/capture code and
`renderPikachuEmotionBox` using esbuild. Only the DOM/Canvas surface and the
player/map dependency values were stubbed; the actual portrait drawing
registered its actual coverage. With player `(128,128)` facing right and a
standing Pikachu at `(144,128)` facing up (a valid idle-glance state), request
the turn exactly as the new interaction handler does, open/capture the
portrait, close it, and run an ordinary sprite pass:

```text
emotion-open: facing=up, image=false, tileAt(10,8)=$60
first ordinary pass after close: facing=up, image=true
expected after talking from Pikachu's left: facing=left
later unrelated bottom text, player facing up: facing changes up → down
expected on unrelated text: no stale interaction turn
```

Both expected-behavior assertions fail against `4d3c407`. This is a Node
integration probe, not a browser play-test. It reproduces a regression from
the prior direct-facing interaction. Scratch source, bootstrap and bundled
output were removed; no repository test/configuration file was changed.

**Why the committed test passes:**
`overworld_controller.test.ts:479`'s `afterTick` registers the bottom dialogue
box `(0,96,160,48)` even for `pikachu_emotion`. The new interaction test at
`:506` therefore leaves Pikachu uncovered and exercises a branch that the real
portrait path cannot reach. The real START test is useful; the Pikachu test
needs the same fidelity to its actual UI renderer.

**ASM basis:**

- `home/overworld.asm:1165` sets `BIT_FACE_PLAYER` when a sprite is found.
- `engine/pikachu/pikachu_emotions.asm:14` sets
  `wAutoTextBoxDrawingControl = 1` before `DisplayTextID`. Bit 0 is
  `BIT_NO_AUTO_TEXT_BOX` (`constants/ram_constants.asm:18`), so
  `DisplayTextIDInit` skips the automatic border, then calls `UpdateSprites`.
  The turn can be handled before the portrait box covers the sprite.
- `SpawnPikachu_` (`pikachu_follow.asm:351`) checks availability, then bit 7
  **before both font-loaded and ordinary dispatch**. `Func_fc745` is not
  exclusive to UI updates.
- The portrait border is drawn later by
  `PlacePikapicTextBoxBorder` (`pikachu_pic_animation.asm:136`), which calls
  `UpdateSprites` after writing the centered box. `CloseTextDisplay`
  (`home/text_script.asm:104`) restores the map and calls `UpdateSprites` too.

**Required revision:**

1. Serve the pending bit-7 branch on every eligible equivalent of
   `SpawnPikachu_`, before choosing font-loaded versus ordinary behavior.
   Availability still comes first: a covered/off-window sprite may defer a
   request, but the next eligible ordinary pass must not ignore it.
2. Wire Pikachu conversation entry in source order: the no-auto-border text
   initialization/turn precedes the portrait's coverage. Handle the applicable
   map restoration on exit. This can be a focused lifecycle correction; a full
   emotion-script port is outside this slice.
3. Replace the surrogate bottom-box interaction test with actual
   `captureUi(renderPikachuEmotionBox)` integration. Verify the turn, hiding and
   reappearance, no delayed turn on unrelated text, and all four approach
   directions. Also test a pending request deferred by coverage and then
   served on an ordinary uncovered pass, including its animation/countdown
   behavior. Preserve R-1's freeze/availability order and R-2's reset rules.

Do not bypass the coverage check to force a turn under a box or invoke an
ordinary movement/idle pass to flush the flag. Claude's documented antic-status
simplification in `Func_fc745` should be assessed with the corrected
entry/exit sequence, which the current surrogate test does not exercise.

### Re-review verification and next handoff

| Independent check against `4d3c407` | Result |
|---|---|
| `npm run typecheck` | Pass. |
| `$env:ROM_PATH='pokeyellow.gbc'; npm test` | **699/699**, 27 files, default timeout. |
| `npm test` without `ROM_PATH` | **628 pass / 71 skip**, 27 files. |
| `npm run build` | Pass; 97 modules, 308.65 kB bundle (88.56 kB gzip). |
| `git diff --check` | Clean. |
| Independent actual-portrait probe | Two failed expected-behavior assertions, both reproducing R-3. |

No extractor/data/assets/save/dependency changes or browser/server/save
manipulation in this review. Existing NPC image timing, map metadata, F-1
camera and the later A6d work retain their homes. **Next: Claude fixes R-3,
records the exact revision and checks, then Codex re-reviews.** The user's
plan §10 play-test follows a passing review. A6c remains in progress.

---

## Original review — `22919a7` (2026-10-03)

2026-10-03. **Verdict: changes requested.** The movement, collision and idle
state machines follow the plan closely, but two Pikachu UI integration issues
need fixes before approval. Both are P2: observable behavior errors in the
current engine, with deterministic reproductions. A6c remains in progress.

## Reviewed revision and scope

- Implementation: **`22919a70de8110ac6ed7e8cc830076a0df72c10c`** (`22919a7`).
- Engine baseline: **`1854ef1813162ed6c55c258f4250f640b6b5b107`**, the reviewed,
  user-verified A6b result. Planning commit: `d49d7a3`.
- Specification: [A6c plan](10-a6c-plan.md), including its implementation result.
- Primary source: read-only `refs/pokeyellow` at **`e89ead15`**. Rechecked the
  movement, sprite collision, Pikachu follow, player obstruction, trainer and
  text/Pokécenter routines. No reference checkout was changed or refreshed.
- Reviewed the changed engine code, tests and architecture notes, plus actual
  callers in `main.ts`, the overworld controller and script controller.
- The working tree was clean at the start. This review changes documentation
  only; Claude's engine code is left intact for a focused revision.

## R-1 — P2: port Pikachu's UI footprint guard before dispatch and drawing

**Locations:** `game/src/pikachu/pikachu_follower.ts:183` (`updateSprite`) and
`:281` (`render`); `game/src/overworld/sprites.ts:58` (ordinary follower caller).

`updateSprite` checks only the map window. `render` checks the loaded sheet,
follower eligibility and image latch, but never checks `uiTiles`. In contrast,
`Npc.render` already suppresses a whole sprite when UI tiles cover its footprint.
The existing UI layer covers pixels after sprites are drawn; that alone cannot
reproduce Yellow's whole-sprite hiding at a menu edge.

**ASM:** `engine/pikachu/pikachu_follow.asm:351` calls
`WillPikachuSpawnOnTheScreen` **before** movement/font/idle dispatch and returns
on failure. At `:1476`, that routine checks the map window and all four footprint
tiles against `$60`. If covered, it sets `IMAGEINDEX = $ff` and returns before
movement, countdown, animation or RNG can advance. Its `.GetNPCCurrentTile`
uses `(YPixels + 4) & $f0` and `(XPixels + 2) >> 3`. This differs from the NPC
footprint; blindly reusing `spriteCovered` would get the boundary math wrong.
See plan §4's explicit warning about this predicate.

**Reproduced:** place the player at `(128,128)`, spawn Pikachu facing left (so it
is on the player's right at `(144,128)`), retain command 7, and enter the bounce
with injected random byte 0. After 258 eligible updates the offset is `(-2,-4)`.
Register START coverage with `uiTiles.cover(80, 0, 80, 112)` and render with camera
`(64,68)`:

- Actual: `drawSprite(sheet, 0, 32, 78, 52, false)` is called.
- Expected: no Pikachu draw. Native X is 78; X+2 selects tile column 10, under
  START, and the native Y footprint is also covered.
- The extracted standing-left sprite has opaque pixels in column 1 (rows 8–9).
  Those land at screen `(79,60)` and `(79,61)`, outside START's left edge. This
  makes the missing guard visibly relevant even with the UI composite in place.
- With the same covered fixture, another `updateSprite` changes the offset to
  `(-3,-2)` instead of hiding the image and leaving the antic untouched.
  Ordinary menu frames currently stop overworld updates, but this helper still
  lacks the source's availability branch for UI-related sprite passes.

**Required revision:**

1. Add a pure Pikachu footprint predicate with the source's byte arithmetic,
   X adjustment and 16-pixel Y alignment, using the GB coordinate basis.
2. Apply the window/UI availability result before ordinary follower dispatch.
   A rejected pass must hide the transient image and freeze movement, idle,
   offsets and RNG. Preserve `visible` as separate follower eligibility.
3. Wire coverage into the actual text/menu lifecycle and render path. Coverage
   is currently collected in `captureUi` during rendering; simulation decisions
   must not depend on whether/how often a render happened. Keep the ordered
   player → NPCs → Pikachu collision snapshots intact.
4. Include a render guard for the first UI frame. Do not fix the existing F-1
   camera displacement as part of this change.

**Tests needed:** native footprint boundary cases (especially the Y alignment
and X+2 boundary), whole-sprite hiding during a bounce beside START, covered
follower image availability in collision snapshots, no countdown/RNG/offset
advance on rejected passes, and uncovered/closing-menu behavior. Exercise
actual UI capture/entry integration as well as a pure helper.

## R-2 — P2: reset uncovered antics when the font/UI entry branch runs

**Locations:** `game/src/pikachu/pikachu_follower.ts:46` / `:183` (context and
dispatch); `game/src/main.ts:1131` / `:1738` (START/text entry);
`game/src/script/script_controller.ts:632` (nurse's no-move path).

Neither the ordinary follower context nor text/START entry represents the
font-loaded branch. Opening UI simply stops overworld updates. An uncovered
bouncing Pikachu therefore stays displaced for the whole text/menu and resumes
the old antic afterward. Other antics keep their old animation/countdown too.

The direct script `update()` resets idle, and `showPikachu` calls `stopIdle`, but
neither covers ordinary UI entry. The nurse's already-above-player branch also
returns before direct movement, so it can carry the same frozen bounce into
the next text and wait until `hidePikachu` eventually clears it.

**ASM:** `engine/menus/display_text_id_init.asm:28` draws the box, `:30` sets
`BIT_FONT_LOADED`, and `:36` calls `UpdateSprites` unless the explicit sprite
update suppression flag applies. `SpawnPikachu_` tests font state at
`pikachu_follow.asm:366`, after availability and the movement-status bit-7
branch. It jumps to `Func_fc76a` (`:450`), which:

- Clears both animation counters and updates the standing image.
- Restores the logical screen position when the player is stationary.
- Sets ready status and countdown zero.
- Calls `RefreshPikachuFollow`, reseeding retained command state from relative
  logical positions.

Plan §6.2 explicitly requires translating this branch into the current
engine's context. Merely suspending updates does not implement it.

**Reproduced:** use the same injected bounce setup, but spawn facing down so
Pikachu is above the stationary player at `(128,112)`, outside the lower text
box. Interact with a normal NPC below the player:

- `updateOverworld` returns `{ type: 'textbox', text: 'hello' }` with
  `antic === 'bounce'` and offset `(-2,-4)` still present.
- Inspection of `handleOverworldAction` and the textbox update branch confirms
  that handling this action never resets the follower. The render path uses
  the retained offset, so it stays suspended until overworld updates resume.
- A separate script probe using `initScript([{ type: 'pikachuToNurse' }])`
  with this above-player follower also returns with the bounce retained.
  This isolates the no-move escape path; it is not a browser playthrough of the
  full healing sequence.

The native Pokécenter sequence calls `UpdateSprites` after the yes/no choice
and again before `PikachuWalksToNurseJoy` (`engine/events/pokecenter.asm:23` /
`:34`). With the font loaded and an available follower, the reset has already
happened even if the movement routine needs no steps.

**Required revision:** introduce an explicit equivalent of the font-loaded /
ordinary-follow-disabled transition and connect it to the actual UI entry and
script text lifecycle. Reset animation, screen offset, antic, countdown and
retained command state at the source-equivalent moment. Ensure the nurse's
no-move route gets the same applicable transition. Calling `stopIdle()` alone
does not reset/reseed all of this; calling movement `update()` could consume
queued targets and is not an appropriate substitute.

**Ordering matters:** R-1's availability test runs first. A covered or
off-window follower returns before the font reset and keeps its frozen state.
An uncovered eligible follower takes the reset. Do not apply a blanket reset
to every follower just because a menu opened. Preserve the bit-7/script branch
where applicable, ordinary movement timing and no-idle-RNG script behavior;
avoid adding an extra ordinary movement pass while entering UI.

**Tests needed:** actual text and START entry during each antic, standing image
and zero offset for an uncovered follower, command reseeding, and a fresh
256-update wait when the resulting command is below 5. Include the nurse's
above-player route, UI-covered versus uncovered ordering, and existing queued
script movement / old-man / lab / nurse regressions. Text/menu frames should
still contribute no ordinary idle updates.

## What passed the review

| Area | Assessment |
|---|---|
| NPC direction and rest | Correct byte intervals and axis folds; STAY/fixed tries still consume direction RNG; failed tries face first; raw zero rest wraps to 256; rest expiry only becomes ready. |
| Wander displacement and edge checks | Live unsigned displacement initialized to 8/8, negative borrow and positive overflow with atomic rejection, no invented origin box; source screen-edge math in the GB basis. |
| Sprite collision geometry and update order | Pixel/vector rules, inclusive bounds, mask OR, exact-front check and slot order match the source. Player mask is captured before sequential NPCs and Pikachu. R-1 remains a follower availability integration gap. |
| Defeated trainer turning | Live STAY/NONE override with rival/Tower 7F exclusions; no save/map-data mutation, no override reapplied on later after-battle talk. |
| Pikachu idle/antic helpers | Retained command, first 256/later 32 countdown, immediate antic entry, durations, reverse Y/X bounce, image latch and byte/equality animation behavior are well covered. Off-window freeze and walking interruption are correct. R-1/R-2 remain the UI caller gaps. |
| Turning/walking into Pikachu | Counter arms 8, seven eligible checks block, eighth can pass; B bypasses only the follower gate, terrain still applies; no-input and successful movement clear the counter. |
| Scope and existing script paths | No extractor/generated data/assets/dependency/save changes, camera correction, trainer-sight rewrite, runtime ROM dependency or committed debug hook. Existing script tests pass. |

The choices documented in Claude's result note are reasonable within the
agreed slice: initialization before the first ordinary pass, in-step NPC hold,
script vector retention, hidden same-tile Pikachu spawn and the staged native
follow-buffer work for A6d. They do not justify omitting the UI branches above.

## Independent verification

Run from `game/`, against the unchanged implementation:

| Check | Result |
|---|---|
| `npm run typecheck` | Pass. |
| `$env:ROM_PATH='pokeyellow.gbc'; npm test` | **681/681**, 26 files; default timeout, no retry needed. |
| `npm test` without `ROM_PATH` | **610 pass, 71 skip**, 26 files. |
| `npm run build` | Pass; 96 modules, 306.90 kB bundle (88.06 kB gzip). |
| `git diff --check` | Clean. |
| Four independent UI/font probes | **4/4 failed expected-behavior assertions**, reproducing R-1 and R-2. |

The probes used the existing renderer/input/audio mocks and deterministic
random bytes. Their temporary test file was removed after recording the
results; they are not part of the 681 committed tests. No engine/configuration
change was needed to reproduce the findings. Source pixel inspection confirmed
the START-edge example above. No browser automation, server, save manipulation
or user play-test was performed or claimed.

For recreating the core fixture in the permanent tests:

```ts
const p = new PikachuFollower();
await p.loadSprite();
p.visible = true;
p.spawn(128, 128, 'left'); // use 'down' for the uncovered text/nurse case
p.appendFollowCommand(7); // use 5 for the above-player fixture
const ctx = {
  playerWalking: false,
  playerMapStep: { x: 8, y: 8 },
  playerFacing: 'down' as const,
  random: () => 0,
};
for (let i = 0; i < 258; i++) p.updateSprite(ctx);
// antic === 'bounce'; screenOffset === { x: -2, y: -4 }
// For R-1, register START coverage and use camera (64,68).
// For R-2, perform real text/menu entry with the uncovered follower.
```

## Existing deviations and next handoff

- **NPC image refresh timing:** Claude's documented A6b deviation is confirmed.
  `Npc.update` refreshes after movement; native `CheckSpriteAvailability`
  refreshes before `TryWalking` (successful starts explicitly refresh again).
  A failed try's facing can display one pass early. This behavior predates this
  slice; record for a later fidelity audit rather than expanding this revision.
- **Map metadata:** confirmed Route 1's two youngsters and the Viridian
  Pokécenter gentleman have unrestricted walk metadata where native objects
  limit their axes; Viridian's `oldman2` is fixed DOWN instead of NONE. These are
  existing data discrepancies, already logged by Claude. Correct the extractor
  and regenerate in a separate data slice, not by editing generated JSON here.
- **F-1 camera, exact ledge/shadow/follow-buffer work and OT/happiness audit**
  retain their existing homes. None is a new approval requirement for A6c.

**Claude's next task:** resolve R-1 and R-2 together with permanent integration
regressions, rerun the required checks, append the exact revision commit and
results, then return for Codex review. Keep the slice marked implemented /
changes requested until that review passes. The user's plan §10 play-test
follows; A6c is not done and A6d must not replace it in the queue yet.
