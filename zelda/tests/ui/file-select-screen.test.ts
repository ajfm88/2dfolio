import { describe, it, expect } from 'vitest';
import { FileSelectScreen } from '../../src/ui/file-select-screen.js';
import { Action, type InputManager } from '../../src/core/input.js';

function fakeInput(pressed: Action[] = []): InputManager {
  const set = new Set(pressed);
  return {
    isJustPressed: (a: Action) => set.has(a),
    isHeld: () => false,
  } as unknown as InputManager;
}

// 3 slots + Register + Eliminate.
const TARGET_COUNT = 5;

describe('FileSelectScreen', () => {
  it('starts with the cursor on the first slot and no selection', () => {
    const s = new FileSelectScreen();
    expect(s.cursorIndex).toBe(0);
    expect(s.selection).toBeNull();
  });

  it('moves the cursor down and wraps around', () => {
    const s = new FileSelectScreen();
    for (let i = 1; i < TARGET_COUNT; i++) {
      s.update(fakeInput([Action.Down]));
      expect(s.cursorIndex).toBe(i);
    }
    s.update(fakeInput([Action.Down]));
    expect(s.cursorIndex).toBe(0); // wrapped
  });

  it('moves the cursor up and wraps around', () => {
    const s = new FileSelectScreen();
    s.update(fakeInput([Action.Up]));
    expect(s.cursorIndex).toBe(TARGET_COUNT - 1);
  });

  it('selects a save slot when Start is pressed on a slot row', () => {
    const s = new FileSelectScreen();
    s.update(fakeInput([Action.Down])); // cursor → slot 1
    s.update(fakeInput([Action.Start]));
    expect(s.selection).toEqual({ kind: 'slot', index: 1 });
  });

  it('selects the register option', () => {
    const s = new FileSelectScreen();
    for (let i = 0; i < 3; i++) s.update(fakeInput([Action.Down])); // cursor → 3 (register)
    s.update(fakeInput([Action.Start]));
    expect(s.selection).toEqual({ kind: 'register' });
  });

  it('selects the eliminate option', () => {
    const s = new FileSelectScreen();
    for (let i = 0; i < 4; i++) s.update(fakeInput([Action.Down])); // cursor → 4 (eliminate)
    s.update(fakeInput([Action.Start]));
    expect(s.selection).toEqual({ kind: 'eliminate' });
  });

  it('clearSelection() drops the pending selection', () => {
    const s = new FileSelectScreen();
    s.update(fakeInput([Action.Start]));
    expect(s.selection).not.toBeNull();
    s.clearSelection();
    expect(s.selection).toBeNull();
  });

  it('reset() recenters the cursor and clears selection', () => {
    const s = new FileSelectScreen();
    s.update(fakeInput([Action.Down]));
    s.update(fakeInput([Action.Start]));
    s.reset();
    expect(s.cursorIndex).toBe(0);
    expect(s.selection).toBeNull();
  });
});
