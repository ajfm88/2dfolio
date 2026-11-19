// Init (home/init.asm) and PlayIntro (engine/movie/intro.asm) as a frame program: the boot path from the splash click,
// the title's idle reset and the clear-save dialogue to PrepareTitleScreen. Opening checkpoint-08a (note 118). The frame
// counts are the cartridge's, measured by running its own code (note 118 §2.2, boot-frames.mjs). A yield is one frame:
// 'dark' when no VBlank is serviced (Init's `di` span, the LCD-off span of Init's tail), plain when one is.
// PlayShootingStar (the copyright screen and the Game Freak star) and PlayIntroScene (the movie) are checkpoints 08b–14.
import { stopAllSounds } from '../audio';
import { textBgTransfer } from '../text/bg_transfer';
import { OpeningScreen } from './opening_screen';
import { presentOpeningScreen } from './opening_screen_render';

/** From `jp Init` to the first VBlank after `ei`: DisableLCD's wait, the WRAM, VRAM, HRAM and OAM clears with the LCD
 *  off, the LCD back on, StopAllSounds. 11.16 frames from the frame Init starts in: 10 dark ticks. */
export const INIT_DARK_TICKS = 10;
/** LoadSGB on a CGB: CheckSGB's packets and nine Wait7000 loops, with interrupts on. */
export const LOAD_SGB_FRAMES = 51;
/** Init's tail after PlayIntro: DisableLCD's serviced frame, then ClearVram, GBPalNormal, ClearSprites and LCDC_DEFAULT
 *  with the LCD off: 4.02 frames from that VBlank to the first one after EnableLCD, so 3 dark ticks. */
export const INIT_TAIL_DARK_TICKS = 3;

type BootStep = 'dark' | void;
export type BootExit = 'title';

export class Boot {
  private screen = new OpeningScreen();
  private previous: (() => void) | null = null;
  private program: Generator<BootStep, BootExit> | null = null;
  private dark = false;
  private frame = 0;
  private stage = 'idle';

  /** Inspection for tests. */
  get inspection() { return { frame: this.frame, stage: this.stage, dark: this.dark, lcd: this.screen.lcdOn } as const; }

  /** main, before VBlank's work: the coming frame has no VBlank. */
  get darkFrame(): boolean { return this.dark; }

  /** `jp Init`, up to its first frame. The caller has already cleared the HRAM the port keeps elsewhere. `previous` draws
   *  the picture on screen when Init begins: on the CGB, Init's rBGP = 0 changes no colour, so it stays until the LCD
   *  goes off in the next frame's step. */
  start(previous: (() => void) | null = null): void {
    this.screen = new OpeningScreen(); this.frame = 0; this.previous = previous;
    this.program = this.run();
    this.dark = this.program.next().value === 'dark';
  }

  /** One frame; 'title' in the step that jumps to PrepareTitleScreen. */
  update(): BootExit | null {
    if (!this.program) return null;
    if (this.dark) this.dark = false;
    else this.screen.vblank();
    this.frame++;
    const step = this.program.next();
    if (!step.done) { if (step.value === 'dark') this.dark = true; return null; }
    this.program = null;
    return step.value;
  }

  /** Init writes rBGP = 0 and the screen stays white: the LCD off, or on with cleared VRAM and BGP 0. */
  render(): void {
    if (this.frame === 0 && this.previous) this.previous();
    else presentOpeningScreen(this.screen);
  }

  private *run(): Generator<BootStep, BootExit> {
    // Init: di; rBGP/rOBP0/rOBP1 = 0; DisableLCD; WRAM, VRAM, HRAM, OAM; LCDC_DEFAULT; StopAllSounds; ei.
    // DisableLCD's LY 145 wait crosses the next frame's VBlank with IE masked; the LCD goes off in that frame's step.
    this.stage = 'init';
    yield 'dark';
    this.screen.disableLcd();
    for (let tick = 2; tick <= INIT_DARK_TICKS; tick++) yield 'dark';
    // In the last dark frame's step: LCDC_DEFAULT, StopAllSounds, `ei`. The next frame's VBlank is serviced.
    this.screen.enableLcd(); stopAllSounds();
    // predef LoadSGB.
    this.stage = 'load-sgb';
    for (let frame = 0; frame < LOAD_SGB_FRAMES; frame++) yield;
    // PlayIntro: hJoyHeld = 0, hAutoBGTransferEnabled = 1; PlayShootingStar and PlayIntroScene (08b–14); hSCX = 0,
    // hAutoBGTransferEnabled = 0, ClearSprites, DelayFrame.
    this.stage = 'play-intro';
    textBgTransfer.enabled = true;
    textBgTransfer.enabled = false;
    yield;
    // Init's tail: DisableLCD (its LY 145 wait crosses one VBlank, serviced with the LCD off), ClearVram, GBPalNormal,
    // ClearSprites, LCDC_DEFAULT.
    this.stage = 'init-tail';
    yield;
    this.screen.disableLcd();
    for (let tick = 1; tick <= INIT_TAIL_DARK_TICKS; tick++) yield 'dark';
    // In the last dark frame's step: LCDC_DEFAULT, then `jp PrepareTitleScreen`.
    this.screen.enableLcd();
    return 'title';
  }
}
