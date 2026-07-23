const Constants = {
  TILE_SIZE: 48
};
const TS = Constants.TILE_SIZE;

import { SpriteRenderer } from "./spriteRenderer.js"
import { TrashRenderer } from "./trashRenderer.js"

//TODO remove
import { TrashBlock } from "./trashBlock.js"

class Renderer {
  constructor(receiverId, board, spriteRenderer) {
    this.receiver = document.getElementById(receiverId);
    this.tileColumns = board.width;
    this.tileRows = board.height;

    this.scoreEl = this._createScoreElement();
    this.receiver.appendChild(this.scoreEl);

    const canvasEl = this._createCanvasElement();
    this.receiver.appendChild(canvasEl);
    this.canvasCtx = canvasEl.getContext('2d');
    // Keep the 16x16 sprites crisp when scaled up to 48px tiles.
    // Without this the canvas bilinear-interpolates the upscale and the pixel art looks blurry.
    this.canvasCtx.imageSmoothingEnabled = false;
    this.spriteRenderer = new SpriteRenderer();
    this.trashRenderer = new TrashRenderer();
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

  _createCanvasElement() {
    const canvasEl = document.createElement('canvas');
    canvasEl.width = this.tileColumns * Constants.TILE_SIZE;
    canvasEl.height = this.tileRows * Constants.TILE_SIZE;
    // Keep pixels sharp if the canvas is ever scaled by CSS.
    canvasEl.style.imageRendering = 'pixelated';
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

    this.scoreEl.textContent = String(game.board.score);
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
    this.canvasCtx.fillStyle = '#222';
    this.canvasCtx.fillRect(0, 0, this.tileColumns * Constants.TILE_SIZE, this.tileRows * Constants.TILE_SIZE);
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