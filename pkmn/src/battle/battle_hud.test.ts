import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BattleScreen, battleGlyphTile, type BattleCell } from './battle_screen';
import { drawEnemyHudAndHpBar, drawPlayerHudAndHpBar, type BattleHudMon, type PlayerHudMon } from './battle_hud';
import { textBgTransfer } from '../text/bg_transfer';

interface HudFixture extends BattleHudMon {
  side: 'player' | 'enemy';
  pixels: number;
  color: 'green' | 'yellow' | 'red';
  name_x: number;
  region: { x: number; y: number; width: number; height: number };
  cells: number[][];
}

const COLOR_BYTE = { green: 0, yellow: 1, red: 2 } as const;
const STATUS_BYTE: Record<string, number> = { PSN: 0x08, BRN: 0x10, FRZ: 0x20, PAR: 0x40, SLP: 0x01 };

function tileId(cell: BattleCell | null): number {
  if (typeof cell === 'number') return cell;
  if (typeof cell === 'string') return battleGlyphTile(cell);
  throw new Error('empty battle cell');
}

function loadFixtures(): HudFixture[] {
  const text = readFileSync(resolve(__dirname, '../../../notes/66-a5c1-cp1/hud_cells.json'), 'utf8');
  return (JSON.parse(text) as (Omit<HudFixture, 'status' | 'nickname'> & { name: string; status: string | null })[])
    .map(fixture => ({
      ...fixture,
      nickname: fixture.name,
      status: fixture.status === null ? 0 : STATUS_BYTE[fixture.status],
    }));
}

function fillSentinel(screen: BattleScreen): void {
  for (let y = 0; y < 18; y++) for (let x = 0; x < 20; x++) screen.put(x, y, 0x11);
}

afterEach(() => { textBgTransfer.enabled = true; });

describe('battle HUD writers', () => {
  const fixtures = loadFixtures();

  it('matches all 42 traced rectangles, and leaves every other cell alone', () => {
    expect(fixtures).toHaveLength(42);
    for (const fixture of fixtures) {
      const screen = new BattleScreen();
      fillSentinel(screen);
      const mon = {
        nickname: fixture.nickname, level: fixture.level, status: fixture.status,
        hp: fixture.hp, maxHp: fixture.maxHp, barColor: COLOR_BYTE[fixture.color],
        alarm: 0, alarmDisabled: false,
      };
      const written = fixture.side === 'player'
        ? drawPlayerHudAndHpBar(screen, mon)
        : drawEnemyHudAndHpBar(screen, mon);
      const { x, y, width, height } = fixture.region;
      for (let row = 0; row < 18; row++) for (let column = 0; column < 20; column++) {
        const inside = column >= x && column < x + width && row >= y && row < y + height;
        const actual = tileId(screen.at(column, row));
        const expected = inside ? fixture.cells[row][column] : 0x11;
        expect(actual, `${fixture.side} ${fixture.nickname} ${fixture.hp}/${fixture.maxHp} ${column},${row}`).toBe(expected);
      }
      expect(written.paletteRequest, fixture.side).toBe(false);
      expect(written.barColor).toBe(COLOR_BYTE[fixture.color]);
      if (fixture.side === 'player') {
        const player = written as ReturnType<typeof drawPlayerHudAndHpBar>;
        const red = fixture.hp > 0 && fixture.color === 'red';
        expect(player.alarm).toBe(red ? 0x80 : 0);
        expect(player.clearChan5).toBe(false);
      }
    }
  });

  it('holds the transfer off during the writes and leaves it on afterwards', () => {
    const screen = new BattleScreen();
    const during: boolean[] = [];
    const put = screen.put.bind(screen);
    screen.put = (x, y, value) => {
      during.push(textBgTransfer.enabled);
      put(x, y, value);
    };
    textBgTransfer.enabled = true;
    drawEnemyHudAndHpBar(screen, { nickname: 'PIDGEY', level: 5, status: 0, hp: 45, maxHp: 45, barColor: 0 });
    expect(during.length).toBeGreaterThan(0);
    expect(during.every(flag => flag === false)).toBe(true);
    expect(textBgTransfer.enabled).toBe(true);
    during.length = 0;
    textBgTransfer.enabled = false;
    drawPlayerHudAndHpBar(screen, {
      nickname: 'PIKACHU', level: 5, status: 0, hp: 45, maxHp: 45, barColor: 0, alarm: 0, alarmDisabled: false,
    });
    expect(during.every(flag => flag === false)).toBe(true);
    expect(textBgTransfer.enabled).toBe(true);
  });

  it('requests a palette only when the colour byte changes, and does not run it', () => {
    const screen = new BattleScreen();
    const full: PlayerHudMon = {
      nickname: 'PIKACHU', level: 5, status: 0, hp: 45, maxHp: 45, barColor: 2, alarm: 0, alarmDisabled: false,
    };
    const changed = drawPlayerHudAndHpBar(screen, full);
    expect(changed.paletteRequest).toBe(true);
    expect(changed.barColor).toBe(0);
    expect(screen.paletteHold).toBe(0);
    expect(screen.paletteName(0)).toBe('MEWMON');
    const same = drawEnemyHudAndHpBar(screen, { ...full, nickname: 'PIDGEY', barColor: 0 });
    expect(same.paletteRequest).toBe(false);
    expect(same.barColor).toBe(0);
  });

  it('covers every player-alarm branch, and the enemy HUD has no alarm result', () => {
    const base: PlayerHudMon = {
      nickname: 'PIKACHU', level: 5, status: 0, hp: 9, maxHp: 45, barColor: 2, alarm: 0x05, alarmDisabled: false,
    };
    const screen = new BattleScreen();
    const set = drawPlayerHudAndHpBar(screen, base);
    expect(set.alarm).toBe(0x85);
    expect(set.clearChan5).toBe(false);
    const kept = drawPlayerHudAndHpBar(screen, { ...base, alarm: 0x8a });
    expect(kept.alarm).toBe(0x8a);
    expect(kept.clearChan5).toBe(false);
    const disabled = drawPlayerHudAndHpBar(screen, { ...base, alarm: 0x8a, alarmDisabled: true });
    expect(disabled.alarm).toBe(0x8a);
    expect(disabled.clearChan5).toBe(false);
    const yellow = drawPlayerHudAndHpBar(screen, { ...base, hp: 22, alarm: 0x8a });
    expect(yellow.alarm).toBe(0);
    expect(yellow.clearChan5).toBe(true);
    const greenClear = drawPlayerHudAndHpBar(screen, { ...base, hp: 45, alarm: 0x0a });
    expect(greenClear.alarm).toBe(0);
    expect(greenClear.clearChan5).toBe(false);
    const fainted = drawPlayerHudAndHpBar(screen, { ...base, hp: 0, alarm: 0x8a, alarmDisabled: true });
    expect(fainted.alarm).toBe(0);
    expect(fainted.clearChan5).toBe(true);
    const faintedQuiet = drawPlayerHudAndHpBar(screen, { ...base, hp: 0, alarm: 0x0a });
    expect(faintedQuiet.alarm).toBe(0);
    expect(faintedQuiet.clearChan5).toBe(false);
    const enemy = drawEnemyHudAndHpBar(screen, { ...base, nickname: 'PIDGEY', hp: 9 });
    expect(enemy).toEqual({ paletteRequest: false, barColor: 2 });
  });

  it('prints status by priority, including at 0 HP, and never prints FNT', () => {
    const screen = new BattleScreen();
    const poisoned = drawPlayerHudAndHpBar(screen, {
      nickname: 'PIKACHU', level: 100, status: 0x08 | 0x10 | 0x07, hp: 0, maxHp: 45,
      barColor: 2, alarm: 0, alarmDisabled: false,
    });
    expect(poisoned.barColor).toBe(2);
    expect([15, 16, 17].map(column => tileId(screen.at(column, 8)))).toEqual(
      ['P', 'S', 'N'].map(battleGlyphTile),
    );
    expect(tileId(screen.at(14, 8))).toBe(0x7f);
    drawEnemyHudAndHpBar(screen, {
      nickname: 'PIDGEY', level: 5, status: 0x07, hp: 45, maxHp: 45, barColor: 0,
    });
    expect([5, 6, 7].map(column => tileId(screen.at(column, 1)))).toEqual(
      ['S', 'L', 'P'].map(battleGlyphTile),
    );
  });

  it('counts a contraction as one glyph when centering the name', () => {
    const screen = new BattleScreen();
    drawEnemyHudAndHpBar(screen, {
      nickname: "A'd", level: 5, status: 0, hp: 45, maxHp: 45, barColor: 0,
    });
    expect(tileId(screen.at(3, 0))).toBe(battleGlyphTile('A'));
    expect(tileId(screen.at(4, 0))).toBe(battleGlyphTile("'d"));
    expect(tileId(screen.at(1, 0))).toBe(0x7f);
  });
});
