import { describe, it, expect, vi } from 'vitest';
import { PikachuFollowBuffer } from './follow_buffer';

describe('native follow buffer', () => {
  it('retains one entry, pops oldest only with two, and shifts the queue', () => {
    const b = new PikachuFollowBuffer();
    expect([b.size, b.newest, b.newestQueued, b.pop(), b.fast]).toEqual([255, 0, 0, null, false]);
    b.append(5);
    expect([b.size, b.newest, b.newestQueued, b.pop(), b.fast]).toEqual([0, 5, 0, null, false]);
    b.append(4);
    expect([b.size, b.newest, b.newestQueued, b.fast]).toEqual([1, 4, 4, false]);
    b.append(2);
    expect([b.size, b.newest, b.newestQueued, b.fast]).toEqual([2, 2, 2, true]);
    expect(b.pop()).toBe(5);
    expect([b.size, b.newestQueued, b.fast]).toEqual([1, 2, false]);
    expect(b.pop()).toBe(4);
    expect(b.pop()).toBeNull();
    expect(b.newest).toBe(2);
    b.clear();
    expect([b.size, b.length, b.newest]).toEqual([255, 0, 0]);
  });

  it('uses fast only with three commands remaining after the pop', () => {
    const b = new PikachuFollowBuffer();
    for (let i = 0; i < 4; i++) b.append(i + 1);
    expect(b.pop()).toBe(1);
    expect(b.fast).toBe(true);
    b.pop();
    expect(b.fast).toBe(false);
  });

  it('caps at 16 without teleporting or repeatedly warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const b = new PikachuFollowBuffer();
      for (let i = 1; i <= 20; i++) b.append(i);
      expect([b.size, b.length, b.newest]).toEqual([15, 16, 16]);
      expect(warn).toHaveBeenCalledOnce();
      b.clear();
      for (let i = 0; i < 17; i++) b.append(1);
      expect(warn).toHaveBeenCalledOnce();
    } finally { warn.mockRestore(); }
  });
});
