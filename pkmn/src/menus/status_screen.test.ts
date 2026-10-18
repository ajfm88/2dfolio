import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => { Object.assign(globalThis, { window: { addEventListener() {} } }); });
const { ctx, imageSize } = vi.hoisted(() => ({
  ctx: { drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn() },
  imageSize: { value: 40 },
}));
vi.mock('../audio', () => ({ playSFX: vi.fn(), setMasterVolume: vi.fn(), isSoundFinished: () => true }));
vi.mock('../renderer', async importOriginal => ({
  ...await importOriginal<typeof import('../renderer')>(),
  fillRect: vi.fn(), drawFadeOverlay: vi.fn(), drawTile: vi.fn(), getCtx: () => ctx, getScale: () => 1,
  loadFont: async (url: string) => ({ width: 128, url }),
  loadTileset: async (url: string, palette: string) => ({ width: 120, url, palette }),
  loadBattleSprite: vi.fn(async (url: string, palette: string) => ({ width: imageSize.value, height: imageSize.value, url, palette })),
}));
import { StatusScreenSession, loadStatusScreenAssets } from './status_screen';
import { createPokemon, loadBattleData, getAllSpeciesNames, getSpecies } from '../battle/data';
import type { BattlePokemon } from '../battle/types';
import { totalExpForLevel } from '../battle/experience';
import { initTextSystem } from '../text/textbox';
import { textBgTransfer } from '../text/bg_transfer';
import * as input from '../input';
import type { GameButton } from '../core';
import { playSFX, setMasterVolume } from '../audio';
import { drawFadeOverlay, drawTile, loadBattleSprite, getMonsterPalette } from '../renderer';
import { drawScreenTile } from './menu_render';
import { charToTile } from '../text/charmap';
import {
  LEVEL_GLYPH as LV, DOT_GLYPH as DOT, NUMBER_GLYPH as NO, ID_GLYPH as ID,
  HP_GLYPH as HP, HP_LEFT_GLYPH as LEFT, HP_END_GLYPH as END, HP_FILL_GLYPHS as FILL,
  HALF_ARROW_GLYPH as ARROW, LINE_H_GLYPH as H, LINE_V_GLYPH as V, LINE_CORNER_GLYPH as CORNER,
  TO_GLYPH as TO, BOLD_P_GLYPH as P, menuGlyph,
} from './menu_glyphs';

const BUTTONS: GameButton[] = ['a', 'b', 'up', 'down', 'left', 'right', 'start', 'select'];
beforeAll(async () => { await Promise.all([initTextSystem(), loadBattleData(), loadStatusScreenAssets()]); });
beforeEach(() => {
  vi.restoreAllMocks(); vi.clearAllMocks(); imageSize.value = 40;
  textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  keys(); input.readJoypad();
});
function keys(...held: GameButton[]) {
  for (const button of BUTTONS) input.setKey(button, held.includes(button));
  input.updateInput();
}
function fixture(): BattlePokemon {
  return Object.assign(createPokemon('PIKACHU', 5)!, {
    nickname: 'ABCDEFGHIJ', maxHp: 100, currentHp: 57, attack: 123, defense: 9, speed: 45, special: 7,
    otId: 0, otName: 'ASH', exp: 125,
    moves: [{ id: 'SAND_ATTACK', pp: 0xc5, maxPp: 15 }],
  });
}
function rig(mon = fixture(), syncRead = false) {
  const session = new StatusScreenSession(mon, { syncRead });
  const read = vi.fn(input.readJoypad), transfer = vi.spyOn(textBgTransfer, 'tick');
  let time = 0;
  const step = (...held: GameButton[]) => {
    keys(...held); time++;
    const n = transfer.mock.calls.length;
    const result = session.frame(read);
    expect(transfer.mock.calls.length - n, `single owner at frame ${time}`).toBe(1);
    return result;
  };
  const wait = (n: number, ...held: GameButton[]) => { for (let i = 0; i < n; i++) step(...held); };
  const page2 = () => { wait(27); step('a'); wait(3); };
  const row = (y: number, x = 0, length = 20) => Array.from({ length }, (_, i) => session.tiles.at(x + i, y) ?? '?').join('');
  return { session, step, wait, page2, read, transfer, row, time: () => time };
}

describe('StatusScreen page 1 (status_screen.asm, DrawHP, PrintStatsBox)', () => {
  it('all committed species types already use the cartridge TypeNames display strings', () => {
    // data/types/names.asm: this remains a tripwire until TypeNames is extracted.
    const names = new Set(['NORMAL', 'FIGHTING', 'FLYING', 'POISON', 'GROUND', 'ROCK', 'BIRD', 'BUG',
      'GHOST', 'FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'PSYCHIC', 'ICE', 'DRAGON']);
    const species = getAllSpeciesNames().map(name => getSpecies(name)!);
    expect(species).toHaveLength(151);
    for (const mon of species) { expect(names.has(mon.type1)).toBe(true); expect(names.has(mon.type2)).toBe(true); }
  });
  it('matches all 360 cells at S+20, before the seven-frame picture copy', () => {
    const r = rig(); r.wait(20);
    const expected = [
      '                    ', `         ABCDEFGHIJ${V}`, `              ${LV}5   ${V}`,
      `           ${HP}${LEFT}${FILL[8]}${FILL[8]}${FILL[8]}${FILL[3]}${FILL[0]}${FILL[0]}${END}`,
      `             57/100${V}`, `                   ${V}`, `         STATUS/OK ${V}`,
      ` ${NO}${DOT}025  ${ARROW}${H.repeat(10)}${CORNER}`,
      '┌────────┐          ', `│ATTACK  │TYPE1/   ${V}`, `│     123│ ELECTRIC${V}`,
      `│DEFENSE │         ${V}`, `│       9│         ${V}`, `│SPEED   │${ID}${NO}/      ${V}`,
      `│      45│  00000  ${V}`, `│SPECIAL │OT/      ${V}`, `│       7│  ASH    ${V}`,
      `└────────┘  ${ARROW}${H.repeat(6)}${CORNER}`,
    ];
    for (let y = 0; y < 18; y++) { expect(expected[y].length, `expected width row ${y}`).toBe(20); expect(r.row(y), `row ${y}`).toBe(expected[y]); }
  });

  it('places then erases TYPE2/ for a single type; keeps both labels for a dual type', () => {
    const single = rig(); single.wait(14); expect(single.row(11, 10, 6)).toBe('TYPE2/');
    single.wait(3); expect(single.row(11, 10, 6)).toBe('      ');
    const mon = fixture(); mon.species = { ...mon.species, type1: 'GRASS', type2: 'POISON' };
    const dual = rig(mon); dual.wait(20);
    expect(dual.row(10, 11, 5)).toBe('GRASS'); expect(dual.row(11, 10, 6)).toBe('TYPE2/');
    expect(dual.row(12, 11, 6)).toBe('POISON');
  });

  it.each([null, 'PSN', 'BRN', 'FRZ', 'PAR', 'SLP'] as const)('prints status %s, but FNT takes priority at zero HP', status => {
    const mon = fixture(); mon.status = status;
    const r = rig(mon); r.wait(20); expect(r.row(6, 16, 3)).toBe((status ?? 'OK').padEnd(3));
    mon.currentHp = 0; const fainted = rig(mon); fainted.wait(20); expect(fainted.row(6, 16, 3)).toBe('FNT');
    for (let i = 0; i < 6; i++) expect(fainted.session.tiles.at(13 + i, 3)).toBe(FILL[0]);
  });

  it('prints level 100 over LV and an actual 5-digit OT ID independent of dex number', () => {
    const mon = fixture(); mon.level = 100; mon.otId = 54321;
    const r = rig(mon); r.wait(20); expect(r.row(2, 14, 4)).toBe('100 '); expect(r.row(14, 12, 5)).toBe('54321');
    expect(r.row(7, 3, 3)).toBe('025');
  });
});

describe('StatusScreen2 (FormatMovesString, PrintPP and CalcExpToLevelUp)', () => {
  it.each([1, 2, 4])('draws %i moves with cartridge names, PP masking, exact columns and empty rows', count => {
    const mon = fixture(); mon.moves = [
      { id: 'SAND_ATTACK', pp: 0xc5, maxPp: 15 }, { id: 'DOUBLE_EDGE', pp: 0x40, maxPp: 24 },
      { id: 'PSYCHIC_M', pp: 10, maxPp: 10 }, { id: 'TACKLE', pp: 35, maxPp: 35 },
    ].slice(0, count);
    const r = rig(mon); r.wait(27); const before = r.session.tiles.saveTiles();
    r.step('b'); r.wait(3);
    for (let i = 0; i < 4; i++) {
      expect(r.row(9 + i * 2, 2, 12)).toBe((i < count ? ['SAND-ATTACK', 'DOUBLE-EDGE', 'PSYCHIC', 'TACKLE'][i] : '-').padEnd(12));
      expect(r.row(10 + i * 2, 11, 2)).toBe(i < count ? P.repeat(2) : '--');
      expect(r.row(10 + i * 2, 14, 5)).toBe(i < count ? [' 5/15', ' 0/24', '10/10', '35/35'][i] : '     ');
    }
    expect(r.row(1, 9, 10)).toBe('PIKACHU   '); expect(r.row(0, 9, 10)).toBe('          ');
    expect(r.row(2, 9, 10)).toBe('          '); expect(r.row(3, 9, 10)).toBe('EXP POINTS');
    expect(r.row(5, 9, 10)).toBe('LEVEL UP  '); expect(r.session.tiles.at(19, 3)).toBe(V);
    expect(r.row(8)).toBe('┌──────────────────┐'); expect(r.row(17)).toBe('└──────────────────┘');
    for (let y = 0; y < 7; y++) for (let x = 1; x <= 7; x++) expect(r.session.tiles.at(x, y)).toBe(before[y * 20 + x]);
    for (let x = 0; x < 20; x++) expect(r.session.tiles.at(x, 7)).toBe(before[7 * 20 + x]);
    for (const y of [1, 2, 4, 5, 6]) expect(r.session.tiles.at(19, y)).toBe(V);
  });

  it.each([5, 99, 100])('uses seven-digit EXP and next-level fields at level %i', level => {
    const mon = fixture(); mon.level = level; mon.exp = totalExpForLevel('MEDIUM_FAST', level);
    const r = rig(mon); r.page2();
    const target = Math.min(100, level + 1);
    expect(r.row(4, 12, 7)).toBe(String(mon.exp).padStart(7));
    // PrintNumber skips leading cells, including the picture's shade-0 padding at (7,6).
    expect(r.row(6, 7, 7)).toBe('\uE030' + String(target ** 3 - mon.exp).padStart(6));
    expect(r.row(6, 14, 5)).toBe(`${TO} ${target < 100 ? LV + target + ' ' : target}`);
  });
});

describe('actual Joypad waits, white palette, volume and retained thirds (§12.2)', () => {
  it.each([0, 1, 2])('runs S/P/Q anchors with one tick at portion %i, and rendering owns none', portion => {
    for (let i = 0; i < portion; i++) textBgTransfer.tick();
    const r = rig(); expect(setMasterVolume).toHaveBeenCalledExactlyOnceWith(3, 3);
    for (let f = 1; f <= 26; f++) {
      r.step(); expect(r.session.paletteWhite).toBe(f < 20); expect(r.read).not.toHaveBeenCalled();
      if (f >= 20) for (let y = 0; y < 7; y++) expect(r.session.tiles.visibleAt(2, y)).toBe(' ');
    }
    expect(textBgTransfer.enabled).toBe(false); const frozen = textBgTransfer.nextPortion;
    r.step(); expect(r.read).toHaveBeenCalledOnce(); expect(textBgTransfer.nextPortion).toBe(frozen);
    expect(textBgTransfer.enabled).toBe(true); const page1 = r.session.tiles.saveVisibleTiles();
    r.step('b'); const p = r.time(); const old = r.session.tiles.saveVisibleTiles();
    for (let age = 1; age <= 3; age++) {
      const third = textBgTransfer.nextPortion; r.step();
      for (let y = third * 6; y < third * 6 + 6; y++) for (let x = 0; x < 20; x++)
        expect(r.session.tiles.visibleAt(x, y)).toBe(r.session.tiles.at(x, y));
      expect(r.read).toHaveBeenCalledTimes(age < 3 ? 2 : 3);
    }
    expect(r.time()).toBe(p + 3); expect(old).not.toEqual(r.session.tiles.saveVisibleTiles());
    expect(page1[3 * 20 + 19]).toBe(END);
    r.step('a'); expect(setMasterVolume).toHaveBeenLastCalledWith(7, 7); expect(setMasterVolume).toHaveBeenCalledTimes(2);
    expect(r.session.paletteWhite).toBe(true); const q = r.time();
    expect(r.step()).toBe('busy'); expect(r.step()).toBe('busy'); expect(r.step()).toBe('done');
    expect(r.time()).toBe(q + 3); expect(r.session.tiles.saveVisibleTiles().every(c => c === ' ')).toBe(true);
    const ticks = r.transfer.mock.calls.length, reads = r.read.mock.calls.length;
    r.session.render(); r.session.render(); expect(drawFadeOverlay).toHaveBeenCalledWith(1);
    expect([r.transfer.mock.calls.length, r.read.mock.calls.length]).toEqual([ticks, reads]);
    expect(playSFX).not.toHaveBeenCalled();
  });

  it.each([false, true])('held selection A and a release/repress in unread setup are lost (syncRead=%s)', sync => {
    keys('a'); if (!sync) input.readJoypad(); const r = rig(fixture(), sync);
    r.wait(8, 'a'); r.wait(4); r.wait(20, 'a');
    expect(r.row(3, 9, 10)).not.toBe('EXP POINTS');
    r.step(); r.step('a'); expect(r.row(3, 9, 10)).toBe('EXP POINTS');
    r.wait(4, 'a'); expect(setMasterVolume).toHaveBeenCalledTimes(1);
    r.step(); r.step('b'); expect(r.session.paletteWhite).toBe(true);
  });

  it('reads through irrelevant keys every frame without a Delay3 rearm; B advances both pages silently', () => {
    const r = rig(); r.wait(27);
    r.step('down'); r.step('start'); r.step('select'); expect(r.read).toHaveBeenCalledTimes(4);
    r.step('b'); expect(r.row(3, 9, 10)).toBe('EXP POINTS');
    r.wait(3, 'b'); expect(r.session.paletteWhite).toBe(false);
    r.step(); r.step('b'); expect(r.session.paletteWhite).toBe(true); expect(playSFX).not.toHaveBeenCalled();
  });
});

describe('StatusScreen pictures, source glyph sheets and palettes', () => {
  it.each([[40, 16, 16], [48, 8, 8], [56, 8, 0]])('mirrors %ipx picture at (%i,%i), revealed only by its transferred third', async (size, left, top) => {
    imageSize.value = size; const r = rig(); await Promise.resolve();
    expect(loadBattleSprite).toHaveBeenCalledWith('/gfx/sprites/front/25.png', getMonsterPalette(25));
    r.wait(27); ctx.drawImage.mockClear(); r.session.render();
    expect(ctx.drawImage.mock.calls.filter(c => (c[0] as { url: string }).url?.includes('/front/'))).toHaveLength(0);
    const portions = new Set<number>();
    for (let i = 0; i < 3; i++) {
      portions.add(textBgTransfer.nextPortion); r.step();
      ctx.drawImage.mockClear(); r.session.render();
      const partial = ctx.drawImage.mock.calls.filter(c => (c[0] as { url: string }).url?.includes('/front/'));
      const expectedRows = Array.from({ length: size / 8 }, (_, row) => top / 8 + row)
        .filter(row => portions.has(Math.floor(row / 6))).length;
      expect(partial).toHaveLength(expectedRows * size / 8);
    }
    ctx.drawImage.mockClear(); ctx.translate.mockClear(); ctx.scale.mockClear();
    r.session.render();
    const calls = ctx.drawImage.mock.calls.filter(c => (c[0] as { url: string }).url?.includes('/front/'));
    expect(calls).toHaveLength((size / 8) ** 2);
    const first = calls[0]; expect(first.slice(1)).toEqual([size - 8, 0, 8, 8, 0, 0, 8, 8]);
    expect(ctx.translate.mock.calls[0]).toEqual([left + 8, top]);
    expect(ctx.translate.mock.calls[ctx.translate.mock.calls.length - 1]).toEqual([left + size, 48]);
    expect(ctx.scale).toHaveBeenCalledWith(-1, 1);
  });

  it.each([[27, 'green'], [26, 'yellow'], [10, 'yellow'], [9, 'red']] as const)('sets %i-pixel bar palette to %s', (pixels, color) => {
    const mon = fixture(); mon.maxHp = 48; mon.currentHp = pixels;
    const r = rig(mon); r.wait(20); r.session.render();
    expect(drawTile).toHaveBeenCalledWith(expect.objectContaining({ palette: color.toUpperCase() + 'BAR' }), 15, 88, 24);
  });

  it('selects every traced special tile and DOT font tile 114, including the status-only end and bold P', () => {
    const expected = [[HP, 'font_battle_extra', 15], [LEFT, 'font_battle_extra', 0],
      [END, 'battle_hud_1', 0], [LV, 'battle_hud_1', 1], [ARROW, 'battle_hud_1', 2],
      [TO, 'font_battle_extra', 14], [ID, 'font_battle_extra', 17], [NO, 'font_battle_extra', 18],
      [H, 'battle_hud_3', 0], [CORNER, 'battle_hud_3', 1], [V, 'battle_hud_2', 0], [P, 'P', 0]] as const;
    for (const [glyph, file, tile] of expected) {
      drawScreenTile(glyph, 8, 16, 'red');
      expect(drawTile).toHaveBeenLastCalledWith(expect.objectContaining({ url: expect.stringContaining(`/${file}.png`) }), tile, 8, 16);
    }
    for (let i = 0; i < 9; i++) expect(menuGlyph(FILL[i])?.tile).toBe(i + 1);
    expect(charToTile(DOT)).toBe(114); expect(charToTile('.')).toBe(104);
    ctx.drawImage.mockClear(); drawScreenTile(DOT, 16, 56);
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 16, 56, 8, 8, 16, 56, 8, 8);
  });
});
