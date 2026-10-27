import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} } }));
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(),
  loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { isHeld, isPassPressed } from '../input';
import { initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms } from '../text/program_data';
import { textBgTransfer } from '../text/bg_transfer';
import { rig as audioRig, sfxData } from '../test/audio_rig';
import { lowHealthAlarm, setLowHealthAlarm, setLowHealthChannel5, setLowHealthAlarmDisabled } from '../audio/low_health_alarm';
import { soundFinished } from '../audio/sound_wait';
import { BattleState } from './battle_state';
import { I } from './battle_item_state';
import { BattleHost } from './battle_host';
import { BattleAudio } from './battle_audio';
import { useItem, type BattleItemHost } from './battle_items';
import { registerFluteBattleItemBody, wakeUpEntireParty } from './battle_item_flute';
import * as happiness from './battle_pikachu';

const disposers: (() => void)[] = [];
beforeAll(async () => { await loadTextPrograms(); await initTextSystem(); });
beforeEach(() => {
  vi.restoreAllMocks(); setTextSpeed('fast'); textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  setLowHealthAlarm(0); setLowHealthChannel5(0); setLowHealthAlarmDisabled(false);
});
afterEach(() => { disposers.splice(0).forEach(dispose => dispose()); vi.restoreAllMocks(); });

function setup() {
  const s = new BattleState(), audio = audioRig(), bridge = new BattleAudio(audio.sfx, audio.music);
  const driver = new BattleHost(s, undefined, audio.update), video = driver.video;
  s.wIsInBattle = 1; s.mem[I.wCurItem] = 0x49; s.wWhichPokemon = 0;
  s.setBag([{ id: 0x49, quantity: 1 }]);
  const bag = [{ id: 'POKE_FLUTE', count: 1 }], bagBytes = s.mem.slice(I.wNumBagItems, I.wNumBagItems + 4);
  s.mem[I.wWereAnyMonsAsleep] = 0xa5;
  s.mem[I.wPikachuHappiness] = 123; s.mem[I.wPikachuMood] = 0x80;
  const happy = vi.spyOn(happiness, 'modifyPikachuHappiness');
  let time = 0;
  const events: { at: number; event: string; ids?: number[] }[] = [];
  const mark = (event: string) => events.push({ at: time, event, ids: [5, 6, 7].map(id => bridge.channelId(id)) });
  const host: BattleItemHost = {
    tiles: video.tiles, audio: bridge, sounds: new Map([[0x9a, { id: 0x9a, data: sfxData('caught_mon') }]]), bag,
    readScrollJoypad: () => 0,
    printText: function* (label, bindings, options) {
      mark(`print:${label}`); yield* driver.printText(label, bindings, options); mark(`end:${label}`);
    },
    waitForSound: function* () {
      mark('wait'); while (!soundFinished(audio.sfx, audio.music, 0)) yield 'serviced'; mark('wait:end');
    },
  };
  const play = bridge.play.bind(bridge);
  const sound = vi.spyOn(bridge, 'play').mockImplementation(data => { mark(`sound:${data.id}`); return play(data); });
  // Save a visible cell to prove the real Buffer2 owner is restored before printing.
  video.screen.put(0, 0, 'Q'); video.saveScreenTilesToBuffer2(); video.screen.put(0, 0, 'Z');
  disposers.push(registerFluteBattleItemBody({ sfx: audio.sfx, streams: sfxData('pokeflute_in_battle'),
    loadScreenTilesFromBuffer2() { mark('load2'); video.loadScreenTilesFromBuffer2(); expect(video.screen.at(0, 0)).toBe('Q'); },
  }));
  function start() { driver.start(useItem(s, host)); }
  function step() {
    const pressed = time % 2 === 0;
    vi.mocked(isHeld).mockImplementation(key => pressed && key === 'b');
    vi.mocked(isPassPressed).mockImplementation(key => pressed && key === 'b');
    time++; driver.step();
  }
  function finish(beforeStep?: () => void) {
    for (let i = 0; !driver.done && i < 2000; i++) { beforeStep?.(); step(); }
    expect(driver.done).toBe(true); expect(s.wActionResultOrTookBattleTurn).toBe(1);
    expect(s.mem.slice(I.wNumBagItems, I.wNumBagItems + 4)).toEqual(bagBytes);
    expect(bag).toEqual([{ id: 'POKE_FLUTE', count: 1 }]);
    expect(happy).not.toHaveBeenCalled(); expect(s.mem[I.wPikachuHappiness]).toBe(123);
    expect(s.mem[I.wPikachuMood]).toBe(0x80);
  }
  const labels = () => events.filter(e => e.event.startsWith('print:')).map(e => e.event.slice(6));
  return { s, audio, bridge, driver, events, host, sound, start, step, finish, labels, time: () => time };
}

it('clears all six raw statuses with the44-byte stride and preserves every other byte', () => {
  const s = new BattleState(); s.mem.fill(0xab, I.wPartyMons, I.wPartyMons + 6 * 44);
  s.mem[I.wPartyCount] = 0; s.mem[I.wWereAnyMonsAsleep] = 0;
  const expected = s.mem.slice(I.wPartyMons, I.wPartyMons + 6 * 44);
  for (let slot = 0; slot < 6; slot++) expected[slot * 44 + 4] = 0xa8;
  wakeUpEntireParty(s, I.wPartyMons + 4);
  expect(s.mem.slice(I.wPartyMons, I.wPartyMons + 6 * 44)).toEqual(expected);
  expect(s.mem[I.wWereAnyMonsAsleep]).toBe(1);
});

it('only active-player sleep is cleared without being counted: no effect, no wait, no sound', () => {
  const r = setup(); r.s.wBattleMonStatus = 0x43; r.s.wEnemyMonStatus = 0x20;
  r.start(); r.finish();
  expect(r.s.wBattleMonStatus).toBe(0x40); expect(r.s.wEnemyMonStatus).toBe(0x20);
  expect(r.s.mem[I.wWereAnyMonsAsleep]).toBe(0);
  expect(r.labels()).toEqual(['PlayedFluteNoEffectText']); expect(r.sound).not.toHaveBeenCalled();
  expect(r.events.map(e => e.event)).toEqual(['load2', 'print:PlayedFluteNoEffectText', 'end:PlayedFluteNoEffectText']);
  expect(r.time()).toBe(121); // Real fast printer, alternating B; no flute updates.
});

it('a sleeping reserve with an awake active player has effect and waits exactly257 audio updates', () => {
  const r = setup(); r.s.mem[I.wPartyMons + 44 + 4] = 0x82;
  r.start(); r.finish();
  expect(r.s.wBattleMonStatus).toBe(0); expect(r.s.mem[I.wPartyMons + 44 + 4]).toBe(0x80);
  expect(r.labels()).toEqual(['PlayedFluteHadEffectText', 'FluteWokeUpText']);
  expect(r.sound).toHaveBeenCalledOnce();
  const sound = r.events.find(e => e.event === 'sound:154')!, woke = r.events.find(e => e.event === 'print:FluteWokeUpText')!;
  expect(woke.at - sound.at).toBe(257); expect(woke.ids).toEqual([0, 0, 0]);
  expect(r.events.filter(e => e.event === 'wait')).toHaveLength(2); // caller wait + bootstrap pre-wait.
  expect(r.time()).toBe(379); // Printer122 + flute257, including the input-read phase.
});

it('only active-enemy sleep counts, clears sleep and preserves its other status bits', () => {
  const r = setup(); r.s.wEnemyMonStatus = 0xa5;
  r.start(); r.finish();
  expect(r.s.wEnemyMonStatus).toBe(0xa0); expect(r.s.mem[I.wWereAnyMonsAsleep]).toBe(1);
  expect(r.labels()).toEqual(['PlayedFluteHadEffectText', 'FluteWokeUpText']);
});

it('a wild battle leaves all six enemy slots untouched, including sleeping empty slots', () => {
  const r = setup();
  r.s.mem.fill(0xff, I.wEnemyMons, I.wEnemyMons + 6 * 44);
  const before = r.s.mem.slice(I.wEnemyMons, I.wEnemyMons + 6 * 44);
  r.start(); r.finish();
  expect(r.s.mem.slice(I.wEnemyMons, I.wEnemyMons + 6 * 44)).toEqual(before);
  expect(r.s.mem[I.wWereAnyMonsAsleep]).toBe(0); expect(r.labels()).toEqual(['PlayedFluteNoEffectText']);
});

it.each([0, 1, 2, 3, 4, 5])('counts sleeping empty player slot%s even with party count0 and active awake', slot => {
  const r = setup(); r.s.mem[I.wPartyCount] = 0; r.s.mem[I.wPartyMons + slot * 44 + 4] = 6;
  setLowHealthAlarm(0x80); r.start(); r.finish();
  expect(r.s.mem[I.wPartyMons + slot * 44 + 4]).toBe(0);
  expect(r.s.mem[I.wWereAnyMonsAsleep]).toBe(1);
  expect(r.labels()).toEqual(['PlayedFluteHadEffectText', 'FluteWokeUpText']);
});

it.each([2, 3])('battle kind%s wakes and counts all six raw enemy slots regardless of count', kind => {
  const r = setup(); r.s.wIsInBattle = kind; r.s.mem[I.wEnemyPartyCount] = 0;
  for (let slot = 0; slot < 6; slot++) r.s.mem[I.wEnemyMons + slot * 44 + 4] = 0x43;
  setLowHealthAlarm(0x80); r.start(); r.finish();
  for (let slot = 0; slot < 6; slot++) expect(r.s.mem[I.wEnemyMons + slot * 44 + 4]).toBe(0x40);
  expect(r.s.mem[I.wWereAnyMonsAsleep]).toBe(1);
  expect(r.labels()).toEqual(['PlayedFluteHadEffectText', 'FluteWokeUpText']);
});

it.each([0, 1, 2, 3, 4, 5])('counts enemy empty slot%s as the only sleeper in a trainer battle', slot => {
  const r = setup(); r.s.wIsInBattle = 2; r.s.mem[I.wEnemyPartyCount] = 0;
  r.s.mem[I.wEnemyMons + slot * 44 + 4] = 3;
  setLowHealthAlarm(0x80); r.start(); r.finish();
  expect(r.s.mem[I.wEnemyMons + slot * 44 + 4]).toBe(0);
  expect(r.s.mem[I.wWereAnyMonsAsleep]).toBe(1);
  expect(r.labels()).toEqual(['PlayedFluteHadEffectText', 'FluteWokeUpText']);
});

it('alarm bit7 skips both waits and playback, still printing woke-up text with the exact shorter frame total', () => {
  const r = setup(); r.s.wEnemyMonStatus = 2; setLowHealthAlarm(0x80);
  r.start(); r.finish();
  expect(lowHealthAlarm() & 0x80).toBe(0x80);
  expect(r.labels()).toEqual(['PlayedFluteHadEffectText', 'FluteWokeUpText']);
  expect(r.events.some(e => e.event === 'wait')).toBe(false); expect(r.sound).not.toHaveBeenCalled();
  expect(r.time()).toBe(123); // Printer/input phase differs by one after the257-frame skip.
});

it('polls CHAN7 even when CHAN5 clears early, rather than using the ordinary sound waiter', () => {
  const r = setup(); r.s.wEnemyMonStatus = 2; r.start();
  let cleared = false;
  r.finish(() => {
    const sound = r.events.find(e => e.event === 'sound:154');
    if (sound && r.time() - sound.at === 33) { setLowHealthChannel5(0); cleared = true; }
  });
  const sound = r.events.find(e => e.event === 'sound:154')!, woke = r.events.find(e => e.event === 'print:FluteWokeUpText')!;
  expect(cleared).toBe(true); expect(woke.at - sound.at).toBe(257); expect(woke.ids![2]).toBe(0);
});

it('finishes a sound started by the had-effect text before bootstrapping the flute', () => {
  const r = setup(), print = r.host.printText.bind(r.host);
  r.host.printText = function* (label, bindings, options) {
    yield* print(label, bindings, options);
    if (label === 'PlayedFluteHadEffectText') r.bridge.play({ id: 0x8d, data: sfxData('heal_hp') });
  };
  r.s.wEnemyMonStatus = 2; r.start(); r.finish();
  const printed = r.events.find(e => e.event === 'end:PlayedFluteHadEffectText')!, sound = r.events.find(e => e.event === 'sound:154')!;
  expect(sound.at - printed.at).toBe(33);
});
