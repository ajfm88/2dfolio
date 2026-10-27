import { beforeEach, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} } }));
vi.mock('../input', () => ({ isHeld: () => false, isPassPressed: () => false, syncJoypadRead() {} }));
vi.mock('../audio', () => ({ playSFX() {}, isSoundFinished: () => true }));
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { rig, sfxData, musicData } from '../test/audio_rig';
import { soundFinished } from '../audio/sound_wait';
import { setLowHealthAlarm, setLowHealthChannel5 } from '../audio/low_health_alarm';
import { BattleAudio } from './battle_audio';
import { BattleHost } from './battle_host';
import { BattleState } from './battle_state';
import type { BattleItemHost } from './battle_items';
import { BATTLE_FLUTE_AUDIO, playBattleFlute } from './battle_flute_audio';

beforeEach(() => { vi.restoreAllMocks(); setLowHealthAlarm(0); setLowHealthChannel5(0); });

function setup(battleMusic = false) {
  const r = rig(battleMusic ? musicData('wildbattle') : undefined);
  const audio = new BattleAudio(r.sfx, r.music);
  const driver = new BattleHost(new BattleState());
  const host: BattleItemHost = {
    tiles: driver.video.tiles, audio, sounds: new Map([[0x9a, { id: 0x9a, data: sfxData('caught_mon') }]]),
    printText: function* () {}, readScrollJoypad: () => 0,
    waitForSound: function* () { while (!soundFinished(r.sfx, r.music, 0)) yield 'serviced'; },
  };
  return { r, audio, host };
}

it('restricts the pending-stream method name to its engine, adapter and this test', () => {
  const src = resolve(__dirname, '..');
  const found: string[] = [];
  function walk(dir: string): void {
    for (const file of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, file.name);
      if (file.isDirectory()) walk(path);
      else if (readFileSync(path).includes(Buffer.from('replacePendingMusicSfxStream'))) found.push(relative(src, path).replace(/\\/g, '/'));
    }
  }
  walk(src);
  expect(found.sort()).toEqual(['audio/sfx_engine.ts', 'battle/battle_flute_audio.test.ts', 'battle/battle_flute_audio.ts']);
});

it('pins the adapter constants to the independently pinned bootstrap operands', () => {
  expect(BATTLE_FLUTE_AUDIO).toEqual({ bank: 8, caughtMon: 0x9a, commandPointers: 0xc00e,
    streams: [{ id: 5, address: 0x59eb }, { id: 6, address: 0x59ee }, { id: 7, address: 0x444b }] });
});

it.skipIf(!process.env.ROM_PATH)('compares the adapter directly with battle_item_data bootstrap routine bytes', () => {
  const rom = readFileSync(resolve(process.env.ROM_PATH!));
  const at = BATTLE_FLUTE_AUDIO.bank * 0x4000 + (0x59cf & 0x3fff);
  const bytes = rom.subarray(at, at + 28);
  const word = (index: number) => bytes[index] | bytes[index + 1] << 8;
  expect(bytes[1]).toBe(BATTLE_FLUTE_AUDIO.caughtMon);
  expect(word(6)).toBe(BATTLE_FLUTE_AUDIO.commandPointers);
  expect([word(9), word(15), word(21)]).toEqual(BATTLE_FLUTE_AUDIO.streams.map(stream => stream.address));
});

it.each(['absent', 'raw', 'consumed', 'finished'] as const)('rejects a %s channel rather than replacing a non-pending stream', kind => {
  const { r, audio } = setup();
  if (kind === 'raw') audio.play({ id: 0x8d, data: sfxData('heal_hp') });
  if (kind === 'consumed' || kind === 'finished') {
    audio.play({ id: 0x9a, data: sfxData('caught_mon') }); r.run(kind === 'finished' ? 145 : 1);
  }
  expect(() => r.sfx.replacePendingMusicSfxStream(5, sfxData('pokeflute_in_battle').channels[0].commands))
    .toThrow('expected pending music SFX');
});

it('replaces all three pending pointers before an update, retaining exact arrays, IDs and priority', () => {
  const { r, audio, host } = setup();
  const streams = sfxData('pokeflute_in_battle'), before = JSON.stringify(streams);
  streams.channels.forEach(channel => { channel.commands.forEach(Object.freeze); Object.freeze(channel.commands); });
  const replace = vi.spyOn(r.sfx, 'replacePendingMusicSfxStream');
  const play = vi.spyOn(audio, 'play');
  expect(playBattleFlute(host, r.sfx, streams).next().done).toBe(true);
  expect(r.synth.update).toBe(0); expect(play).toHaveBeenCalledExactlyOnceWith(host.sounds.get(0x9a));
  expect(replace.mock.calls.map(([id]) => id)).toEqual([5, 6, 7]);
  replace.mock.calls.forEach(([, commands], index) => expect(commands).toBe(streams.channels[index].commands));
  expect(JSON.stringify(streams)).toBe(before);
  expect([5, 6, 7].map(id => audio.channelId(id))).toEqual([0x9a, 0x9a, 0x9a]);
  // Incoming $9B would be accepted if replacement had discarded caught_mon priority.
  expect(audio.play({ id: 0x9b, data: host.sounds.get(0x9a)!.data })).toBe(false);
  expect([5, 6, 7].map(id => audio.channelId(id))).toEqual([0x9a, 0x9a, 0x9a]);
});

it('pre-waits for a current sound, then returns immediately without playing the caught jingle', () => {
  const { r, audio, host } = setup();
  audio.play({ id: 0x8d, data: sfxData('heal_hp') });
  const program = playBattleFlute(host, r.sfx, sfxData('pokeflute_in_battle'));
  let step = program.next();
  while (!step.done && r.synth.update < 40) { r.update(); step = program.next(); }
  expect(step.done).toBe(true); expect(r.synth.update).toBe(33);
  expect([5, 6, 7].map(id => audio.channelId(id))).toEqual([0x9a, 0x9a, 0x9a]);
  r.update(); expect(r.synth.at('wave')).toEqual([34]);
});

it('runs the exact flute: all channels return on257, six wave notes and no underlying music writes', () => {
  const { r, audio, host } = setup(true);
  r.run(19); const start = r.synth.update; r.synth.log = [];
  const done: number[][] = [], prior = r.sfx.onSfxChannelDone;
  r.sfx.onSfxChannelDone = id => { done.push([id, r.synth.update - start]); prior?.(id); };
  expect(playBattleFlute(host, r.sfx, sfxData('pokeflute_in_battle')).next().done).toBe(true);
  const noteRegisters: number[][] = [];
  for (let update = 1; update <= 257; update++) {
    const oldWaves = r.synth.at('wave').length;
    r.update();
    for (const id of [1, 2, 3]) expect(r.music.getChannel(id)!.suppressed).toBe(true);
    if (r.synth.at('wave').length !== oldWaves) noteRegisters.push([update, r.synth.values('freq2').slice(-1)[0][1]]);
    expect(audio.channelId(7)).toBe(update < 257 ? 0x9a : 0);
  }
  expect(done).toEqual([[5, 257], [6, 257], [7, 257]]);
  expect(r.synth.at('wave').map(u => u - start)).toEqual([1, 25, 49, 105, 129, 153]);
  // audio/notes.asm: signed $F9CA/$FA23/$FAC7/$FB58 >>4, $F82C >>5, then +$800.
  expect(noteRegisters).toEqual([[1, 0x79c], [25, 0x7a2], [49, 0x7ac], [105, 0x7b5], [129, 0x7ac], [153, 0x7c1]]);
  expect(r.synth.at('freq0')).toEqual([]); expect(r.synth.at('freq1')).toEqual([]);
});

it('keeps battle music tempo, note counters and resumed note timing identical to a flute-free run', () => {
  // Run separately: the shared CHAN5 owner is intentionally global, as in production.
  function run(flute: boolean) {
    setLowHealthChannel5(0);
    const { r, host } = setup(true); r.run(19);
    if (flute) expect(playBattleFlute(host, r.sfx, sfxData('pokeflute_in_battle')).next().done).toBe(true);
    const timeline: unknown[] = [], notes: unknown[] = [];
    for (let frame = 1; frame <= 600; frame++) {
      const next = [1, 2, 3].map(id => r.music.getChannel(id)!.noteDelayCounter === 1);
      r.update();
      timeline.push([r.music.musicTempo, [1, 2, 3].map(id => {
        const ch = r.music.getChannel(id)!;
        return [ch.pc, ch.noteDelayCounter, ch.noteDelayFractional];
      })]);
      // Suppression deliberately pauses vibrato effects. Compare note starts, whose
      // timing and frequency must match, rather than intervening vibrato writes.
      if (frame > 257) for (const id of [1, 2, 3]) if (next[id - 1]) {
        notes.push([r.synth.update, id, r.synth.log.filter(w => w.u === r.synth.update && w.m === `freq${id - 1}`)]);
      }
    }
    return { timeline, tempo: r.music.musicTempo, notes };
  }
  const plain = run(false), flute = run(true);
  expect(flute.tempo).toBe(104); expect(flute.timeline).toEqual(plain.timeline);
  expect(flute.notes.length).toBeGreaterThan(10); expect(flute.notes).toEqual(plain.notes);
});
