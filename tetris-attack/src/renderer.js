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

  _createCanvasElement() {
    const canvasEl = document.createElement('canvas');
    canvasEl.width = this.tileColumns * Constants.TILE_SIZE;
    canvasEl.height = this.tileRows * Constants.TILE_SIZE;
    return canvasEl;
  }

  draw(game) {
    this.canvasCtx.setTransform(1,0,0,1,0,0);
    this.canvasCtx.fillStyle = '#222';
    this.canvasCtx.fillRect(0, 0, this.tileColumns * Constants.TILE_SIZE, this.tileRows * Constants.TILE_SIZE);

    //TODO sync this with the trash rate
    this.yscroll = (this.yscroll || 0) + TS/(60*7);
    if(this.yscroll > TS) {
      this.yscroll = 0;
    }
    this.canvasCtx.setTransform(1,0,0,1,0,Math.floor(-this.yscroll));
    this.frameNumber = (this.frameNumber || 0) + 1;
    this._drawTileGrid(game.board);
    this._drawBlocks(game.board);
    this._drawCursor(game.cursor);
  }

  _drawBlocks(board) {
    for (let row = 0; row < this.tileRows; ++row) {
      for (let col = 0; col < this.tileColumns; ++col) {
        const block = board.grid.get(col, row);
        if (block != null) {
          this.spriteRenderer.render(this.canvasCtx, block.spriteIndex, TS * col, TS * row, TS, TS, this.frameNumber, block.falling());
        }
      }
    }
  }

  _drawCursor(cursor) {
    this.canvasCtx.strokeStyle = 'white';
    const sideDash = [TS / 4, TS / 2, TS / 2, TS / 2, TS / 2, TS / 2, TS / 2, TS / 2, TS / 2, TS / 2, TS / 2, TS / 2, TS / 2, TS / 2, TS / 2, TS / 2]
    this.canvasCtx.setLineDash(sideDash)
    this.canvasCtx.lineWidth = 5;
    this.canvasCtx.strokeRect(TS * cursor.position[0], TS * cursor.position[1], TS, TS);
    this.canvasCtx.strokeRect(TS * (cursor.position[0] + 1), TS * cursor.position[1], TS, TS);
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