export { PikachuFollower, shouldPikachuFollow, isStarterPikachu } from './pikachu_follower';
export { getPikachuSpawnState, setPikachuSpawnState } from './pikachu_spawn';
export type { PikachuSpawnState } from './pikachu_spawn';
export { getPikachuFacePath, getPikachuAnimScript, modifyPikachuHappiness, resetPikachuHappiness, restorePikachuHappiness, getPikachuHappiness, getPikachuMood } from './pikachu_happiness';
export type { PikachuAnimScript, AnimFrame, OverlayInfo } from './pikachu_happiness';
export { startPikachuEmotion, updatePikachuEmotionAnim, renderPikachuEmotionBox, isPikachuEmotionActive, isPikachuEmotionExpired, clearPikachuEmotion, pikachuEmotionPhase, tickPikachuEmotionEntry } from './pikachu_emotion';
export { loadPikachuMovementData } from './pikachu_movement_data';
