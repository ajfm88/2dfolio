import { ComboNumberBoxObject } from './objects/ComboNumberBoxObject.js';
import { ChainNumberBoxObject } from './objects/ChainNumberBoxObject.js';
import { ComboPopParticles } from './objects/ComboPopParticles.js';
import { PositionSet } from './utils.js';

export const BLOCK_STATE_NORMAL = Symbol("BLOCK_STATE_NORMAL");
export const BLOCK_STATE_POPPING = Symbol("BLOCK_STATE_POPPING");
export const BLOCK_STATE_FALLING = Symbol("BLOCK_STATE_FALLING");
export const BLOCK_STATE_MOVING = Symbol("BLOCK_STATE_MOVING");

const DROP_SPEED = 3;
const BASE_BLOCK_POP_TIME = 80;
const BLOCK_POP_TIME_PER_BLOCK = 5;
const SCROLL_PER_FRAME = 1 / (60 * 7);
const FREEZE_TIME_PER_POP = 40;

const BLOOP_MODE = false;

const BLOCK_COLORS = ["green", "purple", "red", "yellow", "cyan"] //, "blue", "grey"];
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

  popAge(newAgeValue) {
    if (newAgeValue !== undefined) {
      this._popAge = newAgeValue;
    }
    return this._popAge;
  }

  disapearAge(newAgeValue) {
    if (newAgeValue !== undefined) {
      this._disapearAge = newAgeValue;
    }
    return this._disapearAge;
  }

  falling() {
    return this._state == BLOCK_STATE_FALLING;
  }

  previousPosition(opts) {
    if (opts) {
      this.lastPosition = opts;
      if (!BLOOP_MODE) {
        this.state(BLOCK_STATE_MOVING);
      }
    }
    return this.lastPosition;
  }

  movePosition(opts) {
    if (opts) {
      this._movePosition = opts;
    }
    return this._movePosition;
  }

  tick() {
    if (this._movePosition > 0) {
      this._movePosition -= 1 / 4;
      if (this._movePosition <= 0) {
        this.state(BLOCK_STATE_NORMAL);
      }
    }
    if (this._popAge != undefined) {
      this._popAge++;
    }
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

  * blocks() {
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        const block = this.get(x, y);
        if (block) {
          yield [block, x, y];
        }
      }
    }
  }
};

class Board {
  constructor({ width = 6, height = 12 } = {}) {
    this.width = width;
    this.height = height;
    this.grid = new BoardGrid(width, height);
    this.cursors = [];
    this.scroll = 0;
    this.freezeCounter = 0;
    this.pendingScrolls = 0;
    this.gameObjects = [];
    this.isChaining = false;
    this.chainCounter = 0;
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
    let blocks;
    do {
      blocks = Array(this.width);
      for (let col = 0; col < this.width; col++) {
        blocks[col] = new Block({ color: randomChoice(BLOCK_COLORS) });
      }
    } while (!this._isRowValid(blocks))
    return blocks;
  }
  _isRowValid(row) {
    for (let i = 2; i < row.length; i++) {
      if (row[i - 2].color == row[i - 1].color && row[i - 1].color == row[i].color) {
        return false;
      }
    }
    return true;
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
    if (blockOne) {
      blockOne.previousPosition(positionOne);
      blockOne.movePosition(1);
    }
    if (blockTwo) {
      blockTwo.previousPosition(positionTwo);
      blockTwo.movePosition(1);
    }
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
    let clearedPositions = new PositionSet();
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        const block = this.grid.get(x, y);
        // Can only start popping a block if it is in the normal state.
        if (block && block.state() == BLOCK_STATE_NORMAL) {
          let rowClears = this._getLineClears(x, y, block.color, true);
          let colClears = this._getLineClears(x, y, block.color, false);
          rowClears.forEach(p => clearedPositions.add(...p));
          colClears.forEach(p => clearedPositions.add(...p));
        }
      }
    }
    const clearCount = clearedPositions.size();

    // Initiate popping!
    var count = 0;
    for (const xy of clearedPositions.bookOrder()) {
      const block = this.grid.get(...xy)
      block.state(BLOCK_STATE_POPPING);
      block.popTime(BASE_BLOCK_POP_TIME + BLOCK_POP_TIME_PER_BLOCK * clearCount);
      block.popAge(0);
      block.disapearAge(BASE_BLOCK_POP_TIME + BLOCK_POP_TIME_PER_BLOCK * count);
      count++;
      this.freezeCounter += FREEZE_TIME_PER_POP;
    }


    // We popped something this frame so start chaining
    if (clearCount > 0) {
      if (!this.isChaining) {
        this.chainCounter = 0;
      }
      this.isChaining = true;
      this.chainCounter++;
    }
    let [topLeft] = clearedPositions;
    for (const [x, y] of clearedPositions) {
      if (y < topLeft[1] || (y == topLeft[1] && x < topLeft[0])) {
        topLeft = [x, y];
      }
    }

    if (clearCount > 3) {
      this.gameObjects.push(new ComboNumberBoxObject({ boardX: topLeft[0], boardY: topLeft[1], number: clearCount }));
    }

    if (clearCount > 0 && this.chainCounter > 1) {
      const position = topLeft;
      if (clearCount > 3) {
        position[1]--;
      }
      this.gameObjects.push(new ChainNumberBoxObject({ boardX: position[0], boardY: position[1], number: this.chainCounter }));
    }


    let initialDelay = 15;
    for (let [x, y] of clearedPositions.bookOrder()) {
      this.gameObjects.push(new ComboPopParticles({ boardX: x, boardY: y, initialDelay: initialDelay }));
      initialDelay += BLOCK_POP_TIME_PER_BLOCK * 1.5;
    }

    //Pop blocks that have aged fully
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        const block = this.grid.get(x, y);
        if (block != null && block.state() == BLOCK_STATE_POPPING) {
          if (block.popAge() >= block.popTime()) {
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
    for (let col = 0; col < this.width; col++) {
      for (let row = 0; row < this.height; row++) {
        let block = this.grid.get(col, row);
        if (block) {
          block.tick();
        }
      }
    }
    this.cursors.forEach((c) => c.tick());
    this._doGravity();
    this._handleBlockPopping();
    this._checkForEndOfChain();
    this._tickScroll();
    this._tickAndKillGameObjects();
  }

  _checkForEndOfChain() {
    for (let [block] of this.grid.blocks()) {
      if (block.state() == BLOCK_STATE_POPPING || block.state() == BLOCK_STATE_FALLING) {
        this.chainBufferFrame = 2;
        return;
      }
    }
    //Need to wait for two frames of nothing popping or falling as there is a frame
    //where things have popped, but things above it have not started to fall yet.
    this.chainBufferFrame = (this.chainBufferFrame || 2) - 1;
    if (this.isChaining && this.chainBufferFrame <= 0) {
      this.isChaining = false;
      this.chainBufferFrame = 2;
    }
  }

  _tickAndKillGameObjects() {
    for (const gameObject of this.gameObjects) {
      gameObject.tick();
    }

    this.gameObjects = this.gameObjects.filter(obj => !obj.shouldDie());
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

        if (whatsHere != null && whatsHere.state() !== BLOCK_STATE_MOVING) {
          currentSegment.push([x, y]);
        } else {
          // There's nothing at this cell. But if there is still an ongoing segment, then we just finished a segment
          if (currentSegment.length > 0) {
            results.push(currentSegment);
            currentSegment = [];
          }

          while (y >= 0 && this.grid.get(x, y) != null) {
            y--;
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