import { describe, it, expect } from 'vitest';
import { EliminationScreen } from '../../src/ui/elimination.js';
import { Action, type InputManager } from '../../src/core/input.js';

function fakeInput(just: Action[] = []): InputManager {
  const set = new Set(just);
  return {
    isHeld: () => false,
    isJustPressed: (a: Action) => set.has(a),
  } as unknown as InputManager;
}

// 3 slots + END.
const TARGET_COUNT = 4;

describe('EliminationScreen', () => {
  it('starts with the cursor on the first slot, nothing pending', () => {
    const s = new EliminationScreen();
    s.reset();
    expect(s.cursorIndex).toBe(0);
    expect(s.pendingEliminate).toBeNull();
    expect(s.done).toBe(false);
  });

  it('Down and Select both advance the slot cursor and wrap', () => {
    const s = new EliminationScreen();
    s.reset();
    s.update(fakeInput([Action.Down]));
    expect(s.cursorIndex).toBe(1);
    s.update(fakeInput([Action.Select]));
    expect(s.cursorIndex).toBe(2);
    for (let i = 2; i < TARGET_COUNT; i++) s.update(fakeInput([Action.Down]));
    expect(s.cursorIndex).toBe(0); // wrapped past END
  });

  it('Up wraps to END', () => {
    const s = new EliminationScreen();
    s.reset();
    s.update(fakeInput([Action.Up]));
    expect(s.cursorIndex).toBe(TARGET_COUNT - 1); // END
  });

  it('Start on a slot flags it for elimination', () => {
    const s = new EliminationScreen();
    s.reset();
    s.update(fakeInput([Action.Down])); // cursor → slot 1
    s.update(fakeInput([Action.Start]));
    expect(s.pendingEliminate).toBe(1);
    s.clearPending();
    expect(s.pendingEliminate).toBeNull();
  });

  it('Start on END sets done', () => {
    const s = new EliminationScreen();
    s.reset();
    for (let i = 0; i < 3; i++) s.update(fakeInput([Action.Down])); // → END
    expect(s.cursorIndex).toBe(3);
    s.update(fakeInput([Action.Start]));
    expect(s.done).toBe(true);
    expect(s.pendingEliminate).toBeNull();
  });
});
