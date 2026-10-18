// Overworld controller — per-frame overworld update logic.
//
// Returns an OverworldAction describing what main.ts should do next (state
// transition, battle start, etc.), or null when no action is needed.

import type { Direction } from '../core';

import type { Player, Interaction } from './player';
import type { GameMap } from './map';
import type { Npc } from './npc';
import { mapTextKind, mapTextCall } from '../text/map_text_calls';
import type { PikachuFollower } from '../pikachu/pikachu_follower';
import type { BattlePokemon } from '../battle';
import type { Bag } from '../items';
import type { ScriptCommand } from '../script';
import { isPassPressed } from '../input';
import { updateSprites, recordStepForPikachu, spriteTable } from './sprites';
import { hasFlag, setFlag, getMapScript } from '../events';
import { itemBallScript, hiddenItemScript } from './item_pickup';
import { tryWildEncounter } from '../battle';
import { isNoEncounters } from '../debug';
import { shouldPikachuFollow } from '../pikachu';
import { updatePikachuWalking } from '../pikachu/pikachu_happiness';
import { countStep, runStepEnd } from './step_end';
import type { StepCounters } from './step_end';
import '../story/small_text_handlers';
import '../story/lab_text_handlers';
import '../story/pokecenter';
import '../story/mart';
import { getTextHandler, getTextScript, displayTextID } from '../story/text_handlers';
import { mapAutoTextBox, applyMapAutoTextBox } from '../text/auto_text_box';
import type { TextHandlerContext } from '../story/text_handlers';
import { getOwnedCount } from '../pokedex_state';
import { bookshelfContext, interactionDisplay } from '../story/hidden_events';
import { buildOakGrassScript } from '../story/pallet_town';
import {
  VIRIDIAN_CITY, viridianCityStep, buildSleepingOldManScript, buildGymLockedScript,
  buildOldMan2Script,
} from '../story/viridian_city';
import { TRAINER_MAPS, trainerMapScript, trainerTalkedTo, startTrainerWalkUp } from './map_trainers';
import type { TrainerSightState, TrainerScriptAction } from './map_trainers';
import {
  buildOaksLabRivalBattleScript,
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
  | { type: 'textbox'; text: string; call?: 'text' | 'printText'; autoBox?: boolean; program?: string }
  | { type: 'script'; commands: ScriptCommand[] }

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
  return 'item' in interaction || 'scriptId' in interaction || 'program' in interaction
    || ('text' in interaction && interaction.preDialogue === true);
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

function textContext(deps: OverworldDeps, shopItems?: string[]): TextHandlerContext {
  return { hasFlag, bag: deps.playerBag, ownedCount: getOwnedCount(),
    party: deps.playerParty, facing: deps.player.direction, findNpc: deps.findNpc,
    step: { x: deps.player.mapStepX, y: deps.player.mapStepY }, onHeal: deps.onPokecenterHeal, shopItems };
}

function handlerAction(textId: number | undefined, deps: OverworldDeps, shopItems?: string[]): OverworldAction | null {
  const alternate = deps.currentMapName === 'OaksLab' ? hasFlag('PALLET_AFTER_GETTING_POKEBALLS_2')
    : deps.currentMapName === 'ViridianMart' && hasFlag('OAK_GOT_PARCEL');
  const call = mapTextCall(deps.currentMapName, textId, undefined, alternate);
  const handler = call?.call === 'handler' ? getTextHandler(deps.currentMapName, textId)
    : call?.call === 'script' ? getTextScript(call.script) : undefined;
  if (!handler) return null; // unmigrated/excluded callers retain their existing path
  return { type: 'script', commands: applyMapAutoTextBox(handler(textContext(deps, shopItems)), deps.currentMapName) };
}

/** Handle a player interaction (NPC talk, sign read, item pickup, script trigger). */
function handleInteraction(interaction: Interaction, deps: OverworldDeps, ow: OverworldState): OverworldAction | null {
  const { currentMapName } = deps;

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

    const handler = handlerAction(npcData.textId, deps, npcData.shopItems);
    if (handler) return handler;
    // Table 1's clerk still says the parcel reminder. Table 2 is the mart script.
    if (currentMapName === 'ViridianMart' && npcData.textId === 1 && !hasFlag('OAK_GOT_PARCEL'))
      return { type: 'script', commands: displayTextID([{ type: 'printText', program: 'ViridianMartClerkSayHiToOakText', box: 'keep' }]) };

    // A beaten trainer says their after-battle text (TalkToTrainer, flag set).
    const text = npcData.defeated ? (npcData.afterBattleText ?? npcData.dialogue) : npcData.dialogue;
    // No text yet: the trade kid (trades are A4) and Oak's
    // Aide (HM05 is A2). Do nothing rather than open an empty text box.
    if (!text) {
      ow.interactedNpc = null;
      return null;
    }
    const call = mapTextKind(currentMapName, npcData.textId, undefined,
      currentMapName === 'OaksLab' ? hasFlag('PALLET_AFTER_GETTING_POKEBALLS_2') : currentMapName === 'ViridianMart' && hasFlag('OAK_GOT_PARCEL'));
    const noAuto = !mapAutoTextBox(currentMapName);
    const labCall = noAuto ? mapTextCall(currentMapName, npcData.textId) : undefined;
    return { type: 'textbox', text, ...(call ? { call } : {}), ...(noAuto ? {
      autoBox: false, ...(labCall?.call === 'text' || labCall?.call === 'printText' ? { program: labCall.program } : {}),
    } : {}) };
  }

  if ('scriptId' in interaction || 'program' in interaction) {
    const commands = interactionDisplay(interaction, textContext(deps), bookshelfContext(deps.player, deps.gameMap));
    return commands ? { type: 'script', commands } : null;
  }

  if ('item' in interaction) {
    return { type: 'script', commands: hiddenItemScript(interaction.flag, interaction.item) };
  }

  // Sign or bookshelf text
  const handler = handlerAction(interaction.textId, deps);
  if (handler) return handler;
  const call = mapTextKind(currentMapName, interaction.textId);
  return { type: 'textbox', text: interaction.text, ...(call ? { call } : {}) };
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
