import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { joyIgnored, setJoyIgnore } from './joy_ignore';

// input.ts listens on window at import; give it a stand-in that never fires.
vi.stubGlobal('window', { addEventListener: () => {} });
let input: typeof import('./input');
beforeAll(async () => { input = await import('./input'); });
afterEach(() => {
  setJoyIgnore('none');
  for (const b of ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select'] as const) input.setKey(b, false);
  input.syncJoypadRead();
  input.updateInput();
});

describe('wJoyIgnore (engine/joypad.asm _Joypad)', () => {
  it('PAD_CTRL_PAD masks the d-pad only; $ff masks everything', () => {
    setJoyIgnore('dpad');
    expect(['up', 'down', 'left', 'right'].every(b => joyIgnored(b as never))).toBe(true);
    expect(joyIgnored('a') || joyIgnored('start')).toBe(false);
    setJoyIgnore('all');
    expect(joyIgnored('a') && joyIgnored('start') && joyIgnored('select')).toBe(true);
    setJoyIgnore('none');
    expect(joyIgnored('up')).toBe(false);
  });

  it('masks held and pressed at the overworld read', () => {
    setJoyIgnore('all');
    input.setKey('left', true);
    input.setKey('a', true);
    input.readJoypad();
    expect(input.isHeld('left')).toBe(false);
    expect(input.isPassPressed('a')).toBe(false);
  });

  it('the edge stays raw (hJoyLast): a button held through the mask is not pressed after it', () => {
    setJoyIgnore('all');
    input.setKey('a', true);
    input.readJoypad();
    setJoyIgnore('none');
    input.readJoypad();
    expect(input.isHeld('a')).toBe(true);
    expect(input.isPassPressed('a')).toBe(false);
  });

  it('with only the d-pad masked, A and START still read', () => {
    setJoyIgnore('dpad');
    input.setKey('a', true);
    input.setKey('up', true);
    input.readJoypad();
    expect(input.isPassPressed('a')).toBe(true);
    expect(input.isPassPressed('up')).toBe(false);
    expect(input.isHeld('up')).toBe(false);
  });
});
