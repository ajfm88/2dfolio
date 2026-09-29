/**
 * Game Boy audio synthesizer — sample-by-sample generation via ScriptProcessorNode.
 *
 * Generates all 4 channels (2 pulse, wave, noise) sample-by-sample in JavaScript,
 * matching how real GB emulators work. This approach gives us:
 *   - Proper staircase waveforms for the wave channel (no browser interpolation)
 *   - Correct LFSR noise with sharp step transitions
 *   - Accurate channel mixing (simple addition, divided by 4, like real hardware)
 *   - GB DAC conversion: digital 0-15 → analog (-1 to +1) with negative slope
 *
 * The mixed output goes through BiquadFilter nodes for analog simulation.
 */

const BUFFER_SIZE = 2048; // ScriptProcessorNode buffer size

// Duty cycle patterns (8 steps each)
const DUTY_TABLES: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 1], // 12.5%
  [1, 0, 0, 0, 0, 0, 0, 1], // 25%
  [1, 0, 0, 0, 0, 1, 1, 1], // 50%
  [0, 1, 1, 1, 1, 1, 1, 0], // 75%
];

// Per-channel phase accumulators and state
interface PulseState {
  frequency: number;  // Hz
  volume: number;     // 0-15
  duty: number;       // 0-3
  enabled: boolean;
  phase: number;      // 0-1 fractional position in cycle
}

interface WaveState {
  frequency: number;
  volumeLevel: number;  // 0-3
  waveform: number[];   // 32 values, 0-15
  enabled: boolean;
  phase: number;
}

interface NoiseState {
  volume: number;       // 0-15 (current, faded by internal envelope)
  volumeInitial: number; // volume at trigger
  enabled: boolean;
  shiftRate: number;    // LFSR clock rate in Hz
  lfsr: number;         // current LFSR state
  feedbackBit: number;  // 6 for 7-bit, 14 for 15-bit
  phase: number;        // fractional accumulator for LFSR clock
  currentBit: number;   // current output bit (0 or 1)
  // Hardware envelope (runs at 64 Hz on real GB)
  envFade: number;      // envelope fade rate (0-7, 0=disabled)
  envIncreasing: boolean;
  envCounter: number;   // counts up to envFade, then ticks
  envPhase: number;     // fractional accumulator for 64Hz envelope clock
}

export class GBSynthesizer {
  private ctx: AudioContext | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private masterGainNode: GainNode | null = null;

  // Channel state (public for debug access)
  pulse: PulseState[] = [
    { frequency: 0, volume: 0, duty: 2, enabled: false, phase: 0 },
    { frequency: 0, volume: 0, duty: 2, enabled: false, phase: 0 },
  ];
  wave: WaveState = { frequency: 0, volumeLevel: 0, waveform: [], enabled: false, phase: 0 };
  noise: NoiseState = {
    volume: 0, volumeInitial: 0, enabled: false, shiftRate: 0,
    lfsr: 0x7FFF, feedbackBit: 14, phase: 0, currentBit: 0,
    envFade: 0, envIncreasing: false, envCounter: 0, envPhase: 0,
  };

  private masterVolume = 0.5; // Overall output scaling

  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();

    // === GB analog output simulation filters ===
    // Low-pass at ~12 kHz (2nd order) — removes harsh aliasing
    const lpf = this.ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 12000;
    lpf.Q.value = 0.7071;

    // High-pass at 65 Hz — coupling capacitor
    const hpf = this.ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 65;
    hpf.Q.value = 0.7071;

    // Master gain
    this.masterGainNode = this.ctx.createGain();
    this.masterGainNode.gain.value = this.masterVolume;

    // Chain: scriptNode → HPF → LPF → masterGain → destination
    this.masterGainNode.connect(this.ctx.destination);
    lpf.connect(this.masterGainNode);
    hpf.connect(lpf);

    // ScriptProcessorNode: generates all samples in JS
    this.scriptNode = this.ctx.createScriptProcessor(BUFFER_SIZE, 0, 1);
    this.scriptNode.onaudioprocess = (e) => this.generateSamples(e);
    this.scriptNode.connect(hpf);
  }

  async resume(): Promise<void> {
    if (!this.ctx) this.init();
    if (this.ctx!.state === 'suspended') {
      await this.ctx!.resume();
    }
  }

  getContext(): AudioContext | null {
    return this.ctx;
  }

  // ─── Sample Generation (called by ScriptProcessorNode) ──────────────

  private generateSamples(e: AudioProcessingEvent): void {
    const output = e.outputBuffer.getChannelData(0);
    const sampleRate = e.outputBuffer.sampleRate;
    const len = output.length;

    for (let i = 0; i < len; i++) {
      let mix = 0;

      mix += this.samplePulse(this.pulse[0], sampleRate);
      mix += this.samplePulse(this.pulse[1], sampleRate);
      mix += this.sampleWave(sampleRate);
      mix += this.sampleNoise(sampleRate);

      // GB mixer: sum of channels, scale to prevent clipping
      output[i] = mix * 0.25;
    }
  }

  private samplePulse(ch: PulseState, sampleRate: number): number {
    if (!ch.enabled || ch.frequency <= 0 || ch.volume <= 0) return 0;

    // Advance phase
    ch.phase += ch.frequency / sampleRate;
    if (ch.phase >= 1) ch.phase -= Math.floor(ch.phase);

    // Look up duty cycle pattern (8 steps)
    const step = Math.floor(ch.phase * 8) & 7;
    const digital = DUTY_TABLES[ch.duty & 3][step] * ch.volume; // 0 or volume

    // GB DAC: 0→+1, 15→-1 (negative slope)
    return (digital / 7.5) - 1.0;
  }

  private sampleWave(sampleRate: number): number {
    const w = this.wave;
    if (!w.enabled || w.frequency <= 0 || w.volumeLevel <= 0 || w.waveform.length === 0) return 0;

    // Advance phase
    w.phase += w.frequency / sampleRate;
    if (w.phase >= 1) w.phase -= Math.floor(w.phase);

    // Look up waveform (32 steps)
    const step = Math.floor(w.phase * 32) & 31;
    const raw = w.waveform[step]; // 0-15

    // Wave channel volume shift: 0=mute, 1=100%, 2=50%, 3=25%
    const shifts = [4, 0, 1, 2]; // shift amounts for volume levels 0-3
    const digital = raw >> shifts[w.volumeLevel & 3];

    // GB DAC
    return (digital / 7.5) - 1.0;
  }

  private sampleNoise(sampleRate: number): number {
    const n = this.noise;
    if (!n.enabled || n.volume <= 0 || n.shiftRate <= 0) return 0;

    // Advance LFSR clock
    n.phase += n.shiftRate / sampleRate;
    while (n.phase >= 1) {
      n.phase -= 1;
      const feedback = ((n.lfsr >> 0) ^ (n.lfsr >> 1)) & 1;
      n.lfsr = (n.lfsr >> 1) | (feedback << n.feedbackBit);
      n.currentBit = n.lfsr & 1;
    }

    // Hardware envelope: runs at 64 Hz (GB frame sequencer step 7)
    if (n.envFade > 0) {
      n.envPhase += 64 / sampleRate;
      while (n.envPhase >= 1) {
        n.envPhase -= 1;
        n.envCounter++;
        if (n.envCounter >= n.envFade) {
          n.envCounter = 0;
          if (n.envIncreasing && n.volume < 15) {
            n.volume++;
          } else if (!n.envIncreasing && n.volume > 0) {
            n.volume--;
          }
          if (n.volume === 0) n.enabled = false;
        }
      }
    }

    // Output: bit * volume through DAC
    const digital = n.currentBit * n.volume;
    return (digital / 7.5) - 1.0;
  }

  // ─── Pulse Channels ────────────────────────────────────────────────────

  setPulseFrequency(channel: 0 | 1, hz: number): void {
    this.pulse[channel].frequency = hz;
    this.pulse[channel].enabled = hz > 0 && this.pulse[channel].volume > 0;
  }

  setPulseDuty(channel: 0 | 1, duty: number): void {
    this.pulse[channel].duty = duty & 3;
  }

  setPulseVolume(channel: 0 | 1, volume: number): void {
    const v = Math.max(0, Math.min(15, volume));
    this.pulse[channel].volume = v;
    this.pulse[channel].enabled = v > 0 && this.pulse[channel].frequency > 0;
  }

  silencePulse(channel: 0 | 1): void {
    this.pulse[channel].volume = 0;
    this.pulse[channel].enabled = false;
  }

  // ─── Wave Channel ──────────────────────────────────────────────────────

  setWaveFrequency(hz: number): void {
    this.wave.frequency = hz;
    this.wave.enabled = hz > 0 && this.wave.volumeLevel > 0;
  }

  setWaveInstrument(samples: number[]): void {
    this.wave.waveform = samples;
  }

  setWaveVolume(level: number): void {
    this.wave.volumeLevel = level & 3;
    this.wave.enabled = this.wave.volumeLevel > 0 && this.wave.frequency > 0;
  }

  silenceWave(): void {
    this.wave.volumeLevel = 0;
    this.wave.enabled = false;
  }

  // ─── Noise Channel ─────────────────────────────────────────────────────

  triggerNoise(polynomialCounter: number, volume: number, fade: number): void {
    const n = this.noise;
    n.volume = Math.max(0, Math.min(15, volume));
    n.volumeInitial = n.volume;
    n.enabled = true;

    // Hardware envelope parameters
    n.envFade = fade & 0x7;          // rate (0=disabled)
    n.envIncreasing = (fade & 0x8) !== 0;
    n.envCounter = 0;
    n.envPhase = 0;

    // Calculate LFSR clock rate
    // Pan Docs: freq = 262144 / (r * 2^s) Hz, where r=0 treated as 0.5
    const shiftClock = (polynomialCounter >> 4) & 0xF;
    const divisorCode = polynomialCounter & 0x7;
    const divider = divisorCode === 0 ? 0.5 : divisorCode;
    n.shiftRate = 262144 / (divider * Math.pow(2, shiftClock));

    // Short mode (7-bit) vs normal (15-bit)
    const shortMode = (polynomialCounter & 0x8) !== 0;
    n.lfsr = shortMode ? 0x7F : 0x7FFF;
    n.feedbackBit = shortMode ? 6 : 14;
    n.phase = 0;
    n.currentBit = n.lfsr & 1;
  }

  setNoiseVolume(volume: number): void {
    this.noise.volume = Math.max(0, Math.min(15, volume));
    if (this.noise.volume === 0) this.noise.enabled = false;
  }

  silenceNoise(): void {
    this.noise.volume = 0;
    this.noise.enabled = false;
  }

  // ─── Master ────────────────────────────────────────────────────────────

  setMasterVolume(left: number, right: number): void {
    this.masterVolume = 0.5 * ((left + right) / 2) / 7;
    if (this.masterGainNode && this.ctx) {
      this.masterGainNode.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    }
  }

  silenceAll(): void {
    this.silencePulse(0);
    this.silencePulse(1);
    this.silenceWave();
    this.silenceNoise();
  }

  renderTick(): void { }
}
