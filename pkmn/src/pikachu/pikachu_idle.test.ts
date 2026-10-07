// A6c: Pikachu's idle glances and antics (pikachu_follow.asm Func_fc803 and statuses 6–9)

import { describe, it, expect } from 'vitest';
import type { Direction } from '../core';
import { WalkAnim } from '../overworld/walk_pace';
import {
  PikachuIdle, BOUNCE_OFFSETS, ANTIC_UPDATES, followCommandFor, commandFacing, seedFollowCommand,
  followEndFacing,
} from './pikachu_idle';
import type { PikachuIdleContext } from './pikachu_idle';

/** A byte stream that counts its draws. */
function bytes(...values: number[]) {
  const fn = Object.assign(() => {
    fn.drawn++;
    return values.length > 1 ? values.shift()! : values[0];
  }, { drawn: 0 });
  return fn;
}

const sprite = (facing: Direction = 'down') => ({ facing, anim: new WalkAnim() });
const ctx = (over: Partial<PikachuIdleContext> = {}): PikachuIdleContext => ({
  playerWalking: false, overlapsPlayer: false, followCommand: 1, random: bytes(0), ...over,
});

describe('follow command bytes', () => {
  it('a step appends 1–4 (down, up, left, right); a ledge hop 5–8', () => {
    expect((['down', 'up', 'left', 'right'] as const).map(d => followCommandFor(d, false))).toEqual([1, 2, 3, 4]);
    expect((['down', 'up', 'left', 'right'] as const).map(d => followCommandFor(d, true))).toEqual([5, 6, 7, 8]);
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(commandFacing)).toEqual(
      ['down', 'up', 'left', 'right', 'down', 'up', 'left', 'right']);
  });

  it('the spawn seed points toward the player, Y first, two-step from 2 away, none on top', () => {
    expect(seedFollowCommand({ x: 5, y: 4 }, { x: 5, y: 5 })).toBe(1); // above: move down
    expect(seedFollowCommand({ x: 5, y: 6 }, { x: 5, y: 5 })).toBe(2);
    expect(seedFollowCommand({ x: 6, y: 5 }, { x: 5, y: 5 })).toBe(3);
    expect(seedFollowCommand({ x: 4, y: 5 }, { x: 5, y: 5 })).toBe(4);
    expect(seedFollowCommand({ x: 5, y: 3 }, { x: 5, y: 5 })).toBe(5);
    expect(seedFollowCommand({ x: 7, y: 5 }, { x: 5, y: 5 })).toBe(7);
    expect(seedFollowCommand({ x: 9, y: 6 }, { x: 5, y: 5 })).toBe(2); // Y wins
    expect(seedFollowCommand({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });

  it('a finished move faces the newest command while moves remain, else the player', () => {
    const pika = { x: 5, y: 5 };
    expect(followEndFacing(true, 4, pika, { x: 5, y: 4 }, 'left')).toBe('right');
    expect(followEndFacing(false, 4, pika, { x: 5, y: 4 }, 'left')).toBe('up');
    expect(followEndFacing(false, 4, pika, { x: 5, y: 6 }, 'left')).toBe('down');
    expect(followEndFacing(false, 4, pika, { x: 7, y: 5 }, 'left')).toBe('right');
    expect(followEndFacing(false, 4, pika, { x: 3, y: 5 }, 'left')).toBe('left');
    expect(followEndFacing(false, 4, pika, pika, 'up')).toBe('up');
  });
});

describe('idle (Func_fc803)', () => {
  it('a zero countdown wraps: the first glance takes 256 updates, then every 32', () => {
    const idle = new PikachuIdle();
    const s = sprite();
    const random = bytes(0x0c, 0x04);
    for (let i = 0; i < 255; i++) expect(idle.idle(s, ctx({ random }))).toBe('refresh');
    expect(random.drawn).toBe(0);
    expect(s.facing).toBe('down');
    idle.idle(s, ctx({ random }));
    expect(random.drawn).toBe(1);
    expect(s.facing).toBe('right'); // $0c
    expect(idle.counter).toBe(0x20);
    for (let i = 0; i < 31; i++) idle.idle(s, ctx({ random }));
    expect(random.drawn).toBe(1);
    idle.idle(s, ctx({ random }));
    expect(s.facing).toBe('up'); // $04
  });

  it.each([[0x00, 'down'], [0x04, 'up'], [0x08, 'left'], [0x0c, 'right'], [0xf3, 'down'], [0xfe, 'right']] as const)(
    'byte %i & $0c faces %s', (byte, facing) => {
      const idle = new PikachuIdle();
      idle.counter = 1;
      const s = sprite('left');
      idle.idle(s, ctx({ random: bytes(byte) }));
      expect(s.facing).toBe(facing);
    });

  it('each idle update resets the animation counters', () => {
    const idle = new PikachuIdle();
    const s = sprite();
    s.anim.intra = 3;
    s.anim.frame = 2;
    idle.idle(s, ctx());
    expect([s.anim.intra, s.anim.frame]).toEqual([0, 0]);
  });

  it("on the player's map position: hidden, nothing counted, no byte drawn", () => {
    const idle = new PikachuIdle();
    idle.counter = 1;
    const random = bytes(0);
    expect(idle.idle(sprite(), ctx({ overlapsPlayer: true, random }))).toBe('hidden');
    expect(idle.counter).toBe(1);
    expect(random.drawn).toBe(0);
  });

  it.each([[0, 'bounce'], [1, 'walkInPlace'], [2, 'shuffle'], [3, 'spin'], [0xff, 'spin']] as const)(
    'a retained two-step command: byte %i & 3 starts %s, with its first update now', (byte, antic) => {
      const idle = new PikachuIdle();
      idle.counter = 1;
      const random = bytes(byte);
      idle.idle(sprite(), ctx({ followCommand: 6, random }));
      expect(idle.antic).toBe(antic);
      expect(random.drawn).toBe(1);
      expect(idle.counter).toBe(ANTIC_UPDATES[antic] - 1);
    });
});

describe('the antics', () => {
  /** Start an antic (by its byte) and run it to the end, counting updates. */
  function runAntic(byte: number, s = sprite(), command = 5) {
    const idle = new PikachuIdle();
    idle.counter = 1;
    const log: { facing: Direction; frame: number; off: [number, number]; image: string }[] = [];
    let image = idle.idle(s, ctx({ followCommand: command, random: bytes(byte) }));
    log.push({ facing: s.facing, frame: s.anim.frame, off: [idle.offsetY, idle.offsetX], image });
    while (idle.antic) {
      image = idle.anticUpdate(s, ctx());
      log.push({ facing: s.facing, frame: s.anim.frame, off: [idle.offsetY, idle.offsetX], image });
    }
    return { idle, log };
  }

  it('durations including the entry update: 17, 48, 32, 32; then a countdown of 16', () => {
    expect([0, 1, 2, 3].map(b => runAntic(b).log.length)).toEqual([17, 48, 32, 32]);
    expect(runAntic(2).idle.counter).toBe(16);
  });

  it('the bounce reads Pointer_fc8d6 backward as (Y, X), faces the command, keeps its image', () => {
    const { log, idle } = runAntic(0, sprite('left'), 8);
    expect(log.map(l => l.off)).toEqual([...BOUNCE_OFFSETS].reverse());
    expect(log[1].off).toEqual([-2, -1]); // the negative X side first
    expect(log.every(l => l.facing === 'right')).toBe(true);
    expect(log.every(l => l.image === 'latched')).toBe(true);
    expect([idle.offsetY, idle.offsetX]).toEqual([0, 0]);
  });

  it('walking in place advances the frame every 8 updates', () => {
    const frames = runAntic(1).log.map(l => l.frame);
    expect(frames.slice(0, 9)).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 1]);
    expect(new Set(frames)).toEqual(new Set([0, 1, 2, 3]));
  });

  it('the shuffle toggles frames 0 and 1 every 8 updates', () => {
    const frames = runAntic(2).log.map(l => l.frame);
    expect(frames.slice(6, 9)).toEqual([0, 1, 1]);
    expect(new Set(frames)).toEqual(new Set([0, 1]));
  });

  it('the spin turns clockwise (down, left, up, right) every 8 updates', () => {
    const facings = runAntic(3, sprite('down')).log.map(l => l.facing);
    expect([facings[6], facings[7], facings[15], facings[23], facings[31]]).toEqual(['down', 'left', 'up', 'right', 'down']);
    expect(runAntic(3).log.every(l => l.image === 'refresh')).toBe(true);
  });

  it('a walking player ends any antic before its update, with no byte drawn', () => {
    const idle = new PikachuIdle();
    idle.counter = 1;
    const s = sprite();
    idle.idle(s, ctx({ followCommand: 5, random: bytes(0) })); // bounce entry: index 16
    idle.anticUpdate(s, ctx());                                  // index 15: (-2, -1)
    expect([idle.offsetY, idle.offsetX]).toEqual([-2, -1]);
    const random = bytes(0);
    expect(idle.anticUpdate(s, ctx({ playerWalking: true, random }))).toBe('latched');
    expect(idle.antic).toBeNull();
    expect([idle.offsetY, idle.offsetX]).toEqual([0, 0]);
    expect(idle.counter).toBe(16);
    expect(random.drawn).toBe(0);
  });

  it('after an antic the next idle update counts 16 down to 15 at once', () => {
    const { idle } = runAntic(3);
    idle.idle(sprite(), ctx());
    expect(idle.counter).toBe(15);
  });

  it('an interrupted walk in place leaves its intra count for the next move', () => {
    const idle = new PikachuIdle();
    idle.counter = 1;
    const s = sprite();
    idle.idle(s, ctx({ followCommand: 5, random: bytes(1) }));
    for (let i = 0; i < 4; i++) idle.anticUpdate(s, ctx());
    expect(s.anim.intra).toBe(5);
    idle.anticUpdate(s, ctx({ playerWalking: true }));
    expect(s.anim.intra).toBe(5);
    // GetPikachuWalkingAnimationSpeed compares for equality: from 5 the period-2 counter
    // never matches until it wraps, so the frame holds for the whole move
    const frame = s.anim.frame;
    for (let i = 0; i < 8; i++) s.anim.tickExact(2);
    expect(s.anim.frame).toBe(frame);
    expect(s.anim.intra).toBe(13);
  });
});
