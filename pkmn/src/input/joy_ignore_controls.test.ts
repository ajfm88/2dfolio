import { afterEach, expect, it, vi } from 'vitest';
vi.hoisted(() => { Object.assign(globalThis, { window: { addEventListener() {} } }); });
import { setJoyIgnore, joyIgnored } from './joy_ignore';
import { setKey, readJoypad, isPassPressed, isHeld, syncJoypadRead } from './input';
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
