// StartMenu_Item / ItemMenuLoop (engine/menus/start_sub_menus.asm).
// One frame per update. The message box and the list share one BG transfer tick,
// and at most one of them reads the joypad.

import { isBall, parseMachineId, PARTY_MENU_ITEMS, type Bag } from '../items';
import type { BattlePokemon } from '../battle';
import {
  getBagSavedMenuItem, getListScrollOffset, setBagSavedMenuItem, setCurrentMenuItem, setListScrollOffset,
} from '../list_state';
import type { BgTransfer } from '../text/bg_transfer';
import type { TextBindings } from '../text/text_runner';
import type { TextBox } from '../text/textbox';
import { drawScreenTile } from './menu_render';
import { FieldMedicine } from './field_medicine';
import { FieldMachine } from './field_machine';
import { ListMenu, type ListChoice } from './list_menu';
import { MenuInput } from './menu_input';
import { QuantityMenu } from './quantity_menu';
import { ScreenTiles } from './screen_tiles';
import { YesNoMenu } from './yes_no_menu';
import { cannotToss, tossItemPrompt, finishTossItem } from './toss_item';
import { uiTiles } from '../renderer/ui_tiles';
import { TILE_SIZE } from '../core';
import { holdVBlank, takeHeldFrame } from '../core/vblank_hold';
import { playSFX } from '../audio';
import { setRepelSteps } from '../overworld/repel';
import { canUseEscapeRope, type EscapeRopeLocation } from '../overworld/escape_rope';

export type BagResult = 'open' | 'closed' | 'town_map' | 'escape_rope';
export interface BagFieldContext extends EscapeRopeLocation { onEscapeRopeStart: () => void }

/** How HandleMenuInput left the USE/TOSS menu. B is tested before A. */
export type UseTossChoice = 'b' | 'use' | 'toss';

export class BagSession {
  readonly tiles = new ScreenTiles();
  private list: ListMenu | null = null;
  private menu: MenuInput | null = null;
  private useCursor: { x: number; y: number } | null = null;
  private printing = false;
  private linger = false;
  private after: 'yesno' | 'loop' | 'repel-sound' | 'repel-consume' | null = null;
  private quantity: QuantityMenu | null = null;
  private yesNo: YesNoMenu | null = null;
  private selected: { index: number; name: string; count: number } | null = null;
  private tossQty = 1;
  private party: BattlePokemon[] = [];
  private medicine: FieldMedicine | null = null;
  private machine: FieldMachine | null = null;
  useTossChoice: UseTossChoice | null = null;
  /** GBPalWhiteOut while a field item is opening or returning. */
  get paletteWhite(): boolean { return this.machine?.paletteWhite ?? this.medicine?.paletteWhite ?? false; }
  private bag: Bag | null = null;
  private paletteWait = 0;
  private fieldContext: BagFieldContext | null = null;
  private escapeRopeWait = 0;

  get medicineOpen(): boolean { return this.medicine !== null; }

  constructor(
    private readonly textBox: TextBox,
    private readonly transfer: BgTransfer,
  ) {}

  /** StartMenu_Item. The list is written here and first updated on the next frame. */
  open(bag: Bag, party: BattlePokemon[] = [], fieldContext: BagFieldContext | null = null): void {
    this.paletteWait = 0;
    this.fieldContext = fieldContext;
    this.escapeRopeWait = 0;
    this.bag = bag;
    this.party = party;
    this.medicine = null;
    this.machine = null;
    this.menu = null;
    this.useCursor = null;
    this.useTossChoice = null;
    this.printing = false;
    this.linger = false;
    this.after = null;
    this.quantity = null;
    this.yesNo = null;
    this.selected = null;
    this.openList();
  }

  /**
   * One frame. 'closed' is .exitMenu: the transfer is on and the text box is inactive.
   * The caller is main's item_menu state, which must not also sync the joypad.
   */
  frame(readJoypad: () => void, pressSound: () => void): BagResult {
    if (this.machine) {
      if (this.machine.frame(readJoypad, pressSound)) { this.machine = null; this.itemMenuLoop(); }
      return 'open';
    }
    this.present();
    if (this.escapeRopeWait > 0) {
      if (--this.escapeRopeWait === 0 && this.bag && this.selected) {
        this.bag.removeAt(this.selected.index, 1);
        this.exitMenu();
        return 'escape_rope';
      }
      return 'open';
    }
    if (this.paletteWait > 0) {
      if (--this.paletteWait === 0) this.openList();
      return 'open';
    }
    if (this.printing) {
      if (!this.textBox.isComplete) return 'open';
      this.printing = false;
      this.afterPrint();
      return 'open';
    }
    if (this.medicine) {
      const step = this.medicine.frame(readJoypad);
      if (step === 'start-list') this.itemMenuLoop(false); // StartMenu_Item, not ItemMenuLoop
      const runList = step === 'start-list' || step === 'run-list' || step === 'done';
      if (step === 'done') this.medicine = null;
      if (!runList) return 'open';
    }
    if (this.yesNo) return this.advanceYesNo(readJoypad);
    if (this.quantity) return this.advanceQuantity(readJoypad);
    if (this.menu) return this.advanceUseToss(readJoypad, pressSound);
    if (!this.list) return 'open';
    const choice = this.list.update(readJoypad, pressSound);
    setListScrollOffset(this.list.offset);
    setCurrentMenuItem(this.list.item);
    if (!choice) return 'open';
    setBagSavedMenuItem(this.list.item);
    this.list = null;
    if (choice.type === 'cancelled') return this.exitMenu();
    this.remember(choice);
    this.openUseToss();
    return 'open';
  }

  /** After the text box, so the list's row-12 border can cover the message border. */
  paint(): void {
    const tile = TILE_SIZE;
    for (let y = 0; y < 18; y++) {
      for (let x = 0; x < 20; x++) {
        if (this.tiles.at(x, y)) uiTiles.cover(x * tile, y * tile, tile, tile);
        const shown = this.tiles.visibleAt(x, y);
        if (shown !== null) drawScreenTile(shown, x * tile, y * tile);
      }
    }
    this.yesNo?.render();
    this.machine?.renderChoice();
  }

  renderMedicine(): void { this.medicine?.render(); }
  get medicineShowsParty(): boolean { return this.medicine?.showsParty ?? false; }
  get machineShowsParty(): boolean { return this.machine?.showsParty ?? false; }
  renderMachine(): void { this.machine?.renderParty(); }

  /** ItemUseTownMap returns here. ExitTownMap already cleared the screen. */
  returnFromTownMap(): void { this.itemMenuLoop(); }

  /**
   * One VBlank: exactly one BG transfer tick. A field-medicine PrintText (prompt, result,
   * no effect) runs here too, or its program would never advance (note 46 F-3).
   */
  private present(): void {
    if (takeHeldFrame()) return; // a palette command's held frame: no VBlank (#73)
    const medicineText = this.medicine?.ownsTextBox === true;
    const box = this.textBox.active && (this.printing || this.linger || medicineText);
    const enabled = this.transfer.enabled;
    const third = this.transfer.nextPortion;
    if (box) {
      if (this.printing || medicineText) this.textBox.update();
      else this.textBox.updateDisplay();
      if (enabled) this.tiles.copyShownThird(third);
    } else {
      this.tiles.present(this.transfer);
    }
    if (this.linger && enabled && third === 2) {
      this.linger = false;
      this.textBox.dismiss();
    }
  }

  private openList(): void {
    this.list = new ListMenu(this.tiles, {
      kind: 'items',
      entries: this.bag?.items ?? [],
      offset: getListScrollOffset(),
      item: getBagSavedMenuItem(),
    }, this.transfer);
  }

  /** Restore Buffer2 with transfer off, then ItemMenuLoop's palette command (2 held + Delay3).
   * Medicine has already restored the palettes and jumps directly to StartMenu_Item instead. */
  private itemMenuLoop(paletteCommand = true): void {
    this.list = null;
    this.menu = null;
    this.useCursor = null;
    this.quantity = null;
    this.yesNo = null;
    this.tiles.release(0, 0, 18, 20);
    this.transfer.enabled = false;
    this.linger = this.textBox.active;
    if (paletteCommand) {
      holdVBlank();
      this.paletteWait = 5;
    } else this.openList();
  }

  /** .exitMenu. LoadScreenTilesFromBuffer2 turns the transfer back on. */
  private exitMenu(): 'closed' {
    this.list = null;
    this.menu = null;
    this.useCursor = null;
    this.tiles.reset();
    this.transfer.enabled = true;
    this.linger = false;
    if (this.textBox.active) this.textBox.dismiss();
    return 'closed';
  }

  private openUseToss(): void {
    const row = getBagSavedMenuItem();
    for (const y of [4, 6, 8, 10]) this.tiles.put(5, y, ' ');
    this.tiles.put(5, 4 + row * 2, '▷');
    // (13,10)–(19,14). Text at (15,11); the cursor's top is (14,11).
    this.tiles.textBoxBorder(13, 10, 3, 5);
    this.tiles.placeString(15, 11, 'USE<NEXT>TOSS');
    this.menu = new MenuInput({ watched: ['a', 'b'], maxItem: 1, topX: 14, topY: 11, item: 0 });
    this.useCursor = null;
    this.drawUseCursor('▶');
  }

  private advanceUseToss(readJoypad: () => void, pressSound: () => void): BagResult {
    const hit = this.menu?.update(readJoypad, pressSound) ?? null;
    this.drawUseCursor(hit ? '▷' : '▶');
    if (!hit || !this.menu) return 'open';
    const item = this.menu.item;
    this.menu = null;
    // bit B_PAD_B is tested first: A+B cancels.
    if (hit.includes('b')) {
      this.useTossChoice = 'b';
      this.itemMenuLoop();
      return 'open';
    }
    this.useTossChoice = item === 0 ? 'use' : 'toss';
    if (item === 0) return this.beginUse();
    this.beginToss();
    return 'open';
  }

  /**
   * Out of battle: balls print ItemUseNotTime. OAK'S PARCEL is ItemUseNotYoursToUse.
   * Medicine opens the party menu. Anything else is a recorded gap.
   */
  private beginUse(): BagResult {
    const selected = this.selected;
    const id = selected && this.bag ? this.bag.items[selected.index]?.id : undefined;
    if (!selected || !id || !this.bag) { this.itemMenuLoop(); return 'open'; }
    if (id === 'TOWN_MAP') return 'town_map';
    if (id === 'ESCAPE_ROPE') {
      if (!this.fieldContext || !canUseEscapeRope(this.fieldContext)) {
        this.print('ItemUseNotTimeText', 'loop');
      } else {
        this.fieldContext.onEscapeRopeStart();
        this.escapeRopeWait = 30;
      }
      return 'open';
    }
    const repelSteps: Record<string, number> = { REPEL: 100, SUPER_REPEL: 200, MAX_REPEL: 250 };
    if (repelSteps[id] !== undefined) {
      setRepelSteps(repelSteps[id]);
      this.print('ItemUseText00', 'repel-sound', { stringBuffer: selected.name });
      return 'open';
    }
    if (parseMachineId(id)) {
      this.machine = new FieldMachine(this.textBox, this.transfer, this.tiles, this.bag, this.party, selected.index);
      return 'open';
    }
    if (isBall(id)) {
      this.print('ItemUseNotTimeText', 'loop');
      return 'open';
    }
    if (id === 'OAKS_PARCEL') {
      this.print('ItemUseNotYoursToUseText', 'loop');
      return 'open';
    }
    if (PARTY_MENU_ITEMS.has(id)) {
      this.medicine = new FieldMedicine(this.textBox, this.transfer, this.bag, this.party, selected.index);
      return 'open';
    }
    // Other item routines remain gaps.
    this.itemMenuLoop();
    return 'open';
  }

  private remember(choice: Extract<ListChoice, { type: 'chosen' }>): void {
    this.selected = { index: choice.index, name: choice.name, count: choice.maxQuantity ?? 1 };
  }

  /** TossItem_. A key item or HM skips the quantity box. */
  private beginToss(): void {
    const item = this.selected;
    if (!item || !this.bag) { this.itemMenuLoop(); return; }
    const id = this.bag.items[item.index]?.id;
    if (!id || cannotToss(id)) {
      this.print('TooImportantToTossText', 'loop');
      return;
    }
    this.quantity = new QuantityMenu(this.tiles, { priced: false, max: item.count });
  }

  private advanceQuantity(readJoypad: () => void): BagResult {
    const choice = this.quantity?.update(readJoypad);
    if (!choice || !this.selected) return 'open';
    this.quantity = null;
    if (choice.type === 'cancelled') {
      this.itemMenuLoop();
      return 'open';
    }
    this.tossQty = choice.quantity;
    const prompt = tossItemPrompt(this.bag!.items[this.selected.index].id, this.selected.name);
    this.print(prompt.program, 'yesno', prompt.bindings);
    return 'open';
  }

  private advanceYesNo(readJoypad: () => void): BagResult {
    const answer = this.yesNo?.update(readJoypad);
    if (!answer) return 'open';
    this.yesNo = null;
    if (answer === 'no' || !this.bag || !this.selected) {
      this.itemMenuLoop();
      return 'open';
    }
    const result = finishTossItem(this.bag.items, this.selected.index, this.tossQty, this.selected.name, answer);
    if (result) this.print(result.program, 'loop', result.bindings);
    return 'open';
  }

  private afterPrint(): void {
    const next = this.after;
    this.after = null;
    if (next === 'repel-sound') {
      playSFX('heal_ailment');
      this.textBox.waitScrollButton();
      this.printing = true;
      this.after = 'repel-consume';
      return;
    }
    if (next === 'repel-consume' && this.bag && this.selected) this.bag.removeAt(this.selected.index, 1);
    if (next === 'yesno') {
      this.yesNo = new YesNoMenu();
      this.yesNo.show({ actualRead: true });
      return;
    }
    this.itemMenuLoop();
  }

  private print(program: string, after: 'yesno' | 'loop' | 'repel-sound', bindings?: TextBindings): void {
    this.tiles.release(0, 12, 6, 20);
    this.textBox.printStandalone({ program }, { bindings });
    this.printing = true;
    this.after = after;
  }

  private drawUseCursor(glyph: '▶' | '▷'): void {
    const next = this.menu?.cursor ?? this.useCursor;
    if (!next) return;
    if (this.useCursor && (this.useCursor.x !== next.x || this.useCursor.y !== next.y)) {
      this.tiles.put(this.useCursor.x, this.useCursor.y, ' ');
    }
    this.tiles.put(next.x, next.y, glyph);
    this.useCursor = { x: next.x, y: next.y };
  }
}
