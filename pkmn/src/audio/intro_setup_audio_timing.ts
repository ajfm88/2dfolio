// Audio1_UpdateMusic's cost during the movie's setup, before PlayMusic: the music channels are silent and software
// channel 5 is idle or still playing SFX_SHOOTING_STAR (sound 194) from an early star skip. Unused: nothing calls it
// yet. No ROM, no opcode execution; the stream mirrors audio/engine_1.asm and home/audio.asm instruction by
// instruction, in machine cycles (four dots each), from the routine's first instruction through its RET.
import type { MusicEngine } from './music_engine';
import type { SfxEngine } from './sfx_engine';

/** SFX_SHOOTING_STAR: wChannelSoundIDs + CHAN5 while the star's sound plays. */
export const INTRO_SETUP_SOUND_ID = 194;
/** wAudioROMBank through the movie's setup: BANK(SFX_Shooting_Star). */
export const INTRO_SETUP_AUDIO_BANK = 0x1f;

export interface IntroSetupAudioInputs {
  readonly sfx: SfxEngine;
  readonly music: MusicEngine;
  /** wChannelSoundIDs + CHAN5. */
  readonly channel5SoundId: number;
  /** wAudioROMBank. */
  readonly audioBank: number;
  /** wLowHealthAlarm. */
  readonly lowHealthAlarm: number;
}

/** pret's label at the segment's first instruction, then the machine cycles of each instruction until the next label
 * the callee reaches (instructions after a RET belong to the callee's last label, as an execution trace splits). */
export type IntroAudioSegment = readonly [label: string, cycles: readonly number[]];

const SHOOTING_STAR = ['duty_cycle_pattern', 'pitch_sweep', ...Array<string>(9).fill('square_note'), 'pitch_sweep', 'sound_ret'];
type Chan5 = { kind: 'wait' } | { kind: 'note'; length: number } | { kind: 'end' };

/** The callee's segments for the update the inputs are about to receive. Call before the paired real update. */
export function introSetupAudioSegments(inputs: IntroSetupAudioInputs): IntroAudioSegment[] {
  const chan5 = channel5(inputs);
  const s = new Stream();
  s.at('Audio1_UpdateMusic', 2);                              // ld c, CHAN1
  for (let c = 0; c < 8; c++) {
    s.at('Audio1_UpdateMusic.loop', 2, 3, 2, 2, 1);           // ld b,0 / ld hl,wChannelSoundIDs / add hl,bc / ld a,[hl] / and a
    if (c === 4 && chan5) {
      s.op(2, 1, 2, 3);                                       // jr z (no) / ld a,c / cp CHAN5 / jr nc .applyAffects
      s.at('Audio1_UpdateMusic.applyAffects', 6);             // call Audio1_ApplyMusicAffects
      applyMusicAffects(s, chan5);
    } else s.op(3);                                           // jr z, .nextChannel
    s.at('Audio1_UpdateMusic.nextChannel', 1, 1, 2, c < 7 ? 3 : 2); // ld a,c / inc c / cp CHAN8 / jr nz, .loop
  }
  s.op(4);                                                    // ret
  return s.segments;
}

/** Total machine cycles of the same callee (entry through RET, excluding the caller's CALL). */
export function introSetupAudioCycles(inputs: IntroSetupAudioInputs): number {
  return introSetupAudioSegments(inputs).reduce((sum, [, cycles]) => sum + cycles.reduce((a, b) => a + b, 0), 0);
}

function channel5(inputs: IntroSetupAudioInputs): Chan5 | null {
  const { sfx, music } = inputs;
  if (inputs.audioBank !== INTRO_SETUP_AUDIO_BANK) throw new RangeError('Setup audio timing requires the shooting star bank');
  if (inputs.lowHealthAlarm !== 0) throw new RangeError('Setup audio timing requires the low-health alarm off');
  for (let id = 1; id <= 4; id++)
    if (music.getChannel(id)?.active) throw new RangeError('Setup audio timing requires silent music channels');
  if (music.channel8DrumBusy) throw new RangeError('Setup audio timing requires no drum on channel 8');
  for (let id = 6; id <= 8; id++) {
    const other = sfx.observeChannel(id);
    if (other?.active && other.enabled) throw new RangeError('Setup audio timing supports software channel 5 only');
  }
  const ch = sfx.observeChannel(5);
  if (!ch?.active || !ch.enabled) {
    if (inputs.channel5SoundId !== 0) throw new RangeError('Channel 5 has a sound ID but no sound');
    return null;
  }
  if (inputs.channel5SoundId !== INTRO_SETUP_SOUND_ID) throw new RangeError('Setup audio timing supports sound 194 only');
  if (ch.musicMode || ch.battle || ch.commands.length !== SHOOTING_STAR.length
    || ch.commands.some((command, i) => command.cmd !== SHOOTING_STAR[i]))
    throw new RangeError('Channel 5 is not playing the shooting star');
  // The sound's first update (duty pattern, sweep and first note together) happens during the star, never in setup.
  if (ch.pc === 0) throw new RangeError('The shooting star has not had its first update');
  if (ch.noteDelayCounter > 1) return { kind: 'wait' };
  if (ch.noteDelayCounter !== 1) throw new RangeError('Unexpected channel 5 note delay');
  const next = ch.commands[ch.pc];
  if (next.cmd === 'square_note') return { kind: 'note', length: next.length! };
  if (next.cmd === 'pitch_sweep' && ch.commands[ch.pc + 1]?.cmd === 'sound_ret') return { kind: 'end' };
  throw new RangeError('Unexpected channel 5 command');
}

class Stream {
  readonly segments: [string, number[]][] = [];
  at(label: string, ...cycles: number[]): void { this.segments.push([label, cycles]); }
  op(...cycles: number[]): void { this.segments[this.segments.length - 1][1].push(...cycles); }
}

function applyMusicAffects(s: Stream, chan5: Chan5): void {
  s.at('Audio1_ApplyMusicAffects', 2, 3, 2, 2, 2);           // ld b,0 / ld hl,wChannelNoteDelayCounters / add / ld a,[hl] / cp 1
  if (chan5.kind !== 'wait') {
    s.op(4);                                                 // jp z, Audio1_PlayNextNote
    playNextNote(s, chan5);
    return;
  }
  s.op(3, 1, 2, 1, 2, 3);                                    // jp z (no) / dec a / ld [hl],a / ld a,c / cp CHAN5 / jr nc
  s.at('Audio1_ApplyMusicAffects.startChecks', 3, 2, 3, 2, 6); // ld hl,wChannelFlags1 / add / bit ROTATE / jr z (no) / call
  s.at('Audio1_ApplyDutyCyclePattern', 2, 3, 2, 2, 1, 1, 2, 2, 1, 2, 6); // ... rlca / rlca / ... / call GetRegisterPointer
  getRegisterPointer(s);
  s.op(2, 2, 1, 2, 4);                                       // ld a,[hl] / and $3f / or d / ld [hl],a / ret
  s.at('Audio1_ApplyMusicAffects.checkForExecuteMusic', 2, 3, 2, 3, 2, 3, 2, 3, 3); // EXECUTE_MUSIC clear; NOISE_OR_SFX set
  s.at('Audio1_ApplyMusicAffects.skipPitchSlideVibrato', 4); // ret
}

function playNextNote(s: Stream, chan5: Exclude<Chan5, { kind: 'wait' }>): void {
  // vibrato reload, two res, CHAN5's wLowHealthAlarm test (bit clear), then call Audio1_sound_ret
  s.at('Audio1_PlayNextNote', 3, 2, 2, 3, 2, 2, 3, 2, 4, 4, 1, 2, 2, 4, 2, 3);
  s.at('Audio1_PlayNextNote.skipLowHealthAlarm', 6);
  s.at('Audio1_sound_ret', 6);                               // call Audio1_GetNextMusicByte
  getNextMusicByte(s);
  s.op(1, 2, 4);                                             // ld d,a / cp sound_ret_cmd / jp nz, Audio1_sound_call
  commandChain(s);
  if (chan5.kind === 'note') {
    sfxNote(s, chan5.length);
    return;
  }
  // pitch_sweep 0, 8: rAUD1SWEEP, then the stream's sound_ret ends the sound.
  s.at('Audio1_sfx_note', 2, 3);                             // cp sfx_note_cmd / jr nz, Audio1_pitch_sweep
  s.at('Audio1_pitch_sweep', 1, 2, 2, 1, 2, 2, 2, 3, 2, 3, 2, 6);
  getNextMusicByte(s);
  s.op(3, 4);                                                // ldh [rAUD1SWEEP],a / jp Audio1_sound_ret
  s.at('Audio1_sound_ret', 6);
  getNextMusicByte(s);
  s.op(1, 2, 3, 2, 3, 2, 3, 2, 1, 2, 3);                     // sound_ret; no call flag; CHAN5 ≥ CHAN4
  s.at('Audio1_sound_ret.noiseOrSfxChannel', 4, 3, 2, 4, 2, 3);
  s.at('Audio1_sound_ret.skipSfxChannel3', 3);               // jr nz, .dontDisable
  s.at('Audio1_sound_ret.dontDisable', 3);                   // jr .afterDisable
  s.at('Audio1_sound_ret.afterDisable', 4, 2, 3);            // sound 194 ≥ CRY_SFX_START
  s.at('Audio1_sound_ret.maybeCry', 4, 2, 2, 2, 3);          // past CRY_SFX_END: not a cry
  s.at('Audio1_sound_ret.skipCry', 3, 2, 2, 4, 4);           // clear the ID / ret / PlayNextNote's ret
}

/** From Audio1_sound_call's test down to Audio1_octave's: the command byte is neither (sfx_note or pitch_sweep). */
function commandChain(s: Stream): void {
  s.at('Audio1_sound_call', 2, 4);
  s.at('Audio1_sound_loop', 2, 4);
  s.at('Audio1_note_type', 2, 2, 4);
  s.at('Audio1_toggle_perfect_pitch', 1, 2, 3);
  for (const name of ['vibrato', 'pitch_slide', 'duty_cycle', 'tempo', 'stereo_panning', 'unknownmusic0xef',
    'duty_cycle_pattern', 'volume', 'execute_music']) s.at(`Audio1_${name}`, 2, 3);
  s.at('Audio1_octave', 2, 2, 3);
}

/** square_note on CHAN5: note length, NR11-NR14 through the register pointer, and the channel's output. */
function sfxNote(s: Stream, length: number): void {
  s.at('Audio1_sfx_note', 2, 2, 1, 2, 2, 2, 3, 2, 3, 2, 6);  // CHAN5 ≥ CHAN4, no execute_music, call Audio1_note_length
  s.at('Audio1_note_length', 1, 4, 2, 1, 2, 1, 1, 3, 2, 2, 1, 6);
  multiplyAdd(s, 1);                                         // note speed 1 (the sound has no note_type)
  s.op(1, 2, 3);                                             // ld a,c / cp CHAN5 / jr nc, .sfxChannel
  s.at('Audio1_note_length.sfxChannel', 2, 2, 2, 2, 6);      // ld d,1 / ld e,0 / cp CHAN8 / jr z (no) / call SetSfxTempo
  s.at('Audio1_SetSfxTempo', 6);
  isCryNo(s);
  s.op(2, 6);                                                // jr c (no) / call Audio1_IsBattleSFX
  s.at('Audio1_IsBattleSFX', 4, 2, 3);                       // wAudioROMBank is not Audio Engine 2's
  s.at('Audio1_IsBattleSFX.no', 1, 4, 3);                    // and a / ret / jr nc, .notCry
  s.at('Audio1_SetSfxTempo.notCry', 1, 4, 1, 4, 4, 4, 1, 4, 1); // wSfxTempo = $0100 / ret / de = wSfxTempo
  s.at('Audio1_note_length.skip', 1, 2, 3, 2, 2, 6);
  multiplyAdd(s, length + 1);
  // store the fraction and the delay; execute_music clear; NOISE_OR_SFX set: pop hl / ret
  s.op(1, 1, 3, 2, 2, 1, 3, 2, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 4);
  s.op(1, 2, 3, 2, 2, 1, 1, 2, 6);                           // duty | length, then call Audio1_GetRegisterPointer
  getRegisterPointer(s);
  s.op(2, 6);                                                // ld [hl],d / call Audio1_GetNextMusicByte
  getNextMusicByte(s);
  s.op(1, 2, 6);                                             // ld d,a / ld b,REG_VOLUME_ENVELOPE / call
  getRegisterPointer(s);
  s.op(2, 6);
  getNextMusicByte(s);
  s.op(1, 1, 2, 2, 2, 4, 6);                                 // ld e,a / ld a,c / cp CHAN8 / ld a,0 / jr z (no) / push de / call
  getNextMusicByte(s);
  s.op(3);                                                   // pop de
  s.at('Audio1_sfx_note.skip', 1, 4, 6);                     // ld d,a / push de / call Audio1_ApplyDutyCycleAndSoundLength
  s.at('Audio1_ApplyDutyCycleAndSoundLength', 2, 3, 2, 2, 1, 2, 2, 2, 2, 1, 2, 1, 3, 2, 2, 1, 1);
  s.at('Audio1_ApplyDutyCycleAndSoundLength.skipDuty', 2, 6);
  getRegisterPointer(s);
  s.op(2, 4, 6);                                             // ld [hl],d / ret / call Audio1_EnableChannelOutput
  s.at('Audio1_EnableChannelOutput', 2, 6);
  s.at('Audio1_ApplyMonoStereo', 4, 4, 4, 2, 2, 1, 2, 3, 2, 3, 3, 4);
  s.op(2, 3, 2, 1, 1, 2, 2, 2, 3);                           // add hl,bc / ldh a,[rAUDTERM] / ... / cp CHAN5 / jr nc, .skip
  s.at('Audio1_EnableChannelOutput.skip', 1, 3, 4, 3, 6);    // ld a,d / ldh [rAUDTERM],a / ret / pop de / call
  s.at('Audio1_ApplyWavePatternAndFrequency', 1, 2, 2, 2, 3);
  s.at('Audio1_ApplyWavePatternAndFrequency.notChannel3', 1, 2, 2, 1, 2, 6);
  getRegisterPointer(s);
  s.op(2, 2, 2, 1, 2, 2, 6);                                 // NR13 / NR14 / cp NUM_MUSIC_CHANS / call ApplyFrequencyModifier
  s.at('Audio1_ApplyFrequencyModifier', 6);
  isCryNo(s);
  s.op(2, 6);
  s.at('Audio1_IsBattleSFX', 4, 2, 3);
  s.at('Audio1_IsBattleSFX.no', 1, 4, 5);                    // and a / ret / ret nc
  s.at('Audio1_ApplyWavePatternAndFrequency.musicChannel', 4, 4, 4); // its ret, sfx_note's ret, PlayNextNote's ret
}

function getRegisterPointer(s: Stream): void {
  s.at('Audio1_GetRegisterPointer', 1, 3, 1, 3);             // CHAN5's table entry: jr nc taken
  s.at('Audio1_GetRegisterPointer.noCarry', 1, 2, 1, 1, 2, 4);
}

function getNextMusicByte(s: Stream): void {
  s.at('Audio1_GetNextMusicByte', 6);
  s.at('GetNextMusicByte', 3, 4, 4, 6);
  s.at('BankswitchCommon', 3, 4, 4, 2, 1, 1, 1, 3, 2, 2, 1, 2, 1, 2, 2, 2, 2, 2, 1, 3, 6);
  s.at('BankswitchCommon', 3, 4, 4, 1, 4, 4);                // ... / ld a,e / ret / Audio1_GetNextMusicByte's ret
}

/** Audio1_IsCry for sound 194: above CRY_SFX_END, carry clear. */
function isCryNo(s: Stream): void {
  s.at('Audio1_IsCry', 4, 2, 3);
  s.at('Audio1_IsCry.next', 2, 2, 2);
  s.at('Audio1_IsCry.no', 1, 1, 4);
}

/** Audio1_MultiplyAdd: one pass per bit of `a` up to its highest; a set bit adds (and skips the jr nc). */
function multiplyAdd(s: Stream, a: number): void {
  s.at('Audio1_MultiplyAdd', 2);
  for (;;) {
    s.at('Audio1_MultiplyAdd.loop', 2);
    const bit = a & 1;
    a >>>= 1;
    if (bit) s.op(2, 2); else s.op(3);
    s.at('Audio1_MultiplyAdd.skipAdd', 2, 2, 1);
    if (a === 0) { s.op(3); break; }
    s.op(2, 3);
  }
  s.at('Audio1_MultiplyAdd.done', 4);
}
