// Touch controls — NES-style d-pad + buttons overlay for mobile
// Assets from zelda30tribute (controller2.png = 1720×500 3-frame strip, dpad.png = 380×380)
// Only shown on touch-capable devices.
//
// Per-button press: the panel background shows the NORMAL frame. Each button is
// an overlay div with no background by default. When pressed, that div gets the
// PRESSED frame cropped to just its area — so only the pressed button changes.

import { Action, type InputManager } from '../core/input.js';

const PANEL_SIZE = 250;

// controller2.png native: 1720×500, displayed at half → 860×250
const BG_W = 860;
const BG_H = 250;

// Frame offsets in the 860-wide display strip.
// Frame 0 = d-pad bg, Frame 1 = buttons pressed, Frame 2 = buttons normal.
const BTN_FRAME_NORMAL = 597;
const BTN_FRAME_PRESSED = 287;

// D-pad cross overlay
const DPAD_CROSS_SIZE = 95;
const DPAD_CROSS_X = 77;
const DPAD_CROSS_Y = 52;

// Button hit zones within the 250px button panel.
const BUTTONS = {
  start: { x: 119, y: 22, w: 65, h: 38 },
  b:     { x: 86,  y: 70, w: 65, h: 80 },
  a:     { x: 149, y: 70, w: 65, h: 80 },
} as const;

// Press indicator radius for the circular A/B buttons
const BTN_PRESS_R = 28;

// D-pad hit zones
const DPAD_ZONES = buildDpadZones();

interface HitZone {
  x: number; y: number; w: number; h: number;
  actions: Action[];
}

function buildDpadZones(): HitZone[] {
  const cx = DPAD_CROSS_X;
  const cy = DPAD_CROSS_Y;
  const s = DPAD_CROSS_SIZE;
  const t = Math.round(s / 3);
  return [
    { x: cx + t, y: cy,       w: t, h: t, actions: [Action.Up] },
    { x: cx + t, y: cy + 2*t, w: t, h: t, actions: [Action.Down] },
    { x: cx,     y: cy + t,   w: t, h: t, actions: [Action.Left] },
    { x: cx + 2*t, y: cy + t, w: t, h: t, actions: [Action.Right] },
    { x: cx,       y: cy,       w: t, h: t, actions: [Action.Up, Action.Left] },
    { x: cx + 2*t, y: cy,       w: t, h: t, actions: [Action.Up, Action.Right] },
    { x: cx,       y: cy + 2*t, w: t, h: t, actions: [Action.Down, Action.Left] },
    { x: cx + 2*t, y: cy + 2*t, w: t, h: t, actions: [Action.Down, Action.Right] },
  ];
}

function css(el: HTMLElement, styles: Record<string, string>): void {
  for (const [k, v] of Object.entries(styles)) {
    (el.style as unknown as Record<string, string>)[k] = v;
  }
}

export class TouchControls {
  private readonly _input: InputManager;
  private _dpadPanel: HTMLDivElement | null = null;
  private _dpadCross: HTMLDivElement | null = null;
  private _buttonPanel: HTMLDivElement | null = null;
  private _btnOverlays: { start: HTMLDivElement; b: HTMLDivElement; a: HTMLDivElement } | null = null;

  constructor(input: InputManager) {
    this._input = input;
  }

  init(): void {
    if (!this.isTouchDevice()) return;

    this._dpadPanel = this.createDpadPanel();
    this._buttonPanel = this.createButtonPanel();
    document.body.appendChild(this._dpadPanel);
    document.body.appendChild(this._buttonPanel);

    const handler = (e: TouchEvent) => {
      e.preventDefault();
      this.processTouches(e.touches);
    };

    document.addEventListener('touchstart', handler, { passive: false });
    document.addEventListener('touchmove', handler, { passive: false });
    document.addEventListener('touchend', handler, { passive: false });
    document.addEventListener('touchcancel', handler, { passive: false });
  }

  private isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  private createDpadPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    css(panel, {
      position: 'fixed',
      zIndex: '1000',
      width: `${PANEL_SIZE}px`,
      height: `${PANEL_SIZE}px`,
      bottom: '10px',
      left: '-60px',
      backgroundImage: 'url(/assets/ui/controller2.png)',
      backgroundSize: `${BG_W}px ${BG_H}px`,
      backgroundPosition: '0 0',
      backgroundRepeat: 'no-repeat',
      opacity: '0.75',
      touchAction: 'none',
      userSelect: 'none',
      pointerEvents: 'none',
    });

    const cross = document.createElement('div');
    css(cross, {
      position: 'absolute',
      width: `${DPAD_CROSS_SIZE}px`,
      height: `${DPAD_CROSS_SIZE}px`,
      top: `${DPAD_CROSS_Y}px`,
      left: `${DPAD_CROSS_X}px`,
      backgroundImage: 'url(/assets/ui/dpad.png)',
      backgroundSize: `${DPAD_CROSS_SIZE}px ${DPAD_CROSS_SIZE}px`,
      pointerEvents: 'none',
      transformStyle: 'preserve-3d',
      perspective: '150px',
    });
    panel.appendChild(cross);
    this._dpadCross = cross;

    return panel;
  }

  private createButtonPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    css(panel, {
      position: 'fixed',
      zIndex: '1000',
      width: `${PANEL_SIZE}px`,
      height: `${PANEL_SIZE}px`,
      bottom: '10px',
      right: '-30px',
      backgroundImage: 'url(/assets/ui/controller2.png)',
      backgroundSize: `${BG_W}px ${BG_H}px`,
      backgroundPosition: `-${BTN_FRAME_NORMAL}px 0`,
      backgroundRepeat: 'no-repeat',
      opacity: '0.75',
      touchAction: 'none',
      userSelect: 'none',
      pointerEvents: 'none',
    });

    // Per-button press indicators — dark overlays centered on each hit zone
    const makeCircle = (btn: { x: number; y: number; w: number; h: number }): HTMLDivElement => {
      const cx = btn.x + btn.w / 2;
      const cy = btn.y + btn.h / 2;
      const div = document.createElement('div');
      css(div, {
        position: 'absolute',
        left: `${cx - BTN_PRESS_R}px`,
        top: `${cy - BTN_PRESS_R}px`,
        width: `${BTN_PRESS_R * 2}px`,
        height: `${BTN_PRESS_R * 2}px`,
        borderRadius: '50%',
        background: 'rgba(0, 0, 0, 0.35)',
        pointerEvents: 'none',
        display: 'none',
      });
      panel.appendChild(div);
      return div;
    };

    const makeRect = (btn: { x: number; y: number; w: number; h: number }): HTMLDivElement => {
      const div = document.createElement('div');
      css(div, {
        position: 'absolute',
        left: `${btn.x + 5}px`,
        top: `${btn.y + 5}px`,
        width: `${btn.w - 10}px`,
        height: `${btn.h - 10}px`,
        borderRadius: '4px',
        background: 'rgba(0, 0, 0, 0.3)',
        pointerEvents: 'none',
        display: 'none',
      });
      panel.appendChild(div);
      return div;
    };

    this._btnOverlays = {
      start: makeRect(BUTTONS.start),
      b: makeCircle(BUTTONS.b),
      a: makeCircle(BUTTONS.a),
    };

    return panel;
  }

  private setButtonPressed(key: 'start' | 'b' | 'a', pressed: boolean): void {
    if (!this._btnOverlays) return;
    this._btnOverlays[key].style.display = pressed ? 'block' : 'none';
  }

  private processTouches(touches: TouchList): void {
    this._input.clearExternalActions();
    let aPressed = false;
    let bPressed = false;
    let startPressed = false;

    for (let i = 0; i < touches.length; i++) {
      const t = touches[i]!;
      const x = t.clientX;
      const y = t.clientY;

      // Check d-pad
      if (this._dpadPanel) {
        const rect = this._dpadPanel.getBoundingClientRect();
        const lx = x - rect.left;
        const ly = y - rect.top;
        if (lx >= 0 && lx < PANEL_SIZE && ly >= 0 && ly < PANEL_SIZE) {
          const zone = this.hitTestDpad(lx, ly);
          if (zone) {
            for (const action of zone.actions) {
              this._input.setActionHeld(action, true);
            }
          }
        }
      }

      // Check buttons
      if (this._buttonPanel) {
        const rect = this._buttonPanel.getBoundingClientRect();
        const lx = x - rect.left;
        const ly = y - rect.top;
        if (lx >= 0 && lx < PANEL_SIZE && ly >= 0 && ly < PANEL_SIZE) {
          if (this.hitTestRect(lx, ly, BTN_A)) {
            this._input.setActionHeld(Action.Attack, true);
            aPressed = true;
          } else if (this.hitTestRect(lx, ly, BTN_B)) {
            this._input.setActionHeld(Action.Item, true);
            bPressed = true;
          } else if (this.hitTestRect(lx, ly, BTN_START)) {
            this._input.setActionHeld(Action.Start, true);
            startPressed = true;
          }
        }
      }
    }

    // Update per-button press visuals
    this.setButtonPressed('a', aPressed);
    this.setButtonPressed('b', bPressed);
    this.setButtonPressed('start', startPressed);

    // D-pad tilt
    if (this._dpadCross) {
      let transform = '';
      if (this._input.isHeld(Action.Down)) transform += ' rotateX(-12deg)';
      if (this._input.isHeld(Action.Up)) transform += ' rotateX(12deg)';
      if (this._input.isHeld(Action.Left)) transform += ' rotateY(-12deg)';
      if (this._input.isHeld(Action.Right)) transform += ' rotateY(12deg)';
      this._dpadCross.style.transform = transform;
    }
  }

  private hitTestDpad(lx: number, ly: number): HitZone | null {
    for (const zone of DPAD_ZONES) {
      if (lx >= zone.x && lx < zone.x + zone.w &&
          ly >= zone.y && ly < zone.y + zone.h) {
        return zone;
      }
    }
    return null;
  }

  private hitTestRect(
    lx: number, ly: number,
    rect: { x: number; y: number; w: number; h: number },
  ): boolean {
    return lx >= rect.x && lx < rect.x + rect.w &&
           ly >= rect.y && ly < rect.y + rect.h;
  }
}

const BTN_A = BUTTONS.a;
const BTN_B = BUTTONS.b;
const BTN_START = BUTTONS.start;
