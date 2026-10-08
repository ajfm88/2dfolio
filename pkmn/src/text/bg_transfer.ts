/** AutoBgMapTransfer (home/vcopy.asm): portion survives disabling the transfer. */
export class BgTransfer {
  private portion = 0;
  tick(): boolean {
    const bottom = this.portion === 2;
    this.portion = (this.portion + 1) % 3;
    return bottom;
  }
}
export const textBgTransfer = new BgTransfer();
