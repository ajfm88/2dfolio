// Evolution system — checks and applies post-battle evolution
// Assembly: engine/pokemon/evos_moves.asm, engine/movie/evolution.asm

import type { BattlePokemon, PokemonSpecies } from './types';
import { getSpecies } from './data';

export interface EvolutionCandidate {
  pokemon: BattlePokemon;
  partyIndex: number;
  targetSpecies: PokemonSpecies;
}

/** Check all party Pokemon for pending level-based evolutions.
 *  (assembly: EvolutionAfterBattle — loops over party, checks level evolutions)
 *  Note: item-based evolutions (Thunder Stone, etc.) are NOT checked post-battle
 *  in Yellow (wForceEvolution=0), so Pikachu is naturally skipped. */
export function checkEvolutions(party: BattlePokemon[]): EvolutionCandidate[] {
  const candidates: EvolutionCandidate[] = [];

  for (let i = 0; i < party.length; i++) {
    const mon = party[i];
    if (mon.currentHp <= 0) continue; // fainted Pokemon don't evolve

    for (const evo of mon.species.evolutions) {
      if (evo.method === 'level' && mon.level >= evo.param) {
        const target = getSpecies(evo.to);
        if (target) {
          candidates.push({ pokemon: mon, partyIndex: i, targetSpecies: target });
          break; // only one evolution per Pokemon per check
        }
      }
    }
  }

  return candidates;
}

/** Apply evolution: change species, recalculate stats, update nickname if it
 *  matches the old species name.
 *  (assembly: Evolution_PartyMonLoop → updates species, calls CalcStats)
 *  HP delta is preserved: new maxHP - old maxHP is added to current HP. */
export function applyEvolution(pokemon: BattlePokemon, targetSpecies: PokemonSpecies): void {
  const oldMaxHp = pokemon.maxHp;
  const oldName = pokemon.species.name;

  pokemon.species = targetSpecies;

  // Recalculate stats for new species
  const hpDV = ((pokemon.atkDV & 1) << 3) | ((pokemon.defDV & 1) << 2) |
               ((pokemon.spdDV & 1) << 1) | (pokemon.spcDV & 1);
  pokemon.maxHp = calcHp(targetSpecies.hp, hpDV, pokemon.level);
  pokemon.attack = calcStat(targetSpecies.attack, pokemon.atkDV, pokemon.level);
  pokemon.defense = calcStat(targetSpecies.defense, pokemon.defDV, pokemon.level);
  pokemon.speed = calcStat(targetSpecies.speed, pokemon.spdDV, pokemon.level);
  pokemon.special = calcStat(targetSpecies.special, pokemon.spcDV, pokemon.level);

  // Preserve HP delta
  const hpGain = pokemon.maxHp - oldMaxHp;
  pokemon.currentHp = Math.min(pokemon.maxHp, Math.max(1, pokemon.currentHp + hpGain));

  // Auto-rename if nickname matches old species name (assembly: CheckForRenamedMon)
  if (pokemon.nickname.toUpperCase() === oldName.toUpperCase()) {
    pokemon.nickname = targetSpecies.name;
  }

  // Update originalStats snapshot
  pokemon.originalStats = {
    attack: pokemon.attack,
    defense: pokemon.defense,
    speed: pokemon.speed,
    special: pokemon.special,
  };
}

/** Get moves the evolved species learns at the current level that the Pokemon
 *  doesn't already know (for post-evolution move learning). */
export function getEvolutionMoves(pokemon: BattlePokemon): string[] {
  const newMoves: string[] = [];
  for (const lm of pokemon.species.learnset) {
    if (lm.level === pokemon.level && !pokemon.moves.some(m => m.id === lm.move)) {
      newMoves.push(lm.move);
    }
  }
  return newMoves;
}

// Stat formulas (same as data.ts and experience.ts)
function calcHp(base: number, dv: number, level: number): number {
  return Math.floor(((base + dv) * 2 * level) / 100) + level + 10;
}

function calcStat(base: number, dv: number, level: number): number {
  return Math.floor(((base + dv) * 2 * level) / 100) + 5;
}
