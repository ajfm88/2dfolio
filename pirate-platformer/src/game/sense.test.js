import { describe, it, expect } from 'vitest';

import { playerNear, playerInFront } from './sense.js';

// The sensing entity: centre (110, 110).
const enemy = { x: 100, y: 100, w: 20, h: 20 };

describe('playerNear', () => {
  it('is true within the horizontal range and the height band', () => {
    // centre (155, 110): dx 45, dy 0
    const player = { x: 150, y: 105, w: 10, h: 10 };
    expect(playerNear(enemy, player, 50, 15)).toBe(true);
  });

  it('is false beyond the horizontal range', () => {
    // centre (205, 110): dx 95
    const player = { x: 200, y: 105, w: 10, h: 10 };
    expect(playerNear(enemy, player, 50, 15)).toBe(false);
  });

  it('is false outside the height band even when horizontally close', () => {
    // centre (110, 155): dx 0, dy 45
    const player = { x: 105, y: 150, w: 10, h: 10 };
    expect(playerNear(enemy, player, 50, 15)).toBe(false);
  });

  it('is true inside the height band', () => {
    // centre (110, 105): dy -5
    const player = { x: 105, y: 100, w: 10, h: 10 };
    expect(playerNear(enemy, player, 50, 15)).toBe(true);
  });

  it('includes the exact range and height boundaries', () => {
    // centre (160, 125): dx exactly 50, dy exactly 15
    const player = { x: 155, y: 120, w: 10, h: 10 };
    expect(playerNear(enemy, player, 50, 15)).toBe(true);
  });
});

describe('playerInFront', () => {
  it('is true when the player is on the -1 side (left)', () => {
    const player = { x: 50, y: 105, w: 10, h: 10 }; // centre 55 < 110
    expect(playerInFront(enemy, player, -1)).toBe(true);
  });

  it('is false when the player is behind a -1 facing (right)', () => {
    const player = { x: 150, y: 105, w: 10, h: 10 }; // centre 155 > 110
    expect(playerInFront(enemy, player, -1)).toBe(false);
  });

  it('is true when the player is on the +1 side (right)', () => {
    const player = { x: 150, y: 105, w: 10, h: 10 };
    expect(playerInFront(enemy, player, 1)).toBe(true);
  });

  it('is false when the player is behind a +1 facing (left)', () => {
    const player = { x: 50, y: 105, w: 10, h: 10 };
    expect(playerInFront(enemy, player, 1)).toBe(false);
  });

  it('is false for both facings when exactly aligned', () => {
    const player = { x: 105, y: 105, w: 10, h: 10 }; // centre 110 == 110
    expect(playerInFront(enemy, player, -1)).toBe(false);
    expect(playerInFront(enemy, player, 1)).toBe(false);
  });
});
