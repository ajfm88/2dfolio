// scripts/OaksLab.asm: display envelopes and source programs; A6 movement paths retained.
import type { ScriptCommand } from '../script/types';
import type { Direction } from '../core';
import { getRivalName, setRivalStarter } from '../core/player_state';
import { wasLastBattleWon } from '../script/script_controller';
import { rivalStarterAfterLabBattle } from '../battle/trainer_flow';
import { getSpeciesById } from '../battle/data';
import { stopMusic, playMusic } from '../audio';
import { setNoMapMusic } from '../audio/audio_flags';
import { setJoyIgnore } from '../input/joy_ignore';
import { displayTextID } from './text_handlers';
import { VIRIDIAN_CITY, ViridianScript } from './viridian_city';

export const LAB_GUARD_PROGRAM = 'OaksLabOakDontGoAwayYetText.Text';
// The scripted DisplayTextID writers in OaksLab_TextPointers (not object slots).
const LAB_SCRIPT_TEXT_IDS: Readonly<Record<string, number>> = {
  OaksLabRivalIllTakeYouOnText: 11, OaksLabRivalSmellYouLaterText: 12,
  OaksLabRivalFedUpWithWaitingText: 13, OaksLabOakChooseMonText: 14,
  OaksLabRivalWhatAboutMeText: 15, OaksLabOakBePatientText: 16,
  OaksLabRivalGrampsText: 19, OaksLabRivalMyPokemonHasGrownStrongerText: 20,
  OaksLabOakIHaveARequestText: 21, OaksLabOakMyInventionPokedexText: 22,
  OaksLabOakGotPokedexText: 23, OaksLabOakThatWasMyDreamText: 24,
  OaksLabRivalLeaveItAllToMeText: 25, OaksLabPikachuDislikesPokeballsText1: 26,
  OaksLabPikachuDislikesPokeballsText2: 27,
};
export function labDisplay(program: string, direct = false, autoBox = false): ScriptCommand[] {
  return displayTextID([{ type: 'printText', program, ...(direct ? { box: 'keep' as const } : {}) }],
    { autoBox, textId: LAB_SCRIPT_TEXT_IDS[program.split('.')[0]] });
}
const mask = (value: 'none' | 'dpad' | 'all'): ScriptCommand => ({ type: 'callback', fn: () => setJoyIgnore(value) });
const mapMusic: ScriptCommand = { type: 'restoreMapMusic' };
const clearNoMapMusic: ScriptCommand = { type: 'callback', fn: () => setNoMapMusic(false) };
const rivalMusic: ScriptCommand = { type: 'callback', fn: () => { stopMusic(); playMusic('meetrival', 'rivalAlternate'); } };

export function labChooseSpeech(): ScriptCommand[] {
  return [
    { type: 'setFlag', flag: 'FOLLOWED_OAK_INTO_LAB_2' },
    { type: 'setFlag', flag: 'OAK_ASKED_TO_CHOOSE_MON' }, mask('dpad'),
    ...labDisplay('OaksLabRivalFedUpWithWaitingText.Text'), { type: 'wait', frames: 3 },
    ...labDisplay('OaksLabOakChooseMonText.Text'), { type: 'wait', frames: 3 },
    { type: 'faceNpc', npcId: 'rival', direction: 'up' },
    ...labDisplay('OaksLabRivalWhatAboutMeText.Text'), { type: 'wait', frames: 3 },
    ...labDisplay('OaksLabOakBePatientText.Text'), mask('none'),
  ];
}
export function labBallDisplay(): ScriptCommand[] {
  return displayTextID([{ type: 'emotionBubble', target: 'rival' }], { autoBox: false, outerWait: false, textId: 2 });
}
export function labSnatchDisplay(): ScriptCommand[] {
  return displayTextID(Array.from({ length: 5 }, (_, i) => ({ type: 'printText' as const, program: `OaksLabRivalTakesText${i + 1}` })), { autoBox: false, textId: 17 });
}
export function labGiftDisplay(): ScriptCommand[] {
  return displayTextID([
    { type: 'printText', program: 'OaksLabOakGivesText' },
    { type: 'printText', program: 'OaksLabReceivedText', bindings: { nameBuffer: getSpeciesById(25)?.name.toUpperCase() ?? 'PIKACHU' } },
    { type: 'addPokemon', species: 25, level: 5 }, { type: 'hidePikachu' },
    { type: 'setFlag', flag: 'GOT_STARTER' },
  ], { autoBox: false, outerWait: false, textId: 18 });
}
function ballContinuation(oak: string): ScriptCommand[] {
  return [
    { type: 'moveParallel', npcId: 'rival', spriteIndex: 1, npcPath: ['down', 'right', 'right', 'right'],
      npcModes: ['normal', 'fast', 'fast', 'fast'], playerPath: ['right', 'right'], playerFromNpcStep: 4 },
    { type: 'hideNpc', npcId: 'item_ball' },
    { type: 'faceNpc', npcId: 'rival', direction: 'up' },
    { type: 'callback', fn: () => setRivalStarter(1) }, // RIVAL_STARTER_JOLTEON, replaced after battle.
    ...labSnatchDisplay(),
    { type: 'movePlayer', path: ['left', 'down', 'left', 'left', 'left', 'up', 'up'] },
    ...labGiftDisplay(), mask('none'),
    ...(oak === 'prof_desk' ? [
      { type: 'hideNpc', npcId: 'prof_desk' } as ScriptCommand,
      { type: 'unhideNpc', npcId: 'prof' } as ScriptCommand,
    ] : []),
  ];
}
export function buildOaksLabAwaitBallScript(): ScriptCommand[] {
  return [{ type: 'awaitInteraction', npcId: 'item_ball', guardStepY: 6, guardProgram: LAB_GUARD_PROGRAM },
    ...buildOaksLabBallScript()];
}
export function buildOaksLabBallScript(): ScriptCommand[] {
  return [...labBallDisplay(), mask('dpad'), ...ballContinuation('prof')];
}
export function buildOaksLabIntroScript(): ScriptCommand[] {
  return [
    { type: 'showNpc', npcId: 'prof_enter', x: 5, y: 10, sprite: 'prof', direction: 'up', textId: 6 },
    { type: 'moveNpc', npcId: 'prof_enter', path: ['up', 'up', 'up'], spriteIndex: 6 },
    { type: 'hideNpc', npcId: 'prof_enter' },
    { type: 'showNpc', npcId: 'prof_desk', x: 5, y: 2, sprite: 'prof', direction: 'down', textId: 3 },
    { type: 'wait', frames: 3 },
    { type: 'faceNpc', npcId: 'rival', direction: 'down' },
    { type: 'faceNpc', npcId: 'prof_desk', direction: 'down' },
    { type: 'movePlayer', path: Array<Direction>(8).fill('up') },
    { type: 'faceNpc', npcId: 'rival', direction: 'up' }, clearNoMapMusic, mapMusic,
    ...labChooseSpeech(),
    { type: 'awaitInteraction', npcId: 'item_ball', guardStepY: 6, guardProgram: LAB_GUARD_PROGRAM },
    ...labBallDisplay(), mask('dpad'), ...ballContinuation('prof_desk'),
  ];
}

export function buildOaksLabRivalBattleScript(
  rivalStepX: number, rivalStepY: number, playerStepX: number, playerStepY: number,
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
    { type: 'callback', fn: () => { setJoyIgnore('dpad'); playMusic('meetrival'); } },
    ...labDisplay('OaksLabRivalIllTakeYouOnText.Text'),
    ...(path.length ? [{ type: 'moveNpc' as const, npcId: 'rival', path, spriteIndex: 1 }] : []),
    // MoveSprite writes this even when its path is empty (adjacent rival).
    // Metadata costs no frames and keeps the port's existing movement timing.
    { type: 'faceNpc', npcId: 'rival', direction: 'down', spriteIndex: 1 }, mask('none'),
    { type: 'startBattle', trainerClass: 'RIVAL1', partyIndex: 0, trainerName: getRivalName(),
      endBattleProgram: 'OaksLabRivalIPickedTheWrongPokemonText' },
    { type: 'callback', fn: () => { setJoyIgnore('dpad'); setRivalStarter(rivalStarterAfterLabBattle(wasLastBattleWon())); } },
    { type: 'healParty' }, { type: 'setFlag', flag: 'BATTLED_RIVAL_IN_OAKS_LAB' },
    { type: 'wait', frames: 20 }, ...labDisplay('OaksLabRivalSmellYouLaterText.Text'), rivalMusic,
    { type: 'moveNpc', npcId: 'rival', path: exitPath, spriteIndex: 1, modes: exitPath.map((_, i) => i < 2 ? 'normal' : 'fast') },
    { type: 'hideNpc', npcId: 'rival' }, mapMusic,
    { type: 'facePlayer', direction: 'up' },
    ...labDisplay('OaksLabPikachuDislikesPokeballsText1.Text'),
    // SchedulePikachuSpawnForAfterText: retain the existing A6 spawn at this close.
    ...(onPikachuEscapes ? [{ type: 'callback' as const, fn: onPikachuEscapes }] : []),
    ...labDisplay('OaksLabPikachuDislikesPokeballsText2.Text'), mask('none'),
  ];
}

export function buildOaksLabPokedexScript(
  playerStepX: number, playerStepY: number,
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

  const face: ScriptCommand[] = [{ type: 'faceNpc', npcId: 'rival', direction: 'up' },
    { type: 'faceNpc', npcId: 'prof', direction: 'down' }];
  return [
    ...displayTextID([{ type: 'printText', program: 'OaksLabOak1Text.DeliverParcelText' },
      { type: 'removeItem', itemId: 'OAKS_PARCEL' }], { autoBox: false }),
    rivalMusic, ...labDisplay('OaksLabRivalGrampsText', true, true),
    { type: 'tryPikachuMovement', caller: 'oaksLab' },
    { type: 'callback', fn: () => { const rival = findNpc('rival'); if (rival) {
      rival.x = rivalX * 16; rival.y = rivalStartY * 16; rival.direction = 'up'; } } },
    { type: 'unhideNpc', npcId: 'rival' }, { type: 'moveNpc', npcId: 'rival', path: rivalEnterPath, spriteIndex: 1 },
    mapMusic, mask('dpad'), ...face,
    ...labDisplay('OaksLabRivalMyPokemonHasGrownStrongerText', true, true), { type: 'wait', frames: 1 }, ...face,
    ...labDisplay('OaksLabOakIHaveARequestText', true, true), { type: 'wait', frames: 1 }, ...face,
    ...labDisplay('OaksLabOakMyInventionPokedexText', true, true), { type: 'wait', frames: 1 },
    ...labDisplay('OaksLabOakGotPokedexText', true, true), { type: 'wait', frames: 3 },
    { type: 'hideNpc', npcId: 'pokedex1' }, { type: 'hideNpc', npcId: 'pokedex2' }, ...face,
    ...labDisplay('OaksLabOakThatWasMyDreamText', true, true),
    { type: 'faceNpc', npcId: 'rival', direction: 'right' }, { type: 'wait', frames: 3 },
    ...labDisplay('OaksLabRivalLeaveItAllToMeText', true, true),
    { type: 'setFlag', flag: 'GOT_POKEDEX' },
    { type: 'setMapScript', map: VIRIDIAN_CITY, state: ViridianScript.AFTER_POKEDEX },
    { type: 'setFlag', flag: 'OAK_GOT_PARCEL' }, rivalMusic,
    { type: 'moveNpc', npcId: 'rival', path: rivalExitPath, spriteIndex: 1 }, { type: 'hideNpc', npcId: 'rival' }, mapMusic, mask('none'),
  ];
}
