import { TextBox } from './textbox';

/** DisplayTextID wrapper shared by the map dialogue and TalkToTrainer paths. */
export class MapDialogue {
  private onTextComplete: (() => void) | undefined;
  constructor(private readonly box: TextBox) {}
  show(text: string, opts: { trainer?: boolean; kind?: 'text' | 'printText'; autoBox?: boolean; program?: string; onTextComplete?: () => void } = {}): void {
    this.onTextComplete = opts.onTextComplete;
    this.box.show(text, { printText: opts.kind === 'printText' || opts.trainer,
      autoBox: opts.autoBox, program: opts.program });
  }
  /** True after Hold, the full CloseTextDisplay reload and its trailing UpdateSprites. */
  update(): boolean {
    this.box.update();
    if (this.box.isTextComplete && this.onTextComplete) {
      const callback = this.onTextComplete;
      this.onTextComplete = undefined;
      callback(); // EngageMapTrainer follows the last letter's delay, before A.
    }
    return !this.box.active;
  }
}
