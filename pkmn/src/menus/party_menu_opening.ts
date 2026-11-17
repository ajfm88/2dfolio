// DisplayPartyMenu (home/pokemon.asm), DrawPartyMenu_ (engine/menus/party_menu.asm).
import type { BgTransfer } from '../text/bg_transfer';
import type { TextBox } from '../text/textbox';
import { holdVBlank, takeHeldFrame } from '../core/vblank_hold';

/** The host owns VBlank. frame() performs only the CPU work after that VBlank.
 * The bag advances its shared TextBox; standalone party callers use present(). */
export class PartyMenuOpening {
  private age = 0;
  get paletteWhite(): boolean { return this.age < 21; }
  /** CPU boundary before SET_PAL_PARTY_MENU; battle's caller owns its palette generator. */
  get paletteCommandDue(): boolean { return this.age === 10; }

  constructor(
    private readonly textBox: TextBox,
    private readonly transfer: BgTransfer,
    private readonly program: 'PartyMenuNormalText' | 'PartyMenuItemUseText' | 'PartyMenuBattleText',
    private readonly paletteOwner: 'field' | 'battle' = 'field',
  ) {
    if (textBox.active) textBox.dismiss();
  }

  present(): void {
    if (this.paletteOwner === 'field' && takeHeldFrame()) return;
    if (this.textBox.active) this.textBox.update();
    else this.transfer.tick();
  }

  /** True at C+24: HandlePartyMenuInput's first read runs in this same frame. */
  frame(): boolean {
    this.age++;
    // White3 + HP copies4 + ClearScreen3, then SET_PAL_PARTY_MENU:
    // C+11..12 held, C+13..15 Delay3. Battle drives that command itself.
    if (this.age === 3) this.transfer.enabled = false;
    if (this.age === 10 && this.paletteOwner === 'field') holdVBlank();
    if (this.age === 15) this.textBox.printStandalone({ program: this.program }, { noDelay: true });
    // PrintText's Delay3 finishes C+18. The three visible thirds then transfer.
    if (this.age === 18) this.transfer.enabled = true;
    if (this.age === 21) this.textBox.dismiss(); // GBPalNormal; caller retains the no-delay prompt
    return this.age >= 24;
  }
}
