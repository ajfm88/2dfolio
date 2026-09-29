/**
 * SFX engine — plays sound effects over music channels.
 *
 * On the Game Boy, SFX channels 5-8 override music channels 1-4 respectively.
 * SFX uses direct frequency values (square_note) and hardware pitch sweep,
 * unlike music which uses octave + pitch note lookups.
 *
 * When an SFX finishes, the corresponding music channel resumes.
 */

import { GBSynthesizer } from './synthesizer';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SfxCommand {
  cmd: string;
  value?: number;
  length?: number;
  volume?: number;
  fade?: number;
  frequency?: number;
  param?: number;
  shift?: number;
  left?: number;
  right?: number;
  speed?: number;
  delay?: number;
  depth?: number;
  rate?: number;
  octave?: number;
  pitch?: number;
  count?: number;
  target?: number;
  d0?: number;
  d1?: number;
  d2?: number;
  d3?: number;
}

export interface SfxChannel {
  id: number; // 5-8
  commands: SfxCommand[];
}

export interface SfxData {
  channels: SfxChannel[];
}

// ─── Channel State ───────────────────────────────────────────────────────────

interface SfxChannelState {
  active: boolean;
  hwChannel: number;      // hardware channel 0-3 (id - 5)
  commands: SfxCommand[];
  pc: number;
  noteDelayCounter: number;
  dutyCycle: number;

  // square_note state
  volume: number;
  fade: number;           // encoded: bit 3 = direction, bits 2-0 = rate
  fadeCounter: number;
  currentFreqReg: number; // raw GB frequency register (11-bit)

  // pitch_sweep state (NR10 hardware sweep)
  sweepTime: number;      // sweep pace (0 = disabled)
  sweepShift: number;     // sweep shift amount
  sweepNegate: boolean;    // true = decrease frequency
  sweepCounter: number;

  // For noise channel
  isNoiseChannel: boolean;

  // sound_loop
  loopCounter: number;
}

// ─── SFX Engine ──────────────────────────────────────────────────────────────

export class SfxEngine {
  private synth: GBSynthesizer;
  private channels: SfxChannelState[] = [];
  private _playing: boolean = false;

  // Callback to notify music engine when SFX finishes on a channel
  onChannelDone: ((hwChannel: number) => void) | null = null;

  constructor(synth: GBSynthesizer) {
    this.synth = synth;
  }

  /**
   * Play an SFX. Stops any currently playing SFX first.
   */
  play(data: SfxData): void {
    this.stop();
    this.channels = [];
    this._playing = true;

    for (const ch of data.channels) {
      const hwCh = ch.id <= 4 ? ch.id - 1 : ch.id - 5; // ch5->0, ch6->1, ch7->2, ch8->3
      const state: SfxChannelState = {
        active: true,
        hwChannel: hwCh,
        commands: ch.commands,
        pc: 0,
        noteDelayCounter: 0,
        dutyCycle: 2,
        volume: 15,
        fade: 0,
        fadeCounter: 0,
        currentFreqReg: 0,
        sweepTime: 0,
        sweepShift: 0,
        sweepNegate: false,
        sweepCounter: 0,
        isNoiseChannel: hwCh === 3,
        loopCounter: 0,
      };
      this.channels.push(state);
    }
  }

  /**
   * Stop all SFX channels.
   */
  stop(): void {
    for (const ch of this.channels) {
      if (ch.active) {
        this.silenceHwChannel(ch.hwChannel);
        ch.active = false;
      }
    }
    this.channels = [];
    this._playing = false;
  }

  isPlaying(): boolean {
    return this._playing;
  }

  /**
   * Check if SFX is active on a specific hardware channel (0-3).
   */
  isChannelActive(hwChannel: number): boolean {
    return this.channels.some(ch => ch.active && ch.hwChannel === hwChannel);
  }

  /**
   * Called once per frame (~59.7 Hz).
   */
  tick(): void {
    if (!this._playing) return;

    let anyActive = false;
    for (const ch of this.channels) {
      if (!ch.active) continue;
      this.tickChannel(ch);
      if (ch.active) anyActive = true;
    }

    if (!anyActive) {
      this._playing = false;
    }
  }

  // ─── Tick Logic ────────────────────────────────────────────────────────

  private tickChannel(ch: SfxChannelState): void {
    if (ch.noteDelayCounter > 1) {
      ch.noteDelayCounter--;
      this.applyTickEffects(ch);
      return;
    }

    if (ch.noteDelayCounter === 1) {
      ch.noteDelayCounter = 0;
    }

    // Advance to next command
    this.playNextCommand(ch);
  }

  private applyTickEffects(ch: SfxChannelState): void {
    // Volume fade
    this.applyVolumeFade(ch);

    // Pitch sweep (NR10 hardware sweep simulation)
    this.applyPitchSweep(ch);
  }

  private applyVolumeFade(ch: SfxChannelState): void {
    if (ch.fade === 0) return;

    const rate = ch.fade & 0x7;
    if (rate === 0) return;

    ch.fadeCounter++;
    if (ch.fadeCounter < rate) return;
    ch.fadeCounter = 0;

    const increasing = (ch.fade & 0x8) !== 0;
    if (increasing) {
      if (ch.volume < 15) {
        ch.volume++;
        this.updateVolume(ch);
      }
    } else {
      if (ch.volume > 0) {
        ch.volume--;
        this.updateVolume(ch);
      }
    }
  }

  private applyPitchSweep(ch: SfxChannelState): void {
    if (ch.sweepTime === 0 || ch.sweepShift === 0) return;

    ch.sweepCounter++;
    if (ch.sweepCounter < ch.sweepTime) return;
    ch.sweepCounter = 0;

    // NR10 sweep: freq ± freq >> shift
    const delta = ch.currentFreqReg >> Math.abs(ch.sweepShift);
    if (ch.sweepNegate) {
      ch.currentFreqReg = Math.max(0, ch.currentFreqReg - delta);
    } else {
      ch.currentFreqReg = Math.min(2047, ch.currentFreqReg + delta);
    }

    // Overflow check — if freq > 2047, channel is disabled (like real hardware)
    if (ch.currentFreqReg > 2047) {
      ch.active = false;
      this.finishChannel(ch);
      return;
    }

    const hz = 131072 / (2048 - ch.currentFreqReg);
    this.synth.setPulseFrequency(ch.hwChannel as 0 | 1, hz);
  }

  // ─── Command Processing ───────────────────────────────────────────────

  private playNextCommand(ch: SfxChannelState): void {
    let safety = 0;
    while (safety++ < 200) {
      if (ch.pc >= ch.commands.length) {
        ch.active = false;
        this.finishChannel(ch);
        return;
      }

      const cmd = ch.commands[ch.pc];
      ch.pc++;

      switch (cmd.cmd) {
        case 'duty_cycle':
          ch.dutyCycle = cmd.value!;
          if (ch.hwChannel <= 1) {
            this.synth.setPulseDuty(ch.hwChannel as 0 | 1, cmd.value!);
          }
          break;

        case 'pitch_sweep': {
          // pitch_sweep length, shift
          // length = sweep time (0-7), shift = pitch change (-7 to 7)
          // Positive shift = increase frequency, negative = decrease
          ch.sweepTime = cmd.length!;
          const shift = cmd.shift!;
          // A shift of 8 means "negative 0" in signed magnitude — effectively disabled
          if (shift === 8 || shift === -8) {
            ch.sweepShift = 0;
            ch.sweepNegate = false;
          } else if (shift < 0) {
            ch.sweepShift = -shift;
            ch.sweepNegate = true;
          } else {
            ch.sweepShift = shift;
            ch.sweepNegate = false;
          }
          ch.sweepCounter = 0;
          break;
        }

        case 'square_note': {
          // square_note length, volume, fade, frequency
          // Length is in frames (length + 1)
          ch.noteDelayCounter = cmd.length! + 1;
          ch.volume = cmd.volume!;

          // Encode fade
          if (cmd.fade! < 0) {
            ch.fade = 0x8 | (-cmd.fade!);
          } else {
            ch.fade = cmd.fade!;
          }
          ch.fadeCounter = 0;

          // Direct frequency register value
          ch.currentFreqReg = cmd.frequency! & 0x7FF;
          const hz = 131072 / (2048 - ch.currentFreqReg);

          if (ch.hwChannel <= 1) {
            this.synth.setPulseFrequency(ch.hwChannel as 0 | 1, hz);
            this.synth.setPulseDuty(ch.hwChannel as 0 | 1, ch.dutyCycle);
            this.synth.setPulseVolume(ch.hwChannel as 0 | 1, ch.volume);
          }
          return; // Wait for delay
        }

        case 'noise_note': {
          // noise_note length, volume, fade, param
          ch.noteDelayCounter = cmd.length! + 1;
          ch.volume = cmd.volume!;

          // Encode fade for hardware envelope
          const fade = cmd.fade!;
          let encodedFade: number;
          if (fade < 0) {
            encodedFade = 0x8 | (-fade);
          } else {
            encodedFade = fade;
          }

          this.synth.triggerNoise(cmd.param!, cmd.volume!, encodedFade);
          return; // Wait for delay
        }

        case 'rest':
          ch.noteDelayCounter = cmd.length!;
          if (!ch.isNoiseChannel) {
            this.silenceHwChannel(ch.hwChannel);
          }
          return;

        case 'sound_ret':
          ch.active = false;
          this.finishChannel(ch);
          return;

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
          }
          break;

        case 'volume':
          this.synth.setMasterVolume(cmd.left!, cmd.right!);
          break;

        case 'tempo':
          // SFX doesn't typically use tempo, but some complex ones might
          break;

        default:
          // Unknown command, skip
          break;
      }
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private updateVolume(ch: SfxChannelState): void {
    if (ch.hwChannel <= 1) {
      this.synth.setPulseVolume(ch.hwChannel as 0 | 1, ch.volume);
    }
    // Noise volume is handled by hardware envelope in synthesizer
  }

  private silenceHwChannel(hwChannel: number): void {
    if (hwChannel <= 1) {
      this.synth.silencePulse(hwChannel as 0 | 1);
    } else if (hwChannel === 2) {
      this.synth.silenceWave();
    } else if (hwChannel === 3) {
      this.synth.silenceNoise();
    }
  }

  private finishChannel(ch: SfxChannelState): void {
    this.silenceHwChannel(ch.hwChannel);
    this.onChannelDone?.(ch.hwChannel);
  }
}
