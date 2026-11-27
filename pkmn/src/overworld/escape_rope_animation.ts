import type { Direction } from '../core';

type Phase = 'prelude' | 'music' | 'exitSpin' | 'rise' | 'extra' | 'fadeOut' | 'load'
  | 'entryDelay' | 'fadeIn' | 'fall' | 'entrySpin' | 'done';
export type EscapeRopeSound = 'teleport_exit1' | 'teleport_exit2' | 'teleport_enter1' | 'teleport_enter2';

/** The ordinary-tile, CGB path through _LeaveMapAnim and EnterMapAnim.
 * A tick is one serviced frame. The owner supplies StopMusic(4) and the async map load. */
export class EscapeRopeAnimation {
  phase: Phase = 'prelude';
  direction: Direction;
  offsetY = 0;
  white = 0;
  private readonly savedDirection: Direction;
  private facing = 0;
  private delay = 16;
  private hold = 0;
  private row = 0;
  private frames = 3;
  private sound: EscapeRopeSound | null = null;
  private startMusic = false;

  constructor(facing: Direction) {
    this.savedDirection = facing;
    this.direction = facing;
  }

  takeSound(): EscapeRopeSound | null {
    const result = this.sound;
    this.sound = null;
    return result;
  }

  takeStartMusic(): boolean {
    const result = this.startMusic;
    this.startMusic = false;
    return result;
  }

  get loading(): boolean { return this.phase === 'load'; }
  get complete(): boolean { return this.phase === 'done'; }

  /** Called once the destination is loaded, while the screen is white. */
  loaded(): void {
    if (this.phase !== 'load') throw new Error('Escape Rope load out of order');
    this.phase = 'entryDelay';
    this.frames = 3; // EnterMapAnim's Delay3 before GBFadeInFromWhite
    this.offsetY = -80; // $ec to $3c in five 16-pixel steps
    this.white = 1;
    this.row = 0;
  }

  tick(audioFading = false): void {
    switch (this.phase) {
      case 'prelude':
        if (--this.frames === 0) { this.phase = 'music'; this.startMusic = true; }
        break;
      case 'music':
        if (!audioFading) { this.phase = 'exitSpin'; this.tick(false); }
        break;
      case 'exitSpin':
        if (this.hold > 0) { this.hold--; break; }
        this.rotate();
        if (this.delay % 4 === 0) this.sound = 'teleport_exit2';
        this.delay--;
        if (this.delay === 0) { this.phase = 'rise'; this.row = 0; }
        else this.hold = this.delay - 1;
        break;
      case 'rise':
        if (this.hold > 0) { this.hold--; break; }
        if (this.row === 0) this.sound = 'teleport_exit1';
        this.rotate();
        this.offsetY -= 16;
        this.row++;
        if (this.row === 5) { this.phase = 'extra'; this.frames = 10; }
        else this.hold = 2; // DelayFrames(3): two hold ticks, then the next step
        break;
      case 'extra':
        if (--this.frames === 0) { this.phase = 'fadeOut'; this.frames = 0; this.tick(); }
        break;
      case 'fadeOut':
        // FadePal6, FadePal7, FadePal8: each palette holds for DelayFrames(8).
        this.white = Math.ceil(++this.frames / 8) / 3;
        if (this.frames === 24) this.phase = 'load';
        break;
      case 'load': break;
      case 'entryDelay':
        if (--this.frames === 0) { this.phase = 'fadeIn'; this.frames = 0; this.tick(); }
        break;
      case 'fadeIn':
        this.white = 1 - Math.ceil(++this.frames / 8) / 3;
        if (this.frames === 24) {
          this.phase = 'fall';
          this.sound = 'teleport_enter1';
          this.tick(); // the source calls PlayerSpinWhileMovingDown immediately
        }
        break;
      case 'fall':
        if (this.hold > 0) { this.hold--; break; }
        this.rotate();
        this.offsetY += 16;
        this.row++;
        if (this.row === 5) {
          this.sound = 'teleport_enter2';
          this.phase = 'entrySpin';
          this.delay = 0;
          this.tick(); // PlaySound is followed by PlayerSpinInPlace in the same frame
        } else this.hold = 2;
        break;
      case 'entrySpin':
        if (this.hold > 0) { this.hold--; break; }
        this.rotate();
        this.delay++;
        if (this.delay === 8) { this.direction = this.savedDirection; this.phase = 'done'; }
        else this.hold = this.delay - 1;
        break;
      case 'done': break;
    }
  }

  private rotate(): void {
    this.direction = (['down', 'left', 'up', 'right'] as const)[this.facing];
    this.facing = (this.facing + 1) & 3;
  }
}
