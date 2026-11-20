// Opening checkpoints 05 and 06 (notes 114, 115): the title through main's real tick, boot and click, on the REAL
// audio facade and engines: the LCD-off and held frames, the two Audio 3 sounds, clip 1's frozen span and the music;
// the exits, B from the main menu, the idle reset and Init; the clear-save dialogue (checkpoint 07b, note 117); the
// boot path from `jp Init` to PrepareTitleScreen (checkpoint 08a, note 118), with the copyright screen (08b, note 119)
// and the Game Freak logo and shooting star (09, note 120).
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { host, loadMainBattleRig, resetMainBattleRig, documentCalls, tick } from './test/main_battle_rig';
import * as audio from './audio';
import * as input from './input';
import { readFileSync } from 'node:fs';
import { isCpuFrozen } from './core/cpu_freeze';
import type { TitleScreen } from './menus/title_screen';
import { textBgTransfer } from './text/bg_transfer';
import { getFastTextDelay } from './text/text_flags';
import type { ClearSaveDialogue } from './menus/clear_save_dialogue';
import type { Boot } from './menus/boot';

const main = host as typeof host & { titleScreen: TitleScreen; clearSaveDialogue: ClearSaveDialogue; boot: Boot };
/** Ticks from `jp Init` to the tick whose step runs PrepareTitleScreen (notes 118, 119 and 120 §2.2), holding
 *  `pressed` from tick `from` on. */
function bootToTitle(pressed: ('a' | 'start')[] = [], from = Infinity): number {
  let ticks = 0;
  while (host.state === 'boot' && ticks < 700) { tick(ticks + 1 >= from ? pressed : []); ticks++; }
  return ticks;
}

beforeAll(async () => {
  await loadMainBattleRig();
  // The setup mock serves data/ only; the title's three tilemaps live in static/ (as main_battle_boot.test.ts).
  const fetchData = globalThis.fetch;
  const fetching = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const name = String(url);
    if (!name.endsWith('.tilemap')) return fetchData(url, init);
    const bytes = readFileSync('static/' + name.replace(/^\//, ''));
    return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) } as Response;
  });
  await host.init();
  fetching.mockRestore();
});
beforeEach(async () => {
  resetMainBattleRig(); audio.stopMusic();
  await documentCalls.click!();
  expect(bootToTitle()).toBe(593);
});
afterEach(() => { host.reset(); vi.restoreAllMocks(); });

const engines = () => audio.getBattleAudioEngines();
/** Ticks until the title's own frame counter (updates, not frozen ticks) reaches `frame`. */
function toFrame(frame: number, pressed: () => ('a' | 'start')[] = () => []): void {
  for (let guard = 0; main.titleScreen.inspection.frame < frame; guard++) {
    if (guard > 400) throw new Error('title frame bound');
    tick(pressed());
  }
}

it('the click starts the build with Audio 3 selected and no music; init loaded clips 1 and 11', () => {
  expect(host.state).toBe('title_screen');
  expect(main.titleScreen.inspection.stage).toBe('build');
  expect([engines().banks.audioBank, engines().banks.savedAudioBank]).toEqual([0x1f, 0x1f]);
  expect(engines().music.isPlaying()).toBe(false);
  expect(() => audio.startPikachuClip(11)).not.toThrow();
});

it('the LCD-off frames run no Random, joypad read or audio update; the held frames no Random or joypad read', () => {
  const random = vi.spyOn(host.random, 'random');
  const update = vi.spyOn(audio, 'tickAudio');
  const hold = vi.spyOn(audio, 'holdAudioClock');
  const read = vi.spyOn(input, 'syncJoypadRead');
  const rows: number[][] = [];
  for (let n = 1; n <= 20; n++) {
    const before = [random.mock.calls.length, update.mock.calls.length, hold.mock.calls.length, read.mock.calls.length, host.pageTicks];
    tick();
    rows.push([random.mock.calls.length, update.mock.calls.length, hold.mock.calls.length, read.mock.calls.length, host.pageTicks]
      .map((value, i) => value - before[i]));
  }
  const normal = [1, 1, 0, 1, 1], dark = [0, 0, 1, 0, 1], held = [0, 1, 0, 0, 1];
  expect(rows).toEqual([...Array(4).fill(normal), ...Array(4).fill(dark), ...Array(6).fill(normal),
    ...Array(2).fill(held), ...Array(4).fill(normal)]);
});

it('SFX_INTRO_CRASH and SFX_INTRO_WHOOSH play Audio 3\'s bodies on channel 8', () => {
  toFrame(38);
  expect(audio.channelSoundId(8)).toBe(0);
  toFrame(39);
  expect(audio.channelSoundId(8)).toBe(0xbc);
  toFrame(87);
  expect(audio.channelSoundId(8)).toBe(0xbd);
  expect(audio.isSfxPlaying('intro_whoosh')).toBe(true);
});

it('clip 1 freezes main for 46 ticks; the next serviced tick stops all music and starts the title\'s', () => {
  toFrame(92);
  expect(isCpuFrozen()).toBe(false);
  tick();
  expect([main.titleScreen.inspection.frame, isCpuFrozen()]).toEqual([93, true]);
  let frozen = 0;
  while (isCpuFrozen()) { tick(); frozen++; }
  expect(frozen).toBe(46);
  expect(main.titleScreen.inspection.frame).toBe(93);
  expect(engines().music.isPlaying()).toBe(false);
  tick();
  expect(main.titleScreen.inspection.frame).toBe(94);
  expect(engines().music.isPlaying()).toBe(true);
  expect(main.titleScreen.inspection.stage).toBe('loop');
  expect(main.titleScreen.inspection.audioRequests.map(r => [r.frame, r.kind, r.value])).toEqual([
    [0, 'bank', 0x1f], [39, 'sfx', 'intro_crash'], [87, 'sfx', 'intro_whoosh'], [90, 'clip', 1],
    [94, 'stop', 0xff], [94, 'music', 'titlescreen']]);
  expect(audio.channelSoundId(8)).toBe(0);
});

it('A and START do nothing during the build; held in the loop, START plays clip 11 (36 frozen ticks), whites out, then MainMenu', () => {
  toFrame(94, () => (main.titleScreen.inspection.frame % 2 ? ['a'] : ['start']));
  expect(host.state).toBe('title_screen');
  tick();
  tick(['start']);
  expect([host.state, main.titleScreen.inspection.stage, main.titleScreen.inspection.frame]).toEqual(['title_screen', 'exit', 96]);
  const frozen: boolean[] = [];
  for (let n = 1; n <= 55; n++) { tick(); frozen.push(isCpuFrozen()); if (n < 55) expect(host.state, `tick ${n}`).toBe('title_screen'); }
  expect(host.state).toBe('main_menu');
  expect(frozen.filter(Boolean)).toHaveLength(36);
  expect(frozen.indexOf(true)).toBe(2);
  expect(main.titleScreen.inspection.audioRequests.slice(-1)).toEqual([{ frame: 96, kind: 'clip', value: 11 }]);
  // The clip stops no music: the title song plays on into the main menu.
  expect(engines().music.isPlaying()).toBe(true);
});

/** From the click to the main menu: the build, one loop frame, START for the deciding frame, then the exit. */
function toMainMenuOrDialogue(held: ('a' | 'start' | 'up' | 'select' | 'b')[]): void {
  toFrame(95);
  tick(held);
  for (let n = 0; n < 55; n++) tick();
}
function toMainMenu(held: ('a' | 'start' | 'up' | 'select' | 'b')[] = ['start']): void {
  toMainMenuOrDialogue(held);
  expect(host.state).toBe('main_menu');
}

/** A save in a stand-in localStorage, for the clear-save dialogue's two answers. */
function stubSave(): Map<string, string> {
  const store = new Map<string, string>([['p151-s', '{"version":2}'], ['p151-f', '60']]);
  vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); }, removeItem: (key: string) => { store.delete(key); } });
  return store;
}
/** From the title's exit to the NO/YES menu's first read. */
function toClearSaveMenu(): void {
  toMainMenuOrDialogue(['up', 'select', 'b']);
  expect(host.state).toBe('clear_save');
  for (let guard = 0; main.clearSaveDialogue.inspection.stage !== 'menu'; guard++) {
    if (guard > 200) throw new Error('dialogue bound');
    tick();
  }
  tick(); tick();
}

it('Up+Select+B leaves as START does into DoClearSaveDialogue, at one frame a letter, with the title song playing', () => {
  stubSave();
  toMainMenuOrDialogue(['up', 'select', 'b']);
  expect([host.state, main.clearSaveDialogue.inspection.stage]).toEqual(['clear_save', 'clear']);
  expect(getFastTextDelay()).toBe(false);
  let frames = 0;
  while (main.clearSaveDialogue.inspection.stage !== 'menu') { tick(); frames++; }
  expect(frames).toBe(53);
  expect(engines().music.isPlaying()).toBe(true);
  expect(audio.isAudioFadingOut()).toBe(false);
});

it('NO: A, 15 frames, then Init in that step: the song stops, the title builds again, the save is kept', () => {
  const store = stubSave();
  toClearSaveMenu();
  tick(['a']);
  for (let n = 1; n <= 14; n++) { tick(); expect(host.state, `tick ${n}`).toBe('clear_save'); }
  tick();
  // `jp Init`: the song plays on, frozen with the CPU's `di`, until StopAllSounds in Init's 10th frame.
  expect([host.state, main.boot.inspection.stage]).toEqual(['boot', 'init']);
  expect(engines().music.isPlaying()).toBe(true);
  expect(bootToTitle()).toBe(593);
  expect([host.state, main.titleScreen.inspection.stage, main.titleScreen.inspection.frame]).toEqual(['title_screen', 'build', 0]);
  expect(engines().music.isPlaying()).toBe(false);
  expect([...store.keys()]).toEqual(['p151-s', 'p151-f']);
  expect(input.joyIgnore()).toBe('none');
});

it('YES: Down, A, 15 frames, ClearAllSRAMBanks\' 13, then Init; only the save\'s key is gone', () => {
  const store = stubSave();
  toClearSaveMenu();
  tick(['down']); tick(); tick();
  tick(['a']);
  let frames = 0;
  while (host.state === 'clear_save' && frames < 60) { tick(); frames++; }
  expect(frames).toBe(15 + 13);
  expect(host.state).toBe('boot');
  expect(bootToTitle()).toBe(593);
  expect([host.state, main.titleScreen.inspection.stage]).toEqual(['title_screen', 'build']);
  expect([...store.keys()]).toEqual(['p151-f']);
});

it('BIT_FAST_TEXT_DELAY: PrepareTitleScreen clears it, the main menu\'s InitOptions sets it, B\'s rebuild keeps it', () => {
  expect(getFastTextDelay()).toBe(false);
  toMainMenuOrDialogue(['start']);
  expect([host.state, getFastTextDelay()]).toEqual(['main_menu', true]);
  tick(); tick(['b']);
  expect([host.state, getFastTextDelay()]).toEqual(['title_screen', true]);
});

it('B from the main menu rebuilds the title under the playing song; clip 1 freezes 46 ticks, then the song restarts', () => {
  toMainMenu();
  tick(); tick(['b']);
  expect([host.state, main.titleScreen.inspection.stage, main.titleScreen.inspection.frame]).toEqual(['title_screen', 'build', 0]);
  expect([engines().banks.audioBank, engines().banks.savedAudioBank]).toEqual([0x1f, 0x1f]);
  const playing: boolean[] = [];
  while (main.titleScreen.inspection.frame < 92) { tick(); playing.push(engines().music.isPlaying()); }
  expect(playing.every(Boolean)).toBe(true);
  tick();
  expect([main.titleScreen.inspection.frame, isCpuFrozen()]).toEqual([93, true]);
  let frozen = 0;
  while (isCpuFrozen()) { tick(); frozen++; }
  expect(frozen).toBe(46);
  toFrame(110);
  const requests = main.titleScreen.inspection.audioRequests.map(r => [r.frame, r.kind, r.value]);
  expect(requests.slice(0, 3)).toEqual([[39, 'sfx', 'intro_crash'], [87, 'sfx', 'intro_whoosh'], [90, 'clip', 1]]);
  const [stop, music] = requests.slice(3);
  expect([stop[1], stop[2], music[1], music[2]]).toEqual(['stop', 0xff, 'music', 'titlescreen']);
  expect(stop[0]).toBe(music[0]);
  expect(Number(stop[0])).toBeGreaterThanOrEqual(94);
  expect(engines().music.isPlaying()).toBe(true);
});

it('the click is Init: Random\'s two bytes and the transfer\'s third at once, StopAllSounds in its 10th frame', async () => {
  // The title starts on third 2; its first transfer moves it to 0, its second to 1.
  tick(); tick();
  host.random.hRandomAdd = 0x5a; host.random.hRandomSub = 0xa5;
  engines().banks.lastMusicSoundId = 0xff;
  expect(textBgTransfer.nextPortion).not.toBe(0);
  await documentCalls.click!();
  expect([host.state, host.random.hRandomAdd, host.random.hRandomSub, textBgTransfer.nextPortion, textBgTransfer.enabled])
    .toEqual(['boot', 0, 0, 0, false]);
  for (let n = 1; n <= 9; n++) tick();
  expect(engines().banks.lastMusicSoundId).toBe(0xff);
  tick();
  expect(engines().banks.lastMusicSoundId).toBe(0);
  expect(bootToTitle()).toBe(583);
  // The copyright's and the star's 512 transfers leave the third at 2, as the cartridge's hAutoBGTransferPortion is at
  // PrepareTitleScreen (star-frames.mjs); the movie (10–14) will move it again.
  expect([engines().banks.audioBank, main.titleScreen.inspection.frame, textBgTransfer.nextPortion]).toEqual([0x1f, 0, 2]);
});

it('the idle reset: 3,071 loop frames, the song fades for 104 frames ($0C), then Init and the build again', () => {
  toFrame(94);
  for (let n = 1; n <= 3070; n++) tick();
  expect([main.titleScreen.inspection.stage, main.titleScreen.inspection.frame]).toEqual(['loop', 3164]);
  tick();
  expect(main.titleScreen.inspection.stage).toBe('reset');
  expect([engines().banks.lastMusicSoundId, engines().banks.fadeReload]).toEqual([0xff, 0x0c]);
  expect(audio.isAudioFadingOut()).toBe(true);
  let fading = 0;
  while (audio.isAudioFadingOut()) { tick(); fading++; if (fading > 200) throw new Error('fade bound'); }
  expect(fading).toBe(104);
  // FadeOutAudio's last VBlank stops the song; the spin sees the control clear and Init runs in the same step.
  expect([host.state, host.random.hRandomAdd, host.random.hRandomSub, textBgTransfer.nextPortion]).toEqual(['boot', 0, 0, 0]);
  expect(engines().music.isPlaying()).toBe(false);
  expect(bootToTitle()).toBe(593);
  expect([host.state, main.titleScreen.inspection.stage, main.titleScreen.inspection.frame]).toEqual(['title_screen', 'build', 0]);
  expect([engines().banks.lastMusicSoundId, engines().banks.fadeControl, engines().banks.audioBank]).toEqual([0, 0, 0x1f]);
});

it('the boot path, tick by tick: 10 dark, 51 serviced, 2 held, 200 serviced, the star\'s dark one, 326 serviced, 3 dark, then PrepareTitleScreen', async () => {
  await documentCalls.click!();
  const random = vi.spyOn(host.random, 'random');
  const update = vi.spyOn(audio, 'tickAudio');
  const read = vi.spyOn(input, 'syncJoypadRead');
  const rows: string[] = [];
  for (let n = 1; n <= 593; n++) {
    const before = [random.mock.calls.length, update.mock.calls.length, read.mock.calls.length];
    tick();
    const ran = [random.mock.calls.length, update.mock.calls.length, read.mock.calls.length].map((value, i) => value - before[i]);
    // A held frame (LoadBGMapAttributes) updates the audio only (core/vblank_hold.ts).
    rows.push(ran.every(Boolean) ? 'v' : ran.join() === '0,1,0' ? 'h' : ran.some(Boolean) ? '?' : 'd');
  }
  expect(rows.join('')).toBe('d'.repeat(10) + 'v'.repeat(51) + 'h'.repeat(2) + 'v'.repeat(200) + 'd' + 'v'.repeat(326) + 'd'.repeat(3));
  expect([host.state, main.titleScreen.inspection.stage, main.titleScreen.inspection.frame]).toEqual(['title_screen', 'build', 0]);
});

it('SFX_SHOOTING_STAR plays Audio 3\'s body on channel 5 from the star\'s first step (tick 331); Init chose bank $1f after LoadSGB', async () => {
  await documentCalls.click!();
  for (let n = 1; n <= 61; n++) tick();
  expect([engines().banks.audioBank, engines().banks.savedAudioBank]).toEqual([0x1f, 0x1f]);
  for (let n = 62; n <= 330; n++) tick();
  expect(audio.channelSoundId(5)).toBe(0);
  tick();
  expect(audio.channelSoundId(5)).toBe(0xc2);
  expect(audio.isSfxPlaying('shooting_star')).toBe(true);
});

it('A in the star skips it through main\'s real tick: held from tick 343, PrepareTitleScreen in 351, as on the cartridge', async () => {
  await documentCalls.click!();
  expect(bootToTitle(['a'], 343)).toBe(351);
  expect([host.state, main.titleScreen.inspection.stage]).toEqual(['title_screen', 'build']);
});
