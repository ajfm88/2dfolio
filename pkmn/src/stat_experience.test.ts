import { beforeAll, afterEach, expect, it, vi } from 'vitest';
vi.mock('./battle', async () => {
  const data = await import('./battle/data'); const experience = await import('./battle/experience');
  return { createPokemon: data.createPokemon, initExperience: experience.initExperience };
});
import { createPokemon, loadBattleData } from './battle/data';
import { applyEvolution, checkEvolutions } from './battle/evolution';
import { pokemonToBoxed } from './pokemon_storage';
import { loadGame, restoreParty, saveGame, type SaveData } from './save';
import { Bag } from './items';
import { A, BattleState, decodeNick, encodeText, NAME_LENGTH, PARTYMON_STRUCT_LENGTH } from './battle/battle_state';
import { mirrorPartyProgress, partySlotFromPokemon, writePartySlot, loadBattleMonFromParty } from './battle/battle_loaders';

beforeAll(loadBattleData);
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function mon() { return createPokemon('PIKACHU', 10, 'SPARK', { atk: 9, def: 8, spd: 7, spc: 6 })!; }
function oldSave(): SaveData {
  const boxed = pokemonToBoxed(mon()); delete boxed.statExp; boxed.exp = 1234;
  return { version: 1, mapName: 'PalletTown', playerX: 0, playerY: 0, playerDirection: 'down',
    party: [{ ...boxed }, { ...boxed }], bag: [], money: 3000, defeatedTrainers: [] };
}

it('fresh Pokemon and old-save members each own independent zero stat-exp arrays', () => {
  const a = mon(), b = mon(); a.statExp[0] = 99;
  expect(b.statExp).toEqual([0, 0, 0, 0, 0]);
  const old = oldSave(); const party = restoreParty(old);
  expect(party.map(p => p.statExp)).toEqual([[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]]);
  expect(party.map(p => p.exp)).toEqual([1000, 1000]); // The live EXP reset is deliberately preserved.
  party[0].statExp[0] = 65535;
  expect(party[1].statExp).toEqual([0, 0, 0, 0, 0]); expect(old.party[0].statExp).toBeUndefined();
});

it('evolution retains the existing stat-exp tuple and the live b=0 stat calculation', () => {
  const dvs = { atk: 9, def: 8, spd: 7, spc: 6 };
  const trained = createPokemon('PIDGEY', 18, undefined, dvs)!, zero = createPokemon('PIDGEY', 18, undefined, dvs)!;
  const words = trained.statExp = [65535, 63002, 64517, 256, 1];
  const target = checkEvolutions([trained])[0].targetSpecies;
  applyEvolution(trained, target); applyEvolution(zero, target);
  expect(trained.statExp).toBe(words); expect(trained.statExp).toEqual([65535, 63002, 64517, 256, 1]);
  expect([trained.maxHp, trained.attack, trained.defense, trained.speed, trained.special])
    .toEqual([zero.maxHp, zero.attack, zero.defense, zero.speed, zero.special]);
});

it('deposit and save serialize copies; load preserves five words but still resets partial EXP', () => {
  const original = mon(); original.statExp = [1, 256, 63002, 64517, 65535]; original.exp = 1234;
  original.attack = 999; original.speed = 1; // These transient stats must not enter the save.
  const box = pokemonToBoxed(original);
  expect(box.statExp).not.toBe(original.statExp); expect(box.statExp).toEqual(original.statExp);
  original.statExp[0] = 99; expect(box.statExp![0]).toBe(1);
  const stored = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => { stored.set(key, value); } });
  const stringify = vi.spyOn(JSON, 'stringify');
  saveGame('PalletTown', 16, 32, 'down', [original], new Bag(), 3000, new Set());
  const serialized = stringify.mock.calls[0][0] as SaveData;
  expect(serialized.party[0].statExp).not.toBe(original.statExp);
  expect(serialized.party[0]).not.toHaveProperty('attack'); expect(serialized.party[0]).not.toHaveProperty('maxHp');
  original.statExp[1] = 777;
  expect(serialized.party[0].statExp).toEqual([99, 256, 63002, 64517, 65535]);
  const saved = loadGame()!; const restored = restoreParty(saved)[0];
  expect(restored.statExp).toEqual([99, 256, 63002, 64517, 65535]);
  expect(restored.statExp).not.toBe(saved.party[0].statExp);
  expect(restored.exp).toBe(1000); expect(restored.attack).toBe(mon().attack); expect(restored.speed).toBe(mon().speed);
  restored.statExp[2] = 0; expect(saved.party[0].statExp![2]).toBe(63002);
});

it.each(['player', 'enemy'] as const)('packs %s identity, 24-bit EXP and five BE words without leaking them into battle data', side => {
  const s = new BattleState(); const pokemon = mon();
  pokemon.otId = 0x1234; pokemon.otName = 'ASH'; pokemon.exp = 0xabcdef;
  pokemon.statExp = [0, 0x123, 0x4567, 63002, 65535];
  const slot = partySlotFromPokemon(pokemon);
  expect(slot.statExp).not.toBe(pokemon.statExp);
  const index = 2; const base = (side === 'player' ? A.wPartyMons : A.wEnemyMons) + index * PARTYMON_STRUCT_LENGTH;
  const ot = (side === 'player' ? A.wPartyMonOT : A.wEnemyMonOT) + index * NAME_LENGTH;
  s.mem[base - 1] = 0xa5; s.mem[base + 44] = 0x5a;
  s.mem[ot - 1] = 0xa6; s.mem[ot + NAME_LENGTH] = 0x6a;
  writePartySlot(s, side, index, slot);
  expect([...s.mem.slice(base + 12, base + 27)]).toEqual([
    0x12, 0x34, 0xab, 0xcd, 0xef, 0, 0, 1, 0x23, 0x45, 0x67, 0xf6, 0x1a, 0xff, 0xff,
  ]);
  expect(decodeNick(s.mem, ot)).toBe('ASH');
  expect([s.mem[base - 1], s.mem[base + 44], s.mem[ot - 1], s.mem[ot + NAME_LENGTH]])
    .toEqual([0xa5, 0x5a, 0xa6, 0x6a]);
  if (side === 'player') {
    s.species = () => ({ name: 'PIKACHU', base: [35, 55, 40, 90, 50], type1: 23, type2: 23,
      catchRate: 190, baseExp: 82, moves: [84, 45, 0, 0], learnset: [] });
    s.wWhichPokemon = s.wPlayerMonNumber = index; s.wBattleMonSpecies2 = slot.species;
    loadBattleMonFromParty(s);
    expect([...s.mem.slice(A.wBattleMonDVs, A.wBattleMonDVs + 2)]).toEqual([0x98, 0x76]);
    expect(s.bytes(A.wBattleMonMoves, 4).slice()).toEqual(slot.moves);
    expect(s.wBattleMonLevel).toBe(10); expect(s.wBattleMonHP).toBe(pokemon.currentHp);
  }
});

it('progress mirrors follow raw byte writes, for only the selected player slot, without changing live stats', () => {
  const s = new BattleState(); const a = mon(), b = mon(); s.partyMons[0] = a; s.partyMons[1] = b;
  const packed = partySlotFromPokemon(a); packed.exp = 0x010203; packed.otId = 0xabcd; packed.otName = 'BLUE';
  packed.statExp = [1, 2, 3, 4, 5]; writePartySlot(s, 'player', 0, packed);
  expect([a.exp, a.otId, a.otName, a.statExp]).toEqual([0x010203, 0xabcd, 'BLUE', [1, 2, 3, 4, 5]]);
  s.writeBE(A.wPartyMons + 17, 65535); s.mem[A.wPartyMons + 14] = 0xfe;
  s.writeBE(A.wPartyMons + 15, 0xdcba); s.setBytes(A.wPartyMonOT, encodeText('RED@'), NAME_LENGTH);
  const before = s.mem.slice(), oldStats = [a.maxHp, a.attack, a.defense, a.speed, a.special];
  mirrorPartyProgress(s, 0);
  expect(s.mem).toEqual(before);
  expect(a.statExp).toEqual([65535, 2, 3, 4, 5]); expect(a.exp).toBe(0xfedcba); expect(a.otName).toBe('RED');
  expect([a.maxHp, a.attack, a.defense, a.speed, a.special]).toEqual(oldStats);
  expect(b.statExp).toEqual([0, 0, 0, 0, 0]); expect(a.statExp).not.toBe(packed.statExp);
  writePartySlot(s, 'enemy', 0, packed); expect(a.exp).toBe(0xfedcba);
  expect(() => mirrorPartyProgress(s, 5)).not.toThrow();
});
