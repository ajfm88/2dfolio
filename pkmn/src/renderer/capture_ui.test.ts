import { describe, it, expect, vi, afterEach } from 'vitest';
import { captureUi, initRenderer, getCtx } from './renderer';
import { uiTiles } from './ui_tiles';

afterEach(() => { vi.unstubAllGlobals(); uiTiles.clear(); });

describe('UI layer capture', () => {
  it('collects UI coverage before sprite drawing, renders UI once and restores the scene context', () => {
    const scene = { imageSmoothingEnabled: true, drawImage: vi.fn() };
    const overlay = { imageSmoothingEnabled: true, clearRect: vi.fn() };
    const screen = { width: 0, height: 0, style: {}, getContext: () => scene };
    const layer = { width: 0, height: 0, getContext: () => overlay };
    vi.stubGlobal('document', { getElementById: (id: string) => id === 'screen' ? screen : null, createElement: () => layer });
    vi.stubGlobal('window', { innerWidth: 480, innerHeight: 432, addEventListener: vi.fn() });
    initRenderer();
    uiTiles.cover(0, 0, 160, 144); // stale previous frame
    const render = vi.fn(() => {
      expect(getCtx()).toBe(overlay);
      expect(uiTiles.tileAt(0, 0)).toBe(0);
      uiTiles.cover(80, 0, 80, 128);
    });
    const composite = captureUi(render);
    expect(getCtx()).toBe(scene);
    expect(uiTiles.tileAt(10, 8)).toBe(0x60);
    expect(uiTiles.tileAt(9, 8)).toBe(0);
    expect(scene.drawImage).not.toHaveBeenCalled();
    composite();
    expect(scene.drawImage).toHaveBeenCalledWith(layer, 0, 0);
    expect(render).toHaveBeenCalledOnce();
    expect(overlay.clearRect).toHaveBeenCalledWith(0, 0, 160, 144);
    expect(overlay.imageSmoothingEnabled).toBe(false);
    expect(() => captureUi(() => { throw new Error('render failed'); })).toThrow('render failed');
    expect(getCtx()).toBe(scene);
  });
});
