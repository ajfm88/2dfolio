export { GameMap } from './map';
export { Player } from './player';
export { Npc, loadNpcs } from './npc';
// Pikachu modules moved to src/pikachu/ — re-export for backward compat
export { PikachuFollower, shouldPikachuFollow } from '../pikachu/pikachu_follower';
export { getPikachuFacePath, getPikachuAnimScript, modifyPikachuHappiness, resetPikachuHappiness, restorePikachuHappiness, getPikachuHappiness, getPikachuMood } from '../pikachu/pikachu_happiness';
export type { PikachuAnimScript, AnimFrame, OverlayInfo } from '../pikachu/pikachu_happiness';
// Story state
export { applyDefeatedTrainers, applyStoryNpcState, recordDefeated } from './story_state';
// Battle transitions
export { startSpiralTransition, startWildTransition, updateBattleTransition, renderBattleTransitionOverlay } from './battle_transitions';
// Map transitions
export { performWarpLoad, performMapConnection } from './map_transitions';
export type { WarpLoadResult } from './map_transitions';
// Overworld controller
export { updateOverworld, createOverworldState } from './overworld_controller';
export type { OverworldAction, OverworldState, OverworldDeps } from './overworld_controller';
