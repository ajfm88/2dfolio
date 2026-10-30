import { beforeAll, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { A, BattleState, encodeText, POKEDEX_ORDER } from './battle_state';
import { loadBattleData } from './data';
import { loadBattleMoveData } from './battle_move_data';
import { BattleRandomState } from './battle_random_state';
import { setupBattleBeforeTransition, slidePlayerAndEnemySilhouettesOnScreen, type BattleInitHost } from './battle_init';
import { installTrainerSpecies } from './battle_trainer_party';
import { BattleScreen, battleGlyphTile } from './battle_screen';
import { hudContext } from './battle_hud_state';
beforeAll(async () => { await loadBattleData(); await loadBattleMoveData(); });

it('real04 palette setup leaves the unloaded player nickname unread and HUD reads its later value', () => {
  const state = new BattleState(); installTrainerSpecies(state);
  state.wCurOpponent = 0xa5; state.wCurEnemyLevel = 3;
  setupBattleBeforeTransition(state, new BattleRandomState(() => 2));
  expect([...state.mem.slice(A.wBattleMonNick, A.wBattleMonNick + 11)]).toEqual(Array(11).fill(0));
  // Only screen is read before PrintBeginningBattleText; stop on the first palette frame.
  const host = { screen: new BattleScreen() } as BattleInitHost;
  const slide = slidePlayerAndEnemySilhouettesOnScreen(state, host);
  expect(() => { for (let i = 0; i < 18; i++) expect(slide.next().done).toBe(false); }).not.toThrow();
  expect([...state.mem.slice(A.wBattleMonNick, A.wBattleMonNick + 11)]).toEqual(Array(11).fill(0));
  const ctx = hudContext(state);
  state.mem.set(encodeText('LATER@'), A.wBattleMonNick);
  expect(ctx.playerHud!.nickname).toBe('LATER');
});

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPokemon, getAllLoadedMoveIds, getMove } from './data';
import { decodePartyMon, encodePartyMon, partyRecordToPokemon, pokemonToPartyRecord, derivePPUps, partyMaxPP, decodeBattleText } from './battle_bridge';
import { BattleUnsupportedState } from './battle_move_data';
import { charToTile } from '../text/charmap';
import { BattleHost } from './battle_host';
import { loadTextPrograms } from '../text/program_data';
import { initTextSystem, setTextSpeed } from '../text/textbox';
import { isHeld } from '../input';
import { textBgTransfer } from '../text/bg_transfer';

function sample() {
  const state = new BattleState();
  // Literal byte fixture, independent of encodePartyMon. Names deliberately contain NULL and no terminator.
  state.mem.set([0xa5, 0xff, 0xff, 3, 7, 20, 21, 99, 33, 45, 85, 98,
    0x12, 0x34, 0xab, 0xcd, 0xef, 0x12, 0x34, 0xab, 0xcd, 0xff, 0xff,
    0, 1, 0x80, 0, 0x98, 0x76, 0x3f, 0x7e, 0xbd, 0xfc, 100,
    0xff, 0xff, 0x12, 0x34, 0xab, 0xcd, 0x80, 1, 0, 1], A.wPartyMons);
  state.mem.set([0, 255, 1, 2, 3, 4, 5, 6, 7, 8, 9], A.wPartyMonOT);
  state.mem.set([255, 0, 10, 20, 30, 40, 50, 60, 70, 80, 90], A.wPartyMonNicks);
  return state;
}
function raw(state: BattleState) {
  return [...state.mem.slice(A.wPartyMons, A.wPartyMons + 44),
    ...state.mem.slice(A.wPartyMonOT, A.wPartyMonOT + 11), ...state.mem.slice(A.wPartyMonNicks, A.wPartyMonNicks + 11)];
}
it('decodes every field at its independent big-endian party offset', () => {
  expect(decodePartyMon(sample(), 0)).toEqual({ species: 0xa5, hp: 65535, boxLevel: 3, status: 7,
    type1: 20, type2: 21, catchRate: 99, moves: [33,45,85,98], otId: 0x1234, exp: 0xabcdef,
    statExp: [0x1234,0xabcd,65535,1,0x8000], dvs: [0x98,0x76], pp: [0x3f,0x7e,0xbd,0xfc], level: 100,
    maxHp: 65535, attack: 0x1234, defense: 0xabcd, speed: 0x8001, special: 1,
    otName: Uint8Array.from([0,255,1,2,3,4,5,6,7,8,9]), nickname: Uint8Array.from([255,0,10,20,30,40,50,60,70,80,90]) });
});
it('preserves all 66 raw bytes for every byte value, status combination, and Up count', () => {
  for (let value = 0; value < 256; value++) {
    const source = sample(), dest = new BattleState(); dest.mem.fill(0x69);
    // Every field sees every possible byte, with distinct neighbours, including EXP FF:FF:FF.
    for (let i = 0; i < 44; i++) source.mem[A.wPartyMons + i] = value;
    for (let i = 0; i < 11; i++) { source.mem[A.wPartyMonOT + i] = value; source.mem[A.wPartyMonNicks + i] = 255 - value; }
    encodePartyMon(dest, 0, decodePartyMon(source, 0));
    expect(raw(dest)).toEqual(raw(source));
    for (const [at, length] of [[A.wPartyMons,44], [A.wPartyMonOT,11], [A.wPartyMonNicks,11]]) {
      expect(dest.mem[at - 1]).toBe(0x69); expect(dest.mem[at + length]).toBe(0x69);
    }
  }
  for (let slot = 0; slot < 6; slot++) {
    const s = sample(), r = decodePartyMon(s, 0); encodePartyMon(s, slot, r);
    expect(decodePartyMon(s, slot)).toEqual(r);
  }
  const source = sample(), r = decodePartyMon(source, 0), dest = new BattleState();
  encodePartyMon(dest, 0, r); expect(raw(dest)).toEqual(raw(source));
});
it('maps all 190 internal indices through the sole species table, retaining raw gaps and refusing live gaps', () => {
  expect(POKEDEX_ORDER).toHaveLength(190);
  const mon = createPokemon(32, 5, 'NIDORAN\u2642', { atk:9,def:8,spd:7,spc:6 })!;
  for (let internal = 1; internal <= 190; internal++) {
    const r = pokemonToPartyRecord(mon); r.species = internal;
    const s = new BattleState(); encodePartyMon(s,0,r); expect(decodePartyMon(s,0).species).toBe(internal);
    const dex = POKEDEX_ORDER[internal - 1];
    if (!dex) { expect(() => partyRecordToPokemon(r)).toThrow(BattleUnsupportedState); continue; }
    const live = partyRecordToPokemon(r);
    expect(live.species.id).toBe(dex); expect(pokemonToPartyRecord(live).species).toBe(internal);
  }
});
it('preserves live HP, stats, DVs, EXP, OT, moves, PP and each representable status', () => {
  const mon = createPokemon(32, 100, 'NIDORAN\u2642', { atk:9,def:8,spd:7,spc:6 })!;
  mon.currentHp = 65535; mon.maxHp = 65535; mon.attack = 0x1234; mon.defense = 0xabcd;
  mon.speed = 0x8001; mon.special = 65535; mon.otId = 0xffff; mon.otName = '\u00e9ASH';
  mon.exp = 0xffffff; mon.statExp = [65535,0x1234,0xabcd,1,0x8000];
  mon.moves = [{id:'TACKLE', pp:63, maxPp:56}];
  for (const status of [null, 'SLP', 'PSN', 'BRN', 'FRZ', 'PAR'] as const) {
    for (let sleep = 1; sleep <= 7; sleep++) {
      mon.status = status; mon.sleepTurns = status === 'SLP' ? sleep : 0;
      const r = pokemonToPartyRecord(mon), live = partyRecordToPokemon(r);
      expect(r.boxLevel).toBe(100); expect(r.dvs).toEqual([0x98,0x76]); expect(r.pp).toEqual([255,0,0,0]);
      expect(r.status).toBe(status === 'SLP' ? sleep : ({PSN:8,BRN:16,FRZ:32,PAR:64}[status!] ?? 0));
      for (const key of ['nickname','level','currentHp','maxHp','attack','defense','speed','special','otId','otName','exp','statExp','moves','status','sleepTurns','atkDV','defDV','spdDV','spcDV'] as const)
        expect(live[key], key).toEqual(mon[key]);
      expect(live.species).toBe(mon.species);
    }
  }
});
it('derives every move PP maximum for 0-3 Ups and refuses ambiguous or impossible maxima', () => {
  const expected: Record<number,number[]> = {5:[5,6,7,8],10:[10,12,14,16],15:[15,18,21,24],20:[20,24,28,32],
    25:[25,30,35,40],30:[30,36,42,48],35:[35,42,49,56],40:[40,47,54,61]};
  const mon = createPokemon(32,5,'PP',{atk:9,def:8,spd:7,spc:6})!;
  expect(getAllLoadedMoveIds()).toHaveLength(165);
  for (const id of getAllLoadedMoveIds()) for (let ups=0; ups<4; ups++) {
    const data = getMove(id)!, max = expected[data.pp][ups];
    expect(() => derivePPUps(data.pp,max), `${id} Up${ups}`).not.toThrow();
    expect(partyMaxPP(data.pp,ups)).toBe(max); expect(derivePPUps(data.pp,max)).toBe(ups);
    mon.moves = [{ id, pp: 1, maxPp:max }];
    const r = pokemonToPartyRecord(mon);
    expect(r.pp[0]).toBe((ups<<6)|1); expect(partyRecordToPokemon(r).moves).toEqual(mon.moves);
  }
  expect(() => derivePPUps(1,1)).toThrow('ambiguous or impossible');
  expect(() => derivePPUps(35,40)).toThrow('ambiguous or impossible');
  expect(() => derivePPUps(40,64)).toThrow('ambiguous or impossible');
});
it('round-trips every single glyph accepted by encodeText, with @ as the terminator', () => {
  let count = 0;
  for (let code = 0; code <= 0xffff; code++) {
    const glyph = String.fromCharCode(code);
    if (glyph !== ' ' && charToTile(glyph) < 0) continue;
    count++; expect(decodeBattleText(Uint8Array.from(encodeText(glyph+'@')),0), glyph).toBe(glyph);
  }
  expect(count).toBe(87);
  for (const name of ['NIDORAN\u2642','NIDORAN\u2640',"FARFETCH'D",'MR.MIME','Pok\u00e9'])
    expect(decodeBattleText(Uint8Array.from(encodeText(name+'@')),0)).toBe(name);
  expect(decodeBattleText(Uint8Array.from([0x80,0x50,0]),0)).toBe('A');
  expect(decodeBattleText(Uint8Array.from([0x80,0x81,0]),0,2)).toBe('AB');
  expect(() => decodeBattleText(Uint8Array.from([0]),0)).toThrow(new BattleUnsupportedState('NULL text control (TextIDErrorText not ported)'));
});
it('has no legacy decodeNick production import or caller left in the unused modules', () => {
  const offenders: string[] = [];
  for (const file of readdirSync(__dirname).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))) {
    const source = readFileSync(resolve(__dirname,file),'utf8').replace('export function decodeNick(', 'export function legacyCompatibility(');
    if (/\bdecodeNick\b/.test(source)) offenders.push(file);
  }
  expect(offenders).toEqual([]);
});
it('prints a Nidoran male party nickname through the real host actor as the male charmap tile', async () => {
  await loadTextPrograms(); await initTextSystem(); setTextSpeed('fast');
  textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  const mon = createPokemon(32,5,'NIDORAN\u2642',{atk:9,def:8,spd:7,spc:6})!;
  const state = new BattleState(); encodePartyMon(state,0,pokemonToPartyRecord(mon));
  const live = partyRecordToPokemon(decodePartyMon(state,0));
  state.mem.set(encodeText(live.nickname+'@'),A.wBattleMonNick); state.hWhoseTurn=0;
  const host = new BattleHost(state); host.start(host.printText('MonsStatsRoseText',{stringBuffer:'ATTACK'}));
  let pressed=false;
  for (let i=0; !host.done && i<1000; i++) {
    pressed=host.video.textBox.isWaitingForInput ? !pressed : false;
    vi.mocked(isHeld).mockImplementation(key=>pressed&&key==='b'); host.step();
  }
  expect(host.done).toBe(true);
  const row=Array.from({length:20},(_,x)=>host.video.screen.at(x,14));
  expect(row.slice(1,9)).toEqual(['N','I','D','O','R','A','N','\u2642']);
  expect(encodeText(row.slice(1,9).join(''))).toEqual([0x8d,0x88,0x83,0x8e,0x91,0x80,0x8d,0xef]);
  expect(row).not.toContain('?');
  expect(battleGlyphTile(String(row[8]))).toBe(0xef);
});

it('stops at @ before later valid glyphs in the bounded buffer', () => {
  expect(decodeBattleText(Uint8Array.from([0x80,0x50,0x81]),0,3)).toBe('A');
});
