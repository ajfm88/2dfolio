// scripts/PewterGym.asm: PewterGymGuideText (V3 checkpoint-03a, notes/88-v3-plan.md §32), PewterGymBrockText (03b, §36),
// PewterGymBrockPostBattle and PewterGymScriptReceiveTM34 (05, §45).
import type { ScriptCommand } from '../script/types';
import type { TextHandlerContext } from './text_handlers';
import { registerTextHandler, displayTextID } from './text_handlers';
import { shouldPikachuFollow } from '../pikachu/pikachu_follower';
import { playMusic, stopMusic } from '../audio';
import { TRAINER_SCRIPT } from '../overworld/map_trainers';
import { setJoyIgnore } from '../input/joy_ignore';
import { TOGGLE } from '../overworld/toggleable_objects';

export const PEWTER_GYM = 'PewterGym';

const print = (program: string): ScriptCommand => ({ type: 'printText', program });

/**
 * PewterGymGuideText. wBeatGymFlags (BADGE_1) first; then YES/NO. Only YES reads BIT_PIKACHU_SPAWN_STARTER. The label
 * .PewterGymGuideBeginAdviceText is the NO branch, and prints FreeServiceText.
 */
export function pewterGymGuideText(ctx: TextHandlerContext): ScriptCommand[] {
  if (ctx.hasFlag('BADGE_1')) return displayTextID([print('PewterGymGuidePostBattleText')]);
  const advice = print('PewterGymGuideAdviceText');
  return displayTextID([print('PewterGymGuidePreAdviceText'), { type: 'yesNoChoice',
    yes: shouldPikachuFollow(ctx.party) ? [print('PewterGymGuyPikachuText')] : [print('PewterGymGuideBeginAdviceText'), advice],
    no: [print('PewterGymGuideFreeServiceText'), advice] }]);
}

/** .beforeBeat's SaveEndBattleTextPointers: the same text for a win and a loss. */
const BROCK_END_TEXT = 'PewterGymBrockReceivedBoulderBadgeText';

/**
 * PewterGymScriptReceiveTM34. Texts 4, 5 and 6 are plain DisplayTextID texts (PrintText_NoCreatingTextBox). Called from
 * PewterGymBrockText (nested) it runs inside his open DisplayTextID: the first inner opening finds the window up, and
 * the last inner close leaves the outer session open for its own Hold and close.
 */
function receiveTM34(nested: boolean): ScriptCommand[] {
  const text = (program: string): ScriptCommand => ({ type: 'printText', program, box: 'keep' });
  const last = (program: string, textId: number): ScriptCommand[] => nested
    ? [{ type: 'displayOpen', autoBox: true, spriteIndex: textId }, text(program), { type: 'displayCloseInPlace', outerWait: true }]
    : displayTextID([text(program)], { textId });
  return [
    { type: 'displayOpen', autoBox: true, spriteIndex: 4, ...(nested ? { windowUp: true } : {}) },
    text('PewterGymBrockWaitTakeThisText'),
    { type: 'displayClose', outerWait: true },
    { type: 'setFlag', flag: 'BEAT_BROCK' },
    { type: 'giveItem', itemId: 'TM34',
      successCommands: [...last('PewterGymReceivedTM34Text', 5), { type: 'setFlag', flag: 'GOT_TM34' }],
      failCommands: last('PewterGymTM34NoRoomText', 6) },
    { type: 'setFlag', flag: 'BADGE_1' }, // wObtainedBadges and wBeatGymFlags are this one flag here
    { type: 'hideObject', toggle: TOGGLE.GYM_GUY },
    { type: 'updateSprites', fontLoaded: false }, // HideObject's UpdateSprites
    { type: 'hideObject', toggle: TOGGLE.ROUTE_22_RIVAL_1 }, // Route 22's objects are I1
    { type: 'updateSprites', fontLoaded: false },
    { type: 'clearFlag', flag: '1ST_ROUTE22_RIVAL_BATTLE' },
    { type: 'clearFlag', flag: 'ROUTE22_RIVAL_WANTS_BATTLE' },
    { type: 'setTrainerBeaten', npcId: 'cooltrainer_m' }, // EVENT_BEAT_PEWTER_GYM_TRAINER_0
    { type: 'joyIgnore', mask: 'none' }, // PewterGymResetScripts
    { type: 'setMapScript', map: PEWTER_GYM, state: TRAINER_SCRIPT.DEFAULT },
  ];
}

/** PewterGymBrockPostBattle after a win. It returns into JoypadOverworld, so the same pass reads the joypad. */
export function pewterGymBrockPostBattle(): ScriptCommand[] {
  setJoyIgnore('dpad'); // PAD_CTRL_PAD
  return [...receiveTM34(false), { type: 'overworldLoop', resumeInput: true }];
}

/**
 * PewterGymBrockText. Beaten with TM34: his advice. Beaten without it (the bag was full): ReceiveTM34 again inside this
 * display, then DisableWaitingAfterTextDisplay, so the outer DisplayTextID holds and closes without a wait, with
 * BIT_FONT_LOADED clear. Not beaten: .beforeBeat. After its text, EngageMapTrainer's PlayTrainerMusic runs while
 * wGymLeaderNo is still 0, so the meet music plays (BROCK is on neither of its evil or female lists). Then
 * wGymLeaderNo = 1, the post-battle script, the outer wait and the close; OverworldLoop's wCurOpponent test starts the battle.
 */
export function pewterGymBrockText(ctx: TextHandlerContext): ScriptCommand[] {
  if (ctx.hasFlag('BEAT_BROCK')) {
    if (ctx.hasFlag('GOT_TM34')) return displayTextID([print('PewterGymBrockText.PostBattleAdviceText')]);
    return [{ type: 'displayOpen', autoBox: true }, ...receiveTM34(true), { type: 'displayClose', outerWait: false, reload: 'full' }];
  }
  return [...displayTextID([print('PewterGymBrockText.PreBattleText'),
    { type: 'callback', fn: () => { stopMusic(); playMusic('meetmaletrainer'); } },
    { type: 'setMapScript', map: PEWTER_GYM, state: TRAINER_SCRIPT.BROCK_POST_BATTLE }]),
    { type: 'startBattle', trainerClass: 'BROCK', partyIndex: 0, gymLeaderNo: 1, endBattleLabels: { win: BROCK_END_TEXT, lose: BROCK_END_TEXT } }];
}

registerTextHandler('PewterGym', 1, pewterGymBrockText);
registerTextHandler('PewterGym', 3, pewterGymGuideText);
