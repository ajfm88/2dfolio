// Start menu (press Start in overworld)
// Appears as a right-aligned box overlaying the overworld scene
// Assembly ref: engine/menus/draw_start_menu.asm, home/start_menu.asm

import { TILE_SIZE } from '../core';
import { isPassPressed } from '../input';
import { drawScreenTile } from './menu_render';
import { playSFX } from '../audio';
import { MenuInput } from './menu_input';
import { ScreenTiles, type ScreenTileSnapshot } from './screen_tiles';
import { BgTransfer, textBgTransfer } from '../text/bg_transfer';
import { setNoTextDelay } from '../text/text_flags';
import { getBattleAndStartSavedMenuItem, setBattleAndStartSavedMenuItem, setCurrentMenuItem } from '../list_state';
import { uiTiles } from '../renderer/ui_tiles';

export type StartMenuAction = 'dex' | 'party' | 'item' | 'trainer' | 'save' | 'option' | 'exit';

interface MenuItem { label: string; action: StartMenuAction }

export type StartReturn = 'dex' | 'party' | 'item' | 'trainer' | 'option';
type StartPhase = 'inactive' | 'opening' | 'input' | 'suspended' | 'returning' | 'closeRead' | 'closeCopy';

/** DisplayTextID(0) and DisplayStartMenu.
 * The session owns its one VBlank tick. The caller paints it under submenus and,
 * after its exit result, runs the existing shared CloseSequence without adding
 * another text-box reload. */
export class StartMenuSession {
  readonly tiles = new ScreenTiles();
  private phase: StartPhase = 'inactive';
  private age = 0;
  private remaining = 0;
  private input: MenuInput | null = null;
  private cursor: { x: number; y: number } | null = null;
  private items: MenuItem[] = [];
  private hasPokedex = false;
  private playerName = '';
  private savedScreen: ScreenTileSnapshot | null = null;
  private transferBeforeCopy = true;
  private returning: StartReturn | null = null;
  get paletteWhite(): boolean { return this.returning === 'party' || this.returning === 'trainer'; }
  /** Legacy full-screen displays stay painted until their START-side tail returns. */
  get returnScreen(): StartReturn | null { return this.returning; }

  constructor(
    private readonly onSprites: () => void,
    private readonly transfer: BgTransfer = textBgTransfer,
  ) {}

  /** CloseStartMenu's private read/copy prefix, before main enters menu_closing. */
  get closing(): boolean { return this.phase === 'closeRead' || this.phase === 'closeCopy'; }

  /** autoBox is the map's DisplayTextIDInit default (text/auto_text_box.ts): false skips the early border. */
  open(hasPokedex: boolean, playerName: string, autoBox = true): void {
    this.hasPokedex = hasPokedex; this.playerName = playerName;
    this.tiles.reset(); this.savedScreen = null; this.cursor = null; this.input = null;
    this.age = 0; this.phase = 'opening';
    this.returning = null;
    this.transfer.enabled = false;
    if (autoBox) this.border();
    this.onSprites(); // DisplayTextIDInit, with the logical START border already up
  }

  /** START-side return tails, CGB explicit waits (start_sub_menus.asm). */
  redisplay(kind?: StartReturn): void {
    if (!kind) { this.drawMenu(); return; } // empty party
    this.returning = kind; this.phase = 'returning'; this.age = 0;
    if (kind === 'dex' || kind === 'item' || kind === 'option') this.restore();
    if (kind !== 'dex' && kind !== 'party') this.transfer.enabled = false;
  }

  /** A dispatch snapshot contains the hollow cursor; B/START do not save Buffer2. */
  buffer2(): ScreenTileSnapshot {
    if (!this.savedScreen) throw new Error('START Buffer2 has not been saved');
    return this.savedScreen.slice();
  }

  restore(saved: ScreenTileSnapshot = this.buffer2()): void {
    this.transfer.enabled = false;
    this.tiles.restoreTiles(saved);
    this.transfer.enabled = true;
  }

  frame(readJoypad: () => void): StartMenuAction | null {
    if (this.phase === 'inactive' || this.phase === 'suspended') return null;
    // VBlank precedes this frame's CPU work; rendering never advances it.
    this.tiles.present(this.transfer);
    if (this.phase === 'opening') {
      this.age++;
      // CopyScreenTileBufferToVRAM is a separate explicit three-third copy,
      // followed by 17 font-copy waits with automatic transfer disabled.
      if (this.age <= 3) this.tiles.copyShownThird(this.age - 1);
      if (this.age === 20) {
        this.transfer.enabled = true;
        playSFX('start_menu');
        this.drawMenu();
      }
      return null;
    }
    if (this.phase === 'returning') {
      this.age++;
      const kind = this.returning!;
      if (kind === 'party' && this.age === 3) this.transfer.enabled = false;
      if ((kind === 'party' && this.age === 24) || (kind === 'trainer' && this.age === 17)) this.restore();
      // Party restores Buffer2 before its five-frame tile copy, then palette/final Delay3.
      if (kind === 'party' && this.age === 24) this.transfer.enabled = false;
      if (kind === 'party' && this.age === 29) this.transfer.enabled = true;
      const waits = { dex: 3, party: 35, item: 5, trainer: 20, option: 5 }[kind];
      if (this.age === waits) {
        this.transfer.enabled = true;
        if (kind === 'dex' || kind === 'item' || kind === 'option') this.onSprites();
        this.returning = null; this.drawMenu();
      }
      return null;
    }
    if (this.phase === 'closeRead') return this.closeRead(readJoypad);
    if (this.phase === 'closeCopy') {
      if (--this.remaining === 0) {
        this.transfer.enabled = this.transferBeforeCopy;
        this.phase = 'suspended';
        return 'exit'; // CloseTextDisplay starts now, after exactly five copy waits
      }
      return null;
    }
    const hit = this.input!.update(readJoypad, () => { playSFX('press_ab'); });
    if (!hit) return null;
    // The caller checks Up/Down before A/B/START, even for simultaneous keys.
    if (hit.includes('up')) {
      if (this.input!.item === 0 && this.input!.lastItem === 0) this.input!.item = this.items.length - 1;
      this.loop(); return null;
    }
    if (hit.includes('down')) {
      if (this.input!.item === this.items.length) this.input!.item = 0;
      this.loop(); return null;
    }
    const item = this.input!.item;
    this.drawCursor('▷');
    setCurrentMenuItem(item); setBattleAndStartSavedMenuItem(item);
    if (hit.includes('b') || hit.includes('start')) return this.beginClose(readJoypad);
    this.savedScreen = this.tiles.saveTiles();
    const action = this.items[item]?.action ?? 'exit';
    if (action === 'exit') return this.beginClose(readJoypad);
    this.phase = 'suspended';
    return action;
  }

  /** Paint the retained display; the caller chooses when it sits under another UI.
   * Opening render T+3 corresponds to the NPC model's first scanout T+4. */
  paint(): void {
    if (this.phase === 'inactive') return;
    for (let y = 0; y < 18; y++) {
      for (let x = 0; x < 20; x++) {
        if (this.tiles.at(x, y) !== null) uiTiles.cover(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        const shown = this.tiles.visibleAt(x, y);
        if (shown !== null && (this.phase !== 'opening' || this.age >= 3))
          drawScreenTile(shown, x * TILE_SIZE, y * TILE_SIZE);
      }
    }
  }

  private border(): void { this.tiles.textBoxBorder(10, 0, this.hasPokedex ? 14 : 12, 8); }

  private drawMenu(): void {
    this.border();
    setNoTextDelay(true);
    this.items = [
      ...(this.hasPokedex ? [{ label: 'POKéDEX', action: 'dex' as const }] : []),
      { label: 'POKéMON', action: 'party' }, { label: 'ITEM', action: 'item' },
      { label: this.playerName, action: 'trainer' }, { label: 'SAVE', action: 'save' },
      { label: 'OPTION', action: 'option' }, { label: 'EXIT', action: 'exit' },
    ];
    for (let i = 0; i < this.items.length; i++) this.tiles.placeString(12, 2 + i * 2, this.items[i].label);
    setNoTextDelay(false);
    const item = getBattleAndStartSavedMenuItem(); setCurrentMenuItem(item);
    this.input = new MenuInput({ watched: ['a', 'b', 'start', 'up', 'down'], maxItem: this.items.length,
      topX: 11, topY: 2, item });
    this.cursor = null; this.phase = 'input';
    this.onSprites(); // RedisplayStartMenu, then HandleMenuInput places its cursor
    this.drawCursor('▶');
  }

  private loop(): void {
    setCurrentMenuItem(this.input!.item);
    this.drawCursor('▶'); this.input!.restart();
  }

  private drawCursor(glyph: string): void {
    if (this.cursor && this.tiles.at(this.cursor.x, this.cursor.y) === '▶') this.tiles.put(this.cursor.x, this.cursor.y, ' ');
    const point = this.input!.cursor;
    this.tiles.put(point.x, point.y, glyph); this.cursor = point;
  }

  private beginClose(readJoypad: () => void): null {
    this.phase = 'closeRead';
    return this.closeRead(readJoypad); // CloseStartMenu's own Joypad call, same CPU frame
  }

  private closeRead(readJoypad: () => void): null {
    readJoypad();
    if (isPassPressed('a')) return null; // newly pressed, not held A
    this.transferBeforeCopy = this.transfer.enabled;
    this.transfer.enabled = false; this.remaining = 5; this.phase = 'closeCopy';
    return null;
  }
}
