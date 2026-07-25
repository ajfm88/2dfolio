import { Board } from './board.js';
import { Cursor } from './cursor.js';
import { Keyboard } from './keyboard.js';
import { TrashQueue } from './trashQueue.js'

class Game {
  constructor({ speedLevel = 1 } = {}) {
    this.board = new Board();
    this.cursors = [];
    if (speedLevel > 1) this.board.setSpeedLevel(speedLevel);
  }

  addCursor(cursor) {
    this.board.addCursor(cursor);
    this.cursors.push(cursor);
  }

  linkTrashQueue(otherGame) {
    this.board.setTrashQueue(new TrashQueue(otherGame));
  }

  isToppedOut() {
    return this.board.toppedOut;
  }

  tick() {
    this.board.tick();
  }
}

export { Game };