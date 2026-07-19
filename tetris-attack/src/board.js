import { ComboNumberBoxObject } from './objects/ComboNumberBoxObject.js';
import { ChainNumberBoxObject } from './objects/ChainNumberBoxObject.js';
import { ComboPopParticles } from './objects/ComboPopParticles.js';
import { PositionSet } from './utils.js';
import { Grid } from './grid.js';
import { TrashBlock, TRASH_STATE_NORMAL, TRASH_STATE_POPPING } from './trashBlock.js';
import { TrashQueue } from './trashQueue.js';
import {
  BLOCK_STATE_NORMAL,
  BLOCK_STATE_POPPING,
  BLOCK_STATE_FALLING,
  BLOCK_STATE_MOVING,
  BLOCK_STATE_HOVERING,
  BLOCK_COLORS,
  Block
} from './block.js';

const VALID_SWAP_STATES = new Set([BLOCK_STATE_FALLING, BLOCK_STATE_NORMAL]);

const FRAMES_PER_GRAVITY_FALL = 1;
const BASE_BLOCK_POP_TIME = 80;
const BLOCK_POP_TIME_PER_BLOCK = 9;
const SCROLL_PER_FRAME = 1 / (60 * 7);
const FREEZE_TIME_PER_POP = 40;
const HOVER_TIME = 12;

const randomChoice = arr => arr[Math.floor(Math.random() * arr.length)];

class Board {
  constructor({ width = 6, height = 12 } = {}) {
    this.width = width;
    this.height = height;
    this.grid = new Grid(width, height);
    this.cursors = [];
    this.scroll = 0;
    this.freezeCounter = 0;
    this.pendingScrolls = 0;
    this.gameObjects = [];
    this.isChaining = false;
    this.chainCounter = 0;
    this.trash = [];
    this.trashQueue = new TrashQueue();
    this._initBoard();
  }

  setTrashQueue(trashQueue) {
    this.trashQueue = trashQueue;
  }

  addCursor(cursor) {
    this.cursors.push(cursor);
  }

  _initBoard() {
    for (let col = 0; col < this.width; col++) {
      // Typical to have a hole down the 4th column.
      if (col == 3) {
        continue;
      }

      for (let row = this.height - 1; row > this.height - 8; row--) {
        let color, left, below;
        do {
          color = randomChoice(BLOCK_COLORS);
          left = this.grid.get(Math.max(0, col - 1), row);
          below = this.grid.get(col, Math.min(row + 1, this.height - 1));
        } while ((left && left.color == color) || (below && below.color == color));
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

  addTrashBlock(trashBlock) {
    let topMostRow = 0;
    for (let [block, x, y] of this.grid.entries()) {
      topMostRow = Math.min(topMostRow, y)
    }
    for (let trash of this.trash) {
      topMostRow = Math.min(topMostRow, trash.y);
    }
    let freeRow = topMostRow - 1;
    trashBlock.y = freeRow - trashBlock.height;
    trashBlock.x = Math.random() < .5 ? 0 : this.width - trashBlock.width;
    this.trash.push(trashBlock);
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
    // Can't swap with trashblocks
    if (this.trashGrid.get(...positionOne) || this.trashGrid.get(...positionTwo)) {
      return;
    }

    const blockOne = this.grid.get(...positionOne);
    const blockTwo = this.grid.get(...positionTwo);

    if (blockOne && !VALID_SWAP_STATES.has(blockOne.state()) ||
      blockTwo && !VALID_SWAP_STATES.has(blockTwo.state())) {
      return;
    }

    // If we're swapping into an empty space, need to make sure the spot above the empty isn't hovering.
    if (blockOne && !blockTwo) {
      const above = this.grid.get(positionTwo[0], positionTwo[1] - 1);
      if (above && above.state() == BLOCK_STATE_HOVERING) {
        return;
      }
    }
    if (!blockOne && blockTwo) {
      const above = this.grid.get(positionOne[0], positionOne[1] - 1);
      if (above && above.state() == BLOCK_STATE_HOVERING) {
        return;
      }
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

    for (const [block, x, y] of this.grid.entries()) {
      if (block.state() == BLOCK_STATE_NORMAL) {
        const rowClears = this._getLineClears(x, y, block.color, true);
        rowClears.forEach(p => clearedPositions.add(...p));

        const colClears = this._getLineClears(x, y, block.color, false);
        colClears.forEach(p => clearedPositions.add(...p));
      }
    }

    const clearCount = clearedPositions.size();

    // Initiate popping!
    let count = 0;
    for (const xy of clearedPositions.bookOrder()) {
      const block = this.grid.get(...xy);
      block.state(BLOCK_STATE_POPPING);
      block.popTime(BASE_BLOCK_POP_TIME + BLOCK_POP_TIME_PER_BLOCK * clearCount);
      block.popAge(0);
      block.disapearAge(BASE_BLOCK_POP_TIME + BLOCK_POP_TIME_PER_BLOCK * count);
      count++;
      this.freezeCounter += FREEZE_TIME_PER_POP;

      // Set any adjacent trash blocks that are in a normal state to popping
      this._initiateTrashPopping(...xy);
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
      this._addComboTrash(clearCount);
      this.gameObjects.push(new ComboNumberBoxObject({ boardX: topLeft[0], boardY: topLeft[1], number: clearCount }));
    }

    if (clearCount > 0 && this.chainCounter > 1) {
      const position = topLeft;
      if (clearCount > 3) {
        position[1]--;
      }
      this.gameObjects.push(new ChainNumberBoxObject({ boardX: position[0], boardY: position[1], number: this.chainCounter }));
    }

    for (const [block, x, y] of this.grid.entries()) {
      if (block.state() == BLOCK_STATE_POPPING) {

        // If this is the frame we disappear the block, spawn some poof
        if (block.popAge() == block.disapearAge()) {
          this.gameObjects.push(new ComboPopParticles({ boardX: x, boardY: y }));
        }

        //Pop blocks that have aged fully
        if (block.popAge() >= block.popTime()) {
          this.grid.put(x, y, null);
        }
      }
    }
  }

  _initiateTrashPopping(x, y) {
    // Look through each trash block. See if (x,y) falls within one square of the block
    for (const trash of this.trash) {

      if (trash.state() != TRASH_STATE_NORMAL) {
        continue;
      }

      const left = trash.x - 1;
      const right = trash.x + trash.width;
      const up = trash.y - 1;
      const down = trash.y + trash.height;
      const matchy = y == up || y == down;
      const matchx = x == left || x == right;

      // Need to make sure we don't pop trash that is diagonally adjacent to this popped position
      if (matchx && (up < y && y < down) || matchy && (left < x && x < right)) {
        trash.state(TRASH_STATE_POPPING);
        trash.popAge(60);

        // This trash popping could chain into popping other trash
        for(let trashPositions of trash.positions()) {
          this._initiateTrashPopping(...trashPositions);
        }
      }
      // TODO : Delays / animation triggering
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

  _addComboTrash(comboSize) {
    //TODO this is so wrong
    let trashLength = comboSize - 1;
    if (trashLength <= this.width) {
      this.trashQueue.addTrash(new TrashBlock({ width: trashLength }));
    } else if (trashLength <= this.width * 2) {
      let half = Math.floor(trashLength / 2);
      this.trashQueue.addTrash(new TrashBlock({ width: half }));
      this.trashQueue.addTrash(new TrashBlock({ width: trashLength - half }));
    } else {
      for (let i = 0; i < 6.5 * Math.log(trashLength) - 13; i++) {
        this.trashQueue.addTrash(new TrashBlock({ width: this.width }));
      }
    }
  }

  tick() {
    this._indexTrashBlocks();
    for (const [block] of this.grid.entries()) {
      block.tick();
    }

    this.cursors.forEach((c) => c.tick());
    this._doGravity();
    this._handleBlockPopping();
    this._tickTrash();
    this._checkForEndOfChain();
    this._tickScroll();
    this._tickAndKillGameObjects();
  }

  _tickTrash() {
    for (const trash of this.trash) {
      if (trash.state() == TRASH_STATE_POPPING) {
        trash.popAge(trash.popAge() - 1);
      }
    }

    for (let trash of this.trash) {
      if (trash.state() == TRASH_STATE_POPPING && trash.popAge() == 0) {
        for (let i = 0; i < trash.width; i++) {
          let x = trash.x + i;
          let y = trash.y + trash.height - 1;
          this.grid.put(x, y, trash.interiorBlocks.get(i, trash.height - 1));
        }
        trash.shrink();
      }
    }

    this.trash = this.trash.filter(trash => {
      return trash.height > 0;
    });
  }

  _indexTrashBlocks() {
    this.trashGrid = new Grid(this.width, this.height);
    for (const trash of this.trash) {
      for (let [x, y] of trash.positions()) {
        this.trashGrid.put(x, y, trash);
      }
    }
  }

  _checkForEndOfChain() {
    for (let [block] of this.grid.entries()) {
      if (block.state() == BLOCK_STATE_POPPING ||
        block.state() == BLOCK_STATE_FALLING ||
        block.state() == BLOCK_STATE_HOVERING) {
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
      if (this.chainCounter > 1) {
        this.trashQueue.addTrash(new TrashBlock({ width: this.width, height: this.chainCounter - 1 }));
      }
      this.trashQueue.flush();
    }
  }

  _tickAndKillGameObjects() {
    this.gameObjects.forEach(object => object.tick());
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
      this._pushNewRow();
    }
  }

  _pushNewRow() {
    this._pushNewRowUp();
    this.cursors.forEach((c) => c.requestPushUp());
  }

  _pushNewRowUp() {
    // Move everything on the playfield up.
    this.grid.pushUp();
    this.trash.forEach(t => t.y--);

    for (let x = 0; x < this.width; x++) {
      this.grid.put(x, this.height - 1, this.nextRow[x]);
    }
    this.nextRow = this._generateRow();
  }

  _doGravity() {
    // Does anything need to fall?
    let frameStartHoles = new PositionSet();
    for (let [block, x, y] of this.grid.allPositions()) {
      if (block == undefined && this.trashGrid.get(x, y) == undefined) {
        frameStartHoles.add(x, y);
      }
    }

    let positionsForGravity = new PositionSet();
    for (let [block, x, y] of this.grid.entries()) {
      positionsForGravity.add(x, y);
    }
    for (let trash of this.trash) {
      positionsForGravity.add(trash.x, trash.y);
    }

    for (let [x, y] of positionsForGravity.reversedBookOrder()) {
      if (y == this.height - 1) {
        continue;
      }
      let block = this.grid.get(x, y);
      if (block) {
        let belowBlock = this.grid.get(x, y + 1);
        let belowTrash = this.trashGrid.get(x, y + 1);
        //Block should fall or start hovering
        if (belowBlock == undefined && belowTrash == undefined) {
          if (block.state() == BLOCK_STATE_NORMAL) {
            if (frameStartHoles.has(x, y + 1)) {
              block.state(BLOCK_STATE_HOVERING);
              block.hoverTime(HOVER_TIME);
            } else {
              block.state(BLOCK_STATE_FALLING);
            }
          }
          if (block.state() == BLOCK_STATE_HOVERING) {
            block.hoverTime(block.hoverTime() - 1);
            if (block.hoverTime() < 1) {
              block.state(BLOCK_STATE_FALLING);
            }
          } else if (block.state() == BLOCK_STATE_FALLING) {
            this.grid.put(x, y, null);
            this.grid.put(x, y + 1, block);
            let newBelow = this.grid.get(x, y + 2);
            let newTrashBelow = this.trashGrid.get(x, y + 2);
            if (y + 1 == this.height - 1 ||
              (newBelow && newBelow.state() != BLOCK_STATE_FALLING) ||
              newTrashBelow) {
              block.state(BLOCK_STATE_NORMAL);
            }
          }
        }
      }

      // Handle gravity for trash blocks with top left corner at this [x,y] position 
      let trashBlock = this.trashGrid.get(x, y);
      if (trashBlock && trashBlock.x == x && trashBlock.y == y) {
        let positionsBelow = Array.from({ length: trashBlock.width }, (_, i) => [i + x, y + trashBlock.height]);
        let allSpaceBelow = true;
        let wasAllSpaceToStart = true;
        for (let [belowX, belowY] of positionsBelow) {
          if (this.grid.get(belowX, belowY) || this.trashGrid.get(belowX, belowY)) {
            allSpaceBelow = false;
          }
          if (!frameStartHoles.has(belowX, belowY)) {
            wasAllSpaceToStart = false;
          }
        }
        if (allSpaceBelow) {
          trashBlock.y++;
          for (let [tx, ty] of trashBlock.positions()) {
            this.trashGrid.put(tx, ty, null);
            this.trashGrid.put(tx, ty + 1, trashBlock);
          }
        }
      }
    }
  }

}

export { Board };