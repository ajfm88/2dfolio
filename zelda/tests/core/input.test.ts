import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  InputManager,
  Action,
  DEFAULT_KEY_BINDINGS,
  type EventTarget as InputEventTarget,
} from '../../src/core/input.js';

interface MockEventTarget extends InputEventTarget {
  dispatchKeyDown(code: string): void;
  dispatchKeyUp(code: string): void;
}

function createMockEventTarget(): MockEventTarget {
  const listeners = new Map<string, Set<(e: unknown) => void>>();
  return {
    addEventListener(type: string, handler: (e: unknown) => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(handler);
    },
    removeEventListener(type: string, handler: (e: unknown) => void) {
      listeners.get(type)?.delete(handler);
    },
    dispatchKeyDown(code: string) {
      const event = { code, preventDefault: vi.fn() };
      for (const fn of listeners.get('keydown') ?? []) fn(event);
    },
    dispatchKeyUp(code: string) {
      const event = { code, preventDefault: vi.fn() };
      for (const fn of listeners.get('keyup') ?? []) fn(event);
    },
  };
}

function makeButton(pressed: boolean): GamepadButton {
  return { pressed, touched: pressed, value: pressed ? 1 : 0 };
}

function stubGamepad(overrides: {
  buttons?: Partial<Record<number, boolean>>;
  axes?: number[];
}): void {
  const buttons = Array.from({ length: 16 }, () => makeButton(false));
  if (overrides.buttons) {
    for (const [index, pressed] of Object.entries(overrides.buttons)) {
      buttons[Number(index)] = makeButton(pressed ?? false);
    }
  }

  const pad = {
    mapping: 'standard',
    buttons,
    axes: overrides.axes ?? [0, 0, 0, 0],
    connected: true,
    id: 'Mock Gamepad',
    index: 0,
    timestamp: 0,
    hapticActuators: [],
    vibrationActuator: null,
  } as unknown as Gamepad;

  vi.stubGlobal('navigator', {
    getGamepads: () => [pad, null, null, null],
  });
}

describe('InputManager', () => {
  let input: InputManager;
  let target: MockEventTarget;

  beforeEach(() => {
    input = new InputManager();
    target = createMockEventTarget();
    input.attach(target);
  });

  afterEach(() => {
    input.detach();
    vi.unstubAllGlobals();
  });

  describe('construction and defaults', () => {
    it('initializes all actions to idle state', () => {
      input.update();
      for (const action of Object.values(Action)) {
        const state = input.getActionState(action);
        expect(state.held).toBe(false);
        expect(state.justPressed).toBe(false);
        expect(state.justReleased).toBe(false);
      }
    });

    it('has default key bindings for all documented keys', () => {
      const bindings = input.getKeyBindings();
      expect(bindings.get('ArrowUp')).toBe(Action.Up);
      expect(bindings.get('ArrowDown')).toBe(Action.Down);
      expect(bindings.get('ArrowLeft')).toBe(Action.Left);
      expect(bindings.get('ArrowRight')).toBe(Action.Right);
      expect(bindings.get('KeyW')).toBe(Action.Up);
      expect(bindings.get('KeyS')).toBe(Action.Down);
      expect(bindings.get('KeyA')).toBe(Action.Left);
      expect(bindings.get('KeyD')).toBe(Action.Right);
      expect(bindings.get('KeyX')).toBe(Action.Attack);
      expect(bindings.get('Space')).toBe(Action.Attack);
      expect(bindings.get('KeyZ')).toBe(Action.Item);
      expect(bindings.get('Enter')).toBe(Action.Start);
      expect(bindings.get('ShiftLeft')).toBe(Action.Select);
      expect(bindings.get('ShiftRight')).toBe(Action.Select);
    });

    it('exports default bindings matching instance bindings', () => {
      expect(DEFAULT_KEY_BINDINGS.size).toBe(input.getKeyBindings().size);
    });
  });

  describe('keyboard held state', () => {
    it('keydown sets action to held after update', () => {
      target.dispatchKeyDown('ArrowRight');
      input.update();
      expect(input.isHeld(Action.Right)).toBe(true);
    });

    it('keyup clears held after update', () => {
      target.dispatchKeyDown('ArrowRight');
      input.update();
      target.dispatchKeyUp('ArrowRight');
      input.update();
      expect(input.isHeld(Action.Right)).toBe(false);
    });

    it('unmapped key does not affect any action', () => {
      target.dispatchKeyDown('KeyQ');
      input.update();
      for (const action of Object.values(Action)) {
        expect(input.isHeld(action)).toBe(false);
      }
    });
  });

  describe('edge detection', () => {
    it('justPressed is true only on first frame', () => {
      target.dispatchKeyDown('ArrowRight');
      input.update();
      expect(input.isJustPressed(Action.Right)).toBe(true);

      input.update();
      expect(input.isJustPressed(Action.Right)).toBe(false);
      expect(input.isHeld(Action.Right)).toBe(true);
    });

    it('justReleased is true only on release frame', () => {
      target.dispatchKeyDown('ArrowRight');
      input.update();
      target.dispatchKeyUp('ArrowRight');
      input.update();
      expect(input.isJustReleased(Action.Right)).toBe(true);

      input.update();
      expect(input.isJustReleased(Action.Right)).toBe(false);
    });

    it('justPressed and held are both true on press frame', () => {
      target.dispatchKeyDown('KeyX');
      input.update();
      expect(input.isHeld(Action.Attack)).toBe(true);
      expect(input.isJustPressed(Action.Attack)).toBe(true);
    });

    it('rapid press-release within one frame produces no held state', () => {
      target.dispatchKeyDown('ArrowRight');
      target.dispatchKeyUp('ArrowRight');
      input.update();
      expect(input.isHeld(Action.Right)).toBe(false);
      expect(input.isJustPressed(Action.Right)).toBe(false);
    });
  });

  describe('multiple keys to same action', () => {
    it('ArrowUp and KeyW both activate Up', () => {
      target.dispatchKeyDown('ArrowUp');
      input.update();
      expect(input.isHeld(Action.Up)).toBe(true);

      target.dispatchKeyUp('ArrowUp');
      target.dispatchKeyDown('KeyW');
      input.update();
      expect(input.isHeld(Action.Up)).toBe(true);
    });

    it('action stays held if one key released but other still down', () => {
      target.dispatchKeyDown('ArrowUp');
      target.dispatchKeyDown('KeyW');
      input.update();
      expect(input.isHeld(Action.Up)).toBe(true);

      target.dispatchKeyUp('ArrowUp');
      input.update();
      expect(input.isHeld(Action.Up)).toBe(true);
      expect(input.isJustReleased(Action.Up)).toBe(false);
    });
  });

  describe('remapping', () => {
    it('setKeyBinding adds new binding', () => {
      input.setKeyBinding('KeyP', Action.Attack);
      target.dispatchKeyDown('KeyP');
      input.update();
      expect(input.isHeld(Action.Attack)).toBe(true);
    });

    it('setKeyBinding overwrites existing binding for same key', () => {
      input.setKeyBinding('ArrowUp', Action.Attack);
      target.dispatchKeyDown('ArrowUp');
      input.update();
      expect(input.isHeld(Action.Attack)).toBe(true);
      expect(input.isHeld(Action.Up)).toBe(false);
    });

    it('clearKeyBinding removes binding', () => {
      input.clearKeyBinding('ArrowUp');
      target.dispatchKeyDown('ArrowUp');
      input.update();
      expect(input.isHeld(Action.Up)).toBe(false);
    });
  });

  describe('gamepad polling', () => {
    it('gamepad button press sets action held', () => {
      stubGamepad({ buttons: { 0: true } });
      input.update();
      expect(input.isHeld(Action.Attack)).toBe(true);
    });

    it('gamepad left stick sets direction actions', () => {
      stubGamepad({ axes: [-1.0, 0, 0, 0] });
      input.update();
      expect(input.isHeld(Action.Left)).toBe(true);
    });

    it('gamepad dead zone filters small values', () => {
      stubGamepad({ axes: [0.3, 0, 0, 0] });
      input.update();
      expect(input.isHeld(Action.Right)).toBe(false);
    });

    it('keyboard and gamepad merge correctly', () => {
      stubGamepad({ buttons: { 0: true } });
      target.dispatchKeyDown('ArrowRight');
      input.update();
      expect(input.isHeld(Action.Right)).toBe(true);
      expect(input.isHeld(Action.Attack)).toBe(true);
    });

    it('gamepad d-pad buttons map to directions', () => {
      stubGamepad({ buttons: { 12: true, 14: true } });
      input.update();
      expect(input.isHeld(Action.Up)).toBe(true);
      expect(input.isHeld(Action.Left)).toBe(true);
    });
  });

  describe('attach and detach', () => {
    it('events after detach do not affect state', () => {
      input.detach();
      target.dispatchKeyDown('ArrowRight');
      input.update();
      expect(input.isHeld(Action.Right)).toBe(false);
    });
  });

  describe('getAllActionStates', () => {
    it('returns map with entry for every action', () => {
      const states = input.getAllActionStates();
      expect(states.size).toBe(Object.values(Action).length);
    });

    it('returned states reflect current frame', () => {
      target.dispatchKeyDown('KeyX');
      input.update();
      const states = input.getAllActionStates();
      const attackState = states.get(Action.Attack);
      expect(attackState?.held).toBe(true);
      expect(attackState?.justPressed).toBe(true);
    });
  });
});
