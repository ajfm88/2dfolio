import { Buttons } from "./input.js";

const CURSOR_WIDTH = 2;

const CURSOR_STATE_IDLE = Symbol('idle');
const CURSOR_STATE_MOVING = Symbol('moving');
const CURSOR_STATE_IDLE_REPEAT = Symbol('idle_repeat');

class Cursor {
  constructor(input, board, color = "white") {
    this.position = [3, 10];
    this.state = CURSOR_STATE_IDLE;
    this.moveCounter = 0;
    this.requestingSwap = false;
    this.requestingScroll = false;
    this.input = input;
    this.board = board;
    this.color = color;

    this.inputMovements = new Map();
    this.inputMovements.set(Buttons.LEFT, [-1, 0]);
    this.inputMovements.set(Buttons.RIGHT, [1, 0]);
    this.inputMovements.set(Buttons.UP, [0, -1]);
    this.inputMovements.set(Buttons.DOWN, [0, 1]);
  }

  requestPushUp() {
    if (this.position[1] > 0) {
      this.position[1]--;
    }
  }

  tick() {
    if (this.state == CURSOR_STATE_IDLE) {
      for (let [button, move] of this.inputMovements) {
        if (this.input.isDown(button)) {
          this.position[0] += move[0];
          this.position[1] += move[1];
          this.state = CURSOR_STATE_MOVING;
          this.moveCounter = 2;
          this.keyRepeat = true;
          this.keyRepeatCounter = 8;
        }
      }
    }

    if (!this.input.isDown(Buttons.SWAP)) {
      this.requestingSwap = false;
    }
    if (this.input.isDown(Buttons.SWAP) && !this.requestingSwap) {
      const rightPosition = this.position.slice();
      rightPosition[0]++;
      this.board.requestSwap(this.position, rightPosition);
      this.requestingSwap = true;
    }
    if (this.input.isDown(Buttons.SCROLL) && !this.requestingScroll) {
      this.board.requestScroll();
      this.requestingScroll = true;
    }
    if (!this.input.isDown(Buttons.SCROLL)) {
      this.requestingScroll = false;
    }

    if (this.state == CURSOR_STATE_MOVING) {
      if (this.moveCounter-- < 0) {
        if (this.keyRepeatCounter > 0) {
          this.state = CURSOR_STATE_IDLE_REPEAT;
        } else {
          this.state = CURSOR_STATE_IDLE;
        }
      }
    }

    if (this.state == CURSOR_STATE_IDLE_REPEAT || this.state == CURSOR_STATE_MOVING) {
      let allUp = true;
      for (let k of this.inputMovements.keys()) {
        allUp &= !this.input.isDown(k);
      }
      if (allUp) {
        this.keyRepeatCounter = 0;
      }
      if (this.keyRepeatCounter-- < 0) {
        this.state = CURSOR_STATE_IDLE;
      }
    }

    // Handle board bounds
    this.position[0] = Math.min(this.board.width - 1 - (CURSOR_WIDTH - 1), Math.max(0, this.position[0]));
    this.position[1] = Math.min(this.board.height - 1, Math.max(0, this.position[1]));
  }
}

export { Cursor };