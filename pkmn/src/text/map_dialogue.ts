import { TextBox } from './textbox';

/** DisplayTextID wrapper shared by the map dialogue and TalkToTrainer paths. */
export class MapDialogue {
  private onTextComplete: (() => void) | undefined;
  constructor(private readonly box: TextBox) {}
  show(text: string, opts: { trainer?: boolean; onTextComplete?: () => void } = {}): void {
    this.onTextComplete = opts.onTextComplete;
    this.box.show(text, { mode: 'displayTextID', printText: opts.trainer });
  }
  /** True when HoldTextDisplayOpen and CloseTextDisplay's DelayFrame returned. */
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
