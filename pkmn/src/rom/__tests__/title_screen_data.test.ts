// Opening checkpoint-05 (note 114): the title's tables in the port against the ROM, at pret's symbols (b452f2ab).
// Opening checkpoint-07a (note 116): the clear-save dialogue's two text programs, committed data only.
import { describe, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} } })); // input.ts listens at import
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { TITLE_ATTRIBUTE_HEADER, TITLE_ATTRIBUTE_ROM_OFFSET, TITLE_BG0_ATTRIBUTES, TITLE_BG1_ATTRIBUTES } from '../../menus/title_attributes';
import { COPYRIGHT_TILES, LOGO_BOUNCE, PIKACHU_EYES_OAM, POKEMON_LOGO_TILES, TITLE_PALETTES } from '../../menus/title_screen';
import { getPaletteColors } from '../../renderer/palettes';
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
