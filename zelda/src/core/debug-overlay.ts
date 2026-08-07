interface KeyEventTarget {
  addEventListener(type: string, handler: (e: unknown) => void): void;
  removeEventListener(type: string, handler: (e: unknown) => void): void;
}

export class DebugOverlay {
  private _enabled = false;
  private target: KeyEventTarget | null = null;
  private readonly onKeyDown: (e: unknown) => void;

  constructor() {
    this.onKeyDown = (e: unknown) => {
      const event = e as KeyboardEvent;
      if (event.code === 'Backquote') {
        this._enabled = !this._enabled;
      }
    };
  }

  get enabled(): boolean {
    return this._enabled;
  }

  toggle(): void {
    this._enabled = !this._enabled;
  }

  attach(target?: KeyEventTarget): void {
    this.target = target ?? (window as unknown as KeyEventTarget);
    this.target.addEventListener('keydown', this.onKeyDown);
  }

  detach(): void {
    if (this.target) {
      this.target.removeEventListener('keydown', this.onKeyDown);
      this.target = null;
    }
  }
}
