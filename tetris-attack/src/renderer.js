const Constants = {
  TILE_SIZE: 48
};
const TS = Constants.TILE_SIZE;

import { SpriteRenderer } from "./spriteRenderer.js"
import { TrashRenderer } from "./trashRenderer.js"
import { stageLayout } from "./stages.js"
import { PixelFont, CHAR_H } from "./font.js"

//TODO remove
import { TrashBlock } from "./trashBlock.js"

// The HUD readouts, drawn in the SNES HUD font into the stage art's own two
// empty boxes: TIME upper-left, SCORE down the right, as the original lays them
// out. Coordinates are native (unscaled) panel pixels; the overlays are
// stretched up by CSS.
//
// Each readout is a caption with its value right-aligned underneath. At 8px per
// character the right box holds 5 ("SCORE" exactly); the left box is 64 wide,
// so "TIME" and a MM:SS value sit comfortably.
const HUD_PAD = 4;
const HUD_LABEL_Y = 4;
const HUD_VALUE_Y = 14;
const HUD_ROW_HEIGHT = 24;

// Frames per second the board ticks at, for turning elapsed frames into a clock.
const TICKS_PER_SECOND = 60;

// Elapsed board ticks as MM:SS. Minutes are not padded (so it reads 0:07, like
// the original's 0'07) but are allowed past 99 rather than wrapping.
function formatClock(frames) {
  const total = Math.floor(frames / TICKS_PER_SECOND);
  const seconds = total % 60;
  return `${Math.floor(total / 60)}:${String(seconds).padStart(2, '0')}`;
}

class Renderer {
  constructor(receiverId, board, stage = null) {
    this.receiver = document.getElementById(receiverId);
    this.tileColumns = board.width;
    this.tileRows = board.height;
    this.stage = stage;

    // When a stage is set, the board is framed inside its stage-clear artwork:
    // the canvas is positioned to sit exactly in the art's playfield well, and
    // the surrounding frame + character are drawn behind it via the DOM. The
    // canvas coordinate system is unchanged, so all draw logic below is agnostic
    // to whether a frame is present.
    if (this.stage) {
      this._setupStageFrame();
    }

    // Framed boards get the pixel-font HUD drawn into the stage's own boxes
    // (one canvas each); the plain (unframed) fallback keeps the simple HTML
    // score bar.
    if (this.stageLayout) {
      // The SNES HUD captions its readouts in cyan over a white value.
      this.labelFont = new PixelFont('cyan');
      this.valueFont = new PixelFont('white');
      this.timePanel = this._createPanel(this.stageLayout.timePanel);
      this.scorePanel = this._createPanel(this.stageLayout.hudPanel);
      this.receiver.appendChild(this.timePanel.canvas);
      this.receiver.appendChild(this.scorePanel.canvas);
    } else {
      this.scoreEl = this._createScoreElement();
      this.receiver.appendChild(this.scoreEl);
    }

    const canvasEl = this._createCanvasElement();
    this.receiver.appendChild(canvasEl);
    this.canvasCtx = canvasEl.getContext('2d');
    // Keep the 16x16 sprites crisp when scaled up to 48px tiles.
    // Without this the canvas bilinear-interpolates the upscale and the pixel art looks blurry.
    this.canvasCtx.imageSmoothingEnabled = false;
    this.spriteRenderer = new SpriteRenderer();
    this.trashRenderer = new TrashRenderer();
  }

  // Turn the receiver into a stage frame: a full-cell background image with the
  // board canvas + score overlaid at the well/score-box positions.
  _setupStageFrame() {
    const w = this.tileColumns * Constants.TILE_SIZE;
    const h = this.tileRows * Constants.TILE_SIZE;
    const L = stageLayout(this.stage, w, h);
    this.stageLayout = L;

    this.receiver.style.position = 'relative';
    this.receiver.style.width = `${L.frameW}px`;
    this.receiver.style.height = `${L.frameH}px`;

    const frame = document.createElement('div');
    frame.style.cssText = `
      position: absolute; left: 0; top: 0;
      width: ${L.frameW}px; height: ${L.frameH}px;
      background-image: url('${L.sheetUrl}');
      background-repeat: no-repeat;
      background-size: ${L.bgSizeW}px ${L.bgSizeH}px;
      background-position: ${L.bgPosX}px ${L.bgPosY}px;
      image-rendering: pixelated;
    `;
    this.receiver.appendChild(frame);
  }

  tileSize() {
    return TS;
  }

  _createScoreElement() {
    const el = document.createElement('div');
    const w = this.tileColumns * Constants.TILE_SIZE;
    el.style.cssText = `
      width: ${w}px; height: 28px; line-height: 28px;
      font-family: 'Press Start 2P', 'Courier New', monospace;
      font-size: 14px; text-align: right; padding: 0 6px;
      color: #ffe14d; background: #111; box-sizing: border-box;
      text-shadow: 0 1px 0 rgba(0,0,0,0.7);
      border-bottom: 2px solid #333;
    `;
    el.textContent = '0';
    return el;
  }

  // A transparent overlay sitting exactly on one of the stage art's HUD boxes.
  // Its backing store is the box's *native* size and CSS stretches it to the
  // frame's scale, so the pixel font always lands on whole pixels no matter
  // what fractional scale the frame works out to.
  _createPanel(placement) {
    const el = document.createElement('canvas');
    el.width = placement.nativeW;
    el.height = placement.nativeH;
    el.style.cssText = `
      position: absolute; z-index: 2;
      left: ${placement.left}px; top: ${placement.top}px;
      width: ${placement.width}px; height: ${placement.height}px;
      image-rendering: pixelated; pointer-events: none;
    `;
    const ctx = el.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { canvas: el, ctx };
  }

  // A caption with its value right-aligned underneath, cleared and redrawn each
  // frame. The box art itself lives in the stage background behind the canvas.
  _drawReadout(panel, label, value) {
    const ctx = panel.ctx;
    const w = panel.canvas.width;
    ctx.clearRect(0, 0, w, panel.canvas.height);

    if (!this.labelFont.ready() || !this.valueFont.ready()) {
      this._drawReadoutFallback(panel, value, w);
      return;
    }
    this.labelFont.draw(ctx, label, HUD_PAD, HUD_LABEL_Y);
    // An overlong value runs off to the right rather than out of the box's left edge.
    const valueX = Math.max(HUD_PAD, w - HUD_PAD - this.valueFont.width(value));
    this.valueFont.draw(ctx, value, valueX, HUD_VALUE_Y);
  }

  _drawHudColumn(panel, entries) {
    const ctx = panel.ctx;
    const w = panel.canvas.width;
    ctx.clearRect(0, 0, w, panel.canvas.height);

    if (!this.labelFont.ready() || !this.valueFont.ready()) {
      this._drawReadoutFallback(panel, entries[0].value, w);
      return;
    }

    let y = HUD_LABEL_Y;
    for (const { label, value } of entries) {
      this.labelFont.draw(ctx, label, HUD_PAD, y);
      const valueX = Math.max(HUD_PAD, w - HUD_PAD - this.valueFont.width(value));
      this.valueFont.draw(ctx, value, valueX, y + HUD_VALUE_Y - HUD_LABEL_Y);
      y += HUD_ROW_HEIGHT;
    }
  }

  // Used for the frames before font.png has decoded, and if the sheet can never
  // be read back (a tainted canvas, e.g. when served from file://).
  _drawReadoutFallback(panel, value, w) {
    const ctx = panel.ctx;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = `${CHAR_H + 2}px monospace`;
    ctx.fillText(value, w - HUD_PAD, HUD_VALUE_Y);
  }

  _createCanvasElement() {
    const canvasEl = document.createElement('canvas');
    canvasEl.width = this.tileColumns * Constants.TILE_SIZE;
    canvasEl.height = this.tileRows * Constants.TILE_SIZE;
    // Keep pixels sharp if the canvas is ever scaled by CSS.
    canvasEl.style.imageRendering = 'pixelated';
    if (this.stageLayout) {
      // Drop the canvas into the stage's playfield well.
      const L = this.stageLayout;
      canvasEl.style.position = 'absolute';
      canvasEl.style.zIndex = '1';
      canvasEl.style.left = `${L.canvasLeft}px`;
      canvasEl.style.top = `${L.canvasTop}px`;
    }
    return canvasEl;
  }

  draw(game) {
    this._drawBackground();

    const scroll = game.board.scroll;
    this.yscroll = scroll * TS;
    this.canvasCtx.setTransform(1, 0, 0, 1, 0, Math.floor(-this.yscroll));
    this.frameNumber = (this.frameNumber || 0) + 1;

    //this._drawTileGrid(game.board);
    this._drawBlocks(game.board);
    this._drawTrash(game.board);
    game.cursors.forEach((c) => this._drawCursor(c));
    this._drawObjects(game.board);
    this._drawStackState(game.board);

    if (this.scorePanel) {
      this._drawReadout(this.timePanel, 'TIME', formatClock(game.board.elapsedFrames));
      this._drawHudColumn(this.scorePanel, [
        { label: 'SCORE', value: String(game.board.score) },
        { label: 'SPEED', value: String(game.board.speedLevel) },
      ]);
    } else {
      this.scoreEl.textContent = String(game.board.score);
    }
  }

  // Feedback for the top-out grace window, and for a board that has died.
  _drawStackState(board) {
    this.canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.canvasCtx.setLineDash([]);
    const w = this.tileColumns * Constants.TILE_SIZE;
    const h = this.tileRows * Constants.TILE_SIZE;

    if (board.toppedOut) {
      this.canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      this.canvasCtx.fillRect(0, 0, w, h);
      return;
    }

    if (board.inDanger) {
      // Pulse a red frame and a wash over the whole board. The frame alone reads as
      // almost nothing against bright panels, and the grace window is short enough
      // that the warning has to be unmissable.
      const pulse = 0.5 + 0.5 * Math.sin(this.frameNumber / 5);
      this.canvasCtx.fillStyle = `rgba(255, 0, 0, ${0.10 + 0.16 * pulse})`;
      this.canvasCtx.fillRect(0, 0, w, h);
      this.canvasCtx.strokeStyle = `rgba(255, 64, 64, ${0.45 + 0.45 * pulse})`;
      this.canvasCtx.lineWidth = 10;
      this.canvasCtx.strokeRect(5, 5, w - 10, h - 10);
    }
  }

  _drawFrameNumber() {
    if (this.frameNumber == 1) {
      this.fps_time = Date.now();
      this.fps_frame_count = this.frameNumber
    }

    if (this.frameNumber % 100 == 0) {
      this.fps = (this.frameNumber - this.fps_frame_count) / (Date.now() - this.fps_time) * 1000
      this.fps_time = Date.now();
      this.fps_frame_count = this.frameNumber
    }

    // TODO : Generalize this to a debug text display
    this.canvasCtx.setTransform(1, 0, 0, 1, 0, 15);
    this.canvasCtx.font = '15px monospace';
    this.canvasCtx.fillStyle = 'white';
    this.canvasCtx.fillText(`Frame ${this.frameNumber}, fps ${Math.round(this.fps)}`, 0, 0);
  }

  _drawBackground() {
    this.canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
    const w = this.tileColumns * Constants.TILE_SIZE;
    const h = this.tileRows * Constants.TILE_SIZE;
    if (this.stage) {
      // The stage's own well art shows through empty cells behind the canvas.
      this.canvasCtx.clearRect(0, 0, w, h);
      return;
    }
    this.canvasCtx.fillStyle = '#222';
    this.canvasCtx.fillRect(0, 0, w, h);
  }

  _drawObjects(board) {
    for (const gameObject of board.gameObjects) {
      gameObject.draw(this);
    }
  }

  _drawBlocks(board) {
    for (let row = 0; row < this.tileRows; ++row) {
      for (let col = 0; col < this.tileColumns; ++col) {
        const block = board.grid.get(col, row);
        if (block != null) {
          let tx = 0;
          let ty = 0;
          let moved = block.movePosition();
          if (moved && moved > 0) {
            tx = (block.previousPosition()[0] - col) * TS * moved;
            ty = (block.previousPosition()[1] - row) * TS * moved;
          }
          this.canvasCtx.transform(1, 0, 0, 1, tx, ty);
          this.spriteRenderer.render(this.canvasCtx, block.spriteIndex, TS * col, TS * row, TS, TS, this.frameNumber, block);
          this.canvasCtx.transform(1, 0, 0, 1, -tx, -ty);
        }
      }
    }
    for (let col = 0; col < this.tileColumns; col++) {
      const block = board.nextRow[col];
      this.spriteRenderer.render(this.canvasCtx, block.spriteIndex, TS * col, TS * this.tileRows, TS, TS, this.frameNumber, block, true);
    }
  }

  _drawTrash(board) {
    for (let trash of board.trash) {
      this.trashRenderer.render(this.canvasCtx, trash, TS);
    }
  }

  _drawCursor(cursor) {
    const cursorPulse = this.frameNumber % 50 > 25 ? -1 : -4;
    const w = TS + cursorPulse * 2;

    this.canvasCtx.strokeStyle = cursor.color;
    const sideDash = [w / 4, w / 2, w / 2, w / 2, w / 2, w / 2, w / 2, w / 2, w / 2];
    this.canvasCtx.setLineDash(sideDash)
    this.canvasCtx.lineWidth = 5;
    this.canvasCtx.strokeRect(TS * cursor.position[0] - cursorPulse, TS * cursor.position[1] - cursorPulse, w, w);
    this.canvasCtx.strokeRect(TS * (cursor.position[0] + 1) - cursorPulse, TS * cursor.position[1] - cursorPulse, w, w);
  }

  _drawTileGrid(board) {
    const TS = Constants.TILE_SIZE;

    this.canvasCtx.strokeStyle = 'black';
    this.canvasCtx.lineWidth = 1;
    for (let row = 0; row < this.tileRows; ++row) {
      for (let col = 0; col < this.tileColumns; ++col) {
        this.canvasCtx.strokeRect(TS * col, TS * row, TS, TS);
      }
    }
  }
}

export { Renderer };