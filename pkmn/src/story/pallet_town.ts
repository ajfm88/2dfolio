// Pallet Town story scripts — Oak's grass event

import type { ScriptCommand } from '../script';
import type { Direction } from '../core';
import { stopMusic, playMusic } from '../audio';
import { getText } from '../text';

/**
 * Build the Oak grass cutscene script.
 * Trigger: player reaches Route 1 exit (tileY near 0) without GOT_STARTER.
 *
 * Flow (Yellow):
 * 1. "OAK: Hey! Wait! Don't go out!"
 * 2. Player faces down, exclamation "!" bubble
 * 3. Oak appears south of player, walks up
 * 4. "OAK: That was close!\fWild POKéMON live in tall grass!"
 * 5. Oak faces grass → wild Pikachu battle (auto-played, Oak catches it)
 * 6. "OAK: Whew..."
 * 7. "OAK: A POKéMON can appear anytime...Come with me!"
 * 8. Oak walks south toward lab; player follows
 * 9. Warp to Oak's Lab
 */
export function buildOakGrassScript(playerTileX: number): ScriptCommand[] {
  const playerStepX = Math.floor(playerTileX / 2);

  // Oak appears 5 steps south of player
  const oakSpawnY = 5;

  // Oak walks up to 1 step south of the player
  const oakWalkUp: Direction[] = [];
  for (let i = 0; i < oakSpawnY - 1; i++) oakWalkUp.push('up');

  // Assembly: engine/overworld/auto_movement.asm — PalletMovementScriptPointerTable
  // Phase 1: If player is on right tile (X>10), Oak walks LEFT to align.
  // Phase 2: Player mimics Oak's left steps to also align at X=10.
  // Phase 3: Both walk to lab simultaneously.
  //
  // In the assembly, the player uses simulated joypad presses (PAD_UP, PAD_RIGHT, etc.)
  // which go through the full overworld engine with collision/connection handling.
  // Our script engine moves directly without collision, so we can't use the assembly's
  // player path (it goes off-map north into Route 1). Instead, the player trails Oak
  // by 1 step on the same route — achieving the same visual result.
  const alignSteps = Math.max(0, playerStepX - 10);

  // Oak's path (RLEList_ProfOakWalkToLab): DOWN 6, LEFT 1, DOWN 5, RIGHT 3, UP 1
  const oakLabPath: Direction[] = [
    ...new Array<Direction>(6).fill('down'),
    'left',
    ...new Array<Direction>(5).fill('down'),
    ...new Array<Direction>(3).fill('right'),
    'up',
  ];

  // Oak faces the grass patch (assembly: EVENT_PLAYER_AT_RIGHT_EXIT)
  // wXCoord=10 (left exit) → event NOT set → Oak faces RIGHT
  // wXCoord>10 (right exit) → event IS set → Oak faces LEFT
  const oakFacesGrass: Direction = playerStepX > 10 ? 'left' : 'right';

  return [
    // Assembly: StopAllMusic → PlayMusic MUSIC_MEET_PROF_OAK
    { type: 'callback', fn: () => { stopMusic(); playMusic('meetprofoak'); } },

    // "Hey! Wait! Don't go out!" (text/PalletTown.asm _PalletTownOakHeyWaitDontGoOutText)
    { type: 'text', message: getText('PALLET_OAK_HEY_WAIT') },

    // Player faces down, then exclamation bubble (assembly: EmotionBubble on player sprite)
    { type: 'facePlayer', direction: 'down' },
    { type: 'exclamation', target: 'player', frames: 40 },

    // Oak appears south of player and walks up
    { type: 'showNpc', npcId: 'prof_script', x: playerStepX, y: oakSpawnY, sprite: 'prof', direction: 'up' },
    { type: 'setFlag', flag: 'OAK_APPEARED_IN_PALLET' },
    { type: 'moveNpc', npcId: 'prof_script', path: oakWalkUp },
    { type: 'faceNpc', npcId: 'prof_script', direction: 'up' },
    { type: 'wait', frames: 15 },

    // "That was close!" + para "Wild POKéMON live in tall grass!"
    // (text/PalletTown.asm _PalletTownOakThatWasCloseText)
    { type: 'text', message: getText('PALLET_OAK_CLOSE_CALL') },

    // Oak faces the adjacent grass patch before Pikachu battle
    { type: 'faceNpc', npcId: 'prof_script', direction: oakFacesGrass },
    { type: 'wait', frames: 15 },

    // Wild Pikachu battle — auto-played, Oak catches it
    // (scripts/PalletTown.asm PalletTownPikachuBattleScript: BATTLE_TYPE_PIKACHU)
    { type: 'pikachuBattle' },

    // After battle (text/PalletTown.asm _PalletTownOakWhewText)
    { type: 'text', message: getText('PALLET_OAK_WHEW') },
    { type: 'faceNpc', npcId: 'prof_script', direction: 'up' },
    { type: 'wait', frames: 15 },

    // "A POKéMON can appear anytime..." (text/PalletTown.asm _PalletTownOakComeWithMe)
    { type: 'text', message: getText('PALLET_OAK_COME_WITH_ME') },

    // Phase 1+2: If player was on right exit, Oak moves LEFT then player follows
    // (assembly: PalletMovementScript_OakMoveLeft + PalletMovementScript_PlayerMoveLeft)
    ...(alignSteps > 0 ? [
      { type: 'moveNpc' as const, npcId: 'prof_script', path: new Array<Direction>(alignSteps).fill('left') },
      { type: 'movePlayer' as const, path: new Array<Direction>(alignSteps).fill('left') },
    ] : []),

    // Phase 3: Both walk to lab simultaneously.
    // Player trails Oak by 1 step: first step DOWN (to Oak's position), then Oak's path minus last step.
    { type: 'moveParallel', npcId: 'prof_script', npcPath: oakLabPath,
      playerPath: ['down' as Direction, ...oakLabPath.slice(0, -1)] },
    { type: 'hideNpc', npcId: 'prof_script' },

    // Warp to lab
    { type: 'setFlag', flag: 'FOLLOWED_OAK_INTO_LAB' },
    { type: 'warp', map: 'OaksLab', warpId: 1 },
  ];
}
