// Evolution system — checks and applies post-battle evolution
// Assembly: engine/pokemon/evos_moves.asm, engine/movie/evolution.asm

import type { BattlePokemon, PokemonSpecies } from './types';
import { getSpecies } from './data';
import { A, BattleState } from './battle_state';
import { worldPartyRecord } from './battle_bridge';
import { encodePartyMon, decodePartyMon } from './battle_party_codec';
import { installTrainerSpecies } from './battle_trainer_party';
import { getMonHeader } from './battle_loaders';
import { calcStats } from './battle_calc_stats';

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

  // evos_moves.asm:176–207: CalcStats b=1 with the evolved species' header.
  const state = new BattleState(); installTrainerSpecies(state);
  const record = worldPartyRecord(pokemon); encodePartyMon(state,0,record);
  getMonHeader(state,record.species); state.wCurEnemyLevel = pokemon.level;
  calcStats(state,1,A.wPartyMons+16,A.wPartyMons+34);
  const stats = decodePartyMon(state,0);
  pokemon.maxHp = stats.maxHp; pokemon.attack = stats.attack; pokemon.defense = stats.defense;
  pokemon.speed = stats.speed; pokemon.special = stats.special;

  // Preserve HP delta
  const hpGain = pokemon.maxHp - oldMaxHp;
  pokemon.currentHp = (pokemon.currentHp + hpGain) & 0xffff;

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
