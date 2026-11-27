import { describe, expect, it } from 'vitest';
import { rig, sfxData } from '../test/audio_rig';
import { GBSynthesizer } from './synthesizer';
import { registerToHz } from './frequency_table';

// Channel 1's NR10 sweep (Pan Docs "Sound Channel 1 — Pulse with period sweep"): the frame sequencer clocks it
// at 128 Hz; a trigger copies the frequency to the shadow; overflow past 2047 turns the channel off until the
// next trigger. Audio1_pitch_sweep writes rAUD1SWEEP directly (audio/engine_1.asm:638-652), and every note
// sets NR14 bit 7 (Audio1_ApplyWavePatternAndFrequency, engine_1.asm:954-963).

const RATE = 48000;
const CLOCK = RATE / 128; // samples per sweep clock

function triggered(nr10: number, freq: number): GBSynthesizer {
  const synth = new GBSynthesizer();
  synth.writeSweep(nr10);
  synth.writePulse(0, 0x00, 0xf0, freq & 0xff, 0x80 | (freq >> 8));
  return synth;
}

describe('channel 1 frequency sweep', () => {
  it('SFX_Poisoned: pace 1, +shift 4 from 1536 steps four times on the 128 Hz clock, then overflows off', () => {
    const synth = triggered(0x14, 1536);
    synth.runSweep(CLOCK * 3, RATE);
    expect(synth.sweepShadow).toBe(1842); // 1536 → 1632 → 1734 → 1842
    expect(synth.pulse[0].frequency).toBeCloseTo(registerToHz(1842));
    expect(synth.sweepSilenced).toBe(false);
    synth.runSweep(CLOCK, RATE);
    expect(synth.sweepShadow).toBe(1957); // written; the second calculation, 2079, turns the channel off
    expect(synth.sweepSilenced).toBe(true);
    // About 31 ms after the trigger: one 59.7 Hz frame is ~2.1 sweep clocks, not one.
    synth.writePulse(0, 0x00, 0xf0, 0x00, 0x86);
    expect(synth.sweepSilenced).toBe(false);
    expect(synth.sweepShadow).toBe(1536);
  });

  it('a decreasing sweep never overflows, and pace 0 / `pitch_sweep 0, 8` leaves the frequency alone', () => {
    const down = triggered(0x1d, 1536); // pace 1, negate, shift 5
    down.runSweep(CLOCK * 20, RATE);
    expect(down.sweepSilenced).toBe(false);
    expect(down.sweepShadow).toBeLessThan(1536);
    const off = triggered(0x08, 1536);
    off.runSweep(CLOCK * 20, RATE);
    expect(off.sweepShadow).toBe(1536);
    expect(off.pulse[0].frequency).toBeCloseTo(registerToHz(1536));
    expect(off.sweepSilenced).toBe(false);
  });

  it('pace n waits n clocks between steps', () => {
    const synth = triggered(0x31, 1024); // pace 3, +shift 1
    synth.runSweep(CLOCK * 2, RATE);
    expect(synth.sweepShadow).toBe(1024);
    synth.runSweep(CLOCK, RATE);
    expect(synth.sweepShadow).toBe(1536);
  });

  it('the SFX engine writes NR10 from pitch_sweep and re-arms the sweep on each CH5 note', () => {
    const r = rig();
    r.sfx.play(sfxData('poisoned'));
    r.update();
    expect(r.synth.sweepRegister).toBe(0x14);
    expect(r.synth.sweepShadow).toBe(1536);
    r.run(40);
    expect(r.sfx.isPlaying()).toBe(false);
    expect(r.synth.sweepRegister).toBe(0x08); // the closing pitch_sweep 0, 8
  });
});
