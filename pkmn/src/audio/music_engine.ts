/**
 * Game Boy music engine — faithful port of audio/engine_1.asm.
 *
 * Ticked once per frame (~59.7 Hz). The channels' command interpreter is
 * SoundChannel (sound_channel.ts), shared with music-mode SFX (A1a, DECISIONS #40);
 * this engine owns the track's channels and the music tempo.
 */

import { GBSynthesizer } from './synthesizer';
import { SoundChannel } from './sound_channel';
import type { ChannelHost } from './sound_channel';
import type { SfxEngine } from './sfx_engine';
import { bindAlarmSynth, lowHealthChannel5 } from './low_health_alarm';

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

export interface NoiseStep {
  length: number;
  volume: number;
  fade: number;
  param: number;
}

export interface NoiseInstrument {
  steps: NoiseStep[];
}

/** A drum hit's time on software channel 8: its instrument's noise_notes each last
 *  length + 1 updates (tempo $0100, speed 1), then sound_ret frees the channel. */
export function drumHitUpdates(instrument: NoiseInstrument): number {
  return instrument.steps.reduce((sum, step) => sum + step.length + 1, 0);
}

// ─── Music Engine ────────────────────────────────────────────────────────────

export class MusicEngine {
  private synth: GBSynthesizer;
  private channels: SoundChannel[] = [];
  private tempo: number = 256; // wMusicTempo (16-bit)
  private playing: boolean = false;
  private waveSamples: number[][] = [];
  private noiseInstruments: NoiseInstrument[] = [];
  /** The SFX engine as of this update (channel 8's real SFX, for drum hits). */
  private sfx: SfxEngine | undefined;
  /**
   * Software channel 8 held by a drum hit: updates left, counted down at the end of each
   * update (a hit started this update reads sound_ret after its instrument's length).
   * Drums are noise-instrument SFX there (DetermineAudioFunction), so WaitForSoundToFinish
   * waits for them too.
   */
  private drumBusy = 0;
  private drumId = 0;
  /** Opt-in WRAM owner used by the battle audio adapter. */
  audioControl: { getMute(): number; setMute(value: number): void } | null = null;

  /** What the music channels read from the engine (wMusicTempo, the sample tables). */
  private readonly host: ChannelHost;

  constructor(synth: GBSynthesizer) {
    this.synth = synth;
    bindAlarmSynth(synth);
    this.host = {
      synth,
      tempo: () => this.tempo,
      setTempo: (value) => {
        // Audio1_tempo on a music channel: wMusicTempo, and the fractions of CHAN1–4
        this.tempo = value;
        for (const ch of this.channels) ch.noteDelayFractional = 0;
      },
      waveSamples: () => this.waveSamples,
      noiseInstruments: () => this.noiseInstruments,
      drumHit: (instrument) => this.drumHit(instrument),
    };
  }

  /**
   * Audio1_PlaySound for a noise instrument (1425–1431): it can't replace a drum hit or a
   * real SFX on channel 8, so it's dropped; otherwise channel 8 is busy for its length.
   */
  private drumHit(instrument: number): boolean {
    if (this.drumBusy > 0 || (this.sfx?.isChannelActive(3) ?? false)) return false;
    const instr = this.noiseInstruments[instrument - 1];
    if (!instr) return false;
    this.drumBusy = drumHitUpdates(instr) + 1;
    this.drumId = instrument;
    return true;
  }

  /** Software channel 8 is held by a drum hit (not a real SFX: that's the SFX engine's). */
  get channel8DrumBusy(): boolean {
    return this.drumBusy > 0;
  }

  get channel8DrumId(): number { return this.channel8DrumBusy ? this.drumId : 0; }

  /** A real SFX started on channel 8: it replaces a drum hit under way (1433–1436). */
  cancelDrum(): void {
    this.drumBusy = 0;
    this.drumId = 0;
    for (const ch of this.channels) if (ch.hw === 3) ch.cancelDrum();
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
    this.tempo = 256; // Audio2_InitMusicVariables: wMusicTempo = $0100

    // Ticked in id order, as Audio1_UpdateMusic runs CHAN1 → CHAN4
    for (const ch of [...data.channels].sort((a, b) => a.id - b.id)) {
      this.channels.push(new SoundChannel(ch.id, ch.commands, this.host));
    }
  }

  /**
   * Stop all playback.
   */
  stop(): void {
    this.playing = false;
    this.channels = [];
    this.drumBusy = 0;
    this.synth.silenceAll();
  }

  isPlaying(): boolean {
    return this.playing;
  }

  /** wMusicTempo. */
  get musicTempo(): number {
    return this.tempo;
  }

  /** The track's channel with this id (CHAN1–4), for inspection. */
  getChannel(id: number): SoundChannel | undefined {
    return this.channels.find(ch => ch.id === id);
  }

  /**
   * The music half of one audio update (~59.7 Hz): CHAN1–4 in order, before the SFX
   * channels (tickAudio). A channel whose SFX channel is busy is suppressed: it counts
   * and runs its commands but writes nothing (Audio1_ApplyMusicAffects 48–56).
   */
  tick(sfxEngine?: SfxEngine): void {
    this.sfx = sfxEngine;
    if (!this.playing) return;

    for (const ch of this.channels) {
      if (!ch.active) continue;
      // Audio1_UpdateMusic: nonzero pauses CHAN1–4; bit 7 records the output mute.
      const mute = this.audioControl?.getMute() ?? 0;
      if (mute !== 0) {
        if ((mute & 0x80) === 0) {
          for (let hw = 0; hw < 4; hw++) this.synth.setChannelOutput(hw, false);
          this.audioControl?.setMute(mute | 0x80);
        }
        continue;
      }
      const sfxBusy = sfxEngine?.isChannelActive(ch.hw) ?? false;
      // The alarm's CHAN5 id occupies pulse 1 without being an SFX program.
      // The high tone leaves that id alone, so a clean first high does not suppress.
      const alarmBusy = ch.hw === 0 && lowHealthChannel5() !== 0;
      if (this.audioControl && !sfxBusy && !alarmBusy && ch.noteDelayCounter === 1)
        this.synth.setChannelOutput(ch.hw, true);
      ch.tick(sfxBusy || alarmBusy);
    }
    if (this.drumBusy > 0) this.drumBusy--;

    // Render this tick's audio samples and queue for playback
    this.synth.renderTick();
  }

  /**
   * An SFX ended on a hardware channel. Nothing re-triggers the music: its channel there
   * stays silent until its next note or rest (Audio1_sound_ret, 186–207).
   */
  releaseChannel(hwChannel: number): void {
    for (const ch of this.channels) if (ch.hw === hwChannel) ch.release();
  }
}
