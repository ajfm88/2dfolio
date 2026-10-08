// The trainer map script (home/trainers.asm): a map with trainer headers runs
// CheckFightingMapTrainers → DisplayEnemyTrainerTextAndStartBattle → EndTrainerBattle as
// w<Map>CurScript 0 → 1 → 2, from RunMapScript on every standing pass (before the joypad).
// notes/20-a1c-plan.md §1, §3.3.

import type { Direction } from '../core';
import type { Npc } from './npc';
import type { Player } from './player';
import { getMapScript, setMapScript } from '../events';
import { setJoyIgnore } from '../input/joy_ignore';
import { engagingTrainer, walkUpSteps } from './trainer_sight';
import type { SightTrainer } from './trainer_sight';

/** The maps whose default script is CheckFightingMapTrainers (trainer_tripwires.test.ts
 *  keeps this in step with pret's scripts/*.asm). */
export const TRAINER_MAPS: ReadonlySet<string> = new Set(['ViridianForest']);

/** w<Map>CurScript for the generic trio (gyms add their own phases after these, V3). */
export const TRAINER_SCRIPT = { DEFAULT: 0, START_BATTLE: 1, END_BATTLE: 2 } as const;

/** BIT_SEEN_BY_TRAINER and wSpriteIndex, kept across passes (OverworldState). */
export interface TrainerSightState {
  seenByTrainer: boolean;
  engagedNpc: Npc | null;
}

export type TrainerScriptAction =
  /** TrainerEngage found one: the music, EmotionBubble, then the walk-up (main.ts). */
  | { type: 'trainerEngage'; npc: Npc; steps: number; facing: Direction }
  /** The walk-up is over: DisplayTextID, then StartTrainerBattle. */
  | { type: 'trainerText'; npc: Npc };

/** An unbeaten standard map trainer (a header, not a script-run trainer like the rival). */
function isHeaderTrainer(npc: Npc): boolean {
  return npc.data.trainerClass !== undefined && npc.data.trainerParty !== undefined
    && npc.data.sightRange !== undefined;
}

/** What TrainerEngage reads of this trainer's sprite, or null when the header is skipped. */
export function sightOf(npc: Npc, player: Player, slot: number): SightTrainer | null {
  if (!isHeaderTrainer(npc) || npc.data.defeated) return null;
  const s = npc.collisionSprite(player.x, player.y, slot);
  return {
    x: s.x,
    y: s.y,
    facing: npc.direction,
    onScreen: s.available,
    engageDistance: ((npc.data.sightRange ?? 0) << 4) & 0xff,
  };
}

/**
 * One RunMapScript for a TRAINER_MAPS map (the player is standing).
 *   0 CheckFightingMapTrainers: the first engaging trainer in header (slot) order → 1.
 *   1 DisplayEnemyTrainerTextAndStartBattle: waits for the walk-up, then the text; the
 *     battle start makes it 2 (StartTrainerBattle).
 *   2 EndTrainerBattle (the first pass after the battle): clears the seen state → 0. No
 *     sight check runs on that pass.
 */
export function trainerMapScript(
  mapName: string,
  player: Player,
  npcs: readonly Npc[],
  ow: TrainerSightState,
): TrainerScriptAction | null {
  switch (getMapScript(mapName)) {
    case TRAINER_SCRIPT.START_BATTLE: {
      const npc = ow.engagedNpc;
      if (!npc) {
        // Nothing engaged (a stale save): back to the default script.
        endTrainerBattle(mapName, ow);
        return null;
      }
      // BIT_SCRIPTED_NPC_MOVEMENT: the walk-up hasn't read its terminator yet
      if (npc.movement.scripted) return null;
      setJoyIgnore('none');
      setMapScript(mapName, TRAINER_SCRIPT.END_BATTLE); // StartTrainerBattle, after the text
      return { type: 'trainerText', npc };
    }
    case TRAINER_SCRIPT.END_BATTLE:
      endTrainerBattle(mapName, ow);
      return null;
    default: {
      const slots = npcs.map((npc, i) => ({ npc, slot: i + 1 }));
      const hit = engagingTrainer(slots, t => sightOf(t.npc, player, t.slot), mapName === 'PowerPlant');
      if (!hit) return null;
      const sight = sightOf(hit.npc, player, hit.slot)!;
      ow.seenByTrainer = true;
      ow.engagedNpc = hit.npc;
      setMapScript(mapName, TRAINER_SCRIPT.START_BATTLE);
      return { type: 'trainerEngage', npc: hit.npc, steps: walkUpSteps(sight), facing: sight.facing };
    }
  }
}

/**
 * TalkToTrainer on an unbeaten trainer (BIT_USE_CUR_MAP_SCRIPT, then StartTrainerBattle):
 * the script is 2 when the battle ends, so its first pass back is EndTrainerBattle.
 */
export function trainerTalkedTo(mapName: string): void {
  if (TRAINER_MAPS.has(mapName)) setMapScript(mapName, TRAINER_SCRIPT.END_BATTLE);
}

/** EndTrainerBattle → ResetButtonPressedAndMapScript (also AllPokemonFainted's RunMapScript
 *  before a blackout): BIT_SEEN_BY_TRAINER, wJoyIgnore and the script cleared. */
export function endTrainerBattle(mapName: string, ow: TrainerSightState): void {
  ow.seenByTrainer = false;
  ow.engagedNpc = null;
  setJoyIgnore('none');
  if (TRAINER_MAPS.has(mapName)) setMapScript(mapName, TRAINER_SCRIPT.DEFAULT);
}

/**
 * The end of CheckFightingMapTrainers after EmotionBubble: wJoyIgnore = PAD_CTRL_PAD, then
 * TrainerWalkUpToPlayer → MoveSprite_ (wJoyIgnore = $ff) unless the trainer is adjacent.
 * The walk keeps the trainer's movement status (MoveSprite_ doesn't touch it).
 */
export function startTrainerWalkUp(npc: Npc, steps: number, facing: Direction): void {
  setJoyIgnore('dpad');
  if (steps === 0) return;
  npc.startScriptedMove(Array<Direction>(steps).fill(facing), undefined, true);
  setJoyIgnore('all');
}
