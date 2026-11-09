// Trainer battle flow — the rules of home/trainers.asm and the trainer branches of
// engine/battle/core.asm, kept free of canvas and audio so they can be unit-tested.
// Battle and main.ts turn these into states; nothing here draws or plays anything.

/** data/trainers/encounter_types.asm FemaleTrainerList */
const FEMALE_TRAINER_CLASSES: readonly string[] = ['LASS', 'JR_TRAINER_F', 'BEAUTY', 'COOLTRAINER_F'];

/** data/trainers/encounter_types.asm EvilTrainerList */
const EVIL_TRAINER_CLASSES: readonly string[] = [
  'UNUSED_JUGGLER', 'GAMBLER', 'ROCKER', 'JUGGLER', 'CHIEF', 'SCIENTIST', 'GIOVANNI', 'ROCKET',
];

const RIVAL_CLASSES: readonly string[] = ['RIVAL1', 'RIVAL2', 'RIVAL3'];

/**
 * The music EngageMapTrainer starts before a trainer battle, or null for none.
 * Assembly: PlayTrainerMusic — none for the three rival classes or when wGymLeaderNo
 * is set; the evil list is checked before the female list.
 */
export function meetMusicFor(trainerClass: string, isGymLeader = false): string | null {
  if (RIVAL_CLASSES.includes(trainerClass) || isGymLeader) return null;
  if (EVIL_TRAINER_CLASSES.includes(trainerClass)) return 'meeteviltrainer';
  if (FEMALE_TRAINER_CLASSES.includes(trainerClass)) return 'meetfemaletrainer';
  return 'meetmaletrainer';
}

/**
 * The fanfare TrainerBattleVictory plays once the whole enemy party is down.
 * Assembly: MUSIC_DEFEATED_GYM_LEADER for a gym leader or RIVAL3 (the final battle),
 * MUSIC_DEFEATED_TRAINER otherwise.
 */
export function victoryMusicFor(trainerClass: string, isGymLeader = false): string {
  return isGymLeader || trainerClass === 'RIVAL3' ? 'defeatedgymleader' : 'defeatedtrainer';
}

/** TrainerBattleVictory / HandlePlayerBlackOut: `ld c, 40; call DelayFrames` after the scroll. */
export const AFTER_PIC_SCROLL_DELAY = 40;

/** constants/pokemon_constants.asm RIVAL_STARTER_* (wRivalStarter). */
export const RIVAL_STARTER = { JOLTEON: 1, FLAREON: 2, VAPOREON: 3 } as const;

/** scripts/OaksLab.asm OaksLabRivalEndBattleScript: wBattleResult 0 → Flareon, else Vaporeon. */
export function rivalStarterAfterLabBattle(playerWon: boolean): number {
  return playerWon ? RIVAL_STARTER.FLAREON : RIVAL_STARTER.VAPOREON;
}
