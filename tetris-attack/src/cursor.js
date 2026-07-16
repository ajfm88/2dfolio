const CURSOR_WIDTH = 2;

import { UP, DOWN, LEFT, RIGHT, SWAP, SCROLL } from './keyboard.js';

class Cursor {
  constructor(keyboard, board, color = "white") {
    this.position = [3, 10];
    this.state = 'idle';
    this.moveCounter = 0;
    this.requestingSwap = false;
    this.requestingScroll = false;
    this.keyboard = keyboard;
    this.board = board;
    this.color = color;
    this.keyMovements = new Map();
    this.keyMovements.set(LEFT, [-1, 0]);
    this.keyMovements.set(RIGHT, [1, 0]);
    this.keyMovements.set(UP, [0, -1]);
    this.keyMovements.set(DOWN, [0, 1]);
  }

  requestPushUp() {
    if (this.position[1] > 0) {
      this.position[1]--;
    }
  }

  tick() {
    if (this.state == 'idle') {
      for (let [key, move] of this.keyMovements) {
        if (this.keyboard.isDown(key)) {
          this.position[0] += move[0];
          this.position[1] += move[1];
          this.state = "moving";
          this.moveCounter = 2;
          this.keyRepeat = true;
          this.keyRepeatCounter = 8;
        }
      }
    }

    if (!this.keyboard.isDown(SWAP)) {
      this.requestingSwap = false;
    }
    if (this.keyboard.isDown(SWAP) && !this.requestingSwap) {
      const rightPosition = this.position.slice();
      rightPosition[0]++;
      this.board.requestSwap(this.position, rightPosition);
      this.requestingSwap = true;
    }
    if (this.keyboard.isDown(SCROLL) && !this.requestingScroll) {
      this.board.requestScroll();
      this.requestingScroll = true;
    }
    if (!this.keyboard.isDown(SCROLL)) {
      this.requestingScroll = false;
    }

    if (this.state == "moving") {
      if (this.moveCounter-- < 0) {
        if (this.keyRepeatCounter > 0) {
          this.state = 'idleRepeat';
        } else {
          this.state = 'idle';
        }
      }
    }

    if (this.state == 'idleRepeat' || this.state == 'moving') {
      var allUp = true;
      for (let k of this.keyMovements.keys()) {
        allUp &= !this.keyboard.isDown(k);
      }
      if (allUp) {
        this.keyRepeatCounter = 0;
      }
      if (this.keyRepeatCounter-- < 0) {
        this.state = 'idle';
      }
    }

    // Handle board bounds
    this.position[0] = Math.min(this.board.width - 1 - (CURSOR_WIDTH - 1), Math.max(0, this.position[0]));
    this.position[1] = Math.min(this.board.height - 1, Math.max(0, this.position[1]));
  }
}

export { Cursor };