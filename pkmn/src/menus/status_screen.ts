// StatusScreen / StatusScreen2 (engine/pokemon/status_screen.asm).
import { getPlayerName } from '../core';
import type { BattlePokemon } from '../battle/types';
import { expToNextLevel } from '../battle/experience';
import { setMasterVolume } from '../audio';
import { isPassPressed, syncJoypadRead } from '../input';
import { fillRect, drawFadeOverlay, getCtx, getScale, loadBattleSprite, getMonsterPalette } from '../renderer';
import { textBgTransfer } from '../text/bg_transfer';
import { monDisplayName } from '../pokemon_names';
import { ScreenTiles } from './screen_tiles';
import { drawScreenTile } from './menu_render';
import { hpBarColor, hpBarFills, staticHpBarPixels, type HpBarColor } from './hp_bar';
import {
  loadStatusGlyphs, DOT_GLYPH, HP_GLYPH, HP_LEFT_GLYPH, HP_END_GLYPH, HP_FILL_GLYPHS,
  HALF_ARROW_GLYPH, TO_GLYPH, BOLD_P_GLYPH, ID_GLYPH, NUMBER_GLYPH,
  LINE_H_GLYPH, LINE_CORNER_GLYPH, LINE_V_GLYPH,
} from './menu_glyphs';

let moveNames: Record<string, string> = {};
/** Startup data, extracted in CP2; never a runtime ROM dependency. */
export async function loadStatusScreenAssets(): Promise<void> {
  await Promise.all([loadStatusGlyphs(), (async () => {
    const response = await fetch('move_names.json');
    if (!response.ok) throw new Error(`move names: HTTP ${response.status}`);
    moveNames = await response.json() as Record<string, string>;
  })()]);
}

const PIC = '\uE030'; // The padded, flipped 7×7 picture in vChars2.
type Phase = 'setup' | 'page1' | 'page2Delay' | 'page2' | 'clear' | 'done';

export class StatusScreenSession {
  readonly tiles = new ScreenTiles();
  paletteWhite = true;
  private phase: Phase = 'setup';
  private age = 0;
  private picture: HTMLCanvasElement | null = null;
  private readonly barColor: HpBarColor;

  constructor(private readonly mon: BattlePokemon, options: { syncRead: boolean }) {
    // Party's legacy input adapter has already read this selection. Bill's MenuInput
    // uses the real Joypad read and must retain its hJoyLast unchanged.
    if (options.syncRead) syncJoypadRead();
    setMasterVolume(3, 3);
    this.barColor = hpBarColor(staticHpBarPixels(mon.currentHp, mon.maxHp));
    loadBattleSprite(`/gfx/sprites/front/${mon.species.id}.png`, getMonsterPalette(mon.species.id))
      .then(picture => { this.picture = picture; });
    // Selection S has already had its VBlank. The first frame() is S+1.
  }

  frame(readJoypad: () => void): 'busy' | 'done' {
    if (this.phase === 'done') return 'done';
    // The only BG-transfer tick while active, including Q+3. Hosts must skip theirs.
    this.tiles.present(textBgTransfer);
    this.age++;
    if (this.phase === 'setup') {
      if (this.age === 3) this.tiles.clearArea(0, 0, 18, 20);
      if (this.age === 6) textBgTransfer.enabled = false; // UpdateSprites, then tile copies
      if (this.age === 14) { this.drawLabelsAndHp(); textBgTransfer.enabled = true; }
      if (this.age === 17) this.drawPage1(); // RunPaletteCommand's CGB Delay3 returned
      if (this.age === 20) { this.paletteWhite = false; textBgTransfer.enabled = false; }
      if (this.age < 27) return 'busy';
      this.tiles.clearArea(1, 0, 7, 7);
      for (let y = 0; y < 7; y++) for (let x = 1; x <= 7; x++) this.tiles.put(x, y, PIC);
      textBgTransfer.enabled = true;
      // Cry is the existing J2 stub: no wait before WaitForTextScrollButtonPress.
      this.phase = 'page1';
    } else if (this.phase === 'page2Delay') {
      if (this.age < 3) return 'busy';
      this.phase = 'page2';
    } else if (this.phase === 'clear') {
      if (this.age < 3) return 'busy';
      this.phase = 'done';
      return 'done';
    }
    // Both pages accept fresh A OR B, with no sound, repeat mode or irrelevant-key delay.
    readJoypad();
    if (!isPassPressed('a') && !isPassPressed('b')) return 'busy';
    this.age = 0;
    if (this.phase === 'page1') {
      textBgTransfer.enabled = false;
      this.drawPage2();
      textBgTransfer.enabled = true;
      this.phase = 'page2Delay';
    } else {
      setMasterVolume(7, 7);
      this.paletteWhite = true;
      this.tiles.clearArea(0, 0, 18, 20);
      this.phase = 'clear';
    }
    return 'busy';
  }

  private lineBox(x: number, y: number, height: number, width: number): void {
    for (let row = 0; row < height; row++) this.tiles.put(x, y + row, LINE_V_GLYPH);
    this.tiles.put(x, y + height, LINE_CORNER_GLYPH);
    for (let col = 1; col <= width; col++) this.tiles.put(x - col, y + height, LINE_H_GLYPH);
    this.tiles.put(x - width - 1, y + height, HALF_ARROW_GLYPH);
  }

  private number(x: number, y: number, value: number, digits: number, leadingZeroes = false): void {
    this.tiles.writeNumber(x, y, value, { digits, leadingZeroes });
  }

  private drawLabelsAndHp(): void {
    const t = this.tiles, mon = this.mon;
    this.lineBox(19, 1, 6, 10); this.lineBox(19, 9, 8, 6);
    t.put(1, 7, NUMBER_GLYPH); t.put(2, 7, DOT_GLYPH);
    t.placeString(10, 9, `TYPE1/<NEXT>TYPE2/<NEXT>${ID_GLYPH}${NUMBER_GLYPH}/<NEXT>OT/`);
    t.put(11, 3, HP_GLYPH); t.put(12, 3, HP_LEFT_GLYPH);
    hpBarFills(staticHpBarPixels(mon.currentHp, mon.maxHp))
      .forEach((fill, i) => t.put(13 + i, 3, HP_FILL_GLYPHS[fill]));
    t.put(19, 3, HP_END_GLYPH);
    this.number(12, 4, mon.currentHp, 3); t.put(15, 4, '/'); this.number(16, 4, mon.maxHp, 3);
  }

  private drawPage1(): void {
    const t = this.tiles, mon = this.mon;
    t.placeString(9, 1, monDisplayName(mon)); t.printLevel(14, 2, mon.level);
    t.placeString(9, 6, 'STATUS/'); t.placeString(16, 6, mon.currentHp === 0 ? 'FNT' : mon.status ?? 'OK');
    this.number(3, 7, mon.species.id, 3, true);
    t.placeString(11, 10, mon.species.type1);
    if (mon.species.type2 && mon.species.type2 !== mon.species.type1) t.placeString(11, 12, mon.species.type2);
    else t.clearArea(10, 11, 1, 6); // EraseType2Text, after the TYPE2/ label was placed
    this.number(12, 14, mon.otId, 5, true); t.placeString(12, 16, mon.otName || getPlayerName());
    t.textBoxBorder(0, 8, 8, 8);
    const stats = [['ATTACK', mon.attack], ['DEFENSE', mon.defense], ['SPEED', mon.speed], ['SPECIAL', mon.special]] as const;
    stats.forEach(([label, value], i) => { t.placeString(1, 9 + i * 2, label); this.number(6, 10 + i * 2, value, 3); });
  }

  private drawPage2(): void {
    const t = this.tiles, mon = this.mon;
    t.clearArea(9, 2, 5, 10); t.put(19, 3, LINE_V_GLYPH);
    t.textBoxBorder(0, 8, 8, 18);
    for (let i = 0; i < 4; i++) {
      const move = mon.moves[i], y = 9 + i * 2;
      t.placeString(2, y, move ? moveNames[move.id] : '-');
      t.placeString(11, y + 1, move ? BOLD_P_GLYPH.repeat(2) : '--');
      if (move) {
        this.number(14, y + 1, move.pp & 0x3f, 2); t.put(16, y + 1, '/'); this.number(17, y + 1, move.maxPp, 2);
      }
    }
    t.placeString(9, 3, 'EXP POINTS<NEXT>LEVEL UP');
    this.number(12, 4, mon.exp, 7);
    this.number(7, 6, expToNextLevel(mon.species.growthRate, mon.level, mon.exp), 7);
    t.put(14, 6, TO_GLYPH); t.printLevel(16, 6, Math.min(mon.level + 1, 100));
    t.clearArea(9, 0, 2, 10); t.placeString(9, 1, mon.species.name.toUpperCase());
  }

  render(): void {
    if (this.paletteWhite) { drawFadeOverlay(1); return; }
    fillRect(0, 0, 160, 144, 0);
    for (let y = 0; y < 18; y++) for (let x = 0; x < 20; x++) {
      const glyph = this.tiles.visibleAt(x, y);
      if (glyph === PIC) this.renderPictureTile(x, y);
      else if (glyph !== null) drawScreenTile(glyph, x * 8, y * 8, this.barColor);
    }
  }

  private renderPictureTile(x: number, y: number): void {
    const picture = this.picture;
    if (!picture) return;
    const w = picture.width / 8, h = picture.height / 8;
    // UncompressMonSprite centers the source, then FlipSpriteData mirrors the entire 7×7 area.
    const left = 1 + 7 - ((8 - w) >> 1) - w, top = 7 - h;
    if (x < left || x >= left + w || y < top || y >= top + h) return; // padded shade 0
    const ctx = getCtx(), s = getScale();
    ctx.save(); ctx.translate((x + 1) * 8 * s, y * 8 * s); ctx.scale(-1, 1);
    ctx.drawImage(picture, (w - 1 - (x - left)) * 8, (y - top) * 8, 8, 8, 0, 0, 8 * s, 8 * s);
    ctx.restore();
  }
}
