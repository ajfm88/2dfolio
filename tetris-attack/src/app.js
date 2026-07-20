import {Game}     from './game.js';
import {Renderer} from './renderer.js';
import {Keyboard} from './keyboard.js';
import {Cursor} from './cursor.js';
import {AISimpleton} from './ai/aiSimpleton.js';
import {AIInput} from './ai/aiInput.js';
import {Buttons} from './input.js';
import {InputOr} from './InputOr.js';
import {GamePadInput, GamePadManager} from './GamePad.js';

function InitiateGame() {
  const game = new Game();

  const gamePadManager = new GamePadManager();
  gamePadManager.installEventHandlers();

  const keyboard = new Keyboard({});
  const gamePadInput = new GamePadInput({gamePadManager, gamePadIndex:0});
  const playerOneInput = new InputOr([gamePadInput, keyboard]);

  const cursor = new Cursor(playerOneInput, game.board);
  game.addCursor(cursor);

  const gameTwo = new Game();

  let ais = [];
  for(let i = 0; i < 1; i++) {
    const aiTwoInput = new AIInput();
    const cursorTwo = new Cursor(aiTwoInput, gameTwo.board);
    cursorTwo.position[0]+=i*3;
    cursorTwo.position[1]+=(i*3) % 5;
    const aiTwo = new AISimpleton({board: gameTwo.board, input: aiTwoInput, cursor: cursorTwo});
    ais.push(aiTwo);
    gameTwo.addCursor(cursorTwo);
  }

  game.linkTrashQueue(gameTwo);
  gameTwo.linkTrashQueue(game);

  const renderer = new Renderer('game-container-left', game.board);
  const rendererTwo = new Renderer('game-container-right', gameTwo.board);

  let is_game_paused = false;
  let keys_pressed_last_frame = new Set();


  function animate() {
    let start_frame_time = Date.now();

    const pause_pressed = keyboard.isDown( Buttons.GAME_TOGGLE_PAUSE );
    const frame_advance_pressed = keyboard.isDown( Buttons.GAME_FRAME_ADVANCE );

    if( pause_pressed && !keys_pressed_last_frame.has(Buttons.GAME_TOGGLE_PAUSE) ) {
      is_game_paused = !is_game_paused;
    }

    let run_game_logic = !is_game_paused;
    if( frame_advance_pressed && !keys_pressed_last_frame.has(Buttons.GAME_FRAME_ADVANCE) ) {
      is_game_paused = true;
      run_game_logic = true;
    }

    if(run_game_logic){
      game.tick();
      ais.forEach(x => x.tick());
      gameTwo.tick();

      renderer.draw(game);
      rendererTwo.draw(gameTwo);
    }

    keys_pressed_last_frame.clear();
    if(pause_pressed) keys_pressed_last_frame.add( Buttons.GAME_TOGGLE_PAUSE );
    if(frame_advance_pressed) keys_pressed_last_frame.add( Buttons.GAME_FRAME_ADVANCE );

    let time_to_next_frame = (1000 / 60) - (Date.now() - start_frame_time);
    if (time_to_next_frame < 0) 
      time_to_next_frame = 0;

    setTimeout( () => requestAnimationFrame(animate), time_to_next_frame);
  }

  animate();
}

export {InitiateGame}