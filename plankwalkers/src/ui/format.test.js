import { describe, expect, it } from 'vitest';

import { formatTime } from './format.js';

describe('formatTime', () => {
  it('formats zero', () => {
    expect(formatTime(0)).toBe('0:00.00');
  });

  it('formats under a second', () => {
    expect(formatTime(90)).toBe('0:00.09');
    expect(formatTime(990)).toBe('0:00.99');
  });

  it('formats seconds and minutes', () => {
    expect(formatTime(42130)).toBe('0:42.13');
    expect(formatTime(61000)).toBe('1:01.00');
    expect(formatTime(10 * 60000 + 5250)).toBe('10:05.25');
  });

  it('rounds down, never up to the next hundredth', () => {
    expect(formatTime(42139.9)).toBe('0:42.13');
    expect(formatTime(59999)).toBe('0:59.99');
  });
});
