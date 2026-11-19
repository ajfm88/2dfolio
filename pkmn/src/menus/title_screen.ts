// The title screen: engine/movie/title.asm (PrepareTitleScreen, DisplayTitleScreen, .loop, .go_to_main_menu,
// .doTitlescreenReset, DoTitleScreenFunction, IncrementResetCounter) and engine/movie/title_yellow.asm (the graphics,
// the three placements, the eyes' OAM). Opening checkpoints 05 and 06 (notes 114, 115): a frame program on the
// opening's screen model (a yield is one DelayFrame; VBlank's half runs first in each update). The program ends where
// the title's code jumps away: MainMenu, DoClearSaveDialogue or Init.
import { joyHeld } from '../input';
import { getRawImageData } from '../renderer';
import { holdVBlank, takeHeldFrame } from '../core/vblank_hold';
import {
  fadeOutAndStopMusic, isAudioFadingOut, isSoundFinished, loadPikachuClip, playNewMusic, playPikachuSoundClip, playSFX,
  setAudioBank, stopAllMusic,
} from '../audio';
import { textBgTransfer } from '../text/bg_transfer';
import { setFastTextDelay } from '../text/text_flags';
import { BG_MAP0, BG_MAP1, OpeningScreen, SPACE_TILE, type OpeningImage } from './opening_screen';
import { presentOpeningScreen } from './opening_screen_render';
import { TITLE_BG0_ATTRIBUTES, TITLE_BG1_ATTRIBUTES } from './title_attributes';

/** BANK(Music_TitleScreen): PrepareTitleScreen's audio bank (Audio 3). */
export const TITLE_AUDIO_BANK = 0x1f;
/** The LCD-off span, in frames with no VBlank (note 114 §2.3): ≈ 64,100 machine cycles of copies plus the deferred
 *  VBlank's handler, then 144 lines to the first VBlank after EnableLCD, ≈ 4.7 frames from the deferred VBlank. */
export const TITLE_LCD_OFF_FRAMES = 4;
/** .TitleScreenPokemonLogoYScrolls: a step for hSCY and how many frames it runs. */
export const LOGO_BOUNCE: readonly (readonly [number, number])[] = [[-4, 16], [3, 4], [-3, 4], [2, 2], [-2, 2], [1, 2], [-1, 2]];
/** .tileScreenCopyrightTiles: ©1995-1999 GAME FREAK inc. */
export const COPYRIGHT_TILES: readonly number[] = [0xe0, 0xe1, 0xe2, 0xe3, 0xe1, 0xe2, 0xee, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xeb, 0xec, 0xed];
/** TitleScreenPikachuEyesOAMData: Y, X, tile, attributes (X flip, CGB OBJ palette 2). */
export const PIKACHU_EYES_OAM: readonly number[] = [
  0x60, 0x40, 0xf1, 0x22, 0x60, 0x48, 0xf0, 0x22, 0x68, 0x40, 0xf3, 0x22, 0x68, 0x48, 0xf2, 0x22,
  0x60, 0x60, 0xf0, 0x02, 0x60, 0x68, 0xf1, 0x02, 0x68, 0x60, 0xf2, 0x02, 0x68, 0x68, 0xf3, 0x02,
];
/** PalPacket_Titlescreen: PAL_LOGO2, PAL_LOGO1, PAL_MEWMON, PAL_PURPLEMON. */
export const TITLE_PALETTES: readonly string[] = ['LOGO2', 'LOGO1', 'MEWMON', 'PURPLEMON'];
/** PokemonLogoGraphicsEnd - PokemonLogoGraphics = $730 bytes (3d:46fb–3d:4e2b): pret trims the sheet's white tail
 *  (Makefile --trim-whitespace). The committed PNG pads to 128 tiles with the bytes that follow, so only 115 are
 *  copied; tiles $73–$7F keep what VRAM held, and ' ' ($7F) is one of them. */
export const POKEMON_LOGO_TILES = 115;
/** Pikachu's voice on the title (ldpikacry e, PikachuCry1) and on leaving it (PikachuCry11). */
export const TITLE_CLIPS: readonly number[] = [1, 11];
/** IncrementResetCounter: the loop's pass that finds wTitleScreenResetCounter at $0C00 resets the game. It counts
 *  before each pass's DelayFrame, so the reset comes in the step of the loop's 3,071st frame (note 115 §2.1). */
export const TITLE_RESET_PASSES = 0x0c00;
/** .doTitlescreenReset: wAudioFadeOutControl = the `ld a, d` IncrementResetCounter left in A. */
export const TITLE_RESET_FADE = 0x0c;
/** PAD_UP | PAD_SELECT | PAD_B: the loop's exact match, and the exit's masked test for DoClearSaveDialogue. */
export const CLEAR_SAVE_BUTTONS = 0x46;
/** PAD_A | PAD_START: the release build's other exit (the debug build adds PAD_SELECT). */
export const TITLE_EXIT_BUTTONS = 0x09;
/** LoadGBPal with wMapPalOffset 0 (home/fade.asm): FadePal4's rBGP, rOBP0 and rOBP1. */
export const FADE_PAL4: readonly [number, number, number] = [0xe4, 0xd0, 0xe0];

/** Where the title's code jumps: `jp MainMenu`, `farjp DoClearSaveDialogue` (checkpoint 07) or `jp Init`. */
export type TitleExit = 'main_menu' | 'clear_save' | 'reset';

export interface TitleImages {
  font: OpeningImage; copyright: OpeningImage; nine: OpeningImage; gamefreak: OpeningImage;
  logo: OpeningImage; corner: OpeningImage; pikachuBg: OpeningImage; pikachuOb: OpeningImage;
}
export interface TitleAssets extends TitleImages {
  logoMap: Uint8Array; bubbleMap: Uint8Array; pikachuMap: Uint8Array;
}
const IMAGE_URLS: Readonly<Record<keyof TitleImages, string>> = {
  font: '/gfx/font/font.png', copyright: '/gfx/splash/copyright.png', nine: '/gfx/title/nine.png',
  gamefreak: '/gfx/title/gamefreak_inc.png', logo: '/gfx/title/pokemon_logo.png',
  corner: '/gfx/title/pokemon_logo_corner.png', pikachuBg: '/gfx/title/pikachu_bg.png', pikachuOb: '/gfx/title/pikachu_ob.png',
};
const TILEMAP_URLS = {
  logoMap: '/gfx/title/pokemon_logo.tilemap', bubbleMap: '/gfx/title/pika_bubble.tilemap', pikachuMap: '/gfx/title/pikachu.tilemap',
} as const;

export type TitleAudioRequest = {
  readonly frame: number; readonly kind: 'bank' | 'sfx' | 'clip' | 'stop' | 'music' | 'fade'; readonly value: string | number;
};
type TitleStep = 'dark' | void;
type TitleProgram = Generator<TitleStep, TitleExit>;

function tiles(image: OpeningImage): number { return (image.width >> 3) * (image.height >> 3); }

export class TitleScreen {
  private screen = new OpeningScreen();
  private assets: TitleAssets | null = null;
  private program: TitleProgram | null = null;
  private dark = false;
  private frame = 0;
  private stage = 'idle';
  private scene = 0;
  private timer = 0;
  private resetCounter = 0;
  private requests: TitleAudioRequest[] = [];

  async load(
    image: (url: string) => Promise<OpeningImage> = getRawImageData,
    bytes: (url: string) => Promise<Uint8Array> = fetchTilemap,
  ): Promise<void> {
    const names = Object.keys(IMAGE_URLS) as (keyof TitleImages)[];
    const loaded = await Promise.all(names.map(name => image(IMAGE_URLS[name])));
    const [logoMap, bubbleMap, pikachuMap] = await Promise.all(
      [TILEMAP_URLS.logoMap, TILEMAP_URLS.bubbleMap, TILEMAP_URLS.pikachuMap].map(bytes));
    // Rule 3 of note 113 §3: the clips a frame program plays are loaded before it can start.
    await Promise.all(TITLE_CLIPS.map(loadPikachuClip));
    this.assets = { ...Object.fromEntries(names.map((name, i) => [name, loaded[i]])) as unknown as TitleImages,
      logoMap, bubbleMap, pikachuMap };
  }

  /** Inspection for tests: the model, the program's stage, the frame count since start and the audio requests. */
  get inspection() {
    return { screen: this.screen, stage: this.stage, frame: this.frame, scene: this.scene, timer: this.timer,
      resetCounter: this.resetCounter, dark: this.dark, audioRequests: this.requests.map(request => ({ ...request })) } as const;
  }

  /** main, before VBlank's work: the coming frame has no VBlank (the LCD is off). */
  get darkFrame(): boolean { return this.dark; }

  /** PrepareTitleScreen, then DisplayTitleScreen up to its first DelayFrame (Init's `jp PrepareTitleScreen`). */
  start(): void { this.begin(true); }

  /** DisplayTitleScreen up to its first DelayFrame, without PrepareTitleScreen: MainMenu's B (main_menu.asm:66–68,
   *  `jp nz, DisplayTitleScreen`). The audio bank and the playing title song are left as they are. */
  display(): void { this.begin(false); }

  private begin(prepare: boolean): void {
    if (!this.assets) throw new Error('TitleScreen.start before load');
    // A fresh model each time: on the B path the cartridge's VRAM still holds the main menu's tiles, but nothing the
    // title shows reads them (note 115 §2.6).
    this.screen = new OpeningScreen();
    this.frame = 0; this.dark = false; this.requests = []; this.scene = 0; this.timer = 0; this.resetCounter = 0;
    this.program = this.titleScreen(this.assets, prepare);
    this.program.next();
  }

  /** One frame: VBlank's half (none while the LCD is off or a palette command holds the frame), then the CPU until
   *  its next DelayFrame. Where the title's code jumps, in the step that jumps; null while it stays. */
  update(): TitleExit | null {
    // Only main's tests enter the state without start(): they get the loop at once, on an empty screen.
    if (!this.program) { this.program = this.titleLoop(); this.program.next(); }
    if (this.dark) this.dark = false;
    else if (!takeHeldFrame()) this.screen.vblank();
    this.frame++;
    const step = this.program.next();
    if (!step.done) {
      if (step.value === 'dark') this.dark = true;
      return null;
    }
    this.program = null;
    return step.value;
  }

  render(): void { presentOpeningScreen(this.screen); }

  private request(kind: TitleAudioRequest['kind'], value: string | number): void {
    this.requests.push({ frame: this.frame, kind, value });
  }

  private *titleScreen(assets: TitleAssets, prepare: boolean): TitleProgram {
    const s = this.screen;
    if (prepare) {
      // PrepareTitleScreen: hWY = 0 (DisplayTitleScreen overwrites it before any frame), wLetterPrintingDelayFlags = 0
      // (BIT_FAST_TEXT_DELAY clear: the clear-save dialogue prints one frame a letter), the audio bank.
      s.hWy = 0;
      setFastTextDelay(false);
      setAudioBank(TITLE_AUDIO_BANK); this.request('bank', TITLE_AUDIO_BANK);
    }
    // DisplayTitleScreen: GBPalWhiteOut; hAutoBGTransferEnabled = 1; hTileAnimations = 0 (the port's title has none).
    this.stage = 'build';
    s.bgp = 0; s.obp0 = 0; s.obp1 = 0;
    textBgTransfer.enabled = true;
    s.hScx = 0; s.hScy = 0x40; s.hWy = 0x90;
    // ClearScreen: wTileMap, then Delay3.
    s.tileMap.fill(SPACE_TILE);
    yield* frames(3);
    // DisableLCD: the LY 145 wait crosses one VBlank, serviced when IE is restored with the LCD already off.
    yield;
    s.disableLcd();
    this.stage = 'lcd-off';
    this.loadTitleTiles(assets);
    // FillMemory: vBGMap0 and vBGMap1's first $40 bytes with ' '.
    s.fillBg(BG_MAP0, 0x440, SPACE_TILE);
    // TitleScreen_PlacePokemonLogo, FillSpriteBuffer0WithAA (SRAM, not modelled), .WriteCopyrightTiles.
    this.copyBox(assets.logoMap, 2, 1, 16, 7);
    COPYRIGHT_TILES.forEach((tile, i) => s.tileMap.put(2 + i, 17, tile));
    // SaveScreenTilesToBuffer2, then LoadScreenTilesFromBuffer2 (the same cells; the transfer ends enabled).
    const buffer2 = s.tileMap.cells;
    for (let frame = 0; frame < TITLE_LCD_OFF_FRAMES; frame++) yield 'dark';
    s.enableLcd();
    this.stage = 'build';
    // TitleScreen_PlacePikachu: the tilemap, four extra tiles, the eyes into wShadowOAM.
    this.copyBox(assets.pikachuMap, 4, 8, 12, 9);
    [[10, 0x96], [11, 0x9d], [12, 0xa7], [13, 0xb1]].forEach(([row, tile]) => s.tileMap.put(16, row, tile));
    s.oam.set(PIKACHU_EYES_OAM);
    // TitleScreenCopyTileMapToVRAM $9B: rows 0–7 to vBGMap0's rows 24–31, rows 8–17 to the window's rows 0–9.
    s.bgTransferDest = BG_MAP0 + 0x300;
    yield* frames(3);
    const buffer1 = s.tileMap.cells;
    s.hWy = 0x40;
    this.loadCells(buffer2);
    s.bgTransferDest = BG_MAP0;
    yield* frames(3);
    // SET_PAL_TITLE_SCREEN on CGB: InitCGBPalettes for both register sets, then LoadBGMapAttributes' two held
    // frames and SendSGBPackets' Delay3 (DECISIONS #73).
    s.bgPalettes = [...TITLE_PALETTES];
    s.objPalettes = [...TITLE_PALETTES, ...TITLE_PALETTES];
    s.setAttributes(0, TITLE_BG0_ATTRIBUTES);
    s.setAttributes(1, TITLE_BG1_ATTRIBUTES);
    holdVBlank();
    yield; yield;
    yield* frames(3);
    // GBPalNormal; rOBP0 = %11100000.
    s.bgp = 0xe4; s.obp0 = 0xd0;
    s.obp0 = 0xe0;
    this.stage = 'bounce';
    for (const [step, count] of LOGO_BOUNCE) {
      if (step === -3) { playSFX('intro_crash'); this.request('sfx', 'intro_crash'); }
      for (let i = 0; i < count; i++) {
        yield;
        s.hScy = (s.hScy + step) & 0xff;
      }
    }
    // .finishedBouncingPokemonLogo
    this.loadCells(buffer1);
    this.stage = 'wait';
    yield* frames(36);
    playSFX('intro_whoosh'); this.request('sfx', 'intro_whoosh');
    // TitleScreen_PlacePikaSpeechBubble; the window off-screen (SCREEN_HEIGHT_PX).
    this.copyBox(assets.bubbleMap, 6, 4, 7, 4);
    s.tileMap.put(9, 8, 0x64); s.tileMap.put(10, 8, 0x65);
    s.hWy = 144;
    this.stage = 'bubble';
    yield* frames(3);
    this.stage = 'clip';
    this.request('clip', 1);
    yield* playPikachuSoundClip(1);
    // WaitForSoundToFinish: the clip has cleared the four SFX ids, so this returns at once.
    while (!isSoundFinished()) yield;
    stopAllMusic(); this.request('stop', 0xff);
    playNewMusic('titlescreen'); this.request('music', 'titlescreen');
    return yield* this.titleLoop();
  }

  /** .loop and .titleScreenLoop (the release build: PAD_A | PAD_START, no debug menu). */
  private *titleLoop(): TitleProgram {
    this.stage = 'loop';
    // .loop: wTitleScreenScene, wTitleScreenTimer and wTitleScreenResetCounter = 0. wUnusedFlag and
    // wTitleScreenPikachuCry (read only by the unreferenced .incrementPikachuCry) have no reader.
    this.scene = 0; this.timer = 0; this.resetCounter = 0;
    for (;;) {
      // IncrementResetCounter, before the pass's DelayFrame: `inc de`, then the reset when D reaches $0C.
      this.resetCounter = (this.resetCounter + 1) & 0xffff;
      if (this.resetCounter === TITLE_RESET_PASSES) return yield* this.titleScreenReset();
      yield;
      // JoypadLowSensitivity → Joypad: hJoyHeld. Its hJoy5 and hFrameCounter writes have no reader before
      // hFrameCounter (at most 30) runs out (note 115 §2.3).
      const held = joyHeld();
      if (held === CLEAR_SAVE_BUTTONS || (held & TITLE_EXIT_BUTTONS) !== 0) return yield* this.goToMainMenu(held);
      this.titleScreenFunction();
    }
  }

  /** .go_to_main_menu: clip 11, the white-out, both BG maps blanked, LoadGBPal, then the jump `held` chooses. */
  private *goToMainMenu(held: number): TitleProgram {
    const s = this.screen;
    this.stage = 'exit';
    this.request('clip', 11);
    yield* playPikachuSoundClip(11);
    // GBPalWhiteOutWithDelay3 (home/palettes.asm).
    this.stage = 'white-out';
    s.bgp = 0; s.obp0 = 0; s.obp1 = 0;
    yield* frames(3);
    // ClearSprites; hWY = 0; hAutoBGTransferEnabled = 1 (already set); ClearScreen.
    s.oam.fill(0);
    s.hWy = 0;
    textBgTransfer.enabled = true;
    s.tileMap.fill(SPACE_TILE);
    yield* frames(3);
    // TitleScreenCopyTileMapToVRAM for vBGMap0, then vBGMap1 (each sets the destination, then Delay3); Delay3.
    s.bgTransferDest = BG_MAP0;
    yield* frames(3);
    s.bgTransferDest = BG_MAP1;
    yield* frames(3);
    yield* frames(3);
    // LoadGBPal. wMapPalOffset is 0: no map the port has is dark (note 115 §2.3), so FadePal4.
    [s.bgp, s.obp0, s.obp1] = FADE_PAL4;
    // hJoyHeld is still the loop's value: nothing since has called Joypad.
    return (held & CLEAR_SAVE_BUTTONS) === CLEAR_SAVE_BUTTONS ? 'clear_save' : 'main_menu';
  }

  /** .doTitlescreenReset: the song fades out, then `jp Init`. */
  private *titleScreenReset(): TitleProgram {
    this.stage = 'reset';
    // wAudioFadeOutControl = $0C; StopAllMusic queues the stop behind the fade (wLastMusicSoundID is not $FF).
    fadeOutAndStopMusic(TITLE_RESET_FADE); this.request('fade', TITLE_RESET_FADE);
    // .audioFadeLoop spins with no DelayFrame; FadeOutAudio clears the control in a VBlank and the spin sees it at once.
    while (isAudioFadingOut()) yield;
    return 'reset';
  }

  /** DoTitleScreenFunction: .CheckTimer reads the timer before incrementing it, then the scene's routine. */
  private titleScreenFunction(): void {
    const timer = this.timer;
    this.timer = (this.timer + 1) & 0xff;
    if (timer === 0 || timer === 0x80 || timer === 0x90) this.scene = 1;
    switch (this.scene) {
      case 0: return;
      case 1: case 7: this.loadBlinkFrame(4); break;
      case 4: this.loadBlinkFrame(8); break;
      case 10: this.loadBlinkFrame(0); break;
      case 11: this.scene = 0; return;
    }
    this.scene++;
  }

  /** .LoadBlinkFrame: the eight eye entries' tile ids, `and $f3` then `or e`. */
  private loadBlinkFrame(e: number): void {
    for (let entry = 0; entry < 8; entry++) this.screen.oam[entry * 4 + 2] = (this.screen.oam[entry * 4 + 2] & 0xf3) | e;
  }

  /** The LCD-off copies, in DisplayTitleScreen's order (later copies overwrite earlier ones). */
  private loadTitleTiles(a: TitleAssets): void {
    const s = this.screen;
    // LoadFontTilePatterns (LCD off: FarCopyDataDouble, 1bpp to 2bpp) to vFont = vChars1.
    s.loadTiles(0x80, a.font, tiles(a.font));
    // vTitleLogo = vChars1: the copyright logo's five tiles at $60, the 9 at $6E, Game Freak's nine at $65.
    s.loadTiles(0x80 + 0x60, a.copyright, 5);
    s.loadTiles(0x80 + 0x6e, a.nine, 1);
    s.loadTiles(0x80 + 0x65, a.gamefreak, 9);
    // LoadYellowTitleScreenGFX: the logo to vChars2, its corner to vChars1 $7D, Pikachu's BG to vChars1, the eyes
    // to vChars1 $70 (objects read them as tiles $F0–$FB).
    s.loadTiles(0x100, a.logo, POKEMON_LOGO_TILES);
    s.loadTiles(0x80 + 0x7d, a.corner, tiles(a.corner));
    s.loadTiles(0x80, a.pikachuBg, tiles(a.pikachuBg));
    s.loadTiles(0x80 + 0x70, a.pikachuOb, tiles(a.pikachuOb));
  }

  /** Bank3D_CopyBox: a width × height block of tile ids into wTileMap. */
  private copyBox(map: Uint8Array, x: number, y: number, width: number, height: number): void {
    if (map.length !== width * height) throw new Error(`title tilemap is ${map.length} bytes, not ${width} × ${height}`);
    for (let row = 0; row < height; row++) for (let col = 0; col < width; col++)
      this.screen.tileMap.put(x + col, y + row, map[row * width + col]);
  }

  /** LoadScreenTilesFromBuffer1/2: a saved wTileMap copied back. */
  private loadCells(cells: readonly number[]): void {
    cells.forEach((cell, index) => this.screen.tileMap.set(index, cell));
  }
}

function* frames(count: number): Generator<TitleStep, void> {
  for (let frame = 0; frame < count; frame++) yield;
}

async function fetchTilemap(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}
