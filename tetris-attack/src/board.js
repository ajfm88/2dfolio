const BLOCK_STATE_INITIAL = Symbol("BLOCK_STATE_INITIAL");

class Block {
  constructor({ state = BLOCK_STATE_INITIAL, color = 'red' } = {}) {
    this.state = state;
    this.color = color;
  }
}

class BoardGrid {

  constructor(width, height) {
    this.width = width;
    this.heigh = height;

    this.grid = Array(height);
    for (let col = 0; col < height; ++col) {
      this.grid[col] = Array(width);
    }
  }

  get(x, y) { return this.grid[x][y]; }
  put(x, y, new_state) { this.grid[x][y] = new_state; }
};

class Board {
  constructor({ width = 8, height = 20 } = {}) {
    this.width = width;
    this.height = height;
    this.grid = new BoardGrid(width, height);

    this.grid.put(2, 1, new Block());
    this.grid.put(3, 1, new Block({ color: 'purple' }));
    this.grid.put(4, 1, new Block({ color: 'red' }));
    this.grid.put(5, 1, new Block({ color: 'green' }));
    this.grid.put(7, 1, new Block({ color: 'red' }));

    this.grid.put(7, 2, new Block({ color: 'purple' }));
    this.grid.put(2, 2, new Block({ color: 'green' }));

    this.grid.put(4, 3, new Block({ color: 'purple' }));
    this.grid.put(6, 3, new Block({ color: 'green' }));
    this.grid.put(9, 3, new Block({ color: 'red' }));
  }

  requestSwap(positionOne, positionTwo) {
    const blockOne = this.grid.get(...positionOne);
    const blockTwo = this.grid.get(...positionTwo);
    this.grid.put(...positionTwo, blockOne);
    this.grid.put(...positionOne, blockTwo);
  }

  tick() {

  }
}

export { Board };