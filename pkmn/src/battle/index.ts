export { loadBattleData, createPokemon, getWildData } from './data';
export { initBattleUI, loadPokemonSprites, renderBattleText, createSilhouette } from './battle_ui';
export { loadWildEncounters, tryWildEncounter } from './encounter';
export { initExperience, expToNextLevel, totalExpForLevel } from './experience';
export { loadTrainerData, getTrainerClass } from './trainer_ai';
export type { TrainerClassData, TrainerPartyMember } from './trainer_ai';
export type { BattlePokemon, BattleState, PokemonSpecies, MoveData } from './types';
export { checkEvolutions, applyEvolution, getEvolutionMoves } from './evolution';
export type { EvolutionCandidate } from './evolution';
