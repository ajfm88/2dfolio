const Constants = {
  TILE_SIZE: 32
};
const TS = Constants.TILE_SIZE;

class Renderer {
  constructor(receiverId, board) {
    this.receiver = document.getElementById(receiverId);
    this.tileColumns = board.width;
    this.tileRows = board.height;

    const canvasEl = this._createCanvasElement();
    this.receiver.appendChild(canvasEl);
    this.canvasCtx = canvasEl.getContext('2d');
  }

  _createCanvasElement() {
    const canvasEl = document.createElement('canvas');
    canvasEl.width = this.tileColumns * Constants.TILE_SIZE;
    canvasEl.height = this.tileRows * Constants.TILE_SIZE;
    return canvasEl;
  }

  draw(game) {
    this.canvasCtx.clearRect(0, 0, this.tileColumns * Constants.TILE_SIZE, this.tileRows * Constants.TILE_SIZE);
    this._drawTileGrid(game.board);
    this._drawBlocks(game.board);
    this._drawCursor(game.cursor);
  }

  _drawBlocks(board) {
    for (let row = 0; row < this.tileRows; ++row) {
      for (let col = 0; col < this.tileColumns; ++col) {
        const block = board.grid.get(col, row);
        if (block != null) {
          this.canvasCtx.fillStyle = block.color;
          this.canvasCtx.fillRect(TS * col, TS * row, TS, TS);
        }
      }
    }
  }

  _drawCursor(cursor) {
    this.canvasCtx.strokeStyle = 'blue';
    this.canvasCtx.lineWidth = 5;
    this.canvasCtx.strokeRect(TS * cursor.position[0], TS * cursor.position[1], TS * 2, TS);
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