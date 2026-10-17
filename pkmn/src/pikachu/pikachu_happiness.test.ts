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
