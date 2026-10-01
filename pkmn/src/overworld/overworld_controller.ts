// Overworld controller — per-frame overworld update logic.
//
// Returns an OverworldAction describing what main.ts should do next (state
// transition, battle start, etc.), or null when no action is needed.

import type { Player } from './player';
import type { GameMap } from './map';
import type { Npc } from './npc';
import type { PikachuFollower } from '../pikachu/pikachu_follower';
import type { BattlePokemon } from '../battle';
import type { Bag } from '../items';
import type { ScriptCommand } from '../script';
import { isPressed } from '../input';
import { hasFlag, setFlag } from '../events';
import { getItemName } from '../items';
import { tryWildEncounter } from '../battle';
import { isNoEncounters } from '../debug';
import { modifyPikachuHappiness, shouldPikachuFollow } from '../pikachu';
import { getPlayerName, substituteNames } from '../core/player_state';
import { getHiddenEventScript } from '../story/hidden_events';
import { getText } from '../text/game_text';
import { buildOakGrassScript } from '../story/pallet_town';
import {
  buildOaksLabBallScript,
  buildOaksLabRivalBattleScript,
  buildOaksLabPokedexScript,
} from '../story/oaks_lab';

// ── Types ─────────────────────────────────────────────────────────────

/** Mutable state tracked across overworld frames. */
export interface OverworldState {
  doorExitStep: boolean;
  justWarped: boolean;
  pikachuDeferredSpawn: boolean;
  standingOnWarp: boolean;
  happinessStepCounter: number;
  interactedNpc: Npc | null;
  approachingNpc: Npc | null;
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
  | { type: 'startTrainerBattle'; trainerClass: string; partyIndex: number; trainerName?: string; npcId: string }
  | { type: 'warp'; destMap: string; destWarpId: number }
  | { type: 'connectToMap'; destMap: string; dir: 'north' | 'south' | 'east' | 'west'; offset: number }
  | { type: 'trainerApproach'; npc: Npc }
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
    happinessStepCounter: 0,
    interactedNpc: null,
    approachingNpc: null,
  };
}

// ── Main update ───────────────────────────────────────────────────────

/** Run one frame of overworld logic. Returns an action for main.ts, or null. */
export function updateOverworld(
  deps: OverworldDeps,
  ow: OverworldState,
): OverworldAction | null {
  const { player, gameMap, npcs, pikachuFollower } = deps;

  // Door exit auto-step: after warping onto a door tile, walk one step down
  // before resuming normal player control (matches assembly PlayerStepOutFromDoor).
  if (ow.doorExitStep) {
    if (!player.isMoving) {
      if (player.justFinishedStep) {
        ow.doorExitStep = false;
        ow.justWarped = false;
        if (ow.pikachuDeferredSpawn) {
          pikachuFollower.visible = true;
          pikachuFollower.spawn(player.x, player.y, player.direction);
          ow.pikachuDeferredSpawn = false;
        }
      } else {
        player.forceStep('down');
      }
    }
    player.update(gameMap, npcs);
    return null;
  }

  // Check for NPC/sign/item interaction first (takes priority over Pikachu)
  const interaction = player.checkInteraction(gameMap, npcs);
  if (interaction) {
    return handleInteraction(interaction, deps, ow);
  }

  // Check for Pikachu interaction only if no other interaction found
  if (isPressed('a') && !player.isMoving && pikachuFollower.visible) {
    const facing = player.getFacingTile();
    const px = pikachuFollower.tileX, py = pikachuFollower.tileY;
    if (facing.tx >= px && facing.tx < px + 2 &&
        facing.ty >= py && facing.ty < py + 2) {
      const oppositeDir = { up: 'down', down: 'up', left: 'right', right: 'left' } as const;
      pikachuFollower.direction = oppositeDir[player.direction];
      return { type: 'pikachuEmotion' };
    }
  }

  player.update(gameMap, npcs);

  // Deferred Pikachu spawn: show Pikachu on the player's first step after a blackout warp
  // (doorExitStep handles this for normal door exits, but blackout skips that system)
  if (ow.pikachuDeferredSpawn && player.justStartedStep) {
    pikachuFollower.visible = true;
    pikachuFollower.spawn(player.x, player.y, player.direction);
    ow.pikachuDeferredSpawn = false;
  }

  // Record player step for Pikachu following at step START so both walk simultaneously
  if (player.justStartedStep && pikachuFollower.visible) {
    const dx = player.direction === 'left' ? -16 : player.direction === 'right' ? 16 : 0;
    const dy = player.direction === 'up' ? -16 : player.direction === 'down' ? 16 : 0;
    if (player.startedHop) {
      pikachuFollower.recordPlayerPosition(player.x, player.y, player.x + dx * 2, player.y + dy * 2);
      pikachuFollower.setLedgeHopPending(player.x + dx, player.y + dy);
    } else {
      pikachuFollower.recordPlayerPosition(player.x, player.y, player.x + dx, player.y + dy);
    }
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

  // Check for map transitions after completing a step
  if (player.justFinishedStep) {
    const stepAction = handleStepComplete(deps, ow);
    if (stepAction) return stepAction;
  }

  const pikaTile = pikachuFollower.visible ? { x: pikachuFollower.tileX, y: pikachuFollower.tileY } : undefined;
  for (const npc of npcs) {
    npc.update(
      (tx, ty) => gameMap.isWalkable(tx, ty),
      player.claimedTileX, player.claimedTileY,
      npcs, pikaTile,
    );
  }

  // Update Pikachu follower
  if (pikachuFollower.visible) pikachuFollower.update();

  // Check trainer line-of-sight (only after player finishes a step)
  if (player.justFinishedStep) {
    for (const npc of npcs) {
      if (npc.isPlayerInSight(player.tileX, player.tileY)) {
        npc.startApproach(player.x, player.y);
        ow.approachingNpc = npc;
        return { type: 'trainerApproach', npc };
      }
    }
  }

  return null;
}

// ── Interaction handling ──────────────────────────────────────────────

/** Handle a player interaction (NPC talk, sign read, item pickup, script trigger). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleInteraction(interaction: any, deps: OverworldDeps, ow: OverworldState): OverworldAction | null {
  const { player, playerBag, currentMapName, findNpc } = deps;

  if ('npc' in interaction) {
    ow.interactedNpc = interaction.npc;
    const npcData = interaction.npc.data;

    // Trainer battle
    if (npcData.trainerClass && npcData.trainerParty !== undefined && !npcData.defeated) {
      npcData.defeated = true;
      return {
        type: 'startTrainerBattle',
        trainerClass: npcData.trainerClass,
        partyIndex: npcData.trainerParty,
        trainerName: npcData.trainerName,
        npcId: npcData.id,
      };
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
        commands: [
          // (data/text/text_7.asm _Route1ViridianMartSampleText)
          { type: 'text', message: getText('ROUTE1_MART_SAMPLE') },
          { type: 'giveItem', itemId: 'POTION',
            successCommands: [
              { type: 'text', message: `${getPlayerName()} received\na POTION!` },
              { type: 'setFlag', flag: 'GOT_POTION_SAMPLE' },
            ],
            failCommands: [
              { type: 'text', message: "You have no more\nroom for items." },
            ],
          },
        ],
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

    const text = npcData.defeated ? 'I lost to you...' : npcData.dialogue;
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
    // Hidden item pickup
    if (hasFlag(interaction.flag)) return null; // already collected
    const added = playerBag.add(interaction.item);
    if (added) {
      setFlag(interaction.flag);
      const itemName = getItemName(interaction.item);
      return { type: 'textbox', text: `${getPlayerName()} found\n${itemName}!` };
    } else {
      return { type: 'textbox', text: "No more room for\nitems!" };
    }
  }

  // Sign or bookshelf text
  const pendingTownMap = interaction.text === 'A TOWN MAP.' || undefined;
  return { type: 'textbox', text: interaction.text, pendingTownMap };
}

// ── Step-complete checks ──────────────────────────────────────────────

/** Handle warp checks, story triggers, encounters, and happiness after a step completes. */
function handleStepComplete(deps: OverworldDeps, ow: OverworldState): OverworldAction | null {
  const { player, gameMap, npcs, pikachuFollower, playerParty, currentMapName } = deps;

  // Check warps (but not immediately after warping in)
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

  // Story trigger: Pallet Town north exit without Pokemon → Oak grass event
  if (
    currentMapName === 'PalletTown' &&
    !hasFlag('FOLLOWED_OAK_INTO_LAB') &&
    !hasFlag('GOT_STARTER')
  ) {
    if (player.tileY <= 0 && player.direction === 'up') {
      return { type: 'script', commands: buildOakGrassScript(player.tileX) };
    }
  }

  // Story trigger: Viridian City — old man blocks north path
  // Assembly: ViridianCityCheckSleepingOldMan triggers at (19, 9), pushes player down
  if (currentMapName === 'ViridianCity') {
    const stepX = Math.round(player.x / 16);
    const stepY = Math.round(player.y / 16);
    if (stepX === 19 && stepY === 9 && player.direction === 'up') {
      if (!hasFlag('GOT_POKEDEX')) {
        return {
          type: 'script',
          commands: [
            { type: 'text', message: "You can't go\nthrough here!\fThis is private\nproperty!" },
            { type: 'movePlayer', path: ['down'] },
          ],
        };
      } else {
        return {
          type: 'script',
          commands: [
            { type: 'text', message: "Ah, I've had my\ncoffee now and I\nfeel great!\fBut this is as far\nas the demo goes!\fThanks for playing!" },
            { type: 'movePlayer', path: ['down'] },
          ],
        };
      }
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
    if (stepY >= 6) {
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

  // Check map connections (player walked off edge)
  if (!gameMap.isInBounds(player.tileX, player.tileY)) {
    const connDir = DIR_TO_CONN[player.direction];
    const conn = gameMap.getConnection(connDir);
    if (conn) {
      return { type: 'connectToMap', destMap: conn.mapName, dir: connDir, offset: conn.offset };
    }
  }

  // Check for wild encounters (only on grass tiles, unless disabled)
  if (!isNoEncounters() && gameMap.isGrassTile(player.tileX, player.tileY)) {
    const wild = tryWildEncounter(true);
    if (wild) {
      return { type: 'startBattle', pokemon: wild };
    }
  }

  // Pikachu happiness: walking modifier every 256 steps
  ow.happinessStepCounter++;
  if (ow.happinessStepCounter >= 256) {
    ow.happinessStepCounter = 0;
    modifyPikachuHappiness('WALKING');
  }

  return null;
}

// ── Helper functions for building inline scripts ──────────────────────

function buildNurseScript(findNpc: (id: string) => Npc | undefined, onHeal?: () => void): ScriptCommand[] {
  return [
    // (data/text/text_7.asm _PokemonCenterWelcomeText)
    { type: 'text', message: getText('POKECENTER_WELCOME') },
    // (data/text/text_7.asm _ShallWeHealYourPokemonText)
    {
      type: 'yesNo',
      message: getText('POKECENTER_HEAL_ASK'),
      yesBranch: [
        // Assembly: PikachuWalksToNurseJoy — Pikachu hops to the nurse before she speaks
        { type: 'pikachuToNurse' },
        // (data/text/text_7.asm _NeedYourPokemonText)
        { type: 'text', message: getText('POKECENTER_NEED_MON') },
        { type: 'wait', frames: 64 },
        // Assembly: DisablePikachuOverworldSpriteDrawing — hide Pikachu as nurse turns
        { type: 'hidePikachu' },
        // Nurse turns: UP first, then LEFT toward machine (assembly Func_6eaa → Func_6ebb)
        { type: 'faceNpc', npcId: 'nurse', direction: 'up' },
        { type: 'wait', frames: 30 },
        { type: 'faceNpc', npcId: 'nurse', direction: 'left' },
        { type: 'wait', frames: 20 },
        // Pokeball machine animation + heal
        { type: 'pokecenterHeal' },
        // Record last blackout map (assembly: SetLastBlackoutMap after heal)
        ...(onHeal ? [{ type: 'callback' as const, fn: onHeal }] : []),
        // Assembly: EnablePikachuOverworldSpriteDrawing — show Pikachu as nurse turns back
        { type: 'showPikachu' },
        // Nurse turns back: UP first, then DOWN (assembly Func_6eaa → Func_6ebb)
        { type: 'faceNpc', npcId: 'nurse', direction: 'up' },
        { type: 'wait', frames: 30 },
        { type: 'faceNpc', npcId: 'nurse', direction: 'down' },
        // (data/text/text_7.asm _PokemonFightingFitText)
        { type: 'text', message: getText('POKECENTER_FIGHTING_FIT') },
        // Nurse bow: walk-down frame for 40 frames (assembly hSpriteImageIndex=1)
        { type: 'callback', fn: () => { const n = findNpc('nurse'); if (n) n.useWalkFrame = true; } },
        { type: 'wait', frames: 40 },
        { type: 'callback', fn: () => { const n = findNpc('nurse'); if (n) n.useWalkFrame = false; } },
        // (data/text/text_7.asm _PokemonCenterFarewellText)
        { type: 'text', message: 'We hope to see\nyou again!' },
      ],
      noBranch: [
        // (data/text/text_7.asm _PokemonCenterFarewellText)
        { type: 'text', message: 'We hope to see\nyou again!' },
      ],
    },
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
