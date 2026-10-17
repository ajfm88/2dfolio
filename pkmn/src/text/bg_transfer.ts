/** AutoBgMapTransfer (home/vcopy.asm). Disabled, it copies nothing and the portion holds. */
export class BgTransfer {
  private portion = 0;
  private transferEnabled = true;

  /** hAutoBGTransferEnabled. Turning it off does not reset the portion. */
  get enabled(): boolean { return this.transferEnabled; }
  set enabled(value: boolean) { this.transferEnabled = value; }

  /** The third the next enabled tick copies: 0 top, 1 middle, 2 bottom. */
  get nextPortion(): number { return this.portion; }

  /** Tests start from third 0. Gameplay never clears the portion. */
  resetPortion(): void { this.portion = 0; }

  /** True when this VBlank copied the bottom third. False when disabled or on the other thirds. */
  tick(): boolean {
    if (!this.enabled) return false;
    const bottom = this.portion === 2;
    this.portion = (this.portion + 1) % 3;
    return bottom;
  }
}
export const textBgTransfer = new BgTransfer();
