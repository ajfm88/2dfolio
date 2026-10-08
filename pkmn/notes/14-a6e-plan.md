# A6e — Pikachu's scripted movement per Yellow

**2026-10-04 · planned by Codex (Sol). Planning only; implementation not started.**

Start from **`7a5bf7f`**. A6a–d are reviewed and user-verified. A6e is the
fifth and final A6 slice (DECISIONS #38); A1a follows it. The user chooses the
implementer after reading this plan. The recommendations in §11 are proposed,
not new settled decisions.

## 1. Outcome and boundary

Port **all 63 records of `ApplyPikachuMovementData`**, with its two-frame
execution loop, direction/image rules, integer sine jumps and shadow. Route
the four consumers on today's maps through it:

1. Viridian's old-man step-aside.
2. The walk/hop to Nurse Joy, including Pikachu's hide/return call sequence.
3. The missing Pikachu step in Oak's **parcel-return/Pokédex** scene.
4. The movement commands before ordinary Pikachu emotion portraits.

Remove the scripted target queue and its `Math.sin` arc. Normal following,
its retained command buffer and flat ledge hops remain the A6d implementation.
Pikachu moves only on the interpreter's updates; the player, NPCs, map scripts,
encounter checks and idle routines stay frozen during a call.

This is a native TypeScript source port. The browser consumes committed JSON
and the existing sprite/shadow PNGs. No runtime ROM, ASM execution, emulator,
new map or debug feature is involved.

**Bounded emotion work:** execute the five ordinary emotion preludes that
contain movement, with the portrait opening after the movement. Keep the
existing portrait animation and selection behavior. The complete emotion
command interpreter, PCM playback, bubbles and map-specific reactions remain
separate work (§10). Their missing durations must not be presented as exact
end-to-end emotion timing.

**Bounded nurse work:** port the outer routine's Pikachu handoffs and the waits
that surround them. Keep the healing-machine animation's present internals;
its audio synchronization and palette/OAM audit have separate homes (§10).
The total heal duration therefore remains outside A6e's exactness claim.

## 2. Source and current implementation

Read alongside this plan; symbol names are the stable anchors. References are
the local `refs/pokeyellow` master **`e89ead15`**, read-only.

| Source | What it establishes |
|---|---|
| `engine/pikachu/pikachu_movement.asm` | Entire interpreter, 63-record database, two function tables, two timers, sine multiplication, slot swap and shadow |
| `engine/events/try_pikachu_movement.asm` | Starter/walking/relative-side guard; shadow load; **refresh after return** |
| `home/pikachu.asm` | Apply wrapper, drawing/following flags and script-byte reads |
| `scripts/ViridianCity.asm`, `scripts/ViridianCity_2.asm` | Step-aside placement and byte program |
| `scripts/OaksLab.asm:OaksLabRivalArrivesAtOaksRequestScript`, `scripts/OaksLab_2.asm` | Missing movement after “GRAMPS!”, before rival placement/show/movement; two guarded variants |
| `engine/pikachu/pikachu_emotions.asm:PikachuWalksToNurseJoy` | Nurse selection by map coordinates, three programs, no completion refresh |
| `engine/events/pokecenter.asm:DisplayPokemonCenterDialogue_` | Nurse eligibility, waits, hide/enable, state 5 and explicit sprite updates |
| `home/map_objects.asm:Func_6ebb / SpriteFunc_34a1` | Six-frame facing delay followed by a direct IMAGEINDEX write |
| `engine/overworld/healing_machine.asm` | Machine returns through UpdateSprites while Pikachu's drawing is disabled |
| `engine/pikachu/pikachu_follow.asm` | Spawn, image latch, font-loaded updates and follow refresh |
| `data/pikachu/pikachu_emotions.asm`, `engine/pikachu/pikachu_emotions.asm` | Ordinary emotion movements and their ordering relative to sound/bubbles/portrait |
| `engine/pikachu/pikachu_pic_animation.asm:PlacePikapicTextBoxBorder` | Border → Delay3 → UpdateSprites → Delay3, after the prelude |
| `engine/gfx/sprite_oam.asm`, `data/sprites/facings.asm` | Swapped sprite priority, IMAGEINDEX decoding and mirrored walking frames |
| `audio/pikachu_pcm.asm`, `engine/overworld/emotion_bubbles.asm` | PCM blocks; bubbles consume 60 + 1 frames and call UpdateSprites. Deferred, not silently treated as exact no-ops |
| `notes/12-a6d-plan.md` §10, `notes/13-a6d-review.md` N-1/N-2 | A6e scope and the two nurse follow-ups; N-2's precise timing needs the correction in §7 |

Current ownership:

- `pikachu/pikachu_follower.ts`: native follow/idle plus separate `scriptTargets`,
  `pushScriptTarget`, `update()` and a floating-point scripted arc.
- `script/script_controller.ts`: `scriptPikachuPath`, `scriptPikachuMoving`,
  path-by-path stand-ins, an extra nurse completion refresh, eager state-5 spawn.
- `story/viridian_city.ts`: tests the side when building the command list,
  then emits a path and a final facing. Guarding must occur when it executes.
- `story/oaks_lab.ts`: no Pikachu movement before the arriving rival.
- `overworld/overworld_controller.ts:buildNurseScript`: approximate outer heal
  sequence; missing explicit sprite updates and several incorrect waits.
- `pikachu/pikachu_emotion.ts`, `main.ts`, `overworld/ui_entry.ts`: portrait
  starts at once; the bare-map turn and covered update happen in one opening.
  The emotion render branch also omits ordinary grass/shadow composition.

## 3. Data: one additive extraction, no new images

Recommend **`pikachu_movement.json`**, containing typed command records, the
32 little-endian sine words, and ten named byte programs. Declare the schema in
new `src/rom/extractors/pikachu_movement.ts`; use type-only imports or an
independent shared type at runtime. Load the committed file before gameplay,
alongside existing data loading. No synchronous fetch on interaction.

Proposed additive contract (define it in the extractor before consumers):

```ts
interface PikachuMovementRecord {
  func1: number;
  param1: number;
  func2: number;
  param2: number;
}

type PikachuMovementProgramId =
  | 'viridianStepAside' | 'oaksLab1' | 'oaksLab2'
  | 'nurse1' | 'nurse2' | 'nurse3'
  | 'emotion_fd218' | 'emotion_fd21e' | 'emotion_fd224' | 'emotion_fd230';

interface PikachuMovementData {
  commands: PikachuMovementRecord[]; // index is opcode; exactly 63 records
  sine: number[]; // 32 unsigned 16-bit words
  programs: Record<PikachuMovementProgramId, number[]>;
}
```

Validate function ranges, byte/word ranges, record count and program termination
at extraction/load boundaries. Runtime types import no ROM-reading code.

The development-only ROM probe for this plan found:

| Data | Bank:address | File offset | Bytes |
|---|---|---|---|
| `PikachuMovementDatabase` | `3f:53b0` | `fd3b0` | 63 × 4 = 252 |
| `SineWave_3f` | `3f:5938` | `fd938` | 32 × 2 = 64 |
| `ViridianCityPikachuMovementData` | `3c:5e2b` | `f1e2b` | `00 1d 1f 38 3f` |
| `OaksLabPikachuMovementData1` | `3c:5bf9` | `f1bf9` | `00 1f 1e 38 3f` |
| `OaksLabPikachuMovementData2` | `3c:5bfe` | `f1bfe` | `00 1d 20 36 3f` |
| Nurse `.PikaMovementData1` | `3f:5294` | `fd294` | `00 36 2b 34 3f` |
| Nurse `.PikaMovementData2` | `3f:5299` | `fd299` | `00 36 34 3f` |
| Nurse `.PikaMovementData3` | `3f:529d` | `fd29d` | `00 36 33 3f` |
| `PikachuMovementData_fd218` | `3f:5218` | `fd218` | `00 39 01 3e 1e 3f` |
| `PikachuMovementData_fd21e` | `3f:521e` | `fd21e` | `00 39 00 3e 1e 3f` |
| `PikachuMovementData_fd224` | `3f:5224` | `fd224` | `00 3c 07 2f 3c 07 2f 3f` |
| `PikachuMovementData_fd230` | `3f:5230` | `fd230` | `00 3c 0f 1f 3c 0f 1f 3f` |

The database was parsed independently from the ASM and matches the ROM at
`fd3b0` uniquely. The Viridian bytes occur at three offsets: do **not** pick
the first pattern match; `f1e2b` is its caller/data pair. Other identical bytes
belong to later maps. Commit named offsets and explicit lengths, not a ROM
pattern scanner. Validate complete programs with the database decoder;
immediate `$3f` is legal data, not necessarily termination.

Wire the same extractor into `src/rom/index.ts` and
`scripts/extract_dev_data.ts`, which still have separate JSON output paths.
Run setup; only `data/pikachu_movement.json` and its `static/` mirror may change
in generated output. Expect **165 JSON per tree, 520 PNG, 3 tilemaps**.
Run setup twice to establish byte-identical output.

The shadow at **`3f:583d`** is byte-identical to A6d's **`06:6893`**:
`07 1f 3f 7f 7f 3f 1f 07`. Reuse `/gfx/overworld/shadow.png`; a second PNG
or an image-generation step would duplicate the same asset.

Ordinary emotion-to-program bindings can be a small source-annotated TypeScript
table (§8). Do not extract additional maps, emotion graphics, sounds or unused
programs merely because the full interpreter can execute them.

## 4. Pure interpreter and native state

Create `pikachu/pikachu_movement.ts`, separate from `PikachuFollowBuffer`,
`PikachuIdle` and `WalkAnim`'s normal cadence. Port both function dispatches,
not just the opcodes used by the ten current programs. A small pure runner
with typed state and immutable draw snapshots makes the native behavior
testable without Canvas or `main.ts`.

The runner owns `start(program, spriteState)`, `tickFrame()`, completion and
`cancel()`; its frame result exposes the latched sprite/shadow state and whether
the blocking call returned. The follower adapter owns snapshot/commit and
temporary slot priority. The caller owns guards, UI phases and any follow
refresh. Keep these responsibilities separate so a direct emotion/nurse call
cannot accidentally inherit the TryApply wrapper's refresh.

State must distinguish:

- Native map X/Y, live facing and movement status.
- Native screen/base X/Y, jump/movement offsets and grass priority.
- Raw IMAGEINDEX (including `$ff`), animation frame and intra-frame counter.
- Program cursor, decoded functions/parameters, timer/subtimer, command flags,
  per-command temporary state (`wd451`) and saved grass priority.
- The two-frame hold, return-frame hold, active sprite slot and draw snapshot.

Use byte arithmetic where the ASM does: screen/map coordinates and counters
wrap at 256; multiplication wraps at 65536 before taking its high byte.
Represent byte screen coordinates relative to the fixed camera, then convert
for browser drawing. Do not wrap world pixels or confuse the renderer's `−4`
sprite Y adjustment with a jump offset. Pikachu's native map coordinates
include the engine's +4 border; convert at the boundary.

### 4.1 Map position and screen position are independent

`mapStepX/Y` currently derive from rounded screen/target pixels. That cannot
represent this interpreter. Give the follower explicit native map-coordinate
storage, maintained through spawn, ordinary follow, font-loaded placement and
script commit. Ordinary follow changes map position at move start; the
interpreter's absolute step functions change it **at command completion**.
Relative functions never change it. A later native InitializeSpriteScreenPosition
may reconcile pixels with map coordinates; returning from the interpreter does
not do so automatically.

Do not finish an existing follow move or erase all idle/animation state on
interpreter entry. Yellow swaps the live sprite structs and begins immediately.
Snapshot the actual current pixels/image/counters and native map position,
including an interrupted move's already-advanced map coordinate. On return,
write the mutated fields back and preserve fields the interpreter did not
touch. Preserve the follow queue and hop-half toggle unless the **caller**
refreshes. A stale TypeScript interpolation must not advance underneath the
runner or resume from an incompatible start/target after it returns; reconstruct
normal follow state from the preserved native status at the next real update.

### 4.2 Decoder and cadence

Each database entry is `[func1, param1, func2, param2]`. Only parameter values
of **`$80`** consume an immediate byte, in order. `$3f` terminates only when
read as an opcode. Invalid/truncated committed programs should fail validation
with a useful error, rather than inventing motion or hanging.

Do not implicitly execute init on `start()`: `$00` is a real command, not an
automatic preamble. Programs without it retain the interpreter's native work
state from earlier calls. Preserve that work state across calls; unit-test a
no-init program (the source's unused `fd22c` is a useful fixture) without adding
it to the ten extracted current programs.

At each command start, clear movement flags, timer and subtimer; save grass
priority. Execute func1, then func2, write image and coordinates, decide shadow,
and hold the result for **two frames**. Check completion **after that hold**,
then restore the command's saved grass priority. The next command begins with
no extra pass, idle tick or scheduler gap. Even init/look commands cost two
frames. The sentinel swaps slots back and consumes **one final DelayFrame**
before returning to the caller.

Use an interpreter-owned frame countdown. Its two-frame pair starts at the
actual call, independent of `PassClock` parity. Both the story controller and
emotion state tick it every game frame, before the ordinary `!isPass` movement
gate. Suspend the outer overworld pass clock during this blocking routine;
resume the caller/outer loop explicitly without consuming hidden passes.
Do not add a two-frame wait at each command boundary or an extra frame when a
completion callback runs. Name tests in elapsed-frame terms: first operation
at t=0, init holds through t=2, and a 37-frame program returns at t=37.

Audio and the global game ticker continue during movement DelayFrames. Input
cannot skip movement, open START or trigger interaction. Neither story waits
nor portrait duration accrue concurrently with the runner.

### 4.3 Opcode families

| Opcodes | Func1 behavior | Func2 behavior / important rule |
|---|---|---|
| `00` | Capture current pixels, clear offsets, complete | Reset animation counters and draw live facing |
| `01..08` | Relative cardinal/diagonal vectors from live facing, immediate timer/speed | Animated previous image direction |
| `09..10` | Same relative vectors | Frozen previous image direction |
| `11..18` | Same relative vectors | Image-only CW/CCW turn; immediate param2 |
| `19..1c` | Relative cardinal vectors | Previous-image jump; immediate param2 |
| `1d..24` | Absolute cardinal/diagonal step; 8 updates × 2px per axis | Animated live facing; **16 frames** |
| `25..2c` | Absolute slide; 16 updates × 1px per axis | Animated live facing; **32 frames** |
| `2d..34` | Absolute hop; 16 updates × 1px per axis | Live-facing sine jump, amplitude 8, phase stride 2; **32 frames** |
| `35..38` | Set live facing, complete immediately | **Copy previous image direction**, not new facing; **2 frames** |
| `39 / 3a` | Delay `(param1 & 31) + 1` updates | Turn IMAGEINDEX CW / CCW |
| `3b` | Same delay | Param2 selects image-only turn direction/rate |
| `3c` | Same delay | Previous-image sine jump, with shadow on nonzero offset |
| `3d` | Same delay | Live-facing fixed-image sine jump; **does not set shadow bit 6** |
| `3e` | Same delay | Frozen previous image direction |
| `3f` | Return | One final frame; not a database record |

Func1's timer limit is `(param1 & 31) + 1`; speed is
`((param1 >> 5) & 3) + 1`. Relative functions use the live facing, independent
of an image-only spin, and update base pixels without changing map position.
Absolute cardinal functions also set live facing; absolute diagonals preserve
it. At the last update of an absolute command, apply one native map step per
axis, even when its parameters produce a different pixel displacement.

Use the ASM's explicit relative-direction tables. Forward-left when facing
down is down-right; back-left when facing left is down-right. Naming alone is
not a safe guide to their screen-coordinate convention.

### 4.4 Animation bug and sine arithmetic

`PikaMovementFunc2_UpdateSpriteImageIdx` points HL at the animation counter,
then calls `CheckPikachuStepTimer2`, which **does not preserve HL**. The later
increment/read use the **subtimer**. Preserve this bug deliberately. For
param2=0, the first sixteen image-frame values are:

`0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 0`.

Do not substitute normal happiness-dependent Pikachu animation. Jump functions
7/8 use the separate animation timer: intra counter wraps every four updates,
then the animation frame advances modulo four. Function 9 leaves the image
fixed. Spin functions change drawn direction, not live facing.

The ROM sine words are:

`0,25,50,74,98,121,142,162,181,198,213,226,237,245,251,255,256,255,251,245,237,226,213,198,181,162,142,121,98,74,50,25`.

For a jump, amplitude is `(param2 & 15) + 1`; phase increment is
`1 << ((param2 >> 4) & 7)`. Advance the byte subtimer, add `$20`, mask the
angle to 63, multiply the indexed word by amplitude modulo 65536, take the
high byte, and negate in the negative half-cycle. These independently probed
offset traces are golden fixtures, one value per two-frame update:

| Param2 | Y offsets |
|---|---|
| `17` — nurse hop | `−1,−3,−4,−5,−6,−7,−7,−8,−7,−7,−6,−5,−4,−3,−1,0` |
| `2f` — emotion 7 | `−6,−11,−14,−16,−14,−11,−6,0` |
| `1f` — emotion 4 | `−3,−6,−8,−11,−13,−14,−15,−16,−15,−14,−13,−11,−8,−6,−3,0` |

The nurse's diagonal slide and hop advance **each axis** by one pixel; do not
normalize a diagonal vector or reuse the player's ledge jump table.

## 5. Sprite swap and shadow composition

Yellow swaps the player's and Pikachu's two 16-byte state structs. During the
call Pikachu occupies **slot 0**, and the stationary player occupies **slot 15**.
Do not swap the actual TypeScript Player or the camera: implement the state
ownership and temporary sprite drawing priority explicitly. At sprite-pixel
overlaps, active Pikachu precedes NPCs, and NPCs precede the player; restore
ordinary ordering during the sentinel's final frame. Verify tile-level priority
where sprite pixels also have BG/grass priority.

Draw the shadow's two mirrored 8×8 tiles at the **base** coordinate:
`(baseWorldX − camX, baseWorldY − camY + 8)`. The jump moves Pikachu's image;
the shadow does not follow its Y arc. Its native OAM anchor is base Y + 12
before the common sprite Y correction.

Shadow bit 6 is requested only by functions 7/8 when sine Y is nonzero.
`AnimatePikachuShadow` consumes the bit every iteration and controls the
reserved-OAM flag. A zero-offset iteration clears the visible shadow, including
the final hop update. While shadow is requested, Pikachu's grass priority is
zero; command completion restores the saved byte.

A6d's player-shadow helper masks only player pixels because its normal hop
cannot overlap another sprite. Scripted movement bypasses collisions and may
overlap any sprite. Extend/reuse the shadow composition machinery with opaque
pixel masks for **all available sprite images**, including pixels grass hides.
The shadow sits above the map/grass and below every sprite's opaque pixels.
Do not simply draw it last over Pikachu/NPCs, or mask with bounding rectangles.
Keep A6d's established player shadow geometry and output unchanged.

Unify the overworld scene composition used by story and emotion states enough
to use the same sprite, grass and shadow rules. Rendering must consume latched
state and never advance movement, timers, image visibility or UI entry.
Avoid building a general hardware OAM emulator for this slice.

Reset/cancel (new game, debug warp, script replacement, emotion clear) must
release the runner, slot override, shadow and frame holds. This is application
cleanup, not a new in-game abort button. Native successful returns preserve
the final state instead of unconditionally resetting it.

## 6. Guarded map callers

Expose a typed native movement request in `script/types.ts`, naming a program
and caller policy. Replace `movePikachu {path, face}` rather than retaining two
implementations. A pure shared guard models `TryApplyPikachuMovementData`:

- Starter spawn flag set and walking mode zero. Use the existing starter model;
  do not replace it with “any Pikachu in the party” or drawn IMAGEINDEX visibility.
- Relative side from **native map coordinates**, Y first: above/below take
  precedence over X; only same Y compares left/right; overlap returns `$ff`.
- Compare with the caller's expected side. There is **no adjacency-distance
  restriction** and no test of Pikachu's live facing.
- On a successful call only, load/use the shadow and refresh following **after
  the return frame**. A guard failure takes no interpreter frames and refreshes
  nothing. Do not skip movement solely because an earlier UI hid its image.

| Caller | Execution-time condition | Program | Displacement | Duration |
|---|---|---|---|---|
| Viridian step-aside | Existing off-x=19 story branch, expected side RIGHT | `viridianStepAside` | Down 16px, left 16px, live facing right | **37 frames** |
| Lab parcel return, player Y≠3 | Expected side DOWN | `oaksLab1` | Left 16px, up 16px, live facing right | **37** |
| Lab parcel return, player Y=3 | Expected side LEFT | `oaksLab2` | Down 16px, right 16px, live facing up | **37** |

The durations include init 2 + step 16 + step 16 + look 2 + return 1.
The look command's image direction is still the previous image direction;
the next normal sprite update determines when the new live facing is drawn.
Do not add an eager `follower.direction = finalFacing` redraw at completion.

Viridian must emit its guarded request in the off-x=19 branch even if Pikachu's
side was different when the script was built. The intervening text and demo
can change the relevant state. Test execution-time guard changes and the
original straight-down old-man path when player X=19.

Insert the lab request **after `LAB_RIVAL_GRAMPS` text and before the callback
that places the rival, `unhideNpc` and its walk**. Select the variant using the
player's current map Y when the request runs. Do not fix the existing rival X
avoidance, entrance/exit paths or unrelated lab dialogue in this slice (§10).

## 7. Nurse approach and return

### 7.1 Approach

At the native position after Yes/No: run the explicit UpdateSprites, apply the
starter-alive/following eligibility check, clear the box/map view, **Delay3**,
then the font-loaded UpdateSprites that resets placement/antics. Only then
choose the program by native map coordinates:

| Pikachu relative to player | Program | Duration | Movement |
|---|---|---|---|
| Above, regardless of X | None | No interpreter call | Remains there |
| Below, regardless of X | `nurse1` | **69 frames** | Look up; slide up-left 32f; hop up-right 32f |
| Same Y, X≤player X, including overlap | `nurse2` | **37 frames** | Look up; hop up-right 32f |
| Same Y, X>player X | `nurse3` | **37 frames** | Look up; hop up-left 32f |

The durations include init/look/return. There is **no completion follow refresh**
in `PikachuWalksToNurseJoy`: remove review N-1's extra refresh. The earlier
font-loaded reset still refreshes where the ASM calls it. A nurse hop has a
shadow; an ordinary A6d follow ledge hop still has none.

Native alternate VRAM offset `$40` changes which tile allocation is used, not
the pose geometry. Use the existing committed Pikachu sheet; preserve raw
image frame/direction semantics without introducing a second sprite asset.

### 7.2 Hide, enable and actual first visible image — correction to N-2

Do not treat `visible`, drawing enabled, IMAGEINDEX and pending spawn state as
one boolean. Enabling drawing does not itself draw Pikachu or immediately
consume state 5. Suppress the generic UI-opening sprite update for the nurse's
internal **PrintText** calls: they are inside one DisplayTextID, not fresh
DisplayTextIDInit calls. Keep UI tile capture/coverage; move sprite mutation to
the routine's explicit source call points.

The outer source order to represent is:

1. NeedYourPokemon text, 64 frames, disable Pikachu drawing.
2. If following and starter alive: nurse image `$04`, 64 frames (`Func_6eaa`).
3. Nurse facing/image left through `Func_6ebb`: facing, 6 frames, image write;
   then 30 frames; run the existing machine/heal operation.
4. At the machine's return, explicit UpdateSprites while Pikachu drawing is
   disabled. Then the eligible return nurse image `$04`, 64 frames; set pending
   spawn state 5; enable Pikachu drawing without inventing an immediate redraw.
5. Nurse down via the same six-frame facing/image sequence; fighting-fit text.
6. If starter alive: **`Func_6ebb(15, 0)`** sets Pikachu's facing down, waits
   **6 frames**, then **directly writes its standing IMAGEINDEX**.
7. LoadCurrentMapView, **Delay3**, UpdateSprites, ReloadWalkingTilePatterns;
   set the nurse bow image `$01`, wait **40 frames**, UpdateSprites, load font.
8. Farewell text and the routine's final UpdateSprites; the outer text close
   restores original facings in its existing order.

**N-2 says Pikachu first becomes visible after the 40-frame bow. That is too
late according to the source.** `Func_6ebb(15,0)` calls `SpriteFunc_34a1`, which
writes slot 15's IMAGEINDEX directly. HRAM aliases `hSpriteHeight` to
`hSpriteIndex` and `hSpriteOffset` to `hSpriteImageIndex`, so this is a real
Pikachu image write. The following Delay3 lets PrepareOAMData publish that
image **before the bow starts**. Neither enabling drawing earlier nor waiting
for the post-bow update describes this call sequence correctly.

Make this a focused reviewer-visible trace: drawing flag, pending spawn state,
map/pixels, movement status, facing, IMAGEINDEX and every explicit UpdateSprites
at each of the eight boundaries. Verify the first rendered frame as well as
the image write. If another upstream branch hides it, document that branch
and revise the expectation from evidence; do not hardcode the review's prose.

Preserve branch conditions: no/absent/fainted starter does not execute a healthy
starter approach; healing can make a fainted starter eligible for the return.
Capture “following enabled” independently of whether its image is currently
hidden. Avoid manufacturing a starter follower for a party without one.
Do not change save schema or starter identity in A6e.

## 8. Emotion movement before the portrait

Expose the selected ordinary emotion **number** from the existing selector,
so face selection and movement selection share one result. Keep the matrix,
status overrides (11 sleeping / 28 sick), happiness and mood rules unchanged.
No guessing an emotion from a PNG filename.

| Selected emotion | Native movement order | Movement-only frames |
|---|---|---|
| 4 | `fd230`, then cry 29, then portrait 4 | **67** |
| 6 | no-cry `$ff`, `fd21e`, skull bubble, portrait 6 | **67** |
| 7 | `fd224`, cry 1, `fd224`, portrait 7 | **35 + 35** |
| 9 | cry 6, `fd218`, skull bubble, portrait 9 | **69** |
| 13 | `fd21e`, portrait 13 | **67** |
| Other currently selected IDs | No movement command | **0** |

These callers use **Apply directly**, not TryApply: no relative-side guard and
no implicit completion refresh. Each repeated call retains its own one-frame
return. Do not concatenate programs by deleting the intervening sentinel.

Use explicit phases owned by the emotion controller:

1. **Entry:** serve the existing face-player request on the bare map with the
   font loaded (A6c R-3). Do this once, before the first init captures state.
2. **Prelude:** run the selected movement call(s) while the map remains visible.
   No portrait border/UI tiles, no ordinary sprite updates, no portrait timer,
   and no A/B/START dismissal of the movement.
3. **Border:** capture the actual portrait border, wait 3 frames, run the
   covered font-loaded UpdateSprites, wait 3 frames, then start the existing
   face animation. For a zero-movement emotion, proceed here after entry.
4. **Portrait:** existing frame composition/duration and A/B behavior. Ensure
   A/B held through prelude does not silently skip it or count as a fresh press
   at portrait entry; follow the existing edge-read policy explicitly.
5. **Exit:** release the emotion/runner and UI tiles; resume normal overworld
   through its existing return update. Do not add a movement-completion refresh.

Keep UI capture independent of repaint frequency. `overworldUiOpen` / `UiEntry`
must distinguish an emotion interaction from an actually displayed border;
the current rising-edge hook must not create the portrait during prelude or
serve the bare-map turn twice. Keep all four-side real-portrait tests from R-3,
adding the delay between the two updates. Rendering the prelude must use the
same scene/shadow composition as story movement (§5).

The bridge records sound/bubble order as source metadata but does not pretend
to play them. In particular `PlayPikachuSoundClip` blocks (including three
DelayFrames and PCM time), and skull bubbles add 61 frames plus UpdateSprites.
Without those systems, **70 is only emotion 7's movement sum**, and 67/69 are
not total interaction lengths. Do not invent a silent audio wait or a fake
bubble to claim parity. §10 gives the remaining work explicit homes.

## 9. Implementation sequence and verification

Keep **one A6e slice**, with three reviewable checkpoints. If a checkpoint
cannot be finished in a sitting, commit the verified work and leave A6e in
progress; do not call the whole slice done or move to A1a.

### Checkpoint 1 — extracted data and pure runner

- Add offsets, typed extractor and both extraction entry-point calls; setup
  twice; inspect the two added JSON files and unchanged asset counts.
- Implement decoder, all func1/func2 cases, timers, image latch, sine, holds
  and return. Run focused unit/extraction tests before integration.
- Native byte-state fixtures cover each opcode family, all eight movement
  axes, all four live facings, timer limits/speeds, wraparound, immediate `$3f`,
  frozen vs live image facing, image-only turns and parameter bit 6.
- Independent assertions cover the three sine traces, shadow/no-shadow jump
  functions, the HL-clobber animation bug, and map-coordinate differences
  between relative and absolute moves. Expected values come from ASM/ROM,
  not production runner output captured and blessed as snapshots.
- Assert complete program durations **37/69/67/35**, empty sentinel 1 frame,
  and identical two-frame output holds when started on either outer parity.

### Checkpoint 2 — follower boundary, renderer and map/nurse callers

- Add explicit map state and native snapshot/apply boundary; remove script
  target state, queue entry methods, path handlers and floating-point arc.
- Wire typed guarded map requests and direct nurse call; preserve caller-owned
  refresh behavior and exact return frame. Port nurse's outer handoffs in §7.
- Verify active slot priority, base shadow position, grass override/restoration,
  all-sprite opaque masking, and restore/cancel behavior with Canvas spies or
  pixel fixtures at native 160×144 resolution.
- Controller tests start actual command lists and drive **every frame**, with
  both pass parities. Check player/NPC position and counters, follow queue,
  idle countdown, map-script/random/encounter calls all stay frozen during a
  runner. Count allowed refreshes by caller rather than asserting “some refresh.”
- Guard tests: starter/walking mode, every side, Y-first diagonal case, overlap,
  distances greater than one, hidden IMAGEINDEX, live facing irrelevant,
  execution-time side changes, failure with no refresh or delay.
- Lab tests: both Y branches, guard failures and placement between GRAMPS text
  and rival show/walk. Viridian retains both old-man path branches.
- Nurse tests: all four relative cases, unequal X below/above, overlap, no/fainted
  starter, declined heal, pending state 5, no end-of-walk refresh, exact named
  image/update boundaries, hidden during fighting-fit text and visible before
  bow under the healthy return branch. Test normal following after the farewell.

### Checkpoint 3 — emotion bridge and integration closure

- Wire one selected emotion ID to its prelude and existing portrait; phase
  UI entry, frame updates and scene rendering as §8 describes.
- Verify all five movement IDs (including both calls for 7), no-movement/status
  IDs, no direct-call refresh, movement before border, R-3 turn before init,
  two border Delay3 holds, covered update once, ignored movement dismissal,
  portrait duration starting at portrait, and normal follow after exit.
- Drive `captureUi(renderPikachuEmotionBox)` from all four sides. Add a
  render-frequency test: zero/multiple renders between ticks cannot alter the
  movement trace, hide time or UI-update count.
- Clear/replace a running script, clear emotion and debug-warp mid-hop: no
  shadow, stale slot override or retained blocking countdown after cleanup.

Likely production files: new extractor and `pikachu_movement.ts`, a small
data loader / typed caller adapter, `pikachu_follower.ts`, `pikachu_happiness.ts`,
`pikachu_emotion.ts`, `pikachu/index.ts`, `script/types.ts`,
`script/script_controller.ts`, `story/viridian_city.ts`, `story/oaks_lab.ts`,
`overworld/overworld_controller.ts`, `overworld/ui_entry.ts`, `main.ts`, plus
only the necessary shared shadow/render helper. Avoid a broad module rewrite.
Update affected subsystem ARCHITECTURE files, generated-data counts, STATUS
and settled decisions when implementation is authorized.

### Final checks

Baseline is **729/729** in 29 files with ROM; **657 pass / 72 skip** without.
Those are the reviewed A6d results, not tests rerun during this planning session.
After implementation, in `game/`:

1. `npm run typecheck`.
2. `$env:ROM_PATH = 'pokeyellow.gbc'`, then `npm test`; record actual new totals.
3. Remove only that environment variable, then `npm test`; record pass/skip counts.
4. `npm run build`.
5. `git diff --check` and generated diff audit: only the new JSON and mirror;
   520 PNG/3 tilemaps unchanged. No ROM tracked or requested by the browser.

Preserve the independently reproduced ordinary-following trace from A6d:
240 samples on its 30-step path, SHA-256
`3d29d4e59b91a7a6e3442f9222b0e08c9522ee96fceaeece35a9ea79e5eb63c4`.
Reproduce it once after the explicit-map-state integration, along with the
existing ledge, antic, START, warp and seven-collision-check tests. Changed
script/nurse tests must assert native behavior, not keep obsolete target-queue
expectations. Broaden tests only if a new failure or remaining concern warrants it.

### Review and user play-test

Use `npx vite --host 127.0.0.1 --port 5173 --strictPort`; A=Z, B=X. Assign
independent review after implementation; the user chooses the implementer.
Do not mark A6e done until review and the user's play-test are complete.

1. Walk, turn, hop Route 1 ledges, stand for antics, open/close START, cross a
   door: A6a–d behavior still looks as already verified.
2. Heal with Pikachu below, left and right of the player: real diagonal slide
   where applicable, integer hop, shadow below the feet; NeedYourPokemon waits
   for the move. Above-player case has no approach. Decline also works.
3. Watch healing: Pikachu stays hidden through the fighting-fit text, returns
   before the nurse's bow, then follows correctly after farewell. Include a
   fainted starter healed back to health, and a party without a starter.
4. Deliver the parcel to Oak: Pikachu steps aside after GRAMPS and before the
   rival appears, for each reachable guarded branch; Pokédex/story still finish.
5. Trigger the old-man losing-touch/walk-away off x=19 with Pikachu on the right:
   down/left steps, native facing/image transition, then normal following.
6. Talk to Pikachu from all four sides. For emotion IDs 4/6/7/9/13, the visible
   movement occurs **before** the face box; 7 runs both double-bounce calls.
   Each hop has the shadow. A/B cannot skip the prelude. Other portraits still
   open; exiting restores ordinary following.

Rare placements/emotions may require a temporary uncommitted test harness.
Expose state only in that harness and remove it before review; no permanent
debug controls. Keep user saves intact. Report browser checks actually run,
and label any deterministic fixture check instead of claiming it was played.

## 10. Findings that retain separate homes

| Finding / remaining gap | Home |
|---|---|
| Hop-midpoint RunMapScript, trainer sight after landing | **A1c**, already settled in #38 |
| PCM cries, their blocking playback duration/audio interaction | **V5 audio catch-up**; then emotion integration audit in J2 |
| Ordinary emotion bubbles, their 61-frame waits/UpdateSprites; complete portrait bytecode, exit/border sequence and selection audit | **J2 Pikachu emotion audit**, explicitly log before implementation handoff; A6e implements only movement/initial border |
| Map-specific emotion commands (Pewter sleep, fan club, Bill, fishing, etc.) | Their **map/story slices**; share the A6e runner when those callers arrive |
| Apply callers on Mt. Moon, Game Corner, Bill's House, Cinnabar Gym, fan club, Pokémon Tower | Their **B/C/E/G map slices**; no new maps/program extraction in A6e |
| Healing-machine palette flashes/OAM, sound synchronization, remaining text-engine differences | **V5 audio** + **J2 Pokécenter presentation audit**; outer Pikachu handoffs/waits are A6e |
| Starter OT/name/ID eligibility fidelity beyond today's model | **J2 Pikachu audit**; use existing starter identity in A6e |
| Oak's existing rival X workaround and other unrelated lab paths/text | **J2 story audit**; only insert the missing Pikachu call here |

Do not turn these into fictitious settled improvements or bundle them into
A6e. The runner is complete for `$00..$3e`; the set of extracted callers and
emotion presentation coverage is deliberately current-map scope.

## 11. Proposed decisions (O-12)

1. **One A6e slice, with the three checkpoints in §9? Recommended: yes.**
   The runner and its four consumers form one coherent feature. The small new
   JSON extraction is an explicit data+engine exception, like #35, while its
   extraction checkpoint is verified before integration. If a sitting ends
   early, commit verified progress and keep A6e open. No sixth A6 slice or new
   milestone unless evidence during implementation requires a split.
2. **Bound the emotion work to movement and initial portrait entry? Recommended:
   yes.** Implement all movement commands used by current ordinary emotions,
   with exact interpreter timing and correct turn/border order. Keep the full
   emotion/audio/bubble/portrait audit in the homes in §10. Alternative: a
   separate full emotion-presentation slice before closing that broader gap;
   it would add substantially more work than this movement interpreter.
3. **Port the nurse's outer handoffs/waits and verify N-2 against the direct
   image write? Recommended: yes.** Removing the extra refresh alone leaves
   the heal return disconnected from real source call points. Port the bounded
   sequence in §7, including no/absent/fainted branches and internal PrintText
   UI policy. Retain the machine's internals for their existing audit homes.

The user requested this **plan**; that does not start implementation or assign
an implementer. After scope/implementer are settled, record the choices in
DECISIONS and claim A6e in STATUS. Finish with an independent review handoff,
then the user's checklist; commit locally at each handoff and never push.

## Planning verification

Read the updated context and affected subsystem notes, A6d's plan/review and
the source anchors above. Read-only Python probes matched all 63 records to
the ROM, confirmed ten programs, extracted the sine words/three golden traces
and checked shadow equality. No engine/generated files changed, setup or game
tests run, or browser play-test claimed during this planning session.

## Implementation result (2026-10-04, Claude Opus 5.5) — awaiting review and play-test

The user asked Claude to implement this plan, taking §11's three recommendations
(DECISIONS #39). Three verified checkpoint commits, never pushed:

| Commit | Checkpoint |
|---|---|
| `0a89455` | 1 — `pikachu_movement.json` + `pikachu/pikachu_movement.ts` (the pure runner) |
| `1a7231f` | 2 — follower boundary, renderer, Viridian / Oak's Lab / nurse callers |
| `89f620b` | 3 — the emotion prelude before the portrait |

**Checks:** typecheck clean; `ROM_PATH=pokeyellow.gbc npm test` **767/767** (30 files);
without the ROM **693 pass / 74 skip**; `npm run build` OK; setup twice byte-identical,
generated diff = `data/pikachu_movement.json` + its `static/` copy (165 JSON per tree,
520 PNG, 3 tilemaps). The A6d ordinary-following hash `3d29d4e5…` still passes after the
explicit map position. **No browser check was run**; the dev server serves both new
files (HTTP 200).

**Where the result differs from this plan, with the evidence:**

- **Viridian's program is at `3c:5a0a`, not `3c:5e2b`.** `ViridianCityMovePikachu`
  (3c:5a01) assembles to `21 0a 5a` — `ld hl, $5a0a` — and pret's sym file agrees. The
  bytes at 3c:5e2b are identical (another map's copy), so the JSON is unchanged; the
  committed offset is the one the game reads.
- **Spawn state 5 moves only a starter that wasn't out.** Its readers
  (`CalculatePikachuPlacementCoords` / `CalculatePikachuFacingDirection`) run from
  `TrySpawnPikachu` only at movement status 0, which a following Pikachu never has after
  the walk. So a healthy Pikachu stays where `PikachuWalksToNurseJoy` left it (an
  "above" Pikachu even stays diagonal), and the A6d `showPikachu` → `spawnAtState(5)`
  snap is gone. A fainted starter healed by the nurse spawns at state 5 at the first
  explicit UpdateSprites after the fighting-fit text.
- **The fainted starter's `Func_6ebb(15, 0)` image is not drawn.** On the cartridge it
  writes IMAGEINDEX at whatever stale pixels the slot holds, for 9 frames, before the
  spawn places it. Those pixels have no meaning here; the 6-frame wait is kept.
- **Pikachu's facing after the farewell**: `CloseTextDisplay` restores every slot's
  `ORIGFACINGDIRECTION`, which `DisplayTextIDInit` saved before the heal began; Pikachu
  turns back to it at the next ordinary update (`pikachuFacing` save/restore).
- **The bounce stays its own**: `asm_fc87f` subtracts its previous offset from YPIXELS
  and adds the next, so a call that starts mid-bounce sees the drawn pixels, and they
  come back without the offset (no double count when the bounce resumes).
- **Grass priority during a call**: the latched byte decides whether Pikachu gets the
  grass overlay (zero under the shadow). The overlay itself is still the engine's
  grass-tile overlay, not every BG tile's priority (unchanged A6a §3 approximation).
- **Script scheduling**: the frame a call returns runs the next command (no extra
  frame). The script engine's other commands still take one dispatch frame each, as
  before, so the nurse's waits are exact but the heal's total is not claimed.

**Not done here (homes unchanged, §10):** cries, emote bubbles and the portrait's exit
sequence; the healing machine's internals; trainer sight and the hop midpoint (A1c).

**Review and play-test:** the plan's §9 checklist, with the corrections above (a
healthy Pikachu does not snap above the player after a heal; it reappears facing down
before the bow, then turns to its pre-talk facing when the farewell closes).

## A6e revision (review R-1, R-2, N-1) — 2026-10-05, Claude Opus 5.5 — awaiting re-review

Fixes for `notes/15-a6e-review.md` (Codex, `0c51262`), one local commit
(`git log --grep "A6e revision"`). Both findings were right.

- **R-1:** `pikachuFacing` saves and restores the follower's slot facing whether its
  image is drawn or not, as `DisplayTextIDInit` / `CloseTextDisplay` copy every
  non-player slot. A fainted starter healed by the nurse now ends facing its pre-talk
  direction, and the next ordinary update draws it so. Regression: the real nurse yes
  branch with a fainted starter facing up, left and right, then an UpdateSprites and a
  render.
- **R-2:** the interpreter works in the cartridge's bytes. XPIXELS/YPIXELS and
  wPikaSpriteX/Y are screen pixels, MAPX/MAPY carry the +4 border, and every write wraps
  at 256. `startMovement` takes the player's world position (screen $40/$3c, fixed during
  the call) and converts with A6c's `screenPixels`, then converts back on every write.
  My earlier "programs never wrap, so world pixels are equivalent" held only for today's
  ten programs, not for the full interpreter §4 asked for. Regressions: a
  variable-length `$01` from screen X 250 (254, 2, 6), the base-plus-offset write at
  Y 2, map-step overflow both ways, and the follower boundary landing at world X 102.
- **N-1:** `spriteDrawOrder` (overworld/sprites.ts) now holds the scene's OAM order, and
  main.ts uses it. `renderer/shadow.test.ts` checks `drawShadowUnderSprites` with a
  canvas spy: the mirrored tile, `destination-out` cutouts for overlapping frames only
  (a flipped one mirrored), and the scaled composite.
- The EOF blank line in `ui_entry.test.ts` is gone; `git diff --check` is clean.

**Checks:** typecheck clean; `ROM_PATH=pokeyellow.gbc npm test` **776/776** (31 files);
without the ROM **702 pass / 74 skip**; build OK. No browser check.
