import {ComboNumberBoxObject} from './objects/ComboNumberBoxObject.js';

export const BLOCK_STATE_NORMAL = Symbol("BLOCK_STATE_NORMAL");
export const BLOCK_STATE_POPPING = Symbol("BLOCK_STATE_POPPING");
export const BLOCK_STATE_FALLING = Symbol("BLOCK_STATE_FALLING");

const DROP_SPEED = 3;
const BLOCK_POP_TIME = 80;
const SCROLL_PER_FRAME = 1 / (60 * 7);
const FREEZE_TIME_PER_POP = 40;

const BLOCK_COLORS = ["green", "purple", "red", "yellow", "cyan", "blue", "grey"];
const randomChoice = arr => arr[Math.floor(Math.random() * arr.length)];

class Block {
  constructor({ state = BLOCK_STATE_NORMAL, color = 'red' } = {}) {
    this._state = state;
    this.color = color;
    this.spriteIndex = BLOCK_COLORS.indexOf(color);
  }

  state(newState) {
    if (newState !== undefined) {
      this._state = newState;
    }
    return this._state;
  }

  popTime(newTimeValue) {
    if (newTimeValue !== undefined) {
      this._popTime = newTimeValue;
    }
    return this._popTime;
  }

  falling() {
    return this._state == BLOCK_STATE_FALLING;
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
  constructor({ width = 6, height = 12 } = {}) {
    this.width = width;
    this.height = height;
    this.grid = new BoardGrid(width, height);
    this.cursors = [];
    this.freezeCounter = 0;
    this.pendingScrolls = 0;
    this.gameObjects = [];
    this._initBoard();
  }

  addCursor(cursor) {
    this.cursors.push(cursor);
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
    this.nextRow = this._generateRow();
  }

  _generateRow() {
    const blocks = Array(this.width);
    for (let col = 0; col < this.width; col++) {
      blocks[col] = new Block({ color: randomChoice(BLOCK_COLORS) });
    }
    return blocks;
  }

  requestSwap(positionOne, positionTwo) {
    const blockOne = this.grid.get(...positionOne);
    const blockTwo = this.grid.get(...positionTwo);
    if (blockOne && blockOne.state() == BLOCK_STATE_POPPING ||
      blockTwo && blockTwo.state() == BLOCK_STATE_POPPING) {
      return;
    }
    this.grid.put(...positionTwo, blockOne);
    this.grid.put(...positionOne, blockTwo);
  }

  requestScroll() {
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        const block = this.grid.get(x, y);
        if (block && block.state() == BLOCK_STATE_POPPING) {
          return;
        }
      }
    }
    this.pendingScrolls++;
  }

  _handleBlockPopping() {
    let newClears = [];
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        const block = this.grid.get(x, y);
        // Can only start popping a block if it is in the normal state.
        if (block && block.state() == BLOCK_STATE_NORMAL) {
          let rowClears = this._getLineClears(x, y, block.color, true);
          let colClears = this._getLineClears(x, y, block.color, false);
          let allClears = rowClears.concat(colClears);
          // Initiate popping!
          for (const xy of allClears) {
            this.grid.get(...xy).state(BLOCK_STATE_POPPING);
            this.grid.get(...xy).popTime(BLOCK_POP_TIME);
            this.freezeCounter += FREEZE_TIME_PER_POP;
          }


          if(allClears.length !== 0) {
            // TODO number
            this.gameObjects.push( new ComboNumberBoxObject({boardX: x, boardY: y, number: 4}));
          }
        }
      }
    }

    // decrement popping block timers
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        const block = this.grid.get(x, y);
        if (block != null && block.state() == BLOCK_STATE_POPPING) {
          block.popTime(block.popTime() - 1);

          if (block.popTime() <= 0) {
            this.grid.put(x, y, null);
          }
        }
      }
    }
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
    } while (next && next.color == color && next.state() === BLOCK_STATE_NORMAL);
    return clears.length >= 3 ? clears : [];
  }

  tick() {
    this.cursors.forEach((c) => c.tick());
    this._doGravity();
    this._handleBlockPopping();
    this._tickScroll();
    this._tickAndKillGameObjects();
  }

  _tickAndKillGameObjects() {

    for(const gameObject of this.gameObjects) {
      gameObject.tick();
    }

    this.gameObjects = this.gameObjects.filter( obj => !obj.shouldDie() );
  }

  _tickScroll() {
    if (this.freezeCounter > 0) {
      this.freezeCounter--;
    } else {
      this.scroll = (this.scroll || 0) + SCROLL_PER_FRAME;
    }
    if (this.pendingScrolls > 0) {
      this.scroll += SCROLL_PER_FRAME * 20;
    }
    if (this.scroll > 1) {
      this.scroll--;
      if (this.pendingScrolls > 0) {
        this.pendingScrolls--;
        this.freezeCounter += 30;
      }
      this._pushTrash();
    }
  }

  _pushTrash() {
    this._pushTrashUp();
    this.cursors.forEach((c) => c.requestPushUp());
  }

  _pushTrashUp() {
    // Move everything on the playfield up.
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        this.grid.put(x, y, this.grid.get(x, y + 1));
        this.grid.put(x, y + 1, null);
      }
    }

    for (let x = 0; x < this.width; x++) {
      this.grid.put(x, this.height - 1, this.nextRow[x]);
    }
    this.nextRow = this._generateRow();
  }


  _doGravity() {
    // Does anything need to fall?
    const fallSections = this._getFallSegments();

    for (const fallingSegment of fallSections) {
      for (const [x, y] of fallingSegment) {
        this.grid.get(x, y).state(BLOCK_STATE_FALLING);
      }
    }

    if (fallSections.length === 0) {
      return;
    }

    // Do we need to wait for the cool-down of the last drop?
    this.gravityCounter = (this.gravityCounter || DROP_SPEED) - 1;
    if (this.gravityCounter !== 0) {
      return;
    }

    // Reset the gravity counter.
    this.gravityCounter = null;

    // We waited long enough, engage the fall logic.
    fallSections.forEach((segment) => { this._performSegmentFall(segment); });

    // Update our segments to reflect the fact that the blocks moved
    for (const segment of fallSections) {
      for (let i = 0; i < segment.length; ++i) {
        segment[i][1]++;
      }
    }

    // After doing all of the segment falls, if there is something under this segment,
    // then this is no longer falling.
    for (const segment of fallSections) {
      const lowestXY = this._lowestBlockInSegment(segment);

      // Is there a block beneath the bottom of the segment after the fall?
      const somethingBelowSegment = this.grid.get(lowestXY[0], lowestXY[1] + 1) != null;
      const segmentRestingOnBottom = lowestXY[1] == this.height - 1;
      if (somethingBelowSegment || segmentRestingOnBottom) {
        for (const xy of segment) {
          this.grid.get(...xy).state(BLOCK_STATE_NORMAL); // Need to do +1 because it's already been moved
        }
      }
    }

  }

  _lowestBlockInSegment(segment) {
    let lowestXY = [-999999, -999999];
    for (const xy of segment) {
      if (xy[1] > lowestXY[1]) {
        lowestXY = xy;
      }
    }
    return lowestXY;
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