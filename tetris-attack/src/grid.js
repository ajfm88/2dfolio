export class Grid {
  constructor(width, height) {
    this.width = width;
    this.height = height;

    this.grid = Array(width);
    for (let col = 0; col < width; ++col) {
      this.grid[col] = Array(height);
    }
  }

  // Though the rest of the code treats the top left corner of the board as 0,0
  // We represent the grid here inverted with position height - 1 as 0 index.
  // This ensures when we grow the board into negative y positions, we are actually 
  // storing positions at positive indexs. 

  // No code should get the raw width, height or grid from this class and instead rely
  // on the accessors and iterators for positions/blocks
  get(x, y) { return this.grid[x][this.height - y - 1]; }
  put(x, y, new_state) { this.grid[x][this.height - y - 1] = new_state; }

  pushUp() {
    this.grid.forEach(col => col.unshift(null));
  }

  * entries() {
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.grid[x].length; y++) {
        let realY = this.height - y - 1; 
        const block = this.get(x, realY); 
        if (block) {
          yield [block, x, realY];
        }
      }
    }
  }

  * allPositions() {
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.grid[x].length; y++) {
        let realY = this.height - y - 1;
        const block = this.get(x, realY); 
        yield [block, x, realY];
      }
    }
  }
};

