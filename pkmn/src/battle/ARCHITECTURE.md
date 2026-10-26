# Battle System Architecture

A5c3e checkpoint-04b item0 puts Random_ in `battle_random.ts` as `random(state, carryIn)`; off-link
BattleRandom supplies its CP carry, Bait/Rock supply0, and the link-list path stays separate. The private item
copy is gone. The flute adapter/body are stopped pending an audio API/bundle decision (note71 §10.5): public
clear/reinstall preserves IDs but still ends CH5 at33. The proposed pending-stream method is not applied.

A5c3e checkpoint-04 adds unused `battle_item_bodies.ts`: explicit registration for X Accuracy, Guard Spec,
Dire Hit, the four X stats, Poké Doll and Bait/Rock (note71 §10.4). It reuses statModifierUpEffect and the Pikachu
happiness/starter gate. X stats spend before animation, retain failure consumption and reapply badges only on
success. Bait/Rock use the source Random clear-carry path, rejection/saturation, a named animation cue and70 frames.
The common item tail now uses the existing general byte decoder for item-name punctuation/é, rather than the
MoveNames alphabet. No live caller or flute body is added.

A5c3e checkpoint-03 adds unused `battle_items.ts` and `battle_item_state.ts` (note71 §10.3).
The frozen83-row dispatcher initializes result1, completes battle refusals and calls only explicitly registered
bodies; none are installed yet. Shared tails delegate the retained printer, scroll-button wait and BattleAudio.
Raw bag bytes own subtraction, the FF shift, menu thresholds and optional object mirroring. Item cells add aliases
over the existing D view, without new storage. The A5c2 binding is available but unwired; the ledger rig stays fake
until checkpoint-10. Card Key deliberately compares the pinned ROM opcode CD after fetching its battle-screen tile.

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

Each handler is `(state) => Program`. Every effects animation runs Yellow's `Func_78e98`:
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
Battle.init stays unchanged. initCatchDemo returns its existing sprite-load promise so main can await the
same readiness before entering catch_demo; its rules, animation and update timing are otherwise unchanged.

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
- **Trainer pics load by class key** (`trainerPicName('BUG_CATCHER')` → `bugcatcher`), not
  by display name: "BUG CATCHER" has no file, and before V1c that hung the game on the
  battle's first frame for 11 classes.

## Catch demo (V1d)

`BATTLE_TYPE_OLD_MAN` (the Viridian old man) and `BATTLE_TYPE_PIKACHU` (Oak's catch in Pallet
Town) are one demo, run beside `Battle` rather than inside it (DECISIONS #32): `Battle`
assumes a player Pokémon, and Oak's catch has an empty party. Detail and ASM sources:
`notes/05-v1d-plan.md`.

- `catch_demo.ts` — the rules as tested data: `catchDemoCaught` (PIKACHU always; OLD_MAN
  unless `INITIAL_CATCH_TRAINING` is set, `ItemUseBall`), `catchDemoBackPic`
  (`oldmanb` / `prof.oakb`), `CATCH_DEMO_BAG` (one POKé BALL), `tossBallAnims` (4 or 6),
  and `catchDemoSteps`: "Wild X appeared!" (A) → HUD + 40 frames → ▶ FIGHT 20 → ▶ ITEM
  20 + 10 frozen → bag 3 → ▶ POKé BALL 20 → "OLD MAN used / POKé BALL!" 20 → the toss
  animations → the result text (A).
- `catch_demo_screen.ts` — upstream's `pikachu/pikachu_battle.ts`, moved and generalized:
  loads the enemy by dex with its own palette and the back pic by battle type, keeps
  upstream's slide-in and toss/poof/shake drawing (their exact ASM timings are A5 / later),
  and walks the steps.
- A script starts it with `{ type: 'catchDemo', battleType, species, level }` (what the ASM
  scripts set). `main.ts` marks the enemy seen (`LoadEnemyMonData`), plays wildbattle, runs
  the wild transition, then the `catch_demo` state; at the end: instant white, fade in, the
  script resumes. No ball is used, nothing joins the party, no evolution or mood update
  (`wBattleResult = 2`).

## Battle Transitions

**A5d is done (user-verified 2026-10-18; note 65, DECISIONS #70).** Every battle start (wild steps and turns,
map trainers, the Lab rival, both catch demos) runs `PlayBattleMusic`'s stop and song, the prologue, one of the
8 transitions picked by the cartridge's 3-bit choice (trainer / enemy ≥ lead + 3 / dungeon map), and the tail,
then holds black until the battle is ready. The modules are in `overworld/` (`battle_transition*.ts`,
`transition_screen*.ts`; see `src/overworld/ARCHITECTURE.md`). The battle itself still starts with upstream's
intro below (A5e replaces it).

## Wild Intro Phases

`slide_in` (wild from LEFT, Red from RIGHT) -> `colorize` -> `appeared_text` -> `send_player` (Red slides LEFT off) -> `send_pokemon` (Pokemon slides in from LEFT, only after Red gone) -> `go_text`

## Trainer Intro Phases

`slide_in` -> `colorize` -> `pokeballs_text` -> `send_enemy` -> `send_enemy_text` -> `send_player` -> `send_player_text`

## Silhouettes

Canvas `source-atop` compositing for all-black sprite versions, `globalAlpha` for colorize blend.

## Player Trainer Sprite

`loadPlayerTrainerSprite()` loads Red's backsprite (`/gfx/player/redb.png`) for wild intros.

## Key Files

| File | LOC | Purpose |
|------|-----|---------|
| `battle.ts` | 2442 | Main battle state machine |
| `battle_ui.ts` | 808 | HUD, action menu, trainer intros |
| `effects.ts` | 1013 | Move effects (stat changes, screens, leech seed, etc.) |
| `damage.ts` | 328 | Damage formula, type effectiveness |
| `status.ts` | 254 | Sleep, freeze, burn, paralysis, poison |
| `experience.ts` | 169 | XP gain, leveling |
| `data.ts` | 171 | JSON data loading |
| `types.ts` | 135 | TypeScript interfaces |
| `trainer_ai.ts` | 219 | Trainer move selection |
| `trainer_flow.ts` | 166 | V1c: meet/victory music choice, end-text pages, win/loss step lists, pic scroll, trainer pic names |
| `catch.ts` | 105 | Catch rate formula |
| `catch_demo.ts` | 111 | V1d: the catch demo's rules and step list (old man + Oak's Pikachu) |
| `catch_demo_screen.ts` | 626 | V1d: runs and draws the catch demo (was `pikachu/pikachu_battle.ts`) |
| `evolution.ts` | 94 | Post-battle evolution check & apply |
| `volatiles.ts` | 77 | Substitute, confusion, etc. |
| `run.ts` | 57 | Wild battle escape logic (Gen 1 TryRunningFromBattle) |
| `encounter.ts` | 70 | Wild encounter selection |
| `battle_screen.ts` | 328 | A5c1: `BattleScreen`. The `wTileMap` window on the shared BG thirds, a 32 × 32 BG with SCX and the LY 64–95 split, pic slots, the battle's $62–$7F tiles, OAM, BGP/OBP, `setPalBattle` (2 held + 3 frames). **Unused until A5c3** |
| `battle_screen_render.ts` | 202 | A5c1: the pure renderer, 160 × 144 RGBA. Tile index → BGP → the cell's attribute palette; OBJ through the current OBP; CGB priority |
| `battle_attributes.ts` | 29 | A5c1: `BGMapAttributes_Battle` (2f:6960) as ROM-tested constants |
| `battle_hud.ts` | 186 | A5c1: `DrawPlayerHUDAndHPBar` / `DrawEnemyHUDAndHPBar`, `CenterMonName`, status priority. Returns the palette request and the alarm result. **Unused until A5c3** |
| `battle_tiles.ts` | 13 | A5c2: TileSurface over BattleScreen, preserving numeric cells and explicit opaque clears |
| `battle_menu_context.ts` | 122 | A5c2: raw move/action context specializations, frame generators and injected ports |
| `move_selection_menu.ts` | 183 | A5c2: battle/Mimic/PP-item move choice, byte PP/disabled state and swaps |
| `battle_menu.ts` | 223 | A5c2: DisplayBattleMenu, ordered HUD/palette/alarm composition, bag/item tails and RUN |
| `battle_menu_screen.ts` | 36 | A5c2: logical Buffer1/2 and standalone PrintText commit/dismiss owner |
| `battle_party_menu.ts` | 138 | A5c2 CP5: choose-only party hand-off, retained submenu/refusal text, status reload and switch/quit tails; null for redisplay; unused until A5c3 |
| `battle_state.ts` | 580 | A5c3a: `BattleState`, one cell per WRAM address with the ASM names as accessors (`A`); A5c2's contexts as views. **Unused until A5c3f** |
| `battle_loaders.ts` | 428 | A5c3a: `LoadBattleMonFromParty` / `LoadEnemyMonData`, the write-back points, the burn/paralysis penalties and badge boosts. **Unused until A5c3f** |
| `battle_random.ts` | 22 | A5c3a: the `BattleRandom` seam (seeded, injectable DIV; link list). **Unused until A5c3f** |
| `battle_math.ts` | 166 | A5c3a: stat-modifier ratios, `SelectEnemyMove` bands, trainer move choice, the Metronome pick. **Unused until A5c3f** |
| `battle_arithmetic.ts` | 98 | A5c3b: the shared Multiply / Divide. **Unused until A5c3f** |
| `battle_host.ts` | 50 | A5c3a: the Program host (serviced / held / session frames). **Unused until A5c3f** |
| `battle_move_data.ts` | 112 | A5c3b: move records, `GetCurrentMove`, `GetName`, the move-name buffer. **Unused until A5c3f** |
| `battle_turn_text.ts` | 58 | A5c3b: the used-move text and its grammar. **Unused until A5c3f** |
| `battle_turn_status.ts` | 172 | A5c3b: both status checks, self-confusion, `playMoveAnimation`. **Unused until A5c3f** |
| `battle_obedience.ts` | 75 | A5c3b: `CheckForDisobedience`. **Unused until A5c3f** |
| `battle_residual.ts` | 84 | A5c3b: `HandlePoisonBurnLeechSeed`, `CheckNumAttacksLeft`. **Unused until A5c3f** |
| `battle_hp.ts` | 48 | A5c3b: `UpdateHPBar2` / `UpdateCurMonHPBar` on the battle state. **Unused until A5c3f** |
| `battle_hud_state.ts` | 35 | A5c3b: HUD drawing from `BattleState` (`drawHuds`, `hudContext`). **Unused until A5c3f** |
| `battle_damage_asm.ts` | 397 | A5c3b: the damage chain from the ASM (crit, damage vars, `CalculateDamage`, type, random range; #77). **Unused until A5c3f** |
| `battle_hit.ts` | 88 | A5c3b: `MoveHitTest` / `CalcHitChance`, Counter. **Unused until A5c3f** |
| `battle_apply.ts` | 153 | A5c3b: `ApplyAttackTo*` / `ApplyDamageTo*`, Substitute damage, the failure / crit / effectiveness texts. **Unused until A5c3f** |
| `battle_execute_helpers.ts` | 98 | A5c3b: the six effect arrays, ghost text, Explosion, Rage, Mirror Move, Metronome. **Unused until A5c3f** |
| `battle_execute.ts` | 211 | A5c3b: `ExecutePlayerMove` / `ExecuteEnemyMove`; effects through the `jumpMoveEffect` port (A5c3c). **Unused until A5c3f** |
| `battle_turn.ts` | 111 | A5c3b: `MainInBattleLoop`, returning its exit label. **Unused until A5c3f** |
| `battle_screen_binding.ts` | 11 | A5c3c: entry Programs bind their screen, and throw on a different one (note 69 §10.4 item 0). **Unused until A5c3f** |
| `battle_effects.ts` | 200 | A5c3c: `MOVE_EFFECT_POINTERS` (86) and `jumpMoveEffect` (`b = 1`), `CheckTargetSubstitute`, `ClearHyperBeam`, the animation helpers with Yellow's 12-frame refresh, the failure printers. **Unused until A5c3f** |
| `battle_effects_status.ts` | 207 | A5c3c: Sleep, Poison, Freeze / Burn / Paralyze + the fire thaw, Paralyze, Confusion, Flinch, Leech Seed. **Unused until A5c3f** |
| `battle_effects_stats.ts` | 225 | A5c3c: stat up / down (`PrintStatText`, Minimize, Rage's direct call), Haze, Mist, Focus Energy, Reflect / Light Screen. **Unused until A5c3f** |
| `battle_effects_turns.ts` | 190 | A5c3c: Explode, Pay Day, Bide, Thrash, Switch / Teleport, multi-hit, OHKO, Charge, Trapping, Hyper Beam, Rage. **Unused until A5c3f** |
| `battle_effects_hp.ts` | 311 | A5c3c: Drain / Dream Eater, Recoil, Heal / Rest, Substitute, Transform, Conversion, Mimic (with its move menu), Disable, Splash. **Unused until A5c3f** |
| `battle_effects_registry.ts` | 31 | A5c3c: the composed registry and `composedJumpMoveEffect`. **Unused until A5c3f** |

**A5c1 (note 66, DECISIONS #72)** built these, plus the battle text programs in `text_programs.json`, `UpdateHPBar`
both ways in `menus/hp_bar.ts`, and the low-health alarm (`audio/low_health_alarm.ts`). Today's battle still runs on
`battle.ts` and `battle_ui.ts`. A5c3 switches it over; the carry-overs are in note 66 §10.20.
