# A5b7 plan: menu text programs, in small implementation slices

**2026-10-14 · Codex. Approved by the user 2026-10-14 (DECISIONS #52): all three §8
decisions, including A5b6's gate. A5b7a implemented in three checkpoints below;
next: Claude reviews it, then the user checks visible rendering.**

Parent: `notes/23-a5b-plan.md` §§4–7, DECISIONS #45/#48. Current baseline:
1242/1242 in 64 files with the ROM; 1119/123 without it. Typecheck and the ROM
suite were verified during today's preceding study session. No tests or build
were rerun for this documentation-only plan.

A5b6 passed review (`notes/38-a5b6-review.md`). At planning time its user gate was
unconfirmed; the user subsequently approved it on 2026-10-14 (DECISIONS #52),
without claiming to have run the four checks individually.

## 1. Recommendation

Subdivide A5b7 into **seven ordered slices**, each committed locally and reviewed
before moving on. The first is **A5b7a: number printing and common menu glyphs**.
Visible caller migrations get their own browser smoke and user play-test. Do not
implement the whole table in one session.

| Slice | Deliverable | Boundary / gate |
|---|---|---|
| **A5b7a** | Typed numeric bindings; `bcd`/`decimal`; standalone no-text-delay calls; contraction/extra-font rendering and glyph width | Shared execution only, three checkpoints (§4). Existing game callers remain on their current flows |
| **A5b7b** | Mart greeting, buy/sell/quantity questions, confirmations, failures, success, quit, retained map display | One Mart display and its source exit; money/inventory regressions and user play-test |
| **A5b7c** | Supported field item use/toss, medicine results and overworld party questions | Existing item effects and party mechanics; battle compatibility retained; user play-test |
| **A5b7d** | Red's item PC, Pokécenter PC startup/top level, nested player item storage | Direct versus generic PC sound/text/exit contracts, item slot invariants; user play-test |
| **A5b7e** | Bill's supported storage messages and source call ordering | Existing transfer/release/current-box operations; explicitly bounded storage UI gaps (§6); user play-test |
| **A5b7f** | Save presentation, actual sound wait and automatic return | Existing localStorage operation/schema; source START exit; save/reload and user play-test |
| **A5b7g** | Remaining caller census, justified legacy-command retirement, A6e fixture migration and final regression | A5b5c N-3 required; no blanket legacy-mode deletion; no extractor/alias cleanup |

The letters subdivide the existing A5b7 increment, not new project milestones.
Detailed caller slices must record their own source paths, branch traces and
checkpoint boundaries before their implementation. This note establishes those
boundaries and fully specifies the immediate slice, A5b7a.

## 2. Evidence checked for this plan

Runtime reads: `main.ts` initialization/menu dispatch/rendering and PC startup;
`text/{text_runner,text_printer,textbox,charmap,bg_transfer}.ts`;
`menus/{menu_render,menu_input,yes_no_menu,shop_menu,item_menu,party_menu,pc_menu,
pokecenter_pc_menu,bills_pc_menu,save_menu}.ts`; `script/script_controller.ts`;
overworld menu dispatch; save schema; extractor `TextOp`/`TextBinding`; committed
programs; and the A6e nurse fixture in `overworld_controller.test.ts`.

Assembly read, all in `refs/pokeyellow/`:

- `home/{text,text_script,map_objects,print_text,print_bcd,print_num,yes_no,list_menu}.asm`.
- `engine/events/pokemart.asm`.
- `engine/menus/{players_pc,pc,save,main_menu,start_sub_menus,party_menu}.asm`.
- `engine/events/hidden_events/pokecenter_pc.asm`.
- `engine/pokemon/bills_pc.asm` and supported medicine/toss paths in
  `engine/items/item_effects.asm`.

Confirmed differences that affect the plan:

1. The program runner handles strings/FAR/RAM/pauses/sounds/button waits but
   deliberately throws on numeric ops. A5b1 already extracted prices and HP
   operands. No extraction is needed to execute these programs.
2. `TextBindings` currently permits strings only. The number ops need actual
   numeric values, not prices or HP amounts formatted into replacement strings.
3. **The BCD flag name is a trap.** Extracted `leadingZeroes: true` means bit 7 is
   set, which **suppresses** leading zeroes in `PrintBCDNumber`. The decimal
   routine's leading-zero flag has different behavior. Preserve the JSON schema.
4. **BCD digits call PrintLetterDelay; decimal digits do not.** Suppressed BCD
   positions do not delay or read input. The optional currency symbol is written
   without its own letter delay. Decimal output is immediate and leaves the
   cursor for the following `!`; do not route both ops through PlaceString.
5. `TextBox.print()` supports `noDelay`, but `printStandalone()` does not expose
   it yet. Player PC and party redraws set BIT_NO_TEXT_DELAY; their text must not
   accidentally acquire per-letter waits. PrintText's own Delay3 remains.
6. `menu_render.drawText()` indexes UTF-16 characters rather than glyph tokens
   and never selects extra-font tiles. TextBox already supports contractions,
   curly quotes and ellipsis. Static width calculations also count characters.
7. Mart/PC/medicine/save classes draw instant string arrays and poll frame-level
   input independently. Swapping literals for source strings would preserve the
   wrong extra waits and lose source terminators.
8. The current shop selects quantities and executes transactions without the
   source price text plus Yes/No. It filters zero-price objects out of SELL,
   whereas the source shows the bag and has an unsellable-item branch.
9. Mart returns through **AfterDisplayingTextID** (outer silent wait, then Hold
   and close). The PC wrappers in `home/map_objects.asm` return directly to
   **HoldTextDisplayOpen**, with no outer button wait. Current main jumps straight
   to overworld after closing either menu.
10. The extracted sound list already includes purchase, withdraw_deposit, save,
    turn_on_pc, turn_off_pc and enter_pc. Medicine's HEAL_HP/HEAL_AILMENT, ordinary
    cries and Pikachu clips are absent; those are explicit deferred audio gaps.
11. Save's initial source delay is **30 + 10 = 40**, not the current 30. After
    accepted Yes/No's 15-frame tail comes 10, the save operation, Saving PrintText,
    128, Saved PrintText, 10, actual save sound/wait, 30, then return. The current
    implementation waits 60 and requires an invented final press.
12. `StartMenu_SaveReset` restores the saved screen and jumps to Hold/Close;
    it does not redisplay START, including after declining to save.
13. A5b5c review N-3 is still present: the A6e nurse fixture rewrites real
    `printText` commands into legacy `text` and uses a fake box. Removing `text`
    requires migrating that fixture while retaining its movement assertions.

## 3. Architecture for the later caller slices

Reuse `TextScreen`, `TextProgramRunner`, `TextBox`, `MenuInput`, `YesNoMenu` and
the existing `CloseSequence`. Do not add another general script engine or a
second text interpreter.

Menu text returns to the owning menu. The source's `done` or `prompt`, its explicit
button wait and its outer map close are distinct events. Questions hand over to
the menu on their program-return tick. Retained text continues BG transfers while
the cursor, a source delay or a sound owns the frame. Render does no ticking.

For map-entered menus, retain one DisplayTextID session across the menu and its
children. Add a small explicit menu handoff/return to the existing script action
protocol, using the Town Map handoff as precedent. The owning menu receives the
shared text host; its return resumes the script's source-specific finish. Do not
call `initScript()` again for every message or nest an accidental second display.
Register generated script kinds where available and adapt hidden PC predefs;
preserve the Mart's parcel-before-shop table selection.

Main must allow exactly one owner to advance text/transfer and read Joypad per
frame. In particular its idle synchronization must not read through protected
PrintText delays, menus' Delay3/15-frame tails, sound waits or close copies. The
bridge needs integration tests through actual main dispatch or an extracted
equivalent, not only command-array snapshots. Cover the return UI-entry latch
so a live retained display is not opened/updated twice (note 38 N-1).

Use `MenuInput` for the simple source HandleMenuInput menus. Preserve the existing
`YesNoMenu` actual-read implementation and its 15-frame tail; add the save's left
placement without changing nurse/notebook behavior. Do not refactor it onto
MenuInput in A5b7a. List scrolling, repeat input and the entire menu sprite-update
audit remain J2 unless a migrated call's necessary handoff requires a local fix.

## 4. Immediate slice: A5b7a, three checkpoints

### CP1 — numeric operands and number primitives

- Extend runtime bindings with named numeric inputs for `money`, `coins` and
  `hpDifference`, retaining string-only RAM inputs (`stringBuffer`, `nameBuffer`,
  `boxNumString`). Keep extracted `TextBinding`/`TextOp` and JSON unchanged.
- Missing/wrong-kind operands fail with the program/binding name. Use integers
  within the operand's represented range; reject invalid runtime bindings instead
  of coercing arbitrary text or silently clamping. Existing in-game valid values
  must reproduce the source output, including all-zero numbers.
- Add the minimal cursor/write primitives TextScreen needs. Preserve the logical
  cursor even for clipped writes. Suppressed right-aligned BCD positions advance
  without overwriting existing tiles; they are not inserted spaces. Do not change
  automatic wrapping or the fixed bottom-box clipping contract.
- Implement BCD flags, final zero fallback, optional ¥, digit delays and actual
  reads from `home/print_bcd.asm`. `noDelay` bypasses letter waits/reads, not
  source `pause`, `prompt` or explicit waits.
- Implement TX_NUM's left-aligned big-endian value using `bytes` and `digits`,
  following `home/print_num.asm`. Its digit writes have no letter waits or Joypad
  reads. Test cursor advancement into the suffix of the real PotionText program.
- Existing unsupported ops stay explicit errors. This is not a request to add
  move/box/dots or a full tile-map VM without a caller.

Files: `text/text_runner.ts`, `text/text_printer.ts`, associated focused tests;
binding type consumers only as required to keep strict TypeScript clean.

Gate: runner/printer regressions plus actual committed `_PokemartTellBuyPriceText`,
`_PokemartTellSellPriceText`, `_PotionText` programs. Check 0, 1, 10, 100 and maximum
valid amounts, each BCD flag combination, prefilled skipped cells, medium/held/
no-delay digit timing, no decimal reads, FAR cursor retention, and wrong bindings.
Keep synthetic arithmetic fixtures independent of the production formatter.

### CP2 — standalone menu PrintText without letter delays

- Expose the existing no-delay contract on `printStandalone()` and pass it into
  the same printing/runner path. Keep the default unchanged for Oak's speech.
- A standalone new PrintText still clears and holds Delay3, even with no letter
  delay. Native prompts, manual waits, sounds, retained screen and shared actual
  Joypad history remain intact.
- Test a second standalone print retaining the same host/history, one transfer
  per enabled frame, and no input consumed during Delay3. A real menu caller will
  be wired in A5b7b/d/c, not as an unrelated demonstration in this checkpoint.

Files: `text/textbox.ts`, `text/textbox.test.ts` and runner tests if needed.
Gate: existing Oak speech and display-session tests retain their assertions.

### CP3 — static glyph rendering and handoff

- Make common menu `drawText()` iterate the existing longest-match glyph tokens;
  use `font_extra` for its mapped quote/ellipsis glyphs, and the regular font for
  contractions, PK/MN, symbols and cursors. Spaces advance one tile.
- Add a glyph-width helper and use it in newly migrated callers as each later
  slice is implemented. Do not mass-edit every `.length` in the engine.
- Static labels remain immediate. No control-string parsing, paging or new
  typewriter timing in the static renderer; structured source messages run in
  TextBox instead. Keep legacy battle message flattening until A5c.
- Test actual tile selections and x offsets for `SOMEONE's PC`, a player name plus
  `'s PC`, curly quotes/ellipsis, PK/MN and unchanged cursor/ASCII labels. Review
  the shared renderer's existing battle callers for rendering regressions.
- Document the numeric flag/timing traps and new entry-point contracts in the
  text/menus architecture docs, update tests documentation and STATUS.

Files: `menus/menu_render.ts`, focused rendering tests, architecture/context docs.
Gate: full ROM/no-ROM suites, typecheck/build/diff check; targeted visual inspection
of existing menus with contractions and representative battle/yes-no labels on an
isolated origin. Commit locally. Stop for review. No Mart/item/PC/save migration
belongs to A5b7a.

## 5. Caller contracts to carry into subsequent plans

| Caller | Required program/flow contract |
|---|---|
| Mart | Greeting is inner PrintText after DisplayTextID opening, first glyph +23. Buying/selling greetings return into lists; price programs bind `stringBuffer`/`money` and end in done before Yes/No. Buy: affordability → add destination → subtract money → purchase sound with current/finish waits → BoughtItemText. Sell: source offer/YesNo → add money → remove selected slot; remove the invented `Sold ... for ...!` message. Empty/unsellable/insufficient/full paths return where the source branches. ThankYouText → explicit UpdateSprites → outer wait/Hold/map close |
| Field bag / party | PartyMenuNormalText, PartyMenuSwapMonText and PartyMenuItemUseText are source no-delay redraw messages. Medicine result is selected by the source message table, with live nickname and HP difference; source redraw/50-frame wait/silent button wait must be explicit. Toss uses native quantity/IsItOKToToss/YesNo/remove/ThrewAway or TooImportant programs, with selected-slot removal. Preserve Town Map handoff and current effect/happiness implementations |
| Direct player PC | Turn-on sound begins before TurnedOnPC2Text. Source sets BIT_NO_TEXT_DELAY on PlayerPCMenu and clears it on exit; questions/results obey that live flag. Quantity programs precede quantity input. Destination add succeeds before selected source removal; successful transfer waits for current sound, plays withdraw_deposit and waits, then prints its result. Direct exit plays/waits turn_off_pc, then Hold/Close, no outer wait |
| Pokécenter PC | ActivatePC plays turn_on_pc, prints TurnedOnPC1Text, then waits for sound; restores screen, Delay3, menu. A selected child waits enter_pc before the complete AccessedSomeonesPCText/AccessedMyPCText program. Generic child item storage omits duplicate on/off sequences. LogOff plays/waits turn_off_pc, then Hold/Close. No invented split access messages |
| Bill's PC | No-text-delay programs, name/box bindings and source return points for supported empty/full/last-mon/store/take-out/release paths. Main menu is static labels, not an invented `What do you want to do?` dialogue. Remove invented success and confirmation prose. New storage mechanics/UI gaps require the explicit boundary in §6, not silent scope growth |
| Save | PrintSaveScreenText's 30 + caller's 10; typed question; source left Yes/No at (0,7); accepted branch's 10; save once; SavingText; 128; GameSavedText; 10; save sound actual wait; 30; caller restores map then Hold/Close. No final confirmation or return to START. Decline also follows the caller's Hold/Close. No new SRAM or save-identity semantics |

Capture each source no-delay flag, complete program/terminator and explicit waits
in caller tests; not every program should type. Transfer phase is shared across
retained calls, but absolute full-screen VRAM phase remains a documented later
audit where it is not already modeled. PrintText's own sprite update remains J2;
explicit caller updates and the closing update must still be modeled.

## 6. Scope limits and findings for their owning slices

- **No extractor or generated-data edits expected.** All required message roots
  and numeric operands are already present. Verify each caller's root closure
  before wiring; a genuinely missing program gets a separate data checkpoint.
  Alias retirement is a later data-only change, per note 37, not A5b7g cleanup.
- **Audio:** use the already extracted bank-$02 sounds. Save in Oak's Lab,
  Viridian Forest and DiglettsCaveRoute2 is three audio updates too long until
  V5's bank-aware SFX lookup (STATUS / note 28). The A5b7f result must say so.
  HEAL_HP/HEAL_AILMENT and cry/PCM playback are excluded; do not fabricate their
  durations or claim full audio timing fidelity for medicine/Bill's PC. Re-scope
  only through a separately approved extraction prerequisite.
- **Gameplay bugs observed, not fixed by this plan:** FULL_RESTORE is intercepted
  by the general HP-heal branch before its special status-clearing branch; at
  full HP the early failure also prevents the intended status-only branch.
  Track this for the supported-item behavior audit (J2 unless separately promoted).
  New medicine effects, TM/HM, overworld poison and related systems stay A2/A3/J2.
- **Bill's PC boundary:** source deposit/withdraw has an action/STATS/CANCEL menu,
  starter-Pikachu-specific checks/cries, and PRINT; this copy has simplified
  Yes/No prompts and no PRINT. Source release protects starter Pikachu. Do not
  claim a complete PC fidelity audit from swapping its messages. Recommend
  source programs/terminators on existing operations now; full action/STATS/PRINT,
  starter rules/happiness and storage-mechanics corrections stay E2/J2. A5b7e's
  detailed plan must name every retained simplification and avoid inventing new
  confirmation prose to stand in for the absent source screens.
- **Change Box is not just a question.** `ChangeBox` asks WhenYouChangeBoxText,
  waits for Yes, selects a box, plays/waits save and actually saves the game.
  Current code only changes an in-memory index. Preserve existing box persistence
  until E2; do not display a warning promising an automatic save that does not
  occur. Migrating that full warning/automatic-save contract requires a separate
  explicit change of scope. `ChooseABoxText` can serve the existing selector.
- **Older-file question:** CheckPreviousSaveFile compares cartridge save identity.
  This copy has one localStorage save and no equivalent current trainer identity
  check. Keep current overwrite semantics; do not ask on every save, infer identity
  from player name, or add a new save format just for the extracted text.
- **Oak's PC/league/link:** excluded by the parent plan. The top PC menu remains
  the supported three choices; its missing post-Pokédex Oak entry is an explicit
  gap. Do not add an unimplemented menu choice. Naming/title/intro animations,
  healing machine, Town Map internals and battle text remain their assigned work.
- **Cleanup:** removing script `text` needs the A6e real-session migration
  (note 36 N-3), including the healthy/fainted starter, all original movement
  timings and image/facing assertions. `textButtonWait` has a real hidden-item
  full-bag caller, so migrate it before removal or retain it deliberately.
  `closeText` is currently compatibility/tests; preserve its behavioral coverage
  on the replacement. Battle/catch-demo steps also named `text` are separate
  unions and are not candidates for this cleanup. TextBox legacy mode may still
  serve future A5c callers: audit each one before deletion.

## 7. Verification and handoff

Each implementation slice: focused source-behavior tests, strict typecheck, ROM
and no-ROM suites, build and diff check. Run setup twice only for an actual
extractor change; inspect generated changes then. Use mutation checks selectively
for meaningful frame/side-effect invariants, not as a blanket test-count target.

Later integration tests must prove no transactions before the appropriate source
confirmation/return, add-before-remove/charge, duplicate-slot preservation,
program return without an invented dismissal, exact input ownership and sound
waits, nested menu return, and the correct final outer-wait versus Hold close.
Measure program writes separately from transfer/scanout and audio updates
separately from simulation frames. Never replace real waits with arbitrary timers.

Use a spare Vite origin (for example :5188), leave :5173 and its saves untouched,
clear temporary storage and stop only the test server. Add no permanent debug
hooks. User play-test checklist per visible slice: Mart all transaction/cancel/
failure exits; bag medicine/toss/party questions; PCs direct/generic/empty/full/
transfer/release returns; save YES/NO, reload/CONTINUE and walking after exit.
Controls: **Z = A; X = B**.

Update STATUS and affected architecture/test docs at every boundary, commit only
the slice's files locally with co-author attribution, and stop for review.
`game/.gitattributes` is the user's and tracked since 2026-10-14 (DECISIONS #53).

## 8. Decisions to confirm

1. **Recommend seven slices (§1), starting with A5b7a only**, rather than one
   large A5b7 change. Sol implements; Claude reviews, then the user play-tests
   visible slices, continuing the standing workflow.
2. **Recommend the explicit scope limits in §6:** use existing SFX and persistence;
   leave the medicine bug and full storage mechanics/UI to their owning audits.
   Do not add new effects, cries, save identity or Change Box autosave in this work.
3. **A5b6 play-test status:** confirm its four checks passed, or handle the reported
   issue before A5b7 implementation. This plan does not mark that gate complete.

The user approved these decisions on 2026-10-14 (DECISIONS #52). The implementing
session claimed only the approved first slice, A5b7a, in STATUS.

## A5b7a implementation result — 2026-10-14, Codex/Sol

**Implemented; awaiting Claude review. No A5b7b or later caller migration started.**

- **CP1 `1cfead5`:** named typed number bindings, BCD flag/currency/skip/fallback
  behavior with source digit delays, immediate decimal output, minimal cursor and
  glyph operations, validation with source labels. 49 numeric tests; two obsolete
  unsupported-op tests removed. Focused 94/94; strict typecheck clean.
- **CP2 `943ac7f`:** standalone noDelay forwards through the existing PrintText
  path. Four new tests cover Delay3, real number bindings, retained transfer,
  native sound/prompt waits and cross-call actual-read history. Focused 58/58;
  strict typecheck clean. Oak default behavior unchanged.
- **CP3 (this result's commit):** charmap contraction primitive shared with the
  printer; static menu tokenization, extra-sheet selection and `textWidth` in
  unscaled pixels. Six Canvas draw-call tests. No global layout-width rewrite.
  Architecture, baseline and handoff updated.

Final gates: **1299/1299 with ROM, 1176 pass / 123 skip without ROM, 66 files**;
typecheck/build/diff check clean. Net +57 tests. Build: 121 modules, 344.33 kB JS
(101.63 kB gzip). No extractor/generated-file changes; no setup run. The full ROM
suite includes source-program comparisons and the static-export freshness check.

Three production mutations caught and restored byte-for-byte (SHA-256 checked):
BCD flag polarity (18 failures), standalone noDelay forwarding (3), static
contraction tokenization (2). Original source restored before the final focused
numeric/TextBox/menu-render run. These are tests of production changes, not
tests that throw on a fake expected assertion.

**Browser check:** isolated, muted headless Chrome on :5188 with a disposable
profile/save. Continued a staged save beside Viridian's PC and opened the real
top menu; inspected its contraction rendering. Then paused the main loop and
rendered the actual top-level PC class, glyph/YesNo comparison, and unchanged
battle action/text functions. Actual Canvas calls confirmed two single-tile 's
glyphs; measured widths SOMEONE's PC = 88, RED's PC = 56 game pixels. Six canvas
captures saved under `%TEMP%/pkmn-a5b7a-browser/` and visually inspected. This was
a targeted rendering smoke, not a full battle play-through or a menu-flow audit.
No page exception or unexpected failed resource. Existing absent favicon and
`wild/ViridianPokecenter.json` probes returned 404; `getWildData` intentionally
returns null for the latter. Temporary storage cleared; Chrome and spare Vite
closed. User :5173/saves untouched. No test hook added to product code.

**User check after Claude review:** open Viridian Pokécenter's PC and look at
SOMEONE's PC and your name's PC: the 's should occupy one tile with the following
space/PC aligned. Check ordinary YES/NO text still looks normal. **Z = A, X = B.**
Later PC/menu behavior, numeric bindings in actual Mart/item callers, medicine
SFX, save and storage semantics remain exactly the approved later-slice scope.
`game/.gitattributes` retained as tracked under DECISIONS #53. Local commits only.
