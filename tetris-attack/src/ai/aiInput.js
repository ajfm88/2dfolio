import { Input } from "../input.js";

export class AIInput extends Input {
  constructor() {
    super();
    this.buttons = new Set();
  }

  clear() {
    this.buttons.clear();
  }

  hold(button) {
    this.buttons.add( button );
  }

  letGo(button) {
    this.buttons.delete( button );
  }

  isDown(button) {
    return this.buttons.has( button );
  }
};