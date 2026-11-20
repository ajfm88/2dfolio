// PlayShootingStar (engine/movie/intro.asm) and AnimateShootingStar (engine/movie/splash.asm): the copyright screen
// (SET_PAL_GAME_FREAK_INTRO, LoadCopyrightAndTextBoxTiles in engine/movie/title.asm, rBGP and UpdateCGBPal_BGP,
// DelayFrames 180; opening checkpoint-08b, note 119), then the Game Freak logo and the shooting star with the skip
// (ClearScreen, DisableLCD, the black bars and the tile copies, rLCDC, DelayFrames 64, AnimateShootingStar, DelayFrames
// 40 unless skipped, IntroClearMiddleOfScreen, ClearSprites, Delay3; checkpoint 09, note 120). A frame program on Boot's
// screen model (a yield is one frame); the frame counts are the cartridge's, measured by running its own code (notes
// 119 §2.2 and 120 §2.2, copyright-frames.mjs and star-frames.mjs). AnimateShootingStar's loops are ported byte for byte
// on shadow OAM, its bugs included.
import { playSFX } from '../audio';
import { holdVBlank } from '../core/vblank_hold';
import { joyHeld, PAD } from '../input';
import { getRawImageData } from '../renderer';
import {
  BG_MAP1, HIDDEN_Y, LCDC_BG_MAP, LCDC_DEFAULT, LCDC_WINDOW, SPACE_TILE, bgTileIndex, type OpeningImage, type OpeningScreen,
} from './opening_screen';

/** PalPacket_GameFreakIntro: PAL_GAMEFREAK, PAL_REDMON, PAL_VIRIDIAN, PAL_BLUEMON. */
export const GAME_FREAK_INTRO_PALETTES: readonly string[] = ['GAMEFREAK', 'REDMON', 'VIRIDIAN', 'BLUEMON'];

/** BGMapAttributes_GameFreakIntro (data/cgb/bg_map_attributes.asm), 2f:54a0: count $23, word $000d. */
export const GAME_FREAK_INTRO_ATTRIBUTE_HEADER: readonly number[] = [0x23, 0x0d, 0x00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

/** The one 18 × 32 block: LoadBGMapAttributes' second pointer is the first plus 3 plus $000d, so vBGMap0 and vBGMap1
 *  get the same bytes. Rows 11–13: the falling stars' palettes 1 (columns 5–7), 2 (8–9) and 3 (12–14). */
export const GAME_FREAK_INTRO_ATTRIBUTES: readonly number[] = Array.from({ length: 18 * 32 }, (_, index) => {
  const row = index >> 5, col = index & 31;
  if (row < 11 || row > 13) return 0;
  if (col >= 5 && col <= 7) return 1;
  if (col >= 8 && col <= 9) return 2;
  if (col >= 12 && col <= 14) return 3;
  return 0;
});

/** CopyrightTextString's three lines (`next` between them), placed from (2, 7) two rows apart. */
export const COPYRIGHT_TEXT: readonly (readonly number[])[] = [
  [0x60, 0x61, 0x62, 0x63, 0x61, 0x62, 0x7c, 0x7f, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a],
  [0x60, 0x61, 0x62, 0x63, 0x61, 0x62, 0x7c, 0x7f, 0x6b, 0x6c, 0x6d, 0x6e, 0x6f, 0x70, 0x71, 0x72],
  [0x60, 0x61, 0x62, 0x63, 0x61, 0x62, 0x7c, 0x7f, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x7b],
];
/** TextBoxGraphicsEnd - TextBoxGraphics: LoadTextBoxTilePatterns' 32 tiles to vChars2 tile $60. */
export const TEXT_BOX_TILES = 32;
/** LoadCopyrightTiles: (TextBoxGraphics + $10 - NintendoCopyrightLogoGraphics) / 16 = 30 tiles to vChars2 tile $60.
 *  pret's "bug": the span runs through GameFreakLogoGraphics and NineTile into TextBoxGraphics' first tile. */
export const COPYRIGHT_SPAN_TILES = 30;
/** PlayShootingStar's `ld c, 180; call DelayFrames`: no joypad read, so the copyright cannot be skipped. */
export const COPYRIGHT_FRAMES = 180;
/** ldpal SHADE_BLACK, SHADE_DARK, SHADE_LIGHT, SHADE_WHITE. */
export const COPYRIGHT_BGP = 0xe4;

/** rLCDC after EnableLCD: `res B_LCDC_WINDOW` and `set B_LCDC_BG_MAP` on LCDC_DEFAULT ($E3), so $CB. */
export const STAR_LCDC = (LCDC_DEFAULT & ~LCDC_WINDOW) | LCDC_BG_MAP;
/** `ld c, 64; call DelayFrames` after EnableLCD: the black bars alone. */
export const BARS_FRAMES = 64;
/** `ld c, 40; call DelayFrames` after AnimateShootingStar, unless the player interrupted it. */
export const STAR_HOLD_FRAMES = 40;
/** GameFreakIntroEnd - GameFreakIntro: gamefreak_presents (13 tiles), gamefreak_logo (6), `ds TILE_SIZE, $00` (1). */
export const GAME_FREAK_INTRO_TILES = 20;
/** LoadShootingStarGraphics: rOBP0 $F9 and rOBP1 $A4. */
export const STAR_OBP0 = 0xf9;
export const STAR_OBP1 = 0xa4;
/** MoveAnimationTiles1 tile 3 and tile 19 (the big star's top-left and bottom-left quadrants) to vChars1 tiles $20 and
 *  $21 (objects $A0, $A1); FallingStar (1 tile) to $22 ($A2). */
export const BIG_STAR_SOURCE_TILES: readonly number[] = [3, 19];
export const FALLING_STAR_TILES = 1;

/** GameFreakLogoOAMData: Y, X, tile, attributes (dbsprite: tile coordinates × 8, no OAM offsets), to wShadowOAMSprite24. */
export const GAME_FREAK_LOGO_OAM: readonly number[] = [
  [10, 9, 0x8d], [11, 9, 0x8e], [10, 10, 0x8f], [11, 10, 0x90], [10, 11, 0x91], [11, 11, 0x92],
  [6, 12, 0x80], [7, 12, 0x81], [8, 12, 0x82], [9, 12, 0x83], [10, 12, 0x93], [11, 12, 0x84], [12, 12, 0x85],
  [13, 12, 0x83], [14, 12, 0x81], [15, 12, 0x86],
].flatMap(([x, y, tile]) => [y * 8, x * 8, tile, 0]);
/** GameFreakShootingStarOAMData, to wShadowOAM: OAM_PAL1 | OAM_HIGH_PALS ($14), the right half X-flipped ($34). */
export const GAME_FREAK_SHOOTING_STAR_OAM: readonly number[] = [
  0, 160, 0xa0, 0x14, 0, 168, 0xa0, 0x34, 8, 160, 0xa1, 0x14, 8, 168, 0xa1, 0x34,
];
/** SmallStarsOAM: dbsprite 0, 0, 0, 0, $A2, OAM_PRIO | OAM_PAL1. AnimateShootingStar copies it 24 times. */
export const SMALL_STARS_OAM: readonly number[] = [0, 0, 0xa2, 0x90];
/** SmallStarsWave1Coords … SmallStarsWave4Coords (Y, X, CGB palette), then SmallStarsEmptyWave twice. */
export const SMALL_STARS_WAVES: readonly (readonly number[] | null)[] = [
  [0x68, 0x30, 0x05, 0x68, 0x40, 0x05, 0x68, 0x58, 0x04, 0x68, 0x78, 0x07],
  [0x68, 0x38, 0x05, 0x68, 0x48, 0x06, 0x68, 0x60, 0x04, 0x68, 0x70, 0x07],
  [0x68, 0x34, 0x05, 0x68, 0x4c, 0x06, 0x68, 0x54, 0x06, 0x68, 0x64, 0x07],
  [0x68, 0x3c, 0x05, 0x68, 0x5c, 0x04, 0x68, 0x6c, 0x07, 0x68, 0x74, 0x07],
  null, null,
];
/** CheckForUserInterruption (the release build): Up+Select+B held exactly, or A or START newly pressed. */
export const INTERRUPT_HELD = PAD.up | PAD.select | PAD.b;
export const INTERRUPT_PRESSED = PAD.start | PAD.a;

export interface ShootingStarImages {
  copyright: OpeningImage; gamefreak: OpeningImage; nine: OpeningImage; textBox: OpeningImage;
  presents: OpeningImage; logo: OpeningImage; fallingStar: OpeningImage; moveAnim: OpeningImage;
}
const IMAGE_URLS: Readonly<Record<keyof ShootingStarImages, string>> = {
  copyright: '/gfx/splash/copyright.png', gamefreak: '/gfx/title/gamefreak_inc.png', nine: '/gfx/title/nine.png',
  textBox: '/gfx/font/font_extra.png', presents: '/gfx/splash/gamefreak_presents.png', logo: '/gfx/splash/gamefreak_logo.png',
  fallingStar: '/gfx/splash/falling_star.png', moveAnim: '/gfx/battle/move_anim_1.png',
};

export async function loadShootingStarImages(image: (url: string) => Promise<OpeningImage> = getRawImageData): Promise<ShootingStarImages> {
  const names = Object.keys(IMAGE_URLS) as (keyof ShootingStarImages)[];
  const loaded = await Promise.all(names.map(name => image(IMAGE_URLS[name])));
  return Object.fromEntries(names.map((name, i) => [name, loaded[i]])) as unknown as ShootingStarImages;
}

function tiles(image: OpeningImage): number { return (image.width >> 3) * (image.height >> 3); }

/** The ROM span LoadCopyrightTiles reads, tile by tile: the copyright logo, Game Freak's, the 9, then the text box's. */
export function copyrightSpan(a: ShootingStarImages): [OpeningImage, number][] {
  const span: [OpeningImage, number][] = [];
  for (const image of [a.copyright, a.gamefreak, a.nine, a.textBox])
    for (let tile = 0; tile < tiles(image) && span.length < COPYRIGHT_SPAN_TILES; tile++) span.push([image, tile]);
  if (span.length !== COPYRIGHT_SPAN_TILES) throw new Error('copyright span short of 30 tiles');
  return span;
}

/** hJoyLast, which Init's HRAM clear zeroes: the last Joypad call's buttons. */
export interface StarJoypad { last: number }

/** GameFreakIntro's 20 tiles, FarCopyData'd with the LCD off to VRAM tile `vramTile` onwards. */
function copyGameFreakIntro(s: OpeningScreen, a: ShootingStarImages, vramTile: number): void {
  s.loadTiles(vramTile, a.presents, tiles(a.presents));
  s.loadTiles(vramTile + tiles(a.presents), a.logo, tiles(a.logo));
  s.fillTile(vramTile + GAME_FREAK_INTRO_TILES - 1, 0x00);
}

/** PlayShootingStar, the whole routine. Starts in the step that calls it; ends in the step where its Delay3 returns. */
export function* playShootingStar(s: OpeningScreen, a: ShootingStarImages, joy: StarJoypad): Generator<'dark' | void, void> {
  // SET_PAL_GAME_FREAK_INTRO on a CGB: InitCGBPalettes for the palette packet (both register sets), then the block
  // packet's TranslatePalPacketToBGMapAttributes: LoadBGMapAttributes' two held frames, then SendSGBPackets' Delay3
  // (DECISIONS #73). SetPal_GameFreakIntro also sets wDefaultPaletteCommand to SET_PAL_GENERIC (no reader in the port).
  s.bgPalettes = [...GAME_FREAK_INTRO_PALETTES];
  s.objPalettes = [...GAME_FREAK_INTRO_PALETTES, ...GAME_FREAK_INTRO_PALETTES];
  s.setAttributes(0, GAME_FREAK_INTRO_ATTRIBUTES);
  s.setAttributes(1, GAME_FREAK_INTRO_ATTRIBUTES);
  holdVBlank();
  yield; yield;
  yield* frames(3);
  // LoadCopyrightAndTextBoxTiles: hWY = 0 (the window, vBGMap1, covers the screen); ClearScreen and its Delay3.
  s.hWy = 0;
  s.tileMap.fill(SPACE_TILE);
  yield* frames(3);
  // LoadTextBoxTilePatterns with the LCD on: CopyVideoData, 8 tiles a VBlank, the BG transfer off meanwhile.
  yield* s.videoCopy.copy(TEXT_BOX_TILES, i => s.loadTiles(bgTileIndex(0x60) + i, a.textBox, 1, i));
  // LoadCopyrightTiles, the same way, over the text box's first 30 tiles.
  const span = copyrightSpan(a);
  yield* s.videoCopy.copy(COPYRIGHT_SPAN_TILES, i => s.loadTiles(bgTileIndex(0x60) + i, span[i][0], 1, span[i][1]));
  // PlaceString from (2, 7).
  COPYRIGHT_TEXT.forEach((line, n) => line.forEach((tile, x) => s.tileMap.put(2 + x, 7 + 2 * n, tile)));
  // rBGP = $E4; UpdateCGBPal_BGP (wLastBGP is 0) waits for LY 144 with interrupts off, so its VBlank is serviced as
  // it returns: the frame is a plain one.
  s.bgp = COPYRIGHT_BGP;
  yield;
  yield* frames(COPYRIGHT_FRAMES);
  // ClearScreen and its Delay3: the copyright goes, a third at a time.
  s.tileMap.fill(SPACE_TILE);
  yield* frames(3);
  // DisableLCD: its LY 145 wait crosses one VBlank, serviced with the LCD off.
  yield;
  s.disableLcd();
  // wCurOpponent = 0 (no reader before the battle). IntroDrawBlackBars: IntroClearScreen zeroes vBGMap1's 18 rows,
  // then four rows of tile 1 at the top and bottom of wTileMap and of vBGMap1.
  s.fillBg(BG_MAP1, 32 * 18, 0);
  for (let x = 0; x < 20; x++) for (const y of [0, 1, 2, 3, 14, 15, 16, 17]) s.tileMap.put(x, y, 1);
  s.fillBg(BG_MAP1, 32 * 4, 1);
  s.fillBg(BG_MAP1 + 32 * 14, 32 * 4, 1);
  // vChars2 tile 0 white, tile 1 black; GameFreakIntro to vChars2 + $600 (BG tiles $60–$73) and to vChars1 (objects
  // $80–$93).
  s.fillTile(bgTileIndex(0), 0x00);
  s.fillTile(bgTileIndex(1), 0xff);
  copyGameFreakIntro(s, a, bgTileIndex(0x60));
  copyGameFreakIntro(s, a, 0x80);
  // The LCD stays off past the next frame boundary: no VBlank (DECISIONS #97).
  yield 'dark';
  // EnableLCD; the window off, the BG on vBGMap1. The first frame after it is not drawn.
  s.enableLcd();
  s.lcdc = STAR_LCDC;
  yield* frames(BARS_FRAMES);
  const interrupted = yield* animateShootingStar(s, a, joy);
  if (!interrupted) yield* frames(STAR_HOLD_FRAMES);
  // IntroClearMiddleOfScreen: wTileMap rows 4–13 to tile 0; ClearSprites; Delay3.
  for (let y = 4; y < 14; y++) for (let x = 0; x < 20; x++) s.tileMap.put(x, y, 0);
  s.oam.fill(0);
  yield* frames(3);
}

/** AnimateShootingStar. True (carry) when CheckForUserInterruption saw input. */
function* animateShootingStar(s: OpeningScreen, a: ShootingStarImages, joy: StarJoypad): Generator<void, boolean> {
  const oam = s.oam;
  // LoadShootingStarGraphics. UpdateCGBPal_OBP0/OBP1 transfer the colours an H-blank at a time from the next frame's
  // first line; their 32 colours are in before line 32, above everything the star draws until it is cleared.
  s.obp0 = STAR_OBP0; s.obp1 = STAR_OBP1;
  for (const [n, source] of BIG_STAR_SOURCE_TILES.entries()) yield* s.videoCopy.copy(1, () => s.loadTiles(0xa0 + n, a.moveAnim, 1, source));
  yield* s.videoCopy.copy(FALLING_STAR_TILES, i => s.loadTiles(0xa2 + i, a.fallingStar, 1, i));
  oam.set(GAME_FREAK_LOGO_OAM, 24 * 4);
  oam.set(GAME_FREAK_SHOOTING_STAR_OAM, 0);
  playSFX('shooting_star');
  // The big star: 4 pixels down and 4 left a frame until sprite 0's Y is $A0. (`cp 80` jumps back to the same loop.)
  do {
    for (let at = 0; at < 16; at += 4) { oam[at] = (oam[at] + 4) & 0xff; oam[at + 1] = (oam[at + 1] - 4) & 0xff; }
    if (yield* checkForUserInterruption(joy, 1)) return true;
  } while (oam[0] !== 0xa0);
  for (let at = 0; at < 16; at += 4) oam[at] = HIDDEN_Y;
  // The logo flashes: rOBP0 rotated right twice, three times, 10 frames each.
  for (let flash = 0; flash < 3; flash++) {
    s.obp0 = ((s.obp0 >> 2) | (s.obp0 << 6)) & 0xff;
    if (yield* checkForUserInterruption(joy, 10)) return true;
  }
  // 24 small stars, all at (0, 0), then six waves of four, each falling while the earlier ones move up the table.
  for (let n = 0; n < 24; n++) oam.set(SMALL_STARS_OAM, n * 4);
  let count = 0; // wMoveDownSmallStarsOAMCount
  for (const wave of SMALL_STARS_WAVES) {
    if (wave) {
      for (let n = 0; n < 4; n++) {
        const at = (20 + n) * 4;
        oam[at] = wave[n * 3]; oam[at + 1] = wave[n * 3 + 1]; oam[at + 3] = (oam[at + 3] & 0xf0) | wave[n * 3 + 2];
      }
      // "should be 4, but the extra 2 aren't visible on screen"
      if (count !== 24) count += 6;
    }
    const interrupted = yield* moveDownSmallStars(s, joy, count);
    // Sprites 4–23 copied down to 0–19 (CopyData, ascending), interrupted or not.
    oam.copyWithin(0, 4 * 4, 24 * 4);
    if (interrupted) return true;
  }
  return false;
}

/** MoveDownSmallStars: 8 times, the last `count` entries from sprite 23 down a pixel and rOBP1 ^ %10100000, 3 frames.
 *  `count` is 6, 12, 18 or 24 (the first wave sets it before the first call). */
function* moveDownSmallStars(s: OpeningScreen, joy: StarJoypad, count: number): Generator<void, boolean> {
  for (let step = 0; step < 8; step++) {
    for (let n = 0, at = 23 * 4; n < count; n++, at -= 4) s.oam[at] = (s.oam[at] + 1) & 0xff;
    s.obp1 ^= 0xa0;
    if (yield* checkForUserInterruption(joy, 3)) return true;
  }
  return false;
}

/** CheckForUserInterruption (home/overworld.asm): `frames` times DelayFrame, then JoypadLowSensitivity → Joypad. hJoy7 is
 *  0 (Init's HRAM clear), so hJoy5 is hJoyPressed: the buttons down now and not at the last Joypad call. True (carry)
 *  on Up+Select+B held exactly, or A or START newly pressed. _Joypad's soft reset is not modelled (findings backlog). */
export function* checkForUserInterruption(joy: StarJoypad, frames: number): Generator<void, boolean> {
  for (let n = 0; n < frames; n++) {
    yield;
    const held = joyHeld();
    const pressed = held & ~joy.last;
    joy.last = held;
    if (held === INTERRUPT_HELD || (pressed & INTERRUPT_PRESSED) !== 0) return true;
  }
  return false;
}

function* frames(count: number): Generator<void, void> {
  for (let frame = 0; frame < count; frame++) yield;
}
