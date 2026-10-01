// Script engine types — commands and runner state for scripted cutscene sequences

import type { Direction } from '../core';

export type ScriptCommand =
  | { type: 'text'; message: string }
  | { type: 'moveNpc'; npcId: string; path: Direction[]; speed?: number }
  | { type: 'movePlayer'; path: Direction[] }
  | { type: 'faceNpc'; npcId: string; direction: Direction }
  | { type: 'facePlayer'; direction: Direction }
  | { type: 'wait'; frames: number }
  | { type: 'setFlag'; flag: string }
  | { type: 'addPokemon'; species: string | number; level: number }
  | { type: 'showNpc'; npcId: string; x: number; y: number; sprite: string; direction?: Direction }
  | { type: 'hideNpc'; npcId: string }
  | { type: 'callback'; fn: () => void }
  | { type: 'warp'; map: string; warpId: number }
  | { type: 'exclamation'; target: 'player' | string; frames: number }
  | { type: 'pikachuBattle' }
  | { type: 'moveParallel'; npcId: string; npcPath: Direction[]; playerPath: Direction[] }
  | { type: 'unhideNpc'; npcId: string }
  | { type: 'awaitInteraction'; npcId: string; guardStepY: number; guardText: string }
  | { type: 'startBattle'; trainerClass: string; partyIndex: number; trainerName?: string }
  | { type: 'healParty' }
  | { type: 'pokecenterHeal' }
  | { type: 'pikachuToNurse' }
  | { type: 'hidePikachu' }
  | { type: 'showPikachu' }
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
