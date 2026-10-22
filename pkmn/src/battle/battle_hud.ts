// DrawPlayerHUDAndHPBar / DrawEnemyHUDAndHPBar (engine/battle/core.asm:1890–2049,
// draw_hud_pokeball_gfx.asm:123–168). Unused until A5c3: no caller, and this file
// does not run setPalBattle.
import { BattleScreen, battleGlyphTile } from './battle_screen';
import { textBgTransfer } from '../text/bg_transfer';
import { tokenizeGlyphs } from '../text/charmap';
import { LEVEL_GLYPH } from '../menus/menu_glyph_ids';
import { formatHpFraction, getHpBarLength, hpBarColor, hpBarFills } from '../menus/hp_bar';

export interface BattleHudMon {
  nickname: string;
  level: number;
  /** Raw status byte. PSN, then BRN, then FRZ, then PAR, then any sleep bits. No FNT. */
  status: number;
  hp: number;
  maxHp: number;
  /** Stored bar-colour byte: 0 green, 1 yellow, 2 red. */
  barColor: number;
}

export interface PlayerHudMon extends BattleHudMon {
  /** wLowHealthAlarm: bit 7 enables, the low 7 bits are the timer. */
  alarm: number;
  /** wLowHealthAlarmDisabled. Checked only while HP is still positive. */
  alarmDisabled: boolean;
}

export interface HudWrite {
  paletteRequest: boolean;
  barColor: number;
}

export interface PlayerHudWrite extends HudWrite {
  alarm: number;
  /** True when the clear path found bit 7 set, so CHAN5 is zeroed. */
  clearChan5: boolean;
}

const PSN = 1 << 3;
const BRN = 1 << 4;
const FRZ = 1 << 5;
const PAR = 1 << 6;
const SLP_MASK = 0x07;
const HP_BAR_RED = 2;
const ALARM_BIT = 0x80;

/** GetBattleHealthBarColor. The palette command itself waits for A5c3. */
export function getBattleHealthBarColor(oldByte: number, pixels: number): HudWrite {
  const barColor = colorByte(pixels);
  return { barColor, paletteRequest: barColor !== oldByte };
}

/** CenterMonName. One or two glyphs shift +2, three or four shift +1, then 0. */
export function centerMonName(x: number, name: string): number {
  const count = tokenizeGlyphs(name).length;
  if (count <= 2) return x + 2;
  if (count <= 4) return x + 1;
  return x;
}

/** PlaceHUDTiles. `$73` on this row, then the corner, eight `$76`, and the triangle on the next. */
export function placeHudTiles(
  screen: BattleScreen, x: number, y: number, step: number, corner: number, triangle: number,
): void {
  screen.put(x, y, 0x73);
  let cursor = x;
  screen.put(cursor, y + 1, corner);
  for (let i = 0; i < 8; i++) {
    cursor += step;
    screen.put(cursor, y + 1, 0x76);
  }
  screen.put(cursor + step, y + 1, triangle);
}

export function drawPlayerHudAndHpBar(screen: BattleScreen, mon: PlayerHudMon): PlayerHudWrite {
  let pixels = 0;
  writeWithTransferOff(() => {
    clearRectangle(screen, 9, 7, 11, 5);
    placeHudTiles(screen, 18, 10, -1, 0x77, 0x6f);
    screen.put(18, 9, 0x73);
    placeString(screen, centerMonName(10, mon.nickname), 7, mon.nickname);
    if (!printStatusConditionNotFainted(screen, 15, 8, mon.status)) printLevel(screen, 14, 8, mon.level);
    pixels = mon.hp <= 0 ? 0 : getHpBarLength(mon.hp, mon.maxHp);
    drawHpBar(screen, 10, 9, pixels, 1);
    placeString(screen, 11, 10, formatHpFraction(mon.hp, mon.maxHp));
  });
  const color = getBattleHealthBarColor(mon.barColor, pixels);
  return { ...color, ...playerAlarm(mon.hp, color.barColor, mon.alarm, mon.alarmDisabled) };
}

export function drawEnemyHudAndHpBar(screen: BattleScreen, mon: BattleHudMon): HudWrite {
  let pixels = 0;
  writeWithTransferOff(() => {
    clearRectangle(screen, 0, 0, 12, 4);
    placeHudTiles(screen, 1, 2, 1, 0x74, 0x78);
    placeString(screen, centerMonName(1, mon.nickname), 0, mon.nickname);
    if (!printStatusConditionNotFainted(screen, 5, 1, mon.status)) printLevel(screen, 4, 1, mon.level);
    // The enemy block floors the quotient, including 0. Nonzero C then shows one pixel.
    // Exact 0 HP sets C = E = 0, so the bar is empty. Colour uses E, before that sliver.
    pixels = mon.hp <= 0 ? 0 : enemyBarQuotient(mon.hp, mon.maxHp);
    drawHpBar(screen, 2, 2, pixels === 0 && mon.hp > 0 ? 1 : pixels, 0);
  });
  return getBattleHealthBarColor(mon.barColor, pixels);
}

/** hAutoBGTransferEnabled is cleared for the draw and then set, not restored. */
function writeWithTransferOff(write: () => void): void {
  textBgTransfer.enabled = false;
  write();
  textBgTransfer.enabled = true;
}

function playerAlarm(
  hp: number, barColor: number, alarm: number, disabled: boolean,
): { alarm: number; clearChan5: boolean } {
  if (hp > 0 && disabled) return { alarm, clearChan5: false };
  if (hp > 0 && barColor === HP_BAR_RED) return { alarm: alarm | ALARM_BIT, clearChan5: false };
  return { alarm: 0, clearChan5: (alarm & ALARM_BIT) !== 0 };
}

/** PrintStatusAilment. Returns true when it printed, which suppresses the level. */
function printStatusConditionNotFainted(screen: BattleScreen, x: number, y: number, status: number): boolean {
  const label = (status & PSN) !== 0 ? 'PSN'
    : (status & BRN) !== 0 ? 'BRN'
    : (status & FRZ) !== 0 ? 'FRZ'
    : (status & PAR) !== 0 ? 'PAR'
    : (status & SLP_MASK) !== 0 ? 'SLP'
    : null;
  if (label === null) return false;
  placeString(screen, x, y, label);
  return true;
}

/** PrintLevel. At 100 the three digits overwrite `<LV>`. */
function printLevel(screen: BattleScreen, x: number, y: number, level: number): void {
  const digits = String(level);
  if (level < 100) {
    screen.put(x, y, battleGlyphTile(LEVEL_GLYPH));
    placeString(screen, x + 1, y, digits);
  } else {
    placeString(screen, x, y, digits);
  }
}

function placeString(screen: BattleScreen, x: number, y: number, text: string): void {
  let column = x;
  for (const glyph of tokenizeGlyphs(text)) {
    screen.put(column, y, battleGlyphTile(glyph));
    column += 1;
  }
}

function clearRectangle(screen: BattleScreen, x: number, y: number, width: number, height: number): void {
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    screen.put(x + column, y + row, 0x7f);
  }
}

/** DrawHPBar. `type` 1 ends in `$6D`; type 0 ends in `$6C`. `pixels` is already the visible count. */
export function drawHpBar(screen: BattleScreen, x: number, y: number, pixels: number, type: 0 | 1): void {
  screen.put(x, y, 0x71);
  screen.put(x + 1, y, 0x62);
  const fills = hpBarFills(pixels);
  for (let i = 0; i < fills.length; i++) {
    const fill = fills[i];
    screen.put(x + 2 + i, y, fill === 8 ? 0x6b : 0x63 + fill);
  }
  screen.put(x + 8, y, type === 1 ? 0x6d : 0x6c);
}

function colorByte(pixels: number): number {
  const name = hpBarColor(pixels);
  return name === 'green' ? 0 : name === 'yellow' ? 1 : 2;
}

/** The enemy HUD's own multiply/divide (core.asm:1986–2033). No minimum of 1. */
function enemyBarQuotient(hp: number, max: number): number {
  let product = hp * 48;
  let divisor = max & 0xff;
  if (max >= 256) {
    product = Math.floor(product / 4);
    divisor = Math.floor(max / 4) & 0xff;
  }
  if (divisor === 0) return 0;
  return Math.floor(product / divisor) & 0xff;
}
