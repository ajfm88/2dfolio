// Battle wTileMap, VRAM and OAM. Unused until A5c3: nothing in main or battle imports this.
// VBlank order follows home/vblank.asm:28–40: BG third, video copy, OAM DMA, then the TextBox tick.
import { textBgTransfer } from '../text/bg_transfer';
import type { TextBox } from '../text/textbox';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../menus/screen_tiles';
import { charToTile } from '../text/charmap';
import {
  HP_END_GLYPH, HP_FILL_GLYPHS, HP_GLYPH, HP_LEFT_GLYPH, LEVEL_GLYPH,
  BOLD_P_GLYPH, HALF_ARROW_GLYPH, ID_GLYPH, LINE_CORNER_GLYPH, LINE_H_GLYPH, LINE_V_GLYPH,
  NUMBER_GLYPH, POKEBALL_GLYPH, TIME_COLON_GLYPH, TO_GLYPH,
} from '../menus/menu_glyph_ids';
import { getMonsterPalette, getPaletteColors } from '../renderer/palettes';
import { dmgShadeMapping } from '../renderer/palette_shades';

export type BattleCell = number | string;
export type Rgb = readonly [number, number, number];
export interface BattlePicSlot { readonly picture: string; readonly tile: number }
export interface BattleHudSlot { readonly sheet: 'extra' | 'hud1' | 'hud2' | 'hud3'; readonly tile: number }
export interface BattleOam { y: number; x: number; tile: number; attributes: number }
export interface BattlePaletteInput {
  /** Dex number, not the internal species id. `DeterminePaletteID` does that conversion.
   *  0 is the empty send-out, whose palette is MEWMON. */
  partySpecies: number;
  /** Dex number of `wEnemyMonSpecies2`. 0 is MEWMON, including the trainer intro. */
  enemySpecies2: number;
  /** Stored bar colour 0/1/2, added to PAL_GREENBAR by SetPal_Battle. */
  playerBar: 0 | 1 | 2;
  enemyBar: 0 | 1 | 2;
}

const BG_COLUMNS = 32;
const BG_ROWS = 32;
const BARS = ['GREENBAR', 'YELLOWBAR', 'REDBAR'] as const;
/** Menu glyphs that name some other screen's tile. They must not follow that tile into battle VRAM. */
const FORBIDDEN_GLYPHS = new Set([
  POKEBALL_GLYPH, TIME_COLON_GLYPH, BOLD_P_GLYPH, ID_GLYPH, NUMBER_GLYPH, TO_GLYPH,
  HALF_ARROW_GLYPH, LINE_H_GLYPH, LINE_V_GLYPH, LINE_CORNER_GLYPH,
]);

/** TextBoxBorder on the battle sheet: font_battle_extra tiles 23–28, the overworld order. */
const BATTLE_BORDER: Record<string, number> = {
  '┌': 0x79, '─': 0x7a, '┐': 0x7b, '│': 0x7c, '└': 0x7d, '┘': 0x7e,
};

/** HP/LV family and the message border. POKEBALL ($78 elsewhere) and TIME_COLON ($6D elsewhere) throw. */
export function battleGlyphTile(glyph: string): number {
  if (glyph === ' ') return 0x7f;
  if (glyph in BATTLE_BORDER) return BATTLE_BORDER[glyph];
  if (glyph === HP_LEFT_GLYPH) return 0x62;
  if (glyph === HP_END_GLYPH) return 0x6d;
  if (glyph === HP_GLYPH) return 0x71;
  if (glyph === LEVEL_GLYPH) return 0x6e;
  const fill = HP_FILL_GLYPHS.indexOf(glyph);
  if (fill >= 0) return 0x63 + fill;
  if (FORBIDDEN_GLYPHS.has(glyph)) throw new Error(`battle glyph is not a battle tile: ${glyph}`);
  const font = charToTile(glyph);
  if (font >= 0) return 0x80 + font;
  throw new Error(`unknown battle cell: ${glyph}`);
}

/** Final $62–$7F sources after the extra-font copy and the HUD overwrites (note 66 §10.4). */
export function battleHudTile(id: number): BattleHudSlot | null {
  if (id < 0x62 || id > 0x7f) return null;
  if (id >= 0x6d && id <= 0x6f) return { sheet: 'hud1', tile: id - 0x6d };
  if (id >= 0x73 && id <= 0x75) return { sheet: 'hud2', tile: id - 0x73 };
  if (id >= 0x76 && id <= 0x78) return { sheet: 'hud3', tile: id - 0x76 };
  return { sheet: 'extra', tile: id - 0x62 };
}

function paletteOf(name: string): Rgb[] {
  return getPaletteColors(name).map(colour => [colour[0], colour[1], colour[2]] as Rgb);
}

function throughRegister(base: readonly Rgb[], register: number): Rgb[] {
  return dmgShadeMapping(register).map(index => [base[index][0], base[index][1], base[index][2]] as Rgb);
}

interface VideoCopy { write: (index: number) => void; next: number; total: number }

export class BattleScreen {
  bgp = 0xe4;
  obp0 = 0xd0;
  obp1 = 0xe0;
  /** rWX. The window's left edge is wx − 7. */
  wx = 7;
  /** hWY. $90 hides the window below the screen. */
  wy = 0;
  scx = 0;
  scy = 0;
  /** Whole-scanline SCX for LY 64–95. Null uses scx on every line. */
  scxSplit: number | null = null;
  lcdOn = true;
  /** Non-zero while SET_PAL_BATTLE is in its discarded-VBlank hold. vblank() throws. */
  paletteHold = 0;

  private readonly logical: BattleCell[] = Array(SCREEN_WIDTH * SCREEN_HEIGHT).fill(' ');
  private readonly shown: BattleCell[] = Array(SCREEN_WIDTH * SCREEN_HEIGHT).fill(' ');
  private readonly background: BattleCell[] = Array(BG_COLUMNS * BG_ROWS).fill(' ');
  private readonly front: (BattlePicSlot | null)[] = Array(49).fill(null);
  private readonly back: (BattlePicSlot | null)[] = Array(49).fill(null);
  private readonly hud: (BattleHudSlot | null)[] = Array(0x7f - 0x62 + 1).fill(null);
  private readonly pending: BattleOam[] = Array.from({ length: 40 }, () => ({ y: 0, x: 0, tile: 0, attributes: 0 }));
  private shownOam: BattleOam[] = this.pending.map(entry => ({ ...entry }));
  private copying: VideoCopy | null = null;
  private bgNames: string[] = ['MEWMON', 'MEWMON', 'MEWMON', 'MEWMON'];
  private bgColours: Rgb[][] = this.bgNames.map(paletteOf);

  get cells(): readonly BattleCell[] { return this.logical.slice(); }
  get visibleCells(): readonly BattleCell[] { return this.shown.slice(); }

  at(x: number, y: number): BattleCell | null { return this.cell(this.logical, x, y); }
  visibleAt(x: number, y: number): BattleCell | null { return this.cell(this.shown, x, y); }
  bgAt(x: number, y: number): BattleCell | null {
    if (x < 0 || x >= BG_COLUMNS || y < 0 || y >= BG_ROWS) return null;
    return this.background[y * BG_COLUMNS + x];
  }
  put(x: number, y: number, value: BattleCell): void {
    if (x < 0 || x >= SCREEN_WIDTH || y < 0 || y >= SCREEN_HEIGHT) return;
    this.logical[y * SCREEN_WIDTH + x] = value;
  }
  putBg(x: number, y: number, value: BattleCell): void {
    if (x < 0 || x >= BG_COLUMNS || y < 0 || y >= BG_ROWS) return;
    this.background[y * BG_COLUMNS + x] = value;
  }
  paletteName(slot: number): string { return this.bgNames[slot]; }
  bgPalette(slot: number): readonly Rgb[] { return this.bgColours[slot]; }
  /** Slots 0–3 are the four bases through the current OBP0. Slots 4–7 use the current OBP1. */
  objPalette(slot: number): readonly Rgb[] {
    const base = this.bgColours[slot & 3];
    return throughRegister(base, slot < 4 ? this.obp0 : this.obp1);
  }
  frontSlot(id: number): BattlePicSlot | null { return id >= 0 && id <= 0x30 ? this.front[id] : null; }
  backSlot(id: number): BattlePicSlot | null { return id >= 0x31 && id <= 0x61 ? this.back[id - 0x31] : null; }
  hudSlot(id: number): BattleHudSlot | null { return id >= 0x62 && id <= 0x7f ? this.hud[id - 0x62] : null; }
  oam(index: number): BattleOam { return { ...this.shownOam[index] }; }

  setOam(index: number, entry: BattleOam): void {
    if (index < 0 || index >= 40) throw new Error('OAM index out of range');
    this.pending[index] = { ...entry };
  }

  /** CopyVideoData: floor(n/8)+1 serviced frames with the LCD on, and none with it off. */
  *copyFront(picture: string): Generator<void> {
    yield* this.copyTiles(49, index => { this.front[index] = { picture, tile: index }; });
  }
  *copyBack(picture: string): Generator<void> {
    yield* this.copyTiles(49, index => { this.back[index] = { picture, tile: index }; });
  }
  /** Extra font (30), then HUD1 (3), then HUD2+HUD3 (6). Later copies overwrite the shared ids. */
  *loadHudTilePatterns(): Generator<void> {
    yield* this.copyTiles(30, index => { this.hud[index] = { sheet: 'extra', tile: index }; });
    yield* this.copyTiles(3, index => { this.hud[0x6d - 0x62 + index] = { sheet: 'hud1', tile: index }; });
    yield* this.copyTiles(6, index => {
      const id = index < 3 ? 0x73 + index : 0x76 + (index - 3);
      const sheet = index < 3 ? 'hud2' : 'hud3';
      this.hud[id - 0x62] = { sheet, tile: index < 3 ? index : index - 3 };
    });
  }

  /**
   * SET_PAL_BATTLE. Colours apply before the first yield.
   * LCD on: 2 held frames (vblank throws) then Delay3's 3 serviced frames. LCD off: no yields.
   */
  *setPalBattle(input: BattlePaletteInput): Generator<'held' | 'serviced'> {
    const bar = (colour: number): string => {
      if (colour !== 0 && colour !== 1 && colour !== 2) throw new Error('battle bar colour out of range');
      return BARS[colour];
    };
    this.installPalettes([
      bar(input.playerBar), bar(input.enemyBar),
      getMonsterPalette(input.partySpecies), getMonsterPalette(input.enemySpecies2),
    ]);
    yield* this.paletteFrames();
  }

  *setPalBattleBlack(): Generator<'held' | 'serviced'> {
    this.installPalettes(['PAL_BLACK', 'PAL_BLACK', 'PAL_BLACK', 'PAL_BLACK']);
    yield* this.paletteFrames();
  }

  /**
   * One serviced VBlank. Throws during the palette hold so a frame program cannot
   * sneak a BG third, an OAM DMA or a TextBox tick through a discarded interrupt.
   */
  vblank(box?: TextBox, advanceText = false): number | null {
    if (this.paletteHold > 0) throw new Error('SET_PAL_BATTLE hold');
    if (box?.active && box.displaySession) throw new Error('Battle text requires standalone PrintText');
    this.captureText(box);
    const third = textBgTransfer.enabled ? textBgTransfer.nextPortion : null;
    if (third !== null) {
      const rowsPerThird = 6;
      const start = third * rowsPerThird * SCREEN_WIDTH;
      for (let index = 0; index < rowsPerThird * SCREEN_WIDTH; index++) this.shown[start + index] = this.logical[start + index];
    }
    if (this.copying) {
      const end = Math.min(this.copying.total, this.copying.next + 8);
      while (this.copying.next < end) this.copying.write(this.copying.next++);
    }
    this.shownOam = this.pending.map(entry => ({ ...entry }));
    if (box?.active) {
      if (advanceText) box.update(); else box.updateDisplay();
    } else textBgTransfer.tick();
    this.captureText(box);
    return third;
  }

  private *copyTiles(total: number, write: (index: number) => void): Generator<void> {
    if (this.copying) throw new Error('Battle VRAM copy already in progress');
    const enabled = textBgTransfer.enabled;
    textBgTransfer.enabled = false;
    try {
      if (!this.lcdOn) {
        for (let index = 0; index < total; index++) write(index);
        return;
      }
      this.copying = { write, next: 0, total };
      const frames = Math.floor(total / 8) + 1;
      for (let frame = 0; frame < frames; frame++) yield;
    } finally {
      this.copying = null;
      textBgTransfer.enabled = enabled;
    }
  }

  private *paletteFrames(): Generator<'held' | 'serviced'> {
    if (!this.lcdOn) return;
    try {
      for (let left = 2; left > 0; left--) {
        this.paletteHold = left;
        yield 'held';
      }
    } finally {
      this.paletteHold = 0;
    }
    for (let frame = 0; frame < 3; frame++) yield 'serviced';
  }

  private installPalettes(names: string[]): void {
    this.bgNames = names;
    this.bgColours = names.map(paletteOf);
  }

  /** TextBoxBorder(0, 12, 4, 18). The printer buffer's border cells are spaces, so only the inner 4×18 is copied. */
  private textBoxBorder(x: number, y: number, innerH: number, innerW: number): void {
    this.put(x, y, '┌');
    for (let i = 0; i < innerW; i++) this.put(x + 1 + i, y, '─');
    this.put(x + innerW + 1, y, '┐');
    for (let row = 0; row < innerH; row++) {
      this.put(x, y + 1 + row, '│');
      this.put(x + innerW + 1, y + 1 + row, '│');
    }
    const bottom = y + innerH + 1;
    this.put(x, bottom, '└');
    for (let i = 0; i < innerW; i++) this.put(x + 1 + i, bottom, '─');
    this.put(x + innerW + 1, bottom, '┘');
  }

  private captureText(box?: TextBox): void {
    if (!box?.active) return;
    const snapshot = box.saveScreen();
    if (!snapshot.border) return;
    this.textBoxBorder(0, 12, 4, 18);
    for (let row = 1; row <= 4; row++) for (let col = 1; col <= 18; col++)
      this.put(col, 12 + row, snapshot.buffer[row * 20 + col]);
  }

  private cell(cells: readonly BattleCell[], x: number, y: number): BattleCell | null {
    return x >= 0 && x < SCREEN_WIDTH && y >= 0 && y < SCREEN_HEIGHT ? cells[y * SCREEN_WIDTH + x] : null;
  }
}
