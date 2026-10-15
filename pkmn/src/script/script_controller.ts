// Script controller — owns all script execution state extracted from main.ts.
// updateScript() returns actions for state transitions that main.ts processes.

import type { ScriptCommand, ScriptRunner, MenuBoxLayout } from './types';
import { TILE_SIZE } from '../core';
import type { GameButton } from '../core';
import { MenuInput } from '../menus/menu_input';
import { drawBox, drawText } from '../menus/menu_render';
import { createScript, currentCommand, advanceScript } from './engine';
import type { TextBox } from '../text';
import type { Player } from '../overworld/player';
import type { GameMap } from '../overworld/map';
import { Npc } from '../overworld/npc';
import type { BattlePokemon, CatchDemoBattleType } from '../battle';
import type { PikachuFollower } from '../pikachu/pikachu_follower';
import { shouldPikachuFollow } from '../pikachu/pikachu_follower';
import { pikachuSide } from '../pikachu/pikachu_movement';
import { getPikachuMovementData, pikachuMovementProgram } from '../pikachu/pikachu_movement_data';
import type { PikachuMovementProgramId } from '../rom/extractors/pikachu_movement';
import type { PikachuSpawnState } from '../pikachu/pikachu_spawn';
import { createPokemon, initExperience } from '../battle';
import type { Bag } from '../items';
import { loadSprite, getCtx, getScale, drawExclamationBubble } from '../renderer';
import { isPassPressed, isPressed, readJoypad, syncJoypadRead } from '../input';
import { updateSprites, recordStepForPikachu, spriteTable } from '../overworld/sprites';
import { fontLoadedUpdateSprites, setOpeningSpriteUpdates } from '../overworld/ui_entry';
import { setFlag, hasFlag, clearFlag, setMapScript, hideObject } from '../events';
import { playSFX, isSoundFinished } from '../audio';
import type { Direction } from '../core';
import { getPlayerName } from '../core/player_state';
import { markOwned } from '../pokedex_state';
import { YesNoMenu } from '../menus';
import { EmotionBubble } from '../overworld/emotion_bubble';
import { playMusic, isMusicChannelActive } from '../audio';
import { uiTiles } from '../renderer/ui_tiles';
import { getTextPrograms } from '../text/program_data';
import { displayTextID, getTextHandler } from '../story/text_handlers';
import { getOwnedCount } from '../pokedex_state';
import { mapTextCall } from '../text/map_text_calls';

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
  restoreMapMusic?: () => void;
}

// ── Actions returned to main.ts ────────────────────────────────────────

export type ScriptAction =
  | { type: 'scriptEnded' }
  | { type: 'catchDemo'; battleType: CatchDemoBattleType; species: string; level: number }
  | { type: 'startBattleTransition'; trainerClass: string; partyIndex: number; trainerName?: string; endBattleText?: string }
  | { type: 'warp'; map: string; warpId: number }
  | { type: 'openStartMenu' }
  | { type: 'townMap' };

// ── Module-level script state ──────────────────────────────────────────

let activeScript: ScriptRunner | null = null;
let scriptTextWaiting = false;
let scriptSound: { name: string; played: boolean; waitForCurrent: boolean } | null = null;
let scriptDisplayWaiting = false;
let scriptDisplayStarted = false;
let scriptButtonWaiting = false;
let scriptClosingText = false;
let scriptMoveTarget: 'npc' | 'player' | 'parallel' | null = null;
let scriptMoveNpcId: string | null = null;
let scriptWaitFrames = 0;
let scriptFade: { direction: 'out' | 'in'; frames: number; elapsed: number } | null = null;
let scriptAsyncPending = false;
let scriptBattlePending = false;
let lastBattleWon = true; // wBattleResult == 0 for the most recent battle

const yesNoMenu = new YesNoMenu();
let scriptChoice: { yes: ScriptCommand[]; no: ScriptCommand[] } | null = null;
// A menu box a handler drew over the map (TextBoxBorder + PlaceString), and the ▶
// PlaceMenuCursor left in it; HandleMenuInput_ while it reads
let scriptMenuBox: { layout: MenuBoxLayout; cursor: { x: number; y: number } | null } | null = null;
let scriptMenu: { input: MenuInput; then: (keys: GameButton[], item: number) => ScriptCommand[] } | null = null;
const scriptBubble = new EmotionBubble<'player' | string>();
let scriptHealingMusic: { ready: boolean } | null = null;

let scriptAwaitInteraction: {
  npcId: string;
  guardStepY: number;
  guardText?: string;
  guardProgram?: string;
} | null = null;
let scriptFreeSub: 'move' | 'text' | 'target' | 'guard_text' | 'guard_step' | 'guard_delay' | 'handler' = 'move';

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

// ApplyPikachuMovementData under way (pikachu_movement.ts); `refresh` is TryApply's
// RefreshPikachuFollow after the return frame (a direct call has none)
let scriptPikachuRun: { refresh: boolean } | null = null;
// wPikachuSpawnState as the Pokécenter leaves it (5): a starter that wasn't out spawns there
let pendingPikachuSpawnState: PikachuSpawnState | null = null;
// Pikachu's facing as DisplayTextIDInit saved it; CloseTextDisplay restores it
let savedPikachuFacing: Direction | null = null;
// pushPlayer: one simulated joypad step in progress
let scriptPush: { dir: Direction; started: boolean } | null = null;
// moveParallel: the player's presses, waiting for the NPC to begin its step `fromNpcStep`
let scriptParallel: { playerPath: Direction[]; fromNpcStep: number; playerStarted: boolean } | null = null;
let pokecenterHealHidPikachu = false; // track if we hid Pikachu during heal

const DEFAULT_FADE_FRAMES = 8;

// Computed fade alpha for the current frame (set during updateScript, read by main.ts)
let scriptFadeAlpha: number | null = null;
// GBPalWhiteOut held by a script (TownMapText's handoff and its close)
let scriptWhite = false;
let scriptWhiteCleared = false;

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

/** Record the outcome of the battle that just ended (main.ts). */
export function setLastBattleWon(won: boolean): void {
  lastBattleWon = won;
}

/** wBattleResult as story scripts read it: did the player win the last battle? */
export function wasLastBattleWon(): boolean {
  return lastBattleWon;
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
  if (scriptWhite) return 1;
  // The tick a white-out ends: main's retained fade alpha goes back to 0 once.
  if (scriptWhiteCleared) { scriptWhiteCleared = false; return 0; }
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
  scriptSound = null;
  scriptDisplayWaiting = false;
  scriptDisplayStarted = false;
  scriptButtonWaiting = false;
  scriptClosingText = false;
  scriptMoveTarget = null;
  scriptMoveNpcId = null;
  scriptWaitFrames = 0;
  scriptAsyncPending = false;
  scriptFade = null;
  scriptWhiteCleared = scriptWhite; // a replaced script must not leave the screen white
  scriptWhite = false;
  scriptAwaitInteraction = null;
  scriptFreeSub = 'move';
  scriptChoice = null;
  scriptMenuBox = null;
  scriptMenu = null;
  scriptHealingMusic = null;
  // A replaced script must not leave a bubble on screen.
  scriptBubble.clear();
  pokecenterHealAnim = null;
  scriptPikachuRun = null;
  pendingPikachuSpawnState = null;
  savedPikachuFacing = null;
  setOpeningSpriteUpdates(true);
  scriptPush = null;
  scriptParallel = null;
  pokecenterHealHidPikachu = false;
}

/**
 * Update the script engine (called each frame while in 'script' state). Text, waits and
 * fades count frames; every move runs once per overworld pass (`isPass`, every two
 * frames, walk_pace.ts), with the NPCs and Pikachu updating as UpdateSprites does.
 * Returns an action when main.ts needs to handle a state transition.
 */
export function updateScript(deps: ScriptDeps, isPass: boolean, displayAdvanced = false): ScriptAction | null {
  const { textBox, player, npcs, playerParty, playerBag, pikachuFollower } = deps;
  scriptFadeAlpha = null; // reset each frame; set below if fade active

  if (!activeScript || !activeScript.active) {
    activeScript = null;
    textBox.dismiss();
    return { type: 'scriptEnded' };
  }

  // VBlank continues during retained text, even when several commands return in one frame.
  if (!displayAdvanced && textBox.active && !scriptTextWaiting && !scriptClosingText && !scriptDisplayWaiting &&
      !(scriptAwaitInteraction?.guardProgram && scriptFreeSub === 'text')) {
    textBox.updateDisplay();
    displayAdvanced = true;
  }

  // DisplayTextIDInit / PrintText / a retained silent wait owns its VBlank and input.
  if (scriptChoice) {
    const result = yesNoMenu.update(readJoypad);
    if (result === null) return null;
    const chosen = result === 'yes' ? scriptChoice.yes : scriptChoice.no;
    scriptChoice = null;
    activeScript.commands.splice(activeScript.index + 1, 0, ...chosen);
    advanceScript(activeScript);
    return updateScript(deps, isPass, displayAdvanced);
  }
  if (scriptMenu) {
    const keys = scriptMenu.input.update(readJoypad, () => playSFX('press_ab'));
    if (scriptMenuBox) scriptMenuBox.cursor = scriptMenu.input.cursor;
    if (keys === null) return null;
    // A watched key returns into the handler in this frame; the ▶ stays where it was drawn.
    const next = scriptMenu.then(keys, scriptMenu.input.item);
    scriptMenu = null;
    activeScript.commands.splice(activeScript.index + 1, 0, ...next);
    advanceScript(activeScript);
    return updateScript(deps, isPass, displayAdvanced);
  }
  if (scriptBubble.showing !== null) {
    if (!scriptBubble.tick()) return null;
    // EmotionBubble returns to UpdateSprites with the display's font still loaded.
    fontLoadedUpdateSprites(player, deps.gameMap, (x, y) => uiTiles.tileAt(x, y), pikachuFollower);
    advanceScript(activeScript);
    return updateScript(deps, isPass, displayAdvanced);
  }
  if (scriptHealingMusic) {
    if (!scriptHealingMusic.ready || isMusicChannelActive(1)) return null;
    scriptHealingMusic = null;
    deps.restoreMapMusic?.();
    advanceScript(activeScript);
    return updateScript(deps, isPass, displayAdvanced);
  }
  if (scriptDisplayWaiting) {
    textBox.update();
    displayAdvanced = true;
    if (!textBox.isComplete) return null;
    scriptDisplayWaiting = false;
    advanceScript(activeScript);
    return updateScript(deps, isPass, displayAdvanced);
  }

  // Only the button wait and Hold read Joypad. Sound/copy waits freeze the world without reads.
  if (scriptSound || scriptButtonWaiting || scriptClosingText) {
    if (scriptSound) {
      if (!scriptSound.played) {
        if (scriptSound.waitForCurrent && !isSoundFinished()) return null;
        playSFX(scriptSound.name);
        scriptSound.played = true;
      }
      if (!isSoundFinished()) return null;
      scriptSound = null;
    } else if (scriptButtonWaiting) {
      syncJoypadRead();
      if (!isPressed('a') && !isPressed('b')) return null;
      scriptButtonWaiting = false;
    } else {
      textBox.update();
      displayAdvanced = true;
      if (textBox.active) return null;
      scriptClosingText = false;
    }
    advanceScript(activeScript);
    return updateScript(deps, isPass, displayAdvanced); // routine returns in this frame, not a frame later
  }

  // Handle awaitInteraction: player has free movement until they interact with target
  if (scriptAwaitInteraction && scriptFreeSub !== 'handler') {
    return updateScriptFreeMove(deps, isPass);
  }

  // ApplyPikachuMovementData blocks the script: one interpreter tick per frame, nothing
  // else moves or reads input, and the next command runs in the frame the call returns.
  if (scriptPikachuRun) {
    if (pikachuFollower && !pikachuFollower.tickMovement()) return null;
    if (scriptPikachuRun.refresh && pikachuFollower) {
      pikachuFollower.refreshFollow({ x: player.mapStepX, y: player.mapStepY });
    }
    scriptPikachuRun = null;
    advanceScript(activeScript);
  } else if (pikachuFollower?.movementActive) {
    pikachuFollower.cancelMovement(); // left behind by a replaced script
  }

  // Preserve legacy wait/fade input ownership; migrated DelayFrames owns no reads.
  if ((!scriptDisplayStarted && (scriptWaitFrames > 0 || pokecenterHealAnim)) || scriptFade) {
    syncJoypadRead();
  }

  // Handle waiting states
  if (scriptTextWaiting) {
    textBox.update();
    displayAdvanced = true;

    const command = currentCommand(activeScript);
    if (command?.type === 'text' && command.end && textBox.isComplete) {
      scriptTextWaiting = false;
      advanceScript(activeScript);
      // text_end returns directly into GiveItem / TextCommand_SOUND in this frame.
    } else if (!textBox.active) {
      scriptTextWaiting = false;
      advanceScript(activeScript!);
      return null;
    } else {
      return null;
    }
  }

  if (scriptWaitFrames > 0) {
    scriptWaitFrames--;
    if (scriptWaitFrames <= 0) {
      advanceScript(activeScript);
      // Migrated DelayFrames returns into the next command in its final CPU tick.
      // Pre-display/legacy movement waits retain their existing dispatch timing.
      if (scriptDisplayStarted) return updateScript(deps, isPass, displayAdvanced);
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

  // ── Moves: once per overworld pass. Each checks at the top of the pass whether it has
  // finished, as the map script does before the rest of the loop runs. ──
  const moving = scriptPush || scriptMoveTarget;
  if (moving && !isPass) return null;
  if (moving && !player.isMoving && !player.isLanding) readJoypad(); // JoypadOverworld on standing passes
  const sprites = (): void => updateSprites([...npcs, ...scriptNpcs], deps.gameMap, player, pikachuFollower);
  const record = (): void => {
    if (player.startedFollowStep && pikachuFollower?.visible) recordStepForPikachu(player, pikachuFollower);
  };

  // pushPlayer: the player's own overworld step with the joypad simulated — it walks,
  // hops a ledge, or bumps (collision SFX) exactly as a held button would
  if (scriptPush) {
    if (scriptPush.started && !player.isBusy) {
      player.finishLanding();
      scriptPush = null;
      advanceScript(activeScript);
      return null;
    }
    const input = scriptPush.started ? null : scriptPush.dir;
    scriptPush.started = true;
    player.update(deps.gameMap, npcs, input, sprites);
    record();
    return null;
  }


  // moveNpc: the player stands while UpdateSprites moves the NPC (and everyone else)
  if (scriptMoveTarget === 'npc' && scriptMoveNpcId) {
    const npc = lookupNpc(scriptMoveNpcId, npcs);
    if (!npc || npc.scriptedMoveDone) {
      scriptMoveTarget = null;
      scriptMoveNpcId = null;
      advanceScript(activeScript);
      return null;
    }
    player.update(deps.gameMap, npcs, null, sprites);
    return null;
  }

  if (scriptMoveTarget === 'parallel' && scriptMoveNpcId && scriptParallel) {
    const npc = lookupNpc(scriptMoveNpcId, npcs);
    const npcDone = npc ? npc.scriptedMoveDone : true;
    if (npcDone && scriptParallel.playerStarted && player.scriptedMoveDone) {
      scriptMoveTarget = null;
      scriptMoveNpcId = null;
      scriptParallel = null;
      advanceScript(activeScript);
      return null;
    }
    // The map script starts the player's presses once the NPC is far enough along
    if (!scriptParallel.playerStarted && (!npc || npc.scriptedStepsStarted >= scriptParallel.fromNpcStep)) {
      scriptParallel.playerStarted = true;
      player.startScriptedMove(scriptParallel.playerPath);
    }
    if (scriptParallel.playerStarted && !player.scriptedMoveDone) {
      player.updateScriptedMove(sprites);
      record();
    } else {
      player.update(deps.gameMap, npcs, null, sprites);
    }
    return null;
  }

  if (scriptMoveTarget === 'player') {
    if (player.scriptedMoveDone) {
      scriptMoveTarget = null;
      advanceScript(activeScript);
      return null;
    }
    player.updateScriptedMove(sprites);
    record();
    return null;
  }

  // Wait for async operations (e.g., showNpc sprite loading)
  if (scriptAsyncPending) return null;

  // Execute the next command
  const cmd = currentCommand(activeScript);
  if (!cmd) {
    activeScript = null;
    textBox.dismiss(); // Guard against a script leaving a retained box open.
    return { type: 'scriptEnded' };
  }

  const commandIndex = activeScript.index;
  switch (cmd.type) {
    case 'yesNoChoice':
      yesNoMenu.show({ pokeCenter: cmd.pokeCenter, actualRead: true });
      scriptChoice = { yes: cmd.yes, no: cmd.no };
      return null; // menu draws in the same tick that PrintText returns

    case 'emotionBubble':
      scriptBubble.start(cmd.target);
      return null;

    case 'healJingle': {
      const music = { ready: false };
      scriptHealingMusic = music;
      // Await loading as well as playback; a first-use fetch must not end the wait.
      void playMusic('pkmnhealed').then(() => { music.ready = true; });
      return null;
    }
    case 'displayOpen':
      scriptDisplayStarted = true;
      textBox.open({ autoBox: cmd.autoBox, spriteUpdate: cmd.spriteUpdate });
      scriptDisplayWaiting = true;
      return null;

    case 'menuBox':
      // TextBoxBorder clears the box's interior, the old ▶ with it.
      scriptMenuBox = cmd.layout ? { layout: cmd.layout, cursor: null } : null;
      advanceScript(activeScript);
      return updateScript(deps, isPass, displayAdvanced);

    case 'menuInput':
      scriptMenu = { input: new MenuInput(cmd.menu), then: cmd.then };
      if (scriptMenuBox) scriptMenuBox.cursor = scriptMenu.input.cursor; // PlaceMenuCursor, then Delay3
      return null;

    case 'restoreSavedScreen':
      scriptMenuBox = null;
      textBox.clearInterior();
      advanceScript(activeScript);
      return updateScript(deps, isPass, displayAdvanced);

    case 'printText':
      textBox.print({ program: cmd.program }, { box: cmd.box, bindings: cmd.bindings, noDelay: cmd.noDelay });
      if (textBox.isComplete) { advanceScript(activeScript); return updateScript(deps, isPass, displayAdvanced); }
      scriptDisplayWaiting = true;
      return null;

    case 'displayClose':
      textBox.finish({ outerWait: cmd.outerWait, reload: cmd.reload });
      scriptClosingText = true;
      return null;

    case 'displayCloseInPlace':
      textBox.closeInPlace();
      scriptDisplayWaiting = true;
      return null;

    case 'whiteOut':
      scriptWhite = cmd.on;
      scriptWhiteCleared = !cmd.on;
      advanceScript(activeScript);
      return updateScript(deps, isPass, displayAdvanced);

    case 'townMap':
      return { type: 'townMap' }; // main.ts advances the script when the Town Map returns

    case 'displayHide':
      textBox.hideDisplay();
      scriptChoice = null;
      advanceScript(activeScript);
      return updateScript(deps, isPass, displayAdvanced);

    case 'text':
      textBox.show(cmd.message, { end: cmd.end });
      scriptTextWaiting = true;
      break;

    case 'sound':
      scriptSound = { name: cmd.name, played: false, waitForCurrent: cmd.waitForCurrent ?? false };
      return updateScript(deps, isPass, displayAdvanced);

    case 'textButtonWait':
      if (textBox.displaySession && textBox.active) {
        textBox.waitSilent();
        if (textBox.isComplete) { advanceScript(activeScript); return updateScript(deps, isPass, displayAdvanced); }
        scriptDisplayWaiting = true;
        return null;
      }
      scriptButtonWaiting = true;
      return updateScript(deps, isPass, displayAdvanced);

    case 'closeText':
      if (!textBox.active) {
        advanceScript(activeScript);
        return updateScript(deps, isPass, displayAdvanced);
      }
      textBox.finish({ outerWait: false });
      scriptClosingText = true;
      return null;

    case 'hideObject': {
      hideObject(cmd.map, cmd.npcId);
      if (deps.gameMap.mapData?.name === cmd.map) {
        const npc = lookupNpc(cmd.npcId, npcs);
        if (npc) npc.hidden = true;
        // Refresh collision availability without advancing a single NPC or world pass.
        player.detectSpriteCollisions(spriteTable(player, [...npcs, ...scriptNpcs], pikachuFollower));
      }
      advanceScript(activeScript);
      return updateScript(deps, isPass, displayAdvanced);
    }

    case 'moveNpc': {
      const npc = lookupNpc(cmd.npcId, npcs);
      if (npc) {
        npc.startScriptedMove(cmd.path, cmd.modes);
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
      if (scriptDisplayStarted && textBox.active) return updateScript(deps, isPass, displayAdvanced);
      break;

    case 'wait':
      scriptWaitFrames = cmd.frames;
      break;

    case 'setFlag':
      setFlag(cmd.flag);
      advanceScript(activeScript);
      if (textBox.active && textBox.isComplete) return updateScript(deps, isPass, displayAdvanced);
      break;

    case 'clearFlag':
      clearFlag(cmd.flag);
      advanceScript(activeScript);
      break;

    case 'setMapScript':
      setMapScript(cmd.map, cmd.state);
      advanceScript(activeScript);
      break;

    case 'pushPlayer':
      player.cancelMovement();
      scriptPush = { dir: cmd.direction, started: false };
      break;

    case 'tryPikachuMovement':
      if (tryPikachuMovement(cmd.caller, deps)) scriptPikachuRun = { refresh: true };
      else advanceScript(activeScript); // a failed guard takes no frames and refreshes nothing
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
      if (textBox.active && textBox.isComplete) return updateScript(deps, isPass, displayAdvanced);
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
        textId: cmd.textId,
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
        guardProgram: cmd.guardProgram,
      };
      scriptFreeSub = 'move';
      break;

    case 'catchDemo':
      return { type: 'catchDemo', battleType: cmd.battleType, species: cmd.species, level: cmd.level };

    case 'moveParallel': {
      const npc = lookupNpc(cmd.npcId, npcs);
      if (npc) {
        if (cmd.npcInStep) npc.startInStepMove(cmd.npcPath);
        else npc.startScriptedMove(cmd.npcPath, cmd.npcModes);
      }
      scriptParallel = { playerPath: cmd.playerPath, fromNpcStep: cmd.playerFromNpcStep ?? 0, playerStarted: false };
      scriptMoveTarget = 'parallel';
      scriptMoveNpcId = cmd.npcId;
      break;
    }

    case 'callback':
      cmd.fn();
      advanceScript(activeScript);
      if (scriptDisplayStarted && (!scriptAwaitInteraction || scriptFreeSub === 'handler')) return updateScript(deps, isPass, displayAdvanced);
      break;

    case 'startBattle': {
      scriptBattlePending = true;
      return {
        type: 'startBattleTransition',
        trainerClass: cmd.trainerClass,
        partyIndex: cmd.partyIndex,
        trainerName: cmd.trainerName,
        endBattleText: cmd.endBattleProgram ? legacyBattleProgram(cmd.endBattleProgram) : cmd.endBattleText,
      };
    }

    case 'restoreMapMusic':
      deps.restoreMapMusic?.();
      advanceScript(activeScript);
      break;

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
      // PikachuWalksToNurseJoy: a direct ApplyPikachuMovementData (no guard, no refresh),
      // its program picked by map position, Y first: below → MovementData1; same row,
      // left or on the player → 2; right → 3; above → no call
      const program = pikachuFollower?.visible ? nurseProgram(pikachuFollower, player) : null;
      if (program && pikachuFollower) {
        pikachuFollower.startMovement(getPikachuMovementData(), pikachuMovementProgram(program),
          deps.gameMap.isGrassTile(pikachuFollower.tileX, pikachuFollower.tileY), player);
        scriptPikachuRun = { refresh: false };
      } else {
        advanceScript(activeScript);
      }
      break;
    }

    case 'hidePikachu':
      // DisablePikachuOverworldSpriteDrawing (Pikachu always follows on today's maps)
      if (pikachuFollower?.visible) {
        pikachuFollower.hideImage();
        pikachuFollower.visible = false;
        pokecenterHealHidPikachu = true;
      }
      advanceScript(activeScript);
      break;

    case 'showPikachu':
      // wPikachuSpawnState = 5, EnablePikachuOverworldSpriteDrawing: drawing is allowed
      // again, but nothing is drawn until an image is written (Func_6ebb or UpdateSprites).
      // Spawn state 5 is read only by a Pikachu that isn't out (TrySpawnPikachu).
      pendingPikachuSpawnState = 5;
      if (pokecenterHealHidPikachu && pikachuFollower) {
        pikachuFollower.visible = true;
        pokecenterHealHidPikachu = false;
      }
      advanceScript(activeScript);
      break;

    case 'pikachuStandDown':
      // Func_6ebb(15, 0): SetSpriteFacingDirectionAndDelay, then SpriteFunc_34a1 writes the
      // standing-down IMAGEINDEX. A starter that wasn't out (it had fainted) has no
      // position to draw at here; it appears at the next UpdateSprites.
      if (pikachuFollower?.visible) {
        const follower = pikachuFollower;
        follower.setLiveFacing('down');
        activeScript.commands.splice(activeScript.index + 1, 0,
          { type: 'wait', frames: 6 },
          { type: 'callback', fn: () => follower.showStandingImage('down') });
      } else {
        activeScript.commands.splice(activeScript.index + 1, 0, { type: 'wait', frames: 6 });
      }
      advanceScript(activeScript);
      break;

    case 'updateSprites':
      // TrySpawnPikachu for a starter that wasn't out (status 0), at the pending spawn
      // state; then SpawnPikachu_ with the font loaded (Func_fc76a).
      if (pikachuFollower && !pikachuFollower.visible && !pokecenterHealHidPikachu
          && pendingPikachuSpawnState !== null && shouldPikachuFollow(playerParty)) {
        pikachuFollower.visible = true;
        pikachuFollower.spawnAtState(player.x, player.y, player.direction, pendingPikachuSpawnState);
        pendingPikachuSpawnState = null;
      }
      fontLoadedUpdateSprites(player, deps.gameMap,
        textBox.displaySession ? (x, y) => textBox.uiTileAt(x, y) : () => 0, pikachuFollower);
      advanceScript(activeScript);
      break;

    case 'pikachuFacing':
      // DisplayTextIDInit copies, and CloseTextDisplay restores, every non-player slot's
      // facing whether its sprite is drawn or not: a fainted starter's slot too, which the
      // heal then spawns facing down (A6e review R-1)
      if (cmd.action === 'save') {
        savedPikachuFacing = pikachuFollower ? pikachuFollower.direction : null;
      } else if (savedPikachuFacing && pikachuFollower) {
        const facing = savedPikachuFacing; const follower = pikachuFollower;
        if (textBox.displaySession) textBox.restoreFacingAtClose(() => follower.setLiveFacing(facing));
        else follower.setLiveFacing(facing);
      }
      advanceScript(activeScript);
      break;

    case 'ifStarterPikachu':
      if (shouldPikachuFollow(playerParty)) {
        activeScript.commands.splice(activeScript.index + 1, 0, ...cmd.then);
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

    case 'warp':
      activeScript = null;
      return { type: 'warp', map: cmd.map, warpId: cmd.warpId };
  }

  if (scriptDisplayStarted && activeScript.index !== commandIndex &&
      (!scriptAwaitInteraction || scriptFreeSub === 'handler')) return updateScript(deps, isPass, displayAdvanced);
  return null;
}

/** Battle still consumes its existing flattened string until A5c; the builder names source data. */
function legacyBattleProgram(label: string): string {
  const program = getTextPrograms()[label];
  if (!program) throw new Error(`missing battle text program ${label}`);
  return program.map(op => {
    if (op.op === 'far') return legacyBattleProgram(op.program);
    if (op.op === 'text') return op.text.replace(/<(DONE|PROMPT)>$/, '');
    throw new Error(`unsupported legacy battle text op ${op.op} in ${label}`);
  }).join('');
}

// ── Pikachu's scripted movement (pikachu_movement.ts) ──────────────────

const mapStep = (o: { mapStepX: number; mapStepY: number }): { x: number; y: number } =>
  ({ x: o.mapStepX, y: o.mapStepY });

/**
 * TryApplyPikachuMovementData (engine/events/try_pikachu_movement.asm): the starter is out
 * (wPikachuSpawnStateFlags' starter bit — the existing starter model) and the player walks
 * (no bike or surf yet), and Pikachu is on the caller's side of the player by map
 * position (GetPikachuFacingDirection, Y first; no distance limit, its facing unread).
 * Starts the call and returns true; false takes no frames.
 */
function tryPikachuMovement(caller: 'viridianStepAside' | 'oaksLab', deps: ScriptDeps): boolean {
  const { player, pikachuFollower, playerParty, gameMap } = deps;
  if (!pikachuFollower?.visible || !shouldPikachuFollow(playerParty)) return false;
  let program: PikachuMovementProgramId;
  let side: 'up' | 'down' | 'left' | 'right';
  if (caller === 'viridianStepAside') {
    // ViridianCityMovePikachu: b = SPRITE_FACING_RIGHT
    program = 'viridianStepAside';
    side = 'right';
  } else {
    // OaksLabPikachuMovementScript: wYCoord = 3 → MovementData2 (LEFT), else 1 (DOWN)
    const atY3 = player.mapStepY === 3;
    program = atY3 ? 'oaksLab2' : 'oaksLab1';
    side = atY3 ? 'left' : 'down';
  }
  if (pikachuSide(mapStep(pikachuFollower), mapStep(player)) !== side) return false;
  pikachuFollower.startMovement(getPikachuMovementData(), pikachuMovementProgram(program),
    gameMap.isGrassTile(pikachuFollower.tileX, pikachuFollower.tileY), player);
  return true;
}

/** PikachuWalksToNurseJoy.GetMovementData: null when Pikachu is above the player. */
function nurseProgram(pikachuFollower: PikachuFollower, player: Player): PikachuMovementProgramId | null {
  const side = pikachuSide(mapStep(pikachuFollower), mapStep(player));
  if (side === 'up') return null;
  if (side === 'down') return 'nurse1';
  return side === 'right' ? 'nurse3' : 'nurse2';
}

// ── Free-movement sub-state (awaitInteraction) ─────────────────────────

function updateScriptFreeMove(deps: ScriptDeps, isPass: boolean): ScriptAction | null {
  const { textBox, player, gameMap, npcs, pikachuFollower } = deps;

  if (!scriptAwaitInteraction || !activeScript) return null;

  if (scriptFreeSub === 'guard_delay') {
    if (--scriptWaitFrames <= 0) scriptFreeSub = 'move';
    return null; // OaksLabPlayerForcedToWalkBackScript Delay3 owns no Joypad.
  }

  // Sub-state: showing regular NPC text (return to free move when dismissed)
  if (scriptFreeSub === 'text') {
    if (!textBox.displaySession) syncJoypadRead();
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
    syncJoypadRead();
    textBox.update();
    if (!textBox.active) {
      player.startScriptedMove(['up']);
      scriptFreeSub = 'guard_step';
    }
    return null;
  }

  // The rest moves: once per overworld pass
  if (!isPass) return null;
  player.finishLanding(); // Clear the shadow before free movement can open START or text.
  const allNpcs = [...npcs, ...scriptNpcs];
  const sprites = (): void => updateSprites(allNpcs, gameMap, player, pikachuFollower);

  // Sub-state: player being forced 1 step up after guard
  if (scriptFreeSub === 'guard_step') {
    if (player.scriptedMoveDone) {
      if (scriptAwaitInteraction.guardProgram) { scriptWaitFrames = 3; scriptFreeSub = 'guard_delay'; }
      else scriptFreeSub = 'move';
      return null;
    }
    player.updateScriptedMove(sprites);
    if (player.startedFollowStep && pikachuFollower?.visible) recordStepForPikachu(player, pikachuFollower);
    return null;
  }

  // Sub-state: free movement (JoypadOverworld reads on standing passes)
  if (!player.isMoving && !player.isLanding) readJoypad();
  // Allow Start menu during free movement
  if (isPassPressed('start') && !player.isBusy) {
    return { type: 'openStartMenu' };
  }

  // Include script NPCs in interaction + collision checks
  const interaction = player.checkInteraction(gameMap, allNpcs, hasFlag);
  if (interaction) {
    if ('npc' in interaction) {
      if (interaction.npc.data.id === scriptAwaitInteraction.npcId) {
        if (scriptAwaitInteraction.guardProgram) {
          scriptAwaitInteraction = null;
          advanceScript(activeScript);
          return updateScript(deps, isPass); // ball DisplayTextID starts on the A press
        }
        scriptFreeSub = 'target';
        return null;
      }
      if (scriptAwaitInteraction.guardProgram) {
        const textId = interaction.npc.data.textId;
        const name = gameMap.mapData!.name;
        const handler = getTextHandler(name, textId);
        const call = mapTextCall(name, textId);
        const plain = call?.call === 'text' || call?.call === 'printText' ? call : undefined;
        if (handler || plain) {
          const body = handler ? handler({ hasFlag, bag: deps.playerBag, party: deps.playerParty,
            ownedCount: getOwnedCount(), facing: player.direction, step: mapStep(player),
            findNpc: id => lookupNpc(id, npcs) }) : displayTextID([
              { type: 'printText', program: plain!.program, box: plain!.call === 'printText' ? 'new' : 'keep' },
            ], { autoBox: false });
          return startFreeDisplay(body, deps, isPass);
        }
      }
      textBox.show(
        interaction.npc.data.defeated
          ? (interaction.npc.data.afterBattleText ?? interaction.npc.data.dialogue)
          : interaction.npc.data.dialogue,
        scriptAwaitInteraction.guardProgram ? { mode: 'displayTextID', autoBox: false } : {},
      );
      scriptFreeSub = 'text';
    } else if ('scriptId' in interaction) {
      // Scripted hidden event during free-movement script — ignore
    } else if ('text' in interaction) {
      textBox.show(interaction.text, scriptAwaitInteraction.guardProgram ? { mode: 'displayTextID', autoBox: false } : {});
      scriptFreeSub = 'text';
    }
    return null;
  }

  player.update(gameMap, allNpcs, undefined, sprites);

  // Record player step for Pikachu following during free movement
  if (player.startedFollowStep && pikachuFollower?.visible) recordStepForPikachu(player, pikachuFollower);

  // Guard check: prevent player from leaving
  if (player.justFinishedStep) {
    const stepY = Math.floor(player.tileY / 2);
    if (stepY >= scriptAwaitInteraction.guardStepY) {
      const oakDesk = lookupNpc('prof_desk', npcs);
      if (oakDesk) oakDesk.faceDirection('down');
      const rival = lookupNpc('rival', npcs);
      if (rival) rival.faceDirection('down');
      if (scriptAwaitInteraction.guardProgram) {
        sprites(); // OaksLabPlayerDontGoAwayScript's UpdateSprites before the display
        const body = displayTextID([{ type: 'printText', program: scriptAwaitInteraction.guardProgram }], { autoBox: false });
        return startFreeDisplay(body, deps, isPass, true);
      }
      textBox.show(scriptAwaitInteraction.guardText ?? '');
      scriptFreeSub = 'guard_text';
      return null;
    }
  }

  return null;
}

/** Temporarily insert a handler before the retained await command, then return to free movement. */
function startFreeDisplay(body: ScriptCommand[], deps: ScriptDeps, isPass: boolean, stepBack = false): ScriptAction | null {
  scriptFreeSub = 'handler';
  activeScript!.commands.splice(activeScript!.index, 0, ...body, { type: 'callback', fn: () => {
    if (stepBack) deps.player.startScriptedMove(['up']);
    scriptFreeSub = stepBack ? 'guard_step' : 'move';
  } });
  return updateScript(deps, isPass);
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
  const target = scriptBubble.showing;
  if (target === undefined || target === null) return;
  let exScreenX: number, exScreenY: number;
  if (target === 'player') {
    exScreenX = player.x - camX;
    exScreenY = player.y - camY;
  } else {
    const npc = lookupNpc(target, mapNpcs);
    exScreenX = npc ? npc.x - camX : 0;
    exScreenY = npc ? npc.y - camY : 0;
  }
  drawExclamationBubble(exScreenX, exScreenY);
}

/** Render YES/NO menu if active during a script. */
export function renderScriptYesNo(): void {
  if (scriptChoice) yesNoMenu.render();
}

/** Render a handler's menu box (the blackboard), its labels and the ▶ PlaceMenuCursor left. */
export function renderScriptMenu(): void {
  if (!scriptMenuBox) return;
  const { layout, cursor } = scriptMenuBox; const T = TILE_SIZE;
  drawBox(layout.x * T, layout.y * T, layout.width * T, layout.height * T);
  for (const label of layout.labels) drawText(label.text, label.x * T, label.y * T);
  if (cursor) drawText('▶', cursor.x * T, cursor.y * T);
}
