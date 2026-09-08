import { describe, it, expect } from 'vitest';
import { GameOverScreen, GameOverOption } from '../../src/death/game-over-screen.js';
import { Action, type InputManager } from '../../src/core/input.js';

function fakeInput(pressed: Action[] = [], touch = false): InputManager {
  const set = new Set(pressed);
  return {
    isJustPressed: (a: Action) => set.has(a),
    isHeld: () => false,
    isTouchJustPressed: (a: Action) => touch && set.has(a),
    isTouchHeld: (a: Action) => touch && set.has(a),
  } as unknown as InputManager;
}

describe('GameOverScreen', () => {
  it('starts with Continue selected', () => {
    const g = new GameOverScreen();
    expect(g.selectedOption).toBe(GameOverOption.Continue);
    expect(g.done).toBe(false);
  });

  it('Select cycles through Continue → Save → Retry → Continue', () => {
    const g = new GameOverScreen();
    g.update(fakeInput([Action.Select]));
    expect(g.selectedOption).toBe(GameOverOption.Save);
    g.update(fakeInput([Action.Select]));
    expect(g.selectedOption).toBe(GameOverOption.Retry);
    g.update(fakeInput([Action.Select]));
    expect(g.selectedOption).toBe(GameOverOption.Continue);
  });

  it('Start confirms the current selection', () => {
    const g = new GameOverScreen();
    g.update(fakeInput([Action.Select])); // → Save
    expect(g.isConfirmed).toBe(false);
    g.update(fakeInput([Action.Start]));
    expect(g.isConfirmed).toBe(true);
    expect(g.selectedOption).toBe(GameOverOption.Save);
  });

  it('reports done after confirm flash timer', () => {
    const g = new GameOverScreen();
    g.update(fakeInput([Action.Start])); // confirm Continue
    expect(g.isConfirmed).toBe(true);
    // Tick through the flash timer (64 frames)
    for (let i = 0; i < 63; i++) g.update(fakeInput());
    expect(g.done).toBe(false);
    g.update(fakeInput());
    expect(g.done).toBe(true);
  });

  it('touch D-pad Down cycles like Select, Up goes backwards', () => {
    const g = new GameOverScreen();
    g.update(fakeInput([Action.Down], true));
    expect(g.selectedOption).toBe(GameOverOption.Save);
    g.update(fakeInput([Action.Down], true));
    expect(g.selectedOption).toBe(GameOverOption.Retry);
    g.update(fakeInput([Action.Up], true));
    expect(g.selectedOption).toBe(GameOverOption.Save);
  });

  it('keyboard D-pad does not cycle (Select shortcut is touch-only)', () => {
    const g = new GameOverScreen();
    g.update(fakeInput([Action.Down]));
    g.update(fakeInput([Action.Up]));
    expect(g.selectedOption).toBe(GameOverOption.Continue);
  });

  it('exposes the selected option after done', () => {
    const g = new GameOverScreen();
    g.update(fakeInput([Action.Select])); // → Save
    g.update(fakeInput([Action.Start]));
    for (let i = 0; i < 64; i++) g.update(fakeInput());
    expect(g.done).toBe(true);
    expect(g.selectedOption).toBe(GameOverOption.Save);
  });
});
