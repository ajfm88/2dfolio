// Opening checkpoint-05 (note 114): the title's tables in the port against the ROM, at pret's symbols (b452f2ab).
// Opening checkpoint-07a (note 116): the clear-save dialogue's two text programs, committed data only.
// Opening checkpoint-08b (note 119): the copyright screen's tables against the ROM.
// Opening checkpoint-09 (note 120): the Game Freak logo's and the shooting star's tables and tiles against the ROM.
import { describe, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} } })); // input.ts listens at import
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { TITLE_ATTRIBUTE_HEADER, TITLE_ATTRIBUTE_ROM_OFFSET, TITLE_BG0_ATTRIBUTES, TITLE_BG1_ATTRIBUTES } from '../../menus/title_attributes';
import { COPYRIGHT_TILES, LOGO_BOUNCE, PIKACHU_EYES_OAM, POKEMON_LOGO_TILES, TITLE_PALETTES } from '../../menus/title_screen';
import { getPaletteColors } from '../../renderer/palettes';
import {
  BIG_STAR_SOURCE_TILES, COPYRIGHT_SPAN_TILES, COPYRIGHT_TEXT, FALLING_STAR_TILES, GAME_FREAK_INTRO_ATTRIBUTE_HEADER,
  GAME_FREAK_INTRO_ATTRIBUTES, GAME_FREAK_INTRO_PALETTES, GAME_FREAK_INTRO_TILES, GAME_FREAK_LOGO_OAM,
  GAME_FREAK_SHOOTING_STAR_OAM, SMALL_STARS_OAM, SMALL_STARS_WAVES, TEXT_BOX_TILES,
} from '../../menus/shooting_star';
import { TEXT_PROGRAM_SYMBOLS } from '../text_program_symbols';

const ROM_PATH = process.env.ROM_PATH;
const PRET = resolve(__dirname, '../../../../refs/pokeyellow');
const STATIC = resolve(__dirname, '../../../static');
const DATA = resolve(__dirname, '../../../data');
const ready = Boolean(ROM_PATH) && existsSync(PRET);
const rom = ROM_PATH ? readFileSync(ROM_PATH) : Buffer.alloc(0);
const symbols = ready ? execFileSync('git', ['-C', PRET, 'show', 'origin/symbols:pokeyellow.sym'], { encoding: 'utf8' }) : '';
/** A label's file offset, from the symbol file. */
function symbol(label: string): number {
  const match = symbols.match(new RegExp(`^([0-9a-f]{2}):([0-9a-f]{4}) ${label.replace(/\./g, '\\.')}$`, 'm'));
  if (!match) throw new Error(`no symbol ${label}`);
  const bank = parseInt(match[1], 16), address = parseInt(match[2], 16);
  return bank === 0 ? address : bank * 0x4000 + (address - 0x4000);
}
const bytes = (offset: number, length: number): number[] => [...rom.subarray(offset, offset + length)];
const tilesOf = (url: string): number => { const p = PNG.sync.read(readFileSync(resolve(STATIC, url))); return (p.width >> 3) * (p.height >> 3); };
/** A 2bpp tile's colour indices (low plane, then high plane, per row). */
const decode2bpp = (offset: number): number[] => Array.from({ length: 64 }, (_, i) => {
  const lo = rom[offset + (i >> 3) * 2], hi = rom[offset + (i >> 3) * 2 + 1], bit = 7 - (i & 7);
  return (((hi >> bit) & 1) << 1) | ((lo >> bit) & 1);
});
/** Tile `tile` of a committed PNG as OpeningScreen.loadTiles reads it. */
const pngTile = (url: string, tile: number): number[] => {
  const p = PNG.sync.read(readFileSync(resolve(STATIC, url)));
  const across = p.width >> 3, column = tile % across, row = Math.floor(tile / across);
  return Array.from({ length: 64 }, (_, i) => {
    const gray = p.data[((row * 8 + (i >> 3)) * p.width + column * 8 + (i & 7)) * 4];
    return gray >= 192 ? 0 : gray >= 128 ? 1 : gray >= 64 ? 2 : 3;
  });
};

describe.skipIf(!ready)('the title\'s data against the ROM (opening checkpoint-05)', () => {
  it('BGMapAttributes_TitleScreen at 2f:5de0: the header, vBGMap0\'s block and vBGMap1\'s at +$250', () => {
    expect(symbol('BGMapAttributes_TitleScreen')).toBe(TITLE_ATTRIBUTE_ROM_OFFSET);
    expect(bytes(TITLE_ATTRIBUTE_ROM_OFFSET, 16)).toEqual([...TITLE_ATTRIBUTE_HEADER]);
    const length = (rom[TITLE_ATTRIBUTE_ROM_OFFSET] + 1) * 16;
    expect(length).toBe(TITLE_BG0_ATTRIBUTES.length);
    expect(bytes(TITLE_ATTRIBUTE_ROM_OFFSET + 16, length)).toEqual([...TITLE_BG0_ATTRIBUTES]);
    const second = TITLE_ATTRIBUTE_ROM_OFFSET + 3 + rom.readUInt16LE(TITLE_ATTRIBUTE_ROM_OFFSET + 1);
    expect(second - TITLE_ATTRIBUTE_ROM_OFFSET).toBe(0x250);
    expect(bytes(second, length)).toEqual([...TITLE_BG1_ATTRIBUTES]);
  });

  it('the eyes\' OAM, the bounce\'s scroll table and the copyright row, byte for byte', () => {
    expect(bytes(symbol('TitleScreenPikachuEyesOAMData'), 32)).toEqual([...PIKACHU_EYES_OAM]);
    const bounce = bytes(symbol('DisplayTitleScreen.TitleScreenPokemonLogoYScrolls'), 15);
    expect(bounce).toEqual([...LOGO_BOUNCE.flatMap(([step, count]) => [step & 0xff, count]), 0]);
    expect(bytes(symbol('DisplayTitleScreen.tileScreenCopyrightTiles'), 17)).toEqual([...COPYRIGHT_TILES, 0xff]);
  });

  it('the three tilemaps the title places are the committed files', () => {
    for (const [label, file, length] of [['TitleScreenPokemonLogoTilemap', 'pokemon_logo', 112],
      ['TitleScreenPikaBubbleTilemap', 'pika_bubble', 28], ['TitleScreenPikachuTilemap', 'pikachu', 108]] as const)
      expect(bytes(symbol(label), length), label).toEqual([...readFileSync(resolve(STATIC, `gfx/title/${file}.tilemap`))]);
  });

  it('each copy\'s size is its label span; the logo\'s is 115 tiles, short of its padded PNG\'s 128', () => {
    const span = (from: string, to: string): number => (symbol(to) - symbol(from)) / 16;
    expect(span('PokemonLogoGraphics', 'PokemonLogoGraphicsEnd')).toBe(POKEMON_LOGO_TILES);
    expect(tilesOf('gfx/title/pokemon_logo.png')).toBe(128);
    expect(span('PokemonLogoCornerGraphics', 'PokemonLogoCornerGraphicsEnd')).toBe(tilesOf('gfx/title/pokemon_logo_corner.png'));
    expect(span('TitlePikachuBGGraphics', 'TitlePikachuBGGraphicsEnd')).toBe(tilesOf('gfx/title/pikachu_bg.png'));
    expect(span('TitlePikachuOBGraphics', 'TitlePikachuOBGraphicsEnd')).toBe(tilesOf('gfx/title/pikachu_ob.png'));
    expect(span('GameFreakLogoGraphics', 'GameFreakLogoGraphicsEnd')).toBe(tilesOf('gfx/title/gamefreak_inc.png'));
    // 1bpp: eight bytes a tile.
    expect((symbol('FontGraphicsEnd') - symbol('FontGraphics')) / 8).toBe(tilesOf('gfx/font/font.png'));
  });

  it('PalPacket_Titlescreen names LOGO2, LOGO1, MEWMON, PURPLEMON; the port\'s colours are those CGBBasePalettes entries', () => {
    const packet = bytes(symbol('PalPacket_Titlescreen'), 9);
    const ids = [1, 3, 5, 7].map(i => packet[i] | packet[i + 1] << 8);
    expect(ids).toEqual([0x0e, 0x0d, 0x10, 0x14]);
    expect(TITLE_PALETTES).toEqual(['LOGO2', 'LOGO1', 'MEWMON', 'PURPLEMON']);
    const base = symbol('CGBBasePalettes');
    // renderer/palettes.ts gbcCorrect, for the comparison.
    const correct = (r: number, g: number, b: number): number[] => [
      Math.min(255, Math.round((r * 26 + g * 4 + b * 2) * 255 / 992)),
      Math.min(255, Math.round((g * 24 + b * 8) * 255 / 992)),
      Math.min(255, Math.round((r * 6 + g * 4 + b * 22) * 255 / 992))];
    ids.forEach((id, slot) => {
      const colours = [0, 1, 2, 3].map(c => { const w = rom.readUInt16LE(base + id * 8 + c * 2); return correct(w & 31, (w >> 5) & 31, (w >> 10) & 31); });
      expect(getPaletteColors(TITLE_PALETTES[slot]).map(c => [...c]), TITLE_PALETTES[slot]).toEqual(colours);
    });
  });
});

describe.skipIf(!ready)('the copyright screen\'s data against the ROM (opening checkpoint-08b)', () => {
  it('BGMapAttributes_GameFreakIntro: the header, and one block for both maps (the second pointer is +3 + $000d)', () => {
    const at = symbol('BGMapAttributes_GameFreakIntro');
    expect(at).toBe(0x2f * 0x4000 + (0x54a0 - 0x4000));
    expect(bytes(at, 16)).toEqual([...GAME_FREAK_INTRO_ATTRIBUTE_HEADER]);
    const length = (rom[at] + 1) * 16;
    expect(length).toBe(GAME_FREAK_INTRO_ATTRIBUTES.length);
    expect(bytes(at + 16, length)).toEqual([...GAME_FREAK_INTRO_ATTRIBUTES]);
    expect(3 + rom.readUInt16LE(at + 1)).toBe(16);
  });

  it('PalPacket_GameFreakIntro names GAMEFREAK, REDMON, VIRIDIAN, BLUEMON; the port\'s colours are those CGBBasePalettes entries', () => {
    const packet = bytes(symbol('PalPacket_GameFreakIntro'), 9);
    const ids = [1, 3, 5, 7].map(i => packet[i] | packet[i + 1] << 8);
    expect(ids[0]).toBe(0x24); // PAL_GAMEFREAK
    const base = symbol('CGBBasePalettes');
    const correct = (r: number, g: number, b: number): number[] => [
      Math.min(255, Math.round((r * 26 + g * 4 + b * 2) * 255 / 992)),
      Math.min(255, Math.round((g * 24 + b * 8) * 255 / 992)),
      Math.min(255, Math.round((r * 6 + g * 4 + b * 22) * 255 / 992))];
    ids.forEach((id, slot) => {
      const colours = [0, 1, 2, 3].map(c => { const w = rom.readUInt16LE(base + id * 8 + c * 2); return correct(w & 31, (w >> 5) & 31, (w >> 10) & 31); });
      expect(getPaletteColors(GAME_FREAK_INTRO_PALETTES[slot]).map(c => [...c]), GAME_FREAK_INTRO_PALETTES[slot]).toEqual(colours);
    });
  });

  it('CopyrightTextString\'s three lines; LoadCopyrightTiles\' 30 tiles run through Game Freak\'s logo and the 9 into the text box\'s', () => {
    const text = [...COPYRIGHT_TEXT[0], 0x4e, ...COPYRIGHT_TEXT[1], 0x4e, ...COPYRIGHT_TEXT[2], 0x50];
    expect(bytes(symbol('CopyrightTextString'), text.length)).toEqual(text);
    const span = (from: string, to: string): number => (symbol(to) - symbol(from)) / 16;
    expect((symbol('TextBoxGraphics') + 0x10 - symbol('NintendoCopyrightLogoGraphics')) / 16).toBe(COPYRIGHT_SPAN_TILES);
    expect(span('NintendoCopyrightLogoGraphics', 'GameFreakLogoGraphics')).toBe(tilesOf('gfx/splash/copyright.png'));
    expect(span('GameFreakLogoGraphics', 'NineTile')).toBe(tilesOf('gfx/title/gamefreak_inc.png'));
    expect(span('NineTile', 'TextBoxGraphics')).toBe(tilesOf('gfx/title/nine.png'));
    expect(span('TextBoxGraphics', 'TextBoxGraphicsEnd')).toBe(TEXT_BOX_TILES);
    expect(tilesOf('gfx/font/font_extra.png')).toBe(TEXT_BOX_TILES);
  });
});

describe.skipIf(!ready)('the Game Freak logo\'s and the star\'s data against the ROM (opening checkpoint-09)', () => {
  it('GameFreakLogoOAMData, GameFreakShootingStarOAMData and SmallStarsOAM are the port\'s, byte for byte', () => {
    const table = (label: string, end: string): number[] => bytes(symbol(label), symbol(end) - symbol(label));
    expect(table('GameFreakLogoOAMData', 'GameFreakLogoOAMDataEnd')).toEqual([...GAME_FREAK_LOGO_OAM]);
    expect(table('GameFreakShootingStarOAMData', 'GameFreakShootingStarOAMDataEnd')).toEqual([...GAME_FREAK_SHOOTING_STAR_OAM]);
    expect(table('SmallStarsOAM', 'SmallStarsOAMEnd')).toEqual([...SMALL_STARS_OAM]);
  });

  it('SmallStarsWaveCoordsPointerTable: waves 1–4 of four (Y, X, palette), then SmallStarsEmptyWave ($FF) twice', () => {
    const table = symbol('SmallStarsWaveCoordsPointerTable');
    const pointers = [0, 1, 2, 3, 4, 5].map(i => rom.readUInt16LE(table + i * 2));
    const bank = 0x1c * 0x4000 - 0x4000;
    expect(pointers.map(p => p + bank)).toEqual([
      ...['SmallStarsWave1Coords', 'SmallStarsWave2Coords', 'SmallStarsWave3Coords', 'SmallStarsWave4Coords'].map(symbol),
      symbol('SmallStarsEmptyWave'), symbol('SmallStarsEmptyWave')]);
    pointers.forEach((pointer, i) => {
      const wave = SMALL_STARS_WAVES[i];
      if (wave) expect(bytes(pointer + bank, 12), `wave ${i + 1}`).toEqual([...wave]);
      else expect(rom[pointer + bank]).toBe(0xff);
    });
  });

  it('GameFreakIntro: "presents" (13), the logo (6) and a zero tile; FallingStar; MoveAnimationTiles1\'s 3 and 19 are the PNGs\' tiles', () => {
    const intro = symbol('GameFreakIntro');
    expect((symbol('GameFreakIntroEnd') - intro) / 16).toBe(GAME_FREAK_INTRO_TILES);
    const sheet: [string, number][] = [
      ...Array.from({ length: tilesOf('gfx/splash/gamefreak_presents.png') }, (_, t) => ['gfx/splash/gamefreak_presents.png', t] as [string, number]),
      ...Array.from({ length: tilesOf('gfx/splash/gamefreak_logo.png') }, (_, t) => ['gfx/splash/gamefreak_logo.png', t] as [string, number])];
    expect(sheet).toHaveLength(GAME_FREAK_INTRO_TILES - 1);
    sheet.forEach(([url, tile], i) => expect(pngTile(url, tile), `${url} ${tile}`).toEqual(decode2bpp(intro + i * 16)));
    expect(bytes(intro + 19 * 16, 16)).toEqual(Array(16).fill(0));
    expect((symbol('FallingStarEnd') - symbol('FallingStar')) / 16).toBe(FALLING_STAR_TILES);
    expect(pngTile('gfx/splash/falling_star.png', 0)).toEqual(decode2bpp(symbol('FallingStar')));
    for (const tile of BIG_STAR_SOURCE_TILES)
      expect(pngTile('gfx/battle/move_anim_1.png', tile), `tile ${tile}`).toEqual(decode2bpp(symbol('MoveAnimationTiles1') + tile * 16));
  });
});

describe('the clear-save dialogue\'s text (opening checkpoint-07a)', () => {
  it('ClearSaveDataText is text_far _ClearSaveDataText; the child prints "Clear all saved" / "data?" and ends with done', () => {
    const data = readFileSync(resolve(DATA, 'text_programs.json'), 'utf8');
    expect(readFileSync(resolve(STATIC, 'text_programs.json'), 'utf8')).toBe(data);
    const programs = JSON.parse(data).programs;
    expect(programs.ClearSaveDataText).toEqual([{ op: 'far', program: '_ClearSaveDataText' }]);
    expect(programs._ClearSaveDataText).toEqual([{ op: 'text', text: 'Clear all saved\ndata?<DONE>' }]);
    expect(TEXT_PROGRAM_SYMBOLS.filter(([label]) => label.endsWith('ClearSaveDataText'))).toEqual([
      ['ClearSaveDataText', 0x07, 0x425f, true], ['_ClearSaveDataText', 0x28, 0x40e9, false]]);
  });
});
