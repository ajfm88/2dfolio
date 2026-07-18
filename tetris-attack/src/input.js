
const Buttons = {
  'UP': Symbol.for('UP'),
  'DOWN': Symbol.for('DOWN'),
  'RIGHT': Symbol.for('RIGHT'),
  'LEFT': Symbol.for('LEFT'),
  'SWAP': Symbol.for('SWAP'),
  'SCROLL': Symbol.for('SCROLL'),

  'GAME_TOGGLE_PAUSE': Symbol.for('GAME_TOGGLE_PAUSE'),
  'GAME_FRAME_ADVANCE': Symbol.for('GAME_FRAME_ADVANCE')
};

class Input {
  isDown(button) {
    throw 'Input class must implement isPressed';
  }
};

export { Buttons, Input };