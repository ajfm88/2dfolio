import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lowHealthAlarm, setLowHealthAlarm, setLowHealthChannel5 } from '../audio/low_health_alarm';
import { musicData, rig, sfxData } from '../test/audio_rig';
import { BattleAudio } from './battle_audio';
import { TextProgramRunner } from '../text/text_runner';
import { TextScreen } from '../text/text_printer';
import { soundFinished } from '../audio/sound_wait';
import { playPikachuClipCue } from './battle_voice_cues';
import type { SfxData } from '../audio/sfx_engine';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pulse = (length: number, frequencies = [512]): SfxData => ({ channels: [{ id: 5, commands: [
  ...frequencies.map(frequency => ({ cmd: 'square_note', length, frequency, volume: 13, fade: 0 })),
  { cmd: 'sound_ret' },
] }] });

describe('BattleAudio (Audio2_PlaySound)', () => {
  beforeEach(() => { setLowHealthChannel5(0); setLowHealthAlarm(0); });
  it('walks a multi-channel header backwards and keeps the partial InitSFXVariables clear on rejection', () => {
    const r = rig(); const audio = new BattleAudio(r.sfx, r.music);
    setLowHealthChannel5(0x86); // active low-health alarm owns CHAN5
    const cleared = vi.spyOn(r.sfx, 'clearChannelsForPriority');
    const thud = audio.play({ id: 0x95, data: sfxData('faint_thud') });
    // CHAN8 is visited and cleared first; CHAN5 rejects $95 > $86 before common-path IDs install.
    expect(thud).toBe(false);
    expect(cleared).toHaveBeenCalledWith([8]);
    expect(audio.channelId(8)).toBe(0);
    expect(audio.channelId(5)).toBe(0x86);
  });

  it('uses one CHAN5 owner for IDs and clears IDs without a hardware sound_ret', () => {
    const r = rig(); const audio = new BattleAudio(r.sfx, r.music);
    expect(audio.play({ id: 0x95, data: sfxData('faint_thud') })).toBe(true);
    expect(audio.channelId(5)).toBe(0x95); expect(audio.channelId(8)).toBe(0x95);
    r.update();
    audio.clearClipIds();
    expect(audio.channelId(5)).toBe(0); expect(audio.channelId(8)).toBe(0);
    expect(r.sfx.isChannelActive(0)).toBe(false); // IDs stop software updates/suppression
    expect(r.synth.pulse[0].enabled).toBe(true); // but this is not sound_ret/hardware mute
  });

  it('does not classify faint thud as a battle SFX, so its pulse and noise both retain normal timing', () => {
    const r = rig(); const audio = new BattleAudio(r.sfx, r.music);
    audio.play({ id: 0x95, data: sfxData('faint_thud') });
    r.run(9); expect(r.sfx.isChannelActive(0)).toBe(true);
    expect(r.sfx.isChannelActive(3)).toBe(true);
    r.run(8); expect(r.sfx.isChannelActive(0)).toBe(false);
  });

  it('classifies fall from its current Audio2 IDs before applying modifiers', () => {
    const r = rig(); const audio = new BattleAudio(r.sfx, r.music); audio.frequencyModifier = 3; audio.tempoModifier = 9;
    audio.play({ id: 0x9e, data: sfxData('faint_fall') }); r.update();
    expect(r.synth.values('freq0')[0]).toEqual([1, 1923]);
    r.run(8); expect(r.sfx.isChannelActive(0)).toBe(false);
  });

  it('uses the source CHAN8 noise-instrument boundary and equality rule', () => {
    const r = rig(); const audio = new BattleAudio(r.sfx, r.music);
    (audio as unknown as { ids: Map<number, number> }).ids.set(8, 0x14);
    expect(audio.play({ id: 0x95, data: sfxData('faint_thud') })).toBe(true);
    (audio as unknown as { ids: Map<number, number> }).ids.set(8, 0x19);
    expect(audio.play({ id: 0x95, data: sfxData('faint_thud') })).toBe(false);
  });

  it('stops interpreter activity immediately when the shared alarm owner clears CHAN5', () => {
    const r = rig(); const audio = new BattleAudio(r.sfx, r.music);
    audio.play({ id: 0x9e, data: sfxData('faint_fall') }); r.update();
    setLowHealthChannel5(0);
    expect(r.sfx.isChannelActive(0)).toBe(false); r.update();
    expect(r.sfx.isChannelActive(0)).toBe(false);
  });

  it('resolves TextCommandSounds by the active bank', () => {
    const r = rig(); const audio = new BattleAudio(r.sfx, r.music);
    expect(audio.resolveTextSound('get_item1')).toBe('level_up');
    audio.audioBank = 0x02; expect(audio.resolveTextSound('get_item1')).toBe('get_item1');
  });

  it('provides the bank-relative port to the real text-program runner', () => {
    const r = rig(); const audio = new BattleAudio(r.sfx, r.music); const played: string[] = [];
    const ports = { buttons: () => 0, speed: () => 1, soundFinished: () => true, joypadRead: () => {}, beep: () => {},
      playSound: audio.textSoundPort(name => played.push(name)), cry: () => {} };
    const runner = new TextProgramRunner(new TextScreen(ports), { P: [{ op: 'sound', sound: 'get_item1' }] }, ports);
    runner.run('P', {}, true).next(); expect(played).toEqual(['level_up']);
    audio.audioBank = 2; runner.run('P', {}, true).next(); expect(played).toEqual(['level_up', 'get_item1']);
  });

  it('retains the alarm-owned CHAN5 and command pointer when its next-note counter reaches 1', () => {
    const r = rig(); const audio = new BattleAudio(r.sfx, r.music);
    const released = vi.spyOn(r.music, 'releaseChannel');
    audio.play({ id: 0x9e, data: sfxData('faint_fall') }); r.update();
    setLowHealthAlarm(0x9e); r.synth.log = [];
    r.synth.setChannelOutput(0, false);
    r.run(8);
    expect(lowHealthAlarm()).toBe(0x96); expect(audio.channelId(5)).toBe(0x86);
    expect(r.sfx.isChannelActive(0)).toBe(true);
    expect(r.synth.at('silence0')).toEqual([]); expect(released).not.toHaveBeenCalled();
    expect(r.synth.channelOutputEnabled(0)).toBe(true);
    // No command was consumed; turning off the alarm lets the same sound_ret run next frame.
    setLowHealthAlarm(0); r.update();
    expect(r.synth.at('silence0')).toEqual([10]); expect(audio.channelId(5)).toBe(0);
  });

  it('consumes alarm $FF through the real update and immediately frees waits and suppression', () => {
    const r = rig(); const audio = new BattleAudio(r.sfx, r.music);
    audio.play({ id: 0x9e, data: sfxData('faint_fall') }); r.update();
    setLowHealthAlarm(0xff); expect(soundFinished(r.sfx, r.music, 0)).toBe(true);
    r.update(); expect(audio.channelId(5)).toBe(0);
    expect(r.sfx.isChannelActive(0)).toBe(false); expect(soundFinished(r.sfx, r.music, 0)).toBe(true);
  });

  it('clears an occupied real Routes3 drum after the actual clip cue, on its third frame', () => {
    const r = rig(musicData('routes3')); const audio = new BattleAudio(r.sfx, r.music);
    for (let i = 0; !r.music.channel8DrumBusy && i < 1000; i++) r.update();
    expect(r.music.channel8DrumBusy).toBe(true);
    expect(audio.channelId(8)).toBeGreaterThan(0); expect(audio.channelId(8)).toBeLessThan(0x14);
    const events: unknown[] = []; const start = r.synth.update;
    const noiseMute = vi.spyOn(r.synth, 'silenceNoise');
    const clip = playPikachuClipCue({ getAlarm: lowHealthAlarm, setAlarm: value => { events.push(['alarm', value]); },
      cry: () => {}, clip: id => { events.push([r.synth.update - start, 'clip', id]); },
      clearSfxIds: () => {
        expect(r.music.channel8DrumBusy).toBe(true);
        const muteCount = noiseMute.mock.calls.length;
        events.push([r.synth.update - start, 'clear']); audio.clearClipIds();
        expect(noiseMute).toHaveBeenCalledTimes(muteCount);
      } }, 37);
    let step = clip.next();
    while (!step.done) { expect(step.value).toBe('serviced'); r.update(); step = clip.next(); }
    expect(r.synth.update - start).toBe(3); expect(events).toEqual([[3, 'clip', 37], [3, 'clear']]);
    expect(r.music.channel8DrumBusy).toBe(false); expect(audio.channelId(8)).toBe(0);
    expect(soundFinished(r.sfx, r.music, 0)).toBe(true);
  });

  it('replaces a real drum during reverse-header priority clearing even if CHAN5 later rejects', () => {
    const r = rig(musicData('routes3')); const audio = new BattleAudio(r.sfx, r.music);
    for (let i = 0; !r.music.channel8DrumBusy && i < 1000; i++) r.update();
    expect(r.music.channel8DrumBusy).toBe(true);
    setLowHealthChannel5(0x86);
    expect(audio.play({ id: 0x95, data: sfxData('faint_thud') })).toBe(false);
    expect(audio.channelId(8)).toBe(0); expect(r.music.channel8DrumBusy).toBe(false);
    expect(audio.channelId(5)).toBe(0x86);
  });

  it('retains Audio1 through a preceding sound and the real swap, pausing music until both waits finish', () => {
    const r = rig(musicData('routes3')); const audio = new BattleAudio(r.sfx, r.music, r.fade.requests);
    audio.audioBank = audio.savedAudioBank = 8;
    audio.play({ id: 0x90, data: sfxData('press_ab') });
    const swap = audio.playSwap({ id: 0xae, data: sfxData('swap') });
    expect(swap.next()).toEqual({ done: false, value: 'serviced' });
    expect(audio.muteAudioAndPauseMusic).toBe(1); expect(audio.audioBank).toBe(8);
    const pc = r.music.getChannel(1)!.pc;
    r.update(); let step = swap.next();
    expect(audio.muteAudioAndPauseMusic).toBe(0x81);
    expect(r.synth.channelOutputEnabled(0)).toBe(true); // preceding SFX re-enabled its own pulse
    expect(r.synth.channelOutputEnabled(1)).toBe(false);
    expect(audio.audioBank).toBe(2); expect(audio.savedAudioBank).toBe(2);
    for (let frame = 0; !step.done && frame < 100; frame++) {
      expect(audio.audioBank).toBe(2); expect(audio.savedAudioBank).toBe(2);
      expect(r.music.getChannel(1)!.pc).toBe(pc); r.update(); step = swap.next();
    }
    expect(step).toEqual({ done: true, value: true });
    expect(r.synth.update).toBe(30); expect(r.synth.values('freq0').slice(-1)).toEqual([[18, 1856]]);
    expect(r.synth.values('freq1')).toEqual([[18, 0], [21, 1857]]);
    expect(audio.audioBank).toBe(8); expect(audio.savedAudioBank).toBe(8);
    expect(audio.muteAudioAndPauseMusic).toBe(0);
    expect(r.music.getChannel(1)!.pc).toBe(pc); r.update(); expect(r.music.getChannel(1)!.pc).toBeGreaterThan(pc);
  });

  it('pins the cry and battle range boundaries to the local header sizes', () => {
    const headers = readFileSync(resolve(__dirname, '../../../refs/pokeyellow/audio/headers/sfxheaders2.asm'), 'utf8');
    let slot = 1; const offsets = new Map<string, number>();
    for (const line of headers.split(/\r?\n/)) {
      const label = /^(\w+)::/.exec(line); if (label) offsets.set(label[1], slot);
      if (/^\s+channel [5-8],/.test(line)) slot++;
    }
    expect(offsets.get('SFX_Cry00_2')).toBe(0x14);
    expect(offsets.get('SFX_Cry25_2')! + 3).toBe(0x86);
    expect(offsets.get('SFX_Peck')).toBe(0x9d);
    expect(offsets.get('SFX_Trainer_Appeared')! + 1).toBe(0xea);
  });

  it.each([
    [8, 0x9c, 0, false], [8, 0x9d, 0, true], [8, 0xd1, 0, true],
    [8, 0xea, 0, true], [8, 0xeb, 0, false], [2, 0x9e, 0, false],
    [8, 0x90, 0x0d, true], [8, 0x90, 0x6e, false],
    [2, 0x13, 0, false], [2, 0x14, 0, true], [2, 0x85, 0, true], [2, 0x86, 0, false],
  ])('classifies bank%i CHAN5=%i CHAN8=%i at each note', (bank, id5, id8, modified) => {
    const r = rig(); const audio = new BattleAudio(r.sfx, r.music); audio.audioBank = bank;
    audio.frequencyModifier = 3; audio.play({ id: id5, data: pulse(15) });
    // Seed CHAN8 without adding a second pulse; classification must use OR, not two range tests.
    (audio as unknown as { ids: Map<number, number> }).ids.set(8, id8);
    r.update(); expect(r.synth.values('freq0')).toEqual([[1, modified ? 515 : 512]]);
    r.run(8); expect(r.sfx.isChannelActive(0)).toBe(!modified);
  });

  it('retains a fractional zero counter through byte wrap, carrying the fraction into the next note', () => {
    const r = rig(); const audio = new BattleAudio(r.sfx, r.music);
    audio.play({ id: 0x9e, data: pulse(0, [512, 600, 700]) });
    r.update(); expect(r.synth.values('freq0')).toEqual([[1, 512]]);
    r.run(255); expect(r.synth.values('freq0')).toEqual([[1, 512]]); expect(r.sfx.isChannelActive(0)).toBe(true);
    r.update(); expect(r.synth.values('freq0')).toEqual([[1, 512], [257, 600]]);
    r.update(); expect(r.synth.values('freq0')).toEqual([[1, 512], [257, 600], [258, 700]]);
    r.run(255); expect(r.sfx.isChannelActive(0)).toBe(true);
    r.update(); expect(r.sfx.isChannelActive(0)).toBe(false); expect(r.synth.at('silence0')).toEqual([514]);
  });

  it('reads new bank and cry modifiers at the next note rather than caching classification', () => {
    const r = rig(); const audio = new BattleAudio(r.sfx, r.music);
    audio.frequencyModifier = 3; audio.play({ id: 0x9e, data: pulse(3, [512, 600]) });
    r.run(2); audio.audioBank = 2; r.update();
    expect(r.synth.values('freq0')).toEqual([[1, 515], [3, 600]]);
    audio.clearIds(); audio.frequencyModifier = 7; audio.tempoModifier = 0xff;
    audio.play({ id: 0x14, data: pulse(3, [700, 800]) });
    r.update(); expect(r.synth.values('freq0').slice(-1)).toEqual([[4, 707]]);
    // 4*$017f = $05fc: five updates, with carry retained in the fractional byte.
    r.run(5); expect(r.synth.values('freq0').slice(-1)).toEqual([[9, 807]]);
    expect(audio.frequencyModifier).toBe(7); expect(audio.tempoModifier).toBe(0xff);
  });

  it('propagates PlaySound ID clears through the bridge and real drum owner', () => {
    const r = rig(musicData('routes3')); const audio = new BattleAudio(r.sfx, r.music);
    for (let i = 0; !r.music.channel8DrumBusy && i < 1000; i++) r.update();
    audio.play({ id: 0x9e, data: sfxData('faint_fall') });
    r.sfx.clearSoundIds();
    expect([5, 6, 7, 8].map(channel => audio.channelId(channel))).toEqual([0, 0, 0, 0]);
    expect(r.music.channel8DrumBusy).toBe(false); expect(soundFinished(r.sfx, r.music, 0)).toBe(true);
  });

  it('accepts a same-ID request and restarts the real fall from its first command', () => {
    const r = rig(); const audio = new BattleAudio(r.sfx, r.music);
    const fall = { id: 0x9e, data: sfxData('faint_fall') };
    expect(audio.play(fall)).toBe(true); r.run(4);
    expect(audio.play(fall)).toBe(true); r.update();
    expect(r.synth.values('freq0')).toEqual([[1, 1920], [5, 1920]]);
    r.run(7); expect(r.sfx.isChannelActive(0)).toBe(true);
    r.update(); expect(r.synth.at('silence0')).toEqual([13]);
  });

  it('holds only CHAN5 at the alarm next-note branch while CHAN6–8 advance and finish', () => {
    const r = rig(); const audio = new BattleAudio(r.sfx, r.music);
    const data: SfxData = { channels: [5, 6, 7, 8].map(id => ({ id, commands: [
      id === 8 ? { cmd: 'noise_note', length: 3, volume: 13, fade: 0, param: 0x33 } :
        { cmd: 'square_note', length: 3, frequency: 512, volume: 13, fade: 0 },
      { cmd: 'sound_ret' },
    ] })) };
    audio.play({ id: 0x9e, data }); setLowHealthAlarm(0x9e);
    r.run(3);
    expect(audio.channelId(5)).toBe(0x86); expect(r.sfx.isChannelActive(0)).toBe(true);
    expect(audio.channelId(6)).toBe(0); expect(audio.channelId(7)).toBe(0);
    expect(r.synth.values('freq1')).toEqual([[1, 512]]);
    expect(r.synth.at('noise')).toEqual([1]); expect(audio.channelId(8)).toBe(0x9e);
    r.run(2); expect(audio.channelId(8)).toBe(0); expect(r.sfx.isChannelActive(0)).toBe(true);
  });

  it('re-enables each music output at its first new note after the real swap mute', () => {
    const r = rig(musicData('routes3')); const audio = new BattleAudio(r.sfx, r.music);
    const swap = audio.playSwap({ id: 0xae, data: sfxData('swap') });
    let step = swap.next();
    for (let i = 0; !step.done && i < 100; i++) { r.update(); step = swap.next(); }
    expect(step.done).toBe(true); expect(audio.muteAudioAndPauseMusic).toBe(0);
    // Swap re-enabled its two pulses; the muted wave/noise must return with their music notes.
    expect([0, 1, 2, 3].map(hw => r.synth.channelOutputEnabled(hw))).toEqual([true, true, false, false]);
    r.update();
    for (let hw = 0; hw < 4; hw++) expect(r.synth.channelOutputEnabled(hw)).toBe(true);
    expect(r.music.getChannel(1)!.pc).toBeGreaterThan(0);
  });
});
