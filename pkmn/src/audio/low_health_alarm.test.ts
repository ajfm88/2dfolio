import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GBSynthesizer } from './synthesizer';
import { registerToHz } from './frequency_table';
import { audioUpdate, soundFinished, updateMusic6Times } from './sound_wait';
import { rig, sfxData, track } from '../test/audio_rig';
import {
  CRY_SFX_END, applyHudAlarm, bindAlarmSynth, doLowHealthAlarm, endLowHealthAlarm,
  faintedPlayerLowHealthAlarm, isLowHealthAlarmDisabled, lowHealthAlarm, lowHealthChannel5,
  resetLowHealthAlarm, setLowHealthAlarm, setLowHealthAlarmDisabled, setLowHealthChannel5,
} from './low_health_alarm';

afterEach(() => {
  setLowHealthAlarm(0);
  setLowHealthChannel5(0);
  setLowHealthAlarmDisabled(false);
  vi.restoreAllMocks();
  delete (globalThis as { window?: unknown }).window;
});

function rows(file: string): { before: number; tone: string; registers: string; after: number; channel5: string; suppressed: string }[] {
  const text = readFileSync(resolve(__dirname, `../../../notes/66-a5c1-cp1/${file}.csv`), 'utf8');
  return text.trim().split(/\r?\n/).slice(1).map(line => {
    const [, before, tone, registers, after, channel5, suppressed] = line.split(',');
    return { before: Number.parseInt(before, 16), tone, registers, after: Number.parseInt(after, 16), channel5, suppressed };
  });
}

describe('Music_DoLowHealthAlarm', () => {
  const traces = ['alarm_clean', 'alarm_retained_timer', 'alarm_existing_sfx', 'alarm_disable', 'alarm_disabled'] as const;

  for (const file of traces) {
    it(`${file} matches the trace update by update`, () => {
      setLowHealthChannel5(file === 'alarm_existing_sfx' ? 0x42 : 0);
      for (const row of rows(file)) {
        setLowHealthAlarm(row.before);
        const step = doLowHealthAlarm();
        const channel5 = row.channel5 === '0' ? 0 : row.channel5 === 'CRY_SFX_END' ? CRY_SFX_END : 0x42;
        expect(step.tone, `${file} ${row.before.toString(16)} tone`).toBe(row.tone);
        expect(step.registers).toBe(row.registers);
        expect(step.after).toBe(row.after);
        expect(step.channel5).toBe(channel5);
        expect(step.channel5 !== 0).toBe(row.suppressed === 'True');
      }
    });
  }

  it('steps the $E2 envelope on the 64 Hz sample clock and restarts it on a trigger', () => {
    const synth = new GBSynthesizer();
    bindAlarmSynth(synth);
    setLowHealthAlarm(0x80);
    const high = doLowHealthAlarm();
    expect(high.registers).toBe('00 a0 e2 50 87');
    expect(synth.pulse[0].volume).toBe(14);
    expect(synth.pulse[0].duty).toBe(2);
    expect(synth.pulse[0].frequency).toBeCloseTo(registerToHz(0x750), 6);
    synth.runPulse(0, 1, 64);
    expect(synth.pulse[0].volume).toBe(14);
    synth.runPulse(0, 1, 64);
    expect(synth.pulse[0].volume).toBe(13);
    synth.writePulse(0, 0xa0, 0xe2, 0x50, 0x87);
    expect(synth.pulse[0].volume).toBe(14);
    setLowHealthAlarm(0xff);
    expect(doLowHealthAlarm().registers).toBe('00 00 00 00 80');
    expect(synth.pulse[0].enabled).toBe(false);
    expect(synth.pulse[0].volume).toBe(0);
  });

  it('zeroing the byte leaves CHAN5 and the tone alone', () => {
    const synth = new GBSynthesizer();
    bindAlarmSynth(synth);
    setLowHealthAlarm(0x80);
    doLowHealthAlarm();
    doLowHealthAlarm();
    expect(lowHealthChannel5()).toBe(CRY_SFX_END);
    const volume = synth.pulse[0].volume;
    setLowHealthAlarm(0);
    const step = doLowHealthAlarm();
    expect(step.tone).toBe('none');
    expect(step.registers).toBe('');
    expect(step.channel5).toBe(CRY_SFX_END);
    expect(synth.pulse[0].volume).toBe(volume);
  });

  it('lets music overwrite the first high tone, then suppresses pulse 1', () => {
    const note = track(1, [
      { cmd: 'note_type', speed: 12, volume: 10, fade: 0 },
      { cmd: 'octave', value: 4 },
      { cmd: 'note', pitch: 0, length: 8 },
      { cmd: 'sound_ret' },
    ]);
    const open = rig(note);
    setLowHealthAlarm(0x80);
    setLowHealthChannel5(0);
    open.update();
    expect(lowHealthAlarm()).toBe(0x9e);
    expect(lowHealthChannel5()).toBe(0);
    expect(open.synth.values('freq0')).toEqual([[1, 0x0705]]);
    expect(open.synth.pulse[0].frequency).toBeCloseTo(registerToHz(0x0705), 6);

    const held = rig(note);
    setLowHealthAlarm(0x80);
    setLowHealthChannel5(CRY_SFX_END);
    held.update();
    expect(lowHealthChannel5()).toBe(CRY_SFX_END);
    expect(held.synth.values('freq0')).toEqual([]);
    expect(held.synth.pulse[0].frequency).toBeCloseTo(registerToHz(0x750), 6);
  });

  it('keeps a real SFX running beside the alarm', () => {
    const r = rig();
    r.sfx.play(sfxData('get_item1'));
    setLowHealthAlarm(0x80);
    r.update();
    expect(r.sfx.isChannelActive(1)).toBe(true);
    expect(r.synth.values('freq1').length).toBeGreaterThan(0);
    r.run(4);
    expect(r.sfx.isChannelActive(1)).toBe(true);
  });

  it('returns from soundFinished at once while bit 7 is set, including $FF', () => {
    const r = rig();
    r.sfx.play(sfxData('get_item1'));
    r.update();
    expect(soundFinished(r.sfx, r.music, 0)).toBe(false);
    setLowHealthAlarm(0x80);
    expect(soundFinished(r.sfx, r.music, 1)).toBe(true);
    setLowHealthAlarm(0xff);
    expect(soundFinished(r.sfx, r.music, 0)).toBe(true);
    setLowHealthAlarm(0);
    expect(soundFinished(r.sfx, r.music, 0)).toBe(false);
  });

  it('does not run inside updateMusic6Times', () => {
    const r = rig();
    setLowHealthAlarm(0x80);
    updateMusic6Times(r.music, r.sfx);
    expect(lowHealthAlarm()).toBe(0x80);
    expect(lowHealthChannel5()).toBe(0);
    audioUpdate(r.music, r.sfx, r.fade);
    expect(lowHealthAlarm()).toBe(0x9e);
  });

  it('playBattleMusic zeroes the byte at E, before the yield', async () => {
    vi.stubGlobal('window', {});
    vi.spyOn(GBSynthesizer.prototype, 'resume').mockResolvedValue();
    const api = await import('./index');
    api.initAudio();
    setLowHealthAlarm(0x9e);
    setLowHealthChannel5(CRY_SFX_END);
    const program = api.playBattleMusic({ gymLeaderNo: 0, curOpponent: 25 });
    expect(program.next().done).toBe(false);
    expect(lowHealthAlarm()).toBe(0);
  });

  it('exposes the A5c3 facade and leaves bit 7 unset outside it', () => {
    setLowHealthChannel5(CRY_SFX_END);
    applyHudAlarm(0x85, true);
    expect(lowHealthAlarm()).toBe(0x85);
    expect(lowHealthChannel5()).toBe(0);
    setLowHealthChannel5(CRY_SFX_END);
    expect(faintedPlayerLowHealthAlarm()).toBe(true);
    expect(lowHealthAlarm()).toBe(0xff);
    expect(faintedPlayerLowHealthAlarm()).toBe(true);
    doLowHealthAlarm();
    expect(lowHealthAlarm()).toBe(0);
    expect(faintedPlayerLowHealthAlarm()).toBe(false);
    setLowHealthAlarm(0x9e);
    setLowHealthChannel5(CRY_SFX_END);
    resetLowHealthAlarm();
    expect(lowHealthAlarm()).toBe(0);
    expect(lowHealthChannel5()).toBe(0);
    expect(isLowHealthAlarmDisabled()).toBe(false);
    endLowHealthAlarm();
    expect(isLowHealthAlarmDisabled()).toBe(true);
    expect(lowHealthAlarm()).toBe(0);
    expect(lowHealthChannel5()).toBe(0);

    const root = resolve(__dirname, '..');
    const files = walk(root).filter(path => !path.endsWith(`${sep}low_health_alarm.ts`));
    const callers = files.filter(path => readFileSync(path, 'utf8').includes('setLowHealthAlarm('));
    expect(callers.map(path => path.slice(root.length + 1))).toEqual([`audio${sep}index.ts`]);
    const index = readFileSync(resolve(root, 'audio/index.ts'), 'utf8');
    expect(index).toContain('setLowHealthAlarm(0)');
    expect(index).not.toMatch(/setLowHealthAlarm\((?!0\))/);
  });
});

const sep = process.platform === 'win32' ? '\\' : '/';

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}
