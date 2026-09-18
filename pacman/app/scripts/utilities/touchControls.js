// NES-style touch controls for mobile — D-pad (left) and buttons (right).
// Adapted from zelda's touch-controls.js for Pac-Man's Gulp concat build.
// Assets: controller2.png (1720×500 3-frame strip), dpad.png (380×380).

class TouchControls {
  constructor(gameCoordinator) {
    this.gc = gameCoordinator;

    this.PANEL_SIZE = 250;
    this.PANEL_BOTTOM = 10;
    this.BG_W = 860;
    this.BG_H = 250;
    this.BTN_FRAME_NORMAL = 597;

    this.DPAD_CROSS_SIZE = 95;
    this.DPAD_CROSS_X = 77;
    this.DPAD_CROSS_Y = 52;

    this.BUTTONS = {
      start: { x: 119, y: 22, w: 65, h: 38 },
      b: { x: 86, y: 70, w: 65, h: 80 },
      a: { x: 149, y: 70, w: 65, h: 80 },
    };

    this.BTN_PRESS_R = 28;

    this.DPAD_ZONES = this.buildDpadZones();

    this.dpadPanel = null;
    this.dpadCross = null;
    this.buttonPanel = null;
    this.btnOverlays = null;
    this.visible = false;

    // Track which directions are held this frame
    this.heldDirections = new Set();
    // Track the last direction sent to changeDirection
    this.lastDirection = null;
    // Track Start press state to fire once per tap
    this.startWasPressed = false;
  }

  buildDpadZones() {
    var cx = this.DPAD_CROSS_X;
    var cy = this.DPAD_CROSS_Y;
    var s = this.DPAD_CROSS_SIZE;
    var t = Math.round(s / 3);
    return [
      { x: cx + t, y: cy, w: t, h: t, dir: 'up' },
      { x: cx + t, y: cy + 2 * t, w: t, h: t, dir: 'down' },
      { x: cx, y: cy + t, w: t, h: t, dir: 'left' },
      { x: cx + 2 * t, y: cy + t, w: t, h: t, dir: 'right' },
      // Diagonals map to the dominant axis (Pac-Man only moves in 4 dirs)
      { x: cx, y: cy, w: t, h: t, dir: 'up' },
      { x: cx + 2 * t, y: cy, w: t, h: t, dir: 'up' },
      { x: cx, y: cy + 2 * t, w: t, h: t, dir: 'down' },
      { x: cx + 2 * t, y: cy + 2 * t, w: t, h: t, dir: 'down' },
    ];
  }

  isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  init() {
    if (!this.isTouchDevice()) return;

    this.dpadPanel = this.createDpadPanel();
    this.buttonPanel = this.createButtonPanel();
    document.body.appendChild(this.dpadPanel);
    document.body.appendChild(this.buttonPanel);

    // Start hidden
    this.dpadPanel.style.display = 'none';
    this.buttonPanel.style.display = 'none';

    var self = this;
    var handler = function (e) {
      if (!self.visible) return;
      e.preventDefault();
      self.processTouches(e.touches);
    };

    document.addEventListener('touchstart', handler, { passive: false });
    document.addEventListener('touchmove', handler, { passive: false });
    document.addEventListener('touchend', handler, { passive: false });
    document.addEventListener('touchcancel', handler, { passive: false });
  }

  css(el, styles) {
    for (var key in styles) {
      if (styles.hasOwnProperty(key)) {
        el.style[key] = styles[key];
      }
    }
  }

  createDpadPanel() {
    var panel = document.createElement('div');
    this.css(panel, {
      position: 'fixed',
      zIndex: '1000',
      width: this.PANEL_SIZE + 'px',
      height: this.PANEL_SIZE + 'px',
      bottom: this.PANEL_BOTTOM + 'px',
      left: '-60px',
      backgroundImage: 'url(app/style/graphics/ui/controller2.png)',
      backgroundSize: this.BG_W + 'px ' + this.BG_H + 'px',
      backgroundPosition: '0 0',
      backgroundRepeat: 'no-repeat',
      opacity: '0.75',
      touchAction: 'none',
      userSelect: 'none',
      pointerEvents: 'none',
    });

    var cross = document.createElement('div');
    this.css(cross, {
      position: 'absolute',
      width: this.DPAD_CROSS_SIZE + 'px',
      height: this.DPAD_CROSS_SIZE + 'px',
      top: this.DPAD_CROSS_Y + 'px',
      left: this.DPAD_CROSS_X + 'px',
      backgroundImage: 'url(app/style/graphics/ui/dpad.png)',
      backgroundSize: this.DPAD_CROSS_SIZE + 'px ' + this.DPAD_CROSS_SIZE + 'px',
      pointerEvents: 'none',
      transformStyle: 'preserve-3d',
      perspective: '150px',
    });
    panel.appendChild(cross);
    this.dpadCross = cross;

    return panel;
  }

  createButtonPanel() {
    var panel = document.createElement('div');
    this.css(panel, {
      position: 'fixed',
      zIndex: '1000',
      width: this.PANEL_SIZE + 'px',
      height: this.PANEL_SIZE + 'px',
      bottom: this.PANEL_BOTTOM + 'px',
      right: '-30px',
      backgroundImage: 'url(app/style/graphics/ui/controller2.png)',
      backgroundSize: this.BG_W + 'px ' + this.BG_H + 'px',
      backgroundPosition: '-' + this.BTN_FRAME_NORMAL + 'px 0',
      backgroundRepeat: 'no-repeat',
      opacity: '0.75',
      touchAction: 'none',
      userSelect: 'none',
      pointerEvents: 'none',
    });

    var self = this;

    var makeCircle = function (btn) {
      var cx = btn.x + btn.w / 2;
      var cy = btn.y + btn.h / 2;
      var div = document.createElement('div');
      self.css(div, {
        position: 'absolute',
        left: (cx - self.BTN_PRESS_R) + 'px',
        top: (cy - self.BTN_PRESS_R) + 'px',
        width: (self.BTN_PRESS_R * 2) + 'px',
        height: (self.BTN_PRESS_R * 2) + 'px',
        borderRadius: '50%',
        background: 'rgba(0, 0, 0, 0.35)',
        pointerEvents: 'none',
        display: 'none',
      });
      panel.appendChild(div);
      return div;
    };

    var makeRect = function (btn) {
      var div = document.createElement('div');
      self.css(div, {
        position: 'absolute',
        left: (btn.x + 5) + 'px',
        top: (btn.y + 5) + 'px',
        width: (btn.w - 10) + 'px',
        height: (btn.h - 10) + 'px',
        borderRadius: '4px',
        background: 'rgba(0, 0, 0, 0.3)',
        pointerEvents: 'none',
        display: 'none',
      });
      panel.appendChild(div);
      return div;
    };

    this.btnOverlays = {
      start: makeRect(this.BUTTONS.start),
      b: makeCircle(this.BUTTONS.b),
      a: makeCircle(this.BUTTONS.a),
    };

    return panel;
  }

  show() {
    if (!this.dpadPanel) return;
    this.dpadPanel.style.display = 'block';
    this.buttonPanel.style.display = 'block';
    this.visible = true;
  }

  hide() {
    if (!this.dpadPanel) return;
    this.dpadPanel.style.display = 'none';
    this.buttonPanel.style.display = 'none';
    this.visible = false;
    this.heldDirections.clear();
    this.lastDirection = null;
    this.startWasPressed = false;
  }

  setButtonPressed(key, pressed) {
    if (!this.btnOverlays) return;
    this.btnOverlays[key].style.display = pressed ? 'block' : 'none';
  }

  processTouches(touches) {
    if (!this.visible) return;

    this.heldDirections.clear();
    var startPressed = false;
    var aPressed = false;
    var bPressed = false;

    for (var i = 0; i < touches.length; i++) {
      var t = touches[i];
      var x = t.clientX;
      var y = t.clientY;

      // Check d-pad
      if (this.dpadPanel) {
        var rect = this.dpadPanel.getBoundingClientRect();
        var lx = x - rect.left;
        var ly = y - rect.top;
        if (lx >= 0 && lx < this.PANEL_SIZE && ly >= 0 && ly < this.PANEL_SIZE) {
          var zone = this.hitTestDpad(lx, ly);
          if (zone) {
            this.heldDirections.add(zone.dir);
          }
        }
      }

      // Check buttons
      if (this.buttonPanel) {
        var bRect = this.buttonPanel.getBoundingClientRect();
        var blx = x - bRect.left;
        var bly = y - bRect.top;
        if (blx >= 0 && blx < this.PANEL_SIZE && bly >= 0 && bly < this.PANEL_SIZE) {
          if (this.hitTestRect(blx, bly, this.BUTTONS.start)) {
            startPressed = true;
          } else if (this.hitTestRect(blx, bly, this.BUTTONS.a)) {
            aPressed = true;
          } else if (this.hitTestRect(blx, bly, this.BUTTONS.b)) {
            bPressed = true;
          }
        }
      }
    }

    // Send the most recent direction to Pac-Man
    if (this.heldDirections.size > 0) {
      // Prefer a new direction over the last one (makes turning responsive)
      var dir = null;
      this.heldDirections.forEach(function (d) {
        dir = d;
      });
      if (dir) {
        this.gc.changeDirection(dir);
        this.lastDirection = dir;
      }
    }

    // Start button: fire once on press, not continuously
    if (startPressed && !this.startWasPressed) {
      this.gc.handlePauseKey();
    }
    this.startWasPressed = startPressed;

    // Visual feedback
    this.setButtonPressed('start', startPressed);
    this.setButtonPressed('a', aPressed);
    this.setButtonPressed('b', bPressed);

    // D-pad tilt
    if (this.dpadCross) {
      var transform = '';
      if (this.heldDirections.has('down')) transform += ' rotateX(-12deg)';
      if (this.heldDirections.has('up')) transform += ' rotateX(12deg)';
      if (this.heldDirections.has('left')) transform += ' rotateY(-12deg)';
      if (this.heldDirections.has('right')) transform += ' rotateY(12deg)';
      this.dpadCross.style.transform = transform;
    }
  }

  hitTestDpad(lx, ly) {
    for (var i = 0; i < this.DPAD_ZONES.length; i++) {
      var zone = this.DPAD_ZONES[i];
      if (lx >= zone.x && lx < zone.x + zone.w
        && ly >= zone.y && ly < zone.y + zone.h) {
        return zone;
      }
    }
    return null;
  }

  hitTestRect(lx, ly, rect) {
    return lx >= rect.x && lx < rect.x + rect.w
      && ly >= rect.y && ly < rect.y + rect.h;
  }

  reservedBottomPx() {
    return this.dpadPanel ? (this.PANEL_SIZE + this.PANEL_BOTTOM) : 0;
  }
}
