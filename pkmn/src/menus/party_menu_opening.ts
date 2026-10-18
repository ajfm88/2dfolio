// DisplayPartyMenu (home/pokemon.asm), DrawPartyMenu_ (engine/menus/party_menu.asm).
import type { BgTransfer } from '../text/bg_transfer';
import type { TextBox } from '../text/textbox';

/** The host owns VBlank. frame() performs only the CPU work after that VBlank.
 * The bag advances its shared TextBox; standalone party callers use present(). */
export class PartyMenuOpening {
  private age = 0;
  get paletteWhite(): boolean { return this.age < 19; }

  constructor(
    private readonly textBox: TextBox,
    private readonly transfer: BgTransfer,
    private readonly program: 'PartyMenuNormalText' | 'PartyMenuItemUseText',
  ) {
    if (textBox.active) textBox.dismiss();
  }

  present(): void {
    if (this.textBox.active) this.textBox.update();
    else this.transfer.tick();
  }

  /** True at C+22: HandlePartyMenuInput's first read runs in this same frame. */
  frame(): boolean {
    this.age++;
    // White Delay3, then 30 HP/status tiles (4 waits); DrawPartyMenu's ClearScreen
    // waits C+8..C+10, and its CGB palette waits C+11..C+13, still white.
    if (this.age === 3) this.transfer.enabled = false;
    if (this.age === 13) this.textBox.printStandalone({ program: this.program }, { noDelay: true });
    // PrintText's Delay3 finishes C+16. The three visible thirds then transfer.
    if (this.age === 16) this.transfer.enabled = true;
    if (this.age === 19) this.textBox.dismiss(); // GBPalNormal; caller retains the no-delay prompt
    return this.age >= 22;
  }
}
