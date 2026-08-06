import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Renderer } from '../../src/render/renderer.js';
import { SCREEN_WIDTH, SCREEN_HEIGHT, HUD_HEIGHT } from '../../src/core/constants.js';

function createMockCanvas(): HTMLCanvasElement {
  const ctx = {
    fillStyle: '',
    font: '',
    imageSmoothingEnabled: true,
    fillRect: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
  };

  const canvas = {
    width: 0,
    height: 0,
    style: { width: '', height: '' },
    getContext: vi.fn(() => ctx),
  } as unknown as HTMLCanvasElement;

  return canvas;
}

describe('Renderer', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      innerWidth: 1024,
      innerHeight: 768,
      addEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets canvas to NES resolution', () => {
    const canvas = createMockCanvas();
    const renderer = new Renderer(canvas);

    expect(canvas.width).toBe(SCREEN_WIDTH);
    expect(canvas.height).toBe(SCREEN_HEIGHT);
    expect(renderer.width).toBe(SCREEN_WIDTH);
    expect(renderer.height).toBe(SCREEN_HEIGHT);
  });

  it('disables image smoothing', () => {
    const canvas = createMockCanvas();
    const renderer = new Renderer(canvas);

    expect(renderer.ctx.imageSmoothingEnabled).toBe(false);
  });

  it('integer-scales to fit viewport', () => {
    const canvas = createMockCanvas();
    new Renderer(canvas);

    // 1024 / 256 = 4, 768 / 240 = 3.2 → floor = 3, min(4, 3) = 3
    expect(canvas.style.width).toBe(`${SCREEN_WIDTH * 3}px`);
    expect(canvas.style.height).toBe(`${SCREEN_HEIGHT * 3}px`);
  });

  it('registers resize listener', () => {
    const canvas = createMockCanvas();
    new Renderer(canvas);

    expect(window.addEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
    );
  });

  it('clear fills the full canvas', () => {
    const canvas = createMockCanvas();
    const renderer = new Renderer(canvas);

    renderer.clear('#f00');

    expect(renderer.ctx.fillRect).toHaveBeenCalledWith(
      0, 0, SCREEN_WIDTH, SCREEN_HEIGHT,
    );
  });

  it('beginPlayArea translates to HUD offset', () => {
    const canvas = createMockCanvas();
    const renderer = new Renderer(canvas);

    renderer.beginPlayArea();

    expect(renderer.ctx.save).toHaveBeenCalled();
    expect(renderer.ctx.translate).toHaveBeenCalledWith(0, HUD_HEIGHT);
  });

  it('endPlayArea restores context', () => {
    const canvas = createMockCanvas();
    const renderer = new Renderer(canvas);

    renderer.endPlayArea();

    expect(renderer.ctx.restore).toHaveBeenCalled();
  });
});
