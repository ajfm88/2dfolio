/**
 * One software channel of the Game Boy sound engine (audio/engine_1.asm
 * Audio1_UpdateMusic): the command interpreter the music channels (CHAN1–4) and
 * music-mode SFX channels (CHAN5–8, after `execute_music`) share (A1a, DECISIONS #40).
 * Ticked once per audio update; the engines tick their channels in id order, music first.
 *
 * Each update the channel either counts its note delay down and runs the per-update
 * effects (Audio1_ApplyMusicAffects), or, on its last delay frame, runs commands up to
 * its next note or rest (Audio1_PlayNextNote).
 *
 * Rules ported exactly (notes/a1a-plan.md §3–§4, line numbers in engine_1.asm):
 *   - note length (700–746): (length × speed) & $ff, a 16-bit product with the tempo and
 *     the fractional byte, an 8-bit delay counter (0 counts as 256);
 *   - the hardware channel is the id's ((id − 1) & 3);
 *   - perfect pitch (841–846): +1 on the frequency low byte only, $ff wrapping to $00;
 *   - vibrato (79–142, 393–439): a delay, then every rate + 1 updates (every update at
 *     rate 0), up first, extents ⌈n/2⌉ / ⌊n/2⌋ on the note's low byte with $00/$ff clamps;
 *     the direction bit survives notes; a pitch slide in progress skips it (73–78);
 *   - suppression (48–56, 766–771, 815–826): a music channel whose SFX channel is busy
 *     counts its delay and runs its commands, but writes nothing, runs no effects and
 *     keeps its old frequency byte;
 *   - every wave note loads the channel's own wave instrument (916–953), and the wave
 *     channel runs at 65536/(2048 − x), an octave below a pulse at the same register.
 *
 * The volume envelope is the hardware's (NRx2). This engine steps a software stand-in per
 * update, and only for the trigger that owns the hardware channel: a note or rest of this
 * channel. After a rest (NRx2 = $08: volume 0) or after an SFX took the channel
 * (`released`) it writes no volume until its next note or rest.
 */

import type { GBSynthesizer } from './synthesizer';
import { getRegisterValue, registerToHz, waveRegisterToHz } from './frequency_table';
import type { MusicCommand, NoiseInstrument, NoiseStep } from './music_engine';

/** What a channel needs from the engine that owns it. */
export interface ChannelHost {
  readonly synth: GBSynthesizer;
  /** The 16-bit tempo this channel's note lengths use (wMusicTempo, or $0100 for SFX). */
  tempo(): number;
  /** The `tempo` command (Audio1_tempo, 485–512). */
  setTempo(value: number): void;
  waveSamples(): readonly number[][];
  noiseInstruments(): readonly NoiseInstrument[];
  /**
   * A drum hit is a noise-instrument SFX on software channel 8 (DetermineAudioFunction,
   * 688–695). False when channel 8 can't take it: the hit is dropped (Audio1_PlaySound
   * 1425–1431). The note's delay runs either way.
   */
  drumHit(instrument: number): boolean;
}

/** Audio1_note_pitch 841–846 with perfect pitch: `inc e` only (the `jr nc` after it is
 *  always taken, carry being clear on every path there), so $ff wraps to $00. */
export function perfectPitchRegister(reg: number): number {
  return (reg & 0xff00) | ((reg + 1) & 0xff);
}

export class SoundChannel {
  /** The hardware channel: 0, 1 pulse, 2 wave, 3 noise. */
  readonly hw: number;
  active = true;
  pc = 0;
  /** wChannelNoteDelayCounters: 1 means "run commands on this update"; 8 bits. */
  noteDelayCounter = 1;
  noteDelayFractional = 0;
  noteSpeed = 1;
  octave = 4;
  dutyCycle = 0;
  dutyCyclePattern = 0;
  hasDutyPattern = false;

  /** wChannelVolumes: the volume and envelope the next note triggers with. */
  noteVolume = 0;
  noteFade = 0;          // encoded: bit 3 = increase, bits 2-0 = pace
  /** The envelope of the trigger now on the hardware (the software stand-in). */
  envVolume = 0;
  private envFade = 0;
  private envCounter = 0;

  // Vibrato (wChannelVibratoDelayCounters, ...ReloadValues, ...Extents, ...Rates)
  vibratoDelayCounter = 0;
  vibratoDelayReload = 0;
  /** (up << 4) | down */
  vibratoExtents = 0;
  /** (reload << 4) | counter */
  vibratoRates = 0;
  /** BIT_VIBRATO_DIRECTION: clear → the next application goes up. */
  vibratoDirection = false;

  // Pitch slide (not exercised by A1a; its algorithm is a logged departure)
  pitchSlideActive = false;
  pitchSlideTarget = 0;   // target register value
  pitchSlideCurrent = 0;  // current register value
  pitchSlideStep = 0;     // register step per tick

  perfectPitch = false;
  /** The register the channel's last note wrote (NRx3 / NRx4 bits, incl. perfect pitch). */
  freqReg = 0;
  /** wChannelFrequencyLowBytes: vibrato's base. */
  freqLow = 0;
  /** The last note's table register, the pitch slide's starting point. */
  currentRegValue = 0;

  // Call/loop stack
  callReturnPc = 0;
  inCall = false;
  loopCounter = 0;

  // Wave channel (wMusicWaveInstrument / wSfxWaveInstrument, the NR32 level)
  waveInstrument = 0;
  waveVolumeLevel = 1;    // 0-3

  // Drum channel
  isDrumChannel = false;
  drumNoteActive = false;
  drumStepIndex = 0;
  drumSteps: NoiseStep[] = [];
  drumStepDelay = 0;

  /** Its SFX channel is busy this update: count only. */
  suppressed = false;
  /** An SFX ended on this hardware channel: silent until this channel's next note or rest. */
  released = false;

  /**
   * @param id the software channel, 1–8 (CHAN1–CHAN8). Defaults are Audio2_InitMusicVariables'
   *   and Audio2_InitSFXVariables' (speed 1, duty 0, flags clear, delay counter 1).
   */
  constructor(
    readonly id: number,
    private readonly commands: MusicCommand[],
    private readonly host: ChannelHost,
  ) {
    this.hw = (id - 1) & 3;
  }

  /** CHAN5–8. */
  get isSfx(): boolean { return this.id >= 5; }

  private get synth(): GBSynthesizer { return this.host.synth; }

  // ─── One update (Audio1_ApplyMusicAffects) ──────────────────────────────

  tick(suppressed: boolean = false): void {
    this.suppressed = suppressed;

    if (this.noteDelayCounter === 1) {
      this.playNextNote();
      return;
    }
    this.noteDelayCounter = (this.noteDelayCounter - 1) & 0xff;
    // A music channel under a busy SFX channel only counts
    if (suppressed) return;

    // The hardware envelope's stand-in (not an ASM effect)
    this.applyEnvelope();

    // Drum channel: advance noise instrument steps
    if (this.isDrumChannel && this.drumNoteActive) {
      this.advanceDrumStep();
      return;
    }

    if (this.hasDutyPattern) this.rotateDuty();
    if (this.pitchSlideActive) {
      this.applyPitchSlide();
      return;
    }
    this.applyVibrato();
  }

  /** An SFX ended on this channel's hardware channel (Audio1_sound_ret for CHAN5–8). */
  release(): void {
    this.released = true;
  }

  private applyEnvelope(): void {
    if (this.released || this.envFade === 0) return;

    const rate = this.envFade & 0x7;
    if (rate === 0) return;

    this.envCounter++;
    if (this.envCounter < rate) return;
    this.envCounter = 0;

    // Bit 3: 1 = increase (NRx2's direction bit); the note_type macro sets it for a
    // negative fade
    const increasing = (this.envFade & 0x8) !== 0;
    if (increasing) {
      if (this.envVolume < 15) {
        this.envVolume++;
        this.writeVolume();
      }
    } else if (this.envVolume > 0) {
      this.envVolume--;
      this.writeVolume();
    }
  }

  /** 79–142: the delay counts down first; then the rate's low nibble counts down to 0,
   *  so a vibration happens every rate + 1 updates, rewriting only NRx3. */
  private applyVibrato(): void {
    if (this.vibratoDelayCounter !== 0) {
      this.vibratoDelayCounter--;
      return;
    }
    if (this.vibratoExtents === 0) return;

    const counter = this.vibratoRates & 0xf;
    if (counter !== 0) {
      this.vibratoRates = (this.vibratoRates & 0xf0) | (counter - 1);
      return;
    }
    this.vibratoRates = (this.vibratoRates & 0xf0) | (this.vibratoRates >> 4);

    let low: number;
    if (!this.vibratoDirection) {
      this.vibratoDirection = true;
      low = Math.min(this.freqLow + (this.vibratoExtents >> 4), 0xff);
    } else {
      this.vibratoDirection = false;
      low = Math.max(this.freqLow - (this.vibratoExtents & 0xf), 0);
    }
    this.writeFrequency((this.freqReg & 0xff00) | low);
  }

  private applyPitchSlide(): void {
    this.pitchSlideCurrent += this.pitchSlideStep;

    // Check if we've reached or passed the target
    if (this.pitchSlideStep > 0 && this.pitchSlideCurrent >= this.pitchSlideTarget) {
      this.pitchSlideCurrent = this.pitchSlideTarget;
      this.pitchSlideActive = false;
    } else if (this.pitchSlideStep < 0 && this.pitchSlideCurrent <= this.pitchSlideTarget) {
      this.pitchSlideCurrent = this.pitchSlideTarget;
      this.pitchSlideActive = false;
    }

    this.currentRegValue = this.pitchSlideCurrent & 0xFFFF;
    this.writeFrequency(this.currentRegValue);
  }

  private rotateDuty(): void {
    // Rotate the duty cycle pattern left by 2 bits
    const pattern = this.dutyCyclePattern;
    const duty = (pattern >> 6) & 3;
    this.dutyCyclePattern = ((pattern << 2) | duty) & 0xFF;
    this.dutyCycle = duty;
    if (this.hw <= 1) this.synth.setPulseDuty(this.hw as 0 | 1, duty);
  }

  // ─── Commands (Audio1_PlayNextNote) ─────────────────────────────────────

  /**
   * Reload the vibrato delay and end any pitch slide (149–159), then run commands up to
   * the next note or rest.
   */
  private playNextNote(): void {
    this.vibratoDelayCounter = this.vibratoDelayReload;
    this.pitchSlideActive = false;

    let safety = 0;
    while (safety++ < 1000) {
      if (this.pc >= this.commands.length) {
        this.end();
        return;
      }

      const cmd = this.commands[this.pc];
      this.pc++;

      switch (cmd.cmd) {
        case 'tempo':
          this.host.setTempo(cmd.value!);
          break;

        case 'volume':
          // NR50: the master volume, for every channel
          this.synth.setMasterVolume(cmd.left!, cmd.right!);
          break;

        case 'note_type': {
          this.noteSpeed = cmd.speed!;
          if (this.isDrumChannel) break; // the noise channel has no parameter byte
          if (this.hw === 2) {
            // 357–369: the low nibble is the wave instrument, the high nibble the NR32 level
            this.waveVolumeLevel = cmd.volume! & 3;
            this.waveInstrument = cmd.fade! & 0xF;
          } else {
            this.noteVolume = cmd.volume!;
            // The decoder stores the raw nibble; a negative fade in the macro sets bit 3
            this.noteFade = cmd.fade! < 0 ? 0x8 | -cmd.fade! : cmd.fade!;
          }
          break;
        }

        case 'octave':
          this.octave = cmd.value!;
          break;

        case 'duty_cycle':
          // Stored; the next note writes it (Audio1_ApplyDutyCycleAndSoundLength)
          this.dutyCycle = cmd.value!;
          this.hasDutyPattern = false;
          break;

        case 'duty_cycle_pattern':
          this.dutyCyclePattern = (cmd.d0! << 6) | (cmd.d1! << 4) | (cmd.d2! << 2) | cmd.d3!;
          this.hasDutyPattern = true;
          break;

        case 'vibrato': {
          // 393–439
          this.vibratoDelayCounter = cmd.delay!;
          this.vibratoDelayReload = cmd.delay!;
          const n = cmd.depth! & 0xf;
          this.vibratoExtents = (((n >> 1) + (n & 1)) << 4) | (n >> 1);
          const r = cmd.rate! & 0xf;
          this.vibratoRates = (r << 4) | r;
          break;
        }

        case 'pitch_slide': {
          this.pitchSlideActive = true;
          const targetReg = getRegisterValue(cmd.pitch!, cmd.octave!);
          this.pitchSlideTarget = targetReg & 0x7FF;
          const currentReg = this.currentRegValue & 0x7FF;
          const target = this.pitchSlideTarget;
          // Spread over the slide's length in note ticks (upstream's approximation; the
          // ASM's algorithm is logged for the audio audit)
          const slideTicks = (((cmd.length! * this.noteSpeed) & 0xff) * this.host.tempo()) >> 8;
          this.pitchSlideStep = slideTicks > 0 ? (target - currentReg) / slideTicks : target - currentReg;
          this.pitchSlideCurrent = currentReg;
          break;
        }

        case 'toggle_perfect_pitch':
          this.perfectPitch = !this.perfectPitch;
          break;

        case 'stereo_panning':
        case 'execute_music':
          // Panning is not modelled; execute_music only selects how SFX bytes decode
          break;

        case 'sound_call':
          this.callReturnPc = this.pc;
          this.inCall = true;
          this.pc = cmd.target!;
          break;

        case 'sound_ret':
          if (this.inCall) {
            this.pc = this.callReturnPc;
            this.inCall = false;
          } else {
            this.end();
            return;
          }
          break;

        case 'sound_loop':
          if (cmd.count === 0) {
            // Infinite loop
            this.pc = cmd.target!;
          } else {
            if (this.loopCounter === 0) {
              this.loopCounter = cmd.count!;
            }
            this.loopCounter--;
            if (this.loopCounter > 0) {
              this.pc = cmd.target!;
            }
          }
          break;

        case 'drum_speed':
          this.noteSpeed = cmd.speed!;
          this.isDrumChannel = true;
          break;

        case 'drum_note': {
          this.isDrumChannel = true;
          this.noteDelayCounter = this.noteLength(cmd.length!);
          if (this.suppressed) return;
          this.released = false;
          if (!this.host.drumHit(cmd.instrument!)) return; // channel 8 busy: dropped
          const instr = this.host.noiseInstruments()[cmd.instrument! - 1];
          if (instr && instr.steps.length > 0) {
            this.drumNoteActive = true;
            this.drumStepIndex = 0;
            this.drumSteps = instr.steps;
            this.drumStepDelay = 0;
            this.playDrumStep(instr.steps[0]);
          }
          return;
        }

        case 'note': {
          // Audio1_note_length, then Audio1_note_pitch
          this.noteDelayCounter = this.noteLength(cmd.length!);
          const reg = getRegisterValue(cmd.pitch!, this.octave);
          this.currentRegValue = reg;
          // .noSfx: no register writes and no frequency byte while the SFX is busy
          if (this.suppressed) return;
          this.freqReg = this.perfectPitch ? perfectPitchRegister(reg) : reg;
          this.freqLow = this.freqReg & 0xff;
          this.released = false;
          this.startNote();
          return;
        }

        case 'rest': {
          this.noteDelayCounter = this.noteLength(cmd.length!);
          if (this.suppressed) return;
          this.released = false;
          // NRx2 = $08 and a restart: volume 0 until the next note. The noise channel's
          // rest isn't silenced yet (a logged departure: the ASM silences it too).
          if (!this.isDrumChannel) {
            this.envVolume = 0;
            this.envFade = 0;
            this.silenceChannel();
          }
          return;
        }

        default:
          // Unknown command, skip
          break;
      }
    }
  }

  /** The channel's final sound_ret. A music channel turns its output off; an SFX channel's
   *  end is its engine's (it hands the hardware channel back). */
  private end(): void {
    this.active = false;
    if (!this.isSfx) this.silenceChannel();
  }

  /**
   * Audio1_note_length (700–746): `(length × speed) & $ff` times the tempo, plus the
   * fractional byte, as a 16-bit sum (Audio1_MultiplyAdd); the high byte is the delay, the
   * low byte the new fraction. A zero delay counts as 256 (the counter is a byte).
   */
  private noteLength(length: number): number {
    const raw = (length * this.noteSpeed) & 0xff;
    const product = (raw * this.host.tempo() + this.noteDelayFractional) & 0xffff;
    this.noteDelayFractional = product & 0xff;
    return product >> 8;
  }

  // ─── Drums ─────────────────────────────────────────────────────────────

  private playDrumStep(step: NoiseStep): void {
    if (!this.suppressed && !this.released) this.synth.triggerNoise(step.param, step.volume, step.fade);
    // Step length: 0 means the hardware envelope handles the rest
    this.drumStepDelay = step.length;
  }

  private advanceDrumStep(): void {
    if (!this.drumNoteActive) return;
    // Advance through multi-step instruments (the noise envelope runs in the synthesizer)
    if (this.drumStepDelay > 0) {
      this.drumStepDelay--;
      if (this.drumStepDelay > 0) return;

      this.drumStepIndex++;
      if (this.drumStepIndex < this.drumSteps.length) {
        this.playDrumStep(this.drumSteps[this.drumStepIndex]);
      } else {
        this.drumNoteActive = false;
      }
    }
  }

  /** A real SFX took channel 8: the drum hit under way is gone. */
  cancelDrum(): void {
    this.drumNoteActive = false;
  }

  // ─── Register writes ───────────────────────────────────────────────────

  /** A note trigger: the envelope restarts from wChannelVolumes; duty, then the wave
   *  pattern and level, then the frequency (Audio1_note_pitch .sfxChannel). */
  private startNote(): void {
    if (this.hw <= 1) {
      const ch = this.hw as 0 | 1;
      this.envVolume = this.noteVolume;
      this.envFade = this.noteFade;
      this.envCounter = 0;
      this.synth.setPulseFrequency(ch, registerToHz(this.freqReg));
      this.synth.setPulseDuty(ch, this.dutyCycle);
      this.synth.setPulseVolume(ch, this.envVolume);
    } else if (this.hw === 2) {
      const samples = this.host.waveSamples()[this.waveInstrument];
      if (samples) this.synth.setWaveInstrument(samples as number[]);
      this.synth.setWaveVolume(this.waveVolumeLevel);
      this.synth.setWaveFrequency(waveRegisterToHz(this.freqReg));
    }
  }

  private writeVolume(): void {
    if (this.hw <= 1) this.synth.setPulseVolume(this.hw as 0 | 1, this.envVolume);
  }

  /** NRx3/NRx4 without a trigger. */
  private writeFrequency(reg: number): void {
    if (this.hw <= 1) {
      this.synth.setPulseFrequency(this.hw as 0 | 1, registerToHz(reg));
    } else if (this.hw === 2) {
      this.synth.setWaveFrequency(waveRegisterToHz(reg));
    }
  }

  private silenceChannel(): void {
    if (this.suppressed) return;
    if (this.hw <= 1) {
      this.synth.silencePulse(this.hw as 0 | 1);
    } else if (this.hw === 2) {
      this.synth.silenceWave();
    } else if (this.hw === 3) {
      this.synth.silenceNoise();
    }
  }
}
