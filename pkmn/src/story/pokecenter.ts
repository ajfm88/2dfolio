// DisplayPokemonCenterDialogue_ (engine/events/pokecenter.asm).
// A6e Pikachu programs/waits are retained; note 59 ports the machine and HealParty return order.
import type { Direction } from '../core';
import type { Npc } from '../overworld/npc';
import type { ScriptCommand } from '../script/types';
import { hasFlag } from '../events';
import { registerTextScript } from './text_handlers';

export function buildNurseScript(findNpc: (id: string) => Npc | undefined, onHeal?: () => void, used = hasFlag('USED_POKECENTER')): ScriptCommand[] {
  // Func_6eaa: the nurse's image $04 (facing up), then 64 frames
  const nurseUp: ScriptCommand[] = [
    { type: 'faceNpc', npcId: 'nurse', direction: 'up' },
    { type: 'wait', frames: 64 },
  ];
  // Func_6ebb(1, c): her facing, 6 frames (SetSpriteFacingDirectionAndDelay), her image
  const nurseFace = (direction: Direction): ScriptCommand[] => [
    { type: 'wait', frames: 6 },
    { type: 'faceNpc', npcId: 'nurse', direction },
  ];
  return [
    // (data/text/text_7.asm _PokemonCenterWelcomeText)
    { type: 'displayOpen' },
    { type: 'pikachuFacing', action: 'save' },
    // pokecenter.asm:5 checks only the current map and CheckPikachuFollowingPlayer.
    { type: 'ifPewterPikachuAsleep', then: [
      { type: 'printText', program: 'LooksContentText' },
      { type: 'pikachuFacing', action: 'restore' },
      { type: 'displayClose', outerWait: true },
    ] },
    { type: 'printText', program: 'PokemonCenterWelcomeText' },
    // wStatusFlags4 BIT_USED_POKECENTER: set even when this visit is declined.
    { type: 'setFlag', flag: 'USED_POKECENTER' },
    ...(!used ? [{ type: 'printText' as const, program: 'ShallWeHealYourPokemonText' }] : []),
    // (data/text/text_7.asm _ShallWeHealYourPokemonText)
    {
      type: 'yesNoChoice', pokeCenter: true,
      yes: [
        // UpdateSprites after YesNoChoicePokeCenter, then SetLastBlackoutMap
        { type: 'updateSprites' },
        ...(onHeal ? [{ type: 'callback' as const, fn: onHeal }] : []),
        // The starter alive and following: LoadCurrentMapView, Delay3, UpdateSprites,
        // PikachuWalksToNurseJoy (no refresh after it)
        { type: 'ifStarterPikachu', following: true, then: [
          { type: 'displayHide' },
          { type: 'wait', frames: 3 },
          { type: 'updateSprites' },
          { type: 'pikachuToNurse' },
        ] },
        // (data/text/text_7.asm _NeedYourPokemonText), then 64 frames
        { type: 'printText', program: 'NeedYourPokemonText' },
        { type: 'wait', frames: 64 },
        // DisablePikachuOverworldSpriteDrawing; Func_6eaa for a living starter
        { type: 'ifStarterPikachu', following: true, then: [{ type: 'hidePikachu' }, ...nurseUp] },
        // Func_6ebb(1, 8): left, toward the machine; 30 frames
        ...nurseFace('left'),
        { type: 'wait', frames: 30 },
        // AnimateHealingMachine (ends in UpdateSprites, Pikachu still undrawn), HealParty
        { type: 'healingMachine' },
        { type: 'updateSprites' },
        { type: 'healParty' },
        { type: 'restoreMapMusic' },
        // Func_6eaa for a living starter, spawn state 5, EnablePikachuOverworldSpriteDrawing
        { type: 'ifStarterPikachu', following: true, then: [...nurseUp, { type: 'showPikachu' }] },
        // Func_6ebb(1, 0): back down
        ...nurseFace('down'),
        // (data/text/text_7.asm _PokemonFightingFitText)
        { type: 'printText', program: 'PokemonFightingFitText' },
        // Func_6ebb(15, 0): Pikachu faces down and its image is written — visible again
        // here, before the bow
        { type: 'ifStarterPikachu', following: true, then: [{ type: 'pikachuStandDown' }] },
        // LoadCurrentMapView, Delay3, UpdateSprites
        { type: 'displayHide' },
        { type: 'wait', frames: 3 },
        { type: 'updateSprites' },
        // The bow: the nurse's image $01 for 40 frames, then UpdateSprites
        { type: 'callback', fn: () => { const n = findNpc('nurse'); if (n) n.useWalkFrame = true; } },
        { type: 'wait', frames: 40 },
        { type: 'callback', fn: () => { const n = findNpc('nurse'); if (n) n.useWalkFrame = false; } },
        { type: 'updateSprites' },
      ],
      no: [{ type: 'updateSprites' }],
    },
    // .done: (data/text/text_7.asm _PokemonCenterFarewellText), UpdateSprites
    { type: 'printText', program: 'PokemonCenterFarewellText' },
    { type: 'updateSprites' },
    // CloseTextDisplay
    { type: 'pikachuFacing', action: 'restore' },
    { type: 'displayClose', outerWait: true },
  ];
}

registerTextScript('pokecenterNurse', ctx => buildNurseScript(ctx.findNpc ?? (() => undefined), ctx.onHeal, ctx.hasFlag('USED_POKECENTER')));
