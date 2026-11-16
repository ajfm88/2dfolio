import { describe, it, expect, beforeAll, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis,{window:{addEventListener(){}}}));
import { loadTrainerSpeciesData } from './battle_trainer_data';
import { loadBattleBridgeData } from './battle_bridge';
import { checkEvolutions, applyEvolution, getEvolutionMoves } from './evolution';
import { loadBattleData, createPokemon } from './data';

beforeAll(async () => {
  await loadBattleData(); await loadTrainerSpeciesData(); await loadBattleBridgeData();
});

describe('checkEvolutions', () => {
  it('detects level-based evolution when level is met', () => {
    // Pidgey evolves at level 18 to Pidgeotto
    const pidgey = createPokemon('PIDGEY', 18)!;
    const candidates = checkEvolutions([pidgey]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].targetSpecies.name.toUpperCase()).toBe('PIDGEOTTO');
    expect(candidates[0].partyIndex).toBe(0);
  });

  it('does not trigger evolution below required level', () => {
    const pidgey = createPokemon('PIDGEY', 17)!;
    const candidates = checkEvolutions([pidgey]);
    expect(candidates).toHaveLength(0);
  });

  it('Pikachu has no level-based evolution (Thunder Stone only)', () => {
    const pikachu = createPokemon('PIKACHU', 99)!;
    const candidates = checkEvolutions([pikachu]);
    expect(candidates).toHaveLength(0);
  });

  it('fainted Pokemon do not evolve', () => {
    const pidgey = createPokemon('PIDGEY', 18)!;
    pidgey.currentHp = 0;
    const candidates = checkEvolutions([pidgey]);
    expect(candidates).toHaveLength(0);
  });

  it('multiple party members can evolve', () => {
    const pidgey = createPokemon('PIDGEY', 18)!;
    const caterpie = createPokemon('CATERPIE', 7)!; // evolves at 7 to Metapod
    const candidates = checkEvolutions([pidgey, caterpie]);
    expect(candidates).toHaveLength(2);
  });
});

describe('applyEvolution', () => {
  it('changes species and recalculates stats', () => {
    const pidgey = createPokemon('PIDGEY', 18)!;
    const oldMaxHp = pidgey.maxHp;
    const oldAttack = pidgey.attack;
    const targetSpecies = checkEvolutions([pidgey])[0].targetSpecies;

    applyEvolution(pidgey, targetSpecies);

    expect(pidgey.species.name.toUpperCase()).toBe('PIDGEOTTO');
    // Pidgeotto has higher base stats, so stats should increase
    expect(pidgey.maxHp).toBeGreaterThanOrEqual(oldMaxHp);
    expect(pidgey.attack).toBeGreaterThanOrEqual(oldAttack);
  });

  it('preserves HP delta (current HP increases by maxHP gain)', () => {
    const pidgey = createPokemon('PIDGEY', 18)!;
    const oldMaxHp = pidgey.maxHp;
    pidgey.currentHp = oldMaxHp - 10; // 10 HP below max
    const targetSpecies = checkEvolutions([pidgey])[0].targetSpecies;

    applyEvolution(pidgey, targetSpecies);

    // Should still be ~10 HP below new max
    const hpGain = pidgey.maxHp - oldMaxHp;
    expect(pidgey.currentHp).toBe(oldMaxHp - 10 + hpGain);
  });

  it('auto-renames if nickname matches old species name', () => {
    const pidgey = createPokemon('PIDGEY', 18)!;
    expect(pidgey.nickname).toBe('PIDGEY'); // the default nickname is MonsterNames' entry
    const targetSpecies = checkEvolutions([pidgey])[0].targetSpecies;

    applyEvolution(pidgey, targetSpecies);

    expect(pidgey.nickname).toBe('PIDGEOTTO');
  });

  // V5e checkpoint-02. RenameEvolvedMon (evos_moves.asm:264-290) compares the nickname with the old
  // species' MonsterNames entry byte for byte, up to and including '@'.
  it.each(['Pidgey', 'pidgey', 'PIDGE', 'PIDGEYS', 'PIDGEOTTO'])('keeps the typed nickname %s on evolution', typed => {
    const pidgey = createPokemon('PIDGEY', 18, typed)!;
    applyEvolution(pidgey, checkEvolutions([pidgey])[0].targetSpecies);
    expect(pidgey.nickname).toBe(typed);
    expect(pidgey.species.id).toBe(17);
  });

  it.each([[29, 16, 'NIDORAN♀', 'NIDORINA'], [32, 16, 'NIDORAN♂', 'NIDORINO'], [10, 7, 'CATERPIE', 'METAPOD']] as const)(
    'dex %i at level %i goes from %s to %s', (dex, level, before, after) => {
      const mon = createPokemon(dex, level)!;
      expect(mon.nickname).toBe(before);
      applyEvolution(mon, checkEvolutions([mon])[0].targetSpecies);
      expect(mon.nickname).toBe(after);
    });

  it('keeps custom nickname on evolution', () => {
    const pidgey = createPokemon('PIDGEY', 18, 'BIRDY')!;
    const targetSpecies = checkEvolutions([pidgey])[0].targetSpecies;

    applyEvolution(pidgey, targetSpecies);

    expect(pidgey.nickname).toBe('BIRDY');
    expect(pidgey.species.name.toUpperCase()).toBe('PIDGEOTTO');
  });
});

describe('getEvolutionMoves', () => {
  it('returns moves the evolved species learns at current level', () => {
    // This is data-dependent, so we just verify the function runs correctly
    const pidgey = createPokemon('PIDGEY', 18)!;
    const targetSpecies = checkEvolutions([pidgey])[0].targetSpecies;
    applyEvolution(pidgey, targetSpecies);
    // getEvolutionMoves checks the new species learnset at current level
    const moves = getEvolutionMoves(pidgey);
    expect(Array.isArray(moves)).toBe(true);
  });
});
