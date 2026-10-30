import { beforeAll, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { createPokemon, loadBattleData } from './data';
import { pokemonToPartyRecord, partyRecordToPokemon } from './battle_bridge';
beforeAll(loadBattleData);
it('item0 f: a dual-type Bulbasaur writes GRASS and POISON separately', () => {
  const mon = createPokemon(1,5,'BULBA',{atk:9,def:8,spd:7,spc:6})!;
  const r = pokemonToPartyRecord(mon);
  expect([r.type1,r.type2]).toEqual([0x16,0x03]);
});
it('item0 h: originalStats uses each of the four stored party words', () => {
  const mon = createPokemon(1,5,'BULBA',{atk:9,def:8,spd:7,spc:6})!;
  const r = pokemonToPartyRecord(mon);
  r.maxHp=65535; r.attack=0x1234; r.defense=0xabcd; r.speed=0x8001; r.special=0x4321;
  expect(partyRecordToPokemon(r).originalStats).toEqual({attack:0x1234,defense:0xabcd,speed:0x8001,special:0x4321});
});
