// A retained DisplayTextID menu. The script host advances text/VBlank unless a nested session owns it.
export interface MenuSession {
  readonly advanceText: boolean;
  readonly fullScreen?: boolean;
  /** A nested full-screen session owns this frame's VBlank; the text host must skip its tick. */
  readonly ownsBgTransfer?: boolean;
  enter(): void;
  copyThird(third: number): void;
  frame(readJoypad: () => void, pressSound: () => void): boolean;
  renderOverlay(): void;
}
