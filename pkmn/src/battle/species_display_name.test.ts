// V5e checkpoint-01 (note 95): GetMonName's table, MonsterNames, is the one source of every printed species name.
import { beforeAll, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createPokemon, getMonsterNames, getSpeciesById, loadBattleData, speciesDisplayName } from './data';
import { POKEDEX_ORDER } from './battle_state';
import { getTrainerSpeciesData, loadTrainerSpeciesData, monsterName } from './battle_trainer_data';

const file: (string | null)[] = JSON.parse(readFileSync('data/monster_names.json', 'utf8'));
beforeAll(() => loadBattleData());

it('names all 151 species from MonsterNames by internal id', () => {
  let count = 0;
  POKEDEX_ORDER.forEach((dex, i) => {
    if (!dex) return;
    count++;
    expect(speciesDisplayName({ id: dex }), `dex ${dex}`).toBe(file[i + 1]);
    expect(speciesDisplayName(getSpeciesById(dex)!)).toBe(file[i + 1]);
  });
  expect(count).toBe(151);
  expect([1, 25, 83, 151].map(id => speciesDisplayName({ id }))).toEqual(['BULBASAUR', 'PIKACHU', "FARFETCH'D", 'MEW']);
});

it('differs from the capitalised lookup key for exactly three species', () => {
  const different: [number, string, string][] = [];
  for (let dex = 1; dex <= 151; dex++) {
    const key = getSpeciesById(dex)!.name.toUpperCase(), name = speciesDisplayName({ id: dex });
    if (key !== name) different.push([dex, key, name]);
  }
  expect(different).toEqual([[29, 'NIDORAN-F', 'NIDORAN♀'], [32, 'NIDORAN-M', 'NIDORAN♂'], [122, 'MR. MIME', 'MR.MIME']]);
});

it('refuses a dex number with no species', () => {
  expect(() => speciesDisplayName({ id: 0 })).toThrow('monster name for dex 0');
  expect(() => speciesDisplayName({ id: 152 })).toThrow('monster name for dex 152');
});

it('holds one frozen copy of the table, which the battle tables share', async () => {
  const names = getMonsterNames();
  expect(names).toEqual(file);
  expect(names).toHaveLength(191);
  expect(names[0]).toBeNull();
  expect(Object.isFrozen(names)).toBe(true);
  await loadTrainerSpeciesData();
  expect(getTrainerSpeciesData().monsterNames).toBe(names);
  for (let id = 1; id <= 190; id++) expect(monsterName(id)).toBe(file[id]);
});

it('a second load fetches nothing', async () => {
  const fetches = vi.spyOn(globalThis, 'fetch');
  await loadBattleData();
  expect(fetches).not.toHaveBeenCalled();
  fetches.mockRestore();
});

// V5e checkpoint-02 (note 96). _AddPartyMon / AskName: a mon without a typed name holds MonsterNames' entry.
it("every species' default nickname is its MonsterNames entry; a given nickname is kept as given", () => {
  for (let dex = 1; dex <= 151; dex++) {
    expect(createPokemon(dex, 5)!.nickname, `dex ${dex}`).toBe(speciesDisplayName({ id: dex }));
    expect(createPokemon(getSpeciesById(dex)!.name, 5)!.nickname).toBe(speciesDisplayName({ id: dex }));
  }
  expect([29, 32, 122].map(dex => createPokemon(dex, 5)!.nickname)).toEqual(['NIDORAN♀', 'NIDORAN♂', 'MR.MIME']);
  expect(['Sparky', 'Nidoran-F', 'nidoran♀', ''].map(name => createPokemon(29, 5, name)!.nickname)).toEqual(['Sparky', 'Nidoran-F', 'nidoran♀', '']);
});
