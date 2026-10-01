// Oak's Lab story scripts — getting starter Pikachu (Yellow version)
// + Parcel delivery & Pokédex scene

import type { ScriptCommand } from '../script';
import type { Direction } from '../core';
import { getRivalName, substituteNames } from '../core/player_state';
import { getText } from '../text';

/**
 * Build the Oak's Lab intro cutscene.
 * Trigger: player enters lab after FOLLOWED_OAK_INTO_LAB but before GOT_STARTER.
 *
 * Assembly flow (scripts/OaksLab.asm):
 * 1. OAK2 (5,10) appears near door, walks UP 3 → hidden
 * 2. OAK1 (5,2) appears at desk
 * 3. Rival + Oak face DOWN; player walks UP 8 from door
 * 4. Rival: "Gramps! I'm fed up with waiting!"
 * 5. Oak's choose-mon speech
 * 6. Rival: "What about me?" / Oak: "Be patient"
 * 7. Rival snatches Eevee ball, Oak gives player Pikachu
 * 8. Oak's advice
 */
/**
 * Build the awaiting-ball-interaction script (for save reload).
 * Used when OAK_ASKED_TO_CHOOSE_MON is set but GOT_STARTER is not.
 * Gives player free movement with guard, then triggers rival snatching.
 */
export function buildOaksLabAwaitBallScript(): ScriptCommand[] {
  return [
    { type: 'awaitInteraction', npcId: 'item_ball', guardStepY: 6,
      guardText: getText('LAB_OAK_DONT_GO') },
    ...buildOaksLabBallScript(),
  ];
}

/**
 * Build the rival-snatches-ball script (from ball interaction in overworld).
 * Used when player interacts with eevee_ball during OAK_ASKED_TO_CHOOSE_MON state.
 */
export function buildOaksLabBallScript(): ScriptCommand[] {
  return [
    // Rival reacts — exclamation bubble only, no text (assembly: OaksLabRivalExclamationScript)
    { type: 'exclamation', target: 'rival', frames: 30 },
    // Assembly: rival walks D,R,R,R — player pushed RIGHT 2 on the last R
    // (.RivalPushesPlayerAwayFromEeveeBall: wNPCNumScriptedSteps==1 triggers push)
    { type: 'moveNpc', npcId: 'rival', path: ['down', 'right', 'right'] as Direction[] },
    { type: 'moveParallel', npcId: 'rival',
      npcPath: ['right'] as Direction[],
      playerPath: ['right', 'right'] as Direction[] },
    { type: 'hideNpc', npcId: 'item_ball' },
    // Rival faces up, then OaksLabRivalReceivedMonText shows all 5 texts
    { type: 'faceNpc', npcId: 'rival', direction: 'up' },
    // (text/OaksLab.asm _OaksLabRivalTakesText1)
    { type: 'text', message: substituteNames(getText('LAB_RIVAL_NO_WAY')) },
    // (text/OaksLab.asm _OaksLabRivalTakesText2)
    { type: 'text', message: substituteNames(getText('LAB_RIVAL_SNATCHED')) },
    // (text/OaksLab.asm _OaksLabRivalTakesText3)
    { type: 'text', message: substituteNames(getText('LAB_OAK_WHAT_DOING')) },
    // (text/OaksLab.asm _OaksLabRivalTakesText4)
    { type: 'text', message: substituteNames(getText('LAB_RIVAL_WANTS_THIS')) },
    { type: 'text', message: substituteNames(getText('LAB_OAK_ALL_RIGHT')) },

    // --- Player walks to Oak (OaksLabPlayerWalksToOakScript) ---
    // Assembly RLE: LEFT 1, DOWN 1, LEFT 3, UP 2
    { type: 'movePlayer', path: ['left', 'down', 'left', 'left', 'left', 'up', 'up'] as Direction[] },

    // --- Player receives Pikachu (OaksLabPlayerReceivesPikachuScript) ---
    { type: 'text', message: substituteNames(getText('LAB_OAK_GIVES_PIKACHU')) },
    { type: 'addPokemon', species: 25, level: 5 },
    { type: 'text', message: substituteNames(getText('LAB_RECEIVED_PIKACHU')) },
    { type: 'setFlag', flag: 'GOT_STARTER' },

    // --- Oak's advice ---
    { type: 'wait', frames: 15 },
    { type: 'faceNpc', npcId: 'prof', direction: 'down' },
    { type: 'text', message: getText('LAB_OAK_ADVICE') },
  ];
}

/**
 * Build the rival battle script (OaksLabRivalChallengesPlayerScript).
 * Trigger: player reaches step Y=6 after GOT_STARTER but before BATTLED_RIVAL_IN_OAKS_LAB.
 *
 * Assembly flow:
 * 1. Rival says "Wait RED! Let's check out our POKéMON!"
 * 2. Rival walks toward the player (dynamic path)
 * 3. Battle: RIVAL1 party 0 (Eevee Lv5)
 * 4. After battle: heal party, "Smell you later!", rival walks out
 */
export function buildOaksLabRivalBattleScript(
  rivalStepX: number, rivalStepY: number,
  playerStepX: number, playerStepY: number,
  onPikachuEscapes?: () => void,
): ScriptCommand[] {
  // Compute path from rival to one step above player (stop adjacent)
  const path: Direction[] = [];
  let cx = rivalStepX;
  let cy = rivalStepY;
  const targetX = playerStepX;
  const targetY = playerStepY - 1; // one step above player

  // Move horizontally first, then vertically (matching assembly FindPathToPlayer)
  while (cx !== targetX) {
    if (cx > targetX) { path.push('left'); cx--; }
    else { path.push('right'); cx++; }
  }
  while (cy !== targetY) {
    if (cy > targetY) { path.push('up'); cy--; }
    else { path.push('down'); cy++; }
  }

  // Compute rival's exit path: step to the side to avoid the player, then walk down
  // Assembly (OaksLabRivalStartsExitScript lines 413-422): if player X==4, rival goes RIGHT; else LEFT
  const exitPath: Direction[] = [];
  if (playerStepX === 4) {
    exitPath.push('right');
  } else {
    exitPath.push('left');
  }
  const exitFromY = targetY; // rival's Y after approaching
  for (let y = exitFromY; y < 11; y++) exitPath.push('down');

  return [
    // (text/OaksLab.asm _OaksLabRivalIllTakeYouOnText)
    { type: 'text', message: substituteNames(getText('LAB_RIVAL_ILL_TAKE_YOU_ON')) },
    // Rival approaches player
    ...(path.length > 0
      ? [{ type: 'moveNpc' as const, npcId: 'rival', path }]
      : []),
    { type: 'faceNpc', npcId: 'rival', direction: 'down' as Direction },
    // Battle: RIVAL1 party 0 = Eevee Lv5
    { type: 'startBattle', trainerClass: 'RIVAL1', partyIndex: 0, trainerName: getRivalName() },
    // After battle: heal player's party (assembly: HealParty predef)
    { type: 'healParty' },
    { type: 'setFlag', flag: 'BATTLED_RIVAL_IN_OAKS_LAB' },
    // (text/OaksLab.asm _OaksLabRivalSmellYouLaterText)
    { type: 'wait', frames: 20 },
    { type: 'text', message: substituteNames(getText('LAB_RIVAL_SMELL_YOU_LATER')) },
    // Rival walks around the player and out of the lab
    // Assembly: rival steps LEFT/RIGHT to avoid player, then walks DOWN to exit
    { type: 'moveNpc', npcId: 'rival', path: exitPath },
    { type: 'hideNpc', npcId: 'rival' },

    // --- Post-battle: Pikachu escapes Pokeball (OaksLabPikachuEscapesPokeballScript) ---
    { type: 'facePlayer', direction: 'up' as Direction },
    { type: 'wait', frames: 15 },
    // (text/OaksLab.asm _OaksLabPikachuDislikesPokeballsText1)
    { type: 'text', message: getText('LAB_OAK_WHAT') },
    // Assembly: Pikachu sprite appears next to player here
    ...(onPikachuEscapes ? [{ type: 'callback' as const, fn: onPikachuEscapes }] : []),
    // (text/OaksLab.asm _OaksLabPikachuDislikesPokeballsText2)
    { type: 'text', message: getText('LAB_OAK_PIKACHU_DISLIKES') },
  ];
}

/**
 * Build the parcel delivery + Pokédex scene.
 * Trigger: player talks to Oak with OAKS_PARCEL in bag.
 *
 * Assembly flow:
 * 1. OaksLabOak1Text → .got_parcel: Oak delivery dialogue, remove parcel
 * 2. OaksLabRivalArrivesAtOaksRequestScript: Rival enters lab, walks up
 * 3. OaksLabOakGivesPokedexScript: Rival+Oak dialogue, give Pokédex
 * 4. OaksLabRivalLeavesWithPokedexScript: Rival exits
 *
 * ASM (OaksLabCalcRivalMovementScript): Assembly sprite map coords have +4
 * offset (topmost tile = 4). So ASM map Y 11/10/9 → our step Y 7/6/5.
 * Rival always ends at step Y=3 (next to Oak at step Y=2).
 * Number of walk-up steps depends on player Y position.
 *
 * Uses the existing map NPC 'rival' (already loaded, just hidden) to avoid
 * async sprite loading issues with showNpc.
 */
export function buildOaksLabPokedexScript(
  playerStepX: number,
  playerStepY: number,
  findNpc: (id: string) => { x: number; y: number; direction: Direction; hidden: boolean } | undefined,
): ScriptCommand[] {
  // Rival destination: step Y=3 (next to Oak at Y=2, matching ASM)
  const rivalDestY = 3;
  // Choose rival X to avoid player column; ASM always uses map X=4
  const rivalX = playerStepX === 4 ? 5 : 4;

  // Rival starts at the bottom of the visible screen and walks up to step Y=3.
  // ASM (OaksLabCalcRivalMovementScript) places rival at screen Y=$7C (124):
  //   player Y=3 → rival step 7, 4 steps up
  //   player Y=2 → rival step 6, 3 steps up
  //   player Y=1 → rival step 5, 2 steps up
  // Formula: rivalStartY = playerStepY + 4, stepsUp = rivalStartY - 3
  const rivalStartY = playerStepY + 4;
  const stepsUp = rivalStartY - rivalDestY;

  const rivalEnterPath: Direction[] = [];
  for (let i = 0; i < stepsUp; i++) rivalEnterPath.push('up');

  // Exit: rival walks from step Y=3 back down past the door
  const rivalExitSteps = 11 - rivalDestY; // walk to step 11 (door)
  const rivalExitPath: Direction[] = [];
  for (let i = 0; i < rivalExitSteps; i++) rivalExitPath.push('down');

  return [
    // --- Phase 1: Oak receives the parcel ---
    // (text/OaksLab.asm _OaksLabOak1DeliverParcelText)
    { type: 'text', message: substituteNames(getText('LAB_OAK_DELIVER_PARCEL')) },
    { type: 'text', message: substituteNames(getText('LAB_DELIVERED_PARCEL')) },
    { type: 'removeItem', itemId: 'OAKS_PARCEL' },
    // (text/OaksLab.asm _OaksLabOak1ParcelThanksText)
    { type: 'text', message: substituteNames(getText('LAB_OAK_PARCEL_THANKS')) },

    // --- Phase 2: Rival arrives (OaksLabRivalArrivesAtOaksRequestScript) ---
    // ASM: text shows BEFORE rival appears, then rival walks in
    // (text/OaksLab.asm _OaksLabRivalGrampsText)
    { type: 'text', message: substituteNames(getText('LAB_RIVAL_GRAMPS')) },
    // Reposition the existing (hidden) rival NPC to bottom of visible area
    { type: 'callback', fn: () => {
      const rival = findNpc('rival');
      if (rival) {
        rival.x = rivalX * 16;
        rival.y = rivalStartY * 16;
        rival.direction = 'up';
      }
    }},
    { type: 'unhideNpc', npcId: 'rival' },
    { type: 'moveNpc', npcId: 'rival', path: rivalEnterPath },
    { type: 'wait', frames: 10 },

    // --- Phase 3: Pokédex scene (OaksLabOakGivesPokedexScript) ---
    // Rival faces UP, Oak faces DOWN
    { type: 'faceNpc', npcId: 'rival', direction: 'up' },
    { type: 'faceNpc', npcId: 'prof', direction: 'down' },
    // (text/OaksLab.asm _OaksLabRivalMyPokemonHasGrownStrongerText)
    { type: 'text', message: substituteNames(getText('LAB_RIVAL_MON_GROWN')) },

    { type: 'faceNpc', npcId: 'rival', direction: 'up' },
    { type: 'faceNpc', npcId: 'prof', direction: 'down' },
    // (text/OaksLab.asm _OaksLabOakIHaveARequestText)
    { type: 'text', message: substituteNames(getText('LAB_OAK_HAVE_A_REQUEST')) },

    { type: 'faceNpc', npcId: 'rival', direction: 'up' },
    { type: 'faceNpc', npcId: 'prof', direction: 'down' },
    // (text/OaksLab.asm _OaksLabOakMyInventionPokedexText)
    { type: 'text', message: getText('LAB_OAK_POKEDEX_SPEECH') },

    // (text/OaksLab.asm _OaksLabOakGotPokedexText)
    { type: 'text', message: substituteNames(getText('LAB_OAK_GOT_POKEDEX')) },

    // Hide the Pokédex objects on the desk
    { type: 'hideNpc', npcId: 'pokedex1' },
    { type: 'hideNpc', npcId: 'pokedex2' },

    { type: 'faceNpc', npcId: 'rival', direction: 'up' },
    { type: 'faceNpc', npcId: 'prof', direction: 'down' },
    // (text/OaksLab.asm _OaksLabOakThatWasMyDreamText)
    { type: 'text', message: getText('LAB_OAK_DREAM_SPEECH') },

    // Rival faces right, brief pause
    { type: 'faceNpc', npcId: 'rival', direction: 'right' },
    { type: 'wait', frames: 15 },
    // (text/OaksLab.asm _OaksLabRivalLeaveItAllToMeText)
    { type: 'text', message: substituteNames(getText('LAB_RIVAL_LEAVE_IT_TO_ME')) },

    // Set event flags
    { type: 'setFlag', flag: 'GOT_POKEDEX' },
    { type: 'setFlag', flag: 'OAK_GOT_PARCEL' },

    // --- Phase 4: Rival exits ---
    { type: 'moveNpc', npcId: 'rival', path: rivalExitPath },
    { type: 'hideNpc', npcId: 'rival' },
  ];
}

export function buildOaksLabIntroScript(findNpc?: (id: string) => { data: { dialogue: string } } | undefined): ScriptCommand[] {
  const up3: Direction[] = ['up', 'up', 'up'];
  const up8: Direction[] = ['up', 'up', 'up', 'up', 'up', 'up', 'up', 'up'];

  return [
    // --- Phase 1: Oak enters the lab (assembly OAK2 at 5,10 walks UP 3) ---
    { type: 'showNpc', npcId: 'prof_enter', x: 5, y: 10, sprite: 'prof', direction: 'up' },
    { type: 'moveNpc', npcId: 'prof_enter', path: up3 },
    { type: 'hideNpc', npcId: 'prof_enter' },

    // --- Phase 2: Oak appears at desk (assembly toggles OAK2→OAK1 at 5,2) ---
    { type: 'showNpc', npcId: 'prof_desk', x: 5, y: 2, sprite: 'prof', direction: 'down' },

    // --- Phase 3: Player walks up 8 steps from door (warp 1 at step 5,11) ---
    // Rival and Oak face down while player walks in
    { type: 'faceNpc', npcId: 'rival', direction: 'down' },
    { type: 'faceNpc', npcId: 'prof_desk', direction: 'down' },
    { type: 'movePlayer', path: up8 },
    { type: 'wait', frames: 10 },

    // --- Phase 4: Dialogue (OaksLabOakChooseMonSpeechScript) ---
    // Rival faces up toward Oak
    { type: 'faceNpc', npcId: 'rival', direction: 'up' },
    // (text/OaksLab.asm _OaksLabRivalFedUpWithWaitingText)
    { type: 'text', message: substituteNames(getText('LAB_RIVAL_FED_UP')) },

    // (text/OaksLab.asm _OaksLabOakChooseMonText)
    { type: 'text', message: substituteNames(getText('LAB_OAK_CHOOSE_MON_1')) },
    { type: 'text', message: substituteNames(getText('LAB_OAK_CHOOSE_MON_2')) },
    { type: 'setFlag', flag: 'OAK_ASKED_TO_CHOOSE_MON' },

    // Rival protests (text/OaksLab.asm _OaksLabRivalWhatAboutMeText)
    { type: 'faceNpc', npcId: 'rival', direction: 'up' },
    { type: 'text', message: substituteNames(getText('LAB_RIVAL_WHAT_ABOUT_ME')) },
    // (text/OaksLab.asm _OaksLabOakBePatientText)
    { type: 'faceNpc', npcId: 'prof_desk', direction: 'down' },
    { type: 'text', message: substituteNames(getText('LAB_OAK_BE_PATIENT')) },

    // --- Phase 5: Player walks to Eevee ball (free movement) ---
    // Set phase-appropriate dialogue before giving player control
    // (text/OaksLab.asm _OaksLabRivalIllGetABetterPokemonThanYou, _OaksLabOak1GoAheadItsYours)
    { type: 'callback', fn: () => {
      if (!findNpc) return;
      const rival = findNpc('rival');
      if (rival) rival.data.dialogue = substituteNames(getText('LAB_RIVAL_ILL_GET_BETTER'));
      const oak = findNpc('prof_desk');
      if (oak) oak.data.dialogue = getText('LAB_OAK_GO_AHEAD');
    }},
    // Assembly: after OAK_ASKED_TO_CHOOSE_MON, player must interact with ball.
    // OaksLabEeveePokeBallScript → rival exclamation → OaksLabChoseStarterScript
    { type: 'awaitInteraction', npcId: 'item_ball', guardStepY: 6,
      guardText: getText('LAB_OAK_DONT_GO') },

    // Rival reacts — exclamation bubble only, no text (assembly: OaksLabRivalExclamationScript)
    { type: 'exclamation', target: 'rival', frames: 30 },
    // Assembly: rival walks D,R,R,R — player pushed RIGHT 2 on the last R
    { type: 'moveNpc', npcId: 'rival', path: ['down', 'right', 'right'] as Direction[] },
    { type: 'moveParallel', npcId: 'rival',
      npcPath: ['right'] as Direction[],
      playerPath: ['right', 'right'] as Direction[] },
    { type: 'hideNpc', npcId: 'item_ball' },
    // Rival faces up, then OaksLabRivalReceivedMonText shows all 5 texts
    { type: 'faceNpc', npcId: 'rival', direction: 'up' },
    // (text/OaksLab.asm _OaksLabRivalTakesText1)
    { type: 'text', message: substituteNames(getText('LAB_RIVAL_NO_WAY')) },
    // (text/OaksLab.asm _OaksLabRivalTakesText2)
    { type: 'text', message: substituteNames(getText('LAB_RIVAL_SNATCHED')) },
    // (text/OaksLab.asm _OaksLabRivalTakesText3)
    { type: 'text', message: substituteNames(getText('LAB_OAK_WHAT_DOING')) },
    // (text/OaksLab.asm _OaksLabRivalTakesText4)
    { type: 'text', message: substituteNames(getText('LAB_RIVAL_WANTS_THIS')) },
    { type: 'text', message: substituteNames(getText('LAB_OAK_ALL_RIGHT')) },

    // --- Player walks to Oak (OaksLabPlayerWalksToOakScript) ---
    // Assembly RLE: LEFT 1, DOWN 1, LEFT 3, UP 2
    { type: 'movePlayer', path: ['left', 'down', 'left', 'left', 'left', 'up', 'up'] as Direction[] },

    // --- Phase 6: Player receives Pikachu (OaksLabPlayerReceivesPikachuScript) ---
    // (text/OaksLab.asm _OaksLabOakGivesText)
    { type: 'text', message: substituteNames(getText('LAB_OAK_GIVES_PIKACHU')) },
    { type: 'addPokemon', species: 25, level: 5 },
    // (text/OaksLab.asm _OaksLabReceivedText)
    { type: 'text', message: substituteNames(getText('LAB_RECEIVED_PIKACHU')) },
    { type: 'setFlag', flag: 'GOT_STARTER' },

    // --- Phase 7: Oak's advice ---
    { type: 'wait', frames: 15 },
    { type: 'faceNpc', npcId: 'prof_desk', direction: 'down' },
    // (text/OaksLab.asm _OaksLabOak1YourPokemonCanFightText)
    { type: 'text', message: getText('LAB_OAK_ADVICE') },

    // --- Cleanup: swap script NPC for map NPC ---
    { type: 'hideNpc', npcId: 'prof_desk' },
    { type: 'unhideNpc', npcId: 'prof' },
  ];
}
