import { Board } from './board.js';
import { Cursor } from './cursor.js';
import { Keyboard } from './keyboard.js';

class Game {
  constructor() {
    this.keyboard = new Keyboard();
    this.board = new Board();
    this.cursor = new Cursor();
  }

  tick() {
    this._tickCursor();
  }

  _tickCursor() {
    // get keyboard state
    this.cursor.tick(this.keyboard, this.board);
  }
}

export { Game };