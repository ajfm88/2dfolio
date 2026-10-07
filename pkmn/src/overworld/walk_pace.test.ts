// A6a: the overworld's pace per the ASM (walk_pace.ts, DECISIONS #36)

import { describe, it, expect, vi } from 'vitest';
import type { Direction } from '../core';
import {
  PassClock, WalkAnim, walkFrame, pikachuAnimPeriod, HOP_Y_OFFSETS, HOP_LANDING_FRAMES,
  npcRestPasses, PlayerWalk, NpcWalk, FRAMES_PER_PASS, npcDirection, npcDisplacement,
} from './walk_pace';
import type { StepCheck, NpcPassContext } from './walk_pace';

const walk = (): StepCheck => 'walk';
const noop = (): void => {};

/** Run passes until `done`, returning how many it took. */
function passesUntil(step: () => void, done: () => boolean, limit = 1000): number {
  let n = 0;
  while (!done()) {
    step();
    n++;
    if (n > limit) throw new Error('did not finish');
  }
  return n;
}

const npcCtx = (over: Partial<NpcPassContext> = {}): NpcPassContext => ({
  playerWalking: false,
  random: () => 5,
  canWalk: () => true,
  ...over,
});

describe('PassClock', () => {
  it('runs a pass on every second frame', () => {
    const clock = new PassClock();
    const ticks = Array.from({ length: 6 }, () => clock.tick());
    expect(ticks).toEqual([false, true, false, true, false, true]);
    expect(FRAMES_PER_PASS).toBe(2);
  });

  it('reset: the next pass is two frames away (jp OverworldLoop)', () => {
    const clock = new PassClock();
    clock.tick();
    clock.reset();
    expect([clock.tick(), clock.tick()]).toEqual([false, true]);
  });

  it('delay holds the next pass back (Delay3 after a hop)', () => {
    const clock = new PassClock();
    clock.tick();
    expect(clock.tick()).toBe(true);
    clock.delay(HOP_LANDING_FRAMES);
    const ticks = Array.from({ length: 5 }, () => clock.tick());
    expect(ticks).toEqual([false, false, false, false, true]);
  });
});

describe('walk animation (Func_5274, facings.asm)', () => {
  it('advances the frame every 4 updates', () => {
    const anim = new WalkAnim();
    const frames: number[] = [];
    for (let i = 0; i < 16; i++) {
      anim.tick();
      frames.push(anim.frame);
    }
    expect(frames).toEqual([0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 0]);
  });

  it('mirrors the second walking frame facing up or down, so the feet alternate', () => {
    expect([0, 1, 2, 3].map(f => walkFrame('down', f))).toEqual([
      { walking: false, mirrored: false },
      { walking: true, mirrored: false },
      { walking: false, mirrored: false },
      { walking: true, mirrored: true },
    ]);
    expect(walkFrame('up', 3).mirrored).toBe(true);
    expect(walkFrame('left', 3)).toEqual({ walking: true, mirrored: false });
    expect(walkFrame('right', 3)).toEqual({ walking: true, mirrored: false });
  });

  it("Pikachu's frame period depends on happiness (GetPikachuWalkingAnimationSpeed)", () => {
    expect(pikachuAnimPeriod(80)).toBe(2);
    expect(pikachuAnimPeriod(255)).toBe(2);
    expect(pikachuAnimPeriod(79)).toBe(5);
    const anim = new WalkAnim();
    for (let i = 0; i < 5; i++) anim.tick(pikachuAnimPeriod(10));
    expect(anim.frame).toBe(1);
  });
});

describe('the player (home/overworld.asm)', () => {
  it('takes 8 passes (16 frames) a step, 2 px each, the first in the start pass', () => {
    const p = new PlayerWalk();
    p.pass('down', true, walk, noop); // simulated: no turning pass
    expect(p.startedStep).toBe(true);
    expect(p.dy).toBe(2);
    let px = 2;
    let passes = 1;
    while (!p.finishedStep) {
      p.pass('down', true, walk, noop);
      px += p.dy;
      passes++;
    }
    expect(passes).toBe(8);
    expect(passes * FRAMES_PER_PASS).toBe(16);
    expect(px).toBe(16);
  });

  it('walks continuously with no gap between steps', () => {
    const p = new PlayerWalk();
    const started: number[] = [];
    for (let i = 0; i < 24; i++) {
      p.pass('down', true, walk, noop);
      if (p.startedStep) started.push(i);
    }
    expect(started).toEqual([0, 8, 16]);
  });

  it('turns for one pass while wCheckFor180DegreeTurn is set, toward a direction other than the last stop', () => {
    const p = new PlayerWalk();
    // A new game has no last stop direction: the first press turns
    p.pass('right', false, walk, noop);
    expect(p.turned).toBe(true);
    expect(p.moving).toBe(false);
    p.pass('right', false, walk, noop);
    expect(p.startedStep).toBe(true);
    passesUntil(() => p.pass('right', false, walk, noop), () => p.finishedStep);
    // Release: the stop records RIGHT
    p.pass(null, false, walk, noop);
    // The same direction walks at once
    p.pass('right', false, walk, noop);
    expect(p.turned).toBe(false);
    expect(p.startedStep).toBe(true);
    passesUntil(() => p.pass('right', false, walk, noop), () => p.finishedStep);
    // That walk started without a turn, so the flag is still set: switching to UP
    // without releasing still takes a turning pass (UP isn't the last stop, RIGHT)
    p.pass('up', false, walk, noop);
    expect(p.turned).toBe(true);
    p.pass('up', false, walk, noop);
    expect(p.startedStep).toBe(true);
    passesUntil(() => p.pass('up', false, walk, noop), () => p.finishedStep);
    // The turn cleared the flag: the next switch walks at once
    p.pass('left', false, walk, noop);
    expect(p.turned).toBe(false);
    expect(p.startedStep).toBe(true);
  });

  it('skips UpdateSprites on the turning pass only', () => {
    const p = new PlayerWalk();
    let calls = 0;
    const count = (): void => { calls++; };
    p.pass('left', false, walk, count); // turn
    expect(calls).toBe(0);
    p.pass('left', false, walk, count); // start
    p.pass('left', false, walk, count); // mid-step
    p.pass(null, false, walk, count);   // ...still mid-step: input ignored
    expect(calls).toBe(3);
  });

  it('shows the new facing from the next UpdateSprites after a turn', () => {
    const p = new PlayerWalk();
    p.facing = 'down';
    p.pass('left', false, walk, noop);
    expect(p.facing).toBe('down');
    p.pass(null, false, walk, noop);
    expect(p.facing).toBe('left');
  });

  it('never turns on simulated input (StartSimulatingJoypadStates)', () => {
    const p = new PlayerWalk();
    p.pass('up', true, walk, noop);
    expect(p.turned).toBe(false);
    expect(p.startedStep).toBe(true);
  });

  it('shows one walking frame per step, mirrored on the next (the feet alternate)', () => {
    const p = new PlayerWalk();
    const frames: number[] = [];
    for (let i = 0; i < 16; i++) {
      p.pass('down', true, walk, noop);
      frames.push(p.anim.frame);
    }
    expect(frames).toEqual([0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 0]);
    expect(frames.slice(0, 8).some(f => walkFrame('down', f).walking && !walkFrame('down', f).mirrored)).toBe(true);
    expect(frames.slice(8).some(f => walkFrame('down', f).mirrored)).toBe(true);
  });

  it('ticks the animation once more on the first idle pass, then resets it', () => {
    const p = new PlayerWalk();
    for (let i = 0; i < 7; i++) p.pass('down', true, walk, noop);
    expect(p.anim.frame).toBe(1);
    p.pass('down', true, walk, noop); // the 8th pass ends the step
    p.pass(null, false, walk, noop);  // still sees the moving direction: ticks
    expect(p.anim.intra + p.anim.frame).toBeGreaterThan(0);
    p.pass(null, false, walk, noop);  // .notMoving
    expect([p.anim.intra, p.anim.frame]).toEqual([0, 0]);
  });

  it('walks in place against a wall: no movement, the animation runs', () => {
    const p = new PlayerWalk();
    const blocked = (): StepCheck => 'blocked';
    p.pass('up', true, blocked, noop);
    expect(p.collided).toBe(true);
    expect(p.moving).toBe(false);
    for (let i = 0; i < 3; i++) p.pass('up', true, blocked, noop);
    expect(p.anim.frame).toBe(1);
  });

  it('hops a ledge: a collision pass, 16 passes over 32 px with the jump table, then lands', () => {
    const p = new PlayerWalk();
    const ledge = (): StepCheck => 'hop';
    p.pass('down', true, ledge, noop);
    expect(p.armedHop).toBe(true);
    expect(p.moving).toBe(false);
    const offsets: number[] = [];
    let px = 0;
    let passes = 0;
    do {
      p.pass(null, false, ledge, noop); // the hop ignores what is held
      offsets.push(p.hopOffset === 0 && !p.moving ? 0 : p.hopOffset);
      px += p.dy;
      passes++;
    } while (!p.landedHop);
    expect(passes).toBe(16);
    expect(px).toBe(32);
    expect(offsets.slice(0, 15)).toEqual(HOP_Y_OFFSETS.slice(0, 15));
    expect(HOP_Y_OFFSETS[0]).toBe(-4);
    expect(Math.min(...HOP_Y_OFFSETS)).toBe(-12);
    expect(HOP_Y_OFFSETS.slice(14)).toEqual([0, 0]);
    expect(p.ledge).toBe(true);
    expect(p.landingPending).toBe(true);
    const before = p.anim.intra;
    const updates = vi.fn();
    const collision = vi.fn(walk);
    p.pass('right', false, collision, updates);
    expect(updates).toHaveBeenCalledOnce();
    expect(collision).not.toHaveBeenCalled();
    expect(p.anim.intra).toBe((before + 1) % 4);
    expect([p.moving, p.landingPending, p.landedPass, p.ledge, p.dx, p.dy]).toEqual([false, false, true, true, 0, 0]);
    p.pass(null, false, walk, noop);
    expect(p.ledge).toBe(false);
  });

  it('reports both follow starts and clears every ledge state on cancel', () => {
    const p = new PlayerWalk();
    p.pass('down', true, () => 'hop', noop);
    const starts: number[] = [];
    for (let i = 1; i <= 9; i++) {
      p.pass(null, false, walk, noop);
      if (p.startedFollowStep) starts.push(i);
    }
    expect(starts).toEqual([1, 9]);
    p.cancel();
    expect([p.busy, p.hopping, p.ledge, p.landingPending, p.startedFollowStep]).toEqual([false, false, false, false, false]);
    p.pass('left', true, walk, noop);
    expect(p.startedFollowStep).toBe(true);
  });
});

describe('the player\'s step vector and Pikachu counter (home/overworld.asm, A6c)', () => {
  it('sets the vector before UpdateSprites, keeps it while walking, clears it standing', () => {
    const p = new PlayerWalk();
    const seen: number[][] = [];
    const spy = (): void => { seen.push([p.vx, p.vy]); };
    p.pass('left', true, walk, spy); // simulated: starts at once
    for (let i = 0; i < 7; i++) p.pass(null, false, walk, spy);
    p.pass(null, false, walk, spy); // standing, nothing pressed
    expect(seen.slice(0, 8).every(([x, y]) => x === -1 && y === 0)).toBe(true);
    expect(seen[8]).toEqual([0, 0]);
  });

  it('a blocked press still sets the vector (a bump is an attempt)', () => {
    const p = new PlayerWalk();
    p.pass('down', true, () => 'blocked', noop);
    expect([p.vx, p.vy]).toEqual([0, 1]);
    expect(p.moving).toBe(false);
  });

  it('an actual turn arms 8; no input or moving clears it; a bump keeps it', () => {
    const p = new PlayerWalk();
    p.pass('up', false, () => 'blocked', noop); // turn
    expect(p.turned).toBe(true);
    expect(p.pikachuCollisionCounter).toBe(8);
    p.pass('up', false, () => 'blocked', noop); // a bump: CollisionCheckOnLand alone
    expect(p.pikachuCollisionCounter).toBe(8);
    p.pass(null, false, walk, noop);
    expect(p.pikachuCollisionCounter).toBe(0);
    p.pass('down', false, walk, noop); // turn again
    expect(p.pikachuCollisionCounter).toBe(8);
    p.pass('down', false, walk, noop); // the step starts (.moveAhead2)
    expect(p.pikachuCollisionCounter).toBe(0);
  });

  it('simulated presses never turn, so never arm the counter', () => {
    const p = new PlayerWalk();
    p.pass('left', true, () => 'blocked', noop);
    expect(p.pikachuCollisionCounter).toBe(0);
  });
});

describe('NPC direction byte (UpdateNPCSprite .determineDirection)', () => {
  it.each([
    [0x00, 'down', 'down', 'left'],
    [0x3f, 'down', 'down', 'left'],
    [0x40, 'up', 'up', 'right'],
    [0x7f, 'up', 'up', 'right'],
    [0x80, 'left', 'up', 'left'],
    [0xbf, 'left', 'up', 'left'],
    [0xc0, 'right', 'down', 'right'],
    [0xff, 'right', 'down', 'right'],
  ] as const)('byte %s: any %s, up_down %s, left_right %s', (byte, any, upDown, leftRight) => {
    expect(npcDirection(byte, 'any')).toBe(any);
    expect(npcDirection(byte, 'none')).toBe(any);
    expect(npcDirection(byte, 'up_down')).toBe(upDown);
    expect(npcDirection(byte, 'left_right')).toBe(leftRight);
  });

  it('a fixed facing wins over the byte', () => {
    for (const byte of [0, 0x40, 0x80, 0xc0]) expect(npcDirection(byte, 'left')).toBe('left');
  });
});

describe('NPC displacement bytes (CanWalkOntoTile, Yellow)', () => {
  it('eight steps up from 8, the ninth fails; back down restores the budget', () => {
    let d: { x: number; y: number } | null = { x: 8, y: 8 };
    for (let i = 0; i < 8; i++) d = npcDisplacement(d!, 'up');
    expect(d).toEqual({ x: 8, y: 0 });
    expect(npcDisplacement(d!, 'up')).toBeNull();
    d = npcDisplacement(d!, 'down');
    expect(npcDisplacement(d!, 'up')).toEqual({ x: 8, y: 0 });
  });

  it('down and right have no limit and wrap 255 → 0; the other axis is untouched', () => {
    expect(npcDisplacement({ x: 20, y: 30 }, 'right')).toEqual({ x: 21, y: 30 });
    expect(npcDisplacement({ x: 255, y: 0 }, 'right')).toEqual({ x: 0, y: 0 });
    expect(npcDisplacement({ x: 0, y: 255 }, 'down')).toEqual({ x: 0, y: 0 });
    // A zero X byte doesn't stop vertical steps
    expect(npcDisplacement({ x: 0, y: 3 }, 'up')).toEqual({ x: 0, y: 2 });
    expect(npcDisplacement({ x: 0, y: 3 }, 'left')).toBeNull();
  });
});

describe('NPCs (engine/overworld/movement.asm)', () => {
  const plan = (dirs: Direction[], mode: 'normal' | 'fast' = 'normal') => dirs.map(dir => ({ dir, mode }));
  /** A byte stream that records how many bytes were drawn. */
  const bytes = (...values: number[]) => {
    const fn = Object.assign(() => {
      fn.drawn++;
      return values.length > 1 ? values.shift()! : values[0];
    }, { drawn: 0 });
    return fn;
  };

  it('init: ready with displacement 8/8, no try and no random byte', () => {
    const n = new NpcWalk('down', 'walk', 'any');
    const random = bytes(0);
    n.pass(npcCtx({ random }));
    expect(n.status).toBe('ready');
    expect([n.dispX, n.dispY]).toEqual([8, 8]);
    expect(random.drawn).toBe(0);
    expect(n.startedStep).toBe(false);
  });

  it('a fixed-facing STAY sprite draws both bytes and keeps the talk facing until its next try', () => {
    const n = new NpcWalk('up', 'stay', 'up');
    const random = bytes(0x80, 3); // direction byte (ignored), then the delay
    const ctx = npcCtx({ random });
    n.pass(ctx); // InitializeSpriteStatus
    n.pass(ctx); // TryWalking: fixed UP, blocked because STAY
    expect(random.drawn).toBe(2);
    expect(n.status).toBe('resting');
    expect(n.delay).toBe(3);
    n.facing = 'left'; // MakeNPCFacePlayer
    for (let i = 0; i < 3; i++) {
      n.pass(ctx);
      expect(n.facing).toBe('left');
      expect(n.startedStep).toBe(false);
    }
    expect(n.status).toBe('ready'); // reaching zero only makes it ready
    n.pass(npcCtx({ playerWalking: true }));
    expect(n.facing).toBe('left');
    n.pass(ctx);
    expect(n.facing).toBe('up');
    expect(n.status).toBe('resting');
    expect([n.dx, n.dy]).toEqual([0, 0]);
  });

  it.each([[1, 1], [0x7f, 127], [0x80, 256], [0xff, 127], [0, 256]])(
    'a raw delay byte %i waits %i updates, then the try comes on a later update',
    (raw, waits) => {
      const n = new NpcWalk('up', 'stay', 'up');
      n.pass(npcCtx()); // init
      n.pass(npcCtx({ random: bytes(0, raw) }));
      n.facing = 'right';
      for (let i = 0; i < waits - 1; i++) { n.pass(npcCtx()); expect(n.status).toBe('resting'); }
      n.pass(npcCtx());
      expect(n.status).toBe('ready');
      expect(n.facing).toBe('right');
      n.pass(npcCtx({ random: bytes(0, 5) }));
      expect(n.facing).toBe('up');
    },
  );

  it('a NONE-facing STAY sprite turns in place at random', () => {
    const n = new NpcWalk('down', 'stay', 'none');
    const canWalk = vi.fn(() => true);
    n.pass(npcCtx({ canWalk })); // init
    n.pass(npcCtx({ random: bytes(0x80, 2), canWalk }));
    expect(n.facing).toBe('left');
    expect(n.startedStep).toBe(false);
    n.pass(npcCtx({ canWalk }));
    n.pass(npcCtx({ canWalk }));
    n.pass(npcCtx({ random: bytes(0xc0, 9), canWalk }));
    expect(n.facing).toBe('right');
    expect(n.delay).toBe(9);
    expect([n.dx, n.dy, n.vx, n.vy]).toEqual([0, 0, 0, 0]);
    expect(n.startedStep).toBe(false);
    expect(canWalk).not.toHaveBeenCalled(); // STAY never translates
    expect([n.dispX, n.dispY]).toEqual([8, 8]);
  });

  it('a try faces its way and sets the step vector before CanWalkOntoTile decides', () => {
    const n = new NpcWalk('down', 'walk', 'any');
    n.pass(npcCtx()); // init
    const seen: number[][] = [];
    n.pass(npcCtx({
      random: bytes(0x40, 0x10),
      canWalk: () => { seen.push([n.vx, n.vy]); return false; },
    }));
    expect(seen).toEqual([[0, -1]]);
    expect(n.facing).toBe('up'); // a blocked wanderer visibly turns
    expect([n.vx, n.vy]).toEqual([0, 0]);
    expect(n.status).toBe('resting');
    expect(n.delay).toBe(0x10);
  });

  it('a blocked try commits no displacement; a successful one does', () => {
    const n = new NpcWalk('down', 'walk', 'any');
    n.pass(npcCtx());
    n.pass(npcCtx({ random: bytes(0x80, 1), canWalk: () => false }));
    expect([n.dispX, n.dispY]).toEqual([8, 8]);
    n.pass(npcCtx()); // rest 1 → ready
    n.pass(npcCtx({ random: bytes(0x80) }));
    expect(n.startedStep).toBe(true);
    expect([n.dispX, n.dispY]).toEqual([7, 8]);
  });

  it('wanders left eight times from its start, then the displacement byte stops it', () => {
    const n = new NpcWalk('down', 'walk', 'left_right');
    n.pass(npcCtx());
    const random = bytes(0x00, 1); // left, then a 1-update rest
    let steps = 0;
    for (let i = 0; i < 400; i++) {
      n.pass(npcCtx({ random }));
      if (n.startedStep) steps++;
    }
    expect(steps).toBe(8);
    expect(n.dispX).toBe(0);
    expect(n.facing).toBe('left');
  });

  it('an ordinary step draws its rest on the last pixel and clears its vector', () => {
    const n = new NpcWalk('down', 'walk', 'any');
    n.pass(npcCtx());
    const random = bytes(0x00, 0x22);
    n.pass(npcCtx({ random }));
    expect(random.drawn).toBe(1);
    for (let i = 0; i < 15; i++) n.pass(npcCtx({ random }));
    expect(random.drawn).toBe(1);
    expect([n.vx, n.vy]).toEqual([0, 1]);
    n.pass(npcCtx({ random }));
    expect(random.drawn).toBe(2);
    expect(n.delay).toBe(0x22);
    expect([n.vx, n.vy]).toEqual([0, 0]);
    expect(n.dispY).toBe(9);
  });

  it('ready tries wait for the player to stand; rests and steps under way do not', () => {
    const n = new NpcWalk('down', 'walk', 'any');
    n.pass(npcCtx());
    const random = bytes(0x00, 3);
    n.pass(npcCtx({ playerWalking: true, random }));
    expect(random.drawn).toBe(0);
    n.pass(npcCtx({ random }));
    expect(n.startedStep).toBe(true);
    for (let i = 0; i < 16; i++) n.pass(npcCtx({ playerWalking: true, random }));
    expect(n.status).toBe('resting');
    for (let i = 0; i < 3; i++) n.pass(npcCtx({ playerWalking: true, random }));
    expect(n.status).toBe('ready');
  });

  it('a normal scripted step: a start pass, then 16 × 1 px (34 frames a step)', () => {
    const n = new NpcWalk('up', 'stay', 'none');
    n.startScript(plan(['up', 'up']));
    const moves: number[] = [];
    const passes = passesUntil(() => { n.pass(npcCtx()); moves.push(n.dy); }, () => n.scriptDone);
    // 1 lead-in pass, 17 per step, 1 pass reading the terminator
    expect(passes).toBe(1 + 17 * 2 + 1);
    expect(moves.reduce((a, b) => a + b, 0)).toBe(-32);
    expect(moves.filter(d => d !== 0).every(d => d === -1)).toBe(true);
    expect(17 * FRAMES_PER_PASS).toBe(34);
  });

  it("Yellow's fast codes ($04–$07): a start pass, then 8 × 2 px (18 frames a step)", () => {
    const n = new NpcWalk('down', 'stay', 'none');
    n.startScript(plan(['right', 'right'], 'fast'));
    const moves: number[] = [];
    const passes = passesUntil(() => { n.pass(npcCtx()); moves.push(n.dx); }, () => n.scriptDone);
    expect(passes).toBe(1 + 9 * 2 + 1);
    expect(moves.filter(d => d !== 0).every(d => d === 2)).toBe(true);
    expect(moves.reduce((a, b) => a + b, 0)).toBe(32);
  });

  it('mixes modes step by step (the Oak\'s Lab rival exit: 2 normal, then fast)', () => {
    const n = new NpcWalk('down', 'stay', 'none');
    n.startScript([{ dir: 'left', mode: 'normal' }, { dir: 'down', mode: 'normal' }, { dir: 'down', mode: 'fast' }]);
    const passes = passesUntil(() => n.pass(npcCtx()), () => n.scriptDone);
    expect(passes).toBe(1 + 17 + 17 + 9 + 1);
  });

  it('scripted steps draw no random byte, keep their vector and leave the displacement', () => {
    const n = new NpcWalk('down', 'walk', 'any');
    n.pass(npcCtx()); // init
    const random = bytes(0x40, 7);
    n.startScript(plan(['left', 'left']));
    passesUntil(() => n.pass(npcCtx({ random })), () => n.scriptDone);
    expect(random.drawn).toBe(0); // nor at the terminator
    expect([n.dispX, n.dispY]).toEqual([8, 8]);
    expect([n.vx, n.vy]).toEqual([-1, 0]);
    // The terminator made it STAY and left it ready: the next ordinary update is a try
    expect(n.wanders).toBe(false);
    expect(n.status).toBe('ready');
    n.pass(npcCtx({ random }));
    expect(random.drawn).toBe(2);
    expect(n.facing).toBe('up');
    expect(n.status).toBe('resting');
    expect(n.startedStep).toBe(false);
  });

  it('the terminator waits for the player to stand, like any ready update', () => {
    const n = new NpcWalk('up', 'stay', 'none');
    n.startScript(plan(['up']));
    for (let i = 0; i < 18; i++) n.pass(npcCtx());
    n.pass(npcCtx({ playerWalking: true }));
    expect(n.scriptDone).toBe(false);
    n.pass(npcCtx());
    expect(n.scriptDone).toBe(true);
  });

  it("can't start a step while the player is mid-step", () => {
    const n = new NpcWalk('up', 'stay', 'none');
    n.startScript(plan(['up']));
    n.pass(npcCtx()); // lead-in
    n.pass(npcCtx({ playerWalking: true }));
    expect(n.startedStep).toBe(false);
    n.pass(npcCtx());
    expect(n.startedStep).toBe(true);
    // Once under way it keeps moving whatever the player does
    n.pass(npcCtx({ playerWalking: true }));
    expect(n.dy).toBe(-1);
  });

  it('shows all four animation frames within one normal step', () => {
    const n = new NpcWalk('down', 'stay', 'none');
    n.startScript(plan(['down']));
    n.pass(npcCtx()); // lead-in
    n.pass(npcCtx()); // start
    const frames = new Set<number>();
    for (let i = 0; i < 16; i++) {
      n.pass(npcCtx());
      frames.add(n.displayFrame);
    }
    expect([...frames].sort()).toEqual([0, 1, 2, 3]);
  });

  it('walks in step with the player (DoScriptedNPCMovement): init, then 8 × 2 px a step', () => {
    const n = new NpcWalk('down', 'stay', 'none');
    n.startInStep(['down', 'down', 'left']);
    n.pass(npcCtx({ playerWalking: true })); // InitScriptedNPCMovement
    expect(n.dy).toBe(0);
    let moved = 0;
    const passes = passesUntil(() => {
      n.pass(npcCtx({ playerWalking: true })); // never waits for the player
      moved += Math.abs(n.dx) + Math.abs(n.dy);
    }, () => n.scriptDone);
    expect(passes).toBe(8 * 3 + 1);
    expect(moved).toBe(48);
    // UpdateNonPlayerSprite keeps routing it to DoScriptedNPCMovement: it holds
    const facing = n.facing;
    for (let i = 0; i < 300; i++) n.pass(npcCtx({ random: () => 0xc0 }));
    expect(n.facing).toBe(facing);
  });

  it('walking in step, the legs move at the player\'s rate: a new frame every 4 passes', () => {
    const n = new NpcWalk('down', 'stay', 'none');
    n.startInStep(['down', 'down']);
    const frames: number[] = [];
    for (let i = 0; i < 9; i++) {
      n.pass(npcCtx());
      frames.push(n.displayFrame);
    }
    // The init pass ticks too, so the first change comes on the 4th update
    expect(frames).toEqual([0, 0, 0, 1, 1, 1, 1, 2, 2]);
  });

  it('npcRestPasses: reachable rests are 1–127 or 256', () => {
    expect(npcRestPasses(1)).toBe(1);
    expect(npcRestPasses(0x7f)).toBe(127);
    expect(npcRestPasses(0)).toBe(256);
    expect(npcRestPasses(0x80)).toBe(256);
    expect(npcRestPasses(0xff)).toBe(127);
  });

  it('SetSpriteMovementBytesToFF: STAY/NONE, without touching facing, status or delay', () => {
    const n = new NpcWalk('left', 'stay', 'left');
    n.pass(npcCtx());
    n.pass(npcCtx({ random: bytes(0, 40) }));
    n.stayAndFaceAnyDirection();
    expect([n.movement1, n.movement2]).toEqual(['stay', 'none']);
    expect([n.facing, n.status, n.delay]).toEqual(['left', 'resting', 40]);
    for (let i = 0; i < 40; i++) n.pass(npcCtx());
    n.pass(npcCtx({ random: bytes(0x40, 1) }));
    expect(n.facing).toBe('up');
  });
});
