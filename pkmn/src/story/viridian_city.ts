// Viridian City's map script — the old men and the Gym door
//
// Assembly: scripts/ViridianCity.asm, scripts/ViridianCity_2.asm. The map script
// dispatches on wViridianCityCurScript every frame. Only its resting states 0-2 can
// ever be saved (the others run with wJoyIgnore set), so they are the value kept in
// events.ts setMapScript; each transient chain is one command list below.
//
// Gen 1 quirk kept (DECISIONS #34): the Gym door's push-back moves the city to
// POST_CATCH_TRAINING from any state (ViridianCityCheckGymOpenScript →
// ..._PLAYER_MOVING_DOWN_POST_TRAINING), which turns the (19,9) old-man check off.

import type { ScriptCommand } from '../script';
import type { Direction } from '../core';
import { getText } from '../text/game_text';

export const VIRIDIAN_CITY = 'ViridianCity';

/** wViridianCityCurScript's resting values (SCRIPT_VIRIDIANCITY_*). */
export const ViridianScript = {
  DEFAULT: 0,
  AFTER_POKEDEX: 1,
  POST_CATCH_TRAINING: 2,
} as const;

// The gap beside the old man at (18,9) — ViridianCityCheckSleepingOldMan /
// ViridianCityCheckWaitingOldMan
const OLD_MAN_GAP = { x: 19, y: 9 };
// The step below the Gym door (32,7) — ViridianCityCheckGymOpenScript
const GYM_DOOR_STEP = { x: 32, y: 8 };

/** wObtainedBadges bit order: BADGE_1 = BOULDER … BADGE_8 = EARTH. */
const BADGES = ['BADGE_1', 'BADGE_2', 'BADGE_3', 'BADGE_4', 'BADGE_5', 'BADGE_6', 'BADGE_7', 'BADGE_8'];

export type ViridianTrigger = 'sleepingOldMan' | 'waitingOldMan' | 'gymLocked';

export interface ViridianStep {
  /** SetEvent EVENT_VIRIDIAN_GYM_OPEN this step. */
  openGym: boolean;
  /** The script that fires, if any. */
  trigger: ViridianTrigger | null;
}

/**
 * What the city's map script does with the player standing on step (x, y), for a
 * resting state. Facing is never read: every check compares wXCoord / wYCoord only.
 */
export function viridianCityStep(state: number, x: number, y: number, hasFlag: (flag: string) => boolean): ViridianStep {
  let openGym = false;
  let gymLocked = false;
  // ViridianCityCheckGymOpenScript, run by all three resting states
  if (!hasFlag('VIRIDIAN_GYM_OPEN')) {
    // cp ~(1 << BIT_EARTHBADGE): exactly the seven other badges
    if (BADGES.every((b, i) => hasFlag(b) === (i !== 7))) {
      openGym = true;
    } else if (x === GYM_DOOR_STEP.x && y === GYM_DOOR_STEP.y) {
      gymLocked = true;
    }
  }
  const atGap = x === OLD_MAN_GAP.x && y === OLD_MAN_GAP.y;

  let trigger: ViridianTrigger | null = null;
  if (state === ViridianScript.DEFAULT) {
    // ViridianCityDefaultScript: the Gym check, then ViridianCityCheckSleepingOldMan
    trigger = gymLocked ? 'gymLocked' : atGap ? 'sleepingOldMan' : null;
  } else if (state === ViridianScript.AFTER_POKEDEX) {
    // ViridianCityAfterPokedexScript: ViridianCityCheckWaitingOldMan, then falls
    // through into the Gym check
    if (atGap && !hasFlag('COMPLETED_CATCH_TRAINING')) trigger = 'waitingOldMan';
    else if (gymLocked) trigger = 'gymLocked';
  } else if (gymLocked) {
    trigger = 'gymLocked';
  }
  return { openGym, trigger };
}

/** The resting state for a save made before V1e, which has no map script states. */
export function initialViridianScript(hasFlag: (flag: string) => boolean): number {
  if (!hasFlag('GOT_POKEDEX')) return ViridianScript.DEFAULT;
  return hasFlag('COMPLETED_CATCH_TRAINING') ? ViridianScript.POST_CATCH_TRAINING : ViridianScript.AFTER_POKEDEX;
}

/** Which old man stands where, from the events that toggle them. The toggles only
 *  change inside input-locked scripts, so the events decide them exactly. */
export function viridianOldMenVisible(hasFlag: (flag: string) => boolean): Record<'oldman_blocking' | 'oldman2' | 'oldman1', boolean> {
  return {
    // TOGGLE_LYING_OLD_MAN: hidden when the Pokédex is given (OaksLab.asm)
    oldman_blocking: !hasFlag('GOT_POKEDEX'),
    // TOGGLE_OLD_MAN_2: shown with the Pokédex, hidden when he walks away
    // (ViridianCityOldManMovingDownScript) or by ViridianMartScript2
    oldman2: hasFlag('GOT_POKEDEX') && !hasFlag('COMPLETED_CATCH_TRAINING'),
    // TOGGLE_OLD_MAN_1: shown by ViridianMartScript2
    oldman1: hasFlag('SPAWNED_OLD_MAN_1'),
  };
}

/** ViridianMartScript2: on a Mart visit after the first demo, the walking old man
 *  replaces OLD_MAN2. Runs once the parcel is in hand (SCRIPT_VIRIDIANMART_SCRIPT2). */
export function martSpawnsOldMan(hasFlag: (flag: string) => boolean): boolean {
  return hasFlag('GOT_OAKS_PARCEL') && hasFlag('COMPLETED_CATCH_TRAINING') && !hasFlag('SPAWNED_OLD_MAN_1');
}

/**
 * The sleeping old man: "private property", then one simulated step down.
 * Stepping on (19,9) also sets the player facing down first
 * (ViridianCityCheckSleepingOldMan → ViridianCityMovePlayerDownScript); talking to
 * him runs the text handler's push alone (ViridianCityPrintOldManSleepyText).
 * State 5 (PLAYER_MOVING_DOWN) ends in DEFAULT after Delay3.
 */
export function buildSleepingOldManScript(fromTrigger: boolean): ScriptCommand[] {
  return [
    // (text/ViridianCity.asm _ViridianCityOldManSleepyPrivatePropertyText)
    { type: 'text', message: getText('VIRIDIAN_OLDMAN_PRIVATE_PROPERTY') },
    ...(fromTrigger ? [{ type: 'facePlayer', direction: 'down' } as ScriptCommand] : []),
    { type: 'pushPlayer', direction: 'down' },
    { type: 'wait', frames: 3 },
    { type: 'setMapScript', map: VIRIDIAN_CITY, state: ViridianScript.DEFAULT },
  ];
}

/** The locked Gym door: text, face down, one step down, then state 6 → 2. */
export function buildGymLockedScript(): ScriptCommand[] {
  return [
    // (text/ViridianCity.asm _ViridianCityGymLockedText)
    { type: 'text', message: getText('VIRIDIAN_GYM_LOCKED') },
    { type: 'facePlayer', direction: 'down' },
    { type: 'pushPlayer', direction: 'down' },
    { type: 'wait', frames: 3 },
    // ViridianCityPlayerMovingDownPostTrainingScript → SCRIPT_VIRIDIANCITY_POST_CATCH_TRAINING
    { type: 'setMapScript', map: VIRIDIAN_CITY, state: ViridianScript.POST_CATCH_TRAINING },
  ];
}

export interface StepPos { x: number; y: number }

/**
 * OLD_MAN2's first catch demo (ViridianCityOldMan2Text before
 * EVENT_COMPLETED_CATCH_TRAINING) through to his walk-away, states 7 → 8 → 9 → 10 → 2.
 * `fromTrigger`: stepping on (19,9) first turns him right and the player left
 * (ViridianCityCheckWaitingOldMan); talking to him needs no turn.
 */
export function buildOldMan2Script(fromTrigger: boolean, player: StepPos): ScriptCommand[] {
  const commands: ScriptCommand[] = [];
  if (fromTrigger) {
    commands.push(
      // SetSpriteFacingDirectionAndDelay: 6 frames
      { type: 'faceNpc', npcId: 'oldman2', direction: 'right' },
      { type: 'wait', frames: 6 },
      { type: 'facePlayer', direction: 'left' },
    );
  }
  commands.push(
    // (text/ViridianCity.asm _ViridianCityOldManHadMyCoffeeNowText), then DelayFrames 2
    { type: 'text', message: getText('VIRIDIAN_OLDMAN_COFFEE') },
    { type: 'wait', frames: 2 },
    // ViridianCityOldManInitialCatchTrainingScript: the ball fails (ItemUseBall $63)
    { type: 'setFlag', flag: 'INITIAL_CATCH_TRAINING' },
    { type: 'catchDemo', battleType: 'OLD_MAN', species: 'RATTATA', level: 5 },
    // ViridianCityOldManEndInitialCatchTrainingScript: Delay3, then the same text
    // pointer prints the losing-my-touch branch. EVENT_INITIAL_CATCH_TRAINING stays set.
    { type: 'wait', frames: 3 },
    { type: 'setFlag', flag: 'COMPLETED_CATCH_TRAINING' },
    // (text/ViridianCity.asm _ViridianCityOldManLosingMyTouchText)
    { type: 'text', message: getText('VIRIDIAN_OLDMAN_LOSING_TOUCH') },
  );
  // ViridianCityPostInitialCatchTraining: at x = 19 he walks down 6 (MovementData2);
  // elsewhere Pikachu steps aside and he walks right, then down 6 — MovementData1's
  // single RIGHT falls through into MovementData2.
  const down6: Direction[] = ['down', 'down', 'down', 'down', 'down', 'down'];
  if (player.x === OLD_MAN_GAP.x) {
    commands.push({ type: 'moveNpc', npcId: 'oldman2', path: down6 });
  } else {
    // ViridianCityMovePikachu: TryApplyPikachuMovementData with SPRITE_FACING_RIGHT, checked
    // when it runs (the demo and texts come between): $1d step down, $1f step left,
    // $38 look right (scripts/ViridianCity_2.asm)
    commands.push({ type: 'tryPikachuMovement', caller: 'viridianStepAside' });
    commands.push({ type: 'moveNpc', npcId: 'oldman2', path: ['right', ...down6] });
  }
  commands.push(
    // ViridianCityOldManMovingDownScript: HideObject TOGGLE_OLD_MAN_2
    { type: 'hideNpc', npcId: 'oldman2' },
    { type: 'setMapScript', map: VIRIDIAN_CITY, state: ViridianScript.POST_CATCH_TRAINING },
  );
  return commands;
}

/**
 * The walking old man (ViridianCityPrintOldManText): YES repeats the demo, which is
 * caught this time (states 3 → 4 → 2); NO ends it.
 */
export function buildOldMan1Script(): ScriptCommand[] {
  return [{
    type: 'yesNo',
    // (text/ViridianCity.asm _ViridianCityOldManWantMeToShowYouAgainText)
    message: getText('VIRIDIAN_OLDMAN_SHOW_AGAIN'),
    yesBranch: [
      // (text/ViridianCity.asm _ViridianCityOldManWatchCloselyText)
      { type: 'text', message: getText('VIRIDIAN_OLDMAN_WATCH_CLOSELY') },
      // ViridianCityOldManStartCatchTrainingScript: ResetEvent EVENT_INITIAL_CATCH_TRAINING
      { type: 'clearFlag', flag: 'INITIAL_CATCH_TRAINING' },
      { type: 'catchDemo', battleType: 'OLD_MAN', species: 'RATTATA', level: 5 },
      // ViridianCityOldManEndCatchTrainingScript
      { type: 'wait', frames: 3 },
      { type: 'setFlag', flag: 'COMPLETED_CATCH_TRAINING_AGAIN' },
      // (text/ViridianCity.asm _ViridianCityOldManYouNeedToWeakenTheTargetText)
      { type: 'text', message: getText('VIRIDIAN_OLDMAN_WEAKEN_TARGET') },
      { type: 'setMapScript', map: VIRIDIAN_CITY, state: ViridianScript.POST_CATCH_TRAINING },
    ],
    // (text/ViridianCity.asm _ViridianCityOldManNotGoodEnoughForYouText)
    noBranch: [{ type: 'text', message: getText('VIRIDIAN_OLDMAN_NOT_GOOD_ENOUGH') }],
  }];
}
