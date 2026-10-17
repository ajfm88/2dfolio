import { beforeAll, describe, expect, it } from 'vitest';
import { createPokemon, loadBattleData } from './battle/data';
import { isStarterPikachuBoxed, pokemonToBoxed } from './pokemon_storage';
import type { SaveData } from './save';

beforeAll(loadBattleData);

describe('shared boxed Pokemon data', () => {
  it('keeps boxed HP, PP, DVs, status, experience, nickname and OT through save JSON serialization', () => {
    const mon = createPokemon('PIKACHU', 18, 'Sparky', { atk: 1, def: 2, spd: 3, spc: 4 })!;
    mon.currentHp = 7; mon.status = 'PSN'; mon.exp = 6000;
    mon.otName = 'RED'; mon.otId = 12345;
    mon.moves[0].pp = 1;
    const boxed = pokemonToBoxed(mon);
    const data = JSON.parse(JSON.stringify({ party: [boxed] })) as SaveData;
    expect(data.party[0]).toMatchObject({
      speciesName: 'Pikachu', nickname: 'Sparky', level: 18, currentHp: 7, maxHp: mon.maxHp,
      status: 'PSN', atkDV: 1, defDV: 2, spdDV: 3, spcDV: 4, exp: 6000, otName: 'RED', otId: 12345,
      moves: mon.moves,
    });
    mon.moves[0].pp = 0;
    expect(boxed.moves[0].pp).toBe(1);
    expect(boxed.nickname).toBe('Sparky');
  });

  it('uses species for the temporary starter test, independently of nickname or OT', () => {
    const pikachu = pokemonToBoxed(createPokemon('PIKACHU', 5, 'RATTATA')!);
    const rattata = pokemonToBoxed(createPokemon('RATTATA', 5, 'PIKACHU')!);
    expect(isStarterPikachuBoxed(pikachu)).toBe(true);
    expect(isStarterPikachuBoxed({ ...pikachu, otName: 'OTHER', otId: 54321 })).toBe(true);
    expect(isStarterPikachuBoxed(rattata)).toBe(false);
  });
});
