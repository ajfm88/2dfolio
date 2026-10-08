# A6d review, plus A6c's R-3: approved, awaiting the user's play-test

2026-10-04 · Claude Opus 5.5. I reviewed Sol's (Codex) A6d implementation, `4166071` +
`7384386`, against `notes/12-a6d-plan.md` and the Yellow ASM (`refs/pokeyellow`
`e89ead15`). As the user asked (DECISIONS #38), this review also covers A6c's R-3 fix,
`9897020`.

**Verdict: no blocking findings. A6d and A6c are both ready for the user's combined
play-test** (`notes/10-a6c-plan.md` §10 + `notes/12-a6d-plan.md` §9). There are two
non-blocking notes and one carry-over.

## Checks I re-ran myself

| Check | Result |
|---|---|
| `npm run typecheck` | clean |
| `ROM_PATH=pokeyellow.gbc npm test` | **729/729**, 29 files (includes the static-not-stale check) |
| `npm test` (no ROM) | **657 pass / 72 skip** |
| `npm run build` | OK (311.94 kB, 89.25 kB gzip) |
| `git diff --check 530363c HEAD` | clean |
| Generated output | only `static/gfx/overworld/shadow.png` added; `data/` unchanged |
| **Ordinary-following regression hash** | Reproduced independently. I ran the same 30-step path on the pre-A6d follower (`530363c`, in a scratch worktree) and it hashes to exactly Sol's committed `3d29d4e5…`: **0 of 240 passes differ**. The pre-A6d `recordStepForPikachu` needs its callers' `justStartedStep` gate to be reproduced. The worktree was removed afterwards. |

## A6d against the plan

| Plan § | Implementation | Verdict |
|---|---|---|
| §4.1 extraction | `LEDGE_HOPPING_SHADOW` 06:6893, `decode1bpp(8 bytes, 1)` → `/gfx/overworld/shadow.png`; pixel test against both the expected rows and pret's PNG; 519 → 520 | ✓ |
| §4.2 flag | set on the armed pass; held through 16 moving passes, the landing pass and its hold; cleared by the continuation (`PlayerWalk.pass` start, `main.ts`, the script push / free move); `cancel()` clears it | ✓ |
| §4.3 drawing | after the player's grass overlay; two tiles, the second mirrored, at `(x − camX, y − camY + 8)`; the player's current frame (same flip) punched out at `−12 + hopOffset`; loaded in `Player.loadSprite()` | ✓ |
| §5 landing | `landingPending` → one `spriteUpdate` + `updateSprites`, no input, hold `3 − 2 = 1`. The controller test pins sprite updates at a+2 … a+32, **a+34**, **a+37**, a+39 and the map script at a+2 and a+37. Gates on map script, joypad, START, A and Pikachu-A | ✓ |
| §6.1 buffer | `pop` refused below 2 entries and returns entry 0; `newest` / `newestQueued`; `fast` = ≥ 3 remain after the pop (matches `AreThereAtLeastTwoSteps…`, size ≥ 2); a 16-entry cap with one warning | ✓ |
| §6.2 `Func_fcc08` | `startedFollowStep` on ordinary steps and on hop passes 1 and 9 (`progress === STEP_PX`); the literal bit-6 toggle, which survives refreshes; every caller switched | ✓ |
| §6.3 execution | facing from `commandFacing`; ±1 vector; a hop is 32 px at 4 px × 8, never fast, no arc; a walk is fast only on the buffer rule; the end facing from `newestQueued` | ✓ |
| §6.4–6.5 refresh | `refreshFollow` in `refresh()` and `fontLoadedUpdate`; `showPikachu` → `spawnAtState(…, 5)`; `movePikachu` end refreshes | ✓ |
| §6.6 stand-ins | separate `scriptTargets`, the arc only on scripted hops, the waits renamed; position buffer, pending hop and teleport deleted | ✓ |
| §8 tests | everything listed in §8 is present, including the user's report inverted, two ledges, sideways after landing, START after landing, the 200-step random walk (≤ 2 entries), and the pushed-hop landing | ✓ |

I also spot-checked these edge paths by reading the code:

- a follow move already running when a scripted path starts: it finishes first, and
  the script target then starts;
- the door-exit `forceStep`: it is recorded through the new gate;
- a debug warp mid-hop: `cancelMovement` clears every ledge state and the hold.

## A6c R-3 (`9897020`)

I checked it against the three items Codex required (`notes/11-a6c-review.md` → R-3):

1. **Bit 7 is served on every eligible update.** `updateSprite` and `fontLoadedUpdate`
   both check `onScreen` first, then `facePlayerPending`, as `SpawnPikachu_` does.
   Coverage only defers it. ✓
2. **Source order.** `openOverworldUi('pikachu_emotion')` runs the font-loaded update on
   the bare map first. That is `InitializePikachuTextID` → `wAutoTextBoxDrawingControl`
   = 1: no border, then `DisplayTextIDInit`'s `UpdateSprites`. The portrait is captured
   after that, and its covered update follows. On exit I confirmed nothing more is
   needed:
   - `DisplayTextIDInit` copies facings to `ORIGFACINGDIRECTION` **after** its
     `UpdateSprites` (`display_text_id_init.asm`), so `CloseTextDisplay`'s restore
     keeps Pikachu facing the player.
   - `CloseTextDisplay`'s own `UpdateSprites` corresponds to our next ordinary pass. ✓
3. **Tests.** The real `captureUi(renderPikachuEmotionBox)` from all four sides; a
   request deferred by coverage, then served on an ordinary pass; the countdown after
   the turn. ✓

**R-3 resolved.** One caveat: I wrote this fix (Codex's separate re-review was dropped
by the user), so this check isn't independent the way the earlier reviews were. The
ASM trace above is the evidence.

## Notes (non-blocking)

- **N-1: the nurse-walk end refreshes the follow buffer.** `script_controller.ts`, the
  `scriptPikachuMoving` completion. `PikachuWalksToNurseJoy` has no
  `RefreshPikachuFollow`, so this isn't in the ASM. It has no visible effect, because
  `hidePikachu` and then `showPikachu`'s spawn state 5 always follow and refresh again.
  Remove it or cite it when A6e ports the nurse walk.
- **N-2: when Pikachu reappears after a heal.** `spawnAtState` now hides the image until
  Pikachu's next update. Upstream showed it at once. In the ASM (`pokecenter.asm`)
  Pikachu stays hidden through "fighting fit" and becomes visible at the `UpdateSprites`
  after the nurse's 40-frame bow, just before the farewell. Both are approximations of a
  heal sequence that was never ported line by line. → **A6e**, with the nurse walk.
- **Carry-over to A1c.** Trainer sight still runs at pass 16's step end, before the
  landing pass. Once A1c sets `sightRange`, a trainer spotting a landing player would
  enter `trainer_approach` with the landing (and the shadow) pending. A1c's move of
  sight into the map-script hook, which runs after the landing, removes this. It is
  already recorded as A1c's job (DECISIONS #38).

## Next

The user's combined play-test: `notes/10-a6c-plan.md` §10 and `notes/12-a6d-plan.md` §9.
Then A6c and A6d can be marked done, and A6e planned.
