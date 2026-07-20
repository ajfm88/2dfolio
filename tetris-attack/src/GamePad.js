import { Buttons, Input } from "./input.js";

class GamePadInput extends Input {
  constructor({ up = 12, down = 13, right = 15, left = 14, swap = 2, scroll = 5, pause = 9, gamePadManager, gamePadIndex } = {}) {
    super();

    this.keyMapping = new Map();
    this.keyMapping.set(up, Buttons.UP);
    this.keyMapping.set(down, Buttons.DOWN);
    this.keyMapping.set(left, Buttons.LEFT);
    this.keyMapping.set(right, Buttons.RIGHT);
    this.keyMapping.set(swap, Buttons.SWAP);
    this.keyMapping.set(scroll, Buttons.SCROLL);
    this.keyMapping.set(pause, Buttons.GAME_TOGGLE_PAUSE);

    this.gamePadManager = gamePadManager;
    this.gamePadIndex = gamePadIndex;
  }

  isDown(button) {
    let gamePadButtons = this.gamePadManager.gamePadByIndex.get(this.gamePadIndex);
    gamePadButtons = gamePadButtons ? gamePadButtons.buttons : [];
    
    for(let i=0; i<gamePadButtons.length; ++i) {
      if(!gamePadButtons[i].pressed) {
        continue;
      }

      const gameButton = this.keyMapping.get(i);
      if( gameButton && button == gameButton ) {
        return true;
      }
    }
    return false;
  }

  // TODO : Callbacks for special keys down/up
};

class GamePadManager {
  constructor() {
    this.gamePadByIndex = new Map();
  }

  handleGamePadConnected(e) {
    if(e.gamepad && !this.gamePadByIndex.has(e.gamepad.index)) {
      console.log(`Registering new game pad @ Index ${e.gamepad.index} : '${e.gamepad.id}'`);
      this.gamePadByIndex.set(e.gamepad.index, e.gamepad);
    }
  }

  handleGamePadDisconnected(e) {
    if(e.gamepad && this.gamePadByIndex.has(e.gamepad.index)) {
      console.log(`Gamepad 'e.gamepad.id' disconnected`);
      this.gamePadByIndex.delete(e.gamepad.index);
    }
  }

  updatePadStatuses() {
    var gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);
    gamepads = [...gamepads];
    gamepads.filter( o => o ).forEach( gamepad => this.gamePadByIndex.set(gamepad.index, gamepad) );

    for(const [index, gamepad] of this.gamePadByIndex.entries()) {
      const buttonString = gamepad.buttons.filter(b => b.pressed ).map(b => gamepad.buttons.indexOf(b) ).join(',');
      //console.log(`GamePad ${index} :: ${buttonString}`);
    }
    requestAnimationFrame( () => { this.updatePadStatuses(); } );
  }

  installEventHandlers() {
    window.addEventListener("gamepadconnected", e => this.handleGamePadConnected(e) );
    window.addEventListener("gamepaddisconnected", e => this.handleGamePadDisconnected(e) );
    requestAnimationFrame( () => { this.updatePadStatuses(); } );
  }
};

export {GamePadInput, GamePadManager};