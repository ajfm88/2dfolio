# A5b — script and menu text calls

**2026-10-06 · Sol (Codex) · proposal; implementation has not started.**

Read alongside `21-a5-plan.md` §1.2, `22-a5a-review.md`, DECISIONS #44,
and the text, story, menus, overworld and audio subsystem architecture notes.
The user requested this plan after A5a was reviewed and user-verified.

## 1. Result and boundary

A5b makes existing story and overworld menu dialogue use Yellow's actual text
calls. A text returning to its caller, a manual page wait, and an outer
`DisplayTextID` wait become separate events. Opening, retaining and closing a
display follow those calls, including the sprite reload before walking resumes.

Examples of the resulting behavior:

- Oak's first warning continues into the player's `!` without a final button
  press. The bubble happens while the text display is still open.
- The rival's five snatching texts use five `PrintText` calls inside one
  `DisplayTextID`; the box does not close between them.
- A question ending in `done` opens its Yes/No menu immediately. It does not
  acquire an invented A/B acknowledgement.
- Oak's final new-game speech returns on `done` and starts the shrink sequence.
- The save confirmation types, waits through the cartridge's delays and sound,
  and returns automatically instead of asking for another A/B press.

**Scope:** the current 19 maps and existing story/menu branches, Oak's speech,
school notebook/blackboard, town-map sign, pickup openings, and the shared
overworld close routine. Audit plain map-text wrappers where A5a's flattened
map strings lost an inner `PrintText` call.

**Separate homes:** battle message conversion A5c; battle transitions A5d;
battle portraits/intros A5e; wild catch A5f; species names, unrelated missing
SFX and the wider map-object audit V5; new TM gifts A2, field effects A3,
trades A4, unfinished PC/Pokédex features their roadmap slices. Full intro
animation, naming-screen, menu-input and cry audits remain J2. Existing
mechanics and A6 movement stay in place except for moving an existing operation
to its documented position within a text handler.

## 2. Verified starting point

HEAD when planning began: `bb55777`, after Claude's review `ca53a23`. A5a has
963 tests in 44 files, typecheck/build clean; without ROM, 878 pass / 85 skip.
Those are the reviewed baseline results, not checks re-run in this planning
session. The tree was clean. A5a commits: `7897e8e`, `9cebc1e`, `94625a0`,
`4565e67`. The user reported: "it all runs well".

Reusable A5a work:

- `text_printer.ts`: place-then-delay glyphs, cursor controls, contractions,
  protected prompt waits, sound wait, scrolling and paragraph clears.
- `bg_transfer.ts`: shared third-frame phase and a displayed tile buffer.
- `TextBox`: explicit DisplayTextID and PrintText opening modes and retained
  text; legacy mode still serves scripts, menus and battle callers.
- `MapDialogue`: ordinary map texts and trainer text opening/ending behavior.

Remaining issues are in callers and data:

- `game_text.ts` deliberately strips terminators. It also splits some single
  ROM programs into invented pieces (choose-mon speech, parcel, notebook and PC).
- Story commands still use legacy text. Sequential strings usually mean
  sequential boxes, losing `text_asm` handler boundaries and commands after `@`.
- Several menus draw bottom messages instantly, use hardcoded English and add
  an A/B wait independently of the cartridge terminator.
- The script sound-wait path still synchronizes Joypad every frame. ASM does
  not read Joypad inside `WaitForSoundToFinish`.
- Closing currently has no map-specific sprite reload schedule. The UI entry
  helper is insufficient to stand in for every explicit `UpdateSprites` call.
- Pallet/Lab bubbles still use separate 40/30-frame script behavior instead of
  A1c's shared 61-frame `EmotionBubble`.

Review N-2 (legacy endings) belongs here. N-1's wider `text_asm` branch fallback
audit stays V5; converting an already implemented branch, such as Route 1's
follow-up, must nevertheless choose its existing correct text.

## 3. Cartridge contracts

Sources below are local `refs/pokeyellow/`; keep that tree read-only.

### 3.1 Calls and ownership

| Call | Opening/body | Return |
|---|---|---|
| `DisplayTextID` | `DisplayTextIDInit` once; then dispatch plain text, `text_asm`, or a special menu handler | Normally silent fresh A/B wait, then `HoldTextDisplayOpen`, then close |
| `PrintText` | Draw/clear message box, `UpdateSprites`, `Delay3`, then execute its text program | Return to caller with box retained; no automatic outer wait or map close |
| `PrintText_NoCreatingTextBox` / direct `text_far` | Execute with the supplied cursor/window state | No added three-frame redraw |
| `text_asm` | Run the TypeScript port of that specific handler | Preserve its conditional calls, flag writes, menu entry and `wDoNotWaitForButtonPressAfterDisplayingText` choice |
| `AfterDisplayingTextID` | Silent `WaitForTextScrollButtonPress` | Follow with Hold and close |
| `HoldTextDisplayOpen` | Read Joypad until A is released (B does not hold it) | Close; do not add a beep |

Anchors: `home/text_script.asm`, `home/window.asm`,
`engine/menus/display_text_id_init.asm`, `home/joypad2.asm`.

A5a's 20-frame display initialization remains. An inner `PrintText` adds its
own three frames; direct text does not. Do not add 20 frames to each string or
three frames to every map NPC indiscriminately. Oak's Lab disables automatic
box creation: a display may load the font and show a bubble before it has a
message border. Audit that flag separately from `TextBox.active`.

The outer silent wait is independent of a string's `<PROMPT>`. An ordinary
DisplayTextID program ending in prompt can require both the prompt's beep/wait
and the caller's silent wait. A handler suppressing the outer wait still runs
Hold and close. Retained text keeps receiving BG transfers during caller waits.

### 3.2 Text commands beyond PlaceString

`home/text.asm`'s `TextCommandProcessor` is different from the character
printer. A5b needs the following for the existing callers; do not build a
general ROM script or CPU interpreter.

| Command | Required behavior |
|---|---|
| `text` / `text_far` | Keep cursor continuity; `@` returns from the string to the next command. A FAR child returns to its parent, including after the child's done/prompt |
| `text_ram`, `text_bcd`, `text_decimal` | Supply caller-bound names/numbers; reproduce declared formatting, padding and glyph widths |
| `text_move`, `text_low`, `text_box` | Use the declared cursor/rectangle, when encountered by an in-scope program |
| `text_promptbutton` | Arrow, manual fresh-button wait, sound wait and beep, clear arrow, continue; **no ProtectedDelay3** |
| `text_waitbutton` | Manual fresh-button wait, sound wait and beep, continue; no arrow and no ProtectedDelay3; it is not the outer silent wait |
| `text_scroll` | Two five-frame scroll steps, cursor `(1,16)` |
| `text_pause` | One Joypad read: skip if A/B held, otherwise 30 frames with no further reads |
| `text_dots n` | Put one ellipsis, read Joypad, wait ten frames unless A/B held; repeat n times. The ASM comment saying 30 frames is misleading |
| Non-cry `sound_*` | Play the source-selected SFX and wait for actual sound completion without Joypad reads |
| `text_end` | Return from the command program; do not manufacture a button wait |

The string controls already implemented in A5a retain their semantics. In
particular, string `<PROMPT>` does have its protected three frames; the command
`text_promptbutton` does not. A child terminator must not discard its parent's
following key-item sound or text. Read the actual opcode/operand encoding in
`macros/scripts/text.asm` and `constants/text_constants.asm` before defining the
extractor interface.

### 3.3 Exact overworld close

`home/text_script.asm:CloseTextDisplay`:

1. Hide the window (`hWY = $90`), then `DelayFrame`.
2. Restore palette, disable auto BG transfer, restore saved NPC facings.
3. `InitMapSprites` **while the font-loaded flag is still set**.
4. Clear the font flag; reload player graphics unless the fly-warp bit suppresses it.
5. `LoadCurrentMapView`; return through one `UpdateSprites` call.

`CopyVideoData` takes **floor(tileCount / 8) + 1 frames**, including the final
remainder iteration when the remainder is zero. A regular walking half-sheet
has 12 tiles and takes two frames. Font-loaded reloads skip the still halves
and four-tile sprites. Current walking player graphics require two 12-tile
copies (four frames). Thus current normal walking close costs:

**1 + 2 × W + 4 = 5 + 2 × W frames**, from entering CloseTextDisplay to return.
Hold's preceding input loop is additional. The trailing UpdateSprites is a
call on the return frame, not an extra invented DelayFrame.

W means loaded regular sheet slots, including the separately reserved Pikachu
slot. It is **not** the number of visible NPCs:

- Outdoors (`mapID < FIRST_INDOOR_MAP`): choose the ROM sprite set, including
  split-map coordinate rules. All current outdoor sets have nine regular slots.
- Indoors: reproduce `LoadSpriteSetFromMapHeader` using live picture IDs from
  the map's sprite slots, including hidden objects; deduplicate regular pictures
  in slots 0–8, with four-tile pictures in slots 9–10. Always reserve Pikachu.
- Use live cutscene picture IDs, not just initial JSON or a tileset-name test.

Expected fixtures from the current map pictures and ROM tables, to assert
against the extractor/slot allocator during implementation:

| Map group | W | Normal close frames |
|---|---:|---:|
| Pallet, Viridian City, Route 1, Route 22, both current Route 2 halves | 9 | 23 |
| Oak's Lab | 5 | 15 |
| Viridian Mart, School, Nickname House | 4 | 13 |
| Viridian Pokécenter | 6 | 17 |
| Viridian Forest, both Forest gates, Route 2 Gate/Trade House | 3 | 11 |
| Red's House 1F, Blue's House, Diglett entrance | 2 | 9 |
| Red's House 2F | 1 | 7 |

Anchors: `engine/overworld/map_sprites.asm`, `data/maps/sprite_sets.asm`,
sprite-set split tables, sprite picture pointer table, `home/copy2.asm`,
`home/overworld.asm:LoadPlayerSpriteGraphics`.

Hide the box immediately while keeping the world frozen during reload. Disable
BG transfers at the actual source point; do not advance their phase through
disabled copies. Restore facings, then run the final sprite update with the
font flag cleared. Do not reuse this schedule for LCD-off screen reloads inside
the nurse/PC/town-map routines; those have their own call sequences.

## 4. Data and runtime proposal

### 4.1 Extracted data (before engine wiring)

Keep `game_text.json` as `Record<string, string>` and the approved `\n`/`\f`
encoding with tokens only where required. Preserve trailing `<PROMPT>`;
ordinary done/@ strings need no invented marker. Extract missing fragments and
menu messages from ROM. Add canonical full-block keys for artificially split
texts; initially keep old keys byte-for-byte for existing consumers. New program
entries reference the canonical keys, including preserved terminators. Migrate
consumers before retiring split aliases; retain explicitly named compatibility
keys for battle callers until A5c. Do not change a split key to a full block
while its current caller still concatenates the old pieces.

**Add `text_programs.json`.** This is an additive proposed schema, not a claim
that an existing extractor already emits it. Define/export its strict TS types
in a new extractor before creating a consumer. Named entries contain source
text commands with a discriminated operation union: string reference, far
program call, bound RAM/number, cursor/box, pause/dots, manual button wait,
scroll, sound and return. A string operation records its source ending
(`@`, done or prompt): @ continues its command program, done/prompt return
from that program after printing/waiting. This distinction is necessary even
when its ordinary string contains no ending marker. Preserve operand formats
and call boundaries. Record
ROM offsets in the extractor's source table, not as runtime ROM dependencies.

Extract only audited programs needed by current callers. Resolve FAR pointers
recursively with cycle/bounds guards. Stop at `text_asm`; that handler remains
source-matched TypeScript. Bind known RAM operands to declared domain inputs
(item, mon, quantity, money, names), never emulate RAM addresses. Unknown
opcodes or bindings fail extraction instead of silently truncating text.
Static labels remain simple strings. No regex reconstruction of programs from
English, and no runtime disassembly parsing.

**Add `map_sprite_sets.json`.** Export a strict extractor interface for map
IDs, outdoor set selection/split rules, set picture IDs and sprite tile counts.
Use ROM symbol addresses, confirmed at referring operands, not byte searching.
Existing map JSON need not change shape. Runtime indoor slot selection consumes
that metadata and the live map sprites. These two additions raise 167 JSON
outputs to 169 before any newly required SFX files.

**Required SFX only:** `save`, `purchase`, `withdraw_deposit` already extract;
wire them at in-scope call sites. Extract `get_key_item`, `turn_on_pc`,
`enter_pc`, `turn_off_pc` if the symbol/call audit confirms those missing
dependencies. Reuse A1a's audio schema/interpreter; verify each header and
command stream independently. Other sound additions stay V5. Never substitute
an item jingle or a guessed timer for a key-item jingle.

### 4.2 Execution

Extend the pure text generator with a small command-program runner. It shares
the printer's cursor, tile map, letter options, actual Joypad reads and audio
ports. Appending a string or returning from FAR must preserve that state.
Support the ASM's no-text-delay flag for static menu prompts/descriptions.

Introduce an explicit display-session lifecycle around existing TextBox:
initialization → body calls → optional outer wait → Hold → window hide →
sprite reload → trailing sprite update. Keep "program returned", "waiting for
input" and "display closed" separate. This can be a helper/controller; avoid a
second full script engine.

Story commands should express beginning a display, printing within it, and
finishing it. A source-matched builder groups calls belonging to one handler;
the current branch/splice mechanism can run its conditions and mechanics.
Pass the auto-box setting and outer-wait choice explicitly. Do not infer them
from done/prompt or from which screen owns a TextBox.

`MapDialogue`, retained pickup text, scripted dialogue and map-entered menus
share the same close routine. A menu's standalone PrintText should return to
the menu rather than close the map display. START's exit also reaches
CloseTextDisplay; apply the shared reload there while preserving its distinct
CloseStartMenu input gate. A full START opening/input audit remains J2.
Owned OakSpeech/menu boxes share
the input-read and transfer contract; main must not overwrite their Joypad
history during protected delays or sound waits. Transfer once per enabled frame,
including retained caller waits; rendering never advances it.

Extend the common glyph renderer/width helper to menu `PlaceString` labels so
contractions and extra-font glyphs occupy the correct tiles. Static labels
remain immediate. Convert overworld item-menu messages while battle's separate
item menu remains on its existing path; leave named compatibility strings or
an adapter until A5c rather than leaking new control tokens into battle output.
Remove legacy mode only after auditing all remaining callers.

## 5. Caller migration checklist

Each row needs an ASM call trace and a focused behavioral test, not just new
`show()` flags. Existing story flags, saved map scripts, object hiding, inventory
quirks, healing and Pikachu movement remain the established implementations.

| Caller | Source contract / change |
|---|---|
| Pallet first warning | `PalletTown.asm`: DisplayTextID → text_asm → PrintText → ten-frame delay → face down → player EmotionBubble (61) → suppress outer wait → Hold/Close. Do not move bubble after close |
| Pallet later texts | Audit each pointer: close-call/Whew are inner PrintText; ComeWithMe is direct text_far. Preserve each separate display and explicit source delays |
| Lab introduction | `OaksLab.asm`: no automatic border; each source DisplayTextID with its inner PrintText and explicit inter-call Delay3. Choose-mon block is one full PrintText |
| Lab ball/rival snatch | Ball handler's rival bubble is inside a borderless display and suppresses the outer wait. The subsequent five snatching PrintTexts share one display; preserve each native terminator and sound |
| Lab receive Pikachu | Two PrintTexts in one handler, no outer wait; received text/key sound precedes existing AddPartyMon and hide/event operations. Preserve A6e branches and rival battle mechanics |
| Lab parcel/Pokédex | Parcel handler retains direct fragments and key-item sound before its continuation; remove parcel at source point. Later direct-far Pokédex handlers do not inherit PrintText's extra three frames |
| Mom/TV | `RedsHouse1F*.asm`: conditional handler body, rest prompt → existing heal/fades/music wait → looking-great prompt → normal outer wait; TV chooses facing branch |
| Daisy | `BluesHouse.asm`: one conditional display; offer prompt, GiveItem, success key-item program or full-bag text. Flag/hide on success and follow-up remain source-ordered |
| Viridian Mart parcel | First greeting has its own DisplayTextID; movement/Delay3 remain separate. Parcel quest is one full program, with sound and no artificial split/reopen |
| Route 1, balls, hidden items | Retain A1b inventory/flag/hide ordering and actual audio waits; port opening/body/close. Route 1's existing follow-up handler chooses the correct body after the flag-first quirk |
| Viridian conditional talk | `ViridianCity*.asm`: Caterpillar question returns into Yes/No immediately; repeat-old-man question has source DelayFrames 2 before Yes/No; both replies remain in the same display. Sleeping push begins after the display returns. Preserve forced-demo state ordering |
| Nurse | `pokecenter.asm`: one outer display, distinct PrintTexts; first-use heal ask and farewell include text_pause, not unconditional timed waits or an extra confirmation. Preserve USED_POKECENTER behavior and A6e's heal/Pikachu handoffs; normal outer wait only on final return |
| Notebook | `hidden_events/school_notebooks.asm`: full page 1 includes looked-at prelude; prompt → turn-page done → Yes/No immediately. Page 4 then girl's reaction uses text_waitbutton; suppress outer wait for the whole hidden handler |
| Blackboard | `school_blackboard.asm`: intro prompt, menu's no-text-delay prompt/labels, selected description prompt, menu again. Extract missing burn and menu prompt; retain one display and no outer wait on exit |
| Town-map sign | `hidden_events/town_map.asm`: far string → text_promptbutton (no protected three) → source screen/font handoff → town-map UI → explicit close. Do not insert an ordinary map-dialogue ending before opening the map |
| Oak speech | `oak_speech*.asm`: standalone PrintText calls; include both Text2A and Text2B around the cry cue; preserve prompt/done at each naming handoff. Final done advances into shrink without an A/B wait. Animation and name-menu overhaul stay J2 |
| Shop | `pokemart.asm`: greeting, buy/sell questions, quantity/transaction/failure/quit messages as source PrintText programs; cursor input starts only after printing returns. Quit returns through outer AfterDisplayingTextID |
| Item menus | `item_effects.asm` and list-menu caller: currently supported field-use/toss results and questions, dynamic bindings and source terminators. No new effects or battle-flow conversion |
| Player PC / Pokécenter PC / Bill's PC | `pc.asm`, `players_pc.asm`, `pokemon/bills_pc.asm`: turn-on text/sound before menu, native complete access program rather than split instant strings, selection questions and current transfer/release failures/successes. Preserve existing functionality; do not add Oak's PC, league, or new box mechanics |
| Save | `menus/save.asm`: save-screen → 10 frames → typed question/YesNo; accepted → 10 → existing save operation → Saving PrintText → 128 → Saved PrintText → 10 → save SFX and actual wait → 30 → return. Port older-file question only where existing save behavior needs it; do not invent SRAM semantics for localStorage |

Plain NPC/sign wrappers on current maps also get a small explicit call-contract
table distinguishing direct text from `text_asm` → PrintText. Validate entries
against the source pointers. This is structural caller metadata, not a new
best-effort search for the first far string or a full missing-handler audit.

**Cry limitation:** no current audio API plays Pokémon cries. J2 explicitly
owns them. Recommendation: retain the OakSpeech cry command as a declared cue,
restore both surrounding strings now, and document unavailable playback/wait
as a J2 gap. Do not invent a duration or say this path is fully timing-exact.
If the user wants that cry exact now, plan a dedicated prerequisite before
the OakSpeech increment; it is not a trivial extra SFX entry.

## 6. Proposed implementation increments

The old "2 sessions" estimate is too small for the confirmed caller/data
surface. **Recommend seven ordered increments, A5b1–A5b7**, each locally
committed, verified and logged; stop at the agreed increment's boundary.
One increment may need further checkpoints if it does not fit a sitting.
Never mix extractor edits and engine wiring in one checkpoint.

| Increment | Deliverable and gate |
|---|---|
| **A5b1 — text extraction** | Inventory getText/direct message consumers; define text-program schema, preserve terminators, add missing source texts and canonical full blocks, extract audited wrappers. Setup twice identical; independent ROM/ASM program fixtures; temporary compatibility keeps current runtime working |
| **A5b2 — sprite-set extraction** | Define/export map sprite metadata and generate it. Assert outdoor split selection, indoor picture classification/tile counts and representative close fixtures; setup twice, unchanged unrelated outputs |
| **A5b3 — required audio extraction** | Add only confirmed missing key-item/PC SFX using the existing audio schema. ASM/header fixtures and actual interpreter duration tests; existing assets unchanged. No engine wiring yet |
| **A5b4 — execution and close** | Text command runner, retained display-session contract, exact close, explicit sprite updates and input/transfer ownership; wire MapDialogue and existing pickup primitive adapters. Typecheck, full tests, browser talk/pickup regression |
| **A5b5 — existing story handlers** | Pallet, Lab, Mart parcel, Mom, Daisy, Route 1, Viridian, nurse; migrate grouped calls and bubbles. Focused command/frame traces, fresh-game through parcel/Pokédex, healed/no-starter/decline cases |
| **A5b6 — school, town map and speech** | Notebook, blackboard, town-map sign, standalone intro calls and naming handoffs. New-game plus all school choices and town-map return verified; log the agreed cry limitation |
| **A5b7 — menu messages** | Shop, current field item/party questions, player PC/Pokécenter PC/Bill's PC, save; common static glyph rendering. Finish caller inventory, compatibility/deferred-caller list, docs and full regression. Any extractor/alias cleanup is its own verified data checkpoint before or after engine wiring |

The planning commit does not approve these architectural additions or begin
implementation. After user acceptance, record the split/schema/scope decision
in DECISIONS and claim A5b1. Sol can continue implementing; recommend Claude
review after coherent runtime checkpoints and at completion. Reviewer work
is a later session, not a spawned agent during this planning task.

## 7. Verification

Tests must distinguish cartridge behavior from the current implementation.
Use ROM/ASM-derived expected command sequences, visible-buffer samples and
frame events rather than assertions mirroring helper outputs.

- Extraction: exact terminators and wrappers, full choose-mon/parcel/notebook/
  PC blocks, missing blackboard texts, dynamic operand formats, FAR return
  after prompt, no unknown-byte truncation, canonical symbol addresses.
- Core: done vs prompt vs @; command promptbutton/waitbutton vs string prompt;
  pause's single read and dots' ten frames; cursor continuity; no-delay mode;
  audio wait without Joypad reads; owned-box/global read isolation; BG updates
  during retained waits, once per enabled frame.
- Lifecycle: one initialization per handler, nested PrintText three-frame cost,
  no-box Lab bubble, auto-box flag, silent outer wait/suppression, held-A Hold,
  immediate window hide with frozen world, disabled transfer phase, exact
  close counts, restored facings and final UpdateSprites once after font clear.
  Test hidden/deduplicated/live picture IDs and Route 2 split selection, not
  only a hardcoded elapsed timer per map.
- Caller regressions: first Oak bubble has no extra press; snatch is one
  display/five prints; questions go directly to menus; received items appear
  at source time; notebook decline/page 4, blackboard loop, town-map exit,
  speech final done, save automatic return; A1b pickup timing assertions gain
  only the newly modeled opening/close costs at their defined measurement bounds.
- Gates for runtime increments: typecheck, ROM suite at least 963 plus new
  tests, no-ROM suite, build; update baseline counts only after running them.
  Data increments also run setup twice, compare all bytes and inspect the
  generated diff. Static-export tests must include the new JSONs.

For visible increments, smoke-test on an isolated spare origin, leaving the
user's `http://127.0.0.1:5173/` save untouched. Clear temporary saves and stop
the spare server. User play-test at :5173: A = **Z**, B = **X**.

Recommended final play-test groups:

1. New game: naming, speech ending, Oak warning/!, lab choose/snatch/receive,
   rival battle return (battle presentation itself is still A5c–e).
2. Mom, Route 1 sample/follow-up, parcel delivery/Pokédex, Daisy success/full
   bag, conditional Viridian talk and both old-man demo paths.
3. Nurse yes/no and repeat visit, Notebook all pages and early exits,
   Blackboard all statuses including burn, town-map sign and return.
4. Mart buys/sells/failures/quit, supported item use/toss and cancel paths,
   PCs deposit/withdraw/release refusals and returns, save yes/no and CONTINUE.
5. NPC/sign/Forest trainer text and pickups still work; walk away after closing
   indoors/outdoors, hold A and release, check no stray beep or stale arrow.

## 8. Decisions for the user (recommendations first)

1. **Seven increments in §6**, with data before wiring; rather than trying
   to combine the entire A5b scope into one or two sessions.
2. **Add the two strict extracted JSONs in §4**: text programs and sprite sets.
   Keep ordinary strings and the approved control encoding in game_text.json.
3. **Add only required key-item/PC sounds now**, wire already-extracted menu
   sounds, leave unrelated audio work in V5.
4. **Keep full cry implementation in J2**, explicitly log OakSpeech's remaining
   cry playback/wait gap; or separately plan that prerequisite if wanted now.
5. **Sol implements, Claude reviews**, then the user play-tests. A5c waits for
   A5b acceptance, implementation and verification.

Previously approved choices (A5 order, contractions, third-frame display,
30/30 blink, species names V5, wild catch A5f) are unchanged.
