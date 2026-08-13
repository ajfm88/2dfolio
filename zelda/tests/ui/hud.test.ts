import { describe, it, expect } from 'vitest';
import { formatCount } from '../../src/ui/hud.js';

describe('formatCount', () => {
  it('0 formats as "X0"', () => {
    expect(formatCount(0)).toBe('X0');
  });

  it('5 formats as "X5"', () => {
    expect(formatCount(5)).toBe('X5');
  });

  it('23 formats as "X23"', () => {
    expect(formatCount(23)).toBe('X23');
  });

  it('99 formats as "X99"', () => {
    expect(formatCount(99)).toBe('X99');
  });

  it('100 formats as "100" (no X prefix)', () => {
    expect(formatCount(100)).toBe('100');
  });

  it('255 formats as "255"', () => {
    expect(formatCount(255)).toBe('255');
  });

  it('10 formats as "X10"', () => {
    expect(formatCount(10)).toBe('X10');
  });
});
