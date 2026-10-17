# A5b7e CP1 implementation plan: trace and text data only

**2026-10-15 · Codex/Sol · CP1 completed after the user's explicit go-ahead.**
Results and source trace: `notes/49-a5b7e-plan.md` §§4.9–4.10 and §10.
The plan below is retained as the execution contract. **CP2 has not started;
wait for the user's confirmation.**

Parent: `notes/49-a5b7e-plan.md`, approved under DECISIONS #58. The user asked
for a plan for the first checkpoint and explicitly requires sequential work:
**stop at the first endpoint and obtain confirmation before continuing.**
This note covers CP1 only. Approval of the parent slice does not authorize
running through CP2–CP5 without the user's checkpoint confirmations.

## 1. Endpoint

CP1 ends with:

- Measured source frame anchors recorded in note 49 §4.9.
- A source-backed follower integration answer recorded in note 49 §4.10,
  including any dependency that requires a decision before CP3.
- `NoPokemonText` and `_NoPokemonText` registered and extracted into the two
  existing text-program JSON mirrors.
- Verification results and a local checkpoint commit, with STATUS updated.
- A report to the user and an explicit stop before CP2.

No Bill's PC UI, storage behavior, shared text flag, medicine-name fix, stats
extraction, save refactor or follower implementation belongs in CP1. The trace
may describe later integration, but does not implement it.

## 2. Establish the starting point

1. Re-read STATUS's A5b7e handoff and note 49 §6 CP1; inspect the working tree
   before edits. Preserve any unrelated user changes.
2. Record the starting commit and baseline. The documented baseline is
   **1436/1436 with ROM; 1306 pass / 130 skip without ROM**.
3. Run strict typecheck and the ROM suite before changing extraction inputs.
   A pre-existing failure must be recorded separately from this checkpoint.

## 3. Trace the frame anchors

Read the relevant routines and their callees in `refs/pokeyellow/` without
editing or refreshing the reference clones:

- `engine/pokemon/bills_pc.asm`: generic entry, menu redraw, list/submenu,
  transfers, release, STATS return and exit.
- `engine/menus/{pc,save}.asm`: the preamble's return, ReloadMainMenu and
  Change Box, including its save-sound wait and save order.
- `home/{copy2,load_font,tilemap,list_menu,window}.asm`: tile-copy waits,
  Buffer1/Buffer2, list entry and actual HandleMenuInput reads.
- Relevant delay, palette, tile-reload and text routines reached by those calls.

Write a compact trace table into **note 49 §4.9**. For each anchor give the
source label, reference event at frame 0, elapsed frames, transfer state,
first input read and the operation reached on the return frame.

Cover all eight existing anchors: entry, branch/list opening, mon choice and
submenu, transfer result, release confirmation, Change Box, STATS return, exit.
Distinguish CPU writes from the BG transfer that makes them visible. Do not
add a frame merely for a TypeScript command dispatch or routine return.

Known source checks to re-derive during the trace:

- `CopyVideoData` costs `floor(tileCount / 8) + 1` frames, including its final
  short/zero block: 30 tiles cost 4 frames and one tile costs 1.
- BillsPCMenu has its explicit Delay3 before HandleMenuInput's own Delay3.
- Buffer copies have no explicit DelayFrame; transfer disabling does not by
  itself introduce a wait.
- STATS' existing pages remain the approved temporary screen. Separate their
  user-controlled duration from the source's fixed restoration/reload costs.
- Cry playback remains absent. Record the source cry boundary and the approved
  stub's zero playback duration; retain the following real sound wait.
- If an anchor depends on input, text speed, a pending sound or transfer phase,
  give the conditional formula and fixed offsets rather than inventing one
  universal total. Do not claim hardware measurements from a source trace.

## 4. Resolve the follower integration contract

Trace `ShouldPikachuSpawn`, `SpawnPikachu_`, `TrySpawnPikachu` and the spawn-state
setters against:

- `pikachu_follower.ts`: `shouldPikachuFollow`, visibility, image latch,
  `spawn`/`spawnAtState` and font-loaded updates.
- `overworld/{sprites,ui_entry,map_transitions}.ts`.
- `main.ts`'s follower visibility changes and `script_controller.ts`'s nurse
  spawn-state-5 handling and menu-session sprite callbacks.

Record the expected sequence in **note 49 §4.10** for depositing an out starter,
withdrawing a healthy starter and withdrawing a fainted starter. Include the
next source UpdateSprites call, map placement/facing, UI coverage, return to the
parent PC and eventual map close. Do not force a spawn at the menu selection
if the source waits for a later sprite update. Do not assume the nurse's state 5
is the correct state for a PC withdrawal.

Preliminary finding: both current sprite-update helpers gate on
`pikachuFollower.visible`; they cannot alone re-evaluate party membership and
respawn a hidden follower after withdrawal. Determine whether the existing
visibility/spawn calls suffice at the source update boundary. If additional
follower machinery is needed, document the exact gap and report it to the user
before CP3; no speculative follower code in CP1.

## 5. Add only the missing text data

Independently confirmed during planning against `origin/symbols:pokeyellow.sym`:

| Label | Bank:address | Root | Source |
|---|---|---|---|
| `NoPokemonText` | `$3a:$4e1f` | `true` | `engine/printer/printer.asm` |
| `_NoPokemonText` | `$28:$4c77` | `false` | `data/text/text_3.asm` |

1. Add the two rows to `game/src/rom/text_program_symbols.ts`, following the
   existing registry conventions. Leave the extractor and JSON schema intact.
2. Check the root's FAR target and the child's source string/terminator:
   `There are no` / `#MON here!` / `prompt`. Preserve normal decoder encoding.
3. Run `npm run setup pokeyellow.gbc` from `game/` twice. Hash and compare the
   complete generated trees after each run; use scratch outside the repository
   for manifests.
4. Relative to the starting commit, generated changes must be confined to
   `game/data/text_programs.json` and `game/static/text_programs.json`, with
   exactly the two new programs and all existing programs/pointer tables intact.
   PNGs, tilemaps and all other JSON must remain byte-identical.

## 6. Verification and handoff

Run the existing ROM text-program and static-export fixtures, then strict
typecheck and the full ROM/no-ROM suites. The existing source-parsed fixture
already compares every registered program to independent ASM expectations;
add a targeted assertion only if the new pair lacks meaningful coverage.
Do not change test counts or expectations simply to match regenerated data.

Run `git diff --check` and inspect the complete staged diff. This checkpoint
does not alter runtime wiring and needs no browser play-test or production
bundle rebuild. Record actual commands/results rather than inheriting baseline
claims.

Update note 49 with the CP1 result and STATUS with the trace/data result, any
follower dependency, verification and the precise stop point. Commit only the
checkpoint files locally, with the repository's co-author convention. Never push.

**Stop after CP1. Report its commit and verification to the user, and ask for
confirmation before CP2. Silence or the parent plan's approval is not that
confirmation.**
