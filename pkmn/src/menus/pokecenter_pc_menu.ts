// Pokecenter PC top-level menu — SOMEONE's PC / <PLAYER>'s PC / LOG OFF
// Assembly ref: engine/menus/pokecenters/pokecenter_pc.asm
//
// SOMEONE's PC = Bill's PC (Pokemon storage)
// <PLAYER>'s PC = Item storage (delegates to PcMenu)

import { GB_WIDTH, GB_HEIGHT, TILE_SIZE, getPlayerName } from '../core';
import { isPressed } from '../input';
import { drawText, drawBox } from './menu_render';
import { PcMenu } from './pc_menu';
import { BillsPcMenu } from './bills_pc_menu';
import { getText } from '../text';
import type { BoxedPokemon } from './bills_pc_menu';
import type { Bag } from '../items';
import type { ItemStack } from '../items';
import type { BattlePokemon } from '../battle';

type PcTopState =
  | 'main_menu'
  | 'someone_text'
  | 'someone_text2'
  | 'someone_pc'
  | 'player_text'
  | 'player_text2'
  | 'player_pc';

type PcTopResult = 'open' | 'closed';

export class PokecenterPcMenu {
  private state: PcTopState = 'main_menu';
  private cursor = 0;
  private pcMenu: PcMenu;
  private billsPcMenu: BillsPcMenu;
  private bag!: Bag;
  private pcItems!: ItemStack[];
  private party!: BattlePokemon[];
  private boxes!: BoxedPokemon[][];
  private currentBox = 0;
  private playerName = '';
  private bottomText: string[] = [];
  private deserializeFn!: (boxed: BoxedPokemon) => BattlePokemon | null;

  constructor() {
    this.pcMenu = new PcMenu();
    this.billsPcMenu = new BillsPcMenu();
  }

  show(
    bag: Bag,
    pcItems: ItemStack[],
    party: BattlePokemon[],
    boxes: BoxedPokemon[][],
    currentBox: number,
    deserializeFn: (boxed: BoxedPokemon) => BattlePokemon | null,
  ): void {
    this.bag = bag;
    this.pcItems = pcItems;
    this.party = party;
    this.boxes = boxes;
    this.currentBox = currentBox;
    this.deserializeFn = deserializeFn;
    this.playerName = getPlayerName();
    this.state = 'main_menu';
    this.cursor = 0;
    this.bottomText = [];
  }

  /** Returns the current box index (caller should persist this). */
  getCurrentBox(): number {
    return this.currentBox;
  }

  update(): PcTopResult {
    switch (this.state) {
      case 'main_menu':
        return this.updateMainMenu();
      case 'someone_text':
        return this.updateTextDismiss('someone_text2');
      case 'someone_text2':
        return this.updateTextDismissToBillsPc();
      case 'someone_pc':
        return this.updateBillsPc();
      case 'player_text':
        return this.updateTextDismiss('player_text2');
      case 'player_text2':
        return this.updateTextDismissToPlayerPc();
      case 'player_pc':
        return this.updatePlayerPc();
      default:
        return 'open';
    }
  }

  private updateMainMenu(): PcTopResult {
    const itemCount = 3; // SOMEONE's PC, YELLOW's PC, LOG OFF
    if (isPressed('up')) {
      this.cursor = (this.cursor - 1 + itemCount) % itemCount;
    } else if (isPressed('down')) {
      this.cursor = (this.cursor + 1) % itemCount;
    } else if (isPressed('a')) {
      if (this.cursor === 0) {
        // SOMEONE's PC
        this.bottomText = ["Accessed someone's", 'PC.'];
        this.state = 'someone_text';
      } else if (this.cursor === 1) {
        // YELLOW's PC
        this.bottomText = ['Accessed my PC.'];
        this.state = 'player_text';
      } else {
        // LOG OFF
        return 'closed';
      }
    } else if (isPressed('b')) {
      return 'closed';
    }
    return 'open';
  }

  private updateTextDismiss(nextState: PcTopState): PcTopResult {
    if (isPressed('a') || isPressed('b')) {
      if (nextState === 'someone_text2') {
        this.bottomText = getText('PC_ACCESSED_STORAGE').split('\n');
      } else if (nextState === 'player_text2') {
        this.bottomText = ['Accessed Item', 'Storage System.'];
      }
      this.state = nextState;
    }
    return 'open';
  }

  private updateTextDismissToBillsPc(): PcTopResult {
    if (isPressed('a') || isPressed('b')) {
      this.billsPcMenu.show(this.party, this.boxes, this.currentBox, this.deserializeFn);
      this.state = 'someone_pc';
    }
    return 'open';
  }

  private updateTextDismissToPlayerPc(): PcTopResult {
    if (isPressed('a') || isPressed('b')) {
      this.pcMenu.show(this.bag, this.pcItems);
      this.state = 'player_pc';
    }
    return 'open';
  }

  private updateBillsPc(): PcTopResult {
    if (this.billsPcMenu.update() === 'closed') {
      this.currentBox = this.billsPcMenu.getCurrentBox();
      this.bottomText = [];
      this.state = 'main_menu';
    }
    return 'open';
  }

  private updatePlayerPc(): PcTopResult {
    if (this.pcMenu.update() === 'closed') {
      this.bottomText = [];
      this.state = 'main_menu';
    }
    return 'open';
  }

  render(): void {
    if (this.state === 'someone_pc') {
      this.billsPcMenu.render();
      return;
    }
    if (this.state === 'player_pc') {
      this.pcMenu.render();
      return;
    }

    // Top-level menu box
    this.renderMenuBox();

    // Bottom text box (when there's text to show)
    if (this.bottomText.length > 0) {
      this.renderBottomTextBox(this.bottomText);
    }
  }

  private renderMenuBox(): void {
    const items = this.getMenuItems();
    const boxW = (items.reduce((max, s) => Math.max(max, s.length), 0) + 3) * TILE_SIZE;
    const boxH = (items.length * 2 + 2) * TILE_SIZE;
    const boxX = 0;
    const boxY = 0;

    drawBox(boxX, boxY, boxW, boxH);

    for (let i = 0; i < items.length; i++) {
      const y = boxY + (2 + i * 2) * TILE_SIZE;
      const textX = boxX + 2 * TILE_SIZE;
      drawText(items[i], textX, y);
      if (i === this.cursor && this.state === 'main_menu') {
        drawText('\u25B6', boxX + TILE_SIZE, y);
      }
    }
  }

  private getMenuItems(): string[] {
    return [
      "SOMEONE's PC",
      `${this.playerName}'s PC`,
      'LOG OFF',
    ];
  }

  private renderBottomTextBox(lines: string[]): void {
    const boxH = 6 * TILE_SIZE;
    const boxY = GB_HEIGHT - boxH;
    drawBox(0, boxY, GB_WIDTH, boxH);
    for (let i = 0; i < lines.length; i++) {
      drawText(lines[i], TILE_SIZE, boxY + 2 * TILE_SIZE + i * 16);
    }
  }
}
