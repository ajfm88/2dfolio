// A retained DisplayTextID menu. The script host owns VBlank and text advancement.
export interface MenuSession {
  readonly advanceText: boolean;
  readonly fullScreen?: boolean;
  enter(): void;
  copyThird(third: number): void;
  frame(readJoypad: () => void, pressSound: () => void): boolean;
  renderOverlay(): void;
}
