import {Game}     from './game.js';
import {Renderer} from './renderer.js';
import {Keyboard} from './keyboard.js';
import {Cursor} from './cursor.js';
import {AISimpleton} from './ai/aiSimpleton.js';
import {AIInput} from './ai/aiInput.js';
import {Buttons} from './input.js';
import {InputOr} from './InputOr.js';
import {GamePadInput, GamePadManager} from './GamePad.js';
import {Menu} from './menu.js';
import {CharSelect} from './charSelect.js';
import {GameOverOverlay} from './gameOver.js';
import {PauseMenu} from './pauseMenu.js';
import {SpeedSelect} from './speedSelect.js';
import {DifficultySelect} from './difficultySelect.js';
import {SettingsMenu} from './settingsMenu.js';
import {TitleScreen} from './titleScreen.js';
import {RoundOver} from './roundOver.js';
import {preloadWinPoints} from './winPoints.js';
import {charStage, randomCharacter} from './characters.js';
import {audio} from './audio.js';
import {showToast} from './toast.js';
import {get as getSetting} from './settings.js';
import { measure, wantsVirtualPad, STAGE_GAP } from './viewport.js';
import { vsCompactLayout, vsVariantFor } from './vsFrames.js';
import { TouchInput } from './touchInput.js';
import { VirtualPad } from './virtualPad.js';

const STATE_TITLE = 'TITLE';
const STATE_MENU = 'MENU';
const STATE_SETTINGS = 'SETTINGS';
const STATE_CHAR_SELECT = 'CHAR_SELECT';
const STATE_DIFFICULTY_SELECT = 'DIFFICULTY_SELECT';
const STATE_SPEED_SELECT = 'SPEED_SELECT';
const STATE_PLAYING = 'PLAYING';
const STATE_PAUSED = 'PAUSED';
const STATE_ROUND_OVER = 'ROUND_OVER';
const STATE_GAME_OVER = 'GAME_OVER';

// How long the boards sit visible -- with their per-board WIN!/LOSE signs and
// the winner's victory pose -- before the (nearly full-viewport) results
// modal covers them. See endMatch().
const RESULT_SIGN_DELAY_MS = 1400;

// Player 2's keyboard layout for 2P local play. Kept clear of Player 1's keys
// (arrows / Space / Right-Shift) and of the P/F debug keys.
const PLAYER_TWO_KEYS = {
  up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
  swap: 'KeyG', scroll: 'KeyH',
  // Park the debug bindings on keys nobody presses so P2 can't pause/step.
  pause: 'F15', frame_advance: 'F16',
};

// A running match: one or two boards plus everything that drives them.
// Knows how to tick, draw, and fully tear itself down.
class Match {
  constructor({ mode, games, ais, renderers, keyboards, pauseKeyboard, startSpeed, touchInput, virtualPad, viewport }) {
    this.mode = mode;
    this.games = games;
    this.ais = ais;
    this.renderers = renderers;       // [{ renderer, game }]
    this.keyboards = keyboards;
    this.pauseKeyboard = pauseKeyboard; // Player 1's keyboard owns pause/frame-step
    this.startSpeed = startSpeed || 1;
    this.touchInput = touchInput || null;
    this.virtualPad = virtualPad || null;
    this.viewport = viewport || null;
    // Which boards the computer is playing. Used to decide whose danger the
    // music should react to -- the AI being in trouble is good news, and
    // scoring it with the panic track would say the opposite.
    this.aiBoards = new Set(ais.map((ai) => ai.board));
  }

  // True while a human board is in the red. Drives the danger music.
  playerInDanger() {
    return this.games.some((game) => (
      !this.aiBoards.has(game.board) && game.board.inDanger && !game.board.toppedOut
    ));
  }

  tickGameplay() {
    // Tick the human board(s) first, let the AI decide, then tick the rest.
    // Mirrors the original ordering: left.tick() -> ai.tick() -> right.tick().
    this.games[0].tick();
    this.ais.forEach((ai) => ai.tick());
    for (let i = 1; i < this.games.length; i++) {
      this.games[i].tick();
    }
  }

  draw() {
    this.renderers.forEach(({ renderer, game }) => renderer.draw(game));
  }

  // The outcome once a board has topped out, or null while the match is still live.
  // games[0] is always Player 1; games[1] is the AI or Player 2 in two-board modes.
  //
  // `winnerIndex` is which board took the round -- 0, 1, or null for a draw (and
  // for 1P, which has nobody to beat). It is what set play counts; the title and
  // subtitle are only for the results screen.
  result() {
    const out = this.games.map((game) => game.isToppedOut());
    if (!out.some(Boolean)) {
      return null;
    }

    const scores = this._buildScores();

    // `won` is from Player 1's point of view, and picks the results stinger.
    // In 2P someone always won, so it stays celebratory either way. The big
    // WIN!/LOSE/DRAW sign is drawn per board by the renderer (from
    // board.victorious / board.toppedOut / board.drew), not here.
    if (this.games.length === 1) {
      return { title: 'GAME OVER', subtitle: 'Your stack reached the top.', scores, won: false, winnerIndex: null };
    }
    if (out[0] && out[1]) {
      return { title: 'DRAW', subtitle: 'Both stacks topped out.', scores, won: false, winnerIndex: null };
    }

    const winnerIndex = out[1] ? 0 : 1;
    const playerOneWon = winnerIndex === 0;
    if (this.mode === 'vsai') {
      return playerOneWon
        ? { title: 'YOU WIN', subtitle: 'The AI topped out.', scores, won: true, winnerIndex }
        : { title: 'AI WINS', subtitle: 'Your stack reached the top.', scores, won: false, winnerIndex };
    }
    return playerOneWon
      ? { title: 'PLAYER 1 WINS', subtitle: 'Player 2 topped out.', scores, won: true, winnerIndex }
      : { title: 'PLAYER 2 WINS', subtitle: 'Player 1 topped out.', scores, won: true, winnerIndex };
  }

  // Short per-side captions for the win-point lamps.
  sideLabels() {
    return this.mode === 'vsai' ? ['YOU', 'AI'] : ['P1', 'P2'];
  }

  _buildScores() {
    if (this.games.length === 1) {
      return [{ label: 'Score', value: this.games[0].board.score }];
    }
    const p1Label = this.mode === 'vsai' ? 'You' : 'P1';
    const p2Label = this.mode === 'vsai' ? 'AI' : 'P2';
    return [
      { label: p1Label, value: this.games[0].board.score },
      { label: p2Label, value: this.games[1].board.score },
    ];
  }

  destroy() {
    this.keyboards.forEach((k) => k.detach());
    if (this.virtualPad) {
      this.virtualPad.destroy();
      this.virtualPad = null;
    }
    if (this.touchInput) {
      this.touchInput.releaseAll();
      this.touchInput = null;
    }
  }
}

// The stage frame writes inline sizing/position onto a board container. Strip it
// so the container returns to a plain box (for the menu, or the next match).
function resetContainer(el) {
  if (!el) return;
  el.innerHTML = '';
  el.style.position = '';
  el.style.width = '';
  el.style.height = '';
  el.style.left = '';
  el.style.top = '';
  el.style.overflow = '';
  el.style.display = '';
  el.style.backgroundImage = '';
  el.style.backgroundSize = '';
  el.style.backgroundPosition = '';
  el.style.backgroundRepeat = '';
  el.style.imageRendering = '';
}

function resetShell(shell) {
  if (!shell) return;
  shell.innerHTML = '';
  shell.hidden = true;
  shell.style.cssText = '';
}

// Build a match for the chosen mode. The gamepad manager is shared across matches.
// p1Char / p2Char come from the character select screen; each board's stage
// background is derived from its character (or randomised for stageless ones).
//
// `app` is the App instance (for pause callback + set tally on compact HUD).
// When `existingGames` is provided, rebuild only the renderers (resize) and keep
// the same Board objects so score/clock survive a rotate.
function buildMatch(mode, gamePadManager, containers, p1Char, p2Char, startSpeed = 1, aiDifficulty = 'normal', app = null, existing = null) {
  const { leftContainer, rightContainer, vsShell, stageEl } = containers;
  const games = existing ? existing.games : [];
  const ais = existing ? existing.ais : [];
  const keyboards = existing ? existing.keyboards : [];
  const renderers = [];

  let leftGame;
  let rightGame = null;
  let p1Keyboard;
  let touchInput = existing ? existing.touchInput : null;
  let virtualPad = null;

  if (existing) {
    leftGame = existing.games[0];
    rightGame = existing.games[1] || null;
    p1Keyboard = existing.pauseKeyboard;
    // Drop old pad DOM; recreate below if still wanted.
    if (existing.virtualPad) {
      existing.virtualPad.destroy();
      existing.virtualPad = null;
    }
    if (touchInput) touchInput.releaseAll();
  } else {
    // --- Player 1 (left board) is a human in every mode ---
    p1Keyboard = new Keyboard({});
    keyboards.push(p1Keyboard);
    touchInput = new TouchInput();
    const p1Input = new InputOr([
      new GamePadInput({ gamePadManager, gamePadIndex: 0 }),
      p1Keyboard,
      touchInput,
    ]);
    leftGame = new Game({ speedLevel: startSpeed });
    leftGame.addCursor(new Cursor(p1Input, leftGame.board));
    games.push(leftGame);

    // --- Right board depends on mode ---
    if (mode === 'vsai') {
      rightGame = new Game({ speedLevel: startSpeed });
      const aiInput = new AIInput();
      const aiCursor = new Cursor(aiInput, rightGame.board);
      rightGame.addCursor(aiCursor);
      ais.push(new AISimpleton({ board: rightGame.board, input: aiInput, cursor: aiCursor, difficulty: aiDifficulty }));
    } else if (mode === '2p') {
      rightGame = new Game({ speedLevel: startSpeed });
      const p2Keyboard = new Keyboard(PLAYER_TWO_KEYS);
      keyboards.push(p2Keyboard);
      const p2Input = new InputOr([
        new GamePadInput({ gamePadManager, gamePadIndex: 1 }),
        p2Keyboard,
      ]);
      rightGame.addCursor(new Cursor(p2Input, rightGame.board));
    }

    if (rightGame) {
      leftGame.linkTrashQueue(rightGame);
      rightGame.linkTrashQueue(leftGame);
      games.push(rightGame);
    }
  }

  const boardCount = games.length;
  const vp = measure({ boardCount, mode });
  _applyStageFlex(stageEl, vp);

  // Tear down previous chrome.
  resetContainer(leftContainer);
  resetContainer(rightContainer);
  resetShell(vsShell);

  const p1Stage = charStage(p1Char);
  const p2Stage = rightGame ? charStage(p2Char) : null;

  if (vp.chrome === 'vsCompact' && rightGame) {
    leftContainer.style.display = 'none';
    rightContainer.style.display = 'none';
    const variant = vp.vsVariant || vsVariantFor(mode) || 'vsCpu';
    const layout = vsCompactLayout(variant, vp.scale);
    _buildVsShell(vsShell, layout);

    const leftR = new Renderer('ta-vs-well-left', leftGame.board, {
      chrome: 'vsCompact', scale: vp.scale, side: 'left',
    });
    const rightR = new Renderer('ta-vs-well-right', rightGame.board, {
      chrome: 'vsCompact', scale: vp.scale, side: 'right',
    });
    leftR.setCompactHud({
      partnerBoard: rightGame.board,
      sideLabels: mode === 'vsai' ? ['YOU', 'AI'] : ['P1', 'P2'],
      setWins: app ? app.setWins : [0, 0],
      winsNeeded: app ? app.winsNeeded : 1,
      stripPlacement: layout.strip,
      variant,
    });
    renderers.push({ renderer: leftR, game: leftGame });
    renderers.push({ renderer: rightR, game: rightGame });
  } else {
    vsShell.hidden = true;
    leftContainer.style.display = '';
    renderers.push({
      renderer: new Renderer('game-container-left', leftGame.board, {
        stage: p1Stage, character: p1Char, scale: vp.scale, chrome: 'stage', side: 'left',
      }),
      game: leftGame,
    });
    if (rightGame) {
      rightContainer.style.display = '';
      renderers.push({
        renderer: new Renderer('game-container-right', rightGame.board, {
          stage: p2Stage, character: p2Char, scale: vp.scale, chrome: 'stage', side: 'right',
        }),
        game: rightGame,
      });
    } else {
      rightContainer.style.display = 'none';
    }
  }

  // Virtual pad: coarse pointer / touch devices only. Input is always in the
  // stack; the pad is the only DOM that shows controls.
  if (wantsVirtualPad() && app) {
    virtualPad = new VirtualPad({
      input: touchInput,
      onPause: () => app.pauseMatch(),
    });
  }

  // Playing: stop browser scroll/pinch over the stage.
  if (stageEl) {
    stageEl.style.touchAction = 'none';
  }

  return new Match({
    mode, games, ais, renderers, keyboards,
    pauseKeyboard: p1Keyboard, startSpeed,
    touchInput, virtualPad, viewport: vp,
  });
}

function _applyStageFlex(stageEl, vp) {
  if (!stageEl) return;
  stageEl.style.flexDirection = vp.stageFlex || 'row';
  stageEl.style.gap = `${STAGE_GAP}px`;
}

function _buildVsShell(shell, layout) {
  shell.hidden = false;
  shell.innerHTML = '';
  shell.style.cssText = `
    position: relative;
    width: ${layout.frameW}px;
    height: ${layout.frameH}px;
    flex-shrink: 0;
    background-image: url('${layout.sheetUrl}');
    background-repeat: no-repeat;
    background-size: ${layout.bgSizeW}px ${layout.bgSizeH}px;
    background-position: ${layout.bgPosX}px ${layout.bgPosY}px;
    image-rendering: pixelated;
  `;

  for (const side of ['left', 'right']) {
    const well = document.createElement('div');
    well.id = `ta-vs-well-${side}`;
    const w = layout.wells[side];
    well.style.cssText = `
      position: absolute;
      left: ${w.left}px; top: ${w.top}px;
      width: ${w.width}px; height: ${w.height}px;
      overflow: hidden;
    `;
    shell.appendChild(well);
  }
}

// Top-level application state machine: MENU <-> PLAYING.
class App {
  constructor() {
    this.state = STATE_MENU;
    this.match = null;
    this.menu = null;
    this.titleScreen = null;
    this.settingsMenu = null;
    this.charSelect = null;
    this.difficultySelect = null;
    this.speedSelect = null;
    this.pauseMenu = null;
    this.roundOver = null;
    this.gameOver = null;
    this.mode = null;
    // Set play (VS AI and 2P): a round is one board death, a set is first to
    // `winsNeeded`. Both are seeded by _launchSet(); 1P and a match length of 1
    // leave _isSetPlay() false, and then a round *is* the set, exactly as before.
    this.setWins = [0, 0];
    this.roundNumber = 1;
    this.matchLength = 1;
    this.winsNeeded = 1;
    this.p1Char = null;
    this.p2Char = null;
    this.startSpeed = 1;
    this.aiDifficulty = 'normal';
    this.pendingGameOver = null;
    this.isPaused = false;
    this.pressedLastFrame = new Set();

    this.gamePadManager = new GamePadManager();
    this.gamePadManager.installEventHandlers();

    this.stageEl = document.getElementById('ta-stage');
    this.leftContainer = document.getElementById('game-container-left');
    this.rightContainer = document.getElementById('game-container-right');
    this.vsShell = document.getElementById('ta-vs-shell');
    // Ensure the compact shell exists even if the HTML is an older copy.
    if (!this.vsShell && this.stageEl) {
      this.vsShell = document.createElement('div');
      this.vsShell.id = 'ta-vs-shell';
      this.vsShell.hidden = true;
      this.stageEl.appendChild(this.vsShell);
    }

    // Debounced resize: rebuild renderers when scale/layout/chrome change.
    // Frame counter on renderers restarts; boards keep playing.
    this._resizeTimer = null;
    this._onResize = () => {
      if (this._resizeTimer) clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => this._handleResize(), 120);
    };
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);

    // Esc or P during a match opens the pause menu, which owns quitting from
    // here on. (Char select and the speed picker handle their own Esc via
    // onCancel, and the pause menu handles its own keys, so only STATE_PLAYING
    // is claimed here.)
    document.addEventListener('keydown', (e) => {
      if (this.state !== STATE_PLAYING) return;
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        this.pauseMatch();
      }
    }, true);

    // Browsers keep an AudioContext suspended until the user interacts, so the
    // first key or click is what actually starts the sound system (and kicks
    // off preloading). M mutes at any time.
    const unlock = () => audio.unlock();
    document.addEventListener('keydown', unlock, true);
    document.addEventListener('pointerdown', unlock, true);
    // Mute persists across sessions, so it needs to say so -- otherwise a game
    // muted once is indistinguishable from a game with no sound.
    document.addEventListener('keydown', (e) => {
      if (e.code !== 'KeyM') return;
      showToast(audio.toggleMute() ? 'SOUND OFF' : 'SOUND ON');
    }, true);
  }

  start() {
    this.showTitle();
    this._loop();
  }

  // The intro. Only on launch -- quitting a match goes straight back to the
  // menu, since sitting through the poster again would be a punishment.
  //
  // The menu is built the moment the title starts fading, not after it: the two
  // paint the same poster (see backdrop.js), so the menu appearing *underneath*
  // is what lets the art dim in place instead of cutting. The title screen
  // removes itself once its fade is done.
  showTitle() {
    this.state = STATE_TITLE;
    this.titleScreen = new TitleScreen(() => {
      this.showMenu();
    });
  }

  showMenu(cursorId = null) {
    this.state = STATE_MENU;
    this.menu = new Menu((id) => {
      if (id === 'settings') {
        this.showSettings();
      } else {
        this.showCharSelect(id);
      }
    }, cursorId);
  }

  showSettings() {
    this._clearOverlays();
    this.state = STATE_SETTINGS;
    // Settings write through immediately, so there is nothing to collect here
    // on the way out -- everything that reads one (audio, and the match length
    // below) reads it fresh when it needs it.
    this.settingsMenu = new SettingsMenu(() => {
      this._clearOverlays();
      this.showMenu('settings');
    });
  }

  showCharSelect(mode) {
    this._clearOverlays();
    this.mode = mode;
    this.state = STATE_CHAR_SELECT;

    const title = mode === '2p' ? 'P1 - CHOOSE CHARACTER' : 'CHOOSE YOUR CHARACTER';
    this.charSelect = new CharSelect(title, (p1Char) => {
      this.p1Char = p1Char;

      if (mode === '2p') {
        this._clearOverlays();
        this.charSelect = new CharSelect('P2 - CHOOSE CHARACTER', (p2Char) => {
          this.p2Char = p2Char;
          this._showSpeedSelect();
        }, () => {
          this.showCharSelect(mode);
        });
      } else if (mode === 'vsai') {
        this.p2Char = randomCharacter(p1Char.id);
        this._showDifficultySelect();
      } else {
        this.p2Char = null;
        this._showSpeedSelect();
      }
    }, () => {
      this.quitToMenu();
    });
  }

  // VS AI only: pick the AI's difficulty between character select and the
  // speed picker. The choice persists, so Play Again and the next VS match
  // re-open on the last one.
  _showDifficultySelect() {
    this._clearOverlays();
    this.state = STATE_DIFFICULTY_SELECT;
    this.difficultySelect = new DifficultySelect(
      (difficulty) => {
        this.aiDifficulty = difficulty;
        this._showSpeedSelect();
      },
      () => this.showCharSelect(this.mode),
      this.aiDifficulty,
    );
  }

  _showSpeedSelect() {
    this._clearOverlays();
    this.state = STATE_SPEED_SELECT;
    this.speedSelect = new SpeedSelect(
      (speed) => {
        this.startSpeed = speed;
        this._launchSet();
      },
      () => {
        // Esc retraces the setup flow: back to the difficulty picker in
        // VS AI, straight back to character select everywhere else.
        if (this.mode === 'vsai') {
          this._showDifficultySelect();
        } else {
          this.showCharSelect(this.mode);
        }
      },
      this.startSpeed,
    );
  }

  // Start a fresh set: clear the tally and play round 1. Everything that means
  // "begin again" comes through here -- the speed picker, Play Again, and the
  // pause menu's Restart (restarting mid-set restarts the whole set, since
  // replaying one round of it would be a strange thing to offer).
  _launchSet() {
    this.matchLength = getSetting('matchLength');
    this.winsNeeded = Math.max(1, Math.ceil(this.matchLength / 2));
    this.setWins = [0, 0];
    this.roundNumber = 1;
    if (this._isSetPlay()) preloadWinPoints();
    this._launchRound();
  }

  // Only two-board modes play sets, and only when the player asked for more
  // than a single game.
  _isSetPlay() {
    return this.mode !== '1p' && this.matchLength > 1;
  }

  _containers() {
    return {
      leftContainer: this.leftContainer,
      rightContainer: this.rightContainer,
      vsShell: this.vsShell,
      stageEl: this.stageEl,
    };
  }

  _launchRound() {
    this._clearOverlays();
    if (this.match) { this.match.destroy(); this.match = null; }
    this.match = buildMatch(
      this.mode, this.gamePadManager,
      this._containers(),
      this.p1Char, this.p2Char, this.startSpeed, this.aiDifficulty,
      this,
    );
    this.isPaused = false;
    this.pressedLastFrame.clear();
    this.state = STATE_PLAYING;
    this._syncPadVisibility();
  }

  // Rebuild renderers against the same boards when the viewport ladder step
  // or chrome changes (rotate / resize mid-match). Does not restart the match.
  _handleResize() {
    if (!this.match || (this.state !== STATE_PLAYING && this.state !== STATE_PAUSED && this.state !== STATE_ROUND_OVER && this.state !== STATE_GAME_OVER)) {
      return;
    }
    const boardCount = this.match.games.length;
    const next = measure({ boardCount, mode: this.match.mode });
    const cur = this.match.viewport;
    if (cur && cur.scale === next.scale && cur.layout === next.layout && cur.chrome === next.chrome) {
      return;
    }
    // Preserve games/ais/keyboards/touchInput; rebuild chrome only.
    const preserved = {
      games: this.match.games,
      ais: this.match.ais,
      keyboards: this.match.keyboards,
      pauseKeyboard: this.match.pauseKeyboard,
      touchInput: this.match.touchInput,
      virtualPad: this.match.virtualPad,
    };
    // Don't detach keyboards — we're reusing them.
    if (this.match.virtualPad) {
      this.match.virtualPad.destroy();
      this.match.virtualPad = null;
    }
    this.match = buildMatch(
      this.match.mode, this.gamePadManager,
      this._containers(),
      this.p1Char, this.p2Char, this.match.startSpeed, this.aiDifficulty,
      this,
      preserved,
    );
    // Push current set tally into compact HUD after rebuild.
    this._pushSetTallyToRenderers();
    this.match.draw();
    this._syncPadVisibility();
  }

  _pushSetTallyToRenderers() {
    if (!this.match) return;
    for (const { renderer } of this.match.renderers) {
      if (renderer.stripPanel || renderer.side === 'left') {
        renderer.setWins = this.setWins;
        renderer.winsNeeded = this.winsNeeded;
      }
    }
  }

  _syncPadVisibility() {
    if (!this.match || !this.match.virtualPad) return;
    this.match.virtualPad.setVisible(this.state === STATE_PLAYING);
  }

  // Freeze the match and put the pause menu over it. The match is left intact
  // (not destroyed) so Resume can pick it up exactly where it stopped; the loop
  // simply stops ticking while the state is PAUSED.
  pauseMatch() {
    if (this.state !== STATE_PLAYING || !this.match) return;
    this.state = STATE_PAUSED;
    if (this.match.touchInput) this.match.touchInput.releaseAll();
    this._syncPadVisibility();
    audio.play('pause');
    this.pauseMenu = new PauseMenu((choice) => {
      if (choice === 'resume') {
        this.resumeMatch();
      } else if (choice === 'restart') {
        this._clearOverlays();
        this._launchSet();
      } else {
        this.quitToMenu();
      }
    });
  }

  resumeMatch() {
    this._clearOverlays();
    // Clear any debug frame-step pause, and drop edge-detection state so the
    // key that resumed can't be read as a fresh press on the next frame.
    this.isPaused = false;
    this.pressedLastFrame.clear();
    if (this.match && this.match.touchInput) this.match.touchInput.releaseAll();
    this.state = STATE_PLAYING;
    this._syncPadVisibility();
  }

  // A board topped out, ending the round. Freeze the match, award the win point,
  // and then either move on to the next round or finish the set. The match is
  // kept around either way, so its final frame stays on screen behind the
  // (translucent) overlay that follows.
  endMatch(result) {
    this.state = STATE_GAME_OVER;
    if (this.match && this.match.touchInput) this.match.touchInput.releaseAll();
    this._syncPadVisibility();
    // The round is decided, so the stage/danger loop stops here and the win or
    // lose sting has the moment to itself. The game-over track comes in with
    // the results screen, a beat later.
    audio.stopMusic();
    audio.play(result.won ? 'win' : 'lose');

    // Award the point before drawing, so nothing downstream has to re-derive it.
    // A draw scores for neither side and the round is simply replayed -- which
    // is also why a set cannot end on one.
    const setPlay = this._isSetPlay();
    const awarded = setPlay && result.winnerIndex !== null ? result.winnerIndex : null;
    if (awarded !== null) this.setWins[awarded] += 1;
    const setOver = !setPlay || Math.max(this.setWins[0], this.setWins[1]) >= this.winsNeeded;

    // Let the surviving board's character strike its victory pose, and draw one
    // last frame: the match stops ticking after this (state is no longer
    // STATE_PLAYING), so the boards freeze on the final poses -- and on the
    // per-board WIN!/LOSE/DRAW signs the renderer just started drawing (see
    // renderer.js) -- for the whole delay below.
    const drew = this.match.games.length > 1 && result.winnerIndex === null;
    for (const game of this.match.games) {
      if (!game.isToppedOut()) game.board.victorious = true;
      if (drew) game.board.drew = true;
    }
    this.match.draw();

    // Hold on this frame before the results modal appears. It's nearly
    // full-viewport (see gameover.png's STYLE) and would otherwise eclipse
    // both boards' signs on the very frame they first show up -- the player
    // would never see who won on the boards themselves, only the modal's
    // text. `clearTimeout` guards a defensive double-call; nothing else can
    // reach this state while STATE_GAME_OVER holds the input handlers off.
    const match = this.match;
    const labels = match.sideLabels();
    const round = this.roundNumber;
    clearTimeout(this.pendingGameOver);
    this.pendingGameOver = setTimeout(() => {
      this.pendingGameOver = null;
      if (setOver) {
        // The last round of a set keeps the full GAME OVER screen; the match is
        // over, so its inputs go too.
        match.destroy();
        audio.playMusic('gameOver');
        this.gameOver = new GameOverOverlay(this._setResult(result, setPlay), (choice) => {
          if (choice === 'replay') {
            this._launchSet();
          } else {
            this.quitToTitle();
          }
        });
      } else {
        // Mid-set: a lighter screen that keeps the frozen boards visible, and
        // where the newly won lamp lights up. The match is destroyed on the way
        // out rather than here, so those boards stay on screen behind it.
        this.state = STATE_ROUND_OVER;
        this.roundOver = new RoundOver({
          round,
          title: result.title,
          labels,
          wins: [...this.setWins],
          winsNeeded: this.winsNeeded,
          awarded,
        }, (choice) => {
          if (choice === 'next') {
            this.roundNumber += 1;
            this._launchRound();
          } else {
            this.quitToMenu();
          }
        });
      }
    }, RESULT_SIGN_DELAY_MS);
  }

  // Re-title the results screen for a set, so it reports the set rather than
  // just its final round, and hand the overlay the tally to draw lamps from.
  _setResult(result, setPlay) {
    if (!setPlay) return result;
    const [a, b] = this.setWins;
    const p1TookIt = a > b;
    const title = this.mode === 'vsai'
      ? (p1TookIt ? 'YOU WIN THE SET' : 'AI WINS THE SET')
      : (p1TookIt ? 'PLAYER 1 WINS THE SET' : 'PLAYER 2 WINS THE SET');
    return {
      ...result,
      title,
      subtitle: `${a} - ${b} after ${this.roundNumber} rounds.`,
      won: p1TookIt,
      setWins: [...this.setWins],
      winsNeeded: this.winsNeeded,
    };
  }

  quitToMenu() {
    this._teardownMatch();
    this.showMenu();
  }

  // Where a finished game goes: back to the title, the way an arcade cabinet
  // returns to its attract screen, rather than dropping the player straight
  // back onto the mode list. Quitting *mid*-match still goes to the menu --
  // there the player asked to leave, and making them sit through the intro
  // again would be a punishment.
  quitToTitle() {
    this._teardownMatch();
    this.showTitle();
  }

  _teardownMatch() {
    this._clearOverlays();
    audio.stopMusic();
    if (this.match) { this.match.destroy(); this.match = null; }
    resetContainer(this.leftContainer);
    resetContainer(this.rightContainer);
    resetShell(this.vsShell);
    this.rightContainer.style.display = '';
    if (this.stageEl) {
      this.stageEl.style.touchAction = '';
      this.stageEl.style.flexDirection = '';
    }
  }

  _clearOverlays() {
    // The title screen normally removes itself once its fade finishes; this
    // catches the case where something else moves the app on first (a fast
    // Enter on the menu that appears underneath it).
    if (this.titleScreen) { this.titleScreen.destroy(); this.titleScreen = null; }
    if (this.menu) { this.menu.destroy(); this.menu = null; }
    if (this.settingsMenu) { this.settingsMenu.destroy(); this.settingsMenu = null; }
    if (this.charSelect) { this.charSelect.destroy(); this.charSelect = null; }
    if (this.difficultySelect) { this.difficultySelect.destroy(); this.difficultySelect = null; }
    if (this.speedSelect) { this.speedSelect.destroy(); this.speedSelect = null; }
    if (this.pauseMenu) { this.pauseMenu.destroy(); this.pauseMenu = null; }
    if (this.roundOver) { this.roundOver.destroy(); this.roundOver = null; }
    if (this.gameOver) { this.gameOver.destroy(); this.gameOver = null; }
  }

  _tickPlaying() {
    const keyboard = this.match.pauseKeyboard;
    const frameAdvancePressed = keyboard.isDown(Buttons.GAME_FRAME_ADVANCE);

    // P no longer toggles a hidden pause here -- it opens the pause menu (see
    // the keydown handler in the constructor). F still frame-steps for
    // debugging, and Resume clears the pause it leaves behind.
    let runGameLogic = !this.isPaused;
    if (frameAdvancePressed && !this.pressedLastFrame.has(Buttons.GAME_FRAME_ADVANCE)) {
      this.isPaused = true;
      runGameLogic = true;
    }

    if (runGameLogic) {
      this.match.tickGameplay();
      this.match.draw();

      // Swap the panic track in and out with the red wash. playMusic() ignores
      // a request for what is already playing, so calling it per frame is free.
      audio.playMusic(this.match.playerInDanger() ? 'danger' : 'stage');

      const result = this.match.result();
      if (result) {
        this.endMatch(result);
        return;
      }
    }

    this.pressedLastFrame.clear();
    if (frameAdvancePressed) this.pressedLastFrame.add(Buttons.GAME_FRAME_ADVANCE);
  }

  _loop() {
    const frame = () => {
      const startFrameTime = Date.now();

      // A throw here used to kill the loop outright: the re-arming setTimeout
      // below never ran, so the game froze with the stage art (plain CSS) still
      // on screen and every canvas dead. Keep scheduling no matter what, and
      // surface the error instead of swallowing the whole game with it.
      try {
        if (this.state === STATE_PLAYING && this.match) {
          this._tickPlaying();
        }
      } catch (e) {
        console.error('[TA] frame failed:', e);
      }

      let timeToNextFrame = (1000 / 60) - (Date.now() - startFrameTime);
      if (timeToNextFrame < 0) timeToNextFrame = 0;
      setTimeout(() => requestAnimationFrame(frame), timeToNextFrame);
    };
    frame();
  }
}

function InitiateGame() {
  const app = new App();
  // Exposed purely for debugging. Chrome freezes requestAnimationFrame in a
  // backgrounded tab, which kills the loop dead: it re-arms only through the one
  // pending rAF, so once that is frozen no later patch can revive it. With this
  // handle a driven tab can shim rAF onto setTimeout and then call
  // `TA.InitiateGame.app._loop()` to restart the SAME app -- previously the only
  // way in was to call InitiateGame() again, which left two Apps fighting over
  // one DOM.
  InitiateGame.app = app;
  app.start();
}

export {InitiateGame}
