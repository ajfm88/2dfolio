const BLOCK_STATE_INITIAL = Symbol("BLOCK_STATE_INITIAL");
const DROP_SPEED = 3;

const BLOCK_COLORS = ["green", "purple", "red", "yellow", "cyan", "blue", "grey"];
const randomChoice = arr => arr[Math.floor(Math.random() * arr.length)];

class Block {
  constructor({ state = BLOCK_STATE_INITIAL, color = 'red' } = {}) {
    this.state = state;
    this.color = color;
    this.spriteIndex = BLOCK_COLORS.indexOf(color);
  }

  falling(newValue) {
    if (newValue !== undefined) {
      this.isFalling = newValue;
    }
    return this.isFalling;
  }
}

class BoardGrid {

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
};

class Board {
  constructor({ width = 6, height = 13 } = {}) {
    this.width = width;
    this.height = height;
    this.grid = new BoardGrid(width, height);
    this._initBoard();
  }

  _initBoard() {
    for (let col = 0; col < this.width; col++) {
      if (col == 3) {
        continue;
      }
      for (let row = this.height - 1; row > this.height - 8; row--) {
        const color = randomChoice(BLOCK_COLORS);
        this.grid.put(col, row, new Block({ color: color }));
      }
    }
  }

  pushTrashUp() {
    // Move everything on the playfield up.
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        this.grid.put(x, y, this.grid.get(x, y + 1));
        this.grid.put(x, y + 1, null);
      }
    }

    for (let x = 0; x < this.width; x++) {
      this.grid.put(x, this.height - 1, new Block({ color: randomChoice(BLOCK_COLORS) }));
    }
  }

  requestSwap(positionOne, positionTwo) {
    const blockOne = this.grid.get(...positionOne);
    const blockTwo = this.grid.get(...positionTwo);
    this.grid.put(...positionTwo, blockOne);
    this.grid.put(...positionOne, blockTwo);
  }

  _determineClears() {
    let allClears = [];
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        const block = this.grid.get(x, y);
        if (block && !block.falling()) {
          let rowClears = this._getLineClears(x, y, block.color, true);
          let colClears = this._getLineClears(x, y, block.color, false);
          allClears.push(...rowClears);
          allClears.push(...colClears);
        }
      }
    }
    allClears.forEach((xy) => this.grid.put(...xy, null));
  }

  _getLineClears(x, y, color, isRow) {
    let clears = [];
    let next;
    do {
      clears.push([x, y]);
      if (isRow) {
        x++
      } else {
        y++;
      }
      if (x >= this.width || y > this.height) {
        break;
      }
      next = this.grid.get(x, y);
    } while (next && next.color == color && !next.falling());
    return clears.length >= 3 ? clears : [];
  }

  tick() {
    this._determineClears();
    this._doGravity();
  }

  _doGravity() {
    // Does anything need to fall?
    const fallSections = this._getFallSegments();

    // HACK : No good way to detect end of falling for a block, 
    // so... just set everything not falling, then update the ones
    // that still are.
    for (let x = 0; x < this.width; ++x) {
      for (let y = 0; y < this.height; ++y) {
        const block = this.grid.get(x, y);
        if (block) {
          block.falling(false);
        }
      }
    }
    for (const fallingSegment of fallSections) {
      for (const [x, y] of fallingSegment) {
        this.grid.get(x, y).falling(true);
      }
    }
    // </HACK>

    if (fallSections.length === 0) {
      return;
    }

    // Do we need to wait for the cool-down of the last drop?
    this.gravityCounter = (this.gravityCounter || DROP_SPEED) - 1;
    if (this.gravityCounter === 0) {
      this.gravityCounter = null;
      // We waited long enough, engage the fall logic.
      fallSections.forEach((segment) => { this._performSegmentFall(segment); });
    }
  }

  _performSegmentFall(segment) {
    const fallingBlocks = [];

    // Get all the blocks for this segment, remove them
    for (const [x, y] of segment) {
      const block = this.grid.get(x, y);
      fallingBlocks.push([x, y, block]);
      this.grid.put(x, y, null);
    }

    // Place them back down one square
    for (const [x, y, block] of fallingBlocks) {
      this.grid.put(x, y + 1, block);
    }
  }

  _getFallSegments() {

    const results = [];
    for (let x = 0; x < this.width; ++x) {

      let y = (this.height - 1); // Start at the bottom of the field
      let currentSegment = [];

      // Find the first open spot.
      while (this.grid.get(x, y) != null && y >= 0) {
        y--;
      }

      while (y >= 0) {
        const whatsHere = this.grid.get(x, y);

        if (whatsHere != null) {
          currentSegment.push([x, y]);
        } else {
          // There's nothing at this cell. But if there is still an ongoing segment, then we just finished a segment
          if (currentSegment.length > 0) {
            results.push(currentSegment);
            currentSegment = [];
          }
        }

        y--;
      }

      // If there is an unfinished segment at this point, push it.
      if (currentSegment.length > 0) {
        results.push(currentSegment);
        currentSegment = [];
      }

    }

    return results;
  }

}

export { Board };