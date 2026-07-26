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
import {charStage, randomCharacter} from './characters.js';
import {MAX_SPEED_LEVEL} from './board.js';

const STATE_MENU = 'MENU';
const STATE_CHAR_SELECT = 'CHAR_SELECT';
const STATE_PLAYING = 'PLAYING';
const STATE_GAME_OVER = 'GAME_OVER';

// The speed level increases by 1 every this many frames. 1P ramps faster
// (45s) to give the mode real progression; VS/2P ramp slower (90s) so
// matches aren't decided purely by the clock.
const SPEED_RAMP_FRAMES_1P = 60 * 45;  // 45 seconds per level
const SPEED_RAMP_FRAMES_VS = 60 * 90;  // 90 seconds per level

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
  constructor({ mode, games, ais, renderers, keyboards, pauseKeyboard }) {
    this.mode = mode;
    this.games = games;
    this.ais = ais;
    this.renderers = renderers;       // [{ renderer, game }]
    this.keyboards = keyboards;
    this.pauseKeyboard = pauseKeyboard; // Player 1's keyboard owns pause/frame-step
  }

  tickGameplay() {
    // Tick the human board(s) first, let the AI decide, then tick the rest.
    // Mirrors the original ordering: left.tick() -> ai.tick() -> right.tick().
    this.games[0].tick();
    this.ais.forEach((ai) => ai.tick());
    for (let i = 1; i < this.games.length; i++) {
      this.games[i].tick();
    }
    this._tickSpeedRamp();
  }

  _tickSpeedRamp() {
    const interval = this.mode === '1p' ? SPEED_RAMP_FRAMES_1P : SPEED_RAMP_FRAMES_VS;
    const elapsed = this.games[0].board.elapsedFrames;
    const nextLevel = 1 + Math.floor(elapsed / interval);
    if (nextLevel <= MAX_SPEED_LEVEL) {
      for (const game of this.games) {
        if (nextLevel > game.board.speedLevel) {
          game.board.setSpeedLevel(nextLevel);
        }
      }
    }
  }

  draw() {
    this.renderers.forEach(({ renderer, game }) => renderer.draw(game));
  }

  // The outcome once a board has topped out, or null while the match is still live.
  // games[0] is always Player 1; games[1] is the AI or Player 2 in two-board modes.
  result() {
    const out = this.games.map((game) => game.isToppedOut());
    if (!out.some(Boolean)) {
      return null;
    }

    const scores = this._buildScores();

    if (this.games.length === 1) {
      return { title: 'GAME OVER', subtitle: 'Your stack reached the top.', scores };
    }
    if (out[0] && out[1]) {
      return { title: 'DRAW', subtitle: 'Both stacks topped out.', scores };
    }

    const playerOneWon = out[1];
    if (this.mode === 'vsai') {
      return playerOneWon
        ? { title: 'YOU WIN', subtitle: 'The AI topped out.', scores }
        : { title: 'AI WINS', subtitle: 'Your stack reached the top.', scores };
    }
    return playerOneWon
      ? { title: 'PLAYER 1 WINS', subtitle: 'Player 2 topped out.', scores }
      : { title: 'PLAYER 2 WINS', subtitle: 'Player 1 topped out.', scores };
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
  }
}

// The stage frame writes inline sizing/position onto a board container. Strip it
// so the container returns to a plain box (for the menu, or the next match).
function resetContainer(el) {
  el.innerHTML = '';
  el.style.position = '';
  el.style.width = '';
  el.style.height = '';
}

// Build a match for the chosen mode. The gamepad manager is shared across matches.
// p1Char / p2Char come from the character select screen; each board's stage
// background is derived from its character (or randomised for stageless ones).
function buildMatch(mode, gamePadManager, leftContainer, rightContainer, p1Char, p2Char) {
  const games = [];
  const ais = [];
  const keyboards = [];
  const renderers = [];

  // --- Player 1 (left board) is a human in every mode ---
  const p1Keyboard = new Keyboard({});
  keyboards.push(p1Keyboard);
  const p1Input = new InputOr([
    new GamePadInput({ gamePadManager, gamePadIndex: 0 }),
    p1Keyboard,
  ]);
  const leftGame = new Game();
  leftGame.addCursor(new Cursor(p1Input, leftGame.board));
  games.push(leftGame);

  // --- Right board depends on mode ---
  let rightGame = null;

  if (mode === 'vsai') {
    rightGame = new Game();
    const aiInput = new AIInput();
    const aiCursor = new Cursor(aiInput, rightGame.board);
    rightGame.addCursor(aiCursor);
    ais.push(new AISimpleton({ board: rightGame.board, input: aiInput, cursor: aiCursor }));
  } else if (mode === '2p') {
    rightGame = new Game();
    const p2Keyboard = new Keyboard(PLAYER_TWO_KEYS);
    keyboards.push(p2Keyboard);
    const p2Input = new InputOr([
      new GamePadInput({ gamePadManager, gamePadIndex: 1 }),
      p2Keyboard,
    ]);
    rightGame.addCursor(new Cursor(p2Input, rightGame.board));
  }
  // mode === '1p' -> no right board.

  // Two-board modes trade garbage both ways.
  if (rightGame) {
    leftGame.linkTrashQueue(rightGame);
    rightGame.linkTrashQueue(leftGame);
    games.push(rightGame);
  }

  // --- Renderers / containers ---
  // Each board's stage comes from the chosen character (or random if stageless).
  const p1Stage = charStage(p1Char);
  const p2Stage = rightGame ? charStage(p2Char) : null;
  resetContainer(leftContainer);
  resetContainer(rightContainer);
  leftContainer.style.display = '';
  leftContainer.innerHTML = '';
  renderers.push({ renderer: new Renderer('game-container-left', leftGame.board, p1Stage), game: leftGame });

  rightContainer.innerHTML = '';
  if (rightGame) {
    rightContainer.style.display = '';
    renderers.push({ renderer: new Renderer('game-container-right', rightGame.board, p2Stage), game: rightGame });
  } else {
    rightContainer.style.display = 'none';
  }

  return new Match({ mode, games, ais, renderers, keyboards, pauseKeyboard: p1Keyboard });
}

// Top-level application state machine: MENU <-> PLAYING.
class App {
  constructor() {
    this.state = STATE_MENU;
    this.match = null;
    this.menu = null;
    this.charSelect = null;
    this.gameOver = null;
    this.mode = null;
    this.p1Char = null;
    this.p2Char = null;
    this.isPaused = false;
    this.pressedLastFrame = new Set();

    this.gamePadManager = new GamePadManager();
    this.gamePadManager.installEventHandlers();

    this.leftContainer = document.getElementById('game-container-left');
    this.rightContainer = document.getElementById('game-container-right');

    // Esc during a match quits back to the menu. (Char select handles its
    // own Esc via onCancel, so only STATE_PLAYING needs it here.)
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.state === STATE_PLAYING) {
        this.quitToMenu();
      }
    }, true);
  }

  start() {
    this.showMenu();
    this._loop();
  }

  showMenu() {
    this.state = STATE_MENU;
    this.menu = new Menu((mode) => this.showCharSelect(mode));
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
          this._launchMatch();
        }, () => {
          this.showCharSelect(mode);
        });
      } else {
        this.p2Char = mode === 'vsai' ? randomCharacter(p1Char.id) : null;
        this._launchMatch();
      }
    }, () => {
      this.quitToMenu();
    });
  }

  _launchMatch() {
    this._clearOverlays();
    if (this.match) { this.match.destroy(); this.match = null; }
    this.match = buildMatch(
      this.mode, this.gamePadManager,
      this.leftContainer, this.rightContainer,
      this.p1Char, this.p2Char,
    );
    this.isPaused = false;
    this.pressedLastFrame.clear();
    this.state = STATE_PLAYING;
  }

  // A board topped out: freeze the match, drop its inputs, and offer a rematch.
  // The match itself is kept around so its final frame stays on screen behind
  // the (translucent) results overlay.
  endMatch(result) {
    this.state = STATE_GAME_OVER;
    this.match.destroy();
    this.gameOver = new GameOverOverlay(result, (choice) => {
      if (choice === 'replay') {
        this._launchMatch();
      } else {
        this.quitToMenu();
      }
    });
  }

  quitToMenu() {
    this._clearOverlays();
    if (this.match) { this.match.destroy(); this.match = null; }
    resetContainer(this.leftContainer);
    resetContainer(this.rightContainer);
    this.rightContainer.style.display = '';
    this.showMenu();
  }

  _clearOverlays() {
    if (this.menu) { this.menu.destroy(); this.menu = null; }
    if (this.charSelect) { this.charSelect.destroy(); this.charSelect = null; }
    if (this.gameOver) { this.gameOver.destroy(); this.gameOver = null; }
  }

  _tickPlaying() {
    const keyboard = this.match.pauseKeyboard;
    const pausePressed = keyboard.isDown(Buttons.GAME_TOGGLE_PAUSE);
    const frameAdvancePressed = keyboard.isDown(Buttons.GAME_FRAME_ADVANCE);

    if (pausePressed && !this.pressedLastFrame.has(Buttons.GAME_TOGGLE_PAUSE)) {
      this.isPaused = !this.isPaused;
    }

    let runGameLogic = !this.isPaused;
    if (frameAdvancePressed && !this.pressedLastFrame.has(Buttons.GAME_FRAME_ADVANCE)) {
      this.isPaused = true;
      runGameLogic = true;
    }

    if (runGameLogic) {
      this.match.tickGameplay();
      this.match.draw();

      const result = this.match.result();
      if (result) {
        this.endMatch(result);
        return;
      }
    }

    this.pressedLastFrame.clear();
    if (pausePressed) this.pressedLastFrame.add(Buttons.GAME_TOGGLE_PAUSE);
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
  app.start();
}

export {InitiateGame}
