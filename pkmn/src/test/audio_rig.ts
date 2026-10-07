// Test rig for the audio engines (A1a): a synthesizer that logs every register write with
// the audio update it happened in, and the two engines wired as audio/index.ts wires them
// (audioUpdate: music channels, then SFX channels). Tests only. It never touches `window`,
// so it runs under vitest's node environment.

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { GBSynthesizer } from '../audio/synthesizer';
import { MusicEngine } from '../audio/music_engine';
import { SfxEngine } from '../audio/sfx_engine';
import { audioUpdate } from '../audio/sound_wait';
import type { MusicData, MusicCommand, NoiseInstrument } from '../audio/music_engine';
import type { SfxData } from '../audio/sfx_engine';

const DATA = resolve(__dirname, '../../data/audio');

export function audioJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(DATA, path), 'utf8')) as T;
}

export const WAVES = audioJson<number[][]>('wave_samples.json');
export const NOISE = audioJson<NoiseInstrument[]>('noise_instruments.json');

export interface Write { u: number; m: string; a: number[] }

/** Hz back to the register that produced it. */
export const pulseReg = (hz: number): number => Math.round(2048 - 131072 / hz);
export const waveReg = (hz: number): number => Math.round(2048 - 65536 / hz);

export class LogSynth extends GBSynthesizer {
  update = 0;
  log: Write[] = [];
  private rec(m: string, a: number[]): void { this.log.push({ u: this.update, m, a }); }

  setPulseFrequency(ch: 0 | 1, hz: number): void { this.rec(`freq${ch}`, [pulseReg(hz)]); super.setPulseFrequency(ch, hz); }
  setPulseDuty(ch: 0 | 1, duty: number): void { this.rec(`duty${ch}`, [duty]); super.setPulseDuty(ch, duty); }
  setPulseVolume(ch: 0 | 1, v: number): void { this.rec(`vol${ch}`, [v]); super.setPulseVolume(ch, v); }
  silencePulse(ch: 0 | 1): void { this.rec(`silence${ch}`, []); super.silencePulse(ch); }
  setWaveFrequency(hz: number): void { this.rec('freq2', [waveReg(hz)]); super.setWaveFrequency(hz); }
  setWaveInstrument(samples: number[]): void { this.rec('wave', [WAVES.indexOf(samples)]); super.setWaveInstrument(samples); }
  setWaveVolume(level: number): void { this.rec('level2', [level]); super.setWaveVolume(level); }
  silenceWave(): void { this.rec('silence2', []); super.silenceWave(); }
  triggerNoise(param: number, volume: number, fade: number): void { this.rec('noise', [param, volume, fade]); super.triggerNoise(param, volume, fade); }

  /** The updates on which method `m` was called. */
  at(m: string): number[] { return this.log.filter(w => w.m === m).map(w => w.u); }
  /** The writes of method `m`, as [update, first argument]. */
  values(m: string): [number, number][] { return this.log.filter(w => w.m === m).map(w => [w.u, w.a[0]]); }
}

export interface Rig {
  synth: LogSynth;
  music: MusicEngine;
  sfx: SfxEngine;
  /** One audio update: Audio1_UpdateMusic's CHAN1–4, then CHAN5–8. */
  update(): void;
  run(n: number): void;
}

export function rig(track?: MusicData): Rig {
  const synth = new LogSynth();
  const music = new MusicEngine(synth);
  const sfx = new SfxEngine(synth);
  music.setWaveSamples(WAVES);
  music.setNoiseInstruments(NOISE);
  sfx.setWaveSamples(WAVES);
  sfx.onChannelDone = hw => music.releaseChannel(hw);
  if (track) music.play(track);
  const update = (): void => {
    synth.update++;
    audioUpdate(music, sfx); // the game's own update order
  };
  return { synth, music, sfx, update, run: (n: number) => { for (let i = 0; i < n; i++) update(); } };
}

export const sfxData = (name: string): SfxData => audioJson<SfxData>(`sfx/${name}.json`);
export const musicData = (name: string): MusicData => audioJson<MusicData>(`music/${name}.json`);

/** A one-channel track. */
export function track(id: number, commands: MusicCommand[]): MusicData {
  return { channels: [{ id, commands }] };
}
