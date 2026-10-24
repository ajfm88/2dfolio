# HISTORY — session archive

> ⚠ **This is not the live log.**
>
> Current state, the ordered work queue, open questions and recent sessions live in
> **`STATUS.md`** — read that first, and update it before you stop working.
> (DECISIONS #11, #19.)
>
> This file keeps older session entries once `STATUS.md`'s session log gets long,
> so the live log stays short enough that agents actually read it.
> Since 2026-10-16 it also keeps STATUS.md's archived sections (the full completed-slice table, old
> handoffs, resolved open questions) at the bottom; DECISIONS #61.

Newest first.

## Recent session archive

### 2026-10-22 (session closed; next: Claude plans A5c3d) — Claude

**The user ended the session here. The next Claude session plans A5c3d** (no implementer is named yet; the user names one per checkpoint). Docs brought current: CLAUDE.md, PROJECT, PLAN, ARCHITECTURE, CONVENTIONS and `game/src/battle/ARCHITECTURE.md` all show A5c3c ✅ and the **4586/4586** baseline (no-ROM **4378 / 208 skip**). One correction: the `PrintStatText` overrun entry (backlog, note 69 §10.18) first said `StatModTextStrings` is followed by code. It is followed by `StatModifierRatios`, 26 bytes with no `$50`, and then code.

**For the A5c3d planner:**
- **Scope:** note 68 §2, the A5c3d row (`core.asm` 263–288, 708–1374, 1764–1874; `experience.asm`, `learn_move.asm`, `end_of_battle.asm`, `common_text.asm`; 5 checkpoints estimated). It covers:
  - the faint routines with `SlideDownFaintedMonPic`;
  - the trainer's next mon with SHIFT, and `TrainerBattleVictory` (V1c's steps rehosted);
  - EXP, level-up with `PrintStatsBox`, and learning moves;
  - the player's faint, `ChooseNextMon` and the blackout;
  - `SwitchPlayerMon`, `RetreatMon` and `SendOutMon`, with their animations as ports;
  - `EnemyRan`;
  - `EndOfBattle`: Pay Day, the evolution hand-off, Pikachu's mood and the resets;
  - Pikachu happiness wherever the ASM changes it.
- **Carry-ins:**
  - note 68 §8 items 1–2 (`InitBattleVariables` and `EndOfBattle` resets; the port bodies);
  - note 68 §10.1's text table: `PlayerMon1Text` / `PlayerMon2Text` and Go / DoIt / Getm / EnemysWeak / Enough / OK / Good / ComeBack (`common_text.asm:127–269`);
  - note 69 §3.5 (Pay Day's money on `$CD6D`, collected by `EndOfBattle`);
  - note 69 §10.10 item 1 (Explode zeroes the user's HP; "the faint belongs to A5c3d").
- **The pattern to copy:** note 69 §6–§7. Checkpoint-01 is a no-code trace with numbered questions for Claude. Then come implementation checkpoints into unused modules, added to `a5c3_unused.test.ts`. Each one has ledgers on both sides, real-printer snapshots, brief mutations plus Claude's own, the four gates in order, and one local commit. A5c3f does the switch-over.
- **Write the plan as `notes/70-a5c3d-<kind>.md`.** Add a STATUS entry and a DECISIONS entry if a choice needs the user. Commit locally. Never push.

### 2026-10-22 (A5c3c checkpoint-07b checked; A5c3c complete) — Claude

Grok's checkpoint-07b **passes** (**note 69 §10.20**), and **A5c3c is complete**: ten checkpoints, all checked. Commit `4bb7feb` adds the manifest and four `retire-L` cases, with zero removed lines in earlier tests and no snapshot changes. I audited every non-`prior` `correct`/`invented` link: each linked test, down to the `it.each` row that carries the rule, pins its row's corrected rule. The four new cases match their ASM lines. My gates, one after another: typecheck clean; build `index-Dn4MlLpw.js`; ROM **4586/4586**; no-ROM **4378 pass / 208 skip**. My own 7 mutations were all caught. Grok's green L780 mutation is the hand-checked case §10.19 named. **Next:** plan A5c3d (faint, EXP and level-up, learning moves, the trainer's next mon, victory, the player's faint) in a new note. Docs only. Local commit only.

### 2026-10-22 (A5c3c checkpoint-07b implemented; awaiting Claude's check) — Grok

New `effects_retirement.test.ts`: 139 rows. 135 link an existing plain `it` / `it.each` title; 4 new cases (L674, L789, L1045, L1184). No family handler changed. `effects.ts`, `effects.test.ts` and `a5c3_unused.test.ts` are untouched. Earlier tests only gained those cases; no snapshot changed. Nine mutations failed a test and were restored. Sharing L780 with the L789 case stayed green; that check is by hand (note 69 §9.17). No §9.6 rule was wrong.

Gates, once, in order: typecheck clean; build stayed `index-Dn4MlLpw.js` (`43dd8163…`); ROM **4586/4586**, 167 files; no-ROM **4378 pass / 208 skip**, 160 files pass / 7 skip. One local commit; stop for Claude's check. **A5c3d not started.**

### 2026-10-22 (A5c3c checkpoint-07 checked) — Claude

Grok's checkpoint-07 **passes** (**note 69 §10.18**). Commit `1fc2ad0` adds the registry and the composed suite, and earlier tests changed only by the two authorized one-liners. My gates, one after another: typecheck clean; build `index-Dn4MlLpw.js`; ROM **4578/4578**; no-ROM **4370 pass / 208 skip** (the 06b timeout is fixed). My own 10 mutations were all caught. Grok's three surprises check out against the ASM (OHKO dispatches once; the cleared OHKO byte; `$4A`/`$4B`). For `$4A`/`$4B`, the cartridge prints code bytes past `EVADE`; logged in the backlog for the J2 audit (unreachable, since no move has `$48–$4B`). **Next:** checkpoint-07b, the 139-row retirement manifest (brief **§10.19**); the user names the implementer. Docs only. Local commit only.

### 2026-10-22 (A5c3c checkpoint-07 implemented; awaiting Claude's check) — Grok

New unused `battle_effects_registry.ts`: the four factories composed, HP last, still off the production graph. `battle_effects_composed.test.ts` runs all 86 effect IDs through execute on both sides and pins the §4 bugs. 123 tests, 172 snapshots. No family handler changed. `$4A` prints after writing stat-mod index 6; `$4B` throws `stat name index outside table` after writing index 7. All 12 required mutations were caught and restored. The unused-module walk stays green if the new name is removed; the composed source pin is what fails. Results: **note 69 §9.16**.

Gates: typecheck failed once (TS2344, a test annotation), then clean; build stayed `index-Dn4MlLpw.js` (`43dd8163…`); ROM **4578/4578**; no-ROM **4370 pass / 208 skip**. No production wiring. One local commit; stop for Claude's check. **checkpoint-07b not started.**

*Older entries (A5c3c checkpoint-06b and before) → `HISTORY.md` → *Recent session archive*.*

### 2026-10-22 (A5c3c checkpoint-06b checked) — Claude

Grok's checkpoint-06b **passes** (**note 69 §10.16**). Grok's commit is `7754aac`; the scope is clean, and earlier tests changed only by the two §10.15 names. All five handlers match the ASM line by line. My gates, one after another: typecheck clean; build `index-Dn4MlLpw.js`; ROM **4455/4455**; no-ROM **1 failed / 4246 / 208 skip**, twice. The failure is `battle_effects.test.ts`'s BG1-window renderer test timing out at 5 s. It passes alone in 1.2 s and fails the same way with the HP file excluded, so it is load-dependent and not caused by 06b, the same as checkpoint-03's `text_programs` timeout. It gets a 30 s timeout as checkpoint-07 item 0. My own 12 mutations were all caught. The four factories now cover all 34 effect labels.

**Split:** checkpoint-07 is the composition (registry, every ID through its execute stage, the §4 bug pins; brief **§10.17**). Checkpoint-07b is the 139-row retirement manifest (87 rows need new ASM-backed cases). **Next:** checkpoint-07; the user names the implementer. Docs only. Local commit only.

### 2026-10-22 (A5c3c checkpoint-06b implemented; awaiting Claude's check) — Grok

Added Transform, Conversion, Mimic, Disable and Splash to the unused HP-effect factory. `getMonName` is now
exported; that is the only earlier source edit. 58 new tests and 52 new snapshots. The previous 102 snapshots
are unchanged. All 22 required mutations were caught and restored. Results: **note 69 §9.15**.
Gates: typecheck failed once on an unused import, then clean; build stayed `index-Dn4MlLpw.js`
(`43dd8163…`); ROM **4455/4455**; no-ROM **4247 pass / 208 skip**. No production wiring or data changes.
One local commit; stop for Claude's check. **checkpoint-07 not started.**

### 2026-10-22 (checkpoint-06b handed to Grok) — Claude

The user moved checkpoint-06b from Codex to Grok (**DECISIONS #79**). I re-read §10.14 against `transform.asm`, `conversion.asm`, `effects.asm:1259–1423`, `GetMonName`, `wram.asm` and the sym file, and it's right. **Note 69 §10.15** adds what a fresh implementer needs:
- the four env members, and the two authorized earlier-test edits;
- sym-confirmed addresses and the battle-struct offsets;
- the 8-byte stat-mod copy, padding included;
- Mimic's INVULNERABLE checks being dead code after a real hit test;
- `wCurrentMenuItem` left at the menu's value;
- Disable's RNG ledger order;
- six extra mutations.

New backlog entry for A5c3f: `getMonName` isn't byte-exact against `GetMonName`. Docs only, no code. **Next:** Grok implements checkpoint-06b, then Claude checks it. Local commit only.

### 2026-10-22 (end of day: docs brought current) — Claude

Docs updated for the end of the session: CLAUDE.md (baseline **4397/4397**, no-ROM **4189 / 208 skip**; A5c3c at checkpoint-06b), PROJECT, CONVENTIONS (baseline plus an A5c3c test-suite paragraph), ARCHITECTURE (165 files, 186 JSON), `game/src/battle/ARCHITECTURE.md` (an A5c3c section and six new Key Files rows). STATUS entries for checkpoints 01–03 moved to HISTORY. No code changed.

**Where A5c3c stands:** checkpoints 01, 02, 03, 04, 04b, 05 and 06 are done and checked (note 69 §10.1–§10.13). **Next: checkpoint-06b** (Transform, Conversion, Mimic, Disable, Splash; brief in note 69 §10.14; Codex), then checkpoint-07 (composition and the 139-row retirement manifest), then A5c3d. The paste-ready Codex prompt for 06b is the one given at the checkpoint-06 check; it only restates §10.14.

### 2026-10-22 (A5c3c checkpoint-06 checked) — Claude

**Checkpoint-06 passes** (note 69 §10.13). Re-read against `drain_hp.asm`, `recoil.asm`, `heal.asm` and `substitute.asm`: Drain's in-place halving and party sync, Recoil's missing sync, Heal's carry bug and Rest's order, and Substitute's always-first wait, scratch write and 0-HP success all match. Checkpoint-05's escape-boundary gap is closed.
- **Gates**, one after another: typecheck clean; build `index-Dn4MlLpw.js` (unchanged); ROM **4397/4397**; no-ROM **4189 pass / 208 skip**.
- **16 mutations of my own**, distinct from Codex's 16: 13 caught; the 3 survivors are equivalent or unreachable (two `≥`/`>` caps at exactly max, and a 16-bit wrap that needs max HP > 32767).

**Next:** checkpoint-06b (§10.14; Codex): Transform, Conversion, Mimic, Disable, Splash. Local commit only.

### 2026-10-22 (A5c3c checkpoint-06 implemented; awaiting Claude's check) - Codex

Added the unused HP-effect factory: Drain/Dream Eater, Recoil, Heal/Rest and Substitute.
Item 0 added four escape rejection-boundary cases first; its missing-`+1` mutation now fails.
The new 107 tests/102 snapshots pin both sides, full memory writes, real HP bars/HUDs, party-sync
asymmetry, Heal carry/Rest order and Substitute's wait/scratch/zero-HP behavior. All 15 HP mutations
plus the boundary mutation caught/restored. Results: **note 69 §9.14**.
Gates once in order, all first-pass: typecheck/build clean; unchanged `index-Dn4MlLpw.js`
(`43dd8163…`); ROM **4397/4397**, no-ROM **4189 pass / 208 skip**. No production wiring or data
changes. Earlier-test edits only the guard and four new cases. Two oldest entries archived verbatim
to HISTORY. One local commit; stop for Claude's check. **checkpoint-06b not started.**

### 2026-10-22 (A5c3c checkpoint-05 checked) — Claude

**Checkpoint-05 passes** (note 69 §10.11). Re-read against `effects.asm:186–202, 800–1005, 1034–1159, 1222–1257`, `pay_day.asm`, `one_hit_ko.asm` and `bcd.asm`: all eleven handlers match, including Pay Day's 8-bit doubling and byte-level AddBCD, the Bide/`NumHits` overlap, and Charge's Dig fallback.
- **Gates**, one after another: typecheck clean; build `index-Dn4MlLpw.js` (unchanged); ROM **4286/4286**; no-ROM **4078 pass / 208 skip**.
- **20 mutations of my own**, distinct from Codex's 16: 18 caught; one of mine was a no-op. **One real gap:** no test hits the wild-escape rejection boundary (a draw of `user + target` is accepted). Checkpoint-06 item 0 adds it.

**Next:** checkpoint-06 (§10.12; Codex): Drain / Dream Eater, Recoil, Heal / Rest, Substitute. Local commit only.

### 2026-10-22 (A5c3c checkpoint-05 implemented; awaiting Claude's check) - Codex

Unused turn-effect factory: eleven handlers, live Charge text suffix/fallback, bytewise Pay Day BCD,
full byte maps and ordered RNG/refresh/wait ledgers. **183 new tests / 26 real-printer snapshots**;
**17/17 behavioral mutations caught/restored**, plus one equivalent mask-removal trial (section9.13).
Gates once, in order, all pass first run: typecheck/build clean; ROM **4286/4286**, no-ROM **4078 pass /
208 skip**, 164 files. Bundle **index-Dn4MlLpw.js**, SHA256 unchanged. Earlier tests changed only in
the guard; no production/data/refs changes. Two oldest session entries archived verbatim to HISTORY
to keep STATUS short. One local commit; stop for Claude's check. **checkpoint-06 not started.**

### 2026-10-21 (A5c3c checkpoint-04b checked) — Claude

**Checkpoint-04b passes** (note 69 §10.9). Re-read against `haze.asm`, `mist.asm`, `focus_energy.asm` and `reflect_light_screen.asm`: Haze's resets, copy, target-only cure, Disable cells and volatile masks, and the three setters all match. The stat family is done.
- **Gates**, one after another (I reran typecheck myself; Codex's first one had failed): typecheck clean; build `index-Dn4MlLpw.js` (unchanged); ROM **4103/4103**; no-ROM **3895 pass / 208 skip**.
- **14 mutations of my own**, distinct from Codex's 16: all caught and restored.
- The one earlier-test edit (the factory key list) was authorized mid-checkpoint.

**Next:** checkpoint-05 (§10.10; Codex): Explode, Pay Day, Bide, Thrash, Switch / Teleport, multi-hit, OHKO, Charge, Trapping, Hyper Beam, Rage. Local commit only.

### 2026-10-21 (A5c3c checkpoint-04b implemented; awaiting Claude's check) - Codex

Haze, Mist, Focus Energy and the screens extend the unused stat factory. **107 new tests**, full Haze
WRAM maps, 16 real-printer snapshots, **16/16 mutations caught/restored**; note 69 section 9.12.
User authorized exactly one earlier assertion edit: factory expected keys2 ->6; title/other assertions
unchanged. Gates once in order: initial typecheck found a nullable lookup in the new test, corrected;
build's TypeScript recheck clean; ROM **4103/4103**, no-ROM **3895 pass / 208 skip**, 163 files. Bundle
**index-Dn4MlLpw.js**, SHA256 unchanged. No production wiring/data/refs changes. One local commit;
stop for Claude's check. **checkpoint-05 not started.**

### 2026-10-21 (A5c3c checkpoint-04 checked) — Claude

**Checkpoint-04 passes** (note 69 §10.7). Re-read against `effects.asm:387–798`, `core.asm:5084–5125` and the stat-name table: the extraction (48 raw bytes, EVADE's ratio overrun included), both stat routines, Minimize and Rage all match.
- **Gates**, one after another: typecheck clean; build `index-Dn4MlLpw.js` (unchanged); ROM **3996/3996**; no-ROM **3788 pass / 208 skip**.
- **16 mutations of my own**, distinct from Codex's 13: 15 caught; the 16th (`+2` threshold `$12` → `$11`) is equivalent, since ids `$10`/`$11` never reach stat-up. All restored.
- **A5c3f carry-over:** the new extractor runs only from `extract_dev_data.ts`; fold it into `extractRom()` at the switch-over.

**Next:** checkpoint-04b (§10.8; Codex): Haze, Mist, Focus Energy, Reflect / Light Screen. Local commit only.

### 2026-10-21 (A5c3c checkpoint-04 implemented; awaiting Claude's check) - Codex

Raw StatModTextStrings extractor first: ROM-confirmed 0f:7655, all ten-byte copies including EVADE's
ratio overrun; setup twice, all 899 generated files byte-identical. New unused stat-up/down factory,
live Rose/Fell suffixes, Minimize ports and real Rage composition: **185 new stat tests + 2 extraction
tests**, 20 real-printer snapshots. **13/13 required mutations caught/restored**. Gates once in order:
typecheck/build clean; ROM **3996/3996**, no-ROM **3788 pass / 208 skip**, 162 files. Bundle
**index-Dn4MlLpw.js**, SHA256 unchanged. Note 69 section 9.11 has the ledgers/results. Earlier tests
changed only in the guard; no production wiring or refs changes. One local commit; stop for Claude.
**checkpoint-04b not started.**

### 2026-10-21 (A5c3c checkpoint-03 checked) — Claude

**Checkpoint-03 passes** (note 69 §10.5). Re-read against `effects.asm:26–381, 1007–1032, 1165–1219`, `paralyze.asm`, `leech_seed.asm` and the constants; every handler matches, including confusion's incoming-A failure test and the player-only freeze recharge clear.
- **Gates**, one after another: typecheck clean; build `index-Dn4MlLpw.js` (unchanged); ROM **3809/3809**; no-ROM **3602 pass / 207 skip**.
- **14 mutations of my own**, distinct from Codex's 11: all caught and restored.
- Restored the original `mainInBattleLoop` doc sentence that item 0 had overwritten (comment only).
- **The stat family is split:** checkpoint-04 is stat up / down with a new extractor for the stat names (`StatModTextStrings`), Minimize and Rage's direct call; 04b is Haze, Mist, Focus Energy, Reflect / Light Screen. Nine checkpoints now.

**Next:** checkpoint-04 (§10.6; Codex). Local commit only.

### 2026-10-21 (A5c3c checkpoint-03 implemented; awaiting Claude's check) - Codex

Item 0 first: four entry Programs bind/validate their screen, with 13 new tests including the passed-screen
BG0 refresh; macro-comparison test timeout 30 s. New unused status-effect factory with **219 tests**,
including 38 real-printer ledgers and both-side branch/RNG/frame pins. **11/11 required mutations caught
and restored**; note 69 section 9.10 records results. Focused import guard caught an error-class dependency
in BattleScreen; moved validation into an unused helper before the gates. Gates once, sequentially:
typecheck/build clean; ROM **3809/3809**, no-ROM **3602 pass / 207 skip**, 160 files. Bundle
**index-Dn4MlLpw.js**, SHA256 unchanged. Earlier tests changed only for the authorized timeout/guard;
no production wiring or refs/data/static changes. One local commit; stop for Claude's check.
**checkpoint-04 not started.**

### 2026-10-21 (A5c3c checkpoint-02 checked) — Claude

Checkpoint-02 passes (note 69 §10.3):
- the 86-entry table, ROM-tested;
- the `b = 1` wrapper;
- the helpers' flags and guards;
- the 12-frame refresh, step for step against `Func_78e98`, with BG0 never shown;
- the penalty split;
- the six cells;
- the frame-count edits (12 × the animations played).

**Gates**, one after another: build `index-Dn4MlLpw.js` (unchanged); ROM **3577/3577**; no-ROM **3370 / 207 skip**.

**Mutations:** 8/8 of mine caught.

**Two items fold into checkpoint-03's item 0:**
- entry Programs bind their screen (the lazy screen could hide a wiring mistake at A5c3f);
- the named flake gets a 30 s timeout.

**Next:** checkpoint-03 (§10.4), the status ailments. Local commit only.

### 2026-10-21 (A5c3c checkpoint-02 implemented; awaiting Claude's check) - Codex

Unused dispatch/helpers, the 12-frame BattleScreen refresh with hidden BG0 and restored BG1, six cells/Pay Day
alias, and exported individual penalties. Note 69 section 9.9 records all 105 snapshot ledgers and explicit
old -> new frame assertions, plus **10/10 mutations caught/restored**. Build **index-Dn4MlLpw.js** and SHA256
unchanged. Final ROM **3577/3577**, no-ROM **3370 pass / 207 skip**, 158 files. Initial typecheck found a new-test
ES2020 Array.at mistake; corrected. First ROM run found one missed authorized HUD frame count plus a named
text_programs source-comparison timeout; both passed focused diagnosis and ROM retry. No refs/data/static
or production wiring changes. One local commit only; stopped for Claude. **checkpoint-03 not started.**

### 2026-10-21 (A5c3c checkpoint-01 checked) — Claude

Checkpoint-01 passes (note 69 §10.1). Codex's trace is accurate and corrects my plan in five places, all confirmed in
the ASM:
- the refresh is 12 frames;
- every dispatch returns `b = 1` through `JumpMoveEffect`;
- Heal's carry-fed compare;
- Transform's player-side check;
- Substitute's scratch write.

One slip fixed (the `$51` row). The checkpoint changed docs only, so no gates.

**Answers:**
- The refresh lives on `BattleScreen` with a BG0/BG1 destination. In battle the window (BG1) is what shows, so the
  BG0 blank must never reach the screen.
- 06 / 06b split approved.
- The 139-row manifest approved.
- The all-zero loops throw before drawing.

**Next:** checkpoint-02 (§10.2). Local commit only.

### 2026-10-21 (A5c3c checkpoint-01 — trace awaiting Claude's check) — Codex

Traced effects.asm and all 14 move_effects files into **note 69 §9**, answering §7 items 1–7.
Verified all 86 pointers/six dispatch arrays, 51 text wrappers, and the **139** legacy-test retirement rows.
Corrections include the **12-frame** refresh (plus core-only 3-frame prefix), wrapper returns, carry-sensitive
Heal, Transform's broken target check, and simulator disagreements. No code/tests or refs changed; gates not
re-run (documentation only). One local commit; stopped for Claude's check. **checkpoint-02 not started.**

### 2026-10-21 (A5c3c planned; stale docs fixed) — Claude

Planned A5c3c, the move effects, in **`notes/69-a5c3c-effects.md`**. The user named **Codex** (DECISIONS #78).
- §1: the dispatch, all 86 ids ($01–$56) → handler, file and line (seven `NULL` ids throw).
- §3, six findings:
  - Yellow's `Func_78e98` adds frames after every battle animation (checkpoint-02 ports them);
  - the Stadium flag `$D498` changes the sleep and freeze rolls;
  - Transform and Substitute read `wOptions`;
  - the effects need the penalty routines one at a time;
  - Pay Day writes the aliased `$CD6D`;
  - six WRAM cells are missing.
- §4: 15 cartridge behaviors the tests must pin.
- §6: seven checkpoints. 01 is the trace, 02 the dispatch and helpers, 03 the ailments, 04 the stats, 05 the
  multi-turn effects, 06 HP and copying, 07 the composed port and the retirement map.
- §7: the checkpoint-01 brief, which supersedes note 68 §11.35.

**Docs fixed:**
- the test counts in STATUS, PROJECT, CONVENTIONS and ARCHITECTURE;
- ARCHITECTURE's data/static file counts and SFX count;
- PROJECT's stale A5c3a pointer;
- `game/src/battle/ARCHITECTURE.md`'s *Key Files* (current LOC, every A5c3 module);
- the session entries from A5c3b checkpoint-06 fix and earlier, moved to HISTORY.

No code changed; gates not re-run (docs only). **Next:** Codex runs A5c3c checkpoint-01; Claude checks it. Local
commit only.

### 2026-10-21 (session closed) — Claude

The user stopped for the day; the next session starts with a fresh agent. Context files are up to date:
- STATUS;
- CLAUDE.md *Where things stand*;
- PROJECT *State*;
- PLAN's A5 row;
- CONVENTIONS (the checkpoint-07 entry marked checked).

**Resume with A5c3c checkpoint-01**, a trace of the move effects with **no code**, into a new
`notes/69-a5c3c-effects.md`:
- The brief is note 68 §11.35.
- The paste-ready prompt for Codex is in the last Claude turn; rebuild it from §11.35 if lost.
- Then Claude checks the trace and writes the checkpoint-02 brief.

**How this session ran:** Codex and Grok implemented; Claude did each check, re-running the gates and its own
mutations, and wrote each next brief. The pattern was brief → implement → check → (fix checkpoint if needed) →
next brief.

**Baselines:**
- typecheck clean;
- bundle `index-Dn4MlLpw.js` (`43dd8163…`), unchanged since A5c3a;
- ROM **3514/3514**, no-ROM **3308 pass / 206 skip**.

**Carry-overs:**
- A5c3f must make `BattleState`'s `wLowHealthAlarm` / `wLowHealthAlarmDisabled` delegate to the audio module, or
  remove them.
- `a5c3_unused.test.ts` must list every new unused module.
- The ROM-suite flake (note 69 §10.3), `text_programs.test.ts`'s macro test timing out at vitest's 5 s under load, is fixed: checkpoint-03 gave it a 30 s timeout.

Local commits only.

### 2026-10-20 (A5c3b checkpoint-07 checked; A5c3b complete) — Claude

Checkpoint-07 passes (note 68 §11.34), so **A5c3b is complete**: the whole turn, from `MainInBattleLoop` down, is
ported and unused.
- **What I checked:**
  - the entry checks;
  - every selection gate and flag mask in ASM order;
  - the link block (the Metronome-only bug kept);
  - Quick Attack / Counter priority, the BE speed compare and the tie with its clock inversion;
  - both action orders with every faint / escape / AI exit;
  - `CheckNumAttacksLeft` once per turn.
- **Gates**, one after another: build `index-Dn4MlLpw.js` (unchanged); ROM 3514/3514; no-ROM 3308 / 206 skip.
- **Mutations:** 9/9 of mine caught.
- **Next:** A5c3c (the move effects). Checkpoint-01 is a trace with no code, written into a new note 69 (§11.35).

Local commit only.


### 2026-10-20 (A5c3b checkpoint-07 — awaiting Claude's closing check) — Codex

Unused `battle_turn.ts` composes MainInBattleLoop, with explicit exit labels and TrainerAI/link-switch ports.
90 whole-turn tests / ledgers use packed/wild loaders, real menus/text/HUD/execution/residuals and the audio rig;
105/105 mutations caught/restored. First typecheck found a missing flag return in the new tracing wrapper;
fixed and restarted the sequential gates from `game/`: typecheck/build clean, ROM **3514/3514** first run
(no one-off failure), no-ROM **3308 pass / 206 skip**, 157 files. Bundle `index-Dn4MlLpw.js`, SHA256 unchanged.
Only earlier-test edit adds the module to the graph guard; no production wiring. Results and later-slice API /
A5c3f import ownership in note 68 §10.19. One local commit, never pushed. Stopped; Claude's check closes A5c3b.

### 2026-10-20 (A5c3b checkpoint-06 fix checked; checkpoint-06 complete) — Claude

The fix passes (note 68 §11.32).
- **What I checked:**
  - the player reload before the charge test;
  - the shims removed, with the bodies identical to the deleted files;
  - one import-graph test from `main.ts` in place of the three name guards.
- **Correction:** my §11.30 item 2 was a false finding. The old name path already wrote all four bytes; the new
  code is equivalent.
- **Gates**, one after another: build `index-Dn4MlLpw.js` (unchanged); ROM 3424/3424; no-ROM 3218 / 206 skip.
- **Mutations:** 3/3 of mine caught.
- **Checkpoint-06 is complete.**
- **Next:** the checkpoint-07 brief (§11.33), `MainInBattleLoop`, which closes A5c3b.

Local commit only.

### 2026-10-20 (A5c3b checkpoint-06 fix — awaiting Claude's check) — Codex

Implemented §11.31; results and §10.18 corrections in note 68 §10.18a. Player reload before the charge
test; enemy GetName list index/type/bank inputs and NamedObjectIndex output asserted. Original numeric/hit/apply
bodies restored, shims deleted; three guards replaced by one main-rooted import-graph test for all 13 ports.
20/20 mutations caught/restored. Gates once sequentially from checked `game/`: typecheck/build clean,
ROM **3424/3424** (first run, no one-off failure), no-ROM **3218 pass / 206 skip**, 156 files.
Bundle `index-Dn4MlLpw.js`, SHA256 `43dd8163…` unchanged. Earlier tests passed unedited except the three
authorized guards; no production wiring. One local commit, never pushed. Stop for Claude; checkpoint-07 not started.

### 2026-10-20 (A5c3b checkpoint-06 checked: two items and a cleanup) — Claude

Checkpoint-06 is right apart from two small items (note 68 §11.30).
- **What's right:**
  - the `{ b, exit }` contract;
  - the full flow on both sides;
  - the level swaps;
  - all six effect tables;
  - `HandleExplodingAnimation`'s bug kept;
  - Rage, ghost, Mirror Move / Metronome;
  - the new WRAM cells.
- **Item 1, my brief's error, flagged by Codex:** the player calls `GetCurrentMove` before the charge test; only
  the enemy skips it.
- **Item 2:** the enemy's charge release must also write `GetName`'s inputs (`wNameListIndex` / `wNameListType` /
  `wPredefBank`).
- **Cleanup ruling:** remove the three re-export shims. Replace the three source-name guards with one import-graph
  test from `main.ts`.
- **Gates**, one after another: build `index-Dn4MlLpw.js` (unchanged); ROM 3426/3426; no-ROM 3220 / 206 skip.
- **Mutations:** 12/12 of mine caught.
- **Next:** the checkpoint-06 fix (§11.31), then checkpoint-07.

Local commit only.

### 2026-10-20 (A5c3b checkpoint-06 — awaiting Claude's check) — Codex

Unused execution Programs and helpers compose the earlier checkpoints; note 68 §10.18. 260 new no-ROM
tests, 226 call/frame ledgers, 224/224 mutations caught/restored. Earlier numeric/hit/application bodies
moved byte-identically behind their stable exports so their guard tests stay unedited. Every existing test
passed. New fixture tuple typing corrected, then sequential gates passed: typecheck/build clean, ROM
**3426/3426** (first run, no flake), no-ROM **3220 pass / 206 skip**. Bundle `index-Dn4MlLpw.js`, SHA256
`43dd8163165da59ada90b520deffda517d47d062a79698d97e1f5cd429da79f1`, unchanged. **Claude: confirm the player
charging reload discrepancy recorded in §10.18; implementation follows §11.29 as directed.** Local commit
only. Stop for Claude's check; checkpoint-07 not started. A5c3f alarm carry-over unchanged.

### 2026-10-20 (A5c3b checkpoint-05b checked) — Claude

Checkpoint-05b passes (note 68 §11.28).
- **What I checked:**
  - `MoveHitTest` / `CalcHitChance` (including `CheckTargetSubstitute`'s A overwrite and the returned flags);
  - Counter;
  - `ApplyAttack*` / `ApplyDamage*` (LE HP-bar byte order, overkill, Psywave asymmetry and freeze);
  - `AttackSubstitute`;
  - the failure / crit / effectiveness texts;
  - the new WRAM addresses;
  - `battle_arithmetic.ts` moved out unchanged.
- **Gates**, one after another: build `index-Dn4MlLpw.js` (unchanged); ROM 3166/3166 (no flake); no-ROM 2960 / 206
  skip.
- **Mutations:** 14/14 of mine caught.
- **Next:** the checkpoint-06 brief (§11.29), `ExecutePlayerMove` / `ExecuteEnemyMove`:
  - the `{ b, exit }` return contract;
  - the level swaps on every branch;
  - `HandleExplodingAnimation`'s enemy-side status bug;
  - `HandleBuildingRage`, the ghost text and the effect arrays.

Local commit only.

### 2026-10-20 (A5c3b checkpoint-05b — awaiting Claude's check) — Codex

Unused `battle_hit.ts` / `battle_apply.ts`: hit/chance, Counter, fixed damage/Psywave, HP application,
Substitute and failure/crit/effectiveness texts, per §11.27. Results in note 68 §10.17. Shared unchanged
Multiply/Divide; reused RNG, HP/HUD Programs and text runner. 240 new no-ROM tests, 164/164 mutations
caught/restored. Every existing test passed unedited. Gates once sequentially from checked `game/`:
typecheck/build clean, ROM **3166/3166** on first run (no flake), no-ROM **2960 pass / 206 skip**.
Bundle `index-Dn4MlLpw.js`, SHA256 `43dd8163165da59ada90b520deffda517d47d062a79698d97e1f5cd429da79f1`,
unchanged. No game imports of the new modules. Local commit only. **Stop for Claude's check;
checkpoint-06 not started.** A5c3f alarm carry-over unchanged.

### 2026-10-20 (A5c3b checkpoint-05 fix checked; checkpoint-05 complete) — Claude

The fix passes (note 68 §11.26).
- **What I checked:** the circular rotate through `battleRandom`; `drawBattleRandom` and `loadMonHeader` removed;
  `battle_loaders.ts` changed only by `export`; every new crit case by hand.
- **Gates**, one after another: build `index-Dn4MlLpw.js` (unchanged); no-ROM 2720 / 206 skip. The first ROM run
  had one failure that I didn't capture; three re-runs gave 2926/2926. It looks like a flake; name it if it
  recurs.
- **Mutations:** 5/5 of mine caught.
- **Checkpoint-05 is complete.**
- **Next:** the checkpoint-05b brief (§11.27): `MoveHitTest` / `CalcHitChance`, Counter, `ApplyAttack` /
  `ApplyDamage`, `AttackSubstitute`, and the failure / crit / effectiveness texts.

Local commit only.

### 2026-10-20 (A5c3b checkpoint-05 fix — awaiting Claude's check) — Codex

Fixed the circular crit rotate per note 68 §11.25; results in §10.16a. Reused `battleRandom` and exported
`getMonHeader`, removed both copies, rewrote the crit cases and added wrap/borrow coverage. Four RNG tests
removed, two crit tests added: 34 tests in the damage file. All four requested mutations failed and were
restored. Every test outside that file passed unedited. Gates once, sequentially from checked `game/`:
typecheck/build clean; ROM **2926/2926**; no-ROM **2720 pass / 206 skip**. Bundle `index-Dn4MlLpw.js` unchanged,
SHA256 `43dd8163165da59ada90b520deffda517d47d062a79698d97e1f5cd429da79f1`. No production import of the damage
module. Local commit only. **Stop for Claude's check; checkpoint-05b not started.** A5c3f alarm carry-over unchanged.

### 2026-10-20 (A5c3b checkpoint-05 checked: one defect) — Claude

Checkpoint-05 does not pass yet (note 68 §11.24).
- **What's right:**
  - `GetDamageVars*`, `GetEnemyMonStat`, `CalculateDamage` (freeze, caps, shared add), the multiply/divide over the
    HRAM union, `AdjustDamageForMoveType` and `RandomizeDamage` all match the ASM;
  - a deleted probe of mine fuzzed 65,000 cases against the integer formulas.
- **The defect:** `CriticalHitTest`'s `rlc a` is a circular rotate, not a rotate through carry (pkmn/engine
  `rotl(…, 3)` agrees). The port and four tests pin the carry version, so speed 36 wrongly doesn't crit on draw 2.
- **Gates**, one after another: build `index-Dn4MlLpw.js` (unchanged); ROM 2928/2928; no-ROM 2722 / 206 skip.
- **Mutations:** 8/9 of mine caught; the ninth is the correct rotate, which fails exactly the four wrong tests.
- **Next:** the checkpoint-05 fix (§11.25, Grok): circular rotate via `battleRandom`, delete `drawBattleRandom`,
  rewrite the crit tests, reuse an exported `getMonHeader`. Then checkpoint-05b.

Local commit only.

### 2026-10-20 (A5c3b checkpoint-05 — awaiting check) — Grok

Damage numbers from the ASM, in unused `battle_damage_asm.ts` (note 68 §10.16, DECISIONS #77). 36 tests. Defense 0 yields `serviced` and never returns. 65/65 mutations caught and restored. Gates once from `game/`: typecheck/build clean, bundle `index-Dn4MlLpw.js` unchanged (`43dd8163…`), ROM **2928/2928**, no-ROM **2722 pass / 206 skip**. Nothing in the game imports the module. `damage.ts` and the checkpoint-04 adapter are unchanged. Stopped for Claude's check. Checkpoint-05b not started. **A5c3f carry-over** unchanged: `BattleState`'s two alarm cells delegate to the audio module or are removed. Local commit only.

### 2026-10-20 (A5c3b checkpoint-04 checked; A5c3b1 complete) — Claude

Checkpoint-04 passes (note 68 §11.22). Codex built it and stopped on the alarm guard; Grok finished it under §11.21.
- **What I checked:**
  - the drain helper (BC, Toxic 0 → 256, little-endian HP-bar scratch words);
  - the heal clamp with 16-bit wrap;
  - the text/animation order and animation ids;
  - the 20-frame HP-0 branch;
  - `CheckNumAttacksLeft`;
  - the new WRAM addresses;
  - the alarm ruling applied, with the guard test unedited.
- **Gates**, one after another: build `index-Dn4MlLpw.js` (unchanged); ROM 2892/2892; no-ROM 2687 / 205 skip.
- **Mutations:** 7/7 of mine caught.
- **A5c3b1 (checkpoints 02–04) is complete.**
- **Next:** the checkpoint-05 brief, the damage numbers ported from the ASM under #77 (§11.23). Checkpoint-05b takes
  the hit test, Counter, the application, Substitute and the texts.

Local commit only.

### 2026-10-20 (A5c3b checkpoint-04 — finished after Codex's stop) — Grok

Codex's uncommitted checkpoint stayed. Claude's ruling (§11.21) applied: the alarm bridge is gone, and the audio module is the only owner of the alarm byte (note 68 §10.15). 105 new tests. Alarm-path mutations re-checked, including a new `$D082` sync, all caught and restored. Gates once, idle, from `game/`: typecheck/build clean, bundle `index-Dn4MlLpw.js` unchanged (`43dd8163…`), ROM **2892/2892**, no-ROM **2687 pass / 205 skip**. **A5c3f carry-over:** `BattleState`'s `wLowHealthAlarm` (`$D082`) and `wLowHealthAlarmDisabled` must delegate to the audio module or be removed. Stopped for Claude's check. Checkpoint-05 not started. Local commit only.

### 2026-10-20 (A5c3b checkpoint-04 - stopped on existing-test failure) - Codex

Implementation and104 new tests remain uncommitted; note68 section10.15 records the stop. Restored focused
check337/337;103/103 mutations caught/restored. Typecheck/build passed; bundle index-Dn4MlLpw.js unchanged.
ROM gate:2890 pass,1 failure in audio/low_health_alarm.test.ts:183: its source scan allows setLowHealthAlarm
calls only in audio/index.ts; the new battle_hud_state.ts bridge adds a caller. Existing tests unedited;
stopped immediately, no no-ROM gate, baseline unchanged. Await Claude's ruling; checkpoint-05 not started.

### 2026-10-20 (A5c3b checkpoint-03 checked) — Claude

Checkpoint-03 passes (note 68 §11.19).
- **What I checked:**
  - both status checks, row by row;
  - the animation and move constants;
  - the self-hit on both sides;
  - disobedience (badge caps with `<=`, the single SWAP, the unsigned nap, the ignore-text order, the alternate slot
    leaving `wPlayerMoveListIndex` alone);
  - the new WRAM addresses.

  No existing test was edited.
- **Gates**, one after another: build `index-Dn4MlLpw.js` (unchanged); ROM 2787/2787; no-ROM 2582 / 205 skip.
- **Mutations:** 8/8 of mine caught.
- **Next:** the checkpoint-04 brief, residual damage, the `UpdateHPBar2` Program and the HUD composition (§11.20,
  Codex).

Local commit only.

### 2026-10-20 (A5c3b checkpoint-03 — complete, awaiting check) — Codex

Both status paths and disobedience ported with explicit continuations, shared self-hit ports and committed text
(note 68 §10.14). Added 146 tests; 129/129 mutations caught/restored; existing tests unedited. Corrected a new
test's Array.at typecheck error, then the ordered gates passed: typecheck/build, ROM 2787/2787, no-ROM 2582 pass /
205 skip. Bundle index-Dn4MlLpw.js unchanged. One local commit only; stopped for Claude's check; checkpoint-04
not started.

### 2026-10-20 (A5c3b checkpoint-02 checked) — Claude

Checkpoint-02 passes (note 68 §11.17).
- **What I checked:** the used-move handlers, `GetMoveGrammar` (resolved against the move constants), `GetCurrentMove`,
  `ReloadMoveData`, the announce/PP sites, and the big-endian words (only the ruled test edit).
- **A probe** compared all 165 move records with the ROM's `Moves` table: 0 mismatches.
- **Gates**, one after another: typecheck clean; build `index-Dn4MlLpw.js` (unchanged); ROM 2641/2641; no-ROM
  2436 / 205 skip.
- **Mutations:** 6/6 of mine caught.
- **Next:** the checkpoint-03 brief, the status checks and disobedience (§11.18, Codex).

Local commit only.

### 2026-10-20 (A5c3b checkpoint-02 — complete, awaiting check) — Codex

Resumed after Claude ruled the wrong-directory run skipped, not a test failure. From game/: restored
focused check78/78, then final gates once in order: typecheck/build clean, ROM2641/2641, no-ROM2436 pass /
205 skip. 50 new tests;46/46 mutations caught/restored. Only the ruled existing alias case changed.
Bundle `index-Dn4MlLpw.js` and its SHA256 are unchanged. Note68 §10.13 contains the implementation,
old/new endian expectations, mutation evidence and gates. One local commit; never pushed.
**Stopped for Claude's check; checkpoint-03 not started.**

### 2026-10-20 (A5c3b checkpoint-02 — stopped before gates) — Codex

Prepared unused move-data/text modules and50 new tests; BE fix and the sole ruled alias-test edit pass
28/28 in isolation; correct combined focused run passed78/78. 46/46 mutations caught/restored.
The post-mutation check was mistakenly run from the repo root, bypassing game's Vitest/fetch setup:
`Invalid URL: pokemon.json`,78 tests skipped. Initially stopped; Claude subsequently ruled this a skipped
run, not a test failure, and re-ran correctly:78/78 pass. The completion entry above records resumed gates
and close-out. Note68 §10.13 contains the ruled expectation edits and mutation evidence.

### 2026-10-20 (O-43 answered) — the user, recorded by Claude

"yes to your recommendation" → DECISIONS #77. A5c3b checkpoint-05 ports the damage, hit and crit routines from the
ASM, and the audit verifies them. Next is still checkpoint-02 (Codex, note 68 §11.16). Local commit only.

### 2026-10-20 (A5c3b checkpoint-01 checked) — Claude

Codex's trace passes (note 68 §11.15). I re-read the menu gates, the speed tie, sleep, confusion, Bide, Toxic, the
crit text's wait, `PlayMoveAnimation`, disobedience and `GetCurrentMove` against the ASM.
- **The six questions are answered.** The Bide words and `wExpAmountGained` are big-endian. They were wrong since
  A5c3a checkpoint-03, my miss. Checkpoint-02 fixes them, with one ruled test edit.
- **Divide by 0:** the cartridge freezes. The port keeps the freeze as a never-ending serviced Program.
- **Invalid states** throw `BattleUnsupportedState`; glitch moves go to J2 (note 57).
- **The b1 / b2 split** (checkpoints 02–07) is approved.
- **O-43 is new, for the user:** port the damage, hit and crit routines from the ASM in A5c3b, or keep them for the
  audit. Checkpoint-05 waits for the answer.
- **Next:** the checkpoint-02 brief (§11.16, Codex).

Local commit only.

### 2026-10-20 (A5c3b checkpoint-01 — trace, awaiting check) — Codex

Traced the turn from pret `e89ead15` in note 68 §12, with numbered evidence in
`notes/68-a5c3b-checkpoint-01/`: both execution orders, statuses/disobedience, damage/text/PP, RNG/frame
ledgers, later-slice ports/fakes, oldamber comparison and the complete engine catalogue mapping.
Six questions for Claude include math/RNG scope, Bide byte order and unsupported move records; proposed
b1/b2 checkpoints 02–07 reuse the existing HP scheduler and PP ports. No code/tests changed; no gates.
Diff scope checked: only `notes/` and this STATUS. Local commit: `A5c3b checkpoint-01: trace the turn`.
**Stopped for Claude's check and plan ruling; checkpoint-02 not started.**

### 2026-10-20 (A5c3a checkpoint-05 checked; A5c3a complete) — Claude

Checkpoint-05 passes (note 68 §11.13), so **A5c3a is complete**.
- **What I checked:**
  - the host's three frame kinds;
  - the per-print `actors` / `asm` seam, with defaults unchanged and no leaking;
  - `$D11D` ending as the enemy's dex number (`palettes.asm:28–41`, `297–313`);
  - the bar-colour addresses (`wram.asm:1222–1228`);
  - no existing test edited.
- **Gates**, one after another:
  - typecheck clean;
  - build 160 modules, `index-Dn4MlLpw.js`, matching Codex's record and changed only by the live `textbox.ts`
    seam;
  - ROM 2591/2591;
  - no-ROM 2386 / 205 skip.
- **Mutations:** 4/4 of mine caught.
- **Next:** the A5c3b checkpoint-01 brief, a trace of the turn with no code (Codex), in §11.14. Its results become
  note 68 §12, A5c3b's plan.
- Local commit only.

### 2026-10-20 (A5c3a checkpoint-05 — awaiting check) — Codex

Added unused host, per-print runner options and the palette's `$D11D` write (note 68 §10.12). 27 new tests;
existing tests unedited, 36/36 mutations caught/restored. Fixed a new mock's initial typecheck error, then both
full idle gate rounds pass: typecheck/build clean, ROM **2591/2591**, no-ROM **2386 / 205 skip**. Final builds
hash identically; live TextBox seam changes the prior bundle, host excluded. Local commit only. Stop for Claude's
check to close A5c3a; A5c3b not started.

### 2026-10-20 (A5c3a checkpoint-04b checked) — Claude

Checkpoint-04b passes (note 68 §11.11). The trainer list and band loop, the type bypass and the dex views match the
ASM. Only §11.10's four test edits, plus setup. Gates, one after another: typecheck clean, build 160 modules
`index-ColW8QAX.js` (changed by the `trainer_ai.ts` dispatch export, same behaviour), ROM 2564/2564, no-ROM 2359 /
205 skip; 4/4 of my mutations caught. Trainer-AI audit line added to note 57. Checkpoint-05 brief in §11.12 (the
host owns no audio clock; the TextBox runner seam; `$D11D` after the palette). Local commit only.

### 2026-10-20 (A5c3a checkpoint-04b — awaiting check) — Codex

Fixed type bypasses, palette dex views, and trainer candidate-list/band sampling; removed the raw moves import.
43 new tests; exactly §11.10's four approved cases plus cache setup edited (old/new expectations in §10.11).
38/38 mutations caught/restored, including all four edited cases. Gates once, serially, idle: typecheck/build clean,
ROM **2564/2564**, no-ROM **2359 / 205 skip**. Local commit only; stop for Claude. Checkpoint-05 not started.

### 2026-10-20 (A5c3a checkpoint-04 checked) — Claude

Checkpoint-04 passes as briefed (note 68 §11.8): RNG, modified stats with the mod-0 ROM read, double/halve, the wild
bands and Metronome match the ASM. Three fixes first, as checkpoint-04b (§11.9):
- set-damage moves and Counter skip the type walk;
- the palette views must convert internal ids to dex numbers;
- the trainer path must use `AIEnemyTrainerChooseMoves`' list and the band loop (my §11.6 brief was wrong there).

Plus one cleanup: the `?raw` moves import. Gates, one after another: typecheck clean, build 160 modules
`index-D-cKR3ww.js`, ROM 2521/2521, no-ROM 2316 / 205 skip; 3/3 of my mutations caught. Audit line added to note 57.
Local commit only.

### 2026-10-20 (A5c3a checkpoint-04 — awaiting check) — Codex

Added unused RNG/stat/math/selection ports and real party type/move/species packing (note 68 §10.10). 110 new
no-ROM tests; all existing tests unedited. 104/104 mutations caught/restored, including last-row vs first/product.
One idle, sequential gate pass: typecheck/build clean (unchanged bundle), ROM **2521/2521**, no-ROM **2316 / 205 skip**.
Audit floor-to-zero gap logged in note 57. Local commit only. **Stop for Claude; checkpoint-05 not started.**

### 2026-10-20 (checkpoint-04 handoff) — Claude

Read the whole codebase at the user's request; baselines re-run (typecheck clean, ROM 2411/2411, no-ROM 2206 / 205
skip). Two findings into note 68 §11.7: `wDamageMultipliers` is the last matching `TypeEffects` row, not a product
(corrects the checkpoint-04 brief), and stat experience isn't modeled anywhere (O-42, for A5c3d). The user renamed
"CP" to "checkpoint-NN" and named Codex for checkpoint-04 (DECISIONS #76). Docs only. Local commit only.

### 2026-10-20 (session closed) — Claude

The user stopped for the day. Context files brought up to date: STATUS, CLAUDE.md *Where things stand*, PLAN (A5 row),
PROJECT (*State*), CONVENTIONS (CP2/CP3 marked checked). **Resume with A5c3a CP4:** Grok implements from note 68
§11.6 (paste-ready prompt in the previous Claude turn; the brief itself is complete). Then Claude checks CP4, and CP5
(the host and verification) closes A5c3a. Baselines: ROM 2411/2411, no-ROM 2206 / 205 skip. Local commits only.

### 2026-10-20 (A5c3a CP3 checked) — Claude

CP3 passes (note 68 §11.5). Loaders, penalties, badge boosts, write-backs and the `partySpecies` view match the ASM.
Zero A5c2 test edits: the fixtures are plain objects, and a new view test proves the one-byte `$D11D`. Gap carried
to CP4: `partySlotFromPokemon` packs zero types and zero moves. CP4 brief in §11.6. Gates, one after another:
typecheck clean, build 160 modules `index-D-cKR3ww.js`, ROM 2411/2411, no-ROM 2206 / 205 skip. Local commit only.

### 2026-10-20 (A5c3a CP3 — awaiting check) — Grok

Implemented note 68 §11.4 in `battle_state.ts` and `battle_loaders.ts` (detail in §10.9). One WRAM cell per address. A5c2's contexts are a view over it. Zero A5c2 test edits: `move_selection_menu.test.ts:237` still passes because that fixture is a plain object (`item_effects.asm:2802–2807` writes both names of `$D11D`; the new view test asserts `usingPPUp === maxPP`). 28 new tests. Gates once, sequential, idle: typecheck clean, build 160 modules `index-D-cKR3ww.js` (the new modules are not on the production graph), ROM **2411/2411** (138 files), no-ROM **2206 pass / 205 skip**. **CP3 awaits Claude's check; CP4 not started.** Local commit only.

### 2026-10-20 (A5c3a CP2 checked) — Claude

CP2 passes (note 68 §11.3). Handlers, `TX_LOW`, the 1-digit walk, `<USER>`/`<TARGET>` and `DoneText` match the ASM;
the two edited `text_runner.test.ts` assertions are accepted. The DoneText cursor change is live code but invisible
today: no committed program prints after a `<DONE>`/`<PROMPT>`. CP3 brief in §11.4 (moves the penalties and badge
boosts into CP3, because the loaders call them). Gates, one after another: typecheck clean, build 160 modules
`index-D-cKR3ww.js`, ROM 2383/2383, no-ROM 2178 / 205 skip. Local commit only.

### 2026-10-19 (A5c3a CP2 — awaiting check) — Grok

Implemented note 68 §11.2 in the text runner and printer (detail in §10.8). `TX_LOW`, 1-digit `TX_NUM`, `<USER>`/`<TARGET>` from `whoseTurn`, the `asm` registry (unregistered still returns `'asm'`), DoneText's cursor, and `MonsStatsRoseText` / `GainedText` / `WithExpAllText`. Two assertions in `text_runner.test.ts` were edited to match the ASM (the unsupported `low` case, and the FAR resume row `AD`). 29 new tests; the suite grew by 28. Gates once, sequential, idle: typecheck clean, build 160 modules `index-D-cKR3ww.js`, ROM **2383/2383** (137 files), no-ROM **2178 pass / 205 skip**. **CP2 awaits Claude's check; CP3 not started.** Local commit only.

### 2026-10-19 (A5c3a CP1 checked) — Claude

CP1 passes (note 68 §11.1). Re-read the cited ASM; every ✎ CP1 correction holds. One gap settled: `$D11D` is both
`wUsingPPUp` and `wMaxPP`, so `move_selection_menu.test.ts:237` pins a state the cartridge never has. Ruling: CP3's
one cell per address wins, and CP3 may fix only such alias assertions, each cited and listed. `curItem` stays a
string view until A5c3e. All seven open questions answered. CP2 brief in §11.2. Gates, one after another, idle:
typecheck clean, build 160 modules `index-Bax8aCF_.js`, ROM 2355/2355, no-ROM 2150 / 205 skip. Local commit only.

### 2026-10-19 (A5c3a CP1 — traced, awaiting check) — Grok

Traced A5c3a CP1 (note 68 §4.1 and §10.1–§10.7). No production code, tests or generated data. Evidence in
`notes/68-a5c3a-cp1/`. Gates twice, sequential, idle machine: typecheck clean, build clean (160 modules,
`index-Bax8aCF_.js` both rounds), ROM **2355/2355**, no-ROM **2150 pass / 205 skip**. **CP1 awaits Claude's
check; CP2 not started.** Local commit only.

### 2026-10-19 (O-41 answered) — the user, recorded by Claude

"yes to all, grok will implement" → DECISIONS #75: the six-sub-slice split, effects ported in A5c3c, catching in
A5c3e, Grok implements. **Next: Grok runs A5c3a CP1.** Local commit only.

### 2026-10-19 (A5c3 plan) — Claude

Wrote `notes/68-a5c3-plan.md` from `core.asm`'s routine map, `init_battle.asm`, `end_of_battle.asm`, upstream's
`battle.ts` / `effects.ts` / `main.ts`, and the reference implementations (`oldamber`'s C battle, `pkmn/engine`'s Gen 1
mechanics and bug catalogue, `gen1recomp`). Findings: A5c3 is about 27 CPs, not 5–6; upstream's effects embed
invented text, so porting `effects.asm` beats adapters; catching must come before A5f; `EndOfBattle` zeroes START's
cursor (note 67 corrected). No code changed. **Next: the user answers O-41.** Nothing pushed.

### 2026-10-19 (A5c2 CP5 checked; A5c2 complete) — Claude

Checked Codex's CP5 completion (`09a0b26`, note 67 §11.19). **Passes; A5c2 is complete.** Both fixes are as briefed;
typecheck clean, ROM **2355/2355**, no-ROM **2150 / 205 skip**. **Next: Claude writes A5c3's plan note.** Nothing
pushed.

### 2026-10-19 (A5c2 CP5 complete — awaiting check) — Codex

Fixed the refusal's frozen picture and CANCEL's recursive redisplay; six tests added,2/2 mutations caught/restored
(note67 §11.18). Gates twice sequentially with zero other test processes: typecheck/build clean, ROM **2355/2355**,
no-ROM **2150 pass /205 skip** both rounds. No timeout changes or recurrence; prior party/status and CP4 tests
unedited. Baselines/docs updated. **CP5 completion awaits Claude's check; A5c3 not started.** Local commit only;
nothing pushed.

### 2026-10-19 (A5c2 CP5 partial checked) — Claude

Checked Codex's CP5 partial (`2705b3f`, note 67 §11.17). **The two timeouts are load, not a regression:** my idle run
is **2349/2349**, and the two tests take 82 and 874 ms alone. The partial passes against the ASM, and the contact sheet
is right. **Two fixes before closing:** the refusal text's frozen picture, and CANCEL's tail jump. Then gates twice on
an idle machine (§12). **Next: Codex finishes CP5.** Nothing pushed.

### 2026-10-19 (A5c2 CP5 partial — stopped for check) — Codex

Added unused choose-only party hand-off, retained submenu, status reload/switch/quit tails;22 new tests and the
contact sheet; corrected CP4's cursor-byte test;13/13 mutations caught/restored (note67 §11.16). Archived four
old entries verbatim first (`4cadab0`). Typecheck/build pass; ROM **2347 pass /2 existing 5000ms timeouts** (Pewter
tripwire, text-program ASM macro oracle). Stopped under §5: no-ROM/round2 not run. Existing party/status tests
unedited. Frozen refusal-text/partial redraw limit recorded. **CP5 partial awaits Claude; A5c3 not started.**
Local commit only; nothing pushed.

### 2026-10-19 (A5c2 CP4 checked) — Claude

Checked Codex's CP4 (`a7ed94d`, note 67 §11.15). **Passes, with one test gap:** the RUN-type cursor-byte test picks
row 0, so its mutation survives (CP5 step 0). Re-ran ROM **2327/2327**, no-ROM **2122 / 205 skip**, and three more
mutations (caught). Wrote the CP5 brief (§12: the party hand-off, contact sheet, gates twice). **Next: Codex runs CP5.**
Nothing pushed.

### 2026-10-19 (A5c2 CP4 — awaiting check) — Codex

Added unused DisplayBattleMenu, bag and RUN, logical buffers/PrintText owner, ordered HUD palette/alarm handling
and ListMenu's default-off simulated path. Added 52 no-ROM tests; all existing tests unedited; 14/14 mutations
caught/restored (note67 §11.14). Gates once sequentially: typecheck/build clean, ROM **2327/2327**, no-ROM **2122
pass /205 skip**. No game entry-point, extractor or generated changes. **CP4 awaits Claude's check; CP5 not
started.** Local commit only; nothing pushed.

### 2026-10-19 (A5c2 CP3 checked) — Claude

Checked Codex's CP3 (`921adf3`, note 67 §11.13). **Passes.** Re-ran typecheck, ROM **2275/2275**, no-ROM **2070 / 205
skip**, and three mutations of my own (all caught). Checked `FormatMovesString`, `AddBonusPP`, `AnyMoveToSelect`, the
key order, the swap and `PlaceMenuCursor` against the ASM. `ListMenu`'s cursor now uses the shared, ASM-faithful
routine, with every old test passing. Wrote the CP4 brief (§12). **Next: Codex runs CP4.** Nothing pushed.

### 2026-10-19 (A5c2 CP3 — awaiting check) — Codex

Lifted TileSurface writers/cursors and the BattleScreen adapter first; step-0 ROM suite passed 2221/2221 with
every existing test unedited. Added the unused MoveSelectionMenu and context/ports, 54 move tests plus four
surface tests; 11/11 production mutations caught/restored (note 67 §11.12). Gates once, sequentially:
typecheck/build clean; ROM **2275/2275**; no-ROM **2070 pass /205 skip**. No main/battle/battle_ui, extractor or
generated changes. **CP3 awaits Claude's check; CP4 not started.** Local commit only; nothing pushed.

### 2026-10-19 (A5c2 CP2 checked) — Claude

Checked Codex's CP2 (`5e13116`, note 67 §11.11). **Passes.** Re-ran typecheck, ROM **2217/2217**, no-ROM **2012 / 205
skip**, and two mutations (both caught). Accepted one small runtime change: `run.json` now preloads with the other
sounds; nothing plays it. Wrote the CP3 brief (§12: `TileSurface`, then `MoveSelectionMenu`). **Next: Codex runs CP3.**
Nothing pushed.

### 2026-10-19 (A5c2 CP2 — awaiting check) — Codex

Added battle-bank RUN extraction/registration and its two generated files, the press-sound bank pin, and the
ROM-tested 27-entry type display table/reverse lookup (note 67 §11.10). All 895 prior generated files unchanged;
setup twice identical. Ten new tests; 6/6 mutations caught and restored. Gates once, sequentially: typecheck/build
clean; ROM **2217/2217**; no-ROM **2012 pass /205 skip**. No menu code, TYPE_NAMES/moves/chart changes or RUN
playback caller. **CP2 awaits Claude's check; CP3 not started.** Local commit only; nothing pushed.

### 2026-10-19 (A5c2 CP1 checked) — Claude

Checked Codex's CP1 (`f832354`, note 67 §11.9). **Passes.** Re-ran the ROM suite (**2207/2207**). Checked
`ManualTextScroll`'s sound wait, `AddBonusPP`, `TypeNames` and the identical press-sound copies against the ASM.
Answered the four questions: keep the shared C+22 opening (#73), an overlay layer for the battle party, RUN's overlap
→ V5, a ROM-tested 27-entry type-name table. Four backlog entries. Wrote the CP2 brief (§12). **Next: Codex runs CP2.**
Nothing pushed.

### 2026-10-19 (A5c2 CP1 — traced, awaiting check) — Codex

Traced all seven CP1 items in note 67 §11.1–§11.8; replaced §2's draft timing with tables and marked corrections
**✎ CP1**. Evidence in `notes/67-a5c2-cp1/`: BG phases, ROM sound/header/type checks and gate logs. Gates twice,
sequentially: typecheck/build clean; ROM **2207/2207**; no-ROM **2009 pass /198 skip**. An earlier interrupted ROM
run and its uncaptured failure cause are recorded in §11.8; both complete repeats passed with no code changes.
Four review questions for Claude (including PSYCHIC_TYPE's display mapping); no production, test or generated-data edits. **CP1 awaits Claude's check; CP2
not started.** Local commit only; nothing pushed.

### 2026-10-19 (O-40 answered) — the user, recorded by Claude

"yes to ur recommendations" → DECISIONS #74: A5c2 as note 67 plans it, `SFX_RUN` in CP2, `UseItem`'s battle bodies in
A5c3. Codex implements. **Next: Codex runs CP1.** Local commit only.

### 2026-10-19 (A5c2 plan) — Claude

Wrote `notes/67-a5c2-plan.md` from `core.asm` 2076–3085, `TryRunningFromBattle`, `HandleMenuInput_`, `DisplayListMenuID`,
the party-menu home routines and `InitBattleVariables`. Findings include: the battle menu's cursor byte is START's;
the move cursor jumps back to the last-used move after SELECT; the move menu reads every 6 frames; the bag hides the
menu box; upstream invents five texts and blocks items in trainer battles; `SFX_RUN` exists only in the battle bank.
No code changed. **Next: the user answers O-40; then CP1.** Nothing pushed.

### 2026-10-19 (session closed) — Claude

The user asked what the palette-timing finding means, then placed its fix in **V5** (DECISIONS #73): every CGB
palette command holds 2 frames before its Delay3, and today's screens advance 2 frames early. Updated the backlog
entry, PLAN's and the queue's V5 rows, and the engine docs (`context/ARCHITECTURE.md` → *Color*, module map;
`battle/ARCHITECTURE.md` → A5c1's modules). **Next session: Claude writes A5c2's plan note** (the battle's menus),
starting from note 66 §10.20's carry-overs. Gates as of A5c1 CP5: ROM **2207/2207**, no-ROM **2009 / 198 skip**.
No remote; nothing pushed.

### 2026-10-19 (A5c1 CP5 checked; A5c1 complete) — Claude

First, at the user's request, undid commands run in the wrong window: **removed the `origin` remote** (Hard rule #9;
nothing was pushed) and deleted `.git/filter-repo/`. `git filter-repo` had changed nothing: all 397 commits kept their
hashes, since none of its paths exist here. It also expired the reflog. Checked the ignored files: the ROM (SHA1
`cc7d0326…4a38e1`), `refs/` on their pinned branches, `pkmn-sprites/` and `node_modules` are intact.
Then checked Grok's CP5 (`585a243`, note 66 §10.20). **Passes; A5c1 is complete.** ROM **2207/2207**, typecheck clean,
alarm checked against the ASM, contact sheet checked (the diamond corners are Yellow's own border tiles). Backlog: SFX
on CHAN5 during the alarm. **Next: Claude writes A5c2's plan note.** Nothing pushed.

### 2026-10-19 (A5c1 CP5 — awaiting check) — Grok

Added the low-health alarm, the `wy` fast-path fallback, and the contact sheet (note 66 §10.19). The alarm runs
after the fade and before music, and returns immediately while bit 7 is clear. Nothing sets that bit. 8/8
mutations caught. Moved the oldest session entries (from 2026-10-18's "session closed" through A5d CP2) verbatim
to HISTORY. Gates twice: typecheck and build clean (159 modules, `index--OzXZl0W.js`); ROM **2207/2207**; no-ROM
**2009 pass / 198 skip**. **CP5 awaits Claude's check. A5c2 not started.** Local commit only.

### 2026-10-19 (A5c1 CP3b and CP4 checked) — Claude

I checked Grok's CP3b (`10b2f4e`) and CP4 (`76110c5`), note 66 §10.18. **Both pass.** Re-ran the ROM suite
(**2193/2193**) and typecheck. Checked the HUD order, alarm branches, enemy divide and the `DrawHPBar` sliver (`de` is
restored, so the colour sees the pre-sliver 0) against the ASM. One old renderer edge (a band crossing a non-aligned
`wy`) goes into CP5 step 0. Wrote the CP5 brief into §11. **Next: A5c1 CP5.** Nothing pushed.

### 2026-10-19 (A5c1 CP4 — awaiting check) — Grok

Added the battle HUD writers and the HP bar's decrease (note 66 §10.17). Both are unused by battle. 42 HUD
fixtures, the 16 HP traces, and every alarm branch. 17/17 mutations caught. Field medicine's tests were not
edited. Gates twice: typecheck and build clean (158 modules, `index-WnW_DSQ-.js`); ROM **2193/2193**; no-ROM
**1995 pass / 198 skip**. **CP3b (`10b2f4e`) and CP4 await Claude's check. CP5 not started.** Local commit only.

### 2026-10-19 (A5c1 CP3b — awaiting check) — Grok

Fixed the two CP3 defects (note 66 §10.16). Border glyphs map to $79–$7E, and `captureText` draws the border then
the inner 4×18. OBJ colours follow the current OBP. Species inputs are documented as dex numbers, and `bandStays`
tests `scxSplit === null`. 4/4 mutations caught. Gates once: typecheck and build clean (158 modules,
`index-DHc45_UK.js` unchanged); ROM **2170/2170**; no-ROM **1972 pass / 198 skip**. **CP3b awaits Claude's check.
CP4 is the next commit. CP5 not started.** Local commit only.

### 2026-10-19 (A5c1 CP3 checked) — Claude

I checked Grok's CP3 (`685c65d`, note 66 §10.15). **Passes, with two required fixes**, both reproduced with a throwaway
probe (deleted): `┌─┐│└┘` throw in `battleGlyphTile`, and `captureText` copies the TextBox buffer's blank border
over the box, so battle text couldn't show; OBJ palettes stay at the install-time OBP. Moved Grok's §10.14 back
into §10 order. Wrote CP3b + CP4 into §11. **Next: CP3b, then CP4.** Nothing pushed.

### 2026-10-19 (A5c1 CP3 — awaiting check) — Grok

Built `BattleScreen` and its pure renderer, unused (note 66 §10.14). No HUD writers and no `main`/`battle` wiring.
32×32 background, battle attribute map, eight OBJ palettes, `PAL_BLACK`, and the 2-hold plus 3-serviced palette step.
12 tests. 22/22 production mutations caught. Gates twice: typecheck/build clean (158 modules); ROM **2169/2169**;
no-ROM **1971 pass / 198 skip**. A cached frame was 0.48 ms. **CP3 awaits Claude's check. CP4 not started.** Local commit only.

### 2026-10-19 (A5c1 CP2 checked) — Claude

I checked Grok's CP2 finish (`a35be0c`, note 66 §10.13). **CP2 passes and is complete.** The census change is exactly
§10.12's; my ROM run is **2157/2157**; the eight entries moved to HISTORY are verbatim. Fixed CLAUDE.md's stale "160
ROM tests skip" (196). Wrote the CP3 brief into §11. **Next: A5c1 CP3** (`BattleScreen` and its renderer). Nothing
pushed.

### 2026-10-19 (A5c1 CP2 finished — awaiting check) — Grok

Finished CP2 as note 66 §10.12. The opcode census now includes `low`, and `ItemUseText00` is the only program that
contains it, with ops `far` `_ItemUseText001`, `low`, `far` `_ItemUseText002`. The runner and its unsupported-op
test are unchanged. Gates twice, one after another: typecheck and build clean (158 modules); ROM **2157/2157**;
no-ROM **1961 pass / 196 skip**. Moved the eight oldest session entries to HISTORY so this file stays under 40 KB.
**CP2 awaits Claude's final check. CP3 not started.** Local commit only.

### 2026-10-19 (A5c1 CP2 partial checked) — Claude

I checked Codex's CP2 partial (`447edd6`, note 66 §10.12). **Passes so far.** The op-and-address bindings, the per-row
cache and the frozen 633 old programs are right. The one ROM failure is a stale A5b4 census: `ItemUseText00` really has
`text_low`. Ruling: add `low` with a guard that only `ItemUseText00` has it; A5c3 must run TX_LOW. **Next: Codex
finishes CP2** (that change, gates twice, baseline). Nothing pushed.

### 2026-10-19 (A5c1 CP2 partial — stopped for check) — Codex

Added all 360 selected programs, 11 opcode-aware bindings, context-aware row caching and independent oracle/frozen
baseline guards (note 66 §10.11; evidence `notes/66-a5c1-cp2/`). Setup twice: only the JSON pair changes, all 633
old programs/pointers and 893 other assets preserved; all output identical between runs. Focused **39/39**,
mutations **24/24** caught/restored; typecheck/build clean. First ROM gate **2155 pass / 1 fail**: untouched
text_runner opcode census omits new `low`. Stopped under §5, leaving the assertion unchanged; no-ROM gates and
round 2 not run. **Claude checks the partial and census finding; CP2 not complete, CP3 not started.** Local commit only.

### 2026-10-19 (A5c1 CP1 checked) — Claude

I checked Codex's CP1 (`92032d3`, note 66 §10.10). **Passes.** Re-ran both trace scripts (368/368 streams match the
ROM); verified the new binding addresses, the HUD tile layout, `CenterMonName`, the status priority, the stat-text
choice, the alarm's 7-bit timer, and the palette command's interrupt-disabled copies. Answered §10.9's four questions
(`SET_PAL_BATTLE` = 2 held frames + Delay3 in our frame model). New backlog finding: **every CGB palette command
holds 2 more frames than the port models** (StatusScreen, party menu, …) and needs a small slice the user places.
Wrote the CP2 brief into §11. **Next: A5c1 CP2.** Nothing pushed.

### 2026-10-19 (A5c1 CP1 — traced, awaiting check) — Codex

Trace only, note 66 §10.1–§10.9; evidence in `notes/66-a5c1-cp1/`. All 368 selected text streams match source/ROM;
360 additions proposed (633→993), with the boxed-nickname binding, three row-cache conflicts and source fallthrough
recorded. Traced VRAM/layers, CGB attributes and blocked VBlanks, HUD cells, both HP-bar directions/types and the
seven-bit/31-update alarm; §2 corrections marked. Four review questions in §10.9. No production or generated-data
changes. Gates twice sequentially: typecheck/build clean, ROM **2124/2124**, no-ROM **1950 / 174 skip**.
**Stop for Claude's CP1 check; CP2 not started.** Local commit only; nothing pushed.

### 2026-10-19 (O-39 answered) — the user, recorded by Claude

"yes to all" → DECISIONS #72: A5c1 as note 66 plans it (five CPs, no runtime change), `IntroScreen` stays, text
extraction option a, Codex implements. **Next: Codex runs A5c1 CP1** (note 66 §11). Local commit only.

### 2026-10-19 (A5c1 plan) — Claude

Wrote `notes/66-a5c1-plan.md` from `core.asm`'s HUD routines, the battle text files, `SetPal_Battle`, the CGB
attribute maps and `low_health_alarm.asm`. Findings: on CGB the battle colours come from the ROM map
`BGMapAttributes_Battle` (the text box takes the player mon's palette); `wExpAmountGained` shares `wStringBuffer`'s
address, which the address-keyed bindings can't tell apart; about 400 new text programs. No code changed.
**Next: the user answers O-39; then Codex runs A5c1 CP1.** Nothing pushed.

### 2026-10-19 (stale docs fixed) — Claude

Read the context files, then at the user's request fixed stale lines: PROJECT's test counts (2123/2105 → 2124), the
pre-A5d transition text in `context/ARCHITECTURE.md`, `overworld/` and `battle/` ARCHITECTURE (the plural module is
gone; the file table now lists A5d's five modules), the Trainers row above, Bill's PC's heading, and a retired marker
in note 65 §1. Docs only; tests not rerun. **Next: Claude writes A5c1's plan note.** Nothing pushed.

### 2026-10-18 (session closed) — Claude

The user asked where the battle's SELECT move swap lands: **A5c2** (`MoveSelectionMenu`), live with A5c3's switch-over.
The facts are in note 57. Archived the seven intro-animation session entries to HISTORY (DECISIONS #61) and stopped the
5173 dev server. **Next session: Claude writes A5c1's plan note** (battle text data, `BattleScreen`, the HUD); the user
approves it, then Codex or Sonnet runs CP1. Gates: ROM **2124/2124**, no-ROM **1950 / 174 skip**. Nothing pushed.

### 2026-10-18 (A5d done; A/B keys swapped) — the user, recorded by Claude

The user play-tested A5d with sound: "everything works as intended". **A5d is done.** At their request, A is now the X
key and B the Z key (`input/input.ts`, DECISIONS #71); docs updated. **Next: A5c1's plan note.** Nothing pushed.

### 2026-10-18 (A5d CP5 checked) — Claude

I checked CP5 (note 65 §10.18). **Passes.** Codex's pending-song test passes. I viewed Sonnet's contact sheets for Route
1, the Forest shrink, the Lab's outward spiral and Pallet, and read all ten run summaries. The survivors, the frozen
sprites, the flash colours, the music (stop at E, song at E+1) and the black hold all match §10.5. The first battle
frames are white; that's upstream's intro (A5e). **Next: the user's play-test with sound (§6.4).** Nothing pushed.

### 2026-10-18 (A5d CP5 steps 3–5: the browser walk) — Claude Sonnet

Ran the walk on spare port 5191 (never 5173) with Playwright, one fresh browser context per attempt and a hand-written
`p151-s` save; observation only, no source edits. Ten transitions reached and checked: Route 1 DoubleCircle and Circle,
Forest wild HStripes and VStripes, Forest trainer Shrink and Split, Lab rival inward and outward spiral, Oak's Pikachu
(Pallet) and the old man's demo (both DoubleCircle). Black-from and tail ticks equal §10.5's +2; the flash BGP table is exact
with OBP0/OBP1 untouched; NPCs and Pikachu go at E+7 and only the player and the `hSpriteIndex` source stay; black
holds to the hand-off and never flashes back. Music: stop at E, `wildbattle`/`trainerbattle` at E+1, nothing after.
No page errors; one handled 404 per run on maps with no wild table (Lab, Pallet, Viridian), upstream baseline. Finding for
the play-test: the first battle frame is white (upstream's intro, A5e's job). Results in note 65 §10.17 part 2; scripts and
screenshots in `notes/65-a5d-cp5/` (five local commits, by group). Server stopped, contexts' storage cleared. **Next:
Claude's CP5 check, then the user's play-test with sound.** Nothing pushed.

### 2026-10-18 (A5d CP5 steps 1–2 done) — Codex

Added one real-main regression (`ecb2d38`): wild turn during a warp's door sound cancels the pending map song.
Removed only beginBattleEntry's cancellation to prove the test fails (routes1 fade requested), then restored
main.ts byte-for-byte. Final gates twice sequentially: typecheck/build clean, ROM **2124/2124**, no-ROM
**1950 pass /174 skip**. Test setup corrections and evidence in note 65 §10.17 (part 1); production unchanged.
Moved the three oldest session entries verbatim to HISTORY to keep STATUS below 40 KB.
**CP5 steps 1–2 done; the browser walk (steps 3–5) is next, by another agent.** Committed locally, never pushed.

### 2026-10-18 (A5d CP4 checked) — Claude

I checked Codex's CP4 (`ed9513a`, note 65 §10.16). **Passes.** Every battle start now runs stop → one frame → PM →
one frame → the chosen transition, holding black until the battle is ready. Re-ran the gates one at a time: ROM
**2123/2123**, no-ROM **1949 / 174 skip**. 2 of my 3 mutations were caught. The survivor is an untested old call
(dropping a warp's pending map song); CP5 adds that test. Logged a V3 backlog entry: `wGymLeaderNo` comes from the
trainer class, not the gym scripts. Wrote the CP5 brief into §11. **Next: A5d CP5.** Nothing pushed.

### 2026-10-18 (A5d CP4 — implemented, awaiting check) — Codex

Note 65 §10.15: ROM object counts first (`366e8a5`, generated diff exactly the JSON pair), then shared
E stop → E+1 PM → E+2 capture/prologue → choice/tail → black until Battle/demo readiness (`e717d38`).
All entries wired; explicit hidden/source slots and Oak aliases; raw sheets preloaded; old transitions retired.
+18 tests; **32/32** production mutations caught/restored (`notes/65-a5d-cp4/`). Sequential gates clean:
ROM **2123/2123** (123 files), no-ROM **1949/174**; build 158 modules, `index-C5g3zY9S.js`.
Existing test changes/reasons and timing evidence logged in §10.15. **Stop for Claude's CP4 check; no CP5 walk.**
Committed locally, never pushed.

### 2026-10-18 (A5d CP3 checked) — Claude

I checked Codex's CP3 (`09a59cf`, note 65 §10.14). **Passes.** Every frame program matches `battle_transitions.asm`
and the tail matches `core.asm`. I decoded the flash, circle and half-circle tables from the ROM myself; they equal the
constants. Re-ran the gates one at a time: ROM **2105/2105**, no-ROM **1932 / 173 skip**. 3 of my 4 mutations were
caught; the survivor is equivalent. CP4 carry-over: the survivor slot table needs each map's ROM object count, because
three maps drop hidden objects from the port's data. Wrote the CP4 brief into §11. **Next: A5d CP4.** Nothing pushed.

### 2026-10-18 (A5d CP3 — implemented, awaiting check) — Codex

Note 65 §10.13: screen and all eight transition frame programs, 8-frame prologue/9-frame tail, native map capture,
frozen raw OBJ renderer, ROM constants and all-map slot tripwires. +62 tests, **59/59** production mutations
caught/restored (`notes/65-a5d-cp3/`). Sequential typecheck/build clean; ROM **2105/2105**, no-ROM **1932/173**,
122 files. CP1's two pre-tail enable snapshots are accounted for explicitly; checked CP1 evidence unchanged.
Main, legacy transitions, extractors and generated assets unchanged; production bundle unchanged. Partial
`122bd04`, then completion commit. **Stop for Claude's CP3 check; CP4 not started.** Nothing pushed.

### 2026-10-18 (A5d CP3 — partial implementation) — Codex

CP3 only: TransitionScreen, literal frame routines, ROM constants/slot guards, native map capture and frozen
OBJ rendering. Typecheck clean; new suites pass **62/62** with ROM. Per-cell oracle covers all three inherited
portions; raster tests use committed Pallet art. CP1's pre-tail enable-flag logging seam is accounted for explicitly.
Main, legacy transitions, extractors and generated assets unchanged. Mutations/full gates and final §10.13 pending.

### 2026-10-18 (A5d CP2 checked) — Claude

I checked Codex's CP2 (`a27a3d3`, note 65 §10.12). **Passes.** Checked against the ASM: the data bytes, the choice table,
the level compare, `PlayBattleMusic`'s branches and the register writers. NPC `textId` equals the object slot on all 24
maps. `wNameBuffer` and `wStringBuffer` are separate, so the name rule holds. Re-ran the gates one at a time: ROM
**2043/2043**, no-ROM **1879 / 164 skip**. 3 of my 4 mutations were caught; the survivor is equivalent. Wrote the CP3
brief into §11 (ROM tables as constants with ROM tests, plus a slot tripwire). **Next: A5d CP3.** Nothing pushed.

### 2026-10-18 (A5d CP2 — implemented, awaiting check) — Codex

Note 65 §10.11: new dungeon/map-ID JSON pair, tile/preset-byte ROM guards, choice/level/name/OAM helpers,
sprite-index writers and the one-frame music facade. No battle wiring or CP3 work. +73 tests; typecheck/build
clean; sequential ROM **2043/2043**, no-ROM **1879 pass /164 skip** (119 files). **46/46** production mutations
caught/restored (`notes/65-a5d-cp2/`). Only two new generated files; all 893 old files unchanged, setup twice
byte-identical. Eleven exact-command cases gain only metadata; no assertion removed. Partial `6b1d8f1`, then
local completion commit. **Stop for Claude's CP2 check; CP3 not started.** Nothing pushed.

### 2026-10-18 (A5d CP2 — in progress) — Codex

CP2 only, note 65 §11 including the clarifications. First partial commit: new transition data/extraction,
choice/level/name/OAM helpers and audio-facade steps. Typecheck clean; the three new suites pass **56/56**
with ROM. Sprite-register writers are in progress; full gates and production mutations still pending.
No battle paths wired. Stop for Claude's check once CP2 is complete; never push.

### 2026-10-18 (docs sync, CP2 brief tightened) — Claude

Read the context files and code. Fixed stale lines: PROJECT's 1913 → 1970 test counts, ARCHITECTURE's "intro CP4 awaiting
check" and the SFX count (16 → 20). Added three clarifications to note 65 §11's CP2 brief: map IDs go in the new data file,
the `hSpriteIndex` writers are in scope, and the preset rival-name bytes are constants with a ROM test. **Next: A5d CP2.**
Docs only; nothing pushed.

### 2026-10-18 (repository orientation) — Codex

At the user's request, read the project instructions, live handoff, context and subsystem architecture documentation,
and reviewed the runtime entry points, data loading, overworld controller, existing transitions and test setup.
Read note 65's CP1 review and CP2 handoff. No implementation slice claimed; **A5d CP2 remains next**.
No code or generated data changed; tests not rerun for this reading-only session. Local documentation commit only.

### 2026-10-18 (planning session closed) — Claude

At the user's request: synced CLAUDE, PROJECT and PLAN to the A5 re-split (#70; A5d at CP2), wrote the CP2 handoff
and brief into note 65 §11, and stopped the 5173 dev server. **Next session: the user relays A5d CP2 to Codex or Sonnet;
Claude checks it.** Nothing pushed.

### 2026-10-18 (A5d CP1 checked) — Claude

I checked Sonnet's A5d CP1 (`a223d7b`, note 65 §10). **Passes.** Verified: C4 (`ReadTrainer` runs before the
transition, last level wins); C1 (Oak's `hTextID` = 1 = his slot); C3. I re-derived both spirals with my own transcriptions:
19 writes past `wTileMap` and 19 unpainted cells outward; inward 359 writes, (9,8) missed, 153 ticks. Decided §10.9's
three questions: the rival-byte rule (an approximation until the J2 naming audit), track `hSpriteIndex`, hold black.
Removed a committed `.pyc` and `err.txt`. **Next: A5d CP2.** Nothing pushed.

### 2026-10-18 (A5d CP1 — trace only) — Claude Sonnet

CP1 only; note 65 §10.1–10.9 plus `notes/65-a5d-cp1/` (a model of `battle_transitions.asm`, `frame_tables.txt`, `ticks_p0.txt`).
Totals confirmed exactly: DoubleCircle 102, Circle 132, HStripes 60, VStripes 54, Shrink 64, Split 64, inward spiral 153, outward 120;
prologue 8, tail 9, `PlayBattleMusic` = stop at E, song at E+1, transition entered E+2. Corrections to §6.1 (C1–C10, marked ✎ there):
- the OAM survivor is the sprite at `hSpriteIndex` (so Oak and the old man stay in their scripted wild-type battles; a walked wild
  step keeps the player only; OAM has 10 blocks); trainer `wCurEnemyLevel` is the **last** party member's;
- Oak's Pikachu walks `CompareLevels` to `wRivalName`+6 and reads `wCurMapConnections` (12): **DoubleCircle** for preset names, Circle
  only for a ≤ 5-letter custom name with zero leftover bytes (**Claude's call**);
- the outward spiral overshoots 19 cells into row 18 and leaves 19 screen cells unpainted; only Viridian Forest is a dungeon (IDs 51);
  the tile is 16 × $FF; no existing test pins any of this (§7's rows are empty).
Gates, run one after another: typecheck clean; ROM **1970/1970**; no-ROM **1810 pass / 160 skip** — unchanged. Local commits
(`A5d CP1 (partial)` ×2, then this one); nothing pushed. **CP1 awaits Claude's check; CP2 not started.**

### 2026-10-18 (O-38 answered) — the user, recorded by Claude

"yes to all" → DECISIONS #70: A5d first, then A5c1–A5c3, A5e, A5f; the battle as a frame program on a `BattleScreen`;
the mechanics audit after V5, before Phase B; the small sub-animation player; Codex implements. **Next: Codex runs A5d
CP1.** Local commit only.

### 2026-10-18 (A5c–A5f plan) — Claude

At the user's request, wrote `notes/65-a5c-a5f-plan.md` from `core.asm`, `battle_transitions.asm`, `init_battle*.asm`,
`play_battle_music.asm`, the palette packets and the battle texts. The four slices are much bigger than note 21's 6–8
sessions: six sub-slices, about 28 CPs. None of the battle texts are extracted. Battle needs per-block CGB palettes;
`PrintText` in battle is the home routine A5b already ported. Proposed design: the battle as a frame program on a
`BattleScreen`, flow from `core.asm`, math behind ASM-named ports. Proposed order: A5d first, planned in detail.
- **Transitions:** all 8 transitions and the 3-bit choice.
- **The screen they run on:** the overworld tilemap in thirds, with a BGP-only flash (sprites keep their colours).
- **The sprite clear:** NPCs and Pikachu cleared, the trainer kept; a 256-iteration wild-battle quirk.
- **The music:** `PlayBattleMusic`'s one-frame gap.
**O-38 open.** Docs only; nothing pushed.

### 2026-10-18 (intro animation done) — the user, recorded by Claude

The user play-tested with sound: "everything checks perfectly". They asked whether the ~2.4 s of silence between the
intro music fading and Pallet Town could be ~0.5 s shorter. I explained it is the cartridge's: the control-10
fade-to-stop at R+24, then the 40-frame hold, then the room's DF(10) fading silence for 88 updates (note 63 §10.6).
The user: "let's keep it then". **The intro animation is done.** Context files updated. Next: A5c–A5f, planned by
Claude. Nothing pushed.

### 2026-10-18 (intro animation CP5 checked) — Claude

I checked Codex's CP5 (`a1bb38c`, note 64 §10.16). **Passes.** I viewed the screenshots: the red-ink silhouette (CGB
MEWMON shade 2), mirrored Pikachu on the window, the torn frame, the shrink wipe, little Red, the white hold, the room.
The audio trace matches (Routes2 at E2, `shrink` at R, the fade at R+24 / 88 updates, the room's DF at R+166). Zero
console errors or failed requests. **Next: the user's play-test with sound (§6).** Nothing pushed.

### 2026-10-18 (intro animation CP5 — verification) — Codex

Both sequential gate rounds clean: typecheck/build, ROM **1970/1970**, no-ROM **1810 pass /160 skip**; no timeout.
Browser5187: real NEW GAME → NO, YELLOW/BLUE and custom Ab/Ab; all16 requested canvas moments captured and reviewed.
Actual audio: Routes2 after20, shrink atR, fadeR24/88 updates, roomDF R166 after white40; loads ready byR127.
No page/console errors or failed requests (219 responses/path); FPS toast/debug panel exercised. Evidence/scripts
in `notes/64-intro-cp5/`, detail in note64 §10.16. Both stores cleared, browser closed, server stopped/no5187
listener. No game/data/static/test edits. **CP5 awaits Claude's check before user's sound-on play-test.**
Committed locally; never pushed.

### 2026-10-18 (intro animation CP4 checked) — Claude

I checked Codex's CP4 (`7aab141`, note 64 §10.14). **Passes.** The frame program follows the ASM call for call:
`MovePicLeft` 16, custom return 13, preset tail 31, the shrink tail and little Red at R+51. `main.ts` adds the
20-frame entry and 40-frame white exit. No old test was dropped. Re-ran the gates one at a time: ROM **1970/1970**,
no-ROM **1810 / 160 skip**. My 3 timing mutations were all caught. **Next: Codex runs CP5** (the browser walk), then
the user's play-test. Nothing pushed.

### 2026-10-18 (intro animation CP4 — speech and main) — Codex

OakSpeech now runs the CP1 frame program on CP3's screen model. Main holds the menu 20 frames, then the speech owns
Routes2/shrink/control10; done R126, white40, today's room load/music entry R166 (waits white if late). Menu snapshot
preserves E3's clear thirds; cached MEWMON border/OBJ art avoids frame-time loading. Both name-path frame tables,
all three custom-return phases and actual main dispatch tested; all 17 existing Oak tests migrated with reasons.
+12 no-ROM cases; **46/46** production mutations caught/restored. Sequential gates clean: ROM **1970/1970**,
no-ROM **1810 pass /160 skip**, 115 files, no timeout. Detail/migrations/mutations in note 64 §10.14. No generated
changes or browser walk; facing stays down. **CP4 awaits Claude's check; CP5 not started.** Committed locally;
never pushed.

### 2026-10-18 (intro animation CP3 checked) — Claude

I checked Codex's CP3 (`67288c4`, note 64 §10.12). **Passes.** The slides match `OakSpeechSlidePicCommon` byte for byte,
the copy batches and flag restore match `CopyVideoData`, there is one shared BG portion, and Pikachu is mirrored once.
Re-ran the gates one at a time: ROM **1958/1958**, no-ROM **1798 / 160 skip**. My 3 extra mutations were all caught.
CP4 carry-overs are in §10.13: `vblank` as the only tick, nothing unshaded drawn before the pass, little Red one DMA
behind. **Next: Codex runs CP4.** Nothing pushed.

### 2026-10-18 (intro animation CP3 — screen model) — Codex

CP3 only: separate intro tilemap with numeric picture slots, literal slides and the single shared TextBox BG
phase; exact palette pass, WX clipping and Pikachu's mirrored preparation. Choice/API, tests and 26/26 production
mutations recorded in note 64 §10.12. +41 no-ROM tests. Sequential gates: typecheck/build clean, ROM **1958/1958**,
no-ROM **1798 pass /160 skip** (114 files). OakSpeech, main.ts and generated assets unchanged. **CP3 awaits
Claude's check; CP4 not started.** Committed locally; nothing pushed.

### 2026-10-18 (intro animation CP2 checked) — Claude

I checked Codex's CP2 (`5c1edda`, note 64 §10.10). **Passes.** `shrink.json` matches `shrink_1.asm`, and the generated
diff is exactly its two files. Re-ran the gates one at a time: ROM **1917/1917**, no-ROM **1757 / 160 skip**,
typecheck clean. My ID mutation failed 2 tests. Fixed the stale 521 → 524 PNG count in CLAUDE/ARCHITECTURE.
**Next: Codex runs CP3.** Nothing pushed.

### 2026-10-18 (intro animation CP2 — SFX_SHRINK data) — Codex

CP2 only: bank-$02 shrink header `$41d4`, ID `$9c`, extraction/preload registrations, 4 new tests. Setup adds only
`data/audio/sfx/shrink.json` and its static mirror; all 891 existing asset files hash-identical. 9/9 production
mutations caught and restored. Gates ran sequentially: typecheck/build clean, ROM **1917/1917**, no-ROM **1757 pass /
160 skip** (111 files). Details and carry-overs in note 64 §10.10. **CP2 awaits Claude's check; CP3 not started.**
Committed locally; nothing pushed.

### 2026-10-18 (intro animation CP1 checked) — Claude

I checked Codex's CP1 (`149a369`, note 64 §10). **Passes, no required fix.** I re-derived the frame arithmetic
(T1 = 95 … X2 = R + 166), every BGP/OBP byte, the window and slide frames, the shrink wipe and little Red's first render
(R+51). I also checked the shrink header (02:41d4, ID $9c) and Routes2 (02:42cd, $EF) in the symbols branch, MEWMON's CGB
colours, and the facing (`UpdatePlayerSprite` → up). The facing went to the backlog. CP2 carry-overs are in §10.9.
Process note: the gates timed out when run concurrently, so run them sequentially. **Next: Codex runs CP2.** Nothing pushed.

### 2026-10-18 (intro animation CP1 — trace only) — Codex

CP1 only, DECISIONS #69: note 64 §10 records the source-derived E1–X2 tables for preset/preset and custom/custom,
all wait costs, BG portions, palette/window writes, slide tears and real-art checks, shrink wipes/OAM and audio.
Custom return: logical border/pic IDs +13, glyph +16; scanout follows the inherited third. Little Red first R+51;
audio fade completes R+112. Room faces up on cartridge versus down in port, reported only. Typecheck clean;
ROM **1913/1913**, no-ROM **1756 pass /157 skip**, unchanged tests/settings. Initial concurrent-suite runs timed out;
sequential reruns passed (detail in §10.8). Only note 64 and STATUS changed. **CP1 awaits Claude's check; CP2 not
started.** Committed locally; nothing pushed.

### 2026-10-18 (O-37 answered) — the user, recorded by Claude

"yes to 1", "yes to 2 decision a", and Codex "implements, and you test" → DECISIONS #69. The intro slice runs as note 64
plans it. The opening and title screen get their own slice after V5. **Next: Codex runs CP1** (trace only). Local commit only.

### 2026-10-18 (intro-animation plan) — Claude

At the user's request, wrote `notes/64-intro-animation-plan.md` from `oak_speech.asm`, `oak_speech2.asm` and the fade, pic
and VBlank routines. Nearly every step differs today:
- the fades are BGP steps: a silhouette fade-in of 6 × 10, white fades of 3 × 8;
- Pikachu and Red slide in on the window (`rWX` 119 → 7);
- the name slides are tile copies with a one-frame BG-thirds tear;
- each pic load is a 7-frame VRAM copy, which makes the shrink a column wipe;
- after the shrink the music fades and the little overworld Red stands for 50 frames before the last fade;
- `SFX_SHRINK` needs extracting, and Pikachu sits at window (56, 48).

A5b6's custom-name anchor is probably 7 frames short (§2.6; CP1 checks). Backlog: the unported opening/title, and the
shade model's other users. **O-37 open**; Codex runs CP1 after it. Docs only; nothing pushed.



### 2026-10-18 (stale lines) — Claude

At the user's request: PLAN's sequencing note now says done through the map-music fade-out. Codex's `c12a732` had
already fixed STATUS's phase line and PROJECT's counts. Re-ran the ROM suite: **1913/1913** (the first, cold run timed
out once in `text_programs.test.ts` at 5 s; it passes alone in 256 ms and on the re-run). Docs only; nothing pushed.

### 2026-10-18 (context and codebase study) — Codex

Read the entry point, live handoff, project, roadmap, conventions, architecture, relevant decisions and backlog;
checked the latest map-music acceptance against the runtime and notes. Confirmed 24 maps, branch `master`, no remote,
and an initially clean tree at `0c40f42`. Re-ran typecheck and the ROM-backed suite: **1913/1913 across 111 files**.
Corrected stale context summaries only; no gameplay changes or slice claimed. **Next remains Claude's intro-animation
plan (#51).** Committed locally; nothing pushed.

### 2026-10-18 (context update, day closed) — Claude

At the user's request: CLAUDE, PROJECT and PLAN mark the map-music fade-out done; V2-era session entries archived to HISTORY (DECISIONS #61). **Next session: Claude plans the intro animation (#51).** Nothing pushed.

### 2026-10-18 (map-music done) — the user, recorded by Claude

CP4 (`a75ef25`) accepted on its gates and browser trace; the user play-tested: "all passess". **The map-music fade-out is done.** Next: the intro animation (#51). Nothing pushed.

### 2026-10-18 (map-music CP4 — #68 and verification) — Claude Sonnet

Built DECISIONS #68: `handleWarpLoad` sets `pendingWarpMusic`; `gameTick` makes the request (six passes, then DF) once
`isSoundFinished()`; any later music start or the blackout supersedes it; the screen fade is untouched. New
`main_door_audio.test.ts` drives main's real door path on the real audio engines: `go_inside` (20 updates) and
`go_outside` (40) play in full before the fade's ID clear, and the song arrives 88 updates after the request. Four
existing `main.test.ts` cases take one `gameTick` after their warp (reasons in §10.15). 6/6 production mutations caught (my
first sweep missed one; test added). Gates twice: typecheck/build clean, ROM **1913/1913**, no-ROM **1756 pass / 157 skip**.
Muted browser walk on port 5191 (never 5173; save cleared, server stopped): a door out (`go_outside` in full, then the fade,
then the song) and in (`go_inside`), a same-music door (no change), a connection, a won and a fled battle, no sound during
a fade, CONTINUE, the Pallet walk (MuseumGuy across the Lab door, then Oak's Lab music), a blackout, the healing machine and
StatusScreen all behaved as the cartridge does. Route 2 → Pewter itself was not reachable from the debug spots (Viridian →
Route 1 walked instead). Details and the trace table are in note 63 §10.15. Committed locally, never pushed. **Stop for
Claude's CP4 check; then the user's play-test.**

### 2026-10-18 (O-36 answered) — the user, recorded by Claude

"i choose a" → DECISIONS #68: the warp's map-music request waits until the door sound has finished, keeping the
cartridge's audible order. The warp's own timing goes to a backlog warp-timing slice. **Next: CP4.** Local commit only.

### 2026-10-18 (map-music CP3 checked) — Claude

I checked Sonnet's map-music CP3 (`c36928c`, note 63 §10.12). **Passes**, with one decision for the user (**O-36**).
The wiring follows note 63 §10: loaders, connections, battle and evolution returns, the blackout's two requests,
CONTINUE without the menu stop, the flags, and Pallet's MuseumGuy carried into the Lab. The existing-test edits only add
mock entries, plus one assertion flipped to the cartridge's drop rule. Re-ran typecheck and ROM **1910/1910**; my
mutation (no `NO_MAP_MUSIC` skip) failed 1. O-36: the port's short warp clips the door sound when the music changes;
I recommend requesting the fade after the door sound ends. **Next: the user answers O-36, then CP4.** Nothing pushed.

### 2026-10-18 (map-music CP3 — wiring) — Claude Sonnet

CP3 only (note 63 §10.12). One shared `PlaySound` in `audio/index.ts` over the real engines with a real
`determineAudioFunction`; the facade's `playMusic`/`playSFX`/`stopMusic` are PM/PS/SA, with new PN (`playMusicNew`), DM,
the nurse restoration, DF, `updateMusic6Times` and `stopAllSounds`. `AudioFade`'s standalone shims are gone (they now
live only in the engine-test rig); `BIT_NO_AUDIO_FADE_OUT` (StatusScreen) and `BIT_NO_MAP_MUSIC` are real flags in
`audio/audio_flags.ts`. `main.ts`: six passes + DF at warps, CONTINUE, NEW GAME and every battle return (after-battle
reason through the whole evolution queue and the catch demo); DF only at connections; the blackout waits out
`StopMusic(8)`, calls `StopAllSounds`, requests the departed map's song, then the destination's; CONTINUE no longer stops
the title music. The Pallet escort plays MuseumGuy and sets the bit; the Lab clears it and restores. `cancelDrum` checked
on Routes3: it only frees channel 8. +34 tests; **36/36** production mutations caught (my first sweep missed nine, which
I closed). Existing-test changes, each with its reason, are in §10.12. Typecheck and build clean; ROM **1910/1910**,
no-ROM **1753 pass / 157 skip**; no generated data. **Disclosed departure: the port's 8-frame warp cuts a door sound**
(§10.12 item 1), which the play-test will hear. Committed locally, never pushed. **Stop for Claude's CP3 check; CP4 not
started.**

### 2026-10-18 (map-music CP2 checked) — Claude

I checked map-music CP2 (`374d8c4`: Codex implemented, Sonnet finished the handoff; note 63 §10.10). **Passes, no
required fix.** `play_sound.ts` matches `home/audio.asm`, `fade_audio.asm` and `init.asm` branch for branch (SFX
dropped during a fade; reload from control; PlayMusic cancels; the bank compare; completion → SA, bank restore,
PN). Re-ran typecheck and ROM **1876/1876**; my mutation (no SFX drop) failed 2. Carry into CP3: one shared PlaySound
over the real engines, retiring `AudioFade`'s standalone shims, a real `determineAudioFunction`, and the drum check.
**Next: CP3.** Nothing pushed.

### 2026-10-18 (map-music CP2 handoff finished) — Claude

Codex stopped before committing CP2; I finished the handoff and changed no code. Reviewed the uncommitted tree against
note 63 §4 CP2 and `home/audio.asm`, `home/fade_audio.asm`, `home/init.asm`: every item is covered, no existing test is
edited, and there is no `main.ts` or `index.ts` wiring. Re-ran the gates: typecheck and build clean, ROM **1876/1876**,
no-ROM **1719 pass / 157 skip**, matching Codex's logs. Wrote note 63 §10.10 (file by file, the tests, all 44
mutations, the gates). CP2 is done and awaiting Claude's check. Three carry-overs for CP3 are in §10.10, chiefly that
`AudioFade` is still built standalone, so the running game doesn't use the new entries until CP3 shares one
`PlaySound`. Committed locally, never pushed. **Stop for Claude's CP2 check; CP3 not started.**

### 2026-10-18 (map-music CP2 — audio state) — Codex

Pure PlaySound state owns numeric IDs/banks and the fade queue; AudioFade delegates its tick. Distinct PM/PS/PN/
PW/SA/DM/DF, source-checked 49-track/19-SFX table, ID-only SFX clear and six music/SFX passes without fade ticks.
23 new real-rig/identity tests; all 54 existing audio tests unchanged. **44/44** actual one-line production
mutations caught/restored (note 63 §10.10). Typecheck/build clean; ROM **1876/1876**, no-ROM **1719 pass / 157 skip**;
no timeout or generated changes. index.ts/main.ts and caller routing untouched; CP3 wiring remains pending.
Committed locally, never pushed. **Stop for Claude's CP2 check.**

### 2026-10-18 (map-music CP1 checked) — Claude

I checked Codex's CP1 (`f0072f9`, note 63 §10). **Passes; its corrections stand.** The big one: an ordinary SFX leaves
`wNewSoundID` = 0, so during a fade it is **dropped**, not queued. My plan's "silent-music glitch" was a misreading
(note 63 and DECISIONS #67 corrected). The blackout first requests the departed map's song (`StopAllSounds` zeroes
last; `PrepareForSpecialWarp` skips the music fields). The census covers 85 requests and 10 map-music callers. Carry
into CP2: numeric IDs/banks for the reload-from-control case, distinct entry kinds, `UpdateMusic6Times` without a fade
tick. Backlog: UI-beep and evolution-sound gaps. **Next: Codex runs CP2.** Nothing pushed.

### 2026-10-18 (map-music fade-out CP1 — trace) — Codex

Docs only; note 63 §10 covers all seven CP1 items and audits every §2 claim. Census: 85 music/SFX/stop
request expressions + 10 updateMapMusic callers. audio_rig confirms fade 10/8 at 88/72, six Audio1-only passes
do not tick the fade, door SFX end at 20/40. Corrected the plan: ordinary PlaySound SFX leave new ID=0 and
are ignored during a fade, so the claimed bump-silence glitch does not follow from this ASM. Blackout resets
last=0 and requests the departed song before loading the destination header; Mom/nurse/healing jingle use direct
entries. Traced evolution, Lab loss, CONTINUE, real NEW GAME, and the exact Pallet/Lab command points.
Typecheck/build clean; unchanged ROM **1853/1853**, no-ROM **1696 pass / 157 skip**; no timeout. No source/data/test
edits, extraction or browser. Local commit only; nothing pushed. **Stop for Claude's CP1 check; CP2 not started.**

### 2026-10-17 (O-35 answered) — the user, recorded by Claude

The user approved note 63 §9: "yes to 1 and 2, and to 3 it's gonna be Codex" → DECISIONS #67. The full fade-out with
the PlaySound-during-fade rules (incl. the silent-music glitch) and the Pallet/Lab music fix; Codex implements.
**Next: Codex runs CP1** (trace only). Local commit only.

### 2026-10-17 (map-music fade-out plan) — Claude

At the user's request, wrote `notes/63-map-music-fade-plan.md` from the ASM. It covers
`PlayDefaultMusicFadeOutCurrent`'s rules: fade 10 → the new song at update 88, or 8 → 72 after a battle; a same song is
a no-op. Its callers are warps (`LoadMapData`, with `UpdateMusic6Times`), connections, battle returns, the blackout and
CONTINUE. Found: during a fade, `PlayMusic` cancels it, but a plain `PlaySound` SFX replaces the queued song, so the
new music never starts (the Gen 1 silent-music glitch). The Pallet walk should play the "follow me" theme into the lab
(`BIT_NO_MAP_MUSIC`); ours doesn't. Backlog adds the bike/surf music and RIVAL3's flag. **Next: the user answers O-35.**
Docs only; nothing pushed.

### 2026-10-17 (V2c play-test → V2 done) — the user, recorded by Claude

The user play-tested note 62 §6. They asked whether one talk waking Pikachu is intended (yes: emotion 26 ends with
CHECKPEWTERCENTER = `EnablePikachuFollowingPlayer`), then said "this slice passes". **V2c is done, and with it V2:**
Pewter City, its buildings, both guides, Jigglypuff and the sleeping Pikachu. Milestones 5/36. Context updated
(CLAUDE, PROJECT, PLAN, STATUS). **Next: the map-music fade-out (#63)**, planned by Claude first. Nothing pushed.

### 2026-10-17 (V2c CP5 checked) — Claude

I checked Codex's V2c CP5 (`a4d5b07`, note 62 §10.12). **Passes.** Docs only. Gates twice (1853/1853, 1696/157); the
muted 5198 walk covered every §4 CP5 case, and the save was cleared with 5173 untouched. I looked at screenshots 023 (the
song box), 028 (the nurse refusing), 029 (no Pikachu icon), 036 (ZZZ over Pikachu) and 039 (the waking portrait).
**Next: the user play-tests V2c** (note 62 §6). Nothing pushed.

### 2026-10-17 (V2c CP5 — verification and docs) — Codex

No code changes. Typecheck/build passed **twice**; ROM **1853/1853 twice**, no-ROM **1696 pass / 157 skip twice**
(four workers; no known text-program timeout). Muted browser walk on **5198** passed song/17 writes/auto-close,
frozen Pikachu/B collision, nurse refusal, party icon/cancel, Bill's deposit, talk wake/portrait/saved facing,
door wake, debug-panel PAR staying awake, and Viridian's wandering Youngsters. Note 62 §10.12 records results,
method, limits and screenshot index. Spare-origin save cleared; own browser/server stopped; no 5173 or ROM
requests. Docs committed locally; nothing pushed. **Stop for Claude's CP5 check, then the user's §6 play-test.**

### 2026-10-17 (V2c CP4 checked) — Claude

I checked Codex's V2c CP4 (`b3c0648`, note 62 §10.10). **Passes, no required fix.** Emotion 26 runs in the ASM's order:
no turn, the 61-frame ZZZ bubble with updates off, border, portrait 26, SHOWMAPVIEW + Delay3, the wake and facing
write, then a close that restores the saved facing. The party menu cancels the sleeping starter in START, SWITCH and
field medicine (not battle) and draws no icon for it; the Flute tripwire is in place. Tests drive main's real dispatch.
Re-ran typecheck and ROM **1853/1853**; my mutation (no facing restore at close) failed 3. **Next: V2c CP5**, then the
user's play-test. Nothing pushed.

### 2026-10-17 (V2c CP4 - waking and party menu) - Codex

Implemented emotion 26's map/flag priority, frozen ZZZ bubble, exact portrait, SHOWMAPVIEW/Delay3, wake and
saved-facing close; sleeping starter party selection (including SWITCH) now prints/cancels and has no icon.
Real main talk/menu/medicine paths, the Flute tripwire and committed ZZZ rendering are covered; 34/34 one-line
production mutations caught/restored (note 62 section 10.10). Typecheck/build clean; ROM **1853/1853** (+17),
no-ROM **1696 pass / 157 skip**. Default ROM hit the known text-program timeout; it passed alone 7/7, then the
full ROM suite passed with four workers. Committed locally; nothing pushed. **Stop for Claude's CP4 check;
CP5/browser verification not started.**

### 2026-10-17 (V2c CP3 revision checked) — Claude

I re-checked Codex's CP3 revision (`8fcc482`, note 62 §10.8). **Passes.** The Jigglypuff box closes with no A/B wait
(my mutation back failed 6 tests). The nurse branch checks map + flag. The wake and no-wake tests now drive main's
real paths (new game, CONTINUE, the door, blackout, the connection). The song is pinned frame by frame, and the asleep
follower, the B-held block and Bill's deposit are tested. Re-ran typecheck and ROM **1836/1836**. One non-blocking
structural note (N-1 in §10.9). **Next: V2c CP4.** Nothing pushed.

### 2026-10-17 (V2c CP3 revision F-1…F-7) — Codex

Revised Sonnet's `d2e69d1` only: Jigglypuff closes with Hold/A-release only; the dedicated nurse condition
checks Pewter + flag; hide/return commands now respect the heal path's follow checks. Replaced simulated clears
with real main paths and added executed nurse, exact song-timeline, frozen follower, B-collision and real main
Bill's deposit tests. **23/23** one-line production mutations caught/restored (note 62 §10.8).
Typecheck/build **clean**; ROM **1836/1836**, no-ROM **1679 pass / 157 skip** (baseline 1827/1827, net +9).
Both suites passed first final run; the known text-program timeout did not recur. Committed locally; nothing
pushed. **Stop for Claude's CP3 re-check. CP4 not started.**

### 2026-10-17 (V2c CP3 revision reassigned) — the user, recorded by Claude

The user gives the V2c CP3 revision (note 62 §10.7, F-1…F-7) to **Codex** instead of Sonnet: "let me give it to codex
instead". This changes who implements this revision only; DECISIONS #66's plan is unchanged. Local commit only.

### 2026-10-17 (V2c CP3 checked: needs fixes) — Claude

I checked Sonnet's V2c CP3 (`d2e69d1`, note 62 §10.6). **Needs fixes before CP4** (note 62 §10.7):
- **F-1:** the Jigglypuff box waits for A/B. The cartridge's no-wait flag closes it on A's release only (`outerWait:false`).
- **F-2:** the nurse's asleep branch must test map + flag, not "starter alive".
- **F-3…F-6:** several tests only call the functions they claim to test (the warp, CONTINUE, blackout and connection
  clears; the heal-path skips). The Jigglypuff timeline and the readers' tests are missing.
- **F-7:** no real production-mutation list.

The flag module, the frozen update, collision and the spin loop are right. Gates: typecheck clean, ROM 1827/1827 (the
known timeout passes alone). **Next: Sonnet fixes F-1…F-7**, then Claude re-checks. Nothing pushed.

### 2026-10-17 (V2c CP3 — state and song) — Claude Sonnet

V2c CP3 (note 62 §3.1–§3.3, §4 CP3), following §10.3's F-1. New `pikachu/pikachu_following.ts`:
`isPikachuFollowingDisabled` / `disablePikachuFollowing` / `enablePikachuFollowing`, module-level, not saved.
Wired into: `pikachu_follower.ts` (extracted `func_fc76a`; disabled guards in `updateSprite` and `facePlayer`;
`fontLoadedUpdate` calls `func_fc76a`); `overworld/player.ts:332` (`false` → real flag); `main.ts`
(`enablePikachuFollowing` in `handleWarpLoad` only, not `handleBlackoutWarp` — F-1; also `loadSavedGame`,
`startNewGame`; `isPikachuFollowingDisabled` wired at Bill's PC callback). New `story/pewter_pokecenter.ts`:
`registerTextHandler('PewterPokecenter', 3, …)` with `jigglypuffSpin` command (spin loop, both-channels-dead
exit, 17 writes). `story/pokecenter.ts`: Pewter sleeping branch (`ifStarterPikachu following:false →
LooksContentText`, replaces rest of script); three heal-path sites → `following:true`. `script/types.ts`: 
`following?: boolean` on `ifStarterPikachu`; new `jigglypuffSpin`. `script/script_controller.ts`:
`scriptJigglypuffSpin` state, full `jigglypuffSpin` case, updated `ifStarterPikachu` case.
`overworld/overworld_controller.ts` imports the handler. Tests: `pikachu_following.test.ts` (8), 
`pewter_pokecenter.test.ts` (5), extended `pokecenter.test.ts` (4 branch tests), census exclusion removed.
ROM **1827/1827** (+18), no-ROM **1670/157** (+18); typecheck and build clean. Committed locally, nothing pushed.
**Stop for Claude's CP3 check; CP4 not started.**

### 2026-10-17 (V2c CP2 checked) — Claude

I checked Sonnet's V2c CP2 (`d38de78`, note 62 §10.4). **Passes, no required fix.** The four addresses match pret's sym;
both portrait graphics are 25 tiles (400 bytes); the ZZZ emote is 16×16 like the shock emote. Re-ran typecheck (clean),
ROM **1809/1809**, and setup a third time: the tree was unchanged. **Next: Sonnet runs V2c CP3** (note 62 §3.1–§3.3,
with §10.3's F-1). Nothing pushed.

### 2026-10-17 (V2c CP1 checked) — Claude

I checked Sonnet's V2c CP1 (`29c3dab`, note 62 §10). **Passes, one correction (F-1).** Confirmed the 17 writes and the
S+408 exit, `Func_fc82e`, the party menu's check order and the facing restore. I closed the open `$40` item:
`GetSpriteImageBaseOffset` gives Jigglypuff base 5, so its image is `$40|facing`. F-1: a blackout or after-battle map
load must **not** wake Pikachu (`LoadMapData` skips the schedule then); item 3 said otherwise and is corrected.
**Next: Sonnet runs V2c CP2** (data). Nothing pushed.

### 2026-10-17 (V2c CP2 — data) — Claude Sonnet

Added three new graphics (e7b83, e7d13 from bank 39; zzz emote from bank 10) and `PartyMenuText_12cc`
(with `_SleepingPikachuText1` far child) — all addresses from pret's sym file, no byte search. Three
new pixel-equality tests against refs/pokeyellow. Setup ran twice; only `text_programs.json` modified,
three PNGs newly untracked. ROM **1809/1809** (+3), no-ROM **1652/157** (+3 skip); typecheck and build
clean. Committed locally, nothing pushed. Stop for Claude's CP2 check; CP3 not started.

### 2026-10-17 (V2c CP1 — trace) — Claude Sonnet

Ran the full CP1 trace from note 62 §4. Re-measured Jigglypuff's song on `audio_rig` (CHAN2=392, CHAN1=397, both dead by
update 397 — matches note 60). Confirmed `$40` image base and wSprite03 from `PewterPokecenter.asm` objects +
`map_sprite_sets.json`. Traced all 11 readers of the following-disabled flag against ASM and engine; two gaps in
`pikachu_follower.ts` (no following-disabled guard in `updateSprite` and `facePlayer`). Wake points: `performWarpLoad`
and `loadSavedGame` both need `enablePikachuFollowing()` in CP3; `performMapConnection` correct (no call). Emotion 26:
ANIM_SCRIPTS and EMOTION_MOVEMENTS need CP2/CP4 additions; exit phase (SHOWMAPVIEW + CHECKPEWTERCENTER + facing restore)
needed in CP4; net: Pikachu keeps its asleep facing. Party-menu sleeping check fires before swap check — both A-press and
SWITCH target cancelled. Starter-status conditions confirmed. Full results in note 62 §10. Docs only, no code/data/test
changes. No-ROM **1652 pass / 154 skip** (baseline). Typecheck clean. Committed locally, nothing pushed.
**Stop for Claude's CP1 check; CP2 not started.**

### 2026-10-17 (O-34 answered) — the user, recorded by Claude

The user approved note 62 §9 ("yes") → DECISIONS #66: V2c as planned with Claude Sonnet implementing, emotion 26's
ZZZ bubble and exit now (amends #39), the party menu's two sleeping-Pikachu rules now. **Next: Sonnet runs V2c CP1**
(trace only). Local commit only.

### 2026-10-17 (V2c plan) — Claude

At the user's request ("plan the next slice, V2c"; Claude Sonnet will implement), wrote `notes/62-v2c-plan.md` from the
ASM. It replaces note 60 §7:
- `PewterJigglypuff`'s timeline (17 image writes, the channel poll);
- every reader of the following flag (`wPikachuOverworldStateFlags` bit 1) reachable in Pewter's Pokécenter;
- emotion 26 (ZZZ bubble, portrait 26 = e50af/e7b83/e7d13, SHOWMAPVIEW, CHECKPEWTERCENTER);
- when it wakes (every warp's `LoadMapData` and CONTINUE; the flag can stay unsaved).

New readers: the party menu's "There isn't any response..." and the missing icon. Correction: Pikachu doesn't visibly
turn when it wakes (`CloseTextDisplay` restores its facing). Five CPs. Backlog adds the Poké Flute (D) and the Fan
Club / Bill's house checks. **Next: the user answers O-34.** Docs only; nothing pushed.

### 2026-10-17 (V2b play-test → V2b done) — the user, recorded by Claude

The user play-tested note 61 §6: "all works perfect as tested on the browser". **V2b is done:** the museum and gym
guides walk the player as the cartridge's simulated joypad does, the east road is closed before BEAT_BROCK, the walk-offs
and resets match, and the Youngster turns at random until a reload. Context updated (CLAUDE, PROJECT, PLAN, STATUS).
**Next: V2c** (Jigglypuff and the sleeping Pikachu, note 60 §7), starting with its CP1 trace. Nothing pushed.

### 2026-10-17 (V2b CP4 checked) — Claude

Codex wrote CP4 (note 61 §10.19–§10.21) but hit its usage limit before committing; I reviewed the docs-only diff and
committed it (`d4aa2ed`). **Passes:** two unchanged gate rounds (1806/1806, 1652/154); the muted 5197 walk covered all
nine approaches, museum YES, walk-offs, the Youngster's random turns and DOWN after reload, Pikachu, the east block,
and Viridian/Forest NPCs. I looked at screenshots 008, 009, 051 and 099 myself. **Next: the user play-tests V2b** (note
61 §6). Nothing pushed.

### 2026-10-17 (V2b CP4 — verification/docs) — Codex

Two unchanged rounds: typecheck/build clean, ROM **1806/1806**, no-ROM **1652 pass / 154 skip**, no timeout.
Muted 5197 browser walk passed every museum/gym/east approach, walk-off/return, random turns/reload DOWN,
Pikachu and east-block checks; Viridian/Forest NPC glance done. Note 61 §10.19–§10.21 records results and 117-shot
index. Save cleared, browser/servers closed, 5173 untouched. Docs only, local commit, never pushed.
**Stop for Claude's CP4 check**, then user's §6 play-test; no next slice started.

### 2026-10-17 (V2b CP3 checked) — Claude

I checked Codex's V2b CP3 (`1d5fcea`, note 61 §10.15–§10.17). **Passes, no required fix.** Re-ran typecheck (clean) and
ROM **1806/1806** (104 files). Read `story/pewter_city.ts` against `scripts/PewterCity.asm` state by state: the default
resets before the east check, `'controls'` mask, both handlers' branches, the two-frame continuation (extra update on
the east path only), museum live UP / 6 frames / image UP, gym image LEFT with RIGHT restored at close, wait-only
music, `$40` as `screenDx -16`, the walk-off options, HIDE and RESET. The nine-variant test runs the real controller
on the committed map. My mutation (east-only update dropped) failed 8 tests. Notes in §10.18. **Next: Codex runs
V2b CP4**, then the user play-tests. Nothing pushed.

### 2026-10-17 (V2b CP3 — Pewter story wiring) — Codex

Implemented `story/pewter_city.ts`: default museum resets/east check, :3/:5 handlers, both native escorts/end
displays and HIDE/RESET; wired `runMapScript` and removed the two census exclusions. CP2 engine unchanged.
28 new tests cover every planned CP3 item, all nine real-controller flows and the BEAT_BROCK/Route3 tripwire;
35 production mutations caught/restored byte-for-byte. Typecheck/build clean; ROM **1806/1806**,
no-ROM **1652 pass / 154 skip**, serial gates with no timeout. Note 61 §10.15–§10.17 has the evidence/list.
No data/extractor/setup/browser work. Committed locally, nothing pushed. **Stop for Claude's CP3 check; do not
start CP4.** N-2's other-map wanderer browser glance remains CP4.

### 2026-10-17 (V2b CP2 checked) — Claude

I checked Codex's V2b CP2 (`4cebf3f`, note 61 §10.11–§10.13). **Passes, no required fix.** Re-ran typecheck (clean) and
ROM **1778/1778** (102 files). Read every production diff against the ASM: `SimulatedJoypad` (reversed read, index-0
collision), the PAD/NPC_MOVEMENT encodings, the frozen in-step map position, the ready + standing recompute,
`MoveSprite`'s opt-in STAY/NONE, `PassClock.reset` lining up with the two-frame `overworldLoop`, ShowObject's real
update. My own two mutations (collision flag, recompute guard) were caught. `vitest.config.ts` only exposes two
bindings; no limit loosened. Removed the checkpoint row Codex added to *Completed* (milestones only). Notes N-1/N-2
in §10.14. **Next: Codex runs V2b CP3.** Nothing pushed.

### 2026-10-17 (V2b CP2 — engine) — Codex

Implemented note 61 §3.1–§3.4 and CP1 carry-overs, engine only: raw simulated input/player pass, frozen NPC map
position and native exit options, controller commands, facing/image and SFX/opening handoffs, new input mask,
explicit two-frame continuations and RESET's ordinary same-pass input. Note 61 §10.11–§10.13 has the evidence.
55 new tests in six new files; **every existing test file unchanged**. All **31** temporary production mutations
caught and restored byte-for-byte. Typecheck/build clean; ROM **1778/1778**, no-ROM **1624 pass / 154 skip**;
serial gates, no timeout. No story/data/extractor changes, setup, browser run or push. Committed locally.
**Stop for Claude's CP2 check. CP3 has not started.**

### 2026-10-17 (V2b CP1 checked) — Claude

I checked Codex's V2b CP1 (`efb0fbb`, note 61 §10). **Passes, no required fix.** Verified its corrections against the
ASM and engine: HideObject/ShowObject end in `jp UpdateSprites`; the east-triggered close returns into the same
`JoypadOverworld` (an extra `UpdateSprites` at T); the PassClock keeps parity across script → overworld
(`main.ts:1134`), so the escort handoff needs an explicit two-frame continuation. Counts 185/329 and end positions
agree with my simulation. Backlog: today's `hideObject` callers skip HideObject's sprite update → J2. §10.10 lists
what CP2/CP3 must carry. **Next: Codex runs V2b CP2** (engine only). Docs only; nothing pushed.

### 2026-10-17 (V2b CP1 — trace) — Codex

Checked note 61 §2 against pret and the unchanged engine; §10 records all seven CP1 items. Engine step models
confirm all nine 185/329-pass routes, endpoints and no path hazards. Corrections include the east-only close-return
update, HideObject/ShowObject's full updates, initial-close pass-clock parity, and the idle-prefix/guide spacing.
The fixed Youngster is essential to the east-edge reachability proof; the `$40` ready/resting distinction holds.
Typecheck clean; no-ROM **1570/153**. First concurrent ROM run hit the existing text-source 5 s timeout (1722/1);
full unchanged rerun alone **1723/1723**. No code/data/test edits, setup or browser run. Docs committed locally.
**Stop for Claude's check; CP2 has not started.** Nothing pushed.

### 2026-10-17 (O-33 answered) — the user, recorded by Claude

The user approved note 61 §9 ("yes tp a;;", i.e. yes to all) → DECISIONS #65: V2b as planned, `MoveSprite`'s byte
reset for Pewter's walks only, the post-BEAT_BROCK east edge left to V3. **Next: Codex runs V2b CP1** (trace only, no
code; note 61 §4 → results in §10). Local commit only.

### 2026-10-17 (V2b plan) — Claude

At the user's request ("plan the next slice, Codex will implement"), wrote `notes/61-v2b-plan.md` from the Pewter ASM.
It replaces note 60 §6 and corrects three readings:
- **The east edge is closed by the four triggers.** A reachability search from every Route 2 entrance finds nothing
  east of x 37 without them. The south-east corner from my CP4 check is walled off; CP4 reached it off-map (backlog
  entry corrected).
- **The `$40` placement lasts at most one pass:** `InitializeSpriteScreenPosition` re-derives it.
- **`MoveSprite` resets the Youngster** to STAY/NONE until the map reloads.

A scratch simulation gives 185/329 passes for all nine variants. Backlog adds three J2 items. Earlier today: two
docs-only drift fixes (`12b73b4`, `2cc552d`). **Next: the user answers O-33; then Codex runs V2b CP1.** Docs only;
nothing pushed.

### 2026-10-17 (V2a play-test → V2a done) — the user, recorded by Claude

The user play-tested note 60 §10 for V2a: "all passes". **V2a is done:** Pewter City, its Pokécenter, Mart and two
houses, the Route 2 connection, the Mart lists from the ROM, the no-auto-text-box set, the PARLYZ HEAL name fix.
Context updated (CLAUDE, PROJECT, PLAN, STATUS). Session closed for the day. **Next session: V2b CP1** (trace only;
include the Pewter east-edge `CheckMapConnections` item). Nothing pushed.

### 2026-10-17 (V2a CP4 checked) — Claude

I checked Sonnet's V2a CP4 (`f089341`, note 60 §16). **Passes.** Re-ran ROM **1723/1723** after my fix below. Looked at the
crossing (gray PEWTER palette) and the Mart list screenshots. The list showed **`PARALYZE HEAL`, overflowing the box**,
a pre-existing bug (Viridian Mart and the bag too, plus `OAKS PARCEL`): those runtime ids differ from pret's
`PARLYZ_HEAL`/`OAKs_PARCEL`, which key `item_names.json`. **Fixed** with a two-entry alias in `getItemName` and a test
that every runtime item id resolves to a ROM name (alias removed → fails); no id or save change. No-ROM **1570/153**.
Findings: the nurse's saved first-visit bit → J2 (as logged). Pewter's east edge: the SE corner is reachable without
the east triggers, so V2b CP1 now traces the cartridge's `CheckMapConnections` there (no stopgap). **Next: the user
play-tests V2a (note 60 §10).** Nothing pushed.

### 2026-10-17 (V2a CP4 — verification) — Sonnet 5.5, standing in for Sol

Gates twice: typecheck/build clean, ROM **1722/1722**, no-ROM **1569/153**, no timeout; tree clean throughout. Muted browser walk on port
5207 (never 5173): Forest north gate → Route 2 → Pewter (the `cities1` fetch only on crossing, PEWTER palette), every talker and
sign, both Super Nerd answers, nurse heal (the machine, with a real party: ball + eight flashes in Pewter; blackout point =
Pewter's door warp), bench guy, PC, Mart (seven items and prices, a purchase, START with **no early box**: first change ≈+22 ticks),
both houses incl. the Nidoran line, SAVE → reload → CONTINUE, Museum/Gym doors fail gracefully. **Two findings, not fixed:**
the player **does not stop at Pewter's east edge** (border block `$0a` is walkable; no Route 3 until V4), and the nurse's
first-use text reappears after CONTINUE (`BIT_USED_POKECENTER` isn't saved). Both are in the backlog; note 60 §16 has the table,
the screenshot index and the browser-testing traps. Evidence in `%TEMP%/pkmn-v2a-cp4/`. Docs only. **Stop for Claude's check.**
Local commit only, nothing pushed.

### 2026-10-16 (V2a CP3 checked) — Claude

I checked Sonnet's V2a CP3 (`3ae8a88`, standing in for Sol). **Passes, no required fix.** Re-ran typecheck (clean) and
ROM **1722/1722**. Read the diff: the tables match `songs.asm` and the plan; `pewterSuperNerdText` is YES → ThatsRight
(`cp $0`); `text/auto_text_box.ts` holds {OaksLab, PewterMart} and is applied at the entry points (handlers/TX_SCRIPT
via `applyMapAutoTextBox`, plain/printText NPCs, Lab free-move, `displayOpen`'s default, START's early border).
`applyMapAutoTextBox` forces the first `displayOpen` to false on those maps, which is the cartridge's rule for every
DisplayTextID there; no Lab or Pewter Mart handler opens with an explicit `true` (the only one is Viridian City's,
an auto-box map). START's new test keeps labels at +20 and the first read at +23. **Next: CP4** (gates twice, muted
browser walk, docs), then the user's V2a play-test. Nothing pushed.

### 2026-10-16 (V2a CP3 — runtime wiring) — Sonnet 5.5, standing in for Sol

Read the ASM first (PewterMart/OaksLab scripts, `PewterCitySuperNerd2Text`, songs.asm). Five Pewter maps wired in
`main.ts` (City outdoor; music per songs.asm), all `PEWTER`, six debug warps. `PewterCity:4` Super Nerd handler
(YES → ThatsRight, NO → ImSprayingRepel), census exclusion removed. New `text/auto_text_box.ts` ({OaksLab,
PewterMart}) replaces the Lab name check for plain/printText NPCs, handlers, TX_SCRIPT (`buildMartScript`), Lab
free-move and START's early border (+20/+23 kept); explicit `true` (bookshelves) untouched. A first design that
made `displayTextID` default to the map broke Lab shelves and was reverted. Guides and Jigglypuff still silent.
+19 tests, 3 mutations caught. Typecheck/build clean, ROM **1722/1722**, no-ROM **1569/153** (96 files). Note 60 §15.
No browser run. **Stop for Claude's check; CP4 has not started.** Local commit only, nothing pushed.

### 2026-10-16 (V2a CP2 checked) — Claude

I checked Sol's V2a CP2 (`e7f2902`, `50f6f90`). **Passes, no required fix.** Re-ran typecheck (clean), ROM **1703/1703**,
and `npm run setup` again: tree unchanged. Read the extractor diff: `readMartItems` reads both pointer tables, resolves
home-bank pointers, checks $FE, the count against the $FF terminator and every item id, and maps $0f to
`PARALYZE_HEAL`; the hard-coded Viridian list is gone and its extracted list is unchanged. Test diffs only add Pewter
rows/counts (24 maps, 182 JSON, census 38, bench check 9, Nidoran's exact FAR + asm guard) plus new extraction tests
with malformed-`script_mart` rejections; the Pewter tripwire is re-keyed to Jigglypuff's registration as planned.
The approved `map_sprite_sets.json` rows only add the five maps. Note for CP3: the census exclusion
`PewterCity:4` ("V2a CP3 Super Nerd handler") must go when that handler lands. **Next: Sol runs V2a CP3.** Nothing pushed.

### 2026-10-16 (V2a CP2 completed after scope approval) — Codex/Sol

The user approved the two generated sprite-set files and four omitted fixture updates. Added only
Pewter rows/counts and count labels/comments; every old assertion retained. Note 60 §14 records each
cartridge reason before those edits; §8 includes all four files. All 888 setup outputs match byte for
byte; 872 prior files unchanged. Final ROM **1703/1703**, no-ROM **1550 pass/153 skip** (95 files),
typecheck/build clean; no final timeout. Earlier unchanged text-source timeout/rerun recorded in §13.8.
CLAUDE/CONVENTIONS baselines updated. Completes WIP `e7f2902`; no runtime wiring or browser check.
**Stop for the user's/Claude's check. CP3 has not started.** Committed locally; nothing pushed.

### 2026-10-16 (V2a CP2 — implementation; scope answers pending) — Codex/Sol

Five maps/text tables, 54 sym-checked programs, parent/hidden-event rows and ROM-derived Mart stock
implemented; Viridian stock bytes unchanged. Setup twice: **888 files identical** (182 JSON per tree).
No runtime wiring. Note 60 §13.8 records two extra generated sprite-set files and four stale fixture
counts/lists outside the user's allowlists; approval was requested, not assumed. Only §8's five test
files edited so far. Typecheck/build clean; ROM **1698 pass/5 fail**, then unchanged timeout rerun
**7/7**; no-ROM **1546 pass/4 fail/153 skip**. The remaining four failures are those omitted fixtures.
**CP2 not complete; await the user's scope answers, then finish gates/commit before Claude's check.**
Authorized changes saved in a local WIP commit; the two extra generated sprite-set files remain
uncommitted pending the user's answer. No omitted fixture was edited. Nothing pushed.

### 2026-10-16 (V2a CP1 checked) — Claude

I checked Sol's V2a CP1 (`0971786`, note 60 §13). **Passes, no required fix.** Verified against the ROM and source:
both clerks' bytes (`00:233b` `FE 05 04 14 0B 0F 0C FF`, `00:2343` `FE 07 04 14 1D 0B 0C 0E 0F FF`); `printTextWrapper`
already matches the inline `call PrintText` form, so my planned extractor rule is unneeded; Nidoran starts with
TX_FAR while Viridian's Spearow starts with `text_asm`, so its call is `text` and the census grows by 8 (City 3/4/5,
Pokécenter 1/3/4/6, Mart 1) to 38; `$0f` needs the `PARALYZE_HEAL` alias; START must take the map's no-auto-box
default. All four corrections are already folded into §2–§8. Docs only. **Next: Sol runs V2a CP2.** Nothing pushed.

### 2026-10-16 (V2a CP1 — trace) — Codex/Sol

Checked pret ASM/symbols and ROM: five text tables, 27 new root/FAR pairs, all calls, both Mart byte
streams, connection offsets, four door spawn states, empty Pokécenter slot 10, and Mart/START openings.
Note 60 §13 records the trace and corrections: inline PrintText already supported (no old kind changes);
Nidoran is text + ASM, so future handler/script census **38**; $0f needs runtime **PARALYZE_HEAL**;
no-auto-box must cover START, whose initial border is unconditional today. Viridian's mapped stock
equals today's exactly. Gates: ROM **1687/1687**, no-ROM **1550/137** (95 files), typecheck/build clean;
no timeout. Docs only; no code/data/test changes or setup/browser run. **Stop for Claude's check;
CP2 has not started.** Local commit only, nothing pushed.

### 2026-10-16 (O-32 answered) — the user, recorded by Claude

The user approved note 60 §12 ("yes pls split it and yes to codex ompelmenting") → DECISIONS #64: V2 runs as
V2a → V2b → V2c, each with its own CPs and play-test; Sol implements, Claude checks each CP. **Next: Sol runs V2a
CP1 (trace only, no code).** Local commit only.

### 2026-10-16 (V2 plan) — Claude

At the user's request ("please update all context files then ultrathink and plan the next slice"):
- **Context sweep** (`1468cc3`): the 19 session entries before the healing-machine plan moved verbatim to HISTORY
  (DECISIONS #61; STATUS ~40 → ~28 KB). The machine is marked done in PLAN, note 59, the backlog and the story doc.
  ARCHITECTURE's module map now has `fade_audio`, `healing_machine`, `loadSpriteMapped`/`obpMapping` and
  `StatusScreenSession`, which replaces the stale `StatsScreen`.
- **V2 plan:** wrote `notes/60-v2-plan.md` from the Pewter ASM.
  - The Pokécenter, Mart and houses are byte-identical layouts to Viridian's, and Pewter Mart's prices already match.
  - I simulated the guides' nine start variants from the ASM lists (reversed consumption, `PewterGuys`' overwrite):
    each ends with the player one tile behind, at museum (14,8) and gym (11,18).
  - Measured the Jigglypuff song on `audio_rig`: CHAN2 ends at update 392, CHAN1 at 397, so the spin runs 17 times.
  - Found that Jigglypuff disables Pikachu's following, which the engine has no state for (V2c).
  - Three findings went to the backlog (the Youngster's unterminated table → V3; connection music fades → #63's
    slice; `wTownVisitedFlag` → Fly).

**Next: the user answers O-32.** No code changed; the throwaway rig test was deleted. Local commit only.

### 2026-10-16 (healing-machine CP4 checked; slice closed) — Claude

I checked Sol's CP4 (`ca6d38a`, note 59 §15): Markdown only, no runtime/test/data change. Re-ran typecheck (clean)
and ROM **1687/1687**. Looked at the evidence in `%TEMP%/pkmn-healing-cp4/`: the six-ball frame at J and J+10
differ in 90 pixels, all inside the machine (X 43–52, Y 18–39), so the $c8/$e0 swap is real, not a dim; J+170
also differs at the nurse, who turns back down in the return tick (`Func_6ebb`). The audio trace matches CP1's
anchors (NR50 steps H+6…H+36, $77 and ball 1 at H+41, jingle at J, map music at J+168). **Passes.** With the
user's play-test ("it all works well") the **healing-machine slice is closed**: Done table, CLAUDE, PROJECT
updated; queue renumbered. **Next: Claude plans V2 (Pewter).** Nothing pushed.

### 2026-10-16 (healing-machine CP4 verification) — Codex/Sol

After Claude's CP3 check `6029992`: all four gates **twice**, ROM **1687/1687**, no-ROM
**1550 pass / 137 skip** (95 files), typecheck/build clean; no timeout or test edit.
Muted Chromium on **5194**, Viridian nurse with parties **1 and 6**: screenshots through **J+170**,
fade restored **$77 at update 40**, one SFX per ball, real jingle and map restart; normal browser
clocks matched too. No page/asset errors, ROM requests or save writes. **The user already play-tested
the machine in the browser and reports it all works well.** Evidence/helpers outside the repo;
note 59 §15 has details. Audio/story ARCHITECTURE and CONVENTIONS updated; unchanged CLAUDE baseline.
Docs only; oldest three STATUS entries archived verbatim in `1a6a616`. **Stop for Claude's final
check; the slice remains open for Claude to close.** Local commit only, nothing pushed.

### 2026-10-16 (healing-machine CP3 checked) — Claude

I checked Sol's CP3 (`0529e66`, note 59 §14). **Passes, no required fix.** Re-ran typecheck (clean), ROM
**1687/1687** (95 files), no-ROM **1550/137**. Walked `HealingMachineSession.frame()` tick by tick against
`healing_machine.asm`: monitor write H+1 / drawn H+2; balls + SFX at H+41+30(k−1); jingle and first XOR at
J; seven more XORs at J+10…J+70, loop out at J+80 with $e0; CHAN1 poll (`.waitLoop2` reads
`wChannelSoundIDs`, so CHAN1, not the playing latch); tail 32 → done J+168; OAM kept at J+168/J+169, gone
J+170. Saved OBP1 $e0 matches `FadePal4`. Seven OAM positions/flips match §3.4; `obpMapping` gives
$e0 → 0,0,2,3 and $c8 → 0,2,0,3. Audio ticks before the script in `gameTick`, so fade-done and ball 1
share a tick. The nurse order (machine → UpdateSprites → HealParty → map music, one tick) matches
`pokecenter.asm:51–61`; the held-A path no longer syncs the joypad. My own mutations, beyond Sol's 11:
first XOR skipped at J (2 fail), fade control 3 (5), no ball SFX (2), OBP1 not restored (1), nurse without
`updateSprites` (1); all restored, tree clean. **Next: Sol runs CP4** (gates twice, muted browser check,
final handoff), then the user play-tests. Nothing pushed.

### 2026-10-16 (healing-machine CP3) — Codex/Sol

Machine session/nurse integrated; old machine deleted; TV N-2 covered. Note 59 §14.
Exact one/six-member timeline and drawing, same-tick heal/restart, OAM cleanup and BG ownership tested.
11 mutations caught/restored. ROM **1687/1687**, no-ROM **1550/137**, typecheck/build clean; no timeout.
No generated changes. **Stop for Claude's check. CP4 browser verification has not started.** Local only.

### 2026-10-16 (healing-machine CP2 checked) — Claude

I checked Sol's CP2 (`f1cbca1`). **Passes, no required fix.** Re-ran typecheck (clean) and ROM **1673/1673**
(93 files, no timeout). Read `fade_audio.ts` against `home/fade_audio.asm` + `PlaySound`: counter/reload,
the DEC/SWAP/OR step with its underflow, CHAN5–8 cleared on the request, `wLastMusicSoundID` = $ff making a
second stop immediate, and $77 at completion through `StopAllAudio`. NR50 gain (n+1)/8 keeps $77 at 0.5.
The SFX JSON matches `healing_machine_1.asm` command for command. Skipping the idle $77 write is safe:
all 173 `volume` commands in our audio data are 7,7, and the fade reads the live register as the ASM does.
Mutations: no $77 at completion (7 fail), counter off by one (6), old NR50 formula (1), no SFX stop on the
request (1); all restored, tree clean. Nits, not required: `fade` is `| undefined` beside the module's
`| null` siblings; `sound_wait.ts`'s doc comment has a stray line break. **Next: Sol runs CP3.** Nothing pushed.

### 2026-10-16 (healing-machine CP2) — Codex/Sol

Audio fade + public API, NR50 (n+1)/8, and preloaded/extracted `healing_machine`; note 59 §13.
Setup twice: all 878 files identical, only SFX + mirror added. Six mutations caught/restored.
ROM **1673/1673** on rerun after the known source-test timeout; no-ROM **1536/137**; typecheck/build clean.
**Nurse unchanged; CP3 not started. Stop for Claude's check.** Local only; oldest STATUS entry archived
verbatim in `8b9bdb6` before implementation.

### 2026-10-16 (healing-machine CP1 checked) — Claude

I checked Sol's CP1 (`4fd0399`, note 59 §12). **Passes, no required fix.** Verified all three corrections
against the ASM myself: (1) the fade's completion goes `StopAllMusic` → `PlaySound` → `Audio1_PlaySound`
`.stopAllAudio` → `Audio2_StopAllAudio`, which writes $77 to `rAUDVOL` (`engine_2.asm:376`), so the restore
is at update **40**; (2) all five Viridian Pokécenter NPCs are below `FIRST_STILL_SPRITE` and
`wSpriteSet[0]` is Pikachu's, so they're slots **1–5**; slot 10 ($7c–$7f) is empty and nothing draws $7e;
(3) decoded the ball tile and computed the six OAM entries: exactly 8 coincident opaque pixels (X 44,45,50,51;
Y 34,39), colour 3 on both. Re-measured the jingle in a throwaway rig test (deleted): CHAN1–3 all end at
update **136**. The fade loop and VBlank order support H+41 and the timeline. Docs only.
**Next: Sol runs CP2** (fade-out §4.1, NR50 §4.3, `healing_machine` SFX §4.2 + regenerated data; not
wired to the nurse). Nothing pushed.

### 2026-10-16 (healing-machine CP1) — Codex/Sol

Trace only; note 59 §12. Jingle CHAN1 measured **136**; machine anchors and unused Viridian $7e
confirmed. Corrected NR50 restore to fade update **40**, NPC slots to **1–5**, and ball overlap.
Typecheck/build pass; no-ROM **1523/133**; ROM **1656/1656** on unchanged rerun after one source-test
timeout (recorded in §12.6). No code/data changes. **CP2 not started; stop for Claude's check.** Local only.

### 2026-10-16 (O-31 answered) — the user, recorded by Claude

The user approved note 59 §11 ("yes") → DECISIONS #63: one slice, four CPs; NR50 (n+1)/8 here; map-transition
fade-out as its own slice right after V2 (queue #3); Sol implements. **Next: Sol runs CP1 (trace only, no code).**
Local commit only.

### 2026-10-16 (healing-machine plan) — Claude

At the user's request ("ultrathink and write the plan to tackle the next slice") I traced `AnimateHealingMachine`,
`FadeOutAudio`, `PlaySound`'s fade path, the OBP1/CGB palette conversion, `PrepareOAMData`'s $ff and clear rules,
`HealParty` and the nurse's tail, and wrote `notes/59-healing-machine-plan.md`. Key findings: the machine is
41 + 30n frames to the jingle (40-VBlank fade from $77, reload 4), then 168 to done (flashes 80, CHAN1 at
update 136, tail 32), drawn until J+169; the flash swaps OBP1 colours 1 and 2 ($e0 ⇄ $c8), it does not dim; the
art draws through OBP1 ([0,0,2,3]), not OBP0; positions are screen-fixed; `SFX_HEALING_MACHINE` is bank $02
header $41da; HealParty and the music restart come after the machine. Also proposed: NR50 (n+1)/8.
**Next: the user answers O-31.** No code changed. Local commit only.

### 2026-10-16 (StatusScreen final review) — Claude

Reviewed CP5 (`183e2e4`) and the whole slice. **Passes.** Re-ran typecheck (clean), ROM **1656/1656**, no-ROM **1523/133**,
build clean, tree clean. Looked at Sol's picture review (Pikachu 5×5, Ivysaur 6×6, Charizard 7×7): placement, mirroring,
both pages, glyphs and FNT/status all look like the cartridge. **The user then play-tested it: all verified (2026-10-16). StatusScreen is closed.**

### 2026-10-16 (StatusScreen CP5) — Codex/Sol

All gates twice: ROM **1656/1656**, no-ROM **1523/133**, typecheck/build clean. Muted fresh Chromium on
5193: three picture sizes visually inspected and pixel-identical to full-PNG mirror references on both
pages; party/PC/battle, volume automation and medicine return pass. No errors, failed assets or save
writes. Note 58 §16 has evidence paths. Docs only; server stopped. **Stop for final review/play-test.**

### 2026-10-16 (StatusScreen CP4 check) — Claude

Checked Sol's CP4 (`cbc4c86`). **Passes, no required fix.** Re-ran typecheck (clean), ROM **1656/1656**, no-ROM **1523/133**.
Read `party_menu_opening.ts` (C+19 reveal, C+22 first read) and the medicine diff (+3 `msg-palette`, return at P+39
list / bag visible P+51); every prior assertion kept with moved anchors. Mutations (first read 22→21, return 39→38,
palette wait 3→2) failed 15 / 4 / 1 tests; restored, tree clean. Next: Sol runs CP5 (gates twice, muted browser check
on a spare port, docs). Local only.

### 2026-10-16 (StatusScreen CP4) — Codex/Sol

Shared opening, +7/+3 medicine waits and 38-frame restore implemented; main presents the new white flag
in the same frame. All prior medicine assertions retained. Note 58 §15: 12 added tests, 11 mutations
caught/restored. ROM **1656/1656**, no-ROM **1523/133**, typecheck/build clean. Local only. **Stop before CP5.**

### 2026-10-16 (StatusScreen CP3 check) — Claude

I checked Sol's CP3 (`8f69174`). **Passes, no required fix.** Re-ran: typecheck clean, ROM **1644/1644** (90 files), no-ROM
**1511 pass / 133 skip**. Read `status_screen.ts` against note 58 §5 and the ASM: the frame ages match §12.2 (clear at S+3,
sprites S+6, labels S+14, page 1 at S+17, reveal S+20, picture cells and first read S+27, page-2 read P+3, done Q+3); page 1 and 2
cells, FNT, the erased TYPE2/, species name and PP masking agree; one `present()` per frame is the only BG tick; Bill's PC returns
white until Q+6. Three mutations of mine (stats column, no white on Bill's tail, A-only advance) each failed tests and were restored.
Note for CP4/CP5: the browser has not seen this yet (pic drawn per tile through the canvas). Docs only. **Next: Sol runs CP4.**
Nothing pushed.

### 2026-10-16 (StatusScreen CP3) — Codex/Sol

Implemented the session, party/battle/Bill callers, glyphs and volume; deleted legacy stats. Note 58 §14
records timing, ownership and ten caught/restored mutations. ROM **1644/1644**, no-ROM **1511/133**;
typecheck/build clean. No generated-data changes. **Stop for Claude's review; CP4 unstarted.** Local only.

### 2026-10-16 (StatusScreen CP2 check) — Claude

I checked Sol's CP2 (`367ef78`). **Passes.** Re-ran: typecheck clean, ROM **1609/1609** (90 files), no-ROM **1476 pass / 133 skip**,
and `npm run setup` again left `git status` empty (176 JSON, 521 PNG). Read the diff: `readMoveNameEntries` shares one walk
between `readMoveNames` and the new `readMoveDisplayNames`; `move_names.json` has SAND-ATTACK, DOUBLE-EDGE and PSYCHIC (PSYCHIC_M);
`P.png` comes from `P_TILE` (04:5682, 8 bytes). The tests pair refs' constants with `names.asm` by id, and check P against ROM bits and
pret's PNG. Docs only. **Next: Sol runs CP3 (the session and its callers).** Nothing pushed.

### 2026-10-16 (Claude's CP1 handoff reconciled with completed CP2) — Codex/Sol

Read the user's pasted handoff and checked commit `9aa0134`: it is the parent of CP2 `367ef78`, so the
plan/decision corrections were preserved. Every requested CP2 change is already complete. Rechecked
all 876 generated files against the verified setup manifest: only the same 3 additions, all 873 prior
files unchanged. No further implementation needed; CP3 remains unstarted. Local docs commit only.

### 2026-10-16 (StatusScreen CP2 — move names and bold P data) — Codex/Sol

The user requested the next part after CP1. Completed only CP2; details in note 58 §13. Shared MoveNames
walk supplies `readMoveDisplayNames`; both extraction paths write `move_names.json`. PTile 04:5682 exports
the 8×8 `font/P.png`. Added 5 tests for all source names/IDs, ROM/display fidelity, P pixels and registration.
Setup twice: all 876 files identical, exactly 3 additions, all 873 prior files unchanged. ROM **1609/1609**
(90 files), no-ROM **1476/133**, typecheck/build/diff clean. No runtime caller change or browser check.
Updated asset counts, schema and test docs. **Stop before CP3; wait for the user.** Local commit only;
nothing pushed.

### 2026-10-16 (StatusScreen CP1 check) — Claude

I checked Sol's CP1 (`bd9bdfc`, note 58 §12). **Passes.** Verified the one correction against the ASM: `.done` runs
`GBPalWhiteOut` (`xor a`, Z=1; every `UpdateCGBPal_*` saves/restores AF) then `call z, RunDefaultPaletteCommand`, so
medicine's return is +32 (my +29 missed that Delay3). Fixed note 58 §2/§7/§8 and DECISIONS #62 to say so. Everything
else in §12 (copy arithmetic, anchors, tiles, pic placement, OAM, hJoy7) agrees with my derivation and the ASM I
read. Docs only. **Next: Sol runs CP2 (move names + bold P data).** Nothing pushed.

### 2026-10-16 (StatusScreen CP1 — trace only) — Codex/Sol

Completed only note 58 CP1 at the user's request; results and source evidence are in §12, committed alone
as `bd9bdfc`. Confirmed §5.8–§5.10's anchors, §5.4's tiles, §5.3's placement, Bill's hidden OAM and hJoy7=0.
Corrected F-2: an additional taken CGB palette call before START's 35-frame restore makes medicine's full
return 38 frames before the bag list, visible P+51 / first read P+54 (+32 over today, not +29).
Read-only ROM/PNG probes and typecheck/diff checks passed; runtime suites not re-run (baseline unchanged).
No engine/data/assets changed. **Stop before CP2; wait for the user.** Separate handoff-log commit only;
nothing pushed.

### 2026-10-16 (O-30 answered) — the user, recorded by Claude

The user approved all four StatusScreen decisions ("yes to all") → DECISIONS #62:
- one slice in five checkpoints;
- F-1/F-2 fixed in CP4 through the shared `DisplayPartyMenu` opening;
- `move_names.json` and `P.png` extracted in CP2;
- battle's STATS on the new pages now.

Note 58 is marked approved. Docs only. **Next: Sol runs CP1, the trace (note 58 §7; results into §12).**
Nothing pushed.

### 2026-10-16 (StatusScreen plan) — Claude

At the user's request ("ultrathink and prepare the plan. ChatGPT Sol will implement"), I traced `StatusScreen` /
`StatusScreen2` and their three callers against the ASM and wrote `notes/58-statusscreen-plan.md`:
- 17 departures in today's pages (§4). Among them: B leaves after page 1, stats sit one column left, the
  pic is misplaced for 5×5/6×6 mons, page 2 shows the nickname, move names come from ids, and there's no
  volume dip;
- cell-exact layouts, glyph sources, the pic placement and a derived timeline (§5) for Sol's CP1 to confirm;
- **F-1/F-2** (§2): A5b7c2's `DisplayPartyMenu` opening misses a 30-tile copy and the CGB palette Delay3 (+7),
  its result redraw misses the palette (+3), and the return to the bag misses
  `RestoreScreenTilesAndReloadTilePatterns`' 29 frames.

Two battle findings went to the backlog (A5c). Docs only; gates not re-run (baseline 1604/1604, no-ROM 1474/130).
**Next: the user answers O-30, then Sol implements CP1.** Nothing pushed.

### 2026-10-16 (codebase and context study after A5b7) — Codex

At the user's request, read the project guidance, live handoff, roadmap, architecture, relevant decisions,
latest review and backlog; traced startup/static data, tick/pass/input ownership, interactions,
retained text/menus, saves, shared stats pages and the nurse's existing machine. No implementation slice
claimed. A5b remains user-verified complete; next is the StatusScreen plan (#58), then healing and V2.
Fresh checks: ROM **1604/1604** (89 files), no-ROM **1474 pass / 130 skip**, build/typecheck clean;
19 map files, 175 JSON and static 520 PNG/3 tilemaps confirmed. No ROM-gate markers in the built JS.
Some older test counts and handoff wording in PROJECT/ARCHITECTURE/subsystem docs are stale; use this
file's baseline. Note 56 N-1/N-2 and the backlog's proposed battle-mechanics audit remain carried forward.
No browser play-test or runtime/data changes. Local docs commit only; nothing pushed.

### 2026-10-16 (STATUS.md trimmed) — Claude

At the user's request, STATUS.md went from ~201 KB to about a fifth of that. **Nothing was deleted;
everything moved verbatim:**
- session-log entries from before the A5b7g work → `HISTORY.md` → *Recent session archive*;
- the full *Completed* table, the old *In progress* handoffs, the old A5 queue row and the resolved open
  questions → `HISTORY.md` → *Archived STATUS sections*;
- *Notes for later* → `notes/57-findings-backlog.md`.

How to keep it short from now on: DECISIONS #61 and CONVENTIONS step 5. Docs only. Nothing pushed.

### 2026-10-16 (A5b7g2 play-test → A5b7 done) — the user, recorded by Claude

The user play-tested note 56 §5, which also covered g1's F-1: "i tested it, we can mark A5b7 as fully
finished". **A5b7g is done, and so are A5b7 and A5b.** Context files updated (CLAUDE.md, PROJECT, PLAN,
STATUS). **Next: Claude plans the StatusScreen port.** Nothing pushed.

### 2026-10-16 (A5b7g2 review) — Claude

I reviewed CP1 (`a6b609f`) and Grok's CP2 (`8fd0111`, `13fd2f6`, `269d8c2`, `09df736`) in
`notes/56-a5b7g2-review.md`. **Passes, no required fix.** Gates re-run: ROM 1604/1604 twice, no-ROM
1474/130, typecheck/build clean.

What I checked against the ASM:
- the facing-up one-tile shelf gate, and the shelf table row for row;
- the +20 / +23 openings, Diglett, and the statues' parity;
- the poster's `jr c`, the shared builder in both paths, and note 55's N-1–N-3.

Grok's finding that Oak's Lab is on the DOJO tileset (shelf $1D) is confirmed in its map header.
9 mutations: 7 caught; the seen-by-trainer gate for programs (unreachable today) and the TV routing
survived as test gaps N-1/N-2. **Next: the user play-tests note 56 §5.** Nothing pushed.

### 2026-10-15 (A5b7g2 CP2 — tests) — Grok

`story/bookshelf_display.test.ts` (25) covers plain predefs at +20, books and the Diglett sculpture and the
statues at +23, the 15-frame outer-wait close, the right poster at 1 and 2 owned (builder and overworld),
the facing-up one-tile gate, the Blues House Town Map, a hidden event winning over a shelf, and Lab free
movement for the poster, the e-mail, and a DOJO shelf (`$1D` on `blockset_gym`; the map header is DOJO).
`oaks_lab.test.ts` adds N-2 (the guard's Delay3, three frames with no joypad read after the pass that
starts it) and N-3 (a free-move NPC stays borderless through frame 18). Five mutations each failed a test
and were restored: any-facing shelf, the second tile up, book `box: 'keep'`, owned threshold 1, and
free-move script ids ignored. ROM 1604/1604 (89 files), no-ROM 1474 pass / 130 skip, typecheck and build
clean. Not run in the browser (no browser tool in this session; :5173 was not touched). **Stop for Claude's
review. CP2 is the end of this session.** Nothing pushed.

### 2026-10-15 (A5b7g2 CP2 — bookshelves) — Grok

`PrintBookshelfText` now runs only when the player faces up, and only on the one tile directly above the
player's step (screen (8,7)). That includes the Town Map shelf. `GameMap.getBookshelfPredef` returns the
`BookshelfTileIDs` label. Town Map, `BookOrSculptureText`, and `IndigoPlateauStatues` become script ids;
`PokemonStuffText` and `ElevatorText` are plain programs (`box: 'keep'`). `BOOKSHELF_TEXT`, the hand-written
"This is an elevator." line, and the three `getText('BOOKSHELF_*')` calls are gone. `overworld/map.ts` left
the census allow-list. A found hidden item still skips the shelf. Typecheck clean. 135/135 across Lab, town
map, census, item pickup, map trainers, and the TV handlers. Full suite and build not run.
**Next: the CP2 timing tests, including N-2 and N-3.** Nothing pushed.

### 2026-10-15 (A5b7g2 CP2 — builder) — Grok

`interactionDisplay` (`story/hidden_events.ts`) builds one display for a hidden event that carries `program`
or `scriptId`. The overworld and Lab free movement both call it. A plain predef is `printText` with
`box: 'keep'` (auto border, outer wait, first glyph +20). `OAKS_LAB_RIGHT_POSTER` prints `SaveOptionText`
when `ownedCount < 2`, otherwise `StrengthsAndWeaknessesText`. TV, notebook, blackboard, PCs, and the Town
Map keep their current handlers. Free movement deletes the "ignore script ids" branch and the
`textBox.show` fallback. N-1 restores Pikachu's facing only when `textBox.active && textBox.displaySession`.
Book and statue cases live in the builder; nothing returns those script ids until the bookshelf sub-step.
Bookshelves still use `getBookshelfText` / `getBookshelfScript` on two tiles at any facing.
Typecheck clean. `oaks_lab.test.ts` 35/35 (F-1 accepts a program glyph when the right poster has no
flattened string). Also passed: town map, school, PC, small text handlers, item pickup, map trainers.
Full suite and build not run. **Next: the bookshelf gate.** Nothing pushed.

### 2026-10-15 (A5b7g2 CP2 — data) — Grok

Oaks Lab's right poster (step 5,0) is now `scriptId` `OAKS_LAB_RIGHT_POSTER` in the extractor.
`textOffset` stays on that source entry; the resolver still strips it for a script id, so the committed
map drops the flattened "SAVE option" string and does not gain `program`. Setup ran twice and was
byte-identical (`OaksLab.json` SHA256 `EC145603212EEAD4…`). `git diff` on `data/` and `static/` is only
`game/data/maps/OaksLab.json` and `game/static/maps/OaksLab.json`. `hidden_event_programs.test.ts` expects
that script id and no program (2/2). Full suite, typecheck, and build were not run for this sub-step: the
poster has no display handler until the builder commit, so F-1 would fail on this commit alone. Baseline
stays 1577/1577. **Next: the shared interaction→display builder.** Nothing pushed.

### 2026-10-15 (A5b7g2 CP1 — data) — Claude

The user asked Claude to implement CP1, because Sol was out of usage. `rom/text_program_symbols.ts`
now has 28 labels:
- the predef roots, checked against `TextPredefs` (00:3F67) in the ROM;
- the `ld hl` operands of the two `text_asm` shelf routines;
- the Viridian row of `BenchGuyTextPointers` (3-byte rows: map, facing, predef ID).

`extractors/maps.ts` adds `program` to the 8 plain hidden events. Setup was run twice: byte-identical,
additions only (text_programs + 4 maps + mirrors). New no-ROM test `hidden_event_programs.test.ts` (2)
derives each predef from refs' tables; a wrong-label mutation fails it.

Deviation, recorded in note 54 §12: the right poster's `scriptId` waits for CP2, so the poster never
goes dead in between. ROM 1577/1577 (×2), no-ROM 1447/130, typecheck/build clean. Not run in the browser
(no visible change). **Next: CP2.** Nothing pushed.

*Moved from STATUS.md on 2026-10-16 before healing-machine CP3; oldest entry, verbatim.*

### 2026-10-15 (A5b7g1 review) — Claude

I reviewed Sol's A5b7g1 (`4cb3f57`, `81f80ad`) in `notes/55-a5b7g1-review.md`. **Passes, no required
fix.** Gates re-run: ROM 1575/1575 twice, no-ROM 1445/130, typecheck/build clean, working tree clean.

What I checked:
- the removals against note 54 §3's census;
- F-1 against `EnableAutoTextBoxDrawing`;
- the A6e fixture now on the real nurse script, with every assertion kept;
- the coverage map for the deleted explicit-ending tests;
- all seven review-gap assertions and the AST census tripwires.

7 mutations: 5 caught, 2 survived (N-2 the guard's Delay3, N-3 the borderless free-movement NPC
opening). Both predate g1, and both go to g2. N-1 (`pikachuFacing` restore without an `active` check) is
latent.

**Next: the user glances at F-1** (Lab posters and e-mail during the starter choice), **then Sol
implements A5b7g2 CP1.** Nothing pushed.

*Moved from STATUS.md on 2026-10-16 before healing-machine CP2; oldest entry, verbatim.*

### 2026-10-15 (A5b7g1 CP2 — retirement, F-1 and regression) — Codex/Sol

The user requested the next part after CP1. Implemented only g1 CP2 (note 54 §4, result §11).
Retired script text/closeText, non-display button-wait fallback, guardText/dead free-move states,
unused commandState/isCommandDone and the nurse re-export; TextBox.show is now DisplayTextID only.
Standalone PrintText and live displayClose retain their existing input/transfer/close behavior.
F-1 enables the border for Lab hidden-event/bookshelf text during the starter await, matching the
poster/e-mail/bookshelf ASM. Guard programs are required; ordinary Lab NPC auto-box behavior stays.

Five new tests: closed/standalone invalid wait rejection, both Lab posters and e-mail visibly returning
to the await/ball. Updated two test-only legacy branches, TextBox callers, subsystem docs and baselines.
No data/extractor/schema/battle-union change, no setup; refs and curated sprites untouched.

Gates: focused **316/316**; three fresh ROM runs **1575/1575** each, three no-ROM runs **1445/130**;
no intermittent failures. Typecheck/build/diff clean. Ten temporary production mutations all caught and
restored byte-for-byte (seven CP1 review lines plus close beep, invalid wait fallback and F-1).
Browser: 13 checks across core/tail fresh profiles at :5189, actual interactions/sound waits, zero page
errors/unexpected failed resources. Includes hidden-item full bag, ball, Lab guard/girl/posters/e-mail,
nurse/Pikachu, Mom, sign, trainer battle entry and SAVE/reload/CONTINUE. Harness reload/wrong-NPC
corrections and exact smoke limits/evidence are in note 54 §11. Profiles cleared/closed, owned server
stopped, :5173 saves untouched. No permanent debug hook. Local commit only; nothing pushed.
**Next: Claude's g1 review, then the user's F-1 glance. No g2 implementation started.**

*Moved from STATUS.md on 2026-10-16 during CP4: its three oldest entries, verbatim.*

### 2026-10-15 (A5b7g1 CP1 — tests first, stopped at the user boundary) — Codex/Sol

Implemented only note 54 §4 CP1 at the user's explicit request. The A6e nurse now runs the real
buildNurseScript YES flow on a hosted TextBox with a program spy; every earlier motion/image/facing/
follow-buffer/render assertion remains. The A6d pushed hop dispatches a real display/program.
Script text routines use retained displays; nine obsolete legacy/explicit-ending test instances were
removed with header mappings to existing source-path coverage. Sixteen new cases cover main ITEM/SAVE
pictures, SAVE timing/restore, Bill's PC labels/bottom box and the three no-ROM census tripwires.
Net **+7**. Production has no diff; nurse re-export and all CP2 retirement/F-1 work remain.

Seven temporary reviewer mutations all failed in their intended assertions, then were restored
byte-for-byte with SHA-256 checks: note 53 M1 (3 failures), V9 (1), M6 (3), V8 (3), M5 (3),
note 51 M2 (2), M10 (1). Details and temporary log paths: `notes/54-a5b7g-plan.md` §10.

Gates: typecheck clean; focused **185/185**; two separate full ROM processes **1570/1570** each
(87 files); without ROM **1440 pass / 130 skip**. Both ROM runs passed without intermittent failures.
Diff check clean. Tests and docs only; no build/browser/setup, no data/extractor change, no writes
to refs or curated sprites. Baselines and CONVENTIONS test-suite descriptions updated.
Local checkpoint commit only; nothing pushed. **Stop here and wait for the user. CP2 has not started.**

### 2026-10-15 (O-29 answered) — the user, recorded by Claude

The user approved all four A5b7g decisions ("yea to all") → DECISIONS #60:
- A5b7g1 (retirement, test debt, F-1, final regression), then A5b7g2 (hidden events and bookshelves as
  programs);
- g2's additive data;
- the bookshelf facing-up rule in g2;
- Sol implements.

Note 54 is marked approved. Docs only. **Next: Sol implements A5b7g1 CP1 (`notes/54-a5b7g-plan.md` §4).**
Nothing pushed.

### 2026-10-15 (A5b7g plan) — Claude

At the user's request ("ultrathink and plan the next slice"), I ran A5b7g's caller census against the ASM
and wrote `notes/54-a5b7g-plan.md`. Findings:
- **Dead legacy, no production caller:** script `text` and `closeText`, the Lab guard's `guardText`
  branch, the non-display `textButtonWait` fallback, TextBox's `legacy` mode and `end` option, and
  upstream's never-set `commandState`.
- **`textButtonWait` stays:** it is `WaitForTextScrollButtonPress` (silent with no arrow, because
  `HandleDownArrowBlinkTiming` never draws ▼ from a zero count), and the hidden-item full-bag path uses it.
- **F-1 (visible bug):** during the Lab's starter choice, posters, the e-mail and the Lab shelves open a
  borderless display. `TextBox.render()` then draws nothing, but input is blocked. The fallback passes
  `autoBox: false`, while each routine calls `EnableAutoTextBoxDrawing`.
- **Not on programs:** bookshelves (three `getText` keys and a hand-written elevator line) and hidden-event
  texts (flattened strings). None of their programs is extracted. Three visible departures on today's maps:
  - the Lab's right poster never switches to StrengthsAndWeaknessesText at 2 owned;
  - shelves read from any side, but `PrintBookshelfText` needs facing up and the one tile at (8,7);
  - the books text starts at +20, not `BookOrSculptureText`'s inner-PrintText +23.
- **Plain NPC and sign strings are equivalent today:** 78 of 80 plain map calls are text-only, and the two
  with `sound` run as handlers. A tripwire is planned.

Recommended split: **g1** (retirement, test debt, F-1, final regression), then **g2** (hidden events and
bookshelves as programs, before V2 adds more). Docs only; gates not re-run (baseline 1563/1563, no-ROM
1433/130). **Next: the user answers O-29.** Nothing pushed.

*Moved from STATUS.md on 2026-10-16: the session log from 2026-10-06 to the A5b7g plan, newest first.*

### 2026-10-15 (context and codebase study, before A5b7g) — Claude

The user asked for a study of the codebase and the context files. I read STATUS, PROJECT, ARCHITECTURE, CONVENTIONS,
PLAN, DECISIONS #52–#59, note 39 (A5b7g's row and §6 *Cleanup*), the story/text/menus subsystem docs, and the
source tree, focusing on what A5b7g will touch. **Caller census for A5b7g's plan:**
- Script `text` and `closeText` have **no production caller**. Only `text_commands.test.ts` and the A6e fixture
  (`overworld_controller.test.ts` `healScript()` and a `pushPlayer` case, note 36 N-3) still use `text`.
- `textButtonWait` still has one real caller, `overworld/item_pickup.ts:36` (hidden-item full bag).
- Both `awaitInteraction` callers (`story/oaks_lab.ts`) pass `guardProgram`. So the `guardText` field, the
  `guard_text` sub-state and the legacy-mode `textBox.show` fallbacks in `script_controller.ts` (~1164–1199) are
  unreachable.
- TextBox `legacy` mode is now reached only through those script paths. Battle and catch-demo `text` steps are
  separate unions (note 39 §6).

Gates: typecheck clean. ROM suite **1563/1563** in 8 of 9 runs. The first, cold run (44 s of imports) had **1
failure that I couldn't reproduce or name**, most likely a timeout under load. If it comes back, run with a
reporter that names the test. Study only: no slice claimed, no code changed. **Next: Claude plans A5b7g.** Nothing pushed.

### 2026-10-15 (context and codebase study after phone connection) — Codex

User requested repository familiarization. Read the entry-point rules, live
handoff and queue, project goals, architecture, session conventions, roadmap,
recent decisions and A5b7 plan/review material; surveyed subsystem architecture
docs. Traced main initialization and state dispatch, frame/pass clocks and
background ticking, overworld actions, retained script/menu/text ownership,
START/SAVE integration, save schema and Vitest/Vite configuration/test setup.
This was an architecture study, not an exhaustive source audit or code review.

Study only: no implementation slice claimed, no engine or generated-data
changes, and no tests/build/setup rerun. Recorded reviewed baseline remains
**1563/1563** with ROM, **1433 pass / 130 skip** without ROM, across 86 files.
Older summary counts are historical; trust the latest handoff/review.
**Next: Claude plans A5b7g** (caller census, justified legacy retirement, A6e
fixture migration and note 51/53 N-1 assertions), then StatusScreen, healing
machine and V2 in the approved order. Local documentation commit only; nothing
pushed.

### 2026-10-15 (A5b7f play-test) — Claude

The user play-tested note 52 §8, both halves: "playtested and everything works well". **A5b7f is done.** START:
the delayed menu and sound, the remembered cursor, the silent START close, the wrap, the hollow arrow and every
submenu return. SAVE: the info box, the typed question with YES/NO on the left, NO closing everything, YES with
"Saving...", the jingle and the automatic close, and CONTINUE at the saved spot. Docs only. **Next: Claude plans
A5b7g** (the caller census, legacy-command retirement, the A6e fixture migration, the final regression, plus
note 51 N-1 and note 53 N-1's missing assertions). Nothing pushed.

### 2026-10-15 (A5b7f review) — Claude

Reviewed A5b7f1 and A5b7f2 together (`0da8f48`…`6fb3c92`); the user had lifted the checkpoint stops. **Passes,
no required fix:** `notes/53-a5b7f-review.md`. Gates re-run: ROM 1563/1563 (86 files), no-ROM 1433/130,
typecheck/build clean, no test hook in the bundle. I traced `start_menu.ts` and `save_menu.ts` against
`start_menu.asm`, `draw_start_menu.asm`, `window.asm`, `start_sub_menus.asm`, `save.asm` and
PrintSaveScreenText. The cursor byte is WRAM outside every saved range (`wram.asm:389`), so the reset on load is
right. I ran 32 mutations: 26 caught, 1 equivalent, 5 survived as test gaps (N-1). Fixed the STATUS
*Completed* table (N-3). **Next: the user's play-test of note 52 §8; then A5b7g.** Nothing pushed.

### 2026-10-15 (A5b7f2 CP5 — final integration and browser verification) — Codex/Sol

Completed CP5 under the user's authorization to continue without checkpoint
stops. Added six main actual-input/storage cases for YES at three offsets,
NO/B and held-A release/direct close. Nine SAVE mutations caught/restored;
final full ROM **1563/1563**, no-ROM **1433/130**, 86 files, typecheck/build
clean. No generated files, save-schema changes or shipped test hooks.

Muted fresh :5187 browser passed YES write once, typed question/left chooser,
actual save-jingle completion, automatic close, reload/title/CONTINUE at the
saved position, NO without changing saved bytes, held-A release and walking.
Zero page exceptions; screenshot inspected. :5173 storage untouched.
CP3 `86a990e`, CP4 `d413bf2`, CP5 this commit; full results note 52 §§12–14.
**A5b7f is ready for review and the user's play-test; no A5b7g started.**

### 2026-10-15 (A5b7f2 CP4 — retained SAVE) — Codex/Sol

Replaced SaveMenu with SaveSession sharing START tiles/Buffer2 and typed
TextBox programs. Added left YES/NO and narrow $6d colon. Info at +5, question
+45, glyph +48; YES writes once at answer+25; then SavingText/128/saved text/
10/current-sound/save-sound/30. Both outcomes restore Buffer2, poll held A and
enter the shared close directly without redisplay or START's extra five frames.
Added eight session cases, left-layout and colon-rendering cases. Focused
**103/103**, ROM **1557/1557**, no-ROM **1427/130**, typecheck/build pass.
Local commit, no generated changes/push. Continuing CP5 per user instruction.

### 2026-10-15 (A5b7f1 CP3 — START integration) — Codex/Sol

Main now uses StartMenuSession for ordinary and script openings. Removed the
competing input sync and duplicate UiEntry sprite update. Wired all CGB return
tails, the five-frame START close prefix before the unchanged close core,
WRAM reset on new game/load and retained START below ITEM/legacy SAVE. Retired
StartMenu. Legacy SAVE remains for CP4, including a temporary redisplay bridge.

Added 25 main-dispatch cases, 5 tail/transfer cases, one retained scanout case;
migrated the two existing START/Pikachu tests. ROM **1547/1547** (85 files),
no-ROM **1417/130**, strict typecheck/build pass. Four mutations caught: extra
input sync, omitted WRAM resets, duplicate UiEntry update, short ITEM tail.
Muted fresh browser :5187 passed B/START/EXIT, remembered cursor, all submenus,
legacy SAVE NO, unchanged bag quantity and walking after close; zero page errors.
Temporary hooks were supplied through Playwright routing, never shipped.
The user lifted checkpoint stops and authorized continuing CP4–CP5. Next SAVE.

### 2026-10-15 (A5b7f1 CP2 only — START session) — Codex/Sol

Implemented note 52 §6 CP2 after the user authorized it following Claude's
CP1 check. StartMenuSession retains logical/visible tiles, opens at +20/+23,
uses HandleMenuInput's last-placed row and Delay3, saves the raw shared cursor,
hollows A/B/START and snapshots Buffer2 on A. Its close owns the five-frame
text-box copy before returning exit to the unchanged shared close core.
Redisplay redraws immediately and arms +3 input (including an empty party).

Added 15 real-input session tests and 2 shared-input tests. Full ROM
**1516/1516**, no-ROM **1386/130**, strict typecheck and production build pass.
No generated files changed. No browser run: main still uses the legacy menu;
CP3 will wire this session, the submenu tails, new-game/load resets and smoke
the actual integrated flow. See note 52 §11. Committed locally, nothing pushed.
**Stopped before CP3; wait for the user's next instruction.**

### 2026-10-15 (A5b7f1 CP1 check) — Claude

I checked Sol's CP1 trace (`ab1303d`, note 52 §4.1–4.6) against the ASM. It is confirmed:
- **The tile-copy rule:** CopyVideoData waits floor(c/8)+1 frames, because the final batch waits even at 0
  tiles (`home/copy2.asm`). So the 32 text-box tiles take **5** frames, not the 4 my plan said; the plan
  error is corrected in the note.
- **The opening:** font 128 → 17 + the 3-frame screen copy = 20, matching A5a's opening.
- **The close:** today's close cost `5 + 2W` ends in the player's two 12-tile copies (2+2), not text-box
  tiles. CloseStartMenu's own 5 frames are missing and must stay out of the shared helper.
- **The tails:** ITEM `.exitMenu` (Buffer2, text-box tiles 5, UpdateSprites) and POKéMON's
  `RestoreScreenTilesAndReloadTilePatterns` match `start_sub_menus.asm` / `home/palettes.asm`.
- MenuInput lacks `wLastMenuItem`, as Sol found; CP2 must add it.

Docs only. **Next: Sol continues with A5b7f1 CP2.** Nothing pushed.

### 2026-10-15 (A5b7f1 CP1 — START source timing trace only) — Codex/Sol

User requested only note 52 §6 CP1, from `18700fe`. Read DisplayTextID/init,
START draw/loop/exit, each submenu tail, font/copy/palette/LCD/sprite reload
ASM and current MenuInput/close/Bag paths. Wrote counts into note 52 §§4.1–4.6,
result §10. Opening +20/+23 stands; the assumed four text-box-copy frames are
actually **five** (32 tiles, 8+8+8+8+0 waits). CurrentMapCloseFrames's +4 is
the player's graphics, so START's separate prefix is missing. CGB tail
redraw/read anchors: dex +3/+6, empty party +0/+3, party +35/+38, item and
option +5/+8, trainer +20/+23; SAVE returns through Hold/close, not START.
MenuInput can return watched Up/Down but lacks last-placed-row state and needs
restart after each START loop return. Propagated numeric corrections to the
future SAVE plan (+45/+48) without implementing it. Typecheck clean; focused
existing ROM-enabled MenuInput/TextBox/map-sprite-set tests **62/62**. No runtime,
test or generated changes; full baseline remains 1499/1499 (1369/130 no-ROM).
Documentation committed locally, nothing pushed. **CP2 not started; stop here.**

### 2026-10-15 (O-28 answered) — the user, recorded by Claude

The user approved all four A5b7f decisions ("yes to all") → DECISIONS #59:
- A5b7f1 (the START menu), then A5b7f2 (SAVE);
- the older-file question waits for A4's player ID;
- the shared START/battle cursor byte now, with battle wiring in A5c;
- Sol implements.

Note 52 is marked approved. Docs only.
**Next: Sol implements A5b7f1 (`notes/52-a5b7f-plan.md` §6 CP1–CP3), then Claude reviews.** Nothing pushed.

### 2026-10-15 (A5b7f plan) — Claude

At the user's request ("ultrathink and plan it, then ChatGPT Sol will implement"), I traced
`home/start_menu.asm`, DrawStartMenu, the StartMenu_X tails, DisplayTextIDInit, HandleMenuInput, SaveMenu,
PrintSaveScreenText, DisplayTwoOptionMenu and CheckPreviousSaveFile against `start_menu.ts`, `save_menu.ts`
and main. I wrote `notes/52-a5b7f-plan.md`. Findings:
- **START is a DisplayTextID(0) session:** the sound and items at +20, first read at +23.
- **The START cursor is shared with battle** (`wBattleAndStartSavedMenuItem`, WRAM).
- **Wrapping:** up wraps only from 0 with last 0; down wraps through a hidden index 7/6.
- **▷ after any A/B/START. START closes silently.** The close copies text-box tiles for 4 frames.
- **SAVE writes before "Saving...".** YES/NO is on the left at (0,7). NO closes everything.
- **The TIME colon is tile $6D.**
- **No player ID exists**, so the older-file question can't be ported yet.
- All save texts are already extracted.

No code change. **Next: the user answers O-28.** Nothing pushed.

### 2026-10-15 (A5b7e play-test) — the user, recorded by Claude

The user: "checked and passed" (note 49 §8). **A5b7e is done.** Context files updated. Docs only.
**Next: Claude plans A5b7f (save presentation).** Nothing pushed.

### 2026-10-15 (A5b7e review) — Claude

I reviewed Sol's A5b7e (`8f05658`…`8db95fd`) in `notes/51-a5b7e-review.md`.
- **Gates re-run:** ROM 1499/1499, no-ROM 1369/130, typecheck/build clean.
- **Trace:** `bills_pc.ts` against `bills_pc.asm`, ChangeBox/DisplayChangeBoxMenu, `list_menu.asm` and the
  happiness `.decreased` path; F-1, F-2 and N-4 checked; the follower adapter traced through main's
  `scriptEnded` re-check.
- **Mutations:** 9 of 11 non-equivalent reviewer mutations caught. The submenu label and the empty bottom box
  have no assertion (N-1).

**Passes, no required fix.** Docs only. **Next: the user play-tests note 49 §8.** Nothing pushed.

### 2026-10-15 (A5b7e CP5 — final verification and handoff) — Codex/Sol

All five checkpoints implemented under the user's instruction to finish the
remaining work without intermediate stops. CP3 `837a4fe`, CP4 `af55f0c`, CP5
this handoff commit. Final audit preserves Change Box's filled cursor during
save and the hidden follower's old antic offset until initialization is allowed.
Final strict typecheck/build clean; ROM **1499/1499** in 83 files; no-ROM
**1369/130**. Eleven source mutations caused assertion failures and were restored
before the final gates. Muted isolated :5199 Chrome passed 13 checks: all note
49 §8 flows, both shared stats pages, source restrictions/happiness/release,
healthy/fainted follower through close, Change Box NO/B/same/other A, actual
save/reload/CONTINUE, nested item-PC text and medicine capitals. No page errors
or unexpected missing assets; temporary storage cleared, :5173 untouched.
Results/evidence in note 49 §14 and `%TEMP%/pkmn-a5b7e-cp5/`. No generated
changes after CP1. Architecture, roadmap, baselines and test list updated.
Committed locally; nothing pushed. **Next: Claude review and user play-test.
A5b7f is not started; do not mark A5b7e user-verified before that feedback.**

### 2026-10-15 (A5b7e CP4 — shared STATS, Change Box and retirement) — Codex/Sol

From CP3 `837a4fe`, shared the existing stats pages/tiles, implemented source
Change Box warning/typed hidden chooser/save and empty PRINT BOX, and deleted
the legacy Bill menu/export. Source-aligned tests cover E+6 stats return,
C+48/+51 medium chooser, occupied balls/spacing, NO/B/no save and same/other-box
A save ordering. Production controller flows use real per-tick taps, check
input/transfer ownership, and cover follower state before glyphs through close.
Strict typecheck clean; focused **505/505** in 36 files. Result: note 49 §13.
Committed locally; CP5 final gates/browser/docs follow without another stop.

### 2026-10-15 (A5b7e CP3 — retained Bill menu, transfers and follower) — Codex/Sol

User lifted checkpoint stops and authorized the rest, including the narrow CP1
follower dependency. From `2c2f3de`, implemented retained BillsPc and common
PcDisplay, source lists/submenu/transfers/release, starter restrictions/happiness,
offset/cursor resets and status-0 eligibility/coverage initialization. Result
and boundaries: note 49 §12. Strict typecheck clean; focused **490/490** (35
files). +22 tests; no generated changes. CP3's permitted STATS stub remains;
CP4 now adds shared pages/Change Box/Print Box and removes the legacy bridge.
Committed locally with this entry; continue without another permission stop.

### 2026-10-15 (A5b7e CP2 only — shared foundations and F-1/F-2) — Codex/Sol

User authorized CP2 after the CP1 pause. Implemented note 49 §6 CP2 from
`a7a6edd`: shared text-delay flag, typed post-list item-PC text (F-1), uppercase
display-name helper including medicine (F-2), mon-list LV/100 layout, single-row
input stride, LV/ball painter assets, shared storage types/conversion/capacities,
boxed starter stand-in, source DEPOSITED modifier, and factored START save callback.
Bill's bridge stays; deposit gating and follower integration have not started.
Detailed result/source timing in note 49 §11. +26 tests; ROM **1462/1462** (80
files), no-ROM **1332/130**, strict typecheck/build/diff clean. Muted isolated
:5198 browser passed real-input PC text, uppercase Potion result, START save
payload and reload/CONTINUE; no page errors/unexpected failed assets. Scratch
logs/screenshots in `%TEMP%/pkmn-a5b7e-cp2/`; :5173/user saves untouched.
Committed locally with this handoff; nothing pushed.
**STOP: CP3 has not started. Wait for confirmation, including CP1's narrow
follower adapter (§4.10), before the next checkpoint.**

### 2026-10-15 (A5b7e CP1 only — trace and data) — Codex/Sol

Implemented only the explicitly authorized CP1 from `8f05658`. Source frame
anchors and follower answer are in note 49 §§4.9–4.10; result in §10. Confirmed
both missing text addresses against pret's symbols/ASM and registered the
NoPokemonText FAR pair. Setup twice: all 873 generated paths/hashes identical;
only the two text-program mirrors changed, exactly two additions (547 → 549),
all older programs/pointer tables intact. No runtime or test implementation.

Baseline/final typecheck clean; baseline/final ROM **1436/1436** (78 files);
no-ROM **1306 pass / 130 skip**; final text-program/static-export **14/14**;
diff/whitespace clean. Logs and hash manifests in `%TEMP%/pkmn-a5b7e-cp1/`.
No browser/build run for the data-only change. Follower dependency reported:
result PrintText runs the first post-transfer sprite update; exact hidden-slot
respawn needs eligibility/status/coverage integration, to confirm before CP3.
Committed locally with this handoff; nothing pushed.
**STOP: CP2 has not started. Wait for the user's confirmation.**

### 2026-10-15 (A5b7e CP1 implementation plan only) — Codex/Sol

Read approved note 49 and DECISIONS #58, the current PC/session/follower code,
the Bill's PC tile-copy/menu/follower ASM and the text-program fixtures. Added
`notes/50-a5b7e-cp1-plan.md`: source timing trace, follower integration contract,
the two missing text-program registrations, deterministic regeneration and
verification. Confirmed both proposed text addresses against pret's symbol
branch. The current UI and ordinary sprite helpers skip hidden followers; CP1
must resolve withdrawal's spawn boundary before later implementation.
No runtime code, tests or generated files changed; no verification suites run
for this documentation-only plan. Whitespace and the final diff checked.
**Stop: wait for the user's go-ahead for CP1. After CP1, ask again before CP2.**
The user's sequential-work instruction applies despite the parent plan's approval.

### 2026-10-15 (O-27 answered) — the user, recorded by Claude

The user approved all five A5b7e decisions ("1 yes, 2 yes, it should save the game, 3 yes, 4 yes, 5 sol") →
DECISIONS #58. That means:
- the cartridge's Bill's PC now;
- Change Box saves the game;
- STATS uses the existing pages, and the StatusScreen port becomes its own slice after A5b7g;
- F-1/F-2 are fixed here and N-4 is closed;
- Sol implements.

PLAN's E2 no longer holds Bill's PC. Note 49 is marked approved. Docs only.
**Next: Sol implements A5b7e (`notes/49-a5b7e-plan.md` §6, CP1–CP5), then Claude reviews.** Nothing pushed.

### 2026-10-15 (A5b7e plan) — Claude

At the user's request ("ultrathink and make a plan for A5b7e"), I traced Bill's PC against `BillsPcMenu` and
A5b7d's bridge and wrote `notes/49-a5b7e-plan.md`. Sources: all of `bills_pc.asm`, `pc.asm`, `ChangeBox` /
`DisplayChangeBoxMenu`, `DisplayListMenuID` (PCPOKEMONLISTMENU), the starter-Pikachu helpers, the happiness
table and `PrintPCBox`. Findings:
- **Bill's menus are silent.** The Bill's branch never clears the PCMainMenu flag.
- **The menu has six entries** (PRINT BOX included), an empty bottom box and a BOX No. box. There are no
  question texts: WhatText and the Which… texts are unreferenced in Yellow.
- **Withdraw and deposit go through DEPOSIT/WITHDRAW–STATS–CANCEL,** not YES/NO.
- **Release NO returns to the list on the same row.**
- **The starter can't be released.** DEPOSITED happiness applies only to the starter.
- **Change Box warns, chooses (typed while the BG transfer is off) and saves the game.**
- **Every Bill's PC text is already extracted** except PRINT BOX's NoPokemonText (sym addresses are in the
  plan).
- **F-1, a gap in my A5b7d plan:** `DisplayListMenuID` and the YES/NO clear `BIT_NO_TEXT_DELAY`, so the item
  PC's texts after a list should type; today they are instant.
- **F-2:** field medicine binds mixed-case nicknames.

No code change. **Next: the user answers O-27 and picks the implementer.** Nothing pushed.

### 2026-10-15 (context and codebase study) — Claude

The user asked for a read of the whole codebase and the context files. Read all seven context files, the eight
subsystem ARCHITECTURE docs, and all of `game/src`: main, core, input, renderer, text, script, overworld,
pikachu, story, audio, menus, battle, the `rom/` extraction system, debug, `scripts/extract_dev_data.ts`, and
the test helpers. The 78 test files were listed but not read in full. One small find, for A5b7g (cleanup):
`SFX_NAMES` in `rom/index.ts` (which has duplicates) and in `scripts/extract_dev_data.ts` disagree. The dev
script also writes `poisoned`, `shrink`, the four teleports, `ss_anne_horn`, `trade_machine` and
`safari_zone_pa`. This is harmless because `static/` mirrors `data/`'s JSON. Study only: no slice claimed, no
code or generated data changed, gates not re-run (baseline still 1436/1436, no-ROM 1306/130).
**Next: Claude plans A5b7e (Bill's PC).** Nothing pushed.

### 2026-10-15 (A5b7d play-test) — the user, recorded by Claude

The user: "i checked and all works well" (note 47 §7, the cursor fix, and the Mart/bag glance from note 48 N-1).
**A5b7d is done.** Context files updated. Docs only. **Next: Claude plans A5b7e (Bill's PC).** Nothing pushed.

### 2026-10-15 (A5b7d F-1 fix) — Claude

At the user's request, fixed note 48 F-1 in `menus/pc.ts`: ▷ only in PlayerPCMenu on A without B; the
main menu keeps ▶. Three tests in `menus/pc.test.ts` (Oak keeps ▶, B keeps ▶ through turn-off, A on LOG OFF
shows ▷); the first two fail with the fix reverted. ROM 1436/1436, no-ROM 1306/130, typecheck/build/diff
check clean. **Next: the user play-test (note 47 §7 + glance at the Mart and bag).** Nothing pushed.

### 2026-10-15 (A5b7d review) — Claude

Reviewed Sol's A5b7d (`notes/48-a5b7d-review.md`). Re-ran the gates: 1433/1433, no-ROM 1303/130,
typecheck/build/diff check clean. Traced players_pc / pc / oaks_pc / DisplayPCMainMenu / TossItem_;
everything matches except **F-1**: PCMainMenu never places ▷, and PlayerPCMenu places it only after the
B test, so the main menu (and B in the item PC) keep ▶; ours draws ▷. Seven extra mutations all caught.
A probe confirmed that Buffer2 after Oak's PC is harmless (TextBoxBorder blanks the interior). Docs only.
**Next: fix F-1, then the user play-test.** Nothing pushed.

### 2026-10-15 (A5b7d CP5 — verification and review handoff) — Codex/Sol

Final ROM suite **1433/1433**, no-ROM **1303 pass / 130 skip**, 78 files;
typecheck/build clean. Eight production self-mutations caught and restored
(sound, typed item text, remove-before-add, outer wait, main/parent cursors,
turn-on wait order, transparent tiles). CP1's setup-twice manifest covered all
873 generated files; final ROM tests verify the exports still match.

The muted spare-port browser found invisible menu cells: ScreenTiles' painter
used transparent font glyphs and had no border mapping. `drawScreenTile` now
paints each transferred cell, including blanks and the six source borders;
the shared PC/Mart host and bag use it. Added an actual-renderer regression;
visually checked Red's menu and the four-entry Pokécenter menu. Browser script,
screenshots and results are in `%TEMP%/pkmn-a5b7d/`; no test hooks committed.
Full browser flow/result details are in note 47 §9.

Oak's rating remains the approved gap, Bill's screen remains the A5b7e bridge.
Note 46 N-4 was revisited: PartyMenuInit uses the saved cursor without clamping,
and BillsPCMenu resets it to zero. The old bridge still has its own cursor;
port that shared-state behavior in A5b7e with Bill's menu, then remove/audit the
PartyMenu clamp. No party/storage mechanics changed in this slice.
**STOP: ask the user to check STATUS and review.** Nothing pushed.

### 2026-10-15 (A5b7d CP4 — retirement and integration) — Codex/Sol

Removed PcMenu/PokecenterPcMenu, main's legacy states/actions/render cases and
their UI-entry entries. The three old inventory-caller tests moved to actual
PcSession flows (including duplicate-slot retry/toss); SELECT swap is covered.
Nine production-dispatch tests use hidden events and real per-tick keys: both
facings/openings, first print +20/glyph +23, taps on three consecutive idle
frames, full withdraw/return/close, protected sound/Hold, Bill bridge and render
purity. Assertions monitor one transfer and no competing text/menu Joypad owners.
Main's existing scriptEnded path preserves follower refresh after storage.
Typecheck clean; full no-ROM run before the final three coverage additions:
1299 pass / 130 skip (78 files); focused PC tests including additions 36/36.
Next CP5: full final gates, mutations, spare-port muted browser, docs and handoff.

### 2026-10-15 (A5b7d CP3 — Pokécenter PC) — Codex/Sol

ActivatePC now uses the box-less opening, typed turn-on/preamble, after-prompt
sound wait, Delay3, source main-menu layouts and silent input. Nested PlayerPC
returns without cycling power; main returns at cursor 0. Oak's new programs
run typed with silent YES/NO and waitbutton closure; DisplayDexRating remains
the approved gap. Bill/SOMEONE preambles enter today's BillsPcMenu behind a
full-screen bridge, preserving Change Box through a storage callback. Nine
additional real-input tests cover flags/layouts, Delay3/read anchors, sound
order, nested exit, both Oak answers, both Bill names/current box and B+A logoff.
PC/bag/Mart 57/57; typecheck clean. Next CP4: retirement and dispatch integration.

### 2026-10-15 (A5b7d CP2 — Red's PC) — Codex/Sol

Added PcSession and RED_PC's retained hidden-event script. Source-matched typed
turn-on, silent/no-delay item menu with remembered parent cursor, shared lists
and plain quantities, withdraw/deposit/toss, atomic failures and source empties,
selected duplicate-slot removal, sound waits, Buffer2 restoration and outer-wait-free
exit. Fifteen real-input session tests pin P+6/M+19/Q+4, menu silence, both
sound waits, full inventories, key/HM refusal, quantity cancel, toss NO/YES and
the empty-slot reset. PC/bag/Mart 48/48; typecheck clean. Next CP3: Pokécenter
main menu, nested item PC, Oak and Bill bridge. Legacy retirement stays CP4.

### 2026-10-15 (A5b7d CP1 — plumbing and data) — Codex/Sol

User reassigned implementation from Grok to Codex/Sol. Read note 47,
players_pc/pc/oaks_pc/hidden-event ASM and TossItem_/silent input behavior.
Generalized the retained slot through MenuSession; factored TossItem_ source
inventory/confirmation/removal helpers. Silent YesNoMenu retains read/tail
timing and defaults to sound. Six Oak-PC symbols independently confirmed
against pret's sym branch. Focused menu/Mart 51/51, ROM text/export 14/14;
typecheck clean. Setup twice identical across 873 files; only text-program
mirrors change from baseline. Next CP2, then CP3–5; stop for user review.

### 2026-10-15 (O-26 answered) — the user, recorded by Claude

The user approved all four A5b7d decisions ("yes to all") → DECISIONS #57. The user then picked **Sol** to
implement ("sol will implement"). Note 47 marked approved. Docs only.
**Next: Sol implements A5b7d (`notes/47-a5b7d-plan.md` §6, CP1–CP5), then Claude reviews.** Nothing pushed.

### 2026-10-15 (A5b7d plan) — Claude

At the user's request ("ultrathink and make a plan for A5b7d"), traced `players_pc.asm`, `pc.asm`,
DisplayPCMainMenu, OpenOaksPC, DisplayDexRating and both hidden-event entries against `pc_menu.ts` /
`pokecenter_pc_menu.ts`, and wrote `notes/47-a5b7d-plan.md`. Findings:
- **Silent buttons:** `BIT_NO_MENU_BUTTON_SOUND` silences every menu in both PCs, even YES/NO; only
  text prompts beep.
- **No-delay text** inside PlayerPCMenu.
- **Sounds:** `turn_on_pc` starts before the text (the Pokécenter waits for it after the prompt);
  `enter_pc` before each child; `withdraw_deposit` after add-then-remove; `turn_off_pc` + wait on
  exit.
- **Both PCs close via HoldTextDisplayOpen** (no outer wait).
- **The auto box:** on for Red's PC, off for the Pokécenter's.
- **Cursors:** PlayerPCMenu reopens on the last entry, the main menu at the top.
- **Oak's PC:** the menu shows PROF.OAK's PC once you have the Pokédex. Its three texts aren't
  extracted (sym addresses in the plan).
- All item-PC texts are already extracted.

No code change. **Next: the user answers O-26 and picks the implementer.** Nothing pushed.

### 2026-10-15 (context and codebase study) — Codex

User requested reading the codebase and context files. Read the entry-point
rules, live handoff, project goals, roadmap, conventions, architecture and
recent decisions/review; surveyed the subsystem architecture docs. Traced
main initialization/state dispatch, frame/pass clocks and background ticking,
overworld actions, retained text/script contracts, bag/field medicine, existing
PC menus, save schema and development extraction/configuration.

Study only: no implementation slice claimed and no engine/generated-data
changes. Tests/build/setup were not rerun; the recorded reviewed baseline
remains **1393/1393** with ROM, **1263 pass / 130 skip** without ROM. Older
summary counts lag STATUS and the latest review. **Next: Claude plans A5b7d**
(item and Pokécenter PCs); A5b7c is complete and user-verified. Study handoff
committed locally; nothing pushed.

### 2026-10-15 (A5b7c2 play-test) — the user, recorded by Claude

The user: "just tested and it all works well" (note 45, Verification: Potion, Antidote, a no-effect Potion,
the SWITCH prompt, the Parcel). **A5b7c2 is done, and with it A5b7c.** Context files updated. Docs only.
**Next: Claude plans A5b7d.** Nothing pushed.

### 2026-10-15 (A5b7c2 review fixes) — Claude

At the user's request ("make a plan and apply the fixes yourself"):
- **F-1:** the item-use party menu reads every frame via `readJoypad`/`isPassPressed`, with Delay3
  only after an unwatched key. In useItem mode A suppresses movement and B wins over A
  (HandleMenuInput_/HandlePartyMenuInput).
- **F-2:** a frozen row picture (`PartyRowOverride`: pre-use color and status, animated bar and
  number) until the result redraw, which also erases the cursor. The chosen row shows ▷ (N-2).
- **F-3, found while fixing:** a real-input probe showed the result message never appeared. The
  text box was active but empty, because nothing ticked it in the result phase. The bag's
  `present()` now ticks it for every field-medicine PrintText.
- **Tests:** `menus/field_medicine_input.test.ts` (4) uses the real per-tick input module, and 3
  result-screen cases cover the text appearing all at once (N-1), the frozen color and status,
  and the cursor. Each fix was reverted once to confirm its test fails (7/7 caught).

ROM 1393/1393 (75 files), no-ROM 1263/130, typecheck/build/diff check clean. No browser play; the
user play-test is next. Nothing pushed.

### 2026-10-15 (A5b7c2 review) — Claude

Reviewed Grok's five A5b7c2 commits against note 45 and the ASM. `notes/46-a5b7c2-review.md`: data, HP-bar
math (floor, ÷4, low-byte divisor, 27/10 colors, col-13 fraction), the UpdateHPBar2 schedule (74 and 30
frames hand-checked), ItemUseMedicine outcomes and the P+19/P+22 return are right. Gates re-run: ROM
1386/1386, no-ROM 1256/130, typecheck/build clean, setup re-run no diff; 11 of 12 mutations caught (N-1:
result no-delay unpinned). **F-1:** `FieldMedicine.choose()` polls every third frame, so taps on two of
three frames are lost (a real-input probe confirmed it; the test rig latches `isPressed` until read, which
hid it). **F-2:** the bar's color follows the live pixels during the animation; on the cartridge the color
is a palette set only at the redraw. **Next: F-1/F-2, then the user play-test.** Nothing pushed.

### 2026-10-15 (A5b7c2 implemented) — Grok 4.7

Implemented `notes/45-a5b7c2-plan.md` and stopped after CP5 for Claude's review. CP1 `a21d718` extracts `heal_hp` and `heal_ailment` (bank `$1f` copies match) and `ItemUseNotYoursToUseText`, routes OAK'S PARCEL to it, and adds the missing cursor and toss-2 tests. CP2 `188a4a4` is `hp_bar.ts`: floor length, pixel color, the increase schedule, and the party fraction at column 13. CP3 `eb0d1f3` is the party menu's `useItem` mode, `wPartyAndBillsPCSavedMenuItem`, and the Normal/SWITCH programs. CP4 `784607e` is `field_medicine.ts` and deletes `item_menu.ts`. ROM **1386/1386** (74 files), no-ROM **1256/130**, typecheck and build clean. Spare-port smoke was a page load on `http://127.0.0.1:5199/` only; the canvas flows are pinned in the tests, not played. **Stop for review.** The play-test is note 45 Verification (Z = A, X = B, `http://127.0.0.1:5173/`). Do not start the healing machine, V2, or the intro animation. Nothing pushed.

### 2026-10-15 (A5b7c2 plan) — Claude

At the user's request ("ultrathink and make the plan for A5b7c2"), did note 43 §4's trace (DisplayPartyMenu,
RedrawPartyMenu_, HandlePartyMenuInput, ItemUseMedicine, UpdateHPBar2/GetHPBarLength/GetHealthBarColor,
StartMenu_Item's return, StartMenu_Pokemon's prompts, ModifyPikachuHappiness, RespawnOverworldPikachu)
and wrote `notes/45-a5b7c2-plan.md`. Findings:
- **The HP bar:** floor not ceil (÷4 above 255 max HP, min 1); color by pixels (27/10); the party
  fraction at col 13, not 12.
- **UpdateHPBar2:** 1 frame per HP step plus 2 per pixel, printing the pre-step HP, then 6 frames.
  Corrects note 43, which said steps without a pixel change cost nothing.
- **Field use:** under a white palette (visible R+12, read R+15); the result phase E+1..E+9,
  50 frames, a silent wait; the bag reappears at P+19 (`LoadGBPal`), read P+22.
- **Happiness:** for the starter Pikachu only, before the effect check.
- **Full Restore:** at full HP with a status it becomes Full Heal.
- **Addresses:** the Parcel's ItemUseNotYoursToUseText `$03:$6504` / `$2D:$6D92`; heal_hp
  `$02:$41A7`, heal_ailment `$02:$41AA` (to confirm against pret's sym).

The user approved and chose Grok to implement. Docs only. **Next: Grok implements A5b7c2.** Nothing pushed.

### 2026-10-15 (A5b7c1 play-test) — the user, recorded by Claude

The user: "all works fine" (note 43 §3.5). **A5b7c1 is done.** Docs only. **Next: Claude plans A5b7c2.**
Nothing pushed.

### 2026-10-15 (A5b7c1 review) — Claude

Reviewed Grok's four A5b7c1 commits against note 43 §3/§3.6 and the ASM. `notes/44-a5b7c1-review.md`:
**passed, no code fix.** Gates re-run: ROM 1348/1348 (71 files), no-ROM 1225/123, typecheck/build/diff
check clean. Ten mutations: eight caught, one equivalent, and two test gaps (N-1 the saved bag cursor
across close/reopen, N-2 tossing more than one). F-1: the Parcel's USE text is `ItemUseNotYoursToUse`
("This isn't yours to use!"), not NotTime. The plan was wrong; Grok flagged it. The program needs
extracting, so it goes to c2's data checkpoint. **Next: the user play-test.** Nothing pushed.

### 2026-10-15 (A5b7c1 implemented) — Grok 4.7

Implemented note 43 §3, including §3.6, and stopped after CP5 for review. CP1 `bb1846b` moves the list cursors into `list_state.ts` and zeroes them when a removal empties a slot (F-2), and pins the merge reset, the A/B re-arm of 5, and a lone `writeNumber` 0. CP2 `ef24017` is the bag list, USE/TOSS (B before A), and the return to START. Toss and field USE are both in `aecdc3d`: quantity, IsItOK, YES/NO, ThrewAway, TooImportant, NotTime for a ball and the parcel, the Town Map returning to `ItemMenuLoop`, and the old field screen for party-menu items. The message box stays up until the bottom third after the list's transfer comes back. ROM 1348/1348 (71 files), no-ROM 1225/123, typecheck and build clean. No browser play-through: the flows are pinned in `bag.test.ts` and `mart.test.ts`. **Next: Claude reviews, then the user play-tests note 43 §3.5 (Z = A, X = B), including the Mart scroll fix. Do not start A5b7c2.** Nothing pushed.

### 2026-10-15 (A5b7c1 made implementation-ready for Grok) — Claude Opus 5.5

The user asked for a plan for the next slice, implemented by Grok. A5b7c1 was already planned (note 43
§3), so Claude re-verified it against `start_menu.asm`, `tilemap.asm`, `palettes.asm`, `inventory.asm`,
`town_map.asm`, `start_sub_menus.asm` and today's code, and added note 43 §3.6. The findings:
- **F-2:** `RemoveItemFromInventory_` resets the list state when a slot empties. The Mart doesn't, so
  CP1 fixes it.
- The bag session owns the one BG tick in `item_menu`.
- The message box must linger through `ItemMenuLoop`'s 10 transfer-off frames.
- The transfer must be left enabled on exit.
- USE/TOSS takes B before A.
- USE dispatch: balls and the Parcel get NotTime, the Town Map returns to the bag, and medicine goes
  through a temporary bridge until c2.
- The Town Map's blank exit frames go to its own audit.
- Heads-up for V2: ESCAPE_ROPE is sold in Pewter.

DECISIONS #56 amended: Grok implements c1. No code change. **Next: Grok implements A5b7c1.** Nothing pushed.

### 2026-10-14 (O-25 approved) — the user, recorded by Claude Opus 5.5

The user approved all five A5b7c decisions ("yes to all") → DECISIONS #56. Docs only. **Next: Sol
implements A5b7c1** (note 43 §3). Nothing pushed.

### 2026-10-14 (A5b7c plan) — Claude Opus 5.5

At the user's request ("ultrathink and plan it now, but we will implement tomorrow"), traced
StartMenu_Item/ItemMenuLoop, UseItem's table, TossItem_, ItemUseMedicine, DisplayPartyMenu/
HandlePartyMenuInput, RedrawPartyMenu_'s messages and UpdateHPBar2 against `item_menu.ts`/
`party_menu.ts`. Wrote `notes/43-a5b7c-plan.md`: gaps H1–H9 (toss's prompt comes before YES/NO and
"Threw away" has no count; NotTime instead of "Can't use that here."; Town Map returns to the bag;
the HP bar moves 2 frames per pixel; "Move to where?" is invented), c1 fully specified in five
checkpoints, c2 at contract level with a trace-first CP1, O-25. All programs are already extracted.
No code change. **Next: the user answers O-25; Sol implements A5b7c1.** Nothing pushed.

### 2026-10-14 (V2 moved up) — the user, recorded by Claude Opus 5.5

The user: "let's move pewter up", choosing "After A5b7 + healing machine". DECISIONS #55: A5b7c–g →
healing machine → **V2** → intro animation → A5c–A5f → V3. Docs only. **Next: Claude plans A5b7c.**
Nothing pushed.

### 2026-10-14 (A5b7b play-test) — the user, recorded by Claude Opus 5.5

The user: "i tested, every check passes" (note 41 §7). **A5b7b is done.** The user noticed the road
north to Pewter is closed: expected, Pewter is V2, after A5 (DECISIONS #44 order). Docs only.
**Next: Claude plans A5b7c** (field items and party, note 39 §1). Nothing pushed.

### 2026-10-14 (A5b7b F-1 fix) — Claude Opus 5.5

At the user's request ("apply f1 yourself and test"): `pokemart.ts` takes A before B on BUY/SELL/QUIT;
new regression test in `story/mart.test.ts` (fails without the fix). ROM 1331/1331 (70 files), no-ROM
1208/123, typecheck/build/diff check clean. Note 42 closes F-1. **Next: the user play-test**, then plan
A5b7c. Nothing pushed.

### 2026-10-14 (A5b7b review) — Claude Opus 5.5

Reviewed Grok's six A5b7b commits against note 41 and the ASM (`pokemart.asm`, `list_menu.asm`,
`swap_items.asm`, `text_box.asm`, `joypad2.asm`, `window.asm`, `print_bcd.asm`, `print_num.asm`,
`print_text.asm`). `notes/42-a5b7b-review.md`: **passed with F-1** (A+B on BUY/SELL/QUIT quits instead
of taking A). Gates re-run: ROM 1330/1330, no-ROM 1207/123, typecheck/build/diff check clean. Ten
reviewer mutations, eight caught; the merge-reset assertion is vacuous (N-1) and the A/B-held repeat
re-arm is unpinned (N-2). N-3 `writeNumber` skips a lone 0 (unreachable now). Grok's "Joypad read twice
on a letter frame" is cartridge behavior (`PrintLetterDelay` spins without `DelayFrame`). **Next: F-1,
then the user play-test.** Nothing pushed.

### 2026-10-14 (A5b7b CP6 — handoff) — Grok 4.7

Finished note 41 §5 CP6. The spare-origin smoke (`http://127.0.0.1:5188/`, muted, disposable save; `http://127.0.0.1:5173/` untouched) bought an antidote, refused a short payment and a full bag, refused TOWN MAP, sold the later POTION slot (the MONEY digit changed before the bag did), swapped with SELECT, sold the remaining POTION stack, left through Thank You, and stepped right. The console had no errors. Six self-mutations were caught and reverted. ROM 1330/1330 (70 files); no-ROM 1207/123; typecheck and build clean. **Stop for review.** The play-test is note 41 §7 (A = Z, B = X). Do not start A5b7c, the healing machine, or the intro animation. Nothing pushed.

### 2026-10-14 (A5b7b CP5 — selling) — Grok 4.7

Implemented note 41 §5 CP5. SELL prints "What would you like to sell?", then the bag list. A key item or HM01–HM05 prints "I can't put a price on that." and returns to BUY/SELL/QUIT with no quantity box. A sale asks the halved total, adds it (capped at ¥999999) and redraws the MONEY box before the purchase sound, and removes that slot when the sound ends. There is no sold message. Selling the last item leaves a CANCEL-only list; the empty-bag text waits for the next SELL. SELECT swaps bag order. Quantity B and NO do not transact, and a scroll is kept. The items defined today match `key_items.asm` (TOWN MAP and OAK's PARCEL). Typecheck clean. Mart tests 16 passed. Full suites wait for CP6. **Next: CP6** (docs, browser smoke, full suites). The user reviews when the slice is reported done; the play-test is note 41 §7. Nothing pushed.

### 2026-10-14 (A5b7b CP4 — buying) — Grok 4.7

Implemented note 41 §5 CP4. BUY prints "Take your time.", then the priced list (first read at L+16, border visible by L+13). A quantity, a silent A, and `PokemartTellBuyPriceText` (the item name and the total; the second line break is the ▼). YES/NO uses the existing menu at (14,7) with the 15-frame tail. YES adds to the bag before subtracting money; the purchase sound waits with no Joypad reads; "Here you are! Thank you!" follows. The MONEY box keeps the old amount until the list redraw at B′+11. Not enough money and a full bag return to BUY/SELL/QUIT with nothing changed, and the retry charges once. A stack of 99 takes the overflow in a new slot. NO, B, and a quantity B do not transact; a scroll survives the quantity B and the cursor returns to the top row. Typecheck clean. Mart tests 8 passed. Full suites wait for CP6. **Next: CP5** (selling). The user reviews when the slice is reported done; the play-test is note 41 §7. Nothing pushed.

### 2026-10-14 (A5b7b CP3 — Mart entry, menu, and exit) — Grok 4.7

Implemented note 41 §5 CP3. The Viridian clerk's second text table (after OAK_GOT_PARCEL) runs the `mart` script: greeting at T+23, then DisplayPokemartDialogue. MONEY and BUY/SELL/QUIT are written on G and show by thirds from G+1; the first menu read is G+3. B or QUIT prints Thank You and keeps ▷ through the outer silent wait, Hold and close; the Mart tiles go away with the message box. Empty-bag SELL prints the prompt, restores the menu and returns the cursor to BUY. The Mart and the text box share one VBlank tick; a letter frame can read Joypad twice as the next letter starts, and the menu never reads on that same frame. `wListScrollOffset` is 0 while the menu is up and restored on exit. `openShop`, the shop state and `ShopMenu` are gone. Typecheck clean. ROM 1316/1316 (70 files); no-ROM 1193/123; build clean. **Next: CP4** (buying). The user reviews when the slice is reported done; the play-test is note 41 §7. Nothing pushed.

### 2026-10-14 (A5b7b CP2 — list menu and HandleMenuInput) — Grok 4.7

Implemented note 41 §5 CP2. `list_menu.ts` is DisplayListMenuID for priced and bag lists: LIST_MENU_BOX, four names, a cursor that stops on the third row, ▼ only while CANCEL is off screen, prices and quantities at the cartridge cells, and SELECT swap/merge/split. The first read is 16 frames in. A fresh Down scrolls at once and arms 30; once that elapses, a held Down scrolls every 6 frames. `menu_input.ts` adds `watchOutOfBounds` and `repeat`, both defaulting off, so the blackboard and Oak's name menu stay as they were. Typecheck clean. Focused tests plus Oak speech and the school: 43 passed. Full suites wait for CP3. **Next: CP3** (mart entry, frames, exit; retire ShopMenu). The user reviews when the slice is reported done; the play-test is note 41 §7. Nothing pushed.

### 2026-10-14 (A5b7b CP1 — screen tiles, transfer switch, quantity menu) — Grok 4.7

Claimed A5b7b and implemented note 41 §5 CP1. `menus/screen_tiles.ts` (border, PlaceString, BCD/number cells that skip rather than blank, Buffer1 including the message box). `BgTransfer.enabled` holds the portion while off; thirds stay 0–5, 6–11, 12–17. TextBox `saveScreen`/`restoreScreen` restores tiles only. `quantity_menu.ts`: both layouts, wrap at 99 and at a stack, priced total with floored halving, silent A/B, first read on the first frame. Typecheck clean. Focused tests plus textbox, Oak speech and the nurse: 79 passed. Full suites wait for CP3, as the plan says. **Next: CP2** (list menu, `watchOutOfBounds`, repeat). The user reviews when the slice is reported done; the play-test is note 41 §7. Nothing pushed.

### 2026-10-14 (O-24 approved) — the user, recorded by Claude Opus 5.5

The user approved all five A5b7b decisions ("yes to all") → DECISIONS #54. The implementer
(Sol or Grok) is the user's pick at handoff. Docs only. **Next: implement A5b7b CP1**
(note 41 §5). Nothing pushed.

### 2026-10-14 (A5b7b plan) — Claude Opus 5.5

At the user's request ("ULTRATHINK and make a plan yourself"), planned the Mart from
`pokemart.asm`, `list_menu.asm`, `swap_items.asm`, `text_box.asm`, `window.asm`,
`joypad2.asm`, `tilemap.asm`, `inventory.asm` and the code. Wrote `notes/41-a5b7b-plan.md`:
eleven gaps (G1–G11), the design (a `mart` text script + `pokemart` session in the display
session; a screen tile model with Buffer1 and the transfer switch; the cartridge list and
quantity menus), frame anchors, six checkpoints, a play-test and O-24. Findings: the buy
price text has a `cont` ▼; the quantity box is silent, has no Delay3 and wraps; selling
shows no message and redraws MONEY before its sound; the list cursor reaches only the
third row, scrolls every 6 frames held, auto-repeats 30/5, and selects on Down while A is
held; the list hides the restored money/message for 10 frames; `purchase` has no audio-bank
caveat; Viridian's inventory matches `marts.asm`, V2 should extract it. No code change.
**Next: the user answers O-24 and picks the implementer.** Nothing pushed.

### 2026-10-14 (A5b7a user check) — the user, recorded by Claude Opus 5.5

The user confirmed note 40's three checks ("yes, I confirm those"): the PC `'s` in one
tile, YES/NO unchanged, a battle contraction in one tile. **A5b7a is done.** Docs only.
**Next: Sol plans A5b7b (Mart)**, then implements; Claude reviews. Nothing pushed.

### 2026-10-14 (A5b7a review) — Claude Opus 5.5

Reviewed `1cfead5`, `943ac7f`, `936bcee` against note 39 §4 and the ASM
(`home/print_bcd.asm`, `print_num.asm`, `text.asm` TX_BCD/TX_NUM). **Passed, no
required fix** (`notes/40-a5b7a-review.md`). Gates re-run: ROM 1299/1299 (66 files),
no-ROM 1176/123, typecheck/build/diff check clean. Six reviewer mutations (zero
fallback back-up, `¥` delay, decimal delays, skip vs. blank, extra-glyph sheet,
deferred `¥`) all caught, all restored. Non-blocking: battle lines now draw single
contraction glyphs too (correct per ROM, added to the user check); column clip vs.
cartridge row wrap and out-of-range decimals throwing are unreachable today.
**Next: the user check in note 40**, then A5b7b. Commit locally; nothing pushed.

### 2026-10-14 (A5b7a CP3 — glyph rendering and final handoff) — Codex/Sol

Common menu text uses the printer's contraction primitive and the extra font
sheet for quotes/ellipsis; `textWidth` measures game pixels. Six Canvas tests;
no unrelated `.length`/layout rewrite or later menu migration. Documentation and
baseline refreshed. Net +57 tests (49 numbers +4 TextBox +6 glyphs −2 obsolete).
Final full gates: **1299/1299 in 66 files**, no-ROM **1176/123**, strict typecheck
and build clean (121 modules, 344.33 kB JS); diff check clean. No setup needed;
ROM static-export/source-program checks passed and generated files unchanged.

Three reverted production mutations caught: BCD flag polarity 18 failures,
standalone noDelay forwarding 3, static glyph tokenization 2. SHA-256 confirms
exact restoration; final focused numeric/TextBox/menu-render suite 89/89.
Isolated muted Chrome :5188: opened the real Pokécenter PC, inspected its single
tile contractions; rendered actual PC/YesNo/common glyph and existing battle
action/text functions with main paused. Six screenshots inspected; no page
exceptions or unexpected resource failures. Expected favicon/indoor-wild 404s
recorded in note 39. Scratch artifacts in `%TEMP%/pkmn-a5b7a-browser/`; no
permanent hooks. Storage cleared, Chrome and spare server closed; :5173 untouched.

**Stop for Claude's review, then the user's quick visible check** (note 39's
result; Z=A, X=B). No A5b7b begun. `game/.gitattributes` retained (#53).
Commit locally; nothing pushed.

### 2026-10-14 (A5b7a CP2 — standalone no-text-delay calls) — Codex/Sol

`printStandalone` now forwards its explicit noDelay flag through the existing
PrintText path. Four integration tests pin Delay3, retained BG transfer, numeric
bindings, native prompt/sound waits, actual-read history across repeated calls,
and unchanged default typing used by Oak. Focused TextBox/Oak/display-command
suite **58/58**; strict typecheck clean. No menu caller migrated. **Next: CP3
common glyphs and final gates.** Commit locally; nothing pushed.

### 2026-10-14 (A5b7a CP1 — numeric text operands) — Codex/Sol

Implemented note 39 §4 CP1: runtime number bindings, source BCD flags/currency/
digit delays and untouched skipped cells, immediate TX_NUM, and minimal cursor/
glyph primitives. Extractor/schema/generated files unchanged. Invalid values or
wrong binding kinds fail with their source label instead of coercing strings.
Added 49 numeric cases and removed the two now-obsolete unsupported-op cases.
Focused printer/runner/number suite: **94/94**, strict typecheck clean. Full
baseline remains pending the final gates. **Next: CP2 standalone no-delay calls.**
No later A5b7 slice started. Commit locally; nothing pushed.

### 2026-10-14 (O-23 approved; `game/.gitattributes` tracked) — Claude Opus 5.5

Checked note 39's main claims against the disassembly and the code. They hold:
BCD bit 7 hides leading zeroes, BCD digits have letter delays and HP numbers don't,
the 30+10 save delay and post-save order, Mart's outer wait versus the PCs going
straight to `HoldTextDisplayOpen`, the PCs' and party menu's no-text-delay flags,
`printStandalone`/`drawText`/SELL filter. The user: "yes, please mark everything as
approved". Recorded as DECISIONS #52 (seven slices, Sol implements/Claude reviews,
§6 scope limits, A5b6's gate approved, so A5b6 is done). The user also asked that the
untracked `game/.gitattributes` be part of the repo: committed, DECISIONS #53. Staging
it changed no working-copy file. Docs only; no tests rerun (baseline 1242/1242).
**Next: Sol implements A5b7a** (note 39 §4). Commit locally; nothing pushed.

### 2026-10-14 (A5b7 plan) — Codex

At the user's request, traced remaining menu consumers and the local disassembly
and wrote `notes/39-a5b7-plan.md`. Proposed A5b7a–g with an implementation-ready
three-checkpoint A5b7a. Findings: BCD suppress-zero flag and digit delays versus
instant decimal HP output; PC no-delay scope and Hold-only exits versus Mart's
outer wait; source buy/sell questions; save's 40-frame initial delay, timed
sound/return sequence and Hold/Close instead of redisplaying START. Required
carry-over: note 36 N-3, migrating A6e nurse tests off legacy text before removal.
Recorded explicit storage/Change Box/audio boundaries and the observed Full
Restore branch bug, without changing gameplay or promoting deferred work.

O-23 awaits approval; A5b6 user play-test remains unconfirmed. No implementation
slice claimed, no code/generated-data changes, no tests/build rerun for this
docs-only plan. Baseline verified earlier today remains 1242/1242 and clean
typecheck. Existing untracked `game/.gitattributes` untouched/excluded.
**Next:** user reviews note 39 and confirms A5b6's gate; then claim only the
approved first slice. Commit locally; nothing pushed.

### 2026-10-14 (context and codebase study) — Codex

User connected remotely and requested codebase/context study. Read the root entry
point and current handoff, project/conventions/roadmap/architecture, decisions and
historical context, subsystem architecture docs, and the latest A5b6 review.
Traced static-only startup, main state dispatch, fixed-rate ticking and two-frame
overworld passes, interaction dispatch, text program execution, and the migrated
school/Town Map handlers and shared menu input.

Verified today: `npm run typecheck` clean; `ROM_PATH=pokeyellow.gbc npm test`
**1242/1242 across 64 files**. No browser play-test or build rerun. Study only:
no implementation slice claimed, no engine/generated-data changes. Existing
untracked `game/.gitattributes` left untouched and excluded from this commit.
Some dated summaries still carry older counts; the live baseline and latest
review remain authoritative. **Next: user play-tests A5b6** using note 38's four
checks, then A5b7 planning. No later slice started. Nothing pushed.

### 2026-10-13 (A5b6 review pointers) — Grok 4.7

The review commit (`e40474f`) updated STATUS, the PLAN progress sentence and CLAUDE.md. This commit closes the remaining current pointers: PLAN's A5 row, PROJECT's state bullet, DECISIONS #51 and the CONVENTIONS test-suite bullet. All four now say A5b6 is reviewed (`notes/38-a5b6-review.md`, passed) and waiting on the user play-test. ARCHITECTURE's baseline was already 1242. Older session-log lines that say "next: plan A5b6" are history. No code change. Nothing pushed.

### 2026-10-13 (A5b6 review) — Grok 4.7

Claude was unavailable, so this session is the review the slice stopped for: `notes/38-a5b6-review.md`. **Passed. No required fix.** Re-ran the gates from `2f08803`: typecheck clean, ROM 1242/1242 (64 files), no-ROM 1119/123, build clean (121 modules, 342.82 kB JS, gzip 101.23 kB), `git diff --check` clean. No setup run; no extractor or generated file is in the slice, and the ROM suite's static-export test passed. Did not repeat the :5188 browser smoke.

Traced the notebook (+23, Text5's arrow-less wait, no outer wait, close 13), `HandleMenuInput_` (Delay3, no wrap, no tail), the blackboard (B/RIGHT/LEFT/item, Text2 `noDelay`, close 13), the Town Map double close (glyph +20, white 20, font-loaded 9/11/13 then full reload 14/17/22, Hold, return latch) and Oak's seven programs (glyph +3, cue then 2B, custom +6/+9, Text3 into shrink on the return tick, A-only name menu). YesNoMenu left as A5b5c fixed it. Intro fade/slide/shrink lengths left for #51.

Seven production mutations, each reverted, tree clean after the last. Six were caught (unconditional (18,16) clear; delay 0; wrap; second close without `reload: 'full'`; Text3 never reaching shrink; `cry` dropping 2B). M7, deleting `uiEntry.opened(true)` on the Town Map return, failed nothing (N-1). N-2: wrapping and out-of-bounds stay hardcoded off until a caller needs them.

**Stop for the user play-test** (note 38). No A5b7, healing machine or intro animation started. Nothing pushed.

### 2026-10-13 (A5b6 CP5 - cleanup and final handoff, this commit) - Codex/Sol

Retired legacy yesNo union/handler/state; retained yesNoChoice, text/textButtonWait/closeText. Confirmed CP2/CP3 removed BlackboardMenu/state, pendingTownMap and TextBoxOptions.close. Note 24 inventory, baselines and subsystem docs updated. Implementation result at bottom of note 37, including CP4 3aa238c, all test edits, seven reverted production mutations and browser method/counts.

Final gates: ROM 1242/1242 (64 files), no-ROM 1119/123; typecheck/build/diff check clean; 121 modules, 342.82 kB JS. No generated changes or setup run. Uninterrupted muted isolated :5188 Chrome: notebook three NO exits/full read (+23, menu +3/15, close 13); blackboard all headings/columns/top/QUIT/B (+23, instant question +3, menu +6, close 13); all three house maps with A held/B (+20, white/font 20, closes 9/14, 11/17, 13/22, two trailing updates, no return opening update); both intro naming paths through Red's room (seven programs +3, cue/2B, retained fades/shrink, custom +6/+9, name menu +3, Text3 into shrink same tick, no idle Oak reads). Fourteen flows, zero console errors; canvas snapshots inspected. Scratch tick/audio clock follows GB rate and yields for pending sound loads; no product hooks committed. Storage cleared; Chrome/spare server closed; user :5173/saves untouched.

Stop for chosen reviewer/note 38 and then the user play-test. No next slice begun; never pushed.

### 2026-10-13 (A5b6 CP4 - Oak speech, this commit) - Codex/Sol

Re-derived PrintText and both naming paths from the ASM; custom return is ClearScreen 3 + Delay3 3, then glyph +3. Added TextBox.printStandalone, seven program calls, declared Pikachu cue and complete 2B, retained boxes and BG transfers through fades/slides/menu/shrink, ClearScreen dismissal, A-only MenuInput, and no idle main joypad sync. Animation timings/sounds remain the approved separate slice.

Added 17 sequence tests. ROM 1242/1242 (64 files), no-ROM 1119/123, typecheck/build/diff check clean; 121 modules, 343.17 kB JS. One ASM comparison timed out while the build ran concurrently; the unchanged standalone full suite passed. Seven reverted production mutations caught: missing standalone Delay3 (9), missing cue/2B (2), extra final press (1), custom return +5 (2), watched B (1), idle joypad sync (1), missing retained BG transfers (1). No generated change. Next CP5 cleanup/docs/final muted browser smoke; no push.

### 2026-10-13 (A5b6 stopped after CP3; handoff to Codex) — Claude Opus 5.5

The user asked Claude to stop and hand the rest to OpenAI Codex. CP4 had only begun (an untested
`TextBox.printStandalone`); it was reverted, so the tree is clean at `3689f23`. The handoff is at the bottom of
`notes/37-a5b6-plan.md`: commits, tests, mutations, the CP3 browser probe method, the CP4 design and the CP5 list.
CLAUDE.md, CONVENTIONS and ARCHITECTURE baselines now say 1225/1225 (no-ROM 1102/123); the subsystem docs are
CP5's. The spare Vite server on :5189 was stopped (it hit its background time limit); the user's :5173 and saves
were never touched. **Next: Codex claims A5b6 CP4 (Oak's speech), then CP5.**

### 2026-10-13 (A5b6 CP3 — the Town Map sign) — Claude Opus 5.5

The HOUSE wall map ($3D) dispatches `TOWN_MAP_TEXT` (`getBookshelfScript`) to `buildTownMapSignScript`: direct text
+20, `promptButton` ▼/beep, white-out 3 + font copy 17, the existing Town Map via a `townMap` script action (main
returns into the script and pre-sets the UI-entry edge), `displayCloseInPlace` (font-loaded close, white until its
update), Hold, `displayClose {reload: 'full'}` (`fullReloadCloseFrames`: Blue's House 14, trade house 17, Nickname
House 22; outdoors 5). `pendingTownMap` and `TextBoxOptions.close` are gone. +10 tests (`town_map_sign.test.ts`);
the transitional textbox test is replaced. ROM 1225/1225, no-ROM 1102/123, typecheck/build/diff check clean. Five
mutations caught. Muted headless Chrome on :5189 with a per-tick probe (Date.now wrapper, scratch only): all three
houses, opening 20, white 20, first close 9/11/13, B exit Hold + full close 17, zero console errors. Next: CP4.

### 2026-10-13 (A5b6 CP2 — HandleMenuInput and the blackboard) — Claude Opus 5.5

`menus/menu_input.ts` ports `HandleMenuInput_` (Delay3 then one read a frame, no wrap, unwatched keys re-arm Delay3,
A/B sound, watched keys return with no tail). The blackboard is a hidden-event builder (`story/hidden_events.ts`):
`menuBox`, `printText {noDelay}`, `menuInput` (its `then` splices the next loop), `restoreSavedScreen`; B/QUIT, Hold,
close 13. `BlackboardMenu`, the `blackboard` state and `openBlackboard` are gone. +10 tests (`menu_input.test.ts` 5,
`school.test.ts` +5). ROM 1215/1215, no-ROM 1092/123, typecheck/build/diff check clean. Mutations caught: wrapping
(2), Text2 with delays (3), no initial Delay3 (5), LEFT ignored in its own column (1, after adding the no-heading
assertion that first let it through). Next: CP3, the Town Map sign.

### 2026-10-13 (A5b6 CP1 — the notebook and N-1) — Claude Opus 5.5

The user approved O-22 ("go"; DECISIONS #51) and asked Claude to implement today. CP1: the notebook is one display
(`story/hidden_events.ts`): four PrintTexts, three `TurnPageText` + A5b5c yes/no, Text5's own `text_waitbutton`,
no outer wait, Hold, close 13. N-1: `TextScreen.manual` clears (18,16) only for the arrow form. +10 tests
(`story/school.test.ts` 8, `text_runner.test.ts` 2). ROM 1205/1205, no-ROM 1082/123, typecheck/build/diff check
clean. Mutations caught: an outer wait on the notebook (5 tests), the unconditional clear (1). Next: CP2.

### 2026-10-13 (A5b6 plan) — Claude Opus 5.5

Planning only, Markdown only: `notes/37-a5b6-plan.md`, this file and PLAN.md's A5 line. Read the context files, the
A5b plan (note 23), the A5b5c plan/review, the notebook, blackboard, Town Map sign and Oak's speech ASM, and the
TypeScript they touch. Not run: typecheck, tests, build, setup, browser (the 1195/1195, 1072/123 baseline stands).

Findings beyond note 23: Pikachu's intro text is missing its second half (`_OakSpeechText2B`); the Town Map sign
closes the display twice (`jp CloseTextDisplay` inside the handler, then Hold and a full-reload close: 14/17/22
frames in Blue's House, the Route 2 trade house and the Nickname House); the blackboard wraps where the cartridge
doesn't, and a non-watched key re-arms `HandleMenuInput`'s Delay3; Oak's final `done` text has an invented press;
the intro boxes vanish before fades. No generated-data change needed. **Next:** the user answers O-22; then Sol
claims A5b6.

### 2026-10-12 (wrap-up) — Claude Opus 5.5

End of day. A5b5 is done: A5b5c reviewed (note 36), user-verified (all six points) and its F-1 checked (`ee148fa`).
Context files brought up to date: PLAN.md (A5 row, A5b progress, V2 preceded by the healing-machine slice, V5's
trim candidate now only the padded tileset reads), PROJECT.md, CLAUDE.md, STATUS. Working tree clean; dev server
stopped. **Next session: Claude plans A5b6** (school notebook, Town Map, Oak's speech; start from
`notes/23-a5b-plan.md` and the legacy `text`/`yesNo`/`textButtonWait`/`closeText` callers listed in
`story/ARCHITECTURE.md`); the A5b7 plan must also carry note 36 N-3.

### 2026-10-12 (A5b5c F-1 check) — Claude Opus 5.5

Checked Sol's `7839e37` against note 36 F-1: B gives NO without moving the drawn ▶, test checks all 15 frames, docs
and N-4 fixed. Gates re-run (typecheck, ROM 1195/1195, no-ROM 1072/123, build); my mutation (B moves the cursor
again) fails the B render test; reverted. F-1 closed in note 36. **A5b5 is done.** Next: plan A5b6.

### 2026-10-12 (A5b5c F-1 follow-up, this commit) - Codex/Sol

Re-read HandleMenuInput_ and DisplayTwoOptionMenu: B chooses NO without PlaceMenuCursor. Removed the cursor write; answer remains NO for B and A+B. Corrected the existing render test to check y=64 on each of the 15 visible frames, with no reads and return on tick 15. The corrected test failed on the old production code and passes with the fix. Corrected menus architecture and N-4's ui_entry comment; optional N-2 removals left for later.

Gates: typecheck/build/diff check clean; ROM 1195/1195 (60 files), no-ROM 1072 pass / 123 skip (unchanged baseline); setup twice, no generated changes. Muted isolated :5188 browser, real story/menu/render code stepped deterministically: YES+B, HEAL+B, NO+B and YES+A+B all select NO, preserve identical cursor pixels on every one of 15 frames, and close on tick 15. Zero browser errors. Isolated storage cleared; Chrome/spare Vite closed; user :5173/saves untouched.

Stop for Claude to check this one small local commit against notes/36-a5b5c-review.md. No next slice started; never pushed.

### 2026-10-12 (A5b5c play-test) — the user, recorded by Claude Opus 5.5

The user play-tested A5b5c: "it all went well, all 6 points checked off successfully" — Viridian Forest balls
(BUG-1 gone), Oak's facing and Lab music, Pokécenter first visit / second visit / CANCEL, the caterpillar youngster's
YES and NO. A5b5c is done except F-1 (Sol, one small commit; Claude checks it). Then plan A5b6.

### 2026-10-12 (A5b5c review) — Claude Opus 5.5

Reviewed Sol's five A5b5c commits in `notes/36-a5b5c-review.md`: **passed**, one small fix F-1 (P3) that does not
block the play-test. Re-ran every gate: setup twice (tree clean both times), typecheck, ROM 1195/1195, no-ROM
1072/123, build. Traced CP3 against `HandleMenuInput_`/`DisplayTwoOptionMenu`/`_Joypad` and CP4 line by line against
`pokecenter.asm`. Five production mutations (extractor ×16, 14-frame tail, box up during the bow, flag after
ShallWeHeal, still sprites using their facing rows) were each caught; reverted. F-1: after B the cartridge leaves the ▶
where it was for the 15 frames (no `PlaceMenuCursor`); the TS moves it to NO and a test pins that. Notes: N-1 map music
now restarts after the silent machine (faithful step, plan had put it with the machine slice); N-2 self-mutating tests;
N-3 the A6e fixture needs real sessions when A5b7 retires `text`; N-4 stale comment; N-5 old saves see "Shall we heal"
once. Updated STATUS, CLAUDE.md and PROJECT.md. Next: user play-test, then Sol's F-1 commit, then plan A5b6.

### 2026-10-12 (A5b5c CP5 - cleanup, final smoke and handoff) - Codex/Sol

Removed exclamation's command/state/tick/render fallback and uiEntryUpdates. Kept legacy text/yesNo/textButtonWait/closeText for their A5b6/A5b7/compatibility callers. Retired-command tripwires retain their assertions through string-list membership after removing the union members. A5b1 inventory marks every A5b5 row done. Baselines/subsystem docs updated; cable-club link decision logged. Nurse fixture exception is explicit in CP4 and note 35, with every original A6e assertion retained.

Final ROM 1195/1195 (60 files), no-ROM 1072/123, typecheck/build/diff check clean; 121 modules, 342.07 kB JS. Final uninterrupted muted isolated :5188 browser: first nurse YES, real save/reload and repeat YES, CANCEL, following-Pikachu YES, caterpillar YES/NO, all three Forest balls and Lab speech/ball. Ten checks, 10 displays/24 prints/6 menus, first glyph +23, all first menu reads +3 and answer tails 15, nurse closes 17 (Viridian 23, Lab 15), every successful nurse bow bare for 40 frames. All four balls watched 600 frames; Forest random turns draw row 0 unflipped, Lab watch stays down. Oak down, music oakslab, zero errors. Storage cleared; Chrome/spare server closed, :5173/user saves untouched. All other generated files remain unchanged since the identical CP2 setup runs.

Result appended to notes/35-a5b5c-plan.md. Stop for Claude notes/36-a5b5c-review.md, then user play-test (Z=A, X=B). No A5b6/A5b7 or healing-machine internals started; no push.


### 2026-10-12 (A5b5c CP4 - nurse display session) - Codex/Sol

Nurse dispatch uses the generated pokecenterNurse script registry, not NPC id. New story builder has one display, five source programs, saved USED_POKECENTER after Welcome (including NO), shared covered UpdateSprites, YES-only blackout callback, both LoadCurrentMapView hides and outer wait/17-frame close. Preserved A6e calls/waits and healing-machine internals; migrated machine waits read no input. TextBox tracks actual coverage and defers saved live facing until close, while the drawn image waits for the trailing update. Sixteen real-flow tests cover first/second/NO, alive/fainted starter, 69-frame walk, 40-frame bare bow, pauses, input ownership, dispatch and Pewter tripwire. Census nurse registered, cable-club label corrected.

Fixture exception to note 35 section 6: the old A6e healScript explicitly selected legacy yesNo and used a text-only fake box, so it could not exercise a migrated builder unedited. Adapted only its fixture selection and quick-text conversion; all original movement, facing, healing and timing assertions stay intact. All 67 controller tests pass. ROM 1195/1195, no-ROM 1072/123, typecheck/build/diff check clean. Final browser and CP5 cleanup next.


### 2026-10-12 (A5b5c CP3 - shared menu timing) - Codex/Sol

Re-derived HandleMenuInput Delay3 and DisplayTwoOptionMenu DelayFrames 15: menu at T, first read T+3; any non-A/B key re-arms three frames, choice returns at press+15. Menu owns reads only when polling; cursor stays visible in the tail, B selects/draws second option. Legacy yesNo unchanged. Updated display_commands timing assertions for the source delays; added 12 menu and four real caterpillar/old-man branch traces, including both delay-removal mutations. ROM 1179/1179, no-ROM 1056/123, typecheck/build/diff check clean. Existing small-handler/Viridian builder tests did not pin menu ticks and remain unchanged. Next CP4 nurse.


### 2026-10-12 (A5b5c CP2 - BUG-1 sprite sheets) - Codex/Sol

Shared A5b2 size/class validation now drives PNG extraction: 24 tiles per walker (standing and +$c0 walking half), four per still sprite. Npc.load rejects other heights; still sheets draw row zero unflipped for every facing/walk setting. Regenerated 76 overworld PNGs only; every retained pixel matches the previous sheet, all available pret rows match (including nurse bow/standing-only pictures). Other 793 generated files unchanged; second setup identical across 869. Added three ROM and six renderer tests, including old 64-tile decode and still-sheet misclassification mutations. ROM 1163/1163; no-ROM 1040/123; typecheck/build/diff check clean. Party BALL/HELIX use row 0; all walker frames stay at rows 0-95. Next CP3 menu timing; 600-frame ball browser checks at final smoke.


### 2026-10-12 (A5b5c CP1 - review fixes) - Codex/Sol

Re-read Lab object order, choose speech and map songs. Fixed F-1 to face the rival up, leaving Oak down; F-2 uses a restoreMapMusic command through the existing current-map callback at all four sites. Added two Lab regressions. ROM 1154/1154, no-ROM 1034/120; typecheck/build/diff check clean. Muted isolated :5188 browser completes all four choose displays with Oak down and restored oakslab, zero errors. A concurrently run ROM comparison hit a timeout; unchanged standalone suite passed. Next CP2 BUG-1.


### 2026-10-12 (A5b5c plan) — Claude Opus 5.5

Planning only, Markdown only: `notes/35-a5b5c-plan.md` and this file. Investigated BUG-1: `extractOverworldSprites`
reads `SpriteSheetPointerTable`'s third byte (`tiles × 16`) as a tile count, so walkers are 16×768 and still sprites
16×256; `npc.ts`'s still test (`height < 32`) never fires, and a STAY/NONE ball that turns draws the rows its facing
selects, which in ROM are the fossil (up) and the boulder (left/right). The cartridge draws a still slot with entry 0
always (`PrepareOAMData`). Also found the two-option menu's `Delay3` before reads and its 15-frame tail after the
choice, missing from A5b5a's `yesNoChoice` (my review missed it). Traced the nurse (`pokecenter.asm`) for the display
session: first-visit flag, two `pause`s, box hidden at `LoadCurrentMapView`, outer wait, close 17. Healing machine
left out (needs a music fade-out). The user then answered O-21 (DECISIONS #50): one slice, BUG-1 in the extractor,
the healing machine in its own slice (after A5b7, before V2). **Next:** Sol implements A5b5c; the user tells Claude
when it is done; Claude reviews (note 36); the user play-tests.

### 2026-10-11 (end of session: play-test, BUG-1, wrap-up) — Claude Sonnet 5.5

The user ran the dev server and play-tested A5b5b (fresh game, Pallet to the Pokédex): **"it all passed."** The
build had neither F-1 nor F-2; the user did not mention them, so treat both as still open and still wanted
(they are faithful-to-ASM fixes, not new content). The user also reported **BUG-1** (a Viridian Forest object
shows as ball, fossil or boulder; screenshots saved in their Pictures folder; recorded under Open questions, not
investigated). Markdown only; dev server stopped. **Next session, in order:** (1) Sol lands F-1/F-2 (note 34;
one small commit, tests for both); (2) investigate BUG-1 (ask the user which tile and what they did first,
reproduce, then decide the home); (3) A5b5c: the nurse (D12) and cleanup, note 32 §3.4 and §6 CP5–CP6; then the
user's play-test of a Pokécenter visit; (4) A5b6, A5b7. Carry-overs: A5b4 N-1 (`waitButton` blanks tile (18,16))
in A5b6; V5 bank-aware SFX lookup; the Pokédex rating screen gap.

### 2026-10-11 (A5b5b review) — Claude Sonnet 5.5

Reviewed `0d78633`, `aa4479d`, `389fe5f` against note 32 and the ASM (PalletTown, OaksLab, meetrival). Gates re-run: 1152/1152,
no-ROM 1032/120, typecheck, build, diff check clean. Two own mutations caught (1 and 3 tests). The rival alternate-start adapter
matches `meetrival.asm`. **Passed with two required fixes:** F-1 `labChooseSpeech` turns Oak (`prof_desk`) up where the ASM sprite 1
is the rival; F-2 the Lab's restored music is `pokecenter`, not the map's `oakslab`. Sol fixes both in one small commit, then the user
play-tests Pallet to the Pokédex. Markdown only. **Next:** Sol lands F-1/F-2; user play-test; then A5b5c.

### 2026-10-11 (A5b5b CP4 — Lab and handoff) — Codex/Sol

Re-derived Lab display order, auto-box changes, endings, side effects and rival
alternate-start entries from ASM. Migrated all existing Lab flows and reachable
Oak/rival/ball branches to named programs; removed their dialogue swaps and
bespoke controller branches. Ordinary Lab displays are borderless at opening;
the ball bubble remains borderless. Snatch/gift/parcel stay grouped, gift/jingle
precedes party and flag changes, advice is no longer printed automatically.
Pokédex arrival explicitly enables the automatic border and retains source
delays. Free-movement talks/guard use nested displays; each successive opening
has its own revision and sprite update. Existing A6 geometry, battle renderer,
nurse, printer and close timing remain; the audio facade reuses the committed
alternate entry, with no engine or generated-data change.

Added 30 Lab and 2 music tests (b total +39), five in-memory mutations across b.
All 67 controller tests and existing A6/nurse tests pass unchanged. Final gates:
ROM 1152/1152 in 55 files; no-ROM 1032/120; typecheck/build/diff check clean;
120-module build, 340.64 kB JS. Final uninterrupted muted isolated :5188 browser:
fresh-game initialization, actual house/Pallet walking, Oak catch demo, all four
choose displays, optional Oak/rival talks, guard, ball/snatch/gift, real rival
battle, both Pikachu displays, saved parcel staging, full Pokédex scene, ordinary
scientist. 27 displays/31 prints, +20/+23 first glyphs, every close 23/15, bubbles
61 each, ball total 96, 27 opening sprite updates, zero console errors. Browser
storage cleared, Chrome and spare server closed; :5173 and user saves untouched.
Result appended to note 32. Stop for Claude note 34 review, then user play-test;
do not start c.

### 2026-10-11 (A5b5b CP3 — Pallet displays) — Codex/Sol

Pallet's four calls now use extracted programs: HEY_WAIT's 10-frame delay and
61-frame player bubble stay inside its display, with no outer wait; greeting
and Whew keep the outer wait, ComeWithMe is direct. Existing movement paths and
catch demo remain. Added phase registry and instant map-script prefix dispatch;
callbacks and inside-display player facing return in the same CPU tick, leaving
pre-display/legacy movement waits alone. Seven source/timing/mutation tests
cover +23, bubble +10/61, outdoor close 23, endings, paths and three in-memory
mutations (bubble after close, extra outer wait, missing Delay3). Typecheck/build
and diff check clean; ROM 1120/1120, no-ROM 1000/120 (53 files). Next CP4 Lab;
full new-game browser smoke at the end of b; stop for note 34 review.

### 2026-10-11 (A5b5b first checkpoint — Mom blackout fix) — Codex/Sol

Re-read RedsHouse1FMomHealScript and SetLastBlackoutMap's only call site in
pokecenter.asm. Removed Mom's callback, preserving the nurse-only context port
for A5b5c. Corrected the plan row and test: real Mom healing retains a previously
set Viridian blackout destination and never calls the port. Documented review
N-2 (unmodelled ReloadMapData, no visible effect) and N-3 (Mart entry timing).
Typecheck/build/diff check clean; ROM 1113/1113, no-ROM 993 pass / 120 skip.
Next CP3 Pallet, then CP4 Lab; stop for note 34 review before A5b5c.

### 2026-10-11 (A5b5a review) — Claude Sonnet 5.5

Reviewed Sol's `0df47e8` and `25aa1c2` against note 32. Re-ran gates (1113/1113, no-ROM 993/120, typecheck, build, diff check clean),
traced the nine handlers and the Mart against the ASM, ran two own mutations (gambler mask, envelope outer wait: caught by 1
and 14 tests). **Passed.** Note 33: N-1 (P2, my plan's error, pre-existing) Mom's heal records the blackout map but only
`pokecenter.asm` calls `SetLastBlackoutMap`; fix as the first commit of A5b5b; N-2/N-3 docs. Markdown only.
**Next:** Sol claims A5b5b (Pallet, then the Lab).

### 2026-10-11 (A5b5a CP2 — small handlers and handoff) — Codex/Sol

Registered Mom/TV, Daisy, Route 1 and Viridian's six handler IDs. Added generated
call-kind dispatch and removed their string swaps/sentinels; TV uses its hidden
event coordinates and live facing. Mart now runs its two direct programs,
LEFT/UP/UP and Delay3, gives after the second close, and has no duplicate receipt.
Daisy give/hide/print/flag and Route 1's flag-first full-bag quirk are preserved.
Viridian old-men state/movement paths are retained; display envelopes replace
the text steps. Migrated DelayFrames reads nothing and returns on its final tick;
pre-display/legacy movement waits keep their timing.
The browser exposed that MusicEngine.isPlaying remains true after finite tracks.
Added a read-only audio facade query for CHAN1; Mom now polls the actual channel
return, loading included, restores map music, and heals correctly. A real music
rig test pins the source return at update 136; no audio-engine/interpreter edit.
Final gates: ROM 1113/1113 (52 files), no-ROM 993/120; typecheck/build/diff check
clean. 49 added tests total; three in-memory mutations detected. All existing
A6/nurse timing tests unchanged; only planned Route 1/Viridian builder tests edited.
Muted :5188 browser: all 17 Mom/TV/Daisy/Route 1/Mart/Viridian cases pass;
handler glyph +23, direct Mart +20, closes 9/13/23, real items/heal and both catch
demos finish, zero console errors. Browser response probes only; storage cleared,
Chrome/server closed, :5173 untouched. Docs/result updated. Stop for Claude's
note 33 review; do not begin Pallet/Lab or nurse. User play-test is after b and c.

### 2026-10-11 (A5b5a CP1 — handler foundation) — Codex/Sol

Added the typed map/text-ID registry and DisplayTextID envelope helper; no
handlers registered yet. New message-free yesNoChoice retains the open display,
emotionBubble shares A1c's 61-frame counter and returns through the font-loaded
sprite update, healJingle waits for loading/playback and restores map music.
START close now updates map plus script NPCs (A5b4 N-2); current Pallet/Lab
script NPCs are removed by hideNpc at the end of their scenes, before scripts
finish. Added seven foundation/command tests. Typecheck/build/diff check clean;
ROM 1071/1071, no-ROM 951 pass / 120 skip (51 files). Existing tests unchanged.
Next: CP2 small handlers only; stop for note 33 review before Pallet/Lab.

Newest first. Keep ~8–10 entries; move older ones to `HISTORY.md`.

### 2026-10-11 (A5b5 plan) — Claude Sonnet 5.5

The user play-tested A5b4: "it all works perfect" (recorded above). Then planning only, Markdown only:
`notes/32-a5b5-plan.md` and this file. Traced the ASM for Pallet's Oak scene, all of Oak's Lab, Mom and the TV,
Daisy, Route 1, the Mart, Viridian's talkers and old men, and the nurse, against the current TypeScript. Not
run: typecheck, tests, build, setup, a browser (the 1064/1064, 944/120 baseline stands).

Findings: the engine pre-swaps dialogue strings and uses sentinels where the cartridge's `text_asm` handlers
decide at talk time, so the plan adds a handler registry on A5b4's session. Twelve departures (§5), among them
a text that is not on the cartridge (Oak's "advice" right after the Pikachu gift), a missing healing jingle at
Mom, a reversed Mart walk, hand-typed Daisy/nurse/caterpillar strings, and the Lab's automatic text box (only
Oak's Lab disables it). Proposal: A5b5a (foundation + small handlers), A5b5b (Pallet + Lab), A5b5c (nurse +
cleanup). **Next:** Sol claims A5b5a. *(Approved the same day: "go" to O-20, DECISIONS #49.)*

### 2026-10-11 (A5b4 independent review passed) — Claude Sonnet 5.5

Reviewed Sol's four checkpoints against note 30: `notes/31-a5b4-review.md`. **A5b4 signed off, no blocking
findings.** Re-ran typecheck, **1064/1064** with ROM, **944 pass / 120 skip** without, build, and setup twice
(clean tree both times). Re-read the close routines (`CopyVideoData`, `InitMapSprites`, the player reload):
`5 + 2W` stands. Traced `TextBox`'s close tick by tick (trailing update on `H + 5 + 2W`, BG phase on the first
frame only, `cover` kept to the end). My mutation (`closeFrames` +1) failed 5 tests and was restored.
Not repeated: Sol's muted browser run. Non-blocking: N-1 `waitButton` blanks (18,16) (latent, A5b6); N-2 the
trailing update's NPC list differs from a pass's (A5b5); N-3 ARCHITECTURE's stale baseline (fixed).
The user's play-test is not claimed. Markdown only. **Next: plan A5b5.**

### 2026-10-11 (A5b4 CP4 — pickups and call kinds) — Codex/Sol

Ball/hidden-item scripts now use displayOpen/printText/displayClose and extracted
programs with named RAM bindings. Main enters pickup opening on the interaction
tick; legacy story dispatch is unchanged. Balls give/hide at T+20, first write
T+23; hidden found text starts T+20. Full-bag, flag/save/collision and jingle
regressions remain covered. NPC/sign calls use generated text IDs; custom
handlers remain direct and Lab/Mart alternates follow ASM flags. Town Map's
existing ending and Route 1's sample remain unchanged.
Added eight pickup/controller and two map-table tests; ROM 1064/1064 across
49 files; no-ROM 944 pass / 120 skip; typecheck/build clean. Muted :5188 Chrome
smoke repeats Pallet 23 / Nickname House 13 close and next pass +2, retained
coverage, START 23 with zero input syncs; Forest ball hide +20 / glyph +23 /
close 11, City hidden Potion glyph +20 / close 23, both add one Potion; Forest
trainer talk and sight glyph +23 / close 11, both reach battle. Zero console
errors. Probes only in intercepted browser responses; isolated storage cleared.
Required docs and full implementation result updated; Claude reviews next in
note 31. Four local checkpoint commits, no push, no A5b5 work.

### 2026-10-11 (A5b4 CP3 — session and exact close) — Codex/Sol

TextBox now owns retained opening/printing/wait/Hold/close phases and a shared
CloseSequence. Loaded text programs/sprite sets at startup, promoted A5b2's
selection/allocation helpers, wired map dialogue, START exit and closeText.
All current map costs use cartridge pictures; one final UpdateSprites after
the frozen reload. Closing keeps UI coverage and transfers BG on its first
frame only. Sound waits no longer synchronize Joypad; story builders remain
unchanged and the Town Map sign retains its old no-reload handoff.
Added 15 session/counter tests (including three in-memory cost/coverage/keep
mutations). Existing test edits add the source reload cost and final sprite
update, and remove the sound-wait read expectation. Typecheck/build clean;
ROM 1054/1054; no-ROM 934 pass / 120 skip.
Muted headless Chrome at :5188: Pallet close 23 frames, Nickname House 13,
next pass +2 in both, coverage retained; START close 23, zero main input-sync
reads during copies, no console errors. Browser-only response probes; no
debug hooks written to source. CP4 still owes pickup opening/handler ordering,
call-kind propagation, final smoke and the implementation result in note 30.

### 2026-10-11 (A5b4 CP2 — pure runner) — Codex/Sol

Split the existing printer into shared TextScreen and the unchanged one-string
wrapper; added the pure TextProgramRunner with current-level FAR returns,
shared cursor/Joypad history, named RAM bindings, no-delay mode, sound waits
without input reads and declared cry cues. Numeric/unused ops fail with label
and A5b7 home. Added 21 source-contract/census/equivalence tests. All 42 existing
printer/TextBox/BG tests passed unchanged. Actual extracted census is 11 kinds
(the plan's prose says 12 but lists those same 11).
Typecheck/build clean; ROM 1039/1039; no-ROM 919 pass / 120 skip.
No loader/main wiring yet. Next: CP3 display session and exact close.

### 2026-10-11 (A5b4 CP1 — data) — Codex/Sol

Added ROM-backed NPC/sign textId and mapObjects in cartridge order (including
filtered/hidden/duplicate pictures). All emitted sprite sets now compare with
source; a real in-memory set-3 mutation is caught. Three new ROM tests cover
object pictures, all current NPC/sign IDs and the middle-set guard.
Typecheck/build clean; ROM 1018/1018; no-ROM 898 pass / 120 skip.
Setup repeated with all 869 hashes identical; generated diff has only additions,
38 files changed / 831 unchanged. Plan's 40-file estimate counted Red's House 2F,
which has no ROM objects/signs and correctly has no map-file change. No runtime
wiring in this checkpoint. Next: CP2 pure runner; A5b5 remains out of scope.

### 2026-10-11 (A5b4 plan) — Claude Sonnet 5.5

Planning only, Markdown only: `notes/30-a5b4-plan.md` and this file. Read the cartridge's
`DisplayTextID`, `PrintText`, `TextCommandProcessor`, `CloseTextDisplay`, `CloseStartMenu`, `PickUpItem`,
`HiddenItems` and `HideObject`, and the text, script, overworld and `main.ts` code they touch. Not run:
typecheck, tests, build, setup or a browser (the recorded 1015/1015, 898/117 baseline stands).

Findings the earlier plans lacked: (a) `PickUpItem` runs inside `DisplayTextID` after the 20-frame
`DisplayTextIDInit`, so a ball disappears 20 frames after its box opens (A1b hid it with the box);
(b) map JSON NPCs and signs carry no `textId`, so the `text`/`printText` call kind cannot be told apart
(the extractor reads the id and drops it); (c) only ten op kinds need implementing now, since `bcd` and
`decimal` first appear in the shop and item menus (A5b7); (d) START's exit also costs the `5 + 2W` close.
Proposal: four checkpoints (CP1 data: 40 additive file changes; CP2 pure runner; CP3 session + exact
close + START/MapDialogue; CP4 pickups + call kinds), the A5b2 N-1 test hygiene folded into CP1.
**Next:** Sol claims A5b4. *(Approved the same day: the user answered "go" to O-19, DECISIONS #48.)*

### 2026-10-11 (A5b3 independent review passed) — Claude Sonnet 5.5

Reviewed Sol's `ad423e1`, `d90aaad`, `2e3c653` against note 28: `notes/29-a5b3-review.md`.
**A5b3 signed off, no blocking findings.** Source diff is exactly the plan (four headers,
`extractSfxAt`, preload names; decoder, engines and synthesizer untouched; no call sites).
Re-ran typecheck, **1015/1015** with ROM, **898 pass / 117 skip** without; setup twice left
`git status` clean (173 JSON per tree). My own mutation (turn_on_pc frequency +1) failed 4
tests and was restored. Not repeated: the build and Sol's :5187 browser smoke. Non-blocking:
N-1 the A1a parser moved to file scope; N-2 the bank guard relies on all 16 header addresses
being shared by banks $02/$1f, so an SFX that exists only in bank $02 needs the guard extended.
Markdown-only session. **Next: plan A5b4.**

### 2026-10-11 (A5b3 checkpoint 2 — playback and verification, `d90aaad`) — Codex/Sol

Added 10 interpreter tests for key-item pitch/note starts, PC traces, actual
sound waits and Forest music hand-off. Final gates: typecheck/build clean,
**1015/1015** with ROM, **898 pass / 117 skip** without ROM. Setup twice and
all-file hashes passed in checkpoint 1 (`ad423e1`), with no later asset edits.
Three scratch-only, in-memory mutations failed the source-derived trace
assertions: PC frequency +1, PC length -1 and removed key-item perfect pitch.

Headless Chrome on isolated `http://127.0.0.1:5187/`: splash clicked, all four
new SFX preloaded with HTTP 200, each started/ended (2025/1180/297/367 ms),
zero console errors or runtime exceptions. No game save existed there; storage
cleared, browser and temporary Vite server stopped. User's :5173 untouched.
Bank-aware lookup and all call-site wiring remain deferred. **Next: Claude
Opus reviews A5b3** in note 29; do not start A5b4. Full result follows in note 28.

### 2026-10-11 (A5b3 checkpoint 1 — extraction) — Codex/Sol

Added the four bank-$02 SFX headers, the explicit-header extraction entry point
and preload registry entries. Reused/extended the ASM fixture parser for
square_note and added 17 ROM tests: headers, JSON, commands, kind, all-header
bank comparison and source-derived return updates for the three differing sounds.
Independently derived note starts/registers from pret's SFX macros and notes.asm;
all matched note 28. No decoder or audio-engine changes.

Typecheck clean; ROM suite **1005/1005**. Setup ran twice: exactly eight new
JSON files, **all 861 existing generated files unchanged**, and the second run
left all **869** files byte-identical. Checkpoint 2 still owes the no-ROM rig
tests, final gates, browser smoke and implementation result in note 28.

### 2026-10-11 (A5b3 plan approved; STATUS restored) — Claude Sonnet 5.5

Planning and docs only; no code, data or generated file changed. The user asked for a plan
for the next slice (Sol implements, Claude reviews), then answered **go** to both
recommendations (O-18, DECISIONS #47).

- **Plan:** `notes/28-a5b3-plan.md` (commit `e8ef047`). A5b3 adds the key-item jingle and the
  three PC sounds. All four decode correctly with today's decoder (dry run in a scratch copy
  against the owner's ROM), and the A1a rig reproduces the hand-derived note starts,
  registers and `sound_ret` updates (121 / 70 / 18 / 22). Expected diff: 8 new files
  (169 → 173 JSON per tree, 861 → 869 generated files), ~27 tests, two checkpoints.
- **Finding:** the cartridge plays an SFX from the bank of the current map's music. Banks
  `$02` and `$1f` differ for `turn_on_pc`, `enter_pc` and the already-extracted `save`
  (`sound_ret` 70/81, 22/18, 40/37); `get_key_item` and `turn_off_pc` are identical. All A5b
  PCs are bank `$02`; Silph Co. 11F is the first that is not. Deferred with homes: V5 (a
  bank-aware lookup), A5b7 (`save` timing in Oak's Lab / the Forest), G1. Pinned by a
  guard test inside A5b3.
- **STATUS.md restored at the user's request.** It had uncommitted changes that were not
  Claude's (a Markdown reformat of the whole file, and edits to the 2026-10-11 study entry
  below). They were backed up to the session scratchpad and discarded with
  `git checkout -- context/STATUS.md`; the committed study entry is unchanged. If a Markdown
  formatter runs on save in the editor, it will reformat this file again: turn it off for
  `context/*.md`.

**Next: Sol claims A5b3** from `notes/28-a5b3-plan.md` and implements it in two checkpoints;
Claude then reviews (`notes/29-a5b3-review.md`). A5b4 stays future work.

### 2026-10-11 (context and codebase study) — Codex

User requested reading and studying the context files and codebase. Read the
entry point, live handoff, project/conventions/roadmap/architecture, decision
entries and subsystem architecture docs; skimmed archived history and studied
the A5b plan and latest sprite-set review. Traced main initialization/state
dispatch, simulation and background ticking, overworld controller, script
runner, save schema, extraction setup and sprite-set schema.

Study only: no implementation slice claimed, no engine/generated-data edits,
and no tests/build rerun. The recorded baseline remains 988/988 with ROM,
888 pass / 100 skip without ROM. Older PROJECT/ARCHITECTURE/PLAN summaries
lag the live handoff; STATUS and the latest review remain authoritative.
**Next: A5b3**, required audio extraction, unassigned; runtime text programs
and sprite-set selection/close execution remain A5b4.

### 2026-10-09 (A5b2 independent review passed) — Codex/Sol

Reviewed Grok's `156d02c` against note 26, pret ASM and the owner ROM.
**A5b2 signed off** (`notes/27-a5b2-review.md`). An independent full-data audit
matched all 37 outdoor selectors, 12 splits, 110 set entries, 82 picture
classes, 75 sprite names, 19 map ids and their allocation/close fixtures.
Extractor guards and dual registration checked; production bundle has no
runtime reference to the new JSON. In-memory invalid-ROM mutations rejected.

Typecheck and build clean; ROM suite **988/988**; no-ROM **888 pass / 100 skip**.
Setup twice preserved all 859 prior generated files and produced identical
861-file manifests. N-1 (P3, nonblocking): the source fixture compares only
emitted sets 1 and 10; an isolated altered set 3 plus matching generated mirrors
still passed 988/988. Actual committed set 3 was independently source-matched.
No code/data changes and no browser play-test (data only). **Next: A5b3**, unassigned.

### 2026-10-09 (A5b2 map sprite sets, awaiting review) — Grok 4.7

Implemented A5b2 only. `extractMapSpriteSets` reads the confirmed bank-$05
operands, checks their domains, and writes `map_sprite_sets.json`. Both pipeline
entry points register it. `SPRITE_NAMES` and `EXTRACTABLE_MAPS` are now exported;
their contents are unchanged. Selection and allocation stay in the tests.

The file has 37 outdoor selectors, 12 splits including the unused `$f8` row,
sets 1–10, pictures 1–82 (12 or 4 tiles), Route 20's branch (X cuts 43/55/62,
Y cuts 13 then 8, west set 1, east set 10), the 19 current map ids and the
canonical sprite names. No offsets or graphics. Nothing loads it at runtime.

`map_sprite_sets.test.ts` has 17 tests (7 need `ROM_PATH` and throw if
`refs/pokeyellow` is missing). `static_export.test.ts` asserts the new key is in
`extractRom`, `data/` and `static/`. ROM mutations stay in memory.

Typecheck clean. **988/988** with ROM. No-ROM **888 pass / 100 skip**. Build
clean. Setup twice: the 859 existing files kept their hashes; only
`data/map_sprite_sets.json` and `static/map_sprite_sets.json` were added (861
files, 10573 bytes, the two copies identical).

No schema departure. The test's map-name helper splits a digit from the next
word (`Route2TradeHouse` → `ROUTE_2_TRADE_HOUSE`) and leaves `1F`/`2F` attached.

**Next:** Codex reviews against note 26. Do not start A5b3 or A5b4.

### 2026-10-09 (A5b2 detailed plan and Grok handoff) — Codex/Sol

Planning only: `notes/26-a5b2-plan.md`. The user assigned Grok to implement the
next slice and Codex to review afterward; recorded that A5b2-specific change in
DECISIONS #46 and the active handoff. No implementation started.

Read the approved A5b plan, extraction/pipeline code and map-sprite/copy/close
ASM. Read-only probes verified the owner's ROM SHA1, all 37/48/110 outdoor table
bytes against source, all 82 picture size bytes, actual referring instruction
operands, and all 19 current maps' object-picture lists/W fixtures. The plan
specifies strict data/schema, Route 20's exceptional split, byte-length decoding,
canonical ID bindings, hidden/deduplicated indoor pictures and capacities,
independent fixture/mutation checks, dual registration and exact unchanged-file
manifests (859 existing files → 861). No code/data/assets changed; no suite/build
re-run in this documentation session. The recorded 970/970 and 878/92 baseline
remains A5b1's verified result.

**Next:** Grok claims and implements A5b2 from note 26, verifies and commits it
locally, then stops awaiting Codex review. Runtime wiring remains A5b4.

### 2026-10-07 (docs after A5b1 sign-off) — Claude Opus 5.5

Docs only, at the user's request ("we will do A5b2 later"). CLAUDE.md, PROJECT.md and
note 24 now say A5b1 is signed off at 970/970. The 39 session entries older than
2026-10-06's A1c verification moved to `HISTORY.md`. A5b2 was not started: only the ASM
was read (`engine/overworld/map_sprites.asm`). No code or data changed. **Next: A5b2**
(map sprite-set extraction, Claude implements, Sol reviews).

### 2026-10-07 (A5b1 correction re-review passed) — Codex/Sol

Re-reviewed Claude's `8152bbd` against all findings in `notes/25-a5b1-review.md`.
**R-1, N-1 and N-2 closed; no new findings. A5b1 signed off.** Eight medicine
roots/children and the hpDifference binding match the ASM/symbols; the new
coverage fixture requires the supported source pointer-table entries, and the
inventory, cry comment and counts are corrected. Updated the review note.

Independently ran typecheck, **970/970** ROM tests, no-ROM **878/92**, build;
setup twice preserved all **859** file paths/hashes from committed outputs.
All **560** catalog/table symbol addresses match pret. All original **523**
programs and map-text calls remain unchanged; only the required 16 records were
added. No runtime wiring/medicine change or browser smoke in this data-only fix.
Documentation-only re-review committed locally; nothing pushed.
**Next: A5b2**, map sprite-set extraction, Claude implements and Sol reviews.

### 2026-10-07 (A5b1 review fix) — Claude Opus 5.5

Fixed Sol's `notes/25-a5b1-review.md`, data only:
- **R-1:** added the eight medicine results of `PartyMenuItemUseMessagePointers` (Potion,
  Antidote, Parlyz/Burn/Ice Heal, Awakening, Full Heal, Revive) with their FAR children,
  and `wHPBarHPDifference` as the `hpDifference` binding (539 programs). A new test reads
  the pointer table from the ASM and requires each entry except RareCandyText (no caller
  yet). Another test pins Potion's operands. Dropping `ReviveText` fails 2 tests.
- **N-1:** the cry op's comment says PlayCry waits for the cry.
- **N-2:** note 24's JSON counts are 167 → 168 → 169.
- Note 24's inventory gains the item menu's medicine literals.

Medicine mechanics unchanged. Setup twice identical (859 files). Typecheck clean;
**970/970**; no-ROM 878 pass, 92 skip; build clean. **Next:** Sol re-reviews; then A5b2.

### 2026-10-07 (A5b1 independent review) — Codex/Sol

Reviewed Claude's `6e79276` against parent `193b641`, approved plan #45 and
pokeyellow ASM/symbols. Review: **`notes/25-a5b1-review.md`**, one P2 correction
R-1 before sign-off: catalog/inventory omit Potion, Revive and six status-cure
success programs already needed by the current field-item menu; Potion also
needs `wHPBarHPDifference` as a named numeric binding. In-memory catalog probe
reproduced the missing `$cefd` binding. Tests cover only listed programs, so
need an independent completeness fixture for the supported medicine results.
No current runtime regression found; new program data is not wired yet.

N-1: cry comment says "no wait", but PlayCry calls WaitForSoundToFinish (actual
cry playback/wait stays J2). N-2: note 24's JSON counts are one high; actual
current count is 168, then 169 with sprite sets. Implementation left untouched.

Independently ran typecheck, **969/969** ROM tests, no-ROM **878/91**, build.
Setup twice reproduced all **859** file paths/hashes from committed outputs.
Checked all **544** program/table symbol addresses against pret: no mismatch;
all **103** old getter values against the parent: identical, with 31 raw prompt
endings retained. Temporary unknown-command, FAR-cycle and unbound-RAM probes
all rejected correctly. No browser smoke (no new runtime wiring; getter
compatibility directly checked). Temporary probes removed, ROM/refs unchanged.

Documentation-only review committed locally; nothing pushed. **Next:** Claude
fixes R-1 and preferably N-1/N-2, Sol re-reviews, then A5b2. Do not mark all of
A5b done: A5b2–A5b7 remain future increments.

### 2026-10-06/07 (A5b approved; A5b1 text extraction) — Claude Opus 5.5

The user approved the A5b plan's four recommendations; recorded as DECISIONS #45 (`193b641`).
Then A5b1, data only (`notes/24-a5b1-text-data.md`):
- `text_programs.json` has two parts. `programs` holds 523 TextCommandProcessor programs by pret
  label: FAR children by name, RAM operands as named bindings, sounds, and the native
  `<DONE>`/`<PROMPT>` endings. `textPointers` holds the DisplayTextID call (script / text /
  printText / handler) for all 120 entries of the 21 TextPointers tables, ViridianMart's and
  OaksLab's second tables included. It keeps the forest leaving-sign bug.
- `game_text.json` keeps 31 trailing `<PROMPT>`s; `getText()` strips them until callers move.
- A consumer inventory maps every `getText` key and TypeScript-literal message to its program
  and increment, and lists the split keys as aliases.
- Departures from the plan's wording are listed in the note for Sol: strings are inline in
  programs instead of canonical game_text keys; the call table is in the same JSON; ten menu
  texts were added after the first audit.

Setup twice byte-identical. Typecheck clean; **969/969**; no-ROM 878 pass, 91 skip; build
clean. Mutation-checked: a key-item sound and the wrapper walker each fail 3 tests. No browser
test: the runtime path is unchanged apart from `getText()`'s strip, which the baseline-hash
test pins. **Next:** A5b2 (sprite sets); Sol reviews A5b1 when convenient.

### 2026-10-06 (A5b plan) — Codex/Sol

User requested reading the newly updated context and planning A5b. Read the
A5a review/user-verification updates and relevant context/subsystem contracts;
audited current extractors, text/script/menu callers and their pokeyellow ASM.
Wrote `notes/23-a5b-plan.md`; **planning only**, no engine/generated-data edits
and no test/build reruns. Baseline remains reviewed **963/963**, no-ROM 878/85.

Key findings: text command programs need @/done/prompt and FAR return distinctions;
PrintText returns inside a retained display; some questions must enter menus
immediately. Pallet's first bubble and the lab's snatching calls share their
source display sessions. CloseTextDisplay costs **5 + 2W** frames for current
walking maps (23 outdoors), including window hide and player reload, then a
trailing UpdateSprites with no extra invented frame. W includes hidden/live
picture IDs and the Pikachu sheet. The speech has an unsupported cry dependency,
explicitly proposed to remain J2. Save has source delays and sound followed by
automatic return, rather than the current extra A/B acknowledgement.

Proposed **A5b1–A5b7**, keeping text, sprite and required audio extraction separate
from engine wiring; new text-program/sprite-set contracts are proposals needing
approval, not changes to existing schemas. Updated PLAN/PROJECT and linked the
follow-up from note 21; removed stale A5a-awaiting-review statements there.
Open choices recorded as **O-17**, existing #44 unchanged. Documentation links
and whitespace checked; plan committed locally with this handoff, nothing pushed.
**Next:** user approves §8; record acceptance, then implement A5b1 only. Do not
start A5c or expand cry/PC/new mechanics scope implicitly.

### 2026-10-06 (A5a user-verified → done) — Claude Opus 5.5

The user play-tested A5a in the browser: "it all runs well". A5a is marked done in STATUS, PLAN,
PROJECT, CLAUDE.md and the plan note. No code changes. **Next:** plan A5b.

_Earlier session entries are archived in `HISTORY.md`._
### 2026-10-06 (A5a reviewed) — Claude Opus 5.5

Reviewed Sol's A5a (`7897e8e`…`4565e67`): `notes/22-a5a-review.md`. Re-ran typecheck, 963/963, no-ROM 878/85, and the build. Checked the printer, the openings and endings, and the BG transfer against the ASM. No blocking findings; two notes with homes (V5, A5b). **Next:** the user's play-test (plan §7).

### 2026-10-06 (A5a implementation) — Codex/Sol

The user accepted all nine A5 decisions and assigned Sol implementation (DECISIONS #44).
Baseline independently verified: 910/910 with ROM; typecheck clean; started from `f8907b5`.

Checkpoint 1: generator-based PlaceString, place-then-delay letters, printer-owned joypad
reads, protected prompts, sound wait, 5+5 cont scrolling, 20-frame paragraphs, contractions
and extra-font glyphs. TextBox legacy callers share the core; bottom-third visibility persists
between boxes and advances during retained script waits. Removed script text's unconditional
joypad synchronization. Existing prompt tests now drive held buttons at actual reads and
wait for display transfer; the protected wait accepts at +3 (no extra dispatch frame).
The 73/181-update jingle regressions are unchanged and pass. Added 27 printer/transfer tests.
**937/937** with ROM, typecheck clean. Next: checkpoint 2, the map-text decoder and data.

Checkpoint 2 (`7897e8e` is checkpoint 1): one strict decoder, row-aware newline tokens,
preserved prompt endings and missing glyphs. The shared decoder explicitly consumes a
leading TX_START command; unknown string bytes throw with their ROM address.
Generated diff: eight strings gain `<PROMPT>` across Route1, ViridianCity,
ViridianPokecenter and the Forest, mirrored in static/. No other data or image changes.
`game_text.json` retains its pre-A5a SHA256; all 857 generated files are byte-identical
across two setup runs. Eleven decoder/data regressions include all extracted map texts
against pret's text macros, eighteen-glyph widths and unchanged game_text output.
The old Forest header assertion now retains its ASM prompt. Battle page helpers strip
the new tokens until A5c. **948/948** with ROM, typecheck clean.
Next: checkpoint 3, DisplayTextID modes and map/trainer callers.

Checkpoint 3 (`9cebc1e` is checkpoint 2): main.ts uses the tested MapDialogue wrapper
for NPC, sign, bookshelf and hidden-event texts, plus the trainer's nested PrintText.
Meet music runs once at text completion, before the silent wait; sight starts none here.
The box appears at render +3 (scanout +4), first letter at +20 (+23 for trainers), and
closing waits for a new A/B and A release plus the window's DelayFrame.
Main and script paths no longer synchronize the joypad over printer-owned reads.
Retained script text advances the BG transfer once per frame across recursive commands.
Fifteen mode/render/trainer regressions pass; full suite **963/963**, typecheck clean.
Checkpoint 3 committed as `94625a0`.

Checkpoint 4: browser smoke passed on isolated :5183 (hooks outside the repository):
sign paragraph/scroll/silent-end/A-release, NPC contraction/B close, trainer talk music
before fresh-A/release/battle, sight youngster2's "!"/three-step approach/cont/battle,
item-ball automatic close, Route1 sample and old-man script text/push. Screenshots
inspected; no runtime errors. Temporary server stopped; :5183 storage cleared;
the user's :5173 save/server untouched. Docs updated with the printer/data contracts,
test baseline, six-slice order and accepted deferred work. Final verification:
**963/963** with ROM, **878 pass / 85 skip** without, typecheck/build clean,
`git diff --check` clean. All 857 generated files were checked for setup idempotence
at checkpoint 2; no later extractor edits.

**Next: Claude reviews A5a against `notes/21-a5-plan.md` and the ASM, then the user
play-tests §7 (A = Z, B = X). A5a is implemented, not yet marked completed.**
Review should cover actual Joypad reads, prior-write VBlank ordering, the two prompt
waits, trainer completion/music and recursive script display transfer. Limits are
the approved 30/30 blink, approximate phase until menu/battle integration, and
CloseTextDisplay sprite reload / trailing UpdateSprites in A5b. Do not start A5b here.

### 2026-10-06 (A5 plan) — Claude Opus 5.5

Planning only, no code. I read the ASM's text engine:
- `PlaceString` and the control characters;
- `PrintLetterDelay`, `ManualTextScroll`, `WaitForTextScrollButtonPress` and the ▼ blink;
- `ScrollTextUpOneLine`, `Paragraph`, `PromptText`;
- `DisplayTextID`, `DisplayTextIDInit`, `CloseTextDisplay`, the auto BG transfer.

I also read our text box and extractors, scanned all 2,565 pret text blocks, and probed the
battle transitions, intros and texts for sizing. The plan is `notes/21-a5-plan.md`: A5 splits
into A5a–A5f, and A5a is planned in full.

Facts new since the earlier notes:
- **Map texts open slowly:** the box appears 4 frames after A, and the first letter about 20
  frames after A (the font loads first).
- **Letters show every third frame.** The bottom-third transfer makes them arrive in threes
  with A held.
- **Contractions are single tiles.** We draw two, in 71 of 196 texts.
- **The blink is CPU-bound:** about 30–50 frames a phase, so 30 is the default.
- **The newline rule (`
`) is wrong only once** outside battle: Route 22's rival.
- **Closing a text costs** sprite-reload frames plus a trailing `UpdateSprites` → A5b.

**Next:** the user answers O-16; record DECISIONS #44; the implementer starts A5a at checkpoint 1.

### 2026-10-06 (A1c user-verified → A1 done) — Claude Opus 5.5

The user play-tested A1c (plan §7): "i checked and it all works well". A1c and milestone A1 are
marked done in STATUS, PLAN, PROJECT, CLAUDE.md and the plan note. No code changes.
**Next:** A5 (battle and text presentation). Plan it first.

## Prior work — code lost (discovered 2026-09-22)

The sessions below (2026-07-27 → 2026-08-04) built this list on a modified copy
of the engine. **That copy no longer exists anywhere** (DECISIONS #26); on
2026-09-22 `game/` was re-created from vanilla upstream. The knowledge survives
in the context files; the code is rebuilt in the slice named in the last column.

| Old ID | What it delivered | Rebuilt in |
|---|---|---|
| P1 | Environment + typecheck | setup 2026-09-22 ✅ |
| P-ROM | ROM verified; setup → 156 JSON | setup 2026-09-22 ✅ |
| P2-1/P2-2 | ASM generators `scripts/gen/` parked (DECISIONS #15) | not rebuilt — only needed for romhack-style edits |
| P2-3 | PSYCHIC chart asymmetric (DECISIONS #10) | **V5** (bug re-confirmed 2026-09-22) |
| P4-1 | PNG dumper → `static/gfx/**` (~518 PNGs) | ✅ R1a (exactly 518) |
| P4-2 | Title `.tilemap` binaries (3 files) | ✅ R1a |
| P4-3 | Asset spot check 52/52 + user play | ✅ R1a (PNGs viewed, pret cross-check) + R1b (user played) |
| P5-1 | `publicDir: 'static'`, mirror data (DECISIONS #16) | ✅ R1a + R1b |
| P5-2 | ROM gate deleted | ✅ R1b |
| P5-3 | Full path smoke + map graph (`scripts/smoke_p5_3.mjs`) | rebuild only if needed |
| Polish | Audio clock; walk FPS max 60; title PKMN; base `/` (#17) | ✅ R1b (title, base); ✅ 2026-09-25 (FPS: the Game Boy rate, DECISIONS #33) |
| Polish | Overworld sprite extract size fix | found in R1a (sheets are 16×768, harmless) — trim is a **V5** candidate |
| Save | Harden + verify on 127.0.0.1 | ✅ save → reload → CONTINUE re-tested from a fresh clone in R1c (upstream save code; the old copy's "harden" changes are unknown) |
| P7 | Final verification baseline | — |
| Stretch v1 | Battle move anims (category-based) | upstream has its own approximation (`battle_ui.ts:326`); revisit later |
| SFX | `SFX_HEADERS` expanded — 49 SFX (was ~10) | **V5** |
| SFX-wire | `playSFX` at faint / level_up / heal / ball / save / shop / ledge / items | **V5** |
| Maps-v1 | Demo gate off; Route 2 + Forest + Pewter (24 maps) | **V1, V2** |
| Maps-v2 | Gym + Museum + Diglett's Cave + Route 3 (30 maps); Brock → BADGE_1 | **V3, V4** |
| — | `scripts/_extract_maps_only.ts` helper | rebuild only if needed |

## Archived session entries

### 2026-10-06 (A1c implemented) — Claude Opus 5.5

The user asked Claude to implement the approved plan (`notes/20-a1c-plan.md`, DECISIONS #43).

- **`58dafde` (checkpoint 1):**
  - `readTrainerHeader` extracts `sightRange`. The regenerated diff is 10 lines: 5 each in
    `data/` and `static/`.
  - `overworld/trainer_sight.ts` is pure.
- **`b20c237` (checkpoints 2–3, built together):**
  - `map_trainers.ts`: the script trio on `w<Map>CurScript`.
  - `emotion_bubble.ts` and the `emotion_bubble` state replace `trainer_approach`.
  - `input/joy_ignore.ts` is `wJoyIgnore`.
  - The seen gates.
  - The walk-up keeps the trainer's movement status.
  - `EnterMap`'s `UpdateSprites` after battles.
  - Removed: the step-end sight loop and Npc's approach code.
  - The pop-in quirk, the `$fc` quirk and the plan's timeline (text at T+133, or T+131 when
    the trainer is ready) all came out of the port, and the tests pin them. Two mutations
    were caught: the latch, and the status rule.
- **Smoke test** on port 5179, with a crafted save, cleared afterwards:
  - the hidden Potion taken from (1,17), unseen;
  - stepping onto (1,18): youngster4's text right away;
  - the battle won, and the player moves again;
  - from (26,32), step down: "!" over youngster2, a 3-step walk-up, its text.
- **Docs:** the overworld and battle ARCHITECTURE files, `context/ARCHITECTURE.md`,
  CONVENTIONS (baseline, the test suite, the map-workflow line), PLAN, PROJECT, CLAUDE.md.

**910/910**; no-ROM 828 pass, 82 skip; typecheck/build clean.
**Next:** the user's play-test (plan §7; A = Z). After that, A1 is done; then A5, V2.

### 2026-10-06 (A1c plan) — Claude Opus 5.5

Planning only, no code. I read the ASM's trainer engine (`home/trainers.asm`,
`engine/overworld/trainer_sight.asm`, `emotion_bubbles.asm`, `MoveSprite_`, `_Joypad`, the loop,
VBlank's OAM order) and our sight path. The plan is `notes/20-a1c-plan.md`. It replaces
`notes/07-a1-plan.md` §2.4.

New findings since the A1 plan:
- **The bubble is on screen for 61 frames**, with two `UpdateSprites` back to back at its end.
- **`MoveSprite_` sets `wJoyIgnore = $ff`.** Only an adjacent trainer leaves A live, and then
  only for hidden events and bookshelves.
- **`EndTrainerBattle` takes the first pass after a battle.** No sight check runs on that pass.
- **Battle returns skip `EnterMap`'s `UpdateSprites`.**
- **A spotting at the hop midpoint would strand the player on the ledge.** It can't happen
  before V4.
- **`startScript`'s forced resting pass** matches Pallet's explicit `$2`, but not
  `MoveSprite` in general.
- **The Forest's youngster4 (sight 1) guards the hidden Potion's own tile, (1,18).**

**Then:** the user said **"go"**, which takes all seven recommendations (DECISIONS #43).
**Next:** Sol implements A1c from checkpoint 1 (plan §6), committing each checkpoint locally.
Claude reviews afterwards in `notes/21-a1c-review.md`.

### 2026-10-06 (root CLAUDE.md slimmed, 45.9k → 12.4k characters) — Claude Opus 5.5

Docs only, no code. Claude Code warned that root `CLAUDE.md` was over its 40k-character
limit, and the user asked to move content into the context files. Every slice had added
1–4k to it.

What moved (DECISIONS #42):
- Module map, state machine, data conventions and extraction system →
  `ARCHITECTURE.md` → *Engine reference*.
- Movement pitfalls → `game/src/overworld/ARCHITECTURE.md`.
- Audio → new `game/src/audio/ARCHITECTURE.md`.
- Pikachu happiness tables → `game/src/pikachu/ARCHITECTURE.md`.
- Battle mechanics merged into `game/src/battle/ARCHITECTURE.md`; the faint slide is
  corrected to 7 rows, and `lastBlackoutWarp` replaces the gone `BLACKOUT_POSITIONS`.
- Testing → `CONVENTIONS.md` → *The test suite*.

*Where things stand* is one paragraph now. Session contract step 5 says a slice no longer
grows CLAUDE.md.

**Next:** unchanged — plan A1c (trainer sight). Update CLAUDE.md only for the baseline and
finished milestones.

### 2026-10-06 (A1b user-verified → done) — Claude Opus 5.5

The user play-tested A1b (plan §7) after the review passed: "everything works perfectly".
Along the way they saw POTION ×99 + ×3 after adding 99 to 3, and a Potion bought at 99 with
free slots: both are the cartridge's per-stack rule (the refusal needs a full bag).
Marked A1b done in STATUS, CLAUDE.md, PROJECT, PLAN, ARCHITECTURE and CONVENTIONS. No code
changes. The user asked about trainers spotting the player with "!" — that is A1c, next.
**Next:** plan A1c (trainer sight).

### 2026-10-06 (A1b independent review passed) — Claude Opus 5.5

Reviewed Sol's A1b (`788ba6b`…`ba291ea`) against `notes/18-a1b-plan.md`, DECISIONS #41 and
the cited ASM: **passes, no blocking findings** (`notes/19-a1b-review.md`). Re-ran
everything myself: typecheck, **864/864** with ROM, **783 pass / 81 skip** without, build,
`git diff --check`; no generated-data, extractor, refs or art changes; the 67 existing
controller tests are unmodified. Two non-blocking notes that predate A1b:
- N-1: typed text completes one letter delay early → A5.
- N-2: wrong-facing hidden events fall through to signs/NPCs → V5.
Sol's Route 2 staged saves checked. Dev server started on 5173 for the play-test.
**Next:** the user's play-test (plan §7); then A1b is done and A1c is next.

### 2026-10-06 (A1b implementation) — Codex/Sol

User requested implementation of `notes/18-a1b-plan.md`; DECISIONS #41 applies.
Started from `5564446` (the user's sequential notes rename). Independently verified the
baseline: 812/812 with ROM, clean typecheck.

Checkpoint 1: `AddItemToInventory_`'s slot-order/99 rule and byte addition, selected-slot
removal in bag/shop/PC/battle menus, add-before-charge/transfer, verbatim save restoration.
18 regression tests cover split stacks, full inventories and the first-overflow quirk,
selected duplicate slots and failed menu transactions. Typecheck clean; no-ROM suite
749 pass / 81 skip (830 total). Commit `788ba6b`. No generated-data changes.

Checkpoint 2: retained `text_end` and protected `prompt`, blocking sound/silent-button/
A-release close commands, persistent HideObject keys and immediate collision refresh.
13 new primitive tests plus the existing 67 controller tests pass unchanged. Typecheck
clean; no-ROM suite 762 pass / 81 skip (843 total). Commit `2e787c3`.

Checkpoint 3: the three pickup builders, hidden-event/bookshelf/sign/NPC priority,
found-item fallthrough, saved `hiddenObjects` and restoration on every map load, new-game
reset, and removal of the unused free-move hidden-item copy. The runtime `NpcData` now
declares the `item` field already emitted by V1a; interaction handling is typed.
16 integration/data tests include ASM strings, real-engine 73/181-update jingle traces,
frozen NPCs, held A, full bags, save/reload and freed collision, Route 1's flag-first quirk,
and a 19-map overlap check. Typecheck clean; no-ROM 778 pass / 81 skip (859 total).
Commit `f7d49ca`.

Checkpoint 4: five more regressions drive selected duplicate stacks through field
toss/healing and battle ball/Potion/Antidote input. Updated CLAUDE, context and
overworld/story/text architecture docs; appended implementation handoff to the plan.
Final verification: **864/864** (36 files) with ROM; **783 pass / 81 skip** without ROM;
strict typecheck and production build clean. `git diff --check` clean; no generated
data, extractor, reference or art changes; no ROM gate/test hooks in the bundle.

Browser: real key input on temporary port 5181, with test-only access injected into
the served module outside the repository. Passed ball/hidden pickups, held A,
full-bag waits, split stacks, flag/follow-up behavior, save/reload/CONTINUE and freed
tiles, both Route 2 balls, Route 1's sample success/failure and the Mart's no-charge
refusal. The 5173 save/server were untouched. Prepared two Route 2 staged saves
(empty bag, Lv5 Pikachu, balls present) and loading/restore instructions in
`C:/Users/ajfm88/AppData/Local/Temp/pkmn-a1b/` (plan §10).

All four checkpoints committed locally; no push. Deferred findings stay in the
plan's §8 (A5 text endings/paging, J2/A3 cursor resets, A2 full item table, later
jingle sites/coins). **Awaiting Claude review, then the user's §7 play-test.**

### 2026-10-06 (notes renumbered) — Claude Opus 5.5

At the user's request, renamed the 18 files in `notes/` in the order they were first
committed, `01-r1a-graphics-export.md` … `18-a1b-plan.md` (`git mv`, history kept), and
rewrote all 207 references in tracked files, code comments included. New files take the next
number (CONVENTIONS → *Free to write*); A1b's review will be `19-a1b-review.md`. No code
changes. Typecheck clean; no-ROM suite 731 pass / 81 skip.
**Next:** unchanged: Sol implements `notes/18-a1b-plan.md`, then Claude reviews.

### 2026-10-06 (A1b plan) — Claude Opus 5.5

Planned A1b at the user's request: `notes/18-a1b-plan.md`. Probed `PickUpItem`, `HiddenItems`,
`DisplayTextID` / `HoldTextDisplayOpen` / `WaitForTextScrollButtonPress`, `TextCommand_SOUND`,
`AddItemToInventory_` / `RemoveItemFromInventory_` / `RemoveItemByID`, the Mart and PC
callers, `Route1PrintYoungster1Text`, and the overworld's A-press order. Findings:
- The bag rule's quirk: the room check happens at the *first* overflowing stack.
- Route 1's sample sets its flag before the give (a full bag loses the Potion); ours sets
  it on success, with invented texts.
- The ASM checks hidden events before signs and sprites; no tile on today's maps differs.
- **Every overworld `done` text closes silently, on A's release**, where ours beeps and
  closes on the press. Logged in the plan's §8 with a proposed home (A5, O-14.5).
No code changed. Tests not run (planning only; baseline 812/812 from A1a).

Five tracked files in `game/` (`index.html`, `package.json`, `tsconfig.json`,
`vite.config.ts`, `vitest.config.ts`) were missing at session start; the user restored them,
and the tree is clean again.
O-14 resolved (DECISIONS #41): Sol implements, Claude reviews; decisions 1–5 as recommended.
**Next:** Sol implements `notes/18-a1b-plan.md` in its four checkpoints (commit each), then
Claude reviews into `notes/19-a1b-review.md`, then the user's play-test (§7).

### 2026-10-06 (A1a independent review passed) — Codex

At the user's request, reviewed Claude Opus 5.5's A1a implementation through
`142f68f` against the approved plan, DECISIONS #40 and pinned Yellow assembly.
**No actionable findings within A1a's agreed scope.** Review:
`notes/17-a1a-review.md`. Independently verified **812/812** with the ROM,
**731 pass / 81 skip** without it, TypeScript + production build, the four-file
generated-data diff and clean diff whitespace. A separate temporary probe of
the actual public API passed preload/synchronous playback, successful pending
loads, failed-load wait cleanup and channel-8 drum cancellation. No engine,
generated-data or committed-test changes.

The documentation-only ear-test commit `142f68f` arrived during the review;
its recorded user verification is preserved. A1a remains done.
**Next:** plan A1b, item balls and hidden items (`notes/07-a1-plan.md` §2.2).

### 2026-10-06 (A1a user-verified → done) — Claude Opus 5.5

Started the dev server on `127.0.0.1:5173` for the ear test (`notes/16-a1a-plan.md` §7). The
user: "yes, i can hear the difference, very high fidelity and very close to what the game boy sounds like". **A1a is done and user-verified.** No separate
code review was requested. Context files updated (STATUS, PLAN, PROJECT, root CLAUDE.md,
the plan's result note). No code changes.

**Next:** A1b, item balls and hidden items (`notes/07-a1-plan.md` §2.2), which uses
`playSFX('get_item1' | 'get_item2')` and `isSoundFinished()`. Plan it first. Then A1c, A5,
V2.

### 2026-10-06 (A1a implemented) — Claude Opus 5.5

The user: "ultrathink and implement the plan yourself… I reply yes for all of them"
(DECISIONS #40, O-13 resolved). Implemented `notes/16-a1a-plan.md` in its four checkpoints,
one commit each:

1. **Data** (`3a4fabb`): music mode after `execute_music`, the two headers. The diff was
   exactly the 2 JSON files and their mirrors; setup ran twice byte-identical. +7 ROM tests
   (the sym addresses, pret's asm parsed directly). The `static_export` timeout.
2. **The move** (`732aa12`): `SoundChannel` extracted. 94 per-update synth traces (every
   track, alone and with SFX) identical before and after.
3. **The rules** (`75166d2`):
   - channel by id, SFX tempo $0100, the note arithmetic;
   - perfect pitch, vibrato (rate 0 included);
   - the wave octave and the per-note wave reload;
   - suppression, release instead of restore, music before SFX;
   - drum occupancy of channel 8;
   - `isSoundFinished()`, the preload, `_playSFX`.

   +18 tests.
4. **The jingles, the wait, drums, SFX-mode timing** (`8b1691e`): +11 tests. Docs.

**Beyond the plan:**
- **Rests now stay silent.** The old fade turned a decaying note back on mid-rest; this was
  demonstrated on the old code.
- **Pitch slides** skip vibrato and end at the next note.
- **Defaults are the init routines'**; checked neutral.

Details are in the plan's result note.

**Checks:** typecheck clean; **812/812** (33 files); no-ROM **731 pass / 81 skip**; build OK
with no test-rig code in the bundle; `git diff --check` clean.

**Browser** (agent, :5179, tab and server closed): the Forest + `_playSFX('get_item1')`
gave exactly the unit tests' register writes, the Forest's notes back from 83 and tempo
144. `get_item2` ended after 181 updates. No console errors. Not checked by ear.

**Next:** the user picks a reviewer, then plays the ear test (`notes/16-a1a-plan.md` §7: the
Forest jingles, deeper bass everywhere, the battle bass's wobble, A-button beeps over music,
the title-screen drums). Then A1b.

### 2026-10-06 (code read → findings logged → A1a plan) — Claude Opus 5.5

**Read** every context file and the engine, then ran the checks:
- typecheck clean;
- first full ROM run **775/776**: the `static_export` flake recurred. The next three
  runs were 776/776, and the test passes alone in 0.46 s.

**Findings logged** (the user: "fix those 5 problems … by noting them in the context
files"), committed as `f6ff8a1`:
- STATUS → *Found during the 2026-10-06 code read*:
  - the damage formula's missing stat scaling and misplaced 997 cap;
  - the garbage `pokefluteinbattle.json`;
  - sprite slot order on three maps, and walking Daisy;
  - the flake's recurrence.
- PLAN's V5 and E1 rows point at them, and PROJECT's stale "Next: A6e" is fixed.

**A1a plan** (planning only, no code): `notes/16-a1a-plan.md`. It is read from the whole of
`audio/engine_1.asm`, the init routines, `home/audio.asm` / `delay.asm` / `text.asm`, and
every bank's copy of both jingles. Key results:
- The jingles last 72 and 180 frames on every channel.
- An SFX's `tempo` never reaches the music (`SetSfxTempo` forces $0100). Our one global
  tempo would make the Forest music run 1.8× after a pickup.
- The interpreter the jingles need ignores perfect pitch, gets vibrato wrong (rate 0 =
  off), and plays the wave channel **an octave high in every track**.
- `WaitForSoundToFinish` waits on channels 5, 6 and 8. Music drums are noise-instrument
  SFX on channel 8, so a drum hit can hold the wait a frame.
- The plan has 7 decisions (O-13) and four checkpoints.

**Next:** the user answers O-13 and names the implementer. Then implement
`notes/16-a1a-plan.md` §6, review, and the user's ear test (§7).

### 2026-10-05 (A6e re-review) — Codex

Re-reviewed Claude's `128d7f8` against R-1/R-2 and Yellow's ASM. Both findings
are resolved; N-1's canvas and draw-order coverage is present, and the EOF
whitespace is cleaned. Independent checks: 776/776 with ROM, 702 pass/74 skip
without, TypeScript/Vite build clean, `git diff --check 0c51262 HEAD` clean.
Verdict and evidence: `notes/15-a6e-review.md` → *Re-review*. No browser check.

**Next:** the user runs `notes/14-a6e-plan.md` §9's play-test. Keep A6e open until
that result is verified; then mark it done before starting A1a.

### 2026-10-05 (A6e independent review) — Codex

Reviewed `f013fd1` against the A6e plan and Yellow source; results are in
`notes/15-a6e-review.md`. Re-ran 767/767 ROM tests, 693 pass/74 skip without ROM,
the production build and setup; tracked generated files stayed unchanged.
Three temporary focused fixtures failed on the two reported source mismatches
and were removed. `git diff --check f4ae41a HEAD` also found a blank EOF line
in `ui_entry.test.ts`; clean it on revision. No browser play-test claimed.

**Next:** Claude fixes R-1/R-2 with regression tests, rechecks sprite-priority
rendering, and requests re-review. Then the user runs the A6e §9 play-test.

### 2026-10-05 (A6e done → A6 done) — Claude Opus 5.5

Codex's re-review of the revision `128d7f8` passed with no blocking findings
(`18732e7`, `notes/15-a6e-review.md` → *Re-review*). The user then play-tested A6e:
**A6e is done and user-verified, and with it milestone A6** (A6a–A6e). Context files
updated (STATUS, PLAN, PROJECT, root CLAUDE.md). No code changes.

**Next:** A1a, music-mode SFX and the item jingles (`notes/07-a1-plan.md` §2.1), then A1b,
A1c (which owns the hop-midpoint map scripts and trainer sight after landing), A5, V2.

### 2026-10-05 (A6e revision: review R-1, R-2, N-1) — Claude Opus 5.5

Fixed Codex's review (`notes/15-a6e-review.md`) in one local commit.

- **R-1:** the nurse's facing save/restore no longer depends on Pikachu being drawn.
- **R-2:** the interpreter now uses screen-pixel and map bytes (+4 border), each write
  wrapping; the follower converts at the call with the player as the fixed anchor.
- **N-1:** `spriteDrawOrder` for the scene's OAM order, and a canvas-spy test of
  `drawShadowUnderSprites`. The EOF blank line is removed.

**Checks:** typecheck clean; **776/776** with ROM_PATH (31 files), **702 pass / 74 skip**
without; build OK; `git diff --check` clean. No browser check.

**Next:** Codex re-reviews; then the user's play-test (plan §9).

### 2026-10-04 (A6e implemented) — Claude Opus 5.5

The user: "notes\14-a6e-plan.md pls ultrathink, plan and implement this plan". Implemented
Codex's plan in its three checkpoints, verifying its claims against the ASM first.

- **1 (`0a89455`):** `pikachu_movement.json` (63 records, SineWave_3f, ten programs) and the
  pure runner. Sol's durations (37/69/67/35), sine traces and the subtimer bug all
  checked by hand. **Correction:** Viridian's program is at 3c:5a0a (the `ld hl` operand
  of `ViridianCityMovePikachu`), not 3c:5e2b.
- **2 (`1a7231f`):** the follower's own map position and step-vector moves; the stand-in
  queue and its arc removed; TryApply for Viridian and the lab (whose step was missing);
  the nurse rebuilt from `DisplayPokemonCenterDialogue_`. **Correction:** spawn state 5
  only places a starter that wasn't out (its readers need movement status 0), so a healthy
  Pikachu stays where its walk ended; CloseTextDisplay restores its saved facing.
- **3 (`89f620b`):** the emotion phases — entry turn, movement prelude, border
  (Delay3, covered update, Delay3), portrait.

**Checks:** typecheck clean; **767/767** with ROM_PATH (30 files), **693 pass / 74 skip**
without; build OK; setup twice byte-identical (only the new JSON); the A6d following
hash still matches. **No browser check was run.**

**Next:** an independent review (the user's choice of agent), then the user's play-test
(plan §9 plus the *Implementation result* notes). Then A1a.

### 2026-10-04 (A6e plan) — Codex (Sol)

Read the updated context, subsystem architecture notes, A6d plan/review and the
full Yellow movement interpreter plus its callers. Wrote `notes/14-a6e-plan.md`:
all 63 records, ten current programs, two-frame command holds and one-frame
return, explicit map/pixel state, the native animation subtimer bug, integer
sine hops, swapped sprite priority, shared shadow composition and caller-owned
refreshes. Includes Viridian, the missing lab parcel-return call, nurse and five
ordinary emotion movement preludes; three implementation checkpoints, exact
timing fixtures, regression checks and a user checklist. O-12 proposes bounded
emotion work and nurse outer choreography; implementation remains unassigned.

Read-only ROM probes matched the entire ASM database uniquely at `fd3b0`,
verified all ten programs and sine data at `fd938`, produced three integer hop
traces and confirmed the two shadow banks have identical bytes. **N-2 timing
correction:** `Func_6ebb(15,0)` directly writes Pikachu's image after fighting-fit
text; the subsequent Delay3 publishes it before the bow, not after its 40-frame
wait. §7 requires a focused image/OAM call trace during implementation/review.

**Verification:** documentation diff/whitespace checked. No setup, engine edits,
game tests or browser play-test performed in this planning session. The reviewed
baseline remains **729/729**, no-ROM **657 pass / 72 skip**. Plan and handoff are
committed locally in this session's A6e planning commit.

**Next:** the user settles O-12 and the implementer; then implement this plan,
independent review and user play-test. A6e stays open; A1a–c follow it.

### 2026-10-04 (A6c + A6d done) — Claude Opus 5.5

The user played the combined A6c/A6d checklist on `http://127.0.0.1:5173/` (the dev
server wasn't running at first; started with `npx vite --host 127.0.0.1 --port 5173
--strictPort`): "it works, it is all looking good". **A6c and A6d are done and
user-verified.** Context files updated (STATUS, PLAN, PROJECT, ARCHITECTURE,
CONVENTIONS, root CLAUDE.md). No code changes.

**Next:** Sol (Codex) plans A6e (`ApplyPikachuMovementData`). Then A1a–c, A5, V2.

### 2026-10-04 (A6d + A6c R-3 review) — Claude Opus 5.5

Reviewed Sol's A6d (`4166071`, `7384386`) against `notes/12-a6d-plan.md` and the ASM, and
A6c's R-3 fix (`9897020`). **Approved, no blocking findings** (`notes/13-a6d-review.md`).

- Re-ran everything: typecheck clean, **729/729** with `ROM_PATH`, 657 pass / 72 skip
  without, build OK, `git diff --check` clean, generated output = `shadow.png` only.
- Reproduced Sol's ordinary-following regression hash on the pre-A6d code in a scratch
  worktree (removed afterwards): identical, 0 of 240 passes differ.
- R-3: bit 7 is served on every eligible update, and talking to Pikachu opens in source
  order. `DisplayTextIDInit` saves facings after its `UpdateSprites`, so closing keeps
  the turn.
- Notes: N-1 (an extra refresh after the nurse walk, not in the ASM, no visible effect)
  and N-2 (when Pikachu reappears after a heal) → A6e. Carry-over: trainer sight before
  the landing → A1c (already its job).

**Next:** the user's combined play-test (`notes/10-a6c-plan.md` §10 + `notes/12-a6d-plan.md`
§9). On success, mark A6c and A6d done, then plan A6e.

### 2026-10-04 (A6d implemented) — Codex

Implemented `notes/12-a6d-plan.md` after the user's go; all three O-11 recommendations
recorded as DECISIONS #38. Kept the concurrently committed start-condition update
`530363c`: Claude reviews A6d and A6c's R-3 on `9897020` together.

- Native 16-command buffer, retained newest command, literal bit-6 toggle at both hop
  halves; no position-buffer teleport. Pikachu stops at takeoff, then crosses two tiles
  in eight flat 4px updates on the next step. Ordinary catch-up threshold matches ASM.
- Landing UpdateSprites at armed+34, 1-frame hold, continuation at +37 and next pass
  at +39. Landing blocks input/map scripts/interaction; script pushes clear the shadow
  before their next command. Both simulated step boundaries stay unchanged.
- Extracted the ROM shadow and composed its mirrored tile with a player alpha mask,
  after grass overlay. Setup: 520 PNGs / 3 tilemaps / 164 JSON. Generated diff is only
  `game/static/gfx/overworld/shadow.png`; no JSON changed.
- Separate script targets retain the nurse arc; state-5 heal placement and completed
  scripted moves refresh native following. Interpreter deferred to A6e as agreed.
- Added 24 tests. The 30-step ordinary pixel trace matches the original committed
  follower; a seeded 200-step walk keeps at most two commands. Temporary probes removed.

**Checks:** typecheck/build clean; ROM suite **729/729**, 29 files; no-ROM suite
**657 pass / 72 skip**; `git diff --check` clean. No browser or user play-test claimed.
Implementation commit **`4166071`** (`A6d (1/2): native Pikachu following, ledge shadow
and landing pass`). The follow-up `A6d (2/2)` commit records this exact hash and handoff.

**Next:** Claude reviews the A6d implementation against the plan and ASM plus A6c R-3.
Then the user play-tests `notes/12-a6d-plan.md` §9 and `notes/10-a6c-plan.md` §10 together.
Keep both slices in progress until those gates pass; do not start A6e or A1 yet.

### 2026-10-04 (A6d plan) — Claude Opus 5.5

Planning only; no engine, data or test changes. The user asked Claude to plan the next
slice for Sol (Codex) to implement, with Claude reviewing afterwards. Wrote
`notes/12-a6d-plan.md` from the ASM (`ledges.asm`, `_HandleMidJump`, `sprite_oam.asm`,
`pikachu_follow.asm`'s buffer routines) and the current code.

What it found:

- **The user's ledge report is the follow model.** Yellow appends one hop command (5–8)
  per ledge, on the first half (`Func_fcc64`'s bit-6 toggle). With nothing behind it,
  the command can't be popped. So Pikachu waits on the takeoff tile and, on the player's
  next step, moves 2 tiles in 8 updates of 4 px with no arc. Upstream queues the ledge
  tile itself, with a sine arc. gen1recomp reads it the same way as this plan.
- **The landing pass runs one more `UpdateSprites`** at a+34, before `Delay3`. Ours
  skips it; the standing pass at a+37 is already right.
- **The shadow:** 06:6893, 8 bytes = pret's `shadow.png`, one tile drawn twice (the
  second mirrored) at screen (64,72). It sits above grass and below every sprite pixel.
  A probe of today's maps: 186 ledge spots, 27 land on grass, none on a warp or across a
  connection.
- **Native fast-follow** needs three or more steps of lag (upstream: two). Every place
  that puts Pikachu somewhere must refresh the buffer; the Pokécenter's `showPikachu`
  doesn't today.
- `ApplyPikachuMovementData` is its own ~1000-line interpreter with four users on our
  maps (one of them, Oak's Lab's Pikachu step, missing from our port) → proposed A6e.

**Next:** the user answers O-11. Sol implements A6d right away; the user dropped Codex's
separate A6c re-review. Claude then reviews A6d, including A6c's R-3 fix, and the user
play-tests A6c (§10) and A6d (§9) together.

### 2026-10-03 (A6c revision 2: re-review R-3) — Claude Opus 5.5

Fixed R-3 from Codex's re-review (`2eff68a`), one local commit.

- The face-player request (bit 7) is now served by the first update that finds Pikachu
  on screen, ordinary or font-loaded (`Func_fc745` sits before both dispatches in
  `SpawnPikachu_`). A box covering Pikachu only defers it.
- Talking to Pikachu opens in source order (`ui_entry.ts` `openOverworldUi`): the
  borderless DisplayTextIDInit update on the bare map (the turn), then the portrait box
  (`PlacePikapicTextBoxBorder`) and its update, which hides Pikachu under it.
- The surrogate test (bottom text box standing in for the portrait) is replaced:
  `ui_entry.test.ts` captures the real `renderPikachuEmotionBox` from all four sides.

**Checks:** typecheck clean; `ROM_PATH` suite **705/705 in 27 files**; without it 634
pass / 71 skip; build OK; `git diff --check` clean.

**User play-test report (same day):** after hopping a ledge, Pikachu lands on the
ledge row and trails a step further behind. Probed through the real controller on both
`1854ef1` and the current code: identical traces, so it predates A6c. It's upstream's
ledge-follow approximation → recorded under **A6d**.

**Next:** Codex re-reviews; then the user's plan §10 play-test.

### 2026-10-03 (A6c re-review — R-1/R-2 resolved, R-3 requested) — Codex

Reviewed Claude's exact revision **`4d3c407`** against parent `47a940e`, the
previous findings and read-only Yellow ASM at `e89ead15`. The original START
clipping and ordinary text/nurse antic-reset cases are fixed. Inspected all
changed files, the actual UI capture/entry path and Pikachu conversation
entry/exit. Added the latest verdict/evidence to `notes/11-a6c-review.md` and the
plan. No engine/data/assets/config changes, reference refresh, browser/server
or save manipulation.

**One new P2 finding, R-3:** the real centered Pikachu face box covers all four
normal adjacent follower positions. The new pending turn returns at the
availability guard, and ordinary updates never handle it afterward. Pikachu
can reappear facing its old direction and turn later during unrelated text.
The new controller test substitutes the bottom dialogue box for the portrait,
so it misses the regression. An independent Node probe used actual
`captureUi(renderPikachuEmotionBox)` and the live follower/UI helpers: two
expected-behavior assertions failed, reproducing the skipped and delayed turn.
Scratch source/bootstrap/bundle lived outside the repository and were removed.
ASM requires the bit-7 branch before ordinary as well as font dispatch, and
initializes Pikachu text without a border before drawing the portrait.

**Independent checks:** typecheck clean; ROM-enabled **699/699 in 27 files**,
default timeout; without ROM **628 pass / 71 skip**; build OK (97 modules,
308.65 kB / 88.56 kB gzip); `git diff --check` clean. No browser/user play-test
claimed. R-1/R-2 retained as resolved; existing deferred issues keep their homes.

**Next:** Claude fixes R-3 using the review's focused instructions and actual
portrait regression tests, then Codex reviews that exact follow-up. User
plan §10 play-test follows a passing review; A6c stays in progress. Commit
review documentation locally; nothing pushed.

### 2026-10-03 (A6c revision: review R-1, R-2) — Claude Opus 5.5

Fixed both findings of `notes/11-a6c-review.md`, one local commit on `47a940e`.

- **R-1:** `pikachuCovered` (`sprite_visibility.ts`) ports `WillPikachuSpawnOnTheScreen`'s
  footprint ((Y + 4) & $f0 rows, (X + 2) >> 3 columns, bounce included). The follower
  checks window + UI before any dispatch (hidden, frozen, no RNG) and its `render` hides
  the whole sprite under UI from the first frame.
- **R-2:** `PikachuFollower.fontLoadedUpdate` = `SpawnPikachu_` with the font loaded:
  the screen check first, then `Func_fc745` for a talked-to Pikachu (bit 7, set by the
  controller's `requestFacePlayer`) or `Func_fc76a` (standing image, screen position
  back on the map position, ready, countdown 0, follow command reseeded). `main.ts`
  runs it once per UI opening (`overworld/ui_entry.ts`: closed → open), with the boxes
  captured in the tick. The nurse's `pikachuToNurse` runs it first, with no UI (the ASM
  reloads the map view before that UpdateSprites).
- A Pikachu covered mid-bounce stays invisible until the bounce ends — `asm_fc87f`
  never redraws the image. Pinned by a test.

**Checks:** typecheck clean; `ROM_PATH` suite **699/699 in 27 files**; without it 628
pass / 71 skip; build OK; `git diff --check` clean. No browser run.

**Next:** Codex re-reviews the revision; then the user's plan §10 play-test.

### 2026-10-03 (A6c independent review — changes requested) — Codex

At the user's request, reviewed Claude's implementation **`22919a7`** against
the A6c plan, engine baseline **`1854ef1`**, and read-only Yellow ASM at
`e89ead15`. Read the changed engine/tests/docs and traced actual menu, text and
script callers. Added **`notes/11-a6c-review.md`** and appended the verdict to the
plan. No engine/data/assets/config changes, reference refresh, browser/server
or save changes.

**Verdict: two P2 fixes required.** R-1: Pikachu has the map-window guard but
omits `WillPikachuSpawnOnTheScreen`'s UI footprint guard; a bounce can expose
opaque pixels beside START, and covered sprite passes lack native hide/freeze
behavior. R-2: text/START entry omits the font-loaded `Func_fc76a` transition;
an uncovered antic remains suspended during UI and resumes afterward. The
nurse's already-above-player path also bypasses direct movement/reset. The
review specifies source ordering, fixes and permanent integration regressions.
Core NPC byte/displacement/rest rules, ordered collision geometry, transient
trainer override, antic helpers and player obstruction gate passed review.

**Independent checks:** typecheck clean; ROM-enabled suite **681/681 in 26
files**, default timeout; without ROM **610 pass / 71 skip**; build OK;
`git diff --check` clean. Four temporary deterministic UI/font probes each
failed an expected-behavior assertion, reproducing R-1/R-2; probes removed,
evidence recorded in the review. Inspected source sprite pixels for the START
edge example. Existing NPC image lag and map metadata discrepancies remain
separate follow-ups; no browser or user play-test was claimed.

**Next:** Claude resolves R-1/R-2, records the exact revision/checks, then Codex
re-reviews before the user's plan §10 play-test. A6c stays in progress. This
review ends in a local documentation commit; nothing pushed.

### 2026-10-03 (A6c implementation) — Claude Opus 5.5

**Implemented `notes/10-a6c-plan.md` in one local commit** (`A6c: …`, on `1854ef1`).
Re-read the plan's ASM anchors first (`movement.asm`, `sprite_collisions.asm`,
`pikachu_follow.asm`, `home/overworld.asm`, `npc_movement_2.asm`).

- NPCs: live movement bytes; the direction byte on every try (STAY and fixed too); STAY
  fails into a random rest, so NONE sprites turn in place; displacement bytes 8/8 with no
  origin box; the screen edge in the GB basis; pixel collision masks in slot order
  (`overworld/sprite_collision.ts`, `sprites.ts`); claimed-tile blocking and the old
  wander rules are gone.
- Beaten map trainers turn at random for the current visit (not rivals, not Tower 7F).
- Pikachu: retained follow command, the 256-then-32 glance countdown, the four antics
  with the reverse bounce table as a screen offset (`pikachu/pikachu_idle.ts`), an image
  latch, equality-compared animation counters; scripts moving Pikachu directly never idle.
- Turning into Pikachu: the counter arms 8, seven blocked checks, B bypasses.

**Checks:** typecheck clean; `ROM_PATH` suite **681/681 in 26 files**; without it 610
pass / 71 skip; build OK; `git diff --check` clean. No browser run — the user
play-tests (§10 of the plan; A = Z, B = X).

**Found:** map metadata that disagrees with pret's `object_event` bytes — Route 1's two
youngsters and the Viridian Pokécenter gentleman should be axis-limited walkers;
Viridian's `oldman2` should be NONE. Data fix, not this slice (detail in the plan's
result note; proposed home V5 or a small data slice).

**Next:** Codex reviews (`notes/11-a6c-review.md`); then the user's play-test. A6c stays
in progress until both are recorded.

### 2026-10-03 (A6c research and implementation handoff) — Codex

**Plan only, at the user's request.** Read the context and project Markdown,
then traced A6c against Yellow ASM and current movement, collision, battle-return,
Pikachu and script code. Added `notes/10-a6c-plan.md`; linked it from the old A6
sketch. The user assigned implementation to Claude Opus and review to Codex.

Key refinements: Yellow removed the positive wander cap but retains unsigned
displacement bytes; direction selection consumes RNG even for fixed STAY;
collisions use pixel/vector geometry and ordered sprite updates; defeated-trainer
turning is transient for the current map visit; Pikachu's four antics use a
retained follow command, byte-wrap idle countdown and immediate entry update;
the bounce retains its displayed image while its live facing changes; interrupted
antics carry byte/equality animation counters into following; the armed
obstruction blocks seven eligible checks before the eighth passes.
No engine/data/assets changed, no browser/server/save changes, no ref refresh.

**Baseline checks:** typecheck clean. Default ROM-enabled tests: 569 pass plus
the previously observed cold static-export 5-second timeout. That file passed
6/6 in isolation with a 20-second CLI timeout; the full suite then passed
**570/570 across 23 files** with the same override. No timeout/config edits.
No production build run was needed for this documentation-only slice.

**Next:** Claude implements `notes/10-a6c-plan.md`, records its exact commit and
validation, and leaves **A6c awaiting Codex review**. Codex then reviews the
implementation and writes `notes/11-a6c-review.md`; user play-test follows. A6c is
not done. This planning slice ends in a local documentation commit with the
project's co-author line.

### 2026-10-01 (A6b review → play-test → done) — Claude Opus 5.5

- **Review:** interim pass on the working tree, then the final review of `eac3dd3`
  (`notes/09-a6b-review.md`, committed `2e9e765`): 570/570, typecheck and build clean.
  Sol fixed R-1 (the menu footprint was one tile row high) and N-1 (Indigo Plateau).
  F-1 (the overworld is drawn 4 px above the Game Boy's), N-2, N-3 and N-5 are logged
  with homes.
- **The user play-tested §5.3-8: "all working well". A6b is done.**
- **Next:** A6c (NPC wandering and turning), another day. Probe `notes/08-a6-plan.md`
  §2.3 against the code first.

### 2026-10-01 (A6b implementation) — Codex

Implemented `notes/08-a6-plan.md` §5.3 and all four approved decisions. Standing passes
run map scripts before input; step end counts → updates Pikachu → rolls → checks
warps/connections. Turn encounters, two calm post-battle steps, simulated hop
halves/door exits, the indoor rule, NPC window/pop-in and whole-sprite UI masking,
retained talk-facing and the fixed STAY delay cycle are wired and tested.

**ASM clarifications:** only EnterMap resets the step counter and active cooldown;
seamless connections preserve them. WALKING's `$80` mood target does nothing, so
the per-step drift is exactly one even when the 256-step bonus wins. Oak's in-step
routine still refreshes animation while the player moves. The result note records
these details and the refreshed gen1recomp cross-check.

**Checks:** typecheck clean; **570/570** with ROM_PATH; production build OK;
without ROM_PATH **499 pass, 71 extraction checks skip**; diff whitespace clean.
68 tests added. Runtime remains static-file-only; no extractor/data/static changes.
The existing refs-refresh commit (`164d4bf`) was preserved.

Claude's interim review file appeared while implementation was in progress. Its
R-1 menu-footprint bug and N-1 classifier omission are fixed and tested; N-4's
catch-demo path is ASM-verified. Off-slice findings are logged above. The review
file itself was left untouched; the final committed diff still needs re-review.

**Claude's final review (2026-10-01): passed.** `notes/09-a6b-review.md` → *Final review*:
570/570, typecheck and build clean; R-1 and N-1 fixed; the WALKING mood and starter
checks verified against `ModifyPikachuHappiness`; the UI capture covers every state the
old render branch drew. The one small gap (the OT check) falls under the already-logged
Pikachu state audit. **A6b now waits only on the user's play-test of §5.3-8.**

**Handoff (as written before the review):** A6b is **awaiting review**. Claude reviews the local implementation diff
from `164d4bf`; then the user performs §5.3-8's browser checks. The agent did not
drive those checks, per §5.5. Log review/play-test outcomes before claiming A6c.

### 2026-10-01 (7th session: repo check → stale-line fixes) — Claude Opus 5.5

**Repo check** (read-only): every *Setup* claim matched — git (`master`, no remote,
clean), ROM SHA1, the 5 refs on their pinned commits, 164 JSON / 19 maps / 57 wild /
47 music / 10 SFX / 520 PNG / 3 tilemaps, typecheck clean, **502/502** (the
`static_export` test that failed once last session passed in 1.7 s).

**Docs only, at the user's request ("pls fix the stale lines"):** the walk speed in
ARCHITECTURE (was 2 px/frame, 8 frames a step); the baseline label in CONVENTIONS
(after A6a, not V1e) and its key-poll note; PLAN's "35 sittings", A6 marked 🔨 and its
NPC step 32 → 34; this file's *Where things stand* date, the key-tap note (was 50 fps),
and the A6 slice note; a ⚠ note on DECISIONS #35 (NPC step 34). No code changed.

**A6a done.** Dev server on `127.0.0.1:5173`; the user played all 8 remaining checks
(`notes/08-a6-plan.md` → *Progress* → "Still to verify") and said "all 8 points work
perfectly". Logged as done, user-verified.

**A6b plan** (no code): `notes/08-a6-plan.md` §5. Key results:
- A6a already fixed the held-key triggers.
- Map scripts run on every standing pass, before input. Pallet's trigger has no facing
  check in the ASM.
- The step-end order is: step count → Pikachu happiness and mood → encounter → warps →
  connections.
- The walking happiness departs three ways: the counter resets per map, it's a 50% roll,
  and the mood drifts 1 toward 128 every step.
- **The post-battle cooldown is 2 calm steps, not 3**: the count reaches 0 before the
  third step's roll.
- The ledge hop is two simulated steps: no count, no encounter.
- Sprites outside the 4/5-step window aren't drawn and pop in after a step. A sprite with
  any tile under a text box or menu is hidden whole.
- NPCs keep facing you after a talk. Fixed-facing STAY NPCs turn back after a random
  1–256-pass delay.
- Grass priority checked: no change needed.
- 4 decisions (O-10).

**Decisions:** the user said yes to all four (DECISIONS #37) and assigned A6b's
implementation to **Sol 6.1**, with Claude reviewing. `notes/08-a6-plan.md` §5.4 is marked
decided, and §5.5 adds notes for the implementer. The dev server was left running on
`127.0.0.1:5173` for the user.

**Refs refreshed** (`./pull-refs.sh`, at the user's request): `gen1recomp` +165 commits
(`20ab97ab`, including changes to its Yellow overworld, Player and Pikachu follower
files, now noted in `notes/08-a6-plan.md` §5.5), `engine` +13 (`79957401`, a Zig toolchain
update with no Gen 1 logic change). The other three were already current. All five are
clean and on their pinned branches.

**Next:** Sol 6.1 implements A6b (`notes/08-a6-plan.md` §5.3 + §5.5) and leaves it
"awaiting review". Then Claude reviews the diff, and the user play-tests §5.3-8.

### 2026-09-27 → 28 (6th session: A1 plan → A6 plan → A6a) — Claude Opus 5.5

**A1 plan** (no engine code): `notes/07-a1-plan.md`. It is read from `pick_up_item.asm`,
`hidden_items.asm`, `inventory.asm`, `trainer_sight.asm`, `home/trainers.asm`,
`emotion_bubbles.asm`, `movement.asm` and `home/overworld.asm`, the item jingles' audio
headers, and gen1recomp's sight and movement code. Key results:
- **The pickup needs its jingle, and nothing can play it yet.**
  - An item ball closes its "found" box by itself when `SFX_GET_ITEM_1` ends; a hidden
    item plays `SFX_GET_ITEM_2`.
  - Both are music-mode SFX (`execute_music`). The extractor misdecodes them after that
    command, and the SFX engine can't play notes. The music engine can, and A1a would
    reuse it.
- **Hidden items depart from the ASM three ways:** the order, the jingle and the
  bag-full text.
- **`GiveItem`'s 99-per-slot rule is missing.** Upstream stacks grow past 99.
- **Trainer sight, as the ASM does it:**
  - It is checked at the start of every overworld pass while the player isn't
    mid-step, before input. So a trainer also spots a player who is standing still,
    for example right after a wild battle.
  - The math is in 8-bit screen pixels, and the trainer must be on screen.
  - Two quirks follow. A down-facing trainer can't see exactly 4 steps (the $fc wrap).
    And a trainer at the window's edge spots a player who keeps walking toward it one
    step closer (the sprite pops in one pass late).
  - The meet music starts at spotting. The "!" lasts 60 + 1 frames, and the walk-up is
    distance − 1 steps with collisions ignored.
- **Found: the overworld runs at 2×** (Notes for later). This is why the plan proposes a
  new milestone, A6, before the sight slice.
- The plan proposes **A1a** (the jingles) → **A1b** (item balls + hidden items) → **A6**
  (overworld pace) → **A1c** (trainer sight), with **6 decisions** (O-8).

**The unexplained test failure from O-5 came back and is fixed.**
- The suite failed 1 of 476 in the first run this session. A background loop caught
  it on run 64 of 150.
- The failing test was `damage.test.ts` › "power-0 moves return damage=0,
  missed=false". It rolled GROWL's accuracy with an unmocked `Math.random`, and Gen 1
  misses 1 in 256.
- Test-only fix: `mockRandomFixed(0.5)`, as its neighbours do. Typecheck is clean and
  the suite is **476/476**.

**Docs:** root `CLAUDE.md` had two stale test counts. Extraction is 65 (not 62), and
71 tests skip without `ROM_PATH` (not 68).

**Decisions:** the user answered "yes, pls do walking speed first, lol, that was bugging
me a lot". That takes all six recommendations, with A6 moved first (DECISIONS #35).
PLAN now has 36 milestones and the queue is A6 → A1a → A1b → A1c → A5 → V2.

**A6 plan** (no code): `notes/08-a6-plan.md`. It is read from `home/overworld.asm`,
`movement.asm`, `facings.asm`, `auto_movement.asm`, `pikachu_follow.asm`, the ledge and
jump code, and the encounter code. Key results:
- **The overworld has two clocks.** Frames drive text, waits, audio and battles. Passes
  of 2 frames drive everything that moves.
- **Per step:** the player 16 frames. A normal NPC takes 34 (a start pass + 16 × 1 px).
  Yellow's fast NPC codes (`$04`–`$07`, the lab rival) take 18. An NPC walking in
  step with the player (Oak's walk to the lab) takes 16. Pikachu 16, catching up at
  4 px per pass. Upstream takes 8 for all of them.
- **Found as well:**
  - Turning costs a pass only from a standstill.
  - The walking frames are mirrored for up and down, so the feet alternate.
  - Pikachu's walking animation is slower below 80 happiness.
  - The ledge hop has a height table and a shadow.
  - Turning in grass rolls an encounter.
  - No encounters for 3 steps after a battle.
  - NPCs keep facing you after a talk; they wander up to 8 steps up/left, unlimited
    down/right, never off screen; STAY NPCs turn in place.
- **The proposed split:** A6a (pace) → A6b (pass order, pop-in, encounters) → A6c (NPC
  wandering and turning) → A6d (ledge hop details), with 4 decisions (O-9).

**A6 decisions:** the user said "go", taking all four (DECISIONS #36). A6a is claimed.

**A6a — the overworld on the ASM's 2-frame pass** (code landed; browser verification
partial; see `notes/08-a6-plan.md` → *Progress*):
- **`overworld/walk_pace.ts`**, pure, with 26 tests: `PassClock`, `PlayerWalk`,
  `NpcWalk` (normal, fast and in-step modes), `WalkAnim` and the jump table.
  `Player`, `Npc` and `PikachuFollower` run it. `overworld/sprites.ts` holds
  `updateSprites()`.
- **Joypad:** `input.ts` reads it the ASM's way (`readJoypad` on standing passes).
- **Scripts** move only on passes. They gained modes for NPC steps and a parallel walk
  whose player part starts partway through.
- **Pallet:** Oak walks to the lab in step with the player.
- **Oak's Lab:** the rival's shove (fast steps, with the push starting on his last step)
  and his exit (2 normal steps, then fast ones).
- **Viridian:** the held-key workaround is removed, because the next step now starts on
  the pass after one ends.
- **Checks:** typecheck clean, **502/502**, build OK.
- **Browser (user's Chrome, temporary server :5179):** measured 2 px a pass, 8 passes a
  step, **15.99 frames a step**, plus the turning pass.
- **The user:** "he walks at a perfect, gb speed".
- **The user's find:** "oak BOLTS" — his legs flickered on the walk to the lab. My
  in-step frame came from the intra counter, following pret's comment; the code reads
  `ANIMFRAMECOUNTER`. Fixed and pinned by a test, not re-played yet.
- **Cleanup:** the temporary measurement hook was removed, the :5179 server stopped and
  its tab closed.
- **Also:** a Bash-classifier outage mid-session; PowerShell ran the same commands.
- **To watch:** after the session restarted, the first full run failed once, in
  `static_export.test.ts` › "static/ is up to date with the extractors". The error text
  wasn't captured. The test has no explicit timeout (vitest's default is 5 s) and reads
  all 848 files, so a cold file cache is the likely cause. It passed alone and in three
  full reruns, and A6a changes no extractor or data. If it shows up again, capture the
  message and consider a longer timeout for that test.

**Next:** finish A6a's browser checks (`notes/08-a6-plan.md` → *Progress* → "Still to
verify"): Oak's walk again, the lab scenes, the old man, the nurse, the Mart, a ledge,
NPC and Pikachu pace. Then log A6a as done and claim **A6b**.

### 2026-09-25 (5th session: O-5 → V1e plan → V1e) — Claude Opus 5.5

**O-5, the frame rate** (the user: "pls match the game boy 59.7"; DECISIONS #33):
- **Found first:** upstream's loop dropped its leftover time on every call, so the
  display refresh capped the rate. Its "50" ran 30 ticks/s at 60 Hz, 40 at 120 Hz,
  48 at 144 and 240 Hz, and 41.6 on the background worker. Changing the constant alone
  would still have given 30 on a 60 Hz display.
- `core/tick_clock.ts` has `GB_FPS = 4194304 / 70224` and a `TickClock` that keeps
  the remainder (the audio clock already did). `-`/`+` now step through multiples of
  5 with the Game Boy rate as a stop between 55 and 60, and the toast shows 59.73.
- +11 tests → **452/452**, typecheck clean, build OK.
- **Measured in the user's Chrome** (240 Hz display): **59.70 ticks/s over 20 s**,
  59.79 over 10 s. Upstream's loop gave 48 there, about 80% of Game Boy speed. This used
  a temporary tick counter on a spare port (:5179), which was removed before the
  commit, along with the test FPS key.
- **One unexplained test failure:** the first full run after the change had 1 failure
  in 452. The next 16 runs were all clean, and the failure wasn't captured.
  `tick_clock.test.ts` is deterministic and had just passed on its own, so this is
  probably an unmocked random roll in an older test. If it shows up again, note which
  test it is.

**V1e plan** (no code): `notes/06-v1e-plan.md`. It is read from `scripts/ViridianCity.asm`,
`ViridianCity_2.asm`, `OaksLab.asm`, `ViridianMart.asm` and the Pikachu movement engine,
and compared with gen1recomp's Yellow old man. Key results:
- **The city runs a saved state machine** (`wViridianCityCurScript`, 11 states). Only 0
  / 1 / 2 can be saved; 3–10 run with input locked. Only a new game resets it.
- **A Gen 1 quirk to keep:** the Gym-door push-back (32,8) sends the city to
  `POST_CATCH_TRAINING` from any state. That turns off the (19,9) old-man check, so
  before the Pokédex you can walk to Route 2 without one. Keeping it needs the state
  index saved (O-7).
- **The walk-away when you're not at x=19** is right *then* down 6 (`MovementData1` falls
  through into `Data2`). Pikachu steps aside (down, left, look right) only when it stands
  on the player's right. gen1recomp gets both wrong, and `notes/02-v1-plan.md` §2.5 had the
  first one wrong.
- **`EVENT_INITIAL_CATCH_TRAINING` stays set after the first demo;** only the repeat demo
  clears it.
- **Also missing upstream:** the sleeping man's push fires from any direction and when you
  talk to him (upstream: facing up only, no push on talk). The walking old man is missing
  `walkDir: left_right`. There is no Gym-door check.
- **Data changes** landing with V1e: +`oldman2`, oldman1's `walkDir`, no Route 22 NPCs,
  −`VIRIDIAN_OLDMAN_DEMO`.

**V1e** (`85b2c6b`; DECISIONS #34):
- The user said "do v1e as one slice". The other two decisions took their recommended
  defaults, and DECISIONS #34 says so.
- **Data:** +`oldman2`, oldman1's `walkDir: left_right`, no Route 22 NPCs,
  −`VIRIDIAN_OLDMAN_DEMO`. The regenerated diff was exactly those 3 files and their
  mirrors.
- **Engine:**
  - `story/viridian_city.ts` holds the state machine and the command lists.
  - `events.ts` gained map-script state, saved as `mapScripts`, with Viridian's state
    derived for old saves.
  - New script commands `clearFlag`, `setMapScript`, `pushPlayer` and `movePikachu`.
  - `player.update` takes a simulated input, and `PikachuFollower.forgetPlayerStep`
    was added.
  - Oak's Pokédex script sets the city to `AFTER_POKEDEX`, and the Mart hook sets
    `SPAWNED_OLD_MAN_1`.
- **Two bugs found in the browser and fixed:**
  - A push into the Gym ledge only bumped, where the ASM hops. That's why `pushPlayer`
    runs through `player.update`.
  - A held key carried the player onto the Gym door tile, because the next step had
    already begun.
- Tests 452 → **476**, build OK.
- **Browser:** the agent checked every row of the plan's verify list except the
  Pikachu step-aside (unit-tested) and the full Forest walk. **The user play-tested the
  forced demo and the repeat demo: "it all works as intended".** Test saves on
  :5179/:5180 were cleared and both servers stopped.
- (20,9) turned out not to be walkable; §1.2 of the plan is corrected.

**Next: A1** (item balls + trainer sight). See its slice note above. Plan first.

### 2026-09-24 (4th session: V1d plan → V1d) — Claude Opus 5.5

**V1d plan** (`bea1bce`, no code): `notes/05-v1d-plan.md`. It traces both battle types
through the ASM: `_InitBattleCommon`, `StartBattle`, `DisplayBattleMenu`
`.doSimulatedMenuInput`, `DisplayListMenuID` and `ItemUseBall`. Key results:
- **The frame counts:** HUD + 40, ▶ FIGHT 20, ▶ ITEM 20, 10 frozen, bag 3, ▶ POKé
  BALL 20, "used" text 20, then the toss.
- **The outcome rule:** PIKACHU is always caught. OLD_MAN fails only while
  `EVENT_INITIAL_CATCH_TRAINING` is set (`$63`: 3 shakes, a poof, the pic back).
- **Upstream's Pikachu catch departs in 8 places,** among them no menu, the HUD shown too
  early, and "caught" ending without an A press.
- **The normal wild catch has invented texts** and no toss animation (logged above).

**Decisions** (`821af24`): the user said "go" to all four (DECISIONS #32).

**V1d** (`1658e96`):
- `battle/catch_demo.ts` holds the rules and step list as tested data.
- `battle/catch_demo_screen.ts` is `pikachu_battle.ts`, moved with `git mv` and
  generalized to walk those steps.
- The script command is now `catchDemo` and the state `catch_demo`.
- `renderItemMenu` gained a `showCursor` option.
- New text key `BATTLE_PROF_OAK_NAME`; the regenerated data diff was that key only.
- Tests 429 → **441** (+11 catch demo, +1 extraction). Build OK.

**Browser check** (agent-driven, temporary server on :5179, test saves cleared, server
stopped). Oak's catch was staged from a Pallet Town save with no flags:
- "Wild PIKACHU / appeared!" with no HUD, then the HUD, ▶ FIGHT, ▶ ITEM, the bag
  "POKé BALL × 1 / CANCEL", ▶ POKé BALL.
- "PROF.OAK used / POKé BALL!" stays up through the throw, poof and shakes. The pic is
  hidden after the poof while the HUD stays.
- "All right! / PIKACHU was" waits for A, then "caught!", then the white screen and
  Oak's "Whew…". The walk to the lab and the lab scene follow unchanged.

The old man, through a **temporary hook** (Pallet's command switched to `OLD_MAN` /
`RATTATA`, reverted before the commit, `git diff` checked):
- With the flag set: the old man's back pic, "OLD MAN used / POKé BALL!", 3 shakes, a
  poof, the Rattata back, "Shoot! It was so / close too!", then back to the script.
- With it clear: "All right! / RATTATA was" → "caught!".
- RATTATA was marked seen (`isSeen(19)` read from the page). No console errors.

The user hasn't play-tested V1b, V1c or V1d yet.

**Next: V1e** (the real Viridian old man). See the V1 slice note above and
`notes/02-v1-plan.md` §2.5 / §3 V1e. Plan first.

### 2026-09-23 → 24 (3rd session: V1c plan → V1c) — Claude Opus 5.5

**V1c plan** (`02fb580`, plan commit, no code): `notes/04-v1c-plan.md`. It is read from the ASM
(`home/trainers.asm`, `TrainerBattleVictory`, `HandlePlayerBlackOut`,
`scroll_draw_trainer_pic.asm`, `scripts/OaksLab.asm`) and set against the upstream
code. Key results:
- **Meet music timing.** It starts when the before-battle text has finished typing,
  before the A press, because the text ends with `done`. On the sight path it starts
  at spotting (for A1).
- **Victory sequence, with frame counts.** The pic scrolls in 6 × 4 frames and stops
  at 112 px with its last column off-screen. After 40 frames comes "NAME: " + the
  won text, then the money. Every end text's first line fits in 18 characters,
  youngster5's exactly.
- **The lost-battle text is never printed** for map trainers. A loss doesn't set the
  beaten flag.
- **Three more upstream departures:**
  - the trainer fanfare plays at the *first* enemy faint;
  - losing to the lab rival blacks you out and strands the lab script;
  - map trainers get no battle transition.
- **Also found:** 5×5 enemy pics and the trainer intro pic sit 8 px right of the ASM;
  battle text isn't typed; beaten trainers should turn at random; the post-battle
  Pikachu mood floor is missing; `wRivalStarter` isn't recorded.
- **4 decisions** put to the user: the lab loss fix, recording `rivalStarter`, the
  meet-evil-trainer typo fixed in V1c, and a new slice **A5 Battle presentation**
  queued after A1.

**V1c decisions** (`439b402`): the user said "go" to all four (DECISIONS #31). A5 was
added after A1, making 35 milestones.

**V1c** (`753e50c`):
- The new module `battle/trainer_flow.ts` holds the rules as tested data.
- `Battle` runs its win/loss steps in a new `trainer_end` state.
- `main.ts` `engageTrainer()` covers talk and sight: text, meet music, battle. The
  beaten flag is set in the battle-finish handler, unless the battle was lost.
- In Oak's Lab the rival's texts are shown, a loss has no blackout, and `rivalStarter`
  is saved.
- `meeteviltrainer` extracts (47 tracks), and 2 text keys were added.

**The browser check found two upstream bugs, and both are fixed:**
- **Trainer pics loaded by display name.** Every Forest battle hung on
  `bug catcher.png`.
- **Species lookup missed pret constants.** The Lass's `NIDORAN_F` hung the game, and
  Route 22's wild Nidorans never appeared.

The user noticed the first hang while watching and asked whether it was a later slice;
it wasn't, so it was fixed here. After that, every row of the verify table passed,
including both Oak's Lab outcomes, which were staged by editing a save. Tests went
409 → **429**, and the build is OK.

Newly logged: Pokémon names show as "NIDORAN-F" where the cartridge says "NIDORAN♀",
and `startTrainerBattle` can hang silently. Both are in *Found during V1c* above.

The user hasn't play-tested V1b or V1c yet.

### 2026-09-22 (2nd session: repo check → doc fixes → V1 plan → V1a → V1b) — Claude Opus 5.5

**Repo check** (read-only, before any edit): every verifiable claim in this file
matched the repo — git (`master`, no remote, clean), ROM SHA1, the 5 refs on their
pinned commits, data counts (156 JSON / 518 PNG / 3 tilemaps / 12 maps / 57 wild /
46 music / 10 SFX), typecheck clean, **381/381**.

**Doc fixes** (`35f18f6`):
- `game/README.md` is upstream's and described the deleted ROM-upload flow. Added a
  "does not describe this copy" banner. The user asked for the fix without picking
  an option; the banner is the least destructive one — replacing it with a pointer
  or deleting it is still the user's call.
- Milestone count **34 → 33** everywhere (R1 + V1–V5 + A1–X2). The old "29" was
  already one too many. DECISIONS #26 annotated.
- CLAUDE.md SFX line: only the 10 `SFX_HEADERS` entries extract.
- Stale pointers: PLAN.md → *What the game has today*; FPS default at
  `main.ts:885`; ARCHITECTURE test baseline 381.

**V1 plan** (plan commit; no code): `notes/02-v1-plan.md`. It is based on the ASM, on
pret's sym file (read with `git show`, matches our ROM), and on a read-only ROM probe
that replicates the map extractor. Key results:
- V1 needs five slices, V1a–V1e.
- The NPC-text fallback returns wrong text for all five Forest trainers, so read
  trainer headers instead.
- The engine's trainer flow departs from the ASM in 4 ways.
- Yellow's old man runs a forced catch demo (Lv5 Rattata, the throw fails) using
  `BATTLE_TYPE_OLD_MAN`, which shares code with Oak's Pikachu catch.
- The Forest's leaving sign has a Yellow bug to keep.
- In-game trades and Route 22's fake Blue aren't in PLAN.

Also: CONVENTIONS → *Map expansion workflow* gained the sym-file recipe and the
text-fallback trap; `src/overworld/ARCHITECTURE.md` FPS lines fixed (10–200,
`p151-f`).

**Decisions** (`307601d`): the user approved the split and all six recommendations
(DECISIONS #29). A1 moved up to right after V1, A4 (in-game trades) was added —
34 milestones — and the queue was rebuilt.

**V1a** (`ca93482`, extraction only). The seven maps are extracted: trainers come
from their headers, item balls carry their item, Viridian has its north connection,
`oldmanb.png` is exported, and 11 text keys are waiting for V1b–V1e.
399/399, setup twice → byte-identical (848 files), build OK. Dev server check: all
new files are served (200); PewterCity / DiglettsCave are real 404s as intended.
What the regenerated-data diff caught:
- **Blue's house regression, avoided.** Yellow's Daisy and Town Map objects are
  item-flagged with item 0 (a stray `, 0` in `objects/BluesHouse.asm`). A plain
  `isItem` check blanked their text. Item balls are now the objects whose text is
  `PickUpItemText` (00:23ef); a test guards Blue's house.
- **Route 22's north connection** to the unextracted Route 23 is unreachable (no
  walkable step on its top row, solid border), so it can't hang the game.

**V1b plan** (no code): `notes/03-v1b-plan.md`. The research is measured, not assumed:
- **Pikachu:** the spawn states are decoded from `pikachu_follow.asm`, and which setter
  runs comes from `WarpFound2`. The branch can be inferred from tilesets because no
  Yellow indoor map warps explicitly to an outside map.
- **Facing:** the ASM never resets it on a warp (`ResetPlayerSpriteData` runs only at
  Continue / new game). Upstream forces `down`; its Mart script works around that.
- **Reachability** (flood fills): Oak's Aide and Route 2's two item balls need Cut; the
  trade house needs Diglett's Cave; the Forest can be walked end to end.
- **Bag:** it has no TM/HM items, so HM05 can't be given yet.

**V1b decisions** (`b862d0c`): the user said "go" to all three (DECISIONS #30). Oak's
Aide moves to A2, facing is kept through warps, and the door SFX rule waits for V5.

**V1b** (`ab89b9b`, engine only):
- Music, the cave palette, and 8 debug warps (the dropdown is now keyed by index).
- Facing is kept through warps.
- `pikachu/pikachu_spawn.ts` ports all three spawn setters with their full map lists,
  plus placement and facing for states 0–7. It replaces upstream's 3-case model, and
  the door step is now an ordinary step for Pikachu, as `PlayerStepOutFromDoor` is.
- NPCs with no text open no text box.

Checks: 409/409, build OK. **Browser-checked by the agent** on a temporary server:
- Route 2 door step: Pikachu in the doorway (3).
- South Gate: right, facing up (1). Forest: right (1).
- Route2Gate, northward: facing up, right (1). Southward: doorway (3).
- Trade house: the scientist's ROM text shows; the Game Boy kid opens no text box.
- Diglett's Cave entrance: CAVE palette, and the cave warp fails gracefully (only the
  expected warning).
- Viridian Pokécenter entry: facing up, Pikachu right.
- Music routes1 → cities1 → dungeon2, from the resource log. No console errors.

The user hasn't play-tested V1b yet.

**Next:** **V1c** (trainer battles per the ASM). See the V1 slice note and
`notes/02-v1-plan.md` §2.4. Plan first (CONVENTIONS → *Working with the user*).

### 2026-09-22 (setup → Phase R done: R1a, R1b, R1c) — Claude Opus 5.5

One long session: setup, discovering the lost work, a new plan, and all of
Phase R. **The game now runs with no ROM, from committed files.** Local commits
`9bf2d7d` → `de355ba` (no remote, never pushed).

**Setup + planning**
- `git init` at the root; user rule: **local-only, never pushed** (Hard rule #9,
  DECISIONS #24). The ROM stays at `game/pokeyellow.gbc`, covered by `*.gbc`;
  `pkmn-sprites/` ignored (#25). `./pull-refs.sh` cloned the 5 refs.
- Copied upstream into `game/` → it is **vanilla** (12 maps, ROM gate, PSYCHIC
  bug, 10 SFX). The July–August modified copy is gone; the user confirmed **no
  copy exists anywhere**. Audited upstream (table above).
- Plan approved: R1 → R1a/b/c; new **Phase V** rebuilds the lost work before A;
  A re-scoped (#26). Upstream `game/CLAUDE.md` folded into root `CLAUDE.md` →
  *Engine reference* and deleted. Docs reset to the verified state. User
  authorized a **local commit at the end of every slice**.

**R1a** (`dbca9d3`) — setup exports `static/` by running the browser's own
`extractRom()` in Node (`node_image_data.ts`, `static_export.ts`): 518 lossless
PNGs + 3 tilemaps + JSON mirror, byte-identical across runs. +6 tests → 381.
`tsconfig` covers `scripts/`; the Pikachu pret pixel test runs again. Probe +
pret cross-check (overworld sheets read 16× too much, padded tileset reads —
harmless, V5 trim candidate) in `notes/01-r1a-graphics-export.md`.

**R1b** (`a319b0d`) — ROM gate deleted; `publicDir: 'static'`, `base: '/'`,
`appType: 'mpa'`; title PKMN; bundle has 0 gate code. **User played it.** At the
user's request the game now **keeps running in background tabs** (worker ticker +
keys released on blur, DECISIONS #27) — user-verified.

**R1c** (`2c3fced` data, `de355ba` docs) — `data/` + `static/` committed;
`.gitattributes` (LF text; PNG/tilemap/ROM binary). **Phase R gate passed** from
a fresh clone with no ROM: byte-identical data, `npm ci` → typecheck → 334 pass /
47 skip → build → played title → Red's house → Pallet → save → reload →
CONTINUE. `game/LICENSE` removed at the user's request (#28).

**Incidents / tips:**
- The user's :5173 dev server crashed once (Vite watcher EBUSY on a transient
  `game/.zip`, not ours) — just restart it.
- Browser automation must hold keys ~100 ms (see slice notes).
- **Shell trap:** never put Markdown with backticks inside a double-quoted
  `node -e "…"` — bash runs every backtick span as a command. It happened once
  this session: every stray command failed harmlessly, and only this log entry
  got garbled (repaired). Write text to a file with the Write tool, or use a
  quoted heredoc (`<<'EOF'`).
- Not done: my own pixel-digest check of browser PNG decoding (the user took
  over testing; the fresh-clone playthrough covered it visually).

**Next:** **V1** (Route 2 + Viridian Forest). Read its slice note above; present
a plan to the user before implementing (see CONVENTIONS → *Working with the user*).

### 2026-09-05 (context refactor) — Claude Opus 5

Flattened the two-level context system to one level at the user's request. The
nested `context/agent/` pack (00–06) is gone; its content merged into the
top-level files, and root `CLAUDE.md` is now the single entry point that carries
the reading order.

- `agent/01-progress-tracker.md` → **`STATUS.md`** (this file)
- `agent/02-project-overview.md` → merged into `PROJECT.md`
- `agent/03-architecture.md` + `agent/06-ui-context.md` → merged into `ARCHITECTURE.md`
- `agent/04-code-standards.md` + `agent/05-ai-workflow-rules.md` → merged into `CONVENTIONS.md`
- `agent/00-readme.md` → dissolved into root `CLAUDE.md`
- `PROGRESS.md` → **`HISTORY.md`** (kills the PROGRESS vs progress-tracker name clash)
- `README.md` (third-party article) → `_reference-article.md`, parked
- DECISIONS #19 added; all cross-references updated.

**Then, same session — workspace layout adopted (DECISIONS #20).** Reference
repos move into a gitignored `refs/`, refreshed by `pull-refs.sh` on pinned
branches. Renames: `pokemon-yellow-typescript-main/` → `game/`,
`pokeyellow-master/` → `refs/pokeyellow/`, plus new `notes/`. Created
`pull-refs.sh`, `.gitignore`, and `README.md` with setup + credits.

**The user stated the project vision (DECISIONS #21–#23):** a local-only **1:1
replica of vanilla Yellow** on `gididaf/pokemon-yellow-typescript`, with one
eventual deviation — battle sprites randomized **per encounter** from 6 sets
(#22 supersedes "seeded per save"; #23 admits Gen 2 *art*, not content).
**Clarified 2026-09-06:** the randomizer is a year-two idea, not core. Plan
reframed as milestones; expect **1–2 years, ~700–800 sessions**.

**ROM-free promoted to Hard rule #1 / Invariant #1 (2026-09-06).** The ROM dump
was placed at `game/pokeyellow.gbc` and SHA1-verified against DECISIONS #14.

### 2026-08-04 (commit-data pivot + plan restructure) — Claude Opus 4.6

User requested zero ROM dependency in the final product. Clarified approach: ROM
is available during development for extraction; the extracted output (JSON +
PNG) gets committed. Restructured the plan from 90 slices to **29** (R1–X2).
DECISIONS #18. No production code changed. *(The code state this session
described was later lost — see 2026-09-22.)*

### 2026-08-02 (roadmap restructure) — Claude Opus 4.6

Rewrote `PLAN.md` from vague "Maps-vN" estimates to 90 numbered slices
(A1–O1). Updated tracker queue, agent onboarding files. No production code.
**Superseded 2026-08-04:** 90-slice plan replaced by 29-slice plan (R1–X2).

### 2026-07-30 (context sync) — stopped after Maps-v2 (Grok)

User asked to refresh context only (no new code). Synced handoff snapshot,
PROJECT/PLAN/agent overview, test baseline **395**, map list (30), Next Up.

### 2026-07-30 — Vanilla maps-v2: Gym / Museum / Cave / Route3 (Grok)

Added 6 maps (24→**30**): `PewterGym`, `Museum1F/2F`, `DiglettsCave`,
`DiglettsCaveRoute11`, `Route3`. Pewter east→Route3 open.

- Brock/Jr.Trainer are real trainers; **Brock victory → BADGE_1** + gym music
- Digletts Cave walkable Route2↔Route11 entrance (Route11 outdoor not yet)
- Route3 west only (north=Route4 deferred)
- typecheck clean; **395/395** tests

### 2026-07-30 — Vanilla maps-v1: open north of Viridian (Grok)

Demo old-man "thanks for playing" gate removed (path open with GOT_POKEDEX).
Extracted **12 → 24** maps. ViridianCity north → Route2; forest trainers have
`trainerClass`. typecheck clean; **391/391** tests.

### 2026-07-30 — SFX-wire call sites (Grok)

Wired extracted SFX into gameplay (typecheck + 388/388). Files: `battle.ts`,
`save_menu.ts`, `shop_menu.ts`, `player.ts`, `script_controller.ts`,
`overworld_controller.ts`.

### 2026-07-30 — SFX extraction expanded (Grok)

Walked pret `sfxheaders{1–4}.asm`. Filled `SFX_HEADERS` for UI/OW, battle,
intro + aliases. 49 SFX JSON; **388/388** tests.

### 2026-07-30 (note) — Netlify DEAD LAST (user)

User wants a fully working product before any deploy concern.

### 2026-07-30 — battle move anims v1 / P7 / OW sprites / save (Grok)

Crude category anims, final verification, sprite size fix, save harden.
All user-confirmed. Detail archived below.

### 2026-07-29 — ROM-based extraction pivot (Claude Opus 4)

User's cartridge dump verified (SHA1 match). `npm run setup pokeyellow.gbc`
emitted 156 JSON files. Tests went from unrunnable to **375/375**.
DECISIONS #14 (ROM as build-time source), #15 (ASM generators parked).

### 2026-07-27 — Initial project assessment + context system (Claude Opus 4)

Evaluated both repos; chose `pokemon-yellow-typescript-main` as base.
Established six-file context system. DECISIONS #1–#9.

## Archived STATUS sections (moved 2026-10-16)

### Completed-slice table

| Slice | Result |
|---|---|
| **A5b7g1 CP2 — implemented, awaiting Claude review (2026-10-15)** | Approved legacy retirement and F-1; +5 tests, ROM **1575/1575** and no-ROM **1445/130**, three fresh runs each; typecheck/build/diff clean. Ten real mutations caught/restored; 13 muted :5189 browser checks, no page/unexpected-resource errors. Note 54 §11; g2 not started. |
| **A5b7g1 CP1 — tests complete (2026-10-15), `4cb3f57`** | Real nurse TextBox/program fixture and pushed-hop migration; display command tests; legacy-case coverage map; seven reviewer mutations caught/restored; no-ROM census tripwires. Net +7, ROM **1570/1570** twice, no-ROM **1440/130**, 87 files; typecheck/diff clean. Note 54 §10. CP2 subsequently implemented above. |
| **A5b7f — done: Claude review passed 2026-10-15 (`notes/53-a5b7f-review.md`); user-verified 2026-10-15 (note 52 §8, START and SAVE)** | Note 52 CP1–CP5 complete: retained START and SAVE, source timings/input/cursor/return tails, real save waits and direct close. +64 tests; ROM **1563/1563**, no-ROM **1433/130**, 86 files; typecheck/build pass. Muted browser START and SAVE/reload/CONTINUE passed; 13 mutations caught. Local commits only; note 52 §§10–14. |
| **A5b5c — done: Claude review passed 2026-10-12 (`notes/36-a5b5c-review.md`); user-verified 2026-10-12 (all six play-test points). F-1 (the ▶ stays put after B) fixed in `7839e37`, checked by Claude** | Five checkpoints: 94555e5, 659ef0a, 4f632fd, f07f6c7, CP5 commit containing this result. Review fixes, 76 corrected sprite PNGs, +3/+15 menus, one-display nurse, saved first-use flag, exact hides/close, dead-command cleanup. +43 tests: **1195/1195**, no-ROM 1072/123; clean typecheck/build/diff check; setup twice identical across 869 files. Ten muted browser checks, 10 displays/6 menus, correct timings, 600-frame ball watches, zero errors. Result in note 35. Review in note 36: gates re-run (setup twice clean, 1195/1195, 1072/123, build), ASM traced, 5 own production mutations all caught |
| **A5b5b - reviewed and user-verified 2026-10-11; F-1/F-2 fixed in A5b5c CP1 (`94555e5`)** | Mom blackout fix `0d78633`, CP3 Pallet `aa4479d`, CP4 Lab `389fe5f`. Pallet/Lab source programs, retained bubbles, grouped snatch/gift/parcel, live handlers, borderless ordinary Lab displays, enabled direct Pokédex displays and alternate rival music entry. +39 tests; **1152/1152**, no-ROM 1032/120, typecheck/build clean. Full muted new-game browser sequence: 27 displays, +20/+23 glyphs, 23/15 closes, both bubbles 61, zero console errors. Result in note 32. Review/play-test passed; F-1/F-2 fixed in A5b5c CP1 |
| **A5b5a — done, Claude review passed 2026-10-11** (`notes/33-a5b5a-review.md`; user play-test after A5b5b) | CP1 foundation `0df47e8`, CP2 small handlers `25aa1c2`: registry/envelope, retained choice/bubble/healing commands, Mom/TV, Daisy, Route 1, Mart, Viridian talkers/old men. +49 tests; **1113/1113**, no-ROM 993/120, typecheck/build clean. 17 muted browser flows passed, correct +20/+23 glyphs and 9/13/23 closes, both demos finished, zero console errors. Result in note 32. Reviewed; user tests after b and c |
| **A5b4 — done, Claude review passed 2026-10-11; user-verified 2026-10-11 ("it all works perfect")** (`notes/31-a5b4-review.md`) | Four checkpoints per approved note 30/#48: additive IDs/object pictures (`2ad290d`), pure runner (`2b3403f`), retained sessions/exact close (`b2e6bd6`), pickups/call kinds (CP4 commit includes this entry). **1064/1064**, no-ROM 944/120; typecheck/build clean; setup repeated identical across 869 files. Muted isolated browser validates closes, pickup timings and both trainer paths. Result at bottom of `notes/30-a5b4-plan.md`; review and user play-test remain next |
| **A5b3 — done, Claude review passed 2026-10-11** (`notes/29-a5b3-review.md`) | Four required bank-$02 SFX extracted/preloaded, no call-site or decoder/engine change (`notes/28-a5b3-plan.md`, #47). Checkpoints `ad423e1`, `d90aaad`; 17 ROM fixtures/bank guards and 10 no-ROM interpreter tests. **1015/1015**, no-ROM 898/117; typecheck/build clean; setup twice identical (869 files, all 861 earlier files unchanged); three in-memory mutations detected; isolated :5187 browser smoke passed. A5b4 remains future work |
| **A5b2** | Map sprite-set extraction only (`notes/26-a5b2-plan.md`, DECISIONS #46). Grok implemented `map_sprite_sets.json` in `156d02c`: outdoor selectors, 12 splits including unused `$f8`, sets 1–10, 82 picture classes, Route 20's branch, current map ids and canonical sprite names. **Codex review passed 2026-10-09** (`notes/27-a5b2-review.md`); N-1 is a nonblocking test coverage follow-up. Not loaded at runtime. 988/988; no-ROM 888/100; typecheck/build clean; setup twice byte-identical (859 files unchanged, 861 after the two new JSON files) |
| **A5b1** | Text data only (`notes/24-a5b1-text-data.md`, DECISIONS #45): 539 source-matched programs, 120 map-text calls, prompt-preserving strings with compatible existing getters; medicine-results coverage and HP binding included. Claude implemented `6e79276`, corrected `8152bbd`; **Sol re-review passed 2026-10-07**, R-1/N-1/N-2 closed (`notes/25-a5b1-review.md`). 970/970; no-ROM 878/92; typecheck/build clean; setup twice byte-identical (859 files) |
| Setup | ROM verified, refs cloned, upstream copied, 375/375 — baseline commit `9bf2d7d` |
| **R1a** | setup exports `static/` via the browser's own `extractRom()`; +6 tests (381); `scripts/` now typechecked; Pikachu pret pixel test un-skipped (passes). Details: `notes/01-r1a-graphics-export.md` — commit `dbca9d3` |
| **R1b** | browser runs from `static/`: ROM gate deleted, `publicDir: 'static'`, `base: '/'`, `appType: 'mpa'`, title PKMN; build bundle has 0 gate code. **User played it with no ROM.** Plus (user request) the game keeps running in background tabs + keys released on blur — DECISIONS #27 — commit `a319b0d` |
| **R1c** ✅ **= Phase R gate** | `data/` + `static/` committed (`2c3fced`); `.gitattributes` (LF text, binary PNG/tilemap). **Fresh clone** (no ROM, no refs, no setup): byte-identical data, 0 CR bytes, `npm ci` + typecheck clean, 334 pass / 47 skip, build OK; served on :5174 → title → new game → Red's house → Pallet (0 failed requests besides expected `wild/*` + favicon 404s, no ROM requested) → **save → reload → CONTINUE works** |
| **V1a** | The 7 Route 2 / Viridian Forest maps extracted (extraction only), with trainer data read from trainer headers, item balls, the leaving-sign Yellow bug, Forest hidden items, Viridian's north connection, `oldmanb.png`, and 11 text keys for V1b–V1e. Existing maps unchanged apart from Viridian's connection (data diff checked). 399/399; setup twice → byte-identical; build OK. Details: `notes/02-v1-plan.md` → *V1a result* — commit `ca93482` |
| **V1b** | Route 2 + the Forest playable through the debug warps: music, the cave palette, 8 debug warps, the player keeping their facing through warps, Pikachu's spawn states ported from the ASM, and item balls / trade kid / Aide doing nothing when talked to. Oak's Aide moved to A2 (DECISIONS #30). 409/409; build OK. **Browser-checked by the agent** — every Pikachu placement matched the ASM table, plus music, palette, NPC text, the inert kid, the graceful cave warp and a Pokécenter regression; no console errors. Details: `notes/03-v1b-plan.md` → *Result* — commit `ab89b9b` |
| **V1c** | Trainer battles per `home/trainers.asm`: before-battle text, meet music once it has typed, the `TrainerBattleVictory` sequence (fanfare only after the last Pokémon, "defeated", pic scroll, 40 frames, "CLASS: " + end text, money), beaten only after a win, after-battle text. Oak's Lab: the rival's win text, a loss with `_Rival1WinText` and no blackout, `rivalStarter` saved; the meet-evil-trainer typo fixed; new slice A5 (DECISIONS #31). **Two upstream bugs found in the browser and fixed:** trainer pics looked up by display name (every Forest battle hung) and species lookup missing pret constants (the Lass hung; Route 22's wild Nidorans never appeared). 429/429; build OK; **browser-checked by the agent** — every step of the verify table, including both lab outcomes. Details: `notes/04-v1c-plan.md` → *Result* — commit `753e50c` |
| **V1d** | The catch demo shared by `BATTLE_TYPE_OLD_MAN` and `BATTLE_TYPE_PIKACHU` (DECISIONS #32): `battle/catch_demo.ts` (rules + step list, tested) and `battle/catch_demo_screen.ts` (upstream's `pikachu_battle.ts`, moved and generalized). The ASM's simulated FIGHT → ITEM → POKé BALL input, both outcomes by `INITIAL_CATCH_TRAINING`, no ball used, nothing added to the party, the enemy marked seen; the 8 departures in upstream's Pikachu catch fixed; script command `catchDemo`; text key `BATTLE_PROF_OAK_NAME`. 441/441; build OK; **browser-checked by the agent** — Oak's catch step by step, and the old man's both outcomes through a temporary hook (reverted). Details: `notes/05-v1d-plan.md` → *Result* — commit `1658e96` |
| **O-5** (2026-09-25) | The game ticks at the Game Boy's 59.7275 Hz (DECISIONS #33). Upstream's loop dropped leftover time, so its "50" really ran 30–48 ticks/s depending on the display. `core/tick_clock.ts` keeps the remainder. +11 tests (452); build OK; **measured in the browser at 59.70 ticks/s** (240 Hz display, where upstream gave 48) — commit `de5e0ba` |
| **V1e** ✅ **= V1 done** | The real Viridian old men per `scripts/ViridianCity.asm` (`story/viridian_city.ts`): the city's script state saved per map (`mapScripts`, DECISIONS #34) with the Gym-door quirk kept; the sleeping man's push from any side and on talk; the forced demo that fails, then the walk-away (right + down 6 off x = 19, Pikachu stepping aside when on the right); the Mart spawning the walking old man; the repeat demo (caught); the locked Gym door, where the push hops the ledge. Both demo gates deleted (+`oldman2`, oldman1's `walkDir`, Route 22 without NPCs). New script commands `clearFlag`, `setMapScript`, `pushPlayer` (a simulated joypad step through `player.update`) and `movePikachu`. 476/476; build OK. **Browser-checked by the agent and user-verified** ("it all works as intended"). Details: `notes/06-v1e-plan.md` → *Result* — commit `85b2c6b` |
| **A6a** | The overworld on the ASM's 2-frame pass (DECISIONS #36, `overworld/walk_pace.ts`): player and Pikachu 16 frames a step (measured 15.99), NPCs 34, Yellow's fast codes 18, in-step walks 16; the turn rule, mirrored walk frames, the ledge jump table, the joypad read on standing passes, held-key triggers fixed; every cutscene walk re-timed with its ASM mode. 502/502; build OK. **User-verified 2026-10-01: all 8 browser checks** (Oak's walk after the leg fix, the lab intro/shove/exit, a Route 1 ledge, the Mart, the nurse, the old man's walk-away, NPC and Pikachu pace, START across a step): "all 8 points work perfectly". Details: `notes/08-a6-plan.md` → *Progress* — commit `5ee0d55` |
| **A6b** | The order inside an overworld pass (DECISIONS #37): map scripts on every standing pass before the joypad read (Pallet y = 0, the lab y = 6); the step-end order count → Pikachu → encounter → warp → connection (`overworld/step_end.ts`); the walking happiness coin flip and mood drift; the encounter gates (turn roll, the 2-calm-step cooldown, no roll on a hop or door exit, indoor/FOREST/water rules); the sprite window with pop-in, sprites hidden whole under menus and text boxes; NPCs keep facing you, fixed-facing ones turn back after a random delay. **Implemented by Sol 6.1 (Codex), reviewed by Claude** (`notes/09-a6b-review.md`, R-1 menu row and N-1 fixed). 570/570; build OK. **User-verified 2026-10-01: all 7 browser checks** ("all working well"). Details: `notes/08-a6-plan.md` §5 + *A6b result* — commits `eac3dd3`, review `2e9e765` |
| **A6c** | NPC wandering and turning (`notes/10-a6c-plan.md`, planned by Codex, implemented by Claude): Yellow's direction byte, displacement bytes, screen edges and pixel sprite collisions (`overworld/sprite_collision.ts`); STAY/NONE turning; beaten trainers turning at random; Pikachu's idle glances and four antics (`pikachu/pikachu_idle.ts`); turning into Pikachu blocks seven checks; boxes and menus hide or reset Pikachu as `DisplayTextIDInit` does. Codex reviews R-1–R-3 fixed; R-3 checked in Claude's A6d review. 705/705 at the time. **User-verified 2026-10-04** (with A6d: "it is all looking good") — commits `22919a7`, revisions `4d3c407`, `9897020` |
| **A6d** | The ledge hop (`notes/12-a6d-plan.md`, planned by Claude, **implemented by Sol (Codex)**, reviewed by Claude, `notes/13-a6d-review.md`): the ROM shadow (`/gfx/overworld/shadow.png`, 520 images), the landing pass's extra `UpdateSprites` before `Delay3`, and Yellow's follow-command buffer (`pikachu/follow_buffer.ts`) replacing upstream's position buffer: Pikachu waits on the takeoff tile and crosses the ledge in one flat 2-tile move on the next step; fast catch-up only at 3+ behind; no teleport; refreshes after the Pokécenter and the step-aside (DECISIONS #38). 729/729; build OK; ordinary-following trace unchanged (hash reproduced on pre-A6d code). **User-verified 2026-10-04** ("it works, it is all looking good") — commit `4166071`, review `218b321` |
| **A1a** | The item jingles as music-mode SFX on one shared channel interpreter (`notes/16-a1a-plan.md`, DECISIONS #40, planned and implemented by Claude, independently reviewed by Codex: `notes/17-a1a-review.md`, no actionable findings). It follows `engine_1.asm` for the music too: the wave channel an octave lower, perfect pitch, vibrato with rate 0, silent rests, the SFX tempo, the SFX hand-off. `isSoundFinished()` answers `WaitForSoundToFinish`. 812/812; build OK; agent-checked in the browser. **User-verified 2026-10-06** ("very high fidelity and very close to what the game boy sounds like") — commits `3a4fabb`, `732aa12`, `75166d2`, `8b1691e` |
| **A1b** | Item balls and hidden items (`notes/18-a1b-plan.md`, DECISIONS #41, planned by Claude, **implemented by Sol (Codex)**, reviewed by Claude: `notes/19-a1b-review.md`, no blocking findings). Balls per `PickUpItem` (hidden with the box, `get_item1`, the box closes after the jingle and A's release) and saved as `hiddenObjects`; hidden items per `HiddenItems` (text before the give, `get_item2`, the cartridge's full-bag waits); Route 1's Potion sample with its flag-first quirk; `AddItemToInventory_`'s exact rule (first-overflow refusal kept), removal by selected slot, add-before-charge in the Mart and PC, verbatim bag restore; the ASM's interaction order. 864/864; no-ROM 783 pass / 81 skip; build OK. **User-verified 2026-10-06** ("everything works perfectly") — commits `788ba6b`, `2e787c3`, `f7d49ca`, `ba291ea`, review `c259981` |
| **A1c** ✅ **= A1 done** | Trainer sight (`notes/20-a1c-plan.md`, DECISIONS #43; planned and implemented by Claude, **user-verified 2026-10-06**: "it all works well"). The Forest's map script runs `TrainerEngage` on standing passes ($fc quirk, pop-in), with the meet music at spotting, EmotionBubble (61 frames), the `MoveSprite` walk-up, `wJoyIgnore`/`BIT_SEEN_BY_TRAINER`, `EndTrainerBattle`'s pass and `EnterMap`'s `UpdateSprites` after battles. 910/910 (`58dafde`, `b20c237`, `7de5156`). The hop-midpoint `RunMapScript` → V4 behind a tripwire |
| **A5a** | The text printer (`notes/21-a5-plan.md`, DECISIONS #44; Sol implemented, Claude reviewed `notes/22-a5a-review.md`, **user-verified 2026-10-06**). `PlaceString`'s timing (place-then-delay letters, `cont`'s 3 frames and 5 + 5 scroll, `para`'s clear + 20, `prompt`/`done`), single-tile contractions, the bottom-third BG transfer, and `DisplayTextID`'s opening (box at +4, letters at +20) and silent A-release ending for NPC, sign and trainer texts. Map texts carry `<PROMPT>`. 963/963 |
| **A6e** ✅ **= A6 done** | Pikachu's scripted movement (`notes/14-a6e-plan.md`, planned by Codex, implemented by Claude, reviewed by Codex: `notes/15-a6e-review.md`): Yellow's `ApplyPikachuMovementData` ported whole (`pikachu/pikachu_movement.ts`, data `pikachu_movement.json`), in the cartridge's byte coordinates. It drives Viridian's step-aside, Oak's Lab's step after "GRAMPS!" (missing before), the nurse's walk and the heal's Pikachu handoffs, and the emotion preludes 4/6/7/9/13 before the portrait. Corrections to the plan and the review fixes: STATUS → *Found during A6e*. 776/776; build OK. **User-verified 2026-10-05** (play-tested after Codex's re-review passed) — commits `0a89455`, `1a7231f`, `89f620b`, revision `128d7f8`, reviews `0c51262`, `18732e7` |

The July–August work (P1…Maps-v2) is listed in `HISTORY.md` → *Prior work — code
lost*. It does not count here.

### Old *In progress* handoffs

**A5b7g2 reviewed by Claude: passes, no required fix (`notes/56-a5b7g2-review.md`).** Gates re-run: ROM
1604/1604 (twice), no-ROM 1474/130, typecheck/build clean. 9 reviewer mutations: 7 caught, 2 survived as
test gaps (N-1: the seen-by-trainer gate for program events, unreachable today; N-2: the TV's routing test,
for the next `story/` slice). Grok's DOJO finding is confirmed: the Lab shelf is DOJO $1D.
**Next: the user's play-test (note 56 §5, which also covers g1's F-1). Then A5b7g, and so A5b7, is done.
Next slice after that: the StatusScreen port (#58), Claude plans.**

**A5b7g2 CP2 implemented by Grok, 2026-10-15, awaiting Claude's review** (note 54 §13). Commits: data
`8fd0111`, builder `13fd2f6`, bookshelves `269d8c2`, tests in this commit. ROM **1604/1604** (89
files), no-ROM **1474/130**, typecheck/build clean. Five mutations caught and restored. Not run in the
browser. **Stop for review. No later checkpoint started.** The user's F-1 glance from g1 is still open.

**A5b7g2 CP1 (data) done by Claude, 2026-10-15** (Sol was out of usage; note 54 §12). There are 28 new
hidden-event and bookshelf programs (roots checked in the ROM). The 8 plain hidden events carry an additive
`program`. Setup twice byte-identical; additions only. ROM **1577/1577**, no-ROM **1447/130**, typecheck/build
clean. No runtime change. The right poster's `scriptId` was left for CP2.
**Next was CP2** (note 54 §5.3, + note 55 N-2/N-3). The user's F-1 glance from g1 is still open.

**A5b7g1 reviewed by Claude: passes, no required fix (`notes/55-a5b7g1-review.md`).** Gates re-run: ROM
1575/1575 (twice), no-ROM 1445/130, typecheck/build clean. 7 reviewer mutations: 5 caught; 2 survived, both
pre-existing test gaps (N-2: the Lab guard's Delay3; N-3: the borderless free-movement NPC opening), which
go to g2. N-1: `pikachuFacing` restore checks `displaySession` without `active`, which is latent.
**Next: the user's F-1 glance (note 54 §8, g1), then Sol implements A5b7g2 CP1** (note 54 §5.2), adding
N-2/N-3 in CP2.

**Sol's handoff (A5b7g1 implemented, Codex/Sol, 2026-10-15)** (note 54 §§10/11, DECISIONS #60).
CP1 `4cb3f57`; CP2 retires the dead legacy paths and fixes visible Lab hidden text (F-1).
ROM **1575/1575**, no-ROM **1445/130**, three fresh processes each; typecheck/build/diff clean.
Ten production mutations caught and restored; 13 muted browser checks passed with no page/unexpected
resource errors. Owned :5189 stopped; :5173 untouched. **Stop for g1 review. No g2 started.**

**A5b7f is done: implemented by Sol, reviewed by Claude (`notes/53-a5b7f-review.md`, passes, no required fix),
user play-test passed 2026-10-15 ("playtested and everything works well", note 52 §8, START and SAVE).
A5b7g is now approved; CP1 result above.** A5b7f gates: ROM 1563/1563, no-ROM 1433/130, typecheck/build clean.
I traced START and SAVE against the ASM and caught 26 of 31 non-equivalent reviewer mutations.
- **N-1:** five lines have no test. The most important is the text-box dismiss at the end of `menu_closing`:
  without it the message box stays active after SAVE. One assertion catches it. The others: the 10 frames before
  the save sound, the bag's retained scanout through main, and two 1–2-frame message-box details. For A5b7g
  with note 51 N-1.
- **N-2:** the dex/OPTION returns switch to START all at once instead of by thirds (≤3 frames) → J2.
- **N-3:** the STATUS *Completed* table row was above its separator; fixed in the review commit.

**Sol's handoff (A5b7f implemented, 2026-10-15):**
All five checkpoints in approved note 52 are complete. The user lifted the
checkpoint stops during CP3 and authorized completion through CP5.
Commits: CP1 `ab1303d` (Claude check `5ea60c7`), CP2 `0da8f48`, CP3 `86a990e`,
CP4 `d413bf2`, CP5 this handoff commit. Results: note 52 sections 10-14.

START now uses the retained source session: +20/+23 opening, raw shared
cursor, source wrap/Delay3/hollow arrows, silent START, private five-frame
close copy and all CGB submenu return tails. SAVE uses the retained info box,
typed messages, left YES/NO, write once at answer+25, exact waits and real
sound completion, Buffer2/held-A/direct close without START redisplay.
Both legacy classes are retired; no save-data schema or generated changes.

Final ROM **1563/1563** (86 files), no-ROM **1433 pass / 130 skip**,
typecheck/build clean. Main dispatch/storage and muted :5187 browser passed:
all START entries/returns/closes; SAVE YES, real jingle wait, automatic close,
reload/title/CONTINUE at the saved position, NO without write, held-A release,
walking afterward. Thirteen temporary production mutations caught/restored
(four START, nine SAVE). Fresh browser storage only; :5173 save untouched.

Review and play-test have since passed (above). A5b7g1 is implemented above; g2 has not
started. Remaining approved gaps: player-ID/older-file question A4, battle's
shared cursor A5c, submenu internals/play-time frame counter J2, save-bank
lookup V5. All requested A5b7f implementation is complete.

**A5b7e is done: implemented by Sol, reviewed by Claude (`notes/51-a5b7e-review.md`, passes), user play-test passed 2026-10-15 ("checked and passed", note 49 §8). A5b7f is implemented (handoff above).**
Gates re-run: ROM 1499/1499, no-ROM 1369/130, typecheck/build clean. I traced `bills_pc.ts` line by line
against `bills_pc.asm`/ChangeBox/`list_menu.asm` and caught 9 of 11 non-equivalent reviewer mutations.
- **N-1:** two layout lines have no assertion (the submenu label, the empty bottom box).
- **N-2:** a stale pending-spawn flag after a visit with an ineligible starter; harmless today.
- **N-3:** the existing mood-nudge gap.

**A5b7e implemented - awaiting Claude review and user play-test (2026-10-15).**
All five checkpoints in approved note 49 are implemented. The user lifted the
intermediate stop gates and authorized CP3-CP5, including the narrow follower
lifecycle adapter. Commits: CP1 `a7a6edd`, CP2 `2c2f3de`, CP3 `837a4fe`,
CP4 `af55f0c`, CP5 this handoff commit. Results: note 49 sections 10-14.

Bill's PC now uses the retained six-entry menu, source mon/submenus,
withdraw/deposit/release and starter rules, shared existing STATS pages,
Change Box with its real save, and PRINT BOX's empty-box prompt. F-1/F-2 and
N-4 are closed. The legacy Bill menu/bridge is deleted. The follower reconciles
party/HP at result PrintText before glyphs, with coverage and pending status-0
initialization separate. Healthy withdrawal uses settled state 0; fainted
withdrawal stays absent. CP1's dependency is implemented, with tests.

Final ROM **1499/1499** (83 files), no-ROM **1369 pass / 130 skip**,
strict typecheck/build clean, 11 production mutations caught/restored, and a
muted isolated browser run covering all section 8 checks plus follower and
save/reload. No generated changes after CP1; user's :5173 save untouched.
Approved gaps remain: cries/PCM and printer screen (J2), full StatusScreen
port (after A5b7g), following-disabled scene (V2), OT starter identity (A4),
and the existing box/stat-exp data model (J2). Do not mark user-verified yet.
**Next: Claude reviews the implementation; user play-tests note 49 section 8.
Then A5b7f, not started here.**

**A5b7d is done — implemented by Codex/Sol, reviewed by Claude (`notes/48-a5b7d-review.md`), user-verified 2026-10-15.**
All five checkpoints of note 47 implemented: CP1 `ef19db9`, CP2 `044618c`,
CP3 `b0dd53f`, CP4 `85a461b`, CP5 (this handoff commit). Red's item PC,
Pokécenter PC with nested items/Oak/Bill bridge, legacy retirement and shared
opaque tile painting. **1433/1433** with ROM, **1303 pass / 130 skip** without;
typecheck/build clean. Setup twice identical across 873 generated files; only
the text-program mirrors changed. Eight production mutations caught/restored.
Result and browser evidence: note 47 §9. **Reviewed by Claude (`notes/48-a5b7d-review.md`): passes
with one small required fix, F-1** (the main menu keeps a filled ▶ after a choice, and B in the item PC
keeps ▶; ours draws ▷). Gates re-run: 1433/1433, no-ROM 1303/130, typecheck/build/diff check clean;
Claude's 7 extra mutations all caught. N-1: the opaque tile painter also changes the Mart and bag
drawing, so glance at both in the play-test. **F-1 fixed by Claude at the user's request** (3 tests; 2 fail without the fix): 1436/1436, no-ROM 1306/130, typecheck/build/diff check clean. **User play-test passed 2026-10-15 ("all works well", note 47 §7 plus the Mart and bag). A5b7d is done.**
**A5b7e is done (above).**

**A5b7a is done — reviewed (Claude, `notes/40-a5b7a-review.md`, passed) and user-verified 2026-10-14**
(all three checks: PC `'s`, YES/NO, a battle contraction). Gates re-run from `936bcee`: 1299/1299,
no-ROM 1176/123, typecheck/build/diff check clean; six reviewer mutations caught and reverted.
**A5b7b is implemented (Grok, 2026-10-14) and reviewed (Claude, `notes/42-a5b7b-review.md`): passed
with one small required fix.** Gates re-run from `472f902`: 1330/1330, no-ROM 1207/123, typecheck/build/
diff check clean; 8 of 10 reviewer mutations caught (two survivors are test gaps N-1/N-2, the code is
right). **F-1 fixed by Claude at the user's request** (A+B in one frame on BUY/SELL/QUIT now takes A, as
`DoBuySellQuitMenu`; regression test added): ROM 1331/1331, no-ROM 1208/123, typecheck/build clean.
**User play-test passed 2026-10-14 (all seven checks, note 41 §7). A5b7b is done.** **A5b7c1 is implemented by Grok (2026-10-15, note 43 §3 and §3.6) and reviewed (Claude, `notes/44-a5b7c1-review.md`): passed, no code fix.** Gates re-run: 1348/1348, no-ROM 1225/123, typecheck/build clean; 8 of 10 reviewer mutations caught (one equivalent; N-1 saved-cursor and N-2 toss-quantity tests missing). **F-1:** OAK's PARCEL should print "This isn't yours to use!" (`ItemUseNotYoursToUse`; a plan error, the program isn't extracted) → fix in A5b7c2's data checkpoint. **User play-test passed 2026-10-15 ("all works fine", note 43 §3.5). A5b7c1 is done.** **A5b7c2 is implemented by Grok (2026-10-15, `notes/45-a5b7c2-plan.md`) and reviewed (Claude, `notes/46-a5b7c2-review.md`): two required fixes before the play-test.** CP1 `a21d718`, CP2 `188a4a4`, CP3 `eb0d1f3`, CP4 `784607e`, CP5 `461d43f`. Gates re-run: ROM **1386/1386** (74 files), no-ROM **1256/130**, typecheck/build clean, setup re-run no diff; 11 of 12 reviewer mutations caught. **F-1** (input read every third frame, presses dropped), **F-2** (bar recolored mid-animation) and **F-3** (found while fixing: the result message never printed, because nothing ticked the text box) **are fixed by Claude at the user's request**, with N-1/N-2. ROM 1393/1393, no-ROM 1263/130, typecheck/build clean. **User play-test passed 2026-10-15 ("it all works well", note 45 Verification). A5b7c2 is done, and with it A5b7c.** **A5b7d planned by Claude (`notes/47-a5b7d-plan.md`) and approved (O-26 → DECISIONS #57, "yes to all"); Sol implements next** (Red's item PC, the Pokécenter PC, the nested item PC; Oak's PC entry; Bill's PC as a bridge until A5b7e). Carry-overs: note 46 N-3 (cures clear `status` only, harmless) and N-4 (the saved party cursor is clamped; revisit when the PC can shrink the party). Do not start the healing machine. F-2 is fixed in CP1: emptying a slot zeroes the shared list cursors, including the Mart's saved scroll.

*Implementation:* Note 39
§4's three checkpoints under DECISIONS #52: CP1 `1cfead5` numeric printing,
CP2 `943ac7f` standalone no-delay text, CP3 common glyphs and final handoff (this
session's last commit). ROM 1299/1299; no-ROM 1176/123; typecheck/build clean.
Targeted isolated Chrome rendering smoke passed; three production mutations
caught and reverted. Result and user-check instructions at the bottom of note 39.
No A5b7b or later caller migration started.

**A5b7 plan approved (Codex plan, 2026-10-14; DECISIONS #52):** `notes/39-a5b7-plan.md`.
A5b7a–g: shared number/glyph execution, Mart, field items/party, item/top-level PCs,
Bill's PC, save, then legacy cleanup/A6e real-session fixture migration (note 36 N-3).
**A5b7a ✅** (note 39 §4/result, `notes/40-a5b7a-review.md`, user-verified 2026-10-14);
the user play-tests visible slices afterward. Full storage mechanics, Change
Box autosave, new medicine SFX/effects and the observed Full Restore branch bug are
approved exclusions, with homes in note 39 §6. **A5b6's gate approved by the user
2026-10-14 — A5b6 is done.**

**A5b6 reviewed (Grok, `notes/38-a5b6-review.md`, passed, 2026-10-13). No required fix.** Implementation: Claude CP1-CP3 `ad397c2`, `8ba1f11`, `3689f23`; Codex/Sol CP4 `3aa238c`, CP5 `2f08803`. Gates re-run from `2f08803`: ROM 1242/1242 (64 files), no-ROM 1119/123, typecheck/build/diff check clean. Six production mutations caught and reverted. N-1: no committed test fails if the Town Map return latch is removed; the trace and note 37's browser smoke still hold. **Stop for the user play-test** (note 38; A = Z, B = X, `http://127.0.0.1:5173/`). No A5b7, healing-machine or intro-animation work started.

**A5b5c implemented (Codex/Sol, 2026-10-12) and reviewed (Claude, `notes/36-a5b5c-review.md`, passed).** Five checkpoints per approved note 35/#50: 94555e5 (review fixes), 659ef0a (BUG-1), 4f632fd (menu), f07f6c7 (nurse), 34f8947 (cleanup). **User play-test passed 2026-10-12: all six points** (Forest balls, Lab facing/music, first/second/CANCEL nurse, caterpillar YES/NO). **F-1 fixed in `7839e37`; Claude checked it 2026-10-12 (note 36, closed). A5b5c is done.** B selects NO while preserving the drawn cursor for all 15 frames; the regression checks each frame and retains A+B selecting NO. Menus architecture and N-4's opening-update comment corrected. N-2 test removals deferred (optional, on a later touch of those files); baseline remains 1195/1195, no-ROM 1072/123. N-3 goes into the A5b7 plan. **Next: Claude plans A5b6** (school notebook, Town Map, Oak's speech; `notes/23-a5b-plan.md`); nothing claimed yet.

**A5b5b implemented, reviewed (note 34) and user-verified. F-1/F-2 fixed in CP1 (94555e5); BUG-1 fixed in CP2 (659ef0a).** History: First fixed Mom's blackout destination (`0d78633`),
then CP3 Pallet (`aa4479d`) and CP4 Lab (`389fe5f`), per note
32/#49. Final gates: 1152/1152, no-ROM 1032/120, typecheck/build/diff check clean;
27 displays in a full muted browser sequence, zero console errors. Result at
the bottom of note 32. The user's fresh-game play-test (Pallet grass to the Pokédex) passed.

A5b3 is done: Sol implemented, Claude's review passed 2026-10-11
(`notes/29-a5b3-review.md`, no blocking findings; gates re-run: 1015/1015, no-ROM 898/117,
setup twice clean, own mutation caught by 4 tests). Plan and result: `notes/28-a5b3-plan.md`;
DECISIONS #47. The four bank-$02 sounds are extracted/preloaded and tested; bank-$1f
variants stay deferred behind the guard.

**A5b4 is done:** Sol implemented in four checkpoints (`2ad290d`, `2b3403f`, `b2e6bd6`,
`905959b`), and Claude's review passed 2026-10-11 (`notes/31-a5b4-review.md`, no blocking findings;
gates re-run: 1064/1064, no-ROM 944/120, build clean, setup twice clean, own mutation caught by 5 tests).
Plan and result: `notes/30-a5b4-plan.md`; DECISIONS #48. **User-verified 2026-10-11** ("i tested, it all works perfect").
Non-blocking carry-overs: N-1 `waitButton` blanks tile (18,16) (fixed in A5b6 CP1, ad397c2);
N-2 resolved in A5b5a (START/text closes share map plus script NPCs; current
script NPCs are removed before their scenes end). **A5b5 (the existing story handlers) is approved; A5b5a done and reviewed** (2026-10-11; DECISIONS #49):
`notes/32-a5b5-plan.md`, split into A5b5a (handler foundation + small handlers), A5b5b (Pallet + Oak's Lab) and
A5b5c (the nurse + cleanup), in that order. **Sol implements each, Claude reviews each** (`notes/33-a5b5a-review.md`
first); the user play-tests after b and c.

**A5b5a implemented - Codex/Sol, 2026-10-11.** CP1 foundation `0df47e8`;
CP2 small handlers and verification are in `25aa1c2`.
ROM 1113/1113; no-ROM 993 pass / 120 skip; typecheck/build clean; 17 muted
browser flows pass, zero console errors. Result at bottom of note 32.
Claude's `notes/33-a5b5a-review.md` passed. Mom's N-1 is fixed in `0d78633`;
N-2/N-3 are documented in story architecture. A5b5b is implemented above;
A5b5c is reviewed and user-verified; F-1 fixed and checked (`7839e37`). A5b5 is done.

**A5b1 is done: Claude implemented, Sol re-review passed 2026-10-07
(`notes/25-a5b1-review.md`); R-1, N-1 and N-2 closed in `8152bbd`.**
A5b's plan is `notes/23-a5b-plan.md`, approved as DECISIONS #45: seven increments,
with the A5b2 assignment now amended by #46. A5b1 is data only (`notes/24-a5b1-text-data.md`):
`text_programs.json` (539 programs since the review fix, + every map text's DisplayTextID call), `<PROMPT>` kept
in `game_text.json` with a `getText()` strip, and the consumer inventory. The runtime is
unchanged. The fix added the eight medicine results with an `hpDifference` binding, a
coverage test read from the ASM pointer table, the inventory rows, the cry comment and
the note's counts. **A5b2 passed Codex review**
(`notes/27-a5b2-review.md`).

**A5a is done** (Sol implemented, Claude reviewed in `notes/22-a5a-review.md`,
user-verified 2026-10-06: "it all runs well").

A1c is done, and with it milestone A1 (user-verified 2026-10-06: "it all works well").

*A1c, for the record:* implemented by Claude at the user's request ("pls implement
yourself"; DECISIONS #43). Commits `58dafde` (checkpoint 1) and `b20c237` (checkpoints 2–3), then the
docs commit. **910/910**; no-ROM 828 pass, 82 skip; typecheck/build clean. A browser smoke test
on a spare port passed: youngster4 adjacent, youngster2's "!" and 3-step walk-up, a win, moving
again. The user's play-test (`notes/20-a1c-plan.md` §7) **passed**.

### Old queue table (before 2026-10-16)

Claim the top one, finish it, verify, **commit locally**, log it, stop. Full
roadmap in `PLAN.md`.

| # | Slice | Phase | Notes |
|---|---|---|---|
| 1 | **A5** Battle and text presentation | A | **Milestone order approved: `notes/21-a5-plan.md`, DECISIONS #44.** A5a ✅ (user-verified). **A5b: `notes/23-a5b-plan.md`, approved (DECISIONS #45); A5b1 ✅, Sol re-review passed (`notes/25-a5b1-review.md`); A5b2 ✅, Codex review passed (`notes/27-a5b2-review.md`, #46). A5b3 ✅, Claude review passed (`notes/29-a5b3-review.md`, #47). A5b4 ✅, Claude review passed (`notes/31-a5b4-review.md`, #48), user-verified. Next: A5b5 — planned and approved (`notes/32-a5b5-plan.md`, #49): A5b5a reviewed; A5b5b implemented, reviewed (note 34) and user-verified; A5b5c implemented, reviewed (`notes/36-a5b5c-review.md`, passed) and user-verified; F-1 fixed and checked (`7839e37`). A5b6 ✅ (`notes/38-a5b6-review.md`, #51; user-approved 2026-10-14). **Now A5b7, approved as A5b7a–g (`notes/39-a5b7-plan.md`, #52): A5b7a ✅ (`notes/40-a5b7a-review.md`, user-verified 2026-10-14); A5b7b ✅ (user-verified 2026-10-14). A5b7c ✅ (c1 `notes/44-a5b7c1-review.md`, c2 `notes/46-a5b7c2-review.md`, user-verified 2026-10-15). A5b7d ✅ (`notes/48-a5b7d-review.md`, user-verified 2026-10-15). A5b7e ✅ (`notes/51-a5b7e-review.md`, user-verified 2026-10-15). A5b7f ✅ (`notes/53-a5b7f-review.md`, user-verified 2026-10-15). **A5b7g approved (`notes/54-a5b7g-plan.md`, #60): g1 reviewed (note 55); g2 CP2 implemented and awaiting review (note 54 §13), then the StatusScreen port (#58)**, then the healing-machine slice (#50), **then V2 (DECISIONS #55)**, then the intro-animation slice (#51) and A5c–A5f, before V3.** Order: A5a printer/map texts → A5b script/menu texts → A5c battle text → A5d transitions → A5e intros/pic positions → A5f wild catch. Inputs: #31/#41, `04-v1c-plan.md` §1.6, `05-v1d-plan.md` §1.4/§4, `18-a1b-plan.md` §8, `19-a1b-review.md` N-1 |
| 2 | **V2** Pewter City | V | **Moved up (DECISIONS #55): right after A5b7 and the healing machine, before A5c–A5f.** city + Pokécenter, Mart, 2 houses; extract the `script_mart` inventories (note 41 §6). **Preceded by the Pokécenter healing-machine slice** (DECISIONS #50: fade-out, `SFX_HEALING_MACHINE`, healed jingle, flashes, heal order; `notes/35-a5b5c-plan.md` §9) |
| 3 | **V3** Pewter Gym + Museum | V | Brock → BADGE_1; Museum 1F/2F |
| 4 | **V4** Diglett's Cave + Route 3 | V | cave, Route 11 entrance building, Route 3. **Also (DECISIONS #43):** `RunMapScript` at the hop midpoint and the mid-hop spotting aftermath (`notes/20-a1c-plan.md` §1.8); `trainer_tripwires.test.ts` fails first |
| 5 | **V5** Recovered fixes | V | PSYCHIC chart, SFX catch-up, species display names (`MonsterNames`, DECISIONS #44), the padded tileset-read trim (the overworld-sheet trim moved to A5b5c, #50); the map-object audit, incl. hidden-event facing (`notes/19-a1b-review.md` N-2); Pallet's and Oak's Lab's "!" onto `EmotionBubble` (61 frames, `notes/20-a1c-plan.md` §8; now planned in A5b) |

After that come A2, A3 and A4 (in-game trades, new, DECISIONS #29), then Phase B.

**Phase R gate — ✅ passed 2026-09-22:** a fresh clone plays with no ROM and no
setup. From now on every data change is: edit extractor → `npm run setup
pokeyellow.gbc` → commit the regenerated `data/` + `static/` with the code (the
"static/ is up to date" test catches a forgotten re-run).

### Resolved open questions

- ~~**O-29: A5b7g plan**~~ ✅ **Resolved 2026-10-15 → DECISIONS #60** ("yea to all"). Was (`notes/54-a5b7g-plan.md` §9):
  1. Split A5b7g into **g1** (retire the dead legacy text paths, migrate the A6e fixture and the legacy
     tests, add notes 51/53 N-1's seven assertions, census tripwires, F-1, the final A5b regression), then
     **g2** (hidden events and bookshelves as extracted programs: the Lab's right poster branch, the
     bookshelf facing-up one-tile rule, `BookOrSculptureText`'s +23), before the StatusScreen port.
  2. g2's data: additive hidden-event `program` fields, a script id for the right poster, and all four
     bookshelf predefs extracted.
  3. The bookshelf facing rule goes in g2; the hidden-event facing filter stays V5.
  4. Sol implements (two checkpoints each); Claude reviews; the user play-tests g2.
- ~~**O-28: A5b7f plan**~~ ✅ **Resolved 2026-10-15 → DECISIONS #59** ("yes to all"). Was (`notes/52-a5b7f-plan.md` §9):
  1. Split it into A5b7f1 (the START menu) and A5b7f2 (SAVE), each reviewed and play-tested.
  2. The older-file question stays out until A4 adds a player ID.
  3. START gets the shared cursor byte now; battle wires it in A5c.
  4. Sol implements: f1 in three checkpoints, then f2 in two.
- ~~**O-27: A5b7e plan**~~ ✅ **Resolved 2026-10-15 → DECISIONS #58** (yes to all five; Sol implements;
  the StatusScreen port is its own slice right after A5b7g). Was (`notes/49-a5b7e-plan.md` §9):
  1. Build the cartridge's Bill's PC now, with only the note's §7 gaps. This amends #52's limits; PLAN's E2
     drops Bill's PC and DEPOSITED.
  2. Change Box saves the game through the START → SAVE write.
  3. STATS shows the existing stats pages, moved into a shared module. Where does the StatusScreen port go:
     its own slice right after A5b7g (recommended), or with A5c?
  4. Fix F-1 (text speed after lists, A5b7d) and F-2 (capitalized names, A5b7c2); keep the party cursor clamp
     as a guard and close N-4.
  5. One slice, five checkpoints; Sol or Grok implements.
- ~~**O-26: A5b7d plan**~~ ✅ **Resolved 2026-10-15 → DECISIONS #57** ("yes to all"). Was (`notes/47-a5b7d-plan.md` §8):
  (1) show PROF.OAK's PC and run its YES/NO flow, with DisplayDexRating as the existing approved gap;
  (2) Bill's PC stays a bridge until A5b7e;
  (3) generalize the Mart's session slot for both sessions;
  (4) one slice, five checkpoints; implementer Sol (the user's pick).
- ~~**O-25: A5b7c plan**~~ ✅ **Resolved 2026-10-14 → DECISIONS #56** ("yes to all"). Was (`notes/43-a5b7c-plan.md` §8): (1) split into A5b7c1 (bag
  list, USE/TOSS, toss, NotTime, Town Map back to the bag, note 42 N-1–N-3) and A5b7c2 (party-menu
  prompts, ItemUseMedicine, HP bar); (2) extract SFX_HEAL_HP/HEAL_AILMENT in c2; (3) port UpdateHPBar2 as
  a shared module; (4) fix the TS Full Restore branch; (5) Sol implements, Claude reviews, user play-tests.
  No answer assumed.
- ~~**O-24: A5b7b plan**~~ ✅ **Resolved 2026-10-14 → DECISIONS #54** ("yes to all"). Was (`notes/41-a5b7b-plan.md` §9):
  (1) port `DisplayListMenuID` + `DisplayChooseQuantityMenu` now as shared modules
  (amends #52's J2 placement for this list menu only); (2) include the SELECT item swap;
  (3) a screen tile model with Buffer1 save/restore (incl. the message box) and the
  auto-transfer switch; (4) the list's ▼ steady, its CPU-paced blink → J2; (5) one slice,
  six checkpoints, Sol or Grok implements, Claude reviews, user play-tests.
  No answer assumed.
- ~~**O-23: A5b7 plan**~~ ✅ **Resolved 2026-10-14 → DECISIONS #52** (all approved, incl. A5b6's gate). Was (`notes/39-a5b7-plan.md` §8):
  (1) recommend seven implementation slices A5b7a–g, starting with only A5b7a
  (number printing, standalone no-delay calls, common glyphs), Sol implements /
  Claude reviews / user play-tests visible slices;
  (2) recommend retaining the parent plan's existing-effects/storage boundary
  and current SFX bank, with explicit deferred PC/medicine/audio gaps;
  (3) confirm A5b6's four play-test checks passed before implementation.
  No answer assumed and no new accepted decision added to DECISIONS.md.

- ~~**O-22: A5b6 plan decisions**~~ — **resolved 2026-10-13 (DECISIONS #51):** "go" (all five recommendations), and
  Claude implements today. The questions were (`notes/37-a5b6-plan.md` §10), recommendations first:
  (1) one slice, five checkpoints, one review and play-test (alternative: school + Town Map, then the speech);
  (2) the new `HandleMenuInput` port drives the blackboard **and** the intro's name menu (amends #45's J2 placement
  for that menu; alternative: blackboard only);
  (3) the Town Map: everything in `TownMapText` now, `DisplayTownMap`'s internals in a later Town Map audit;
  (4) the intro's animation (fades, slides, shrink, music fade-out): its own slice right after the healing-machine
  slice (alternative: J2, as #45);
  (5) Sol implements, Claude reviews, the user play-tests (assumed).

- ~~**O-21: A5b5c plan decisions**~~ — **resolved 2026-10-12 (DECISIONS #50):** one slice; BUG-1 in the
  extractor; the healing machine in its own slice; Sol implements, Claude reviews when the user says it is done,
  then the user play-tests. The questions were (`notes/35-a5b5c-plan.md` §10):
  (1) one slice with five checkpoints (recommended) or fixes first then the nurse;
  (2) fix BUG-1 in the extractor and regenerate the sprite PNGs (recommended) or a renderer-only fix;
  (3) the healing machine (silent today; needs a music fade-out): its own slice after A5b7, before V2
  (recommended) or J2 as in #39; (4) Sol implements, Claude reviews, the user play-tests (assumed).

- **BUG-1 fixed in A5b5c CP2 (`659ef0a`).** Sprite-table byte size was multiplied by 16 again, so turning balls indexed the following fossil/boulder. Shared size/class validation now extracts 24-tile walkers and four-tile still pictures, rejects malformed sheets, and always renders still row 0 unflipped. All 76 prefixes/pret pixels match; 76 PNGs regenerated, no other generated file changed, setup twice identical. Three Forest balls each pass 600 turning frames in the muted browser; the Lab ball passes its 600-frame watch. Slot allocation was not the cause. Claude review passed (note 36); user-verified 2026-10-12 (the Forest balls stay balls).

- ~~O-20: A5b5 plan decisions~~ — **resolved 2026-10-11** (DECISIONS #49). The user: "go", taking all six
  recommendations: three sub-slices in order; a handler registry; the §5 departures fixed (including Oak's
  invented advice text and the reversed Mart walk); the §9 exclusions; Oak's two-Pokémon branch prints and closes;
  Sol implements and Claude reviews each, the user play-tests after b and c.

- ~~O-19: A5b4 plan decisions~~ — **resolved 2026-10-11** (DECISIONS #48). The user: "go", taking all
  seven recommendations: one slice with four checkpoints; `textId` and `mapObjects` as generated data;
  `bcd`/`decimal` deferred to A5b7; `PrintText`'s `UpdateSprites` stays J2; START's exit uses the shared
  close; the Town Map sign keeps its ending until A5b6; Sol implements, Claude reviews.

- ~~O-18: A5b3 plan decisions~~ — **resolved 2026-10-11** (DECISIONS #47). The user: "go and
  take both of the plan's recommendations". (1) Scope exactly as #45 limits it: the four
  bank-`$02` sounds, extractor headers only. (2) The bank-`$1f` variants of `save`,
  `turn_on_pc` and `enter_pc` are deferred; the guard test stays. Sol implements, Claude
  reviews.
- ~~O-17: A5b detailed plan~~ — **resolved 2026-10-06** (DECISIONS #45). The user: "go and
  yes to all 1 through 4 as recommended". Claude implements, Sol reviews.
- ~~O-16: A5 plan decisions~~ — **resolved 2026-10-06** (DECISIONS #44).
  The user accepted all recommendations and assigned Sol implementation; Claude reviews.
  `notes/21-a5-plan.md` §9, nine decisions:
  recommendation:
  1. the split and its order;
  2. the text data encoding (`
` plus tokens only where needed, a trailing `<PROMPT>`);
  3. contraction glyphs;
  4. the third-by-third BG transfer;
  5. the ▼ blink at 30/30 (you could time it);
  6. `CloseTextDisplay`'s reload frames go to A5b;
  7. species display names go to V5;
  8. the wild catch inside A5;
  9. who implements.
- ~~O-15: A1c plan decisions~~ — **resolved 2026-10-06** (DECISIONS #43). The user: "go". All
  seven recommendations are taken: Sol implements and Claude reviews.
- ~~O-14: A1b plan decisions~~ — **resolved 2026-10-06** (DECISIONS #41). The user: "let me
  have sol implement", "u will review their work"; decisions 1–5 take the recommendations.
- ~~O-13: A1a plan decisions~~ — **resolved 2026-10-06.** The user: "I reply yes for all
  of them", and asked Claude to implement the plan (DECISIONS #40).

- ~~O-12: A6e plan scope and implementer~~ — **resolved 2026-10-04.** The user asked
  Claude to "plan and implement this plan": all three recommendations (DECISIONS #39).

- ~~O-11: A6d plan decisions~~ — **resolved 2026-10-04.** The user requested
  implementation of `notes/12-a6d-plan.md`: all three recommendations accepted.
  A6e split, native follow buffer, midpoint map scripts/trainer sight deferred to A1c
  (DECISIONS #38).

- ~~O-10: A6b plan decisions~~ — **resolved 2026-10-01.** The user: "mark those 4
  decisions as yes" (DECISIONS #37).

- ~~O-9: A6 plan decisions~~ — **resolved 2026-09-27.** The user: "go", taking all four
  (DECISIONS #36).
- ~~O-8: A1 plan decisions~~ — **resolved 2026-09-27.** The user: "yes, pls do walking
  speed first". All six recommendations, with A6 moved before A1a (DECISIONS #35).
- ~~O-5: Sim FPS default~~ — **resolved 2026-09-25.** The user: "match the game boy
  59.7". Done the same day; see DECISIONS #33.
- ~~O-7: V1e plan decisions~~ — **resolved 2026-09-25.** The user: "do v1e as one
  slice"; the other two took the recommended defaults (DECISIONS #34).
- ~~O-6: V1 plan decisions~~ — **resolved 2026-09-22.** The user accepted all six
  recommendations; see DECISIONS #29.
