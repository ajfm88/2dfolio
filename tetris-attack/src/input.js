
const Buttons = {
  'UP': Symbol.for('UP'),
  'DOWN': Symbol.for('DOWN'),
  'RIGHT': Symbol.for('RIGHT'),
  'LEFT': Symbol.for('LEFT'),
  'SWAP': Symbol.for('SWAP'),
  'SCROLL': Symbol.for('SCROLL')
};

class Input {
  isDown(button) {
    throw 'Input class must implement isPressed';
  }
};

export { Buttons, Input };