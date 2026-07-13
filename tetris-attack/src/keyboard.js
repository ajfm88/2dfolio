class Keyboard {
  constructor() {
    this.downKeys = new Set();

    document.addEventListener("keydown", (e) => { this.keydown(e) }, false);
    document.addEventListener("keyup", (e) => { this.keyup(e) }, false);
  }

  keydown(e) {
    this.downKeys.add(e.key);
  }

  keyup(e) {
    this.downKeys.delete(e.key);
  }

  isDown(keyName) {
    return this.downKeys.has(keyName);
  }

  // TODO : Callbacks for special keys down/up
}

export { Keyboard };