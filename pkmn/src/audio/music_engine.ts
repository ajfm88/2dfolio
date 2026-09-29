/**
 * Game Boy music engine — faithful port of audio/engine_1.asm.
 *
 * Ticked once per frame (~59.7 Hz). Each tick, every active channel either
 * decrements its note delay counter (applying per-tick effects) or advances
 * to the next command.
 */

import { GBSynthesizer } from './synthesizer';
import { getFrequency, getRegisterValue, registerToHz } from './frequency_table';
import type { SfxEngine } from './sfx_engine';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MusicCommand {
  cmd: string;
  value?: number;
  left?: number;
  right?: number;
  speed?: number;
  volume?: number;
  fade?: number;
  pitch?: number;
  length?: number;
  delay?: number;
  depth?: number;
  rate?: number;
  octave?: number;
  target?: number;
  count?: number;
  instrument?: number;
  d0?: number;
  d1?: number;
  d2?: number;
  d3?: number;
}

export interface MusicChannel {
  id: number;
  commands: MusicCommand[];
}

export interface MusicData {
  channels: MusicChannel[];
}

interface NoiseStep {
  length: number;
  volume: number;
  fade: number;
  param: number;
}

export interface NoiseInstrument {
  steps: NoiseStep[];
}

// ─── Channel State ───────────────────────────────────────────────────────────

interface ChannelState {
  active: boolean;
  commands: MusicCommand[];
  pc: number;
  noteDelayCounter: number;
  noteDelayFractional: number;
  noteSpeed: number;
  volume: number;          // 0-15 (current, modified by fade)
  volumeInitial: number;   // initial volume from note_type (reset on each note)
  fade: number;            // encoded: bit 3 = direction, bits 2-0 = rate
  fadeCounter: number;     // ticks until next fade step
  octave: number;          // 1-8
  dutyCycle: number;       // 0-3
  dutyCyclePattern: number; // for rotating duty
  hasDutyPattern: boolean;

  // Vibrato
  vibratoDelay: number;
  vibratoDelayReload: number;
  vibratoDepth: number;
  vibratoRate: number;
  vibratoRateReload: number;
  vibratoDirection: boolean; // false = up, true = down
  vibratoActive: boolean;

  // Pitch slide
  pitchSlideActive: boolean;
  pitchSlideLength: number;
  pitchSlideTarget: number;   // target register value
  pitchSlideCurrent: number;  // current register value
  pitchSlideStep: number;     // register step per tick

  // State
  perfectPitch: boolean;
  currentFreq: number;      // current note frequency in Hz
  currentRegValue: number;   // current GB register value

  // Call/loop stack
  callReturnPc: number;
  inCall: boolean;
  loopCounter: number;

  // Wave channel specific
  waveInstrument: number;
  waveVolumeLevel: number; // 0-3

  // Drum channel specific
  isDrumChannel: boolean;
  drumNoteActive: boolean;
  drumStepIndex: number;
  drumSteps: NoiseStep[];
  drumStepDelay: number;
  drumVolume: number;
  drumFade: number;
  drumFadeCounter: number;

  // SFX suppression: channel still ticks but doesn't output to synth
  suppressed: boolean;
}

// ─── Music Engine ────────────────────────────────────────────────────────────

export class MusicEngine {
  private synth: GBSynthesizer;
  private channels: ChannelState[] = [];
  private tempo: number = 256; // 16-bit tempo value
  private playing: boolean = false;
  private waveSamples: number[][] = [];
  private noiseInstruments: NoiseInstrument[] = [];

  constructor(synth: GBSynthesizer) {
    this.synth = synth;
  }

  setWaveSamples(samples: number[][]): void {
    this.waveSamples = samples;
  }

  setNoiseInstruments(instruments: NoiseInstrument[]): void {
    this.noiseInstruments = instruments;
  }

  /**
   * Start playing a music track.
   */
  play(data: MusicData): void {
    this.stop();
    this.channels = [];
    this.playing = true;

    for (const ch of data.channels) {
      const state = this.createChannelState(ch);
      this.channels.push(state);
    }
  }

  /**
   * Stop all playback.
   */
  stop(): void {
    this.playing = false;
    this.channels = [];
    this.synth.silenceAll();
  }

  isPlaying(): boolean {
    return this.playing;
  }

  /**
   * Called once per game frame (~59.7 Hz).
   * Advances all channels by one tick, then renders audio samples.
   * If sfxEngine is provided, channels overridden by SFX are still ticked
   * (to keep timing) but don't output to the synthesizer.
   */
  tick(sfxEngine?: SfxEngine): void {
    if (!this.playing) return;

    for (const ch of this.channels) {
      if (!ch.active) continue;
      const chIdx = this.getChannelIndex(ch);
      // If SFX is active on this hardware channel, still tick (for timing)
      // but suppress output
      const suppressed = sfxEngine?.isChannelActive(chIdx) ?? false;
      this.tickChannel(ch, suppressed);
    }

    // Render this tick's audio samples and queue for playback
    this.synth.renderTick();
  }

  // ─── Channel Creation ──────────────────────────────────────────────────

  private createChannelState(ch: MusicChannel): ChannelState {
    return {
      active: true,
      commands: ch.commands,
      pc: 0,
      noteDelayCounter: 0,
      noteDelayFractional: 0,
      noteSpeed: 12,
      volume: 15,
      volumeInitial: 15,
      fade: 0,
      fadeCounter: 0,
      octave: 4,
      dutyCycle: 2,
      dutyCyclePattern: 0,
      hasDutyPattern: false,
      vibratoDelay: 0,
      vibratoDelayReload: 0,
      vibratoDepth: 0,
      vibratoRate: 0,
      vibratoRateReload: 0,
      vibratoDirection: false,
      vibratoActive: false,
      pitchSlideActive: false,
      pitchSlideLength: 0,
      pitchSlideTarget: 0,
      pitchSlideCurrent: 0,
      pitchSlideStep: 0,
      perfectPitch: false,
      currentFreq: 0,
      currentRegValue: 0,
      callReturnPc: 0,
      inCall: false,
      loopCounter: 0,
      waveInstrument: 0,
      waveVolumeLevel: 1,
      isDrumChannel: false,
      drumNoteActive: false,
      drumStepIndex: 0,
      drumSteps: [],
      drumStepDelay: 0,
      drumVolume: 0,
      drumFade: 0,
      drumFadeCounter: 0,
      suppressed: false,
    };
  }

  // ─── Tick Logic ────────────────────────────────────────────────────────

  private tickChannel(ch: ChannelState, suppressed: boolean = false): void {
    ch.suppressed = suppressed;

    if (ch.noteDelayCounter > 1) {
      ch.noteDelayCounter--;
      this.applyTickEffects(ch);
      return;
    }

    if (ch.noteDelayCounter === 1) {
      ch.noteDelayCounter = 0;
    }

    // Advance to next note/rest
    this.playNextNote(ch);
  }

  /**
   * Apply per-tick effects: volume fade, vibrato, pitch slide, duty rotation.
   */
  private applyTickEffects(ch: ChannelState): void {
    // Volume fade
    this.applyVolumeFade(ch);

    // Drum channel: advance noise instrument steps
    if (ch.isDrumChannel && ch.drumNoteActive) {
      this.advanceDrumStep(ch);
      return;
    }

    // Vibrato
    this.applyVibrato(ch);

    // Pitch slide
    if (ch.pitchSlideActive) {
      this.applyPitchSlide(ch);
    }

    // Duty cycle rotation
    if (ch.hasDutyPattern) {
      this.rotateDuty(ch);
    }
  }

  private applyVolumeFade(ch: ChannelState): void {
    if (ch.fade === 0) return;

    const rate = ch.fade & 0x7;
    if (rate === 0) return;

    ch.fadeCounter++;
    if (ch.fadeCounter < rate) return;
    ch.fadeCounter = 0;

    // Bit 3: 0 = decrease, 1 = increase (matching GB NR12 convention)
    // BUT in the ASM macros, positive fade = decrease in volume
    // The note_type macro: positive fade -> low nibble directly (direction bit = 0 = decrease)
    // Negative fade -> sets bit 3 (direction bit = 1 = increase)
    const increasing = (ch.fade & 0x8) !== 0;

    if (increasing) {
      if (ch.volume < 15) {
        ch.volume++;
        this.updateChannelVolume(ch);
      }
    } else {
      if (ch.volume > 0) {
        ch.volume--;
        this.updateChannelVolume(ch);
      }
    }
  }

  private applyVibrato(ch: ChannelState): void {
    if (ch.vibratoDepth === 0 || ch.vibratoRateReload === 0) return;

    // Wait for initial delay
    if (ch.vibratoDelay > 0) {
      ch.vibratoDelay--;
      return;
    }

    ch.vibratoActive = true;

    // Rate counter
    ch.vibratoRate--;
    if (ch.vibratoRate > 0) return;
    ch.vibratoRate = ch.vibratoRateReload;

    // Calculate vibrato extent
    const depth = ch.vibratoDepth;
    const upExtent = Math.floor(depth / 2) + (depth % 2);
    const downExtent = Math.floor(depth / 2);

    let regVal = ch.currentRegValue;
    if (!ch.vibratoDirection) {
      // Going up (higher pitch = higher register value)
      regVal += upExtent;
    } else {
      // Going down
      regVal -= downExtent;
    }
    ch.vibratoDirection = !ch.vibratoDirection;

    // Apply the modified frequency
    const hz = registerToHz(regVal);
    this.setChannelFrequency(ch, hz);
  }

  private applyPitchSlide(ch: ChannelState): void {
    ch.pitchSlideCurrent += ch.pitchSlideStep;

    // Check if we've reached or passed the target
    if (ch.pitchSlideStep > 0 && ch.pitchSlideCurrent >= ch.pitchSlideTarget) {
      ch.pitchSlideCurrent = ch.pitchSlideTarget;
      ch.pitchSlideActive = false;
    } else if (ch.pitchSlideStep < 0 && ch.pitchSlideCurrent <= ch.pitchSlideTarget) {
      ch.pitchSlideCurrent = ch.pitchSlideTarget;
      ch.pitchSlideActive = false;
    }

    const hz = registerToHz(ch.pitchSlideCurrent & 0xFFFF);
    ch.currentRegValue = ch.pitchSlideCurrent & 0xFFFF;
    this.setChannelFrequency(ch, hz);
  }

  private rotateDuty(ch: ChannelState): void {
    // Rotate the duty cycle pattern left by 2 bits
    const pattern = ch.dutyCyclePattern;
    const duty = (pattern >> 6) & 3;
    ch.dutyCyclePattern = ((pattern << 2) | duty) & 0xFF;
    ch.dutyCycle = duty;

    if (ch.suppressed) return;
    const chIdx = this.getChannelIndex(ch);
    if (chIdx <= 1) {
      this.synth.setPulseDuty(chIdx as 0 | 1, duty);
    }
  }

  // ─── Note Playback ─────────────────────────────────────────────────────

  /**
   * Advance the program counter through commands until a note/rest is found.
   */
  private playNextNote(ch: ChannelState): void {
    let safety = 0;
    while (safety++ < 1000) {
      if (ch.pc >= ch.commands.length) {
        ch.active = false;
        this.silenceChannel(ch);
        return;
      }

      const cmd = ch.commands[ch.pc];
      ch.pc++;

      switch (cmd.cmd) {
        case 'tempo':
          this.tempo = cmd.value!;
          break;

        case 'volume':
          // Master volume always applies (affects all channels)
          this.synth.setMasterVolume(cmd.left!, cmd.right!);
          break;

        case 'note_type': {
          ch.noteSpeed = cmd.speed!;
          if (ch.isDrumChannel) {
            // For drum channel, note_type only sets speed
            break;
          }
          const chIdx = this.getChannelIndex(ch);
          if (chIdx === 2) {
            // Wave channel: volume is wave output level, fade is wave instrument
            ch.waveVolumeLevel = cmd.volume!;
            ch.waveInstrument = cmd.fade! & 0xF;
            // Load wave instrument
            if (!ch.suppressed && this.waveSamples[ch.waveInstrument]) {
              this.synth.setWaveInstrument(this.waveSamples[ch.waveInstrument]);
            }
            if (!ch.suppressed) this.synth.setWaveVolume(ch.waveVolumeLevel);
          } else {
            ch.volume = cmd.volume!;
            ch.volumeInitial = cmd.volume!;
            // Encode fade for the GB hardware envelope format
            if (cmd.fade! < 0) {
              // Negative fade = increasing volume
              ch.fade = 0x8 | (-cmd.fade!);
            } else {
              // Positive fade = decreasing volume
              ch.fade = cmd.fade!;
            }
            ch.fadeCounter = 0;
          }
          break;
        }

        case 'octave':
          ch.octave = cmd.value!;
          break;

        case 'duty_cycle': {
          ch.dutyCycle = cmd.value!;
          ch.hasDutyPattern = false;
          if (!ch.suppressed) {
            const chIdx = this.getChannelIndex(ch);
            if (chIdx <= 1) {
              this.synth.setPulseDuty(chIdx as 0 | 1, cmd.value!);
            }
          }
          break;
        }

        case 'duty_cycle_pattern':
          ch.dutyCyclePattern = (cmd.d0! << 6) | (cmd.d1! << 4) | (cmd.d2! << 2) | cmd.d3!;
          ch.hasDutyPattern = true;
          break;

        case 'vibrato':
          ch.vibratoDelayReload = cmd.delay!;
          ch.vibratoDelay = cmd.delay!;
          ch.vibratoDepth = cmd.depth!;
          ch.vibratoRateReload = cmd.rate!;
          ch.vibratoRate = cmd.rate!;
          ch.vibratoDirection = false;
          ch.vibratoActive = false;
          break;

        case 'pitch_slide': {
          ch.pitchSlideActive = true;
          const targetReg = getRegisterValue(cmd.pitch!, cmd.octave!);
          ch.pitchSlideTarget = targetReg & 0x7FF;
          const currentReg = ch.currentRegValue & 0x7FF;
          const target = ch.pitchSlideTarget;
          // Calculate step: spread over noteDelay ticks
          // The length param is the slide duration in note ticks
          const slideTicks = this.calculateDelay(ch, cmd.length! - 1);
          if (slideTicks > 0) {
            ch.pitchSlideStep = (target - currentReg) / slideTicks;
          } else {
            ch.pitchSlideStep = target - currentReg;
          }
          ch.pitchSlideCurrent = currentReg;
          break;
        }

        case 'toggle_perfect_pitch':
          ch.perfectPitch = !ch.perfectPitch;
          break;

        case 'stereo_panning':
          // Stereo panning: not critical for Phase 1, skip
          break;

        case 'sound_call':
          ch.callReturnPc = ch.pc;
          ch.inCall = true;
          ch.pc = cmd.target!;
          break;

        case 'sound_ret':
          if (ch.inCall) {
            ch.pc = ch.callReturnPc;
            ch.inCall = false;
          } else {
            // End of track for this channel
            ch.active = false;
            this.silenceChannel(ch);
            return;
          }
          break;

        case 'sound_loop':
          if (cmd.count === 0) {
            // Infinite loop
            ch.pc = cmd.target!;
          } else {
            if (ch.loopCounter === 0) {
              ch.loopCounter = cmd.count!;
            }
            ch.loopCounter--;
            if (ch.loopCounter > 0) {
              ch.pc = cmd.target!;
            }
            // else: fall through to next command
          }
          break;

        case 'drum_speed':
          ch.noteSpeed = cmd.speed!;
          ch.isDrumChannel = true;
          break;

        case 'drum_note': {
          ch.isDrumChannel = true;
          const delay = this.calculateDelay(ch, cmd.length! - 1);
          ch.noteDelayCounter = delay;

          // Trigger noise instrument
          const instrIdx = cmd.instrument! - 1; // 1-indexed
          if (instrIdx >= 0 && instrIdx < this.noiseInstruments.length) {
            const instr = this.noiseInstruments[instrIdx];
            if (instr.steps.length > 0) {
              ch.drumNoteActive = true;
              ch.drumStepIndex = 0;
              ch.drumSteps = instr.steps;
              ch.drumStepDelay = 0;
              // Play first step immediately
              this.playDrumStep(ch, instr.steps[0]);
            }
          }
          return; // Exit — we have a note playing
        }

        case 'note': {
          const freq = getFrequency(cmd.pitch!, ch.octave);
          const regVal = getRegisterValue(cmd.pitch!, ch.octave);
          ch.currentFreq = freq;
          ch.currentRegValue = regVal;

          // Reset volume to initial value — on real GB hardware, each note
          // re-triggers the volume envelope with the initial volume from note_type.
          // Without this, notes fade to silence and never recover.
          ch.volume = ch.volumeInitial;

          // Reset vibrato delay for this note
          ch.vibratoDelay = ch.vibratoDelayReload;
          ch.vibratoActive = false;
          ch.vibratoDirection = false;

          // Calculate delay
          const delay = this.calculateDelay(ch, cmd.length! - 1);
          ch.noteDelayCounter = delay;
          ch.fadeCounter = 0;

          // Start the note
          this.startNote(ch, freq);
          return; // Exit — we have a note playing
        }

        case 'rest': {
          const delay = this.calculateDelay(ch, cmd.length! - 1);
          ch.noteDelayCounter = delay;
          ch.fadeCounter = 0;
          // Don't silence drum channel — noise envelope fades naturally on real GB
          if (!ch.isDrumChannel) {
            this.silenceChannel(ch);
          }
          return; // Exit — resting
        }

        default:
          // Unknown command, skip
          break;
      }
    }
  }

  // ─── Delay Calculation ─────────────────────────────────────────────────

  /**
   * Calculate note delay in frames.
   * Matches Audio1_note_length / Audio1_MultiplyAdd in engine_1.asm.
   *
   * raw = (noteLength + 1) * noteSpeed
   * result = (raw * tempo + fractional) >> 8
   * fractional = (raw * tempo + fractional) & 0xFF
   */
  private calculateDelay(ch: ChannelState, noteLength: number): number {
    const raw = (noteLength + 1) * ch.noteSpeed;
    const product = raw * this.tempo + ch.noteDelayFractional;
    ch.noteDelayFractional = product & 0xFF;
    return product >> 8;
  }

  // ─── Drum Helpers ──────────────────────────────────────────────────────

  private playDrumStep(ch: ChannelState, step: NoiseStep): void {
    if (!ch.suppressed) this.synth.triggerNoise(step.param, step.volume, step.fade);
    // Store envelope for noise hardware simulation
    ch.drumVolume = step.volume;
    ch.drumFade = step.fade;
    ch.drumFadeCounter = 0;
    // Step length: 0 means the hardware envelope handles the rest
    ch.drumStepDelay = step.length;
  }

  private advanceDrumStep(ch: ChannelState): void {
    if (!ch.drumNoteActive) return;

    // Hardware envelope is now handled inside the synthesizer's sample generation
    // (runs at 64Hz at the audio sample rate for smooth fading, not choppy 60Hz engine ticks)

    // Advance through multi-step instruments
    if (ch.drumStepDelay > 0) {
      ch.drumStepDelay--;
      if (ch.drumStepDelay > 0) return;

      ch.drumStepIndex++;
      if (ch.drumStepIndex < ch.drumSteps.length) {
        this.playDrumStep(ch, ch.drumSteps[ch.drumStepIndex]);
      } else {
        ch.drumNoteActive = false;
        // Don't silence — let the envelope fade it naturally
      }
    }
    // If drumStepDelay started at 0 (single-step instruments),
    // the hardware envelope handles everything — no stepping needed
  }

  // ─── Channel Helpers ───────────────────────────────────────────────────

  /**
   * Get the index of a channel (0-3) based on its ID (1-4).
   */
  private getChannelIndex(ch: ChannelState): number {
    const idx = this.channels.indexOf(ch);
    return idx >= 0 ? idx : 0;
  }

  private startNote(ch: ChannelState, freq: number): void {
    if (ch.suppressed) return;
    const chIdx = this.getChannelIndex(ch);

    if (chIdx <= 1) {
      // Pulse channel
      this.synth.setPulseFrequency(chIdx as 0 | 1, freq);
      this.synth.setPulseDuty(chIdx as 0 | 1, ch.dutyCycle);
      this.synth.setPulseVolume(chIdx as 0 | 1, ch.volume);
    } else if (chIdx === 2) {
      // Wave channel
      this.synth.setWaveFrequency(freq);
      this.synth.setWaveVolume(ch.waveVolumeLevel);
    }
  }

  private updateChannelVolume(ch: ChannelState): void {
    if (ch.suppressed) return;
    const chIdx = this.getChannelIndex(ch);
    if (chIdx <= 1) {
      this.synth.setPulseVolume(chIdx as 0 | 1, ch.volume);
    }
    // Wave channel volume is handled differently (discrete levels)
  }

  private setChannelFrequency(ch: ChannelState, freq: number): void {
    if (ch.suppressed) return;
    const chIdx = this.getChannelIndex(ch);
    if (chIdx <= 1) {
      this.synth.setPulseFrequency(chIdx as 0 | 1, freq);
    } else if (chIdx === 2) {
      this.synth.setWaveFrequency(freq);
    }
  }

  private silenceChannel(ch: ChannelState): void {
    if (ch.suppressed) return;
    const chIdx = this.getChannelIndex(ch);
    if (chIdx <= 1) {
      this.synth.silencePulse(chIdx as 0 | 1);
    } else if (chIdx === 2) {
      this.synth.silenceWave();
    } else if (chIdx === 3) {
      this.synth.silenceNoise();
    }
  }

  /**
   * Restore a music channel's current state to the synthesizer.
   * Called when SFX finishes on the corresponding hardware channel,
   * so music resumes seamlessly.
   */
  restoreChannel(hwChannel: number): void {
    if (!this.playing || hwChannel >= this.channels.length) return;
    const ch = this.channels[hwChannel];
    if (!ch || !ch.active) return;

    // Re-apply current music state to the synth
    if (hwChannel <= 1) {
      if (ch.currentFreq > 0 && ch.volume > 0) {
        this.synth.setPulseDuty(hwChannel as 0 | 1, ch.dutyCycle);
        this.synth.setPulseFrequency(hwChannel as 0 | 1, ch.currentFreq);
        this.synth.setPulseVolume(hwChannel as 0 | 1, ch.volume);
      } else {
        this.synth.silencePulse(hwChannel as 0 | 1);
      }
    } else if (hwChannel === 2) {
      if (ch.currentFreq > 0 && ch.waveVolumeLevel > 0) {
        this.synth.setWaveFrequency(ch.currentFreq);
        this.synth.setWaveVolume(ch.waveVolumeLevel);
      } else {
        this.synth.silenceWave();
      }
    }
    // Noise channel (3) doesn't need restoration — drum notes are triggered individually
  }
}
