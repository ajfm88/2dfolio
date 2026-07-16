const Constants = {
  TILE_SIZE: 48
};
const TS = Constants.TILE_SIZE;

import { SpriteRenderer } from "./spriteRenderer.js"

class Renderer {
  constructor(receiverId, board, spriteRenderer) {
    this.receiver = document.getElementById(receiverId);
    this.tileColumns = board.width;
    this.tileRows = board.height;

    const canvasEl = this._createCanvasElement();
    this.receiver.appendChild(canvasEl);
    this.canvasCtx = canvasEl.getContext('2d');
    this.spriteRenderer = new SpriteRenderer();
  }

  tileSize() { 
    return TS;
  }

  _createCanvasElement() {
    const canvasEl = document.createElement('canvas');
    canvasEl.width = this.tileColumns * Constants.TILE_SIZE;
    canvasEl.height = this.tileRows * Constants.TILE_SIZE;
    return canvasEl;
  }

  draw(game) {
    this.canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.canvasCtx.fillStyle = '#222';
    this.canvasCtx.fillRect(0, 0, this.tileColumns * Constants.TILE_SIZE, this.tileRows * Constants.TILE_SIZE);

    const scroll = game.board.scroll;
    this.yscroll = scroll * TS;
    this.canvasCtx.setTransform(1, 0, 0, 1, 0, Math.floor(-this.yscroll));
    this.frameNumber = (this.frameNumber || 0) + 1;
    //this._drawTileGrid(game.board);
    this._drawBlocks(game.board);
    
    game.cursors.forEach((c) => this._drawCursor(c));

    this._drawObjects(game.board);
  }

  _drawObjects(board) {
    for(const gameObject of board.gameObjects) {
      gameObject.draw(this);
    }
  }

  _drawBlocks(board) {
    for (let row = 0; row < this.tileRows; ++row) {
      for (let col = 0; col < this.tileColumns; ++col) {
        const block = board.grid.get(col, row);
        if (block != null) {
          this.spriteRenderer.render(this.canvasCtx, block.spriteIndex, TS * col, TS * row, TS, TS, this.frameNumber, block);
        }
      }
    }
    for (let col = 0; col < this.tileColumns; col++) {
      const block = board.nextRow[col];
      this.spriteRenderer.render(this.canvasCtx, block.spriteIndex, TS * col, TS * this.tileRows, TS, TS, this.frameNumber, block, true);
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