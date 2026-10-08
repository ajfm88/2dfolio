// Overworld controller — per-frame overworld update logic.
//
// Returns an OverworldAction describing what main.ts should do next (state
// transition, battle start, etc.), or null when no action is needed.

import type { Direction } from '../core';
import type { Player, Interaction } from './player';
import type { GameMap } from './map';
import type { Npc } from './npc';
import type { PikachuFollower } from '../pikachu/pikachu_follower';
import type { BattlePokemon } from '../battle';
import type { Bag } from '../items';
import type { ScriptCommand } from '../script';
import { isPassPressed } from '../input';
import { updateSprites, recordStepForPikachu, spriteTable } from './sprites';
import { hasFlag, setFlag, getMapScript } from '../events';
import { itemBallScript, hiddenItemScript, potionSampleScript } from './item_pickup';
import { tryWildEncounter } from '../battle';
import { isNoEncounters } from '../debug';
import { shouldPikachuFollow } from '../pikachu';
import { updatePikachuWalking } from '../pikachu/pikachu_happiness';
import { countStep, runStepEnd } from './step_end';
import type { StepCounters } from './step_end';
import { getPlayerName, substituteNames } from '../core/player_state';
import { getHiddenEventScript } from '../story/hidden_events';
import { getText } from '../text/game_text';
import { buildOakGrassScript } from '../story/pallet_town';
import {
  VIRIDIAN_CITY, viridianCityStep, buildSleepingOldManScript, buildGymLockedScript,
  buildOldMan2Script, buildOldMan1Script,
} from '../story/viridian_city';
import { TRAINER_MAPS, trainerMapScript, trainerTalkedTo, startTrainerWalkUp } from './map_trainers';
import type { TrainerSightState, TrainerScriptAction } from './map_trainers';
import {
  buildOaksLabBallScript,
  buildOaksLabRivalBattleScript,
  buildOaksLabPokedexScript,
} from '../story/oaks_lab';

// ── Types ─────────────────────────────────────────────────────────────

/** Mutable state tracked across overworld frames. `seenByTrainer` / `engagedNpc` are
 *  BIT_SEEN_BY_TRAINER and wSpriteIndex (map_trainers.ts). */
export interface OverworldState extends StepCounters, TrainerSightState {
  doorExitStep: boolean;
  justWarped: boolean;
  pikachuDeferredSpawn: boolean;
  standingOnWarp: boolean;
  interactedNpc: Npc | null;
}

/** Dependencies passed from main.ts each frame. */
export interface OverworldDeps {
  player: Player;
  gameMap: GameMap;
  npcs: Npc[];
  pikachuFollower: PikachuFollower;
  playerParty: BattlePokemon[];
  playerBag: Bag;
  currentMapName: string;
  findNpc: (id: string) => Npc | undefined;
  onPokecenterHeal?: () => void;
}

/** Actions returned to main.ts for state transitions. */
export type OverworldAction =
  | { type: 'pikachuEmotion' }
  | { type: 'textbox'; text: string; pendingTownMap?: boolean }
  | { type: 'script'; commands: ScriptCommand[] }
  | { type: 'openShop'; shopItems: string[] }
  | { type: 'openPc' }
  | { type: 'openPokecenterPc' }
  | { type: 'openBlackboard' }

  | { type: 'startBattle'; pokemon: BattlePokemon }
  | { type: 'talkToTrainer'; npc: Npc }
  | { type: 'warp'; destMap: string; destWarpId: number }
  | { type: 'connectToMap'; destMap: string; dir: 'north' | 'south' | 'east' | 'west'; offset: number }
  | TrainerScriptAction
  ;

// Direction-to-connection mapping
const DIR_TO_CONN = {
  up: 'north',
  down: 'south',
  left: 'west',
  right: 'east',
} as const;

/** Create a fresh OverworldState. */
export function createOverworldState(): OverworldState {
  return {
    doorExitStep: false,
    justWarped: false,
    pikachuDeferredSpawn: false,
    standingOnWarp: false,
    stepCounter: 0,
    encounterCooldown: 0,
    interactedNpc: null,
    seenByTrainer: false,
    engagedNpc: null,
  };
}

// ── Main update ───────────────────────────────────────────────────────

/**
 * Run one overworld pass (every two frames, walk_pace.ts), after main.ts has read the
 * joypad (readJoypad on standing passes). Returns an action for main.ts, or null. The
 * NPCs and Pikachu update inside the player's pass, where the ASM's loop calls
 * UpdateSprites.
 */
export function updateOverworld(
  deps: OverworldDeps,
  ow: OverworldState,
): OverworldAction | null {
  const { player, gameMap, npcs, pikachuFollower } = deps;
  player.finishLanding();
  const sprites = (): void => updateSprites(npcs, gameMap, player, pikachuFollower);

  // Door exit auto-step: after warping onto a door tile, walk one step down
  // before resuming normal player control (matches assembly PlayerStepOutFromDoor).
  if (ow.doorExitStep) {
    if (player.isMoving) {
      player.update(gameMap, npcs, null, sprites);
      if (player.justFinishedStep) {
        const action = handleStepComplete(deps, ow, true);
        ow.doorExitStep = false;
        if (ow.pikachuDeferredSpawn) {
          pikachuFollower.visible = true;
          pikachuFollower.spawn(player.x, player.y, player.direction);
          ow.pikachuDeferredSpawn = false;
        }
        return action;
      }
    } else {
      player.forceStep('down', sprites);
      // PlayerStepOutFromDoor simulates an ordinary DOWN press, so Pikachu follows
      // this step like any other (it was placed on or beside the player by its
      // spawn state — pikachu_spawn.ts)
      if (pikachuFollower.visible) recordStepForPikachu(player, pikachuFollower);
    }
    return null;
  }

  // Check for NPC/sign/item interaction first (takes priority over Pikachu)
  const interaction = player.checkInteraction(gameMap, npcs, hasFlag);
  if (interaction) {
    // BIT_SEEN_BY_TRAINER closes .displayDialogue (signs, sprites) after its UpdateSprites;
    // hidden events and bookshelves are found before it (A1c, an adjacent trainer only)
    if (ow.seenByTrainer && !foundBeforeDialogue(interaction)) {
      sprites();
      return null;
    }
    return handleInteraction(interaction, deps, ow);
  }

  // Check for Pikachu interaction only if no other interaction found
  if (isPassPressed('a') && !player.isBusy && pikachuFollower.visible) {
    const facing = player.getFacingTile();
    const px = pikachuFollower.tileX, py = pikachuFollower.tileY;
    if (facing.tx >= px && facing.tx < px + 2 &&
        facing.ty >= py && facing.ty < py + 2) {
      if (ow.seenByTrainer) {
        sprites();
        return null;
      }
      // IsSpriteInFrontOfPlayer sets its BIT_FACE_PLAYER; the box's UpdateSprites turns it
      pikachuFollower.requestFacePlayer();
      return { type: 'pikachuEmotion' };
    }
  }

  player.update(gameMap, npcs, undefined, sprites, () => spriteTable(player, npcs, pikachuFollower));

  // Deferred Pikachu spawn: show Pikachu on the player's first step after a blackout warp
  // (doorExitStep handles this for normal door exits, but blackout skips that system)
  if (ow.pikachuDeferredSpawn && player.justStartedStep) {
    pikachuFollower.visible = true;
    pikachuFollower.spawn(player.stepStartX, player.stepStartY, player.direction);
    ow.pikachuDeferredSpawn = false;
  }

  // Pikachu follows each step from where it started
  if (player.startedFollowStep && pikachuFollower.visible) {
    recordStepForPikachu(player, pikachuFollower);
  }

  // Collision-based warp: player is on a non-instant warp tile and pressed into
  // a wall/edge. Matches assembly CheckWarpsCollision.
  if (ow.standingOnWarp && player.justCollided) {
    const warp = gameMap.getWarpAt(player.tileX, player.tileY);
    if (warp) {
      ow.standingOnWarp = false;
      return { type: 'warp', destMap: warp.destMap, destWarpId: warp.destWarpId };
    }
  }

  // NewBattle runs on a turning pass too; turns do not count down the cooldown.
  if (player.justTurned) {
    const action = checkEncounter(deps, ow);
    if (action) return action;
  }

  // Each ordinary step, and each simulated half of a ledge hop.
  if (player.justFinishedStep) {
    const stepAction = handleStepComplete(deps, ow);
    if (stepAction) return stepAction;
  }

  return null;
}

/** CheckForHiddenEventOrBookshelfOrCardKeyDoor's finds, which come before `.displayDialogue`. */
function foundBeforeDialogue(interaction: Interaction): boolean {
  return 'item' in interaction || 'scriptId' in interaction || ('text' in interaction && interaction.preDialogue === true);
}

/**
 * START while BIT_SEEN_BY_TRAINER is set: `.displayDialogue` runs UpdateSprites, then sees the
 * bit and ends the pass (no menu). Only reachable with an adjacent trainer (A1c).
 */
export function seenStartPressed(deps: OverworldDeps): void {
  updateSprites(deps.npcs, deps.gameMap, deps.player, deps.pikachuFollower);
}

/**
 * The end of the spotting pass after EmotionBubble (CheckFightingMapTrainers): its
 * UpdateSprites, then the walk-up (TrainerWalkUpToPlayer) and the joypad mask. The caller
 * then runs the rest of the pass under that mask.
 */
export function finishTrainerEngage(
  deps: OverworldDeps,
  engage: { npc: Npc; steps: number; facing: Direction },
): void {
  updateSprites(deps.npcs, deps.gameMap, deps.player, deps.pikachuFollower);
  startTrainerWalkUp(engage.npc, engage.steps, engage.facing);
}

// ── Interaction handling ──────────────────────────────────────────────

/** Handle a player interaction (NPC talk, sign read, item pickup, script trigger). */
function handleInteraction(interaction: Interaction, deps: OverworldDeps, ow: OverworldState): OverworldAction | null {
  const { player, playerBag, currentMapName, findNpc } = deps;

  if ('npc' in interaction) {
    ow.interactedNpc = interaction.npc;
    const npcData = interaction.npc.data;

    // Starter/story balls have no item and keep their own handlers.
    if (npcData.item && !interaction.npc.hidden) {
      return { type: 'script', commands: itemBallScript(currentMapName, npcData.id, npcData.item) };
    }

    // Trainer not yet beaten: before-battle text, then the battle (home/trainers.asm
    // TalkToTrainer). The beaten flag is set only after a win (EndTrainerBattle).
    if (npcData.trainerClass && npcData.trainerParty !== undefined && !npcData.defeated) {
      trainerTalkedTo(currentMapName);
      return { type: 'talkToTrainer', npc: interaction.npc };
    }

    // Nurse Joy heals the party (full pokecenter sequence)
    if (npcData.id === 'nurse') {
      return { type: 'script', commands: buildNurseScript(findNpc, deps.onPokecenterHeal) };
    }

    // RedsHouse1F: Mom heals party after player has starter
    if (npcData.id === 'mom' && npcData.dialogue === '__MOM_HEAL__') {
      return { type: 'script', commands: buildMomHealScript(deps.onPokecenterHeal) };
    }

    // Route 1: Mart employee gives free Potion sample (one-time)
    if (currentMapName === 'Route1' && npcData.id === 'youngster1' && !hasFlag('GOT_POTION_SAMPLE')) {
      return {
        type: 'script',
        commands: potionSampleScript(),
      };
    }

    // BluesHouse: Daisy gives Town Map after player has Pokédex
    // (scripts/BluesHouse.asm BluesHouseDaisySittingText .give_town_map)
    if (npcData.id === 'daisy' && npcData.dialogue === '__DAISY_TOWN_MAP__') {
      return {
        type: 'script',
        commands: [
          // (text/BluesHouse.asm _BluesHouseDaisyOfferMapText)
          { type: 'text', message: "Grandpa asked you\nto run an errand?\nHere, this will\nhelp you!" },
          { type: 'giveItem', itemId: 'TOWN_MAP',
            successCommands: [
              // (text/BluesHouse.asm _GotMapText)
              { type: 'text', message: `${getPlayerName()} got a\nTOWN MAP!` },
              { type: 'setFlag', flag: 'GOT_TOWN_MAP' },
              { type: 'hideNpc', npcId: 'town_map' },
              { type: 'callback', fn: () => { npcData.dialogue = getText('BLUES_HOUSE_USE_MAP'); } },
            ],
            failCommands: [
              { type: 'text', message: "You have no more\nroom for items." },
            ],
          },
        ],
      };
    }

    // OaksLab: interacting with Eevee ball triggers rival snatching script
    if (npcData.id === 'item_ball' && hasFlag('OAK_ASKED_TO_CHOOSE_MON') && !hasFlag('GOT_STARTER')) {
      return { type: 'script', commands: buildOaksLabBallScript() };
    }

    // OaksLab: talking to Oak with parcel triggers delivery + Pokédex scene
    if (
      currentMapName === 'OaksLab' &&
      npcData.id === 'prof' &&
      hasFlag('BATTLED_RIVAL_IN_OAKS_LAB') &&
      !hasFlag('GOT_POKEDEX') &&
      playerBag.getCount('OAKS_PARCEL') > 0
    ) {
      const playerStepX = Math.round(player.x / 16);
      const playerStepY = Math.round(player.y / 16);
      return { type: 'script', commands: buildOaksLabPokedexScript(playerStepX, playerStepY, findNpc) };
    }

    // ViridianCity: the three old men (story/viridian_city.ts)
    if (currentMapName === VIRIDIAN_CITY) {
      if (npcData.id === 'oldman_blocking') {
        return { type: 'script', commands: buildSleepingOldManScript(false) };
      }
      if (npcData.id === 'oldman2' && !hasFlag('COMPLETED_CATCH_TRAINING')) {
        const playerStep = { x: Math.round(player.x / 16), y: Math.round(player.y / 16) };
        return { type: 'script', commands: buildOldMan2Script(false, playerStep) };
      }
      if (npcData.id === 'oldman1') {
        return { type: 'script', commands: buildOldMan1Script() };
      }
    }

    // ViridianCity: Youngster asks about caterpillar POKéMON (YES/NO choice)
    if (currentMapName === 'ViridianCity' && npcData.id === 'youngster2') {
      return {
        type: 'script',
        commands: [{
          type: 'yesNo',
          message: getText('VIRIDIAN_CATERPILLAR_ASK'),
          yesBranch: [{ type: 'text', message: "CATERPIE has no\npoison, but\nWEEDLE does.\fWatch out for its\nPOISON STING!" }],
          noBranch: [{ type: 'text', message: 'Oh, OK then!' }],
        }],
      };
    }

    // Mart clerk opens shop
    if (npcData.shopItems && npcData.shopItems.length > 0) {
      return { type: 'openShop', shopItems: npcData.shopItems };
    }

    // A beaten trainer says their after-battle text (TalkToTrainer, flag set).
    const text = npcData.defeated ? (npcData.afterBattleText ?? npcData.dialogue) : npcData.dialogue;
    // No text yet: the trade kid (trades are A4) and Oak's
    // Aide (HM05 is A2). Do nothing rather than open an empty text box.
    if (!text) {
      ow.interactedNpc = null;
      return null;
    }
    return { type: 'textbox', text };
  }

  if ('scriptId' in interaction) {
    // Player's PC (assembly: engine/menus/players_pc.asm)
    if (interaction.scriptId === 'RED_PC') {
      return { type: 'openPc' };
    }
    // Pokecenter PC (assembly: engine/menus/pokecenters/pokecenter_pc.asm)
    if (interaction.scriptId === 'POKECENTER_PC') {
      return { type: 'openPokecenterPc' };
    }

    // Blackboard interactive menu
    if (interaction.scriptId === 'VIRIDIAN_SCHOOL_BLACKBOARD') {
      return { type: 'openBlackboard' };
    }
    // Scripted hidden event (multi-page notebook, etc.)
    const script = getHiddenEventScript(interaction.scriptId);
    if (script) {
      return { type: 'script', commands: script };
    }
    return null;
  }

  if ('item' in interaction) {
    return { type: 'script', commands: hiddenItemScript(interaction.flag, interaction.item) };
  }

  // Sign or bookshelf text
  const pendingTownMap = interaction.text === 'A TOWN MAP.' || undefined;
  return { type: 'textbox', text: interaction.text, pendingTownMap };
}

// ── Step-complete checks ──────────────────────────────────────────────

/** RunMapScript, before Joypad, on every standing pass. */
export function runMapScript(deps: OverworldDeps, ow: OverworldState): OverworldAction | null {
  const { player, npcs, pikachuFollower, playerParty, currentMapName } = deps;
  if (player.isBusy || ow.doorExitStep) return null;

  // The trainer trio: CheckFightingMapTrainers / DisplayEnemyTrainerTextAndStartBattle /
  // EndTrainerBattle (map_trainers.ts, A1c)
  if (TRAINER_MAPS.has(currentMapName)) return trainerMapScript(currentMapName, player, npcs, ow);

  // Story trigger: Pallet Town north exit without Pokemon → Oak grass event
  if (
    currentMapName === 'PalletTown' &&
    !hasFlag('FOLLOWED_OAK_INTO_LAB')
  ) {
    if (player.mapStepY === 0) {
      return { type: 'script', commands: buildOakGrassScript(player.tileX) };
    }
  }

  // Story trigger: Viridian City's map script — the old men at (19, 9) and the Gym
  // door at (32, 8), dispatched on wViridianCityCurScript (story/viridian_city.ts)
  if (currentMapName === VIRIDIAN_CITY) {
    const stepX = Math.round(player.x / 16);
    const stepY = Math.round(player.y / 16);
    const step = viridianCityStep(getMapScript(VIRIDIAN_CITY), stepX, stepY, hasFlag);
    if (step.openGym) setFlag('VIRIDIAN_GYM_OPEN');
    if (step.trigger === 'sleepingOldMan') {
      return { type: 'script', commands: buildSleepingOldManScript(true) };
    }
    if (step.trigger === 'gymLocked') {
      return { type: 'script', commands: buildGymLockedScript() };
    }
    if (step.trigger === 'waitingOldMan') {
      return { type: 'script', commands: buildOldMan2Script(true, { x: stepX, y: stepY }) };
    }
  }

  // Story trigger: Oak's Lab — rival challenges player near door
  // Assembly: OaksLabRivalChallengesPlayerScript triggers at step Y=6
  if (
    currentMapName === 'OaksLab' &&
    hasFlag('GOT_STARTER') &&
    !hasFlag('BATTLED_RIVAL_IN_OAKS_LAB')
  ) {
    const stepY = Math.round(player.y / 16);
    if (stepY === 6) {
      const rival = npcs.find(n => n.data.id === 'rival');
      if (rival && !rival.hidden) {
        const rivalStepX = Math.round(rival.x / 16);
        const rivalStepY = Math.round(rival.y / 16);
        const playerStepX = Math.round(player.x / 16);
        return {
          type: 'script',
          commands: buildOaksLabRivalBattleScript(
            rivalStepX, rivalStepY, playerStepX, stepY,
            () => {
              pikachuFollower.visible = shouldPikachuFollow(playerParty);
              if (pikachuFollower.visible) {
                pikachuFollower.spawn(player.x, player.y, player.direction);
              }
            },
          ),
        };
      }
    }
  }

  return null;
}

/** NewBattle → DetermineWildOpponent → TryDoWildEncounter. */
function checkEncounter(deps: OverworldDeps, ow: OverworldState): OverworldAction | null {
  const { player, gameMap } = deps;
  const x = player.mapStepX * 2;
  const y = player.mapStepY * 2;
  const wild = tryWildEncounter({
    inGrass: gameMap.isGrassTile(x, y),
    inWater: gameMap.getTileAt(x, y + 1) === 0x14,
    indoor: gameMap.isIndoor,
    forest: gameMap.mapData?.tileset === 'FOREST',
    controlled: ow.doorExitStep || player.stepWasSimulated,
    movementBlocked: player.isBusy,
    onDoorOrWarp: gameMap.isInstantWarpTile(x, y),
    outsideMap: !gameMap.isInBounds(x, y),
    cooldown: ow.encounterCooldown,
    disabled: isNoEncounters(),
  });
  return wild ? { type: 'startBattle', pokemon: wild } : null;
}

/** The pure step-end sequence is shared by ordinary and simulated steps. */
export function handleStepComplete(deps: OverworldDeps, ow: OverworldState, simulated = deps.player.stepWasSimulated): OverworldAction | null {
  return runStepEnd<OverworldAction>(simulated, stage => {
    switch (stage) {
      case 'count':
        Object.assign(ow, countStep(ow));
        return null;
      case 'pikachu':
        // ApplyOutOfBattlePoisonDamage skips this when the party is empty.
        if (deps.playerParty.length > 0) {
          const starterAlive = deps.playerParty.some(mon => mon.species.id === 25 && mon.currentHp > 0);
          updatePikachuWalking(ow.stepCounter, () => Math.floor(Math.random() * 256), starterAlive);
        }
        return null;
      case 'encounter': return checkEncounter(deps, ow);
      case 'warp': return checkWarp(deps, ow);
      case 'connection': return checkConnection(deps);
    }
  });
}

function checkWarp(deps: OverworldDeps, ow: OverworldState): OverworldAction | null {
  const { player, gameMap } = deps;
  if (!ow.justWarped) {
    const warp = gameMap.getWarpAt(player.tileX, player.tileY);
    if (warp) {
      if (gameMap.isInstantWarpTile(player.tileX, player.tileY)) {
        ow.standingOnWarp = false;
        return { type: 'warp', destMap: warp.destMap, destWarpId: warp.destWarpId };
      }
      ow.standingOnWarp = true;
    } else {
      ow.standingOnWarp = false;
    }
  }
  ow.justWarped = false;
  return null;
}

function checkConnection({ player, gameMap }: OverworldDeps): OverworldAction | null {
  if (!gameMap.isInBounds(player.tileX, player.tileY)) {
    const connDir = DIR_TO_CONN[player.direction];
    const conn = gameMap.getConnection(connDir);
    if (conn) {
      return { type: 'connectToMap', destMap: conn.mapName, dir: connDir, offset: conn.offset };
    }
  }

  return null;
}

// ── Helper functions for building inline scripts ──────────────────────

/**
 * The nurse: DisplayPokemonCenterDialogue_ (engine/events/pokecenter.asm), one
 * DisplayTextID. Its PrintText calls open no new DisplayTextIDInit, so only the first box
 * updates sprites; CloseTextDisplay restores Pikachu's saved facing at the end. Pikachu's
 * branches are checked as they run: the heal can make a fainted starter eligible.
 * The healing machine keeps its present animation (its timing is not A6e's claim).
 */
export function buildNurseScript(findNpc: (id: string) => Npc | undefined, onHeal?: () => void): ScriptCommand[] {
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
    { type: 'text', message: getText('POKECENTER_WELCOME') },
    { type: 'pikachuFacing', action: 'save' },
    { type: 'uiEntryUpdates', enabled: false },
    // (data/text/text_7.asm _ShallWeHealYourPokemonText)
    {
      type: 'yesNo',
      message: getText('POKECENTER_HEAL_ASK'),
      yesBranch: [
        // UpdateSprites after YesNoChoicePokeCenter, then SetLastBlackoutMap
        { type: 'updateSprites' },
        ...(onHeal ? [{ type: 'callback' as const, fn: onHeal }] : []),
        // The starter alive and following: LoadCurrentMapView, Delay3, UpdateSprites,
        // PikachuWalksToNurseJoy (no refresh after it)
        { type: 'ifStarterPikachu', then: [
          { type: 'wait', frames: 3 },
          { type: 'updateSprites' },
          { type: 'pikachuToNurse' },
        ] },
        // (data/text/text_7.asm _NeedYourPokemonText), then 64 frames
        { type: 'text', message: getText('POKECENTER_NEED_MON') },
        { type: 'wait', frames: 64 },
        // DisablePikachuOverworldSpriteDrawing; Func_6eaa for a living starter
        { type: 'hidePikachu' },
        { type: 'ifStarterPikachu', then: nurseUp },
        // Func_6ebb(1, 8): left, toward the machine; 30 frames
        ...nurseFace('left'),
        { type: 'wait', frames: 30 },
        // AnimateHealingMachine (ends in UpdateSprites, Pikachu still undrawn), HealParty
        { type: 'pokecenterHeal' },
        // Func_6eaa for a living starter, spawn state 5, EnablePikachuOverworldSpriteDrawing
        { type: 'ifStarterPikachu', then: nurseUp },
        { type: 'showPikachu' },
        // Func_6ebb(1, 0): back down
        ...nurseFace('down'),
        // (data/text/text_7.asm _PokemonFightingFitText)
        { type: 'text', message: getText('POKECENTER_FIGHTING_FIT') },
        // Func_6ebb(15, 0): Pikachu faces down and its image is written — visible again
        // here, before the bow
        { type: 'ifStarterPikachu', then: [{ type: 'pikachuStandDown' }] },
        // LoadCurrentMapView, Delay3, UpdateSprites
        { type: 'wait', frames: 3 },
        { type: 'updateSprites' },
        // The bow: the nurse's image $01 for 40 frames, then UpdateSprites
        { type: 'callback', fn: () => { const n = findNpc('nurse'); if (n) n.useWalkFrame = true; } },
        { type: 'wait', frames: 40 },
        { type: 'callback', fn: () => { const n = findNpc('nurse'); if (n) n.useWalkFrame = false; } },
        { type: 'updateSprites' },
      ],
      noBranch: [],
    },
    // .done: (data/text/text_7.asm _PokemonCenterFarewellText), UpdateSprites
    { type: 'text', message: 'We hope to see\nyou again!' },
    { type: 'updateSprites' },
    // CloseTextDisplay
    { type: 'uiEntryUpdates', enabled: true },
    { type: 'pikachuFacing', action: 'restore' },
  ];
}

function buildMomHealScript(onHeal?: () => void): ScriptCommand[] {
  return [
    // (text/RedsHouse1F.asm _RedsHouse1FMomYouShouldRestText)
    { type: 'text', message: substituteNames(getText('MOM_REST')) },
    // Assembly: GBFadeOutToWhite → HealParty → GBFadeInFromWhite
    { type: 'fadeOut' },
    { type: 'healParty' },
    // Record blackout destination (Mom's house door → PalletTown)
    ...(onHeal ? [{ type: 'callback' as const, fn: onHeal }] : []),
    { type: 'wait', frames: 30 },
    { type: 'fadeIn' },
    // (text/RedsHouse1F.asm _RedsHouse1FMomLookingGreatText)
    { type: 'text', message: getText('MOM_LOOKING_GREAT') },
  ];
}
