/**
 * SFX engine — plays sound effects over music channels.
 *
 * On the Game Boy, SFX channels 5-8 override music channels 1-4 respectively.
 * SFX uses direct frequency values (square_note) and hardware pitch sweep,
 * unlike music which uses octave + pitch note lookups.
 *
 * When an SFX finishes, it hands its hardware channel back: the music channel there stays
 * silent until its next note or rest (onChannelDone → MusicEngine.releaseChannel).
 *
 * A channel whose first command is `execute_music` (the item jingles and the other
 * music-mode SFX) runs on the shared music interpreter, SoundChannel, at the SFX tempo:
 * Audio1_SetSfxTempo forces $0100 before every note of anything that isn't a cry or a
 * battle SFX, so an SFX's own `tempo` command never takes effect (engine_1.asm 700–746,
 * 983–1004). Other channels keep the SFX-mode interpreter below.
 */

import { GBSynthesizer } from './synthesizer';
import { SoundChannel } from './sound_channel';
import type { ChannelHost } from './sound_channel';
import { sfxModifierState } from './sfx_modifiers';

type ReadModifiers = () => { tempo: number; frequency: number };

/** wSfxTempo as Audio1_SetSfxTempo leaves it for every non-cry SFX. */
export const SFX_TEMPO = 0x100;

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

/** SfxEngine.observeChannel's copy: the command stream is the installed one, not a clone. */
export interface SfxChannelObservation {
  readonly id: number;
  readonly active: boolean;
  /** The authoritative sound ID still names this channel (channelEnabled), as Audio1_UpdateMusic checks. */
  readonly enabled: boolean;
  readonly commands: readonly SfxCommand[];
  /** Index of the next command the SFX-mode interpreter reads. */
  readonly pc: number;
  readonly noteDelayCounter: number;
  readonly musicMode: boolean;
  readonly battle: boolean;
}

// ─── Channel State ───────────────────────────────────────────────────────────

interface SfxChannelState {
  active: boolean;
  id: number;             // software channel 5-8
  hwChannel: number;      // hardware channel 0-3 (id - 5)
  /** Music mode (execute_music): the shared interpreter runs this channel. */
  music: SoundChannel | null;
  commands: SfxCommand[];
  pc: number;
  noteDelayCounter: number;
  noteDelayFractional: number;
  dutyCycle: number;
  dutyPattern: number | null;

  // square_note state
  volume: number;
  fade: number;           // encoded: bit 3 = direction, bits 2-0 = rate
  fadeCounter: number;
  currentFreqReg: number; // raw GB frequency register (11-bit)


  // For noise channel
  isNoiseChannel: boolean;

  // sound_loop
  loopCounter: number;
  modifiers: ReadModifiers | null;
  cryActive: (() => boolean) | null;
  battle: boolean;
}

// ─── SFX Engine ──────────────────────────────────────────────────────────────

export class SfxEngine {
  private synth: GBSynthesizer;
  private channels: SfxChannelState[] = [];
  private _playing: boolean = false;
  private waveSamples: number[][] = [];

  // Callback to notify music engine when SFX finishes on a channel
  onChannelDone: ((hwChannel: number) => void) | null = null;
  /** Opt-in observers for ports which own wChannelSoundIDs. */
  onSfxChannelDone: ((id: number) => void) | null = null;
  /** Audio1_UpdateMusic skips an SFX channel once its authoritative sound ID becomes 0. */
  channelEnabled: ((id: number) => boolean) | null = null;
  /** Audio1_PlayNextNote may return before reading any command (the CHAN5 alarm). */
  beforeNextNote: ((id: number) => boolean) | null = null;
  onSoundIdsCleared: (() => void) | null = null;

  /** What music-mode SFX channels read: the SFX tempo and the wave instruments. */
  private readonly host: ChannelHost;

  constructor(synth: GBSynthesizer) {
    this.synth = synth;
    this.host = {
      synth,
      tempo: () => SFX_TEMPO,
      // Audio1_tempo on CHAN5–8: wSfxTempo (overwritten before every note) and the
      // fractions of CHAN5–8
      setTempo: () => {
        for (const ch of this.channels) if (ch.music) ch.music.noteDelayFractional = 0;
      },
      waveSamples: () => this.waveSamples,
      noiseInstruments: () => [],
      drumHit: () => false,
    };
  }

  setWaveSamples(samples: number[][]): void {
    this.waveSamples = samples;
  }

  /** Audio1_EnableChannelOutput changes routing without re-triggering or muting the DAC. */
  enableChannelOutput(hwChannel: number): void { this.synth.setChannelOutput(hwChannel, true); }

  /**
   * Play an SFX, stopping every SFX first (upstream's rule). The field's PlaySound uses installSfx after
   * Audio1_PlaySound's priority walk (V5g2); this stays for direct callers and the id-less debug path.
   */
  play(data: SfxData): void {
    this.stop();
    this.channels = [];
    this._playing = true;

    this.install(data);
  }

  /**
   * Audio2_PlaySound's successful common path. The battle bridge has already performed
   * its reverse-header priority walk and cleared the accepted channels. This deliberately
   * does not implement priority for ordinary SFX callers.
   */
  installBattleSfx(data: SfxData, modifiers: ReadModifiers): void {
    this.install(data, modifiers, null, true);
  }

  /** The common cry start in Audio1–4_PlaySound, after the real header was accepted. */
  installCry(data: SfxData, modifiers: ReadModifiers, cryActive: () => boolean, battle = false): void {
    this.clearChannelsForPriority([7]);
    this.install({ channels: [...data.channels, { id: 7, commands: [{ cmd: 'sound_ret' }] }] },
      modifiers, cryActive, battle);
    if (sfxModifierState.savedVolume === 0) {
      sfxModifierState.savedVolume = this.synth.masterVolumeRegister;
      this.synth.setMasterVolume(7, 7);
    }
  }

  /** Audio1_PlaySound's common path for the field: the caller walked the header and cleared each accepted channel. */
  installSfx(data: SfxData): void {
    this.install(data);
  }

  // A5c3e checkpoint-04b; only battle_flute_audio.ts calls it.
  replacePendingMusicSfxStream(id: number, commands: SfxCommand[]): void {
    const ch = this.channels.find(ch => ch.active && ch.id === id);
    if (!ch?.music || ch.music.pc !== 0 || ch.music.noteDelayCounter !== 1) {
      throw new Error('expected pending music SFX');
    }
    ch.commands = commands;
    ch.pc = 0;
    ch.music = new SoundChannel(id, commands, this.host);
  }

  /** InitSFXVariables: clear software state only; do not sound_ret, mute, or release music. */
  clearChannelsForPriority(ids: readonly number[]): void {
    const selected = new Set(ids);
    this.channels = this.channels.filter(ch => !selected.has(ch.id));
    this._playing = this.channels.some(ch => ch.active);
  }

  private install(data: SfxData, modifiers: ReadModifiers | null = null, cryActive: (() => boolean) | null = null,
    battle = false): void {
    // Audio1_UpdateMusic runs CHAN5 → CHAN8 in order, whatever the header's order
    for (const ch of [...data.channels].sort((a, b) => a.id - b.id)) {
      const hwCh = ch.id <= 4 ? ch.id - 1 : ch.id - 5; // ch5->0, ch6->1, ch7->2, ch8->3
      const musicMode = ch.commands[0]?.cmd === 'execute_music';
      const state: SfxChannelState = {
        active: true,
        id: ch.id,
        hwChannel: hwCh,
        music: musicMode ? new SoundChannel(ch.id, ch.commands, this.host) : null,
        commands: ch.commands,
        pc: 0,
        noteDelayCounter: modifiers ? 1 : 0,
        noteDelayFractional: 0,
        dutyCycle: cryActive ? 0 : 2,
        dutyPattern: null,
        volume: 15,
        fade: 0,
        fadeCounter: 0,
        currentFreqReg: 0,
        isNoiseChannel: hwCh === 3,
        loopCounter: 0,
        modifiers,
        cryActive,
        battle,
      };
      this.channels.push(state);
    }
    this._playing = this.channels.some(ch => ch.active);
  }

  /**
   * Stop all SFX channels. Each one stopped hands its hardware channel back to the music,
   * as an ending one does.
   */
  stop(): void {
    for (const ch of this.channels) {
      if (ch.active) {
        ch.active = false;
        this.finishChannel(ch);
      }
    }
    this.channels = [];
    this._playing = false;
  }

  isPlaying(): boolean {
    return this._playing;
  }

  /** PlaySound's CHAN5–8 ID clear: no sound_ret, hardware mute or release callback. */
  clearSoundIds(): void {
    this.channels = [];
    this._playing = false;
    this.onSoundIdsCleared?.();
  }

  /**
   * Check if SFX is active on a specific hardware channel (0-3).
   */
  isChannelActive(hwChannel: number): boolean {
    return this.channels.some(ch => ch.active && ch.hwChannel === hwChannel && (this.channelEnabled?.(ch.id) ?? true));
  }

  /**
   * A read-only copy of software channel `id` (5–8) as the next update will find it, for timing owners;
   * undefined when no SFX channel with that id is installed. Reading it changes nothing.
   */
  observeChannel(id: number): SfxChannelObservation | undefined {
    const ch = this.channels.find(row => row.id === id);
    if (!ch) return undefined;
    return {
      id: ch.id, active: ch.active, enabled: this.channelEnabled?.(ch.id) ?? true, commands: ch.commands,
      pc: ch.pc, noteDelayCounter: ch.noteDelayCounter, musicMode: ch.music !== null, battle: ch.battle,
    };
  }

  /**
   * Called once per frame (~59.7 Hz).
   */
  tick(): void {
    if (!this._playing) return;

    let anyActive = false;
    for (const ch of this.channels) {
      if (!ch.active) continue;
      if (this.channelEnabled && !this.channelEnabled(ch.id)) { ch.active = false; continue; }
      this.tickChannel(ch);
      if (ch.active) anyActive = true;
    }

    if (!anyActive) {
      this._playing = false;
    }
  }

  // ─── Tick Logic ────────────────────────────────────────────────────────

  private tickChannel(ch: SfxChannelState): void {
    if (ch.modifiers && (ch.music?.noteDelayCounter ?? ch.noteDelayCounter) === 1
      && this.beforeNextNote?.(ch.id)) return;
    if (ch.music) {
      if (ch.battle && ch.music.noteDelayCounter === 1) this.enableChannelOutput(ch.hwChannel);
      ch.music.tick(false);
      if (!ch.music.active) {
        // Its final sound_ret: the sound ID is cleared and the channel handed back
        ch.active = false;
        this.finishChannel(ch);
      }
      return;
    }

    // Audio1_ApplyMusicAffects: byte 0 decrements to $FF; only 1 reads commands.
    if (ch.modifiers && ch.noteDelayCounter !== 1) {
      ch.noteDelayCounter = (ch.noteDelayCounter - 1) & 0xff;
      this.applyTickEffects(ch);
      return;
    }

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
    if (ch.dutyPattern !== null && ch.hwChannel <= 1) {
      ch.dutyPattern = ((ch.dutyPattern << 2) | (ch.dutyPattern >>> 6)) & 0xff;
      this.synth.setPulseDuty(ch.hwChannel as 0 | 1, ch.dutyPattern >>> 6);
    }
    // Volume fade
    this.applyVolumeFade(ch);
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

        case 'duty_cycle_pattern':
          if (ch.cryActive) {
            ch.dutyPattern = (cmd.d0! << 6) | (cmd.d1! << 4) | (cmd.d2! << 2) | cmd.d3!;
            ch.dutyCycle = cmd.d0!;
          }
          break;

        case 'pitch_sweep':
          // Audio1_pitch_sweep: the byte goes straight to rAUD1SWEEP, whichever SFX channel reads it.
          // The synthesizer runs channel 1's sweep on the hardware's 128 Hz clock.
          this.synth.writeSweep((cmd.length! << 4) | (cmd.shift! < 0 ? 0x8 | -cmd.shift! : cmd.shift!));
          break;

        case 'square_note': {
          if (ch.modifiers) this.enableChannelOutput(ch.hwChannel);
          // square_note length, volume, fade, frequency
          // Length is in frames (length + 1)
          const modifier = ch.modifiers?.();
          if (modifier) {
            // Audio1_note_length: (length + 1) * tempo plus this channel's retained
            // fractional byte. Noise bypasses Audio1_SetSfxTempo entirely.
            const total = (cmd.length! + 1) * modifier.tempo + ch.noteDelayFractional;
            ch.noteDelayCounter = (total >>> 8) & 0xff;
            ch.noteDelayFractional = total & 0xff;
          } else ch.noteDelayCounter = cmd.length! + 1;
          ch.volume = cmd.volume!;

          // Encode fade
          if (cmd.fade! < 0) {
            ch.fade = 0x8 | (-cmd.fade!);
          } else {
            ch.fade = cmd.fade!;
          }
          ch.fadeCounter = 0;

          // Direct frequency register value
          ch.currentFreqReg = (cmd.frequency! + (modifier?.frequency ?? 0)) & 0x7FF;
          const hz = 131072 / (2048 - ch.currentFreqReg);

          if (ch.hwChannel <= 1) {
            this.synth.setPulseFrequency(ch.hwChannel as 0 | 1, hz);
            this.synth.setPulseDuty(ch.hwChannel as 0 | 1, ch.dutyCycle);
            this.synth.setPulseVolume(ch.hwChannel as 0 | 1, ch.volume);
            // Audio1_ApplyWavePatternAndFrequency sets NR14 bit 7: a CH1 trigger reloads the sweep.
            if (ch.hwChannel === 0) this.synth.triggerSweep(ch.currentFreqReg);
          }
          return; // Wait for delay
        }

        case 'noise_note': {
          if (ch.modifiers) this.enableChannelOutput(ch.hwChannel);
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

          const param = (cmd.param! + (ch.modifiers?.().frequency ?? 0)) & 0xff;
          this.synth.triggerNoise(param, cmd.volume!, encodedFade);
          return; // Wait for delay
        }

        case 'rest':
          ch.noteDelayCounter = cmd.length!;
          if (!ch.isNoiseChannel) {
            this.silenceHwChannel(ch.hwChannel);
          }
          return;

        case 'sound_ret':
          if (ch.cryActive?.()) {
            if (ch.id !== 5) {
              ch.pc--;
              ch.noteDelayCounter = 1;
              this.silenceHwChannel(ch.hwChannel);
              return;
            }
            const volume = sfxModifierState.savedVolume;
            this.synth.setMasterVolume(volume >>> 4, volume & 0xf);
            sfxModifierState.savedVolume = 0;
          }
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
    this.onSfxChannelDone?.(ch.id);
  }
}
