// Touch as an Input source. Knows nothing about the DOM — VirtualPad drives it.
// See docs/INPUT.md and docs/context/specs/07-touch-input.md.

import { Input } from './input.js';

export class TouchInput extends Input {
  constructor() {
    super();
    this.down = new Set();
  }

  isDown(button) {
    return this.down.has(button);
  }

  press(button) {
    this.down.add(button);
  }

  release(button) {
    this.down.delete(button);
  }

  releaseAll() {
    this.down.clear();
  }
}
