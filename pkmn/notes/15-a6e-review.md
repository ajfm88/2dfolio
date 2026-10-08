# A6e review — re-review passed, awaiting play-test

Initial review, 2026-10-05 · Codex. Reviewed Claude Opus 5.5's A6e implementation through
`f013fd1` against `notes/14-a6e-plan.md`, DECISIONS #39, and pinned Yellow source
`refs/pokeyellow` `e89ead15`. The initial review requested the changes below;
the re-review verdict is at the end of this document.

## Findings

### R-1 [P2] Save Pikachu's facing even when its image is hidden

`game/src/script/script_controller.ts:679-685` saves the facing only when
`pikachuFollower.visible` is true. A fainted starter is hidden at the start of
nurse dialogue, but its sprite slot still has a facing. Yellow's
`DisplayTextIDInit` copies the facing of **every** non-player slot without a
visibility check, and `CloseTextDisplay` restores every slot
(`engine/menus/display_text_id_init.asm`, `home/text_script.asm`). Healing then
spawns Pikachu at state 5 facing down. With the save suppressed, the farewell
leaves it facing down instead of its pre-dialogue direction. This contradicts
the implementation handoff's stated facing restoration for fainted Pikachu.

I reproduced this with the actual `buildNurseScript` yes branch: a hidden,
fainted starter with an up-facing slot was healed and spawned at `(128,112)`;
its final facing was **down**, expected **up**. A smaller script exercising
save → heal → show → update → restore has the same result. Save the follower's
slot facing independently of image visibility, and restore it after the nurse
dialogue closes. Cover a fainted starter that was facing up, left or right;
include the subsequent ordinary sprite update that redraws the image.

### R-2 [P2] Apply native byte arithmetic to screen and map coordinates

`game/src/pikachu/pikachu_movement.ts:229-230,257-261,277-278` holds movement
base and output in unbounded world pixels and increments map steps without byte
wrap. The module comment says no program moves more than three steps, but
`notes/14-a6e-plan.md` §4 explicitly requires byte screen/map state for all 63
records; parameterized commands can run up to 32 iterations at up to four
pixels each. Yellow's `UpdatePikachuPosition` uses `add` into one-byte
`wPikaSpriteX/Y`, and `ApplyPikachuStepVector` also writes byte fields
(`engine/pikachu/pikachu_movement.asm`).

Focused reproduction with camera X = 0: a three-update rightward command
starting at screen X = 250 should visit 254, 2, then **6**; the runner ends
at **262**. The discrepancy is in the supposedly complete interpreter even
though current mapped callers normally stay away from the screen-byte edge.
Represent the script's state in screen-byte coordinates relative to the fixed
camera, wrap each native byte write, and convert to world coordinates only at
the follower boundary; wrapping world pixels would break camera positioning.
Add a boundary regression for pixels, the base-plus-offset write, and map-step
overflow, including a variable-length opcode.

## Verification and coverage

| Check | Result |
|---|---|
| `npm test` with `ROM_PATH=pokeyellow.gbc` | **767/767**, 30 files |
| `npm test` without `ROM_PATH` | **693 pass / 74 skip** |
| `npm run build` | TypeScript and Vite pass; 320.58 kB, 92.37 kB gzip |
| `npm run setup pokeyellow.gbc` | 165 JSON, 520 PNG, 3 tilemaps; tracked tree unchanged |
| Focused review fixtures (temporary, removed afterward) | **3/3 failed as expected**: two nurse-facing fixtures, one pixel-wrap fixture |
| A6d ordinary follow trace | Existing 240-sample hash test passes unchanged |
| `git diff --check f4ae41a HEAD` | **Fails** on a new blank EOF line in `game/src/overworld/ui_entry.test.ts:282` |

The extracted 63-record command table, ten named programs, pointer addresses
and sine data match the ROM checks; only the new movement JSON and its static
mirror are generated changes. The handoff's correction of Viridian's address to
`3c:5a0a` is supported by its caller's operand. The nurse's healthy-Pikachu
placement correction is also supported: spawn state 5 applies to a starter
that was not out. Script and emotion integration, timing, the existing A6d
regressions and the bounded nurse branches are covered by the passing suite.

**N-1 (non-blocking):** the new sprite-priority renderer path is only checked
through mocks. Add one pixel or canvas-spy case covering its opaque cutout,
mirrored frame and priority order while revising the movement edge. There was
no browser play-test in this review. The user-facing checklist is still
`notes/14-a6e-plan.md` §9 after R-1/R-2 are resolved. Clean the EOF whitespace
before the next handoff.

## Re-review — 2026-10-05, `128d7f8`

**Verdict: R-1 and R-2 resolved; no blocking findings in the revision.** A6e is
ready for the user's `notes/14-a6e-plan.md` §9 play-test. It remains open until
that check is complete.

- **R-1 resolved.** `script_controller.ts` now saves the follower slot's facing
  regardless of visibility and restores it at the nurse's farewell. The actual
  nurse yes branch is tested with a fainted starter facing up, left and right;
  each spawns above the player, recovers its saved facing, and redraws in that
  direction on the next ordinary sprite update. This follows the unconditional
  slot copy/restore in `DisplayTextIDInit` and `CloseTextDisplay`.
- **R-2 resolved.** The runner wraps `wPikaSpriteX/Y`, the base-plus-offset
  output and MAPX/MAPY at each native byte write. The follower converts between
  its world coordinates and screen bytes using the stationary player's
  `$40/$3c` anchor and the map's +4 border. A variable-length move reproduces
  250 → 254 → 2 → 6; tests also cover a negative jump offset, map overflow in
  both directions, and the follower's world-coordinate boundary. These agree
  with `UpdatePikachuPosition` and `ApplyPikachuStepVector` in Yellow's ASM.
- **N-1 addressed.** A canvas spy checks the mirrored shadow, cutouts of two
  overlapping sprite frames including a flipped one, and the scene's normal
  and swapped draw order. The earlier EOF whitespace is gone.

Independent checks: `npm test` with `ROM_PATH=pokeyellow.gbc` **776/776** in
31 files; without it **702 pass / 74 skip**; `npm run build` passes TypeScript
and Vite; `git diff --check 0c51262 HEAD` is clean. The ordinary-following
hash regression still passes. No browser play-test was run in this re-review.
