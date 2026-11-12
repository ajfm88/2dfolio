// V4 checkpoint-04: a trainer that spots the player at a ledge hop's midpoint (pass 9).
// notes/89-v4-plan.md §15. The cartridge: MoveSprite_ zeroes the pending simulated press
// (nonadjacent only), the jump table runs on its own clock, and the next zero-counter read
// exhausts the simulation and clears wJoyIgnore.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerWalk, HOP_Y_OFFSETS, STEP_PX } from './walk_pace';
import type { StepCheck } from './walk_pace';
import { host, world, tick, until, frameNow, loadMainBattleRig, resetMainBattleRig } from '../test/main_battle_rig';
import { pinOverworldRandom } from '../test/overworld_random_pin';
import { updateSprites } from './sprites';
import { sightOf } from './map_trainers';
import { trainerEngages } from './trainer_sight';
import { joyIgnore } from '../input/joy_ignore';
import type { Npc } from './npc';
import type { Direction, GameButton } from '../core';

beforeAll(() => loadMainBattleRig());
beforeEach(() => { resetMainBattleRig(); pinOverworldRandom(255); });
afterEach(() => vi.restoreAllMocks());

const noop = (): void => {};

// ── PlayerWalk on its own: the cursor, the jump clock and the landing ───────────

interface Row {
  p: number; dy: number; moving: boolean; progress: number; offset: number; simulating: boolean;
  exhausted: boolean; busy: boolean; ledge: boolean; follow: boolean; landing: boolean; landed: boolean;
}

/** Arm a hop, then run passes the way main.ts does (prepare, boundary, pass). `zeroAt` zeroes the
 *  pending press on that pass's boundary; `physical(p)` is what the pad reports from pass `from`. */
function run(
  opts: { zeroAt?: number; physical?: (p: number) => Direction | null; check?: () => StepCheck; passes?: number } = {},
): { walk: PlayerWalk; rows: Row[] } {
  const walk = new PlayerWalk();
  walk.pass('down', true, () => 'hop', noop);
  const rows: Row[] = [];
  for (let p = 1; p <= (opts.passes ?? 20); p++) {
    walk.preparePass();
    if (p === opts.zeroAt && walk.mapScriptBoundary) walk.zeroPendingSimulatedPress();
    const before = walk.simulating;
    walk.pass(opts.physical?.(p) ?? null, false, opts.check ?? (() => 'walk'), noop);
    rows.push({
      p, dy: walk.dy, moving: walk.moving, progress: walk.progress, offset: walk.hopOffset,
      simulating: before, exhausted: walk.simExhausted, busy: walk.busy, ledge: walk.ledge,
      follow: walk.startedFollowStep, landing: walk.landingPending, landed: walk.landedPass,
    });
  }
  return { walk, rows };
}

describe('PlayerWalk: the ledge presses and the jump clock', () => {
  it('an uninterrupted hop is two 16 px halves, one landing pass, and the table 0-15 once each', () => {
    const { rows } = run();
    expect(rows.slice(0, 16).map(r => r.dy)).toEqual(Array(16).fill(2));
    expect(rows.slice(0, 16).map(r => r.offset)).toEqual([...HOP_Y_OFFSETS.slice(0, 15), 0]);
    expect(rows.filter(r => r.follow).map(r => r.p)).toEqual([1, 9]);
    expect(rows[15].landing).toBe(true);
    expect(rows[16].landed).toBe(true);
    expect(rows[16].ledge).toBe(true);
    expect(rows[17].ledge).toBe(false);
    expect(rows.filter(r => r.exhausted)).toEqual([]);
  });

  it('a zero entry at the midpoint: no second half, no follow command, and the zero is not yet the end', () => {
    const { rows } = run({ zeroAt: 9 });
    const nine = rows[8];
    expect([nine.dy, nine.moving, nine.progress, nine.follow]).toEqual([0, false, STEP_PX, false]);
    // pass 9 consumed the zero entry (index 1 to 0): still simulating, exhaustion is the next read
    expect([nine.simulating, nine.exhausted, nine.busy, nine.offset]).toEqual([true, false, true, HOP_Y_OFFSETS[8]]);
    const ten = rows[9];
    expect([ten.simulating, ten.exhausted, ten.busy, ten.dy]).toEqual([true, true, false, 0]);
    expect(rows.slice(10, 15).every(r => !r.simulating && !r.exhausted && !r.busy && r.ledge)).toBe(true);
    // pass 16 is _HandleMidJump's cp $10 pass: with the walk counter at zero since pass 8, the landing runs now
    expect([rows[15].landed, rows[15].busy]).toEqual([true, false]);
    expect(rows.filter(r => r.follow).map(r => r.p)).toEqual([1]);
  });

  it('the idle interrupted arc keeps its own clock: the table, then a landing on pass 16 at +16 px', () => {
    const { rows, walk } = run({ zeroAt: 9 });
    expect(rows.slice(8, 16).map(r => r.offset)).toEqual([...HOP_Y_OFFSETS.slice(8, 15), 0]);
    expect(rows.slice(0, 8).map(r => r.dy)).toEqual(Array(8).fill(2));
    expect(rows.slice(8).every(r => r.dy === 0)).toBe(true);
    expect(rows[15].landed).toBe(true);
    expect([rows[15].offset, rows[15].ledge, rows[16].ledge]).toEqual([0, true, false]);
    expect(walk.progress).toBe(STEP_PX);
  });

  it('a held direction starts a physical step on pass 11 even into a wall, keeps the flag, and lands on pass 19', () => {
    const { rows } = run({ zeroAt: 9, physical: p => (p >= 9 && p <= 11 ? 'down' : null), check: () => 'blocked', passes: 22 });
    // passes 9 and 10 still ignore the pad (zero entry, then the exhaustion read)
    expect(rows.slice(8, 10).map(r => r.dy)).toEqual([0, 0]);
    const eleven = rows[10];
    expect([eleven.dy, eleven.moving, eleven.follow, eleven.ledge, eleven.progress]).toEqual([2, true, true, true, 2]);
    expect(rows.slice(10, 18).map(r => r.dy)).toEqual(Array(8).fill(2));
    // the jump table finished on pass 16 and holds its last Y; the walk counter reaches zero on pass 18
    expect(rows.slice(10, 17).map(r => r.landing)).toEqual(Array(7).fill(false));
    expect(rows[17].landing).toBe(true);
    expect(rows[18].landed).toBe(true);
    expect(rows.slice(15, 18).map(r => r.offset)).toEqual([0, 0, 0]);
    expect(rows[18].ledge).toBe(true);
    expect(rows[19].ledge).toBe(false);
  });
});

// ── Through main on Route 3: the committed (14,6) DOWN ledge ────────────────────

/** The youngster (sight 3) is the lone trainer, on row 7 of the hop's midpoint, facing the column. */
async function fixture(offset: number, follower = false): Promise<Npc> {
  await world('Route3', 14, 6);
  host.pikachuFollower.visible = follower;
  const npcs = host.overworldDeps().npcs;
  const trainer = npcs.find(n => n.data.id === 'youngster2')!;
  npcs.splice(0, npcs.length, trainer);
  trainer.x = (14 - offset) * 16; trainer.y = 7 * 16; trainer.direction = 'right';
  updateSprites(npcs, host.gameMap, host.player, host.pikachuFollower);
  host.player.direction = 'down';
  // no sight at the source (the trainer is on the next row); sight at the midpoint
  const at = (stepY: number): boolean => {
    const s = sightOf(trainer, { ...host.player, x: 14 * 16, y: stepY * 16 } as typeof host.player, 1);
    return s !== null && trainerEngages(s);
  };
  expect(at(6)).toBe(false);
  expect(at(7)).toBe(true);
  return trainer;
}

const walkOf = (): PlayerWalk => (host.player as unknown as { walk: PlayerWalk }).walk;

/** Hold DOWN until the trainer spots the player at the midpoint. */
function toBubble(): void {
  for (let n = 0; n < 60 && host.state === 'overworld'; n++) tick(['down']);
  expect(host.state).toBe('emotion_bubble');
}

/** Hold DOWN until the bubble appears, then count its frames. */
function spot(): { bubbleFrames: number } {
  toBubble();
  let bubbleFrames = 0;
  while (host.state === 'emotion_bubble') { tick(['down']); bubbleFrames++; }
  return { bubbleFrames };
}

describe('adjacent trainer at the midpoint', () => {
  it('spots at +16 px on jump Y $31, freezes 61 frames, then the second step starts in the return frame', async () => {
    const trainer = await fixture(1);
    toBubble();
    expect([host.player.y, walkOf().hopOffset, host.ow.engagedNpc?.data.id]).toEqual([7 * 16, 0x31 - 0x3c, 'youngster2']);
    const frozen = [host.player.y, walkOf().hopPass, host.player.stepsCompleted];
    let frames = 0;
    while (host.state === 'emotion_bubble') {
      expect([host.player.y, walkOf().hopPass, host.player.stepsCompleted]).toEqual(frozen);
      tick(['down', 'a', 'start']); frames++;
    }
    expect(frames).toBe(61);
    // the return frame: UpdateSprites, no walk-up (adjacent), the mask, then the second half's first 2 px on the same jump entry
    expect([host.player.y, walkOf().hopPass, host.player.isMoving]).toEqual([7 * 16 + 2, 8, true]);
    expect(trainer.movement.scripted).toBe(false);
    expect(trainer.scriptedStepsStarted).toBe(0);
    expect(joyIgnore()).toBe('dpad');
  });

  it('never starts an NPC walk, ends at +32 px, and the text begins after the landing hold even with A and START held', async () => {
    const trainer = await fixture(1);
    spot();
    const passFrames: number[] = [];
    const prepare = host.player.preparePass.bind(host.player);
    vi.spyOn(host.player, 'preparePass').mockImplementation(() => { passFrames.push(frameNow()); prepare(); });
    until(() => host.state === 'textbox', () => ['a', 'start'], 120);
    expect([host.player.y, host.player.mapStepY, host.player.isBusy]).toEqual([9 * 16 - 16, 8, false]);
    expect(trainer.scriptedStepsStarted).toBe(0);
    expect(host.state).toBe('textbox');
    // the landing pass is followed by a 3-frame gap (one landing update, Delay3), then the dispatch that opens the text
    const gaps = passFrames.slice(1).map((f, i) => f - passFrames[i]);
    expect(gaps.slice(-2)).toEqual([2, 3]);
  });
});

describe('nonadjacent trainer at the midpoint', () => {
  it('idle: the zero entry holds +16 px, the next pass releases the mask, the arc lands on pass 16', async () => {
    const trainer = await fixture(3);
    const fh = [] as { f: number; y: number }[];
    toBubble();
    expect([host.player.y, walkOf().hopOffset]).toEqual([7 * 16, -11]);
    while (host.state === 'emotion_bubble') tick();
    // return frame: the walk-up started, the mask is all, no second step, no follow command
    expect([host.player.y, host.player.isMoving, joyIgnore(), walkOf().hopPass, host.player.isBusy]).toEqual([7 * 16, false, 'all', 8, true]);
    expect(trainer.movement.scripted).toBe(true);
    // the next pass: the exhaustion read. wJoyIgnore clears, nothing moves, the jump entry advances
    tick(); tick();
    expect([host.player.y, joyIgnore(), walkOf().hopPass, host.player.isBusy, host.player.ledgeHopFlag]).toEqual([7 * 16, 'none', 9, false, true]);
    const passes: { f: number; hop: number; y: number; landed: boolean }[] = [];
    const update = host.player.update.bind(host.player);
    vi.spyOn(host.player, 'update').mockImplementation((...args) => {
      const r = update(...args);
      passes.push({ f: frameNow(), hop: walkOf().hopPass, y: host.player.y, landed: walkOf().landedPass });
      return r;
    });
    for (let n = 0; n < 40 && passes.length < 8; n++) { tick(); fh.push({ f: frameNow(), y: host.player.y }); }
    expect(passes.map(p => p.y)).toEqual(Array(8).fill(7 * 16));
    expect(passes.map(p => p.hop).slice(0, 6)).toEqual([10, 11, 12, 13, 14, -1]);
    // pass 16 is the landing update (the walk counter has been zero since pass 8); the next pass comes 3 frames later
    expect(passes.map(p => p.landed).slice(0, 7)).toEqual([false, false, false, false, false, true, false]);
    expect(passes[6].f - passes[5].f).toBe(3);
    expect(passes[5].f - passes[4].f).toBe(2);
    expect(host.player.ledgeHopFlag).toBe(false);
  });

  it('idle: the walk-up ends, the text and the battle follow at +16 px', async () => {
    await fixture(3);
    spot();
    until(() => host.state === 'textbox', () => [], 400);
    expect([host.player.y, host.player.mapStepY]).toEqual([7 * 16, 7]);
    until(() => host.state === 'battle', undefined, 3000);
    expect(host.player.y).toBe(7 * 16);
  });

  it('held DOWN over the return: nothing on passes 9 and 10, the first physical 2 px on pass 11, flag intact', async () => {
    const trainer = await fixture(3);
    toBubble();
    while (host.state === 'emotion_bubble') tick(['down']);
    expect(host.player.y).toBe(7 * 16);
    tick(['down']); tick(['down']); // pass 10: the exhaustion read ignores the held pad
    expect([host.player.y, joyIgnore()]).toEqual([7 * 16, 'none']);
    expect(trainer.movement.scripted).toBe(true);
    tick(['down']); tick(['down']); // pass 11
    expect([host.player.y, host.player.isMoving, host.player.ledgeHopFlag, host.player.justCollided]).toEqual([7 * 16 + 2, true, true, false]);
    expect(trainer.movement.scripted).toBe(true);
    // the step counts as a physical one; the hop's last Y holds until it ends
    let finishedSimulated: boolean | null = null;
    for (let n = 0; n < 60 && host.player.isMoving; n++) {
      tick();
      if (host.player.justFinishedStep) finishedSimulated = host.player.stepWasSimulated;
    }
    expect(finishedSimulated).toBe(false);
    expect([host.player.y, walkOf().hopOffset]).toEqual([8 * 16, 0]);
    until(() => host.state === 'textbox', () => [], 400);
    until(() => host.state === 'battle', undefined, 3000);
  });

  it('the flag skips ledge collision: a held direction into a wall still starts the step', async () => {
    await fixture(3);
    toBubble();
    while (host.state === 'emotion_bubble') tick();
    const x = host.player.tileX, y = host.player.tileY;
    const dir = (['left', 'right'] as const).find(d => !host.gameMap.isWalkable(x + (d === 'left' ? -2 : 2), y))
      ?? 'right';
    tick(); tick();
    for (let n = 0; n < 6 && !host.player.isMoving; n++) tick([dir]);
    expect(host.player.isMoving).toBe(true);
    expect(host.player.justCollided).toBe(false);
  });

  it('the follow command: one at the hop start, none at the midpoint, one on the real step from pass 11', async () => {
    await fixture(3, true);
    host.pikachuFollower.spawn(host.player.x, host.player.y - 16, 'down');
    const starts: { f: number; ledge: boolean }[] = [];
    const real = host.pikachuFollower.playerStepStarted.bind(host.pikachuFollower);
    vi.spyOn(host.pikachuFollower, 'playerStepStarted').mockImplementation((dir, ledge) => {
      starts.push({ f: frameNow(), ledge }); return real(dir, ledge);
    });
    toBubble();
    const bubbleStart = frameNow();
    while (host.state === 'emotion_bubble') tick(['down']);
    const returned = frameNow();
    for (let n = 0; n < 6; n++) tick(['down']);
    expect(starts).toHaveLength(2);
    // the second is pass 11: two passes (four frames) after the return frame, not on the return frame
    expect(starts[1].f - returned).toBe(4);
    expect(starts[1].ledge).toBe(true);
    expect(starts[0].f).toBeLessThan(bubbleStart);
  });
});

describe('input masking and cleanup', () => {
  async function plainHop(): Promise<void> {
    await world('Route3', 14, 6);
    host.pikachuFollower.visible = false;
    host.overworldDeps().npcs.splice(0);
    host.player.direction = 'down';
  }
  let steps0 = 0;
  const midpointPassReached = (): boolean => host.player.stepsCompleted >= steps0 + 1 && host.player.isMoving;

  it('START held from the midpoint read through landing has no fresh edge; a press after that read opens the menu', async () => {
    await plainHop(); steps0 = host.player.stepsCompleted;
    until(midpointPassReached, () => ['down'], 60);
    for (let n = 0; n < 80 && host.state !== 'start_menu'; n++) tick(n < 40 ? ['start'] : []);
    expect(host.state).toBe('overworld');
    // a fresh press after the last simulated read opens it at the first eligible read
    await plainHop(); steps0 = host.player.stepsCompleted;
    until(midpointPassReached, () => ['down'], 60);
    for (let n = 0; n < 4; n++) tick();
    expect(host.player.y).toBeGreaterThan(7 * 16);
    for (let n = 0; n < 60 && host.state !== 'start_menu'; n++) tick(['start']);
    expect(host.state).toBe('start_menu');
  });

  it('START and A pressed after the spotting open nothing', async () => {
    await fixture(3);
    spot();
    for (let n = 0; n < 40; n++) {
      const keys: GameButton[] = n % 8 < 4 ? ['start', 'a'] : [];
      tick(keys);
      expect(host.state).not.toBe('start_menu');
      if (host.state !== 'overworld') break;
    }
    expect(host.ow.seenByTrainer).toBe(true);
  });

  it.each(['armed', 'moving', 'interrupted'] as const)('a warp while %s leaves no press, shadow or joy lock', async stage => {
    await fixture(3);
    if (stage === 'armed') until(() => walkOf().busy && !host.player.isMoving, () => ['down'], 20);
    if (stage === 'moving') until(() => host.player.isMoving, () => ['down'], 20);
    if (stage === 'interrupted') { spot(); tick(); tick(); }
    await world('Route1', 5, 5);
    expect([host.player.isBusy, host.player.ledgeHopFlag, host.player.isLanding, joyIgnore()]).toEqual([false, false, false, 'none']);
    const before = host.player.y;
    for (let n = 0; n < 6; n++) tick(['down']);
    expect(host.player.y).toBeGreaterThan(before);
  });
});

describe('ticks the existing trainer paths still take', () => {
  it('a standing trainer (source sight) still engages at the source, not the midpoint', async () => {
    await world('Route3', 14, 6);
    host.pikachuFollower.visible = false;
    host.player.direction = 'down';
    for (let f = 0; f < 8 && host.state === 'overworld'; f++) tick(['down']);
    expect(host.state).toBe('emotion_bubble');
    expect([host.player.mapStepX, host.player.mapStepY, host.player.isBusy]).toEqual([14, 6, false]);
  });
});

describe('review regressions (note 89 section 17)', () => {
  it('the idle interrupted hop lands on pass 16, and a direction first supplied there waits for the landing', () => {
    const lands = (physical16: Direction | null): { landedOn: number; moved: number } => {
      const w = new PlayerWalk();
      w.pass('down', true, () => 'hop', noop);
      let landedOn = 0, moved = 0;
      for (let p = 1; p <= 17; p++) {
        w.preparePass();
        if (p === 9) w.zeroPendingSimulatedPress();
        w.pass(p === 16 ? physical16 : null, false, () => 'walk', noop);
        if (w.landedPass && !landedOn) landedOn = p;
        if (p === 16) moved = Math.abs(w.dx) + Math.abs(w.dy);
      }
      return { landedOn, moved };
    };
    expect(lands(null).landedOn).toBe(16);
    expect(lands('down')).toEqual({ landedOn: 16, moved: 0 });
  });

  it('live: the idle landing begins fourteen frames after resuming pass 9', async () => {
    await fixture(3);
    toBubble();
    while (host.state === 'emotion_bubble') tick();
    expect(host.state).toBe('overworld');
    for (let n = 0; n < 13; n++) { tick(); expect(walkOf().landedPass).toBe(false); }
    tick();
    expect(walkOf().landedPass).toBe(true);
    expect(host.player.y).toBe(7 * 16);
  });

  it('START suppressed by trainer sight still gives the next pass its own jump tick', async () => {
    await fixture(3);
    toBubble();
    while (host.state === 'emotion_bubble') tick();
    tick(); tick(); // pass 10: the exhaustion read
    expect(joyIgnore()).toBe('none');
    tick(['start']); tick(['start']); // pass 11: seenStartPressed returns before PlayerWalk.pass()
    expect(host.state).toBe('overworld');
    expect(walkOf().hopPass).toBe(10);
    tick(); tick(); // pass 12 prepares afresh
    expect(walkOf().hopPass).toBe(11);
  });
});
