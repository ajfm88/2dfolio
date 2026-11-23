import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { IntroEntryAudio } from '../audio/intro_entry_audio';
import { rig, musicData, sfxData } from '../test/audio_rig';
import { IntroCpu } from './intro_cpu';
import { IntroDisplayClock, INTRO_OAM_BYTES } from './intro_display_clock';
import { IntroForegroundRunner, IntroSharedState, introQuietSharedFields } from './intro_foreground_runner';
import { introDelayFrameSteps, introPlayMusicSteps } from './intro_helper_timing';
import { introMovieEntrySteps } from './intro_movie_timing';

interface EntryCase {
  entry: {
    state: Record<string, string>; oam: string; interval: [number, number, number, number];
    clock: { enable: number; ie: number; ime: number; imePending: number };
    registers: Record<string, number>; servicedBefore: number;
  };
  setupDelayFrames: [number, number][];
  playMusic: number;
  firstLoop: number;
  release: number | null;
}
function fixture<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(__dirname, path), 'utf8'));
}
const histories = fixture<Record<string, EntryCase>>('__fixtures__/intro_entry_reference.json');
const { commandBytes } = fixture<{ commandBytes: number[] }>('../audio/__fixtures__/intro_setup_audio_reference.json');
const offsets = commandBytes.reduce((all, size) => [...all, all[all.length - 1] + size], [0]);
const star = sfxData('shooting_star');
const song = musicData('yellowintro');
// Music_YellowIntro header in pret b452f2ab (software channels 1–3).
const musicHeader = {
  'music-header': 0x80, 'channel-pointer.1.lo': 0x5c, 'channel-pointer.1.hi': 0x76,
  'channel-pointer.2.lo': 0xd3, 'channel-pointer.2.hi': 0x76, 'channel-pointer.3.lo': 0x49, 'channel-pointer.3.hi': 0x77,
};

function byte(hex: string, offset = 0): number {
  return Number.parseInt(hex.slice(offset * 2, offset * 2 + 2), 16);
}

function clock(advance: number, lcdc = 0xe3): IntroDisplayClock {
  const display = new IntroDisplayClock({
    scx: 0, wy: 144, wx: 7, lcdc, oam: new Uint8Array(INTRO_OAM_BYTES), mode0Enabled: false, pending: 0,
  });
  display.advance(advance);
  return display;
}

function seed(row: EntryCase, extras: Record<string, number> = {}) {
  const { music, sfx } = rig();
  const capture = row.entry.state;
  const fields = Object.fromEntries(Object.entries(capture).filter(([, data]) => data.length === 2)
    .map(([name, data]) => [name, byte(data)]));
  const sound = byte(capture.wChannelSoundIDs, 4);
  if (sound === 0xc2) {
    const pointer = byte(capture.wChannelCommandPointers, 8) | byte(capture.wChannelCommandPointers, 9) << 8;
    const target = byte(capture.wChannelNoteDelayCounters, 4);
    sfx.installSfx(star);
    for (let update = 0; update <= 77; update++) {
      const channel = sfx.observeChannel(5);
      if (channel?.active && 0x46c8 + offsets[channel.pc] === pointer && channel.noteDelayCounter === target) break;
      sfx.tick();
    }
    const channel = sfx.observeChannel(5);
    expect(channel?.active).toBe(true);
    expect([0x46c8 + offsets[channel!.pc], channel!.noteDelayCounter]).toEqual([pointer, target]);
  }
  const state = new IntroSharedState({ ...introQuietSharedFields(), ...fields, ...musicHeader, wSoundID: 0, ...extras });
  const owner = new IntroEntryAudio(music, sfx, song, fields.wAudioROMBank, fields.wLowHealthAlarm);
  return { owner, music, sfx, sound, state };
}

it.each(Object.entries(histories))('carries the native transfer order across real VBlank services for %s', (_, row) => {
  const state = new IntroSharedState({
    ...introQuietSharedFields(), hAutoBGTransferEnabled: 1,
    hAutoBGTransferPortion: byte(row.entry.state.hAutoBGTransferPortion),
  });
  const portions: number[] = [];
  let version = 0;
  const runner = new IntroForegroundRunner({
    cpu: new IntroCpu(clock(65620), { ie: 1, ime: true }), state,
    audio: { get version() { return version; }, forecast: () => 165, update() { version++; } },
  }, function* () {
    for (let frame = 0; frame < 3; frame++) {
      portions.push(state.read('hAutoBGTransferPortion'));
      yield* introDelayFrameSteps();
    }
  });
  runner.runToEnd();
  const expected = row.setupDelayFrames.map(([, portion]) => portion);
  expect(portions).toEqual(expected);
  const starts = runner.events.flatMap(event => event.kind === 'insn' && event.routine === 'AutoBgMapTransfer' ? [event.start] : []);
  const stores = runner.events.flatMap(event => event.kind === 'effect' && event.field === 'hAutoBGTransferPortion' ? [[event.dot, event.value]] : []);
  expect(stores.map(([, value]) => value)).toEqual(expected.map(portion => (portion + 1) % 3));
  expect(stores.map(([dot], i) => dot! - starts[i])).toEqual(expected.map(portion => [152, 172, 176][portion]));
});

it.each(Object.entries(histories))('publishes native PlayMusic stores to the audio owner for %s', (name, row) => {
  const { owner, music, sfx, sound, state } = seed(row);
  // Observe the isolated subroutine at the measured entry dot. Full clock and IRQ replay belongs to 2c3b1b-ii.
  const display = clock(row.playMusic, 0x63);
  const writes: unknown[] = [];
  const runner = new IntroForegroundRunner({
    cpu: new IntroCpu(display, { ie: 0, ime: false }), state,
    audio: {
      get version() { return owner.version; },
      forecast: predictor => owner.forecast(predictor),
      update: () => owner.update(),
      publish(kind, field, value, dot) {
        owner.publish(kind, field, value);
        writes.push([field, dot - row.playMusic, dot === display.elapsed, owner.selectPredictor(),
          sfx.observeChannel(5)?.active ?? false, [1, 2, 3].filter(id => music.getChannel(id)?.active)]);
      },
    },
  }, introPlayMusicSteps);
  const starHistory = name === 'star-A-held' || name === 'star-A-release';
  expect(sound).toBe(starHistory ? 0xc2 : 0);
  if (name === 'setup-A-420') expect(state.read('hJoyLast')).toBe(1);
  expect(owner.forecast('setup')).toBe(starHistory ? 296 : 165);
  runner.runToEnd();
  expect(runner.events[0]).toMatchObject({ kind: 'insn', start: row.playMusic, routine: 'PlayMusic' });
  // Foreground-only write offsets from both note 138 PlayMusic transcripts.
  expect(writes).toEqual([
    ['wChannelSoundIDs.5', 188, true, 'setup', false, []],
    ['wChannelSoundIDs.6', 204, true, 'setup', false, []],
    ['wChannelSoundIDs.7', 220, true, 'setup', false, []],
    ['wChannelSoundIDs.8', 236, true, 'setup', false, []],
    ['wChannelSoundIDs.1', 5268, true, 'movie', false, [1]],
    ['wChannelSoundIDs.2', 5604, true, 'movie', false, [1, 2]],
    ['wChannelSoundIDs.3', 5940, true, 'movie', false, [1, 2, 3]],
  ]);
  expect(runner.elapsed - row.playMusic).toBe(6284);
  expect(owner.version).toBe(7);
  // Native first Audio1_UpdateMusic after PlayMusic, note 127's intro_music_timing_oracle.json row 0.
  expect(owner.forecast('movie')).toBe(6627);
});

it('uses the audio owner to select VBlank predictors across PlayMusic', () => {
  const { owner, state } = seed(histories.normal);
  const runner = new IntroForegroundRunner({
    cpu: new IntroCpu(clock(65660), { ie: 1, ime: true }), state, audio: owner,
  }, function* () {
    yield* introPlayMusicSteps();
    yield* introDelayFrameSteps();
  });
  runner.runToEnd();
  const audio = runner.events.filter(event => event.kind === 'audio');
  expect(audio.map(event => event.predictor)).toEqual(['setup', 'movie']);
  expect(audio[0].cycles).toBe(165);
  expect(audio[1].cycles).toBe(6627);
  expect(owner.version).toBe(9);
});

it('writes the wrapped object count at +8 before taking a pending IRQ at +12', () => {
  const field = 'wNumLoadedAnimatedObjects';
  const state = new IntroSharedState({ ...introQuietSharedFields(), [field]: 0xff });
  let reply: unknown;
  const runner = new IntroForegroundRunner({
    cpu: new IntroCpu(clock(65656), { ie: 1, ime: true }), state,
    audio: { version: 0, forecast: () => 165, update() {} },
  }, function* () {
    reply = yield { cycles: 3, op: 'inc [hl]', read: { field, trailingDots: 8 },
      store: { field, trailingDots: 4, value: 'increment-read' } };
  });
  runner.runToEnd();
  expect(runner.events.slice(0, 4)).toEqual([
    { kind: 'read', owner: 'foreground', dot: 65660, field, value: 0xff },
    { kind: 'store', owner: 'foreground', dot: 65664, field, value: 0 },
    { kind: 'insn', owner: 'foreground', start: 65656, end: 65668, cycles: 3, op: 'inc [hl]' },
    { kind: 'interrupt', vector: 'vblank', start: 65668, end: 65688, pendingBefore: 1, pendingAfter: 0 },
  ]);
  expect(state.read(field)).toBe(0);
  expect(reply).toBe(0xff);
});

it.each(Object.entries(histories))('replays entry through the first loop for %s', (name, row) => {
  const { entry } = row;
  const entryDot = entry.interval[0];
  const { registers, clock: initial } = entry;
  // Palette payload and register defaults do not affect the timing branches in this entry replay.
  const palette = Object.fromEntries([0, 1, 2, 3].flatMap(i => [[`wCGBPal.${i}.lo`, 0], [`wCGBPal.${i}.hi`, 0]]));
  const { owner, state } = seed(row, {
    ...palette,
    wOnSGB: 1, rBGP: 0xe4, rOBP0: 0xe7, rOBP1: 0xa4,
    'attr-length': 0x3f, 'attr-pointer.lo': 0xb0, 'attr-pointer.hi': 0x6b, 'attr-offset.lo': 0x0d, 'attr-offset.hi': 0,
    'pal-id.0': 0x10, 'pal-id.1': 0, 'pal-id.2': 0, 'pal-id.3': 0,
    'predef-bank': 0x1c, 'predef-pointer': 0, 'pal-function': 0, packet: 0,
    'packet-count': 0, 'packet-pointer': 0, wCGBPal: 0,
    wPredefID: 0, wPredefBank: 0, wPredefHL: 0, 'wPredefHL.lo': 0, wPredefDE: 0, 'wPredefDE.lo': 0,
    wPredefBC: 0, 'wPredefBC.lo': 0,
  });
  state.shadowOam.set(Buffer.from(entry.state.wShadowOAM, 'hex'));
  const display = new IntroDisplayClock({
    lcdc: registers.LCDC, scx: registers.SCX, wy: registers.WY, wx: registers.WX,
    oam: Buffer.from(entry.oam, 'hex'), mode0Enabled: !!(registers.STAT & 8), pending: 0,
  });
  display.advance(entryDot - initial.enable);
  display.writePending(registers.IF & 3);
  expect([display.readLy(), display.readMode(), initial.imePending]).toEqual([registers.LY, registers.STAT & 3, 0]);
  const release = row.release ?? Infinity;
  const held = byte(entry.state.hJoyInput);
  let serviced = entry.servicedBefore;
  let savedIe: number | undefined;
  const runner = new IntroForegroundRunner({
    cpu: new IntroCpu(display, { ie: initial.ie, ime: !!initial.ime }), state, audio: owner,
    joypad: () => ++serviced < release ? held : 0,
  }, function* (sources) {
    savedIe = yield* introMovieEntrySteps({ copies: [
      { tiles: 255, source: 0x6b5a, dest: 0x8000, bank: 0x3e },
      { tiles: 128, source: 0x635a, dest: 0x9000, bank: 0x3e },
    ] }, sources);
  });
  runner.runToEnd();
  const irqs = runner.events.filter(event => event.kind === 'interrupt');
  const vblank = irqs.filter(event => event.vector === 'vblank').length;
  const lcdc = irqs.filter(event => event.vector === 'stat').length;
  const music = runner.events.find(event => event.kind === 'insn' && event.routine === 'PlayMusic');
  expect(runner.events[0]).toMatchObject({ kind: 'read', field: 'rIE', dot: entryDot - initial.enable + 8, value: initial.ie });
  expect(savedIe).toBe(initial.ie);
  expect(runner.elapsed + initial.enable).toBe(row.firstLoop);
  expect([vblank, lcdc, irqs.length - vblank - lcdc]).toEqual(entry.interval.slice(1));
  expect(music).toMatchObject({ start: row.playMusic - initial.enable });
  expect(runner.events.find(event => event.kind === 'audio' && event.predictor === 'movie')).toMatchObject({ cycles: 6627 });
  expect(state.read('hJoyInput')).toBe(name === 'star-A-held' ? 1 : 0);
});
