# Audio Architecture

Three layers: extraction (ROM → JSON), synthesizer (Web Audio
`ScriptProcessorNode`), music engine (command interpreter).

| File | Purpose |
|---|---|
| `index.ts` | `initAudio()`, `resumeAudio()`, `playMusic(name)`, `playSFX(name)`, `stopMusic()`, `tickAudio()`, `isSoundFinished()` (A1a), `fadeOutAndStopMusic(control)` / `isAudioFadingOut()` (healing CP2), the SFX preload, the `_playSFX(name)` console helper |
| `fade_audio.ts` | `AudioFade`: stop-after-fade control/counter/reload/queued ID; ticks before music/SFX; stops/restores NR50 in the completion update |
| `rival_start.ts` | A5b5b's `playMusic('meetrival', 'rivalAlternate')` adapter: selects the committed alternate channel entries without changing the engine or cached data |
| `sound_channel.ts` | **(A1a)** `SoundChannel`: one software channel of `Audio1_UpdateMusic`, the interpreter the music and music-mode SFX share (DECISIONS #40) |
| `music_engine.ts` | The track's channels (CHAN1–4) and `wMusicTempo`; suppression while SFX play; `releaseChannel`; channel 8's drum occupancy |
| `sfx_engine.ts` | SFX on channels 5–8 overriding music channels 1–4: SFX-mode `square_note` / `noise_note` / `pitch_sweep`, or, after `execute_music`, a `SoundChannel` at tempo $0100 |
| `sound_wait.ts` | **(A1a)** `audioUpdate()` (fade, music, then SFX, each update) and `soundFinished()` (`WaitForSoundToFinish`: channels 5, 6, 8) |
| `sfx_names.ts` | **(A1a)** the extracted SFX, preloaded |
| `synthesizer.ts` | Per-sample generation of all 4 channels: pulse (phase accumulator + duty table), wave (32-sample lookup), noise (LFSR + 64 Hz hardware envelope in the callback) |
| `frequency_table.ts` | Note → Hz, matching `Audio1_CalculateFrequency` (SRA shift, octave 1 = highest); `waveRegisterToHz` (65536/(2048−x)) |
| `src/rom/extractors/audio.ts` | Parses binary music/SFX commands from the ROM; an SFX channel decodes as music after `execute_music` |

- **Music JSON** (`audio/music/*.json`): `channels[].commands[]` — `tempo`,
  `volume`, `note_type`, `octave`, `note`, `rest`, `duty_cycle`, `vibrato`,
  `pitch_slide`, `drum_speed`, `drum_note`, `sound_call` / `sound_loop` / `sound_ret`.
- **SFX JSON** (`audio/sfx/*.json`): channels 5–8 — `square_note`, `noise_note`,
  `pitch_sweep`, `duty_cycle`, `sound_loop`, `sound_ret`; a music-mode channel starts with
  `execute_music` and then uses the music commands (the item jingles `get_item1` /
  `get_item2`, A1a).
- **A5b3** adds `get_key_item` (music mode, channels 5–7, return on update 121)
  and `turn_on_pc` / `turn_off_pc` / `enter_pc` (SFX mode, channel 5, return on
  70 / 18 / 22). They are extracted and preloaded; their game call sites await
  A5b4–A5b7. `sfx_key_item_pc.test.ts` pins pitch, timing, waits and music hand-off.
- **Audio-bank rule:** the cartridge's PlaySound selects the current music's
  `wAudioROMBank`. Our 19 SFX use bank `$02`; the ROM guard in
  `extraction.test.ts` compares every SFX_HEADERS entry with bank `$1f` and
  pins exactly three differences: save (return 40/37), turn_on_pc (70/81),
  enter_pc (22/18). Key-item, turn-off, `heal_hp`, `heal_ailment` and `healing_machine` copies
  are identical. A5b7c2 plays `heal_hp` and `heal_ailment` from field medicine.
  Bank-aware lookup stays V5; the current PCs use `$02`, while
  Silph Co. 11F (G1) needs `$1f`.
  Evidence and scope: `notes/28-a5b3-plan.md` §3.3, §8.
- **Map music**: `MAP_MUSIC` in `main.ts` (from `data/maps/songs.asm`);
  `updateMapMusic()` only restarts when the track changes. Every new map needs an
  entry — and outdoor maps need adding to `OUTDOOR_MAPS` (door SFX choice).
  Story `restoreMapMusic` uses the live map callback; the Lab restores `oakslab`
  (A5b5c F-2), and the nurse restores her current map after the existing machine.
  Healing CP3 wires the fade API, preloaded `healing_machine` SFX and actual `pkmnhealed`
  jingle to the nurse (note 59, DECISIONS #50/#63). `preloadMusic` warms the jingle at H;
  a cached `playMusic` starts synchronously before its first await. HealParty and the
  map-track restart run in the machine's return tick; its CHAN1 wait does not use isPlaying.
  CP4's muted Viridian nurse browser traces (parties 1 and 6, note 59 §15) confirm:
  fade requested H+1; NR50 $66/$55/$44/$33/$22/$11/$00 at fade updates
  5/10/15/20/25/30/35 (H+6…H+36), then $77 at update 40 (H+41).
  The first ball's SFX starts in that restore tick; subsequent balls are 30 frames apart.
  The actual `pkmnhealed` starts at J=H+41+30n, CHAN1 ends at J+136, and `pokecenter`
  restarts at J+168 after healing. Both controlled-frame browser capture and normal
  RAF/wall-clock runs matched these anchors. Output was muted; listening was the user's
  separate successful play-test. The separate audio/game clocks retain note 59 §10's phase risk.
- **Alternate rival start:** `audio/alternate_tempo.asm` overwrites three channel
  pointers. The decoded committed track already contains those entries; the
  facade locates their source-matched prefixes, clones the stream, shifts jump
  targets, and prepends an instantaneous interpreter jump. Normal starts and
  cached data stay unchanged. The Lab's rival arrival/exit scenes use it; the
  battle challenge uses the normal entry. Tests compare all three prefixes with
  independently parsed ASM and run the real interpreter through the loop.
- Audio ticks at a fixed 59.7275 Hz off `performance.now()`, independent of game FPS.
  Each update runs the fade, music channels, then SFX channels (`audioUpdate`).
- **Healing CP2 fade:** control 4 lowers NR50 every 5 updates (5…35); update **40** stops all
  channels and restores $77 through the cartridge's `Audio2_StopAllAudio` behavior. No-music,
  zero-control and second-stop requests stop immediately. Idle ticks preserve StatusScreen's
  explicit volume. `GBSynthesizer` retains NR50 and uses **(n+1)/8** per output level (base gain
  0.5), so $00/$33/$77 yield 0.0625/0.25/0.5. Queued map tracks await the post-V2 fade slice.
- **The interpreter's rules (A1a, `engine_1.asm`; detail in `sound_channel.ts` and
  `notes/16-a1a-plan.md`):**
  - **Channels:** the hardware channel comes from the id, `(id − 1) & 3`.
  - **Note lengths:** `(length × speed) & $ff` × tempo + the fraction, as 16 bits, into an
    8-bit counter.
  - **SFX tempo:** always $0100 (an SFX's `tempo` never reaches the music).
  - **Perfect pitch:** +1 on the frequency low byte.
  - **Vibrato:** every rate + 1 updates; rate 0 = every update. Low byte only, clamped;
    the direction is kept across notes.
  - **Wave channel:** an octave below a pulse at the same register. Every wave note loads
    the channel's own instrument.
  - **Envelope:** each note re-triggers it from the last `note_type` (`noteVolume` /
    `noteFade`). The software stand-in runs only for the channel's own trigger, so **a
    rest stays silent**.
- **SFX over music:** a music channel whose SFX channel is busy only counts. When the SFX
  ends (or is stopped), the music channel stays silent until its next note or rest. There
  is no mid-note restore. Drum hits hold software channel 8 for their instrument's length
  (a hit is dropped while it's busy); `isSoundFinished()` waits on channels 5, 6 and 8.
- Drum notes use `audio/noise_instruments.json`.
- Flow: splash click unlocks audio → title music through main menu → stops on
  Continue/New Game → map music in the overworld. Battle music starts at the
  transition, not after battle init. Victory fanfare
  (`defeatedwildmon`/`defeatedtrainer`) fires from `battle.onVictory`: a wild battle's
  when the enemy faints, a trainer's once the whole party is down (V1c); map music
  resumes after. Talking to a map trainer starts `meetmaletrainer` /
  `meetfemaletrainer` / `meeteviltrainer` when the before-battle text has typed
  (V1c; A5a uses `MapDialogue`'s text-return callback after the final letter delay,
  before DisplayTextID's silent outer wait; `trainer_flow.ts` `meetMusicFor`).
  Sight encounters start this music at spotting, before the "!" (A1c).
  `meetprofoak` plays in the Oak grass
  cutscene (`pallet_town.ts` `callback`).
- SFX wired upstream: `press_ab` on A/B in menus and source text prompts (display closes are silent), `collision` on
  wall bumps, `start_menu`, `go_inside` / `go_outside` on door warps. Since A1b,
  balls and Route 1's sample play `get_item1`; hidden items play `get_item2` after
  waiting for current SFX. Pickup final button waits and A-release closes are silent.
  A5a map done/end-of-string final waits are silent too; cont/para/prompt alone play
  `press_ab` after their protected wait and current sound completion.
- Known audio departures, each with a home, are in `notes/16-a1a-plan.md` §8:
  - the pulse envelope runs per frame count, not at 64 Hz, and SFX tails are cut;
  - SFX priority isn't modelled;
  - the pitch-slide algorithm differs;
  - `.wave5` isn't extracted;
  - noise-channel rests don't silence it.
  - SFX use the bank-$02 copy; save timing in Oak's Lab, the Forest and
    DiglettsCaveRoute2 inherits a three-update difference until V5 (A5b7 records
    this limitation when it wires save). Silph Co. 11F's PC variants remain G1.
- Upstream's own to-do: remaining music tracks, remaining music fade paths, Pokemon cries,
  Pikachu PCM cries.
