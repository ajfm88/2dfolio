// PlayerPC (engine/menus/players_pc.asm), retained inside its DisplayTextID.
import { playSFX } from '../audio';
import { addToInventory, removeFromInventoryAt, isKeyItem, BAG_ITEM_CAPACITY, PC_ITEM_CAPACITY, type Bag, type ItemStack } from '../items';
import { getCurrentMenuItem, getListScrollOffset, setCurrentMenuItem, setListScrollOffset, setBagSavedMenuItem } from '../list_state';
import type { TextBox } from '../text/textbox';
import type { BgTransfer } from '../text/bg_transfer';
import type { MenuSession } from './menu_session';
import { MenuInput } from './menu_input';
import { ListMenu, type ListChoice } from './list_menu';
import { QuantityMenu } from './quantity_menu';
import { ScreenTiles, type ScreenSnapshot } from './screen_tiles';
import { YesNoMenu } from './yes_no_menu';
import { cannotToss, tossItemPrompt, finishTossItem } from './toss_item';
import { getPlayerName } from '../core/player_state';
import type { BattlePokemon } from '../battle';
import { BillsPc } from './bills_pc';
import { PcDisplay } from './pc_display';
import type { BoxedPokemon } from '../pokemon_storage';
import { setNoTextDelay } from '../text/text_flags';

type SelectedItem = Extract<ListChoice, { type: 'chosen' }>;
const SILENT = () => {};

export interface PcStorage {
  party: BattlePokemon[];
  boxes: BoxedPokemon[][];
  getCurrentBox(): number;
  setCurrentBox(index: number): void;
  deserialize(boxed: BoxedPokemon): BattlePokemon | null;
  hasFlag(flag: string): boolean;
  saveGame(): void;
  isPikachuFollowingDisabled(): boolean;
}

export class PcSession extends PcDisplay implements MenuSession {
  private buffer2: ScreenSnapshot | null = null;
  private list: ListMenu | null = null;
  private quantity: QuantityMenu | null = null;
  private yesNo: YesNoMenu | null = null;
  private choice: SelectedItem | null = null;
  private parentItem = 0;
  private branch: 'withdraw' | 'deposit' | 'toss' = 'withdraw';
  private tossQuantity = 1;
  private finished = false;
  private mainMenu = false;
  private nestedPlayer = false;
  private bills: BillsPc | null = null;
  private oakChoice = false;

  constructor(
    tiles: ScreenTiles,
    textBox: TextBox,
    transfer: BgTransfer,
    private readonly bag: Bag,
    private readonly pcItems: ItemStack[],
    onSprites: () => void,
    private readonly mode: 'direct' | 'generic' = 'direct',
    private readonly storage?: PcStorage,
  ) { super(tiles, textBox, transfer, onSprites); }

  override get advanceText(): boolean { return this.bills?.advanceText ?? super.advanceText; }
  copyThird(third: number): void { this.tiles.copyShownThird(third); }
  get fullScreen(): boolean { return this.bills?.fullScreen ?? false; }
  get ownsBgTransfer(): boolean { return this.bills?.ownsBgTransfer ?? false; }
  renderOverlay(): void { if (this.bills) this.bills.renderOverlay(); else this.yesNo?.render(); }

  enter(): void {
    this.buffer2 = this.tiles.save(this.textBox);
    playSFX('turn_on_pc');
    if (this.mode === 'generic') {
      if (!this.storage) throw new Error('Pokécenter PC requires Pokémon storage');
      this.print('TurnedOnPC1Text', () => this.waitCurrentSound(() => {
        this.restoreBuffer2();
        this.delayed = { remaining: 3, then: () => this.displayMainMenu() };
      }));
    } else {
      setBagSavedMenuItem(0); this.parentItem = 0;
      this.print('TurnedOnPC2Text', () => this.playerMenu());
    }
  }

  frame(readJoypad: () => void, _pressSound: () => void): boolean {
    if (this.finished) return true;
    if (this.bills) {
      if (this.bills.frame(readJoypad)) {
        this.bills = null; this.restoreBuffer2(); this.reloadMainMenu();
      }
    } else if (this.advancePending()) {
      return this.finished;
    } else if (this.yesNo) {
      const answer = this.yesNo.update(readJoypad);
      if (answer) {
        this.yesNo = null;
        if (this.oakChoice) {
          this.oakChoice = false;
          // DisplayDexRating is the existing approved gap, shared with Oak in the Lab.
          // Both branches return here until the dex-rating slice implements it.
          this.print('ClosedOaksPCText', () => { this.restoreBuffer2(); this.reloadMainMenu(); });
          return false;
        }
        const item = this.choice!;
        const result = finishTossItem(this.source(), item.index, this.tossQuantity, item.name, answer);
        if (result) this.print(result.program, () => this.branchLoop(), result.bindings);
        else this.branchLoop();
      }
    } else if (this.quantity) {
      const answer = this.quantity.update(readJoypad);
      if (answer) {
        this.quantity = null;
        if (answer.type === 'cancelled') this.branchLoop();
        else this.transferItem(answer.quantity);
      }
    } else if (this.list) {
      const answer = this.list.update(readJoypad, SILENT);
      setListScrollOffset(this.list.offset);
      setCurrentMenuItem(this.list.item);
      if (answer) {
        this.list = null;
        if (answer.type === 'cancelled') this.playerMenu();
        else this.chooseItem(answer);
      }
    } else if (this.menu) {
      const hit = this.menu.update(readJoypad, SILENT);
      // PlaceUnfilledArrowMenuCursor runs only in PlayerPCMenu, after its B test;
      // PCMainMenu never calls it, so the filled arrow stays.
      this.drawCursor(hit && !this.mainMenu && !hit.includes('b') ? '▷' : '▶');
      if (hit) {
        const item = this.menu.item; this.menu = null;
        if (this.mainMenu) { this.mainMenu = false; this.chooseMain(hit.includes('b') ? -1 : item); return false; }
        if (hit.includes('b') || item === 3) this.exitPlayer();
        else {
          this.parentItem = item;
          this.branch = item === 0 ? 'withdraw' : item === 1 ? 'deposit' : 'toss';
          setCurrentMenuItem(0); setListScrollOffset(0);
          if (this.source().length === 0) this.print(this.branch === 'deposit' ? 'NothingToDepositText' : 'NothingStoredText', () => this.playerMenu());
          else this.branchLoop();
        }
      }
    }
    return this.finished;
  }

  private playerMenu(): void {
    setNoTextDelay(true); // PlayerPCMenu sets it again on every pass
    this.restoreBuffer2();
    this.tiles.textBoxBorder(0, 0, 8, 14);
    this.onSprites();
    this.tiles.placeString(2, 2, 'WITHDRAW ITEM<NEXT>DEPOSIT ITEM<NEXT>TOSS ITEM<NEXT>LOG OFF');
    setListScrollOffset(0);
    this.print('WhatDoYouWantText', () => {
      this.menu = new MenuInput({ watched: ['a', 'b'], maxItem: 3, topX: 1, topY: 2, item: this.parentItem });
      this.cursor = null; this.drawCursor('▶');
    });
  }

  private displayMainMenu(): void {
    this.transfer.enabled = false;
    this.buffer2 = this.tiles.save(this.textBox);
    const dex = this.storage!.hasFlag('GOT_POKEDEX');
    this.tiles.textBoxBorder(0, 0, dex ? 8 : 6, 14);
    this.onSprites();
    this.tiles.placeString(2, 2, this.storage!.hasFlag('MET_BILL') ? "BILL's PC" : "SOMEONE's PC");
    this.tiles.placeString(2, 4, `${getPlayerName()}'s PC`);
    if (dex) this.tiles.placeString(2, 6, "PROF.OAK's PC");
    this.tiles.placeString(2, dex ? 8 : 6, 'LOG OFF');
    this.menu = new MenuInput({ watched: ['a', 'b'], maxItem: dex ? 3 : 2, topX: 1, topY: 2 });
    this.mainMenu = true; this.cursor = null; this.drawCursor('▶');
    this.transfer.enabled = true;
  }

  private chooseMain(item: number): void {
    const dex = this.storage!.hasFlag('GOT_POKEDEX');
    if (item < 0 || item === (dex ? 3 : 2)) {
      this.waitSound('turn_off_pc', () => { this.finished = true; });
      return;
    }
    this.waitSound('enter_pc', () => {
      if (item === 0) {
        this.print(this.storage!.hasFlag('MET_BILL') ? 'AccessedBillsPCText' : 'AccessedSomeonesPCText', () => {
          this.bills = new BillsPc(this.tiles, this.textBox, this.transfer, this.onSprites, this.storage!, this.buffer2!);
          this.bills.enter();
        });
      } else if (item === 1) {
        this.print('AccessedMyPCText', () => {
          this.nestedPlayer = true; this.parentItem = 0; setBagSavedMenuItem(0);
          this.playerMenu();
        });
      } else {
        this.buffer2 = this.tiles.save(this.textBox);
        this.print('AccessedOaksPCText', () => {
          this.print('GetDexRatedText', () => {
            this.oakChoice = true; this.yesNo = new YesNoMenu(); this.yesNo.show({ actualRead: true, silent: true });
          });
        });
      }
    });
  }

  private reloadMainMenu(): void {
    this.onSprites();
    this.displayMainMenu();
  }

  private source(): ItemStack[] { return this.branch === 'deposit' ? this.bag.items : this.pcItems; }

  private branchLoop(): void {
    const program = this.branch === 'withdraw' ? 'WhatToWithdrawText' : this.branch === 'deposit' ? 'WhatToDepositText' : 'WhatToTossText';
    this.print(program, () => {
      this.list = new ListMenu(this.tiles, { kind: 'items', entries: this.source(), offset: getListScrollOffset(), item: getCurrentMenuItem() }, this.transfer);
      this.onSprites();
    });
  }

  private chooseItem(item: SelectedItem): void {
    this.choice = item;
    if (this.branch === 'toss' && cannotToss(item.id)) {
      this.print('TooImportantToTossText', () => this.branchLoop());
      return;
    }
    if (isKeyItem(item.id)) { this.transferItem(1); return; }
    const program = this.branch === 'withdraw' ? 'WithdrawHowManyText' : this.branch === 'deposit' ? 'DepositHowManyText' : 'TossHowManyText';
    this.print(program, () => { this.quantity = new QuantityMenu(this.tiles, { priced: false, max: item.maxQuantity ?? 1 }); });
  }

  private transferItem(quantity: number): void {
    const item = this.choice!;
    if (this.branch === 'toss') {
      this.tossQuantity = quantity;
      const prompt = tossItemPrompt(item.id, item.name);
      this.print(prompt.program, () => {
        this.yesNo = new YesNoMenu(); this.yesNo.show({ actualRead: true, silent: true });
      }, prompt.bindings);
      return;
    }
    const destination = this.branch === 'withdraw' ? this.bag.items : this.pcItems;
    const capacity = this.branch === 'withdraw' ? BAG_ITEM_CAPACITY : PC_ITEM_CAPACITY;
    if (!addToInventory(destination, item.id, quantity, capacity)) {
      this.print(this.branch === 'withdraw' ? 'CantCarryMoreText' : 'NoRoomToStoreText', () => this.branchLoop());
      return;
    }
    removeFromInventoryAt(this.source(), item.index, quantity);
    this.waitSound('withdraw_deposit', () => {
      this.print(this.branch === 'withdraw' ? 'WithdrewItemText' : 'ItemWasStoredText', () => this.branchLoop(), { nameBuffer: item.name });
    }, true);
  }

  private exitPlayer(): void {
    const finish = () => {
      this.restoreBuffer2();
      setListScrollOffset(0); setBagSavedMenuItem(0);
      setNoTextDelay(false); // ExitPlayerPC, including the nested return
      if (this.nestedPlayer) { this.nestedPlayer = false; this.reloadMainMenu(); }
      else this.finished = true;
    };
    if (this.nestedPlayer) finish(); else this.waitSound('turn_off_pc', finish);
  }

  private restoreBuffer2(): void {
    if (!this.buffer2) throw new Error('PC buffer missing');
    this.tiles.restore(this.buffer2, this.textBox, this.transfer);
    this.cursor = null;
  }

}
