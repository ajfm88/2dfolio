import { afterEach, describe, expect, it } from 'vitest';
import { getPikachuHappiness, getPikachuMood, modifyPikachuHappiness, restorePikachuHappiness, setPikachuEmotionModifier } from './pikachu_happiness';

afterEach(() => { restorePikachuHappiness(90, 0x80); setPikachuEmotionModifier(0); });
describe('USEDTMHM cartridge event', () => {
  it.each([[0,1],[99,100],[100,101],[199,200],[200,200],[255,255]])('happiness %i becomes %i', (before, expected) => {
    restorePikachuHappiness(before, 0x80); setPikachuEmotionModifier(0);
    modifyPikachuHappiness('USEDTMHM');
    expect(getPikachuHappiness()).toBe(expected); expect(getPikachuMood()).toBe(0x94);
  });
  it.each([[0,0,0x94],[0x93,0,0x94],[0x94,0,0x94],[0xff,0,0xff],[0x80,5,0x80]])('mood %i and modifier %i yield %i', (mood, modifier, expected) => {
    restorePikachuHappiness(90,mood); setPikachuEmotionModifier(modifier);
    modifyPikachuHappiness('USEDTMHM'); expect(getPikachuMood()).toBe(expected); expect(getPikachuHappiness()).toBe(91);
  });
});
