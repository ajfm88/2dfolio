import { Buttons, Input } from "./input.js";

export class InputOr extends Input {
  constructor(inputs) {
    super();
    this.inputs = inputs;
  }

  isDown(button) {
    for(const input of this.inputs) {
      if(input.isDown(button)) {
        return true;
      }
    }
    return false;
  }
}