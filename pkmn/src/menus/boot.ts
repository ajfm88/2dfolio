// Init (home/init.asm) and PlayIntro (engine/movie/intro.asm) as a frame program: the boot path from the splash click,
// the title's idle reset and the clear-save dialogue to PrepareTitleScreen. Opening checkpoint-08a (note 118). The frame
// counts are the cartridge's, measured by running its own code (note 118 §2.2, boot-frames.mjs). A yield is one frame:
// 'dark' when no VBlank is serviced (Init's `di` span, the LCD-off span of Init's tail), plain when one is; a palette
// command's two held frames are plain yields that core/vblank_hold.ts holds. PlayShootingStar runs whole: the copyright
// screen (checkpoint 08b, note 119), the Game Freak logo and the shooting star with the skip (09, note 120);
// PlayIntroScene (the movie, 10–14) is absent.
import { setAudioBank, stopAllSounds } from '../audio';
import { takeHeldFrame } from '../core/vblank_hold';
import { textBgTransfer } from '../text/bg_transfer';
import { HIDDEN_Y, LCDC_DEFAULT, OAM_BYTES, OpeningScreen, type OpeningImage } from './opening_screen';
import { presentOpeningScreen } from './opening_screen_render';
import { loadShootingStarImages, playShootingStar, type ShootingStarImages, type StarJoypad } from './shooting_star';

/** From `jp Init` to the first VBlank after `ei`: DisableLCD's wait, the WRAM, VRAM, HRAM and OAM clears with the LCD
 *  off, the LCD back on, StopAllSounds. 11.16 frames from the frame Init starts in: 10 dark ticks. */
export const INIT_DARK_TICKS = 10;
/** LoadSGB on a CGB: CheckSGB's packets and nine Wait7000 loops, with interrupts on. */
export const LOAD_SGB_FRAMES = 51;
/** Init's tail after PlayIntro: DisableLCD's serviced frame, then ClearVram, GBPalNormal, ClearSprites and LCDC_DEFAULT
 *  with the LCD off: 4.02 frames from that VBlank to the first one after EnableLCD, so 3 dark ticks. */
export const INIT_TAIL_DARK_TICKS = 3;
/** Init after LoadSGB: wAudioROMBank and wAudioSavedROMBank = BANK(SFX_Shooting_Star), Audio 3. */
export const STAR_AUDIO_BANK = 0x1f;

type BootStep = 'dark' | void;
export type BootExit = 'title';
/** An optional frame segment between the shooting star and PlayIntro's tail. Each yield is one frame, as in the other
 *  Boot steps; returning (or being skipped by the program itself) falls through to the same tail. */
export type OpeningSegment = (screen: OpeningScreen) => Generator<BootStep, void>;

export class Boot {
  private screen = new OpeningScreen();
  private images: ShootingStarImages | null = null;
  private previous: (() => void) | null = null;
  private program: Generator<BootStep, BootExit> | null = null;
  private dark = false;
  /** hJoyLast: Init clears it with the rest of HRAM; only the star's CheckForUserInterruption calls Joypad here. */
  private joy: StarJoypad = { last: 0 };
  private frame = 0;
  private stage = 'idle';

  /** `segment`: absent by default, which adds zero frames; main.ts keeps `new Boot()`. */
  constructor(private readonly segment?: OpeningSegment) {}

  async load(image?: (url: string) => Promise<OpeningImage>): Promise<void> {
    this.images = await loadShootingStarImages(image);
  }

  /** Inspection for tests. */
  get inspection() {
    return { frame: this.frame, stage: this.stage, dark: this.dark, lcd: this.screen.lcdOn, screen: this.screen } as const;
  }

  /** main, before VBlank's work: the coming frame has no VBlank. */
  get darkFrame(): boolean { return this.dark; }

  /** `jp Init`, up to its first frame. The caller has already cleared the HRAM the port keeps elsewhere. `previous` draws
   *  the picture on screen when Init begins: on the CGB, Init's rBGP = 0 changes no colour, so it stays until the LCD
   *  goes off in the next frame's step. */
  start(previous: (() => void) | null = null): void {
    if (!this.images) throw new Error('Boot.start before load');
    this.screen = new OpeningScreen(); this.frame = 0; this.previous = previous; this.joy = { last: 0 };
    // Init's WRAM clear: wTileMap is all $00 until ClearScreen (the BG maps are ' ', ClearBgMap's).
    this.screen.tileMap.fill(0);
    this.program = this.run(this.images);
    this.dark = this.program.next().value === 'dark';
  }

  /** One frame; 'title' in the step that jumps to PrepareTitleScreen. */
  update(): BootExit | null {
    if (!this.program) return null;
    if (this.dark) this.dark = false;
    else if (!takeHeldFrame()) this.screen.vblank();
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

  private *run(images: ShootingStarImages): Generator<BootStep, BootExit> {
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
    yield;
    // The first serviced VBlank's PrepareOAMData, after its OAM DMA: wUpdateSpritesEnabled is 0 (Init's WRAM clear), so
    // it stores $FF and jumps to HideSprites: every Y at SCREEN_HEIGHT_PX + OAM_Y_OFS. Nothing shows either way.
    for (let at = 0; at < OAM_BYTES; at += 4) this.screen.oam[at] = HIDDEN_Y;
    for (let frame = 1; frame < LOAD_SGB_FRAMES; frame++) yield;
    // The audio bank for SFX_SHOOTING_STAR. hAutoBGTransferDest is vBGMap1 (OpeningScreen's default) and
    // wUpdateSpritesEnabled $FF (PrepareOAMData returns at once: shadow OAM is the program's).
    setAudioBank(STAR_AUDIO_BANK);
    // PlayIntro: hJoyHeld = 0, hAutoBGTransferEnabled = 1; PlayShootingStar.
    this.stage = 'shooting-star';
    textBgTransfer.enabled = true;
    yield* playShootingStar(this.screen, images, this.joy);
    // The optional segment: a fresh generator per run, so every start() begins it afresh.
    if (this.segment) {
      this.stage = 'opening-segment';
      yield* this.segment(this.screen);
    }
    // PlayIntroScene (10–14) is absent; PlayIntro's tail: hSCX = 0, hAutoBGTransferEnabled = 0, ClearSprites, DelayFrame.
    this.stage = 'play-intro';
    textBgTransfer.enabled = false;
    this.screen.hScx = 0;
    this.screen.oam.fill(0);
    yield;
    // Init's tail: DisableLCD (its LY 145 wait crosses one VBlank, serviced with the LCD off), ClearVram, GBPalNormal,
    // ClearSprites, LCDC_DEFAULT.
    this.stage = 'init-tail';
    yield;
    this.screen.disableLcd();
    for (let tick = 1; tick <= INIT_TAIL_DARK_TICKS; tick++) yield 'dark';
    // In the last dark frame's step: LCDC_DEFAULT, then `jp PrepareTitleScreen`.
    this.screen.enableLcd();
    this.screen.lcdc = LCDC_DEFAULT;
    return 'title';
  }
}
