import { Board } from './board.js';
import { Cursor } from './cursor.js';
import { Keyboard } from './keyboard.js';
import { TrashQueue } from './trashQueue.js'

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

  linkTrashQueue(otherGame) {
    this.board.setTrashQueue(new TrashQueue(otherGame));
  }

  tick() {
    this.board.tick();
  }
}

export { Game };