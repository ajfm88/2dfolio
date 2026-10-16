// DisplayChooseQuantityMenu (home/list_menu.asm). One read per frame of new presses.
// No Delay3 and no SFX_PRESS_AB. The first read is the frame after the caller builds it.

import { isPassPressed } from '../input';
import { multiplyBcd, type ScreenTiles } from './screen_tiles';

const MONEY: { bytes: 3; suppressZero: true; leftAlign: false; moneySign: true } = {
  bytes: 3, suppressZero: true, leftAlign: false, moneySign: true,
};

export interface QuantityMenuConfig {
  /** PRICEDITEMLISTMENU. Plain is the toss/PC box, built now and used later. */
  priced: boolean;
  /** wMaxItemQuantity. Up past it wraps to 1; Down from 1 wraps to it. */
  max: number;
  /** hItemPrice. Used when priced. */
  unitPrice?: number;
  /** hHalveItemPrices: floor of the total, not the sum of halved prices. */
  halve?: boolean;
}

export type QuantityChoice =
  | { type: 'chosen'; quantity: number; total: number }
  | { type: 'cancelled' };

export class QuantityMenu {
  quantity = 1;
  total = 0;

  constructor(private readonly tiles: ScreenTiles, private readonly config: QuantityMenuConfig) {
    if (config.priced && config.unitPrice === undefined) throw new Error('a priced quantity menu needs a unit price');
    if (config.max < 1) throw new Error('quantity max must be at least 1');
    const origin = config.priced ? 7 : 15;
    const innerW = config.priced ? 11 : 3;
    this.tiles.textBoxBorder(origin, 9, 1, innerW);
    this.tiles.placeString(config.priced ? 8 : 16, 10, '×01');
    this.quantity = 0;
    this.increment();
  }

  /** One frame. A returns the quantity and total; B cancels. Neither plays a sound. */
  update(readJoypad: () => void): QuantityChoice | null {
    readJoypad();
    if (isPassPressed('a')) return { type: 'chosen', quantity: this.quantity, total: this.total };
    if (isPassPressed('b')) return { type: 'cancelled' };
    if (isPassPressed('up')) this.increment();
    else if (isPassPressed('down')) this.decrement();
    return null;
  }

  private increment(): void {
    this.quantity++;
    if (this.quantity > this.config.max) this.quantity = 1;
    this.redraw();
  }

  private decrement(): void {
    this.quantity--;
    if (this.quantity === 0) this.quantity = this.config.max;
    this.redraw();
  }

  private redraw(): void {
    this.total = this.config.priced ? multiplyBcd(this.config.unitPrice ?? 0, this.quantity) : 0;
    if (this.config.halve) this.total = Math.floor(this.total / 2);
    if (this.config.priced) {
      this.tiles.placeString(12, 10, '      ');
      this.tiles.writeBcd(12, 10, this.total, MONEY);
      this.tiles.writeNumber(9, 10, this.quantity, { digits: 2, leadingZeroes: true });
    } else {
      this.tiles.writeNumber(17, 10, this.quantity, { digits: 2, leadingZeroes: true });
    }
  }
}
