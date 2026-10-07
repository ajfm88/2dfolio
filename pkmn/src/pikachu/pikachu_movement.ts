// Pikachu's scripted movement (A6e): a port of engine/pikachu/pikachu_movement.asm
// (ApplyPikachuMovementData_), the interpreter that moves Pikachu by byte programs —
// Viridian's step-aside, the walk to Nurse Joy, Oak's Lab, the emotion preludes.
//
// Pure: the follower owns the sprite, the callers own their guards and refreshes
// (try_pikachu_movement.asm). Data: pikachu_movement.json (rom/extractors/pikachu_movement.ts).
//
// The call blocks: Yellow swaps Pikachu's sprite data into slot 0 and loops
//   load command → (func1, func2, write image and pixels, shadow, DelayFrame ×2)
//   until func1 ends the command, then reads the next byte; $3f swaps the slots back
//   and costs one more DelayFrame.
// So every command iteration holds 2 frames, completion is checked after the hold, and
// the return frame comes last. Nothing else moves meanwhile.
//
// Coordinates are the cartridge's bytes: XPIXELS/YPIXELS and the base position are screen
// pixels (the player at $40, $3c), MAPX/MAPY carry the map's +4 border, and every write
// wraps at 256 as `add` does. The follower converts at its boundary.

import type {
  PikachuMovementData, PikachuMovementRecord,
} from '../rom/extractors/pikachu_movement';

/** SPRITE_FACING_DOWN/UP/LEFT/RIGHT ($0/$4/$8/$c). */
export const SPRITE_FACING = { down: 0x0, up: 0x4, left: 0x8, right: 0xc } as const;

const END = 0x3f;
const u8 = (v: number): number => v & 0xff;
const IMMEDIATE = 0x80;
const FUNC1_COUNT = 0x18;
const FUNC2_COUNT = 0x0b;
const END_COMMAND = 0x80;   // wPikachuMovementFlags bit 7
const SHADOW = 0x40;        // wPikachuMovementFlags bit 6

/** One command with its parameters resolved (LoadPikachuMovementCommandData). */
export interface PikachuMovementCommand {
  opcode: number;
  func1: number;
  param1: number;
  func2: number;
  param2: number;
}

/**
 * LoadPikachuMovementCommandData over a whole program: each opcode indexes the database;
 * a parameter of $80 reads the next byte. $3f ends the program only where an opcode is
 * read (as a parameter it is data). Throws unless the program ends exactly at its $3f.
 */
export function decodePikachuMovementProgram(
  database: readonly PikachuMovementRecord[], bytes: readonly number[],
): PikachuMovementCommand[] {
  const commands: PikachuMovementCommand[] = [];
  let i = 0;
  const next = (what: string): number => {
    if (i >= bytes.length) throw new Error(`Pikachu movement program truncated reading ${what}`);
    return bytes[i++];
  };
  for (;;) {
    const opcode = next('an opcode');
    if (opcode === END) break;
    const record = database[opcode];
    if (!record) throw new Error(`Pikachu movement opcode $${opcode.toString(16)} is not in the database`);
    if (record.func1 >= FUNC1_COUNT || record.func2 >= FUNC2_COUNT) {
      throw new Error(`Pikachu movement opcode $${opcode.toString(16)} names an unknown function`);
    }
    const param1 = record.param1 === IMMEDIATE ? next('param1') : record.param1;
    const param2 = record.param2 === IMMEDIATE ? next('param2') : record.param2;
    commands.push({ opcode, func1: record.func1, param1, func2: record.func2, param2 });
  }
  if (i !== bytes.length) throw new Error('Pikachu movement program continues past its $3f');
  return commands;
}

/** The sprite fields the interpreter reads and writes (Pikachu's, swapped into slot 0),
 *  as bytes. */
export interface PikachuMoveSprite {
  /** XPIXELS / YPIXELS: screen pixels */
  x: number;
  y: number;
  /** FACINGDIRECTION ($0/$4/$8/$c) */
  facing: number;
  /** IMAGEINDEX's low byte: direction | animation frame; $ff = not drawn */
  image: number;
  /** INTRAANIMFRAMECOUNTER / ANIMFRAMECOUNTER */
  intra: number;
  anim: number;
  /** MAPX / MAPY: steps + 4 (the map border) */
  mapX: number;
  mapY: number;
  /** GRASSPRIORITY ≠ 0 */
  grass: boolean;
}

/** The interpreter's WRAM. It persists between calls: a program without the $00 init
 *  command keeps the previous call's base position, offsets and image. */
export interface PikachuMovementWork {
  /** wPikaSpriteX / Y: screen pixels */
  baseX: number;
  baseY: number;
  /** wPikachuMovementXOffset / YOffset (kept signed; only ever added and wrapped) */
  offX: number;
  offY: number;
  /** wCurPikaMovementSpriteImageIdx */
  image: number;
  /** wPikachuStepTimer / wPikachuStepSubtimer (bytes) */
  timer: number;
  subtimer: number;
  /** wPikachuMovementFlags */
  flags: number;
}

export function createPikachuMovementWork(): PikachuMovementWork {
  return { baseX: 0, baseY: 0, offX: 0, offY: 0, image: 0, timer: 0, subtimer: 0, flags: 0 };
}

// PIKASTEPDIR_DOWN … _UP_RIGHT: the pixel vector (UpdatePikachuPosition) and the map step
// (ApplyPikachuStepVector .StepVectors) agree.
const STEP_VECTORS: readonly (readonly [number, number])[] = [
  [0, 1], [0, -1], [-1, 0], [1, 0], [-1, 1], [1, 1], [-1, -1], [1, -1],
];
const DIR = { DOWN: 0, UP: 1, LEFT: 2, RIGHT: 3, DOWN_LEFT: 4, DOWN_RIGHT: 5, UP_LEFT: 6, UP_RIGHT: 7 } as const;

// The relative step tables, by live facing down/up/left/right (PikaMovementFunc1_*.Data).
const RELATIVE: Record<'ccw' | 'cw' | 'forwardLeft' | 'forwardRight' | 'backLeft' | 'backRight', readonly number[]> = {
  ccw:          [DIR.RIGHT, DIR.LEFT, DIR.DOWN, DIR.UP],
  cw:           [DIR.LEFT, DIR.RIGHT, DIR.UP, DIR.DOWN],
  forwardLeft:  [DIR.DOWN_RIGHT, DIR.UP_LEFT, DIR.DOWN_LEFT, DIR.UP_RIGHT],
  forwardRight: [DIR.DOWN_LEFT, DIR.UP_RIGHT, DIR.UP_LEFT, DIR.DOWN_RIGHT],
  backLeft:     [DIR.UP_RIGHT, DIR.DOWN_LEFT, DIR.DOWN_RIGHT, DIR.UP_LEFT],
  backRight:    [DIR.UP_LEFT, DIR.DOWN_RIGHT, DIR.UP_RIGHT, DIR.DOWN_LEFT],
};

/** Data_fd731: down → left → up → right → down. */
const TURN_CW: Record<number, number> = { 0x0: 0x8, 0x8: 0x4, 0x4: 0xc, 0xc: 0x0 };
/** The same table read backwards. */
const TURN_CCW: Record<number, number> = { 0x0: 0xc, 0xc: 0x4, 0x4: 0x8, 0x8: 0x0 };

/**
 * PikaMovementFunc_Sine for one update: the subtimer advances by 1 << ((param2 >> 4) & 7),
 * the angle is subtimer + $20 (mod 64), and the result is the high byte of
 * sine × ((param2 & $f) + 1), negated in the second half-cycle. Returns the signed offset.
 */
export function pikachuMovementSine(sine: readonly number[], work: PikachuMovementWork, param2: number): number {
  const amplitude = (param2 & 0xf) + 1;
  const step = 1 << ((param2 >> 4) & 7);
  work.subtimer = (work.subtimer + step) & 0xff;
  const angle = (work.subtimer + 0x20) & 0x3f;
  const high = ((sine[angle & 0x1f] * amplitude) & 0xffff) >> 8;
  return angle < 0x20 ? high : -high;
}

/**
 * One ApplyPikachuMovementData_ call. Construction runs the first command iteration (the
 * frame the call starts); then `tick()` once per game frame. `tick()` returns true on the
 * frame the call returns: e.g. 37 ticks for init + 2 steps + look + return.
 */
export class PikachuMovementRun {
  private readonly commands: PikachuMovementCommand[];
  private index = 0;
  private current: PikachuMovementCommand | null = null;
  private hold = 0;
  private savedGrass = false;
  private returning = false;
  private finished = false;
  /** BIT_LEDGE_OR_FISHING as AnimatePikachuShadow left it: the shadow is drawn. */
  shadow = false;
  /** Frames since the call started. */
  frames = 0;

  constructor(
    private readonly data: PikachuMovementData,
    program: readonly number[],
    readonly sprite: PikachuMoveSprite,
    private readonly work: PikachuMovementWork,
  ) {
    this.commands = decodePikachuMovementProgram(data.commands, program);
    this.nextCommand();
  }

  /** The call has returned. */
  get done(): boolean { return this.finished; }
  /** Pikachu holds slot 0 (everything but the return frame). */
  get swapped(): boolean { return !this.finished && !this.returning; }
  /** wPikaSpriteX / Y: where the shadow sits (a jump moves only the sprite above it). */
  get baseX(): number { return this.work.baseX; }
  get baseY(): number { return this.work.baseY; }

  /** One game frame. True on the frame the call returns. */
  tick(): boolean {
    if (this.finished) return true;
    this.frames++;
    if (--this.hold > 0) return false;
    if (this.returning) {
      this.finished = true;
      return true;
    }
    if (this.work.flags & END_COMMAND) {
      this.sprite.grass = this.savedGrass;
      this.nextCommand();
    } else {
      this.iterate();
    }
    return false;
  }

  /** LoadPikachuMovementCommandData, then ExecutePikachuMovementCommand's first pass. */
  private nextCommand(): void {
    const command = this.commands[this.index++];
    if (!command) {
      // $3f: SwapSpriteStateData, then DelayFrame
      this.current = null;
      this.returning = true;
      this.hold = 1;
      return;
    }
    this.current = command;
    this.work.flags = 0;
    this.work.timer = 0;
    this.work.subtimer = 0;
    this.savedGrass = this.sprite.grass;
    this.iterate();
  }

  private iterate(): void {
    const c = this.current!;
    const s = this.sprite;
    const w = this.work;
    this.func1(c);
    this.func2(c);
    // GetCoordsForPikachuShadow
    s.image = w.image;
    s.y = u8(w.baseY + w.offY);
    s.x = u8(w.baseX + w.offX);
    if (w.flags & SHADOW) s.grass = false;
    // AnimatePikachuShadow consumes bit 6
    this.shadow = (w.flags & SHADOW) !== 0;
    w.flags &= ~SHADOW;
    this.hold = 2;
  }

  private end(): void { this.work.flags |= END_COMMAND; }

  /** CheckPikachuStepTimer1: true when the command's update count is reached. */
  private timer1(param1: number): boolean {
    this.work.timer = (this.work.timer + 1) & 0xff;
    if (this.work.timer !== (param1 & 0x1f) + 1) return false;
    this.work.timer = 0;
    return true;
  }

  /** CheckPikachuStepTimer2 */
  private timer2(param2: number): boolean {
    this.work.subtimer = (this.work.subtimer + 1) & 0xff;
    if (this.work.subtimer !== (param2 & 0xf) + 1) return false;
    this.work.subtimer = 0;
    return true;
  }

  /** UpdatePikachuPosition: the base moves by the magnitude on each axis. */
  private moveBase(dir: number, param1: number): void {
    const magnitude = ((param1 >> 5) & 3) + 1;
    const [dx, dy] = STEP_VECTORS[dir];
    this.work.baseX = u8(this.work.baseX + dx * magnitude);
    this.work.baseY = u8(this.work.baseY + dy * magnitude);
  }

  /** PikaMovementFunc1_ApplyStepVector: relative moves never touch the map position. */
  private relative(dir: number, param1: number): void {
    this.moveBase(dir, param1);
    if (this.timer1(param1)) this.end();
  }

  /** PikaMovementFunc1_ApplyFacingAndMove / _MoveDiagonally: the map steps once the
   *  command's updates are done. */
  private absolute(dir: number, param1: number, setFacing: boolean): void {
    if (setFacing) this.sprite.facing = (dir << 2) & 0xc;
    this.moveBase(dir, param1);
    if (!this.timer1(param1)) return;
    const [dx, dy] = STEP_VECTORS[dir];
    this.sprite.mapX = u8(this.sprite.mapX + dx);
    this.sprite.mapY = u8(this.sprite.mapY + dy);
    this.end();
  }

  private facingIndex(): number { return (this.sprite.facing & 0xc) >> 2; }

  private func1(c: PikachuMovementCommand): void {
    const s = this.sprite;
    const w = this.work;
    const p = c.param1;
    switch (c.func1) {
      case 0x00: case 0x17: this.end(); return;
      case 0x01: // LoadPikachuCurrentPosition
        w.baseY = s.y;
        w.baseX = s.x;
        w.offY = 0;
        w.offX = 0;
        this.end();
        return;
      case 0x02: if (this.timer1(p)) this.end(); return; // DelayFrames
      case 0x03: this.relative(this.facingIndex(), p); return;
      case 0x04: this.relative(this.facingIndex() ^ 1, p); return; // xor %100 on the facing
      case 0x05: this.relative(RELATIVE.ccw[this.facingIndex()], p); return;
      case 0x06: this.relative(RELATIVE.cw[this.facingIndex()], p); return;
      case 0x07: this.relative(RELATIVE.forwardLeft[this.facingIndex()], p); return;
      case 0x08: this.relative(RELATIVE.forwardRight[this.facingIndex()], p); return;
      case 0x09: this.relative(RELATIVE.backLeft[this.facingIndex()], p); return;
      case 0x0a: this.relative(RELATIVE.backRight[this.facingIndex()], p); return;
      case 0x0b: this.absolute(DIR.DOWN, p, true); return;
      case 0x0c: this.absolute(DIR.UP, p, true); return;
      case 0x0d: this.absolute(DIR.LEFT, p, true); return;
      case 0x0e: this.absolute(DIR.RIGHT, p, true); return;
      case 0x0f: this.absolute(DIR.DOWN_LEFT, p, false); return;
      case 0x10: this.absolute(DIR.DOWN_RIGHT, p, false); return;
      case 0x11: this.absolute(DIR.UP_LEFT, p, false); return;
      case 0x12: this.absolute(DIR.UP_RIGHT, p, false); return;
      case 0x13: case 0x14: case 0x15: case 0x16: // LookDown/Up/Left/Right
        s.facing = ((c.func1 - 0x13) << 2) & 0xc;
        this.end();
        return;
    }
  }

  private func2(c: PikachuMovementCommand): void {
    const s = this.sprite;
    const w = this.work;
    const p = c.param2;
    switch (c.func2) {
      case 0: // ResetFrameCounterAndFaceCurrent
        s.intra = 0;
        s.anim = 0;
        w.image = s.facing & 0xc;
        return;
      case 1: this.animate(s.image & 0xc, p); return; // with the previous image direction
      case 2: this.animate(s.facing & 0xc, p); return; // with the live facing
      case 3: this.turn((p & 0x40) !== 0, p); return; // TurnParameter
      case 4: this.turn(true, p); return;
      case 5: this.turn(false, p); return;
      case 6: w.image = s.image & 0xc; return; // CopySpriteImageIdxDirectionToSpriteImageIdx
      case 7: this.jump(s.image & 0xc, p, true); return;
      case 8: this.jump(s.facing & 0xc, p, true); return;
      case 9: { // CopyFacingToJump: frame 0, no shadow
        w.image = s.facing & 0xc;
        w.offY = pikachuMovementSine(this.data.sine, w, p);
        return;
      }
      case 10: return;
    }
  }

  /**
   * PikaMovementFunc2_UpdateSpriteImageIdx — with its bug kept: it points HL at the
   * animation counter, but CheckPikachuStepTimer2 leaves HL on the subtimer, so the
   * subtimer is what gets incremented and read. The frame is (subtimer >> 2) & 3.
   */
  private animate(direction: number, param2: number): void {
    const w = this.work;
    if (this.timer2(param2)) w.subtimer = (w.subtimer + 1) & 0xff;
    w.image = direction | ((w.subtimer >> 2) & 3);
  }

  /** TurnClockwise / TurnCounterClockwise: image only, one quarter per timer2 cycle. */
  private turn(clockwise: boolean, param2: number): void {
    let direction = this.sprite.image & 0xc;
    if (this.timer2(param2)) direction = (clockwise ? TURN_CW : TURN_CCW)[direction];
    this.work.image = direction;
  }

  /** PikaMovementFunc2_UpdateJump: PikaMovementFunc2_Timer's frame (every 4 updates),
   *  the sine offset, and the shadow while Pikachu is off the ground. */
  private jump(direction: number, param2: number, shadow: boolean): void {
    const s = this.sprite;
    const w = this.work;
    s.intra = (s.intra + 1) & 3;
    if (s.intra === 0) s.anim = (s.anim + 1) & 3;
    w.image = direction | s.anim;
    w.offY = pikachuMovementSine(this.data.sine, w, param2);
    if (shadow && w.offY !== 0) w.flags |= SHADOW;
  }
}

/** Frames a program takes from its call to its return (2 per command iteration, + 1). */
export function pikachuMovementFrames(
  data: PikachuMovementData, program: readonly number[], sprite: PikachuMoveSprite,
  work: PikachuMovementWork = createPikachuMovementWork(),
): number {
  const run = new PikachuMovementRun(data, program, { ...sprite }, { ...work });
  let frames = 0;
  while (!run.tick()) frames++;
  return frames + 1;
}

/**
 * GetPikachuFacingDirection: where Pikachu is relative to the player by map position,
 * Y first (above/below win over left/right); null when they overlap ($ff).
 */
export function pikachuSide(
  pika: { x: number; y: number }, player: { x: number; y: number },
): 'up' | 'down' | 'left' | 'right' | null {
  if (pika.y !== player.y) return pika.y > player.y ? 'down' : 'up';
  if (pika.x !== player.x) return pika.x > player.x ? 'right' : 'left';
  return null;
}

/** The loaded data must have the shapes the interpreter indexes (load-time guard). */
export function validatePikachuMovementData(data: PikachuMovementData): void {
  if (data.commands?.length !== 63) throw new Error('pikachu_movement.json: expected 63 commands');
  if (data.sine?.length !== 32 || data.sine.some(w => !Number.isInteger(w) || w < 0 || w > 0xffff)) {
    throw new Error('pikachu_movement.json: expected 32 sine words');
  }
  for (const program of Object.values(data.programs)) decodePikachuMovementProgram(data.commands, program);
}
