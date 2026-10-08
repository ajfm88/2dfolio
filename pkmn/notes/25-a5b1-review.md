# A5b1 review — text extraction

**2026-10-07 · Sol (Codex) · reviewed `6e79276` against `193b641`.**

Scope: Claude's completed **A5b1**, not the later A5b2–A5b7 increments.
References: `23-a5b-plan.md`, DECISIONS #45, `24-a5b1-text-data.md`,
and the read-only pokeyellow source/symbols. Working tree was clean.

**Re-review of `8152bbd` (2026-10-07): passed. R-1, N-1 and N-2 are resolved;
no further findings. A5b1 is signed off; next is A5b2.** See the closing section.

**Initial result: one incomplete requirement to fix before A5b1 sign-off (R-1).**
No regression found in the currently running game's text. The new program
data is not consumed by runtime yet; its medicine-success coverage is incomplete
for the already supported field-item callers that A5b7 must convert.

## R-1 — include the existing medicine-success programs and HP binding

**Priority: P2.** `game/src/rom/text_program_symbols.ts` lists the ordinary
party-menu prompts around lines 124–126, but omits all eight relevant healing
success programs and their FAR children:

| Program | Root address | FAR child | Child address |
|---|---|---|---|
| PotionText | 04:5a51 | _PotionText | 28:419f |
| AntidoteText | 04:5a56 | _AntidoteText | 28:41b9 |
| ParlyzHealText | 04:5a5b | _ParlyzHealText | 28:41d3 |
| BurnHealText | 04:5a60 | _BurnHealText | 28:41eb |
| IceHealText | 04:5a65 | _IceHealText | 28:4202 |
| AwakeningText | 04:5a6a | _AwakeningText | 28:4216 |
| FullHealText | 04:5a6f | _FullHealText | 28:4224 |
| ReviveText | 04:5a74 | _ReviveText | 28:423b |

These addresses were independently read from pret's symbol file. Source call
chain: `engine/items/item_effects.asm:.showHealingItemMessage` calls
`RedrawPartyMenu`; `engine/menus/party_menu.asm:.printItemUseMessage` selects
`PartyMenuItemUseMessagePointers` and calls `PrintText`. The actual programs
follow that table; the FAR bodies are in `data/text/text_3.asm:115–164`.

These are current callers, not new item mechanics. `menus/item_menu.ts:323`,
`:340`, `:357` and `:370` already display handwritten potion, revive and
status-cure success messages. Note 24's inventory omits these literals while
claiming that each handwritten message has an extracted program. Plan §5/§6
includes currently supported field-item results and an inventory of their data.

Potion also requires a new numeric binding: `_PotionText` prints
`text_decimal wHPBarHPDifference, 2, 3`. `wHPBarHPDifference` is `$cefd` and
is absent from the extractor's `TextBinding`/`BINDINGS` (lines 21 and 86).
A temporary, in-memory probe adding just PotionText and _PotionText to the
catalog reproduced:

```text
Unbound text RAM operand $cefd in _PotionText
```

**Fix:** add those root/child entries and a named HP-difference binding to the
existing strict schema, regenerate both data/static outputs, and extend the
consumer inventory. Keep current medicine mechanics unchanged. Add an
independent expected set for the currently supported medicine-result programs,
plus the Potion number/name/ending operands. The existing "every listed label"
test cannot detect missing catalog entries; the whole suite currently passes
without any of these eight programs.

Do this as a data correction before engine wiring. Verify setup idempotence,
source fixtures and the normal gates. No engine fix or new runtime feature is
needed to resolve this finding.

## Non-blocking notes

**N-1 — correct the cry contract comment.**
`rom/extractors/text_programs.ts:53` describes a cry as `PlayCry (no wait)`.
`home/text.asm:543` calls `PlayCry`, and `home/pokemon.asm:140–155` calls
`WaitForSoundToFinish` inside PlayCry. Thus the source call blocks. The cry op
itself is preserved correctly; its playback/wait remains the agreed J2 gap.
Correct the comment so the later runner does not treat it as an asynchronous
fire-and-forget cue. Do not implement cries in this correction.

**N-2 — correct the output counts.**
Note 24 §1 says 168 → 169 JSONs, then 170 after sprite sets. Actual counts are
167 → **168** after A5b1, then **169** after A5b2. STATUS already has the right
current count. Two setup runs each produced 859 files across data/static:
168 data JSONs + 168 static JSONs + 520 PNGs + 3 tilemaps.

## What passed

- Typecheck clean.
- ROM suite: **969/969**, 45 files.
- No-ROM suite: **878 pass / 91 skip**, 45 files.
- Production build clean.
- Setup twice: all **859** file paths and SHA-256 hashes identical to the
  committed outputs and to each other. No generated changes left in the tree.
- All **523 program + 21 pointer-table addresses** independently compared
  against pret's symbol file: 544 checked, no mismatch.
- All **103 existing game_text keys** compared through the real runtime
  `loadGameText`/`getText` implementation against the parent commit: no changed
  return value. Raw getter retains the 31 new prompt endings. The compatibility
  shim preserves the current callers despite the raw JSON changes.
- Temporary ROM mutation probes reject an unknown command, a FAR cycle and
  an unbound RAM operand. The probes did not edit tracked files or the ROM.
- The source-based tests cover the listed programs and 120 map-text call
  entries, alternate Lab/Mart tables, the Forest leaving-sign bug, commands
  after FAR children, and the prompt/done/@ distinction.

Inlining source strings in the programs instead of adding canonical game_text
keys is a reasonable, documented implementation choice: the full programs are
preserved and the old split-key consumers keep their behavior. Combining the
call table with the same new JSON also fits the approved two-output design.

No browser smoke was run: this increment does not wire the new program data;
the direct comparison verified every existing getter result remains unchanged.
The runtime increments still need their planned frame traces and browser checks.

Review changes are documentation only. Claude's implementation was not edited.
**Initial next step:** resolve R-1 and preferably N-1/N-2; re-review that data
correction, then continue with A5b2. A5b4 and later remain unimplemented.

## Re-review — 8152bbd, 2026-10-07

**All three findings closed. No additional findings.**

- **R-1:** all eight supported medicine-result roots and their eight FAR
  children are extracted. `hpDifference` binds `$cefd`, independently confirmed
  against the sym file. Potion's name, line, two-byte/three-digit number and
  done ending match `data/text/text_3.asm`. The new coverage test derives the
  required results from `PartyMenuItemUseMessagePointers`, excluding the agreed
  unsupported Rare Candy entry; the existing full ASM comparison verifies the
  child programs. The consumer inventory now includes medicine-success callers.
- **N-1:** the cry comment correctly states that PlayCry blocks through
  WaitForSoundToFinish. Cry playback remains J2.
- **N-2:** note 24 correctly gives 167 → 168 → 169 JSON outputs.

Independently re-ran typecheck, **970/970** ROM tests (45 files), no-ROM
**878 pass / 92 skip**, and the build: all pass. Setup twice reproduced all
**859** committed file paths/hashes exactly. All **560** program/table symbol
addresses match pret. The original **523** program records and the map call
table remain unchanged; only the 16 required program records were added.
No runtime medicine mechanics or getter changes in the correction; no browser
smoke needed for this data-only delta. The runtime increments retain their
browser/frame-trace gates.

This re-review changes documentation only and is committed locally with the
updated handoff. **Next: A5b2**, map sprite-set extraction, implemented by Claude.
