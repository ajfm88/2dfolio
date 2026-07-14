import { Board } from './board.js';
import { Cursor } from './cursor.js';
import { Keyboard } from './keyboard.js';

const TRASH_FREQUENCY = 60 * 7;

class Game {
  constructor() {
    this.keyboard = new Keyboard();
    this.board = new Board();
    this.cursor = new Cursor();
  }

  tick() {
    this.cursor.tick(this.keyboard, this.board);
    this.board.tick();
    this._trashPusher();
  }

  _trashPusher() {
    this.trashCounter = (this.trashCounter || TRASH_FREQUENCY) - 1;
    if (this.trashCounter <= 0) {
      this.board.pushTrashUp();
      this.trashCounter = null;
      this.cursor.requestPushUp();
    }
  }
}

export { Game };