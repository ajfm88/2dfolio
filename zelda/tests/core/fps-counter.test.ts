import { describe, it, expect } from 'vitest';
import { FpsCounter } from '../../src/core/fps-counter.js';

describe('FpsCounter', () => {
  it('starts with fps of 0', () => {
    const counter = new FpsCounter();
    expect(counter.fps).toBe(0);
  });

  it('reports 0 fps before the first sample interval completes', () => {
    const counter = new FpsCounter(1000);
    counter.tick(0);
    counter.tick(16);
    counter.tick(32);
    expect(counter.fps).toBe(0);
  });

  it('calculates fps correctly after one sample interval', () => {
    const counter = new FpsCounter(1000);
    const frameTime = 1000 / 60;
    counter.tick(0);
    for (let i = 1; i <= 60; i++) {
      counter.tick(i * frameTime);
    }
    expect(counter.fps).toBe(60);
  });

  it('updates fps each sample interval', () => {
    const counter = new FpsCounter(1000);
    const ft60 = 1000 / 60;

    counter.tick(0);
    for (let i = 1; i <= 60; i++) {
      counter.tick(i * ft60);
    }
    expect(counter.fps).toBe(60);

    const base = 60 * ft60;
    const ft30 = 1000 / 30;
    for (let i = 1; i <= 30; i++) {
      counter.tick(base + i * ft30);
    }
    expect(counter.fps).toBe(30);
  });

  it('handles custom sample interval', () => {
    const counter = new FpsCounter(500);
    const frameTime = 500 / 30;
    counter.tick(0);
    for (let i = 1; i <= 30; i++) {
      counter.tick(i * frameTime);
    }
    expect(counter.fps).toBe(60);
  });

  it('rounds fps to nearest integer', () => {
    const counter = new FpsCounter(1000);
    counter.tick(0);
    for (let i = 1; i <= 59; i++) {
      counter.tick(i * 17);
    }
    expect(Number.isInteger(counter.fps)).toBe(true);
  });

  it('reset() clears fps to 0', () => {
    const counter = new FpsCounter(1000);
    counter.tick(0);
    for (let i = 1; i <= 60; i++) {
      counter.tick(i * (1000 / 60));
    }
    expect(counter.fps).toBe(60);

    counter.reset();
    expect(counter.fps).toBe(0);
  });

  it('calculates fresh rate after reset', () => {
    const counter = new FpsCounter(1000);
    counter.tick(0);
    for (let i = 1; i <= 60; i++) {
      counter.tick(i * (1000 / 60));
    }

    counter.reset();

    counter.tick(0);
    for (let i = 1; i <= 30; i++) {
      counter.tick(i * (1000 / 30));
    }
    expect(counter.fps).toBe(30);
  });
});
