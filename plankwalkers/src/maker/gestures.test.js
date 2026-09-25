import { describe, expect, it } from 'vitest';
import { createGestures } from './gestures.js';

function fakeInput() {
  /** @type {Array<{ id: number, x: number, y: number }>} */
  const touches = [];
  return {
    touches,
    set(list) {
      touches.length = 0;
      for (let i = 0; i < list.length; i++) touches.push(list[i]);
    },
  };
}

describe('createGestures', () => {
  it('stays idle with no fingers', () => {
    const input = fakeInput();
    const g = createGestures(input);
    g.update(1 / 60, 1);
    expect(g.state).toBe('idle');
    expect(g.active).toBe(false);
  });

  it('enters longPress then onePaint after moving past the threshold', () => {
    const input = fakeInput();
    const g = createGestures(input, { moveThreshold: 4, isPanMode: () => false });
    input.set([{ id: 1, x: 10, y: 10 }]);
    g.update(1 / 60, 1);
    expect(g.state).toBe('longPress');
    input.set([{ id: 1, x: 20, y: 10 }]);
    g.update(1 / 60, 1);
    expect(g.state).toBe('onePaint');
    expect(g.paintPressed).toBe(true);
    expect(g.paintX).toBe(20);
  });

  it('fires eyedrop after 300ms without moving, then consumes the finger', () => {
    const input = fakeInput();
    const g = createGestures(input, { longPressMs: 300, isPanMode: () => false });
    input.set([{ id: 1, x: 5, y: 5 }]);
    g.update(0.2, 1);
    expect(g.state).toBe('longPress');
    expect(g.eyedropFired).toBe(false);
    g.update(0.15, 1);
    expect(g.eyedropFired).toBe(true);
    expect(g.eyedropX).toBe(5);
    expect(g.state).toBe('idle');
    g.update(1 / 60, 1);
    expect(g.eyedropFired).toBe(false);
    expect(g.state).toBe('idle');
  });

  it('one-finger pan when the toggle is pan mode', () => {
    const input = fakeInput();
    const g = createGestures(input, { isPanMode: () => true });
    input.set([{ id: 1, x: 0, y: 0 }]);
    g.update(1 / 60, 1);
    expect(g.state).toBe('onePan');
    input.set([{ id: 1, x: 8, y: -4 }]);
    g.update(1 / 60, 1);
    expect(g.panDx).toBe(8);
    expect(g.panDy).toBe(-4);
  });

  it('aborts paint with paintReleased when a second finger lands', () => {
    const input = fakeInput();
    const g = createGestures(input);
    input.set([{ id: 1, x: 0, y: 0 }]);
    g.update(1 / 60, 1);
    input.set([{ id: 1, x: 10, y: 0 }]);
    g.update(1 / 60, 1);
    expect(g.state).toBe('onePaint');
    input.set([{ id: 1, x: 10, y: 0 }, { id: 2, x: 40, y: 0 }]);
    g.update(1 / 60, 1);
    expect(g.paintReleased).toBe(true);
    expect(g.state).toBe('twoFinger');
  });

  it('snaps zoom out then in from two-finger distance', () => {
    const input = fakeInput();
    const g = createGestures(input);
    input.set([{ id: 1, x: 0, y: 0 }, { id: 2, x: 100, y: 0 }]);
    g.update(1 / 60, 1);
    expect(g.state).toBe('twoFinger');
    expect(g.zoomSnap).toBeNull();
    input.set([{ id: 1, x: 0, y: 0 }, { id: 2, x: 150, y: 0 }]);
    g.update(1 / 60, 1);
    expect(g.zoomSnap).toBe(2);
    input.set([{ id: 1, x: 0, y: 0 }, { id: 2, x: 150, y: 0 }]);
    g.update(1 / 60, 2);
    expect(g.zoomSnap).toBeNull();
    input.set([{ id: 1, x: 0, y: 0 }, { id: 2, x: 90, y: 0 }]);
    g.update(1 / 60, 2);
    expect(g.zoomSnap).toBe(1);
  });

  it('a quick tap places once at the touch-down point', () => {
    const input = fakeInput();
    const g = createGestures(input, { moveThreshold: 4, longPressMs: 300 });
    input.set([{ id: 1, x: 30, y: 40 }]);
    g.update(1 / 60, 1);
    expect(g.paintPressed).toBe(false);
    input.set([{ id: 1, x: 32, y: 41 }]);
    g.update(1 / 60, 1);
    expect(g.state).toBe('longPress');
    input.set([]);
    g.update(1 / 60, 1);
    expect(g.paintPressed).toBe(true);
    expect(g.paintReleased).toBe(true);
    expect(g.paintX).toBe(30);
    expect(g.paintY).toBe(40);
    // Delivered through the gesture channel even though no finger is down.
    expect(g.active).toBe(true);
    expect(g.state).toBe('idle');
    g.update(1 / 60, 1);
    expect(g.paintPressed).toBe(false);
    expect(g.active).toBe(false);
  });

  it('no tap after a long-press eyedrop, in pan mode, or after a two-finger gesture', () => {
    const input = fakeInput();
    const g = createGestures(input, { longPressMs: 300 });
    input.set([{ id: 1, x: 5, y: 5 }]);
    g.update(0.35, 1);
    expect(g.eyedropFired).toBe(true);
    input.set([]);
    g.update(1 / 60, 1);
    expect(g.paintPressed).toBe(false);

    const pan = createGestures(input, { isPanMode: () => true });
    input.set([{ id: 1, x: 5, y: 5 }]);
    pan.update(1 / 60, 1);
    input.set([]);
    pan.update(1 / 60, 1);
    expect(pan.paintPressed).toBe(false);

    const pinch = createGestures(input);
    input.set([{ id: 1, x: 0, y: 0 }, { id: 2, x: 100, y: 0 }]);
    pinch.update(1 / 60, 1);
    input.set([{ id: 1, x: 0, y: 0 }]);
    pinch.update(1 / 60, 1);
    expect(pinch.state).toBe('longPress');
    input.set([]);
    pinch.update(1 / 60, 1);
    expect(pinch.paintPressed).toBe(false);
  });

  it('emits paintReleased when the last finger lifts during a paint', () => {
    const input = fakeInput();
    const g = createGestures(input);
    input.set([{ id: 1, x: 0, y: 0 }]);
    g.update(1 / 60, 1);
    input.set([{ id: 1, x: 10, y: 0 }]);
    g.update(1 / 60, 1);
    input.set([]);
    g.update(1 / 60, 1);
    expect(g.paintReleased).toBe(true);
    expect(g.state).toBe('idle');
    expect(g.active).toBe(false);
  });
});
