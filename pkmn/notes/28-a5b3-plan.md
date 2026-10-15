# A5b3 — required audio extraction: the key-item jingle and the PC sounds

**2026-10-11 · planned by Claude (Sonnet 5.5) · implementer: Sol (GPT-6.1) · reviewer: Claude.**
Planning only. Nothing in the repository was implemented; the only files this session
added or changed are Markdown: this note, `context/DECISIONS.md` (#47) and
`context/STATUS.md`.

**Approved 2026-10-11.** The user answered *"go and take both of the plan's
recommendations"*: decision 1 (scope exactly as #45 limits it) and decision 2 (defer the
bank-`$1f` variants, keep the guard test) are settled as O-18 / DECISIONS #47. §9 below is
kept for the reasoning. STATUS.md carries the *In progress* line, the queue pointer, the
resolved O-18 and a session-log entry.

The user asked for a plan for the next slice, to be handed to Sol, with Claude checking
Sol's work afterwards. The slice is **A5b3** of the approved A5b split
(`23-a5b-plan.md` §6, DECISIONS #45): *"Add only confirmed missing key-item/PC SFX using
the existing audio schema. ASM/header fixtures and actual interpreter duration tests;
existing assets unchanged. No engine wiring yet."*

Read before coding: root `CLAUDE.md`, `context/STATUS.md`, `context/CONVENTIONS.md`,
`game/src/audio/ARCHITECTURE.md`, `23-a5b-plan.md` §4.1, `16-a1a-plan.md` §3–§4 and §6
(the jingle precedent this slice copies), DECISIONS #35, #40, #45, #47, and this note.

Start from **`5152813`** (clean tree; the newest commit is another agent's STATUS-only
study entry). Baseline, as recorded by the A5b2 review and **not re-run in this planning
session**: 988/988 with `ROM_PATH`, 888 pass / 100 skip without it; typecheck and build
clean.

## TL;DR

- **Four sounds, headers only.** `get_key_item`, `turn_on_pc`, `turn_off_pc` and
  `enter_pc` are the only missing sounds the A5b callers need (§2). All four decode
  correctly with **today's decoder**: I dry-ran four new `SFX_HEADERS` rows in a scratch
  copy of the extractor against the owner's ROM, and every channel came out as the
  disassembly says. Nothing about `decodeChannelCommands` changes.
- **The engine already plays them exactly.** Through the A1a test rig the scratch data
  gives the durations and note starts in §5. They match my independent hand derivation
  from the ASM (§3.1), so the tests pin real cartridge numbers, not our own output.
- **A trap the earlier plans did not know about: the cartridge plays an SFX from the
  audio bank of the current map's music, and the banks are not identical** (§3.3).
  `get_key_item` and `turn_off_pc` are byte-identical in bank `$02` and bank `$1f`. But
  `turn_on_pc` and `enter_pc` differ, and so does the **already extracted `save`**. Every
  PC a player can reach in A5b is under bank `$02` music, so the bank-`$02` copies
  (what every extracted SFX already is) are exact for this slice. The rest is logged with
  homes (§8) and pinned by a guard test (§4.3). Decision 2 (§9) is yours.
- **Data diff is exactly 8 new files** (4 JSON in `data/audio/sfx/` + 4 mirrors in
  `static/`): 169 → 173 JSON per tree, 861 → 869 generated files. Every existing file is
  byte-identical.
- **Not wired.** Nothing in the game plays these four until A5b4 (the text runner's
  `sound` op) and A5b7 (the PC menus). The user can hear them early through the existing
  `_playSFX('<name>')` console helper (§6, optional).
- **Two checkpoints, about 27 new tests.**

## 1. Deliverable and boundary

After A5b3:

1. `npm run setup pokeyellow.gbc` extracts `get_key_item`, `turn_on_pc`, `turn_off_pc` and
   `enter_pc` (16 SFX in all) into `data/audio/sfx/` and `static/audio/sfx/`, in the
   existing schema (`{ channels: [{ id, commands[] }] }`, raw fade nibbles, `square_note`
   with a raw 11-bit `frequency`).
2. Tests prove header, bytes, decoded commands, per-update note starts and registers, and
   the update on which `WaitForSoundToFinish` would return, for all four.
3. `audio/sfx_names.ts` (the preload registry) lists the four, which the existing
   preload-list test requires.
4. A guard test records which extracted SFX differ between bank `$02` and bank `$1f`.

**Not in A5b3:** any `playSFX` call for these sounds, any text-runner or PC-menu change,
bank-aware lookup, the bank-`$1f` variants as files, any other missing SFX (§8), and
anything in `music_engine.ts`, `sfx_engine.ts`, `sound_channel.ts`, `synthesizer.ts`. If
one of those seems necessary, **stop and tell the user**; the dry run says it is not.

Hard rules hold: nothing reads the ROM at runtime; `refs/**` and `pkmn-sprites/` are
read-only; generated files come only from `npm run setup`; local commits only, never push.

## 2. The audit: which sounds A5b needs

Sources: every `sound_*` command and `SFX_*` play reachable from the callers in
`23-a5b-plan.md` §5, plus the committed `text_programs.json` (all 539 programs scanned for
`sound` ops).

| Sound | Where A5b needs it (pret) | Status |
|---|---|---|
| `get_key_item` (`sound_get_key_item`, `SFX_GET_KEY_ITEM`) | 7 text programs = 7 sites on current maps. In `text_programs.json`: `OaksLabOak1Text.DeliverParcelText`, `OaksLabOak1Text.GivePokeballsText`, `OaksLabOakGotPokedexText`, `OaksLabReceivedText`, `OaksLabRivalTakesText2`, `GotMapText`, `ViridianMartClerkParcelQuestText`; in the ASM: `OaksLab.asm` lines 898, 908, 1004, 1053, 1134, `BluesHouse.asm:71`, `ViridianMart.asm:102`. Text sounds go through `TextCommandSounds` → `PlaySound` → `WaitForSoundToFinish` | **missing → this slice** |
| `turn_on_pc` | `engine/menus/pc.asm:3` (Pokécenter PC), `players_pc.asm:12` (Red's PC, direct) | **missing → this slice** |
| `enter_pc` | `pc.asm`: `:54` Player's PC, `:74` Bill's/Someone's PC (`:62` Oak's PC and `:68` the League PC are not built) | **missing → this slice** |
| `turn_off_pc` | `pc.asm:93` (LOG OFF), `players_pc.asm:69` (Red's PC) | **missing → this slice** |
| `get_item1`, `get_item2` | pickups, Route 1 sample, hidden items, TM42 program | extracted (A1a), in use |
| `withdraw_deposit` | `players_pc.asm:132/186` | extracted, wires in A5b7 |
| `save`, `purchase` | `save.asm:167/361`, `pokemart.asm:193`, `inventory.asm:15` | extracted, wire in A5b7 (see §3.3 for `save`) |
| `caught_mon`, `dex_page_added`, `pokedex_rating` | text-sound ops exist in the table, but **no current program or caller uses them** | A5f / V5 |

Looked at and **out of scope** (so nobody adds them "while here"; #45 limits the audio
to key item and PC): `SFX_SHRINK` and the Pikachu cry in Oak's speech
(`oak_speech.asm:125,179`), `SFX_TINK` / `SFX_HEAL_AILMENT` inside the Town Map UI
(`items/town_map.asm:76,211,219`), `SFX_HEALING_MACHINE` in the nurse's heal
(`healing_machine.asm:30`), the Itemfinder pair and `SFX_DENIED` for a TM refusal
(`item_effects.asm:2152,2476`). Homes in §8.

## 3. What the cartridge does

### 3.1 The four sounds

All four are `_1` files in `audio/sfx/` (`get_key_item_1.asm`, `turn_on_pc_1.asm`,
`turn_off_pc_1.asm`, `enter_pc_1.asm`). Header addresses and channel pointers are pret's
sym file (`git -C refs/pokeyellow show origin/symbols:pokeyellow.sym`, written to the
scratchpad; it matches our ROM, SHA1 `cc7d0326…4a38e1`, re-checked in this session).

| Sound | Header | Channels (id → address) | Kind |
|---|---|---|---|
| `get_key_item` | `SFX_Get_Key_Item_1` **02:41bc** | 5 → 02:7235, 6 → 02:7254, 7 → 02:7270 | music-mode (`execute_music` first), like the item jingles |
| `turn_on_pc` | `SFX_Turn_On_PC_1` **02:41cb** | 5 → 02:449b | SFX-mode, `square_note`s |
| `turn_off_pc` | `SFX_Turn_Off_PC_1` **02:41ce** | 5 → 02:44c6 | SFX-mode |
| `enter_pc` | `SFX_Enter_PC_1` **02:41d1** | 5 → 02:44d9 | SFX-mode |

Header bytes: a one-channel header is `$04` (channel 5), then the address, little-endian. The
three-channel key-item header is `$84`, addr, `$05`, addr, `$06`, addr (as the A1a test
asserts for the jingles).

**Timing rules** (`engine_1.asm`, the same ones A1a used; all four are ordinary SFX, so
`Audio1_SetSfxTempo` gives tempo `$0100` — `Audio1_IsCry` and `Audio1_IsBattleSFX` are both
false for these IDs, and music-mode channels never use their own `tempo`):

- SFX-mode `square_note L, …` lasts **L + 1** updates (`Audio1_note_length` adds 1, the
  channel's note speed is 1, tempo `$0100`).
- Music-mode `note P, L` lasts **L × speed** updates (`note_type` speed 5 here).
- `PlaySound` leaves each delay counter at 1, so the first note plays on update 1 and a
  channel reads `sound_ret` on update **total + 1**.
- `WaitForSoundToFinish` waits on channels 5, 6 and 8 (A1a §3.6). It returns on the update
  the last of them reads `sound_ret`.

| Sound | Frames per channel | `sound_ret` read on update |
|---|---|---|
| `get_key_item` | 120, 120, 120 | **121** |
| `turn_on_pc` | 69 | **70** |
| `turn_off_pc` | 17 | **18** |
| `enter_pc` | 21 | **22** |

### 3.2 Where each is heard

- Key item: Oak's Lab (music bank `$1f`), Blue's House and the Viridian Mart (bank `$02`).
- Red's PC (Red's House 2F, bank `$02`): `turn_on_pc` on activation, `withdraw_deposit` on
  each transfer, `turn_off_pc` on exit.
- Pokécenter PC (Viridian Pokécenter, bank `$02`): `turn_on_pc`, then `enter_pc` when a
  sub-menu opens, `turn_off_pc` on LOG OFF.

### 3.3 The bank rule — new, and it matters

`PlaySound` → `DetermineAudioFunction` (`home/audio.asm:258`) switches to
`wAudioROMBank` and calls that bank's `AudioN_PlaySound`, which looks the ID up in **that
bank's own SFX header table**. `wAudioROMBank` is the bank of whatever music the map
started (`CompareMapMusicBankWithCurrentBank`, `PlayMusic`). So an SFX is read from the
bank of the current map's music. `constants/music_constants.asm` marks which banks hold
which IDs: the key-item and PC IDs are **"AUDIO_1 AUDIO_3"**, i.e. banks `$02` and `$1f`
only; the battle banks `$08`/`$20` never receive them.

Our extractor has always taken bank `$02` ("we use bank 2 by default"). To see whether that
is exact, I walked every extracted SFX's channel streams byte for byte in both banks (header
addresses are identical in both banks for all 16, checked in the sym file; stream addresses
differ; `sound_call`/`sound_loop` targets compared relative to the stream):

| SFX | bank `$02` = bank `$1f`? | Notes |
|---|---|---|
| `press_ab`, `start_menu`, `collision`, `go_inside`, `go_outside`, `purchase`, `swap`, `withdraw_deposit`, `cut`, `get_item1`, `get_item2` | yes | A1a had already found `get_item1/2` identical |
| **`get_key_item`**, **`turn_off_pc`** (new) | yes | no issue anywhere |
| **`turn_on_pc`** (new) | **no** | bank `$1f` is 80 frames, 11 notes (an extra silent 16-frame note, volume 8 instead of 10, no long last note): `sound_ret` on update **81** vs **70** |
| **`enter_pc`** (new) | **no** | in bank `$1f` the two audible notes have length 4, not 6: `sound_ret` on update **18** vs **22** |
| **`save`** (extracted since before A1a) | **no** | bank `$1f` is shorter and different: `sound_ret` on update **37** vs **40** |

Which of our 19 maps play bank-`$1f` music (`data/maps/songs.asm`): **Oak's Lab,
Viridian Forest and Diglett's Cave (Route 2)**. The other 16 are bank `$02`.

Consequences:

1. **A5b3 is exact as scoped.** The key-item jingle is identical in both banks (Oak's Lab
   included), and the only PCs the player can reach in A5b (Red's House 2F, the Viridian
   Pokécenter) are under bank-`$02` music. Of the 18 PC sites in the whole game
   (`data/events/hidden_events.asm`), 17 are under bank-`$02` music; the one exception is
   **Silph Co. 11F** (`SILPH_CO`, bank `$1f`), which must use the bank-`$1f` PC variants
   (milestone G1).
2. **`save` is already slightly off in three places today.** Saving in Oak's Lab or the
   Forest should play the shorter bank-`$1f` copy (3 updates shorter); we play the
   bank-`$02` copy. That is a pre-existing departure, not caused by this slice. A5b7's
   "save SFX and actual wait" timing inherits it unless it is resolved first (§8, §9).
3. A real fix is a **bank-aware SFX lookup** (the current music's bank → the right copy,
   with the fade/restore rules around `wAudioROMBank`). That is a design with several parts
   and a consumer in V5; it should not be improvised inside a data slice. Hence decision 2.

## 4. The plan

### 4.1 Extractor — `src/rom/extractors/audio.ts`

- `SFX_HEADERS` += four rows, each with its sym label in a comment:
  ```
  get_key_item: { bank: 0x02, addr: 0x41bc }, // SFX_Get_Key_Item_1
  turn_on_pc:   { bank: 0x02, addr: 0x41cb }, // SFX_Turn_On_PC_1
  turn_off_pc:  { bank: 0x02, addr: 0x41ce }, // SFX_Turn_Off_PC_1
  enter_pc:     { bank: 0x02, addr: 0x41d1 }, // SFX_Enter_PC_1
  ```
- Replace the stale comment above `SFX_HEADERS` ("All SFX headers exist in multiple banks
  (1-4), we use bank 2 by default … most complete") with the rule of §3.3: the table holds
  the bank-`$02` copies; the cartridge plays the copy in the current music's bank; see this
  note.
- **Additive refactor for the guard (§4.3):** export `extractSfxAt(rom, bank, addr):
  MusicData`, which holds today's body of `extractSfx` after the header lookup; `extractSfx`
  calls it. Same code, new entry point. If Sol judges even this too much, the acceptable
  fallback is a source-level guard (§4.3, alternative). **Do not touch
  `decodeChannelCommands`.** Do not add the four names to `scripts/extract_dev_data.ts` or
  `src/rom/index.ts`: both name lists **already contain** all four (they sat there
  unextracted because `SFX_HEADERS` lacked them). Leave those lists, including their
  harmless duplicates, alone.

### 4.2 Generated data

`npm run setup pokeyellow.gbc` from `game/`, then **twice**; the second run must change
nothing. Expected diff, exactly:

```
data/audio/sfx/{get_key_item,turn_on_pc,turn_off_pc,enter_pc}.json     (new)
static/audio/sfx/{get_key_item,turn_on_pc,turn_off_pc,enter_pc}.json   (new, identical copies)
```

Inventory: 169 → 173 JSON in each tree; with 520 PNG and 3 tilemaps, 861 → **869**
generated files. Hash the 861 existing files before and after (A5b2 did this); all 861
must be unchanged, including the 12 existing SFX files (the `extractSfxAt` refactor must
not change a byte). Inspect `git diff --stat -- game/data game/static`.

### 4.3 Tests (ROM-dependent ones need `ROM_PATH`)

**`src/rom/__tests__/extraction.test.ts`**, a new `describe('Audio: the key-item jingle and the PC sounds (A5b3)')`, modelled on the A1a jingle block above it:

1. *Header* (4): bytes at `bank 2 × 0x4000 + (addr & 0x3fff)` give the channel count, the
   ids (5/6/7 or 5) and the channel addresses of §3.1, which are pret's sym values, written
   into the test as constants with the sym labels in comments.
2. *JSON* (4): `extractSfx(rom, name)` equals `loadJson('audio/sfx/<name>.json')`.
3. *Disassembly* (4): every channel decodes to the commands parsed directly from
   `refs/pokeyellow/audio/sfx/<name>_1.asm`. Reuse `parseAsmChannels` and **extend it with
   `square_note length, volume, fade, frequency`** (fade stored as the raw nibble: a
   negative fade sets bit 3, as the existing `note_type` case does). An unknown macro must
   still throw. Skip when `refs/` is absent, like the A1a block.
4. *Kind* (2): the key-item channels all begin with `execute_music`, ch5 has
   `toggle_perfect_pitch`, and none of the three contains `square_note` or `pitch_sweep`;
   the PC sounds contain no `execute_music` and no `note`. (This pins the music-mode switch
   that A1a added to the decoder.)
5. *Bank guard* (2–3): for every name in the extractor's SFX table, compare the stream at
   bank `$1f` (same header address; checked equal for all 16) with bank `$02` via
   `extractSfxAt`, with `sound_call`/`sound_loop` targets as command indices (the decoder
   already does that). Assert the set that **differs is exactly `save`, `turn_on_pc`,
   `enter_pc`**, so any SFX added later (V5 adds many) forces a decision instead of
   silently using the bank-`$02` copy. Also pin the three differing sounds'
   `sound_ret` updates per bank (`save` 40 / 37, `turn_on_pc` 70 / 81, `enter_pc` 22 / 18)
   as the recorded size of the departure. Alternative if `extractSfxAt` is declined: compare
   the `_1` and `_3` `.asm` sources (labels normalised). Either must fail if a copy changes.

**`src/audio/` (rig tests; import the engines and `../test/audio_rig`, never `index.ts`)** — new `describe`s in
`sfx_jingles.test.ts` or a new `sfx_key_item_pc.test.ts`:

6. *Key item timing* (3): the update each note starts on, per channel (§5.1); every channel
   still active after update 120 and none after 121; `silencePulse` ×2 and `silenceWave` on
   121.
7. *Key item pitch* (2): the first frequency write at each note-start update (§5.1),
   including ch5's perfect-pitch `+1` on the low byte (ch6 and ch7 without it); and the
   hardware mapping 5 → pulse 1, 6 → pulse 2, 7 → wave.
8. *PC timing* (3): per sound, the `freq0` writes and their updates and registers (§5.2),
   `sound_ret` on 70 / 18 / 22, and no write on pulse 2, the wave channel or noise.
9. *`WaitForSoundToFinish`* (1, table-driven): `soundFinished` is false the update before
   `sound_ret` and true on it, for all four (121 / 70 / 18 / 22).
10. *Over music* (1): `get_key_item` played over the Viridian Forest track leaves
    `music.musicTempo` untouched and leaves music channels 1–3 silent until their next note
    (the A1a hand-off; the same `SoundChannel` path as `get_item1`).
11. The existing **preload-list test** now covers the four names; no new test needed.

Expect about **+27 tests** (≈ 17 need `ROM_PATH`, 10 do not). Report the real totals; do
not copy these estimates into the docs.

Do **not** pin software fade steps (`vol0` sequences). The pulse envelope runs per frame
count, not at the hardware's 64 Hz; that is a logged A1a departure owned by V5, and a test
pinning it would freeze the wrong behaviour.

### 4.4 Registry and docs

- `src/audio/sfx_names.ts`: add the four names (alphabetical, as now) and correct its
  comment: the list is checked by `sfx_jingles.test.ts`, not a `sfx_names.test.ts` that
  does not exist. This is the only non-test, non-extractor source change, and it only makes
  `loadSharedData` preload four more files. **It belongs in checkpoint 1**: the existing
  preload-list test compares this list with `data/audio/sfx/`, so the suite is red as soon
  as setup writes the four files and stays red until the list matches.
- `game/src/audio/ARCHITECTURE.md`: the four sounds; the bank rule and the guard (a short
  paragraph, pointing here); keep the existing "Known audio departures" list and add the
  bank departure to it.
- `context/STATUS.md` (log, completed, in progress, next up), `context/CONVENTIONS.md`
  (test-suite counts and an *Added per slice* bullet), `context/ARCHITECTURE.md` (data
  contract row if useful, and the "169 files / 169 JSON" figures → 173), root `CLAUDE.md`
  **only** the test baseline (DECISIONS #42).

## 5. Expected values

Derived two ways, which agree. (a) By hand from the disassembly: `note P, L` × speed,
`square_note L + 1`, and the register formula
`reg = 2048 + (signed16(notes.asm[P]) >> (octave − 1))` (arithmetic shift), `+1` on the low
byte under `toggle_perfect_pitch`. (b) By running the scratch-extracted JSON through
`src/test/audio_rig.ts` (the A1a rig). **Sol must re-derive them independently from the
ASM and `audio/notes.asm`; if a number disagrees, believe the ASM and the ROM, stop, and
report the difference instead of adjusting a test to match.**

### 5.1 `get_key_item` (speed 5, every channel `sound_ret` on update 121)

| Channel | Note-start updates | Registers at those starts |
|---|---|---|
| 5 → pulse 1 (perfect pitch) | 1, 21, 31, 36, 41, 61, 71, 76, 81 | $6e7, $706, $706, $706, $72e, $745, $745, $745, $774 |
| 6 → pulse 2 (vibrato 4,2,3) | 1, 11, 16, 21, 41, 51, 56, 61, 71, 76, 81 | $758, $758, $758, $72d, $762, $762, $762, $773, $773, $773, $796 |
| 7 → wave | 1, 21, 41, 61, 81 | $72d, $762, $758, $744, $72d |

The registers are for the **first write at each note-start update**. Ch6's vibrato adds
later writes between notes (for example `$759` on update 9), so a test must key on the
note-start updates, not on "all writes". Ch5's A#3 is `$6e6` before perfect pitch.
(`audio_rig`'s `pulseReg` / `waveReg` turn the synth's Hz back into registers.)

### 5.2 PC sounds (`freq0` writes; a note also logs `duty0`, and update 1 logs it twice
because of the leading `duty_cycle` command, so key on `freq0`)

| Sound | Note-start updates | Registers | `sound_ret` |
|---|---|---|---|
| `turn_on_pc` | 1, 17, 33, 37, 41, 45, 49, 53, 57, 61 | $7c0, $000, $780, $700, $740, $700, $780, $700, $7c0, $700 | 70 |
| `turn_off_pc` | 1, 6, 11, 16 | $600, $400, $200, $000 | 18 |
| `enter_pc` | 1, 8, 13, 20 | $700, $000, $700, $000 | 22 |

The `$000` rows are the silent notes (`square_note n, 0, 0, 0`, volume 0). The first
register in each row is the source's decimal frequency: 1984, 1920, 1792, 1856, 1536,
1024, 512.

## 6. Checkpoints and verification

**Checkpoint 1 — data** (one commit, suite green): §4.1 extractor edits, §4.2 regenerated
files, the `sfx_names.ts` registry (§4.4, so the preload-list test passes), and the
`extraction.test.ts` block (§4.3 items 1–5). Gates: typecheck; `ROM_PATH=pokeyellow.gbc npm
test` (PowerShell: `$env:ROM_PATH='pokeyellow.gbc'; npm test`) fully green; setup twice
identical; the 8-file diff and the 861-file hash check.

**Checkpoint 2 — rig tests and docs** (one commit): the audio rig tests (§4.3 items 6–10),
the §4.4 docs, STATUS. Final gates: typecheck; ROM suite; **no-ROM suite** (the rig tests
need no ROM and must pass without it); `npm run build`; `git diff --check`; `git status`
shows no ROM and nothing untracked besides the new files.

**Smoke check (required, short; no ears):** a temporary `npx vite --host 127.0.0.1 --port
<spare> --strictPort`, load the game, click through the splash, confirm in the network
list that the four new JSON files load with 200 and no console errors, then call
`_playSFX('get_key_item')` and the three PC names and confirm `_sfxEngine().isPlaying()`
goes true and then false (about 2.0 s, 1.2 s, 0.3 s and 0.37 s). Stop the server. Do not
touch `http://127.0.0.1:5173/` or its save.

**Optional ear test, for the user (A = Z):** on `http://127.0.0.1:5173/` with DevTools open,
`_playSFX('get_key_item')`, then `turn_on_pc`, `enter_pc`, `turn_off_pc`. The key item is a
short rising three-voice jingle. The PC sounds are small bleeps. They will sound a bit
"flat" because pulse envelopes are approximated (V5), and none of them is in the game yet,
so this checks the data, not the timing in context. Sign-off does not depend on it.

## 7. What each guard must catch (for Sol's mutation checks, and for the review)

- Changing one `square_note` frequency or length in a PC JSON file fails the JSON,
  disassembly and timing tests.
- Dropping `toggle_perfect_pitch` from the key item's ch5 fails the register test.
- Making the decoder read a key-item byte as `square_note` (undoing A1a's music-mode
  switch) fails the kind test.
- Adding an SFX to `SFX_HEADERS` whose bank-`$1f` copy differs fails the bank guard until
  its author classifies it.
- Leaving the preload list short fails the existing preload-list test.

Do at least two of these as real in-memory mutations and say which in the result note.

## 8. Not in A5b3, each with a home

| Finding | Home |
|---|---|
| Bank-`$1f` copies of `save`, `turn_on_pc`, `enter_pc` (§3.3) and the **bank-aware SFX lookup** they need (music → bank, `wAudioROMBank` across fades and battles: `pokecenter.asm:54–56`, `trainers.asm:393–397`, `fade_audio.asm:42`) | **V5 SFX catch-up** designs it. **A5b7** wires `save` and must say, in its result, that it uses the bank-`$02` copy in Oak's Lab / the Forest unless this was resolved. **G1** (Silph Co. 11F PC) needs the bank-`$1f` variants |
| Wiring the key-item sound | A5b4 (the text runner's `sound` op) and the A5b5 callers |
| Wiring the PC sounds | A5b7 |
| Oak speech: `SFX_SHRINK`, the Pikachu cry | A5b6 logs the cry gap (decision #45.4); `shrink` is V5, the cry J2 |
| Town Map `SFX_TINK`, `SFX_HEAL_AILMENT`; the nurse's `SFX_HEALING_MACHINE`; Itemfinder; `SFX_DENIED` | V5 (SFX catch-up), J2 (Pokécenter audit), A3, A2 |
| `caught_mon`, `dex_page_added`, `pokedex_rating` | A5f / V5 |
| Pulse envelopes at 64 Hz, SFX priority by sound ID, `PlayMusic` clearing SFX channels, noise-channel rests | V5 (A1a §8, unchanged) |

## 9. Decisions (O-18) — **resolved 2026-10-11: the user took both recommendations**

1. **Scope: the four bank-`$02` sounds exactly as #45 limits it, extractor headers only.**
   Recommended: **yes.** The dry run and the rig show the existing decoder and interpreter
   are already exact for them.
2. **The bank-`$1f` variants of `save`, `turn_on_pc` and `enter_pc`: defer them, keep the
   guard test.** Recommended: **defer.** Extracting them now needs a naming scheme and a
   selection rule (current music's bank) that nothing could use before V5, and a wrong
   guess there costs more than regenerating three files later. The guard test means the
   departure cannot be forgotten, and A5b7 and G1 are named in §8.
   *Alternative:* extract the three now as `save_audio3`, `turn_on_pc_audio3`,
   `enter_pc_audio3` (+6 files), still unwired. Cheaper than it sounds, but it fixes the
   naming before the lookup is designed.
3. *(Already stated by the user, recorded as DECISIONS #47.)* Claude plans, Sol (GPT-6.1)
   implements, Claude reviews. The user may add the optional ear test (§6).

## 10. Handoff for Sol

> Implement **A5b3** exactly as `notes/28-a5b3-plan.md` says. The user has approved it
> with both recommendations (O-18, DECISIONS #47): the four bank-`$02` sounds, headers
> only, and the bank-`$1f` variants **deferred** (no `*_audio3` files). Read the files
> listed at the top of that note first. Claim the slice in `context/STATUS.md` →
> *In progress* with your model name and the date.
>
> Two checkpoints, each a local commit with the co-author line, staging specific paths
> only (the ROM is gitignored; `git status` must never show it). Run `git status` before
> staging and never commit changes you did not make; if `context/*.md` shows edits you did
> not make (an editor's Markdown formatter has reformatted STATUS.md once already), ask
> the user. Do not push. Do not start A5b4. Do not edit `refs/**`. Many files under `game/src` are CRLF on disk: use the Edit
> tool, not a multi-line string replace, and run `git diff --check`.
>
> The numbers in §5 are the plan's, not an oracle: re-derive them from the ASM first, and
> if anything in this note disagrees with the disassembly or the ROM, **stop and tell the
> user** rather than bending a test. Leave `decodeChannelCommands`, the audio engines and
> the synthesizer alone.
>
> Finish by updating `STATUS.md` (completed row with commits and counts, in progress,
> next up, session log), the *Added per slice* bullet in `CONVENTIONS.md`, and the
> baseline line in root `CLAUDE.md`; then write the **Implementation result** at the
> bottom of this note: what changed, the commit hashes, the verification you ran (typecheck,
> ROM suite, no-ROM suite, build, setup twice, the 861-file hash check, the mutations you
> did, the smoke check), the new test counts, and anything that surprised you. Claude
> reviews next (`notes/29-a5b3-review.md`).

## Planning verification (what I read and ran; nothing here changed the repository)

- Read: all seven context files, the audio, overworld and text subsystem docs, `23-a5b-plan.md`
  in full, `16-a1a-plan.md`, `26-a5b2-plan.md`'s shape, `home/text.asm` (`TextCommand_SOUND`,
  `TextCommandSounds`), `home/audio.asm` (`PlaySound`, `DetermineAudioFunction`, bank
  variables), `engine_1.asm` (SFX note, note length, `SetSfxTempo`), `macros/scripts/audio.asm`,
  `audio/notes.asm`, the headers for banks 1–4, `constants/music_constants.asm`, all eight
  `_1`/`_3` source files for the four sounds, `menus/pc.asm`, `players_pc.asm`,
  `pokemon/bills_pc.asm`, `data/events/hidden_events.asm`, `data/maps/songs.asm`, and the
  scripts and engines that play sounds on the current maps; the extractor, both name lists,
  the A1a jingle tests, `audio_rig.ts`, `sfx_engine.ts`, `audio/index.ts`.
- Ran (all in the session scratchpad; the repository is unchanged): the ROM's SHA1; a
  byte-level walk of the four sounds' headers and streams in banks `$02` and `$1f`; a
  16-sound bank comparison; a scratch copy of `extractors/audio.ts` with four extra
  `SFX_HEADERS` rows, decoded against the ROM and compared by eye with the sources; the
  scratch data through the A1a rig for note starts, registers, `sound_ret` and
  `soundFinished`; the per-channel frame totals for `save`, `turn_on_pc` and `enter_pc` in
  both banks.
- **Not** run: typecheck, the test suites, the build, `npm run setup`, a browser. Those
  baselines are the recorded A5b2 results.

## Implementation result — 2026-10-11, Codex/Sol

**A5b3 implementation is complete; awaiting Claude Opus review.** Started from
`8598bd9` (the approved-plan handoff), with a clean working tree. The user
explicitly authorized code and Markdown edits. Both O-18 recommendations were
already accepted in DECISIONS #47. No A5b4 work was started.

Implemented the approved two-checkpoint plan:

1. **`ad423e1` — A5b3: extract key-item and PC sounds.** Added exactly the four
   bank-$02 headers to `rom/extractors/audio.ts`. Extracted the existing body into
   `extractSfxAt(rom, bank, addr)` without changing its decoding, and exported
   `SFX_HEADERS` so the bank guard iterates the actual table, including future
   additions. Added the four preload names and corrected the registry's test-file
   comment. Reused the A1a ASM parser at file scope and added its `square_note`
   case (raw fade nibble preserved; unknown macros still throw). Added 17 ROM
   tests for the four headers/pointers, JSON/source commands, music/SFX kind,
   the complete table's bank differences, and both banks' return updates.
   Typecheck and **1005/1005** tests passed at this checkpoint.
2. **`d90aaad` — A5b3: verify key-item and PC playback.** Added 10 no-ROM tests
   in `audio/sfx_key_item_pc.test.ts`: three key-item channel timing tests, two
   pitch/mapping tests, three PC timing/register traces, the four-sound wait
   table, and the actual Viridian Forest track's tempo and music hand-off.
   Updated the baseline/data counts, audio-bank limitation and handoff docs.

This final documentation-only handoff commit records both checkpoint hashes and
this result after the checkpoint commits exist. Review the slice against
`8598bd9`; the remaining changes in this handoff are note 28 and STATUS references.
Nothing was pushed.

**Independent source verification.** Read the four `_1` sounds and `_3` variants,
both save variants, the audio macros, `audio/notes.asm`, `Audio1_note_length`,
`Audio1_CalculateFrequency`, `Audio1_SetSfxTempo`, `DetermineAudioFunction` and
`WaitForSoundToFinish`. Checked the owner's ROM SHA1 and pret's symbol addresses.
A scratch source-only calculation (no engine/extractor imports) derived every
note-start update and register in §5 and each bank's return updates in §3.3.
All plan values matched. Key-item channels return at 121; bank-$02 PC sounds
at 70/18/22. The guard found exactly save, turn_on_pc and enter_pc different.

**Verification completed:**

- `npm run typecheck` — clean.
- `ROM_PATH=pokeyellow.gbc npm test` — **1015/1015**, 47 files.
- With ROM_PATH removed, `npm test` — **898 pass / 117 skip**, 47 files.
- `npm run build` — clean (111 modules; JS 328.20 kB, 95.48 kB gzip).
- Setup ran twice. First-run SHA256 comparison: **all 861 previous generated
  files unchanged**, exactly **eight new files**, total **869**. Second-run
  hashes: **all 869 byte-identical**. Each tree now has **173 JSON**; static also
  has the same 520 PNGs and three tilemaps. No generated file was hand-edited.
- Three **real in-memory mutations**, through the actual audio rig in a scratch
  script: turn_on_pc's first frequency +1; its first length -1; removal of
  get_key_item ch5's toggle_perfect_pitch. Each failed the same source-derived
  register/timing trace assertion that passed for unmodified data. No mutation
  was written to the repo or ROM; software envelope steps were not pinned.
- Required browser smoke: headless Chrome on isolated
  `http://127.0.0.1:5187/`, trusted splash click, all four preload requests
  **HTTP 200**, zero console errors/runtime exceptions. Each `_playSFX` call
  made `_sfxEngine().isPlaying()` true then false; measured times in plan order
  were **2025 / 1180 / 297 / 367 ms**. The origin had no game save; its storage
  was cleared, Chrome closed and Vite stopped. User's :5173 origin was untouched.
- `git diff --check` — clean; ROM ignored and unstaged. Commits staged only
  the slice's specific paths. No listening smoke server remains.

**Surprises / scope notes.** No discrepancy in the plan's four-sound fixtures.
While adding the extra Forest integration trace, an initial wave-resume estimate
was corrected against `Music_Dungeon2_Ch3 .sub2`: its source lengths are
2/4/1/3/1/1/4, so the second call's rest spans global updates 122–148 and the
next wave note is 149 (pulse channels resume at 136). The source-correct test
passes; no engine change was needed. This does not change any §5 fixture.

`decodeChannelCommands`, both setup name lists, all audio engines and the
synthesizer are unchanged. The only production runtime edit is the preload
registry. The four sounds have no new gameplay call sites. Bank-aware SFX lookup,
bank-$1f variant files and other SFX remain deferred as approved; A5b7's save wait
still inherits the documented bank-$02 approximation on Oak's Lab/Forest/cave
maps until V5 resolves it. Optional listening verification was not performed.

**Next:** Claude Opus reviews A5b3 and writes `notes/29-a5b3-review.md`.
