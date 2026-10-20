// scripts/PewterCity.asm; engine/overworld/auto_movement.asm:157–270.
// The six input-locked states run in one native command chain. Only DEFAULT can
// be saved, so neither the current state nor GetSpritePosition2's snapshot is saved.
import type { ScriptCommand } from '../script/types';
import type { TextHandlerContext } from './text_handlers';
import { registerTextHandler, displayTextID } from './text_handlers';
import { clearFlag, getMapScript, setMapScript } from '../events';
import { setJoyIgnore } from '../input/joy_ignore';
import { decodeRle, pewterGuys, npcDirections, PEWTER_MUSEUM_PLAYER, PEWTER_MUSEUM_GUIDE,
  PEWTER_GYM_PLAYER, PEWTER_GYM_GUIDE } from '../overworld/simulated_joypad';

export const PEWTER_CITY = 'PewterCity';
export const PewterScript = { DEFAULT: 0, SHOWS_MUSEUM: 1, HIDE_MUSEUM: 2, RESET_MUSEUM: 3,
  SHOWS_GYM: 4, HIDE_GYM: 5, RESET_GYM: 6 } as const;
let escort: { script: number; saved: { x: number; y: number } } | null = null;
export function pewterCityScriptState(): number { return escort?.script ?? PewterScript.DEFAULT; }

const print = (program: string): ScriptCommand => ({ type: 'printText', program });
// PewterCityPlayerLeavingEastCoords: these are steps, not 8 px tiles.
const EAST = [[35, 17], [36, 17], [37, 18], [37, 19]] as const;

/** PewterCityDefaultScript, called only on standing passes, before Joypad. */
export function pewterCityScript(ctx: TextHandlerContext): ScriptCommand[] | null {
  if (pewterCityScriptState() !== PewterScript.DEFAULT) return null;
  if (getMapScript('Museum1F') !== 0) setMapScript('Museum1F', 0);
  clearFlag('BOUGHT_MUSEUM_TICKET');
  if (ctx.hasFlag('BEAT_BROCK') || !EAST.some(([x, y]) => x === ctx.step.x && y === ctx.step.y)) return null;
  // Unlike talk, this invokes DisplayTextID without a face-player/ordinary sprite update.
  setJoyIgnore('controls');
  return pewterYoungsterText(ctx, true);
}

/** The callback arms the source state before TextScriptEnd; the native chain resumes after close. */
function escortCommands(ctx: TextHandlerContext, museum: boolean, east: boolean): { arm: ScriptCommand; afterClose: ScriptCommand[] } {
  const npcId = museum ? 'super_nerd1' : 'youngster';
  const saved = { x: 0, y: 0 };
  const playerList = decodeRle(museum ? PEWTER_MUSEUM_PLAYER : PEWTER_GYM_PLAYER);
  const joypad = pewterGuys(playerList.entries, playerList.count - 1, museum ? 'museum' : 'gym', ctx.step.x, ctx.step.y);
  const arm: ScriptCommand = { type: 'callback', fn: () => {
    const npc = ctx.findNpc?.(npcId);
    if (!npc) throw new Error(`missing Pewter guide ${npcId}`);
    saved.x = npc.mapStepX; saved.y = npc.mapStepY;
    escort = { script: museum ? PewterScript.SHOWS_MUSEUM : PewterScript.SHOWS_GYM, saved };
  } };
  const state = (script: number): ScriptCommand => ({ type: 'callback', fn: () => {
    if (!escort) throw new Error('Pewter escort is not armed');
    escort.script = script;
  } });
  return { arm, afterClose: [
    { type: 'overworldLoop', updateSprites: east },
    // Function 0 blocks for 185/329 passes: host-dependent work cannot run in main's reduced dispatch deps (N-1).
    { type: 'npcMovementScript', npcId, joypad,
      guidePath: npcDirections(decodeRle(museum ? PEWTER_MUSEUM_GUIDE : PEWTER_GYM_GUIDE).entries), music: 'museumguy' },
    ...(museum ? [
      { type: 'faceNpc', npcId, direction: 'up', write: 'live', spriteIndex: 3 },
      { type: 'wait', frames: 6 },
      { type: 'faceNpc', npcId, direction: 'up', write: 'image' },
    ] satisfies ScriptCommand[] : [
      { type: 'faceNpc', npcId, direction: 'left', write: 'image', restoreAtClose: true, spriteIndex: 5 },
    ] satisfies ScriptCommand[]),
    { type: 'restoreMapMusic', waitForCurrent: true },
    { type: 'displayOpen', spriteUpdate: false, spriteIndex: museum ? 13 : 14 },
    { type: 'printText', program: museum ? 'PewterCitySuperNerd1ItsRightHereText' : 'PewterCityYoungsterGoTakeOnBrockText', box: 'keep' },
    { type: 'displayClose', outerWait: true },
    { type: 'setSpritePosition1', npcId, mapStep: museum ? { x: 13, y: 8 } : { x: 12, y: 18 }, screenDx: museum ? 0 : -16 },
    { type: 'joyIgnore', mask: 'all' },
    state(museum ? PewterScript.HIDE_MUSEUM : PewterScript.HIDE_GYM),
    { type: 'moveNpc', npcId, spriteIndex: museum ? 3 : 5, path: Array.from({ length: museum ? 4 : 5 }, () => museum ? 'down' : 'right'),
      options: { keepStatus: true, bytesToFF: true }, inPass: true },
    { type: 'hideObject', map: PEWTER_CITY, npcId },
    { type: 'updateSprites', fontLoaded: false }, // HideObject's UpdateSprites; preserve earlier pickup callers.
    state(museum ? PewterScript.RESET_MUSEUM : PewterScript.RESET_GYM),
    { type: 'overworldLoop', updateSprites: true },
    // The saved screen bytes are now off-window. The first visible ready update recomputes from these map steps.
    { type: 'restoreSpritePosition2', npcId, saved },
    { type: 'showObject', map: PEWTER_CITY, npcId },
    { type: 'joyIgnore', mask: 'none' },
    { type: 'callback', fn: () => { escort = null; } },
    { type: 'overworldLoop', resumeInput: true },
  ] };
}

export function pewterMuseumText(ctx: TextHandlerContext): ScriptCommand[] {
  const walk = escortCommands(ctx, true, false);
  return [{ type: 'displayOpen' }, print('PewterCitySuperNerd1Text.DidYouCheckOutMuseumText'),
    { type: 'yesNoChoice', yes: [print('PewterCitySuperNerd1Text.WerentThoseFossilsAmazingText'),
      { type: 'displayClose', outerWait: true }],
    no: [print('PewterCitySuperNerd1Text.YouHaveToGoText'), walk.arm,
      { type: 'displayClose', outerWait: true }, ...walk.afterClose] }];
}

export function pewterYoungsterText(ctx: TextHandlerContext, east = false): ScriptCommand[] {
  const walk = escortCommands(ctx, false, east);
  return [...displayTextID([print('PewterCityYoungsterText.YoureATrainerFollowMeText'), walk.arm], { textId: 5 }), ...walk.afterClose];
}

registerTextHandler(PEWTER_CITY, 3, pewterMuseumText);
registerTextHandler(PEWTER_CITY, 5, pewterYoungsterText);
