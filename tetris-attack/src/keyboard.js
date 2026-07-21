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

    // Keep bound references so the listeners can be removed on detach().
    this._onKeydown = (e) => { this.keydown(e) };
    this._onKeyup = (e) => { this.keyup(e) };
    document.addEventListener("keydown", this._onKeydown, true);
    document.addEventListener("keyup", this._onKeyup, true);
  }

  // Remove this keyboard's global listeners (used when tearing down a match).
  detach() {
    document.removeEventListener("keydown", this._onKeydown, true);
    document.removeEventListener("keyup", this._onKeyup, true);
    this.downKeys.clear();
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