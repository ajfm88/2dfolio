const UP = Symbol.for("UP");
const DOWN = Symbol.for("DOWN");
const RIGHT = Symbol.for("RIGHT");
const LEFT = Symbol.for("LEFT");
const SWAP = Symbol.for("SWAP");
const SCROLL = Symbol.for("SCROLL");

class Keyboard {
  constructor({ up = "ArrowUp", down = "ArrowDown", right = "ArrowRight", left = "ArrowLeft", swap = "Space", scroll = "ShiftRight" } = {}) {
    this.downKeys = new Set();

    this.keyMapping = new Map();
    this.keyMapping.set(up, UP);
    this.keyMapping.set(down, DOWN);
    this.keyMapping.set(left, LEFT);
    this.keyMapping.set(right, RIGHT);
    this.keyMapping.set(swap, SWAP);
    this.keyMapping.set(scroll, SCROLL);

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

  isDown(keyName) {
    return this.downKeys.has(keyName);
  }

  // TODO : Callbacks for special keys down/up
}

export { Keyboard, UP, DOWN, RIGHT, LEFT, SWAP, SCROLL };