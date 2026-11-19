import { afterEach, expect, it, vi } from 'vitest';
vi.hoisted(() => { Object.assign(globalThis, { window: { addEventListener() {} } }); });
import { setJoyIgnore, joyIgnored } from './joy_ignore';
import { setKey, readJoypad, isPassPressed, isHeld, syncJoypadRead, joyHeld, PAD } from './input';
afterEach(() => { for (const b of ['up','down','left','right','start','select','a','b'] as const) setKey(b, false); setJoyIgnore('none'); syncJoypadRead(); });
it('SELECT|START|D-pad keeps A/B readable and preserves the raw held edge when cleared', () => {
  setJoyIgnore('controls');
  for (const b of ['up','down','left','right','start','select'] as const) {
    expect(joyIgnored(b)).toBe(true); setKey(b, true);
  }
  setKey('a', true); setKey('b', true); readJoypad();
  expect(isPassPressed('a') && isPassPressed('b')).toBe(true);
  expect(isHeld('up') || isPassPressed('start')).toBe(false);
  setJoyIgnore('none'); readJoypad();
  expect(isHeld('start')).toBe(true); expect(isPassPressed('start')).toBe(false);
});
// Opening checkpoint-06 (note 115): the title's loop reads hJoyHeld as _Joypad leaves it.
it('joyHeld is hJoyHeld: the PAD bits of constants/hardware.inc (A $01 to DOWN $80), wJoyIgnore masked out', () => {
  expect([PAD.a, PAD.b, PAD.select, PAD.start, PAD.right, PAD.left, PAD.up, PAD.down]).toEqual([1, 2, 4, 8, 16, 32, 64, 128]);
  expect(joyHeld()).toBe(0);
  setKey('up', true); setKey('select', true); setKey('b', true);
  expect(joyHeld()).toBe(0x46);
  setKey('down', true); setKey('a', true);
  expect(joyHeld()).toBe(0xc7);
  setJoyIgnore('controls');
  expect(joyHeld()).toBe(0x03);
});
// Opening checkpoint-07b (note 117): DoClearSaveDialogue masks PAD_B alone.
it('PAD_B alone masks B from every read and from hJoyHeld; the other buttons read as usual', () => {
  setJoyIgnore('b');
  expect((['up','down','left','right','start','select','a','b'] as const).filter(b => joyIgnored(b))).toEqual(['b']);
  setKey('b', true); setKey('a', true); readJoypad();
  expect([isPassPressed('b'), isPassPressed('a'), isHeld('b'), joyHeld()]).toEqual([false, true, false, PAD.a]);
});
