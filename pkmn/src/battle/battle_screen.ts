// Battle wTileMap, VRAM and OAM. Unused until A5c3: nothing in main or battle imports this.
// VBlank order follows home/vblank.asm:28–40: BG third, video copy, OAM DMA, then the TextBox tick.
import { textBgTransfer } from '../text/bg_transfer';
import type { TextBox } from '../text/textbox';
import { delayFrames, type Program } from './battle_menu_context';
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
export interface BattleScreenBuffer2 {
  saveScreenTilesToBuffer2(): void;
  loadScreenTilesFromBuffer2(): void;
}
const stateScreens = new WeakMap<object, BattleScreen>();
/** pret animations.asm:599-617: one presentation owner for a battle, including headless Programs. */
export function battleScreenFor(state: object): BattleScreen {
  let screen = stateScreens.get(state);
  if (!screen) { screen = new BattleScreen(); stateScreens.set(state, screen); }
  return screen;
}
/** pret home/tilemap.asm:9-28; note 69 section 10.4 item 0: inspect without creating a lazy screen. */
export function boundBattleScreenFor(state: object): BattleScreen | undefined {
  return stateScreens.get(state);
}
/** pret home/tilemap.asm:9-28: associate the active host with its existing screen/Buffer 2. */
export function bindBattleScreen(state: object, screen: BattleScreen): void {
  stateScreens.set(state, screen);
}

export class BattleScreen {
  bgp = 0xe4;
  obp0 = 0xd0;
  obp1 = 0xe0;
  /** rWX. The window's left edge is wx − 7. */
  wx = 7;
  /** rWY. $90 hides the window below the screen; serviced VBlank copies a bound hWY. */
  wy = 0;
  private windowRegisters?: { readonly wy: number; readonly disabled: number };
  /** pret home/vblank.asm:19-26. Bind the animation's WRAM/HRAM views, without duplicate register storage. */
  bindWindowRegisters(registers: { readonly wy: number; readonly disabled: number }): void {
    this.windowRegisters = registers;
  }
  get disableVBlankWYUpdate(): number { return this.windowRegisters?.disabled ?? 0; }
  /** pret init_battle.asm:104-117: transfer into the shown BG1 window by default. */
  transferDestination: 0x98 | 0x9c = 0x9c;
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
  private buffer2: readonly BattleCell[] = this.cells;
  private readonly front: (BattlePicSlot | null)[] = Array(49).fill(null);
  private readonly back: (BattlePicSlot | null)[] = Array(49).fill(null);
  private readonly spritePictures: (BattlePicSlot | null)[] = Array(49).fill(null);
  private readonly frontFlips: boolean[] = Array(49).fill(false);
  private readonly backFlips: boolean[] = Array(49).fill(false);
  private readonly spriteFlips: boolean[] = Array(49).fill(false);
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
  /** pret core.asm:6433-6443, init_battle.asm:173-178. Independent $8000 picture owner. */
  spriteSlot(id: number): BattlePicSlot | null { return id >= 0 && id <= 0x30 ? this.spritePictures[id] : null; }
  /** pret home/uncompress.asm:307,394,487; home/pics.asm:174-186. Decode orientation belongs to each copied tile. */
  pictureFlipped(id: number, sprite = false): boolean {
    return sprite ? this.spriteFlips[id] ?? false : id < 0x31 ? this.frontFlips[id] ?? false : this.backFlips[id - 0x31] ?? false;
  }
  hudSlot(id: number): BattleHudSlot | null { return id >= 0x62 && id <= 0x7f ? this.hud[id - 0x62] : null; }
  oam(index: number): BattleOam { return { ...this.shownOam[index] }; }
  /** pret home/clear_sprites.asm:11-20. CPU shadow OAM, before the next DMA. */
  shadowOam(index: number): BattleOam { return { ...this.pending[index] }; }

  setOam(index: number, entry: BattleOam): void {
    if (index < 0 || index >= 40) throw new Error('OAM index out of range');
    this.pending[index] = { ...entry };
  }

  /** CopyVideoData: floor(n/8)+1 serviced frames with the LCD on, and none with it off. */
  *copyFront(picture: string, flipped = false): Generator<void> {
    yield* this.copyTiles(49, index => { this.front[index] = { picture, tile: index }; this.frontFlips[index] = flipped; });
  }
  *copyBack(picture: string, flipped = false): Generator<void> {
    yield* this.copyTiles(49, index => { this.back[index] = { picture, tile: index }; this.backFlips[index] = flipped; });
  }
  /** pret core.asm:6433-6443, init_battle.asm:173-178. Same seven serviced frames, separate sprite VRAM. */
  *copySpritePicture(picture: string, flipped = false): Generator<void> {
    yield* this.copyTiles(49, index => { this.spritePictures[index] = { picture, tile: index }; this.spriteFlips[index] = flipped; });
  }
  /** pret core.asm:6692-6693. Extra font (30), then the HUD-only entry (3 + 6). */
  *loadHudAndHpBarAndStatusTilePatterns(): Generator<void> {
    yield* this.copyTiles(30, index => { this.hud[index] = { sheet: 'extra', tile: index }; });
    yield* this.loadHudOnlyTilePatterns();
  }
  /** Compatibility entry for earlier callers/tests; the full entry is named above. */
  *loadHudTilePatterns(): Generator<void> { yield* this.loadHudAndHpBarAndStatusTilePatterns(); }

  /** pret core.asm:6695-6722. HUD-only copies, without LoadHpBarAndStatusTilePatterns. */
  *loadHudOnlyTilePatterns(): Generator<void> {
    yield* this.copyTiles(3, index => { this.hud[0x6d - 0x62 + index] = { sheet: 'hud1', tile: index }; });
    yield* this.copyTiles(6, index => {
      const id = index < 3 ? 0x73 + index : 0x76 + (index - 3);
      const sheet = index < 3 ? 'hud2' : 'hud3';
      this.hud[id - 0x62] = { sheet, tile: index < 3 ? index : index - 3 };
    });
  }

  /** pret home/copy2.asm:41-103, CopyVideoData. Reuse the existing queue for sprite patterns. */
  *copyVideoData(total: number, write: (index: number) => void): Generator<void> {
    yield* this.copyTiles(total, write);
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

  /** pret animations.asm:599-617,2770-2775; home/copy2.asm:226-239, tilemap.asm:9-28.
   * ClearScreen and both destination writes each include Delay3, plus the enabled BG0 Delay3.
   * BG0 is the backdrop exposed by wy; the renderer's shown window always reads BG1.
   */
  *refreshAfterAnimation(buffers: BattleScreenBuffer2 = this): Program {
    buffers.saveScreenTilesToBuffer2();
    textBgTransfer.enabled = false;
    this.logical.fill(' ');
    yield* delayFrames(3);
    this.transferDestination = 0x98;
    yield* delayFrames(3);
    textBgTransfer.enabled = true;
    yield* delayFrames(3);
    textBgTransfer.enabled = false;
    buffers.loadScreenTilesFromBuffer2(); // This CPU copy enables automatic transfers again.
    this.transferDestination = 0x9c;
    yield* delayFrames(3);
    textBgTransfer.enabled = true;
  }

  /** pret home/tilemap.asm:9-13. Shared by the existing host port and Func_78e98. */
  saveScreenTilesToBuffer2(): void { this.buffer2 = this.cells; }

  /** pret home/tilemap.asm:15-28. Restore CPU tiles and leave automatic transfers enabled. */
  loadScreenTilesFromBuffer2(): void {
    textBgTransfer.enabled = false;
    this.buffer2.forEach((cell, index) => { this.logical[index] = cell; });
    textBgTransfer.enabled = true;
  }

  /**
   * One serviced VBlank. Throws during the palette hold so a frame program cannot
   * sneak a BG third, an OAM DMA or a TextBox tick through a discarded interrupt.
   */
  vblank(box?: TextBox, advanceText = false): number | null {
    if (this.paletteHold > 0) throw new Error('SET_PAL_BATTLE hold');
    if (box?.active && box.displaySession) throw new Error('Battle text requires standalone PrintText');
    if (this.windowRegisters && this.disableVBlankWYUpdate === 0) this.wy = this.windowRegisters.wy;
    this.captureText(box);
    const third = textBgTransfer.enabled ? textBgTransfer.nextPortion : null;
    if (third !== null) {
      const rowsPerThird = 6;
      const start = third * rowsPerThird * SCREEN_WIDTH;
      for (let index = 0; index < rowsPerThird * SCREEN_WIDTH; index++) {
        const source = start + index;
        if (this.transferDestination === 0x98) {
          this.background[Math.floor(source / SCREEN_WIDTH) * BG_COLUMNS + source % SCREEN_WIDTH] = this.logical[source];
        } else this.shown[source] = this.logical[source];
      }
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
