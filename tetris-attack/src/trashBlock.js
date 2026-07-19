import { Block } from "./block.js";
import { Grid } from "./grid.js";

const TRASH_STATE_NORMAL = Symbol.for('TRASH_STATE_NORMAL');
const TRASH_STATE_POPPING = Symbol.for('TRASH_STATE_POPPING');

class TrashBlock {

  // x and y represent the top left hand corner of the trash block
  constructor({ x = 0, y = 0, width = 3, height = 1 } = {}) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this._state = TRASH_STATE_NORMAL;
    this._popAge = 0;
    this._initGrid();
  }

  _initGrid() {
    this.interiorBlocks = new Grid( this.width, this.height );
    for (let [block, x, y] of this.interiorBlocks.allPositions()) {
      this.interiorBlocks.put(x,y,Block.randomBlock());
    }
  }

  shrink() {
    this.height--;
    this._state = TRASH_STATE_NORMAL;
  }

  state(newState) {
    if (newState !== undefined) {
      this._state = newState;
    }
    return this._state;
  }

  popAge(newValue) {
    if (newValue !== undefined) {
      this._popAge = newValue;
    }
    return this._popAge;
  }

  * positions() {
    for (let i = 0; i < this.width; i++) {
      for (let j = 0; j < this.height; j++) {
        yield [this.x + i, this.y + j];
      }
    }
  }
}

export { TrashBlock, TRASH_STATE_NORMAL, TRASH_STATE_POPPING };