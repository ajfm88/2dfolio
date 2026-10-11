import { describe, it, expect } from 'vitest';
import { rectsOverlap, getOppositeDirection } from '../../src/core/collision-utils.js';
import { Direction } from '../../src/core/types.js';

describe('rectsOverlap', () => {
  it('returns true for overlapping rects', () => {
    expect(rectsOverlap(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 5, y: 5, width: 10, height: 10 },
    )).toBe(true);
  });

  it('returns true for fully contained rect', () => {
    expect(rectsOverlap(
      { x: 0, y: 0, width: 20, height: 20 },
      { x: 5, y: 5, width: 5, height: 5 },
    )).toBe(true);
  });

  it('returns false for non-overlapping rects (horizontal gap)', () => {
    expect(rectsOverlap(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 20, y: 0, width: 10, height: 10 },
    )).toBe(false);
  });

  it('returns false for non-overlapping rects (vertical gap)', () => {
    expect(rectsOverlap(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 0, y: 20, width: 10, height: 10 },
    )).toBe(false);
  });

  it('returns false for edge-touching rects (not overlapping)', () => {
    expect(rectsOverlap(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 10, y: 0, width: 10, height: 10 },
    )).toBe(false);
  });

  it('returns true for 1-pixel overlap', () => {
    expect(rectsOverlap(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 9, y: 9, width: 10, height: 10 },
    )).toBe(true);
  });
});

describe('getOppositeDirection', () => {
  it('Up is opposite to Down', () => {
    expect(getOppositeDirection(Direction.Up)).toBe(Direction.Down);
  });

  it('Down is opposite to Up', () => {
    expect(getOppositeDirection(Direction.Down)).toBe(Direction.Up);
  });

  it('Left is opposite to Right', () => {
    expect(getOppositeDirection(Direction.Left)).toBe(Direction.Right);
  });

  it('Right is opposite to Left', () => {
    expect(getOppositeDirection(Direction.Right)).toBe(Direction.Left);
  });

  it('is its own inverse', () => {
    for (const dir of [Direction.Up, Direction.Down, Direction.Left, Direction.Right]) {
      expect(getOppositeDirection(getOppositeDirection(dir))).toBe(dir);
    }
  });
});
