// V5f checkpoint-01 (note 96): LoadBGMapAttributes' two frames without VBlank (DECISIONS #73).
import { expect, it } from 'vitest';
import { holdVBlank, isVBlankHeld, takeHeldFrame, resetVBlankHold } from './vblank_hold';

it('holds exactly the next two frames, then none', () => {
  expect(isVBlankHeld()).toBe(false); expect(takeHeldFrame()).toBe(false);
  holdVBlank();
  expect(isVBlankHeld()).toBe(true); expect(takeHeldFrame()).toBe(true);
  expect(isVBlankHeld()).toBe(true); expect(takeHeldFrame()).toBe(true);
  expect(isVBlankHeld()).toBe(false); expect(takeHeldFrame()).toBe(false);
});

it('peeking never consumes; a second command restarts the count at two', () => {
  holdVBlank();
  for (let i = 0; i < 5; i++) expect(isVBlankHeld()).toBe(true);
  expect(takeHeldFrame()).toBe(true);
  holdVBlank();
  expect(takeHeldFrame()).toBe(true); expect(takeHeldFrame()).toBe(true); expect(takeHeldFrame()).toBe(false);
});

it('the global setup clears a hold left by a test', () => {
  holdVBlank(); resetVBlankHold();
  expect(isVBlankHeld()).toBe(false); expect(takeHeldFrame()).toBe(false);
});
