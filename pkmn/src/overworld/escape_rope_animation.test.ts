import { beforeAll, beforeEach, expect, it } from 'vitest';
import { EscapeRopeAnimation } from './escape_rope_animation';
import { host, loadMainBattleRig, mon, resetMainBattleRig, tick, world } from '../test/main_battle_rig';

it('runs the CGB ordinary-tile exit and entry in cartridge sound order, then restores facing', () => {
  const animation = new EscapeRopeAnimation('left');
  for (let n = 0; n < 3; n++) {
    animation.tick(true);
    expect(animation.takeStartMusic()).toBe(n === 2);
    expect(animation.offsetY).toBe(0);
  }
  for (let n = 0; n < 40; n++) animation.tick(true);
  expect(animation.offsetY).toBe(0);
  const sounds: string[] = [];
  const exit2Frames: number[] = [];
  const riseFrames: number[] = [];
  const exitWhites: { frame: number; white: number }[] = [];
  let fadeOutFirst = -1;
  let fadeOutEnd = -1;
  for (let n = 0; n < 500 && !animation.loading; n++) {
    animation.tick(false);
    const sound = animation.takeSound();
    if (sound) {
      sounds.push(sound);
      if (sound === 'teleport_exit2') exit2Frames.push(n);
    }
    if (animation.offsetY !== -16 * riseFrames.length && animation.offsetY < 0) riseFrames.push(n);
    if (animation.white > 0) {
      if (fadeOutFirst < 0) fadeOutFirst = n;
      exitWhites.push({ frame: n, white: animation.white });
    }
    if (animation.loading) fadeOutEnd = n;
  }
  expect(animation.loading).toBe(true);
  expect(animation.offsetY).toBe(-80);
  expect(animation.white).toBe(1);
  expect(sounds).toEqual([
    'teleport_exit2', 'teleport_exit2', 'teleport_exit2', 'teleport_exit2', 'teleport_exit1',
  ]);
  // Sounds at delay 16/12/8/4, separated by DelayFrames(15+14+13+12), etc.
  expect(exit2Frames.slice(1).map((frame, i) => frame - exit2Frames[i])).toEqual([54, 38, 22]);
  expect(riseFrames.slice(1).map((frame, i) => frame - riseFrames[i])).toEqual([3, 3, 3, 3]);
  expect(fadeOutEnd - fadeOutFirst + 1).toBe(24);
  expect([0, 8, 16].map(i => exitWhites[i].white)).toEqual([1 / 3, 2 / 3, 1]);
  animation.loaded();
  const fallFrames: number[] = [];
  let enter2Frame = -1;
  let enter1Frame = -1;
  let completeFrame = -1;
  let fadeInFirst = -1;
  const entryWhites: number[] = [];
  for (let n = 0; n < 500 && !animation.complete; n++) {
    animation.tick();
    const sound = animation.takeSound();
    if (sound) sounds.push(sound);
    if (sound === 'teleport_enter1') enter1Frame = n;
    if (sound === 'teleport_enter2') enter2Frame = n;
    if (animation.white < 1 && enter1Frame < 0) {
      if (fadeInFirst < 0) fadeInFirst = n;
      entryWhites.push(animation.white);
    }
    if (animation.offsetY === -80 + 16 * (fallFrames.length + 1)) fallFrames.push(n);
    if (animation.complete) completeFrame = n;
  }
  expect(animation.complete).toBe(true);
  expect([animation.offsetY, animation.white, animation.direction]).toEqual([0, 0, 'left']);
  expect(sounds.slice(-2)).toEqual(['teleport_enter1', 'teleport_enter2']);
  expect(fallFrames.slice(1).map((frame, i) => frame - fallFrames[i])).toEqual([3, 3, 3, 3]);
  expect(enter1Frame - fadeInFirst + 1).toBe(24);
  for (const [index, expected] of [[0, 2 / 3], [8, 1 / 3], [16, 0]])
    expect(entryWhites[index]).toBeCloseTo(expected);
  expect(completeFrame - enter2Frame).toBe(28);
});

const live = host as typeof host & {
  beginEscapeRope(): void;
  lastBlackoutWarp: { destMap: string; destWarpId: number };
};
beforeAll(() => loadMainBattleRig());
beforeEach(() => resetMainBattleRig());

it('uses the last center fly row through the real map loader without blackout effects', async () => {
  const lead = mon();
  lead.currentHp = 7;
  await world('DiglettsCave', 5, 6, [lead]);
  host.player.direction = 'left';
  live.lastBlackoutWarp = { destMap: 'PewterCity', destWarpId: 6 };
  host.money = 2444;
  live.beginEscapeRope();
  for (let n = 0; n < 750 && host.state !== 'overworld'; n++) {
    tick();
    await Promise.resolve();
  }
  expect(host.state).toBe('overworld');
  expect(host.gameMap.mapData?.name).toBe('PewterCity');
  expect([host.player.mapStepX, host.player.mapStepY, host.player.direction]).toEqual([13, 26, 'left']);
  expect([host.money, host.playerParty[0].currentHp]).toEqual([2444, 7]);
  expect(host.ow.doorExitStep).toBe(false);
  expect(host.ow.justWarped).toBe(false);
  expect(host.pikachuFollower.visible).toBe(true);
  expect([host.pikachuFollower.x, host.pikachuFollower.y]).toEqual([host.player.x + 16, host.player.y]);
});
