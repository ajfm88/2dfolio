import { describe, it, expect, vi, afterEach } from 'vitest';
import { DebugOverlay } from '../../src/core/debug-overlay.js';

interface MockKeyTarget {
  addEventListener(type: string, handler: (e: unknown) => void): void;
  removeEventListener(type: string, handler: (e: unknown) => void): void;
  dispatchKeyDown(code: string): void;
}

function createMockKeyTarget(): MockKeyTarget {
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
      for (const fn of listeners.get('keydown') ?? []) {
        fn({ code });
      }
    },
  };
}

describe('DebugOverlay', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('initial state', () => {
    it('starts disabled', () => {
      const overlay = new DebugOverlay();
      expect(overlay.enabled).toBe(false);
    });
  });

  describe('toggle', () => {
    it('toggle() enables when disabled', () => {
      const overlay = new DebugOverlay();
      overlay.toggle();
      expect(overlay.enabled).toBe(true);
    });

    it('toggle() disables when enabled', () => {
      const overlay = new DebugOverlay();
      overlay.toggle();
      overlay.toggle();
      expect(overlay.enabled).toBe(false);
    });

    it('double toggle returns to original state', () => {
      const overlay = new DebugOverlay();
      const original = overlay.enabled;
      overlay.toggle();
      overlay.toggle();
      expect(overlay.enabled).toBe(original);
    });
  });

  describe('backtick key binding', () => {
    it('Backquote keydown toggles enabled state', () => {
      const overlay = new DebugOverlay();
      const target = createMockKeyTarget();
      overlay.attach(target);

      target.dispatchKeyDown('Backquote');
      expect(overlay.enabled).toBe(true);
    });

    it('second Backquote keydown toggles back to disabled', () => {
      const overlay = new DebugOverlay();
      const target = createMockKeyTarget();
      overlay.attach(target);

      target.dispatchKeyDown('Backquote');
      target.dispatchKeyDown('Backquote');
      expect(overlay.enabled).toBe(false);
    });

    it('non-Backquote keys do not toggle', () => {
      const overlay = new DebugOverlay();
      const target = createMockKeyTarget();
      overlay.attach(target);

      target.dispatchKeyDown('KeyA');
      target.dispatchKeyDown('Enter');
      target.dispatchKeyDown('Space');
      expect(overlay.enabled).toBe(false);
    });

    it('after detach, Backquote no longer toggles', () => {
      const overlay = new DebugOverlay();
      const target = createMockKeyTarget();
      overlay.attach(target);
      overlay.detach();

      target.dispatchKeyDown('Backquote');
      expect(overlay.enabled).toBe(false);
    });
  });

  describe('attach and detach', () => {
    it('attach with custom target uses that target', () => {
      const overlay = new DebugOverlay();
      const target = createMockKeyTarget();
      overlay.attach(target);

      target.dispatchKeyDown('Backquote');
      expect(overlay.enabled).toBe(true);
    });

    it('detach is safe to call when not attached', () => {
      const overlay = new DebugOverlay();
      expect(() => overlay.detach()).not.toThrow();
    });

    it('detach removes the listener from the target', () => {
      const overlay = new DebugOverlay();
      const target = createMockKeyTarget();
      overlay.attach(target);

      target.dispatchKeyDown('Backquote');
      expect(overlay.enabled).toBe(true);

      overlay.detach();
      target.dispatchKeyDown('Backquote');
      expect(overlay.enabled).toBe(true);
    });
  });
});
