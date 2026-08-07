export enum Action {
  Up = 'up',
  Down = 'down',
  Left = 'left',
  Right = 'right',
  Attack = 'attack',
  Item = 'item',
  Start = 'start',
  Select = 'select',
}

export interface ActionState {
  held: boolean;
  justPressed: boolean;
  justReleased: boolean;
}

interface GamepadAxisMapping {
  axisIndex: number;
  direction: 1 | -1;
  action: Action;
}

const GAMEPAD_DEAD_ZONE = 0.5;

export const DEFAULT_KEY_BINDINGS: ReadonlyMap<string, Action> = new Map([
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

export const DEFAULT_GAMEPAD_BUTTON_BINDINGS: ReadonlyMap<number, Action> = new Map([
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

const GAMEPAD_AXIS_MAPPINGS: readonly GamepadAxisMapping[] = [
  { axisIndex: 0, direction: -1, action: Action.Left },
  { axisIndex: 0, direction: 1, action: Action.Right },
  { axisIndex: 1, direction: -1, action: Action.Up },
  { axisIndex: 1, direction: 1, action: Action.Down },
];

export interface EventTarget {
  addEventListener(type: string, handler: (e: unknown) => void): void;
  removeEventListener(type: string, handler: (e: unknown) => void): void;
}

const ALL_ACTIONS = Object.values(Action);

function createIdleState(): ActionState {
  return { held: false, justPressed: false, justReleased: false };
}

export class InputManager {
  private keyBindings: Map<string, Action>;
  private readonly gamepadButtonBindings: Map<number, Action>;
  private readonly actionStates: Map<Action, ActionState>;
  private readonly keysDown = new Set<string>();
  private readonly prevActionHeld: Map<Action, boolean>;
  private target: EventTarget | null = null;

  private readonly onKeyDown: (e: unknown) => void;
  private readonly onKeyUp: (e: unknown) => void;

  constructor() {
    this.keyBindings = new Map(DEFAULT_KEY_BINDINGS);
    this.gamepadButtonBindings = new Map(DEFAULT_GAMEPAD_BUTTON_BINDINGS);

    this.actionStates = new Map<Action, ActionState>();
    this.prevActionHeld = new Map<Action, boolean>();
    for (const action of ALL_ACTIONS) {
      this.actionStates.set(action, createIdleState());
      this.prevActionHeld.set(action, false);
    }

    this.onKeyDown = (e: unknown) => {
      const event = e as KeyboardEvent;
      const code = event.code;
      if (this.keyBindings.has(code)) {
        event.preventDefault();
      }
      this.keysDown.add(code);
    };

    this.onKeyUp = (e: unknown) => {
      const event = e as KeyboardEvent;
      this.keysDown.delete(event.code);
    };
  }

  attach(target?: EventTarget): void {
    this.target = target ?? (window as unknown as EventTarget);
    this.target.addEventListener('keydown', this.onKeyDown);
    this.target.addEventListener('keyup', this.onKeyUp);
  }

  detach(): void {
    if (this.target) {
      this.target.removeEventListener('keydown', this.onKeyDown);
      this.target.removeEventListener('keyup', this.onKeyUp);
      this.target = null;
    }
  }

  update(): void {
    const currentHeld = new Map<Action, boolean>();
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

  private pollGamepads(currentHeld: Map<Action, boolean>): void {
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

  isHeld(action: Action): boolean {
    return this.actionStates.get(action)?.held ?? false;
  }

  isJustPressed(action: Action): boolean {
    return this.actionStates.get(action)?.justPressed ?? false;
  }

  isJustReleased(action: Action): boolean {
    return this.actionStates.get(action)?.justReleased ?? false;
  }

  getActionState(action: Action): Readonly<ActionState> {
    return this.actionStates.get(action) ?? createIdleState();
  }

  setKeyBinding(code: string, action: Action): void {
    this.keyBindings.set(code, action);
  }

  clearKeyBinding(code: string): void {
    this.keyBindings.delete(code);
  }

  getKeyBindings(): ReadonlyMap<string, Action> {
    return this.keyBindings;
  }

  getAllActionStates(): ReadonlyMap<Action, Readonly<ActionState>> {
    return this.actionStates;
  }
}
