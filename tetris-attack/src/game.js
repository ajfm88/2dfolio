import { Board } from './board.js';
import { Cursor } from './cursor.js';
import { Keyboard } from './keyboard.js';

const SCROLL_PER_FRAME = 1 / (60 * 7);

class Game {
  constructor() {
    this.board = new Board();

    this.keyboard = new Keyboard({});
    const cursor = new Cursor(this.keyboard, this.board);

    this.keyboardTwo = new Keyboard({ up: "Numpad8", down: "Numpad5", right: "Numpad6", left: "Numpad4", swap: "NumpadEnter" });
    const cursorTwo = new Cursor(this.keyboardTwo, this.board, "#B8B");

    this.board.addCursor(cursor);

    this.cursors = [cursor] //, cursorTwo];
    this.scroll = 0;
    this.freezeCounter = 0;
  }

  tick() {
    this.board.tick();
  }
}

export { Game };