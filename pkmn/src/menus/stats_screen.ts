// Existing two stats pages, shared with Bill's PC; StatusScreen is a later slice.
import { GB_WIDTH, GB_HEIGHT, TILE_SIZE, getPlayerName } from '../core';
import { fillRect, getCtx, getScale } from '../renderer';
import { isPressed } from '../input';
import { playSFX } from '../audio';
import { loadPokemonSprites, expToNextLevel } from '../battle';
import type { BattlePokemon } from '../battle';
import type { GameButton } from '../core';
import { monDisplayName } from '../pokemon_names';
import { formatHpFraction } from './hp_bar';
import { drawText, drawBox } from './menu_render';
import { drawLevel, drawTileHpBar, drawLineBox, drawNarrowTo, loadPartyTiles } from './party_tiles';

export class StatsScreen {
  private mon: BattlePokemon | null = null;
  private statsPage = 1;
  private frontSprite: HTMLCanvasElement | null = null;
  private spriteLoadingFor = '';
  constructor(private readonly silent = false) {}

  show(mon: BattlePokemon): void {
    this.mon = mon; this.statsPage = 1; this.frontSprite = null;
    loadPartyTiles(); this.loadFrontSprite();
  }

  update(pressed: (key: GameButton) => boolean = isPressed): boolean {
    if (pressed('a')) {
      if (!this.silent) playSFX('press_ab');
      if (this.statsPage === 1) this.statsPage = 2;
      else return true;
    } else if (pressed('b')) {
      if (!this.silent) playSFX('press_ab');
      return true;
    }
    return false;
  }

  private loadFrontSprite(): void {
    const mon = this.mon;
    if (!mon) return;
    const name = mon.species.name;
    if (this.spriteLoadingFor === name && this.frontSprite) return;
    this.frontSprite = null;
    this.spriteLoadingFor = name;
    loadPokemonSprites(name, mon.species.id).then(sprites => {
      if (this.spriteLoadingFor === name) {
        this.frontSprite = sprites.front;
      }
    }).catch(() => { /* sprite not available */ });
  }

  /** Draw the front sprite (flipped, matching assembly LoadFlippedFrontSpriteByMonIndex). */
  private drawFrontSprite(): void {
    if (!this.frontSprite) return;
    const ctx = getCtx();
    const s = getScale();
    const spriteW = this.frontSprite.width;
    const spriteH = this.frontSprite.height;
    // Assembly: hlcoord 1, 0 → sprite area is 7×7 tiles (56×56px) at pixel (8, 0)
    // Sprite is bottom-right aligned within the 56×56 area, and horizontally flipped
    const areaX = TILE_SIZE; // column 1
    const areaSize = 7 * TILE_SIZE; // 56px
    const x = areaX + (areaSize - spriteW);
    const y = areaSize - spriteH;
    // Draw flipped (mirrored horizontally, matching original status screen)
    ctx.save();
    ctx.translate((x + spriteW) * s, y * s);
    ctx.scale(-1, 1);
    ctx.drawImage(this.frontSprite, 0, 0, spriteW, spriteH, 0, 0, spriteW * s, spriteH * s);
    ctx.restore();
  }

  /** Render stats page 1: sprite, name, level, HP, status, stats, type, ID, OT */
  private renderStatsPage1(): void {
    const mon = this.mon;
    if (!mon) return;
    const T = TILE_SIZE;

    fillRect(0, 0, GB_WIDTH, GB_HEIGHT, 0);

    // Front sprite (top-left area, 7×7 tiles)
    this.drawFrontSprite();

    // "No.XXX" below sprite — assembly: number at hlcoord 3, 7, label before it
    const dexNum = String(mon.species.id).padStart(3, '0');
    drawText('No.' + dexNum, 1 * T, 7 * T);

    // Name — assembly: hlcoord 9, 1
    drawText(monDisplayName(mon), 9 * T, 1 * T);

    // Level — assembly: hlcoord 14, 2
    drawLevel(mon.level, 14 * T, 2 * T);

    // HP bar — assembly: hlcoord 11, 3
    drawTileHpBar(11 * T, 3 * T, mon.currentHp, mon.maxHp);

    // HP numbers — assembly: below the status-screen bar
    drawText(formatHpFraction(mon.currentHp, mon.maxHp), 12 * T, 4 * T);

    // "STATUS/" + condition — assembly: hlcoord 9, 6 and hlcoord 16, 6
    drawText('STATUS/', 9 * T, 6 * T);
    drawText(mon.status ?? 'OK', 16 * T, 6 * T);

    // Bottom-left box: stats — assembly: hlcoord 0, 8, rows 8-17 (10 tiles tall)
    drawBox(0, 8 * T, 10 * T, 10 * T);

    // DrawLineBox: top-right info area — assembly: hlcoord 19, 1; lb bc, 6, 10
    // Vertical │ at col 19 rows 1-6, ┘ at (19,7), ─ from col 18 to 9 at row 7
    drawLineBox(19, 1, 6, 10);

    // DrawLineBox: bottom-right type/ID/OT — assembly: hlcoord 19, 9; lb bc, 8, 6
    // Vertical │ at col 19 rows 9-16, ┘ at (19,17), ─ from col 18 to 13 at row 17
    drawLineBox(19, 9, 8, 6);

    const stats = [
      ['ATTACK', mon.attack],
      ['DEFENSE', mon.defense],
      ['SPEED', mon.speed],
      ['SPECIAL', mon.special],
    ] as const;

    for (let i = 0; i < stats.length; i++) {
      // Label on first row, value right-aligned on second row
      const labelY = (9 + i * 2) * T;
      const valY = (10 + i * 2) * T;
      drawText(stats[i][0], 1 * T, labelY);
      const valText = String(stats[i][1]);
      // Right-align value within left box (column ~7)
      drawText(valText, (8 - valText.length) * T, valY);
    }

    // Right section: type, ID, OT — no border (assembly uses DrawLineBox, not TextBoxBorder)

    // TYPE1/ — assembly: hlcoord 10, 9
    drawText('TYPE1/', 10 * T, 9 * T);
    // Type value — assembly: hlcoord 11, 10
    drawText(mon.species.type1, 11 * T, 10 * T);

    // TYPE2 (if dual-type)
    if (mon.species.type2 && mon.species.type2 !== mon.species.type1) {
      drawText('TYPE2/', 10 * T, 11 * T);
      drawText(mon.species.type2, 11 * T, 12 * T);
    }

    // IDNo/ — assembly: approximate position
    drawText('IDNo/', 10 * T, 13 * T);
    // ID value — assembly: hlcoord 12, 14
    const idText = String(mon.species.id).padStart(5, '0');
    drawText(idText, 12 * T, 14 * T);

    // OT/ — assembly: approximate position
    drawText('OT/', 10 * T, 15 * T);
    // OT value — assembly: hlcoord 12, 16
    drawText(mon.otName || getPlayerName(), 12 * T, 16 * T);
  }

  /** Render stats page 2: sprite, name, EXP, level up, moves + PP */
  private renderStatsPage2(): void {
    const mon = this.mon;
    if (!mon) return;
    const T = TILE_SIZE;

    fillRect(0, 0, GB_WIDTH, GB_HEIGHT, 0);

    // Front sprite (same position as page 1)
    this.drawFrontSprite();

    // "No.XXX" below sprite — assembly: hlcoord 3, 7
    const dexNum = String(mon.species.id).padStart(3, '0');
    drawText('No.' + dexNum, 1 * T, 7 * T);

    // Name — assembly: hlcoord 9, 1
    drawText(monDisplayName(mon), 9 * T, 1 * T);

    // Top DrawLineBox persists from page 1 — assembly: hlcoord 19, 1; lb bc, 6, 10
    drawLineBox(19, 1, 6, 10);

    // "EXP POINTS" — assembly: hlcoord 9, 3
    drawText('EXP POINTS', 9 * T, 3 * T);

    // Current EXP value — assembly: hlcoord 12, 4; lb bc, 3, 7 (right-aligned in 7 chars)
    const expText = String(mon.exp).padStart(7, ' ');
    drawText(expText, 12 * T, 4 * T);

    // "LEVEL UP" — assembly: hlcoord 9, 5
    drawText('LEVEL UP', 9 * T, 5 * T);

    // EXP to next level — assembly: hlcoord 7, 6; lb bc, 3, 7 (right-aligned in 7 chars)
    const nextLevel = Math.min(mon.level + 1, 100);
    const toNext = expToNextLevel(mon.species.growthRate, mon.level, mon.exp);
    const toNextText = String(toNext).padStart(7, ' ');
    drawText(toNextText, 7 * T, 6 * T);

    // Narrow "to" at col 14 — assembly: hlcoord 14, 6; ld [hl], '<to>' (single tile $70)
    drawNarrowTo(14 * T, 6 * T);

    // Target level via PrintLevel at col 16 — assembly: hlcoord 16, 6
    drawLevel(nextLevel, 16 * T, 6 * T);

    // Moves box — assembly: hlcoord 0, 8; lb bc, 8, 18 (TextBoxBorder = 10 rows total)
    drawBox(0, 8 * T, GB_WIDTH, 10 * T);

    // 4 moves: name at col 2, PP label at col 11-12, PP values at col 14
    for (let i = 0; i < 4; i++) {
      const nameY = (9 + i * 2) * T;
      const ppY = (10 + i * 2) * T;

      if (i < mon.moves.length) {
        const move = mon.moves[i];
        // Move name at column 2 — assembly: hlcoord 2, 9
        const name = move.id.replace(/_/g, ' ');
        drawText(name, 2 * T, nameY);
        // "PP" at cols 11-12 — assembly: hlcoord 11, 10; StatusScreen_PrintPP
        drawText('PP', 11 * T, ppY);
        // PP values at col 14 — assembly: decoord 14, 10; PrintNumber bc(1,2)
        const ppCur = String(move.pp).padStart(2, ' ');
        const ppMax = String(move.maxPp).padStart(2, ' ');
        drawText(`${ppCur}/${ppMax}`, 14 * T, ppY);
      } else {
        drawText('-', 2 * T, nameY);
        drawText('--', 11 * T, ppY);
      }
    }
  }

  render(): void {
    if (this.statsPage === 1) {
      this.renderStatsPage1();
    } else {
      this.renderStatsPage2();
    }
  }
}
