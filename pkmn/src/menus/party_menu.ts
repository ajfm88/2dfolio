// Party menu — view and manage the player's Pokemon party
// Full-screen display with Pokemon list, stats page, and switch functionality

import { GB_WIDTH, GB_HEIGHT, TILE_SIZE, getPlayerName } from '../core';
import { fillRect, loadTileset, loadFont, drawTile, getCtx, getScale } from '../renderer';
import { isPressed } from '../input';
import { drawText, drawBox } from './menu_render';
import { drawPartyIcon, loadPartyIcons } from './party_icons';
import { loadPokemonSprites, expToNextLevel } from '../battle';
import { playSFX } from '../audio';
import type { BattlePokemon } from '../battle';
import { getText } from '../text';

type PartyState = 'list' | 'submenu' | 'switch_target' | 'stats';

const ENTRY_HEIGHT = 16; // 2 tiles per Pokemon entry (matches assembly: 2 * SCREEN_WIDTH)
// Layout matches assembly: hlcoord 3, 0 for names, OAM X=$10 (screen X=8) for icons
const NAME_X = 3 * TILE_SIZE;   // column 3 = 24px (assembly: hlcoord 3, 0)
const ICON_X = TILE_SIZE;       // column 1 = 8px (assembly: OAM X=$10, screen X=8)
const LEVEL_X = 13 * TILE_SIZE; // column 13 = 104px (assembly: name + 10 columns)
const HP_X = 4 * TILE_SIZE;     // column 4 = 32px (assembly: SCREEN_WIDTH + 1 from col 3)
// Bottom text box occupies rows 12-17 (standard Game Boy text box area)
const TEXTBOX_Y = 12 * TILE_SIZE; // 96px

// Sub-menu items — assembly: SWITCH_STATS_CANCEL_MENU_TEMPLATE box at (11,11)-(19,17)
const SUBMENU_ITEMS = ['SWITCH', 'STATS', 'CANCEL'] as const;
// Box: column 11 to column 19 (9 tiles wide), row 11 to row 17 (7 tiles tall)
const SUBMENU_X = 11 * TILE_SIZE;   // 88px
const SUBMENU_Y = 11 * TILE_SIZE;   // 88px
const SUBMENU_W = 9 * TILE_SIZE;    // 72px (columns 11-19)
const SUBMENU_H = 7 * TILE_SIZE;    // 56px (rows 11-17)

// ──── Tile-based HP bar (same approach as battle_ui.ts) ────
// Tile indices in font_battle_extra.png
const HP_LEFT_BRACKET = 0;  // VRAM $62
const HP_EMPTY = 1;          // VRAM $63
const HP_FULL = 9;           // VRAM $6B (8 pixels filled)
const HP_RIGHT_BRACKET = 10; // VRAM $6C (right bracket for party menu)
const HP_LABEL = 15;         // VRAM $71 ("HP:" label)
const NARROW_TO = 14;        // VRAM $70 — narrow "to" character (single tile)
// Tile indices in battle_hud_1.png
const HUD1_LEVEL = 1;         // VRAM $6E (":L" combined glyph)
// DrawLineBox tiles — loaded from separate 1bpp assets (NOT font_battle_extra)
// Status screen loads: battle_hud_2 tile 0 → $78 (│), battle_hud_3 tiles 0-1 → $76-$77 (─ ┘)
const LINE_V_IDX = 0;         // │ tile 0 in battle_hud_2.png
const LINE_H_IDX = 0;         // ─ tile 0 in battle_hud_3.png
const LINE_BR_IDX = 1;        // ┘ tile 1 in battle_hud_3.png
const LINE_HALFARROW_IDX = 2; // ← tile 2 in battle_hud_1.png

// Loaded tilesets (shared across instances, loaded once)
let hpBarGreen: HTMLCanvasElement | null = null;
let hpBarYellow: HTMLCanvasElement | null = null;
let hpBarRed: HTMLCanvasElement | null = null;
let hudTiles1: HTMLCanvasElement | null = null;
let hudTiles2: HTMLCanvasElement | null = null; // battle_hud_2: │ vertical line
let hudTiles3: HTMLCanvasElement | null = null; // battle_hud_3: ─ horizontal + ┘ corner
let fontBattleExtra: HTMLCanvasElement | null = null; // font_battle_extra as font (for narrow "to" etc.)
let tilesLoading = false;

export async function loadPartyTiles(): Promise<void> {
  if (tilesLoading || hpBarGreen) return;
  tilesLoading = true;
  [hpBarGreen, hpBarYellow, hpBarRed, hudTiles1, hudTiles2, hudTiles3, fontBattleExtra] = await Promise.all([
    loadTileset('/gfx/font/font_battle_extra.png', 'GREENBAR'),
    loadTileset('/gfx/font/font_battle_extra.png', 'YELLOWBAR'),
    loadTileset('/gfx/font/font_battle_extra.png', 'REDBAR'),
    loadFont('/gfx/battle/battle_hud_1.png'),
    loadFont('/gfx/battle/battle_hud_2.png'), // 1bpp: │
    loadFont('/gfx/battle/battle_hud_3.png'), // 1bpp: ─ ┘
    loadFont('/gfx/font/font_battle_extra.png'), // for text tiles: narrow "to", etc.
  ]);
}

function getHpBarTileset(ratio: number): HTMLCanvasElement | null {
  if (ratio > 0.5) return hpBarGreen;
  if (ratio > 0.25) return hpBarYellow;
  return hpBarRed;
}

/** Draw tile-based HP bar: [HP: label] [bracket] [6 fills] [bracket] */
export function drawTileHpBar(x: number, y: number, currentHp: number, maxHp: number): void {
  const ratio = maxHp > 0 ? currentHp / maxHp : 0;
  const barTiles = 6;
  const pixels = maxHp > 0 ? Math.ceil(currentHp * (barTiles * 8) / maxHp) : 0;
  const tileset = getHpBarTileset(ratio);
  if (!tileset) return;

  // HP: label tile
  drawTile(tileset, HP_LABEL, x, y);
  // Left bracket
  drawTile(tileset, HP_LEFT_BRACKET, x + TILE_SIZE, y);
  // Fill segments
  let remaining = pixels;
  for (let i = 0; i < barTiles; i++) {
    let tileIdx: number;
    if (remaining >= 8) {
      tileIdx = HP_FULL;
      remaining -= 8;
    } else if (remaining > 0) {
      tileIdx = HP_EMPTY + remaining; // partial fill tiles 2-8
      remaining = 0;
    } else {
      tileIdx = HP_EMPTY;
    }
    drawTile(tileset, tileIdx, x + (2 + i) * TILE_SIZE, y);
  }
  // Right bracket (font_battle_extra tile 10 = VRAM $6C, party menu variant)
  drawTile(tileset, HP_RIGHT_BRACKET, x + (2 + barTiles) * TILE_SIZE, y);
}

/** Assembly DrawLineBox: vertical │ down from (col, row) for height tiles,
 *  then ┘ corner, then horizontal ─ going left for width tiles, then ← halfarrow. */
function drawLineBox(col: number, row: number, height: number, width: number): void {
  if (!hudTiles2 || !hudTiles3) return;
  const T = TILE_SIZE;
  // Vertical line going down (│ from battle_hud_2)
  for (let r = 0; r < height; r++) {
    drawTile(hudTiles2, LINE_V_IDX, col * T, (row + r) * T);
  }
  // Bottom-right corner (┘ from battle_hud_3)
  drawTile(hudTiles3, LINE_BR_IDX, col * T, (row + height) * T);
  // Horizontal line going left (─ from battle_hud_3)
  for (let c = 1; c <= width; c++) {
    drawTile(hudTiles3, LINE_H_IDX, (col - c) * T, (row + height) * T);
  }
  // Halfarrow ending (← from battle_hud_1)
  if (hudTiles1) {
    drawTile(hudTiles1, LINE_HALFARROW_IDX, (col - width - 1) * T, (row + height) * T);
  }
}

/** Draw the :L level indicator using the special combined tile + digits. */
export function drawLevel(level: number, x: number, y: number): void {
  if (hudTiles1) {
    drawTile(hudTiles1, HUD1_LEVEL, x, y);
  }
  drawText(String(level), x + TILE_SIZE, y);
}

export class PartyMenu {
  private party: BattlePokemon[] = [];
  private cursor = 0;
  private state: PartyState = 'list';
  private subCursor = 0;
  private switchFrom = -1; // index of Pokemon being switched
  private frameCounter = 0;
  private statsPage = 1; // 1 or 2
  private frontSprite: HTMLCanvasElement | null = null;
  private spriteLoadingFor = ''; // species name currently loading

  // Battle mode support
  private mode: 'overworld' | 'battle' | 'battle_forced' = 'overworld';
  private battleActiveIndex = 0; // index of Pokemon currently in battle
  /** After close, >= 0 means a Pokemon was selected for battle switch, -1 means cancelled. */
  selectedSwitchIndex = -1;

  show(party: BattlePokemon[]): void {
    this.party = party;
    this.cursor = 0;
    this.state = 'list';
    this.subCursor = 0;
    this.switchFrom = -1;
    this.frameCounter = 0;
    this.statsPage = 1;
    this.frontSprite = null;
    this.mode = 'overworld';
    this.selectedSwitchIndex = -1;
    loadPartyIcons();
    loadPartyTiles();
  }

  /** Show party menu in battle context. */
  showForBattle(party: BattlePokemon[], activeIndex: number, forced: boolean): void {
    this.show(party);
    this.mode = forced ? 'battle_forced' : 'battle';
    this.battleActiveIndex = activeIndex;
  }

  /** Returns 'close' when the menu should be dismissed. */
  update(): 'close' | null {
    switch (this.state) {
      case 'list': return this.updateList();
      case 'submenu': return this.updateSubmenu();
      case 'switch_target': return this.updateSwitchTarget();
      case 'stats': return this.updateStats();
    }
  }

  private updateList(): 'close' | null {
    if (isPressed('up')) {
      this.cursor = (this.cursor - 1 + this.party.length) % this.party.length;
    } else if (isPressed('down')) {
      this.cursor = (this.cursor + 1) % this.party.length;
    } else if (isPressed('a')) {
      playSFX('press_ab');
      // Open sub-menu for selected Pokemon
      this.subCursor = 0;
      this.state = 'submenu';
    } else if (isPressed('b')) {
      playSFX('press_ab');
      if (this.mode === 'battle_forced') return null; // can't cancel forced switch
      this.selectedSwitchIndex = -1;
      return 'close';
    }
    return null;
  }

  private getSubmenuItems(): readonly string[] {
    if (this.mode === 'battle_forced') return ['SWITCH', 'STATS'] as const;
    return SUBMENU_ITEMS;
  }

  private updateSubmenu(): 'close' | null {
    const items = this.getSubmenuItems();
    if (isPressed('up')) {
      this.subCursor = (this.subCursor - 1 + items.length) % items.length;
    } else if (isPressed('down')) {
      this.subCursor = (this.subCursor + 1) % items.length;
    } else if (isPressed('a')) {
      playSFX('press_ab');
      const action = items[this.subCursor];
      if (action === 'STATS') {
        this.statsPage = 1;
        this.loadFrontSprite();
        this.state = 'stats';
      } else if (action === 'SWITCH') {
        if (this.mode === 'battle' || this.mode === 'battle_forced') {
          // Battle switch: validate and select for battle
          const mon = this.party[this.cursor];
          if (mon.currentHp <= 0 || this.cursor === this.battleActiveIndex) {
            // Can't switch to fainted or already-active Pokemon
            this.state = 'list';
          } else {
            this.selectedSwitchIndex = this.cursor;
            return 'close';
          }
        } else {
          // Overworld: swap party positions
          if (this.party.length > 1) {
            this.switchFrom = this.cursor;
            this.state = 'switch_target';
          } else {
            this.state = 'list';
          }
        }
      } else {
        // CANCEL
        if (this.mode === 'battle' || this.mode === 'battle_forced') {
          this.selectedSwitchIndex = -1;
          return 'close';
        }
        this.state = 'list';
      }
    } else if (isPressed('b')) {
      playSFX('press_ab');
      this.state = 'list';
    }
    return null;
  }

  private updateSwitchTarget(): 'close' | null {
    if (isPressed('up')) {
      this.cursor = (this.cursor - 1 + this.party.length) % this.party.length;
    } else if (isPressed('down')) {
      this.cursor = (this.cursor + 1) % this.party.length;
    } else if (isPressed('a')) {
      playSFX('press_ab');
      if (this.cursor !== this.switchFrom) {
        // Swap the two Pokemon
        const temp = this.party[this.switchFrom];
        this.party[this.switchFrom] = this.party[this.cursor];
        this.party[this.cursor] = temp;
        this.switchFrom = -1;
        this.state = 'list';
      }
      // If same Pokemon selected, do nothing
    } else if (isPressed('b')) {
      playSFX('press_ab');
      this.cursor = this.switchFrom;
      this.switchFrom = -1;
      this.state = 'list';
    }
    return null;
  }

  private updateStats(): 'close' | null {
    if (isPressed('a')) {
      playSFX('press_ab');
      if (this.statsPage === 1) {
        this.statsPage = 2;
      } else {
        this.state = 'list';
      }
    } else if (isPressed('b')) {
      playSFX('press_ab');
      this.state = 'list';
    }
    return null;
  }

  private loadFrontSprite(): void {
    const mon = this.party[this.cursor];
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

  render(): void {
    this.frameCounter++;
    if (this.state === 'stats') {
      this.renderStats();
      return;
    }
    this.renderList();
    if (this.state === 'submenu') {
      this.renderSubmenu();
    }
  }

  private renderList(): void {
    // White background (no border on the list area, matching original)
    fillRect(0, 0, GB_WIDTH, GB_HEIGHT, 0);

    for (let i = 0; i < this.party.length; i++) {
      const mon = this.party[i];
      const y = i * ENTRY_HEIGHT;
      const hpRatio = mon.maxHp > 0 ? mon.currentHp / mon.maxHp : 0;

      // Party icon — only the cursor-selected Pokemon animates
      const frame = i === this.cursor ? this.frameCounter : 0;
      drawPartyIcon(mon.species.id, ICON_X, y, frame, hpRatio);

      // Cursor (or switch marker)
      if (this.state === 'switch_target' && i === this.switchFrom) {
        drawText('\u25B7', 0, y); // unfilled arrow for switch source
      }
      if (i === this.cursor) {
        drawText('\u25B6', 0, y);
      }

      // Name at column 3
      drawText(mon.nickname.toUpperCase(), NAME_X, y);

      // Level at column 13 using special :L tile
      drawLevel(mon.level, LEVEL_X, y);

      // Status condition at column 17 (assembly: name start + 14)
      if (mon.status) {
        drawText(mon.status, 17 * TILE_SIZE, y);
      }

      // Tile-based HP bar on second line (row N+1, column 4)
      const hpY = y + TILE_SIZE;
      drawTileHpBar(HP_X, hpY, mon.currentHp, mon.maxHp);

      // HP numbers right-aligned, padded to 3 digits each (e.g. " 20/ 20")
      const hpCurrent = String(mon.currentHp).padStart(3, ' ');
      const hpMax = String(mon.maxHp).padStart(3, ' ');
      const hpText = `${hpCurrent}/${hpMax}`;
      drawText(hpText, GB_WIDTH - (hpText.length + 1) * TILE_SIZE, hpY);
    }

    // Bottom text box (rows 12-17, standard Game Boy text box)
    drawBox(0, TEXTBOX_Y, GB_WIDTH, GB_HEIGHT - TEXTBOX_Y);
    // Text inside box at row 14, column 1 (matching PrintText placement)
    const titleX = TILE_SIZE;
    const titleY = 14 * TILE_SIZE;
    if (this.state === 'switch_target') {
      drawText('Move to where?', titleX, titleY);
    } else {
      drawText(getText('PARTY_CHOOSE'), titleX, titleY);
    }
  }

  private renderSubmenu(): void {
    const items = this.getSubmenuItems();
    // Fixed position: box at (11,11)-(19,17), text at (13,12)
    drawBox(SUBMENU_X, SUBMENU_Y, SUBMENU_W, SUBMENU_H);

    // Text starts at column 13, row 12 (assembly: text_box_text coords 13,12)
    const textX = 13 * TILE_SIZE;
    const textStartY = 12 * TILE_SIZE;
    for (let i = 0; i < items.length; i++) {
      const y = textStartY + i * ENTRY_HEIGHT;
      drawText(items[i], textX, y);
      if (i === this.subCursor) {
        drawText('\u25B6', 12 * TILE_SIZE, y);
      }
    }
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
    const mon = this.party[this.cursor];
    if (!mon) return;
    const T = TILE_SIZE;

    fillRect(0, 0, GB_WIDTH, GB_HEIGHT, 0);

    // Front sprite (top-left area, 7×7 tiles)
    this.drawFrontSprite();

    // "No.XXX" below sprite — assembly: number at hlcoord 3, 7, label before it
    const dexNum = String(mon.species.id).padStart(3, '0');
    drawText('No.' + dexNum, 1 * T, 7 * T);

    // Name — assembly: hlcoord 9, 1
    drawText(mon.nickname.toUpperCase(), 9 * T, 1 * T);

    // Level — assembly: hlcoord 14, 2
    drawLevel(mon.level, 14 * T, 2 * T);

    // HP bar — assembly: hlcoord 11, 3
    drawTileHpBar(11 * T, 3 * T, mon.currentHp, mon.maxHp);

    // HP numbers — assembly: below HP bar, right-aligned
    const hpCurrent = String(mon.currentHp).padStart(3, ' ');
    const hpMax = String(mon.maxHp).padStart(3, ' ');
    drawText(`${hpCurrent}/${hpMax}`, 12 * T, 4 * T);

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
    const mon = this.party[this.cursor];
    if (!mon) return;
    const T = TILE_SIZE;

    fillRect(0, 0, GB_WIDTH, GB_HEIGHT, 0);

    // Front sprite (same position as page 1)
    this.drawFrontSprite();

    // "No.XXX" below sprite — assembly: hlcoord 3, 7
    const dexNum = String(mon.species.id).padStart(3, '0');
    drawText('No.' + dexNum, 1 * T, 7 * T);

    // Name — assembly: hlcoord 9, 1
    drawText(mon.nickname.toUpperCase(), 9 * T, 1 * T);

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
    if (fontBattleExtra) {
      drawTile(fontBattleExtra, NARROW_TO, 14 * T, 6 * T);
    }

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

  private renderStats(): void {
    if (this.statsPage === 1) {
      this.renderStatsPage1();
    } else {
      this.renderStatsPage2();
    }
  }
}
