import { describe, it, expect } from 'vitest';
import { EndingScreen, EndingPhase } from '../../src/ui/ending-screen.js';

describe('EndingScreen', () => {
  it('starts in the Flash phase', () => {
    const e = new EndingScreen('LINK', 0);
    expect(e.phase).toBe(EndingPhase.Flash);
    expect(e.isDone).toBe(false);
  });

  it('transitions from Flash to PeaceText after 192 frames', () => {
    const e = new EndingScreen('LINK', 0);
    for (let i = 0; i < 191; i++) e.update(false);
    expect(e.phase).toBe(EndingPhase.Flash);
    e.update(false);
    expect(e.phase).toBe(EndingPhase.PeaceText);
  });

  it('transitions from PeaceText to Credits after 640 frames', () => {
    const e = new EndingScreen('LINK', 0);
    // Skip through Flash
    for (let i = 0; i < 192; i++) e.update(false);
    expect(e.phase).toBe(EndingPhase.PeaceText);
    // Tick 639 more frames (peace long timer)
    for (let i = 0; i < 639; i++) e.update(false);
    expect(e.phase).toBe(EndingPhase.PeaceText);
    e.update(false);
    expect(e.phase).toBe(EndingPhase.Credits);
  });

  it('credits phase scrolls and eventually transitions to AshTriforce', () => {
    const e = new EndingScreen('LINK', 0);
    // Skip to Credits
    for (let i = 0; i < 192 + 640; i++) e.update(false);
    expect(e.phase).toBe(EndingPhase.Credits);
    // Run until credits complete
    let maxFrames = 10000;
    while (e.phase === EndingPhase.Credits && maxFrames-- > 0) {
      e.update(false);
    }
    expect(e.phase).toBe(EndingPhase.AshTriforce);
  });

  it('AshTriforce ignores Start before minimum wait', () => {
    const e = new EndingScreen('LINK', 0);
    // Skip to AshTriforce
    for (let i = 0; i < 192 + 640; i++) e.update(false);
    while (e.phase === EndingPhase.Credits) e.update(false);
    expect(e.phase).toBe(EndingPhase.AshTriforce);
    // Press Start immediately — should NOT finish
    e.update(true);
    expect(e.phase).toBe(EndingPhase.AshTriforce);
  });

  it('AshTriforce transitions to Done on Start after minimum wait', () => {
    const e = new EndingScreen('LINK', 0);
    // Skip to AshTriforce
    for (let i = 0; i < 192 + 640; i++) e.update(false);
    while (e.phase === EndingPhase.Credits) e.update(false);
    expect(e.phase).toBe(EndingPhase.AshTriforce);
    // Wait past minimum (64 frames)
    for (let i = 0; i < 65; i++) e.update(false);
    e.update(true); // press Start
    expect(e.phase).toBe(EndingPhase.Done);
    expect(e.isDone).toBe(true);
  });

  it('uses player name and death count from constructor', () => {
    const e = new EndingScreen('ZELDA', 42);
    expect(e.phase).toBe(EndingPhase.Flash);
    // Name and death count are internal state used in rendering;
    // just confirm construction doesn't throw and the screen progresses.
    for (let i = 0; i < 192 + 640; i++) e.update(false);
    expect(e.phase).toBe(EndingPhase.Credits);
  });

  it('handles empty name gracefully', () => {
    const e = new EndingScreen('', 0);
    expect(e.phase).toBe(EndingPhase.Flash);
  });

  it('runs through the full sequence without crashing', () => {
    const e = new EndingScreen('LINK', 5);
    let maxFrames = 20000;
    while (!e.isDone && maxFrames-- > 0) {
      const isAsh = e.phase === EndingPhase.AshTriforce;
      e.update(isAsh && maxFrames < 19900);
    }
    expect(e.isDone).toBe(true);
  });
});
