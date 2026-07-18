export class Grid {

  constructor(width, height) {
    this.width = width;
    this.height = height;

    this.grid = Array(width);
    for (let col = 0; col < width; ++col) {
      this.grid[col] = Array(height);
    }
  }

  get(x, y) { return this.grid[x][y]; }
  put(x, y, new_state) { this.grid[x][y] = new_state; }

  * entries() {
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        const block = this.get(x, y);
        if (block) {
          yield [block, x, y];
        }
      }
    }
  }

  * allPositions() {
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        const block = this.get(x, y);
        yield [block, x, y];
      }
    }
  }
};