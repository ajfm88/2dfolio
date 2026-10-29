import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} } }));
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { A, BattleState } from './battle_state';
import { BattleHost } from './battle_host';
import { BattleAudio } from './battle_audio';
import { MOVE_ANIM as M, moveAnimation, type MoveAnimationHost } from './battle_move_anim';
import { rig, sfxData } from '../test/audio_rig';
import { soundFinished } from '../audio/sound_wait';
import { setLowHealthAlarm, setLowHealthAlarmDisabled, setLowHealthChannel5 } from '../audio/low_health_alarm';
import { textBgTransfer } from '../text/bg_transfer';
import { BALL } from './battle_item_ball';
import { battleLedger } from '../test/battle_ledger_rig';
import { createPokemon, loadBattleData } from './data';
import { loadBattleMoveData } from './battle_move_data';
import { loadStatEffectData } from './battle_effects_stats';
import { loadTextPrograms } from '../text/program_data';
import { initTextSystem, setTextSpeed } from '../text/textbox';
import { resetListStateForEmptySlot } from '../list_state';
import { D } from './battle_end_state';
import { installTrainerSpecies } from './battle_trainer_party';
import { partySlotFromPokemon, writePartySlot, loadBattleMonFromParty, loadEnemyMonData } from './battle_loaders';
import * as status from './battle_turn_status';

const sounds: MoveAnimationHost['sounds'] = {
  damage: { id: 0xa6, data: sfxData('damage') }, superEffective: { id: 0xb0, data: sfxData('super_effective') },
  notVeryEffective: { id: 0xa7, data: sfxData('not_very_effective') },
};
beforeAll(async () => { await loadBattleData(); await loadBattleMoveData(); await loadStatEffectData(); await loadTextPrograms(); await initTextSystem(); });
beforeEach(() => {
  vi.clearAllMocks(); resetListStateForEmptySlot(); setTextSpeed('fast'); textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  setLowHealthAlarm(0); setLowHealthAlarmDisabled(false); setLowHealthChannel5(0);
});
afterEach(() => vi.restoreAllMocks());

interface Options { id?: number; type?: number; multiplier?: number; turn?: number; options?: number; alarm?: boolean; busy?: boolean; bg?: boolean; wy?: number }
function fixture(o: Options = {}) {
  const s = new BattleState(), audio = rig(), bridge = new BattleAudio(audio.sfx, audio.music);
  const driver = new BattleHost(s, undefined, audio.update), screen = driver.video.screen;
  let clock = 0, returnedAt = -1, tosses = 0;
  const waits: { at: number; active: boolean }[] = [], played: { at: number; id: number; frequency: number; tempo: number }[] = [];
  s.wAnimationID = o.id ?? 33; s.wAnimationType = o.type ?? 0; s.wDamageMultipliers = o.multiplier ?? 10;
  s.hWhoseTurn = o.turn ?? 0; s.mem[A.wOptions] = o.options ?? 0x80;
  s.mem[M.hWY] = o.wy ?? 0; screen.wx = 7; screen.wy = o.wy ?? 0;
  for (const address of [M.wSubAnimSubEntryAddr, M.wUnusedMoveAnimByte, M.wSubAnimTransform, M.wAnimSoundID]) s.mem[address] = 0xa5;
  s.mem[M.wSubAnimSubEntryAddr + 1] = 0xb6;
  s.mem[M.hBaseTileID] = 0xa5; // Checkpoint-06 item0: prove both blink base writes replace stale HRAM.
  for (let row = 0; row < 7; row++) for (let col = 0; col < 7; col++) {
    screen.put(12 + col, row, row + 7 * col); screen.put(1 + col, 5 + row, 0x31 + row + 7 * col);
  }
  if (o.alarm) { s.wLowHealthAlarm = 0x80; setLowHealthAlarm(0x80); }
  if (o.busy) bridge.play({ id: 0x90, data: sfxData('press_ab') });
  if (o.bg === false) textBgTransfer.enabled = false;
  const play = bridge.play.bind(bridge);
  vi.spyOn(bridge, 'play').mockImplementation(sound => {
    played.push({ at: clock, id: sound.id, frequency: bridge.frequencyModifier, tempo: bridge.tempoModifier }); return play(sound);
  });
  const host: MoveAnimationHost = { screen, audio: bridge, sounds,
    waitForSound: function* () {
      waits.push({ at: clock, active: !soundFinished(audio.sfx, audio.music, 0) });
      while (!soundFinished(audio.sfx, audio.music, 0)) yield 'serviced';
    }, tossBall: function* () { tosses++; },
  };
  const pic = (x: number, y: number) => Array.from({ length: 49 }, (_, i) => screen.at(x + i % 7, y + Math.floor(i / 7)));
  const observe = () => ({ wy: screen.wy, wx: screen.wx, hold: screen.disableVBlankWYUpdate, turn: s.hWhoseTurn,
    front: pic(12, 0), back: pic(1, 5), obp: [screen.obp0, screen.obp1], bg: Number(textBgTransfer.enabled),
    mutate: [s.mem[M.hMutateWY], s.mem[M.hMutateWX]], cleanup: [s.mem[M.wSubAnimSubEntryAddr], s.mem[M.wUnusedMoveAnimByte], s.mem[M.wSubAnimTransform], s.mem[M.wAnimSoundID]],
    channels: [bridge.channelId(5), bridge.channelId(6), bridge.channelId(8)] });
  const rows: ReturnType<typeof observe>[] = [];
  driver.start((function* () { yield* moveAnimation(s, host); returnedAt = clock; yield 'serviced'; })());
  while (!driver.done && clock < 500) { rows.push(observe()); clock++; driver.step(); }
  expect(driver.done).toBe(true);
  return { s, screen, bridge, audio, rows, waits, played, returnedAt, tosses, final: observe(),
    ledger: () => ({ rows: rows.map((r, i) => `${i}:WY${r.wy} WX${r.wx} hold${r.hold} turn${r.turn} OBP${r.obp} BG${r.bg} mutate${r.mutate} clean${r.cleanup} channels${r.channels} front[${r.front}] back[${r.back}]`),
      waits, played, returnedAt, tosses, final: observe(), audio: audio.synth.log.map(w => `${w.u}:${w.m}(${w.a})`) }) };
}
function cleanup(r: ReturnType<typeof fixture>) {
  expect([r.s.mem[M.wSubAnimSubEntryAddr], r.s.mem[M.wUnusedMoveAnimByte], r.s.mem[M.wSubAnimTransform], r.s.mem[M.wAnimSoundID]]).toEqual([0, 0, 0, 255]);
  expect(r.s.mem[M.wSubAnimSubEntryAddr + 1]).toBe(0xb6); // LD [D095], A does not clear the high byte.
  expect(r.s.mem[M.wAnimPalette]).toBe(0xe4); expect(r.final.obp).toEqual([0xe4, 0x6c]);
  expect(r.waits).toHaveLength([0, 3, 6].includes(r.s.wAnimationType) || [0, 0xc1].includes(r.s.wAnimationID) ? 2 : 3);
}
const numericPic = (base: number) => Array.from({ length: 49 }, (_, i) => base + Math.floor(i / 7) + 7 * (i % 7));

describe('checkpoint-05 OFF animation through real host, screen and audio', () => {
  it.each([[0, 30], [1, 78], [2, 102], [3, 78], [4, 108], [5, 53], [6, 54]])('type%i: exact applying frames and cleanup (total%i)', (type, total) => {
    // Synthetic nonzero hWY proves the VBlank restore reads its shadow, rather than writing a fixed zero.
    const r = fixture({ type, wy: type === 1 ? 17 : 0 }); cleanup(r);
    expect(r.returnedAt).toBe(total);
    expect(r.rows[0].obp).toEqual([0xe4, 0x6c]);
    expect(r.played).toEqual([0, 3, 6].includes(type) ? [] : [{ at: 30, id: 0xa6, frequency: 0x20, tempo: 0x30 }]);
    expect(r.screen.wx).toBe(7); expect(r.s.hWhoseTurn).toBe(0);
    if (type === 1) {
      const positions = [8, 0, 0, 7, 0, 6, 0, 5, 0, 4, 0, 3, 0, 2, 0, 1];
      expect(r.rows.slice(30, 78).map(row => row.wy)).toEqual(positions.flatMap(n => [n, n, n]));
      expect(r.rows[78].hold).toBe(0); expect(r.rows[78].wy).toBe(1); expect(r.final.wy).toBe(17);
    }
    if (type === 2 || type === 5) {
      const expected: number[] = []; const count = type === 2 ? 8 : 2;
      for (let b = count; b > 0; b--) expected.push(...Array(5).fill(b === count ? b + 7 : 7), ...Array(4).fill(b === count ? 7 : b + 7));
      expect(r.rows.slice(30, 30 + count * 9).map(row => row.wx)).toEqual(expected);
      if (type === 5) {
        expect(r.rows[48].channels[2]).toBe(0xa6); expect(r.rows[48].cleanup).toEqual([0xa5, 0xa5, 0xa5, 0xa5]);
        expect(r.final.channels).toEqual([0, 0, 0]);
      }
    }
    if (type === 3 || type === 6) {
      const b = type === 3 ? 6 : 3;
      const wave = [...Array.from({ length: b }, (_, i) => 8 + i), ...Array.from({ length: b }, (_, i) => 6 + b - i)];
      expect(r.rows.slice(30, 30 + b * 8).map(row => row.wx)).toEqual([...wave, ...wave].flatMap(n => [n, n]));
    }
    if (type === 4) {
      expect(r.s.mem[M.hBaseTileID]).toBe(0);
      for (let cycle = 0; cycle < 6; cycle++) {
        expect(r.rows.slice(30 + cycle * 13, 35 + cycle * 13).map(row => row.front)).toEqual(Array.from({ length: 5 }, () => Array(49).fill(' ')));
        expect(r.rows.slice(35 + cycle * 13, 43 + cycle * 13).map(row => row.front)).toEqual(Array.from({ length: 8 }, () => numericPic(0)));
      }
      expect(r.rows.slice(30, 108).every(row => row.turn === 1 && JSON.stringify(row.back) === JSON.stringify(numericPic(0x31)))).toBe(true);
    }
    expect(r.ledger()).toMatchSnapshot();
  });
  it.each([0, 0xc1])('id%i skips30 and applying animation, but sets palettes and cleans', id => {
    const r = fixture({ id, type: 4 }); cleanup(r); expect(BALL.TOSS_ANIM).toBe(0xc1);
    expect(r.returnedAt).toBe(0); expect(r.tosses).toBe(id === 0xc1 ? 1 : 0); expect(r.played).toEqual([]);
    expect(r.final.front).toEqual(numericPic(0)); expect(r.ledger()).toMatchSnapshot();
  });
  it.each([[0, 0, 0, 0], [0x85, 0xa7, 0x50, 1], [0x8a, 0xa6, 0x20, 0x30], [20, 0xb0, 0xe0, 0xff]])('multiplier%i masks STAB and chooses the sound band', (multiplier, id, frequency, tempo) => {
    const r = fixture({ type: 4, multiplier }); cleanup(r); expect(r.returnedAt).toBe(108);
    expect(r.played).toEqual(id ? [{ at: 30, id, frequency, tempo }] : []); expect(r.ledger()).toMatchSnapshot();
  });
  it('synthetic enemy type4 flips to the player picture and CopyTileIDs re-enables BG transfer', () => {
    const r = fixture({ type: 4, turn: 1, bg: false }); cleanup(r); expect(r.returnedAt).toBe(108);
    expect(r.s.mem[M.hBaseTileID]).toBe(0x31);
    expect(r.rows[30].back).toEqual(Array(49).fill(' ')); expect(r.rows[30].front).toEqual(numericPic(0));
    expect(r.rows[35].back).toEqual(numericPic(0x31)); expect(r.rows[34].bg).toBe(0); expect(r.rows[35].bg).toBe(1);
    expect(r.rows[30].turn).toBe(0); expect(r.s.hWhoseTurn).toBe(1); expect(r.ledger()).toMatchSnapshot();
  });
  it('low-health alarm bit7 makes both sound waits return immediately even with active sound', () => {
    const r = fixture({ id: 0, alarm: true, busy: true }); cleanup(r);
    expect(r.returnedAt).toBe(0); expect(r.bridge.channelId(5)).not.toBe(0); expect(r.ledger()).toMatchSnapshot();
  });
  it('the entry waits for an existing sound before setting the animation palettes', () => {
    const r = fixture({ id: 0, busy: true }); cleanup(r); expect(r.returnedAt).toBeGreaterThan(0);
    expect(r.rows[0].obp).toEqual([0xd0, 0xe0]); expect(r.waits[0].active).toBe(true);
    expect(r.bridge.channelId(5)).toBe(0); expect(r.ledger()).toMatchSnapshot();
  });
  it('wOptions bit7 clear still takes the OFF path until A5e; no ShareMoveAnimations rewrite', () => {
    const r = fixture({ id: 133, type: 0, turn: 1, options: 0 }); cleanup(r); // enemy Amnesia
    expect(r.returnedAt).toBe(30); expect(r.s.wAnimationID).toBe(133); expect(r.ledger()).toMatchSnapshot();
  });

  it('real Route1 Tackle through battleLoop: Delay3 +30 +78 blink +12 refresh =123 frames', () => {
    // The old rig's pre-loop phase is named unexpected; plan its two actual wild-loader DV draws explicitly.
    const r = battleLedger({ playerMove: 33, enemyMove: 33, draws: { unexpected: [0x16, 0x47], crit: [255], range: [255], hit: [0] } });
    const s = r.s; installTrainerSpecies(s);
    const player = createPokemon('PIDGEY', 20, 'LEAD', { atk: 8, def: 8, spd: 8, spc: 8 })!;
    player.moves = [{ id: 'TACKLE', pp: 35, maxPp: 35 }]; player.otName = 'ASH'; player.otId = 0x1234; s.partyMons[0] = player;
    writePartySlot(s, 'player', 0, partySlotFromPokemon(player)); s.wWhichPokemon = s.wPlayerMonNumber = 0;
    s.wBattleMonSpecies2 = 0x24; loadBattleMonFromParty(s);
    s.wCurPartySpecies = s.wEnemyMonSpecies2 = s.wCurOpponent = 0xa5; s.wCurEnemyLevel = 3; s.wIsInBattle = 1; s.wCurMap = 0x0c;
    loadEnemyMonData(s);
    expect(s.wEnemyMonLevel).toBe(3); expect(s.wEnemyMonSpecies).toBe(0xa5);
    expect(s.wEnemyMonBaseExp).toBe(s.species(0xa5).baseExp);
    expect([...s.mem.slice(A.wEnemyMonDVs, A.wEnemyMonDVs + 2)]).toEqual([0x47, 0x16]);
    for (let row = 0; row < 7; row++) for (let col = 0; col < 7; col++) {
      r.screen.put(12 + col, row, row + 7 * col); r.screen.put(1 + col, 5 + row, 0x31 + row + 7 * col);
    }
    r.video.saveScreenTilesToBuffer1();
    const host: MoveAnimationHost = { screen: r.screen, audio: r.bridge, sounds, waitForSound: () => r.host.waitForSound(), tossBall: function* () { throw new Error('unexpected toss'); } };
    let clock = 0; const spans: number[] = [], ports: number[] = [], frames: string[] = [];
    const played: { at: number; id: number; frequency: number; tempo: number }[] = [];
    const priorPlay = vi.mocked(r.bridge.play).getMockImplementation()!;
    vi.mocked(r.bridge.play).mockImplementation(sound => {
      played.push({ at: clock, id: sound.id, frequency: r.bridge.frequencyModifier, tempo: r.bridge.tempoModifier }); return priorPlay(sound);
    });
    const originalStep = r.driver.step.bind(r.driver);
    vi.spyOn(r.driver, 'step').mockImplementation(() => {
      frames.push(`${clock}:WY${r.screen.wy} WX${r.screen.wx} OBP${r.screen.obp0},${r.screen.obp1} turn${s.hWhoseTurn} hold${r.screen.disableVBlankWYUpdate} front[${Array.from({ length: 49 }, (_, i) => r.screen.at(12 + i % 7, Math.floor(i / 7)))}] back[${Array.from({ length: 49 }, (_, i) => r.screen.at(1 + i % 7, 5 + Math.floor(i / 7)))}]`);
      clock++; return originalStep();
    });
    r.ports.animation = function* (state) { const at = clock; yield* moveAnimation(state, host); ports.push(clock - at); };
    const original = status.playMoveAnimation;
    vi.spyOn(status, 'playMoveAnimation').mockImplementation(function* (...args) { const at = clock; yield* original(...args); spans.push(clock - at); });
    expect(r.runBattle()).toBe('end'); expect(s.wBattleResult).toBe(0);
    expect(s.mem[D.wDestinationWarpID]).toBe(255);
    expect(spans).toEqual([123]); expect(ports).toEqual([108]);
    expect(played.find(sound => sound.id === 0xa6)).toMatchObject({ frequency: 0x20, tempo: 0x30 });
    expect(r.events.some(e => e.name === 'text:GainedText')).toBe(true);
    expect({ spans, ports, frames, played, battle: r.ledger() }).toMatchSnapshot();
  }, 20000);
});
