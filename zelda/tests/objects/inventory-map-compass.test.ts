import { describe, it, expect } from 'vitest';
import { Inventory } from '../../src/objects/player/inventory.js';

describe('Inventory map/compass helpers', () => {
  it('hasMapForLevel returns false by default', () => {
    const inv = new Inventory();
    expect(inv.hasMapForLevel(1)).toBe(false);
    expect(inv.hasMapForLevel(9)).toBe(false);
  });

  it('giveMap sets the correct bit for levels 1-8', () => {
    const inv = new Inventory();
    inv.giveMap(3);
    expect(inv.hasMapForLevel(3)).toBe(true);
    expect(inv.hasMapForLevel(2)).toBe(false);
    expect(inv.hasMapForLevel(4)).toBe(false);
  });

  it('giveMap for level 9 sets map9 boolean', () => {
    const inv = new Inventory();
    inv.giveMap(9);
    expect(inv.hasMapForLevel(9)).toBe(true);
    expect(inv.map9).toBe(true);
  });

  it('hasCompassForLevel works like hasMapForLevel', () => {
    const inv = new Inventory();
    inv.giveCompass(5);
    expect(inv.hasCompassForLevel(5)).toBe(true);
    expect(inv.hasCompassForLevel(4)).toBe(false);
  });

  it('giveCompass for level 9', () => {
    const inv = new Inventory();
    inv.giveCompass(9);
    expect(inv.hasCompassForLevel(9)).toBe(true);
    expect(inv.compass9).toBe(true);
  });

  it('multiple maps can be held simultaneously', () => {
    const inv = new Inventory();
    inv.giveMap(1);
    inv.giveMap(4);
    inv.giveMap(8);
    expect(inv.hasMapForLevel(1)).toBe(true);
    expect(inv.hasMapForLevel(4)).toBe(true);
    expect(inv.hasMapForLevel(8)).toBe(true);
    expect(inv.hasMapForLevel(2)).toBe(false);
  });

  it('out of range levels return false', () => {
    const inv = new Inventory();
    expect(inv.hasMapForLevel(0)).toBe(false);
    expect(inv.hasMapForLevel(10)).toBe(false);
    expect(inv.hasCompassForLevel(-1)).toBe(false);
  });
});
