# A1a — Music-mode SFX: the two item jingles

**2026-10-06 · planned by Claude Opus 5.5. Planning only; no code yet.**

Start from **`f6ff8a1`**. A6 is done and user-verified. A1a is the first of A1's three
slices (DECISIONS #35: A1a jingles → A1b item balls and hidden items → A1c trainer
sight). This plan refines `notes/07-a1-plan.md` §1.3 and §2.1, which were written before
the probes below. The user picks the implementer; by the alternating pattern, Sol (Codex)
implements and Claude reviews. The recommendations in §9 are proposed, not settled.

Sources: `refs/pokeyellow` @ `e89ead15` (`audio/engine_1.asm`, `engine_2.asm`
`Audio2_InitSFXVariables`, `engine_3.asm`, `home/audio.asm`, `home/delay.asm`,
`home/text.asm` `TextCommand_SOUND`, `home/vblank.asm`, `audio/sfx/get_item{1,2}_*.asm`,
`audio/headers/sfxheaders*.asm`, `audio/wave_samples.asm`, `constants/music_constants.asm`)
and pret's sym file. Cross-checked with gen1recomp (`tests/engine/wave_channel_mix_bug429.lua`).
Line numbers below are `engine_1.asm`'s unless a file is named.

## TL;DR

- **The jingles are small and exact.** Three channels each (5, 6, 7), all music
  commands after `execute_music`. `get_item1` lasts **72 frames** on every channel and
  `get_item2` **180**; every channel reads `sound_ret` on the same audio update (73, 181).
- **Playing them through today's music engine would break the map music.** Its one
  global `tempo` would take the jingle's `tempo 256`, so the Forest track (`tempo 144`)
  would play about 1.8× fast from the first pickup on. Its channels are mapped by array
  position, so SFX channels 5–7 would land on the wrong hardware.
- **The interpreter the jingles need has four departures from the cartridge, and all
  four reach the map music too** (§3.5):
  - `toggle_perfect_pitch` is ignored. 43 tracks use it.
  - Vibrato's period is one frame short. Rate 0 turns vibrato **off**, where the
    cartridge vibrates every frame: the bass of the wild, trainer and gym-leader battle
    themes, and Route 3's.
  - **The wave channel plays one octave too high**, in every track. Hardware ch3 runs
    at 65536/(2048−x), half the pulse formula. Our synth gives it the pulse's
    131072/(2048−x). gen1recomp found and fixed the same bug (its #429).
  - When an SFX ends, the music note it covered is restored mid-note. On the cartridge
    the channel stays quiet until its next note or rest.
- **`WaitForSoundToFinish` also waits on music drums.** Yellow plays every drum hit as a
  noise-instrument SFX on software channel 8, and the wait checks 5, 6 and 8 (not 7).
  In the Forest a drum can hold the wait one frame longer.
- **One slice, four checkpoints, 7 decisions (§9).** Reply **go** to take all the
  recommendations.

## 1. Outcome and boundary

After A1a:

1. `npm run setup` extracts `get_item1` and `get_item2` (12 SFX in all). Bytes after
   `execute_music` decode as music.
2. `playSFX('get_item1' | 'get_item2')` plays them, frame-exact, over any map music,
   without disturbing that music's tempo.
3. `isSoundFinished()` answers `WaitForSoundToFinish`'s question on the right audio
   update. A1b's text box polls it.
4. Music and music-mode SFX share **one channel interpreter**, and the parts the jingles
   use follow `engine_1.asm` exactly. So does the hand-off between an SFX and the music
   underneath it.

**Not in A1a:** nothing in the game plays the jingles yet. Item balls, hidden items and
the text box that waits on the sound are A1b. The other music-mode SFX (key item, level
up, caught mon, Pokédex) stay in V5. The remaining audio departures are in §8.

**Hard rules hold.** The browser loads two more committed JSON files. Nothing reads the
ROM at runtime, and no emulation is involved.

## 2. Today's code (what changes and why)

| Where | Today | Problem for A1a |
|---|---|---|
| `rom/extractors/audio.ts:384` | records `execute_music`, keeps decoding in SFX mode | `get_item2` ch5's `note D_, 4` (`$23`) and `note D_, 2` (`$21`) decode as `square_note` |
| `extractors/audio.ts:124` `SFX_HEADERS` | 10 entries | no jingles. Both setup name lists already contain `get_item1` / `get_item2` |
| `audio/music_engine.ts:401` | `tempo` sets the one `this.tempo` | an SFX's `tempo` would retime the music |
| `music_engine.ts:660` `getChannelIndex` | hardware channel = array position | SFX channels 5–7 need it from the id |
| `music_engine.ts:491` | `toggle_perfect_pitch` flips a flag nothing reads | ch5 of both jingles uses it |
| `music_engine.ts:316` `applyVibrato` | period = rate; rate 0 = off; ±extent on the whole register; direction reset each note | the jingles use vibrato (6,2,6 and 8,2,7) |
| `synthesizer.ts:154` `sampleWave` | one 32-sample cycle per 1/f, with f = 131072/(2048−x) | one octave high. The jingles' ch7 is the wave channel |
| `music_engine.ts:417` | the wave instrument is loaded at `note_type` only | an SFX on ch7 leaves its wave in the synth |
| `music_engine.ts:717` `restoreChannel` | the music note resumes when the SFX ends | the cartridge resumes at the next note or rest |
| `audio/index.ts:151` `tickAudio` | SFX ticked before music | the cartridge runs CHAN1 → CHAN8 |
| `sfx_engine.ts` | SFX-mode commands only, skips `note`/`octave`/`note_type` | the jingles would be silent and end at once |

## 3. What the cartridge does

### 3.1 The jingles (`audio/sfx/get_item1_1.asm`, `get_item2_1.asm`)

Headers from pret's sym file (labels, not a byte search; CONVENTIONS):
`SFX_Get_Item1_1` **02:4192** → Ch5 02:6c4a, Ch6 02:6c61, Ch7 02:6c71;
`SFX_Get_Item2_1` **02:419b** → Ch5 02:71e9, Ch6 02:7208, Ch7 02:7220.
Banks 3 and 4 hold byte-identical copies (diffed: only the labels differ), bank 2 has
no `get_item1` (`TextCommandSounds` notes it plays `SFX_LEVEL_UP` in battle). One JSON
per name is exact for every map.

`get_item1`, with the SFX tempo always $0100 (§3.3), so a note lasts length × speed:

| Ch | Commands | Notes (frames) | `sound_ret` |
|---|---|---|---|
| 5 | `execute_music`, `tempo 256`, `volume 7,7`, `vibrato 6,2,6`, `duty_cycle 2`, `toggle_perfect_pitch`, `note_type 4,11,1`, `octave 3` | G#3 8, 8, 8; `note_type 12,11,3`, `octave 4`, E4 48 | update 73 |
| 6 | `execute_music`, `vibrato 8,2,7`, `duty_cycle 2`, `note_type 4,12,1`, `octave 4` | E4 8, 8, 8; `note_type 12,12,3`, B4 48 | 73 |
| 7 | `execute_music`, `note_type 4,1,0`, `octave 4` | B4 4, rest 4 (×3); `note_type 12,1,0`, B4 24, rest 24 | 73 |

`get_item2`: speed 5 throughout, notes of 20/20/40, six of 10, then 40 on ch5 and ch6.
Ch7 has 20/20/40, twelve 5-frame notes and rests, then 40. Every channel reads `sound_ret`
at **update 181**. Ch6 has no `tempo`; ch5's is the only one.

Counting: `PlaySound` runs between updates and leaves each channel's delay counter at 1
(`Audio2_InitSFXVariables`). So the first note plays on the next update (1), a note of
d frames hands over on update start + d, and `sound_ret` comes on update 73 / 181.

Registers (pret `notes.asm` via `Audio1_CalculateFrequency`): G#3 = $06c4, so **$06c5
with perfect pitch**; E4 $0739; B4 $077b; D4 $0720; C4 $0705; A3 $06d6; F5 $07a2;
A5 $07b5.

### 3.2 One update routine for every bank

`home/vblank.asm:65` always calls `Audio1_UpdateMusic`. Engines 2–4 contain only their
own `PlaySound` and init routines; `Audio3_PlaySound` differs from `Audio1_PlaySound` in
one music-ID threshold (diffed). So the interpreter is the same on every map, and the
Forest's bank 1f behaves like bank 02.

### 3.3 SFX tempo is always $0100 here

- `Audio1_tempo` (485): on CHAN5–8 it writes **`wSfxTempo`**, not `wMusicTempo`, and
  clears the fractional parts of CHAN5–8 only.
- `Audio1_note_length` (700–746) then calls `Audio1_SetSfxTempo` (983) before every SFX
  note. For anything that isn't a cry or a battle SFX it sets `wSfxTempo` = $0100. CHAN8
  uses $0100 without the call.
- So an SFX's `tempo` command never affects anything. Music never sees it.
- The arithmetic: `(length × speed) & $ff` (`ld a, l`), times the tempo plus the
  channel's fractional byte (`Audio1_MultiplyAdd`, 16-bit), high byte = the delay (an
  8-bit counter, so 0 would mean 256), low byte = the new fraction. A whole-library
  simulation (every track, 3 minutes, with control flow) never produces a zero delay
  or a 16-bit overflow (largest product 41,472). Porting it exactly changes nothing today.

### 3.4 How an SFX and the music under it hand over

- **Order:** `Audio1_UpdateMusic` (3–35) runs CHAN1 → CHAN8 each frame. Music first.
- **Suppression** (`ApplyMusicAffects` 48–56): a music channel whose SFX counterpart
  (`wChannelSoundIDs + CHAN5 + c`) is busy still counts its delay, but runs **no
  effects**: no vibrato, pitch slide or duty rotation. Its notes and rests write nothing
  (`note_pitch` 766–771, 815–826), and its frequency byte isn't updated.
- **Start:** `PlaySound` sets the channels' IDs at once, so the music is suppressed from
  the next update. The SFX's first note overwrites the hardware channel.
- **End** (`Audio1_sound_ret` 186–207, 257–259): the channel's ID goes to 0. Pulse
  output stays enabled with whatever the SFX last wrote, so its last note's envelope
  decays on its own. On CHAN7 the wave DAC is turned off and on, which stops the wave.
- **After:** nothing re-triggers the music. Its effects resume (vibrato writes only the
  frequency low byte), but the channel sounds again only when its next note or rest
  writes the volume envelope and restarts it.
- **Wave pattern** (`ApplyWavePatternAndFrequency` 916–953): every note on CHAN3 or CHAN7
  reloads wave RAM from that channel's own instrument (`wMusicWaveInstrument` /
  `wSfxWaveInstrument`, set by `note_type` 357–364). The music's bass gets its own wave
  back at its next note.
- **The jingles end almost silent.** Both end their ch7 with a rest. `get_item1`'s last
  pulse notes (volume 11–12, fade 3, 48 frames) decay to 0 before `sound_ret`.
  `get_item2`'s (fade 4, 40 frames) end at volume 1–2. So dropping the SFX tail at
  `sound_ret` (§8) costs these two jingles about 2 hardware envelope steps.

### 3.5 The commands the jingles use, against today's interpreter

| Command | `engine_1.asm` | Ours | Reaches music |
|---|---|---|---|
| `toggle_perfect_pitch` | 381–391 flips the bit; `note_pitch` 841–846 adds 1 to the frequency **low byte only**. The `jr nc` after `inc e` is always taken, because carry is clear there on every path, so `inc d` never runs and $ff wraps to $00 | ignored | 43 tracks |
| `vibrato d, n, r` | 393–439: delay counter and its reload = d; extents byte = (⌈n/2⌉ << 4) \| ⌊n/2⌋; rate byte = (r << 4) \| r | delay ✓, extents ✓ | — |
| vibrato each frame | 79–142: delay counts down first. Then the rate's low nibble counts down to 0, so it fires **every r+1 frames** (every frame at r = 0). Low byte only: up = min(low + ⌈n/2⌉, $ff), down = max(low − ⌊n/2⌋, 0), from the note's base low byte. Direction bit alternates, starts clear (up first) and is reset only by `Init*Variables`, not per note | every r frames; r = 0 → off; whole register; reset per note | all vibrato tracks; the battle themes' and Route 3's ch3 use r = 0 |
| delay reload | `PlayNextNote` 149–154 reloads the vibrato delay at every note | ✓ | — |
| wave pitch | hardware: 65536/(2048−x) | 131072/(2048−x) | every ch3 line, one octave high |
| `note_type` on ch3/7 | 357–369: instrument = low nibble; level = (byte & $30) << 1 | ✓ stored; loaded only at `note_type` | — |
| `tempo` | §3.3 | one global | — |
| `volume` | 557–562 NR50 | ✓ | — |
| `duty_cycle`, `octave`, `note`, `rest`, `sound_ret` | ✓ as ported | ✓ | — |

### 3.6 `WaitForSoundToFinish` (`home/delay.asm`)

- It loops until `wChannelSoundIDs` for CHAN5, CHAN6 and **CHAN8** are all 0. CHAN7 is
  skipped (`inc hl` ×3). The low-health-alarm early return is battle-only.
- It spins in the main loop while VBlank keeps updating the audio. So the text engine
  continues in the frame after the update that cleared the last channel.
- **Drums occupy CHAN8.** A music `drum_note` calls `DetermineAudioFunction` (688–695),
  which plays noise instrument n as an SFX on software channel 8. Its sound ID stays set
  for Σ(length + 1) frames over the instrument's `noise_note`s (tempo $0100, speed 1).
  That's 1 frame for most instruments, 2 for #15, 3 for #7, 4 for #16, and 33 for #5.
  The Forest uses 9–13 (1 frame each). Route 1 uses 15, Viridian 6–8, and only the
  title screen uses 5.
- **A drum can't replace a drum** (`Audio1_PlaySound` 1425–1431): a noise instrument
  finding CHAN8 busy returns. A real SFX on CHAN8 replaces a drum (1433–1436). So a
  drum during instrument 5's 33 frames is dropped (title screen only).
- For these two jingles CHAN7 ends with 5 and 6, so the skip doesn't matter. CHAN8
  does: a drum hit on update 73 holds the wait to 74.

### 3.7 SFX channel defaults (`Audio2_InitSFXVariables`, engine_2.asm:272)

Zeroed: flags (so perfect pitch is off, the vibrato direction is clear and
`execute_music` is off), duty, duty pattern, vibrato, the frequency low byte and the
pitch-slide state. Set to 1: the loop counter, the delay counter and the note speed.
**Not reset:** octave, `wChannelVolumes` and the fractional byte. Both jingles set
`note_type` and `octave` before their first note on every channel, and at tempo $0100 the
fraction can't change a delay. So a fresh channel object per play is exact for them.

## 4. The plan

### 4.1 Extractor (`rom/extractors/audio.ts`)

- `decodeChannelCommands`: once `execute_music` is decoded, the channel is in music mode.
  `$10` (`pitch_sweep`) and `$2x` (`square_note` / `noise_note`) are then decoded as
  notes, as `Audio1_sfx_note` (586–596) and `Audio1_pitch_sweep` (638–649) require.
  Everything else is unchanged.
- `SFX_HEADERS` += `get_item1: 02:4192`, `get_item2: 02:419b`, with the sym labels in a
  comment.
- `npm run setup pokeyellow.gbc`: the regenerated diff must be exactly
  `data/audio/sfx/get_item{1,2}.json` and their `static/` mirrors (167 JSON in each
  tree). DECISIONS #35's exception covers data riding with this engine slice.

### 4.2 One channel interpreter (`audio/sound_channel.ts`, new)

Move `MusicEngine`'s per-channel state and `playNextNote` / effects into a
`SoundChannel` class: one software channel of `Audio1_UpdateMusic`, id 1–8.
- **The hardware channel comes from the id:** `(id − 1) & 3`.
- **Context the channel needs:** the synth, wave samples, noise instruments, and a tempo
  source. For music channels that's the music tempo. For SFX channels it's $0100, and
  their `tempo` command only clears the SFX fractions (§3.3).
- **`MusicEngine`** keeps the music tempo, builds a `SoundChannel` per track channel, and
  ticks them in id order.
- **`SfxEngine`** builds a `SoundChannel` (SFX defaults per §3.7) for a channel whose
  first command is `execute_music`. That's true of every music-mode SFX in pret except
  the Poké Flute's channel-repointing trick (E1). SFX-mode channels keep today's code.

Checkpoint 2 is this move alone, with music output unchanged (§6).

### 4.3 Exact rules in the shared interpreter

1. Note length per §3.3: `(length × speed) & $ff`, 16-bit product with the fraction, an
   8-bit counter (0 counts as 256). A music `tempo` clears the fractions of channels 1–4.
2. `toggle_perfect_pitch` per §3.5: the low byte +1 with the wrap. The base low byte
   includes it.
3. Vibrato per §3.5, rate 0 included. The rate counter isn't touched by notes.
4. **The wave channel at 65536/(2048−x).** One place: the synth's wave phase step, or the
   value the engines hand it. Test it at the synth boundary.
5. Every note on a wave channel loads the channel's own instrument into the synth, then
   sets the level.
6. **Suppression** (§3.4): a music channel whose hardware channel has a busy SFX counts
   its delay and runs its commands, but writes nothing and runs no effects. That
   includes our software volume fade, which stands in for the hardware envelope the SFX
   now owns. Its note doesn't update its frequency base.
7. **Release:** when an SFX channel ends, its hardware channel is silenced (§8 logs the
   dropped tail). The music channel on it writes no volume until its next note or rest.
   `restoreChannel` goes.
8. **Order:** `tickAudio` runs music channels 1–4, then SFX channels 5–8.

Pitch slides, duty-pattern rotation, drum step timing and noise-channel rests are not
exercised by the jingles. They move unchanged (§8).

### 4.4 Drums on channel 8

`MusicEngine` keeps an occupancy counter for software channel 8:
- A drum hit sets it to Σ(length + 1) over its instrument's steps.
- Each later update counts it down, at channel 8's place in the order.
- A drum hit is dropped while channel 8 is busy with a drum or a real SFX (audio
  included, which is §3.6's rule).
- A real SFX starting on channel 8 clears the drum's count.

Today's drum audio otherwise stays as it is (§8).

### 4.5 API (`audio/index.ts`)

- **`isSoundFinished(): boolean`**, `WaitForSoundToFinish`'s condition: SFX channels 5
  and 6 idle and channel 8 idle (a real SFX or a drum hit), with 7 ignored. A requested
  SFX that's still loading counts as playing; a failed load clears that state.
- **Preload** every extracted SFX in `loadSharedData`, so `playSFX` starts synchronously
  in the frame it's called, as `PlaySound` does. A test checks that the list matches
  `data/audio/sfx/`.
- **Console helper `_playSFX(name)`** beside upstream's `_audioEngine` / `_audioSynth` /
  `_sfxEngine` (decision 5).
- `isSfxPlaying(name)` keeps its meaning (collision replay).

### 4.6 The test flake

`static_export.test.ts` › "static/ is up to date": an explicit 30 s timeout on that one
test (decision 6). It reads ~850 files and timed out on a cold cache on 2026-09-28 and
2026-10-06.

## 5. File ownership

| File | Change |
|---|---|
| `src/rom/extractors/audio.ts` | music mode after `execute_music`; 2 headers |
| `data/audio/sfx/get_item{1,2}.json`, `static/audio/sfx/…` | generated, never hand-edited |
| `src/audio/sound_channel.ts` | new: the shared interpreter (§4.2, §4.3) |
| `src/audio/music_engine.ts` | composes `SoundChannel`s; music tempo; channel-8 drum occupancy |
| `src/audio/sfx_engine.ts` | music-mode channels via `SoundChannel`; release instead of restore; busy query for 5/6/8 |
| `src/audio/synthesizer.ts` | wave pitch (§4.3.4) |
| `src/audio/index.ts` | tick order; `isSoundFinished`; preload; `_playSFX` |
| `src/audio/*.test.ts` | new (§6); import the engines, never `index.ts` (it touches `window`) |
| `src/rom/__tests__/extraction.test.ts`, `static_export.test.ts` | §6; the timeout |
| root `CLAUDE.md` (Audio, Testing), `src/` docs as needed, `context/*` | on completion |

Nothing outside `src/audio`, `src/rom` and their tests changes. Nothing calls the
jingles in-game until A1b.

## 6. Checkpoints and verification

**Checkpoint 1: data.** The extractor change, the headers and setup run twice
(byte-identical). Diff exactly as in §4.1. ROM tests:
- the two headers have 3 channels, ids 5/6/7, pointing at the sym addresses in §3.1;
- each decoded channel equals the commands parsed from pret's
  `audio/sfx/get_item{1,2}_1.asm` (a small macro parser; skip if `refs/` is absent, as
  the Pikachu pixel tests do). In particular `get_item2` ch5's D_ notes are notes.

**Checkpoint 2: the move.** `SoundChannel` extracted with no behavior change. Before
moving, record a per-update synth-state trace of every track for 3,600 updates on the
current code. The moved code must reproduce it exactly. Record the hash in the result
note; it's a scratch check like A6d's following trace, not a committed test.

**Checkpoint 3: the rules** (§4.3, §4.4). Tests with a real `GBSynthesizer` (it builds
no `AudioContext` until `init()`), reading its public channel state each update:
1. Note timing: per channel, the update each note starts on for both jingles (`get_item1`
   1, 9, 17, 25, end 73; ch7's rests; `get_item2` … end 181).
2. Tempo: the Forest track's note lengths are identical with and without a jingle played
   in the middle. The jingle's `tempo` reaches no music state.
3. Channel by id: 5 → pulse 1, 6 → pulse 2, 7 → wave.
4. Perfect pitch: G#3 sounds at $06c5; a synthetic $xff note wraps to $x00.
5. Vibrato: delay, then every r+1 updates, up first, extents ⌈n/2⌉/⌊n/2⌋, the low-byte
   clamps at $00/$ff, direction kept across notes, r = 0 every update. Use synthetic
   channels plus the battle theme's ch3 command.
6. Note-length arithmetic: the 8-bit counter and 16-bit product (synthetic), the music
   tempo clearing fractions 1–4. A whole-library run shows no zero delay or overflow.
7. Wave pitch: a wave note sounds at half its pulse frequency.
8. Suppression: while the jingle plays, music channels 1–3 write nothing and their
   vibrato counters don't move. Music channel 4 (drums) keeps playing.
9. Release: after the jingle, a music channel mid-note stays silent until its next note
   or rest. A wave note then plays the music's instrument, not the jingle's. On update 73
   the music is still suppressed (order).

**Checkpoint 4: SFX and the wait.**
10. `isSoundFinished()`: false through update 72 / 180, true after 73 / 181 with no
    drums; a synthetic SFX whose ch7 outlasts 5 and 6 finishes when 5 and 6 do; a drum
    hit on the last update holds it one more update; a real SFX on ch8 counts; a loading
    SFX counts; a failed load doesn't hang.
11. Drums: a hit during a sounding instrument #5 is dropped; a real SFX replaces a hit.
12. SFX-mode sounds (`press_ab`, `collision`, …) keep their frame timing; only the
    release rule changes for them.
13. The preload list matches `data/audio/sfx/`.

**Final:** typecheck; ROM suite; no-ROM suite (new audio tests need no ROM); build;
`git diff --check`; the regenerated diff; and three back-to-back full runs (the flake).

**Agent's browser check** (no ears): a temporary server on a spare port. Warp to the
Forest, call `_playSFX('get_item1')` and sample `_audioSynth()` once per update:
- the expected registers and timing appear on pulse 1, pulse 2 and wave;
- the Forest's channels come back at their next notes;
- the music's note cadence is unchanged afterwards (tempo 144).

Then `get_item2`. No console errors. Stop the server.

## 7. The user's play-test (ear; A = Z, B = X)

On `http://127.0.0.1:5173/`, DevTools console open:

1. **Viridian Forest** (debug warp): `_playSFX('get_item1')`. A short three-note jingle.
   The Forest melody drops out while it plays, its drums keep going, and afterwards the
   music continues **at its normal speed**.
2. `_playSFX('get_item2')`: the longer hidden-item jingle, same checks.
3. **Any map's music:** the bass/countermelody (wave channel) is now an octave lower.
   That's the cartridge's pitch. Several tracks gain the slight chorus of perfect pitch.
4. **A wild battle** (Route 1 grass): the bass line has its fast wobble now (vibrato
   every frame).
5. **START menu over music, pressing A a few times:** each beep cuts the melody. It comes
   back at its next note rather than mid-note, so a short gap is expected.
6. **Title screen:** listen to the drums (instrument #5 now blocks other hits for its 33
   frames, as on the cartridge).

## 8. Not in A1a, each with a home

| Finding | Source | Home |
|---|---|---|
| SFX tails: on hardware a pulse SFX's last note keeps decaying after `sound_ret`; we silence it. Pulse fades step per frame count, not at the hardware's 64 Hz. Fix: a pulse envelope in the synth, as the noise channel has | §3.4 | V5 audio |
| SFX priority by sound ID (`Audio1_PlaySound` 1437–1442: a lower ID wins a busy channel); `playSFX` always replaces | 1403–1449 | V5 |
| `PlayMusic` clears SFX channels 5–8 (`wNewSoundID`); our `playMusic` doesn't | `home/audio.asm` | V5 |
| Pitch slide: the algorithm and length modifiers differ (lavender, pkmnhealed, safarizone, titlescreen). *Done in A1a: a slide now skips vibrato (73–78) and ends at the next note (149–159).* | 1087–1289 | V5 / J2 audio audit |
| Duty-pattern rotation is one step behind (jigglypuffsong, surfing) | 1290–1306 | V5 / J2 |
| A music rest on the noise channel should silence it (NR42 $08 + restart); ours lets it ring | `note_pitch` 773–794 | V5 / J2 |
| Drum steps last `length` frames; the cartridge's last `length + 1` | §3.6 | V5 / J2 |
| `.wave5` (Lavender Town, Pokémon Tower) isn't extracted: `extractWaveSamples` reads 5 of Yellow's 6 waves | `wave_samples.asm` | before D2 (V5) |
| The decoder runs past a channel's final infinite `sound_loop` into the next track (e.g. `dungeon2` ch4 "instruments" 229/230/255). Unreachable, but it pollutes data scans | `extractors/audio.ts` | V5 |
| SFX channel 8's decoder rules are music channel 4's (no `note_type` parameter, `$Bx` as drums); unused by today's SFX | 337–349, 654–662 | V5 |
| Cries and battle SFX use `wTempoModifier` (`SetSfxTempo`'s other branch) | 983–998 | J2 cries |
| Stereo panning and the earphone sound options | 514, 854–889 | J2 options |
| Other jingle users on today's maps: Route 1's Potion sample (`sound_get_item_1`), the Viridian fisher's TM42 (`sound_get_item_2`, needs A2's TMs) | `scripts/Route1_2.asm:26`, `ViridianCity_2.asm:115` | A1b's plan decides the sample; TM42 with A2 |

## 9. Decisions (O-13)

1. **One shared channel interpreter** (`SoundChannel`) used by the music and by
   music-mode SFX channels. **Recommended: yes.** It's what the cartridge has. Rejected:
   copying the interpreter into `sfx_engine.ts`, where the two copies drift; and having
   `SfxEngine` call into `MusicEngine`'s private channels.
2. **Port the cartridge's hand-off for every SFX:** music first in each update; a
   suppressed channel does nothing but count; after the SFX it stays silent until its
   next note or rest; the wave reloaded per note. **Recommended: yes.** It changes how
   `press_ab` sounds over music (§7.5). The alternative keeps upstream's mid-note
   restore, which the cartridge never does.
3. **The exact rules of §4.3 in the shared interpreter, music included:** perfect pitch,
   vibrato with rate 0, the wave octave, separate SFX tempo, channel by id, exact note
   arithmetic. **Recommended: yes.** The jingles use every one, and the code is shared.
   This is the slice's most audible change: every wave line drops an octave, 43 tracks
   gain perfect pitch, and the battle bass gets its vibrato. Rejected: an SFX-only
   switch, which forks what the cartridge shares.
4. **Model channel 8's drum occupancy, with the drop rule.** **Recommended: yes.** It's
   ~20 lines and makes the wait exact on maps with drums. Without it the wait ends up to
   1 frame early in the Forest.
5. **How you hear the jingles before A1b: a console helper `_playSFX(name)`** next to
   upstream's existing console helpers. **Recommended: yes.** No UI and no game change;
   J2 decides its fate with the rest of the debug tooling. Alternatives: a temporary key
   hook, which must be removed before the commit and so before the review; or waiting
   for A1b.
6. **The `static_export` timeout rides with A1a.** **Recommended: yes.** It's a
   one-line, test-only change, and A1a reruns setup.
7. **One slice with four checkpoints.** **Recommended: yes.** Checkpoints 1 and 2 are
   small; 3 and 4 are the substance. The alternative splits off checkpoint 1 (data) as
   its own slice, but the two JSON files do nothing without the engine.

Reply **go** to take all seven, or answer by number. The user also names the
implementer.

## Planning verification

- Read: `engine_1.asm` (all), `engine_2.asm` init routines, `engine_3.asm` vs
  `engine_4.asm` (diffed), `home/audio.asm`, `home/delay.asm`, `home/text.asm`
  `TextCommand_SOUND`, `home/vblank.asm`, both jingles in every bank (diffed), their
  headers, `wave_samples.asm`, `music_constants.asm`.
- Measured on our data:
  - registers via the `Audio1_CalculateFrequency` arithmetic;
  - drum instrument lifetimes from `noise_instruments.json`, and each track's
    instruments;
  - a frame-accurate simulation of every track for zero delays and overflow (none);
  - the 43 pret tracks with perfect pitch, and the four with rate-0 vibrato.
- Wave octave confirmed by Pan Docs' formulas and gen1recomp's #429 test.
- No code, data or test changed in this planning step.

## Implementation result (2026-10-06, Claude Opus 5.5) — done, user-verified

The user took all seven decisions (DECISIONS #40) and asked Claude to implement. Four
commits, one per checkpoint:

| Checkpoint | Commit | What |
|---|---|---|
| 1 data | `3a4fabb` | Music mode after `execute_music` in the decoder; `get_item1` / `get_item2` headers. Regenerated diff: exactly the 2 JSON files + mirrors; setup twice byte-identical (857 files). +7 ROM tests (headers vs the sym file; every channel vs pret's asm parsed directly). The `static_export` 30 s timeout |
| 2 move | `732aa12` | `SoundChannel` extracted with no behavior change. A per-update synth trace of all 47 tracks × 3,600 updates, alone and with six SFX overlaid (94 traces, trace file sha1 `64602ce812cf…`), identical before and after |
| 3 rules | `75166d2` | §4.3 and §4.4 in the shared interpreter and the engines; `isSoundFinished()`, the preload, `_playSFX`. 18 rule tests |
| 4 SFX + wait | `8b1691e` | 11 tests: both jingles' note and end updates, the wait (73 / 181, channel 7 skipped, a drum on the last update, a real SFX on 8, loading), drum drop and cancel, `press_ab` timing, a stopped SFX's release, the preload list. Docs |

**Beyond the plan** (each is the same cartridge rule as a planned item; flagged for the
review):

- **Rests stay silent.** The software fade kept stepping through a rest and its
  `setPulseVolume` re-enabled the synth channel. A note that hadn't decayed came back
  mid-rest (shown on the old code: silent on update 13, back at volume 10 on update 20).
  A rest writes NRx2 = $08 on the cartridge. The envelope stand-in now runs only for the
  channel's own trigger (`envVolume` / `envFade`, separate from `note_type`'s
  `noteVolume` / `noteFade`). This changes how much of the music sounds: staccato notes
  stop at their rests.
- **Pitch slides:** a slide skips vibrato (73–78) and ends at the next note (149–159).
  The slide's own algorithm is unchanged and still logged. Its tick count no longer
  disturbs the note's fractional byte.
- **Defaults are the init routines':** speed 1, duty 0, a delay counter of 1, wMusicTempo
  $0100 at every `play`. Checked neutral: every channel of every track sets speed (and a
  pulse duty) before its first note.
- **Supporting pieces:**
  - `SfxEngine.stop()` releases the channels it stops, as an ending SFX does. Otherwise
    a replaced jingle would have left music channel 2 un-suppressed but mid-envelope.
  - `audioUpdate()` (`sound_wait.ts`) is the one update sequence, used by `index.ts` and
    the test rig. The order test is mutation-checked: with SFX first, it fails.
  - `MusicEngine.musicTempo` and `getChannel(id)` are read-only accessors for the tests.
  - The test rig is `src/test/audio_rig.ts`. It isn't in the bundle (checked).
- **A detail the probes surfaced, matching the ASM:** the vibrato rate counter isn't
  reset by notes. In `get_item1` ch5 each 8-update G# note runs it down once after its
  delay, so E4's first vibration is update 35, not 38. Pinned by a test.

**Checks:**
- typecheck clean;
- **812/812** with `ROM_PATH` (33 files, +36); without it **731 pass / 81 skip**;
- build OK (103 modules), no test-rig code in the bundle;
- `git diff --check` clean.

**Agent's browser check** (`127.0.0.1:5179`, tab and server closed afterwards): new game →
Viridian Forest (dungeon2, tempo 144) → `_playSFX('get_item1')` with every synth write
logged:
- pulse 1 G#3 $06c5 on updates 1, 9, 17, E4 $073a on 25, vibrato from 35, silenced on 73;
- the wave channel B4 on 1, 9, 17, 25;
- the Forest's own notes back from 83;
- 3 drum hits during the jingle; tempo still 144.

`get_item2` ended after 181 updates. No console errors. No ears: the user's test (§7) is
the check that it *sounds* right.

**User-verified 2026-10-06.** The user ran the §7 ear test on `127.0.0.1:5173`: "yes, i can hear the
difference, very high fidelity and very close to what the game boy sounds like". A1a is done; next A1b.

**Independent code review 2026-10-06 — passed (Codex).** At the user's subsequent
request, the implementation was reviewed against the approved plan and Yellow
assembly, with no actionable findings within A1a's scope. The ROM and no-ROM
suites, production build and separate public API probes passed. See
`notes/17-a1a-review.md`.
