// Script controller — owns all script execution state extracted from main.ts.
// updateScript() returns actions for state transitions that main.ts processes.

import type { ScriptCommand, ScriptRunner } from './types';
import { createScript, currentCommand, advanceScript } from './engine';
import type { TextBox } from '../text';
import type { Player } from '../overworld/player';
import type { GameMap } from '../overworld/map';
import { Npc } from '../overworld/npc';
import type { BattlePokemon } from '../battle';
import type { PikachuFollower } from '../pikachu/pikachu_follower';
import { createPokemon, initExperience } from '../battle';
import type { Bag } from '../items';
import { getItemName } from '../items';
import { loadSprite, getCtx, getScale, drawExclamationBubble } from '../renderer';
import { isPressed } from '../input';
import { setFlag, hasFlag } from '../events';
import { getPlayerName } from '../core/player_state';
import { markOwned } from '../pokedex_state';
import { YesNoMenu } from '../menus';

// ── Dependencies passed by main.ts each frame ──────────────────────────

export interface ScriptDeps {
  textBox: TextBox;
  player: Player;
  gameMap: GameMap;
  npcs: Npc[];
  playerParty: BattlePokemon[];
  playerBag: Bag;
  pikachuTile?: { x: number; y: number };
  pikachuFollower?: PikachuFollower;
}

// ── Actions returned to main.ts ────────────────────────────────────────

export type ScriptAction =
  | { type: 'scriptEnded' }
  | { type: 'pikachuBattle' }
  | { type: 'startBattleTransition'; trainerClass: string; partyIndex: number; trainerName?: string }
  | { type: 'warp'; map: string; warpId: number }
  | { type: 'openStartMenu' };

// ── Module-level script state ──────────────────────────────────────────

let activeScript: ScriptRunner | null = null;
let scriptTextWaiting = false;
let scriptMoveTarget: 'npc' | 'player' | 'parallel' | null = null;
let scriptMoveNpcId: string | null = null;
let scriptWaitFrames = 0;
let scriptExclamation: { target: 'player' | string; frames: number } | null = null;
let scriptFade: { direction: 'out' | 'in'; frames: number; elapsed: number } | null = null;
let scriptAsyncPending = false;
let scriptBattlePending = false;

const yesNoMenu = new YesNoMenu();
let scriptYesNoPending: { yes: ScriptCommand[]; no: ScriptCommand[] } | null = null;
let scriptYesNoActive = false;

let scriptAwaitInteraction: {
  npcId: string;
  guardStepY: number;
  guardText: string;
} | null = null;
let scriptFreeSub: 'move' | 'text' | 'target' | 'guard_text' | 'guard_step' = 'move';

// Pokecenter heal animation state (pokeball machine animation)
// Offsets from nurse position — derived from original OAM PokeCenterOAMData
const HEAL_MONITOR_OFFSET = { dx: -20, dy: -12 };
const HEAL_BALL_OFFSETS = [
  { dx: -24, dy: -5, flip: false },
  { dx: -16, dy: -5, flip: true },
  { dx: -24, dy: 0, flip: false },
  { dx: -16, dy: 0, flip: true },
  { dx: -24, dy: 5, flip: false },
  { dx: -16, dy: 5, flip: true },
];
const HEAL_PLACE_FRAMES = 30;
const HEAL_JINGLE_FRAMES = 60;
const HEAL_FLASH_FRAMES = 10;
const HEAL_FLASH_CYCLES = 16; // 8 on/off cycles
let healMachineSprite: HTMLCanvasElement | null = null;
let pokecenterHealAnim: {
  phase: 'place' | 'jingle' | 'flash';
  partyCount: number;
  placed: number;
  timer: number;
  flashCount: number;
  flashVisible: boolean;
} | null = null;

let scriptPikachuMoving = false;  // waiting for Pikachu to finish walking to nurse
let pokecenterHealHidPikachu = false; // track if we hid Pikachu during heal

const DEFAULT_FADE_FRAMES = 8;

// Computed fade alpha for the current frame (set during updateScript, read by main.ts)
let scriptFadeAlpha: number | null = null;

// Dynamic NPCs created by scripts (separate from map NPCs)
const scriptNpcs: Npc[] = [];

// ── Public accessors ───────────────────────────────────────────────────

export function getActiveScript(): ScriptRunner | null {
  return activeScript;
}

export function isScriptBattlePending(): boolean {
  return scriptBattlePending;
}

export function clearScriptBattlePending(): void {
  scriptBattlePending = false;
}

export function advanceActiveScript(): void {
  if (activeScript) advanceScript(activeScript);
}

export function getScriptNpcs(): readonly Npc[] {
  return scriptNpcs;
}

export function clearScriptNpcs(): void {
  scriptNpcs.length = 0;
}

/** Returns computed fade alpha for the current frame, or null if no script fade active. */
export function getScriptFadeAlpha(): number | null {
  return scriptFadeAlpha;
}

/** Find an NPC by ID (checks both map NPCs and script-created NPCs). */
export function lookupNpc(id: string, mapNpcs: Npc[]): Npc | undefined {
  return mapNpcs.find(n => n.data.id === id) ?? scriptNpcs.find(n => n.data.id === id);
}

// ── Script lifecycle ───────────────────────────────────────────────────

/** Initialize a scripted cutscene. Caller must set game state to 'script'. */
export function initScript(commands: ScriptCommand[]): void {
  activeScript = createScript(commands);
  scriptTextWaiting = false;
  scriptMoveTarget = null;
  scriptMoveNpcId = null;
  scriptWaitFrames = 0;
  scriptAsyncPending = false;
  scriptExclamation = null;
  scriptFade = null;
  scriptAwaitInteraction = null;
  scriptFreeSub = 'move';
  scriptYesNoPending = null;
  scriptYesNoActive = false;
  pokecenterHealAnim = null;
  scriptPikachuMoving = false;
  pokecenterHealHidPikachu = false;
}

/** Update the script engine (called each frame while in 'script' state).
 *  Returns an action when main.ts needs to handle a state transition. */
export function updateScript(deps: ScriptDeps): ScriptAction | null {
  const { textBox, player, npcs, playerParty, playerBag, pikachuFollower } = deps;
  scriptFadeAlpha = null; // reset each frame; set below if fade active

  // Update Pikachu follower every frame so it can animate during scripts
  if (pikachuFollower?.visible) pikachuFollower.update();

  if (!activeScript || !activeScript.active) {
    activeScript = null;
    return { type: 'scriptEnded' };
  }

  // Handle awaitInteraction: player has free movement until they interact with target
  if (scriptAwaitInteraction) {
    return updateScriptFreeMove(deps);
  }

  // Handle waiting states
  if (scriptTextWaiting) {
    if (scriptYesNoActive) {
      const result = yesNoMenu.update();
      if (result !== null) {
        scriptYesNoActive = false;
        scriptTextWaiting = false;
        textBox.dismiss();
        const branches = scriptYesNoPending!;
        scriptYesNoPending = null;
        const chosen = result === 'yes' ? branches.yes : branches.no;
        activeScript!.commands.splice(activeScript!.index + 1, 0, ...chosen);
        advanceScript(activeScript!);
      }
      return null;
    }

    textBox.update();

    if (scriptYesNoPending && textBox.isWaitingForInput && !textBox.hasMorePages) {
      yesNoMenu.show();
      scriptYesNoActive = true;
      return null;
    }

    if (!textBox.active) {
      scriptTextWaiting = false;
      advanceScript(activeScript!);
    }
    return null;
  }

  if (scriptWaitFrames > 0) {
    scriptWaitFrames--;
    if (scriptWaitFrames <= 0) {
      advanceScript(activeScript);
    }
    return null;
  }

  if (scriptFade) {
    scriptFade.elapsed++;
    const t = Math.min(scriptFade.elapsed / scriptFade.frames, 1);
    scriptFadeAlpha = scriptFade.direction === 'out' ? t : 1 - t;
    if (t >= 1) {
      scriptFade = null;
      advanceScript(activeScript);
    }
    return null;
  }

  if (pokecenterHealAnim) {
    const anim = pokecenterHealAnim;
    anim.timer--;
    if (anim.phase === 'place') {
      if (anim.timer <= 0) {
        anim.placed++;
        if (anim.placed >= anim.partyCount) {
          anim.phase = 'jingle';
          anim.timer = HEAL_JINGLE_FRAMES;
        } else {
          anim.timer = HEAL_PLACE_FRAMES;
        }
      }
    } else if (anim.phase === 'jingle') {
      if (anim.timer <= 0) {
        anim.phase = 'flash';
        anim.timer = HEAL_FLASH_FRAMES;
      }
    } else if (anim.phase === 'flash') {
      if (anim.timer <= 0) {
        anim.flashVisible = !anim.flashVisible;
        anim.flashCount++;
        if (anim.flashCount >= HEAL_FLASH_CYCLES) {
          // Heal the party
          for (const mon of playerParty) {
            mon.currentHp = mon.maxHp;
            mon.status = null;
            mon.sleepTurns = 0;
            mon.toxicCounter = 0;
            mon.badlyPoisoned = false;
            for (const move of mon.moves) {
              move.pp = move.maxPp;
            }
          }
          pokecenterHealAnim = null;
          advanceScript(activeScript);
        } else {
          anim.timer = HEAL_FLASH_FRAMES;
        }
      }
    }
    return null;
  }

  if (scriptExclamation) {
    scriptExclamation.frames--;
    if (scriptExclamation.frames <= 0) {
      scriptExclamation = null;
      advanceScript(activeScript);
    }
    return null;
  }

  // Wait for Pikachu to finish walking to nurse (pikachuToNurse command)
  if (scriptPikachuMoving && pikachuFollower) {
    // Pikachu is done when its position buffer is empty and it's not mid-step
    if (!pikachuFollower.isMoving && pikachuFollower.bufferLength === 0) {
      scriptPikachuMoving = false;
      advanceScript(activeScript);
    }
    return null;
  }

  if (scriptMoveTarget === 'npc' && scriptMoveNpcId) {
    const npc = lookupNpc(scriptMoveNpcId, npcs);
    if (npc) {
      npc.updateScriptedMove();
      if (npc.scriptedMoveDone) {
        scriptMoveTarget = null;
        scriptMoveNpcId = null;
        advanceScript(activeScript);
      }
    } else {
      scriptMoveTarget = null;
      advanceScript(activeScript);
    }
    return null;
  }

  if (scriptMoveTarget === 'parallel' && scriptMoveNpcId) {
    const npc = lookupNpc(scriptMoveNpcId, npcs);
    if (npc) npc.updateScriptedMove();
    const wasMoving = player.isMoving;
    player.updateScriptedMove();
    if (!wasMoving && player.isMoving && pikachuFollower?.visible) {
      const dx = player.direction === 'left' ? -16 : player.direction === 'right' ? 16 : 0;
      const dy = player.direction === 'up' ? -16 : player.direction === 'down' ? 16 : 0;
      pikachuFollower.recordPlayerPosition(player.x, player.y, player.x + dx, player.y + dy);
    }
    const npcDone = npc ? npc.scriptedMoveDone : true;
    if (npcDone && player.scriptedMoveDone) {
      scriptMoveTarget = null;
      scriptMoveNpcId = null;
      advanceScript(activeScript);
    }
    return null;
  }

  if (scriptMoveTarget === 'player') {
    const wasMoving = player.isMoving;
    player.updateScriptedMove();
    // Record step start for Pikachu following
    if (!wasMoving && player.isMoving && pikachuFollower?.visible) {
      const dx = player.direction === 'left' ? -16 : player.direction === 'right' ? 16 : 0;
      const dy = player.direction === 'up' ? -16 : player.direction === 'down' ? 16 : 0;
      pikachuFollower.recordPlayerPosition(player.x, player.y, player.x + dx, player.y + dy);
    }
    if (player.scriptedMoveDone) {
      scriptMoveTarget = null;
      advanceScript(activeScript);
    }
    return null;
  }

  // Wait for async operations (e.g., showNpc sprite loading)
  if (scriptAsyncPending) return null;

  // Execute the next command
  const cmd = currentCommand(activeScript);
  if (!cmd) {
    activeScript = null;
    return { type: 'scriptEnded' };
  }

  switch (cmd.type) {
    case 'text':
      textBox.show(cmd.message);
      scriptTextWaiting = true;
      break;

    case 'moveNpc': {
      const npc = lookupNpc(cmd.npcId, npcs);
      if (npc) {
        npc.startScriptedMove(cmd.path);
        scriptMoveTarget = 'npc';
        scriptMoveNpcId = cmd.npcId;
      } else {
        advanceScript(activeScript);
      }
      break;
    }

    case 'movePlayer':
      player.startScriptedMove(cmd.path);
      scriptMoveTarget = 'player';
      break;

    case 'faceNpc': {
      const npc = lookupNpc(cmd.npcId, npcs);
      if (npc) npc.faceDirection(cmd.direction);
      advanceScript(activeScript);
      break;
    }

    case 'facePlayer':
      player.direction = cmd.direction;
      advanceScript(activeScript);
      break;

    case 'wait':
      scriptWaitFrames = cmd.frames;
      break;

    case 'setFlag':
      setFlag(cmd.flag);
      advanceScript(activeScript);
      break;

    case 'addPokemon': {
      const mon = createPokemon(cmd.species, cmd.level);
      if (mon) {
        initExperience(mon);
        mon.otName = getPlayerName();
        playerParty.push(mon);
        markOwned(mon.species.id);
      }
      advanceScript(activeScript);
      break;
    }

    case 'giveItem': {
      const added = playerBag.add(cmd.itemId, cmd.count ?? 1);
      if (added && cmd.successCommands) {
        activeScript!.commands.splice(activeScript!.index + 1, 0, ...cmd.successCommands);
      } else if (!added && cmd.failCommands) {
        activeScript!.commands.splice(activeScript!.index + 1, 0, ...cmd.failCommands);
      }
      advanceScript(activeScript!);
      break;
    }

    case 'removeItem':
      playerBag.remove(cmd.itemId, cmd.count ?? 1);
      advanceScript(activeScript);
      break;

    case 'showNpc': {
      const npcData = {
        id: cmd.npcId,
        sprite: cmd.sprite,
        x: cmd.x,
        y: cmd.y,
        movement: 'stay' as const,
        direction: cmd.direction,
        dialogue: '',
      };
      const newNpc = new Npc(npcData);
      scriptAsyncPending = true;
      newNpc.load().then(() => {
        scriptNpcs.push(newNpc);
        scriptAsyncPending = false;
        advanceScript(activeScript!);
      });
      break;
    }

    case 'hideNpc': {
      const npc = lookupNpc(cmd.npcId, npcs);
      if (npc) npc.hidden = true;
      const idx = scriptNpcs.findIndex(n => n.data.id === cmd.npcId);
      if (idx >= 0) scriptNpcs.splice(idx, 1);
      advanceScript(activeScript);
      break;
    }

    case 'unhideNpc': {
      const npc = lookupNpc(cmd.npcId, npcs);
      if (npc) npc.hidden = false;
      advanceScript(activeScript);
      break;
    }

    case 'awaitInteraction':
      scriptAwaitInteraction = {
        npcId: cmd.npcId,
        guardStepY: cmd.guardStepY,
        guardText: cmd.guardText,
      };
      scriptFreeSub = 'move';
      break;

    case 'exclamation':
      scriptExclamation = { target: cmd.target, frames: cmd.frames };
      break;

    case 'pikachuBattle':
      return { type: 'pikachuBattle' };

    case 'moveParallel': {
      const npc = lookupNpc(cmd.npcId, npcs);
      if (npc) npc.startScriptedMove(cmd.npcPath);
      player.startScriptedMove(cmd.playerPath);
      scriptMoveTarget = 'parallel';
      scriptMoveNpcId = cmd.npcId;
      break;
    }

    case 'callback':
      cmd.fn();
      advanceScript(activeScript);
      break;

    case 'startBattle': {
      scriptBattlePending = true;
      return {
        type: 'startBattleTransition',
        trainerClass: cmd.trainerClass,
        partyIndex: cmd.partyIndex,
        trainerName: cmd.trainerName,
      };
    }

    case 'healParty':
      for (const mon of playerParty) {
        mon.currentHp = mon.maxHp;
        mon.status = null;
        mon.sleepTurns = 0;
        mon.toxicCounter = 0;
        mon.badlyPoisoned = false;
        for (const move of mon.moves) {
          move.pp = move.maxPp;
        }
      }
      advanceScript(activeScript);
      break;

    case 'pikachuToNurse': {
      // Assembly: PikachuWalksToNurseJoy — movement depends on Pikachu's position
      if (!pikachuFollower?.visible) {
        advanceScript(activeScript);
        break;
      }
      const pikaX = pikachuFollower.x;
      const pikaY = pikachuFollower.y;
      if (pikaY > player.y) {
        // Pikachu below player: PikaMovementData1 — walk up-left, hop up-right
        pikachuFollower.pushPosition(pikaX - 16, pikaY - 16);
        pikachuFollower.pushPosition(pikaX, pikaY - 32, true);
      } else if (pikaY === player.y && pikaX <= player.x) {
        // Pikachu to the left (same Y): PikaMovementData2 — hop up-right only
        pikachuFollower.pushPosition(pikaX + 16, pikaY - 16, true);
      } else if (pikaY === player.y && pikaX > player.x) {
        // Pikachu to the right (same Y): PikaMovementData3 — hop up-left only
        pikachuFollower.pushPosition(pikaX - 16, pikaY - 16, true);
      } else {
        // Pikachu above player: no movement needed
        advanceScript(activeScript);
        break;
      }
      scriptPikachuMoving = true;
      break;
    }

    case 'hidePikachu':
      // Assembly: DisablePikachuOverworldSpriteDrawing
      if (pikachuFollower?.visible) {
        pikachuFollower.visible = false;
        pokecenterHealHidPikachu = true;
      }
      advanceScript(activeScript);
      break;

    case 'showPikachu':
      // Assembly: EnablePikachuOverworldSpriteDrawing + spawn state 5
      // Pikachu reappears above the player (at the nurse counter where it walked to)
      if (pokecenterHealHidPikachu && pikachuFollower) {
        pikachuFollower.x = player.x;
        pikachuFollower.y = player.y - 16;
        pikachuFollower.direction = 'down';
        pikachuFollower.clearBuffer();
        pikachuFollower.visible = true;
        pokecenterHealHidPikachu = false;
      }
      advanceScript(activeScript);
      break;

    case 'pokecenterHeal':
      if (!healMachineSprite) {
        loadSprite('/gfx/overworld/heal_machine.png').then(s => {
          healMachineSprite = s;
        });
      }
      pokecenterHealAnim = {
        phase: 'place',
        partyCount: Math.min(playerParty.length, 6),
        placed: 0,
        timer: HEAL_PLACE_FRAMES,
        flashCount: 0,
        flashVisible: true,
      };
      if (playerParty.length === 0) {
        pokecenterHealAnim = null;
        advanceScript(activeScript);
      }
      break;

    case 'fadeOut':
      scriptFade = {
        direction: 'out',
        frames: cmd.frames ?? DEFAULT_FADE_FRAMES,
        elapsed: 0,
      };
      break;

    case 'fadeIn':
      scriptFade = {
        direction: 'in',
        frames: cmd.frames ?? DEFAULT_FADE_FRAMES,
        elapsed: 0,
      };
      break;

    case 'yesNo':
      textBox.show(cmd.message);
      scriptTextWaiting = true;
      scriptYesNoPending = { yes: cmd.yesBranch, no: cmd.noBranch };
      break;

    case 'warp':
      activeScript = null;
      return { type: 'warp', map: cmd.map, warpId: cmd.warpId };
  }

  return null;
}

// ── Free-movement sub-state (awaitInteraction) ─────────────────────────

function updateScriptFreeMove(deps: ScriptDeps): ScriptAction | null {
  const { textBox, player, gameMap, npcs, playerBag, pikachuTile, pikachuFollower } = deps;

  if (!scriptAwaitInteraction || !activeScript) return null;

  // Sub-state: showing regular NPC text (return to free move when dismissed)
  if (scriptFreeSub === 'text') {
    textBox.update();
    if (!textBox.active) scriptFreeSub = 'move';
    return null;
  }

  // Sub-state: target interacted, showing nothing — advance script
  if (scriptFreeSub === 'target') {
    scriptAwaitInteraction = null;
    scriptFreeSub = 'move';
    advanceScript(activeScript);
    return null;
  }

  // Sub-state: showing guard text ("Don't go away yet!")
  if (scriptFreeSub === 'guard_text') {
    textBox.update();
    if (!textBox.active) {
      player.startScriptedMove(['up']);
      scriptFreeSub = 'guard_step';
    }
    return null;
  }

  // Sub-state: player being forced 1 step up after guard
  if (scriptFreeSub === 'guard_step') {
    player.updateScriptedMove();
    if (player.scriptedMoveDone) scriptFreeSub = 'move';
    return null;
  }

  // Sub-state: free movement
  // Allow Start menu during free movement
  if (isPressed('start')) {
    return { type: 'openStartMenu' };
  }

  // Include script NPCs in interaction + collision checks
  const allNpcs = [...npcs, ...scriptNpcs];
  const interaction = player.checkInteraction(gameMap, allNpcs);
  if (interaction) {
    if ('npc' in interaction) {
      if (interaction.npc.data.id === scriptAwaitInteraction.npcId) {
        scriptFreeSub = 'target';
        return null;
      }
      textBox.show(
        interaction.npc.data.defeated
          ? 'I lost to you...'
          : interaction.npc.data.dialogue
      );
      scriptFreeSub = 'text';
    } else if ('scriptId' in interaction) {
      // Scripted hidden event during free-movement script — ignore
    } else if ('item' in interaction) {
      if (!hasFlag(interaction.flag)) {
        const added = playerBag.add(interaction.item);
        if (added) {
          setFlag(interaction.flag);
          const itemName = getItemName(interaction.item);
          textBox.show(`${getPlayerName()} found\n${itemName}!`);
        } else {
          textBox.show("No more room for\nitems!");
        }
        scriptFreeSub = 'text';
      }
    } else {
      textBox.show(interaction.text);
      scriptFreeSub = 'text';
    }
    return null;
  }

  player.update(gameMap, allNpcs);

  // Record player step for Pikachu following during free movement
  if (player.justStartedStep && pikachuFollower?.visible) {
    const dx = player.direction === 'left' ? -16 : player.direction === 'right' ? 16 : 0;
    const dy = player.direction === 'up' ? -16 : player.direction === 'down' ? 16 : 0;
    pikachuFollower.recordPlayerPosition(player.x, player.y, player.x + dx, player.y + dy);
  }

  // Guard check: prevent player from leaving
  if (player.justFinishedStep) {
    const stepY = Math.floor(player.tileY / 2);
    if (stepY >= scriptAwaitInteraction.guardStepY) {
      const oakDesk = lookupNpc('prof_desk', npcs);
      if (oakDesk) oakDesk.faceDirection('down');
      const rival = lookupNpc('rival', npcs);
      if (rival) rival.faceDirection('down');
      textBox.show(scriptAwaitInteraction.guardText);
      scriptFreeSub = 'guard_text';
      return null;
    }
  }

  for (const npc of npcs) {
    npc.update(
      (tx, ty) => gameMap.isWalkable(tx, ty),
      player.claimedTileX,
      player.claimedTileY,
      npcs,
      pikachuTile
    );
  }

  return null;
}

// ── Render helpers ─────────────────────────────────────────────────────

/** Render pokecenter heal animation sprites over the overworld. */
export function renderPokecenterHeal(camX: number, camY: number, mapNpcs: Npc[]): void {
  if (!pokecenterHealAnim || !healMachineSprite) return;
  const nurse = lookupNpc('nurse', mapNpcs);
  if (!nurse) return;

  const anim = pokecenterHealAnim;
  const count = anim.phase === 'place' ? anim.placed : anim.partyCount;
  const ctx = getCtx();
  const s = getScale();
  const flashDim = anim.phase === 'flash' && !anim.flashVisible;
  if (flashDim) ctx.globalAlpha = 0.3;

  // Draw monitor sprite
  const mx = nurse.x + HEAL_MONITOR_OFFSET.dx - camX;
  const my = nurse.y + HEAL_MONITOR_OFFSET.dy - camY;
  ctx.drawImage(healMachineSprite, 0, 0, 8, 8, mx * s, my * s, 8 * s, 8 * s);

  // Draw pokeball sprites
  for (let i = 0; i < count && i < HEAL_BALL_OFFSETS.length; i++) {
    const off = HEAL_BALL_OFFSETS[i];
    const bx = nurse.x + off.dx - camX;
    const by = nurse.y + off.dy - camY;
    if (off.flip) {
      ctx.save();
      ctx.translate((bx + 8) * s, by * s);
      ctx.scale(-1, 1);
      ctx.drawImage(healMachineSprite, 0, 8, 8, 8, 0, 0, 8 * s, 8 * s);
      ctx.restore();
    } else {
      ctx.drawImage(healMachineSprite, 0, 8, 8, 8, bx * s, by * s, 8 * s, 8 * s);
    }
  }
  if (flashDim) ctx.globalAlpha = 1;
}

/** Render script exclamation "!" bubble above target. */
export function renderScriptExclamation(
  camX: number,
  camY: number,
  player: Player,
  mapNpcs: Npc[]
): void {
  if (!scriptExclamation) return;
  let exScreenX: number, exScreenY: number;
  if (scriptExclamation.target === 'player') {
    exScreenX = player.x - camX;
    exScreenY = player.y - camY;
  } else {
    const npc = lookupNpc(scriptExclamation.target, mapNpcs);
    exScreenX = npc ? npc.x - camX : 0;
    exScreenY = npc ? npc.y - camY : 0;
  }
  drawExclamationBubble(exScreenX, exScreenY);
}

/** Render YES/NO menu if active during a script. */
export function renderScriptYesNo(): void {
  if (scriptYesNoActive) yesNoMenu.render();
}
