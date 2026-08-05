import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameLoop } from '../../src/core/game-loop.js';

describe('GameLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      return setTimeout(() => cb(performance.now()), 0) as unknown as number;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
    vi.stubGlobal('document', {
      hidden: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('can be constructed with callbacks', () => {
    const loop = new GameLoop({
      update: vi.fn(),
      render: vi.fn(),
    });
    expect(loop).toBeDefined();
  });

  it('calls update and render when started', () => {
    const update = vi.fn();
    const render = vi.fn();
    const loop = new GameLoop({ update, render });

    loop.start();
    vi.advanceTimersByTime(20);

    expect(update).toHaveBeenCalled();
    expect(render).toHaveBeenCalled();

    loop.stop();
  });
});
