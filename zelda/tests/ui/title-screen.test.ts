import { describe, it, expect } from 'vitest';
import { TitleScreen, TitlePhase, TITLE_IDLE_FRAMES } from '../../src/ui/title-screen.js';
import { Action, type InputManager } from '../../src/core/input.js';

function fakeInput(pressed: Action[] = []): InputManager {
  const set = new Set(pressed);
  return {
    isJustPressed: (a: Action) => set.has(a),
    isHeld: () => false,
  } as unknown as InputManager;
}

const IDLE_FRAMES = TITLE_IDLE_FRAMES;

describe('TitleScreen', () => {
  it('starts on the Title phase awaiting input', () => {
    const t = new TitleScreen();
    expect(t.phase).toBe(TitlePhase.Title);
    expect(t.shouldGoToFileSelect).toBe(false);
  });

  it('signals file-select when Start is pressed', () => {
    const t = new TitleScreen();
    t.update(fakeInput([Action.Start]));
    expect(t.shouldGoToFileSelect).toBe(true);
  });

  it('scrolls the backstory after an idle period with no input', () => {
    const t = new TitleScreen();
    const idle = fakeInput();
    for (let i = 0; i < IDLE_FRAMES; i++) t.update(idle);
    expect(t.phase).toBe(TitlePhase.StoryScroll);
  });

  it('resets the idle timer when any button is pressed', () => {
    const t = new TitleScreen();
    for (let i = 0; i < IDLE_FRAMES - 1; i++) t.update(fakeInput());
    t.update(fakeInput([Action.Up])); // resets the idle timer
    for (let i = 0; i < IDLE_FRAMES - 1; i++) t.update(fakeInput());
    expect(t.phase).toBe(TitlePhase.Title);
  });

  it('any button during the scroll returns to the title', () => {
    const t = new TitleScreen();
    for (let i = 0; i < IDLE_FRAMES; i++) t.update(fakeInput());
    expect(t.phase).toBe(TitlePhase.StoryScroll);
    t.update(fakeInput([Action.Attack]));
    expect(t.phase).toBe(TitlePhase.Title);
  });

  it('advances the scroll offset while scrolling', () => {
    const t = new TitleScreen();
    for (let i = 0; i < IDLE_FRAMES; i++) t.update(fakeInput());
    const before = t.scrollOffset;
    t.update(fakeInput());
    expect(t.scrollOffset).toBeGreaterThan(before);
  });

  it('reset() returns to a fresh Title state', () => {
    const t = new TitleScreen();
    t.update(fakeInput([Action.Start]));
    t.reset();
    expect(t.phase).toBe(TitlePhase.Title);
    expect(t.shouldGoToFileSelect).toBe(false);
    expect(t.scrollOffset).toBe(0);
  });

  it('waterfall waves start at NES TitleWaveYs and advance 2px per frame', () => {
    const t = new TitleScreen();
    expect([...t.waterfallWaveYs]).toEqual([0xb6, 0xc8, 0xd8]);
    t.update(fakeInput());
    expect([...t.waterfallWaveYs]).toEqual([0xb8, 0xca, 0xda]);
  });

  it('waterfall waves wrap from $E3 back to $B2', () => {
    const t = new TitleScreen();
    for (let i = 0; i < 23; i++) t.update(fakeInput());
    expect(t.waterfallWaveYs[0]).toBe(0xb2);
  });
});
