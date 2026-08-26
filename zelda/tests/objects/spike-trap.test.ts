import { describe, it, expect } from 'vitest';
import { SpikeTrap } from '../../src/objects/enemies/spike-trap.js';

describe('SpikeTrap', () => {
  it('creates 6 traps for type $49', () => {
    const traps = SpikeTrap.createTraps(0x49);
    expect(traps).toHaveLength(6);
  });

  it('creates 4 traps for type $4A', () => {
    const traps = SpikeTrap.createTraps(0x4A);
    expect(traps).toHaveLength(4);
  });

  it('traps start at fixed NES positions', () => {
    const traps = SpikeTrap.createTraps(0x49);
    expect(traps[0]!.x).toBe(0x20);
    expect(traps[0]!.y).toBe(0x5D);
    expect(traps[2]!.x).toBe(0xD0);
    expect(traps[2]!.y).toBe(0x5D);
    expect(traps[5]!.x).toBe(0xB0);
    expect(traps[5]!.y).toBe(0x8D);
  });

  it('trap stays idle when Link is far away', () => {
    const traps = SpikeTrap.createTraps(0x49);
    const trap = traps[0]!;
    const startX = trap.x;
    const startY = trap.y;
    trap.update(128, 128); // Link far from trap
    expect(trap.x).toBe(startX);
    expect(trap.y).toBe(startY);
  });

  it('trap attacks when Link aligns vertically within threshold', () => {
    const traps = SpikeTrap.createTraps(0x49);
    const trap = traps[0]!; // at ($20, $5D), allowed dirs $05 (right+down)
    const startX = trap.x;
    // Place Link on same Y, to the right (trap can go right)
    trap.update(0x80, 0x5D); // triggers attack
    trap.update(0x80, 0x5D); // first movement frame
    expect(trap.x).toBeGreaterThan(startX);
  });

  it('trap does not attack in disallowed direction', () => {
    const traps = SpikeTrap.createTraps(0x49);
    const trap = traps[0]!; // at ($20, $5D), allowed dirs $05 (right+down)
    const startX = trap.x;
    // Place Link on same Y, to the LEFT (trap cannot go left)
    trap.update(0x10, 0x5D);
    expect(trap.x).toBe(startX);
  });

  it('trap has 16x16 hitbox', () => {
    const traps = SpikeTrap.createTraps(0x49);
    const hb = traps[0]!.getHitbox();
    expect(hb.width).toBe(16);
    expect(hb.height).toBe(16);
  });

  it('trap returns to home after attack cycle', () => {
    const traps = SpikeTrap.createTraps(0x49);
    const trap = traps[0]!; // at ($20, $5D)
    // Trigger attack rightward
    trap.update(0x80, 0x5D);
    // Run many frames to complete attack + return cycle
    for (let i = 0; i < 500; i++) {
      trap.update(0xFF, 0xFF); // Link far away, no re-trigger
    }
    expect(trap.x).toBe(0x20);
    expect(trap.y).toBe(0x5D);
  });

  it('trap damage matches NES value $80', () => {
    const traps = SpikeTrap.createTraps(0x49);
    expect(traps[0]!.damage).toBe(0x80);
  });
});
