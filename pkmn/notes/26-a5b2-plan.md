# A5b2 — map sprite-set extraction

**2026-10-09 · Codex/Sol · implementation plan for Grok.**

The user asked Codex to plan the next slice, then hand it to **Grok to implement**,
and **Codex to review afterward**. This assignment applies to A5b2; it supersedes
the older Claude assignment for this increment. Implementation has not started.

Read root `CLAUDE.md`, `context/STATUS.md`, `context/CONVENTIONS.md`,
`23-a5b-plan.md` §§3.3/4.1/6/7, DECISIONS #45–#46, and this note before coding.
A5b1 is signed off (`25-a5b1-review.md`). This increment supplies the second JSON
approved in #45, after `text_programs.json` and before A5b3's required audio.

## 1. Deliverable and boundary

Extract and commit **`map_sprite_sets.json`** in both `game/data/` and
`game/static/`. Define its strict exported TypeScript interface in a new ROM
extractor. The data must be sufficient for A5b4 to select outdoor sprite sets,
allocate indoor picture slots from live sprites, and compute the actual sprite
copies performed when an overworld text display closes.

This is **extraction only**. The running game continues using its current text,
map, movement and sprite code. A5b4 owns fetching this JSON at runtime, converting
live sprites to picture slots, implementing allocation/selection, and applying
CloseTextDisplay's schedule. The selection/allocation routines in this slice's
tests are independent reference calculations, not a shipped runtime feature.

Included:

- The complete small outdoor tables: 37 map selectors, 12 split records,
  10 sprite sets of 11 picture IDs each.
- All 82 SpriteSheetPointerTable picture entries' decoded tile counts and
  walking/still classification, preserving picture IDs and aliases.
- Route 20's exceptional coordinate rule, extracted from confirmed instruction
  operands rather than accidentally treating its table row as executable policy.
- Current map names → cartridge map IDs, plus existing canonical sprite asset
  names → cartridge picture IDs, to bridge the engine's names to the new metadata.
- Independent source/ROM fixtures, committed-file checks, and data calculations
  for all 19 current maps.

The complete tables are less than 1 KB of source bytes and avoid discarding
information needed for subsequent map slices. They add no playable maps. No new
SFX, graphics, text, map JSON fields, save fields, scripts, timing changes, or
runtime data loader belong in this increment. Keep `refs/` and `pkmn-sprites/`
read-only. Generated files come only from setup.

## 2. Starting point and research evidence

Planning started at **`5cd06e3`**, clean working tree on local `master`.
The reviewed A5b1 baseline is **970/970 tests across 45 files**, or **878 pass /
92 skip** without ROM; typecheck/build clean. Those are recorded results from
A5b1, **not checks re-run during this planning session**.

This session independently read the assembly and probed the owner's ROM:

- 1,048,576 bytes; SHA1 `cc7d03262ebfaf2f06772c1a480c7d9d5f4a38e1`.
- `refs/pokeyellow` at `e89ead154b9968aa50eed9328ff2b38b6c194382`, clean.
- All 37 + 48 + 110 sprite-set table bytes agree with the source declarations.
- All 82 picture-table size bytes agree with `overworld_sprite` declarations.
- Table operands and classification/split constants were checked at the ROM
  instruction addresses below. No ROM byte-pattern searching was used.
- Every current map's `object_event` picture list was read independently and
  compared with the sprite names in committed map JSON. Their unique regular
  pictures reproduce all parent-plan W/close-time fixtures.
- Current generated inventory: **168 data JSON + 168 static JSON + 520 PNG +
  3 tilemaps = 859 files**. A5b2 adds exactly two files: **169 + 169 + 520 + 3 =
  861 files**.

There is no `.sym` file in the current reference checkout. This is not a blocker:
the existing `SPRITE_SHEET_PTRS` anchor is `05:42a9`; the three immediately
preceding tables total 195 bytes. Their addresses were then confirmed at their
actual referring instructions. The routine addresses were cross-checked by
sizing the source instructions from bank5's start (the 27-byte
`LoadPokedexTilePatterns` precedes `_InitMapSprites`). Do not build inside the
read-only clone. An existing external matching symbol file can provide another
cross-check, but no tool installation or disassembly build is required here.

## 3. Source anchors and byte contracts

Paths in this section are relative to `refs/pokeyellow/`.

| Source | Contract |
|---|---|
| `engine/overworld/map_sprites.asm` | `_InitMapSprites`, `InitOutsideMapSprites`, `LoadSpriteSetFromMapHeader`, `CheckIfPictureIDAlreadyLoaded`, `CheckForFourTileSprite`, `ReadSpriteSheetData`, `GetSplitMapSpriteSetID` |
| `data/maps/sprite_sets.asm` | MapSpriteSets, SplitMapSpriteSets, SpriteSets, declaration order and asserted lengths |
| `constants/sprite_set_constants.asm` | Set IDs 1–10; split IDs `$f1`–`$fc`; EAST_WEST=1, NORTH_SOUTH=2; 11 slots |
| `constants/sprite_constants.asm` | NONE=0, PIKACHU=`$3d`, FIRST_STILL_SPRITE=`$47`, NUM_SPRITES=82 |
| `data/sprites/sprites.asm` | Four-byte `overworld_sprite` entries and picture order |
| `constants/map_constants.asm` | FIRST_INDOOR_MAP=`$25`, all current map IDs |
| `data/maps/objects/<Map>.asm` | Independent current-map picture inventory, including hidden/duplicated pictures |
| `engine/overworld/toggleable_objects.asm` | Hiding changes flags and image availability; it does not clear the picture ID |
| `home/text_script.asm:CloseTextDisplay` | Font remains loaded during InitMapSprites, then player graphics reload, then UpdateSprites |
| `home/copy.asm:CopyVideoDataAlternate`, `home/copy2.asm:CopyVideoData` | LCD-on copy delays and the final remainder iteration |
| `home/overworld.asm:LoadPlayerSpriteGraphicsCommon` | Two player copies of 12 tiles each |
| `main.asm`, `layout.link` | Sprite routines/tables live in bank `$05` |

### 3.1 Verified ROM locations

CPU addresses below use bank `$05`. File offsets use
`symToOffset(bank, address)`; keep address metadata in extraction code, never as a
runtime dependency in JSON.

| Data | CPU address | File offset | Bytes / shape | Referring instruction |
|---|---:|---:|---|---|
| MapSpriteSets | `05:41e6` | `$141e6` | 37 × 1 | `05:4196`: `21 e6 41` (`ld hl, MapSpriteSets`) |
| SplitMapSpriteSets | `05:420b` | `$1420b` | 12 × 4 | `05:41a2`: `21 0b 42` (`ld hl, SplitMapSpriteSets`) |
| SpriteSets | `05:423b` | `$1423b` | 10 × 11 | `05:404a`: `21 3b 42` (`ld hl, SpriteSets`) |
| SpriteSheetPointerTable | `05:42a9` | `$142a9` | 82 × 4 | `05:4140`: `11 a9 42` (`ld de, SpriteSheetPointerTable`); existing `SPRITE_SHEET_PTRS` |

Other confirmed operands:

| Meaning | Instruction | Operand address / value |
|---|---|---|
| FIRST_INDOOR_MAP | `05:402c`: `fe 25` | `05:402d` = `$25` |
| Pikachu picture | `05:406b`: `3e 3d`, also `05:40ac`: `fe 3d` | `05:406c` / `05:40ad` = `$3d` |
| FIRST_STILL_SPRITE | `05:40af`: `fe 47` | `05:40b0` = `$47` |
| Split comparison threshold | `05:419b`: `fe f0` | `05:419c` = `$f0` (**FIRST_SPLIT_SET − 1**) |
| Route 20 special selector | `05:419e`: `fe f8` | `05:419f` = `$f8` |
| Route 20 X west boundary | `05:41c8`: `fe 2b` | `05:41c9` = 43 |
| Route 20 X east boundary | `05:41ce`: `fe 3e` | `05:41cf` = 62 |
| Route 20 X middle boundary | `05:41d4`: `fe 37` | `05:41d5` = 55 |
| Route 20 Y split for X 55–61 | `05:41d6`: `06 08` | `05:41d7` = 8 |
| Route 20 Y split for X 43–54 | `05:41da`: `06 0d` | `05:41db` = 13 |
| Route 20 west / east set | `05:41ca`: `3e 01`; `05:41d0`: `3e 0a` | `05:41cb` = 1; `05:41d1` = 10; repeated at `05:41e4` / `05:41e1` |

Name these new offsets in `rom_offsets.ts`, following existing conventions.
Read the relevant immediate operands for emitted constants and Route 20's rule.
Source-based tests should independently check opcode context and operand values,
so moving an offset one byte fails. Fixed table lengths/slot capacities are
source constants, with independent length fixtures; do not search the ROM for a
matching sequence.

### 3.2 Picture entry size is bytes, not tiles

Each SpriteSheetPointerTable entry is `[addressLo, addressHi, byteLength, bank]`.
The macro emits `db tileCount tiles`: 12 tiles becomes **`$c0`**, and 4 becomes
**`$40`**. `ReadSpriteSheetData` performs `swap c`, yielding 12 or 4 tiles.

Use the exact nibble swap, then validate the resulting count. A regular picture
has **12 still tiles plus 12 walking tiles**, 24 tiles in its full sheet.
A still-only picture has four tiles. Do not confuse the half-sheet count with
the full PNG's tile count, and do not use PNG dimensions to derive copy costs.
The existing graphics extractor's terminology is ambiguous; changing its
decoding or PNGs is outside this increment.

Preserve all IDs 1–82, even when their pointers share graphics. In particular:

- IDs `$1f`, `$32`, `$36` reuse Red; they remain separate picture IDs.
- `$4e` / `$4f` share Old Amber.
- `$50`, `$51`, `$52` share the asleep gambler image.
- Canonical engine name `gambler_asleep` maps to **`$52`**, as `maps.ts` specifies.
  The graphics list happens to export that image using `$50`; its identical
  pixels do not authorize changing the map-picture ID.
- Pikachu is `$3d`, regular, and separately reserved even when the follower is
  absent or hidden. NONE=0 is an unused slot, not a picture-table entry.

## 4. Proposed strict schema and extraction

Create `game/src/rom/extractors/map_sprite_sets.ts`. The following schema is the
recommended contract for this increment; define/export it before emitting data.
Use the names consistently in fixtures and documentation.

```ts
export interface SpritePictureMetadata {
  kind: 'walking' | 'still';
  tileCount: 12 | 4; // per copy, not the full regular sheet
}

export interface LinearSpriteSplit {
  axis: 'x' | 'y';
  divider: number; // player map-step coordinate
  belowSetId: number;
  atOrAboveSetId: number;
}

export interface Route20SpriteSplit {
  splitSetId: number;
  xCuts: [number, number, number]; // west, middle, east: 43, 55, 62
  yCuts: [number, number];         // X 43–54 then X 55–61: 13, 8
  westSetId: number;              // 1
  eastSetId: number;              // 10
}

export interface MapSpriteSetsFile {
  firstIndoorMapId: number;
  firstStillPictureId: number;
  pikachuPictureId: number;
  mapIds: Record<string, number>; // exactly the current extractable maps
  pictureIdsBySprite: Record<string, number>; // canonical engine asset names
  outdoorSetIds: number[];        // index = map ID, length 37
  splitSets: Record<number, LinearSpriteSplit>; // keys $f1–$fc
  spriteSets: Record<number, number[]>;         // keys 1–10, 11 slots each
  pictures: Record<number, SpritePictureMetadata>; // keys 1–82
  route20: Route20SpriteSplit;
}

export function extractMapSpriteSets(rom: BinaryReader): MapSpriteSetsFile;
```

Slot layout constants are **9 regular + 2 still-only**; scan **14 NPC slots**.
Export named constants from the extractor for development use if useful, but
derive expected values independently in tests. JSON numeric object keys serialize
as strings; lookups remain by cartridge ID. No zero-based renumbering of set or
picture IDs. Include each ID explicitly; deterministic insertion order and the
project's `JSON.stringify(value, null, 2) + '\n'` serialization apply.

Extraction steps:

1. Read and check all required byte ranges before decoding. BinaryReader's
   `readByte` returns undefined outside the buffer and `readBytes` silently
   truncates; add local range checks. Do not globally change BinaryReader.
2. Read the three classification constants and special split rule at the
   confirmed operands. Validate their opcode contexts and supported domains.
3. Read all 37 selectors, all 12 split rows, all 110 set-picture bytes, and all
   82 picture-table size bytes. Decode directions 1→x / 2→y and nibble-swap
   counts; classify pictures by the ASM's picture-ID rule, with the explicit
   Pikachu exception. Assert classification agrees with the source tile counts.
4. Bridge existing registries with **additive exports** of `EXTRACTABLE_MAPS`
   and `SPRITE_NAMES` in `maps.ts`. Populate `mapIds` from the former and invert
   the latter into `pictureIdsBySprite`. Preserve every existing entry/behavior;
   no broad map metadata refactor. Map and sprite IDs are source-authored
   structural metadata, as they already are in that extractor.
5. Validate referential integrity and emit the one new JSON. Keep all twelve
   linear split rows, including `$f8`; `route20` explicitly overrides `$f8`
   when selection is eventually executed. Its unused linear row is source data.

`pictureIdsBySprite` covers the existing canonical map-sprite registry; it is
not a requirement to invent canonical filenames for every unused picture alias.
All alias IDs still have `pictures` entries. Independently check every sprite
name used by current map JSON and current `showNpc` commands (today `prof`)
has a valid binding. Reject duplicate names during inversion rather than silently
choosing the last one. Future maps add any newly needed canonical binding with
their own extraction slice.

Validation must reject malformed/truncated data with location/context:
unknown split axis, nonexistent selector/set/picture reference, unsupported
tile count, wrong classification, wrong table length, missing current sprite
binding, and out-of-ROM table ranges. Every actual selector is either 1–10 or
`$f1`–`$fc`; `$f0` is not a valid table entry despite the ASM comparison.
Each outdoor set begins with Pikachu, has nine regular pictures and two
still-only pictures, and contains eleven entries. Never substitute a default
picture/set or skip an invalid row to produce superficially valid JSON.

Offsets, source labels, pointer banks/addresses and graphics blobs do not need
to be emitted. Validate byte ranges needed for metadata; do not expand this into
another graphics extractor or CPU interpreter.

## 5. Behavior the data must support

These are test-reference contracts now and production requirements for A5b4.
No map-specific W or close timer is serialized.

### 5.1 Outdoor selection

Classification is **map ID < `$25`**, not tileset name. Viridian Forest and its
gates are numerically indoor for this routine.

For ordinary outdoor maps, `outdoorSetIds[mapId]` selects either a fixed set or
a split record. The split axis reads **map-step coordinates** (`wXCoord` /
`wYCoord`), not pixels, block coordinates, or camera-relative positions.
Coordinate **< divider** selects `belowSetId`; equality goes to the second set.

Required current boundary: **Route 2 (`$0d`)** uses split `$f1`, Y=37:
Y=36 → set 2 (Pewter/Cerulean); Y=37 → set 1 (Pallet/Viridian), regardless of X.
Both halves load nine regular pictures, despite Route 2's two item-ball objects.
Test all twelve raw split records against the ASM, and both sides/equality of
each ordinary split against independently specified values.

**Route 20 (`$1f`, selector `$f8`) is special:**

```text
X < 43       → set 1
X >= 62      → set 10
43 <= X < 55 → Y < 13 ? set 10 : set 1
55 <= X < 62 → Y <  8 ? set 10 : set 1
```

The ordinary `$f8` split row says X=53, sets 1/10. The executable routine
bypasses that row. Required boundary fixtures include X=42/43/54/55/61/62,
Y=7/8/12/13, and a deliberate case that disagrees with the unused X=53 rule.
Also check ordinary fixed selectors (Pallet/Viridian/Route 1/Route 22 all 1).

### 5.2 Indoor allocation

`LoadSpriteSetFromMapHeader` actually reads live `wSprite01StateData1` through
`wSprite14StateData1` picture IDs. Its name does not mean to re-read the initial
map header at every close. A5b4 supplies those live IDs; A5b2 supplies their
classification and the canonical-name bridge.

Reference allocation:

1. Clear eleven set slots and reserve slot 0 for Pikachu `$3d`.
2. Scan NPC slots 1–14 in order, retaining zeros as unused positions.
3. For a nonzero regular picture, search slots 0–8; for a still-only picture,
   search slots 9–10. Stop at an existing match or insert into the first zero.
4. A full class region drops a new unmatched picture, as the ASM does. Do not
   add a twelfth slot, sort IDs, evict earlier pictures, or throw for legitimate
   capacity overflow. Malformed picture IDs are a separate validation failure.

Repeated pictures are deduplicated by **ID**, not graphics pointer/filename.
Hidden/offscreen objects still contribute their picture IDs. Slot 15 is the
separately reserved Pikachu slot, and slot 0's player is not an ordinary NPC.
The hidden flag is neither a picture classification nor permission to remove
an entry before allocation. A nonzero picture with a still-only size stays in
the still region even if its JSON lacks `object: true`.

Synthetic cases must cover: no NPCs, zero gaps, repeated regular and still
pictures, Pikachu appearing in a scanned slot (no extra reservation), three
distinct still IDs overflowing two slots, ten distinct non-Pikachu regular IDs
overflowing eight free slots, alias IDs with shared graphics occupying distinct
slots, and a live replacement with a previously absent regular picture changing
W. For these small fixtures assert the **full eleven-slot array**, not just W.

The current engine filters/reorders some map NPCs (Oak's second object, Daisy's
second object, Route 22 rivals). Their current duplicate picture IDs do not
change W. Establish this in the source inventory test; do not turn the filtered
array into a claim that all original cartridge slots are already represented.
The actual live-slot adapter and dynamic/script slot reconciliation remain
A5b4 work, including limits and hidden picture retention.

### 5.3 Copy costs and complete current-map fixtures

With LCD on, one copy of N tiles takes **floor(N / 8) + 1 frames**. The final
iteration calls DelayFrame even for a zero remainder. Independently pin N=4,
8, 12, 16 → 1, 2, 2, 3; do not use `ceil(N / 8)`.

During CloseTextDisplay the font flag is still set for map reload:
`LoadStillTilePattern` returns without copying; only nonzero slots 0–8 load
walking halves. Four-tile slots contribute **zero copies**. The player reloads
two 12-tile halves after the flag clears. Therefore, for current normal walking
closes, **1 window-hide frame + 2 × W + 4 player frames = 5 + 2 × W**.
Hold's prior input wait is excluded; final UpdateSprites adds no DelayFrame.
Fly-warp suppression, LCD-off copies, biking/surfing and alternate screen
reloads are different call paths, not new features in this data increment.

| Current map(s) | Distinct regular pictures including reserved Pikachu | W | Normal close frames |
|---|---|---:|---:|
| PalletTown, ViridianCity, Route1, Route22, both Route2 halves | Fixed outdoor set, not visible NPC count | 9 | 23 |
| OaksLab | Pikachu, Blue, Oak, Girl, Scientist | 5 | 15 |
| ViridianPokecenter | Pikachu, Nurse, Gentleman, Cooltrainer M, Link Receptionist, Chansey | 6 | 17 |
| ViridianMart | Pikachu, Clerk, Youngster, Cooltrainer M | 4 | 13 |
| ViridianSchoolHouse | Pikachu, Brunette Girl, Cooltrainer F, Little Girl | 4 | 13 |
| ViridianNicknameHouse | Pikachu, Balding Guy, Little Girl, Bird | 4 | 13 |
| ViridianForest | Pikachu, Youngster, Cooltrainer F | 3 | 11 |
| ViridianForestNorthGate | Pikachu, Super Nerd, Gramps | 3 | 11 |
| ViridianForestSouthGate | Pikachu, Girl, Little Girl | 3 | 11 |
| Route2Gate | Pikachu, Scientist, Youngster | 3 | 11 |
| Route2TradeHouse | Pikachu, Scientist, Gameboy Kid | 3 | 11 |
| RedsHouse1F | Pikachu, Mom | 2 | 9 |
| BluesHouse | Pikachu, Daisy | 2 | 9 |
| DiglettsCaveRoute2 | Pikachu, Fishing Guru | 2 | 9 |
| RedsHouse2F | Pikachu only, even with no starter/follower out | 1 | 7 |

Oak's ball/Pokédex, Daisy's map, the Forest's balls, and the nickname house's
clipboard are still-only pictures; hiding them does not remove their metadata
and does not change walking-half cost. A test that just loads this table of
expected W values without actually using extracted pictures/sets is insufficient.

## 6. File surface and ordered implementation

| File | Change |
|---|---|
| `src/rom/rom_offsets.ts` | Add confirmed table/code-operand offsets and source comments; reuse SPRITE_SHEET_PTRS |
| `src/rom/extractors/map_sprite_sets.ts` | New strict interface, extractor, local guards and integrity checks |
| `src/rom/extractors/maps.ts` | Add exports to the existing two metadata registries; their contents and generated output stay identical |
| `src/rom/index.ts` | Register `map_sprite_sets.json` through the new extractor |
| `scripts/extract_dev_data.ts` | Register the same extractor/output and increment JSON count |
| `src/rom/__tests__/map_sprite_sets.test.ts` | New independent source/ROM checks plus committed-metadata reference fixtures |
| `src/rom/__tests__/static_export.test.ts` | Explicit new-key assertions for orchestrator, data and static mirror; retain general stale-output checks |
| `data/map_sprite_sets.json`, `static/map_sprite_sets.json` | Exactly two generated additions |
| `src/overworld/ARCHITECTURE.md`, `context/ARCHITECTURE.md` | Data contract, source rules, pending A5b4 runtime use; correct current output inventory where needed |
| `context/CONVENTIONS.md`, `context/STATUS.md`, root `CLAUDE.md` | New test-file description, actual result/handoff, measured baseline only |

Grok should claim **A5b2 implementation** in STATUS before editing code. Use these
ordered checkpoints within this one slice:

1. **Extractor and evidence.** Implement types/offsets/registry exports and
   focused tests against the ROM/source. Existing entry points are still
   unchanged; inspect decoded tables and hard entries. Pure test-reference
   calculations may use in-memory extracted data at this stage.
2. **Pipeline and committed output.** Register both entry points, run setup,
   add committed-file fixtures and explicit static-export key checks. Run setup
   again and compare the entire path/hash manifest. Inspect all generated
   changes before accepting the checkpoint.
3. **Final gates and handoff.** Run the full validation below, document actual
   counts/results and any departures, and commit the coherent slice locally.
   Checkpoints may be committed separately if useful; every claimed completed
   checkpoint must be verified and logged. Stop after A5b2 for Codex's review.

Do not implement A5b3 sounds or A5b4 runtime changes while completing this work.
No user decision remains necessary to investigate or implement the bounded
extraction slice; #45 approved the output and the user assigned this handoff.
Document any consequential schema departure in the result so review can assess
it against the source and future close routine.

## 7. Verification and failure detection

### 7.1 Independent source fixtures

Build expected table values from the referenced ASM/constants or small frozen
source-derived vectors. The expectation must not import extractor offsets,
name registries or emitted JSON as its authority for the value being checked.

The complete-ROM suite should compare all three raw tables with their source
declarations, including lengths/order, and all 82 picture counts with the
`overworld_sprite` macro operands. An intentionally small parser only needs
these files' const_def/const_next/const, db and overworld_sprite syntax. Anchor
labels at line starts with their exact names: substring splitting on
`SpriteSets:` also matches `MapSpriteSets:` and `SplitMapSpriteSets:`.
Unsupported source syntax should fail explicitly.

Independently check current `mapIds` against `map_constants.asm` and engine-name
bindings against the corresponding source picture constants. Keep at least
hard pins for `prof`→3, `pikachu`→61, `poke_ball`→71, `pokedex`→75,
`gambler_asleep`→82, Route2→13, ViridianForest→51, RedsHouse2F→38.
Use all current source object lists to verify classification and current W
fixtures; including duplicates is necessary to detect count-by-object errors.

Opcode-context fixtures must verify the locations in §3.1 and the full Route 20
branch's declared constants/outputs. Do not merely assert the extractor's own
numeric addresses against a duplicate object made from the same exports.
No full assembler, CPU emulator, or symbol-file dependency is necessary.

### 7.2 Data availability with and without ROM

Separate ROM-dependent extraction/source checks from tests loading committed
`data/map_sprite_sets.json`. The latter exercise §5's independent expected
vectors, coverage of current map/sprite names, all 19 W fixtures, and the exact
static mirror without requiring ROM or refs. They must continue working in a
fresh ROM-free checkout.

Full ROM/source verification requires the local read-only reference files.
Use the project's existing ROM_PATH skip convention for those tests and make
missing required reference files explicit when that suite is enabled. Do not
silently skip source comparisons while reporting a full verification pass.

Assert equality of extractor result to committed JSON, both entry points'
registered value, and data/static bytes. Explicitly assert the new key exists
in `extractRom().jsonData`: a loop checking only keys that happen to be emitted
cannot catch a forgotten registration. Existing static-export tests then cover
the new output without special export logic.

Meaningful wrong implementations to catch:

- Treat `$c0` as 192 tiles, 24 tiles, or a byte count already divided twice.
- Flip the split axis or put divider equality on the first side.
- Apply the unused Route 20 X=53 split instead of its branch.
- Count visible NPCs or skip hidden pictures instead of loaded unique IDs.
- Reserve Pikachu only when a follower is visible, or count duplicate Oak/Daisy.
- Count still-only slots toward walking-half copies; classify by JSON object flag.
- Collapse alias IDs because they share a graphics pointer.
- Add space after allocator overflow instead of preserving its source capacity.
- Use ceiling division for N=8/16 copy timing.
- Omit either pipeline registration while stale-file loops still pass.

Add a small set of in-memory ROM mutation checks for the extractor's guards:
truncated required range, invalid direction byte, invalid picture/set reference,
and unsupported tile-count byte. Never modify the owner's ROM on disk. Mutations
of test-reference selection/allocation logic should fail the corresponding
independent vectors; do not build an extensive mutation-testing framework.

### 7.3 Generated data and normal gates

Capture relative paths and SHA-256 hashes for **all** files beneath `data/` and
`static/` before setup, after setup #1, and after setup #2. Normalize manifest
paths to `/`, sort them, and compare path sets as well as hashes. Aggregate
counts alone cannot detect missing/replaced files. Preserve the first manifest
before running setup again; do not compare two references to overwritten data.

Acceptable generated diff: **only the two new `map_sprite_sets.json` files**.
Every pre-existing one of the 859 files must remain byte-identical, with the
same path. Both new files must match each other; the two complete 861-file
manifests must match. The 19 map JSONs and all 520 PNGs are unchanged.

From `game/`, PowerShell commands:

```powershell
npm run setup pokeyellow.gbc
# Capture and compare manifest #1, then regenerate.
npm run setup pokeyellow.gbc
# Compare manifests and inspect the generated diff.
npm run typecheck
$env:ROM_PATH = 'pokeyellow.gbc'
npm test
Remove-Item Env:ROM_PATH
npm test
npm run build
```

Restore a previously set ROM_PATH rather than erasing the user's prior value,
if applicable. Use the existing 970/970 and 878/92 baseline as a regression
minimum; record new pass/skip/file counts from the actual commands. Do not
guess the final test count or update documentation before obtaining it.
The production bundle must still load committed assets without ROM.

There is **no new visible behavior to play-test in A5b2**. Source/data checks
and the production build are the acceptance evidence here; runtime/browser
selection, close-frame traces, input/transfer ownership, final UpdateSprites
and the user's text-close play-test remain gates of A5b4. If a runtime import
or behavior change slips into this increment, remove it and restore the data
boundary before requesting review.

## 8. Completion, review, and prompt for Grok

Grok records in this note a short implementation result: commits, files/schema,
any justified departures, actual test counts, idempotence/unchanged-output
evidence, and precise stopping point. Update STATUS to **A5b2 implemented,
awaiting Codex review**; do not declare independent review passed. Describe the
new tests in CONVENTIONS and extracted-data contract in the architecture docs.
Only update root CLAUDE's measured test baseline, keeping its entry-point role.
Commit the authorized slice locally with its co-author trailer; never push.

Codex will review the implementation afterward against this note and the source.
The review should independently check: source operands/tables, schema adequacy
for live slots, Route 20's exception, ID preservation, indoor capacities and
hidden pictures, fresh-checkout tests, dual registration, and unchanged generated
bytes. Re-run the appropriate verification and record actionable findings in the
next numbered review note. A5b3 becomes the next implementation increment after
A5b2 sign-off; this plan does not assign its implementer.

Suggested handoff prompt:

> Read root CLAUDE.md, context/STATUS.md and notes/26-a5b2-plan.md. Implement
> A5b2 only: strict map sprite-set extraction and its verified generated JSON,
> with the independent source/data tests and gates specified in the plan.
> Grok implements; Codex reviews afterward. Claim the slice, preserve the
> extraction/runtime boundary, log actual results and departures, and commit
> locally. Stop with A5b2 awaiting Codex review. Do not start A5b3 or A5b4.

## Implementation result

Implemented 2026-10-09 by Grok 4.7. One local commit with this note. Awaiting
Codex review. A5b3 and A5b4 were not started.

**Schema.** `MapSpriteSetsFile` in `game/src/rom/extractors/map_sprite_sets.ts`
matches §4. `data/map_sprite_sets.json` and `static/map_sprite_sets.json` are
the same 10573 bytes. Numeric keys are the cartridge ids (`$f1`–`$fc`, sets
1–10, pictures 1–82). `SPRITE_NAMES` and `EXTRACTABLE_MAPS` are exported from
`maps.ts` with unchanged contents. Both `extractRom` and `scripts/extract_dev_data.ts`
register the file. No offsets, banks or graphics blobs. No runtime loader.

**Departures.** None in the emitted schema. The test helper that turns an
engine map name into a pret constant splits a digit from the following word
(`Route2TradeHouse` → `ROUTE_2_TRADE_HOUSE`) and keeps a trailing floor suffix
attached (`RedsHouse2F` → `REDS_HOUSE_2F`). A one-sprite Oak allocation is W = 2
(Pikachu plus Oak). Hiding Oak's ball and Pokédex, Daisy's map, the Forest's
balls and the nickname house's clipboard leaves W unchanged, and those picture
entries stay in `pictures`.

**Gates.** Typecheck clean (via `npm run build`). `ROM_PATH=pokeyellow.gbc npm test`:
**988/988** (46 files). Without `ROM_PATH`: **888 pass / 100 skip**. Setup run
twice from a 859-file path+SHA-256 manifest: 0 changed, 0 removed, and exactly
`data/map_sprite_sets.json` plus `static/map_sprite_sets.json` added (861). The
second run matched the first on all 861 hashes. The ROM on disk was not written.

**Stop.** A5b2 is implemented and awaiting Codex review. Next implementation
increment after sign-off is A5b3, which this work does not assign.

**Codex review, 2026-10-09:** A5b2 passed review; see `notes/27-a5b2-review.md`.
The emitted data matches the source and ROM. N-1 records a nonblocking gap in
the test's emitted set comparisons. A5b3 remains the next unassigned increment.
