export const Action = Object.freeze({
  Up: 'up',
  Down: 'down',
  Left: 'left',
  Right: 'right',
  Attack: 'attack',
  Item: 'item',
  Start: 'start',
  Select: 'select'
});

const GAMEPAD_DEAD_ZONE = 0.5;

export const DEFAULT_KEY_BINDINGS = new Map([
  ['ArrowUp', Action.Up],
  ['ArrowDown', Action.Down],
  ['ArrowLeft', Action.Left],
  ['ArrowRight', Action.Right],
  ['KeyW', Action.Up],
  ['KeyS', Action.Down],
  ['KeyA', Action.Left],
  ['KeyD', Action.Right],
  ['KeyX', Action.Attack],
  ['Space', Action.Attack],
  ['KeyZ', Action.Item],
  ['Enter', Action.Start],
  ['ShiftLeft', Action.Select],
  ['ShiftRight', Action.Select],
]);

export const DEFAULT_GAMEPAD_BUTTON_BINDINGS = new Map([
  [0, Action.Attack],
  [1, Action.Item],
  [2, Action.Item],
  [9, Action.Start],
  [8, Action.Select],
  [12, Action.Up],
  [13, Action.Down],
  [14, Action.Left],
  [15, Action.Right],
]);

const GAMEPAD_AXIS_MAPPINGS = [
  { axisIndex: 0, direction: -1, action: Action.Left },
  { axisIndex: 0, direction: 1, action: Action.Right },
  { axisIndex: 1, direction: -1, action: Action.Up },
  { axisIndex: 1, direction: 1, action: Action.Down },
];

const ALL_ACTIONS = Object.values(Action);

function createIdleState() {
  return { held: false, justPressed: false, justReleased: false };
}

export class InputManager {
   keyBindings;
    gamepadButtonBindings;
    actionStates;
    keysDown = new Set();
    _externalHeld = new Set();
    prevActionHeld;
   target = null;

    onKeyDown;
    onKeyUp;

  constructor() {
    this.keyBindings = new Map(DEFAULT_KEY_BINDINGS);
    this.gamepadButtonBindings = new Map(DEFAULT_GAMEPAD_BUTTON_BINDINGS);

    this.actionStates = new Map();
    this.prevActionHeld = new Map();
    for (const action of ALL_ACTIONS) {
      this.actionStates.set(action, createIdleState());
      this.prevActionHeld.set(action, false);
    }

    this.onKeyDown = (e) => {
      const event = e;
      const code = event.code;
      if (this.keyBindings.has(code)) {
        event.preventDefault();
      }
      this.keysDown.add(code);
    };

    this.onKeyUp = (e) => {
      const event = e;
      this.keysDown.delete(event.code);
    };
  }

  attach(target) {
    this.target = target ?? window;
    this.target.addEventListener('keydown', this.onKeyDown);
    this.target.addEventListener('keyup', this.onKeyUp);
  }

  detach() {
    if (this.target) {
      this.target.removeEventListener('keydown', this.onKeyDown);
      this.target.removeEventListener('keyup', this.onKeyUp);
      this.target = null;
    }
  }

  update() {
    const currentHeld = new Map();
    for (const action of ALL_ACTIONS) {
      currentHeld.set(action, false);
    }

    for (const code of this.keysDown) {
      const action = this.keyBindings.get(code);
      if (action !== undefined) {
        currentHeld.set(action, true);
      }
    }

    this.pollGamepads(currentHeld);

    for (const action of this._externalHeld) {
      currentHeld.set(action, true);
    }

    for (const action of ALL_ACTIONS) {
      const prevHeld = this.prevActionHeld.get(action) ?? false;
      const currHeld = currentHeld.get(action) ?? false;
      const state = this.actionStates.get(action);
      if (state) {
        state.held = currHeld;
        state.justPressed = currHeld && !prevHeld;
        state.justReleased = !currHeld && prevHeld;
      }
      this.prevActionHeld.set(action, currHeld);
    }
  }

   pollGamepads(currentHeld) {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return;
    }

    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
      const pad = gamepads[i];
      if (!pad || pad.mapping !== 'standard') continue;

      for (const [buttonIndex, action] of this.gamepadButtonBindings) {
        if (pad.buttons[buttonIndex]?.pressed) {
          currentHeld.set(action, true);
        }
      }

      for (const mapping of GAMEPAD_AXIS_MAPPINGS) {
        const axisValue = pad.axes[mapping.axisIndex] ?? 0;
        if (axisValue * mapping.direction > GAMEPAD_DEAD_ZONE) {
          currentHeld.set(mapping.action, true);
        }
      }
    }
  }

  isHeld(action) {
    return this.actionStates.get(action)?.held ?? false;
  }

  isJustPressed(action) {
    return this.actionStates.get(action)?.justPressed ?? false;
  }

  /** True when this action was pressed by the on-screen overlay this frame. */
  isTouchJustPressed(action) {
    return this.isJustPressed(action) && this._externalHeld.has(action);
  }

  /** True while the on-screen overlay is holding this action. */
  isTouchHeld(action) {
    return this.isHeld(action) && this._externalHeld.has(action);
  }

  isJustReleased(action) {
    return this.actionStates.get(action)?.justReleased ?? false;
  }

  getActionState(action) {
    return this.actionStates.get(action) ?? createIdleState();
  }

  setKeyBinding(code, action) {
    this.keyBindings.set(code, action);
  }

  clearKeyBinding(code) {
    this.keyBindings.delete(code);
  }

  getKeyBindings() {
    return this.keyBindings;
  }

  getAllActionStates() {
    return this.actionStates;
  }

  setActionHeld(action, held) {
    if (held) this._externalHeld.add(action);
    else this._externalHeld.delete(action);
  }

  clearExternalActions() {
    this._externalHeld.clear();
  }
}
