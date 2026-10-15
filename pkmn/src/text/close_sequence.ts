/** CloseTextDisplay: DelayFrame, sprite/player reload, then jp UpdateSprites.
 * The caller creates this at Hold's last Joypad read; each advance is a VBlank.
 * Only its first frame enables AutoBGMapTransfer. No Joypad reads during copies.
 */
export class CloseSequence {
  elapsed = 0;
  get firstFrame(): boolean { return this.elapsed === 0; }
  get complete(): boolean { return this.elapsed === this.frames; }
  constructor(readonly frames: number, private readonly updateSprites: () => void) {
    if (!Number.isInteger(frames) || frames < 1) throw new Error(`invalid text close cost ${frames}`);
  }
  advance(): void {
    if (this.complete) return;
    if (++this.elapsed === this.frames) this.updateSprites();
  }
}
