// Script controller — owns all script execution state extracted from main.ts.
// updateScript() returns actions for state transitions that main.ts processes.

import type { ScriptCommand, ScriptRunner, MenuBoxLayout } from './types';
import { setSpriteIndex } from '../overworld/sprite_index';
import { TILE_SIZE } from '../core';
import type { GameButton } from '../core';
import { MenuInput } from '../menus/menu_input';
import type { MenuSession } from '../menus/menu_session';
import { PcSession } from '../menus/pc';
import type { PcStorage } from '../menus/pc';
import { PokemartSession } from '../menus/pokemart';
import { ScreenTiles } from '../menus/screen_tiles';
import { drawBox, drawScreenTile, drawText } from '../menus/menu_render';
import { createScript, currentCommand, advanceScript } from './engine';
import type { TextBox } from '../text';
import { textBgTransfer } from '../text/bg_transfer';
import type { Player } from '../overworld/player';
import type { GameMap } from '../overworld/map';
import { Npc } from '../overworld/npc';
import type { BattlePokemon, CatchDemoBattleType } from '../battle';
import type { PikachuFollower } from '../pikachu/pikachu_follower';
import { shouldPikachuFollow } from '../pikachu/pikachu_follower';
import { isPikachuFollowingDisabled } from '../pikachu/pikachu_following';
import { pikachuSide } from '../pikachu/pikachu_movement';
import { getPikachuMovementData, pikachuMovementProgram } from '../pikachu/pikachu_movement_data';
import type { PikachuMovementProgramId } from '../rom/extractors/pikachu_movement';
import type { PikachuSpawnState } from '../pikachu/pikachu_spawn';
import { createPokemon, initExperience } from '../battle';
import type { Bag, ItemStack } from '../items';
import { drawExclamationBubble } from '../renderer';
import { HealingMachineSession } from '../overworld/healing_machine';
import { fadeOutAndStopMusic, isAudioFadingOut, preloadMusic } from '../audio';
import { isPassPressed, readJoypad, syncJoypadRead } from '../input';
import { updateSprites, recordStepForPikachu, spriteTable } from '../overworld/sprites';
import { fontLoadedUpdateSprites, setOpeningSpriteUpdates } from '../overworld/ui_entry';
import { setFlag, hasFlag, clearFlag, setMapScript, hideObject, showObject } from '../events';
import { setJoyIgnore } from '../input/joy_ignore';
import { SimulatedJoypad } from '../overworld/simulated_joypad';
import { playSFX, isSoundFinished } from '../audio';
import type { Direction } from '../core';
import { getPlayerName } from '../core/player_state';
import { markOwned } from '../pokedex_state';
import { YesNoMenu } from '../menus';
import { EmotionBubble } from '../overworld/emotion_bubble';
import { playMusic, playMusicNew, isMusicChannelActive } from '../audio';
import { uiTiles } from '../renderer/ui_tiles';
import { getTextPrograms } from '../text/program_data';
import { displayTextID, getTextHandler } from '../story/text_handlers';
import { mapAutoTextBox, applyMapAutoTextBox } from '../text/auto_text_box';
import { bookshelfContext, interactionDisplay } from '../story/hidden_events';
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
  pcItems?: ItemStack[];
  pcStorage?: PcStorage;
  /** wPlayerMoney. The Mart reads it when it draws the MONEY box and writes it on a sale or purchase. */
  getMoney?: () => number;
  setMoney?: (amount: number) => void;
  pikachuTile?: { x: number; y: number };
  pikachuFollower?: PikachuFollower;
  /** dm: PlayDefaultMusic (Lab, guide, Jigglypuff); pn: Mom's wNewSoundID write; nurse: pokecenter.asm:53–60. */
  restoreMapMusic?: (entry?: 'dm' | 'pn' | 'nurse') => void;
  /** Only explicit OverworldLoop/native-pass commands reset the host's pair. */
  resetPassClock?: () => void;
}

// ── Actions returned to main.ts ────────────────────────────────────────

export type ScriptAction =
  | { type: 'scriptEnded'; resumePass?: boolean }
  | { type: 'catchDemo'; battleType: CatchDemoBattleType; species: string; level: number }
  | { type: 'startBattleTransition'; trainerClass: string; partyIndex: number; trainerName?: string; endBattleText?: string }
  | { type: 'warp'; map: string; warpId: number }
  | { type: 'openStartMenu' }
  | { type: 'townMap' }
  | { type: 'overworldStep' }; // native simulated steps still check warps/connections

// ── Module-level script state ──────────────────────────────────────────

let activeScript: ScriptRunner | null = null;
let scriptSound: { name: string; played: boolean; waitForCurrent: boolean } | null = null;
let scriptDisplayWaiting = false;
let scriptDisplayStarted = false;
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
let scriptMenuSession: MenuSession | null = null;
let menuSessionTiles: ScreenTiles | null = null;
const scriptBubble = new EmotionBubble<'player' | string>();
let scriptHealingMusic: { ready: boolean } | null = null;

let scriptAwaitInteraction: {
  npcId: string;
  guardStepY: number;
  guardProgram: string;
} | null = null;
let scriptFreeSub: 'move' | 'guard_step' | 'guard_delay' | 'handler' = 'move';

let healingMachine: HealingMachineSession | null = null;

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
let pikachuDrawingDisabled = false; // DisablePikachuOverworldSpriteDrawing / Enable counterpart
let scriptAfterHealingMachine = false;
let scriptJigglypuffSpin: { npc: Npc; directions: Direction[]; slot: number; frameCount: number } | null = null;
let scriptNativeTiming = false;
let scriptPassDelay = 0;
let scriptMoveInPass = false;
let scriptNpcMovement: { npc: Npc; joypad: SimulatedJoypad } | null = null;
const npcCloseFacings = new Map<Npc, Direction>();

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

/** The active menu wTileMap, retained until CloseTextDisplay hides it. */
export function getMartTiles(): ScreenTiles | null {
  return menuSessionTiles;
}

export function getMenuSessionTiles(): ScreenTiles | null { return menuSessionTiles; }

export function isScriptMenuFullScreen(): boolean { return scriptMenuSession?.fullScreen === true; }

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
  scriptNpcMovement?.npc.endInStep();
  scriptNpcMovement = null;
  scriptNativeTiming = false;
  scriptPassDelay = 0;
  scriptMoveInPass = false;
  npcCloseFacings.clear();
  activeScript = createScript(commands);
  scriptSound = null;
  scriptDisplayWaiting = false;
  scriptDisplayStarted = false;
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
  scriptMenuSession = null;
  menuSessionTiles = null;
  scriptHealingMusic = null;
  // A replaced script must not leave a bubble on screen.
  scriptBubble.clear();
  healingMachine = null;
  scriptPikachuRun = null;
  pendingPikachuSpawnState = null;
  savedPikachuFacing = null;
  setOpeningSpriteUpdates(true);
  scriptPush = null;
  scriptParallel = null;
  pikachuDrawingDisabled = false;
  scriptJigglypuffSpin = null;
  scriptAfterHealingMachine = false;
}

/**
 * Update the script engine (called each frame while in 'script' state). Text, waits and
 * fades count frames; every move runs once per overworld pass (`isPass`, every two
 * frames, walk_pace.ts), with the NPCs and Pikachu updating as UpdateSprites does.
 * Returns an action when main.ts needs to handle a state transition.
 */
export function updateScript(deps: ScriptDeps, isPass: boolean, displayAdvanced = false): ScriptAction | null {
  // Post-return PrepareOAMData/DMA cleanup advances once per outer frame, never in a CPU return.
  if (healingMachine?.done) {
    healingMachine.frame();
    if (!healingMachine.visible) healingMachine = null;
  }
  return runScript(deps, isPass, displayAdvanced);
}

function runScript(deps: ScriptDeps, isPass: boolean, displayAdvanced = false): ScriptAction | null {
  const { textBox, player, npcs, playerParty, playerBag, pikachuFollower } = deps;
  scriptFadeAlpha = null; // reset each frame; set below if fade active

  if (!activeScript || !activeScript.active) {
    activeScript = null;
    textBox.dismiss();
    return { type: 'scriptEnded' };
  }

  // VBlank continues during retained text, even when several commands return in one frame.
  // The active menu and the text box share one tick; the menu's PrintText advances here.
  const menuAdvances = scriptMenuSession?.advanceText === true;
  if (scriptMenuSession?.ownsBgTransfer) {
    // StatusScreen.frame owns the tick, including the frame it returns to Bill's PC.
    displayAdvanced = true;
  } else if (menuAdvances && scriptMenuSession) {
    const enabled = textBgTransfer.enabled;
    const third = textBgTransfer.nextPortion;
    textBox.update();
    displayAdvanced = true;
    if (enabled) scriptMenuSession.copyThird(third);
  } else if (!displayAdvanced && textBox.active && !scriptClosingText && !scriptDisplayWaiting) {
    const enabled = !!scriptMenuSession && textBgTransfer.enabled;
    const third = textBgTransfer.nextPortion;
    textBox.updateDisplay();
    displayAdvanced = true;
    if (scriptMenuSession && enabled) scriptMenuSession.copyThird(third);
  }
  if (scriptMenuSession) {
    const done = scriptMenuSession.frame(readJoypad, () => playSFX('press_ab'));
    if (!done) return null;
    scriptMenuSession = null;
    advanceScript(activeScript);
    return runScript(deps, isPass, displayAdvanced);
  }

  // DisplayTextIDInit / PrintText / a retained silent wait owns its VBlank and input.
  if (scriptChoice) {
    const result = yesNoMenu.update(readJoypad);
    if (result === null) return null;
    const chosen = result === 'yes' ? scriptChoice.yes : scriptChoice.no;
    scriptChoice = null;
    activeScript.commands.splice(activeScript.index + 1, 0, ...chosen);
    advanceScript(activeScript);
    return runScript(deps, isPass, displayAdvanced);
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
    return runScript(deps, isPass, displayAdvanced);
  }
  if (scriptBubble.showing !== null) {
    if (!scriptBubble.tick()) return null;
    // EmotionBubble returns to UpdateSprites with the display's font still loaded.
    fontLoadedUpdateSprites(player, deps.gameMap, (x, y) => uiTiles.tileAt(x, y), pikachuFollower);
    advanceScript(activeScript);
    return runScript(deps, isPass, displayAdvanced);
  }
  if (healingMachine && !healingMachine.done) {
    if (healingMachine.frame() !== 'done') return null;
    advanceScript(activeScript);
    return runScript(deps, isPass, displayAdvanced);
  }
  if (scriptHealingMusic) {
    if (!scriptHealingMusic.ready || isMusicChannelActive(1)) return null;
    scriptHealingMusic = null;
    deps.restoreMapMusic?.('pn');
    advanceScript(activeScript);
    return runScript(deps, isPass, displayAdvanced);
  }
  if (scriptDisplayWaiting) {
    textBox.update();
    displayAdvanced = true;
    if (!textBox.isComplete) return null;
    scriptDisplayWaiting = false;
    advanceScript(activeScript);
    return runScript(deps, isPass, displayAdvanced);
  }

  // Only the button wait and Hold read Joypad. Sound/copy waits freeze the world without reads.
  if (scriptSound || scriptClosingText) {
    if (scriptSound) {
      if (!scriptSound.played) {
        if (scriptSound.waitForCurrent && !isSoundFinished()) return null;
        playSFX(scriptSound.name);
        scriptSound.played = true;
      }
      if (!isSoundFinished()) return null;
      scriptSound = null;
    } else {
      textBox.update();
      displayAdvanced = true;
      if (textBox.hidesWindow || !textBox.active) menuSessionTiles = null;
      if (textBox.active) return null;
      scriptClosingText = false;
    }
    advanceScript(activeScript);
    return runScript(deps, isPass, displayAdvanced); // routine returns in this frame, not a frame later
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
  if ((!scriptDisplayStarted && !scriptNativeTiming && scriptWaitFrames > 0) || scriptFade) {
    syncJoypadRead();
  }

  // Handle waiting states
  if (scriptWaitFrames > 0) {
    scriptWaitFrames--;
    if (scriptWaitFrames <= 0) {
      advanceScript(activeScript);
      // Migrated DelayFrames returns into the next command in its final CPU tick.
      // Pre-display/legacy movement waits retain their existing dispatch timing.
      if (scriptDisplayStarted || scriptNativeTiming) return runScript(deps, isPass, displayAdvanced);
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

  // ── Moves: once per overworld pass. Each checks at the top of the pass whether it has
  // finished, as the map script does before the rest of the loop runs. ──
  if (scriptPassDelay > 0) {
    if (--scriptPassDelay > 0) return null;
    advanceScript(activeScript);
    return runScript(deps, true, displayAdvanced);
  }
  if (scriptNpcMovement) {
    if (!isPass) return null;
    const { npc, joypad } = scriptNpcMovement;
    if (!player.isBusy && joypad.done) {
      npc.endInStep();
      scriptNpcMovement = null;
      advanceScript(activeScript);
      return runScript(deps, true, displayAdvanced);
    }
    let entry: Direction | null = null;
    let collide = false;
    if (!player.isBusy) {
      readJoypad();
      const next = joypad.next();
      if (!next) throw new Error('empty NPC movement input');
      ({ entry, collide } = next);
    }
    player.simulatedPass(entry, collide,
      () => updateSprites([...npcs, ...scriptNpcs], deps.gameMap, player, pikachuFollower),
      deps.gameMap, npcs, () => spriteTable(player, [...npcs, ...scriptNpcs], pikachuFollower));
    if (player.startedFollowStep && pikachuFollower?.visible) recordStepForPikachu(player, pikachuFollower);
    return player.justFinishedStep ? { type: 'overworldStep' } : null;
  }
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
      if (scriptMoveInPass) {
        scriptMoveInPass = false;
        return runScript(deps, true, displayAdvanced);
      }
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

  if (cmd.spriteIndex !== undefined) setSpriteIndex(cmd.spriteIndex);
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
      void playMusicNew('pkmnhealed').then(() => { music.ready = true; });
      return null;
    }
    case 'displayOpen':
      scriptDisplayStarted = true;
      textBox.open({ autoBox: cmd.autoBox ?? mapAutoTextBox(deps.gameMap.mapData?.name ?? ''), spriteUpdate: cmd.spriteUpdate });
      if (npcCloseFacings.size) {
        const saved = [...npcCloseFacings];
        npcCloseFacings.clear();
        textBox.restoreFacingAtClose(() => { for (const [npc, facing] of saved) npc.setLiveFacing(facing); });
      }
      scriptDisplayWaiting = true;
      return null;

    case 'menuBox':
      // TextBoxBorder clears the box's interior, the old ▶ with it.
      scriptMenuBox = cmd.layout ? { layout: cmd.layout, cursor: null } : null;
      advanceScript(activeScript);
      return runScript(deps, isPass, displayAdvanced);

    case 'menuInput':
      scriptMenu = { input: new MenuInput(cmd.menu), then: cmd.then };
      if (scriptMenuBox) scriptMenuBox.cursor = scriptMenu.input.cursor; // PlaceMenuCursor, then Delay3
      return null;

    case 'restoreSavedScreen':
      scriptMenuBox = null;
      textBox.clearInterior();
      advanceScript(activeScript);
      return runScript(deps, isPass, displayAdvanced);

    case 'pokemart': {
      menuSessionTiles = new ScreenTiles();
      const tiles = menuSessionTiles;
      scriptMenuSession = new PokemartSession(tiles, textBox, textBgTransfer, playerBag, {
        get: () => deps.getMoney?.() ?? 0,
        set: amount => deps.setMoney?.(amount),
      }, cmd.items, () => fontLoadedUpdateSprites(player, deps.gameMap,
        (x, y) => tiles.at(x, y) ? 0x60 : textBox.uiTileAt(x, y), pikachuFollower));
      scriptMenuSession.enter();
      return null;
    }

    case 'pc': {
      if (!deps.pcItems) throw new Error('PC requires item storage');
      menuSessionTiles = new ScreenTiles();
      const tiles = menuSessionTiles;
      scriptMenuSession = new PcSession(tiles, textBox, textBgTransfer, playerBag, deps.pcItems,
        () => {
          pikachuFollower?.reconcileStorageParty(playerParty);
          fontLoadedUpdateSprites(player, deps.gameMap,
            (x, y) => tiles.at(x, y) ? 0x60 : textBox.uiTileAt(x, y), pikachuFollower);
        }, cmd.mode, deps.pcStorage);
      scriptMenuSession.enter();
      return null;
    }

    case 'printText':
      textBox.print({ program: cmd.program }, { box: cmd.box, bindings: cmd.bindings, noDelay: cmd.noDelay });
      if (textBox.isComplete) { advanceScript(activeScript); return runScript(deps, isPass, displayAdvanced); }
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
      return runScript(deps, isPass, displayAdvanced);

    case 'townMap':
      return { type: 'townMap' }; // main.ts advances the script when the Town Map returns

    case 'displayHide':
      textBox.hideDisplay();
      scriptChoice = null;
      advanceScript(activeScript);
      return runScript(deps, isPass, displayAdvanced);

    case 'sound':
      scriptSound = { name: cmd.name, played: false, waitForCurrent: cmd.waitForCurrent ?? false };
      return runScript(deps, isPass, displayAdvanced);

    case 'textButtonWait':
      if (!textBox.displaySession || !textBox.active) throw new Error('textButtonWait requires an open display');
      textBox.waitSilent();
      if (textBox.isComplete) { advanceScript(activeScript); return runScript(deps, isPass, displayAdvanced); }
      scriptDisplayWaiting = true;
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
      return runScript(deps, isPass, displayAdvanced);
    }

    case 'showObject': {
      showObject(cmd.map, cmd.npcId);
      if (deps.gameMap.mapData?.name === cmd.map) {
        const npc = lookupNpc(cmd.npcId, npcs);
        if (npc) npc.hidden = false;
      }
      updateSprites([...npcs, ...scriptNpcs], deps.gameMap, player, pikachuFollower);
      advanceScript(activeScript);
      return runScript(deps, isPass, displayAdvanced);
    }

    case 'overworldLoop':
      scriptNativeTiming = true;
      if (cmd.resumeInput) {
        deps.resetPassClock?.();
        activeScript = null;
        textBox.dismiss();
        return { type: 'scriptEnded', resumePass: true };
      }
      if (cmd.updateSprites) player.simulatedPass(null, false,
        () => updateSprites([...npcs, ...scriptNpcs], deps.gameMap, player, pikachuFollower), deps.gameMap, npcs);
      deps.resetPassClock?.();
      scriptPassDelay = 2;
      return null;

    case 'joyIgnore':
      setJoyIgnore(cmd.mask);
      advanceScript(activeScript);
      return runScript(deps, isPass, displayAdvanced);

    case 'npcMovementScript': {
      if (!isPass) return null;
      const npc = lookupNpc(cmd.npcId, npcs);
      if (!npc) throw new Error(`missing movement-script NPC ${cmd.npcId}`);
      scriptNativeTiming = true;
      if (cmd.music) void playMusic(cmd.music);
      npc.startInStepMove(cmd.guidePath);
      scriptNpcMovement = { npc, joypad: new SimulatedJoypad(cmd.joypad) };
      return runScript(deps, true, displayAdvanced);
    }

    case 'setSpritePosition1':
    case 'restoreSpritePosition2': {
      const npc = lookupNpc(cmd.npcId, npcs);
      if (!npc) throw new Error(`missing positioned NPC ${cmd.npcId}`);
      if (cmd.type === 'setSpritePosition1') npc.setSpritePosition1(cmd.mapStep, cmd.screenDx, cmd.screenDy);
      else npc.restoreSpritePosition2(cmd.saved);
      advanceScript(activeScript);
      return runScript(deps, isPass, displayAdvanced);
    }

    case 'moveNpc': {
      const npc = lookupNpc(cmd.npcId, npcs);
      if (npc) {
        npc.startScriptedMove(cmd.path, cmd.modes, cmd.options);
        scriptMoveTarget = 'npc';
        scriptMoveNpcId = cmd.npcId;
        scriptMoveInPass = cmd.inPass ?? false;
        if (scriptMoveInPass) {
          scriptNativeTiming = true;
          deps.resetPassClock?.();
          player.simulatedPass(null, false,
            () => updateSprites([...npcs, ...scriptNpcs], deps.gameMap, player, pikachuFollower), deps.gameMap, npcs);
        }
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
      if (npc) {
        if (cmd.restoreAtClose) npcCloseFacings.set(npc, npc.direction);
        if (cmd.write === 'live') npc.setLiveFacing(cmd.direction);
        else if (cmd.write === 'image') npc.showStandingImage(cmd.direction);
        else npc.faceDirection(cmd.direction);
      }
      advanceScript(activeScript);
      break;
    }

    case 'facePlayer':
      player.direction = cmd.direction;
      advanceScript(activeScript);
      if (scriptDisplayStarted && textBox.active) return runScript(deps, isPass, displayAdvanced);
      break;

    case 'wait':
      scriptWaitFrames = cmd.frames;
      break;

    case 'setFlag':
      setFlag(cmd.flag);
      advanceScript(activeScript);
      if (textBox.active && textBox.isComplete) return runScript(deps, isPass, displayAdvanced);
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
      if (textBox.active && textBox.isComplete) return runScript(deps, isPass, displayAdvanced);
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
      if (scriptDisplayStarted && (!scriptAwaitInteraction || scriptFreeSub === 'handler')) return runScript(deps, isPass, displayAdvanced);
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
      if (cmd.waitForCurrent && !isSoundFinished()) return null;
      // The nurse's restoration follows her machine; every other script is PlayDefaultMusic
      deps.restoreMapMusic?.(scriptAfterHealingMachine ? 'nurse' : 'dm');
      scriptAfterHealingMachine = false;
      advanceScript(activeScript);
      if (cmd.waitForCurrent) return runScript(deps, isPass, displayAdvanced);
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
      // DisablePikachuOverworldSpriteDrawing; the nurse's branch checks following.
      if (pikachuFollower?.visible) {
        pikachuFollower.hideImage();
        pikachuFollower.visible = false;
        pikachuDrawingDisabled = true;
      }
      advanceScript(activeScript);
      break;

    case 'showPikachu':
      // wPikachuSpawnState = 5, EnablePikachuOverworldSpriteDrawing: drawing is allowed
      // again, but nothing is drawn until an image is written (Func_6ebb or UpdateSprites).
      // Spawn state 5 is read only by a Pikachu that isn't out (TrySpawnPikachu).
      pendingPikachuSpawnState = 5;
      if (pikachuDrawingDisabled && pikachuFollower) {
        pikachuFollower.visible = true;
        pikachuDrawingDisabled = false;
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
      if (cmd.fontLoaded === false) {
        updateSprites([...npcs, ...scriptNpcs], deps.gameMap, player, pikachuFollower);
        advanceScript(activeScript);
        return runScript(deps, isPass, displayAdvanced);
      }
      // TrySpawnPikachu for a starter that wasn't out (status 0), at the pending spawn
      // state; then SpawnPikachu_ with the font loaded (Func_fc76a).
      if (pikachuFollower && !pikachuFollower.visible && !pikachuDrawingDisabled
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
        if (textBox.active && textBox.displaySession) textBox.restoreFacingAtClose(() => follower.setLiveFacing(facing));
        else follower.setLiveFacing(facing);
      }
      advanceScript(activeScript);
      break;

    case 'ifPewterPikachuAsleep':
      if (deps.gameMap.mapData?.name === 'PewterPokecenter' && isPikachuFollowingDisabled()) {
        activeScript.commands.splice(activeScript.index + 1, Infinity, ...cmd.then);
      }
      advanceScript(activeScript);
      break;

    case 'ifStarterPikachu': {
      const alive = shouldPikachuFollow(playerParty);
      const disabled = isPikachuFollowingDisabled();
      const fires = cmd.following === true ? alive && !disabled
        : cmd.following === false ? alive && disabled
        : alive;
      if (fires) {
        activeScript.commands.splice(activeScript.index + 1, 0, ...cmd.then);
      }
      advanceScript(activeScript);
      break;
    }

    case 'jigglypuffSpin': {
      if (!scriptJigglypuffSpin) {
        const npc = lookupNpc(cmd.npcId, npcs);
        if (!npc) { advanceScript(activeScript); break; }
        const DIRS: Direction[] = ['down', 'left', 'up', 'right'];
        const startIdx = DIRS.indexOf(npc.direction);
        const rotated = [...DIRS.slice(startIdx), ...DIRS.slice(0, startIdx)];
        playMusic('jigglypuffsong');
        scriptJigglypuffSpin = { npc, directions: rotated, slot: 0, frameCount: 0 };
        npc.showStandingImage(rotated[0]);
        return null;
      }
      scriptJigglypuffSpin.frameCount++;
      if (scriptJigglypuffSpin.frameCount % 24 === 0) {
        if (!isMusicChannelActive(1) && !isMusicChannelActive(2)) {
          scriptJigglypuffSpin = null;
          advanceScript(activeScript);
          break;
        }
        scriptJigglypuffSpin.slot = (scriptJigglypuffSpin.slot + 1) % 4;
        scriptJigglypuffSpin.npc.showStandingImage(scriptJigglypuffSpin.directions[scriptJigglypuffSpin.slot]);
      }
      return null;
    }

    case 'healingMachine':
      scriptAfterHealingMachine = true;
      healingMachine = new HealingMachineSession(playerParty.length, {
        preloadMusic, fadeOutAndStopMusic, isAudioFadingOut, playSFX, playMusic: playMusicNew, isMusicChannelActive,
      });
      if (healingMachine.done) advanceScript(activeScript);
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

  if ((scriptDisplayStarted || scriptNativeTiming) && activeScript.index !== commandIndex &&
      (!scriptAwaitInteraction || scriptFreeSub === 'handler')) return runScript(deps, isPass, displayAdvanced);
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
  const { player, gameMap, npcs, pikachuFollower } = deps;

  if (!scriptAwaitInteraction || !activeScript) return null;

  if (scriptFreeSub === 'guard_delay') {
    if (--scriptWaitFrames <= 0) scriptFreeSub = 'move';
    return null; // OaksLabPlayerForcedToWalkBackScript Delay3 owns no Joypad.
  }

  // The rest moves: once per overworld pass
  if (!isPass) return null;
  player.finishLanding(); // Clear the shadow before free movement can open START or text.
  const allNpcs = [...npcs, ...scriptNpcs];
  const sprites = (): void => updateSprites(allNpcs, gameMap, player, pikachuFollower);

  // Sub-state: player being forced 1 step up after guard
  if (scriptFreeSub === 'guard_step') {
    if (player.scriptedMoveDone) {
      scriptWaitFrames = 3; scriptFreeSub = 'guard_delay';
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
        scriptAwaitInteraction = null;
        advanceScript(activeScript);
        return runScript(deps, isPass); // ball DisplayTextID starts on the A press
      }
      const textId = interaction.npc.data.textId;
      const name = gameMap.mapData!.name;
      const handler = getTextHandler(name, textId);
      const call = mapTextCall(name, textId);
      const plain = call?.call === 'text' || call?.call === 'printText' ? call : undefined;
      if (!handler && !plain) throw new Error(`unresolved free-move NPC ${name}:${interaction.npc.data.id}`);
      const body = handler ? applyMapAutoTextBox(handler({ hasFlag, bag: deps.playerBag, party: deps.playerParty,
        ownedCount: getOwnedCount(), facing: player.direction, step: mapStep(player),
        findNpc: id => lookupNpc(id, npcs) }), name) : displayTextID([
          { type: 'printText', program: plain!.program, box: plain!.call === 'printText' ? 'new' : 'keep' },
        ], { autoBox: mapAutoTextBox(name) });
      return startFreeDisplay(body, deps, isPass);
    }
    if ('scriptId' in interaction || 'program' in interaction) {
      const display = interactionDisplay(interaction, {
        hasFlag, bag: deps.playerBag, party: deps.playerParty, ownedCount: getOwnedCount(),
        facing: player.direction, step: mapStep(player), findNpc: id => lookupNpc(id, npcs),
      }, bookshelfContext(player, gameMap));
      if (display) return startFreeDisplay(display, deps, isPass);
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
      sprites(); // OaksLabPlayerDontGoAwayScript's UpdateSprites before the display
      const body = displayTextID([{ type: 'printText', program: scriptAwaitInteraction.guardProgram }],
        { autoBox: false, textId: gameMap.mapData?.name === 'OaksLab' ? 10 : undefined });
      return startFreeDisplay(body, deps, isPass, true);
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
  return runScript(deps, isPass);
}

// ── Render helpers ─────────────────────────────────────────────────────

/** Render the machine's retained OAM scanout, including its two post-return frames. */
export function renderHealingMachine(): void { healingMachine?.render(); }

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

/** Transferred menu tiles paint after text so the list can cover its row-12 border. */
export function renderMenuSession(): void {
  if (scriptMenuSession?.fullScreen) { scriptMenuSession.renderOverlay(); return; }
  if (!menuSessionTiles) return;
  const T = TILE_SIZE;
  for (let y = 0; y < 18; y++) {
    for (let x = 0; x < 20; x++) {
      const logical = menuSessionTiles.at(x, y);
      if (logical) uiTiles.cover(x * T, y * T, T, T);
      const shown = menuSessionTiles.visibleAt(x, y);
      if (shown !== null) drawScreenTile(shown, x * T, y * T);
    }
  }
  scriptMenuSession?.renderOverlay();
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
