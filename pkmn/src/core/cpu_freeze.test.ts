// Opening checkpoint-04 (note 113): the frames PlayPikachuSoundClip spends between `di` and `ei`.
import { expect, it } from 'vitest';
import { freezeFrames, isCpuFrozen, takeFrozenFrame, resetCpuFreeze } from './cpu_freeze';

it('freezes exactly the frames asked for, then none', () => {
  expect(isCpuFrozen()).toBe(false); expect(takeFrozenFrame()).toBe(false);
  freezeFrames(3);
  for (let frame = 0; frame < 3; frame++) { expect(isCpuFrozen()).toBe(true); expect(takeFrozenFrame()).toBe(true); }
  expect(isCpuFrozen()).toBe(false); expect(takeFrozenFrame()).toBe(false);
});

it('peeking never consumes; a second clip replaces the count; zero frames freeze nothing', () => {
  freezeFrames(5);
  for (let i = 0; i < 9; i++) expect(isCpuFrozen()).toBe(true);
  expect(takeFrozenFrame()).toBe(true);
  freezeFrames(2);
  expect(takeFrozenFrame()).toBe(true); expect(takeFrozenFrame()).toBe(true); expect(takeFrozenFrame()).toBe(false);
  freezeFrames(0);
  expect(isCpuFrozen()).toBe(false); expect(takeFrozenFrame()).toBe(false);
});

it('rejects a count that is not a whole number of frames, and the global setup clears a freeze left by a test', () => {
  expect(() => freezeFrames(-1)).toThrow('cannot freeze -1 frames');
  expect(() => freezeFrames(1.5)).toThrow('cannot freeze 1.5 frames');
  expect(() => freezeFrames(NaN)).toThrow('cannot freeze NaN frames');
  expect(isCpuFrozen()).toBe(false);
  freezeFrames(4); resetCpuFreeze();
  expect(isCpuFrozen()).toBe(false); expect(takeFrozenFrame()).toBe(false);
});
