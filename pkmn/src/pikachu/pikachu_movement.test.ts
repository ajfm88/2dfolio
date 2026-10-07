import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { PikachuMovementData } from '../rom/extractors/pikachu_movement';
import {
  PikachuMovementRun, createPikachuMovementWork, decodePikachuMovementProgram,
  pikachuMovementFrames, pikachuMovementSine, pikachuSide, SPRITE_FACING,
} from './pikachu_movement';
import type { PikachuMoveSprite, PikachuMovementWork } from './pikachu_movement';

const data: PikachuMovementData = JSON.parse(
  readFileSync(resolve(__dirname, '../../data/pikachu_movement.json'), 'utf8'),
);

function sprite(overrides: Partial<PikachuMoveSprite> = {}): PikachuMoveSprite {
  return { x: 160, y: 160, facing: SPRITE_FACING.up, image: SPRITE_FACING.up, intra: 0, anim: 0, mapX: 10, mapY: 10, grass: false, ...overrides };
}

/** Run a program to its return, recording the sprite after every frame. */
function trace(program: number[], s = sprite(), work: PikachuMovementWork = createPikachuMovementWork()) {
  const run = new PikachuMovementRun(data, program, s, work);
  const frames: { x: number; y: number; image: number; shadow: boolean; grass: boolean; swapped: boolean }[] = [];
  const snap = (): void => { frames.push({ x: s.x, y: s.y, image: s.image, shadow: run.shadow, grass: s.grass, swapped: run.swapped }); };
  snap(); // t = 0: the first iteration runs as the call starts
  while (!run.tick()) snap();
  return { run, frames, sprite: s, work, length: frames.length };
}

/** One sample per command iteration: frames 0, 2, 4, … of a trace. */
const updates = <T>(frames: T[], from: number, count: number): T[] =>
  Array.from({ length: count }, (_, i) => frames[from + 2 * i]);

describe('the extracted programs (pikachu_movement.asm, today\'s callers)', () => {
  it('holds the bytes the ROM has at each caller\'s address', () => {
    expect(data.commands).toHaveLength(63);
    expect(data.programs).toEqual({
      viridianStepAside: [0x00, 0x1d, 0x1f, 0x38, 0x3f],
      oaksLab1: [0x00, 0x1f, 0x1e, 0x38, 0x3f],
      oaksLab2: [0x00, 0x1d, 0x20, 0x36, 0x3f],
      nurse1: [0x00, 0x36, 0x2b, 0x34, 0x3f],
      nurse2: [0x00, 0x36, 0x34, 0x3f],
      nurse3: [0x00, 0x36, 0x33, 0x3f],
      emotion_fd218: [0x00, 0x39, 0x01, 0x3e, 0x1e, 0x3f],
      emotion_fd21e: [0x00, 0x39, 0x00, 0x3e, 0x1e, 0x3f],
      emotion_fd224: [0x00, 0x3c, 0x07, 0x2f, 0x3c, 0x07, 0x2f, 0x3f],
      emotion_fd230: [0x00, 0x3c, 0x0f, 0x1f, 0x3c, 0x0f, 0x1f, 0x3f],
    });
    expect(data.sine).toEqual([
      0, 25, 50, 74, 98, 121, 142, 162, 181, 198, 213, 226, 237, 245, 251, 255,
      256, 255, 251, 245, 237, 226, 213, 198, 181, 162, 142, 121, 98, 74, 50, 25,
    ]);
  });

  it('decodes immediate parameters in order; $3f is data where a parameter is read', () => {
    expect(decodePikachuMovementProgram(data.commands, data.programs.emotion_fd224)).toEqual([
      { opcode: 0x00, func1: 0x01, param1: 0, func2: 0x00, param2: 0 },
      { opcode: 0x3c, func1: 0x02, param1: 0x07, func2: 0x07, param2: 0x2f },
      { opcode: 0x3c, func1: 0x02, param1: 0x07, func2: 0x07, param2: 0x2f },
    ]);
    // $3e with param1 = $3f: the byte is a parameter, the next $3f ends it
    expect(decodePikachuMovementProgram(data.commands, [0x3e, 0x3f, 0x3f])).toHaveLength(1);
  });

  it('rejects programs that would invent motion or run off their end', () => {
    expect(() => decodePikachuMovementProgram(data.commands, [0x00])).toThrow(/truncated/);
    expect(() => decodePikachuMovementProgram(data.commands, [0x39])).toThrow(/truncated/);
    expect(() => decodePikachuMovementProgram(data.commands, [0x40, 0x3f])).toThrow(/database/);
    expect(() => decodePikachuMovementProgram(data.commands, [0x00, 0x3f, 0x00])).toThrow(/past/);
  });
});

describe('cadence: 2 frames per command iteration, then 1 return frame', () => {
  it('each caller\'s program takes the frames its commands add up to', () => {
    // init 2 + step 16 + step 16 + look 2 + return 1
    expect(pikachuMovementFrames(data, data.programs.viridianStepAside, sprite())).toBe(37);
    expect(pikachuMovementFrames(data, data.programs.oaksLab1, sprite())).toBe(37);
    expect(pikachuMovementFrames(data, data.programs.oaksLab2, sprite())).toBe(37);
    // init 2 + look 2 + slide 32 + hop 32 + return 1
    expect(pikachuMovementFrames(data, data.programs.nurse1, sprite())).toBe(69);
    expect(pikachuMovementFrames(data, data.programs.nurse2, sprite())).toBe(37);
    expect(pikachuMovementFrames(data, data.programs.nurse3, sprite())).toBe(37);
    // init 2 + turn 2×2 + hold 31×2 + return 1, and the other preludes
    expect(pikachuMovementFrames(data, data.programs.emotion_fd218, sprite())).toBe(69);
    expect(pikachuMovementFrames(data, data.programs.emotion_fd21e, sprite())).toBe(67);
    expect(pikachuMovementFrames(data, data.programs.emotion_fd224, sprite())).toBe(35);
    expect(pikachuMovementFrames(data, data.programs.emotion_fd230, sprite())).toBe(67);
  });

  it('an empty program costs only the return frame; init alone costs 2 + 1', () => {
    expect(pikachuMovementFrames(data, [0x3f], sprite())).toBe(1);
    expect(pikachuMovementFrames(data, [0x00, 0x3f], sprite())).toBe(3);
  });

  it('holds each iteration\'s result for exactly two frames, and swaps back for the last', () => {
    const t = trace(data.programs.viridianStepAside);
    expect(t.length).toBe(37);
    // the step's iterations land at t = 2, 4, …, 16: 2 px each, held for 2 frames
    expect(t.frames.slice(1, 19).map(f => f.y)).toEqual([
      160, 162, 162, 164, 164, 166, 166, 168, 168, 170, 170, 172, 172, 174, 174, 176, 176, 176,
    ]);
    expect(t.frames.slice(0, 36).every(f => f.swapped)).toBe(true);
    expect(t.run.swapped).toBe(false);
  });
});

describe('the movement functions', () => {
  it('Viridian: down, left, then looks right while the image keeps facing left', () => {
    const t = trace(data.programs.viridianStepAside);
    expect([t.sprite.x, t.sprite.y]).toEqual([144, 176]);
    expect([t.sprite.mapX, t.sprite.mapY]).toEqual([9, 11]);
    expect(t.sprite.facing).toBe(SPRITE_FACING.right);
    expect(t.sprite.image).toBe(SPRITE_FACING.left); // $38 copies the previous image direction
  });

  it('an absolute step moves the map only when its last update is done', () => {
    const s = sprite();
    const run = new PikachuMovementRun(data, [0x00, 0x1d, 0x3f], s, createPikachuMovementWork());
    for (let i = 0; i < 2 + 14; i++) run.tick(); // through the 8th update's first frame
    expect([s.y, s.mapY]).toEqual([176, 11]);
    const s2 = sprite();
    const run2 = new PikachuMovementRun(data, [0x00, 0x1d, 0x3f], s2, createPikachuMovementWork());
    for (let i = 0; i < 2 + 12; i++) run2.tick(); // the 7th update
    expect([s2.y, s2.mapY]).toEqual([174, 10]);
  });

  it('keeps the animation bug: the subtimer, not the frame counter, sets the frame', () => {
    // PikaMovementFunc2_UpdateSpriteImageIdx with param2 = 0, 8 updates of a step
    const t = trace([0x00, 0x25, 0x3f]); // slide down: 16 updates
    expect(updates(t.frames, 2, 16).map(f => f.image & 3)).toEqual([0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 0]);
  });

  it('the nurse hop: a 1 px diagonal per update, the integer sine arc, and its shadow', () => {
    const t = trace(data.programs.nurse2, sprite({ facing: SPRITE_FACING.down, image: SPRITE_FACING.down }));
    const hop = updates(t.frames, 4, 16); // after init and look
    expect(hop.map(f => f.x - 160)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    const arc = [-1, -3, -4, -5, -6, -7, -7, -8, -7, -7, -6, -5, -4, -3, -1, 0];
    expect(hop.map((f, i) => f.y - (160 - (i + 1)))).toEqual(arc);
    expect(hop.map(f => f.shadow)).toEqual(arc.map(o => o !== 0));
    expect([t.sprite.mapX, t.sprite.mapY, t.sprite.facing]).toEqual([11, 9, SPRITE_FACING.up]);
  });

  it('nurse 1: looks up, slides up-left without turning, then hops up-right', () => {
    const t = trace(data.programs.nurse1);
    expect([t.sprite.x, t.sprite.y, t.sprite.mapX, t.sprite.mapY]).toEqual([160, 128, 10, 8]);
    const slide = updates(t.frames, 4, 16);
    expect(slide.map(f => [f.x, f.y])).toEqual(Array.from({ length: 16 }, (_, i) => [159 - i, 159 - i]));
    expect(slide.every(f => !f.shadow)).toBe(true);
  });

  it('the sine: amplitude (p & 15) + 1, phase step 1 << ((p >> 4) & 7), from angle $20', () => {
    const offsets = (p: number, n: number): number[] => {
      const w = createPikachuMovementWork();
      return Array.from({ length: n }, () => pikachuMovementSine(data.sine, w, p));
    };
    expect(offsets(0x17, 16)).toEqual([-1, -3, -4, -5, -6, -7, -7, -8, -7, -7, -6, -5, -4, -3, -1, 0]);
    expect(offsets(0x2f, 8)).toEqual([-6, -11, -14, -16, -14, -11, -6, 0]);
    expect(offsets(0x1f, 16)).toEqual([-3, -6, -8, -11, -13, -14, -15, -16, -15, -14, -13, -11, -8, -6, -3, 0]);
  });

  it('emotion 7\'s jumps: the previous image direction, the frame every 4 updates, a shadow', () => {
    const t = trace(data.programs.emotion_fd224, sprite({ facing: SPRITE_FACING.left, image: SPRITE_FACING.left }));
    const jump = updates(t.frames, 2, 8);
    expect(jump.map(f => f.y - 160)).toEqual([-6, -11, -14, -16, -14, -11, -6, 0]);
    expect(jump.map(f => f.shadow)).toEqual([true, true, true, true, true, true, true, false]);
    expect(jump.map(f => f.image)).toEqual([8, 8, 8, 9, 9, 9, 9, 10]);
    // the second call restarts the arc: timer and subtimer reset per command
    expect(updates(t.frames, 18, 8).map(f => f.y - 160)).toEqual([-6, -11, -14, -16, -14, -11, -6, 0]);
  });

  it('$3d jumps on the live facing with frame 0 and never asks for the shadow', () => {
    const t = trace([0x00, 0x3d, 0x07, 0x2f, 0x3f], sprite({ facing: SPRITE_FACING.right, image: SPRITE_FACING.down }));
    const jump = updates(t.frames, 2, 8);
    expect(jump.map(f => f.y - 160)).toEqual([-6, -11, -14, -16, -14, -11, -6, 0]);
    expect(jump.every(f => !f.shadow && f.image === SPRITE_FACING.right)).toBe(true);
  });

  it('turns change only the drawn direction: $39 clockwise, $3a counterclockwise, $3b by bit 6', () => {
    const down = { facing: SPRITE_FACING.down, image: SPRITE_FACING.down };
    const cw = trace([0x00, 0x39, 0x03, 0x3f], sprite(down));
    expect(updates(cw.frames, 2, 4).map(f => f.image)).toEqual([0x8, 0x4, 0xc, 0x0]);
    expect(cw.sprite.facing).toBe(SPRITE_FACING.down);
    const ccw = trace([0x00, 0x3a, 0x03, 0x3f], sprite(down));
    expect(updates(ccw.frames, 2, 4).map(f => f.image)).toEqual([0xc, 0x4, 0x8, 0x0]);
    // $3b: param2 bit 6 → clockwise, the low nibble paces it (every 2nd update here)
    const param = trace([0x00, 0x3b, 0x03, 0x41, 0x3f], sprite(down));
    expect(updates(param.frames, 2, 4).map(f => f.image)).toEqual([0x0, 0x8, 0x8, 0x4]);
  });

  it('emotion 13 (fd21e): one clockwise turn, then the image holds for 31 updates', () => {
    const t = trace(data.programs.emotion_fd21e, sprite({ facing: SPRITE_FACING.left, image: SPRITE_FACING.left }));
    expect(t.frames[2].image).toBe(SPRITE_FACING.up);
    expect(t.frames.slice(4, 66).every(f => f.image === SPRITE_FACING.up)).toBe(true);
    expect([t.sprite.x, t.sprite.y, t.sprite.facing]).toEqual([160, 160, SPRITE_FACING.left]);
  });

  it('relative moves follow the live facing and leave the map position alone', () => {
    // $05: forward-left, param1 $21 = 2 updates of 2 px; facing down → down-right
    const fl = trace([0x00, 0x05, 0x21, 0x3f], sprite({ facing: SPRITE_FACING.down }));
    expect([fl.sprite.x, fl.sprite.y, fl.sprite.mapX, fl.sprite.mapY]).toEqual([164, 164, 10, 10]);
    // facing left: back-left ($07) is down-right too
    const bl = trace([0x00, 0x07, 0x21, 0x3f], sprite({ facing: SPRITE_FACING.left }));
    expect([bl.sprite.x, bl.sprite.y]).toEqual([164, 164]);
    // $02 walks opposite the facing; $03/$04 turn the step counter- and clockwise
    expect(trace([0x00, 0x02, 0x20, 0x3f], sprite({ facing: SPRITE_FACING.up })).sprite.y).toBe(162);
    expect(trace([0x00, 0x03, 0x20, 0x3f], sprite({ facing: SPRITE_FACING.down })).sprite.x).toBe(162);
    expect(trace([0x00, 0x04, 0x20, 0x3f], sprite({ facing: SPRITE_FACING.down })).sprite.x).toBe(158);
    expect(fl.sprite.facing).toBe(SPRITE_FACING.down);
  });

  it('timer limit and speed come from param1: (p & 31) + 1 updates of ((p >> 5) & 3) + 1 px', () => {
    const t = trace([0x00, 0x01, 0x62, 0x3f], sprite({ facing: SPRITE_FACING.right })); // 3 updates × 4 px
    expect(t.length).toBe(2 + 6 + 1);
    expect(t.sprite.x).toBe(172);
  });

  it('the shadow zeroes grass priority; the command restores the byte it saved', () => {
    const t = trace(data.programs.nurse2, sprite({ grass: true }));
    const hop = updates(t.frames, 4, 16);
    expect(hop.slice(0, 15).every(f => !f.grass)).toBe(true);
    expect(t.sprite.grass).toBe(true);
  });

  it('a program without init keeps the previous call\'s base and image (unused fd22c)', () => {
    const work = createPikachuMovementWork();
    trace(data.programs.viridianStepAside, sprite(), work); // base ends at (144, 176)
    const s = sprite({ x: 0, y: 0 });
    trace([0x3b, 0x1f, 0x03, 0x3f], s, work);
    expect([s.x, s.y]).toEqual([144, 176]);
  });
});

describe('byte arithmetic (A6e review R-2)', () => {
  it('screen pixels wrap at 256: a variable-length $01 from X 250 visits 254, 2, then 6', () => {
    // $01: walk forward, param1 $62 read from the program = 3 updates of 4 px
    const t = trace([0x00, 0x01, 0x62, 0x3f], sprite({ x: 250, facing: SPRITE_FACING.right }));
    expect(updates(t.frames, 2, 3).map(f => f.x)).toEqual([254, 2, 6]);
    expect(t.sprite.x).toBe(6);
  });

  it('the base-plus-offset write wraps: a jump at Y 2 is drawn at 252, the base stays 2', () => {
    const work = createPikachuMovementWork();
    const t = trace([0x00, 0x3d, 0x07, 0x2f, 0x3f], sprite({ y: 2, facing: SPRITE_FACING.right }), work);
    expect(updates(t.frames, 2, 2).map(f => f.y)).toEqual([(2 - 6) & 0xff, (2 - 11) & 0xff]);
    expect(work.baseY).toBe(2);
  });

  it('map steps wrap as bytes, as ApplyPikachuStepVector writes them', () => {
    const right = trace([0x00, 0x20, 0x3f], sprite({ mapX: 0xff, facing: SPRITE_FACING.right }));
    expect(right.sprite.mapX).toBe(0x00);
    const up = trace([0x00, 0x1e, 0x3f], sprite({ mapY: 0x00 }));
    expect(up.sprite.mapY).toBe(0xff);
  });
});

describe('GetPikachuFacingDirection (the TryApply side check)', () => {
  it('compares Y first, then X; overlap gives none', () => {
    const player = { x: 5, y: 5 };
    expect(pikachuSide({ x: 9, y: 6 }, player)).toBe('down');
    expect(pikachuSide({ x: 1, y: 2 }, player)).toBe('up');
    expect(pikachuSide({ x: 8, y: 5 }, player)).toBe('right');
    expect(pikachuSide({ x: 4, y: 5 }, player)).toBe('left');
    expect(pikachuSide({ x: 5, y: 5 }, player)).toBeNull();
  });
});
