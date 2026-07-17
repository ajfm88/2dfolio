import { Board } from './board.js';
import { Cursor } from './cursor.js';
import { Keyboard } from './keyboard.js';

const SCROLL_PER_FRAME = 1 / (60 * 7);

class Game {
  constructor() {
    this.board = new Board();
    this.cursors = []; 
  }

  addCursor(cursor) {
    this.board.addCursor(cursor);
    this.cursors.push(cursor);
  }

  tick() {
    this.board.tick();
  }
}

export { Game };