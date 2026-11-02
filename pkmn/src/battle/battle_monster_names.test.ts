import { afterEach, beforeAll, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} } }));
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { A, BattleState, POKEDEX_ORDER } from './battle_state';
import { createPokemon } from './data';
import { loadTrainerSpeciesData, monsterName } from './battle_trainer_data';
import { installTrainerSpecies, speciesInternalId } from './battle_trainer_party';
import { getMonName } from './battle_loaders';
import { decodeBoxMon, decodePartyMon, nameBytes, writeBattleInputs } from './battle_bridge';
import { pokemonToBoxed } from '../pokemon_storage';
import { battleWorld } from '../test/battle_world_fixture';
import { rig, musicData } from '../test/audio_rig';
import { PlaySound } from '../audio/play_sound';
import { engineHost } from '../audio/request_host';
import { musicIdentity, musicNameForSound } from '../audio/sound_ids';
import { createBattleSession, createSessionRandom, loadBattleSessionData } from './battle_session';
import { setKey, updateInput, syncJoypadRead } from '../input';
import { loadTextPrograms } from '../text/program_data';
import type { GameButton } from '../core';

const keys: GameButton[] = ['a','b','up','down','left','right','start','select'];
const fetches = new Map<string, number>();
beforeAll(async () => {
  await loadTextPrograms();
  const fetchData = globalThis.fetch;
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
    const name = String(url); fetches.set(name, (fetches.get(name) ?? 0) + 1);
    return fetchData(url, init);
  });
  try {
    await loadBattleSessionData(async file => {
      const p = PNG.sync.read(readFileSync('static/' + file));
      return { width:p.width, height:p.height, data:p.data };
    });
  } finally { spy.mockRestore(); }
});
afterEach(() => vi.restoreAllMocks());

it('all 151 headers use MonsterNames, while pret Nidoran keys retain distinct ids', () => {
  const names = JSON.parse(readFileSync('data/monster_names.json', 'utf8'));
  const state = new BattleState(); expect(() => installTrainerSpecies(state)).not.toThrow();
  let count = 0;
  POKEDEX_ORDER.forEach((dex, i) => {
    if (!dex) return;
    count++; expect(state.species(i + 1).name, `internal ${i + 1}`).toBe(names[i + 1]);
  });
  expect(count).toBe(151);
  expect(() => speciesInternalId('NIDORAN_F')).not.toThrow();
  expect(() => speciesInternalId('NIDORAN_M')).not.toThrow();
  expect(speciesInternalId('NIDORAN_F')).toBe(15);
  expect(speciesInternalId('NIDORAN_M')).toBe(3);
  getMonName(state, state.species(15));
  expect([...state.mem.slice(A.wNameBuffer, A.wNameBuffer + 11)])
    .toEqual([0x8d,0x88,0x83,0x8e,0x91,0x80,0x8d,0xf5,0x50,0x50,0x50]);
  getMonName(state, state.species(42));
  expect([...state.mem.slice(A.wNameBuffer, A.wNameBuffer + 11)])
    .toEqual([0x8c,0x91,0xe8,0x8c,0x88,0x8c,0x84,0x50,0x50,0x50,0x50]);
});

it('maps default party and box names forward, preserves real nicknames and leaves the world unchanged', () => {
  const pikachu = createPokemon(25,20)!;
  const nidoran = createPokemon(29,20)!;
  const sparky = createPokemon(25,20,'Sparky')!;
  const caps = createPokemon(25,20,'PIKACHU')!;
  expect(pikachu.nickname).toBe('Pikachu');
  const world = battleWorld({party:[pikachu,nidoran,sparky,caps], pcBoxes:[[pokemonToBoxed(nidoran),pokemonToBoxed(sparky)]]});
  const before = structuredClone(world);
  const state = new BattleState(); writeBattleInputs(state,world);
  expect([...decodePartyMon(state,0).nickname]).toEqual([0x8f,0x88,0x8a,0x80,0x82,0x87,0x94,0x50,0x50,0x50,0x50]);
  expect(decodePartyMon(state,1).nickname).toEqual(nameBytes('NIDORAN♀'));
  expect(decodePartyMon(state,1).nickname[7]).toBe(0xf5);
  expect(decodeBoxMon(state,0).nickname).toEqual(nameBytes('NIDORAN♀'));
  expect(decodePartyMon(state,2).nickname).toEqual(nameBytes('Sparky'));
  expect(decodeBoxMon(state,1).nickname).toEqual(nameBytes('Sparky'));
  expect(decodePartyMon(state,3).nickname).toEqual(decodePartyMon(state,0).nickname);
  expect(world).toEqual(before);
});

it('the production Route1 session prints Wild RATTATA and Go! PIKACHU! for a default-named starter', () => {
  keys.forEach(k => setKey(k,false)); updateInput(); syncJoypadRead();
  const r = rig(); let time = 0;
  const banks = new PlaySound(engineHost(r.synth,r.music,r.sfx,(id,bank) => r.music.play(musicData(musicNameForSound(id,bank)!))));
  const mon = createPokemon(25,20,undefined,{atk:9,def:8,spd:8,spc:8})!;
  mon.moves = [{id:'TACKLE',pp:35,maxPp:35}];
  const session = createBattleSession(battleWorld({party:[mon]}), {
    random:createSessionRandom(() => time), audio:() => ({sfx:r.sfx,music:r.music,banks}),
  });
  const rows: string[] = [];
  banks.playMusic(musicIdentity('wildbattle')!); session.start();
  for (; !session.done && time < 6000; time++) {
    keys.forEach(k => setKey(k, time % 2 === 0 && k === (session.video.textBox.isWaitingForInput ? 'b' : 'a')));
    updateInput(); r.update(); session.tick();
    for (let y = 14; y < 18; y++) rows.push(session.screen.cells.slice(y*20,(y+1)*20).map(c => typeof c === 'string' ? c : ' ').join(''));
  }
  expect(session.done).toBe(true);
  expect(rows.some(row => row.includes('Wild RATTATA'))).toBe(true);
  expect(rows.some(row => row.includes('Go! PIKACHU!'))).toBe(true);
  session.finish();
});

it('fetches MonsterNames once and refuses missing entries by name', async () => {
  expect(fetches.get('monster_names.json')).toBe(1);
  const spy = vi.spyOn(globalThis,'fetch');
  await loadTrainerSpeciesData(); await loadTrainerSpeciesData();
  expect(spy).not.toHaveBeenCalled();
  expect(() => monsterName(0)).toThrow('monster name 0');
  expect(() => monsterName(191)).toThrow('monster name 191');
});

it('names an HTTP failure for MonsterNames', async () => {
  vi.resetModules();
  const fetchData = globalThis.fetch;
  vi.spyOn(globalThis,'fetch').mockImplementation((url,init) => String(url) === 'monster_names.json'
    ? Promise.resolve({ok:false,status:404} as Response) : fetchData(url,init));
  const fresh = await import('./battle_trainer_data');
  await expect(fresh.loadTrainerSpeciesData()).rejects.toThrow('monster names: HTTP 404');
});
