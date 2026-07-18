import { Buttons, Input } from "./input.js";

export class Keyboard extends Input {
  constructor({ up = "ArrowUp", down = "ArrowDown", right = "ArrowRight", left = "ArrowLeft", swap = "Space", scroll = "ShiftRight", pause = "KeyP", frame_advance = "KeyF" } = {}) {
    super();

    this.downKeys = new Set();

    this.keyMapping = new Map();
    this.keyMapping.set(up, Buttons.UP);
    this.keyMapping.set(down, Buttons.DOWN);
    this.keyMapping.set(left, Buttons.LEFT);
    this.keyMapping.set(right, Buttons.RIGHT);
    this.keyMapping.set(swap, Buttons.SWAP);
    this.keyMapping.set(scroll, Buttons.SCROLL);
    this.keyMapping.set(pause, Buttons.GAME_TOGGLE_PAUSE);
    this.keyMapping.set(frame_advance, Buttons.GAME_FRAME_ADVANCE);

    document.addEventListener("keydown", (e) => { this.keydown(e) }, true);
    document.addEventListener("keyup", (e) => { this.keyup(e) }, true);
  }

  keydown(e) {
    const action = this.keyMapping.get(e.code);
    if (action) {
      this.downKeys.add(action);
    }
  }

  keyup(e) {
    const action = this.keyMapping.get(e.code);
    if (action) {
      this.downKeys.delete(action);
    }
  }

  isDown(button) {
    return this.downKeys.has(button);
  }

  // TODO : Callbacks for special keys down/up
}