// Party menu — view and manage the player's Pokemon party
// Full-screen display with Pokemon list, stats page, and switch functionality

import { GB_WIDTH, GB_HEIGHT, TILE_SIZE } from '../core';
import { fillRect, drawFadeOverlay } from '../renderer';
import { isPressed, isPassPressed, readJoypad } from '../input';
import { TextBox } from '../text/textbox';
import { textBgTransfer } from '../text/bg_transfer';
import { PartyMenuOpening } from './party_menu_opening';
import { drawText, drawBox } from './menu_render';
import { drawPartyIcon, loadPartyIcons } from './party_icons';
import { playSFX } from '../audio';
import type { BattlePokemon } from '../battle';
import type { StatusCondition } from '../battle/types';
import type { GameButton } from '../core';
import { getText } from '../text';
import { getTextPrograms } from '../text/program_data';
import { formatHpFraction, PARTY_HP_FRACTION_COL } from './hp_bar';
import { getPartyAndBillsSavedMenuItem, setPartyAndBillsSavedMenuItem } from '../list_state';
import { monDisplayName } from '../pokemon_names';
import { StatusScreenSession } from './status_screen';
import { loadPartyTiles, drawTileHpBar, drawLevel } from './party_tiles';
export { loadPartyTiles, drawTileHpBar, drawLevel } from './party_tiles';

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
/** A no-delay party prompt: the root far-calls its text, and `<DONE>` is not drawn. */
function linesOfProgram(program: string): string[] {
  const programs = getTextPrograms();
  let ops = programs[program] ?? [];
  const first = ops[0];
  if (ops.length === 1 && first?.op === 'far') ops = programs[first.program] ?? [];
  const text = ops.find(op => op.op === 'text');
  const raw = text?.op === 'text' ? text.text : '';
  return raw.replace(/<(?:DONE|PROMPT)>$/, '').split('\n');
}

/** A party row drawn from an earlier picture than the party data (see PartyMenu.hpOverride). */
export interface PartyRowOverride {
  pixels: number;
  shownHp: number;
  /** The bar's color comes from this length (the last static draw). Defaults to `pixels`. */
  colorPixels?: number;
  /** The status text of the last static draw. Undefined keeps the party data's. */
  status?: StatusCondition;
}

export class PartyMenu {
  private party: BattlePokemon[] = [];
  private cursor = 0;
  private state: PartyState = 'list';
  private subCursor = 0;
  private switchFrom = -1; // index of Pokemon being switched
  private frameCounter = 0;
  private stats: StatusScreenSession | null = null;
  private opening: PartyMenuOpening | null = null;
  private readonly openingTextBox = new TextBox();
  /** The stats session owns actual reads and its one BG-transfer tick. */
  get statusScreenActive(): boolean { return this.stats !== null; }
  get ownsInput(): boolean { return this.statusScreenActive || this.opening !== null; }
  get paletteWhite(): boolean { return this.opening?.paletteWhite ?? this.stats?.paletteWhite ?? false; }

  // Battle mode support. useItem is the bag's medicine menu: A picks, B cancels, no submenu.
  private mode: 'overworld' | 'battle' | 'battle_forced' | 'useItem' = 'overworld';
  private battleActiveIndex = 0; // index of Pokemon currently in battle
  /** After close, >= 0 means a Pokemon was selected for battle switch, -1 means cancelled. */
  selectedSwitchIndex = -1;
  /** useItem: the chosen slot, or -1 when B cancelled. */
  chosenIndex = -1;
  /** False while a result or no-effect PrintText owns the bottom box. */
  promptVisible = true;
  /**
   * One row's picture while the screen still shows the pre-use draw: UpdateHPBar2 writes
   * only the bar tiles and the HP number, and the palette (bar color) and the status text
   * change only at the next RedrawPartyMenu_. The party data already holds the new values.
   */
  private hpOverride: (PartyRowOverride | null)[] = [];
  /** PlaceUnfilledArrowMenuCursor after a choice; ErasePartyMenuCursors on the result redraw. */
  cursorGlyph: '▶' | '▷' = '▶';
  cursorVisible = true;

  show(party: BattlePokemon[]): void {
    this.party = party;
    this.state = 'list';
    this.stats = null;
    this.opening = null;
    this.promptVisible = true;
    this.subCursor = 0;
    this.switchFrom = -1;
    this.frameCounter = 0;
    this.mode = 'overworld';
    this.selectedSwitchIndex = -1;
    this.chosenIndex = -1;
    this.hpOverride = [];
    this.cursorGlyph = '▶';
    this.cursorVisible = true;
    this.cursor = party.length === 0 ? 0 : Math.min(getPartyAndBillsSavedMenuItem(), party.length - 1);
    loadPartyIcons();
    loadPartyTiles();
  }

  /** START → POKéMON uses DisplayPartyMenu; battle and item-use keep their own hosts. */
  open(party: BattlePokemon[]): void {
    this.show(party);
    this.beginOpening();
  }

  private beginOpening(): void {
    this.promptVisible = false;
    this.opening = new PartyMenuOpening(this.openingTextBox, textBgTransfer, 'PartyMenuNormalText');
  }

  /** Show party menu in battle context. Battle still starts on the first row (A5c). */
  showForBattle(party: BattlePokemon[], activeIndex: number, forced: boolean): void {
    this.show(party);
    this.mode = forced ? 'battle_forced' : 'battle';
    this.battleActiveIndex = activeIndex;
    this.cursor = 0;
  }

  /** DisplayPartyMenu for USE_ITEM. A returns the slot; B cancels. */
  showForItem(party: BattlePokemon[]): void {
    this.show(party);
    this.mode = 'useItem';
  }

  /** One row's frozen picture (see hpOverride); null returns it to the party data. */
  setHpOverride(slot: number, override: PartyRowOverride | null): void {
    this.hpOverride[slot] = override;
  }

  /**
   * Returns 'close' when the menu should be dismissed. `pressed` is the read the caller made:
   * the item-use menu passes its own Joypad read (isPassPressed); the others keep isPressed.
   */
  update(pressed: (button: GameButton) => boolean = isPressed): 'close' | null {
    if (this.opening) {
      this.opening.present();
      const ready = this.opening.frame();
      this.promptVisible = !this.opening.paletteWhite;
      if (!ready) return null;
      this.opening = null;
      readJoypad();
      return this.updateList(isPassPressed);
    }
    switch (this.state) {
      case 'list': return this.mode === 'useItem' ? this.updateItemUse(pressed) : this.updateList();
      case 'submenu': return this.updateSubmenu();
      case 'switch_target': return this.updateSwitchTarget();
      case 'stats': return this.updateStats();
    }
  }

  /**
   * HandleMenuInput_ then HandlePartyMenuInput, for USE_ITEM: A suppresses Up/Down, which
   * wrap (wMenuWrappingEnabled); A or B plays press_ab; B is tested first, so A+B cancels.
   * The cursor is saved on either key. The chosen row gets ▷.
   */
  private updateItemUse(pressed: (button: GameButton) => boolean): 'close' | null {
    const a = pressed('a');
    const b = pressed('b');
    const count = this.party.length;
    if (!a && count > 0) {
      if (pressed('up')) this.cursor = (this.cursor - 1 + count) % count;
      else if (pressed('down')) this.cursor = (this.cursor + 1) % count;
    }
    if (!a && !b) return null;
    playSFX('press_ab');
    this.rememberCursor();
    this.cursorGlyph = '▷';
    this.chosenIndex = b ? -1 : this.cursor;
    return 'close';
  }

  private updateList(pressed: (button: GameButton) => boolean = isPressed): 'close' | null {
    if (pressed('up')) {
      this.cursor = (this.cursor - 1 + this.party.length) % this.party.length;
    } else if (pressed('down')) {
      this.cursor = (this.cursor + 1) % this.party.length;
    } else if (pressed('a')) {
      playSFX('press_ab');
      if (this.mode === 'useItem') {
        this.rememberCursor();
        this.chosenIndex = this.cursor;
        return 'close';
      }
      this.rememberCursor();
      this.subCursor = 0;
      this.state = 'submenu';
    } else if (pressed('b')) {
      playSFX('press_ab');
      if (this.mode === 'battle_forced') return null; // can't cancel forced switch
      this.rememberCursor();
      this.selectedSwitchIndex = -1;
      if (this.mode === 'useItem') this.chosenIndex = -1;
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
        this.stats = new StatusScreenSession(this.party[this.cursor], { syncRead: true });
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
    if (this.stats!.frame(readJoypad) === 'done') {
      this.stats = null; this.state = 'list';
      if (this.mode === 'overworld') this.beginOpening();
    }
    return null;
  }

  render(): void {
    if (this.opening?.paletteWhite) { drawFadeOverlay(1); return; }
    if (this.state === 'stats') {
      this.stats!.render();
      return;
    }
    this.frameCounter++;
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
      if (i === this.cursor && this.cursorVisible) {
        drawText(this.mode === 'useItem' ? this.cursorGlyph : '\u25B6', 0, y);
      }

      // Name at column 3
      drawText(monDisplayName(mon), NAME_X, y);

      // Level at column 13 using special :L tile
      drawLevel(mon.level, LEVEL_X, y);

      // Status condition at column 17 (assembly: name start + 14)
      const override = this.hpOverride[i] ?? null;
      const status = override && override.status !== undefined ? override.status : mon.status;
      if (status) {
        drawText(status, 17 * TILE_SIZE, y);
      }

      // Tile-based HP bar on second line (row N+1, column 4)
      const hpY = y + TILE_SIZE;
      const shownHp = override?.shownHp ?? mon.currentHp;
      drawTileHpBar(HP_X, hpY, shownHp, mon.maxHp, override?.pixels, override?.colorPixels ?? override?.pixels);
      // Fraction at column 13: 3-digit current, '/', 3-digit max (DrawHP2).
      drawText(formatHpFraction(shownHp, mon.maxHp), PARTY_HP_FRACTION_COL * TILE_SIZE, hpY);
    }

    // Bottom text box (rows 12-17, standard Game Boy text box)
    drawBox(0, TEXTBOX_Y, GB_WIDTH, GB_HEIGHT - TEXTBOX_Y);
    // Text inside box at row 14, column 1 (matching PrintText placement)
    if (!this.promptVisible) return;
    const lines = this.promptLines();
    for (let i = 0; i < lines.length; i++) {
      drawText(lines[i], TILE_SIZE, (14 + i * 2) * TILE_SIZE);
    }
  }

  /** Battle keeps its current line. Overworld and item use read the programs. */
  private promptLines(): string[] {
    if (this.mode === 'battle' || this.mode === 'battle_forced') return [getText('PARTY_CHOOSE')];
    const program = this.state === 'switch_target' ? 'PartyMenuSwapMonText'
      : this.mode === 'useItem' ? 'PartyMenuItemUseText'
      : 'PartyMenuNormalText';
    return linesOfProgram(program);
  }

  /** Overworld and item use share the cursor. Battle does not write it (A5c). */
  private rememberCursor(): void {
    if (this.mode === 'battle' || this.mode === 'battle_forced') return;
    setPartyAndBillsSavedMenuItem(this.cursor);
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

}
