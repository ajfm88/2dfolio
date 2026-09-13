export class DebugOverlay {
   _enabled = false;
   target = null;
    onKeyDown;

  constructor() {
    this.onKeyDown = (e) => {
      const event = e;
      if (event.code === 'Backquote') {
        this._enabled = !this._enabled;
      }
    };
  }

  get enabled() {
    return this._enabled;
  }

  toggle() {
    this._enabled = !this._enabled;
  }

  attach(target) {
    this.target = target ?? window;
    this.target.addEventListener('keydown', this.onKeyDown);
  }

  detach() {
    if (this.target) {
      this.target.removeEventListener('keydown', this.onKeyDown);
      this.target = null;
    }
  }
}
