# Battle System Architecture

## A5e foundations — current through 2026-11-06

**02/03a/03b, 04a and 04b are accepted; checkpoint-04 closed 2026-11-04 after the user's play-test. Checkpoint-05 (poof data) is accepted (note 80 §6, 2026-11-05). Checkpoint-06a is accepted (note 81 §7). Checkpoint-06b is accepted (note 81 §10), closing checkpoint-06. Checkpoint-07 (the live send-out poof) is closed: accepted (note 82 §8) and play-tested (§9), 2026-11-05. Checkpoint-08a (`MinimizedMonSprite` data) is accepted (note 83 §7). Checkpoint-08b (picture variants) is accepted (note 83 §10). Checkpoint-08c (live picture cues, the session-local registry, and the debug move editor) passed Codex code review (note 84 §9) and the user play-test (§10, 2026-11-06), closing checkpoint-08.** Checkpoint-09 passed Claude's review (note 85 §11) and the user's full A5e play-test (§12), **closing A5e** (2026-11-06). Source status comments were corrected; no executable code changed. Suite **6131 ROM / 5854 no-ROM + 277 skip**, 243 files. Bundle `index-CW6CErI9.js`, 670,718 bytes, SHA256 `0f66990479c1be52952236a1345155e1ce2d93ff28601ec8ba9c5dee582d2bca`. Notes75-77 retain the earlier contracts.

| Owner | Behavior / reachability |
|---|---|
| `battle_intro.ts:prepareSilhouetteBackground` (02) | Live LCD-off-only transaction: existing full HUD load, clear32×32 BG0, copy20×18 with32-column destination stride. No yields or changes to CPU map/window/OAM/transfer phase; caller owns head clear and LCD transitions |
| `BattleScreen.scxAfterSplit` / `battle_screen_render.ts` (03a) | Shared live code, new capability disabled by default. With a split: top0–63=`scx`, body64–95=`scxSplit`, lower96–143=`scxAfterSplit ?? scx`. Null split ignores both overrides; explicit0 is valid. Window/OBJ remain independent; the live intro enables the field |
| `battle_intro_program.ts:battleSilhouetteIntro` (03b) | Live source-order Program through existing opening-text handoff:14-frame back/head load, LCD-off transaction, prefix,72 split iterations,21 pending head X−2, flipped body restore, palette and Y-only HideSprites |
| `battle_intro_timing.ts:BattleIntroTiming` (04a) | Bound by battle init through the session. `POST_VBLANK_LY` is 146. A serviced boundary anchors there; a held boundary stays at 144. `disableLCD` waits for LY 145 and yields that crossing as one `'serviced'` frame. LCD-enable anchor is 0. Physical rSCX stays separate from hSCX and the captured bands |
| `battle_intro_raster.ts:IntroRasterCapture` (04a) | Session-owned `IntroScanout`. One 160×144 buffer. `to` copies each new row once. `compose` keeps rows `[0, cursor)` and takes the rest from the injected live render. Cursor 0, or no renderer, returns that live buffer. While off or in the skipped first frame, compose returns fresh opaque white; endFrame closes the skipped frame |
| `battle_host.ts:bindRaster` (04a) | Bound by init through the production session. While bound, `step` runs `boundary` and then the existing serviced VBlank and audio. A held frame is boundary only. Dark frames run boundary without seal/latch, VBlank or audio; pendingFrame exposes the next frame. A `'session'` frame throws before any tick. `null` unbinds, including when nothing is bound |
| `rom/extractors/battle_animations.ts`, `battle_animations.json`, `audio/sfx/ball_poof.json`, `ball_toss.json`, `tink.json` (05; A5f checkpoint-01) | Data only. A5f checkpoint-01 adds `TOSS_ANIM` `$C1`, `SHAKE_ANIM` `$C2`, `POOF_ANIM` `$C3`, `BLOCKBALL_ANIM` `$C4`, `GREATTOSS_ANIM` `$C5` and `ULTRATOSS_ANIM` `$C6`, each one sub-animation command, plus Audio 2 `SFX_BALL_TOSS` and `SFX_TINK`. Nothing reads the new IDs or sounds yet. The session still reads `POOF_ANIM` and `SFX_BALL_POOF` since checkpoint-07. 06a: each sub-animation's `pointer`/`address` (the `wSubAnimAddrPtr`/`wSubAnimSubEntryAddr` sources). 08a: `minimizedMonSprite` |
| `battle_subanimation.ts` (06b) | Live through `moveAnimation`'s ON branch for the send-out `POOF_ANIM`, and through `TossBallAnimation` since A5f checkpoint-03. Shadow OAM through `D07C` (`wPartyMenuTypeOrMessageID`, the 79-tile count), `D080`/`D081` and `DEF4` (shared with the HUD poké-ball OAM), `D083`, `D085`, `D086`, `D088`, `D08A` (`wSlideMonDelay`), `D093`, `D095`, `D09B` (high byte first), `D09D`, `D09E` (`wSlideMonUpBottomRowLeftTile`), and `hROMBankTemp` (`$FF8B`, `hBaseTileID`). The move-animation atlas is copy-on-write, 8 tiles per VBlank, and stays after the poof. The ledger is 40 frames: 10 copy frames, then 6 blocks × 5. A5f checkpoint-03 makes the toss, shake, poof and block animations live through the session's shared host, including the toss and tink sounds preloaded as Audio 2 IDs `$91` and `$8C`. The ball path plays whatever the animation option says. `BLOCKBALL_ANIM` has no special effect |
| `battle_move_anim.ts:moveAnimation` (07) | `TOSS_ANIM` reaches `TossBallAnimation` before the option check; its sub-animations use the same session host as the send-out poof since A5f checkpoint-03. Otherwise, `ShareMoveAnimations` on the enemy's turn (`AMNESIA` `$85` → `CONF_ANIM` `$BF`, `REST` `$9C` → `SLP_ANIM` `$BD`), then `PlayAnimation` only for an id in `battle_animations.json` (`POOF_ANIM` `$C3`). Every other id keeps `delayFrames(30)` (#94). `PlayApplyingAttackAnimation` runs after both the ON and OFF branches, so a stale `wAnimationType` still plays, silently when `wDamageMultipliers` is 0 |
| `battle_pic_variants.ts` (08b, live since 08c) | A composed `wTempPic` becomes a new immutable `wTempPic#<n>` entry in the session picture map (the doll from `monster.png` tiles 0–7; the blob from `minimizedMonSprite`). `ChangeMonPic` ends with `SET_PAL_BATTLE` (2 held + 3 serviced). Departures: MissingNo has no committed header, so `GetMonHeader` throws `BattleUnsupportedState` before the Rhydon trap; that port zeroes `wMonHSpriteDim`; composed keys persist until the session is disposed |
| `battle_session.ts` picture host, `debug.ts` / `debug_battle_view.ts` (08c) | One session-local render-tile object and picture map. `monster.png` is decoded once with the other session assets. Hide/reshow, OFF Substitute/Transform, the STATS reload, substitute break, and the exported crash shake (`B=4`, 36 frames, WX=7) call the accepted helpers. Battle `updateSprites` stays a no-op because init stores `$FF`. Outside battle the debug panel replaces party moves; between turns it pokes exactly eight enemy move/PP bytes |

Capture the prior raster before a serviced VBlank's scroll latch, BG transfer and OAM DMA. The CPU resumes after that handler, so the serviced anchor is LY 146 (`POST_VBLANK_LY`). Values 146–153 are equivalent for this Program's waits (64, 96 and 145). A held boundary stays at 144 because no raster wait follows it. `DisableLCD` (`home/lcd.asm`) clears rIF, masks IE.VBlank, waits for LY 145, turns the LCD off and restores rIE. It does not clear IME. IF latches the request while it is masked, and restoring IE services that pending VBlank as one ordinary serviced frame. Palette-held frames still get their manual `UpdateAudioDuringLoadBGMapAttributes` update. The timing object does none of those ticks itself.

The last slide iteration ends at LY 96: `IntroRasterCapture` keeps rows 0–95 from before the window opens and takes rows 96–143 live. hSCX ends at 2. Physical rSCX stays 0 until the next serviced latch. Sealed frames are not stored. `main` presents `compose` while the session exposes introRaster. The presentation copies the composed bytes into an ArrayBuffer-backed array for ImageData (note79 §8.13).

The session starts with BGP = OBP0 = OBP1 = $FF, inheriting BattleTransition_BlackScreen's final
registers (init_battle.asm:39/64); the transition itself uses the overworld renderer (§8.14).
Init binds BattleIntroTiming at POST_VBLANK_LY and unbinds in finally after the opening text. One session
capture presents the live intro; the interim slide is retired. The Program yields two consecutive dark ticks
after the deferred VBlank. LCD-off and the skipped first enabled frame present white (three consecutive
presentations). Dark ticks do no VBlank or audio, including main's audio tick. DIV still advances.
The init/start/Route1/pixel audits precede their snapshot updates (note79 §9). Attack move animations stay
OFF (#94); battle VBlank Random remains backlogged. The user's play-test passed on 2026-11-04.

Older dated checkpoint sections below are historical records: their "unused until A5c3f" wording does not describe
the now-live battle engine. Checkpoint-09 removed stale status wording from the source headers. Use this section,
STATUS and the current code for the restart point.

## A5c3f checkpoint-11f: fixture writers and decoder retirement

`PartySlot`, `partyTypeByte`, `partySlotFromPokemon`, `writePartySlot` and `mirrorPartyProgress`
live only in `src/test/party_slot_fixture.ts`, with their recorded byte layout unchanged
(zero padding after `@`). Production writes through `battle_party_codec.ts`; a test guards
against production imports of `src/test/`. `statusByte` and the loaders' `MON_PP` stay in place.
The unused `battlePokemonFromPartyBytes` and `decodeNick` helpers are removed; tests use the
codec and `decodeBattleText`. `W_SPRITE_FLIPPED` is the sole flip-address name; INIT no longer
aliases it. No runtime behavior or existing ledger changes. Note72 §10.33.4.

## A5c3f checkpoint-11e: production carries

`audio/low_health_alarm.ts` owns $D082 and $CCF6; `BattleState` has no duplicate cells.
Medicine uses public `BattleScreen.setPalPartyMenu()`, `PartyMenu.itemCursor` and `updateItemUse`.
The palette command installs MEWMON/GREENBAR/YELLOWBAR/REDBAR before its existing 2 held + 3
serviced waits (LCD off: no waits). `loadMonData` remains in `battle_experience.ts` to avoid a
loader/move-data cycle. Trainer move selection reads WRAM directly through
`AIEnemyTrainerChooseMoves(state)`; `TrainerMoveSelection` and its object adapters are gone.
PartyMenu retains overworld, useItem and battle_choice modes. The three-line `bindPlayerSwitch`
binder stays; its raw-species carry was already closed in checkpoint-07c. Note72 §10.32.

## A5c3f checkpoint-11a: RUN odds

`battle_menu.ts`'s CPU-only `battleRunOdds(state)` reads the active speed words and the
already-incremented attempt byte. It uses the shared HRAM Multiply/Divide ports; only the
final compare consumes one BattleRandom. Early escapes consume none. No hEnemySpeed cell
exists in the state, so that word stays local. The session closes runOdds over its state.
`run.ts`, its11 old tests and cartridgeRunOdds are retired; the verified manifest and
replacement coverage live in run_retirement/battle_run tests. Note72 §10.28.

## A5c3f checkpoint-10c: send-out pictures and ball BG steps

The session's entrance/send-out/slide cues are Programs on its existing BattleScreen.
Starter Pikachu places eight overlapping column steps at (0,5), two frames each.
AnimateSendingOutMon shares the retreat's downscale tables, uses hStartTileID/hBaseTileID,
waits3/4/5 and writes the full column-major pic, including wSpriteFlipped's column order.
Both slide-offs take eight three-frame steps; the enemy subtraction/comparison bug remains.

battle_ball_animation ports TossBallAnimation's item choice, nybbles, sequence and trainer branch.
HIDEPIC and SHOWPIC use the shared auto-BG-transfer model and Delay3. The sole
ballSubanimation(id) cue defers OAM and its move sounds to A5f, taking zero frames.
The trainer block uses the existing BattleAudio/faintThud owner. Cries remain silent (#83).
Substitute/Minimize/Transform stay A5e carries. No turn, item-body or codec changes.

Presentation waits move frame-driven DIV. Note72 §11.67–§11.69 govern value-only ledger
updates and ASM-derived test clocks. Misty's pinned DIV40 proof checks two per-mon AI
uses, their positions and texts, and the actual EnemySendOutFirstMon FF reset writes.

## A5c3f checkpoint-08f: catch homes, awaiting Claude's check

The unused session has a separate once-only loadBattleStandInData beside loadBattleSessionData.
It shares one PokedexMenu and preloads that page, ED and party icons. Both stand-in homes
throw BattleUnsupportedState('stand-in screens not loaded') until ready;09 awaits both loaders.
The ball uses the existing addPartyMon/sendNewMonToBox ports, with AskName's actual YES/NO.
The naming adapter handles the ASM white/clear entry and exit, byte writes, HUD reload and
bit6; its non-null keyboard cells overlay wStringBuffer before the full11-byte copy.
The dex adapter converts the internal species to dex, reads battle-owned bytes and preserves
the name/header side effects. It owns the animation save/zero/restore, bit1, facade fade flag
and NR50 $33/$77 around the page. abort during dex or STATS clears the flag and restores $77.
Foreground gains naming/pokedex only during their loops; outer frames remain battle. The
session exposes both screen objects for09. No live caller or bundle change. Note72 §10.17.

Checkpoint-08e extracts the unchanged bag Proxy into exported bagBackedContext(context,state).
Its direct pin covers fresh byte reads, write rejection and passthrough keys. A new real-input
abort-mid-item case probes random.attach(new BattleState()) after abort, proving detach.
Both §11.36 escape mutations now fail plain assertions. No other session change; note72 §10.16.

## A5c3f checkpoint-08d: menus, checked in §11.36

The unused session has one PartyMenu whose optional text host is the same object used by
BattleMenuScreen. The default field callers retain their behavior. A session-only subclass
observes show/showForItem for the foreground: party/partyItem on opening, battle on either
host buffer reload, status while the default statusView is set. Main presents this in09;
no renderer code or additional foreground exists. loadEnemyPicVariant is an A5e cue.

The battle context Proxy decodes bag count/pair bytes freshly through readBagEntries; writes
to its bag property throw. The same decoder supplies the absolute outcome. Each useItem
registers the short/flute/medicine/PP/ball bodies inside try/finally and disposes in reverse
order, including after partial registration failure. No bodies are held between uses. The
medicine environment is built once per session; the flute stream is fetched once. Ball homes
still throw08f. abort releases an interrupted registration, random and audio hooks, then
rejects all further operations. Finish also releases registrations.

Item0 pins the20-byte end-name binding helper and the exact Misty environment count2. The
new16-case suite uses real two-frame input with rendering output mocks. All10 menu mutations
and both item0 mutations fail plain assertions. Typecheck/build and ROM6137/6137 pass;
no-ROM5886/250 skip plus the known Pewter timeout, passing1/1 alone under §11.16. Bundle
index-CTDQDkp0.js changes only through PartyMenu's constructor seam. Note72 §10.15.

## A5c3f checkpoint-08c: trainers (checked)

The unused session now supplies a world-keyed, byte-reading `TrainerMoveSelection` and the real
TrainerAI environment (screen, item/text/send-out owners and existing A5e presentation cues).
`handoffs.trainerEnvironment` counts reads of items/text/sendOut; wild calls still read none.
`BattleWorld.endBattleText` carries committed win/lose labels and writes bit7 of `$D72C`.
PrintEndBattleText tests/clears that bit, runs SaveTrainerName, prints TrainerEndBattleText through
its same-screen ASM continuation, and waits on the session's own audio. The saved-label selector
retains both result branches; the lose branch is unreachable through TrainerBattleVictory.
SaveTrainerName uses the 47-row name-pointer table and copies through @ without clearing its tail;
the nameBuffer binding decodes up to20 bytes with the full charmap. Menus still throw08d.
Main's end-label sources and SetEnemyTrainerToStayAndFaceAnyDirection remain checkpoint-09 carries;
the adapter retires in11. No live wiring or snapshot changes. The retirement importer manifest
now includes the session under §11.33's one-row exception. Typecheck/build and both full suites
pass;08c was checked under §11.34. Note72 §10.14.5–9.

## A5c3f checkpoint-08b: core fixes, awaiting Claude's check

`battle_session.ts` remains unused: cached startup assets, session-owned bank08 text IDs,
counted DIV/retained HRAM, byte-first setup and party refresh, one-step tick, absolute outcomes
and audio-hook disposal. Its private BattleMenuScreen supplies TextBox's optional sound owner;
shared TextBox defaults retain facade behavior. Wild win/blackout/RUN and level-up text pass
through real input/engines. The actual checked TrainerAI owns the wild/link return (08c now provides
the live trainer environment). Session traces pin one zero-frame/carryfalse call per wild enemy turn
with no environment access. The faint loop encodes blackout carry in its exit, decoded by finish.
The loader pins44 once-only fetches with main ready (47 cold) and358 once-only decodes. Raw trainer
tables preload through fetch/the main data cache in battle_trainer_data, without state/address-map
imports; the synchronous species provider builds identical headers from those tables. The shared
preload also prepares unchanged legacy move-table callers, without racing main's table loads.
Map tilesets are fetched from the committed map inventory and resolved through all25 header rows;
unknown map/tileset names throw. The approved live bundle remains unchanged. Main wiring waits until09.

RNG timing: F comes from the page's frame counter; t counts the actual random paths, resets when
F changes, and readDIV samples floor((70224*F+t)/256)&255 before adding its own12 T-cycles. The
single cited battle_random_cycles table gives direct Random408 cycles and non-link BattleRandom448,
whose samples occur at220/264. Caller instructions between draws and other frame work are the
one ruled approximation. Optional cycle hooks preserve existing fixture DIV behavior and detach
with the random owner. No wall-clock RNG or saved HRAM.09 supplies frames() and resolves one global
text-speed owner. Note72 §10.13 holds12/12 plain mutation proofs, the bounded old-clock battle
control and the permitted roll-only ledger audit;08a's18 proofs remain in §10.12.08c owns trainers
and end text;08d owns the item registry/abort, shared menus and PartyMenu's optional text host (§11.32).

## A5c3f checkpoint-07c: unused party refresh (awaiting Claude)

Party bytes are authoritative; `state.partyMons` is only the shared menus' presentation cache.
`battle_party_codec.ts` holds the low-level codec and in-place `refreshPartyMon` / `refreshPartyMirror`:
only changed fields are assigned (species by identity, aggregates structurally), without byte writes,
RNG or frames. The bridge re-exports the codec and keeps world/box handling; the codec never imports
its high-level consumers or D/I address tables. Existing byte-first writers refresh occupied slots;
the catch creates its slot. Send-out/use-item openings and `bindStateBattlePartyMenu` refresh the cache
before menu consumption, covering defrost and flute writes too. Party selection reads the internal
`partySpeciesList` binding, so STATS/refusal and SWITCH all keep raw species bytes. Fixture writers
remain until11;08 owns the initial refresh and the new binder, with no post-EndOfBattle refresh.

## A5c3f checkpoint-07b: unused world inputs and outcomes (awaiting Claude)

`BattleWorld` snapshots owner values; `writeBattleInputs` writes only battle WRAM. Load the committed
map-id table with `loadBattleBridgeData` before entry. Options pack the exact text/style/animation bits;
money uses the shared three-byte BCD codec. Bag order and quantities survive, with a hard20-entry limit.
Only the selected PC box is encoded; the shared mon prefix gives lossless33-byte box records and raw names.
The party codec still owns the44-byte party records. No party mirror refresh is installed here.

Only INITIAL_CATCH_TRAINING and MET_BILL become event bits. No event flags are returned:08 leaves the
live string Set untouched. `readBattleOutputs` must run after EndOfBattle and returns absolute values,
including prize/Pay Day, happiness/mood and the raw emotion modifier.08 must not re-apply happiness;
it retains the modifier across battles.10 owns its save, boxed metadata losses and complete flag mapping.
The module stays outside the live import graph; all old tests and snapshots are unchanged.

## A5c3f checkpoint-07a: unused party codec (checked)

`battle_bridge.ts` owns the lossless 44-byte party record plus raw 11-byte OT/nickname buffers,
and the explicitly lossy live-object adapters. Record encoding does not interpret names or species.
The shared `POKEDEX_ORDER` maps all190 internal indices; raw records preserve MissingNo gaps and
the live adapter refuses them. PP maxima follow DIV5, bonus cap7 and final AND3F; deriving Ups refuses
ambiguous/impossible maxima. The old adapters remain in place for checkpoint07c, then retire in11.

`battle_text_codec.ts` is the strict charmap boundary, split out to avoid a bridge/state cycle.
All production decodeNick callers use it; the old export remains for old tests until11. NULL throws
the ruled unsupported-state error. HUD nickname getters defer reads until placement; the real04
palette path is covered by a fresh failing-first regression. Names now retain lowercase and gender
glyphs; 24 audited old snapshots changed only names/cells/downstream hashes. Neither new module
is reachable from the running game. Object losses and all13 mutation results are in note72 §10.9.12 onward.

## A5c3f checkpoint-06: unused picture pixels (awaiting Claude)

Checkpoint-07a item0 puts the canonical `W_SPRITE_FLIPPED` in `battle_state.ts`; `INIT.wSpriteFlipped` is only an
old-test compatibility alias, carried to11. The unused party codec and strict decoder are described above.

`battle_pictures.ts` builds front7×7 boxes and scaled backs from decoded committed PNGs. Fronts use the dimension
byte's floor-centered columns and bottom-aligned rows; ghost forces66, trainers77. Backs keep source0..27 on both
axes and duplicate2×2. `loadBattleRenderTiles(decode)` names all358 PNGs (352 pictures plus font/HUD/balls), reads
trainer picture metadata from committed trainers.json, and uses one pure RGBA conversion. `battle_picture_decode.ts`
is the isolated browser canvas adapter; the core never fetches or uses canvas. No browser scaling or extraction.
Each copied tile retains orientation separately from the existing slot descriptor. Front flip reverses pixels within
each tile; the existing tilemap reverses columns. Synthetic flipped backs reverse source nibbles before scaling and
swap output nibbles after it. Normal reachable battles leave the flip flag0. `BattleScreen` owns independent sprite
picture slots00–30, filled during the second back copy; the renderer uses them before the fallback sprite atlas.
Balls remain atlas tiles31–34. Existing fixture slots, clocks and old snapshots stay unchanged. Note72 §10.8 records
the pixel assertions, mutation proofs and carry to retire trainer_flow.ts's live CHIEF mapping in checkpoint11.

## A5c3f checkpoint-05: unused move animation, OFF path (awaiting Claude)

`battle_move_anim.ts` fills the existing animation port with `moveAnimation(state, host)`. Until A5e it always
takes the non-SGB OFF path, including when options bit7 is clear. It owns the waits, animation palettes,30 frames,
type0–6 applying animation and byte cleanup. TossC1 remains an A5f cue; the existing ball constant is unchanged.
The outer `playMoveAnimation` still owns Delay3 and the12-frame refresh. Hit sounds use the committed damage,
not-very-effective and super-effective streams through `BattleAudio`, with source frequency/tempo modifiers.
`BattleScreen.bindWindowRegisters` binds views of hWY and the WY-update hold flag; serviced VBlank copies the
shadow when the hold clears. Vertical/horizontal mutations retain the decreasing-pass quirk. Blink flips turns,
clears the target7×7, copies the source column-major tile IDs and re-enables automatic BG transfer before Delay3.
Note72 §10.7 records item0's five mutation checks, the14 new mutations and18 own animation ledgers; the old rig and
all old snapshots stay unchanged. The production import guard includes the new module.

## A5c3f checkpoint-04b: unused StartBattle through the restores (awaiting Claude)

`battle_start.ts` composes `initBattleAfterTransition`, the new `startBattle`, the existing turn/faint/end owners,
and `_InitBattleCommon`'s ordered flag/palette/tile-animation restores. It returns the loop exit and final carry;
checkpoint-08's session still owns random-state detach. The Safari branch uses the existing menu and real item
bodies, committed text programs, and raw `Random` (carry1 only on escape doubling overflow).
The enemy HP scan walks by44 with D starting3, stopping before `ENEMY_SCAN_MODELLED_END=$E000` under note72 §11.9;
this explicitly models the memory boundary, not a cartridge rule. Link stays unsupported. The production import
guard includes the new module. Its independent20-test suite has16 composed ledgers; the old rig stays unchanged.
Note72 §10.6 records the16 mutations and the ASM-proved Safari pseudo-item alias fix in the unused item binder.

## A5c3f checkpoint-04: unused battle start (awaiting Claude)

`battle_init.ts` separates `setupBattleBeforeTransition` (WRAM and pre-transition wild DVs/trainer party, no frames
or music) from `initBattleAfterTransition` (first frame at the full HUD load, ending before StartBattle). The returned
saved map-palette/letter flags are for checkpoint-04b's restore. `BattleRandomState` attaches the retained HRAM/DIV
to each state and detaches after the battle; its owner outlives states. Production lifetime/DIV remain checkpoint-08.
The interim slide keeps the 21-entry head, two seven-frame back copies, full tail and opening text; no scroll loop.
The host supplies the existing audio/voice/text owners, committed ball tiles and named picture/Marowak hand-offs.
`BattleScreen` exposes full/HUD-only copies, shadow OAM and its existing video queue; prior entry names still delegate.
Both new modules stay in the production import guard. Note 72 §10.4 records the ledgers, mutations and hand-offs.

## A5c3e: items, catches and trainer AI (unused until A5c3f)

The completed ports remain outside the running game's import graph. A5c3f owns their installation and the
user's play-test. `a5c3_unused.test.ts` guards that boundary; the production bundle is `index-DCGYEZm7.js`.
Notes 71 §10.17/§10.19 describe the composed histories. Neither legacy catch nor trainer-AI tests/callers
are removed here: `a5c3e_retirement.test.ts` records all 8/10 dispositions, six stale math titles and the
exact importer/export census. Keep `loadTrainerData`/`getTrainerClass` for story, encounter and sight data.

`battle_items.ts` dispatches the frozen 83-row item table and TM/HM refusals into an explicit body registry.
`battle_item_state.ts` adds byte views and exact-address aliases over the same WRAM, without new storage.
`battle_item_bodies.ts` owns X Accuracy, Guard Spec, Dire Hit, X stats, Poké Doll and Safari Bait/Rock;
medicine and PP items live in `battle_item_medicine.ts`/`battle_item_pp.ts`. The medicine environment reuses
the actual party menus, HUD, palette and stat loaders. Raw bag bytes own consumption/FF shifting, with an
object mirror for existing menus. Failure, stat cap, happiness and active-versus-roster asymmetries follow ASM.

`battle_item_flute.ts` and `battle_flute_audio.ts` reuse the existing Audio 2 engine, including the approved
pending-stream replacement on `SfxEngine`. The flute polls the actual channel IDs; it has no alternate frame
owner. `battle_random.ts` supplies raw `random(state, carryIn)` separately from BattleRandom's CP carry/link
list. Bait/Rock, balls and TrainerAI use the raw source path. `PlaySoundWaitForCurrent` pre-waits for the old
sound, starts the requested sound, and returns; Full Heal text begins while its new sound is still playing.
Trainer Potions request no item sound (the retained printer still owns button acknowledgement sounds).

`battle_item_ball.ts` owns throw gates, byte-rejection RNG, catch arithmetic, shake animation and consumption.
`battle_add_mon.ts` owns party/box homes, owned/seen flags and the nickname question. The catch environment's
dex-page and naming-screen programs remain explicit presentation ports; party/box bytes and the real YES/NO
owner surround them. The box object mirror is deferred to A5c3f. Item names use the general byte decoder,
including the accented POKé BALL glyph. Shared scratch such as `$D11D` and `$CD6D` retains its source aliases.

`battle_trainer_ai.ts` ports all 47 class rows, gates, item routines and real switching. Its carry return
consumes the enemy's turn. Count0 returns before Random, FF loads the class count, and EnemySendOut resets
FF without a switch decrement. The four-byte switch write-back includes the party-position byte; first-mon1
suppresses SHIFT during the AI send-out. X items save/restore Num/Effect around the actual stat routine.
`battle_ai_moves.ts` owns class modifications1–3, six-byte ReadMove writes, type lookup and minimum filtering;
`battle_math.ts` owns the selector and its rejection bands. Encouragement is read here and incremented only
on ExecuteEnemyMove's entry; modification2 runs exactly at1 and draws no RNG.

The two composition seams remain `host.useItem` (via `bindBattleItems`) and `TurnPorts.trainerAI` (via
`trainerAIBuilder`). `test/battle_ledger_rig.ts` opts into real ports with `History.real`; trainer fixture
headers/rosters and observations are separately opt-in. The 26 A5c3d and 18 player-item ledgers stay unchanged.
The 14 trainer histories retain timed text/RNG/WRAM/audio and end resets, with explicit assertions independent
of snapshots. Hooks delegate to the actual selector, HP bar, stat effect, send-out and Counter routines.

Preserved Gen 1 quirks include Counter reading the last scoring record and stale shared damage after an AI
item skips the selected move; Full Heal retaining quartered speed; Cooltrainer F's dead 25% gate; type
effectiveness default `$10` rather than decimal10; first matching dual-type row rather than multiplication;
and Lorelei's Dewgong roll only after a matching row, with `<$66` retaining that default. Card Key compares
the pinned ROM opcode `$CD`. These behaviours are deliberate; do not normalize the scratch or reload the
selected move after scoring.

A5c3d checkpoint-08b adds test-only whole-battle ledgers (`battle_whole.test.ts`,
`test/battle_ledger_rig.ts`) through the real loop/end, turn/effects, faint/EXP, send-out, menu, text,
video and audio owners. Snapshots retain timed frame/RNG/text/audio/WRAM/mirror histories; deferred
AI/item/animation/voice/evolution bodies remain named hand-offs. A prior-award level-then-run history
uses real GainExperience before the loop because a wild faint cannot legally continue. The executable
26/17 manifests in `end_retirement.test.ts` preserve per-case dispositions, replacement titles and a
legacy-helper caller/export census. Both old suites and all production source stay unchanged.
Implemented 2026-10-24 and checked (note70 §9.29, §9.30): **A5c3d complete**.

A5c3d checkpoint-08 adds unused `battle_end.ts` and `battle_loop.ts` (approved08/08b split, note70 §9.2
item7). EndOfBattle collects packed Pay Day money only on result0, before its text, then clears ForceEvolution,
yields to the existing evolution hand-off and applies the living-starter mood floor. Its reset uses the
authoritative alarm/CHAN5 owner and saved-menu owners, clears exactly the source battle status span,
sets cooldown, waits on remaining sound, whites registers and writes warp$FF. CHAN5 ID clearing does
not perform sound_ret or hardware muting; the disabled flag and other sound IDs remain source-owned.
The existing packed-money codec is exported from the unused faint module for reuse. Blackout's full
ClearScreen now keeps its source Delay3; four additional faint regressions close §9.26's gaps.
The driver consumes MainInBattleLoop labels and FaintExit results using a flat generator loop, forwarding
the same state/context/host/ports. EndOfBattle remains _InitBattleCommon's separate call after every
normal return, including blackout. Both entries enforce the existing screen binding. The import guard
lists all16 A5c3d modules. Whole-battle ledgers and executable26/17 retirement manifests remain08b;
note70 §9.27 records this checkpoint's entry/unit contracts, mutations and gates.

A5c3d checkpoint-07 adds unused `battle_faint.ts`: both faint handlers, enemy/player removal, blackout,
trainer victory, victory music and EnemyRan. Handlers return `loop`/`end`/`blackout` for08's driver;
they compose the checked chooser, enemy replacement and real EXP/learning Programs. Double-faint order,
source Bide-byte quirks, suppressed duplicate player removal and EXP.ALL's two passes remain intact.
Audio uses the existing alarm and BattleAudio IDs/modifiers; fall polls CHAN5, thud waits normally,
and victory calls the existing StopAllMusic/music owner then Delay3. A byte-counter trace pins fall9,
thud pulse17/noise31 after the bridge; the old pre-bridge17-frame fall measurement is not a golden.
V1c's victory ordering, music rule and post-picture delay are rehosted on committed text and real
palette/copy/scroll Programs; packed money uses the existing saturated AddBCD helper after its text.
The retained PrintEndBattleText prefix/selected program stays the approved injected map hand-off
(A5c3f/data extraction carry). Ordinary cry, PCM and EnemyRan's animation body remain approved cues.
No new audio/video clock, live import or generated data; note70 §9.25 records tests and gates.

A5c3d checkpoint-06b adds unused `learn_move.ts`: shared field/battle LearnMove, its full-set question,
single-spaced forget menu, HM refusal/retry, abandonment loop and success result. `bindLearnMove` fills
checkpoint-06's existing seam. Source party bytes own the selected move/PP write; the six-byte record
comes from the existing move-data cache, PP Ups reset, and an active in-battle learner copies all four
moves and PP even while transformed. The selected object move mirrors the raw write. Field and reserve
calls preserve the battle struct. No battle-only initialization or level-up state is required.
The existing formatter supplies the menu text; its new narrow host type changes no behavior. The adapter
also writes source wMoves/wMovesString and name scratch. Existing YES/NO, MenuInput, tile/Buffer1 and
retained text owners run the prompts. OneTwoAndText's yielding continuation calls BattleAudio.playSwap
inside the same print, then returns PoofText so both pauses and ForgotAndText retain the cursor. Bank02
field and bank08 battle jingles resolve through the same audio owner; no new clock or audio state.
Item0 regressions and mutation/gate evidence are in note70 §9.23. No production import.

A5c3d checkpoint-06 adds unused `battle_experience.ts`: GainExperience and its seven-byte in-place
division/low-word boost helpers, party LoadMonData, PrintStatsBox, the scroll-button wait and the first
exact-level learnset choice. It composes checkpoint-02's stat/growth routines and existing modified-stat,
penalty, badge, HUD, happiness, text, video and audio owners. A changed level runs one block at the final
level; reserve party writes stay separate from active battle writes, and transformed unmodified stats
remain intact. EXP/stat EXP and recalculated party stats mirror from the authoritative raw slots.
The existing header loader now writes an available growth byte; GainExperience rejects missing growth
data before CalcExperience(100). Older fixtures may still omit it. GrewLevelText uses the retained printer
and the audio owner's bank-relative sound port. The scroll wait calls its existing low-sensitivity input
owner immediately, yields serviced frames while waiting, restores raw blink counters and adds no press
sound. Town-map/CableClub callbacks remain with their owners. Shared LearnMove is a yielding B-result
port for06b; this module only chooses the first exact-level move, rejects duplicates and applies the
accepted starter Thunder/Thunderbolt mood. No production import; note70 §9.21 records tests and gates.

A5c3d checkpoint-05 adds unused `battle_send_out.ts`: the player send-out/retreat text handlers, raw
HP-prefix arithmetic, regular retreat tile writes, starter asleep scan, send-out, forced choose, use-next
dialogue, switching, and the A5c2 switch-port binding. It composes the existing picture/HUD/palette owners,
PartyMenu's choose-only sessions, audio/voice cues and retained text continuations. Session frames stay with
the party owner; these routines add no clock. The binding converts A5c2's object species IDs to the raw
party-list byte before the byte-based loader. Animation bodies and cries retain their approved A5e/J2 cue
contracts; the real outer waits,14-frame back copy and seven-frame retreat writes are present.
Note70 §9.17 records tests and the unchanged bundle.

A5c3d checkpoint-05b adds unused `battle_enemy_send_out.ts`: EnemySendOut/FirstMon, enemy replacement,
the SHIFT prompt and choose-only party retries. FirstMon preserves participation; EnemySendOut resets it;
an accepted SHIFT arrives on the enemy side before SwitchPlayerMon rebuilds the player bits. The existing
screen copy queue loads four committed Pokéball patterns into the renderer's sprite atlas in one serviced
frame (zero with LCD off); replacing its image reference invalidates the renderer's decoded-tile cache.
The same screen owns HUD/OAM writes, slides, palette holds and front-picture copies. The player module
exports its existing palette, sprite-clear and party-choice helpers for this composition; their bodies are
unchanged. No shared live file or production import changes. Link exchange still rejects at its source
branch; animation/cry bodies retain the same approved cues. Tests and mutation evidence: note70 §9.19.

A5c3d checkpoint-04 (note70 §9.7; awaiting check) adds six unused modules: `battle_end_state.ts` extends
address names with byte views over the same mem; `battle_end_helpers.ts` holds raw FlagAction/alive/faint checks;
`battle_two_option.ts` draws on existing battle tiles with wBuffer30, first read3 and answer15;
`battle_slides.ts` owns the free HUD-only2-frame entry, front/trainer/back7/7/14 copies, faint14, trainer2*amount
and return-scroll palette+7+24; `battle_pikachu.ts` gates identity with five OT bytes and applies source mood
assignments; `battle_voice_cues.ts` brackets cry with alarm owner callbacks and retains the PCM's3-frame prefix.
The two unused menu callers use HUD-only now; the live BattleScreen's full6-frame method is untouched. A narrow
unused adapter accesses its existing private HUD/copy storage. No second screen/VRAM owner. Audio/video/
Joypad/menu owner integration is still the later host's job; the raw cell view does not wire live owners.
Checkpoint-04b binds the post-PCM ID-clear callback to `BattleAudio.clearClipIds`, including real music-drum
occupancy. Its unused bridge shares CHAN5 with the alarm, reads cry/battle classification per raw pulse note,
and retains Audio1 across the yielding swap's preceding-SFX and completion waits. See note70 §9.13 and the
audio architecture. All these modules remain in the production import guard.

A5c3d checkpoint-02 (note 70 §9.3; awaiting check) adds live `BattlePokemon.statExp` transport only:
five words in HP/attack/defense/speed/special order, optional save/box fields, independent zero defaults and
copies at serialization/deposit/load. Existing EXP resets and live stat calculations remain unchanged.
Unused `battle_calc_stats.ts` shares the old b0 numeric body with b1's capped ceil-root bonus; it retains local
arithmetic scratch and CalcStats writes five BE destination words. Unused `battle_calc_experience.ts` preserves
six raw growth records, 24-bit underflows and a level search without a100 cap. Its SpeciesHeader provider must
supply optional `growthRate`; missing data rejects explicitly. `battle_loaders.ts` now packs OT ID/name, EXP
and stat-exp, then mirrors only the selected player object's identity/progress from bytes, without changing
stats. The production import guard includes both new calculation modules. Recalculation/EXP award wiring
and cartridge party-stat persistence remain A5c3f work.

Unused turn entry: `mainInBattleLoop(state, ctx, host, ports, trainer?)` in `battle_turn.ts` composes
MainInBattleLoop (note 68 §10.19). `ctx` is the existing `battleContext(state)` view with the caller's bag;
`host` combines A5c2's action/move hosts and forwards per-print runner options. The shared `hudContext`
adapter refreshes menu HUD views before DisplayBattleMenu without copying HUD logic. `TurnPorts` extends
`ExecutePorts` with TrainerAI returning carry and link SwitchEnemyMon. The optional trainer selection model
must match raw enemy move slots. The Program loops through full turns/cancels, returning `ran`, `escaped`,
`playerFainted`, `enemyFainted` or `enemyRan`. It neither services frames nor handles those later-slice exits.
A5c3f will import this entry, create/load the existing state/context/host, wire A5c3c–e's effect/item/AI and
faint/end handlers, and run the Program on the existing frame owner. LoadBattleMoveData/text programs and
the existing species/move tables remain startup prerequisites. No production import yet.

Unused execution: `battle_execute.ts` composes both ExecuteMove Programs, with helper routines/effect tables
in `battle_execute_helpers.ts` (note 68 §10.18). Entry returns `{ b, exit }`; status continuations resume at
their ASM labels, and only player Done clears the action byte. Effects and presentation are injected;
TrainerAI remains a later-slice port; `battle_turn.ts` owns the main loop. Numeric/hit/application routines live in their original
`battle_damage_asm.ts`, `battle_hit.ts` and `battle_apply.ts` modules. `a5c3_unused.test.ts` walks relative
imports from `main.ts` to keep all 14 A5c3b ports outside the running graph (notes 68 §10.18a, §10.19).
The player reloads the move before checking CHARGING_UP; the enemy release supplies the MOVE_NAME list
index/type/bank to `getName`, which writes NamedObjectIndex and loads the name before the string copy.

**A5c3c move effects (complete; ten checkpoints checked by Claude 2026-10-22; note 69 §10.20).** `battle_effects.ts`
holds the 86-entry `MOVE_EFFECT_POINTERS` and `jumpMoveEffect`. That throws on `$00`, the seven `NULL`s and an
unregistered label, and returns `b = 1`. Handlers come from per-family factories keyed by wrapper label:
- `statusEffectHandlers` (`battle_effects_status.ts`);
- `statEffectHandlers` (`battle_effects_stats.ts`);
- `turnEffectHandlers` (`battle_effects_turns.ts`);
- `hpEffectHandlers` (`battle_effects_hp.ts`).

Each handler is `(state) => Program`. Every effects animation runs Yellow's `SaveScreenTilesAndTransferBGMap`:
- **12 frames.** The blank goes to the hidden BG0 only.
- It's owned by `BattleScreen` (`refreshAfterAnimation`).
- Core `playMoveAnimation` adds its own `Delay3` first.

`MoveAnimation`, the doll hide / reshow, `AnimationSubstitute` and `AnimationTransformMon` stay CPU-only ports until
A5e.

Entry Programs bind their screen through `battle_screen_binding.ts`, so a refresh can't land on a lazily created
screen. The stat names come from the generated `data/stat_mod_text.json` (raw bytes, EVADE's overrun included).
`battle_effects_registry.ts` composes the four factories into one registry: 34 labels, no label in two factories. `composedJumpMoveEffect` binds that registry as the execute port. Two test files cover the composition:
- `battle_effects_composed.test.ts` runs all 86 ids through `executePlayerMove` / `executeEnemyMove` on both sides, at their note 69 §9.2 stages, with the §4 bug pins.
- `effects_retirement.test.ts` maps all 139 old `effects.test.ts` cases to ASM-backed replacements. A5c3f deletes `effects.ts` and `effects.test.ts` against it.

One known divergence: the extracted stat names keep only 4 bytes past `EVADE@`. So the unused `$4A` and `$4B` don't print the ratio and code bytes the cartridge does (backlog, J2).

**A5c3a state and plumbing (complete, checked by Claude 2026-10-20; note 68 §11.13).** `battle_state.ts` owns WRAM cells and the menu
views; `battle_loaders.ts` loads battle copies and writes party data at the cartridge's specific points.
`battle_random.ts` and `battle_math.ts` provide RNG, stats, damage-result and move-selection ports; the upstream
damage/effect bodies remain audit work. The text runner supports actors and per-print ASM handlers. Unused
`battle_host.ts` primes a Program once, then each `step` completes one frame: serviced = menu-screen VBlank
(including exactly one text tick), injected audio callback, resume; held/session = resume only. The session
already owns its frame. **The host owns no audio clock:** production's callback is a no-op because main's
`tickAudio` already owns audio timing; tests inject real `audioUpdate` through the audio rig on serviced frames
only. Neither the host nor the test-only composed load/HUD/text program is wired into the running game.

A5c3a checkpoint-04b corrects these unused ports (note 68 §10.11): set-damage effects and Counter keep neutral
multiplier `$0A`, with no STAB/chart walk or type-immunity miss. Palette views convert internal IDs to dex numbers
without writing `$D11D`; the palette command's real write remains the host's responsibility. Trainer selection
uses `aiEnemyTrainerChooseMoves`' WRAM candidate address, then the shared BattleRandom band loop, with disabled
and zero-slot retries. `wBuffer` at `$CEE9` holds byte scores (10, disabled 80), then minimum-score move bytes.
No modifiers return the original move list. Models must match WRAM moves; enemy PP does not affect candidates.
Only the unchanged modifier bodies are shared with upstream's still-working `selectTrainerMove`. The party
adapter now reads the loaded `getMove` cache. These ports remain disconnected from the running game.

A5c3a checkpoint-04 adds unused `battle_math.ts` and `battle_random.ts` (note 68 §10.10). `BattleState.random`
defaults to seeded BattleRandom with injectable `readDIV`; link walks/regenerates nine of ten seeds. Stat ports
use saved unmodified words, the exact 13 ratios, 999/1 limits and the pinned mod-0 ROM-byte wrap. Both unused
double/halve far routines are preserved, including 16-bit doubling overflow. `executeMoveDamageChain` keeps
upstream damage intact, writing result cells and deriving the multiplier byte from the **last** matching chart
row with the same string keys (Psychic bug retained). Wild move choice has 63/64/63/66 bands; trainer modifiers
delegate to upstream; link consumes an already exchanged nybble. Metronome rejection samples IDs 1–164 except
118. The party adapter now packs real internal species/type/move bytes from committed tables. `BattlePokemon`
has separate current/max PP and no packed PP Up bits. Nothing imports these ports in the running game; the
checkpoint-04 production bundle was unchanged. Damage/RNG order and quarter-effective floor differences remain audit work.

A5c3a CP3 adds unused `battle_state.ts` and `battle_loaders.ts`. `BattleState` is one WRAM cell per address; each ASM name is an accessor. A5c2's menu, action and party contexts are one view over those cells. `partySpecies` follows `SET_PAL_BATTLE`: a zero `wBattleMonSpecies` reads 0, otherwise the party species at `wPlayerMonNumber`. `curPartySpecies` is `$CF90`. `curItem` stays the item-name string, and `itemIndex` stays the bag choice. `LoadBattleMonFromParty` copies the box-level byte and takes the nick from `wPlayerMonNumber`. `LoadEnemyMonFromParty` then stores `wWhichPokemon` over that byte and does not boost badges. `LoadEnemyMonData` sends a link battle through the party copy; otherwise wild DVs are two injected random calls, the second stored first, a trainer uses `$98`/`$88` and the party's HP and status, and a transformed mon keeps the original DVs. It does not apply burn or paralysis penalties. `InitWildBattle` records the ghost picture (`GhostPic` `$6920`) and writes six nick bytes, `GHOST@`. `ApplyBurnAndParalysisPenaltiesToPlayer` stores `hWhoseTurn` 1 and quarters or halves the player; `ToEnemy` stores 0 and does the same to the enemy. Badge boosts are `stat + (stat >> 3)` on the player's battle copy, even bits only, capped at 999. `ReadPlayerMonCurHPAndStatus`, `DecrementPP` and `IncrementMovePP` have no callers. `BattlePokemon` has no box-level field; the four-byte write-back updates current HP and the decoded status, and the level stays. This is not `damage.ts`'s `applyBadgeStatBoosts`, which still writes the party `BattlePokemon`. Nothing in the running battle imports these modules.

A5c2 CP5 adds `battle_party_menu.ts` and PartyMenu's unused choose-only mode. `bindBattlePartyMenu`
composes CP4's party port; the party/StatusScreen session owns its one BG tick on session frames, including the
done frame. Resume the generator at that same frame boundary for reload CPU work; the next yield is the next
frame. Never also call BattleScreen.vblank on session or held frames. Shared party opening/redraw remain22/16
(ASM24/18; #73), while the battle quit/switch palette tail is the full11. The opaque retained ScreenTiles overlay
owns the submenu and129-cell clear; the base party list is still the shared pixel renderer (#74), with its known
partial-row redraw limit. Refusal PrintText now commits to logical/shown overlay tiles before dismissal, so its
picture survives the four frozen copy frames. CANCEL returns null to DisplayBattleMenu's loop instead of nesting
generators. Final idle-machine gates pass twice; note67 §11.18. Nothing in the running battle uses these modules.

A5c2 CP4 adds unused `battle_menu.ts` (DisplayBattleMenu, bag/item tails, ordered HUD palette/alarm composition,
RUN flow) and `battle_menu_screen.ts` (logical Buffer1/2 and standalone PrintText commit/dismiss). Required
`BattleActionContext` extends the move context; the host supplies item/party/text/audio/odds ports. ListMenu's
optional simulated-input branch defaults off. The attempt byte wraps once; the odds adapter maps byte0 to the
ASM's 256th-attempt meaning. Audio overlap remains V5; RNG and runtime integration remain A5c3. Note67 §11.14.

A5c2 CP3 adds unused `move_selection_menu.ts` (battle/Mimic/PP-item frame program), `battle_menu_context.ts`
(raw state, Frame/Program and ports) and `battle_tiles.ts` (TileSurface over BattleScreen). Host primes CPU work
once and owns one VBlank per serviced yield; PrintText and Buffer1 restore are ports. No main.ts, battle.ts or
battle_ui.ts caller until A5c3. Note 67 §11.12 records tests/mutations; shared-screen palette timing stays V5 (#73).

## Data Files

- `pokemon.json` (151 species), `moves.json` (165 moves), `type_chart.json`, `trainers.json` (47 classes, 396 parties), `wild/*.json`

## Stat Calculation (Gen 1)

- HP = `floor(((base+DV)*2*level)/100) + level + 10`
- Other stats = `floor(((base+DV)*2*level)/100) + 5`

## Damage Formula

`floor(((2*level/5+2)*power*atk/def)/50+2)` x STAB(1.5) x type effectiveness x random(217-255)/255

## Type Split

Types 0x00-0x08 are Physical (use Attack/Defense), types 0x14+ are Special (use Special/Special).

## Encounter Flow

After each step, check `isGrassTile()` -> random vs grassRate -> select slot -> create wild Pokemon -> start battle.

A5d CP4 sends wild steps/turns, map trainers, the Lab rival and catch demos through main's shared entry.
Stop at E, PM at E+1, capture/prologue at E+2, selected transition and tail, then black until readiness.
Battle.init stays unchanged. Until A5f checkpoint-04 initCatchDemo returned its sprite-load promise so main could
await that readiness before entering catch_demo; since 04 the demos enter the session like every other battle.

## Battle States

Wild battle flow:
`intro -> choose_action -> choose_move -> execute_turn -> player_move/enemy_move -> check_faint -> victory/defeat -> gain_exp -> [learn_move_prompt -> learn_move_select -> learn_move_confirm] -> end`

Trainer battle flow:
`trainer_intro -> choose_action -> ... (same as above) -> [forced_switch -> switching_in] -> ... -> gain_exp -> trainer_end -> end`
(a loss: `defeat -> trainer_end -> [blackout] -> end`)

Additional states:
- `choose_item` — bag menu open to select an item
- `throw_ball` — pokeball throw animation/text (wild battles only)
- `choose_pokemon` — party menu for voluntary switch
- `forced_switch` — party menu after player mon fainted (no cancel)
- `switching_out` — "Come back, X!" text phase
- `switching_in` — "Go! X!" text phase
- `run_away` — "Got away safely!" (wild battles only)
- `run_failed` — failed to escape, enemy gets a free turn
- `blackout` — "X is out of useable POKéMON!" / "X blacked out!" when entire party faints
- `trainer_end` — runs a `trainer_flow.ts` step list: texts, the trainer pic scrolling back in, delays (V1c)

## Turn Order

Compare Speed (Quick Attack has priority). Both sides attack per turn unless one faints.

## Badge Stat Boosts (Gen 1)

`applyBadgeStatBoosts()` in `damage.ts` multiplies player stats by 1.125x per badge (Boulder→Atk, Thunder→Def, Soul→Spd, Volcano→Spc). Applied at: battle init, switch-in, level-up, and after any stat stage change (Gen 1 bug: reapplies ALL badge boosts, not just the changed stat). Badges passed from `main.ts` into `Battle` constructor.

## 1/256 Miss Glitch

Gen 1 accuracy always runs the RNG check — even 100% accuracy moves go through `floor(random*256) >= threshold` where threshold=255, giving a 1/256 miss chance. No moves are exempt (Swift uses `skipAccuracy` which bypasses the check entirely).

## Focus Energy Bug

Focus Energy divides the crit rate by 4 instead of multiplying it (`srl` instead of `sla`; `damage.ts`).

## Faint

`SlideDownFaintedMonPic`: the fainted mon's pic slides down 7 rows (`PIC_HEIGHT`), 2 frames a row; the HUD clears after.

## Move Learning Flow

When a Pokemon levels up with a full moveset (4 moves), the move waits in `pendingMoves` and the battle enters an interactive flow: `learn_move_prompt` (yes/no: delete a move?) → `learn_move_select` (pick move to forget) → `learn_move_confirm` (abandon learning?). Uses `forceLearnMove()` in `experience.ts` to replace a specific slot. Text from `data/text/text_7.asm`; B / NO loops back to the full TryingToLearn text.

## Evolution

Post-battle evolution is handled by `evolution.ts`. `checkEvolutions()` finds level-based candidates (item evolutions are skipped post-battle, naturally excluding Pikachu). `applyEvolution()` changes species, recalculates stats, preserves HP delta, auto-renames if nickname matched old species, and updates the Pokédex. The `'evolution'` game state in `main.ts` handles the animation (the 8-cycle accelerating sprite alternation of `engine/movie/evolution.asm`) and B-button cancel.

## Whiteout/Blackout

When all party Pokemon faint: the `SET_PAL_BATTLE_BLACK` filter, "out of useable POKéMON!" / "blacked out!", money halved, party fully healed. `handleBlackoutWarp()` in `main.ts` warps to the last Pokécenter door and steps the player out below it. The destination is `lastBlackoutWarp` (saved; default PalletTown, updated on Pokecenter heal via the `onPokecenterHeal` callback).

## Trainer Battles

No catching/running. Trainer AI uses 3 modifier functions per class. Money = baseMoney x last enemy level.

**Two ways in** (`home/trainers.asm`): talking to an unbeaten trainer (V1c), or its sight
(A1c: the map script, "!", the walk-up; `src/overworld/ARCHITECTURE.md` → *Trainer sight*).
Both end in `engageTrainer` → the before-battle text → `startTrainerBattle`.
Since A5a the map text uses DisplayTextID / nested PrintText; talk meet music runs
when the string returns, then a silent fresh A/B wait and A release precede battle.
Battle text itself awaits A5c. `battleTextPages()` strips the map extractor's
`<PROMPT>` / `<DONE>` and converts cursor tokens to newlines for the old renderer.

**Since V1c the end of a trainer battle follows the ASM** (`trainer_flow.ts`, unit-tested;
`Battle` runs its steps in the `trainer_end` state):
- **Win** (`TrainerBattleVictory`): fanfare → "RED defeated / BUG CATCHER!" → the trainer
  pic scrolls in from the right (`_ScrollTrainerPicAfterBattle`: 6 steps × 4 frames, ending
  at x = 112 with its last column off-screen) → 40 frames → "BUG CATCHER: " + the saved
  end-battle text → "RED got ¥… / for winning!". The end text comes from
  `setupTrainerBattle(..., { endBattleText })`; without one only that step is skipped.
- **The fanfare waits for the whole party.** `onVictory` fires at the faint only in wild
  battles (`FaintEnemyPokemon .wild_win`); a trainer's plays at the start of the win
  sequence (`victoryMusicFor`: `defeatedgymleader` for gym leaders and RIVAL3).
- **Loss** (`HandlePlayerBlackOut`): the blackout text only — the trainer's saved lose text
  is never printed. Against RIVAL1 the enemy side is cleared, his pic scrolls in, 40
  frames, `_Rival1WinText`; in Oak's Lab there's no blackout (`playerLost` instead of
  `isBlackout`), elsewhere the blackout follows.
- **Trainer pics come from the extracted data**, not from the class's display name:
  `trainers.json`' `pic` (the cartridge's `TrainerPicAndMoneyPointers`; CHIEF uses
  `scientist.png`), read by `battle_trainer_party.ts`' `trainerPicName(state)`. Upstream's
  class-key mapping in `trainer_flow.ts` retired in A5c3f checkpoint-11d. Before V1c, a
  display-name lookup ("BUG CATCHER" has no file) hung the battle's first frame for 11 classes.

## Catch demo (V1d) — runs in the battle session since A5f checkpoint-04; old renderer retired in 05

`BATTLE_TYPE_OLD_MAN` (the Viridian old man) and `BATTLE_TYPE_PIKACHU` (Oak's catch in Pallet
Town) are one demo. Since A5f checkpoint-04 they run as real wild battles on the battle engine:
the map scripts set `wBattleType` (1 or 4), `wCurOpponent` and `wCurEnemyLevel`; the bridge
writes `wBattleType` into the battle state; `LiveBattleEncounter` gains a `demo` kind with
`battleType`; `main`'s `catchDemo` action builds the demo encounter and calls `beginBattleEntry`
with it, starting a real session. The simulated menu (FIGHT → ITEM → POKé BALL), the one-ball
list, and `ItemUseBall`'s demo branches (no party/box check, `wGrassRate` ↔ `wPlayerName`, the
old man's forced `$63` after `INITIAL_CATCH_TRAINING`, Oak's straight `.captured`) run in the
session. `UseBagItem` returns through `.returnAfterCapturingMon` (`wBattleResult = 2`, carry),
so `StartBattle` returns at `ret c`. One throw ends the battle. `LoadEnemyMonData` sets the
enemy's seen flag, so `main`'s `markSeen` is dropped. `end_of_battle.asm` skips evolution and
Pikachu mood for `wBattleResult ≠ 0`. Since A5f checkpoint-05 the old renderer is deleted:
`catch_demo.ts`, `catch_demo_screen.ts`, `catch_demo.test.ts` removed; `CatchDemoBattleType`
moved to `script/types.ts`; `battle_ui.ts` shrinks to ~130 lines (evolution/Pokédex sprites and
text only); `battleTextPages` retired with its last caller (row 61 of the 08b manifest).

Detail and ASM sources: `notes/05-v1d-plan.md`, `notes/87-a5f-plan.md` §20, §24.

## Battle Transitions

**A5d is done (user-verified 2026-10-18; note 65, DECISIONS #70).** Every battle start (wild steps and turns,
map trainers, the Lab rival, both catch demos) runs `PlayBattleMusic`'s stop and song, the prologue, one of the
8 transitions picked by the cartridge's 3-bit choice (trainer / enemy ≥ lead + 3 / dungeon map), and the tail,
then holds black until the battle is ready. The modules are in `overworld/` (`battle_transition*.ts`,
`transition_screen*.ts`; see `src/overworld/ARCHITECTURE.md`). Since A5e checkpoint-04b
every battle runs the silhouette intro with its 72-frame slide (the interim intro is deleted). Growth, starter Pikachu,
retreat and slide-offs already run since A5c3f10c; the poof/OAM player is live since A5e checkpoint-07.

## A5e closeout census (checkpoint-09)

| A5e item (note 65 §4, note 75 §2) | Outcome |
|---|---|
| Silhouette intro: LCD-off staging, three scroll bands, 72-step slide, head OAM, LCD-off white | Live, 02–04b; user-verified 2026-11-04 |
| Party balls, opening text, trainer placement and slide-off | Pre-existing ports, verified in 04's composition |
| Send-out growth, starter Pikachu entrance, retreat, slide-offs | A5c3f 10c bodies, retained (not re-ported) |
| Poof data, sub-animation player, live ON poof with `SFX_BALL_POOF` | 05–07; user-verified 2026-11-05 |
| Substitute/Minimize/Transform direct cues, doll hide/reshow, break, STATS reload, crash shake | 08a–08c; user-verified 2026-11-06 |
| Battle `UpdateSprites` | The cartridge's no-op (`$FF` gate), pinned in 08c |
| Attack move animations, ON-path initial Substitute/Transform pictures, `SE_MINIMIZE_MON`, ordinary Fly/Dig hides | #94: the full `move_anim` interpreter, unscheduled |
| Ball toss/shake/block animations and the catch's (enemy-side) poof | Live since A5f checkpoint-03: reviewed (note 87 §18), play-tested (§19) |
| Both catch demos' upstream renderer (`catch_demo_screen.ts`, `battle_ui.ts`) | Retired in A5f checkpoint-05: `catch_demo_screen.ts` deleted, `battle_ui.ts` cut to what evolution and the Pokédex use; the demos run in the session |
| Cries and Pikachu PCM in battle | J2 (with the opening/title PCM work, #69) |
| Ghost Marowak animation | Pokémon Tower phase (#101); throws until then |
| Screen-model merge (`IntroScreen`, `TransitionScreen`, `BattleScreen`) | note 57, "after A5e": now due; the user places it |
| Battle VBlank `Random` | note 57, backlogged |
| Every other `DisableLCD` port's serviced frame and LCD-off span | note 57, V5 audit (#96, #97) |
| MissingNo `GetMonHeader`, the `wMonHSpriteDim` model | Accepted 08b departures, unchanged |

`battle_move_anim.ts` runs `PlayAnimation` for the IDs in `battle_animations.json` since checkpoint-07; every other ID keeps the 30-frame stand-in (#94).

A5e's parent scope is note65 §4; current sequence/inventory is note75 §2/§4. 02/03a/03b reviews are note75 §8,
note76 §7 and note77 §9. 04a's report is note79 §6 and its review §7; 04b's brief is §8, its report §9 and its review §10 (closed 2026-11-04). Checkpoint-05 is note80. Historical carries are in note72 §10.24.1, §11.66 and §10.26; check them against the code.

## Key Files

(The deleted old engine's rows, `battle.ts`, `effects.ts`, `damage.ts`, `status.ts`, `catch.ts` and `volatiles.ts`,
were removed on 2026-11-02. They went in A5c3f 11c.)

| File | LOC | Purpose |
|------|-----|---------|
| `battle_ui.ts` | 119 | Upstream canvas drawing: evolution screen's sprites, silhouettes and text box; Pokédex's `loadPokemonSprites`; catch-demo drawing retired in 05 |
| `experience.ts` | 43 | Growth-rate EXP tables and `initExperience` (shrunk in 11d; level-up is `battle_exp*.ts`) |
| `data.ts` | 171 | JSON data loading |
| `types.ts` | 135 | TypeScript interfaces |
| `trainer_ai.ts` | 27 | `getTrainerClass` / `loadTrainerData` only (the AI is `battle_trainer_ai.ts`) |
| `trainer_flow.ts` | 45 | Meet/victory music choice, the pic-scroll delay, the rival-starter byte (shrunk in 11d; `battleTextPages` retired in A5f checkpoint-05) |
| `catch_demo.ts` | — | Deleted in A5f checkpoint-05; only `CatchDemoBattleType` moved to `script/types.ts` |
| `catch_demo_screen.ts` | — | Deleted in A5f checkpoint-05 |
| `evolution.ts` | 94 | Post-battle evolution check & apply |
| `battle_menu.ts` (`battleRunOdds`) | — | State-backed RUN odds on shared HRAM and BattleRandom; run.ts retired in checkpoint-11a |
| `encounter.ts` | 73 | Wild encounter selection: reads `hRandomAdd` / `hRandomSub` (note 74) |
| `battle_screen.ts` | 328 | A5c1: `BattleScreen`. The `wTileMap` window on the shared BG thirds, a 32 × 32 BG with SCX and the LY 64–95 split, pic slots, the battle's $62–$7F tiles, OAM, BGP/OBP, `setPalBattle` (2 held + 3 frames). |
| `battle_screen_render.ts` | 202 | A5c1: the pure renderer, 160 × 144 RGBA. Tile index → BGP → the cell's attribute palette; OBJ through the current OBP; CGB priority |
| `battle_attributes.ts` | 29 | A5c1: `BGMapAttributes_Battle` (2f:6960) as ROM-tested constants |
| `battle_hud.ts` | 186 | A5c1: `DrawPlayerHUDAndHPBar` / `DrawEnemyHUDAndHPBar`, `CenterMonName`, status priority. Returns the palette request and the alarm result. |
| `battle_tiles.ts` | 13 | A5c2: TileSurface over BattleScreen, preserving numeric cells and explicit opaque clears |
| `battle_menu_context.ts` | 122 | A5c2: raw move/action context specializations, frame generators and injected ports |
| `move_selection_menu.ts` | 183 | A5c2: battle/Mimic/PP-item move choice, byte PP/disabled state and swaps |
| `battle_menu.ts` | 223 | A5c2: DisplayBattleMenu, ordered HUD/palette/alarm composition, bag/item tails and RUN |
| `battle_menu_screen.ts` | 36 | A5c2: logical Buffer1/2 and standalone PrintText commit/dismiss owner |
| `battle_party_menu.ts` | 138 | A5c2 CP5: choose-only party hand-off, retained submenu/refusal text, status reload and switch/quit tails; null for redisplay |
| `battle_state.ts` | 580 | A5c3a: `BattleState`, one cell per WRAM address with the ASM names as accessors (`A`); A5c2's contexts as views. |
| `battle_loaders.ts` | 428 | A5c3a: `LoadBattleMonFromParty` / `LoadEnemyMonData`, the write-back points, the burn/paralysis penalties and badge boosts. |
| `battle_random.ts` | 22 | A5c3a: the `BattleRandom` seam (seeded, injectable DIV; link list). |
| `battle_math.ts` | 166 | A5c3a: stat-modifier ratios, `SelectEnemyMove` bands, trainer move choice, the Metronome pick. |
| `battle_arithmetic.ts` | 98 | A5c3b: the shared Multiply / Divide. |
| `battle_host.ts` | 50 | A5c3a: the Program host (serviced / held / session frames). |
| `battle_move_data.ts` | 112 | A5c3b: move records, `GetCurrentMove`, `GetName`, the move-name buffer. |
| `battle_turn_text.ts` | 58 | A5c3b: the used-move text and its grammar. |
| `battle_turn_status.ts` | 172 | A5c3b: both status checks, self-confusion, `playMoveAnimation`. |
| `battle_obedience.ts` | 75 | A5c3b: `CheckForDisobedience`. |
| `battle_residual.ts` | 84 | A5c3b: `HandlePoisonBurnLeechSeed`, `CheckNumAttacksLeft`. |
| `battle_hp.ts` | 48 | A5c3b: `UpdateHPBar2` / `UpdateCurMonHPBar` on the battle state. |
| `battle_hud_state.ts` | 35 | A5c3b: HUD drawing from `BattleState` (`drawHuds`, `hudContext`). |
| `battle_damage_asm.ts` | 397 | A5c3b: the damage chain from the ASM (crit, damage vars, `CalculateDamage`, type, random range; #77). |
| `battle_hit.ts` | 88 | A5c3b: `MoveHitTest` / `CalcHitChance`, Counter. |
| `battle_apply.ts` | 153 | A5c3b: `ApplyAttackTo*` / `ApplyDamageTo*`, Substitute damage, the failure / crit / effectiveness texts. |
| `battle_execute_helpers.ts` | 98 | A5c3b: the six effect arrays, ghost text, Explosion, Rage, Mirror Move, Metronome. |
| `battle_execute.ts` | 211 | A5c3b: `ExecutePlayerMove` / `ExecuteEnemyMove`; effects through the `jumpMoveEffect` port (A5c3c). |
| `battle_turn.ts` | 111 | A5c3b: `MainInBattleLoop`, returning its exit label. |
| `battle_screen_binding.ts` | 11 | A5c3c: entry Programs bind their screen, and throw on a different one (note 69 §10.4 item 0). |
| `battle_effects.ts` | 200 | A5c3c: `MOVE_EFFECT_POINTERS` (86) and `jumpMoveEffect` (`b = 1`), `CheckTargetSubstitute`, `ClearHyperBeam`, the animation helpers with Yellow's 12-frame refresh, the failure printers. |
| `battle_effects_status.ts` | 207 | A5c3c: Sleep, Poison, Freeze / Burn / Paralyze + the fire thaw, Paralyze, Confusion, Flinch, Leech Seed. |
| `battle_effects_stats.ts` | 225 | A5c3c: stat up / down (`PrintStatText`, Minimize, Rage's direct call), Haze, Mist, Focus Energy, Reflect / Light Screen. |
| `battle_effects_turns.ts` | 190 | A5c3c: Explode, Pay Day, Bide, Thrash, Switch / Teleport, multi-hit, OHKO, Charge, Trapping, Hyper Beam, Rage. |
| `battle_effects_hp.ts` | 311 | A5c3c: Drain / Dream Eater, Recoil, Heal / Rest, Substitute, Transform, Conversion, Mimic (with its move menu), Disable, Splash. |
| `battle_effects_registry.ts` | 31 | A5c3c: the composed registry and `composedJumpMoveEffect`. |

**A5c1 (note66, DECISIONS #72)** built these, plus the battle text programs in `text_programs.json`, `UpdateHPBar`
both ways in `menus/hp_bar.ts`, and the low-health alarm (`audio/low_health_alarm.ts`). These foundations now run
in the live session since A5c3f09b; `battle.ts` is deleted and `battle_ui.ts` serves the catch demo. The new A5e
helper/Program remain unused as specified in the current section above. Historical carries are in note66 §10.20.

## A5c3f checkpoint-08g: cartridge species names

`battle_trainer_data.ts` fetches `monster_names.json` in the same once-only promise as
the trainer/species tables. `monsterName(internal)` returns the cartridge spelling and
throws for a missing entry. `battle_trainer_party.ts` gives each header that name while
keeping species lookup keys based on upstream's `pokemon.json`, so `NIDORAN_F` and
`NIDORAN_M` remain distinct. `getMonName` keeps its ten-byte copy and terminator.

At the world boundary, `battle_bridge.ts` maps a nickname equal to the object's
`species.name` to the cartridge's default bytes for both party and box inputs.
Explicit nicknames stay verbatim; live objects and the exact party codec stay unchanged.
The new session's texts and HUD therefore use `RATTATA`, `PIKACHU`, `NIDORAN♀` and `MR.MIME`.
The stand-in Pokédex page still draws upstream's name until J2/V5.

This remains unused by `main.ts` until checkpoint-09. Its write-back will map default
cartridge name bytes back to `species.name` (O-48 option A, DECISIONS #86). Raw save name
bytes in checkpoint-10 will resolve the ambiguity of a nickname typed exactly like
upstream's default (`Pikachu`). See note 72 §10.18 and §11.41–§11.42.

## A5c3f checkpoint-09a: live adapter, still unused

`battle_live.ts` takes supplied live values and an encounter descriptor to build the
session's `BattleWorld`. It translates the wild dex species to an internal ID and a
trainer class to class+200, retaining badge spellings, labels and the caller's gym byte.
It imports no live owner or `main.ts`; checkpoint-09b supplies the owners and setters.
Map trainers' `endBattleTextLabels` come from header words +8/+10, resolved strictly
by bank/address during extraction. The decoded `endBattleText` stays until retirement.

`applyBattleOutcome` validates and decodes everything before writing absolute values.
It preserves existing party objects, appends a caught party member, validates old box
prefixes and inserts a new boxed object at the front (checkpoint-10a).
The box conversion reads the prefix directly, without synthesizing a party stat tail;
the live `BoxedPokemon` type requires a `maxHp` cache, computed with the existing
`CalcStat` from the actual species, box level, DVs and stat EXP. Default cartridge name
bytes map back to `species.name` per #86; typed `NIDORAN-F` and `MR. MIME` stay verbatim.
Money, bag, dex, happiness and mood replace live values. The raw emotion modifier is
written through LiveBattleOwners to pikachu_happiness.ts and persisted by 10b.

The returned map plan distinguishes `battleResult === 1` from `blackoutCarry`; an Oak's
Lab loss therefore resumes the script without a warp. Evolution candidates use only
flagged slots and level entries, including flagged fainted mons, in party order; a
nonzero result skips evolution. The evolution screen remains upstream's stand-in.
Its order is a known departure: Yellow evolves inside `EndOfBattle`, before
`UpdatePikachuMoodAfterBattle`, the sound wait and white-out; our stand-in runs after
the session ends. The cooldown, trainer flag/facing, blackout heal/halving/warp and
map music/fade remain checkpoint-09b's map-side work. See note 72 §10.19 and §11.44.

## A5c3f checkpoint-09b: live switch

`main.ts` now creates the production session immediately after priming battle music,
before the overworld transition. A page-lifetime random state reads a `pageTicks`
counter advanced before audio on each game tick. On the transition's final tick,
`session.start()` primes its CPU work synchronously; the next game tick services the
first HUD-load frame. Main ticks audio once and the session once, and leaves battle
joypad ownership to the session's hosts. `OptionMenu` owns text speed; session start
does not alter it.

The presenter reuses a native 160×144 canvas and draws it at `getScale()` without
smoothing. The party, status, naming and Pokédex foregrounds use their own renderers,
with no frame or input advancement from presentation. `partyItem` currently presents
only the party; composing the battle cells remains 09c. Debug receives null until 09c.
Both data loaders and stand-in assets finish before splash; unlock preloads the three
victory tracks for immediate numeric `PlaySound` playback from the shared music cache.

At completion main calls the 09a adapter once. Its plan drives trainer defeat/facing,
evolution choice, the old map fade/music tail, and blackout heal/halving/warp. Wild and
trainer byte owners supply seen/owned, party, box, bag, money and happiness. Main no
longer repeats those effects or checks the whole party for evolution. Map trainers
pass extracted label pairs; Oak's Lab passes its distinct win and lose labels.

The voluntary party binder uses a Proxy to present the counted party slice, retaining
the six-slot cache and forwarding every other context key/write (§11.47). The forced
chooser remains choose-only: B cannot exit it, and A on a living reserve sends it out
without a STATS/SWITCH submenu (§11.48). The old forced-status test row was removed.

The sleeping-Pikachu icon and selection gates apply to `battle_choice`, as in the ASM.
The only scripts setting the following-disabled bit (Bill's House, Pewter's Jigglypuff,
Fan Club) start no battle before it is cleared; that battle scenario is unreachable.
The synthetic regression pins the hidden icon, `SleepingPikachuText1`, then cancellation
back to the battle menu, matching `.asm_128f`'s carry exit. No continuation divergence
was observed. The old `'battle'` mode's exemption stays only for the retiring engine;
its icon case now exercises `showForBattle` directly, without main.

Catch demos kept their own start/finish branches until A5f checkpoint-04; the dead branches go in 05. The inverted
guard proves main reaches `battle_session`/`battle_live` and not `battle/battle.ts`.
Note 72 §10.20 lists all remaining reachable legacy helpers for retirement in 11.
Options persistence remains checkpoint-10b; front box insertion is implemented in 10a.
The derived record cells are closed by #88; they are not a pending metadata store.
09c also owns the bundle text-extractor audit. The deferred evolution screen and its
known ordering departure remain as recorded in 09a.

The damage type chart now builds once on first use from the boot-fetched data,
preserving ROM row order and byte multipliers; use before boot throws. The runtime
graph guard rejects Node-only imports. The old AI test now uses this lazy chart
under §11.50. The completed 09b switch builds `index-BcFy-L-E.js` (650,975 bytes);
ROM 6221/6221 and no-ROM 5964 pass / 257 skip. See note 72 §10.20.7 and Claude's
check in §11.51. The following 09c work completes the foreground/debug handoff.

### Checkpoint-09c: composition, debug bytes and extractor boundary

`partyItem` uses the full scaled scanout while BGP is zero. Otherwise main presents
the party list, then the single battle scanout buffer through a cell mask: only
`visibleAt(x,y) !== ' '` overlays the list. This preserves BG-third timing. The item
text box, HP animation's number/bar cells and Ether move list therefore overwrite
the party pixels as the final tilemap writes do on the cartridge. Blits use the
same nearest-neighbour scale as the full present; no frame/input work occurs there.

Entry snapshots copy the party, box outer array and active box array while keeping
their objects. The live-owner count/order validation can reject a party change before
committing any battle output. The other box arrays retain their existing references.

`debug_battle_view.ts` is a memory view over the named `battle_state.ts` cells. HP
uses BE words/max clamps; status writes one byte (SLP=3) without a stat effect;
stages expose 1–13 as −6…+6. Player EXP follows `wPlayerMonNumber` into `wPartyMons`
at the party struct's three-byte MON_EXP offset. Enemy EXP is not editable. The
info line reads the foreground, speed words, active party EXP and enemy header cells.
Panel writes occur after due ticks, force no HUD redraw and update no object mirror.
Controls wait for initialized species/nickname cells during entry/send-out; outside
battle the original party/object path remains. The old Battle type import is gone.

The source graph permits only `decodeTextByte` from `rom/extractors/text.ts` and no
other extractor module. Stat effects take the sole `STAT_NAME_LENGTH` definition
from `rom/constants.ts`; their extractor schema import stays type-only. The bundle
gate checks the decoder marker, rejects both program-decoder error markers and
`node:`. Setup reproduces all 920 static/data files byte-for-byte.

09c: `index-BFFnK4IM.js`, 653,446 bytes; ROM 6238/6238, no-ROM 5981 pass / 257 skip.
All eleven mutation variants are caught. See note 72 §10.21.4; stop for Claude's check
before checkpoint 10's save work and the user's play-test.

### Checkpoint-10a mon paths (implemented; awaiting Claude's check)

`pokemon_transfers.ts` owns the live deposit, withdrawal and box-STATS paths. It uses
the existing records/codec and scratch BattleState, with the shared species header,
`calcLevelFromExperience` and `calcStats`. Deposit copies the box prefix and sets
BoxLevel to party level; Bills PC appends deposits. Withdrawal derives level from
exact EXP at `wLoadedMon`, while box STATS uses BoxLevel. Both calculate stored stats
with b=1 and keep prefix HP, status/sleep, packed PP Ups and exact EXP. STATS leaves
the box entry untouched. Both paths retain the #86 live nickname policy.

BoxedPokemon includes sleepTurns throughout both box-record conversions and
pokemonToBoxed. Version-1 main restore supplies a missing counter of 1 for SLP and
0 otherwise; this is an explicit migration value, not a cartridge behaviour. An
existing counter is retained. The save format/version itself remains unchanged
until 10b.

Evolution computes the new species' stored stats through the same checked CalcStats
b=1 port, then adds the max-HP difference to old HP in 16-bit arithmetic, without a
clamp. A flagged fainted mon can return with positive HP; a zero difference leaves
HP0. `checkEvolutions` and upstream's evolution presentation are otherwise unchanged.

Catches into a full party prepend the new boxed object. The old-slot invariant is
still live slot i = outcome slot i+added; live order matches the bytes and the next
battle's box inputs. Deposit and caught-mon insertion intentionally have different
orders, matching their separate ASM paths.

Nine required mutation variants are caught. The deleted deposit overwrite is an
accepted equivalent (#88; note72 §11.57), because worldPartyRecord derives both
BoxLevel and level from mon.level. The explicit ASM overwrite stays. The stat-exp
test now pins the b=1 literal stats under §11.58, retaining its tuple and save cases.
Final gates pass: typecheck, build, bundle markers, ROM6250/6250 and no-ROM5993 pass /
257 skip. Bundle: `index-JxBhHJZc.js`, 653,398 bytes. See note72 §10.22.9; stop for
Claude's check in §11.59. The following 10b work completes record persistence,
version-1 migration stats/EXP, options and emotion-modifier saves.

### Checkpoint-10b: record saves and main-menu restoration

`save.ts` writes version2 under the unchanged `p151-s` key. Party entries contain
44 struct bytes,11 OT bytes and11 nickname bytes; box entries contain33+11+11.
The existing codecs write/read scratch slot0 at their own named addresses. No
parallel codec or stat formula is used. Loaded party stats, exact EXP, sleep counter
and PP Ups come from the record; default nicknames follow #86. Box arrays retain
their front order. Decode errors propagate, and no partial party is returned.
Main decodes both mon collections before applying the party.

`loadGame` returns the parsed version1/version2 union, rejecting unsupported versions
and parse failures. Version1 party members use 10a's box-STATS path at the saved
level with CalcStats b=1, exact saved EXP and SLP1/healthy0 migration counters.
Version1 box fill is now in restoreBoxes, retaining an existing counter. These
are explicit migration rules; raw derived record cells remain closed under #88.

OptionMenu.restore and menu edits share one text-speed map. Every title→main-menu
entry first restores MID/ON/SHIFT, then the save's packed options and modifier
(version1 uses defaults/modifier0). CONTINUE restores them again. The modifier's
single owner is pikachu_happiness.ts; main snapshots read it, and the live battle
adapter supplies its setter through LiveBattleOwners. NEW GAME keeps both loaded
values while resetting happiness/mood, as InitPlayerData2 does.

10b: `index-Ccytk04i.js`, 654,297 bytes; ROM6260/6260, no-ROM6003 pass /257 skip.
All eleven mutations are caught. See note72 §10.23.5. Stop for Claude's check,
then the user's play-test; no retirement or play-test fixes have started.
