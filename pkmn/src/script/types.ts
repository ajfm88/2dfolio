// Script engine types — commands and runner state for scripted cutscene sequences

import type { Direction } from '../core';
import type { CatchDemoBattleType } from '../battle/catch_demo';
import type { NpcWalkMode } from '../overworld/walk_pace';

export type ScriptCommand =
  | { type: 'text'; message: string }
  // MoveSprite: each step normal (1 px a pass) or fast (Yellow's $04–$07, 2 px a pass);
  // `modes` gives each step's mode, missing entries are normal (walk_pace.ts)
  | { type: 'moveNpc'; npcId: string; path: Direction[]; modes?: NpcWalkMode[] }
  | { type: 'movePlayer'; path: Direction[] }
  | { type: 'faceNpc'; npcId: string; direction: Direction }
  | { type: 'facePlayer'; direction: Direction }
  | { type: 'wait'; frames: number }
  | { type: 'setFlag'; flag: string }
  | { type: 'clearFlag'; flag: string }
  // w<Map>CurScript's resting value (events.ts setMapScript)
  | { type: 'setMapScript'; map: string; state: number }
  // One simulated joypad step (StartSimulatingJoypadStates): unlike movePlayer it
  // goes through collision, so a blocked step only turns the player
  | { type: 'pushPlayer'; direction: Direction }
  // TryApplyPikachuMovementData from a map script (try_pikachu_movement.asm): runs the
  // caller's movement program (pikachu_movement.ts) when the starter is out and Pikachu is
  // on the expected side, then refreshes following. Viridian expects RIGHT; Oak's Lab
  // picks its program and side by the player's Y (OaksLabPikachuMovementScript).
  | { type: 'tryPikachuMovement'; caller: 'viridianStepAside' | 'oaksLab' }
  | { type: 'addPokemon'; species: string | number; level: number }
  | { type: 'showNpc'; npcId: string; x: number; y: number; sprite: string; direction?: Direction }
  | { type: 'hideNpc'; npcId: string }
  | { type: 'callback'; fn: () => void }
  | { type: 'warp'; map: string; warpId: number }
  | { type: 'exclamation'; target: 'player' | string; frames: number }
  // The catch demo (battle/catch_demo.ts): the script sets wBattleType, wCurOpponent and
  // wCurEnemyLevel (PalletTownPikachuBattleScript, ViridianCity...SetupBattle)
  | { type: 'catchDemo'; battleType: CatchDemoBattleType; species: string; level: number }
  // An NPC and the player walk at once. `npcInStep`: DoScriptedNPCMovement (2 px a pass,
  // in step with the player); otherwise MoveSprite with `npcModes`. `playerFromNpcStep`:
  // the player's simulated presses start once the NPC has begun that many steps.
  | {
      type: 'moveParallel'; npcId: string; npcPath: Direction[]; playerPath: Direction[];
      npcInStep?: boolean; npcModes?: NpcWalkMode[]; playerFromNpcStep?: number;
    }
  | { type: 'unhideNpc'; npcId: string }
  | { type: 'awaitInteraction'; npcId: string; guardStepY: number; guardText: string }
  | { type: 'startBattle'; trainerClass: string; partyIndex: number; trainerName?: string; endBattleText?: string }
  | { type: 'healParty' }
  | { type: 'pokecenterHeal' }
  // DisplayPokemonCenterDialogue_'s Pikachu calls (engine/events/pokecenter.asm):
  // LoadCurrentMapView, Delay3, UpdateSprites, then PikachuWalksToNurseJoy's program
  | { type: 'pikachuToNurse' }
  // DisablePikachuOverworldSpriteDrawing / EnablePikachuOverworldSpriteDrawing (with spawn
  // state 5 pending). Enabling draws nothing until something writes the image.
  | { type: 'hidePikachu' }
  | { type: 'showPikachu' }
  // Func_6ebb(15, 0): Pikachu's facing down, 6 frames, then its standing image written
  | { type: 'pikachuStandDown' }
  // An explicit UpdateSprites with the font loaded (Pikachu: TrySpawnPikachu, then Func_fc76a)
  | { type: 'updateSprites' }
  // PrintText inside one DisplayTextID runs no DisplayTextIDInit: no sprite update on open
  | { type: 'uiEntryUpdates'; enabled: boolean }
  // DisplayTextIDInit saves sprite facings, CloseTextDisplay restores them (Pikachu's)
  | { type: 'pikachuFacing'; action: 'save' | 'restore' }
  // A branch on the starter at the moment it runs: IsStarterPikachuAliveInOurParty, and
  // CheckPikachuFollowingPlayer (Pikachu's following is never disabled on today's maps)
  | { type: 'ifStarterPikachu'; then: ScriptCommand[] }
  | { type: 'fadeOut'; frames?: number }
  | { type: 'fadeIn'; frames?: number }
  | { type: 'yesNo'; message: string; yesBranch: ScriptCommand[]; noBranch: ScriptCommand[] }
  | { type: 'giveItem'; itemId: string; count?: number; successCommands?: ScriptCommand[]; failCommands?: ScriptCommand[] }
  | { type: 'removeItem'; itemId: string; count?: number };

export interface ScriptRunner {
  /** The command list. */
  commands: ScriptCommand[];
  /** Current command index. */
  index: number;
  /** Whether this script is actively running. */
  active: boolean;
  /** Per-command state for multi-frame commands. */
  commandState: CommandState | null;
}

export type CommandState =
  | { type: 'text'; done: boolean }
  | { type: 'move'; pathIndex: number; moveProgress: number; target: 'npc' | 'player'; npcId?: string; path: Direction[]; speed: number }
  | { type: 'wait'; remaining: number };
