# Unit 21 — Island Decor

> **Status: COMPLETE, 2026-10-07.** The player placed the three palms, played
> them, and signed off ("zero bugs"). They explicitly approved closeout and
> visual sign-off after the independent review. Allocation profiling remains
> deferred to Unit 22. Work ends for today; Unit 22 waits until they ask.
>
> **Scheduling: numbered at the player's request, 2026-10-07.** Island Decor
> follows Unit 20 as Unit 21. PWA and Performance follows as Unit 22.

## Goal

A player can choose Decor, place three kinds of animated palm tree, test-play the
level, and return to the same trees and editing history. The ghost, maker and play
agree on position and layering. Saving, sharing and reopening preserve the trees.

## Why This Comes Next

The overview already promises animated palms and a Decor tab. Format 1, the codec,
placement tools, `DecorCommand`, erase-all and resize already carry decor. The
three complete tree animations are packed. The missing pieces are registration,
shared visuals and integration into the draw order.

PWA caching and the final performance pass should cover the visuals that v1 will
actually ship. Doing decor first avoids checking a final asset list and performance
baseline and then changing both. Ship interior props remain in Beyond v1.

## Accepted Product Decisions

The player requested implementation on 2026-10-07 and explicitly approved
closeout and visual sign-off after review that day. These are the accepted
decisions. See As Built for verification limits and deferred profiling.

| Decision | Accepted choice | Reason |
| --- | --- | --- |
| Schedule (set 2026-10-07) | Unit 21, before PWA (Unit 22) | Follows the existing spec sequence, as requested by the player |
| First roster | Regular, left-leaning and right-leaning background palms | All three packed clips are complete trees |
| Placement | Centre the frame horizontally; put its bottom on the cell bottom | The trunk ends at the frame bottom; a tree placed above a floor meets that floor |
| Layer | `Z.bgDecor`, behind actors and above terrain/platform art | Honour the existing architecture's numeric order |
| Collision | Decorative only | Terrain and platform cells continue to define collision |
| Theme switch | Keep the records and draw the same palms in either theme | Switching themes must not delete, hide or replace authored objects |
| Overlapping trees | Draw in cell order: row, then column, within the same `z` | Undo can reorder record arrays; overlap must still look the same |
| Animation | Animate placed trees in maker and play at the atlas's 10 FPS | One shared visual path; advance clocks only in fixed updates |

The ship's wall will still appear behind a palm if the author switches themes.
Theme-specific palette filtering or replacement would add product behaviour and is
outside this slice. The Decor tools should use descriptive labels, not imply that
the ship gained its own props.

## Measured Assets

Inspected the generated strips and measured alpha bounds on 2026-10-07 using
`sharp`. Each animation has four frames at 10 FPS.

| Kind id | Palette label | Atlas clip | Frame | Opaque bottom, every frame |
| --- | --- | --- | --- | --- |
| `palm_back` | Palm Tree | `palm/back` | 64 × 64 | y63 |
| `palm_back_left` | Palm Tree, Left | `palm/back-left` | 51 × 53 | y52 |
| `palm_back_right` | Palm Tree, Right | `palm/back-right` | 52 × 53 | y52 |

`palm/front` is **a 39 × 32 crown**, not a fourth complete tree. Its trunk pieces
live in the packed `tiles/island-platforms` sheet. Assembling a tree from those
pieces needs its own height, anchor and layering design; exclude it from this
first slice. Do not present a floating crown as a complete tree.

The Python reference gives some foreground palms collision blocks. Do not port
that behaviour: this slice's trees are non-interactive decor.

No asset build or dependency install is needed. Existing coverage remains
430 / 1195; using an already-packed clip does not raise the packing numerator.

## Delivery Order

Three separately verified increments. A is the existing rendering defect's scoped
fix; B adds the visuals; C verifies and finishes the maker-facing behaviour. Do not
combine the rendering change with the palette CSS change in one implementation
step. Every increment must leave the running application usable.

### A — Honour Draw Order (Issue 34)

Make the shared level renderer capable of interleaving world objects with its
tile passes, using the existing `Z` values:

`background → clouds → terrain/platform → background decor → actors → water and
reflections → foreground → effects`

- Split the existing tile drawing into terrain/platform and water passes; keep
  their tile selection, coordinates and theme rules unchanged.
- `drawLevel` owns the common pass sequence. Inject a synchronous callback for
  objects at a given `z`; it must not import game, maker or the palette.
- Create callbacks once when a world/scene is constructed or entered. Do not
  allocate callbacks, options objects or sorted arrays in `draw`.
- World draws objects according to their `z`. Preserve existing same-layer actor
  order: flag and entities in their current order, then the player. FX retain
  their order. Do not reorder the simulation's entity array.
- Maker uses the same passes for entity previews and markers. Its grid, cursor
  and placement ghost remain final editing overlays, so water cannot hide them.
- Stable numeric layer traversal fulfils the ordering requirement without a
  per-frame sort. Update the code standards' wording from "explicit z sort" to
  stable traversal by `z` when implementing this approved fix.
- Use all existing numeric layers. This corrects issue 34; it does not add a
  scene graph, change physics, or register any new objects in this increment.

**Visible consequence:** water now draws over `Z.main` actors, as the architecture
specifies. Check this explicitly in both themes; do not promise pixel identity
where water overlaps an actor. Ship water's surface treatment remains issue 35.

**Verify A:** all tests and build; six campaign tile/background comparisons at
fixed cameras; real gameplay with flag, treasure, a walker, a shot, water and FX;
maker previews and editing overlays. Existing terrain/platform pixels should
match. Record intentional water/actor differences before moving on.

### B — Shared Palms and Registration

Add a small shared decor visual module under `src/level/`, used by world and maker.

- Resolve kind ids through the palette in the consuming scene/world and inject
  the resolver. `level/` must not import `data/palette.js`, whose factories import
  gameplay classes.
- Palette entries use `group: 'decor'`, `placement: 'decor'`, `layer: null`,
  `z: Z.bgDecor`, and the clip ids above. A decor record remains `{ k, c, r }`.
  Do not send decor through gameplay entity spawning or collision.
- The shared visual owns animation clocks, draw bounds and the prepared decor
  list. Animation advances in `update(dt)`; drawing reads it without mutation.
- A pure helper writes the frame rectangle into a supplied scratch object:
  `x = c * TILE + (TILE - fw) / 2`, `y = (r + 1) * TILE - fh`, width `fw`, height
  `fh`. Round destination coordinates after subtracting the camera.
- Use that same geometry for placed trees and the ghost's frame-zero preview.
  Replace the old, unused vertically-centred decor preview convention. Existing
  entity/marker geometry is outside this change.
- Sort only a copied draw list, by `z`, row and column. Never sort `level.decor`.
  The order must survive undo restoring a record at a different array position.
- World prepares its list once on enter. Maker invalidates it on an actual edit
  and rebuilds it in update, including while a stroke is live. Undo/redo, resize
  and session restore also refresh it. A same-length kind replacement must not
  leave an old clip cached. Do not rely on array length or millisecond timestamps
  alone to detect changes. Render must not rebuild it.
- Cull against the full sprite rectangle. A tree whose anchor cell is outside the
  view can still have a visible crown. Reuse scratch bounds and prepared objects
  during idle frames; no per-frame sorting or allocation.
- A new world starts with fresh decor visual state. Pause, portrait hold and wipes
  stop advancement through the existing scene update rules. View animation phase
  does not enter level files or MakerSession.

**Verify B:** trees appear immediately during a drag, stand on a floor, sway in
both modes, sit behind actors, and keep the same position through test-play.
Exercise negative maker margins and all three zooms. Use the existing pinch path
for zoom verification; desktop zoom is still issue 24.

### C — Maker Limits, Reachability and Round Trip

The palette already reveals groups with registered entries, so Decor needs no
new menu architecture. Existing placement, replacement, eyedropper, right-click
erase and command-stack paths should work through the new entries.

Two existing assumptions need a scoped finish:

1. **Decor limit:** `findProblems` currently checks only the entity cap because
   decor could not be placed. Add `DECOR_MAX` and `too-many-decor`, with
   `Too much decoration: N of 2000.` after the entity-cap reason, before unknown
   kinds. The same toolbar Play gate and save-blocker path must handle this.
   At 2000, saving and play are allowed; at 2001, Play is disabled, saving cannot
   write an unloadable level, and Back explains that changes cannot be saved.
   Erase or undo must recover. Keep schema and codec format 1 unchanged.
2. **Category hit areas (issue 17):** the existing tabs are 28 px tall at scale 1.
   Adding Decor must not add another undersized control. Make the tab row's
   controls at least 44 × 44 CSS pixels and update `--palette-height` together.
   This costs 16 CSS px of clear canvas at scale 1; measure it deliberately.
   Keep horizontal tab scrolling, tool scrolling and safe areas. This is a
   separate CSS verification step, not an input redesign.

**Verify C:** mouse and synthesized touch placement, multi-cell stroke undo as one
step, replacement undo, erase-all with terrain and an entity in the same cell,
eyedropper, resize clipping and exact undo, autosave/reload, JSON export/import,
fresh-profile share import, and ten test-play round trips with camera/tool/history
restoration. Verify the eighth category is reachable at 844 × 390, 1000 × 360 and
1280 × 720. Portrait still shows the rotate prompt. Real-phone checks remain
deferred until Netlify deployment, as already decided.

## Planned File Scope

| Increment | Files |
| --- | --- |
| A | `src/level/render.js`, a small pure layer-order helper if needed, `src/game/world.js`, `src/maker/maker-scene.js` |
| B | New `src/level/decor.js` and its pure helpers/tests; `src/data/palette.js`; world, maker scene, `src/maker/grid-overlay.js` |
| C, limit | `src/maker/validate.js` and tests; maker scene only if needed for a specific cap message; decor command/tool regression tests |
| C, layout | `src/ui/styles/maker-palette.css`; palette module only if the existing markup demonstrably needs adjustment |
| Docs | Build plan, overview, architecture, UI context, code standards, tracker and issues, for the accepted decisions and actual changes |

Runtime changes to `src/core/`, storage, audio, physics, schema, codec, generated
assets, campaign JSON or reference material are outside this plan. Existing codec
tests may gain a decor round-trip case. Shared typedefs may gain the visual shape
if it is shared across files; they do not gain serialised fields.

Do not decorate/re-export the campaign during this unit. Verify on an editable
copy, so campaign content changes do not complicate the rendering comparison.

## Tests and Acceptance

Test pure contracts, rather than mocking Canvas pixels or DOM structure:

- Rectangles for all three frame sizes, negative coordinates and edge culling.
- Deterministic decor order despite reordered record arrays; source model untouched.
- Cap boundary at 2000/2001 and recovery through erase/undo.
- Decor replacement, mixed erase-all and resize undo; these inverse paths currently
  have less coverage than entity placement.
- Share/JSON round-trip preserving known decor ids and coordinates; unknown decor
  continues to receive the importer's existing readable rejection.

Actual animation, layering, cached-list refresh, UI and scene lifecycle are browser
checks. Use a throwaway muted Chrome profile and timed canvas presses of at least
50 ms. Keep the harness outside the repo, as with Unit 20.

- [x] All existing tests and relevant new pure regression tests pass.
- [x] `npm run build` passes; no added packages or generated asset changes.
- [x] Ghost, placed maker tree and play tree have identical anchored bounds.
- [x] No invisible collision, damage, pickup or terrain mutation from a palm.
- [x] Water, actors, decor and FX follow the documented numeric layers.
- [x] Live stroke, same-length replacement, undo/redo and resize show fresh visuals.
- [x] Save/share/reopen and repeated test-play preserve records and editing state.
- [x] All category controls meet 44 × 44, and all eight categories remain reachable.
- [x] Existing campaign data remains unchanged; both themes still play.
- [ ] **Deferred to Unit 22 (issue 39):** inspect idle maker/play allocation traces
      and the 2000-decor case, including distributed records and edit-time rebuilds; distinguish
      edit-time list rebuilds from idle per-frame work. Measure desktop costs, but
      reserve the under-16-ms phone claim for the final performance unit.
- [x] Player approves the tree anchoring, depth and reduced clear canvas by eye
      (explicit visual sign-off, 2026-10-07).

## Review Points and Closeout

The main review points are the three-tree roster, bottom anchoring,
palms persisting visibly across a theme switch, and the 16 px tab-row height cost.
The player accepted these choices in the explicit closeout on 2026-10-07.

Scheduling is recorded in the build plan. A/B/C verification is recorded below;
issues 34 and 17 were closed after their running-app checks. Unrelated open
issues remain in their own scope. The player approved this unit's closeout and
visual sign-off after review. Allocation profiling remains pending in Unit 22;
the unchecked item above records that limitation rather than claiming a trace.

## As Built (2026-10-07)

The Accepted Product Decisions are what shipped. The player requested
implementation the day this spec was numbered and explicitly approved closeout
and visual sign-off after the independent review. The unit is complete.

### What the code does

- `drawLevel` walks `Object.values(Z)` in ascending order and calls one callback,
  built once per world or maker scene, after that layer's own drawing. Terrain
  and platforms stay in the tile pass. Water cells and reflections are the water
  pass. A wall theme still skips clouds.
- Actors with `z === Z.main` draw in their old order: entities in array order,
  then the player. Effects draw only on `Z.fx`, in their old order. The maker
  draws decor, then entity previews, then the spawn and goal markers, in those
  same passes. The grid, cursor and ghost stay after `drawLevel`.
- `src/level/decor.js` resolves kinds through an injected function, so `level/`
  does not import the palette. Geometry is `x = c * TILE + (TILE - fw) / 2`,
  `y = (r + 1) * TILE - fh`. Destinations are rounded after the camera subtract.
  The ghost uses frame 0 of that same rectangle. Entity and marker geometry is
  unchanged.
- Clocks are per kind, advanced once per fixed update at the clip's 10 FPS, and
  they are not stored in the level or the maker session. The draw list is a
  reused copy, insertion-sorted by `z`, row, column. `level.decor` is never
  sorted. The maker rebuilds that copy at the end of an update after a decor
  edit, undo, redo or resize, and on enter. A theme switch does not.
- Palette labels are Palm Tree, Palm Tree, Left, and Palm Tree, Right. All three
  are `group: 'decor'`, `placement: 'decor'`, `z: Z.bgDecor`. `palm/front` is
  not registered.
- At 2001 decorations, `findProblems` reports `too-many-decor` with
  `Too much decoration: N of 2000.` Play disables, and Back says the level has
  more than 2000 decorations. 2000 is playable and saveable. Schema and codec
  stay format 1.
- Category tabs and the tab term of `--palette-height` are 44px instead of 28px
  at scale 1.

### Tests and build

`npm test`: 362 passed (29 files). That is the previous 338 plus 24: layer order,
decor geometry and clocks, the cap, decor undo/resize/erase, the share round
trip, and known-palm import. `npm run build` passes (Vite 8.2.2, no new
packages). `git diff` is empty for `src/data/campaign`, `public/assets`,
`src/data/atlas.json`, `package.json` and `package-lock.json`. The campaign was
not decorated.

### Running app

Muted headless Chrome on `http://127.0.0.1:5174/`, presses held at least 50ms.
The harness lived outside the repo and was deleted after these notes.

**A.** On Palm Tree Island, the centre of a water cell matched the centre of a
crabby standing in the next water cell (`146,169,206`), and a crabby on dry
ground did not (`222,153,112`). The same water-over-actor match held after
switching to Pirate Ship. The ship wall differed from the island sky, and a
floor palm differed from that wall. Castaway Beach still boots (5 hearts, a sky
pixel at the canvas centre). Six campaign tiles were not re-hashed against a
pre-change checkout. The comparison rests on the empty campaign diff and on
terrain drawing staying in the same pass.

**B.** A floor palm, including one whose sprite starts in the negative margin,
differed from the sky. The crown of one palm produced 4 distinct pixel hashes
across 49 frames in 800ms. A ghost on an empty cell differed from the sky; an
80ms press then painted a solid tree at that same sample. Play draws through the
same rectangle helper. The running play scene was not pixel-overlaid on the maker. Replacing a placed
Palm Tree with Palm Tree, Left changed the sprite hash, and undo restored the
previous count's playable state. Grid pitch on the canvas, median gap, was 64
bitmap px at 1×, 127 at 2× and 32 at 0.5× (pixel scale 2). Those zooms came from
the existing pinch path. Desktop zoom is still issue 24.

**C.** Placing the 2001st palm disabled Play with `Too much decoration: 2001 of
2000.` Back's dialog included "more than 2000 decorations". Undo re-enabled
Play. Shrinking the level from 48 to 40 columns removed the palm at column 45;
the shared code decoded with none left at that column. Clearing storage and
importing the code brought the level card back. Ten `M` round trips returned to
the maker with the Decor tab still selected and Play enabled. All eight tabs
were reachable: 44px tall at 844×390 and 1000×360 (palette height 118), 88px
tall at 1280×720 (palette height 236). Portrait 390×844 showed "Turn your
device".

A walk of about 950ms at 100 px/s toward a floor palm left 5 hearts and 0 coins.
Decor is not spawned and is not a physics layer. The player's world position was
not read back from the running app. Redo was covered by the command tests; the
browser run pressed Undo.

### Cost

With 2000 palms, almost all stacked on one cell, 60 maker frames in headless
desktop Chrome averaged about 17.5ms. Campaign play, which has no decor,
averaged about 16.5ms over 90 frames. Idle frames did not call `Array.sort`
(the decor list is insertion-sorted only when it is rebuilt). The heap did not
climb across that maker sample. This is not a phone measurement, and it is not
a claim that a full phone stays under 16ms.

No browser allocation trace was recorded. The independent review additionally
measured edit-time sync of 2000 distinct records in Node on this desktop: median
about 0.11ms in ascending cell order and 4.1ms in descending order. Those are
neither browser allocation profiles nor phone measurements. The allocation-trace
checkbox is corrected to unchecked; idle maker/play traces and a distributed
2000-decoration rebuild case remain in issue 39 for Unit 22's profiling pass.

### Independent review

362 tests and the production build passed. An outside-repo Node harness checked
144 baseline/current background and tile drawing-command comparisons across all
six campaigns and both themes, maker/play/ghost bounds, actual layer order, live
painting, replacement, toolbar undo/redo, resize undo/redo, theme switching,
sharing, ten test-play session returns and the 2000/2001 boundary. Decorated and
undecorated worlds matched player positions, outcomes, stats and terrain over
600 fixed steps per theme. No functional regression was found. These checks
exercise scene code and drawing commands; they do not replace browser pixel or
DOM checks. A separate Chrome launch was blocked by automatic approval review.

### Closeout (2026-10-07)

The player placed and played all three palms, signed off ("zero bugs"), and
then explicitly approved the review's closeout and visual sign-off: "i approve
the closeout the visual sign off too". The anchoring, depth and taller category
tabs are accepted. Unit 21 is complete. Issue 38 is corrected; issue 39 remains
open for the unperformed allocation profiling in Unit 22. The player ended
today's session after the context updates; Unit 22 has not started.

### Left open

Unrelated open issues: 4–6, 8, 9, 21, 24, 25, 27, 28, 31, 33, 35 and 36.
Issues 17, 34 and 38 are resolved. Issue 39 stays open for allocation profiling
in Unit 22; real-phone checks wait for Netlify deployment. Ship props stay Beyond v1.
