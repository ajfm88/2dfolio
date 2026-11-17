# Audio Architecture

V5g2 (note 105, #134; user-verified) gives field `PlaySound` the cartridge's
priority walk through `sfx_priority.ts`, shared with `BattleAudio.accepts`: visit the header last to first,
clear each accepted channel immediately, and return at the first refusal, preserving the partial clear.
An empty channel accepts; otherwise lower/equal ids win, with CHAN8's drum rules at `$14`. `installSfx`
installs without stopping other channels, so field SFX on different channels play together. The field's
channel/file records count only while that channel is active; named `isSfxPlaying` therefore still finds
collision on CHAN5 after a later CHAN8 request. Pending loads still count. Music requests leave ids idle.
The battle's existing owner/alarm behavior is unchanged. Direct `SfxEngine.play` callers and the id-less
debug path retain replace-all behavior; production field requests use the priority walk.

A5d CP2 adds `battle_music.ts`'s numeric song choice and the facade's `playBattleMusic` generator.
Prime at E: clear fade control / SA, yield one frame; resume at E+1: PM of the chosen song, return.
Gym-leader precedence, Lance and RIVAL3 are tested against source IDs. CP4 preloads all four battle tracks
after audio unlock and drives this generator for every battle entry, followed by the second DelayFrame.
A5c1 CP5 adds `low_health_alarm.ts`. The callback runs after the fade and before music. Nothing sets bit 7 until A5c3. Note 66 §10.19.

A5c3d checkpoint-03 adds **unused data only** for Audio2 (bank $08) `level_up` ($4192, channels5/6/7),
`faint_fall` ($41DA, channel5) and `faint_thud` ($41BF, channels5/8). Setup emits the JSON and static mirrors;
the runtime preload list remains unchanged. Its census test now accounts for exactly these three unused files.
No playback duration or bank/priority bridge is implemented by this data addition (note70 §9.5).

V5g3 checkpoint-03 (note 108, user-verified) preloads `ledge` and `tink`
and adds their field ids (`$A2` and `$8C`, 23 ids total). `SFX_FILES` maps `tink` to the same body in
all four banks, and `ledge` in `$02` and `$1f` only; neither `$08` nor `$20` has a ledge row.
The hop's arming pass plays `ledge`; the Town Map plays `tink` on A/B/Up/Down, with Up then Down
checked before closing. `ledge` is CHAN5, returns on update 17, and Audio 3's body is identical.
No generated files or timing change. Extraction trace: note 107; bank-table probe: note 108.

Layers: extraction (ROM → JSON), request/fade state, music/SFX interpreters, and the synthesizer
(Web Audio `ScriptProcessorNode`).

The unused A5c3d `battle/battle_audio.ts` adapter opts into channel-ID activity, the CHAN5 alarm's
next-command return, raw pulse fractional timing, and dynamic cry/battle classification. It binds the
real MusicEngine drum owner for priority and ID clearing, and can share PlaySound's current/saved banks.
`playSwap` is a serviced-frame Program: pause/mute music, DelayFrame, switch both banks to Audio1,
wait/play/wait, then restore both banks and clear pause. Synthesizer output routing is separate from
DAC/volume state so enabling an alarm channel or muting music does not consume a sound_ret.
Without the adapter the existing engine behavior is unchanged. The production import guard excludes it.

| File | Purpose |
|---|---|
| `index.ts` | `initAudio()`, `resumeAudio()`, `playMusic(name)`, `playSFX(name)`, `stopMusic()`, `tickAudio()`, `isSoundFinished()` (A1a), `fadeOutAndStopMusic(control)` / `isAudioFadingOut()` (healing CP2), the SFX preload, the `_playSFX(name)` console helper |
| `play_sound.ts` | Pure numeric WRAM/request state: distinct PM/PS/PN/PW/SA/DM/DF, banks, queued sound and FadeOutAudio; map-music CP2 |
| `sound_ids.ts` | All 49 header-backed music IDs/banks and 20 extracted SFX IDs; refs-checked; the direct PokeFluteInBattle routine has no header ID |
| `request_host.ts` | `engineHost`: the one `PlaySoundHost` over the synth and engines (volume, ID clear + `cancelDrum`, StopAllAudio, DetermineAudioFunction, sound-finished) |
| `audio_flags.ts` | Transient WRAM bits as plain module state: `BIT_NO_AUDIO_FADE_OUT` (StatusScreen) and `BIT_NO_MAP_MUSIC` (the Pallet escort, cleared in the Lab) |
| `fade_audio.ts` | `AudioFade` = `fadeOutAndStopMusic` (control + SA), `isFadingOut`, `tick`, over a `PlaySound`. No standalone shims since map-music CP3 |
| `rival_start.ts` | A5b5b's `playMusic('meetrival', 'rivalAlternate')` adapter: selects the committed alternate channel entries without changing the engine or cached data |
| `sound_channel.ts` | **(A1a)** `SoundChannel`: one software channel of `Audio1_UpdateMusic`, the interpreter the music and music-mode SFX share (DECISIONS #40) |
| `music_engine.ts` | The track's channels (CHAN1–4) and `wMusicTempo`; suppression while SFX play; `releaseChannel`; channel 8's drum occupancy |
| `sfx_engine.ts` | SFX on channels 5–8 overriding music channels 1–4: SFX-mode `square_note` / `noise_note` / `pitch_sweep`, or, after `execute_music`, a `SoundChannel` at tempo $0100 |
| `low_health_alarm.ts` | **(A5c1 CP5)** `wLowHealthAlarm`, the CHAN5 id and the disabled flag; pulse 1's `$E2` envelope. Not saved. Bit 7 is unset until A5c3 |
| `sound_wait.ts` | **(A1a)** `audioUpdate()` (fade, alarm, music, then SFX), `soundFinished()` (bit 7 returns at once, else channels 5, 6, 8); `updateMusic6Times()` advances music/SFX only |
| `sfx_names.ts` | **(A1a)** the extracted SFX, preloaded |
| `synthesizer.ts` | Per-sample generation of all 4 channels: pulse (phase accumulator + duty table + the alarm's 64 Hz envelope), wave (32-sample lookup), noise (LFSR + 64 Hz hardware envelope in the callback) |
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
- **Intro animation CP2** adds preloaded `shrink`: bank `$02`, header `$41d4`, ID `$9c`, CHAN5 body `$44ec`.
  The music table independently uses `$9c` for `meetjessiejames` in bank `$20`; reverse lookup keeps both.
  The speech's SHRINK request is CP4; CP2 changes only extraction, registration and preload (note 64 §10.10).
- **Audio-bank rule:** the cartridge's PlaySound selects the current music's `wAudioROMBank`.
  V5g1 checkpoint-02 (note 103 §10, #132; reviewed, awaiting the user's SAVE play-test) uses `SFX_FILES` in
  `sound_ids.ts`: `(bank, id) → committed file`, recomputed from the ROM by `extraction.test.ts`.
  Banks `$02`, `$08` and `$1f` use their rows; any other bank defaults to Audio 4 (`$20`), as
  `DetermineAudioFunction` does. An unmapped pair plays nothing and warns once per pair per page.
  Music identity is checked first. `SFX_IDS` and `isSfxPlaying(name)`'s file-name comparison are unchanged.
  The three Audio 3 files are preloaded without new ids: `save_3` (37 updates), `turn_on_pc_3` (81)
  and `enter_pc_3` (18), versus Audio 1's 40/70/22. Thus SAVE in Oak's Lab, Viridian Forest and
  Diglett's Cave uses Audio 3's body and its wait is three updates shorter. The other 17 field ids
  in `$1f` keep Audio 1's files; current PCs remain on `$02`. The `$08` table also names `level_up`,
  `caught_mon` and `faint_fall`, fetched on demand by the field if requested, not field-preloaded.
  V5g1 checkpoint-03 (note 104, #133; user-verified) puts battle text sounds
  on the same table: `TEXT_SOUND_IDS` / `textSoundId` supply the command's id (the beep uses `SFX_PRESS_AB`),
  `sfxNameForSound(id, audio.audioBank)` supplies the file, and the owner plays that id with the loaded body.
  `TEXT_SOUND_IDS` is pinned to `TextCommandSounds` without cries or unused rows; the table domain is
  `SFX_IDS` union `TEXT_SOUND_IDS`, adding only `$08:$98` for `dex_page_added`. Missing ids/files still throw.
  Battle preloads and non-text sounds are unchanged, with no audible or frame change. V5g3 checkpoint-04
  (note 109 §9, reviewed) makes field `playSFX` fall back to `textSoundId(name)`
  after `SFX_IDS`, so the field textbox's sounds also use `TEXT_SOUND_IDS` and current-bank `SFX_FILES`.
  `caught_mon` is `$9A`: its Audio 2 jingle in `$08`, `turn_off_pc` in `$02`/`$1f`; `dex_page_added` is `$98`,
  with a file only in `$08` (otherwise silence and one warning per pair). Neither is field-preloaded.
  Only names in neither id table retain the id-less replace-all path (debug `_playSFX` today).
  Both texts run only in battle today, so there is no audible change or play-test.
  Earlier data trace: `notes/101-v5g1-plan.md` §2; current table/lookup: note 103 §2–§3.
- **Map music**: `MAP_MUSIC` in `main.ts` (from `data/maps/songs.asm`);
  `playMapMusic()` routes through DF's song/bank comparison (battle returns force a restart). Every new map needs an
  entry. The door sound needs no map list: since V5g3 checkpoint-01 it reads the tile under the player
  (`overworld/map_change_sound.ts`).
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
- **Map-music CP2 request state:** `PlaySound` owns the numeric new/last/control/counter/reload and current/saved
  banks. PM cancels without writing last; ordinary PS/PW during a fade drops the SFX without changing the queue;
  PN/SA reload from the current control byte (a queued numeric ID); DM waits/forces a restart; DF compares bank/ID
  and uses 10 or 8 after battle. Full-volume fade completion is update **88/72**, dispatching the queued sound
  before that update's engine passes. `SfxEngine.clearSoundIds()` clears occupancy without sound_ret/mute callbacks.
  The six immediate Audio1 passes never tick FadeOutAudio. Numeric bank aliases and both blackout requests are
  covered on `test/audio_request_rig.ts`, which uses the existing real audio rig. **CP3 wiring:** `index.ts` owns one shared
  `PlaySound` with a real `determineAudioFunction` (numeric ID + current bank → music or SFX). Facade entries: `playMusic` =
  PM, `playSFX` = PS (dropped during a fade), `playMusicNew` = PN, `playDefaultMusic` = DM (retries on the audio clock),
  `restoreNurseMusic`, `playDefaultMusicFadeOutCurrent` = DF, `stopMusic` = control 0 + SA, `fadeOutAndStopMusic(control)`,
  `updateMusic6Times`, `stopAllSounds`. `main.ts` requests the map song with six passes + DF at warps, CONTINUE, NEW GAME
  and battle returns (after-battle reason), DF only at connections, and the blackout's two requests. CP4 makes the warp's
  request wait for `isSoundFinished()` so its door sound finishes before the fade (#68; note 63 §10.16).
  Since V5b the battle return requests it at D+10, inside its `LoadMapData`.
- **Healing CP2 fade:** control 4 lowers NR50 every 5 updates (5…35); update **40** stops all
  channels and restores $77 through the cartridge's `Audio2_StopAllAudio` behavior. No-music,
  zero-control and second-stop requests stop immediately. Idle ticks preserve StatusScreen's
  explicit volume. `GBSynthesizer` retains NR50 and uses **(n+1)/8** per output level (base gain
  0.5), so $00/$33/$77 yield 0.0625/0.25/0.5. Queued map-track state and its callers are complete (map-music CP2–CP4).
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
  - the pitch-slide algorithm differs;
  - `.wave5` isn't extracted;
  - noise-channel rests don't silence it.
  - The field's bank-$02-only SFX copy and three-update SAVE timing departure are retired by
    V5g1 checkpoint-02: bank `$1f` now uses its three differing bodies. The battle's separate
    text-sound path now shares the bank table (V5g1 checkpoint-03); field concurrency/priority is
    implemented in V5g2 above. Call sites remain V5g3.
- Upstream's own to-do: remaining music tracks, remaining music fade paths, Pokemon cries,
  Pikachu PCM cries.
