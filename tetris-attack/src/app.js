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

const STATE_MENU = 'MENU';
const STATE_PLAYING = 'PLAYING';

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
  constructor({ games, ais, renderers, keyboards, pauseKeyboard }) {
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
  }

  draw() {
    this.renderers.forEach(({ renderer, game }) => renderer.draw(game));
  }

  destroy() {
    this.keyboards.forEach((k) => k.detach());
  }
}

// Build a match for the chosen mode. The gamepad manager is shared across matches.
function buildMatch(mode, gamePadManager, leftContainer, rightContainer) {
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
  leftContainer.style.display = '';
  leftContainer.innerHTML = '';
  renderers.push({ renderer: new Renderer('game-container-left', leftGame.board), game: leftGame });

  rightContainer.innerHTML = '';
  if (rightGame) {
    rightContainer.style.display = '';
    renderers.push({ renderer: new Renderer('game-container-right', rightGame.board), game: rightGame });
  } else {
    rightContainer.style.display = 'none';
  }

  return new Match({ games, ais, renderers, keyboards, pauseKeyboard: p1Keyboard });
}

// Top-level application state machine: MENU <-> PLAYING.
class App {
  constructor() {
    this.state = STATE_MENU;
    this.match = null;
    this.menu = null;
    this.isPaused = false;
    this.pressedLastFrame = new Set();

    this.gamePadManager = new GamePadManager();
    this.gamePadManager.installEventHandlers();

    this.leftContainer = document.getElementById('game-container-left');
    this.rightContainer = document.getElementById('game-container-right');

    // Esc during a match quits back to the menu.
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
    this.menu = new Menu((mode) => this.startMatch(mode));
  }

  startMatch(mode) {
    if (this.menu) { this.menu.destroy(); this.menu = null; }
    this.match = buildMatch(mode, this.gamePadManager, this.leftContainer, this.rightContainer);
    this.isPaused = false;
    this.pressedLastFrame.clear();
    this.state = STATE_PLAYING;
  }

  quitToMenu() {
    if (this.match) { this.match.destroy(); this.match = null; }
    this.leftContainer.innerHTML = '';
    this.rightContainer.innerHTML = '';
    this.rightContainer.style.display = '';
    this.showMenu();
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
    }

    this.pressedLastFrame.clear();
    if (pausePressed) this.pressedLastFrame.add(Buttons.GAME_TOGGLE_PAUSE);
    if (frameAdvancePressed) this.pressedLastFrame.add(Buttons.GAME_FRAME_ADVANCE);
  }

  _loop() {
    const frame = () => {
      const startFrameTime = Date.now();

      if (this.state === STATE_PLAYING && this.match) {
        this._tickPlaying();
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
