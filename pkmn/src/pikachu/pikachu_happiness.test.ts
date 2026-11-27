import { describe, expect, it } from 'vitest';
import {
  getPikachuHappiness, getPikachuMood, modifyPikachuHappiness, restorePikachuHappiness,
} from './pikachu_happiness';

// engine/events/pikachu_happiness.asm: DEPOSITED row and PikachuMoods[$07].
describe('DEPOSITED happiness event', () => {
  it.each([[0, 0], [2, 0], [99, 96], [100, 97], [199, 196], [200, 195], [255, 250]])(
    'happiness %i becomes %i with the original tier and lower clamp', (before, after) => {
      restorePikachuHappiness(before, 0x80);
      modifyPikachuHappiness('DEPOSITED');
      expect(getPikachuHappiness()).toBe(after);
      expect(getPikachuMood()).toBe(0x62);
    },
  );

  it.each([0x20, 0x62, 0x80, 0xff])('mood %i is lowered directly to $62, never raised', mood => {
    restorePikachuHappiness(90, mood);
    modifyPikachuHappiness('DEPOSITED');
    expect(getPikachuMood()).toBe(Math.min(mood, 0x62));
  });
});

// poison.asm PIKAHAPPY_PSNFNT: HappinessChangeTable row 9, PikachuMoods index 8.
describe('PSNFNT happiness event', () => {
  it.each([[0, 0], [5, 0], [99, 94], [100, 95], [199, 194], [200, 190], [255, 245]])(
    'happiness %i becomes %i with tiers -5/-5/-10', (before, after) => {
      restorePikachuHappiness(before, 0x80);
      modifyPikachuHappiness('PSNFNT');
      expect(getPikachuHappiness()).toBe(after);
      expect(getPikachuMood()).toBe(0x62);
    },
  );

  it.each([0x20, 0x62, 0x80, 0xff])('mood %i is lowered directly to $62, never raised', mood => {
    restorePikachuHappiness(90, mood);
    modifyPikachuHappiness('PSNFNT');
    expect(getPikachuMood()).toBe(Math.min(mood, 0x62));
  });

  it('does not change the battle faint event', () => {
    restorePikachuHappiness(90, 0x80);
    modifyPikachuHappiness('FAINTED');
    expect(getPikachuHappiness()).toBe(89);
    expect(getPikachuMood()).toBe(0x7f);
  });
});
